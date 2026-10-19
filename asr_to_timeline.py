#!/usr/bin/env python3
"""
asr_to_timeline.py — ASR stage of the reels pipeline.

audio/video -> faster-whisper word timings -> draft timeline.json (CONTRACT schema).

This is the THIRD independent component (see claude-code-CONTRACT.md §7):
  - ASR (this)      owns: word `text` + `start` (facts from the audio).
  - click-tool      owns: `x,y` positions + accents (color/font/weight/case).
  - engine          owns: the render.

Output is a DRAFT: timings are real, positions/style are placeholders you
refine later in click-tool. The point is to never hand-type start/end again.

CRITICAL (from CONTRACT §3):
  - All times in the output are in FRAMES: frame = round(seconds * fps).
  - Word `start`/`end` are SCENE-RELATIVE (the engine sequences scenes and
    offsets each one; see src/Scene.tsx / src/Root.tsx).
  - In this style words ACCUMULATE and hang until the scene ends, so by default
    (`--hold`) end = the scene's durationInFrames. We do NOT set end = the word's
    spoken end.

Usage:
    python asr_to_timeline.py input.mp4 --fps 30
    python asr_to_timeline.py input.wav --group segment --scene single
    python asr_to_timeline.py input.mp4 --words-only --out words.json

Scope is v1 (see spec). No WhisperX/forced-alignment, no diarization, no
translation, no accent detection, no smart layout, no GUI.
"""

import argparse
import json
import sys

# ---------------------------------------------------------------------------
# Placeholder defaults for everything ASR does not own (CONTRACT §4 / spec).
# These are deliberately "draft" values; real positions/accents come from
# click-tool. Keep the keys/enums exactly as in the contract.
# ---------------------------------------------------------------------------
DEFAULT_FONT = "cleanSans"      # FontKey: 'condensedHeavy' | 'cleanSans'
DEFAULT_SIZE = 44               # px
DEFAULT_WEIGHT = 400            # 400 | 700 | 800
DEFAULT_COLOR = "#ffffff"       # white; red accent (#c0182a) is editorial -> click-tool
DEFAULT_CASE = "none"           # TextCase: 'upper' | 'lower' | 'none'
DEFAULT_BACKGROUND = "#1a1a1a"

FRAME_W = 1080
FRAME_H = 1920

# Stack layout (placeholder): centered column, first word near the top,
# stepping down by ~size*1.4 so words don't overlap. Real x/y -> click-tool.
STACK_X = 0
STACK_Y_START = -200
STACK_STEP = round(DEFAULT_SIZE * 1.4)   # ~62 px

# Tail padding (frames) added after the last spoken word so the scene doesn't
# cut the instant speech stops.
DEFAULT_TAIL = 15

# enterFrom alternates per word so words slide in from alternating sides,
# matching the reference style.
ENTER_CYCLE = ("left", "right")

# Placeholder video inset stamped on every scene (CONTRACT §6: "placeholder"
# renders a rectangle, render never fails without a real file). Real clip -> Phase 2.
PLACEHOLDER_VIDEO = {
    "src": "placeholder",
    "x": 0,
    "y": 0,
    "width": 880,
    "height": 500,
    "borderRadius": 20,
    "startFrom": 0,
}


def sec_to_frame(sec, fps):
    """CONTRACT §3: frame = round(seconds * fps)."""
    return round(sec * fps)


def build_word(text, start_frame, end_frame, index):
    """One Word record with real timings + placeholder style/layout."""
    return {
        "text": text,
        "start": start_frame,
        "end": end_frame,
        "x": STACK_X,
        "y": STACK_Y_START + index * STACK_STEP,
        "font": DEFAULT_FONT,
        "size": DEFAULT_SIZE,
        "weight": DEFAULT_WEIGHT,
        "color": DEFAULT_COLOR,
        "enterFrom": ENTER_CYCLE[index % len(ENTER_CYCLE)],
        "case": DEFAULT_CASE,
    }


