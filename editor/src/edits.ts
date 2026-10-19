// Immutable TimelineV3 edit helpers. Every function returns a NEW timeline so React
// state updates and the <Player> re-renders. All clip/element start/end are
// ABSOLUTE timeline frames (CONTRACT v3 §3). Keyframe frames stay ELEMENT-relative
// and are NEVER touched here except where a CUT re-bases an element's start (then
// the split keyframes are shifted to preserve their absolute position).

import type {
  Ducking,
  Shape,
  ShapeType,
  Word,
} from "@engine/types";
import type {
  AudioClip,
  AudioTrackV3,
  ClipTransition,
  ColorClip,
  ImageClip,
  ImageTrack,
  TimelineV3,
  Track,
  VideoClip,
  VideoTrack,
} from "@engine/types.v3";
import { imageTracksOf } from "@engine/types.v3";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Keep only the (absolute) speech regions overlapping [start,end), clamped to it.
 *  Used when a video clip is cut so each piece carries its own aligned regions. */
const clipSpeechRegions = (
  regions: { startFrame: number; endFrame: number }[],
  start: number,
  end: number
): { startFrame: number; endFrame: number }[] =>
  regions
    .filter((r) => r.endFrame > start && r.startFrame < end)
    .map((r) => ({
      startFrame: Math.max(r.startFrame, start),
      endFrame: Math.min(r.endFrame, end),
    }));

export const MAX_TRACKS = 8;

// ── Track lookup ────────────────────────────────────────────────────────────
const trackById = (tl: TimelineV3, id: string): Track | undefined =>
  tl.tracks.find((t) => t.id === id);

const uniqueId = (base: string, taken: Set<string>): string => {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
};

const allIds = (tl: TimelineV3): Set<string> => {
  const s = new Set<string>();
  for (const tr of tl.tracks) {
    s.add(tr.id);
    if (tr.kind === "video" || tr.kind === "image" || tr.kind === "audio")
      tr.clips.forEach((c) => s.add(c.id));
    if (tr.kind === "shape") tr.shapes.forEach((sh) => s.add(sh.id));
  }
  return s;
};

// ===== Words (single text track) ============================================

const textWords = (tl: TimelineV3): Word[] | undefined => {
  const tr = tl.tracks.find((t): t is Extract<Track, { kind: "text" }> => t.kind === "text");
  return tr?.words;
};

export function updateWord(tl: TimelineV3, wordIndex: number, patch: Partial<Word>): TimelineV3 {
  const next = clone(tl);
  const w = textWords(next)?.[wordIndex];
  if (!w) return tl;
  Object.assign(w, patch);
  return next;
}

export function deleteWord(tl: TimelineV3, wordIndex: number): TimelineV3 {
  const next = clone(tl);
  textWords(next)?.splice(wordIndex, 1);
  return next;
}

export function addWord(tl: TimelineV3, word: Word): TimelineV3 {
  const next = clone(tl);
  textWords(next)?.push(word);
  return next;
}

export function duplicateWord(tl: TimelineV3, wordIndex: number): TimelineV3 {
  const next = clone(tl);
  const words = textWords(next);
  const src = words?.[wordIndex];
  if (!words || !src) return tl;
  const copy = clone(src);
  copy.x += 24;
  copy.y += 24;
  words.splice(wordIndex + 1, 0, copy);
  return next;
}

// ===== Shapes (single shape track) ==========================================

const shapeArr = (tl: TimelineV3): Shape[] | undefined => {
  const tr = tl.tracks.find((t): t is Extract<Track, { kind: "shape" }> => t.kind === "shape");
  return tr?.shapes;
};

export function defaultShape(type: ShapeType, start: number, end: number, id: string): Shape {
  const base: Shape = {
    id,
    shape: type,
    start,
    end,
    x: 0,
    y: 0,
    width: type === "line" ? 600 : 400,
    height: type === "line" ? 8 : 200,
    color: type === "line" ? "#ffffff" : "#c0182a",
  };
  if (type === "rect") base.borderRadius = 16;
  return base;
}

/** Add a shape spanning [start,end] (caller passes the active range). Ensures a
 *  shape track exists (creates one just below text if missing). */
