import type { CardSuit } from './types';
import {
  selectMusicLayers, type DuckProfile, type EncounterTier, type FormationState, type MusicLayerId, type MusicLayerPlan,
} from './audio-events';

export type AdaptiveMusicMood = 'menu' | 'route' | 'battle' | 'boss' | 'victory' | 'defeat';
export type CardAudioVoice = CardSuit | 'neutral';

export interface AdaptiveMusicSnapshot {
  flightState?: string;
  district?: number;
  formation?: FormationState;
  tier?: EncounterTier;
  /** Stems sounding in the current phrase. */
  layers?: MusicLayerId[];
  /** Times the music stepped back under a big moment. */
  ducks?: number;
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
  private flightState = 'planning';
  private pendingFlightState = 'planning';
  private district = 0;
  private formation: FormationState = 'holding';
  private tier: EncounterTier = 'street';
  private plan: MusicLayerPlan = selectMusicLayers({ mood: 'menu' });
  private ducks = 0;
  /** Flight state, formation and tier all take effect at the next four-step phrase. */
  setFlightState(state: string, district: number, formation: FormationState = 'holding', tier: EncounterTier = 'street') {
    this.pendingFlightState = ['planning','flow','surge','molt','open-sky','boss-phase'].includes(state) ? state : 'planning';
    this.district = Math.max(0, Math.min(3, Math.floor(district)));
    this.formation = formation;
    this.tier = tier;
  }
  private ctx?: AudioContext;
  private bus?: GainNode;
  private duckGain?: GainNode;
  private hatBuffer?: AudioBuffer;
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
    this.plan = this.selectPlan();
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.busLevel()), ctx.currentTime + 0.8);
    // Ducking has its own stage so it never fights the volume and layer ramps.
    const duckGain = ctx.createGain();
    bus.connect(duckGain);
    duckGain.connect(master);
    this.bus = bus;
    this.duckGain = duckGain;
    this.generation += 1;
    this.schedule(profile, this.generation);
  }

  stop() {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
    this.generation += 1;
    const bus = this.bus;
    const duckGain = this.duckGain;
    if (bus && this.ctx) {
      const now = this.ctx.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
      bus.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      window.setTimeout(() => { bus.disconnect(); duckGain?.disconnect(); }, 900);
    }
    this.bus = undefined;
    this.duckGain = undefined;
  }

  /** Step the music back under a heavy hit, finishing blow, stinger or boss entrance, then let it return. */
  duck(profile: DuckProfile) {
    const gain = this.duckGain?.gain;
    if (!gain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const floor = Math.min(profile.depth, Math.max(0.05, gain.value));
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0.05, gain.value), now);
    gain.linearRampToValueAtTime(floor, now + profile.attackS);
    gain.setValueAtTime(floor, now + profile.attackS + profile.holdS);
    gain.linearRampToValueAtTime(1, now + profile.attackS + profile.holdS + profile.releaseS);
    this.ducks += 1;
  }

  private selectPlan() {
    return selectMusicLayers({ mood: this.mood, flightState: this.flightState, formation: this.formation, tier: this.tier });
  }

  private busLevel() {
    return musicProfile(this.mood).volume * this.volume * this.plan.gainScale;
  }

  private rampBus(seconds: number) {
    if (!this.bus || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(Math.max(0.0001, this.bus.gain.value), now);
    this.bus.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.busLevel()), now + seconds);
  }

  setVolume(volume: number) {
    this.volume = clamp(volume, 0, 1);
    this.rampBus(0.16);
  }

  snapshot(): AdaptiveMusicSnapshot {
    return {
      flightState: this.flightState, district: this.district,
      formation: this.formation, tier: this.tier, layers: [...this.plan.layers], ducks: this.ducks,
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

  /** Records which suit voice a card play asked for; the sound itself is the `card.play` event. */
  noteCardVoice(voice: CardAudioVoice, usesMolt: boolean, voiceVolume: number) {
    this.cardVoiceRequests[voice] = (this.cardVoiceRequests[voice] ?? 0) + 1;
    const sequence = ++this.cardVoiceSequence;
    this.lastCardVoice = { voice, usesMolt, sequence, variant: (sequence - 1) % 3, volume: clamp(voiceVolume, 0, 1) };
  }

  private schedule(profile: MusicProfile, generation: number) {
    const pulse = () => {
      if (!this.bus || generation !== this.generation) return;
      if (this.volume > 0.001) {
        // Orchestration changes at the start of a four-step phrase.
        if (this.step % 4 === 0) {
          this.flightState = this.pendingFlightState;
          const before = this.plan.gainScale;
          this.plan = this.selectPlan();
          if (this.plan.gainScale !== before) this.rampBus(0.3);
        }
        const on = (layer: MusicLayerId) => this.plan.layers.includes(layer);
        const filter = profile.filter * this.plan.filterScale;
        const interval = profile.intervals[this.step % profile.intervals.length];
        const frequency = profile.base * Math.pow(2, interval / 12);
        const accented = this.step % profile.accentEvery === 0;
        const pan = ((this.step % 5) - 2) * 0.1;
        this.tone(frequency, profile.duration, profile.type, accented ? 0.36 : 0.24, filter, pan);
        if (accented && on('harmony')) {
          const harmony = frequency * Math.pow(2, profile.harmony / 12);
          this.tone(harmony, profile.duration * 0.82, 'sine', 0.13, filter * 1.2, -pan, 0.035);
        }
        if (this.mood === 'battle' || this.mood === 'boss') {
          const root = [110, 98, 123.47, 130.81][this.district];
          const beat = this.step % 4 === 0;
          const even = this.step % 2 === 0;
          const offBeat = profile.stepMs / 2000;
          if (beat && on('bass')) this.tone(root, .3, 'triangle', .13, 800, -.2);
          if (on('shimmer')) this.tone(root * 2, .09, 'sine', on('lead') ? .15 : .08, 1800, pan);
          if (even && on('lead')) this.tone(root * 3, .18, 'triangle', .1, 2200, -pan, .08);
          if (on('hat')) this.hat(even ? .05 : .03, on('drive') ? offBeat : 0);
          // Elites and bosses push an off-beat fifth between the main steps.
          if (on('drive')) this.tone(root * 1.5, .08, 'sawtooth', .07, 1200, pan, offBeat);
          if (beat && on('sub')) this.tone(root / 2, .5, 'sine', .2, 300, 0);
          if (on('molt')) this.tone(root * 2 ** ([0,7,12,7][this.step % 4] / 12), .13, 'triangle', .18, 2100, pan);
          if (beat && on('drone')) this.tone(root / 2, .6, 'sine', .16, 500, 0);
          if (even && on('alarm')) this.tone(root / 2, .14, 'triangle', .2, 1000, 0);
        }
        this.pulses += 1;
      }
      this.step = (this.step + 1) % profile.intervals.length;
      this.timer = window.setTimeout(pulse, profile.stepMs);
    };
    this.timer = window.setTimeout(pulse, 140);
  }

  /** A filtered-noise tick on the step, doubled on the off-beat when the drive layer is on. */
  private hat(volume: number, echoS: number) {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    if (!this.hatBuffer || this.hatBuffer.sampleRate !== ctx.sampleRate) {
      const length = Math.max(1, Math.floor(ctx.sampleRate * 0.04));
      this.hatBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.hatBuffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    for (const delay of echoS > 0 ? [0, echoS] : [0]) {
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      source.buffer = this.hatBuffer;
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(6200, ctx.currentTime);
      gain.gain.setValueAtTime(delay ? volume * 0.6 : volume, ctx.currentTime);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(bus);
      source.start(ctx.currentTime + delay);
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
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
    osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); panner?.disconnect(); };
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
