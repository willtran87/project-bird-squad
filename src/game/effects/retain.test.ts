import { describe, expect, it } from 'vitest';
import {
  RETAIN_PRIORITY_RULE,
  retainInputHint,
  retainPriorityItems,
  retainedInOriginalOrder,
  roostRetainTriggerMatches,
} from './retain';

const hand = ['a', 'b', 'c', 'd', 'e'].map((instanceId) => ({ instanceId }));
const ids = (items: Array<{ instanceId: string }>) => items.map((item) => item.instanceId);

describe('retainPriorityItems', () => {
  it('keeps the rightmost cards when nothing is selected', () => {
    expect(ids(retainPriorityItems(hand, 2))).toEqual(['e', 'd']);
  });

  it('keeps the selected card first, then fills from the right without duplicates', () => {
    expect(ids(retainPriorityItems(hand, 3, 'b'))).toEqual(['b', 'e', 'd']);
    expect(ids(retainPriorityItems(hand, 2, 'e'))).toEqual(['e', 'd']);
  });

  it('ignores an unknown priority id', () => {
    expect(ids(retainPriorityItems(hand, 1, 'zz'))).toEqual(['e']);
  });

  it('clamps the amount to [0, hand size]', () => {
    expect(retainPriorityItems(hand, 0)).toEqual([]);
    expect(retainPriorityItems(hand, -3, 'a')).toEqual([]);
    expect(ids(retainPriorityItems(hand, 99))).toHaveLength(hand.length);
    expect(retainPriorityItems([], 3)).toEqual([]);
  });

  it('documents the priority rule it implements', () => {
    expect(RETAIN_PRIORITY_RULE).toMatch(/Selected card first/);
  });
});

describe('retainedInOriginalOrder', () => {
  it('returns the same set as the priority pick, in hand order', () => {
    expect(ids(retainedInOriginalOrder(hand, 3, 'b'))).toEqual(['b', 'd', 'e']);
    expect(ids(retainedInOriginalOrder(hand, 0, 'b'))).toEqual([]);
  });
});

describe('roostRetainTriggerMatches', () => {
  it('onRoostWithWingbeat needs unspent Wingbeat', () => {
    expect(roostRetainTriggerMatches('onRoostWithWingbeat', 0, 1, 0, 3)).toBe(true);
    expect(roostRetainTriggerMatches('onRoostWithWingbeat', 5, 0, 0, 3)).toBe(false);
  });

  it('onRoostWithCardsInHand needs at least one held card', () => {
    expect(roostRetainTriggerMatches('onRoostWithCardsInHand', 1, 0, 0, 3)).toBe(true);
    expect(roostRetainTriggerMatches('onRoostWithCardsInHand', 0, 3, 0, 3)).toBe(false);
  });

  it('onTurnEndNoOverextension needs 1..threshold-1 cards played', () => {
    expect(roostRetainTriggerMatches('onTurnEndNoOverextension', 0, 0, 0, 3)).toBe(false);
    expect(roostRetainTriggerMatches('onTurnEndNoOverextension', 0, 0, 1, 3)).toBe(true);
    expect(roostRetainTriggerMatches('onTurnEndNoOverextension', 0, 0, 2, 3)).toBe(true);
    expect(roostRetainTriggerMatches('onTurnEndNoOverextension', 0, 0, 3, 3)).toBe(false);
  });

  it('onLowCardTurn(n) needs 1..n cards played', () => {
    expect(roostRetainTriggerMatches('onLowCardTurn(2)', 0, 0, 0, 9)).toBe(false);
    expect(roostRetainTriggerMatches('onLowCardTurn(2)', 0, 0, 1, 9)).toBe(true);
    expect(roostRetainTriggerMatches('onLowCardTurn(2)', 0, 0, 2, 9)).toBe(true);
    expect(roostRetainTriggerMatches('onLowCardTurn(2)', 0, 0, 3, 9)).toBe(false);
    expect(roostRetainTriggerMatches('onLowCardTurn(x)', 0, 0, 1, 9)).toBe(false);
  });

  it('rejects unknown triggers', () => {
    expect(roostRetainTriggerMatches('onSomethingElse', 9, 9, 1, 9)).toBe(false);
  });
});

describe('retainInputHint', () => {
  it('summarises up to two names and counts the rest', () => {
    expect(retainInputHint(1, ['Kestrel'], 'R')).toBe('RETAIN 1: KESTREL   |   SELECT CARD = KEEP FIRST   |   R  ROOST');
    expect(retainInputHint(4, ['a', 'b', 'c', 'd'], 'Space')).toMatch(/^RETAIN 4: A \+ B \+ 2 MORE /);
  });
});
