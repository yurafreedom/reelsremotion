// TimelineIO — env-agnostic import/export core, ported verbatim (semantics) from
// click-tool/index.html (CORE:TIMELINE-IO). Single behavior, now typed.
//
// Invariants (guarded by click-tool/roundtrip.test.cjs + editor io.test):
//   - CONTRACT §4 key order on every object.
//   - `case` emitted ONLY when present  → round-trip of a no-`case` word is
//     deep-equal to its input.
//   - `transitionToNext` emitted ONLY when present (v2.0) → round-trip of an old
//     timeline (no transitions) stays deep-equal to input.
//   - start/end never drift; untouched fields pass through verbatim.

import type {
  AudioTrack,
  Background,
  Easing,
  Keyframe,
  KeyframeProperty,
  Overlay,
  PositionKeyframe,
  Scene,
  SceneTransition,
  Shape,
  ShapeKeyframeProperty,
  ShapeKeyframes,
  Timeline,
  Vec2,
  Word,
  WordKeyframes,
} from "@engine/types";

// ----- Keyframe serialization (CONTRACT §4) -----
// Deep, key-order-stable, PRESENT-ONLY: optional fields (easing, spatial tangents)
// emit only when present, empty tracks are dropped, and `keyframes` is emitted
// only when ≥1 non-empty track remains — so a keyframeless word round-trips with
// NO `keyframes` key, and an authored word round-trips deep-equal.

function serializeEasing(e: Easing | undefined): Easing | undefined {
  if (e === undefined || e === null) return undefined;
  if (typeof e === "string") return e;
  const b = e.bezier;
  return { bezier: [b[0], b[1], b[2], b[3]] };
}

const serializeVec2 = (v: Vec2): Vec2 => ({ x: v.x, y: v.y });

function serializeScalarKf<T>(k: Keyframe<T>): Keyframe<T> {
  const o = { frame: k.frame, value: k.value } as Keyframe<T>;
  const e = serializeEasing(k.easing);
  if (e !== undefined) o.easing = e;
  return o;
}

function serializePositionKf(k: PositionKeyframe): PositionKeyframe {
  const o: PositionKeyframe = { frame: k.frame, value: serializeVec2(k.value) };
  const e = serializeEasing(k.easing);
  if (e !== undefined) o.easing = e;
  if (k.spatialIn) o.spatialIn = serializeVec2(k.spatialIn);
  if (k.spatialOut) o.spatialOut = serializeVec2(k.spatialOut);
  return o;
}

// Non-position tracks in CONTRACT §4 order. Scalar/color/discrete share a shape.
const FLAT_TRACKS: KeyframeProperty[] = [
  "size",
  "weight",
  "fontFamily",
  "letterSpacing",
  "color",
  "opacity",
  "rotation",
  "blur",
  "clipReveal",
];

export function serializeKeyframes(kf: WordKeyframes): WordKeyframes | undefined {
  const o: WordKeyframes = {};
  // position first (with spatial tangents).
  if (Array.isArray(kf.position) && kf.position.length > 0) {
    o.position = kf.position.map(serializePositionKf);
  }
  for (const key of FLAT_TRACKS) {
    const track = kf[key] as Keyframe<unknown>[] | undefined;
    if (Array.isArray(track) && track.length > 0) {
      (o[key] as unknown) = track.map(serializeScalarKf);
    }
  }
  return Object.keys(o).length > 0 ? o : undefined;
}

export function serializeWord(w: Word): Word {
  const o = {} as Word;
  o.text = w.text;
  o.start = w.start;
  o.end = w.end;
  o.x = w.x;
  o.y = w.y;
  o.font = w.font;
  o.size = w.size;
  o.weight = w.weight;
  o.color = w.color;
  o.enterFrom = w.enterFrom;
  if (w.case !== undefined && w.case !== null) o.case = w.case;
  // stroke/shadow (CONTRACT §4) — present-only so a no-accent word round-trips
  // deep-equal (pixel-gate safe). Same key-whitelist pattern as overlays.
  if (w.stroke !== undefined && w.stroke !== null) {
    o.stroke = { color: w.stroke.color, width: w.stroke.width };
  }
  if (Array.isArray(w.shadow)) {
    o.shadow = w.shadow.map((sh) => {
      const so = {} as NonNullable<Word["shadow"]>[number];
      if (sh.x !== undefined && sh.x !== null) so.x = sh.x;
      if (sh.y !== undefined && sh.y !== null) so.y = sh.y;
      so.blur = sh.blur;
      so.color = sh.color;
      return so;
    });
  }
  if (w.keyframes) {
    const kf = serializeKeyframes(w.keyframes);
    if (kf) o.keyframes = kf;
  }
  return o;
}

