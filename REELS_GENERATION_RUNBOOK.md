# ReelsRemotion: headless generation runbook

Audit date: 2026-08-19  
Repository: `/Users/yurasachenko/ReelsRemotion`  
Current render contract: `claude-code-CONTRACT.md`, v3.2 (`tracks`, absolute frames)

For the canonical editorial-to-render workflow, package structure, provenance
rules, and operator commands, read `REELS_PRODUCTION_PIPELINE.md`. This runbook
remains the lower-level engine/render reference.

## QUICK START FOR CODEX

```text
SOURCE_ASSETS_LOCATION=reel-input/<slug>/source/ (large masters; never bundled)
RENDER_ASSETS_LOCATION=reel-input/<slug>/public/media/ (only files used by this reel)
TIMELINE_FILE=reel-input/<slug>/timeline.json (v3 tracks; source of truth)
PROPS_FILE=not required by the canonical helper; it creates {timeline,showGrid:false} in memory
RENDER_COMMAND=REEL_PUBLIC_DIR="$PWD/reel-input/<slug>/public" npm run render:reel -- "reel-input/<slug>/timeline.json" "out/<slug>.mp4"
OUTPUT_LOCATION=out/<slug>.mp4
VALIDATION_COMMAND=npm test && npx tsc --noEmit && ffprobe -v error -show_streams -show_format "out/<slug>.mp4"
EDITOR_REQUIRED=NO
REMOTION_STUDIO_REQUIRED=NO
```

Run all commands from the repository root. Read this file and
`claude-code-CONTRACT.md` before changing reel data. For a new reel, use v3
`tracks` directly. The old `compose/build_reel*.ts` scripts emit v2 `scenes` and
remain supported through the tested `migrateV2toV3()` compatibility layer, but
v2 is not the contract for new data.

## 1. What this project is

ReelsRemotion is a data-driven, 1080×1920 Remotion v4 renderer. A reel is a JSON
timeline containing video/color clips, image overlays, shapes, timed words,
keyframes, transitions, and audio. React/Remotion turns that data into an H.264
MP4. Per-reel content does not need to be hardcoded in React and normal
production does not need the web editor or Remotion Studio.

The repository also contains:

- a semantic TypeScript authoring SDK under `compose/`;
- faster-whisper/ASR and caption-alignment utilities;
- an optional Vite/React visual editor under `editor/`;
- a legacy click positioning tool under `click-tool/`;
- real completed reel builders and outputs that prove the headless path.

## 2. Architecture

```text
large source masters (outside any public directory)
             |
             +--> ffprobe / ffmpeg / ASR / editorial selection
                              |
                              v
slim per-reel public/media + v3 timeline.json
                              |
                              v
compose/render_reel.ts creates {timeline, showGrid:false}
                              |
                              v
src/index.ts -> Root.tsx -> Composition "Reels"
                              |
                              v
Root.calculateMetadata -> migrateV2toV3 (idempotent)
                              |
                              v
Video.tsx -> clips / overlays / shapes / words / audio / transitions
                              |
                              v
Remotion bundle + headless Chromium + renderMedia
                              |
                              v
out/<slug>.mp4 (H.264 yuv420p/tv/bt709 + AAC when audio exists)
```

Execution details:

1. `src/index.ts` registers `RemotionRoot`.
2. `src/Root.tsx` registers composition id `Reels`. Its metadata comes from the
   supplied timeline, not from hardcoded reel values. v2 input is migrated to v3;
   v3 passes through idempotently.
3. `src/Video.tsx` reconstructs visual segments from v3 tracks, renders
   backgrounds, image/video overlays, shapes, words, music, ducking and clip
   transitions. Media paths are resolved through `staticFile()`.
4. `src/Word.tsx` and `src/Shape.tsx` sample element-relative keyframes using
   `src/keyframes.ts`. There is no hidden entrance animation.
5. `compose/render_reel.ts` bundles `src/index.ts`, selects `Reels`, and calls
   `renderMedia()` with `imageFormat: "png"`, `pixelFormat: "yuv420p"`, and
   `colorSpace: "bt709"`. Those options are intentional Apple-player
   compatibility requirements.

The composition input prop contract is:

```json
{
  "timeline": { "fps": 30, "width": 1080, "height": 1920, "durationInFrames": 90, "tracks": [] },
  "showGrid": false
}
```

The canonical helper reads the timeline file and creates this wrapper in memory,
so a separate props file is not required. A props file is useful only for direct
Remotion CLI diagnostics.

## 3. Project inventory

Generated caches and dependencies are grouped rather than listed file by file.

