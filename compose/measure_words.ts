// measure_words.ts — measure the REAL rendered width of every caption word in the
// headless Chromium Remotion ships, with the actual Oswald / Playfair-italic faces
// (Cyrillic). Writes compose/word_widths.json so the absolute layout in
// revealCaptionChunksTimed uses MEASURED glyph widths instead of the len·size·k
// estimate — killing the phantom gaps / overlaps around accents (fix #4).
//
//   node compose/run.mjs compose/measure_words.ts
//
// Re-run whenever the chunk text or the n/s/a/A style sizes/fonts change.

import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { ensureBrowser, openBrowser } = require("@remotion/renderer") as typeof import("@remotion/renderer");

type ChunkWord = { text: string; style: "n" | "s" | "a" | "A" };
type Chunk = { words: ChunkWord[] };

type SP = { family: string; italic: boolean; size: number; weight: number; upper: boolean };
// Caption style → render params, MIRRORING build_reel.ts STYLE_B exactly (the
// rendered variant). width depends only on font-family/style/size/weight/
// letter-spacing and the glyph string (n/s are uppercased in Word.tsx before render).
const STYLE: Record<string, SP> = {
  n: { family: "'Oswald', sans-serif", italic: false, size: 78, weight: 500, upper: true },
  s: { family: "'Oswald', sans-serif", italic: false, size: 87, weight: 700, upper: true },
  a: { family: "'Playfair Display', serif", italic: true, size: 96, weight: 600, upper: false },
  A: { family: "'Playfair Display', serif", italic: true, size: 108, weight: 700, upper: false },
};
// Outro CTA style → SMALLER sizes (mirrors build_reel.ts OUTRO_STYLE). Measured
// separately so the static outro lays out from real widths at ITS size.
const OUTRO_STYLE: Record<string, SP> = {
  n: { family: "'Oswald', sans-serif", italic: false, size: 48, weight: 500, upper: true },
  a: { family: "'Playfair Display', serif", italic: true, size: 60, weight: 600, upper: false },
};

const FONT_CSS = [
  "https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&display=swap",
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap",
];

// Optional argv: [chunks_timed path] [output widths path]. Defaults keep the
// original behaviour; REEL 1 passes its own files so the two reels' widths don't
// clobber each other.
const CHUNKS_PATH = process.argv[2] ?? "compose/chunks_timed.json";
const OUT_PATH = process.argv[3] ?? "compose/word_widths.json";

(async () => {
  const chunks = JSON.parse(readFileSync(CHUNKS_PATH, "utf8")) as Chunk[];
  // Unique (text, style) pairs from the captions PLUS the outro CTA words (so the
  // static outro caption also lays out from real measured widths).
  const OUTRO: ChunkWord[] = [
    { text: "пиши", style: "n" }, { text: "слово", style: "n" }, { text: "«клуб»,", style: "a" },
    { text: "чтобы", style: "n" }, { text: "получить", style: "n" }, { text: "полную", style: "n" },
    { text: "версию", style: "n" }, { text: "эфира", style: "n" },
  ];
  // Each item carries its OWN resolved render params (caption sizes vs outro sizes),
  // so a word is measured at the exact size it renders. Outro texts are unique, so
  // `${text}␟${style}` keys don't collide with caption words.
  const pairs = new Map<string, { text: string; sp: SP }>();
  for (const c of chunks)
    for (const w of c.words) pairs.set(`${w.text}␟${w.style}`, { text: w.text, sp: STYLE[w.style] });
  for (const w of OUTRO) pairs.set(`${w.text}␟${w.style}`, { text: w.text, sp: OUTRO_STYLE[w.style] });
  const items = [...pairs.entries()].map(([key, { text, sp }]) => ({
    key,
    text: sp.upper ? text.toUpperCase() : text,
    family: sp.family,
    italic: sp.italic,
    size: sp.size,
    weight: sp.weight,
  }));

  await ensureBrowser();
  const browser = await openBrowser("chrome", { logLevel: "error" });
  const page = await (browser as unknown as {
    newPage: (o: unknown) => Promise<{
      goto: (a: { url: string; timeout: number; options?: unknown }) => Promise<unknown>;
      evaluate: (fn: (...a: unknown[]) => unknown, ...args: unknown[]) => Promise<unknown>;
    }>;
  }).newPage({ context: null, logLevel: "error", indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => {} });

  await page.goto({ url: "about:blank", timeout: 30000 });

  const widths = (await page.evaluate(
    async (itemsJson: unknown, cssUrls: unknown) => {
      const its = JSON.parse(itemsJson as string) as {
        key: string; text: string; family: string; italic: boolean; size: number; weight: number;
      }[];
      const urls = JSON.parse(cssUrls as string) as string[];
      // Inject the css2 stylesheets and force-load the faces with a Cyrillic probe.
      for (const url of urls) {
        const res = await fetch(url);
        const css = await res.text();
        const s = document.createElement("style");
        s.textContent = css;
        document.head.appendChild(s);
      }
      const fams = ["'Oswald', sans-serif", "'Playfair Display', serif"];
      await Promise.all(
        fams.flatMap((f) =>
          ["normal", "italic"].flatMap((sty) =>
            [400, 600, 700].map((w) =>
              (document as Document).fonts.load(`${sty} ${w} 96px ${f}`, "Аа Бб Reels 0")
            )
          )
        )
      );
      await (document as Document).fonts.ready;

      const span = document.createElement("span");
      span.style.position = "absolute";
      span.style.left = "-9999px";
      span.style.top = "0";
      span.style.whiteSpace = "nowrap";
      span.style.letterSpacing = "0px";
      span.style.lineHeight = "1.1";
      document.body.appendChild(span);

      const out: Record<string, number> = {};
      for (const it of its) {
        span.style.fontFamily = it.family;
        span.style.fontStyle = it.italic ? "italic" : "normal";
        span.style.fontSize = it.size + "px";
        span.style.fontWeight = String(it.weight);
        span.textContent = it.text;
        out[it.key] = Math.round(span.getBoundingClientRect().width * 100) / 100;
      }
      return out;
    },
    JSON.stringify(items),
    JSON.stringify(FONT_CSS)
  )) as Record<string, number>;

  await (browser as unknown as { close: (o: { silent: boolean }) => Promise<void> }).close({ silent: true });

  writeFileSync(OUT_PATH, JSON.stringify(widths, null, 2));
  const n = Object.keys(widths).length;
  console.log(`measured ${n} unique words → ${OUT_PATH}`);
  // Spot-print a few accent words.
  for (const k of ["поубивать␟A", "страх␟A", "правду␟A", "важна␟A", "недостаточными␟A"]) {
    if (widths[k] != null) console.log(`  ${k.replace("␟", " [")}]  = ${widths[k]}px`);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
