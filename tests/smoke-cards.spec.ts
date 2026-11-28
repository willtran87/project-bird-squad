import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { boot } from './helpers/smoke';

// Split from the former tests/smoke.spec.ts (cards topics). Tests drive
// scenes through the deterministic text-state harness on window.

test('a newly-added arcana card constructs from the library and resolves its effect', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    // Seed a deck of a brand-new Major (major_07 "Dive Line" = damage 6) to prove
    // the expanded card pool both instantiates and runs through the interpreter.
    const deck = Array.from({ length: 10 }, () => ({ id: 'major_07' }));
    await window.__birdSquadStartScene!('BattleScene', {
      runState: {
        deck, currentHp: 40, scrap: 0, routeMarks: [], supplies: [], mapIndex: 0,
        completedRouteNodeIds: [], currentRouteNodeId: undefined, routeLog: [],
        nextCombat: undefined, signalChoices: [], rewardEvents: []
      },
      routeNodeId: 'm1_entry'
    });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const card = scene.hand[0] ?? scene.drawPile[0];
    const enemyId = scene.enemies[0].id;
    const before = scene.enemies[0].hp;
    scene.resolveCardEffects(card, enemyId);
    return { cardId: card?.id, displayName: card?.runtime?.displayName, delta: before - scene.enemies[0].hp };
  });
  expect(result.cardId).toBe('major_07');
  expect(result.displayName).toBe('Dive Line');
  expect(result.delta).toBeGreaterThanOrEqual(6);
});

test('enemy combat effects: snag insertion lands and Flock-state conditions gate correctly', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];
    // (1) addSnagToDiscard now inserts the named snag card into the discard pile.
    const before = scene.discardPile.length;
    scene.resolveEnemyEffect(enemy, 'addSnagToDiscard(tangled_line)');
    const added = scene.discardPile[scene.discardPile.length - 1];
    const collectionRecord = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').cardCollection?.tangled_line;
    // (2) flockCohesionBelowHalf (previously unimplemented) now evaluates: false at
    // full cohesion, true below half.
    scene.flock.hp = scene.flock.maxHp; scene.flock.exposed = false;
    scene.resolveEnemyEffect(enemy, 'if flockCohesionBelowHalf then applyOpenSky(1)');
    const firedAtFull = scene.flock.exposed;
    scene.flock.hp = 1; scene.flock.exposed = false;
    scene.resolveEnemyEffect(enemy, 'if flockCohesionBelowHalf then applyOpenSky(1)');
    const firedAtLow = scene.flock.exposed;
    return {
      snagDelta: scene.discardPile.length - before,
      addedSnagKind: added?.runtime?.kind,
      firedAtFull, firedAtLow, collectionRecord
    };
  });
  expect(r.snagDelta).toBe(1);
  expect(r.addedSnagKind).toBe('snag');
  expect(r.collectionRecord).toMatchObject({ timesClaimed: 1, firstSource: 'snag' });
  expect(r.firedAtFull).toBe(false);
  expect(r.firedAtLow).toBe(true);
});

test('snag cards punish being held at Roost instead of acting as inert dead cards', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];
    const makeSnag = (id: string) => {
      scene.resolveEnemyEffect(enemy, `addSnagToDiscard(${id})`);
      return scene.discardPile.pop();
    };
    const fillerCard = { ...scene.hand[0], instanceId: 'held-snag-filler' };

    scene.hand = [makeSnag('tangled_line')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.energy = 3;
    scene.resolveHeldSnagEffects();
    const tangledHeld = {
      hand: scene.hand.length,
      draw: scene.drawPile.map((card: any) => card.id),
      energy: scene.energy,
    };

    scene.hand = [makeSnag('wet_feathers')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.flock.weak = 0;
    scene.resolveHeldSnagEffects();
    const wetHeld = {
      hand: scene.hand.map((card: any) => card.id),
      weak: scene.flock.weak,
    };

    scene.hand = [makeSnag('bad_directions')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.spark = 1;
    scene.resolveHeldSnagEffects();
    const badHeld = {
      hand: scene.hand.length,
      draw: scene.drawPile.map((card: any) => card.id),
      spark: scene.spark,
    };

    scene.hand = [makeSnag('loose_shingle')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.flock.hp = 10;
    scene.flock.block = 0;
    scene.resolveHeldSnagEffects();
    const looseHeld = {
      hand: scene.hand.map((card: any) => card.id),
      hp: scene.flock.hp,
    };

    scene.hand = [makeSnag('static_burst')];
    scene.drawPile = [];
    scene.discardPile = [];
    enemy.nextAttackBonus = 0;
    scene.resolveHeldSnagEffects();
    const staticHeld = {
      hand: scene.hand.map((card: any) => card.id),
      nextAttackBonus: enemy.nextAttackBonus,
    };

    scene.hand = [makeSnag('bent_feather')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.flock.weak = 0;
    scene.resolveHeldSnagEffects();
    const bentHeld = {
      hand: scene.hand.map((card: any) => card.id),
      weak: scene.flock.weak,
    };

    scene.hand = [makeSnag('glass_gap')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.flock.exposed = false;
    scene.flock.exposedTurns = 0;
    enemy.nextAttackBonus = 0;
    scene.resolveHeldSnagEffects();
    const glassHeld = {
      hand: scene.hand.map((card: any) => card.id),
      exposed: scene.flock.exposed,
      exposedTurns: scene.flock.exposedTurns,
      nextAttackBonus: enemy.nextAttackBonus,
    };

    scene.hand = [makeSnag('jammed_strap'), { ...fillerCard, instanceId: 'held-snag-filler-jammed' }];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.resolveHeldSnagEffects();
    const jammedHeld = {
      hand: scene.hand.map((card: any) => card.id),
      draw: scene.drawPile.map((card: any) => card.id),
      discardCount: scene.discardPile.length,
    };

    scene.hand = [makeSnag('barricade_scrap')];
    scene.drawPile = [];
    scene.discardPile = [];
    enemy.block = 0;
    scene.resolveHeldSnagEffects();
    const barricadeHeld = {
      hand: scene.hand.map((card: any) => card.id),
      enemyCover: enemy.block,
    };

    scene.hand = [makeSnag('smeared_map')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.nextTurnDrawBonus = 0;
    scene.resolveHeldSnagEffects();
    const smearedHeld = {
      hand: scene.hand.map((card: any) => card.id),
      draw: scene.drawPile.map((card: any) => card.id),
      nextDraw: scene.nextTurnDrawBonus,
    };

    return { tangledHeld, wetHeld, badHeld, looseHeld, staticHeld, bentHeld, glassHeld, jammedHeld, barricadeHeld, smearedHeld };
  });

  expect(r.tangledHeld).toEqual({ hand: 0, draw: ['tangled_line'], energy: 2 });
  expect(r.wetHeld).toEqual({ hand: ['wet_feathers'], weak: 1 });
  expect(r.badHeld).toEqual({ hand: 0, draw: ['bad_directions'], spark: 0 });
  expect(r.looseHeld).toEqual({ hand: ['loose_shingle'], hp: 8 });
  expect(r.staticHeld).toEqual({ hand: ['static_burst'], nextAttackBonus: 1 });
  expect(r.bentHeld).toEqual({ hand: ['bent_feather'], weak: 1 });
  expect(r.glassHeld).toEqual({ hand: ['glass_gap'], exposed: true, exposedTurns: 1, nextAttackBonus: 1 });
  expect(r.jammedHeld).toEqual({ hand: [], draw: ['jammed_strap'], discardCount: 1 });
  expect(r.barricadeHeld).toEqual({ hand: ['barricade_scrap'], enemyCover: 6 });
  expect(r.smearedHeld).toEqual({ hand: [], draw: ['smeared_map'], nextDraw: -1 });
});

test('new snag cards have playable cleanup tradeoffs', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];
    const makeSnag = (id: string) => {
      scene.resolveEnemyEffect(enemy, `addSnagToDiscard(${id})`);
      return scene.discardPile.pop();
    };
    const fillerCard = { ...scene.hand[0], instanceId: 'played-snag-filler' };

    scene.hand = [makeSnag('loose_shingle')];
    scene.flock.block = 5;
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const loosePlayed = {
      block: scene.flock.block,
      discard: scene.discardPile.map((card: any) => card.id),
    };

    scene.hand = [makeSnag('static_burst')];
    scene.discardPile = [];
    scene.spark = 1;
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const staticWithResonance = {
      spark: scene.spark,
      energy: scene.energy,
      discard: scene.discardPile.map((card: any) => card.id),
    };

    scene.hand = [makeSnag('static_burst')];
    scene.discardPile = [];
    scene.spark = 0;
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const staticNoResonance = {
      spark: scene.spark,
      energy: scene.energy,
      discard: scene.discardPile.map((card: any) => card.id),
    };

    scene.hand = [makeSnag('bent_feather')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.flock.weak = 0;
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const bentPlayed = {
      weak: scene.flock.weak,
      hand: scene.hand.map((card: any) => card.id),
      discard: scene.discardPile.map((card: any) => card.id),
      draw: scene.drawPile.map((card: any) => card.id),
    };

    scene.hand = [makeSnag('glass_gap')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.flock.exposed = false;
    scene.flock.exposedTurns = 0;
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const glassPlayed = {
      exposed: scene.flock.exposed,
      exposedTurns: scene.flock.exposedTurns,
      discard: scene.discardPile.map((card: any) => card.id),
    };

    scene.hand = [makeSnag('jammed_strap'), { ...fillerCard, instanceId: 'played-snag-filler-jammed' }];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    scene.toggleDiscardChoice('played-snag-filler-jammed');
    scene.confirmDiscardChoice();
    const jammedPlayed = {
      hand: scene.hand.map((card: any) => card.id),
      discard: scene.discardPile.map((card: any) => card.id),
    };

    scene.hand = [makeSnag('barricade_scrap')];
    scene.drawPile = [];
    scene.discardPile = [];
    enemy.block = 0;
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const barricadePlayed = {
      enemyCover: enemy.block,
      discard: scene.discardPile.map((card: any) => card.id),
    };

    scene.hand = [makeSnag('smeared_map')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.nextTurnDrawBonus = 0;
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const smearedPlayed = {
      nextDraw: scene.nextTurnDrawBonus,
      discard: scene.discardPile.map((card: any) => card.id),
    };

    return { loosePlayed, staticWithResonance, staticNoResonance, bentPlayed, glassPlayed, jammedPlayed, barricadePlayed, smearedPlayed };
  });

  expect(r.loosePlayed).toEqual({ block: 3, discard: ['loose_shingle'] });
  expect(r.staticWithResonance).toEqual({ spark: 0, energy: 3, discard: ['static_burst'] });
  expect(r.staticNoResonance).toEqual({ spark: 0, energy: 2, discard: ['static_burst'] });
  expect(r.bentPlayed).toEqual({ weak: 1, hand: [], discard: [], draw: [] });
  expect(r.glassPlayed).toEqual({ exposed: true, exposedTurns: 1, discard: ['glass_gap'] });
  expect(r.jammedPlayed.discard).toContain('jammed_strap');
  expect(r.jammedPlayed.discard.length).toBe(2);
  expect(r.jammedPlayed.hand).toEqual([]);
  expect(r.barricadePlayed).toEqual({ enemyCover: 3, discard: ['barricade_scrap'] });
  expect(r.smearedPlayed).toEqual({ nextDraw: -1, discard: ['smeared_map'] });
});

test('enemy post-Roost punishers react to card spam and empty hands', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];

    scene.roostCards = 3;
    scene.roostFree = 1;
    scene.roostHeld = 1;
    scene.flock.frail = 0;
    scene.energy = 3;
    scene.nextTurnEnergyBonus = 0;
    scene.resolveEnemyEffect(enemy, 'if playedCardsAtLeast(4) then applyFrail(1)');
    scene.resolveEnemyEffect(enemy, 'if zeroCostCardsAtLeast(2) then loseWingbeat(1)');
    scene.resolveEnemyEffect(enemy, 'if handEmptyAtRoost then applyWinded(flock, 1)');
    const restrained = { frail: scene.flock.frail, energy: scene.energy, nextTurn: scene.nextTurnEnergyBonus, weak: scene.flock.weak };

    scene.roostCards = 4;
    scene.roostFree = 2;
    scene.roostHeld = 0;
    scene.flock.frail = 0;
    scene.flock.weak = 0;
    scene.energy = 3;
    scene.nextTurnEnergyBonus = 0;
    scene.resolveEnemyEffect(enemy, 'if playedCardsAtLeast(4) then applyFrail(1)');
    scene.resolveEnemyEffect(enemy, 'if zeroCostCardsAtLeast(2) then loseWingbeat(1)');
    scene.resolveEnemyEffect(enemy, 'if handEmptyAtRoost then applyWinded(flock, 1)');
    const spammed = { frail: scene.flock.frail, energy: scene.energy, nextTurn: scene.nextTurnEnergyBonus, weak: scene.flock.weak };

    return { restrained, spammed };
  });

  // Wingbeat taxes land on the next player turn.
  expect(r.restrained).toEqual({ frail: 0, energy: 3, nextTurn: 0, weak: 0 });
  expect(r.spammed).toEqual({ frail: 1, energy: 3, nextTurn: -1, weak: 1 });
});

