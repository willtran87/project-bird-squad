import { describe, expect, it } from 'vitest';
import { alphaCacheSet } from '../runtime-data';
import type { RouteNode } from '../types';
import {
  checkRouteCondition,
  resolveRouteEffect,
  type RouteEffectContext,
  type RouteEffectRunState,
} from './route-effect-runner';

function node(id: string, type: RouteNode['type']): RouteNode {
  return { id, column: 0, lane: 0, type, label: id, payloadId: id, risk: 'low', revealed: true, completed: false };
}

function harness(patch: Partial<RouteEffectRunState> = {}, options: { maxHp?: number; nodes?: RouteNode[]; random?: () => number } = {}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const runState: RouteEffectRunState = {
    deck: [{ id: 'major_00' }],
    currentHp: 20,
    scrap: 50,
    routeMarks: [],
    supplies: [],
    completedRouteNodeIds: [],
    routeLog: [],
    ...patch,
  };
  const context: RouteEffectContext = {
    runState,
    currentMapNodes: () => options.nodes ?? [],
    runMaxHp: () => options.maxHp ?? 30,
    runSupplyCapacity: (state) => state.supplySlots ?? 3,
    grantRouteMark: (selector) => { calls.push(['grantRouteMark', selector]); },
    grantSupply: (selector) => { calls.push(['grantSupply', selector]); },
    grantCard: (selector) => { calls.push(['grantCard', selector]); },
    preenFirstAvailableCard: () => { calls.push(['preen']); },
    releaseFirstReleasable: (count) => { calls.push(['release', count]); },
    random: options.random,
  };
  return { runState, context, calls, run: (effect: string) => resolveRouteEffect(effect, context) };
}

describe('resolveRouteEffect: scrap', () => {
  it('gainScrap adds scrap and tracks lifetime earnings, ignoring negatives', () => {
    const h = harness({ scrap: 10 });
    h.run('gainScrap(15)');
    h.run('gainScrap(-5)');
    expect(h.runState.scrap).toBe(25);
    expect(h.runState.scrapEarned).toBe(15);
  });

  it('payScrap never takes more than the flock holds', () => {
    const h = harness({ scrap: 10, scrapSpent: 4 });
    h.run('payScrap(6)');
    h.run('payScrap(30)');
    h.run('payScrap(-3)');
    expect(h.runState.scrap).toBe(0);
    expect(h.runState.scrapSpent).toBe(14);
  });
});

describe('resolveRouteEffect: Cohesion', () => {
  it('loseCohesion floors at 0; heal/healCohesion cap at max', () => {
    const h = harness({ currentHp: 5 }, { maxHp: 12 });
    h.run('loseCohesion(9)');
    expect(h.runState.currentHp).toBe(0);
    h.run('heal(7)');
    expect(h.runState.currentHp).toBe(7);
    h.run('healCohesion(100)');
    expect(h.runState.currentHp).toBe(12);
  });

  it('healMissingPct heals a percentage of missing Cohesion with a flat minimum', () => {
    const h = harness({ currentHp: 10 }, { maxHp: 30 });
    h.run('healMissingPct(50)');
    expect(h.runState.currentHp).toBe(20);
    const floor = harness({ currentHp: 28 }, { maxHp: 30 });
    floor.run('healMissingPct(50, 10)');
    expect(floor.runState.currentHp).toBe(30);
  });

  it('cleanseFlock heals 2 per point when wounded, otherwise banks Open Sky Guard', () => {
    const wounded = harness({ currentHp: 25 }, { maxHp: 30 });
    wounded.run('cleanseFlock(2)');
    expect(wounded.runState.currentHp).toBe(29);
    expect(wounded.runState.nextCombat).toBeUndefined();
    const nearlyFull = harness({ currentHp: 29 }, { maxHp: 30 });
    nearlyFull.run('cleanseFlock(3)');
    expect(nearlyFull.runState.currentHp).toBe(30);
    const full = harness({ currentHp: 30, nextCombat: { openSkyGuard: 1 } }, { maxHp: 30 });
    full.run('cleanseFlock()');
    expect(full.runState.nextCombat).toEqual({ openSkyGuard: 2 });
    expect(full.runState.routeLog.at(-1)).toMatch(/1 Open Sky Guard/);
  });
});

