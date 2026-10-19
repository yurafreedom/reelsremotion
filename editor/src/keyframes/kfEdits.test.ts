// Node-assert tests for keyframe edit operations (v3 tracks). Run from repo root:
//   node_modules/.bin/esbuild editor/src/keyframes/kfEdits.test.ts --bundle \
//     --platform=node --format=cjs --alias:@engine=./src | node

import assert from "node:assert/strict";
import type { Word } from "@engine/types";
import type { TimelineV3 } from "@engine/types.v3";
import { textTrackOf } from "@engine/types.v3";
import {
  addKeyframeFromCurrent,
  applyPreset,
  copyKeyframes,
  deleteKeys,
  deleteTrack,
  moveKey,
  pasteKeyframes,
  setEasing,
  setPositionKey,
  setScalarKey,
  setSpatialTangent,
} from "./kfEdits";

let passed = 0;
const ok = (label: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  PASS  ${label}`);
};

const baseWord = (over: Partial<Word> = {}): Word => ({
  text: "W",
  start: 10,
  end: 70,
  x: 40,
  y: 20,
  font: "cleanSans",
  size: 50,
  weight: 400,
  color: "#ffffff",
  enterFrom: "none",
  ...over,
});

// v3: words live on a single text track; addressed by index alone.
const mkTl = (words: Word[]): TimelineV3 => ({
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 90,
  tracks: [{ id: "text", kind: "text", words }],
});
const words = (tl: TimelineV3): Word[] => textTrackOf(tl)!.words;

const ref = { wordIndex: 0 };

// ---- Add / immutability ----
ok("setScalarKey creates a track immutably; original unchanged", () => {
  const tl = mkTl([baseWord()]);
  const out = setScalarKey(tl, ref, "opacity", 0, 0);
  assert.equal(words(tl)[0].keyframes, undefined, "original untouched");
  assert.deepEqual(words(out)[0].keyframes?.opacity, [{ frame: 0, value: 0 }]);
});

ok("setScalarKey at same frame overwrites (no dupes), sorted insert", () => {
  let tl = mkTl([baseWord()]);
  tl = setScalarKey(tl, ref, "opacity", 10, 1, "easeOut");
  tl = setScalarKey(tl, ref, "opacity", 0, 0);
  tl = setScalarKey(tl, ref, "opacity", 10, 0.5); // overwrite frame 10
  const t = words(tl)[0].keyframes!.opacity!;
  assert.deepEqual(t.map((k) => k.frame), [0, 10], "sorted, deduped");
  assert.equal(t[1].value, 0.5, "overwritten value");
  assert.equal(t[1].easing, "easeOut", "easing preserved on overwrite");
});

ok("addKeyframeFromCurrent seeds from sampled/static value", () => {
  let tl = mkTl([baseWord({ size: 77 })]);
  tl = addKeyframeFromCurrent(tl, ref, "size", 5);
  assert.deepEqual(words(tl)[0].keyframes?.size, [{ frame: 5, value: 77 }]);
  tl = addKeyframeFromCurrent(tl, ref, "position", 0);
  assert.deepEqual(words(tl)[0].keyframes?.position?.[0].value, { x: 40, y: 20 });
});

// ---- Position + tangents ----
ok("setPositionKey + setSpatialTangent build a curved path", () => {
  let tl = mkTl([baseWord()]);
  tl = setPositionKey(tl, ref, 0, { x: -100, y: 0 });
  tl = setPositionKey(tl, ref, 20, { x: 100, y: 0 }, { easing: "easeInOut" });
  tl = setSpatialTangent(tl, ref, 0, "out", { x: 0, y: -80 });
  tl = setSpatialTangent(tl, ref, 1, "in", { x: 0, y: -80 });
  const t = words(tl)[0].keyframes!.position!;
  assert.deepEqual(t[0].spatialOut, { x: 0, y: -80 });
  assert.deepEqual(t[1].spatialIn, { x: 0, y: -80 });
  assert.equal(t[1].easing, "easeInOut");
});

// ---- Move / easing ----
ok("moveKey re-sorts and refuses frame collisions", () => {
  let tl = mkTl([baseWord()]);
  tl = setScalarKey(tl, ref, "rotation", 0, 0);
  tl = setScalarKey(tl, ref, "rotation", 10, 360);
  tl = moveKey(tl, ref, "rotation", 0, 8);
  assert.deepEqual(words(tl)[0].keyframes!.rotation!.map((k) => k.frame), [8, 10]);
  const collide = moveKey(tl, ref, "rotation", 0, 10);
  assert.deepEqual(words(collide)[0].keyframes!.rotation!.map((k) => k.frame), [8, 10]);
});

ok("setEasing supports presets and custom bezier", () => {
  let tl = mkTl([baseWord()]);
  tl = setScalarKey(tl, ref, "size", 0, 10);
  tl = setScalarKey(tl, ref, "size", 10, 50);
  tl = setEasing(tl, ref, "size", 1, { bezier: [0.2, 0.8, 0.3, 1] });
  assert.deepEqual(words(tl)[0].keyframes!.size![1].easing, { bezier: [0.2, 0.8, 0.3, 1] });
});

// ---- Delete / prune ----
ok("deleteKeys + deleteTrack prune empty → no `keyframes` key", () => {
  let tl = mkTl([baseWord()]);
  tl = setScalarKey(tl, ref, "blur", 0, 10);
  tl = setScalarKey(tl, ref, "blur", 5, 0);
  tl = deleteKeys(tl, ref, "blur", [1]);
  assert.deepEqual(words(tl)[0].keyframes!.blur, [{ frame: 0, value: 10 }]);
  tl = deleteKeys(tl, ref, "blur", [0]);
  assert.equal(words(tl)[0].keyframes, undefined, "pruned to keyframeless");

  let tl2 = mkTl([baseWord()]);
  tl2 = setScalarKey(tl2, ref, "opacity", 0, 0);
  tl2 = deleteTrack(tl2, ref, "opacity");
  assert.equal(words(tl2)[0].keyframes, undefined, "deleteTrack prunes");
});

// ---- Presets ----
ok("applyPreset merges generated tracks", () => {
  let tl = mkTl([baseWord({ enterFrom: "left" })]);
  tl = applyPreset(tl, ref, "slideIn");
  const kf = words(tl)[0].keyframes!;
  assert.ok(kf.position && kf.opacity, "slideIn made position + opacity");
  tl = applyPreset(tl, ref, "spin");
  assert.ok(words(tl)[0].keyframes!.rotation, "spin added rotation, kept others");
  assert.ok(words(tl)[0].keyframes!.position, "previous tracks preserved");
});

// ---- Copy / paste (element-relative, multi-target) ----
ok("copy whole word + paste onto another reproduces motion verbatim", () => {
  let tl = mkTl([baseWord(), baseWord({ x: 0, y: 0 })]);
  tl = setScalarKey(tl, ref, "opacity", 0, 0);
  tl = setScalarKey(tl, ref, "opacity", 12, 1, "easeOut");
  tl = setPositionKey(tl, ref, 0, { x: -50, y: 0 });
  tl = setPositionKey(tl, ref, 12, { x: 0, y: 0 });
  const clip = copyKeyframes(words(tl)[0])!;
  tl = pasteKeyframes(tl, [{ wordIndex: 1 }], clip);
  assert.deepEqual(words(tl)[1].keyframes, words(tl)[0].keyframes, "pasted set equals source");
});

ok("copy a single track + paste into MULTIPLE words", () => {
  let tl = mkTl([baseWord(), baseWord(), baseWord()]);
  tl = setScalarKey(tl, ref, "rotation", 0, 0);
  tl = setScalarKey(tl, ref, "rotation", 30, 720, "easeInOut");
  const clip = copyKeyframes(words(tl)[0], { property: "rotation" })!;
  tl = pasteKeyframes(tl, [{ wordIndex: 1 }, { wordIndex: 2 }], clip);
  for (const wi of [1, 2]) {
    assert.deepEqual(words(tl)[wi].keyframes!.rotation, [
      { frame: 0, value: 0 },
      { frame: 30, value: 720, easing: "easeInOut" },
    ]);
  }
});

ok("paste with offsetTo shifts the earliest kf to the playhead", () => {
  let tl = mkTl([baseWord(), baseWord()]);
  tl = setScalarKey(tl, ref, "opacity", 4, 0);
  tl = setScalarKey(tl, ref, "opacity", 16, 1);
  const clip = copyKeyframes(words(tl)[0], { property: "opacity" })!;
  tl = pasteKeyframes(tl, [{ wordIndex: 1 }], clip, 0);
  assert.deepEqual(words(tl)[1].keyframes!.opacity!.map((k) => k.frame), [0, 12], "shifted by -4");
});

ok("retiming-independence: keyframes are element-relative, not absolute", () => {
  let tl = mkTl([baseWord({ start: 5 }), baseWord({ start: 40 })]);
  tl = setScalarKey(tl, ref, "size", 0, 10);
  tl = setScalarKey(tl, ref, "size", 20, 80);
  const clip = copyKeyframes(words(tl)[0], { property: "size" })!;
  tl = pasteKeyframes(tl, [{ wordIndex: 1 }], clip);
  assert.deepEqual(words(tl)[1].keyframes!.size!.map((k) => k.frame), [0, 20], "frames independent of word.start");
});

console.log(`\n${passed} keyframe-edit checks passed`);
