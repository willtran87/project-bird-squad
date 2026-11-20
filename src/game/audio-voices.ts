import type { CardSuit } from './types';
import { budgetFor } from './audio-cue-budget';
import {
  PitchLadder, SUIT_CALLS, clamp, countTickRatio, impactScale, leaderCall, pitchLadderRatio,
  type AudioMaterial, type BirdAudioEvent, type BirdAudioEventMap, type BirdCallShape, type ImpactScale, type StingerId,
} from './audio-events';

/**
 * Synthesised voices for the typed audio events: materials, bird calls, impacts
 * and stingers. Everything is built from oscillators and filtered noise at play
 * time. The bird calls are stylised shapes, not recordings.
 */

export type SynthContext = {
  ctx: AudioContext;
  master: GainNode;
  /** Lane volume (effects or voices) already multiplied by the cue intensity. */
  sfxVolume: number;
};

export function tone(
  audio: SynthContext,
  startFreq: number,
  endFreq: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  pan = 0,
  at = 0,
) {
  const { ctx, master, sfxVolume } = audio;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = 'StereoPannerNode' in window ? ctx.createStereoPanner() : undefined;
  const now = ctx.currentTime + at;
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, startFreq), now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * sfxVolume), now + Math.min(0.012, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  if (panner) {
    panner.pan.setValueAtTime(clamp(pan, -1, 1), now);
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(master);
  } else {
    osc.connect(gain);
    gain.connect(master);
  }
  osc.start(now);
  osc.stop(now + duration + 0.02);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); panner?.disconnect(); };
}

export function chord(audio: SynthContext, freqs: number[], duration: number, type: OscillatorType, volume: number, at = 0) {
  freqs.forEach((freq, index) => tone(
    audio, freq, freq * 1.08, duration, type, volume / Math.sqrt(freqs.length), (index - 1) * 0.16, at + index * 0.022,
  ));
}

export function noise(
  audio: SynthContext,
  duration: number,
  filterFreq: number,
  volume: number,
  at = 0,
  q = 1.8,
  filterType: BiquadFilterType = 'bandpass',
) {
  const { ctx, master, sfxVolume } = audio;
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  const now = ctx.currentTime + at;
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, now);
  filter.Q.setValueAtTime(q, now);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.0001, volume * sfxVolume), now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(now);
  source.stop(now + duration + 0.02);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
}

// ------------------------------------------------------------------- interface

/** Soft click: a tiny bright tick with almost no pitch. */
export function uiClick(a: SynthContext) {
  noise(a, 0.012, 3200, 0.014, 0, 2.5);
  tone(a, 1900, 1500, 0.018, 'sine', 0.008);
}

/** Confirm: the click, then a rising two-note answer. */
export function uiConfirm(a: SynthContext) {
  noise(a, 0.012, 3200, 0.01, 0, 2.5);
  tone(a, 520, 540, 0.07, 'sine', 0.022, -0.08);
  tone(a, 780, 800, 0.12, 'sine', 0.024, 0.08, 0.06);
}

/** Cancel: a soft falling two-note step back. */
export function uiCancel(a: SynthContext) {
  noise(a, 0.03, 700, 0.006, 0, 1);
  tone(a, 440, 300, 0.09, 'triangle', 0.022, 0.08);
  tone(a, 300, 200, 0.1, 'sine', 0.016, -0.08, 0.05);
}

// ------------------------------------------------------------------- materials

/** Paper sliding off the deck: a short bright swish. */
export function paperDraw(a: SynthContext, pitch = 1) {
  noise(a, 0.05, 2600 * pitch, 0.014, 0, 1.2);
  noise(a, 0.035, 5200 * pitch, 0.007, 0.018, 1);
}

/** Paper slapped on the table: a dull contact, then the sheet settling. */
export function paperPlay(a: SynthContext, pitch = 1) {
  noise(a, 0.035, 1800 * pitch, 0.018, 0, 1);
  noise(a, 0.09, 3600 * pitch, 0.008, 0.012, 0.8);
  tone(a, 180 * pitch, 120 * pitch, 0.05, 'sine', 0.012);
}

