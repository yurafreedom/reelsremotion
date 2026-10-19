// Layout helpers — vertical stacking and the Instagram safe zone. Coordinates are
// offsets-from-center in px (CONTRACT §2): (0,0) = frame center, +y = down.

import type { Word } from "@engine/types";

// Frame is 1080×1920 → half extents (540, 960). The safe zone keeps text clear of
// IG's chrome: the top profile/sound row and the bottom caption + action rail.
// These are conservative offsets-from-center; treat as a guide, not a hard clip.
export const SAFE_ZONE = {
  minX: -480, // ~60px side margins
  maxX: 480,
  minY: -740, // ~220px reserved at top
  maxY: 600, // ~360px reserved at bottom (caption + buttons)
} as const;

/** Clamp a point into the safe zone. */
export const clampToSafeZone = (p: { x: number; y: number }): { x: number; y: number } => ({
  x: Math.max(SAFE_ZONE.minX, Math.min(SAFE_ZONE.maxX, p.x)),
  y: Math.max(SAFE_ZONE.minY, Math.min(SAFE_ZONE.maxY, p.y)),
});

/** Whether a point sits inside the safe zone. */
export const inSafeZone = (p: { x: number; y: number }): boolean =>
  p.x >= SAFE_ZONE.minX &&
  p.x <= SAFE_ZONE.maxX &&
  p.y >= SAFE_ZONE.minY &&
  p.y <= SAFE_ZONE.maxY;

/**
 * Stack words vertically. Mutates each word's x,y in place and returns them.
 * - `gap`     : vertical spacing between word centers (px).
 * - `center`  : true → x = 0 for all (a centered column).
 * - `startY`  : y of the FIRST word. Omitted → the column is centered on y=0.
 */
export const stackVertical = (
  words: Word[],
  opts: { gap?: number; center?: boolean; startY?: number } = {}
): Word[] => {
  const gap = opts.gap ?? 70;
  const center = opts.center ?? true;
  const n = words.length;
  if (n === 0) return words;
  const startY = opts.startY ?? -((n - 1) * gap) / 2; // centered block
  words.forEach((w, i) => {
    if (center) w.x = 0;
    w.y = Math.round(startY + i * gap);
  });
  return words;
};
