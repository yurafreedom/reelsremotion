// Pure keyframe sampling — the single animation engine (CONTRACT §4).
// Shared verbatim by the renderer (Word.tsx) AND the editor (graph/path/preview),
// so the Player and the rendered mp4 are guaranteed identical (WYSIWYG).
//
// Zero runtime dependencies (only `import type`): every function is exact math,
// trivially Node-assert testable, and frame-context-free. Easing presets are
// CSS-style cubic-beziers (the same curves the graph editor exposes), so a preset
// and a hand-tuned bezier go through one identical code path.
//
// Frame convention (CONTRACT §3): all `frame` values here are WORD-RELATIVE.
// The caller maps the scene-relative playhead to `f = sceneFrame - word.start`.

import type {
  Easing,
  Keyframe,
  PositionKeyframe,
  Vec2,
} from "./types";

// ----- Easing -----------------------------------------------------------------

// CSS-style cubic-bezier control points for each named preset. The graph editor
// seeds its handles from these, so a preset === its bezier.
export const PRESET_BEZIER: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
};

/** Resolve any Easing to its cubic-bezier control points. `hold`/unknown → null
 *  (caller treats null as a step). */
export const easingBezier = (
  easing: Easing | undefined
): [number, number, number, number] | null => {
  const e = easing ?? "linear";
  if (e === "hold") return null;
  if (typeof e === "string") return PRESET_BEZIER[e] ?? PRESET_BEZIER.linear;
  return e.bezier;
};

// Cubic-bezier timing solver (CSS/Remotion-equivalent): given the linear time
// fraction x∈[0,1], find t with bezierX(t)=x (Newton-Raphson + bisection), then
// return bezierY(t). A linear [0,0,1,1] curve returns x unchanged.
const bezierEasing = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): ((x: number) => number) => {
  const A = (a: number, b: number) => 1 - 3 * b + 3 * a;
  const B = (a: number, b: number) => 3 * b - 6 * a;
  const C = (a: number) => 3 * a;
  const calc = (t: number, a: number, b: number) =>
    ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
  const slope = (t: number, a: number, b: number) =>
    3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);

  const solveX = (x: number): number => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const xs = calc(t, x1, x2) - x;
      if (Math.abs(xs) < 1e-7) return t;
      const d = slope(t, x1, x2);
      if (Math.abs(d) < 1e-7) break;
      t -= xs / d;
    }
    // Bisection fallback (guarantees convergence within [0,1]).
    let lo = 0;
    let hi = 1;
    let tt = x;
    for (let i = 0; i < 30; i++) {
      const xs = calc(tt, x1, x2);
      if (Math.abs(xs - x) < 1e-7) return tt;
      if (xs < x) lo = tt;
      else hi = tt;
      tt = (lo + hi) / 2;
    }
    return tt;
  };

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return calc(solveX(x), y1, y2);
  };
};

/**
 * Eased fraction of a normalized segment progress `p`∈[0,1] using B's easing.
 * `hold` → 0 until the segment completes (the value stays at A; it snaps to B at
 * B.frame, where the endpoint rule below returns B exactly).
 */
export const easedFraction = (easing: Easing | undefined, p: number): number => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const cp = easingBezier(easing);
  if (!cp) return 0; // hold: step
  return bezierEasing(cp[0], cp[1], cp[2], cp[3])(p);
};

// ----- Segment lookup ---------------------------------------------------------

// Index of the segment's left keyframe: the last kf with frame <= f. Assumes a
// non-empty, frame-sorted track and f strictly inside (track[0].frame, last.frame).
const leftIndex = (frames: number[], f: number): number => {
  let i = 0;
  while (i < frames.length - 1 && frames[i + 1] <= f) i++;
  return i;
};

// ----- Scalar (size / weight / letterSpacing / opacity / rotation / blur) ------

/** Sample a scalar track at word-relative frame `f`. Endpoints clamp; between
 *  A→B interpolate by B's easing. Caller guarantees a non-empty track. */
