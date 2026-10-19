// build_reel1.ts — assemble the finished REEL 1 (final assembly).
//
//   node compose/run.mjs compose/build_reel1.ts [A|B] [collage|captions|full]
//
// Writes a SCRATCH timeline (public/timeline_reel1.json). Default variant B
// (Playfair italic accents), stage full. Reuses the SAME helpers as build_reel.ts
// (setVideo / addImageOverlay / revealCaptionChunksTimed / staticCaption /
// setAudio / enableDucking / setTransition) — nothing rebuilt; only the REEL 1
// constants (source, band geometry, paths, durations) differ.
//
// SOURCE REALITY (verified from a still): the only available REEL 1 clip,
// public/media/reel1_source.mp4 (640×360, 25fps, 47.5s, WITH audio), is a CLEAN
// 16:9 interview frame (NOT a burgundy-letterboxed canvas like the other reel) —
// two people on a couch, with a small baked "Evgeniia Nikulina" label bottom-left.
// Already in narrative/audio order → no reorder; already 16:9 → BAND layout (the
// footage plays as a centered 1080×608 band; Frame_1 fills the top band, Frame_2
// the bottom band, extended UP to mask the baked label).

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
// REEL 1 source: reel1_source.mp4 — video 47.48s / audio 47.441s, last ASR word at
// 46.96s. Hold the interview to 47.44s (within the media, past the last caption).
const CLIP_SEC = 47.44;
const INTERVIEW_SEC = CLIP_SEC;
const INTERVIEW_FRAMES = Math.round(INTERVIEW_SEC * FPS); // 1423
const OUTRO_SEC = 3.5;
const OUTRO_FRAMES = Math.round(OUTRO_SEC * FPS); // 105
const XFADE_FRAMES = 10; // ~0.33s crossfade interview → outro
const TOTAL_SEC = INTERVIEW_SEC;
const DURATION = INTERVIEW_FRAMES;

// ── Caption data — REEL 1, re-timed from ASR (Step 1/2). chunks_timed_reel1.json
// was produced by compose/align_chunks_reel1.py: each chunk's absolute spoken
// window [tStart,tEnd] + the English word ONSETS inside it, locked to the
// faster-whisper pass (compose/asr_reel1.json). RU text + n/s/a/A styles come
// straight from compose/chunks_ru_reel1.json — UNCHANGED. ────────────────────────
const TIMED: CaptionChunkTimed[] = JSON.parse(
  readFileSync("compose/chunks_timed_reel1.json", "utf8")
) as CaptionChunkTimed[];

// Real measured glyph widths for REEL 1 (compose/measure_words.ts →
// word_widths_reel1.json) so word gaps are EVEN. Optional fallback to estimate.
let MEASURED: Record<string, number> | undefined;
try {
  MEASURED = JSON.parse(readFileSync("compose/word_widths_reel1.json", "utf8")) as Record<string, number>;
} catch {
  MEASURED = undefined;
}

// ── Style maps — IDENTICAL to build_reel.ts STYLE_B/STYLE_A (Step 3 spec). ────────
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

// Outro CTA style — IDENTICAL to build_reel.ts (n 48 / a 60 Playfair burgundy).
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

// Band geometry (CONTRACT §2, center-offset px). The clean 16:9 footage plays as a
// centered 1080×608 BOX (objectFit cover — aspect matches 640×360 so the full frame
// shows). Frame_1 fills the top band, Frame_2 the bottom band, extended UP to abs
// 1200 (center +600, h 720) to MASK the baked "Evgeniia Nikulina" label that sits
// near the bottom-left of the scaled footage.
//   video  : center y = 0,    h = 608  (abs  656..1264)
//   Frame_1: center y = -632, h = 656  (abs    0..656)
//   Frame_2: center y = +600, h = 720  (abs 1200..1920)  ← masks the baked label
const vid = setVideo(scene, {
  src: "media/reel1_source.mp4",
  x: 0,
  y: 0,
  width: 1080,
  height: 608,
  borderRadius: 0,
  backColor: "#6e1020", // seam-safety fill
  startFrom: 0,
  volume: 1, // English speech lives in the video's own audio — audible foreground
});
vid.speechRegions = SPEECH;

addImageOverlay(scene, { src: "media/Frame_1.png", x: 0, y: -632, width: 1080, height: 656, fit: "cover" });
addImageOverlay(scene, { src: "media/Frame_2.png", x: 0, y: 600, width: 1080, height: 720, fit: "cover" });

// ── B-roll cutaways — full-frame 1080×1920 muted video OVERLAYS over the band
// collage (Step: wire B-roll). Each clip is added AFTER Frame_1/Frame_2 so it
// z-stacks ON TOP of them (engine renders overlays in add order; a video-src
// overlay plays via OffthreadVideo). For its span the clip is opaque and fully
// replaces the visible picture, but the эфир `box` background stays MOUNTED
// underneath — so its speech audio keeps playing (the clip itself is muted/-an).
// Captions live on scene.words (the TOP layer, above all overlays), so the
// per-word reveals render OVER the clip with their EXISTING timing — NOT re-timed
// (they already match the audio that keeps running). ~XF-frame opacity crossfade
// at in/out (no hard cut). Reel length is unchanged (overlay, not a time-insert).
const XF = 4; // crossfade frames (within the 3–5 spec)
type BrollCut = { src: string; inSec: number; outSec: number };
const BROLL: BrollCut[] = [
  { src: "media/broll_reel1_01.mp4", inSec: 3.0,  outSec: 5.4 },
  { src: "media/broll_reel1_02.mp4", inSec: 9.6,  outSec: 12.2 },
  { src: "media/broll_reel1_03.mp4", inSec: 14.9, outSec: 17.0 },
  { src: "media/broll_reel1_04.mp4", inSec: 27.2, outSec: 29.6 },
  { src: "media/broll_reel1_05.mp4", inSec: 44.7, outSec: 47.0 },
];
for (const b of BROLL) {
  const start = Math.round(b.inSec * FPS);
  const end = Math.round(b.outSec * FPS);
  const dur = end - start;
  const ov = addImageOverlay(scene, {
    src: b.src, x: 0, y: 0, width: 1080, height: 1920, fit: "cover", start, end,
  });
  ov.keyframes = {
    opacity: [
      { frame: 0, value: 0 },
      { frame: XF, value: 1, easing: "easeOut" },
      { frame: Math.max(XF, dur - XF), value: 1 },
      { frame: dur, value: 0, easing: "easeIn" },
    ],
  };
}

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

// ── Outro card — IDENTICAL construction to build_reel.ts (color bg + full-frame
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
  // Music bed over interview + outro; ducking dips under the interview speech, the
  // outro (no speechRegions) plays un-ducked, then fades over the last ~1.6s.
  setAudio(t, { src: "media/Meridian - National Sweetheart.mp3", volume: 0.28, fadeInFrames: 30, fadeOutFrames: 50 });
  enableDucking(t, {});
}

const wordCount = scene.words.length + outro.words.length;
const totalFrames = INTERVIEW_FRAMES + OUTRO_FRAMES - XFADE_FRAMES;
const out = writeTimeline(t, "public/timeline_reel1.json");
console.log(
  `wrote ${out}  variant=${VARIANT} stage=${STAGE} interview=${INTERVIEW_FRAMES}f outro=${OUTRO_FRAMES}f ` +
    `total≈${totalFrames}f (${(totalFrames / FPS).toFixed(2)}s) chunks=${TIMED.length} words=${wordCount}`
);
