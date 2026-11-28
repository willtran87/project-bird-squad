import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { settleCanvas } from './helpers/settled-canvas';
import { boot, clickNamedGameObject } from './helpers/smoke';

// Split from the former tests/smoke.spec.ts (run topics). Tests drive
// scenes through the deterministic text-state harness on window.

test('playtest outcomes hand the latest run directly to the local rating panel', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page, '/?playtest=1');

  await page.evaluate(async () => {
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    scene.mode = 'defeat';
    scene.emitRunSummary('loss');
    scene.battleInputActive = false;
    scene.controllerChoiceIndex = 0;
    scene.renderAll();
  });
  const outcomeState = () => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    return {
      state,
      commands: collect(scene.children.list)
        .filter((child: any) => child.name === 'run-outcome-command-hit' && child.input?.enabled)
        .map((child: any) => child.getData?.('label')),
    };
  });
  await expect.poll(async () => (await outcomeState()).commands).toEqual([
    'Replay Flight',
    'Flight Details',
    'Rate This Run',
    'Practice This Fight',
    'Main Menu',
  ]);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await outcomeState()).state.combatInputFocus).toMatchObject({
    active: true,
    kind: 'outcome',
    index: 2,
    count: 6,
    label: 'Rate This Run',
    visibleFocus: true,
  });
  await page.screenshot({ path: '.artifacts/test-results/outcome-input/playtest-rate-focus.png' });
  await page.keyboard.press('Enter');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}'))).toMatchObject({
    mode: 'profile',
    scene: 'ProfileScene',
    focus: { current: 'playtestFun' },
    playtestExport: { enabled: true, localOnly: true, runs: 1 },
    playtestFeedback: { enabled: true, localOnly: true, result: 'loss', complete: false },
    saveData: { open: true },
  });
  await expect.poll(async () => page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return Boolean(profile.children.getByName('profile-dashboard-surface')
      && profile.children.getByName('profile-save-download-hit'));
  })).toBe(true);
  // The lazy profile art callback rebuilds the display list once after its
  // state first reports ready; wait for the next rendered frame before visual
  // capture so the evidence cannot land between clear and redraw.
  await page.evaluate(() => window.advanceTime?.(250));
  await expect.poll(async () => {
    const state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
    return state.transition;
  }).toEqual({
    entryFadePlayed: true,
    fadeRunning: false,
    fadeComplete: true,
    fadeProgress: 1,
  });
  const profile = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}'));
  expect(profile.playtestFeedback.runId).toBeTruthy();
  expect(profile.transition).toEqual({
    entryFadePlayed: true,
    fadeRunning: false,
    fadeComplete: true,
    fadeProgress: 1,
  });
  await page.screenshot({ path: '.artifacts/test-results/outcome-input/playtest-rating-panel.png' });

  await page.keyboard.press('ArrowRight');
  let refreshedProfile = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(refreshedProfile.focus.current).toBe('playtestFairness');
  expect(refreshedProfile.transition).toEqual({
    entryFadePlayed: true,
    fadeRunning: false,
    fadeComplete: true,
    fadeProgress: 1,
  });

  await page.keyboard.press('Enter');
  refreshedProfile = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(refreshedProfile.playtestFeedback).toMatchObject({
    ratings: { fairness: 1 },
    status: 'saved',
  });
  expect(refreshedProfile.transition).toEqual({
    entryFadePlayed: true,
    fadeRunning: false,
    fadeComplete: true,
    fadeProgress: 1,
  });
  await page.screenshot({ path: '.artifacts/test-results/outcome-input/playtest-rating-no-refade.png' });
});

test('an active run is checkpointed to storage and can be continued', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const menu: any = g.scene.getScene('MenuScene');
    menu.selectLeader('spark_caller');
    menu.startRun();
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 120 && !route.routeEssentialAssetsReady; i += 1) await wait(50);
    // Mutate to a recognizable mid-run state and re-checkpoint.
    route.runState.scrap = 777;
    route.runState.completedRouteNodeIds = ['x'];
    const objectiveTypes = ['priority', 'preserve_flow', 'swift_clear', 'clean_roost', 'finish_guarded', 'no_damage', 'trigger_surge', 'bank_wingbeat', 'block_damage'];
    route.runState.combatResults = objectiveTypes.map((type: string, index: number) => ({
      encounterId: `save-${index}`,
      nodeId: `save-node-${index}`,
      nodeType: 'street',
      enemyIds: [],
      turnsTaken: 2,
      damageDealt: 4,
      cohesionLost: 0,
      damageTakenByMove: [{
        enemyId: 'checkpoint-enemy', moveId: `checkpoint-move-${index}`, moveLabel: 'Checkpoint Strike',
        damageTaken: index + 1, blockedDamage: 3, hitCount: 1
      }],
      objective: { type, title: type, status: 'complete', bonusScrap: 12 },
      decisionStats: {
        cardsPlayed: 2, overextensions: 0, lowCardTurns: 1, noOverextensionTurns: 1,
        turnEnds: 1, cardsHeldAtRoost: 0, unspentWingbeatAtRoost: 1,
        maxCardsPlayedTurn: 2, waymarksAtStart: 0, waymarksAtEnd: 0,
        surgesTriggered: 1, blockedDamage: 9, invalidActions: 4, cancelledActions: 2
      }
    }));
    route.renderAll();
    const saved = JSON.parse(window.localStorage.getItem('birdsquad.run.active') || 'null');
    const savedFeedback = JSON.parse(window.render_game_to_text!()).routeCheckpoint;
    const savedIndicators = route.children.list.filter((child: any) => child.name === 'route-checkpoint-feedback').length;
    route.renderAll();
    const repeatedFeedback = JSON.parse(window.render_game_to_text!()).routeCheckpoint;
    window.advanceTime!(1900);
    await wait(50);
    const settledFeedback = JSON.parse(window.render_game_to_text!()).routeCheckpoint;
    const settledIndicators = route.children.list.filter((child: any) => child.name === 'route-checkpoint-feedback').length;
    // Return to the menu and Continue.
    await window.__birdSquadStartScene!('MenuScene');
    await wait(150);
    (g.scene.getScene('MenuScene') as any).continueRun();
    const route2: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 20 && route2.runState?.scrap !== 777; i += 1) await wait(50);
    return {
      savedScrap: saved?.scrap, savedLeader: saved?.leaderId,
      resumedScrap: route2.runState?.scrap, resumedLeader: route2.runState?.leaderId,
      resumedProgress: route2.runState?.completedRouteNodeIds?.length,
      resumedObjectives: route2.runState?.combatResults?.map((result: any) => result.objective?.type),
      resumedBlockedDamage: route2.runState?.combatResults?.[0]?.decisionStats?.blockedDamage,
      resumedInvalidActions: route2.runState?.combatResults?.[0]?.decisionStats?.invalidActions,
      resumedCancelledActions: route2.runState?.combatResults?.[0]?.decisionStats?.cancelledActions,
      resumedMovePressure: route2.runState?.combatResults?.[0]?.damageTakenByMove,
      savedFeedback,
      repeatedFeedback,
      savedIndicators,
      settledFeedback,
      settledIndicators,
    };
  });
  expect(r.savedScrap).toBe(777);
  expect(r.savedLeader).toBe('spark_caller');
  expect(r.resumedScrap).toBe(777);
  expect(r.resumedLeader).toBe('spark_caller');
  expect(r.resumedProgress).toBe(1);
  expect(r.resumedObjectives).toEqual(['priority', 'preserve_flow', 'swift_clear', 'clean_roost', 'finish_guarded', 'no_damage', 'trigger_surge', 'bank_wingbeat', 'block_damage']);
  expect(r.resumedBlockedDamage).toBe(9);
  expect(r.resumedInvalidActions).toBe(4);
  expect(r.resumedCancelledActions).toBe(2);
  expect(r.savedFeedback).toMatchObject({
    outcome: 'saved',
    label: 'FLIGHT SAVED',
    visible: true,
    writes: 2,
    failures: 0,
  });
  expect(r.repeatedFeedback).toMatchObject({
    outcome: 'saved',
    visible: true,
    writes: 2,
    failures: 0,
  });
  expect(r.savedIndicators).toBe(1);
  expect(r.settledFeedback).toMatchObject({
    outcome: 'saved',
    visible: false,
    writes: 2,
    failures: 0,
  });
  expect(r.settledIndicators).toBe(0);
  expect(r.resumedMovePressure).toEqual([{
    enemyId: 'checkpoint-enemy',
    moveId: 'checkpoint-move-0',
    moveLabel: 'Checkpoint Strike',
    damageTaken: 1,
    blockedDamage: 3,
    hitCount: 1
  }]);
});

test('route checkpoint feedback truthfully reports storage failure and retries after new progress', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    for (let i = 0; i < 120 && !route.routeEssentialAssetsReady; i += 1) await wait(50);
    const initial = JSON.parse(window.render_game_to_text!()).routeCheckpoint;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith('birdsquad.run.active')) throw new DOMException('Storage unavailable', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    };
    route.runState.scrap += 1;
    route.renderAll();
    const failed = JSON.parse(window.render_game_to_text!()).routeCheckpoint;
    const failedIndicators = route.children.list.filter((child: any) => child.name === 'route-checkpoint-feedback').length;
    Storage.prototype.setItem = originalSetItem;
    route.runState.scrap += 1;
    route.renderAll();
    const recovered = JSON.parse(window.render_game_to_text!()).routeCheckpoint;
    const stored = JSON.parse(window.localStorage.getItem('birdsquad.run.active') ?? '{}');
    return {
      initial,
      failed,
      failedIndicators,
      recovered,
      storedScrap: stored.scrap,
      liveScrap: route.runState.scrap,
    };
  });
  expect(result.initial).toMatchObject({ outcome: 'saved', writes: 1, failures: 0 });
  expect(result.failed).toMatchObject({
    outcome: 'failed',
    label: 'SAVE UNAVAILABLE',
    visible: true,
    writes: 1,
    failures: 1,
  });
  expect(result.failedIndicators).toBe(1);
  expect(result.recovered).toMatchObject({
    outcome: 'saved',
    label: 'FLIGHT SAVED',
    visible: true,
    writes: 2,
    failures: 1,
  });
  expect(result.storedScrap).toBe(result.liveScrap);
});

test('corrupt or missing primary saves recover the Flock Record and active flight from mirrored checkpoints', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    window.localStorage.setItem('birdsquad.account', JSON.stringify({
      runs: 4,
      wins: 2,
      losses: 2,
      winsByLeader: { fledgling: 2 },
      runsByLeader: { fledgling: 4 },
      bestWinTier: 2,
      fastestWinTurns: 7,
      unlockedLeaders: ['fledgling', 'spark_caller', 'talon'],
      achievements: ['first_flight'],
      discoveredCards: ['major_00'],
      observedEnemyMoves: ['roof_rat:scrap_swipe'],
      contractBadges: ['0:clean_flight'],
      leaderProgress: { fledgling: { surges: 5, cleanFights: 2, swiftFights: 1, blockedDamage: 12, contracts: 1 } },
      leaderRecords: {
        fledgling: {
          clears: {
            'full:2': { wins: 1, fastestRunTurns: 42 },
            'quick:0': { wins: 2, fastestRunTurns: 24 },
          }
        }
      },
    }));
    window.localStorage.removeItem('birdsquad.maxTier');
    await window.__birdSquadStartScene!('MenuScene');
    await wait(180);
    const menu: any = g.scene.getScene('MenuScene');
    menu.startRun();
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 120 && !route.routeEssentialAssetsReady; i += 1) await wait(50);
    route.runState.scrap = 777;
    route.runState.completedRouteNodeIds = ['recovery-checkpoint'];
    route.renderAll();
    const accountBackupBefore = window.localStorage.getItem('birdsquad.account.backup');
    const runBackupBefore = window.localStorage.getItem('birdsquad.run.active.backup');

    window.localStorage.setItem('birdsquad.account', '{damaged-account');
    window.localStorage.removeItem('birdsquad.run.active');
    await window.__birdSquadStartScene!('MenuScene');
    for (let i = 0; i < 80; i += 1) {
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      if (state.storageRecovery?.rendered) break;
      await wait(50);
    }
    const menuState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const recoveredAccount = JSON.parse(window.localStorage.getItem('birdsquad.account') ?? '{}');
    const recoveredRun = JSON.parse(window.localStorage.getItem('birdsquad.run.active') ?? '{}');
    const recoveryObjects = (g.scene.getScene('MenuScene') as any).children.list
      .filter((child: any) => child.name === 'storage-recovery-notice').length;
    (g.scene.getScene('MenuScene') as any).continueRun();
    const resumed: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 40 && resumed.runState?.scrap !== 777; i += 1) await wait(50);
    return {
      accountBackupBefore,
      runBackupBefore,
      recovery: menuState.storageRecovery,
      recoveryObjects,
      recoveredAccount,
      recoveredRun,
      maxUnlockedDifficulty: menuState.maxUnlockedDifficulty,
      resumedScrap: resumed.runState?.scrap,
      resumedProgress: resumed.runState?.completedRouteNodeIds,
    };
  });

  expect(result.accountBackupBefore).not.toBeNull();
  expect(result.runBackupBefore).not.toBeNull();
  expect(result.recovery).toMatchObject({ outcome: 'recovered', rendered: true });
  expect(result.recovery.scopes).toEqual(expect.arrayContaining(['Flock Record', 'flight checkpoint']));
  expect(result.recoveryObjects).toBe(3);
  expect(result.recoveredAccount).toMatchObject({
    runs: 4,
    wins: 2,
    bestWinTier: 2,
    leaderRecords: {
      fledgling: {
        clears: {
          'full:2': { wins: 1, fastestRunTurns: 42 },
          'quick:0': { wins: 2, fastestRunTurns: 24 },
        }
      }
    }
  });
  expect(result.recoveredRun).toMatchObject({ scrap: 777, completedRouteNodeIds: ['recovery-checkpoint'] });
  expect(result.maxUnlockedDifficulty).toBe(3);
  expect(result.resumedScrap).toBe(777);
  expect(result.resumedProgress).toEqual(['recovery-checkpoint']);
});

