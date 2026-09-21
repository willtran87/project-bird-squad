import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

for (const remapped of [false, true]) test(`Deck Review hints follow input without changing decisions, remapped=${remapped}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  if (remapped) await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({
    confirm: 'KeyK', back: 'KeyQ', previous: 'KeyA', next: 'KeyD', mute: 'KeyV',
  })));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('RouteScene', {});
    w.__birdSquadGame.scene.getScene('RouteScene').openDeckOverlay();
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('deck-review-control-guide'));
  const hints = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const label = r.children.getByName('deck-review-control-guide');
    return { text: label.text, mode: label.getData('inputMode'), size: label.style.fontSize,
      bottom: label.getBounds().bottom, top: label.getBounds().top, lines: label.getWrappedText().length,
      paging: r.children.getByName('deck-review-comparison-hint')?.text,
      panelBottom: (r.children.getByName('deck-review-comparison-panel') ?? r.children.getByName('deck-review-detail-panel'))?.getBounds().bottom };
  });
  const before = await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState));
  expect((await hints()).text).toBe('Select a card to read its rules · Pin to compare');
  await page.keyboard.press('Shift');
  expect((await hints()).mode).toBe('keyboard');
  expect((await hints()).text).toContain(remapped ? 'A/D: filter · K: sort' : 'Left/Right: filter · Enter: sort');
  expect((await hints()).text).toContain(remapped ? 'Q: close' : 'Esc: close');
  if (remapped) {
    expect((await hints()).text).toContain('Click Save');
    const folios = () => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').savedDeckRecordState().count);
    const count = await folios();
    await page.keyboard.press('v');
    expect(await folios()).toBe(count);
  }
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').input.gamepad.emit('down', {}, { index: 2 }));
  expect((await hints()).mode).toBe('controller');
  expect((await hints()).text).toContain('A: sort · X: pin · Y: save · B: close');
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    for (const mode of ['controller', 'keyboard', 'pointer']) {
      if (mode === 'keyboard') await page.keyboard.press('Shift');
      if (mode === 'pointer') {
        const point = await page.locator('canvas').evaluate(canvas => { const b = canvas.getBoundingClientRect(); return { x: b.left + 8, y: b.top + b.height / 2 }; });
        await page.mouse.click(point.x, point.y);
      }
      const h = await hints();
      expect(h.mode).toBe(mode); expect(h.size).toBe('18px');
      expect(h.lines).toBeLessThanOrEqual(2); expect(h.bottom).toBeLessThanOrEqual(698);
      if (h.panelBottom) expect(h.top - h.panelBottom).toBeGreaterThanOrEqual(6);
      if (h.paging) expect(h.paging).toBe(mode === 'controller' ? 'LB / RB: pages' : mode === 'keyboard' ? 'PgUp / PgDn: pages' : 'Use Previous / Next');
      await page.screenshot({ path: info.outputPath(`review-${width}-${mode}.png`) });
    }
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').input.gamepad.emit('down', {}, { index: 2 }));
  }
  const lifetime = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const counts = () => [r.input.listenerCount('pointerdown'), r.input.keyboard.listenerCount('keydown'), r.input.gamepad.listenerCount('down')];
    const before = counts();
    for (let i = 0; i < 12; i++) r.renderAll();
    return { before, after: counts(), run: JSON.stringify(r.runState) };
  });
  expect(lifetime.after).toEqual(lifetime.before); expect(lifetime.run).toBe(before);
  expect(errors).toEqual([]);
});
