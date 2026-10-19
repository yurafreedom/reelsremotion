// Shared keyframe metadata + value helpers for the editor's keyframe UI.
// Drives the property lanes, the panel auto-keyframe inputs, and the graph/path
// editors. Sampling reuses the SAME engine functions as the renderer, so the
// lane/curve previews match the Player exactly.

import type {
  FontKey,
  KeyframeProperty,
  Vec2,
  Word,
  WordKeyframes,
} from "@engine/types";
import {
  hasTrack,
  sampleColor,
  sampleDiscrete,
  samplePosition,
  sampleScalar,
} from "@engine/keyframes";

export type PropKind = "scalar" | "color" | "discrete" | "position";

export type PropMeta = {
  key: KeyframeProperty;
  label: string;
  kind: PropKind;
  unit?: string;
  /** Static fallback value for a word (used to seed a new track). */
  fallback: (w: Word) => number | string | Vec2;
  /** Display range for the graph editor's value axis (scalar/color ignored). */
  range?: [number, number];
  /** Step for numeric inputs. */
  step?: number;
};

// The 9 animatable properties, in panel/lane order (position first).
export const PROPERTIES: PropMeta[] = [
  { key: "position", label: "Position", kind: "position", unit: "px", fallback: (w) => ({ x: w.x, y: w.y }) },
  { key: "size", label: "Size", kind: "scalar", unit: "px", fallback: (w) => w.size, range: [0, 400], step: 1 },
  { key: "weight", label: "Weight", kind: "scalar", fallback: (w) => w.weight, range: [100, 900], step: 10 },
  { key: "fontFamily", label: "Font", kind: "discrete", fallback: (w) => w.font },
  { key: "letterSpacing", label: "Letter-sp", kind: "scalar", unit: "px", fallback: () => 0, range: [-20, 80], step: 1 },
  { key: "color", label: "Color", kind: "color", fallback: (w) => w.color },
  { key: "opacity", label: "Opacity", kind: "scalar", fallback: () => 1, range: [0, 1], step: 0.01 },
  { key: "rotation", label: "Rotation", kind: "scalar", unit: "°", fallback: () => 0, range: [-360, 720], step: 1 },
  { key: "blur", label: "Blur", kind: "scalar", unit: "px", fallback: () => 0, range: [0, 60], step: 0.5 },
  // Typewriter clip-reveal (v2.6). Fraction revealed L→R; fallback 1 (fully shown).
  { key: "clipReveal", label: "Typewriter", kind: "scalar", fallback: () => 1, range: [0, 1], step: 0.01 },
];

export const propMeta = (key: KeyframeProperty): PropMeta =>
  PROPERTIES.find((p) => p.key === key)!;

/** A track's keyframes (untyped frames+values) for generic lane rendering. */
export type AnyKey = { frame: number; value: unknown; easing?: unknown };

export const trackOf = (w: Word, key: KeyframeProperty): AnyKey[] | undefined =>
  w.keyframes?.[key] as AnyKey[] | undefined;

/** Sample a property's CURRENT value at a word-relative frame (or static fallback).
 *  Used by "+ keyframe" / auto-keyframe to seed from what's on screen. */
export const currentValue = (
  w: Word,
  key: KeyframeProperty,
  rel: number
): number | string | Vec2 => {
  const kf = w.keyframes;
  switch (key) {
    case "position":
      return hasTrack(kf?.position) ? samplePosition(kf!.position!, rel) : { x: w.x, y: w.y };
    case "color":
      return hasTrack(kf?.color) ? sampleColor(kf!.color!, rel) : w.color;
    case "fontFamily":
      return hasTrack(kf?.fontFamily) ? sampleDiscrete(kf!.fontFamily!, rel) : w.font;
    default: {
      const track = kf?.[key] as { frame: number; value: number }[] | undefined;
      if (hasTrack(track)) return sampleScalar(track, rel);
      return propMeta(key).fallback(w) as number;
    }
  }
};

/** Format a keyframe value compactly for lane tooltips / readouts. */
export const formatValue = (key: KeyframeProperty, value: unknown): string => {
  const m = propMeta(key);
  if (m.kind === "position") {
    const v = value as Vec2;
    return `(${Math.round(v.x)}, ${Math.round(v.y)})`;
  }
  if (m.kind === "color") return String(value);
  if (m.kind === "discrete") return String(value);
  const n = value as number;
  const r = Math.abs(n) < 1 ? n.toFixed(2) : Math.round(n).toString();
  return m.unit ? `${r}${m.unit}` : r;
};

export const FONT_OPTIONS: FontKey[] = [
  "condensedHeavy",
  "cleanSans",
  "unbounded",
  "onest",
  "playfairItalic",
];

/** Human-readable labels for the font picker (keys stay the FontKey contract). */
export const FONT_LABELS: Record<FontKey, string> = {
  condensedHeavy: "Oswald (condensed heavy)",
  cleanSans: "Inter (clean sans)",
  unbounded: "Unbounded",
  onest: "Onest",
  playfairItalic: "Playfair Display italic",
};

/** Word-relative playhead frame for a given scene-relative editor frame. */
export const toWordFrame = (sceneRelFrame: number, wordStart: number): number =>
  Math.round(sceneRelFrame - wordStart);
