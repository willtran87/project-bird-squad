import { describe, expect, it } from 'vitest';
import { cleanseFlockDebuffs, incomingHit, projectEnemyPhase } from './enemy-damage';
import { BASE_HAND_TARGET, flockHandTarget } from './hand-size';
import { spendMoltPower } from './molt-power';

type Flock = Parameters<typeof incomingHit>[2];
type Enemy = Parameters<typeof incomingHit>[1];

const flock = (patch: Partial<Flock> = {}): Flock => ({
  hp: 30, maxHp: 30, block: 0, exposed: false, openSkyGuard: 0, openSkyReduction: 0, weak: 0, frail: 0, fouled: 0, ...patch,
});
const foe = (patch: Partial<Enemy> = {}): Enemy => ({
  id: 'e', hp: 20, maxHp: 20, block: 0, weak: 0, nextAttackBonus: 0, damageBonus: 0, ...patch,
});
const mods = { enemyDamageBonus: 0, openSkyBonus: 1 };

describe('cleanseFlockDebuffs', () => {
  it('reduces each debuff by the amount, floors at 0 and returns stacks cleared', () => {
    const target = { weak: 3, frail: 1, fouled: 0 };
    expect(cleanseFlockDebuffs(target, 2)).toBe(3);
    expect(target).toEqual({ weak: 1, frail: 0, fouled: 0 });
  });
});

describe('incomingHit', () => {
  it('adds every flat attack bonus', () => {
    const hit = incomingHit(5, foe({ nextAttackBonus: 2, damageBonus: 1 }), flock(), { ...mods, enemyDamageBonus: 1 }, 0);
    expect(hit.damage).toBe(9);
  });

  it('Winded enemies deal 75%, rounded down, before Open Sky', () => {
    expect(incomingHit(10, foe({ weak: 1 }), flock(), mods, 0).damage).toBe(7);
    expect(incomingHit(10, foe({ weak: 1 }), flock({ exposed: true }), mods, 0).damage).toBe(8);
  });

  it('Open Sky adds its bonus unless Guard absorbs it', () => {
    expect(incomingHit(4, foe(), flock({ exposed: true }), { ...mods, openSkyBonus: 2 }, 0)).toMatchObject({ damage: 6, skyBonus: 2, guardUsed: false });
    expect(incomingHit(4, foe(), flock({ exposed: true, openSkyGuard: 1 }), { ...mods, openSkyBonus: 2 }, 0)).toMatchObject({ damage: 4, skyBonus: 0, guardUsed: true });
    expect(incomingHit(4, foe(), flock({ exposed: false }), { ...mods, openSkyBonus: 2 }, 0).skyBonus).toBe(0);
  });

  it('reduction and first-sky protection shrink the bonus but never below zero', () => {
    const hit = incomingHit(4, foe(), flock({ exposed: true, openSkyReduction: 1 }), { ...mods, openSkyBonus: 2 }, 5);
    expect(hit).toMatchObject({ reductionUsed: 1, firstSkyTriggered: true, skyBonus: 0, damage: 4 });
  });
});

describe('projectEnemyPhase', () => {
  const project = (effects: string[], flockPatch: Partial<Flock> = {}, enemies = [foe()]) => projectEnemyPhase({
    flock: flock(flockPatch), enemies, mods, move: () => ({ effects }), condition: () => true, firstSkyReduction: 0, firstSkyEffects: [],
  });

  it('applies Cover before Cohesion and never mutates its inputs', () => {
    const input = flock({ block: 3 });
    const result = projectEnemyPhase({ flock: input, enemies: [foe()], mods, move: () => ({ effects: ['damage(flock, 5)'] }), condition: () => true, firstSkyReduction: 0, firstSkyEffects: [] });
    expect(result).toMatchObject({ total: 5, blocked: 3, hpLoss: 2, afterHp: 28, attackers: 1 });
    expect(input.block).toBe(3);
  });

  it('carries a nextAttackBonus into the following hit only', () => {
    expect(project(['nextAttackBonus(self, 2)', 'damage(flock, 3)', 'damage(flock, 3)']).total).toBe(8);
  });

  it('flags rules it cannot project instead of guessing', () => {
    expect(project(['mysteryVerb(3)']).uncertainty).toContain('Unprojected enemy rule');
    expect(project(['not parseable']).uncertainty).toContain('Unprojected enemy rule');
  });

  it('skips dead enemies and honours onlyEnemyId', () => {
    const enemies = [foe({ id: 'a', hp: 0 }), foe({ id: 'b' }), foe({ id: 'c' })];
    expect(project(['damage(flock, 2)'], {}, enemies).attackers).toBe(2);
    const only = projectEnemyPhase({
      flock: flock(), enemies, mods, move: () => ({ effects: ['damage(flock, 2)'] }), condition: () => true,
      firstSkyReduction: 0, firstSkyEffects: [], onlyEnemyId: 'c',
    });
    expect(only.attacks.map((attack) => attack.enemyId)).toEqual(['c']);
  });

  it('stops resolving once the flock falls', () => {
    const result = project(['damage(flock, 50)', 'damage(flock, 50)'], { hp: 10 });
    expect(result.afterHp).toBe(0);
    expect(result.total).toBe(50);
  });
});

describe('hand size and Molt power', () => {
  it('flockHandTarget adds bonuses, the Plumes keystone (except for the Spark-Caller), and floors at zero', () => {
    expect(flockHandTarget(0, false, undefined)).toBe(BASE_HAND_TARGET);
    expect(flockHandTarget(1, true, 'talon', 2)).toBe(BASE_HAND_TARGET + 4);
    expect(flockHandTarget(0, true, 'spark_caller')).toBe(BASE_HAND_TARGET);
    expect(flockHandTarget(-99, false, undefined)).toBe(0);
  });

  it('spendMoltPower spends everything once, halving (rounded up) for area effects', () => {
    const state = { moltPower: 5, moltApplied: 0 };
    const spent: number[] = [];
    expect(spendMoltPower(state, 3, true, (amount) => spent.push(amount))).toBe(3);
    expect(state).toEqual({ moltPower: 0, moltApplied: 3 });
    expect(spendMoltPower(state, 3)).toBe(0);
    expect(spent).toEqual([3]);
    expect(spendMoltPower({ moltPower: 4, moltApplied: 0 }, 2)).toBe(4);
  });

  it('spendMoltPower ignores non-positive effects and invalid power', () => {
    const state = { moltPower: 4, moltApplied: 0 };
    expect(spendMoltPower(state, 0)).toBe(0);
    expect(spendMoltPower(state, Number.NaN)).toBe(0);
    expect(state.moltPower).toBe(4);
    expect(spendMoltPower({ moltPower: Number.POSITIVE_INFINITY, moltApplied: 0 }, 3)).toBe(0);
  });
});