test('invalid active run saves are ignored instead of crashing Continue', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    window.localStorage.setItem('birdsquad.run.active', JSON.stringify({
      deck: [{ id: 'missing_card' }],
      leaderId: 'missing_leader',
      currentHp: 36,
      scrap: 40,
      routeMarks: [],
      supplies: [],
      mapIndex: 0,
      completedRouteNodeIds: [],
      routeLog: []
    }));
    await window.__birdSquadStartScene!('MenuScene');
    await wait(150);
    const active = g.scene.getScenes(true).map((s: any) => s.scene.key);
    return {
      active,
      savedAfterMenu: window.localStorage.getItem('birdsquad.run.active'),
      quarantined: window.localStorage.getItem('birdsquad.run.active.corrupt'),
    };
  });
  expect(r.active).toContain('MenuScene');
  expect(r.savedAfterMenu).toBeNull();
  expect(r.quarantined).toContain('missing_card');
  await expect.poll(async () => page.evaluate(() => {
    const menuState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return menuState.storageRecovery;
  })).toMatchObject({ outcome: 'reset', scopes: ['flight checkpoint'], rendered: true });
});

test('Ascension difficulty scales enemy Cohesion and narrows card rewards', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const mk = (difficulty: number) => ({
      deck: [{ id: 'major_07' }], leaderId: 'fledgling', difficulty, currentHp: 36, scrap: 0,
      routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [], currentRouteNodeId: undefined,
      routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
    });
    await window.__birdSquadStartScene!('BattleScene', { runState: mk(0), routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    await wait(250);
    const base = (g.scene.getScene('BattleScene') as any).enemies[0].maxHp;
    await window.__birdSquadStartScene!('BattleScene', { runState: mk(5), routeNodeId: 'm1_entry' });
    await wait(250);
    const scene: any = g.scene.getScene('BattleScene');
    return { base, scaled: scene.enemies[0].maxHp, rewardCount: scene.createRewardChoices().length };
  });
  expect(r.scaled).toBeGreaterThan(r.base); // +30% enemy Cohesion at tier 5
  expect(r.rewardCount).toBe(2); // tier >= 2 narrows rewards from 3 to 2
});

test('Ascension mastery tiers shift cyclic Tells deterministically while preserving previews and boss scripts', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  const report = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    const runState = (difficulty: number, seed: string) => ({
      deck: [{ id: 'major_07' }],
      leaderId: 'fledgling',
      difficulty,
      runMode: 'full',
      seed,
      currentHp: 38,
      scrap: 0,
      routeMarks: [],
      supplies: [],
      mapIndex: 0,
      completedRouteNodeIds: [],
      routeLog: [],
      nextCombat: undefined,
      signalChoices: [],
      rewardEvents: [],
    });
    const start = async (difficulty: number, seed: string, routeNodeId = 'm1_entry') => {
      const scene: any = await window.__birdSquadStartScene!(
        'BattleScene',
        { runState: runState(difficulty, seed), routeNodeId },
      );
      g.scene.stop('MenuScene');
      await wait(25);
      return scene;
    };

    const standard = await start(0, 'mastery-standard');
    const standardOpener = standard.enemies[0].intentIndex;

    const shiftedIndices: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      const scene = await start(3, `mastery-opener-${index}`);
      shiftedIndices.push(scene.enemies[0].intentIndex);
    }
    const repeatedA = await start(3, 'mastery-repeat');
    const repeatedAState = window.__birdSquadState!();
    const repeatedAIndex = repeatedA.enemies[0].intentIndex;
    const repeatedB = await start(3, 'mastery-repeat');
    const repeatedBState = window.__birdSquadState!();
    const repeatedBIndex = repeatedB.enemies[0].intentIndex;

    const restless = await start(6, 'mastery-restless');
    restless.enemies[0].intentIndex = 1; // Roof Rat's authored Gutter Nibble 4.
    restless.flock.hp = restless.flock.maxHp;
    restless.flock.block = 0;
    restless.prepareEnemyMoveContext();
    restless.renderAll();
    const before = window.__birdSquadState!();
    const hpBefore = restless.flock.hp;
    restless.resolveEnemyTurn();
    restless.renderAll();
    const after = window.__birdSquadState!();
    const actualLoss = hpBefore - restless.flock.hp;

    const boss = await start(6, 'mastery-boss', 'm1_boss');
    const bossBefore = boss.enemies[0].intentIndex;
    boss.resolveEnemyTurn();
    const bossAfter = boss.enemies[0].intentIndex;

    const restlessRepeat = await start(6, 'mastery-restless');
    restlessRepeat.enemies[0].intentIndex = 1;
    restlessRepeat.prepareEnemyMoveContext();
    restlessRepeat.resolveEnemyTurn();
    restlessRepeat.renderAll();
    const repeatedRestlessState = window.__birdSquadState!();

    window.localStorage.setItem('birdsquad.maxTier', '6');
    const menu: any = await window.__birdSquadStartScene!('MenuScene');
    menu.setSetupOpen(true);
    menu.selectedDifficulty = 3;
    menu.updateDifficultyText();
    const tier3Description = menu.difficultyDescText.text;
    menu.selectedDifficulty = 6;
    menu.updateDifficultyText();
    const tier6Description = menu.difficultyDescText.text;

    return {
      standardOpener,
      shiftedIndices,
      repeated: {
        indexA: repeatedAIndex,
        indexB: repeatedBIndex,
        intentA: repeatedAState.enemies[0].intent,
        intentB: repeatedBState.enemies[0].intent,
      },
      restless: {
        beforeIndex: before.enemies[0].intentIndex,
        afterIndex: after.enemies[0].intentIndex,
        beforeIntent: before.enemies[0].intent,
        afterIntent: after.enemies[0].intent,
        preview: before.flock.incoming.total,
        actualLoss,
        difficulty: before.difficulty,
        log: after.log,
        repeatedAfterIndex: repeatedRestlessState.enemies[0].intentIndex,
        repeatedAfterIntent: repeatedRestlessState.enemies[0].intent,
      },
      boss: { before: bossBefore, after: bossAfter },
      tier3Description,
      tier6Description,
    };
  });

  expect(report.standardOpener).toBe(0);
  expect(new Set(report.shiftedIndices)).toEqual(new Set([1, 2]));
  expect(report.repeated.indexA).toBe(report.repeated.indexB);
  expect(report.repeated.intentA).toBe(report.repeated.intentB);
  expect(report.restless.beforeIntent).toBe('Gutter Nibble 4');
  expect(report.restless.afterIntent).not.toBe(report.restless.beforeIntent);
  expect(report.restless.afterIndex - report.restless.beforeIndex).toBeGreaterThanOrEqual(1);
  expect(report.restless.afterIndex - report.restless.beforeIndex).toBeLessThanOrEqual(2);
  expect(report.restless.repeatedAfterIndex).toBe(report.restless.afterIndex);
  expect(report.restless.repeatedAfterIntent).toBe(report.restless.afterIntent);
  expect(report.restless.preview).toBe(report.restless.actualLoss);
  expect(report.restless.difficulty).toMatchObject({
    tier: 6,
    enemyDamageBonus: 1,
    shiftedOpeners: true,
    restlessPatterns: true,
  });
  expect(report.restless.log.some((entry: string) => entry.includes('reroutes:'))).toBe(true);
  expect(report.boss).toEqual({ before: 0, after: 1 });
  expect(report.tier3Description).toContain('Tells shifted start');
  expect(report.tier3Description).toContain('Hit +0');
  expect(report.tier6Description).toContain('Tells reroute');
  expect(report.tier6Description).toContain('Hit +1');
});

test('a defeat emits a local run-summary artifact', async ({ page }) => {
  await boot(page);
  const run = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !scene.flock; i += 1) await wait(50); // create() runs a tick after start
    scene.runCombatResults = [{
      encounterId: 'enc_prior', nodeId: 'prior-node', nodeType: 'street', enemyIds: ['prior-enemy'],
      turnsTaken: 3, damageDealt: 12, cohesionLost: 2,
      damageTakenByMove: [{
        enemyId: 'prior-enemy', moveId: 'prior_move', moveLabel: 'Prior Move',
        damageTaken: 2, blockedDamage: 3, hitCount: 1
      }],
      decisionStats: {
        cardsPlayed: 5, overextensions: 0, lowCardTurns: 1, noOverextensionTurns: 2,
        turnEnds: 3, cardsHeldAtRoost: 1, unspentWingbeatAtRoost: 0,
        maxCardsPlayedTurn: 3, waymarksAtStart: 0, waymarksAtEnd: 1,
        invalidActions: 3, cancelledActions: 2
      }
    }];
    scene.completedRouteNodeIds = ['prior-node'];
    scene.turn = 4;
    scene.runScrapEarned = 120;
    scene.runScrapSpent = 45;
    scene.runRouteDecisions = [{ offered: ['m1_entry', 'm1_cache'], picked: 'm1_entry', decisionMs: 2300 }];
    scene.runRewardEvents = [{ offered: ['wands_02', 'cups_02'], picked: 'wands_02', skipped: false, decisionMs: 1700 }];
    scene.runStartedAtMs = Date.now() - 8000;
    scene.scrap = 115;
    scene.combatAnimationPending = false;
    scene.mode = 'battle';
    const targetedCard = scene.hand.find((card: any) => (
      scene.activeCardContract(card).target === 'enemy' && scene.effectiveCost(card) <= scene.energy
    ));
    if (!targetedCard) throw new Error('No targeted card was available for input telemetry.');
    scene.onCardClicked(targetedCard.instanceId);
    scene.handleBattleBack();
    scene.onCardClicked('missing-card-instance');
    scene.onEnemyClicked('missing-enemy-id');
    scene.flock.hp = 1;
    scene.flock.block = 0;
    scene.resolveEnemyEffect(scene.enemies[0], 'damage(flock, 20)', 'Review Strike');
    scene.checkOutcome();
    return window.__birdSquadLastRun;
  });
  expect(run.result).toBe('loss');
  expect(run.killedBy).toBe('Review Strike');
  expect(run.deck.length).toBeGreaterThan(0);
  expect(run.mapId).toBe('map_01_rooftop_blocks');
  expect(run.combatResults.length).toBeGreaterThan(0);
  expect(run.combatResults.some((combat: any) => combat.encounterId === 'enc_roof_rat')).toBe(true);
  expect(run.combatResults.at(-1).objective).toBeUndefined();
  expect(run.combatResults.at(-1).killedByMove).toBe('Review Strike');
  expect(run.combatResults.at(-1).durationMs).toBeGreaterThan(0);
  expect(run.combatResults.at(-1).cohesionLost).toBe(1);
  expect(run.combatResults.at(-1).damageTakenByMove).toContainEqual(expect.objectContaining({
    enemyId: 'roof_rat',
    moveLabel: 'Review Strike',
    damageTaken: 1,
    blockedDamage: 0,
    hitCount: 1
  }));
  expect(run.combatResults[0].damageTakenByMove).toEqual([{
    enemyId: 'prior-enemy',
    moveId: 'prior_move',
    moveLabel: 'Prior Move',
    damageTaken: 2,
    blockedDamage: 3,
    hitCount: 1
  }]);
  expect(run.turnsTaken).toBe(7);
  expect(run.scrapEarned).toBe(120);
  expect(run.scrapSpent).toBe(45);
  expect(run.finalScrap).toBe(115);
  expect(run.durationMs).toBeGreaterThanOrEqual(7000);
  expect(run.routeDecisions[0]).toEqual({ offered: ['m1_entry', 'm1_cache'], picked: 'm1_entry', decisionMs: 2300 });
  expect(run.cardRewards[0].decisionMs).toBe(1700);
  expect(run.combatPace).toBe('standard');
  expect(run.firstFlightGuide).toBeTruthy();
  expect(run.decisionStats.cardsPlayed).toBeGreaterThanOrEqual(5);
  expect(run.decisionStats.invalidActions).toBe(5);
  expect(run.decisionStats.cancelledActions).toBe(3);
  expect(Array.isArray(run.suppliesUsed)).toBe(true);
});

