// Internal helpers shared by the animation/pattern wrappers. Not part of the
// public surface, but exported so each module can merge keyframe tracks the same
// way. The actual sampling math lives in src/keyframes.ts — this only assembles
// CONTRACT-shaped tracks; it never interpolates.

import type {
  Easing,
  Keyframe,
  KeyframeProperty,
  PositionKeyframe,
  Word,
  WordKeyframes,
} from "@engine/types";
import { ctxOf, type PresetContext } from "@engine/presets";

export { ctxOf };
export type { PresetContext };

/** Word length in frames (≥1). */
export const wordLen = (w: Word): number => Math.max(1, w.end - w.start);

/** All track keys in CONTRACT §4 order (position first). */
const TRACK_KEYS: KeyframeProperty[] = [
  "position",
  "size",
  "weight",
  "fontFamily",
  "letterSpacing",
  "color",
  "opacity",
  "rotation",
  "blur",
];

type AnyKf = { frame: number };

// Merge incoming keyframes of one track into existing ones: append, sort by
// frame, and when two share a frame the LATER-added one wins (so a second
// animation call deliberately overrides a keyframe at the same instant rather
// than producing a degenerate zero-span segment). Stable for distinct frames.
const mergeTrack = <T extends AnyKf>(existing: T[] | undefined, incoming: T[]): T[] => {
  const byFrame = new Map<number, T>();
  for (const k of existing ?? []) byFrame.set(k.frame, k);
  for (const k of incoming) byFrame.set(k.frame, k); // later wins on tie
  return [...byFrame.values()].sort((a, b) => a.frame - b.frame);
};

/**
 * Merge a generated `WordKeyframes` into `word.keyframes` (creating it if
 * absent), per-track. This is how every animation wrapper composes: e.g.
 * slideIn writes position+opacity, then fadeOut appends to the SAME opacity
 * track, then emphasize appends size+color — all stacking into one valid set.
 */
export const applyKeyframes = (word: Word, kf: WordKeyframes): Word => {
  const target: WordKeyframes = word.keyframes ?? {};
  for (const key of TRACK_KEYS) {
    const incoming = kf[key] as AnyKf[] | undefined;
    if (!incoming || incoming.length === 0) continue;
    if (key === "position") {
      target.position = mergeTrack<PositionKeyframe>(
        target.position,
        incoming as PositionKeyframe[]
      );
    } else {
      (target[key] as Keyframe<unknown>[]) = mergeTrack(
        target[key] as Keyframe<unknown>[] | undefined,
        incoming as Keyframe<unknown>[]
      );
    }
  }
  word.keyframes = target;
  return word;
};

/** Clamp a word-relative frame into the word's live window [0, len]. */
export const clampToLife = (w: Word, frame: number): number =>
  Math.max(0, Math.min(wordLen(w), Math.round(frame)));

export type { Easing };
