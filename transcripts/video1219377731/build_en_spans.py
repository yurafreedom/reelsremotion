import json

# Extract the 96 contiguous English spans (consecutive EN segments merged), each
# with an ID, timecode range, merged English text, and the 2 Russian segments of
# context immediately before/after. These IDs are what the RU translations map to.
BASE = "transcripts/video1219377731"
segs = json.load(open(f"{BASE}/asr_video1219377731.json"))["segments"]

def mmss(s): return f"{int(s//3600)}:{int(s%3600//60):02d}:{int(s%60):02d}"

# group into contiguous EN spans
spans = []  # (start_idx, end_idx)
i = 0
n = len(segs)
while i < n:
    if segs[i]["script"] == "en":
        j = i
        while j < n and segs[j]["script"] == "en":
            j += 1
        spans.append((i, j - 1))
        i = j
    else:
        i += 1

lines = []
for k, (a, b) in enumerate(spans):
    txt = " ".join(segs[m]["text"] for m in range(a, b + 1)).strip()
    # RU context: nearest preceding + following non-EN segment
    pre = next((segs[m]["text"] for m in range(a - 1, -1, -1) if segs[m]["script"] != "en"), "")
    post = next((segs[m]["text"] for m in range(b + 1, n) if segs[m]["script"] != "en"), "")
    lines.append(f"### SPAN {k:03d}  [{mmss(segs[a]['start'])}-{mmss(segs[b]['end'])}]")
    if pre:  lines.append(f"  (RU before: {pre[-90:]})")
    lines.append(f"  EN: {txt}")
    if post: lines.append(f"  (RU after: {post[:90]})")
    lines.append("")

open(f"{BASE}/en_spans.txt", "w").write("\n".join(lines))
print(f"{len(spans)} EN spans -> en_spans.txt")
# also dump machine-readable span index for the assembler
json.dump([{"id": k, "a": a, "b": b} for k, (a, b) in enumerate(spans)],
          open(f"{BASE}/en_spans_index.json", "w"))
