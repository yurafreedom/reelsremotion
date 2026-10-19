import React from "react";
import { AbsoluteFill } from "remotion";
import type { Scene as SceneType } from "./types";
import { Background } from "./Background";
import { Shape } from "./Shape";
import { Word } from "./Word";

// One scene composed in z-order (CONTRACT §4): background → shapes → words.
// Text is always on top; shapes sit above the background and below text. Frames
// inside here are scene-relative (the parent <Sequence> handles the offset).
export const Scene: React.FC<{ scene: SceneType }> = ({ scene }) => {
  return (
    <AbsoluteFill>
      <Background background={scene.background} />
      {(scene.shapes ?? []).map((shape) => (
        <Shape key={shape.id} shape={shape} />
      ))}
      {scene.words.map((word, i) => (
        <Word key={i} word={word} />
      ))}
    </AbsoluteFill>
  );
};
