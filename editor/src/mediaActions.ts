// Media loading actions for v3 clips (v3.2 A1–A4). EVERY path here surfaces VISIBLE
// status through the toast api: "Uploading…" → "Added", or an error toast WITH the
// reason on any failure (bad file, endpoint down, write failed). A file is always
// uploaded into public/media/ so the SAME relative path PREVIEWS in the <Player>
// AND RENDERS via staticFile() — never a blob URL.
//
//   • addVideoToTrack / addImageToTrack — create a NEW clip directly on a track
//     (A2: no placeholder gatekeeper; an empty video track can take a video).
//   • replaceClipMedia — swap an EXISTING clip's src (A4 "Replace media").
//   • addDroppedToTrack / addDroppedToCanvas — Finder drag & drop (A3).
//
// New video defaults to fit:'cover' (fullscreen, zero manual placement); switching
// to a centered box (fit:'contain') sizes from the media's natural dimensions.

import type { TimelineV3, VideoClip } from "@engine/types.v3";
import { imageTracksOf, videoTrackOf } from "@engine/types.v3";
import { addImageClip, addTrack, addVideoClip, updateClip, type ClipPatch } from "./edits";
import type { Selection } from "./selection";
import type { ToastApi } from "./toast";
import {
  fitBox,
  kindOfFile,
  openFilePicker,
  probeMedia,
  uploadMedia,
  type MediaKind,
} from "./media";

export type AddResult = { tl: TimelineV3; selection: Selection };

const IMG_DEFAULT_SEC = 3;
const VIDEO_FALLBACK_SEC = 5;

/** Upload bytes with a sticky "Uploading…" toast that resolves to "Added" or a
 *  clear error toast. Returns the public-relative path, or null on failure. */
async function uploadWithStatus(file: File, toast: ToastApi): Promise<string | null> {
  const id = toast.show("info", `Uploading ${file.name}…`, true);
  try {
    const path = await uploadMedia(file);
    toast.update(id, "success", `Added ${path.replace(/^media\//, "")}`);
    return path;
  } catch (e) {
    toast.update(id, "error", `Upload failed: ${(e as Error).message}`);
    return null;
  }
}

/** End of the last clip on a clip list (append point); 0 if empty. */
const lastEnd = (clips: { end: number }[]): number => clips.reduce((m, c) => Math.max(m, c.end), 0);

const framesFor = (durationSec: number, fps: number, fallbackSec: number): number =>
  Math.max(1, Math.round((durationSec > 0 ? durationSec : fallbackSec) * fps));

/** Add a NEW video clip (from a provided file or the file picker) to the video
 *  track, appended after its last clip. Default fit:'cover' = fullscreen. */
export async function addVideoToTrack(
  tl: TimelineV3,
  trackId: string,
  file: File | null,
  toast: ToastApi
): Promise<AddResult> {
  const f = file ?? (await openFilePicker("video/*"));
  if (!f) return { tl, selection: null };
  if (kindOfFile(f) !== "video") {
    toast.show("error", `Not a video file: ${f.name}`);
    return { tl, selection: null };
  }
  const [path, info] = await Promise.all([uploadWithStatus(f, toast), probeMedia(f, "video")]);
  if (!path) return { tl, selection: null };
  const tr = tl.tracks.find((t) => t.id === trackId);
  const start = tr?.kind === "video" ? lastEnd(tr.clips) : 0;
  const end = start + framesFor(info.durationSec, tl.fps, VIDEO_FALLBACK_SEC);
  const { tl: next, clipIndex } = addVideoClip(tl, trackId, start, end, { src: path, fit: "cover", startFrom: 0 });
  return { tl: next, selection: clipIndex >= 0 ? { kind: "clip", trackId, clipIndex } : null };
}

/** Add a NEW image clip (from a provided file or the file picker) to an image
 *  track at `at` (absolute frame), sized from the image's natural dimensions. */
