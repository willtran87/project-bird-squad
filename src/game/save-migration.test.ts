import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setMemoryStorageSession, writeJournaledJson } from './safe-storage';
import {
  ACTIVE_RUN_SAVE_VERSION,
  ACTIVE_RUN_STORAGE_KEY,
  SAVE_BACKUP_VERSION,
  activeRunMigrationChain,
  futureSaveMessage,
  migrateActiveRun,
  migrateSaveBackup,
  missingMigrationSteps,
  readActiveRunCheckpoint,
  runSaveMigrations,
  saveBackupMigrationChain,
  stampActiveRunVersion,
  type SaveMigrationChain,
  type SaveRecord,
} from './save-migration';

/** A three-version fixture chain exercising multi-step upgrades. */
function fixtureChain(patch: Partial<SaveMigrationChain> = {}): SaveMigrationChain {
  return {
    name: 'fixture',
    currentVersion: 3,
    minimumVersion: 1,
    migrators: {
      1: (payload) => ({ ...payload, renamed: payload.legacy, legacy: undefined, trail: [...(payload.trail as string[] ?? []), '1>2'] }),
      2: (payload) => ({ ...payload, trail: [...(payload.trail as string[]), '2>3'] }),
    },
    readVersion: (payload) => (typeof payload.v === 'number' && Number.isInteger(payload.v) && payload.v > 0 ? payload.v : undefined),
    writeVersion: (payload, version) => ({ ...payload, v: version }),
    ...patch,
  };
}

describe('runSaveMigrations', () => {
  it('passes current-version payloads through untouched (same object, not migrated)', () => {
    const payload = { v: 3, data: 1 };
    const result = runSaveMigrations(payload, fixtureChain());
    expect(result).toEqual({ ok: true, value: payload, fromVersion: 3, migrated: false });
    if (result.ok) expect(result.value).toBe(payload);
  });

  it('runs every step in order and stamps each intermediate version', () => {
    const payload = { v: 1, legacy: 'name' };
    const result = runSaveMigrations(payload, fixtureChain());
    expect(result.ok && result.value).toMatchObject({ v: 3, renamed: 'name', trail: ['1>2', '2>3'] });
    expect(result.ok && result.fromVersion).toBe(1);
    expect(result.ok && result.migrated).toBe(true);
  });

  it('starts mid-chain', () => {
    const result = runSaveMigrations({ v: 2, trail: [] }, fixtureChain());
    expect(result.ok && result.value.trail).toEqual(['2>3']);
  });

  it('never mutates the caller payload', () => {
    const payload = { v: 1, legacy: 'name', nested: { list: [1] } };
    const before = JSON.stringify(payload);
    const chain = fixtureChain({ migrators: { 1: (p) => { (p.nested as { list: number[] }).list.push(2); return p; }, 2: (p) => p } });
    runSaveMigrations(payload, chain);
    expect(JSON.stringify(payload)).toBe(before);
  });

  it('refuses future versions gracefully', () => {
    expect(runSaveMigrations({ v: 4 }, fixtureChain())).toEqual({ ok: false, reason: 'future-version', version: 4 });
  });

  it('refuses versions below the minimum, missing versions and non-objects', () => {
    expect(runSaveMigrations({ v: 1 }, fixtureChain({ minimumVersion: 2 }))).toEqual({ ok: false, reason: 'unsupported-version', version: 1 });
    expect(runSaveMigrations({}, fixtureChain())).toEqual({ ok: false, reason: 'unsupported-version' });
    expect(runSaveMigrations({ v: '3' }, fixtureChain())).toEqual({ ok: false, reason: 'unsupported-version' });
    for (const value of [null, 3, 'x', [1]]) expect(runSaveMigrations(value, fixtureChain())).toEqual({ ok: false, reason: 'invalid' });
  });

  it('reports a gap in the chain as unsupported', () => {
    const chain = fixtureChain({ migrators: { 2: (p) => p } });
    expect(missingMigrationSteps(chain)).toEqual([1]);
    expect(runSaveMigrations({ v: 1 }, chain)).toEqual({ ok: false, reason: 'unsupported-version', version: 1 });
  });

  it('contains throwing or non-object migrators', () => {
    const throwing = fixtureChain({ migrators: { 1: () => { throw new Error('boom'); }, 2: (p) => p } });
    expect(runSaveMigrations({ v: 1 }, throwing)).toEqual({ ok: false, reason: 'migration-failed', version: 1 });
    const bad = fixtureChain({ migrators: { 1: () => null as unknown as SaveRecord, 2: (p) => p } });
    expect(runSaveMigrations({ v: 1 }, bad)).toEqual({ ok: false, reason: 'migration-failed', version: 1 });
  });
});

