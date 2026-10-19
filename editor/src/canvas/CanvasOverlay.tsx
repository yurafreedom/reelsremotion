import React, { useEffect, useRef, useState } from "react";
import type { Vec2 } from "@engine/types";
import type { TimelineV3, VideoClip } from "@engine/types.v3";
import { textTrackOf, shapeTrackOf, videoTrackOf } from "@engine/types.v3";
import { resolveFont, resolveFontStyle } from "@engine/fonts";
import { hasTrack, samplePosition } from "@engine/keyframes";
import { updateClip, updateShape, updateWord } from "../edits";
import { activeImageClips, activeWordIndices, activeShapeIndices, videoClipIndexAt } from "../v3util";
import { setPositionKey, setSpatialTangent, type WordRef } from "../keyframes/kfEdits";
import { setShapePositionKey, shapeTracked } from "../keyframes/shapeKfEdits";
import type { KfSelection } from "../keyframes/kfSelection";
import type { Selection } from "../selection";
import { sameSelection } from "../selection";
import { useTransaction } from "../useTimelineHistory";

// Drag-place layer over the <Player>. CONTRACT §2: x,y are px offsets of the
// element CENTER from frame center (540,960). The overlay matches the composition
// box exactly, so scale S = displayedW / 1080.
//
// v3 (tracks, absolute axis): words/shapes carry ABSOLUTE start/end (no scene
// offset). The "box" is a VideoClip with fit:'contain' on the video track —
// movable/resizable. Clicking empty canvas selects the covering video clip.
const applyCase = (text: string, c?: string) =>
  c === "upper" ? text.toUpperCase() : c === "lower" ? text.toLowerCase() : text;

const SNAP = 40;
type Guides = { x: number[]; y: number[] };

type Drag =
  | { kind: "word"; wi: number; ox: number; oy: number; px: number; py: number; auto: boolean; rel: number }
  | { kind: "box-move"; trackId: string; ci: number; ox: number; oy: number; w: number; h: number; px: number; py: number }
  | { kind: "box-size"; trackId: string; ci: number; cx: number; cy: number; w0: number; h0: number; px: number; py: number }
  | { kind: "image-move"; trackId: string; ci: number; ox: number; oy: number; px: number; py: number }
  | { kind: "image-size"; trackId: string; ci: number; w0: number; h0: number; px: number; py: number }
  | { kind: "shape-move"; shi: number; ox: number; oy: number; px: number; py: number; auto: boolean; rel: number }
  | { kind: "shape-size"; shi: number; w0: number; h0: number; px: number; py: number }
  | { kind: "anchor"; wi: number; index: number; vx: number; vy: number; px: number; py: number }
  | { kind: "tangent"; wi: number; index: number; which: "in" | "out"; tx: number; ty: number; px: number; py: number };

