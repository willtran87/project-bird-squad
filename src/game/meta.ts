import { flockLeaders } from './leaders';
import { MAX_DIFFICULTY } from './difficulty';
import { readJournaledJson, writeJournaledJson } from './safe-storage';
import type { SavedDeckRecord } from './saved-decks';

// Persistent player meta-progression: lifetime stats, achievements, and
// unlockable Flock Leaders. Stored in localStorage, updated on each finished run.

export type CardAcquisitionSource = 'starter_flock' | 'combat_reward' | 'route_reward' | 'market' | 'snag';
export type CardPersonalTag = 'staple' | 'experiment' | 'keepsake';

export interface CardCollectionRecord {
  timesClaimed: number;
  firstAcquiredAt: number;
  firstSource: CardAcquisitionSource;
  isNew?: true;
  targetCompletedAt?: number;
  targetSource?: CardAcquisitionSource;
}

export interface PlayerAccount {
  runs: number;
  wins: number;
  losses: number;
  winsByLeader: Record<string, number>;
  runsByLeader: Record<string, number>;
  bestWinTier: number; // highest Ascension tier cleared with a win (-1 = none)
  fastestWinTurns: number | null;
  unlockedLeaders: string[];
  achievements: string[];
  discoveredCards: string[]; // card ids the player has encountered (for the Codex)
  favoriteCards: string[]; // discovered cards the player has marked as personal favorites
  cardTags?: Partial<Record<string, CardPersonalTag>>; // private, non-power organization for discovered cards
  cardJournal?: Partial<Record<string, string>>; // sanitized at Codex and backup boundaries
  showcase?: string[]; // up to three discovered cards deliberately presented in Flock Record
  decks?: SavedDeckRecord[]; // capped, identity-focused snapshots of meaningful flight decks
  hunt?: string[]; // up to three discovered, uncollected cards the player is actively hunting
  cardCollection: Record<string, CardCollectionRecord>; // permanent claim history; playable copies remain run-specific
  observedEnemyMoves: string[]; // enemyId:moveId keys witnessed during combat
  contractBadges: string[];
  leaderProgress: Record<string, LeaderProgress>;
  leaderRecords: Record<string, LeaderPersonalRecords>;
}

export interface LeaderProgress {
  surges: number;
  cleanFights: number;
  swiftFights: number;
  blockedDamage: number;
  contracts: number;
}

export type RunRecordMode = 'full' | 'quick';

export interface FlightPersonalRecord {
  wins: number;
  fastestRunTurns: number | null;
}

export interface LeaderPersonalRecords {
  clears: Record<string, FlightPersonalRecord>;
}

export interface PersonalRecordUpdate {
  leaderId: string;
  mode: RunRecordMode;
  tier: number;
  turns: number;
  firstClear: boolean;
  newAscensionClear: boolean;
}

// A finished run, distilled to what meta-progression cares about.
export interface RunRecord {
  result: 'win' | 'loss';
  leaderId: string;
  difficulty: number;
  cohesion: number;
  maxCohesion: number;
  turns: number;
  runMode?: RunRecordMode;
  totalRunTurns?: number;
  deckSize: number;
  surgesTriggered?: number;
  cleanFights?: number;
  swiftFights?: number;
  blockedDamage?: number;
  completedContracts?: Array<{ mapIndex: number; id: string }>;
  observedEnemyMoves?: string[];
}

const ACCOUNT_KEY = 'birdsquad.account';
const STARTING_LEADERS = ['fledgling', 'spark_caller'];
const LEADER_IDS = new Set(flockLeaders.map((leader) => leader.id));

export function defaultAccount(): PlayerAccount {
  return {
    runs: 0, wins: 0, losses: 0, winsByLeader: {}, runsByLeader: {}, bestWinTier: -1,
    fastestWinTurns: null, unlockedLeaders: [...STARTING_LEADERS], achievements: [],
    discoveredCards: [], favoriteCards: [], cardCollection: {}, observedEnemyMoves: [], contractBadges: [], leaderProgress: {}, leaderRecords: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteInt(value: unknown, fallback = 0, min = 0) {
  return Number.isFinite(value) ? Math.max(min, Math.floor(value as number)) : fallback;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string'))]
    : [];
}

function countRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([id, count]) => LEADER_IDS.has(id) && Number.isFinite(count))
    .map(([id, count]) => [id, finiteInt(count)]));
}

