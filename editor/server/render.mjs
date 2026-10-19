// Dev-only render middleware (v2.5) — the in-UI Export → mp4 trigger.
//
// Rendering an mp4 is SERVER-SIDE work: Remotion drives headless Chromium in a
// Node process; a browser cannot produce the mp4 itself. So the editor's Export
// button POSTs the render-ready props here, this middleware forks a worker that
// runs the SAME render path as the CLI (see render-worker.mjs), and the browser
// polls progress + downloads the finished file. Mirrors the v2.2 /__media plugin.
//
//   POST /__render            body { props, fps, quality, outName }
//                             → { id, outName }   (job started)
//   GET  /__render/:id        → { status, phase, renderedFrames, totalFrames,
//                                 percent, outName, error }   (poll for progress)
//   GET  /__render/file/:name → streams out/<name>.mp4 as a download
//
// Output lands in out/<name>.mp4 — the SAME folder the CLI writes to — so the
// exported file is interchangeable with `npm run render`.

import fs from "node:fs";
import path from "node:path";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(__dirname, "render-worker.mjs");

// In-memory job table (dev server lifetime). Each job: status + progress counters.
/** @type {Map<string, any>} */
const jobs = new Map();
let seq = 0;

const sanitizeName = (name) => {
  let n = (name || "export").toString().replace(/\.mp4$/i, "");
  n = n.replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "").slice(0, 100) || "export";
  return `${n}.mp4`;
};

const sendJson = (res, code, obj) => {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    const MAX = 64 * 1024 * 1024; // props JSON guard (timelines are small, but be safe)
    req.on("data", (c) => {
      bytes += c.length;
      if (bytes > MAX) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

const percentOf = (job) =>
  job.totalFrames > 0 ? Math.min(100, Math.round((job.renderedFrames / job.totalFrames) * 100)) : 0;

// Client-facing snapshot of a job (no internal handles).
const snapshot = (job) => ({
  id: job.id,
  status: job.status, // 'starting' | 'bundling' | 'rendering' | 'done' | 'error'
  phase: job.status,
  renderedFrames: job.renderedFrames,
  encodedFrames: job.encodedFrames,
  totalFrames: job.totalFrames,
  percent: percentOf(job),
  outName: job.outName,
  error: job.error || null,
});

function startJob({ props, fps, quality, outName, entryPoint, publicDir, outDir }) {
  const id = `r${++seq}_${Date.now().toString(36)}`;
  const finalName = sanitizeName(outName);
  const outPath = path.join(outDir, finalName);
  fs.mkdirSync(outDir, { recursive: true });

  const job = {
    id,
    status: "starting",
    renderedFrames: 0,
    encodedFrames: 0,
    totalFrames: 0,
    outName: finalName,
    error: null,
  };
  jobs.set(id, job);

  const child = fork(WORKER, [], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
  child.on("message", (msg) => {
    if (!msg || typeof msg !== "object") return;
    switch (msg.type) {
      case "phase":
        job.status = msg.phase; // 'bundling' | 'rendering'
        if (typeof msg.totalFrames === "number") job.totalFrames = msg.totalFrames;
        break;
      case "progress":
        job.renderedFrames = msg.renderedFrames ?? job.renderedFrames;
        job.encodedFrames = msg.encodedFrames ?? job.encodedFrames;
        if (typeof msg.totalFrames === "number") job.totalFrames = msg.totalFrames;
        break;
      case "done":
        job.status = "done";
        job.renderedFrames = job.totalFrames || job.renderedFrames;
        break;
      case "error":
        job.status = "error";
        job.error = msg.message || "render failed";
        break;
    }
  });
  child.on("error", (err) => {
    job.status = "error";
    job.error = String(err && err.message ? err.message : err);
  });
  child.on("exit", (code) => {
    // If the worker died before reporting done/error, surface it (no silent hang).
    if (job.status !== "done" && job.status !== "error") {
      job.status = "error";
      job.error = `render process exited unexpectedly (code ${code})`;
    }
  });

  child.send({ kind: "start", props, fps, quality, outPath, entryPoint, publicDir });
  return job;
}

/**
 * @param {object} opts
 * @param {string} opts.entryPoint absolute path to the Remotion entry (src/index.ts)
 * @param {string} opts.publicDir  absolute path to the repo public/ folder
 * @param {string} opts.outDir     absolute path to the out/ folder (CLI parity)
 */
export function renderPlugin({ entryPoint, publicDir, outDir }) {
  return {
    name: "reels-render",
    configureServer(server) {
      server.middlewares.use("/__render", async (req, res) => {
        const url = (req.url || "/").split("?")[0];

        // --- Download the finished file: GET /__render/file/<name> ---
        if (req.method === "GET" && url.startsWith("/file/")) {
          const name = sanitizeName(decodeURIComponent(url.slice("/file/".length)));
          const filePath = path.join(outDir, name);
          if (!fs.existsSync(filePath)) {
            return sendJson(res, 404, { error: "file not found" });
          }
          const stat = fs.statSync(filePath);
          res.statusCode = 200;
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader("Content-Length", String(stat.size));
          res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        // --- Poll progress: GET /__render/<id> ---
        if (req.method === "GET" && url.length > 1) {
          const id = url.slice(1);
          const job = jobs.get(id);
          if (!job) return sendJson(res, 404, { error: "unknown job" });
          return sendJson(res, 200, snapshot(job));
        }

        // --- Start a render: POST /__render ---
        if (req.method === "POST" && (url === "/" || url === "")) {
          try {
            const body = JSON.parse(await readBody(req));
            const { props, outName } = body;
            const fps = Number(body.fps) === 60 ? 60 : 30;
            const quality = body.quality === "medium" ? "medium" : "high";
            if (!props || typeof props !== "object" || !props.timeline) {
              return sendJson(res, 400, { error: "missing props.timeline" });
            }
            const job = startJob({
              props,
              fps,
              quality,
              outName,
              entryPoint,
              publicDir,
              outDir,
            });
            return sendJson(res, 200, { id: job.id, outName: job.outName });
          } catch (err) {
            return sendJson(res, 400, {
              error: String(err && err.message ? err.message : err),
            });
          }
        }

        return sendJson(res, 405, { error: "method not allowed" });
      });
    },
  };
}
