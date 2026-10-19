import React from "react";
import { AbsoluteFill, Audio, Sequence, OffthreadVideo, Img, staticFile, useCurrentFrame } from "remotion";
import {
  TransitionSeries,
  linearTiming,
  springTiming,
  type TransitionPresentation,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type { Timeline as TimelineV2 } from "./types";
import type {
  ClipTransition,
  ColorClip,
  ImageClip,
  SceneTagged,
  Shape as ShapeV3Type,
  TimelineV3,
  VideoClip,
  Word as WordV3Type,
} from "./types.v3";
import {
  audioTrackOf,
  imageTracksOf,
  isV3,
  shapeTrackOf,
  textTrackOf,
  videoTrackOf,
} from "./types.v3";
import { migrateV2toV3 } from "./migrateV3";
import { coalesceWithMap } from "./coalesce";
import { Word } from "./Word";
import { Shape } from "./Shape";
import { ImageLayer, CoverLayer, BoxLayer } from "./Background";
import { hasTrack, samplePosition, sampleScalar } from "./keyframes";
import { Grid } from "./Grid";
import { musicVolumeAt, type AbsRegion } from "./compose";

// Main composition (v3 — tracks on an absolute timeline). Accepts a v2 (scenes)
// OR v3 (tracks) timeline and migrates idempotently, so old --props and the
// editor's <Player> both work and stay WYSIWYG with the render.
//
// CRITICAL — pixel-identity with the old scene engine: v2 crossfaded WHOLE-SCENE
// composites (text composited onto its background, then faded). A flat per-track
// blend is NOT the same operation. So we reconstruct per-scene composite
// "segments" from the background clips and feed them to ONE <TransitionSeries> —
// structurally identical to v2 (so pixel-identical by construction), degenerating
// to hard cuts when every overlap is 0.

// ── Transition mapping (reused verbatim from the v2 engine) ──────────────────
const presentationFor = (t: ClipTransition): TransitionPresentation<Record<string, unknown>> => {
  switch (t.type) {
    case "slide":
      return slide(t.direction ? { direction: t.direction } : undefined) as TransitionPresentation<Record<string, unknown>>;
    case "wipe":
      return wipe(t.direction ? { direction: t.direction } : undefined) as TransitionPresentation<Record<string, unknown>>;
    case "fade":
    default:
      return fade() as TransitionPresentation<Record<string, unknown>>;
  }
};

const timingFor = (t: ClipTransition, overlap: number) =>
  t.timing === "spring"
    ? springTiming({ durationInFrames: overlap, config: { damping: 200 } })
    : linearTiming({ durationInFrames: overlap });

// ── Segment reconstruction ───────────────────────────────────────────────────
// A segment = one background clip (video|color|image) + the shapes/words painted
// over it = one v2 scene. Background clips tile the timeline in start order.

type BgClip = VideoClip | ColorClip | ImageClip;

type Segment = {
  index: number;
  start: number; // absolute
  durationInFrames: number;
  bg: BgClip;
  shapes: SceneTagged<ShapeV3Type>[];
  words: SceneTagged<WordV3Type>[];
  overlays: ImageClip[]; // image clips layered OVER this segment's video (z: video < image < shape < text)
  transitionToNext?: ClipTransition;
};

// An image clip is a true OVERLAY (rendered on top of the video, not as its own
// full-frame background segment) when it temporally overlaps a video/color clip on
// the video track. Migrated content never does this (each scene is ONE background),
// so the segment set — and therefore the render — is byte-identical to before.
const overlapsVideo = (img: ImageClip, videoClips: (VideoClip | ColorClip)[]): boolean =>
  videoClips.some((v) => img.start < v.end && img.end > v.start);

// Which segment owns an element. Prefer the migration's `_scene` tag (exact);
// otherwise the latest background clip that has started by the element's start.
const ownerIndex = (el: SceneTagged<{ start: number }>, bgClips: BgClip[]): number => {
  if (typeof el._scene === "number") return el._scene;
  let idx = 0;
  for (let k = 0; k < bgClips.length; k++) {
    if (bgClips[k].start <= el.start) idx = k;
    else break;
  }
  return idx;
};

const buildSegments = (t: TimelineV3): Segment[] => {
  const videoClips = videoTrackOf(t)?.clips ?? [];
  const imageClips = imageTracksOf(t).flatMap((it) => it.clips);
  // Split image clips: a full-frame BACKGROUND image (tiles like a scene bg) vs a
  // true OVERLAY (sits on top of the video). Background images join the segment set
  // (so migrated content is unchanged); overlays are layered into the segment that
  // owns their start.
  const overlayImages = imageClips.filter((img) => overlapsVideo(img, videoClips));
  const bgImages = imageClips.filter((img) => !overlapsVideo(img, videoClips));
  // Original background clips (one per scene for migrated content), in start order.
  const sortedBg: BgClip[] = [...videoClips, ...bgImages].sort((a, b) => a.start - b.start);
  // Coalesce seamless cut pieces (same source, contiguous, hard cut) into one
  // continuous element so the preview never remounts/reseeks the video at a cut.
  // `mergedIndexOf` maps each ORIGINAL clip → its merged segment, so element
  // ownership (which segment paints a word/shape) survives the merge — a coalesced
  // later scene keeps its own words instead of losing them.
  const { merged: bgClips, mergedIndexOf } = coalesceWithMap(sortedBg);
  const segOf = (el: SceneTagged<{ start: number }>): number => {
    const orig = ownerIndex(el, sortedBg);
    const m = mergedIndexOf[orig];
    return m === undefined ? Math.max(0, bgClips.length - 1) : m;
  };
  const shapesAll = shapeTrackOf(t)?.shapes ?? [];
  const wordsAll = textTrackOf(t)?.words ?? [];

  const segs: Segment[] = bgClips.map((bg, i) => ({
    index: i,
    start: bg.start,
    durationInFrames: Math.max(1, bg.end - bg.start),
    bg,
    shapes: shapesAll.filter((s) => segOf(s) === i),
    words: wordsAll.filter((w) => segOf(w) === i),
    overlays: [] as ImageClip[],
    transitionToNext: (bg as VideoClip | ColorClip | ImageClip).transitionToNext,
  }));
  // Assign each overlay to the segment whose span contains its start (latest bg
  // clip started by then), so it renders once, self-clipping to [start,end).
  for (const img of overlayImages) {
    const oi = segOf(img as SceneTagged<{ start: number }>);
    if (segs[oi]) segs[oi].overlays.push(img);
  }
  return segs;
};

// Effective overlap (frames) consumed by the transition after segment `i`. Mirrors
// compose.overlapAfter exactly: clamp to min(durA,durB)-1, 0 = hard cut.
const segOverlapAfter = (segs: Segment[], i: number): number => {
  const s = segs[i];
  const n = segs[i + 1];
  if (!s || !n) return 0;
  const t = s.transitionToNext;
  if (!t || t.type === "none") return 0;
  const want = Math.round(t.durationInFrames);
  if (want <= 0) return 0;
  const max = Math.max(0, Math.min(s.durationInFrames, n.durationInFrames) - 1);
  return Math.min(want, max);
};

// ── Background clip rendering — reuse the exact v2 layer components ───────────
const BgClipView: React.FC<{ clip: BgClip; frameWidth: number; frameHeight: number }> = ({
  clip,
  frameWidth,
  frameHeight,
}) => {
  if (clip.kind === "color") {
    return <AbsoluteFill style={{ backgroundColor: clip.color }} />;
  }
  if (clip.kind === "image") {
    return <ImageLayer bg={{ type: "image", src: clip.src, fit: clip.fit }} />;
  }
  // video
  if (clip.fit === "cover") {
    const cover = (
      <CoverLayer
        bg={{
          type: "cover",
          src: clip.src,
          startFrom: clip.startFrom,
          volume: clip.volume,
          muted: clip.muted,
        }}
      />
    );
    const hasTreatment =
      clip.backgroundBlur !== undefined ||
      clip.backgroundBrightness !== undefined ||
      clip.backgroundSaturation !== undefined ||
      clip.backgroundScale !== undefined;
    if (!hasTreatment) return cover;
    return (
      <AbsoluteFill
        style={{
          filter: `blur(${clip.backgroundBlur ?? 0}px) brightness(${clip.backgroundBrightness ?? 1}) saturate(${clip.backgroundSaturation ?? 1})`,
          transform: `scale(${clip.backgroundScale ?? 1})`,
        }}
      >
        {cover}
      </AbsoluteFill>
    );
  }
  // contain: a migrated box carries geometry → reuse BoxLayer verbatim (exact v2
  // inset look, incl. placeholder hatch). Otherwise a plain full-frame letterbox.
  const hasBoxGeometry =
    clip.x !== undefined ||
    clip.y !== undefined ||
    clip.width !== undefined ||
    clip.height !== undefined ||
    clip.borderRadius !== undefined;
  if (hasBoxGeometry) {
    return (
      <BoxLayer
        bg={{
          type: "box",
          src: clip.src,
          x: clip.x ?? 0,
          y: clip.y ?? 0,
          width: clip.width ?? frameWidth,
          height: clip.height ?? frameHeight,
          borderRadius: clip.borderRadius ?? 0,
          backColor: clip.backColor ?? "#000000",
          startFrom: clip.startFrom,
          volume: clip.volume,
          muted: clip.muted,
        }}
      />
    );
  }
  return (
    <AbsoluteFill style={{ backgroundColor: clip.backColor ?? "#000000" }}>
      <OffthreadVideo
        src={staticFile(clip.src)}
        startFrom={clip.startFrom ?? 0}
        muted={clip.muted ?? false}
        volume={clip.muted ? 0 : clip.volume ?? 1}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </AbsoluteFill>
  );
};

// ── One scene composite (z-order: background → shapes → words) ───────────────
// Inside the <TransitionSeries.Sequence> useCurrentFrame() is segment-relative;
// pass the segment's absolute start to Word/Shape so their sampling stays correct.
const SegmentLayer: React.FC<{ seg: Segment; frameWidth: number; frameHeight: number }> = ({
  seg,
  frameWidth,
  frameHeight,
}) => (
  <AbsoluteFill>
    <BgClipView clip={seg.bg} frameWidth={frameWidth} frameHeight={frameHeight} />
    {seg.overlays.map((img) =>
      OVERLAY_VIDEO_RE.test(img.src) ? (
        <OverlayVideoLayer key={img.id} clip={img} offset={seg.start} />
      ) : (
        <ImageClipLayer key={img.id} clip={img} offset={seg.start} />
      )
    )}
    {seg.shapes.map((s) => (
      <Shape key={s.id} shape={s} offset={seg.start} />
    ))}
    {seg.words.map((w, i) => (
      <Word key={i} word={w} offset={seg.start} />
    ))}
  </AbsoluteFill>
);

// ── Video-overlay clip — a full-frame muted B-roll cutaway laid OVER the band
// collage (z: above the video bg + image overlays, below shapes/text). Same image
// track + ImageClip carrier as an image overlay, but the src is a video file, so we
// play it with <OffthreadVideo> instead of <Img>. The эфир background stays mounted
// underneath (its speech audio keeps playing); only the PICTURE is swapped for the
// span. A <Sequence from={clip.start-offset}> makes the clip play from its own frame
// 0 (the B-roll is pre-trimmed to the span) and clips it to [start,end). Opacity is
// sampled from the overlay's keyframes (the in/out crossfade) at the clip-relative
// frame. Geometry is full-frame cover (B-roll is authored 1080×1920, x/y 0).
const OVERLAY_VIDEO_RE = /\.(mp4|mov|m4v|webm)$/i;

const OverlayVideoInner: React.FC<{ clip: ImageClip }> = ({ clip }) => {
  const rel = useCurrentFrame(); // 0 = clip.start (the wrapping Sequence rebases)
  const kf = clip.keyframes;
  const pos = hasTrack(kf?.position) ? samplePosition(kf!.position!, rel) : { x: clip.x, y: clip.y };
  const width = hasTrack(kf?.width) ? sampleScalar(kf!.width!, rel) : clip.width;
  const height = hasTrack(kf?.height) ? sampleScalar(kf!.height!, rel) : clip.height;
  const opacity = hasTrack(kf?.opacity) ? sampleScalar(kf!.opacity!, rel) : clip.opacity ?? 1;
  const rotation = hasTrack(kf?.rotation) ? sampleScalar(kf!.rotation!, rel) : clip.rotation ?? 0;
  const borderRadius = hasTrack(kf?.borderRadius) ? sampleScalar(kf!.borderRadius!, rel) : clip.borderRadius ?? 0;
  const blur = hasTrack(kf?.blur) ? sampleScalar(kf!.blur!, rel) : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${rotation}deg)`,
        opacity,
        borderRadius,
        overflow: "hidden",
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        willChange: "transform, opacity, filter",
      }}
    >
      <OffthreadVideo
        src={staticFile(clip.src)}
        startFrom={clip.startFrom ?? 0}
        muted
        volume={0}
        style={{ width: "100%", height: "100%", objectFit: clip.fit ?? "cover" }}
      />
    </div>
  );
};

const OverlayVideoLayer: React.FC<{ clip: ImageClip; offset: number }> = ({ clip, offset }) => (
  <Sequence from={clip.start - offset} durationInFrames={Math.max(1, clip.end - clip.start)}>
    <OverlayVideoInner clip={clip} />
  </Sequence>
);

// ── Image-overlay clip — animatable Img (CONTRACT §4 ShapeKeyframes) ──────────
// z: above the video background, below shapes/text. Same frame convention as Shape:
// useCurrentFrame() is segment-relative; `offset` rebases to the absolute axis, and
// keyframe frames are element-relative (rel = abs - clip.start).
const ImageClipLayer: React.FC<{ clip: ImageClip; offset: number }> = ({ clip, offset }) => {
  const abs = useCurrentFrame() + offset;
  if (abs < clip.start || abs >= clip.end) return null;
  const kf = clip.keyframes;
  const rel = abs - clip.start;
  const pos = hasTrack(kf?.position) ? samplePosition(kf!.position!, rel) : { x: clip.x, y: clip.y };
  const width = hasTrack(kf?.width) ? sampleScalar(kf!.width!, rel) : clip.width;
  const height = hasTrack(kf?.height) ? sampleScalar(kf!.height!, rel) : clip.height;
  const opacity = hasTrack(kf?.opacity) ? sampleScalar(kf!.opacity!, rel) : clip.opacity ?? 1;
  const rotation = hasTrack(kf?.rotation) ? sampleScalar(kf!.rotation!, rel) : clip.rotation ?? 0;
  const borderRadius = hasTrack(kf?.borderRadius) ? sampleScalar(kf!.borderRadius!, rel) : clip.borderRadius ?? 0;
  const blur = hasTrack(kf?.blur) ? sampleScalar(kf!.blur!, rel) : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${rotation}deg)`,
        opacity,
        borderRadius,
        overflow: "hidden",
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        willChange: "transform, opacity, filter",
      }}
    >
      {clip.src === "placeholder" ? (
        <AbsoluteFill style={{ backgroundColor: "#334155", border: "2px dashed #64748b" }} />
      ) : (
        <Img src={staticFile(clip.src)} style={{ width: "100%", height: "100%", objectFit: clip.fit ?? "cover" }} />
      )}
    </div>
  );
};

