// compose/run.mjs — run a TypeScript compose script under Node.
//
// The repo already standardizes on esbuild for TS-in-Node (see package.json
// test:* scripts). This generalizes that: bundle ONE entry (the script you pass)
// to ESM, keep every node_module EXTERNAL (so @remotion/renderer's native binary
// and the rest load normally), resolve the `@engine/*` alias the editor IO uses,
// then import the result.
//
//   node compose/run.mjs compose/example.ts [args...]
//
// Top-level await works (ESM output). Anything under node_modules stays external.

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const entry = process.argv[2];
if (!entry) {
  console.error("usage: node compose/run.mjs <script.ts> [args...]");
  process.exit(1);
}

// Forward any extra args to the script as process.argv[2..].
process.argv = [process.argv[0], path.resolve(entry), ...process.argv.slice(3)];

// Output INSIDE the project so Node resolves the external `@remotion/*` / react
// imports against ./node_modules (external imports resolve relative to the bundle
// file's location, not cwd). Kept out of git via .gitignore.
const outDir = process.env.COMPOSE_TMP || path.join(ROOT, ".compose-tmp");
fs.mkdirSync(outDir, { recursive: true });
const outfile = path.join(outDir, "bundle.mjs");

await build({
  entryPoints: [path.resolve(entry)],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external", // keep @remotion/*, react, etc. external
  alias: { "@engine": path.join(ROOT, "src") },
  sourcemap: "inline",
  outfile,
  logLevel: "warning",
});

await import(pathToFileURL(outfile).href);
