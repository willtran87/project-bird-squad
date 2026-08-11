import balanceConfig from '../../data/game/balance-config.json';
import type { RouteNodeType, RouteRisk, RuntimeCard } from './types';

export type RouteGenNodeType = Exclude<RouteNodeType, 'boss'>;

export interface RouteGenerationBeat {
  id: string;
  columns?: number[];
  fromEnd?: number;
  types?: RouteGenNodeType[];
  requireAny?: RouteGenNodeType[];
  maxCombat?: number;
  mustOfferNonCombat?: boolean;
}

export interface RoutePathRules {
  maxConsecutiveCombat?: number;
  minSafetyBeforeBoss?: number;
  minSafetyBeforeColumnPct?: number;
  minBuildBeforeBoss?: number;
  rivalRequiresAlternative?: boolean;
  maxPressureScore?: number;
}

export interface RouteGenerationBalance {
  middleColumns: [number, number];
  lanes: [number, number];
  minimumCounts: Partial<Record<RouteGenNodeType, number>>;
  fillWeights: Partial<Record<RouteGenNodeType, number>>;
  requiredOpeningTypes: RouteGenNodeType[];
  preBossTypes: RouteGenNodeType[];
  beats?: RouteGenerationBeat[];
  pathRules?: RoutePathRules;
}

export interface MapEconomyBalance {
  streetScrap: [number, number];
  rivalScrap: [number, number];
  bossScrap: number;
  cacheScrap: number;
  skipScrap: number;
}

export interface MapBalanceProfile {
  mapId: string;
  index: number;
  expectedFlockPower: number;
  routeGeneration: RouteGenerationBalance;
  economy: MapEconomyBalance;
  targets: Record<string, [number, number]>;
}

const profiles = (balanceConfig.maps as unknown as MapBalanceProfile[]).map((profile) => [profile.mapId, profile] as const);
const byMapId = new Map<string, MapBalanceProfile>(profiles);
const byIndex = new Map<number, MapBalanceProfile>(profiles.map(([, profile]) => [profile.index, profile]));

export function getMapBalanceProfile(mapId: string, index: number): MapBalanceProfile {
  return byMapId.get(mapId) ?? byIndex.get(index) ?? byIndex.get(1)!;
}

export function rewardWildcardPool<T>(
  remaining: T[],
  chosen: T[],
  dominantSuit: string | undefined,
  roleOf: (entry: T) => unknown,
  suitOf: (entry: T) => unknown,
): T[] {
  const chosenRoles = new Set(chosen.map(roleOf));
  let bestScore = -1;
  let pool: T[] = [];
  for (const entry of remaining) {
    const score = (chosenRoles.has(roleOf(entry)) ? 0 : 2)
      + (dominantSuit && suitOf(entry) !== dominantSuit ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      pool = [entry];
    } else if (score === bestScore) pool.push(entry);
  }
  return pool;
}

