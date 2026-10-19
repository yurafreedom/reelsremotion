// Session undo/redo for the v3 editor (Figma-style, snapshot-based). The whole
// reel is one serializable `Timeline`; every edit transforms it. So instead of
// hand-writing an inverse per action, we keep undo/redo stacks of WHOLE-timeline
// snapshots — coverage is automatic for every current and future mutation.
//
// Pure and React-agnostic: a `createHistory()` instance is owned by the editor's
// timeline-state hook (useTimelineHistory). It never touches React or the DOM.

import type { TimelineV3 } from "@engine/types.v3";

// Generous cap: snapshots are small JSON; 200 reaches back to (effectively) the
// first action of a real editing session while preventing an unbounded leak on a
// marathon session. Oldest entries beyond the cap are dropped.
export const MAX_HISTORY = 200;

// Deep copy so a stored snapshot can never be mutated by later edits. structuredClone
// when available (browser), JSON round-trip as a fallback. Timelines are plain JSON.
const deepCopy = <T>(v: T): T =>
  typeof structuredClone === "function" ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T);

// Structural equality, used only to discard a no-op transaction (a drag that ends
// where it started). Timelines are small JSON; stable key order from a single
// serializer makes this reliable enough for that purpose.
const sameTimeline = (a: TimelineV3, b: TimelineV3): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

export interface History {
  /** Capture `prev` right BEFORE a mutation replaces it. Pushes a deep copy onto the
   *  undo stack and clears redo — UNLESS a transaction is open (then intermediate
   *  pushes are suppressed; the single base captured at begin() is what's recorded). */
  capture(prev: TimelineV3): void;
  /** Open a transaction: snapshot `current` once as the undo point and suppress
   *  intermediate captures until end(). A continuous interaction (drag, field-edit
   *  session) becomes ONE undo step. Re-entrant begins keep the earliest base. */
  begin(current: TimelineV3): void;
  /** Close the open transaction, finalizing ONE undo entry for the whole interaction.
   *  If the net result equals the start, the entry is discarded (no phantom undo). */
  end(current: TimelineV3): void;
  /** Pop the previous snapshot; push `current` onto redo. Returns the snapshot to
   *  apply, or null if nothing to undo. */
  undo(current: TimelineV3): TimelineV3 | null;
  /** Pop a redone snapshot; push `current` onto undo. Returns it, or null. */
  redo(current: TimelineV3): TimelineV3 | null;
  canUndo(): boolean;
  canRedo(): boolean;
  inTransaction(): boolean;
}

export function createHistory(): History {
  const undoStack: TimelineV3[] = [];
  const redoStack: TimelineV3[] = [];
  let txnActive = false;
  let txnBase: TimelineV3 | null = null;

  // A new mutation always discards the redone future (a new branch).
  const pushUndo = (snap: TimelineV3) => {
    undoStack.push(snap);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
  };

  return {
    capture(prev) {
      if (txnActive) return; // suppress intermediates; base was taken at begin()
      pushUndo(deepCopy(prev));
    },

    begin(current) {
      if (txnActive) return; // already inside one — keep the earliest base
      txnActive = true;
      txnBase = deepCopy(current);
    },

    end(current) {
      if (!txnActive) return;
      txnActive = false;
      const base = txnBase;
      txnBase = null;
      if (!base) return;
      if (sameTimeline(base, current)) return; // no-op interaction → no undo entry
      pushUndo(base);
    },

    undo(current) {
      txnActive = false; // a dangling transaction is closed implicitly
      txnBase = null;
      const snap = undoStack.pop();
      if (!snap) return null;
      redoStack.push(deepCopy(current));
      return snap;
    },

    redo(current) {
      txnActive = false;
      txnBase = null;
      const snap = redoStack.pop();
      if (!snap) return null;
      undoStack.push(deepCopy(current));
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      return snap;
    },

    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    inTransaction: () => txnActive,
  };
}
