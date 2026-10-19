import React from "react";
import type {
  EnterFrom,
  FontKey,
  KeyframeProperty,
  ShapeKeyframeProperty,
  TextCase,
  TransitionDir,
  TransitionType,
} from "@engine/types";
import type { TimelineV3, VideoClip, ColorClip, ImageClip } from "@engine/types.v3";
import { textTrackOf, shapeTrackOf, videoTrackOf } from "@engine/types.v3";
import {
  deleteShape,
  deleteWord,
  duplicateShape,
  updateWord,
  updateShape,
  updateClip,
  type ClipPatch,
  setVideoClipKind,
  setClipTransition,
  updateClipTransition,
  deleteClip,
  deleteTrack,
  updateAudioClip,
  deleteAudioClip,
  updateDucking,
} from "../edits";
import { durationV3 } from "../v3util";
import type { Selection } from "../selection";
import { setPositionKey, setScalarKey, type KfClipboard, type WordRef } from "../keyframes/kfEdits";
import { AnimationPanel } from "../animation/AnimationPanel";
import { setShapePositionKey, setShapeScalarKey, shapeCurrentValue, shapeTracked, type ShapeRef } from "../keyframes/shapeKfEdits";
import type { KfSelection } from "../keyframes/kfSelection";
import { GraphEditor } from "../keyframes/GraphEditor";
import { currentValue, FONT_OPTIONS, FONT_LABELS } from "../keyframes/kfModel";
import { RED, BORDO } from "@engine/presets";
import { replaceClipMedia } from "../mediaActions";
import { useToast } from "../toast";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Right-hand property panel (v3 tracks). Word/shape start/end are ABSOLUTE frames.
// AUTO-KEYFRAME (CONTRACT §4): an animatable field with an EXISTING track writes a
// keyframe at the element-relative playhead; a field with NO track edits the static
// fallback or seeds a track.
export const Panel: React.FC<{
  timeline: TimelineV3;
  setTimeline: (tl: TimelineV3) => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  frame: number;
  kfSel: KfSelection;
  setKfSel: (s: KfSelection) => void;
  clipboard: KfClipboard | null;
  onCopy: () => void;
  onPaste: (refs: WordRef[], offsetToPlayhead: boolean) => void;
}> = ({ timeline, setTimeline, selection, setSelection, frame, kfSel, clipboard, onCopy, onPaste }) => {
  const duration = durationV3(timeline);
  const toast = useToast();

  if (!selection) {
    return (
      <div className="panel">
        <h3>Properties</h3>
        <div className="empty">Select a clip, word, shape, transition or audio.</div>
      </div>
    );
  }

  // ===== Word =====
  if (selection.kind === "word") {
    const { wordIndex } = selection;
    const w = textTrackOf(timeline)?.words[wordIndex];
    if (!w) return <Empty />;
    const ref: WordRef = { wordIndex };
    const set = (patch: Partial<typeof w>) => setTimeline(updateWord(timeline, wordIndex, patch));
    const rel = Math.max(0, Math.round(frame - w.start));
    const tracked = (p: KeyframeProperty) => {
      const t = w.keyframes?.[p] as unknown[] | undefined;
      return Array.isArray(t) && t.length > 0;
    };
    const setScalarProp = (p: Exclude<KeyframeProperty, "position">, value: number | string, staticPatch?: Partial<typeof w>) => {
      if (tracked(p)) setTimeline(setScalarKey(timeline, ref, p, rel, value));
      else if (staticPatch) set(staticPatch);
      else setTimeline(setScalarKey(timeline, ref, p, rel, value));
    };
    const setPos = (x: number, y: number) => {
      if (tracked("position")) setTimeline(setPositionKey(timeline, ref, rel, { x, y }));
      else set({ x, y });
    };
    const allWords = textTrackOf(timeline)?.words ?? [];
    return (
      <div className="panel">
        <h3>Word</h3>
        <Field label="Text"><input value={w.text} onChange={(e) => set({ text: e.target.value })} /></Field>
        <Field label={"Font" + (tracked("fontFamily") ? " ◇" : "")}>
          <select
            value={tracked("fontFamily") ? (currentValue(w, "fontFamily", rel) as string) : w.font}
            onChange={(e) => setScalarProp("fontFamily", e.target.value as FontKey, { font: e.target.value as FontKey })}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f}>{FONT_LABELS[f]}</option>
            ))}
          </select>
        </Field>
        <Field label="Case">
          <select value={w.case ?? "none"} onChange={(e) => set({ case: e.target.value as TextCase })}>
            <option value="none">none</option>
            <option value="upper">upper</option>
            <option value="lower">lower</option>
          </select>
        </Field>
        <div className="row2">
          <Field label={"Size" + (tracked("size") ? " ◇" : "")}>
            <input type="number" value={tracked("size") ? Math.round(currentValue(w, "size", rel) as number) : w.size}
              onChange={(e) => setScalarProp("size", Math.max(1, parseInt(e.target.value) || 1), { size: Math.max(1, parseInt(e.target.value) || 1) })} />
          </Field>
          <Field label={"Weight" + (tracked("weight") ? " ◇" : "")}>
            {tracked("weight") ? (
              <input type="number" min={100} max={900} step={10} value={Math.round(currentValue(w, "weight", rel) as number)}
                onChange={(e) => setScalarProp("weight", clamp(parseInt(e.target.value) || 100, 100, 900))} />
            ) : (
              <select value={String(w.weight)} onChange={(e) => set({ weight: parseInt(e.target.value) })}>
                <option value="400">400</option>
                <option value="700">700</option>
                <option value="800">800</option>
              </select>
            )}
          </Field>
        </div>
        <Field label={"Color" + (tracked("color") ? " ◇" : "")}>
          <div className="color-row">
            <input type="color" value={tracked("color") ? (currentValue(w, "color", rel) as string) : w.color}
              onChange={(e) => setScalarProp("color", e.target.value, { color: e.target.value })} />
            <Swatches
              current={tracked("color") ? (currentValue(w, "color", rel) as string) : w.color}
              onPick={(c) => setScalarProp("color", c, { color: c })}
            />
          </div>
        </Field>
        <Field label="Enter">
          <select value={w.enterFrom} onChange={(e) => set({ enterFrom: e.target.value as EnterFrom })}>
            {["left", "right", "top", "bottom", "none"].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <div className="row2">
          <Field label="Start (abs)">
            <input type="number" value={w.start} onChange={(e) => set({ start: clamp(parseInt(e.target.value) || 0, 0, w.end - 1) })} />
          </Field>
          <Field label="End (abs)">
            <input type="number" value={w.end} onChange={(e) => set({ end: clamp(parseInt(e.target.value) || 0, w.start + 1, duration) })} />
          </Field>
        </div>
        <div className="row2">
          <Field label={"X" + (tracked("position") ? " ◇" : "")}>
            <input type="number" value={tracked("position") ? Math.round((currentValue(w, "position", rel) as { x: number }).x) : w.x}
              onChange={(e) => setPos(parseInt(e.target.value) || 0, tracked("position") ? (currentValue(w, "position", rel) as { y: number }).y : w.y)} />
          </Field>
          <Field label={"Y" + (tracked("position") ? " ◇" : "")}>
            <input type="number" value={tracked("position") ? Math.round((currentValue(w, "position", rel) as { y: number }).y) : w.y}
              onChange={(e) => setPos(tracked("position") ? (currentValue(w, "position", rel) as { x: number }).x : w.x, parseInt(e.target.value) || 0)} />
          </Field>
        </div>

        <div className="kf-section">
          <h4>Keyframes <span className="muted">· playhead @{rel}f (word-rel)</span></h4>
          <div className="row2">
            <Field label={"Opacity" + (tracked("opacity") ? " ◇" : "")}>
              <input type="number" step="0.05" min="0" max="1" value={Number((currentValue(w, "opacity", rel) as number).toFixed(2))}
                onChange={(e) => setScalarProp("opacity", clamp(parseFloat(e.target.value) || 0, 0, 1))} />
            </Field>
            <Field label={"Rotation" + (tracked("rotation") ? " ◇" : "")}>
              <input type="number" step="1" value={Math.round(currentValue(w, "rotation", rel) as number)}
                onChange={(e) => setScalarProp("rotation", parseInt(e.target.value) || 0)} />
            </Field>
          </div>
          <div className="row2">
            <Field label={"Blur" + (tracked("blur") ? " ◇" : "")}>
              <input type="number" step="0.5" min="0" value={Number((currentValue(w, "blur", rel) as number).toFixed(1))}
                onChange={(e) => setScalarProp("blur", Math.max(0, parseFloat(e.target.value) || 0))} />
            </Field>
            <Field label={"Letter-sp" + (tracked("letterSpacing") ? " ◇" : "")}>
              <input type="number" step="1" value={Math.round(currentValue(w, "letterSpacing", rel) as number)}
                onChange={(e) => setScalarProp("letterSpacing", parseInt(e.target.value) || 0)} />
            </Field>
          </div>

          <AnimationPanel timeline={timeline} setTimeline={setTimeline} selection={selection} />

          <div className="kf-clip-row">
            <button onClick={onCopy} title="Copy selected keyframes / track / whole word (⌘C)">Copy</button>
            <button disabled={!clipboard} onClick={() => onPaste([ref], false)} title="Paste onto this word (⌘V)">Paste</button>
            <button disabled={!clipboard} onClick={() => onPaste([ref], true)} title="Paste, offset earliest kf to playhead (⇧⌘V)">Paste@play</button>
            <button disabled={!clipboard} title="Paste onto every word" onClick={() => onPaste(allWords.map((_, wi) => ({ wordIndex: wi })), false)}>Paste→all</button>
          </div>

          <GraphEditor timeline={timeline} setTimeline={setTimeline} wordRef={ref} word={w} kfSel={kfSel} />
        </div>

        <button className="danger" onClick={() => { setTimeline(deleteWord(timeline, wordIndex)); setSelection(null); }}>Delete word</button>
      </div>
    );
  }

  // ===== Visual clip (video | color | image) =====
  if (selection.kind === "clip") {
    const { trackId, clipIndex } = selection;
    const tr = timeline.tracks.find((t) => t.id === trackId);
    const clip = tr && (tr.kind === "video" || tr.kind === "image") ? tr.clips[clipIndex] : undefined;
    if (!clip) return <Empty />;
    const patch = (p: ClipPatch) => setTimeline(updateClip(timeline, trackId, clipIndex, p));
    const isVideoTrack = tr!.kind === "video";
    const loadMedia = async (asBox: boolean) =>
      setTimeline(await replaceClipMedia(timeline, trackId, clipIndex, null, toast, { asBox }));

    return (
      <div className="panel">
        <h3>Clip · {clip.kind}</h3>
        {isVideoTrack && (
          <Field label="Kind">
            <select value={clip.kind} onChange={(e) => setTimeline(setVideoClipKind(timeline, trackId, clipIndex, e.target.value as "video" | "color"))}>
              <option value="video">Video</option>
              <option value="color">Color</option>
            </select>
          </Field>
        )}
        <div className="row2">
          <Field label="Start (abs)">
            <input type="number" value={clip.start} onChange={(e) => patch({ start: clamp(parseInt(e.target.value) || 0, 0, clip.end - 1) })} />
          </Field>
          <Field label="End (abs)">
            <input type="number" value={clip.end} onChange={(e) => patch({ end: Math.max(clip.start + 1, parseInt(e.target.value) || clip.start + 1) })} />
          </Field>
        </div>

        {clip.kind === "color" && (
          <Field label="Color"><input type="color" value={(clip as ColorClip).color} onChange={(e) => patch({ color: e.target.value })} /></Field>
        )}

        {clip.kind === "video" && (() => {
          const c = clip as VideoClip;
          return (
            <>
              <Field label="Src"><input value={c.src} onChange={(e) => patch({ src: e.target.value })} /></Field>
              <Field label="Fit">
                <select value={c.fit} onChange={(e) => patch({ fit: e.target.value as "cover" | "contain" })}>
                  <option value="cover">cover (fullscreen)</option>
                  <option value="contain">contain (box)</option>
                </select>
              </Field>
              {c.fit === "contain" && (
                <>
                  <div className="row2">
                    <Field label="X"><input type="number" value={c.x ?? 0} onChange={(e) => patch({ x: parseInt(e.target.value) || 0 })} /></Field>
                    <Field label="Y"><input type="number" value={c.y ?? 0} onChange={(e) => patch({ y: parseInt(e.target.value) || 0 })} /></Field>
                  </div>
                  <div className="row2">
                    <Field label="Width"><input type="number" value={c.width ?? timeline.width} onChange={(e) => patch({ width: Math.max(1, parseInt(e.target.value) || 1) })} /></Field>
                    <Field label="Height"><input type="number" value={c.height ?? timeline.height} onChange={(e) => patch({ height: Math.max(1, parseInt(e.target.value) || 1) })} /></Field>
                  </div>
                  <div className="row2">
                    <Field label="Radius"><input type="number" value={c.borderRadius ?? 0} onChange={(e) => patch({ borderRadius: Math.max(0, parseInt(e.target.value) || 0) })} /></Field>
                    <Field label="Back color"><input type="color" value={c.backColor ?? "#000000"} onChange={(e) => patch({ backColor: e.target.value })} /></Field>
                  </div>
                </>
              )}
              <div className="row2">
                <Field label="StartFrom"><input type="number" value={c.startFrom} onChange={(e) => patch({ startFrom: Math.max(0, parseInt(e.target.value) || 0) })} /></Field>
                <Field label="Volume"><input type="number" step="0.05" min="0" max="1" value={c.volume ?? 1} onChange={(e) => patch({ volume: clamp(parseFloat(e.target.value) || 0, 0, 1) })} /></Field>
              </div>
              <Field label="Muted">
                <input type="checkbox" checked={c.muted ?? false} onChange={(e) => patch({ muted: e.target.checked })} style={{ flex: "none", width: 18, height: 18 }} />
              </Field>
              {c.speechRegions && c.speechRegions.length > 0 && (
                <div className="empty" style={{ fontSize: 11 }}>{c.speechRegions.length} speech region(s) — frozen (ASR), drives ducking.</div>
              )}
            </>
          );
        })()}

        {clip.kind === "image" && (() => {
          const c = clip as ImageClip;
          return (
            <>
              <Field label="Src"><input value={c.src} onChange={(e) => patch({ src: e.target.value })} /></Field>
              <Field label="Fit">
                <select value={c.fit ?? "cover"} onChange={(e) => patch({ fit: e.target.value as "cover" | "contain" })}>
                  <option value="cover">cover</option>
                  <option value="contain">contain</option>
                </select>
              </Field>
              <div className="row2">
                <Field label="X"><input type="number" value={c.x} onChange={(e) => patch({ x: parseInt(e.target.value) || 0 })} /></Field>
                <Field label="Y"><input type="number" value={c.y} onChange={(e) => patch({ y: parseInt(e.target.value) || 0 })} /></Field>
              </div>
              <div className="row2">
                <Field label="Width"><input type="number" value={c.width} onChange={(e) => patch({ width: Math.max(1, parseInt(e.target.value) || 1) })} /></Field>
                <Field label="Height"><input type="number" value={c.height} onChange={(e) => patch({ height: Math.max(1, parseInt(e.target.value) || 1) })} /></Field>
              </div>
              <div className="row2">
                <Field label="Radius"><input type="number" value={c.borderRadius ?? 0} onChange={(e) => patch({ borderRadius: Math.max(0, parseInt(e.target.value) || 0) })} /></Field>
                <Field label="Opacity"><input type="number" step="0.05" min="0" max="1" value={c.opacity ?? 1} onChange={(e) => patch({ opacity: clamp(parseFloat(e.target.value) || 0, 0, 1) })} /></Field>
              </div>
            </>
          );
        })()}

        {clip.kind !== "color" && (
          <div className="kf-clip-row">
            <button onClick={() => loadMedia(clip.kind === "video" && (clip as VideoClip).fit === "contain")}>Replace media…</button>
          </div>
        )}
        <button className="danger" onClick={() => { setTimeline(deleteClip(timeline, trackId, clipIndex)); setSelection(null); }}>Delete clip</button>
      </div>
    );
  }

  // ===== Shape =====
  if (selection.kind === "shape") {
    const { shapeIndex } = selection;
    const sh = shapeTrackOf(timeline)?.shapes?.[shapeIndex];
    if (!sh) return <Empty />;
    const ref: ShapeRef = { shapeIndex };
    const rel = Math.max(0, Math.round(frame - sh.start));
    const set = (p: Partial<typeof sh>) => setTimeline(updateShape(timeline, shapeIndex, p));
    const tr = (p: ShapeKeyframeProperty) => shapeTracked(sh, p);
    const setProp = (p: Exclude<ShapeKeyframeProperty, "position">, value: number | string, staticPatch: Partial<typeof sh>) => {
      if (tr(p)) setTimeline(setShapeScalarKey(timeline, ref, p, rel, value));
      else set(staticPatch);
    };
    const setPos = (x: number, y: number) => {
      if (tr("position")) setTimeline(setShapePositionKey(timeline, ref, rel, { x, y }));
      else set({ x, y });
    };
    const curX = tr("position") ? Math.round((shapeCurrentValue(sh, "position", rel) as { x: number }).x) : sh.x;
    const curY = tr("position") ? Math.round((shapeCurrentValue(sh, "position", rel) as { y: number }).y) : sh.y;
    const num = (p: Exclude<ShapeKeyframeProperty, "position" | "color">, fallback: number) =>
      tr(p) ? Math.round(shapeCurrentValue(sh, p, rel) as number) : fallback;
    return (
      <div className="panel">
        <h3>Shape · {sh.shape}</h3>
        <Field label="ID"><input value={sh.id} onChange={(e) => set({ id: e.target.value })} /></Field>
        <div className="row2">
          <Field label={"X" + (tr("position") ? " ◇" : "")}><input type="number" value={curX} onChange={(e) => setPos(parseInt(e.target.value) || 0, curY)} /></Field>
          <Field label={"Y" + (tr("position") ? " ◇" : "")}><input type="number" value={curY} onChange={(e) => setPos(curX, parseInt(e.target.value) || 0)} /></Field>
        </div>
        <div className="row2">
          <Field label={"Width" + (tr("width") ? " ◇" : "")}><input type="number" value={num("width", sh.width)} onChange={(e) => setProp("width", Math.max(1, parseInt(e.target.value) || 1), { width: Math.max(1, parseInt(e.target.value) || 1) })} /></Field>
          <Field label={(sh.shape === "line" ? "Thickness" : "Height") + (tr("height") ? " ◇" : "")}><input type="number" value={num("height", sh.height)} onChange={(e) => setProp("height", Math.max(1, parseInt(e.target.value) || 1), { height: Math.max(1, parseInt(e.target.value) || 1) })} /></Field>
        </div>
        <Field label={"Color" + (tr("color") ? " ◇" : "")}><input type="color" value={tr("color") ? (shapeCurrentValue(sh, "color", rel) as string) : sh.color} onChange={(e) => setProp("color", e.target.value, { color: e.target.value })} /></Field>
        {sh.shape === "rect" && (
          <Field label={"Radius" + (tr("borderRadius") ? " ◇" : "")}><input type="number" value={num("borderRadius", sh.borderRadius ?? 0)} onChange={(e) => setProp("borderRadius", Math.max(0, parseInt(e.target.value) || 0), { borderRadius: Math.max(0, parseInt(e.target.value) || 0) })} /></Field>
        )}
        <div className="row2">
          <Field label={"Opacity" + (tr("opacity") ? " ◇" : "")}><input type="number" step="0.05" min="0" max="1" value={tr("opacity") ? Number((shapeCurrentValue(sh, "opacity", rel) as number).toFixed(2)) : sh.opacity ?? 1} onChange={(e) => setProp("opacity", clamp(parseFloat(e.target.value) || 0, 0, 1), { opacity: clamp(parseFloat(e.target.value) || 0, 0, 1) })} /></Field>
          <Field label={"Rotation" + (tr("rotation") ? " ◇" : "")}><input type="number" value={num("rotation", sh.rotation ?? 0)} onChange={(e) => setProp("rotation", parseInt(e.target.value) || 0, { rotation: parseInt(e.target.value) || 0 })} /></Field>
        </div>
        <div className="row2">
          <Field label="Start (abs)"><input type="number" value={sh.start} onChange={(e) => set({ start: clamp(parseInt(e.target.value) || 0, 0, sh.end - 1) })} /></Field>
          <Field label="End (abs)"><input type="number" value={sh.end} onChange={(e) => set({ end: clamp(parseInt(e.target.value) || 0, sh.start + 1, duration) })} /></Field>
        </div>
        <AnimationPanel timeline={timeline} setTimeline={setTimeline} selection={selection} />
        <div className="kf-clip-row">
          <button onClick={() => setTimeline(duplicateShape(timeline, shapeIndex))}>Duplicate</button>
        </div>
        <button className="danger" onClick={() => { setTimeline(deleteShape(timeline, shapeIndex)); setSelection(null); }}>Delete shape</button>
      </div>
    );
  }

  // ===== Audio clip =====
  if (selection.kind === "audioClip") {
    const { trackId, clipIndex } = selection;
    const tr = timeline.tracks.find((t) => t.id === trackId);
    const a = tr?.kind === "audio" ? tr.clips[clipIndex] : undefined;
    if (!a) return <Empty />;
    const upd = (p: Parameters<typeof updateAudioClip>[3]) => setTimeline(updateAudioClip(timeline, trackId, clipIndex, p));
    const d = a.ducking;
    return (
      <div className="panel">
        <h3>Audio clip</h3>
        <Field label="Src"><input value={a.src} onChange={(e) => upd({ src: e.target.value })} /></Field>
        <div className="row2">
          <Field label="Start (abs)"><input type="number" value={a.start} onChange={(e) => upd({ start: clamp(parseInt(e.target.value) || 0, 0, a.end - 1) })} /></Field>
          <Field label="End (abs)"><input type="number" value={a.end} onChange={(e) => upd({ end: Math.max(a.start + 1, parseInt(e.target.value) || a.start + 1) })} /></Field>
        </div>
        <div className="row2">
          <Field label="StartFrom"><input type="number" value={a.startFrom} onChange={(e) => upd({ startFrom: Math.max(0, parseInt(e.target.value) || 0) })} /></Field>
          <Field label="Volume"><input type="number" step="0.05" min="0" max="1" value={a.volume} onChange={(e) => upd({ volume: clamp(parseFloat(e.target.value) || 0, 0, 1) })} /></Field>
        </div>
        <div className="row2">
          <Field label="Fade in"><input type="number" value={a.fadeInFrames ?? 0} onChange={(e) => upd({ fadeInFrames: Math.max(0, parseInt(e.target.value) || 0) })} /></Field>
          <Field label="Fade out"><input type="number" value={a.fadeOutFrames ?? 0} onChange={(e) => upd({ fadeOutFrames: Math.max(0, parseInt(e.target.value) || 0) })} /></Field>
        </div>
        <Field label="Duck speech">
          <input type="checkbox" checked={d?.enabled ?? false} onChange={(e) => setTimeline(updateDucking(timeline, trackId, clipIndex, { enabled: e.target.checked }))} style={{ flex: "none", width: 18, height: 18 }} />
        </Field>
        {d?.enabled && (
          <>
            <Field label="Ducked vol"><input type="number" step="0.05" min="0" max="1" value={d.duckedVolume} onChange={(e) => setTimeline(updateDucking(timeline, trackId, clipIndex, { duckedVolume: clamp(parseFloat(e.target.value) || 0, 0, 1) }))} /></Field>
            <div className="row2">
              <Field label="Attack"><input type="number" value={d.attackFrames} onChange={(e) => setTimeline(updateDucking(timeline, trackId, clipIndex, { attackFrames: Math.max(0, parseInt(e.target.value) || 0) }))} /></Field>
              <Field label="Release"><input type="number" value={d.releaseFrames} onChange={(e) => setTimeline(updateDucking(timeline, trackId, clipIndex, { releaseFrames: Math.max(0, parseInt(e.target.value) || 0) }))} /></Field>
            </div>
          </>
        )}
        <button className="danger" onClick={() => { setTimeline(deleteAudioClip(timeline, trackId, clipIndex)); setSelection(null); }}>Delete audio clip</button>
      </div>
    );
  }

  // ===== Track header =====
  if (selection.kind === "track") {
    const tr = timeline.tracks.find((t) => t.id === selection.trackId);
    if (!tr) return <Empty />;
    const removable = tr.kind === "image" || tr.kind === "audio";
    return (
      <div className="panel">
        <h3>Track · {tr.kind}</h3>
        <div className="empty" style={{ fontSize: 11 }}>{tr.id}</div>
        {removable && (
          <button className="danger" onClick={() => { setTimeline(deleteTrack(timeline, tr.id)); setSelection(null); }}>Remove track</button>
        )}
      </div>
    );
  }

  // ===== Transition (per-clip join) =====
  const { trackId, clipIndex } = selection;
  const tr = timeline.tracks.find((t) => t.id === trackId);
  const clips = tr && (tr.kind === "video" || tr.kind === "image") ? tr.clips : undefined;
  const clip = clips?.[clipIndex];
  const t = clip?.transitionToNext;
  if (!clip || !t) return <Empty />;
  const next = clips![clipIndex + 1];
  const maxDur = next ? Math.max(1, Math.min(clip.end - clip.start, next.end - next.start) - 1) : 1;
  const needsDir = t.type === "slide" || t.type === "wipe";
  return (
    <div className="panel">
      <h3>Transition</h3>
      <Field label="Type">
        <select
          value={t.type}
          onChange={(e) => {
            const type = e.target.value as TransitionType;
            if (type === "none") { setTimeline(setClipTransition(timeline, trackId, clipIndex, null)); setSelection(null); }
            else setTimeline(updateClipTransition(timeline, trackId, clipIndex, { type }));
          }}
        >
          <option value="fade">fade</option>
          <option value="slide">slide</option>
          <option value="wipe">wipe</option>
          <option value="none">none (remove)</option>
        </select>
      </Field>
      {needsDir && (
        <Field label="Direction">
          <select value={t.direction ?? "from-left"} onChange={(e) => setTimeline(updateClipTransition(timeline, trackId, clipIndex, { direction: e.target.value as TransitionDir }))}>
            {["from-left", "from-right", "from-top", "from-bottom"].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
      )}
      <Field label={`Duration (≤${maxDur})`}>
        <input type="number" value={t.durationInFrames} onChange={(e) => setTimeline(updateClipTransition(timeline, trackId, clipIndex, { durationInFrames: clamp(parseInt(e.target.value) || 1, 1, maxDur) }))} />
      </Field>
      <Field label="Timing">
        <select value={t.timing ?? "linear"} onChange={(e) => setTimeline(updateClipTransition(timeline, trackId, clipIndex, { timing: e.target.value as "linear" | "spring" }))}>
          <option value="linear">linear</option>
          <option value="spring">spring</option>
        </select>
      </Field>
      <button className="danger" onClick={() => { setTimeline(setClipTransition(timeline, trackId, clipIndex, null)); setSelection(null); }}>Remove transition</button>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);

/** One-click accent presets for the text color picker: white, red, bordo. */
const COLOR_SWATCHES: { value: string; title: string }[] = [
  { value: "#ffffff", title: "White" },
  { value: RED, title: "Red" },
  { value: BORDO, title: "Bordo" },
];

const Swatches: React.FC<{ current: string; onPick: (c: string) => void }> = ({ current, onPick }) => (
  <div className="swatches">
    {COLOR_SWATCHES.map((s) => (
      <button
        key={s.value}
        type="button"
        title={`${s.title} (${s.value})`}
        className={"swatch" + (current.toLowerCase() === s.value.toLowerCase() ? " sel" : "")}
        style={{ background: s.value }}
        onClick={() => onPick(s.value)}
      />
    ))}
  </div>
);

const Empty: React.FC = () => (
  <div className="panel">
    <h3>Properties</h3>
    <div className="empty">Selection no longer exists.</div>
  </div>
);
