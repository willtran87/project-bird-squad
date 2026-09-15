import { test, expect } from '@playwright/test';

test('single-card Deck Review retains every rule and stays read-only', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('RouteScene', {});
    w.__birdSquadGame.scene.getScene('RouteScene').openDeckOverlay();
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('deck-review-detail-body'));
  const state = () => page.evaluate(() => JSON.parse((window as any).render_game_to_text()).deckReview);
  const press = async (key: string) => { await page.keyboard.press(key); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); };
  const stable = () => page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return JSON.stringify({ run: r.runState, selection: r.inspectedCardId, filter: r.deckReviewFilter, sort: r.deckReviewSort, scroll: r.cardReviewScroll }); });
  const click = async (name: string) => {
    const p = await page.evaluate(name => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), b = r.children.getByName(name).getBounds(), c = r.game.canvas.getBoundingClientRect(); return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 }; }, name);
    await page.mouse.move(p.x, p.y);
    await page.waitForFunction(name => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return r.input.hitTestPointer(r.input.activePointer).some((o: any) => o.name === name); }, name);
    await page.mouse.click(p.x, p.y, { delay: 40 });
  };
  const bounds = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), body = r.children.getByName('deck-review-detail-body'), title = r.children.getByName('deck-review-detail-title');
    return { width: body.width, bottom: body.getBounds().bottom, size: body.style.fontSize, resolution: body.style.resolution, titleBottom: title.getBounds().bottom,
      touch: ['next', 'previous'].every(s => r.children.getByName(`deck-review-detail-${s}`).height >= 58) };
  });
  const expectBounds = async () => { const b = await bounds(); expect(b.width).toBeLessThanOrEqual(376); expect(b.bottom).toBeLessThanOrEqual(528); expect(b.size).toBe('22px'); expect(b.resolution).toBe(2); expect(b.titleBottom).toBeLessThanOrEqual(247); expect(b.touch).toBe(true); };
  const before = await stable();
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size); await expectBounds();
    await page.screenshot({ path: info.outputPath(`single-card-${size.width}.png`) });
  }
  await click('deck-review-detail-next');
  await expect.poll(async () => (await state()).reading.title).toBe('PREEN');
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Reading page 2');
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Page Up and Page Down or controller LB and RB');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').renderAll());
  expect((await state()).reading.page).toBe(2);
  await press('/'); await press('PageDown'); expect((await state()).reading.page).toBe(2); await press('Enter');
  await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.setRoutePaused(true); r.input.gamepad.emit('down', {}, { index: 5 }); });
  await press('PageDown'); expect((await state()).reading.page).toBe(2); await press('Escape');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').openSettingsOverlay());
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').settingsOverlayOpen);
  await press('PageDown'); expect((await state()).reading.page).toBe(2); await press('Escape');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').input.gamepad.emit('down', {}, { index: 5 }));
  expect((await state()).reading.title).toBe('MOLT');
  await press('PageDown'); expect((await state()).reading.title).toBe('MOLT · PREEN');
  await press('PageUp'); expect((await state()).reading.title).toBe('MOLT');
  expect(await stable()).toBe(before);
  await press('c');
  await expect.poll(async () => (await state()).comparison.reading?.page).toBe(1);
  expect((await state()).reading).toBeUndefined();
  await press('c'); await expect.poll(async () => (await state()).reading?.page).toBe(3);
  await press('ArrowDown'); expect((await state()).reading.page).toBe(1);

  // Exercise the shipped reader against adversarial authoring, not shortened test copies.
  const source = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), original = r.routeCardComparisonView.bind(r);
    const rules = Array.from({ length: 36 }, (_, i) => `Rule ${i}: Gain Guard, then draw a card.`).join(' ') + ' ' + 'W'.repeat(80);
    const name = 'Very long card title '.repeat(18).trim();
    r.routeCardComparisonView = (card: any, zone: string) => ({ ...original(card, zone), name, currentText: rules, alternateText: rules });
    r.renderAll(); return { rules, name };
  });
  const captured: Record<string, string[]> = {};
  const changed = await stable();
  for (let i = 0; i < 100; i++) {
    const reading = (await state()).reading;
    (captured[reading.title] ??= []).push(reading.text);
    await expectBounds();
    if (i === 0) await page.screenshot({ path: info.outputPath('long-rules-1000.png') });
    if (reading.page === reading.total) break;
    await press('PageDown');
  }
  const normalize = (s: string) => s.replace(/\s+/g, '');
  expect(normalize(captured.NOW.join(''))).toBe(normalize(source.rules));
  expect(normalize(captured.PREEN.join(''))).toBe(normalize(source.rules));
  expect(normalize(captured['CARD DETAILS'].join(''))).toContain(normalize(source.name));
  const last = (await state()).reading; await press('PageDown'); expect((await state()).reading).toEqual(last);
  expect(await stable()).toBe(changed);
  await click('deck-review-close-hit'); expect((await state()).open).toBe(false);
  expect(errors).toEqual([]);
});
