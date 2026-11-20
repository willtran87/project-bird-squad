import type { CardSuit } from './types';

/**
 * Pure audio decisions: the typed event vocabulary plus every rule that picks a
 * pitch, a loudness, a layer or a bed. Nothing here touches WebAudio, so the
 * whole file is unit-tested (see audio-events.test.ts). All sound is synthesised
 * from oscillators and noise; there are no recordings.
 */

export type AudioMaterial = 'paper' | 'metal' | 'wood' | 'water';
export type EncounterTier = 'street' | 'elite' | 'boss';
export type FormationState = 'scattered' | 'holding' | 'surging';
export type StingerId = 'victory' | 'defeat' | 'reward' | 'molt' | 'bossPhase';
export type LeaderCallId = 'fledgling' | 'spark_caller' | 'talon' | 'tidewarden' | 'roostkeeper' | 'jackdaw';

/** Detail accepted by `birdAudio.play(event, detail)` for each event. */
export interface BirdAudioEventMap {
  /** Soft click for any shared button. */
  'ui.click': { intensity?: number };
  /** A committed choice (distinct from the click). */
  'ui.confirm': { intensity?: number };
  /** Back, close or dismiss. */
  'ui.cancel': { intensity?: number };
  'card.draw': { count?: number };
  /** Paper slap, the suit's material and its bird call; pitch climbs within a turn. */
  'card.play': { suit?: CardSuit | null; molt?: boolean; intensity?: number };
  'card.discard': { count?: number };
  /** Metal for Scrap, wood for Nest cards and route nodes, water for Basin, paper for cards. */
  'material.tap': { material: AudioMaterial; intensity?: number };
  'voice.suit': { suit: CardSuit; intensity?: number };
  'voice.leader': { leader: LeaderCallId | string; intensity?: number };
  /** A hit that removed HP. Loudness and weight follow damage / maxHp. */
  'hit.impact': { damage: number; maxHp: number; lethal?: boolean; coverBroke?: boolean; target?: 'enemy' | 'flock' };
  'cover.absorb': { amount?: number };
  'cover.break': { amount?: number };
  /** One tick of a counting number. `of` is the total number of ticks when known. */
  'count.tick': { step: number; of?: number };
  'stinger.play': { id: StingerId };
  /** Silent: resets the card pitch ladder. */
  'turn.start': Record<string, never>;
  /** Sets the music tier and district; a boss tier also plays the entrance. */
  'battle.enter': { tier: EncounterTier; district?: number };
  /** Silent: crossfades the ambience bed to this district (0-3). */
  'district.enter': { district: number };
  /** Silent: music adds layers on Surge and thins out on Scatter. */
  'flock.formation': { state: FormationState };
  /** Silent: the ambience bed sits lower while any overlay id is open. */
  'overlay.set': { id: string; open: boolean };
}

export type BirdAudioEvent = keyof BirdAudioEventMap;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// ---------------------------------------------------------------- pitch ladder

/** Major pentatonic steps: every consecutive play lands on a consonant note. */
const LADDER_SEMITONES = [0, 2, 4, 7, 9, 12] as const;

/** Semitones above the base pitch for the nth consecutive action (0-based). Caps at one octave. */
export function pitchLadderSemitones(step: number) {
  const index = clamp(Math.floor(Number.isFinite(step) ? step : 0), 0, LADDER_SEMITONES.length - 1);
  return LADDER_SEMITONES[index];
}

export function pitchLadderRatio(step: number) {
  return Math.pow(2, pitchLadderSemitones(step) / 12);
}

/** Counts consecutive actions. Reset it at a turn boundary; it also lapses after `lapseMs` of silence. */
export class PitchLadder {
  private step = 0;
  private lastMs = -Infinity;

  constructor(private readonly lapseMs = 12_000) {}

  /** Returns the step for this action, then advances. */
  next(nowMs: number) {
    if (nowMs - this.lastMs > this.lapseMs) this.step = 0;
    this.lastMs = nowMs;
    const step = this.step;
    this.step += 1;
    return step;
  }

