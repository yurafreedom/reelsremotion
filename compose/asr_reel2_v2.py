from faster_whisper import WhisperModel
import json

# REEL 2 ASR (Step 1). Same faster-whisper pass as asr_reel1.py, retargeted at the
# REEL 2 source. REEL 2 is BILINGUAL: the guest speaks English, but the "women
# usually want everything at once…" beat is spoken in Russian (Evgenia). So we
# DO NOT force a language — multilingual=True makes faster-whisper detect the
# language on every window, so the Russian beat is transcribed (and timestamped)
# natively in Russian while the rest stays English.
# word_timestamps + vad_filter as specified. Writes compose/asr_reel2_v2.json.
SRC = "public/media/reel2_source_v2.mp4"
OUT = "compose/asr_reel2_v2.json"

model = WhisperModel("small", device="cpu", compute_type="int8")
segments, info = model.transcribe(
    SRC,
    language=None,          # auto-detect (overall)
    multilingual=True,      # per-window language detection → bilingual EN/RU
    word_timestamps=True,
    vad_filter=True,
    beam_size=5,
)


def script_of(text):
    # Quick script classifier so we can CONFIRM the Russian beat without relying on
    # a per-segment language field: Cyrillic vs Latin letter majority.
    cyr = sum(1 for c in text if "Ѐ" <= c <= "ӿ")
    lat = sum(1 for c in text if ("a" <= c.lower() <= "z"))
    if cyr > lat:
        return "ru"
    if lat > cyr:
        return "en"
    return "?"


segs, words = [], []
for i, s in enumerate(segments):
    ws = [{"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)}
          for w in (s.words or [])]
    words += ws
    lang = getattr(s, "language", None) or script_of(s.text)
    segs.append({"id": i, "start": round(s.start, 3), "end": round(s.end, 3),
                 "text": s.text.strip(), "lang": lang, "script": script_of(s.text),
                 "words": ws})

json.dump({"language": info.language, "language_probability": round(info.language_probability, 3),
           "segments": segs, "words": words},
          open(OUT, "w"), ensure_ascii=False, indent=2)

print(f"overall lang={info.language} ({info.language_probability:.2f}), {len(segs)} segments, "
      f"{len(words)} words, clip~{(segs[-1]['end'] if segs else 0):.1f}s -> {OUT}\n")
for s in segs:
    print(f'{s["id"]:>2}  {s["start"]:>6.2f}-{s["end"]:>6.2f}  [{s["script"]}]  {s["text"]}')

ru = [s for s in segs if s["script"] == "ru"]
print(f'\nRussian-script segments: {len(ru)}  '
      f'(window {ru[0]["start"]:.1f}-{ru[-1]["end"]:.1f}s)' if ru else '\nNo Russian segments detected!')
