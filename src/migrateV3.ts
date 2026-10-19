// v2.2 SCENE timeline → v3 TRACK timeline (CONTRACT v3). Pure + idempotent.
//
// This is the highest-risk seam: a migrated legacy file MUST render
// pixel-identical (SSIM ≈ 1) to its pre-migration render. The invariants that
// guarantee that (see migrateV3.check.ts):
//   • Offsets are computed ONCE via sceneOffsets() — never recomputed ad hoc.
//   • Background clips span the scene's FULL [off, off+dur]; the transition
//     overlap is consumed by the renderer's <TransitionSeries>, NOT subtracted
//     here (mirrors v2 where the Sequence is the full durationInFrames).
//   • Keyframes are copied by reference and NEVER touched (element-relative;
//     shifting `start` already moves them on the global axis).
//   • speechRegions are re-based to absolute EXACTLY ONCE (+off here; the
//     renderer reads them verbatim and only merges).
//   • Word/shape array ORDER is preserved (v2 paints by array index).
//   • Each migrated word/shape carries an internal `_scene` tag so the renderer
//     reproduces v2's per-scene composite grouping unambiguously.

import type {
  Background,
  Scene,
  SpeechRegion,
  Timeline as TimelineV2,
} from "./types";
import { normalizeAudio, sceneOffsets, totalDurationInFrames } from "./compose";
import type {
  AudioClip,
  ColorClip,
  ImageClip,
  SceneTagged,
  Shape,
  TimelineV3,
  Track,
  VideoClip,
  Word,
} from "./types.v3";
import { isV3 } from "./types.v3";

/** Re-base scene-relative speech regions to ABSOLUTE by adding the scene offset.
 *  Applied exactly once, here, with the same `off` used for the clip placement. */
const absRegions = (
  regions: SpeechRegion[] | undefined,
  off: number
): SpeechRegion[] | undefined =>
  regions?.map((r) => ({ startFrame: off + r.startFrame, endFrame: off + r.endFrame }));

/** Drop `undefined`-valued keys so the migrated object stays clean (and so the
 *  structure check / future round-trip doesn't see noisy optional fields). */
const compact = <T extends Record<string, unknown>>(o: T): T => {
  const out = {} as T;
  for (const k in o) if (o[k] !== undefined) out[k] = o[k];
  return out;
};

/** Build the single background clip for a scene from its Background variant.
 *  Returns either a video-track clip (video|color) or an image-track clip. */
const backgroundToClip = (
  bg: Background,
  id: string,
  start: number,
  end: number,
  off: number,
  frameWidth: number,
  frameHeight: number,
  transitionToNext: Scene["transitionToNext"]
): { video?: VideoClip | ColorClip; image?: ImageClip } => {
  const tr = transitionToNext;
  switch (bg.type) {
    case "color":
      return {
        video: compact<ColorClip>({
          id,
          kind: "color",
          color: bg.color,
          start,
          end,
          transitionToNext: tr,
        }),
      };
    case "cover":
      return {
        video: compact<VideoClip>({
          id,
          kind: "video",
          src: bg.src,
          start,
          end,
          startFrom: bg.startFrom ?? 0,
          fit: "cover",
          volume: bg.volume,
          muted: bg.muted,
          speechRegions: absRegions(bg.speechRegions, off),
          transitionToNext: tr,
        }),
      };
    case "box":
      // Lossless: carry the inset geometry via the v3.0 additive VideoClip box
      // fields so the renderer draws the exact v2 BoxLayer (position/size/radius
      // over backColor), not a flat full-frame contain.
      return {
        video: compact<VideoClip>({
          id,
          kind: "video",
          src: bg.src,
          start,
          end,
          startFrom: bg.startFrom ?? 0,
          fit: "contain",
          backColor: bg.backColor,
          x: bg.x,
          y: bg.y,
          width: bg.width,
          height: bg.height,
          borderRadius: bg.borderRadius,
          volume: bg.volume,
          muted: bg.muted,
          speechRegions: absRegions(bg.speechRegions, off),
          transitionToNext: tr,
        }),
      };
    case "image":
      // Full-frame background image on the image track. transitionToNext via the
      // v3.0 additive ImageClip field (lossless).
      return {
        image: compact<ImageClip>({
          id,
          kind: "image",
          src: bg.src,
          start,
          end,
          x: 0,
          y: 0,
          width: frameWidth,
          height: frameHeight,
          fit: bg.fit ?? "cover",
          transitionToNext: tr,
        }),
      };
    default:
      // Defensive: unknown bg → black color clip.
      return {
        video: compact<ColorClip>({
          id,
          kind: "color",
          color: "#000000",
          start,
          end,
          transitionToNext: tr,
        }),
      };
  }
};

