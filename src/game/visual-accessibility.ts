import { safeStorageGet, safeStorageRemove, safeStorageSet } from './safe-storage';

export type VisualContrastPreference = 'standard' | 'high';
export type ColorCuePreference = 'standard' | 'reinforced';
export type ScreenShakePreference = 'on' | 'off';
export type FlashEffectsPreference = 'full' | 'reduced';

export interface VisualContrastState {
  preference: VisualContrastPreference;
  highContrast: boolean;
  applied: boolean;
}

export interface ColorCueState {
  preference: ColorCuePreference;
  reinforced: boolean;
}

export interface ScreenShakeState {
  preference: ScreenShakePreference;
  enabled: boolean;
  reducedByMotion: boolean;
}

export interface FlashEffectsState {
  preference: FlashEffectsPreference;
  reduced: boolean;
  reducedByMotion: boolean;
}

const VISUAL_CONTRAST_STORAGE_KEY = 'birdsquad.visualContrast';
const COLOR_CUE_STORAGE_KEY = 'birdsquad.colorCues';
const SCREEN_SHAKE_STORAGE_KEY = 'birdsquad.screenShake';
const FLASH_EFFECTS_STORAGE_KEY = 'birdsquad.flashEffects';
const HIGH_CONTRAST_CLASS = 'birdsquad-high-contrast';
let sessionPreference: VisualContrastPreference | undefined;
let preferenceLoaded = false;
let sessionColorCuePreference: ColorCuePreference | undefined;
let colorCuePreferenceLoaded = false;
let sessionScreenShakePreference: ScreenShakePreference | undefined;
let screenShakePreferenceLoaded = false;
let sessionFlashEffectsPreference: FlashEffectsPreference | undefined;
let flashEffectsPreferenceLoaded = false;

function isVisualContrastPreference(value: string | null): value is VisualContrastPreference {
  return value === 'standard' || value === 'high';
}

export function visualContrastPreference(): VisualContrastPreference {
  if (preferenceLoaded) return sessionPreference ?? 'standard';
  preferenceLoaded = true;
  const stored = safeStorageGet(VISUAL_CONTRAST_STORAGE_KEY);
  if (isVisualContrastPreference(stored)) {
    sessionPreference = stored;
    return stored;
  }
  if (stored !== null) safeStorageRemove(VISUAL_CONTRAST_STORAGE_KEY);
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
  const stored = safeStorageSet(VISUAL_CONTRAST_STORAGE_KEY, value);
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

function isColorCuePreference(value: string | null): value is ColorCuePreference {
  return value === 'standard' || value === 'reinforced';
}

export function colorCuePreference(): ColorCuePreference {
  if (colorCuePreferenceLoaded) return sessionColorCuePreference ?? 'standard';
  colorCuePreferenceLoaded = true;
  const stored = safeStorageGet(COLOR_CUE_STORAGE_KEY);
  if (isColorCuePreference(stored)) {
    sessionColorCuePreference = stored;
    return stored;
  }
  if (stored !== null) safeStorageRemove(COLOR_CUE_STORAGE_KEY);
  return sessionColorCuePreference ?? 'standard';
}

export function setColorCuePreference(value: ColorCuePreference): boolean {
  colorCuePreferenceLoaded = true;
  sessionColorCuePreference = value;
  return safeStorageSet(COLOR_CUE_STORAGE_KEY, value);
}

export function colorCueState(): ColorCueState {
  const preference = colorCuePreference();
  return {
    preference,
    reinforced: preference === 'reinforced',
  };
}

function isScreenShakePreference(value: string | null): value is ScreenShakePreference {
  return value === 'on' || value === 'off';
}

export function screenShakePreference(): ScreenShakePreference {
  if (screenShakePreferenceLoaded) return sessionScreenShakePreference ?? 'on';
  screenShakePreferenceLoaded = true;
  const stored = safeStorageGet(SCREEN_SHAKE_STORAGE_KEY);
  if (isScreenShakePreference(stored)) {
    sessionScreenShakePreference = stored;
    return stored;
  }
  if (stored !== null) safeStorageRemove(SCREEN_SHAKE_STORAGE_KEY);
  return sessionScreenShakePreference ?? 'on';
}

export function setScreenShakePreference(value: ScreenShakePreference): boolean {
  screenShakePreferenceLoaded = true;
  sessionScreenShakePreference = value;
  return safeStorageSet(SCREEN_SHAKE_STORAGE_KEY, value);
}

export function screenShakeState(reducedMotion = false): ScreenShakeState {
  const preference = screenShakePreference();
  return {
    preference,
    enabled: preference === 'on' && !reducedMotion,
    reducedByMotion: preference === 'on' && reducedMotion,
  };
}

function isFlashEffectsPreference(value: string | null): value is FlashEffectsPreference {
  return value === 'full' || value === 'reduced';
}

export function flashEffectsPreference(): FlashEffectsPreference {
  if (flashEffectsPreferenceLoaded) return sessionFlashEffectsPreference ?? 'full';
  flashEffectsPreferenceLoaded = true;
  const stored = safeStorageGet(FLASH_EFFECTS_STORAGE_KEY);
  if (isFlashEffectsPreference(stored)) {
    sessionFlashEffectsPreference = stored;
    return stored;
  }
  if (stored !== null) safeStorageRemove(FLASH_EFFECTS_STORAGE_KEY);
  return sessionFlashEffectsPreference ?? 'full';
}

export function setFlashEffectsPreference(value: FlashEffectsPreference): boolean {
  flashEffectsPreferenceLoaded = true;
  sessionFlashEffectsPreference = value;
  return safeStorageSet(FLASH_EFFECTS_STORAGE_KEY, value);
}

export function flashEffectsState(reducedMotion = false): FlashEffectsState {
  const preference = flashEffectsPreference();
  return {
    preference,
    reduced: preference === 'reduced' || reducedMotion,
    reducedByMotion: preference === 'full' && reducedMotion,
  };
}
