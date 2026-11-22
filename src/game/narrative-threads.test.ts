import { describe, expect, it } from 'vitest';
import { flockLeaders } from './leaders';
import { narrativeThreads } from './narrative-content';
import { closingLine, districtArrivalLine } from './narrative-threads';

const allLines = Object.values(narrativeThreads).flatMap((threads) => [
  ...threads.arrivals.flat(), ...threads.closings.win, ...threads.closings.loss,
]);

describe('narrative content', () => {
  it('covers every Leader with at least four lines for each district', () => {
    expect(Object.keys(narrativeThreads).sort()).toEqual(flockLeaders.map((leader) => leader.id).sort());
    for (const leader of flockLeaders) {
      const threads = narrativeThreads[leader.id];
      expect(threads.arrivals).toHaveLength(4);
      for (const lines of threads.arrivals) expect(lines.length).toBeGreaterThanOrEqual(4);
      expect(threads.closings.win.length).toBeGreaterThanOrEqual(3);
      expect(threads.closings.loss.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('never repeats a line and keeps each short enough for the arrival card', () => {
    expect(new Set(allLines).size).toBe(allLines.length);
    for (const line of allLines) {
      expect(line.length, line).toBeGreaterThan(20);
      expect(line.length, line).toBeLessThanOrEqual(112);
      expect(line.trim(), line).toBe(line);
      expect(line, line).toMatch(/[.!?]$/);
    }
  });

  it('stays in the grounded street voice: no magic or fantasy language', () => {
    const banned = /\b(magic\w*|spell\w*|arcane|mystic\w*|enchant\w*|wizard\w*|sorcer\w*|prophec\w*|destin\w*|fate[sd]?|curse[sd]?|ritual\w*|soul\w*|spirit\w*|ancient|realm\w*|kingdom\w*|sword\w*|dragon\w*|divine|bless\w*|omen\w*|glow\w*|floating)\b/i;
    for (const line of allLines) expect(line, line).not.toMatch(banned);
  });

  it('only uses the district placeholder in closings that lost flights can reach', () => {
    for (const threads of Object.values(narrativeThreads)) {
      for (const line of threads.arrivals.flat()) expect(line).not.toContain('{');
      // A loss names where it happened.
      for (const line of threads.closings.loss) expect(line, line).toContain('{district}');
    }
  });
});

describe('narrative picks', () => {
  it('is fixed by the seed, Leader and district', () => {
    for (const leader of flockLeaders) for (let district = 0; district < 4; district += 1) {
      const line = districtArrivalLine('daily-20261120', leader.id, district);
      expect(line).toBe(districtArrivalLine('daily-20261120', leader.id, district));
      expect(narrativeThreads[leader.id].arrivals[district]).toContain(line);
    }
  });

  it('reaches every line across seeds, so repeats are rare', () => {
    for (const leader of flockLeaders) for (let district = 0; district < 4; district += 1) {
      const seen = new Set<string>();
      for (let seed = 0; seed < 200; seed += 1) seen.add(districtArrivalLine(`seed-${seed}`, leader.id, district));
      expect(seen.size).toBe(narrativeThreads[leader.id].arrivals[district].length);
    }
  });

  it('gives different Leaders different lines for the same district and seed', () => {
    const lines = flockLeaders.map((leader) => districtArrivalLine('alpha', leader.id, 1));
    expect(new Set(lines).size).toBe(flockLeaders.length);
  });

  it('closes on the result and names the last district', () => {
    for (const leader of flockLeaders) {
      const loss = closingLine('alpha', leader.id, 'loss', 'Signal Spires');
      expect(loss).toContain('Signal Spires');
      expect(loss).not.toContain('{');
      const win = closingLine('alpha', leader.id, 'win', 'High Roost');
      expect(win).not.toContain('{');
      expect(win).not.toBe(loss);
      expect(narrativeThreads[leader.id].closings.win.map((line) => line.replace(/\{district\}/g, 'High Roost'))).toContain(win);
    }
  });

  it('falls back to the starting crew for unknown Leaders and clamps the district', () => {
    expect(narrativeThreads.fledgling.arrivals[0]).toContain(districtArrivalLine('alpha', 'nobody', -3));
    expect(narrativeThreads.fledgling.arrivals[3]).toContain(districtArrivalLine('alpha', undefined, 99));
    expect(narrativeThreads.fledgling.arrivals[0]).toContain(districtArrivalLine('alpha', 'fledgling', Number.NaN));
  });
});
