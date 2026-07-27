import { safeStorageGet, safeStorageRemove, safeStorageSet } from './safe-storage';

export type ScreenReaderPreference = 'off' | 'on';

export interface ScreenReaderState {
  preference: ScreenReaderPreference;
  enabled: boolean;
  regionReady: boolean;
  observerActive: boolean;
  summaryLoaded: boolean;
  lastAnnouncement: string;
}

const STORAGE_KEY = 'birdsquad.screenReader';
type ScreenReaderRuntimeModule = typeof import('./screen-reader-runtime');
let runtimeModule: ScreenReaderRuntimeModule | undefined;
let runtimeModulePromise: Promise<ScreenReaderRuntimeModule> | undefined;
const storedPreference = safeStorageGet(STORAGE_KEY);
let preference: ScreenReaderPreference = storedPreference === 'on' ? 'on' : 'off';
if (storedPreference !== null && storedPreference !== 'on' && storedPreference !== 'off') safeStorageRemove(STORAGE_KEY);

export function screenReaderPreference(): ScreenReaderPreference {
  return preference;
}

function loadScreenReaderRuntime() {
  return runtimeModulePromise ??= import('./screen-reader-runtime').then((module) => {
    runtimeModule = module;
    return module;
  });
}

export function announceScreenReader(message: string) {
  if (preference !== 'on') return false;
  void loadScreenReaderRuntime().then((module) => module.announceScreenReaderRuntime(message));
  return true;
}

export function setScreenReaderPreference(value: ScreenReaderPreference): boolean {
  preference = value;
  const stored = safeStorageSet(STORAGE_KEY, value);
  if (value === 'on') {
    void loadScreenReaderRuntime().then((module) => {
      if (preference === 'on') module.enableScreenReaderRuntime();
    });
  } else {
    runtimeModule?.disableScreenReaderRuntime();
  }
  return stored;
}

export function initializeScreenReaderAccessibility() {
  if (preference === 'on') {
    void loadScreenReaderRuntime().then((module) => {
      if (preference === 'on') module.enableScreenReaderRuntime();
    });
  }
}

export function screenReaderState(): ScreenReaderState {
  const runtime = runtimeModule?.screenReaderRuntimeState();
  return {
    preference,
    enabled: preference === 'on',
    regionReady: typeof document !== 'undefined' && Boolean(document.getElementById('game-status')),
    observerActive: runtime?.observerActive ?? false,
    summaryLoaded: runtime?.summaryLoaded ?? false,
    lastAnnouncement: runtime?.lastAnnouncement ?? '',
  };
}
