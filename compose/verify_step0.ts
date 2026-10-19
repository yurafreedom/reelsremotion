// Step 0 proof: a Word with stroke+shadow must survive serializeTimeline (writeTimeline)
// round-trip deep-equal. Run: node compose/run.mjs compose/verify_step0.ts
import { serializeTimeline, validateTimeline } from "../editor/src/io";
import type { Timeline, Word } from "@engine/types";

const word: Word = {
  text: "желанной", start: 30, end: 90, x: 0, y: 400,
  font: "playfairItalic", size: 108, weight: 700, color: "#b0223a",
  enterFrom: "none", case: "none",
  stroke: { color: "#ffffff", width: 6 },
  shadow: [
    { y: 5, blur: 24, color: "rgba(0,0,0,0.55)" },
    { blur: 32, color: "rgba(255,255,255,0.55)" },
  ],
};

const t: Timeline = {
  fps: 30, width: 1080, height: 1920, audio: null,
  scenes: [{ id: "s1", durationInFrames: 120, background: { type: "color", color: "#000" }, words: [word] }],
};

const round = serializeTimeline(t);
const errs = validateTimeline(round);
const w2 = round.scenes[0].words[0];
const strokeOk = JSON.stringify(w2.stroke) === JSON.stringify(word.stroke);
const shadowOk = JSON.stringify(w2.shadow) === JSON.stringify(word.shadow);
console.log("validate errs:", errs.length ? errs : "none");
console.log("stroke survived:", strokeOk, JSON.stringify(w2.stroke));
console.log("shadow survived:", shadowOk, JSON.stringify(w2.shadow));
if (!strokeOk || !shadowOk || errs.length) {
  console.error("STEP 0 FAIL");
  process.exit(1);
}
console.log("STEP 0 OK — stroke + shadow round-trip deep-equal");