/** Paper dropped on a pile: lower and falling. */
export function paperDiscard(a: SynthContext) {
  noise(a, 0.08, 1500, 0.012, 0, 1);
  noise(a, 0.06, 850, 0.009, 0.04, 1);
}

/** A riffle of card edges, then the deck squared up. */
export function paperShuffle(a: SynthContext) {
  for (let index = 0; index < 5; index += 1) noise(a, 0.02, 2600 + index * 180, 0.009, index * 0.028, 2);
  noise(a, 0.05, 1500, 0.014, 0.16, 1);
}

/** Struck metal: inharmonic partials that ring past a hard tick. */
export function metalTap(a: SynthContext, pitch = 1) {
  const base = 1240 * pitch;
  noise(a, 0.012, 6000, 0.012, 0, 1.5);
  ([[1, 0.26, 0.014], [2.76, 0.19, 0.008], [5.4, 0.12, 0.005], [8.93, 0.07, 0.003]] as const)
    .forEach(([ratio, duration, volume], index) => tone(a, base * ratio, base * ratio * 0.997, duration, 'sine', volume, index % 2 ? 0.14 : -0.14));
}

/** Knocked wood: a short hollow body with a damped overtone. */
export function woodKnock(a: SynthContext, pitch = 1) {
  noise(a, 0.018, 1100 * pitch, 0.014, 0, 3);
  tone(a, 420 * pitch, 300 * pitch, 0.05, 'sine', 0.032);
  tone(a, 840 * pitch, 700 * pitch, 0.03, 'triangle', 0.012);
}

/** A water drop: upward blips over a soft wash. */
export function waterDrop(a: SynthContext, pitch = 1) {
  noise(a, 0.12, 500, 0.006, 0, 0.8, 'lowpass');
  tone(a, 520 * pitch, 1500 * pitch, 0.07, 'sine', 0.022, -0.1);
  tone(a, 900 * pitch, 1900 * pitch, 0.05, 'sine', 0.011, 0.12, 0.09);
}

export function materialTap(a: SynthContext, material: AudioMaterial, pitch = 1) {
  if (material === 'metal') metalTap(a, pitch);
  else if (material === 'wood') woodKnock(a, pitch);
  else if (material === 'water') waterDrop(a, pitch);
  else paperPlay(a, pitch);
}

// ------------------------------------------------------------------ bird calls

export function birdCall(a: SynthContext, shape: BirdCallShape, pitch = 1) {
  shape.notes.forEach(([at, duration, from, to, wave, gain], index) => tone(
    a, from * pitch, to * pitch, duration, wave, gain, index % 2 ? 0.12 : -0.12, at,
  ));
  if (shape.rasp) noise(a, shape.rasp[1], shape.rasp[2] * pitch, shape.rasp[3], shape.rasp[0], 2.5);
}

// --------------------------------------------------------------------- impacts

/** Light tick to heavy thud: body, crack and tick all follow the damage share. */
export function impact(a: SynthContext, scale: ImpactScale, lethal = false) {
  const { gain, bodyHz, durationS, tier } = scale;
  tone(a, bodyHz * 1.9, bodyHz * 0.62, durationS, 'sine', 0.04 * gain);
  noise(a, 0.02, 3600, 0.012 * gain, 0, 1.4);
  if (tier !== 'tick') {
    noise(a, durationS * 0.6, 520 + 900 / gain, 0.026 * gain, 0, 1.2);
    tone(a, bodyHz * 2.6, bodyHz * 1.3, durationS * 0.6, 'sawtooth', 0.016 * gain);
  }
  if (tier === 'heavy') {
    tone(a, 62, 28, durationS + 0.08, 'sine', 0.07);
    tone(a, 196, 98, 0.09, 'square', 0.014);
  }
  if (lethal) {
    tone(a, 240, 60, 0.36, 'triangle', 0.024, 0, 0.04);
    noise(a, 0.26, 900, 0.014, 0.03, 0.8);
  }
}

