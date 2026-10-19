# Eight Reels — editorial review preparation

STATUS=HUMAN_EAR_GATE_CLOSED; VISUAL_GATE_CLOSED_APPROVED; R06_SEMANTIC_REPAIR_CANDIDATE_CREATED; HUMAN_SEMANTIC_REVIEW_PENDING  
HUMAN_EAR_GATE=CLOSED  
VISUAL_GATE=CLOSED  
TIMELINES_AUTHORIZED=R06_ONLY  
PRODUCTION_CANDIDATE_RENDER_AUTHORIZED=R06_ONLY  
FINAL_SERIES_RENDERS_AUTHORIZED=NO  
SERIES_PRODUCTION_AUTHORIZED=NO  
MASTER=`video1219377731.mp4`  
CORRECTION_LEDGER=`reel-input/EDITORIAL_CORRECTIONS_PROPOSED.md`
HUMAN_DECISION_ARTIFACT=`reel-input/HUMAN_EDITORIAL_DECISIONS.md`

## Priority / readiness ranking

| Rank | REEL | EDITORIAL_STRENGTH | SOURCE_CONFIDENCE | TRANSCRIPT_CONFIDENCE | CURRENT_DURATION | RECOMMENDED_DURATION | EXPECTED_EDIT_COMPLEXITY | READY_FOR_APPROVAL |
|---:|---|---|---|---|---:|---:|---|---|
| 1 | R06 — What Is Actually True? | Very high; immediate questions and clean payoff | High | Human audio/content approved | 36.18 s semantic-repair candidate | No padding added | Low | SEMANTIC-REPAIR CANDIDATE CREATED — human review pending |
| 2 | R03 — Dominance Is Not Control | Very high; clear reframing and quotable payoff | High | High; human audio approved | 39.94 s | 42–44 s | Low | YES — approved tail trim applied |
| 3 | R05 — Adult Love Is Conditional | Very high; provocative, coherent, strong creator voice | High | High; C09 and edges approved | 55.98 s | 57–59 s | Low–medium | YES — approved earlier start applied |
| 4 | R01 — Fear of Losing Yourself | High and conversion-relevant | Medium-high; gallery source but host visible | Human-approved C01/C02 and edges | 63.20 s | 65–67 s | Medium | YES — human audio approved |
| 5 | R07 — Kneeling / Return to the Body | High; distinct embodied thesis and guest proof | High | Content/C10/`всегда` approved | 71.77 s | 57–59 s | Medium | AUDIO APPROVED — selected 20 ms option A |
| 6 | R02 — Connection Without a Future | High; strongest broad relationship thesis | High | Human audio approved; mutable corrections recorded | 65.44 s | 67–69 s | Medium-high | AUDIO APPROVED |
| 7 | R04 — Compromise vs Consensus | High concept; retained wording human-approved | Medium | C05–C07, clean start and compact candidate approved | 48.84 s package source | 44–46 s compact recommendation | High | APPROVED — timeline still unauthorized |
| 8 | R08 — Where Do You Fall Apart? | Medium-high; useful idea but conceptually dense | High | C11 approved; C12 accepted and retained; joins approved | 60.22 s | 43–45 s | High | AUDIO APPROVED — complete-sentence option A |

## Review evidence and limits

- All 17 manifest clips were extracted through the canonical exact-reencode path. The master remained unchanged and outside every `public/` directory.
- Every file contains H.264 video plus audible AAC 48 kHz stereo. Actual durations differ from requested speech intervals only by normal 0.022–0.042 s container/frame rounding.
- Seven visual samples were inspected per clip: `+0.04`, `+0.20`, `+0.50`, midpoint, `-0.50`, `-0.20`, and `-0.04` seconds. Review sheets and first/last three-second waveforms are under `scratch_check/editorial_review/<slug>/<clip-id>/`.
- Speaker role is visually identifiable in 16 of 17 clips. R04's practical-example clip remains visually ambiguous. “Verified” below means visual match, not voice-biometric proof.
- Canonical word ASR places the first and last word exactly on every current boundary. The independent targeted pass also starts at frame zero for most clips. Therefore no edge is declared phoneme-safe without a human listening to the extracted file. This document does not manufacture that approval.
- A second independent faster-whisper `small` CPU/int8 pass is stored at `scratch_check/editorial_review/targeted_asr.json`. It is evidence only and never replaces canonical provenance.
- B-roll decisions are based on inspected motion sheets, not filenames. `broll_reel2_06.mp4` was found to be a couple-under-an-umbrella selfie, not a feet/grounding shot; R07 rejects it.

---

# R01 — Fear of Losing Yourself

EDITORIAL_STATUS=STRONG / HUMAN AUDIO AND WORDING APPROVED  
CURRENT_SOURCE_DURATION=63.20 s  
RECOMMENDED_FINAL_DURATION=65–67 s including one short hook card  
DISPLAY_RU_STATUS=HUMAN_WORDING_APPROVED; PUNCTUATION REMAINS EDITORIAL

## Core thesis

Fear of losing another person makes you adapt until you lose yourself. Explicit structure, consent, and direction restore clarity and the felt ability to stand on your own ground.

## Source clips

### r01-hook-loss

