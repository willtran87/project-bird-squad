import type { EnemyMove } from './types';
import { parseEffect } from './effects/effect-parser';
import type { Flock, FlockState } from './shared/runtime-types';

const SCATTER_HP_RATIO = 0.34;

/** How hard a hit lands, 0-1, by its share of the target's maximum: nothing
 * at 4% or less, full at 30%. A 20% hit (weight ~0.6) is heavy. */
export function hitWeight(damage: number, maxHp: number) {
  return damage > 0 ? Math.min(1, Math.max(0, (damage / Math.max(1, maxHp) - 0.04) / 0.26)) : 0;
}

export function flockStateOf(flock: Flock): FlockState {
  if (flock.flow >= flock.flowMax) return 'surging';
  if (flock.hp < flock.maxHp * SCATTER_HP_RATIO) return 'scattered';
  return 'holding';
}


export function cardDamageOutcome(
  amount: number,
  flock: Pick<Flock, 'weak' | 'hp' | 'maxHp' | 'flow' | 'flowMax'>,
  enemyCover: number,
  pierceCover: boolean,
  flockDamageBonus: number,
  firstAttackKeystone: boolean
) {
  let rawDamage = amount + flockDamageBonus;
  if (flock.weak > 0) rawDamage = Math.floor(rawDamage * 0.75);
  const formation = flockStateOf(flock as Flock);
  if (formation === 'surging') rawDamage += SURGE_STAT_BONUS;
  else if (formation === 'scattered') rawDamage = Math.max(0, Math.floor(rawDamage * 0.75));
  if (firstAttackKeystone) rawDamage += 2;
  const blocked = pierceCover ? 0 : Math.min(enemyCover, rawDamage);
  return { rawDamage, blocked, hpDamage: rawDamage - blocked };
}


export function cardCoverOutcome(
  amount: number,
  flock: Pick<Flock, 'frail' | 'hp' | 'maxHp' | 'flow' | 'flowMax'>,
  flockCoverBonus: number,
  nestBonus: number
) {
  let cover = amount + flockCoverBonus + nestBonus;
  const formation = flockStateOf(flock as Flock);
  if (formation === 'surging') cover += SURGE_STAT_BONUS;
  else if (formation === 'scattered') cover = Math.floor(cover * 0.75);
  if (flock.frail > 0) cover = Math.max(0, Math.floor(cover * 0.75));
  return cover;
}

export const SURGE_STAT_BONUS = 1;


export function intentCoverValue(intent: { effects: string[] }) {
  for (const effect of intent.effects) {
    const parsed = parseEffect(effect);
    if (parsed && parsed.name === 'gainCover') return Number(parsed.args[0]) || 0;
  }
  return 0;
}


export function moveDealsDamage(move: EnemyMove): boolean {
  return move.effects.some((effect) => /(?:^|then )damage\(flock/.test(effect));
}
