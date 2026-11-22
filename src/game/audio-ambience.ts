import { ambienceBedFor, ambienceLevel, type AmbienceBedId, type MusicMood } from './audio-events';

/**
 * District ambience beds, synthesised from one looping noise buffer per bed plus
 * slow oscillators that move its filters and level. No recordings.
 *   rain   - rooftops in rain (district 1, and the title screen)
 *   canal  - lapping canal water (district 2)
 *   static - radio static and wind in wires (district 3)
 *   wind   - high wind (district 4)
 */

export interface AmbienceTarget {
  district: number;
  mood: MusicMood;
  overlay: boolean;
  /** The Ambience setting, 0-1. Zero (or muted) stops the bed. */
  volume: number;
}

/** One strand of a bed: filtered noise whose level, and optionally cutoff, drift on slow oscillators. */
interface BedStrand {
  filter: BiquadFilterType;
  hz: number;
  q: number;
  gain: number;
  /** Level drift: [rateHz, depth 0-1, wave]. */
  swell?: readonly [number, number, OscillatorType];
  /** Cutoff drift: [rateHz, depthHz]. */
  sweep?: readonly [number, number];
}

export const AMBIENCE_BEDS: Record<AmbienceBedId, readonly BedStrand[]> = {
  rain: [
    // Hiss of rain in the air.
    { filter: 'highpass', hz: 2400, q: 0.5, gain: 0.5, swell: [0.13, 0.18, 'sine'] },
    // Drumming on the roof.
    { filter: 'bandpass', hz: 420, q: 0.7, gain: 0.32, swell: [0.21, 0.3, 'sine'] },
    // Patter of single drops.
    { filter: 'bandpass', hz: 2900, q: 6, gain: 0.3, swell: [7.3, 0.85, 'sawtooth'] },
  ],
  canal: [
    // Slow water against stone.
    { filter: 'lowpass', hz: 480, q: 0.7, gain: 0.8, swell: [0.18, 0.55, 'sine'] },
    // Slosh between hulls.
    { filter: 'bandpass', hz: 900, q: 2, gain: 0.28, swell: [0.31, 0.8, 'sine'], sweep: [0.11, 260] },
    // Small drips under the bridges.
    { filter: 'bandpass', hz: 2100, q: 9, gain: 0.1, swell: [1.7, 0.9, 'triangle'] },
  ],
  static: [
    // Radio static: crackle gated by a fast ramp.
    { filter: 'highpass', hz: 3600, q: 0.5, gain: 0.22, swell: [11, 0.8, 'sawtooth'] },
    // Wind singing in the wires: two narrow, drifting tones.
    { filter: 'bandpass', hz: 1250, q: 22, gain: 0.9, swell: [0.09, 0.6, 'sine'], sweep: [0.07, 90] },
    { filter: 'bandpass', hz: 1870, q: 26, gain: 0.6, swell: [0.14, 0.7, 'sine'], sweep: [0.05, 130] },
  ],
  wind: [
    // The body of the wind, opening and closing.
    { filter: 'lowpass', hz: 620, q: 0.9, gain: 0.9, swell: [0.11, 0.5, 'sine'], sweep: [0.07, 320] },
    // Gusts whistling past the ledge.
    { filter: 'bandpass', hz: 780, q: 3.5, gain: 0.4, swell: [0.23, 0.75, 'sine'], sweep: [0.16, 380] },
  ],
};

export const AMBIENCE_CROSSFADE_S = 1.8;
const OVERLAY_FADE_S = 0.4;

/** The tonal drone under each scene mood: three detuned oscillators through a low-pass. */
export const MOOD_DRONES: Record<MusicMood, { freqs: readonly number[]; filter: number; volume: number; type: OscillatorType }> = {
  menu: { freqs: [110, 165, 220], filter: 940, volume: 0.022, type: 'triangle' },
  route: { freqs: [98, 147, 196], filter: 820, volume: 0.026, type: 'triangle' },
  battle: { freqs: [82, 123, 164], filter: 680, volume: 0.032, type: 'sawtooth' },
  boss: { freqs: [73, 110, 146], filter: 560, volume: 0.038, type: 'sawtooth' },
  victory: { freqs: [131, 196, 262], filter: 1100, volume: 0.024, type: 'sine' },
  defeat: { freqs: [65, 98, 130], filter: 440, volume: 0.03, type: 'triangle' },
};

interface ActiveBed {
  id: AmbienceBedId | MusicMood;
  out: GainNode;
  sources: Array<AudioScheduledSourceNode>;
  nodes: AudioNode[];
}

export class DistrictAmbience {
  private ctx?: AudioContext;
  private bed?: ActiveBed;
  private drone?: ActiveBed;
  private droneLevel = 0;
  private level = 0;
  private overlay = false;
  private crossfades = 0;

