import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchHaptic, resetHapticsForTest } from './haptic-dispatch';

const padWith = (playEffect: (...args: unknown[]) => Promise<unknown> = vi.fn(() => Promise.resolve())) => ({ connected: true, vibrationActuator: { playEffect } });

describe('haptic dispatch', () => {
  beforeEach(() => resetHapticsForTest());

  it('is a no-op when disabled, unsupported or without devices', () => {
    const playEffect = vi.fn(() => Promise.resolve());
    expect(dispatchHaptic('heavyHit', { enabled: false, pads: [padWith(playEffect)], now: 0 })).toBeUndefined();
    expect(playEffect).not.toHaveBeenCalled();
    expect(dispatchHaptic('heavyHit', { enabled: true, pads: [], now: 0 })).toBeUndefined();
    expect(dispatchHaptic('heavyHit', { enabled: true, pads: [null, { connected: true }], now: 0 })).toBeUndefined();
  });

  it('drives dual-rumble on every connected pad and a short touch pulse', () => {
    const a = vi.fn(() => Promise.resolve());
    const b = vi.fn(() => Promise.resolve());
    const vibrate = vi.fn(() => true);
    const result = dispatchHaptic('finishingBlow', { enabled: true, pads: [padWith(a), { connected: false, vibrationActuator: { playEffect: b } }], vibrate, now: 0 });
    expect(result).toEqual({ moment: 'finishingBlow', gamepads: 1, touch: true });
    expect(a).toHaveBeenCalledWith('dual-rumble', expect.objectContaining({ strongMagnitude: expect.any(Number), weakMagnitude: expect.any(Number) }));
    expect(b).not.toHaveBeenCalled();
    expect(vibrate).toHaveBeenCalledWith([45, 40, 60]);
  });

  it('falls back to hapticActuators.pulse and survives synchronous throws and rejections', () => {
    const pulse = vi.fn(() => Promise.reject(new Error('nope')));
    expect(dispatchHaptic('surge', { enabled: true, pads: [{ connected: true, hapticActuators: [{ pulse }] }], now: 0 })?.gamepads).toBe(1);
    resetHapticsForTest();
    const throwing = { connected: true, vibrationActuator: { playEffect: () => { throw new Error('unsupported'); } } };
    expect(() => dispatchHaptic('surge', { enabled: true, pads: [throwing], vibrate: () => { throw new Error('blocked'); }, now: 0 })).not.toThrow();
  });

  it('does not stack small moments, but a finishing blow always lands', () => {
    const playEffect = vi.fn(() => Promise.resolve());
    const pads = [padWith(playEffect)];
    expect(dispatchHaptic('heavyHit', { enabled: true, pads, now: 1000 })).toBeDefined();
    expect(dispatchHaptic('flockHit', { enabled: true, pads, now: 1020 })).toBeUndefined();
    expect(dispatchHaptic('finishingBlow', { enabled: true, pads, now: 1030 })).toBeDefined();
    expect(dispatchHaptic('heavyHit', { enabled: true, pads, now: 1200 })).toBeDefined();
    expect(playEffect).toHaveBeenCalledTimes(3);
  });
});
