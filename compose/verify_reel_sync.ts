// Step 4 sync check — render a still at each chunk's tStart (settled ~0.25s in) so
// CC can confirm the correct line is on screen exactly when its English phrase is
// spoken. Lays the 26 stills out as one contact sheet and prints a legend mapping
// tile → chunk#, tStart, RU text, and the first EN onset word.
//   node compose/run.mjs compose/verify_reel_sync.ts

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { checkFrame } from "./check";
import type { CaptionChunkTimed } from "./index";

const require = createRequire(import.meta.url);
const TL = "public/timeline_reel.json";
const FPS = 30;

const chunks = JSON.parse(readFileSync("compose/chunks_timed.json", "utf8")) as CaptionChunkTimed[];
const asr = JSON.parse(readFileSync("compose/asr_words.json", "utf8")) as {
  words: { word: string; start: number }[];
};
const enAt = (t: number) =>
  asr.words.reduce((b, w) => (Math.abs(w.start - t) < Math.abs(b.start - t) ? w : b), asr.words[0]);

(async () => {
  const dir = path.resolve("scratch_check");
  const tiles: { file: string; i: number }[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    // Settle ~0.25s into the chunk, but never past 80% of its window.
    const tShow = Math.min(c.tStart + 0.25, c.tStart + 0.8 * (c.tEnd - c.tStart));
    const file = path.join(dir, `sync_${String(i).padStart(2, "0")}.png`);
    await checkFrame(TL, Math.round(tShow * FPS), { out: file });
    tiles.push({ file, i });
  }

  // Compose a 5-col contact sheet with sharp.
  const sharp = require("sharp") as unknown as (input?: Buffer | string | { create: unknown }) => {
    resize: (w: number, h: number) => { toBuffer: () => Promise<Buffer> };
    composite: (c: unknown[]) => { png: () => { toFile: (p: string) => Promise<unknown> } };
  };
  const cols = 5;
  const thumbW = 216;
  const thumbH = Math.round((thumbW * 1920) / 1080);
  const rows = Math.ceil(tiles.length / cols);
  const composites = await Promise.all(
    tiles.map(async (t) => ({
      input: await sharp(t.file).resize(thumbW, thumbH).toBuffer(),
      left: (t.i % cols) * thumbW,
      top: Math.floor(t.i / cols) * thumbH,
    }))
  );
  const out = path.resolve("scratch_check/reel_sync_sheet.png");
  await sharp({ create: { width: cols * thumbW, height: rows * thumbH, channels: 3, background: "#1a0d10" } })
    .composite(composites)
    .png()
    .toFile(out);

  console.log(`\nreel_sync_sheet → ${out}\n`);
  console.log("tile  tStart  RU  (≈EN onset)");
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const ru = c.words.map((w) => w.text).join(" ");
    const en = enAt(c.tStart).word;
    console.log(`${String(i).padStart(2)}   ${c.tStart.toFixed(2)}s  ${ru}   (≈"${en}")`);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
