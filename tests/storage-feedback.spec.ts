import { test, expect } from '@playwright/test';
import { safeStorageSet, safeStorageGet, safeStorageRemove, storageWriteResults,
  setMemoryStorageSession, writeJournaledJson, readJournaledJson } from '../src/game/safe-storage';
import { screenReaderSummary } from '../src/game/screen-reader-summary';

test('storage feedback preserves failures per key, successful retries and disposable isolation', () => {
  const original = (globalThis as any).window;
  const entries = new Map<string, string>();
  let blocked = false;
  const backend = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { if (blocked) throw Error('quota'); entries.set(key, String(value)); },
    removeItem: (key: string) => { if (blocked) throw Error('blocked'); entries.delete(key); },
  };
  try {
    (globalThis as any).window = { localStorage: backend };
    expect(safeStorageSet('a', 'old')).toBe(true);
    blocked = true;
    expect(safeStorageSet('a', 'new')).toBe(false);
    expect(safeStorageRemove('a')).toBe(false);
    expect(safeStorageSet('b', 'new')).toBe(false);
    expect(safeStorageGet('a')).toBe('old');
    expect(storageWriteResults.get('a')).toBe(false);
    setMemoryStorageSession({ ...backend, setItem: () => {}, removeItem: () => {} });
    expect(safeStorageSet('a', 'practice')).toBe(true);
    expect(storageWriteResults.get('a')).toBe(false);
    setMemoryStorageSession(); blocked = false;
    expect(safeStorageSet('a', 'new')).toBe(true);
    expect(storageWriteResults.get('a')).toBe(true);
    expect(storageWriteResults.get('b')).toBe(false);
    expect(safeStorageRemove('a')).toBe(true);
    expect(safeStorageGet('a')).toBeNull();
    expect(writeJournaledJson('save', { ok: true })).toBe(true);
    expect(readJournaledJson('save', value => value as { ok: boolean })).toEqual({ ok: true });
    (globalThis as any).window = { get localStorage() { throw Error('getter blocked'); } };
    expect(safeStorageGet('c')).toBeNull();
    expect(safeStorageSet('c', 'x')).toBe(false);
    expect(storageWriteResults.get('c')).toBe(false);
    expect(safeStorageRemove('c')).toBe(false);
  } finally {
    setMemoryStorageSession(); storageWriteResults.clear();
    (globalThis as any).window = original;
  }
});

test('storage feedback and focused explanations remain available in announcements', () => {
  const settingsFocus = { label: 'Motion', section: 'Accessibility', value: 'Reduced',
    explanation: 'Session-only. Change again to retry.', controlsStatus: 'Binding applied for this session only. Could not save.' };
  expect(screenReaderSummary({ settingsOpen: true, settingsFocus })).toContain(settingsFocus.explanation);
  expect(screenReaderSummary({ settingsOpen: true, settingsFocus, controls: {
    panelOpen: true, page: 'play', focusIndex: 0, bindings: { confirm: { label: 'Confirm', key: 'C' } },
  } })).toContain('Controls. play. Confirm: C. Binding applied for this session only. Could not save.');
  expect(screenReaderSummary({ settingsOpen: true, settingsFocus, controls: {
    panelOpen: true, page: 'utility', focusIndex: 6, bindings: {},
  } })).toContain('Reset Defaults');
});
