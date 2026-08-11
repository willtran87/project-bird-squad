import type { CardSuit } from './types';

export type AdaptiveMusicMood = 'menu' | 'route' | 'battle' | 'boss' | 'victory' | 'defeat';
export type CardAudioVoice = CardSuit | 'neutral';

export interface AdaptiveMusicSnapshot {
  pattern: string;
  active: boolean;
  step: number;
  pulses: number;
  cardVoices?: {
    requests: Partial<Record<CardAudioVoice, number>>;
    last?: { voice: CardAudioVoice; usesMolt: boolean; sequence: number; variant: number; volume: number };
  };
}

interface MusicProfile {
  id: string;
  base: number;
  intervals: number[];
  stepMs: number;
  duration: number;
  volume: number;
  type: OscillatorType;
  filter: number;
  accentEvery: number;
  harmony: number;
}

export class AdaptiveMusicSequencer {
  private ctx?: AudioContext;
  private bus?: GainNode;
  private mood: AdaptiveMusicMood = 'menu';
  private timer?: number;
  private step = 0;
  private pulses = 0;
  private generation = 0;
  private volume = 0;
  private cardVoiceRequests: Partial<Record<CardAudioVoice, number>> = {};
  private cardVoiceSequence = 0;
  private lastCardVoice?: { voice: CardAudioVoice; usesMolt: boolean; sequence: number; variant: number; volume: number };

  start(ctx: AudioContext, master: GainNode, mood: AdaptiveMusicMood, volume: number) {
    if (this.bus && this.ctx === ctx && this.mood === mood) {
      this.setVolume(volume);
      return;
    }
    this.stop();
    this.ctx = ctx;
    this.mood = mood;
    this.volume = clamp(volume, 0, 1);
    this.step = 0;
    const profile = musicProfile(mood);
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, profile.volume * this.volume),
      ctx.currentTime + 0.8,
    );
    bus.connect(master);
    this.bus = bus;
    this.generation += 1;
    this.schedule(profile, this.generation);
  }

  stop() {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
    this.generation += 1;
    if (this.bus && this.ctx) {
      const now = this.ctx.currentTime;
      this.bus.gain.cancelScheduledValues(now);
      this.bus.gain.setValueAtTime(Math.max(0.0001, this.bus.gain.value), now);
      this.bus.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    }
    this.bus = undefined;
  }

  setVolume(volume: number) {
    this.volume = clamp(volume, 0, 1);
    if (!this.bus || !this.ctx) return;
    const now = this.ctx.currentTime;
    const target = musicProfile(this.mood).volume * this.volume;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(Math.max(0.0001, this.bus.gain.value), now);
    this.bus.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), now + 0.16);
  }

  snapshot(): AdaptiveMusicSnapshot {
    return {
      pattern: musicProfile(this.mood).id,
      active: Boolean(this.bus && this.volume > 0.001),
      step: this.step,
      pulses: this.pulses,
      cardVoices: {
        requests: { ...this.cardVoiceRequests },
        last: this.lastCardVoice ? { ...this.lastCardVoice } : undefined,
      },
    };
  }

  playCardVoice(
    ctx: AudioContext,
    master: GainNode,
    voiceVolume: number,
    voice: CardAudioVoice,
    usesMolt: boolean,
    intensity: number,
  ) {
    this.cardVoiceRequests[voice] = (this.cardVoiceRequests[voice] ?? 0) + 1;
    const sequence = ++this.cardVoiceSequence;
    const variant = (sequence - 1) % 3;
    const volume = clamp(voiceVolume, 0, 1);
    this.lastCardVoice = { voice, usesMolt, sequence, variant, volume };
    playCardAudioVoice(ctx, master, volume, voice, usesMolt, intensity, variant);
  }

  private schedule(profile: MusicProfile, generation: number) {
    const pulse = () => {
      if (!this.bus || generation !== this.generation) return;
      if (this.volume > 0.001) {
        const interval = profile.intervals[this.step % profile.intervals.length];
        const frequency = profile.base * Math.pow(2, interval / 12);
        const accented = this.step % profile.accentEvery === 0;
        const pan = ((this.step % 5) - 2) * 0.1;
        this.tone(frequency, profile.duration, profile.type, accented ? 0.36 : 0.24, profile.filter, pan);
        if (accented) {
          const harmony = frequency * Math.pow(2, profile.harmony / 12);
          this.tone(harmony, profile.duration * 0.82, 'sine', 0.13, profile.filter * 1.2, -pan, 0.035);
        }
        this.pulses += 1;
      }
      this.step = (this.step + 1) % profile.intervals.length;
      this.timer = window.setTimeout(pulse, profile.stepMs);
    };
    this.timer = window.setTimeout(pulse, 140);
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    filterFrequency: number,
    pan: number,
    delay = 0,
  ) {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const panner = 'StereoPannerNode' in window ? ctx.createStereoPanner() : undefined;
    const start = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, frequency), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, frequency * 1.004), start + duration);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFrequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(filter);
    filter.connect(gain);
    if (panner) {
      panner.pan.setValueAtTime(clamp(pan, -1, 1), start);
      gain.connect(panner);
      panner.connect(bus);
    } else {
      gain.connect(bus);
    }
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }
}

