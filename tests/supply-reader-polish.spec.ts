import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const supplies = JSON.parse(readFileSync(new URL('../data/game/alpha-supplies.json', import.meta.url), 'utf8')).supplies;

for (const remapped of [false, true]) test(`Supply inspection is complete, readable and never commits, remapped=${remapped}`, async ({ page }, info) => {
  test.setTimeout(120_000); // Full catalog, stress-copy, and three-viewport qualification.
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  const keys = remapped ? { inspect: 'j', next: 'e', previous: 'q', back: 'b' } : { inspect: 'r', next: 'ArrowRight', previous: 'ArrowLeft', back: 'Escape' };
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  if (remapped) await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { roost: 'KeyJ', next: 'KeyE', previous: 'KeyQ', back: 'KeyB' } })));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('RouteScene', {});
  });
  await page.waitForFunction(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return r.routeEssentialAssetsReady && r.cardHoverDetailModule; });
  await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    r.openNodeChoices(w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'basin'));
    r.chooseNodeOption('refill_supplies');
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-supply-inspect-hit'));
  const state = () => page.evaluate(() => JSON.parse((window as any).render_game_to_text()).routeReward);
  const reading = async () => (await state())?.supplyInspection?.reading ?? null;
  const stable = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return JSON.stringify({ run: r.runState, pending: r.pendingRouteReward, focus: r.routeSupplyRewardChoiceIndex, armed: r.routeSupplyRewardArmedId });
  });
  // Browser animation frames can outpace Phaser's capped loop on fast displays.
  // Wait for actual game updates so a queued Enter cannot reach a later modal.
  const settleInput = async () => {
    const frame = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame);
    await page.waitForFunction(frame => (window as any).__birdSquadGame.loop.frame >= frame + 2, frame);
  };
  const press = async (key: string) => { await page.keyboard.press(key); await settleInput(); };
  const click = async (name: string, index = 0) => {
    const point = await page.evaluate(({ name, index }) => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      const root = r.children.getByName('route-supply-reader');
      const o = (root?.list ?? r.children.list).filter((o: any) => o.name === name)[index];
      const b = o.getBounds(), c = r.game.canvas.getBoundingClientRect();
      return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
    }, { name, index });
    await page.mouse.move(point.x, point.y);
    await page.waitForFunction(name => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return r.input.hitTestPointer(r.input.activePointer).some((o: any) => o.name === name); }, name);
    await page.mouse.click(point.x, point.y, { delay: 40 });
    await settleInput();
  };
  const sizes = [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }];
  const resize = async (size: { width: number; height: number }) => {
    await page.setViewportSize(size);
    await page.waitForFunction(() => { const b = document.querySelector('canvas')!.getBoundingClientRect(); return b.width <= innerWidth + 1 && b.height <= innerHeight + 1 && b.left >= -1 && b.top >= -1; });
  };
  if (!remapped) for (const size of sizes) {
    await resize(size);
    await page.screenshot({ path: info.outputPath(`supply-choices-${size.width}.png`) });
    const hits = await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), scale = r.game.canvas.getBoundingClientRect().height / 720; return r.children.list.filter((o: any) => o.name === 'route-supply-inspect-hit').map((o: any) => o.height * scale); });
    hits.forEach((h: number) => expect(h).toBeGreaterThanOrEqual(44));
  }
  // First activation arms; inspecting even the other choice must preserve it.
  await press('Enter');
  await expect.poll(async () => (await state())?.inputFocus?.armed).toBe(true);
  const before = await stable();
  await click('route-supply-inspect-hit', 1);
  await expect.poll(reading).not.toBeNull();
  expect(await stable()).toBe(before);
  await page.mouse.move(10, 10);
  expect(await reading()).not.toBeNull();
  if (!remapped) for (const size of sizes) {
    await resize(size);
    const geometry = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), p = r.children.getByName('route-supply-reader');
      const c = r.game.canvas.getBoundingClientRect();
      return { text: p.list.filter((o: any) => o.type === 'Text').map((o: any) => ({ x: o.getBounds().x, right: o.getBounds().right, bottom: o.getBounds().bottom, resolution: o.style.resolution })), body: p.getByName('route-supply-reader-body').style.fontSize, buttons: p.list.filter((o: any) => /reader-(next|previous|return)$/.test(o.name)).map((o: any) => o.height * c.height / 720) };
    });
    expect(geometry.body).toBe('22px');
    geometry.buttons.forEach((h: number) => expect(h).toBeGreaterThanOrEqual(44));
    geometry.text.forEach((t: any) => { expect(t.x).toBeGreaterThanOrEqual(404); expect(t.right).toBeLessThanOrEqual(876); expect(t.bottom).toBeLessThanOrEqual(660); expect(t.resolution).toBe(2); });
    await page.screenshot({ path: info.outputPath(`supply-reader-${size.width}.png`) });
  }
  await click('route-supply-reader-next');
  await expect.poll(async () => (await reading())?.page).toBe(2);
  expect((await reading()).text).not.toMatch(/\w+\(/);
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Reading page 2');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').renderAll());
  expect((await reading()).page).toBe(2);
  await press(keys.previous); expect((await reading()).page).toBe(1);
  await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.cardHoverDetailModule.updateRouteRewardGamepad(r, { right: true }, new Set()); });
  expect((await reading()).page).toBe(2);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').setRoutePaused(true));
  await press(keys.next); expect((await reading()).page).toBe(2);
  await press(keys.back); expect((await reading()).page).toBe(2);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').settingsOverlayOpen = true);
  await press(keys.next); expect((await reading()).page).toBe(2);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').settingsOverlayOpen = false);
  expect(await stable()).toBe(before);
  await click('route-supply-reader-return');
  await expect.poll(reading).toBeNull(); expect(await stable()).toBe(before);
  await press(keys.inspect); await expect.poll(reading).not.toBeNull();
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), held = new Set();
    for (let i = 0; i < 3; i++) r.cardHoverDetailModule.updateRouteRewardGamepad(r, { A: true }, held);
  });
  await expect.poll(reading).toBeNull(); expect(await stable()).toBe(before);
  await press(keys.inspect);
  await page.keyboard.down('Enter');
  await expect.poll(reading).toBeNull();
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await expect.poll(reading).toBeNull(); expect(await stable()).toBe(before);
  await press(keys.inspect); await press(keys.back);
  await expect.poll(reading).toBeNull(); expect(await stable()).toBe(before);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').input.gamepad.emit('down', {}, { index: 3 }));
  await expect.poll(reading).not.toBeNull();
  // The full-screen scrim absorbs the old choice's pointer activation.
  const outside = await page.evaluate(() => { const c = document.querySelector('canvas')!.getBoundingClientRect(); return { x: c.left + 954 * c.width / 1280, y: c.top + 417 * c.height / 720 }; });
  await page.mouse.click(outside.x, outside.y);
  await expect.poll(reading).toBeNull(); expect(await stable()).toBe(before);
  // Closing inspection is not a commitment; a fresh confirmation still packs exactly the armed item.
  const armed = (await state()).inputFocus.armedSupplyId;
  await press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState.supplies)).toEqual([armed]);
  expect(await state()).toBeUndefined();
  if (!remapped) {
    const results = await page.evaluate(supplies => {
      const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
      const basin = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'basin');
      r.openNodeChoices(basin); r.chooseNodeOption('refill_supplies');
      const results: any[] = [];
      for (const supplied of supplies) {
        r.routeSupplyRewardChoices = [supplied.id, supplies.find((s: any) => s.id !== supplied.id).id];
        r.routeSupplyRewardChoiceIndex = 0; r.routeSupplyRewardArmedId = undefined;
        r.renderAll();
        r.cardHoverDetailModule.handleRouteRewardAction(r, 'inspect');
        const seen: Record<string, string[]> = {};
        const bounds: any[] = [];
        for (let i = 0; i < 100; i++) {
          const read = JSON.parse(w.render_game_to_text()).routeReward.supplyInspection.reading;
          (seen[read.title] ??= []).push(read.text);
          const b = r.children.getByName('route-supply-reader').getByName('route-supply-reader-body').getBounds();
          bounds.push({ width: b.width, bottom: b.bottom });
          if (read.page === read.total) break;
          r.cardHoverDetailModule.handleRouteRewardAction(r, 'next');
        }
        results.push({ id: supplied.id, seen, bounds });
        r.cardHoverDetailModule.handleRouteRewardAction(r, 'back');
      }
      return results;
    }, supplies);
    expect(results).toHaveLength(supplies.length);
    for (const result of results) {
      const source = supplies.find((s: any) => s.id === result.id);
      expect(result.seen.EFFECT.join('').replace(/\s/g, '')).toBe(source.description.replace(/\s/g, ''));
      expect(result.seen.RULES.join('')).not.toMatch(/\w+\(/);
      expect(result.seen['SUPPLY DETAILS'].join('').replace(/\s/g, '')).toContain(source.name.replace(/\s/g, ''));
      result.bounds.forEach((b: any) => { expect(b.bottom).toBeLessThanOrEqual(498); expect(b.width).toBeLessThanOrEqual(464); });
    }
    const stress = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), supply = r.focusedRouteSupplyReward();
      const original = { name: supply.name, description: supply.description };
      supply.name = 'A deliberately very long Supply name '.repeat(12);
      supply.description = 'Return one card, then draw one. '.repeat(45) + 'W'.repeat(100);
      r.cardHoverDetailModule.handleRouteRewardAction(r, 'inspect');
      (window as any).__supplyStressRestore = () => Object.assign(supply, original);
      return { name: supply.name, description: supply.description };
    });
    const seen: Record<string, string[]> = {};
    for (let i = 0; i < 100; i++) {
      const read = await reading(); (seen[read.title] ??= []).push(read.text);
      const b = await page.evaluate(() => { const p = (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-supply-reader').getByName('route-supply-reader-body'), b = p.getBounds(); return { width: b.width, bottom: b.bottom }; });
      expect(b.bottom).toBeLessThanOrEqual(498); expect(b.width).toBeLessThanOrEqual(464);
      if (read.page === read.total) break;
      await press(keys.next);
    }
    expect(seen.EFFECT.join('').replace(/\s/g, '')).toBe(stress.description.replace(/\s/g, ''));
    expect(seen['SUPPLY DETAILS'].join('').replace(/\s/g, '')).toContain(stress.name.replace(/\s/g, ''));
    await page.screenshot({ path: info.outputPath('supply-long-reading.png') });
    await page.evaluate(() => (window as any).__supplyStressRestore());
  }
  expect(errors).toEqual([]);
});
