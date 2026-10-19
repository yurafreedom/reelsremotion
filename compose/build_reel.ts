// build_reel.ts — assemble the finished "6 dates" reel (RESTART build).
//
//   node compose/run.mjs compose/build_reel.ts [A|B] [collage|captions|full]
//
// Writes a SCRATCH timeline (public/timeline_reel.json) — never clobbers
// public/timeline.json. Default variant B (Playfair italic accents), stage full.
//
// SOURCE REALITY (verified from a still): the only available "cropped" clip,
// public/media/Reels.mp4 (1080×1920, 30fps, 52.1s, WITH audio), is NOT a clean
// full-vertical crop — it is the 16:9 interview footage letterboxed in a burgundy
// canvas (footage occupies source rows 656..1264, centered; "Evgeniia Nikulina"
// label baked bottom-left at y~1242..1260). Per the spec's decision tree, a still
// 16:9 letterboxed clip takes the BAND layout (do NOT cover-crop): the footage
// plays as a centered 1080×608 band, Frame_1 fills the top band and Frame_2 the
// bottom band (Frame_2 extended up to mask the baked label).

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
// Interview clip length (media/Reels.mp4, re-cropped to recover the full final word
// "quickly" — ASR-verified end at raw 57.90): 52.44s = 1573 frames. The interview
// SCENE length IS the clip length.
const CLIP_SEC = 52.44;
const INTERVIEW_SEC = CLIP_SEC;
const INTERVIEW_FRAMES = Math.round(INTERVIEW_SEC * FPS); // 1566
// Outro card: a static club-promo closing scene appended after the interview.
const OUTRO_SEC = 3.5;
const OUTRO_FRAMES = Math.round(OUTRO_SEC * FPS); // 105
const XFADE_FRAMES = 10; // ~0.33s crossfade interview → outro
// The caption track must not outlast the interview clip.
const TOTAL_SEC = INTERVIEW_SEC;
const DURATION = INTERVIEW_FRAMES;

// ── Caption data — the "6 dates" story, RE-TIMED from ASR (Step 1/2). ───────────
// compose/chunks_timed.json was produced by compose/align_chunks.py: each chunk's
// absolute spoken window [tStart,tEnd] + the English word ONSETS inside it, locked
// to the faster-whisper pass on the clip's real audio (compose/asr_words.json).
// The Russian text + per-word n/s/a/A styles are UNCHANGED from the reviewed copy;
// only the timing (and the reveal, see below) changed. This is the hand-tune
// surface — nudge tStart/tEnd in chunks_timed.json by ear, then re-run this.
const TIMED: CaptionChunkTimed[] = JSON.parse(
  readFileSync("compose/chunks_timed.json", "utf8")
) as CaptionChunkTimed[];

// Real measured glyph widths (compose/measure_words.ts → word_widths.json): the
// absolute caption layout uses these instead of a len·size·k estimate so word gaps
// are EVEN and accents don't inject phantom space / overlap (fix #4). Optional —
// if absent, the pattern falls back to the estimate.
let MEASURED: Record<string, number> | undefined;
try {
  MEASURED = JSON.parse(readFileSync("compose/word_widths.json", "utf8")) as Record<string, number>;
} catch {
  MEASURED = undefined;
}

