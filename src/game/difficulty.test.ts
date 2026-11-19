import { describe, expect, it } from 'vitest';
import {
  MAX_DIFFICULTY,
  advanceAscensionEnemyIntent,
  applyAscensionOpeningIntents,
  difficultyAdds,
  difficultyLabel,
  difficultyMods,
  difficultyStatSummary,
  difficultyTiers,
} from './difficulty';
import type { AttackPattern } from './types';

const tiers = Array.from({ length: MAX_DIFFICULTY + 1 }, (_, tier) => tier);
const cycle = (length: number): AttackPattern => ({ type: 'cycle', moveIds: Array.from({ length }, (_, i) => `m${i}`) });
const foe = (id: string, attackPattern: AttackPattern, intentIndex = 0) => ({ id, intentIndex, runtime: { attackPattern } });

describe('difficultyMods', () => {
  it('clamps and floors the requested tier', () => {
    expect(difficultyMods(undefined).tier).toBe(0);
    expect(difficultyMods(-3).tier).toBe(0);
    expect(difficultyMods(2.9).tier).toBe(2);
    expect(difficultyMods(MAX_DIFFICULTY + 10)).toEqual(difficultyMods(MAX_DIFFICULTY));
  });

  it('tier 0 is the unmodified baseline', () => {
    const base = difficultyMods(0);
    expect(base.enemyHpMult).toBe(1);
    expect(base.enemyDamageBonus).toBe(0);
    expect(base.shiftedOpeners).toBe(false);
    expect(base.restlessPatterns).toBe(false);
  });

  it('modifiers are cumulative: no tier is ever easier than the one below', () => {
    for (const tier of tiers.slice(1)) {
      const lower = difficultyMods(tier - 1);
      const upper = difficultyMods(tier);
      expect(upper.enemyHpMult).toBeGreaterThanOrEqual(lower.enemyHpMult);
      expect(upper.rewardChoices).toBeLessThanOrEqual(lower.rewardChoices);
      expect(upper.enemyDamageBonus).toBeGreaterThanOrEqual(lower.enemyDamageBonus);
      expect(upper.openSkyBonus).toBeGreaterThanOrEqual(lower.openSkyBonus);
      if (lower.shiftedOpeners) expect(upper.shiftedOpeners).toBe(true);
      if (lower.restlessPatterns) expect(upper.restlessPatterns).toBe(true);
      // Each tier adds at least one modifier over the one below it.
      expect({ ...upper, tier: 0 }).not.toEqual({ ...lower, tier: 0 });
    }
  });

  it('restless patterns imply shifted openers', () => {
    for (const tier of tiers) {
      const mods = difficultyMods(tier);
      if (mods.restlessPatterns) expect(mods.shiftedOpeners).toBe(true);
    }
  });
});

describe('tier labels', () => {
  it('describes every tier exactly once', () => {
    expect(difficultyTiers.map((entry) => entry.tier)).toEqual(tiers);
    for (const tier of tiers) {
      expect(difficultyLabel(tier)).toBe(difficultyTiers[tier].name);
      expect(difficultyAdds(tier).length).toBeGreaterThan(0);
    }
  });

  it('falls back for unknown tiers', () => {
    expect(difficultyLabel(42)).toBe('Tier 42');
    expect(difficultyAdds(42)).toBe('');
  });

  it('summarises the live modifiers', () => {
    for (const tier of tiers) {
      const mods = difficultyMods(tier);
      const summary = difficultyStatSummary(tier);
      expect(summary).toContain(`HP x${mods.enemyHpMult.toFixed(2)}`);
      expect(summary).toContain(`Rewards ${mods.rewardChoices}`);
      expect(summary).toContain(mods.restlessPatterns ? 'Tells reroute' : mods.shiftedOpeners ? 'Tells shifted start' : 'Tells fixed');
    }
  });
});

describe('Ascension opening intents', () => {
  const firstShifted = tiers.find((tier) => difficultyMods(tier).shiftedOpeners)!;

  it('leaves intents alone below the shifted-opener tier', () => {
    for (const tier of tiers.filter((t) => !difficultyMods(t).shiftedOpeners)) {
      const enemies = [foe('a', cycle(4), 2)];
      applyAscensionOpeningIntents(tier, enemies, 'seed', 0, 'n1');
      expect(enemies[0].intentIndex).toBe(2);
    }
  });

  it('starts cyclic foes on a seeded alternate Tell (never the authored first)', () => {
    for (let n = 0; n < 40; n += 1) {
      const enemies = [foe(`enemy-${n}`, cycle(5))];
      applyAscensionOpeningIntents(firstShifted, enemies, `seed-${n}`, 1, 'node');
      expect(enemies[0].intentIndex).toBeGreaterThanOrEqual(1);
      expect(enemies[0].intentIndex).toBeLessThanOrEqual(4);
    }
  });

  it('is deterministic for seed/map/node/enemy', () => {
    const roll = () => {
      const enemies = [foe('x', cycle(6)), foe('y', cycle(6))];
      applyAscensionOpeningIntents(firstShifted, enemies, 'same', 2, 'node-7');
      return enemies.map((enemy) => enemy.intentIndex);
    };
    expect(roll()).toEqual(roll());
  });

  it('resets non-cycle and single-move patterns to the first Tell', () => {
    const weighted: AttackPattern = { type: 'weighted', entries: [] };
    const enemies = [foe('w', weighted, 3), foe('single', cycle(1), 3)];
    applyAscensionOpeningIntents(firstShifted, enemies, 'seed', 0, 'n');
    expect(enemies.map((enemy) => enemy.intentIndex)).toEqual([0, 0]);
  });
});

describe('Ascension intent advance', () => {
  const firstRestless = tiers.find((tier) => difficultyMods(tier).restlessPatterns)!;

  it('advances by one below the restless tier and reports no reroute', () => {
    const enemy = foe('a', cycle(5), 1);
    expect(advanceAscensionEnemyIntent(firstRestless - 1, enemy, 's', 0, 'n', 1)).toBe(false);
    expect(enemy.intentIndex).toBe(2);
  });

  it('skips the authored next step on restless tiers for cycles of 3+', () => {
    for (let turn = 0; turn < 30; turn += 1) {
      const enemy = foe('a', cycle(5), 1);
      expect(advanceAscensionEnemyIntent(firstRestless, enemy, 'seed', 0, 'node', turn)).toBe(true);
      expect(enemy.intentIndex).toBeGreaterThanOrEqual(3);
      expect(enemy.intentIndex).toBeLessThanOrEqual(1 + 2 + (5 - 3));
    }
  });

  it('short cycles advance normally even on restless tiers', () => {
    const enemy = foe('a', cycle(2), 0);
    expect(advanceAscensionEnemyIntent(firstRestless, enemy, 's', 0, 'n', 1)).toBe(false);
    expect(enemy.intentIndex).toBe(1);
  });

  it('is deterministic for the same inputs', () => {
    const a = foe('a', cycle(6), 2);
    const b = foe('a', cycle(6), 2);
    advanceAscensionEnemyIntent(firstRestless, a, 'seed', 1, 'node', 4);
    advanceAscensionEnemyIntent(firstRestless, b, 'seed', 1, 'node', 4);
    expect(a.intentIndex).toBe(b.intentIndex);
  });
});
