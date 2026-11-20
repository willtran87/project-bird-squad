import { describe, expect, it } from 'vitest';
import { SCORE_RULES, flightScore, formatDuration, runFacts, type RunFactsSource } from './run-facts';

const districts = ['roofs', 'canals', 'spires', 'roost'];
const starters = ['a', 'b', 'c'];

function summary(over: Partial<RunFactsSource> = {}): RunFactsSource {
  return {
    id: 'run-1-flight-seed', seed: 'seed', result: 'win', leaderId: 'talon', runMode: 'full', mapId: 'roost',
    turnsTaken: 50, durationMs: 600_000, currentCohesion: 30, maxCohesion: 50,
    deck: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }, { id: 'snag' }],
    routeMarks: ['m1', 'm2'],
    cardRewards: [{ picked: 'd' }, { picked: undefined }, { picked: 'e' }],
    combatResults: [
      { damageDealt: 40, cohesionLost: 3, cardContributions: [{ cardId: 'a', damage: 30, plays: 4 }, { cardId: 'd', damage: 10, plays: 1 }] },
      { damageDealt: 90, cohesionLost: 0, cardContributions: [{ cardId: 'd', damage: 70, plays: 3 }] },
      { damageDealt: 55, cohesionLost: 8 },
    ],
    ...over,
  };
}
const context = { districtIds: districts, starterIds: starters, isSnag: (id: string) => id === 'snag' };

describe('runFacts', () => {
  it('reads a completed flight', () => {
    expect(runFacts(summary(), context)).toMatchObject({
      result: 'win', districtsCleared: 4, districtTotal: 4, lastDistrict: 3, fightsWon: 3,
      damageDealt: 185, damageTaken: 11, bestFightDamage: 90, deckSize: 5, waymarks: 2, cardsAdded: 2,
      cohesion: 30, maxCohesion: 50, turns: 50, durationMs: 600_000,
      topCard: { cardId: 'd', damage: 80, plays: 4 },
    });
  });

  it('counts only the districts and fights a lost flight finished', () => {
    const facts = runFacts(summary({ result: 'loss', mapId: 'spires', currentCohesion: 0 }), context);
    // Scattered in the third district: two cleared, and the last fight was lost.
    expect(facts).toMatchObject({ districtsCleared: 2, lastDistrict: 2, fightsWon: 2, cohesion: 0 });
    expect(runFacts(summary({ result: 'loss', mapId: 'roofs', combatResults: [] }), context))
      .toMatchObject({ districtsCleared: 0, fightsWon: 0, damageDealt: 0, bestFightDamage: 0, topCard: undefined });
  });

  it('never credits the final district on a loss, and survives unknown or damaged data', () => {
    expect(runFacts(summary({ result: 'loss', mapId: 'roost' }), context).districtsCleared).toBe(3);
    const facts = runFacts(summary({ result: 'loss', mapId: 'nowhere', turnsTaken: Number.NaN, durationMs: -5,
      combatResults: [{ damageDealt: Number.NaN, cohesionLost: -2 }] }), context);
    expect(facts).toMatchObject({ districtsCleared: 0, turns: 0, durationMs: 0, damageDealt: 0, damageTaken: 0 });
  });

  it('follows the flight length it is given', () => {
    const quick = { ...context, districtIds: ['roofs', 'spires', 'roost'] };
    expect(runFacts(summary({ runMode: 'quick' }), quick)).toMatchObject({ districtsCleared: 3, districtTotal: 3 });
    expect(runFacts(summary({ runMode: 'quick', result: 'loss', mapId: 'spires' }), quick).districtsCleared).toBe(1);
  });

  it('counts cards added from the final deck when the reward log is short', () => {
    expect(runFacts(summary({ cardRewards: [] }), context).cardsAdded).toBe(2);
    expect(runFacts(summary({ deck: [{ id: 'a' }], cardRewards: [{ picked: 'd' }, { picked: 'e' }, { picked: 'f' }] }), context).cardsAdded).toBe(3);
  });
});

describe('flightScore', () => {
  it('adds up exactly as the rule says for a completed flight', () => {
    const score = flightScore({ result: 'win', districtsCleared: 4, fightsWon: 11, cohesion: 31, turns: 62 });
    expect(score.lines.map((line) => line.points)).toEqual([4000, 1650, 2000, 620, 528]);
    expect(score.total).toBe(8798);
    expect(score.total).toBe(score.lines.reduce((sum, line) => sum + line.points, 0));
  });

  it('gives a lost flight only its districts and fights', () => {
    const score = flightScore({ result: 'loss', districtsCleared: 2, fightsWon: 10, cohesion: 25, turns: 40 });
    expect(score.lines.map((line) => line.label)).toEqual(['Districts cleared', 'Fights won']);
    expect(score.total).toBe(2 * SCORE_RULES.district + 10 * SCORE_RULES.fight);
  });

  it('never goes negative on a slow flight and always ranks a win above the same flight lost', () => {
    const slow = flightScore({ result: 'win', districtsCleared: 4, fightsWon: 12, cohesion: 0, turns: 5000 });
    expect(slow.lines.at(-1)).toMatchObject({ label: 'Pace', points: 0 });
    expect(slow.total).toBeGreaterThan(flightScore({ result: 'loss', districtsCleared: 3, fightsWon: 12, cohesion: 0, turns: 10 }).total);
    expect(flightScore({ result: 'loss', districtsCleared: -3, fightsWon: Number.NaN, cohesion: 0, turns: 0 }).total).toBe(0);
  });

  it('rewards keeping Cohesion and flying fewer beats', () => {
    const base = { result: 'win' as const, districtsCleared: 4, fightsWon: 10 };
    expect(flightScore({ ...base, cohesion: 40, turns: 60 }).total).toBeGreaterThan(flightScore({ ...base, cohesion: 20, turns: 60 }).total);
    expect(flightScore({ ...base, cohesion: 40, turns: 50 }).total).toBeGreaterThan(flightScore({ ...base, cohesion: 40, turns: 60 }).total);
  });
});

describe('formatDuration', () => {
  it('reads as hours, minutes or seconds', () => {
    expect(formatDuration(48_000)).toBe('48s');
    expect(formatDuration(725_000)).toBe('12m 05s');
    expect(formatDuration(3_840_000)).toBe('1h 04m');
    expect(formatDuration(-1)).toBe('0s');
  });
});
