import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('selected card keeps its Full rules pointer target alive across hover exit', async ({ page }, info) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    w.__birdSquadGame.scene.stop('MenuScene');
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.hand?.length && b.combatPreviewModule && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  await settleCanvas(page);
  const card = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const c = b.game.canvas.getBoundingClientRect(), r = b.handCardRects.get(b.hand[0].instanceId).getBounds();
    return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
  });
  await page.mouse.click(card.x, card.y);
  await settleCanvas(page);
  const control = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    w.inspectionTarget = b.cardPreview.getByName('combat-card-inspect-hit');
    w.inspectionBefore = JSON.stringify({ energy: b.energy, hand: b.hand, target: b.selectedEnemyId, selected: b.selectedInstanceId, turn: b.turn });
    const r = w.inspectionTarget.getBounds(), c = b.game.canvas.getBoundingClientRect();
    return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
  });
  await page.mouse.move(control.x, control.y);
  await settleCanvas(page);
  expect(await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    return w.inspectionTarget.active && b.cardPreview.getByName('combat-card-inspect-hit') === w.inspectionTarget;
  })).toBe(true);
  await page.mouse.click(control.x, control.y);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active);
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`pointer-rules-${width}.png`) });
  }
  const back = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const r = b.combatCardDetail.getByName('combat-card-detail-close').getBounds(), c = b.game.canvas.getBoundingClientRect();
    return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
  });
  await page.mouse.click(back.x, back.y);
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active);
  expect(await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ energy: b.energy, hand: b.hand, target: b.selectedEnemyId, selected: b.selectedInstanceId, turn: b.turn }) === w.inspectionBefore;
  })).toBe(true);
  expect(errors).toEqual([]);
});
