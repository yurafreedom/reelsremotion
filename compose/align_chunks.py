#!/usr/bin/env python3
# align_chunks.py — Step 2 of the caption re-time (AUDIO-ORDER rebuild).
#
# THE VIDEO CUT IS THE GROUND TRUTH. Every Russian caption sits on the speaker's
# REAL spoken word/second from ASR — the onset of the English phrase it
# translates (compose/asr_words.json). On-screen order = SPOKEN order, NOT the
# original SEG narrative order. If honoring the audio reorders chunks relative to
# the narrative list, we LET them reorder; the narrative order was the broken
# thing this cut corrects.
#
#   The audio is ENGLISH; the captions are a RUSSIAN translation. Whisper gives
#   ENGLISH word times, so per chunk we lock:
#     • tStart = onset  of the English PHRASE this line translates (real ASR start)
#     • rawEnd = offset of that phrase's LAST English word   (real ASR end)
#   Then we SORT every chunk by tStart and recompute the on-screen window in that
#   sorted order. tEnd defaults to the chunk's OWN phrase end (rawEnd), so a line
#   is up WHILE its phrase is spoken and CLEARS during a real pause (tightest
#   sync — sync over continuity). Anti-stack: if the next (sorted) chunk starts
#   before this one's phrase end, clamp tEnd to that start; if clearing at
#   phrase-end would leave a sub-frame flicker before the next phrase, hold to it.
#
#   Chunks 6/7 ("не переспал с ней" / "после шести свиданий") are spoken at
#   ~7.78–9.40s — BEFORE chunk 4 ("он показал переписку", 9.94s) — even though the
#   SEG list parks them later. They now SORT IN at their real time, ahead of 4/5.
#
# Writes compose/chunks_timed.json and prints the sorted review table.

import json

CLIP_SEC = 52.08          # last ASR word end (matches the 52.1s clip)
TIME_SCALE = 52.1 / 58.5  # build_reel's old linear rescale (≈0.8906) — for Δ only
FLICKER = 0.04            # < ~1 frame @30fps: hold tEnd to next start (no flicker)

# ── The 26 chunks. Per chunk:
#   ref    : ORIGINAL (pre-rescale) tSec from build_reel.ts (→ anchor, info only).
#   sem    : onset  (sec) of the English phrase this Russian line translates.
#   semEnd : offset (sec) of that phrase's LAST English word (its real spoken end).
#   words  : RU text + n/s/a/A styles, EXACTLY as build_reel.ts (UNCHANGED).
# (sem, semEnd) come straight from the ASR word table; the English gloss is noted.
CHUNKS = [
    (0.2,  0.00, 1.08, [("У","n"),("меня","n"),("есть","n"),("пример","n")]),          # "I have a great example"
    (2.0,  1.38, 2.98, [("друг","n"),("—","n"),("невероятно","n"),("красивый","a")]),   # "a friend ... incredibly handsome"
    (3.6,  3.28, 4.46, [("невероятно","n"),("успешный","a")]),                          # "incredibly successful"
    (5.0,  4.92, 6.68, [("был","n"),("одержим","A"),("ею","n")]),                       # "obsessed over this woman"
    (10.0, 9.94, 11.50,[("он","n"),("показал","n"),("переписку","n")]),                 # "he showed me the text messages"
    (11.4, 12.18,13.12,[("«что","n"),("я","n"),("не так","a"),("сделал?»","n")]),       # "what did I do with this?"
    (14.0, 7.78, 8.70, [("не","n"),("переспал","n"),("с","n"),("ней","n")]),            # "He hadn't slept with her"   (spoken 7.78–8.70)
    (15.0, 8.70, 9.74, [("после","n"),("шести","A"),("свиданий","n")]),                 # "after six dates"            (spoken 8.70–9.40)
    (18.2, 14.76,15.68,[("«какого","n"),("хрена","a"),("происходит?»","n")]),           # "what the fuck's going on?"
    (20.2, 15.90,16.82,[("я","n"),("думала,","n"),("я","n"),("тебе","n"),("нравлюсь","a")]), # "I thought you liked me"
    (22.4, 17.02,17.70,[("в","n"),("чём","n"),("проблема?»","a")]),                     # "Is there a problem?"
    (24.3, 19.38,20.70,[("«я","n"),("не","n"),("чувствую","n"),("себя","n"),("желанной","A")]), # "I do not feel desired"
    (26.8, 21.38,22.78,[("ты","n"),("водишь","n"),("в","n"),("нужные","n"),("места","n")]),     # "you're taking me to the right places"
    (29.0, 22.78,26.16,[("ты","n"),("явно","n"),("добытчик","a")]),                     # "You clearly ... a provider"
    (31.0, 26.74,29.64,[("готов","n"),("дать","n"),("мне","n"),("всё","n")]),           # "willing to ... offer me these things"
    (33.2, 29.74,32.40,[("но","n"),("не","n"),("то, что нужно","s")]),                  # "but you're not offering me the thing I need"
    (35.4, 33.40,33.90,[("твоё","n"),("внимание","a")]),                                # "your attention"
    (37.6, 34.22,34.72,[("твоё","n"),("желание","A")]),                                 # "your desire"
    (40.3, 35.06,36.64,[("вышла","n"),("из","n"),("долгих","n"),("отношений","n")]),    # "out of a long-term relationship"
    (42.6, 37.02,38.22,[("переехала","n"),("в","n"),("новый","n"),("город","n")]),      # "she just moved to a new city"
    (44.8, 38.58,40.18,[("на","n"),("пике карьеры","a")]),                              # "at the height of her career"
    (46.8, 41.16,44.04,[("взяла","n"),("жизнь","n"),("под","n"),("контроль","a")]),     # "taking so much control over her life"
    (49.0, 44.04,46.20,[("кайфовала","n"),("от","n"),("этой","n"),("власти","a")]),     # "having so much fun with that power"
    (51.2, 46.56,47.62,[("хотела","n"),("чувствовать","n"),("себя","n"),("живой","A")]), # "She wanted to feel alive"
    (54.3, 48.08,49.02,[("он","n"),("дал","n"),("ей","n"),("это","n"),("ощущение","n")]), # "He made her feel alive"
    (56.2, 49.82,52.08,[("но","n"),("всё","n"),("быстро","n"),("рухнуло","A")]),        # "but then that just crashed so quick"
]

