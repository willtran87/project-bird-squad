import { sanitizeContributions } from '../card-contributions';
import { validBranch, normalizeFlyway, newFlywayState, branchUpgrade } from '../flyway-rules';
import { sanitizeCardClaims } from '../card-claim-checkpoint';
import { sanitizeRewardCheckpoint, cloneRewardCheckpoint } from '../reward-checkpoint';
import { alphaRouteMarkLibrary, alphaSupplyLibrary, alphaMaps } from '../runtime-data';
import { stringArray, finiteInt } from '../deterministic-draw';
import type { RouteNode, RuntimeCard } from '../types';
import { defaultLeaderId, flockLeaders, getLeader } from '../leaders';
import { MAX_DIFFICULTY } from '../difficulty';
import { recordRun, loadAccount } from '../meta';
import { sanitizeGuide, firstFlightGuideStep } from '../first-flight-guide';
import { writeJournaledJson, safeStorageGet, removeJournaledJson, readJournaledJson, safeStorageSet } from '../safe-storage';
import type { Card, CardRewardEvent, CombatDecisionStats, CombatResultSummary, EncounterObjective, NextCombatMods, RouteDecisionEvent, RunMode, RunState, RunSummary, SavedCard, SignalChoiceEvent } from './runtime-types';
import { BASE_COHESION, BASE_SUPPLY_SLOTS, type DistrictContractId, type DistrictContractState, STARTING_SCRAP } from './gameplay-constants';
import { cardLibrary, flushCardClaims, generatedMapFor, recordCardAcquisitions, runSupplyCapacity } from './run-session';
import { formatEffects } from './effect-text';
import { readActiveRunCheckpoint, stampActiveRunVersion } from '../save-migration';
import { aggregateFlockStats } from './card-stats';

// Active-run persistence: a single in-progress run is mirrored to localStorage so
// the player can close the tab and Continue. Written from the route checkpoint
// (RouteScene.renderAll) and cleared on win / loss / abandon.
const ACTIVE_RUN_KEY = 'birdsquad.run.active';

const FINISHED_RUN_KEY = 'birdsquad.run.finished';


export function completedRunId(startedAt: number, seed: string) {
  return `run-${startedAt}-flight-${seed}`;
}


export function persistFinishedRun(summary: RunSummary): ReturnType<typeof recordRun> | undefined {
  // Outbox first, account receipt and data together, then history, then retire
  // the checkpoint. Any partial failure is replayable without a second award.
  if (!writeJournaledJson(FINISHED_RUN_KEY, summary)) return;
  if (!flushCardClaims(summary.pendingCardClaims)) return;
  const combats = summary.combatResults;
  const rewards = recordRun({
    receipt: summary.id, result: summary.result, leaderId: summary.leaderId ?? defaultLeaderId,
    difficulty: summary.difficulty ?? 0, runMode: summary.runMode,
    totalRunTurns: summary.turnsTaken, turns: combats.at(-1)?.turnsTaken ?? summary.turnsTaken,
    cohesion: summary.currentCohesion, maxCohesion: summary.maxCohesion,
    deckSize: summary.deck.filter(card => cardLibrary[card.id]?.runtime.kind !== 'snag').length,
    surgesTriggered: combats.reduce((sum, combat) => sum + (combat.decisionStats?.surgesTriggered ?? 0), 0),
    cleanFights: combats.filter(combat => combat.cohesionLost === 0).length,
    swiftFights: combats.filter(combat => combat.turnsTaken <= 3).length,
    blockedDamage: summary.decisionStats?.blockedDamage,
    completedContracts: summary.districtContracts.filter(contract => contract.completed),
    observedEnemyMoves: summary.seenEnemyMoves,
  });
  if (!rewards.saved) return;
  const history = loadRunHistory().filter(run => run.id !== summary.id);
  if (!writeJournaledJson(RUN_HISTORY_KEY, [...history, summary].slice(-50))) return;
  const active = loadActiveRun();
  if (active && completedRunId(active.startedAtMs ?? 0, active.seed ?? '') === summary.id) {
    clearActiveRun();
    if (safeStorageGet(ACTIVE_RUN_KEY) || safeStorageGet(`${ACTIVE_RUN_KEY}.backup`)) return;
  }
  removeJournaledJson(FINISHED_RUN_KEY);
  return rewards;
}