test('defeat review explains the fatal hit, top pressure, and one actionable adjustment', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    game.scene.stop('MenuScene');
    const scene: any = game.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && !scene.flock; i += 1) await wait(50);
    scene.runCombatResults = [{
      encounterId: 'enc_prior',
      nodeId: 'prior-node',
      nodeType: 'street',
      enemyIds: ['prior-enemy'],
      turnsTaken: 3,
      damageDealt: 10,
      cohesionLost: 17,
      damageTakenByMove: [{
        enemyId: 'prior-enemy',
        moveId: 'relentless_peck',
        moveLabel: 'Relentless Peck',
        damageTaken: 17,
        blockedDamage: 5,
        hitCount: 3,
      }],
      decisionStats: {
        cardsPlayed: 7,
        overextensions: 0,
        lowCardTurns: 0,
        noOverextensionTurns: 3,
        turnEnds: 3,
        cardsHeldAtRoost: 0,
        unspentWingbeatAtRoost: 0,
        maxCardsPlayedTurn: 3,
        waymarksAtStart: 0,
        waymarksAtEnd: 0,
      },
    }];
    scene.completedRouteNodeIds = ['prior-node'];
    scene.statOverextensions = 2;
    scene.flock.hp = 1;
    scene.flock.block = 0;
    scene.resolveEnemyEffect(scene.enemies[0], 'damage(flock, 20)', 'Review Strike');
    scene.checkOutcome();
    scene.renderAll();
    for (let i = 0; i < 80 && !scene.getTextState().defeatReview; i += 1) await wait(50);
    scene.renderAll();
    await wait(0);

    const state = scene.getTextState();
    const frame: any = scene.root.list.find((child: any) => child.name === 'run-defeat-review');
    const signal: any = scene.root.list.find((child: any) => child.name === 'run-defeat-review-signal');
    const headline: any = scene.root.list.find((child: any) => child.name === 'run-defeat-review-headline');
    const evidence: any = scene.root.list.find((child: any) => child.name === 'run-defeat-review-evidence');
    const tip: any = scene.root.list.find((child: any) => child.name === 'run-defeat-review-tip');
    const copyRail: any = scene.root.list.find((child: any) => child.name === 'run-outcome-flight-link-hit');
    const copyLabel: any = scene.root.list.find((child: any) => child.name === 'run-outcome-flight-link-label');
    const copyHit: any = scene.root.list.find((child: any) => child.name === 'run-outcome-flight-link-hit');
    const commandHits: any[] = scene.root.list.filter((child: any) => child.name === 'run-outcome-command-hit');
    const staleCombatFxNames = new Set([
      'combat-enemy-attack-tell',
      'combat-threat-charge',
      'combat-enemy-windup-plaque',
      'combat-enemy-commitment-seal',
      'combat-action-trail',
      'combat-enemy-impact-contact',
      'combat-flock-impact-burst',
      'combat-enemy-recovery-afterglow',
      'combat-turn-banner',
    ]);
    const within = (outer: any, inner: any) => (
      inner.left >= outer.left - 0.5
      && inner.right <= outer.right + 0.5
      && inner.top >= outer.top - 0.5
      && inner.bottom <= outer.bottom + 0.5
    );
    const frameBounds = frame?.getBounds();
    return {
      review: state.defeatReview,
      headline: headline?.text,
      evidence: evidence?.text,
      tip: tip?.text,
      completeReview: [headline, evidence, tip].map(entry => entry?.getData('fullText')),
      reviewExcerpts: [headline, evidence, tip].map(entry => ({ text: entry?.text, full: entry?.getData('fullText'), truncated: entry?.getData('truncated') })),
      reportResults: scene.outcomeFlightDetails()?.results,
      reviewRendered: Boolean(frame),
      reviewContainsText: frameBounds
        ? [headline, evidence, tip].every((entry) => entry && within(frameBounds, entry.getBounds()))
        : false,
      reviewSize: frame ? [frame.displayWidth, frame.displayHeight] : [],
      reviewFontSizes: [signal, headline, evidence, tip].map((entry) => Number.parseFloat(entry?.style?.fontSize ?? '0')),
      copyRailSize: copyRail ? [copyRail.displayWidth, copyRail.displayHeight] : [],
      copyRailY: copyRail?.y,
      copyLabelFontSize: Number.parseFloat(copyLabel?.style?.fontSize ?? '0'),
      copyLabelContained: copyRail && copyLabel ? within(copyRail.getBounds(), copyLabel.getBounds()) : false,
      reviewToCopyGap: frame && copyRail ? frame.getBounds().left - copyRail.getBounds().right : -1,
      copyToCommandsGap: copyRail && commandHits.length > 0
        ? Math.min(...commandHits.map((entry) => entry.getBounds().top)) - copyRail.getBounds().bottom
        : -1,
      copyDoesNotOverlapCommands: copyHit && commandHits.length > 0
        ? copyHit.getBounds().bottom <= Math.min(...commandHits.map((entry) => entry.getBounds().top))
        : false,
      commands: commandHits.map((entry) => entry.getData('label')),
      flightLinkLabel: copyLabel?.text,
      staleCombatFx: scene.fxLayer.list
        .map((child: any) => child.name)
        .filter((name: string) => staleCombatFxNames.has(name)),
      outcomeReportAboveFx: scene.root.depth > scene.fxLayer.depth,
    };
  });
  await page.screenshot({ path: '.artifacts/test-results/min-supported/defeat-review-1000x560.png' });

  expect(result.review).toMatchObject({
    fatalMove: 'Review Strike',
    signal: 'OPEN SKY',
    headline: 'Last hit · Review Strike',
    evidence: 'Pressure · Relentless Peck · 17 hit / 5 Cover',
    topPressure: {
      enemyId: 'prior-enemy',
      moveId: 'relentless_peck',
      moveLabel: 'Relentless Peck',
      damageTaken: 17,
      blockedDamage: 5,
      hitCount: 3,
    },
  });
  expect(result.review.tip).toContain('2 overextensions opened the flock');
  expect(result.review.replayNote).toContain('seed');
  expect(result.completeReview).toEqual([result.review.headline, result.review.evidence, result.review.tip]);
  for (const excerpt of result.reviewExcerpts) {
    if (excerpt.truncated) { expect(excerpt.text).toMatch(/…$/); expect(excerpt.full).toContain(excerpt.text.slice(0, -1)); }
    else expect(excerpt.text).toBe(excerpt.full);
    expect(result.reportResults).toContain(excerpt.full);
  }
  expect(result.reviewRendered).toBe(true);
  expect(result.reviewContainsText).toBe(true);
  expect(result.reviewSize).toEqual([452, 156]);
  expect(result.reviewFontSizes).toEqual([18, 21, 18, 18]);
  expect(result.copyRailSize).toEqual([244, 58]);
  expect(result.copyRailY).toBe(514);
  expect(result.copyLabelFontSize).toBe(21);
  expect(result.copyLabelContained).toBe(true);
  expect(result.reviewToCopyGap).toBeGreaterThanOrEqual(20);
  expect(result.copyToCommandsGap).toBeGreaterThanOrEqual(8);
  expect(result.copyDoesNotOverlapCommands).toBe(true);
  expect(result.commands).toEqual(['Replay Flight', 'Flight Details', 'Practice This Fight', 'Main Menu']);
  expect(result.flightLinkLabel).toContain('COPY SEEDED FLIGHT');
  expect(result.staleCombatFx).toEqual([]);
  expect(result.outcomeReportAboveFx).toBe(true);
});

test('flight details expose the final deck, path, kit, decisions, and results accessibly', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);

  await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    game.scene.stop('MenuScene');
    const scene: any = game.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && !scene.flock; i += 1) await wait(50);
    const routeNodes = window.__birdSquadCurrentMap?.().nodes.slice(0, 3) ?? [];
    scene.completedRouteNodeIds = routeNodes.map((node: any) => node.id);
    scene.runRouteDecisions = routeNodes.map((node: any, index: number) => ({
      offered: routeNodes.slice(index, index + 2).map((candidate: any) => candidate.id),
      picked: node.id,
      decisionMs: 1200 + index * 400,
    }));
    scene.runRewardEvents = [
      { offered: ['wands_02', 'cups_02'], picked: 'wands_02', skipped: false, decisionMs: 1700 },
      { offered: ['swords_02', 'pentacles_02'], skipped: true, fallback: 'scrap', decisionMs: 900 },
    ];
    scene.routeMarks = ['chalk_wingmark'];
    scene.runSuppliesUsed = ['seed_packet'];
    scene.runScrapEarned = 88;
    scene.runScrapSpent = 35;
    scene.scrap = 93;
    scene.statDealt = 21;
    scene.statBlocked = 7;
    scene.statCardsPlayed = 6;
    scene.statNoOverextensionTurns = 2;
    scene.statUnspentWingbeatAtRoost = 1;
    scene.runStartedAtMs = Date.now() - 74_000;
    scene.flock.hp = 1;
    scene.flock.block = 0;
    scene.resolveEnemyEffect(scene.enemies[0], 'damage(flock, 20)', 'Review Strike');
    scene.checkOutcome();
    scene.renderAll();
  });

  await expect.poll(async () => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.combatInputFocus?.count;
  })).toBe(5);
  // The action count is known before the lazy outcome presentation arrives.
  // Navigate only once its actual controls have taken ownership from loading.
  await page.waitForFunction(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    return scene.root?.list.some((entry: any) => entry.name === 'run-outcome-command-hit' && entry.input?.enabled)
      && !scene.root.getByName('pending-overlay')?.active;
  });
  await settleCanvas(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.combatInputFocus?.label;
  })).toBe('Flight Details');
  await page.keyboard.press('Enter');
  await expect.poll(async () => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.outcomeFlightDetails?.open;
  })).toBe(true);
  await expect.poll(async () => page.evaluate(() => document.getElementById('game-status')?.textContent ?? '')).toContain('Flight details');

  await page.screenshot({
    path: '.artifacts/test-results/flight-details/minimum-landscape-defeat-review.png',
  });
  const initialAnnouncement = await page.evaluate(() => document.getElementById('game-status')?.textContent ?? '');
  const visited: Array<{title:string;text:string;contained:boolean;separated:boolean}> = [];
  const pageCount = await page.evaluate(() => (window.__birdSquadGame.scene.getScene('BattleScene') as any)
    .root.getByName('run-flight-details-section-body').getData('reading').total);
  for (let index=0; index<pageCount; index++) {
    visited.push(await page.evaluate(() => {
      const root=(window.__birdSquadGame.scene.getScene('BattleScene') as any).root;
      const body=root.getByName('run-flight-details-section-body'), heading=root.getByName('run-flight-details-section-title');
      const b=body.getBounds(), h=heading.getBounds(), frame=root.getByName('run-flight-details-panel').getBounds();
      return {title:body.getData('section'),text:body.text,
        contained:b.left>=frame.left&&b.right<=frame.right&&h.top>=frame.top&&b.bottom<=506,
        separated:h.bottom+8<=b.top&&b.bottom+8<=root.getByName('run-flight-details-next').getBounds().top};
    }));
    await page.keyboard.press('PageDown');
    await expect.poll(async()=>page.evaluate(()=>(window.__birdSquadGame.scene.getScene('BattleScene') as any)
      .root.getByName('run-flight-details-section-body').getData('reading').page)).toBe((index+1)%pageCount+1);
  }
  expect(visited.length).toBeGreaterThanOrEqual(5);
  expect(visited.every(p=>p.contained&&p.separated)).toBe(true);
  const review = await page.evaluate(({visited, initialAnnouncement}) => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const panel: any = scene.root.list.find((child: any) => child.name === 'run-flight-details-panel');
    const sections: any[] = scene.root.list.filter((child: any) => child.name === 'run-flight-details-section-title');
    const bodies: any[] = scene.root.list.filter((child: any) => child.name === 'run-flight-details-section-body');
    const closeHit: any = scene.root.list.find((child: any) => child.name === 'run-flight-details-close-hit');
    const panelBounds = panel?.getBounds();
    const contained = (outer: any, inner: any) => (
      inner.left >= outer.left - 0.5
      && inner.right <= outer.right + 0.5
      && inner.top >= outer.top - 0.5
      && inner.bottom <= outer.bottom + 0.5
    );
    const overlaps = (a: any, b: any) => (
      a.left < b.right
      && a.right > b.left
      && a.top < b.bottom
      && a.bottom > b.top
    );
    return {
      state,
      title: scene.root.list.find((child: any) => child.name === 'run-flight-details-title')?.text,
      sectionNames: [...new Set(visited.map(page=>page.title))],
      sectionBodies: Object.fromEntries(visited.map(page=>[page.title,visited.filter(p=>p.title===page.title).map(p=>p.text).join('\n')])),
      allSectionsInsidePanel: panelBounds
        ? [...sections, ...bodies, closeHit].every((entry) => entry && contained(panelBounds, entry.getBounds()))
        : false,
      closeDoesNotOverlapSections: closeHit
        ? sections.every((section) => !overlaps(closeHit.getBounds(), section.getBounds()))
        : false,
      closeTarget: { width: closeHit?.width, height: closeHit?.height, enabled: closeHit?.input?.enabled },
      focusRings: scene.root.list.filter((child: any) => child.name === 'run-flight-details-input-focus-ring').length,
      announcement: initialAnnouncement,
    };
  },{visited,initialAnnouncement});

  expect(review.state).toMatchObject({
    mode: 'defeat',
    outcomeFlightDetails: {
      open: true,
      details: {
        waymarks: ['Chalk Wingmark'],
        supplies: ['Seed Packet'],
      },
    },
    combatInputFocus: {
      active: true,
      kind: 'outcome',
      index: 0,
      count: 1,
      label: 'Close Flight Details',
      visibleFocus: true,
    },
  });
  expect(review.state.outcomeFlightDetails.details.deck.length).toBeGreaterThanOrEqual(10);
  expect(review.state.outcomeFlightDetails.details.deck.some((line: string) => line.includes('First Flight'))).toBe(true);
  expect(review.state.outcomeFlightDetails.details.path.length).toBeGreaterThanOrEqual(3);
  expect(review.state.outcomeFlightDetails.details.path.every((line: string) => /D\d/.test(line))).toBe(true);
  expect(review.state.outcomeFlightDetails.details.decisions.join(' ')).toContain('route choices');
  expect(review.state.outcomeFlightDetails.details.decisions.join(' ')).toContain('card recruit');
  expect(review.state.outcomeFlightDetails.details.results[0]).toContain('LOSS');
  expect(review.title).toBe('Flight Details');
  expect(review.sectionNames).toEqual(['FINAL DECK · 10', 'ROUTE PATH · 3 STOPS', 'KIT AT LANDING', 'DECISIONS', 'RESULTS']);
  expect(review.sectionBodies['KIT AT LANDING']).toContain('Chalk Wingmark');
  expect(review.sectionBodies['KIT AT LANDING']).toContain('Seed Packet');
  expect(review.allSectionsInsidePanel).toBe(true);
  expect(review.closeDoesNotOverlapSections).toBe(true);
  expect(review.closeTarget).toEqual({ width: 190, height: 58, enabled: true });
  expect(review.focusRings).toBe(1);
  expect(review.announcement).toContain('Final deck has');
  expect(review.announcement).toContain('Route path has');
  expect(review.announcement).toContain('Press Confirm or Back to close');

  await page.keyboard.press('Escape');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').outcomeFlightDetails?.open)).toBe(false);
  await page.keyboard.press('Enter');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').outcomeFlightDetails?.open)).toBe(true);
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Expected game canvas for Flight Details pointer close');
  await page.mouse.click(
    canvas.x + canvas.width * (1082 / 1280),
    canvas.y + canvas.height * (640 / 720),
  );
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').outcomeFlightDetails?.open)).toBe(false);
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').mode)).toBe('defeat');
});

test('outcome replay preserves the flight seed and setup through keyboard confirmation', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene');
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    const runState = {
      ...route.runState,
      leaderId: 'spark_caller',
      difficulty: 2,
      runMode: 'quick',
      seed: 'replay-flight-42',
      completedRouteNodeIds: ['m1_entry'],
      currentRouteNodeId: 'm1_entry',
      routeLog: ['Prior flight progress'],
      scrap: 88
    };
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry', runState });
    g.scene.stop('RouteScene');
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && !battle.fxLayer?.active; i += 1) await wait(50);
    battle.mode = 'defeat';
    battle.emitRunSummary('loss');
    battle.controllerChoiceIndex = 0;
    battle.renderAll();
    for (let i = 0; i < 80 && !battle.root.list.some((child: any) => child.name === 'run-outcome-flight-link-label'); i += 1) {
      await wait(50);
    }
    const outcomeTexts = battle.root.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text);
    battle.input.keyboard.emit('keydown-ENTER');
    const replayRoute: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 40 && replayRoute.runState?.seed !== 'replay-flight-42'; i += 1) await wait(50);
    return {
      flightCodeVisible: outcomeTexts.some((text: string) => text.includes('FLIGHT replay-flight-42')),
      replay: {
        leaderId: replayRoute.runState.leaderId,
        difficulty: replayRoute.runState.difficulty,
        runMode: replayRoute.runState.runMode,
        seed: replayRoute.runState.seed,
        mapIndex: replayRoute.runState.mapIndex,
        completedRouteNodeIds: replayRoute.runState.completedRouteNodeIds,
        currentRouteNodeId: replayRoute.runState.currentRouteNodeId,
        scrap: replayRoute.runState.scrap
      }
    };
  });
  expect(result.flightCodeVisible).toBe(true);
  expect(result.replay).toMatchObject({
    leaderId: 'spark_caller',
    difficulty: 2,
    runMode: 'quick',
    seed: 'replay-flight-42',
    mapIndex: 0,
    completedRouteNodeIds: [],
    scrap: 40
  });
  expect(result.replay.currentRouteNodeId).toBeUndefined();
});

