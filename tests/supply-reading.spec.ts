import { test, expect } from '@playwright/test';
import supplies from '../data/game/alpha-supplies.json' with { type: 'json' };
import { settleCanvas } from './helpers/settled-canvas';
import { KEYWORDS } from '../src/game/keyword-definitions';

test.describe('Packed Supply touch and teardown', () => {
  test.use({ hasTouch: true });
  test('touch reading stays read-only and closing releases the reading callback in both phases', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width: 1000, height: 560 });
    await page.goto('./');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    for (const key of ['RouteScene', 'BattleScene']) {
      await page.evaluate(async key => {
        const w = window as any; await w.__birdSquadEnsureScene(key);
        for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
        w.__birdSquadGame.scene.start(key, { routeNodeId: 'm1_entry' });
      }, key);
      await page.waitForFunction(key => {
        const s = (window as any).__birdSquadGame.scene.getScene(key);
        return key === 'RouteScene' ? s.routeEssentialAssetsReady : s.battleHandRendererModule && !s.combatInteractionLocked();
      }, key);
      await page.evaluate(key => {
        const s = (window as any).__birdSquadGame.scene.getScene(key);
        if (key === 'RouteScene') { s.runState.supplies = ['feather_splint']; s.openSupplyDrawer(); }
        else { s.runSupplies = ['feather_splint']; s.toggleBattleSupplyDrawer(); }
      }, key);
      await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).supplyDrawer?.reading);
      await settleCanvas(page);
      const point = await page.evaluate(key => {
        const s = (window as any).__birdSquadGame.scene.getScene(key), list = key === 'RouteScene' ? s.children.list : s.root.list;
        const b = list.find((o: any) => o.name === 'supply-drawer-read-next').getBounds(), c = s.game.canvas.getBoundingClientRect();
        return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
      }, key);
      await page.touchscreen.tap(point.x, point.y); await settleCanvas(page);
      const after = await page.evaluate(() => JSON.parse((window as any).render_game_to_text()).supplyDrawer);
      expect(after.reading.page).toBe(2); expect(after.armedIndex).toBeUndefined(); expect(after.focusIndex).toBe(0);
      const listeners = await page.evaluate(key => {
        const s = (window as any).__birdSquadGame.scene.getScene(key);
        const counts = () => [s.input.keyboard.listenerCount('keydown'), s.input.gamepad.listenerCount('down')];
        const before = counts(); for (let i = 0; i < 8; i++) s.renderAll();
        return { before, after: counts() };
      }, key);
      expect(listeners.after).toEqual(listeners.before);
      await page.keyboard.press('Escape'); await settleCanvas(page);
      const closed = await page.evaluate(key => {
        const s = (window as any).__birdSquadGame.scene.getScene(key);
        const module = key === 'RouteScene' ? s.routeSupplyDrawerModule : s.battleSupplyDrawerModule;
        module.turnSupplyDrawerPage(s); // Must be inert after destruction.
        return { open: s.supplyDrawerOpen, reading: module.supplyDrawerReading(s), supplies: key === 'RouteScene' ? s.runState.supplies : s.runSupplies };
      }, key);
      expect(closed).toEqual({ open: false, reading: undefined, supplies: ['feather_splint'] });
    }
    expect(errors).toEqual([]);
  });
});

