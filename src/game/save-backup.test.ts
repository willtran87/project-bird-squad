import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setMemoryStorageSession } from './safe-storage';
import {
  applySaveBackup,
  createSaveBackup,
  parseSaveBackup,
  type SaveBackupBundle,
  type SaveBackupRuntimeDependencies,
} from './save-backup';
import { ACTIVE_RUN_SAVE_VERSION, SAVE_BACKUP_VERSION } from './save-migration';

type Run = { deck: Array<{ id: string }>; seed: string };

let memory: Map<string, string>;
let failKey: string | undefined;

beforeEach(() => {
  memory = new Map();
  failKey = undefined;
  setMemoryStorageSession({
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => { if (key === failKey) throw new Error('quota'); memory.set(key, value); },
    removeItem: (key) => { memory.delete(key); },
  });
});
afterEach(() => setMemoryStorageSession(undefined));

const sanitizeActiveRun = (value: unknown): Run | undefined => {
  const run = value as Partial<Run> | null;
  return run && Array.isArray(run.deck) && run.deck.length && typeof run.seed === 'string'
    ? { deck: run.deck.map((card) => ({ id: String(card.id) })), seed: run.seed }
    : undefined;
};

function dependencies(activeRun?: Run): SaveBackupRuntimeDependencies {
  return {
    currentActiveRun: () => activeRun,
    currentRunHistory: () => [{ id: 'run-1' }],
    currentPreferences: () => ({
      controls: {} as never, // replaced by createSaveBackup with the live bindings
      graphicsQuality: 'auto', visualContrast: 'standard', colorCues: 'standard', screenShake: 'on', flashEffects: 'full',
      motion: 'system', combatPace: 'standard', animationPace: 'standard', textPace: 'standard', screenReader: 'off',
      musicVolume: 0.5, sfxVolume: 0.75, voiceVolume: 0.25, ambienceVolume: 0.5, audioMuted: false, maxTier: 2,
    }),
    sanitizeActiveRun,
    sanitizeRunHistory: (value) => (Array.isArray(value) ? value : undefined),
  };
}

const roundTrip = (bundle: unknown, deps = dependencies()) => parseSaveBackup(JSON.stringify(bundle), deps);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('createSaveBackup', () => {
  it('builds a current-version bundle with live preferences and optional active run', () => {
    const bundle = createSaveBackup(dependencies());
    expect(bundle.format).toBe('bird-squad-save');
    expect(bundle.version).toBe(SAVE_BACKUP_VERSION);
    expect('activeRun' in bundle.data).toBe(false);
    expect(bundle.data.preferences.codexCardLens).toBe('all');
    const withRun = createSaveBackup(dependencies({ deck: [{ id: 'major_00' }], seed: 's' }));
    expect(withRun.data.activeRun).toEqual({ deck: [{ id: 'major_00' }], seed: 's' });
  });
});

describe('parseSaveBackup: v1 compatibility', () => {
  it('a freshly exported v1 bundle restores to an identical bundle', () => {
    const run = { deck: [{ id: 'major_00' }], seed: 'abc' };
    const bundle = createSaveBackup(dependencies(run));
    const result = roundTrip(bundle);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // sanitizeAccount fills a few optional account lists that defaultAccount()
    // omits, so the account is a superset; everything else is identical.
    const { account, ...rest } = result.preview.bundle.data;
    const { account: exportedAccount, ...exportedRest } = clone(bundle.data);
    expect(rest).toEqual(exportedRest);
    expect(account).toMatchObject(exportedAccount);
    expect({ ...result.preview.bundle, data: undefined }).toEqual({ ...clone(bundle), data: undefined });
    // Restoring an already-restored bundle is a fixed point.
    const again = roundTrip(result.preview.bundle);
    expect(again.ok && again.preview.bundle).toEqual(clone(result.preview.bundle));
    expect(result.preview).toMatchObject({ activeRun: true, runs: bundle.data.account.runs, wins: bundle.data.account.wins, exportedAt: bundle.exportedAt });
  });

  it('accepts an unversioned (legacy) active run inside a v1 bundle', () => {
    const bundle = clone(createSaveBackup(dependencies({ deck: [{ id: 'major_00' }], seed: 'abc' })));
    expect((bundle.data.activeRun as Record<string, unknown>).saveVersion).toBeUndefined();
    expect(roundTrip(bundle).ok).toBe(true);
  });

  it('fills defaults for preferences that older v1 exports did not carry', () => {
    const bundle = clone(createSaveBackup(dependencies())) as SaveBackupBundle;
    const preferences = bundle.data.preferences as unknown as Record<string, unknown>;
    for (const key of ['colorCues', 'screenShake', 'flashEffects', 'textPace', 'animationPace', 'codexCardLens', 'codexCardSearch', 'codexCardSort', 'voiceVolume', 'ambienceVolume']) {
      delete preferences[key];
    }
    const result = roundTrip(bundle);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.bundle.data.preferences).toMatchObject({
      colorCues: 'standard', screenShake: 'on', flashEffects: 'full', textPace: 'standard', animationPace: 'standard',
      codexCardLens: 'all', codexCardSearch: '', codexCardSort: 'binder', voiceVolume: 0.75, ambienceVolume: 0.5,
    });
  });

  it('clamps out-of-range volumes and tiers', () => {
    const bundle = clone(createSaveBackup(dependencies()));
    Object.assign(bundle.data.preferences, { musicVolume: 4, sfxVolume: -1, maxTier: 99.7 });
    const result = roundTrip(bundle);
    expect(result.ok && result.preview.bundle.data.preferences).toMatchObject({ musicVolume: 1, sfxVolume: 0 });
    expect(result.ok && result.preview.bundle.data.preferences.maxTier).toBeLessThan(99);
  });
});

