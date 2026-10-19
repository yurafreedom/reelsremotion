# ReelsRemotion pipeline audit

Audit date: 2026-08-19  
Project root: `/Users/yurasachenko/ReelsRemotion`  
Scope: long-form source → editorial preproduction → deterministic v3 timeline → headless render/QC

## Executive finding

The render architecture already works and should not be replaced. The canonical runtime is Remotion `4.0.483`, `compose/render_reel.ts`, composition `Reels`, and a v3 `tracks` timeline with absolute frames. The missing layer was not rendering; it was the repeatable editorial-to-timeline path with source provenance, exact extraction, translation timing rules, B-roll inventory, stage gates, and one operator interface.

That missing layer is now provided by `scripts/reel-pipeline.mjs`, the `npm run reel:*` commands, the templates/catalog under `reel-input/`, and `REELS_PRODUCTION_PIPELINE.md`. Existing engine code remains authoritative for rendering.

## Audited source material

The current master is `video1219377731.mp4` at the repository root. It remains untouched and outside every `public/` directory. Probe at audit time:

- duration: `13974.421333` s (`03:52:54.421`);
- size: `2,079,692,349` bytes;
- video: H.264, 1280×720, 25 fps, yuv420p;
- audio: AAC, 48 kHz, stereo.

The durable native transcript is `transcripts/video1219377731/asr_video1219377731.json`: 2,646 segments and 23,271 word-timestamp records. It was produced by faster-whisper `small`, CPU/int8. It is machine evidence, not a human-corrected transcript and not diarized.

## Existing capabilities

| Area | Existing implementation | Finding |
|---|---|---|
| Render engine | `src/Root.tsx`, `src/Video.tsx`, `src/Word.tsx`, `src/Shape.tsx` | Working 1080×1920 data-driven renderer; reuse. |
| Canonical render | `compose/render_reel.ts` | Working headless H.264/yuv420p/BT.709 path; reuse unchanged. |
| Timeline contract | `claude-code-CONTRACT.md`, `src/types.v3.ts` | v3 tracks and absolute frames are canonical. |
| Compatibility | `src/migrateV3.ts` | v2 scenes remain renderable through migration; not a new-authoring target. |
| Timeline QA | `compose/io.ts`, `compose/check.ts` | Structural validation and exact-pixel still/contact-sheet inspection exist. |
| Authoring SDK | `compose/timeline.ts`, `text.ts`, `patterns.ts`, `animation.ts`, `layout.ts` | Proven for completed reels, but outputs legacy scene-oriented data. Keep for reference/old recipes. |
| ASR | `.venv-asr/`, `compose/asr*.py`, `align_chunks*.py` | Working targeted tooling exists. Current episode already has full word ASR, so retranscription is unnecessary. |
| Recut helpers | `compose/recut*.py`, maps | Reel-specific precedent, not a generic package workflow. |
| B-roll/media | `public/media/`, `reference/`, completed reel builders | Reusable assets exist; they previously lacked a machine inventory and editorial catalog. |
| Optional GUI | `editor/`, `click-tool/`, Remotion Studio | Useful diagnostics, but not required for production. |
| Tests | `src/*.test.ts`, editor tests, compose SDK/migration tests | Existing regression suite remains the engine gate. |

## Source authority hierarchy

Highest authority first:

1. `video1219377731.mp4` audio/video — final authority for literal wording, speaker identity, phoneme-safe edges, expression, and visual continuity.
2. `asr_video1219377731.json` — native machine transcript with source segment and word timestamps; canonical machine provenance/timing source.
3. `subtitles_native.srt` — native cue-level derivative; useful for inspection/interchange, less precise than the JSON.
4. `subtitles_en.srt` — merged English reading layer; native English stays native, Russian spans come from Whisper translation. It is not native provenance for Russian speech.
5. `en_spans_index.json` + `en_spans_ru.json` — contextual English→Russian translation layer. Translations were made with surrounding Russian context visible. They do not contain acoustic Russian word timing.
6. `transcript_readable.txt`, `transcript_full_clean.txt`, `transcript_RU_full.txt` and similar prose — semantic search/reading only; never timing authority.

Any conflict is resolved upward. Native ASR lexical errors are corrected only after listening, with the correction logged. A translated or cleaned prose file never overrides native speech silently.

## Reusable code retained

