import { test, expect } from '@playwright/test';
import { AudioCueBudget } from '../src/game/audio-cue-budget';
import { playAudioCue } from '../src/game/audio-sfx';

test('supporting audio bursts stay bounded while tactical cues remain immediate', () => {
  const budget = new AudioCueBudget();
  expect(budget.accepts('draw', 0)).toBe(true);
  expect(budget.accepts('draw', 0)).toBe(false);
  expect(budget.accepts('flow', 1)).toBe(true);
  expect(budget.accepts('cover', 2)).toBe(true);
  expect(budget.accepts('heal', 3)).toBe(false);
  expect(budget.accepts('heavyAttack', 4)).toBe(true);
  expect(budget.accepts('coverBreak', 4)).toBe(true);
  expect(budget.accepts('draw', 90)).toBe(false);
  expect(budget.accepts('draw', 104)).toBe(true);
  expect(budget.accepts('enemyCommitment', 105)).toBe(true);
  expect(budget.accepts('enemyCommitment', 125)).toBe(false);
  expect(budget.accepts('enemyCommitment', 145)).toBe(true);
  expect(budget.accepts('locked', 146)).toBe(true);
  expect(budget.accepts('victory', 147)).toBe(true);
});

test('audio budgets are local, expire without replay queues, and preserve quiet single cues', () => {
  const first = new AudioCueBudget(), second = new AudioCueBudget();
  expect(first.accepts('attack', 10)).toBe(true);
  expect(second.accepts('draw', 10)).toBe(true);
  expect(first.accepts('draw', 20)).toBe(false);
  expect(first.accepts('draw', 111)).toBe(true);
  expect(first.accepts('heal', 250)).toBe(true);
  expect(first.accepts('cover', 400)).toBe(true);
});

test('completed synthesized cues disconnect their owned audio graph', () => {
  const nodes: any[] = [], sources: any[] = [];
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = (source = false) => {
    const result: any = { frequency: param(), gain: param(), Q: param(), pan: param(),
      connections: 0, connect() { this.connections++; }, disconnect() { this.connections = 0; }, start() {}, stop() {} };
    nodes.push(result); if (source) sources.push(result); return result;
  };
  const ctx: any = { currentTime: 1, sampleRate: 8000, createOscillator: () => node(true), createGain: () => node(),
    createStereoPanner: () => node(), createBiquadFilter: () => node(), createBufferSource: () => node(true),
    createBuffer: (_: number, length: number) => ({ getChannelData: () => new Float32Array(length) }) };
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { StereoPannerNode: true } });
  try {
    const master = node();
    expect(playAudioCue(ctx, master, 1, 'hitConfirm')).toBe(true);
    expect(sources).toHaveLength(3);
    expect(playAudioCue(ctx, master, 1, 'hitConfirm')).toBe(false);
    expect(sources).toHaveLength(3);
    sources.forEach(source => source.onended());
    expect(nodes.every(n => n.connections === 0)).toBe(true);
  } finally {
    if (prior) Object.defineProperty(globalThis, 'window', prior);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