export const sampleScalar = (track: Keyframe<number>[], f: number): number => {
  const n = track.length;
  if (n === 0) return 0;
  if (f <= track[0].frame) return track[0].value;
  if (f >= track[n - 1].frame) return track[n - 1].value;
  const i = leftIndex(track.map((k) => k.frame), f);
  const A = track[i];
  const B = track[i + 1];
  const span = B.frame - A.frame;
  const p = span <= 0 ? 1 : (f - A.frame) / span;
  const e = easedFraction(B.easing, p);
  return A.value + (B.value - A.value) * e;
};

// ----- Color (RGB interpolation) ----------------------------------------------

const hexToRgb = (hex: string): [number, number, number] => {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const rgbToHex = (r: number, g: number, b: number): string => {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
};

/** Sample a color track at `f`: RGB linear interpolation eased by B's easing. */
export const sampleColor = (track: Keyframe<string>[], f: number): string => {
  const n = track.length;
  if (n === 0) return "#ffffff";
  if (f <= track[0].frame) return track[0].value;
  if (f >= track[n - 1].frame) return track[n - 1].value;
  const i = leftIndex(track.map((k) => k.frame), f);
  const A = track[i];
  const B = track[i + 1];
  const span = B.frame - A.frame;
  const p = span <= 0 ? 1 : (f - A.frame) / span;
  const e = easedFraction(B.easing, p);
  const [ar, ag, ab] = hexToRgb(A.value);
  const [br, bg, bb] = hexToRgb(B.value);
  return rgbToHex(ar + (br - ar) * e, ag + (bg - ag) * e, ab + (bb - ab) * e);
};

// ----- Discrete (fontFamily) --------------------------------------------------

/** Sample a discrete track at `f`: step — the value of the active kf (last with
 *  frame <= f). Before the first kf → the first value. */
export const sampleDiscrete = <T>(track: Keyframe<T>[], f: number): T => {
  const n = track.length;
  if (n === 0) throw new Error("sampleDiscrete: empty track");
  if (f <= track[0].frame) return track[0].value;
  const i = leftIndex(track.map((k) => k.frame), f);
  return track[i].value;
};

// ----- Position (2D motion path) ----------------------------------------------

const v = (x: number, y: number): Vec2 => ({ x, y });

// Cubic Bézier point at parameter t (Bernstein form).
const cubicPoint = (P0: Vec2, P1: Vec2, P2: Vec2, P3: Vec2, t: number): Vec2 => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return v(
    a * P0.x + b * P1.x + c * P2.x + d * P3.x,
    a * P0.y + b * P1.y + c * P2.y + d * P3.y
  );
};

/**
 * Sample a 2D position track at `f`. Temporal parameter `t` comes from B's
 * easing; the spatial point is a cubic Bézier with
 *   P0 = A.value, P1 = A.value + A.spatialOut,
 *   P2 = B.value + B.spatialIn, P3 = B.value
 * evaluated at the eased `t`. Absent tangents are 0 → a straight segment.
 */
export const samplePosition = (track: PositionKeyframe[], f: number): Vec2 => {
  const n = track.length;
  if (n === 0) return v(0, 0);
  if (f <= track[0].frame) return { ...track[0].value };
  if (f >= track[n - 1].frame) return { ...track[n - 1].value };
  const i = leftIndex(track.map((k) => k.frame), f);
  const A = track[i];
  const B = track[i + 1];
  const span = B.frame - A.frame;
  const p = span <= 0 ? 1 : (f - A.frame) / span;
  const t = easedFraction(B.easing, p);
  const P0 = A.value;
  const P1 = v(A.value.x + (A.spatialOut?.x ?? 0), A.value.y + (A.spatialOut?.y ?? 0));
  const P2 = v(B.value.x + (B.spatialIn?.x ?? 0), B.value.y + (B.spatialIn?.y ?? 0));
  const P3 = B.value;
  return cubicPoint(P0, P1, P2, P3, t);
};

// ----- Track helpers (shared by renderer + editor) ----------------------------

/** A track that exists AND has ≥1 keyframe (an empty track falls back to static). */
export const hasTrack = <T>(track: T[] | undefined): track is T[] =>
  Array.isArray(track) && track.length > 0;
