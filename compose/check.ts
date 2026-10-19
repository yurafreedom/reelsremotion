// compose/check.ts — CC's eyes. Render a STILL of one frame (or a contact sheet
// of the whole arc) of a timeline, so CC can VIEW its own composition and adjust.
//
// Pixels come from the SAME composition the final mp4 uses: bundle src/index.ts
// once, select the "Reels" composition with inputProps { timeline, showGrid:false }
// (showGrid:false === the render path), and renderStill that frame. A still is
// therefore identical to that frame of the full render — no Player/dev-server/Chrome.
//
//   node compose/run.mjs compose/check.ts <timeline.json> [frame]   # one still
//   node compose/run.mjs compose/check.ts <timeline.json> sheet     # contact sheet
//
// Programmatic use:
//   import { checkFrame, contactSheet } from "./check";
//   await checkFrame("public/timeline.json", 45, { out: "check.png" });

import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Timeline } from "@engine/types";
import type { TimelineV3 } from "@engine/types.v3";
import { isV3, videoTrackOf } from "@engine/types.v3";
import { totalDurationInFrames } from "@engine/compose";
import {
  serializeTimeline,
  serializeTimelineV3,
  validateTimeline,
  validateTimelineV3,
} from "./io";

type AnyTimeline = Timeline | TimelineV3;

// Resolve @remotion/* from the project node_modules. The bundle file lives under
// the project (compose/run.mjs writes to ./.compose-tmp), so this resolves.
const require = createRequire(import.meta.url);
const { bundle } = require("@remotion/bundler") as typeof import("@remotion/bundler");
const { selectComposition, renderStill, ensureBrowser } =
  require("@remotion/renderer") as typeof import("@remotion/renderer");

const ROOT = process.cwd();

// Contact-sheet backdrop (v2.2 has no top-level background): use the first
// scene's color background if it has one, else black.
const sheetBackdrop = (t: AnyTimeline): string => {
  if (isV3(t)) {
    const first = videoTrackOf(t)?.clips[0];
    return first?.kind === "color" ? first.color : "#000000";
  }
  const bg = t.scenes[0]?.background;
  if (bg?.type === "color") return bg.color;
  if (bg?.type === "box") return bg.backColor;
  return "#000000";
};
const ENTRY = path.join(ROOT, "src", "index.ts");
// REEL_PUBLIC_DIR lets a render bundle against a SLIM public dir (only the media a
// reel needs) instead of the full public/ — the full dir holds ~860MB of unused
// source media that the bundler would copy, overflowing a near-full disk.
const PUBLIC_DIR = process.env.REEL_PUBLIC_DIR
  ? path.resolve(process.env.REEL_PUBLIC_DIR)
  : path.join(ROOT, "public");
const COMPOSITION_ID = "Reels";

/** Accept a path or an in-memory Timeline; return a serialized (render-ready) copy. */
const resolveTimeline = (t: AnyTimeline | string): AnyTimeline => {
  const obj: AnyTimeline =
    typeof t === "string" ? (JSON.parse(fs.readFileSync(t, "utf8")) as AnyTimeline) : t;
  const serialized = isV3(obj) ? serializeTimelineV3(obj) : serializeTimeline(obj);
  const errs = isV3(serialized)
    ? validateTimelineV3(serialized)
    : validateTimeline(serialized);
  if (errs.length) {
    throw new Error(`check: invalid timeline:\n  ${errs.join("\n  ")}`);
  }
  return serialized;
};

// ----- Bundle (cached per process) -------------------------------------------

let bundlePromise: Promise<string> | null = null;

/** Bundle the Remotion project once and reuse the serveUrl for the session. */
export const bundleOnce = (): Promise<string> => {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      await ensureBrowser();
      const serveUrl = await bundle({
        entryPoint: ENTRY,
        publicDir: PUBLIC_DIR,
        onProgress: () => {},
      });
      return serveUrl;
    })();
  }
  return bundlePromise;
};

const inputPropsFor = (timeline: AnyTimeline) => ({
  timeline,
  showGrid: false,
  localFontsOnly: process.env.REELS_LOCAL_FONTS_ONLY === "1",
});

const durationOf = (timeline: AnyTimeline): number =>
  isV3(timeline) ? timeline.durationInFrames : totalDurationInFrames(timeline);

// ----- checkFrame -------------------------------------------------------------

/**
 * Render one frame to a PNG (the exact rendered pixels, showGrid:false). Returns
 * the output path; CC then views it.
 */
export const checkFrame = async (
  timeline: AnyTimeline | string,
  frame: number,
  opts: { out?: string } = {}
): Promise<string> => {
  const t = resolveTimeline(timeline);
  const out = path.resolve(opts.out ?? "check.png");
  const serveUrl = await bundleOnce();
  const inputProps = inputPropsFor(t);
  const total = durationOf(t);
  const clamped = Math.max(0, Math.min(total - 1, Math.round(frame)));
  if (!Number.isFinite(total) || !Number.isFinite(clamped)) {
    throw new Error(`check: non-finite frame calculation input=${frame} total=${total} clamped=${clamped}`);
  }
  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
  });
  await renderStill({
    composition,
    serveUrl,
    frame: clamped,
    output: out,
    inputProps,
    imageFormat: "png",
    overwrite: true,
  });
  return out;
};

