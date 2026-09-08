export type StorageRecoveryOutcome = 'recovered' | 'reset';

export interface StorageRecoveryEvent {
  key: string;
  outcome: StorageRecoveryOutcome;
}

const BACKUP_SUFFIX = '.backup';
const CORRUPT_SUFFIX = '.corrupt';
const MAX_QUARANTINE_LENGTH = 100_000;
const recoveryEvents: StorageRecoveryEvent[] = [];
type StorageBackend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
let memorySession: StorageBackend | undefined;

/** Installing/removing a disposable backend never flushes its data to disk. */
export function setMemoryStorageSession(backend?: StorageBackend): void {
  memorySession = backend;
}

export function memoryStorageSessionActive(): boolean {
  return memorySession !== undefined;
}

function storage(): StorageBackend | undefined {
  try {
    return memorySession ?? window.localStorage;
  } catch {
    return undefined;
  }
}

export function safeStorageGet(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeStorageSet(key: string, value: string): boolean {
  try {
    const target = storage();
    if (!target) return false;
    target.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeStorageRemove(key: string): boolean {
  try {
    const target = storage();
    if (!target) return false;
    target.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function decode<T>(raw: string | null, sanitize: (value: unknown) => T | undefined): T | undefined {
  if (raw === null) return undefined;
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

function rememberRecovery(key: string, outcome: StorageRecoveryOutcome) {
  if (memorySession) return;
  if (recoveryEvents.some((event) => event.key === key && event.outcome === outcome)) return;
  recoveryEvents.push({ key, outcome });
}

export function readJournaledJson<T>(key: string, sanitize: (value: unknown) => T | undefined): T | undefined {
  const raw = safeStorageGet(key);
  const parsed = decode(raw, sanitize);
  const backupKey = `${key}${BACKUP_SUFFIX}`;
  if (parsed !== undefined) {
    if (safeStorageGet(backupKey) !== raw) safeStorageSet(backupKey, raw!);
    return parsed;
  }

  const backupRaw = safeStorageGet(backupKey);
  const backup = decode(backupRaw, sanitize);
  if (backup !== undefined) {
    safeStorageSet(key, backupRaw!);
    rememberRecovery(key, 'recovered');
    return backup;
  }

  const damagedRaw = raw ?? backupRaw;
  if (damagedRaw === null) return undefined;

  safeStorageSet(`${key}${CORRUPT_SUFFIX}`, damagedRaw.slice(0, MAX_QUARANTINE_LENGTH));
  safeStorageRemove(key);
  safeStorageRemove(backupKey);
  rememberRecovery(key, 'reset');
  return undefined;
}

export function writeJournaledJson(key: string, value: unknown): boolean {
  let raw: string;
  try {
    raw = JSON.stringify(value);
  } catch {
    return false;
  }
  if (!safeStorageSet(key, raw)) return false;
  safeStorageSet(`${key}${BACKUP_SUFFIX}`, raw);
  safeStorageRemove(`${key}${CORRUPT_SUFFIX}`);
  return true;
}

export function removeJournaledJson(key: string): void {
  safeStorageRemove(key);
  safeStorageRemove(`${key}${BACKUP_SUFFIX}`);
  safeStorageRemove(`${key}${CORRUPT_SUFFIX}`);
}

export function consumeStorageRecoveryEvents(): StorageRecoveryEvent[] {
  if (memorySession) return [];
  return recoveryEvents.splice(0);
}
