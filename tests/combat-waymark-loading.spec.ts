import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

async function boot(page: Page) {
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending && !b.cameras.main.fadeEffect.isRunning;
  });
  await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.routeMarks = ['chalk_wingmark']; b.selectedInstanceId = b.hand[0].instanceId; b.renderAll(); });
}
const reader = (page: Page) => page.evaluate(() => {
  const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
  return { open: b.waymarkDrawerOpen, loaded: Boolean(b.waymarkReviewModule), failed: b.waymarkReviewFailed,
    body: Boolean(b.root.getByName('route-waymark-reader-body')), selected: b.selectedInstanceId, cancelled: b.statCancelledActions };
});
const press = async (page: Page, key: string) => { await page.keyboard.press(key); await settleCanvas(page); };
const chunk = '**/assets/waymark-review-*.js';

test('late Waymark loading cannot reopen a dismissed combat reader', async ({ page }) => {
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route(chunk, async route => { await hold; await route.continue(); });
  try {
    await boot(page);
    const before = await reader(page);
    await press(page, 'Shift+x'); await expect.poll(async () => (await reader(page)).open).toBe(true);
    await expect.poll(() => page.locator('#game-status').textContent()).toContain('Opening Waymarks');
    await press(page, 'Escape'); expect((await reader(page)).open).toBe(false);
    release(); await expect.poll(async () => (await reader(page)).loaded).toBe(true);
    const closed = await reader(page);
    expect(closed.open).toBe(false); expect(closed.body).toBe(false);
    expect(closed.selected).toBe(before.selected); expect(closed.cancelled).toBe(before.cancelled);
    await press(page, 'Shift+x'); await expect.poll(async () => (await reader(page)).body).toBe(true);
  } finally { release(); }
});

test('failed Waymark loading preserves combat and explains reload recovery', async ({ page }, info) => {
  await page.route(chunk, route => route.abort('failed'));
  await boot(page);
  const before = await reader(page);
  await press(page, 'Shift+x'); await expect.poll(async () => (await reader(page)).failed).toBe(true);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('battle-waymark-loading').text)).toContain('reload the game to retry');
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('reload the game to retry');
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('controller B to close');
  await page.screenshot({ path: info.outputPath('unavailable.png') });
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').setBattlePaused(true));
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Battle paused');
  await press(page, 'Escape');
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('reload the game to retry');
  await press(page, 'Escape'); const closed = await reader(page);
  expect(closed.open).toBe(false); expect(closed.selected).toBe(before.selected); expect(closed.cancelled).toBe(before.cancelled);
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Selected First Flight');
  await press(page, 'Enter');
  await page.waitForFunction(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); return b.statCardsPlayed === 1 && !b.combatAnimationPending; });
  await page.unroute(chunk);
  // Browsers cache a rejected module fetch for this document. Recovery uses a
  // fresh document, not a misleading repeat of the same cached import.
  await page.reload(); await boot(page);
  await press(page, 'Shift+x'); await expect.poll(async () => (await reader(page)).body, { timeout: 8000 }).toBe(true);
});
