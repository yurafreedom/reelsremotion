// Shape keyframe edit helpers — the SAME animation system as words (CONTRACT §4),
// applied to the shape layer. Frames are ELEMENT-relative (0 = shape.start), just
// like words; these helpers never touch shape.start/end.
//
// Scope note (v2.2): shapes get auto-keyframing (panel + canvas drag) over the
// shared engine sampler. The richer per-segment graph editor / keyframe lanes stay
// word-only for now (TODO v2.3 — generalize the keyframe UI to any element).

import type {
  Easing,
  Shape,
  ShapeKeyframeProperty,
  ShapeKeyframes,
  Vec2,
} from "@engine/types";
import type { TimelineV3 } from "@engine/types.v3";
import { shapeTrackOf } from "@engine/types.v3";
import {
  hasTrack,
  sampleColor,
  samplePosition,
  sampleScalar,
} from "@engine/keyframes";

// v3: a shape is addressed by its index on the single shape track.
export type ShapeRef = { shapeIndex: number };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const shapeAt = (tl: TimelineV3, ref: ShapeRef): Shape | undefined =>
  shapeTrackOf(tl)?.shapes?.[ref.shapeIndex];

const ensureKf = (s: Shape): ShapeKeyframes => {
  if (!s.keyframes) s.keyframes = {};
  return s.keyframes;
};

const prune = (s: Shape): void => {
  const kf = s.keyframes;
  if (!kf) return;
  for (const k of Object.keys(kf) as ShapeKeyframeProperty[]) {
    const t = kf[k] as unknown[] | undefined;
    if (!Array.isArray(t) || t.length === 0) delete kf[k];
  }
  if (Object.keys(kf).length === 0) delete s.keyframes;
};

const sortByFrame = <T extends { frame: number }>(arr: T[]): T[] =>
  arr.sort((a, b) => a.frame - b.frame);

/** Static fallback for a shape property (mirrors Shape.tsx). */
const staticFallback = (s: Shape, p: ShapeKeyframeProperty): number | string | Vec2 => {
  switch (p) {
    case "position":
      return { x: s.x, y: s.y };
    case "width":
      return s.width;
    case "height":
      return s.height;
    case "color":
      return s.color;
    case "opacity":
      return s.opacity ?? 1;
    case "rotation":
      return s.rotation ?? 0;
    case "borderRadius":
      return s.borderRadius ?? 0;
    case "blur":
      return 0;
  }
};

/** Current on-screen value of a shape property at element-relative frame `rel`
 *  (sampled track if present, else the static fallback). */
export const shapeCurrentValue = (
  s: Shape,
  p: ShapeKeyframeProperty,
  rel: number
): number | string | Vec2 => {
  const kf = s.keyframes;
  if (p === "position") {
    return hasTrack(kf?.position) ? samplePosition(kf!.position!, rel) : { x: s.x, y: s.y };
  }
  if (p === "color") {
    return hasTrack(kf?.color) ? sampleColor(kf!.color!, rel) : s.color;
  }
  const track = kf?.[p] as { frame: number; value: number }[] | undefined;
  if (hasTrack(track)) return sampleScalar(track!, rel);
  return staticFallback(s, p);
};

/** Whether a shape property has a non-empty track (drives the "◇" indicator). */
export const shapeTracked = (s: Shape, p: ShapeKeyframeProperty): boolean => {
  const t = s.keyframes?.[p] as unknown[] | undefined;
  return Array.isArray(t) && t.length > 0;
};

/** Write/overwrite a scalar/color keyframe at element-relative `frame`. */
export function setShapeScalarKey(
  tl: TimelineV3,
  ref: ShapeRef,
  property: Exclude<ShapeKeyframeProperty, "position">,
  frame: number,
  value: number | string,
  easing?: Easing
): TimelineV3 {
  const next = clone(tl);
  const s = shapeAt(next, ref);
  if (!s) return tl;
  const kf = ensureKf(s);
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

/** Write/overwrite a position keyframe at element-relative `frame`. */
export function setShapePositionKey(
  tl: TimelineV3,
  ref: ShapeRef,
  frame: number,
  value: Vec2,
  easing?: Easing
): TimelineV3 {
  const next = clone(tl);
  const s = shapeAt(next, ref);
  if (!s) return tl;
  const kf = ensureKf(s);
  if (!kf.position) kf.position = [];
  const f = Math.round(frame);
  const v = { x: Math.round(value.x), y: Math.round(value.y) };
  const existing = kf.position.find((k) => k.frame === f);
  if (existing) {
    existing.value = v;
    if (easing !== undefined) existing.easing = easing;
  } else {
    kf.position.push(easing !== undefined ? { frame: f, value: v, easing } : { frame: f, value: v });
    sortByFrame(kf.position);
  }
  return next;
}

/** Remove a whole shape track (property reverts to static fallback). */
export function deleteShapeTrack(
  tl: TimelineV3,
  ref: ShapeRef,
  property: ShapeKeyframeProperty
): TimelineV3 {
  const next = clone(tl);
  const s = shapeAt(next, ref);
  if (!s?.keyframes) return tl;
  delete s.keyframes[property];
  prune(s);
  return next;
}
