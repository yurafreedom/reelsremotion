import React, { useRef } from "react";
import type { Easing, Word } from "@engine/types";
import type { TimelineV3 } from "@engine/types.v3";
import { PRESET_BEZIER } from "@engine/keyframes";
import { setEasing, type WordRef } from "./kfEdits";
import { propMeta } from "./kfModel";
import type { KfSelection } from "./kfSelection";
import { useTransaction } from "../useTimelineHistory";

const SIZE = 160;
const PAD = 18;
const PRESETS: { id: Easing; label: string }[] = [
  { id: "linear", label: "linear" },
  { id: "easeIn", label: "easeIn" },
  { id: "easeOut", label: "easeOut" },
  { id: "easeInOut", label: "easeInOut" },
  { id: "hold", label: "hold" },
];

// Map an easing to its 4 bezier control points for display (hold → null).
const toBezier = (e: Easing | undefined): [number, number, number, number] | null => {
  const v = e ?? "linear";
  if (v === "hold") return null;
  if (typeof v === "string") return PRESET_BEZIER[v] ?? PRESET_BEZIER.linear;
  return v.bezier;
};

const easingLabel = (e: Easing | undefined): string =>
  e === undefined ? "linear" : typeof e === "string" ? e : "custom bezier";

// Per-segment cubic-bezier SPEED/GRAPH editor (CONTRACT §4). Edits the temporal
// easing INTO the selected keyframe (the segment ending at it). Presets seed the
// curve; dragging the two handles makes it a custom bezier. Live in the Player.
export const GraphEditor: React.FC<{
  timeline: TimelineV3;
  setTimeline: (tl: TimelineV3) => void;
  wordRef: WordRef;
  word: Word;
  kfSel: KfSelection;
}> = ({ timeline, setTimeline, wordRef, word, kfSel }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<"p1" | "p2" | null>(null);
  const txn = useTransaction();

  if (!kfSel || kfSel.indices.length === 0) {
    return <div className="empty">Select a keyframe to edit its speed curve.</div>;
  }
  const property = kfSel.property;
  const index = kfSel.indices[kfSel.indices.length - 1];
  const track = word.keyframes?.[property] as { easing?: Easing }[] | undefined;
  if (!track || !track[index]) return <div className="empty">No keyframe selected.</div>;

  if (index === 0) {
    return (
      <div className="empty">
        First keyframe has no incoming segment. Select a later keyframe to shape its easing.
      </div>
    );
  }

  const easing = track[index].easing;
  const bez = toBezier(easing);

  const mapX = (x: number) => PAD + x * SIZE;
  const mapY = (y: number) => PAD + (1 - y) * SIZE;
  const unmapX = (px: number) => (px - PAD) / SIZE;
  const unmapY = (py: number) => 1 - (py - PAD) / SIZE;

  const clientToGraph = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = SIZE + PAD * 2;
    const px = ((clientX - r.left) / r.width) * sx;
    const py = ((clientY - r.top) / r.height) * sx;
    return { x: px, y: py };
  };

  const applyBezier = (p1: [number, number], p2: [number, number]) => {
    const cx = (n: number) => Math.max(0, Math.min(1, Math.round(n * 100) / 100));
    const cy = (n: number) => Math.max(-0.5, Math.min(1.5, Math.round(n * 100) / 100));
    setTimeline(
      setEasing(timeline, wordRef, property, index, {
        bezier: [cx(p1[0]), cy(p1[1]), cx(p2[0]), cy(p2[1])],
      })
    );
  };

  const onMove = (e: PointerEvent) => {
    if (!dragRef.current || !bez) return;
    const g = clientToGraph(e.clientX, e.clientY);
    const nx = unmapX(g.x);
    const ny = unmapY(g.y);
    if (dragRef.current === "p1") applyBezier([nx, ny], [bez[2], bez[3]]);
    else applyBezier([bez[0], bez[1]], [nx, ny]);
  };
  const onUp = () => {
    dragRef.current = null;
    txn.end(); // one coalesced undo step for the whole curve-handle drag
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  const startDrag = (which: "p1" | "p2") => (e: React.PointerEvent) => {
    e.stopPropagation();
    txn.begin(); // snapshot before the (optional) materialize + drag, so it's ONE step
    // If currently a preset/hold, materialize the bezier first so dragging works.
    if (!bez) applyBezier(PRESET_BEZIER.linear.slice(0, 2) as [number, number], PRESET_BEZIER.linear.slice(2) as [number, number]);
    dragRef.current = which;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const sx = SIZE + PAD * 2;
  return (
    <div className="graph-editor">
      <div className="graph-head">
        {propMeta(property).label} · kf #{index} · <b>{easingLabel(easing)}</b>
      </div>
      <svg
        ref={svgRef}
        className="graph-svg"
        viewBox={`0 0 ${sx} ${sx}`}
        width={sx}
        height={sx}
      >
        {/* frame */}
        <rect x={PAD} y={PAD} width={SIZE} height={SIZE} className="graph-box" />
        <line x1={mapX(0)} y1={mapY(0)} x2={mapX(1)} y2={mapY(1)} className="graph-diag" />
        {bez ? (
          <>
            {/* handles */}
            <line x1={mapX(0)} y1={mapY(0)} x2={mapX(bez[0])} y2={mapY(bez[1])} className="graph-handle-line" />
            <line x1={mapX(1)} y1={mapY(1)} x2={mapX(bez[2])} y2={mapY(bez[3])} className="graph-handle-line" />
            {/* curve */}
            <path
              d={`M ${mapX(0)} ${mapY(0)} C ${mapX(bez[0])} ${mapY(bez[1])}, ${mapX(bez[2])} ${mapY(bez[3])}, ${mapX(1)} ${mapY(1)}`}
              className="graph-curve"
            />
            <circle cx={mapX(bez[0])} cy={mapY(bez[1])} r={6} className="graph-knob" onPointerDown={startDrag("p1")} />
            <circle cx={mapX(bez[2])} cy={mapY(bez[3])} r={6} className="graph-knob" onPointerDown={startDrag("p2")} />
          </>
        ) : (
          // hold = step
          <path
            d={`M ${mapX(0)} ${mapY(0)} L ${mapX(1)} ${mapY(0)} L ${mapX(1)} ${mapY(1)}`}
            className="graph-curve hold"
          />
        )}
      </svg>
      <div className="graph-presets">
        {PRESETS.map((p) => (
          <button
            key={String(p.id)}
            className={easingLabel(easing) === p.label ? "active" : ""}
            onClick={() => setTimeline(setEasing(timeline, wordRef, property, index, p.id))}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
};