// ----- contactSheet -----------------------------------------------------------

type SharpLike = {
  (input?: Buffer | string): {
    resize: (w: number, h: number, o?: unknown) => unknown;
    toBuffer: () => Promise<Buffer>;
  };
};

const tryRequireSharp = (): SharpLike | null => {
  try {
    return require("sharp") as SharpLike;
  } catch {
    return null;
  }
};

/**
 * Render stills at 0, n, 2n, … across the whole timeline and lay them out as one
 * grid image (sharp). If sharp is unavailable, fall back to writing the frame PNGs
 * to a folder plus an index.html montage — and return that folder. Either way CC
 * gets a single artifact showing the whole arc.
 */
export const contactSheet = async (
  timeline: AnyTimeline | string,
  opts: { everyNFrames?: number; cols?: number; out?: string; thumbWidth?: number } = {}
): Promise<string> => {
  const t = resolveTimeline(timeline);
  const everyN = Math.max(1, opts.everyNFrames ?? 15);
  const cols = Math.max(1, opts.cols ?? 5);
  const out = path.resolve(opts.out ?? "sheet.png");
  const total = durationOf(t);

  const frames: number[] = [];
  for (let f = 0; f < total; f += everyN) frames.push(f);
  if (frames.length === 0) frames.push(0);

  // Render each still into a frames folder next to `out`.
  const framesDir = out.replace(/\.[^.]+$/, "") + "_frames";
  fs.mkdirSync(framesDir, { recursive: true });
  const tiles: { frame: number; file: string }[] = [];
  for (const f of frames) {
    const file = path.join(framesDir, `frame_${String(f).padStart(5, "0")}.png`);
    await checkFrame(t, f, { out: file });
    tiles.push({ frame: f, file });
  }

  const sharp = tryRequireSharp();
  if (sharp) {
    const thumbW = opts.thumbWidth ?? 216; // 1080/5
    const thumbH = Math.round((thumbW * t.height) / t.width);
    const rows = Math.ceil(tiles.length / cols);
    const composites = await Promise.all(
      tiles.map(async (tile, i) => {
        const buf = await (sharp(tile.file).resize(thumbW, thumbH) as {
          toBuffer: () => Promise<Buffer>;
        }).toBuffer();
        return {
          input: buf,
          left: (i % cols) * thumbW,
          top: Math.floor(i / cols) * thumbH,
        };
      })
    );
    const canvas = sharp({
      // @ts-expect-error sharp create options
      create: {
        width: cols * thumbW,
        height: rows * thumbH,
        channels: 3,
        background: sheetBackdrop(t),
      },
    }) as unknown as { composite: (c: unknown[]) => { toFile: (p: string) => Promise<unknown> } };
    await canvas.composite(composites).toFile(out);
    console.log(`contactSheet → ${out} (${tiles.length} frames, ${cols} cols)`);
    return out;
  }

  // Fallback: an HTML montage referencing the rendered PNGs (no native deps).
  const html =
    `<!doctype html><meta charset=utf8><title>contact sheet</title>` +
    `<body style="margin:0;background:${sheetBackdrop(t)};display:grid;` +
    `grid-template-columns:repeat(${cols},1fr);gap:2px">` +
    tiles
      .map(
        (tile) =>
          `<figure style="margin:0;position:relative">` +
          `<img src="${path.basename(tile.file)}" style="width:100%;display:block">` +
          `<figcaption style="position:absolute;top:2px;left:4px;color:#fff;` +
          `font:12px monospace;text-shadow:0 0 3px #000">f${tile.frame}</figcaption></figure>`
      )
      .join("") +
    `</body>`;
  const htmlPath = path.join(framesDir, "index.html");
  fs.writeFileSync(htmlPath, html, "utf8");
  console.log(
    `contactSheet (no sharp) → ${tiles.length} PNGs in ${framesDir}\n` +
      `  open ${htmlPath} for the montage, or view individual frame_*.png\n` +
      `  (install sharp for a single sheet.png: npm i -D sharp)`
  );
  return framesDir;
};

// ----- CLI --------------------------------------------------------------------

const isMain = !!process.argv[1] && path.basename(process.argv[1]) === "check.ts";
if (isMain) {
  const file = process.argv[2];
  const arg = process.argv[3];
  if (!file) {
    console.error("usage: node compose/run.mjs compose/check.ts <timeline.json> [frame|sheet]");
    process.exit(1);
  }
  (async () => {
    if (arg === "sheet" || arg === undefined) {
      const r = await contactSheet(file);
      console.log("done:", r);
    } else {
      const r = await checkFrame(file, Number(arg), { out: "check.png" });
      console.log("done:", r);
    }
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
