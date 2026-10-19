// Text builders — words and lines on a scene, plus a targeting helper. Words are
// created STATIC (no keyframes, CONTRACT §4 hard-cut). Motion is layered on later
// by the animation wrappers. `enterFrom` defaults to "none": it is an editor hint
// only (the engine ignores it), so the SDK never relies on it for animation.

import type { FontKey, Scene, TextCase, Word } from "@engine/types";

/** Style fields shared by addWord/addLine (everything that is not position/timing). */
export type WordStyle = {
  font?: FontKey;
  size?: number;
  weight?: number;
  color?: string;
  case?: TextCase;
};

const WHITE = "#ffffff";

const styled = (text: string, style?: WordStyle): Pick<
  Word,
  "text" | "font" | "size" | "weight" | "color" | "enterFrom"
> & { case?: TextCase } => {
  const w = {
    text,
    font: (style?.font ?? "cleanSans") as FontKey,
    size: style?.size ?? 44,
    weight: style?.weight ?? 400,
    color: style?.color ?? WHITE,
    enterFrom: "none" as const,
  } as ReturnType<typeof styled>;
  if (style?.case !== undefined) w.case = style.case;
  return w;
};

/** Add one word/phrase to a scene. Returns the live Word (animate it afterward). */
export const addWord = (
  scene: Scene,
  opts: {
    text: string;
    start: number;
    end: number;
    x?: number;
    y?: number;
  } & WordStyle
): Word => {
  const base = styled(opts.text, opts);
  const word: Word = {
    ...base,
    start: opts.start,
    end: opts.end,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
  };
  scene.words.push(word);
  return word;
};

/** Convenience over addWord positioned by an explicit point. `end` defaults to the
 *  scene end (the accumulating-subtitle reels style — words hang until the cut). */
export const addLine = (
  scene: Scene,
  text: string,
  opts: { at: { x: number; y: number }; start: number; end?: number; style?: WordStyle }
): Word =>
  addWord(scene, {
    text,
    start: opts.start,
    end: opts.end ?? scene.durationInFrames,
    x: opts.at.x,
    y: opts.at.y,
    ...opts.style,
  });

/** Find a word by its text (exact, then trimmed). Throws if absent — CC is
 *  targeting it for an edit, so a silent miss would be worse than an error. */
export const findWord = (scene: Scene, text: string): Word => {
  const exact = scene.words.find((w) => w.text === text);
  if (exact) return exact;
  const trimmed = scene.words.find((w) => w.text.trim() === text.trim());
  if (trimmed) return trimmed;
  const have = scene.words.map((w) => JSON.stringify(w.text)).join(", ");
  throw new Error(`findWord: no word ${JSON.stringify(text)} in scene (have: ${have})`);
};
