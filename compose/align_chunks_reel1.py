#!/usr/bin/env python3
# align_chunks_reel1.py — Step 2 for REEL 1. Same algorithm as align_chunks.py
# (snap each chunk to its real spoken ASR window, sort by tStart, derive the
# on-screen window + per-word English onsets), retargeted at REEL 1.
#
# REEL 1 reality: the source clip is ALREADY in narrative/audio order, so the
# alignment is NEAR-IDENTITY — every chunk maps, in order, to the next spoken
# English phrase it translates. No reorder is expected; the >0.5s flag in the dump
# would catch any chunk that snapped far from its anchor.
#
#   RU text + n/s/a/A styles come straight from compose/chunks_ru_reel1.json
#   (faithful translation — NEVER reworded/restyled here). Only the per-chunk
#   (sem, semEnd) anchors live in this script; they were read off the ASR word
#   table (compose/asr_reel1.json) — the onset of the English phrase each line
#   translates and that phrase's last English word offset.
#
# Writes compose/chunks_timed_reel1.json and prints the review table.

import json

ASR  = "compose/asr_reel1.json"
RU   = "compose/chunks_ru_reel1.json"
OUT  = "compose/chunks_timed_reel1.json"

asr = json.load(open(ASR))
CLIP_SEC = round(max(w["end"] for w in asr["words"]), 2)   # last ASR word end
FLICKER  = 0.04           # < ~1 frame @30fps
PAUSE    = 2.0            # > this gap to next chunk = a real pause (clear at phrase end)
TAIL     = 0.5            # tail held past phrase end at a pause

# ── (sem, semEnd) anchors per chunk, in narrative order, read off asr_reel1.json.
# English gloss noted; these are the spoken window each RU line translates. ──────
ANCHORS = [
    (0.02,  1.06,  "We were close"),                                   # 1
    (1.06,  2.48,  "to killing each other"),                           # 2
    (2.58,  4.88,  "but we somehow made it"),                          # 3
    (4.88,  6.08,  "until this day"),                                  # 4
    (6.66,  8.08,  "There was fear"),                                  # 5
    (8.08,  13.44, "of revealing who we really were to each other"),   # 6
    (13.80, 17.02, "not being enough"),                                # 7
    (17.42, 19.08, "It's difficult to reveal your truth"),             # 8
    (19.08, 20.82, "when you first meet someone"),                     # 9
    (20.90, 23.70, "because they haven't proven themselves to you yet"),# 10
    (23.86, 26.12, "and you haven't proven yourself to them"),         # 11
    (26.58, 29.70, "but is it safe to reveal the truth"),              # 12
    (30.64, 32.24, "I think that safety"),                             # 13
    (32.24, 33.40, "is very important"),                               # 14
    (33.80, 36.38, "whether you are a man, whether you're a woman"),    # 15
    (37.02, 39.14, "whether you're dominant or submissive"),           # 16
    (40.62, 43.74, "Successful, it doesn't matter"),                   # 17
    (44.46, 46.96, "That safety is still incredibly important"),       # 18
]

# RU text/styles from the JSON. Each token is "text… style" (style = last word);
# multi-word accents stay one token (split on the LAST space only).
ru_chunks = json.load(open(RU))
assert len(ru_chunks) == len(ANCHORS), f"{len(ru_chunks)} chunks vs {len(ANCHORS)} anchors"

def parse_word(tok):
    text, style = tok.rsplit(" ", 1)
    assert style in ("n", "s", "a", "A"), f"bad style in {tok!r}"
    return {"text": text, "style": style}

onsets  = sorted(w["start"] for w in asr["words"])
offsets = sorted(w["end"]   for w in asr["words"])
en_by_onset = {round(w["start"], 3): w["word"] for w in asr["words"]}

def snap(values, t):
    return min(values, key=lambda o: abs(o - t))

