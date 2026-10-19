// fps re-timing for Export (v2.5).
//
// THE fps BEHAVIOR (documented, see editor/README.md "Export"):
// The whole engine is FRAME-BASED at the timeline's base fps (CONTRACT §1/§3: 30).
// Exporting at 60 fps must produce the SAME visible animation, only SMOOTHER —
// never faster/slower. Remotion takes the composition fps from `timeline.fps`
// (Root.tsx calculateMetadata), so to render at 60 we set fps=60 AND scale every
// frame-valued field by ratio = outFps / baseFps. Wall-clock duration is then
// identical; there are simply twice as many in-between frames at 60.
//
// We scale ONLY frame quantities. Pixel/value/color fields (x, y, size, weight,
// width, height, opacity, rotation, blur, borderRadius, spatial tangents, volume)
// are NOT touched. Ratio 60/30 = 2 is exact; we round defensively for generality.
//
// This is a pure JSON→JSON transform (no engine import) so it runs in the render
// worker. The editor's own props.json builder is reused verbatim upstream — this
// only re-times the result for a higher output fps.

const scaleFrame = (v, ratio) =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v * ratio) : v;

// Scale every keyframe's `frame` (element-relative; CONTRACT §3). Tracks are
// arrays of { frame, value, ... }. value/spatial fields are left untouched.
function retimeKeyframes(kf, ratio) {
  if (!kf || typeof kf !== "object") return kf;
  const out = {};
  for (const [prop, track] of Object.entries(kf)) {
    out[prop] = Array.isArray(track)
      ? track.map((k) => ({ ...k, frame: scaleFrame(k.frame, ratio) }))
      : track;
  }
  return out;
}

function retimeWord(w, ratio) {
  const o = { ...w, start: scaleFrame(w.start, ratio), end: scaleFrame(w.end, ratio) };
  if (w.keyframes) o.keyframes = retimeKeyframes(w.keyframes, ratio);
  return o;
}

function retimeShape(s, ratio) {
  const o = { ...s, start: scaleFrame(s.start, ratio), end: scaleFrame(s.end, ratio) };
  if (s.keyframes) o.keyframes = retimeKeyframes(s.keyframes, ratio);
  return o;
}

function retimeBackground(bg, ratio) {
  if (!bg || typeof bg !== "object") return bg;
  const o = { ...bg };
  if (typeof o.startFrom === "number") o.startFrom = scaleFrame(o.startFrom, ratio);
  if (Array.isArray(o.speechRegions)) {
    // FROZEN data, but its frame addresses must follow the new fps to stay aligned.
    o.speechRegions = o.speechRegions.map((r) => ({
      startFrame: scaleFrame(r.startFrame, ratio),
      endFrame: scaleFrame(r.endFrame, ratio),
    }));
  }
  return o;
}

function retimeTransition(t, ratio) {
  if (!t || typeof t !== "object") return t;
  return { ...t, durationInFrames: scaleFrame(t.durationInFrames, ratio) };
}

function retimeAudio(a, ratio) {
  if (!a || typeof a !== "object") return a; // null or legacy string path → unchanged
  const o = { ...a };
  if (typeof o.fadeInFrames === "number") o.fadeInFrames = scaleFrame(o.fadeInFrames, ratio);
  if (typeof o.fadeOutFrames === "number") o.fadeOutFrames = scaleFrame(o.fadeOutFrames, ratio);
  if (o.ducking && typeof o.ducking === "object") {
    o.ducking = {
      ...o.ducking,
      attackFrames: scaleFrame(o.ducking.attackFrames, ratio),
      releaseFrames: scaleFrame(o.ducking.releaseFrames, ratio),
    };
  }
  return o;
}

function retimeScene(s, ratio) {
  const o = {
    ...s,
    durationInFrames: scaleFrame(s.durationInFrames, ratio),
    background: retimeBackground(s.background, ratio),
  };
  if (Array.isArray(s.shapes)) o.shapes = s.shapes.map((sh) => retimeShape(sh, ratio));
  o.words = Array.isArray(s.words) ? s.words.map((w) => retimeWord(w, ratio)) : s.words;
  if (s.transitionToNext) o.transitionToNext = retimeTransition(s.transitionToNext, ratio);
  return o;
}

/**
 * Return a deep copy of `timeline` re-timed to `outFps`. If outFps equals the
 * base fps (or input is invalid), the timeline is returned unchanged (only fps
 * normalized). Animation stays visually identical — smoother at the higher fps.
 *
 * @param {object} timeline
 * @param {number} outFps  target output fps (30 or 60)
 */
export function retimeTimeline(timeline, outFps) {
  const base = timeline?.fps;
  if (!base || !outFps || outFps === base) return timeline;
  const ratio = outFps / base;
  return {
    ...timeline,
    fps: outFps,
    audio: retimeAudio(timeline.audio, ratio),
    scenes: Array.isArray(timeline.scenes)
      ? timeline.scenes.map((s) => retimeScene(s, ratio))
      : timeline.scenes,
  };
}
