import json, glob, time, datetime
from faster_whisper import WhisperModel

# STEP 4 helper: second pass with task="translate" (Whisper only translates X->English).
# Chunked, same as the native pass. We translate EVERY chunk: English segments pass
# through as English, non-English (Russian) segments come back translated to English.
# The English *version* is then built by MERGING on timecode against the native pass:
# native-English spans keep their real transcribed text; Russian spans take this
# translated text. Output here is the raw translate-pass JSON.
BASE   = "transcripts/video1219377731"
CHUNKS = sorted(glob.glob(f"{BASE}/chunks/chunk_*.wav"))
CHUNK_LEN = 900.0
OUTJ = f"{BASE}/asr_translate_en.json"
LOG  = f"{BASE}/translate.log"
TOTAL = 13974.421

logf = open(LOG, "w", buffering=1)
def log(m): logf.write(f"[{datetime.datetime.now():%H:%M:%S}] {m}\n")

t0 = time.time()
log(f"loading model small int8 cpu ... ({len(CHUNKS)} chunks) task=translate")
model = WhisperModel("small", device="cpu", compute_type="int8")
log(f"model loaded in {time.time()-t0:.1f}s. starting translate pass ...")

segs, words = [], []
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
        task="translate",     # -> English
    )
    n0 = len(segs)
    for s in segments:
        ws = [{"word": w.word.strip(), "start": round(w.start + off, 3),
               "end": round(w.end + off, 3)} for w in (s.words or [])]
        words += ws
        segs.append({"id": sidx, "start": round(s.start + off, 3),
                     "end": round(s.end + off, 3), "text": s.text.strip(),
                     "chunk": ci, "words": ws})
        sidx += 1
    json.dump({"task": "translate", "duration": TOTAL, "chunks_done": ci + 1,
               "segments": segs, "words": words},
              open(OUTJ, "w"), ensure_ascii=False, indent=2)
    el = time.time() - tstart
    done = min((ci + 1) * CHUNK_LEN, TOTAL)
    rate = done / el if el else 0
    eta = (TOTAL - done) / rate if rate else 0
    log(f"chunk {ci+1}/{len(CHUNKS)} done in {time.time()-ct0:.1f}s (+{len(segs)-n0} segs) "
        f"| {done/TOTAL*100:4.1f}% rate={rate:.2f}x eta={eta/60:5.1f}min")

el = time.time() - tstart
log(f"DONE. {len(segs)} segments, {len(words)} words in {el/60:.1f} min (rate {TOTAL/el:.2f}x)")
log("EXIT_OK")
print("EXIT_OK")
