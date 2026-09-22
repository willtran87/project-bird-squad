import { test, expect } from '@playwright/test';
import { KEYWORDS } from '../src/game/keyword-definitions';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });
for (const mode of ['preen', 'cards', 'all-terms']) test(`comparison definitions stay readable and read-only: ${mode}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    localStorage.setItem('birdsquad.screenReader', 'on');
    localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { back: 'KeyQ' } }));
  });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('RouteScene', {});
    w.__birdSquadGame.scene.getScene('RouteScene').openDeckOverlay();
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('deck-review-control-guide'));
  await page.keyboard.press('c');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('deck-review-comparison-panel'));
  if (mode !== 'preen') await page.keyboard.press('ArrowDown');
  if (mode === 'all-terms') await page.evaluate(terms => {
    const s = (window as any).__birdSquadGame.scene.getScene('RouteScene'), original = s.routeCardComparisonView.bind(s);
    s.routeCardComparisonView = (card: any, zone: string) => ({ ...original(card, zone), currentText: terms.join('. ') + '.' });
    s.renderAll();
  }, Object.keys(KEYWORDS));
  const reading = () => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('deck-review-comparison-panel').getData('reading'));
  const stable = () => page.evaluate(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return JSON.stringify({ run: s.runState, selected: s.inspectedCardId, pinned: s.deckReviewCompareCardId, scroll: s.cardReviewScroll });
  });
  const before = await stable();
  const pages = await page.evaluate(() => {
    const panel = (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('deck-review-comparison-panel');
    const out: any[] = [], turn = panel.getData('changePage'), total = panel.getData('reading').total;
    for (let i = 0; i < total; i++) { out.push(panel.getData('reading')); turn(1); }
    turn(-total); return out;
  });
  const terms = [...new Set<string>(pages.filter(p => p.headings[0].startsWith('TERM · ')).map(p => p.headings[0]))];
  expect(terms).toContain('TERM · WINGBEAT');
  if (mode === 'all-terms') expect(terms).toHaveLength(Object.keys(KEYWORDS).length);
  for (const term of terms) {
    const definition = Object.entries(KEYWORDS).find(([key]) => term === `TERM · ${key.toUpperCase()}`)![1].def;
    expect(pages.filter(p => p.headings[0] === term).map(p => p.bodies[0]).join(' ').replace(/\s+/g, ' ')).toBe(definition);
  }
  const first = pages.findIndex(p => p.headings[0].startsWith('TERM · '));
  for (let i = 0; i < first; i++) await page.keyboard.press('PageDown');
  await settleCanvas(page);
  const start = await reading();
  await expect.poll(() => page.locator('#game-status').textContent()).toContain(start.headings[0]);
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    const geometry = await page.evaluate(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('RouteScene'), panel = s.children.getByName('deck-review-comparison-panel');
      const turn = panel.getData('changePage'), saved = panel.getData('reading').page;
      const checks: any[] = [];
      for (let i = saved; i <= panel.getData('reading').total; i++) {
        const body = s.children.getByName('deck-review-comparison-body-0'), b = body.getBounds();
        const right = s.children.getByName('deck-review-comparison-body-1');
        checks.push({ font: body.style.fontSize, resolution: body.style.resolution, width: b.width,
          bottom: b.bottom, rightText: right.text });
        turn(1);
      }
      turn(saved - panel.getData('reading').page);
      const next = s.children.getByName('deck-review-comparison-next'), scale = s.game.canvas.getBoundingClientRect().height / 720;
      return { checks, touch: next.width * scale >= 44 && next.height * scale >= 44 };
    });
    expect(geometry.touch).toBe(true);
    for (const g of geometry.checks) {
      expect(g.font).toBe('22px'); expect(g.resolution).toBe(2); expect(g.rightText).toBe('');
      expect(g.width).toBeLessThanOrEqual(580); expect(g.bottom).toBeLessThanOrEqual(502);
    }
    await page.screenshot({ path: info.outputPath(`terms-${width}.png`) });
  }
  const nextPoint = await page.evaluate(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const b = s.children.getByName('deck-review-comparison-next').getBounds(), c = s.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  });
  await page.touchscreen.tap(nextPoint.x, nextPoint.y); await settleCanvas(page);
  expect((await reading()).page).toBe(start.page + 1);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').input.gamepad.emit('down', {}, { index: 4 }));
  expect(await reading()).toEqual(start);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').renderAll());
  expect(await reading()).toEqual(start); expect(await stable()).toBe(before);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').setRoutePaused(true));
  await page.keyboard.press('PageDown'); expect(await reading()).toEqual(start);
  await page.keyboard.press('q'); await settleCanvas(page);
  await page.keyboard.press('PageUp');
  const columns = await page.evaluate(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return [0, 1].map(i => { const b = s.children.getByName(`deck-review-comparison-body-${i}`); return { size: b.style.fontSize, width: b.width, text: b.text }; });
  });
  columns.forEach(c => { expect(c.size).toBe('20px'); expect(c.width).toBeLessThanOrEqual(270); expect(c.text.length).toBeGreaterThan(0); });
  expect(await stable()).toBe(before);
  await page.keyboard.press('q'); await settleCanvas(page);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').deckOverlayOpen)).toBe(false);
  expect(JSON.parse(await stable())).toEqual({ run: JSON.parse(before).run, scroll: 0 });
  expect(errors).toEqual([]);
});