/** Cover takes the hit: padded and dull, nothing rings. */
export function coverAbsorb(a: SynthContext) {
  noise(a, 0.06, 420, 0.024, 0, 1, 'lowpass');
  tone(a, 210, 150, 0.09, 'sine', 0.024);
  tone(a, 620, 540, 0.04, 'triangle', 0.006, 0.1);
}

/** Cover gives way: a hard crack and falling shards. */
export function coverBreak(a: SynthContext) {
  noise(a, 0.03, 4200, 0.03, 0, 1.2);
  tone(a, 900, 240, 0.12, 'square', 0.014, -0.12);
  [2400, 3100, 3900, 2800].forEach((freq, index) => tone(
    a, freq, freq * 0.82, 0.06, 'sine', 0.007, index % 2 ? 0.3 : -0.3, 0.03 + index * 0.032,
  ));
  noise(a, 0.2, 2600, 0.01, 0.03, 1);
}

// -------------------------------------------------------------------- stingers

function arpeggio(a: SynthContext, freqs: number[], everyS: number, noteS: number, type: OscillatorType, volume: number, at = 0) {
  freqs.forEach((freq, index) => tone(a, freq, freq * 1.01, noteS, type, volume, (index % 3 - 1) * 0.18, at + index * everyS));
}

export function stinger(a: SynthContext, id: StingerId) {
  switch (id) {
    case 'victory':
      noise(a, 0.12, 1900, 0.012);
      arpeggio(a, [392, 494, 587, 784], 0.09, 0.2, 'triangle', 0.02);
      chord(a, [392, 494, 659, 784], 0.6, 'sine', 0.024, 0.36);
      noise(a, 0.1, 2600, 0.008, 0.4);
      break;
    case 'defeat':
      arpeggio(a, [392, 311, 262, 196], 0.2, 0.3, 'triangle', 0.024);
      tone(a, 98, 49, 0.9, 'sine', 0.036, 0, 0.6);
      noise(a, 0.4, 360, 0.016, 0.6, 0.8);
      break;
    case 'reward':
      arpeggio(a, [660, 990, 1320], 0.05, 0.16, 'sine', 0.016);
      metalTap(a, 1.5);
      break;
    case 'molt':
      tone(a, 220, 880, 0.42, 'triangle', 0.02);
      arpeggio(a, [660, 880, 1320, 1760], 0.07, 0.16, 'sine', 0.012, 0.16);
      noise(a, 0.4, 2400, 0.008, 0, 0.7);
      break;
    case 'bossPhase':
      tone(a, 73, 69, 0.55, 'sawtooth', 0.03, -0.1);
      tone(a, 103, 98, 0.55, 'sawtooth', 0.022, 0.1);
      tone(a, 440, 622, 0.3, 'square', 0.01, 0, 0.08);
      noise(a, 0.32, 600, 0.024, 0, 0.8);
      break;
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

/** Boss entrance: a sub swell under a low, slightly sour reed. */
export function bossEntrance(a: SynthContext) {
  tone(a, 40, 55, 0.9, 'sine', 0.07);
  tone(a, 110, 104, 0.8, 'sawtooth', 0.02, -0.1);
  tone(a, 156, 147, 0.7, 'sawtooth', 0.012, 0.1, 0.1);
  noise(a, 0.6, 300, 0.02, 0, 0.8, 'lowpass');
}

// ------------------------------------------------------------- event dispatch

interface VoiceState {
  ladder: PitchLadder;
  /** ctx.currentTime (ms) of the last scaled hit; legacy attack cues in the same tick are absorbed. */
  impactAtMs: number;
}

const states = new WeakMap<AudioContext, VoiceState>();

export function voiceState(ctx: AudioContext) {
  let state = states.get(ctx);
  if (!state) states.set(ctx, state = { ladder: new PitchLadder(), impactAtMs: -Infinity });
  return state;
}

const SUIT_MATERIAL: Record<CardSuit, AudioMaterial | undefined> = {
  plumes: undefined, quills: undefined, basins: 'water', nests: 'wood',
};

export interface AudioEventVolumes {
  sfx: number;
  voice: number;
}

/** Plays one typed event. Returns false when the budget drops it or the event is silent. */
export function playAudioEvent<E extends BirdAudioEvent>(
  ctx: AudioContext,
  master: GainNode,
  volumes: AudioEventVolumes,
  event: E,
  detail?: BirdAudioEventMap[E],
) {
  const data = (detail ?? {}) as Partial<
    BirdAudioEventMap['card.play'] & BirdAudioEventMap['hit.impact'] & BirdAudioEventMap['count.tick']
    & BirdAudioEventMap['material.tap'] & BirdAudioEventMap['voice.leader'] & BirdAudioEventMap['stinger.play']
    & BirdAudioEventMap['battle.enter'] & BirdAudioEventMap['card.draw']
  >;
  const state = voiceState(ctx);
  const nowMs = ctx.currentTime * 1000;
  if (event === 'turn.start') { state.ladder.reset(); return false; }
  if (event === 'flock.formation' || event === 'district.enter' || event === 'overlay.set') return false;
  if (event === 'battle.enter') {
    state.ladder.reset();
    if (data.tier !== 'boss') return false;
  }
  if (!budgetFor(ctx).accepts(event, nowMs)) return false;
  const level = clamp(data.intensity ?? (data.count ? 0.72 + data.count * 0.08 : 1), 0.45, 1.8);
  const sfx: SynthContext = { ctx, master, sfxVolume: volumes.sfx * level };
  const voice: SynthContext = { ctx, master, sfxVolume: volumes.voice * level };
  switch (event) {
    case 'ui.click': uiClick(sfx); break;
    case 'ui.confirm': uiConfirm(sfx); break;
    case 'ui.cancel': uiCancel(sfx); break;
    case 'card.draw': paperDraw(sfx); break;
    case 'card.discard': paperDiscard(sfx); break;
    case 'card.play': {
      const pitch = pitchLadderRatio(state.ladder.next(nowMs));
      paperPlay(sfx, pitch);
      const suit = data.suit ?? undefined;
      const material = suit && SUIT_MATERIAL[suit];
      if (material) materialTap(sfx, material, pitch);
      // Calls climb half as far as the paper so the top of the ladder stays a bird, not a whistle.
      if (suit) birdCall(voice, SUIT_CALLS[suit], Math.sqrt(pitch));
      if (data.molt) tone(sfx, 690 * pitch, 1380 * pitch, 0.12, 'sine', 0.01);
      break;
    }
    case 'material.tap': materialTap(sfx, data.material ?? 'paper'); break;
    case 'voice.suit': if (data.suit) birdCall(voice, SUIT_CALLS[data.suit]); break;
    case 'voice.leader': birdCall(voice, leaderCall(data.leader ?? '')); break;
    case 'hit.impact':
      state.impactAtMs = nowMs;
      impact(sfx, impactScale(data.damage ?? 0, data.maxHp ?? 0, data.lethal), data.lethal);
      if (data.coverBroke) coverBreak(sfx);
      break;
    case 'cover.absorb': coverAbsorb(sfx); break;
    case 'cover.break': coverBreak(sfx); break;
    case 'count.tick': {
      const ratio = countTickRatio(data.step ?? 0, data.of);
      tone(sfx, 880 * ratio, 900 * ratio, 0.035, 'sine', 0.012);
      noise(sfx, 0.01, 4200, 0.004, 0, 2);
      break;
    }
    case 'stinger.play': stinger(sfx, data.id ?? 'reward'); break;
    case 'battle.enter': bossEntrance(sfx); break;
    default: return false;
  }
  return true;
}