test('free draw effects require setup instead of refunding every zero-cost play', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const base = scene.hand[0];
    const rush = {
      ...base,
      id: 'wands_08',
      instanceId: 'test-plume-rush',
      target: 'none',
      runtime: {
        ...base.runtime,
        id: 'wands_08',
        target: 'none',
        effects: ['if isMolting then draw(1)', 'if isMolting then gainWingbeat(1)'],
        upgrade: { ...base.runtime.upgrade, effects: ['draw(1)', 'if isMolting then draw(1)', 'if isMolting then gainWingbeat(1)'] },
      },
    };
    const filler = { ...base, id: 'major_00', instanceId: 'test-filler' };

    scene.drawPile = [filler];
    scene.hand = [rush];
    scene.flock.molt = false;
    scene.energy = 9;
    scene.resolveCardEffects(rush, '');
    const normal = { hand: scene.hand.length, draw: scene.drawPile.length, energy: scene.energy };

    scene.drawPile = [filler];
    scene.hand = [rush];
    scene.flock.molt = true;
    scene.energy = 9;
    scene.resolveCardEffects(rush, '');
    const molting = { hand: scene.hand.length, draw: scene.drawPile.length, energy: scene.energy };

    return { normal, molting };
  });

  expect(r.normal).toEqual({ hand: 1, draw: 1, energy: 9 });
  expect(r.molting).toEqual({ hand: 2, draw: 0, energy: 10 });
});

test('starter Preens add new decisions instead of only larger numbers', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && (!(scene.hand && scene.hand.length) || !scene.battleHandRendererModule); i += 1) await wait(50);

    const starterIds = [
      'major_00', 'wands_ace', 'wands_fledgling', 'swords_ace', 'swords_fledgling',
      'cups_ace', 'cups_fledgling', 'pentacles_04', 'pentacles_fledgling', 'aviary_25',
    ];
    const deck = [...scene.drawPile, ...scene.hand, ...scene.discardPile];
    const byId = (id: string) => deck.find((card: any) => card.id === id);
    const upgraded = (id: string) => ({ ...byId(id), upgraded: true });
    const shape = (effect: string) => effect.replace(/-?\d+(?:\.\d+)?/g, '#');
    const changesShape = (card: any) => {
      const base = card.runtime.effects ?? [];
      const preened = card.runtime.upgrade.effects ?? [];
      const baseMolt = card.runtime.moltEffects ?? [];
      const preenedMolt = card.runtime.upgrade.moltEffects ?? [];
      const changed = (left: string[], right: string[]) => (
        left.length !== right.length || left.some((effect, index) => shape(effect) !== shape(right[index] ?? ''))
      );
      return changed(base, preened)
        || changed(baseMolt, preenedMolt)
        || (Number.isInteger(card.runtime.upgrade.cost) && card.runtime.upgrade.cost !== card.runtime.cost);
    };
    const authored = Object.fromEntries(starterIds.map((id) => [id, byId(id)?.runtime.upgrade.effects ?? []]));

    const enemy = scene.enemies[0];
    const originalEnemyMaxHp = enemy.maxHp;
    enemy.maxHp = 10_000;
    enemy.hp = 10_000;
    enemy.block = 0;
    scene.flock.molt = false;
    const fillerTemplate = byId('wands_fledgling');
    let fillerOrdinal = 0;
    const fillers = (count: number) => Array.from({ length: count }, () => ({
      ...fillerTemplate,
      instanceId: `preen-filler-${fillerOrdinal += 1}`,
    }));
    const reset = () => {
      scene.hand = [];
      scene.drawPile = [];
      scene.discardPile = [];
      scene.energy = 0;
      scene.spark = 0;
      scene.flock.flow = 0;
      scene.flock.block = 0;
      scene.flock.openSkyGuard = 0;
      scene.nextTurnDrawBonus = 0;
      scene.pendingNestCoverBonus = 0;
      scene.playedCardIdsThisCombat.clear();
      enemy.hp = 10_000;
      enemy.block = 0;
      enemy.weak = 0;
    };

    reset();
    scene.drawPile = fillers(1);
    const firstFlight = upgraded('major_00');
    scene.resolveCardEffects(firstFlight, enemy.id);
    const firstFlightOpening = { energy: scene.energy, drawn: scene.hand.length };
    reset();
    scene.drawPile = fillers(1);
    scene.playedCardIdsThisCombat.add('major_00');
    scene.resolveCardEffects(firstFlight, enemy.id);
    const firstFlightLater = { energy: scene.energy, drawn: scene.hand.length };

    reset();
    scene.spark = 1;
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(upgraded('wands_ace'), enemy.id);
    const plumeWithResonance = { drawn: scene.hand.length, resonance: scene.spark };
    reset();
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(upgraded('wands_ace'), enemy.id);
    const plumeWithoutResonance = { drawn: scene.hand.length, resonance: scene.spark };

    reset();
    enemy.weak = 1;
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(upgraded('swords_ace'), enemy.id);
    const pointOnWinded = { energy: scene.energy, drawn: scene.hand.length };
    reset();
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(upgraded('swords_ace'), enemy.id);
    const pointOnClean = { energy: scene.energy, drawn: scene.hand.length };

    reset();
    enemy.weak = 2;
    scene.drawPile = fillers(2);
    scene.resolveCardEffects(upgraded('swords_fledgling'), enemy.id);
    const fledglingOnTwoWinded = { energy: scene.energy, drawn: scene.hand.length };
    reset();
    enemy.weak = 1;
    scene.drawPile = fillers(2);
    scene.resolveCardEffects(upgraded('swords_fledgling'), enemy.id);
    const fledglingBelowGate = { energy: scene.energy, drawn: scene.hand.length };

    reset();
    scene.flock.hp = scene.flock.maxHp;
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(upgraded('cups_ace'), enemy.id);
    const basinAtFull = { guard: scene.flock.openSkyGuard, drawn: scene.hand.length };
    reset();
    scene.flock.hp = scene.flock.maxHp - 10;
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(upgraded('cups_ace'), enemy.id);
    const basinBelowFull = { guard: scene.flock.openSkyGuard, drawn: scene.hand.length };

    reset();
    scene.incomingNextAttackDamage = () => 8;
    scene.resolveCardEffects(upgraded('pentacles_04'), enemy.id);
    const lockedNestBlocks = {
      cover: scene.flock.block,
      nextDraw: scene.nextTurnDrawBonus,
      guard: scene.flock.openSkyGuard,
    };
    reset();
    scene.incomingNextAttackDamage = () => 99;
    scene.resolveCardEffects(upgraded('pentacles_04'), enemy.id);
    const lockedNestShort = {
      cover: scene.flock.block,
      nextDraw: scene.nextTurnDrawBonus,
      guard: scene.flock.openSkyGuard,
    };

    reset();
    scene.incomingNextAttackDamage = () => 4;
    scene.resolveCardEffects(upgraded('pentacles_fledgling'), enemy.id);
    const nestFledglingBlocks = { cover: scene.flock.block, nextNestCover: scene.pendingNestCoverBonus };
    reset();
    scene.incomingNextAttackDamage = () => 99;
    scene.resolveCardEffects(upgraded('pentacles_fledgling'), enemy.id);
    const nestFledglingShort = { cover: scene.flock.block, nextNestCover: scene.pendingNestCoverBonus };

    reset();
    scene.hand = [firstFlight];
    scene.drawPile = deck.filter((card: any) => card.id !== 'major_00');
    scene.energy = 3;
    scene.flock.hp = scene.flock.maxHp;
    enemy.maxHp = originalEnemyMaxHp;
    enemy.hp = originalEnemyMaxHp;
    scene.incomingNextAttackDamage = () => 6;
    scene.renderAll();
    scene.showCardPreview(firstFlight);
    await wait(80);
    scene.openCombatCardDetail(firstFlight);
    const readerText = scene.combatCardDetail.list.filter((child: any) => typeof child.text === 'string').map((child: any) => child.text);
    for (let i = 0; i < scene.combatCardDetail.getData('pageCount'); i += 1) {
      readerText.push(scene.combatCardDetail.getByName('combat-card-detail-body').text);
      scene.combatCardDetail.getData('changePage')(1);
    }

    return {
      missingStarterCards: starterIds.filter((id) => !byId(id)),
      decisionShape: Object.fromEntries(starterIds.map((id) => [id, changesShape(byId(id))])),
      authored,
      firstFlightOpening,
      firstFlightLater,
      plumeWithResonance,
      plumeWithoutResonance,
      pointOnWinded,
      pointOnClean,
      fledglingOnTwoWinded,
      fledglingBelowGate,
      basinAtFull,
      basinBelowFull,
      lockedNestBlocks,
      lockedNestShort,
      nestFledglingBlocks,
      nestFledglingShort,
      previewText: readerText,
    };
  });

  expect(result.missingStarterCards).toEqual([]);
  expect(Object.values(result.decisionShape).every(Boolean)).toBe(true);
  expect(result.authored.major_00).toContain('if firstPlayedThisCombat then gainWingbeat(1)');
  expect(result.authored.wands_ace).toContain('if hasResonance then draw(1)');
  expect(result.authored.swords_ace).toContain('if targetWinded then gainWingbeat(1)');
  expect(result.authored.swords_fledgling).toContain('if windedAtLeast(2) then gainWingbeat(1)');
  expect(result.authored.cups_ace).toContain('if fullCohesion then gainOpenSkyGuard(1)');
  expect(result.authored.pentacles_04).toContain('if fullyBlocksNextAttack then gainOpenSkyGuard(1)');
  expect(result.authored.pentacles_fledgling).toContain('if fullyBlocksNextAttack then nextCoverBonus(nests, 2)');
  expect(result.firstFlightOpening).toEqual({ energy: 1, drawn: 1 });
  expect(result.firstFlightLater).toEqual({ energy: 0, drawn: 0 });
  expect(result.plumeWithResonance).toEqual({ drawn: 1, resonance: 3 });
  expect(result.plumeWithoutResonance).toEqual({ drawn: 0, resonance: 2 });
  expect(result.pointOnWinded).toEqual({ energy: 1, drawn: 1 });
  expect(result.pointOnClean).toEqual({ energy: 0, drawn: 0 });
  expect(result.fledglingOnTwoWinded).toEqual({ energy: 1, drawn: 2 });
  expect(result.fledglingBelowGate).toEqual({ energy: 0, drawn: 0 });
  expect(result.basinAtFull).toEqual({ guard: 1, drawn: 1 });
  expect(result.basinBelowFull).toEqual({ guard: 0, drawn: 0 });
  expect(result.lockedNestBlocks).toEqual({ cover: 8, nextDraw: 2, guard: 1 });
  expect(result.lockedNestShort).toEqual({ cover: 8, nextDraw: 0, guard: 0 });
  expect(result.nestFledglingBlocks).toEqual({ cover: 4, nextNestCover: 2 });
  expect(result.nestFledglingShort).toEqual({ cover: 4, nextNestCover: 0 });
  expect(result.previewText).toContain('First Flight+');
  expect(result.previewText.join(' ')).toContain('Preened');
  await page.screenshot({ path: '.artifacts/test-results/starter-preen-first-flight.png' });
});

