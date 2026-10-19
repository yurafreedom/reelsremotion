# compose/ — semantic authoring SDK + renderStill self-check loop

A second path into the engine. The editor is for hand-editing; this lets **Claude
Code author a reel by writing `timeline.json` through meaning-level functions**, and
**see its own result via `renderStill`** to self-correct. Both paths write the
**same** `timeline.json` (CONTRACT) and coexist — a reel the SDK composes opens and
edits in the editor, and vice-versa.

It is a **thin layer over the existing primitives** — it reuses, never duplicates:

| Concern                         | Reused from                |
| ------------------------------- | -------------------------- |
| Keyframe generators (slide/fade/scale/pulse/spin) | `src/presets.ts`  |
| Sampling math (the animation engine) | `src/keyframes.ts`    |
| Timing / total-duration / overlaps | `src/compose.ts`        |
| Serialize · validate · round-trip (TimelineIO)    | `editor/src/io.ts` |

Nothing here modifies the engine or editor.

## Running

Scripts are TypeScript; run them through the esbuild runner (same pattern as the
repo's `test:*` scripts — bundles your script, keeps `node_modules` external,
resolves the `@engine/*` alias):

```bash
node compose/run.mjs compose/example.ts             # compose a reel → timeline.json
node compose/run.mjs compose/example_asr.ts         # compose starting from an ASR draft
node compose/run.mjs compose/sdk.test.ts            # SDK self-tests (assert)
node compose/run.mjs compose/check.ts <tl.json> 40  # render frame 40 → check.png
node compose/run.mjs compose/check.ts <tl.json> sheet   # contact sheet of the arc
```

## Part A — the SDK (`import * as reel from "./compose"`)

**Structure** — `createTimeline` · `addScene` · `placeholderInset` · `setVideo` ·
`setTransition` · `setAudio` · `enableDucking`
**Text** — `addWord` · `addLine` · `findWord` · `importTimeline` · `writeTimeline`
**Animation / emphasis** (all produce word-relative keyframes per CONTRACT §3/§4) —
`slideIn` · `fadeIn` · `fadeOut` · `scaleIn` · `pulse` · `spin` · `recolorAt` ·
`moveAlong` (curved → spatial tangents) · `emphasize('punch-red' | 'pop' | 'pulse-beat')` ·
`preset` (raw engine preset passthrough)
**Patterns** — `revealWordByWord` (the dominant reels move) · `kineticBeat`
**Layout** — `stackVertical` · `SAFE_ZONE` / `clampToSafeZone` / `inSafeZone`

Representative composition — see `compose/example.ts`:

```ts
const t = reel.createTimeline();
const s1 = reel.addScene(t, { durationInFrames: 90 });
reel.revealWordByWord(s1, ["ОНА", "не требует", "СВЕРХ", "меры"], { fromSides: true, stagger: 12 });
reel.emphasize(reel.findWord(s1, "СВЕРХ"), "punch-red");
reel.setTransition(t, 0, { type: "fade", duration: 15 });
reel.setAudio(t, { src: "music.mp3", fadeOutFrames: 150 });
reel.enableDucking(t, {});
reel.writeTimeline(t, "public/timeline.json");
```

Starting from ASR is identical — `reel.importTimeline('out/draft.json')`, optionally
`reel.migrateTimeline(...)` to turn `enterFrom` hints into slide-in keyframes, then
apply emphasis / transitions on top (see `compose/example_asr.ts`).

## Part B — the renderStill self-check loop (`compose/check.ts`)

CC's eyes. Same composition the final mp4 uses (`bundle src/index.ts` once,
`inputProps = { timeline, showGrid:false }`), so a still **is** that frame of the
render — no Player / dev-server / Chrome in the loop.

- `bundleOnce()` — bundle the project once; cached per process.
- `checkFrame(timeline|path, frame, {out})` — `renderStill` one frame → PNG. CC views it.
- `contactSheet(timeline|path, {everyNFrames, cols, out})` — stills at 0, n, 2n… laid
  out as one grid (`sharp`). **Fallback without sharp:** writes the frame PNGs to a
  `<out>_frames/` folder + an `index.html` montage and returns the folder.

**The loop CC runs:** compose/import → `writeTimeline` → `contactSheet` (view the whole
arc) → `checkFrame` specific frames (a transition mid-frame, an emphasis pose, a motion
midpoint) → adjust SDK calls → re-check → full render when satisfied.

**Verified equivalence:** a `checkFrame(40)` still vs. frame 40 of the rendered mp4
measured **SSIM 0.994 / PSNR 44 dB** — identical modulo mp4 chroma compression. The
still is the same pixels as the video frame.

Frame-picking: a scene's settled frame for placement; a transition's mid-frame for the
blend; a keyframe segment's midpoint for motion; `contactSheet` for the overall read.

## Part C — Chrome for UI behavior only (secondary)

Use `claude-in-chrome` on the live editor **only** to verify UI *behavior* (a button
clicks, a lane expands, the graph editor reacts) — never for frame visuals; renderStill
owns those, more accurately and with fewer moving parts. Known tooling caveat: raw
automation mouse events don't propagate as pointer events through the Remotion Player
container, so drag-handle interactions can't be driven this way. Keep this path
secondary.

## Honest scope

Deterministic, template-based composition is solid: the SDK + renderStill make CC a
fast **draft-builder with eyes** — strong drafts (especially from ASR timings) that it
self-checks visually. What it does unevenly is *taste* (where emphasis is dramatically
right, how a word should fly to feel good). Realistic division of labor: **CC builds the
draft, a human does the taste pass.** Still a large speedup. The SDK does not make CC an
autonomous art director — build to that.

## Notes

- `public/music.mp3` is a generated **silent placeholder** so the audio path renders;
  swap in real music for production.
- `sharp` is an optional devDependency for the single-image contact sheet; without it,
  the folder fallback still works.
- **Out of scope** (per spec): HTTP server, browser-for-frame-visuals, duplicating
  primitives, engine/editor edits, per-letter / 3D / expressions / particles.
