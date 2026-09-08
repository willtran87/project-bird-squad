import type Phaser from 'phaser';
import { setMemoryStorageSession, memoryStorageSessionActive, removeJournaledJson } from './safe-storage';

let previousResult: Window['__birdSquadLastRun'];
let startingDeck: Array<{ id: string; upgraded: boolean }> | undefined;

export function beginPracticeSession(cards?: Array<{ id: string; upgraded: boolean }>): boolean {
  if (memoryStorageSessionActive()) return false;
  const snapshot = new Map<string, string>();
  try {
    const disk = window.localStorage;
    for (let index = 0; index < disk.length; index += 1) {
      const key = disk.key(index);
      if (key !== null) {
        const value = disk.getItem(key);
        if (value !== null) snapshot.set(key, value);
      }
    }
  } catch {
    // Storage-denied browsers can still practice entirely in memory.
  }
  setMemoryStorageSession({
    getItem: (key) => snapshot.get(key) ?? null,
    setItem: (key, value) => { snapshot.set(key, value); },
    removeItem: (key) => { snapshot.delete(key); },
  });
  previousResult = window.__birdSquadLastRun;
  startingDeck = cards?.map(card => ({ ...card }));
  // A practice flight must never resume the player's real flight.
  removeJournaledJson('birdsquad.run.active');
  return true;
}

export function endPracticeSession(): void {
  if (!memoryStorageSessionActive()) return;
  setMemoryStorageSession();
  window.__birdSquadLastRun = previousResult;
  previousResult = undefined;
  startingDeck = undefined;
}

export function practiceStartingDeck() {
  return startingDeck?.map(card => ({ ...card }));
}

export function renderPracticeBadge(scene: Phaser.Scene): void {
  if (!memoryStorageSessionActive() || scene.children.getByName('practice-session-badge')) return;
  // Scene-level object stays above battle/reward containers, never covers a control.
  scene.add.text(640, 0, 'PRACTICE · nothing saved', {
    fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold',
    color: '#dcfff4', backgroundColor: '#103629', padding: { x: 10, y: 2 },
  }).setOrigin(0.5, 0).setResolution(2).setDepth(1_000_000).setName('practice-session-badge');
}
