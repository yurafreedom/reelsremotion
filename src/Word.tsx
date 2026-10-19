import React from "react";
import { useCurrentFrame } from "remotion";
import type { Word as WordType, TextCase } from "./types";
import { resolveFont, resolveFontStyle } from "./fonts";
import {
  hasTrack,
  sampleColor,
  sampleDiscrete,
  samplePosition,
  sampleScalar,
} from "./keyframes";
import { cumulativeWordOpacity } from "./cumulativeWordReveal";

// Keyframes are the ONLY animation system (CONTRACT §4). There is NO built-in
// entrance/exit here: a word with no `keyframes` hard-appears at `start`, holds
// its static fields, and hard-disappears at `end`. All motion — slide-ins, fades,
// kinetic moves — is authored as keyframes (the editor's presets generate them).
//
// Frame convention (CONTRACT §3): inside a Scene's <Sequence>, useCurrentFrame()
// is SCENE-RELATIVE. Keyframe frames are WORD-RELATIVE, so we sample each track at
// `rel = sceneFrame - word.start`.

const applyCase = (text: string, c?: TextCase): string => {
  if (c === "upper") return text.toUpperCase();
  if (c === "lower") return text.toLowerCase();
  return text;
};

// `offset` rebases the local <Sequence> frame to the ABSOLUTE timeline frame
// (CONTRACT v3: word.start/end are absolute). The v3 SegmentLayer passes the
// segment's absolute start; legacy scene-relative callers pass nothing (0), so
// `rel = abs - word.start` is bit-identical to the v2 computation either way.
export const Word: React.FC<{ word: WordType; offset?: number }> = ({ word, offset = 0 }) => {
  const abs = useCurrentFrame() + offset;

  // Hard appearance/disappearance window — render nothing outside [start, end).
  if (abs < word.start || abs >= word.end) {
    return null;
  }

  const kf = word.keyframes;
  const rel = abs - word.start; // element-relative sampling frame

  const revealTokens = word.revealMode === "cumulative-word" && word.wordReveals?.length
    ? word.wordReveals.map((token) => ({
        text: applyCase(token.text, word.case),
        opacity: cumulativeWordOpacity(abs, token.revealFrame, word.revealFadeFrames ?? 3),
      }))
    : undefined;

  // Fast path: a fully static word skips all sampling (identical to the pre-
  // keyframe engine — proves "static unchanged").
  if (!kf) {
    return (
      <Glyph
        x={word.x}
        y={word.y}
        size={word.size}
        weight={word.weight}
        font={resolveFont(word.font)}
        fontStyle={resolveFontStyle(word.font)}
        letterSpacing={0}
        color={word.color}
        opacity={1}
        rotation={0}
        blur={0}
        clipReveal={1}
        stroke={word.stroke}
        shadow={word.shadow}
        text={applyCase(word.text, word.case)}
        revealTokens={revealTokens}
      />
    );
  }

  // Per-property: sampled track if present (non-empty), else the static fallback.
  const pos = hasTrack(kf.position) ? samplePosition(kf.position, rel) : { x: word.x, y: word.y };
  const size = hasTrack(kf.size) ? sampleScalar(kf.size, rel) : word.size;
  const weight = hasTrack(kf.weight) ? sampleScalar(kf.weight, rel) : word.weight;
  const fontKey = hasTrack(kf.fontFamily) ? sampleDiscrete(kf.fontFamily, rel) : word.font;
  const letterSpacing = hasTrack(kf.letterSpacing) ? sampleScalar(kf.letterSpacing, rel) : 0;
  const color = hasTrack(kf.color) ? sampleColor(kf.color, rel) : word.color;
  const opacity = hasTrack(kf.opacity) ? sampleScalar(kf.opacity, rel) : 1;
  const rotation = hasTrack(kf.rotation) ? sampleScalar(kf.rotation, rel) : 0;
  const blur = hasTrack(kf.blur) ? sampleScalar(kf.blur, rel) : 0;
  // Typewriter (CONTRACT §4 exception): left→right clip-reveal. 1 = fully shown.
  const clipReveal = hasTrack(kf.clipReveal) ? sampleScalar(kf.clipReveal, rel) : 1;

  return (
    <Glyph
      x={pos.x}
      y={pos.y}
      size={size}
      weight={weight}
      font={resolveFont(fontKey)}
      fontStyle={resolveFontStyle(fontKey)}
      letterSpacing={letterSpacing}
      color={color}
      opacity={opacity}
      rotation={rotation}
      blur={blur}
      clipReveal={clipReveal}
      stroke={word.stroke}
      shadow={word.shadow}
      text={applyCase(word.text, word.case)}
      revealTokens={revealTokens}
    />
  );
};

// The single styled element; identical whether driven by static fields or samples.
const Glyph: React.FC<{
  x: number;
  y: number;
  size: number;
  weight: number;
  font: string;
  /** CSS font-style — "italic" binds the real italic face (e.g. Playfair). */
  fontStyle: "normal" | "italic";
  letterSpacing: number;
  color: string;
  opacity: number;
  rotation: number;
  blur: number;
  /** Typewriter clip-reveal fraction 0..1 (1 = fully shown). */
  clipReveal: number;
  /** Outline stroke + layered text-shadow. Static only. */
  stroke?: { color: string; width: number };
  shadow?: Array<{ x?: number; y?: number; blur: number; color: string }>;
  text: string;
  revealTokens?: Array<{ text: string; opacity: number }>;
}> = ({ x, y, size, weight, font, fontStyle, letterSpacing, color, opacity, rotation, blur, clipReveal, stroke, shadow, text, revealTokens }) => {
  // Left→right reveal: clip away the right (1-clipReveal) of the text box. A small
  // epsilon avoids a 1px sub-pixel sliver at the leading edge. clipReveal>=1 → no
  // clip-path at all (identical to the pre-typewriter render).
  const cr = Math.max(0, Math.min(1, clipReveal));
  const clipPath = cr >= 1 ? undefined : `inset(-20% ${(1 - cr) * 100}% -20% -5%)`;
  const textShadow = shadow && shadow.length
    ? shadow.map((s) => `${s.x ?? 0}px ${s.y ?? 0}px ${s.blur}px ${s.color}`).join(", ")
    : undefined;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg)`,
        opacity,
        fontFamily: font,
        fontStyle,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: `${letterSpacing}px`,
        color,
        // Outline ring painted UNDER the fill so a thick white stroke never eats
        // into the (burgundy) fill. Absent → no stroke props at all.
        WebkitTextStroke: stroke ? `${stroke.width}px ${stroke.color}` : undefined,
        paintOrder: stroke ? "stroke fill" : undefined,
        textShadow,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        clipPath,
        whiteSpace: "nowrap",
        textAlign: "center",
        lineHeight: 1.1,
        willChange: "transform, opacity, filter",
      }}
    >
      {revealTokens
        ? revealTokens.map((token, index) => (
            <React.Fragment key={`${index}-${token.text}`}>
              <span style={{ opacity: token.opacity }}>{token.text}</span>
              {index < revealTokens.length - 1 ? " " : null}
            </React.Fragment>
          ))
        : text}
    </div>
  );
};