test('witnessed boss tactics persist into outcome goals and Codex dossier progress', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    window.localStorage.removeItem('birdsquad.account');
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && !battle.flock; i += 1) await wait(50);
    battle.runSeenEnemyMoves = new Set(['tar_crowned_crow:toll_line']);
    battle.mode = 'defeat';
    battle.emitRunSummary('loss');
    battle.renderAll();
    for (let i = 0; i < 80 && !battle.getTextState().unlockHighlights?.items?.length; i += 1) await wait(50);
    battle.renderAll();
    const outcomeState = battle.getTextState();
    const outcomeTexts = battle.root.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
    const accountAfterFirst = JSON.parse(window.localStorage.getItem('birdsquad.account') ?? '{}');

    await window.__birdSquadStartScene!('CodexScene');
    g.scene.stop('BattleScene');
    const codex: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 40 && !codex.root; i += 1) await wait(50);
    codex.activeSection = 'enemies';
    codex.detailId = 'tar_crowned_crow';
    codex.renderAll();
    let codexState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    for (let i = 0; i < 80 && codexState.bossDossier?.observed !== 1; i += 1) {
      await wait(50);
      codexState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    }
    const codexTexts = codex.root.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
    return {
      persisted: accountAfterFirst.observedEnemyMoves,
      summaryMoves: window.__birdSquadLastRun?.seenEnemyMoves,
      unlocks: outcomeState.unlockHighlights.items,
      nextGoal: outcomeTexts.find((text: string) => text.startsWith('NEXT FLIGHT')) ?? '',
      dossier: codexState.bossDossier,
      observedText: codexTexts.find((text: string) => text.includes('Toll Line')) ?? '',
      hiddenCount: codexTexts.filter((text: string) => text.includes('Undocumented tactic')).length,
      progressHeading: codexTexts.find((text: string) => text.includes('COMBAT KIT')) ?? ''
    };
  });
  expect(result.persisted).toEqual(['tar_crowned_crow:toll_line']);
  expect(result.summaryMoves).toContain('tar_crowned_crow:toll_line');
  expect(result.unlocks).toContainEqual(expect.objectContaining({
    id: 'dossier:tar_crowned_crow',
    kind: 'dossier',
    name: 'The Tar-Crowned Crow Dossier'
  }));
  expect(result.nextGoal).toContain('Witness 4 more tactics');
  expect(result.dossier).toEqual({ enemyId: 'tar_crowned_crow', observed: 1, total: 5 });
  expect(result.observedText).toContain('Toll Line');
  expect(result.hiddenCount).toBe(1);
  expect(result.progressHeading).toContain('1 OF 5 OBSERVED');
});

test('Codex card collections expose discovery milestones and feed the next-flight goal', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const discoveredCards = ['wands_ace', 'wands_02', 'wands_03'];
    window.localStorage.setItem('birdsquad.account', JSON.stringify({ discoveredCards }));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('CodexScene');
    g.scene.stop('MenuScene');
    const codex: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 40 && !codex.root; i += 1) await wait(50);
    codex.activeSection = 'cards';
    codex.activeTab = 2;
    codex.renderAll();
    let codexState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    for (let i = 0; i < 80 && !codexState.cardDiscovery; i += 1) {
      await wait(50);
      codexState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    }
    const hiddenRailCount = codex.root.list.filter((child: any) => child.name === 'codex-card-collection-atlas-hit').length;
    codex.toggleCollectionTools();
    const railCount = codex.root.list.filter((child: any) => child.name === 'codex-card-collection-atlas-hit' && child.input?.enabled).length;
    const codexTexts = codex.root.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');

    g.scene.stop('CodexScene');
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && !battle.flock; i += 1) await wait(50);
    window.localStorage.setItem('birdsquad.account', JSON.stringify({ discoveredCards }));
    battle.mode = 'defeat';
    battle.emitRunSummary('loss');
    battle.renderAll();
    let outcomeTexts: string[] = [];
    for (let i = 0; i < 80; i += 1) {
      outcomeTexts = battle.root.list
        .map((child: any) => child.text)
        .filter((text: unknown): text is string => typeof text === 'string');
      if (outcomeTexts.some((text) => text.includes('PLUMES TRAIL MARK'))) break;
      await wait(50);
    }
    return {
      collection: codexState.cardCollection,
      discovery: codexState.cardDiscovery,
      hiddenRailCount,
      railCount,
      collectionHeading: codexTexts.find((text) => text.includes('Collection Atlas')) ?? '',
      nextGoal: outcomeTexts.find((text) => text.startsWith('NEXT FLIGHT')) ?? ''
    };
  });
  expect(result.discovery).toMatchObject({
    id: 'plumes',
    name: 'Plumes',
    found: 3,
    total: 14,
    stage: 'Uncharted',
    nextMilestone: 'Trail Mark',
    nextTarget: 4,
    complete: false
  });
  expect(result.collection).toMatchObject({
    id: 'plumes',
    name: 'Plumes',
    found: 0,
    owned: 0,
    discovered: 3,
    total: 14,
    stage: 'Ready to Begin',
    complete: false,
  });
  expect(result.hiddenRailCount).toBe(0);
  expect(result.railCount).toBe(1);
  expect(result.collectionHeading).toContain('Collection Atlas');
  expect(result.nextGoal).toContain('PLUMES TRAIL MARK');
  expect(result.nextGoal).toContain('Discover 1 more card');
});

test('outcome flight codes copy a shared route link that launches the same seed and length', async ({ page }) => {
  await boot(page);
  const copied = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value: string) => window.localStorage.setItem('test.sharedRouteLink', value) }
    });
    await window.__birdSquadStartScene!('RouteScene');
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    const runState = { ...route.runState, seed: 'shared-rooftop-7', runMode: 'quick' };
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry', runState });
    g.scene.stop('RouteScene');
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && !battle.fxLayer?.active; i += 1) await wait(50);
    battle.mode = 'defeat';
    battle.emitRunSummary('loss');
    battle.renderAll();
    const collectObjects = (children: any[]): any[] => children.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collectObjects(child.list) : [])
    ]);
    let flightCode: any;
    let flightCodeHit: any;
    for (let i = 0; i < 80 && (!flightCode || !flightCodeHit); i += 1) {
      const objects = collectObjects(battle.root?.list ?? []);
      flightCode = objects.find((child: any) => child.name === 'run-outcome-flight-link-label');
      flightCodeHit = objects.find((child: any) => child.name === 'run-outcome-flight-link-hit');
      if (!flightCode || !flightCodeHit) await wait(50);
    }
    if (!flightCode || !flightCodeHit) return {
      link: '',
      feedback: collectObjects(battle.root?.list ?? [])
        .map((child: any) => child.text)
        .filter((text: unknown): text is string => typeof text === 'string')
        .join(' || ')
    };
    flightCodeHit.emit('pointerdown');
    for (let i = 0; i < 40 && !flightCode.text.includes('LINK COPIED'); i += 1) await wait(25);
    return {
      link: window.localStorage.getItem('test.sharedRouteLink') ?? '',
      feedback: flightCode.text
    };
  });
  expect(copied.link, copied.feedback).not.toBe('');
  const copiedUrl = new URL(copied.link);
  expect(copiedUrl.searchParams.get('flight')).toBe('shared-rooftop-7');
  expect(copiedUrl.searchParams.get('length')).toBe('quick');
  expect(copied.feedback).toContain('LINK COPIED');

  await boot(page, `${copiedUrl.pathname}${copiedUrl.search}`);
  // The title's first text snapshot is a minimal stand-in while the lazy menu
  // debug module loads; wait for the full snapshot before reading sharedRoute.
  await page.waitForFunction(() => 'settingsOpen' in JSON.parse(window.render_game_to_text?.() ?? '{}'));
  const launched = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const menuState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    const startLabelVisible = menu.children.list.some((child: any) => child.visible && child.text === (menu.menuHasSavedRun ? 'Shared Route' : 'Fly Shared Route'));
    menu.startRun();
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    for (let i = 0; i < 40 && route.runState?.seed !== 'shared-rooftop-7'; i += 1) await wait(50);
    return {
      menuState,
      seed: route.runState.seed,
      runMode: route.runState.runMode,
      startLabelVisible
    };
  });
  expect(launched.menuState.sharedRoute).toEqual({ seed: 'shared-rooftop-7', runMode: 'quick' });
  expect(launched.menuState.selectedRunMode).toBe('quick');
  expect(launched.startLabelVisible).toBe(true);
  expect(launched.seed).toBe('shared-rooftop-7');
  expect(launched.runMode).toBe('quick');
});

test('run-complete outcome celebrates fresh meta progress with a record strip', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    window.localStorage.removeItem('birdsquad.account');
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !scene.flock; i += 1) await wait(50);
    scene.flock.hp = Math.max(scene.flock.hp, 36);
    scene.turn = 4;
    scene.runDistrictContracts = [{
      mapIndex: 0,
      id: 'hold_line',
      baselineCombatResults: 0,
      baselineRewardEvents: 0,
      baselineSnags: 0,
      completed: true
    }];
    scene.mode = 'runComplete';
    scene.emitRunSummary('win');
    scene.renderAll();
    const outcomeKeys = [
      'ui-icon-unlock-badge',
      'ui-icon-progression-unlock-flourish',
      'ui-icon-run-outcome-flourish',
      'ui-icon-run-outcome-stat-row-frame',
      'ui-icon-run-outcome-command-frame',
      'ui-icon-run-outcome-report-frame',
      'ui-icon-run-outcome-title-plaque'
    ];
    for (let i = 0; i < 80 && !outcomeKeys.every((key) => scene.textures.exists(key)); i += 1) await wait(50);
    scene.renderAll();
    await wait(0);
    const state = scene.getTextState();
    const rootTexts = scene.root.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
    return {
      iconLoaded: scene.textures.exists('ui-icon-unlock-badge'),
      unlockFlourishLoaded: scene.textures.exists('ui-icon-progression-unlock-flourish'),
      flourishLoaded: scene.textures.exists('ui-icon-run-outcome-flourish'),
      flourishRendered: scene.root.list.some((child: any) => child.texture?.key === 'ui-icon-run-outcome-flourish'),
      unlockFlourishRendered: scene.root.list.some((child: any) => child.texture?.key === 'ui-icon-progression-unlock-flourish'),
      unlockHighlights: state.unlockHighlights,
      runOutcomeStatRowFrame: state.runOutcomeStatRowFrame,
      runOutcomeCommandFrame: state.runOutcomeCommandFrame,
      runOutcomeReportFrame: state.runOutcomeReportFrame,
      runOutcomeTitlePlaque: state.runOutcomeTitlePlaque,
      account: JSON.parse(window.localStorage.getItem('birdsquad.account') ?? '{}'),
      rootTexts
    };
  });
  const names = result.unlockHighlights.items.map((item: any) => item.name);
  expect(result.iconLoaded).toBe(true);
  expect(result.unlockFlourishLoaded).toBe(true);
  expect(result.flourishLoaded).toBe(true);
  expect(result.flourishRendered).toBe(false);
  expect(result.unlockFlourishRendered).toBe(false);
  expect(result.unlockHighlights.iconLoaded).toBe(true);
  expect(result.unlockHighlights.flourishLoaded).toBe(true);
  expect(result.runOutcomeStatRowFrame.loaded).toBe(true);
  expect(result.runOutcomeStatRowFrame.rendered).toBe(false);
  expect(result.runOutcomeStatRowFrame.count).toBe(0);
  expect(result.runOutcomeCommandFrame.loaded).toBe(true);
  expect(result.runOutcomeCommandFrame.rendered).toBe(false);
  expect(result.runOutcomeCommandFrame.count).toBe(0);
  expect(result.runOutcomeReportFrame.loaded).toBe(true);
  expect(result.runOutcomeReportFrame.rendered).toBe(false);
  expect(result.runOutcomeReportFrame.count).toBe(0);
  expect(result.runOutcomeTitlePlaque.loaded).toBe(true);
  expect(result.runOutcomeTitlePlaque.rendered).toBe(false);
  expect(result.runOutcomeTitlePlaque.count).toBe(0);
  expect(names).toContain('The Talon');
  expect(names).toContain('First Flight');
  expect(names).toContain('Hold The Line');
  expect(names).toContain('The Fledgling Flock Ascension 0 Clear');
  expect(result.unlockHighlights.items.some((item: any) => item.kind === 'contract')).toBe(true);
  expect(result.unlockHighlights.items.some((item: any) => item.kind === 'record')).toBe(true);
  expect(result.account.leaderRecords.fledgling.clears['full:0']).toEqual({ wins: 1, fastestRunTurns: 4 });
  expect(result.rootTexts.some((text: string) => text.startsWith('NEW PROGRESS:'))).toBe(true);
});