export function recoverFinishedRun(): boolean {
  const pending = readJournaledJson(FINISHED_RUN_KEY, sanitizeRunSummary);
  return !pending || !!persistFinishedRun(pending);
}

export function persistActiveRun(runState: RunState): boolean {
  if (!writeJournaledJson(ACTIVE_RUN_KEY, stampActiveRunVersion(runState)) || !flushCardClaims(runState.pendingCardClaims)) return false;
  if (runState.pendingCardClaims?.length) runState.pendingCardClaims = [];
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const RUN_HISTORY_KEY = 'birdsquad.runs';

export function sanitizeRunHistory(value: unknown): RunSummary[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const byId = new Map<string, RunSummary>();
  value.slice(-200).forEach((entry) => {
    const summary = sanitizeRunSummary(entry);
    if (!summary) return;
    byId.delete(summary.id);
    byId.set(summary.id, summary);
  });
  return [...byId.values()].slice(-50);
}

export function loadRunHistory(): RunSummary[] {
  return readJournaledJson(RUN_HISTORY_KEY, sanitizeRunHistory) ?? [];
}

export function playtestRating(value: unknown): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  const rating = Math.round(Number(value));
  return rating >= 1 && rating <= 5 ? rating : undefined;
}

export function sanitizedPlaytestFeedback(value: unknown): import('../profile-scene').PlaytestExperienceFeedback | undefined {
  if (!isRecord(value)) return undefined;
  const feedback: import('../profile-scene').PlaytestExperienceFeedback = {
    fun: playtestRating(value.fun),
    fairness: playtestRating(value.fairness),
    clarity: playtestRating(value.clarity),
    replay: playtestRating(value.replay),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
  };
  return Object.values(feedback).some((entry) => entry !== undefined) ? feedback : undefined;
}