// ----- Background (CONTRACT §4 discriminated union) -----
// `type` first; per-variant fields in CONTRACT order; optional fields present-only
// so a minimal background round-trips deep-equal.
export function serializeBackground(b: Background): Background {
  switch (b.type) {
    case "color":
      return { type: "color", color: b.color };
    case "image": {
      const o: Background = { type: "image", src: b.src ?? "placeholder" };
      if (b.fit !== undefined && b.fit !== null) o.fit = b.fit;
      return o;
    }
    case "cover": {
      const o: Background = { type: "cover", src: b.src ?? "placeholder" };
      if (b.startFrom !== undefined && b.startFrom !== null) o.startFrom = b.startFrom;
      if (b.volume !== undefined && b.volume !== null) o.volume = b.volume;
      if (b.muted !== undefined && b.muted !== null) o.muted = b.muted;
      // speechRegions FROZEN (ASR) — pass through verbatim, never edited.
      if (Array.isArray(b.speechRegions)) {
        o.speechRegions = b.speechRegions.map((r) => ({
          startFrame: r.startFrame,
          endFrame: r.endFrame,
        }));
      }
      return o;
    }
    case "box": {
      const o: Background = {
        type: "box",
        src: b.src ?? "placeholder",
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        borderRadius: b.borderRadius ?? 0,
        backColor: b.backColor,
      };
      if (b.fit !== undefined && b.fit !== null) o.fit = b.fit;
      if (b.startFrom !== undefined && b.startFrom !== null) o.startFrom = b.startFrom;
      if (b.volume !== undefined && b.volume !== null) o.volume = b.volume;
      if (b.muted !== undefined && b.muted !== null) o.muted = b.muted;
      if (Array.isArray(b.speechRegions)) {
        o.speechRegions = b.speechRegions.map((r) => ({
          startFrame: r.startFrame,
          endFrame: r.endFrame,
        }));
      }
      return o;
    }
    default:
      // Defensive: an unknown/absent background → black color fill.
      return { type: "color", color: "#000000" };
  }
}

// ----- Shape (CONTRACT §4 — reuses the SAME keyframe serialization as words) -----
const SHAPE_FLAT_TRACKS: ShapeKeyframeProperty[] = [
  "width",
  "height",
  "color",
  "opacity",
  "rotation",
  "borderRadius",
  "blur",
];

export function serializeShapeKeyframes(kf: ShapeKeyframes): ShapeKeyframes | undefined {
  const o: ShapeKeyframes = {};
  if (Array.isArray(kf.position) && kf.position.length > 0) {
    o.position = kf.position.map(serializePositionKf);
  }
  for (const key of SHAPE_FLAT_TRACKS) {
    const track = kf[key] as Keyframe<unknown>[] | undefined;
    if (Array.isArray(track) && track.length > 0) {
      (o[key] as unknown) = track.map(serializeScalarKf);
    }
  }
  return Object.keys(o).length > 0 ? o : undefined;
}

export function serializeShape(s: Shape): Shape {
  const o = {} as Shape;
  o.id = s.id;
  o.shape = s.shape;
  o.start = s.start;
  o.end = s.end;
  o.x = s.x;
  o.y = s.y;
  o.width = s.width;
  o.height = s.height;
  o.color = s.color;
  if (s.borderRadius !== undefined && s.borderRadius !== null) o.borderRadius = s.borderRadius;
  if (s.stroke !== undefined && s.stroke !== null) {
    o.stroke = { color: s.stroke.color, width: s.stroke.width };
  }
  if (s.opacity !== undefined && s.opacity !== null) o.opacity = s.opacity;
  if (s.rotation !== undefined && s.rotation !== null) o.rotation = s.rotation;
  if (s.keyframes) {
    const kf = serializeShapeKeyframes(s.keyframes);
    if (kf) o.keyframes = kf;
  }
  return o;
}

