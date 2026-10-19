import React, { useRef, useState } from "react";
import type { TimelineV3 } from "@engine/types.v3";
import { importToV3, serializeTimelineV3, toRenderPropsV3 } from "./io";
import { durationV3 } from "./v3util";
import { ExportPanel } from "./ExportPanel";

const downloadJson = (obj: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Import / Export / Save / Render-helper for the v3 (tracks) model. Import accepts
// a legacy v2 (scenes) file — migrated to v3 — or a v3 file directly. Export emits
// the v3 track schema; the render helper emits props.json for `npx remotion render`.
export const IoBar: React.FC<{
  timeline: TimelineV3;
  onImport: (tl: TimelineV3) => void;
}> = ({ timeline, onImport }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [showExport, setShowExport] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const { errs, timeline: tl } = importToV3(parsed);
      if (errs.length || !tl) {
        setStatus(`Invalid: ${errs.slice(0, 2).join("; ")}`);
        return;
      }
      onImport(tl);
      setStatus(`Imported ${file.name} (${tl.tracks.length} tracks, ${durationV3(tl)}f)`);
    } catch (err) {
      setStatus(`Parse error: ${(err as Error).message}`);
    }
  };

  return (
    <div className="io-bar">
      <button onClick={() => fileRef.current?.click()}>Import JSON…</button>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} style={{ display: "none" }} />
      <button onClick={() => downloadJson(serializeTimelineV3(timeline), "timeline.json")} title="Export the v3 track timeline">
        Export timeline.json
      </button>
      <button onClick={() => downloadJson(toRenderPropsV3(timeline), "props.json")} title="Render helper: { showGrid:false, timeline } for npx remotion render">
        Save props.json (render)
      </button>
      <button className="export-btn" onClick={() => setShowExport(true)} title="Render the current reel to out/<name>.mp4 (no terminal)">
        Export → MP4
      </button>
      <span className="status">{status}</span>
      {showExport && <ExportPanel timeline={timeline} onClose={() => setShowExport(false)} />}
    </div>
  );
};
