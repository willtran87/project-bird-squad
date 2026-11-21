import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CEREMONY_KEY, queueCeremony } from '../ceremony-queue';
import { loadAccount, recordRun } from '../meta';
import { setMemoryStorageSession } from '../safe-storage';
import { MAX_QUEUE, buildReveals, parseQueue, retire, serializeQueue, staleEntries, type RevealLookups } from './ceremony-reveals';

const lookups: RevealLookups = {
  leader: (id) => ({ talon: { name: 'The Talon', unlock: 'Unlocked: your first win.' }, heron: { name: 'The Tidewarden' } })[id],
  achievement: (id) => ({ first_flight: { name: 'First Flight', desc: 'Win your first run.' } })[id],
  card: (id) => (/^c\d+$/.test(id) ? { name: `Card ${id.slice(1)}`, source: id === 'c1' ? 'combat_reward' : id === 'c2' ? 'market' : undefined } : undefined),
};

describe('buildReveals', () => {
  it('shows Leaders, then achievements, then cards, each with a reason', () => {
    const reveals = buildReveals(['card:c1', 'achievement:first_flight', 'leader:talon', 'card:c2'], lookups);
    expect(reveals.map((reveal) => `${reveal.kind}:${reveal.id}`)).toEqual(['leader:talon', 'achievement:first_flight', 'card:c1', 'card:c2']);
    expect(reveals.map((reveal) => reveal.kicker)).toEqual(['LEADER UNLOCKED', 'ACHIEVEMENT', 'NEW CARD', 'NEW CARD']);
    expect(reveals[0]).toMatchObject({ title: 'The Talon', why: 'Unlocked: your first win.', consumes: ['leader:talon'] });
    expect(reveals[1]).toMatchObject({ title: 'First Flight', why: 'Win your first run.' });
    expect(reveals[2].why).toBe('First copy, claimed after a fight.');
    expect(reveals[3].why).toBe('First copy, bought at a market stall.');
    for (const reveal of reveals) expect(reveal.why.length).toBeGreaterThan(0);
  });

  it('gives a fallback reason when the game has none recorded', () => {
    expect(buildReveals(['leader:heron'], lookups)[0].why).toBe('A new crew is ready in Flight setup.');
    expect(buildReveals(['card:c7'], lookups)[0].why).toBe('New to your Collection.');
  });

  it('caps card reveals and lets the last one stand in for the rest', () => {
    const queue = ['card:c1', 'card:c2', 'card:c3', 'card:c4', 'card:c5', 'card:c6'];
    const reveals = buildReveals(queue, lookups);
    expect(reveals.map((reveal) => reveal.id)).toEqual(['c1', 'c2', 'c3']);
    expect(reveals[2].why).toBe('New to your Collection. 3 more new cards are waiting in your Collection.');
    expect(reveals[2].consumes).toEqual(['card:c3', 'card:c4', 'card:c5', 'card:c6']);
    // Showing every reveal retires the whole queue: once per unlock.
    expect(reveals.reduce((left, reveal) => retire(left, reveal.consumes), queue)).toEqual([]);
    expect(buildReveals(['card:c1', 'card:c2'], lookups, 1)[0].why).toContain('1 more new card is waiting');
  });

  it('shows each unlock once and drops entries that can never be shown', () => {
    const queue = ['card:c1', 'card:c1', 'leader:ghost', 'nonsense', 'card:', ':c1', 'trophy:x'];
    const reveals = buildReveals(queue, lookups);
    expect(reveals).toHaveLength(1);
    expect(staleEntries(queue, reveals)).toEqual(['leader:ghost', 'nonsense', 'card:', ':c1', 'trophy:x']);
    expect(buildReveals([], lookups)).toEqual([]);
  });
});

describe('queue storage form', () => {
  it('round-trips, de-duplicates and stays bounded', () => {
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue('\ncard:a\n\ncard:b\ncard:a\n  leader:talon  ')).toEqual(['card:a', 'card:b', 'leader:talon']);
    expect(parseQueue(serializeQueue(['card:a', 'leader:talon']))).toEqual(['card:a', 'leader:talon']);
    const long = Array.from({ length: 100 }, (_, index) => `card:c${index}`);
    expect(parseQueue(long.join('\n'))).toEqual(long.slice(-MAX_QUEUE));
  });
});

describe('unlocks are queued when they happen', () => {
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

  it('appends without losing what is already waiting', () => {
    queueCeremony('card', []);
    expect(memory.has(CEREMONY_KEY)).toBe(false);
    queueCeremony('card', ['a', 'b']);
    queueCeremony('leader', ['talon']);
    expect(parseQueue(memory.get(CEREMONY_KEY))).toEqual(['card:a', 'card:b', 'leader:talon']);
  });

  it('queues the Leader and achievement a first win unlocks, exactly once', () => {
    const record = { receipt: 'run-1', result: 'win' as const, leaderId: 'fledgling', difficulty: 0, cohesion: 12, maxCohesion: 50, turns: 9, deckSize: 16 };
    const first = recordRun(record);
    expect(first.newLeaders).toContain('talon');
    expect(first.newAchievements).toContain('first_flight');
    const queued = parseQueue(memory.get(CEREMONY_KEY));
    expect(queued).toEqual(expect.arrayContaining(['leader:talon', 'achievement:first_flight']));
    // Replaying the same finished run (save recovery) must not queue again.
    recordRun(record);
    expect(parseQueue(memory.get(CEREMONY_KEY))).toEqual(queued);
    // A second win unlocks nothing new for these two.
    recordRun({ ...record, receipt: 'run-2' });
    const after = parseQueue(memory.get(CEREMONY_KEY));
    expect(after.filter((entry) => entry === 'leader:talon')).toHaveLength(1);
    expect(loadAccount().unlockedLeaders).toContain('talon');
  });
});
