// Migrated from tools/tests/flyway-rules.test.mjs (node:test + transpile-to-data: URL).
import { describe, expect, it } from 'vitest';
import alphaCards from '../../data/game/alpha-cards.json';
import alphaEnemies from '../../data/game/alpha-enemies.json';
import * as rules from './flyway-rules';
import type { CardSuit, RuntimeCard, RuntimeEnemy } from './types';

const cards = alphaCards.cards as unknown as RuntimeCard[];
const byId = (id: string) => {
  const card = cards.find((entry) => entry.id === id);
  if (!card) throw new Error(`missing card ${id}`);
  return card;
};
const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('flyway rules: saves', () => {
  it('High Roost claimed favors normalize without duplicates or invented IDs', () => {
    expect(rules.normalizeFlyway({ cityAid: ['sella', 'sella', 'ivo'] }).cityAid).toEqual(['sella', 'ivo']);
    expect(rules.normalizeFlyway({ cityAid: ['prototype', 99, 'oren'] }).cityAid).toEqual(['oren']);
    expect(rules.normalizeFlyway({ cityAid: 'ivo' }).cityAid).toBeUndefined();
  });

  it('Ivo relay progress rejects forged delivery flags and counts only unique Spires settlements', () => {
    const s = rules.normalizeFlyway({ spireRelay: { pledge: 'wires', startedAt: 1, delivered: true }, settledNodes: ['1:a', '2:a', '2:a'] });
    expect(s.spireRelay?.delivered).toBeUndefined();
    expect(rules.spireRelayProgress(s).ready).toBe(false);
    s.settledNodes.push('2:b');
    expect(rules.spireRelayProgress(s).ready).toBe(false);
    s.settledNodes.push('2:c');
    expect(rules.spireRelayProgress(s).ready).toBe(true);
    for (const pledge of ['wires', 'lenses'] as const) {
      const saved = rules.normalizeFlyway({ spireRelay: { pledge, startedAt: -4, rewarded: true, delivered: true } });
      expect(saved.spireRelay).toEqual({ pledge, startedAt: 0, rewarded: true, delivered: true });
      expect(rules.normalizeFlyway(roundTrip(saved))).toEqual(saved);
    }
    expect(rules.normalizeFlyway({ spireRelay: { pledge: '__proto__' } }).spireRelay).toBeUndefined();
    const defeated = rules.normalizeFlyway({ spireRelay: { pledge: 'lenses', startedAt: 5 }, restored: [2] });
    expect(rules.spireRelayProgress(defeated).ready).toBe(true);
  });

  it('Rooftops strategies survive saves, reject malformed plans and classify actual active rules', () => {
    for (const plan of ['shelter', 'tempo', 'molt'] as const) {
      const state = rules.normalizeFlyway({ rooftopPlan: plan, coachingOff: true });
      expect(rules.normalizeFlyway(roundTrip(state)).rooftopPlan).toBe(plan);
      expect(state.coachingOff).toBe(true);
    }
    expect(rules.normalizeFlyway({ rooftopPlan: '__proto__', coachingOff: 'true' }).rooftopPlan).toBeUndefined();
    expect(rules.normalizeFlyway({ coachingOff: 'true' }).coachingOff).toBeUndefined();
    expect(rules.rooftopPlanMatch('shelter', byId('pentacles_04'))).toBe(true);
    expect(rules.rooftopPlanMatch('tempo', byId('wands_ace'))).toBe(true);
    expect(rules.rooftopPlanMatch('molt', byId('aviary_25'))).toBe(true);
    expect(rules.rooftopPlanMatch('molt', byId('pentacles_04'))).toBe(false);
    expect(rules.rooftopPlanMatch(undefined, byId('wands_ace'))).toBe(false);
    expect(rules.rooftopPlanMatch(undefined, {} as RuntimeCard)).toBe(false);
    expect(rules.rooftopPlanMatch('shelter', {} as RuntimeCard)).toBe(false);
  });

  it('legacy and malformed expansion saves normalize without shared references', () => {
    const a = rules.normalizeFlyway({ restored: [0, 0, -1, 4, '2'], residents: { sella: Infinity, ivo: 3 }, rivalWins: -4, condition: 'prototype', journal: ['safe', 99], medals: ['forged', 'open-sky'] });
    expect(a.restored).toEqual([0]);
    expect(a.residents.sella).toBe(0);
    expect(a.residents.ivo).toBe(3);
    expect(a.condition).toBe('clear');
    expect(a.medals).toEqual(['open-sky']);
    expect(a.journal).toEqual(['safe']);
    const b = rules.normalizeFlyway(a);
    b.journal.push('later');
    expect(a.journal).toHaveLength(1);
    expect(rules.normalizeFlyway(undefined).version).toBe(1);
  });

  it('fresh and story saves retain their exact serialized state after checkpoint normalization', () => {
    for (const story of [undefined, ...rules.flightStories.map((entry) => entry.id)]) {
      const original = JSON.stringify(rules.newFlywayState(story));
      expect(JSON.stringify(rules.normalizeFlyway(JSON.parse(original)))).toBe(original);
    }
  });

  it('ferry progress counts unique Canal settlements after the pledge and survives normalization', () => {
    const s = rules.normalizeFlyway({ canalFerry: { pledge: 'lamps', startedAt: 1, rewarded: 'true' }, settledNodes: ['0:a', '1:a', '1:a', '2:b'] });
    expect(s.canalFerry?.rewarded).toBeUndefined();
    expect(rules.canalFerryProgress(s)).toEqual({ clears: 1, ready: false });
    s.settledNodes.push('1:b');
    expect(rules.canalFerryProgress(s).ready).toBe(false);
    s.settledNodes.push('1:c');
    expect(rules.canalFerryProgress(s).ready).toBe(true);
    s.canalFerry!.rewarded = true;
    expect(rules.normalizeFlyway(roundTrip(s)).canalFerry).toEqual(s.canalFerry);
    expect(rules.normalizeFlyway({ canalFerry: { pledge: 'forged' } }).canalFerry).toBeUndefined();
    expect(rules.normalizeFlyway({ canalFerry: { pledge: 'timber', startedAt: Infinity } }).canalFerry?.startedAt).toBe(0);
  });
});

