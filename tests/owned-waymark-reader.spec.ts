import { test, expect } from '@playwright/test';
import marks from '../data/game/alpha-route-marks.json' with { type: 'json' };
import { settleCanvas } from './helpers/settled-canvas';

for (const remapped of [false, true]) test(`owned Waymarks preserve complete reading and paused focus, remapped=${remapped}`, async ({ page }, info) => {
  test.setTimeout(120_000); // Full 58-item, multi-viewport catalog qualification.
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const press = async (key: string) => { await page.keyboard.press(key); await settleCanvas(page); };
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(remapped => {
    localStorage.setItem('birdsquad.screenReader', 'on');
    if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { previous: 'KeyQ', next: 'KeyE', roost: 'KeyJ' } }));
  }, remapped);
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    w.__birdSquadGame.scene.getScene('MenuScene').startRun();
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
  await page.waitForFunction(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.routeEssentialAssetsReady && !r.cameras.main.fadeEffect.isRunning;
  });
  await page.evaluate(ids => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.runState.routeMarks = ids; r.openWaymarkDrawer();
  }, marks.routeMarks.map(m => m.id));
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-waymark-review-panel'));
  await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('single-2560.png') });
  const baseline = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.children.list.filter((o: any) => o.name === 'route-waymark-reader-body').map((o: any) => o.style.fontSize);
  });
  expect(baseline).toEqual(['22px']);
  const audit = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
    const failures: string[] = [];
    const catalog = r.ownedRouteMarkDefs();
    for (const comparing of [false, true]) for (const mark of catalog) {
      r.routeWaymarkPinnedId = comparing ? catalog.find((candidate: any) => candidate.id !== mark.id).id : undefined;
      r.selectRouteWaymark(mark.id, false);
      r.renderAll();
      const entry = r.routeWaymarkReviewEntry(mark), seen: string[] = [];
      const panel = r.children.getByName('route-waymark-review-panel');
      const total = panel.getData('reading').total;
      for (let i = 0; i < total; i++) {
        const bodies = r.children.list.filter((o: any) => o.name === 'route-waymark-reader-body');
        const body = bodies[bodies.length - 1];
        if (bodies.some((o: any) => o.getBounds().bottom > 568)) failures.push(`${mark.id}: overflow`);
        seen.push(body.text); panel.getData('turnRulesPage')(1);
      }
      const all = clean(seen.join(' '));
      for (const value of [entry.name, entry.description, entry.trigger, entry.flavorText, ...entry.effects, ...entry.tags]) {
        if (value && !all.includes(clean(value))) failures.push(`${mark.id}: missing ${value}`);
      }
    }
    r.routeWaymarkPinnedId = undefined;
    r.selectRouteWaymark(r.ownedRouteMarkDefs()[0].id, false);
    r.renderAll();
    return failures;
  });
  expect(audit).toEqual([]);
  const stable = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return JSON.stringify({ run: r.runState, selected: r.routeWaymarkSelectedId, pinned: r.routeWaymarkPinnedId, scroll: r.routeWaymarkScroll });
  });
  const reading = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.children.getByName('route-waymark-review-panel').getData('reading');
  });
  const before = await stable();
  await press('PageDown');
  const afterPage = await reading(); expect(afterPage.page).toBe(2); expect(await stable()).toBe(before);
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const stale = r.children.getByName('route-waymark-review-panel').getData('turnRulesPage');
    r.renderAll(); stale(1);
  });
  expect(await reading()).toEqual(afterPage);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').setRoutePaused(true));
  await press('PageDown'); await press('c'); await press('ArrowDown'); await press('Tab');
  await press(remapped ? 'e' : 'ArrowRight');
  expect(await stable()).toBe(before);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').openSettingsOverlay());
  await press('PageDown'); await press(remapped ? 'j' : 'r');
  expect(await stable()).toBe(before);
  await press('Escape');
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').settingsOverlayOpen);
  await press('Escape'); expect(await reading()).toEqual(afterPage);
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').pauseOverlayOpen);
  await press(remapped ? 'j' : 'r');
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('RouteScene').routeWaymarkPinnedId));
  await press(remapped ? 'e' : 'ArrowRight');
  for (const width of [2560, 1440, 1000]) {
    await page.setViewportSize({ width, height: width === 2560 ? 1600 : width === 1440 ? 900 : 560 });
    await settleCanvas(page);
    const geometry = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      const pin = r.children.getByName('route-waymark-pin-hit').getBounds();
      const close = r.children.getByName('overlay-close-command-frame')?.getBounds();
      if (close && !(pin.right < close.left || pin.bottom < close.top || pin.top > close.bottom)) throw new Error('Pin overlaps Close');
      if (r.children.getByName('route-waymark-reader-hints').getBounds().bottom > 673) throw new Error('Hints crowd the bottom border');
      return r.children.list.filter((o: any) => o.name === 'route-waymark-reader-body').map((o: any) => ({ size: o.style.fontSize, bottom: o.getBounds().bottom }));
    });
    expect(geometry).toHaveLength(2);
    expect(geometry.every(g => g.size === '18px' && g.bottom <= 568)).toBe(true);
    await page.screenshot({ path: info.outputPath(`comparison-${width}.png`) });
  }
  const compared = await stable(), pageBefore = (await reading()).page;
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').input.gamepad.emit('down', {}, { index: 5 }));
  expect((await reading()).page).not.toBe(pageBefore); expect(await stable()).toBe(compared);
  const wheelBefore = (await reading()).page;
  const wheelPoint = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.canvas.getBoundingClientRect();
    return { x: c.left + 640 * c.width / 1280, y: c.top + 515 * c.height / 720 };
  });
  await page.mouse.move(wheelPoint.x, wheelPoint.y); await page.mouse.wheel(0, 110); await settleCanvas(page);
  expect((await reading()).page).not.toBe(wheelBefore); expect(await stable()).toBe(compared);
  expect(await page.locator('#game-status').textContent()).toContain('Reading page');
  expect(errors).toEqual([]);
});