export function addShape(tl: TimelineV3, type: ShapeType, start: number, end: number): TimelineV3 {
  const next = clone(tl);
  let tr = next.tracks.find((t): t is Extract<Track, { kind: "shape" }> => t.kind === "shape");
  if (!tr) {
    tr = { id: uniqueId("shape", allIds(next)), kind: "shape", shapes: [] };
    // Insert just before the text track (shape sits below text in z-order).
    const ti = next.tracks.findIndex((t) => t.kind === "text");
    if (ti >= 0) next.tracks.splice(ti, 0, tr);
    else next.tracks.push(tr);
  }
  const taken = new Set(tr.shapes.map((s) => s.id));
  let i = 1;
  let id = `${type}${i}`;
  while (taken.has(id)) id = `${type}${++i}`;
  tr.shapes.push(defaultShape(type, start, Math.max(start + 1, end), id));
  return next;
}

export function updateShape(tl: TimelineV3, shapeIndex: number, patch: Partial<Shape>): TimelineV3 {
  const next = clone(tl);
  const sh = shapeArr(next)?.[shapeIndex];
  if (!sh) return tl;
  Object.assign(sh, patch);
  return next;
}

export function deleteShape(tl: TimelineV3, shapeIndex: number): TimelineV3 {
  const next = clone(tl);
  shapeArr(next)?.splice(shapeIndex, 1);
  return next;
}

export function duplicateShape(tl: TimelineV3, shapeIndex: number): TimelineV3 {
  const next = clone(tl);
  const shapes = shapeArr(next);
  const src = shapes?.[shapeIndex];
  if (!shapes || !src) return tl;
  const taken = new Set(shapes.map((s) => s.id));
  let i = 1;
  let id = `${src.shape}${i}`;
  while (taken.has(id)) id = `${src.shape}${++i}`;
  const copy = clone(src);
  copy.id = id;
  copy.x += 24;
  copy.y += 24;
  shapes.splice(shapeIndex + 1, 0, copy);
  return next;
}

// ===== Visual clips (video|color on video track; image on image tracks) =====

type VisualTrack = VideoTrack | ImageTrack;
const visualTrack = (tl: TimelineV3, trackId: string): VisualTrack | undefined => {
  const tr = trackById(tl, trackId);
  return tr && (tr.kind === "video" || tr.kind === "image") ? tr : undefined;
};

export type VisualClip = VideoClip | ColorClip | ImageClip;

/** A field patch valid for any visual clip kind. Using the intersection of three
 *  Partials (not Partial of the intersection) keeps each field's own type instead
 *  of collapsing conflicting members (e.g. `kind`) to `never`. */
export type ClipPatch = Partial<VideoClip> & Partial<ColorClip> & Partial<ImageClip>;

/** Generic field patch on a visual clip (any kind). */
export function updateClip(
  tl: TimelineV3,
  trackId: string,
  clipIndex: number,
  patch: ClipPatch
): TimelineV3 {
  const next = clone(tl);
  const tr = visualTrack(next, trackId);
  const c = tr?.clips[clipIndex];
  if (!c) return tl;
  Object.assign(c, patch);
  return next;
}

/** Delete a visual clip. On a VIDEO track this RIPPLES the gap closed: every clip
 *  that started at/after the removed one shifts left by its duration, so the
 *  remaining pieces join (cut-out-an-unwanted-middle-and-keep-the-rest). Ripple is
 *  scoped to THIS track only — other tracks are untouched (CONTRACT: no cross-track
 *  ripple). The removed clip's embedded audio goes with it (it's part of the clip).
 *  IMAGE tracks are free-positioned overlays, so an image delete just removes (no
 *  ripple — sliding unrelated overlays would surprise). */
export function deleteClip(tl: TimelineV3, trackId: string, clipIndex: number): TimelineV3 {
  const next = clone(tl);
  const tr = visualTrack(next, trackId);
  const removed = tr?.clips[clipIndex];
  if (!tr || !removed) return tl;
  const dur = removed.end - removed.start;
  const from = removed.start;
  tr.clips.splice(clipIndex, 1);
  if (tr.kind === "video") {
    for (const c of tr.clips) {
      if (c.start >= from) {
        c.start -= dur;
        c.end -= dur;
      }
    }
  }
  return next;
}

