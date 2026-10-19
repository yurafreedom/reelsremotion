// Structure builders — the skeleton of a reel: timeline, scenes, the video inset,
// transitions, and the music track. All produce CONTRACT-valid data; nothing here
// touches words or keyframes (see text.ts / animation.ts).
//
// Frame constants are fixed by CONTRACT §1 (1080×1920). fps comes from the
// timeline, never hardcoded downstream.

import type {
  AudioTrack,
  Background,
  BackgroundFit,
  BoxBackground,
  Overlay,
  Scene,
  SceneTransition,
  Timeline,
  TransitionDir,
  TransitionType,
} from "@engine/types";

export const FRAME_WIDTH = 1080;
export const FRAME_HEIGHT = 1920;

/** Create an empty reel. Defaults: 30fps, no audio, no scenes. (v2.2: there is no
 *  top-level background — each scene carries its own `background`.) */
export const createTimeline = (opts: { fps?: number } = {}): Timeline => ({
  fps: opts.fps ?? 30,
  width: FRAME_WIDTH,
  height: FRAME_HEIGHT,
  audio: null,
  scenes: [],
});

/** A solid color background (CONTRACT §4). Default for text-only scenes. */
export const colorBackground = (color = "#000000"): Background => ({
  type: "color",
  color,
});

/** A fullscreen video-cover background — the default when a clip is loaded. */
export const coverBackground = (
  src: string,
  opts: { startFrom?: number; volume?: number; muted?: boolean } = {}
): Background => {
  const bg: Background = { type: "cover", src };
  if (opts.startFrom !== undefined) bg.startFrom = opts.startFrom;
  if (opts.volume !== undefined) bg.volume = opts.volume;
  if (opts.muted !== undefined) bg.muted = opts.muted;
  return bg;
};

/** The default centered placeholder box over a solid fill (renders without any
 *  clip file — CONTRACT §6: src "placeholder"). The old inset, now a background. */
export const placeholderBox = (
  opts: {
    src?: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    borderRadius?: number;
    backColor?: string;
  } = {}
): BoxBackground => ({
  type: "box",
  src: opts.src ?? "placeholder",
  x: opts.x ?? 0,
  y: opts.y ?? 0,
  width: opts.width ?? 880,
  height: opts.height ?? 500,
  borderRadius: opts.borderRadius ?? 20,
  backColor: opts.backColor ?? "#000000",
});

/** Append a scene; returns the live Scene object (mutate it with addWord etc.).
 *  Default background = solid black (CONTRACT §6); pass `background` to override. */
export const addScene = (
  t: Timeline,
  opts: { durationInFrames: number; background?: Background }
): Scene => {
  const scene: Scene = {
    id: `s${t.scenes.length + 1}`,
    durationInFrames: opts.durationInFrames,
    background: opts.background ?? colorBackground("#000000"),
    words: [],
  };
  t.scenes.push(scene);
  return scene;
};

/** Set a scene's background directly. */
export const setBackground = (scene: Scene, background: Background): Background => {
  scene.background = background;
  return background;
};

/** Set/replace a scene's background as a video BOX (the old inset case).
 *  Geometry defaults to the placeholder box; preserves FROZEN speechRegions if the
 *  scene already had a cover/box background (CONTRACT §7). */
export const setVideo = (
  scene: Scene,
  opts: {
    src: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    borderRadius?: number;
    startFrom?: number;
    volume?: number;
    muted?: boolean;
    backColor?: string;
  }
): BoxBackground => {
  const v = placeholderBox(opts);
  v.src = opts.src;
  if (opts.startFrom !== undefined) v.startFrom = opts.startFrom;
  if (opts.volume !== undefined) v.volume = opts.volume;
  if (opts.muted !== undefined) v.muted = opts.muted;
  const prev = scene.background;
  if ((prev?.type === "box" || prev?.type === "cover") && prev.speechRegions) {
    v.speechRegions = prev.speechRegions;
  }
  scene.background = v;
  return v;
};

/** Lay a foreground image OVER the scene's video (a collage band, a logo…).
 *  start/end default to the whole scene. Each overlay migrates to its OWN image
 *  track, so two simultaneous overlays z-stack in ADD order (last = on top).
 *  z: above the video, below shapes/words. Coordinates per CONTRACT §2 (center
 *  offset from frame center; 1080×1920). */
export const addImageOverlay = (
  scene: Scene,
  opts: {
    src: string;
    width: number;
    height: number;
    x?: number;
    y?: number;
    start?: number;
    end?: number;
    fit?: BackgroundFit;
    borderRadius?: number;
    opacity?: number;
    rotation?: number;
  }
): Overlay => {
  const ov: Overlay = {
    src: opts.src,
    start: opts.start ?? 0,
    end: opts.end ?? scene.durationInFrames,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    width: opts.width,
    height: opts.height,
  };
  if (opts.fit !== undefined) ov.fit = opts.fit;
  if (opts.borderRadius !== undefined) ov.borderRadius = opts.borderRadius;
  if (opts.opacity !== undefined) ov.opacity = opts.opacity;
  if (opts.rotation !== undefined) ov.rotation = opts.rotation;
  if (!scene.overlays) scene.overlays = [];
  scene.overlays.push(ov);
  return ov;
};

/** Set the transition FROM scene `afterSceneIndex` to the next one. `duration` is
 *  the overlap in frames (CONTRACT §4.1). */
export const setTransition = (
  t: Timeline,
  afterSceneIndex: number,
  opts: {
    type: TransitionType;
    duration: number;
    direction?: TransitionDir;
    timing?: "linear" | "spring";
  }
): SceneTransition => {
  const scene = t.scenes[afterSceneIndex];
  if (!scene) throw new Error(`setTransition: no scene at index ${afterSceneIndex}`);
  const tr: SceneTransition = {
    type: opts.type,
    durationInFrames: opts.duration,
  };
  if (opts.direction !== undefined) tr.direction = opts.direction;
  if (opts.timing !== undefined) tr.timing = opts.timing;
  scene.transitionToNext = tr;
  return tr;
};

/** Lay a music track over the whole reel. */
export const setAudio = (
  t: Timeline,
  opts: {
    src: string;
    volume?: number;
    fadeInFrames?: number;
    fadeOutFrames?: number;
  }
): AudioTrack => {
  const a: AudioTrack = { src: opts.src, volume: opts.volume ?? 0.6 };
  if (opts.fadeInFrames !== undefined) a.fadeInFrames = opts.fadeInFrames;
  if (opts.fadeOutFrames !== undefined) a.fadeOutFrames = opts.fadeOutFrames;
  t.audio = a;
  return a;
};

/** Enable speech-driven music ducking. Requires audio to be set first (the
 *  envelope is driven by the inset's FROZEN speechRegions — CONTRACT §7). */
export const enableDucking = (
  t: Timeline,
  opts: {
    duckedVolume?: number;
    attackFrames?: number;
    releaseFrames?: number;
  } = {}
): AudioTrack => {
  if (!t.audio || typeof t.audio === "string") {
    throw new Error("enableDucking: call setAudio(...) first");
  }
  t.audio.ducking = {
    enabled: true,
    duckedVolume: opts.duckedVolume ?? 0.15,
    attackFrames: opts.attackFrames ?? 6,
    releaseFrames: opts.releaseFrames ?? 12,
  };
  return t.audio;
};