- `compose/render_reel.ts`: final render owner.
- `compose/check.ts`: still/contact-sheet visual QC.
- `compose/io.ts`: v2/v3 serialization and schema checks.
- `src/types.v3.ts` and `claude-code-CONTRACT.md`: timeline contract.
- `src/migrateV3.ts`: compatibility only.
- `compose/asr*.py` and `.venv-asr/`: optional targeted re-alignment if a selected edge cannot be resolved from existing word ASR.
- Existing Nikulina reel builders/assets: visual and editorial precedent, not templates to copy blindly.

## Missing capabilities found

Before this work there was no single reproducible path that:

- created a standard editorial package;
- extracted a literal quote from the authoritative word ASR by exact interval;
- kept SOURCE and DISPLAY RU as separate data layers;
- represented translated English speech with deliberate phrase groups instead of fake Russian word timestamps;
- cut master ranges into stable per-reel assets while refusing overwrite;
- inventoried B-roll media and representative frames;
- parameterized the Nikulina typography/palette/safe-area baseline;
- compiled an approved, compact recipe into v3 absolute-frame tracks;
- validated preproduction and render stages through one operator command;
- documented explicit human approval gates.

## Additions made

### Operator layer

`scripts/reel-pipeline.mjs` now owns preparation work only:

- `prepare`: non-destructive canonical package scaffolding;
- `quote`: exact native transcript selection in JSON/SRT/text;
- `preproduction`: deterministic generation of the eight current packages from declarative source segment IDs;
- `extract`: exact controlled ffmpeg extraction by default, optional stream copy;
- `broll`: recursive metadata inventory and optional midpoint-frame extraction;
- `timeline`: compile an explicitly approved recipe into v3 tracks/absolute frames;
- `validate`: preproduction/render-stage package checks;
- `render`: validate and delegate to the existing renderer.

The matching package scripts are `reel:prepare`, `reel:quote`, `reel:preproduction`, `reel:extract`, `reel:broll`, `reel:timeline`, `reel:validate`, and `reel:render`.

### Canonical data/templates

- `reel-input/_templates/nikulina_style_tokens.json`
- `reel-input/_templates/timeline_recipe.example.json`
- `reel-input/_catalog/broll_inventory_public.json`
- `reel-input/_catalog/broll_inventory_reference.json`
- `reel-input/_catalog/BROLL_CATALOG.md`
- `reel-input/preproduction_eight.json`

The eight generated Reel packages preserve exact source segment IDs, source seconds/timecodes, native cue text, source words, contextual translation provenance, phrase mappings, editorial proposals, and pending QC gates.

## Legacy/dead or non-canonical paths

These files are retained and not deleted, but should not be used as the canonical path for new Reels:

- `asr_to_timeline.py`: early generic draft; scene-oriented defaults and language/model assumptions are inappropriate for this bilingual source.
- `compose/build_reel*.ts`: successful historical recipes, but they author v2 scenes.
- `public/timeline*.json`, root `props.json`: reel-specific/historical fixtures, not “the current Reel”.
- `src/Scene.tsx`: legacy component, not the current v3 render path.
- `editor/`, `click-tool/`, Remotion Studio: optional tools; production must not depend on them.
- prose transcripts: editorial search aids, never timecode authority.

No scene-detection system was found. That is not a blocker: exact selected boundaries are reviewed directly against the master and contact sheets. If automated scene detection is added later, it should remain advisory and must not override speech-safe cuts.

## Remaining human gates / known limitations

- Native ASR is not diarized; speaker labels in packages are inferences and require video/audio confirmation.
- Machine ASR contains known questionable tokens, especially in R04 and R08. They are flagged rather than silently corrected.
- Exact first/last phonemes and facial continuity must be checked on extracted review clips.
- DISPLAY RU requires editorial approval, especially for English speech. Phrase timing is executable, but semantic grouping is an editorial decision.
- B-roll proposals are candidates only. Talking-head expression remains primary.
- The recipe compiler intentionally refuses `approval_status` other than `APPROVED`.
- No timeline or final render was generated for the eight packages in this phase; this is the required preproduction gate, not a missing implementation.

## Proposed future additions

Only add these if repeated production demonstrates the need:

1. a correction ledger (`transcript_corrections.json`) that records machine text, approved text, operator, reason, and source interval;
2. optional speaker diarization for long sources, while keeping the master as authority;
3. a stricter JSON Schema/Ajv validator for `source_manifest.json` and `timeline_recipe.json`;
4. loudness analysis/normalization and automated black/frozen-frame sampling in post-render QC;
5. optional advisory shot-boundary detection for B-roll discovery;
6. an approval checksum that binds approved source, DISPLAY RU, edit plan, and generated timeline.

These are incremental controls. None justify replacing the current Remotion architecture.
