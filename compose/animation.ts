// Animation & emphasis wrappers — the semantic layer over src/presets.ts. Each
// function GENERATES a `WordKeyframes` (word-relative, CONTRACT §3/§4) and merges
// it into the word via applyKeyframes. The canonical no-arg behaviors delegate
// straight to the engine presets (buildPreset) so there is ONE codepath; the
// parametric variants reuse the same constants (ENTER_FRAMES/ENTER_OFFSET) and
// keyframe shapes, never the sampling math (that stays in src/keyframes.ts).

import type { EnterFrom, Easing, Word, WordKeyframes } from "@engine/types";
import {
  ENTER_FRAMES,
  ENTER_OFFSET,
  buildPreset,
  type PresetId,
} from "@engine/presets";
import { applyKeyframes, wordLen, clampToLife } from "./internal";

const RED = "#c0182a";

/** Apply a raw engine preset (slideIn/fadeIn/fadeOut/scaleIn/pulse/spin) verbatim.
 *  This is the most direct reuse of presets.ts. */
export const preset = (word: Word, id: PresetId): Word =>
  applyKeyframes(word, buildPreset(id, word));

const dirDelta = (dir: EnterFrom, offset: number): { x: number; y: number } => {
  switch (dir) {
    case "left":
      return { x: -offset, y: 0 };
    case "right":
      return { x: offset, y: 0 };
    case "top":
      return { x: 0, y: -offset };
    case "bottom":
      return { x: 0, y: offset };
    default:
      return { x: 0, y: 0 };
  }
};

/** Slide in from a side + fade. Defaults match the engine slide-in preset. */
export const slideIn = (
  word: Word,
  opts: { from?: EnterFrom; duration?: number; offset?: number; easing?: Easing } = {}
): Word => {
  const from = opts.from ?? "left";
  const dur = opts.duration ?? ENTER_FRAMES;
  const off = opts.offset ?? ENTER_OFFSET;
  const ease = opts.easing ?? "easeOut";
  const d = dirDelta(from, off);
  const kf: WordKeyframes = {
    opacity: [
      { frame: 0, value: 0 },
      { frame: dur, value: 1, easing: ease },
    ],
  };
  if (d.x !== 0 || d.y !== 0) {
    kf.position = [
      { frame: 0, value: { x: word.x + d.x, y: word.y + d.y } },
      { frame: dur, value: { x: word.x, y: word.y }, easing: ease },
    ];
  }
  return applyKeyframes(word, kf);
};

/** Fade in over `duration` frames. */
export const fadeIn = (word: Word, opts: { duration?: number; easing?: Easing } = {}): Word => {
  const dur = opts.duration ?? 10;
  return applyKeyframes(word, {
    opacity: [
      { frame: 0, value: 0 },
      { frame: dur, value: 1, easing: opts.easing ?? "easeOut" },
    ],
  });
};

/** Fade out over the last `duration` frames of the word's life. */
export const fadeOut = (word: Word, opts: { duration?: number; easing?: Easing } = {}): Word => {
  const dur = opts.duration ?? 15;
  const len = wordLen(word);
  return applyKeyframes(word, {
    opacity: [
      { frame: Math.max(0, len - dur), value: 1 },
      { frame: len, value: 0, easing: opts.easing ?? "easeIn" },
    ],
  });
};

/** Scale to rest from `fromScale`× the base size + fade. (>1 = drop-in punch,
 *  <1 = grow-in.) */
export const scaleIn = (
  word: Word,
  opts: { fromScale?: number; duration?: number; easing?: Easing } = {}
): Word => {
  const fromScale = opts.fromScale ?? 1.4;
  const dur = opts.duration ?? 10;
  const ease = opts.easing ?? "easeOut";
  return applyKeyframes(word, {
    size: [
      { frame: 0, value: Math.max(1, Math.round(word.size * fromScale)) },
      { frame: dur, value: word.size, easing: ease },
    ],
    opacity: [
      { frame: 0, value: 0 },
      { frame: dur, value: 1, easing: ease },
    ],
  });
};

/** A quick size bump back to base. `at` is word-relative (default ~1/3 in);
 *  `amount` is the peak scale factor. */
export const pulse = (word: Word, opts: { at?: number; amount?: number } = {}): Word => {
  const at = clampToLife(word, opts.at ?? wordLen(word) / 3);
  const amount = opts.amount ?? 1.25;
  return applyKeyframes(word, {
    size: [
      { frame: Math.max(0, at - 4), value: word.size },
      { frame: at, value: Math.round(word.size * amount), easing: "easeOut" },
      { frame: at + 4, value: word.size, easing: "easeIn" },
    ],
  });
};

