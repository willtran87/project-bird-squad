import { describe, expect, it } from 'vitest';
import content from '../../../data/game/barks.json';
import enemies from '../../../data/game/alpha-enemies.json';
import map2 from '../../../data/game/map02-content.json';
import map3 from '../../../data/game/map03-content.json';
import map4 from '../../../data/game/map04-content.json';
import { flockLeaders } from '../leaders';
import { BarkDeck, barkMoments, enemyFamily, placeTag, shuffled, type BarkContent, type CombatSnapshot } from './bark-rules';

const barks = content as unknown as BarkContent;
const TRIGGERS = ['start', 'bigHit', 'lowCohesion', 'defeated', 'phase'] as const;
const words = (line: string) => line.trim().split(/\s+/).length;
const MAGIC = /\b(magic|magical|spell|curse|enchant|wizard|witch|mana|sorcery|rune|arcane|potion)\w*\b/i;

describe('bark content', () => {
  it('gives every Leader and enemy family at least three lines per trigger, six words at most', () => {
    const speakers = [...flockLeaders.map(leader => ['leader', leader.id, barks.leaders[leader.id]] as const),
      ...[...barks.families.map(family => family.id), 'crew', 'boss'].map(id => ['enemy', id, barks.enemies[id]] as const)];
    for (const [kind, id, pools] of speakers) {
      expect(pools, `${kind} ${id}`).toBeDefined();
      for (const trigger of TRIGGERS) {
        const lines = pools![trigger] ?? [];
        expect(lines.length, `${kind} ${id} ${trigger}`).toBeGreaterThanOrEqual(3);
        expect(new Set(lines).size, `${kind} ${id} ${trigger} duplicates`).toBe(lines.length);
        for (const line of lines) {
          expect(words(line), line).toBeLessThanOrEqual(6);
          expect(line, line).not.toMatch(MAGIC);
        }
      }
    }
  });

  it('sorts every enemy in the game into a family, bosses as bosses', () => {
    const all = [...enemies.normalEncounters, ...enemies.rivalEncounters, ...enemies.bosses.map(b => ({ ...b, type: 'boss' })),
      ...map2.enemies, ...map3.enemies, ...map4.enemies] as Array<{ id: string; type?: string }>;
    const families = new Map<string, string>();
    for (const enemy of all) families.set(enemy.id, enemyFamily(barks, enemy.id, enemy.type));
    expect(families.get('tar_crowned_crow')).toBe('boss');
    expect(families.get('roof_rat')).toBe('vermin');
    expect(families.get('signal_gull')).toBe('gull');
    expect(families.get('wire_hawk')).toBe('raptor');
    expect(families.get('crow_saboteur')).toBe('corvid');
    expect(families.get('canal_dredge_eel')).toBe('canal');
    expect(families.get('moth_lantern_drifter')).toBe('night');
    // Most enemies have a family of their own; the generic crew is the exception.
    const generic = [...families.values()].filter(family => family === 'crew').length;
    expect(generic).toBeLessThan(all.length / 4);
  });
});

