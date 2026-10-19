import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { TimelineV3 } from "@engine/types.v3";
import { createHistory } from "./history";

// Owns the editor's timeline state AND its session undo/redo history. The returned
// `setTimeline` is the ONE central mutation point (passed to every child) — it
// captures a snapshot before each mutation, so every current and future edit is
// covered with zero per-action work. `undo`/`redo` restore whole-timeline snapshots.
//
// begin/endTransaction coalesce a continuous interaction (a drag, a field-edit
// session) into a single undo step; they reach deep drag components via TransactionContext.
export interface TimelineHistory {
  timeline: TimelineV3;
  setTimeline: (next: TimelineV3) => void;
  undo: () => void;
  redo: () => void;
  beginTransaction: () => void;
  endTransaction: () => void;
}

export function useTimelineHistory(initial: TimelineV3): TimelineHistory {
  const [timeline, setTimelineState] = useState<TimelineV3>(initial);
  // Latest timeline, readable synchronously between renders. Critical for drags,
  // which fire many setTimeline() calls in one event before React re-renders: each
  // must see the previous one's result, not the stale render-time value.
  const currentRef = useRef<TimelineV3>(initial);
  const hist = useRef(createHistory()).current;

  const apply = useCallback((next: TimelineV3) => {
    currentRef.current = next;
    setTimelineState(next);
  }, []);

  const setTimeline = useCallback(
    (next: TimelineV3) => {
      const prev = currentRef.current;
      // Edit helpers return the SAME reference when an op is a no-op (e.g. target not
      // found) — never record a phantom step for that.
      if (next === prev) return;
      hist.capture(prev);
      apply(next);
    },
    [apply, hist]
  );

  const undo = useCallback(() => {
    // Commit any in-progress transaction first, so cmd+Z while a field is focused
    // reverts that field's edit as one step (rather than dropping it on the floor).
    hist.end(currentRef.current);
    const snap = hist.undo(currentRef.current);
    if (snap) apply(snap);
  }, [apply, hist]);

  const redo = useCallback(() => {
    hist.end(currentRef.current);
    const snap = hist.redo(currentRef.current);
    if (snap) apply(snap);
  }, [apply, hist]);

  const beginTransaction = useCallback(() => hist.begin(currentRef.current), [hist]);
  const endTransaction = useCallback(() => hist.end(currentRef.current), [hist]);

  return { timeline, setTimeline, undo, redo, beginTransaction, endTransaction };
}

// ── Transaction context ──────────────────────────────────────────────────────
// Lets deep drag components (canvas, timeline, keyframe lanes, graph editor) open
// and close a coalescing transaction without prop-drilling begin/end everywhere.
export interface TransactionApi {
  begin: () => void;
  end: () => void;
}

const TransactionContext = createContext<TransactionApi>({ begin: () => {}, end: () => {} });

export const TransactionProvider = TransactionContext.Provider;

/** One coalesced undo step per interaction: call begin() on pointerdown, end() on
 *  pointerup. A no-op interaction is discarded by the history layer. */
export const useTransaction = (): TransactionApi => useContext(TransactionContext);
