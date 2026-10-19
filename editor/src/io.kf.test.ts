// Node-assert tests for keyframe IO round-trip + import migration (build steps
// 5, 11). Run: node_modules/.bin/esbuild editor/src/io.kf.test.ts --bundle \
//   --platform=node --format=cjs | node   (from repo root)

import assert from "node:assert/strict";
import { serializeWord, serializeTimeline } from "./io";
import { migrateTimeline, migrateWord } from "../../src/presets";
import type { Timeline, Word } from "../../src/types";

let passed = 0;
const ok = (label: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  PASS  ${label}`);
};

// ---- Keyframeless word serializes with NO `keyframes` key ----
const staticWord: Word = {
  text: "STATIC",
  start: 0,
  end: 30,
  x: 0,
  y: 0,
  font: "cleanSans",
  size: 40,
  weight: 400,
  color: "#ffffff",
  enterFrom: "none",
};

ok("keyframeless word: no `keyframes` key, deep-equal round-trip", () => {
  const out = serializeWord(staticWord);
  assert.ok(!("keyframes" in out), "must not emit keyframes");
  assert.deepEqual(out, staticWord);
});

// ---- Fully-keyframed word round-trips deep-equal (all 9 props, tangents, bezier) ----
const animated: Word = {
  text: "MOVE",
  start: 10,
  end: 70,
  x: 0,
  y: 0,
  font: "condensedHeavy",
  size: 80,
  weight: 800,
  color: "#ffffff",
  enterFrom: "left",
  case: "upper",
  keyframes: {
    position: [
      { frame: 0, value: { x: -200, y: 0 }, spatialOut: { x: 0, y: -120 } },
      { frame: 24, value: { x: 200, y: 0 }, easing: { bezier: [0.42, 0, 0.58, 1] }, spatialIn: { x: 0, y: -120 } },
    ],
    size: [
      { frame: 0, value: 40 },
      { frame: 24, value: 120, easing: "easeOut" },
    ],
    weight: [
      { frame: 0, value: 300 },
      { frame: 24, value: 800, easing: "linear" },
    ],
    fontFamily: [
      { frame: 0, value: "cleanSans" },
      { frame: 12, value: "condensedHeavy" },
    ],
    letterSpacing: [
      { frame: 0, value: 0 },
      { frame: 24, value: 12, easing: "easeInOut" },
    ],
    color: [
      { frame: 0, value: "#ffffff" },
      { frame: 24, value: "#c0182a", easing: "linear" },
    ],
    opacity: [
      { frame: 0, value: 0 },
      { frame: 12, value: 1, easing: "easeOut" },
    ],
    rotation: [
      { frame: 0, value: 0 },
      { frame: 24, value: 720, easing: "easeInOut" }, // >360 spin
    ],
    blur: [
      { frame: 0, value: 20 },
      { frame: 12, value: 0, easing: "easeOut" },
    ],
  },
};

ok("fully-keyframed word round-trips deep-equal (all 9 tracks)", () => {
  const out = serializeWord(animated);
  assert.deepEqual(out, animated);
});

ok("serialize is idempotent on keyframes", () => {
  const a = serializeWord(animated);
  const b = serializeWord(a);
  assert.deepEqual(b, a);
});

ok("optional fields dropped when absent; empty tracks dropped", () => {
  const w: Word = {
    ...staticWord,
    keyframes: {
      opacity: [
        { frame: 0, value: 0 }, // no easing on first kf
        { frame: 5, value: 1 }, // no easing → must NOT appear
      ],
      size: [], // empty → must be dropped
    },
  };
  const out = serializeWord(w);
  assert.ok(out.keyframes, "keyframes present");
  assert.ok(!("size" in out.keyframes!), "empty size track dropped");
  assert.ok(!("easing" in out.keyframes!.opacity![1]), "absent easing not emitted");
  assert.deepEqual(out.keyframes!.opacity, [
    { frame: 0, value: 0 },
    { frame: 5, value: 1 },
  ]);
});

// ---- Import migration: enterFrom → keyframes ----
ok("migration: directional word gets slide-in (position + opacity)", () => {
  const w: Word = { ...staticWord, text: "Hi", x: 50, y: 60, enterFrom: "left" };
  const m = migrateWord(w);
  assert.ok(m.keyframes?.position, "position track created");
  assert.ok(m.keyframes?.opacity, "opacity track created");
  // starts offset to the LEFT of its target, ends at target.
  assert.equal(m.keyframes!.position![0].value.x, 50 - 80);
  assert.equal(m.keyframes!.position![0].value.y, 60);
  assert.deepEqual(m.keyframes!.position![1].value, { x: 50, y: 60 });
  assert.equal(m.keyframes!.opacity![0].value, 0);
  assert.equal(m.keyframes!.opacity![1].value, 1);
  assert.equal(m.enterFrom, "left", "enterFrom preserved as a hint");
});

ok("migration: enterFrom 'none' → fade only (no position track)", () => {
  const m = migrateWord({ ...staticWord, enterFrom: "none" });
  assert.ok(m.keyframes?.opacity, "opacity track");
  assert.ok(!m.keyframes?.position, "no position track for 'none'");
});

ok("migration is idempotent (already-keyframed word untouched)", () => {
  const m1 = migrateWord({ ...staticWord, enterFrom: "left", x: 0, y: 0 });
  const m2 = migrateWord(m1);
  assert.deepEqual(m2, m1, "second migration is a no-op");
});

ok("migrateTimeline animates every legacy word; serialize emits keyframes", () => {
  // A LEGACY-shaped timeline (top-level background + scene.video) — this is the
  // exact migration input. Typed loosely so the legacy fields are allowed.
  const tl = {
    fps: 30,
    width: 1080,
    height: 1920,
    background: "#000",
    audio: null,
    scenes: [{ id: "s1", durationInFrames: 60, video: null, words: [staticWord, { ...staticWord, enterFrom: "right" }] }],
  };
  const migrated = migrateTimeline(tl as Parameters<typeof migrateTimeline>[0]);
  const out = serializeTimeline(migrated);
  assert.ok(out.scenes[0].words[0].keyframes, "word 0 animated");
  assert.ok(out.scenes[0].words[1].keyframes?.position, "word 1 slides in");
});

// ---- Step 0 guard: Word.stroke + Word.shadow survive writeTimeline (serialize) ----
// Fix A added stroke/shadow to the schema, but the Word serializer rebuilds key-by-key
// (a whitelist), so without io.ts touching them they'd be DROPPED on write → captions
// would lose every accent. Prove a write→read survives deep-equal.
ok("Word.stroke + Word.shadow survive serialize (write) deep-equal", () => {
  const accented: Word = {
    text: "желанной",
    start: 100,
    end: 160,
    x: 0,
    y: 200,
    font: "condensedHeavy",
    size: 36,
    weight: 700,
    color: "#b0223a",
    enterFrom: "none",
    case: "none",
    stroke: { color: "#ffffff", width: 2.5 },
    shadow: [
      { y: 4, blur: 18, color: "rgba(0,0,0,0.6)" }, // depth shadow (no x)
      { blur: 22, color: "rgba(170,35,55,0.4)" }, // pure glow (no x/y)
    ],
  };
  const out = serializeWord(accented);
  assert.ok(out.stroke, "stroke survived the write");
  assert.deepEqual(out.stroke, { color: "#ffffff", width: 2.5 });
  assert.ok(Array.isArray(out.shadow), "shadow survived the write");
  assert.deepEqual(out.shadow, accented.shadow);
  // Whole-word deep-equal (the real round-trip guarantee).
  assert.deepEqual(out, accented);
  // Idempotent.
  assert.deepEqual(serializeWord(out), out);
});

ok("no-accent word still round-trips WITHOUT stroke/shadow keys (pixel-gate)", () => {
  const out = serializeWord(staticWord);
  assert.ok(!("stroke" in out), "no stroke key when absent");
  assert.ok(!("shadow" in out), "no shadow key when absent");
  assert.deepEqual(out, staticWord);
});

console.log(`\n${passed} IO/migration checks passed`);