test('reward Preens across every rarity add decisions instead of only larger numbers', async ({ page }) => {
  test.setTimeout(60_000);
  const alphaCards = JSON.parse(await readFile('data/game/alpha-cards.json', 'utf8'));
  const rewardIds = new Set<string>(alphaCards.rewardPool);
  const rewardCards = alphaCards.cards.filter((card: any) => rewardIds.has(card.id));
  const commonRewards = rewardCards.filter((card: any) => card.rarity === 'common');
  const shape = (effect: string) => effect.replace(/-?\d+(?:\.\d+)?/g, '#');
  const effectsChange = (base: string[] = [], upgraded: string[] = []) => (
    base.length !== upgraded.length
    || base.some((effect, index) => shape(effect) !== shape(upgraded[index] ?? ''))
  );
  const changesDecision = (card: any) => (
    effectsChange(card.effects, card.upgrade.effects)
    || effectsChange(card.moltEffects, card.upgrade.moltEffects)
    || (Number.isInteger(card.upgrade.cost) && card.upgrade.cost !== card.cost)
  );
  const expectedHooks: Record<string, string> = {
    swords_02: 'if targetBelowHalf then gainWingbeat(1)',
    cups_03: 'if fullCohesion then retainHand(1)',
    pentacles_02: 'if fullyBlocksNextAttack then gainWingbeat(1)',
    wands_02: 'if hasResonance then retainHand(1)',
    wands_03: 'if spentResonance then gainWingbeat(1)',
    wands_05: 'if spentResonance then applyWinded(target, 1)',
    swords_03: 'if targetIntendsAttack then gainCover(2)',
    swords_04: 'if targetHasCover then gainResonance(1)',
    swords_05: 'if targetHasCover then nextTurnDraw(1)',
    cups_02: 'if fullCohesion then gainEnergyNextTurn(1)',
    cups_04: 'if openSky then draw(1)',
    cups_05: 'if openSky then retainHand(1)',
    pentacles_ace: 'if openSky then nextTurnDraw(1)',
    pentacles_03: 'retainHand(1)',
    pentacles_05: 'if cohesionBelowHalf then gainOpenSkyGuard(1)',
    aviary_29: 'if targetIntendsAttack then gainWingbeat(1)',
    aviary_30: 'if openSky then retainHand(1)',
    aviary_31: 'if targetHasCover then gainWingbeat(1)',
    aviary_36: 'if firstPlayedThisCombat then nextTurnDraw(1)',
    aviary_37: 'if fullyBlocksNextAttack then retainHand(1)',
    aviary_38: 'gainOpenSkyGuard(1)',
    aviary_39: 'if fullCohesion then gainResonance(1)',
    wands_09: 'if targetHasCover then gainWingbeat(1)',
    swords_06: 'if cohesionBelowHalf then gainWingbeat(1)',
    swords_07: 'if targetWinded then gainResonance(1)',
    cups_06: 'retainHand(1)',
    cups_08: 'if fullCohesion then nextTurnDraw(1)',
    pentacles_06: 'if fullyBlocksNextAttack then gainWingbeat(1)',
    pentacles_08: 'if fullyBlocksNextAttack then retainHand(1)',
    aviary_32: 'if openSky then retainHand(1)',
    aviary_33: 'retainHand(1)',
    aviary_34: 'if cohesionBelowHalf then retainHand(1)',
    aviary_40: 'if targetHasCover then gainWingbeat(1)',
    aviary_41: 'if openSky then retainHand(1)',
    aviary_42: 'if flockSuit(basins,3) then heal(2)',
    wands_07: 'if targetIntendsAttack then gainWingbeat(1)',
    wands_10: 'if resonanceAtLeast(3) then nextTurnDraw(1)',
    wands_outrider: 'if spentResonance then gainWingbeat(1)',
    cups_09: 'if fullCohesion then gainOpenSkyGuard(1)',
    cups_outrider: 'if fullCohesion then gainWingbeat(1)',
    swords_08: 'if targetWinded then gainResonance(1)',
    swords_09: 'if targetIntendsAttack then gainWingbeat(1)',
    swords_outrider: 'if targetWinded then gainWingbeat(1)',
    pentacles_07: 'if fullyBlocksNextAttack then gainWingbeat(1)',
    pentacles_09: 'if openSky then retainHand(1)',
    pentacles_outrider: 'if fullyBlocksNextAttack then gainWingbeat(1)',
    aviary_35: 'if playedSuitThisTurn(plumes) then gainWingbeat(1)',
    wands_elder: 'if resonanceAtLeast(3) then gainWingbeat(1)',
    cups_10: 'if fullCohesion then retainHand(1)',
    cups_matron: 'if fullCohesion then gainWingbeat(1)',
    cups_elder: 'if fullCohesion then gainEnergyNextTurn(1)',
    swords_10: 'if defeatsEnemy then retainHand(1)',
    swords_matron: 'if windedAtLeast(3) then gainWingbeat(1)',
    swords_elder: 'if windedAtLeast(3) then gainWingbeat(1)',
    pentacles_10: 'if fullyBlocksNextAttack then retainHand(1)',
    pentacles_matron: 'if fullyBlocksNextAttack then gainWingbeat(1)',
    pentacles_elder: 'if fullyBlocksNextAttack then gainEnergyNextTurn(1)',
    major_01: 'if playedSuitThisTurn(plumes) then gainWingbeat(1)',
    major_02: 'if targetIntendsAttack then gainWingbeat(1)',
    major_03: 'if fullCohesion then retainHand(1)',
    major_04: 'if fullyBlocksNextAttack then gainWingbeat(1)',
    major_05: 'if firstPlayedThisCombat then gainWingbeat(1)',
    major_06: 'retainHand(1)',
    major_07: 'if targetBelowHalf then gainWingbeat(1)',
    major_08: 'if targetIntendsAttack then gainWingbeat(1)',
    major_10: 'retainHand(1)',
    major_11: 'if targetWinded then gainWingbeat(1)',
    major_12: 'if cohesionBelowHalf then retainHand(1)',
    major_14: 'if fullCohesion then gainWingbeat(1)',
    major_15: 'if spentResonance then gainWingbeat(1)',
    major_16: 'if firstPlayedThisCombat then gainWingbeat(1)',
    major_17: 'if cohesionBelowHalf then retainHand(1)',
    major_18: 'if targetIntendsAttack then gainWingbeat(1)',
    major_19: 'if firstPlayedThisCombat then retainHand(1)',
    major_20: 'if hasResonance then retainHand(1)',
    major_21: 'if openSky then gainWingbeat(1)',
    aviary_22: 'retainHand(1)',
    aviary_23: 'if fullCohesion then gainWingbeat(1)',
    aviary_24: 'if firstPlayedThisCombat then nextTurnDraw(1)',
    aviary_26: 'if fullCohesion then gainWingbeat(1)',
    aviary_27: 'if targetIntendsAttack then gainWingbeat(1)',
    wands_matron: 'if noResonance then gainWingbeat(1)',
  };

  expect(rewardCards).toHaveLength(90);
  expect(commonRewards).toHaveLength(24);
  expect(Object.fromEntries(['common', 'uncommon', 'rare', 'legendary'].map((rarity) => [
    rarity,
    rewardCards.filter((card: any) => card.rarity === rarity).length,
  ]))).toEqual({ common: 24, uncommon: 27, rare: 13, legendary: 26 });
  expect(rewardCards.every(changesDecision)).toBe(true);
  for (const [id, hook] of Object.entries(expectedHooks)) {
    const card = rewardCards.find((entry: any) => entry.id === id);
    expect(card?.upgrade.effects).toContain(hook);
  }
  const effectBody = (effect: string) => effect.replace(/^if .+? then /, '');
  const inferMoltTarget = (baseTarget: string, effects: string[] = []) => {
    const needsEnemy = effects.some((effect) => {
      const body = effectBody(effect);
      return /\b(?:damage|damagePierce|applyWinded|removeCover)\(target\b/.test(body)
        || /\b(?:resonanceBurst|windedBurst)\(/.test(body)
        || /\bperWinded\b/.test(body)
        || /\btarget(?:BelowHalf|IntendsAttack|HasCover|Winded)\b/.test(effect)
        || /\bwindedAtLeast\(/.test(effect);
    });
    if (needsEnemy) return 'enemy';
    if (effects.some((effect) => /\bdamageAll\(/.test(effectBody(effect)))) return 'allEnemies';
    if (baseTarget === 'choice') return 'choice';
    return baseTarget === 'none' ? 'none' : 'self';
  };
  const stanceOwners = new Map<string, { id: string; state: string; stance: string }>();
  const stanceCollisions: string[] = [];
  let authoredStanceCount = 0;
  for (const card of alphaCards.cards) {
    for (const upgraded of [false, true]) {
      const state = upgraded ? 'Preened' : 'base';
      const cost = upgraded && Number.isInteger(card.upgrade.cost) ? card.upgrade.cost : card.cost;
      const stances = [
        { stance: 'normal', target: card.target, effects: upgraded ? card.upgrade.effects : card.effects },
        {
          stance: 'Molt',
          target: inferMoltTarget(card.target, upgraded ? card.upgrade.moltEffects : card.moltEffects),
          effects: upgraded ? card.upgrade.moltEffects : card.moltEffects,
        },
      ];
      for (const stance of stances) {
        if (!stance.effects?.length) continue;
        authoredStanceCount += 1;
        const signature = JSON.stringify({ cost, target: stance.target, effects: stance.effects });
        const existing = stanceOwners.get(signature);
        if (existing && existing.id !== card.id) {
          stanceCollisions.push(`${card.id}:${state}:${stance.stance} = ${existing.id}:${existing.state}:${existing.stance}`);
        } else if (!existing) {
          stanceOwners.set(signature, { id: card.id, state, stance: stance.stance });
        }
      }
    }
  }
  expect(authoredStanceCount).toBe(420);
  expect(stanceCollisions).toEqual([]);
  const twinBasin = alphaCards.cards.find((card: any) => card.id === 'cups_02');
  const sharedNest = alphaCards.cards.find((card: any) => card.id === 'pentacles_06');
  const plumeMatron = alphaCards.cards.find((card: any) => card.id === 'wands_matron');
  expect(twinBasin.moltEffects[0]).toBe('if targetWinded then heal(2)');
  expect(twinBasin.upgrade.moltEffects[0]).toBe('if targetWinded then heal(3)');
  expect(sharedNest.moltEffects).toContain('if targetIntendsAttack then gainCover(2)');
  expect(sharedNest.upgrade.moltEffects).toContain('if targetIntendsAttack then gainCover(3)');
  expect(plumeMatron.effects[0]).toBe('if noResonance then gainWingbeat(1)');
  expect(plumeMatron.moltEffects).toContain('if spentResonance then gainWingbeat(1)');
  expect(plumeMatron.upgrade.moltEffects).toContain('if spentResonance then gainWingbeat(2)');

  const definitions = Object.fromEntries(rewardCards.map((card: any) => [card.id, card]));
  await boot(page);
  const result = await page.evaluate(async (cardDefinitions) => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && (!(scene.hand && scene.hand.length) || !scene.battleHandRendererModule); i += 1) await wait(50);
    const template = scene.hand[0];
    const enemy = scene.enemies[0];
    const originalEnemyMaxHp = enemy.maxHp;
    let instanceOrdinal = 0;
    const makeCard = (id: string, upgraded = true) => {
      const definition = (cardDefinitions as Record<string, any>)[id];
      return {
        ...template,
        id,
        instanceId: `common-preen-${id}-${instanceOrdinal += 1}`,
        name: definition.displayName,
        type: id.startsWith('aviary_') ? 'aviary' : definition.kind === 'legend' ? 'major' : definition.kind === 'molt' ? 'molt' : 'minor',
        role: definition.tags.includes('attack') ? 'attack' : definition.tags.some((tag: string) => ['cover', 'heal'].includes(tag)) ? 'skill' : 'utility',
        bird: definition.bird,
        cost: definition.cost,
        target: definition.target,
        upgraded,
        runtime: {
          ...template.runtime,
          ...definition,
          name: definition.displayName,
          displayName: definition.displayName,
          moltEffects: definition.moltEffects ?? [],
        },
      };
    };
    let fillerOrdinal = 0;
    const fillers = (count: number) => Array.from({ length: count }, () => ({
      ...template,
      instanceId: `common-preen-filler-${fillerOrdinal += 1}`,
    }));
    const reset = () => {
      scene.hand = [];
      scene.drawPile = [];
      scene.discardPile = [];
      scene.energy = 0;
      scene.spark = 0;
      scene.flock.flow = 0;
      scene.flock.hp = scene.flock.maxHp;
      scene.flock.block = 0;
      scene.flock.openSkyGuard = 0;
      scene.flock.exposed = false;
      scene.flock.molt = false;
      scene.nextTurnDrawBonus = 0;
      scene.nextTurnEnergyBonus = 0;
      scene.pendingNestCoverBonus = 0;
      scene.pendingRetainHand = 0;
      scene.playedCardIdsThisCombat.clear();
      scene.incomingNextAttackDamage = () => 99;
      enemy.maxHp = 10_000;
      enemy.hp = 10_000;
      enemy.block = 0;
      enemy.weak = 0;
    };

    reset();
    enemy.hp = 4_000;
    scene.resolveCardEffects(makeCard('swords_02'), enemy.id);
    const finisherBelowHalf = scene.energy;
    reset();
    enemy.hp = 8_000;
    scene.resolveCardEffects(makeCard('swords_02'), enemy.id);
    const finisherAboveHalf = scene.energy;

    reset();
    scene.spark = 1;
    scene.drawPile = fillers(2);
    scene.resolveCardEffects(makeCard('wands_03'), enemy.id);
    const horizonWithResonance = { energy: scene.energy, drawn: scene.hand.length, resonance: scene.spark };
    reset();
    scene.drawPile = fillers(2);
    scene.resolveCardEffects(makeCard('wands_03'), enemy.id);
    const horizonWithoutResonance = { energy: scene.energy, drawn: scene.hand.length, resonance: scene.spark };

    reset();
    const attackIntent = scene.checkCardCondition('targetIntendsAttack', makeCard('aviary_29'), enemy.id, {
      previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false,
    });
    const originalIntentIndex = enemy.intentIndex;
    const supportIntentIndex = enemy.runtime.moves.findIndex((move: any) => (
      !(move.effects ?? []).some((effect: string) => /(?:^| then )damage\(/.test(effect))
    ));
    if (supportIntentIndex >= 0) enemy.intentIndex = supportIntentIndex;
    const supportIntent = scene.checkCardCondition('targetIntendsAttack', makeCard('aviary_29'), enemy.id, {
      previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false,
    });
    enemy.intentIndex = originalIntentIndex;

    reset();
    enemy.block = 10;
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(makeCard('swords_04'), enemy.id);
    const sheathedCovered = {
      resonance: scene.spark,
      enemyCover: enemy.block,
      flockCover: scene.flock.block,
    };
    reset();
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(makeCard('swords_04'), enemy.id);
    const sheathedClean = { resonance: scene.spark, enemyCover: enemy.block };

    reset();
    enemy.block = 10;
    scene.resolveCardEffects(makeCard('swords_05'), enemy.id);
    const scatteredCovered = { resonance: scene.spark, nextDraw: scene.nextTurnDrawBonus, enemyCover: enemy.block };

    reset();
    enemy.block = 10;
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(makeCard('aviary_31'), enemy.id);
    const scavengerCovered = { resonance: scene.spark, energy: scene.energy, enemyCover: enemy.block, drawn: scene.hand.length };
    reset();
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(makeCard('aviary_31'), enemy.id);
    const scavengerClean = { resonance: scene.spark, energy: scene.energy, drawn: scene.hand.length };

    reset();
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(makeCard('cups_02'), enemy.id);
    const basinBondFull = { retain: scene.pendingRetainHand, nextEnergy: scene.nextTurnEnergyBonus };
    reset();
    scene.flock.hp = scene.flock.maxHp - 10;
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(makeCard('cups_02'), enemy.id);
    const basinBondLow = { retain: scene.pendingRetainHand, nextEnergy: scene.nextTurnEnergyBonus };

    reset();
    scene.flock.exposed = true;
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(makeCard('cups_04'), enemy.id);
    const closedBasinOpenSky = { drawn: scene.hand.length, guard: scene.flock.openSkyGuard };
    reset();
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(makeCard('cups_04'), enemy.id);
    const closedBasinSheltered = { drawn: scene.hand.length, guard: scene.flock.openSkyGuard };

    reset();
    scene.flock.hp = Math.floor(scene.flock.maxHp / 2) - 1;
    scene.resolveCardEffects(makeCard('pentacles_05'), enemy.id);
    const coldNestLow = scene.flock.openSkyGuard;
    reset();
    scene.resolveCardEffects(makeCard('pentacles_05'), enemy.id);
    const coldNestHealthy = scene.flock.openSkyGuard;

    reset();
    scene.incomingNextAttackDamage = () => 6;
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(makeCard('pentacles_02'), enemy.id);
    const nestJuggleBlocks = scene.energy;
    reset();
    scene.incomingNextAttackDamage = () => 99;
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(makeCard('pentacles_02'), enemy.id);
    const nestJuggleShort = scene.energy;

    reset();
    scene.resolveCardEffects(makeCard('aviary_36'), enemy.id);
    const drumlineOpening = scene.nextTurnDrawBonus;
    reset();
    scene.playedCardIdsThisCombat.add('aviary_36');
    scene.resolveCardEffects(makeCard('aviary_36'), enemy.id);
    const drumlineLater = scene.nextTurnDrawBonus;

    reset();
    scene.resolveCardEffects(makeCard('aviary_38'), enemy.id);
    const spiralShelteredGuard = scene.flock.openSkyGuard;

    reset();
    enemy.block = 10;
    scene.resolveCardEffects(makeCard('wands_09'), enemy.id);
    const barricadeCovered = {
      energy: scene.energy,
      enemyCover: enemy.block,
      flockCover: scene.flock.block,
      resonance: scene.spark,
    };
    reset();
    scene.resolveCardEffects(makeCard('wands_09'), enemy.id);
    const barricadeClean = { energy: scene.energy, enemyCover: enemy.block };

    reset();
    scene.flock.hp = Math.floor(scene.flock.maxHp / 2) + 1;
    scene.resolveCardEffects(makeCard('swords_06'), enemy.id);
    const crossingDropsLow = { energy: scene.energy, cohesion: scene.flock.hp };
    reset();
    scene.flock.hp = scene.flock.maxHp;
    scene.resolveCardEffects(makeCard('swords_06'), enemy.id);
    const crossingStaysHigh = { energy: scene.energy, cohesion: scene.flock.hp };

    reset();
    scene.incomingNextAttackDamage = () => 10;
    scene.resolveCardEffects(makeCard('pentacles_08'), enemy.id);
    const workshopBlocks = {
      cover: scene.flock.block,
      nextDraw: scene.nextTurnDrawBonus,
      retain: scene.pendingRetainHand,
    };
    reset();
    scene.incomingNextAttackDamage = () => 99;
    scene.resolveCardEffects(makeCard('pentacles_08'), enemy.id);
    const workshopShort = {
      cover: scene.flock.block,
      nextDraw: scene.nextTurnDrawBonus,
      retain: scene.pendingRetainHand,
    };

    reset();
    enemy.weak = 1;
    scene.resolveCardEffects(makeCard('swords_08'), enemy.id);
    const quillRingPrimed = { resonance: scene.spark, winded: enemy.weak };
    reset();
    scene.resolveCardEffects(makeCard('swords_08'), enemy.id);
    const quillRingClean = { resonance: scene.spark, winded: enemy.weak };

    reset();
    scene.spark = 2;
    scene.resolveCardEffects(makeCard('wands_outrider'), enemy.id);
    const plumeOutriderCharged = { energy: scene.energy, resonance: scene.spark };
    reset();
    scene.resolveCardEffects(makeCard('wands_outrider'), enemy.id);
    const plumeOutriderEmpty = { energy: scene.energy, resonance: scene.spark };

    reset();
    scene.spark = 3;
    scene.resolveCardEffects(makeCard('wands_elder'), enemy.id);
    const plumeElderCharged = scene.energy;
    reset();
    scene.resolveCardEffects(makeCard('wands_elder'), enemy.id);
    const plumeElderEmpty = scene.energy;

    reset();
    enemy.weak = 3;
    scene.resolveCardEffects(makeCard('swords_matron'), enemy.id);
    const quillMatronPrimed = { energy: scene.energy, winded: enemy.weak };
    reset();
    scene.resolveCardEffects(makeCard('swords_matron'), enemy.id);
    const quillMatronClean = { energy: scene.energy, winded: enemy.weak };

    reset();
    scene.incomingNextAttackDamage = () => 10;
    scene.resolveCardEffects(makeCard('pentacles_10'), enemy.id);
    const legacyNestBlocks = { cover: scene.flock.block, retain: scene.pendingRetainHand };
    reset();
    scene.incomingNextAttackDamage = () => 99;
    scene.resolveCardEffects(makeCard('pentacles_10'), enemy.id);
    const legacyNestShort = { cover: scene.flock.block, retain: scene.pendingRetainHand };

    reset();
    enemy.hp = 4_000;
    scene.resolveCardEffects(makeCard('major_07'), enemy.id);
    const diveLineBelowHalf = scene.energy;
    reset();
    enemy.hp = 8_000;
    scene.resolveCardEffects(makeCard('major_07'), enemy.id);
    const diveLineAboveHalf = scene.energy;

    reset();
    scene.spark = 2;
    scene.resolveCardEffects(makeCard('major_15'), enemy.id);
    const gleamTrapCharged = { energy: scene.energy, resonance: scene.spark };
    reset();
    scene.resolveCardEffects(makeCard('major_15'), enemy.id);
    const gleamTrapEmpty = { energy: scene.energy, resonance: scene.spark };

    reset();
    scene.resolveCardEffects(makeCard('major_19'), enemy.id);
    const morningBurstOpening = scene.pendingRetainHand;
    reset();
    scene.playedCardIdsThisCombat.add('major_19');
    scene.resolveCardEffects(makeCard('major_19'), enemy.id);
    const morningBurstLater = scene.pendingRetainHand;

    reset();
    scene.flock.exposed = true;
    scene.resolveCardEffects(makeCard('major_21'), enemy.id);
    const longLoopOpenSky = scene.energy;
    reset();
    scene.resolveCardEffects(makeCard('major_21'), enemy.id);
    const longLoopSheltered = scene.energy;

    reset();
    scene.drawPile = fillers(2);
    scene.resolveCardEffects(makeCard('wands_matron', false), enemy.id);
    const plumeMatronIgnites = { energy: scene.energy, resonance: scene.spark, drawn: scene.hand.length };
    reset();
    scene.spark = 1;
    scene.drawPile = fillers(2);
    scene.resolveCardEffects(makeCard('wands_matron', false), enemy.id);
    const plumeMatronExtends = { energy: scene.energy, resonance: scene.spark, drawn: scene.hand.length };

    reset();
    scene.spark = 2;
    scene.flock.molt = true;
    scene.resolveCardEffects(makeCard('wands_matron', false), enemy.id);
    const plumeMatronBaseMolt = { energy: scene.energy, resonance: scene.spark };
    reset();
    scene.spark = 2;
    scene.flock.molt = true;
    scene.resolveCardEffects(makeCard('wands_matron'), enemy.id);
    const plumeMatronPreenedMolt = { energy: scene.energy, resonance: scene.spark };

    reset();
    scene.flock.molt = true;
    scene.flock.hp = scene.flock.maxHp - 10;
    enemy.weak = 1;
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(makeCard('cups_02'), enemy.id);
    const twinBasinPrimedMolt = {
      cohesion: scene.flock.hp,
      winded: enemy.weak,
      drawn: scene.hand.length,
    };
    reset();
    scene.flock.molt = true;
    scene.flock.hp = scene.flock.maxHp - 10;
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(makeCard('cups_02'), enemy.id);
    const twinBasinCleanMolt = {
      cohesion: scene.flock.hp,
      winded: enemy.weak,
      drawn: scene.hand.length,
    };

    reset();
    enemy.intentIndex = originalIntentIndex;
    scene.flock.molt = true;
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(makeCard('pentacles_06'), enemy.id);
    const sharedNestAttackMolt = { cover: scene.flock.block, winded: enemy.weak, drawn: scene.hand.length };
    reset();
    if (supportIntentIndex >= 0) enemy.intentIndex = supportIntentIndex;
    scene.flock.molt = true;
    scene.drawPile = fillers(1);
    scene.resolveCardEffects(makeCard('pentacles_06'), enemy.id);
    const sharedNestSupportMolt = { cover: scene.flock.block, winded: enemy.weak, drawn: scene.hand.length };
    enemy.intentIndex = originalIntentIndex;

    reset();
    const previewCard = makeCard('swords_02');
    previewCard.text = 'Deal 4. If target below half: Deal 3.';
    previewCard.upgradedText = 'Deal 5. If target below half: Deal 4. If target below half: Gain 1 Wingbeat.';
    previewCard.moltText = 'Gain 4 Cover. If Cohesion below half: Gain 3 Cover.';
    previewCard.moltTextUpgraded = 'Gain 5 Cover. If Cohesion below half: Gain 4 Cover.';
    scene.hand = [previewCard];
    scene.drawPile = fillers(9);
    scene.energy = 3;
    scene.flock.hp = scene.flock.maxHp;
    enemy.maxHp = originalEnemyMaxHp;
    enemy.hp = Math.floor(originalEnemyMaxHp / 2) - 1;
    enemy.block = 0;
    scene.queueCardArtLoad([previewCard]);
    for (let i = 0; i < 40 && !scene.textures.exists('card-thumb-swords_02'); i += 1) await wait(50);
    scene.renderAll();
    scene.showCardPreview(previewCard);
    await wait(80);
    scene.openCombatCardDetail(previewCard);
    const readerText = scene.combatCardDetail.list.filter((child: any) => typeof child.text === 'string').map((child: any) => child.text);
    for (let i = 0; i < scene.combatCardDetail.getData('pageCount'); i += 1) {
      readerText.push(scene.combatCardDetail.getByName('combat-card-detail-body').text);
      scene.combatCardDetail.getData('changePage')(1);
    }
    const previewImages = (items: any[]): any[] => items.flatMap((child: any) => [
      ...(child.texture?.key ? [{
        key: child.texture.key,
        visible: child.visible,
        alpha: child.alpha,
        width: child.displayWidth,
        height: child.displayHeight,
      }] : []),
      ...(Array.isArray(child.list) ? previewImages(child.list) : []),
    ]);

    return {
      finisherBelowHalf,
      finisherAboveHalf,
      horizonWithResonance,
      horizonWithoutResonance,
      attackIntent,
      supportIntent,
      sheathedCovered,
      sheathedClean,
      scatteredCovered,
      scavengerCovered,
      scavengerClean,
      basinBondFull,
      basinBondLow,
      closedBasinOpenSky,
      closedBasinSheltered,
      coldNestLow,
      coldNestHealthy,
      nestJuggleBlocks,
      nestJuggleShort,
      drumlineOpening,
      drumlineLater,
      spiralShelteredGuard,
      barricadeCovered,
      barricadeClean,
      crossingDropsLow,
      crossingStaysHigh,
      workshopBlocks,
      workshopShort,
      quillRingPrimed,
      quillRingClean,
      plumeOutriderCharged,
      plumeOutriderEmpty,
      plumeElderCharged,
      plumeElderEmpty,
      quillMatronPrimed,
      quillMatronClean,
      legacyNestBlocks,
      legacyNestShort,
      diveLineBelowHalf,
      diveLineAboveHalf,
      gleamTrapCharged,
      gleamTrapEmpty,
      morningBurstOpening,
      morningBurstLater,
      longLoopOpenSky,
      longLoopSheltered,
      plumeMatronIgnites,
      plumeMatronExtends,
      plumeMatronBaseMolt,
      plumeMatronPreenedMolt,
      twinBasinPrimedMolt,
      twinBasinCleanMolt,
      sharedNestAttackMolt,
      sharedNestSupportMolt,
      previewText: readerText,
      previewImages: previewImages(scene.combatCardDetail?.list ?? []),
    };
  }, definitions);

  expect(result.finisherBelowHalf).toBe(1);
  expect(result.finisherAboveHalf).toBe(0);
  expect(result.horizonWithResonance).toEqual({ energy: 1, drawn: 2, resonance: 0 });
  expect(result.horizonWithoutResonance).toEqual({ energy: 0, drawn: 0, resonance: 0 });
  expect(result.attackIntent).toBe(true);
  expect(result.supportIntent).toBe(false);
  expect(result.sheathedCovered).toEqual({ resonance: 1, enemyCover: 4, flockCover: 5 });
  expect(result.sheathedClean).toEqual({ resonance: 0, enemyCover: 0 });
  expect(result.scatteredCovered).toEqual({ resonance: 1, nextDraw: 1, enemyCover: 2 });
  expect(result.scavengerCovered).toEqual({ resonance: 1, energy: 1, enemyCover: 5, drawn: 1 });
  expect(result.scavengerClean).toEqual({ resonance: 0, energy: 0, drawn: 1 });
  expect(result.basinBondFull).toEqual({ retain: 1, nextEnergy: 1 });
  expect(result.basinBondLow).toEqual({ retain: 0, nextEnergy: 0 });
  expect(result.closedBasinOpenSky).toEqual({ drawn: 1, guard: 2 });
  expect(result.closedBasinSheltered).toEqual({ drawn: 0, guard: 0 });
  expect(result.coldNestLow).toBe(1);
  expect(result.coldNestHealthy).toBe(0);
  expect(result.nestJuggleBlocks).toBe(1);
  expect(result.nestJuggleShort).toBe(0);
  expect(result.drumlineOpening).toBe(1);
  expect(result.drumlineLater).toBe(0);
  expect(result.spiralShelteredGuard).toBe(1);
  expect(result.barricadeCovered).toEqual({ energy: 1, enemyCover: 7, flockCover: 6, resonance: 2 });
  expect(result.barricadeClean).toEqual({ energy: 0, enemyCover: 0 });
  expect(result.crossingDropsLow).toEqual({ energy: 1, cohesion: 18 });
  expect(result.crossingStaysHigh).toEqual({ energy: 0, cohesion: 36 });
  expect(result.workshopBlocks).toEqual({ cover: 11, nextDraw: 1, retain: 1 });
  expect(result.workshopShort).toEqual({ cover: 11, nextDraw: 0, retain: 0 });
  expect(result.quillRingPrimed).toEqual({ resonance: 1, winded: 4 });
  expect(result.quillRingClean).toEqual({ resonance: 0, winded: 3 });
  expect(result.plumeOutriderCharged).toEqual({ energy: 1, resonance: 0 });
  expect(result.plumeOutriderEmpty).toEqual({ energy: 0, resonance: 0 });
  expect(result.plumeElderCharged).toBe(1);
  expect(result.plumeElderEmpty).toBe(0);
  expect(result.quillMatronPrimed).toEqual({ energy: 1, winded: 6 });
  expect(result.quillMatronClean).toEqual({ energy: 0, winded: 3 });
  expect(result.legacyNestBlocks).toEqual({ cover: 11, retain: 1 });
  expect(result.legacyNestShort).toEqual({ cover: 11, retain: 0 });
  expect(result.diveLineBelowHalf).toBe(1);
  expect(result.diveLineAboveHalf).toBe(0);
  expect(result.gleamTrapCharged).toEqual({ energy: 1, resonance: 0 });
  expect(result.gleamTrapEmpty).toEqual({ energy: 0, resonance: 0 });
  expect(result.morningBurstOpening).toBe(1);
  expect(result.morningBurstLater).toBe(0);
  expect(result.longLoopOpenSky).toBe(1);
  expect(result.longLoopSheltered).toBe(0);
  expect(result.plumeMatronIgnites).toEqual({ energy: 1, resonance: 2, drawn: 1 });
  expect(result.plumeMatronExtends).toEqual({ energy: 0, resonance: 3, drawn: 1 });
  expect(result.plumeMatronBaseMolt).toEqual({ energy: 1, resonance: 1 });
  expect(result.plumeMatronPreenedMolt).toEqual({ energy: 2, resonance: 1 });
  expect(result.twinBasinPrimedMolt).toEqual({ cohesion: 33, winded: 4, drawn: 1 });
  expect(result.twinBasinCleanMolt).toEqual({ cohesion: 28, winded: 3, drawn: 1 });
  expect(result.sharedNestAttackMolt).toEqual({ cover: 5, winded: 3, drawn: 1 });
  expect(result.sharedNestSupportMolt).toEqual({ cover: 0, winded: 3, drawn: 1 });
  expect(result.previewText).toContain('Crossed Quills+');
  expect(result.previewText.join(' ')).toContain('Preened');
  expect(result.previewText.join(' ')).toContain('Gain 1 Wingbeat');
  // The combat dossier now shows the large card face, illustration included.
  expect(result.previewImages.some((item: {key: string}) => /^card-(?:thumb-)?swords_02$/.test(item.key))).toBe(true);
  await page.screenshot({ path: '.artifacts/test-results/common-preen-crossed-quills.png' });
});

test('expanded supplies resolve tactical combat verbs', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const supplyIds = [
      'seed_packet',
      'signal_flare',
      'zip_tie_roll',
      'bottlecap_popper',
      'tar_solvent',
      'feather_splint',
      'mirror_shard',
      'emergency_call',
      'shade_cloth',
      'rooftop_decoy',
      'molt_pin',
      'wire_snips',
      'spare_harness',
      'signal_kite',
      'storm_lantern',
      'cache_key',
      'rain_cape',
      'return_ticket',
      'nest_clamp',
      'smoke_thread',
      'windcatcher_spool',
      'resonance_battery',
      'oath_ledger',
    ];
    const supplyTextureKeys = supplyIds.map((id) => `supply-thumb-${id}`);
    await window.__birdSquadStartScene!('BattleScene', {
      routeNodeId: 'm1_entry',
      runState: {
        deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'swords_ace' }, { id: 'cups_ace' }, { id: 'pentacles_04' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'expanded-supplies-art',
        currentHp: 36,
        scrap: 0,
        routeMarks: [],
        supplies: supplyIds,
        supplySlots: supplyIds.length,
        mapIndex: 0,
        completedRouteNodeIds: [],
        currentRouteNodeId: undefined,
        routeLog: [],
        nextCombat: undefined,
        signalChoices: [],
        rewardEvents: [],
        suppliesUsed: [],
        combatResults: [],
        freePreenNextDistrict: 0,
      }
    });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && (!(s.enemies && s.enemies.length) || !s.fxLayer); i += 1) await wait(50);
    s.queueCurrentSupplyArtLoad();
    for (let i = 0; i < 60 && !supplyTextureKeys.every((key) => s.textures.exists(key)); i += 1) await wait(100);
    const enemy = s.enemies[0];
    enemy.maxHp = 40;
    enemy.hp = 40;
    enemy.block = 12;
    enemy.weak = 0;
    s.selectedEnemyId = enemy.id;
    s.runSupplies = ['bottlecap_popper', 'tar_solvent', 'wire_snips', 'feather_splint', 'molt_pin', 'storm_lantern'];
    s.runSuppliesUsed = [];

    s.useSupply(0);
    const afterPierce = { hp: enemy.hp, block: enemy.block };
    s.useSupply(0);
    const afterSolvent = { hp: enemy.hp, block: enemy.block };
    s.useSupply(0);
    const afterSnips = { block: enemy.block, winded: enemy.weak };

    s.flock.hp = 20;
    s.flock.weak = 2;
    s.flock.frail = 1;
    s.flock.fouled = 2;
    s.useSupply(0);
    const afterSplint = { hp: s.flock.hp, weak: s.flock.weak, frail: s.flock.frail, fouled: s.flock.fouled };

    s.flock.molt = false;
    s.flock.openSkyGuard = 0;
    s.useSupply(0);
    const afterMolt = { molt: s.flock.molt, guard: s.flock.openSkyGuard };

    const beforeStorm = { energy: s.energy, hp: s.flock.hp, hand: s.hand.length };
    s.useSupply(0);
    const afterStorm = { energy: s.energy, hp: s.flock.hp, hand: s.hand.length };

    return {
      afterPierce,
      afterSolvent,
      afterSnips,
      afterSplint,
      afterMolt,
      beforeStorm,
      afterStorm,
      used: s.runSuppliesUsed,
      hasAllSupplyArt: supplyTextureKeys.every((key) => s.textures.exists(key)),
    };
  });
  expect(r.afterPierce.hp).toBe(35);
  expect(r.afterPierce.block).toBe(12);
  expect(r.afterSolvent.block).toBe(0);
  expect(r.afterSnips.block).toBe(0);
  expect(r.afterSnips.winded).toBe(2);
  expect(r.afterSplint.hp).toBe(24);
  expect(r.afterSplint.weak).toBe(1);
  expect(r.afterSplint.frail).toBe(0);
  expect(r.afterSplint.fouled).toBe(1);
  expect(r.afterMolt.molt).toBe(true);
  expect(r.afterMolt.guard).toBe(2);
  expect(r.afterStorm.energy).toBe(r.beforeStorm.energy + 2);
  expect(r.afterStorm.hp).toBe(r.beforeStorm.hp - 3);
  expect(r.afterStorm.hand).toBeGreaterThanOrEqual(r.beforeStorm.hand);
  expect(r.used).toEqual(['bottlecap_popper', 'tar_solvent', 'wire_snips', 'feather_splint', 'molt_pin', 'storm_lantern']);
  expect(r.hasAllSupplyArt).toBe(true);
});

