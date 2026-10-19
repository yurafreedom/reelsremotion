from faster_whisper import WhisperModel
import json

# REEL 1 ASR (Step 1). Same pass as compose/asr.py, retargeted at the REEL 1
# source clip with AUTO-DETECTED language (the prompt: "auto-detect is fine").
# word_timestamps + vad_filter as specified. Writes compose/asr_reel1.json.
SRC = "public/media/reel1_source.mp4"
OUT = "compose/asr_reel1.json"

model = WhisperModel("small", device="cpu", compute_type="int8")
segments, info = model.transcribe(
    SRC,
    language=None,          # auto-detect
    word_timestamps=True,
    vad_filter=True,
    beam_size=5,
)
segs, words = [], []
for i, s in enumerate(segments):
    ws = [{"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)}
          for w in (s.words or [])]
    words += ws
    segs.append({"id": i, "start": round(s.start, 3), "end": round(s.end, 3),
                 "text": s.text.strip(), "words": ws})
json.dump({"language": info.language, "language_probability": round(info.language_probability, 3),
           "segments": segs, "words": words},
          open(OUT, "w"), ensure_ascii=False, indent=2)
print(f"lang={info.language} ({info.language_probability:.2f}), {len(segs)} segments, "
      f"{len(words)} words, clip~{(segs[-1]['end'] if segs else 0):.1f}s -> {OUT}\n")
for s in segs:
    print(f'{s["id"]:>2}  {s["start"]:>6.2f}-{s["end"]:>6.2f}  {s["text"]}')
