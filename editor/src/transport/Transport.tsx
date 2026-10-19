import React from "react";
import type { PlayerRef } from "@remotion/player";

// Custom transport driving the <Player> via its ref API (the Player plays its
// own audio+video — we never build a separate player). frame/duration/fps come
// from the editor; seeks are clamped to [0, duration-1].
//
// Layout (v3.5): a VERTICAL column living in the empty space to the LEFT of the
// vertical preview. Readout on top, transport buttons stacked top-to-bottom, and a
// compact scrubber at the bottom. Moving this out of the horizontal bar above the
// tracks frees that height for the timeline.
export const Transport: React.FC<{
  playerRef: React.RefObject<PlayerRef | null>;
  frame: number;
  duration: number;
  fps: number;
  playing: boolean;
}> = ({ playerRef, frame, duration, fps, playing }) => {
  const seek = (f: number) => {
    const clamped = Math.max(0, Math.min(duration - 1, Math.round(f)));
    playerRef.current?.seekTo(clamped);
  };

  const fmtTime = (f: number) => {
    const totalSec = f / fps;
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    const cs = Math.round((totalSec - Math.floor(totalSec)) * 100);
    return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  };

  return (
    <div className="transport">
      {/* Readout (top of the column) */}
      <div className="readout-bar">
        <span className="r-frame">{frame} / {duration - 1}</span>
        <span className="r-time">{fmtTime(frame)}</span>
        <span className="r-fps">{fps} fps</span>
      </div>

      {/* Transport buttons, stacked top-to-bottom */}
      <div className="control-bar">
        <button onClick={() => seek(0)} title="Start (Home)">⏮ Start</button>
        <button onClick={() => seek(frame - fps)} title="-1s">−1s</button>
        <button onClick={() => seek(frame - 1)} title="-1 frame (←)">◀| frame</button>
        <button className="primary" onClick={() => playerRef.current?.toggle()} title="Play/Pause (Space)">
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <button onClick={() => seek(frame + 1)} title="+1 frame (→)">frame |▶</button>
        <button onClick={() => seek(frame + fps)} title="+1s">+1s</button>
        <button onClick={() => seek(duration - 1)} title="End">End ⏭</button>
      </div>

      {/* Compact scrubber (bottom of the column) */}
      <div className="scrub-bar">
        <input
          type="range"
          min={0}
          max={Math.max(0, duration - 1)}
          value={frame}
          onChange={(e) => seek(Number(e.target.value))}
          title="Scrub"
        />
      </div>
    </div>
  );
};