test('new supplies and build-around Waymarks execute their scaling hooks', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const newSupplyIds = [
      'return_ticket',
      'nest_clamp',
      'smoke_thread',
      'windcatcher_spool',
      'resonance_battery',
      'oath_ledger',
    ];
    const newWaymarkIds = [
      'flock_counterweight',
      'supply_bell',
      'molt_metronome',
      'eave_bloom',
      'plumes_busker_patch',
      'quills_pressure_gauge',
      'basin_overflow_cup',
      'nest_ratchet',
    ];
    const newSupplyTextures = newSupplyIds.map((id) => `supply-thumb-${id}`);
    const newWaymarkTextures = newWaymarkIds.map((id) => `waymark-thumb-${id}`);
    await window.__birdSquadStartScene!('BattleScene', {
      routeNodeId: 'm1_entry',
      runState: {
        deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'swords_ace' }, { id: 'cups_ace' }, { id: 'pentacles_04' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'scaling-items-art',
        currentHp: 36,
        scrap: 0,
        routeMarks: newWaymarkIds,
        supplies: newSupplyIds,
        supplySlots: newSupplyIds.length,
        mapIndex: 0,
        completedRouteNodeIds: [],
        currentRouteNodeId: undefined,
        routeLog: [],
        nextCombat: undefined,
        signalChoices: [],
        rewardEvents: [],
        suppliesUsed: [],
        combatResults: [],
        freePreenNextDistrict: 0,
      }
    });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !(s.enemies && s.enemies.length && s.hand && s.hand.length && s.fxLayer); i += 1) await wait(50);
    s.queueCurrentSupplyArtLoad();
    s.queueCurrentWaymarkArtLoad();
    for (let i = 0; i < 60 && ![...newSupplyTextures, ...newWaymarkTextures].every((key) => s.textures.exists(key)); i += 1) await wait(100);

    const enemy = s.enemies[0];
    enemy.maxHp = 60;
    enemy.hp = 60;
    enemy.block = 0;
    enemy.weak = 0;
    s.selectedEnemyId = enemy.id;
    const map = (window as any).__birdSquadCurrentMap();
    const nestNode = map.nodes.find((node: any) => node.type === 'nest');

    const discarded = s.hand.pop();
    if (discarded) s.discardPile = [discarded];
    const handBeforeReturn = s.hand.length;
    s.runSupplies = ['return_ticket', 'nest_clamp', 'smoke_thread', 'windcatcher_spool', 'resonance_battery', 'oath_ledger'];
    s.runSuppliesUsed = [];
    s.scrap = 0;
    s.flock.hp = 30;
    s.flock.block = 0;
    s.spark = 0;
    s.nextTurnDrawBonus = 0;
    s.nextTurnEnergyBonus = 0;
    s.pendingNestCoverBonus = 0;
    s.pendingRetainHand = 0;
    s.completedRouteNodeIds = nestNode ? [nestNode.id] : [];

    s.useSupply(0);
    if (s.returnChoice && discarded) s.chooseReturnCard(discarded.instanceId);
    await wait(20);
    const afterReturn = { hand: s.hand.length, discard: s.discardPile.length };
    s.useSupply(0);
    const afterClamp = { block: s.flock.block, pendingNest: s.pendingNestCoverBonus, retain: s.pendingRetainHand, hadNestNode: !!nestNode };
    s.useSupply(0);
    const afterSmoke = { winded: enemy.weak, nextDraw: s.nextTurnDrawBonus };
    s.useSupply(0);
    const afterWindcatcher = { nextEnergy: s.nextTurnEnergyBonus };
    s.useSupply(0);
    const afterBattery = { hp: enemy.hp, spark: s.spark };
    const hpBeforeLedger = s.flock.hp;
    s.useSupply(0);
    const afterLedger = { scrap: s.scrap, hp: s.flock.hp, beforeHp: hpBeforeLedger };

    s.routeMarks = ['flock_counterweight', 'patched_shoulder_wrap', 'supply_bell'];
    s.flock.block = 0;
    s.energy = 3;
    s.nextTurnEnergyBonus = 0;
    s.pendingRetainHand = 0;
    s.markFiredThisCombat = new Set();
    s.checkRoostRestraintMarks(1, 1, 2);
    const afterCounterweight = {
      block: s.flock.block,
      nextEnergy: s.nextTurnEnergyBonus,
    };
    s.checkNoDamageTurnMarks();
    const afterShoulderWrap = {
      block: s.flock.block,
      retain: s.pendingRetainHand,
    };

    s.runSupplies = ['seed_packet'];
    s.runSuppliesUsed = [];
    if (s.drawPile.length === 0 && s.hand.length > 0) s.drawPile = [{ ...s.hand[0], instanceId: 'supply-bell-draw' }];
    s.pendingSupplyRepeats = 0;
    const handBeforeBell = s.hand.length;
    s.useSupply(0);
    const afterBell = { hand: s.hand.length, repeats: s.pendingSupplyRepeats };

    s.routeMarks = ['molt_metronome', 'eave_bloom'];
    s.markFiredThisCombat = new Set();
    s.flock.molt = false;
    s.flock.block = 0;
    if (s.drawPile.length === 0 && s.hand.length > 0) s.drawPile = [s.hand[0]];
    const handBeforeMolt = s.hand.length;
    s.enterMolt('test');
    const afterMoltMarks = { hand: s.hand.length, block: s.flock.block };

    s.routeMarks = ['plumes_busker_patch', 'quills_pressure_gauge', 'nest_ratchet'];
    s.markFiredThisTurn = new Set();
    s.spark = 0;
    enemy.hp = 20;
    s.pendingNestCoverBonus = 0;
    s.checkSuitPlayedMarks('plumes');
    s.checkSuitPlayedMarks('quills');
    s.checkSuitPlayedMarks('nests');
    const afterSuitMarks = { spark: s.spark, hp: enemy.hp, pendingNest: s.pendingNestCoverBonus };

    s.routeMarks = ['basin_overflow_cup'];
    s.markFiredThisTurn = new Set();
    s.flock.hp = 20;
    s.flock.block = 0;
    s.healFlock(2, 'test heal');
    const afterHealMark = { hp: s.flock.hp, block: s.flock.block };

    return {
      hasNewSupplyArt: newSupplyTextures.every((key) => s.textures.exists(key)),
      hasNewWaymarkArt: newWaymarkTextures.every((key) => s.textures.exists(key)),
      handBeforeReturn,
      afterReturn,
      afterClamp,
      afterSmoke,
      afterWindcatcher,
      afterBattery,
      afterLedger,
      afterCounterweight,
      afterShoulderWrap,
      handBeforeBell,
      afterBell,
      handBeforeMolt,
      afterMoltMarks,
      afterSuitMarks,
      afterHealMark,
    };
  });
  expect(r.hasNewSupplyArt).toBe(true);
  expect(r.hasNewWaymarkArt).toBe(true);
  expect(r.afterReturn.hand).toBeGreaterThanOrEqual(r.handBeforeReturn + 1);
  expect(r.afterReturn.discard).toBe(0);
  expect(r.afterClamp.hadNestNode).toBe(true);
  expect(r.afterClamp.block).toBeGreaterThanOrEqual(8);
  expect(r.afterClamp.pendingNest).toBe(16);
  expect(r.afterClamp.retain).toBe(2);
  expect(r.afterSmoke.winded).toBe(6);
  expect(r.afterSmoke.nextDraw).toBe(2);
  expect(r.afterWindcatcher.nextEnergy).toBe(4);
  expect(r.afterBattery.hp).toBe(48);
  expect(r.afterBattery.spark).toBe(0);
  expect(r.afterLedger.scrap).toBe(50);
  expect(r.afterLedger.hp).toBe(r.afterLedger.beforeHp - 4);
  expect(r.afterCounterweight.block).toBe(3);
  expect(r.afterCounterweight.nextEnergy).toBe(1);
  expect(r.afterShoulderWrap.block).toBe(7);
  expect(r.afterShoulderWrap.retain).toBe(1);
  expect(r.afterBell.hand).toBeGreaterThanOrEqual(r.handBeforeBell + 1);
  expect(r.afterBell.repeats).toBe(1);
  expect(r.afterMoltMarks.hand).toBeGreaterThanOrEqual(r.handBeforeMolt + 1);
  expect(r.afterMoltMarks.block).toBe(6);
  expect(r.afterSuitMarks.spark).toBe(1);
  expect(r.afterSuitMarks.hp).toBe(18);
  expect(r.afterSuitMarks.pendingNest).toBe(4);
  expect(r.afterHealMark.hp).toBe(22);
  expect(r.afterHealMark.block).toBe(4);
});

