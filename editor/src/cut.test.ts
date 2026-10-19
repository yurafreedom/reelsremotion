// Node-assert tests for CUT / DELETE-ripple (v3 tracks) + the engine's seamless
// coalescing. Guards the v3.6 fix: a cut must produce contiguous, source-seamless
// pieces that render as ONE continuous video element (no preview black / lost audio),
// speechRegions split per piece, and deleting a clip closes the gap on its track.
// Run from repo root:
//   node_modules/.bin/esbuild editor/src/cut.test.ts --bundle \
//     --platform=node --format=cjs --alias:@engine=./src | node

import assert from "node:assert/strict";
import type { TimelineV3, VideoClip } from "@engine/types.v3";
import { coalesceBgClips, isSeamlessVideoContinuation } from "@engine/coalesce";
import { cutClip, cutAudioClip, deleteClip } from "./edits";

let passed = 0;
const ok = (label: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  PASS  ${label}`);
};

const videoTrack = (tl: TimelineV3) =>
  tl.tracks.find((t): t is Extract<typeof t, { kind: "video" }> => t.kind === "video")!;
const audioTrack = (tl: TimelineV3) =>
  tl.tracks.find((t): t is Extract<typeof t, { kind: "audio" }> => t.kind === "audio")!;

const baseTl = (): TimelineV3 => ({
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 120,
  tracks: [
    {
      id: "v",
      kind: "video",
      clips: [
        {
          id: "c",
          kind: "video",
          src: "media/reels-video.mp4",
          start: 0,
          end: 120,
          startFrom: 0,
          fit: "cover",
          speechRegions: [
            { startFrame: 10, endFrame: 50 },
            { startFrame: 70, endFrame: 110 },
          ],
        } as VideoClip,
      ],
    },
    { id: "a", kind: "audio", clips: [{ id: "m", src: "media/music.mp3", start: 0, end: 120, startFrom: 0, volume: 1 }] },
  ],
});

ok("cut: contiguous + source-seamless pieces", () => {
  const vt = videoTrack(cutClip(baseTl(), "v", 0, 60));
  const [a, b] = vt.clips as VideoClip[];
  assert.equal(vt.clips.length, 2, "two pieces");
  assert.equal(b.start, a.end, "piece2.start === piece1.end (no gap)");
  assert.equal(a.end, 60, "join at F");
  assert.equal(b.startFrom, a.startFrom + (a.end - a.start), "source continues across the cut");
});

ok("cut: speechRegions split per piece (clamped to own range)", () => {
  const [a, b] = videoTrack(cutClip(baseTl(), "v", 0, 60)).clips as VideoClip[];
  assert.deepEqual(a.speechRegions, [{ startFrame: 10, endFrame: 50 }], "A keeps its region");
  assert.deepEqual(b.speechRegions, [{ startFrame: 70, endFrame: 110 }], "B keeps its region");
});

ok("cut: a region straddling the cut is split at F", () => {
  const tl = baseTl();
  (videoTrack(tl).clips[0] as VideoClip).speechRegions = [{ startFrame: 40, endFrame: 80 }];
  const [a, b] = videoTrack(cutClip(tl, "v", 0, 60)).clips as VideoClip[];
  assert.deepEqual(a.speechRegions, [{ startFrame: 40, endFrame: 60 }], "A half");
  assert.deepEqual(b.speechRegions, [{ startFrame: 60, endFrame: 80 }], "B half");
});

ok("engine: cut pieces coalesce back into ONE continuous element", () => {
  const vt = videoTrack(cutClip(baseTl(), "v", 0, 60));
  const merged = coalesceBgClips(vt.clips);
  assert.equal(merged.length, 1, "one element across the cut");
  assert.equal(merged[0].start, 0, "spans from 0");
  assert.equal(merged[0].end, 120, "spans to end");
  assert.equal((merged[0] as VideoClip).startFrom, 0, "keeps source in-point");
});

ok("engine: coalesce guards — only true seamless hard-cut runs merge", () => {
  const a = { id: "a", kind: "video", src: "x.mp4", start: 0, end: 60, startFrom: 0, fit: "cover" } as VideoClip;
  const seamless = { id: "b", kind: "video", src: "x.mp4", start: 60, end: 120, startFrom: 60, fit: "cover" } as VideoClip;
  assert.equal(coalesceBgClips([a, seamless]).length, 1, "seamless merges");
  assert.equal(coalesceBgClips([a, { ...seamless, startFrom: 999 }]).length, 2, "wrong startFrom does not merge");
  assert.equal(coalesceBgClips([a, { ...seamless, src: "y.mp4" }]).length, 2, "different src does not merge");
  assert.equal(coalesceBgClips([a, { ...seamless, start: 70 }]).length, 2, "a gap does not merge");
  const withTr = { ...a, transitionToNext: { type: "fade" as const, durationInFrames: 10 } };
  assert.equal(coalesceBgClips([withTr, seamless]).length, 2, "transition join does not merge");
});

ok("delete: ripple closes the gap on that track (cut-out-and-join)", () => {
  let tl = cutClip(baseTl(), "v", 0, 40); // [0,40) [40,120)
  tl = cutClip(tl, "v", 1, 80); // [0,40) [40,80) [80,120)
  assert.equal(videoTrack(tl).clips.length, 3, "three pieces");
  const vt = videoTrack(deleteClip(tl, "v", 1)); // remove the middle [40,80)
  assert.equal(vt.clips.length, 2, "two remain");
  assert.equal(vt.clips[0].end, vt.clips[1].start, "gap closed (contiguous)");
  assert.equal(vt.clips[1].end, 80, "later clip rippled left by removed duration");
  assert.ok(
    !isSeamlessVideoContinuation(vt.clips[0], vt.clips[1]),
    "cut-out middle leaves a deliberate jump cut (source discontinuous), not a false merge"
  );
});

ok("delete: other tracks are NOT rippled", () => {
  let tl = cutClip(baseTl(), "v", 0, 60);
  tl = deleteClip(tl, "v", 0); // remove first video piece
  assert.deepEqual(
    audioTrack(tl).clips.map((c) => [c.start, c.end]),
    [[0, 120]],
    "audio track untouched by video-track ripple"
  );
});

ok("audio cut: contiguous + source-seamless", () => {
  const at = audioTrack(cutAudioClip(baseTl(), "a", 0, 60));
  assert.equal(at.clips[1].start, at.clips[0].end, "contiguous");
  assert.equal(at.clips[1].startFrom, at.clips[0].startFrom + 60, "source continues");
});

console.log(`\n${passed} cut/coalesce/ripple checks passed`);
