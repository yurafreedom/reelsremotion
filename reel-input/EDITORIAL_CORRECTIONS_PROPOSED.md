# Editorial transcript corrections proposed

STATUS=C01_C12_AND_R07_ALWAYS_HUMAN_DECISIONS_APPLIED; HUMAN_EAR_GATE_CLOSED  
CANONICAL_ASR_MODIFIED=NO  
SOURCE_MANIFESTS_MODIFIED=YES_MUTABLE_REVIEW_LAYER_ONLY  
HUMAN_DECISION_ARTIFACT=`reel-input/HUMAN_EDITORIAL_DECISIONS.md`

This ledger compares the canonical episode ASR with an independent targeted
faster-whisper `small` CPU/int8 pass over the 17 extracted review clips. The
second pass is review evidence only. Human decisions C01–C12 and the R07
`всегда` correction are recorded below and in
`reel-input/HUMAN_EDITORIAL_DECISIONS.md`.
Nothing in this ledger rewrites the immutable episode-level canonical ASR.

## C01 — R01 repeated verb

DECISION=ACCEPT  
APPROVED_SOURCE_TEXT=`теряешь`  
SOURCE_INTERVAL=00:17:34.400 --> 00:17:34.880  
ASR_TEXT=`потеряешь`  
HEARD_TEXT=`теряешь`  
CONFIDENCE=MEDIUM_HIGH_INDEPENDENT_ASR  
REASON=The targeted pass and human listener confirm the present-tense repetition “теряешь себя, теряешь путь”.  
REVIEW_CLIP=`reel-input/r01-fear-of-losing-yourself/public/clips/001_hook.mp4`

## C02 — R01 borrowed term spelling (display normalization, not source correction)

DECISION=ACCEPT  
APPROVED_SOURCE_TEXT=`консента`  
APPROVED_DISPLAY_TEXT=`консента`  
SOURCE_INTERVAL=00:17:50.260 --> 00:17:50.720  
ASR_TEXT=`концента`  
HEARD_TEXT=`консента` / English `consent`  
CONFIDENCE=MEDIUM_CONTEXT_ONLY  
REASON=The human listener confirms the intentional Russian inflected borrowing `консента`; preserve it in SOURCE and DISPLAY.  
REVIEW_CLIP=`reel-input/r01-fear-of-losing-yourself/public/clips/002_payoff.mp4`

## C03 — R02 missing negation/action in the question

DECISION=ACCEPT  
SPEAKER=Evgeniia Nikulina  
APPROVED_SOURCE_MEANING=`couldn't just let yourself see someone, just date, just make love...`  
SOURCE_INTERVAL=01:16:08.620 --> 01:16:16.840  
ASR_TEXT=`to the point where you can just let yourself see someone, just make love without feeling guilty or burdened by responsibility`  
HEARD_TEXT=`to the point where you couldn't just let yourself see someone, just date, just make love without feeling guilty or burdened by responsibility`  
CONFIDENCE=HIGH_INDEPENDENT_ASR  
REASON=The human listener confirms the negative construction and “just date”; both materially affect meaning and match the surrounding over-responsibility question.  
REVIEW_CLIP=`reel-input/r02-connection-without-future/public/clips/001_question.mp4`

## C04 — R02 mixed-language corruption at the value beat

DECISION=PARTIALLY_APPROVED  
APPROVED_START=`to actually indulge in that pleasure, to meet someone...`  
REMAINDER_STATUS=PENDING_OPTIONAL_REVIEW  
SOURCE_INTERVAL=01:18:51.520 --> 01:18:58.840  
ASR_TEXT=`Это очень actionally indulging that pleasure to meet someone...`  
HEARD_TEXT=`to actually indulge in that pleasure, to meet someone...`  
CONFIDENCE=HIGH_INDEPENDENT_ASR  
REASON=The human listener confirms the approved start against the surrounding Russian/English context. The exact remainder may still be reviewed separately.  
REVIEW_CLIP=`reel-input/r02-connection-without-future/public/clips/002_context.mp4`

## C05 — R04 principle opening

