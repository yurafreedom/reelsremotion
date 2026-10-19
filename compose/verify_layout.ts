// Throwaway: render fully-revealed stills at accent-bearing moments to judge
// baseline alignment + gaps + block position. node compose/run.mjs compose/verify_layout.ts
import { createRequire } from "node:module";
import * as path from "node:path";
import { checkFrame } from "./check";
const require = createRequire(import.meta.url);
const TL = "public/timeline_reel.json";

// [absSec, label] — picked late in each chunk so ALL words are popped.
const SHOTS: [number, string][] = [
  [2.8, "drug_KRASIVYY_a"],     // друг — невероятно КРАСИВЫЙ (a)
  [6.4, "byl_ODERZHIM_A"],      // был ОДЕРЖИМ ею (A)
  [21.0, "ZHELANNOY_A_wrap"],   // «я не чувствую себя ЖЕЛАННОЙ (A, 2 lines)
  [25.5, "DOBYTCHIK_a"],        // ты явно ДОБЫТЧИК (a)
  [34.9, "ZHELANIE_A"],         // твоё ЖЕЛАНИЕ (A)
  [40.0, "PIKE_KARYERY_a"],     // на ПИКЕ КАРЬЕРЫ (a)
  [40.95, "PIKE_hold_late"],    // same chunk, near end — proves it still HOLDS
];

(async () => {
  const dir = path.resolve("scratch_check");
  const tiles: { file: string; i: number }[] = [];
  for (let i = 0; i < SHOTS.length; i++) {
    const [sec] = SHOTS[i];
    const file = path.join(dir, `lay_${String(i).padStart(2, "0")}.png`);
    await checkFrame(TL, Math.round(sec * 30), { out: file });
    tiles.push({ file, i });
  }
  const sharp = require("sharp") as unknown as (input?: Buffer | string | { create: unknown }) => {
    resize: (w: number, h: number) => { toBuffer: () => Promise<Buffer> };
    composite: (c: unknown[]) => { png: () => { toFile: (p: string) => Promise<unknown> } };
  };
  const cols = 4, thumbW = 260, thumbH = Math.round((thumbW * 1920) / 1080);
  const rows = Math.ceil(tiles.length / cols);
  const comps = await Promise.all(
    tiles.map(async (t) => ({
      input: await sharp(t.file).resize(thumbW, thumbH).toBuffer(),
      left: (t.i % cols) * thumbW,
      top: Math.floor(t.i / cols) * thumbH,
    }))
  );
  const out = path.resolve("scratch_check/layout_sheet.png");
  await sharp({ create: { width: cols * thumbW, height: rows * thumbH, channels: 3, background: "#1a0d10" } })
    .composite(comps).png().toFile(out);
  console.log("layout_sheet →", out);
  SHOTS.forEach(([sec, lbl], i) => console.log(`${i}  ${sec}s  ${lbl}`));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
