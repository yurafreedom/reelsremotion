# ReelsRemotion: editorial-to-render production pipeline

This document is the canonical operating guide for a future Codex, Claude, or human editor. It assumes no knowledge of the conversation that created it.

Run every command from:

```bash
cd /Users/yurasachenko/ReelsRemotion
```

The current master `video1219377731.mp4` stays at the repository root. Never move or copy a long master into root `public/` or a per-Reel `public/`; Remotion bundles that directory. Only approved, trimmed render assets belong in a Reel's slim `public/`.

## 1. Architecture overview

```text
long master + native word ASR + editorial idea
                    |
                    v
 source discovery / literal quote / context / exact cut proposal
                    |
                    v
 reel-input/<slug>/ preproduction package
                    |
           editorial approval gate
                    |
                    v
 exact extracted clips + approved DISPLAY RU + phrase timing + B-roll
                    |
                    v
 approved timeline_recipe.json
                    |
        npm run reel:timeline -- <slug>
                    |
                    v
 canonical v3 timeline.json (tracks, absolute frames)
                    |
          validation + still/contact sheet
                    |
                    v
 compose/render_reel.ts -> Remotion "Reels" -> out/<slug>.mp4
                    |
                    v
 technical probe + editorial watch-through
```

The preparation CLI does not replace the renderer. It compiles approved editorial data into the renderer's established v3 contract. `timeline.json` is the render source of truth; the master/transcript/manifest remain the provenance source of truth.

## 2. Source authority hierarchy

Use the highest available layer:

1. source video/audio: literal speech, speaker, safe audio/visual cut;
2. native word-ASR JSON: machine timing and transcript provenance;
3. native SRT: cue-level timing derivative;
4. English translation SRT: English meaning layer for non-English spans;
5. contextual English→Russian mapping: DISPLAY RU layer for English speech;
6. cleaned/readable prose: semantic search only.

For the current episode:

```text
video1219377731.mp4
transcripts/video1219377731/asr_video1219377731.json
transcripts/video1219377731/subtitles_native.srt
transcripts/video1219377731/subtitles_en.srt
transcripts/video1219377731/en_spans_index.json
transcripts/video1219377731/en_spans_ru.json
transcripts/video1219377731/transcript_readable.txt
transcripts/video1219377731/transcript_full_clean.txt
transcripts/video1219377731/transcript_RU_full.txt
```

Never infer precise timecodes from prose. Never rewrite a quote silently. If the ASR is wrong, listen to the master and record an explicit correction before approval.

## 3. Canonical Reel package

```text
reel-input/<slug>/
  BRIEF.md                         editorial goal, constraints, approval state
  SOURCE_SELECTION.md             exact ranges, literal quote, cut/speaker notes
  source_manifest.json            machine provenance and extraction manifest
  SUBTITLE_SCRIPT.md               separate SOURCE and DISPLAY RU layers
  EDIT_PLAN.md                     Reel-relative proposed structure
  BROLL_PLAN.md                    existing candidates, function, insertion proposal
  QC_REPORT.md                     stage gates and technical/editorial checklist
  transcript/
    <clip-id>.source.srt           native source cues, source-absolute timecodes
    words_source.json              source-absolute + clip-relative native word timing
    translation_phrase_map.json   source phrase → DISPLAY RU phrase groups
  timeline_recipe.json            created/approved only after editorial review
  timeline.json                   generated v3 render source of truth
  public/
    clips/                         exact extracted talking-head/source clips
    media/                         approved B-roll/images/music only
out/
  <slug>.mp4                       final output; never source input
```

Large raw source media stays outside the package's `public/`. The current episode uses the root master directly in `source_manifest.json`; a future project may use a package `source/` directory only if that directory is never passed as `REEL_PUBLIC_DIR`.

## 4. Full operator workflow and gates

### A. Create the package

```bash
npm run reel:prepare -- <slug> "Human title"
```

The command creates missing files/directories and preserves existing files.

### B. Discover and quote source

Search readable prose for ideas, then establish exact source timing from native ASR:

```bash
npm run reel:quote -- 00:17:13.180 00:17:44.460 --format json
npm run reel:quote -- 00:17:13.180 00:17:44.460 --format srt --out /tmp/candidate.srt
npm run reel:quote -- 00:17:13.180 00:17:44.460 --format text
```

