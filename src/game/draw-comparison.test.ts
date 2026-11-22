// Migrated from tools/tests/draw-comparison.test.mjs (node:test + transpile-to-data: URL).
import { describe, expect, it } from 'vitest';
import { drawComparison, singleCardDrawChance } from './draw-comparison';

describe('singleCardDrawChance', () => {
  it('agrees with exhaustive combinations of small decks', () => {
    for (let size = 1; size <= 9; size++) for (let hand = 0; hand <= size; hand++) {
      let total = 0;
      let containing = 0;
      for (let bits = 0; bits < 2 ** size; bits++) if (bits.toString(2).replaceAll('0', '').length === hand) {
        total++;
        if (bits & 1) containing++;
      }
      expect(singleCardDrawChance(size, hand)).toBe(containing / total);
    }
  });

  it('keeps dilution, removal and increased hand size distinct, with explicit assumptions', () => {
    expect(singleCardDrawChance(11, 4)).toBeLessThan(singleCardDrawChance(10, 4));
    expect(singleCardDrawChance(11, 5)).toBeGreaterThan(singleCardDrawChance(10, 4));
    expect(singleCardDrawChance(3, 7)).toBe(1);
    expect(singleCardDrawChance(0, 4)).toBe(0);
    expect(singleCardDrawChance(0.5, 4)).toBe(0);
    expect(singleCardDrawChance(5, -1)).toBe(0);
    expect(drawComparison(10, 11, 4, 4)).toMatch(/40.0% > 36.4%/);
    expect(drawComparison(10, 9, 4, 4)).toMatch(/Protected opening draws/);
    expect(drawComparison(10, 10, 4, 4)).toMatch(/removed card has 0%/);
  });
});