  reset() {
    this.step = 0;
    this.lastMs = -Infinity;
  }

  peek() {
    return this.step;
  }
}

/** Counting numbers glide up one octave over the count, or a semitone a tick (two octaves at most) when the total is unknown. */
export function countTickRatio(step: number, of?: number) {
  const index = Math.max(0, Math.floor(Number.isFinite(step) ? step : 0));
  if (of && of > 1) return Math.pow(2, clamp(index / (of - 1), 0, 1));
  return Math.pow(2, Math.min(24, index) / 12);
}

// -------------------------------------------------------------- impact scaling

export type ImpactTier = 'tick' | 'light' | 'solid' | 'heavy';

export interface ImpactScale {
  /** Damage as a share of the target's max HP, 0-1. */
  share: number;
  tier: ImpactTier;
  /** Loudness multiplier, 0.55 (tick) to 1.6 (heavy). */
  gain: number;
  /** Body pitch: small hits sit high and short, big hits low and long. */
  bodyHz: number;
  durationS: number;
  /** Whether the music should step back for this hit. */
  ducks: boolean;
}

const IMPACT_TIERS: ImpactTier[] = ['tick', 'light', 'solid', 'heavy'];

export function impactScale(damage: number, maxHp: number, lethal = false): ImpactScale {
  const share = maxHp > 0 && damage > 0 ? clamp(damage / maxHp, 0, 1) : 0;
  let rank = share < 0.06 ? 0 : share < 0.18 ? 1 : share < 0.38 ? 2 : 3;
  // A finishing blow never sounds like a tick, however little HP was left.
  if (lethal) rank = Math.max(rank, 2);
  // Weight grows fastest across the first half of the bar, then saturates.
  const weight = Math.max(Math.sqrt(share), rank / 4);
  return {
    share,
    tier: IMPACT_TIERS[rank],
    gain: 0.55 + 1.05 * weight,
    bodyHz: 190 - 140 * weight,
    durationS: 0.05 + 0.25 * weight,
    ducks: rank === 3 || lethal,
  };
}

// ---------------------------------------------------------------- music layers

export type MusicMood = 'menu' | 'route' | 'battle' | 'boss' | 'victory' | 'defeat';
export type MusicLayerId =
  | 'pulse' | 'harmony' | 'bass' | 'shimmer' | 'lead' | 'hat' | 'drive' | 'sub' | 'molt' | 'drone' | 'alarm';

export interface MusicLayerInput {
  mood: MusicMood;
  flightState?: string;
  formation?: FormationState;
  tier?: EncounterTier;
}

export interface MusicLayerPlan {
  layers: MusicLayerId[];
  /** Multiplies the lead filter cutoff: below 1 is darker and thinner. */
  filterScale: number;
  /** Multiplies the music bus level. */
  gainScale: number;
}

/**
 * Which stems sound. Surge adds the lead and hat; Scatter strips the fight back
 * to a bare, darker pulse; elites add a driving off-beat and bosses a sub.
 */
export function selectMusicLayers(input: MusicLayerInput): MusicLayerPlan {
  const { mood, flightState = 'planning', formation = 'holding' } = input;
  if (mood !== 'battle' && mood !== 'boss') return { layers: ['pulse', 'harmony'], filterScale: 1, gainScale: 1 };
  const tier: EncounterTier = mood === 'boss' ? 'boss' : input.tier === 'elite' ? 'elite' : 'street';
  const layers: MusicLayerId[] = ['pulse'];
  if (formation === 'scattered') {
    if (flightState === 'boss-phase') layers.push('alarm');
    if (tier === 'boss') layers.push('sub');
    return { layers, filterScale: 0.55, gainScale: 0.78 };
  }
  layers.push('harmony', 'bass');
  const surging = formation === 'surging' || flightState === 'surge';
  if (surging || flightState === 'flow') layers.push('shimmer');
  if (surging) layers.push('lead');
  if (surging || tier !== 'street') layers.push('hat');
  if (tier !== 'street') layers.push('drive');
  if (tier === 'boss') layers.push('sub');
  if (flightState === 'molt') layers.push('molt');
  if (flightState === 'open-sky') layers.push('drone');
  if (flightState === 'boss-phase') layers.push('alarm');
  return {
    layers,
    filterScale: surging ? 1.35 : 1,
    gainScale: (surging ? 1.12 : 1) * (tier === 'boss' ? 1.1 : tier === 'elite' ? 1.06 : 1),
  };
}