asr = json.load(open("compose/asr_words.json"))
onsets = sorted(w["start"] for w in asr["words"])
offsets = sorted(w["end"] for w in asr["words"])
en_by_onset = {round(w["start"], 3): w["word"] for w in asr["words"]}

def snap(values, t):
    """Nearest real ASR time in `values` to t."""
    return min(values, key=lambda o: abs(o - t))

# ── Pass 1: lock each chunk to its TRUE spoken window (onset → phrase end). ────
# No monotonic / narrative-order constraint: every chunk gets its real ASR time.
rows = []
for ref, sem, sem_end, words in CHUNKS:
    anchor = round(ref * TIME_SCALE * 10) / 10
    rows.append({
        "ref": ref, "anchor": anchor,
        "tStart": snap(onsets, sem),
        "rawEnd": snap(offsets, sem_end),
        "words": words,
    })

# ── Pass 2: RE-SORT by spoken time. Render order now = audio order. ───────────
rows.sort(key=lambda r: (r["tStart"], r["rawEnd"]))

# Guard (rare): two chunks whose content is spoken simultaneously snap to the same
# onset. We can't show both on the same instant without stacking — give the second
# a minimal sequential slot on the next real onset and flag it.
sim_flags = []
for i in range(1, len(rows)):
    if rows[i]["tStart"] <= rows[i - 1]["tStart"] + 1e-6:
        after = [o for o in onsets if o > rows[i - 1]["tStart"] + 1e-6]
        rows[i]["tStart"] = after[0] if after else rows[i - 1]["tStart"] + 0.1
        sim_flags.append(i)

# ── Pass 3: recompute windows IN SORTED ORDER. ───────────────────────────────
# tEnd = own phrase end, clamped so it never overruns the next chunk's start
# (anti-stack); held to the next start only to avoid a sub-frame flicker.
hold_flags = []
for i, r in enumerate(rows):
    nxt = rows[i + 1]["tStart"] if i + 1 < len(rows) else CLIP_SEC
    end = r["rawEnd"]
    if end >= nxt:                                  # phrase end overruns next start
        end = nxt                                   #   → clamp, don't stack
    elif nxt - end < FLICKER:                       # sub-frame gap before next phrase
        end = nxt                                   #   → hold to next (no flicker)
        hold_flags.append(i)
    if end <= r["tStart"]:                           # safety: keep a positive window
        end = min(nxt, r["tStart"] + 0.2)
    r["tEnd"] = end
    r["onsets"] = [o for o in onsets if r["tStart"] - 1e-6 <= o < r["tEnd"] - 1e-6]

# ── Sorted review table ──────────────────────────────────────────────────────
print(f"\nAUDIO-ORDER rebuild — render order = spoken order. tStart/tEnd are real "
      f"ASR phrase windows.\n")
print(f'{"#":>2} {"RU text":<33} {"start":>6} {"end":>6} {"dur":>5}  '
      f'{"EN words in window":<34}')
for i, r in enumerate(rows):
    ru = " ".join(w[0] for w in r["words"])
    if len(ru) > 32:
        ru = ru[:30] + "…"
    en = " ".join(en_by_onset.get(round(o, 3), "?") for o in r["onsets"])
    if len(en) > 33:
        en = en[:32] + "…"
    print(f'{i:>2} {ru:<33}{r["tStart"]:>6.2f}{r["tEnd"]:>6.2f}{r["tEnd"]-r["tStart"]:>5.2f}  {en:<34}')

# Spotlight the reordered pair so we can confirm they landed on the real audio.
print("\nReordered into audio position (were parked late in the SEG list):")
for i, r in enumerate(rows):
    ru = " ".join(w[0] for w in r["words"])
    if ru.startswith("не переспал") or ru.startswith("после шести"):
        en = " ".join(en_by_onset.get(round(o, 3), "?") for o in r["onsets"])
        print(f'  render#{i:<2} {r["tStart"]:.2f}–{r["tEnd"]:.2f}s  "{ru}"  ← "{en}"')

if hold_flags:
    print(f"\nFlicker-held to next start (sub-frame gap): "
          f"{', '.join('#'+str(i) for i in hold_flags)}")
if sim_flags:
    print(f"\n⚠ SIMULTANEOUS (content overlaps in audio; given sequential slots): "
          f"{', '.join('#'+str(i) for i in sim_flags)} — verify by ear")

out = [{"tStart": round(r["tStart"], 3),
        "tEnd": round(r["tEnd"], 3),
        "onsets": [round(o, 3) for o in r["onsets"]],
        "words": [{"text": t, "style": s} for t, s in r["words"]]}
       for r in rows]
json.dump(out, open("compose/chunks_timed.json", "w"), ensure_ascii=False, indent=2)
print(f"\nwrote compose/chunks_timed.json ({len(out)} chunks, sorted by spoken time)")