The selector uses half-open interval intersection: a cue ending exactly at the start belongs to the previous cut, and a cue starting exactly at the end belongs to the next. Boundary flags reveal a cut through a cue.

Fill `SOURCE_SELECTION.md`, `source_manifest.json`, `SUBTITLE_SCRIPT.md`, `EDIT_PLAN.md`, and `BROLL_PLAN.md`. SOURCE must remain literal. DISPLAY RU is independent editorial data.

### C. Validate preproduction

```bash
npm run reel:validate -- <slug>
```

Missing extracted clips are warnings at this stage. Provenance, boundaries, translation alignment declarations, and required documents are errors if invalid.

### D. Editorial approval gate

Before extraction/timeline work, a human editor must approve:

- exact source inclusion and exclusions;
- speaker identity and phoneme-safe edges;
- any ASR correction;
- DISPLAY RU and translation phrase grouping;
- hook/punch copy as editorial copy, never disguised as speech;
- proposed B-roll and discontinuous jumps;
- target duration/edit structure.

### E. Extract approved clips

```bash
npm run reel:extract -- <slug>
```

Review clips, update edges if required, then rerun only after removing/replacing a rejected review artifact deliberately. The extractor refuses overwrite.

### F. Approve a machine recipe

Copy the example and edit it:

```bash
cp reel-input/_templates/timeline_recipe.example.json reel-input/<slug>/timeline_recipe.json
```

Keep `approval_status` as `DRAFT` while editing. Use `clip_id` values from `source_manifest.json`, package-public relative paths for B-roll/music, and style names from `nikulina_style_tokens.json`. Set `approval_status` to `APPROVED` only after review.

### G. Generate and validate v3 timeline

```bash
npm run reel:timeline -- <slug>
npm run reel:validate -- <slug> --render
```

### H. Visual QA without Studio

```bash
REEL_PUBLIC_DIR="$PWD/reel-input/<slug>/public" \
npm run check -- "reel-input/<slug>/timeline.json" 0

REEL_PUBLIC_DIR="$PWD/reel-input/<slug>/public" \
npm run check -- "reel-input/<slug>/timeline.json" sheet
```

Review hook, every source boundary, every B-roll boundary, card transitions, subtitle-safe areas, and the final frame.

### I. Render

```bash
npm run reel:render -- <slug> "out/<slug>.mp4"
```

Equivalent low-level command:

```bash
REEL_PUBLIC_DIR="$PWD/reel-input/<slug>/public" \
npm run render:reel -- \
"reel-input/<slug>/timeline.json" \
"out/<slug>.mp4"
```

### J. Final QC

Probe the output, sample frames, listen, and complete `QC_REPORT.md`. A successful encoder exit is not editorial approval.

## 5. Deterministic clip extraction

Each manifest clip records:

- stable clip ID and role;
- source video;
- source start/end in seconds and timecode;
- expected duration;
- deterministic output path such as `public/clips/001_hook.mp4`;
- extraction mode;
- native subtitle segments and literal quote.

Default extraction is frame-accurate controlled re-encoding:

```bash
ffmpeg -nostdin -n \
  -ss <source-start-seconds> -i <master> -t <duration-seconds> \
  -map 0:v:0 -map 0:a? \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart -avoid_negative_ts make_zero \
  <package>/public/clips/<stable-name>.mp4
```

The operator command generates these arguments from the manifest and verifies duration with `ffprobe`.

Optional stream copy:

```bash
npm run reel:extract -- <slug> --copy
```

Use copy only when source keyframes make the boundary acceptable. It avoids re-encoding but can shift an exact visual/audio edge. Exact editorial cuts default to re-encoding. The master is opened read-only; `-n` prevents accidental output overwrite.

## 6. Subtitle provenance

Every clip must preserve all of the following:

- literal `source_quote`;
- the exact `source_subtitles[]` from native ASR;
- native segment IDs, language, source seconds and word records;
- source-absolute SRT cues;
- clip-relative word timing for rendering;
- boundary flags;
- speaker claim plus confidence/verification status;
- distinct DISPLAY RU object with type and provenance.

For Russian source speech, DISPLAY RU normally starts as the native source text. Punctuation/readability edits require explicit approval and a logged difference. For English source speech, the exact English stays in SOURCE and Russian stays in the translation layer.

The current contextual translation source was prepared with surrounding Russian context visible. Do not translate short interleaved English spans in isolation.

## 7. Translated subtitle alignment

