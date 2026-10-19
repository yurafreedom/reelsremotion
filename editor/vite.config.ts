import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { mediaPlugin } from "./server/media.mjs";
import { renderPlugin } from "./server/render.mjs";

const root = __dirname;
const repoRoot = path.resolve(root, "..");
const publicDir = path.join(repoRoot, "public");
// Export → mp4 (v2.5): the render worker bundles this entry (the SAME one the CLI
// uses) and writes to out/ (the SAME folder `npm run render` writes to).
const entryPoint = path.join(repoRoot, "src", "index.ts");
const outDir = path.join(repoRoot, "out");

// The editor reuses the engine in ../src AND resolves all deps (react, remotion,
// @remotion/*) from the repo-root node_modules so there is exactly ONE copy of
// React shared between the editor shell and the embedded <Player> composition.
export default defineConfig({
  root,
  // Serve the repo's public/ so media written by /__media (public/media/<file>)
  // resolves at the SAME path the render uses via staticFile() — preview === render.
  publicDir,
  plugins: [react(), mediaPlugin(publicDir), renderPlugin({ entryPoint, publicDir, outDir })],
  resolve: {
    alias: {
      "@engine": path.resolve(repoRoot, "src"),
    },
    // CRITICAL: a single React/Remotion instance (hooks + Remotion context must
    // be shared between the editor and the composition rendered by <Player>).
    dedupe: ["react", "react-dom", "remotion", "@remotion/player"],
  },
  server: {
    fs: {
      // Allow importing engine source (../src) and root node_modules.
      allow: [repoRoot],
    },
  },
});