| Path | Purpose | Runtime role / input → output | Headless required? |
|---|---|---|---|
| `package.json`, `package-lock.json` | Root Node manifest and locked dependencies | `npm ci`, tests, Remotion/compose commands | Yes |
| `remotion.config.ts` | Remotion defaults | JPEG preview frames, overwrite allowed, legacy default `public/` | Yes for direct CLI; helper overrides public dir |
| `tsconfig.json` | Strict engine TypeScript config | TS/TSX → checked bundle | Yes |
| `claude-code-CONTRACT.md` | Frozen v3 data/coordinate/timing contract | Authoring rules → valid timeline | Yes |
| `README.md` | Historical v1/v2 and editor documentation | Reference only; portions are stale | No |
| `src/index.ts` | Remotion entry | registers root | Yes |
| `src/Root.tsx` | `Reels` composition and metadata | props → dimensions/fps/duration | Yes |
| `src/Video.tsx` | Current v3 composition renderer | tracks → layered frame/audio tree | Yes |
| `src/Word.tsx`, `src/Shape.tsx`, `src/Background.tsx`, `src/Grid.tsx` | Visual primitives | element data → pixels | Yes |
| `src/keyframes.ts` | Animation sampler | keyframe arrays + frame → property value | Yes |
| `src/compose.ts` | Shared v2 transition/time/ducking math | scenes/regions → offsets/envelopes | Yes for legacy input and shared audio math |
| `src/types.v3.ts` | Executable v3 TypeScript schema | track model | Yes |
| `src/types.ts` | Shared element types and legacy v2 scene schema | elements/v2 compatibility | Yes |
| `src/migrateV3.ts` | Lossless v2 scenes → v3 tracks migration | old timeline → current timeline | Yes for old reels |
| `src/coalesce.ts` | Joins source-seamless cut pieces | avoids video remount/black preview; preserves render | Yes |
| `src/fonts.ts` | Font-key mapping and font loading | five abstract keys → CSS variable fonts | Yes |
| `src/presets.ts` | Legacy hints and animation presets | `enterFrom`/preset intent → keyframes | Authoring/tests only |
| `src/Scene.tsx` | Legacy scene component | old implementation/reference | No for current render path |
| `src/smoke-test.ts` | Default no-media fixture | default props when no timeline supplied | Diagnostics only |
| `src/*.test.ts` | Engine sampler tests | code → assertions | Yes for validation |
| `compose/run.mjs` | TypeScript-in-Node launcher using esbuild | one `.ts` tool → executable ESM | Yes for compose tools |
| `compose/render_reel.ts` | Canonical programmatic renderer | v2/v3 timeline + public dir → MP4 | Yes |
| `compose/check.ts` | Headless still/contact-sheet inspector | v2/v3 timeline → PNG/sheet | Yes for visual QA |
| `compose/io.ts`, `editor/src/io.ts` | Timeline serializers/validators | JSON ↔ normalized v2/v3 data | Yes |
| `compose/timeline.ts`, `text.ts`, `animation.ts`, `patterns.ts`, `layout.ts` | Semantic authoring SDK | meaning-level TS calls → legacy v2 timeline | Optional but proven for old reel builders |
| `compose/build_reel.ts`, `build_reel1.ts`, `build_reel2.ts` | Completed per-reel recipes | caption/asset constants → `public/timeline_reel*.json` | Examples/legacy production |
| `compose/asr*.py`, `align_chunks*.py`, `recut*.py` | Short-clip ASR, semantic caption alignment, recutting | media/text → word/chunk timing and clips | Optional preprocessing |
| `compose/chunks_*.json`, `asr_*.json`, `word_widths*.json`, `recut_map*.json` | Generated/editorial data for completed reels | ASR/copy/measurement → builders | Only for their reels |
| `compose/measure_words.ts` | Browser glyph measurement | styled words → exact width lookup | Optional when using legacy caption layout patterns |
| `compose/verify_*.ts`, `migrateV3.check.ts`, `sdk.test.ts` | Timeline/layout/migration QA | fixtures → assertions/stills | Validation, some reel-specific |
| `public/media/` | Legacy shared Remotion public assets | relative `src` → `staticFile()` | Required only when using full shared public dir |
| `public/timeline*.json`, `public/props*.json` | Historical fixtures/generated timelines | old builders/editor → render/tests | Not canonical for a new reel |
| `.public-slim-reel1/`, `.public-slim-reel2/` | Observed slim public directories | only one reel's media → low-disk bundle | Pattern to retain; not portable naming |
| `asr_to_timeline.py` | Early generic faster-whisper draft generator | audio/video → legacy v1/v2 scenes | No for new v3 work; see ASR caveats |
| `.venv-asr/` | Existing faster-whisper environment | Python ASR runtime | Only when transcribing |
| `transcripts/` | Episode-level durable ASR/text products | master episode → transcript artifacts | Editorial input, not render runtime |
| `editor/` | Optional Vite/React NLE-style editor and local export endpoint | timeline + user edits → v3/MP4 | No |
| `click-tool/` | Older browser click-positioning/roundtrip tool | timeline + clicks → positions | No; its roundtrip test is retained |
| `reference/` | Reference videos/design inputs | visual target → human/Codex comparison | No |
| `out/` | Final and test videos/props | renderer → MP4 | Yes as output directory |
| `scratch_check/`, `sheet_frames/`, `sheet.png`, `check.png` | Generated QA artifacts | still/frame checks → images | No at runtime |
| `.compose-tmp/` | Generated esbuild bundle | compose launcher cache | Generated |
| `node_modules/`, `editor/node_modules/`, `editor/dist/` | Installed/generated dependencies and GUI build | package install/build output | Root `node_modules` required; others optional/generated |