test('one-flight strategy achievements reward varied play without cumulative grind', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await boot(page);
  const runs = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    window.localStorage.removeItem('birdsquad.account');
    const finishLoss = async (
      surgesTriggered: number,
      cleanFights: number,
      blockedDamage: number,
      completedContracts: number,
    ) => {
      await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
      game.scene.stop('MenuScene');
      const scene: any = game.scene.getScene('BattleScene');
      for (let i = 0; i < 40 && !scene.flock; i += 1) await wait(50);
      const fightCount = Math.max(1, cleanFights);
      scene.runCombatResults = Array.from({ length: fightCount }, (_, index) => ({
        nodeId: index === fightCount - 1 ? 'm1_boss' : `strategy-${index}`,
        encounterId: `strategy-${index}`,
        turnsTaken: 4,
        cohesionLost: index < cleanFights ? 0 : 1,
        decisionStats: {
          cardsPlayed: 3,
          overextensions: 0,
          lowCardTurns: 0,
          noOverextensionTurns: 1,
          cardsHeldAtRoost: 0,
          unspentWingbeatAtRoost: 0,
          maxCardsPlayedTurn: 3,
          surgesTriggered: index === 0 ? surgesTriggered : 0,
          blockedDamage: index === 0 ? blockedDamage : 0,
          invalidActions: 0,
          cancelledActions: 0,
        },
      }));
      scene.runDistrictContracts = Array.from({ length: completedContracts }, (_, mapIndex) => ({
        mapIndex,
        id: 'hold_line',
        baselineCombatResults: 0,
        baselineRewardEvents: 0,
        baselineSnags: 0,
        completed: true,
        rewardClaimed: true,
      }));
      scene.mode = 'defeat';
      scene.emitRunSummary('loss');
      return {
        newAchievements: [...scene.lastRunRewards.newAchievements],
        progress: { ...scene.lastRunRewards.account.leaderProgress.fledgling },
      };
    };
    return {
      firstNearMiss: await finishLoss(2, 2, 23, 2),
      secondNearMiss: await finishLoss(2, 2, 23, 2),
      qualifying: await finishLoss(3, 3, 24, 3),
      account: JSON.parse(window.localStorage.getItem('birdsquad.account') ?? '{}'),
    };
  });

  const strategyIds = ['live_wire', 'still_air', 'brace_brigade', 'every_promise'];
  expect(runs.firstNearMiss.newAchievements).toEqual([]);
  expect(runs.secondNearMiss.newAchievements).toEqual([]);
  expect(runs.secondNearMiss.progress).toMatchObject({
    surges: 4,
    cleanFights: 4,
    blockedDamage: 46,
    contracts: 4,
  });
  expect(runs.qualifying.newAchievements).toEqual(strategyIds);
  expect(runs.account.losses).toBe(3);
  expect(runs.account.wins).toBe(0);
  expect(runs.account.achievements).toEqual([
    'collection_first_shelf',
    'collection_suit_sampler',
    ...strategyIds,
  ]);

  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').badgePagination?.page === 1);
  const firstPage = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(firstPage.badgePagination).toMatchObject({
    page: 1,
    pageCount: 6,
    visibleStart: 1,
    visibleEnd: 3,
    visibleCount: 3,
    total: 18,
  });

  await page.keyboard.press('PageDown');
  const keyboardPage = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(keyboardPage.badgePagination).toMatchObject({
    page: 2,
    pageCount: 6,
    visibleStart: 4,
    visibleEnd: 6,
    visibleCount: 3,
  });
  expect(keyboardPage.badgePagination.items.filter((item: any) => strategyIds.includes(item.id))).toEqual([]);

  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 4 });
  });
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).badgePagination.page).toBe(1);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.children.list.find((child: any) => child.name === 'profile-badge-page-next')?.emit('pointerdown');
  });
  const pointerPage = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(pointerPage.badgePagination.page).toBe(2);
  await page.screenshot({
    path: '.artifacts/test-results/strategy-achievements/minimum-landscape-page-2.png',
    fullPage: true,
  });
  const pagerGeometry = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return profile.children.list
      .filter((child: any) => child.name?.startsWith('profile-badge-page-') && child.input?.enabled)
      .map((child: any) => ({ name: child.name, width: child.displayWidth, height: child.displayHeight }));
  });
  expect(pagerGeometry).toEqual([
    { name: 'profile-badge-page-previous', width: 160, height: 58 },
    { name: 'profile-badge-page-next', width: 160, height: 58 },
  ]);

  const badges = [...firstPage.badgePagination.items, ...pointerPage.badgePagination.items];
  for (let next = 3; next <= firstPage.badgePagination.pageCount; next++) {
    await page.keyboard.press('PageDown');
    const current = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).badgePagination;
    expect(current.page).toBe(next);
    badges.push(...current.items);
  }
  expect(new Set(badges.map((item: any) => item.id)).size).toBe(18);
  expect(badges.filter((item: any) => strategyIds.includes(item.id))).toEqual([
    { id: 'live_wire', name: 'Live Wire', description: 'Trigger 3 Surges in one flight.', earned: true },
    { id: 'still_air', name: 'Still Air', description: 'Clear 3 fights without losing Cohesion in one flight.', earned: true },
    { id: 'brace_brigade', name: 'Brace Brigade', description: 'Block 24 damage in one flight.', earned: true },
    { id: 'every_promise', name: 'Every Promise', description: 'Complete 3 district contracts in one flight.', earned: true },
  ]);

  await page.evaluate(async () => {
    const account = JSON.parse(window.localStorage.getItem('birdsquad.account') ?? '{}');
    account.contractBadges = [
      '0:hold_line',
      '1:clean_flight',
      '2:bright_signal',
      '3:lean_route',
      '0:clean_flight',
      '1:bright_signal',
      '2:lean_route',
    ];
    window.localStorage.setItem('birdsquad.account', JSON.stringify(account));
    await window.__birdSquadStartScene!('ProfileScene');
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').badgePagination?.page === 1);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.badgeView = 'contracts';
    profile.renderPremiumProfileScene();
  });
  let contractPage = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(contractPage.badgePagination).toMatchObject({
    page: 1,
    pageCount: 3,
    visibleCount: 3,
    total: 7,
  });
  const contractItems = [...contractPage.badgePagination.items];
  await page.keyboard.press('PageDown');
  contractPage = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(contractPage.badgePagination).toMatchObject({
    page: 2,
    pageCount: 3,
    visibleStart: 4,
    visibleEnd: 6,
    visibleCount: 3,
    total: 7,
  });
  contractItems.push(...contractPage.badgePagination.items);
  await page.keyboard.press('PageDown');
  contractPage = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(contractPage.badgePagination).toMatchObject({
    page: 3,
    pageCount: 3,
    visibleStart: 7,
    visibleEnd: 7,
    visibleCount: 1,
    total: 7,
  });
  contractItems.push(...contractPage.badgePagination.items);
  expect(new Set(contractItems.map((item: any) => item.id)).size).toBe(7);
  expect(contractItems.slice(-2)).toEqual([
    {
      id: '1:bright_signal',
      name: 'Bright Signal',
      description: 'District 2 / Trigger Surge in three fights',
      earned: true,
    },
    {
      id: '2:lean_route',
      name: 'Lean Route',
      description: 'District 3 / Skip two card rewards',
      earned: true,
    },
  ]);
});

test('Leader records separate Full and Quick clears and only celebrate real improvements', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    window.localStorage.removeItem('birdsquad.account');
    const finish = async (runMode: 'full' | 'quick', difficulty: number, turns: number) => {
      await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
      game.scene.stop('MenuScene');
      const scene: any = game.scene.getScene('BattleScene');
      for (let i = 0; i < 40 && !scene.flock; i += 1) await wait(50);
      scene.runMode = runMode;
      scene.runDifficulty = difficulty;
      scene.turn = turns;
      scene.mode = 'runComplete';
      scene.emitRunSummary('win');
      return scene.lastRunRewards.newPersonalRecords;
    };
    const firstFull = await finish('full', 2, 7);
    const fasterFull = await finish('full', 2, 5);
    const slowerFull = await finish('full', 2, 6);
    const firstQuick = await finish('quick', 2, 3);
    return {
      firstFull,
      fasterFull,
      slowerFull,
      firstQuick,
      account: JSON.parse(window.localStorage.getItem('birdsquad.account') ?? '{}'),
    };
  });

  expect(result.firstFull).toEqual([
    { leaderId: 'fledgling', mode: 'full', tier: 2, turns: 7, firstClear: true, newAscensionClear: true },
  ]);
  expect(result.fasterFull).toEqual([
    { leaderId: 'fledgling', mode: 'full', tier: 2, turns: 5, firstClear: false, newAscensionClear: false },
  ]);
  expect(result.slowerFull).toEqual([]);
  expect(result.firstQuick).toEqual([
    { leaderId: 'fledgling', mode: 'quick', tier: 2, turns: 3, firstClear: true, newAscensionClear: false },
  ]);
  expect(result.account.leaderRecords.fledgling.clears).toMatchObject({
    'full:2': { wins: 3, fastestRunTurns: 5 },
    'quick:2': { wins: 1, fastestRunTurns: 3 },
  });
});

test('outcome screens retain the crest without ornamental text frames', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !scene.flock; i += 1) await wait(50);
    const count = () => scene.root.list
      .filter((child: any) => child.texture?.key === 'ui-icon-run-outcome-flourish')
      .length;
    const rowFrameCount = () => scene.root.list
      .filter((child: any) => child.texture?.key === 'ui-icon-run-outcome-stat-row-frame')
      .length;
    const commandFrameCount = () => scene.root.list
      .filter((child: any) => child.texture?.key === 'ui-icon-run-outcome-command-frame')
      .length;
    const reportFrameCount = () => scene.root.list
      .filter((child: any) => child.texture?.key === 'ui-icon-run-outcome-report-frame')
      .length;
    const titlePlaqueCount = () => scene.root.list
      .filter((child: any) => child.texture?.key === 'ui-icon-run-outcome-title-plaque')
      .length;
    scene.mode = 'runComplete';
    scene.renderAll();
    const outcomeKeys = [
      'ui-icon-run-outcome-flourish',
      'ui-icon-run-outcome-stat-row-frame',
      'ui-icon-run-outcome-command-frame',
      'ui-icon-run-outcome-report-frame',
      'ui-icon-run-outcome-title-plaque'
    ];
    for (let i = 0; i < 80 && !outcomeKeys.every((key) => scene.textures.exists(key)); i += 1) await wait(50);
    for (let i = 0; i < 80 && !scene.bossDossierModule; i += 1) await wait(50);
    scene.renderAll();
    await wait(0);
    const winCount = count();
    const winRowFrameCount = rowFrameCount();
    const winCommandFrameCount = commandFrameCount();
    const winReportFrameCount = reportFrameCount();
    const winTitlePlaqueCount = titlePlaqueCount();
    const winCrest = scene.root.list.find((child: any) => child.texture?.key === 'ui-icon-run-outcome-crest');
    scene.mode = 'defeat';
    scene.renderAll();
    const defeatCount = count();
    const defeatRowFrameCount = rowFrameCount();
    const defeatCommandFrameCount = commandFrameCount();
    const defeatReportFrameCount = reportFrameCount();
    const defeatTitlePlaqueCount = titlePlaqueCount();
    const defeatCrest = scene.root.list.find((child: any) => child.texture?.key === 'ui-icon-run-outcome-crest');
    return {
      loaded: scene.textures.exists('ui-icon-run-outcome-flourish'),
      rowFrameLoaded: scene.textures.exists('ui-icon-run-outcome-stat-row-frame'),
      commandFrameLoaded: scene.textures.exists('ui-icon-run-outcome-command-frame'),
      reportFrameLoaded: scene.textures.exists('ui-icon-run-outcome-report-frame'),
      titlePlaqueLoaded: scene.textures.exists('ui-icon-run-outcome-title-plaque'),
      statLabels: scene.root.list.filter((child: any) => child.name === 'run-outcome-stat-label').map((child: any) => child.text),
      commands: scene.root.list.filter((child: any) => child.name === 'run-outcome-command-hit').map((child: any) => child.getData('label')),
      winCount,
      defeatCount,
      winRowFrameCount,
      defeatRowFrameCount,
      winCommandFrameCount,
      defeatCommandFrameCount,
      winReportFrameCount,
      defeatReportFrameCount,
      winTitlePlaqueCount,
      defeatTitlePlaqueCount,
      winCrest: winCrest ? { width: winCrest.displayWidth, height: winCrest.displayHeight } : null,
      defeatCrest: defeatCrest ? { width: defeatCrest.displayWidth, height: defeatCrest.displayHeight } : null
    };
  });

  expect(result.loaded).toBe(true);
  expect(result.rowFrameLoaded).toBe(true);
  expect(result.commandFrameLoaded).toBe(true);
  expect(result.reportFrameLoaded).toBe(true);
  expect(result.titlePlaqueLoaded).toBe(true);
  expect(result.winCount).toBe(0);
  expect(result.defeatCount).toBe(0);
  expect(result.winRowFrameCount).toBe(0);
  expect(result.defeatRowFrameCount).toBe(0);
  expect(result.winCommandFrameCount).toBe(0);
  expect(result.defeatCommandFrameCount).toBe(0);
  expect(result.winReportFrameCount).toBe(0);
  expect(result.defeatReportFrameCount).toBe(0);
  expect(result.winTitlePlaqueCount).toBe(0);
  expect(result.defeatTitlePlaqueCount).toBe(0);
  expect(result.statLabels).toEqual(['Districts', 'Encounters cleared', 'Damage dealt / taken']);
  // This synthetic outcome has no emitted RunSummary to inspect.
  expect(result.commands).toEqual(['Replay Flight', 'Main Menu']);
  expect(result.winCrest).not.toBeNull();
  expect(result.defeatCrest).not.toBeNull();
  expect(result.winCrest?.width).toBeLessThanOrEqual(190);
  expect(result.winCrest?.height).toBeLessThanOrEqual(190);
  expect(result.defeatCrest?.width).toBeLessThanOrEqual(190);
  expect(result.defeatCrest?.height).toBeLessThanOrEqual(190);
});

