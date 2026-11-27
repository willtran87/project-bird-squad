import { safeStorageGet, safeStorageRemove, safeStorageSet } from './safe-storage';

export type GraphicsQualityPreference = 'auto' | 'full' | 'lean';
export type EffectiveGraphicsQuality = Exclude<GraphicsQualityPreference, 'auto'>;
export type GraphicsQualityReason = 'manual' | 'save-data' | 'low-memory' | 'low-core-count' | 'device-default' | 'frame-time';
/** What is drawn: `trimmed` is Full with the costliest dressing removed
 * (fog, splash rings, motes, horizon glow, steam, shader passes) and the
 * canvas at one device pixel per game pixel. Only Auto reaches it, after the
 * measured frame time stayed high. */
export type GraphicsTier = 'full' | 'trimmed' | 'lean';

export interface GraphicsQualityState {
  preference: GraphicsQualityPreference;
  effective: EffectiveGraphicsQuality;
  lean: boolean;
  reason: GraphicsQualityReason;
  tier: GraphicsTier;
  /** Automatic steps taken this session because frames were slow (0-2). */
  autoStep: number;
  /** Highest device-pixel ratio the canvas may render at. */
  renderRatioCap: number;
  particleScale: number;
  particleBurstCap: number;
  ambientAnimations: boolean;
}

const STORAGE_KEY = 'birdsquad.graphicsQuality';
let sessionPreference: GraphicsQualityPreference | undefined;
let preferenceLoaded = false;
// Session only: a reload measures again.
let autoStep = 0;

export const MAX_AUTO_STEP = 2;

/** Taken by the frame governor; ignored unless the preference is Auto. */
export function setAutoGraphicsStep(step: number) {
  autoStep = Math.max(0, Math.min(MAX_AUTO_STEP, Math.floor(step)));
}

export function autoGraphicsStep() {
  return autoStep;
}

function isGraphicsQualityPreference(value: string | null): value is GraphicsQualityPreference {
  return value === 'auto' || value === 'full' || value === 'lean';
}

function automaticQuality(): { effective: EffectiveGraphicsQuality; reason: GraphicsQualityReason } {
  if (typeof navigator === 'undefined') return { effective: 'full', reason: 'device-default' };

  const capabilities = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (capabilities.connection?.saveData) return { effective: 'lean', reason: 'save-data' };
  if (typeof capabilities.deviceMemory === 'number' && capabilities.deviceMemory <= 4) {
    return { effective: 'lean', reason: 'low-memory' };
  }
  if (typeof capabilities.hardwareConcurrency === 'number' && capabilities.hardwareConcurrency <= 2) {
    return { effective: 'lean', reason: 'low-core-count' };
  }
  return { effective: 'full', reason: 'device-default' };
}

export function graphicsQualityPreference(): GraphicsQualityPreference {
  if (preferenceLoaded) return sessionPreference ?? 'auto';
  preferenceLoaded = true;
  const stored = safeStorageGet(STORAGE_KEY);
  if (isGraphicsQualityPreference(stored)) {
    sessionPreference = stored;
    return stored;
  }
  if (stored !== null) safeStorageRemove(STORAGE_KEY);
  return sessionPreference ?? 'auto';
}

export function setGraphicsQualityPreference(value: GraphicsQualityPreference): boolean {
  preferenceLoaded = true;
  // Choosing a level is an explicit choice; choosing Auto again starts fresh.
  if (value !== sessionPreference) autoStep = 0;
  sessionPreference = value;
  return safeStorageSet(STORAGE_KEY, value);
}

export function graphicsQualityState(): GraphicsQualityState {
  const preference = graphicsQualityPreference();
  let automatic = preference === 'auto' ? automaticQuality() : undefined;
  let tier: GraphicsTier = (automatic?.effective ?? preference) === 'lean' ? 'lean' : 'full';
  if (automatic && tier === 'full' && autoStep > 0) {
    tier = autoStep >= 2 ? 'lean' : 'trimmed';
    automatic = { effective: tier === 'lean' ? 'lean' : 'full', reason: 'frame-time' };
  }
  const effective = automatic?.effective ?? (preference as EffectiveGraphicsQuality);
  const lean = effective === 'lean';
  const trimmed = tier === 'trimmed';
  return {
    preference,
    effective,
    lean,
    reason: automatic?.reason ?? 'manual',
    tier,
    autoStep: preference === 'auto' ? autoStep : 0,
    renderRatioCap: tier === 'full' ? 2 : 1,
    particleScale: lean ? 0.5 : trimmed ? 0.75 : 1,
    particleBurstCap: lean ? 2 : trimmed ? 3 : 4,
    ambientAnimations: !lean,
  };
}

export function prefersLeanEffects(): boolean {
  return graphicsQualityState().lean;
}

/** Full dressing: weather, glow and shader passes all drawn. */
export function fullGraphicsTier(): boolean {
  return graphicsQualityState().tier === 'full';
}
