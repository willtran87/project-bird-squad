import { alphaMaps, alphaMarketSet, alphaRouteMarkSet, alphaRouteMarkLibrary } from '../runtime-data';
import type { RuntimeRouteMap } from '../types';
import type { Card, CardRewardEvent, CombatResultSummary, DeckReviewFilter, DeckReviewSort, RouteMark, RunMode } from './runtime-types';
import { isSnagCard } from './card-presentation';

export const MARKET_BOSS_GUARD = 'boss_guard';

export const MARKET_ROUTE_SCOUT = 'route_scout';

export const MARKET_BOSS_GUARD_SHIELD = 18;

export const MARKET_BOSS_GUARD_SKY_GUARD = 1;

export const MARKET_ROUTE_SCOUT_OPEN_SKY_REDUCTION = 2;

// A suit's keystone aura activates once the flock holds this many of that suit.
// (A suit-biased Leader's starter deck already crosses it, so each Leader opens
// with their keystone live; the balanced Fledgling opens with none.)
export const KEYSTONE_AT = 5;

export const NESTS_COVER_CARRY_CAP = 8;

export const SOLO_ENCOUNTER_HEALTH_MULT = 1.35;

export const SOLO_ENCOUNTER_DAMAGE_BONUS = 2;

export const MULTI_ENCOUNTER_HEALTH_MULT = 1.2;

export const MULTI_ENCOUNTER_DAMAGE_BONUS = 2;

export const CARD_REVIEW_VISIBLE_ROWS = 7;

export const CARD_REVIEW_ROW_H = 58;

export const DECK_REVIEW_FILTERS: DeckReviewFilter[] = ['all', 'plumes', 'quills', 'basins', 'nests', 'special', 'preened'];

export const DECK_REVIEW_SORTS: DeckReviewSort[] = ['run', 'cost', 'name'];

export const BASE_COHESION = 36;

export const BASE_WINGBEATS = 3;

export const BASE_RESONANCE_CAP = 5;

export const BASE_MOLT_POWER = 2;

export const BASE_SUPPLY_SLOTS = 2;

export const POST_COMBAT_RECOVERY = 1;

export const OVEREXTENSION_CARD_THRESHOLD = 4;

export const WAYMARK_ACTIVE_CAP = 6;

export const STARTING_SCRAP = 40;

const QUICK_FLIGHT_MAP_INDICES = [0, 2, 3];


export function runMapIndices(mode: RunMode | undefined): number[] {
  return mode === 'quick' ? QUICK_FLIGHT_MAP_INDICES : alphaMaps.map((_map, index) => index);
}


export function runDistrictOrdinal(mode: RunMode | undefined, mapIndex: number): number {
  const index = runMapIndices(mode).indexOf(mapIndex);
  return index >= 0 ? index + 1 : 1;
}


export function nextRunMapIndex(mode: RunMode | undefined, mapIndex: number): number | undefined {
  const indices = runMapIndices(mode);
  return indices[indices.indexOf(mapIndex) + 1];
}

// Market pricing is data-driven from alpha-market.json (next-level-implementation
// -spec "Market prices and services are data-driven").
export const alphaMarketConfig = alphaMarketSet.markets[0];

export const MARKET_PREEN_PRICE = alphaMarketConfig.services.find((service) => service.id === 'preen')?.basePrice ?? 100;

export const MARKET_ROUTE_MARK_PRICE = alphaMarketConfig.routeMarkSlots[0]?.price.base ?? 110;

export const MARKET_REFRESH_BASE_PRICE = 30;

export const CACHE_SCRAP_REWARD = 30;

export const DEFAULT_REWARD_SKIP_SCRAP = 12;

export type DistrictContractId = 'hold_line' | 'clean_flight' | 'bright_signal' | 'lean_route';


export interface DistrictContractState {
  mapIndex: number;
  id: DistrictContractId;
  baselineCombatResults: number;
  baselineRewardEvents: number;
  baselineSnags: number;
  confirmed?: boolean;
  completed?: boolean;
  rewardClaimed?: boolean;
  celebrated?: boolean;
}


interface DistrictContractDefinition {
  id: DistrictContractId;
  name: string;
  goal: string;
  target: number;
  rewardScrap: number;
}


export const DISTRICT_CONTRACT_DEFINITIONS: DistrictContractDefinition[] = [
  { id: 'hold_line', name: 'Hold The Line', goal: 'Clear two fights without Cohesion loss', target: 2, rewardScrap: 24 },
  { id: 'clean_flight', name: 'Clean Flight', goal: 'Reach the boss without adding a Snag', target: 1, rewardScrap: 20 },
  { id: 'bright_signal', name: 'Bright Signal', goal: 'Trigger Surge in three fights', target: 3, rewardScrap: 22 },
  { id: 'lean_route', name: 'Lean Route', goal: 'Skip two card rewards', target: 2, rewardScrap: 26 }
];


export function districtContractProgressValue(
  contract: DistrictContractState,
  map: RuntimeRouteMap,
  cards: Card[],
  combatResults: CombatResultSummary[],
  rewardEvents: CardRewardEvent[],
  currentRouteNodeId: string | undefined,
  completedRouteNodeIds: string[]
) {
  const districtNodeIds = new Set(map.nodes.map((node) => node.id));
  const districtResults = combatResults.filter((result) => districtNodeIds.has(result.nodeId));
  if (contract.id === 'hold_line') return districtResults.filter((result) => result.cohesionLost === 0).length;
  if (contract.id === 'bright_signal') return districtResults.filter((result) => (result.decisionStats?.surgesTriggered ?? 0) > 0).length;
  if (contract.id === 'lean_route') return rewardEvents.slice(contract.baselineRewardEvents).filter((event) => event.skipped).length;
  const snags = cards.filter(isSnagCard).length;
  const reachedBoss = currentRouteNodeId === map.bossNodeId || completedRouteNodeIds.includes(map.bossNodeId);
  return reachedBoss && snags <= contract.baselineSnags ? 1 : 0;
}


// Waymarks are the player-facing relic/artifact item pool. Internally the
// save/runtime field remains `routeMarks` for compatibility with existing runs.
export const MARKET_ROUTE_MARK_IDS = [...alphaRouteMarkSet.routeMarks]
  .filter((mark) => mark.rarity !== 'boss')
  .map((mark) => mark.id);

export const routeMarks: RouteMark[] = MARKET_ROUTE_MARK_IDS.map((id) => {
  const mark = alphaRouteMarkLibrary.get(id);
  return { id, name: mark?.name ?? id, text: mark?.description ?? '', price: MARKET_ROUTE_MARK_PRICE };
});

export const HIGH_TIER_ROUTE_MARK_IDS = [...alphaRouteMarkSet.routeMarks]
  .filter((mark) => mark.rarity === 'rare' || mark.rarity === 'boss' || mark.source === 'boss')
  .map((mark) => mark.id);

export const ALL_ROUTE_MARK_IDS = [...alphaRouteMarkSet.routeMarks].map((mark) => mark.id);

export const WAYMARK_REWARD_CHOICE_COUNT = 3;