/** Re-time a clip (splice): shift start/end by `delta`, keeping duration and
 *  source in-point. Clamps start ≥ 0. Element keyframes (image) stay relative. */
export function moveClip(tl: TimelineV3, trackId: string, clipIndex: number, newStart: number): TimelineV3 {
  const next = clone(tl);
  const tr = visualTrack(next, trackId);
  const c = tr?.clips[clipIndex];
  if (!c) return tl;
  const dur = c.end - c.start;
  const start = Math.max(0, Math.round(newStart));
  c.start = start;
  c.end = start + dur;
  return next;
}

/** Move a visual clip to ANOTHER track of the SAME kind (v3.4 cross-track move,
 *  pro-NLE behavior). Removes it from the source track's `clips` and appends it to
 *  the target track's, re-timed to `newStart` (duration / source in-point / image
 *  keyframes are carried untouched). Same-kind ONLY: a video|color clip moves
 *  between VIDEO tracks, an image clip between IMAGE tracks — a kind mismatch (or
 *  missing track) is rejected and the timeline is returned unchanged. When source
 *  and target are the same track this is a plain in-track re-time (`moveClip`).
 *  Returns the new timeline plus the clip's index on the target track (for reselect). */
export function moveClipToTrack(
  tl: TimelineV3,
  fromTrackId: string,
  clipIndex: number,
  toTrackId: string,
  newStart: number
): { tl: TimelineV3; clipIndex: number } {
  if (fromTrackId === toTrackId) return { tl: moveClip(tl, fromTrackId, clipIndex, newStart), clipIndex };
  const next = clone(tl);
  const from = visualTrack(next, fromTrackId);
  const to = visualTrack(next, toTrackId);
  // Reject cross-type (video↔image) and unknown tracks — leaves the model intact.
  if (!from || !to || from.kind !== to.kind) return { tl, clipIndex };
  const c = from.clips[clipIndex];
  if (!c) return { tl, clipIndex };
  const dur = c.end - c.start;
  const start = Math.max(0, Math.round(newStart));
  c.start = start;
  c.end = start + dur;
  from.clips.splice(clipIndex, 1);
  (to.clips as VisualClip[]).push(c);
  return { tl: next, clipIndex: to.clips.length - 1 };
}

/** Trim a clip edge. `edge:'l'` moves start (and advances startFrom for media);
 *  `edge:'r'` moves end. Clamps so duration ≥ 1 and startFrom ≥ 0. */
export function trimClip(
  tl: TimelineV3,
  trackId: string,
  clipIndex: number,
  edge: "l" | "r",
  newFrame: number
): TimelineV3 {
  const next = clone(tl);
  const tr = visualTrack(next, trackId);
  const c = tr?.clips[clipIndex];
  if (!c) return tl;
  const f = Math.round(newFrame);
  if (edge === "l") {
    const start = Math.max(0, Math.min(f, c.end - 1));
    const delta = start - c.start;
    if ("startFrom" in c) {
      // Don't reveal before source frame 0.
      const sf = (c as VideoClip).startFrom + delta;
      if (sf < 0) {
        // Clamp: limit how far left we can drag to where startFrom hits 0.
        const limited = c.start - (c as VideoClip).startFrom;
        c.start = Math.max(0, limited);
        (c as VideoClip).startFrom = 0;
        return next;
      }
      (c as VideoClip).startFrom = sf;
    }
    c.start = start;
  } else {
    c.end = Math.max(c.start + 1, f);
  }
  return next;
}

/** Cut (split) a video/color clip at absolute frame F into two clips. The second
 *  continues the source (startFrom advances). The transitionToNext moves to the
 *  second half; the join A→B is a hard cut. Image clips also split, shifting the
 *  second half's element-relative keyframes so they keep their absolute position. */
