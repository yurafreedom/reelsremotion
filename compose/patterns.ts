// High-level reel patterns — the moves CC reaches for most. Composed entirely from
// the text/animation/layout primitives, so the output is ordinary keyframed words.

import type {
  EnterFrom,
  FontKey,
  Keyframe,
  PositionKeyframe,
  Scene,
  TextCase,
  Word,
  WordKeyframes,
} from "@engine/types";
import { addWord, type WordStyle } from "./text";
import { slideIn, pulse } from "./animation";
import { stackVertical } from "./layout";

/**
 * The dominant accumulating-subtitle pattern: stack `texts` as a centered column,
 * each sliding in from an alternating side, staggered in time. Words hold to the
 * scene end by default (the "lines pile up and hang" look).
 *
 * Returns the created words (target individual ones with findWord/emphasize).
 */
export const revealWordByWord = (
  scene: Scene,
  texts: string[],
  opts: {
    fromSides?: boolean;
    stagger?: number;
    holdToSceneEnd?: boolean;
    baseStyle?: WordStyle;
    gap?: number;
    startY?: number;
    slideDuration?: number;
  } = {}
): Word[] => {
  const fromSides = opts.fromSides ?? true;
  const stagger = opts.stagger ?? 12;
  const hold = opts.holdToSceneEnd ?? true;

  const words = texts.map((text, i) => {
    const start = i * stagger;
    const end = hold ? scene.durationInFrames : start + stagger * 2;
    return addWord(scene, { text, start, end, ...opts.baseStyle });
  });

  // Place the column, then animate each in from its side.
  stackVertical(words, { gap: opts.gap, center: true, startY: opts.startY });
  words.forEach((w, i) => {
    const from: EnterFrom = fromSides ? (i % 2 === 0 ? "left" : "right") : "bottom";
    slideIn(w, { from, duration: opts.slideDuration });
  });
  return words;
};

/**
 * Pulse a set of words on a musical grid. `bpm` + the timeline `fps` define the
 * beat spacing; each word gets a pulse on the first beat at/after its appearance.
 * With `downbeatEmphasis`, every 4th beat pulses harder.
 *
 * fps is required (words don't carry it) — pass timeline.fps.
 */
export const kineticBeat = (
  words: Word[],
  opts: { bpm: number; fps?: number; downbeatEmphasis?: boolean; amount?: number }
): Word[] => {
  const fps = opts.fps ?? 30;
  const framesPerBeat = Math.max(1, Math.round((fps * 60) / opts.bpm));
  const base = opts.amount ?? 1.22;
  words.forEach((w, i) => {
    // Word-relative: pulse near the entrance, snapped onto the beat grid.
    const len = Math.max(1, w.end - w.start);
    const at = Math.min(len - 1, Math.round(len * 0.15));
    const isDownbeat = opts.downbeatEmphasis ? i % 4 === 0 : false;
    pulse(w, { at, amount: isDownbeat ? base + 0.12 : base });
  });
  // framesPerBeat informs callers/retiming; kept explicit for clarity.
  void framesPerBeat;
  return words;
};

// ---------------------------------------------------------------------------
// revealCaptionChunks — chunk-replacement kinetic captions.
//
// One short CENTERED line (auto-wrapped) at a time, its words revealed left→right
// with a rise + de-blur + scale, the whole chunk holding then fading/drifting out
// as the next chunk reveals in. This is NOT revealWordByWord's vertical pile-up:
// each chunk fully replaces the previous one. Composed from addWord + direct engine
// keyframes (the same static-then-keyframed model the other patterns use).
// ---------------------------------------------------------------------------

export type CaptionStyle = {
  font: FontKey;
  size: number;
  weight: number;
  color: string;
  case?: TextCase;
  stroke?: { color: string; width: number };
  shadow?: Array<{ x?: number; y?: number; blur: number; color: string }>;
};
export type ChunkWord = { text: string; style: "n" | "s" | "a" | "A" };
export type CaptionChunk = { tSec: number; words: ChunkWord[] };
// Timed variant (Step 2/3): an absolute spoken window [tStart,tEnd] plus the
// English word ONSETS inside it, so each Russian word pops on a real speech onset.
export type CaptionChunkTimed = {
  tStart: number;
  tEnd: number;
  onsets: number[];
  words: ChunkWord[];
};