describe('resolveRouteEffect: grants', () => {
  it('delegates marks, supplies, cards, Preens and releases', () => {
    const h = harness();
    h.run('gainRouteMark(randomRare)');
    h.run('gainSupply(tin)');
    h.run('gainSupplyChoice(1)');
    h.run('addCard(chooseOneOfTwoRare)');
    h.run('preenCard(2)');
    h.run('preenCard()');
    h.run('releaseCard()');
    h.run('releaseCard(2)');
    expect(h.calls).toEqual([
      ['grantRouteMark', 'randomRare'], ['grantSupply', 'tin'], ['grantSupply', 'random'], ['grantCard', 'chooseOneOfTwoRare'],
      ['preen'], ['preen'], ['preen'], ['release', 1], ['release', 2],
    ]);
  });

  it('adds a Snag once and refuses a second copy', () => {
    const h = harness();
    h.run('addSnagToDiscard(bad_directions)');
    h.run('addSnagToDraw(bad_directions)');
    expect(h.runState.deck.filter((card) => card.id === 'bad_directions')).toHaveLength(1);
    expect(h.runState.routeLog).toHaveLength(1);
    h.run('addSnagToDraw()');
    expect(h.runState.deck).toHaveLength(2);
  });

  it('increaseSupplySlots builds on the current capacity', () => {
    const h = harness({ supplySlots: 4 });
    h.run('increaseSupplySlots()');
    expect(h.runState.supplySlots).toBe(5);
    h.run('increaseSupplySlots(2)');
    expect(h.runState.supplySlots).toBe(7);
  });

  it('freePreenNextDistrict accumulates, defaulting to 1', () => {
    const h = harness();
    h.run('freePreenNextDistrict()');
    h.run('freePreenNextDistrict(2)');
    expect(h.runState.freePreenNextDistrict).toBe(3);
  });
});

describe('resolveRouteEffect: next-combat modifiers', () => {
  it('stacks each modifier without clobbering the others', () => {
    const h = harness();
    h.run('gainOpenSkyGuard(1)');
    h.run('gainOpenSkyGuard(2)');
    h.run('reduceNextOpenSky(1)');
    h.run('enemyCoverNextCombat(4)');
    h.run('bossDamageShield(5)');
    h.run('startNextCombatOpenSky()');
    expect(h.runState.nextCombat).toEqual({
      openSkyGuard: 3, reduceNextOpenSky: 1, enemyCover: 4, bossDamageShield: 5, startOpenSky: true,
    });
  });

  it('peekNextNodes adds one Guard and a plan-sized Open Sky reduction', () => {
    const h = harness();
    h.run('peekNextNodes(2)');
    h.run('peekNextNodes()');
    expect(h.runState.nextCombat).toEqual({ openSkyGuard: 2, reduceNextOpenSky: 3 });
    expect(h.runState.routeLog).toHaveLength(2);
  });
});

describe('resolveRouteEffect: conditions and unknown verbs', () => {
  const nodes = [node('n1', 'basin'), node('n2', 'market')];

  it('visitedNodeType checks completed nodes of that type on the current map', () => {
    const h = harness({ completedRouteNodeIds: ['n2'] }, { nodes });
    expect(checkRouteCondition('visitedNodeType(market)', h.context)).toBe(true);
    expect(checkRouteCondition('visitedNodeType(basin)', h.context)).toBe(false);
    expect(checkRouteCondition('somethingElse', h.context)).toBe(false);
    h.run('if visitedNodeType(market) then gainScrap(5)');
    h.run('if visitedNodeType(basin) then gainScrap(100)');
    expect(h.runState.scrap).toBe(55);
  });

  it('ignores route-graph hints, unknown verbs and unparseable text', () => {
    const h = harness();
    const before = JSON.stringify(h.runState);
    for (const effect of ['revealNodes(2)', 'skipNextStreet()', 'removeRouteChoice()', 'madeUp(3)', 'not an effect']) h.run(effect);
    expect(JSON.stringify(h.runState)).toBe(before);
    expect(h.calls).toEqual([]);
  });
});

describe('resolveRouteEffect: gainCacheReward', () => {
  const options = alphaCacheSet.options;

  it('draws one authored cache option with the injected RNG and resolves exactly its effects', () => {
    expect(options.length).toBeGreaterThan(0);
    options.forEach((option, index) => {
      const roll = (index + 0.5) / options.length;
      const viaCache = harness({ currentHp: 15 }, { random: () => roll });
      viaCache.run('gainCacheReward()');
      const direct = harness({ currentHp: 15 });
      option.effects.forEach((effect) => direct.run(effect));
      expect(viaCache.runState, option.id).toEqual(direct.runState);
      expect(viaCache.calls, option.id).toEqual(direct.calls);
    });
  });

  it('is deterministic for a fixed RNG', () => {
    const a = harness({}, { random: () => 0.42 });
    const b = harness({}, { random: () => 0.42 });
    a.run('gainCacheReward()');
    b.run('gainCacheReward()');
    expect(a.runState).toEqual(b.runState);
  });
});
