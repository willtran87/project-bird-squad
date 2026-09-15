import { test, expect } from '@playwright/test';

for (const remapped of [false, true]) test(`Market cards use one readable decision surface, remapped=${remapped}`, async ({ page }, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(remapped => {
    localStorage.setItem('birdsquad.screenReader', 'on');
    if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { roost: 'Delete', previous: 'PageUp', next: 'PageDown', confirm: 'Backspace', back: 'KeyB' } }));
  }, remapped);
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('RouteScene', {});
  });
  await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').cardHoverDetailModule);
  await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'market') ?? w.__birdSquadCurrentMap().nodes.find((n: any) => n.type !== 'boss');
    node.type = 'market'; r.runState.scrap = 999; r.openMarketNode(node);
  });
  await page.waitForFunction(() => !!JSON.parse((window as any).render_game_to_text()).market?.rules);
  await page.waitForFunction(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.routeEssentialAssetsReady && r.children.list.some((o: any) => o.texture?.key === 'market-kit-background');
  });
  const press = async (key: string) => {
    await page.keyboard.press(key);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  };
  const state = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.updateTextState();
    return { market: JSON.parse((window as any).render_game_to_text()).market, run: JSON.stringify(r.runState) };
  });
  const point = (name: string) => page.evaluate(name => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      const panel = r.hoverCardDetail?.getByName('market-fixed-card-inspector');
      const o = panel?.getByName(name) ?? r.children.list.find((o: any) => o.getData?.('marketFocusId') === name);
      const b = o.getBounds(), c = r.game.canvas.getBoundingClientRect();
      return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
    }, name);
  const click = async (name: string) => {
    await page.evaluate(() => new Promise<void>(resolve => (window as any).__birdSquadGame.events.once('postrender', () => resolve())));
    const p = await point(name);
    await page.mouse.click(p.x, p.y); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  };
  const beforeBrowse = (await state()).run;
  await page.evaluate(() => new Promise<void>(resolve => (window as any).__birdSquadGame.events.once('postrender', () => resolve())));
  await page.mouse.move(0, 0);
  for (const id of ['card:1', 'card:2', 'card:3', 'card:0']) {
    const p = await point(id); await page.mouse.move(p.x, p.y, { steps: 3 });
    await expect.poll(async () => (await state()).market.input.focusId).toBe(id);
    const context = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      const panel = r.hoverCardDetail.getByName('market-fixed-card-inspector'), seen: string[] = [], molt: string[] = [];
      for (let i = 0; i < panel.getData('reading').total; i++) {
        const reading = panel.getData('reading'); if (reading.title === 'BUILD READ') seen.push(reading.text);
        if (reading.title === 'MOLT / PREEN') molt.push(reading.text);
        panel.getData('turnRulesPage')(1);
      }
      const card = r.marketCardOffers()[Number(r.marketFocusId.split(':')[1])].card;
      const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
      return { expected: normalize(r.marketBuildObservations.join(' ')), actual: normalize(seen.join(' ')),
        expectedMolt: normalize(card.moltTextUpgraded ?? ''), actualMolt: normalize(molt.join(' ')) };
    });
    expect(context.actual).toBe(context.expected); expect(context.actualMolt).toBe(context.expectedMolt);
    expect((await state()).run).toBe(beforeBrowse); expect((await state()).market.input.armed).toBe(false);
  }
  for (const viewport of remapped ? [{ width: 1000, height: 560 }] : [
    { width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 },
  ]) {
    await page.setViewportSize(viewport);
    const geometry = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), panel = r.hoverCardDetail.getByName('market-fixed-card-inspector');
      const frame = panel.getByName('market-rules-frame').getBounds(), body = panel.getByName('market-rules-body');
      const offers = r.children.list.filter((o: any) => typeof o.getData?.('marketFocusId') === 'string');
      const scale = r.game.canvas.getBoundingClientRect().width / 1280;
      const pages = panel.getData('reading').total, seen: Record<string, string[]> = {};
      let contained = true;
      for (let i = 0; i < pages; i++) {
        const reading = panel.getData('reading'); (seen[reading.title] ??= []).push(reading.text);
        contained &&= panel.list.filter((o: any) => o.type === 'Text').every((o: any) => {
          const b = o.getBounds(); return b.left >= frame.left + 16 && b.right <= frame.right - 16 && b.top >= frame.top + 10 && b.bottom <= frame.bottom - 8 && o.style.resolution === 2;
        }) && body.getBounds().bottom <= 530;
        panel.getData('turnRulesPage')(1);
      }
      return { contained, font: body.style.fontSize, pages, seen,
        oneReader: r.hoverCardDetail.list.length === 1,
        separated: offers.length === 4 && offers.every((o: any, i: number) => {
          const b = o.getBounds(); return b.left >= frame.right + 24 && b.right <= 1200 && b.bottom < 646 && (!i || b.left >= offers[i - 1].getBounds().right + 12);
        }),
        touch: panel.list.filter((o: any) => o.input).every((o: any) => o.input.hitArea.width * scale >= 44 && o.input.hitArea.height * scale >= 44),
        prices: r.children.list.filter((o: any) => o.name === 'market-card-price').map((o: any) => o.text),
        titles: r.children.list.filter((o: any) => o.name === 'market-card-offer-title').map((o: any) => ({ font: o.style.fontSize, bottom: o.getBounds().bottom, width: o.width })),
        wingbeats: panel.getByName('market-card-wingbeats').text,
        headers: ['market-section-heading', 'market-section-description'].map(name => {
          const o = r.children.getByName(name), b = o.getBounds();
          return { font: o.style.fontSize, resolution: o.style.resolution, contained: b.left >= 612 && b.right <= 1092 && b.top >= 242 && b.bottom <= 266 };
        }),
      };
    });
    expect(geometry.contained).toBe(true); expect(geometry.oneReader).toBe(true); expect(geometry.separated).toBe(true); expect(geometry.touch).toBe(true);
    expect(geometry.font).toBe('22px'); expect(geometry.pages).toBeGreaterThan(4);
    expect(geometry.seen['PASSIVE FLOCK BONUSES']).toBeTruthy(); expect(geometry.seen['PURCHASE PREVIEW'].join(' ')).toContain('Permanent collection ownership is kept');
    expect(geometry.wingbeats).toContain('Wingbeat');
    expect(geometry.headers).toEqual([{ font: '18px', resolution: 2, contained: true }, { font: '16px', resolution: 2, contained: true }]);
    expect(geometry.prices).toHaveLength(4); for (const price of geometry.prices) expect(price).toMatch(/^\d+ Scrap$/);
    for (const title of geometry.titles) { expect(title.font).toBe('18px'); expect(title.bottom).toBeLessThanOrEqual(598); expect(title.width).toBeLessThanOrEqual(136); }
    await page.screenshot({ path: info.outputPath(`cards-${viewport.width}.png`) });
  }
  await click('card:0'); const armed = await state(); expect(armed.market.input.armed).toBe(true);
  const lifecycle = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const counts = () => ({ keyboard: r.input.keyboard.listenerCount('keydown'), gamepad: r.input.gamepad.listenerCount('down'), shutdown: r.events.listenerCount('shutdown') });
    const before = counts(); let retired = true;
    for (let i = 0; i < 20; i++) {
      const oldReader = r.hoverCardDetail, oldObjects = [...r.children.list];
      r.renderAll();
      retired &&= !oldReader.scene && oldObjects.every((o: any) => !o.scene);
    }
    return { before, after: counts(), retired };
  });
  expect(lifecycle.retired).toBe(true); expect(lifecycle.after).toEqual(lifecycle.before);
  expect((await state()).run).toBe(armed.run); expect((await state()).market.input).toEqual(armed.market.input);
  await click('market-rules-next'); const next = await state(); expect(next.run).toBe(armed.run); expect(next.market.input).toEqual(armed.market.input);
  const index = next.market.rules.page;
  await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.renderAll(); r.renderHoverCardDetailRequest(); });
  expect((await state()).market.rules.page).toBe(index);
  await press(remapped ? 'Delete' : 'r'); expect((await state()).market.rules.page).toBe(index + 1);
  for (const overlay of ['pauseOverlayOpen', 'settingsOverlayOpen']) {
    const before = await state();
    await page.evaluate(overlay => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      if (overlay === 'pauseOverlayOpen') r.setRoutePaused(true); else r.openSettingsOverlay();
      r.hoverCardDetail.getByName('market-fixed-card-inspector').getData('turnRulesPage')(1);
    }, overlay);
    await press(remapped ? 'Delete' : 'r');
    expect((await state()).market.rules).toEqual(before.market.rules); expect((await state()).run).toBe(before.run);
    await press(remapped ? 'b' : 'Escape');
    await expect.poll(() => page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      return { pause: r.pauseOverlayOpen, settings: r.settingsOverlayOpen, inputOwned: !!r.registry.get('birdsquad.settingsInput.RouteScene'), queued: r.systemOverlayRefreshQueued, active: r.sys.settings.active, clockPaused: r.time.paused };
    })).toEqual({ pause: false, settings: false, inputOwned: false, queued: false, active: true, clockPaused: false });
    expect((await state()).market.input.armed).toBe(true);
  }
  await press(remapped ? 'b' : 'Escape');
  expect(await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return { armed: !!r.marketFocusArmedId, pause: r.pauseOverlayOpen, settings: r.settingsOverlayOpen, ready: r.routeEssentialAssetsReady, picker: r.cardPickerMode ?? null, registry: !!r.registry.get('birdsquad.settingsInput.RouteScene'), controls: !!r.registry.get('birdsquad.controlsPanel.RouteScene'), search: r.deckReviewSearchActive };
  })).toEqual({ armed: false, pause: false, settings: false, ready: true, picker: null, registry: false, controls: false, search: false });
  await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.runState.scrap = 0; r.renderAll(); });
  const unavailable = await state(); await click('card:0'); await click('market-rules-next');
  expect((await state()).run).toBe(unavailable.run); expect((await state()).market.input.armed).toBe(false);
  await page.screenshot({ path: info.outputPath('cards-unavailable-reader-1000.png') });
  expect(errors).toEqual([]);
});
