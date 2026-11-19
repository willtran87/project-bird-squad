import type { CardSuit } from '../types';
import { safeStorageGet, safeStorageSet } from '../safe-storage';
import type { AdaptiveMusicSequencer, AdaptiveMusicSnapshot } from '../adaptive-music';
import type { SynthAudioCue } from '../audio-sfx';
import type { AdaptiveMusicModule, AudioMood, AudioSfxModule } from './runtime-types';
import { clamp } from './ui-helpers';

export type AudioCue = SynthAudioCue | 'card';


type StoppableAudioNode = AudioNode & { stop: (when?: number) => void };


class BirdAudioDirector {
  private flightState = 'planning';
  private flightDistrict = 0;
  setFlightState(state: string, district: number) {
    this.flightState = state; this.flightDistrict = district;
    this.adaptiveMusic?.setFlightState(state, district);
  }
  private ctx?: AudioContext;
  private master?: GainNode;
  private ambience?: { mood: AudioMood; gain: GainNode; nodes: StoppableAudioNode[] };
  private adaptiveMusic?: AdaptiveMusicSequencer;
  private adaptiveMusicLoad?: Promise<AdaptiveMusicModule | undefined>;
  private sfxLoad?: Promise<AudioSfxModule | undefined>;
  private adaptiveMusicRequest = 0;
  private adaptiveMusicStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  private sfxStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  private sfxPlayed = 0;
  private mood: AudioMood = 'menu';
  private muted = this.loadMuted();
  private musicVolume = this.loadVolume('birdsquad.musicVolume', 0.78);
  private sfxVolume = this.loadVolume('birdsquad.sfxVolume', 0.88);
  private voiceVolume = this.loadVolume('birdsquad.voiceVolume', this.sfxVolume);
  private ambienceVolume = this.loadVolume('birdsquad.ambienceVolume', this.musicVolume);
  private cueRequests: Partial<Record<AudioCue, number>> = {};

  setMood(mood: AudioMood) {
    this.mood = mood;
    if (this.muted) {
      this.stopAmbience();
      return;
    }
    if (this.ctx) this.startAmbience(mood);
  }

  play(cue: AudioCue, intensity = 1, suit?: CardSuit | null, usesMolt = false) {
    this.cueRequests[cue] = (this.cueRequests[cue] ?? 0) + 1;
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    void ctx.resume?.();
    this.startAmbience(this.mood);
    if (cue === 'card') {
      void this.adaptiveMusicLoad?.then((module) => {
        if (module && !this.muted) (this.adaptiveMusic ??= new module.AdaptiveMusicSequencer())
          .playCardVoice(ctx, this.master!, this.voiceVolume, suit ?? 'neutral', usesMolt, intensity);
      });
      return;
    }

    this.sfxStatus = 'loading';
    const playThroughMute = cue === 'close';
    const load = this.sfxLoad ??= import('../audio-sfx').catch(() => undefined);
    void load.then((module) => {
      if (!module) {
        this.sfxLoad = undefined;
        this.sfxStatus = 'error';
        return;
      }
      this.sfxStatus = 'ready';
      if ((!this.muted || playThroughMute) && this.master) {
        const volume = cue.endsWith('Air') ? this.ambienceVolume : cue.startsWith('flock') ? this.voiceVolume : this.sfxVolume;
        if (module.playAudioCue(ctx, this.master, volume, cue, intensity)) this.sfxPlayed += 1;
      }
    });
  }

  toggleMute() {
    if (this.muted) {
      this.setMuted(false);
      this.play('confirm');
      return;
    }
    this.play('close', 0.72);
    this.setMuted(true);
  }

  isMuted() {
    return this.muted;
  }

  snapshot() {
    const music: AdaptiveMusicSnapshot = this.adaptiveMusic?.snapshot() ?? {
      pattern: this.adaptiveMusicStatus,
      active: false,
      step: 0,
      pulses: 0,
    };
    return {
      muted: this.muted,
      mood: this.mood,
      unlocked: Boolean(this.ctx && this.ctx.state === 'running'),
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      voiceVolume: this.voiceVolume,
      ambienceVolume: this.ambienceVolume,
      music,
      sfx: { status: this.sfxStatus, played: this.sfxPlayed },
      cueRequests: { ...this.cueRequests }
    };
  }

  setMusicVolume(value: number) {
    this.musicVolume = clamp(value, 0, 1);
    this.storeVolume('birdsquad.musicVolume', this.musicVolume);
    this.adaptiveMusic?.setVolume(this.musicVolume);
  }

  setAmbienceVolume(value: number) {
    this.ambienceVolume = clamp(value, 0, 1);
    this.storeVolume('birdsquad.ambienceVolume', this.ambienceVolume);
    if (this.ambience && this.ctx) {
      const droneTarget = this.ambienceProfile(this.ambience.mood).volume * this.ambienceVolume;
      const now = this.ctx.currentTime;
      const gain = this.ambience.gain.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(Math.max(0.0001, gain.value), now);
      gain.exponentialRampToValueAtTime(Math.max(0.0001, droneTarget), now + 0.16);
    }
  }

