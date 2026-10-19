// Keyframe PRESETS (CONTRACT §4) — pure generators that turn a semantic intent
// (slide-in, fade, scale-in, pulse, spin, fade-out) into concrete keyframe tracks.
// Presets are authoring sugar, NOT a separate render path: they emit the same
// `WordKeyframes` the engine samples, fully editable afterward.
//
// The slide-in preset is ALSO what a legacy/ASR `enterFrom` expands to on import
// (migrateTimeline below), so old static content keeps animating under the new
// keyframes-only engine.
//
// Pure + dependency-light (only `import type`) → node-assert testable.

import type {
  Background,
  EnterFrom,
  Scene,
  Timeline,
  Vec2,
  VideoInset,
  Word,
  WordKeyframes,
} from "./types";

/** Frames a default entrance/exit takes. */
export const ENTER_FRAMES = 12;
/** How far (px) a slide-in starts off its target. */
export const ENTER_OFFSET = 80;
/** Default frames a typewriter clip-reveal sweeps over. */
export const TYPE_FRAMES = 18;
/** The red attention accent (CONTRACT §6). */
export const RED = "#c0182a";
/** Bordo (deep burgundy) accent — alternative punch color for text highlights. */
export const BORDO = "#8B1E2D";

/** Static base values a preset needs (taken from the word's static fields). */
export type PresetContext = {
  x: number;
  y: number;
  size: number;
  /** Word length in frames (end - start) — for exit/emphasis timing. */
  len: number;
};

export const ctxOf = (w: Word): PresetContext => ({
  x: w.x,
  y: w.y,
  size: w.size,
  len: Math.max(1, w.end - w.start),
});

const enterDelta = (dir: EnterFrom): Vec2 => {
  switch (dir) {
    case "left":
      return { x: -ENTER_OFFSET, y: 0 };
    case "right":
      return { x: ENTER_OFFSET, y: 0 };
    case "top":
      return { x: 0, y: -ENTER_OFFSET };
    case "bottom":
      return { x: 0, y: ENTER_OFFSET };
    default:
      return { x: 0, y: 0 };
  }
};

export type PresetId =
  | "slideIn"
  | "fadeIn"
  | "fadeOut"
  | "scaleIn"
  | "revealFromCenter"
  | "typewriter"
  | "pop"
  | "punchRed"
  | "pulse"
  | "spin";

/** Slide-in from a direction + fade. `none` → fade only (no position track).
 *  `frames` overrides the default entrance duration. */
export const slideInPreset = (
  dir: EnterFrom,
  ctx: PresetContext,
  frames: number = ENTER_FRAMES
): WordKeyframes => {
  const dur = Math.max(1, Math.round(frames));
  const kf: WordKeyframes = {
    opacity: [
      { frame: 0, value: 0 },
      { frame: dur, value: 1, easing: "easeOut" },
    ],
  };
  const d = enterDelta(dir);
  if (d.x !== 0 || d.y !== 0) {
    kf.position = [
      { frame: 0, value: { x: ctx.x + d.x, y: ctx.y + d.y } },
      { frame: dur, value: { x: ctx.x, y: ctx.y }, easing: "easeOut" },
    ];
  }
  return kf;
};

export const fadeInPreset = (frames: number = ENTER_FRAMES): WordKeyframes => ({
  opacity: [
    { frame: 0, value: 0 },
    { frame: Math.max(1, Math.round(frames)), value: 1, easing: "easeOut" },
  ],
});

export const fadeOutPreset = (
  ctx: PresetContext,
  frames: number = ENTER_FRAMES
): WordKeyframes => {
  const dur = Math.max(1, Math.round(frames));
  return {
    opacity: [
      { frame: Math.max(0, ctx.len - dur), value: 1 },
      { frame: ctx.len, value: 0, easing: "easeIn" },
    ],
  };
};

