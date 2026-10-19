// Strict timeline schema — the frozen contract (see claude-code-CONTRACT.md).
// Everything that drives a render lives here; components hardcode nothing per-reel.

export type EnterFrom = "left" | "right" | "top" | "bottom" | "none";
export type TextCase = "upper" | "lower" | "none";
// Keys into FONT_MAP (src/fonts.ts). Add new keys here + in FONT_MAP together.
export type FontKey =
  | "condensedHeavy"
  | "cleanSans"
  | "unbounded"
  | "onest"
  | "playfairItalic"
  | "nikulinaCondensed"
  | "nikulinaSans";

// ===== Keyframes (CONTRACT §4 — the ONLY animation system) =====
// Keyframes are the sole driver of motion; there is no built-in entrance/exit.
// A word with no `keyframes` hard-appears at `start`, hard-disappears at `end`,
// fully opaque, at its static fields. Frames are WORD-RELATIVE (0 = word.start);
// sceneFrame = word.start + keyframe.frame — so retiming a clip never moves its
// keyframes and copy/paste is a plain array copy.

export type EasingPreset = "linear" | "easeIn" | "easeOut" | "easeInOut" | "hold";
/** How to interpolate FROM the previous kf INTO this one. Preset or a CSS-style
 *  cubic-bezier (control points x1,y1,x2,y2). "hold" = step/snap. Default linear. */
export type Easing = EasingPreset | { bezier: [number, number, number, number] };

export type Vec2 = { x: number; y: number };

/** One scalar/discrete/color keyframe. `frame` is word-relative. */
export type Keyframe<T> = {
  frame: number;
  value: T;
  /** Temporal easing into this kf from the previous one. Default "linear". */
  easing?: Easing;
};

/** Position keyframe: a 2D anchor plus optional spatial tangents for curved paths.
 *  Temporal (speed) easing and spatial (curve shape) are independent (AE-style). */
export type PositionKeyframe = {
  frame: number;        // word-relative
  value: Vec2;          // offset from frame center, px
  easing?: Easing;      // TEMPORAL easing into this kf
  spatialIn?: Vec2;     // tangent INTO this point (offset from value, px)
  spatialOut?: Vec2;    // tangent OUT of this point (offset from value, px)
};

/** Any subset of tracks. A present track overrides the static fallback for that
 *  property; an absent (or empty) track falls back to the static field. */
export type WordKeyframes = {
  position?: PositionKeyframe[];     // 2D path; fallback {word.x, word.y}
  size?: Keyframe<number>[];         // font size px; fallback word.size
  weight?: Keyframe<number>[];       // 100..900; smooth only w/ variable font; fallback word.weight
  fontFamily?: Keyframe<FontKey>[];  // discrete (step); fallback word.font
  letterSpacing?: Keyframe<number>[]; // px; fallback 0
  color?: Keyframe<string>[];        // hex, RGB-interpolated; fallback word.color
  opacity?: Keyframe<number>[];      // 0..1; fallback 1
  rotation?: Keyframe<number>[];     // degrees (may exceed 360); fallback 0
  blur?: Keyframe<number>[];         // px (CSS filter blur); fallback 0
  // Typewriter approximation (v2.6, CONTRACT §4 documented exception): fraction of
  // the word REVEALED from the left, 0 = hidden, 1 = fully shown. Rendered as a
  // left→right clip mask in Word.tsx — NOT a per-glyph split (true per-letter
  // typewriter is out of scope). Fallback 1 (no clipping); a word with no track is
  // unaffected. Ordinary scalar track → editable in the lanes/graph like any other.
  clipReveal?: Keyframe<number>[];   // 0..1 width fraction revealed L→R; fallback 1
};

/** The 9 animatable property keys (handy for iterating tracks). */
export type KeyframeProperty = keyof WordKeyframes;

export type CumulativeWordReveal = {
  /** Visible token including attached punctuation. Never emit punctuation-only tokens. */
  text: string;
  /** Absolute v3 timeline frame at which this token begins its restrained fade-in. */
  revealFrame: number;
};