function sanitizeRunSummary(value: unknown): RunSummary | undefined {
  if (!isRecord(value)) return undefined;
  const pendingCardClaims = sanitizeCardClaims(value.pendingCardClaims, id => !!cardLibrary[id]);
  if (!pendingCardClaims) return undefined;
  const id = typeof value.id === 'string' ? value.id.trim().slice(0, 96) : '';
  const seed = typeof value.seed === 'string' ? value.seed.trim().slice(0, 64) : '';
  if (!id || !seed || (value.result !== 'win' && value.result !== 'loss')) return undefined;
  const guideProgress = sanitizeGuide(value.firstFlightGuide) ?? sanitizeGuide({})!;
  const decision = isRecord(value.decisionStats) ? value.decisionStats : undefined;
  const deck = Array.isArray(value.deck)
    ? canonicalSavedCards(value.deck.filter(isRecord).flatMap((entry) => (
        typeof entry.id === 'string' && Boolean(cardLibrary[entry.id])
          ? [{ id: entry.id, upgraded: entry.upgraded === true, preenBranch: validBranch(entry.id, entry.preenBranch) }]
          : []
      ))).slice(0, 200)
    : [];
  const safeNodeIds = (input: unknown) => stringArray(input)
    .filter((entry) => /^[a-z0-9_-]{1,96}$/i.test(entry))
    .slice(0, 128);
  return {
    id,
    seed,
    flyway: isRecord(value.flyway) ? normalizeFlyway(value.flyway) : undefined,
    pendingCardClaims: pendingCardClaims.length ? pendingCardClaims : undefined,
    result: value.result,
    leaderId: typeof value.leaderId === 'string' && flockLeaders.some((leader) => leader.id === value.leaderId)
      ? value.leaderId
      : defaultLeaderId,
    difficulty: finiteInt(value.difficulty, 0, 0, MAX_DIFFICULTY),
    runMode: value.runMode === 'quick' ? 'quick' : 'full',
    mapId: typeof value.mapId === 'string' ? value.mapId.slice(0, 96) : '',
    finalNodeId: typeof value.finalNodeId === 'string' ? value.finalNodeId.slice(0, 96) : '',
    killedBy: typeof value.killedBy === 'string' ? value.killedBy.slice(0, 120) : undefined,
    turnsTaken: finiteInt(value.turnsTaken, 0, 0, 100_000),
    durationMs: finiteInt(value.durationMs, 0, 0, 7 * 24 * 60 * 60 * 1000),
    currentCohesion: finiteInt(value.currentCohesion, 0, 0, 10_000),
    maxCohesion: finiteInt(value.maxCohesion, BASE_COHESION, 1, 10_000),
    scrapEarned: finiteInt(value.scrapEarned, 0, 0, 1_000_000),
    scrapSpent: finiteInt(value.scrapSpent, 0, 0, 1_000_000),
    finalScrap: finiteInt(value.finalScrap, 0, 0, 1_000_000),
    path: safeNodeIds(value.path),
    deck,
    routeMarks: stringArray(value.routeMarks).filter((entry) => alphaRouteMarkLibrary.has(entry)).slice(0, 64),
    suppliesUsed: stringArray(value.suppliesUsed).filter((entry) => alphaSupplyLibrary.has(entry)).slice(0, 64),
    signals: sanitizeSignalChoices(value.signals).slice(0, 128),
    cardRewards: sanitizeRewardEvents(value.cardRewards).slice(0, 128),
    routeDecisions: sanitizeRouteDecisions(value.routeDecisions).slice(0, 128),
    combatResults: sanitizeCombatResults(value.combatResults).slice(0, 128),
    districtContracts: sanitizeDistrictContracts(value.districtContracts).slice(0, alphaMaps.length),
    seenEnemyMoves: stringArray(value.seenEnemyMoves).filter((entry) => entry.length <= 160).slice(0, 2048),
    combatPace: value.combatPace === 'cinematic' || value.combatPace === 'snappy'
      ? value.combatPace
      : 'standard',
    animationPace: value.animationPace === 'relaxed' || value.animationPace === 'fast'
      ? value.animationPace
      : 'standard',
    firstFlightGuide: { ...guideProgress, step: firstFlightGuideStep(guideProgress) },
    experienceFeedback: sanitizedPlaytestFeedback(value.experienceFeedback),
    decisionStats: decision ? {
      cardsPlayed: finiteInt(decision.cardsPlayed, 0, 0, 1_000_000),
      overextensions: finiteInt(decision.overextensions, 0, 0, 1_000_000),
      lowCardTurns: finiteInt(decision.lowCardTurns, 0, 0, 1_000_000),
      noOverextensionTurns: finiteInt(decision.noOverextensionTurns, 0, 0, 1_000_000),
      cardsHeldAtRoost: finiteInt(decision.cardsHeldAtRoost, 0, 0, 1_000_000),
      unspentWingbeatAtRoost: finiteInt(decision.unspentWingbeatAtRoost, 0, 0, 1_000_000),
      maxCardsPlayedTurn: finiteInt(decision.maxCardsPlayedTurn, 0, 0, 1_000_000),
      finalWaymarks: finiteInt(decision.finalWaymarks, 0, 0, 1_000),
      blockedDamage: finiteInt(decision.blockedDamage, 0, 0, 1_000_000),
      invalidActions: finiteInt(decision.invalidActions, 0, 0, 1_000_000),
      cancelledActions: finiteInt(decision.cancelledActions, 0, 0, 1_000_000),
      bossEntryCohesion: Number.isFinite(decision.bossEntryCohesion)
        ? finiteInt(decision.bossEntryCohesion, 0, 0, 10_000)
        : undefined,
      bossEntryScrap: Number.isFinite(decision.bossEntryScrap)
        ? finiteInt(decision.bossEntryScrap, 0, 0, 1_000_000)
        : undefined,
    } : undefined,
  };
}

function validRouteNodeType(value: unknown): value is RouteNode['type'] {
  return value === 'street' || value === 'rival' || value === 'boss' || value === 'basin' ||
    value === 'nest' || value === 'market' || value === 'signal' || value === 'cache';
}

