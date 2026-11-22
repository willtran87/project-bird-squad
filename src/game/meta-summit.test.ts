import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_DIFFICULTY } from './difficulty';
import { achievements, loadAccount, recordRun, saveAccount, type RunRecord } from './meta';
import { setMemoryStorageSession } from './safe-storage';

const win = (difficulty: number): RunRecord => ({
  result: 'win', leaderId: 'fledgling', difficulty, cohesion: 10, maxCohesion: 60, turns: 8, deckSize: 16,
});

describe('Summit Master', () => {
  beforeEach(() => {
    const memory = new Map<string, string>();
    setMemoryStorageSession({
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => { memory.set(key, value); },
      removeItem: (key) => { memory.delete(key); },
    });
  });
  afterEach(() => setMemoryStorageSession(undefined));

  it('names and requires the top Ascension tier', () => {
    const summit = achievements.find((ach) => ach.id === 'summit')!;
    expect(summit.desc).toContain(`Tier ${MAX_DIFFICULTY}`);
    expect(recordRun(win(MAX_DIFFICULTY - 1)).newAchievements).not.toContain('summit');
    expect(recordRun(win(MAX_DIFFICULTY)).newAchievements).toContain('summit');
  });

  it('keeps Summit Master for players who earned it under the old Tier 6 rule', () => {
    const account = loadAccount();
    account.achievements.push('summit');
    expect(saveAccount(account)).toBe(true);
    const result = recordRun(win(6));
    expect(result.account.achievements).toContain('summit');
    expect(loadAccount().achievements).toContain('summit');
  });
});
