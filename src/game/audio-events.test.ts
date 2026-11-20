import { describe, expect, it } from 'vitest';
import {
  AMBIENCE_OVERLAY_SCALE, LEADER_CALLS, PitchLadder, SUIT_CALLS, ambienceBedFor, ambienceLevel, audioDuck,
  callDurationS, countTickRatio, duckProfile, impactScale, leaderCall, pitchLadderRatio, pitchLadderSemitones,
  selectMusicLayers,
} from './audio-events';
import { AudioCueBudget, budgetFor } from './audio-cue-budget';

describe('pitch ladder', () => {
  it('rises on every consecutive play and stops at one octave', () => {
    const steps = Array.from({ length: 9 }, (_, step) => pitchLadderSemitones(step));
    expect(steps).toEqual([0, 2, 4, 7, 9, 12, 12, 12, 12]);
    expect(pitchLadderRatio(0)).toBe(1);
    expect(pitchLadderRatio(5)).toBeCloseTo(2, 6);
    for (let step = 1; step <= 5; step += 1) expect(pitchLadderRatio(step)).toBeGreaterThan(pitchLadderRatio(step - 1));
  });

  it('treats bad input as the first step', () => {
    expect(pitchLadderSemitones(-3)).toBe(0);
    expect(pitchLadderSemitones(Number.NaN)).toBe(0);
    expect(pitchLadderSemitones(2.9)).toBe(4);
  });

  it('counts plays within a turn, restarts on reset and lapses after a long silence', () => {
    const ladder = new PitchLadder(5000);
    expect([ladder.next(0), ladder.next(200), ladder.next(900)]).toEqual([0, 1, 2]);
    expect(ladder.peek()).toBe(3);
    ladder.reset();
    expect(ladder.next(1000)).toBe(0);
    expect(ladder.next(1500)).toBe(1);
    expect(ladder.next(6501)).toBe(0);
  });

  it('glides counting numbers up one octave across a known total', () => {
    expect(countTickRatio(0, 10)).toBe(1);
    expect(countTickRatio(9, 10)).toBeCloseTo(2, 6);
    expect(countTickRatio(40, 10)).toBeCloseTo(2, 6);
    for (let step = 1; step < 10; step += 1) expect(countTickRatio(step, 10)).toBeGreaterThan(countTickRatio(step - 1, 10));
  });

  it('climbs a semitone a tick, two octaves at most, when the total is unknown', () => {
    expect(countTickRatio(12)).toBeCloseTo(2, 6);
    expect(countTickRatio(500)).toBeCloseTo(4, 6);
  });
});

describe('impact scaling', () => {
  it('names the tier from the share of max HP, not the raw damage', () => {
    expect(impactScale(1, 40).tier).toBe('tick');
    expect(impactScale(4, 40).tier).toBe('light');
    expect(impactScale(10, 40).tier).toBe('solid');
    expect(impactScale(20, 40).tier).toBe('heavy');
    // The same 8 damage is a heavy blow to a small enemy and a light one to a boss.
    expect(impactScale(8, 16).tier).toBe('heavy');
    expect(impactScale(8, 120).tier).toBe('light');
  });

  it('gets louder, lower and longer as the share grows', () => {
    const shares = [0.02, 0.1, 0.25, 0.5, 1].map((share) => impactScale(share * 100, 100));
    for (let index = 1; index < shares.length; index += 1) {
      expect(shares[index].gain).toBeGreaterThan(shares[index - 1].gain);
      expect(shares[index].bodyHz).toBeLessThan(shares[index - 1].bodyHz);
      expect(shares[index].durationS).toBeGreaterThan(shares[index - 1].durationS);
    }
    expect(shares[0].gain).toBeGreaterThanOrEqual(0.55);
    expect(shares[4].gain).toBeLessThanOrEqual(1.6);
    expect(shares[4].bodyHz).toBeGreaterThanOrEqual(50);
  });

  it('clamps overkill and ignores zero damage or an unknown max HP', () => {
    expect(impactScale(999, 20).share).toBe(1);
    expect(impactScale(0, 20)).toMatchObject({ share: 0, tier: 'tick', ducks: false });
    expect(impactScale(5, 0).share).toBe(0);
  });

  it('never plays a finishing blow as a tick', () => {
    expect(impactScale(1, 80).tier).toBe('tick');
    expect(impactScale(1, 80, true)).toMatchObject({ tier: 'solid', ducks: true });
    expect(impactScale(1, 80, true).gain).toBeGreaterThan(impactScale(1, 80).gain);
  });

  it('ducks the music only for heavy hits', () => {
    expect(impactScale(4, 40).ducks).toBe(false);
    expect(impactScale(10, 40).ducks).toBe(false);
    expect(impactScale(20, 40).ducks).toBe(true);
  });
});

