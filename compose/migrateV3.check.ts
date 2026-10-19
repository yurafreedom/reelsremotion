// v2 (scenes) → v3 (tracks) migration check. Asserts the absolute-axis migration
// is lossless and drift-free — the structural half of the v3 gate (the pixel half
// is the SSIM render comparison). Run: node compose/run.mjs compose/migrateV3.check.ts
import assert from "node:assert";
import * as fs from "node:fs";
import { migrateV2toV3 } from "@engine/migrateV3";
import { sceneOffsets, speechRegionsAbsolute, totalDurationInFrames } from "@engine/compose";
import { migrateTimeline } from "@engine/presets";

// Merge a clip's already-absolute speechRegions the same way the engine
// (Video.tsx unionSpeechRegions) does — to prove the ducking mask is unchanged.
const mergeAbs = (clips: any[]) => {
  const regions: { start: number; end: number }[] = [];
  for (const c of clips) {
    if (c.kind === "video" && c.speechRegions) {
      for (const r of c.speechRegions) regions.push({ start: r.startFrame, end: r.endFrame });
    }
  }
  regions.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const r of regions) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
};

// Bring any fixture to the v2.2 scene model (handles v2.0 legacy: top-level
// background + scene.video inset → per-scene background union).
const loadV22 = (p: string) => migrateTimeline(JSON.parse(fs.readFileSync(p, "utf8")));

const deepEqual = (a: unknown, b: unknown) => assert.deepEqual(a, b);

