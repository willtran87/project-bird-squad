
/**
 * Pure haptic dispatch: drives Gamepad `vibrationActuator` rumble and
 * `navigator.vibrate` against an explicit environment. Every path is optional;
 * unsupported browsers, no pad, or a rejected effect are silent no-ops.
 * Browser glue (preferences, navigator) lives in shared/haptics.ts.
 */
export type HapticMoment = 'heavyHit' | 'finishingBlow' | 'surge' | 'flockHit';

export interface HapticPattern {
  /** Gamepad dual-rumble effect. */
  durationMs: number;
  strong: number;
  weak: number;
  /** navigator.vibrate pattern for touch devices (kept short). */
  vibrate: number[];
}

const HAPTIC_PATTERNS: Record<HapticMoment, HapticPattern> = {
  heavyHit: { durationMs: 140, strong: 0.65, weak: 0.4, vibrate: [35] },
  flockHit: { durationMs: 120, strong: 0.5, weak: 0.35, vibrate: [25] },
  finishingBlow: { durationMs: 260, strong: 0.9, weak: 0.6, vibrate: [45, 40, 60] },
  surge: { durationMs: 200, strong: 0.25, weak: 0.75, vibrate: [20, 30, 20] },
};

export function hapticPattern(moment: HapticMoment): HapticPattern {
  return HAPTIC_PATTERNS[moment];
}

export interface ActuatorLike {
  playEffect?: (type: string, params: { duration: number; startDelay?: number; strongMagnitude: number; weakMagnitude: number }) => Promise<unknown>;
  pulse?: (value: number, duration: number) => Promise<unknown>;
}

export interface PadLike {
  connected?: boolean;
  vibrationActuator?: ActuatorLike | null;
  hapticActuators?: readonly ActuatorLike[];
}

export interface HapticEnvironment {
  enabled: boolean;
  pads: readonly (PadLike | null)[];
  /** Present only on touch-first devices that expose `navigator.vibrate`. */
  vibrate?: (pattern: number[]) => boolean;
  now: number;
}

export interface HapticResult {
  moment: HapticMoment;
  gamepads: number;
  touch: boolean;
}

const MIN_GAP_MS = 70;
let lastPulseAt = Number.NEGATIVE_INFINITY;
const log: HapticResult[] = [];

export function recentHaptics() {
  return log.slice(-8);
}

/** Dispatch one moment against an explicit environment (unit-tested). */
export function dispatchHaptic(moment: HapticMoment, env: HapticEnvironment): HapticResult | undefined {
  if (!env.enabled) return undefined;
  // A finishing blow always lands; smaller moments never stack into a buzz.
  if (moment !== 'finishingBlow' && env.now - lastPulseAt < MIN_GAP_MS) return undefined;
  const pattern = hapticPattern(moment);
  let gamepads = 0;
  for (const pad of env.pads) {
    if (!pad || pad.connected === false) continue;
    const actuator = pad.vibrationActuator;
    try {
      if (actuator?.playEffect) {
        void actuator.playEffect('dual-rumble', {
          duration: pattern.durationMs, startDelay: 0,
          strongMagnitude: pattern.strong, weakMagnitude: pattern.weak,
        }).catch(() => undefined);
        gamepads += 1;
      } else if (pad.hapticActuators?.[0]?.pulse) {
        void pad.hapticActuators[0].pulse(Math.max(pattern.strong, pattern.weak), pattern.durationMs)?.catch?.(() => undefined);
        gamepads += 1;
      }
    } catch {
      // Some browsers throw synchronously for unsupported effects.
    }
  }
  let touch = false;
  if (env.vibrate) {
    try { touch = env.vibrate(pattern.vibrate); } catch { touch = false; }
  }
  if (!gamepads && !touch) return undefined;
  lastPulseAt = env.now;
  const result = { moment, gamepads, touch };
  log.push(result);
  if (log.length > 20) log.shift();
  return result;
}

export function resetHapticsForTest() {
  lastPulseAt = Number.NEGATIVE_INFINITY;
  log.length = 0;
}
