// Animation presets — UI bridge (v2.6). Maps each Animation-panel button to an
// EXISTING engine generator (src/presets.ts) and merges the resulting keyframes
// into the selected element. This is a thin bridge over existing logic: NO new
// animation math lives here — every word entrance/emphasis comes straight from
// `@engine/presets`, so an applied preset is ordinary keyframes, fully editable in
// the lanes / graph editor afterward (CONTRACT §4).
//
// Shapes share the keyframe system but a different property set (width/height in
// place of `size`, no `clipReveal`). The shape builders reuse the SAME timings and
// scale factors as the word presets, expressed over width/height — the only place
// a small amount of shape-specific shaping is unavoidable.

import type {
  EnterFrom,
  Keyframe,
  Shape,
  ShapeKeyframes,
  Word,
  WordKeyframes,
} from "@engine/types";
import type { TimelineV3 } from "@engine/types.v3";
import { shapeTrackOf, textTrackOf } from "@engine/types.v3";
import {
  ENTER_FRAMES,
  RED,
  TYPE_FRAMES,
  ctxOf,
  fadeInPreset,
  fadeOutPreset,
  popPreset,
  pulsePreset,
  punchRedPreset,
  revealFromCenterPreset,
  slideInPreset,
  typewriterPreset,
} from "@engine/presets";
import type { WordRef } from "../keyframes/kfEdits";
import type { ShapeRef } from "../keyframes/shapeKfEdits";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

// ----- Button catalogue -------------------------------------------------------

export type AnimGroup = "entrance" | "emphasis";

export type AnimId =
  | "slideIn"
  | "revealFromCenter"
  | "typewriter"
  | "fadeIn"
  | "fadeOut"
  | "pop"
  | "punchRed"
  | "pulse";

export type AnimButton = {
  id: AnimId;
  label: string;
  group: AnimGroup;
  title: string;
  /** Slide takes a direction (left/right/top/bottom). */
  hasDirection?: boolean;
  /** Whether the preset is meaningful on a shape (geometric presets only). */
  shape: boolean;
};

/** The single source of truth for the panel grid (entrances + emphasis). */
export const ANIM_BUTTONS: AnimButton[] = [
  { id: "slideIn", label: "Slide-in", group: "entrance", hasDirection: true, shape: true, title: "Slide in from a side + fade (position + opacity)" },
  { id: "revealFromCenter", label: "Reveal center", group: "entrance", shape: true, title: "Появление из центра — scale up + fade" },
  { id: "typewriter", label: "Typewriter", group: "entrance", shape: false, title: "Left→right clip-reveal (clip mask, not per-glyph)" },
  { id: "fadeIn", label: "Fade-in", group: "entrance", shape: true, title: "Fade opacity 0→1" },
  { id: "fadeOut", label: "Fade-out", group: "entrance", shape: true, title: "Tail fade opacity 1→0 at the element end" },
  { id: "pop", label: "Pop", group: "emphasis", shape: true, title: "Scale overshoot then settle" },
  { id: "punchRed", label: "Punch (red)", group: "emphasis", shape: true, title: "Scale-in big + recolor to the red accent" },
  { id: "pulse", label: "Pulse", group: "emphasis", shape: true, title: "A quick scale pulse mid-clip" },
];

export type AnimOpts = {
  /** Slide direction (slideIn only). */
  direction?: EnterFrom;
  /** Override the entrance/exit duration in frames (where the generator supports it). */
  duration?: number;
};

// ----- Word presets (delegate straight to engine generators) ------------------

const buildWordKeyframes = (id: AnimId, w: Word, opts: AnimOpts): WordKeyframes => {
  const ctx = ctxOf(w);
  const dur = opts.duration;
  switch (id) {
    case "slideIn":
      return slideInPreset(opts.direction ?? "left", ctx, dur ?? ENTER_FRAMES);
    case "revealFromCenter":
      return revealFromCenterPreset(ctx, dur ?? ENTER_FRAMES);
    case "typewriter":
      return typewriterPreset(dur ?? TYPE_FRAMES);
    case "fadeIn":
      return fadeInPreset(dur ?? ENTER_FRAMES);
    case "fadeOut":
      return fadeOutPreset(ctx, dur ?? ENTER_FRAMES);
    case "pop":
      return popPreset(ctx);
    case "punchRed":
      return punchRedPreset(ctx, w.color);
    case "pulse":
      return pulsePreset(ctx);
  }
};

/** Merge generated tracks into an element's keyframes: every property the preset
 *  touches is OVERWRITTEN (predictable — an entrance owns position+opacity); other
 *  existing tracks are left untouched. Mirrors kfEdits.applyPreset. */
const mergeInto = (kf: Record<string, unknown>, gen: Record<string, unknown>): void => {
  for (const k of Object.keys(gen)) kf[k] = gen[k];
};

