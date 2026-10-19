// Single source of truth for composition timing math + absolute↔scene-relative
// frame mapping. Shared by the engine (Video.tsx, Root.tsx) AND the editor.
//
// CRITICAL — transition overlap (CONTRACT §4.1): a transition's duration is an
// OVERLAP. It consumes that many frames from the END of scene A and the START
// of scene B (they blend simultaneously). Therefore:
//
//   total composition duration = Σ(scene durations) − Σ(transition overlaps)
//
// A transition cannot exceed either adjacent scene, so its effective overlap is
// clamped to min(sceneA.duration, sceneB.duration) − 1 (keep ≥1 frame of each
// scene non-overlapping so neither sequence vanishes). type "none" or a value
// ≤0 means "no transition" (hard cut, identical to v1).

import type { AudioTrack, Scene, SpeechRegion, Timeline } from "./types";

/**
 * Effective overlap (in frames) between scene at index `i` and the next scene.
 * 0 = hard cut (no transition / last scene / type "none" / clamped to nothing).
 */
export const overlapAfter = (timeline: Timeline, i: number): number => {
  const scene = timeline.scenes[i];
  const next = timeline.scenes[i + 1];
  if (!scene || !next) return 0; // last scene: nothing to transition into
  const t = scene.transitionToNext;
  if (!t || t.type === "none") return 0;
  const want = Math.round(t.durationInFrames);
  if (want <= 0) return 0;
  // Keep at least 1 non-overlapping frame in each adjacent scene.
  const max = Math.max(0, Math.min(scene.durationInFrames, next.durationInFrames) - 1);
  return Math.min(want, max);
};

/** Whether a real <TransitionSeries.Transition> is inserted after scene `i`. */
export const hasTransitionAfter = (timeline: Timeline, i: number): boolean =>
  overlapAfter(timeline, i) > 0;

/** Absolute start frame of each scene on the global timeline (accounts for overlaps). */
export const sceneOffsets = (timeline: Timeline): number[] => {
  const offsets: number[] = [];
  let cursor = 0;
  timeline.scenes.forEach((scene, i) => {
    offsets.push(cursor);
    cursor += scene.durationInFrames - overlapAfter(timeline, i);
  });
  return offsets;
};

/** Total composition length = Σ scene durations − Σ overlaps. Always ≥ 1. */
export const totalDurationInFrames = (timeline: Timeline): number => {
  if (timeline.scenes.length === 0) return 1;
  const offsets = sceneOffsets(timeline);
  const last = timeline.scenes.length - 1;
  return Math.max(1, offsets[last] + timeline.scenes[last].durationInFrames);
};

export type AbsRange = { start: number; end: number };

/** Absolute [start,end] range of a word given its scene index (scene-relative start/end → absolute). */
export const wordAbsRange = (
  timeline: Timeline,
  sceneIndex: number,
  word: { start: number; end: number }
): AbsRange => {
  const offset = sceneOffsets(timeline)[sceneIndex] ?? 0;
  return { start: offset + word.start, end: offset + word.end };
};

/** Convert an absolute timeline frame back to a scene-relative frame for `sceneIndex`. */
export const absToSceneFrame = (
  timeline: Timeline,
  sceneIndex: number,
  absFrame: number
): number => (absFrame - (sceneOffsets(timeline)[sceneIndex] ?? 0));

/** Absolute [start,end] range that scene `i` occupies on the global timeline. */
export const sceneAbsRange = (timeline: Timeline, i: number): AbsRange => {
  const offset = sceneOffsets(timeline)[i] ?? 0;
  return { start: offset, end: offset + (timeline.scenes[i]?.durationInFrames ?? 0) };
};

export type ActiveWord = { sceneIndex: number; wordIndex: number };

/**
 * Words active at an absolute frame: start ≤ frame ≤ end (inclusive of the
 * appearance frame; matches Word.tsx's [start,end) at the same boundary closely
 * enough for the editor's "active-only" canvas). During a transition's overlap
 * BOTH adjacent scenes' words can be active — mirroring the render exactly.
 */
