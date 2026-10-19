// Step 1 verification — throwaway scene exercising revealCaptionChunks with three
// representative chunks (plain / "a" accent / "A" accent) over a dark background.
// Renders stills at a reveal mid-point and a settled point so CC can eyeball:
// centered line, L→R reveal, burgundy accent w/ white outline + glow, big-accent
// overshoot, chunk fade-out. Run: node compose/run.mjs compose/verify_step1.ts

import {
  createTimeline,
  addScene,
  colorBackground,
  revealCaptionChunks,
  type CaptionChunk,
  type CaptionStyle,
} from "./index";
import { checkFrame } from "./check";

// 3× sizes — same maps the final build uses (Step 3 DATA), so this verify also
// proves the pattern at the real magnitudes.
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

const w = (...items: string[]) =>
  items.map((s) => {
    const sp = s.lastIndexOf(" ");
    return { text: s.slice(0, sp).replace(/_/g, " "), style: s.slice(sp + 1) as "n" | "s" | "a" | "A" };
  });

// 3 chunks @ 0.0 / 1.0 / 2.0s, totalSec 3.0 → 90 frames.
const CH: CaptionChunk[] = [
  { tSec: 0.0, words: w("он n","показал n","переписку n") },           // plain
  { tSec: 1.0, words: w("я n","думала, n","я n","тебе n","нравлюсь a") }, // "a" accent (wraps)
  { tSec: 2.0, words: w("но n","всё n","быстро n","рухнуло A") },        // "A" accent overshoot
];

const t = createTimeline({ fps: 30 });
const scene = addScene(t, { durationInFrames: 90, background: colorBackground("#241015") });
revealCaptionChunks(scene, CH, { fps: 30, totalSec: 3.0, styleMap: STYLE_B, centerY: 0, maxLineWidth: 900 });

(async () => {
  // chunk 0 mid-reveal (~f7), chunk 0 settled (~f24),
  // chunk 1 settled (~f50, the "a" accent wrapped line),
  // chunk 2 reveal mid (~f63) + settled (~f80, the "A" overshoot).
  await checkFrame(t, 7,  { out: "step1_c0_reveal.png" });
  await checkFrame(t, 24, { out: "step1_c0_settled.png" });
  await checkFrame(t, 50, { out: "step1_c1_accent.png" });
  await checkFrame(t, 63, { out: "step1_c2_reveal.png" });
  await checkFrame(t, 80, { out: "step1_c2_overshoot.png" });
  console.log("step1 stills rendered");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