Whisper's native English word timestamps belong to English sounds. Russian translation words were never spoken and receive no fabricated acoustic timestamps.

Use `transcript/translation_phrase_map.json`:

```json
{
  "source_start": 4731.52,
  "source_end": 4738.10,
  "clip_start": 0,
  "clip_end": 6.58,
  "source_text": "literal English phrase",
  "display_ru": "approved Russian phrase"
}
```

Each Russian phrase group occupies the acoustic interval of its corresponding English source phrase. Timing precision is phrase-level. If phrase equivalence is ambiguous, make a larger group; do not invent precision. Keep enough surrounding Russian transcript visible during translation/review to preserve referents, tone, and interleaved conversational meaning.

## 8. Word and phrase animation rules

Native speech uses existing verified native word timestamps. Translated speech uses the deliberate phrase groups above and derived visual timing only.

Visual principle:

- BODY: stable, readable subtitles; normally one or two lines;
- DYNAMICS: hooks, punch cards, transitions, and a few intentional semantic emphases;
- no constant per-word bouncing;
- no animation that implies false word-level translation precision.

### CUMULATIVE WORD REVEAL — MANDATORY SPEECH SUBTITLE CONTRACT

SPEECH_SUBTITLE_DEFAULT=CUMULATIVE_WORD_REVEAL  
FULL_PHRASE_EAGER_RENDER=FORBIDDEN  
PREVIOUS_WORDS_REMAIN_VISIBLE=YES  
LAYOUT_REFLOW=FORBIDDEN  
WORD_BOUNCE=NO  
KARAOKE_HIGHLIGHT=NO  
NATIVE_TIMING=SOURCE_WORD_TIMESTAMPS  
TRANSLATED_TIMING=DERIVED_VISUAL_REVEAL_INSIDE_PHRASE_GROUP  
FAKE_TRANSLATED_ACOUSTIC_TIMESTAMPS=FORBIDDEN

The compiler computes the final line breaks and positions first. Every visible token is mounted in that final layout from the phrase start with opacity 0, reveals over 2–3 frames, and remains visible until the whole semantic phrase clears. Punctuation is attached to its preceding token. Previously visible words never move, disappear individually, change color, bounce, or scale.

For Nikulina recipes, captions default to `role: "speech"`; non-spoken framing must be explicitly marked `role: "editorial"`. Speech captions share a semantic `phrase_id`. Native Russian groups consume `transcript/words_source.json` and must match source tokens in order. Translated groups reference an approved `translation_group_id` from `transcript/translation_phrase_map.json`; the compiler deterministically derives strictly increasing visual reveal frames inside that source interval and writes `timingType: "DERIVED_VISUAL_REVEAL"` plus `notAcousticWordAlignment: true`.

If required native words, an approved translation group, token equivalence, or phrase timing is absent, timeline generation stops with `WORD_REVEAL_DATA_MISSING`. It never silently emits a full eagerly visible Nikulina speech phrase. Editorial-only cards are exempt because they are not presented as synchronized speech.

“No karaoke” means no active-token highlighting, bouncing, token replacement, or per-word exit. It does not mean eager full-sentence display.

The baseline tokens live in `reel-input/_templates/nikulina_style_tokens.json`: 1080×1920/30, safe areas, wine/black/white/grey palette, subtitle/hook/punch/serif-accent styles, and restrained `fade-pop`. Change tokens or choose a token in the recipe; do not hard-code a new identity into React components.

## 9. B-roll workflow

Inventory an existing candidate directory:

```bash
npm run reel:broll -- \
  public/media \
  reel-input/_catalog/broll_inventory_public.json \
  scratch_check/broll-frames
```

The inventory records path, duration, dimensions, frame rate, codec, orientation, and optional representative frame. Human/Codex visual review then records actual observed content and useful source ranges in `BROLL_CATALOG.md` and each Reel's `BROLL_PLAN.md`.

Each proposal must specify an existing asset, source range, function, insertion position, expected duration, reason, and approval status. Useful functions include CONTEXT, EMOTIONAL BREATH, VISUAL METAPHOR, RELATIONSHIP CHEMISTRY, AUTHORITY, INTIMACY, TENSION, RELIEF, CLUB BRAND, TRANSITION MASK, and PACE RESET.

B-roll is optional. Do not use it where the speaker's facial reaction carries the meaning. Copy only approved render-used assets into the package `public/media/`.

