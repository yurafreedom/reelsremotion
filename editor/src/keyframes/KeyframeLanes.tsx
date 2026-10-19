import React, { useRef } from "react";
import type { KeyframeProperty, Word } from "@engine/types";
import type { TimelineV3 } from "@engine/types.v3";
import { PROPERTIES, formatValue, trackOf } from "./kfModel";
import {
  addKeyframeFromCurrent,
  deleteKeys,
  deleteTrack,
  moveKey,
  type WordRef,
} from "./kfEdits";
import type { KfSelection } from "./kfSelection";
import { isDiamondSelected } from "./kfSelection";
import { useTransaction } from "../useTimelineHistory";

const LANE_H = 22;

// Per-word keyframe lanes shown UNDER the selected word's clip, on the SAME time
// axis as the timeline (so a diamond at word-relative frame f sits at absolute
// frame absStart+f, aligned beneath the clip). One lane per animatable property;
// empty properties show an "animate" affordance. Diamonds: click to select,
// shift/⌘-click to multi-select within a track, drag to retime (word-relative).
export const KeyframeLanes: React.FC<{
  timeline: TimelineV3;
  setTimeline: (tl: TimelineV3) => void;
  wordRef: WordRef;
  word: Word;
  absStart: number;
  f2x: (f: number) => number;
  clientToFrame: (clientX: number) => number;
  playheadFrame: number;
  kfSel: KfSelection;
  setKfSel: (s: KfSelection) => void;
}> = ({
  timeline,
  setTimeline,
  wordRef,
  word,
  absStart,
  f2x,
  clientToFrame,
  playheadFrame,
  kfSel,
  setKfSel,
}) => {
  const dragRef = useRef<
    | { property: KeyframeProperty; index: number; origFrame: number; snap: TimelineV3 }
    | null
  >(null);
  const txn = useTransaction();

  const wordRel = Math.round(playheadFrame - absStart);

  const onMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const newFrame = Math.max(0, Math.round(clientToFrame(e.clientX) - absStart));
    setTimeline(moveKey(d.snap, wordRef, d.property, d.index, newFrame));
  };
  const onUp = (e: PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    txn.end(); // one coalesced undo step for the diamond re-time drag
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (d) {
      // Re-point the selection at the diamond's (possibly re-sorted) new index.
      const f = Math.max(0, Math.round(clientToFrame(e.clientX) - absStart));
      const track = trackOf(word, d.property);
      const idx = track ? track.findIndex((k) => k.frame === f) : -1;
      if (idx >= 0) setKfSel({ ...wordRef, property: d.property, indices: [idx] });
    }
  };

  const onDiamondDown = (
    e: React.PointerEvent,
    property: KeyframeProperty,
    index: number,
    origFrame: number
  ) => {
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    if (additive && kfSel && kfSel.property === property && kfSel.wordIndex === wordRef.wordIndex) {
      const has = kfSel.indices.includes(index);
      setKfSel({
        ...kfSel,
        indices: has ? kfSel.indices.filter((i) => i !== index) : [...kfSel.indices, index],
      });
    } else {
      setKfSel({ ...wordRef, property, indices: [index] });
    }
    dragRef.current = { property, index, origFrame, snap: timeline };
    txn.begin(); // snapshot once; suppress intermediate per-move pushes
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const addAtPlayhead = (property: KeyframeProperty) => {
    setTimeline(addKeyframeFromCurrent(timeline, wordRef, property, Math.max(0, wordRel)));
    setKfSel({ ...wordRef, property, indices: [] });
  };

  return (
    <div className="kf-lanes">
      {PROPERTIES.map((p) => {
        const track = trackOf(word, p.key);
        const selTrack =
          kfSel?.property === p.key &&
          kfSel.wordIndex === wordRef.wordIndex;
        return (
          <div
            key={p.key}
            className={"kf-lane" + (selTrack ? " sel" : "")}
            style={{ height: LANE_H }}
          >
            <button
              className="kf-lane-label"
              title={track ? "Select whole track" : "Property has no keyframes"}
              onClick={() =>
                track &&
                setKfSel({ ...wordRef, property: p.key, indices: track.map((_, i) => i) })
              }
            >
              {p.label}
            </button>

            {/* add-at-playhead / animate affordance */}
            <button
              className="kf-add"
              title={track ? "Add keyframe at playhead" : "Animate: add first keyframe"}
              style={{ left: 76 }}
              onClick={() => addAtPlayhead(p.key)}
            >
              {track ? "+" : "◇+"}
            </button>

            {/* delete whole track */}
            {track && (
              <button
                className="kf-del-track"
                title="Delete track (revert to static)"
                onClick={() => {
                  setTimeline(deleteTrack(timeline, wordRef, p.key));
                  if (selTrack) setKfSel(null);
                }}
              >
                ×
              </button>
            )}

            {/* diamonds */}
            {track?.map((k, i) => {
              const selected = isDiamondSelected(kfSel, wordRef, p.key, i);
              return (
                <div
                  key={i}
                  className={"kf-diamond" + (selected ? " sel" : "")}
                  style={{ left: f2x(absStart + k.frame) }}
                  title={`${p.label} @${k.frame}f = ${formatValue(p.key, k.value)}${
                    k.easing ? ` · ${typeof k.easing === "string" ? k.easing : "bezier"}` : ""
                  }`}
                  onPointerDown={(e) => onDiamondDown(e, p.key, i, k.frame)}
                />
              );
            })}
          </div>
        );
      })}

      {/* delete selected diamonds button (also bound to Delete key in Editor) */}
      {kfSel && kfSel.indices.length > 0 && (
        <div className="kf-lane-actions">
          <button
            onClick={() => {
              setTimeline(deleteKeys(timeline, wordRef, kfSel.property, kfSel.indices));
              setKfSel(null);
            }}
          >
            Delete {kfSel.indices.length} keyframe{kfSel.indices.length > 1 ? "s" : ""}
          </button>
        </div>
      )}
    </div>
  );
};
