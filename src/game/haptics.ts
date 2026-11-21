import type Phaser from 'phaser';
import type { HapticMoment } from './haptic-dispatch';
import { dispatchHaptic, recentHaptics, type HapticEnvironment, type HapticResult, type PadLike } from './haptic-dispatch';
import { rumbleState } from './shared/preferences';

/** Controller rumble and short touch pulses on big moments, behind the Rumble
 *  setting (default on) and Screen Shake. See ../haptic-dispatch.ts. */
function touchFirstDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return coarse || (navigator.maxTouchPoints ?? 0) > 0;
}

function browserEnvironment(scene?: Phaser.Scene): HapticEnvironment {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const pads = (() => {
    try { return [...(nav?.getGamepads?.() ?? [])] as (PadLike | null)[]; } catch { return []; }
  })();
  const vibrate = nav && typeof nav.vibrate === 'function' && touchFirstDevice()
    ? (pattern: number[]) => nav.vibrate(pattern)
    : undefined;
  const now = scene?.game?.loop?.time ?? (typeof performance === 'undefined' ? Date.now() : performance.now());
  return { enabled: rumbleState().enabled, pads, vibrate, now };
}

/** Fire a haptic moment in the browser. Returns what was actually driven. */
export function pulseHaptic(scene: Phaser.Scene | undefined, moment: HapticMoment): HapticResult | undefined {
  try {
    return dispatchHaptic(moment, browserEnvironment(scene));
  } catch {
    return undefined;
  }
}

export function hapticsSnapshot() {
  return { ...rumbleState(), recent: recentHaptics() };
}

// Test and diagnostics hook; installed when combat or Settings first loads this module.
if (typeof window !== 'undefined') (window as Window & { __birdSquadHaptics?: typeof hapticsSnapshot }).__birdSquadHaptics = hapticsSnapshot;
