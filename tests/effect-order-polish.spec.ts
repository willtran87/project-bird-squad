import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('effect reader forecasts written-order gates without choosing or mutating combat', async ({ page }, info) => {
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
    return b.combatPreviewModule && b.battleHandRendererModule && b.root?.active && b.fxLayer?.active && b.handLayer?.active
      && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued && !b.cameras.main.fadeEffect.isRunning;
  });
  const results = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.runLeaderId = 'sky_guard'; b.routeMarks = []; b.energy = 3;
    b.flock.molt = false; b.flock.hp = b.flock.maxHp - 1;
    const card = b.hand[0]; card.upgraded = false; card.cost = 1;
    card.runtime = { ...card.runtime, effects: ['heal(3)', 'if fullCohesion then draw(1)', 'if targetWinded then draw(1)'] };
    b.selectedInstanceId = card.instanceId; b.selectedEnemyId = b.enemies[0].id;
    b.enemies[0].weak = 0;
    const stable = () => JSON.stringify({ hand: b.hand, flock: b.flock, enemies: b.enemies, energy: b.energy });
    const before = stable();
    const heal = b.simulateCardOutcome(card, b.selectedEnemyId);
    b.renderAll(); b.openCombatCardDetail(card);
    const unchanged = before === stable();
    const sequence = b.combatCardDetail.getData('pages').filter((p: any) => p.heading.includes('EFFECT ORDER')).map((p: any) => p.body).join(' ');
    b.closeCombatCardDetail();
    card.runtime.effects = ['draw(2)', 'discardUpTo(2)', 'damage(enemy, X*3)'];
    const choice = b.simulateCardOutcome(card, b.selectedEnemyId);
    const choiceSummary = b.selectedCardOutcomePreview().summary;
    card.runtime.effects = ['loseCohesion(99)'];
    const hp = b.simulateCardOutcome(card, b.selectedEnemyId).flockAfter.hp;
    b.resolveCardEffects(card, b.selectedEnemyId);
    const liveHp = b.flock.hp;
    card.runtime.effects = ['applyWinded(enemy, 2)', 'if windedAtLeast(2) then draw(1)'];
    const winded = b.simulateCardOutcome(card, b.selectedEnemyId);
    const savedEnemies = b.enemies;
    b.enemies = [{ ...savedEnemies[0], hp: 1, block: 0 }];
    b.flock.block = 0;
    card.runtime.effects = ['damage(target, 100)', 'if fullyBlocksNextAttack then draw(1)'];
    const defeatedAttacker = b.simulateCardOutcome(card, b.selectedEnemyId);
    b.enemies = savedEnemies;
    b.energy = 0; b.pendingRetainHand = 1;
    b.selectedInstanceId = card.instanceId; b.onCardClicked(card.instanceId);
    const retained = b.selectedInstanceId === card.instanceId;
    const rejection = b.fxLayer.getByName('combat-action-rejection')?.getData('summary');
    b.energy = 3; b.pendingRetainHand = 0; b.flock.hp = b.flock.maxHp - 1;
    card.runtime.effects = ['heal(3)', 'if fullCohesion then draw(1)', 'if targetWinded then draw(1)'];
    b.renderAll(); b.openCombatCardDetail(card);
    return { statuses: heal.steps.map((s: any) => s.status), energy: heal.flockAfter.energy, unchanged, sequence,
      choice: { statuses: choice.steps.map((s: any) => s.status), damage: choice.enemyDamage, required: choice.requiresChoice },
      choiceSummary, hp, liveHp, winded: winded.steps.map((s: any) => s.status),
      defeatedAttacker: defeatedAttacker.steps.map((s: any) => s.status), retained, rejection };
  });
  expect(results.statuses).toEqual(['resolves', 'resolves', 'not-met']);
  expect(results.energy).toBe(2); expect(results.unchanged).toBe(true);
  expect(results.sequence).toContain('2. RESOLVES'); expect(results.sequence).toContain('3. NOT MET');
  expect(results.sequence).toContain('If full Cohesion: Draw 1.');
  expect(results.sequence).not.toContain('fullCohesion');
  expect(results.choice).toEqual({ statuses: ['resolves', 'choose', 'after-choice'], damage: 0, required: true });
  expect(results.choiceSummary).toContain('later effects depend on your choice');
  expect(results.hp).toBe(1); expect(results.liveHp).toBe(1);
  expect(results.winded).toEqual(['resolves', 'resolves']);
  expect(results.defeatedAttacker).toEqual(['resolves', 'resolves']);
  expect(results.retained).toBe(true); expect(results.rejection).toContain('Needs 1 more Wingbeat');
  for (const width of [2560, 1440, 1000]) {
    await page.setViewportSize({ width, height: width === 2560 ? 1600 : width === 1440 ? 900 : 560 });
    await settleCanvas(page);
    const fit = await page.evaluate(() => {
      const layer = (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail;
      const pages = layer.getData('pages'); let fits = true;
      for (let i = 0; i < pages.length; i++) {
        layer.getData('changePage')(i - layer.getData('page'));
        const body = layer.getByName('combat-card-detail-body');
        fits &&= body.getBounds().bottom <= 502 && body.width <= 664;
      }
      layer.getData('changePage')(1 - layer.getData('page'));
      return fits;
    });
    expect(fit).toBe(true);
    await page.screenshot({ path: info.outputPath(`effect-order-${width}.png`) });
  }
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => Boolean((window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active))).toBe(false);
  expect(errors).toEqual([]);
});
