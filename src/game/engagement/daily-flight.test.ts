import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setMemoryStorageSession } from '../safe-storage';
import {
  dailyBestFor, dailyDateFromSeed, dailyDateKey, dailyDateLabel, dailyHistory, dailyLeaderId, dailySeed,
  emptyDailyStore, loadDailyStore, recordDailyResult, sanitizeDailyStore, syncDailyStore, type DailyResult,
} from './daily-flight';

const leaders = ['fledgling', 'spark_caller', 'talon', 'tidewarden', 'roostkeeper'];

function result(over: Partial<DailyResult> = {}): DailyResult {
  return { runId: 'run-1', seed: 'daily-20261120', score: 3000, districts: 2, districtTotal: 4, result: 'loss', leaderId: 'talon', ...over };
}

describe('daily seed', () => {
  it('uses the local calendar date', () => {
    expect(dailyDateKey(new Date(2026, 10, 20, 23, 59))).toBe('2026-11-20');
    expect(dailyDateKey(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
    expect(dailyDateKey(new Date(2026, 10, 21, 0, 0))).toBe('2026-11-21');
  });

  it('gives everyone the same seed for a date, and a shareable one', () => {
    expect(dailySeed('2026-11-20')).toBe('daily-20261120');
    expect(dailySeed(dailyDateKey(new Date(2026, 10, 20, 1)))).toBe(dailySeed(dailyDateKey(new Date(2026, 10, 20, 22))));
    // Shared-route links accept this shape (see session-config.ts).
    expect(dailySeed('2026-11-20')).toMatch(/^[a-z0-9_-]{1,32}$/i);
    expect(dailyDateFromSeed('daily-20261120')).toBe('2026-11-20');
    for (const seed of ['alpha', 'daily-2026112', 'daily-20261120x', '', undefined, 7]) expect(dailyDateFromSeed(seed)).toBeUndefined();
  });

  it('fixes one Leader per day and uses the whole roster over time', () => {
    expect(dailyLeaderId('daily-20261120', leaders)).toBe(dailyLeaderId('daily-20261120', leaders));
    const picked = new Set<string>();
    for (let day = 1; day <= 60; day += 1) {
      const id = dailyLeaderId(dailySeed(dailyDateKey(new Date(2026, 0, day))), leaders);
      expect(leaders).toContain(id);
      picked.add(id);
    }
    expect(picked.size).toBe(leaders.length);
  });

  it('labels dates without a locale', () => {
    expect(dailyDateLabel('2026-11-20')).toBe('Fri, Nov 20');
    expect(dailyDateLabel('2027-01-01')).toBe('Fri, Jan 1');
  });
});

describe('daily bests', () => {
  it('keeps the best score per date and counts every attempt once', () => {
    let store = recordDailyResult(emptyDailyStore(), result());
    store = recordDailyResult(store, result({ runId: 'run-2', score: 8000, districts: 4, result: 'win' }));
    store = recordDailyResult(store, result({ runId: 'run-3', score: 1000, districts: 1 }));
    expect(dailyBestFor(store, '2026-11-20')).toEqual({
      date: '2026-11-20', score: 8000, districts: 4, districtTotal: 4, result: 'win', leaderId: 'talon', attempts: 3,
    });
    // The same finished run read again from the flight log changes nothing.
    expect(recordDailyResult(store, result({ runId: 'run-2', score: 99999 }))).toBe(store);
  });

  it('keeps the earlier flight on a tie and ignores flights that are not daily', () => {
    let store = recordDailyResult(emptyDailyStore(), result({ leaderId: 'talon' }));
    store = recordDailyResult(store, result({ runId: 'run-2', leaderId: 'fledgling' }));
    expect(dailyBestFor(store, '2026-11-20')).toMatchObject({ leaderId: 'talon', attempts: 2 });
    expect(recordDailyResult(store, result({ runId: 'run-9', seed: 'alpha' }))).toBe(store);
  });

  it('lists earlier days newest first, without today', () => {
    let store = emptyDailyStore();
    for (const day of [16, 17, 18, 19, 20]) store = recordDailyResult(store, result({ runId: `run-${day}`, seed: `daily-202611${day}`, score: day * 100 }));
    expect(dailyHistory(store, '2026-11-20', 3).map((best) => best.date)).toEqual(['2026-11-19', '2026-11-18', '2026-11-17']);
    expect(dailyBestFor(store, '2026-11-21')).toBeUndefined();
  });

  it('keeps a bounded number of dates and run ids', () => {
    let store = emptyDailyStore();
    for (let day = 0; day < 200; day += 1) {
      const date = new Date(2026, 0, 1 + day);
      store = recordDailyResult(store, result({ runId: `run-${day}`, seed: dailySeed(dailyDateKey(date)) }));
    }
    expect(store.bests).toHaveLength(60);
    expect(store.runIds).toHaveLength(120);
    expect(store.bests.at(-1)?.date).toBe(dailyDateKey(new Date(2026, 0, 200)));
  });

  it('repairs stored data and rejects anything that is not a store', () => {
    expect(sanitizeDailyStore(null)).toBeUndefined();
    expect(sanitizeDailyStore('daily')).toBeUndefined();
    const clean = sanitizeDailyStore({
      bests: [
        { date: '2026-11-20', score: 5000.9, districts: 3, districtTotal: 4, result: 'loss', leaderId: 'talon', attempts: 2 },
        { date: 'yesterday', score: 1, result: 'win' },
        { date: '2026-11-19', score: -4, districts: 'x', districtTotal: 0, result: 'win', leaderId: 9, attempts: 0 },
        { date: '2026-11-18', score: 10, result: 'draw' },
        null,
      ],
      runIds: ['run-1', 4, 'x'.repeat(200)],
    });
    expect(clean).toEqual({
      bests: [
        { date: '2026-11-19', score: 0, districts: 0, districtTotal: 1, result: 'win', leaderId: '', attempts: 1 },
        { date: '2026-11-20', score: 5000, districts: 3, districtTotal: 4, result: 'loss', leaderId: 'talon', attempts: 2 },
      ],
      runIds: ['run-1'],
    });
  });
});

describe('daily store persistence', () => {
  let memory: Map<string, string>;
  beforeEach(() => {
    memory = new Map<string, string>();
    setMemoryStorageSession({
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => { memory.set(key, value); },
      removeItem: (key) => { memory.delete(key); },
    });
  });
  afterEach(() => setMemoryStorageSession(undefined));

  it('folds the flight log in through safe storage and is idempotent', () => {
    expect(loadDailyStore()).toEqual(emptyDailyStore());
    const log = [result(), result({ runId: 'run-2', score: 7000, result: 'win', districts: 4 }), result({ runId: 'run-3', seed: 'alpha' })];
    expect(dailyBestFor(syncDailyStore(log), '2026-11-20')).toMatchObject({ score: 7000, attempts: 2 });
    expect(memory.has('birdsquad.daily')).toBe(true);
    const stored = memory.get('birdsquad.daily');
    expect(dailyBestFor(syncDailyStore(log), '2026-11-20')).toMatchObject({ score: 7000, attempts: 2 });
    expect(memory.get('birdsquad.daily')).toBe(stored);
    expect(loadDailyStore().runIds).toEqual(['run-1', 'run-2']);
  });

  it('writes nothing when there is nothing to record', () => {
    syncDailyStore([result({ seed: 'alpha' })]);
    expect(memory.size).toBe(0);
  });
});
