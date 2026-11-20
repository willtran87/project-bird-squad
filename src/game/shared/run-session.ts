import type { PendingCardClaim } from '../card-claim-checkpoint';
import { memoryStorageSessionActive } from '../safe-storage';
import { routeBlueprints, alphaRouteMarkLibrary, alphaSupplyLibrary, alphaSignalLibrary, alphaCardSet } from '../runtime-data';
import { generateRouteMap, hashSeed } from '../route-gen';
import type { RuntimeRouteMap, MarketPriceBand, RouteNode } from '../types';
import { difficultyLabel } from '../difficulty';
import { type CardAcquisitionSource, loadAccount, type CardCollectionRecord } from '../meta';
import { unlockCollectionMilestones } from '../collection-milestone-progress';
import type { RuntimeImageAsset } from '../runtime-images';
import { writeJournaledJson } from '../safe-storage';
import { queueCeremony } from '../ceremony-queue';
import type { BossDossierModule, Card, RunState, RunSummary } from './runtime-types';
import { BASE_SUPPLY_SLOTS, runMapIndices } from './gameplay-constants';
import { BATTLEFIELD_ASSETS, BATTLEFIELD_BOSS_VARIANTS, DEFAULT_BATTLEFIELD_ASSET } from '../../art-assets';
import { createCardTemplate } from './run-state';
import { clamp } from './ui-helpers';
import { routeNodeTypeLabel } from './route-text';

// Which district the run is currently in + the run's seed. Scenes set these from
// RunState in init(); all map-relative reads go through currentMap(). The route
// graph is generated procedurally (deterministic per seed), so each run differs.
export let activeMapIndex = 0;
export function setActiveMapIndex(value: typeof activeMapIndex) {
  activeMapIndex = value;
}

let activeRouteRhythm = false;
export function setActiveRouteRhythm(value: typeof activeRouteRhythm) {
  activeRouteRhythm = value;
}

export let activeSeed = 'alpha';
export function setActiveSeed(value: typeof activeSeed) {
  activeSeed = value;
}

const generatedMapCache = new Map<string, RuntimeRouteMap>();


export function generatedMapFor(seed: string, mapIndex: number, rhythm = false): RuntimeRouteMap {
  const blueprint = routeBlueprints[mapIndex] ?? routeBlueprints[0];
  const key = `${seed}:${mapIndex}:${rhythm ? 1 : 0}`;
  let map = generatedMapCache.get(key);
  if (!map) {
    map = generateRouteMap(blueprint, hashSeed(seed, mapIndex), rhythm);
    generatedMapCache.set(key, map);
  }
  return map;
}


export function currentMap(): RuntimeRouteMap {
  return generatedMapFor(activeSeed, activeMapIndex, activeRouteRhythm);
}


export function buildOutcomeFlightDetailsFor(summary: RunSummary, module: BossDossierModule) {
  const maps = runMapIndices(summary.runMode).map((mapIndex) => ({
    map: generatedMapFor(summary.seed, mapIndex, summary.flyway?.routeRhythm === 1),
    mapIndex,
  }));
  return module.buildOutcomeFlightDetails(summary, {
    maps,
    cardName: (id) => cardLibrary[id]?.name ?? id,
    routeNodeTypeLabel,
    waymarkName: (id) => alphaRouteMarkLibrary.get(id)?.name ?? id,
    supplyName: (id) => alphaSupplyLibrary.get(id)?.name ?? id,
    signalChoice: (signalId, choiceKey) => {
      const signal = alphaSignalLibrary.get(signalId);
      const choice = signal?.choices.find((candidate) => candidate.key === choiceKey);
      return `${signal?.title ?? signalId}: ${choice?.text ?? choiceKey}`;
    },
    difficultyLabel,
  });
}


export function priceInBand(band: MarketPriceBand, rarityStep = 0, districtStep = activeMapIndex) {
  const scaled = band.base + rarityStep * 18 + districtStep * 8;
  return Math.round(clamp(scaled, band.min, band.max));
}


export function runSupplyCapacity(runState: Pick<RunState, 'supplySlots'>) {
  return Math.max(BASE_SUPPLY_SLOTS, runState.supplySlots ?? BASE_SUPPLY_SLOTS);
}


export const MARKET_SUPPLY_PROXY_MARKS: Record<string, string> = {
  seed_packet: 'basin_charm',
  signal_flare: 'bright_bottlecap',
  zip_tie_roll: 'scaffold_knot',
  bottlecap_popper: 'bright_bottlecap',
  tar_solvent: 'blue_cup_token',
  feather_splint: 'feather_tape',
  mirror_shard: 'parade_mirror',
  emergency_call: 'signal_whistle',
  shade_cloth: 'tin_roof_shade',
  rooftop_decoy: 'stage_pin',
  molt_pin: 'sunbreak_lens',
  wire_snips: 'wire_map',
  spare_harness: 'sky_safe_harness',
  signal_kite: 'razor_kite_tail',
  storm_lantern: 'rooftop_relay_bell',
  cache_key: 'cache_hook',
  rain_cape: 'borrowed_raincoat'
};


