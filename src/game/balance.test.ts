import { describe, expect, it } from 'vitest';
import balanceConfig from '../../data/game/balance-config.json';
import {
  compactBossTests,
  distinctMeaningfulUpgradeCards,
  districtCardRewardLeans,
  districtRewardAffinity,
  districtRewardObservations,
  dominantRewardSuit,
  draftComplementaryRewardPair,
  draftStructuredRewardChoices,
  encounterPressureRead,
  getMapBalanceProfile,
  hasMeaningfulCardUpgrade,
  rewardBuildObservations,
  rewardWildcardPool,
  routeDecisionRead,
  weightedPick,
  type RouteDecisionReadInput,
} from './balance';
import { seededRng } from './deterministic-draw';
import type { RuntimeCard } from './types';

interface Entry { id: string; role: string; suit?: string; weight?: number }
const e = (id: string, role: string, suit?: string, weight = 1): Entry => ({ id, role, suit, weight });
const roleOf = (entry: Entry) => entry.role;
const suitOf = (entry: Entry) => entry.suit;

describe('getMapBalanceProfile', () => {
  const maps = balanceConfig.maps as Array<{ mapId: string; index: number }>;

  it('finds each authored profile by id, then by index', () => {
    for (const map of maps) {
      expect(getMapBalanceProfile(map.mapId, -1).index).toBe(map.index);
      expect(getMapBalanceProfile('no-such-map', map.index).mapId).toBe(map.mapId);
    }
  });

  it('falls back to the index-1 profile', () => {
    const first = maps.find((map) => map.index === 1)!;
    expect(getMapBalanceProfile('no-such-map', 999).mapId).toBe(first.mapId);
  });
});

describe('weightedPick', () => {
  it('maps the roll across cumulative weights', () => {
    const weights = { a: 1, b: 3 } as Record<'a' | 'b', number>;
    expect(weightedPick(weights, () => 0)).toBe('a');
    expect(weightedPick(weights, () => 0.24)).toBe('a');
    expect(weightedPick(weights, () => 0.26)).toBe('b');
    expect(weightedPick(weights, () => 0.999)).toBe('b');
  });

  it('ignores zero, negative and non-numeric weights', () => {
    const weights = { a: 0, b: -2, c: Number.NaN, d: 1 } as Record<string, number>;
    for (const roll of [0, 0.5, 0.99]) expect(weightedPick(weights, () => roll)).toBe('d');
  });

  it('uses the fallback, then the first key, when nothing is weighted', () => {
    expect(weightedPick({ a: 0, b: 0 } as Record<string, number>, () => 0.5, 'z')).toBe('z');
    expect(weightedPick({ a: 0, b: 0 } as Record<string, number>, () => 0.5)).toBe('a');
    expect(() => weightedPick({} as Record<string, number>, () => 0.5)).toThrow();
  });

  it('matches the weight distribution under a seeded RNG', () => {
    const random = seededRng('weights');
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i += 1) counts[weightedPick({ a: 1, b: 3 }, random)] += 1;
    expect(counts.b / 4000).toBeGreaterThan(0.7);
    expect(counts.b / 4000).toBeLessThan(0.8);
  });
});

