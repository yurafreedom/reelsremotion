import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { ReelsVideo } from "@engine/Video";
import type { ShapeType } from "@engine/types";
import type { TimelineV3 } from "@engine/types.v3";
import { imageTracksOf, textTrackOf, videoTrackOf } from "@engine/types.v3";
import { DEFAULT_TIMELINE } from "./fixtures";
import { Transport } from "./transport/Transport";
import { IoBar } from "./IoBar";
import { Timeline as TimelineView } from "./timeline/Timeline";
import { Panel } from "./panel/Panel";
import { CanvasOverlay } from "./canvas/CanvasOverlay";
import { ContextMenu, type MenuItem, type MenuState } from "./ContextMenu";
import type { Selection } from "./selection";
import {
  addShape,
  addTrack,
  cutClip,
  cutAudioClip,
  deleteWord,
  deleteShape,
  deleteClip,
  deleteAudioClip,
  deleteTrack,
  duplicateWord,
  duplicateShape,
  setClipTransition,
  setVideoClipKind,
  updateAudioClip,
} from "./edits";
import { durationV3, videoClipIndexAt } from "./v3util";
import {
  addDroppedToCanvas,
  addDroppedToTrack,
  addImageToTrack,
  addVideoToTrack,
  replaceClipMedia,
  type AddResult,
} from "./mediaActions";
import { useToast } from "./toast";
import type { KfSelection } from "./keyframes/kfSelection";
import { copyKeyframes, deleteKeys, pasteKeyframes, type KfClipboard, type WordRef } from "./keyframes/kfEdits";
import { useTimelineHistory, TransactionProvider } from "./useTimelineHistory";
import "./editor.css";

