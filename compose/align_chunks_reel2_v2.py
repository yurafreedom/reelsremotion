#!/usr/bin/env python3
# align_chunks_reel2_v2.py — Phase C step 3 (re-align on the re-cut). Same windowing
# algorithm as align_chunks_reel2.py, but retargeted at the TIGHTENED v2 audio.
#
# How: chunks_timed_reel2.json already locks every chunk to its real SOURCE spoken
# window. Here we keep only the surviving chunks (Q 1-9 + Safir 25-49), push each
# chunk's source tStart through the deterministic re-cut time map
# (compose/recut_map_reel2.json) to its v2 time, then SNAP that to the nearest real
# v2 ASR word onset (compose/asr_reel2_v2.json) so the per-word reveals ride the
# actual tightened audio. tEnd = next chunk's tStart (HOLD till replaced); v2 has no
# pause >0.31s so nothing clears early. RU text + n/s/a/A come straight from
# compose/chunks_ru_reel2_v2.json — UNCHANGED.
import json

MAP = json.load(open("compose/recut_map_reel2.json"))
asr = json.load(open("compose/asr_reel2_v2.json"))
ru  = json.load(open("compose/chunks_ru_reel2_v2.json"))
src_timed = json.load(open("compose/chunks_timed_reel2.json"))
OUT = "compose/chunks_timed_reel2_v2.json"

CLIP_SEC = round(max(w["end"] for w in asr["words"]), 3)   # last v2 ASR word end
onsets  = sorted(w["start"] for w in asr["words"])
en_by_onset = {round(w["start"], 3): w["word"] for w in asr["words"]}

# Surviving SOURCE chunks: indices 0-8 (Q 1-9) + 24-48 (Safir 25-49).
KEEP_IDX = list(range(0, 9)) + list(range(24, 49))
assert len(KEEP_IDX) == len(ru), f"{len(KEEP_IDX)} kept vs {len(ru)} ru chunks"


def src_to_v2(x):
    """Map a source-time onset into v2 time via the piecewise re-cut map. A source
    time inside a kept interval maps linearly; one in a trimmed gap clamps to the
    nearest kept-interval edge."""
    keep = MAP["keep"]
    for k in keep:
        if k["src0"] - 1e-6 <= x <= k["src1"] + 1e-6:
            return k["v2_0"] + (x - k["src0"])
    # in a removed gap: clamp to nearest edge
    best = min(keep, key=lambda k: min(abs(x - k["src0"]), abs(x - k["src1"])))
    if abs(x - best["src0"]) < abs(x - best["src1"]):
        return best["v2_0"]
    return best["v2_0"] + best["dur"]


def snap(values, t):
    return min(values, key=lambda o: abs(o - t))


def parse_word(tok):
    text, style = tok.rsplit(" ", 1)
    assert style in ("n", "s", "a", "A"), f"bad style in {tok!r}"
    return {"text": text, "style": style}


# Pass 1: v2 tStart per surviving chunk = map(source tStart) snapped to a real v2 onset.
rows = []
for j, idx in enumerate(KEEP_IDX):
    src_ts = src_timed[idx]["tStart"]
    v2_ts = snap(onsets, src_to_v2(src_ts))
    rows.append({"tStart": v2_ts, "words": [parse_word(t) for t in ru[j]], "src_idx": idx})

# Keep strictly increasing (snap collisions -> next onset).
for i in range(1, len(rows)):
    if rows[i]["tStart"] <= rows[i - 1]["tStart"] + 1e-6:
        after = [o for o in onsets if o > rows[i - 1]["tStart"] + 1e-6]
        rows[i]["tStart"] = after[0] if after else rows[i - 1]["tStart"] + 0.1

# Pass 2: windows. tEnd = next tStart (hold till replaced); onsets = v2 words inside.
for i, r in enumerate(rows):
    r["tEnd"] = rows[i + 1]["tStart"] if i + 1 < len(rows) else CLIP_SEC
    if r["tEnd"] <= r["tStart"]:
        r["tEnd"] = r["tStart"] + 0.2
    r["onsets"] = [o for o in onsets if r["tStart"] - 1e-6 <= o < r["tEnd"] - 1e-6]

# Review table
print(f"\nREEL 2 v2 re-align — tightened audio. CLIP_SEC={CLIP_SEC}s, {len(rows)} chunks\n")
print(f'{"#":>2} {"src#":>4} {"tStart-tEnd":>14}  {"RU":<34} spoken words in window')
for i, r in enumerate(rows):
    rt = " ".join(w["text"] for w in r["words"]); rt = rt if len(rt) <= 33 else rt[:31] + "…"
    sp = " ".join(en_by_onset.get(round(o, 3), "?") for o in r["onsets"])
    sp = sp if len(sp) <= 50 else sp[:48] + "…"
    print(f'{i+1:>2} {r["src_idx"]+1:>4} {r["tStart"]:>6.2f}-{r["tEnd"]:<7.2f}  {rt:<34} {sp}')

out = [{"tStart": round(r["tStart"], 3), "tEnd": round(r["tEnd"], 3),
        "onsets": [round(o, 3) for o in r["onsets"]], "words": r["words"]} for r in rows]
json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=2)
print(f"\nwrote {OUT} ({len(out)} chunks)  span {out[0]['tStart']}-{out[-1]['tEnd']}s")