export function cutClip(tl: TimelineV3, trackId: string, clipIndex: number, atFrame: number): TimelineV3 {
  const next = clone(tl);
  const tr = visualTrack(next, trackId);
  const c = tr?.clips[clipIndex];
  if (!tr || !c) return tl;
  const F = Math.round(atFrame);
  if (F <= c.start || F >= c.end) return tl; // nothing to split
  const a = clone(c);
  const b = clone(c);
  a.end = F;
  delete (a as VideoClip).transitionToNext;
  b.start = F;
  if ("startFrom" in b) (b as VideoClip).startFrom = (c as VideoClip).startFrom + (F - c.start);
  b.id = uniqueId(`${c.id}-b`, allIds(next));
  // ASR speechRegions are ABSOLUTE; each piece keeps only the regions overlapping
  // its own [start,end), clamped — so ducking stays aligned and nothing leaks across
  // the cut. (Regions are frozen ranges, so clamping a boundary is the correct split.)
  if ((c as VideoClip).speechRegions) {
    (a as VideoClip).speechRegions = clipSpeechRegions((c as VideoClip).speechRegions!, a.start, a.end);
    (b as VideoClip).speechRegions = clipSpeechRegions((c as VideoClip).speechRegions!, b.start, b.end);
  }
  // Image clip keyframes are relative to element start; rebase B's by the shift.
  if (b.kind === "image" && (b as ImageClip).keyframes) {
    const shift = F - c.start;
    const kf = (b as ImageClip).keyframes as Record<string, { frame: number }[]>;
    for (const k of Object.keys(kf)) kf[k] = kf[k].map((p) => ({ ...p, frame: p.frame - shift })).filter((p) => p.frame >= 0);
  }
  (tr.clips as VisualClip[]).splice(clipIndex, 1, a, b);
  return next;
}

/** Toggle a video-track clip between a real video clip and a solid color clip,
 *  carrying src/backColor across (the v2 "background type" affordance). */
export function setVideoClipKind(
  tl: TimelineV3,
  trackId: string,
  clipIndex: number,
  kind: "video" | "color"
): TimelineV3 {
  const next = clone(tl);
  const tr = trackById(next, trackId);
  if (!tr || tr.kind !== "video") return tl;
  const c = tr.clips[clipIndex];
  if (!c || c.kind === kind) return tl;
  if (kind === "color") {
    const repl: ColorClip = {
      id: c.id,
      kind: "color",
      color: c.kind === "video" ? c.backColor ?? "#000000" : "#000000",
      start: c.start,
      end: c.end,
    };
    if (c.transitionToNext) repl.transitionToNext = c.transitionToNext;
    tr.clips[clipIndex] = repl;
  } else {
    const repl: VideoClip = {
      id: c.id,
      kind: "video",
      src: "placeholder",
      start: c.start,
      end: c.end,
      startFrom: 0,
      fit: "cover",
    };
    if (c.kind === "color") repl.backColor = c.color;
    if (c.transitionToNext) repl.transitionToNext = c.transitionToNext;
    tr.clips[clipIndex] = repl;
  }
  return next;
}

// ── Per-clip transition (join with the next clip on the SAME track) ──────────
export function setClipTransition(
  tl: TimelineV3,
  trackId: string,
  clipIndex: number,
  transition: ClipTransition | null
): TimelineV3 {
  const next = clone(tl);
  const tr = visualTrack(next, trackId);
  const c = tr?.clips[clipIndex];
  if (!c) return tl;
  if (transition === null || transition.type === "none") delete c.transitionToNext;
  else c.transitionToNext = transition;
  return next;
}

export function updateClipTransition(
  tl: TimelineV3,
  trackId: string,
  clipIndex: number,
  patch: Partial<ClipTransition>
): TimelineV3 {
  const next = clone(tl);
  const tr = visualTrack(next, trackId);
  const c = tr?.clips[clipIndex];
  if (!c?.transitionToNext) return tl;
  Object.assign(c.transitionToNext, patch);
  return next;
}

// ===== Visual clips (add) ===================================================

/** Append a new VIDEO clip to the video track and return the new timeline plus the
 *  index of the appended clip (for selection). `init` overrides defaults (src,
 *  fit, box geometry…). Default = fullscreen `cover` (A4: zero manual placement). */