export type WordRevealTimingType =
  | "SOURCE_WORD_TIMESTAMPS"
  | "DERIVED_VISUAL_REVEAL";

export type Word = {
  /** Text to show. May be a full phrase ("не требует") — slides in as one block. */
  text: string;
  /** Frame (relative to its scene) when the word appears. */
  start: number;
  /** Frame (relative to its scene) when the word disappears. v1: hard cut, no fade-out. */
  end: number;
  /** Offset in px of the word's CENTER from frame center. (0,0) = center. */
  x: number;
  y: number;
  /** Key into FONT_MAP. */
  font: FontKey;
  /** Font size in px. */
  size: number;
  /** Font weight (numeric): 400 | 700 | 800. */
  weight: number;
  /** CSS hex color, e.g. "#ffffff" / "#c0182a". */
  color: string;
  /** Slide-in direction. EDITOR HINT ONLY — the engine ignores it; it is used to
   *  seed the slide-in preset when a legacy/ASR timeline is imported. */
  enterFrom: EnterFrom;
  /** Optional letter-casing transform. Default: none. */
  case?: TextCase;
  /** Optional outline stroke around the glyphs. Painted UNDER the fill
   *  (paint-order: "stroke fill") so a thick stroke never thins the fill. Absent =
   *  no stroke. STATIC only (no WordKeyframes track). */
  stroke?: { color: string; width: number };
  /** Optional text-shadow LIST → CSS `text-shadow` (comma-joined, in order). Covers
   *  a dark depth shadow for legibility over video AND a colored glow on accents
   *  (multiple entries). x/y default 0 (pure glow). Absent = no shadow. STATIC only. */
  shadow?: Array<{ x?: number; y?: number; blur: number; color: string }>;
  /** Per-property animation tracks. Absent = fully static hard-cut (no animation). */
  keyframes?: WordKeyframes;
  /** Additive v3 subtitle capability. Absent preserves the legacy eager renderer. */
  revealMode?: "cumulative-word";
  /** Tokens always occupy their FINAL inline layout; only token opacity changes. */
  wordReveals?: CumulativeWordReveal[];
  /** Restrained token fade duration. Nikulina default: 3 frames. */
  revealFadeFrames?: number;
  /** Provenance contract: source-acoustic or derived visual timing. */
  timingType?: WordRevealTimingType;
  /** Must be true for translated display words timed inside a source phrase group. */
  notAcousticWordAlignment?: boolean;
  /** Lets validators distinguish spoken text from editorial framing copy. */
  subtitleRole?: "speech" | "editorial";
  /** Nikulina 2026 series foundation: measured full-line geometry is frozen before reveal. */
  layoutSystem?: "WIDTH_AWARE_FIXED_SUBTITLE_LAYOUT";
  layoutGroupId?: string;
  layoutLineIndex?: number;
  layoutLineCount?: number;
  layoutBounds?: { left: number; right: number; top: number; bottom: number };
  layoutSafeBounds?: { left: number; right: number; top: number; bottom: number };
  fixedFinalLayout?: boolean;
  horizontalReflow?: boolean;
  verticalReflow?: boolean;
  finalWordPositions?: Array<{ text: string; x: number; y: number; left: number; right: number }>;
};

/** Scene-relative interval (frames) where the inset's voice is talking.
 *  Produced by ASR (merged word intervals), drives music ducking. FROZEN — it is
 *  NOT the editable subtitle timings, and the editor MUST NOT alter it. */
export type SpeechRegion = {
  startFrame: number;
  endFrame: number;
};

/** LEGACY (v2.1) centered video inset. No longer part of Scene — kept ONLY so the
 *  migration (presets.ts) can type a legacy `scene.video` it converts into a
 *  `background:{type:'box'}`. New content must not produce this. */
