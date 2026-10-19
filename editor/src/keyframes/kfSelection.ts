// Keyframe sub-selection (within the currently-selected word) + clipboard state.
// Kept separate from the main `Selection` so selecting diamonds doesn't disturb
// the word/clip/transition selection that drives the property panel.
//
// v3: words live on the single text track, so a word is addressed by `wordIndex`
// alone (no scene).

import type { KeyframeProperty } from "@engine/types";
import type { WordRef } from "./kfEdits";

/** Which keyframes (diamonds) are selected on the active word's tracks.
 *  All selected diamonds belong to ONE property/track at a time. */
export type KfSelection = {
  wordIndex: number;
  property: KeyframeProperty;
  indices: number[];
} | null;

export const sameWord = (a: KfSelection, ref: WordRef): boolean =>
  !!a && a.wordIndex === ref.wordIndex;

export const isDiamondSelected = (
  sel: KfSelection,
  ref: WordRef,
  property: KeyframeProperty,
  index: number
): boolean =>
  !!sel &&
  sel.wordIndex === ref.wordIndex &&
  sel.property === property &&
  sel.indices.includes(index);
