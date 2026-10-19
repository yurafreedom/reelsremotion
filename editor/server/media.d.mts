import type { PluginOption } from "vite";

/** Dev-only media upload middleware (see media.mjs). */
export function mediaPlugin(publicDir: string): PluginOption;