describe('reward pools', () => {
  it('dominantRewardSuit returns the most common suit, ignoring missing suits', () => {
    expect(dominantRewardSuit([e('1', 'a', 'x'), e('2', 'a', 'y'), e('3', 'a', 'y'), e('4', 'a')], suitOf)).toBe('y');
    expect(dominantRewardSuit([e('1', 'a')], suitOf)).toBeUndefined();
  });

  it('rewardWildcardPool prefers new roles, then off-suit entries', () => {
    const chosen = [e('c', 'attack', 'x')];
    const remaining = [e('1', 'attack', 'x'), e('2', 'skill', 'x'), e('3', 'skill', 'y'), e('4', 'attack', 'y')];
    expect(rewardWildcardPool(remaining, chosen, 'x', roleOf, suitOf).map((entry) => entry.id)).toEqual(['3']);
    expect(rewardWildcardPool(remaining, chosen, undefined, roleOf, suitOf).map((entry) => entry.id)).toEqual(['2', '3']);
    expect(rewardWildcardPool([], chosen, 'x', roleOf, suitOf)).toEqual([]);
  });

  it('draftStructuredRewardChoices returns distinct candidates, at most maxChoices, deterministically', () => {
    const candidates = Array.from({ length: 10 }, (_, i) => e(`c${i}`, ['attack', 'skill', 'power'][i % 3], ['x', 'y'][i % 2], 1 + (i % 4)));
    const owned = [e('o1', 'attack', 'x'), e('o2', 'attack', 'x')];
    const draft = (seed: string, max: number) => draftStructuredRewardChoices(
      candidates, owned, max, seededRng(seed), (entry) => entry.weight ?? 1,
      (entry) => entry.role === 'skill', roleOf, suitOf, (entry) => entry.id === 'c9',
    );
    for (const max of [0, 1, 2, 3, 15]) {
      const picks = draft('s', max);
      expect(picks.length).toBe(Math.min(max, candidates.length));
      expect(new Set(picks).size).toBe(picks.length);
      picks.forEach((pick) => expect(candidates).toContain(pick));
    }
    expect(draft('repeat', 3)).toEqual(draft('repeat', 3));
  });

  it('draftStructuredRewardChoices fills the need slot first and prefers district-aligned picks', () => {
    const candidates = [e('need-a', 'skill', 'x'), e('need-district', 'skill', 'y'), e('other', 'attack', 'x')];
    const picks = draftStructuredRewardChoices(candidates, [], 1, () => 0, () => 1,
      (entry) => entry.role === 'skill', roleOf, suitOf, (entry) => entry.id === 'need-district');
    expect(picks.map((entry) => entry.id)).toEqual(['need-district']);
  });

  it('draftComplementaryRewardPair offers the least-owned role first and never repeats', () => {
    const owned = [e('o1', 'attack', 'x'), e('o2', 'attack', 'x'), e('o3', 'skill', 'x')];
    const candidates = [e('a1', 'attack', 'x'), e('s1', 'skill', 'y'), e('p1', 'power', 'y'), e('p2', 'power', 'x')];
    for (const seed of ['a', 'b', 'c', 'd']) {
      const pair = draftComplementaryRewardPair(candidates, owned, seededRng(seed), roleOf, suitOf);
      expect(pair).toHaveLength(2);
      expect(pair[0].role).toBe('power');
      expect(pair[0].id).toBe('p2'); // least-owned role in the dominant suit
      expect(pair[1]).not.toBe(pair[0]);
    }
  });
});

describe('district reward reading', () => {
  const card = (role: string, tags: string[], rarity = 'common') => ({ role, runtime: { rarity, tags } });

  it('keeps only recognised, case-insensitive leans', () => {
    expect(districtCardRewardLeans(['Cover', 'nonsense', 'tempo'])).toEqual(['Cover', 'tempo']);
  });

  it('matches cards against each lean', () => {
    expect(districtRewardAffinity(card('attack', []), ['direct damage', 'cover'])).toEqual(['direct damage']);
    expect(districtRewardAffinity(card('skill', ['retain']), ['tempo'])).toEqual(['tempo']);
    expect(districtRewardAffinity(card('skill', [], 'legendary'), ['rare cards'])).toEqual(['rare cards']);
    expect(districtRewardAffinity(card('skill', ['pierce']), ['boss prep', 'healing'])).toEqual(['boss prep']);
  });

  it('pairs the district read with any caution, else with build notes', () => {
    expect(districtRewardObservations(card('attack', []), ['direct damage'], ['+ a', '! careful'])).toEqual(['+ District lean: direct damage', '! careful']);
    expect(districtRewardObservations(card('skill', []), ['cover'], ['+ a', '+ b', '+ c'])).toEqual(['+ a', '+ b']);
  });

  it('compactBossTests shortens known names and caps the list', () => {
    expect(compactBossTests(['first Molt risk', 'custom', 'Scrap tension', 'Winded pressure'])).toEqual(['Molt timing', 'custom', 'Scrap']);
    expect(compactBossTests(['Winded pressure'], 0)).toEqual([]);
  });

  it('encounterPressureRead lists pressures in canonical order, capped', () => {
    expect(encounterPressureRead(['winded', 'multi', 'unknown'])).toEqual(['multiple foes', 'Winded']);
    expect(encounterPressureRead(['snag', 'cover', 'heavy'], 3)).toEqual(['Snags', 'enemy Cover', 'Heavy strikes']);
  });
});

