# Reels Editor — v2.0 (single-window WYSIWYG)

One window that replaces the click-tool + Studio round-trip: place, retime, add
transitions, mix audio, and play with sound — all over the **same engine
composition** that renders the final mp4 (via `@remotion/player`), so
**preview === render** (WYSIWYG).

## Run

The editor reuses the engine in `../src` and resolves all runtime deps
(`react`, `remotion`, `@remotion/*`) from the **repo-root** `node_modules`, so
there is exactly one React/Remotion instance. Install once at the repo root,
then start Vite here:

```bash
# from the repo root (installs engine + editor toolchain)
npm install

# start the editor
cd editor && npm run dev          # → http://localhost:5173
npm run typecheck                 # tsc --noEmit
```

## Export → MP4 (v2.5)

The **Export → MP4** button in the top bar renders the current reel to
`out/<name>.mp4` from the UI — **no terminal**. Rendering an mp4 is server-side
work (Remotion drives headless Chromium in a Node process; a browser can't
produce the mp4 itself), so the button triggers a **local render** via a dev-only
Vite middleware:

- **`POST /__render`** `{ props, fps, quality, outName }` forks a worker
  (`server/render-worker.mjs`) that runs the **same render path as the CLI** —
  `bundle()` the same `src/index.ts` entry → `selectComposition('Reels')` →
  `renderMedia()` — writing to `out/<name>.mp4` (the same folder `npm run render`
  uses). The props are the editor's existing `toRenderProps(timeline)` output
  (`{ showGrid:false, timeline }`), reused verbatim → the exported file matches
  the CLI render for the same timeline (verified: SSIM ≈ 0.999).
- **`GET /__render/:id`** polls progress (`renderedFrames / totalFrames`, %).
- **`GET /__render/file/:name`** streams the finished mp4 as a download.

Options: **fps 30 / 60**, **quality High (CRF 18) / Medium (CRF 23)**, filename.
**Resolution is fixed 1080×1920** (the whole engine is built on it, CONTRACT §1)
— shown, not editable.

### fps behavior (30 vs 60) — re-timing

The engine is frame-based at the timeline's base fps (CONTRACT §1/§3: 30).
Exporting at **60 fps** must show the **same animation, only smoother** — never
faster/slower. Remotion takes the composition fps from `timeline.fps`, so the
worker **re-times** the timeline (`server/retime.mjs`): it sets `fps = 60` and
scales every *frame-valued* field by `ratio = 60/30 = 2` (scene durations, word/
shape `start`/`end`, all keyframe `frame`s, transition durations, audio
fade/duck frames, `startFrom`, `speechRegions`). Pixel/value fields (x, y, size,
spatial tangents, …) are untouched. Result: identical wall-clock duration with
twice the in-between frames. Verified: a 30 fps export and a 60 fps export of the
same reel have the **same duration** (4.067 s) and the same frame content at any
given moment (SSIM ≈ 0.995) — 60 is purely smoother.

## What it does

- **Player + transport** — play/pause, scrub, ±1 frame, ±1s, frame/time
  readout; the `<Player>` plays video and audio itself.
  Keyboard: `Space` toggle, `←/→` ±1 frame, `Shift+←/→` ±1s.
- **Global timeline** — tracks for Scenes (+ transition regions), Text (a clip
  per word at absolute positions), Video (inset per scene), Audio. Drag a word
  clip to retime (converted back to scene-relative `start/end`), drag an edge to
  change duration. Playhead is synced to the Player both ways.
- **Transitions** — add/remove between adjacent scenes; fade / slide / wipe with
  direction, duration (drag the overlap width or type a number), and
  linear/spring timing. Live in the Player.
- **Canvas drag** — move words and the inset (position + size) directly on the
  preview; only items active at the playhead frame are shown (no pile-up),
  coordinates per CONTRACT §2.
- **Keyframes** (CONTRACT §4 — the only animation system) — select a word to get
  per-property lanes with **diamonds** at word-relative frames (click to select,
  ⇧/⌘-click multi-select, drag to retime, `Delete` to remove). **Auto-keyframe**:
  with a track present, editing a property (panel input, canvas drag, size/rotate)
  writes a kf at the playhead; a never-animated property edits its static value or
  is started with the lane's `◇+`. **Presets** generate editable keyframes
  (slide-in/fade-in/scale-in/pulse/spin/fade-out). **Graph editor**: select a
  keyframe → its incoming segment's easing as a draggable cubic-bezier + presets.
  **Motion path**: a position track draws an editable curve on the canvas with
  draggable anchors + spatial tangents (`+curve`). **Copy/paste** (`⌘C`/`⌘V`,
  `⇧⌘V` offsets to the playhead; panel `Paste→scene` for many words) — word-
  relative, so it reproduces motion verbatim. Every edit is live in the Player.
  On **import**, a legacy/ASR word's `enterFrom` is expanded into slide-in
  keyframes so old content still animates (idempotent; already-keyframed words
  untouched).
- **Audio** — music track with volume, fade in/out, and speech-driven **ducking**
  (attack/release); per-inset volume/mute. ASR `speechRegions` are shown
  read-only on the Video track and are never edited here (they belong to ASR).
- **IO** — Import `timeline.json` (incl. the ASR draft), Export the whole
  timeline (round-trip via the ported `TimelineIO`, deep-equal), and
  Save `props.json` for `npx remotion render Reels out.mp4 --props=./props.json`.

## Layout

```
editor/src/
  Editor.tsx          shell: <Player> + canvas overlay, right panel, bottom timeline
  io.ts               TimelineIO port (serialize/validate/clone, render props)
  edits.ts            immutable Timeline edit helpers
  selection.ts        what is selected (word | inset | transition | audio)
  fixtures.ts         default 2-scene document (fade transition + speech regions)
  transport/Transport.tsx
  timeline/Timeline.tsx   tracks, clips, retime drag, transition regions, speech markers
  canvas/CanvasOverlay.tsx drag-place words/inset + motion-path anchors/tangents
  panel/Panel.tsx     word / inset / transition / audio panels + keyframe section
  keyframes/
    kfModel.ts        9 property metas + value sampling/formatting
    kfEdits.ts        immutable keyframe ops (add/move/easing/tangent/preset/copy-paste)
    kfSelection.ts    diamond sub-selection + clipboard types
    KeyframeLanes.tsx per-property lanes + diamonds under the selected word
    GraphEditor.tsx   per-segment cubic-bezier speed/graph editor
    *.test.ts / buildEdited.ts  node-assert ops tests + end-to-end seam proof
  IoBar.tsx           import / export / save props
```

Keyframe data layer is node-tested (`npm test` at the repo root runs the sampling,
IO round-trip, edit-ops, and import→edit→export seam checks). Pointer-drag *feel*
(canvas/graph/path handles) is the human-confirm step — the math + the render are
the correctness gate.

The engine (`../src`) is reused as-is; only the top-level scene assembly switched
from `<Sequence>` to `<TransitionSeries>` (`../src/Video.tsx`). Timing math and
the absolute↔scene-relative mapping live in `../src/compose.ts` (one source of
truth shared with the editor).
