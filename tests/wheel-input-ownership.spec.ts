import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { settleCanvas } from './helpers/settled-canvas';

const marks = JSON.parse(readFileSync(new URL('../data/game/alpha-route-marks.json', import.meta.url), 'utf8')).routeMarks;
const rewardPool: string[] = JSON.parse(readFileSync(new URL('../data/game/alpha-cards.json', import.meta.url), 'utf8')).rewardPool;

async function boot(page: Page, key: string) {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async key => {
    const w = window as any;
    await w.__birdSquadEnsureScene(key);
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start(key, key === 'BattleScene' ? { routeNodeId: 'm1_entry' } : {});
  }, key);
  await page.waitForFunction(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    return key === 'RouteScene' ? s.routeEssentialAssetsReady && s.cardHoverDetailModule
      : s.fxLayer?.active && s.hand.length && !s.combatIntroActive && !s.combatAnimationPending;
  }, key);
}

async function wheel(page: Page, x = 0, y = 120) {
  await page.mouse.move(500, 500);
  await page.mouse.wheel(x, y);
  // Wheel dispatch is asynchronous; wait for its next animation-frame delivery.
  await settleCanvas(page);
}

test('route wheel respects Settings, Pause and explicit Preen reading', async ({ page }, info) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await boot(page, 'RouteScene');
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.openDeckOverlay();
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('deck-review-row-hit'));
  const state = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const reader = r.hoverCardDetail?.getByName('route-inspection-reader');
    return { scroll: r.cardReviewScroll, pickerScroll: r.cardPickerScroll, focus: r.cardPickerFocusIndex,
      armed: r.cardPickerArmedIndex, reading: r.cardPickerInspectionOpen,
      page: reader?.getData('reading')?.page, run: JSON.stringify(r.runState) };
  });
  await wheel(page);
  await expect.poll(async () => (await state()).scroll).toBe(1);
  for (const overlay of ['pause', 'settings']) {
    await page.evaluate(overlay => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      r.setRoutePaused(true);
      if (overlay === 'settings') r.openSettingsOverlay();
    }, overlay);
    await settleCanvas(page);
    expect(await page.evaluate(overlay => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      return r.pauseOverlayOpen && (overlay !== 'settings' || r.settingsOverlayOpen);
    }, overlay)).toBe(true);
    const before = await state();
    await wheel(page);
    expect(await state()).toEqual(before);
    await wheel(page, 120, 0);
    expect(await state()).toEqual(before);
    await page.keyboard.press('Escape'); await settleCanvas(page);
    if (overlay === 'settings') { await page.keyboard.press('Escape'); await settleCanvas(page); }
  }
  await page.evaluate(rewardPool => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    r.closeDeckOverlay();
    const owned = new Set(r.runState.deck.map((c: any) => c.id));
    r.runState.deck.push(...rewardPool.filter(id => !owned.has(id)).slice(0, 10).map(id => ({ id })));
    r.runState.scrap = 999;
    r.openMarketNode({ ...w.__birdSquadCurrentMap().nodes[0], type: 'market' });
    const slot = r.marketUtilityShelf.findIndex((o: any) => o.id === 'preen');
    r.openMarketCardPicker(slot, 'preen');
    r.requestCardPick(r.pickerEligibleCards('preen')[0].index);
    r.routeRewardInteractionModule().handleRouteRewardAction(r, 'inspect');
  }, rewardPool);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').hoverCardDetail?.getByName('route-inspection-reader'));
  const before = await state();
  expect(before.reading).toBe(true);
  await wheel(page);
  await expect.poll(async () => (await state()).page).toBe(before.page + 1);
  const after = await state();
  expect({ ...after, page: before.page }).toEqual(before);
  await wheel(page, 120, 0);
  expect(await state()).toEqual(after);
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`preen-reading-${width}.png`) });
    expect(await state()).toEqual(after);
  }
  await page.keyboard.press('Escape'); await settleCanvas(page);
  expect((await state()).reading).toBe(false);
  await wheel(page);
  await expect.poll(async () => (await state()).pickerScroll).toBe(1);
  expect((await state()).armed).toBe(before.armed);
  expect((await state()).run).toBe(before.run);
  expect(errors).toEqual([]);
});

test('combat Waymark wheel cannot change the drawer behind system overlays', async ({ page }) => {
  await boot(page, 'BattleScene');
  await page.evaluate(ids => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.routeMarks = ids;
    b.waymarkDrawerOpen = true;
    b.renderAll();
  }, marks.map((m: any) => m.id));
  const scroll = () => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').waymarkDrawerScroll);
  await wheel(page);
  await expect.poll(scroll).toBe(1);
  for (const overlay of ['pause', 'settings']) {
    await page.evaluate(overlay => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      b.setBattlePaused(true);
      if (overlay === 'settings') b.openSettingsOverlay();
    }, overlay);
    await settleCanvas(page);
    expect(await page.evaluate(overlay => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return b.pauseOverlayOpen && (overlay !== 'settings' || b.settingsOverlayOpen);
    }, overlay)).toBe(true);
    const before = await scroll();
    await wheel(page);
    expect(await scroll()).toBe(before);
    await page.keyboard.press('Escape'); await settleCanvas(page);
    if (overlay === 'settings') { await page.keyboard.press('Escape'); await settleCanvas(page); }
  }
  await wheel(page, 120, 0);
  expect(await scroll()).toBe(1);
  await wheel(page);
  await expect.poll(scroll).toBe(2);
});