function sanitizeNextCombat(value: unknown): NextCombatMods | undefined {
  if (!isRecord(value)) return undefined;
  const mods: NextCombatMods = {};
  if (Number.isFinite(value.wingbeatBonus)) mods.wingbeatBonus = Math.max(0, Math.min(8, Math.floor(Number(value.wingbeatBonus))));
  if (Number.isFinite(value.openSkyGuard)) mods.openSkyGuard = Math.max(0, Number(value.openSkyGuard));
  if (Number.isFinite(value.reduceNextOpenSky)) mods.reduceNextOpenSky = Math.max(0, Number(value.reduceNextOpenSky));
  if (Number.isFinite(value.enemyCover)) mods.enemyCover = Math.max(0, Number(value.enemyCover));
  if (value.startOpenSky === true) mods.startOpenSky = true;
  if (Number.isFinite(value.bossDamageShield)) mods.bossDamageShield = Math.max(0, Number(value.bossDamageShield));
  return Object.keys(mods).length ? mods : undefined;
}

function sanitizeSignalChoices(value: unknown): SignalChoiceEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((entry) => {
    if (typeof entry.signalId !== 'string' || typeof entry.choiceKey !== 'string') return [];
    return [{ signalId: entry.signalId, choiceKey: entry.choiceKey }];
  });
}

function sanitizeRewardEvents(value: unknown): CardRewardEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((entry) => ({
    offered: stringArray(entry.offered).filter((id) => Boolean(cardLibrary[id])),
    picked: typeof entry.picked === 'string' && Boolean(cardLibrary[entry.picked]) ? entry.picked : undefined,
    skipped: entry.skipped === true,
    fallback: entry.fallback === 'scrap' || entry.fallback === 'preen' ? entry.fallback : undefined,
    decisionMs: finiteInt(entry.decisionMs, 0, 0)
  }));
}

function sanitizeRouteDecisions(value: unknown): RouteDecisionEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((entry) => typeof entry.picked === 'string' ? [{
    offered: stringArray(entry.offered),
    picked: entry.picked,
    decisionMs: finiteInt(entry.decisionMs, 0, 0)
  }] : []);
}

function sanitizeCombatDecisionStats(value: unknown): CombatDecisionStats | undefined {
  if (!isRecord(value)) return undefined;
  return {
    cardsPlayed: finiteInt(value.cardsPlayed, 0, 0),
    overextensions: finiteInt(value.overextensions, 0, 0),
    lowCardTurns: finiteInt(value.lowCardTurns, 0, 0),
    noOverextensionTurns: finiteInt(value.noOverextensionTurns, 0, 0),
    turnEnds: finiteInt(value.turnEnds, 0, 0),
    cardsHeldAtRoost: finiteInt(value.cardsHeldAtRoost, 0, 0),
    unspentWingbeatAtRoost: finiteInt(value.unspentWingbeatAtRoost, 0, 0),
    maxCardsPlayedTurn: finiteInt(value.maxCardsPlayedTurn, 0, 0),
    waymarksAtStart: finiteInt(value.waymarksAtStart, 0, 0),
    waymarksAtEnd: finiteInt(value.waymarksAtEnd, 0, 0),
    surgesTriggered: finiteInt(value.surgesTriggered, 0, 0),
    blockedDamage: finiteInt(value.blockedDamage, 0, 0),
    invalidActions: finiteInt(value.invalidActions, 0, 0),
    cancelledActions: finiteInt(value.cancelledActions, 0, 0),
    bossEntryCohesion: Number.isFinite(value.bossEntryCohesion)
      ? finiteInt(value.bossEntryCohesion, 0, 0)
      : undefined,
    bossEntryScrap: Number.isFinite(value.bossEntryScrap)
      ? finiteInt(value.bossEntryScrap, 0, 0)
      : undefined
  };
}