  setSfxVolume(value: number) {
    this.sfxVolume = clamp(value, 0, 1);
    this.storeVolume('birdsquad.sfxVolume', this.sfxVolume);
  }

  setVoiceVolume(value: number) {
    this.voiceVolume = clamp(value, 0, 1);
    this.storeVolume('birdsquad.voiceVolume', this.voiceVolume);
  }

  private loadMuted() {
    return safeStorageGet('birdsquad.audioMuted') === '1';
  }

  private loadVolume(key: string, fallback: number) {
    const stored = safeStorageGet(key);
    if (stored === null) return fallback;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? clamp(parsed, 0, 1) : fallback;
  }

  private storeVolume(key: string, value: number) {
    safeStorageSet(key, value.toFixed(2));
  }

  private setMuted(value: boolean) {
    this.muted = value;
    safeStorageSet('birdsquad.audioMuted', value ? '1' : '0');
    if (value) this.stopAmbience();
    else if (this.ctx) this.startAmbience(this.mood);
  }

  private ensureContext() {
    if (this.ctx) return this.ctx;
    try {
      const AudioContextCtor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return undefined;
      this.ctx = new AudioContextCtor();
      this.master = this.ctx.createGain();
      this.master.gain.setValueAtTime(0.42, this.ctx.currentTime);
      this.master.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return undefined;
    }
  }

  private startAmbience(mood: AudioMood) {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    if (this.ambience?.mood === mood) {
      if (this.adaptiveMusicStatus === 'idle' || this.adaptiveMusicStatus === 'error') {
        this.startAdaptiveMusic(mood);
      }
      return;
    }
    this.stopAmbience();
    const profile = this.ambienceProfile(mood);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, profile.volume * this.ambienceVolume), ctx.currentTime + 0.8);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(profile.filter, ctx.currentTime);
    filter.connect(gain);
    gain.connect(this.master);
    const nodes: StoppableAudioNode[] = profile.freqs.map((freq, index) => {
      const osc = ctx.createOscillator();
      const local = ctx.createGain();
      osc.type = profile.type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.detune.setValueAtTime(index * 4 - 3, ctx.currentTime);
      local.gain.setValueAtTime(index === 0 ? 0.72 : 0.38, ctx.currentTime);
      osc.connect(local);
      local.connect(filter);
      osc.start();
      return osc;
    });
    this.ambience = { mood, gain, nodes };
    this.startAdaptiveMusic(mood);
  }

  private stopAmbience() {
    this.adaptiveMusicRequest += 1;
    this.adaptiveMusic?.stop();
    this.adaptiveMusicStatus = 'idle';
    if (!this.ambience || !this.ctx) return;
    const { gain, nodes } = this.ambience;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    nodes.forEach((node) => {
      try { node.stop(now + 0.32); } catch { /* already stopped */ }
    });
    this.ambience = undefined;
  }

  private startAdaptiveMusic(mood: AudioMood) {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const request = ++this.adaptiveMusicRequest;
    this.adaptiveMusicStatus = 'loading';
    const load = this.adaptiveMusicLoad ??= import('../adaptive-music').catch(() => undefined);
    void load.then((module) => {
      if (!module) {
        this.adaptiveMusicLoad = undefined;
        if (request === this.adaptiveMusicRequest) this.adaptiveMusicStatus = 'error';
        return;
      }
      if (
        request !== this.adaptiveMusicRequest
        || this.muted
        || this.mood !== mood
        || !this.ctx
        || !this.master
      ) return;
      this.adaptiveMusic ??= new module.AdaptiveMusicSequencer();
      this.adaptiveMusic.setFlightState(this.flightState, this.flightDistrict);
      this.adaptiveMusic.start(this.ctx, this.master, mood, this.musicVolume);
      this.adaptiveMusicStatus = 'ready';
    });
  }

  private ambienceProfile(mood: AudioMood) {
    switch (mood) {
      case 'route': return { freqs: [98, 147, 196], filter: 820, volume: 0.026, type: 'triangle' as OscillatorType };
      case 'battle': return { freqs: [82, 123, 164], filter: 680, volume: 0.032, type: 'sawtooth' as OscillatorType };
      case 'boss': return { freqs: [73, 110, 146], filter: 560, volume: 0.038, type: 'sawtooth' as OscillatorType };
      case 'victory': return { freqs: [131, 196, 262], filter: 1100, volume: 0.024, type: 'sine' as OscillatorType };
      case 'defeat': return { freqs: [65, 98, 130], filter: 440, volume: 0.03, type: 'triangle' as OscillatorType };
      case 'menu':
      default: return { freqs: [110, 165, 220], filter: 940, volume: 0.022, type: 'triangle' as OscillatorType };
    }
  }

}


export const birdAudio = new BirdAudioDirector();
