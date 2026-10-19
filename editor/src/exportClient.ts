// Client side of Export → mp4 (v2.5). Talks to the dev-only /__render middleware:
// POST the render-ready props (from the SAME toRenderProps builder the CLI flow
// uses), then poll for progress until done/error. The browser never renders the
// mp4 itself — it only triggers the local render and reports progress.

import type { TimelineV3 } from "@engine/types.v3";
import { toRenderPropsV3 } from "./io";

export type ExportFps = 30 | 60;
export type ExportQuality = "high" | "medium";

export interface RenderProgress {
  id: string;
  status: "starting" | "bundling" | "rendering" | "done" | "error";
  phase: string;
  renderedFrames: number;
  encodedFrames: number;
  totalFrames: number;
  percent: number;
  outName: string;
  error: string | null;
}

export interface ExportOptions {
  fps: ExportFps;
  quality: ExportQuality;
  outName: string;
}

// Start a render; returns the job id + the (sanitized) output filename.
export async function startRender(
  timeline: TimelineV3,
  opts: ExportOptions
): Promise<{ id: string; outName: string }> {
  const props = toRenderPropsV3(timeline); // { showGrid:false, timeline } — reused verbatim
  const res = await fetch("/__render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      props,
      fps: opts.fps,
      quality: opts.quality,
      outName: opts.outName,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `render start failed (${res.status})`);
  return data;
}

export async function pollRender(id: string): Promise<RenderProgress> {
  const res = await fetch(`/__render/${encodeURIComponent(id)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `progress poll failed (${res.status})`);
  return data as RenderProgress;
}

// Download URL for a finished render (served from out/ by the middleware).
export const downloadUrl = (outName: string) =>
  `/__render/file/${encodeURIComponent(outName)}`;
