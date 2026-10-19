# Nikulina 2026 — frozen visual style

STATUS=VISUAL_GATE_CLOSED_APPROVED  
VISUAL_GATE=CLOSED  
SCOPE=R01–R08 and subsequent Nikulina editorial Reels  
REFERENCE_PILOT=R06

## 1. Visual premise

The source video and the speaker's expression are the visual authority. Typography clarifies the idea; it does not compete with the face. The system should feel editorial, direct, premium and contemporary rather than like a generic social-media template.

## 2. Frame and safe area

- Delivery: 1080×1920, 30 fps.
- Safe area: 96 px left/right, 220 px top, 300 px bottom.
- Keep faces unobstructed. For R06's landscape two-person frame, a same-source blurred extension may fill 9:16 while a sharp source window carries the actual image.
- A restrained dark gradient or vignette is allowed only to recover text contrast.

## 3. Palette

- Wine accent: `#7A1F32`.
- Dark wine: `#4B101D`.
- Near-white: `#F7F4EF`.
- Charcoal: `#171717`; black: `#080808`.
- Wine is selective: one semantic word, rule, or small plate at a time. It is not a general wash.

## 4. Typography

Canonical pair:

- Display: `nikulinaCondensed` → local **Avenir Next Condensed**, bold/700, Cyrillic-capable.
- Reading/subtitles: `nikulinaSans` → local **Avenir Next**, medium–demibold/500–600, Cyrillic-capable.

Fallback order is encoded in `src/fonts.ts`. No font download is required for the canonical macOS setup.

### Preset 1 — Main Hook (primary)

The canonical opening system for the series: dark upper zone, unobtrusive label, three large condensed uppercase lines, and one wine rectangle behind the semantic key word. The approved refinement uses 0.91 line height, a 112 px accent block, and a raised third line for tighter cohesion. Faces remain unobstructed and the source video stays readable below.

### Preset 2 — Secondary Punch

The secondary argumentative/question screen: large white headline, one wine-emphasized line, and a smaller concluding clean-sans question. The emphasized line is slightly reduced and rebalanced; the final line is strengthened and connected more closely to the headline block. This is not the opening base preset.

### Preset 3 — Lower-third Semantic Card

A compact rounded semi-transparent lower-third with white text and a wine vertical rule. Its locked geometry is 924×160 px at y=1386: shorter, less padded, and raised above the bottom safe area.

### Screen 2 quiet variation

`SCREEN_2_STATUS=NOT_BASE`. It may remain as an archival optional quiet variation, but it is not part of the canonical three-preset system.

### Subtitles

- Clean sans, near-white, 58 px baseline size, 1–2 lines.
- Break by phrase and meaning, not by equal character count.
- Stable final placement; cumulative reveal must never cause line reflow.
- No karaoke highlighting: spoken words accumulate in place and previous words remain visible.
- Native Russian timing stays native. English speech may use phrase-group Russian translation, but never fabricated Russian word timings.
- Preserve hesitations and actual meaning; visual tightening must not rewrite speech.

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

The complete final line layout exists from the first phrase frame. Each token occupies its final invisible position until its reveal frame, fades in over approximately 2–3 frames, and then remains visible through the semantic phrase boundary. The phrase clears as one group. Punctuation stays attached to the preceding word.

For native Russian, reveal frames come from the existing source word-start timestamps. For English speech with Russian display text, reveal frames are deterministic visual timing distributed inside the approved translation phrase-group interval and are explicitly classified as `DERIVED_VISUAL_REVEAL`, never acoustic Russian alignment. Missing required speech timing is a hard `WORD_REVEAL_DATA_MISSING` error.

Editorial framing copy that is not spoken is exempt and may retain its approved designed motion. “No karaoke” forbids per-token highlighting and bouncing; it does not mean showing the full spoken sentence immediately.

## 5. Motion

- Motion is restrained and purposeful.
- Hooks/punches may use a 4-frame fade/scale settle.
- Subtitles remain stable.
- One emphasis event at a time. No looping bounce, neon glow, rainbow treatment, glass cards, or decorative motion without editorial meaning.

## 6. Background and composition

- Default background is the actual source video.
- Talking-head reactions outrank B-roll and decoration.
- Same-source blur extension is allowed for landscape material in a vertical frame; it must remain recognizably the same scene.
- Do not use serif-heavy styling, generic TikTok caption presets, synthetic neon, glassmorphism, or unrelated stock imagery.

## 7. R06 gate state

The visual gate is closed and the three presets above are approved. The current authorization is one short R06 cumulative-word-reveal proof using Blocks 1–2. It does not authorize a full R06 rerender, final R01–R08 renders, B-roll application, or series production.

Short proof: `scratch_check/nikulina_2026/r06_motion_proof/r06_visual_presets_motion_proof.mp4` (18.00 s, 1080×1920, 30 fps, original approved clip audio, no music).

Word-reveal proof: `scratch_check/nikulina_2026/r06_word_reveal_proof/r06_cumulative_word_reveal_proof.mp4` (human review required).

Executable tokens: `reel-input/_templates/nikulina_style_tokens.json`.
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
