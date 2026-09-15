import { test, expect } from '@playwright/test';

for (const remapped of [false, true]) test(`Market reads unavailable offers across devices without spending, remapped=${remapped}`, async ({ page }, info) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(remapped => {
    localStorage.setItem('birdsquad.screenReader', 'on');
    if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: {
      previous: 'PageUp', next: 'PageDown', confirm: 'Backspace', roost: 'Delete', back: 'KeyB',
    } }));
  }, remapped);
  const keys = remapped ? { next: 'PageDown', previous: 'PageUp', confirm: 'Backspace', inspect: 'Delete' }
    : { next: 'ArrowRight', previous: 'ArrowLeft', confirm: 'Enter', inspect: 'r' };
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('RouteScene', {});
  });
  await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').cardHoverDetailModule);
  await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'market') ?? w.__birdSquadCurrentMap().nodes.find((n: any) => n.type !== 'boss');
    r.runState.scrap = 0; r.openMarketNode({ ...node, type: 'market' });
  });
  await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('market-input-help-text'));
  const settle = () => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const press = async (key: string) => { await page.keyboard.press(key); await settle(); };
  const state = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.updateTextState();
    const hint = r.children.getByName('market-input-help-text');
    return { market: JSON.parse((window as any).render_game_to_text()).market,
      run: JSON.stringify(r.runState), hint: hint.text, mode: hint.getData('inputMode') };
  });
  const pad = async (button: 'right' | 'A' | 'Y', held = false) => {
    await page.evaluate(({ button, held }) => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), plugin = r.input.gamepad, saved = plugin._pad1;
      const fake: any = { connected: true, isButtonDown: () => false, [button]: true };
      try {
        plugin._pad1 = fake; plugin.emit('down', fake, { index: { right: 15, A: 0, Y: 3 }[button] });
        r.update(); if (held) for (let i = 0; i < 20; i++) r.update();
        fake[button] = false; r.update();
      } finally { plugin._pad1 = saved; }
    }, { button, held }); await settle();
  };
  for (const category of ['cards', 'waymarks', 'supplies', 'services']) {
    await page.evaluate(category => (window as any).__birdSquadGame.scene.getScene('RouteScene').setMarketCategory(category), category);
    const before = await state(), count = before.market.input.count;
    expect(count).toBeGreaterThan(0);
    const visited = new Set<string>();
    for (let i = 0; i < count; i++) {
      await press(keys.next);
      const selected = await state(); visited.add(selected.market.input.focusId);
      expect(selected.market.input.available).toBe(false);
      expect(selected.market.input.focusVisible).toBe(true);
      expect(selected.market.rules?.total).toBeGreaterThan(0);
      expect(selected.hint).toContain('requirements');
      expect(selected.mode).toBe('keyboard');
      await press(keys.confirm); await press(keys.inspect);
      const after = await state();
      expect(after.run).toBe(before.run);
      expect(after.market.input.focusId).toBe(selected.market.input.focusId);
      expect(after.market.input.armed).toBe(false);
    }
    expect(visited.size).toBe(count);
    const oldIndex = (await state()).market.input.index;
    await pad('right', true);
    expect((await state()).market.input.index).toBe((oldIndex + 1) % count);
    await pad('A', true); await pad('Y');
    expect((await state()).run).toBe(before.run);
    expect((await state()).hint).toContain('LB/RB');
    for (const viewport of (remapped ? [{ width: 1000, height: 560 }] : [
      { width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 },
    ])) {
      await page.setViewportSize(viewport); await press(keys.previous);
      const geometry = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
        const hint = r.children.getByName('market-input-help-text'), b = hint.getBounds(), frame = r.children.getByName('market-input-help').getBounds();
        return { contained: b.left >= frame.left + 10 && b.right <= frame.right - 10 && b.top >= frame.top + 4 && b.bottom <= frame.bottom - 4 && b.bottom <= 720,
          font: hint.style.fontSize, resolution: hint.style.resolution,
          lines: hint.getWrappedText().length,
          tabs: r.children.list.filter((o: any) => o.name === 'market-category-tab' && o.type === 'Text').map((o: any) => ({ font: o.style.fontSize, width: o.width })),
        };
      });
      expect(geometry.contained).toBe(true); expect(geometry.font).toBe('16px'); expect(geometry.resolution).toBe(2);
      expect(geometry.lines).toBe(2);
      for (const tab of geometry.tabs) { expect(tab.font).toBe('18px'); expect(tab.width).toBeLessThanOrEqual(128); }
      await page.screenshot({ path: info.outputPath(`${category}-unavailable-${viewport.width}.png`) });
    }
  }
  // Stale callbacks and polling must not act behind a system overlay.
  for (const overlay of ['pauseOverlayOpen', 'settingsOverlayOpen']) {
    const before = await state();
    await page.evaluate(overlay => { (window as any).__birdSquadGame.scene.getScene('RouteScene')[overlay] = true; }, overlay);
    await press('ArrowDown'); await press('Tab'); await pad('right'); await pad('A');
    await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      r.cardHoverDetailModule.cycleMarketFocus(r, 1); r.cardHoverDetailModule.activateMarketFocus(r);
      r.cardHoverDetailModule.cycleMarketCategory(r, 1); r.setMarketCategory('cards');
      const hit = r.children.list.find((o: any) => o.getData?.('marketFocusId') === 'refresh');
      hit.emit('pointerdown'); hit.emit('pointerover');
    });
    const after = await state(); expect(after.run).toBe(before.run);
    expect(after.market.input).toEqual(before.market.input); expect(after.market.category).toBe(before.market.category);
    await page.evaluate(overlay => { (window as any).__birdSquadGame.scene.getScene('RouteScene')[overlay] = false; }, overlay);
  }
  // Affordability is separate from capacity and eligibility.
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.runState.scrap = 999; r.runState.supplies = Array(2).fill(r.marketUtilityShelf.find((o: any) => o.supplyId).supplyId);
    r.setMarketCategory('supplies'); r.renderAll();
  });
  await press(keys.next); const full = await state();
  expect(full.market.input.available).toBe(false);
  expect(full.market.decisionPreview).toContain('SUPPLY POUCH FULL');
  await press(keys.confirm); expect((await state()).run).toBe(full.run);
  const point = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const hit = r.children.list.find((o: any) => o.getData?.('marketFocusId') === r.marketFocusId), b = hit.getBounds(), c = r.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  });
  await page.mouse.click(point.x, point.y); await settle();
  expect((await state()).run).toBe(full.run); expect((await state()).market.input.armed).toBe(false);
  expect((await state()).mode).toBe('pointer');
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.runState.deck.forEach((card: any) => card.upgraded = true);
    r.setMarketCategory('services'); r.marketFocusId = `utility:${r.marketUtilityShelf.findIndex((o: any) => o.id === 'preen')}`; r.renderAll();
  });
  const noPreen = await state(); expect(noPreen.market.input.available).toBe(false);
  expect(noPreen.market.decisionPreview).toContain('NO ELIGIBLE CARD');
  await press(keys.confirm); expect((await state()).run).toBe(noPreen.run);
  // Available purchases retain the established single keyboard confirmation.
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.setMarketCategory('waymarks');
  });
  expect((await state()).market.input.available).toBe(true);
  await press(keys.confirm);
  expect((await state()).market.scrap).toBeLessThan(999);
  expect(errors).toEqual([]);
});
