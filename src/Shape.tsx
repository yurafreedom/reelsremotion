import React from "react";
import { useCurrentFrame } from "remotion";
import type { Shape as ShapeType } from "./types";
import {
  hasTrack,
  sampleColor,
  samplePosition,
  sampleScalar,
} from "./keyframes";

// Shape foreground layer (CONTRACT §4) — rendered BELOW words, ABOVE the
// background. Same coordinate system (§2: x,y = px offset of CENTER from frame
// center) and the SAME keyframe engine as words (keyframes.ts), so a shape and a
// word animate through one identical code path. No new sampling math here.
//
// Frame convention (CONTRACT §3): useCurrentFrame() is SCENE-relative inside the
// scene <Sequence>; keyframe frames are ELEMENT-relative → sample at
// `rel = sceneFrame - shape.start`.

// `offset` rebases the local <Sequence> frame to the ABSOLUTE timeline frame
// (CONTRACT v3: shape.start/end are absolute). v3 SegmentLayer passes the
// segment's absolute start; legacy callers pass nothing (0). `rel` is identical
// either way.
export const Shape: React.FC<{ shape: ShapeType; offset?: number }> = ({ shape, offset = 0 }) => {
  const abs = useCurrentFrame() + offset;

  // Hard appearance/disappearance window — render nothing outside [start, end).
  if (abs < shape.start || abs >= shape.end) return null;

  const kf = shape.keyframes;
  const rel = abs - shape.start;

  const pos = hasTrack(kf?.position)
    ? samplePosition(kf!.position!, rel)
    : { x: shape.x, y: shape.y };
  const width = hasTrack(kf?.width) ? sampleScalar(kf!.width!, rel) : shape.width;
  const height = hasTrack(kf?.height) ? sampleScalar(kf!.height!, rel) : shape.height;
  const color = hasTrack(kf?.color) ? sampleColor(kf!.color!, rel) : shape.color;
  const opacity = hasTrack(kf?.opacity) ? sampleScalar(kf!.opacity!, rel) : shape.opacity ?? 1;
  const rotation = hasTrack(kf?.rotation) ? sampleScalar(kf!.rotation!, rel) : shape.rotation ?? 0;
  const borderRadius = hasTrack(kf?.borderRadius)
    ? sampleScalar(kf!.borderRadius!, rel)
    : shape.borderRadius ?? 0;
  const blur = hasTrack(kf?.blur) ? sampleScalar(kf!.blur!, rel) : 0;

  return (
    <ShapeBox
      type={shape.shape}
      x={pos.x}
      y={pos.y}
      width={width}
      height={height}
      color={color}
      opacity={opacity}
      rotation={rotation}
      borderRadius={borderRadius}
      blur={blur}
      stroke={shape.stroke}
    />
  );
};

// The single styled element; identical whether driven by static fields or samples.
const ShapeBox: React.FC<{
  type: ShapeType["shape"];
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  rotation: number;
  borderRadius: number;
  blur: number;
  stroke?: { color: string; width: number };
}> = ({ type, x, y, width, height, color, opacity, rotation, borderRadius, blur, stroke }) => {
  // `line`: a thin rect (width = length, height = thickness); fill = stroke color.
  const radius = type === "ellipse" ? "50%" : type === "line" ? height / 2 : borderRadius;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg)`,
        backgroundColor: color,
        borderRadius: radius,
        opacity,
        border: stroke ? `${stroke.width}px solid ${stroke.color}` : undefined,
        boxSizing: "border-box",
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        willChange: "transform, opacity, filter",
      }}
    />
  );
};
