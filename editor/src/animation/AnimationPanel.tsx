import React, { useState } from "react";
import type { EnterFrom } from "@engine/types";
import type { TimelineV3 } from "@engine/types.v3";
import { textTrackOf, shapeTrackOf, videoTrackOf } from "@engine/types.v3";
import type { Selection } from "../selection";
import type { WordRef } from "../keyframes/kfEdits";
import type { ShapeRef } from "../keyframes/shapeKfEdits";
import { durationV3 } from "../v3util";
import {
  ANIM_BUTTONS,
  applyCumulativeReveal,
  applyShapeAnim,
  applyWordAnim,
  DEFAULT_CUMULATIVE,
  shapePresetProps,
  wordPresetProps,
  type AnimId,
  type AnimOpts,
  type CumulativeEntrance,
} from "./presets-ui";

// The Animation panel (v2.6, v3 tracks): a grid of one-click animation presets for
// the selected word or shape, plus the cumulative word-by-word reveal. Each button
// calls an existing engine generator (presets-ui → @engine/presets) and merges the
// resulting keyframes into the element — which then show in the lanes / graph editor
// and are tunable like any hand-authored keyframes.
//
// Anchor: entrances are written at element START (word-relative frame 0) and
// fade-out at the element END — the playhead is NOT used (presets own their timing).

const DIRECTIONS: EnterFrom[] = ["left", "right", "top", "bottom"];

/** Absolute frame each held word should extend to: the end of the video-track clip
 *  covering `atFrame` (the v3 analogue of "scene end"), else the total duration. */
const holdEndFor = (tl: TimelineV3, atFrame: number): number => {
  for (const c of videoTrackOf(tl)?.clips ?? []) {
    if (atFrame >= c.start && atFrame < c.end) return c.end;
  }
  return durationV3(tl);
};

export const AnimationPanel: React.FC<{
  timeline: TimelineV3;
  setTimeline: (tl: TimelineV3) => void;
  selection: Extract<Selection, { kind: "word" } | { kind: "shape" }>;
}> = ({ timeline, setTimeline, selection }) => {
  const [direction, setDirection] = useState<EnterFrom>("left");
  const [duration, setDuration] = useState<string>(""); // "" → generator default
  const [cum, setCum] = useState(DEFAULT_CUMULATIVE);

  const isWord = selection.kind === "word";
  const dur = duration.trim() === "" ? undefined : Math.max(1, parseInt(duration) || 1);
  const opts: AnimOpts = { direction, duration: dur };

  const words = textTrackOf(timeline)?.words ?? [];
  const shapes = shapeTrackOf(timeline)?.shapes ?? [];

  const buttons = ANIM_BUTTONS.filter((b) => isWord || b.shape);
  const entrances = buttons.filter((b) => b.group === "entrance");
  const emphases = buttons.filter((b) => b.group === "emphasis");

  // Warn (don't block) when a preset will overwrite an existing track on this element.
  const willOverwrite = (id: AnimId): string[] => {
    if (isWord) {
      const w = words[(selection as { wordIndex: number }).wordIndex];
      if (!w?.keyframes) return [];
      return wordPresetProps(id, w, opts).filter((p) => (w.keyframes as Record<string, unknown[]>)[p]?.length);
    }
    const s = shapes[(selection as { shapeIndex: number }).shapeIndex];
    if (!s?.keyframes) return [];
    return shapePresetProps(id, s, opts).filter((p) => (s.keyframes as Record<string, unknown[]>)[p]?.length);
  };

  const apply = (id: AnimId) => {
    if (isWord) {
      const ref: WordRef = { wordIndex: (selection as { wordIndex: number }).wordIndex };
      setTimeline(applyWordAnim(timeline, ref, id, opts));
    } else {
      const ref: ShapeRef = { shapeIndex: (selection as { shapeIndex: number }).shapeIndex };
      setTimeline(applyShapeAnim(timeline, ref, id, opts));
    }
  };

  const btn = (b: (typeof ANIM_BUTTONS)[number]) => {
    const ow = willOverwrite(b.id);
    const title = ow.length ? `${b.title}\n⚠ overwrites: ${ow.join(", ")}` : b.title;
    return (
      <button key={b.id} title={title} onClick={() => apply(b.id)}>
        {b.label}
        {ow.length > 0 && <span style={{ color: "#f59e0b" }}> ⚠</span>}
      </button>
    );
  };

  const allWordIndices = () => words.map((_, i) => i);
  const fromSelectedOnward = () => {
    const wi = (selection as { wordIndex: number }).wordIndex;
    return words.map((_, i) => i).filter((i) => i >= wi);
  };
  const applyCum = (indices: number[]) => {
    if (indices.length === 0) return;
    const anchor = words[indices[0]]?.start ?? 0;
    setTimeline(applyCumulativeReveal(timeline, indices, { ...cum, duration: dur }, holdEndFor(timeline, anchor)));
  };

  return (
    <div className="kf-section anim-panel">
      <h4>Animation <span className="muted">· presets → keyframes</span></h4>

      <div className="row2">
        <div className="field">
          <label>Slide dir</label>
          <select value={direction} onChange={(e) => setDirection(e.target.value as EnterFrom)}>
            {DIRECTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Duration</label>
          <input
            type="number"
            min={1}
            placeholder="auto"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
      </div>

      <div className="anim-group-label">Entrance</div>
      <div className="kf-presets">{entrances.map(btn)}</div>

      <div className="anim-group-label">Emphasis</div>
      <div className="kf-presets">{emphases.map(btn)}</div>

      {isWord && (
        <div className="anim-cumulative">
          <div className="anim-group-label">Reveal words one by one (cumulative)</div>
          <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
            Words appear in turn; earlier words stay (hold to the covering clip's end).
          </div>
          <div className="row2">
            <div className="field">
              <label>Entrance</label>
              <select
                value={cum.entrance}
                onChange={(e) => setCum({ ...cum, entrance: e.target.value as CumulativeEntrance })}
              >
                <option value="slide">slide (alt. sides)</option>
                <option value="center">reveal center</option>
                <option value="fade">fade</option>
              </select>
            </div>
            <div className="field">
              <label>Stagger</label>
              <input
                type="number"
                min={1}
                value={cum.stagger}
                disabled={cum.snapToAsr}
                title={cum.snapToAsr ? "Ignored — using ASR word timings" : "Frames between entrances"}
                onChange={(e) => setCum({ ...cum, stagger: Math.max(1, parseInt(e.target.value) || 1) })}
              />
            </div>
          </div>
          <div className="field">
            <label>Snap to ASR</label>
            <input
              type="checkbox"
              checked={cum.snapToAsr}
              onChange={(e) => setCum({ ...cum, snapToAsr: e.target.checked })}
              style={{ flex: "none", width: 18, height: 18 }}
            />
          </div>
          <div className="field">
            <label>Hold</label>
            <input
              type="checkbox"
              checked={cum.holdToSceneEnd}
              title="Earlier words hold to the covering clip's end (accumulate)"
              onChange={(e) => setCum({ ...cum, holdToSceneEnd: e.target.checked })}
              style={{ flex: "none", width: 18, height: 18 }}
            />
          </div>
          <div className="kf-clip-row">
            <button title="Apply the cumulative reveal to every word" onClick={() => applyCum(allWordIndices())}>
              Apply to all
            </button>
            <button title="Apply from the selected word onward" onClick={() => applyCum(fromSelectedOnward())}>
              From this word →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