// ── Audio: per-clip <Audio> with fades + ducking ─────────────────────────────
// Union of all video clips' (already absolute) speechRegions = the ducking mask.
const unionSpeechRegions = (t: TimelineV3): AbsRegion[] => {
  const regions: AbsRegion[] = [];
  for (const clip of videoTrackOf(t)?.clips ?? []) {
    if (clip.kind === "video" && clip.speechRegions) {
      for (const r of clip.speechRegions) regions.push({ start: r.startFrame, end: r.endFrame });
    }
  }
  regions.sort((a, b) => a.start - b.start);
  const merged: AbsRegion[] = [];
  for (const r of regions) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
};

export const ReelsVideo: React.FC<{ timeline: TimelineV2 | TimelineV3; showGrid: boolean }> = ({
  timeline,
  showGrid,
}) => {
  const t = isV3(timeline) ? timeline : migrateV2toV3(timeline);
  const segments = buildSegments(t);
  const totalFrames = t.durationInFrames;
  const speech = unionSpeechRegions(t);
  const audioClips = audioTrackOf(t)?.clips ?? [];

  const children: React.ReactNode[] = [];
  segments.forEach((seg, i) => {
    children.push(
      <TransitionSeries.Sequence key={`seq-${seg.bg.id}`} durationInFrames={seg.durationInFrames}>
        <SegmentLayer seg={seg} frameWidth={t.width} frameHeight={t.height} />
      </TransitionSeries.Sequence>
    );
    const overlap = segOverlapAfter(segments, i);
    if (overlap > 0 && seg.transitionToNext) {
      const tr = seg.transitionToNext;
      children.push(
        <TransitionSeries.Transition
          key={`tr-${seg.bg.id}`}
          timing={timingFor(tr, overlap)}
          presentation={presentationFor(tr)}
        />
      );
    }
  });

  return (
    // Each segment paints its own background; the outer fill is a black backstop
    // behind transitions (matches the v2 engine).
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {audioClips.map((clip) => (
        <Sequence key={clip.id} from={clip.start} durationInFrames={Math.max(1, clip.end - clip.start)}>
          <Audio
            src={staticFile(clip.src)}
            startFrom={clip.startFrom}
            // <Audio> volume frame is Sequence-relative; ducking/fade math is
            // absolute → add clip.start back. For the migrated full-span clip
            // (start 0) this is a no-op, byte-identical to the v2 audio envelope.
            volume={(f) => musicVolumeAt(clip, totalFrames, speech, f + clip.start)}
          />
        </Sequence>
      ))}

      {children.length > 0 ? <TransitionSeries>{children}</TransitionSeries> : null}

      <Grid showGrid={showGrid} />
    </AbsoluteFill>
  );
};