SOURCE_TIMECODE=00:17:21.000 --> 00:17:44.460  
REVIEW_CLIP=`reel-input/r01-fear-of-losing-yourself/public/clips/001_hook.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Evgeniia Nikulina is speaking in the labelled top-left gallery tile; human ear still pending  
EDGE_STATUS=HUMAN APPROVED  
SOURCE_TEXT_STATUS=C01 ACCEPTED — `теряешь`

### r01-clarity-ground

SOURCE_TIMECODE=00:17:44.460 --> 00:18:24.200  
REVIEW_CLIP=`reel-input/r01-fear-of-losing-yourself/public/clips/002_payoff.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Evgeniia Nikulina  
EDGE_STATUS=HUMAN APPROVED; continuous with previous source at 00:17:44.460  
SOURCE_TEXT_STATUS=C02 ACCEPTED — source/display `консента`

## Exact transcript corrections

- C01: ACCEPTED — human heard `теряешь [pause] путь`.
- C02: ACCEPTED — preserve intentional inflected borrowing `консента` in SOURCE and DISPLAY.

## Recommended cut

Keep the two current intervals back-to-back:

1. `00:17:21.000 --> 00:17:44.460`
2. `00:17:44.460 --> 00:18:24.200`

The speech is already 63.20 s and follows a complete conversion arc. Keep exactly one explicit club reference — `Вы получите в рамках клуба...` — because this is the only line that connects the emotional insight to the offer. Do not add a second promotional card.

## Removed/filler material

- No source sentence must be removed for duration.
- If a shorter version is later required, first candidate is `Я думаю, что вам всем это знакомо, чувство, правда?`; do not remove the following `И в этом подстраивании...` lead-in.
- Repetitions in the “standing on your ground” passage carry cadence and should not be mechanically tightened before listening.

## DISPLAY RU

Proposed punctuation/readability layer, preserving speech:

> Когда очень много чувств, когда очень много страха потерять человека, ты начинаешь подстраиваться. Я думаю, что вам всем знакомо это чувство, правда? И в этом подстраивании ты просто теряешь себя, теряешь путь, куда вы движетесь, — и всё начинает рушиться. Поэтому я так люблю, с момента открытия для себя динамики, чёткое проговаривание контракта, чёткое проговаривание консента, чёткое проговаривание, куда мы движемся. Потому что именно это даёт чёткость и понятность. И это же можно применять в обычной повседневной жизни. Вы получите в рамках клуба ощущение вот этой частоты, вот этого чувства — как это: стоять на своей земле, не защищая позиции, не воюя за это, а просто оставаясь в своём центре. Вот это самое главное, что вы получите. И это будет как импринт вашего ощущения, которое вы понесёте в жизнь.

Human-approved C01/C02 are recorded in the mutable decision/display layer. The immutable canonical ASR remains unchanged.

## Hook

CURRENT=`СТРАХ ПОТЕРЯТЬ ДРУГОГО МОЖЕТ ПРИВЕСТИ К ПОТЕРЕ СЕБЯ`  
RECOMMENDATION=`БОИШЬСЯ ПОТЕРЯТЬ ДРУГОГО — И ТЕРЯЕШЬ СЕБЯ`  
ACTION=REWRITE  
WHY=Shorter, immediate, second-person tension; remains supported and is clearly editorial copy, not a quotation.

## Punch/end cards

CURRENT=`СТРУКТУРА ВОЗВРАЩАЕТ ТЕБЯ НА СВОЮ ЗЕМЛЮ`  
RECOMMENDATION=`СТОЯТЬ НА СВОЕЙ ЗЕМЛЕ. ОСТАВАТЬСЯ В СВОЁМ ЦЕНТРЕ.`  
ACTION=REWRITE OR REMOVE  
WHY=Closer to the speaker's actual payoff. Prefer an on-footage punch rather than an extra promotional end card.

## B-roll

ASSET=`public/media/broll_reel1_03.mp4`  
OBSERVED_CONTENT=Portrait night shot tracking behind a woman in a backless black outfit; warm bokeh, face not visible  
INSERT_POSITION=Over the brief “теряешь себя” beat only  
FUNCTION=VISUAL METAPHOR / EMOTIONAL BREATH  
KEEP|REJECT|ALTERNATIVE_NEEDED=KEEP OPTIONAL, maximum about 1.5 s  
WHY=It can express disconnection without inventing a factual scene, but a longer use turns the Reel into a fashion montage and hides the host.

## Risks / unresolved questions

- Confirm that one club reference is desired for conversion; otherwise the source requires a more complex internal word-level cut.
- Gallery layout will need an intentional crop/box treatment later; no timeline is authorized now.

## Recommendation

APPROVE_WITH_CHANGES

---

# R02 — A Connection Does Not Need a Future to Have Value

EDITORIAL_STATUS=STRONG / APPROVED COMPRESSION APPLIED; ONE EDGE RECHECK PENDING  
CURRENT_SOURCE_DURATION=65.44 s  
RECOMMENDED_FINAL_DURATION=67–69 s including a short hook; no separate end card required  
DISPLAY_RU_STATUS=C03 APPROVED; C04 PARTIALLY APPROVED

## Core thesis

Over-responsibility can make every romantic connection feel like a lifetime contract. A finite connection can still offer unique value when intentions are good, consent is explicit, and no false expectations are created.

## Source clips

### r02-question

SOURCE_TIMECODE=01:15:58.420 --> 01:16:21.600  
REVIEW_CLIP=`reel-input/r02-connection-without-future/public/clips/001_question.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Evgeniia Nikulina reads/speaks the English question; Andrew listens  
EDGE_STATUS=HUMAN APPROVED after `there is no future together`  
SOURCE_TEXT_STATUS=C03 ACCEPTED — `couldn't ... just date`

### r02-unique-value