There is no Git repository at this path, so no commit history or clean/dirty
worktree can be used as evidence. Historical reconstruction came from executable
files, completed outputs, and Claude project session/memory files.

## 4. Files that define one Reel

For a new v3 reel, the source of truth is one timeline JSON plus the render-used
assets referenced by it:

```text
reel-input/<slug>/
  BRIEF.md                         creative intent and acceptance criteria
  SOURCE_SELECTION.md              exact ranges and literal quote provenance
  source_manifest.json             machine extraction/provenance manifest
  SUBTITLE_SCRIPT.md               separate SOURCE and DISPLAY RU layers
  EDIT_PLAN.md                     editorial structure before timeline
  BROLL_PLAN.md                    existing candidate insert proposals
  QC_REPORT.md                     stage-gated validation record
  transcript/                      native cues/words and phrase maps
  timeline_recipe.json             approved compact authoring input
  timeline.json                    canonical generated v3 tracks timeline
  public/
    clips/                         exact selected source extracts
    media/                         only render-used B-roll/images/music/fonts
out/
  <slug>.mp4                       final render
```

This `reel-input/<slug>/` convention is a small operational convention added by
this runbook; it does not change the engine. It formalizes the already observed
`.public-slim-reel1/2` technique and prevents a large master from being copied by
the Remotion bundler.

For old reels, the authoring source is usually a TypeScript recipe such as
`compose/build_reel1.ts`, plus its `chunks_timed_*.json` and measured-width data.
The emitted `public/timeline_reel1.json` is a generated artifact. Those builders
produce legacy v2 `scenes`, which the current engine migrates at load time.

Do not confuse these files:

- `timeline.json`: timeline only; canonical helper input.
- `props.json`: `{timeline, showGrid:false}`; direct Remotion CLI input.
- `src/smoke-test.ts`: fallback fixture only; never a real reel source of truth.
- root `props.json`: an existing 52.1-second fixture, not a generic “current reel”.
- `public/timeline_reel*.json`: outputs of specific historical builders.

## 5. Asset placement and supported inputs

### The hard rule

Every `src` rendered through `staticFile()` must be relative to the public
directory used for that render. With the recommended slim layout:

```json
{ "src": "media/interview-cut.mp4" }
```

means:

```text
reel-input/<slug>/public/media/interview-cut.mp4
```

Never put a multi-gigabyte episode/master in root `public/`. The existing
`video1219377731.mp4` is intentionally a root-level master and must remain outside
`public/`; its render-selected, trimmed excerpts may be written to the slim
per-reel `public/media/` directory.

### Input matrix

| Input | Use | Placement | Preprocessing |
|---|---|---|---|
| MP4/MOV/WebM/M4V | Video clip or muted video overlay | Render-used clip under slim `public/media/`; master under `source/` | Probe first. Transcode/trim with ffmpeg if browser codec, dimensions, frame rate, or file size are unsuitable. |
| PNG/JPEG/WebP/GIF | Image/background/overlay | Slim `public/media/` | Usually none; normalize orientation/size if needed. |
| MP3/WAV/M4A/AAC | Music/voice/audio clip | Slim `public/media/` | Probe loudness/duration; pre-EQ externally because renderer controls gain/fades/ducking, not EQ. |
| SRT/TXT/JSON transcript | Editorial and timing input | `transcript/` or alongside source; not public | Convert seconds to frames and author `Word[]`/`speechRegions`. |
| v3 timeline JSON | Render data | `reel-input/<slug>/timeline.json` | Must follow frozen contract. |
| v2 scenes timeline | Compatibility input | Any readable path | Automatically migrated; do not choose v2 for new authoring. |

Remotion/browser decoding determines media codec support. `ffprobe` and a short
smoke render are the authoritative compatibility tests.

## 6. Timeline contract

Read `claude-code-CONTRACT.md` for the full schema. Executable code has priority
if a comment or old README disagrees.

### Frame, coordinates and time

