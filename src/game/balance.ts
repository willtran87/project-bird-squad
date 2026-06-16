import balanceConfig from '../../data/game/balance-config.json';
import type { RouteNodeType } from './types';

export type RouteGenNodeType = Exclude<RouteNodeType, 'boss'>;

export interface RouteGenerationBalance {
  middleColumns: [number, number];
  lanes: [number, number];
  minimumCounts: Partial<Record<RouteGenNodeType, number>>;
  fillWeights: Partial<Record<RouteGenNodeType, number>>;
  requiredOpeningTypes: RouteGenNodeType[];
  preBossTypes: RouteGenNodeType[];
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

export function weightedPick<T extends string>(
  entries: Partial<Record<T, number>>,
  rand: () => number,
): T {
  const weighted = Object.entries(entries)
    .map(([key, value]) => [key as T, Math.max(0, Number(value) || 0)] as const)
    .filter(([, value]) => value > 0);
  const total = weighted.reduce((sum, [, value]) => sum + value, 0);
  let roll = rand() * total;
  for (const [key, value] of weighted) {
    roll -= value;
    if (roll <= 0) return key;
  }
  return weighted[weighted.length - 1][0];
}