// --------------------------------------------------------------------- ducking

export type DuckReason = 'heavyHit' | 'finisher' | 'bossEntrance' | 'stinger';

export interface DuckProfile {
  /** Level the music drops to, as a share of its normal level. */
  depth: number;
  attackS: number;
  holdS: number;
  releaseS: number;
}

const DUCKS: Record<DuckReason, DuckProfile> = {
  heavyHit: { depth: 0.5, attackS: 0.02, holdS: 0.14, releaseS: 0.4 },
  finisher: { depth: 0.32, attackS: 0.02, holdS: 0.32, releaseS: 0.7 },
  bossEntrance: { depth: 0.25, attackS: 0.06, holdS: 0.9, releaseS: 1.3 },
  stinger: { depth: 0.4, attackS: 0.03, holdS: 0.5, releaseS: 0.9 },
};

export const duckProfile = (reason: DuckReason): DuckProfile => DUCKS[reason];

const DUCKING_CUES: Record<string, DuckReason> = {
  heavyAttack: 'heavyHit', victoryFanfare: 'stinger', defeat: 'stinger',
};

/** The duck (if any) for a legacy cue name or a typed event. */
export function audioDuck(name: string, detail?: unknown): DuckProfile | undefined {
  const data = (detail ?? {}) as Partial<BirdAudioEventMap['hit.impact'] & BirdAudioEventMap['battle.enter']>;
  if (name === 'hit.impact') {
    if (data.lethal) return DUCKS.finisher;
    return impactScale(data.damage ?? 0, data.maxHp ?? 0).ducks ? DUCKS.heavyHit : undefined;
  }
  if (name === 'battle.enter') return data.tier === 'boss' ? DUCKS.bossEntrance : undefined;
  if (name === 'stinger.play') return DUCKS.stinger;
  const reason = DUCKING_CUES[name];
  return reason ? DUCKS[reason] : undefined;
}

// -------------------------------------------------------------------- ambience

export type AmbienceBedId = 'rain' | 'canal' | 'static' | 'wind';

const BEDS: AmbienceBedId[] = ['rain', 'canal', 'static', 'wind'];

/** District 0 rooftops in rain, 1 canal water, 2 radio static and wind in wires, 3 high wind. */
export function ambienceBedFor(district: number): AmbienceBedId {
  return BEDS[clamp(Math.floor(Number.isFinite(district) ? district : 0), 0, BEDS.length - 1)];
}

const BED_MOOD_LEVEL: Record<MusicMood, number> = {
  menu: 0.6, route: 1, battle: 0.75, boss: 0.6, victory: 0.5, defeat: 0.45,
};

export const AMBIENCE_OVERLAY_SCALE = 0.35;

/** Bed gain before the master: the Ambience setting, the scene mood, then the overlay dip. */
export function ambienceLevel(input: { mood: MusicMood; overlay: boolean; volume: number }) {
  const volume = clamp(input.volume, 0, 1);
  return 0.05 * volume * BED_MOOD_LEVEL[input.mood] * (input.overlay ? AMBIENCE_OVERLAY_SCALE : 1);
}

// ------------------------------------------------------------------ bird calls

/** [startS, durationS, fromHz, toHz, wave, gain] */
export type CallNote = readonly [number, number, number, number, OscillatorType, number];