# ── Pass 1: lock each chunk to its true spoken window. ──────────────────────────
rows = []
for (sem, sem_end, gloss), toks in zip(ANCHORS, ru_chunks):
    ts = snap(onsets, sem)
    rows.append({
        "sem": sem, "gloss": gloss,
        "tStart": ts,
        "rawEnd": snap(offsets, sem_end),
        "moved":  abs(ts - sem),                      # snap displacement
        "words":  [parse_word(t) for t in toks],
    })

# ── Pass 2: sort by spoken time (near-identity → order preserved). ──────────────
rows.sort(key=lambda r: (r["tStart"], r["rawEnd"]))

# Anti-collision (shouldn't trigger here): two chunks on the same onset.
sim_flags = []
for i in range(1, len(rows)):
    if rows[i]["tStart"] <= rows[i - 1]["tStart"] + 1e-6:
        after = [o for o in onsets if o > rows[i - 1]["tStart"] + 1e-6]
        rows[i]["tStart"] = after[0] if after else rows[i - 1]["tStart"] + 0.1
        sim_flags.append(i)

# ── Pass 3: windows in sorted order. tEnd stores the PHRASE END (clamped so it
# never overruns the next chunk's start); the caption pattern then HOLDS the line
# to the next chunk's tStart unless the gap is a real pause (> PAUSE), exactly per
# the Step-2 spec. onsets = the English word onsets inside the phrase window. ────
hold_flags, pause_flags = [], []
for i, r in enumerate(rows):
    nxt = rows[i + 1]["tStart"] if i + 1 < len(rows) else CLIP_SEC
    end = r["rawEnd"]
    if end >= nxt:                       # phrase overruns next start → clamp
        end = nxt
    elif nxt - end < FLICKER:            # sub-frame gap → hold to next
        end = nxt
        hold_flags.append(i)
    if nxt - r["rawEnd"] > PAUSE:        # real pause before next chunk
        pause_flags.append(i)
    if end <= r["tStart"]:
        end = min(nxt, r["tStart"] + 0.2)
    r["tEnd"] = end
    r["onsets"] = [o for o in onsets if r["tStart"] - 1e-6 <= o < r["tEnd"] - 1e-6]

# ── Review table ────────────────────────────────────────────────────────────────
print(f"\nREEL 1 alignment — narrative/audio order (near-identity). CLIP_SEC={CLIP_SEC}s\n")
print(f'{"#":>2} {"tStart-tEnd":>13}  {"RU":<34} {"EN words in window":<40} flag')
for i, r in enumerate(rows):
    ru = " ".join(w["text"] for w in r["words"])
    ru = ru if len(ru) <= 33 else ru[:31] + "…"
    en = " ".join(en_by_onset.get(round(o, 3), "?") for o in r["onsets"])
    en = en if len(en) <= 39 else en[:37] + "…"
    flag = "MOVED>0.5s" if r["moved"] > 0.5 else ""
    print(f'{i+1:>2} {r["tStart"]:>6.2f}-{r["tEnd"]:<6.2f}  {ru:<34} {en:<40} {flag}')

if pause_flags:
    print(f"\nReal pause before next chunk (clear at phrase_end+{TAIL}s): "
          f"{', '.join('#'+str(i+1) for i in pause_flags)}")
if hold_flags:
    print(f"Flicker-held to next start: {', '.join('#'+str(i+1) for i in hold_flags)}")
if sim_flags:
    print(f"⚠ SIMULTANEOUS onsets: {', '.join('#'+str(i+1) for i in sim_flags)}")
moved = [i + 1 for i, r in enumerate(rows) if r["moved"] > 0.5]
print(f"\nChunks moved >0.5s from anchor: {moved if moved else 'none (clean near-identity)'}")

out = [{"tStart": round(r["tStart"], 3),
        "tEnd":   round(r["tEnd"], 3),
        "onsets": [round(o, 3) for o in r["onsets"]],
        "words":  r["words"]}
       for r in rows]
json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=2)
print(f"\nwrote {OUT} ({len(out)} chunks)")
