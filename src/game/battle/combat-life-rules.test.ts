import { describe, expect, it } from 'vitest';
import { hitWeight } from '../combat-rules';
import {
  approach, comboStyle, enemyBadges, flockBadges, GHOST_HOLD_MS, intentIcon, leaderAccentColor, leaderFlourish,
  rollPlan, rollValue, stepGhost, waymarkTarget,
} from './combat-life-rules';

describe('combat life rules', () => {
  it('lists flock badges with stacks in reading order and enemy badges in status-text order', () => {
    const flock = { block: 5, weak: 2, frail: 1, exposed: true, molt: true, fouled: 0, openSkyGuard: 0 };
    expect(flockBadges(flock, 3).map(b => [b.icon, b.stacks])).toEqual([
      ['cover', 5], ['winded', 2], ['ruffled', 1], ['openSky', undefined], ['molt', undefined], ['resonance', 3]]);
    expect(flockBadges({ block: 0, weak: 0, frail: 0 })).toEqual([]);
    expect(enemyBadges({ block: 7, weak: 2 }).map(b => b.label)).toEqual(['7 Cover', '2 Winded']);
  });

  it('maps every intent kind to an icon, with unknown as the fallback', () => {
    expect(['attack', 'cover', 'charge', 'support', 'pressure', 'mystery'].map(intentIcon))
      .toEqual(['attack', 'defend', 'buff', 'buff', 'debuff', 'unknown']);
  });

  it('drains the bar quickly and holds the ghost for a beat before it catches up', () => {
    let bar = { shown: 1, ghost: 1, holdUntil: 0 };
    bar = stepGhost(bar, 0.5, 1000, 16);
    expect(bar.holdUntil).toBe(1000 + GHOST_HOLD_MS);
    for (let t = 1016; t < 1000 + GHOST_HOLD_MS; t += 16) bar = stepGhost(bar, 0.5, t, 16);
    expect(bar.shown).toBeCloseTo(0.5, 2);
    expect(bar.ghost).toBe(1);
    for (let t = 1000 + GHOST_HOLD_MS; t < 3000; t += 16) bar = stepGhost(bar, 0.5, t, 16);
    expect(bar.ghost).toBe(0.5);
    // Healing snaps up; no ghost is left below the new value.
    expect(stepGhost(bar, 0.8, 3000, 16)).toMatchObject({ shown: 0.8, ghost: 0.8 });
  });

  it('rolls counters in audible steps, capped, and lands exactly', () => {
    expect(rollPlan(2, 2)).toEqual({ steps: 0, duration: 0 });
    expect(rollPlan(0, 3)).toEqual({ steps: 3, duration: 225 });
    expect(rollPlan(0, 40).steps).toBe(8);
    expect(rollPlan(0, 40).duration).toBeLessThanOrEqual(420);
    expect(rollValue(0, 10, 0.5)).toBe(5);
    expect(rollValue(7, 3, 1)).toBe(3);
  });

  it('grows the combo chain from two cards and resets below it', () => {
    expect(comboStyle(1).visible).toBe(false);
    expect(comboStyle(2)).toMatchObject({ visible: true, scale: 1, label: '×2' });
    expect(comboStyle(4).scale).toBeGreaterThan(comboStyle(3).scale);
    expect(comboStyle(20).scale).toBeLessThanOrEqual(1.32);
  });

  it('weights hits by share of the maximum, not a fixed amount', () => {
    expect(hitWeight(0, 30)).toBe(0);
    expect(hitWeight(8, 100)).toBeLessThan(0.6);
    expect(hitWeight(8, 30)).toBeGreaterThanOrEqual(0.6);
    expect(hitWeight(1000, 30)).toBe(1);
    expect(approach(1, 0, 1e6, 70)).toBe(0);
  });

  it('gives every Leader a distinct flourish and their Codex accent', () => {
    const ids = ['fledgling', 'spark_caller', 'talon', 'tidewarden', 'roostkeeper'];
    expect(new Set(ids.map(leaderFlourish)).size).toBe(5);
    expect(leaderAccentColor('Basins')).toBe(0x2fc6c9);
  });

  it('points a fired Waymark at what it changed', () => {
    expect(waymarkTarget(['damageAll(2)'])).toBe('enemies');
    expect(waymarkTarget(['gainWingbeat(1)'])).toBe('Wingbeats');
    expect(waymarkTarget(['gainScrap(5)'])).toBe('Scrap');
    expect(waymarkTarget(['draw(1)'])).toBe('hand');
    expect(waymarkTarget(['gainCover(3)'])).toBe('flock');
  });
});
