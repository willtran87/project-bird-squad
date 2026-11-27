/**
 * Pure rules for frame pacing and render resolution (no Phaser, no DOM), so
 * they can be unit tested. See `frame-governor.ts` and `render-resolution.ts`.
 */

export const MAX_RENDER_RATIO = 2;

/** Device pixels per game pixel for a canvas shown `displayWidth` CSS pixels wide. */
export function renderRatioFor(devicePixelRatio: number, displayWidth: number, gameWidth: number, cap = MAX_RENDER_RATIO) {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const shown = Number.isFinite(displayWidth) && displayWidth > 0 ? displayWidth : gameWidth;
  const needed = Math.ceil((shown * dpr / Math.max(1, gameWidth)) * 4 - 0.01) / 4;
  return Math.max(1, Math.min(cap, MAX_RENDER_RATIO, needed));
}

export const GOVERNOR_WINDOW_MS = 2000;
export const GOVERNOR_THRESHOLD_MS = 25;
export const GOVERNOR_GRACE_MS = 3000;
export const GOVERNOR_HITCH_MS = 250;

export interface GovernorSample {
  /** Mean frame time of the last complete window, ms. */
  lastMeanMs?: number;
  windows: number;
}

/** The decision core, free of Phaser and the DOM. */
export class FrameGovernor {
  private total = 0;
  private count = 0;
  private graceLeft = GOVERNOR_GRACE_MS;
  readonly sample: GovernorSample = { windows: 0 };

  /** Start a grace period (boot, a scene change, a step just taken). */
  settle(ms = GOVERNOR_GRACE_MS) {
    this.graceLeft = ms;
    this.total = 0;
    this.count = 0;
  }

  /** Feed one frame; true when the window just closed slow and a step is due. */
  frame(deltaMs: number): boolean {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return false;
    if (deltaMs > GOVERNOR_HITCH_MS) { this.total = 0; this.count = 0; return false; }
    if (this.graceLeft > 0) { this.graceLeft -= deltaMs; return false; }
    this.total += deltaMs;
    this.count += 1;
    if (this.total < GOVERNOR_WINDOW_MS) return false;
    const mean = this.total / this.count;
    this.sample.lastMeanMs = Math.round(mean * 10) / 10;
    this.sample.windows += 1;
    this.total = 0;
    this.count = 0;
    return mean > GOVERNOR_THRESHOLD_MS;
  }
}

