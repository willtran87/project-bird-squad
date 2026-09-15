import { test, expect } from '@playwright/test';
import { projectEnemyPhase } from '../src/game/enemy-damage';

test('projected healing preserves nested trigger order and consumes copied latches only', () => {
  const flock = { hp: 49, maxHp: 50, block: 0, exposed: false, openSkyGuard: 0,
    openSkyReduction: 0, weak: 2, frail: 1, fouled: 3 };
  const healing = { overflowAvailable: true, markEffects: [['heal(2)'], ['gainCover(3)', 'cleanseFlock(1)']] };
  const before = JSON.stringify({ flock, healing });
  let projected: typeof flock | undefined;
  const run = () => projectEnemyPhase({
    flock, enemies: [{ id: 'a', hp: 10, maxHp: 10, block: 0, weak: 0, nextAttackBonus: 0, damageBonus: 0 }],
    mods: { enemyDamageBonus: 0, openSkyBonus: 1 },
    move: () => ({ effects: ['damage(flock, 3)'] }), condition: () => false,
    firstSkyReduction: 0, firstSkyEffects: [], healing,
    prepare: (copy, _enemies, _uncertainty, heal) => { projected = copy; heal(3); heal(3); },
  });
  const result = run();
  // Nested overheal uses the one shelter before the original heal returns.
  // The second full-health heal neither refires marks nor adds more shelter.
  expect(result).toMatchObject({ blocked: 3, afterHp: 50, hpLoss: 0, uncertainty: [] });
  expect(projected).toMatchObject({ block: 2, weak: 1, frail: 0, fouled: 2 });
  expect(JSON.stringify({ flock, healing })).toBe(before);
  expect(run()).toEqual(result);
});

test('unsupported healing hooks remain explicitly uncertain', () => {
  const result = projectEnemyPhase({
    flock: { hp: 4, maxHp: 10, block: 0, exposed: false, openSkyGuard: 0,
      openSkyReduction: 0, weak: 0, frail: 0, fouled: 0 }, enemies: [],
    mods: { enemyDamageBonus: 0, openSkyBonus: 1 }, move: () => ({ effects: [] }), condition: () => false,
    firstSkyReduction: 0, firstSkyEffects: [],
    healing: { overflowAvailable: false, markEffects: [['unimplementedEffect(1)']] },
    prepare: (_flock, _enemies, _uncertainty, heal) => heal(2),
  });
  expect(result.afterHp).toBe(6);
  expect(result.uncertainty).toContain('Unprojected Waymark rule');
});
