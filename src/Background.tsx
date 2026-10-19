import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";
import type {
  Background as BackgroundType,
  BoxBackground,
  CoverBackground,
  ImageBackground,
} from "./types";
import { resolveFont } from "./fonts";

// Per-scene background layer (CONTRACT §4) — the BOTTOM of the z-order
// (background → shapes → words). Four discriminated variants:
//   color → solid fill
//   image → fills the frame (object-fit, default cover)
//   cover → fullscreen 1080×1920 video
//   box   → positioned/resizable video box over a solid `backColor` fill
//           (the old v2.1 inset render, reused verbatim)
//
// Rule (CONTRACT §6): for image/cover/box, `src === "placeholder"` draws a stub
// rectangle so the render never fails on a missing file.

export const Background: React.FC<{ background: BackgroundType }> = ({ background }) => {
  switch (background.type) {
    case "color":
      return <AbsoluteFill style={{ backgroundColor: background.color }} />;
    case "image":
      return <ImageLayer bg={background} />;
    case "cover":
      return <CoverLayer bg={background} />;
    case "box":
      return <BoxLayer bg={background} />;
    default:
      // Defensive: unknown background → black.
      return <AbsoluteFill style={{ backgroundColor: "#000000" }} />;
  }
};

const isPlaceholder = (src: string) => src === "placeholder";

// Exported so the v3 track renderer (Video.tsx `BgClip`) can reuse the EXACT v2
// background rendering for each clip kind — guaranteeing pixel-identity through
// the scenes→tracks migration (including the placeholder box hatch).
export const ImageLayer: React.FC<{ bg: ImageBackground }> = ({ bg }) => {
  if (isPlaceholder(bg.src)) return <PlaceholderFill label="IMAGE" />;
  return (
    <AbsoluteFill>
      <Img
        src={staticFile(bg.src)}
        style={{ width: "100%", height: "100%", objectFit: bg.fit ?? "cover" }}
      />
    </AbsoluteFill>
  );
};

export const CoverLayer: React.FC<{ bg: CoverBackground }> = ({ bg }) => {
  if (isPlaceholder(bg.src)) return <PlaceholderFill label="VIDEO COVER" />;
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={staticFile(bg.src)}
        startFrom={bg.startFrom ?? 0}
        muted={bg.muted ?? false}
        volume={bg.muted ? 0 : bg.volume ?? 1}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
};

// Box video over a solid fill — the old VideoInset render, now a background.
export const BoxLayer: React.FC<{ bg: BoxBackground }> = ({ bg }) => (
  <AbsoluteFill style={{ backgroundColor: bg.backColor }}>
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: bg.width,
        height: bg.height,
        transform: `translate(-50%, -50%) translate(${bg.x}px, ${bg.y}px)`,
        borderRadius: bg.borderRadius,
        overflow: "hidden",
      }}
    >
      {isPlaceholder(bg.src) ? (
        <BoxPlaceholder width={bg.width} height={bg.height} />
      ) : (
        <OffthreadVideo
          src={staticFile(bg.src)}
          startFrom={bg.startFrom ?? 0}
          muted={bg.muted ?? false}
          volume={bg.muted ? 0 : bg.volume ?? 1}
          style={{ width: "100%", height: "100%", objectFit: bg.fit ?? "cover" }}
        />
      )}
    </div>
  </AbsoluteFill>
);

// Fullscreen placeholder (image / cover) — hatched fill so a missing src reads as
// "no media here" yet the render still succeeds.
const PlaceholderFill: React.FC<{ label: string }> = ({ label }) => (
  <AbsoluteFill
    style={{
      backgroundColor: "#2b2b2b",
      backgroundImage:
        "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 16px, transparent 16px, transparent 32px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <span
      style={{
        fontFamily: resolveFont("cleanSans"),
        fontSize: 44,
        fontWeight: 600,
        letterSpacing: 3,
        color: "rgba(255,255,255,0.4)",
      }}
    >
      {label}
    </span>
  </AbsoluteFill>
);

const BoxPlaceholder: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      backgroundColor: "#2b2b2b",
      backgroundImage:
        "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 12px, transparent 12px, transparent 24px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      outline: "2px dashed rgba(255,255,255,0.25)",
      outlineOffset: "-12px",
    }}
  >
    <span
      style={{
        fontFamily: resolveFont("cleanSans"),
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: 2,
        color: "rgba(255,255,255,0.45)",
      }}
    >
      VIDEO {Math.round(width)}×{Math.round(height)}
    </span>
  </div>
);