/** Spin `turns` full rotations over `duration` frames. */
export const spin = (word: Word, opts: { turns?: number; duration?: number; easing?: Easing } = {}): Word => {
  const turns = opts.turns ?? 1;
  const dur = opts.duration ?? ENTER_FRAMES;
  return applyKeyframes(word, {
    rotation: [
      { frame: 0, value: 0 },
      { frame: dur, value: 360 * turns, easing: opts.easing ?? "easeInOut" },
    ],
  });
};

/** Recolor to `color`, reaching it AT word-relative `frame` (a short ramp before
 *  it holds the original color). Composes with other color keyframes. */
export const recolorAt = (
  word: Word,
  frame: number,
  color: string,
  opts: { ramp?: number; easing?: Easing } = {}
): Word => {
  const f = clampToLife(word, frame);
  const ramp = opts.ramp ?? 6;
  return applyKeyframes(word, {
    color: [
      { frame: Math.max(0, f - ramp), value: word.color },
      { frame: f, value: color, easing: opts.easing ?? "easeOut" },
    ],
  });
};

/**
 * Move the word through `points` (offsets-from-center, px) across its life. With
 * `curved`, Catmull-Rom-style spatial tangents are attached so the path is a
 * smooth curve (the engine reads spatialIn/spatialOut, CONTRACT §4 position rule);
 * otherwise straight segments.
 */
export const moveAlong = (
  word: Word,
  points: { x: number; y: number }[],
  opts: { easing?: Easing; curved?: boolean } = {}
): Word => {
  if (points.length < 2) {
    throw new Error("moveAlong: need at least 2 points");
  }
  const len = wordLen(word);
  const n = points.length;
  const ease = opts.easing ?? "easeInOut";
  const position = points.map((p, i) => {
    const frame = Math.round((len * i) / (n - 1));
    const kf: import("@engine/types").PositionKeyframe = {
      frame,
      value: { x: p.x, y: p.y },
    };
    if (i > 0) kf.easing = ease; // temporal easing into each point
    if (opts.curved) {
      // Catmull-Rom tangent at p[i] ≈ (p[i+1] - p[i-1]) / 2, split into in/out
      // handles (1/3 of the segment) → a C1-continuous Bézier path.
      const prev = points[i - 1] ?? p;
      const next = points[i + 1] ?? p;
      const tx = (next.x - prev.x) / 6;
      const ty = (next.y - prev.y) / 6;
      if (i > 0) kf.spatialIn = { x: -tx, y: -ty };
      if (i < n - 1) kf.spatialOut = { x: tx, y: ty };
    }
    return kf;
  });
  return applyKeyframes(word, { position });
};

// ----- Named emphasis recipes -------------------------------------------------
// Each recipe composes the primitives above into a "feel". They are intentionally
// small and editable — a draft starting point, not a final art direction.

export type EmphasisStyle = "punch-red" | "pop" | "pulse-beat";

const emphasisRecipes: Record<EmphasisStyle, (w: Word) => void> = {
  // Drop-in scale punch + recolor to the red accent, settling to base.
  "punch-red": (w) => {
    applyKeyframes(w, {
      size: [
        { frame: 0, value: Math.round(w.size * 0.6) },
        { frame: 8, value: Math.round(w.size * 1.18), easing: "easeOut" },
        { frame: 16, value: w.size, easing: "easeIn" },
      ],
      opacity: [
        { frame: 0, value: 0 },
        { frame: 8, value: 1, easing: "easeOut" },
      ],
    });
    recolorAt(w, 8, RED);
  },
  // Snappy scale-in overshoot, no recolor.
  pop: (w) => {
    applyKeyframes(w, {
      size: [
        { frame: 0, value: Math.round(w.size * 0.5) },
        { frame: 7, value: Math.round(w.size * 1.12), easing: "easeOut" },
        { frame: 12, value: w.size, easing: "easeInOut" },
      ],
      opacity: [
        { frame: 0, value: 0 },
        { frame: 7, value: 1, easing: "easeOut" },
      ],
    });
  },
  // A single mid-clip beat pulse (use kineticBeat for repeated/timed beats).
  "pulse-beat": (w) => {
    pulse(w, { amount: 1.3 });
  },
};

/** Apply a named emphasis recipe to a word. */
export const emphasize = (word: Word, style: EmphasisStyle): Word => {
  const recipe = emphasisRecipes[style];
  if (!recipe) {
    throw new Error(
      `emphasize: unknown style ${JSON.stringify(style)} (have: ${Object.keys(
        emphasisRecipes
      ).join(", ")})`
    );
  }
  recipe(word);
  return word;
};
