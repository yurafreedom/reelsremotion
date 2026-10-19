// render_reel.ts — full mp4 render of the re-timed reel. Same render path as the
// editor worker + Remotion CLI: bundle src/index.ts → selectComposition("Reels")
// with inputProps { timeline, showGrid:false } → renderMedia (h264, crf 18, jpeg).
// WYSIWYG with check.ts stills (identical composition + inputProps).
//
//   node compose/run.mjs compose/render_reel.ts [public/timeline_reel.json] [out/reel.mp4]

import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Timeline } from "@engine/types";
import type { TimelineV3 } from "@engine/types.v3";
import { isV3 } from "@engine/types.v3";
import {
  serializeTimeline,
  serializeTimelineV3,
  validateTimeline,
  validateTimelineV3,
} from "./io";

const require = createRequire(import.meta.url);
const { bundle } = require("@remotion/bundler") as typeof import("@remotion/bundler");
const { selectComposition, renderMedia, ensureBrowser } =
  require("@remotion/renderer") as typeof import("@remotion/renderer");

const ROOT = process.cwd();
const tlPath = process.argv[2] ?? "public/timeline_reel.json";
const outPath = path.resolve(process.argv[3] ?? "out/reel.mp4");

(async () => {
  const raw = JSON.parse(fs.readFileSync(tlPath, "utf8")) as Timeline | TimelineV3;
  const timeline = isV3(raw) ? serializeTimelineV3(raw) : serializeTimeline(raw);
  const errs = isV3(timeline)
    ? validateTimelineV3(timeline)
    : validateTimeline(timeline);
  if (errs.length) throw new Error(`invalid timeline:\n  ${errs.join("\n  ")}`);

  const localFontsOnly = process.env.REELS_LOCAL_FONTS_ONLY === "1";
  const concurrency = Math.max(1, Number(process.env.RENDER_CONCURRENCY ?? 1));
  const inputProps = { timeline, showGrid: false, localFontsOnly };
  await ensureBrowser();
  console.log("bundling…");
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    // REEL_PUBLIC_DIR → bundle against a SLIM public dir (only this reel's media)
    // so the bundler doesn't copy ~860MB of unused source media on a near-full disk.
    publicDir: process.env.REEL_PUBLIC_DIR
      ? path.resolve(process.env.REEL_PUBLIC_DIR)
      : path.join(ROOT, "public"),
    onProgress: () => {},
  });
  const composition = await selectComposition({ serveUrl, id: "Reels", inputProps });
  const totalFrames = composition.durationInFrames;
  console.log(`rendering ${totalFrames} frames → ${outPath}`);
  console.log(`concurrency=${concurrency} localFontsOnly=${localFontsOnly}`);
  let last = 0;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 18,
    // EXPORT-COMPAT FIX: imageFormat "jpeg" produced FULL-RANGE yuvj420p / bt470bg
    // h264, which Apple players (QuickTime/Preview/Safari) render as a single
    // FROZEN frame with no audio. Force the universally-decodable standard:
    // PNG frames (no full-range JPEG tag) → yuv420p, limited-range bt709.
    imageFormat: "png",
    pixelFormat: "yuv420p",
    colorSpace: "bt709",
    outputLocation: outPath,
    concurrency,
    inputProps,
    overwrite: true,
    onProgress: ({ renderedFrames }) => {
      const pct = Math.floor((renderedFrames / totalFrames) * 100);
      if (pct >= last + 10) {
        last = pct;
        console.log(`  ${pct}% (${renderedFrames}/${totalFrames})`);
      }
    },
  });
  console.log(`done: ${outPath}`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
