// build_reel2.ts — assemble the finished REEL 2 (final assembly).
//
//   node compose/run.mjs compose/build_reel2.ts [A|B] [collage|captions|full]
//
// Writes a SCRATCH timeline (public/timeline_reel2.json). Default variant B
// (Playfair italic accents), stage full. Reuses the SAME helpers as build_reel.ts
// / build_reel1.ts (setVideo / addImageOverlay / revealCaptionChunksTimed /
// staticCaption / setAudio / enableDucking / setTransition) — nothing rebuilt;
// only the REEL 2 constants (source, captions, music, durations, paths) differ.
//
// SOURCE REALITY (verified from a still, identical to REEL 1): the REEL 2 clip,
// public/media/reel2_source.mp4 (640×360, 25fps, 148.56s, WITH stereo audio — the
// _hq enhance pass wasn't run, so we use the base clip), is a CLEAN 16:9 interview
// frame — two people on a couch, with the same baked "Evgeniia Nikulina" label
// bottom-left. Already in narrative/audio order → no reorder; already 16:9 → BAND
// layout (footage plays as a centered 1080×608 band; Frame_1 fills the top band,
// Frame_2 the bottom band, extended UP to mask the baked label).
//
// RE-CUT (v2): REEL 2 is now two parts only — Evgenia's opening QUESTION → Safir's
// whole speech. Her EN+RU monologue is removed and every pause tightened. After the
// cut the surviving audio is all English, so the captions ride the v2 ASR/align
// (compose/chunks_timed_reel2_v2.json); styling here is language-agnostic.

import { readFileSync } from "node:fs";
import {
  createTimeline,
  addScene,
  setVideo,
  addImageOverlay,
  setAudio,
  enableDucking,
  setTransition,
  writeTimeline,
  revealCaptionChunksTimed,
  staticCaption,
  type CaptionChunkTimed,
  type CaptionStyle,
} from "./index";
import type { ChunkWord } from "./patterns";
import type { Scene, SpeechRegion, Shape } from "@engine/types";

const VARIANT = (process.argv[2] === "A" ? "A" : "B") as "A" | "B";
const STAGE = (process.argv[3] ?? "full") as "collage" | "captions" | "full";

const FPS = 30;
// REEL 2 source (v2, RE-CUT): reel2_source_v2.mp4 — Evgenia's opening QUESTION +
// Safir's whole speech only; her EN+RU monologue removed and every inter-phrase
// pause tightened (see compose/recut_reel2_v2.py). Video 67.60s, last v2 ASR word
// at 67.46s. Hold the interview to 67.6s (within the media, past the last caption).
const CLIP_SEC = 67.6;
const INTERVIEW_SEC = CLIP_SEC;
const INTERVIEW_FRAMES = Math.round(INTERVIEW_SEC * FPS); // 4446
const OUTRO_SEC = 3.5;
const OUTRO_FRAMES = Math.round(OUTRO_SEC * FPS); // 105
const XFADE_FRAMES = 10; // ~0.33s crossfade interview → outro
const TOTAL_SEC = INTERVIEW_SEC;
const DURATION = INTERVIEW_FRAMES;

// ── Caption data — REEL 2 v2, re-timed on the RE-CUT audio. chunks_timed_reel2_v2.json
// was produced by compose/align_chunks_reel2_v2.py: the 34 surviving chunks (Q 1-9 +
// Safir 25-49), each chunk's absolute spoken window [tStart,tEnd] + spoken word ONSETS
// inside it, locked to the v2 faster-whisper pass (compose/asr_reel2_v2.json). RU text
// + n/s/a/A styles come straight from compose/chunks_ru_reel2_v2.json — UNCHANGED. ──
const TIMED: CaptionChunkTimed[] = JSON.parse(
  readFileSync("compose/chunks_timed_reel2_v2.json", "utf8")
) as CaptionChunkTimed[];

// Real measured glyph widths for REEL 2 (compose/measure_words.ts →
// word_widths_reel2.json) so word gaps are EVEN. Optional fallback to estimate.
let MEASURED: Record<string, number> | undefined;
try {
  MEASURED = JSON.parse(readFileSync("compose/word_widths_reel2.json", "utf8")) as Record<string, number>;
} catch {
  MEASURED = undefined;
}

