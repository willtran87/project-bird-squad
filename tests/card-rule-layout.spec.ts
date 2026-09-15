import { test, expect } from '@playwright/test';
import { formatCardRuleGroups } from '../src/game/battle/card-rule-layout';

const plain = (source: string) => formatCardRuleGroups(source).replace(/\u00a0/g, ' ');

test('card rule groups separate conditional bonuses from unconditional effects', () => {
  expect(formatCardRuleGroups('If played plumes: Gain 1 Resonance.'))
    .toBe('If played plumes:\n›\u00a0Gain 1\u00a0Resonance.');
  expect(plain('If Resonance: Deal 2. Deal 2. Gain 1 Resonance.'))
    .toBe('If Resonance:\n› Deal 2.\nDeal 2.\nGain 1 Resonance.');
  expect(plain('Deal 3. If target Winded: Draw 1. Apply 1 Winded.'))
    .toBe('Deal 3.\nIf target Winded:\n› Draw 1.\nApply 1 Winded.');
});

test('only adjacent stable predicates share a header without reordering effects', () => {
  expect(plain('If played plumes: Draw 1. If played plumes: Gain 1 Resonance.'))
    .toBe('If played plumes:\n› Draw 1.\n› Gain 1 Resonance.');
  expect(plain('If first played: Draw 1. If first played: Gain 1 Wingbeat.'))
    .toBe('If first played:\n› Draw 1.\n› Gain 1 Wingbeat.');
  expect(plain('If played plumes: Draw 1. Heal 2. If played plumes: Gain 1 Resonance.'))
    .toBe('If played plumes:\n› Draw 1.\nHeal 2.\nIf played plumes:\n› Gain 1 Resonance.');
  expect(plain('If Resonance: Spend 1 Resonance. If Resonance: Deal 2.'))
    .toBe('If Resonance:\n› Spend 1 Resonance.\nIf Resonance:\n› Deal 2.');
  expect(plain('If target below half: Deal 3. If target below half: Draw 1.'))
    .toBe('If target below half:\n› Deal 3.\nIf target below half:\n› Draw 1.');
});
