// Step 3 verification — throwaway scene exercising revealCaptionChunksTimed.
// Confirms the snappy speech-paced reveal: a word is SHARP within ~3 frames of its
// onset (fast pop, no de-blur), HOLDS dead-still (no upward drift), then CLEARS
// fast at tEnd. Also checks the big-"A" overshoot punch and the m<n even-spacing
// fallback. Run: node compose/run.mjs compose/verify_step3.ts
//
// Stills (30fps):
//   pop1   f1  — word0 mid-pop (~1 frame in, still rising in opacity/scale)
//   pop3   f3  — word0 SHARP (full opacity + full size, no blur)
//   hold   f25 — all 3 words settled, HOLDING (compare y to pop3 → must NOT drift)
//   clear  f33 — chunk A cleared, chunk B word0 popping in
//   accent f56 — chunk B big-"A" word popped with overshoot

import {
  createTimeline,
  addScene,
  colorBackground,
  revealCaptionChunksTimed,
  type CaptionChunkTimed,
  type CaptionStyle,
} from "./index";
import { checkFrame } from "./check";

const STYLE_B: Record<"n" | "s" | "a" | "A", CaptionStyle> = {
  n: { font: "condensedHeavy", size: 78, weight: 500, color: "#f7f5f3", case: "upper",
       shadow: [{ y: 3, blur: 20, color: "rgba(0,0,0,0.6)" }] },
  s: { font: "condensedHeavy", size: 87, weight: 700, color: "#f7f5f3", case: "upper",
       shadow: [{ y: 3, blur: 20, color: "rgba(0,0,0,0.65)" }] },
  a: { font: "playfairItalic", size: 96, weight: 600, color: "#a01f33", case: "none",
       stroke: { color: "#ffffff", width: 5 },
       shadow: [{ y: 4, blur: 20, color: "rgba(0,0,0,0.55)" }, { blur: 26, color: "rgba(255,255,255,0.5)" }] },
  A: { font: "playfairItalic", size: 108, weight: 700, color: "#b0223a", case: "none",
       stroke: { color: "#ffffff", width: 6 },
       shadow: [{ y: 5, blur: 24, color: "rgba(0,0,0,0.55)" }, { blur: 32, color: "rgba(255,255,255,0.55)" }] },
};

// chunk A: 3 words / 3 onsets (each word pops on its own onset).
// chunk B: 4 words / 2 onsets → m<n even-spacing fallback; last word is "A" accent.
const CH: CaptionChunkTimed[] = [
  { tStart: 0.0, tEnd: 1.0, onsets: [0.0, 0.3, 0.6], words: [
    { text: "он", style: "n" }, { text: "показал", style: "n" }, { text: "переписку", style: "n" } ] },
  { tStart: 1.0, tEnd: 2.0, onsets: [1.0, 1.5], words: [
    { text: "но", style: "n" }, { text: "всё", style: "n" }, { text: "быстро", style: "n" }, { text: "рухнуло", style: "A" } ] },
];

const t = createTimeline({ fps: 30 });
const scene = addScene(t, { durationInFrames: 60, background: colorBackground("#241015") });
revealCaptionChunksTimed(scene, CH, { fps: 30, totalSec: 2.0, styleMap: STYLE_B, centerY: 0, maxLineWidth: 900 });

(async () => {
  await checkFrame(t, 1,  { out: "step3_pop1.png" });
  await checkFrame(t, 3,  { out: "step3_pop3.png" });
  await checkFrame(t, 25, { out: "step3_hold.png" });
  await checkFrame(t, 33, { out: "step3_clear.png" });
  await checkFrame(t, 56, { out: "step3_accent.png" });
  console.log("step3 stills rendered");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