/** Scale up from small + fade. `frames` overrides the default duration. */
export const scaleInPreset = (
  ctx: PresetContext,
  frames: number = ENTER_FRAMES
): WordKeyframes => {
  const dur = Math.max(1, Math.round(frames));
  return {
    size: [
      { frame: 0, value: Math.max(1, Math.round(ctx.size * 0.4)) },
      { frame: dur, value: ctx.size, easing: "easeOut" },
    ],
    opacity: [
      { frame: 0, value: 0 },
      { frame: dur, value: 1, easing: "easeOut" },
    ],
  };
};

/** "Появление из центра" — scale up from small + fade, centered (the element's
 *  position is unchanged, so it grows in place around its center). Same shape as
 *  scaleIn; named separately for the editor's Reveal-from-center button. */
export const revealFromCenterPreset = (
  ctx: PresetContext,
  frames: number = ENTER_FRAMES
): WordKeyframes => scaleInPreset(ctx, frames);

/** Typewriter (CONTRACT §4 exception): sweep the clip-reveal 0→1 left→right over
 *  `frames`, so the word is "typed in". NOT a per-glyph split — a width/clip mask
 *  (see Word.tsx). Linear by default to keep an even typing cadence. */
export const typewriterPreset = (frames: number = TYPE_FRAMES): WordKeyframes => ({
  clipReveal: [
    { frame: 0, value: 0 },
    { frame: Math.max(1, Math.round(frames)), value: 1, easing: "linear" },
  ],
});

/** Snappy scale-in overshoot then settle (a "pop / bounce"). No recolor. Mirrors
 *  the compose `emphasize('pop')` recipe. */
export const popPreset = (ctx: PresetContext): WordKeyframes => ({
  size: [
    { frame: 0, value: Math.max(1, Math.round(ctx.size * 0.5)) },
    { frame: 7, value: Math.round(ctx.size * 1.12), easing: "easeOut" },
    { frame: 12, value: ctx.size, easing: "easeInOut" },
  ],
  opacity: [
    { frame: 0, value: 0 },
    { frame: 7, value: 1, easing: "easeOut" },
  ],
});

/** Punch (red): drop-in scale punch + recolor to the red accent, settling to base
 *  size and the original color held until the recolor lands. Mirrors the compose
 *  `emphasize('punch-red')` recipe — the attention-grabbing accent. */
export const punchRedPreset = (ctx: PresetContext, baseColor: string): WordKeyframes => ({
  size: [
    { frame: 0, value: Math.max(1, Math.round(ctx.size * 0.6)) },
    { frame: 8, value: Math.round(ctx.size * 1.18), easing: "easeOut" },
    { frame: 16, value: ctx.size, easing: "easeIn" },
  ],
  opacity: [
    { frame: 0, value: 0 },
    { frame: 8, value: 1, easing: "easeOut" },
  ],
  color: [
    { frame: 2, value: baseColor },
    { frame: 8, value: RED, easing: "easeOut" },
  ],
});

/** Emphasis pulse: a quick size bump back to base, centered ~1/3 into the clip. */
export const pulsePreset = (ctx: PresetContext): WordKeyframes => {
  const c = Math.max(2, Math.round(ctx.len / 3));
  return {
    size: [
      { frame: Math.max(0, c - 4), value: ctx.size },
      { frame: c, value: Math.round(ctx.size * 1.25), easing: "easeOut" },
      { frame: c + 4, value: ctx.size, easing: "easeIn" },
    ],
  };
};

/** A full 360° spin over the entrance window. */
export const spinPreset = (): WordKeyframes => ({
  rotation: [
    { frame: 0, value: 0 },
    { frame: ENTER_FRAMES, value: 360, easing: "easeInOut" },
  ],
});

/** Generate a preset's tracks for a word. */
export const buildPreset = (id: PresetId, w: Word): WordKeyframes => {
  const ctx = ctxOf(w);
  switch (id) {
    case "slideIn":
      return slideInPreset(w.enterFrom, ctx);
    case "fadeIn":
      return fadeInPreset();
    case "fadeOut":
      return fadeOutPreset(ctx);
    case "scaleIn":
      return scaleInPreset(ctx);
    case "revealFromCenter":
      return revealFromCenterPreset(ctx);
    case "typewriter":
      return typewriterPreset();
    case "pop":
      return popPreset(ctx);
    case "punchRed":
      return punchRedPreset(ctx, w.color);
    case "pulse":
      return pulsePreset(ctx);
    case "spin":
      return spinPreset();
  }
};

