// Coalescing cut pieces back into one continuous element (engine-internal).
//
// A CUT splits one video clip into two contiguous pieces that share a source and
// continue its in-point (see editor cutClip). Rendered as one <OffthreadVideo> per
// piece, the preview <Player> REMOUNTS and reseeks the video at every cut — which
// shows 2–4s of black (and drops the embedded speech) until the new element buffers.
// Merging seamless cut runs back into a single logical clip means one continuous
// video element spans the cut: no remount, no reseek, no black, no lost audio. The
// render is pixel-identical (the same source frames play, contiguously), and this is
// a no-op for migrated content (no such runs), so the migrate pixel-gate is unaffected.

import type { ColorClip, ImageClip, VideoClip } from "./types.v3";

export type BgClip = VideoClip | ColorClip | ImageClip;

// Two adjacent background clips are a SEAMLESS hard-cut continuation of the SAME
// video source — exactly the shape a CUT produces: B starts where A ends, B's source
// in-point continues A's, the join is a hard cut (A has no transition), and every
// view parameter matches. Such a pair was ONE clip before the cut.
export const isSeamlessVideoContinuation = (a: BgClip, b: BgClip): boolean =>
  a.kind === "video" &&
  b.kind === "video" &&
  a.src === b.src &&
  b.start === a.end &&
  (b.startFrom ?? 0) === (a.startFrom ?? 0) + (a.end - a.start) &&
  !a.transitionToNext &&
  a.fit === b.fit &&
  (a.volume ?? 1) === (b.volume ?? 1) &&
  (a.muted ?? false) === (b.muted ?? false) &&
  a.x === b.x &&
  a.y === b.y &&
  a.width === b.width &&
  a.height === b.height &&
  a.borderRadius === b.borderRadius &&
  a.backColor === b.backColor;

// Merge runs of seamless cut pieces (assumes `clips` is sorted by start) into a
// single logical clip spanning the run, carrying the LAST piece's transitionToNext
// (the run's outgoing transition). Non-mergeable clips (images, color, transitions,
// trimmed/retimed pieces, differing view params) break a run and pass through as-is.
// Also returns `mergedIndexOf`: for each ORIGINAL clip index, the index of the merged
// clip it folded into — so element ownership (which segment paints a word/shape) can
// be translated across the merge and a coalesced later scene never loses its words.
export const coalesceWithMap = (
  clips: BgClip[]
): { merged: BgClip[]; mergedIndexOf: number[] } => {
  const merged: BgClip[] = [];
  const mergedIndexOf: number[] = [];
  for (const c of clips) {
    const prev = merged[merged.length - 1];
    if (prev && isSeamlessVideoContinuation(prev, c)) {
      merged[merged.length - 1] = {
        ...(prev as VideoClip),
        end: c.end,
        transitionToNext: (c as VideoClip).transitionToNext,
      } as BgClip;
    } else {
      merged.push(c);
    }
    mergedIndexOf.push(merged.length - 1);
  }
  return { merged, mergedIndexOf };
};

export const coalesceBgClips = (clips: BgClip[]): BgClip[] => coalesceWithMap(clips).merged;