/** Which properties a word preset writes (for the "will overwrite" warning). */
export const wordPresetProps = (id: AnimId, w: Word, opts: AnimOpts): string[] =>
  Object.keys(buildWordKeyframes(id, w, opts));

/** Apply a preset to a single word at its start (entrance) / end (fade-out). */
export function applyWordAnim(
  tl: TimelineV3,
  ref: WordRef,
  id: AnimId,
  opts: AnimOpts = {}
): TimelineV3 {
  const next = clone(tl);
  const w = textTrackOf(next)?.words[ref.wordIndex];
  if (!w) return tl;
  const gen = buildWordKeyframes(id, w, opts);
  if (!w.keyframes) w.keyframes = {};
  mergeInto(w.keyframes as Record<string, unknown>, gen as Record<string, unknown>);
  return next;
}

// ----- Shape presets (same timings/factors, over width/height) ----------------

type ShapeCtx = { x: number; y: number; w: number; h: number; len: number; color: string };
const shapeCtx = (s: Shape): ShapeCtx => ({
  x: s.x,
  y: s.y,
  w: s.width,
  h: s.height,
  len: Math.max(1, s.end - s.start),
  color: s.color,
});

const dirDelta = (dir: EnterFrom, off = 80): { x: number; y: number } => {
  switch (dir) {
    case "left": return { x: -off, y: 0 };
    case "right": return { x: off, y: 0 };
    case "top": return { x: 0, y: -off };
    case "bottom": return { x: 0, y: off };
    default: return { x: 0, y: 0 };
  }
};

const sc = (base: number, fac: number): number => Math.max(1, Math.round(base * fac));

const buildShapeKeyframes = (id: AnimId, s: Shape, opts: AnimOpts): ShapeKeyframes => {
  const ctx = shapeCtx(s);
  const dur = Math.max(1, Math.round(opts.duration ?? ENTER_FRAMES));
  const fadeIn: Keyframe<number>[] = [
    { frame: 0, value: 0 },
    { frame: dur, value: 1, easing: "easeOut" },
  ];
  switch (id) {
    case "slideIn": {
      const d = dirDelta(opts.direction ?? "left");
      const kf: ShapeKeyframes = { opacity: fadeIn };
      if (d.x !== 0 || d.y !== 0) {
        kf.position = [
          { frame: 0, value: { x: ctx.x + d.x, y: ctx.y + d.y } },
          { frame: dur, value: { x: ctx.x, y: ctx.y }, easing: "easeOut" },
        ];
      }
      return kf;
    }
    case "fadeIn":
      return { opacity: fadeIn };
    case "fadeOut":
      return {
        opacity: [
          { frame: Math.max(0, ctx.len - dur), value: 1 },
          { frame: ctx.len, value: 0, easing: "easeIn" },
        ],
      };
    case "revealFromCenter":
      // Scale up from small + fade (grows around its center, position unchanged).
      return {
        width: [{ frame: 0, value: sc(ctx.w, 0.4) }, { frame: dur, value: ctx.w, easing: "easeOut" }],
        height: [{ frame: 0, value: sc(ctx.h, 0.4) }, { frame: dur, value: ctx.h, easing: "easeOut" }],
        opacity: fadeIn,
      };
    case "pop":
      return {
        width: [{ frame: 0, value: sc(ctx.w, 0.5) }, { frame: 7, value: sc(ctx.w, 1.12), easing: "easeOut" }, { frame: 12, value: ctx.w, easing: "easeInOut" }],
        height: [{ frame: 0, value: sc(ctx.h, 0.5) }, { frame: 7, value: sc(ctx.h, 1.12), easing: "easeOut" }, { frame: 12, value: ctx.h, easing: "easeInOut" }],
        opacity: [{ frame: 0, value: 0 }, { frame: 7, value: 1, easing: "easeOut" }],
      };
    case "punchRed":
      return {
        width: [{ frame: 0, value: sc(ctx.w, 0.6) }, { frame: 8, value: sc(ctx.w, 1.18), easing: "easeOut" }, { frame: 16, value: ctx.w, easing: "easeIn" }],
        height: [{ frame: 0, value: sc(ctx.h, 0.6) }, { frame: 8, value: sc(ctx.h, 1.18), easing: "easeOut" }, { frame: 16, value: ctx.h, easing: "easeIn" }],
        opacity: [{ frame: 0, value: 0 }, { frame: 8, value: 1, easing: "easeOut" }],
        color: [{ frame: 2, value: ctx.color }, { frame: 8, value: RED, easing: "easeOut" }],
      };
    case "pulse": {
      const c = Math.max(2, Math.round(ctx.len / 3));
      return {
        width: [{ frame: Math.max(0, c - 4), value: ctx.w }, { frame: c, value: sc(ctx.w, 1.25), easing: "easeOut" }, { frame: c + 4, value: ctx.w, easing: "easeIn" }],
        height: [{ frame: Math.max(0, c - 4), value: ctx.h }, { frame: c, value: sc(ctx.h, 1.25), easing: "easeOut" }, { frame: c + 4, value: ctx.h, easing: "easeIn" }],
      };
    }
    case "typewriter":
      return {}; // not geometric for shapes — panel hides it for shapes
  }
};