function sanitizeCombatResults(value: unknown): CombatResultSummary[] {
  if (!Array.isArray(value)) return [];
  const objectiveTypes = new Set<EncounterObjective['type']>([
    'priority', 'preserve_flow', 'swift_clear', 'clean_roost',
    'finish_guarded', 'no_damage', 'trigger_surge', 'bank_wingbeat',
    'block_damage'
  ]);
  return value.filter(isRecord).flatMap((entry) => {
    if (typeof entry.nodeId !== 'string') return [];
    return [{
      encounterId: typeof entry.encounterId === 'string' ? entry.encounterId : '',
      nodeId: entry.nodeId,
      nodeType: validRouteNodeType(entry.nodeType) ? entry.nodeType : 'street',
      enemyIds: stringArray(entry.enemyIds),
      turnsTaken: finiteInt(entry.turnsTaken, 0, 0),
      damageDealt: finiteInt(entry.damageDealt, 0, 0),
      cardContributions: sanitizeContributions(entry.cardContributions, id => Object.hasOwn(cardLibrary, id)),
      cohesionLost: finiteInt(entry.cohesionLost, 0, 0),
      killedByMove: typeof entry.killedByMove === 'string' ? entry.killedByMove : undefined,
      durationMs: finiteInt(entry.durationMs, 0, 0),
      damageTakenByMove: Array.isArray(entry.damageTakenByMove)
        ? entry.damageTakenByMove.filter(isRecord).flatMap((pressure) => (
            typeof pressure.enemyId === 'string'
            && typeof pressure.moveId === 'string'
            && typeof pressure.moveLabel === 'string'
              ? [{
                  enemyId: pressure.enemyId,
                  moveId: pressure.moveId,
                  moveLabel: pressure.moveLabel,
                  damageTaken: finiteInt(pressure.damageTaken, 0, 0),
                  blockedDamage: finiteInt(pressure.blockedDamage, 0, 0),
                  hitCount: finiteInt(pressure.hitCount, 0, 0)
                }]
              : []
          ))
        : [],
      objective: isRecord(entry.objective)
        && objectiveTypes.has(entry.objective.type as EncounterObjective['type'])
        && typeof entry.objective.title === 'string'
        && (entry.objective.status === 'active' || entry.objective.status === 'complete' || entry.objective.status === 'failed')
        ? {
            type: entry.objective.type as EncounterObjective['type'],
            title: entry.objective.title,
            status: entry.objective.status,
            bonusScrap: finiteInt(entry.objective.bonusScrap, 0, 0)
          }
        : undefined,
      decisionStats: sanitizeCombatDecisionStats(entry.decisionStats)
    }];
  });
}


function sanitizeDistrictContracts(value: unknown): DistrictContractState[] {
  if (!Array.isArray(value)) return [];
  const validIds = new Set<DistrictContractId>(['hold_line', 'clean_flight', 'bright_signal', 'lean_route']);
  return value.filter(isRecord).flatMap((entry) => {
    if (!validIds.has(entry.id as DistrictContractId)) return [];
    return [{
      mapIndex: finiteInt(entry.mapIndex, 0, 0, alphaMaps.length - 1),
      id: entry.id as DistrictContractId,
      baselineCombatResults: finiteInt(entry.baselineCombatResults, 0, 0),
      baselineRewardEvents: finiteInt(entry.baselineRewardEvents, 0, 0),
      baselineSnags: finiteInt(entry.baselineSnags, 0, 0),
      confirmed: entry.confirmed !== false,
      completed: entry.completed === true,
      rewardClaimed: entry.rewardClaimed === true,
      celebrated: entry.celebrated === true
    }];
  });
}