export function dominantRewardSuit<T>(entries: readonly T[], suitOf: (entry: T) => string | undefined) {
  const counts = new Map<string, number>();
  entries.forEach((entry) => {
    const suit = suitOf(entry);
    if (suit) counts.set(suit, (counts.get(suit) ?? 0) + 1);
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

interface DistrictRewardCard {
  role: string;
  runtime: {
    rarity: string;
    tags: readonly string[];
  };
}

const districtRewardMatchers: Record<string, (card: DistrictRewardCard) => boolean> = {
  cover: (card) => card.runtime.tags.includes('cover'),
  'direct damage': (card) => card.role === 'attack' || card.runtime.tags.includes('attack'),
  healing: (card) => card.runtime.tags.includes('heal') || card.runtime.tags.includes('recovery'),
  tempo: (card) => ['tempo', 'draw', 'draw-next', 'retain'].some((tag) => card.runtime.tags.includes(tag)),
  'open sky guard': (card) => card.runtime.tags.includes('open-sky') || card.runtime.tags.includes('molt'),
  'rare cards': (card) => card.runtime.rarity === 'rare' || card.runtime.rarity === 'legendary',
  'boss prep': (card) => ['cover', 'open-sky', 'finisher', 'pierce'].some((tag) => card.runtime.tags.includes(tag)),
};

export function districtCardRewardLeans(rewardBias: readonly string[]): string[] {
  return rewardBias.filter((bias) => districtRewardMatchers[bias.toLowerCase()]);
}

export function districtRewardAffinity(card: DistrictRewardCard, rewardBias: readonly string[]): string[] {
  return districtCardRewardLeans(rewardBias).filter((bias) => districtRewardMatchers[bias.toLowerCase()](card));
}

export function districtRewardObservations(
  card: DistrictRewardCard,
  rewardBias: readonly string[],
  buildObservations: readonly string[],
): string[] {
  const affinity = districtRewardAffinity(card, rewardBias)[0];
  const districtRead = affinity ? `+ District lean: ${affinity}` : undefined;
  return [districtRead, ...buildObservations.filter((entry) => entry !== districtRead)]
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, 2);
}

const compactBossTestNames: Record<string, string> = {
  'first Molt risk': 'Molt timing',
  'Open Sky management': 'Open Sky',
  'Cover under sustained pressure': 'sustained Cover',
  'full Flock build': 'full build',
  'Plumes/Quills sequencing': 'suit sequencing',
  'Winded pressure': 'Winded',
  'Scrap tension': 'Scrap',
};

export function compactBossTests(primaryTests: readonly string[], maxTests = 3): string[] {
  return primaryTests.slice(0, maxTests).map((test) => compactBossTestNames[test] ?? test);
}

const encounterPressureLabels: Array<[string, string]> = [
  ['multi', 'multiple foes'],
  ['snag', 'Snags'],
  ['openSky', 'Open Sky'],
  ['winded', 'Winded'],
  ['cover', 'enemy Cover'],
  ['heavy', 'Heavy strikes'],
  ['tempo', 'tempo loss'],
  ['poison', 'poison'],
  ['support', 'support unit'],
  ['molt', 'Molt trigger'],
  ['scavenge', 'Scrap theft'],
];

export function encounterPressureRead(tags: readonly string[], maxPressures = 2): string[] {
  const authored = new Set(tags);
  return encounterPressureLabels
    .filter(([tag]) => authored.has(tag))
    .slice(0, maxPressures)
    .map(([, label]) => label);
}

export interface RouteDecisionReadInput {
  type: RouteNodeType;
  risk: RouteRisk;
  encounterTags: readonly string[];
  recovery: number;
  currentHp: number;
  maxHp: number;
  preenTargets: number;
  scrap: number;
  deckSize: number;
  openSupplySlots: number;
  availableChoices: number;
  totalChoices: number;
  bossTests: readonly string[];
}

export function routeDecisionRead(input: RouteDecisionReadInput) {
  const pressure = encounterPressureRead(input.encounterTags).join(' / ');
  const risk = pressure
    ? `${input.risk}: ${pressure}`
    : input.risk === 'high' ? 'high pressure' : input.risk === 'medium' ? 'medium damage risk' : 'low pressure';
  switch (input.type) {
    case 'basin': {
      const healed = Math.min(input.recovery, Math.max(0, input.maxHp - input.currentHp));
      return {
        benefit: healed > 0
          ? `Heal ${healed}/${input.recovery} Cohesion (${input.currentHp} > ${input.currentHp + healed})`
          : `Healing 0/${input.recovery}; Cohesion full`,
        risk: 'no deck growth',
      };
    }
    case 'nest': return {
      benefit: `${input.preenTargets} Preen ${input.preenTargets === 1 ? 'target' : 'targets'}; ${input.scrap} Scrap`,
      risk: 'spends Scrap; no recovery',
    };
    case 'market': return { benefit: `Shop with ${input.scrap} Scrap; deck ${input.deckSize}`, risk: 'inventory unknown' };
    case 'cache': return {
      benefit: `Reward choice; ${input.openSupplySlots} Supply ${input.openSupplySlots === 1 ? 'slot' : 'slots'} open`,
      risk: 'reward varies',
    };
    case 'signal': return {
      benefit: `${input.availableChoices}/${input.totalChoices} Signal choices available`,
      risk: 'trade-off attached',
    };
    case 'rival': return { benefit: `Rare draft + Waymark chance; deck ${input.deckSize}`, risk };
    case 'boss': return {
      benefit: 'Clear district for a major reward',
      risk: compactBossTests(input.bossTests, 2).join(' / ') || 'boss pressure',
    };
    default: return { benefit: `Card + Scrap; deck ${input.deckSize}`, risk };
  }
}

export function draftStructuredRewardChoices<T>(
  candidates: readonly T[],
  owned: readonly T[],
  maxChoices: number,
  random: () => number,
  weightOf: (entry: T) => number,
  solvesNeed: (entry: T) => boolean,
  roleOf: (entry: T) => unknown,
  suitOf: (entry: T) => string | undefined,
  districtMatch: (entry: T) => boolean,
): T[] {
  const remaining = [...candidates];
  const chosen: T[] = [];
  const dominantSuit = dominantRewardSuit(owned, suitOf);
  let districtAligned = false;
  const take = (pool: T[], preferDistrict = false) => {
    let available = pool.filter((entry) => remaining.includes(entry));
    if (!available.length || chosen.length >= maxChoices) return;
    if (preferDistrict && !districtAligned) {
      const aligned = available.filter(districtMatch);
      if (aligned.length) available = aligned;
    }
    let roll = random() * available.reduce((sum, entry) => sum + weightOf(entry), 0);
    let index = 0;
    for (; index < available.length - 1; index += 1) {
      roll -= weightOf(available[index]);
      if (roll <= 0) break;
    }
    const entry = available[index];
    chosen.push(entry);
    districtAligned ||= districtMatch(entry);
    remaining.splice(remaining.indexOf(entry), 1);
  };
  take(remaining.filter(solvesNeed), true);
  take(dominantSuit ? remaining.filter((entry) => suitOf(entry) === dominantSuit) : [], true);
  while (chosen.length < maxChoices && remaining.length) {
    const pivot = rewardWildcardPool(remaining, chosen, dominantSuit, roleOf, suitOf);
    const aligned = pivot.filter(districtMatch);
    take(!districtAligned && aligned.length ? aligned : pivot, true);
  }
  return chosen;
}

export function draftComplementaryRewardPair<T>(
  candidates: readonly T[],
  owned: readonly T[],
  random: () => number,
  roleOf: (entry: T) => unknown,
  suitOf: (entry: T) => string | undefined,
): T[] {
  const remaining = [...candidates];
  const roleCounts = new Map<unknown, number>();
  owned.forEach((entry) => {
    const role = roleOf(entry);
    if (role) roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  });
  const dominantSuit = dominantRewardSuit(owned, suitOf);
  const chosen: T[] = [];
  const take = (pool: T[]) => {
    if (!pool.length || chosen.length >= 2) return;
    const entry = pool[Math.floor(random() * pool.length)];
    chosen.push(entry);
    remaining.splice(remaining.indexOf(entry), 1);
  };
  const leastRoleCount = Math.min(...remaining.map((entry) => roleCounts.get(roleOf(entry)) ?? 0));
  const needPool = remaining.filter((entry) => (roleCounts.get(roleOf(entry)) ?? 0) === leastRoleCount);
  const synergyNeedPool = dominantSuit ? needPool.filter((entry) => suitOf(entry) === dominantSuit) : [];
  take(synergyNeedPool.length ? synergyNeedPool : needPool);
  take(rewardWildcardPool(remaining, chosen, dominantSuit, roleOf, suitOf));
  return chosen;
}

interface RewardObservationCard {
  role: string;
  type: string;
  cost: number;
  moltText?: string;
  runtime: {
    tags: readonly string[];
    suit?: string | null;
  };
}

interface RewardObservationWaymark {
  name: string;
  trigger?: string;
}

export function rewardBuildObservations<T extends RewardObservationCard>(
  card: T,
  cards: readonly T[],
  waymarks: readonly RewardObservationWaymark[] = [],
  compactName: (name: string) => string = (name) => name,
  keystoneAt = 5,
): string[] {
  const has = (entry: T, tag: string) => entry.runtime.tags.includes(tag);
  const count = (predicate: (entry: T) => boolean) => cards.filter(predicate).length;
  const rate = (amount: number): 'low' | 'steady' | 'strong' => (amount <= 1 ? 'low' : amount <= 3 ? 'steady' : 'strong');
  const summary = {
    damage: rate(count((entry) => entry.role === 'attack' || has(entry, 'attack'))),
    cover: rate(count((entry) => has(entry, 'cover'))),
    recovery: rate(count((entry) => has(entry, 'heal') || has(entry, 'regen'))),
    draw: rate(count((entry) => has(entry, 'draw') || has(entry, 'draw-next'))),
    moltSafety: rate(count((entry) => entry.type === 'molt' || has(entry, 'molt') || has(entry, 'open-sky'))),
  };
  const observations: Array<[number, string]> = [];
  const add = (priority: number, text: string) => {
    if (!observations.some((entry) => entry[1] === text)) observations.push([priority, text]);
  };
  const candidateHas = (tag: string) => has(card, tag);
  const capability = (candidate: boolean, owned: number, label: string, rank: 'low' | 'steady' | 'strong') => {
    if (!candidate) return;
    if (owned === 0) add(88, `+ First ${label} source`);
    else if (rank === 'low') add(70, `+ Fills ${label} gap`);
  };
  capability(card.role === 'attack' || candidateHas('attack'), count((entry) => entry.role === 'attack' || has(entry, 'attack')), 'damage', summary.damage);
  capability(candidateHas('cover'), count((entry) => has(entry, 'cover')), 'Cover', summary.cover);
  capability(candidateHas('heal') || candidateHas('regen'), count((entry) => has(entry, 'heal') || has(entry, 'regen')), 'recovery', summary.recovery);
  capability(candidateHas('draw') || candidateHas('draw-next'), count((entry) => has(entry, 'draw') || has(entry, 'draw-next')), 'draw', summary.draw);
  capability(candidateHas('winded'), count((entry) => has(entry, 'winded')), 'Winded', 'low');
  capability(candidateHas('pierce'), count((entry) => has(entry, 'pierce')), 'pierce', 'low');
  capability(candidateHas('aoe'), count((entry) => has(entry, 'aoe')), 'area damage', 'low');
  if ((candidateHas('heal') || candidateHas('regen')) && summary.recovery === 'strong') add(82, '! Recovery already strong');
  if ((card.type === 'molt' || candidateHas('molt') || candidateHas('open-sky')) && summary.moltSafety === 'low') add(72, '+ Adds Molt safety');
  const suit = card.runtime.suit;
  const suitCount = suit ? count((entry) => entry.runtime.suit === suit) : 0;
  if (suit) {
    const label = suit.toUpperCase();
    const matchingWaymark = waymarks.find((mark) => mark.trigger === `onSuitPlayed(${suit})`);
    if (matchingWaymark) add(100, `+ Feeds ${compactName(matchingWaymark.name)}`);
    if (suitCount === keystoneAt - 1) add(96, `+ ${label} ${suitCount}>${suitCount + 1} KEYSTONE`);
    else add(44, `= ${label} ${suitCount}>${suitCount + 1}`);
  }
  const costlyCards = count((entry) => entry.cost >= 2);
  if (card.cost >= 2 && costlyCards >= 3) add(84, `! ${costlyCards + 1}th 2+ cost`);
  const sameRole = count((entry) => entry.role === card.role);
  if (sameRole >= 4) add(62, `! ${card.role === 'attack' ? 'Attack' : card.role === 'skill' ? 'Skill' : 'Utility'} role crowded`);
  if (card.moltText) add(48, '+ Adds Molt option');
  return observations.sort((left, right) => right[0] - left[0]).slice(0, 2).map((entry) => entry[1]);
}

function sameStringList(left: readonly string[] | undefined, right: readonly string[] | undefined) {
  const a = left ?? [];
  const b = right ?? [];
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function hasMeaningfulCardUpgrade(card: RuntimeCard | undefined): card is RuntimeCard {
  if (!card) return false;
  if ((card.upgrade.cost ?? card.cost) !== card.cost) return true;
  if (!sameStringList(card.effects, card.upgrade.effects)) return true;
  if (!sameStringList(card.moltEffects, card.upgrade.moltEffects)) return true;
  const baseStats = card.flockStats as Record<string, number | undefined>;
  const upgradeStats = card.upgrade.flockStats as Record<string, number | undefined>;
  return [...new Set([...Object.keys(baseStats), ...Object.keys(upgradeStats)])]
    .some((key) => (baseStats[key] ?? 0) !== (upgradeStats[key] ?? 0));
}

export function distinctMeaningfulUpgradeCards<T extends { id: string; upgraded?: boolean; runtime: RuntimeCard }>(cards: T[]) {
  return [...new Map(cards
    .filter((card) => !card.upgraded && hasMeaningfulCardUpgrade(card.runtime))
    .map((card) => [card.id, card])).values()];
}

export function weightedPick<T extends string>(
  entries: Partial<Record<T, number>>,
  rand: () => number,
  fallback?: T,
): T {
  const weighted = Object.entries(entries)
    .map(([key, value]) => [key as T, Math.max(0, Number(value) || 0)] as const)
    .filter(([, value]) => value > 0);
  if (weighted.length === 0) {
    const firstKey = Object.keys(entries)[0] as T | undefined;
    if (fallback ?? firstKey) return (fallback ?? firstKey) as T;
    throw new Error('weightedPick requires at least one entry or fallback');
  }
  const total = weighted.reduce((sum, [, value]) => sum + value, 0);
  let roll = rand() * total;
  for (const [key, value] of weighted) {
    roll -= value;
    if (roll <= 0) return key;
  }
  return weighted[weighted.length - 1][0];
}