export const CanvasOverlay: React.FC<{
  timeline: TimelineV3;
  setTimeline: (tl: TimelineV3) => void;
  frame: number;
  selection: Selection;
  setSelection: (s: Selection) => void;
  kfSel: KfSelection;
  setKfSel: (s: KfSelection) => void;
}> = ({ timeline, setTimeline, frame, selection, setSelection, kfSel, setKfSel }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });
  const dragRef = useRef<Drag | null>(null);
  const snapRef = useRef<TimelineV3>(timeline);
  const txn = useTransaction();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fw = timeline.width;
  const fh = timeline.height;
  const S = size.w > 0 ? size.w / fw : 0;
  const pctX = (offX: number) => ((fw / 2 + offX) / fw) * 100;
  const pctY = (offY: number) => ((fh / 2 + offY) / fh) * 100;
  const pxX = (offX: number) => (fw / 2 + offX) * S;
  const pxY = (offY: number) => (fh / 2 + offY) * S;

  const videoTrackId = videoTrackOf(timeline)?.id ?? "";

  const snap1D = (value: number, targets: { at: number; guide: number }[]) => {
    let best: { at: number; guide: number } | null = null;
    let bestD = SNAP + 1;
    for (const t of targets) {
      const d = Math.abs(value - t.at);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best && bestD <= SNAP ? { value: best.at, guide: best.guide } : { value, guide: null };
  };

  const onMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || S === 0) return;
    const snap = snapRef.current;
    const dx = Math.round((e.clientX - d.px) / S);
    const dy = Math.round((e.clientY - d.py) / S);

    if (d.kind === "word") {
      if (d.auto) setTimeline(setPositionKey(snap, { wordIndex: d.wi }, d.rel, { x: d.ox + dx, y: d.oy + dy }));
      else setTimeline(updateWord(snap, d.wi, { x: d.ox + dx, y: d.oy + dy }));
    } else if (d.kind === "box-move") {
      const rawX = d.ox + dx;
      const rawY = d.oy + dy;
      const sx = snap1D(rawX, [
        { at: 0, guide: 0 },
        { at: -fw / 2 + d.w / 2, guide: -fw / 2 },
        { at: fw / 2 - d.w / 2, guide: fw / 2 },
      ]);
      const sy = snap1D(rawY, [
        { at: 0, guide: 0 },
        { at: -fh / 2 + d.h / 2, guide: -fh / 2 },
        { at: fh / 2 - d.h / 2, guide: fh / 2 },
      ]);
      setGuides({ x: sx.guide !== null ? [sx.guide] : [], y: sy.guide !== null ? [sy.guide] : [] });
      setTimeline(updateClip(snap, d.trackId, d.ci, { x: sx.value, y: sy.value }));
    } else if (d.kind === "box-size") {
      let w = Math.max(40, d.w0 + dx * 2);
      let h = Math.max(40, d.h0 + dy * 2);
      const gx: number[] = [];
      const gy: number[] = [];
      const fullW = fw - 2 * Math.abs(d.cx);
      if (Math.abs(w - fullW) <= SNAP * 2) { w = fullW; gx.push(fw / 2, -fw / 2); }
      const fullH = fh - 2 * Math.abs(d.cy);
      if (Math.abs(h - fullH) <= SNAP * 2) { h = fullH; gy.push(fh / 2, -fh / 2); }
      setGuides({ x: gx, y: gy });
      setTimeline(updateClip(snap, d.trackId, d.ci, { width: Math.round(w), height: Math.round(h) }));
    } else if (d.kind === "image-move") {
      // Same center-offset semantics as the box/shapes: write static x/y, snap to
      // frame center. (Matches the panel's image X/Y fields and box-video drag.)
      const rawX = d.ox + dx;
      const rawY = d.oy + dy;
      const sx = snap1D(rawX, [{ at: 0, guide: 0 }]);
      const sy = snap1D(rawY, [{ at: 0, guide: 0 }]);
      setGuides({ x: sx.guide !== null ? [sx.guide] : [], y: sy.guide !== null ? [sy.guide] : [] });
      setTimeline(updateClip(snap, d.trackId, d.ci, { x: sx.value, y: sy.value }));
    } else if (d.kind === "image-size") {
      // Center-anchored resize (like the box): the br corner tracks the cursor.
      const w = Math.max(20, d.w0 + dx * 2);
      const h = Math.max(20, d.h0 + dy * 2);
      setTimeline(updateClip(snap, d.trackId, d.ci, { width: Math.round(w), height: Math.round(h) }));
    } else if (d.kind === "shape-move") {
      const rawX = d.ox + dx;
      const rawY = d.oy + dy;
      const sx = snap1D(rawX, [{ at: 0, guide: 0 }]);
      const sy = snap1D(rawY, [{ at: 0, guide: 0 }]);
      setGuides({ x: sx.guide !== null ? [sx.guide] : [], y: sy.guide !== null ? [sy.guide] : [] });
      if (d.auto) setTimeline(setShapePositionKey(snap, { shapeIndex: d.shi }, d.rel, { x: sx.value, y: sy.value }));
      else setTimeline(updateShape(snap, d.shi, { x: sx.value, y: sy.value }));
    } else if (d.kind === "shape-size") {
      const w = Math.max(4, d.w0 + dx);
      const h = Math.max(2, d.h0 + dy);
      setTimeline(updateShape(snap, d.shi, { width: Math.round(w), height: Math.round(h) }));
    } else if (d.kind === "anchor") {
      setTimeline(setPositionKey(snap, { wordIndex: d.wi }, snapFrameOfAnchor(snap, d), { x: d.vx + dx, y: d.vy + dy }));
    } else if (d.kind === "tangent") {
      setTimeline(setSpatialTangent(snap, { wordIndex: d.wi }, d.index, d.which, { x: d.tx + dx, y: d.ty + dy }));
    }
  };
  const onUp = () => {
    dragRef.current = null;
    setGuides({ x: [], y: [] });
    txn.end(); // one coalesced undo step for the whole drag (discarded if no net change)
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  const startDrag = (d: Drag, e: React.PointerEvent) => {
    e.stopPropagation();
    snapRef.current = timeline;
    dragRef.current = d;
    txn.begin(); // snapshot once; suppress intermediate per-move pushes
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const snapFrameOfAnchor = (snap: TimelineV3, d: { wi: number; index: number }) =>
    textTrackOf(snap)?.words[d.wi]?.keyframes?.position?.[d.index]?.frame ?? 0;

  const words = textTrackOf(timeline)?.words ?? [];
  const shapes = shapeTrackOf(timeline)?.shapes ?? [];
  const activeW = activeWordIndices(timeline, frame);
  const activeSh = activeShapeIndices(timeline, frame);
  const activeImgs = activeImageClips(timeline, frame);
  const coverCi = videoClipIndexAt(timeline, frame);
  const coverClip = coverCi >= 0 ? videoTrackOf(timeline)?.clips[coverCi] : undefined;

  const selWi = selection?.kind === "word" ? selection.wordIndex : -1;
  const selWord = selWi >= 0 ? words[selWi] : undefined;
  const posTrack = selWord?.keyframes?.position;
  const showPath = !!selWord && hasTrack(posTrack);

  return (
    <div className="canvas-overlay" ref={ref} style={{ pointerEvents: "none" }}>
      {/* Background-select backing layer: clicking empty canvas selects the covering
          video clip. Sits beneath every interactive element. */}
      {coverCi >= 0 && (
        <div
          style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}
          onPointerDown={() => setSelection({ kind: "clip", trackId: videoTrackId, clipIndex: coverCi })}
        />
      )}

      <div className="frame-outline" style={{ position: "absolute", inset: 0, border: "1px solid rgba(255,255,255,0.35)", pointerEvents: "none" }} />

      {guides.x.map((gx, i) => (
        <div key={`gx-${i}`} style={{ position: "absolute", left: pxX(gx), top: 0, bottom: 0, width: 1, background: "#22d3ee", pointerEvents: "none", boxShadow: "0 0 4px #22d3ee" }} />
      ))}
      {guides.y.map((gy, i) => (
        <div key={`gy-${i}`} style={{ position: "absolute", top: pxY(gy), left: 0, right: 0, height: 1, background: "#22d3ee", pointerEvents: "none", boxShadow: "0 0 4px #22d3ee" }} />
      ))}

      {/* Motion path (anchors + spatial handles) for the selected word */}
      {showPath && selWord && size.w > 0 && (
        <MotionPath
          word={selWord}
          pxX={pxX}
          pxY={pxY}
          wi={selWi}
          kfSel={kfSel}
          onAnchorDown={(e, index, v) => {
            setKfSel({ wordIndex: selWi, property: "position", indices: [index] });
            startDrag({ kind: "anchor", wi: selWi, index, vx: v.x, vy: v.y, px: e.clientX, py: e.clientY }, e);
          }}
          onTangentDown={(e, index, which, t) =>
            startDrag({ kind: "tangent", wi: selWi, index, which, tx: t.x, ty: t.y, px: e.clientX, py: e.clientY }, e)
          }
          width={size.w}
          height={size.h}
        />
      )}

      {/* Background BOX (the covering video clip when fit:'contain') */}
      {coverClip && coverClip.kind === "video" && coverClip.fit === "contain" && (() => {
        const c = coverClip as VideoClip;
        const bx = c.x ?? 0;
        const by = c.y ?? 0;
        const bw = c.width ?? fw;
        const bh = c.height ?? fh;
        const sel = selection?.kind === "clip" && selection.trackId === videoTrackId && selection.clipIndex === coverCi;
        return (
          <div
            className={"ov-inset" + (sel ? " sel" : "")}
            style={{ left: `${pctX(bx)}%`, top: `${pctY(by)}%`, width: `${(bw / fw) * 100}%`, height: `${(bh / fh) * 100}%`, pointerEvents: "auto" }}
            onPointerDown={(e) => {
              setSelection({ kind: "clip", trackId: videoTrackId, clipIndex: coverCi });
              startDrag({ kind: "box-move", trackId: videoTrackId, ci: coverCi, ox: bx, oy: by, w: bw, h: bh, px: e.clientX, py: e.clientY }, e);
            }}
          >
            {sel && (
              <div
                className="handle br"
                onPointerDown={(e) =>
                  startDrag({ kind: "box-size", trackId: videoTrackId, ci: coverCi, cx: bx, cy: by, w0: bw, h0: bh, px: e.clientX, py: e.clientY }, e)
                }
              />
            )}
          </div>
        );
      })()}

      {/* Image clips (active) — selectable / movable / resizable like the box-video.
          Center-offset x/y in px (CONTRACT §2); drag writes static x/y. */}
      {activeImgs.map(({ trackId, clipIndex, clip }) => {
        const sel = sameSelection(selection, { kind: "clip", trackId, clipIndex });
        return (
          <div
            key={`img-${trackId}-${clipIndex}`}
            className={"ov-image" + (sel ? " sel" : "")}
            style={{ left: `${pctX(clip.x)}%`, top: `${pctY(clip.y)}%`, width: `${(clip.width / fw) * 100}%`, height: `${(clip.height / fh) * 100}%`, pointerEvents: "auto" }}
            onPointerDown={(e) => {
              setSelection({ kind: "clip", trackId, clipIndex });
              startDrag({ kind: "image-move", trackId, ci: clipIndex, ox: clip.x, oy: clip.y, px: e.clientX, py: e.clientY }, e);
            }}
          >
            {sel && (
              <div
                className="handle br"
                onPointerDown={(e) =>
                  startDrag({ kind: "image-size", trackId, ci: clipIndex, w0: clip.width, h0: clip.height, px: e.clientX, py: e.clientY }, e)
                }
              />
            )}
          </div>
        );
      })}

      {/* Shapes (active) */}
      {activeSh.map((shi) => {
        const sh = shapes[shi];
        if (!sh) return null;
        const sel = sameSelection(selection, { kind: "shape", shapeIndex: shi });
        const hasPos = shapeTracked(sh, "position");
        const rel = Math.round(frame - sh.start);
        return (
          <div
            key={`sh-${shi}`}
            className={"ov-shape" + (sel ? " sel" : "")}
            style={{ left: `${pctX(sh.x)}%`, top: `${pctY(sh.y)}%`, width: `${(sh.width / fw) * 100}%`, height: `${(sh.height / fh) * 100}%`, pointerEvents: "auto" }}
            onPointerDown={(e) => {
              setSelection({ kind: "shape", shapeIndex: shi });
              startDrag({ kind: "shape-move", shi, ox: sh.x, oy: sh.y, px: e.clientX, py: e.clientY, auto: hasPos, rel }, e);
            }}
          >
            {sel && (
              <div
                className="handle br"
                onPointerDown={(e) =>
                  startDrag({ kind: "shape-size", shi, w0: sh.width, h0: sh.height, px: e.clientX, py: e.clientY }, e)
                }
              />
            )}
          </div>
        );
      })}

      {/* Active words (position) */}
      {activeW.map((wi) => {
        const w = words[wi];
        if (!w) return null;
        const sel = sameSelection(selection, { kind: "word", wordIndex: wi });
        const hasPos = hasTrack(w.keyframes?.position);
        const rel = Math.round(frame - w.start);
        return (
          <div
            key={`w-${wi}`}
            className={"ov-word" + (sel ? " sel" : "")}
            style={{
              left: `${pctX(w.x)}%`,
              top: `${pctY(w.y)}%`,
              fontFamily: resolveFont(w.font),
              fontStyle: resolveFontStyle(w.font),
              fontSize: w.size * S,
              fontWeight: w.weight,
              color: "transparent",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              pointerEvents: "auto",
            }}
            onPointerDown={(e) => {
              setSelection({ kind: "word", wordIndex: wi });
              startDrag({ kind: "word", wi, ox: w.x, oy: w.y, px: e.clientX, py: e.clientY, auto: hasPos, rel }, e);
            }}
          >
            {applyCase(w.text, w.case)}
            <div className="dot" />
          </div>
        );
      })}
    </div>
  );
};

