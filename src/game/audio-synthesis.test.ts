import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptiveMusicSequencer } from './adaptive-music';
import { AMBIENCE_BEDS, AMBIENCE_CROSSFADE_S, DistrictAmbience, MOOD_DRONES } from './audio-ambience';
import { AMBIENCE_OVERLAY_SCALE, LEADER_CALLS, SUIT_CALLS, ambienceLevel, callDurationS, duckProfile, type BirdAudioEvent, type BirdAudioEventMap } from './audio-events';
import { playAudioCue, playAudioEvent, type SynthAudioCue } from './audio-sfx';
import { createFakeAudioContext } from './audio-test-context';

/**
 * Structural checks only. A fake AudioContext records which nodes each sound
 * builds, how long they run and how loud their envelopes peak. Nothing here can
 * say whether a cue sounds like paper, metal or a bird: a person has to listen.
 */

const volumes = { sfx: 1, voice: 1 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', {
    StereoPannerNode: true,
    setTimeout: (handler: () => void, ms?: number) => setTimeout(handler, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function playEvent<E extends BirdAudioEvent>(event: E, detail?: BirdAudioEventMap[E], mix = volumes) {
  const fake = createFakeAudioContext();
  const played = playAudioEvent(fake.ctx, fake.master, mix, event, detail);
  return { ...fake, played };
}

const sounding: Array<[BirdAudioEvent, object | undefined, number]> = [
  ['ui.click', undefined, 0.06],
  ['ui.confirm', undefined, 0.25],
  ['ui.cancel', undefined, 0.25],
  ['card.draw', { count: 2 }, 0.12],
  ['card.play', { suit: 'nests' }, 0.35],
  ['card.discard', { count: 1 }, 0.15],
  ['material.tap', { material: 'paper' }, 0.15],
  ['material.tap', { material: 'metal' }, 0.32],
  ['material.tap', { material: 'wood' }, 0.1],
  ['material.tap', { material: 'water' }, 0.2],
  ['voice.suit', { suit: 'plumes' }, 0.3],
  ['voice.leader', { leader: 'tidewarden' }, 0.65],
  ['hit.impact', { damage: 3, maxHp: 60 }, 0.15],
  ['hit.impact', { damage: 30, maxHp: 60, lethal: true }, 0.5],
  ['cover.absorb', undefined, 0.15],
  ['cover.break', undefined, 0.3],
  ['count.tick', { step: 3, of: 10 }, 0.08],
  ['stinger.play', { id: 'victory' }, 1.2],
  ['stinger.play', { id: 'defeat' }, 1.6],
  ['stinger.play', { id: 'reward' }, 0.4],
  ['stinger.play', { id: 'molt' }, 0.6],
  ['stinger.play', { id: 'bossPhase' }, 0.7],
  ['battle.enter', { tier: 'boss' }, 1],
];

describe('typed event voices (structure only)', () => {
  it.each(sounding)('%s %j builds a short, quiet, self-cleaning graph', (event, detail, maxSeconds) => {
    const fake = playEvent(event, detail as never);
    expect(fake.played).toBe(true);
    expect(fake.sources().length).toBeGreaterThan(0);
    expect(fake.span()).toBeGreaterThan(0);
    expect(fake.span()).toBeLessThanOrEqual(maxSeconds);
    // Every source has its own envelope that starts or ends at silence and stays well under full scale.
    expect(fake.envelopes().length).toBe(fake.sources().length);
    for (const envelope of fake.envelopes()) {
      expect(envelope.gain.peak()).toBeGreaterThan(0.0001);
      expect(envelope.gain.peak()).toBeLessThanOrEqual(0.15);
      expect(envelope.gain.last().value).toBe(0.0001);
    }
    fake.finish();
    expect(fake.nodes.filter((node) => node !== fake.masterNode).every((node) => node.disconnected)).toBe(true);
  });

  it('is silent for state events and for a non-boss battle', () => {
    for (const [event, detail] of [
      ['turn.start', {}], ['flock.formation', { state: 'surging' }], ['district.enter', { district: 2 }],
      ['overlay.set', { id: 'pause', open: true }], ['battle.enter', { tier: 'elite' }], ['battle.enter', { tier: 'street' }],
    ] as Array<[BirdAudioEvent, object]>) {
      const fake = playEvent(event, detail as never);
      expect(fake.played).toBe(false);
      expect(fake.sources()).toHaveLength(0);
    }
  });

  it('honours the effects and voice volume settings separately', () => {
    const peakSum = (mix: typeof volumes) => {
      const fake = playEvent('card.play', { suit: 'plumes' }, mix);
      return fake.envelopes().reduce((sum, envelope) => sum + envelope.gain.peak(), 0);
    };
    const full = peakSum({ sfx: 1, voice: 1 });
    const noVoice = peakSum({ sfx: 1, voice: 0 });
    const noSfx = peakSum({ sfx: 0, voice: 1 });
    expect(noVoice).toBeLessThan(full);
    expect(noSfx).toBeLessThan(full);
    expect(noVoice + noSfx).toBeCloseTo(full, 2);
    const silent = playEvent('card.play', { suit: 'plumes' }, { sfx: 0, voice: 0 });
    expect(Math.max(...silent.envelopes().map((envelope) => envelope.gain.peak()))).toBeLessThanOrEqual(0.0001);
  });

  it('raises the pitch of consecutive card plays and restarts at the turn boundary', () => {
    const fake = createFakeAudioContext();
    const bodyPitch = () => {
      fake.reset();
      fake.raw.currentTime += 0.2;
      expect(playAudioEvent(fake.ctx, fake.master, volumes, 'card.play', { suit: null })).toBe(true);
      return fake.oscillators()[0].frequency.events[0].value;
    };
    const turn = [bodyPitch(), bodyPitch(), bodyPitch(), bodyPitch()];
    for (let index = 1; index < turn.length; index += 1) expect(turn[index]).toBeGreaterThan(turn[index - 1]);
    expect(turn[3] / turn[0]).toBeCloseTo(Math.pow(2, 7 / 12), 5);
    playAudioEvent(fake.ctx, fake.master, volumes, 'turn.start', {});
    expect(bodyPitch()).toBe(turn[0]);
    bodyPitch();
    // The legacy end-of-turn cue restarts the ladder too.
    fake.raw.currentTime += 0.2;
    playAudioCue(fake.ctx, fake.master, 1, 'turn');
    expect(bodyPitch()).toBe(turn[0]);
  });

  it('adds the suit material and bird call to a card play', () => {
    const neutral = playEvent('card.play', { suit: null }).sources().length;
    const plumes = playEvent('card.play', { suit: 'plumes' }).sources().length;
    const basins = playEvent('card.play', { suit: 'basins' }).sources().length;
    const nests = playEvent('card.play', { suit: 'nests' }).sources().length;
    expect(plumes).toBe(neutral + SUIT_CALLS.plumes.notes.length);
    expect(basins).toBeGreaterThan(neutral + SUIT_CALLS.basins.notes.length);
    expect(nests).toBeGreaterThan(neutral + SUIT_CALLS.nests.notes.length);
    expect(playEvent('card.play', { suit: 'plumes', molt: true }).sources().length).toBe(plumes + 1);
  });

  it('scales an impact from a light tick to a heavy thud by share of max HP', () => {
    const tick = playEvent('hit.impact', { damage: 1, maxHp: 60 });
    const solid = playEvent('hit.impact', { damage: 16, maxHp: 60 });
    const heavy = playEvent('hit.impact', { damage: 40, maxHp: 60 });
    const loudest = (fake: typeof tick) => Math.max(...fake.envelopes().map((envelope) => envelope.gain.peak()));
    const lowest = (fake: typeof tick) => Math.min(...fake.oscillators().map((node) => node.frequency.last().value));
    expect(tick.sources().length).toBeLessThan(solid.sources().length);
    expect(solid.sources().length).toBeLessThan(heavy.sources().length);
    expect(loudest(tick)).toBeLessThan(loudest(solid));
    expect(loudest(solid)).toBeLessThan(loudest(heavy));
    expect(tick.span()).toBeLessThan(solid.span());
    expect(solid.span()).toBeLessThan(heavy.span());
    expect(lowest(heavy)).toBeLessThan(lowest(solid));
    expect(lowest(solid)).toBeLessThan(lowest(tick));
    // The same damage is a small sound on a big target.
    expect(loudest(playEvent('hit.impact', { damage: 16, maxHp: 400 }))).toBeLessThan(loudest(solid));
  });

  it('keeps Cover absorbing and Cover breaking apart, and adds the break to a hit that shatters it', () => {
    const absorb = playEvent('cover.absorb');
    const shatter = playEvent('cover.break');
    const top = (fake: typeof absorb) => Math.max(...fake.oscillators().map((node) => node.frequency.peak()));
    expect(top(absorb)).toBeLessThan(700);
    expect(top(shatter)).toBeGreaterThan(3000);
    expect(shatter.sources().length).toBeGreaterThan(absorb.sources().length);
    expect(shatter.span()).toBeGreaterThan(absorb.span());
    const plain = playEvent('hit.impact', { damage: 10, maxHp: 60 });
    const broke = playEvent('hit.impact', { damage: 10, maxHp: 60, coverBroke: true });
    expect(broke.sources().length).toBe(plain.sources().length + shatter.sources().length);
  });

  it('gives click, confirm and cancel three different shapes', () => {
    const shape = (event: BirdAudioEvent) => {
      const fake = playEvent(event);
      return fake.oscillators().map((node) => `${node.frequency.events[0].value}>${node.frequency.last().value}`).join('|');
    };
    expect(new Set([shape('ui.click'), shape('ui.confirm'), shape('ui.cancel')]).size).toBe(3);
    const rises = (event: BirdAudioEvent) => playEvent(event).oscillators().map((node) => node.frequency.last().value - node.frequency.events[0].value);
    expect(rises('ui.confirm').every((delta) => delta > 0)).toBe(true);
    expect(rises('ui.cancel').every((delta) => delta < 0)).toBe(true);
  });

  it('rises across a counting number', () => {
    const pitch = (step: number) => playEvent('count.tick', { step, of: 8 }).oscillators()[0].frequency.events[0].value;
    for (let step = 1; step < 8; step += 1) expect(pitch(step)).toBeGreaterThan(pitch(step - 1));
    expect(pitch(7) / pitch(0)).toBeCloseTo(2, 5);
  });

  it('plays each suit and leader call with one oscillator per note for its written length', () => {
    for (const [suit, shape] of Object.entries(SUIT_CALLS)) {
      const fake = playEvent('voice.suit', { suit: suit as keyof typeof SUIT_CALLS });
      expect(fake.oscillators()).toHaveLength(shape.notes.length);
      expect(fake.span()).toBeCloseTo(callDurationS(shape) + 0.02, 5);
    }
    for (const [leader, shape] of Object.entries(LEADER_CALLS)) {
      const fake = playEvent('voice.leader', { leader });
      expect(fake.oscillators()).toHaveLength(shape.notes.length);
      expect(fake.sources()).toHaveLength(shape.notes.length + (shape.rasp ? 1 : 0));
      expect(fake.span()).toBeCloseTo(callDurationS(shape) + 0.02, 5);
    }
  });

  it('drops a second copy of the same event inside the budget window', () => {
    const fake = createFakeAudioContext();
    expect(playAudioEvent(fake.ctx, fake.master, volumes, 'cover.break')).toBe(true);
    const count = fake.sources().length;
    expect(playAudioEvent(fake.ctx, fake.master, volumes, 'cover.break')).toBe(false);
    expect(fake.sources()).toHaveLength(count);
  });
});

describe('legacy cues (structure only)', () => {
  const cue = (name: SynthAudioCue, intensity = 1) => {
    const fake = createFakeAudioContext();
    const played = playAudioCue(fake.ctx, fake.master, 1, name, intensity);
    return { ...fake, played };
  };

  it('routes the old cue names to the new voices', () => {
    const same = (name: SynthAudioCue, event: BirdAudioEvent, detail?: object) => {
      expect(cue(name).sources().length, name).toBe(playEvent(event, detail as never).sources().length);
    };
    same('confirm', 'ui.click');
    same('close', 'ui.cancel');
    same('draw', 'card.draw');
    same('discard', 'card.discard');
    same('routeChoice', 'material.tap', { material: 'wood' });
    same('coverBlock', 'cover.absorb');
    same('block', 'cover.absorb');
    same('coverBreak', 'cover.break');
    same('reward', 'stinger.play', { id: 'reward' });
    same('victoryFanfare', 'stinger.play', { id: 'victory' });
    same('defeat', 'stinger.play', { id: 'defeat' });
    same('flockHeron', 'voice.leader', { leader: 'tidewarden' });
    same('flockJackdaw', 'voice.leader', { leader: 'jackdaw' });
    // Scrap changing hands is struck metal.
    expect(cue('marketPurchase').oscillators().length).toBeGreaterThanOrEqual(4);
  });

  it('still plays every remaining cue', () => {
    for (const name of ['locked', 'route', 'encounter', 'spend', 'attack', 'heavyAttack', 'hitConfirm', 'cover', 'heal', 'shuffle', 'flow',
      'moltPower', 'threat', 'formation', 'turn', 'victory', 'rooftopAir'] as SynthAudioCue[]) {
      const fake = cue(name);
      expect(fake.played, name).toBe(true);
      expect(fake.sources().length, name).toBeGreaterThan(0);
      fake.finish();
      expect(fake.nodes.filter((node) => node !== fake.masterNode).every((node) => node.disconnected), name).toBe(true);
    }
  });

  it('lets a damage-scaled hit replace the fixed attack cue in the same tick only', () => {
    const fake = createFakeAudioContext();
    expect(playAudioEvent(fake.ctx, fake.master, volumes, 'hit.impact', { damage: 5, maxHp: 50 })).toBe(true);
    const count = fake.sources().length;
    expect(playAudioCue(fake.ctx, fake.master, 1, 'attack')).toBe(false);
    expect(playAudioCue(fake.ctx, fake.master, 1, 'heavyAttack')).toBe(false);
    expect(playAudioCue(fake.ctx, fake.master, 1, 'hitConfirm')).toBe(true);
    expect(fake.sources()).toHaveLength(count + 3);
    fake.raw.currentTime += 0.2;
    expect(playAudioCue(fake.ctx, fake.master, 1, 'attack')).toBe(true);
  });
});

describe('district ambience beds (structure only)', () => {
  const target = (district: number, extra: Partial<Parameters<DistrictAmbience['update']>[2]> = {}) =>
    ({ district, mood: 'route' as const, overlay: false, volume: 1, ...extra });

  /** Output gains in build order: the mood drone first, then each district bed. */
  const outs = (fake: ReturnType<typeof createFakeAudioContext>) =>
    fake.nodes.filter((node) => node.kind === 'gain' && node !== fake.masterNode && node.outputs.includes(fake.masterNode));

  it('builds one looping noise strand per layer of each district bed', () => {
    for (const [district, id] of [[0, 'rain'], [1, 'canal'], [2, 'static'], [3, 'wind']] as const) {
      const fake = createFakeAudioContext();
      const ambience = new DistrictAmbience();
      ambience.update(fake.ctx, fake.master, target(district));
      const loops = fake.nodes.filter((node) => node.kind === 'buffer');
      expect(ambience.snapshot().bed).toBe(id);
      expect(loops).toHaveLength(AMBIENCE_BEDS[id].length);
      expect(loops.every((node) => node.loop && node.startedAt !== undefined && node.stoppedAt === undefined)).toBe(true);
      expect(loops[0].buffer!.length).toBe(fake.raw.sampleRate * 2);
      const filters = fake.nodes.filter((node) => node.kind === 'filter').slice(1);
      expect(filters.map((node) => node.type)).toEqual(AMBIENCE_BEDS[id].map((strand) => strand.filter));
      // Every strand moves: a slow oscillator rides its level, and sweeps ride the cutoff.
      const movers = fake.oscillators().filter((node) => node.outputs.some((output) => (output as { kind?: string }).kind === 'gain'
        && (output as { outputs: unknown[] }).outputs.some((param) => !(param as { kind?: string }).kind)));
      expect(movers).toHaveLength(AMBIENCE_BEDS[id].reduce((sum, strand) => sum + (strand.swell ? 1 : 0) + (strand.sweep ? 1 : 0), 0));
      expect(movers.every((node) => node.frequency.value <= 12)).toBe(true);
      // The swell never drives a strand's gain below zero.
      for (const strand of AMBIENCE_BEDS[id]) expect(strand.gain * (1 - (strand.swell?.[1] ?? 0))).toBeGreaterThanOrEqual(0);
    }
  });

  it('plays rain on the title screen whatever district was last visited', () => {
    const fake = createFakeAudioContext();
    const ambience = new DistrictAmbience();
    ambience.update(fake.ctx, fake.master, target(3, { mood: 'menu' }));
    expect(ambience.snapshot().bed).toBe('rain');
  });

  it('crossfades to the new bed on a district change', () => {
    const fake = createFakeAudioContext();
    const ambience = new DistrictAmbience();
    ambience.update(fake.ctx, fake.master, target(0));
    const rainOut = outs(fake)[1];
    const rainSources = fake.sources().filter((node) => node.kind === 'buffer' || node.frequency.value <= 12);
    expect(rainOut.gain.last()).toEqual({ kind: 'exp', value: ambienceLevel(target(0)), time: AMBIENCE_CROSSFADE_S });
    fake.raw.currentTime = 10;
    ambience.update(fake.ctx, fake.master, target(1));
    expect(ambience.snapshot()).toMatchObject({ bed: 'canal', crossfades: 1 });
    expect(rainOut.gain.last()).toEqual({ kind: 'exp', value: 0.0001, time: 10 + AMBIENCE_CROSSFADE_S });
    expect(rainSources.every((node) => node.stoppedAt! > 10 + AMBIENCE_CROSSFADE_S)).toBe(true);
    const canalOut = outs(fake)[2];
    expect(canalOut.gain.events[0]).toMatchObject({ value: 0.0001, time: 10 });
    expect(canalOut.gain.last()).toEqual({ kind: 'exp', value: ambienceLevel(target(1)), time: 10 + AMBIENCE_CROSSFADE_S });
    // Once the old bed has faded its whole graph is dropped.
    rainSources.forEach((node) => node.onended?.());
    expect(rainOut.disconnected).toBe(true);
    // Asking for the same district again changes nothing.
    const nodeCount = fake.nodes.length;
    ambience.update(fake.ctx, fake.master, target(1));
    expect(fake.nodes).toHaveLength(nodeCount);
    expect(ambience.snapshot().crossfades).toBe(1);
  });

  it('keeps a three-voice drone for the scene mood and swaps it when the mood changes', () => {
    const fake = createFakeAudioContext();
    const ambience = new DistrictAmbience();
    ambience.update(fake.ctx, fake.master, target(0, { mood: 'route' }));
    const routeDrone = outs(fake)[0];
    const voices = () => fake.oscillators().filter((node) => node.frequency.value > 12);
    expect(ambience.snapshot().drone).toBe('route');
    expect(voices().map((node) => node.frequency.value)).toEqual([...MOOD_DRONES.route.freqs]);
    expect(routeDrone.gain.last().value).toBeCloseTo(MOOD_DRONES.route.volume, 8);
    ambience.update(fake.ctx, fake.master, target(0, { mood: 'boss' }));
    expect(ambience.snapshot()).toMatchObject({ drone: 'boss', bed: 'rain', crossfades: 0 });
    expect(routeDrone.gain.last().value).toBe(0.0001);
    expect(voices().slice(3).map((node) => node.frequency.value)).toEqual([...MOOD_DRONES.boss.freqs]);
    expect(voices().slice(0, 3).every((node) => node.stoppedAt !== undefined)).toBe(true);
  });

  it('sits lower under an overlay and comes back when it closes', () => {
    const fake = createFakeAudioContext();
    const ambience = new DistrictAmbience();
    ambience.update(fake.ctx, fake.master, target(2));
    const [drone, out] = outs(fake);
    const open = out.gain.last().value;
    const droneEvents = drone.gain.events.length;
    ambience.update(fake.ctx, fake.master, target(2, { overlay: true }));
    expect(ambience.snapshot()).toMatchObject({ bed: 'static', overlay: true });
    expect(out.gain.last().value).toBeCloseTo(open * AMBIENCE_OVERLAY_SCALE, 8);
    ambience.update(fake.ctx, fake.master, target(2));
    expect(out.gain.last().value).toBeCloseTo(open, 8);
    expect(fake.nodes.filter((node) => node.kind === 'buffer')).toHaveLength(AMBIENCE_BEDS.static.length);
    // The overlay dip belongs to the bed; the mood drone is left alone.
    expect(drone.gain.events).toHaveLength(droneEvents);
  });

  it('follows the Ambience volume and stops when it reaches zero or the game is muted', () => {
    const fake = createFakeAudioContext();
    const ambience = new DistrictAmbience();
    ambience.update(fake.ctx, fake.master, target(3));
    const [drone, out] = outs(fake);
    const full = out.gain.last().value;
    const droneFull = drone.gain.last().value;
    ambience.update(fake.ctx, fake.master, target(3, { volume: 0.25 }));
    expect(out.gain.last().value).toBeCloseTo(full / 4, 8);
    expect(drone.gain.last().value).toBeCloseTo(droneFull / 4, 8);
    ambience.update(fake.ctx, fake.master, target(3, { volume: 0 }));
    expect(ambience.snapshot()).toMatchObject({ bed: null, drone: null, level: 0 });
    expect(out.gain.last().value).toBe(0.0001);
    expect(drone.gain.last().value).toBe(0.0001);
    expect(fake.sources().every((node) => node.stoppedAt !== undefined)).toBe(true);
  });
});

describe('adaptive music layers (structure only)', () => {
  const start = (mood: 'battle' | 'boss' | 'route' = 'battle') => {
    const fake = createFakeAudioContext();
    const music = new AdaptiveMusicSequencer();
    music.start(fake.ctx, fake.master, mood, 1);
    return { fake, music };
  };
  const phrase = (ms = 360 * 4) => vi.advanceTimersByTime(ms);

  it('adds stems on Surge and strips back on Scatter at the next phrase', () => {
    const { fake, music } = start();
    vi.advanceTimersByTime(140);
    expect(music.snapshot()).toMatchObject({ pattern: 'street-beat', active: true, layers: ['pulse', 'harmony', 'bass'] });
    fake.reset();
    phrase();
    const calm = fake.sources().length;
    music.setFlightState('surge', 0, 'surging', 'street');
    // Mid-phrase the old orchestration keeps playing.
    expect(music.snapshot().layers).toEqual(['pulse', 'harmony', 'bass']);
    phrase();
    fake.reset();
    phrase();
    const surge = fake.sources().length;
    expect(music.snapshot()).toMatchObject({ flightState: 'surge', formation: 'surging' });
    expect(music.snapshot().layers).toEqual(expect.arrayContaining(['shimmer', 'lead', 'hat']));
    music.setFlightState('planning', 0, 'scattered', 'street');
    phrase();
    fake.reset();
    phrase();
    const scatter = fake.sources().length;
    expect(music.snapshot().layers).toEqual(['pulse']);
    expect(surge).toBeGreaterThan(calm);
    expect(scatter).toBeLessThan(calm);
    // One lead voice per step and nothing else.
    expect(scatter).toBe(4);
  });

  it('darkens the lead filter on Scatter and opens it on Surge', () => {
    const cutoff = (formation: 'scattered' | 'holding' | 'surging') => {
      const { fake, music } = start();
      music.setFlightState('planning', 0, formation, 'street');
      phrase(140 + 360 * 4);
      fake.reset();
      phrase(360);
      return fake.nodes.filter((node) => node.kind === 'filter')[0].frequency.events[0].value;
    };
    expect(cutoff('scattered')).toBeLessThan(cutoff('holding'));
    expect(cutoff('holding')).toBeLessThan(cutoff('surging'));
  });

  it('intensifies for elites and bosses', () => {
    const density = (mood: 'battle' | 'boss', tier: 'street' | 'elite' | 'boss') => {
      const { fake, music } = start(mood);
      music.setFlightState('planning', 0, 'holding', tier);
      phrase(140 + 420 * 4);
      fake.reset();
      phrase(420 * 8);
      return { sources: fake.sources().length / music.snapshot().pulses, layers: music.snapshot().layers! };
    };
    const street = density('battle', 'street');
    const elite = density('battle', 'elite');
    const boss = density('boss', 'boss');
    expect(elite.layers).toEqual(expect.arrayContaining(['hat', 'drive']));
    expect(boss.layers).toEqual(expect.arrayContaining(['hat', 'drive', 'sub']));
    expect(elite.sources).toBeGreaterThan(street.sources);
  });

  it('ducks on its own stage and returns to full level', () => {
    const { fake, music } = start();
    const duckStage = fake.nodes.find((node) => node.kind === 'gain' && node.outputs.includes(fake.masterNode))!;
    const bus = fake.nodes.find((node) => node.kind === 'gain' && node.outputs.includes(duckStage))!;
    const busEvents = bus.gain.events.length;
    fake.raw.currentTime = 5;
    const duck = duckProfile('finisher');
    music.duck(duck);
    expect(music.snapshot().ducks).toBe(1);
    expect(bus.gain.events).toHaveLength(busEvents);
    expect(duckStage.gain.events.map((event) => [event.kind, event.value, Number(event.time.toFixed(3))])).toEqual([
      ['set', 1, 5],
      ['linear', duck.depth, 5.02],
      ['set', duck.depth, 5.34],
      ['linear', 1, 6.04],
    ]);
  });

  it('follows the Music volume and goes quiet when stopped', () => {
    const { fake, music } = start('route');
    const duckStage = fake.nodes.find((node) => node.kind === 'gain' && node.outputs.includes(fake.masterNode))!;
    const bus = fake.nodes.find((node) => node.kind === 'gain' && node.outputs.includes(duckStage))!;
    const full = bus.gain.last().value;
    music.setVolume(0.5);
    expect(bus.gain.last().value).toBeCloseTo(full / 2, 8);
    music.setVolume(0);
    vi.advanceTimersByTime(140);
    fake.reset();
    vi.advanceTimersByTime(3000);
    expect(fake.sources()).toHaveLength(0);
    expect(music.snapshot().active).toBe(false);
    music.stop();
    expect(bus.gain.last().value).toBe(0.0001);
    vi.advanceTimersByTime(1000);
    expect(bus.disconnected && duckStage.disconnected).toBe(true);
  });

  it('records the suit voice a card play asked for', () => {
    const music = new AdaptiveMusicSequencer();
    music.noteCardVoice('plumes', false, 0.25);
    music.noteCardVoice('neutral', false, 0.25);
    music.noteCardVoice('plumes', true, 3);
    expect(music.snapshot().cardVoices).toEqual({
      requests: { plumes: 2, neutral: 1 },
      last: { voice: 'plumes', usesMolt: true, sequence: 3, variant: 2, volume: 1 },
    });
  });
});