test('locked Flock Leaders are gated until unlocked, and the Profile screen renders', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const menu: any = g.scene.getScene('MenuScene');
    for (let i = 0; i < 20 && !(menu.leaderPanels?.length); i += 1) await wait(50); // panels build a tick after boot
    // Default account: talon is locked, so selecting it must be a no-op.
    const def = menu.selectedLeaderId;
    menu.selectLeader('talon');
    const afterLockedPick = menu.selectedLeaderId;
    // spark_caller ships unlocked — selecting it sticks.
    menu.selectLeader('spark_caller');
    const afterUnlockedPick = menu.selectedLeaderId;
    // Unlock talon, re-enter the menu, and confirm it can now be picked.
    window.localStorage.setItem('birdsquad.account', JSON.stringify({
      runs: 3, wins: 3, losses: 0, winsByLeader: { fledgling: 3 }, runsByLeader: { fledgling: 3 }, bestWinTier: 2, fastestWinTurns: 6,
      unlockedLeaders: ['fledgling', 'spark_caller', 'talon'], achievements: ['first_flight'],
      contractBadges: ['0:clean_flight'],
      discoveredCards: ['major_00', 'cups_ace', 'wands_ace'],
      leaderRecords: {
        fledgling: {
          clears: {
            'full:2': { wins: 1, fastestRunTurns: 42 },
            'quick:0': { wins: 2, fastestRunTurns: 24 },
          }
        }
      },
    }));
    await window.__birdSquadStartScene!('MenuScene');
    await wait(150);
    const menu2: any = g.scene.getScene('MenuScene');
    menu2.selectLeader('talon');
    const afterUnlockTalon = menu2.selectedLeaderId;
    // The Profile screen renders against the account without throwing.
    await window.__birdSquadStartScene!('ProfileScene');
    for (let i = 0; i < 40; i += 1) {
      if (g.scene.getScene('ProfileScene').children.getByName('profile-dashboard-surface')) break;
      await wait(50);
    }
    const profileActive = g.scene.getScenes(true).map((s: any) => s.scene.key).includes('ProfileScene');
    const profileText = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const recordTextureLoaded = g.textures.exists('ui-icon-record-medallion');
    const achievementTextureLoaded = g.textures.exists('ui-icon-achievement-medallion');
    const leaderRecordTextureLoaded = g.textures.exists('ui-icon-leader-record-medallion');
    const profileScene: any = g.scene.getScene('ProfileScene');
    const profileFlourishLoaded = g.textures.exists('ui-icon-profile-record-flourish');
    const profileTitlePlaqueLoaded = g.textures.exists('ui-icon-profile-title-plaque');
    const profileStatChipFrameLoaded = g.textures.exists('ui-icon-profile-stat-chip-frame');
    const profileRecordRowFrameLoaded = g.textures.exists('ui-icon-profile-record-row-frame');
    const profileSectionTabFrameLoaded = g.textures.exists('ui-icon-profile-section-tab-frame');
    const profileProgressRailFrameLoaded = g.textures.exists('ui-icon-profile-progress-rail-frame');
    const profileProgressFillStripLoaded = g.textures.exists('ui-icon-profile-progress-fill-strip');
    const profileReturnCommandFrameLoaded = g.textures.exists('ui-icon-profile-return-command-frame');
    const profileFlourishObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-record-flourish' || child.name === 'profile-record-flourish')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible, name: child.name, texture: child.texture?.key }));
    const profileTitlePlaqueObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-title-plaque')
      .map((child: any) => ({
        alpha: child.alpha,
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const profileStatChipFrameObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-stat-chip-frame')
      .map((child: any) => ({
        alpha: child.alpha,
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const profileRecordRowFrameObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-record-row-frame')
      .map((child: any) => ({
        alpha: child.alpha,
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const profileSectionTabFrameObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-section-tab-frame')
      .map((child: any) => ({
        alpha: child.alpha,
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const profileProgressRailFrameObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-progress-rail-frame')
      .map((child: any) => ({
        alpha: child.alpha,
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const profileProgressFillStripObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-progress-fill-strip')
      .map((child: any) => ({
        alpha: child.alpha,
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name,
        tint: child.tintTopLeft
      }));
    const profileReturnCommandFrameObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-return-command-frame')
      .map((child: any) => ({
        alpha: child.alpha,
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const leaderRecordIcons = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-leader-record-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const achievementIcons = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-achievement-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const profileTouchTargets = profileScene.children.list
      .filter((child: any) => child.input?.enabled && child.type === 'Rectangle')
      .map((child: any) => ({ width: child.displayWidth, height: child.displayHeight }));
    const profilePagerTargets = profileScene.children.list
      .filter((child: any) => child.input?.enabled && /^profile-badge-page-(previous|next)$/.test(child.name ?? ''))
      .map((child: any) => ({ name: child.name, width: child.displayWidth, height: child.displayHeight }));
    const profileKeyListenersBefore = {
      escape: profileScene.input.keyboard.listenerCount('keydown-ESC'),
      mute: profileScene.input.keyboard.listenerCount('keydown-M')
    };
    profileScene.badgeView = 'contracts';
    profileScene.renderPremiumProfileScene();
    const profileKeyListenersAfter = {
      escape: profileScene.input.keyboard.listenerCount('keydown-ESC'),
      mute: profileScene.input.keyboard.listenerCount('keydown-M')
    };
    const contractProfileText = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const contractBadgeLabels = profileScene.children.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text)
      .filter((text: string) => text.includes('Clean Flight') || text.includes('District 1'));
    profileScene.badgeView = 'leaders';
    profileScene.renderPremiumProfileScene();
    const personalRecordLabels = profileScene.children.list
      .filter((child: any) => child.name === 'profile-leader-detail' && child.getData('leaderId') === 'fledgling')
      .map((child: any) => child.text);
    return {
      def,
      afterLockedPick,
      afterUnlockedPick,
      afterUnlockTalon,
      profileActive,
      profileText,
      recordTextureLoaded,
      profileFlourishLoaded,
      profileTitlePlaqueLoaded,
      profileStatChipFrameLoaded,
      profileRecordRowFrameLoaded,
      profileSectionTabFrameLoaded,
      profileProgressRailFrameLoaded,
      profileProgressFillStripLoaded,
      profileReturnCommandFrameLoaded,
      profileFlourishObjects,
      profileTitlePlaqueObjects,
      profileStatChipFrameObjects,
      profileRecordRowFrameObjects,
      profileSectionTabFrameObjects,
      profileProgressRailFrameObjects,
      profileProgressFillStripObjects,
      profileReturnCommandFrameObjects,
      achievementTextureLoaded,
      leaderRecordTextureLoaded,
      leaderRecordIcons,
      achievementIcons,
      profileTouchTargets,
      profilePagerTargets,
      profileKeyListenersBefore,
      profileKeyListenersAfter,
      contractProfileText,
      contractBadgeLabels,
      personalRecordLabels
    };
  });
  expect(r.afterLockedPick).toBe(r.def);             // locked pick ignored
  expect(r.afterLockedPick).not.toBe('talon');
  expect(r.afterUnlockedPick).toBe('spark_caller');  // unlocked pick works
  expect(r.afterUnlockTalon).toBe('talon');          // pickable once unlocked
  expect(r.profileActive).toBe(true);
  expect(r.recordTextureLoaded).toBe(true);
  expect(r.profileFlourishLoaded).toBe(false);
  expect(r.profileText.scene).toBe('ProfileScene');
  expect(r.profileText.playtestExport).toMatchObject({ enabled: false, localOnly: true, status: 'idle' });
  expect(r.profileText.progression.contractBadges).toBe(1);
  expect(r.profileText.leaderRecords.find((record: any) => record.id === 'fledgling')).toMatchObject({
    bestFullWinTier: 2,
    fastestFullWinTurns: 42,
    fastestQuickWinTurns: 24,
  });
  expect(r.personalRecordLabels).toEqual(['Best: Tier 2 · Full 42 beats · Quick 24 beats']);
  expect(r.contractProfileText.badgeView).toBe('contracts');
  expect(r.profileKeyListenersBefore).toEqual({ escape: 1, mute: 1 });
  expect(r.profileKeyListenersAfter).toEqual(r.profileKeyListenersBefore);
  expect(r.profilePagerTargets).toEqual([
    { name: 'profile-badge-page-next', width: 160, height: 58 },
  ]);
  expect(r.profileTouchTargets).toContainEqual({ width: 168, height: 58 });
  expect(r.contractProfileText.contractBadges).toContain('0:clean_flight');
  expect(r.contractBadgeLabels.length).toBeGreaterThanOrEqual(2);
  // Decorative frames were intentionally retired. Keep a regression guard
  // against reintroducing them; content and geometry are checked independently.
  for (const objects of [
    r.profileFlourishObjects, r.profileTitlePlaqueObjects, r.profileStatChipFrameObjects,
    r.profileRecordRowFrameObjects, r.profileSectionTabFrameObjects,
    r.profileProgressRailFrameObjects, r.profileProgressFillStripObjects,
    r.profileReturnCommandFrameObjects,
  ]) expect(objects).toEqual([]);
  expect(r.profileText.badgePagination.visibleCount).toBe(3);
  expect(r.profileText.progression.leadersUnlocked).toBe(3);
  expect(r.profileText.progression.achievementsEarned).toBe(1);
  expect(r.profileText.progression.discoveredCards).toBe(3);
  expect(r.leaderRecordIcons).toEqual([]);
  expect(r.achievementIcons).toEqual([]);
});

test('Flock Record focus follows remapped keyboard and gamepad controls with one cue per action', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('birdsquad.controlBindings', JSON.stringify({
      version: 1,
      bindings: { confirm: 'Space', back: 'KeyQ', previous: 'KeyA', next: 'KeyD' },
    }));
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').scene === 'ProfileScene');
  const initial = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));

  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 15 });
  });
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).focus.current).toBe('contracts');
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 14 });
  });
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).focus.current).toBe('achievements');

  await page.keyboard.press('d');
  await page.keyboard.press('d');
  await page.keyboard.press('d');
  await page.keyboard.press('d');
  await page.keyboard.press('d');
  await page.keyboard.press('d');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).focus.current).toBe('saveData');
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 0 });
  });
  let modal = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(modal.saveData.open).toBe(true);
  expect(modal.focus).toMatchObject({ current: 'saveDownload', order: ['saveDownload', 'saveRestore'], previous: 'A', next: 'D', confirm: 'Space', back: 'Q' });
  const modalLabels = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return profile.children.list.map((child: any) => child.text).filter((text: unknown) => typeof text === 'string');
  });
  expect(modalLabels).toContain('A / D: navigate · Space: select · Q: close');
  await page.keyboard.press('d');
  await page.keyboard.press('d');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).focus.current).toBe('saveDownload');
  await page.keyboard.press('q');
  modal = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(modal.saveData.open).toBe(false);
  expect(modal.focus.current).toBe('saveData');
  await page.keyboard.press('Space');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).saveData.open).toBe(true);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 1 });
  });
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).saveData.open).toBe(false);
  await page.keyboard.press('a');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).focus.current).toBe('return');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').scene === 'MenuScene');
  const finalState = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect((finalState.audio.cueRequests.confirm ?? 0) - (initial.audio.cueRequests.confirm ?? 0)).toBe(13);
  expect((finalState.audio.cueRequests.close ?? 0) - (initial.audio.cueRequests.close ?? 0)).toBe(3);
});

test('Flock Record downloads a complete local save backup without uploading data', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      runs: 7, wins: 3, losses: 4, unlockedLeaders: ['fledgling', 'talon'],
      achievements: ['first_win'], discoveredCards: ['major_00', 'wands_ace'],
      favoriteCards: ['major_00'], hunt: ['wands_ace'], bestWinTier: 1,
      lockedCards: ['major_00'],
      cardTags: { major_00: 'keepsake', wands_ace: 'experiment' },
      cardJournal: { major_00: 'Remember the first rooftop Surge.' },
      showcase: ['major_00', 'wands_ace'],
      cardCollection: {
        major_00: { timesClaimed: 1, firstAcquiredAt: 1_718_323_200_000, firstSource: 'combat_reward', isNew: true },
      },
    };
    const activeRun = {
      deck: [{ id: 'major_00', upgraded: true }], leaderId: 'talon', difficulty: 1,
      runMode: 'quick', seed: 'backup-flight', currentHp: 27, scrap: 19,
    };
    const runs = [{ id: 'backup-history-1', result: 'win', seed: 'history-seed' }];
    const guide = { version: 1, seen: ['welcome'], completed: false, skipped: 0 };
    for (const [key, value] of Object.entries({
      'birdsquad.account': account,
      'birdsquad.run.active': activeRun,
      'birdsquad.runs': runs,
      'birdsquad.firstFlightGuide': guide,
    })) {
      const raw = JSON.stringify(value);
      localStorage.setItem(key, raw);
      localStorage.setItem(`${key}.backup`, raw);
    }
    localStorage.setItem('birdsquad.graphicsQuality', 'lean');
    localStorage.setItem('birdsquad.visualContrast', 'high');
    localStorage.setItem('birdsquad.colorCues', 'reinforced');
    localStorage.setItem('birdsquad.screenShake', 'off');
    localStorage.setItem('birdsquad.flashEffects', 'reduced');
    localStorage.setItem('birdsquad.motionPreference', 'reduced');
    localStorage.setItem('birdsquad.combatPace', 'snappy');
    localStorage.setItem('birdsquad.animationPace', 'fast');
    localStorage.setItem('birdsquad.textPace', 'fast');
    localStorage.setItem('birdsquad.screenReader', 'on');
    localStorage.setItem('birdsquad.musicVolume', '0.35');
    localStorage.setItem('birdsquad.sfxVolume', '0.65');
    localStorage.setItem('birdsquad.voiceVolume', '0.45');
    localStorage.setItem('birdsquad.ambienceVolume', '0.55');
    localStorage.setItem('birdsquad.audioMuted', '1');
    localStorage.setItem('birdsquad.maxTier', '2');
    localStorage.setItem('birdsquad.codexCardLens', 'seen');
    localStorage.setItem('birdsquad.codexCardSearch', 'Twin Plume');
    localStorage.setItem('birdsquad.codexCardSort', 'recent');
    localStorage.setItem('birdsquad.codexSavedViews', JSON.stringify([
      {
        id: 'view-backup-1',
        name: 'Untrusted display name',
        tab: 'plumes',
        lens: 'seen',
        query: 'Twin Plume',
        sort: 'recent',
        createdAt: 1_718_323_200_001,
      },
      { id: 'invalid-view', tab: 'unknown', lens: 'all', query: '', sort: 'binder' },
    ]));
    localStorage.setItem('unrelated.origin.key', 'must-not-export');
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  const mutatingRequests: string[] = [];
  page.on('request', (request) => {
    if (['POST', 'PUT', 'PATCH'].includes(request.method())) mutatingRequests.push(request.url());
  });
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-data-hit');
  const beforeDownload = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  const downloadPromise = page.waitForEvent('download');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-download-hit');
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('Save backup did not produce a local file');
  const raw = await readFile(downloadedPath, 'utf8');
  const payload = JSON.parse(raw);
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));

  expect(download.suggestedFilename()).toMatch(/^bird-squad-save-\d{4}-\d{2}-\d{2}\.json$/);
  expect(payload).toMatchObject({
    format: 'bird-squad-save',
    version: 1,
    data: {
      account: {
        runs: 7,
        wins: 3,
        losses: 4,
        discoveredCards: ['major_00', 'wands_ace'],
        favoriteCards: ['major_00'],
        lockedCards: ['major_00'],
        hunt: ['wands_ace'],
        cardTags: { major_00: 'keepsake', wands_ace: 'experiment' },
        cardJournal: { major_00: 'Remember the first rooftop Surge.' },
        showcase: ['major_00', 'wands_ace'],
        cardCollection: {
          major_00: { timesClaimed: 1, firstAcquiredAt: 1_718_323_200_000, firstSource: 'combat_reward', isNew: true },
        },
      },
      activeRun: { seed: 'backup-flight', leaderId: 'talon', difficulty: 1 },
      runHistory: [{ id: 'backup-history-1' }],
      preferences: {
        graphicsQuality: 'lean', visualContrast: 'high', colorCues: 'reinforced', screenShake: 'off', flashEffects: 'reduced',
        motion: 'reduced', combatPace: 'snappy', animationPace: 'fast', textPace: 'fast', screenReader: 'on',
        musicVolume: 0.35, sfxVolume: 0.65, voiceVolume: 0.45, ambienceVolume: 0.55, audioMuted: true, maxTier: 2,
        codexCardLens: 'seen',
        codexCardSearch: 'Twin Plume',
        codexCardSort: 'recent',
        codexSavedViews: [{
          id: 'view-backup-1',
          name: 'Plumes · Seen · “Twin Plume” · Recent',
          tab: 'plumes',
          lens: 'seen',
          query: 'Twin Plume',
          sort: 'recent',
          createdAt: 1_718_323_200_001,
        }],
      },
    },
  });
  expect(Object.keys(payload.data)).toEqual(['account', 'activeRun', 'runHistory', 'guide', 'preferences']);
  expect(Object.keys(payload.data.preferences).sort()).toEqual([
    'ambienceVolume', 'animationPace', 'audioMuted', 'codexCardLens', 'codexCardSearch', 'codexCardSort', 'codexSavedViews', 'colorCues', 'combatPace', 'controls', 'flashEffects',
    'graphicsQuality', 'maxTier', 'motion', 'musicVolume', 'screenReader', 'screenShake', 'sfxVolume', 'textPace', 'visualContrast', 'voiceVolume',
  ]);
  expect(Object.keys(payload.data.preferences.controls).length).toBeGreaterThan(0);
  expect(raw).not.toContain('must-not-export');
  expect(state.saveData).toMatchObject({ open: true, status: 'downloaded' });
  expect((state.audio.cueRequests.confirm ?? 0) - (beforeDownload.audio.cueRequests.confirm ?? 0)).toBe(1);
  expect(mutatingRequests).toEqual([]);
});