- Frame: 1080×1920 portrait, 30 fps for this project.
- All v3 `start` and `end` values are absolute composition frames; intervals are
  effectively `[start, end)`.
- Convert seconds with `Math.round(seconds * fps)` or `round(sec * fps)`.
- `x=0,y=0` is frame center `(540,960)`. Values are center offsets in pixels.
- Keyframe `frame` values are element-relative: `0` means the element's `start`.
- `durationInFrames` must equal the maximum relevant track/clip end.

### Tracks and z-order

```text
video background
  -> image tracks in stack order
  -> shape track
  -> text track
  -> audio (no visual z)
```

Use separate image tracks for simultaneous overlay layers. A video file carried
by an image clip is treated as a muted visual B-roll overlay when its extension is
MP4/MOV/M4V/WebM.

### Minimal v3 timeline

```json
{
  "fps": 30,
  "width": 1080,
  "height": 1920,
  "durationInFrames": 150,
  "tracks": [
    {
      "id": "video",
      "kind": "video",
      "clips": [
        {
          "id": "main",
          "kind": "video",
          "src": "media/interview-cut.mp4",
          "start": 0,
          "end": 150,
          "startFrom": 0,
          "fit": "cover",
          "volume": 1,
          "speechRegions": [{ "startFrame": 12, "endFrame": 138 }]
        }
      ]
    },
    {
      "id": "text",
      "kind": "text",
      "words": [
        {
          "text": "ГЛАВНАЯ МЫСЛЬ",
          "start": 15,
          "end": 120,
          "x": 0,
          "y": 430,
          "font": "condensedHeavy",
          "size": 82,
          "weight": 700,
          "color": "#ffffff",
          "enterFrom": "none",
          "case": "upper",
          "keyframes": {
            "opacity": [
              { "frame": 0, "value": 0 },
              { "frame": 4, "value": 1, "easing": "easeOut" }
            ],
            "size": [
              { "frame": 0, "value": 70 },
              { "frame": 4, "value": 82, "easing": "easeOut" }
            ]
          }
        }
      ]
    },
    { "id": "shape", "kind": "shape", "shapes": [] },
    { "id": "audio", "kind": "audio", "clips": [] }
  ]
}
```

### Words and animation

- `start/end` control visibility, not spoken word boundaries unless that is the
  intended caption behavior.
- `enterFrom` is an editor/import hint. The engine ignores it. Actual motion must
  be encoded as keyframes.
- Supported font keys in executable code: `condensedHeavy` (Oswald), `cleanSans`
  (Inter), `unbounded`, `onest`, `playfairItalic`.
- Keyframe tracks include position, size, weight, fontFamily, letterSpacing,
  color, opacity, rotation, blur and `clipReveal`; shapes/images support the
  subset documented in the contract.
- Fonts are fetched from Google CSS2 and rendering waits for them. Offline failure
  falls back to sans-serif, which changes typography; pin local WOFF2 files before
  requiring reproducible offline renders.

### Video, images, transitions and audio

- `VideoClip.startFrom` is the source in-point in frames.
- `fit:"cover"` fills the frame; `contain` uses the optional back color. Optional
  x/y/width/height/borderRadius preserve inset-box geometry.
- `transitionToNext` belongs to the outgoing clip. Its duration is overlap, not
  extra time. Overlap cannot consume an entire adjacent clip.
- Audio clips have absolute start/end, source `startFrom`, volume, optional fades
  and ducking.
- `speechRegions` are absolute ASR-derived intervals on video clips. They are
  frozen factual data used to duck music; do not retime them when merely changing
  caption design.
- Do not round-trip native speech through translation when source-language text
  exists. Translation is an editorial layer, not ASR ground truth.

## 7. Full headless workflow

### Step 0 — prerequisites and safety

```bash
cd /Users/yurasachenko/ReelsRemotion
node --version
npm --version
which ffmpeg ffprobe
df -h .
npm ci --dry-run --ignore-scripts
```

Audited working versions were Node `v22.20.0`, npm `11.11.0`, ffmpeg/ffprobe 8.1,
Remotion `4.0.483`. The lockfile is the package source of truth; use `npm ci` on a
fresh checkout/copy. Check disk before extracting/transcoding and before each
render. Do not run a large ASR job and Remotion render together on the 8 GB Mac.

### Step 1 — create a per-reel workspace

```bash
SLUG="my-reel"
mkdir -p "reel-input/$SLUG/source" "reel-input/$SLUG/transcript" \
  "reel-input/$SLUG/public/media" out
```

Place raw/master media in `source/`. Copy or create only the short render-used
assets in `public/media/`. Keep the brief at `reel-input/$SLUG/brief.md` and the
v3 timeline at `reel-input/$SLUG/timeline.json`.

### Step 2 — inspect source material