// ===== Audio: speech regions + music volume envelope (CONTRACT §4 derived) =====

export type AbsRegion = { start: number; end: number };

/** Accept either the v2 AudioTrack object or a legacy bare string path. */
export const normalizeAudio = (audio: Timeline["audio"] | string | null): AudioTrack | null => {
  if (audio == null) return null;
  if (typeof audio === "string") return { src: audio, volume: 1 };
  return audio;
};

/** Frozen ASR speech regions live on a 'cover'/'box' background (CONTRACT §4). */
const backgroundSpeechRegions = (scene: Scene): SpeechRegion[] => {
  const bg = scene.background;
  if (bg && (bg.type === "cover" || bg.type === "box")) return bg.speechRegions ?? [];
  return [];
};

/**
 * Union of every scene's background `speechRegions` mapped to ABSOLUTE frames
 * (accounts for transition overlaps), merged so overlapping/adjacent intervals
 * collapse. This is the ducking envelope's speech mask.
 */
export const speechRegionsAbsolute = (timeline: Timeline): AbsRegion[] => {
  const offsets = sceneOffsets(timeline);
  const regions: AbsRegion[] = [];
  timeline.scenes.forEach((scene, i) => {
    const off = offsets[i];
    backgroundSpeechRegions(scene).forEach((r) =>
      regions.push({ start: off + r.startFrame, end: off + r.endFrame })
    );
  });
  regions.sort((a, b) => a.start - b.start);
  const merged: AbsRegion[] = [];
  for (const r of regions) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
};

/**
 * Ducking amount g(frame) ∈ [0,1] (0 = full music, 1 = fully ducked). Each speech
 * region ramps 0→1 over attackFrames at its start, holds 1, then ramps 1→0 over
 * releaseFrames after its end. g = max across regions.
 */
const duckAmount = (
  frame: number,
  speech: AbsRegion[],
  attack: number,
  release: number
): number => {
  let g = 0;
  for (const r of speech) {
    let local = 0;
    if (frame >= r.start && frame <= r.end) {
      local = attack > 0 ? Math.min(1, (frame - r.start) / attack) : 1;
    } else if (frame > r.end && frame <= r.end + release) {
      local = release > 0 ? Math.max(0, 1 - (frame - r.end) / release) : 0;
    }
    if (local > g) g = local;
  }
  return g;
};

/**
 * Per-frame music volume: base level shaped by fade-in/out, then ducked toward
 * `duckedVolume` while speech is present (with attack/release ramps).
 */
export const musicVolumeAt = (
  track: AudioTrack,
  totalFrames: number,
  speech: AbsRegion[],
  frame: number
): number => {
  let v = track.volume;
  if (track.fadeInFrames && frame < track.fadeInFrames) {
    v *= Math.max(0, frame) / track.fadeInFrames;
  }
  if (track.fadeOutFrames) {
    const tail = totalFrames - frame;
    if (tail < track.fadeOutFrames) v *= Math.max(0, tail) / track.fadeOutFrames;
  }
  if (track.ducking?.enabled) {
    const g = duckAmount(frame, speech, track.ducking.attackFrames, track.ducking.releaseFrames);
    // Interpolate between the faded base and the absolute ducked level.
    v = v * (1 - g) + track.ducking.duckedVolume * g;
  }
  return Math.max(0, Math.min(1, v));
};

export const activeWordsAt = (timeline: Timeline, absFrame: number): ActiveWord[] => {
  const offsets = sceneOffsets(timeline);
  const out: ActiveWord[] = [];
  timeline.scenes.forEach((scene, sceneIndex) => {
    const offset = offsets[sceneIndex];
    scene.words.forEach((w, wordIndex) => {
      const s = offset + w.start;
      const e = offset + w.end;
      if (absFrame >= s && absFrame < e) out.push({ sceneIndex, wordIndex });
    });
  });
  return out;
};