test('Flock Record rejects an invalid restore before changing local data', async ({ page }) => {
  await page.addInitScript(() => {
    const raw = JSON.stringify({ runs: 2, wins: 1, losses: 1 });
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('unrelated.origin.key', 'keep-me');
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-data-hit');
  const chooserPromise = page.waitForEvent('filechooser');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-restore-file-hit');
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'not-a-bird-squad-save.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"wrong","version":1,"data":{}}'),
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').saveData?.status === 'invalid');
  const result = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return {
      account: localStorage.getItem('birdsquad.account'),
      accountBackup: localStorage.getItem('birdsquad.account.backup'),
      unrelated: localStorage.getItem('unrelated.origin.key'),
      confirmVisible: profile.children.list.some((child: any) => child.name === 'profile-save-restore-confirm-hit'),
      state: JSON.parse(window.render_game_to_text?.() ?? '{}').saveData,
    };
  });
  expect(JSON.parse(result.account ?? '{}')).toMatchObject({ runs: 2, wins: 1, losses: 1 });
  expect(result.accountBackup).toBe(result.account);
  expect(result.unrelated).toBe('keep-me');
  expect(result.confirmVisible).toBe(false);
  expect(result.state).toMatchObject({ open: true, status: 'invalid', pending: null });
});

test('Flock Record previews and confirms a transactional save restore', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      runs: 9, wins: 4, losses: 5, unlockedLeaders: ['fledgling', 'talon'],
      achievements: ['first_win'], discoveredCards: ['major_00', 'wands_ace'],
      favoriteCards: ['major_00'], hunt: ['wands_ace'], bestWinTier: 1,
      lockedCards: ['major_00'],
      cardTags: { major_00: 'keepsake', wands_ace: 'experiment' },
      decks: [{
        id: 'restore-folio',
        name: 'Restored Rooftop',
        leaderId: 'talon',
        cards: [{ id: 'major_00', upgraded: true }, { id: 'wands_ace', upgraded: false }],
        lineageId: 'restore-lineage',
        revision: 3,
        parentId: 'restore-parent',
        createdAt: 1_718_323_200_000,
        updatedAt: 1_718_323_200_000,
        favorite: true,
        sourceSeed: 'restore-folio-seed',
        runMode: 'quick',
      }],
      cardCollection: {
        major_00: { timesClaimed: 1, firstAcquiredAt: 1_718_323_200_000, firstSource: 'combat_reward', isNew: true },
      },
    };
    const activeRun = {
      deck: [{ id: 'major_00' }], leaderId: 'talon', difficulty: 1,
      runMode: 'quick', seed: 'restore-target', currentHp: 24, scrap: 33,
    };
    const runs = [{ id: 'restore-history', result: 'loss', seed: 'restore-history-seed' }];
    const guide = { version: 1, seen: ['welcome'], completed: true, skipped: 0 };
    for (const [key, value] of Object.entries({
      'birdsquad.account': account,
      'birdsquad.run.active': activeRun,
      'birdsquad.runs': runs,
      'birdsquad.firstFlightGuide': guide,
    })) {
      const raw = JSON.stringify(value);
      localStorage.setItem(key, raw);
      localStorage.setItem(`${key}.backup`, raw);
    }
    localStorage.setItem('birdsquad.graphicsQuality', 'lean');
    localStorage.setItem('birdsquad.visualContrast', 'high');
    localStorage.setItem('birdsquad.colorCues', 'reinforced');
    localStorage.setItem('birdsquad.screenShake', 'off');
    localStorage.setItem('birdsquad.flashEffects', 'reduced');
    localStorage.setItem('birdsquad.motionPreference', 'reduced');
    localStorage.setItem('birdsquad.combatPace', 'snappy');
    localStorage.setItem('birdsquad.animationPace', 'relaxed');
    localStorage.setItem('birdsquad.textPace', 'relaxed');
    localStorage.setItem('birdsquad.musicVolume', '0.40');
    localStorage.setItem('birdsquad.sfxVolume', '0.60');
    localStorage.setItem('birdsquad.voiceVolume', '0.50');
    localStorage.setItem('birdsquad.ambienceVolume', '0.30');
    localStorage.setItem('birdsquad.audioMuted', '1');
    localStorage.setItem('birdsquad.maxTier', '2');
    localStorage.setItem('birdsquad.codexCardLens', 'seen');
    localStorage.setItem('birdsquad.codexCardSearch', 'Twin Plume');
    localStorage.setItem('birdsquad.codexCardSort', 'recent');
    localStorage.setItem('birdsquad.codexSavedViews', JSON.stringify([{
      id: 'view-restore-1',
      name: 'Restore me',
      tab: 'plumes',
      lens: 'seen',
      query: 'Twin Plume',
      sort: 'recent',
      createdAt: 1_718_323_200_002,
    }]));
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-data-hit');
  const downloadPromise = page.waitForEvent('download');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-download-hit');
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('Restore fixture backup was not downloaded');
  const legacyBackup = JSON.parse(await readFile(downloadedPath, 'utf8'));
  legacyBackup.data.account.lockedCards = ['major_00', 'wands_ace', 'missing_card', 'major_00'];
  legacyBackup.data.account.showcase = ['major_00', 'missing_card', 'major_00', 'wands_ace', 'extra_card'];
  legacyBackup.data.account.decks.push(
    { ...legacyBackup.data.account.decks[0], name: 'Duplicate Must Drop' },
    { id: 'empty-folio', name: 'Empty Must Drop', leaderId: 'talon', cards: [] },
  );
  delete legacyBackup.data.preferences.ambienceVolume;
  delete legacyBackup.data.preferences.voiceVolume;
  delete legacyBackup.data.preferences.animationPace;
  delete legacyBackup.data.preferences.textPace;
  legacyBackup.data.preferences.codexSavedViews.push({
    id: 'invalid-restored-view',
    tab: 'invalid',
    lens: 'all',
    query: '',
    sort: 'binder',
  });
  const backupRaw = JSON.stringify(legacyBackup);

  await page.evaluate(() => {
    const current = JSON.stringify({ runs: 1, wins: 0, losses: 1 });
    localStorage.setItem('birdsquad.account', current);
    localStorage.setItem('birdsquad.account.backup', current);
    localStorage.setItem('birdsquad.runs', '[]');
    localStorage.setItem('birdsquad.runs.backup', '[]');
    localStorage.removeItem('birdsquad.run.active');
    localStorage.removeItem('birdsquad.run.active.backup');
    localStorage.setItem('birdsquad.graphicsQuality', 'full');
    localStorage.setItem('birdsquad.visualContrast', 'standard');
    localStorage.setItem('birdsquad.colorCues', 'standard');
    localStorage.setItem('birdsquad.screenShake', 'on');
    localStorage.setItem('birdsquad.flashEffects', 'full');
    localStorage.setItem('birdsquad.motionPreference', 'full');
    localStorage.setItem('birdsquad.animationPace', 'fast');
    localStorage.setItem('birdsquad.textPace', 'fast');
    localStorage.setItem('birdsquad.codexCardLens', 'all');
    localStorage.setItem('birdsquad.codexCardSearch', 'replace me');
    localStorage.setItem('birdsquad.codexCardSort', 'binder');
    localStorage.setItem('birdsquad.codexSavedViews', JSON.stringify([{
      id: 'replace-me',
      tab: 'major',
      lens: 'all',
      query: '',
      sort: 'binder',
      createdAt: 1,
    }]));
    localStorage.setItem('unrelated.origin.key', 'keep-current');
  });
  const chooserPromise = page.waitForEvent('filechooser');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-restore-file-hit');
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'bird-squad-save.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backupRaw),
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').saveData?.status === 'restoreReady');
  const beforeConfirm = await page.evaluate(() => ({
    account: JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}'),
    activeRun: localStorage.getItem('birdsquad.run.active'),
    unrelated: localStorage.getItem('unrelated.origin.key'),
    pending: JSON.parse(window.render_game_to_text?.() ?? '{}').saveData?.pending,
  }));
  expect(beforeConfirm.account).toMatchObject({ runs: 1, wins: 0 });
  expect(beforeConfirm.activeRun).toBeNull();
  expect(beforeConfirm.unrelated).toBe('keep-current');
  expect(beforeConfirm.pending).toMatchObject({ runs: 9, wins: 4, leaders: 3, activeRun: true });

  expect(await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return ['profile-save-restore-confirm-hit', 'profile-save-restore-cancel-hit']
      .map(name => {
        const hit = profile.children.getByName(name);
        return { kind: hit.getData('controlKind'), focused: hit.getData('focused') };
      });
  })).toEqual([{ kind: 'destructive', focused: false }, { kind: 'primary', focused: true }]);

  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-restore-confirm-hit');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').runs === 9);
  const restored = await page.evaluate(() => ({
    account: JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}'),
    runHistory: JSON.parse(localStorage.getItem('birdsquad.runs') ?? '[]'),
    activeRun: JSON.parse(localStorage.getItem('birdsquad.run.active') ?? '{}'),
    graphics: localStorage.getItem('birdsquad.graphicsQuality'),
    contrast: localStorage.getItem('birdsquad.visualContrast'),
    colorCues: localStorage.getItem('birdsquad.colorCues'),
    screenShake: localStorage.getItem('birdsquad.screenShake'),
    flashEffects: localStorage.getItem('birdsquad.flashEffects'),
    motion: localStorage.getItem('birdsquad.motionPreference'),
    animationPace: localStorage.getItem('birdsquad.animationPace'),
    textPace: localStorage.getItem('birdsquad.textPace'),
    ambienceVolume: localStorage.getItem('birdsquad.ambienceVolume'),
    voiceVolume: localStorage.getItem('birdsquad.voiceVolume'),
    codexCardLens: localStorage.getItem('birdsquad.codexCardLens'),
    codexCardSearch: localStorage.getItem('birdsquad.codexCardSearch'),
    codexCardSort: localStorage.getItem('birdsquad.codexCardSort'),
    codexSavedViews: JSON.parse(localStorage.getItem('birdsquad.codexSavedViews') ?? '[]'),
    accountMirror: localStorage.getItem('birdsquad.account.backup') === localStorage.getItem('birdsquad.account'),
    runMirror: localStorage.getItem('birdsquad.runs.backup') === localStorage.getItem('birdsquad.runs'),
    activeMirror: localStorage.getItem('birdsquad.run.active.backup') === localStorage.getItem('birdsquad.run.active'),
    guideMirror: localStorage.getItem('birdsquad.firstFlightGuide.backup') === localStorage.getItem('birdsquad.firstFlightGuide'),
    unrelated: localStorage.getItem('unrelated.origin.key'),
  }));
  expect(restored.account).toMatchObject({
    runs: 9,
    wins: 4,
    losses: 5,
    discoveredCards: ['major_00', 'wands_ace'],
    favoriteCards: ['major_00'],
    lockedCards: ['major_00'],
    hunt: ['wands_ace'],
    cardTags: { major_00: 'keepsake', wands_ace: 'experiment' },
    showcase: ['major_00', 'wands_ace'],
    decks: [{
      id: 'restore-folio',
      name: 'Restored Rooftop',
      leaderId: 'talon',
      cards: [{ id: 'major_00', upgraded: true }, { id: 'wands_ace', upgraded: false }],
      lineageId: 'restore-lineage',
      revision: 3,
      parentId: 'restore-parent',
      favorite: true,
      sourceSeed: 'restore-folio-seed',
      runMode: 'quick',
    }],
    cardCollection: {
      major_00: { timesClaimed: 1, firstAcquiredAt: 1_718_323_200_000, firstSource: 'combat_reward', isNew: true },
    },
  });
  expect(restored.runHistory).toEqual([expect.objectContaining({ id: 'restore-history' })]);
  expect(restored.activeRun).toMatchObject({ seed: 'restore-target', leaderId: 'talon', scrap: 33 });
  expect(restored).toMatchObject({
    graphics: 'lean', contrast: 'high', colorCues: 'reinforced', screenShake: 'off', flashEffects: 'reduced', motion: 'reduced',
    animationPace: 'standard',
    textPace: 'standard',
    ambienceVolume: '0.40',
    voiceVolume: '0.60',
    codexCardLens: 'seen',
    codexCardSearch: 'Twin Plume',
    codexCardSort: 'recent',
    codexSavedViews: [{
      id: 'view-restore-1',
      name: 'Plumes · Seen · “Twin Plume” · Recent',
      tab: 'plumes',
      lens: 'seen',
      query: 'Twin Plume',
      sort: 'recent',
      createdAt: 1_718_323_200_002,
    }],
    accountMirror: true, runMirror: true, activeMirror: true, guideMirror: true,
    unrelated: 'keep-current',
  });
});

