import type { CardSuit } from '../types';
import { safeStorageGet, safeStorageSet } from '../safe-storage';
import type { AdaptiveMusicSequencer, AdaptiveMusicSnapshot } from '../adaptive-music';
import type { SynthAudioCue } from '../audio-sfx';
import type { DistrictAmbience } from '../audio-ambience';
import type { BirdAudioEvent, BirdAudioEventMap, EncounterTier, FormationState } from '../audio-events';
import type { AdaptiveMusicModule, AudioMood, AudioSfxModule } from './runtime-types';
import { clamp } from './ui-helpers';
import { committing } from '../button-cue';

export type AudioCue = SynthAudioCue | 'card';


/** Loose view of an event's detail; the typed overload of `play` checks the real shape. */
type EventData = { state?: FormationState; tier?: EncounterTier; district?: number; id?: string; open?: boolean; [key: string]: unknown };


class BirdAudioDirector {
  private flightState = 'planning';
  private flightDistrict = 0;
  private formation: FormationState = 'holding';
  private tier: EncounterTier = 'street';
  private overlays = new Set<string>();
  private bed?: DistrictAmbience;
  private bedLoad?: Promise<typeof import('../audio-ambience') | undefined>;
  private eventRequests: Partial<Record<BirdAudioEvent, number>> = {};
  private eventsPlayed = 0;
  setFlightState(state: string, district: number) {
    const stinger = state !== this.flightState && (state === 'molt' ? 'molt' : state === 'boss-phase' && 'bossPhase');
    const moved = district !== this.flightDistrict;
    this.flightState = state; this.flightDistrict = district;
    this.syncMusic();
    if (moved) this.syncBed();
    if (stinger) this.play('stinger.play', { id: stinger });
  }
  private syncMusic() {
    this.adaptiveMusic?.setFlightState(this.flightState, this.flightDistrict, this.formation, this.tier);
  }
  /** District bed: lazy, crossfades on district change, lower under overlays, silent when muted. */
  private syncBed() {
    if (!this.ctx) return;
    void (this.bedLoad ??= import('../audio-ambience').catch(() => undefined)).then((module) => {
      if (!module) { this.bedLoad = undefined; return; }
      if (this.ctx && this.master) (this.bed ??= new module.DistrictAmbience()).update(this.ctx, this.master, {
        district: this.flightDistrict, mood: this.mood, overlay: this.overlays.size > 0,
        volume: this.muted ? 0 : this.ambienceVolume,
      });
    });
  }
  private ctx?: AudioContext;
  private master?: GainNode;
  private ambienceMood?: AudioMood;
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
    this.formation = 'holding';
    this.tier = mood === 'boss' ? 'boss' : 'street';
    this.overlays.clear();
    this.syncMusic();
    if (this.muted) {
      this.stopAmbience();
      return;
    }
    if (this.ctx) this.startAmbience(mood);
  }

  /** Typed events (see docs/game/audio-events.md), e.g. `play('card.play', { suit })`. */
  play<E extends BirdAudioEvent>(event: E, detail?: BirdAudioEventMap[E]): void;
  /** Legacy cue names; kept for existing call sites. */
  play(cue: AudioCue, intensity?: number, suit?: CardSuit | null, usesMolt?: boolean): void;
  play(cue: AudioCue | BirdAudioEvent, detail: number | object = 1, suit?: CardSuit | null, usesMolt = false) {
    let event = cue.includes('.') ? cue as BirdAudioEvent : undefined;
    let data = detail as EventData;
    const intensity = typeof detail === 'number' ? detail : 1;
    if (event) {
      this.eventRequests[event] = (this.eventRequests[event] ?? 0) + 1;
      // State events update the music and the bed even while muted.
      if (event === 'flock.formation') this.formation = data.state ?? 'holding';
      if (event === 'battle.enter') { this.tier = data.tier ?? 'street'; this.formation = 'holding'; }
      if (event === 'battle.enter' || event === 'district.enter') this.flightDistrict = data.district ?? this.flightDistrict;
      if (event === 'overlay.set' && data.id) this.overlays[data.open ? 'add' : 'delete'](data.id);
      if (event === 'flock.formation' || event === 'battle.enter') this.syncMusic();
      else if (event === 'district.enter' || event === 'overlay.set') this.syncBed();
      if (event !== 'battle.enter' && /^(flock|district|overlay)/.test(event)) return;
    } else this.cueRequests[cue as AudioCue] = (this.cueRequests[cue as AudioCue] ?? 0) + 1;
    if (cue === 'confirm' && committing()) {
      event = 'ui.confirm';
      data = {};
      this.eventRequests[event] = (this.eventRequests[event] ?? 0) + 1;
    }
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    void ctx.resume?.();
    this.startAmbience(this.mood);
    if (cue === 'card') {
      void this.adaptiveMusicLoad?.then((module) => {
        if (module && !this.muted) (this.adaptiveMusic ??= new module.AdaptiveMusicSequencer())
          .noteCardVoice(suit ?? 'neutral', usesMolt, this.voiceVolume);
      });
      // A card play is paper, the suit's material and its bird call, rising within the turn.
      event = 'card.play';
      data = { suit, molt: usesMolt, intensity };
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
      if ((this.muted && !playThroughMute) || !this.master) return;
      const volume = cue.endsWith('Air') ? this.ambienceVolume : cue.startsWith('flock') ? this.voiceVolume : this.sfxVolume;
      // A cue the budget dropped neither counts nor ducks the music.
      if (!(event
        ? module.playAudioEvent(ctx, this.master, { sfx: this.sfxVolume, voice: this.voiceVolume }, event, data as never)
        : module.playAudioCue(ctx, this.master, volume, cue as SynthAudioCue, intensity))) return;
      if (event) this.eventsPlayed += 1;
      else this.sfxPlayed += 1;
      const duck = module.audioDuck(event ?? cue, data);
      if (duck) this.adaptiveMusic?.duck(duck);
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
      cueRequests: { ...this.cueRequests },
      events: { requests: { ...this.eventRequests }, played: this.eventsPlayed },
      ambienceBed: this.bed?.snapshot(),
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
    this.syncBed();
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
    this.syncBed();
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
    if (this.ambienceMood === mood) {
      if (this.adaptiveMusicStatus === 'idle' || this.adaptiveMusicStatus === 'error') {
        this.startAdaptiveMusic(mood);
      }
      return;
    }
    this.stopAmbience();
    this.ambienceMood = mood;
    this.startAdaptiveMusic(mood);
    // The mood drone and the district bed are both built by the lazy ambience module.
    this.syncBed();
  }

  private stopAmbience() {
    this.adaptiveMusicRequest += 1;
    this.adaptiveMusic?.stop();
    this.adaptiveMusicStatus = 'idle';
    this.ambienceMood = undefined;
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
      this.syncMusic();
      this.adaptiveMusic.start(this.ctx, this.master, mood, this.musicVolume);
      this.adaptiveMusicStatus = 'ready';
    });
  }


}


export const birdAudio = new BirdAudioDirector();
