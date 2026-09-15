import { test, expect } from '@playwright/test';
import { waymarkBuildRead } from '../src/game/waymark-build-read';

test('Waymark advice distinguishes owned rules, conditional potential, density and cost', () => {
  const cards = [
    { cost: 1, runtime: { effects: ['if hasResonance then spendResonance(1)'] } },
    { cost: 2, runtime: { effects: [], moltEffects: ['resonanceBurst(2)'] } },
    { cost: 0, upgraded: true, runtime: { effects: ['spendResonance(1)'], upgrade: { effects: ['draw(1)'] } } },
    { cost: 3, runtime: { effects: ['draw(1)'] } },
  ];
  const result = waymarkBuildRead({ trigger: 'onResonanceSpent', familyLabel: 'Tempo' }, cards, 0, 1);
  expect(result.notes[0]).toContain('2 Resonance spenders may enable it');
  expect(result.notes.join(' ')).toContain('conditional and Molt rules');
  expect(result.notes.join(' ')).toContain('2 of 4 cards');
  expect(result.notes.join(' ')).toContain('1–2 Wingbeats');
  expect(result.tags).toHaveLength(2);
  const noMatch = waymarkBuildRead({ trigger: 'onEnterMolt', familyLabel: 'Tempo' }, cards, 0, 0);
  expect(noMatch.notes.join(' ')).toContain('0 of 4 cards');
  expect(noMatch.notes.join(' ')).not.toContain('Printed cost');
});
