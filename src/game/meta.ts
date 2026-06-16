import { flockLeaders } from './leaders';

// Persistent player meta-progression: lifetime stats, achievements, and
// unlockable Flock Leaders. Stored in localStorage, updated on each finished run.

export interface PlayerAccount {
  runs: number;
  wins: number;
  losses: number;
  winsByLeader: Record<string, number>;
  bestWinTier: number; // highest Ascension tier cleared with a win (-1 = none)
  fastestWinTurns: number | null;
  unlockedLeaders: string[];
  achievements: string[];
  discoveredCards: string[]; // card ids the player has encountered (for the Codex)
}

// A finished run, distilled to what meta-progression cares about.
export interface RunRecord {
  result: 'win' | 'loss';
  leaderId: string;
  difficulty: number;
  cohesion: number;
  maxCohesion: number;
  turns: number;
  deckSize: number;
}

const ACCOUNT_KEY = 'birdsquad.account';
const STARTING_LEADERS = ['fledgling', 'spark_caller'];

export function defaultAccount(): PlayerAccount {
  return {
    runs: 0, wins: 0, losses: 0, winsByLeader: {}, bestWinTier: -1,
    fastestWinTurns: null, unlockedLeaders: [...STARTING_LEADERS], achievements: [],
    discoveredCards: [],
  };
}

export function loadAccount(): PlayerAccount {
  try {
    const raw = window.localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return defaultAccount();
    const parsed = JSON.parse(raw) as Partial<PlayerAccount>;
    const base = defaultAccount();
    return {
      ...base,
      ...parsed,
      winsByLeader: { ...(parsed.winsByLeader ?? {}) },
      unlockedLeaders: [...new Set([...STARTING_LEADERS, ...(parsed.unlockedLeaders ?? [])])],
      achievements: [...(parsed.achievements ?? [])],
      discoveredCards: [...new Set(parsed.discoveredCards ?? [])],
    };
  } catch {
    return defaultAccount();
  }
}

function saveAccount(account: PlayerAccount): void {
  try {
    window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  } catch {
    /* storage unavailable — best effort */
  }
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

// Update the account from a finished run. Returns the new account plus anything
// freshly unlocked (so the post-run screen can celebrate it).
export function recordRun(record: RunRecord): { account: PlayerAccount; newLeaders: string[]; newAchievements: string[] } {
  const account = loadAccount();
  account.runs += 1;
  if (record.result === 'win') {
    account.wins += 1;
    account.winsByLeader[record.leaderId] = (account.winsByLeader[record.leaderId] ?? 0) + 1;
    account.bestWinTier = Math.max(account.bestWinTier, record.difficulty);
    account.fastestWinTurns = account.fastestWinTurns === null ? record.turns : Math.min(account.fastestWinTurns, record.turns);
  } else {
    account.losses += 1;
  }
  const newAchievements = achievements
    .filter((ach) => !account.achievements.includes(ach.id) && ach.check(record, account))
    .map((ach) => ach.id);
  account.achievements.push(...newAchievements);
  const newLeaders = pendingLeaderUnlocks(account);
  account.unlockedLeaders.push(...newLeaders);
  saveAccount(account);
  return { account, newLeaders, newAchievements };
}

export function isLeaderUnlocked(account: PlayerAccount, id: string): boolean {
  return account.unlockedLeaders.includes(id);
}

// Mark cards as encountered (seen in a starting deck or offered/added in a run)
// so they appear in the Codex. Returns the count newly discovered.
export function discoverCards(ids: string[]): number {
  if (ids.length === 0) return 0;
  const account = loadAccount();
  const known = new Set(account.discoveredCards);
  let added = 0;
  for (const id of ids) {
    if (id && !known.has(id)) { known.add(id); added += 1; }
  }
  if (added > 0) {
    account.discoveredCards = [...known];
    saveAccount(account);
  }
  return added;
}