// Per-font glyph-width factor for the greedy line-packer's width estimate
// (`w ≈ text.length * size * k`). Condensed Oswald is narrow; Playfair italic a
// touch wider; everything else (Inter etc.) wider still. Tune from a still.
// Tuned from 3×-size stills: at 0.56 a white condensed word abutting a Playfair
// accent on the same line collided ("СЕБЯживой"). Bumped so adjacent words keep a
// real gap; Playfair italic (wide ж/й lowercase) needs a touch more than Oswald.
const WIDTH_K: Partial<Record<FontKey, number>> = {
  condensedHeavy: 0.57,
  playfairItalic: 0.64,
};
const widthK = (font: FontKey): number => WIDTH_K[font] ?? 0.62;

const round = Math.round;

export const revealCaptionChunks = (
  scene: Scene,
  chunks: CaptionChunk[],
  opts: {
    fps: number;
    totalSec: number;
    styleMap: Record<"n" | "s" | "a" | "A", CaptionStyle>;
    centerY: number; // band center, px offset from frame center (CONTRACT §2)
    maxLineWidth?: number; // px; wrap beyond this (default 900)
    lineGap?: number; // px between wrapped lines (default n.size*1.35)
    wordGap?: number; // px between words on a line (default 14)
    perWord?: number; // reveal stagger, sec (default 0.18)
    revealDur?: number; // sec (default 0.44)
    fadeDur?: number; // sec (default 0.40)
    rise?: number; // reveal rise, px (default 16)
    blurIn?: number; // reveal start blur, px (default 4)
    scaleIn?: number; // reveal start scale 0..1 (default 0.92)
    driftOut?: number; // upward drift on fade-out, px (default 30)
  }
): Word[] => {
  const { fps, totalSec, styleMap, centerY } = opts;
  const maxLineWidth = opts.maxLineWidth ?? 900;
  const lineGap = opts.lineGap ?? round(styleMap.n.size * 1.35);
  const wordGap = opts.wordGap ?? 20;
  const perWord = opts.perWord ?? 0.18;
  const revealDur = opts.revealDur ?? 0.44;
  const fadeDur = opts.fadeDur ?? 0.4;
  const rise = opts.rise ?? 16;
  const blurIn = opts.blurIn ?? 4;
  const scaleIn = opts.scaleIn ?? 0.92;
  const driftOut = opts.driftOut ?? 30;

  const revealF = round(revealDur * fps);
  const fadeF = round(fadeDur * fps);
  const stagF = round(perWord * fps);
  const created: Word[] = [];

  chunks.forEach((chunk, i) => {
    const chunkStart = round(chunk.tSec * fps);
    const chunkEnd = round((chunks[i + 1]?.tSec ?? totalSec) * fps);

    // --- Layout: greedy line-pack, center each line, center the block on centerY ---
    const cw = chunk.words.map((word) => {
      const st = styleMap[word.style];
      const display = st.case === "upper" ? word.text.toUpperCase() : word.text;
      const w = display.length * st.size * widthK(st.font);
      return { word, st, w };
    });

    type Lined = (typeof cw)[number] & { line: number };
    const lined: Lined[] = [];
    let line = 0;
    let lineW = 0;
    cw.forEach((entry, j) => {
      const add = (j === 0 ? 0 : wordGap) + entry.w;
      // Wrap when adding this word would exceed the max line width (but never on
      // the first word of a line — a single over-wide word still gets its own line).
      if (lineW > 0 && lineW + add > maxLineWidth) {
        line++;
        lineW = 0;
      }
      lined.push({ ...entry, line });
      lineW += (lineW > 0 ? wordGap : 0) + entry.w;
    });

    const lineCount = line + 1;
    // Width of each line (for horizontal centering).
    const lineWidths: number[] = [];
    for (let l = 0; l < lineCount; l++) {
      const ws = lined.filter((e) => e.line === l);
      lineWidths[l] = ws.reduce((acc, e) => acc + e.w, 0) + wordGap * Math.max(0, ws.length - 1);
    }
    // Vertical: block of `lineCount` lines, centered on centerY.
    const blockTopCenter = centerY - ((lineCount - 1) * lineGap) / 2;
    // Running x-cursor per line (start at left edge of each centered line).
    const cursor: number[] = lineWidths.map((lw) => -lw / 2);

    // Base position (bx,by) per word, in original reading order.
    lined.forEach((e) => {
      const bx = round(cursor[e.line] + e.w / 2);
      const by = round(blockTopCenter + e.line * lineGap);
      cursor[e.line] += e.w + wordGap;
      (e as Lined & { bx: number; by: number }).bx = bx;
      (e as Lined & { bx: number; by: number }).by = by;
    });

    // --- Create + keyframe each word (reading order j = reveal stagger order) ---
    lined.forEach((e, j) => {
      const ee = e as Lined & { bx: number; by: number };
      const { bx, by, st, word } = ee;
      const revealStart = chunkStart + j * stagF;
      const wordEnd = chunkEnd + fadeF;
      const holdEnd = chunkEnd - revealStart; // word-relative frame chunk ends

      const w = addWord(scene, {
        text: word.text,
        start: revealStart,
        end: wordEnd,
        x: bx,
        y: by,
        font: st.font,
        size: st.size,
        weight: st.weight,
        color: st.color,
        case: st.case,
      });
      if (st.stroke) w.stroke = { color: st.stroke.color, width: st.stroke.width };
      if (st.shadow) w.shadow = st.shadow.map((s) => ({ ...s }));

      // Reveal keyframes (word-relative, rel=0 at word.start = revealStart).
      const opacity: Keyframe<number>[] = [
        { frame: 0, value: 0 },
        { frame: revealF, value: 1, easing: "easeOut" },
        { frame: Math.max(revealF, holdEnd), value: 1 },
        { frame: Math.max(revealF, holdEnd) + fadeF, value: 0, easing: "easeOut" },
      ];
      const position: PositionKeyframe[] = [
        { frame: 0, value: { x: bx, y: by + rise } },
        { frame: revealF, value: { x: bx, y: by }, easing: "easeOut" },
        { frame: Math.max(revealF, holdEnd), value: { x: bx, y: by } }, // hold still
        { frame: Math.max(revealF, holdEnd) + fadeF, value: { x: bx, y: by - driftOut }, easing: "easeOut" },
      ];
      const blur: Keyframe<number>[] = [
        { frame: 0, value: blurIn },
        { frame: revealF, value: 0, easing: "easeOut" },
      ];
      const size: Keyframe<number>[] = [
        { frame: 0, value: round(scaleIn * st.size) },
        {
          frame: revealF,
          value: st.size,
          // Big accents pop with an overshoot; others settle with easeOut.
          easing: word.style === "A" ? { bezier: [0.34, 1.56, 0.64, 1] } : "easeOut",
        },
      ];
      const kf: WordKeyframes = { position, size, opacity, blur };
      w.keyframes = kf;
      created.push(w);
    });
  });

  return created;
};

