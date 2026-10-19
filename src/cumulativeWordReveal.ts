/**
 * Restrained cumulative token entrance. At the reveal frame opacity is already
 * positive; after `fadeFrames` it is fully opaque and remains so until the
 * parent semantic phrase ends.
 */
export const cumulativeWordOpacity = (
  absoluteFrame: number,
  revealFrame: number,
  fadeFrames = 3
): number => {
  if (absoluteFrame < revealFrame) return 0;
  const duration = Math.max(1, Math.round(fadeFrames));
  return Math.min(1, (absoluteFrame - revealFrame + 1) / duration);
};
