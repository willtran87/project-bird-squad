import { safeStorageGet, safeStorageRemove, safeStorageSet } from './safe-storage';

export type VisualContrastPreference = 'standard' | 'high';

export interface VisualContrastState {
  preference: VisualContrastPreference;
  highContrast: boolean;
  applied: boolean;
}

const STORAGE_KEY = 'birdsquad.visualContrast';
const HIGH_CONTRAST_CLASS = 'birdsquad-high-contrast';
let sessionPreference: VisualContrastPreference | undefined;
let preferenceLoaded = false;

function isVisualContrastPreference(value: string | null): value is VisualContrastPreference {
  return value === 'standard' || value === 'high';
}

export function visualContrastPreference(): VisualContrastPreference {
  if (preferenceLoaded) return sessionPreference ?? 'standard';
  preferenceLoaded = true;
  const stored = safeStorageGet(STORAGE_KEY);
  if (isVisualContrastPreference(stored)) {
    sessionPreference = stored;
    return stored;
  }
  if (stored !== null) safeStorageRemove(STORAGE_KEY);
  return sessionPreference ?? 'standard';
}

export function applyVisualContrastPreference(preference = visualContrastPreference()): boolean {
  if (typeof document === 'undefined') return false;
  const gameContainer = document.getElementById('game-container');
  if (!gameContainer) return false;
  gameContainer.classList.toggle(HIGH_CONTRAST_CLASS, preference === 'high');
  return gameContainer.classList.contains(HIGH_CONTRAST_CLASS) === (preference === 'high');
}

export function setVisualContrastPreference(value: VisualContrastPreference): boolean {
  preferenceLoaded = true;
  sessionPreference = value;
  const stored = safeStorageSet(STORAGE_KEY, value);
  applyVisualContrastPreference(value);
  return stored;
}

export function visualContrastState(): VisualContrastState {
  const preference = visualContrastPreference();
  const expected = preference === 'high';
  const applied = typeof document !== 'undefined'
    && document.getElementById('game-container')?.classList.contains(HIGH_CONTRAST_CLASS) === expected;
  return {
    preference,
    highContrast: expected,
    applied,
  };
}
