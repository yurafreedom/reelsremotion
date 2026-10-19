// Immutable keyframe edit helpers. Every function returns a NEW Timeline so React
// re-renders and the <Player> reflects the edit live. Keyframe frames are
// WORD-RELATIVE (CONTRACT §3); these helpers never touch word.start/end, so
// retiming a clip and editing its keyframes are fully independent.

import type {
  Easing,
  KeyframeProperty,
  PositionKeyframe,
  Vec2,
  Word,
  WordKeyframes,
} from "@engine/types";
import type { TimelineV3 } from "@engine/types.v3";
import { textTrackOf } from "@engine/types.v3";
import { buildPreset, type PresetId } from "@engine/presets";
import { currentValue } from "./kfModel";

// v3: a word is addressed by its index on the single text track.
export type WordRef = { wordIndex: number };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const wordAt = (tl: TimelineV3, ref: WordRef): Word | undefined =>
  textTrackOf(tl)?.words[ref.wordIndex];

// Get (creating if needed) the mutable keyframes object on a CLONED timeline.
const ensureKf = (w: Word): WordKeyframes => {
  if (!w.keyframes) w.keyframes = {};
  return w.keyframes;
};

// Drop empty tracks and an empty keyframes object so a word that loses its last
// keyframe serializes identically to a never-animated word (CONTRACT invariant).
const prune = (w: Word): void => {
  const kf = w.keyframes;
  if (!kf) return;
  for (const k of Object.keys(kf) as KeyframeProperty[]) {
    const t = kf[k] as unknown[] | undefined;
    if (!Array.isArray(t) || t.length === 0) delete kf[k];
  }
  if (Object.keys(kf).length === 0) delete w.keyframes;
};

const sortByFrame = <T extends { frame: number }>(arr: T[]): T[] =>
  arr.sort((a, b) => a.frame - b.frame);

// ----- Add / update a keyframe at a word-relative frame -----------------------

/** Write (or overwrite) a scalar/color/discrete keyframe at `frame`. */
export function setScalarKey(
  tl: TimelineV3,
  ref: WordRef,
  property: Exclude<KeyframeProperty, "position">,
  frame: number,
  value: number | string,
  easing?: Easing
): TimelineV3 {
  const next = clone(tl);
  const w = wordAt(next, ref);
  if (!w) return tl;
  const kf = ensureKf(w);
  let track = kf[property] as { frame: number; value: number | string; easing?: Easing }[] | undefined;
  if (!track) {
    track = [];
    (kf as Record<string, unknown>)[property] = track;
  }
  const f = Math.round(frame);
  const existing = track.find((k) => k.frame === f);
  if (existing) {
    existing.value = value;
    if (easing !== undefined) existing.easing = easing;
  } else {
    track.push(easing !== undefined ? { frame: f, value, easing } : { frame: f, value });
    sortByFrame(track);
  }
  return next;
}

/** Write (or overwrite) a position keyframe at `frame`, preserving tangents. */
export function setPositionKey(
  tl: TimelineV3,
  ref: WordRef,
  frame: number,
  value: Vec2,
  opts?: { easing?: Easing; spatialIn?: Vec2; spatialOut?: Vec2 }
): TimelineV3 {
  const next = clone(tl);
  const w = wordAt(next, ref);
  if (!w) return tl;
  const kf = ensureKf(w);
  let track = kf.position;
  if (!track) {
    track = [];
    kf.position = track;
  }
  const f = Math.round(frame);
  const existing = track.find((k) => k.frame === f);
  if (existing) {
    existing.value = { x: Math.round(value.x), y: Math.round(value.y) };
    if (opts?.easing !== undefined) existing.easing = opts.easing;
    if (opts?.spatialIn !== undefined) existing.spatialIn = opts.spatialIn;
    if (opts?.spatialOut !== undefined) existing.spatialOut = opts.spatialOut;
  } else {
    const k: PositionKeyframe = { frame: f, value: { x: Math.round(value.x), y: Math.round(value.y) } };
    if (opts?.easing !== undefined) k.easing = opts.easing;
    if (opts?.spatialIn !== undefined) k.spatialIn = opts.spatialIn;
    if (opts?.spatialOut !== undefined) k.spatialOut = opts.spatialOut;
    track.push(k);
    sortByFrame(track);
  }
  return next;
}

/** Seed a track from the property's CURRENT on-screen value (the "+ keyframe" /
 *  "animate" affordance). No-op if a kf already exists at that frame. */
export function addKeyframeFromCurrent(
  tl: TimelineV3,
  ref: WordRef,
  property: KeyframeProperty,
  frame: number
): TimelineV3 {
  const w = wordAt(tl, ref);
  if (!w) return tl;
  const val = currentValue(w, property, frame);
  if (property === "position") return setPositionKey(tl, ref, frame, val as Vec2);
  return setScalarKey(tl, ref, property as Exclude<KeyframeProperty, "position">, frame, val as number | string);
}

// ----- Mutate existing keyframes ----------------------------------------------

/** Change a keyframe's value (used by panel inputs / canvas + path drags). */
export function setKeyValue(
  tl: TimelineV3,
  ref: WordRef,
  property: KeyframeProperty,
  index: number,
  value: number | string | Vec2
): TimelineV3 {
  const next = clone(tl);
  const w = wordAt(next, ref);
  const track = w?.keyframes?.[property] as { value: unknown }[] | undefined;
  if (!track || !track[index]) return tl;
  track[index].value = value;
  return next;
}

