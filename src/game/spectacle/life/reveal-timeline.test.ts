import { describe, expect, it } from 'vitest';
import { REVEAL, reducedRevealAlpha, revealDuration, revealDurationReduced, revealFrame } from './reveal-timeline';

describe('reward reveal timeline', () => {
  it('starts every card face down at the deal origin', () => {
    for (const index of [0, 1, 2]) expect(revealFrame(0, index)).toEqual({ back: { deal: 0, sx: 1 }, face: { shown: false, sx: 0 } });
  });

  it('turns the cards over in order, left to right', () => {
    const shownAt = (index: number) => {
      for (let ms = 0; ms < 3000; ms += 10) if (revealFrame(ms, index).face.shown) return ms;
      return Infinity;
    };
    expect(shownAt(0)).toBeLessThan(shownAt(1));
    expect(shownAt(1)).toBeLessThan(shownAt(2));
    expect(shownAt(1) - shownAt(0)).toBeCloseTo(REVEAL.flipStep, -1);
  });

  it('shows the face only once the back is edge-on, then opens it fully', () => {
    const edge = REVEAL.flipAt + REVEAL.half;
    expect(revealFrame(edge - 1, 0).face.shown).toBe(false);
    expect(revealFrame(edge - 1, 0).back!.sx).toBeLessThan(0.05);
    expect(revealFrame(edge + 1, 0).face.shown).toBe(true);
    expect(revealFrame(edge + REVEAL.half, 0).face.sx).toBe(1);
  });

  it('runs the glint after each turn and ends with everything settled', () => {
    const glintAt = REVEAL.flipAt + REVEAL.half * 2 + 10;
    expect(revealFrame(glintAt, 0).glint).toBeGreaterThan(0);
    const end = revealDuration(3);
    for (const index of [0, 1, 2]) expect(revealFrame(end, index)).toEqual({ face: { shown: true, sx: 1 }, glint: undefined });
    expect(end).toBeLessThan(1500);
  });

  it('fades faces up in order under Reduced Motion', () => {
    expect(reducedRevealAlpha(0, 0)).toBe(0);
    expect(reducedRevealAlpha(revealDurationReduced(3), 2)).toBe(1);
    expect(reducedRevealAlpha(100, 0)).toBeGreaterThan(reducedRevealAlpha(100, 1));
  });
});
