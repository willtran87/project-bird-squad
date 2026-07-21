import { safeStorageGet, safeStorageRemove, safeStorageSet } from './safe-storage';

export type GraphicsQualityPreference = 'auto' | 'full' | 'lean';
export type EffectiveGraphicsQuality = Exclude<GraphicsQualityPreference, 'auto'>;
export type GraphicsQualityReason = 'manual' | 'save-data' | 'low-memory' | 'low-core-count' | 'device-default';

export interface GraphicsQualityState {
  preference: GraphicsQualityPreference;
  effective: EffectiveGraphicsQuality;
  lean: boolean;
  reason: GraphicsQualityReason;
  particleScale: number;
  particleBurstCap: number;
  ambientAnimations: boolean;
}

const STORAGE_KEY = 'birdsquad.graphicsQuality';
let sessionPreference: GraphicsQualityPreference | undefined;
let preferenceLoaded = false;

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
  sessionPreference = value;
  return safeStorageSet(STORAGE_KEY, value);
}

export function graphicsQualityState(): GraphicsQualityState {
  const preference = graphicsQualityPreference();
  const automatic = preference === 'auto' ? automaticQuality() : undefined;
  const effective = automatic?.effective ?? (preference as EffectiveGraphicsQuality);
  const lean = effective === 'lean';
  return {
    preference,
    effective,
    lean,
    reason: automatic?.reason ?? 'manual',
    particleScale: lean ? 0.5 : 1,
    particleBurstCap: lean ? 2 : 4,
    ambientAnimations: !lean,
  };
}

export function prefersLeanEffects(): boolean {
  return graphicsQualityState().lean;
}
