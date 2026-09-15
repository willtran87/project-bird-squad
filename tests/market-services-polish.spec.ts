import { test, expect } from '@playwright/test';

test('Market services keep readable prices and separated targets through late districts and blocked Refresh', async ({ page }, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
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
    node.type = 'market'; r.runState.scrap = 999; r.openMarketNode(node); r.setMarketCategory('services');
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.list.some((o: any) => o.name === 'market-service-row'));
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.list.some((o: any) => o.texture?.key === 'market-kit-background'));
  const layout = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const all = (name: string) => r.children.list.filter((o: any) => o.name === name);
    const rows = all('market-service-row'), labels = all('market-service-label'), costs = all('market-service-cost-value'), icons = all('market-service-icon');
    const hits = r.children.list.filter((o: any) => /^(market-service-hit|market-refresh-hit)$/.test(o.name));
    return { count: rows.length, clean: all('market-service-button-frame').length === 0,
      separated: rows.every((row: any, i: number) => {
        const b = row.getBounds(), l = labels[i].getBounds(), c = costs[i].getBounds(), icon = icons[i]?.getBounds();
        return b.left >= 528 && b.right <= 1136 && b.top >= 282 && b.bottom <= 632 && (!i || b.top >= rows[i - 1].getBounds().bottom + 8)
          && l.left >= b.left + 64 && l.right <= c.left - 32 && l.top >= b.top + 6 && l.bottom <= b.bottom - 6 && c.right <= b.right - 20
          && (!icon || (icon.left >= b.left + 12 && icon.right <= l.left - 16 && icon.top >= b.top + 10 && icon.bottom <= b.bottom - 10))
          && labels[i].style.fontSize === '20px' && labels[i].style.resolution === 2 && costs[i].style.fontSize === '20px' && costs[i].style.resolution === 2;
      }), touch: hits.every((o: any) => o.width === 540 && o.height >= 58),
      prices: costs.map((o: any) => o.text),
    };
  });
  const snapshot = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return JSON.stringify({ run: r.runState, shelf: r.marketUtilityShelf, round: r.marketRefreshCount });
  });
  const point = (name: string) => page.evaluate(name => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const o = r.children.list.find((o: any) => o.name === name) ?? r.marketItemHover.getByName(name);
    const b = o.getBounds(), c = r.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, name);
  for (const late of [false, true]) {
    if (late) await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      r.marketUtilityShelf.push({ id: 'boss_guard', price: 225 }, { id: 'route_scout', price: 155 }); r.renderAll();
    });
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport);
      await page.waitForFunction(() => {
        const c = document.querySelector('canvas')!.getBoundingClientRect();
        return c.width > 0 && c.left >= -1 && c.top >= -1 && c.right <= innerWidth + 1 && c.bottom <= innerHeight + 1;
      });
      const result = await layout();
      expect(result.count).toBe(late ? 5 : 3); expect(result.clean).toBe(true); expect(result.separated).toBe(true); expect(result.touch).toBe(true);
      expect(result.prices.every((s: string) => /^\d+ Scrap$/.test(s))).toBe(true);
      expect(await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), scale = r.game.canvas.getBoundingClientRect().width / 1280;
        return r.children.list.filter((o: any) => /^(market-service-hit|market-refresh-hit)$/.test(o.name)).every((o: any) => o.width * scale >= 44 && o.height * scale >= 44);
      })).toBe(true);
      await page.screenshot({ path: info.outputPath(`services-${late ? 'late' : 'early'}-${viewport.width}.png`) });
    }
  }
  await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.runState.scrap = 0; r.renderAll(); });
  const before = await snapshot(), refresh = await point('market-refresh-hit');
  await page.mouse.move(refresh.x, refresh.y); await page.waitForTimeout(100);
  const blocked = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return { reason: r.marketItemHover.getByName('market-item-reader-blocker')?.text, price: r.marketRefreshCost(), enabled: r.children.list.find((o: any) => o.name === 'market-refresh-hit').getData('marketAvailable') };
  });
  const reason = await blocked(); expect(reason.reason).toBe(`NEED ${reason.price} MORE SCRAP`); expect(reason.enabled).toBe(false);
  await page.mouse.click(refresh.x, refresh.y); await page.keyboard.press('Enter');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').input.gamepad.emit('down', {}, { index: 0 }));
  expect(await snapshot()).toBe(before);
  const next = await point('market-item-reader-next'); await page.mouse.click(next.x, next.y);
  expect(await blocked()).toEqual(reason); expect(await snapshot()).toBe(before);
  await page.screenshot({ path: info.outputPath('refresh-unaffordable-1000.png') });
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.runState.scrap = 99999; r.marketUtilityShelf[0].sold = true;
    r.marketUtilityLabel = () => 'An exceptionally long service label '.repeat(12); r.renderAll();
  });
  expect((await layout()).separated).toBe(true); expect((await layout()).prices).toContain('Sold');
  expect(await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.children.list.filter((o: any) => o.name === 'market-service-label').every((o: any) => o.text === 'Refresh stock' || (o.text.endsWith('…') && o.getData('fullTitle').length > 300))
      && !r.children.list.some((o: any) => o.input?.enabled && o.getData?.('marketFocusId') === 'utility:0');
  })).toBe(true);
  await page.screenshot({ path: info.outputPath('services-long-sold-1000.png') });
  expect(errors).toEqual([]);
});