// SVG path + anchors + spatial-tangent handles for a position track.
const MotionPath: React.FC<{
  word: { keyframes?: { position?: import("@engine/types").PositionKeyframe[] } };
  pxX: (o: number) => number;
  pxY: (o: number) => number;
  wi: number;
  kfSel: KfSelection;
  onAnchorDown: (e: React.PointerEvent, index: number, v: Vec2) => void;
  onTangentDown: (e: React.PointerEvent, index: number, which: "in" | "out", t: Vec2) => void;
  width: number;
  height: number;
}> = ({ word, pxX, pxY, wi, kfSel, onAnchorDown, onTangentDown, width, height }) => {
  const track = word.keyframes!.position!;
  const f0 = track[0].frame;
  const f1 = track[track.length - 1].frame;
  const pts: string[] = [];
  const steps = Math.max(2, Math.min(240, (f1 - f0) * 2));
  for (let i = 0; i <= steps; i++) {
    const f = f0 + ((f1 - f0) * i) / steps;
    const p = samplePosition(track, f);
    pts.push(`${pxX(p.x)},${pxY(p.y)}`);
  }
  const selIdx = (i: number) =>
    !!kfSel && kfSel.property === "position" && kfSel.wordIndex === wi && kfSel.indices.includes(i);

  return (
    <svg className="motion-path" width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <polyline points={pts.join(" ")} className="mp-line" />
      {track.map((k, i) => {
        const ax = pxX(k.value.x);
        const ay = pxY(k.value.y);
        const out = k.spatialOut;
        const inn = k.spatialIn;
        return (
          <g key={i}>
            {out && (
              <>
                <line x1={ax} y1={ay} x2={pxX(k.value.x + out.x)} y2={pxY(k.value.y + out.y)} className="mp-handle-line" />
                <circle cx={pxX(k.value.x + out.x)} cy={pxY(k.value.y + out.y)} r={6} className="mp-handle" style={{ pointerEvents: "auto" }} onPointerDown={(e) => onTangentDown(e, i, "out", out)} />
              </>
            )}
            {inn && (
              <>
                <line x1={ax} y1={ay} x2={pxX(k.value.x + inn.x)} y2={pxY(k.value.y + inn.y)} className="mp-handle-line" />
                <circle cx={pxX(k.value.x + inn.x)} cy={pxY(k.value.y + inn.y)} r={6} className="mp-handle" style={{ pointerEvents: "auto" }} onPointerDown={(e) => onTangentDown(e, i, "in", inn)} />
              </>
            )}
            <rect x={ax - 6} y={ay - 6} width={12} height={12} className={"mp-anchor" + (selIdx(i) ? " sel" : "")} style={{ pointerEvents: "auto" }} onPointerDown={(e) => onAnchorDown(e, i, k.value)} />
            {!out && !inn && (
              <text x={ax + 10} y={ay - 8} className="mp-addtan" style={{ pointerEvents: "auto", cursor: "pointer" }} onPointerDown={(e) => onTangentDown(e, i, "out", { x: 60, y: 0 })}>
                +curve
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