export const Editor: React.FC = () => {
  const { timeline, setTimeline, undo, redo, beginTransaction, endTransaction } =
    useTimelineHistory(DEFAULT_TIMELINE);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selection, setSelectionState] = useState<Selection>(null);
  const [kfSel, setKfSel] = useState<KfSelection>(null);
  const [clipboard, setClipboard] = useState<KfClipboard | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);

  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const toast = useToast();

  const playerRef = useRef<PlayerRef>(null);
  const selectionRef = useRef<Selection>(null);
  const setSelection = useCallback((s: Selection) => {
    selectionRef.current = s;
    setSelectionState(s);
  }, []);

  // Clear the keyframe sub-selection whenever the selected word changes.
  useEffect(() => {
    setKfSel((cur) => {
      if (!cur) return cur;
      if (selection?.kind === "word" && selection.wordIndex === cur.wordIndex) return cur;
      return null;
    });
  }, [selection]);

  const duration = useMemo(() => durationV3(timeline), [timeline]);
  const inputProps = useMemo(() => ({ timeline, showGrid: false }), [timeline]);

  // Sync editor state from the Player (single source of truth for the playhead).
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
    };
  }, []);

  const seek = useCallback(
    (f: number) => {
      const clamped = Math.max(0, Math.min(duration - 1, Math.round(f)));
      playerRef.current?.seekTo(clamped);
    },
    [duration]
  );

  // Apply the result of an async media add: update the timeline and select the new
  // clip so it's immediately editable.
  const applyAdd = useCallback(
    (r: AddResult) => {
      setTimeline(r.tl);
      if (r.selection) setSelection(r.selection);
    },
    [setSelection]
  );

  // Finder drag & drop onto the preview canvas (A3): upload + create a clip.
  const [canvasDragOver, setCanvasDragOver] = useState(false);

  // Show the hint only while a FILE is being dragged over the canvas.
  const onCanvasDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!Array.from(e.dataTransfer.types).includes("Files")) return;
      e.preventDefault();
      if (!canvasDragOver) setCanvasDragOver(true);
    },
    [canvasDragOver]
  );

  // Only clear when the pointer actually LEFT the box — moving between child
  // elements fires dragleave too, so test the box bounds (a reliable check that
  // doesn't depend on event target/relatedTarget quirks).
  const onCanvasDragLeave = useCallback((e: React.DragEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX <= r.left || e.clientX >= r.right || e.clientY <= r.top || e.clientY >= r.bottom) {
      setCanvasDragOver(false);
    }
  }, []);

  const onCanvasDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setCanvasDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      applyAdd(await addDroppedToCanvas(timeline, file, frame, toast));
    },
    [timeline, frame, toast, applyAdd]
  );

  // Safety net (B7/A3): a drag can end OUTSIDE the canvas (dropped elsewhere, or
  // cancelled with Esc) without firing our drop/dragleave — guarantee the overlay
  // is dismissed so it never lingers and swallows clicks.
  useEffect(() => {
    const clear = () => setCanvasDragOver(false);
    window.addEventListener("drop", clear);
    window.addEventListener("dragend", clear);
    return () => {
      window.removeEventListener("drop", clear);
      window.removeEventListener("dragend", clear);
    };
  }, []);

  // Direct "add media to a track" (A2) — picks a file, uploads, adds a clip. The
  // file kind is implied by the track kind (video → video clip, image → image clip).
  const addMediaToTrack = useCallback(
    async (trackId: string) => {
      const tr = timeline.tracks.find((t) => t.id === trackId);
      if (tr?.kind === "video") applyAdd(await addVideoToTrack(timeline, trackId, null, toast));
      else if (tr?.kind === "image") applyAdd(await addImageToTrack(timeline, trackId, null, frame, toast));
    },
    [timeline, frame, toast, applyAdd]
  );

  // Finder drop onto a specific track lane (A3).
  const dropOnTrack = useCallback(
    async (trackId: string, file: File) => {
      applyAdd(await addDroppedToTrack(timeline, trackId, file, frame, toast));
    },
    [timeline, frame, toast, applyAdd]
  );

  // Global "+ Video" / "+ Image" (panel actions). "+ Image" targets the topmost
  // image track, creating one if none exists.
  const addVideoGlobal = useCallback(async () => {
    const vt = videoTrackOf(timeline);
    if (!vt) {
      toast.show("error", "No video track");
      return;
    }
    applyAdd(await addVideoToTrack(timeline, vt.id, null, toast));
  }, [timeline, toast, applyAdd]);

  const addImageGlobal = useCallback(async () => {
    let tl = timeline;
    let imgs = imageTracksOf(tl);
    if (imgs.length === 0) {
      tl = addTrack(tl, "image");
      imgs = imageTracksOf(tl);
    }
    const id = imgs[imgs.length - 1]?.id;
    if (id) applyAdd(await addImageToTrack(tl, id, null, frame, toast));
  }, [timeline, frame, toast, applyAdd]);

  // Absolute [start,end] a new shape should span: the covering video clip at the
  // playhead, else the whole reel.
  const activeRange = useCallback((): { start: number; end: number } => {
    const ci = videoClipIndexAt(timeline, frame);
    const clip = ci >= 0 ? videoTrackOf(timeline)?.clips[ci] : undefined;
    if (clip) return { start: clip.start, end: clip.end };
    return { start: 0, end: duration };
  }, [timeline, frame, duration]);

  // Unified element deletion (per selection kind).
  const deleteSelected = useCallback(
    (sel: Selection) => {
      if (!sel) return;
      switch (sel.kind) {
        case "word": setTimeline(deleteWord(timeline, sel.wordIndex)); setSelection(null); break;
        case "shape": setTimeline(deleteShape(timeline, sel.shapeIndex)); setSelection(null); break;
        case "clip": setTimeline(deleteClip(timeline, sel.trackId, sel.clipIndex)); setSelection(null); break;
        case "audioClip": setTimeline(deleteAudioClip(timeline, sel.trackId, sel.clipIndex)); setSelection(null); break;
        case "transition": setTimeline(setClipTransition(timeline, sel.trackId, sel.clipIndex, null)); setSelection(null); break;
        case "track": setTimeline(deleteTrack(timeline, sel.trackId)); setSelection(null); break;
      }
    },
    [timeline, setSelection]
  );

  const addShapeToActive = useCallback(
    (type: ShapeType) => {
      const r = activeRange();
      const next = addShape(timeline, type, r.start, r.end);
      setTimeline(next);
      const tr = next.tracks.find((t) => t.kind === "shape");
      const shapeIndex = tr && tr.kind === "shape" ? tr.shapes.length - 1 : 0;
      setSelection({ kind: "shape", shapeIndex });
    },
    [timeline, activeRange, setSelection]
  );

  // Cut the selected video/audio clip at the playhead.
  const cutSelected = useCallback(() => {
    const sel = selectionRef.current;
    if (sel?.kind === "clip") setTimeline(cutClip(timeline, sel.trackId, sel.clipIndex, frame));
    else if (sel?.kind === "audioClip") setTimeline(cutAudioClip(timeline, sel.trackId, sel.clipIndex, frame));
  }, [timeline, frame]);

  // Right-click menu items per selection kind.
  const buildMenuItems = useCallback(
    (sel: Selection): MenuItem[] => {
      if (!sel) return [];
      const items: MenuItem[] = [];
      switch (sel.kind) {
        case "word":
          items.push({ kind: "item", label: "Duplicate", onClick: () => setTimeline(duplicateWord(timeline, sel.wordIndex)) });
          break;
        case "shape":
          items.push({ kind: "item", label: "Duplicate", onClick: () => setTimeline(duplicateShape(timeline, sel.shapeIndex)) });
          break;
        case "clip": {
          const tr = timeline.tracks.find((t) => t.id === sel.trackId);
          const clip = tr && (tr.kind === "video" || tr.kind === "image") ? tr.clips[sel.clipIndex] : undefined;
          if (clip && clip.kind !== "color") {
            items.push({ kind: "item", label: "Replace media…", onClick: () => void replaceClipMedia(timeline, sel.trackId, sel.clipIndex, null, toast, { asBox: clip.kind === "video" && clip.fit === "contain" }).then(setTimeline) });
          }
          if (tr?.kind === "video" && clip) {
            items.push({ kind: "item", label: clip.kind === "color" ? "Convert to video" : "Convert to color", onClick: () => setTimeline(setVideoClipKind(timeline, sel.trackId, sel.clipIndex, clip.kind === "color" ? "video" : "color")) });
          }
          items.push({ kind: "item", label: "Cut at playhead", onClick: () => setTimeline(cutClip(timeline, sel.trackId, sel.clipIndex, frame)) });
          break;
        }
        case "audioClip": {
          const tr = timeline.tracks.find((t) => t.id === sel.trackId);
          const a = tr?.kind === "audio" ? tr.clips[sel.clipIndex] : undefined;
          if (a) {
            const muted = a.volume === 0;
            items.push({ kind: "item", label: muted ? "Unmute" : "Mute", onClick: () => setTimeline(updateAudioClip(timeline, sel.trackId, sel.clipIndex, { volume: muted ? 0.6 : 0 })) });
            items.push({ kind: "item", label: "Cut at playhead", onClick: () => setTimeline(cutAudioClip(timeline, sel.trackId, sel.clipIndex, frame)) });
          }
          break;
        }
      }
      if (items.length > 0) items.push({ kind: "sep" });
      const delLabel = sel.kind === "transition" ? "Remove transition" : sel.kind === "track" ? "Remove track" : "Delete";
      items.push({ kind: "item", label: delLabel, danger: true, onClick: () => deleteSelected(sel) });
      return items;
    },
    [timeline, frame, deleteSelected, toast]
  );

  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      const sel = selectionRef.current;
      if (!sel) return;
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY, items: buildMenuItems(sel) });
    };
    window.addEventListener("contextmenu", onCtx);
    return () => window.removeEventListener("contextmenu", onCtx);
  }, [buildMenuItems]);

  const handleCopy = useCallback(() => {
    if (selection?.kind !== "word") return;
    const w = textTrackOf(timeline)?.words[selection.wordIndex];
    if (!w) return;
    const sel =
      kfSel && kfSel.wordIndex === selection.wordIndex
        ? { property: kfSel.property, indices: kfSel.indices }
        : undefined;
    const clip = copyKeyframes(w, sel);
    if (clip) setClipboard(clip);
  }, [selection, timeline, kfSel]);

  const pasteOnto = useCallback(
    (refs: WordRef[], offsetToPlayhead: boolean) => {
      if (!clipboard || refs.length === 0) return;
      let offset: number | undefined;
      if (offsetToPlayhead && refs[0]) {
        const w = textTrackOf(timeline)?.words[refs[0].wordIndex];
        if (w) offset = Math.max(0, Math.round(frame) - w.start);
      }
      setTimeline(pasteKeyframes(timeline, refs, clipboard, offset));
    },
    [clipboard, timeline, frame]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === "Space") {
        e.preventDefault();
        playerRef.current?.toggle();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        seek(frame - (e.shiftKey ? timeline.fps : 1));
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        seek(frame + (e.shiftKey ? timeline.fps : 1));
      } else if (e.code === "KeyS" && !mod) {
        e.preventDefault();
        cutSelected();
      } else if ((e.code === "Delete" || e.code === "Backspace") && kfSel && kfSel.indices.length > 0) {
        e.preventDefault();
        setTimeline(deleteKeys(timeline, { wordIndex: kfSel.wordIndex }, kfSel.property, kfSel.indices));
        setKfSel(null);
      } else if ((e.code === "Delete" || e.code === "Backspace") && selection) {
        e.preventDefault();
        deleteSelected(selection);
      } else if (mod && e.code === "KeyC") {
        handleCopy();
      } else if (mod && e.code === "KeyV" && selection?.kind === "word") {
        e.preventDefault();
        pasteOnto([{ wordIndex: selection.wordIndex }], e.shiftKey);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frame, seek, timeline, kfSel, selection, handleCopy, pasteOnto, deleteSelected, cutSelected]);

  // Session undo/redo (v3.3). Deliberately NOT gated by the focused-element check
  // that the editing shortcuts use: cmd/ctrl+Z must work even while a field is
  // focused (the hook commits the in-progress field edit, then undoes it). We
  // preventDefault so the browser's own undo doesn't fight ours.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __timeline: TimelineV3 }).__timeline = timeline;
  }, [timeline]);

  const handleImport = useCallback((tl: TimelineV3) => {
    setTimeline(tl);
    setSelection(null);
    setKfSel(null);
    playerRef.current?.seekTo(0);
  }, [setSelection, setTimeline]);

  // Field-edit coalescing (v3.3): a whole focus→blur session on a panel input/select
  // is ONE undo step, no matter how many onChange mutations it fires. Handled at the
  // container via React's bubbling focus/blur — no per-input wiring. Moving between
  // two fields fires blur(A) then focus(B), so each field commits as its own step.
  const isField = (el: EventTarget | null): boolean => {
    const tag = (el as HTMLElement | null)?.tagName;
    return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
  };
  const txnApi = useMemo(
    () => ({ begin: beginTransaction, end: endTransaction }),
    [beginTransaction, endTransaction]
  );

  return (
    <TransactionProvider value={txnApi}>
    <div
      className="editor"
      style={{
        gridTemplateColumns: panelCollapsed ? "1fr 0px" : "1fr 320px",
        // v3.5: transport moved out of the timeline area into a left column on the
        // stage, so the whole timeline row goes to the tracks. Give it a comfortably
        // tall (but clamped) row so a handful of tracks fit at a medium lane height
        // with no vertical scroll.
        gridTemplateRows: timelineCollapsed ? "1fr 0px" : "1fr clamp(300px, 42vh, 440px)",
      }}
    >
      <div className="stage-area">
        {/* v3.5: vertical transport column in the empty space LEFT of the vertical
            preview — frees the height the old horizontal bar stole from the tracks. */}
        <Transport playerRef={playerRef} frame={frame} duration={duration} fps={timeline.fps} playing={playing} />
        <div
          className={"player-box" + (canvasDragOver ? " drag-over" : "")}
          onDragOver={onCanvasDragOver}
          onDragLeave={onCanvasDragLeave}
          onDrop={onCanvasDrop}
        >
          <Player
            ref={playerRef}
            component={ReelsVideo}
            inputProps={inputProps}
            durationInFrames={duration}
            compositionWidth={timeline.width}
            compositionHeight={timeline.height}
            fps={timeline.fps}
            style={{ width: "100%", height: "100%" }}
            controls={false}
            acknowledgeRemotionLicense
          />
          <CanvasOverlay
            timeline={timeline}
            setTimeline={setTimeline}
            frame={frame}
            selection={selection}
            setSelection={setSelection}
            kfSel={kfSel}
            setKfSel={setKfSel}
          />
          {canvasDragOver && <div className="drop-hint">Drop video / image to add</div>}
        </div>

        {/* Grab handles (B7) — always visible on the stage edges so collapsed
            panels can be reopened. They sit on the moving boundary. */}
        <button
          className="grab-handle gh-right"
          title={panelCollapsed ? "Show panel" : "Hide panel"}
          onClick={() => setPanelCollapsed((c) => !c)}
        >
          {panelCollapsed ? "‹" : "›"}
        </button>
        <button
          className="grab-handle gh-bottom"
          title={timelineCollapsed ? "Show timeline" : "Hide timeline"}
          onClick={() => setTimelineCollapsed((c) => !c)}
        >
          {timelineCollapsed ? "▲" : "▼"}
        </button>
      </div>

      <div className={"panel-area" + (panelCollapsed ? " collapsed" : "")}>
        {/* Top ~60%: actions + selection controls (B1). */}
        <div className="panel-actions">
          <IoBar timeline={timeline} onImport={handleImport} />
          <div className="add-toolbar">
            <span className="muted">Add media:</span>
            <button onClick={addVideoGlobal} title="Pick a video and add it to the video track">+ Video</button>
            <button onClick={addImageGlobal} title="Pick an image and add it to an image track">+ Image</button>
          </div>
          <div className="add-toolbar">
            <span className="muted">Add shape:</span>
            <button onClick={() => addShapeToActive("rect")}>▭ Rect</button>
            <button onClick={() => addShapeToActive("ellipse")}>◯ Ellipse</button>
            <button onClick={() => addShapeToActive("line")}>— Line</button>
          </div>
        </div>
        <div className="panel-divider" />
        {/* Bottom ~40%: the selected element's detailed settings (B1). */}
        <div
          className="panel-detail"
          onFocus={(e) => { if (isField(e.target)) beginTransaction(); }}
          onBlur={(e) => { if (isField(e.target)) endTransaction(); }}
        >
          <Panel
            timeline={timeline}
            setTimeline={setTimeline}
            selection={selection}
            setSelection={setSelection}
            frame={frame}
            kfSel={kfSel}
            setKfSel={setKfSel}
            clipboard={clipboard}
            onCopy={handleCopy}
            onPaste={pasteOnto}
          />
        </div>
      </div>

      <div className={"timeline-area" + (timelineCollapsed ? " collapsed" : "")}>
        <TimelineView
          timeline={timeline}
          setTimeline={setTimeline}
          duration={duration}
          frame={frame}
          seek={seek}
          selection={selection}
          setSelection={setSelection}
          kfSel={kfSel}
          setKfSel={setKfSel}
          onAddMedia={addMediaToTrack}
          onDropFile={dropOnTrack}
        />
      </div>

      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
    </TransactionProvider>
  );
};