export interface BirdCallShape {
  /** chirp: quick sweeps. trill: rapid repeats. caw: harsh, falling, with breath noise. */
  kind: 'chirp' | 'trill' | 'caw';
  notes: readonly CallNote[];
  /** Breath noise: [startS, durationS, centreHz, gain]. */
  rasp?: readonly [number, number, number, number];
}

function trill(
  count: number, everyS: number, noteS: number, lowHz: number, highHz: number, wave: OscillatorType, gain: number, riseHz = 0,
): CallNote[] {
  return Array.from({ length: count }, (_, index) => {
    const base = (index % 2 === 0 ? lowHz : highHz) + riseHz * index;
    return [index * everyS, noteS, base, base * 1.08, wave, gain] as const;
  });
}

/** Short calls under a card play: one voice per suit. */
export const SUIT_CALLS: Record<CardSuit, BirdCallShape> = {
  // Bright songbird double chirp.
  plumes: { kind: 'chirp', notes: [[0, 0.05, 2100, 3200, 'sine', 0.012], [0.07, 0.07, 2600, 3900, 'sine', 0.011]] },
  // One sharp falling cry.
  quills: { kind: 'caw', notes: [[0, 0.09, 3400, 1900, 'triangle', 0.011]], rasp: [0, 0.05, 4200, 0.004] },
  // Low waterbird croak.
  basins: {
    kind: 'caw',
    notes: [[0, 0.11, 520, 340, 'sawtooth', 0.007], [0.02, 0.1, 260, 180, 'sine', 0.012]],
    rasp: [0, 0.08, 700, 0.004],
  },
  // Soft three-note coo.
  nests: { kind: 'trill', notes: [...trill(2, 0.075, 0.06, 560, 560, 'sine', 0.012), [0.15, 0.09, 600, 480, 'sine', 0.011]] },
};

/** Longer signatures for each Flock Leader's Call, plus the rival jackdaw. */
export const LEADER_CALLS: Record<LeaderCallId, BirdCallShape> = {
  // Sparrow: three rising chirps.
  fledgling: {
    kind: 'chirp',
    notes: [[0, 0.06, 2400, 3600, 'sine', 0.014], [0.09, 0.06, 2600, 3900, 'sine', 0.013], [0.18, 0.1, 3000, 4400, 'sine', 0.014]],
  },
  // Chorus: a fast two-pitch trill that resolves upward.
  spark_caller: {
    kind: 'trill',
    notes: [...trill(6, 0.05, 0.042, 1500, 1900, 'triangle', 0.012), [0.31, 0.16, 2250, 2350, 'sine', 0.013]],
  },
  // Shrike: two harsh falling screeches.
  talon: {
    kind: 'caw',
    notes: [[0, 0.16, 2900, 1500, 'sawtooth', 0.01], [0.2, 0.2, 2600, 1100, 'sawtooth', 0.011]],
    rasp: [0, 0.38, 3200, 0.005],
  },
  // Heron: one long low croak.
  tidewarden: {
    kind: 'caw',
    notes: [[0, 0.24, 330, 210, 'sawtooth', 0.011], [0.04, 0.22, 165, 120, 'square', 0.008]],
    rasp: [0, 0.22, 600, 0.007],
  },
  // Weaver: a climbing chatter.
  roostkeeper: { kind: 'trill', notes: trill(8, 0.045, 0.034, 1300, 1420, 'triangle', 0.012, 95) },
  // Jackdaw: a clipped two-part "tchack".
  jackdaw: {
    kind: 'caw',
    notes: [[0, 0.07, 1250, 820, 'square', 0.009], [0.11, 0.09, 1100, 640, 'square', 0.01]],
    rasp: [0, 0.2, 1600, 0.006],
  },
};

export function leaderCall(leader: string): BirdCallShape {
  return LEADER_CALLS[leader as LeaderCallId] ?? LEADER_CALLS.fledgling;
}

export function callDurationS(shape: BirdCallShape) {
  const noteEnd = Math.max(...shape.notes.map(([at, duration]) => at + duration));
  return Math.max(noteEnd, shape.rasp ? shape.rasp[0] + shape.rasp[1] : 0);
}