describe('music layer selection', () => {
  const battle = (extra: Partial<Parameters<typeof selectMusicLayers>[0]> = {}) =>
    selectMusicLayers({ mood: 'battle', ...extra });

  it('keeps menus and the route to a plain pulse and harmony', () => {
    for (const mood of ['menu', 'route', 'victory', 'defeat'] as const) {
      expect(selectMusicLayers({ mood, formation: 'surging', tier: 'boss' }))
        .toEqual({ layers: ['pulse', 'harmony'], filterScale: 1, gainScale: 1 });
    }
  });

  it('adds stems on Surge', () => {
    const calm = battle();
    const surge = battle({ formation: 'surging' });
    expect(calm.layers).toEqual(['pulse', 'harmony', 'bass']);
    expect(surge.layers).toEqual(expect.arrayContaining(['pulse', 'harmony', 'bass', 'shimmer', 'lead', 'hat']));
    expect(surge.layers.length).toBeGreaterThan(calm.layers.length);
    expect(surge.filterScale).toBeGreaterThan(calm.filterScale);
    expect(surge.gainScale).toBeGreaterThan(calm.gainScale);
    // A full Flow meter reads as Surge even before the formation event arrives.
    expect(battle({ flightState: 'surge' }).layers).toEqual(surge.layers);
  });

  it('thins out to a darker, quieter pulse on Scatter', () => {
    const scatter = battle({ formation: 'scattered', flightState: 'flow', tier: 'elite' });
    expect(scatter.layers).toEqual(['pulse']);
    expect(scatter.filterScale).toBeLessThan(1);
    expect(scatter.gainScale).toBeLessThan(1);
  });

  it('intensifies for elites and again for bosses', () => {
    const street = battle();
    const elite = battle({ tier: 'elite' });
    const boss = selectMusicLayers({ mood: 'boss' });
    expect(elite.layers).toEqual(expect.arrayContaining(['hat', 'drive']));
    expect(elite.layers).not.toContain('sub');
    expect(boss.layers).toEqual(expect.arrayContaining(['hat', 'drive', 'sub']));
    expect(elite.gainScale).toBeGreaterThan(street.gainScale);
    expect(boss.gainScale).toBeGreaterThan(elite.gainScale);
    // The boss mood wins even if no tier was reported.
    expect(selectMusicLayers({ mood: 'boss', tier: 'street' }).layers).toContain('sub');
  });

  it('keeps one stem per flight state', () => {
    expect(battle({ flightState: 'flow' }).layers).toContain('shimmer');
    expect(battle({ flightState: 'flow' }).layers).not.toContain('lead');
    expect(battle({ flightState: 'molt' }).layers).toContain('molt');
    expect(battle({ flightState: 'open-sky' }).layers).toContain('drone');
    expect(battle({ flightState: 'boss-phase' }).layers).toContain('alarm');
    expect(battle({ flightState: 'boss-phase', formation: 'scattered' }).layers).toEqual(['pulse', 'alarm']);
  });
});