function musicProfile(mood: AdaptiveMusicMood): MusicProfile {
  switch (mood) {
    case 'route': return {
      id: 'rooftop-wayfinding', base: 147, intervals: [0, 4, 7, 11, 7, 4, 2, 7],
      stepMs: 560, duration: 0.3, volume: 0.074, type: 'triangle', filter: 1380, accentEvery: 4, harmony: 7,
    };
    case 'battle': return {
      id: 'street-beat', base: 82, intervals: [0, 0, 7, 3, 0, 10, 7, 3],
      stepMs: 360, duration: 0.2, volume: 0.082, type: 'sawtooth', filter: 980, accentEvery: 4, harmony: 12,
    };
    case 'boss': return {
      id: 'high-pressure-flight', base: 73, intervals: [0, 1, 7, 6, 0, 10, 1, 6],
      stepMs: 420, duration: 0.27, volume: 0.092, type: 'sawtooth', filter: 820, accentEvery: 2, harmony: 6,
    };
    case 'victory': return {
      id: 'roost-homecoming', base: 131, intervals: [0, 4, 7, 12, 11, 7, 12, 16],
      stepMs: 540, duration: 0.38, volume: 0.078, type: 'sine', filter: 1720, accentEvery: 4, harmony: 7,
    };
    case 'defeat': return {
      id: 'scattered-feathers', base: 98, intervals: [0, -2, -5, -7],
      stepMs: 850, duration: 0.52, volume: 0.06, type: 'triangle', filter: 720, accentEvery: 4, harmony: -12,
    };
    case 'menu':
    default: return {
      id: 'canal-lights', base: 110, intervals: [0, 7, 12, 9, 5, 12, 7, 3],
      stepMs: 660, duration: 0.36, volume: 0.068, type: 'triangle', filter: 1480, accentEvery: 4, harmony: 7,
    };
  }
}

type CardAudioTone = readonly [number, number, number, OscillatorType, number, number];

const CARD_AUDIO_VOICES: Record<CardAudioVoice, {
  noise: readonly [number, number, number];
  tones: readonly CardAudioTone[];
}> = {
  plumes: {
    noise: [0.045, 1940, 0.008],
    tones: [[420, 840, 0.1, 'sawtooth', 0.012, -0.12], [840, 1260, 0.11, 'triangle', 0.012, 0.14]],
  },
  quills: {
    noise: [0.035, 2600, 0.009],
    tones: [[1180, 740, 0.08, 'triangle', 0.014, -0.14], [1560, 980, 0.07, 'sine', 0.01, 0.16]],
  },
  basins: {
    noise: [0.055, 820, 0.007],
    tones: [[330, 440, 0.15, 'sine', 0.016, -0.12], [495, 370, 0.17, 'sine', 0.014, 0.14]],
  },
  nests: {
    noise: [0.065, 560, 0.011],
    tones: [[180, 240, 0.13, 'triangle', 0.017, -0.1], [270, 360, 0.1, 'square', 0.009, 0.12]],
  },
  neutral: {
    noise: [0.055, 1320, 0.01],
    tones: [[390, 330, 0.1, 'triangle', 0.014, -0.1], [620, 510, 0.08, 'sine', 0.009, 0.12]],
  },
};

function playCardAudioVoice(
  ctx: AudioContext,
  master: GainNode,
  voiceVolume: number,
  voice: CardAudioVoice,
  usesMolt: boolean,
  intensity: number,
  variant: number,
) {
  const loudness = clamp(intensity, 0.45, 1.8) * voiceVolume;
  const pitch = [0.97, 1, 1.03][variant];
  playCardNoise(ctx, master, [0.045, 1540, 0.012], loudness);
  playCardTone(ctx, master, [520, 680, 0.07, 'triangle', 0.014, -0.08], loudness, pitch);
  const plan = CARD_AUDIO_VOICES[voice];
  playCardNoise(ctx, master, plan.noise, loudness);
  plan.tones.forEach((tone) => playCardTone(ctx, master, tone, loudness, pitch));
  if (usesMolt) playCardTone(ctx, master, [690, 1380, 0.12, 'sine', 0.01, 0], loudness, pitch);
}

function playCardTone(ctx: AudioContext, master: GainNode, tone: CardAudioTone, loudness: number, pitch: number) {
  const [startFrequency, endFrequency, duration, type, volume, pan] = tone;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = 'StereoPannerNode' in window ? ctx.createStereoPanner() : undefined;
  const now = ctx.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(startFrequency * pitch, now);
  osc.frequency.exponentialRampToValueAtTime(endFrequency * pitch, now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * loudness), now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  if (panner) {
    panner.pan.setValueAtTime(pan, now);
    gain.connect(panner);
    panner.connect(master);
  } else gain.connect(master);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playCardNoise(
  ctx: AudioContext,
  master: GainNode,
  noise: readonly [number, number, number],
  loudness: number,
) {
  const [duration, filterFrequency, volume] = noise;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(filterFrequency, ctx.currentTime);
  filter.Q.setValueAtTime(1.8, ctx.currentTime);
  gain.gain.setValueAtTime(Math.max(0.0001, volume * loudness), ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start();
  source.stop(ctx.currentTime + duration + 0.02);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
