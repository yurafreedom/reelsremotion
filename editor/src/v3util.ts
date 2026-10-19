// Editor-side timing/topology helpers for the v3 (tracks, absolute axis) model.
// The engine owns render-time sampling/transitions (src/compose.ts, src/Video.tsx);
// this module is the editor's small read-model over a TimelineV3: total duration,
// which elements are live at a frame, and the per-clip transition overlap (mirrors
// Video.tsx segOverlapAfter so the timeline UI shows exactly what renders).

import type {
  AudioClip,
  ClipTransition,
  ColorClip,
  ImageClip,
  TimelineV3,
  Track,
  VideoClip,
} from "@engine/types.v3";
import {
  audioTrackOf,
  imageTracksOf,
  shapeTrackOf,
  textTrackOf,
  videoTrackOf,
} from "@engine/types.v3";

export type VisualClip = VideoClip | ColorClip | ImageClip;

/** Every clip/element end on a track (for duration + lane layout). */
const trackEnds = (tr: Track): number[] => {
  switch (tr.kind) {
    case "video":
    case "image":
    case "audio":
      return tr.clips.map((c) => c.end);
    case "shape":
      return tr.shapes.map((s) => s.end);
    case "text":
      return tr.words.map((w) => w.end);
  }
};

/** Total composition length = max clip/element `end` across every track. Always ≥1.
 *  (CONTRACT v3 §"Clips on a track": total = max end across tracks.) */
export const durationV3 = (tl: TimelineV3): number => {
  let max = 0;
  for (const tr of tl.tracks) for (const e of trackEnds(tr)) if (e > max) max = e;
  return Math.max(1, max);
};

/** Visual clips of the video track (video|color) in start order. */
export const videoClips = (tl: TimelineV3): (VideoClip | ColorClip)[] =>
  [...(videoTrackOf(tl)?.clips ?? [])].sort((a, b) => a.start - b.start);

/** All image clips across image tracks (each track is its own z-layer). */
export const allImageClips = (tl: TimelineV3): ImageClip[] =>
  imageTracksOf(tl).flatMap((it) => it.clips);

/** Effective transition overlap (frames) consumed AFTER clip `i` on a clip list
 *  (video track). 0 = hard cut. Mirrors Video.tsx segOverlapAfter exactly. */
export const clipOverlapAfter = (
  clips: { start: number; end: number; transitionToNext?: ClipTransition }[],
  i: number
): number => {
  const c = clips[i];
  const n = clips[i + 1];
  if (!c || !n) return 0;
  const t = c.transitionToNext;
  if (!t || t.type === "none") return 0;
  const want = Math.round(t.durationInFrames);
  if (want <= 0) return 0;
  const durA = c.end - c.start;
  const durB = n.end - n.start;
  const max = Math.max(0, Math.min(durA, durB) - 1);
  return Math.min(want, max);
};

/** Index of the video-track clip covering an absolute frame (latest started), or
 *  -1 if none. Used by the canvas to select "the background under the playhead". */
export const videoClipIndexAt = (tl: TimelineV3, frame: number): number => {
  const clips = videoTrackOf(tl)?.clips ?? [];
  let idx = -1;
  clips.forEach((c, i) => {
    if (frame >= c.start && frame < c.end) idx = i;
  });
  return idx;
};

/** Word indices live at an absolute frame (start ≤ f < end). */
export const activeWordIndices = (tl: TimelineV3, frame: number): number[] => {
  const words = textTrackOf(tl)?.words ?? [];
  const out: number[] = [];
  words.forEach((w, i) => {
    if (frame >= w.start && frame < w.end) out.push(i);
  });
  return out;
};

/** Shape indices live at an absolute frame (start ≤ f < end). */
export const activeShapeIndices = (tl: TimelineV3, frame: number): number[] => {
  const shapes = shapeTrackOf(tl)?.shapes ?? [];
  const out: number[] = [];
  shapes.forEach((s, i) => {
    if (frame >= s.start && frame < s.end) out.push(i);
  });
  return out;
};

/** Image clip indices live at an absolute frame, per image track id. */
export const activeImageClips = (
  tl: TimelineV3,
  frame: number
): { trackId: string; clipIndex: number; clip: ImageClip }[] => {
  const out: { trackId: string; clipIndex: number; clip: ImageClip }[] = [];
  for (const it of imageTracksOf(tl)) {
    it.clips.forEach((clip, clipIndex) => {
      if (frame >= clip.start && frame < clip.end) out.push({ trackId: it.id, clipIndex, clip });
    });
  }
  return out;
};

/** Audio clips across audio tracks (flattened, with track id). */
export const allAudioClips = (
  tl: TimelineV3
): { trackId: string; clipIndex: number; clip: AudioClip }[] => {
  const out: { trackId: string; clipIndex: number; clip: AudioClip }[] = [];
  const at = audioTrackOf(tl);
  if (at) at.clips.forEach((clip, clipIndex) => out.push({ trackId: at.id, clipIndex, clip }));
  return out;
};

/** Strip the migration-only `_scene` tag from words/shapes (NOT part of the
 *  on-disk CONTRACT). Returns a deep clone safe to serialize/author. */
export const stripSceneTags = (tl: TimelineV3): TimelineV3 => {
  const next: TimelineV3 = JSON.parse(JSON.stringify(tl));
  for (const tr of next.tracks) {
    if (tr.kind === "text") tr.words.forEach((w) => delete (w as { _scene?: number })._scene);
    if (tr.kind === "shape") tr.shapes.forEach((s) => delete (s as { _scene?: number })._scene);
  }
  return next;
};
