import { test, expect } from '@playwright/test';
import { readableHandRules, fitHandRules, wrapHandRules } from '../src/game/battle/hand-rule-summary';

test('hand rules preserve ordered live conditions and explicit targets/spending', () => {
  const source = ['Deal 3.', 'If Resonance: Spend 1 Resonance.', 'If spent Resonance: Deal 2, ignoring Cover.',
    'If Resonance: Deal 2.', 'If no Resonance: Draw 1.', 'If first played: Gain 1 Cover.', 'Deal 2 to all.'];
  const text = readableHandRules(source);
  expect(text.split('\n')).toEqual([
    'Deal 3 damage.', 'If you have Resonance: Spend 1 Resonance.',
    'If this card spent Resonance: Deal 2 damage, ignoring Cover.',
    'If you have Resonance: Deal 2 damage.',
    'If no Resonance remains and none was spent: Draw 1.',
    'First use this fight: Gain 1 Cover.', 'Deal 2 damage to all enemies.',
  ]);
});

test('hand excerpt never drops a condition or silently truncates an effect', () => {
  const source = 'Deal 3 damage.\nGain 2 Cover.\nFirst use this fight: Draw 1.';
  expect(fitHandRules(source, t => t.length < 48)).toEqual({text:'Deal 3 damage.\nGain 2 Cover.\n+1 more · Inspect', omitted:1});
  expect(fitHandRules(source, () => true)).toEqual({text:source, omitted:0});
  expect(fitHandRules('If the previous hit defeated an enemy: Draw 2.', t => t.length < 35))
    .toEqual({text:'Complex effect\nInspect full rules', omitted:1});
});

test('measured wrapping keeps action quantities together without punctuation compression', () => {
  const lines = wrapHandRules('If the target has 2+ Winded: Draw 1.', text => text.length, 18);
  expect(lines.join(' ')).toBe('If the target has 2+ Winded: Draw 1.');
  expect(lines.at(-1)).toContain('Draw 1.');
  expect(lines).not.toContain('1.');
});

test('hand conditions keep the engine threshold and time scope explicit', () => {
  const cases = [
    ['target below half', 'the target is at half health or less'],
    ['low Cohesion', 'the flock is below half Cohesion'],
    ['full Cohesion', 'the flock has full Cohesion'],
    ['target attacks', 'the target intends to attack'],
    ['target Winded', 'the target is Winded'],
    ['target 2+ Winded', 'the target has 2+ Winded'],
    ['3+ Resonance', 'you have 3+ Resonance'],
    ['no Cover', 'the flock has no Cover'],
    ['Open Sky', 'the flock is in Open Sky'],
    ['flockSuit(plumes,3)', 'your flock has 3+ plumes cards'],
    ['played quills', 'you played quills this turn'],
    ['defeats enemy', 'the previous hit defeated an enemy'],
  ];
  for (const [condition, expected] of cases) {
    expect(readableHandRules([`If ${condition}: Draw 1.`]))
      .toBe(`If ${expected}: Draw 1.`);
  }
  expect(readableHandRules(['If Molting: Gain 2 Cover.']))
    .toBe('While in Molt: Gain 2 Cover.');
});
