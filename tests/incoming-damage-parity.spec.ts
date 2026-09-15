import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { readFileSync } from 'node:fs';

const authored = JSON.parse(readFileSync('data/game/alpha-enemies.json', 'utf8'));
const districtEnemies = [2, 3, 4].flatMap(map => JSON.parse(readFileSync(`data/game/map0${map}-content.json`, 'utf8')).enemies);
const authoredMoves = [...['normalEncounters', 'rivalEncounters', 'bosses'].flatMap(key => authored[key]), ...districtEnemies]
  .flatMap((enemy: any) => enemy.moves.map((move: any) => ({ name: `${enemy.id}/${move.id}`, effects: move.effects })));

test('enemy phase forecast matches live ordered hits without mutating combat', async ({ page }, info) => {
  test.setTimeout(120000); // Authored moves, counterstrikes and layout captures.
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.combatPreviewModule && b.root?.active && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  const results = await page.evaluate(authoredMoves => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const originalEnemy = structuredClone(b.enemies[0]);
    const originalFlock = structuredClone(b.flock);
    const cases: any[] = [];
    const enemy = (id: string, effects: string[], extra = {}) => ({ ...structuredClone(originalEnemy), id, hp: 40, maxHp: 40,
      block: 0, weak: 0, nextAttackBonus: 0, damageBonus: 0, intentIndex: 0, ...extra,
      runtime: { ...originalEnemy.runtime, moves: [{ id: 'test', label: 'Parity strike', effects }], attackPattern: { type: 'cycle', moveIds: ['test'] } } });
    const run = (name: string, enemies: any[], flock = {}, tier = 0, marks: string[] = [], leader = 'sky_guard', fired: string[] = [], used: string[] = []) => {
      b.enemies = enemies; b.flock = { ...structuredClone(originalFlock), hp: 50, maxHp: 50, block: 0, exposed: false,
        exposedTurns: 0, openSkyGuard: 0, openSkyReduction: 0, molt: false, weak: 0, ...flock };
      b.runLeaderId = leader; b.leaderSignatureUsed = new Set(used); b.routeMarks = marks; b.runDifficulty = tier;
      b.firstAttackThisTurn = false;
      b.markFirstOpenSkyConsumed = false; b.markFiredThisTurn = new Set(fired); b.markFiredThisCombat = new Set();
      b.roostCards = 4; b.roostFree = 2; b.roostHeld = 0; b.turn = 3;
      b.statTaken = 0; b.statBlocked = 0;
      const stable = () => JSON.stringify({ enemies: b.enemies, flock: b.flock, marks: b.markFirstOpenSkyConsumed, log: b.log,
        played: b.cardsPlayedThisTurn, draws: b.drawPile, hand: b.hand, stats: [b.statTaken, b.statBlocked],
        signatures: [...b.leaderSignatureUsed], turnMarks: [...b.markFiredThisTurn] });
      const before = stable();
      const forecast = b.enemyDamageProjection(b.enemies, b.flock, false);
      const unchanged = before === stable();
      const hp = b.flock.hp;
      b.resolveEnemyTurn();
      cases.push({ name, forecast, actual: { afterHp: b.flock.hp, blocked: b.statBlocked, hpLoss: Math.max(0, hp - b.flock.hp) }, unchanged });
      b.fxLayer.removeAll(true);
    };
    run('Winded multi-hit consumes charged bonus once', [enemy('a', ['damage(flock, 5)', 'damage(flock, 5)'], { weak: 1, nextAttackBonus: 4, damageBonus: 2 })], { block: 3 }, 6);
    run('shared Sky Guard, scouting and first-trigger guard', [enemy('a', ['damage(flock, 4)', 'damage(flock, 4)']), enemy('b', ['damage(flock, 4)', 'damage(flock, 4)'])],
      { exposed: true, exposedTurns: 1, openSkyGuard: 1, openSkyReduction: 1, block: 3 }, 6, ['tin_roof_shade']);
    run('first-trigger healing before absorption', [enemy('a', ['damage(flock, 4)', 'damage(flock, 4)'])],
      { hp: 40, exposed: true, exposedTurns: 1 }, 4, ['borrowed_raincoat']);
    const healingMarks = ['borrowed_raincoat', 'harbor_bead_strand', 'basin_overflow_cup', 'basin_safety_pin'];
    run('healing triggers shelter before the current hit and guards later hits',
      [enemy('a', ['damage(flock, 7)', 'damage(flock, 7)']), enemy('b', ['damage(flock, 7)'])],
      { hp: 40, exposed: true, exposedTurns: 1 }, 4, healingMarks);
    run('Tidewarden partial overheal stacks with first-heal shelter',
      [enemy('a', ['damage(flock, 7)', 'damage(flock, 7)'])],
      { hp: 49, exposed: true, exposedTurns: 1 }, 4, healingMarks, 'tidewarden');
    run('full-health overheal does not fire restored-Cohesion marks',
      [enemy('a', ['damage(flock, 7)', 'damage(flock, 7)'])],
      { hp: 50, exposed: true, exposedTurns: 1 }, 4, healingMarks, 'tidewarden');
    run('already-fired healing marks cannot grant shelter again',
      [enemy('a', ['damage(flock, 7)', 'damage(flock, 7)'])],
      { hp: 40, exposed: true, exposedTurns: 1 }, 4, healingMarks, 'sky_guard', healingMarks);
    run('Cover gates reevaluate after first hit', [enemy('a', ['if flockHasCover then damage(flock, 5)', 'if flockHasNoCover then damage(flock, 3)', 'if playedCardsAtLeast(4) then damage(flock, 2)'])], { block: 5 });
    run('support boosts later attacker', [enemy('a', ['nextAttackBonusAlly(front, 5)', 'applyOpenSky(1)']), enemy('b', ['damage(flock, 5)', 'damage(flock, 5)'])]);
    const conditional = enemy('b', []);
    conditional.runtime.moves = [{ id: 'safe', label: 'Safe', effects: ['damage(flock, 1)'] }, { id: 'sky', label: 'Sky', effects: ['damage(flock, 8)'] }];
    conditional.runtime.attackPattern = { type: 'conditional', entries: [{ if: 'flockOpenSky', moveId: 'sky' }], fallback: 'safe' };
    run('later pattern branches on earlier Open Sky', [enemy('a', ['applyOpenSky(1)']), conditional]);
    run('healing changes self-below-half gate', [enemy('a', ['heal(20)', 'if selfBelowHalf then damage(flock, 20)', 'damage(flock, 2)'], { hp: 10 })]);
    run('lethal hit stops subsequent attacks', [enemy('a', ['damage(flock, 30)', 'damage(flock, 30)']), enemy('b', ['damage(flock, 30)'])], { hp: 7 });
    for (const flock of [{ block: 4, flow: 4 }, { block: 4, hp: 8, flow: 0 }, { block: 4, weak: 1, flow: 0 }]) {
      run(`Perfect Brace formation ${JSON.stringify(flock)}`, [enemy('a', ['damage(flock, 4)', 'damage(flock, 20)'], { hp: 3 }), enemy('b', ['damage(flock, 2)'], { hp: 2 })], flock, 0, [], 'roostkeeper');
    }
    run('spent Perfect Brace cannot cancel a combo', [enemy('a', ['damage(flock, 4)', 'damage(flock, 8)'], { hp: 3 })], { block: 4, flow: 0 }, 0, [], 'roostkeeper', [], ['roostkeeper:perfectBrace']);
    run('counterstrike breaks Cover before the remaining hit', [enemy('a', ['gainCover(3)', 'damage(flock, 4)', 'damage(flock, 8)'])], { block: 4, flow: 0 }, 0, ['chalk_wingmark', 'broken_cover_chime'], 'roostkeeper');
    run('nested Cover break damage retires later attackers', [enemy('a', ['gainCoverAllEnemies(2)', 'damage(flock, 4)', 'damage(flock, 8)'], { hp: 6 }), enemy('b', ['damage(flock, 12)'], { hp: 3 })], { block: 4, flow: 0 }, 0, ['crowbar_debt', 'chalk_wingmark'], 'roostkeeper');
    const boss = enemy('boss', ['damage(flock, 20)'], { hp: 21, maxHp: 40, phase: 1 });
    boss.runtime = { ...boss.runtime, type: 'boss', phaseTwoMoveIds: ['phase-two'], moves: [...boss.runtime.moves, { id: 'phase-two', label: 'Phase two', effects: ['damage(flock, 2)'] }] } as any;
    run('counterstrike phase change updates a later boss intent', [enemy('a', ['damage(flock, 4)']), boss], { block: 4, flow: 0 }, 0, [], 'roostkeeper');
    for (const move of authoredMoves) {
      run(`authored ${move.name}: clear`, [enemy('a', move.effects), enemy('b', ['damage(flock, 4)'])]);
      run(`authored ${move.name}: Winded/Cover/Open Sky`, [enemy('a', move.effects, { weak: 1, nextAttackBonus: 3 }), enemy('b', ['damage(flock, 4)'])],
        { block: 7, exposed: true, exposedTurns: 1, openSkyGuard: 1, openSkyReduction: 1 }, 6, ['quiet_landing']);
      run(`authored ${move.name}: Perfect Brace`, [enemy('a', move.effects, { hp: 3 }), enemy('b', ['damage(flock, 4)'], { hp: 2 })],
        { block: 12, flow: 0 }, 0, ['chalk_wingmark'], 'roostkeeper');
    }
    b.enemies = [enemy('a', ['if playedCardsAtLeast(4) then damage(flock, 4)', 'damage(flock, 4)'])];
    b.flock = { ...structuredClone(originalFlock), hp: 50, maxHp: 50, block: 0, molt: true, exposed: false, openSkyGuard: 0, openSkyReduction: 0 };
    b.runDifficulty = 0; b.routeMarks = []; b.cardsPlayedThisTurn = 4; b.zeroCostThisTurn = 0;
    const roost = b.incomingFlockDamagePreview();
    b.roostCards = 4; b.flock.molt = false; b.flock.exposed = true;
    b.resolveEnemyTurn();
    const roostActual = b.flock.hp;
    b.runLeaderId = 'roostkeeper'; b.leaderSignatureUsed = new Set();
    const estimate = b.enemyDamageProjection(b.enemies, b.flock, false);
    // A card can gain Sky Guard before a later fully-blocks condition. The
    // predictor must receive its copied Flock, not the pre-card live Flock.
    b.runLeaderId = 'sky_guard'; b.enemies = [enemy('a', ['damage(flock, 5)'])];
    b.flock.block = 5; b.flock.exposed = true; b.flock.openSkyGuard = 0;
    const card = b.hand[0]; card.upgraded = false;
    card.runtime = { ...card.runtime, effects: ['gainOpenSkyGuard(1)', 'if fullyBlocksNextAttack then draw(1)'] };
    const cardPreview = b.simulateCardOutcome(card, b.enemies[0].id);
    b.renderAll();
    return { cases, roost, roostActual, estimate, cardSteps: cardPreview.steps };
  }, authoredMoves);
  for (const result of results.cases) {
    expect(result.unchanged, result.name).toBe(true);
    expect(result.forecast.uncertainty, result.name).toEqual([]);
    expect(result.forecast.afterHp, result.name).toBe(result.actual.afterHp);
    expect(result.forecast.blocked, result.name).toBe(result.actual.blocked);
    expect(result.forecast.hpLoss, result.name).toBe(result.actual.hpLoss);
  }
  expect(results.cases[0].forecast.total).toBe(15);
  expect(results.cases.find((entry: any) => entry.name === 'spent Perfect Brace cannot cancel a combo').actual.afterHp).toBe(42);
  expect(results.roost.afterHp).toBe(results.roostActual);
  expect(results.roost.total).toBe(10);
  expect(results.estimate.uncertainty).toEqual([]);
  expect(results.cardSteps.map((step: any) => step.status)).toEqual(['resolves', 'resolves']);
  await info.attach('parity', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  for (const width of [2560, 1440, 1000]) {
    await page.setViewportSize({ width, height: width === 2560 ? 1600 : width === 1440 ? 900 : 560 });
    await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`forecast-${width}.png`) });
  }
  expect(errors).toEqual([]);
});
