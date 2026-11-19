import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeStorageRecoveryEvents,
  memoryStorageSessionActive,
  readJournaledJson,
  removeJournaledJson,
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
  setMemoryStorageSession,
  storageWriteResults,
  writeJournaledJson,
} from './safe-storage';

class MapStorage {
  readonly data = new Map<string, string>();
  failWrites = false;
  getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(key, String(value));
  }
  removeItem(key: string) {
    if (this.failWrites) throw new Error('SecurityError');
    this.data.delete(key);
  }
}

const sanitizeCount = (value: unknown) =>
  typeof value === 'object' && value !== null && typeof (value as { count?: unknown }).count === 'number'
    ? value as { count: number }
    : undefined;

let local: MapStorage;

beforeEach(() => {
  local = new MapStorage();
  vi.stubGlobal('window', { localStorage: local });
  setMemoryStorageSession(undefined);
  storageWriteResults.clear();
  consumeStorageRecoveryEvents();
});

afterEach(() => {
  setMemoryStorageSession(undefined);
});

describe('safe primitives', () => {
  it('reads, writes and removes through localStorage, recording durable write results', () => {
    expect(safeStorageSet('k', 'v')).toBe(true);
    expect(safeStorageGet('k')).toBe('v');
    expect(storageWriteResults.get('k')).toBe(true);
    expect(safeStorageRemove('k')).toBe(true);
    expect(safeStorageGet('k')).toBeNull();
  });

  it('reports failed writes instead of throwing', () => {
    local.failWrites = true;
    expect(safeStorageSet('k', 'v')).toBe(false);
    expect(safeStorageRemove('k')).toBe(false);
    expect(storageWriteResults.get('k')).toBe(false);
  });

  it('survives a localStorage getter that throws', () => {
    vi.stubGlobal('window', { get localStorage(): Storage { throw new Error('denied'); } });
    expect(safeStorageGet('k')).toBeNull();
    expect(safeStorageSet('k', 'v')).toBe(false);
  });
});

describe('memory storage session', () => {
  it('diverts all reads and writes away from localStorage and records no write results', () => {
    const memory = new MapStorage();
    setMemoryStorageSession(memory);
    expect(memoryStorageSessionActive()).toBe(true);
    safeStorageSet('k', 'practice');
    expect(memory.getItem('k')).toBe('practice');
    expect(local.getItem('k')).toBeNull();
    expect(storageWriteResults.has('k')).toBe(false);
    setMemoryStorageSession(undefined);
    expect(memoryStorageSessionActive()).toBe(false);
    expect(safeStorageGet('k')).toBeNull();
  });

  it('suppresses recovery events while active', () => {
    const memory = new MapStorage();
    setMemoryStorageSession(memory);
    memory.setItem('j', '{broken');
    expect(readJournaledJson('j', sanitizeCount)).toBeUndefined();
    expect(consumeStorageRecoveryEvents()).toEqual([]);
  });
});

describe('journaled JSON', () => {
  it('writes the primary and backup copies and clears any quarantine', () => {
    local.setItem('j.corrupt', 'old');
    expect(writeJournaledJson('j', { count: 1 })).toBe(true);
    expect(local.getItem('j')).toBe('{"count":1}');
    expect(local.getItem('j.backup')).toBe('{"count":1}');
    expect(local.getItem('j.corrupt')).toBeNull();
  });

  it('refuses unserialisable values and failed primary writes', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(writeJournaledJson('j', cyclic)).toBe(false);
    local.failWrites = true;
    expect(writeJournaledJson('j', { count: 1 })).toBe(false);
  });

  it('returns undefined for a missing key without side effects', () => {
    expect(readJournaledJson('missing', sanitizeCount)).toBeUndefined();
    expect([...local.data.keys()]).toEqual([]);
    expect(consumeStorageRecoveryEvents()).toEqual([]);
  });

  it('reads a valid primary and refreshes a stale backup', () => {
    local.setItem('j', '{"count":2}');
    local.setItem('j.backup', '{"count":1}');
    expect(readJournaledJson('j', sanitizeCount)).toEqual({ count: 2 });
    expect(local.getItem('j.backup')).toBe('{"count":2}');
  });

  it('recovers from the backup when the primary is corrupt or fails validation', () => {
    for (const primary of ['{not json', '{"count":"x"}']) {
      local.data.clear();
      local.setItem('j', primary);
      local.setItem('j.backup', '{"count":5}');
      expect(readJournaledJson('j', sanitizeCount)).toEqual({ count: 5 });
      expect(local.getItem('j')).toBe('{"count":5}');
    }
    expect(consumeStorageRecoveryEvents()).toEqual([{ key: 'j', outcome: 'recovered' }]);
    expect(consumeStorageRecoveryEvents()).toEqual([]);
  });

  it('quarantines and resets when both copies are unusable', () => {
    local.setItem('j', '{bad primary');
    local.setItem('j.backup', '{bad backup');
    expect(readJournaledJson('j', sanitizeCount)).toBeUndefined();
    expect(local.getItem('j.corrupt')).toBe('{bad primary');
    expect(local.getItem('j')).toBeNull();
    expect(local.getItem('j.backup')).toBeNull();
    expect(consumeStorageRecoveryEvents()).toEqual([{ key: 'j', outcome: 'reset' }]);
  });

  it('quarantines a lone corrupt backup', () => {
    local.setItem('j.backup', 'garbage');
    expect(readJournaledJson('j', sanitizeCount)).toBeUndefined();
    expect(local.getItem('j.corrupt')).toBe('garbage');
  });

  it('caps the quarantined copy', () => {
    local.setItem('j', 'x'.repeat(250_000));
    readJournaledJson('j', sanitizeCount);
    expect(local.getItem('j.corrupt')?.length).toBe(100_000);
  });

  it('removeJournaledJson clears all three copies', () => {
    for (const key of ['j', 'j.backup', 'j.corrupt']) local.setItem(key, '1');
    removeJournaledJson('j');
    expect([...local.data.keys()]).toEqual([]);
  });
});