export type VideoInset = {
  /** Path to an mp4 (relative to public/) OR the literal "placeholder" → draws a rectangle. */
  src: string;
  /** Offset in px of the inset's CENTER from frame center. */
  x: number;
  y: number;
  /** Box size in px. */
  width: number;
  height: number;
  /** Corner rounding in px. */
  borderRadius: number;
  /** Frame of the source clip to start playing from. */
  startFrom: number;
  /** Inset audio level 0..1. Default 1. */
  volume?: number;
  /** Mute the inset audio. Default false. */
  muted?: boolean;
  /** ASR speech intervals (scene-relative), FROZEN — drives ducking. */
  speechRegions?: SpeechRegion[];
};

// ===== Background layer (per scene) — CONTRACT §4 discriminated union ============
// Each scene carries its OWN background, rendered BELOW shapes and words. Four
// variants. For image/cover/box, `src === "placeholder"` draws a stub rectangle
// (the render never fails on a missing file — CONTRACT §6).
export type BackgroundFit = "cover" | "contain";

/** Solid fill. Default for text-only scenes. */
export type ColorBackground = { type: "color"; color: string };

/** Static image filling the frame (object-fit, default cover). */
export type ImageBackground = { type: "image"; src: string; fit?: BackgroundFit };

/** Fullscreen 1080×1920 video — the default when a clip is loaded (zero placement). */
export type CoverBackground = {
  type: "cover";
  src: string;
  /** Frame of the source clip to start playing from. */
  startFrom?: number;
  /** Audio level 0..1. Default 1. */
  volume?: number;
  /** Mute the audio. Default false. */
  muted?: boolean;
  /** ASR speech intervals (scene-relative), FROZEN — drives ducking. */
  speechRegions?: SpeechRegion[];
};

/** A video placed as a positioned/resizable box over a solid `backColor` fill
 *  (the old inset case — manual position + free resize + snapping). */
export type BoxBackground = {
  type: "box";
  src: string;
  /** Offset in px of the box CENTER from frame center. */
  x: number;
  y: number;
  /** Box size in px. */
  width: number;
  height: number;
  /** Corner rounding in px. */
  borderRadius: number;
  fit?: BackgroundFit;
  startFrom?: number;
  volume?: number;
  muted?: boolean;
  /** Solid fill drawn around the box (the frame background behind it). */
  backColor: string;
  /** ASR speech intervals (scene-relative), FROZEN — drives ducking. */
  speechRegions?: SpeechRegion[];
};

export type Background =
  | ColorBackground
  | ImageBackground
  | CoverBackground
  | BoxBackground;

export type BackgroundType = Background["type"];

// ===== Shape layer (foreground, BELOW words / ABOVE background) — CONTRACT §4 ====
// Another foreground layer with the SAME coords (§2), start/end (like words), and
// keyframe system (sampled via the shared keyframes.ts). Rendered below text.
export type ShapeType = "rect" | "ellipse" | "line";

export type ShapeKeyframes = {
  position?: PositionKeyframe[];     // 2D path; fallback {shape.x, shape.y}
  width?: Keyframe<number>[];        // fallback shape.width
  height?: Keyframe<number>[];       // fallback shape.height (line: thickness)
  color?: Keyframe<string>[];        // hex, RGB-interpolated; fallback shape.color
  opacity?: Keyframe<number>[];      // 0..1; fallback shape.opacity ?? 1
  rotation?: Keyframe<number>[];     // degrees; fallback shape.rotation ?? 0
  borderRadius?: Keyframe<number>[]; // px; fallback shape.borderRadius ?? 0
  blur?: Keyframe<number>[];         // px; fallback 0
};

/** The animatable shape property keys (handy for iterating tracks). */
export type ShapeKeyframeProperty = keyof ShapeKeyframes;

export type Shape = {
  id: string;
  shape: ShapeType;
  /** Frame (scene-relative) when the shape appears / disappears. */
  start: number;
  end: number;
  /** Offset in px of the shape's CENTER from frame center. */
  x: number;
  y: number;
  /** Size in px. For `line`: width = length, height = thickness. */
  width: number;
  height: number;
  /** Fill (stroke color for `line`). CSS hex. */
  color: string;
  /** rect → rounded plate. */
  borderRadius?: number;
  /** Optional outline. */
  stroke?: { color: string; width: number };
  /** Static fallbacks. */
  opacity?: number;
  rotation?: number;
  /** Per-property animation tracks (sampled via keyframes.ts). */
  keyframes?: ShapeKeyframes;
};

