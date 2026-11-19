import { describe, expect, it } from 'vitest';
import { selectPatternMoveId, weightedMoveId } from './enemy-pattern';
import type { AttackPattern } from './types';

const walk = (pattern: AttackPattern, beats: number, evaluate?: (condition: string, beat: number) => boolean) =>
  Array.from({ length: beats }, (_, beat) => selectPatternMoveId(pattern, beat, evaluate && ((c) => evaluate(c, beat))));

describe('selectPatternMoveId', () => {
  it('walks cycles and scripted loops by intentIndex', () => {
    expect(walk({ type: 'cycle', moveIds: ['a', 'b', 'c'] }, 5)).toEqual(['a', 'b', 'c', 'a', 'b']);
    expect(walk({ type: 'scripted', moveIds: ['a', 'b', 'c'], loopFrom: 1 }, 6)).toEqual(['a', 'b', 'c', 'b', 'c', 'b']);
    expect(walk({ type: 'scripted', moveIds: ['a', 'b'] }, 4)).toEqual(['a', 'b', 'a', 'b']);
  });

  it('keeps the plain weighted expansion when no entry has a repeat rule', () => {
    const pattern: AttackPattern = { type: 'weighted', entries: [{ moveId: 'a', weight: 2 }, { moveId: 'b' }] };
    expect(walk(pattern, 6)).toEqual(['a', 'a', 'b', 'a', 'a', 'b']);
  });

  it('honours cannotRepeat on weighted entries', () => {
    const pattern: AttackPattern = { type: 'weighted', entries: [{ moveId: 'a', weight: 2, repeat: 'cannotRepeat' }, { moveId: 'b' }] };
    const beats = walk(pattern, 12);
    beats.slice(1).forEach((move, i) => {
      if (move === 'a') expect(beats[i]).not.toBe('a');
    });
    expect(beats).toContain('a');
    expect(beats).toContain('b');
  });

  it('relaxes cannotRepeat only when nothing else can be shown', () => {
    expect(weightedMoveId([{ moveId: 'solo', repeat: 'cannotRepeat' }], 3)).toBe('solo');
  });

  it('honours oncePerCombat on weighted entries', () => {
    const pattern: AttackPattern = {
      type: 'weighted',
      entries: [{ moveId: 'finisher', weight: 3, repeat: 'oncePerCombat' }, { moveId: 'peck' }, { moveId: 'brace' }],
    };
    const beats = walk(pattern, 15);
    expect(beats.filter((move) => move === 'finisher')).toHaveLength(1);
    expect(beats[0]).toBe('finisher');
    expect(new Set(beats.slice(1))).toEqual(new Set(['peck', 'brace']));
  });

  it('is deterministic in intentIndex so the Tell matches execution', () => {
    const pattern: AttackPattern = {
      type: 'weighted',
      entries: [{ moveId: 'a', weight: 2, repeat: 'cannotRepeat' }, { moveId: 'b', repeat: 'oncePerCombat' }, { moveId: 'c' }],
    };
    expect(walk(pattern, 10)).toEqual(walk(pattern, 10));
    for (let beat = 0; beat < 10; beat += 1) expect(selectPatternMoveId(pattern, beat)).toBe(walk(pattern, 10)[beat]);
  });

  it('uses a single-move conditional fallback', () => {
    const pattern: AttackPattern = { type: 'conditional', entries: [{ moveId: 'punish', if: 'flockHasNoCover' }], fallback: 'wait' };
    expect(selectPatternMoveId(pattern, 0, () => true)).toBe('punish');
    expect(selectPatternMoveId(pattern, 4, () => false)).toBe('wait');
    expect(selectPatternMoveId(pattern, 4)).toBe('wait');
  });

  it('walks a cycling conditional fallback by intentIndex', () => {
    const pattern: AttackPattern = {
      type: 'conditional',
      entries: [{ moveId: 'punish', if: 'flockOpenSky' }],
      fallback: { type: 'cycle', moveIds: ['strike', 'brace', 'wait'] },
    };
    expect(walk(pattern, 6)).toEqual(['strike', 'brace', 'wait', 'strike', 'brace', 'wait']);
    expect(walk(pattern, 4, (_, beat) => beat === 2)).toEqual(['strike', 'brace', 'punish', 'strike']);
  });

  it('returns undefined for empty patterns so callers can fall back', () => {
    expect(selectPatternMoveId({ type: 'cycle', moveIds: [] }, 2)).toBeUndefined();
    expect(selectPatternMoveId({ type: 'weighted', entries: [] }, 2)).toBeUndefined();
  });
});
