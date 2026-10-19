import json, re

# STEP 5 assembler: full Russian VERSION. Russian spans kept verbatim from the
# native pass; English spans replaced by the in-context RU translations (en_spans_ru.json,
# indexed by span id from en_spans_index.json). Reflow into paragraphs on >3s gaps.
BASE = "transcripts/video1219377731"
segs  = json.load(open(f"{BASE}/asr_video1219377731.json"))["segments"]
spans = json.load(open(f"{BASE}/en_spans_index.json"))          # [{id,a,b}]
ru    = json.load(open(f"{BASE}/en_spans_ru.json"))             # [str,...] by id

assert len(spans) == len(ru), f"span/translation count mismatch {len(spans)} vs {len(ru)}"
start_of = {s["a"]: s["id"] for s in spans}    # segment idx -> span id
end_idx  = {s["a"]: s["b"] for s in spans}     # span start idx -> span end idx

# build ordered units: (start, end, text)
units = []
i, n = 0, len(segs)
while i < n:
    if i in start_of:
        sid = start_of[i]
        b = end_idx[i]
        units.append((segs[i]["start"], segs[b]["end"], ru[sid].strip()))
        i = b + 1
    else:
        s = segs[i]
        if s["text"].strip():
            units.append((s["start"], s["end"], s["text"].strip()))
        i += 1

# reflow into paragraphs on >3s gaps
paras, cur, prev_end = [], [], None
for st, en, tx in units:
    if prev_end is not None and st - prev_end > 3.0 and cur:
        paras.append(" ".join(cur)); cur = []
    cur.append(tx); prev_end = en
if cur: paras.append(" ".join(cur))
paras = [re.sub(r"\s+", " ", p).strip() for p in paras if p.strip()]

open(f"{BASE}/transcript_RU_full.txt", "w").write("\n\n".join(paras) + "\n")
wc = sum(len(p.split()) for p in paras)
print(f"transcript_RU_full.txt: {len(units)} units -> {len(paras)} paragraphs, ~{wc} words")
