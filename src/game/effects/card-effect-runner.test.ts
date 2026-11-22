import { describe, expect, it } from 'vitest';
import alphaCards from '../../../data/game/alpha-cards.json';
import {
  createCardEffectResolutionState,
  resolveCardEffect,
  type CardEffectCard,
  type CardEffectContext,
  type CardEffectEnemy,
  type CardEffectResolutionState,
} from './card-effect-runner';

type Card = CardEffectCard & { name: string };
type Enemy = CardEffectEnemy;
type Call = [string, ...unknown[]];

interface HarnessOptions {
  enemies?: Enemy[];
  flockBlock?: number;
  resonance?: number;
  moltBonus?: number;
  flockDamageBonus?: number;
  discarded?: number;
  defeats?: boolean;
  spendResonanceOk?: boolean;
  condition?: (condition: string) => boolean;
}

function enemy(id: string, patch: Partial<Enemy> = {}): Enemy {
  return { id, name: `Enemy ${id}`, hp: 20, maxHp: 20, block: 0, weak: 0, nextAttackBonus: 0, ...patch };
}

function harness(options: HarnessOptions = {}) {
  const calls: Call[] = [];
  const enemies = options.enemies ?? [enemy('e1'), enemy('e2')];
  let resonance = options.resonance ?? 0;
  const record = (name: string) => (...args: unknown[]) => { calls.push([name, ...args]); };
  const living = () => enemies.filter((entry) => entry.hp > 0);
  const context: CardEffectContext<Card, Enemy> = {
    flock: { hp: 30, maxHp: 40, block: options.flockBlock ?? 0, weak: 0, exposed: false, exposedTurns: 0, molt: false, openSkyGuard: 0, flow: 0 },
    cardName: (card) => card.name,
    checkCondition: (condition, _card, enemyId) => {
      calls.push(['checkCondition', condition, enemyId]);
      return options.condition?.(condition) ?? true;
    },
    logEvent: record('logEvent'),
    logFizzle: (card, text) => { calls.push(['logFizzle', card.id, text]); },
    getTargetWinded: (enemyId) => enemies.find((entry) => entry.id === enemyId)?.weak ?? 0,
    getLivingEnemy: (enemyId) => living().find((entry) => entry.id === enemyId),
    getEnemy: (enemyId) => enemies.find((entry) => entry.id === enemyId)!,
    livingEnemies: living,
    firstLivingEnemy: () => living()[0],
    damageEnemy: (enemyId, amount, source, card, pierce, bonus) => {
      calls.push(['damageEnemy', enemyId, amount, source, card.id, pierce, bonus]);
      return options.defeats ?? false;
    },
    gainBlock: (amount, source) => { calls.push(['gainBlock', amount, source]); },
    buildFlow: (state) => { state.builtFlow = true; calls.push(['buildFlow']); },
    spendFlockDamageBonus: (_state, area) => { calls.push(['spendFlockDamageBonus', area ?? false]); return options.flockDamageBonus ?? 0; },
    applyOpenSky: record('applyOpenSky'),
    loseFlockCover: record('loseFlockCover'),
    damageFlock: record('damageFlock'),
    healFlock: (value, source, overflow) => { calls.push(['healFlock', value, source, overflow ?? false]); },
    loseCohesion: record('loseCohesion'),
    drawCards: record('drawCards'),
    discardCards: (value) => { calls.push(['discardCards', value]); return options.discarded ?? value; },
    gainWingbeat: record('gainWingbeat'),
    loseWingbeat: record('loseWingbeat'),
    gainResonance: record('gainResonance'),
    spendResonance: (value) => { calls.push(['spendResonance', value]); return options.spendResonanceOk ?? true; },
    getResonance: () => resonance,
    setResonance: (value) => { resonance = value; calls.push(['setResonance', value]); },
    checkResonanceSpentMarks: record('checkResonanceSpentMarks'),
    resonanceBurstFx: record('resonanceBurstFx'),
    windedBurstFx: (target, stacks, burst) => { calls.push(['windedBurstFx', target.id, stacks, burst]); },
    moltBonus: (_state, value, area) => {
      calls.push(['moltBonus', value, area ?? false]);
      return options.moltBonus ?? 0;
    },
    applyFlockWinded: record('applyFlockWinded'),
    applyEnemyWinded: (target, value) => { calls.push(['applyEnemyWinded', target.id, value]); },
    removeEnemyCover: (source, target, value) => { calls.push(['removeEnemyCover', source, target.id, value]); },
    enterMolt: record('enterMolt'),
    gainOpenSkyGuard: record('gainOpenSkyGuard'),
    returnDiscardToHand: record('returnDiscardToHand'),
    addNextCoverBonus: record('addNextCoverBonus'),
    retainHand: record('retainHand'),
    addNextTurnDraw: record('addNextTurnDraw'),
    addNextTurnEnergy: record('addNextTurnEnergy'),
    addEnemyNextAttackBonus: (source, target, value) => { calls.push(['addEnemyNextAttackBonus', source, target.id, value]); },
    giveEnemyCover: (target, value, source, verb) => { calls.push(['giveEnemyCover', target.id, value, source, verb]); },
    shuffleSelfToDraw: record('shuffleSelfToDraw'),
  };
  const card: Card = { id: 'card_1', name: 'Test Card', runtime: { suit: 'plumes' } };
  const state = createCardEffectResolutionState();
  const run = (text: string, target = 'e1', runState: CardEffectResolutionState = state) =>
    resolveCardEffect(text, card, target, runState, context);
  const named = (name: string) => calls.filter((call) => call[0] === name);
  return { calls, named, enemies, context, card, state, run, resonance: () => resonance };
}

