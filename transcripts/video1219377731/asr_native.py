import json, os, glob, time, datetime
from faster_whisper import WhisperModel

# NATIVE ASR pass for episode video1219377731 (~3h53m, bilingual RU/EN expected).
# CHUNKED: this is an 8 GB machine and faster-whisper builds the full-file log-mel
# in RAM up front -> a 4h file thrashes swap and never finishes. So we split the
# audio into 15-min chunks (done via ffmpeg) and transcribe each, offsetting all
# timestamps by the chunk start. Per-window language detection (multilingual=True)
# still works inside each chunk, so RU/EN is detected natively. DO NOT force a lang.
BASE   = "transcripts/video1219377731"
CHUNKS = sorted(glob.glob(f"{BASE}/chunks/chunk_*.wav"))
CHUNK_LEN = 900.0            # ffmpeg -segment_time
OUTJ = f"{BASE}/asr_video1219377731.json"
OUTS = f"{BASE}/subtitles_native.srt"
LOG  = f"{BASE}/transcribe.log"
TOTAL = 13974.421

logf = open(LOG, "w", buffering=1)
def log(m):
    logf.write(f"[{datetime.datetime.now():%H:%M:%S}] {m}\n")

t0 = time.time()
log(f"loading model small int8 cpu ... ({len(CHUNKS)} chunks)")
model = WhisperModel("small", device="cpu", compute_type="int8")
log(f"model loaded in {time.time()-t0:.1f}s. starting chunked transcribe ...")


def script_of(text):
    cyr = sum(1 for c in text if "Ѐ" <= c <= "ӿ")
    lat = sum(1 for c in text if "a" <= c.lower() <= "z")
    if cyr > lat: return "ru"
    if lat > cyr: return "en"
    return "?"


def ts(sec):
    h = int(sec // 3600); m = int((sec % 3600) // 60)
    s = int(sec % 60); ms = int(round((sec - int(sec)) * 1000))
    if ms == 1000: s += 1; ms = 0
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


segs, words = [], []
srt = open(OUTS, "w")
sidx = 0
tstart = time.time()
for ci, cf in enumerate(CHUNKS):
    off = ci * CHUNK_LEN
    ct0 = time.time()
    segments, info = model.transcribe(
        cf,
        language=None,
        multilingual=True,
        word_timestamps=True,
        vad_filter=True,
        beam_size=5,
        task="transcribe",
    )
    n_before = len(segs)
    for s in segments:
        ws = [{"word": w.word.strip(), "start": round(w.start + off, 3),
               "end": round(w.end + off, 3)} for w in (s.words or [])]
        words += ws
        lang = getattr(s, "language", None) or script_of(s.text)
        rec = {"id": sidx, "start": round(s.start + off, 3),
               "end": round(s.end + off, 3), "text": s.text.strip(),
               "lang": lang, "script": script_of(s.text), "chunk": ci, "words": ws}
        segs.append(rec)
        srt.write(f"{sidx+1}\n{ts(rec['start'])} --> {ts(rec['end'])}\n{rec['text']}\n\n")
        srt.flush()
        sidx += 1
    # checkpoint JSON each chunk so partial work survives a crash
    json.dump({"language": "auto", "duration": TOTAL,
               "chunks_done": ci + 1, "segments": segs, "words": words},
              open(OUTJ, "w"), ensure_ascii=False, indent=2)
    el = time.time() - tstart
    done_audio = min((ci + 1) * CHUNK_LEN, TOTAL)
    rate = done_audio / el if el else 0
    eta = (TOTAL - done_audio) / rate if rate else 0
    log(f"chunk {ci+1}/{len(CHUNKS)} done in {time.time()-ct0:.1f}s "
        f"(+{len(segs)-n_before} segs) | overall {done_audio/TOTAL*100:4.1f}% "
        f"rate={rate:.2f}x eta={eta/60:5.1f}min")

srt.close()
from collections import defaultdict
secs = defaultdict(float); cnt = defaultdict(int)
for s in segs:
    secs[s["script"]] += s["end"] - s["start"]; cnt[s["script"]] += 1
json.dump({"language": "auto", "duration": TOTAL, "chunks_done": len(CHUNKS),
           "segments": segs, "words": words},
          open(OUTJ, "w"), ensure_ascii=False, indent=2)
el = time.time() - tstart
log(f"DONE. {len(segs)} segments, {len(words)} words in {el/60:.1f} min "
    f"(rate {TOTAL/el:.2f}x)")
for k in sorted(secs, key=lambda x: -secs[x]):
    log(f"  script={k}: {cnt[k]} segs, {secs[k]:.1f}s ({secs[k]/60:.1f} min)")
log("EXIT_OK")
print("EXIT_OK")