SOURCE_TIMECODE=01:18:51.520 --> 01:19:12.320  
REVIEW_CLIP=`reel-input/r02-connection-without-future/public/clips/002_context.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Andrew is visibly speaking  
EDGE_STATUS=Extended from 01:19:12.000 to 01:19:12.320 to preserve complete `unique`; HUMAN RECHECK REQUIRED  
SOURCE_TEXT_STATUS=C04 START PARTIALLY APPROVED; REMAINDER OPTIONAL/PENDING

### r02-permission-payoff

SOURCE_TIMECODE=01:20:43.900 --> 01:21:05.360  
REVIEW_CLIP=`reel-input/r02-connection-without-future/public/clips/003_payoff.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Andrew is visibly speaking/gesturing  
EDGE_STATUS=HUMAN APPROVED after `without expectations`  
SOURCE_TEXT_STATUS=HIGH CONFIDENCE; later epilogue excluded

## Exact transcript corrections

- C03 ACCEPTED: restores `couldn't ... just date` in the question.
- C04 PARTIALLY APPROVED: human confirms `to actually indulge in that pleasure, to meet someone...`; exact remainder may be reviewed separately.

## Recommended cut

Retain exactly:

1. `01:15:58.420 --> 01:16:21.600` — over-responsibility through “there is no future together” (23.18 s).
2. `01:18:51.520 --> 01:19:12.320` — unique value of the two people together, extended through the complete final word (20.80 s).
3. `01:20:43.900 --> 01:21:05.360` — connection, good intentions, consent, and entering lightly without expectations (21.46 s).

Total retained speech: 65.44 s. Use one 1.5–2.0 s hook card and let the last source sentence be the ending.

## Removed/filler material

- Remove `01:16:22.380 --> 01:16:34.860`: repeated forward calculation/long-term-values qualification. The shortened question already establishes responsibility and no future.
- Remove `01:21:05.980 --> 01:21:15.820`: optimistic “best people / values fall into place” epilogue. It weakens the sharper consent/no-expectation landing and pushes duration over target.
- Preserve the entire unique-value clip; trimming its internal clauses damages the “not only you — the combination is unique” logic.

## DISPLAY RU

Proposed complete display text for the retained cut:

> Ты когда-нибудь ловила себя на том, что воспринимаешь каждую романтическую связь слишком серьёзно и берёшь на себя слишком много ответственности — настолько, что не можешь просто встречаться с кем-то, ходить на свидания или заниматься любовью без чувства вины и груза ответственности, особенно когда с самого начала понимаешь, что общего будущего нет?

> На самом деле позволить себе это удовольствие — встретить человека, сделать лучше его день, неделю, месяц, дать ему опыт, которого прежде не было. Это не обязательно должен быть невероятный опыт, который можешь дать только ты: просто вы двое вместе совершенно уникальны.

> Знакомься с людьми. Разрешай себе мимолётные моменты удовольствия. Не чувствуй давления или ожиданий, пока у тебя добрые намерения и ты не собираешься никому причинять вред — если только это не их кинк, у тебя есть их согласие и именно этого они хотят. Тогда ты входишь во что-то лёгкое, без ожиданий.

Translation was reviewed with surrounding Russian context visible. C03 and the approved start of C04 are recorded in the phrase/display layer; the C04 remainder remains pending. Russian text remains phrase-aligned to English source intervals, never word-aligned.

## Hook

CURRENT=`СВЯЗИ НЕ ОБЯЗАТЕЛЬНО ИМЕТЬ БУДУЩЕЕ, ЧТОБЫ ИМЕТЬ ЦЕННОСТЬ`  
RECOMMENDATION=`СВЯЗЬ МОЖЕТ НЕ ИМЕТЬ БУДУЩЕГО — И ВСЁ РАВНО ИМЕТЬ ЦЕННОСТЬ`  
ACTION=REWRITE  
WHY=Same thesis with faster parsing and stronger contrast.

## Punch/end cards

CURRENT=`ДОБРЫЕ НАМЕРЕНИЯ. СОГЛАСИЕ. БЕЗ ЛОЖНЫХ ОБЕЩАНИЙ.`  
RECOMMENDATION=SAME  
ACTION=KEEP AS SHORT OVERLAY, NOT A SEPARATE END CARD  
WHY=Clear ethical guardrail; “без ложных обещаний” is a defensible editorial paraphrase of “without expectations”, not a fake quotation.

## B-roll

ASSET=`public/media/broll_reel1_02.mp4`  
OBSERVED_CONTENT=Warm portrait restaurant close-up; couple embraces and moves into a kiss, partially obscured by a reflective column  
INSERT_POSITION=During `make their day/week/month better`  
FUNCTION=RELATIONSHIP CHEMISTRY / INTIMACY  
KEEP|REJECT|ALTERNATIVE_NEEDED=KEEP OPTIONAL, 1.5–2.0 s  
WHY=Directly supports connection/value and matches the tone. Do not place it over the consent sentence; faces and ethical framing should remain visible.

## Risks / unresolved questions

- Human recheck of the newly extended 01:19:12.320 endpoint; it was located from native audio/independent ASR and following silence, not guessed.
- Exact remainder of C04 may still be reviewed separately.
- Russian grammatical gender in the opening (`ловила` versus gender-neutral restructuring) should match the intended audience voice.
- Three discontinuous source jumps need transparent editorial approval.

## Recommendation

APPROVE_WITH_CHANGES

---

# R03 — Dominance Is Not Control

EDITORIAL_STATUS=VERY STRONG / HUMAN-APPROVED TAIL TRIM APPLIED  
CURRENT_SOURCE_DURATION=39.94 s  
RECOMMENDED_FINAL_DURATION=42–44 s  
DISPLAY_RU_STATUS=NEEDS_MINOR_EDIT