export function addVideoClip(
  tl: TimelineV3,
  trackId: string,
  start: number,
  end: number,
  init: Partial<VideoClip> = {}
): { tl: TimelineV3; clipIndex: number } {
  const next = clone(tl);
  const tr = trackById(next, trackId);
  if (!tr || tr.kind !== "video") return { tl, clipIndex: -1 };
  const s = Math.max(0, Math.round(start));
  const clip: VideoClip = {
    id: uniqueId("vid", allIds(next)),
    kind: "video",
    src: "placeholder",
    start: s,
    end: Math.max(s + 1, Math.round(end)),
    startFrom: 0,
    fit: "cover",
    ...init,
  };
  tr.clips.push(clip);
  return { tl: next, clipIndex: tr.clips.length - 1 };
}

// ===== Image clips (add/insert) =============================================

/** Append a new IMAGE clip to an image track. `init` overrides defaults (src, size,
 *  fit…). Returns the new timeline plus the appended clip index (for selection). */
export function addImageClip(
  tl: TimelineV3,
  trackId: string,
  start: number,
  end: number,
  init: Partial<ImageClip> = {}
): { tl: TimelineV3; clipIndex: number } {
  const next = clone(tl);
  const tr = trackById(next, trackId);
  if (!tr || tr.kind !== "image") return { tl, clipIndex: -1 };
  const clip: ImageClip = {
    id: uniqueId("img", allIds(next)),
    kind: "image",
    src: "placeholder",
    start: Math.max(0, Math.round(start)),
    end: Math.max(Math.round(start) + 1, Math.round(end)),
    x: 0,
    y: 0,
    width: 600,
    height: 600,
    fit: "cover",
    borderRadius: 0,
    ...init,
  };
  tr.clips.push(clip);
  return { tl: next, clipIndex: tr.clips.length - 1 };
}

// ===== Tracks (add / remove) ================================================

export function addTrack(tl: TimelineV3, kind: "image" | "audio"): TimelineV3 {
  if (tl.tracks.length >= MAX_TRACKS) return tl;
  const next = clone(tl);
  if (kind === "image") {
    const tr: ImageTrack = { id: uniqueId("image", allIds(next)), kind: "image", clips: [] };
    // Place above the topmost existing image track (or just above video).
    const lastImg = [...next.tracks].reverse().findIndex((t) => t.kind === "image");
    if (lastImg >= 0) next.tracks.splice(next.tracks.length - lastImg, 0, tr);
    else {
      const vi = next.tracks.findIndex((t) => t.kind === "video");
      next.tracks.splice(vi >= 0 ? vi + 1 : 0, 0, tr);
    }
  } else {
    const tr: AudioTrackV3 = { id: uniqueId("audio", allIds(next)), kind: "audio", clips: [] };
    next.tracks.push(tr);
  }
  return next;
}

export function deleteTrack(tl: TimelineV3, trackId: string): TimelineV3 {
  const next = clone(tl);
  const tr = trackById(next, trackId);
  // Never delete the primary video/text track (keeps a valid document).
  if (!tr || tr.kind === "video" || tr.kind === "text") return tl;
  next.tracks = next.tracks.filter((t) => t.id !== trackId);
  return next;
}

// ===== Audio clips ==========================================================

const audioTrack = (tl: TimelineV3, trackId: string): AudioTrackV3 | undefined => {
  const tr = trackById(tl, trackId);
  return tr?.kind === "audio" ? tr : undefined;
};

/** First audio track id (creating one if none), for "+ add music" affordances. */
export function ensureAudioTrack(tl: TimelineV3): { tl: TimelineV3; trackId: string } {
  const existing = tl.tracks.find((t) => t.kind === "audio");
  if (existing) return { tl, trackId: existing.id };
  const next = clone(tl);
  const tr: AudioTrackV3 = { id: uniqueId("audio", allIds(next)), kind: "audio", clips: [] };
  next.tracks.push(tr);
  return { tl: next, trackId: tr.id };
}

export function addAudioClip(tl: TimelineV3, trackId: string, clip: Omit<AudioClip, "id">): TimelineV3 {
  const next = clone(tl);
  const tr = audioTrack(next, trackId);
  if (!tr) return tl;
  tr.clips.push({ ...clip, id: uniqueId("aud", allIds(next)) });
  return next;
}