describe('createCardEffectResolutionState', () => {
  it('starts every per-play latch cleared and truncates Molt power to an integer', () => {
    expect(createCardEffectResolutionState()).toEqual({
      previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false,
      exhaustSelf: false, builtFlow: false, flockDamageBonusUsed: false, moltPower: 0, moltApplied: 0,
    });
    expect(createCardEffectResolutionState(3.9).moltPower).toBe(3);
  });
});

describe('resolveCardEffect: damage verbs', () => {
  it('damage hits the target with Molt and flock bonuses, records defeat and builds Flow', () => {
    const h = harness({ moltBonus: 2, flockDamageBonus: 1, defeats: true });
    h.run('damage(target, 6)');
    expect(h.named('moltBonus')).toEqual([['moltBonus', 6, false]]);
    expect(h.named('damageEnemy')).toEqual([['damageEnemy', 'e1', 8, 'Test Card', 'card_1', false, 1]]);
    expect(h.state.previousDamageDefeated).toBe(true);
    expect(h.state.builtFlow).toBe(true);
  });

  it('damagePierce passes the pierce flag', () => {
    const h = harness();
    h.run('damagePierce(target, 4)');
    expect(h.named('damageEnemy')).toEqual([['damageEnemy', 'e1', 4, 'Test Card', 'card_1', true, 0]]);
  });

  it('damageAll hits every living enemy with one shared area bonus and reports any defeat', () => {
    const h = harness({ enemies: [enemy('a'), enemy('b', { hp: 0 }), enemy('c')], moltBonus: 1, flockDamageBonus: 2 });
    h.run('damageAll(3)');
    expect(h.named('spendFlockDamageBonus')).toEqual([['spendFlockDamageBonus', true]]);
    expect(h.named('moltBonus')).toEqual([['moltBonus', 3, true]]);
    expect(h.named('damageEnemy').map((call) => [call[1], call[2], call[6]])).toEqual([['a', 4, 2], ['c', 4, 2]]);
    expect(h.state.previousDamageDefeated).toBe(false);
    expect(h.state.builtFlow).toBe(true);
  });

  it('damageAll resets a stale defeat latch and sets it when any enemy falls', () => {
    const h = harness({ defeats: true });
    h.state.previousDamageDefeated = false;
    h.run('damageAll(1)');
    expect(h.state.previousDamageDefeated).toBe(true);
  });

  it('uses the second argument as the value when there are two, else the first', () => {
    const h = harness();
    h.run('damage(5)');
    h.run('damage(target, 7)');
    expect(h.named('damageEnemy').map((call) => call[2])).toEqual([5, 7]);
  });
});