## Core thesis

A dominant is not someone who absorbs you or decides for you. The valuable function is nervous-system stability when you cannot regulate yourself.

## Source clips

### r03-stabilization

SOURCE_TIMECODE=00:36:42.040 --> 00:37:21.980  
REVIEW_CLIP=`reel-input/r03-dominance-is-not-control/public/clips/001_body-payoff.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Evgeniia Nikulina is visibly speaking in the labelled gallery tile  
EDGE_STATUS=HUMAN APPROVED; ends after `когда ты рассыпаешься`  
SOURCE_TEXT_STATUS=HIGH CONFIDENCE; targeted pass mainly changes punctuation

## Exact transcript corrections

No correction should be applied. The independent pass omits one adjective (`порядочного`) but confidence is insufficient; retain canonical SOURCE until heard.

## Recommended cut

Retain:

1. `00:36:42.040 --> 00:37:21.980`

The end is the native word end of `рассыпаешься`. Retained speech is 39.94 s. Add a short hook and, at most, a one-second final punch.

CURRENT_EDGE=00:37:29.260  
PROPOSED_EDGE=00:37:21.980  
REASON=Everything after `рассыпаешься` is a return-to-question transition, not part of the Reel payoff.

## Removed/filler material

- Remove `так вот, возвращаясь к ... вопросу` after the payoff.
- Keep the descriptive list of calm/structured behaviours; it earns the nervous-system conclusion and distinguishes dominance from control.

## DISPLAY RU

> И когда я вижу его такого спокойного, порядочного, упорядоченного, наводящего структуру, последовательного, составляющего графики, знающего, что мы будем делать, планирующего, мне становится спокойнее. Потому что рядом со мной есть более сильная нервная система, которая регулирует себя лучше, чем я в этот момент могу регулировать сама себя. То есть начинаем вкатываться в динамику. Доминант — это не тот, кто тебя поглощает и принимает за тебя решения. Это тот, кто стабилизирует тебя в момент, когда ты рассыпаешься.

Changes above are punctuation/readability proposals; `спокойнее`, capitalization, and agreement must be logged if approved.

## Hook

CURRENT=`ДОМИНИРОВАНИЕ — НЕ КОНТРОЛЬ`  
RECOMMENDATION=SAME  
ACTION=KEEP  
WHY=Immediate, compact, and exactly frames the correction the source makes.

## Punch/end cards

CURRENT=`ФУНКЦИЯ — СТАБИЛИЗИРОВАТЬ, А НЕ ПОГЛОЩАТЬ`  
RECOMMENDATION=`ОН НЕ РЕШАЕТ ЗА ТЕБЯ. ОН СТАБИЛИЗИРУЕТ, КОГДА ТЫ РАССЫПАЕШЬСЯ.`  
ACTION=REWRITE  
WHY=Less abstract and closer to the actual source payoff. Present as editorial copy.

## B-roll

ASSET=NONE  
OBSERVED_CONTENT=Gallery source; Evgeniia's delivery and participants' reactions remain visible  
INSERT_POSITION=NONE  
FUNCTION=TALKING-HEAD AUTHORITY  
KEEP|REJECT|ALTERNATIVE_NEEDED=NO B-ROLL  
WHY=The source depends on relational expression; generic intimacy footage would weaken the conceptual distinction.

## Risks / unresolved questions

- Gallery crop/layout remains a later design decision.

## Recommendation

APPROVE_WITH_CHANGES

---

# R04 — Compromise vs Consensus

EDITORIAL_STATUS=CONCEPT STRONG / CLEAN START APPROVED; COMPACT SPLICE PENDING  
CURRENT_SOURCE_DURATION=48.84 s  
RECOMMENDED_FINAL_DURATION=51–53 s  
DISPLAY_RU_STATUS=C05_C07_AND_CLEAN_START_HUMAN_APPROVED

## Core thesis

Compromise can make one side betray something important. Their alternative is to hold the opposing needs until a third solution appears.

## Source clips

### r04-principle

SOURCE_TIMECODE=00:39:06.500 --> 00:39:46.220  
REVIEW_CLIP=`reel-input/r04-compromise-vs-consensus/public/clips/001_principle.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Evgeniia Nikulina is visibly speaking  
EDGE_STATUS=Clean start 00:39:13.240 and compact candidate A HUMAN APPROVED; current package source clip remains unchanged because final timeline is unauthorized  
SOURCE_TEXT_STATUS=C05/C06 ACCEPTED; C07 ACCEPTED WITH DISPLAY `coniunctio`

### r04-example

SOURCE_TIMECODE=00:47:16.370 --> 00:47:25.490  
REVIEW_CLIP=`reel-input/r04-compromise-vs-consensus/public/clips/002_example-payoff.mp4`  
SPEAKER_VERIFIED=HUMAN CONFIRMED — Denis, Club participant / Russian interpreter for Andrew in the Zoom session  
EDGE_STATUS=HUMAN APPROVED after `и это не работало`  
SOURCE_TEXT_STATUS=C08 EXCLUDED FROM FINAL EDIT; no remediation required

## Exact transcript corrections

- C05 ACCEPTED.
- C06 ACCEPTED; the pitch change at `и только консенсус` is not a semantic cut.
- C07 ACCEPTED WITH DISPLAY NORMALIZATION: source pronunciation approximately `коньюнктио`, DISPLAY `coniunctio`.
- C08 EXCLUDED FROM FINAL EDIT; no additional canonical repair is required for the selected structure.

## Recommended cut

Current package sequence remains unchanged pending final listening. Compact candidate preview proposes:

1. `00:47:16.370 --> 00:47:16.590` — retain `Мы`.
2. Hard cut to `00:47:17.950 --> 00:47:25.490` — `пытались как-то договориться... но всегда это был компромисс и это не работало`.
3. Hard cut to the human-approved clean principle start `00:39:13.240`.

The first repeated `всегда шли на компромисс` is removed at canonical word boundaries. This candidate exists only under `scratch_check/final_human_gate/r04/`; source manifest and timelines are not changed.

## Removed/filler material

- Remove `00:47:26.290 --> 00:47:56.230` from the recommended edit. Its middle is badly transcribed and the ending `она сработала` lacks an antecedent if isolated.
- Keep the entire principle only after ear-approved corrections; internal removal would make the “third” solution concept hard to follow.

## DISPLAY RU

Human-approved reading/display layer for retained material:

> Мы пытались как-то договориться: «Ну ладно, давай в Париже, давай как-то подстроимся». Но это всегда был компромисс, и это не работало.

> И так интересно, то есть мы можем прийти к консенсусу — только к консенсусу, мы не можем прийти к компромиссу. То есть компромисс — это всегда у нас разрушающая история. Вот, я понимаю, что я себя предаю, если я иду на компромисс, или он себя предаёт, если мы идём на компромисс, и только консенсус — как третье. Да, вот помните, кто у меня в тантре coniunctio? Вот эта история, когда встречаются две противоположности и, выдерживая интенсивность, они рождают что-то третье. И вот у нас всегда так.

This is approved human wording in the mutable display/decision layer. It does not rewrite canonical ASR.

## Hook

CURRENT=`КОМПРОМИСС ИЛИ КОНСЕНСУС?`  
RECOMMENDATION=SAME  
ACTION=KEEP  
WHY=Immediate conceptual tension and no overclaim.

## Punch/end cards

CURRENT=`НЕ УСТУПИТЬ ПОПОЛАМ — НАЙТИ ТРЕТЬЕ РЕШЕНИЕ`  
RECOMMENDATION=`НЕ ДЕЛИТЬ ПОПОЛАМ. НАЙТИ ТРЕТЬЕ.`  
ACTION=REWRITE  
WHY=Shorter and more memorable while staying inside the source's “something third” claim.

## B-roll

ASSET=`public/media/broll_reel2_04.mp4`  
OBSERVED_CONTENT=Warm portrait corridor/restaurant shot; the couple holds a sustained embrace, viewed mostly from behind  
INSERT_POSITION=Over the discontinuous jump from concrete example to principle  
FUNCTION=TRANSITION MASK / RELATIONSHIP CHEMISTRY  
KEEP|REJECT|ALTERNATIVE_NEEDED=KEEP OPTIONAL, about 1.0–1.5 s  
WHY=It can honestly mask the large source jump. Keep the third-solution payoff on the speaker's face.

## Risks / unresolved questions

- Compact candidate A and the clean principle start are human-approved as the recommendation.
- Final package/timeline construction remains explicitly unauthorized.

## Recommendation

NEEDS_REVIEW

---

# R05 — Adult Love Is Conditional

EDITORIAL_STATUS=VERY STRONG / HUMAN-APPROVED EARLIER START APPLIED  
CURRENT_SOURCE_DURATION=55.98 s  
RECOMMENDED_FINAL_DURATION=57–59 s  
DISPLAY_RU_STATUS=NEEDS_MINOR_EDIT

## Core thesis

Adult love contains conditions and boundaries. Accepting that can mark a transition from a child part demanding unconditional love toward maturity and structure.

## Source clips

### r05-conditions-boundaries