// ---------------------------------------------------------------------------
// revealCaptionChunksTimed — snappy, speech-paced per-word reveal (Step 3).
//
// Same chunk-replacement layout as revealCaptionChunks, but the timing is driven
// by ASR: each chunk has an absolute spoken window [tStart,tEnd] and the English
// word ONSETS inside it. Every Russian word POPS (fast: opacity 0→1 + a small
// 0.86→1 scale over ~3 frames, NO de-blur, NO rise/drift) on a real speech onset,
// holds dead still until tEnd, then clears fast (~0.08s fade). This kills the slow
// blur/drift "float" and the "runs ahead" desync of the rescaled tSec version.
//
// Per-word onset assignment (per chunk, reading order j of n words, m onsets):
//   • m >= n  → sample n onsets evenly from the m (word j → onsets[round(j*(m-1)/(n-1))]).
//   • m <  n  → even spacing across the window (word j → tStart + (tEnd-tStart)*j/n).
// Each pick is clamped to leave a little hold before tEnd. This is the achievable
// per-word sync: paced to ENGLISH onsets, NOT a literal Russian-word↔audio map.
// ---------------------------------------------------------------------------

export const revealCaptionChunksTimed = (
  scene: Scene,
  chunks: CaptionChunkTimed[],
  opts: {
    fps: number;
    totalSec: number; // clip end (clamp the last chunk's tEnd)
    styleMap: Record<"n" | "s" | "a" | "A", CaptionStyle>;
    centerY: number; // band center, px offset from frame center (CONTRACT §2)
    maxLineWidth?: number; // px; wrap beyond this (default 900)
    lineGap?: number; // px between wrapped lines (default n.size*1.20, ref line-height)
    wordGap?: number; // px between words on a line (default 0.30*n.size ≈ ref 8/27px)
    revealDur?: number; // POP duration, sec (default 0.10 ≈ 3 frames)
    fadeDur?: number; // clear-out fade, sec (default 0.08)
    scaleIn?: number; // reveal start scale 0..1 (default 0.86)
    readFraction?: number; // words complete within this fraction of the window,
    // then the full line HOLDS for the rest (default 0.7). A chunk's window
    // [tStart,tEnd] runs to the NEXT caption's start, so it can spill past this
    // chunk's own spoken phrase into the next clause; the cap keeps the last word
    // from landing on an unrelated trailing onset and leaves real read-time.
    baselineK?: number; // baseline-share factor (fix #5): the words on a line share
    // a common BASELINE like the reference's `align-items:baseline`, instead of a
    // common vertical center. Glyph centers each word on its y, and a box's baseline
    // sits ≈baselineK*size BELOW that center, so to put every word on one baseline we
    // shift each word's y by baselineK*(normalSize - size): a larger accent moves UP
    // (grows above the caps), exactly like the reference. Tuned from a still (≈0.30).
    pauseGapSec?: number; // if the NEXT chunk starts > this many sec after this
    // chunk's phrase end, treat it as a real pause and clear at phrase_end+tail
    // instead of holding the line through silence (default 2.0).
    pauseTailSec?: number; // tail held past phrase end before clearing at a pause (0.5)
    measuredWidths?: Record<string, number>; // real px glyph widths keyed `${text}␟${style}`
    // (compose/word_widths.json from measure_words.ts); used for the absolute layout
    // in place of the len·size·k estimate (fix #4).
  }
): Word[] => {
  const { fps, totalSec, styleMap, centerY } = opts;
  const maxLineWidth = opts.maxLineWidth ?? 900;
  const normalSize = styleMap.n.size;
  const lineGap = opts.lineGap ?? round(normalSize * 1.2);
  const wordGap = opts.wordGap ?? round(normalSize * 0.3);
  const revealDur = opts.revealDur ?? 0.1;
  const fadeDur = opts.fadeDur ?? 0.08;
  const scaleIn = opts.scaleIn ?? 0.86;
  const readFraction = opts.readFraction ?? 0.7;
  const baselineK = opts.baselineK ?? 0.3;
  const pauseGapSec = opts.pauseGapSec ?? 2.0;
  const pauseTailSec = opts.pauseTailSec ?? 0.5;
  const measuredWidths = opts.measuredWidths;

  const revealF = Math.max(1, round(revealDur * fps));
  const fadeF = Math.max(1, round(fadeDur * fps));
  const created: Word[] = [];

  chunks.forEach((chunk, i) => {
    const tStart = chunk.tStart;
    // HOLD until the next line replaces this one (fix #1): the speech is continuous,
    // so a line should NOT blink off at its short phrase end — it holds to the next
    // chunk's tStart. chunk.tEnd carries the phrase end (from align_chunks). Only
    // when the next chunk is a real pause away (gap > pauseGapSec) do we clear at
    // phrase_end + tail rather than holding the caption through silence.
    const phraseEnd = chunk.tEnd;
    let tEnd: number;
    if (i === chunks.length - 1) {
      tEnd = Math.min(Math.max(phraseEnd, tStart) + pauseTailSec, totalSec); // last → clip end
    } else {
      const nextStart = chunks[i + 1].tStart;
      tEnd = nextStart - phraseEnd > pauseGapSec ? phraseEnd + pauseTailSec : nextStart;
    }
    const chunkStart = round(tStart * fps);
    const chunkEnd = round(tEnd * fps);

    // --- Layout: greedy line-pack, center each line, center the block on centerY
    // (identical algorithm to revealCaptionChunks). ---
    const cw = chunk.words.map((word) => {
      const st = styleMap[word.style];
      const display = st.case === "upper" ? word.text.toUpperCase() : word.text;
      // Prefer the REAL measured glyph width (compose/measure_words.ts) so absolute
      // layout matches the browser — even gaps, no phantom space around accents
      // (fix #4). Fall back to the len·size·k estimate only for unmeasured words.
      const measured = measuredWidths?.[`${word.text}␟${word.style}`];
      const w = measured ?? display.length * st.size * widthK(st.font);
      return { word, st, w };
    });

    type Lined = (typeof cw)[number] & { line: number };
    const lined: Lined[] = [];
    let line = 0;
    let lineW = 0;
    cw.forEach((entry, j) => {
      const add = (j === 0 ? 0 : wordGap) + entry.w;
      if (lineW > 0 && lineW + add > maxLineWidth) {
        line++;
        lineW = 0;
      }
      lined.push({ ...entry, line });
      lineW += (lineW > 0 ? wordGap : 0) + entry.w;
    });

    const lineCount = line + 1;
    const lineWidths: number[] = [];
    for (let l = 0; l < lineCount; l++) {
      const ws = lined.filter((e) => e.line === l);
      lineWidths[l] = ws.reduce((acc, e) => acc + e.w, 0) + wordGap * Math.max(0, ws.length - 1);
    }
    const blockTopCenter = centerY - ((lineCount - 1) * lineGap) / 2;
    const cursor: number[] = lineWidths.map((lw) => -lw / 2);

    lined.forEach((e) => {
      const bx = round(cursor[e.line] + e.w / 2);
      // Baseline share (fix #5): shift each word by baselineK*(normal-size) so all
      // words on the line sit on ONE baseline (like ref `align-items:baseline`); a
      // larger accent then extends above the caps instead of floating off-center.
      const by = round(blockTopCenter + e.line * lineGap + baselineK * (normalSize - e.st.size));
      cursor[e.line] += e.w + wordGap;
      (e as Lined & { bx: number; by: number }).bx = bx;
      (e as Lined & { bx: number; by: number }).by = by;
    });

    // --- Per-word ONSET (reading order j) ---
    // All words complete within [tStart, lastShowable], then the line holds.
    const n = lined.length;
    const lastShowable = Math.max(tStart, Math.min(tEnd - (revealDur + 0.05), tStart + readFraction * (tEnd - tStart)));
    // Onsets usable for the karaoke spread: those at/before lastShowable, but
    // always keep at least n (so n words land on n distinct real onsets).
    const inRange = chunk.onsets.filter((o) => o <= lastShowable + 1e-6);
    const pool = inRange.length >= n ? inRange : chunk.onsets.slice(0, Math.max(n, inRange.length));
    const m = pool.length;
    const onsetSec = (j: number): number => {
      let s: number;
      if (m >= n && m > 0) {
        const idx = n === 1 ? 0 : round((j * (m - 1)) / (n - 1)); // sample n onsets evenly from the pool
        s = pool[idx];
      } else {
        // fewer onsets than words → even spacing across the read span.
        s = tStart + (lastShowable - tStart) * (j / Math.max(1, n - 1));
      }
      return Math.min(Math.max(s, tStart), lastShowable);
    };

    // --- Create + keyframe each word ---
    lined.forEach((e, j) => {
      const ee = e as Lined & { bx: number; by: number };
      const { bx, by, st, word } = ee;
      const wordStart = Math.max(chunkStart, round(onsetSec(j) * fps));
      const wordEnd = chunkEnd + fadeF;
      const holdEnd = chunkEnd - wordStart; // word-relative frame the chunk ends
      const settle = Math.max(revealF, holdEnd);

      const w = addWord(scene, {
        text: word.text,
        start: wordStart,
        end: wordEnd,
        x: bx,
        y: by,
        font: st.font,
        size: st.size,
        weight: st.weight,
        color: st.color,
        case: st.case,
      });
      if (st.stroke) w.stroke = { color: st.stroke.color, width: st.stroke.width };
      if (st.shadow) w.shadow = st.shadow.map((s) => ({ ...s }));

      // Fast POP, then dead-still hold, then a quick clear. (rel=0 at wordStart.)
      const opacity: Keyframe<number>[] = [
        { frame: 0, value: 0 },
        { frame: revealF, value: 1, easing: "easeOut" },
        { frame: settle, value: 1 },
        { frame: settle + fadeF, value: 0, easing: "easeOut" },
      ];
      const size: Keyframe<number>[] = [
        { frame: 0, value: round(scaleIn * st.size) },
        {
          frame: revealF,
          value: st.size,
          // Big accents keep their overshoot punch — but at the same fast revealF.
          easing: word.style === "A" ? { bezier: [0.34, 1.56, 0.64, 1] } : "easeOut",
        },
      ];
      // No position track (static hold at bx,by) and no blur track (no de-blur).
      w.keyframes = { size, opacity };
      created.push(w);
    });
  });

  return created;
};