DECISION=ACCEPT  
APPROVED_SOURCE_TEXT=`И так интересно, то есть мы можем прийти к консенсусу — только к консенсусу, мы не можем прийти к компромиссу...`  
SOURCE_INTERVAL=00:39:06.500 --> 00:39:18.860  
ASR_TEXT=`то есть мы можем прийти консенсуса только... только консенсуса мы не можем прийти`  
HEARD_TEXT=`И так интересно, то есть мы можем прийти к консенсусу — только к консенсусу, мы не можем прийти к компромиссу...`  
CONFIDENCE=MEDIUM_INDEPENDENT_ASR  
REASON=The human listener confirms the restored prepositions and coherent consensus/compromise contrast.  
REVIEW_CLIP=`reel-input/r04-compromise-vs-consensus/public/clips/001_principle.mp4`

## C06 — R04 corrupted compromise clause

DECISION=ACCEPT  
APPROVED_SOURCE_TEXT=`То есть компромисс — это всегда у нас разрушающая история. Вот, я понимаю, что я себя предаю, если я иду на компромисс, или он себя предаёт, если мы идём на компромисс, и только консенсус — как третье...`  
PITCH_CHANGE_AT_ONLY_CONSENSUS=NOT_A_SEMANTIC_CUT  
SOURCE_INTERVAL=00:39:18.860 --> 00:39:37.180  
ASR_TEXT=`компромисс это всегда у нас разрушающая история, вот яction я себя придаю если я иду на компромисс или он себе предает если мы идётבעon и только консенсус, как третья`  
HEARD_TEXT=`компромисс — это всегда у нас разрушающая история; вот я понимаю, что я себя предаю, если я иду на компромисс, или он себя предаёт, если мы идём на компромисс; и только консенсус — как третье`  
CONFIDENCE=MEDIUM_CONTEXT_PLUS_INDEPENDENT_ASR  
REASON=The human listener confirms `я себя предаю`, `он себя предаёт`, and `если мы идём на компромисс`. The approved text lives only in the mutable decision/display layer.  
REVIEW_CLIP=`reel-input/r04-compromise-vs-consensus/public/clips/001_principle.mp4`

## C07 — R04 named concept

DECISION=ACCEPT_WITH_DISPLAY_NORMALIZATION  
APPROVED_SOURCE_PRONUNCIATION=`approximately коньюнктио`  
APPROVED_DISPLAY_TEXT=`coniunctio`  
SOURCE_INTERVAL=approximately 00:39:33.000 --> 00:39:37.180  
ASR_TEXT=`конюнктео`  
HEARD_TEXT=`approximately коньюнктио`  
CONFIDENCE=HUMAN_APPROVED_APPROXIMATE_PRONUNCIATION  
REASON=Human approved only the approximate source pronunciation `коньюнктио` and the normalized DISPLAY form *coniunctio*; no more exact Russian phonetic spelling is claimed.  
REVIEW_CLIP=`reel-input/r04-compromise-vs-consensus/public/clips/001_principle.mp4`

## C08 — R04 practical-example middle

DECISION=EXCLUDED_FROM_FINAL_EDIT  
REMEDIATION_REQUIRED=NO  
SOURCE_INTERVAL=00:47:26.290 --> 00:47:53.350  
ASR_TEXT=`Мы вообще говорили практически о том, как мы могли сделать это работе. И у нас были несколько идей, которые мы начали сомневаться. И потом, когда мы говорили...`  
HEARD_TEXT=`И потом, когда [это/что-то] сработало, мы начали практически говорить о том, как мы можем сделать так, чтобы это работало. И одна из идей, которую мы обсуждали, — ты про неё шутила...`  
CONFIDENCE=LOW_MEDIUM_INDEPENDENT_ASR  
REASON=The canonical sentence is malformed; the second pass is more coherent but still uncertain. The recommended short edit drops this middle rather than laundering an unverified correction.  
REVIEW_CLIP=`reel-input/r04-compromise-vs-consensus/public/clips/002_example-payoff.mp4`

## C09 — R05 malformed adjective

