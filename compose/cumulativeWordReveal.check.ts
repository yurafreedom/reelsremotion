import fs from "node:fs";
import { cumulativeWordOpacity } from "../src/cumulativeWordReveal";
import type { TimelineV3, Word } from "../src/types.v3";

const timelinePath = process.argv[2];
if (!timelinePath) throw new Error("usage: cumulativeWordReveal.check.ts <timeline.json>");
const timeline = JSON.parse(fs.readFileSync(timelinePath, "utf8")) as TimelineV3;
const words = timeline.tracks.find((track) => track.kind === "text")?.words ?? [];

const native = words.find((word) => word.timingType === "SOURCE_WORD_TIMESTAMPS" && (word.wordReveals?.length ?? 0) >= 3) as Word | undefined;
if (!native?.wordReveals) throw new Error("native cumulative phrase missing");
const target = native.wordReveals[2];
if (cumulativeWordOpacity(target.revealFrame - 1, target.revealFrame, native.revealFadeFrames) !== 0) {
  throw new Error("native token visible before reveal");
}
if (!(cumulativeWordOpacity(target.revealFrame, target.revealFrame, native.revealFadeFrames) > 0)) {
  throw new Error("native token not visible at reveal");
}
for (const prior of native.wordReveals.slice(0, 2)) {
  if (!(cumulativeWordOpacity(target.revealFrame, prior.revealFrame, native.revealFadeFrames) > 0)) {
    throw new Error("previous native token did not remain visible");
  }
}

const translated = words.filter((word) => word.timingType === "DERIVED_VISUAL_REVEAL");
if (!translated.length) throw new Error("translated cumulative phrase missing");
for (const word of translated) {
  if (word.notAcousticWordAlignment !== true || word.revealMode !== "cumulative-word") {
    throw new Error(`translated timing provenance invalid: ${word.text}`);
  }
  const frames = word.wordReveals?.map((token) => token.revealFrame) ?? [];
  if (!frames.every((frame) => frame >= word.start && frame < word.end)) {
    throw new Error(`translated reveal outside phrase interval: ${word.text}`);
  }
}
const translatedByWindow = new Map<string, number[]>();
for (const word of translated) {
  const key = `${word.start}:${word.end}`;
  translatedByWindow.set(key, [...(translatedByWindow.get(key) ?? []), ...(word.wordReveals?.map((token) => token.revealFrame) ?? [])]);
}
for (const [window, frames] of translatedByWindow) {
  if (!frames.every((frame, index) => index === 0 || frame > frames[index - 1])) {
    throw new Error(`translated reveal frames are not strictly increasing: ${window}`);
  }
}

console.log("CUMULATIVE_WORD_REVEAL_CHECK=PASS");
console.log(`NATIVE_TEST_PHRASE=${native.text}`);
console.log(`TRANSLATED_WINDOWS_CHECKED=${translatedByWindow.size}`);
console.log("LAYOUT_MODEL=FINAL_SPANS_ALWAYS_MOUNTED");
console.log("TRANSLATED_TIMING=DERIVED_VISUAL_REVEAL; NOT_ACOUSTIC_WORD_ALIGNMENT=YES");