For every audio/video file collect duration, dimensions, fps, codec, audio layout,
rotation and loudness:

```bash
ffprobe -v error \
  -show_entries format=filename,duration,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels,channel_layout \
  -of json "reel-input/$SLUG/source/master.mp4"

ffmpeg -hide_banner -i "reel-input/$SLUG/source/master.mp4" \
  -vn -af volumedetect -f null - 2>&1 | grep -E 'mean_volume|max_volume'
```

Codex should inspect representative frames, listen/read the transcript, identify
the hook, source ranges, speaker/language changes, aspect-ratio strategy, caption
hierarchy, B-roll, outro and music. The content cut is editorial data and should
be explicit before final timeline authoring.

### Step 3 — trim/transcode render assets

Example; choose real ranges/codecs after probing:

```bash
ffmpeg -nostdin -ss 00:12:34.000 -to 00:13:18.500 \
  -i "reel-input/$SLUG/source/master.mp4" \
  -c:v libx264 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k \
  "reel-input/$SLUG/public/media/interview-cut.mp4"
```

Preserve the master. Verify the generated clip with `ffprobe` and listen to its
first/last words; energy alone cannot prove that a word ending was not clipped.

### Step 4 — obtain transcript/timing

The repo does contain faster-whisper automation, but it is not one fully generic,
current v3 pipeline:

- `compose/asr*.py` contains proven short-reel ASR passes using the existing
  `.venv-asr`.
- `compose/align_chunks*.py` semantically aligns translated/edited caption chunks
  to ASR English word onsets.
- `transcripts/video1219377731/` demonstrates a durable bilingual, word-timestamped
  full-episode workflow.
- root `asr_to_timeline.py` is legacy: it emits scenes and defaults to forced
  Russian/medium unless arguments override it. Do not use its defaults for a
  bilingual episode.

For long audio on this 8 GB Mac, split to approximately 15-minute WAV chunks,
run faster-whisper `small`, CPU/int8, do not force language, and offset timestamps
back to the master timeline. Preserve the full ASR JSON so a reel never requires
re-transcribing the same episode.

ASR owns spoken text, word times and speech regions. Codex/editorial work owns
caption grouping, translations, wording approvals, styling, hold/clear timing and
which passages become a reel.

### Step 5 — author the v3 timeline

Create `reel-input/$SLUG/timeline.json` using the contract. A future Codex session
may write JSON directly or create a small per-reel TypeScript builder. If a builder
is used, it should emit v3. Do not add per-reel constants to `src/`.

Before render, check:

- every absolute frame is derived from the same 30 fps axis;
- all `start < end` and all keyframes fit the element duration;
- `durationInFrames` covers all tracks;
- clip `src` paths are relative, contain no leading `/`, and exist under the slim
  public directory;
- speech regions follow edited source timing, not display-caption timing;
- transition overlap and source `startFrom` values are intentional;
- caption blocks stay clear of platform safe areas.

### Step 6 — validate code and timeline

```bash
npm test
npx tsc --noEmit
npm --prefix editor run typecheck

jq empty "reel-input/$SLUG/timeline.json"
jq -e '.fps == 30 and .width == 1080 and .height == 1920 and
       (.durationInFrames | type == "number") and
       (.tracks | type == "array")' \
  "reel-input/$SLUG/timeline.json"
```

List referenced media, then verify each against the selected public directory:

```bash
jq -r '
  .tracks[] |
  if (.kind == "video" or .kind == "image" or .kind == "audio")
  then .clips[]? | .src // empty else empty end
' "reel-input/$SLUG/timeline.json" | sort -u
```

The current v3 runtime validator is intentionally light structural validation;
`npm test`, TypeScript builders, asset checks, stills, and the smoke render are
part of the real validation gate.

### Step 7 — headless still inspection

```bash
REEL_PUBLIC_DIR="$PWD/reel-input/$SLUG/public" \
  npm run check -- "reel-input/$SLUG/timeline.json" 0

REEL_PUBLIC_DIR="$PWD/reel-input/$SLUG/public" \
  npm run check -- "reel-input/$SLUG/timeline.json" 150
```

The command writes `check.png`; inspect it after each call and preserve named
copies when comparing frames. `sheet` mode exists, but its default is every 15
frames and can be expensive for a long reel. Prefer selected frames or a
reel-specific verify script.

### Step 8 — render

```bash
REEL_PUBLIC_DIR="$PWD/reel-input/$SLUG/public" \
  npm run render:reel -- \
  "reel-input/$SLUG/timeline.json" \
  "out/$SLUG.mp4"
```

This is the canonical command. It requires no props file, browser UI, localhost,
Studio, or editor. It logs frame progress and exits only after the MP4 is complete.

For a legacy completed builder, the observed equivalent is:

```bash
node compose/run.mjs compose/build_reel1.ts B full
REEL_PUBLIC_DIR="$PWD/.public-slim-reel1" \
  npm run render:reel -- public/timeline_reel1.json out/reel1-rerender.mp4
```

Do not overwrite `out/REEL1_FINAL.mp4`, `out/REEL2_FINAL.mp4`, or another valuable
output while auditing or iterating.

### Step 9 — verify the encoded MP4

```bash
ffprobe -v error \
  -show_entries format=filename,duration,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,pix_fmt,color_range,color_space,sample_rate,channels \
  -of json "out/$SLUG.mp4"

ffmpeg -v error -ss 1 -i "out/$SLUG.mp4" -frames:v 1 -f md5 -
ffmpeg -v error -ss 5 -i "out/$SLUG.mp4" -frames:v 1 -f md5 -

ffmpeg -hide_banner -i "out/$SLUG.mp4" -vn -af volumedetect \
  -f null - 2>&1 | grep -E 'mean_volume|max_volume'
```

Expected video: H.264, 1080×1920, 30 fps, `yuv420p`, limited/tv range, `bt709`.
Expected audio: AAC stereo when the source video or audio track is audible. Frames
from visibly different moments should not have identical hashes. Check duration
against `durationInFrames / fps`, allowing normal audio/container rounding.

Extract a visual sheet from the encoded MP4 when needed:

```bash
ffmpeg -nostdin -i "out/$SLUG.mp4" \
  -vf "fps=1/5,scale=270:-1,tile=5x4" -frames:v 1 \
  "scratch_check/$SLUG-encoded-sheet.png"
```

Encoded-video checks are mandatory: stills can be correct while MP4 pixel format,
audio, or playback compatibility is wrong.

### Step 10 — iterate without GUI

1. Identify the exact bad time/frame.
2. Inspect the native source/ASR context and a still or encoded frame.
3. Change only the per-reel timeline/builder/caption data or staged asset.
4. Re-run validation and a selected still.
5. Render to a new versioned output, for example `out/<slug>-v2.mp4`.
6. Repeat ffprobe, motion, audio and visual checks.

## 8. Exact command reference

```bash
# Fresh dependency install
npm ci

# Full safe test gate
npm test
npx tsc --noEmit

# Discover the composition with an optional direct-CLI props fixture
npm run compositions -- --props=props.json

# Build a historical reel timeline
node compose/run.mjs compose/build_reel2.ts B full

# Render any v2 or v3 timeline through a slim public directory
REEL_PUBLIC_DIR="$PWD/<public-dir>" \
  npm run render:reel -- "<timeline.json>" "out/<name>.mp4"

# Render one exact composition frame from the same data/path
REEL_PUBLIC_DIR="$PWD/<public-dir>" \
  npm run check -- "<timeline.json>" "<frame>"

# Direct Remotion CLI diagnostic (uses remotion.config.ts public/, not REEL_PUBLIC_DIR)
npx remotion render src/index.ts Reels out/diagnostic.mp4 --props=./props.json

# Technical verification
ffprobe -v error -show_streams -show_format "out/<name>.mp4"
```

Prefer the programmatic `render:reel` command for production because it applies
the slim public directory and the tested Apple-compatible color/pixel settings.

## 9. Output

Final deliverables go under `out/` with a unique slug/version:

```text
out/<slug>.mp4
out/<slug>-v2.mp4
```

During this audit the dedicated smoke output was
`out/audit-smoke-v3.mp4`. Existing completed evidence includes:

- `out/reel.mp4`: 55.66 s, H.264/AAC, 1080×1920@30;
- `out/REEL1_FINAL.mp4`: 50.65 s, H.264/AAC, 1080×1920@30;
- `out/REEL2_FINAL.mp4`: 70.83 s, H.264/AAC, 1080×1920@30.

## 10. Validation checklist

- [ ] Disk has room for source, intermediates, Remotion bundle and output.
- [ ] Large masters are outside every render public directory.
- [ ] `npm ci --dry-run --ignore-scripts`, `npm test`, and `npx tsc --noEmit` pass.
- [ ] Timeline is v3 `tracks`, 1080×1920, 30 fps, absolute element timing.
- [ ] `durationInFrames` covers all clips/elements.
- [ ] All render `src` files exist under the selected slim public directory.
- [ ] Source cut includes complete first/last spoken words.
- [ ] Native ASR wording and word timestamps remain reusable and unaltered.
- [ ] `speechRegions` reflect actual speech and are not caption holds.
- [ ] Keyframes are element-relative and stay within element duration.
- [ ] Transitions use overlap intentionally.
- [ ] Selected headless stills show correct fonts, layers, safe areas and captions.
- [ ] Render exits 0 and output file exists at the expected unique path.
- [ ] ffprobe reports H.264, 1080×1920, 30 fps, yuv420p/tv/bt709.
- [ ] Audio stream exists when expected and volume is not `-inf`.
- [ ] Different encoded moments decode to different frames.
- [ ] Duration matches `durationInFrames / fps` within container/audio rounding.
- [ ] Hook, sync, subtitles, music/voice balance, transitions and outro were reviewed.

