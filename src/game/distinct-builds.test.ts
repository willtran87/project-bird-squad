// Migrated from tools/tests/distinct-builds.test.mjs (node:test + transpile-to-data: URL).
import { describe, expect, it } from 'vitest';
import alphaCards from '../../data/game/alpha-cards.json';
import { candidateBuildReading } from './build-guidance';
import { flightHighlights } from './flight-highlights';
import * as rules from './flyway-rules';
import { tacticalFormation } from './tactical-formations';
import type { RuntimeCard, RuntimeEnemy } from './types';

const cards = alphaCards.cards as unknown as RuntimeCard[];
const card = (id: string) => {
  const runtime = cards.find((entry) => entry.id === id);
  if (!runtime) throw new Error(`missing card ${id}`);
  return runtime;
};
const bird = (id: string): { id: string; name: string; upgraded?: boolean; runtime: RuntimeCard } => {
  const runtime = card(id);
  return { id, name: runtime.displayName, runtime };
};

describe('distinct builds', () => {
  it('six complementary alternatives are legal, exclusive, immutable and round-trip on their own birds', () => {
    expect(rules.buildPreens).toHaveLength(6);
    for (const branch of rules.buildPreens) {
      const runtime = card(branch.card);
      const before = JSON.stringify(runtime);
      const upgrade = rules.branchUpgrade(runtime, branch.id);
      expect(upgrade.effects).toEqual(branch.effects);
      expect(upgrade.moltEffects).toEqual(branch.moltEffects);
      expect(rules.validBranch(runtime.id, branch.id)).toBe(branch.id);
      expect(rules.validBranch('aviary_25', branch.id)).toBeUndefined();
      upgrade.effects.push('fixture');
      expect(JSON.stringify(runtime)).toBe(before);
      expect(branch.effects).not.toContain('fixture');
      expect(branch.tradeoff).toMatch(/Trade|Give up|Deal/);
    }
  });

  it('reward reading uses the owned branch and distinguishes potential from observed results', () => {
    const chorus = bird('cups_ace');
    chorus.upgraded = true;
    chorus.runtime = { ...chorus.runtime, upgrade: rules.branchUpgrade(chorus.runtime, 'build-chorus') };
    const flash = bird('wands_ace');
    flash.upgraded = true;
    const read = candidateBuildReading(flash, [chorus, flash], []);
    expect(read.potential).toMatch(/Resonance setup/);
    expect(read.potential).toMatch(/Potential only/);
    expect(read.observed).toMatch(/no recorded plays/);
    const none = candidateBuildReading(flash, [bird('cups_ace'), flash], []);
    expect(none.potential).toMatch(/No other owned card generates/);
  });

  it('legacy and malformed highlight saves do not invent moments or rewards', () => {
    const s = rules.normalizeFlyway({ comboMoment: { id: 'invented' }, cardMoment: { cardId: 'x', plays: Infinity } });
    expect(s.comboMoment).toBeUndefined();
    expect(s.cardMoment).toBeUndefined();
    const text = flightHighlights(s, (id) => id).join('\n');
    expect(text).toMatch(/No card contribution/);
    expect(text).toMatch(/No resident visits/);
    const valid = rules.normalizeFlyway({
      comboMoment: { id: 'brace-cut', turn: 2, damage: 1, cover: 0, resonance: 0, defeated: true },
      cardMoment: { cardId: 'major_00', plays: 3, damage: 9, cover: 4 },
      cityAid: ['oren'],
    });
    expect(rules.normalizeFlyway(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
    expect(flightHighlights(valid, () => 'First Flight').join('\n')).toMatch(/combination defeated its target/);
  });

  it('formation overrides clone canonical birds and share disclosed three-beat cycles', () => {
    const canonical = [
      { id: 'bird', health: 99, moves: [{ id: 'original', effects: [] }] },
      { id: 'support', health: 99, moves: [] },
    ] as unknown as RuntimeEnemy[];
    for (const id of ['enc_canal_open_perch', 'enc_canal_alternating_watch', 'enc_spire_quiet_beat']) {
      const out = tacticalFormation(id, id.includes('spire') ? canonical.slice(0, 1) : canonical);
      expect(out[0].moves).toHaveLength(3);
      expect(out[0].moves[2].effects).toEqual([]);
      expect(canonical[0].health).toBe(99);
      const pattern = out[0].attackPattern;
      expect(pattern.type === 'cycle' ? pattern.moveIds : []).toHaveLength(3);
    }
    expect(tacticalFormation('original', canonical)).toBe(canonical);
  });
});
