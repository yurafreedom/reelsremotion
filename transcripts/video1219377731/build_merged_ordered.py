import json

# STEP 5 prep: emit the WHOLE conversation in timecode order, RU verbatim + EN
# tagged, so the English spans can be translated to Russian WITH the surrounding
# Russian context visible (spans are short and interleaved). One segment per line,
# blank line on >2.5s gaps (turn boundaries).
BASE = "transcripts/video1219377731"
segs = json.load(open(f"{BASE}/asr_video1219377731.json"))["segments"]

def mmss(s):
    return f"{int(s//3600)}:{int(s%3600//60):02d}:{int(s%60):02d}"

out = []
prev_end = None
for s in segs:
    sc = s["script"]
    tag = "EN" if sc == "en" else ("RU" if sc == "ru" else "??")
    if prev_end is not None and s["start"] - prev_end > 2.5:
        out.append("")
    out.append(f"[{mmss(s['start'])}][{tag}] {s['text']}")
    prev_end = s["end"]

open(f"{BASE}/merged_ordered.txt", "w").write("\n".join(out) + "\n")
en = sum(1 for s in segs if s["script"] == "en")
print(f"wrote merged_ordered.txt: {len(segs)} segments ({en} EN to translate)")