test('next item pass supplies and Waymarks execute route and combat hooks', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const nextSupplies = [
      'map_sticker_strip',
      'thermos_lid',
      'bus_token_cache',
      'chalk_dust_pouch',
      'market_iou',
      'sky_sugar',
      'anchor_threader',
      'spare_pocket',
    ];
    const nextWaymarks = [
      'broken_cover_chime',
      'spark_ground_clip',
      'quiet_roost_token',
      'double_packed_buckle',
      'ledger_tab',
      'basin_safety_pin',
      'nest_measure_line',
      'plumes_applause_cap',
      'molt_shadow_tag',
      'cache_divining_hook',
    ];
    const mkRunState = (patch: any = {}) => ({
      deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'cups_ace' }, { id: 'swords_ace' }, { id: 'pentacles_04' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed: 'next-items-test',
      currentHp: 24,
      scrap: 12,
      routeMarks: [],
      supplies: [],
      supplySlots: 2,
      mapIndex: 0,
      completedRouteNodeIds: [],
      currentRouteNodeId: undefined,
      routeLog: [],
      nextCombat: undefined,
      signalChoices: [],
      rewardEvents: [],
      suppliesUsed: [],
      combatResults: [],
      freePreenNextDistrict: 0,
      ...patch,
    });

    await window.__birdSquadStartScene!('RouteScene', {
      runState: mkRunState({
        currentHp: 20,
        routeMarks: ['ledger_tab', 'cache_divining_hook'],
        supplies: ['spare_pocket', 'map_sticker_strip', 'thermos_lid', 'market_iou'],
        supplySlots: 4,
      })
    });
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 40 && !(window as any).render_game_to_text; i += 1) await wait(50);
    const routeSupplyKeys = ['supply-thumb-spare_pocket', 'supply-thumb-map_sticker_strip', 'supply-thumb-thermos_lid', 'supply-thumb-market_iou'];
    route.queueRouteSupplyArtLoad();
    for (let i = 0; i < 60 && !routeSupplyKeys.every((key) => route.textures.exists(key)); i += 1) await wait(100);

    route.useRouteSupply(0);
    const afterPocketText = JSON.parse((window as any).render_game_to_text());
    const afterPocket = {
      slots: route.runState.supplySlots,
      used: [...route.runState.suppliesUsed],
      feedback: afterPocketText.supplyFeedback?.[0],
    };
    route.useRouteSupply(0);
    const afterStickerText = JSON.parse((window as any).render_game_to_text());
    const afterSticker = {
      scrap: route.runState.scrap,
      used: [...route.runState.suppliesUsed],
      planLogged: route.runState.routeLog.some((line: string) => /Route plan set/.test(line)),
      feedback: afterStickerText.supplyFeedback?.[0],
    };
    route.useRouteSupply(0);
    const afterThermos = {
      hp: route.runState.currentHp,
      guard: route.runState.nextCombat?.openSkyGuard ?? 0,
      used: [...route.runState.suppliesUsed],
    };
    route.useRouteSupply(0);
    const afterIou = {
      hp: route.runState.currentHp,
      scrap: route.runState.scrap,
      freePreen: route.runState.freePreenNextDistrict ?? 0,
      used: [...route.runState.suppliesUsed],
    };
    route.runState.scrap = 12;
    route.runState.nextCombat = undefined;
    route.applyRouteMarkTrigger('afterMarketPurchase');
    const afterLedger = { scrap: route.runState.scrap, guard: route.runState.nextCombat?.openSkyGuard ?? 0 };
    route.runState.supplies = [];
    route.runState.supplySlots = 4;
    route.applyRouteMarkTrigger('cacheChoice');
    const afterCacheHook = { supplies: route.runState.supplies.length };

    const routeMap = (window as any).__birdSquadCurrentMap();
    const marketNode = routeMap.nodes.find((node: any) => node.type === 'market');
    route.runState.supplies = ['market_iou'];
    route.runState.suppliesUsed = [];
    route.runState.currentHp = 20;
    route.runState.scrap = 12;
    route.runState.freePreenNextDistrict = 0;
    route.runState.completedRouteNodeIds = marketNode ? [marketNode.id] : [];
    route.useRouteSupply(0);
    const afterIouAfterMarket = {
      hadMarketNode: !!marketNode,
      hp: route.runState.currentHp,
      scrap: route.runState.scrap,
      freePreen: route.runState.freePreenNextDistrict ?? 0,
    };

    const signalNode = routeMap.nodes.find((node: any) => node.type === 'signal');
    route.runState.supplies = ['bus_token_cache'];
    route.runState.suppliesUsed = [];
    route.runState.supplySlots = 4;
    route.runState.scrap = 12;
    route.runState.completedRouteNodeIds = signalNode ? [signalNode.id] : [];
    route.useRouteSupply(0);
    const afterBusAfterSignal = {
      hadSignalNode: !!signalNode,
      scrap: route.runState.scrap,
      supplies: route.runState.supplies.length,
      planLogged: route.runState.routeLog.some((line: string) => /Route plan set/.test(line)),
    };

    const basinNode = routeMap.nodes.find((node: any) => node.type === 'basin');
    route.runState.supplies = ['seed_packet'];
    route.runState.suppliesUsed = [];
    route.runState.currentHp = 20;
    route.runState.completedRouteNodeIds = basinNode ? [basinNode.id] : [];
    route.useRouteSupply(0);
    const afterSeedAfterBasin = {
      hadBasinNode: !!basinNode,
      hp: route.runState.currentHp,
    };

    await window.__birdSquadStartScene!('BattleScene', {
      routeNodeId: 'm1_entry',
      runState: mkRunState({
        currentHp: 32,
        routeMarks: nextWaymarks,
        supplies: nextSupplies,
        supplySlots: 8,
      })
    });
    g.scene.stop('RouteScene');
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(battle.enemies && battle.enemies.length && battle.hand && battle.hand.length); i += 1) await wait(50);
    const textureKeys = [
      ...nextSupplies.map((id) => `supply-thumb-${id}`),
      ...nextWaymarks.map((id) => `waymark-thumb-${id}`),
    ];
    battle.queueCurrentSupplyArtLoad();
    battle.queueCurrentWaymarkArtLoad();
    for (let i = 0; i < 100 && !textureKeys.every((key) => battle.textures.exists(key)); i += 1) await wait(100);

    const enemy = battle.enemies[0];
    enemy.maxHp = 60;
    enemy.hp = 60;
    enemy.block = 6;
    battle.selectedEnemyId = enemy.id;
    const filler = battle.hand[0] ?? battle.drawPile[0] ?? battle.discardPile[0];
    if (filler) {
      for (let i = battle.drawPile.length; i < 10; i += 1) {
        battle.drawPile.push({ ...filler, instanceId: `test-draw-${i}` });
      }
    }

    battle.routeMarks = ['broken_cover_chime'];
    battle.markFiredThisTurn = new Set();
    battle.runSupplies = ['chalk_dust_pouch', 'sky_sugar', 'anchor_threader'];
    battle.runSuppliesUsed = [];
    battle.energy = 3;
    battle.spark = 0;
    battle.flock.block = 0;
    battle.pendingRetainHand = 0;
    battle.nextTurnDrawBonus = 0;
    const handBeforeChalk = battle.hand.length;
    battle.useSupply(0);
    const afterChalkState = (window as any).__birdSquadState();
    const afterChalk = {
      block: enemy.block,
      hand: battle.hand.length,
      beforeHand: handBeforeChalk,
      spark: battle.spark,
      feedback: afterChalkState.supplyFeedback?.[0],
      waymarkFeedback: afterChalkState.waymarkFeedback?.[0],
    };
    const handBeforeSugar = battle.hand.length;
    battle.useSupply(0);
    const afterSugar = { energy: battle.energy, nextDraw: battle.nextTurnDrawBonus, hand: battle.hand.length, beforeHand: handBeforeSugar };
    battle.useSupply(0);
    const afterAnchor = { block: battle.flock.block, retain: battle.pendingRetainHand, pendingNest: battle.pendingNestCoverBonus };

    const map = (window as any).__birdSquadCurrentMap();
    const cacheNode = map.nodes.find((node: any) => node.type === 'cache');
    battle.completedRouteNodeIds = cacheNode ? [cacheNode.id] : [];
    battle.runSupplies = ['cache_key'];
    battle.runSuppliesUsed = [];
    battle.flock.block = 0;
    const handBeforeCacheKey = battle.hand.length;
    battle.useSupply(0);
    const afterCacheKey = {
      block: battle.flock.block,
      hand: battle.hand.length,
      beforeHand: handBeforeCacheKey,
      hadCacheNode: !!cacheNode,
    };

    battle.routeMarks = ['spark_ground_clip'];
    battle.markFiredThisCombat = new Set();
    battle.spark = 2;
    battle.flock.block = 0;
    battle.spendResonance(1);
    const afterSparkClip = { spark: battle.spark, block: battle.flock.block };

    battle.routeMarks = ['quiet_roost_token'];
    battle.markFiredThisCombat = new Set();
    battle.flock.maxHp = 40;
    battle.flock.hp = 20;
    battle.checkNoDamageTurnMarks();
    const afterQuietRoost = { hp: battle.flock.hp };

    battle.routeMarks = ['double_packed_buckle'];
    battle.markFiredThisCombat = new Set();
    battle.pendingSupplyRepeats = 0;
    const energyBeforeBuckle = battle.energy;
    battle.checkSupplyUsedMarks();
    const afterDoublePacked = { pending: battle.pendingSupplyRepeats, energy: battle.energy, beforeEnergy: energyBeforeBuckle };
    battle.routeMarks = [];
    battle.runSupplies = ['seed_packet'];
    battle.runSuppliesUsed = [];
    battle.flock.hp = 20;
    battle.useSupply(0);
    const afterRepeatedState = (window as any).__birdSquadState();
    const afterRepeatedSupply = {
      hp: battle.flock.hp,
      pending: battle.pendingSupplyRepeats,
      feedback: afterRepeatedState.supplyFeedback?.[0],
    };

    battle.routeMarks = ['basin_safety_pin'];
    battle.markFiredThisTurn = new Set();
    battle.flock.hp = 20;
    battle.flock.block = 0;
    battle.flock.weak = 2;
    battle.flock.frail = 2;
    battle.flock.fouled = 2;
    battle.healFlock(2, 'test heal');
    const afterSafetyPin = { hp: battle.flock.hp, block: battle.flock.block, weak: battle.flock.weak, frail: battle.flock.frail, fouled: battle.flock.fouled };

    battle.routeMarks = ['nest_measure_line'];
    battle.markFiredThisTurn = new Set();
    battle.pendingRetainHand = 0;
    battle.pendingNestCoverBonus = 0;
    battle.checkSuitPlayedMarks('nests');
    const afterMeasureLine = { retain: battle.pendingRetainHand, pendingNest: battle.pendingNestCoverBonus };

    battle.routeMarks = ['plumes_applause_cap'];
    battle.markFiredThisCombat = new Set();
    battle.cardsPlayedThisTurn = 2;
    battle.spark = 0;
    battle.nextTurnDrawBonus = 0;
    battle.checkRoostRestraintMarks(0, 0, 2);
    const afterApplauseCap = { spark: battle.spark, nextDraw: battle.nextTurnDrawBonus };

    battle.routeMarks = ['molt_shadow_tag'];
    battle.markFiredThisCombat = new Set();
    battle.flock.molt = false;
    battle.flock.openSkyGuard = 0;
    battle.enterMolt('test molt');
    const afterShadowTag = { guard: battle.flock.openSkyGuard };

    return {
      hasRouteSupplyArt: routeSupplyKeys.every((key) => route.textures.exists(key)),
      hasNextPassArt: textureKeys.every((key) => battle.textures.exists(key)),
      afterPocket,
      afterSticker,
      afterThermos,
      afterIou,
      afterLedger,
      afterCacheHook,
      afterIouAfterMarket,
      afterBusAfterSignal,
      afterSeedAfterBasin,
      afterChalk,
      afterSugar,
      afterAnchor,
      afterCacheKey,
      afterSparkClip,
      afterQuietRoost,
      afterDoublePacked,
      afterRepeatedSupply,
      afterSafetyPin,
      afterMeasureLine,
      afterApplauseCap,
      afterShadowTag,
    };
  });
  expect(r.hasRouteSupplyArt).toBe(true);
  expect(r.hasNextPassArt).toBe(true);
  expect(r.afterPocket.slots).toBe(5);
  expect(r.afterPocket.used).toContain('spare_pocket');
  expect(r.afterPocket.feedback.id).toBe('spare_pocket');
  expect(r.afterPocket.feedback.summary).toContain('Supply capacity');
  expect(r.afterSticker.planLogged).toBe(true);
  expect(r.afterSticker.scrap).toBe(27);
  expect(r.afterSticker.feedback.id).toBe('map_sticker_strip');
  expect(r.afterSticker.feedback.summary).toContain('Open Sky Guard');
  expect(r.afterThermos.hp).toBe(25);
  expect(r.afterThermos.guard).toBe(2);
  expect(r.afterIou.hp).toBe(24);
  expect(r.afterIou.scrap).toBe(47);
  expect(r.afterIou.freePreen).toBe(1);
  expect(r.afterLedger.scrap).toBe(24);
  expect(r.afterLedger.guard).toBe(2);
  expect(r.afterCacheHook.supplies).toBe(1);
  expect(r.afterIouAfterMarket.hadMarketNode).toBe(true);
  expect(r.afterIouAfterMarket.hp).toBe(20);
  expect(r.afterIouAfterMarket.scrap).toBe(32);
  expect(r.afterIouAfterMarket.freePreen).toBe(1);
  expect(r.afterBusAfterSignal.hadSignalNode).toBe(true);
  expect(r.afterBusAfterSignal.scrap).toBe(32);
  expect(r.afterBusAfterSignal.supplies).toBe(1);
  expect(r.afterBusAfterSignal.planLogged).toBe(true);
  expect(r.afterSeedAfterBasin.hadBasinNode).toBe(true);
  expect(r.afterSeedAfterBasin.hp).toBe(28);
  expect(r.afterChalk.block).toBe(0);
  expect(r.afterChalk.hand).toBeGreaterThanOrEqual(r.afterChalk.beforeHand + 1);
  expect(r.afterChalk.feedback.id).toBe('chalk_dust_pouch');
  expect(r.afterChalk.feedback.summary).toContain('Remove');
  expect(r.afterChalk.waymarkFeedback.id).toBe('broken_cover_chime');
  expect(r.afterChalk.spark).toBe(1);
  expect(r.afterSugar.energy).toBe(4);
  expect(r.afterSugar.nextDraw).toBe(1);
  expect(r.afterSugar.hand).toBeGreaterThanOrEqual(r.afterSugar.beforeHand + 1);
  expect(r.afterAnchor.block).toBeGreaterThanOrEqual(6);
  expect(r.afterAnchor.retain).toBe(1);
  expect(r.afterAnchor.pendingNest).toBe(3);
  expect(r.afterCacheKey.hadCacheNode).toBe(true);
  expect(r.afterCacheKey.block).toBeGreaterThanOrEqual(8);
  expect(r.afterCacheKey.hand).toBeGreaterThanOrEqual(r.afterCacheKey.beforeHand + 2);
  expect(r.afterSparkClip.spark).toBe(1);
  expect(r.afterSparkClip.block).toBe(7);
  expect(r.afterQuietRoost.hp).toBe(23);
  expect(r.afterDoublePacked.pending).toBe(1);
  expect(r.afterDoublePacked.energy).toBe(r.afterDoublePacked.beforeEnergy + 1);
  expect(r.afterRepeatedSupply.hp).toBe(32);
  expect(r.afterRepeatedSupply.pending).toBe(0);
  expect(r.afterRepeatedSupply.feedback.id).toBe('seed_packet');
  expect(r.afterRepeatedSupply.feedback.summary).toContain('x2');
  expect(r.afterSafetyPin.hp).toBe(22);
  expect(r.afterSafetyPin.block).toBe(3);
  expect(r.afterSafetyPin.weak).toBe(1);
  expect(r.afterSafetyPin.frail).toBe(1);
  expect(r.afterSafetyPin.fouled).toBe(1);
  expect(r.afterMeasureLine.retain).toBe(1);
  expect(r.afterMeasureLine.pendingNest).toBe(3);
  expect(r.afterApplauseCap.spark).toBe(1);
  expect(r.afterApplauseCap.nextDraw).toBe(1);
  expect(r.afterShadowTag.guard).toBe(2);
});