SOURCE_TIMECODE=03:22:13.070 --> 03:23:09.050  
REVIEW_CLIP=`reel-input/r05-adult-love-is-conditional/public/clips/001_full-argument.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Evgeniia Nikulina is visibly speaking; Andrew listens  
EDGE_STATUS=HUMAN APPROVED at both edges; final phrase `и это прям круто` complete  
SOURCE_TEXT_STATUS=C09 ACCEPTED — `красивый`, colloquial syntax preserved

CURRENT_EDGE=03:22:21.470  
PROPOSED_EDGE=03:22:13.070  
REASON=The current clip begins with dependent `что даже...`. The preceding complete clause supplies its cause: `потому что привычка доказывать эту ценность, она настолько въедена в психику...`  
CONTEXT_REVIEW=`scratch_check/editorial_review/r05-adult-love-is-conditional/r05-preceding-context.mp4`

## Exact transcript corrections

- C09 ACCEPTED: `такой красивый есть`, preserving the speaker's colloquial wording.
- The earlier edge was human-approved and applied as an editorial source extension, not an ASR correction.

## Recommended cut

Retain one continuous interval:

1. `03:22:13.070 --> 03:23:09.050` (55.98 s)

Option B — retain the current source and add a context card — is not recommended: it asks a card to repair spoken grammar and delays the hook. The slightly earlier source edge is more honest and remains within target.

## Removed/filler material

- No internal removal recommended. The progression from conditioned worth → adult love → child part → boundaries → embodied confidence is coherent.
- If profanity is unsuitable for a distribution context, that is a platform/brand decision; do not silently replace source speech.

## DISPLAY RU

> Потому что привычка доказывать эту ценность настолько въедена в психику, что даже когда уже как бы все тебя безусловно, до конца всего приняли, ты всё равно начинаешь понимать, что взрослая любовь всё равно условна. И там начинается момент взросления. То есть когда ты принимаешь условную любовь как что-то очень классное, развивающее тебя и здоровое, тут начинается переход от твоей детской части, которая хочет безусловно: «Люби меня за то, что я просто такой красивый есть», — до того, что, блять, оказывается, условия — это прям классно, границы — это прям круто, блять, меня возвращают и структурируют. Блин, у меня яйца начинают появляться — какие-то другого формата, другого размера, — и это прям круто.

Punctuation is proposed; profanity and idiolect are preserved.

## Hook

CURRENT=`ВЗРОСЛАЯ ЛЮБОВЬ ВСЁ РАВНО УСЛОВНА`  
RECOMMENDATION=SAME  
ACTION=KEEP  
WHY=Provocative, immediately comprehensible, and directly spoken in the source.

## Punch/end cards

CURRENT=`УСЛОВИЯ И ГРАНИЦЫ МОГУТ БЫТЬ ЗДОРОВЫМИ`  
RECOMMENDATION=SAME  
ACTION=KEEP OR USE AS ON-FOOTAGE PUNCH  
WHY=Safe claim directly supported by `классное, развивающее тебя и здоровое`.

## B-roll

ASSET=NONE  
OBSERVED_CONTENT=Strong close talking-head; Evgeniia speaks directly and gestures, Andrew's reaction remains available  
INSERT_POSITION=NONE  
FUNCTION=AUTHORITY / REACTION  
KEEP|REJECT|ALTERNATIVE_NEEDED=NO B-ROLL  
WHY=The provocative language and facial delivery are the asset.

## Risks / unresolved questions

- Explicit profanity may affect platform/brand use, but must not be silently rewritten.

## Recommendation

APPROVE_WITH_CHANGES

---

# R06 — What Do You Actually Know Is True?

EDITORIAL_STATUS=CLEANEST / HUMAN AUDIO AND CONTENT APPROVED  
CURRENT_SOURCE_DURATION=36.06 s  
RECOMMENDED_FINAL_DURATION=39–41 s  
DISPLAY_RU_STATUS=EDITORIAL_COPY_READY_FOR_LATER_DESIGN_PILOT

## Core thesis

Separate actual evidence from anxiety and expectation: what do you know happened, and how much evidence is enough for trust?

## Source clips

### r06-self-question

SOURCE_TIMECODE=02:17:04.460 --> 02:17:08.820  
REVIEW_CLIP=`reel-input/r06-what-is-actually-true/public/clips/001_hook.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Evgeniia Nikulina  
EDGE_STATUS=HUMAN APPROVED  
SOURCE_TEXT_STATUS=HIGH CONFIDENCE

### r06-evidence-question

SOURCE_TIMECODE=02:17:08.820 --> 02:17:18.160  
REVIEW_CLIP=`reel-input/r06-what-is-actually-true/public/clips/002_second-question.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Andrew  
EDGE_STATUS=HUMAN APPROVED; continuous after previous clip  
SOURCE_TEXT_STATUS=HIGH CONFIDENCE

### r06-facts

SOURCE_TIMECODE=02:17:28.600 --> 02:17:40.340  
REVIEW_CLIP=`reel-input/r06-what-is-actually-true/public/clips/003_payoff.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Andrew  
EDGE_STATUS=HUMAN APPROVED  
SOURCE_TEXT_STATUS=HIGH CONFIDENCE

### r06-reality

SOURCE_TIMECODE=02:17:45.640 --> 02:17:56.260  
REVIEW_CLIP=`reel-input/r06-what-is-actually-true/public/clips/004_context.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Evgeniia Nikulina  
EDGE_STATUS=HUMAN APPROVED  
SOURCE_TEXT_STATUS=HIGH CONFIDENCE

## Exact transcript corrections

No source correction proposed. The independent pass confirms all four semantic lines; punctuation differs only.

## Recommended cut

Keep all four current intervals in the documented sequence. Total speech is 36.06 s. Use a 1.5–2.0 s hook and one brief punch overlay; do not pad toward 40 s with filler.

## Removed/filler material

- Existing source gaps already omit repeated/interpretive connective material.
- No further source removal is needed.

## DISPLAY RU

> Вопрос, который нужно задать себе: что я точно знаю как правду?

> А другой человек должен спросить тебя: сколько доказательств тебе нужно, чтобы поверить мне?

> Первый вопрос к тебе на самом деле о том: что ты знаешь наверняка? Что этот человек действительно сделал?

> Первый вопрос: что я действительно знаю по факту? Что из этого является правдой? Что действительно сделал этот человек? Что действительно сделал я? Что на самом деле произошло в реальности?

English spans remain phrase-group aligned. The third paragraph is a minor retranslation for natural Russian, not a source rewrite.

## Hook

CURRENT=`ЧТО ТЫ ТОЧНО ЗНАЕШЬ КАК ПРАВДУ?`  
RECOMMENDATION=`ЧТО ТЫ ЗНАЕШЬ НАВЕРНЯКА?`  
ACTION=REWRITE  
WHY=Faster and idiomatic while preserving the exact question.

## Punch/end cards

CURRENT=`СКОЛЬКО ДОКАЗАТЕЛЬСТВ ТЕБЕ ДОСТАТОЧНО?`  
RECOMMENDATION=`СКОЛЬКО ДОКАЗАТЕЛЬСТВ ТЕБЕ НУЖНО, ЧТОБЫ ПОВЕРИТЬ?`  
ACTION=REWRITE  
WHY=Adds the missing object of the question and preserves source meaning.

## B-roll

ASSET=NONE  
OBSERVED_CONTENT=Clean close two-person frame with visible alternating speakers and reactions  
INSERT_POSITION=NONE  
FUNCTION=DIRECT QUESTION / RELATIONAL PROOF  
KEEP|REJECT|ALTERNATIVE_NEEDED=NO B-ROLL  
WHY=Faces and alternating language are the visual structure.

## Risks / unresolved questions

- Design/typography work is explicitly deferred to a later batch.

## Recommendation

APPROVE_WITH_CHANGES

---

# R07 — Kneeling / Returning to the Body

EDITORIAL_STATUS=STRONG / CORRECTIONS APPROVED; TWO SPLICE PREVIEWS PENDING  
CURRENT_SOURCE_DURATION=71.77 s  
RECOMMENDED_FINAL_DURATION=57–59 s  
DISPLAY_RU_STATUS=C10_AND_ALWAYS_HUMAN_APPROVED

## Core thesis

Kneeling is reframed not merely as kneeling before a person, but as slowing down, grounding, and returning to bodily experience; the guest then describes discomfort making thought physically lived.

## Source clips

### r07-reframe

SOURCE_TIMECODE=00:14:28.890 --> 00:15:17.520  
REVIEW_CLIP=`reel-input/r07-kneeling-return-to-body/public/clips/001_definition.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Evgeniia Nikulina is speaking in the labelled gallery tile  
EDGE_STATUS=Outer start plus two proposed internal word/segment boundaries require human phoneme checks  
SOURCE_TEXT_STATUS=HIGH CONFIDENCE

