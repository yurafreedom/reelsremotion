// Client side of the dev media pipeline. Uploads bytes to /__media (the Vite
// middleware writes them into public/media/), then returns the RELATIVE path that
// both the editor <Player> and the render's staticFile() resolve identically.

export type MediaKind = "video" | "image";

export const kindOfFile = (file: File): MediaKind | null => {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  // Fall back to extension for files with no MIME type.
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "webm", "m4v"].includes(ext)) return "video";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif"].includes(ext)) return "image";
  return null;
};

/** POST raw bytes; returns the public-relative path (e.g. "media/clip.mp4").
 *  The filename is URI-encoded because HTTP headers are ISO-8859-1 only — a raw
 *  Cyrillic/Unicode name (e.g. "Рилс 2.mp4") would throw on the fetch. The server
 *  decodes it and saves under a safe ASCII name (keeping the extension). */
export async function uploadMedia(file: File): Promise<string> {
  const res = await fetch("/__media", {
    method: "POST",
    headers: { "x-filename": encodeURIComponent(file.name), "content-type": "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  const json = (await res.json()) as { path?: string; error?: string };
  if (!json.path) throw new Error(json.error || "upload returned no path");
  return json.path;
}

/** List media already in public/media/ (pick-from-existing fallback). */
export async function listMedia(): Promise<string[]> {
  try {
    const res = await fetch("/__media");
    if (!res.ok) return [];
    const json = (await res.json()) as { files?: string[] };
    return json.files ?? [];
  } catch {
    return [];
  }
}

/** Natural pixel dimensions + (for video) duration in SECONDS of a media file.
 *  Used to set a sensible initial box size AND a real clip length for new clips.
 *  `durationSec` is 0 for images / when metadata can't be read. */
export function probeMedia(
  file: File,
  kind: MediaKind
): Promise<{ width: number; height: number; durationSec: number }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    let settled = false;
    const done = (width: number, height: number, durationSec: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve({ width: width || 1080, height: height || 1920, durationSec: durationSec || 0 });
    };
    // Never hang the add: if metadata never loads (odd codec/container), fall back
    // to sane defaults so the clip is still created and the toast resolves.
    const timer = setTimeout(() => done(kind === "image" ? 1080 : 1920, kind === "image" ? 1920 : 1080, 0), 8000);
    if (kind === "image") {
      const img = new Image();
      img.onload = () => done(img.naturalWidth, img.naturalHeight, 0);
      img.onerror = () => done(1080, 1920, 0);
      img.src = url;
    } else {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () =>
        done(v.videoWidth, v.videoHeight, isFinite(v.duration) ? v.duration : 0);
      v.onerror = () => done(1920, 1080, 0);
      v.src = url;
    }
  });
}

/** Natural pixel dimensions of a media file (for a sensible initial box size). */
export async function naturalSize(
  file: File,
  kind: MediaKind
): Promise<{ width: number; height: number }> {
  const { width, height } = await probeMedia(file, kind);
  return { width, height };
}

/** Open a native file picker and resolve the chosen File (or null if cancelled). */
export function openFilePicker(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    // Some browsers need the input in the DOM; cancel can't be detected reliably,
    // so we resolve on change only (a cancelled picker leaves the promise pending,
    // which is harmless — it is GC'd with the closure).
    input.click();
  });
}

/** Fit a media's natural size into a centered box no larger than `maxW`×`maxH`,
 *  preserving aspect ratio — the auto initial size for a `box` background. */
export function fitBox(
  natW: number,
  natH: number,
  maxW = 960,
  maxH = 1400
): { width: number; height: number } {
  const ar = natW > 0 && natH > 0 ? natW / natH : 16 / 9;
  let w = maxW;
  let h = Math.round(w / ar);
  if (h > maxH) {
    h = maxH;
    w = Math.round(h * ar);
  }
  return { width: w, height: h };
}