// staticCaption — a held, NON-karaoke caption block (e.g. the outro CTA). Same
// centered line-pack + baseline share + measured widths as revealCaptionChunksTimed,
// but every word appears together with one gentle opacity fade-in and then holds
// dead-still for the rest of the scene (no per-word pop, no fade-out). Coordinates
// are scene-relative (CONTRACT §3); start/end default to [0, sceneDuration].
export const staticCaption = (
  scene: Scene,
  words: ChunkWord[],
  opts: {
    fps: number;
    styleMap: Record<"n" | "s" | "a" | "A", CaptionStyle>;
    centerY: number;
    maxLineWidth?: number;
    lineGap?: number;
    wordGap?: number;
    baselineK?: number;
    measuredWidths?: Record<string, number>;
    fadeInSec?: number; // gentle entrance fade (default 0.3)
    startFrame?: number;
    endFrame?: number;
  }
): { words: Word[]; bounds: { cx: number; cy: number; width: number; height: number } } => {
  const { fps, styleMap, centerY } = opts;
  const normalSize = styleMap.n.size;
  const maxLineWidth = opts.maxLineWidth ?? 900;
  const lineGap = opts.lineGap ?? round(normalSize * 1.2);
  const wordGap = opts.wordGap ?? round(normalSize * 0.3);
  const baselineK = opts.baselineK ?? 0.3;
  const measuredWidths = opts.measuredWidths;
  const fadeInF = Math.max(1, round((opts.fadeInSec ?? 0.3) * fps));
  const startFrame = opts.startFrame ?? 0;
  const endFrame = opts.endFrame ?? scene.durationInFrames;

  // --- Layout: greedy line-pack, center each line, baseline-share the block ---
  const cw = words.map((word) => {
    const st = styleMap[word.style];
    const display = st.case === "upper" ? word.text.toUpperCase() : word.text;
    const measured = measuredWidths?.[`${word.text}␟${word.style}`];
    const w = measured ?? display.length * st.size * widthK(st.font);
    return { word, st, w };
  });

  type Lined = (typeof cw)[number] & { line: number };
  const lined: Lined[] = [];
  let line = 0;
  let lineW = 0;
  cw.forEach((entry, j) => {
    const add = (j === 0 ? 0 : wordGap) + entry.w;
    if (lineW > 0 && lineW + add > maxLineWidth) {
      line++;
      lineW = 0;
    }
    lined.push({ ...entry, line });
    lineW += (lineW > 0 ? wordGap : 0) + entry.w;
  });

  const lineCount = line + 1;
  const lineWidths: number[] = [];
  for (let l = 0; l < lineCount; l++) {
    const ws = lined.filter((e) => e.line === l);
    lineWidths[l] = ws.reduce((acc, e) => acc + e.w, 0) + wordGap * Math.max(0, ws.length - 1);
  }
  const blockTopCenter = centerY - ((lineCount - 1) * lineGap) / 2;
  const cursor: number[] = lineWidths.map((lw) => -lw / 2);

  const created: Word[] = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  lined.forEach((e) => {
    const bx = round(cursor[e.line] + e.w / 2);
    const by = round(blockTopCenter + e.line * lineGap + baselineK * (normalSize - e.st.size));
    cursor[e.line] += e.w + wordGap;
    const st = e.st;
    // Track the visual bounding box (cap ascent ≈0.62·size above the y anchor,
    // descent ≈0.42·size below) so a caller can size a plate behind the block.
    minX = Math.min(minX, bx - e.w / 2);
    maxX = Math.max(maxX, bx + e.w / 2);
    minY = Math.min(minY, by - 0.62 * st.size);
    maxY = Math.max(maxY, by + 0.42 * st.size);
    const w = addWord(scene, {
      text: e.word.text,
      start: startFrame,
      end: endFrame,
      x: bx,
      y: by,
      font: st.font,
      size: st.size,
      weight: st.weight,
      color: st.color,
      case: st.case,
    });
    if (st.stroke) w.stroke = { color: st.stroke.color, width: st.stroke.width };
    if (st.shadow) w.shadow = st.shadow.map((s) => ({ ...s }));
    // One gentle fade-in (rel=0 at startFrame), then hold at full opacity to end.
    w.keyframes = { opacity: [
      { frame: 0, value: 0 },
      { frame: fadeInF, value: 1, easing: "easeOut" },
    ] };
    created.push(w);
  });

  const bounds = {
    cx: round((minX + maxX) / 2),
    cy: round((minY + maxY) / 2),
    width: round(maxX - minX),
    height: round(maxY - minY),
  };
  return { words: created, bounds };
};