test('playtest mode exports local run history from the Flock Record without an upload', async ({ page }) => {
  const exportedRun = {
    id: 'human-session-1', seed: 'first-run-export', result: 'loss', leaderId: 'fledgling', difficulty: 0,
    runMode: 'quick', mapId: 'map_0', finalNodeId: 'm0_street_1', turnsTaken: 2, durationMs: 60_000,
    currentCohesion: 0, maxCohesion: 38, scrapEarned: 12, scrapSpent: 0, finalScrap: 52,
    path: ['m0_street_1'], deck: [], routeMarks: [], suppliesUsed: [], signals: [], cardRewards: [],
    routeDecisions: [{ offered: ['m0_street_1'], picked: 'm0_street_1', decisionMs: 4_200 }],
    combatResults: [{
      encounterId: 'rooftop_first_flight', nodeId: 'm0_street_1', nodeType: 'street', turnsTaken: 2,
      durationMs: 48_000, cohesionLost: 38, damageDealt: 12, killedByMove: 'Review Strike',
      decisionStats: { cardsPlayed: 2, turnEnds: 1, invalidActions: 1, cancelledActions: 0 },
    }],
    districtContracts: [], seenEnemyMoves: [], combatPace: 'standard',
    firstFlightGuide: { completed: false, skipped: 0 },
  };
  await page.addInitScript((run) => {
    const raw = JSON.stringify([run]);
    localStorage.setItem('birdsquad.runs', raw);
    localStorage.setItem('birdsquad.runs.backup', raw);
  }, exportedRun);
  await boot(page, '/?playtest=1');
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.scene === 'ProfileScene' && state.playtestExport?.enabled && state.playtestExport?.runs === 1;
  });

  const mutatingRequests: string[] = [];
  page.on('request', (request) => {
    if (['POST', 'PUT', 'PATCH'].includes(request.method())) mutatingRequests.push(request.url());
  });
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-data-hit');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-playtest-feedback-fun-5');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-playtest-feedback-fairness-4');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-playtest-feedback-clarity-5');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-playtest-feedback-replay-4');
  await page.keyboard.press('Enter');
  // Confirm reactivates the focused rating; Tab selects the adjacent action.
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).playtestFeedback?.ratings?.replay)).toBe(4);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').playtestFeedback?.ratings?.replay === 5);
  const locallyRated = await page.evaluate(() => ({
    primary: JSON.parse(localStorage.getItem('birdsquad.runs') ?? '[]'),
    mirror: JSON.parse(localStorage.getItem('birdsquad.runs.backup') ?? '[]'),
    view: JSON.parse(window.render_game_to_text?.() ?? '{}').playtestFeedback,
  }));
  const downloadPromise = page.waitForEvent('download');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-playtest-export-hit');
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('Playtest export did not produce a local file');
  const payload = JSON.parse(await readFile(downloadedPath, 'utf8'));
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  const labels = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return profile.children.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
  });

  expect(download.suggestedFilename()).toMatch(/^bird-squad-runs-\d{4}-\d{2}-\d{2}\.json$/);
  const expectedFeedback = {
    fun: 5,
    fairness: 4,
    clarity: 5,
    replay: 5,
    updatedAt: expect.any(String),
  };
  expect(locallyRated.primary).toHaveLength(1);
  expect(locallyRated.primary[0]).toMatchObject({ ...exportedRun, experienceFeedback: expectedFeedback });
  expect(locallyRated.mirror).toEqual(locallyRated.primary);
  expect(locallyRated.view).toMatchObject({
    enabled: true,
    localOnly: true,
    runId: 'human-session-1',
    result: 'loss',
    ratings: expectedFeedback,
    complete: true,
    status: 'saved',
  });
  expect(payload).toEqual(locallyRated.primary);
  expect(state.playtestExport).toEqual({ enabled: true, localOnly: true, runs: 1, status: 'downloaded' });
  expect(labels).toContain('1 local run downloaded');
  expect(mutatingRequests).toEqual([]);
});

test('flight log safely restores, reviews, and shares recent completed flights', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  const now = Date.now();
  const run = (overrides: Record<string, unknown>) => ({
    id: `run-${now}-base`,
    seed: 'history-base',
    result: 'loss',
    leaderId: 'fledgling',
    difficulty: 0,
    runMode: 'quick',
    mapId: 'map_01_rooftop_blocks',
    finalNodeId: 'm1_entry',
    turnsTaken: 4,
    durationMs: 48_000,
    currentCohesion: 0,
    maxCohesion: 38,
    scrapEarned: 12,
    scrapSpent: 5,
    finalScrap: 47,
    path: ['m1_entry'],
    deck: [{ id: 'wands_ace' }, { id: 'cups_ace' }],
    routeMarks: [],
    suppliesUsed: [],
    signals: [],
    cardRewards: [],
    routeDecisions: [{ offered: ['m1_entry'], picked: 'm1_entry', decisionMs: 1500 }],
    combatResults: [{
      encounterId: 'rooftop_first_flight',
      nodeId: 'm1_entry',
      nodeType: 'street',
      enemyIds: ['roof_rat'],
      turnsTaken: 4,
      damageDealt: 18,
      cohesionLost: 38,
    }],
    districtContracts: [],
    seenEnemyMoves: [],
    combatPace: 'standard',
    firstFlightGuide: { enabled: false, completed: true },
    decisionStats: { cardsPlayed: 5, overextensions: 1, blockedDamage: 4, unspentWingbeatAtRoost: 2 },
    ...overrides,
  });
  const older = run({
    id: `run-${now - 60_000}-older`,
    seed: 'history-older',
    result: 'loss',
    difficulty: 2,
  });
  const superseded = run({
    id: `run-${now}-newest`,
    seed: 'superseded-copy',
    result: 'loss',
  });
  const newest = run({
    id: `run-${now}-newest`,
    seed: 'history-newest',
    result: 'win',
    leaderId: 'talon',
    difficulty: 3,
    runMode: 'full',
    turnsTaken: 9,
    durationMs: 92_000,
    currentCohesion: 24,
    deck: [
      { id: 'wands_ace', upgraded: true },
      { id: 'cups_ace' },
      { id: 'not-a-card' },
    ],
    routeMarks: ['chalk_wingmark', 'not-a-waymark'],
    suppliesUsed: ['seed_packet', 'not-a-supply'],
    cardRewards: [{ offered: ['wands_02'], picked: 'wands_02', skipped: false }],
  });
  const middle = Array.from({ length: 8 }, (_, index) => run({
    id: `run-${now - 50_000 + index * 5_000}-middle-${index + 1}`,
    seed: `history-middle-${index + 1}`,
    result: index % 2 === 0 ? 'win' : 'loss',
  }));
  await page.addInitScript((runs) => {
    localStorage.setItem('birdsquad.screenReader', 'on');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => localStorage.setItem('flight-log-copied-link', value),
      },
    });
    const raw = JSON.stringify(runs);
    localStorage.setItem('birdsquad.runs', raw);
    localStorage.setItem('birdsquad.runs.backup', raw);
  }, [older, superseded, { broken: true }, ...middle, newest]);
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.scene === 'ProfileScene' && state.flightHistory?.count === 10;
  });

  await clickNamedGameObject(page, 'ProfileScene', 'profile-flight-log-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flightHistory?.open === true);
  await page.waitForFunction(() => document.getElementById('game-status')?.textContent?.includes('recorded flights'));
  await page.screenshot({ path: '.artifacts/test-results/flight-log/minimum-landscape-history.png' });
  const log = await page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const scene: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    const rows = scene.children.list.filter((child: any) => child.name?.startsWith('profile-flight-log-row-'));
    const pageButtons = scene.children.list.filter((child: any) => child.name?.startsWith('profile-flight-log-page-'));
    const preview = scene.children.list.find((child: any) => child.name === 'profile-flight-log-preview');
    const scale = document.querySelector('canvas')!.getBoundingClientRect().width / 1280;
    return {
      state,
      rows: rows.map((row: any) => ({
        width: row.width,
        height: row.height,
        cssWidth: Number((row.displayWidth * scale).toFixed(1)),
        cssHeight: Number((row.displayHeight * scale).toFixed(1)),
        enabled: row.input?.enabled,
        runId: row.getData('runId'),
      })),
      pageButtons: pageButtons.map((button: any) => ({
        name: button.name,
        width: button.width,
        height: button.height,
        cssWidth: Number((button.displayWidth * scale).toFixed(1)),
        cssHeight: Number((button.displayHeight * scale).toFixed(1)),
        enabled: button.input?.enabled ?? false,
      })),
      preview: preview ? { width: preview.width, height: preview.height } : null,
      announcement: document.getElementById('game-status')?.textContent ?? '',
    };
  });
  expect(log.state.flightHistory).toMatchObject({
    open: true,
    count: 10,
    selectedIndex: 0,
    page: 1,
    pageCount: 2,
    visibleStart: 1,
    visibleEnd: 7,
    selected: {
      id: newest.id,
      seed: 'history-newest',
      result: 'win',
      leader: 'The Talon',
      deckSize: 2,
      waymarks: 1,
      supplies: 1,
    },
    loading: false,
    review: null,
  });
  expect(log.rows.map((row: any) => row.runId)).toEqual([
    newest.id,
    middle[7].id,
    middle[6].id,
    middle[5].id,
    middle[4].id,
    middle[3].id,
    middle[2].id,
  ]);
  expect(log.rows.every((row: any) => row.width === 430 && row.height === 58 && row.enabled)).toBe(true);
  expect(log.rows.every((row: any) => row.cssWidth >= 44 && row.cssHeight >= 44)).toBe(true);
  expect(log.pageButtons).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'profile-flight-log-page-newer', width: 132, height: 58, enabled: false }),
    expect.objectContaining({ name: 'profile-flight-log-page-older', width: 132, height: 58, enabled: true }),
  ]));
  expect(log.pageButtons.every((button: any) => button.cssWidth >= 44 && button.cssHeight >= 44)).toBe(true);
  expect(log.preview).toEqual({ width: 634, height: 500 });
  expect(log.announcement).toContain('Flight Log');
  expect(log.announcement).toContain('10 recorded flights');
  expect(log.announcement).toContain('Page 1 of 2');

  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flightHistory?.selected?.id)).toBe(middle[7].id);
  await page.keyboard.press('PageDown');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flightHistory)).toMatchObject({
    selectedIndex: 8,
    selected: { id: middle[0].id },
    page: 2,
    pageCount: 2,
    visibleStart: 8,
    visibleEnd: 10,
  });
  await page.screenshot({ path: '.artifacts/test-results/flight-log/minimum-landscape-history-page-2.png' });
  await page.keyboard.press('PageUp');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flightHistory?.selected?.id)).toBe(middle[7].id);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 5 });
  });
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flightHistory?.selected?.id)).toBe(middle[0].id);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 4 });
  });
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flightHistory?.selected?.id)).toBe(middle[7].id);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => Boolean(JSON.parse(window.render_game_to_text?.() ?? '{}').flightHistory?.review));
  await page.waitForFunction(() => document.getElementById('game-status')?.textContent?.includes('Recorded flight history-newest'));
  await page.screenshot({ path: '.artifacts/test-results/flight-log/minimum-landscape-recorded-review.png' });
  const review = await page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const scene: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    const root: any = scene.children.list.find((child: any) => child.name === 'profile-flight-review-root');
    const copy: any = root?.list.find((child: any) => child.name === 'run-flight-details-copy-hit');
    const close: any = root?.list.find((child: any) => child.name === 'run-flight-details-close-hit');
    const focus: any = root?.list.find((child: any) => child.name === 'run-flight-details-input-focus-ring');
    return {
      state,
      copy: { width: copy?.width, height: copy?.height, enabled: copy?.input?.enabled },
      close: { width: close?.width, height: close?.height, enabled: close?.input?.enabled },
      focusAction: focus?.getData('action'),
      announcement: document.getElementById('game-status')?.textContent ?? '',
    };
  });
  expect(review.state.flightHistory.review).toMatchObject({
    id: newest.id,
    seed: 'history-newest',
    runMode: 'full',
    focusedAction: 'copy',
    copyStatus: 'idle',
    details: {
      deck: [expect.stringContaining('Plume Flash+'), expect.stringContaining('Open Basin')],
      waymarks: ['Chalk Wingmark'],
      supplies: ['Seed Packet'],
    },
  });
  expect(review.state.flightHistory.review.details.results[0]).toContain('WIN');
  expect(review.copy).toEqual({ width: 238, height: 58, enabled: true });
  expect(review.close).toEqual({ width: 190, height: 58, enabled: true });
  expect(review.focusAction).toBe('copy');
  expect(review.announcement).toContain('Recorded flight history-newest');
  expect(review.announcement).toContain('Focused action copy');

  await page.keyboard.press('Enter');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flightHistory?.review?.copyStatus)).toBe('copied');
  expect(await page.evaluate(() => localStorage.getItem('flight-log-copied-link'))).toContain('flight=history-newest');
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flightHistory?.review?.focusedAction)).toBe('close');
  await page.keyboard.press('Enter');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flightHistory?.review)).toBe(null);
  await clickNamedGameObject(page, 'ProfileScene', 'profile-flight-log-page-older');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flightHistory?.page)).toBe(2);
  await clickNamedGameObject(page, 'ProfileScene', 'profile-flight-log-row-9');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flightHistory?.review?.id)).toBe(older.id);
  await page.keyboard.press('Escape');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flightHistory?.review)).toBe(null);
  await page.keyboard.press('Escape');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flightHistory?.open)).toBe(false);
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').scene)).toBe('ProfileScene');
});
