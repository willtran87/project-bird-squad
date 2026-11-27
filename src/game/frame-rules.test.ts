import { describe, expect, it } from 'vitest';
import { FrameGovernor, GOVERNOR_GRACE_MS, renderRatioFor } from './frame-rules';

describe('render ratio', () => {
  it('matches device pixels per game pixel, in quarter steps, between 1 and 2', () => {
    expect(renderRatioFor(1, 1280, 1280)).toBe(1);
    expect(renderRatioFor(2, 1280, 1280)).toBe(2);
    expect(renderRatioFor(3, 1280, 1280)).toBe(2);
    expect(renderRatioFor(1.5, 1280, 1280)).toBe(1.5);
    expect(renderRatioFor(1, 1920, 1280)).toBe(1.5);
    // A small canvas on a dense screen needs no more pixels than it shows.
    expect(renderRatioFor(2, 640, 1280)).toBe(1);
    expect(renderRatioFor(2, 1000, 1280)).toBe(1.75);
  });

  it('honours the quality cap and ignores nonsense input', () => {
    expect(renderRatioFor(2, 1280, 1280, 1)).toBe(1);
    expect(renderRatioFor(Number.NaN, 1280, 1280)).toBe(1);
    expect(renderRatioFor(2, 0, 1280)).toBe(2);
  });
});

describe('frame governor', () => {
  const run = (governor: FrameGovernor, delta: number, ms: number) => {
    let due = 0;
    for (let spent = 0; spent < ms; spent += delta) if (governor.frame(delta)) due += 1;
    return due;
  };

  it('waits out the grace period before judging', () => {
    const governor = new FrameGovernor();
    expect(run(governor, 50, GOVERNOR_GRACE_MS - 100)).toBe(0);
    expect(governor.sample.windows).toBe(0);
  });

  it('asks for a step after a slow two-second window, not a fast one', () => {
    const slow = new FrameGovernor();
    slow.settle(0);
    expect(run(slow, 40, 2000)).toBe(1);
    expect(slow.sample.lastMeanMs).toBe(40);
    const fast = new FrameGovernor();
    fast.settle(0);
    expect(run(fast, 16.7, 6000)).toBe(0);
    expect(fast.sample.windows).toBeGreaterThanOrEqual(2);
  });

  it('ignores hitches and restarts the window after one', () => {
    const governor = new FrameGovernor();
    governor.settle(0);
    run(governor, 16.7, 1900);
    expect(governor.frame(900)).toBe(false);
    // The window restarted: one more slow-ish second is not enough on its own.
    expect(run(governor, 30, 1000)).toBe(0);
  });
});
