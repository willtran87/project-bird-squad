import { describe, expect, it } from 'vitest';
import { FAST_MODE_MIN_DELAY_MS, fastModeDelay, normalizeFastMode, normalizeRumble } from './pace-rules';
import { hapticPattern } from './haptic-dispatch';

describe('Fast Mode pacing rules', () => {
  it('defaults safely from stored values', () => {
    expect(normalizeFastMode('on')).toBe('on');
    expect(normalizeFastMode('yes')).toBe('off');
    expect(normalizeFastMode(null)).toBe('off');
    expect(normalizeRumble('off')).toBe('off');
    expect(normalizeRumble(undefined)).toBe('on');
    expect(normalizeRumble('garbage')).toBe('on');
  });

  it('leaves delays untouched when off', () => {
    for (const ms of [0, 12, 40, 480, 2600]) expect(fastModeDelay(ms, false)).toBe(ms);
  });

  it('shortens pauses but never below the minimum or above the original', () => {
    expect(fastModeDelay(0, true)).toBe(0);
    expect(fastModeDelay(20, true)).toBe(20);
    expect(fastModeDelay(50, true)).toBe(FAST_MODE_MIN_DELAY_MS);
    expect(fastModeDelay(1000, true)).toBe(600);
    for (let ms = 1; ms < 4000; ms += 37) {
      const fast = fastModeDelay(ms, true);
      expect(fast).toBeLessThanOrEqual(ms);
      expect(fast).toBeGreaterThanOrEqual(Math.min(ms, FAST_MODE_MIN_DELAY_MS));
    }
  });

  it('keeps touch vibration patterns short and gamepad magnitudes in range', () => {
    for (const moment of ['heavyHit', 'flockHit', 'finishingBlow', 'surge'] as const) {
      const pattern = hapticPattern(moment);
      expect(pattern.vibrate.reduce((sum, ms) => sum + ms, 0)).toBeLessThanOrEqual(200);
      expect(pattern.durationMs).toBeLessThanOrEqual(300);
      for (const magnitude of [pattern.strong, pattern.weak]) {
        expect(magnitude).toBeGreaterThanOrEqual(0);
        expect(magnitude).toBeLessThanOrEqual(1);
      }
    }
  });
});
