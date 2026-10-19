import React, { useCallback, useEffect, useRef, useState } from "react";
import type { TimelineV3 as Timeline } from "@engine/types.v3";
import {
  downloadUrl,
  pollRender,
  startRender,
  type ExportFps,
  type ExportQuality,
  type RenderProgress,
} from "./exportClient";

// Export → mp4 modal (v2.5). Options: fps (30/60), quality (High/Medium → CRF),
// filename. Resolution is FIXED 1080×1920 (the whole engine is built on it,
// CONTRACT §1) — shown, not editable. Start → progress bar → Download link.
//
// fps note (shown in the UI): 60 fps renders the SAME animation, only smoother —
// timings are re-timed server-side so playback speed is identical to 30 fps.

const POLL_MS = 400;

type UiState = "idle" | "running" | "done" | "error";

export const ExportPanel: React.FC<{
  timeline: Timeline;
  onClose: () => void;
}> = ({ timeline, onClose }) => {
  const [fps, setFps] = useState<ExportFps>(30);
  const [quality, setQuality] = useState<ExportQuality>("high");
  const [name, setName] = useState("reel");
  const [ui, setUi] = useState<UiState>("idle");
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [error, setError] = useState<string>("");
  const [outName, setOutName] = useState<string>("");
  const pollTimer = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollTimer.current !== null) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  };
  useEffect(() => stopPolling, []);

  const loop = useCallback((id: string) => {
    const tick = async () => {
      try {
        const p = await pollRender(id);
        setProgress(p);
        if (p.status === "done") {
          setOutName(p.outName);
          setUi("done");
          return;
        }
        if (p.status === "error") {
          setError(p.error || "render failed");
          setUi("error");
          return;
        }
        pollTimer.current = window.setTimeout(tick, POLL_MS);
      } catch (err) {
        setError((err as Error).message);
        setUi("error");
      }
    };
    void tick();
  }, []);

  const onStart = useCallback(async () => {
    setUi("running");
    setError("");
    setProgress(null);
    setOutName("");
    try {
      const { id } = await startRender(timeline, { fps, quality, outName: name });
      loop(id);
    } catch (err) {
      setError((err as Error).message);
      setUi("error");
    }
  }, [timeline, fps, quality, name, loop]);

  const reset = () => {
    stopPolling();
    setUi("idle");
    setProgress(null);
    setError("");
  };

  const busy = ui === "running";
  const percent = progress?.percent ?? 0;
  const phaseLabel =
    progress?.status === "bundling"
      ? "Bundling…"
      : progress?.status === "rendering"
        ? `Rendering ${progress.renderedFrames}/${progress.totalFrames} frames`
        : "Starting…";

  return (
    <div className="export-overlay" onClick={busy ? undefined : onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-head">
          <span className="export-title">Export → MP4</span>
          <button className="export-x" onClick={onClose} disabled={busy} title="Close">
            ✕
          </button>
        </div>

        <div className="export-row">
          <label>Resolution</label>
          <span className="export-fixed">1080 × 1920 (fixed)</span>
        </div>

        <div className="export-row">
          <label>FPS</label>
          <div className="export-seg">
            {([30, 60] as ExportFps[]).map((f) => (
              <button
                key={f}
                className={fps === f ? "on" : ""}
                onClick={() => setFps(f)}
                disabled={busy}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="export-row">
          <label>Quality</label>
          <div className="export-seg">
            {(["high", "medium"] as ExportQuality[]).map((q) => (
              <button
                key={q}
                className={quality === q ? "on" : ""}
                onClick={() => setQuality(q)}
                disabled={busy}
              >
                {q === "high" ? "High (CRF 18)" : "Medium (CRF 23)"}
              </button>
            ))}
          </div>
        </div>

        <div className="export-row">
          <label>Filename</label>
          <div className="export-name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              spellCheck={false}
            />
            <span className="export-ext">.mp4</span>
          </div>
        </div>

        <p className="export-note">
          60 fps renders the <strong>same animation</strong>, only smoother — speed
          is identical to 30 fps. Renders the current timeline (showGrid off) via
          the same path as the CLI, into <code>out/</code>.
        </p>

        {(ui === "running" || ui === "done") && (
          <div className="export-progress">
            <div className="export-bar">
              <div
                className="export-fill"
                style={{ width: `${ui === "done" ? 100 : percent}%` }}
              />
            </div>
            <div className="export-prog-label">
              {ui === "done" ? "Done — 100%" : `${phaseLabel} · ${percent}%`}
            </div>
          </div>
        )}

        {ui === "error" && <div className="export-error">Render failed: {error}</div>}

        <div className="export-actions">
          {ui === "done" ? (
            <>
              <a className="export-download" href={downloadUrl(outName)} download={outName}>
                ⬇ Download {outName}
              </a>
              <button onClick={reset}>Export again</button>
            </>
          ) : ui === "error" ? (
            <button onClick={reset}>Try again</button>
          ) : (
            <button className="export-go" onClick={onStart} disabled={busy}>
              {busy ? "Rendering…" : "Start export"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