/** Move a keyframe to a new word-relative frame (re-sorts; clamps to ≥0). */
export function moveKey(
  tl: TimelineV3,
  ref: WordRef,
  property: KeyframeProperty,
  index: number,
  newFrame: number
): TimelineV3 {
  const next = clone(tl);
  const w = wordAt(next, ref);
  const track = w?.keyframes?.[property] as { frame: number }[] | undefined;
  if (!track || !track[index]) return tl;
  const f = Math.max(0, Math.round(newFrame));
  // Don't collide onto another kf's frame.
  if (track.some((k, i) => i !== index && k.frame === f)) return tl;
  track[index].frame = f;
  sortByFrame(track);
  return next;
}

/** Set the temporal easing INTO a keyframe (the segment that ends at it). */
export function setEasing(
  tl: TimelineV3,
  ref: WordRef,
  property: KeyframeProperty,
  index: number,
  easing: Easing
): TimelineV3 {
  const next = clone(tl);
  const w = wordAt(next, ref);
  const track = w?.keyframes?.[property] as { easing?: Easing }[] | undefined;
  if (!track || !track[index]) return tl;
  track[index].easing = easing;
  return next;
}

/** Set a position keyframe's spatial tangent (curved motion path). */
export function setSpatialTangent(
  tl: TimelineV3,
  ref: WordRef,
  index: number,
  which: "in" | "out",
  vec: Vec2
): TimelineV3 {
  const next = clone(tl);
  const w = wordAt(next, ref);
  const track = w?.keyframes?.position;
  if (!track || !track[index]) return tl;
  const k = track[index];
  const rounded = { x: Math.round(vec.x), y: Math.round(vec.y) };
  if (which === "in") k.spatialIn = rounded;
  else k.spatialOut = rounded;
  return next;
}

/** Delete keyframes by index (multi). Prunes empty tracks. */
export function deleteKeys(
  tl: TimelineV3,
  ref: WordRef,
  property: KeyframeProperty,
  indices: number[]
): TimelineV3 {
  const next = clone(tl);
  const w = wordAt(next, ref);
  const track = w?.keyframes?.[property] as unknown[] | undefined;
  if (!track) return tl;
  const drop = new Set(indices);
  const kept = track.filter((_, i) => !drop.has(i));
  (w!.keyframes as Record<string, unknown>)[property] = kept;
  prune(w!);
  return next;
}

/** Remove an entire track (the property reverts to its static fallback). */
export function deleteTrack(tl: TimelineV3, ref: WordRef, property: KeyframeProperty): TimelineV3 {
  const next = clone(tl);
  const w = wordAt(next, ref);
  if (!w?.keyframes) return tl;
  delete w.keyframes[property];
  prune(w);
  return next;
}

// ----- Presets ----------------------------------------------------------------

/** Apply a preset, MERGING its tracks into the word (overwrites those props). */
export function applyPreset(tl: TimelineV3, ref: WordRef, id: PresetId): TimelineV3 {
  const next = clone(tl);
  const w = wordAt(next, ref);
  if (!w) return tl;
  const gen = buildPreset(id, w);
  const kf = ensureKf(w);
  for (const k of Object.keys(gen) as KeyframeProperty[]) {
    (kf as Record<string, unknown>)[k] = gen[k];
  }
  return next;
}

// ----- Copy / paste -----------------------------------------------------------

export type KfClipboard = { data: WordKeyframes };

/** Copy a subset to the clipboard: either whole-word (all tracks), one track, or
 *  specific keyframes within a track. Returns deep-cloned data. */
export function copyKeyframes(
  w: Word,
  sel?: { property: KeyframeProperty; indices?: number[] }
): KfClipboard | null {
  if (!w.keyframes) return null;
  if (!sel) return { data: clone(w.keyframes) }; // whole word
  const track = w.keyframes[sel.property] as unknown[] | undefined;
  if (!track || track.length === 0) return null;
  const chosen = sel.indices && sel.indices.length > 0
    ? sel.indices.map((i) => track[i]).filter(Boolean)
    : track;
  return { data: { [sel.property]: clone(chosen) } as WordKeyframes };
}

/**
 * Paste clipboard tracks onto words. Because frames are word-relative, this is a
 * direct array copy (CONTRACT §3). If `offsetTo` is given, every pasted track is
 * shifted so its earliest keyframe lands at that word-relative frame. Pasted
 * tracks OVERWRITE the same property on each target. Works for multiple targets.
 */
export function pasteKeyframes(
  tl: TimelineV3,
  refs: WordRef[],
  clip: KfClipboard,
  offsetTo?: number
): TimelineV3 {
  const next = clone(tl);
  // Compute the global earliest frame across all pasted tracks for offset.
  let minFrame = Infinity;
  for (const k of Object.keys(clip.data) as KeyframeProperty[]) {
    const t = clip.data[k] as { frame: number }[] | undefined;
    t?.forEach((kf) => (minFrame = Math.min(minFrame, kf.frame)));
  }
  const shift = offsetTo !== undefined && Number.isFinite(minFrame) ? Math.round(offsetTo) - minFrame : 0;

  for (const ref of refs) {
    const w = wordAt(next, ref);
    if (!w) continue;
    const kf = ensureKf(w);
    for (const k of Object.keys(clip.data) as KeyframeProperty[]) {
      const src = clone(clip.data[k]) as { frame: number }[];
      src.forEach((s) => (s.frame = Math.max(0, s.frame + shift)));
      sortByFrame(src);
      (kf as Record<string, unknown>)[k] = src;
    }
    prune(w);
  }
  return next;
}
