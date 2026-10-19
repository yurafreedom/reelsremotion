// CONTRACT v3 schema — sequential tracks on an ABSOLUTE timeline.
//
// This REPLACES the scene model (src/types.ts `Timeline.scenes[]`) with
// `Timeline.tracks[]`. All clip/element start/end are ABSOLUTE timeline frames
// (from the start of the whole reel). Keyframe frames stay ELEMENT-relative
// (0 = element.start) — unchanged from v2, which is why `Word`/`Shape`/keyframe
// types are reused verbatim from ./types: only the timing SEMANTICS change.
//
// v2 (scenes) → v3 (tracks) is performed by src/migrateV3.ts (idempotent). The
// engine (Video.tsx/Root.tsx) renders this v3 model; old v2 props are migrated
// on load so they keep working.

import type {
  BackgroundFit,
  Ducking,
  ShapeKeyframes,
  SpeechRegion,
  TransitionType,
  TransitionDir,
  Word,
  Shape,
} from "./types";

// Re-export the element types unchanged — in v3 their start/end are ABSOLUTE.
export type { Word, Shape } from "./types";

/** Internal, NON-serialized grouping hint written by migrateV2toV3 onto migrated
 *  words/shapes so the segment-composite renderer can reproduce v2's exact
 *  per-scene compositing — even when an element starts inside a transition
 *  overlap (where absolute coordinates alone are ambiguous). NOT part of the
 *  on-disk CONTRACT; the future v3 serializer MUST strip `_scene`. */
export type SceneTagged<T> = T & { _scene?: number };

/** Video/image fit. `cover` = fullscreen; `contain` = centered box over a fill. */
export type Fit = BackgroundFit; // 'cover' | 'contain'

/** A transition lives on a clip as `transitionToNext` = the blend at the JOIN with
 *  the next clip on the SAME track (an overlap). Identical shape to v2
 *  `SceneTransition`, renamed per CONTRACT v3. */
export type ClipTransition = {
  type: TransitionType;
  /** OVERLAP: frames consumed from the end of this clip AND the start of the next. */
  durationInFrames: number;
  direction?: TransitionDir;
  timing?: "linear" | "spring";
};

// ===== Visual clips =========================================================
// Video track holds video | color; image tracks hold image.

export type VideoClip = {
  id: string;
  kind: "video";
  /** Path relative to public/, or "placeholder" → stub rectangle (never fails). */
  src: string;
  /** ABSOLUTE placement on the track. */
  start: number;
  end: number;
  /** Source in-point: which source frame plays at clip start (set by TRIM). */
  startFrom: number;
  /** 'cover' = fullscreen; 'contain' = centered box over `backColor`. */
  fit: Fit;
  /** Letterbox/background fill when `fit:'contain'` (the box-over-color look). */
  backColor?: string;
  volume?: number;
  muted?: boolean;
  speechRegions?: SpeechRegion[];
  transitionToNext?: ClipTransition;

  // ── v3.0 ADDITIVE EXTENSION (optional, back-compatible) ──────────────────
  // Preserve the v2 inset-box geometry losslessly when migrating a
  // BoxBackground (fit:'contain'). When any of these is present the renderer
  // draws the video as a positioned/sized/rounded box over `backColor` (exact
  // v2 BoxLayer look) instead of a full-frame letterbox. Absent → plain
  // `objectFit:contain` full-frame. CONTRACT v3 base shape is unchanged.
  /** Offset in px of the box CENTER from frame center. */
  x?: number;
  y?: number;
  /** Box size in px. */
  width?: number;
  height?: number;
  /** Corner rounding in px. */
  borderRadius?: number;
  /** Optional same-source vertical-fill treatment for landscape footage. */
  backgroundBlur?: number;
  backgroundBrightness?: number;
  backgroundSaturation?: number;
  backgroundScale?: number;
};

export type ColorClip = {
  id: string;
  kind: "color";
  color: string;
  /** ABSOLUTE placement. */
  start: number;
  end: number;
  transitionToNext?: ClipTransition;
};

export type ImageClip = {
  id: string;
  kind: "image";
  src: string;
  /** ABSOLUTE placement. */
  start: number;
  end: number;
  /** Offset in px of the image CENTER from frame center; size in px. */
  x: number;
  y: number;
  width: number;
  height: number;
  fit?: Fit;
  borderRadius?: number;
  opacity?: number;
  rotation?: number;
  /** Source in-point when this image-track carrier is a video overlay. */
  startFrom?: number;
  /** Animatable like a shape (sampled via keyframes.ts; frames element-relative). */
  keyframes?: ShapeKeyframes;

  // ── v3.0 ADDITIVE EXTENSION (optional, back-compatible) ──────────────────
  // CONTRACT v3 ImageClip has no transitionToNext; we add it so an image-bg
  // scene that had a `transitionToNext` migrates losslessly. Absent → none.
  transitionToNext?: ClipTransition;
};

// ===== Audio clip ===========================================================

export type AudioClip = {
  id: string;
  src: string;
  /** ABSOLUTE placement. */
  start: number;
  end: number;
  /** Source in-point (TRIM). */
  startFrom: number;
  volume: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  ducking?: Ducking;
};

// ===== Tracks (discriminated by kind) =======================================
// z-order bottom→top: video → image(s) → shape → text. Audio has no z.

export type VideoTrack = { id: string; kind: "video"; clips: (VideoClip | ColorClip)[] };
export type ImageTrack = { id: string; kind: "image"; clips: ImageClip[] };
export type ShapeTrack = { id: string; kind: "shape"; shapes: Shape[] };
export type TextTrack = { id: string; kind: "text"; words: Word[] };
export type AudioTrackV3 = { id: string; kind: "audio"; clips: AudioClip[] };

export type Track = VideoTrack | ImageTrack | ShapeTrack | TextTrack | AudioTrackV3;
export type TrackKind = Track["kind"];

export type TimelineV3 = {
  fps: number;
  width: number;
  height: number;
  /** Total = max clip `end` across tracks (Σ scene durations − Σ overlaps). */
  durationInFrames: number;
  /** Optional measured subtitle foundation metadata; additive and render-neutral. */
  subtitleLayout?: {
    system: "WIDTH_AWARE_FIXED_SUBTITLE_LAYOUT";
    maxLines: number;
    minimumFontSize: number;
    internalMargin: number;
    safeBounds: { left: number; right: number; top: number; bottom: number };
    groups: unknown[];
  };
  tracks: Track[];
};

/** Top-level composition inputProps for the v3 engine. */
export type ReelsPropsV3 = {
  timeline: TimelineV3;
  showGrid: boolean;
};

// ===== Type guards / track accessors (shared by engine + migration) =========

export const isV3 = (t: unknown): t is TimelineV3 =>
  !!t && Array.isArray((t as TimelineV3).tracks);

export const videoTrackOf = (t: TimelineV3): VideoTrack | undefined =>
  t.tracks.find((tr): tr is VideoTrack => tr.kind === "video");
export const imageTracksOf = (t: TimelineV3): ImageTrack[] =>
  t.tracks.filter((tr): tr is ImageTrack => tr.kind === "image");
export const shapeTrackOf = (t: TimelineV3): ShapeTrack | undefined =>
  t.tracks.find((tr): tr is ShapeTrack => tr.kind === "shape");
export const textTrackOf = (t: TimelineV3): TextTrack | undefined =>
  t.tracks.find((tr): tr is TextTrack => tr.kind === "text");
export const audioTrackOf = (t: TimelineV3): AudioTrackV3 | undefined =>
  t.tracks.find((tr): tr is AudioTrackV3 => tr.kind === "audio");