export function sanitizeActiveRun(value: unknown): RunState | undefined {
  if (!isRecord(value) || !Array.isArray(value.deck)) return undefined;
  const pendingCardClaims = sanitizeCardClaims(value.pendingCardClaims, id => !!cardLibrary[id]);
  if (!pendingCardClaims) return undefined;
  const deck = canonicalSavedCards(value.deck.filter(isRecord).flatMap((entry) => {
    if (typeof entry.id !== 'string' || !cardLibrary[entry.id]) return [];
    return [{ id: entry.id, upgraded: entry.upgraded === true, preenBranch: validBranch(entry.id, entry.preenBranch) }];
  }));
  if (deck.length === 0) return undefined;
  const seed = typeof value.seed === 'string' && value.seed.length ? value.seed : 'alpha';
  const mapIndex = finiteInt(value.mapIndex, 0, 0, alphaMaps.length - 1);
  const pendingCombatReward = sanitizeRewardCheckpoint(value.pendingCombatReward,
    id => Boolean(cardLibrary[id]), id => alphaRouteMarkLibrary.has(id));
  // A damaged reward transaction is not an ordinary route save: fall back to
  // the journal instead of silently discarding a committed decision.
  if (value.pendingCombatReward !== undefined && !pendingCombatReward) return undefined;
  if (pendingCombatReward && !generatedMapFor(seed, mapIndex, normalizeFlyway(value.flyway).routeRhythm === 1).nodes.some(node =>
    node.id === pendingCombatReward.nodeId && ['street', 'rival', 'boss'].includes(node.type))) return undefined;
  if (pendingCombatReward?.stage === 'upgradeReward'
    && !pendingCombatReward.choices.every(id => deck.some(card => card.id === id && !card.upgraded))) return undefined;
  const leaderId = typeof value.leaderId === 'string' && flockLeaders.some((leader) => leader.id === value.leaderId)
    ? value.leaderId
    : defaultLeaderId;
  return {
    deck,
    flyway: normalizeFlyway(value.flyway),
    leaderId,
    pendingCardClaims: pendingCardClaims.length ? pendingCardClaims : undefined,
    cardClaimSequence: finiteInt(value.cardClaimSequence, 0, 0),
    difficulty: finiteInt(value.difficulty, 0, 0, MAX_DIFFICULTY),
    runMode: value.runMode === 'quick' ? 'quick' : 'full',
    seed,
    currentHp: finiteInt(value.currentHp, BASE_COHESION, 1),
    scrap: finiteInt(value.scrap, STARTING_SCRAP, 0),
    scrapEarned: finiteInt(value.scrapEarned, 0, 0),
    scrapSpent: finiteInt(value.scrapSpent, 0, 0),
    startedAtMs: finiteInt(value.startedAtMs, Date.now(), 0),
    seenEnemyMoves: stringArray(value.seenEnemyMoves),
    districtContracts: sanitizeDistrictContracts(value.districtContracts),
    routeMarks: stringArray(value.routeMarks).filter((id) => alphaRouteMarkLibrary.has(id)),
    supplies: stringArray(value.supplies).filter((id) => alphaSupplyLibrary.has(id)),
    supplySlots: finiteInt(value.supplySlots, BASE_SUPPLY_SLOTS, BASE_SUPPLY_SLOTS),
    mapIndex,
    completedRouteNodeIds: stringArray(value.completedRouteNodeIds),
    currentRouteNodeId: typeof value.currentRouteNodeId === 'string' ? value.currentRouteNodeId : undefined,
    routeLog: stringArray(value.routeLog).slice(-8),
    nextCombat: sanitizeNextCombat(value.nextCombat),
    signalChoices: sanitizeSignalChoices(value.signalChoices),
    rewardEvents: sanitizeRewardEvents(value.rewardEvents),
    routeDecisions: sanitizeRouteDecisions(value.routeDecisions),
    suppliesUsed: stringArray(value.suppliesUsed).filter((id) => alphaSupplyLibrary.has(id)),
    combatResults: sanitizeCombatResults(value.combatResults),
    freePreenNextDistrict: finiteInt(value.freePreenNextDistrict, 0, 0),
    pendingDistrictPreens: finiteInt(value.pendingDistrictPreens, 0, 0),
    pendingCombatReward,
  };
}

// Migrates older checkpoints; a checkpoint from a newer build is left in
// storage untouched and reads as no run (see futureActiveRunVersion).
export function loadActiveRun(): RunState | undefined {
  const checkpoint = readActiveRunCheckpoint(sanitizeActiveRun);
  return checkpoint.status === 'ok' ? checkpoint.run : undefined;
}

// Save version of a stored checkpoint written by a newer build, if any.
export function futureActiveRunVersion(): number | undefined {
  const checkpoint = readActiveRunCheckpoint(sanitizeActiveRun);
  return checkpoint.status === 'future-version' ? checkpoint.version : undefined;
}

export function clearActiveRun(): void {
  removeJournaledJson(ACTIVE_RUN_KEY);
}

export function hasActiveRun(): boolean {
  return loadActiveRun() !== undefined;
}


// Highest difficulty tier the player has unlocked (beat tier N -> unlock N+1).
const MAX_TIER_KEY = 'birdsquad.maxTier';

