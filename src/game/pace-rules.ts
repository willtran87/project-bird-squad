/**
 * Pure pacing rules shared by settings, combat timing and haptics. No Phaser,
 * no storage: everything here is unit-tested in isolation.
 */
export type FastModePreference = 'off' | 'on';
export type RumblePreference = 'on' | 'off';

/** Presentation clocks run this much faster with Fast Mode on. */
export const FAST_MODE_TIME_SCALE = 1.6;
/** Combat pauses (enemy tells, resolve holds) are multiplied by this. */
export const FAST_MODE_DELAY_SCALE = 0.6;
/** A scaled pause never drops below this, so every beat still renders. */
export const FAST_MODE_MIN_DELAY_MS = 40;

export function normalizeFastMode(value: unknown): FastModePreference {
  return value === 'on' ? 'on' : 'off';
}

export function normalizeRumble(value: unknown): RumblePreference {
  return value === 'off' ? 'off' : 'on';
}

/** Shorten an already pace-scaled combat delay for Fast Mode. Zero stays zero
 *  (an instant beat is never turned into a wait). */
export function fastModeDelay(ms: number, fast: boolean) {
  if (!fast || ms <= 0) return ms;
  return Math.max(Math.min(ms, FAST_MODE_MIN_DELAY_MS), Math.round(ms * FAST_MODE_DELAY_SCALE));
}
