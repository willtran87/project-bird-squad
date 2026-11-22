/**
 * Timing for the card reward reveal, as pure functions of elapsed time so the
 * destroy-and-redraw scenes can pick it up mid-way. Each card is dealt face
 * down, turns over in sequence, then a rarity glint crosses its face.
 */

export const REVEAL = { deal: 240, dealStep: 70, flipAt: 340, flipStep: 160, half: 110, glint: 340 } as const;
export const REDUCED_REVEAL = { fade: 140, step: 80 } as const;

export interface RevealFrame {
  /** Card back: 0..1 along its deal path, horizontal scale while it turns; absent once turned. */
  back?: { deal: number; sx: number };
  /** Face: hidden until the back is edge-on, then turns open. */
  face: { shown: boolean; sx: number };
  /** 0..1 progress of the glint across the face, while it runs. */
  glint?: number;
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t * t;

/** Total length of a full reveal for `count` cards, in authored milliseconds. */
export function revealDuration(count: number) {
  return REVEAL.flipAt + Math.max(0, count - 1) * REVEAL.flipStep + REVEAL.half * 2 + REVEAL.glint;
}

export function revealDurationReduced(count: number) {
  return Math.max(0, count - 1) * REDUCED_REVEAL.step + REDUCED_REVEAL.fade;
}

/** Where card `index` is `ms` after the reveal began. */
export function revealFrame(ms: number, index: number): RevealFrame {
  const deal = easeOut(clamp01((ms - index * REVEAL.dealStep) / REVEAL.deal));
  const flip = ms - (REVEAL.flipAt + index * REVEAL.flipStep);
  if (flip < REVEAL.half) {
    // The back narrows to edge-on; the face waits behind it.
    return { back: { deal, sx: 1 - easeIn(clamp01(flip / REVEAL.half)) }, face: { shown: false, sx: 0 } };
  }
  const open = clamp01((flip - REVEAL.half) / REVEAL.half);
  const glint = (flip - REVEAL.half * 2) / REVEAL.glint;
  return { face: { shown: true, sx: open < 1 ? Math.max(0.02, easeOut(open)) : 1 }, glint: glint >= 0 && glint < 1 ? glint : undefined };
}

/** Reduced Motion: no dealing or turning, the faces fade up in order. */
export function reducedRevealAlpha(ms: number, index: number) {
  return easeOut(clamp01((ms - index * REDUCED_REVEAL.step) / REDUCED_REVEAL.fade));
}
