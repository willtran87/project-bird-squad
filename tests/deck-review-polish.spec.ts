import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('deck comparison pages preserve full rules and separate pin from selection', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('RouteScene', {});
    w.__birdSquadGame.scene.getScene('RouteScene').openDeckOverlay();
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('deck-review-compare-hit-major_00'));
  const press = async (key: string) => { await page.keyboard.press(key); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); };
  const state = () => page.evaluate(() => JSON.parse((window as any).render_game_to_text()).deckReview);
  const click = async (name: string) => {
    const point = await page.evaluate(name => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      const o = r.children.getByName(name), b = o.getBounds(), c = r.game.canvas.getBoundingClientRect();
      return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
    }, name);
    await page.mouse.move(point.x, point.y);
    await page.waitForFunction(name => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return r.input.hitTestPointer(r.input.activePointer).some((o: any) => o.name === name); }, name);
    await page.mouse.click(point.x, point.y, { delay: 40 });
  };
  const geometry = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.children.list.filter((o: any) => o.name === 'deck-review-row-hit').map((o: any, i: number) => {
      const pin = r.children.list.filter((p: any) => p.name.startsWith('deck-review-compare-hit-'))[i];
      return { right: o.getBounds().right, pinLeft: pin.getBounds().left, width: pin.width, height: pin.height };
    });
  });
  expect(geometry).toHaveLength(7);
  geometry.forEach((r: any) => { expect(r.pinLeft - r.right).toBeGreaterThanOrEqual(10); expect(r.width).toBe(58); expect(r.height).toBe(58); });
  const toolbar = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return ['filter', 'sort', 'search', 'save-folio', 'close'].map(key => {
      const o = r.children.getByName(`deck-review-${key}-hit`), b = o.getBounds();
      return { left: b.left, right: b.right, height: b.height };
    });
  });
  toolbar.forEach((r: any, i: number) => { expect(r.height).toBeGreaterThanOrEqual(58); if (i) expect(r.left - toolbar[i - 1].right).toBeGreaterThanOrEqual(8); });
  await click('deck-review-row-hit');
  expect((await state()).comparison.active).toBe(false);
  await click('deck-review-compare-hit-major_00');
  await expect.poll(async () => (await state()).comparison.reading?.page).toBe(1);
  const baseline = await state();
  expect(baseline.comparison.reading.headings).toEqual(['REMOVED / REPLACED', 'ADDED / REPLACEMENT']);
  expect(baseline.comparison.reading.bodies[0]).toContain('Deal 3.');
  expect(baseline.comparison.reading.bodies[1]).toContain('Deal 5.');
  expect(baseline.comparison.reading.bodies[0]).not.toContain('Draw 1.');
  const runBefore = await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState));
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport);
    await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`comparison-${viewport.width}.png`) });
    const text = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      return r.children.list.filter((o: any) => o.name.startsWith('deck-review-comparison-body-')).map((o: any) => ({ width: o.width, bottom: o.getBounds().bottom, size: o.style.fontSize, resolution: o.style.resolution }));
    });
    text.forEach((t: any) => { expect(t.width).toBeLessThanOrEqual(270); expect(t.bottom).toBeLessThanOrEqual(514); expect(t.size).toBe('20px'); expect(t.resolution).toBe(2); });
  }
  await press('PageDown');
  await expect.poll(async () => (await state()).comparison.reading.headings).toEqual(['MOLT · REMOVED / REPLACED', 'MOLT · ADDED / REPLACEMENT']);
  expect((await state()).comparison.reading.bodies[0]).toContain('2 Resonance');
  expect((await state()).comparison.reading.bodies[1]).toContain('3 Resonance');
  await page.screenshot({ path: info.outputPath('molt-differences.png') });
  await press('PageDown');
  await expect.poll(async () => (await state()).comparison.reading.headings).toEqual(['BASE RULES', 'PREENED RULES']);
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Comparison page 3');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').renderAll());
  expect((await state()).comparison.reading.page).toBe(3);
  await click('deck-review-comparison-next');
  await expect.poll(async () => [baseline.comparison.reading.bodies[1], (await state()).comparison.reading.bodies[1]].join(' ')).toContain('Cohesion +3');
  await press('/');
  await press('PageDown');
  expect((await state()).comparison.reading.page).toBe(4);
  await press('Enter');
  await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); r.setRoutePaused(true); r.input.gamepad.emit('down', {}, { index: 5 }); });
  await press('PageDown');
  expect((await state()).comparison.reading.page).toBe(4);
  await press('Escape');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').input.gamepad.emit('down', {}, { index: 4 }));
  expect((await state()).comparison.reading.page).toBe(3);
  expect((await state()).selectedCardId).toBe(baseline.selectedCardId);
  await press('ArrowDown');
  await expect.poll(async () => (await state()).comparison.mode).toBe('cards');
  expect((await state()).comparison.reading.page).toBe(1);

  // Stress the real lazy renderer with asymmetric rules, very long words and titles.
  const source = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const original = r.routeCardComparisonView.bind(r);
    const body = Array.from({ length: 40 }, (_, i) => `Rule ${i}: Gain Guard, then draw a card.`).join(' ') + ' ' + 'W'.repeat(80);
    r.routeCardComparisonView = (card: any, zone: string) => ({ ...original(card, zone), name: 'Long title '.repeat(15), currentText: card.id === 'major_00' ? body : 'Short rule.' });
    r.renderAll();
    return body;
  });
  const read: string[] = [];
  for (let i = 0; i < 80 && (await state()).comparison.reading.headings[0] !== 'NOW'; i++) await press('PageDown');
  for (let i = 0; i < 80; i++) {
    const reading = (await state()).comparison.reading;
    if (reading.headings[0] !== 'NOW') break;
    read.push(reading.bodies[0]);
    const bounds = await page.evaluate(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); const b = r.children.getByName('deck-review-comparison-body-0'); return { width: b.width, bottom: b.getBounds().bottom }; });
    expect(bounds.width).toBeLessThanOrEqual(270); expect(bounds.bottom).toBeLessThanOrEqual(514);
    await press('PageDown');
  }
  expect(read.join('').replace(/\s+/g, '')).toBe(source.replace(/\s+/g, ''));
  await page.screenshot({ path: info.outputPath('long-text.png') });
  const detail: string[] = [];
  for (let i = 0; i < 80; i++) {
    const reading = (await state()).comparison.reading;
    if (reading.headings[0] === 'CARD DETAILS') detail.push(reading.bodies[0]);
    if (reading.page === reading.total) break;
    await press('PageDown');
  }
  expect(detail.join(' ').replace(/\s+/g, ' ')).toContain('Long title '.repeat(15).trim());
  const last = (await state()).comparison.reading;
  await press('PageDown');
  expect((await state()).comparison.reading).toEqual(last);
  expect(await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState))).toBe(runBefore);
  await click('deck-review-close-hit');
  await expect.poll(async () => (await state()).open).toBe(false);
  expect(errors).toEqual([]);
});