/** Migrate a v2.2 scene timeline to the v3 track model. Idempotent: a v3 input
 *  (has `tracks`) is returned unchanged. */
export function migrateV2toV3(input: TimelineV2 | TimelineV3): TimelineV3 {
  if (isV3(input)) return input;
  const v2 = input as TimelineV2;

  // Compute the absolute frame grid ONCE — the single source of offset truth.
  const offsets = sceneOffsets(v2);
  const durationInFrames = totalDurationInFrames(v2);

  const videoClips: (VideoClip | ColorClip)[] = [];
  const imageClips: ImageClip[] = [];
  const overlayTracks: Track[] = [];
  const shapes: SceneTagged<Shape>[] = [];
  const words: SceneTagged<Word>[] = [];

  v2.scenes.forEach((scene, i) => {
    const off = offsets[i];

    // Words → text track (absolute start/end; keyframes UNTOUCHED; order kept).
    for (const w of scene.words) {
      words.push({ ...w, start: off + w.start, end: off + w.end, _scene: i });
    }

    // Shapes → shape track (absolute; keyframes untouched; order kept).
    for (const s of scene.shapes ?? []) {
      shapes.push({ ...s, start: off + s.start, end: off + s.end, _scene: i });
    }

    // Background → exactly one clip spanning the scene's FULL range.
    const { video, image } = backgroundToClip(
      scene.background,
      `${scene.id}-bg`,
      off,
      off + scene.durationInFrames,
      off,
      v2.width,
      v2.height,
      scene.transitionToNext
    );
    if (video) videoClips.push(video);
    if (image) imageClips.push(image);

    // Overlays → one image track EACH (absolute timing; keyframes copied by ref).
    (scene.overlays ?? []).forEach((ov, k) => {
      const ovId = `${scene.id}-ov${k}`;
      overlayTracks.push({
        id: ovId,
        kind: "image",
        clips: [
          compact<ImageClip>({
            id: ovId,
            kind: "image",
            src: ov.src,
            start: off + ov.start,
            end: off + ov.end,
            x: ov.x,
            y: ov.y,
            width: ov.width,
            height: ov.height,
            fit: ov.fit ?? "cover",
            borderRadius: ov.borderRadius,
            opacity: ov.opacity,
            rotation: ov.rotation,
            keyframes: ov.keyframes,
          }),
        ],
      });
    });
  });

  // Audio → single AudioClip spanning the whole reel (fades/ducking preserved).
  const at = normalizeAudio(v2.audio);
  const audioClips: AudioClip[] = at
    ? [
        compact<AudioClip>({
          id: "music",
          src: at.src,
          start: 0,
          end: durationInFrames,
          startFrom: 0,
          volume: at.volume,
          fadeInFrames: at.fadeInFrames,
          fadeOutFrames: at.fadeOutFrames,
          ducking: at.ducking,
        }),
      ]
    : [];

  // Assemble tracks in z-order: video → image → shape → text → audio.
  const tracks: Track[] = [];
  if (videoClips.length) tracks.push({ id: "video", kind: "video", clips: videoClips });
  if (imageClips.length) tracks.push({ id: "image", kind: "image", clips: imageClips }); // bg images
  for (const ot of overlayTracks) tracks.push(ot);                                        // overlays — own track each
  if (shapes.length) tracks.push({ id: "shape", kind: "shape", shapes });
  if (words.length) tracks.push({ id: "text", kind: "text", words });
  if (audioClips.length) tracks.push({ id: "audio", kind: "audio", clips: audioClips });

  return { fps: v2.fps, width: v2.width, height: v2.height, durationInFrames, tracks };
}
