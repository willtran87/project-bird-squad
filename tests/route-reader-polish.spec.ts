import { test, expect } from '@playwright/test';

for (const remapped of [false, true]) test(`route reward and Market candidate reading is complete and read-only, remapped=${remapped}`, async ({ page }, info) => {
  test.setTimeout(120_000);
  const keys = remapped ? { inspect: 'j', previous: 'q', next: 'e', back: 'b' } : { inspect: 'r', previous: 'ArrowLeft', next: 'ArrowRight', back: 'Escape' };
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  if (remapped) await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { roost: 'KeyJ', previous: 'KeyQ', next: 'KeyE', back: 'KeyB' } })));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('RouteScene', {});
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').cardHoverDetailModule);
  const press = async (key: string) => { await page.keyboard.press(key); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); };
  const reading = () => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').cardHoverDetailRequest?.inspectionRules ?? null);
  const stable = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return JSON.stringify({ run: r.runState, picker: r.cardPickerArmedIndex, focus: r.cardPickerFocusIndex, reward: r.routeRewardArmedCardId, rewardIndex: r.routeRewardChoiceIndex });
  });
  const click = async (name: string) => {
    // A redraw queues new interactive objects until Phaser's next frame.
    await page.evaluate(() => new Promise<void>(resolve => (window as any).__birdSquadGame.events.once('postrender', () => resolve())));
    const p = await page.evaluate(name => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      const o = r.hoverCardDetail.getByName('route-inspection-reader').getByName(name), b = o.getBounds(), c = r.game.canvas.getBoundingClientRect();
      return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
    }, name);
    await page.mouse.move(p.x, p.y);
    await page.waitForFunction(name => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return r.input.hitTestPointer(r.input.activePointer).some((o: any) => o.name === name); }, name);
    await page.mouse.click(p.x, p.y, { delay: 40 });
  };
  for (const mode of ['preen', 'release', 'reward']) {
    await page.evaluate(mode => {
      const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
      r.hideHoverCardDetail(); r.cardPickerInspectionOpen = false; r.routeRewardInspectionCardId = undefined;
      r.cardPickerMode = undefined; r.pendingRouteReward = undefined; r.marketOpen = false;
      if (mode === 'reward') {
        r.openRouteRewardMenu({ id: 'reader-cache', type: 'cache', label: 'Cache', payloadId: 'reader-cache' },
          { key: 'reader', text: 'Review the cards.', effects: ['addCard(chooseOneOfTwoUncommonOrRare)'], locked: false }, structuredClone(r.runState));
        r.cycleRouteRewardChoice(1);
      } else {
        const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type !== 'boss');
        r.openMarketNode({ ...node, type: 'market' }); r.runState.scrap = 999;
        r.cardPickerMode = mode; r.cardPickerContext = 'market'; r.cardPickerFocusIndex = 1;
        r.cardPickerArmedIndex = r.pickerEligibleCards(mode)[1].index; r.cardPickerScroll = 0;
        r.renderAll();
      }
    }, mode);
    await page.waitForFunction(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return !r.pendingRouteReward || r.routeRewardOverlayModule; });
    const before = await stable();
    await press(keys.inspect);
    await expect.poll(reading).not.toBeNull();
    expect(await stable()).toBe(before);
    if (!remapped) for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size);
      const bounds = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), p = r.hoverCardDetail.getByName('route-inspection-reader');
        const frame = p.getByName('route-inspection-reader-frame').getBounds();
        return { frame, text: p.list.filter((o: any) => o.type === 'Text').map((o: any) => ({ ...o.getBounds(), bottom: o.getBounds().bottom, right: o.getBounds().right, resolution: o.style.resolution })), body: { size: p.getByName('route-inspection-reader-body').style.fontSize, bottom: p.getByName('route-inspection-reader-body').getBounds().bottom }, buttons: p.list.filter((o: any) => o.name.endsWith('-next') || o.name.endsWith('-previous')).map((o: any) => o.height) };
      });
      expect(bounds.body.size).toBe('22px'); expect(bounds.body.bottom).toBeLessThanOrEqual(518);
      bounds.buttons.forEach((height: number) => expect(height).toBeGreaterThanOrEqual(58));
      bounds.text.forEach((t: any) => { expect(t.x).toBeGreaterThanOrEqual(bounds.frame.x + 16); expect(t.right).toBeLessThanOrEqual(bounds.frame.x + bounds.frame.width - 16); expect(t.bottom).toBeLessThanOrEqual(640); expect(t.resolution).toBe(2); });
      await page.screenshot({ path: info.outputPath(`${mode}-${size.width}.png`) });
    }
    await click('route-inspection-reader-next');
    await expect.poll(async () => (await reading())?.page).toBe(2);
    const artRefresh = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), p = r.hoverCardDetail.getByName('route-inspection-reader');
      const next = p.getByName('route-inspection-reader-next'), body = p.getByName('route-inspection-reader-body');
      const before = JSON.stringify(p.getData('reading'));
      p.getData('updateArt')(r.cardHoverDetailRequest.artKey);
      r.refreshRouteArtwork();
      return { sameButton: next === p.getByName('route-inspection-reader-next') && next.active,
        sameBody: body === p.getByName('route-inspection-reader-body'), samePage: before === JSON.stringify(p.getData('reading')) };
    });
    expect(artRefresh).toEqual({ sameButton: true, sameBody: true, samePage: true });
    await expect.poll(() => page.locator('#game-status').textContent()).toContain('Reading page 2');
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').renderAll());
    expect((await reading()).page).toBe(2);
    await press(keys.previous); expect((await reading()).page).toBe(1);
    await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.cardHoverDetailModule.updateRouteRewardGamepad(r, { right: true }, new Set()); });
    expect((await reading()).page).toBe(2);
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').setRoutePaused(true));
    await press(keys.next);
    expect((await reading()).page).toBe(2);
    await press(keys.back);
    expect(await stable()).toBe(before);
    await press(keys.back);
    await expect.poll(reading).toBeNull();
    expect(await stable()).toBe(before);
    await press(keys.inspect);
    await expect.poll(async () => (await reading())?.page).toBe(1);
    // Holding A to return from reading cannot become a purchase on the next poll.
    await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), held = new Set();
      for (let frame = 0; frame < 3; frame++) r.cardHoverDetailModule.updateRouteRewardGamepad(r, { A: true }, held);
    });
    await expect.poll(reading).toBeNull();
    expect(await stable()).toBe(before);
    await press(keys.inspect);
    await expect.poll(async () => (await reading())?.page).toBe(1);
    await press('Enter');
    await expect.poll(reading).toBeNull();
    expect(await stable()).toBe(before);
  }
  // Stress all sections without changing any gameplay card data.
  await press(keys.inspect);
  await expect.poll(reading).not.toBeNull();
  const source = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), v = r.cardHoverDetailRequest;
    v.name = 'An unusually long card name '.repeat(12);
    v.currentText = 'Gain 1 Guard, then draw 1 card. '.repeat(45) + 'W'.repeat(90);
    v.upgradedText = 'Gain 2 Guard. '.repeat(30); v.moltText = 'Gain 2 Resonance. '.repeat(20);
    v.stats = Array.from({ length: 16 }, (_, i) => `Passive contribution ${i} +1`);
    r.renderHoverCardDetailRequest();
    return { NOW: v.currentText, PREEN: v.upgradedText, MOLT: v.moltText, 'PASSIVE FLOCK BONUSES': v.stats.join(' '), 'CARD DETAILS': v.name };
  });
  const seen: Record<string, string[]> = {};
  for (let i = 0; i < 100; i++) {
    const current = await reading(); (seen[current.title] ??= []).push(current.text);
    const b = await page.evaluate(() => { const p = (window as any).__birdSquadGame.scene.getScene('RouteScene').hoverCardDetail.getByName('route-inspection-reader').getByName('route-inspection-reader-body'); return { bottom: p.getBounds().bottom, width: p.width }; });
    expect(b.bottom).toBeLessThanOrEqual(518); expect(b.width).toBeLessThanOrEqual(396);
    if (current.page === current.total) break;
    await press(keys.next);
  }
  for (const [section, expected] of Object.entries(source)) {
    const actual = seen[section].join('').replace(/\s+/g, '');
    if (section === 'CARD DETAILS') expect(actual).toContain(expected.replace(/\s+/g, ''));
    else expect(actual).toBe(expected.replace(/\s+/g, ''));
  }
  await page.screenshot({ path: info.outputPath('long-reading.png') });
  expect(errors).toEqual([]);
});