def transcribe(input_path, model_name, lang):
    """
    Run faster-whisper and return a list of segments, each:
        {"start": float, "end": float,
         "words": [{"text": str, "start": float, "end": float}, ...]}

    Times are in SECONDS here; conversion to frames happens downstream.
    """
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit(
            "ERROR: faster-whisper is not installed.\n"
            "  pip install faster-whisper\n"
            "(First run also downloads the model, ~1.5 GB for 'medium'.)"
        )

    # int8 on CPU keeps medium under ~1.5-2.5 GB peak on an 8 GB M1.
    # Do NOT run this alongside a Remotion render or you'll swap.
    model = WhisperModel(model_name, device="cpu", compute_type="int8")

    # vad_filter trims silence -> tighter, more accurate word timings + faster.
    # language=None lets whisper auto-detect.
    segments_iter, info = model.transcribe(
        input_path,
        word_timestamps=True,
        vad_filter=True,
        language=lang,
    )

    print(
        f"[asr] detected language={info.language} "
        f"(p={info.language_probability:.2f})",
        file=sys.stderr,
    )

    segments = []
    for seg in segments_iter:
        words = []
        for w in (seg.words or []):
            text = (w.word or "").strip()
            if not text:
                continue
            words.append({"text": text, "start": w.start, "end": w.end})
        if not words:
            continue
        segments.append({"start": seg.start, "end": seg.end, "words": words})
    return segments


def group_segment_words(seg_words, group):
    """
    Apply --group to one segment's word list.
      word    -> one record per word: [(text, start_sec, end_sec), ...]
      segment -> a single record, text = joined phrase, start = first word's
                 start, end = last word's end.
    Returns a list of (text, start_sec, end_sec) tuples.
    """
    if group == "segment":
        text = " ".join(w["text"] for w in seg_words)
        return [(text, seg_words[0]["start"], seg_words[-1]["end"])]
    # group == "word"
    return [(w["text"], w["start"], w["end"]) for w in seg_words]


def merge_speech_regions(records, anchor, fps, gap_frames):
    """
    Scene-relative SPEECH regions for the inset (CONTRACT §4 / §7): the SPOKEN
    word intervals (real `end`, not the held subtitle end), merged when they
    overlap or sit within `gap_frames` of each other. This is FROZEN ASR output
    that drives music ducking — independent of the editable subtitle timings.
    """
    intervals = []
    for (_text, start_sec, end_sec) in records:
        sf = max(0, sec_to_frame(start_sec, fps) - anchor)
        ef = max(sf + 1, sec_to_frame(end_sec, fps) - anchor)
        intervals.append((sf, ef))
    intervals.sort()

    merged = []
    for sf, ef in intervals:
        if merged and sf <= merged[-1][1] + gap_frames:
            merged[-1] = (merged[-1][0], max(merged[-1][1], ef))
        else:
            merged.append((sf, ef))
    return [{"startFrame": a, "endFrame": b} for a, b in merged]


def make_scene(scene_id, records, fps, hold, tail, speech_gap_frames):
    """
    Build one Scene from a flat list of (text, start_sec, end_sec) records.

    Frames are made SCENE-RELATIVE: the scene is anchored at the first record's
    start, so the first word pops near frame 0 and end values stay small
    (matching the engine's per-scene <Sequence> offset).
    """
    anchor = sec_to_frame(records[0][1], fps)
    last_end = max(sec_to_frame(r[2], fps) for r in records)
    duration = max(1, last_end - anchor + tail)

    words = []
    for i, (text, start_sec, end_sec) in enumerate(records):
        start_f = max(0, sec_to_frame(start_sec, fps) - anchor)
        if hold:
            # Words accumulate and hang until the scene ends (CONTRACT §3).
            end_f = duration
        else:
            end_f = max(start_f + 1, sec_to_frame(end_sec, fps) - anchor)
        words.append(build_word(text, start_f, end_f, i))

    video = dict(PLACEHOLDER_VIDEO)
    # Frozen speech map from the REAL spoken intervals (not the held word ends).
    video["speechRegions"] = merge_speech_regions(records, anchor, fps, speech_gap_frames)

    return {
        "id": scene_id,
        "durationInFrames": duration,
        "video": video,
        "words": words,
    }


