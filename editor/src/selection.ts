// What is currently selected in the editor (drives the right-hand panel and
// canvas/timeline highlight). null = nothing selected.
//
// v3 (CONTRACT v3 — tracks on an ABSOLUTE timeline). The scene model is gone, so
// selections address tracks/clips/elements directly:
//   - clip       → a visual clip (video|color|image) on a video/image track
//   - word       → a word on the single text track (absolute start/end)
//   - shape      → a shape on the single shape track (absolute start/end)
//   - transition → the transitionToNext at a clip's JOIN with the next clip
//   - audioClip  → an audio clip on an audio track
//   - track      → a whole track (header select; e.g. to add/remove)
// (keyframe sub-selection is tracked separately as KfSelection.)
export type Selection =
  | { kind: "clip"; trackId: string; clipIndex: number }
  | { kind: "word"; wordIndex: number }
  | { kind: "shape"; shapeIndex: number }
  | { kind: "transition"; trackId: string; clipIndex: number }
  | { kind: "audioClip"; trackId: string; clipIndex: number }
  | { kind: "track"; trackId: string }
  | null;

export const sameSelection = (a: Selection, b: Selection): boolean => {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "word":
      return a.wordIndex === (b as { wordIndex: number }).wordIndex;
    case "shape":
      return a.shapeIndex === (b as { shapeIndex: number }).shapeIndex;
    case "track":
      return a.trackId === (b as { trackId: string }).trackId;
    case "clip":
    case "transition":
    case "audioClip": {
      const bb = b as { trackId: string; clipIndex: number };
      return a.trackId === bb.trackId && a.clipIndex === bb.clipIndex;
    }
  }
};