### r07-lived-experience

SOURCE_TIMECODE=00:15:38.180 --> 00:16:01.320  
REVIEW_CLIP=`reel-input/r07-kneeling-return-to-body/public/clips/002_guest-proof.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Andrew is visibly speaking; Evgeniia listens  
EDGE_STATUS=START AND END HUMAN APPROVED; final phrase `like actually you live it`, final word `it`  
SOURCE_TEXT_STATUS=C10 ACCEPTED

## Exact transcript corrections

- C10 ACCEPTED: `feel what you're saying` is restored after `feel what you're thinking about`.
- R07 `всегда` ACCEPTED: `Динамика всегда высвобождает...` in SOURCE/DISPLAY correction layer.

## Recommended cut

Retain exactly:

1. `00:14:28.890 --> 00:14:43.550` — reframe through `вернуться в тело` (14.66 s).
2. `00:15:00.000 --> 00:15:17.520` — container/one-question/anxiety mechanism (17.52 s).
3. `00:15:38.180 --> 00:16:01.320` — guest lived experience (23.14 s).

Total retained speech: 55.32 s.

## Removed/filler material

- Remove `00:14:43.570 --> 00:14:59.950`: self-deprecating intelligence aside and “сначала больно, потом приятно”. It is vivid but pulls the Reel toward pain/sexual dynamics instead of grounding/body.
- Preserve the physiological/container explanation; it bridges the reframe to the guest's bodily proof.

## DISPLAY RU

> И вот, когда я поняла, что значит стать на колени, — это не стать на колени перед человеком. Это стать на колени, чтобы успокоиться, чтобы заземлиться, чтобы вообще прийти в себя, вернуться в тело.

> Динамика всегда высвобождает очень большое количество эндорфинов именно от того, что тебя успокаивают, тебе дают контейнер, тебе задают один вопрос в одну секунду, тогда как наш мозг обрабатывает миллион вопросов за одну секунду — и это очень сильно вызывает тревожность.

> Для меня самое полезное начиналось после первых десяти минут на коленях: становится больно и некомфортно, и это заставляет тебя почувствовать, о чём ты думаешь, почувствовать, что ты говоришь, — то есть ты действительно это проживаешь.

C10 is human-approved. Translation remains phrase-group aligned; no Russian acoustic word timestamps were created for English speech.

## Hook

CURRENT=`СТАТЬ НА КОЛЕНИ — НЕ ОБЯЗАТЕЛЬНО ПЕРЕД ЧЕЛОВЕКОМ`  
RECOMMENDATION=`НА КОЛЕНИ — НЕ ПЕРЕД ЧЕЛОВЕКОМ. ЧТОБЫ ВЕРНУТЬСЯ В ТЕЛО.`  
ACTION=REWRITE  
WHY=Combines surprise with the actual grounding payoff and avoids implying a broader anti-submission claim.

## Punch/end cards

CURRENT=`ЗАМЕДЛИТЬСЯ. ЗАЗЕМЛИТЬСЯ. ВЕРНУТЬСЯ В ТЕЛО.`  
RECOMMENDATION=SAME  
ACTION=KEEP AS OVERLAY  
WHY=Clear, supported, and rhythmically strong.

## B-roll

ASSET=`public/media/broll_reel2_06.mp4`  
OBSERVED_CONTENT=Low-angle moving portrait selfie of the couple smiling/walking together under an umbrella; no feet/grounding imagery  
INSERT_POSITION=Originally proposed between host and guest  
FUNCTION=Originally GROUNDING / PACE RESET; actual content is RELATIONSHIP CHEMISTRY  
KEEP|REJECT|ALTERNATIVE_NEEDED=REJECT; alternative not needed  
WHY=The actual asset contradicts the planned function and would make the bodily reframe feel romantic rather than grounded. Keep the speaker/gallery transition or use a card.

## Risks / unresolved questions

- JOIN 1 and the complete retained sequence are approved; JOIN 2 uses selected 20 ms audio smoothing option A.

## Recommendation

APPROVE_WITH_CHANGES

---

# R08 — Where Do You Fall Apart?

EDITORIAL_STATUS=GOOD THESIS / C12 RETAINED; COMPLETE-SENTENCE JOIN PENDING  
CURRENT_SOURCE_DURATION=60.22 s  
RECOMMENDED_FINAL_DURATION=42–44 s  
DISPLAY_RU_STATUS=C11_C12_HUMAN_APPROVED

## Core thesis

Study your internal parts so you can notice which part takes over or falls apart under pressure; do not force those parts into generic archetype labels.

## Source clips

### r08-observe-parts

SOURCE_TIMECODE=02:37:23.820 --> 02:37:54.480  
REVIEW_CLIP=`reel-input/r08-where-do-you-fall-apart/public/clips/001_hook-context.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Evgeniia Nikulina is visibly speaking/gesturing  
EDGE_STATUS=Technical/visual pass; proposed internal segment joins need human checks  
SOURCE_TEXT_STATUS=C11 ACCEPTED — `эго-личности`

