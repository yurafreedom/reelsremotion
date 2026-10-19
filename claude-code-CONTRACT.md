# CONTRACT.md — frozen interface (prepend to EVERY prompt) — v3.2 (Scene.overlays → per-overlay image tracks)

> The single thing the engine, editor, and ASR agree on. Each is built against THIS. **v3 replaces the scene model with sequential tracks on an absolute timeline.**

## 1. Frame
- **1080×1920** vertical. `fps` **30** (from timeline.json). Center (absolute px) **(540, 960)**.

## 2. Coordinates (CRITICAL)
- All `x,y` are **offsets in px from frame center**. `(0,0)` = center; an element's point = its center (`translate(-50%,-50%)`).
- Click → JSON: `S=displayedWidth/1080; x=round(clickX/S-540); y=round(clickY/S-960)`.

## 3. Time (CRITICAL)
- All time in **FRAMES**. ASR converts `frame=round(sec*fps)`.
- **There are no scenes.** All clip/element `start`/`end` are **ABSOLUTE** timeline frames (from the start of the whole reel).
- **Keyframe frames stay element-relative** (0 = the element's `start`). `absFrame = element.start + keyframe.frame`. (Unchanged — this survives the absolute-axis migration.)

## 4. Schema — tracks

```ts
type FontKey = 'condensedHeavy' | 'cleanSans';
type TextCase = 'upper' | 'lower' | 'none';
type EnterFrom = 'left'|'right'|'top'|'bottom'|'none';   // editor hint; engine ignores
type Fit = 'cover' | 'contain';

type EasingPreset = 'linear'|'easeIn'|'easeOut'|'easeInOut'|'hold';
type Easing = EasingPreset | { bezier: [number,number,number,number] };
interface Vec2 { x:number; y:number }
interface Keyframe<T> { frame:number; value:T; easing?:Easing }            // element-relative frame
interface PositionKeyframe { frame:number; value:Vec2; easing?:Easing; spatialIn?:Vec2; spatialOut?:Vec2 }
// Animation is keyframes-only. No built-in entrance/exit. Typewriter is a clipReveal track (0..1), not glyph-split.

interface WordKeyframes { position?:PositionKeyframe[]; size?:Keyframe<number>[]; weight?:Keyframe<number>[];
  fontFamily?:Keyframe<FontKey>[]; letterSpacing?:Keyframe<number>[]; color?:Keyframe<string>[];
  opacity?:Keyframe<number>[]; rotation?:Keyframe<number>[]; blur?:Keyframe<number>[]; clipReveal?:Keyframe<number>[] }
interface Word { text:string; start:number; end:number;   // ABSOLUTE frames
  x:number; y:number; font:FontKey; size:number; weight:number; color:string; enterFrom:EnterFrom; case?:TextCase;
  stroke?:{color:string; width:number};                          // outline; painted UNDER fill (paint-order:"stroke fill")
  shadow?:{x?:number; y?:number; blur:number; color:string}[];   // CSS text-shadow LIST (depth shadow + accent glow); x/y default 0
  // both STATIC + optional → absent = byte-identical render (pixel-gate). Not animatable (no WordKeyframes track).
  keyframes?:WordKeyframes }

type ShapeType = 'rect'|'ellipse'|'line';
interface ShapeKeyframes { position?:PositionKeyframe[]; width?:Keyframe<number>[]; height?:Keyframe<number>[];
  color?:Keyframe<string>[]; opacity?:Keyframe<number>[]; rotation?:Keyframe<number>[]; borderRadius?:Keyframe<number>[]; blur?:Keyframe<number>[] }
interface Shape { id:string; shape:ShapeType; start:number; end:number;   // ABSOLUTE
  x:number; y:number; width:number; height:number; color:string; borderRadius?:number;
  stroke?:{color:string; width:number}; opacity?:number; rotation?:number; keyframes?:ShapeKeyframes }

type TransitionType = 'fade'|'slide'|'wipe'|'none';
type TransitionDir = 'from-left'|'from-right'|'from-top'|'from-bottom';
interface ClipTransition { type:TransitionType; durationInFrames:number; direction?:TransitionDir; timing?:'linear'|'spring' }
// A transition lives on a clip as transitionToNext = the blend at the JOIN with the next clip on the SAME track (overlap).

interface SpeechRegion { startFrame:number; endFrame:number }  // ABSOLUTE; FROZEN (ASR); drives ducking

// ---- Visual clips (video track holds video | color; image tracks hold image) ----
interface VideoClip { id:string; kind:'video'; src:string;          // src may be a path or "placeholder"
  start:number; end:number;          // ABSOLUTE placement on the track
  startFrom:number;                  // source in-point (which source frame plays at clip start) — set by TRIM
  fit:Fit;                           // 'cover' = fullscreen; 'contain' = centered box
  backColor?:string;                 // letterbox/background fill when 'contain' (the box-over-color look)
  x?:number; y?:number; width?:number; height?:number; borderRadius?:number;  // OPTIONAL inset-box geometry (additive; lossless v2-box migration)
  volume?:number; muted?:boolean; speechRegions?:SpeechRegion[]; transitionToNext?:ClipTransition }
interface ColorClip { id:string; kind:'color'; color:string; start:number; end:number; transitionToNext?:ClipTransition }
interface ImageClip { id:string; kind:'image'; src:string; start:number; end:number;
  x:number; y:number; width:number; height:number; fit?:Fit; borderRadius?:number;
  opacity?:number; rotation?:number; keyframes?:ShapeKeyframes; transitionToNext?:ClipTransition }   // overlay image, animatable like a shape
// Authoring-side overlays come from v2 `Scene.overlays` (see §7) and land as overlapping ImageClips (engine `overlapsVideo` overlay path).
interface AudioClip { id:string; src:string; start:number; end:number;   // ABSOLUTE
  startFrom:number;                  // source in-point (TRIM)
  volume:number; fadeInFrames?:number; fadeOutFrames?:number;
  ducking?:{enabled:boolean; duckedVolume:number; attackFrames:number; releaseFrames:number} }

// ---- Tracks (discriminated by kind) ----
type Track =
  | { id:string; kind:'video'; clips:(VideoClip|ColorClip)[] }
  | { id:string; kind:'image'; clips:ImageClip[] }
  | { id:string; kind:'shape'; shapes:Shape[] }
  | { id:string; kind:'text';  words:Word[] }
  | { id:string; kind:'audio'; clips:AudioClip[] };

interface Timeline { fps:number; width:number; height:number; durationInFrames:number; tracks:Track[] }
```

### Track order / z (bottom → top)
**video** (background) → **image** tracks (stack: a higher-index image track over a lower one) → **shape** → **text** (always topmost) → **audio** (no z). The editor lists tracks top→bottom with text near the top and audio at the bottom.

### Clips on a track
- Clips on one track are **sequential, non-overlapping in source playback** EXCEPT for a `transitionToNext` overlap (a transition consumes frames from the end of a clip and the start of the next, as before). Total = max clip `end` across tracks = `durationInFrames`.
- **CUT** at frame F splits a clip into two (`startFrom` adjusted so the second continues the source). **TRIM** drags an edge, changing `startFrom`/duration. **Splice** = clips sitting end-to-end on the same track.

### Sampling (engine) — unchanged math, absolute axis
- Per property: sampled track if present else static fallback. `absFrame = element.start + kf.frame`.
- Scalar: clamp ends; between A→B interpolate by B.easing (preset `Easing.*` or `Easing.bezier`); `hold`=step. Color: RGB (`interpolateColors`). Discrete: step. Position: 2D cubic bezier (P0=A.value,P1=A.value+A.spatialOut,P2=B.value+B.spatialIn,P3=B.value) at temporal `t`.
- `clipReveal` (0..1): left→right `clip-path: inset(...)` mask on the word (typewriter), not glyph-split.
- No baked entrance/exit. Music ducking envelope = union of all video clips' `speechRegions` (already absolute).

## 5. FONT_MAP
`condensedHeavy`→Oswald, `cleanSans`→Inter, `unbounded`→Unbounded, `onest`→Onest,
`playfairItalic`→Playfair Display (**ITALIC** face via the ital axis; resolveFontStyle →
font-style:italic, real cut not a faux slant). All five ship Cyrillic (variable `wght`,
loaded via the css2 API + `delayRender`); Playfair is also italic-probed. Bebas/Anton/Druk
have NO Cyrillic — do not add. Keep `FontKey` (types.ts) and `FONT_MAP` (fonts.ts) in sync.

## 6. Conventions
- Visual `src==="placeholder"` → placeholder rectangle (render never fails without a file).
- Loaded media must live in `public/` (preview `<Player>` and render `staticFile` resolve the same path).
- Colors: white `#ffffff`, red accent `#c0182a`. Audio defaults: volume ~0.6, duckedVolume ~0.15. A new project starts with one empty video track (black shows through) + text + audio tracks.

## 7. Data flow
- **ASR** → `Word`s (absolute `start`) on a text track + a video clip's `speechRegions` (absolute, FROZEN). No keyframes, no shapes.
- **editor** edits tracks/clips/elements, cut/trim/splice, keyframes, transitions (per-clip), audio. **Migration on import:** legacy v2 `scenes[]` → tracks with ABSOLUTE timings (scene offset = cumulative durations − transition overlaps; words/shapes/regions += offset; scene.background → a video/color/image clip; `scene.transitionToNext` → the video clip's `transitionToNext`; AudioTrack → one AudioClip; `enterFrom`→keyframes). MUST NOT alter `speechRegions` content (only re-base to absolute once). `scene.overlays[]` → one image track EACH (id `"<scene>-ov<k>"`), ABSOLUTE timing (+scene offset), keyframes by ref. Track order = scene order then overlay index → z (later = on top). Simultaneous overlays REQUIRE separate tracks (a single track is sequential/non-overlapping). A scene with no overlays emits no overlay track → migration byte-identical.
- **engine** consumes the `Timeline` (tracks) → renders mp4. Integration = JSON into one `timeline.json`. No direct calls between components.