DECISION=ACCEPT  
APPROVED_SOURCE_TEXT=`красивый`  
APPROVED_DISPLAY_TEXT=`красивый`  
PRESERVE_COLLOQUIAL_SYNTAX=YES  
SOURCE_INTERVAL=03:22:52.510 --> 03:22:52.990  
ASR_TEXT=`красивей`  
HEARD_TEXT=`красивый`  
CONFIDENCE=MEDIUM_HIGH_INDEPENDENT_ASR  
REASON=The human listener confirms “люби меня за то, что я просто такой красивый есть”. Preserve the speaker's colloquial syntax.  
REVIEW_CLIP=`reel-input/r05-adult-love-is-conditional/public/clips/001_full-argument.mp4`

## C10 — R07 guest phrase omitted by canonical ASR

DECISION=ACCEPT  
APPROVED_SOURCE_TEXT=`that makes you feel what you're thinking about, feel what you're saying`  
APPROVED_DISPLAY_RU=`и это заставляет тебя почувствовать, о чём ты думаешь, почувствовать, что ты говоришь, — то есть ты действительно это проживаешь.`  
ALIGNMENT=`phrase-group-only; no Russian acoustic word timestamps`  
SOURCE_INTERVAL=00:15:49.080 --> 00:15:56.500  
ASR_TEXT=`that makes you feel what you're thinking about`  
HEARD_TEXT=`that makes you feel what you're thinking about, feel what you're saying`  
CONFIDENCE=HUMAN_CONFIRMED  
REASON=Human listener confirms the omitted parallel phrase and the complete ending `like actually you live it.`  
REVIEW_CLIP=`reel-input/r07-kneeling-return-to-body/public/clips/002_guest-proof.mp4`

## R07 — omitted `всегда`

DECISION=ACCEPT  
APPROVED_SOURCE_TEXT=`Динамика всегда высвобождает`  
APPROVED_DISPLAY_TEXT=`Динамика всегда высвобождает`  
SOURCE_INTERVAL=00:15:00.560 --> 00:15:02.100  
REASON=Human editor confirms `всегда`; correction is stored only in mutable review/display provenance.  
REVIEW_CLIP=`reel-input/r07-kneeling-return-to-body/public/clips/001_definition.mp4`

## C11 — R08 key term at the hook

DECISION=ACCEPT  
APPROVED_SOURCE_TEXT=`Первым этапом изучите свои эго-личности.`  
APPROVED_DISPLAY_TEXT=`Первым этапом изучите свои эго-личности.`  
SOURCE_INTERVAL=02:37:23.820 --> 02:37:26.500  
ASR_TEXT=`Первым этапом изучите свои галичности.`  
HEARD_TEXT=`Первым этапом изучите свои эго-личности.`  
CONFIDENCE=HUMAN_CONFIRMED  
REASON=Human listener explicitly rejects both `субличности` and `галичности` and confirms `эго-личности`.  
REVIEW_CLIP=`reel-input/r08-where-do-you-fall-apart/public/clips/001_hook-context.mp4`

## C12 — R08 split-psyche phrase

DECISION=ACCEPT  
APPROVED_SOURCE_TEXT=`на много эго-личностей`  
C12_RESOLVED=YES  
C12_RETAIN_IN_RECOMMENDED_EDIT=YES  
C12_PREVIOUS_EXCLUSION_SUPERSEDED=YES  
SOURCE_INTERVAL=02:39:10.120 --> 02:39:11.580  
ASR_TEXT=`намного оеголичности`  
HEARD_TEXT=`на много эго-личностей`  
CONFIDENCE=HUMAN_CONFIRMED  
REASON=Human listener resolves the correction provenance and confirms the complete thought requires this phrase; the earlier exclusion is superseded.  
REVIEW_CLIP=`reel-input/r08-where-do-you-fall-apart/public/clips/002_payoff.mp4`

## Approval procedure

For each entry, the human editor should record:

```text
CORRECTION_ID=
DECISION=ACCEPT|REJECT|REWORD|UNRESOLVED
APPROVED_SOURCE_TEXT=
APPROVED_DISPLAY_TEXT=
LISTENER=
DATE=
NOTE=
```

All C01–C12 decisions are now recorded in the mutable correction/display layer.
The episode-level `asr_video1219377731.json` remains immutable provenance.