for (const sceneKey of ['RouteScene', 'BattleScene']) for (const remapped of [false, true]) test(`${sceneKey} packed Supply reading is complete, bounded and read-only, remapped=${remapped}`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(remapped => {
    localStorage.setItem('birdsquad.screenReader', 'on');
    if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { roost: 'KeyJ' } }));
  }, remapped);
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async key => {
    const w = window as any; await w.__birdSquadEnsureScene(key);
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start(key, { routeNodeId: 'm1_entry' });
  }, sceneKey);
  await page.waitForFunction(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    return key === 'RouteScene' ? s.routeEssentialAssetsReady : s.battleHandRendererModule && !s.combatInteractionLocked();
  }, sceneKey);
  await page.evaluate(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    if (key === 'RouteScene') { s.runState.supplies = ['feather_splint', 'sky_sugar']; s.runState.supplySlots = 3; s.openSupplyDrawer(true); }
    else { s.runSupplies = ['feather_splint', 'sky_sugar']; s.runSupplyCapacity = 3; s.toggleBattleSupplyDrawer(true); }
  }, sceneKey);
  const read = () => page.evaluate(() => JSON.parse((window as any).render_game_to_text()).supplyDrawer?.reading);
  await expect.poll(read).toBeTruthy();
  const press = async (key: string) => { await page.keyboard.press(key); await settleCanvas(page); };
  const readKey = remapped ? 'j' : 'r';
  const stable = () => page.evaluate(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    return JSON.stringify({ run: s.runState, supplies: s.runSupplies, flock: s.flock, enemies: s.enemies, hand: s.hand, energy: s.energy, turn: s.turn, focus: s.supplyDrawerFocusIndex, armed: s.supplyDrawerArmedIndex });
  }, sceneKey);
  await press('Enter'); // Arm only; reading must leave confirmation intact.
  const before = await stable();
  const initial = await read(); await press(readKey);
  expect((await read()).page).toBe(initial.page % initial.total + 1);
  expect(await stable()).toBe(before);
  await page.keyboard.down(readKey); await settleCanvas(page);
  const held = await read();
  await page.keyboard.down(readKey); await settleCanvas(page);
  expect(await read()).toEqual(held); await page.keyboard.up(readKey);
  const point = await page.evaluate(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key), list = key === 'RouteScene' ? s.children.list : s.root.list;
    const b = list.find((o: any) => o.name === 'supply-drawer-read-previous').getBounds(), c = s.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, sceneKey);
  await page.mouse.click(point.x, point.y, { delay: 40 }); await settleCanvas(page);
  expect((await read()).page).toBe((held.page - 2 + held.total) % held.total + 1);
  expect(await stable()).toBe(before);
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Reading page');
  await page.evaluate(key => (window as any).__birdSquadGame.scene.getScene(key).input.gamepad.emit('down', {}, { index: 3 }), sceneKey);
  expect(await stable()).toBe(before);
  const current = await read();
  await page.evaluate(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    s.renderAll();
  }, sceneKey);
  expect(await read()).toEqual(current);
  for (const overlay of ['pauseOverlayOpen', 'settingsOverlayOpen']) {
    await page.evaluate(({ key, overlay }) => (window as any).__birdSquadGame.scene.getScene(key)[overlay] = true, { key: sceneKey, overlay });
    await press(readKey);
    await page.evaluate(key => (window as any).__birdSquadGame.scene.getScene(key).input.gamepad.emit('down', {}, { index: 3 }), sceneKey);
    expect(await read()).toEqual(current); expect(await stable()).toBe(before);
    await page.evaluate(({ key, overlay }) => (window as any).__birdSquadGame.scene.getScene(key)[overlay] = false, { key: sceneKey, overlay });
  }
  const capture = async (label: string) => {
    for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size); await settleCanvas(page);
      const bounds = await page.evaluate(key => {
        const s = (window as any).__birdSquadGame.scene.getScene(key), list = key === 'RouteScene' ? s.children.list : s.root.list;
        const body = list.find((o: any) => o.name === 'supply-drawer-rules');
        return { font: body.style.fontSize, bottom: body.getBounds().bottom, width: body.width,
          titleBottom: list.find((o: any) => o.name === 'supply-drawer-title').getBounds().bottom,
          hintBottom: list.find((o: any) => o.name === 'supply-drawer-command-copy').getBounds().bottom,
          hits: list.filter((o: any) => o.name.startsWith('supply-drawer-') && o.input).map((o: any) => o.height * s.game.canvas.getBoundingClientRect().height / 720) };
      }, sceneKey);
      expect(bounds.font).toBe('22px'); expect(bounds.bottom).toBeLessThanOrEqual(444);
      expect(bounds.width).toBeLessThanOrEqual(584); expect(bounds.titleBottom).toBeLessThanOrEqual(264);
      expect(bounds.hintBottom).toBeLessThan(579); bounds.hits.forEach((h: number) => expect(h).toBeGreaterThanOrEqual(44));
      if (!remapped) await page.screenshot({ path: info.outputPath(`${label}-${size.width}.png`) });
    }
  };
  await capture('packed');
  // Use real runtime rules for the entire authored catalog before stressing content growth.
  const catalog = await page.evaluate(({ key, ids }) => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    const module = key === 'RouteScene' ? s.routeSupplyDrawerModule : s.battleSupplyDrawerModule;
    const results: any[] = [];
    for (const id of ids) {
      if (key === 'RouteScene') s.runState.supplies = [id]; else s.runSupplies = [id];
      s.supplyDrawerFocusIndex = 0; s.supplyDrawerArmedIndex = undefined;
      s.renderAll();
      const expected = JSON.parse((window as any).render_game_to_text()).supplyDrawer.entries[0].rules;
      const pages: any[] = [];
      const total = module.supplyDrawerReading(s).total;
      for (let i = 0; i < total; i++) { pages.push(module.supplyDrawerReading(s)); module.turnSupplyDrawerPage(s); }
      results.push({ id, expected, pages });
    }
    return results;
  }, { key: sceneKey, ids: supplies.supplies.map(s => s.id) });
  const compact = (s: string) => s.replace(/\s/g, '');
  for (const item of catalog) {
    expect(compact(item.pages.filter((p: any) => p.title === 'EFFECT').map((p: any) => p.text).join(''))).toBe(compact(item.expected));
    for (const title of new Set<string>(item.pages.map((p: any) => p.title))) if (title.startsWith('TERM')) {
      const term = Object.keys(KEYWORDS).find(k => `TERM · ${k.toUpperCase()}` === title)!;
      expect(compact(item.pages.filter((p: any) => p.title === title).map((p: any) => p.text).join(''))).toBe(compact(KEYWORDS[term].def));
    }
  }
  const stress = await page.evaluate(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    const module = key === 'RouteScene' ? s.routeSupplyDrawerModule : s.battleSupplyDrawerModule;
    const name = 'A long Supply name with an exact identity '.repeat(6) + 'UNBROKEN'.repeat(25);
    const summary = 'Gain 4 Cover. Apply 2 Winded. Preserve every complete consequence. '.repeat(14) + 'COMPLETE'.repeat(30);
    const render = () => module.renderRouteSupplyDrawer(s, { entries: [{ id: 'feather_splint', name, summary, timing: 'either', usable: true }], filled: 1, capacity: 3, focusIndex: 0, inputActive: true, confirmLabel: 'Enter', backLabel: 'Esc', addTo: key === 'BattleScene' ? (o: any) => s.root.add(o) : undefined, onClose: () => {}, onActivate: () => { throw Error('Reading activated Supply'); }, onBrowse: () => { throw Error('Reading changed Supply'); } });
    if (key === 'RouteScene') s.renderRouteSupplyDrawer = render; else s.renderSupplyDrawer = render;
    s.renderAll();
    return { name, summary };
  }, sceneKey);
  await capture('long-rules');
  const pages: any[] = [];
  const total = (await read()).total;
  for (let i = 0; i < total; i++) { pages.push(await read()); await press(readKey); }
  expect(compact(pages.filter(p => p.title === 'EFFECT').map(p => p.text).join(''))).toBe(compact(stress.summary));
  expect(compact(pages.filter(p => p.title === 'FULL NAME').map(p => p.text).join(''))).toBe(compact(stress.name));
  expect(errors).toEqual([]);
});
