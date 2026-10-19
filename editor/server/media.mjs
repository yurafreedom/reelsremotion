// Dev-only media upload middleware (Vite plugin). The editor loads video/image
// files INTO the repo's public/ so the SAME relative path resolves in both the
// editor <Player> (dev server static) AND the final render via staticFile()
// (CONTRACT §6 / v2.2 "media must PREVIEW and RENDER"). A browser blob URL would
// preview but never render — so we always copy bytes into public/media/.
//
//   POST /__media   body = raw file bytes, header x-filename: <name>
//                   → writes public/media/<safe-name>, returns { path }
//   GET  /__media   → { files: ["media/foo.mp4", ...] }  (pick-from-public fallback)

import fs from "node:fs";
import path from "node:path";

// The client URI-encodes the filename (HTTP headers are ISO-8859-1 only), so a
// Cyrillic/Unicode name survives transport. Decode it, then reduce to a SAFE ASCII
// name keeping the extension. If the stem reduces to nothing (e.g. an all-Cyrillic
// name), fall back to "media" so we never produce "_.mp4" / "upload.bin".
const decodeName = (raw) => {
  if (!raw) return "upload.bin";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw; // not encoded (older client) — use as-is
  }
};

const sanitize = (name) => {
  const decoded = decodeName(name);
  const ext = path.extname(decoded).replace(/[^\w.]+/g, "").slice(0, 12);
  const rawStem = decoded.slice(0, decoded.length - path.extname(decoded).length);
  let stem = rawStem.replace(/[^\w\-]+/g, "_").replace(/^[._-]+/, "").slice(0, 100);
  if (!stem.replace(/_/g, "")) stem = "media"; // nothing ASCII survived
  return `${stem}${ext || ""}` || "upload.bin";
};

// Avoid clobbering an existing file: foo.mp4 → foo-1.mp4 → foo-2.mp4 …
const uniquePath = (dir, name) => {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let candidate = name;
  let i = 1;
  while (fs.existsSync(path.join(dir, candidate))) candidate = `${base}-${i++}${ext}`;
  return candidate;
};

const MEDIA_EXT = new Set([
  ".mp4", ".mov", ".webm", ".m4v",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif",
  ".mp3", ".wav", ".m4a", ".aac",
]);

const listMedia = (mediaDir) => {
  if (!fs.existsSync(mediaDir)) return [];
  return fs
    .readdirSync(mediaDir)
    .filter((f) => MEDIA_EXT.has(path.extname(f).toLowerCase()))
    .map((f) => `media/${f}`);
};

/** @param {string} publicDir absolute path to the repo's public/ folder */
export function mediaPlugin(publicDir) {
  const mediaDir = path.join(publicDir, "media");
  return {
    name: "reels-media-upload",
    configureServer(server) {
      server.middlewares.use("/__media", (req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (req.method === "GET") {
          res.end(JSON.stringify({ files: listMedia(mediaDir) }));
          return;
        }
        if (req.method === "POST") {
          const filename = sanitize(req.headers["x-filename"]);
          const chunks = [];
          let bytes = 0;
          const MAX = 512 * 1024 * 1024; // 512MB guard
          req.on("data", (c) => {
            bytes += c.length;
            if (bytes > MAX) {
              res.statusCode = 413;
              res.end(JSON.stringify({ error: "file too large" }));
              req.destroy();
              return;
            }
            chunks.push(c);
          });
          req.on("end", () => {
            try {
              fs.mkdirSync(mediaDir, { recursive: true });
              const finalName = uniquePath(mediaDir, filename);
              fs.writeFileSync(path.join(mediaDir, finalName), Buffer.concat(chunks));
              // The path is RELATIVE to public/ — exactly what background.src and
              // staticFile() expect.
              res.end(JSON.stringify({ path: `media/${finalName}` }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }));
            }
          });
          return;
        }
        res.statusCode = 405;
        res.end(JSON.stringify({ error: "method not allowed" }));
      });
    },
  };
}