export function getMaxUnlockedTier(): number {
  const stored = Number(safeStorageGet(MAX_TIER_KEY) ?? '0') || 0;
  const account = loadAccount();
  const accountTier = account.bestWinTier >= 0 ? account.bestWinTier + 1 : 0;
  return Math.max(0, Math.min(MAX_DIFFICULTY, Math.max(stored, accountTier)));
}

function unlockTier(tier: number): void {
  const next = Math.min(MAX_DIFFICULTY, tier);
  if (next > getMaxUnlockedTier()) safeStorageSet(MAX_TIER_KEY, String(next));
}


let cardInstanceCounter = 0;

function nextCardInstanceId(cardId: string): string {
  cardInstanceCounter += 1;
  return `${cardId}#${cardInstanceCounter}`;
}


// Every cloned card gets a unique per-combat instance id so two copies of the
// same card are distinguishable in hand (next-level-data-contracts Phase 4 /
// Â§11a - per-combat instance identity).
export function cloneCard(id: string): Card {
  const template = cardLibrary[id];
  if (!template) throw new Error(`Unknown card id: ${id}`);
  return { ...template, instanceId: nextCardInstanceId(id) };
}


export function createInitialRunState(
  leaderId?: string,
  difficulty = 0,
  runMode: RunMode = 'full',
  seed = Math.random().toString(36).slice(2, 10),
  folioCards?: readonly SavedCard[],
): RunState {
  const leader = getLeader(leaderId);
  const deck = folioCards
    ? canonicalSavedCards(folioCards)
    : leader.startingDeckIds.map((id) => ({ id }));
  if (!folioCards) recordCardAcquisitions(leader.startingDeckIds, 'starter_flock');
  return {
    deck,
    flyway: { ...newFlywayState(), routeRhythm: 1 },
    leaderId: leader.id,
    difficulty,
    runMode,
    seed,
    currentHp: BASE_COHESION + (aggregateFlockStats(cardsFromSave(deck)).cohesion ?? 0),
    scrap: STARTING_SCRAP,
    scrapEarned: 0,
    scrapSpent: 0,
    startedAtMs: Date.now(),
    seenEnemyMoves: [],
    districtContracts: [],
    routeMarks: [],
    supplies: [],
    supplySlots: BASE_SUPPLY_SLOTS,
    mapIndex: 0,
    completedRouteNodeIds: [],
    currentRouteNodeId: undefined,
    routeLog: ['The flock gathers at Rooftop Blocks.'],
    nextCombat: undefined,
    signalChoices: [],
    rewardEvents: [],
    routeDecisions: [],
    suppliesUsed: [],
    combatResults: [],
    freePreenNextDistrict: 0,
    pendingDistrictPreens: 0,
    districtAdvanceNotice: undefined
  };
}


export function cloneRunState(runState: RunState): RunState {
  return {
    flyway: normalizeFlyway(runState.flyway),
    pendingCardClaims: runState.pendingCardClaims?.map(claim => ({ ...claim })),
    cardClaimSequence: runState.cardClaimSequence,
    pendingCombatReward: cloneRewardCheckpoint(runState.pendingCombatReward),
    deck: runState.deck.map((card) => ({ ...card })),
    leaderId: runState.leaderId,
    difficulty: runState.difficulty ?? 0,
    runMode: runState.runMode ?? 'full',
    seed: runState.seed,
    currentHp: runState.currentHp,
    scrap: runState.scrap ?? STARTING_SCRAP,
    scrapEarned: runState.scrapEarned ?? 0,
    scrapSpent: runState.scrapSpent ?? 0,
    startedAtMs: runState.startedAtMs ?? Date.now(),
    seenEnemyMoves: [...(runState.seenEnemyMoves ?? [])],
    districtContracts: (runState.districtContracts ?? []).map((contract) => ({ ...contract })),
    routeMarks: [...(runState.routeMarks ?? [])],
    supplies: [...(runState.supplies ?? [])],
    supplySlots: runSupplyCapacity(runState),
    mapIndex: runState.mapIndex ?? 0,
    completedRouteNodeIds: [...runState.completedRouteNodeIds],
    currentRouteNodeId: runState.currentRouteNodeId,
    routeLog: [...runState.routeLog],
    nextCombat: runState.nextCombat ? { ...runState.nextCombat } : undefined,
    signalChoices: (runState.signalChoices ?? []).map((entry) => ({ ...entry })),
    rewardEvents: (runState.rewardEvents ?? []).map((entry) => ({ ...entry, offered: [...entry.offered] })),
    routeDecisions: (runState.routeDecisions ?? []).map((entry) => ({ ...entry, offered: [...entry.offered] })),
    suppliesUsed: [...(runState.suppliesUsed ?? [])],
    combatResults: (runState.combatResults ?? []).map((entry) => ({
      ...entry,
      enemyIds: [...entry.enemyIds],
      cardContributions: entry.cardContributions?.map(row => ({ ...row })),
      damageTakenByMove: entry.damageTakenByMove?.map((pressure) => ({ ...pressure })),
      decisionStats: entry.decisionStats ? { ...entry.decisionStats } : undefined
    })),
    freePreenNextDistrict: runState.freePreenNextDistrict ?? 0,
    pendingDistrictPreens: runState.pendingDistrictPreens ?? 0,
    districtAdvanceNotice: runState.districtAdvanceNotice ? { ...runState.districtAdvanceNotice } : undefined
  };
}