function sanitizeCardCollection(value: unknown, discovered: string[]): Record<string, CardCollectionRecord> {
  if (!isRecord(value)) return {};
  for (const id in value) {
    const raw = value[id];
    if (!isRecord(raw) || !discovered.includes(id)) {
      delete value[id];
      continue;
    }
    const timesClaimed = finiteInt(raw.timesClaimed);
    if (timesClaimed) raw.timesClaimed = timesClaimed;
    else delete value[id];
  }
  return value as Record<string, CardCollectionRecord>;
}

function sanitizeLeaderRecords(value: unknown): Record<string, LeaderPersonalRecords> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([leaderId, rawRecord]) => {
    if (!LEADER_IDS.has(leaderId) || !isRecord(rawRecord) || !isRecord(rawRecord.clears)) return [];
    const clears = Object.fromEntries(Object.entries(rawRecord.clears).flatMap(([key, rawClear]) => {
      if (!/^(full|quick):[0-6]$/.test(key) || !isRecord(rawClear)) return [];
      const wins = finiteInt(rawClear.wins);
      if (!wins) return [];
      const fastestRunTurns = finiteInt(rawClear.fastestRunTurns, 0, 1) || null;
      return [[key, { wins, fastestRunTurns }]];
    }));
    return [[leaderId, { clears }]];
  }));
}

export function sanitizeAccount(value: unknown): PlayerAccount | undefined {
  if (!isRecord(value)) return undefined;
  const wins = finiteInt(value.wins);
  const losses = finiteInt(value.losses);
  const fastestWinTurns = finiteInt(value.fastestWinTurns, 0, 1) || null;
  const unlockedLeaders = stringList(value.unlockedLeaders).filter((id) => LEADER_IDS.has(id));
  const discoveredCards = stringList(value.discoveredCards);
  const cardCollection = sanitizeCardCollection(value.cardCollection, discoveredCards);
  const leaderProgress = isRecord(value.leaderProgress)
    ? Object.fromEntries(Object.entries(value.leaderProgress).flatMap(([id, progress]) => {
        if (!LEADER_IDS.has(id) || !isRecord(progress)) return [];
        return [[id, {
          surges: finiteInt(progress.surges),
          cleanFights: finiteInt(progress.cleanFights),
          swiftFights: finiteInt(progress.swiftFights),
          blockedDamage: finiteInt(progress.blockedDamage),
          contracts: finiteInt(progress.contracts),
        }]];
      }))
    : {};
  return {
    runs: Math.max(finiteInt(value.runs), wins + losses),
    wins,
    losses,
    winsByLeader: countRecord(value.winsByLeader),
    runsByLeader: countRecord(value.runsByLeader),
    bestWinTier: finiteInt(value.bestWinTier, -1, -1),
    fastestWinTurns,
    unlockedLeaders: [...new Set([...STARTING_LEADERS, ...unlockedLeaders])],
    achievements: stringList(value.achievements),
    discoveredCards,
    favoriteCards: stringList(value.favoriteCards).filter((id) => discoveredCards.includes(id)),
    cardTags: value.cardTags as Partial<Record<string, CardPersonalTag>>,
    cardJournal: value.cardJournal as Partial<Record<string, string>>,
    showcase: value.showcase as string[],
    // Flight Folios are fully sanitized at their route/profile/backup boundaries.
    decks: value.decks as SavedDeckRecord[],
    hunt: stringList(value.hunt).slice(0, 3),
    cardCollection,
    observedEnemyMoves: stringList(value.observedEnemyMoves),
    contractBadges: stringList(value.contractBadges),
    leaderProgress,
    leaderRecords: sanitizeLeaderRecords(value.leaderRecords),
  };
}

export function loadAccount(): PlayerAccount {
  return readJournaledJson(ACCOUNT_KEY, sanitizeAccount) || defaultAccount();
}

export function saveAccount(account: PlayerAccount): boolean {
  return writeJournaledJson(ACCOUNT_KEY, account);
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  check: (run: RunRecord, account: PlayerAccount) => boolean;
}

