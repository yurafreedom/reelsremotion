import React, { useEffect, useRef, useState } from "react";
import type { TimelineV3, Track as TrackT, VideoClip, ColorClip, ImageClip } from "@engine/types.v3";
import {
  addTrack,
  moveClip,
  moveClipToTrack,
  trimClip,
  cutClip,
  setClipTransition,
  updateClipTransition,
  updateWord,
  updateShape,
  moveAudioClip,
  moveAudioClipToTrack,
  trimAudioClip,
  cutAudioClip,
  deleteTrack,
  MAX_TRACKS,
} from "../edits";
import { clipOverlapAfter } from "../v3util";
import { kindOfFile } from "../media";
import type { Selection } from "../selection";
import { sameSelection } from "../selection";
import { KeyframeLanes } from "../keyframes/KeyframeLanes";
import type { KfSelection } from "../keyframes/kfSelection";
import { useTransaction } from "../useTimelineHistory";

const RULER_H = 22;
// v3.5: now that the transport no longer steals height above the tracks, the lanes
// are driven by the fill-to-bottom logic — with the freed height a handful of tracks
// fill the area at a comfortable MEDIUM height (not the original tiny, not the v3.4
// giant) with NO vertical scroll. `laneH` is the floor (also the ± nudge baseline):
// keeping it at the MIN means fill wins for the default track set, so the normal case
// never scrolls; the ± buttons can still push lanes taller (then it scrolls).
const MIN_TRACK_H = 48;
const MAX_TRACK_H = 200;
const DEFAULT_TRACK_H = 48;
const LANE_STEP = 12;
const MIN_PPF = 0.2; // zoomed out → minutes fit
const MAX_PPF = 48; // zoomed in → per-frame detail
const WORD_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899"];
// Magnetize: while dragging a clip (move or edge-trim), snap to a neighbouring
// clip's edge on the SAME track when within this many screen px — so cut pieces butt
// together flush with no sliver gap. Threshold is px (zoom-independent feel).
const SNAP_PX = 8;
// Snap-target edges (every clip start/end frame) on a track, minus the dragged clip.
const trackEdges = (tl: TimelineV3, trackId: string, exceptIndex: number): number[] => {
  const tr = tl.tracks.find((x) => x.id === trackId);
  if (!tr || !("clips" in tr)) return [];
  const edges: number[] = [];
  (tr.clips as { start: number; end: number }[]).forEach((c, i) => {
    if (i !== exceptIndex) edges.push(c.start, c.end);
  });
  return edges;
};
// Snap `frame` to the nearest edge within `tol` frames, else leave it unchanged.
const snapFrame = (frame: number, edges: number[], tol: number): number => {
  let best = frame;
  let bestD = tol;
  for (const e of edges) {
    const d = Math.abs(e - frame);
    if (d <= bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
};
const CLIP_COLOR: Record<string, string> = {
  video: "#475569",
  color: "#3f3f46",
  image: "#6d28d9",
};

// What a drag is moving. Visual + audio clips re-time via edit helpers (which keep
// startFrom correct); words/shapes re-time by absolute start/end directly.
type Edge = "move" | "l" | "r";
type DragTarget =
  | { track: "visual"; trackId: string; clipIndex: number }
  | { track: "audio"; trackId: string; clipIndex: number }
  | { track: "word"; index: number }
  | { track: "shape"; index: number };
type Drag =
  | { type: "elem"; edge: Edge; t: DragTarget; startX: number; startY: number; s0: number; e0: number }
  | { type: "transition"; trackId: string; clipIndex: number; startX: number; d0: number; max: number }
  | { type: "playhead" };

export const Timeline: React.FC<{
  timeline: TimelineV3;
  setTimeline: (tl: TimelineV3) => void;
  duration: number;
  frame: number;
  seek: (f: number) => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  kfSel: KfSelection;
  setKfSel: (s: KfSelection) => void;
  /** A2: pick a file and add a clip directly to a track (kind implied by track). */
  onAddMedia: (trackId: string) => void;
  /** A3: a Finder file was dropped on a track lane. */
  onDropFile: (trackId: string, file: File) => void;
}> = ({ timeline, setTimeline, duration, frame, seek, selection, setSelection, kfSel, setKfSel, onAddMedia, onDropFile }) => {
  const [pxPerFrame, setPpf] = useState(8);
  const ppfRef = useRef(pxPerFrame);
  ppfRef.current = pxPerFrame;
  const innerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const snapRef = useRef<TimelineV3>(timeline);
  const [dragOverTrack, setDragOverTrack] = useState<string | null>(null);
  // v3.4: while a MOVE drag is in flight, the same-type track currently hovered as a
  // valid cross-track drop target. `dropRef` is the source of truth read on release
  // (refs survive the window-listener closure); the state only drives the highlight.
  const dropRef = useRef<{ trackId: string } | null>(null);
  const [moveDropTrackId, setMoveDropTrackId] = useState<string | null>(null);
  const txn = useTransaction();

  const f2x = (f: number) => f * pxPerFrame;
  const innerW = Math.max(200, duration * pxPerFrame);

  // ---- Lane height (B5 + v3.4): tracks are comfortably tall & bottom-anchored. ----
  // The lane height is max(preferred, fill): it grows to FILL the panel when there's
  // room (bottom-anchored, no scroll), but never drops below the user's preferred
  // `laneH` (default `DEFAULT_TRACK_H`) so clips stay easy to grab even with many
  // tracks (then the panel scrolls vertically). ± buttons nudge `laneH`.
  const [laneH, setLaneH] = useState(DEFAULT_TRACK_H);
  const [scrollH, setScrollH] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScrollH(el.clientHeight));
    ro.observe(el);
    setScrollH(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  const nTracks = Math.max(1, timeline.tracks.length);
  const fillH = Math.floor((scrollH - RULER_H) / nTracks);
  const trackH = Math.max(MIN_TRACK_H, Math.min(MAX_TRACK_H, Math.max(laneH, fillH)));

  const clientToFrame = (clientX: number) => {
    const rect = innerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return (clientX - rect.left) / pxPerFrame;
  };

  // ---- Drag machinery (window listeners; deltas off the start snapshot) ----
  const onMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const snap = snapRef.current;
    if (d.type === "playhead") {
      seek(clientToFrame(e.clientX));
      return;
    }
    const delta = Math.round((e.clientX - d.startX) / pxPerFrame);
    if (d.type === "transition") {
      const next = Math.max(1, Math.min(d.d0 + delta, d.max));
      setTimeline(updateClipTransition(snap, d.trackId, d.clipIndex, { durationInFrames: next }));
      return;
    }
    // elem move/trim
    const len = d.e0 - d.s0;
    const newStart = d.edge === "r" ? d.s0 : Math.max(0, d.s0 + delta);
    const newEnd = d.edge === "l" ? d.e0 : d.e0 + delta;
    const t = d.t;
    // v3.4 cross-track: on a MOVE drag, find the lane under the cursor and, if it is
    // a DIFFERENT track of the SAME kind, mark it a valid drop target (highlight +
    // remembered for release). The structural track change happens on pointerup; the
    // live time re-time below keeps the clip on its source lane meanwhile. Over an
    // invalid (cross-type / same) lane there's no target, so release snaps it back.
    if (d.edge === "move" && (t.track === "visual" || t.track === "audio")) {
      const srcId = t.trackId;
      const srcKind = snap.tracks.find((tt) => tt.id === srcId)?.kind;
      const laneEl = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-track-id]");
      const hoverId = laneEl?.dataset.trackId ?? null;
      const hoverKind = laneEl?.dataset.trackKind ?? null;
      const valid = !!hoverId && hoverId !== srcId && hoverKind === srcKind;
      const next = valid ? hoverId : null;
      dropRef.current = next ? { trackId: next } : null;
      setMoveDropTrackId((cur) => (cur === next ? cur : next));
    }
    if (t.track === "visual" || t.track === "audio") {
      // Magnetize against the other clips' edges on this same track.
      const tol = SNAP_PX / pxPerFrame;
      const edges = trackEdges(snap, t.trackId, t.clipIndex);
      if (d.edge === "move") {
        // Snap whichever end of the moving block lands closest to a neighbour edge.
        let ns = newStart;
        const sL = snapFrame(ns, edges, tol);
        if (sL !== ns) ns = sL;
        else {
          const sR = snapFrame(ns + len, edges, tol);
          if (sR !== ns + len) ns = sR - len;
        }
        ns = Math.max(0, ns);
        if (t.track === "visual") setTimeline(moveClip(snap, t.trackId, t.clipIndex, ns));
        else setTimeline(moveAudioClip(snap, t.trackId, t.clipIndex, ns));
      } else {
        const raw = d.edge === "l" ? d.s0 + delta : d.e0 + delta;
        const f = snapFrame(raw, edges, tol);
        if (t.track === "visual") setTimeline(trimClip(snap, t.trackId, t.clipIndex, d.edge, f));
        else setTimeline(trimAudioClip(snap, t.trackId, t.clipIndex, d.edge, f));
      }
    } else if (t.track === "word") {
      if (d.edge === "move") setTimeline(updateWord(snap, t.index, { start: newStart, end: newStart + len }));
      else if (d.edge === "l") setTimeline(updateWord(snap, t.index, { start: Math.max(0, Math.min(d.s0 + delta, d.e0 - 1)) }));
      else setTimeline(updateWord(snap, t.index, { end: Math.max(d.s0 + 1, d.e0 + delta) }));
    } else {
      if (d.edge === "move") setTimeline(updateShape(snap, t.index, { start: newStart, end: newStart + len }));
      else if (d.edge === "l") setTimeline(updateShape(snap, t.index, { start: Math.max(0, Math.min(d.s0 + delta, d.e0 - 1)) }));
      else setTimeline(updateShape(snap, t.index, { end: Math.max(d.s0 + 1, d.e0 + delta) }));
    }
  };
  const onUp = (e: PointerEvent) => {
    const d = dragRef.current;
    const drop = dropRef.current;
    const wasMutating = d?.type !== "playhead";
    // v3.4: commit a cross-track move if the drag ended over a valid same-type lane.
    // One structural mutation from the start snapshot (so it composes with the live
    // re-time into a SINGLE undo step via the open transaction). Reselect on target.
    if (d?.type === "elem" && d.edge === "move" && drop && d.t.track !== "word" && d.t.track !== "shape") {
      const snap = snapRef.current;
      const newStart = Math.max(0, d.s0 + Math.round((e.clientX - d.startX) / pxPerFrame));
      if (d.t.track === "visual") {
        const r = moveClipToTrack(snap, d.t.trackId, d.t.clipIndex, drop.trackId, newStart);
        setTimeline(r.tl);
        if (r.clipIndex >= 0) setSelection({ kind: "clip", trackId: drop.trackId, clipIndex: r.clipIndex });
      } else if (d.t.track === "audio") {
        const r = moveAudioClipToTrack(snap, d.t.trackId, d.t.clipIndex, drop.trackId, newStart);
        setTimeline(r.tl);
        if (r.clipIndex >= 0) setSelection({ kind: "audioClip", trackId: drop.trackId, clipIndex: r.clipIndex });
      }
    }
    dragRef.current = null;
    dropRef.current = null;
    setMoveDropTrackId(null);
    document.body.style.userSelect = ""; // B2: re-enable text selection after drag
    if (wasMutating) txn.end(); // one coalesced undo step for the move/trim/transition drag
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  const startDrag = (d: Drag, e: React.PointerEvent) => {
    e.stopPropagation();
    snapRef.current = timeline;
    dragRef.current = d;
    document.body.style.userSelect = "none"; // B2: no text-select while dragging
    // The playhead drag only seeks (UI-only) — not a reel mutation, so no transaction.
    if (d.type !== "playhead") txn.begin();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ---- B3: trackpad pinch zoom (wheel + ctrlKey) replacing the ± buttons. The
  // browser reports a pinch gesture as a wheel event with ctrlKey=true; we zoom
  // around the cursor and clamp the px/frame range. ----
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorContentX = e.clientX - rect.left + el.scrollLeft;
      const frameAtCursor = cursorContentX / ppfRef.current;
      const factor = Math.exp(-e.deltaY * 0.01);
      const next = Math.max(MIN_PPF, Math.min(MAX_PPF, ppfRef.current * factor));
      if (next === ppfRef.current) return;
      setPpf(next);
      // Keep the frame under the cursor stationary.
      requestAnimationFrame(() => {
        el.scrollLeft = frameAtCursor * next - (e.clientX - rect.left);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Begin a move/trim drag on a clip-like element.
  const elemDrag = (edge: Edge, t: DragTarget, s0: number, e0: number) => (e: React.PointerEvent) =>
    startDrag({ type: "elem", edge, t, startX: e.clientX, startY: e.clientY, s0, e0 }, e);

  const addTransition = (trackId: string, clipIndex: number, max: number) => {
    setTimeline(
      setClipTransition(timeline, trackId, clipIndex, {
        type: "fade",
        durationInFrames: Math.min(15, Math.max(1, max)),
        timing: "linear",
      })
    );
    setSelection({ kind: "transition", trackId, clipIndex });
  };

  // ---- B4: adaptive, frame-honest ruler. Editing precision is ALWAYS per-frame
  // (1/fps); only the LABEL density adapts to zoom: far → seconds, mid → tenths
  // (0.1s), deep zoom → individual frames. The step is always an integer frame
  // count so ticks snap to real frames, never arbitrary 0.1s offsets. ----
  const fps = timeline.fps;
  const MIN_LABEL_PX = 64;
  const want = MIN_LABEL_PX / pxPerFrame; // desired frames between labels
  const tenth = Math.max(1, Math.round(fps * 0.1));
  const candidates = Array.from(
    new Set([1, 2, 5, 10, tenth, Math.max(1, Math.round(fps * 0.2)), Math.max(1, Math.round(fps * 0.5)), fps, 2 * fps, 5 * fps, 10 * fps, 15 * fps, 30 * fps, 60 * fps, 120 * fps, 300 * fps])
  ).sort((a, b) => a - b);
  let step = candidates[candidates.length - 1];
  for (const c of candidates) {
    if (c >= want) {
      step = c;
      break;
    }
  }
  const labelFor = (f: number) => {
    if (step >= fps) {
      const s = Math.round(f / fps);
      return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`;
    }
    if (step >= tenth) return `${(f / fps).toFixed(1)}s`;
    return `${f}f`; // deep zoom: honest per-frame ticks
  };
  const ticks: number[] = [];
  for (let f = 0; f <= duration; f += step) ticks.push(f);

  // Tracks listed top→bottom: text, shape, image(s) (top image first), video, audio.
  const order: Record<TrackT["kind"], number> = { text: 0, shape: 1, image: 2, video: 3, audio: 4 };
  const tracks = [...timeline.tracks].sort((a, b) => order[a.kind] - order[b.kind]);

  // Selected clip (for the Cut button).
  const canCut = selection?.kind === "clip" || selection?.kind === "audioClip";

  const doCut = () => {
    if (selection?.kind === "clip") setTimeline(cutClip(timeline, selection.trackId, selection.clipIndex, frame));
    else if (selection?.kind === "audioClip") setTimeline(cutAudioClip(timeline, selection.trackId, selection.clipIndex, frame));
  };

  // A3: file drop on a lane. Highlight on drag-over; only accept files (kindOfFile).
  // The leave test uses the lane bounds (not event target) so the highlight clears
  // reliably; a window-level net (below) also guarantees it never lingers.
  const laneDropProps = (trackId: string, accept: (k: ReturnType<typeof kindOfFile>) => boolean) => ({
    onDragOver: (e: React.DragEvent) => {
      if (Array.from(e.dataTransfer.types).includes("Files")) {
        e.preventDefault();
        if (dragOverTrack !== trackId) setDragOverTrack(trackId);
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      const r = e.currentTarget.getBoundingClientRect();
      if (e.clientX <= r.left || e.clientX >= r.right || e.clientY <= r.top || e.clientY >= r.bottom) {
        setDragOverTrack((cur) => (cur === trackId ? null : cur));
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverTrack(null);
      const file = e.dataTransfer.files?.[0];
      if (file && accept(kindOfFile(file))) onDropFile(trackId, file);
    },
  });

  // Safety net: clear any lane highlight when a drag ends/cancels anywhere.
  useEffect(() => {
    const clear = () => setDragOverTrack(null);
    window.addEventListener("drop", clear);
    window.addEventListener("dragend", clear);
    return () => {
      window.removeEventListener("drop", clear);
      window.removeEventListener("dragend", clear);
    };
  }, []);

  const renderVisualClip = (
    trackId: string,
    clips: (VideoClip | ColorClip | ImageClip)[],
    clip: VideoClip | ColorClip | ImageClip,
    i: number
  ) => {
    const sel = sameSelection(selection, { kind: "clip", trackId, clipIndex: i });
    const label =
      clip.kind === "color" ? `color ${clip.color}`
      : clip.kind === "image" ? `image ${clip.src}`
      : `${clip.fit} ${clip.src}${clip.muted ? " 🔇" : ""}`;
    const regions = clip.kind === "video" ? clip.speechRegions ?? [] : [];
    const ov = clipOverlapAfter(clips, i);
    const next = clips[i + 1];
    const maxOv = next ? Math.max(1, Math.min(clip.end - clip.start, next.end - next.start) - 1) : 1;
    const boundaryX = f2x(clip.end);
    return (
      <React.Fragment key={clip.id}>
        <div
          className={"tl-clip" + (sel ? " sel" : "")}
          style={{ left: f2x(clip.start), width: Math.max(8, f2x(clip.end - clip.start)), background: CLIP_COLOR[clip.kind], cursor: "grab" }}
          onPointerDown={(e) => {
            setSelection({ kind: "clip", trackId, clipIndex: i });
            startDrag({ type: "elem", edge: "move", t: { track: "visual", trackId, clipIndex: i }, startX: e.clientX, startY: e.clientY, s0: clip.start, e0: clip.end }, e);
          }}
        >
          <div className="edge l" onPointerDown={elemDrag("l", { track: "visual", trackId, clipIndex: i }, clip.start, clip.end)} />
          {label}
          <div className="edge r" onPointerDown={elemDrag("r", { track: "visual", trackId, clipIndex: i }, clip.start, clip.end)} />
          {regions.map((sr, k) => (
            <div
              key={k}
              title={`speech ${sr.startFrame}-${sr.endFrame} (frozen)`}
              style={{ position: "absolute", left: f2x(sr.startFrame - clip.start), width: f2x(sr.endFrame - sr.startFrame), bottom: 0, height: 5, background: "#facc15", pointerEvents: "none" }}
            />
          ))}
        </div>
        {/* transition region / add button at the join with the next clip */}
        {next && ov > 0 ? (
          <div
            className={"tl-transition" + (selection?.kind === "transition" && selection.trackId === trackId && selection.clipIndex === i ? " sel" : "")}
            style={{ left: f2x(next.start), width: f2x(ov), top: 4, bottom: 4 }}
            title={`${clip.transitionToNext?.type} ${ov}f`}
            onPointerDown={(e) => {
              setSelection({ kind: "transition", trackId, clipIndex: i });
              startDrag({ type: "transition", trackId, clipIndex: i, startX: e.clientX, d0: ov, max: maxOv }, e);
            }}
          >
            <div className="edge" />
          </div>
        ) : next ? (
          <button
            title="Add transition"
            onClick={() => addTransition(trackId, i, maxOv)}
            style={{ position: "absolute", left: boundaryX - 9, top: trackH / 2 - 9, width: 18, height: 18, borderRadius: 9, background: "var(--accent-2)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, lineHeight: "16px", padding: 0, zIndex: 3 }}
          >
            +
          </button>
        ) : null}
      </React.Fragment>
    );
  };

  return (
    <div className="tl-wrap">
      <div className="tl-toolbar">
        <button onClick={doCut} disabled={!canCut} style={btn} title="Cut the selected clip at the playhead (S)">✂ Cut</button>
        <span className="muted" style={{ fontSize: 11, color: "var(--muted)" }}>pinch to zoom · {pxPerFrame.toFixed(1)}px/f</span>
        <span style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 11, color: "var(--muted)" }}>lanes</span>
        <button onClick={() => setLaneH((h) => Math.max(MIN_TRACK_H, h - LANE_STEP))} style={btn} title="Shorter lanes">–</button>
        <button onClick={() => setLaneH((h) => Math.min(MAX_TRACK_H, h + LANE_STEP))} style={btn} title="Taller lanes">+</button>
        <button onClick={() => setTimeline(addTrack(timeline, "image"))} disabled={timeline.tracks.length >= MAX_TRACKS} style={btn} title="Add image track">+ Image track</button>
        <button onClick={() => setTimeline(addTrack(timeline, "audio"))} disabled={timeline.tracks.length >= MAX_TRACKS} style={btn} title="Add audio track">+ Audio track</button>
      </div>

      <div className="tl-scroll" ref={scrollRef}>
        <div ref={innerRef} className="tl-inner" style={{ width: innerW, minHeight: "100%" }}>
          {/* Ruler — click/drag to seek */}
          <div
            className="tl-ruler"
            style={{ cursor: "pointer" }}
            onPointerDown={(e) => {
              startDrag({ type: "playhead" }, e);
              seek(clientToFrame(e.clientX));
            }}
          >
            {ticks.map((f) => (
              <div key={f} className="tl-tick" style={{ left: f2x(f) }}>
                {labelFor(f)}
              </div>
            ))}
          </div>

          {tracks.map((tr) => {
            if (tr.kind === "text") {
              return (
                <Track key={tr.id} label="Text" height={trackH} trackId={tr.id} kind={tr.kind} dropTarget={moveDropTrackId === tr.id}>
                  {tr.words.map((w, wi) => {
                    const sel = sameSelection(selection, { kind: "word", wordIndex: wi });
                    return (
                      <div
                        key={wi}
                        className={"tl-clip" + (sel ? " sel" : "")}
                        style={{ left: f2x(w.start), width: Math.max(8, f2x(w.end - w.start)), background: WORD_COLORS[wi % WORD_COLORS.length] }}
                        onPointerDown={(e) => {
                          setSelection({ kind: "word", wordIndex: wi });
                          startDrag({ type: "elem", edge: "move", t: { track: "word", index: wi }, startX: e.clientX, startY: e.clientY, s0: w.start, e0: w.end }, e);
                        }}
                      >
                        <div className="edge l" onPointerDown={elemDrag("l", { track: "word", index: wi }, w.start, w.end)} />
                        {w.text}
                        <div className="edge r" onPointerDown={elemDrag("r", { track: "word", index: wi }, w.start, w.end)} />
                      </div>
                    );
                  })}
                </Track>
              );
            }
            if (tr.kind === "shape") {
              return (
                <Track key={tr.id} label="Shapes" height={trackH} trackId={tr.id} kind={tr.kind} dropTarget={moveDropTrackId === tr.id}>
                  {tr.shapes.map((sh, shi) => {
                    const sel = sameSelection(selection, { kind: "shape", shapeIndex: shi });
                    return (
                      <div
                        key={shi}
                        className={"tl-clip" + (sel ? " sel" : "")}
                        style={{ left: f2x(sh.start), width: Math.max(8, f2x(sh.end - sh.start)), background: "#0d9488", cursor: "grab" }}
                        onPointerDown={(e) => {
                          setSelection({ kind: "shape", shapeIndex: shi });
                          startDrag({ type: "elem", edge: "move", t: { track: "shape", index: shi }, startX: e.clientX, startY: e.clientY, s0: sh.start, e0: sh.end }, e);
                        }}
                      >
                        <div className="edge l" onPointerDown={elemDrag("l", { track: "shape", index: shi }, sh.start, sh.end)} />
                        {sh.shape} {sh.id}
                        <div className="edge r" onPointerDown={elemDrag("r", { track: "shape", index: shi }, sh.start, sh.end)} />
                      </div>
                    );
                  })}
                </Track>
              );
            }
            if (tr.kind === "image") {
              return (
                <Track
                  key={tr.id}
                  label="Image"
                  height={trackH}
                  trackId={tr.id}
                  kind={tr.kind}
                  dropTarget={moveDropTrackId === tr.id}
                  onAdd={() => onAddMedia(tr.id)}
                  addLabel="+ Image"
                  onDelete={() => setTimeline(deleteTrack(timeline, tr.id))}
                  dragOver={dragOverTrack === tr.id}
                  dropProps={laneDropProps(tr.id, (k) => k === "image")}
                  empty={tr.clips.length === 0}
                  emptyHint="drop an image, or"
                  onEmptyAdd={() => onAddMedia(tr.id)}
                  emptyAddLabel="+ Image"
                >
                  {tr.clips.map((clip, i) => renderVisualClip(tr.id, tr.clips, clip, i))}
                </Track>
              );
            }
            if (tr.kind === "video") {
              return (
                <Track
                  key={tr.id}
                  label="Video"
                  height={trackH}
                  trackId={tr.id}
                  kind={tr.kind}
                  dropTarget={moveDropTrackId === tr.id}
                  onAdd={() => onAddMedia(tr.id)}
                  addLabel="+ Video"
                  dragOver={dragOverTrack === tr.id}
                  dropProps={laneDropProps(tr.id, (k) => k === "video")}
                  empty={tr.clips.length === 0}
                  emptyHint="drop a video, or"
                  onEmptyAdd={() => onAddMedia(tr.id)}
                  emptyAddLabel="+ Video"
                >
                  {tr.clips.map((clip, i) => renderVisualClip(tr.id, tr.clips, clip, i))}
                </Track>
              );
            }
            // audio
            return (
              <Track key={tr.id} label="Audio" height={trackH} trackId={tr.id} kind={tr.kind} dropTarget={moveDropTrackId === tr.id} onDelete={() => setTimeline(deleteTrack(timeline, tr.id))} empty={tr.clips.length === 0} emptyHint="empty — add audio in the panel">
                {tr.clips.map((clip, i) => {
                  const sel = sameSelection(selection, { kind: "audioClip", trackId: tr.id, clipIndex: i });
                  return (
                    <div
                      key={clip.id}
                      className={"tl-clip" + (sel ? " sel" : "")}
                      style={{ left: f2x(clip.start), width: Math.max(8, f2x(clip.end - clip.start)), background: "#0e7490", cursor: "grab" }}
                      onPointerDown={(e) => {
                        setSelection({ kind: "audioClip", trackId: tr.id, clipIndex: i });
                        startDrag({ type: "elem", edge: "move", t: { track: "audio", trackId: tr.id, clipIndex: i }, startX: e.clientX, startY: e.clientY, s0: clip.start, e0: clip.end }, e);
                      }}
                    >
                      <div className="edge l" onPointerDown={elemDrag("l", { track: "audio", trackId: tr.id, clipIndex: i }, clip.start, clip.end)} />
                      ♪ {clip.src}{clip.ducking?.enabled ? " · duck" : ""}
                      <div className="edge r" onPointerDown={elemDrag("r", { track: "audio", trackId: tr.id, clipIndex: i }, clip.start, clip.end)} />
                    </div>
                  );
                })}
              </Track>
            );
          })}

          {/* Keyframe lanes for the selected word (word-relative diamonds under the axis) */}
          {selection?.kind === "word" && textWordAt(timeline, selection.wordIndex) && (
            <KeyframeLanes
              timeline={timeline}
              setTimeline={setTimeline}
              wordRef={{ wordIndex: selection.wordIndex }}
              word={textWordAt(timeline, selection.wordIndex)!}
              absStart={textWordAt(timeline, selection.wordIndex)!.start}
              f2x={f2x}
              clientToFrame={clientToFrame}
              playheadFrame={frame}
              kfSel={kfSel}
              setKfSel={setKfSel}
            />
          )}

          {/* Playhead spanning all tracks (B2: glow + pointer cursor) */}
          <div className="tl-playhead" style={{ left: f2x(frame), height: "100%", top: 0 }} />
        </div>
      </div>
    </div>
  );
};

const textWordAt = (tl: TimelineV3, wordIndex: number) => {
  const tr = tl.tracks.find((t) => t.kind === "text");
  return tr && tr.kind === "text" ? tr.words[wordIndex] : undefined;
};

const Track: React.FC<{
  label: string;
  height: number;
  /** v3.4: identity for cross-track move hit-testing (read via data-* in onMove). */
  trackId?: string;
  kind?: string;
  /** v3.4: this lane is the current valid same-type cross-track drop target. */
  dropTarget?: boolean;
  onDelete?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  dragOver?: boolean;
  dropProps?: React.HTMLAttributes<HTMLDivElement>;
  empty?: boolean;
  emptyHint?: string;
  onEmptyAdd?: () => void;
  emptyAddLabel?: string;
  children: React.ReactNode;
}> = ({ label, height, trackId, kind, dropTarget, onDelete, onAdd, addLabel, dragOver, dropProps, empty, emptyHint, onEmptyAdd, emptyAddLabel, children }) => (
  <div
    className={"tl-track" + (dragOver ? " drag-over" : "") + (dropTarget ? " drop-target" : "")}
    style={{ height }}
    data-track-id={trackId}
    data-track-kind={kind}
    {...dropProps}
  >
    <span className="tl-track-name">{label}</span>
    {onAdd && (
      <button className="tl-add-media" title={addLabel} onClick={onAdd}>
        {addLabel ?? "+"}
      </button>
    )}
    {onDelete && (
      <button className="tl-del-track" title="Remove track" onClick={onDelete}>
        ×
      </button>
    )}
    {empty && (
      <span className="tl-empty-hint">
        {emptyHint}
        {onEmptyAdd && (
          <button className="tl-empty-add" onClick={onEmptyAdd}>
            {emptyAddLabel ?? "Load"}
          </button>
        )}
      </span>
    )}
    {children}
  </div>
);

const btn: React.CSSProperties = {
  background: "#2a2a30",
  color: "var(--text)",
  border: "1px solid var(--line)",
  borderRadius: 5,
  padding: "2px 8px",
  cursor: "pointer",
  fontSize: 12,
};