describe('parseSaveBackup: refusals', () => {
  const compatible = 'This is not a compatible Bird Squad backup.';

  it('rejects oversized and non-JSON input', () => {
    expect(parseSaveBackup('x'.repeat(2_000_001), dependencies())).toEqual({ ok: false, error: 'Backup is larger than the 2 MB safety limit.' });
    expect(parseSaveBackup('{nope', dependencies())).toEqual({ ok: false, error: 'This file is not valid JSON.' });
  });

  it('rejects foreign formats, missing/old versions and missing data', () => {
    const bundle = clone(createSaveBackup(dependencies()));
    expect(roundTrip({ ...bundle, format: 'other' })).toEqual({ ok: false, error: compatible });
    expect(roundTrip({ ...bundle, version: undefined })).toEqual({ ok: false, error: compatible });
    expect(roundTrip({ ...bundle, version: 0 })).toEqual({ ok: false, error: compatible });
    expect(roundTrip({ ...bundle, version: '1' })).toEqual({ ok: false, error: compatible });
    expect(roundTrip({ ...bundle, data: [] })).toEqual({ ok: false, error: compatible });
    expect(roundTrip([bundle])).toEqual({ ok: false, error: compatible });
  });

  it('refuses a backup from a newer build with an update message', () => {
    const bundle = clone(createSaveBackup(dependencies()));
    const result = roundTrip({ ...bundle, version: SAVE_BACKUP_VERSION + 1 });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/newer version of Bird Squad.*nothing was changed/);
  });

  it('refuses a v1 bundle whose active run was written by a newer build', () => {
    const bundle = clone(createSaveBackup(dependencies({ deck: [{ id: 'major_00' }], seed: 'abc' })));
    (bundle.data.activeRun as Record<string, unknown>).saveVersion = ACTIVE_RUN_SAVE_VERSION + 1;
    const result = roundTrip(bundle);
    expect(!result.ok && result.error).toMatch(/This saved flight was made by a newer version/);
  });

  it('reports schema failures without partially accepting data', () => {
    const schema = 'Backup data failed schema validation; nothing was changed.';
    const bundle = clone(createSaveBackup(dependencies()));
    expect(roundTrip({ ...bundle, data: { ...bundle.data, preferences: { ...bundle.data.preferences, motion: 'wild' } } })).toEqual({ ok: false, error: schema });
    expect(roundTrip({ ...bundle, data: { ...bundle.data, runHistory: 'nope' } })).toEqual({ ok: false, error: schema });
    expect(roundTrip({ ...bundle, data: { ...bundle.data, activeRun: { deck: [] } } })).toEqual({ ok: false, error: schema });
    const duplicateControls = clone(bundle);
    const controls = duplicateControls.data.preferences.controls as unknown as Record<string, string>;
    const [first, second] = Object.keys(controls);
    controls[second] = controls[first];
    expect(roundTrip(duplicateControls)).toEqual({ ok: false, error: schema });
  });
});

describe('applySaveBackup', () => {
  it('writes every key (with journaled backups) and verifies them', () => {
    memory.set('birdsquad.run.active', 'stale');
    const bundle = createSaveBackup(dependencies());
    expect(applySaveBackup(bundle)).toBe(true);
    expect(JSON.parse(memory.get('birdsquad.account')!)).toEqual(clone(bundle.data.account));
    expect(memory.get('birdsquad.account.backup')).toBe(memory.get('birdsquad.account'));
    expect(memory.has('birdsquad.run.active')).toBe(false);
    expect(memory.get('birdsquad.maxTier')).toBe('2');
    expect(memory.get('birdsquad.musicVolume')).toBe('0.50');
    expect(JSON.parse(memory.get('birdsquad.controlBindings')!)).toMatchObject({ version: 1 });
  });

  it('restores the previous snapshot when storage fails mid-apply', () => {
    memory.set('birdsquad.maxTier', '5');
    memory.set('birdsquad.run.active', '{"deck":[1]}');
    const bundle = createSaveBackup(dependencies());
    failKey = 'birdsquad.firstFlightGuide';
    expect(applySaveBackup(bundle)).toBe(false);
    failKey = undefined;
    // Removal succeeded before the failed write, so the snapshot must be put back.
    expect(memory.get('birdsquad.maxTier')).toBe('5');
    expect(memory.get('birdsquad.run.active')).toBe('{"deck":[1]}');
  });
});