// ── Style maps — IDENTICAL to build_reel.ts / build_reel1.ts STYLE_B/STYLE_A. ────
const STYLE_B: Record<"n" | "s" | "a" | "A", CaptionStyle> = {
  n: { font: "condensedHeavy", size: 78, weight: 500, color: "#f7f5f3", case: "upper",
       shadow: [{ y: 3, blur: 20, color: "rgba(0,0,0,0.6)" }] },
  s: { font: "condensedHeavy", size: 87, weight: 700, color: "#f7f5f3", case: "upper",
       shadow: [{ y: 3, blur: 20, color: "rgba(0,0,0,0.65)" }] },
  a: { font: "playfairItalic", size: 96, weight: 600, color: "#a01f33", case: "none",
       stroke: { color: "#ffffff", width: 5 },
       shadow: [{ y: 4, blur: 20, color: "rgba(0,0,0,0.55)" }, { blur: 26, color: "rgba(255,255,255,0.5)" }] },
  A: { font: "playfairItalic", size: 108, weight: 700, color: "#b0223a", case: "none",
       stroke: { color: "#ffffff", width: 6 },
       shadow: [{ y: 5, blur: 24, color: "rgba(0,0,0,0.55)" }, { blur: 32, color: "rgba(255,255,255,0.55)" }] },
};
const STYLE_A: Record<"n" | "s" | "a" | "A", CaptionStyle> = {
  n: STYLE_B.n,
  s: STYLE_B.s,
  a: { font: "condensedHeavy", size: 90, weight: 700, color: "#a01f33", case: "upper",
       stroke: { color: "#ffffff", width: 5 },
       shadow: [{ y: 4, blur: 20, color: "rgba(0,0,0,0.55)" }, { blur: 26, color: "rgba(255,255,255,0.5)" }] },
  A: { font: "condensedHeavy", size: 102, weight: 700, color: "#b0223a", case: "upper",
       stroke: { color: "#ffffff", width: 6 },
       shadow: [{ y: 5, blur: 24, color: "rgba(0,0,0,0.55)" }, { blur: 32, color: "rgba(255,255,255,0.55)" }] },
};
const styleMap = VARIANT === "A" ? STYLE_A : STYLE_B;

// Outro CTA style — IDENTICAL to build_reel.ts / build_reel1.ts (n 48 / a 60
// Playfair burgundy).
const OUTRO_STYLE: Record<"n" | "s" | "a" | "A", CaptionStyle> = {
  n: { font: "condensedHeavy", size: 48, weight: 500, color: "#f7f5f3", case: "upper",
       shadow: [{ y: 2, blur: 10, color: "rgba(0,0,0,0.55)" }] },
  s: STYLE_B.s,
  a: { font: "playfairItalic", size: 60, weight: 600, color: "#c33049", case: "none",
       stroke: { color: "#ffffff", width: 3 },
       shadow: [{ y: 2, blur: 10, color: "rgba(0,0,0,0.5)" }, { blur: 14, color: "rgba(255,255,255,0.4)" }] },
  A: STYLE_B.A,
};

// Continuous speech → one whole-interview region drives ducking (CONTRACT §7).
const SPEECH: SpeechRegion[] = [{ startFrame: 0, endFrame: DURATION }];

// ── Build ──────────────────────────────────────────────────────────────────────
const t = createTimeline({ fps: FPS });
const scene: Scene = addScene(t, { durationInFrames: DURATION });

// Band geometry (CONTRACT §2, center-offset px) — IDENTICAL to REEL 1 (same 640×360
// clean 16:9 footage with the same baked label). The footage plays as a centered
// 1080×608 BOX (objectFit cover — aspect matches 640×360 so the full frame shows).
// Frame_1 fills the top band, Frame_2 the bottom band, extended UP to abs 1200
// (center +600, h 720) to MASK the baked "Evgeniia Nikulina" label bottom-left.
//   video  : center y = 0,    h = 608  (abs  656..1264)
//   Frame_1: center y = -632, h = 656  (abs    0..656)
//   Frame_2: center y = +600, h = 720  (abs 1200..1920)  ← masks the baked label
const vid = setVideo(scene, {
  src: "media/reel2_source_v2.mp4",
  x: 0,
  y: 0,
  width: 1080,
  height: 608,
  borderRadius: 0,
  backColor: "#6e1020", // seam-safety fill
  startFrom: 0,
  volume: 1, // EN guest + RU beat both live in the video's own audio — audible foreground
});
vid.speechRegions = SPEECH;

addImageOverlay(scene, { src: "media/Frame_1.png", x: 0, y: -632, width: 1080, height: 656, fit: "cover" });
addImageOverlay(scene, { src: "media/Frame_2.png", x: 0, y: 600, width: 1080, height: 720, fit: "cover" });