// Achievements are evaluated against the just-finished run + the post-update
// account, so e.g. "win with all leaders" sees the current run's win counted.
export const achievements: Achievement[] = [
  { id: 'first_flight', name: 'First Flight', desc: 'Win your first run.', check: (_r, a) => a.wins >= 1 },
  { id: 'full_aviary', name: 'The Full Aviary', desc: 'Win with all five Flock Leaders.', check: (_r, a) => Object.keys(a.winsByLeader).length >= flockLeaders.length },
  { id: 'ascended', name: 'Ascended', desc: 'Win at Ascension Tier 3 or higher.', check: (r) => r.result === 'win' && r.difficulty >= 3 },
  { id: 'summit', name: 'Summit Master', desc: 'Win at Ascension Tier 6.', check: (r) => r.result === 'win' && r.difficulty >= 6 },
  { id: 'iron_flock', name: 'Iron Flock', desc: 'Win with 30 or more Cohesion remaining.', check: (r) => r.result === 'win' && r.cohesion >= 30 },
  { id: 'swift_wings', name: 'Swift Wings', desc: 'Win a final fight in 5 beats or fewer.', check: (r) => r.result === 'win' && r.turns <= 5 },
  { id: 'lean_flock', name: 'Lean Flock', desc: 'Win with a deck of 12 cards or fewer.', check: (r) => r.result === 'win' && r.deckSize <= 12 },
  { id: 'grand_flock', name: 'Grand Flock', desc: 'Win with a deck of 22 cards or more.', check: (r) => r.result === 'win' && r.deckSize >= 22 },
  { id: 'live_wire', name: 'Live Wire', desc: 'Trigger 3 Surges in one flight.', check: (r) => (r.surgesTriggered ?? 0) >= 3 },
  { id: 'still_air', name: 'Still Air', desc: 'Clear 3 fights without losing Cohesion in one flight.', check: (r) => (r.cleanFights ?? 0) >= 3 },
  { id: 'brace_brigade', name: 'Brace Brigade', desc: 'Block 24 damage in one flight.', check: (r) => (r.blockedDamage ?? 0) >= 24 },
  { id: 'every_promise', name: 'Every Promise', desc: 'Complete 3 district contracts in one flight.', check: (r) => (r.completedContracts?.length ?? 0) >= 3 },
];

// Leader unlock rules — returns ids newly unlocked given the updated account.
function pendingLeaderUnlocks(account: PlayerAccount): string[] {
  const rules: Array<[string, boolean]> = [
    ['talon', account.wins >= 1],
    ['tidewarden', Object.keys(account.winsByLeader).length >= 2],
    ['roostkeeper', account.bestWinTier >= 1 || account.wins >= 3],
  ];
  return rules.filter(([id, ok]) => ok && !account.unlockedLeaders.includes(id)).map(([id]) => id);
}

export const leaderUnlockHints: Record<string, string> = {
  talon: 'Unlocks after your first win.',
  tidewarden: 'Unlocks after winning with 2 different Leaders.',
  roostkeeper: 'Unlocks after a Tier 1+ win (or 3 total wins).',
};

export interface LeaderMastery {
  level: number;
  title: string;
  current: number;
  target: number;
  nextGoal: string;
}

export function leaderMastery(account: PlayerAccount, leaderId: string): LeaderMastery {
  const runs = account.runsByLeader[leaderId] ?? 0;
  const wins = account.winsByLeader[leaderId] ?? 0;
  const progress = account.leaderProgress[leaderId] ?? {
    surges: 0, cleanFights: 0, swiftFights: 0, blockedDamage: 0, contracts: 0
  };
  if (!runs) return { level: 0, title: 'Unflown', current: runs, target: 1, nextGoal: 'Complete one run' };
  const specialty = leaderId === 'spark_caller'
    ? { current: progress.surges, target: 6, goal: 'Trigger six Surges' }
    : leaderId === 'talon'
      ? { current: progress.swiftFights, target: 3, goal: 'Win three fights by Beat 3' }
      : leaderId === 'tidewarden'
        ? { current: progress.cleanFights, target: 4, goal: 'Clear four fights without Cohesion loss' }
        : leaderId === 'roostkeeper'
          ? { current: progress.blockedDamage, target: 40, goal: 'Block 40 damage' }
          : { current: progress.contracts, target: 2, goal: 'Complete two district contracts' };
  if (specialty.current < specialty.target) {
    return { level: 1, title: 'Flight Craft', current: specialty.current, target: specialty.target, nextGoal: specialty.goal };
  }
  if (wins < 3) return { level: 2, title: 'Route Reader', current: wins, target: 3, nextGoal: 'Win three runs' };
  if (wins < 7) return { level: 3, title: 'District Hand', current: wins, target: 7, nextGoal: 'Win seven runs' };
  return { level: 4, title: 'Roofline Ace', current: wins, target: wins, nextGoal: 'Set a new personal record' };
}