describe('ducking', () => {
  it('steps back further and longer for bigger moments', () => {
    expect(duckProfile('heavyHit').depth).toBeGreaterThan(duckProfile('finisher').depth);
    expect(duckProfile('finisher').depth).toBeGreaterThan(duckProfile('bossEntrance').depth);
    expect(duckProfile('bossEntrance').holdS).toBeGreaterThan(duckProfile('heavyHit').holdS);
    for (const reason of ['heavyHit', 'finisher', 'bossEntrance', 'stinger'] as const) {
      const duck = duckProfile(reason);
      expect(duck.depth).toBeGreaterThan(0);
      expect(duck.depth).toBeLessThan(1);
      expect(duck.attackS + duck.holdS + duck.releaseS).toBeLessThan(2.5);
    }
  });

  it('ducks for heavy hits, finishing blows, stingers and boss entrances only', () => {
    expect(audioDuck('hit.impact', { damage: 2, maxHp: 40 })).toBeUndefined();
    expect(audioDuck('hit.impact', { damage: 20, maxHp: 40 })).toBe(duckProfile('heavyHit'));
    expect(audioDuck('hit.impact', { damage: 2, maxHp: 40, lethal: true })).toBe(duckProfile('finisher'));
    expect(audioDuck('battle.enter', { tier: 'boss' })).toBe(duckProfile('bossEntrance'));
    expect(audioDuck('battle.enter', { tier: 'elite' })).toBeUndefined();
    expect(audioDuck('stinger.play', { id: 'molt' })).toBe(duckProfile('stinger'));
    expect(audioDuck('heavyAttack')).toBe(duckProfile('heavyHit'));
    expect(audioDuck('defeat')).toBe(duckProfile('stinger'));
    expect(audioDuck('victoryFanfare')).toBe(duckProfile('stinger'));
    for (const quiet of ['attack', 'draw', 'confirm', 'card.play', 'ui.click', 'count.tick']) expect(audioDuck(quiet)).toBeUndefined();
  });
});

describe('district ambience', () => {
  it('maps each district to its bed and clamps out-of-range districts', () => {
    expect([0, 1, 2, 3].map(ambienceBedFor)).toEqual(['rain', 'canal', 'static', 'wind']);
    expect(ambienceBedFor(-1)).toBe('rain');
    expect(ambienceBedFor(9)).toBe('wind');
    expect(ambienceBedFor(Number.NaN)).toBe('rain');
  });

  it('follows the Ambience setting, sits lower in fights and lower again under overlays', () => {
    const route = ambienceLevel({ mood: 'route', overlay: false, volume: 1 });
    expect(ambienceLevel({ mood: 'route', overlay: false, volume: 0.5 })).toBeCloseTo(route / 2, 8);
    expect(ambienceLevel({ mood: 'route', overlay: false, volume: 0 })).toBe(0);
    expect(ambienceLevel({ mood: 'route', overlay: false, volume: 7 })).toBe(route);
    expect(ambienceLevel({ mood: 'battle', overlay: false, volume: 1 })).toBeLessThan(route);
    expect(ambienceLevel({ mood: 'boss', overlay: false, volume: 1 })).toBeLessThan(ambienceLevel({ mood: 'battle', overlay: false, volume: 1 }));
    expect(ambienceLevel({ mood: 'route', overlay: true, volume: 1 })).toBeCloseTo(route * AMBIENCE_OVERLAY_SCALE, 8);
  });
});