## 11. Troubleshooting and known gaps

### Browser fails to launch

Remotion uses headless Chromium. A constrained sandbox may report Mach port or
browser launch permission errors. Run the same command with permission to launch
Chromium; do not start Studio as a workaround.

### ENOSPC or huge bundle

The shared `public/` was about 941 MB at audit time and previously caused disk
pressure. Set `REEL_PUBLIC_DIR` to the per-reel slim public directory. Do not copy
the 2 GB+ episode master into `public/`. Check `df -h .` before heavy steps.

### MP4 looks frozen/silent in Apple players

Historical cause: JPEG render frames produced full-range `yuvj420p/bt470bg`.
`compose/render_reel.ts` deliberately uses PNG frames → `yuv420p`, limited range,
bt709. Do not remove those options. Verify the encoded file with ffprobe,
frame hashes and volumedetect.

### Missing media

`staticFile("media/x.mp4")` resolves relative to the active public directory, not
the repo root and not relative to `timeline.json`. Match path/case exactly and do
not use absolute paths inside timeline `src`.

### Wrong duration or transition drift

v3 time is absolute. A transition is an overlap at the clip join. Legacy v2 total
duration is sum(scene durations) minus overlaps. Do not add overlap as extra time.

### Caption appears but does not animate

`enterFrom` is not rendered. Add real keyframes. Keyframe frame zero is the
element's own start, not composition frame zero.

### Captions run ahead/behind speech

Do not globally stretch semantic captions when edits changed phrase order. Align
each chunk to native ASR/source word onsets, sort by real rendered time, and inspect
the surrounding bilingual context. This was the successful historical method.

### Typography changed

The five fonts are fetched over the network. A failed CSS/font request falls back
to sans-serif. Re-run online or package local font files for fully offline
reproducibility. Re-run `compose/measure_words.ts` when legacy caption words or
font sizes change.

### Music competes with voice

Adjust audio clip base volume, speech regions, ducked volume, attack/release and
fades. EQ is not part of the Remotion envelope; pre-EQ music with ffmpeg and stage
the processed file. Some historical music contains vocals—choose a better bed if
ducking is insufficient.

### Image outro becomes black during crossfade

Observed legacy gotcha: an image background overlapping video during a transition
can be classified as an overlay. Historical fix was a real color background clip
plus a full-frame image overlay for the outro.

### Documentation/schema drift

- `README.md` and much of `compose/README.md` describe v1/v2 scenes.
- `claude-code-CONTRACT.md` v3 and executable `src/types.v3.ts`/`Video.tsx` are
  authoritative for new work.
- The semantic compose SDK still authors v2 scenes, but migration tests are green.
- `asr_to_timeline.py` is legacy v1/v2 and is not a complete bilingual v3 pipeline.
- v3 JSON validation is currently structural rather than a deep schema validator.

### No Git history

This folder is not a Git repository. Preserve valuable outputs and make versioned
new files; there is no `git checkout` safety net here.

## 12. What does not require the editor

Normal generation, including asset probing, transcription, timeline creation,
composition discovery, still rendering, full MP4 rendering and technical
verification, does not require:

- `editor/`;
- a Vite server or localhost;
- Remotion Studio;
- dragging clips/captions manually;
- manual video editing in an NLE.

The renderer consumes data directly. Codex can generate and revise that data and
can inspect stills/encoded frames headlessly.

## 13. Optional editor workflow

Use `editor/` only when a person specifically wants WYSIWYG drag/trim/keyframe
editing or the editor's local Export panel:

```bash
cd editor
npm run dev
```

The editor shares the same engine and writes v3, but its Vite middleware always
uses the root shared `public/`; it is not the canonical slim-public production
path. Studio is likewise diagnostic, not required.

## 14. Recovered old Claude workflow

### OBSERVED

- Three actual builders (`build_reel.ts`, `build_reel1.ts`, `build_reel2.ts`) create
  reel timelines from source assets, timed chunks, styles, overlays, outro and
  ducked music.
- `render_reel.ts` renders those timelines programmatically and logs progress.
- Real final H.264/AAC files exist in `out/` and probe correctly.
- Claude project memory explicitly records `build_reel.ts → render_reel.ts`,
  faster-whisper → semantic chunk alignment → measured text layout → still checks
  → encoded MP4 checks.
- `.public-slim-reel1/2` and `REEL_PUBLIC_DIR` were introduced to avoid bundling
  hundreds of megabytes of unrelated public media.