// ── B-roll: NONE on this pass — rebuilt as a CLEAN talking-head cut. The old B-roll
// spans were timed to the pre-recut timeline (two sat on now-removed Evgenia lines)
// and no longer line up. B-roll gets re-wired on the new locked v2 timeline in a
// follow-up.

if (STAGE !== "collage") {
  revealCaptionChunksTimed(scene, TIMED, {
    fps: FPS,
    totalSec: TOTAL_SEC,
    styleMap,
    centerY: 470,
    maxLineWidth: 900,
    wordGap: 23, // 0.30×78px uniform
    measuredWidths: MEASURED,
    // Snappy speech-paced pop: defaults revealDur 0.10 / fadeDur 0.08 / scaleIn 0.86
    // / baselineK 0.30 — no de-blur, no rise/drift.
  });
}

// ── Outro card — IDENTICAL construction to build_reel1.ts (color bg + full-frame
// photo overlay + held CTA + soft dark plate), crossfaded in after the interview.
const OUTRO_CTA: ChunkWord[] = [
  { text: "пиши", style: "n" }, { text: "слово", style: "n" }, { text: "«клуб»,", style: "a" },
  { text: "чтобы", style: "n" }, { text: "получить", style: "n" }, { text: "полную", style: "n" },
  { text: "версию", style: "n" }, { text: "эфира", style: "n" },
];
const outro: Scene = addScene(t, { durationInFrames: OUTRO_FRAMES });
addImageOverlay(outro, { src: "media/outro_photo_club.jpg", x: 0, y: 0, width: 1080, height: 1920, fit: "cover" });
if (STAGE !== "collage") {
  const OUTRO_CENTER_Y = 510;
  const { bounds } = staticCaption(outro, OUTRO_CTA, {
    fps: FPS,
    styleMap: OUTRO_STYLE,
    centerY: OUTRO_CENTER_Y,
    maxLineWidth: 740,
    wordGap: 14,
    lineGap: 64,
    measuredWidths: MEASURED,
    fadeInSec: 0.3,
  });
  const padX = 84, padY = 60, plateBlur = 26;
  const plate: Shape = {
    id: "outro-plate",
    shape: "rect",
    start: 0,
    end: OUTRO_FRAMES,
    x: bounds.cx,
    y: bounds.cy,
    width: bounds.width + padX * 2,
    height: bounds.height + padY * 2,
    color: "rgba(0,0,0,0.72)",
    borderRadius: 130,
    opacity: 1,
    keyframes: {
      blur: [{ frame: 0, value: plateBlur }],
      opacity: [
        { frame: 0, value: 0 },
        { frame: Math.round(0.3 * FPS), value: 1, easing: "easeOut" },
      ],
    },
  };
  outro.shapes = [plate];
}
setTransition(t, 0, { type: "fade", duration: XFADE_FRAMES });

if (STAGE === "full") {
  // Music bed over interview + outro. MUSIC FIX: the bed was too loud and its heavy
  // bass sat under the voice. (1) base 0.28 → 0.15; (2) duck DEEPER under speech
  // (0.06 vs the old 0.15) with ~200ms attack / ~230ms release so it never pumps;
  // (3) the low end is tamed by a baked HPF ~120Hz + low-shelf −4dB + gentle limiter
  // → media/music_reel2_hpf.mp3 (the Remotion pipeline only scales per-frame volume,
  // it can't EQ, so the filtering is pre-baked). The whole interview is one speech
  // region, so the bed rides at 0.06 under the talking and only returns to 0.15
  // (un-ducked) over the outro, then fades. The track (238s) spans the ~71s reel.
  // NOTE: this track has SUNG VOCALS — see the build report if they still compete.
  setAudio(t, {
    src: "media/music_reel2_hpf.mp3",
    volume: 0.15,
    fadeInFrames: 30,
    fadeOutFrames: 50,
  });
  enableDucking(t, { duckedVolume: 0.06, attackFrames: 6, releaseFrames: 7 });
}

const wordCount = scene.words.length + outro.words.length;
const totalFrames = INTERVIEW_FRAMES + OUTRO_FRAMES - XFADE_FRAMES;
const out = writeTimeline(t, "public/timeline_reel2.json");
console.log(
  `wrote ${out}  variant=${VARIANT} stage=${STAGE} interview=${INTERVIEW_FRAMES}f outro=${OUTRO_FRAMES}f ` +
    `total≈${totalFrames}f (${(totalFrames / FPS).toFixed(2)}s) chunks=${TIMED.length} words=${wordCount}`
);