describe('bird call shapes', () => {
  const signature = (shape: { notes: readonly (readonly unknown[])[]; rasp?: readonly number[] }) => JSON.stringify([shape.notes, shape.rasp]);

  it('gives every suit a distinct short call', () => {
    const suits = Object.values(SUIT_CALLS);
    expect(new Set(suits.map(signature)).size).toBe(4);
    for (const shape of suits) {
      expect(callDurationS(shape)).toBeGreaterThan(0.05);
      expect(callDurationS(shape)).toBeLessThanOrEqual(0.25);
    }
  });

  it('gives every Flock Leader a distinct, longer signature', () => {
    const leaders = Object.values(LEADER_CALLS);
    expect(new Set(leaders.map(signature)).size).toBe(6);
    expect(new Set(leaders.map((shape) => shape.kind))).toEqual(new Set(['chirp', 'trill', 'caw']));
    for (const shape of leaders) {
      expect(callDurationS(shape)).toBeGreaterThanOrEqual(0.2);
      expect(callDurationS(shape)).toBeLessThanOrEqual(0.6);
      expect(shape.notes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps each shape honest: caws fall and carry breath noise, chirps rise, trills repeat', () => {
    for (const shape of [...Object.values(SUIT_CALLS), ...Object.values(LEADER_CALLS)]) {
      for (const [at, duration, from, to, , gain] of shape.notes) {
        expect(at).toBeGreaterThanOrEqual(0);
        expect(duration).toBeGreaterThan(0);
        expect(Math.min(from, to)).toBeGreaterThanOrEqual(100);
        expect(Math.max(from, to)).toBeLessThanOrEqual(5000);
        expect(gain).toBeGreaterThan(0);
        expect(gain).toBeLessThanOrEqual(0.02);
      }
      if (shape.kind === 'caw') {
        expect(shape.rasp).toBeDefined();
        expect(shape.notes.every(([, , from, to]) => to < from)).toBe(true);
      }
      if (shape.kind === 'chirp') expect(shape.notes.every(([, , from, to]) => to > from)).toBe(true);
      if (shape.kind === 'trill') expect(shape.notes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('falls back to the fledgling call for an unknown leader', () => {
    expect(leaderCall('talon')).toBe(LEADER_CALLS.talon);
    expect(leaderCall('nobody')).toBe(LEADER_CALLS.fledgling);
  });
});

describe('cue budget for typed events', () => {
  it('lets counting ticks repeat quickly but still bounds the burst', () => {
    const budget = new AudioCueBudget();
    expect(budget.accepts('count.tick', 0)).toBe(true);
    expect(budget.accepts('count.tick', 20)).toBe(false);
    expect(budget.accepts('count.tick', 34)).toBe(true);
    expect(budget.accepts('count.tick', 68)).toBe(true);
    // Three supporting sounds in 100 ms is the ceiling.
    expect(budget.accepts('count.tick', 99)).toBe(false);
    expect(budget.accepts('count.tick', 102)).toBe(true);
  });

  it('coalesces repeated material and interface sounds', () => {
    const budget = new AudioCueBudget();
    expect(budget.accepts('ui.click', 0)).toBe(true);
    expect(budget.accepts('ui.click', 50)).toBe(false);
    expect(budget.accepts('ui.click', 81)).toBe(true);
    expect(budget.accepts('card.play', 82)).toBe(true);
    expect(budget.accepts('card.play', 100)).toBe(false);
    expect(budget.accepts('card.play', 170)).toBe(true);
  });

  it('lets a hit through at once and holds supporting sounds back behind it', () => {
    const budget = new AudioCueBudget();
    expect(budget.accepts('hit.impact', 0)).toBe(true);
    expect(budget.accepts('card.draw', 10)).toBe(false);
    expect(budget.accepts('material.tap', 20)).toBe(false);
    expect(budget.accepts('cover.break', 20)).toBe(true);
    expect(budget.accepts('stinger.play', 30)).toBe(true);
    // Confirm and cancel are answers to input: never held back.
    expect(budget.accepts('ui.confirm', 40)).toBe(true);
    expect(budget.accepts('ui.cancel', 40)).toBe(true);
    expect(budget.accepts('hit.impact', 45)).toBe(true);
    expect(budget.accepts('card.draw', 146)).toBe(true);
  });

  it('shares one budget between legacy cues and events on the same context', () => {
    const first = {};
    const second = {};
    expect(budgetFor(first)).toBe(budgetFor(first));
    expect(budgetFor(first)).not.toBe(budgetFor(second));
    expect(budgetFor(first).accepts('attack', 0)).toBe(true);
    expect(budgetFor(first).accepts('card.draw', 10)).toBe(false);
    expect(budgetFor(second).accepts('card.draw', 10)).toBe(true);
  });
});