describe('bark decks', () => {
  it('shuffles deterministically by seed', () => {
    expect(shuffled(6, 'a')).toEqual(shuffled(6, 'a'));
    expect([...shuffled(6, 'a')].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(shuffled(8, 'a')).not.toEqual(shuffled(8, 'b'));
  });

  it('says every line once before repeating, and never twice in a row', () => {
    const deck = new BarkDeck(barks, 'seed-1');
    const pool = barks.leaders.talon.start!;
    const drawn = Array.from({ length: pool.length * 3 }, () => deck.line('leader', 'talon', 'start')!);
    expect(new Set(drawn.slice(0, pool.length)).size).toBe(pool.length);
    for (let index = 1; index < drawn.length; index += 1) expect(drawn[index]).not.toBe(drawn[index - 1]);
    const again = new BarkDeck(barks, 'seed-1');
    expect(again.line('leader', 'talon', 'start')).toBe(drawn[0]);
  });

  it('falls back to the Fledgling and the generic crew for unknown speakers', () => {
    const deck = new BarkDeck(barks, 's');
    expect(barks.leaders.fledgling.start).toContain(deck.line('leader', 'nobody', 'start'));
    expect(barks.enemies.crew.start).toContain(deck.line('enemy', 'nobody', 'start'));
  });
});

describe('bark moments', () => {
  const base = (patch: Partial<CombatSnapshot> = {}): CombatSnapshot => ({
    mode: 'battle', ready: true, flock: { hp: 40, maxHp: 40 },
    enemies: [{ id: 'e1', hp: 30, maxHp: 30, phase: 1 }, { id: 'boss', hp: 100, maxHp: 100, phase: 1, type: 'boss' }], ...patch,
  });
  it('opens a fight once the intro has cleared', () => {
    expect(barkMoments(undefined, base({ ready: false }), false)).toEqual([]);
    expect(barkMoments(base({ ready: false }), base(), false)).toEqual([{ trigger: 'start' }]);
    expect(barkMoments(base(), base(), true)).toEqual([]);
    // An animating frame later in the fight does not reopen it, and still sees hits.
    expect(barkMoments(base({ ready: false }), base(), true)).toEqual([]);
    expect(barkMoments(base(), base({ ready: false, flock: { hp: 30, maxHp: 40 } }), true)).toEqual([{ trigger: 'bigHit', target: 'flock' }]);
  });
  it('notices heavy hits on either side, low Cohesion, defeats and phase turns', () => {
    expect(barkMoments(base(), base({ flock: { hp: 31, maxHp: 40 } }), true)).toEqual([{ trigger: 'bigHit', target: 'flock' }]);
    expect(barkMoments(base(), base({ flock: { hp: 33, maxHp: 40 } }), true)).toEqual([]);
    expect(barkMoments(base({ flock: { hp: 14, maxHp: 40 } }), base({ flock: { hp: 11, maxHp: 40 } }), true)).toEqual([{ trigger: 'lowCohesion' }]);
    const after = base({ enemies: [{ id: 'e1', hp: 0, maxHp: 30, phase: 1 }, { id: 'boss', hp: 50, maxHp: 100, phase: 2, type: 'boss' }] });
    expect(barkMoments(base(), after, true)).toEqual([{ trigger: 'defeated', enemyId: 'e1' }, { trigger: 'phase', enemyId: 'boss' }]);
    const hurt = base({ enemies: [{ id: 'e1', hp: 20, maxHp: 30, phase: 1 }, { id: 'boss', hp: 100, maxHp: 100, phase: 1 }] });
    expect(barkMoments(base(), hurt, true)).toEqual([{ trigger: 'bigHit', target: 'enemy', enemyId: 'e1' }]);
  });
  it('stays silent outside battle', () => {
    expect(barkMoments(base(), base({ mode: 'cardReward' }), true)).toEqual([]);
  });
});

describe('tag placement', () => {
  const area = { x: 8, y: 8, width: 1264, height: 704 };
  it('sits above the speaker when that is clear', () => {
    expect(placeTag({ x: 600, y: 300, reach: 80 }, 160, 34, [], area)).toEqual({ x: 520, y: 186, width: 160, height: 34 });
  });
  it('moves aside to avoid a panel and is dropped when nothing is clear', () => {
    const panel = { x: 400, y: 120, width: 400, height: 140 };
    const rect = placeTag({ x: 600, y: 300, reach: 80 }, 160, 34, [panel], area)!;
    expect(rect).toBeDefined();
    const clear = rect.x + 160 + 6 <= panel.x || rect.x - 6 >= panel.x + panel.width || rect.y + 34 + 6 <= panel.y || rect.y - 6 >= panel.y + panel.height;
    expect(clear).toBe(true);
    expect(placeTag({ x: 600, y: 300, reach: 80 }, 160, 34, [{ x: 0, y: 0, width: 1280, height: 720 }], area)).toBeUndefined();
  });
  it('never leaves the screen', () => {
    const rect = placeTag({ x: 20, y: 40, reach: 60 }, 200, 34, [], area);
    if (rect) {
      expect(rect.x).toBeGreaterThanOrEqual(8);
      expect(rect.y).toBeGreaterThanOrEqual(8);
    }
  });
});