function battlefieldVariantForRouteNode(routeNode?: RouteNode): RuntimeImageAsset | undefined {
  if (routeNode?.type === 'boss') return BATTLEFIELD_BOSS_VARIANTS[currentMap().id];
  return undefined;
}


export function currentBattlefieldAsset(routeNode?: RouteNode): RuntimeImageAsset {
  return battlefieldVariantForRouteNode(routeNode) ?? BATTLEFIELD_ASSETS[currentMap().id] ?? DEFAULT_BATTLEFIELD_ASSET;
}


export let practiceEncounterId: string | undefined;
export function setPracticeEncounterId(value: typeof practiceEncounterId) {
  practiceEncounterId = value;
}

export function currentCombatNodes(): RouteNode[] {
  const nodes = currentMap().nodes.filter((node) => ['street', 'rival', 'boss'].includes(node.type));
  if (practiceEncounterId && memoryStorageSessionActive()) nodes[0] = { ...nodes[0], type: 'street', payloadId: practiceEncounterId };
  return nodes;
}


export function currentCombatNodeIds(): Set<string> {
  return new Set(currentCombatNodes().map((node) => node.id));
}


export const cardLibrary: Record<string, Card> = Object.fromEntries(
  alphaCardSet.cards.map((card) => [card.id, createCardTemplate(card)])
);


export function recordCardAcquisitions(
  ids: string[],
  source: CardAcquisitionSource,
  receipt?: string,
): { firstCopies: string[]; completedTargets: string[]; newMilestones: string[]; saved?: boolean; replayed?: boolean } {
  const uniqueIds = [...new Set(ids.filter((id) => Boolean(cardLibrary[id])))];
  if (!uniqueIds.length) return { firstCopies: [], completedTargets: [], newMilestones: [] };
  const account = loadAccount();
  if (receipt && account.recentCardClaims?.includes(receipt)) {
    return { firstCopies: [], completedTargets: [], newMilestones: [], saved: true, replayed: true };
  }
  const discovered = new Set(account.discoveredCards);
  const targets = new Set((account.hunt ?? []).filter((id) => !account.cardCollection[id] && Boolean(cardLibrary[id])));
  const now = Date.now();
  const firstCopies: string[] = [];
  const completedTargets: string[] = [];
  uniqueIds.forEach((id) => {
    discovered.add(id);
    const prior = account.cardCollection[id];
    if (!prior) firstCopies.push(id);
    const next: CardCollectionRecord = prior
      ? { ...prior, timesClaimed: prior.timesClaimed + 1 }
      : { timesClaimed: 1, firstAcquiredAt: now, firstSource: source, isNew: true };
    if (targets.delete(id)) {
      completedTargets.push(id);
      next.targetCompletedAt = now;
      next.targetSource = source;
    }
    account.cardCollection[id] = next;
  });
  account.discoveredCards = [...discovered];
  account.hunt = [...targets];
  const newMilestones = unlockCollectionMilestones(account);
  if (receipt) account.recentCardClaims = [...(account.recentCardClaims ?? []), receipt].slice(-256);
  const saved = writeJournaledJson('birdsquad.account', account);
  if (saved && source !== 'starter_flock') queueCeremony('card', firstCopies);
  return { firstCopies, completedTargets, newMilestones, saved };
}


export function recordRunCardAcquisitions(run: RunState, ids: string[], source: CardAcquisitionSource) {
  const result: ReturnType<typeof recordCardAcquisitions> = { firstCopies: [], completedTargets: [], newMilestones: [], saved: true };
  const sequence = run.cardClaimSequence = (run.cardClaimSequence ?? 0) + 1;
  for (const id of [...new Set(ids)].filter(id => cardLibrary[id])) {
    const receipt = `card:${run.startedAtMs}:${run.seed}:${sequence}:${source}:${id}`;
    const claim = recordCardAcquisitions([id], source, receipt);
    if (!claim.saved) {
      (run.pendingCardClaims ??= []).push({ id, source, receipt });
      result.saved = false;
    } else {
      result.firstCopies.push(...claim.firstCopies); result.completedTargets.push(...claim.completedTargets);
      result.newMilestones.push(...claim.newMilestones);
    }
  }
  return result;
}


export function flushCardClaims(claims: PendingCardClaim[] = []) {
  return claims.every(claim => recordCardAcquisitions([claim.id], claim.source, claim.receipt).saved);
}


export const arcanaRewardPool = alphaCardSet.rewardPool;
