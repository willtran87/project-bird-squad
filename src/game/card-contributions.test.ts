// Migrated from tools/tests/card-contributions.test.mjs (node:test + transpile-to-data: URL).
import { describe, expect, it } from 'vitest';
import {
  contributionReading,
  emptyContribution,
  recordContribution,
  sanitizeContributions,
  totalContributions,
  type CardContribution,
} from './card-contributions';

describe('card contributions', () => {
  it('preserve legacy absence and reject malformed, duplicate and unknown save entries', () => {
    const known = (id: string) => id === 'major_00';
    expect(sanitizeContributions(undefined, known)).toBeUndefined();
    expect(sanitizeContributions({}, known)).toBeUndefined();
    const rows = sanitizeContributions([null, {}, { cardId: '__proto__', plays: 99 },
      { cardId: 'major_00', plays: 2, damage: 1e12, cover: -4, healing: NaN, drawn: '3', wingbeats: 1.7 },
      { cardId: 'major_00', plays: 200 }], known);
    expect(rows).toEqual([{ ...emptyContribution('major_00'), plays: 2, damage: 1_000_000, wingbeats: 1 }]);
    expect(sanitizeContributions(JSON.parse(JSON.stringify(rows)), known)).toEqual(rows);
  });

  it('drops rows with no plays', () => {
    expect(sanitizeContributions([{ cardId: 'major_00', damage: 5 }], () => true)).toEqual([]);
  });

  it('combine encounters without changing saved records or inventing older evidence', () => {
    const rows: Array<{ cardContributions?: CardContribution[] }> = [
      { cardContributions: [{ ...emptyContribution('major_00'), plays: 1, damage: 4 }] },
      {},
      { cardContributions: [{ ...emptyContribution('major_00'), plays: 2, damage: 6, cover: 3 }] },
    ];
    const before = JSON.stringify(rows);
    const result = totalContributions(rows);
    expect(result[0].plays).toBe(3);
    expect(result[0].damage).toBe(10);
    expect(result[0].cover).toBe(3);
    expect(JSON.stringify(rows)).toBe(before);
    expect(contributionReading(rows, () => 'First Flight')).toMatch(/First Flight · 3 plays\n10 damage · 3 Cover gained/);
    expect(contributionReading([{}], () => '')).toMatch(/No card contributions recorded yet/);
    expect(contributionReading(rows, () => '')).toMatch(/Cover gained is not damage prevented/);
  });

  it('accumulation ignores non-finite values and keeps numeric counters bounded', () => {
    const rows: CardContribution[] = [];
    for (const value of [NaN, Infinity, -5, 0]) recordContribution(rows, 'major_00', 'damage', value);
    expect(rows).toEqual([]);
    recordContribution(rows, 'major_00', 'damage', 999999);
    recordContribution(rows, 'major_00', 'damage', 9);
    expect(rows[0].damage).toBe(1_000_000);
  });
});