## 10. Timeline generation

`timeline_recipe.json` is a compact, reviewable instruction. `timeline.json` is generated output.

The compiler:

- refuses any recipe not marked `APPROVED`;
- lays sequence items on one absolute 30 fps axis;
- maps manifest clip IDs to package-relative source assets;
- accounts for transition overlap;
- creates speech regions from native source words;
- emits separate video, B-roll image, shape, text, and optional audio tracks;
- applies parameterized typography and restrained animation tokens;
- leaves semantic subtitle timing independent from visual B-roll replacement.

Track responsibilities are explicit:

```text
VIDEO TRACK        talking head, source clips, cards
IMAGE TRACK(S)     muted B-roll/visual overlays
SHAPE TRACK        intentional graphics
TEXT TRACK         subtitles, hooks, punches
AUDIO TRACK        optional music; source speech remains on video clips
```

Never hand-author hundreds of absolute frames if the recipe can express the edit. If a special visual cannot be represented safely, extend the recipe/compiler narrowly while retaining v3 as output.

## 11. Render commands and output contract

Canonical:

```bash
npm run reel:render -- <slug> "out/<slug>.mp4"
```

Expected output:

- 1080×1920;
- 30 fps;
- H.264;
- yuv420p;
- limited-range BT.709;
- AAC stereo when audio exists.

The renderer uses PNG intermediate frames intentionally. Do not revert it to JPEG: the project previously observed Apple playback failures from full-range `yuvj420p`/incorrect color tags.

## 12. Validation and QC

Run engine regression gates before a production render:

```bash
npm test
npx tsc --noEmit
npm run reel:validate -- <slug> --render
```

After rendering:

```bash
ffprobe -v error -show_streams -show_format "out/<slug>.mp4"
ffmpeg -v error -i "out/<slug>.mp4" -map 0:a:0 -f null -
```

Technical checklist:

- all timeline assets exist under the slim public directory;
- dimensions/fps/duration/codecs/color tags/audio are correct;
- no unintended primary-track gaps or overlap;
- no missing or silent source audio;
- frames change through the Reel; no freeze/black output;
- contact sheet and critical stills match the final composition.

Editorial checklist:

- hook reads immediately;
- source quote and cuts match the master;
- no clipped word unless intentional;
- source and translation provenance remain recoverable;
- subtitles stay inside safe areas and normally within two lines;
- cards do not obscure required faces;
- B-roll preserves source-audio/subtitle timing and does not erase essential reactions;
- no unintended card/subtitle collision;
- full watch-through is approved.

Write results into `QC_REPORT.md`. Mark final readiness only after both technical and editorial checks pass.

## 13. Troubleshooting

### Remotion tries to bundle a huge directory / disk fills

Confirm `REEL_PUBLIC_DIR` points to `reel-input/<slug>/public`. Never put the master in any public directory. Clear only identified orphaned Remotion/React render temp directories after inspecting them; do not delete broad `/var/folders` paths.

### `timeline asset missing`

Timeline `src` is relative to package `public/`, for example `clips/001_hook.mp4` or `media/broll.mp4`. The manifest output path is repository-relative. Copy only the approved asset into that exact package path.

### Extractor refuses overwrite

This is intentional. Inspect the existing clip and manifest. If the approved edge changed, move/archive or deliberately delete only that exact generated clip, then extract again. Never enable blanket overwrite.

### Source quote looks wrong

Use `reel:quote` around a wider interval and listen to the master. Prose translations are not evidence. Log any ear-verified ASR correction; do not silently modify `source_quote` alone because validation checks it against the stored source cues.

### English DISPLAY RU feels contextually wrong

Review the English span together with Russian cues before and after it. Rebuild phrase groups with the surrounding context visible. Do not isolate short interleaved English utterances and do not round-trip native Russian.

### Timeline compiler refuses the recipe

It requires `approval_status: "APPROVED"`, valid manifest clip IDs, positive durations inside available clips, captions/B-roll inside their sequence windows, known style tokens, and render assets under package `public/`.

### Render passes but output looks wrong

Render critical stills/contact sheet using the same `REEL_PUBLIC_DIR`. Check center-offset coordinates (`x=0,y=0` is frame center), absolute element frames, relative keyframe frames, image-track order, safe areas, and `cover` versus `contain`.

### Audio/music does not duck correctly

