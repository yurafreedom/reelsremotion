import json, re

# STEP 4 builder: assemble the all-English VERSION by merging the two passes on
# timecode.
#   native  = asr_video1219377731.json (task=transcribe, per-seg script tag)
#   trans   = asr_translate_en.json    (task=translate -> English everywhere)
# Rule: English-as-spoken spans keep their REAL transcribed English (native pass);
# every other span takes the translated English. We never overwrite real English
# with a round-tripped translation.
#
# Union-by-midpoint merge (loss-free, no double coverage):
#   - keep every native-EN segment (real English, real timing)
#   - keep every translate segment whose MIDPOINT is NOT inside a native-EN window
#     (these cover the Russian spans + any gaps, in English)
#   - sort the union by start time
BASE = "transcripts/video1219377731"
native = json.load(open(f"{BASE}/asr_video1219377731.json"))["segments"]
trans  = json.load(open(f"{BASE}/asr_translate_en.json"))["segments"]

en_windows = [(s["start"], s["end"]) for s in native if s["script"] == "en"]
en_windows.sort()

def in_en(t):
    for a, b in en_windows:
        if a <= t <= b:
            return True
        if a > t:
            break
    return False

merged = []
for s in native:
    if s["script"] == "en":
        merged.append({"start": s["start"], "end": s["end"], "text": s["text"], "src": "en-native"})
for s in trans:
    mid = (s["start"] + s["end"]) / 2
    if not in_en(mid) and s["text"].strip():
        merged.append({"start": s["start"], "end": s["end"], "text": s["text"], "src": "translated"})
merged.sort(key=lambda x: x["start"])

# ---- subtitles_en.srt ----
def ts(sec):
    h=int(sec//3600); m=int(sec%3600//60); s=int(sec%60); ms=int(round((sec-int(sec))*1000))
    if ms==1000: s+=1; ms=0
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
with open(f"{BASE}/subtitles_en.srt","w") as f:
    for i,s in enumerate(merged):
        f.write(f"{i+1}\n{ts(s['start'])} --> {ts(s['end'])}\n{s['text']}\n\n")

# ---- flowing text with paragraph breaks on >3s time gaps ----
full = " ".join(s["text"] for s in merged)
full = re.sub(r"\s+"," ",full).strip()
paras=[]; cur=[]; prev_end=None
for s in merged:
    if prev_end is not None and s["start"]-prev_end > 3.0 and cur:
        paras.append(" ".join(cur)); cur=[]
    cur.append(s["text"]); prev_end=s["end"]
if cur: paras.append(" ".join(cur))
paras=[re.sub(r"\s+"," ",p).strip() for p in paras if p.strip()]
with open(f"{BASE}/transcript_full_clean.txt","w") as f:
    f.write("\n\n".join(paras)+"\n")

# ---- one sentence per line ----
sents = re.split(r'(?<=[.!?…])\s+', full)
sents = [x.strip() for x in sents if x.strip()]
with open(f"{BASE}/transcript_readable.txt","w") as f:
    f.write("\n".join(sents)+"\n")

words = sum(len(s["text"].split()) for s in merged)
print(f"merged segments: {len(merged)} "
      f"({sum(1 for s in merged if s['src']=='en-native')} en-native, "
      f"{sum(1 for s in merged if s['src']=='translated')} translated)")
print(f"words: {words}, sentences: {len(sents)}, paragraphs: {len(paras)}")