describe('flyway rules: Preen branches', () => {
  it('Spires signatures reconstruct exact costs and active rules without mutating canonical cards', () => {
    for (const branch of rules.spirePreens) {
      const card = byId(branch.card);
      const before = JSON.stringify(card);
      expect(rules.validBranch(card.id, branch.id)).toBe(branch.id);
      expect(rules.validBranch('major_00', branch.id)).toBeUndefined();
      const upgrade = rules.branchUpgrade(card, branch.id);
      expect(upgrade.effects).toEqual(branch.effects);
      expect(upgrade.moltEffects).toEqual(branch.moltEffects);
      expect(upgrade.cost).toBe(branch.cost ?? card.upgrade.cost);
      upgrade.effects.push('draw(99)');
      expect(JSON.stringify(card)).toBe(before);
      expect(branch.effects).not.toContain('draw(99)');
      for (const [key, value] of Object.entries(card.upgrade)) {
        if (!['cost', 'effects', 'moltEffects'].includes(key)) expect((upgrade as unknown as Record<string, unknown>)[key]).toEqual(value);
      }
    }
  });

  it('six Preen branches preserve canonical card data and both Molt variants', () => {
    for (const id of rules.branchCards) {
      const card = byId(id);
      const before = JSON.stringify(card);
      const a = rules.branchUpgrade(card, 'shelter');
      const b = rules.branchUpgrade(card, 'flight');
      expect(a.effects.at(-1)).toBe('gainCover(2)');
      expect(b.effects.at(-1)).toBe('draw(1)');
      expect(a.moltEffects?.at(-1)).toBe('gainCover(2)');
      expect(b.moltEffects?.at(-1)).toBe('draw(1)');
      expect(JSON.stringify(card)).toBe(before);
    }
    expect(rules.validBranch('not-a-card', 'flight')).toBeUndefined();
  });

  it('Canal alternatives keep exclusive card identity, canonical stats and exact active rules', () => {
    expect(rules.canalPreens).toHaveLength(6);
    for (const choice of rules.canalPreens) {
      const card = byId(choice.card);
      const original = JSON.stringify(card);
      expect(rules.validBranch(card.id, choice.id)).toBe(choice.id);
      expect(rules.validBranch('major_00', choice.id)).toBeUndefined();
      const upgraded = rules.branchUpgrade(card, choice.id);
      expect(upgraded.effects).toEqual(choice.effects);
      expect(upgraded.moltEffects).toEqual(choice.moltEffects);
      expect(upgraded.flockStats).toEqual(card.upgrade.flockStats);
      expect(upgraded.effects).not.toEqual(card.upgrade.effects);
      upgraded.effects.push('tampered');
      expect(rules.branchUpgrade(card, choice.id).effects).not.toContain('tampered');
      expect(JSON.stringify(card)).toBe(original);
    }
    expect(rules.branchUpgrade(byId('aviary_25'), 'canal-harbor').cost).toBe(1);
  });
});