test('owned Waymark pointer controls preserve reading and inventory focus', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
    w.__birdSquadGame.scene.getScene('MenuScene').startRun();
  });
  await page.waitForFunction(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.scene.isActive() && r.routeEssentialAssetsReady && !r.cameras.main.fadeEffect.isRunning;
  });
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').openWaymarkDrawer());
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.list.some((o: any) => o.text?.startsWith('No Waymarks found yet')));
  await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('empty-2560.png') });
  await page.keyboard.press('Escape'); await settleCanvas(page);
  await page.evaluate(ids => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.runState.routeMarks = ids; r.openWaymarkDrawer();
  }, marks.routeMarks.slice(0, 9).map(m => m.id));
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-waymark-review-panel'));
  const click = async (name: string) => {
    const point = await page.evaluate(name => {
      const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
      const b = r.children.getByName(name).getBounds(), c = w.__birdSquadGame.canvas.getBoundingClientRect();
      return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
    }, name);
    await page.mouse.click(point.x, point.y); await settleCanvas(page);
  };
  const state = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return { run: JSON.stringify(r.runState), selected: r.routeWaymarkSelectedId, pinned: r.routeWaymarkPinnedId,
      page: r.children.getByName('route-waymark-review-panel').getData('reading').page };
  });
  await click(`route-waymark-tile-${marks.routeMarks[4].id}`);
  await click('route-waymark-pin-hit');
  const pinned = await state(); expect(pinned.pinned).toBe(marks.routeMarks[4].id);
  const grid = await page.evaluate(() => { const b = (window as any).__birdSquadGame.canvas.getBoundingClientRect(); return { x: b.left + 400 * b.width / 1280, y: b.top + 280 * b.height / 720 }; });
  await page.mouse.move(grid.x, grid.y); await page.mouse.wheel(0, 110); await settleCanvas(page);
  expect(await state()).toEqual(pinned);
  await click(`route-waymark-tile-${marks.routeMarks[7].id}`);
  const before = await state(); expect(before.selected).toBe(marks.routeMarks[7].id);
  expect(before.run).toBe(pinned.run); expect(before.pinned).toBe(pinned.pinned);
  await click('route-waymark-reader-next'); expect((await state()).page).toBe(before.page + 1);
  await click('route-waymark-reader-previous'); expect(await state()).toEqual(before);
  await page.setViewportSize({ width: 1000, height: 560 }); await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('pointer-comparison-1000.png') });
  await click('route-waymark-pin-hit'); expect((await state()).pinned).toBe(before.selected);
  await click('route-waymark-pin-hit'); expect((await state()).pinned).toBeUndefined();
  expect((await state()).run).toBe(before.run); expect(errors).toEqual([]);
});