/** A foreground image laid OVER the scene's video (a collage band, a logo…).
 *  Scene-relative start/end (like words/shapes). On migration EACH overlay becomes
 *  an ImageClip on its OWN image track, so simultaneous overlays z-stack in ADD
 *  order (last added = on top). z: above the video, below shapes/words. */
export type Overlay = {
  src: string;                 // path under public/, e.g. "media/Frame_1.png"
  start: number;               // scene-relative appear frame
  end: number;                 // scene-relative disappear frame
  x: number;                   // center offset from frame center (px) — CONTRACT §2
  y: number;
  width: number;               // px
  height: number;
  fit?: BackgroundFit;         // default "cover"
  borderRadius?: number;
  opacity?: number;
  rotation?: number;
  keyframes?: ShapeKeyframes;  // optional; animatable like a shape / ImageClip
};

// CONTRACT §4 extension (v2.0, additive + backward-compatible).
// Transition TO THE NEXT scene. Absent → hard cut (as v1). Old timeline.json
// files without it keep working unchanged.
export type TransitionType = "fade" | "slide" | "wipe" | "none";
export type TransitionDir =
  | "from-left"
  | "from-right"
  | "from-top"
  | "from-bottom";

export type SceneTransition = {
  type: TransitionType;
  /** Transition duration = OVERLAP: frames consumed from the end of this scene
   *  AND the start of the next (they blend simultaneously). */
  durationInFrames: number;
  /** For slide/wipe. Ignored for fade/none. */
  direction?: TransitionDir;
  /** Easing of the transition timing. Default "linear". */
  timing?: "linear" | "spring";
};

export type Scene = {
  id: string;
  /** Length of the scene in frames. */
  durationInFrames: number;
  /** Per-scene background layer (color / image / video-cover / video-box).
   *  Replaces the v2.1 `video` inset + the old top-level Timeline.background. */
  background: Background;
  /** Foreground shapes, rendered BELOW words and ABOVE the background. Default []. */
  shapes?: Shape[];
  words: Word[];
  /** Foreground image overlays over the video. Each migrates to its OWN image
   *  track (simultaneous overlays z-stack in array order). Default []. */
  overlays?: Overlay[];
  /** Transition between this scene and the next; ignored on the last scene.
   *  Absent → hard cut. */
  transitionToNext?: SceneTransition;
};

/** Music ducking config — lower the music while inset speech is present. */
export type Ducking = {
  enabled: boolean;
  /** Level (0..1) while speech is present, e.g. 0.15. */
  duckedVolume: number;
  /** Ramp-down frames when speech starts. */
  attackFrames: number;
  /** Ramp-up frames when speech ends. */
  releaseFrames: number;
};

/** The music track laid over the whole video. */
export type AudioTrack = {
  /** Path (relative to public/) to the music file. */
  src: string;
  /** Base level 0..1. */
  volume: number;
  /** Ramp 0 → volume at track start. */
  fadeInFrames?: number;
  /** Ramp volume → 0 at track end. */
  fadeOutFrames?: number;
  /** Optional speech-driven ducking. */
  ducking?: Ducking;
};

export type Timeline = {
  fps: number;
  width: number;
  height: number;
  /** Music track over the whole reel, or null. (v1 used a bare string path —
   *  the engine still accepts that and treats it as { src, volume: 1 }.)
   *  NOTE (v2.2): the old top-level `background` is REMOVED — each scene now
   *  carries its own `background`. */
  audio: AudioTrack | null;
  scenes: Scene[];
};

/** Top-level composition inputProps: timeline + dev-aid grid toggle (kept separate). */
export type ReelsProps = {
  timeline: Timeline;
  /** Show coordinate grid in Studio. Always hidden during render. */
  showGrid: boolean;
};