describe('flyway rules: combat', () => {
  it('each Leader earns only its own call and can spend it once', () => {
    const cases = [['spark_caller', 'spend', 3], ['talon', 'winded', 3], ['tidewarden', 'heal', 6], ['roostkeeper', 'block', 2]] as const;
    for (const [leader, kind, amount] of cases) {
      const c = rules.newFlightCombat();
      rules.chargeCall(c, leader, 'suit', 99, 'plumes');
      expect(c.charge).toBe(0);
      expect(rules.takeCall(c, leader)).toBe(false);
      rules.chargeCall(c, leader, kind, amount);
      expect(rules.takeCall(c, leader)).toBe(true);
      expect(rules.takeCall(c, leader)).toBe(false);
    }
    const c = rules.newFlightCombat();
    for (const suit of ['nests', 'nests', 'quills', 'basins'] as CardSuit[]) rules.chargeCall(c, 'fledgling', 'suit', 1, suit);
    expect(c.charge).toBe(3);
    expect(rules.takeCall(c, 'fledgling')).toBe(true);
  });

  it('combinations require consecutive suits and cannot repeat in a turn', () => {
    const c = rules.newFlightCombat();
    expect(rules.playCombination(c, 'nests')).toBeUndefined();
    expect(rules.playCombination(c, 'quills')?.id).toBe('brace-cut');
    rules.playCombination(c, 'nests');
    expect(rules.playCombination(c, 'quills')).toBeUndefined();
    rules.playCombination(c, 'basins');
    rules.playCombination(c, null);
    expect(rules.playCombination(c, 'plumes')).toBeUndefined();
    c.combos = [];
    rules.playCombination(c, 'nests');
    expect(rules.playCombination(c, 'quills')?.effect).toBe('damage');
  });

  it('boss disruption requirements differ across districts and exclude normal enemies', () => {
    const boss = { runtime: { type: 'boss' }, weak: 1, hitThisTurn: false, block: 4 };
    expect(rules.bossDisruption(boss, 0)?.met).toBe(true);
    expect(rules.bossDisruption(boss, 1)?.met).toBe(false);
    expect(rules.bossDisruption(boss, 2)?.met).toBe(false);
    expect(rules.bossDisruption(boss, 3)?.met).toBe(false);
    boss.weak = 2;
    boss.hitThisTurn = true;
    boss.block = 0;
    for (let i = 0; i < 4; i++) expect(rules.bossDisruption(boss, i)?.met).toBe(true);
    expect(rules.bossDisruption({ ...boss, runtime: { type: 'normal' } }, 0)).toBeUndefined();
  });

  it('restoration is idempotent and records the actual district', () => {
    const s = rules.newFlywayState();
    expect(rules.restoreDistrict(s, 2)).toBe(true);
    expect(rules.restoreDistrict(s, 2)).toBe(false);
    expect(rules.restoreDistrict(s, 9)).toBe(false);
    expect(s.restored).toEqual([2]);
    expect(s.journal).toHaveLength(1);
  });

  it('rival chapters clone canonical birds and share finite readable support/recovery loops', () => {
    const enemies = [...alphaEnemies.normalEncounters, ...alphaEnemies.rivalEncounters] as unknown as RuntimeEnemy[];
    const before = JSON.stringify(enemies);
    for (const wins of [0, 1, 2, 20]) {
      const formation = rules.rivalFormation(wins, (id) => enemies.find((enemy) => enemy.id === id)!);
      expect(formation).toHaveLength(wins < 2 ? 2 : 3);
      expect(rules.rivalChapter(wins).weakness.length).toBeGreaterThan(30);
      for (const enemy of formation) {
        expect(enemy.attackPattern.type).toBe('cycle');
        expect(enemy.moves[2].effects).toHaveLength(0);
        expect(enemy.moves).toHaveLength(3);
      }
      formation[0].health = 999;
    }
    expect(JSON.stringify(enemies)).toBe(before);
  });
});

