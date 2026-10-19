import type { PluginOption } from "vite";

/** Dev-only render middleware for Export → mp4 (see render.mjs). */
export function renderPlugin(opts: {
  entryPoint: string;
  publicDir: string;
  outDir: string;
}): PluginOption;