test('Cover and Heal are distinct axes, and the new card verbs work', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && (!(s.hand && s.hand.length) || !s.fxLayer); i += 1) await wait(50);
    const card = s.hand[0];
    const enemy = s.enemies[0];
    const mkState = () => ({ previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false });
    s.flock.flow = 0; s.flock.molt = false;

    // Plain heal at full Cohesion is WASTED (no overflow to Cover).
    s.flock.maxHp = 40; s.flock.hp = 40; s.flock.block = 0;
    s.resolveCardEffect('heal(5)', card, enemy.id, mkState());
    const coverAfterPlainHeal = s.flock.block;

    // overhealCover converts the overflow to Cover.
    s.flock.hp = 40; s.flock.block = 0;
    s.resolveCardEffect('overhealCover(5)', card, enemy.id, mkState());
    const coverAfterOverheal = s.flock.block;

    // perCover damage scales with current Cover.
    s.flock.block = 6; enemy.block = 0; enemy.maxHp = 500; enemy.hp = 500;
    s.resolveCardEffect('damage(target, 1 perCover)', card, enemy.id, mkState());
    const perCoverDamage = 500 - enemy.hp;

    // loseCohesion is a self-cost, clamped to a minimum of 1.
    s.flock.hp = 3;
    s.resolveCardEffect('loseCohesion(10)', card, enemy.id, mkState());
    const hpAfterLose = s.flock.hp;

    return { coverAfterPlainHeal, coverAfterOverheal, perCoverDamage, hpAfterLose };
  });
  expect(r.coverAfterPlainHeal).toBe(0);                 // heal no longer makes Cover at full
  expect(r.coverAfterOverheal).toBeGreaterThanOrEqual(5); // overhealCover does
  expect(r.perCoverDamage).toBeGreaterThanOrEqual(6);     // 1 x 6 Cover (+ deck damage)
  expect(r.hpAfterLose).toBe(1);                         // loseCohesion clamps to 1
});