describe('flyway rules: stories and Leader calls', () => {
  it('Flight Stories require a victory and their own objective', () => {
    for (const story of rules.flightStories) {
      const s = rules.newFlywayState(story.id);
      expect(s.relic).toBe(story.relic);
      expect(rules.finishStory(s, false, 10)).toBe(false);
      if (story.id !== 'small-flock') expect(rules.finishStory(s, true, 10)).toBe(false);
      s.survivedMolt = 3;
      s.cleanFights = 3;
      s.resonanceSpent = 12;
      s.windedHits = 12;
      s.leaderCalls = 3;
      expect(rules.finishStory(s, true, 10)).toBe(true);
      rules.finishStory(s, true, 10);
      expect(s.medals).toEqual([story.id]);
    }
    const s = rules.newFlywayState('small-flock');
    expect(rules.finishStory(s, true, 11)).toBe(false);
  });

  it('identity branches normalize safely, preserve base Calls and keep ten distinct tradeoffs', () => {
    for (const [leader, variants] of Object.entries(rules.callSpecializations)) {
      expect(variants).toHaveLength(2);
      expect(rules.resolvedLeaderCall(leader).name).toBe(rules.leaderCalls[leader].name);
      for (const choice of variants) {
        const saved = rules.normalizeFlyway({ callStyle: choice.style });
        expect(rules.normalizeFlyway(roundTrip(saved)).callStyle).toBe(choice.style);
        expect(rules.resolvedLeaderCall(leader, saved).name).toBe(choice.name);
        expect(choice.tradeoff.length).toBeGreaterThan(20);
      }
      expect(variants[0].rules).not.toEqual(variants[1].rules);
    }
    expect(rules.normalizeFlyway({ callStyle: '__proto__' }).callStyle).toBeUndefined();
    expect(rules.normalizeFlyway({ resonanceSpent: Infinity, windedHits: -2 }).resonanceSpent).toBe(0);
    expect(rules.normalizeFlyway({ windedHits: -2 }).windedHits).toBe(0);
  });

  it('new stories require both their own action and Calls, award once, and never award a defeat', () => {
    for (const [id, counter] of [['chorus-line', 'resonanceSpent'], ['clean-cut', 'windedHits']] as const) {
      const s = rules.newFlywayState(id);
      s[counter] = 11;
      s.leaderCalls = 3;
      expect(rules.finishStory(s, true, 10)).toBe(false);
      s[counter] = 12;
      s.leaderCalls = 2;
      expect(rules.finishStory(s, true, 10)).toBe(false);
      s.leaderCalls = 3;
      expect(rules.finishStory(s, false, 10)).toBe(false);
      expect(rules.finishStory(s, true, 10)).toBe(true);
      rules.finishStory(s, true, 10);
      expect(s.medals).toEqual([id]);
      expect(rules.normalizeFlyway(s).storyComplete).toBe(true);
    }
  });
});

describe('flyway rules: added coverage', () => {
  it('flywayCoverGain stacks the Woven Roost and rain costs and never goes negative', () => {
    expect(rules.flywayCoverGain({ condition: 'clear' }, 5)).toBe(5);
    const roost = rules.flywayCoverGain({ condition: 'clear', relic: 'woven-roost' }, 5);
    const rain = rules.flywayCoverGain({ condition: 'rain' }, 5);
    const both = rules.flywayCoverGain({ condition: 'rain', relic: 'woven-roost' }, 5);
    expect(roost).toBeLessThan(5);
    expect(rain).toBeLessThan(5);
    expect(both).toBe(5 - (5 - roost) - (5 - rain));
    expect(rules.flywayCoverGain({ condition: 'rain', relic: 'woven-roost' }, 1)).toBe(0);
  });

  it('resolvedLeaderCall falls back to the Fledgling for unknown leaders', () => {
    expect(rules.resolvedLeaderCall('nobody').name).toBe(rules.leaderCalls.fledgling.name);
  });

  it('call charge is capped at the Leader goal and ignored once called', () => {
    const c = rules.newFlightCombat();
    rules.chargeCall(c, 'tidewarden', 'heal', 999);
    expect(c.charge).toBe(rules.leaderCalls.tidewarden.goal);
    rules.takeCall(c, 'tidewarden');
    rules.chargeCall(c, 'tidewarden', 'heal', 1);
    expect(c.charge).toBe(rules.leaderCalls.tidewarden.goal);
  });

  it('journal keeps only the newest 48 entries', () => {
    const s = rules.newFlywayState();
    for (let i = 0; i < 60; i += 1) rules.journal(s, `entry ${i}`);
    expect(s.journal).toHaveLength(48);
    expect(s.journal[0]).toBe('entry 12');
  });

  it('restoring the Canal district queues the Canal gift unless a capstone was already chosen', () => {
    const s = rules.newFlywayState();
    rules.restoreDistrict(s, 1);
    expect(s.canalGiftPending).toBe(true);
    const chosen = rules.newFlywayState();
    chosen.capstone = rules.normalizeFlyway({ capstone: 'tempo' }).capstone;
    rules.restoreDistrict(chosen, 1);
    expect(chosen.canalGiftPending).toBeUndefined();
  });

  it('bossDisruption wraps negative and large district indices', () => {
    const boss = { runtime: { type: 'boss' }, weak: 0, hitThisTurn: false, block: 0 };
    expect(rules.bossDisruption(boss, -1)).toEqual(rules.bossDisruption(boss, 3));
    expect(rules.bossDisruption(boss, 5)).toEqual(rules.bossDisruption(boss, 1));
  });
});
