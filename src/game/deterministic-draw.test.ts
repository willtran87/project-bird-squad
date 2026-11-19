import { describe, expect, it } from 'vitest';
import {
  deterministicChance,
  deterministicRankedIds,
  finiteInt,
  prepareOpeningDraw,
  rarityStep,
  seededRng,
  stringArray,
  type OpeningDrawCard,
} from './deterministic-draw';

const card = (id: string, patch: Partial<OpeningDrawCard> & { kind?: string } = {}): OpeningDrawCard => ({
  id,
  cost: patch.cost ?? 1,
  target: patch.target ?? 'enemy',
  runtime: { kind: patch.kind ?? 'arcana' },
});

describe('seededRng', () => {
  it('replays the same sequence for the same key and differs across keys', () => {
    const a = seededRng('run-1');
    const b = seededRng('run-1');
    const c = seededRng('run-2');
    const seqA = Array.from({ length: 20 }, a);
    expect(Array.from({ length: 20 }, b)).toEqual(seqA);
    expect(Array.from({ length: 20 }, c)).not.toEqual(seqA);
  });

  it('stays within [0, 1)', () => {
    const random = seededRng('bounds');
    for (let i = 0; i < 2000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('deterministicChance', () => {
  it('short-circuits the 0 and 1 boundaries', () => {
    expect(deterministicChance('x', 0)).toBe(false);
    expect(deterministicChance('x', -1)).toBe(false);
    expect(deterministicChance('x', 1)).toBe(true);
    expect(deterministicChance('x', 2)).toBe(true);
  });

  it('is a pure function of key and chance, and monotonic in chance', () => {
    for (const key of ['a', 'b', 'route:3:n4', 'm1_boss']) {
      expect(deterministicChance(key, 0.5)).toBe(deterministicChance(key, 0.5));
      if (deterministicChance(key, 0.3)) expect(deterministicChance(key, 0.7)).toBe(true);
    }
  });

  it('roughly honours the requested rate over runtime-shaped keys', () => {
    // Runtime keys look like `${seed}:${nodeId}:route-mark`. Note: keys that
    // differ only in their final characters (e.g. `key-${i}`) skew low (~19%
    // for 25%) because FNV-1a has no final avalanche step; the fixed suffix the
    // runtime appends mixes the varying part enough to remove that skew.
    const keys = Array.from({ length: 4000 }, (_, i) => `seed-${Math.floor(i / 10) * 7919}:m1_n${i % 10}:route-mark`);
    const rate = keys.filter((key) => deterministicChance(key, 0.25)).length / keys.length;
    expect(rate).toBeGreaterThan(0.22);
    expect(rate).toBeLessThan(0.28);
  });
});

describe('deterministicRankedIds', () => {
  it('dedupes and returns a stable seed-dependent permutation', () => {
    const ids = ['c', 'a', 'b', 'a', 'd', 'e'];
    const ranked = deterministicRankedIds(ids, 'seed');
    expect([...ranked].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(deterministicRankedIds([...ids].reverse(), 'seed')).toEqual(ranked);
    const orders = new Set(['s1', 's2', 's3', 's4', 's5', 's6'].map((key) => deterministicRankedIds(ids, key).join()));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('small helpers', () => {
  it('rarityStep ranks rarities', () => {
    expect([rarityStep('common'), rarityStep('uncommon'), rarityStep('rare'), rarityStep('legendary'), rarityStep('boss'), rarityStep('??')])
      .toEqual([0, 1, 2, 3, 3, 0]);
  });

  it('stringArray keeps only strings', () => {
    expect(stringArray(['a', 1, null, 'b'])).toEqual(['a', 'b']);
    expect(stringArray('a')).toEqual([]);
  });

  it('finiteInt floors, clamps and falls back on non-finite input', () => {
    expect(finiteInt(3.9, 0)).toBe(3);
    expect(finiteInt('3', 7)).toBe(7);
    expect(finiteInt(Infinity, 7)).toBe(7);
    expect(finiteInt(NaN, 7, 0, 5)).toBe(5);
    expect(finiteInt(-4, 0, 0)).toBe(0);
    expect(finiteInt(99, 0, 0, 10)).toBe(10);
  });
});

describe('prepareOpeningDraw', () => {
  const deck = Array.from({ length: 12 }, (_, i) => card(`c${i}`, { cost: i % 4, target: i % 3 === 0 ? 'enemy' : 'self' }));

  it('is deterministic for a seed and does not mutate the input', () => {
    const before = JSON.stringify(deck);
    const a = prepareOpeningDraw(deck, 'seed-a', true, 5);
    const b = prepareOpeningDraw(deck, 'seed-a', true, 5);
    expect(a).toEqual(b);
    expect(JSON.stringify(deck)).toBe(before);
    expect(a.deck.map((entry) => entry.id).sort()).toEqual(deck.map((entry) => entry.id).sort());
    expect(a.state.shuffled).toBe(true);
  });

  it('different seeds produce different orders', () => {
    const orders = new Set(['a', 'b', 'c', 'd', 'e'].map((seed) => prepareOpeningDraw(deck, seed, true, 5).deck.map((entry) => entry.id).join()));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('without shuffling, keeps order when the opening hand already qualifies', () => {
    const ordered = [card('a'), card('b'), card('c'), card('d', { cost: 9 })];
    const result = prepareOpeningDraw(ordered, 'x', false, 3);
    expect(result.deck.map((entry) => entry.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(result.state).toEqual({ shuffled: false, protectionSwaps: 0 });
  });

  it('guarantees two playable cards in hand when the deck has them', () => {
    const cards = [card('x1', { cost: 9 }), card('x2', { cost: 9 }), card('snag', { kind: 'snag', cost: 0 }), card('p1'), card('p2')];
    const result = prepareOpeningDraw(cards, 'x', false, 3);
    const hand = result.deck.slice(0, 3);
    expect(hand.filter((entry) => entry.cost <= 3 && entry.runtime.kind !== 'snag')).toHaveLength(2);
    expect(result.state.protectionSwaps).toBe(2);
  });

  it('guarantees one enemy-targeting playable card when one exists', () => {
    const cards = [card('s1', { target: 'self' }), card('s2', { target: 'self' }), card('s3', { target: 'self' }), card('hit', { target: 'allEnemies' })];
    const result = prepareOpeningDraw(cards, 'x', false, 3);
    expect(result.deck.slice(0, 3).map((entry) => entry.id)).toContain('hit');
    expect(result.state.protectionSwaps).toBe(1);
  });

  it('respects the energy budget when deciding playability', () => {
    const cards = [card('big', { cost: 3 }), card('big2', { cost: 3 }), card('small', { cost: 1 }), card('small2', { cost: 1 })];
    const result = prepareOpeningDraw(cards, 'x', false, 2, 1);
    expect(result.deck.slice(0, 2).map((entry) => entry.id).sort()).toEqual(['small', 'small2']);
  });

  it('handles hands larger than the deck and empty decks', () => {
    expect(prepareOpeningDraw([card('only')], 's', true, 5).deck).toHaveLength(1);
    expect(prepareOpeningDraw([], 's', true, 5)).toEqual({ deck: [], state: { shuffled: true, protectionSwaps: 0 } });
  });
});
