import type { Timeline } from "@engine/types";
import type { ImageTrack, AudioTrackV3, TimelineV3 } from "@engine/types.v3";
import { migrateV2toV3 } from "@engine/migrateV3";
import { stripSceneTags } from "./v3util";

// Default editor document (v2.2 content, expressed in the v3 track model): scene 1
// was a video BOX over a fill with a rounded-plate shape behind its text; scene 2 a
// solid COLOR background, with a fade between them. We author it as v2 and migrate
// to v3 so the default exercises tracks, the box→VideoClip(contain) path, the shape
// track, words on a text track, and a per-clip transition — all on the absolute axis.
const V2_DEFAULT: Timeline = {
  fps: 30,
  width: 1080,
  height: 1920,
  audio: null,
  scenes: [
    {
      id: "s1",
      durationInFrames: 60,
      background: {
        type: "box",
        src: "placeholder",
        x: 0,
        y: -120,
        width: 880,
        height: 500,
        borderRadius: 20,
        backColor: "#1a1a1a",
        speechRegions: [{ startFrame: 4, endFrame: 56 }],
      },
      shapes: [
        {
          id: "plate1",
          shape: "rect",
          start: 0,
          end: 60,
          x: -120,
          y: 320,
          width: 360,
          height: 110,
          color: "#c0182a",
          borderRadius: 16,
          opacity: 0.9,
        },
      ],
      words: [
        { text: "СЦЕНА", start: 4, end: 60, x: -120, y: 320, font: "condensedHeavy", size: 90, weight: 800, color: "#ffffff", enterFrom: "left", case: "upper" },
        { text: "один", start: 14, end: 60, x: 120, y: 420, font: "cleanSans", size: 54, weight: 400, color: "#c0182a", enterFrom: "right" },
      ],
      transitionToNext: { type: "fade", durationInFrames: 20, timing: "linear" },
    },
    {
      id: "s2",
      durationInFrames: 60,
      background: { type: "color", color: "#0a0a0c" },
      words: [
        { text: "СЦЕНА", start: 4, end: 60, x: 120, y: -380, font: "condensedHeavy", size: 90, weight: 800, color: "#ffffff", enterFrom: "right", case: "upper" },
        { text: "два", start: 14, end: 60, x: -150, y: -280, font: "cleanSans", size: 54, weight: 400, color: "#c0182a", enterFrom: "left" },
      ],
    },
  ],
};

// Build the v3 default once: migrate, strip the migration-only `_scene` tags (this
// is authored content, not a round-tripped legacy file), and add one empty image
// and one empty audio track so the "default tracks" (video/text/image/audio) are
// all present and the "+" cap/feel matches CONTRACT v3.
const buildDefault = (): TimelineV3 => {
  const v3 = stripSceneTags(migrateV2toV3(V2_DEFAULT));
  const ids = new Set(v3.tracks.map((t) => t.id));
  const imgTrack: ImageTrack = { id: ids.has("image") ? "image-1" : "image", kind: "image", clips: [] };
  const audTrack: AudioTrackV3 = { id: ids.has("audio") ? "audio-1" : "audio", kind: "audio", clips: [] };
  // Insert image just above the video track; append audio last.
  const vi = v3.tracks.findIndex((t) => t.kind === "video");
  v3.tracks.splice(vi >= 0 ? vi + 1 : 0, 0, imgTrack);
  v3.tracks.push(audTrack);
  return v3;
};

export const DEFAULT_TIMELINE: TimelineV3 = buildDefault();
