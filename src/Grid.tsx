import React from "react";
import { getRemotionEnvironment, useVideoConfig } from "remotion";

// Dev-aid coordinate grid. Helps aim word/inset (x,y) offsets in Studio and
// NEVER appears in the final mp4.
//
// Hidden if rendering (primary guard) OR if showGrid is false (manual toggle).
// Lines: minor every 50px, major every 100px. Center cross at (540,960).
// Axis labels every 200px show the OFFSET FROM CENTER (e.g. -200, +200).
export const Grid: React.FC<{ showGrid: boolean }> = ({ showGrid }) => {
  // Hook first (rules of hooks), then guard.
  const { width, height } = useVideoConfig();

  // Primary guard: no grid in renders, even if showGrid is true.
  if (getRemotionEnvironment().isRendering) return null;
  if (!showGrid) return null;

  const cx = width / 2;
  const cy = height / 2;

  // Build offset-from-center labels every 200px along each axis.
  const STEP = 200;
  const xLabels: { px: number; offset: number }[] = [];
  for (let px = 0; px <= width; px += STEP) {
    xLabels.push({ px, offset: px - cx });
  }
  const yLabels: { px: number; offset: number }[] = [];
  for (let px = 0; px <= height; px += STEP) {
    yLabels.push({ px, offset: px - cy });
  }

  const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const labelStyle: React.CSSProperties = {
    position: "absolute",
    fontFamily: "monospace",
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
        // Minor (50px) + major (100px) lines via layered gradients.
        backgroundImage: [
          // minor verticals
          "repeating-linear-gradient(to right, rgba(255,255,255,0.06) 0 1px, transparent 1px 50px)",
          // minor horizontals
          "repeating-linear-gradient(to bottom, rgba(255,255,255,0.06) 0 1px, transparent 1px 50px)",
          // major verticals
          "repeating-linear-gradient(to right, rgba(255,255,255,0.14) 0 1px, transparent 1px 100px)",
          // major horizontals
          "repeating-linear-gradient(to bottom, rgba(255,255,255,0.14) 0 1px, transparent 1px 100px)",
        ].join(", "),
      }}
    >
      {/* Center cross at (540, 960). */}
      <div
        style={{
          position: "absolute",
          left: cx,
          top: 0,
          width: 1,
          height: "100%",
          backgroundColor: "rgba(255,0,0,0.4)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: cy,
          left: 0,
          height: 1,
          width: "100%",
          backgroundColor: "rgba(255,0,0,0.4)",
        }}
      />

      {/* Axis labels (offset from center) every 200px. */}
      {xLabels.map(({ px, offset }) => (
        <span
          key={`x${px}`}
          style={{ ...labelStyle, left: px + 3, top: cy + 3 }}
        >
          {fmt(offset)}
        </span>
      ))}
      {yLabels.map(({ px, offset }) => (
        <span
          key={`y${px}`}
          style={{ ...labelStyle, top: px + 3, left: cx + 3 }}
        >
          {fmt(offset)}
        </span>
      ))}
    </div>
  );
};