test('new balance verbs: timed Waymarks, self-loop cards, and anti-Cover conditionals', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && (!(s.hand && s.hand.length) || !s.fxLayer); i += 1) await wait(50);
    const card = s.hand[0];
    const enemy = s.enemies[0];

    s.routeMarks = ['wind_step_tag'];
    s.markFiredThisCombat = new Set();
    s.energy = 3;
    s.nextTurnEnergyBonus = 0;
    s.checkRoostRestraintMarks(1, 0, 2);
    const nextEnergyAfterHeldCardRoost = s.nextTurnEnergyBonus;

    s.routeMarks = ['fresh_pinfeather'];
    s.markFiredThisCombat = new Set();
    s.nextTurnEnergyBonus = 0;
    const energyBeforeMolt = s.energy;
    s.checkEnterMoltMarks();
    const immediateEnergyAfterMolt = s.energy - energyBeforeMolt;

    const fakeLoopCard = {
      ...card,
      runtime: {
        ...card.runtime,
        effects: ['shuffleSelfToDraw()'],
        upgrade: { ...card.runtime.upgrade, effects: ['shuffleSelfToDraw()'] }
      },
      upgraded: false
    };
    const loopOutcome = s.resolveCardEffects(fakeLoopCard, enemy.id);

    s.fxLayer.removeAll(true);
    s.combatCoverShatterBursts = 0;
    enemy.block = 5;
    enemy.maxHp = 50;
    enemy.hp = 50;
    const fakeShatterCard = {
      ...card,
      runtime: {
        ...card.runtime,
        effects: ['removeCover(target, 2)'],
        upgrade: { ...card.runtime.upgrade, effects: ['removeCover(target, 3)'] }
      },
      upgraded: false
    };
    s.resolveCardEffect('removeCover(target, 2)', fakeShatterCard, enemy.id, {
      previousDiscarded: 0,
      previousDamageDefeated: false,
      spentResonance: false,
      returnSelfToDraw: false,
      exhaustSelf: false,
      builtFlow: false,
      flockDamageBonusUsed: false
    });
    const coverShatterState = window.__birdSquadState!().combatCoverShatter;

    s.fxLayer.removeAll(true);
    enemy.block = 5;
    enemy.maxHp = 50;
    enemy.hp = 50;
    const fakeBreakerCard = {
      ...card,
      runtime: {
        ...card.runtime,
        effects: [
          'if targetHasCover then removeCover(target, 2)',
          'if targetHasCover then damagePierce(target, 2)'
        ],
        upgrade: {
          ...card.runtime.upgrade,
          effects: [
            'if targetHasCover then removeCover(target, 3)',
            'if targetHasCover then damagePierce(target, 3)'
          ]
        }
      },
      upgraded: false
    };
    s.resolveCardEffects(fakeBreakerCard, enemy.id);

    return {
      nextEnergyAfterHeldCardRoost,
      immediateEnergyAfterMolt,
      returnSelfToDraw: loopOutcome.returnSelfToDraw,
      enemyBlockAfterBreaker: enemy.block,
      enemyHpAfterBreaker: enemy.hp,
      combatCoverShatter: coverShatterState
    };
  });
  expect(r.nextEnergyAfterHeldCardRoost).toBe(1);
  expect(r.immediateEnergyAfterMolt).toBe(1);
  expect(r.returnSelfToDraw).toBe(true);
  expect(r.enemyBlockAfterBreaker).toBe(3);
  expect(r.enemyHpAfterBreaker).toBeLessThanOrEqual(48);
  expect(r.combatCoverShatter.loaded).toBe(true);
  expect(r.combatCoverShatter.rendered).toBe(true);
  expect(r.combatCoverShatter.count).toBeGreaterThanOrEqual(1);
  expect(r.combatCoverShatter.bursts).toBeGreaterThanOrEqual(1);
});

test('Molt is a do-DIFFERENT transform stance: a card resolves its molt ability while Molting', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && (!(s.hand && s.hand.length) || !s.combatPreviewModule); i += 1) await wait(50);
    // Locked Nest (in the Fledgling deck): normal = gainCover(6), Molt = damage.
    const nest = [...s.drawPile, ...s.hand, ...s.discardPile].find((c: any) => c.id === 'pentacles_04');
    const enemy = s.enemies[0];

    const hasMoltText = !!(nest && nest.moltText);
    const moltCueBefore = window.__birdSquadState!().audio?.cueRequests?.moltPower ?? 0;

    // Normal mode: gains Cover, deals no damage.
    s.flock.flow = 0; s.flock.molt = false; s.flock.block = 0;
    enemy.block = 0; enemy.maxHp = 500; enemy.hp = 500;
    const normalResolution = s.resolveCardEffects(nest, enemy.id);
    const moltCueAfterNormal = window.__birdSquadState!().audio?.cueRequests?.moltPower ?? 0;
    const coverNormal = s.flock.block;
    const dmgNormal = 500 - enemy.hp;

    // Molt mode: the wall lashes out — deals damage, no Cover.
    s.flock.molt = true; s.flock.block = 0; enemy.hp = 500;
    const baseMoltPower = s.activeMoltPower();
    const basePreview = s.simulateCardOutcome(nest, enemy.id);
    const moltResolution = s.resolveCardEffects(nest, enemy.id);
    const moltCueAfterBase = window.__birdSquadState!().audio?.cueRequests?.moltPower ?? 0;
    const coverMolt = s.flock.block;
    const dmgMolt = 500 - enemy.hp;

    // A deck stat carrier proves Molt Power is not merely a fixed display value.
    s.discardPile.push({
      ...nest,
      id: 'molt_power_test_carrier',
      instanceId: 'molt_power_test_carrier_1',
      runtime: {
        ...nest.runtime,
        id: 'molt_power_test_carrier',
        flockStats: { ...nest.runtime.flockStats, moltPower: 2 },
      },
    });
    enemy.hp = 500;
    const poweredMoltPower = s.activeMoltPower();
    const poweredPreview = s.simulateCardOutcome(nest, enemy.id);
    const poweredResolution = s.resolveCardEffects(nest, enemy.id);
    const moltCueAfterPowered = window.__birdSquadState!().audio?.cueRequests?.moltPower ?? 0;
    const dmgPowered = 500 - enemy.hp;
    const feedback = window.__birdSquadState!().combatMoltPower;

    return {
      hasMoltText,
      moltCueBefore,
      moltCueAfterNormal,
      moltCueAfterBase,
      moltCueAfterPowered,
      coverNormal,
      dmgNormal,
      normalMoltPowerApplied: normalResolution.moltApplied,
      coverMolt,
      dmgMolt,
      baseMoltPower,
      basePreviewDamage: basePreview.enemyDamage,
      basePreviewMoltPower: basePreview.moltPowerApplied,
      baseResolutionMoltPower: moltResolution.moltApplied,
      poweredMoltPower,
      poweredPreviewDamage: poweredPreview.enemyDamage,
      poweredPreviewMoltPower: poweredPreview.moltPowerApplied,
      poweredResolutionMoltPower: poweredResolution.moltApplied,
      dmgPowered,
      feedback,
    };
  });
  expect(r.hasMoltText).toBe(true);                 // every card has a molt ability
  expect(r.coverNormal).toBeGreaterThanOrEqual(6);  // normal: gains Cover
  expect(r.dmgNormal).toBe(0);                      // normal: no damage
  expect(r.coverMolt).toBe(0);                      // molt: no Cover (does DIFFERENT)
  expect(r.dmgMolt).toBeGreaterThanOrEqual(7);      // molt: deals damage instead
  expect(r.normalMoltPowerApplied).toBe(0);
  expect(r.moltCueAfterNormal).toBe(r.moltCueBefore);
  expect(r.moltCueAfterBase).toBe(r.moltCueBefore + 1);
  expect(r.moltCueAfterPowered).toBe(r.moltCueBefore + 2);
  expect(r.baseMoltPower).toBeGreaterThanOrEqual(2);
  expect(r.basePreviewDamage).toBe(r.dmgMolt);
  expect(r.basePreviewMoltPower).toBe(r.baseMoltPower);
  expect(r.baseResolutionMoltPower).toBe(r.baseMoltPower);
  expect(r.poweredMoltPower).toBe(r.baseMoltPower + 2);
  expect(r.poweredPreviewDamage).toBe(r.dmgPowered);
  expect(r.poweredPreviewMoltPower).toBe(r.poweredMoltPower);
  expect(r.poweredResolutionMoltPower).toBe(r.poweredMoltPower);
  expect(r.dmgPowered).toBe(r.dmgMolt + 2);
  expect(r.feedback.total).toBe(r.poweredMoltPower);
  expect(r.feedback.bursts).toBeGreaterThanOrEqual(2);
  expect(r.feedback.rendered).toBe(true);
});