describe('registered chains', () => {
  it('have a migrator for every supported version below current', () => {
    expect(missingMigrationSteps(saveBackupMigrationChain)).toEqual([]);
    expect(missingMigrationSteps(activeRunMigrationChain)).toEqual([]);
  });

  it('backup v1 bundles load as-is; unversioned and future bundles are refused', () => {
    const bundle = { format: 'bird-squad-save', version: SAVE_BACKUP_VERSION, data: {} };
    expect(migrateSaveBackup(bundle)).toEqual({ ok: true, value: bundle, fromVersion: SAVE_BACKUP_VERSION, migrated: false });
    expect(migrateSaveBackup({ format: 'bird-squad-save', data: {} })).toMatchObject({ ok: false, reason: 'unsupported-version' });
    expect(migrateSaveBackup({ ...bundle, version: SAVE_BACKUP_VERSION + 1 })).toEqual({ ok: false, reason: 'future-version', version: SAVE_BACKUP_VERSION + 1 });
  });

  it('active runs without a version stamp are treated as v1', () => {
    const legacy = { deck: [{ id: 'major_00' }] };
    expect(migrateActiveRun(legacy)).toMatchObject({ ok: true, fromVersion: 1 });
    expect(migrateActiveRun({ ...legacy, saveVersion: ACTIVE_RUN_SAVE_VERSION + 1 })).toMatchObject({ ok: false, reason: 'future-version' });
    expect(migrateActiveRun({ ...legacy, saveVersion: 0 })).toMatchObject({ ok: false, reason: 'unsupported-version' });
  });

  it('stampActiveRunVersion adds the current version without mutating', () => {
    const run = { deck: [] as string[] };
    expect(stampActiveRunVersion(run)).toEqual({ deck: [], saveVersion: ACTIVE_RUN_SAVE_VERSION });
    expect(run).toEqual({ deck: [] });
    expect(migrateActiveRun(stampActiveRunVersion(run))).toMatchObject({ ok: true, migrated: false });
  });

  it('future-version messages name the version and promise no change', () => {
    expect(futureSaveMessage('backup', 7)).toMatch(/newer version.*save version 7.*nothing was changed/);
    expect(futureSaveMessage('flight', undefined)).toMatch(/^This saved flight was made by a newer version/);
  });
});

describe('readActiveRunCheckpoint', () => {
  let memory: Map<string, string>;
  const sanitize = (value: unknown) => {
    const deck = (value as { deck?: unknown }).deck;
    return Array.isArray(deck) && deck.length ? { deck: deck as Array<{ id: string }> } : undefined;
  };

  beforeEach(() => {
    memory = new Map();
    setMemoryStorageSession({
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => { memory.set(key, value); },
      removeItem: (key) => { memory.delete(key); },
    });
  });
  afterEach(() => setMemoryStorageSession(undefined));

  it('reports no checkpoint', () => {
    expect(readActiveRunCheckpoint(sanitize)).toEqual({ status: 'none' });
  });

  it('loads a legacy unversioned checkpoint identically to the sanitizer alone', () => {
    const run = { deck: [{ id: 'major_00' }], seed: 'abc' };
    writeJournaledJson(ACTIVE_RUN_STORAGE_KEY, run);
    expect(readActiveRunCheckpoint(sanitize)).toEqual({ status: 'ok', run: sanitize(run) });
  });

  it('refuses a future checkpoint without quarantining or deleting it', () => {
    const raw = JSON.stringify({ deck: [{ id: 'x' }], saveVersion: ACTIVE_RUN_SAVE_VERSION + 1 });
    memory.set(ACTIVE_RUN_STORAGE_KEY, raw);
    expect(readActiveRunCheckpoint(sanitize)).toEqual({ status: 'future-version', version: ACTIVE_RUN_SAVE_VERSION + 1 });
    expect(memory.get(ACTIVE_RUN_STORAGE_KEY)).toBe(raw);
    expect(memory.has(`${ACTIVE_RUN_STORAGE_KEY}.corrupt`)).toBe(false);
  });

  it('still falls back to the backup when the primary fails validation', () => {
    memory.set(ACTIVE_RUN_STORAGE_KEY, JSON.stringify({ deck: [] }));
    memory.set(`${ACTIVE_RUN_STORAGE_KEY}.backup`, JSON.stringify({ deck: [{ id: 'b' }] }));
    expect(readActiveRunCheckpoint(sanitize)).toEqual({ status: 'ok', run: { deck: [{ id: 'b' }] } });
  });
});