export async function addImageToTrack(
  tl: TimelineV3,
  trackId: string,
  file: File | null,
  at: number,
  toast: ToastApi
): Promise<AddResult> {
  const f = file ?? (await openFilePicker("image/*"));
  if (!f) return { tl, selection: null };
  if (kindOfFile(f) !== "image") {
    toast.show("error", `Not an image file: ${f.name}`);
    return { tl, selection: null };
  }
  const [path, info] = await Promise.all([uploadWithStatus(f, toast), probeMedia(f, "image")]);
  if (!path) return { tl, selection: null };
  const start = Math.max(0, Math.round(at));
  const end = start + IMG_DEFAULT_SEC * tl.fps;
  const { width, height } = fitBox(info.width, info.height);
  const { tl: next, clipIndex } = addImageClip(tl, trackId, start, end, { src: path, width, height, fit: "cover" });
  return { tl: next, selection: clipIndex >= 0 ? { kind: "clip", trackId, clipIndex } : null };
}

/**
 * Replace an EXISTING visual clip's media (A4 "Replace media"). For a video clip,
 * `asBox` switches it to a centered box (fit:'contain') sized from the video's
 * natural dimensions. Returns the new timeline (or the original if cancelled).
 */
export async function replaceClipMedia(
  tl: TimelineV3,
  trackId: string,
  clipIndex: number,
  file: File | null,
  toast: ToastApi,
  opts: { asBox?: boolean } = {}
): Promise<TimelineV3> {
  const tr = tl.tracks.find((t) => t.id === trackId);
  if (!tr || (tr.kind !== "video" && tr.kind !== "image")) return tl;
  const clip = tr.clips[clipIndex];
  if (!clip || clip.kind === "color") return tl;

  const want: MediaKind = clip.kind === "image" ? "image" : "video";
  const f = file ?? (await openFilePicker(clip.kind === "image" ? "image/*" : "video/*"));
  if (!f) return tl;
  if (kindOfFile(f) !== want) {
    toast.show("error", `Expected ${want}, got ${f.name}`);
    return tl;
  }
  const [path, info] = await Promise.all([uploadWithStatus(f, toast), probeMedia(f, want)]);
  if (!path) return tl;

  if (clip.kind === "image") {
    const { width, height } = fitBox(info.width, info.height);
    return updateClip(tl, trackId, clipIndex, { src: path, width, height });
  }
  const patch: ClipPatch = { src: path, startFrom: 0 };
  if (opts.asBox) {
    const { width, height } = fitBox(info.width, info.height);
    patch.fit = "contain";
    patch.x = 0;
    patch.y = 0;
    patch.width = width;
    patch.height = height;
    if ((clip as VideoClip).borderRadius === undefined) patch.borderRadius = 24;
  } else {
    patch.fit = "cover";
  }
  return updateClip(tl, trackId, clipIndex, patch);
}

/** Finder drop onto a specific track lane (A3). Routes by file kind; rejects a
 *  mismatch (e.g. an image dropped on the video lane) with a clear toast. */
export async function addDroppedToTrack(
  tl: TimelineV3,
  trackId: string,
  file: File,
  at: number,
  toast: ToastApi
): Promise<AddResult> {
  const tr = tl.tracks.find((t) => t.id === trackId);
  const kind = kindOfFile(file);
  if (!tr || !kind) {
    toast.show("error", `Unsupported file: ${file.name}`);
    return { tl, selection: null };
  }
  if (tr.kind === "video" && kind === "video") return addVideoToTrack(tl, trackId, file, toast);
  if (tr.kind === "image" && kind === "image") return addImageToTrack(tl, trackId, file, at, toast);
  toast.show("error", `Can't drop a ${kind} onto the ${tr.kind} track`);
  return { tl, selection: null };
}

/** Finder drop onto the preview canvas (A3): video → video track; image → top
 *  image track (creating one if none). */
export async function addDroppedToCanvas(
  tl: TimelineV3,
  file: File,
  at: number,
  toast: ToastApi
): Promise<AddResult> {
  const kind = kindOfFile(file);
  if (kind === "video") {
    const vt = videoTrackOf(tl);
    if (!vt) {
      toast.show("error", "No video track to receive the drop");
      return { tl, selection: null };
    }
    return addVideoToTrack(tl, vt.id, file, toast);
  }
  if (kind === "image") {
    let next = tl;
    let imgs = imageTracksOf(next);
    if (imgs.length === 0) {
      next = addTrack(next, "image");
      imgs = imageTracksOf(next);
    }
    const trackId = imgs[imgs.length - 1]?.id;
    if (!trackId) {
      toast.show("error", "Couldn't create an image track");
      return { tl, selection: null };
    }
    return addImageToTrack(next, trackId, file, at, toast);
  }
  toast.show("error", `Unsupported file: ${file.name}`);
  return { tl, selection: null };
}