describe('routeDecisionRead', () => {
  const input = (patch: Partial<RouteDecisionReadInput>): RouteDecisionReadInput => ({
    type: 'street', risk: 'low', encounterTags: [], recovery: 0, currentHp: 20, maxHp: 30, preenTargets: 0, scrap: 0,
    deckSize: 10, openSupplySlots: 0, availableChoices: 0, totalChoices: 0, bossTests: [], ...patch,
  });

  it('basin healing is capped by missing Cohesion', () => {
    expect(routeDecisionRead(input({ type: 'basin', recovery: 15 })).benefit).toBe('Heal 10/15 Cohesion (20 > 30)');
    expect(routeDecisionRead(input({ type: 'basin', recovery: 15, currentHp: 30 })).benefit).toBe('Healing 0/15; Cohesion full');
  });

  it('combat risk reads enemy count instead of the generic multi tag', () => {
    expect(routeDecisionRead(input({ risk: 'high', encounterTags: ['multi', 'winded'], enemyCount: 2 })).risk).toBe('high: 2 foes / Winded');
    expect(routeDecisionRead(input({ risk: 'medium' })).risk).toBe('medium damage risk');
    expect(routeDecisionRead(input({ risk: 'high' })).risk).toBe('high pressure');
  });

  it('pluralises and describes each node type', () => {
    expect(routeDecisionRead(input({ type: 'nest', preenTargets: 1, scrap: 5 })).benefit).toBe('1 Preen target; 5 Scrap');
    expect(routeDecisionRead(input({ type: 'cache', openSupplySlots: 2 })).benefit).toBe('Reward choice; 2 Supply slots open');
    expect(routeDecisionRead(input({ type: 'signal', availableChoices: 1, totalChoices: 3 })).benefit).toBe('1/3 Signal choices available');
    expect(routeDecisionRead(input({ type: 'boss', bossTests: [] })).risk).toBe('boss pressure');
    expect(routeDecisionRead(input({ type: 'boss', bossTests: ['first Molt risk', 'Scrap tension', 'x'] })).risk).toBe('Molt timing / Scrap');
  });
});

describe('rewardBuildObservations', () => {
  const c = (patch: Partial<{ role: string; type: string; cost: number; tags: string[]; suit: string | null; moltText: string }>) => ({
    role: patch.role ?? 'skill', type: patch.type ?? 'arcana', cost: patch.cost ?? 1, moltText: patch.moltText,
    runtime: { tags: patch.tags ?? [], suit: patch.suit ?? null },
  });

  it('flags a first source of a capability', () => {
    expect(rewardBuildObservations(c({ tags: ['cover'] }), [])[0]).toBe('+ First Cover source');
  });

  it('calls out the keystone threshold for the suit', () => {
    const deck = Array.from({ length: 4 }, () => c({ suit: 'plumes' }));
    expect(rewardBuildObservations(c({ suit: 'plumes' }), deck, [], undefined, 5)).toContain('+ PLUMES 4>5 KEYSTONE');
  });

  it('a matching Waymark outranks everything', () => {
    const read = rewardBuildObservations(c({ suit: 'quills', tags: ['cover'] }), [], [{ name: 'Long Name', trigger: 'onSuitPlayed(quills)' }], (n) => n.toUpperCase());
    expect(read[0]).toBe('+ Feeds LONG NAME');
  });

  it('pairs the best benefit with the best caution', () => {
    const deck = [c({ cost: 2 }), c({ cost: 2 }), c({ cost: 3 })];
    const read = rewardBuildObservations(c({ cost: 2, tags: ['draw'] }), deck);
    expect(read).toEqual(['+ First draw source', '! 4 cards cost 2+']);
  });
});

describe('card upgrades', () => {
  const runtime = (patch: Record<string, unknown> = {}, upgrade: Record<string, unknown> = {}) => ({
    cost: 1, effects: ['damage(target, 3)'], moltEffects: ['gainCover(2)'], flockStats: { power: 1 },
    ...patch,
    upgrade: { effects: ['damage(target, 3)'], moltEffects: ['gainCover(2)'], flockStats: { power: 1 }, ...upgrade },
  }) as unknown as RuntimeCard;

  it('detects meaningful differences in cost, effects, Molt effects and stats', () => {
    expect(hasMeaningfulCardUpgrade(undefined)).toBe(false);
    expect(hasMeaningfulCardUpgrade(runtime())).toBe(false);
    expect(hasMeaningfulCardUpgrade(runtime({}, { cost: 0 }))).toBe(true);
    expect(hasMeaningfulCardUpgrade(runtime({}, { cost: 1 }))).toBe(false);
    expect(hasMeaningfulCardUpgrade(runtime({}, { effects: ['damage(target, 4)'] }))).toBe(true);
    expect(hasMeaningfulCardUpgrade(runtime({}, { moltEffects: [] }))).toBe(true);
    expect(hasMeaningfulCardUpgrade(runtime({}, { flockStats: { power: 1, guard: 1 } }))).toBe(true);
    expect(hasMeaningfulCardUpgrade(runtime({}, { flockStats: { power: 1, guard: 0 } }))).toBe(false);
  });

  it('distinctMeaningfulUpgradeCards keeps one unupgraded copy per upgradable id', () => {
    const good = runtime({}, { cost: 0 });
    const flat = runtime();
    const cards = [
      { id: 'a', runtime: good }, { id: 'a', runtime: good }, { id: 'b', runtime: good, upgraded: true }, { id: 'c', runtime: flat },
    ];
    expect(distinctMeaningfulUpgradeCards(cards).map((card) => card.id)).toEqual(['a']);
  });
});