// ----- Import migration (CONTRACT §7 / build step 5) --------------------------
// On import, expand each legacy/ASR word's `enterFrom` into position + opacity
// keyframes (the slide-in preset; `none` → fade-in), so old content still
// animates. Words that ALREADY carry keyframes are left untouched (idempotent —
// re-importing a migrated/edited timeline does not double-animate). `enterFrom`
// is preserved as a hint.

export const migrateWord = (w: Word): Word => {
  if (w.keyframes) return w; // already authored — keep verbatim
  const ctx = ctxOf(w);
  const kf = w.enterFrom === "none" ? fadeInPreset() : slideInPreset(w.enterFrom, ctx);
  return { ...w, keyframes: kf };
};

// ----- Background / inset migration (v2.2, CONTRACT §7) -----------------------
// The v2.2 schema replaced the old top-level `Timeline.background` (hex) and the
// per-scene `scene.video` inset with a per-scene `background` discriminated union.
// On import we convert legacy shapes WITHOUT data loss; already-migrated scenes
// (a `background` object present) are left untouched (idempotent).
//
//   legacy Timeline.background (hex) → each scene background:{type:'color', color}
//   legacy scene.video inset          → background:{type:'box', ..., backColor: hex}
//   legacy scene.video === null       → background:{type:'color', color: hex}

/** A legacy-or-new scene as it may appear in an imported JSON file. */
type LegacyScene = Omit<Scene, "background"> & {
  background?: Background;
  video?: VideoInset | null;
};

const insetToBox = (v: VideoInset, backColor: string): Background => {
  const bg: Background = {
    type: "box",
    src: v.src ?? "placeholder",
    x: v.x,
    y: v.y,
    width: v.width,
    height: v.height,
    borderRadius: v.borderRadius ?? 0,
    backColor,
  };
  if (v.startFrom !== undefined && v.startFrom !== null) bg.startFrom = v.startFrom;
  if (v.volume !== undefined && v.volume !== null) bg.volume = v.volume;
  if (v.muted !== undefined && v.muted !== null) bg.muted = v.muted;
  if (Array.isArray(v.speechRegions)) bg.speechRegions = v.speechRegions;
  return bg;
};

/** Resolve a scene's background, migrating a legacy inset/null when needed. */
export const migrateBackground = (
  scene: LegacyScene,
  legacyTimelineBg: string
): Background => {
  if (scene.background) return scene.background; // already new model — keep verbatim
  if (scene.video) return insetToBox(scene.video, legacyTimelineBg);
  return { type: "color", color: legacyTimelineBg };
};

export const migrateScene = (scene: LegacyScene, legacyTimelineBg: string): Scene => {
  const { video: _legacyVideo, ...rest } = scene;
  const out: Scene = {
    ...rest,
    background: migrateBackground(scene, legacyTimelineBg),
    words: (scene.words ?? []).map(migrateWord),
  };
  if (scene.shapes) out.shapes = scene.shapes;
  return out;
};

/** A legacy-or-new timeline as it may appear in an imported JSON file. */
type LegacyTimeline = Omit<Timeline, "scenes"> & {
  background?: string;
  scenes: LegacyScene[];
};

/** Import migration: expand enterFrom→keyframes AND convert the legacy
 *  background/inset model to the per-scene `background` union. Idempotent. */
export const migrateTimeline = (tl: LegacyTimeline | Timeline): Timeline => {
  const legacy = tl as LegacyTimeline;
  const legacyBg = typeof legacy.background === "string" ? legacy.background : "#000000";
  const { background: _legacyBg, ...rest } = legacy;
  return {
    ...(rest as Omit<Timeline, "scenes">),
    scenes: legacy.scenes.map((s) => migrateScene(s, legacyBg)),
  };
};