Source word intervals generate absolute `speechRegions`. Music belongs on the audio track with ducking config. Do not move subtitle/speech timing when inserting B-roll.

## 14. Example new-Reel brief

```markdown
# R09 — WORKING TITLE

STATUS=PREPRODUCTION
FINAL_RENDER_AUTHORIZED=NO

## Editorial idea

One sentence describing the argument or emotional turn.

## Source anchors

- Master: video1219377731.mp4
- Search area: 01:23:00–01:27:00 (discovery only, not final cut)

## Intended arc

1. editorial hook card;
2. literal source setup;
3. shortest safe cut to the turn;
4. payoff in the speaker's own words;
5. optional end card.

## Translation

- Preserve native Russian verbatim unless approved readability changes are logged.
- Preserve exact English SOURCE.
- Create DISPLAY RU with surrounding Russian context visible.
- Map translation by source phrase groups only.

## Visual intent

- Talking head primary.
- Nikulina baseline tokens.
- B-roll only if it adds context/breath without hiding a necessary reaction.

## Acceptance

- Source provenance recoverable.
- Exact edges listened to and approved.
- DISPLAY RU and phrase grouping approved.
- v3 timeline generated only after approval.
- 1080×1920@30 technical and editorial QC complete.
```

## 15. Copy-paste prompt for a new Reel

```text
You are the lead video-pipeline engineer and technical editor for
/Users/yurasachenko/ReelsRemotion.

Read, in this order:
1. REELS_PRODUCTION_PIPELINE.md
2. PIPELINE_AUDIT.md
3. REELS_GENERATION_RUNBOOK.md
4. claude-code-CONTRACT.md

Prepare Reel <SLUG> titled <TITLE> from <SOURCE VIDEO>.

Editorial idea:
<IDEA>

Discovery anchors (not final cuts):
<TIMECODES OR SEARCH PHRASES>

Requirements:
- Keep the long master outside every public/ directory and never overwrite it.
- Use the highest-authority native transcript/timing source; prose is search-only.
- Establish exact source ranges from native timing and verify questionable wording/edges against audio.
- Never silently rewrite speech.
- In every artifact keep SOURCE literal speech separate from DISPLAY RU.
- For short/interleaved English spans, translate with surrounding Russian context visible.
- Preserve native Russian; never round-trip it through English.
- For English speech, map approved Russian translation by deliberate source phrase groups. Never fabricate Russian acoustic word timestamps.
- Create/update the canonical package under reel-input/<SLUG>/, including BRIEF.md, SOURCE_SELECTION.md, source_manifest.json, SUBTITLE_SCRIPT.md, EDIT_PLAN.md, BROLL_PLAN.md, QC_REPORT.md, and transcript provenance files.
- Inventory and propose only B-roll assets that actually exist. Talking head remains primary.
- Stop at preproduction and report selections, risks, ASR uncertainty, and approvals needed. Do not create an APPROVED recipe, timeline, or final render unless I explicitly approve the editorial package.
- Run npm run reel:validate -- <SLUG> before reporting.

If I subsequently approve it:
- extract exact clips;
- create and approve timeline_recipe.json from the template;
- generate canonical v3 timeline.json;
- validate and render headless with the package's slim REEL_PUBLIC_DIR;
- complete technical plus editorial QC.
```

## Current eight-Reel preproduction set

The current packages are:

```text
r01-fear-of-losing-yourself
r02-connection-without-future
r03-dominance-is-not-control
r04-compromise-vs-consensus
r05-adult-love-is-conditional
r06-what-is-actually-true
r07-kneeling-return-to-body
r08-where-do-you-fall-apart
```

They are deliberately at `PREPRODUCTION / EDITORIAL_REVIEW_REQUIRED`. R06 contains extracted review clips as an extraction smoke/proof. No package has an approved timeline recipe, generated final timeline, or final Reel render in this phase.
# Active series production reference

See `SERIES_PRODUCTION_REFERENCE.md`.

ACTIVE_REFERENCE=R06_V5
SPEECH_RATE=1.0
CUMULATIVE_REVEAL=MANDATORY
ORPHANED_ACCENT_PLATES=FORBIDDEN
MUSIC=REQUIRED_UNIQUE_PER_REEL
BROLL=SEMANTIC_2_TO_4_TARGET
SILENT_CONTEXTLESS_HOOKS=AVOID
R07=DEFERRED_PENDING_HUMAN_AUDIO_GATE
