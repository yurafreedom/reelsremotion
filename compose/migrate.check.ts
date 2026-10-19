// One-off migration check: load a LEGACY timeline (old top-level background +
// scene.video inset), migrate it, and assert the new per-scene background model
// with no data loss. Run: node compose/run.mjs compose/migrate.check.ts
import assert from "node:assert";
import * as fs from "node:fs";
import { migrateTimeline } from "@engine/presets";
import { serializeTimeline, validateTimeline } from "../editor/src/io";

const raw = JSON.parse(fs.readFileSync("public/timeline_audio.json", "utf8"));
console.log("legacy: top-level background =", raw.background, "| scene0.video?", !!raw.scenes[0].video);

const migrated = migrateTimeline(raw);
const out = serializeTimeline(migrated);

// No top-level background anymore.
assert.ok(!("background" in out), "top-level background removed");
// Every scene has a background union; none keeps a `video` field.
out.scenes.forEach((s, i) => {
  assert.ok(s.background && typeof s.background.type === "string", `scene ${i} has background union`);
  assert.ok(!("video" in s), `scene ${i} has no legacy video field`);
});

// The legacy inset became a box over the legacy timeline background color.
const s0 = raw.scenes[0];
if (s0.video) {
  const bg = out.scenes[0].background as { type: string; src: string; width: number; height: number; backColor: string; speechRegions?: unknown[] };
  assert.equal(bg.type, "box", "inset → box");
  assert.equal(bg.src, s0.video.src, "src preserved");
  assert.equal(bg.width, s0.video.width, "width preserved");
  assert.equal(bg.height, s0.video.height, "height preserved");
  assert.equal(bg.backColor, raw.background, "backColor = legacy timeline background");
  if (s0.video.speechRegions) {
    assert.deepEqual(bg.speechRegions, s0.video.speechRegions, "FROZEN speechRegions preserved");
  }
}

// Migrated timeline validates and re-serializes idempotently.
assert.deepEqual(validateTimeline(out), [], "migrated timeline validates");
assert.deepEqual(serializeTimeline(out), out, "migrated timeline round-trips");

console.log("OK — legacy timeline migrated to v2.2 model with no data loss.");
console.log("   scene backgrounds:", out.scenes.map((s) => s.background.type).join(", "));