describe('resolveCardEffect: scaling values', () => {
  it('perDiscarded uses the count returned by the previous discard in the same play', () => {
    const h = harness({ discarded: 2 });
    h.run('discardUpTo(3)');
    expect(h.state.previousDiscarded).toBe(2);
    h.run('damage(target, 4 perDiscarded)');
    expect(h.named('damageEnemy')[0][2]).toBe(8);
  });

  it('perWinded reads the targeted enemy Winded stacks', () => {
    const h = harness({ enemies: [enemy('e1', { weak: 3 }), enemy('e2', { weak: 1 })] });
    h.run('damage(target, 2 perWinded)', 'e1');
    h.run('damage(target, 2 perWinded)', 'e2');
    expect(h.named('damageEnemy').map((call) => call[2])).toEqual([6, 2]);
  });

  it('perCover reads current flock Cover', () => {
    const h = harness({ flockBlock: 5 });
    h.run('damage(target, 1 perCover)');
    expect(h.named('damageEnemy')[0][2]).toBe(5);
  });
});

describe('resolveCardEffect: flock verbs', () => {
  it.each([
    ['applyOpenSky(2)', 'applyOpenSky', ['Test Card', 2]],
    ['loseCover(4)', 'loseFlockCover', ['Test Card', 4]],
    ['damageFlock(3)', 'damageFlock', ['Test Card', 3]],
    ['loseCohesion(2)', 'loseCohesion', ['Test Card', 2]],
    ['gainWingbeat(1)', 'gainWingbeat', ['Test Card', 1]],
    ['loseWingbeat(1)', 'loseWingbeat', ['Test Card', 1]],
    ['gainResonance(2)', 'gainResonance', [2]],
    ['enterMolt()', 'enterMolt', ['Test Card']],
    ['gainOpenSkyGuard(2)', 'gainOpenSkyGuard', [2]],
    ['nextCoverBonus(3)', 'addNextCoverBonus', [3]],
    ['retainHand(2)', 'retainHand', ['Test Card', 2]],
    ['nextTurnDraw(1)', 'addNextTurnDraw', [1]],
    ['gainEnergyNextTurn(1)', 'addNextTurnEnergy', ['Test Card', 1]],
    ['shuffleSelfToDraw()', 'shuffleSelfToDraw', ['Test Card']],
  ])('%s calls %s', (text, method, args) => {
    const h = harness();
    h.run(text);
    expect(h.named(method)).toEqual([[method, ...args]]);
    expect(h.named('logFizzle')).toEqual([]);
  });

  it('gainCover adds Molt bonus and builds Flow', () => {
    const h = harness({ moltBonus: 2 });
    h.run('gainCover(5)');
    expect(h.named('gainBlock')).toEqual([['gainBlock', 7, 'Test Card']]);
    expect(h.state.builtFlow).toBe(true);
  });

  it('heal adds Molt bonus without overflow; overhealCover overflows to Cover and builds Flow', () => {
    const h = harness({ moltBonus: 1 });
    h.run('heal(4)');
    expect(h.named('healFlock')).toEqual([['healFlock', 5, 'Test Card', false]]);
    expect(h.state.builtFlow).toBe(false);
    h.run('overhealCover(4)');
    expect(h.named('healFlock')[1]).toEqual(['healFlock', 5, 'Test Card', true]);
    expect(h.state.builtFlow).toBe(true);
  });

  it('draw draws and logs', () => {
    const h = harness();
    h.run('draw(2)');
    expect(h.named('drawCards')).toEqual([['drawCards', 2]]);
    expect(h.named('logEvent')).toEqual([['logEvent', 'Test Card draws 2.']]);
  });

  it('discard and discardUpTo both record the actual number discarded', () => {
    for (const verb of ['discard', 'discardUpTo']) {
      const h = harness({ discarded: 1 });
      h.run(`${verb}(2)`);
      expect(h.named('discardCards')).toEqual([['discardCards', 2]]);
      expect(h.state.previousDiscarded).toBe(1);
    }
  });

  it('spendResonance records whether the spend succeeded', () => {
    const ok = harness({ spendResonanceOk: true });
    ok.run('spendResonance(2)');
    expect(ok.state.spentResonance).toBe(true);
    const short = harness({ spendResonanceOk: false });
    short.run('spendResonance(2)');
    expect(short.state.spentResonance).toBe(false);
  });

  it('returnDiscard passes the filter and a separately parsed draw count', () => {
    const h = harness();
    h.run('returnDiscard(attack, 1)');
    h.run('returnDiscard(any)');
    expect(h.named('returnDiscardToHand')).toEqual([['returnDiscardToHand', 'attack', 1], ['returnDiscardToHand', 'any', 0]]);
  });

  it('exhaustSelf and shuffleSelfToDraw set their pile latches', () => {
    const h = harness();
    h.run('exhaustSelf()');
    expect(h.state.exhaustSelf).toBe(true);
    h.run('shuffleSelfToDraw()');
    expect(h.state.returnSelfToDraw).toBe(true);
  });
});

