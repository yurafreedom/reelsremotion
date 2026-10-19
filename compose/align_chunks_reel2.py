#!/usr/bin/env python3
# align_chunks_reel2.py — Step 2 for REEL 2. Same algorithm as align_chunks_reel1.py
# (snap each chunk to its real spoken window, sort by tStart, derive the on-screen
# window + per-word onsets), retargeted at REEL 2.
#
# REEL 2 reality: the source clip is ALREADY in narrative/audio order, so the
# alignment is NEAR-IDENTITY — every chunk maps, in order, to the next spoken
# phrase it translates. No reorder is expected; the >0.5s flag would catch any
# chunk that snapped far from its anchor.
#
# BILINGUAL: REEL 2 is mostly the English guest, but chunks 16–24 ("женщины
# обычно хотят всего и сразу…") translate the Russian beat spoken by Evgenia
# (asr segments 9–14, ~56.4–83.5s). For that beat the RU caption locks to the
# actual RUSSIAN word onsets (native 1:1); for every other chunk it locks to the
# English word onsets. Nothing here forces a language — the onsets come straight
# from the bilingual faster-whisper pass (compose/asr_reel2.json), so each chunk
# naturally rides whatever language was spoken in its window.
#
#   RU text + n/s/a/A styles come straight from compose/chunks_ru_reel2.json
#   (faithful translation — NEVER reworded/restyled here). Only the per-chunk
#   (sem, semEnd) anchors live in this script; they were read off the ASR word
#   table — the onset of the phrase each line translates and that phrase's end.
#
# tEnd policy (per the Step-2 spec): HOLD till replaced → tEnd = next chunk's
# tStart, UNLESS the next chunk is a real pause (> PAUSE) away, in which case the
# line CLEARS at phrase_end + TAIL. Edges snap to real word onsets/offsets.
#
# Writes compose/chunks_timed_reel2.json and prints the review table.

import json

ASR = "compose/asr_reel2.json"
RU  = "compose/chunks_ru_reel2.json"
OUT = "compose/chunks_timed_reel2.json"

asr = json.load(open(ASR))
CLIP_SEC = round(max(w["end"] for w in asr["words"]), 2)   # last ASR word end
PAUSE = 2.0            # > this gap to next chunk = a real pause (clear at phrase end)
TAIL  = 0.5            # tail held past phrase end at a pause

