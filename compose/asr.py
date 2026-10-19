from faster_whisper import WhisperModel
import json

# "small" is accurate enough for a 52s clip; int8/cpu is safe on macOS (no CUDA).
model = WhisperModel("small", device="cpu", compute_type="int8")
segments, info = model.transcribe(
    "public/media/Reels.mp4",
    language="en", word_timestamps=True, beam_size=5, vad_filter=True,
)
segs, words = [], []
for i, s in enumerate(segments):
    ws = [{"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)}
          for w in (s.words or [])]
    words += ws
    segs.append({"id": i, "start": round(s.start, 3), "end": round(s.end, 3),
                 "text": s.text.strip(), "words": ws})
json.dump({"segments": segs, "words": words}, open("compose/asr_words.json", "w"),
          ensure_ascii=False, indent=2)
print(f"lang={info.language} ({info.language_probability:.2f}), {len(segs)} segments, "
      f"{len(words)} words, clip≈{(segs[-1]['end'] if segs else 0):.1f}s\n")
for s in segs:
    print(f'{s["id"]:>2}  {s["start"]:>6.2f}–{s["end"]:>6.2f}  {s["text"]}')
