import { readJournaledJson } from './safe-storage';

/**
 * Versioned save migration.
 *
 * Each persisted shape owns a chain: a current version, the oldest version it
 * can still upgrade, and a registry of single-step migrators keyed by the
 * version they upgrade FROM (migrators[n] turns an n payload into n + 1).
 * Migration always runs on a structured clone, before schema validation, so a
 * sanitizer only ever sees the current shape. Payloads written by a newer
 * build are refused (never truncated or quarantined) so a downgrade cannot
 * destroy progress.
 */
export type SaveRecord = Record<string, unknown>;
export type SaveMigrator = (payload: SaveRecord) => SaveRecord;

export interface SaveMigrationChain {
  readonly name: string;
  readonly currentVersion: number;
  readonly minimumVersion: number;
  readonly migrators: Readonly<Record<number, SaveMigrator>>;
  /** Returns the payload's version, or undefined when it is missing/malformed. */
  readonly readVersion: (payload: SaveRecord) => number | undefined;
  readonly writeVersion: (payload: SaveRecord, version: number) => SaveRecord;
}

export type SaveMigrationResult =
  | { ok: true; value: SaveRecord; fromVersion: number; migrated: boolean }
  | { ok: false; reason: 'invalid' | 'unsupported-version' | 'future-version' | 'migration-failed'; version?: number };

function isRecord(value: unknown): value is SaveRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : undefined;
}

export function runSaveMigrations(payload: unknown, chain: SaveMigrationChain): SaveMigrationResult {
  if (!isRecord(payload)) return { ok: false, reason: 'invalid' };
  const fromVersion = chain.readVersion(payload);
  if (fromVersion === undefined) return { ok: false, reason: 'unsupported-version' };
  if (fromVersion > chain.currentVersion) return { ok: false, reason: 'future-version', version: fromVersion };
  if (fromVersion < chain.minimumVersion) return { ok: false, reason: 'unsupported-version', version: fromVersion };
  if (fromVersion === chain.currentVersion) return { ok: true, value: payload, fromVersion, migrated: false };
  let value: SaveRecord;
  try {
    value = structuredClone(payload);
    for (let version = fromVersion; version < chain.currentVersion; version += 1) {
      const migrate = chain.migrators[version];
      if (!migrate) return { ok: false, reason: 'unsupported-version', version: fromVersion };
      const next = migrate(value);
      if (!isRecord(next)) return { ok: false, reason: 'migration-failed', version };
      value = chain.writeVersion(next, version + 1);
    }
  } catch {
    return { ok: false, reason: 'migration-failed', version: fromVersion };
  }
  return { ok: true, value, fromVersion, migrated: true };
}

/** Every version between minimum and current must have exactly one step. */
export function missingMigrationSteps(chain: SaveMigrationChain): number[] {
  const missing: number[] = [];
  for (let version = chain.minimumVersion; version < chain.currentVersion; version += 1) {
    if (typeof chain.migrators[version] !== 'function') missing.push(version);
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Exported save backup bundle ({ format, version, exportedAt, data }).

export const SAVE_BACKUP_VERSION = 1;

/** Register backup migrators here: key n upgrades a version-n bundle to n + 1. */
export const saveBackupMigrators: Record<number, SaveMigrator> = {};

export const saveBackupMigrationChain: SaveMigrationChain = {
  name: 'save-backup',
  currentVersion: SAVE_BACKUP_VERSION,
  minimumVersion: 1,
  migrators: saveBackupMigrators,
  readVersion: (payload) => positiveInteger(payload.version),
  writeVersion: (payload, version) => ({ ...payload, version }),
};

export function migrateSaveBackup(payload: unknown): SaveMigrationResult {
  return runSaveMigrations(payload, saveBackupMigrationChain);
}

// ---------------------------------------------------------------------------
// Active-run checkpoint (birdsquad.run.active). Checkpoints written before
// versioning existed carry no `saveVersion` and are treated as version 1.

export const ACTIVE_RUN_STORAGE_KEY = 'birdsquad.run.active';
export const ACTIVE_RUN_SAVE_VERSION = 1;
export const ACTIVE_RUN_VERSION_FIELD = 'saveVersion';

/** Register checkpoint migrators here: key n upgrades a version-n run to n + 1. */
export const activeRunMigrators: Record<number, SaveMigrator> = {};

export const activeRunMigrationChain: SaveMigrationChain = {
  name: 'active-run',
  currentVersion: ACTIVE_RUN_SAVE_VERSION,
  minimumVersion: 1,
  migrators: activeRunMigrators,
  readVersion: (payload) => payload[ACTIVE_RUN_VERSION_FIELD] === undefined
    ? 1
    : positiveInteger(payload[ACTIVE_RUN_VERSION_FIELD]),
  writeVersion: (payload, version) => ({ ...payload, [ACTIVE_RUN_VERSION_FIELD]: version }),
};

export function migrateActiveRun(payload: unknown): SaveMigrationResult {
  return runSaveMigrations(payload, activeRunMigrationChain);
}

/** Version-stamp a run before persisting it. Sanitizers ignore the extra field. */
export function stampActiveRunVersion<T extends object>(runState: T): T & { saveVersion: number } {
  return { ...runState, [ACTIVE_RUN_VERSION_FIELD]: ACTIVE_RUN_SAVE_VERSION } as T & { saveVersion: number };
}

export type ActiveRunCheckpoint<T> =
  | { status: 'ok'; run: T; migratedFrom?: number }
  | { status: 'none' }
  | { status: 'future-version'; version: number };

const FUTURE_CHECKPOINT = Symbol('future-active-run');
type FutureCheckpoint = { [FUTURE_CHECKPOINT]: number };

/**
 * Migrates a raw checkpoint value and then validates it. A checkpoint written
 * by a newer build yields { status: 'future-version' } and is left untouched in
 * storage; returning undefined to readJournaledJson would quarantine it.
 */
export function readActiveRunCheckpoint<T>(sanitize: (value: unknown) => T | undefined): ActiveRunCheckpoint<T> {
  let migratedFrom: number | undefined;
  const stored = readJournaledJson<T | FutureCheckpoint>(ACTIVE_RUN_STORAGE_KEY, (value) => {
    const migration = migrateActiveRun(value);
    if (!migration.ok) {
      return migration.reason === 'future-version'
        ? { [FUTURE_CHECKPOINT]: migration.version ?? ACTIVE_RUN_SAVE_VERSION + 1 }
        : undefined;
    }
    migratedFrom = migration.migrated ? migration.fromVersion : undefined;
    return sanitize(migration.value);
  });
  if (stored === undefined) return { status: 'none' };
  if (typeof stored === 'object' && stored !== null && FUTURE_CHECKPOINT in stored) {
    return { status: 'future-version', version: (stored as FutureCheckpoint)[FUTURE_CHECKPOINT] };
  }
  return migratedFrom === undefined
    ? { status: 'ok', run: stored as T }
    : { status: 'ok', run: stored as T, migratedFrom };
}

export function futureSaveMessage(kind: 'backup' | 'flight', version: number | undefined) {
  const subject = kind === 'backup' ? 'This backup' : 'This saved flight';
  return `${subject} was made by a newer version of Bird Squad${version ? ` (save version ${version})` : ''}. Update the game to load it; nothing was changed.`;
}