const checkFixture = (path: string) => {
  const v2: any = loadV22(path);
  const offsets = sceneOffsets(v2);
  const expectedDuration = totalDurationInFrames(v2);
  const v3: any = migrateV2toV3(v2);

  // ── Top-level shape ──────────────────────────────────────────────────────
  assert.ok(Array.isArray(v3.tracks), `${path}: has tracks[]`);
  assert.ok(!("scenes" in v3), `${path}: no scenes[]`);
  assert.equal(v3.fps, v2.fps, `${path}: fps preserved`);
  assert.equal(v3.width, v2.width, `${path}: width preserved`);
  assert.equal(v3.height, v2.height, `${path}: height preserved`);
  assert.equal(
    v3.durationInFrames,
    expectedDuration,
    `${path}: durationInFrames === totalDurationInFrames(v2)`
  );

  // ── z-order: video → image → shape → text → audio (only present ones) ─────
  const kinds = v3.tracks.map((t: any) => t.kind);
  const zRank: Record<string, number> = { video: 0, image: 1, shape: 2, text: 3, audio: 4 };
  for (let i = 1; i < kinds.length; i++) {
    assert.ok(zRank[kinds[i]] > zRank[kinds[i - 1]], `${path}: track z-order ${kinds[i - 1]}→${kinds[i]}`);
  }

  const textTrack = v3.tracks.find((t: any) => t.kind === "text");
  const shapeTrack = v3.tracks.find((t: any) => t.kind === "shape");
  const videoTrack = v3.tracks.find((t: any) => t.kind === "video");
  const imageTrack = v3.tracks.find((t: any) => t.kind === "image");

  // ── Words: absolute timings = scene offset + scene-relative; keyframes intact
  let w = 0;
  v2.scenes.forEach((scene: any, i: number) => {
    const off = offsets[i];
    for (const sw of scene.words) {
      const mw = textTrack.words[w++];
      assert.equal(mw.start, off + sw.start, `${path}: word "${sw.text}" start absolute`);
      assert.equal(mw.end, off + sw.end, `${path}: word "${sw.text}" end absolute`);
      assert.equal(mw._scene, i, `${path}: word "${sw.text}" tagged scene ${i}`);
      // Keyframes are UNTOUCHED (element-relative; same object content).
      deepEqual(mw.keyframes, sw.keyframes);
    }
  });
  if (textTrack) assert.equal(textTrack.words.length, w, `${path}: word count preserved`);

  // ── Shapes: same rebase + tag; keyframe frames untouched ─────────────────
  let s = 0;
  v2.scenes.forEach((scene: any, i: number) => {
    const off = offsets[i];
    for (const ss of scene.shapes ?? []) {
      const ms = shapeTrack.shapes[s++];
      assert.equal(ms.start, off + ss.start, `${path}: shape ${ss.id} start absolute`);
      assert.equal(ms.end, off + ss.end, `${path}: shape ${ss.id} end absolute`);
      assert.equal(ms._scene, i, `${path}: shape ${ss.id} tagged scene ${i}`);
      deepEqual(ms.keyframes, ss.keyframes);
    }
  });

  // ── Backgrounds → one clip per scene, full [off, off+dur] range ──────────
  const bgClips = [...(videoTrack?.clips ?? []), ...(imageTrack?.clips ?? [])].sort(
    (a: any, b: any) => a.start - b.start
  );
  assert.equal(bgClips.length, v2.scenes.length, `${path}: one bg clip per scene`);
  v2.scenes.forEach((scene: any, i: number) => {
    const clip = bgClips[i];
    assert.equal(clip.start, offsets[i], `${path}: scene ${i} bg start`);
    assert.equal(clip.end, offsets[i] + scene.durationInFrames, `${path}: scene ${i} bg end (full range)`);
    // transitionToNext lands on the bg clip.
    if (scene.transitionToNext) {
      deepEqual(clip.transitionToNext, scene.transitionToNext);
    }
    // speechRegions re-based to absolute EXACTLY ONCE (+offset).
    const srcRegions =
      scene.background.type === "cover" || scene.background.type === "box"
        ? scene.background.speechRegions
        : undefined;
    if (srcRegions) {
      const expected = srcRegions.map((r: any) => ({
        startFrame: offsets[i] + r.startFrame,
        endFrame: offsets[i] + r.endFrame,
      }));
      deepEqual(clip.speechRegions, expected);
    }
  });

  // ── Box geometry preserved losslessly (additive VideoClip fields) ─────────
  v2.scenes.forEach((scene: any, i: number) => {
    if (scene.background.type === "box") {
      const clip = bgClips[i];
      const b = scene.background;
      assert.equal(clip.fit, "contain", `${path}: box → fit:contain`);
      assert.equal(clip.x, b.x, `${path}: box x preserved`);
      assert.equal(clip.y, b.y, `${path}: box y preserved`);
      assert.equal(clip.width, b.width, `${path}: box width preserved`);
      assert.equal(clip.height, b.height, `${path}: box height preserved`);
      assert.equal(clip.borderRadius, b.borderRadius, `${path}: box radius preserved`);
      assert.equal(clip.backColor, b.backColor, `${path}: box backColor preserved`);
    }
  });

  // ── Audio → single clip spanning the reel, fades/ducking preserved ───────
  const audioTrack = v3.tracks.find((t: any) => t.kind === "audio");
  if (v2.audio) {
    assert.ok(audioTrack, `${path}: audio track present`);
    assert.equal(audioTrack.clips.length, 1, `${path}: single audio clip`);
    const ac = audioTrack.clips[0];
    assert.equal(ac.start, 0, `${path}: audio starts at 0`);
    assert.equal(ac.end, expectedDuration, `${path}: audio spans whole reel`);
    assert.equal(ac.startFrom, 0, `${path}: audio startFrom 0`);
    assert.equal(ac.volume, v2.audio.volume, `${path}: audio volume preserved`);
    deepEqual(ac.ducking, v2.audio.ducking);
    // Ducking mask parity: the v3 engine's union of video clips' (absolute)
    // speechRegions must equal the v2 engine's speechRegionsAbsolute. With the
    // same musicVolumeAt + clip.start=0, the per-frame volume is byte-identical.
    deepEqual(mergeAbs(bgClips), speechRegionsAbsolute(v2));
  } else {
    assert.ok(!audioTrack, `${path}: no audio track when no audio`);
  }

  // ── Idempotency: a v3 input returns unchanged ─────────────────────────────
  assert.ok(migrateV2toV3(v3) === v3, `${path}: idempotent`);

  console.log(
    `OK ${path} → dur=${v3.durationInFrames} tracks=[${kinds.join(",")}] bgClips=${bgClips.length}`
  );
};

for (const f of [
  "public/timeline_v22.json", // v2.2: color/image/cover/box + fade transition + shape
  "public/timeline_audio.json", // v2.0 legacy: AudioTrack + ducking + inset speechRegions
  "public/timeline.json", // v2.0 legacy: inset model, no `case`
  "public/timeline2.json", // v2.0 legacy: transition
]) {
  checkFixture(f);
}

console.log("OK — v2→v3 migration is lossless, absolute, drift-free, idempotent.");