- Historical defects were found by encoded-file checks: full-range color tags,
  clipped final speech, caption drift, music balance, B-roll timing and image
  crossfade behavior.

### INFERRED

Claude previously acted as the per-reel orchestrator: it inspected source media,
selected/recut passages, ran ASR, authored/translated caption chunks with context,
generated a TypeScript recipe/timeline, measured typography, rendered stills and
MP4, inspected the result, and iterated. This inference is strongly supported by
the scripts, generated artifacts, final outputs and project memory.

### UNVERIFIED

- There is no Git history to prove the exact chronological command sequence for
  every final file.
- Not every historical `.public-slim-*` asset matches the latest builder names;
  rebuild a fresh slim directory from the current timeline before rerendering an
  old reel.
- Some old comments mention commands/outputs superseded by later fixes; current
  executable code and the encoded outputs take priority.

## 15. Creating a new Reel with Codex

Give Codex:

1. the slug and paths to source files;
2. the desired platform/duration and language(s);
3. creative brief, hook, required/forbidden passages, caption language and CTA;
4. brand assets, colors/fonts, music/B-roll permissions;
5. whether ASR/translations already exist;
6. acceptance criteria and the required output filename.

Codex should first report which per-reel files it will create/change, then inspect
and probe sources, preserve large masters outside public, create only render-used
assets, author v3 timeline data, validate, render, inspect encoded output, fix
issues, and return the exact final path and technical metadata.

## 16. COPY-PASTE CODEX PROMPT

```text
You are working inside /Users/yurasachenko/ReelsRemotion.

Read REELS_GENERATION_RUNBOOK.md and claude-code-CONTRACT.md completely before
changing anything. Follow executable code over stale README examples.

Goal:
Generate a complete headless Reel from the source assets located at:
<INPUT_PATH>

Reel slug:
<SLUG>

Creative brief:
<DESCRIPTION>

Required duration/language/caption language/CTA:
<REQUIREMENTS>

Rules:
- do not start the web editor, Vite, localhost, or Remotion Studio;
- do not manually assemble video in an NLE;
- do not modify the frozen rendering contract or React engine unless an actual
  blocker is proven;
- use a v3 tracks timeline with absolute frames for new work;
- keep large/raw masters outside every public directory;
- create a slim per-reel public directory containing only render-used assets and
  render with REEL_PUBLIC_DIR;
- inspect all source media with ffprobe and inspect representative frames/audio;
- preserve native ASR text and word timestamps as reusable ground truth;
- for bilingual/interleaved speech, translate short spans with surrounding native
  context visible; never round-trip native wording through another language;
- derive captions, speechRegions, transitions, audio, keyframes, and assets from
  the actual source and brief;
- validate every referenced file, run project tests/typecheck, render selected
  stills, then render the MP4 through npm run render:reel;
- inspect the encoded MP4 with ffprobe, different-frame hashes, audio loudness and
  representative visual frames;
- fix rendering/sync/layout/audio errors and rerender to a versioned path;
- do not overwrite valuable existing final outputs.

Before modifying anything:
1. report disk headroom and tool versions;
2. report source metadata;
3. identify every file you intend to create/change;
4. state the chosen hook/cut and timeline plan.

After rendering, report exactly:
RENDER_STATUS=
OUTPUT_FILE=
DURATION=
RESOLUTION=
FPS=
VIDEO_CODEC_AND_COLOR=
AUDIO_STATUS=
TIMELINE_FILE=
PUBLIC_DIR=
TEST_STATUS=
VISUAL_VALIDATION_STATUS=
TECHNICAL_VALIDATION_STATUS=
UNRESOLVED_ISSUES=

Do not stop while the final render process is still running.
```

## Audit verification record

The commands documented above were validated on 2026-08-19:

- `npm ci --dry-run --ignore-scripts`: pass;
- `npm test`: pass, including 12 keyframe, 10 IO/migration, 12 keyframe-edit,
  8 cut/coalesce/ripple, 22 click-tool roundtrip/edit, 5 SDK and v2→v3 migration
  checks;
- `npx tsc --noEmit`: pass;
- `npm --prefix editor run typecheck`: pass;
- `npm --prefix editor run build`: pass (only a non-fatal chunk-size warning);
- `npm run compositions -- --props=props.json`: composition `Reels` discovered as
  1080×1920, 30 fps, 1563 frames;
- v3 headless still via `compose/check.ts`: pass and visually inspected;
- v3 headless MP4 via `compose/render_reel.ts` and `.public-slim-reel1`: pass,
  60/60 frames;
- smoke output: H.264, 1080×1920@30, yuv420p/tv/bt709, AAC stereo 48 kHz,
  2.048 s, non-silent audio, different decoded frame hashes.
