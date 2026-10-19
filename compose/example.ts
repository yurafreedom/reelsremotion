// Representative CC composition — "pull the strings" of the SDK. Builds a reel with
// revealWordByWord + emphasize('punch-red') + a transition + audio (fade-out +
// ducking) + a curved moveAlong, and writes it to public/timeline.json.
//
//   node compose/run.mjs compose/example.ts [outPath]
//
// Then self-check it with compose/check.ts (contactSheet / checkFrame) and render
// the full mp4 with: npx remotion render Reels out/example.mp4 \
//   --props=./public/timeline.json

import * as reel from "./index";

const out = process.argv[2] ?? "public/timeline.json";

const t = reel.createTimeline({ fps: 30 });

// --- Scene 1: the reveal + a red emphasis on СВЕРХ ---
const s1 = reel.addScene(t, { durationInFrames: 90 });
reel.revealWordByWord(
  s1,
  ["ОНА", "не требует", "СВЕРХ", "меры"],
  { fromSides: true, stagger: 12, baseStyle: { font: "condensedHeavy", size: 56, weight: 800, case: "upper" } }
);
reel.emphasize(reel.findWord(s1, "СВЕРХ"), "punch-red");

// --- Scene 2: a single line that flies in on a curved path ---
const s2 = reel.addScene(t, { durationInFrames: 75 });
const flyer = reel.addLine(s2, "ПРОСТО", {
  at: { x: 0, y: 0 },
  start: 0,
  style: { font: "condensedHeavy", size: 90, weight: 800, color: "#c0182a", case: "upper" },
});
reel.moveAlong(
  flyer,
  [
    { x: -360, y: 240 },
    { x: -120, y: -120 },
    { x: 0, y: 0 },
  ],
  { curved: true, easing: "easeInOut" }
);
reel.fadeIn(flyer, { duration: 8 });

// --- Transition between the two scenes ---
reel.setTransition(t, 0, { type: "fade", duration: 15 });

// --- Music: base level, fade out the tail, duck under speech ---
reel.setAudio(t, { src: "music.mp3", volume: 0.6, fadeOutFrames: 150 });
reel.enableDucking(t, {});

reel.writeTimeline(t, out);
console.log(`wrote ${out} — ${t.scenes.length} scenes, ${t.scenes.reduce((a, s) => a + s.words.length, 0)} words`);