### r08-protective-parts

SOURCE_TIMECODE=02:38:54.240 --> 02:39:23.800  
REVIEW_CLIP=`reel-input/r08-where-do-you-fall-apart/public/clips/002_payoff.mp4`  
SPEAKER_VERIFIED=VISUAL_MATCH — Evgeniia Nikulina  
EDGE_STATUS=Technical/visual pass; proposed internal skip needs human check  
SOURCE_TEXT_STATUS=C12 ACCEPTED AND RETAINED — `на много эго-личностей`

## Exact transcript corrections

- C11 ACCEPTED: `Первым этапом изучите свои эго-личности.`
- C12 ACCEPTED AND RETAINED: `на много эго-личностей`; the previous exclusion is superseded because `психика` alone is not a complete editorial endpoint.

## Recommended cut

Retain exactly:

1. `02:37:23.820 --> 02:37:30.800` — study parts / where you fall apart (6.98 s).
2. `02:37:47.300 --> 02:37:54.480` — observe how you relate / deep self-reflection (7.18 s).
3. `02:38:54.240 --> 02:39:11.800` candidate — protective forms, trauma, and the complete `психика на много эго-личностей` thought, including a small post-phrase tail (17.56 s).
4. `02:39:13.640 --> 02:39:23.800` candidate — short pre-roll into `Вот смотри`, then do not bind to twelve archetypes/name your own parts (10.16 s).

Candidate retained source: 41.88 s. Final source boundaries remain pending human approval of Option A; no timeline is authorized.

## Removed/filler material

- Remove the parenting example `02:37:31.180 --> 02:37:45.860`; it is specific but delays the general method and introduces a second topic.
- Retain C12 through `02:39:11.580`; the old `психика`-only boundary is human-rejected.
- Remove most of the pause before the archetype sentence while preserving the Option A pre-roll.

## DISPLAY RU

Human-approved correction/display layer:

> Первым этапом изучите свои эго-личности. Потом вы сможете понять, в какой части себя вы рассыпаетесь. Вы изучаете себя — как вы разговариваете с людьми. Вам нужно уйти в глубокую саморефлексию.

> Эти защитные формы обычно защищают травмированного ребёнка. Они возникают в расщеплении психики, в ранней детской травме. Когда в детстве с ребёнком происходит какая-то невыносимая история, у него начинает расщепляться психика на много эго-личностей. Вот смотри: лучше не привязываться к двенадцати архетипам. Мы взяли и изучили себя отдельно от всех архетипов, мы назвали себя своими именами.

C11/C12 are human-confirmed in the mutable layer; immutable canonical ASR is unchanged.

## Hook

CURRENT=`В КАКОЙ ЧАСТИ СЕБЯ ТЫ РАССЫПАЕШЬСЯ?`  
RECOMMENDATION=SAME  
ACTION=KEEP  
WHY=Strong direct question and exact conceptual center.

## Punch/end cards

CURRENT=`НЕ ПОДГОНЯЙ СЕБЯ ПОД АРХЕТИП — НАЗОВИ СВОИ ЧАСТИ СВОИМИ ИМЕНАМИ`  
RECOMMENDATION=`НЕ ПОДГОНЯЙ СЕБЯ ПОД АРХЕТИПЫ. НАЗОВИ СВОИ ЧАСТИ.`  
ACTION=REWRITE  
WHY=Shorter and avoids the awkward duplicate `свои ... своими` while staying supported.

## B-roll

ASSET=NONE  
OBSERVED_CONTENT=Close talking-head; Evgeniia gestures through conceptually dense material while Andrew listens  
INSERT_POSITION=NONE  
FUNCTION=AUTHORITY / CONCEPTUAL CLARITY  
KEEP|REJECT|ALTERNATIVE_NEEDED=NO B-ROLL  
WHY=Stable face and readable subtitles are more useful than metaphorical footage for this density.

## Risks / unresolved questions

- JOIN 1 and complete-sentence Option A are human-approved. The old `психика`-only boundary/B1 are permanently rejected.
- The trauma/psyche passage is clinically loaded; do not intensify it in cards or imply diagnosis beyond the speaker's words.

## Recommendation

NEEDS_REVIEW

---

## Human decision checklist

1. Recheck the extended R02 context endpoint at `01:19:12.320`; it now includes complete `unique` and stops before unrelated speech.
2. Human audio/editorial decisions are closed for R01–R08.
3. Review `out/r06-what-is-actually-true-semantic-repair-candidate.mp4`; R06 semantic approval and all series production remain pending.
4. Preserve phrase-group-only alignment for translated English; do not fabricate Russian word timings.
5. Approve card rewrites as editorial copy, never quotation.
6. Review the proposed B-roll mapping visually; no final B-roll has been copied into Reel packages.
7. Only after the remaining decisions may a DRAFT timeline recipe be authored. No timeline or final render is authorized by this document.
