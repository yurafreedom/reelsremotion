// Node-assert tests for the pure sampling engine (CONTRACT §4, build steps 1-2).
// Run: node_modules/.bin/esbuild src/keyframes.test.ts --bundle --platform=node \
//        --format=cjs | node
//
// Covers: scalar endpoints/midpoints, hold (step), bezier vs linear differ,
// RGB color lerp, discrete step, and 2D motion path (curved midpoint ≠ straight).

import assert from "node:assert/strict";
import {
  sampleScalar,
  sampleColor,
  sampleDiscrete,
  samplePosition,
  easedFraction,
} from "./keyframes";
import type { Keyframe, PositionKeyframe } from "./types";

let passed = 0;
const ok = (label: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  PASS  ${label}`);
};
const near = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

// ---- Scalar ----
const lin: Keyframe<number>[] = [
  { frame: 0, value: 0 },
  { frame: 10, value: 100, easing: "linear" },
];

ok("scalar endpoints clamp", () => {
  near(sampleScalar(lin, -5), 0);
  near(sampleScalar(lin, 0), 0);
  near(sampleScalar(lin, 10), 100);
  near(sampleScalar(lin, 99), 100);
});

ok("scalar linear midpoint", () => {
  near(sampleScalar(lin, 5), 50);
  near(sampleScalar(lin, 2.5), 25);
});

ok("scalar multi-segment picks right segment", () => {
  const t: Keyframe<number>[] = [
    { frame: 0, value: 0 },
    { frame: 10, value: 100, easing: "linear" },
    { frame: 20, value: 0, easing: "linear" },
  ];
  near(sampleScalar(t, 5), 50);
  near(sampleScalar(t, 15), 50);
  near(sampleScalar(t, 10), 100);
});

// ---- hold (step) ----
ok("hold snaps (stays at A until B.frame)", () => {
  const t: Keyframe<number>[] = [
    { frame: 0, value: 0 },
    { frame: 10, value: 100, easing: "hold" },
  ];
  near(sampleScalar(t, 0), 0);
  near(sampleScalar(t, 5), 0); // held at A
  near(sampleScalar(t, 9.999), 0);
  near(sampleScalar(t, 10), 100); // endpoint = B
});

// ---- bezier vs linear must differ at the midpoint ----
ok("custom bezier ≠ linear at midpoint", () => {
  const linMid = sampleScalar(lin, 5); // 50
  const ease: Keyframe<number>[] = [
    { frame: 0, value: 0 },
    { frame: 10, value: 100, easing: { bezier: [0.42, 0, 0.58, 1] } }, // easeInOut
  ];
  const bezMid = sampleScalar(ease, 5);
  near(bezMid, 50, 1e-3); // easeInOut is symmetric → 50 at the middle...
  // ...but an asymmetric curve must visibly differ:
  const easeIn: Keyframe<number>[] = [
    { frame: 0, value: 0 },
    { frame: 10, value: 100, easing: "easeIn" },
  ];
  const inMid = sampleScalar(easeIn, 5);
  assert.ok(Math.abs(inMid - linMid) > 5, `easeIn midpoint ${inMid} too close to linear ${linMid}`);
  assert.ok(inMid < linMid, "easeIn should lag linear at the midpoint");
});

ok("easedFraction monotonic 0..1", () => {
  near(easedFraction("easeOut", 0), 0);
  near(easedFraction("easeOut", 1), 1);
  let prev = -1;
  for (let p = 0; p <= 1.0001; p += 0.1) {
    const e = easedFraction("easeInOut", Math.min(1, p));
    assert.ok(e >= prev - 1e-9, "must be monotonic non-decreasing");
    prev = e;
  }
});

// ---- Color (RGB lerp) ----
ok("color RGB lerps white→red", () => {
  const t: Keyframe<string>[] = [
    { frame: 0, value: "#ffffff" },
    { frame: 10, value: "#c0182a", easing: "linear" },
  ];
  assert.equal(sampleColor(t, 0), "#ffffff");
  assert.equal(sampleColor(t, 10), "#c0182a");
  // Midpoint = channel-wise average of (255,255,255) and (192,24,42).
  const mid = sampleColor(t, 5);
  // r = (255+192)/2 = 223.5 → 224 ; g = (255+24)/2 = 139.5 → 140 ; b=(255+42)/2=148.5→149
  assert.equal(mid, "#e08c95");
});

ok("color 3-digit hex expands", () => {
  const t: Keyframe<string>[] = [
    { frame: 0, value: "#fff" },
    { frame: 10, value: "#000", easing: "linear" },
  ];
  assert.equal(sampleColor(t, 5), "#808080");
});

// ---- Discrete (fontFamily) ----
ok("discrete steps to active kf", () => {
  const t: Keyframe<string>[] = [
    { frame: 0, value: "cleanSans" },
    { frame: 10, value: "condensedHeavy" },
  ];
  assert.equal(sampleDiscrete(t, 0), "cleanSans");
  assert.equal(sampleDiscrete(t, 9), "cleanSans");
  assert.equal(sampleDiscrete(t, 10), "condensedHeavy");
  assert.equal(sampleDiscrete(t, 99), "condensedHeavy");
});

// ---- Position (2D motion path) ----
ok("position endpoints + straight midpoint", () => {
  const t: PositionKeyframe[] = [
    { frame: 0, value: { x: 0, y: 0 } },
    { frame: 10, value: { x: 100, y: 0 }, easing: "linear" },
  ];
  assert.deepEqual(samplePosition(t, 0), { x: 0, y: 0 });
  assert.deepEqual(samplePosition(t, 10), { x: 100, y: 0 });
  const mid = samplePosition(t, 5);
  near(mid.x, 50);
  near(mid.y, 0);
});

ok("curved path midpoint ≠ straight-line midpoint", () => {
  // Same endpoints, but spatial tangents bow the path upward (negative y).
  const t: PositionKeyframe[] = [
    { frame: 0, value: { x: 0, y: 0 }, spatialOut: { x: 0, y: -100 } },
    { frame: 10, value: { x: 100, y: 0 }, easing: "linear", spatialIn: { x: 0, y: -100 } },
  ];
  const mid = samplePosition(t, 5);
  // x still ~50 by symmetry, but y must bow off the straight line (y=0).
  near(mid.x, 50, 1e-6);
  assert.ok(mid.y < -50, `curved midpoint y=${mid.y} should bow well off the line`);
});

ok("spatial shape independent of temporal easing", () => {
  // Two tracks: identical spatial tangents, different temporal easing. The set of
  // points each traces is the SAME curve (spatial != temporal). Check that a
  // point on curve A equals some point on curve B (same spatial geometry).
  const mk = (easing: "linear" | "easeIn"): PositionKeyframe[] => [
    { frame: 0, value: { x: 0, y: 0 }, spatialOut: { x: 0, y: -100 } },
    { frame: 10, value: { x: 100, y: 0 }, easing, spatialIn: { x: 0, y: -100 } },
  ];
  // At the SAME spatial parameter the geometry matches; easing only remaps time.
  // Linear at f=2.5 has t=0.25; find the frame on easeIn that yields t≈0.25.
  const linPt = samplePosition(mk("linear"), 2.5); // t = 0.25
  // easeIn(p)=0.25 → solve p; brute force the matching frame on the eased track.
  const eased = mk("easeIn");
  let best = Infinity;
  let bestPt = { x: 0, y: 0 };
  for (let f = 0; f <= 10; f += 0.001) {
    const e = easedFraction("easeIn", f / 10);
    const d = Math.abs(e - 0.25);
    if (d < best) {
      best = d;
      bestPt = samplePosition(eased, f);
    }
  }
  near(bestPt.x, linPt.x, 0.2);
  near(bestPt.y, linPt.y, 0.2);
});

console.log(`\n${passed} keyframe sampling checks passed`);