  /** Idempotent: starts, crossfades, re-levels or stops the bed to match the target. */
  update(ctx: AudioContext, master: GainNode, target: AmbienceTarget) {
    if (this.ctx !== ctx) this.stop(0);
    this.ctx = ctx;
    const level = ambienceLevel(target);
    const id = ambienceBedFor(target.mood === 'menu' ? 0 : target.district);
    if (level <= 0.00001) { this.stop(); return; }
    const now = ctx.currentTime;
    const droneLevel = MOOD_DRONES[target.mood].volume * Math.min(1, target.volume);
    if (this.drone?.id !== target.mood) {
      if (this.drone) this.release(this.drone, 0.28);
      this.drone = this.buildDrone(ctx, master, target.mood);
      this.drone.out.gain.setValueAtTime(0.0001, now);
      this.drone.out.gain.exponentialRampToValueAtTime(droneLevel, now + 0.8);
    } else if (droneLevel !== this.droneLevel) this.ramp(this.drone.out.gain, droneLevel, 0.16);
    this.droneLevel = droneLevel;
    if (this.bed?.id !== id) {
      if (this.bed) { this.release(this.bed, AMBIENCE_CROSSFADE_S); this.crossfades += 1; }
      const bed = this.build(ctx, master, id);
      bed.out.gain.setValueAtTime(0.0001, now);
      bed.out.gain.exponentialRampToValueAtTime(level, now + AMBIENCE_CROSSFADE_S);
      this.bed = bed;
    } else if (level !== this.level) this.ramp(this.bed.out.gain, level, OVERLAY_FADE_S);
    this.level = level;
    this.overlay = target.overlay;
  }

  stop(fadeS = 0.3) {
    if (this.bed) this.release(this.bed, fadeS);
    if (this.drone) this.release(this.drone, fadeS);
    this.bed = undefined;
    this.drone = undefined;
    this.level = 0;
    this.droneLevel = 0;
  }

  snapshot() {
    return {
      bed: this.bed?.id ?? null, level: this.level, overlay: this.overlay, crossfades: this.crossfades,
      drone: this.drone?.id ?? null,
    };
  }

  private ramp(gain: AudioParam, level: number, seconds: number) {
    const now = this.ctx!.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0.0001, gain.value), now);
    gain.exponentialRampToValueAtTime(Math.max(0.0001, level), now + seconds);
  }

  private buildDrone(ctx: AudioContext, master: GainNode, mood: MusicMood): ActiveBed {
    const profile = MOOD_DRONES[mood];
    const now = ctx.currentTime;
    const out = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(profile.filter, now);
    filter.connect(out);
    out.connect(master);
    const nodes: AudioNode[] = [out, filter];
    const sources = profile.freqs.map((freq, index) => {
      const osc = ctx.createOscillator();
      const local = ctx.createGain();
      osc.type = profile.type;
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime(index * 4 - 3, now);
      local.gain.setValueAtTime(index === 0 ? 0.72 : 0.38, now);
      osc.connect(local);
      local.connect(filter);
      osc.start(now);
      nodes.push(osc, local);
      return osc;
    });
    return { id: mood, out, sources, nodes };
  }

  private release(bed: ActiveBed, fadeS: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    bed.out.gain.cancelScheduledValues(now);
    bed.out.gain.setValueAtTime(Math.max(0.0001, bed.out.gain.value), now);
    bed.out.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.01, fadeS));
    bed.sources.forEach((source) => { try { source.stop(now + fadeS + 0.05); } catch { /* already stopped */ } });
    // The first source ending is the cue to drop the whole graph.
    bed.sources[0].onended = () => bed.nodes.forEach((node) => node.disconnect());
  }

  private build(ctx: AudioContext, master: GainNode, id: AmbienceBedId): ActiveBed {
    const length = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    const out = ctx.createGain();
    out.connect(master);
    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [out];
    const now = ctx.currentTime;
    const lfo = (rateHz: number, depth: number, wave: OscillatorType, param: AudioParam) => {
      const osc = ctx.createOscillator();
      const amount = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(rateHz, now);
      amount.gain.setValueAtTime(depth, now);
      osc.connect(amount);
      amount.connect(param);
      osc.start(now);
      sources.push(osc);
      nodes.push(osc, amount);
    };
    AMBIENCE_BEDS[id].forEach((strand, index) => {
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = strand.filter;
      filter.frequency.setValueAtTime(strand.hz, now);
      filter.Q.setValueAtTime(strand.q, now);
      // The swell rides on top of a base level so the strand never fully inverts.
      const depth = strand.swell ? strand.gain * strand.swell[1] * 0.5 : 0;
      gain.gain.setValueAtTime(strand.gain - depth, now);
      if (strand.swell) lfo(strand.swell[0], depth, strand.swell[2], gain.gain);
      if (strand.sweep) lfo(strand.sweep[0], strand.sweep[1], 'sine', filter.frequency);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      // Offset each strand so the shared buffer does not line up with itself.
      source.start(now, (index * 0.61) % 2);
      sources.unshift(source);
      nodes.push(source, filter, gain);
    });
    return { id, out, sources, nodes };
  }
}