// Update the account from a finished run. Returns the new account plus anything
// freshly unlocked (so the post-run screen can celebrate it).
export function recordRun(record: RunRecord): { account: PlayerAccount; newLeaders: string[]; newAchievements: string[]; newContractBadges: string[]; newEnemyMoves: string[]; newPersonalRecords: PersonalRecordUpdate[] } {
  const account = loadAccount();
  const newPersonalRecords: PersonalRecordUpdate[] = [];
  account.runs += 1;
  account.runsByLeader[record.leaderId] = (account.runsByLeader[record.leaderId] ?? 0) + 1;
  if (record.result === 'win') {
    account.wins += 1;
    account.winsByLeader[record.leaderId] = (account.winsByLeader[record.leaderId] ?? 0) + 1;
    account.bestWinTier = Math.max(account.bestWinTier, record.difficulty);
    account.fastestWinTurns = account.fastestWinTurns === null ? record.turns : Math.min(account.fastestWinTurns, record.turns);
    const mode = record.runMode || 'full';
    const tier = Math.max(0, Math.min(MAX_DIFFICULTY, finiteInt(record.difficulty)));
    const totalRunTurns = finiteInt(record.totalRunTurns, finiteInt(record.turns, 1, 1), 1);
    const key = `${mode}:${tier}`;
    const leaderRecord = account.leaderRecords[record.leaderId] || { clears: {} };
    const beforeBestFullWinTier = Math.max(-1, ...Object.keys(leaderRecord.clears)
      .filter((recordKey) => recordKey.startsWith('full:'))
      .map((recordKey) => Number(recordKey.slice(5))));
    const prior = leaderRecord.clears[key] || { wins: 0, fastestRunTurns: null };
    const firstClear = prior.wins === 0;
    const fasterClear = prior.fastestRunTurns === null || totalRunTurns < prior.fastestRunTurns;
    leaderRecord.clears[key] = {
      wins: prior.wins + 1,
      fastestRunTurns: fasterClear ? totalRunTurns : prior.fastestRunTurns,
    };
    account.leaderRecords[record.leaderId] = leaderRecord;
    if (firstClear || fasterClear) {
      newPersonalRecords.push({
        leaderId: record.leaderId,
        mode,
        tier,
        turns: totalRunTurns,
        firstClear,
        newAscensionClear: mode === 'full' && tier > beforeBestFullWinTier,
      });
    }
  } else {
    account.losses += 1;
  }
  const progress = account.leaderProgress[record.leaderId] || {
    surges: 0, cleanFights: 0, swiftFights: 0, blockedDamage: 0, contracts: 0
  };
  progress.surges += record.surgesTriggered ?? 0;
  progress.cleanFights += record.cleanFights ?? 0;
  progress.swiftFights += record.swiftFights ?? 0;
  progress.blockedDamage += record.blockedDamage ?? 0;
  progress.contracts += record.completedContracts?.length ?? 0;
  account.leaderProgress[record.leaderId] = progress;
  const knownContractBadges = new Set(account.contractBadges);
  const newContractBadges = (record.completedContracts ?? [])
    .map((contract) => `${contract.mapIndex}:${contract.id}`)
    .filter((badge) => !knownContractBadges.has(badge));
  account.contractBadges.push(...newContractBadges);
  const knownEnemyMoves = new Set(account.observedEnemyMoves);
  const newEnemyMoves = [...new Set(record.observedEnemyMoves ?? [])]
    .filter((moveKey) => !knownEnemyMoves.has(moveKey));
  account.observedEnemyMoves.push(...newEnemyMoves);
  const newAchievements = achievements
    .filter((ach) => !account.achievements.includes(ach.id) && ach.check(record, account))
    .map((ach) => ach.id);
  account.achievements.push(...newAchievements);
  const newLeaders = pendingLeaderUnlocks(account);
  account.unlockedLeaders.push(...newLeaders);
  saveAccount(account);
  return { account, newLeaders, newAchievements, newContractBadges, newEnemyMoves, newPersonalRecords };
}

export function isLeaderUnlocked(account: PlayerAccount, id: string): boolean {
  return account.unlockedLeaders.includes(id);
}

// Mark cards as encountered (seen in a starting deck or offered/added in a run)
// so they appear in the Codex. Returns the count newly discovered.
export function discoverCards(ids: string[]): number {
  const account = loadAccount();
  const known = new Set(account.discoveredCards);
  let added = 0;
  for (const id of ids) {
    if (id && !known.has(id)) { known.add(id); added += 1; }
  }
  if (added) {
    account.discoveredCards = [...known];
    saveAccount(account);
  }
  return added;
}