describe('resolveCardEffect: Resonance and Winded bursts', () => {
  it('resonanceBurst spends all Resonance for value-per-stack damage and fires marks', () => {
    const h = harness({ resonance: 3, moltBonus: 1, defeats: true });
    h.run('resonanceBurst(2)');
    expect(h.named('moltBonus')).toEqual([['moltBonus', 6, false]]);
    expect(h.named('damageEnemy')).toEqual([['damageEnemy', 'e1', 7, 'Test Card', 'card_1', false, 0]]);
    expect(h.named('resonanceBurstFx')).toEqual([['resonanceBurstFx', 'e1', 3, 7]]);
    expect(h.resonance()).toBe(0);
    expect(h.state.spentResonance).toBe(true);
    expect(h.state.previousDamageDefeated).toBe(true);
    expect(h.named('checkResonanceSpentMarks')).toHaveLength(1);
    expect(h.state.builtFlow).toBe(true);
  });

  it('resonanceBurst with no Resonance deals nothing and fires no marks', () => {
    const h = harness({ resonance: 0 });
    h.run('resonanceBurst(2)');
    expect(h.named('damageEnemy')).toEqual([]);
    expect(h.named('moltBonus')).toEqual([]);
    expect(h.named('checkResonanceSpentMarks')).toEqual([]);
    expect(h.state.spentResonance).toBe(false);
    expect(h.named('setResonance')).toEqual([['setResonance', 0]]);
  });

  it('windedBurst converts target Winded into damage and clears it', () => {
    const h = harness({ enemies: [enemy('e1', { weak: 4 })] });
    h.run('windedBurst(3)');
    expect(h.named('damageEnemy')[0][2]).toBe(12);
    expect(h.named('windedBurstFx')).toEqual([['windedBurstFx', 'e1', 4, 12]]);
    expect(h.enemies[0].weak).toBe(0);
  });

  it('windedBurst on a dead or missing target does nothing', () => {
    const h = harness({ enemies: [enemy('e1', { hp: 0, weak: 4 })] });
    h.run('windedBurst(3)');
    h.run('windedBurst(3)', 'nobody');
    expect(h.named('damageEnemy')).toEqual([]);
    expect(h.enemies[0].weak).toBe(4);
    expect(h.state.builtFlow).toBe(false);
  });

  it('applyWinded stacks on the targeted living enemy, or targets the flock', () => {
    const h = harness({ enemies: [enemy('e1', { weak: 1 })] });
    h.run('applyWinded(target, 2)');
    expect(h.enemies[0].weak).toBe(3);
    expect(h.named('applyEnemyWinded')).toEqual([['applyEnemyWinded', 'e1', 2]]);
    h.run('applyWinded(flock, 1)');
    expect(h.named('applyFlockWinded')).toEqual([['applyFlockWinded', 'Test Card', 1]]);
    h.run('applyWinded(target, 2)', 'missing');
    expect(h.named('applyEnemyWinded')).toHaveLength(1);
  });
});

describe('resolveCardEffect: enemy-side verbs', () => {
  it('removeCover targets the living selected enemy only', () => {
    const h = harness({ enemies: [enemy('e1'), enemy('dead', { hp: 0 })] });
    h.run('removeCover(target, 3)');
    h.run('removeCover(target, 3)', 'dead');
    expect(h.named('removeEnemyCover')).toEqual([['removeEnemyCover', 'Test Card', 'e1', 3]]);
  });

  it('enemyNextAttackBonus and enemyGainCover apply to the first living enemy, not the target', () => {
    const h = harness({ enemies: [enemy('dead', { hp: 0 }), enemy('front'), enemy('back')] });
    h.run('enemyNextAttackBonus(2)', 'back');
    h.run('enemyGainCover(3)', 'back');
    expect(h.named('addEnemyNextAttackBonus')).toEqual([['addEnemyNextAttackBonus', 'Test Card', 'front', 2]]);
    expect(h.named('giveEnemyCover')).toEqual([['giveEnemyCover', 'front', 3, 'Test Card', 'shields']]);
  });

  it('enemy-side verbs are no-ops with no living enemies', () => {
    const h = harness({ enemies: [] });
    h.run('enemyNextAttackBonus(2)');
    h.run('enemyGainCover(3)');
    expect(h.calls.filter((call) => !['moltBonus'].includes(call[0]))).toEqual([]);
  });
});

