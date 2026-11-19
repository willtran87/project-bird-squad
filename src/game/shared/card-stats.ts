import { BASE_HAND_TARGET } from '../hand-size';
import type { Card, TargetType } from './runtime-types';
import { BASE_COHESION, BASE_MOLT_POWER, BASE_RESONANCE_CAP, BASE_WINGBEATS } from './gameplay-constants';
import { activeCardContract, displayName } from './card-presentation';

export function getInspectedEntry(cards: Array<{ card: Card; zone: string }>, inspectedCardId: string | undefined) {
  return cards.find(({ card }) => card.id === inspectedCardId) ?? cards[0];
}


export function inspectedCardPayload(entry: { card: Card; zone: string } | undefined, costOverride?: number, molting = false) {
  if (!entry) return undefined;
  const contract = activeCardContract(entry.card, molting);
  return {
    id: entry.card.id,
    name: displayName(entry.card),
    bird: entry.card.bird,
    zone: entry.zone,
    cost: costOverride ?? entry.card.cost,
    type: entry.card.type,
    target: entry.card.target,
    activeTarget: contract.target,
    activeRole: contract.role,
    activeText: contract.text,
    usesMolt: contract.usesMolt,
    baseText: entry.card.text,
    upgradedText: entry.card.upgradedText,
    flockStats: Object.entries(entry.card.runtime.flockStats).map(([key, value]) => ({
      label: flockStatLabel(key),
      value
    }))
  };
}


export function targetLabel(target: TargetType) {
  if (target === 'allEnemies') return 'All Enemies';
  if (target === 'self') return 'Flock';
  if (target === 'none') return 'No Target';
  if (target === 'choice') return 'Choice';
  return 'Enemy';
}


export function flockStatLabel(key: string) {
  if (key === 'cohesion') return 'Cohesion';
  if (key === 'damage') return 'Damage';
  if (key === 'cover') return 'Cover';
  if (key === 'regen') return 'Regen';
  if (key === 'draw') return 'Hand Target';
  if (key === 'resonance') return 'Start Resonance';
  if (key === 'moltPower') return 'Molt Power';
  if (key === 'openSkyGuard') return 'Open Sky Guard';
  return key;
}


export function cardStatRows(card: Card) {
  return cardStatEntries(card).map(({ key, value }) => `${flockStatLabel(key)} +${value}`);
}


export function cardStatTotalRows(card: Card) {
  const totals = cardStatEntries(card).reduce<Record<string, number>>((result, { key, value }) => {
    result[key] = (result[key] ?? 0) + value;
    return result;
  }, {});
  return Object.entries(totals).map(([key, value]) => `${flockStatLabel(key)} +${value}`);
}


export function cardStatEntries(card: Card) {
  const rows = Object.entries(card.runtime.flockStats).map(([key, value]) => ({ key, value }));
  if (card.upgraded) {
    rows.push(...Object.entries(card.runtime.upgrade.flockStats).map(([key, value]) => ({ key, value })));
  }
  return rows;
}


interface FlockStatRow { label: string; base: number; bonus: number; total: number; }


// Flock Stats rows from a set of cards. Shared by the in-battle Flock Stats
// overlay and the route-map Flock view so both read identically.
export function buildFlockStatRows(cards: Card[], maxHp: number, energyBonus = 0, openSkyGuardCurrent?: number): FlockStatRow[] {
  const stats = aggregateFlockStats(cards);
  return [
    { label: 'Cohesion', base: BASE_COHESION, bonus: stats.cohesion ?? 0, total: maxHp },
    { label: 'Wingbeats', base: BASE_WINGBEATS, bonus: energyBonus, total: BASE_WINGBEATS + energyBonus },
    { label: 'Hand Target', base: BASE_HAND_TARGET, bonus: stats.draw ?? 0, total: BASE_HAND_TARGET + (stats.draw ?? 0) },
    { label: 'Resonance Cap', base: BASE_RESONANCE_CAP, bonus: 0, total: BASE_RESONANCE_CAP },
    { label: 'Damage', base: 0, bonus: stats.damage ?? 0, total: stats.damage ?? 0 },
    { label: 'Cover', base: 0, bonus: stats.cover ?? 0, total: stats.cover ?? 0 },
    { label: 'Regen', base: 0, bonus: stats.regen ?? 0, total: stats.regen ?? 0 },
    { label: 'Start Resonance', base: 0, bonus: stats.resonance ?? 0, total: stats.resonance ?? 0 },
    { label: 'Molt Power', base: BASE_MOLT_POWER, bonus: stats.moltPower ?? 0, total: BASE_MOLT_POWER + (stats.moltPower ?? 0) },
    { label: 'Open Sky Guard', base: 0, bonus: stats.openSkyGuard ?? 0, total: openSkyGuardCurrent ?? stats.openSkyGuard ?? 0 },
  ];
}


export function aggregateFlockStats(cards: Card[]) {
  const stats: Record<string, number> = {};
  for (const card of cards) {
    for (const [key, value] of Object.entries(card.runtime.flockStats)) {
      stats[key] = (stats[key] ?? 0) + value;
    }
    if (card.upgraded) {
      for (const [key, value] of Object.entries(card.runtime.upgrade.flockStats)) {
        stats[key] = (stats[key] ?? 0) + value;
      }
    }
  }
  return stats;
}
