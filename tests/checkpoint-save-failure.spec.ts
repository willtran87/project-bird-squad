import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { screenReaderSummary } from '../src/game/screen-reader-summary';

for (const scene of ['RouteScene', 'BattleScene']) test(`${scene} retains the live flight when Main Menu cannot save, then retries safely`, async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./?flight=save-failure-live&length=quick');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene')
    && (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  if (scene === 'BattleScene') {
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const g = (window as any).__birdSquadGame;
      if (!g.scene.isActive('BattleScene')) return false;
      const b = g.scene.getScene('BattleScene');
      return b.hand?.length && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
    });
  }
  await settleCanvas(page);
  const snapshot = () => page.evaluate(scene => {
    const s = (window as any).__birdSquadGame.scene.getScene(scene);
    return JSON.stringify(scene === 'RouteScene' ? s.runState
      : { hand: s.hand, enemies: s.enemies, energy: s.energy, turn: s.turn, flock: s.flock, selected: s.selectedInstanceId });
  }, scene);
  const before = await snapshot();
  const saved = await page.evaluate(() => localStorage.getItem('birdsquad.run.active'));
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).__restoreSave = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('birdsquad.run.active')) throw new DOMException('Test storage full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.keyboard.press('p');
  await page.waitForFunction(scene => (window as any).__birdSquadGame.scene.getScene(scene).pauseOverlayOpen, scene);
  await clickNamed(page, scene, 'system-field-button-hit', 'Main Menu');
  await page.waitForFunction(() => {
    const s = JSON.parse((window as any).render_game_to_text());
    return s.pauseSaveFailed || (s.pauseOverlayOpen && s.routeCheckpoint?.outcome === 'failed');
  });
  expect(await snapshot()).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.run.active'))).toBe(saved);
  const state = await page.evaluate(() => JSON.parse((window as any).render_game_to_text()));
  expect(screenReaderSummary(state)).toContain('Retry Main Menu');
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    const bounds = await page.evaluate(scene => {
      const s = (window as any).__birdSquadGame.scene.getScene(scene);
      const list: any[] = [], visit = (o: any) => { list.push(o); o.list?.forEach(visit); };
      s.children.list.forEach(visit);
      return list.find(o => o.name === 'pause-status').getBounds();
    }, scene);
    expect(bounds.y + bounds.height).toBeLessThan(234); // Above first detail row at y=246.
    await page.screenshot({ path: info.outputPath(`save-failed-${width}.png`) });
  }
  if (scene === 'RouteScene') {
    await clickNamed(page, scene, 'system-field-button-hit', 'Resume');
    // Failure must outlive the former 4.2-second dismissal, without rewriting on every render.
    await page.waitForTimeout(4500);
    expect(await page.evaluate(() => JSON.parse((window as any).render_game_to_text()).routeCheckpoint.visible)).toBe(true);
    expect(await snapshot()).toBe(before);
    await page.evaluate(() => (window as any).__restoreSave());
    await clickNamed(page, scene, 'route-checkpoint-retry-hit');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).routeCheckpoint.outcome === 'saved');
    await page.keyboard.press('p');
  } else await page.evaluate(() => (window as any).__restoreSave());
  await clickNamed(page, scene, 'system-field-button-hit', 'Main Menu');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('MenuScene'));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.run.active')!).seed)).toBe('save-failure-live');
  expect(errors).toEqual([]);
});

async function clickNamed(page: Page, scene: string, name: string, label?: string) {
  await settleCanvas(page);
  const p = await page.evaluate(({ scene, name, label }) => {
    const s = (window as any).__birdSquadGame.scene.getScene(scene);
    const list: any[] = [], visit = (o: any) => { list.push(o); o.list?.forEach(visit); };
    s.children.list.forEach(visit);
    const o = list.find(o => o.name === name && (!label || o.getData('label') === label));
    const r = o.getBounds(), c = s.game.canvas.getBoundingClientRect();
    return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
  }, { scene, name, label });
  await page.mouse.click(p.x, p.y);
}
