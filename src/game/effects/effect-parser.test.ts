import { describe, expect, it } from 'vitest';
import { parseEffect, parseEffectValue } from './effect-parser';

describe('parseEffect', () => {
  it('splits a verb and trimmed, non-empty arguments', () => {
    expect(parseEffect('damage(target, 6)')).toEqual({ name: 'damage', args: ['target', '6'] });
    expect(parseEffect('enterMolt()')).toEqual({ name: 'enterMolt', args: [] });
    expect(parseEffect('draw( 2 ,  )')).toEqual({ name: 'draw', args: ['2'] });
  });

  it('keeps nested text inside the outer parentheses as raw arguments', () => {
    expect(parseEffect('returnDiscard(attack, 1 perDiscarded)')).toEqual({
      name: 'returnDiscard',
      args: ['attack', '1 perDiscarded'],
    });
  });

  it('rejects text that is not a single verb call', () => {
    for (const text of ['', 'damage', '9damage(1)', 'damage(1) extra', ' damage(1)', 'if x then draw(1)', 'dam-age(1)']) {
      expect(parseEffect(text), text).toBeUndefined();
    }
  });
});

describe('parseEffectValue', () => {
  it('returns 0 for missing and non-numeric values', () => {
    expect(parseEffectValue(undefined, 5)).toBe(0);
    expect(parseEffectValue('', 5)).toBe(0);
    expect(parseEffectValue('flock', 5)).toBe(0);
    expect(parseEffectValue('NaN', 5)).toBe(0);
  });

  it('parses signed integers, stripping a leading plus', () => {
    expect(parseEffectValue('7', 0)).toBe(7);
    expect(parseEffectValue('+3', 0)).toBe(3);
    expect(parseEffectValue('-2', 0)).toBe(-2);
  });

  it('scales per-discarded, per-winded and per-cover values by their own counter', () => {
    expect(parseEffectValue('2 perDiscarded', 3, 5, 7)).toBe(6);
    expect(parseEffectValue('2 perWinded', 3, 5, 7)).toBe(10);
    expect(parseEffectValue('2 perCover', 3, 5, 7)).toBe(14);
    expect(parseEffectValue('2 perWinded', 3)).toBe(0);
    expect(parseEffectValue('2 perCover', 3)).toBe(0);
  });

  it('does not treat malformed scaling text as a scaling rule', () => {
    expect(parseEffectValue('perDiscarded', 4)).toBe(0);
    expect(parseEffectValue('2 perdiscarded', 4)).toBe(0);
  });
});
