import { test, expect } from '@playwright/test';
import { lazyModule } from '../src/game/lazy-module';

test('lazy modules keep imports deferred, deduplicate and retain successful identity', async () => {
  let calls = 0;
  const module = { ready: true };
  const load = lazyModule(() => { calls++; return Promise.resolve(module); });
  expect(calls).toBe(0);
  const a = load(), b = load();
  expect(a).toBe(b); expect(calls).toBe(1);
  expect(await a).toBe(module); expect(load()).toBe(a);
});

test('failed and synchronous imports can retry without affecting other features', async () => {
  let calls = 0;
  const error = new Error('offline');
  const load = lazyModule(() => ++calls === 1 ? Promise.reject(error) : Promise.resolve('ready'));
  const independent = lazyModule(() => Promise.resolve('other'));
  const first = load(); expect(load()).toBe(first);
  await expect(first).rejects.toBe(error);
  expect(await independent()).toBe('other');
  const retried = load(); expect(retried).not.toBe(first);
  expect(await retried).toBe('ready'); expect(calls).toBe(2);
  let attempts = 0;
  const sync = lazyModule(() => { if (++attempts === 1) throw error; return Promise.resolve(1); });
  expect(() => sync()).toThrow('offline'); expect(await sync()).toBe(1);
});