# ── (sem, semEnd, gloss) anchors per chunk, in narrative order, read off
# asr_reel2.json. gloss = the spoken window each RU line translates; [ru] marks
# the chunks that ride the Russian beat. ─────────────────────────────────────────
ANCHORS = [
    # Block 1 — EN guest
    (  0.00,   1.66, "what would be the proof"),                                   # 1
    (  1.68,   3.90, "hypothetically"),                                            # 2
    (  4.06,   8.40, "for the woman that you can trust her"),                      # 3
    ( 10.52,  12.40, "to reveal the truth"),                                       # 4
    # Block 2 — EN guest
    ( 12.78,  17.28, "The man, which I think a very healthy"),                     # 5
    ( 18.32,  19.92, "very mature man"),                                           # 6
    ( 21.00,  22.28, "will test you first"),                                       # 7
    ( 22.28,  26.18, "until he will reveal the truth to you"),                     # 8
    ( 26.18,  26.60, "right?"),                                                    # 9
    ( 26.64,  29.80, "most of women doesn't understand"),                          # 10
    ( 31.70,  38.22, "They want a man to be straight open"),                       # 11
    ( 39.02,  40.92, "straight, bringing all resources"),                          # 12
    ( 41.52,  43.78, "that he has to her"),                                        # 13
    ( 44.52,  50.00, "And they expect that without proving"),                      # 14
    ( 50.76,  55.60, "that she is the one who he can trust"),                      # 15
    # Block 3 — RU beat (Evgenia) — native Russian onsets
    ( 56.38,  58.34, "[ru] Женщины обычно хотят всего и сразу"),                   # 16
    ( 59.36,  60.92, "[ru] когда начинают встречаться с мужчиной"),                # 17
    ( 61.48,  64.34, "[ru] ожидают что он сразу начнёт весь мир"),                 # 18
    ( 64.58,  65.60, "[ru] к её ногам бросать"),                                   # 19
    ( 66.10,  70.42, "[ru] как он говорит, я жду"),                                # 20
    ( 71.56,  77.54, "[ru] что женщина покажет стабильность"),                     # 21
    ( 77.54,  78.46, "[ru] в своём поведении"),                                    # 22
    ( 78.46,  79.92, "[ru] что я могу ей доверять"),                               # 23
    ( 80.44,  83.50, "[ru] и что я могу перед ней открыться"),                     # 24
    # Block 4 — EN guest
    ( 83.52,  84.26, "the really interesting thing"),                             # 25
    ( 84.26,  84.94, "I think (was)"),                                            # 26
    ( 84.94,  86.52, "when I would meet someone"),                                # 27
    ( 86.52,  88.28, "who couldn't have"),                                        # 28
    ( 88.28,  93.20, "open, raw, radically honest conversation"),                 # 29
    ( 94.78,  96.54, "whether it's about their intellect"),                       # 30
    ( 96.54,  99.68, "about subjects they're passionate about"),                  # 31
    ( 99.68, 103.10, "and especially conversations around sex"),                  # 32
    (103.10, 105.00, "the really interesting thing for me is"),                   # 33
    (105.00, 107.30, "those people who can't talk about it"),                     # 34
    (109.43, 111.11, "that would usually tell me"),                              # 35
    (111.11, 113.87, "their intentions or something else"),                      # 36
    (113.87, 117.47, "their intentions revolve around the need"),                # 37
    (117.47, 121.17, "for some kind of dependent style protection"),             # 38
    (121.83, 123.83, "rather than actually wanting to be protected"),            # 39
    # Block 5 — EN guest
    (125.85, 127.57, "For me, there's also an element"),                         # 40
    (127.57, 129.71, "of that initial excitement"),                              # 41
    (130.39, 131.50, "and attraction"),                                          # 42
    (132.61, 134.29, "Is that person going to come back?"),                      # 43
    (134.57, 135.43, "Are they going to make the effort"),                       # 44
    (135.81, 139.13, "to continue to escalate the conversation"),                # 45
    (139.77, 140.85, "sentence by sentence"),                                    # 46
    (141.83, 143.37, "give you a little more each time"),                        # 47
    (144.01, 145.13, "reveal more of themselves"),                               # 48
    (146.43, 148.15, "Are they going to keep coming back?"),                     # 49
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

# onset → spoken language (script of the segment the word belongs to), so the dump
# can label which language each chunk rides.
lang_by_onset = {}
for s in asr["segments"]:
    for w in s.get("words", []):
        lang_by_onset[round(w["start"], 3)] = s.get("script", "?")


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

# ── Pass 3: windows. tEnd = next chunk's tStart (HOLD till replaced), unless the
# next chunk is a real pause (> PAUSE) away → CLEAR at phrase_end + TAIL. onsets =
# the spoken word onsets inside [tStart, tEnd). ─────────────────────────────────
pause_flags = []
for i, r in enumerate(rows):
    nxt = rows[i + 1]["tStart"] if i + 1 < len(rows) else CLIP_SEC
    gap = nxt - r["rawEnd"]
    if gap > PAUSE:                       # real pause before next chunk
        end = min(r["rawEnd"] + TAIL, nxt)
        pause_flags.append(i)
    else:                                 # hold the line until the next replaces it
        end = nxt
    if end <= r["tStart"]:
        end = min(nxt, r["tStart"] + 0.2)
    r["tEnd"] = end
    r["onsets"] = [o for o in onsets if r["tStart"] - 1e-6 <= o < r["tEnd"] - 1e-6]


def win_lang(r):
    ls = [lang_by_onset.get(round(o, 3), "?") for o in r["onsets"]]
    if not ls:
        return "?"
    return "ru" if ls.count("ru") >= ls.count("en") and "ru" in ls else "en"


# ── Review table ────────────────────────────────────────────────────────────────
print(f"\nREEL 2 alignment — narrative/audio order (near-identity), BILINGUAL. "
      f"CLIP_SEC={CLIP_SEC}s\n")
print(f'{"#":>2} {"tStart-tEnd":>14}  {"RU":<40} {"lang":<4} {"spoken words in window":<46} flag')
for i, r in enumerate(rows):
    ru = " ".join(w["text"] for w in r["words"])
    ru = ru if len(ru) <= 39 else ru[:37] + "…"
    sp = " ".join(en_by_onset.get(round(o, 3), "?") for o in r["onsets"])
    sp = sp if len(sp) <= 45 else sp[:43] + "…"
    lang = win_lang(r)
    flag = "MOVED>0.5s" if r["moved"] > 0.5 else ""
    print(f'{i+1:>2} {r["tStart"]:>6.2f}-{r["tEnd"]:<7.2f}  {ru:<40} {lang:<4} {sp:<46} {flag}')

if pause_flags:
    print(f"\nReal pause before next chunk (clear at phrase_end+{TAIL}s): "
          f"{', '.join('#'+str(i+1) for i in pause_flags)}")
if sim_flags:
    print(f"⚠ SIMULTANEOUS onsets: {', '.join('#'+str(i+1) for i in sim_flags)}")
moved = [i + 1 for i, r in enumerate(rows) if r["moved"] > 0.5]
print(f"\nChunks moved >0.5s from anchor: {moved if moved else 'none (clean near-identity)'}")
ru_beat = [i + 1 for i, r in enumerate(rows) if win_lang(r) == "ru"]
print(f"Chunks riding the Russian beat: {ru_beat}")

out = [{"tStart": round(r["tStart"], 3),
        "tEnd":   round(r["tEnd"], 3),
        "onsets": [round(o, 3) for o in r["onsets"]],
        "words":  r["words"]}
       for r in rows]
json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=2)
print(f"\nwrote {OUT} ({len(out)} chunks)")
