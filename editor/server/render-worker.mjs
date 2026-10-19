// Render worker (v2.5) — forked child process that runs the EXACT same render
// path the Remotion CLI uses (`bundle()` the same entry → `selectComposition()`
// the "Reels" composition → `renderMedia()`). Output is byte-for-byte the CLI's
// for the same timeline (same composition code = WYSIWYG, already proven).
//
// Why a separate process: rendering spins up headless Chromium + a webpack bundle;
// keeping it out of the Vite dev process isolates crashes and lets us stream
// progress via IPC (process.send) back to the /__render middleware.
//
// Input  (IPC "start" message): { props, fps, quality, outPath, entryPoint, publicDir }
// Output (IPC messages):
//   { type:'phase',    phase:'bundling'|'rendering' }
//   { type:'progress', renderedFrames, encodedFrames, totalFrames }
//   { type:'done',     outPath }
//   { type:'error',    message }

import path from "node:path";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia, ensureBrowser } from "@remotion/renderer";
import { retimeTimeline } from "./retime.mjs";

// Quality → H.264 CRF (lower = higher quality / bigger file). Matches a sensible
// "High" vs "Medium" split for 1080×1920 H.264.
const CRF_BY_QUALITY = { high: 18, medium: 23 };

const send = (msg) => {
  if (process.send) process.send(msg);
};

async function run(job) {
  const { props, fps, quality, outPath, entryPoint, publicDir } = job;

  // Re-time the timeline to the chosen output fps (see retime.mjs). At fps===base
  // this is a no-op; at 60 it scales frame timings so the animation is identical,
  // just smoother. The editor's props.json builder output is otherwise untouched.
  const timeline = retimeTimeline(props.timeline, fps);
  const inputProps = { ...props, timeline };

  await ensureBrowser();

  send({ type: "phase", phase: "bundling" });
  const serveUrl = await bundle({
    entryPoint,
    // Reuse the repo public/ so staticFile() resolves media at the SAME path the
    // editor preview used (CONTRACT §6). webpackOverride left default = CLI parity.
    publicDir,
  });

  // selectComposition runs Root.tsx calculateMetadata against our inputProps, so
  // width/height/fps/durationInFrames all come from the (re-timed) timeline.
  const composition = await selectComposition({
    serveUrl,
    id: "Reels",
    inputProps,
    publicDir,
  });

  const totalFrames = composition.durationInFrames;
  send({ type: "phase", phase: "rendering", totalFrames });

  const crf = CRF_BY_QUALITY[quality] ?? CRF_BY_QUALITY.high;

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf,
    // Match remotion.config.ts (Config.setVideoImageFormat("jpeg")) for CLI parity.
    imageFormat: "jpeg",
    outputLocation: outPath,
    inputProps,
    publicDir,
    overwrite: true,
    onProgress: ({ renderedFrames, encodedFrames }) => {
      send({ type: "progress", renderedFrames, encodedFrames, totalFrames });
    },
  });

  send({ type: "done", outPath });
}

process.on("message", (job) => {
  if (!job || job.kind !== "start") return;
  run(job)
    .catch((err) => {
      send({ type: "error", message: String(err && err.stack ? err.stack : err) });
    })
    .finally(() => {
      // Give IPC a tick to flush, then exit so the process never lingers.
      setTimeout(() => process.exit(0), 50);
    });
});

// Surface unexpected failures rather than hanging silently.
process.on("uncaughtException", (err) => {
  send({ type: "error", message: String(err && err.stack ? err.stack : err) });
  setTimeout(() => process.exit(1), 50);
});
