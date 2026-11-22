import { hashSeed } from '../route-gen';
import { readJournaledJson, writeJournaledJson } from '../safe-storage';

/**
 * Daily Flight: one seed per local calendar date, the same for every player
 * on that date, with a Leader chosen from the seed. Local only: bests are
 * kept in this browser's storage and nothing is sent anywhere.
 */

const SEED_PREFIX = 'daily-';
const STORE_KEY = 'birdsquad.daily';
const MAX_DATES = 60;
const MAX_RUN_IDS = 120;

/** Local calendar date as `YYYY-MM-DD`. */
export function dailyDateKey(date: Date = new Date()): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

/** `daily-20261120`: valid as a shared-route seed, so a link can carry it. */
export function dailySeed(dateKey: string): string {
  return `${SEED_PREFIX}${dateKey.replace(/-/g, '')}`;
}

export function dailyDateFromSeed(seed: unknown): string | undefined {
  const match = typeof seed === 'string' ? /^daily-(\d{4})(\d{2})(\d{2})$/.exec(seed) : null;
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}

/** The day's Leader. Every Leader is eligible, locked or not, so the day is the same for everyone. */
export function dailyLeaderId(seed: string, leaderIds: readonly string[]): string {
  return leaderIds[hashSeed(seed, 0x1eade7) % leaderIds.length];
}

/** `Fri, Nov 20` for a date key, without depending on the runtime's locale. */
export function dailyDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

export interface DailyBest {
  date: string;
  score: number;
  districts: number;
  districtTotal: number;
  result: 'win' | 'loss';
  leaderId: string;
  /** Finished attempts on this date's seed. */
  attempts: number;
}

export interface DailyStore {
  bests: DailyBest[];
  /** Finished run ids already counted, so re-reading the flight log never double counts. */
  runIds: string[];
}

export interface DailyResult {
  runId: string;
  seed: string;
  score: number;
  districts: number;
  districtTotal: number;
  result: 'win' | 'loss';
  leaderId: string;
}

export const emptyDailyStore = (): DailyStore => ({ bests: [], runIds: [] });

const whole = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

export function sanitizeDailyStore(value: unknown): DailyStore | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as { bests?: unknown; runIds?: unknown };
  const byDate = new Map<string, DailyBest>();
  for (const entry of Array.isArray(raw.bests) ? raw.bests : []) {
    if (!entry || typeof entry !== 'object') continue;
    const best = entry as Partial<DailyBest>;
    if (typeof best.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(best.date)) continue;
    if (best.result !== 'win' && best.result !== 'loss') continue;
    byDate.set(best.date, {
      date: best.date,
      score: whole(best.score),
      districts: whole(best.districts),
      districtTotal: Math.max(1, whole(best.districtTotal)),
      result: best.result,
      leaderId: typeof best.leaderId === 'string' ? best.leaderId.slice(0, 64) : '',
      attempts: Math.max(1, whole(best.attempts)),
    });
  }
  return {
    bests: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_DATES),
    runIds: (Array.isArray(raw.runIds) ? raw.runIds : [])
      .filter((id): id is string => typeof id === 'string' && id.length <= 128).slice(-MAX_RUN_IDS),
  };
}

/** Count one finished flight. Returns the same store when it is not a daily run or was already counted. */
export function recordDailyResult(store: DailyStore, result: DailyResult): DailyStore {
  const date = dailyDateFromSeed(result.seed);
  if (!date || store.runIds.includes(result.runId)) return store;
  const prior = store.bests.find((best) => best.date === date);
  // A higher score wins; a tie keeps the earlier flight.
  const better = !prior || result.score > prior.score;
  const next: DailyBest = better
    ? { date, score: whole(result.score), districts: whole(result.districts), districtTotal: Math.max(1, whole(result.districtTotal)),
        result: result.result, leaderId: result.leaderId, attempts: (prior?.attempts ?? 0) + 1 }
    : { ...prior, attempts: prior.attempts + 1 };
  return {
    bests: [...store.bests.filter((best) => best.date !== date), next]
      .sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_DATES),
    runIds: [...store.runIds, result.runId].slice(-MAX_RUN_IDS),
  };
}

export function dailyBestFor(store: DailyStore, dateKey: string): DailyBest | undefined {
  return store.bests.find((best) => best.date === dateKey);
}

/** Most recent first, leaving out `exceptDate` (today has its own line). */
export function dailyHistory(store: DailyStore, exceptDate?: string, limit = 5): DailyBest[] {
  return store.bests.filter((best) => best.date !== exceptDate).sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export function loadDailyStore(): DailyStore {
  return readJournaledJson(STORE_KEY, sanitizeDailyStore) ?? emptyDailyStore();
}

/**
 * Fold finished flights from the flight log into the store. The log is the
 * record of truth for what was flown; this is safe to call on every visit.
 */
export function syncDailyStore(results: readonly DailyResult[]): DailyStore {
  const before = loadDailyStore();
  const after = results.reduce(recordDailyResult, before);
  if (after !== before) writeJournaledJson(STORE_KEY, after);
  return after;
}