def build_scenes(segments, fps, group, scene, hold, tail, speech_gap_frames):
    """Turn ASR segments into Scene dicts per --scene / --group."""
    scenes = []

    if scene == "single":
        # One scene, all words. Anchor at the very first word -> absolute timing
        # (relative to frame 0) is preserved for the whole clip.
        records = []
        for seg in segments:
            records.extend(group_segment_words(seg["words"], group))
        if not records:
            return scenes
        records.sort(key=lambda r: r[1])
        scenes.append(make_scene("s1", records, fps, hold, tail, speech_gap_frames))
        return scenes

    # scene == "segment": one scene per whisper segment (phrase).
    for idx, seg in enumerate(segments, start=1):
        records = group_segment_words(seg["words"], group)
        if not records:
            continue
        scenes.append(make_scene(f"s{idx}", records, fps, hold, tail, speech_gap_frames))
    return scenes


def build_timeline(scenes, fps):
    """Full Timeline object per CONTRACT §4."""
    return {
        "fps": fps,
        "width": FRAME_W,
        "height": FRAME_H,
        "background": DEFAULT_BACKGROUND,
        "audio": None,
        "scenes": scenes,
    }


def parse_args(argv):
    p = argparse.ArgumentParser(
        description="ASR -> draft timeline.json (faster-whisper word timings).",
    )
    p.add_argument("input", help="input mp4 or wav (faster-whisper decodes via ffmpeg)")
    p.add_argument("--fps", type=int, default=30, help="frames per second (default 30)")
    p.add_argument("--lang", default="ru",
                   help='language code, or "auto" to detect (default ru)')
    p.add_argument("--model", default="medium",
                   help="faster-whisper model size (default medium)")
    p.add_argument("--group", choices=["word", "segment"], default="word",
                   help="one record per word, or one phrase per whisper segment "
                        "(default word)")
    p.add_argument("--scene", choices=["single", "segment"], default="segment",
                   help="one scene for the whole clip, or one scene per whisper "
                        "segment (default segment)")
    p.add_argument("--hold", action=argparse.BooleanOptionalAction, default=True,
                   help="word end = its scene's durationInFrames (default on). "
                        "--no-hold sets end = spoken end of the word.")
    p.add_argument("--tail", type=int, default=DEFAULT_TAIL,
                   help=f"extra frames after the last word per scene "
                        f"(default {DEFAULT_TAIL})")
    p.add_argument("--speech-gap", type=float, default=0.3,
                   help="merge spoken intervals within this many SECONDS into one "
                        "video.speechRegions entry (default 0.3)")
    p.add_argument("--out", default="timeline.draft.json",
                   help="output path (default timeline.draft.json)")
    p.add_argument("--words-only", action="store_true",
                   help="write only [{id, words}] per scene instead of a full Timeline")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(sys.argv[1:] if argv is None else argv)

    lang = None if args.lang.lower() == "auto" else args.lang

    print(f"[asr] transcribing {args.input} (model={args.model}, lang={args.lang})...",
          file=sys.stderr)
    segments = transcribe(args.input, args.model, lang)
    if not segments:
        sys.exit("ERROR: no speech found (empty transcription).")

    speech_gap_frames = sec_to_frame(args.speech_gap, args.fps)
    scenes = build_scenes(segments, args.fps, args.group, args.scene,
                          args.hold, args.tail, speech_gap_frames)
    if not scenes:
        sys.exit("ERROR: produced no scenes.")

    if args.words_only:
        payload = [{"id": s["id"], "words": s["words"]} for s in scenes]
    else:
        payload = build_timeline(scenes, args.fps)

    # ensure_ascii=False keeps Cyrillic readable in the file.
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")

    n_words = sum(len(s["words"]) for s in scenes)
    print(f"[asr] wrote {args.out}: {len(scenes)} scene(s), {n_words} word record(s).",
          file=sys.stderr)


# TODO v2: optional forced-alignment pass (WhisperX / wav2vec2) over this same
# faster-whisper output if word boundaries aren't tight enough for pop-in.
# Load stages sequentially, no diarization (8 GB memory budget). Not now.

if __name__ == "__main__":
    main()