// Overlay (CONTRACT §4 — a foreground ImageClip-shaped image, authored on a v2
// scene; migration lands it on its own image track). Keys in type order; optional
// fields present-only so a minimal overlay round-trips deep-equal. Reuses the SAME
// keyframe serialization as shapes (it animates like an ImageClip).
export function serializeOverlay(ov: Overlay): Overlay {
  const o = {} as Overlay;
  o.src = ov.src;
  o.start = ov.start;
  o.end = ov.end;
  o.x = ov.x;
  o.y = ov.y;
  o.width = ov.width;
  o.height = ov.height;
  if (ov.fit !== undefined && ov.fit !== null) o.fit = ov.fit;
  if (ov.borderRadius !== undefined && ov.borderRadius !== null) o.borderRadius = ov.borderRadius;
  if (ov.opacity !== undefined && ov.opacity !== null) o.opacity = ov.opacity;
  if (ov.rotation !== undefined && ov.rotation !== null) o.rotation = ov.rotation;
  if (ov.keyframes) {
    const kf = serializeShapeKeyframes(ov.keyframes);
    if (kf) o.keyframes = kf;
  }
  return o;
}

// AudioTrack with CONTRACT key order; optional fields only when present.
export function serializeAudio(a: Timeline["audio"]): Timeline["audio"] {
  if (a == null) return null;
  // Legacy bare string path stays a string (round-trips unchanged).
  if (typeof a === "string") return a as unknown as AudioTrack;
  const o: AudioTrack = { src: a.src, volume: a.volume };
  if (a.fadeInFrames !== undefined && a.fadeInFrames !== null) o.fadeInFrames = a.fadeInFrames;
  if (a.fadeOutFrames !== undefined && a.fadeOutFrames !== null) o.fadeOutFrames = a.fadeOutFrames;
  if (a.ducking !== undefined && a.ducking !== null) {
    o.ducking = {
      enabled: a.ducking.enabled,
      duckedVolume: a.ducking.duckedVolume,
      attackFrames: a.ducking.attackFrames,
      releaseFrames: a.ducking.releaseFrames,
    };
  }
  return o;
}

// CONTRACT §4.1 key order; optional fields only when present.
export function serializeTransition(t: SceneTransition): SceneTransition {
  const o = {} as SceneTransition;
  o.type = t.type;
  o.durationInFrames = t.durationInFrames;
  if (t.direction !== undefined && t.direction !== null) o.direction = t.direction;
  if (t.timing !== undefined && t.timing !== null) o.timing = t.timing;
  return o;
}

export function serializeScene(s: Scene): Scene {
  // CONTRACT key order: id, durationInFrames, background, shapes?, words, overlays?, transitionToNext?
  const o = {} as Scene;
  o.id = s.id;
  o.durationInFrames = s.durationInFrames;
  // Default to a black color fill if a scene somehow lacks a background
  // (un-migrated input) — serialize never emits the legacy `video` field.
  o.background = serializeBackground(s.background ?? { type: "color", color: "#000000" });
  // shapes emitted ONLY when present (default [] stays absent) so a shapeless
  // scene round-trips deep-equal.
  if (Array.isArray(s.shapes) && s.shapes.length > 0) {
    o.shapes = s.shapes.map(serializeShape);
  }
  o.words = (s.words || []).map(serializeWord);
  // overlays emitted ONLY when present (default [] stays absent) so an overlay-less
  // scene round-trips deep-equal (pixel-gate safe).
  if (Array.isArray(s.overlays) && s.overlays.length > 0) {
    o.overlays = s.overlays.map(serializeOverlay);
  }
  if (s.transitionToNext !== undefined && s.transitionToNext !== null) {
    o.transitionToNext = serializeTransition(s.transitionToNext);
  }
  return o;
}

export function serializeTimeline(t: Timeline): Timeline {
  return {
    fps: t.fps,
    width: t.width,
    height: t.height,
    audio: serializeAudio(t.audio),
    scenes: (t.scenes || []).map(serializeScene),
  };
}

