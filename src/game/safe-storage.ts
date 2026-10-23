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
/** Last durable write outcome; disposable practice writes never enter this map. */
export const storageWriteResults = new Map<string, boolean>();

/** Installing/removing a disposable backend never flushes its data to disk. */
export function setMemoryStorageSession(backend?: StorageBackend): void {
  memorySession = backend;
}

export function memoryStorageSessionActive(): boolean {
  return memorySession !== undefined;
}

// Access is contained by the public read/write try blocks, including browsers
// whose localStorage getter throws before a backend can be returned.
function storage(): StorageBackend {
  return memorySession ?? window.localStorage;
}

export function safeStorageGet(key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSet(key: string, value: string): boolean {
  return mutateStorage('setItem', key, value);
}

export function safeStorageRemove(key: string): boolean {
  return mutateStorage('removeItem', key);
}

function mutateStorage(method: 'setItem' | 'removeItem', key: string, value?: string): boolean {
  let stored = false;
  try {
    storage()[method](key, value!);
    stored = true;
  } catch { /* Keep the active in-memory setting and report failed persistence. */ }
  if (!memorySession) storageWriteResults.set(key, stored);
  return stored;
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