function canonicalSavedCards(savedCards: readonly SavedCard[]): SavedCard[] {
  const byId = new Map<string, SavedCard>();
  savedCards.forEach((saved) => {
    if (!cardLibrary[saved.id]) return;
    const existing = byId.get(saved.id);
    if (!existing) {
      byId.set(saved.id, { id: saved.id, upgraded: saved.upgraded === true, preenBranch: validBranch(saved.id, saved.preenBranch) });
    } else if (saved.upgraded === true && !existing.upgraded) {
      existing.upgraded = true;
      existing.preenBranch = validBranch(saved.id, saved.preenBranch);
    }
  });
  return [...byId.values()];
}


export function cardsFromSave(savedCards: readonly SavedCard[]): Card[] {
  return canonicalSavedCards(savedCards).map((saved) => {
    const card = cloneCard(saved.id);
    card.upgraded = saved.upgraded;
    card.preenBranch = validBranch(saved.id, saved.preenBranch);
    if (card.preenBranch) {
      card.runtime = { ...card.runtime, upgrade: branchUpgrade(card.runtime, card.preenBranch) };
      card.upgradedText = formatEffects(card.runtime.upgrade.effects);
      card.moltTextUpgraded = formatEffects(card.runtime.upgrade.moltEffects ?? []);
    }
    if (card.upgraded) card.cost = card.runtime.upgrade.cost ?? card.runtime.cost;
    return card;
  });
}


export function saveCards(cards: readonly Card[]): SavedCard[] {
  return canonicalSavedCards(cards.map((card) => ({ id: card.id, upgraded: card.upgraded, preenBranch: card.preenBranch })));
}


export function createCardTemplate(runtime: RuntimeCard): Card {
  const heldText = runtime.heldEffects?.length ? `Roost: ${formatEffects(runtime.heldEffects)}` : '';
  const baseText = formatEffects(runtime.effects);
  return {
    instanceId: '',
    id: runtime.id,
    name: runtime.displayName,
    type: runtime.id.startsWith('aviary_') ? 'aviary' : runtime.kind === 'legend' ? 'major' : runtime.kind === 'molt' ? 'molt' : 'minor',
    role: runtime.tags.includes('attack') ? 'attack' : runtime.tags.some((tag) => ['cover', 'heal'].includes(tag)) ? 'skill' : 'utility',
    target: runtime.target,
    cost: runtime.cost,
    text: heldText ? `${baseText} ${heldText}` : baseText,
    upgradedText: heldText ? `${formatEffects(runtime.upgrade.effects)} ${heldText}` : formatEffects(runtime.upgrade.effects),
    heldText,
    moltText: runtime.moltEffects?.length ? formatEffects(runtime.moltEffects) : '',
    moltTextUpgraded: runtime.upgrade.moltEffects?.length ? formatEffects(runtime.upgrade.moltEffects) : '',
    bird: runtime.bird,
    runtime
  };
}


export function shuffle<T>(items: T[], random: () => number = Math.random) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