// Minimal structural validation on import. Returns array of error strings
// (empty = valid). We never coerce or rewrite anything.
export function validateTimeline(t: unknown): string[] {
  const errs: string[] = [];
  if (!t || typeof t !== "object" || Array.isArray(t)) {
    errs.push("root is not a Timeline object");
    return errs;
  }
  const o = t as Record<string, unknown>;
  for (const k of ["fps", "width", "height"]) {
    if (typeof o[k] !== "number") errs.push(k + " must be a number");
  }
  // background is LENIENT (v2.2): the new model has NO top-level background (each
  // scene carries its own). A legacy top-level `background` (hex string) is still
  // accepted — migration converts it on import. If present, it must be a string.
  if ("background" in o && typeof o.background !== "string") {
    errs.push("background, if present (legacy), must be a string");
  }
  if (!("audio" in o)) errs.push("audio field missing (use null)");
  if (!Array.isArray(o.scenes)) {
    errs.push("scenes must be an array");
    return errs;
  }
  (o.scenes as unknown[]).forEach((sUnknown, i) => {
    const s = sUnknown as Record<string, unknown>;
    if (typeof s.id !== "string") errs.push(`scenes[${i}].id must be a string`);
    if (typeof s.durationInFrames !== "number")
      errs.push(`scenes[${i}].durationInFrames must be a number`);
    if (!Array.isArray(s.words)) errs.push(`scenes[${i}].words must be an array`);
    ((s.words as unknown[]) || []).forEach((wUnknown, j) => {
      const w = wUnknown as Record<string, unknown>;
      for (const k of ["start", "end", "x", "y", "size", "weight"]) {
        if (typeof w[k] !== "number")
          errs.push(`scenes[${i}].words[${j}].${k} must be a number`);
      }
      if (typeof w.text !== "string")
        errs.push(`scenes[${i}].words[${j}].text must be a string`);
    });
  });
  return errs;
}

// Deep clone via JSON — timelines are pure JSON, so this is exact and decouples
// the in-memory master from the parsed input object.
export function cloneTimeline(t: Timeline): Timeline {
  return JSON.parse(JSON.stringify(t));
}

// Wrap a Timeline as render-ready props for `npx remotion render Reels --props`.
export function toRenderProps(t: Timeline): { showGrid: boolean; timeline: Timeline } {
  return { showGrid: false, timeline: serializeTimeline(t) };
}

// ===== v3 (tracks) import/export ===========================================
// The editor authors v3. On import we accept a legacy v2 (scenes) file — migrated
// to v3 — OR a v3 (tracks) file directly. On export we emit the v3 track schema with
// the migration-only `_scene` tags stripped (they are NOT part of the CONTRACT).

import type { TimelineV3 } from "@engine/types.v3";
import { isV3 } from "@engine/types.v3";
import { migrateV2toV3 } from "@engine/migrateV3";
import { stripSceneTags } from "./v3util";

/** Light structural validation for a v3 timeline. */
export function validateTimelineV3(t: unknown): string[] {
  const errs: string[] = [];
  if (!t || typeof t !== "object" || Array.isArray(t)) return ["root is not a Timeline object"];
  const o = t as Record<string, unknown>;
  for (const k of ["fps", "width", "height"]) if (typeof o[k] !== "number") errs.push(`${k} must be a number`);
  if (!Array.isArray(o.tracks)) errs.push("tracks must be an array");
  return errs;
}

/** Parse → v3. Migrates a legacy v2 (scenes) file; passes a v3 (tracks) file
 *  through. Returns { errs } on failure, else { timeline }. */
export function importToV3(parsed: unknown): { errs: string[]; timeline?: TimelineV3 } {
  if (isV3(parsed)) {
    const errs = validateTimelineV3(parsed);
    return errs.length ? { errs } : { errs: [], timeline: parsed as TimelineV3 };
  }
  const errs = validateTimeline(parsed);
  if (errs.length) return { errs };
  return { errs: [], timeline: migrateV2toV3(parsed as Timeline) };
}

/** On-disk v3 form: deep clone with `_scene` tags stripped. */
export function serializeTimelineV3(t: TimelineV3): TimelineV3 {
  return stripSceneTags(t);
}

export function toRenderPropsV3(t: TimelineV3): { showGrid: boolean; timeline: TimelineV3 } {
  return { showGrid: false, timeline: serializeTimelineV3(t) };
}