describe('resolveCardEffect: conditions and malformed text', () => {
  it('runs the inner effect only when the condition passes', () => {
    const pass = harness({ condition: () => true });
    pass.run('if hasResonance then draw(2)');
    expect(pass.named('checkCondition')).toEqual([['checkCondition', 'hasResonance', 'e1']]);
    expect(pass.named('drawCards')).toEqual([['drawCards', 2]]);
    const fail = harness({ condition: () => false });
    fail.run('if hasResonance then draw(2)');
    expect(fail.named('drawCards')).toEqual([]);
  });

  it('passes parameterised conditions through verbatim', () => {
    const h = harness();
    h.run('if playedSuitThisTurn(basins) then gainWingbeat(1)');
    expect(h.named('checkCondition')[0][1]).toBe('playedSuitThisTurn(basins)');
  });

  it('nests conditions', () => {
    const seen: string[] = [];
    const h = harness({ condition: (condition) => { seen.push(condition); return condition !== 'b'; } });
    h.run('if a then if c then draw(1)');
    expect(seen).toEqual(['a', 'c']);
    expect(h.named('drawCards')).toHaveLength(1);
  });

  it('logs a fizzle for unparseable text', () => {
    const h = harness();
    h.run('draw 2');
    expect(h.named('logFizzle')).toEqual([['logFizzle', 'card_1', 'draw 2']]);
  });

  it('logs a fizzle for a well-formed but unknown verb', () => {
    const h = harness();
    h.run('gainCovr(3)');
    expect(h.named('logFizzle')).toEqual([['logFizzle', 'card_1', 'gainCovr(3)']]);
  });
});

describe('authored card data', () => {
  const HANDLED_VERBS = new Set([
    'damage', 'damagePierce', 'damageAll', 'gainCover', 'applyOpenSky', 'loseCover', 'damageFlock', 'heal',
    'overhealCover', 'loseCohesion', 'draw', 'discard', 'discardUpTo', 'gainWingbeat', 'loseWingbeat',
    'gainResonance', 'spendResonance', 'resonanceBurst', 'windedBurst', 'applyWinded', 'removeCover', 'enterMolt',
    'gainOpenSkyGuard', 'returnDiscard', 'nextCoverBonus', 'retainHand', 'nextTurnDraw', 'gainEnergyNextTurn',
    'enemyNextAttackBonus', 'enemyGainCover', 'shuffleSelfToDraw', 'exhaustSelf',
  ]);

  it('every handled verb has an observable effect on a populated board', () => {
    for (const verb of HANDLED_VERBS) {
      const h = harness({ resonance: 2, enemies: [enemy('e1', { weak: 2 })] });
      const before = JSON.stringify(h.state);
      h.run(`${verb}(target, 2)`);
      const observable = h.calls.some((call) => !['moltBonus', 'spendFlockDamageBonus'].includes(call[0]))
        || JSON.stringify(h.state) !== before;
      expect(observable, verb).toBe(true);
    }
  });

  it('every effect authored on a card (base, Molt and upgrade) parses to a handled verb', () => {
    const unknown: string[] = [];
    for (const card of alphaCards.cards as Array<Record<string, unknown>>) {
      const upgrade = (card.upgrade ?? {}) as Record<string, unknown>;
      const texts = [card.effects, card.moltEffects, upgrade.effects, upgrade.moltEffects]
        .flatMap((list) => (Array.isArray(list) ? list : [])) as string[];
      for (const text of texts) {
        let effect = text;
        for (let match = /^if (\S+) then (.+)$/.exec(effect); match; match = /^if (\S+) then (.+)$/.exec(effect)) effect = match[2];
        const name = /^([a-zA-Z][a-zA-Z0-9]*)\(.*\)$/.exec(effect)?.[1];
        if (!name || !HANDLED_VERBS.has(name)) unknown.push(`${String(card.id)}: ${text}`);
      }
    }
    expect(unknown).toEqual([]);
  });
});