/** Which properties a shape preset writes (for the "will overwrite" warning). */
export const shapePresetProps = (id: AnimId, s: Shape, opts: AnimOpts): string[] =>
  Object.keys(buildShapeKeyframes(id, s, opts));

/** Apply a geometric preset to a shape (slide/fade/pop/pulse/punch/reveal-center). */
export function applyShapeAnim(
  tl: TimelineV3,
  ref: ShapeRef,
  id: AnimId,
  opts: AnimOpts = {}
): TimelineV3 {
  const next = clone(tl);
  const s = shapeTrackOf(next)?.shapes?.[ref.shapeIndex];
  if (!s) return tl;
  const gen = buildShapeKeyframes(id, s, opts);
  if (Object.keys(gen).length === 0) return tl;
  if (!s.keyframes) s.keyframes = {};
  mergeInto(s.keyframes as Record<string, unknown>, gen as Record<string, unknown>);
  return next;
}

// ----- Cumulative word-by-word reveal (wraps the revealWordByWord pattern) -----
// The core reels move: a set of words appear ONE BY ONE and accumulate — each
// enters in its own moment and EARLIER WORDS DO NOT DISAPPEAR (they hold to the
// scene end). This is the editor-side equivalent of compose's `revealWordByWord`
// (compose/patterns.ts): same staggered-entrance + hold-to-scene-end behavior,
// but applied to words that already exist on the timeline (with their own text and
// positions) rather than created from raw strings. Each entrance is an ordinary
// engine preset, so the result is fully editable afterward.

export type CumulativeEntrance = "slide" | "center" | "fade";

export type CumulativeOpts = {
  /** Entrance applied to each word. slide → alternating left/right (the classic look). */
  entrance: CumulativeEntrance;
  /** Frames between successive entrances (ignored when snapToAsr keeps real timings). */
  stagger: number;
  /** Keep each word's EXISTING start (ASR word timing) instead of uniform stagger. */
  snapToAsr: boolean;
  /** Earlier words hold until the scene end so they accumulate on screen. */
  holdToSceneEnd: boolean;
  /** Entrance duration in frames. */
  duration?: number;
};

export const DEFAULT_CUMULATIVE: CumulativeOpts = {
  entrance: "slide",
  stagger: 12,
  snapToAsr: true,
  holdToSceneEnd: true,
};

/**
 * Animate `wordIndices` on the text track as a cumulative reveal. Sets each word's
 * ABSOLUTE start (staggered, or kept from ASR), extends its end to `endFrame` when
 * holding (v3 has no scenes — the caller passes the end of the covering clip or the
 * total duration), and merges an entrance preset. Earlier words remain visible.
 */
export function applyCumulativeReveal(
  tl: TimelineV3,
  wordIndices: number[],
  opts: CumulativeOpts,
  endFrame: number
): TimelineV3 {
  const next = clone(tl);
  const words = textTrackOf(next)?.words;
  if (!words) return tl;
  const targets = wordIndices
    .filter((i) => words[i] !== undefined)
    .sort((a, b) => a - b);
  if (targets.length === 0) return tl;

  const dur = opts.duration ?? ENTER_FRAMES;
  // When not snapping to ASR, stagger from the earliest target's current start so
  // the line keeps its place on the timeline.
  const baseStart = Math.min(...targets.map((i) => words[i].start));

  targets.forEach((wi, order) => {
    const w = words[wi];
    if (!opts.snapToAsr) {
      w.start = Math.max(0, Math.round(baseStart + order * opts.stagger));
    }
    if (opts.holdToSceneEnd) w.end = endFrame;
    if (w.end <= w.start) w.end = Math.max(w.start + 1, endFrame);

    const ctx = ctxOf(w);
    let gen: WordKeyframes;
    if (opts.entrance === "center") {
      gen = revealFromCenterPreset(ctx, dur);
    } else if (opts.entrance === "fade") {
      gen = fadeInPreset(dur);
    } else {
      // slide → alternate sides (matches revealWordByWord's `fromSides` default).
      const from: EnterFrom = order % 2 === 0 ? "left" : "right";
      gen = slideInPreset(from, ctx, dur);
    }
    if (!w.keyframes) w.keyframes = {};
    mergeInto(w.keyframes as Record<string, unknown>, gen as Record<string, unknown>);
  });
  return next;
}
