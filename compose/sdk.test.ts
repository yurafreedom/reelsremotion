// SDK self-test (node assert). Verifies the SDK emits CONTRACT-valid, round-trip-
// stable timelines with WORD-RELATIVE keyframes. Run: node compose/run.mjs compose/sdk.test.ts

import assert from "node:assert";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  createTimeline,
  addScene,
  addWord,
  setTransition,
  setAudio,
  enableDucking,
  revealWordByWord,
  emphasize,
  findWord,
  slideIn,
  moveAlong,
  fadeOut,
  writeTimeline,
  importTimeline,
} from "./index";
import { validateTimeline, serializeTimeline } from "./io";
import { totalDurationInFrames } from "@engine/compose";

let n = 0;
const ok = (msg: string) => {
  n++;
  console.log(`  ok ${n} - ${msg}`);
};

// ---- 1. Minimal timeline is valid ----
{
  const t = createTimeline();
  const s = addScene(t, { durationInFrames: 90 });
  addWord(s, { text: "ОНА", start: 0, end: 90, x: 0, y: -200 });
  assert.deepEqual(validateTimeline(serializeTimeline(t)), []);
  assert.equal(t.width, 1080);
  assert.equal(t.height, 1920);
  ok("minimal timeline validates");
}

// ---- 2. Round-trip deep-equal through serialize ----
{
  const t = createTimeline();
  const s = addScene(t, { durationInFrames: 120 });
  revealWordByWord(s, ["ОНА", "не требует", "СВЕРХ", "меры"], { stagger: 12 });
  emphasize(findWord(s, "СВЕРХ"), "punch-red");
  setTransition(t, 0, { type: "fade", duration: 15 });
  setAudio(t, { src: "music.mp3", fadeOutFrames: 150 });
  enableDucking(t, {});
  const once = serializeTimeline(t);
  const twice = serializeTimeline(once);
  assert.deepEqual(twice, once, "serialize is idempotent (round-trips)");
  assert.deepEqual(validateTimeline(once), []);
  ok("representative reel round-trips & validates");
}

// ---- 3. Keyframes are WORD-RELATIVE (start at 0, within [0, len]) ----
{
  const t = createTimeline();
  const s = addScene(t, { durationInFrames: 100 });
  const w = addWord(s, { text: "X", start: 30, end: 80, x: 0, y: 0 });
  slideIn(w, { from: "left", duration: 12 });
  fadeOut(w, { duration: 10 });
  const len = w.end - w.start; // 50
  for (const track of Object.values(w.keyframes!)) {
    for (const kf of track as { frame: number }[]) {
      assert.ok(kf.frame >= 0, "kf frame >= 0 (word-relative)");
      assert.ok(kf.frame <= len, `kf frame ${kf.frame} <= len ${len}`);
    }
  }
  // opacity track merged slideIn (0,12) + fadeOut (len-10, len) into one sorted track
  const op = w.keyframes!.opacity!;
  assert.equal(op[0].frame, 0);
  assert.equal(op[op.length - 1].frame, len);
  assert.ok(op.every((k, i) => i === 0 || k.frame >= op[i - 1].frame), "opacity sorted");
  ok("keyframes are word-relative and merge-sorted");
}

// ---- 4. curved moveAlong emits spatial tangents ----
{
  const t = createTimeline();
  const s = addScene(t, { durationInFrames: 60 });
  const w = addWord(s, { text: "fly", start: 0, end: 60, x: -200, y: 0 });
  moveAlong(w, [{ x: -200, y: 0 }, { x: 0, y: -100 }, { x: 200, y: 0 }], { curved: true });
  const pos = w.keyframes!.position!;
  assert.equal(pos.length, 3);
  assert.ok(pos[1].spatialIn && pos[1].spatialOut, "middle point has both tangents");
  assert.deepEqual(validateTimeline(serializeTimeline(t)), []);
  ok("curved moveAlong emits spatial tangents");
}

// ---- 5. write → import round-trip on disk ----
{
  const t = createTimeline();
  const s = addScene(t, { durationInFrames: 90 });
  revealWordByWord(s, ["a", "b", "c"]);
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sdk-")), "timeline.json");
  writeTimeline(t, p);
  const back = importTimeline(p);
  assert.deepEqual(serializeTimeline(back), serializeTimeline(t), "disk round-trip stable");
  assert.ok(totalDurationInFrames(back) >= 1);
  ok("write → import is stable on disk");
}

console.log(`\nAll ${n} SDK checks passed.`);