test('Molt active card contract drives hand display and enemy targeting', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !(s.hand && s.hand.length); i += 1) await wait(50);
    const enemy = s.enemies[0];
    const card = [...s.drawPile, ...s.hand, ...s.discardPile].find((c: any) => c.id === 'pentacles_04');
    s.drawPile = s.drawPile.filter((c: any) => c.instanceId !== card.instanceId);
    s.discardPile = s.discardPile.filter((c: any) => c.instanceId !== card.instanceId);
    s.hand = [card];
    s.flock.molt = true;
    s.energy = 99;
    s.selectedEnemyId = '';
    enemy.hp = 500;
    s.renderAll();

    const handPayload = window.__birdSquadState!().hand[0];
    s.onCardClicked(card.instanceId);
    const selectedOutcome = window.__birdSquadState!().selectedCardOutcome;
    const selectedAfterCardClick = s.selectedInstanceId === card.instanceId;
    const hpAfterCardClick = enemy.hp;
    s.onEnemyClicked(enemy.id);
    window.advanceTime!(3000);

    return {
      activeTarget: handPayload.activeTarget,
      activeText: handPayload.activeText,
      usesMolt: handPayload.usesMolt,
      selectedOutcome,
      selectedAfterCardClick,
      hpAfterCardClick,
      hpAfterEnemyClick: enemy.hp,
      handAfterEnemyClick: s.hand.length,
    };
  });

  expect(r.usesMolt).toBe(true);
  expect(r.activeTarget).toBe('enemy');
  expect(r.activeText).toContain('Deal');
  expect(r.selectedOutcome.moltPower.applied).toBeGreaterThanOrEqual(2);
  expect(r.selectedOutcome.summary).toContain('Molt Power');
  expect(r.selectedAfterCardClick).toBe(true);
  expect(r.hpAfterCardClick).toBe(500);
  expect(r.hpAfterEnemyClick).toBeLessThan(500);
  expect(r.handAfterEnemyClick).toBe(0);
});

test('Molt Power applies once to the first positive line and scales area damage at half strength', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    game.scene.stop('MenuScene');
    const scene: any = game.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && (!(scene.hand && scene.hand.length) || !scene.combatPreviewModule); i += 1) await wait(50);
    const base = scene.hand[0];
    scene.enemies = [
      { ...scene.enemies[0], id: 'molt_target_a', hp: 500, maxHp: 500, block: 0 },
      { ...scene.enemies[0], id: 'molt_target_b', hp: 500, maxHp: 500, block: 0 },
    ];
    scene.selectedEnemyId = scene.enemies[0].id;
    scene.flock.hp = Math.max(1, scene.flock.maxHp - 20);
    scene.flock.block = 0;

    const previewPair = (id: string, effects: string[]) => {
      const card = {
        ...base,
        id,
        instanceId: `${id}_1`,
        upgraded: false,
        target: 'enemy',
        text: effects.join('; '),
        moltText: effects.join('; '),
        runtime: {
          ...base.runtime,
          id,
          effects,
          moltEffects: effects,
        },
      };
      scene.flock.molt = false;
      const normal = scene.simulateCardOutcome(card, scene.enemies[0].id);
      scene.flock.molt = true;
      const molt = scene.simulateCardOutcome(card, scene.enemies[0].id);
      return { normal, molt };
    };

    const coverFirst = previewPair('molt_cover_first', ['damage(target, 0)', 'gainCover(3)', 'heal(4)']);
    const healFirst = previewPair('molt_heal_first', ['heal(4)', 'gainCover(3)']);
    const area = previewPair('molt_area', ['damageAll(4)']);
    return {
      power: scene.activeMoltPower(),
      coverFirst: {
        applied: coverFirst.molt.moltPowerApplied,
        coverDelta: coverFirst.molt.coverGain - coverFirst.normal.coverGain,
        healDelta: coverFirst.molt.cohesionDelta - coverFirst.normal.cohesionDelta,
      },
      healFirst: {
        applied: healFirst.molt.moltPowerApplied,
        coverDelta: healFirst.molt.coverGain - healFirst.normal.coverGain,
        healDelta: healFirst.molt.cohesionDelta - healFirst.normal.cohesionDelta,
      },
      area: {
        applied: area.molt.moltPowerApplied,
        perTargetDelta: area.molt.enemyStates.map((enemy: any, index: number) =>
          (area.normal.enemyStates[index].hpAfter - enemy.hpAfter)),
      },
    };
  });

  expect(r.coverFirst.applied).toBe(r.power);
  expect(r.coverFirst.coverDelta).toBe(r.power);
  expect(r.coverFirst.healDelta).toBe(0);
  expect(r.healFirst.applied).toBe(r.power);
  expect(r.healFirst.healDelta).toBe(r.power);
  expect(r.healFirst.coverDelta).toBe(0);
  expect(r.area.applied).toBe(Math.ceil(r.power / 2));
  expect(r.area.perTargetDelta).toEqual([Math.ceil(r.power / 2), Math.ceil(r.power / 2)]);
});

test('none-target cards that Molt into target effects no longer auto-fire ambiguously', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !(s.hand && s.hand.length); i += 1) await wait(50);
    const enemy = s.enemies[0];
    const base = s.hand[0];
    const fake = {
      ...base,
      instanceId: 'fake_none_molt_target_1',
      id: 'fake_none_molt_target',
      name: 'Fake Molt Target',
      target: 'none',
      cost: 0,
      text: 'Draw 1.',
      upgradedText: 'Draw 2.',
      moltText: 'Deal 3. Apply 1 Winded.',
      moltTextUpgraded: 'Deal 5. Apply 1 Winded.',
      runtime: {
        ...base.runtime,
        id: 'fake_none_molt_target',
        displayName: 'Fake Molt Target',
        target: 'none',
        effects: ['draw(1)'],
        moltEffects: ['damage(target, 3)', 'applyWinded(target, 1)'],
        upgrade: {
          ...base.runtime.upgrade,
          effects: ['draw(2)'],
          moltEffects: ['damage(target, 5)', 'applyWinded(target, 1)'],
        },
      },
    };
    s.hand = [fake];
    s.drawPile = [];
    s.discardPile = [];
    s.flock.molt = true;
    s.energy = 99;
    s.selectedEnemyId = '';
    enemy.hp = 500;
    enemy.weak = 0;
    s.renderAll();

    const handPayload = window.__birdSquadState!().hand[0];
    s.onCardClicked(fake.instanceId);
    const afterCardClick = {
      selected: s.selectedInstanceId,
      hp: enemy.hp,
      weak: enemy.weak,
      hand: s.hand.length,
    };
    s.onEnemyClicked(enemy.id);
    window.advanceTime!(3000);

    return {
      activeTarget: handPayload.activeTarget,
      usesMolt: handPayload.usesMolt,
      afterCardClick,
      afterEnemyClick: { hp: enemy.hp, weak: enemy.weak, hand: s.hand.length },
    };
  });

  expect(r.usesMolt).toBe(true);
  expect(r.activeTarget).toBe('enemy');
  expect(r.afterCardClick.selected).toBe('fake_none_molt_target_1');
  expect(r.afterCardClick.hp).toBe(500);
  expect(r.afterCardClick.weak).toBe(0);
  expect(r.afterCardClick.hand).toBe(1);
  expect(r.afterEnemyClick.hp).toBeLessThan(500);
  expect(r.afterEnemyClick.weak).toBeGreaterThan(0);
  expect(r.afterEnemyClick.hand).toBe(0);
});

test('preened cards have a stronger Molt ability, and the Codex carries tarot and Aviary notes correctly', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !(s.hand && s.hand.length); i += 1) await wait(50);
    const nest = [...s.drawPile, ...s.hand, ...s.discardPile].find((c: any) => c.id === 'pentacles_04');
    const enemy = s.enemies[0];
    enemy.block = 0; enemy.maxHp = 500;

    // Base molt (not preened): damage(7).
    s.flock.molt = true; nest.upgraded = false; enemy.hp = 500;
    s.resolveCardEffects(nest, enemy.id);
    const dmgBaseMolt = 500 - enemy.hp;

    // Preened molt: the upgraded molt ability is strictly stronger.
    nest.upgraded = true; s.flock.molt = true; enemy.hp = 500;
    s.resolveCardEffects(nest, enemy.id);
    const dmgPreenedMolt = 500 - enemy.hp;
    const hasPreenedMoltText = !!nest.moltTextUpgraded && nest.moltTextUpgraded !== nest.moltText;

    return { dmgBaseMolt, dmgPreenedMolt, hasPreenedMoltText };
  });
  expect(r.dmgBaseMolt).toBeGreaterThanOrEqual(7);
  expect(r.dmgPreenedMolt).toBeGreaterThan(r.dmgBaseMolt); // preened molt does more
  expect(r.hasPreenedMoltText).toBe(true);

  // Codex content: tarot meaning + expanded bird fact are loaded for the card.
  const codex = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const acct = JSON.parse(window.localStorage.getItem('birdsquad.account') || '{}');
    acct.discoveredCards = ['pentacles_04', 'aviary_25'];
    window.localStorage.setItem('birdsquad.account', JSON.stringify(acct));
    await window.__birdSquadStartScene!('CodexScene'); g.scene.stop('BattleScene');
    const cs: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 20 && !cs.root; i += 1) await wait(50);
    let all: any[] = [];
    let texts: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      cs.detailId = 'pentacles_04'; cs.detailScroll = 0; cs.renderAll();
      await wait(100);
      all = [];
      const walk = (o: any) => { if (!o) return; if (o.type === 'Text') all.push(o); const k = o.list; if (Array.isArray(k)) k.forEach(walk); };
      cs.children.list.forEach(walk);
      texts = all.map((t) => t.text || '');
      if (texts.some((t) => /TAROT MEANING/.test(t)) && texts.some((t) => /ABOUT THE/.test(t))) break;
    }
    const hasTarot = texts.some((t) => /TAROT MEANING/.test(t)) && texts.some((t) => /UPRIGHT/.test(t)) && texts.some((t) => /REVERSED/.test(t));
    const hasFacts = texts.some((t) => /ABOUT THE/.test(t));
    // a keyword token is interactive and wired for tooltip hover.
    const kw = all.filter((t) => t.input).find((t) => (t.listenerCount?.('pointerover') ?? 0) > 0);
    cs.detailId = 'aviary_25'; cs.detailScroll = 0; cs.renderAll();
    await wait(150);
    const aviaryAll: any[] = [];
    const collectAviary = (o: any) => {
      if (!o) return;
      if (o.type === 'Text') aviaryAll.push(o);
      const k = o.list;
      if (Array.isArray(k)) k.forEach(collectAviary);
    };
    cs.children.list.forEach(collectAviary);
    const aviaryDetailTexts = aviaryAll.map((t) => t.text || '');
    const hasAviaryDossier = aviaryDetailTexts.some((t) => /AVIARY DOSSIER/.test(t));
    const hasAviaryLegend = aviaryDetailTexts.some((t) => /AVIARY LEGEND/.test(t))
      && aviaryDetailTexts.some((t) => /SIGNAL/.test(t))
      && aviaryDetailTexts.some((t) => /SHADOW/.test(t));
    const aviarySaysTarot = aviaryDetailTexts.some((t) => /TAROT MEANING|UPRIGHT|REVERSED/.test(t));

    // A content-heavy card must engage scrolling (fixed panel + scroll), not overflow.
    let heavyMax = 0;
    const cardIds = (cs.allCards ? cs.allCards() : []).map((card: any) => card.id);
    for (let index = 0; index < cardIds.length; index += 1) {
      cs.detailId = cardIds[index]; cs.detailScroll = 0; cs.renderAll();
      if (cs.detailMaxScroll > heavyMax) heavyMax = cs.detailMaxScroll;
      // Yield occasionally so this exhaustive 110-card layout scan does not
      // starve queued loader completions during a long single-worker run.
      if (index % 25 === 24) await wait(0);
    }
    return { hasTarot, hasFacts, keywordHoverWired: !!kw, hasAviaryDossier, hasAviaryLegend, aviarySaysTarot, heavyMax };
  });
  expect(codex.hasTarot).toBe(true);
  expect(codex.hasFacts).toBe(true);
  expect(codex.keywordHoverWired).toBe(true);
  expect(codex.hasAviaryDossier).toBe(true);
  expect(codex.hasAviaryLegend).toBe(true);
  expect(codex.aviarySaysTarot).toBe(false);
  expect(codex.heavyMax).toBeGreaterThan(0); // the longest card scrolls instead of spilling
});
