import { test, expect } from '@playwright/test';
import { KEYWORDS } from '../src/game/keyword-definitions';

for (const remapped of [false, true]) test(`Market item reader keeps complete text and purchase intent, remapped=${remapped}`, async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  if (remapped) await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { roost: 'KeyJ', previous: 'KeyQ', next: 'KeyE', back: 'KeyB' } })));
  const inspect = remapped ? 'j' : 'r', back = remapped ? 'b' : 'Escape';
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
    const market = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'market') ?? w.__birdSquadCurrentMap().nodes.find((n: any) => n.type !== 'boss');
    r.runState.scrap = 999; r.openMarketNode({ ...market, type: 'market' });
  });
  await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').cardHoverDetailModule);
  const state = () => page.evaluate(() => JSON.parse((window as any).render_game_to_text()).market);
  const stable = () => page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return JSON.stringify({ run: r.runState, focus: r.marketFocusId, armed: r.marketFocusArmedId, category: r.marketCategory }); });
  const press = async (key: string) => { await page.keyboard.press(key); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); };
  const point = (name: string) => page.evaluate(name => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const target = r.marketItemHover?.getByName(name) ?? r.children.list.find((o: any) => o.name === name || o.getData?.('marketFocusId') === name);
    const b = target.getBounds(), c = r.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, name);
  const click = async (name: string) => { const p = await point(name); await page.mouse.move(p.x, p.y); await page.waitForTimeout(60); await page.mouse.click(p.x, p.y, { delay: 30 }); await page.waitForTimeout(60); };
  for (const category of ['waymarks', 'supplies', 'services']) {
    await page.evaluate(category => (window as any).__birdSquadGame.scene.getScene('RouteScene').setMarketCategory(category), category);
    await expect.poll(async () => (await state()).rules?.page).toBe(1);
    const before = await stable();
    if (category !== 'services') {
      const terms = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), panel = r.marketItemHover;
        const turn = panel.getData('turnRulesPage'), first = panel.getData('reading').page, pages: any[] = [];
        turn(-(first - 1));
        const total = panel.getData('reading').total;
        for (let i = 0; i < total; i++) { pages.push({ ...panel.getData('reading') }); if (i < total - 1) turn(1); }
        turn(-(total - 1));
        return pages.filter(page => page.title.startsWith('TERM · '));
      });
      expect(terms.length).toBeGreaterThan(0);
      for (const title of new Set(terms.map(term => term.title))) {
        const canonical = Object.keys(KEYWORDS).find(key => title === `TERM · ${key.toUpperCase()}`)!;
        expect(terms.filter(term => term.title === title).map(term => term.text).join(' ').replace(/\s+/g, ' '))
          .toBe(KEYWORDS[canonical].def);
      }
      expect(await stable()).toBe(before);
    }
    for (const viewport of (remapped ? [{ width: 1000, height: 560 }] : [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }])) {
      await page.setViewportSize(viewport);
      const geometry = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), p = r.marketItemHover, frame = p.getByName('market-item-reader-frame').getBounds();
        return { contained: p.list.filter((o: any) => o.type === 'Text').every((o: any) => { const b = o.getBounds(); return b.left >= frame.left + 16 && b.right <= frame.right - 16 && b.top >= frame.top + 10 && b.bottom <= frame.bottom - 8 && o.style.resolution === 2; }),
          separated: r.children.list.filter((o: any) => typeof o.getData?.('marketFocusId') === 'string').every((o: any) => o.getBounds().left >= frame.right + 24),
          size: p.getByName('market-item-reader-body').style.fontSize,
          touch: ['next', 'previous'].every(s => p.getByName(`market-item-reader-${s}`).height >= 58) };
      });
      await page.screenshot({ path: info.outputPath(`${category}-${viewport.width}.png`) });
      expect(geometry).toEqual({ contained: true, separated: true, size: '22px', touch: true });
    }
    await click('market-item-reader-next'); expect((await state()).rules.page).toBe(2);
    await expect.poll(() => page.locator('#game-status').textContent()).toContain('Rules 2 of');
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').renderAll()); expect((await state()).rules.page).toBe(2);
    await press(inspect); expect((await state()).rules.page).toBe(3);
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').input.gamepad.emit('down', {}, { index: 3 })); expect((await state()).rules.page).toBe(4);
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').setRoutePaused(true));
    await press(inspect); expect((await state()).rules.page).toBe(4); await press(back);
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').settingsOverlayOpen = true);
    await press(inspect); expect((await state()).rules.page).toBe(4);
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').settingsOverlayOpen = false);
    expect(await stable()).toBe(before);
    await click((await state()).input.focusId);
    expect((await state()).input.armed).toBe(true);
    const armed = await stable(), reading = (await state()).rules;
    const other = await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return r.children.list.find((o: any) => typeof o.getData?.('marketFocusId') === 'string' && o.getData('marketFocusId') !== r.marketFocusId)?.getData('marketFocusId'); });
    if (other) { const p = await point(other); await page.mouse.move(p.x, p.y); await page.waitForTimeout(100); expect(await stable()).toBe(armed); expect((await state()).rules).toEqual(reading); }
    await click('market-item-reader-next'); expect(await stable()).toBe(armed);
    await press(back); expect((await state()).input.armed).toBe(false); expect((await state()).category).toBe(category);
  }
  const refreshPoint = await point('refresh');
  await page.mouse.move(refreshPoint.x, refreshPoint.y); await page.waitForTimeout(100);
  expect((await state()).rules.text).toContain('Refresh');
  const beforeRefresh = await stable();
  await click('market-item-reader-next'); expect(await stable()).toBe(beforeRefresh);
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.runState.scrap = 0; r.setMarketCategory('waymarks');
    r.children.list.find((o: any) => o.input?.enabled && o.getData?.('marketAvailable') === false).setName('unaffordable-offer');
  });
  const unavailablePoint = await point('unaffordable-offer');
  await page.mouse.move(unavailablePoint.x, unavailablePoint.y); await page.waitForTimeout(100);
  const unavailable = await stable();
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').marketItemHover.getByName('market-item-reader-blocker').text)).toMatch(/^NEED \d+ MORE SCRAP$/);
  await click('market-item-reader-next'); expect(await stable()).toBe(unavailable);
  await page.screenshot({ path: info.outputPath('unaffordable-1000.png') });
  await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.runState.scrap = 999; r.setMarketCategory('services'); });
  const original = await stable();
  const source = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), original = r.showMarketItemDetail.bind(r);
    const body = Array.from({ length: 10 }, (_, i) => `Effect ${i}: Draw a card, then gain Guard.`).join(' ') + ' ' + 'W'.repeat(80);
    const title = 'Long supply name '.repeat(18).trim();
    r.showMarketItemDetail = (opts: any) => original({ ...opts, title, body, meta: body, observations: [body], decisionPreview: [body] });
    r.renderAll(); return { body, title };
  });
  const texts: Record<string, string[]> = {};
  const total = (await state()).rules.total;
  for (let i = 0; i < total; i++) {
    const reading = (await state()).rules; (texts[reading.title] ??= []).push(reading.text);
    const b = await page.evaluate(() => { const p = (window as any).__birdSquadGame.scene.getScene('RouteScene').marketItemHover, body = p.getByName('market-item-reader-body'); return { width: body.width, bottom: body.getBounds().bottom }; });
    expect(b.width).toBeLessThanOrEqual(376); expect(b.bottom).toBeLessThanOrEqual(530);
    if (!i) await page.screenshot({ path: info.outputPath('long-text-1000.png') });
    await press(inspect);
  }
  const normalize = (s: string) => s.replace(/\s+/g, '');
  for (const section of ['EFFECT', 'RULES', 'BUILD READ', 'PURCHASE PREVIEW']) expect(normalize(texts[section].join(''))).toBe(normalize(source.body));
  expect(normalize(texts['ITEM DETAILS'].join(''))).toContain(normalize(source.title));
  expect((await state()).rules.page).toBe(1); expect(await stable()).toBe(original);
  await press(back); expect(await state()).toBeUndefined();
  expect(errors).toEqual([]);
});