export function updateAudioClip(
  tl: TimelineV3,
  trackId: string,
  clipIndex: number,
  patch: Partial<AudioClip>
): TimelineV3 {
  const next = clone(tl);
  const c = audioTrack(next, trackId)?.clips[clipIndex];
  if (!c) return tl;
  Object.assign(c, patch);
  return next;
}

export function deleteAudioClip(tl: TimelineV3, trackId: string, clipIndex: number): TimelineV3 {
  const next = clone(tl);
  audioTrack(next, trackId)?.clips.splice(clipIndex, 1);
  return next;
}

export function moveAudioClip(tl: TimelineV3, trackId: string, clipIndex: number, newStart: number): TimelineV3 {
  const next = clone(tl);
  const c = audioTrack(next, trackId)?.clips[clipIndex];
  if (!c) return tl;
  const dur = c.end - c.start;
  c.start = Math.max(0, Math.round(newStart));
  c.end = c.start + dur;
  return next;
}

/** Move an audio clip to ANOTHER audio track (v3.4 cross-track move). Removes it
 *  from the source track and appends to the target, re-timed to `newStart` (keeps
 *  duration + source in-point). Both tracks must be audio; otherwise unchanged.
 *  Same track → plain in-track re-time. Returns the new target-track clip index. */
export function moveAudioClipToTrack(
  tl: TimelineV3,
  fromTrackId: string,
  clipIndex: number,
  toTrackId: string,
  newStart: number
): { tl: TimelineV3; clipIndex: number } {
  if (fromTrackId === toTrackId) return { tl: moveAudioClip(tl, fromTrackId, clipIndex, newStart), clipIndex };
  const next = clone(tl);
  const from = audioTrack(next, fromTrackId);
  const to = audioTrack(next, toTrackId);
  if (!from || !to) return { tl, clipIndex };
  const c = from.clips[clipIndex];
  if (!c) return { tl, clipIndex };
  const dur = c.end - c.start;
  c.start = Math.max(0, Math.round(newStart));
  c.end = c.start + dur;
  from.clips.splice(clipIndex, 1);
  to.clips.push(c);
  return { tl: next, clipIndex: to.clips.length - 1 };
}

export function trimAudioClip(
  tl: TimelineV3,
  trackId: string,
  clipIndex: number,
  edge: "l" | "r",
  newFrame: number
): TimelineV3 {
  const next = clone(tl);
  const c = audioTrack(next, trackId)?.clips[clipIndex];
  if (!c) return tl;
  const f = Math.round(newFrame);
  if (edge === "l") {
    const start = Math.max(0, Math.min(f, c.end - 1));
    const delta = start - c.start;
    const sf = c.startFrom + delta;
    if (sf < 0) {
      const limited = c.start - c.startFrom;
      c.start = Math.max(0, limited);
      c.startFrom = 0;
      return next;
    }
    c.startFrom = sf;
    c.start = start;
  } else {
    c.end = Math.max(c.start + 1, f);
  }
  return next;
}

export function cutAudioClip(tl: TimelineV3, trackId: string, clipIndex: number, atFrame: number): TimelineV3 {
  const next = clone(tl);
  const tr = audioTrack(next, trackId);
  const c = tr?.clips[clipIndex];
  if (!tr || !c) return tl;
  const F = Math.round(atFrame);
  if (F <= c.start || F >= c.end) return tl;
  const a = clone(c);
  const b = clone(c);
  a.end = F;
  b.start = F;
  b.startFrom = c.startFrom + (F - c.start);
  b.id = uniqueId(`${c.id}-b`, allIds(next));
  tr.clips.splice(clipIndex, 1, a, b);
  return next;
}

export function updateDucking(
  tl: TimelineV3,
  trackId: string,
  clipIndex: number,
  patch: Partial<Ducking>
): TimelineV3 {
  const next = clone(tl);
  const c = audioTrack(next, trackId)?.clips[clipIndex];
  if (!c) return tl;
  const base: Ducking = c.ducking ?? {
    enabled: false,
    duckedVolume: 0.15,
    attackFrames: 6,
    releaseFrames: 12,
  };
  c.ducking = { ...base, ...patch };
  return next;
}

// Image-track helper exported for canvas/panel use.
export const imageTrackIds = (tl: TimelineV3): string[] => imageTracksOf(tl).map((t) => t.id);