// ── Style maps (large, readable; ~78–108px, ≈3× the first draft; n < s < a < A) ──
const STYLE_B: Record<"n" | "s" | "a" | "A", CaptionStyle> = {
  n: { font: "condensedHeavy", size: 78, weight: 500, color: "#f7f5f3", case: "upper",
       shadow: [{ y: 3, blur: 20, color: "rgba(0,0,0,0.6)" }] },
  s: { font: "condensedHeavy", size: 87, weight: 700, color: "#f7f5f3", case: "upper",
       shadow: [{ y: 3, blur: 20, color: "rgba(0,0,0,0.65)" }] },
  // accents sit over a RED photo (Frame_2) → burgundy fill alone vanishes. Pop them
  // with a THICK white outline + a white glow (not the reference's red glow).
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

// Outro CTA style: MUCH smaller than the reel captions (n 48 vs 78) so it doesn't
// fight the photo's baked "ЗАКРЫТЫЙ … КЛУБ" text + fire. «клуб» stays the burgundy
// Playfair accent, scaled to match (a 60 ≈ 1.25×n). Lighter shadows/stroke since the
// soft dark plate behind it (see below) provides the contrast. (s/A unused here.)
const OUTRO_STYLE: Record<"n" | "s" | "a" | "A", CaptionStyle> = {
  n: { font: "condensedHeavy", size: 48, weight: 500, color: "#f7f5f3", case: "upper",
       shadow: [{ y: 2, blur: 10, color: "rgba(0,0,0,0.55)" }] },
  s: STYLE_B.s,
  a: { font: "playfairItalic", size: 60, weight: 600, color: "#c33049", case: "none",
       stroke: { color: "#ffffff", width: 3 },
       shadow: [{ y: 2, blur: 10, color: "rgba(0,0,0,0.5)" }, { blur: 14, color: "rgba(255,255,255,0.4)" }] },
  A: STYLE_B.A,
};

// ── Manual speech regions (no ASR draft): the interview talks ~continuously, so
// one whole-reel region drives ducking (ABSOLUTE frames, CONTRACT §7).
const SPEECH: SpeechRegion[] = [{ startFrame: 0, endFrame: DURATION }];

// ── Build ──────────────────────────────────────────────────────────────────────
const t = createTimeline({ fps: FPS });
const scene: Scene = addScene(t, { durationInFrames: DURATION });

// Band geometry (CONTRACT §2, center-offset px), measured from a still of the clip:
// footage band = source rows 656..1264 (h 608, centered → y 0). The video is a BOX
// 1080×608 over a maroon backColor fill; objectFit:cover shows exactly those rows
// (= the footage, its burgundy bars cropped off). The two regions left over are the
// collage bands: Frame_1 fills the top (abs 0..656), Frame_2 the bottom — extended
// UP to abs 1234 so it masks the baked "Evgeniia Nikulina" label (y~1242..1260).
//   video  : center y = 0,    h = 608  (abs  656..1264)
//   Frame_1: center y = -632, h = 656  (abs    0..656)
//   Frame_2: center y = +617, h = 686  (abs 1234..1920)  ← masks the baked label
const vid = setVideo(scene, {
  src: "media/Reels.mp4",
  x: 0,
  y: 0,
  width: 1080,
  height: 608,
  borderRadius: 0,
  backColor: "#6e1020", // seam-safety fill (matches the source's own maroon)
  startFrom: 0,
  volume: 1, // the English speech lives in the video's own audio — audible foreground
});
vid.speechRegions = SPEECH;

addImageOverlay(scene, { src: "media/Frame_1.png", x: 0, y: -632, width: 1080, height: 656, fit: "cover" });
addImageOverlay(scene, { src: "media/Frame_2.png", x: 0, y: 617, width: 1080, height: 686, fit: "cover" });

if (STAGE !== "collage") {
  revealCaptionChunksTimed(scene, TIMED, {
    fps: FPS,
    totalSec: TOTAL_SEC,
    styleMap,
    centerY: 470, // lower into Frame_2's red (fix #2): air below the band seam (abs
    // ~1264) above the top line, lowest line still ≤ +560 clear of IG bottom chrome
    maxLineWidth: 900,
    wordGap: 23, // uniform (fix #3): 0.30×78px, matching the reference's 8/27px gap
    measuredWidths: MEASURED, // real glyph widths for even gaps (fix #4)
    // Snappy speech-paced pop (Step 3): defaults revealDur 0.10s / fadeDur 0.08s /
    // scaleIn 0.86 — no de-blur, no rise/drift.
  });
}

// ── Outro card: a static club-promo closing scene, crossfaded in after the
// interview so the reel doesn't end on an abrupt cut. Full-screen club photo
// (9:16, fit cover) + a held CTA in the existing caption look («клуб» = burgundy
// Playfair accent). NO per-word karaoke — one gentle 0.3s fade-in, then holds.
const OUTRO_CTA: ChunkWord[] = [
  { text: "пиши", style: "n" }, { text: "слово", style: "n" }, { text: "«клуб»,", style: "a" },
  { text: "чтобы", style: "n" }, { text: "получить", style: "n" }, { text: "полную", style: "n" },
  { text: "версию", style: "n" }, { text: "эфира", style: "n" },
];
// The outro background is a COLOR clip (so it forms a real video-track segment for
// the crossfade TransitionSeries), with the club photo as a FULL-FRAME overlay on
// top. (A scene whose background is an `image` clip would, during the crossfade,
// overlap the interview video and be mis-classified as an overlay → no outro
// segment → black after the interview ends. Color bg + photo overlay avoids that.)
const outro: Scene = addScene(t, { durationInFrames: OUTRO_FRAMES });
addImageOverlay(outro, { src: "media/outro_photo_club.jpg", x: 0, y: 0, width: 1080, height: 1920, fit: "cover" });
if (STAGE !== "collage") {
  const OUTRO_CENTER_Y = 510; // lower than the baked "ЕВГЕНИИ НИКУЛИНОЙ" line, within
  // the IG safe zone (block stays ≤ +560); the plate masks the baked "50 оттенков…".
  // Lay out the (small) CTA first to get its bounding box, then size the plate to it.
  const { bounds } = staticCaption(outro, OUTRO_CTA, {
    fps: FPS,
    styleMap: OUTRO_STYLE,
    centerY: OUTRO_CENTER_Y,
    maxLineWidth: 740,
    wordGap: 14, // 0.30×48 ≈ 14 (uniform, scaled to the smaller size)
    lineGap: 64, // a touch airier than 1.2× so the plate reads as one soft block
    measuredWidths: MEASURED,
    fadeInSec: 0.3,
  });
  // Soft dark "cloud" plate BEHIND the CTA (shape track → below text, above the
  // photo). A heavily-BLURRED rounded rect = feathered, organic edges (not a hard
  // rectangle); rgba(0,0,0,0.6) separates the CTA from the fire + baked text. The
  // blur is a constant keyframe (Shape has no static blur field).
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
    color: "rgba(0,0,0,0.72)", // strong enough to separate the CTA from the fire/baked
    borderRadius: 130,         // text; the 26px blur keeps the edges soft (cloud, not box)
    opacity: 1,
    keyframes: {
      blur: [{ frame: 0, value: plateBlur }], // constant feather
      // fade the plate in WITH the CTA so the card doesn't snap.
      opacity: [
        { frame: 0, value: 0 },
        { frame: Math.round(0.3 * FPS), value: 1, easing: "easeOut" },
      ],
    },
  };
  outro.shapes = [plate];
}
// Quick crossfade interview(scene 0) → outro(scene 1) — CONTRACT §4.1 frame overlap.
setTransition(t, 0, { type: "fade", duration: XFADE_FRAMES });

if (STAGE === "full") {
  // Quiet background bed UNDER the speech; ducking dips it further while talking.
  // The track spans the WHOLE reel (interview + outro); the outro has no speech
  // (static photo, no speechRegions) so the music plays un-ducked there and then
  // fades out over the last ~1.6s (50 frames @30fps).
  setAudio(t, { src: "media/connection_wayne_jones.mp3", volume: 0.28, fadeInFrames: 30, fadeOutFrames: 50 });
  enableDucking(t, {});
}

const wordCount = scene.words.length + outro.words.length;
const totalFrames = INTERVIEW_FRAMES + OUTRO_FRAMES - XFADE_FRAMES;
const out = writeTimeline(t, "public/timeline_reel.json");
console.log(
  `wrote ${out}  variant=${VARIANT} stage=${STAGE} interview=${INTERVIEW_FRAMES}f outro=${OUTRO_FRAMES}f ` +
    `total≈${totalFrames}f (${(totalFrames / FPS).toFixed(2)}s) chunks=${TIMED.length} words=${wordCount}`
);
