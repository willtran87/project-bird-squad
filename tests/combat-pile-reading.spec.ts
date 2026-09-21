import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });
const point = (page: Page, name: string) => page.evaluate(name => {
  const s = (window as any).__birdSquadGame.scene.getScene('BattleScene');
  const b = s.root.getByName(name).getBounds(), c = s.game.canvas.getBoundingClientRect();
  return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
}, name);

for (const remapped of [false, true]) test(`combat piles use quiet navigation and preserve decisions, remapped=${remapped}`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(remapped => {
    localStorage.setItem('birdsquad.screenReader', 'on');
    if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1,
      bindings: { previous: 'KeyJ', next: 'KeyL', guide: 'KeyG', back: 'KeyB' } }));
  }, remapped);
  await page.setViewportSize({ width: 2560, height: 1600 }); await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => { const s = (window as any).__birdSquadGame.scene.getScene('BattleScene'); return s.battleHandRendererModule && !s.combatInteractionLocked(); });
  await page.evaluate(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    s.onCardClicked(s.hand[0].instanceId);
    const seed = s.hand[0];
    s.drawPile = Array.from({ length: 14 }, (_, i) => ({ ...seed, instanceId: `reading-${i.toString().padStart(2, '0')}`,
      name: i === 0 ? 'A deliberately long card identity that must never spill across the navigation or hide its omission' : seed.name }));
    s.discardPile = [{ ...seed, instanceId: 'reading-discard' }]; s.clearedPile = [];
  });
  const stable = () => page.evaluate(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ selected: s.selectedInstanceId, target: s.selectedEnemyId, turn: s.turn,
      energy: s.energy, hand: s.hand, draw: s.drawPile, discard: s.discardPile, cleared: s.clearedPile, flock: s.flock, enemies: s.enemies, run: s.runState });
  });
  const before = await stable();
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').openOverlay('draw'));
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('combat-pile-card-art'));
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size); await settleCanvas(page);
    for (const mode of ['deck', 'draw', 'discard', 'cleared']) {
      const pos = await point(page, `combat-pile-zone-${mode}-hit`);
      await page.touchscreen.tap(pos.x, pos.y); await settleCanvas(page);
      const geometry = await page.evaluate(() => {
        const s = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        const surface = s.root.getByName('combat-pile-panel');
        const list = s.root.list.slice(s.root.list.indexOf(surface));
        const panel = surface.getBounds();
        const labels = list.filter((o: any) => o.type === 'Text' && o.name.startsWith('combat-pile-'));
        const overlap = labels.flatMap((a: any, i: number) => labels.slice(i + 1).filter((b: any) => {
          const x = a.getBounds(), y = b.getBounds(); return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
        }).map((b: any) => [a.name, b.name]));
        const targets = list.filter((o: any) => o.name.startsWith('combat-pile-') && o.name.endsWith('-hit') && o.input?.enabled);
        const scale = s.game.canvas.getBoundingClientRect().height / 720;
        return { mode: s.inspectOverlay, overlap,
          contained: labels.every((o: any) => { const b = o.getBounds(); return b.left >= panel.left && b.right <= panel.right && b.top >= panel.top && b.bottom <= panel.bottom; }),
          targets: targets.every((o: any) => o.width * scale >= 44 && o.height * scale >= 44),
          zones: labels.filter((o: any) => /combat-pile-zone-.*-label/.test(o.name)).map((o: any) => ({ text: o.text, size: o.style.fontSize, resolution: o.style.resolution })),
          rows: labels.filter((o: any) => o.name === 'combat-pile-row-title').map((o: any) => ({ lines: o.getWrappedText().length, full: o.getData('fullText'), text: o.text, truncated: o.getData('truncated') })),
          art: s.root.getByName('combat-pile-card-art')?.texture.key,
          ornaments: list.filter((o: any) => ['combat-pile-review-frame', 'deck-review-title-plaque', 'deck-review-flourish', 'combat-pile-scroll-button-frame'].includes(o.name)).length,
        };
      });
      expect(geometry.mode).toBe(mode); expect(geometry.overlap).toEqual([]);
      expect(geometry.contained && geometry.targets).toBe(true); expect(geometry.ornaments).toBe(0);
      expect(geometry.zones).toHaveLength(4); expect(geometry.zones.every(z => z.size === '20px' && z.resolution === 2)).toBe(true);
      expect(geometry.rows.every(row => row.lines <= 2 && !!row.full && (!row.truncated || row.text.endsWith('…')))).toBe(true);
      if (mode !== 'cleared') expect(geometry.art).toBeTruthy();
      else expect(geometry.rows).toEqual([]);
      expect(await stable()).toBe(before);
      if (!remapped) await page.screenshot({ path: info.outputPath(`${mode}-${size.width}.png`) });
    }
  }
  await page.keyboard.press(remapped ? 'j' : 'ArrowLeft'); await settleCanvas(page);
  const hint = () => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('combat-pile-input-hint').text);
  expect(await hint()).toContain(remapped ? 'J / L: pile' : 'Left / Right: pile');
  expect(await hint()).toContain(remapped ? 'G: full rules' : 'H: full rules');
  await page.keyboard.press(remapped ? 'g' : 'h'); await settleCanvas(page);
  expect(await page.evaluate(() => !!(window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active)).toBe(true);
  await page.keyboard.press(remapped ? 'b' : 'Escape'); await settleCanvas(page);
  expect(await stable()).toBe(before);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 14 }));
  await settleCanvas(page); expect(await hint()).toContain('D-pad: card / pile');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 5 }));
  await settleCanvas(page);
  const pos = await point(page, 'combat-pile-read-hit'); await page.touchscreen.tap(pos.x, pos.y); await settleCanvas(page);
  expect(await page.evaluate(() => !!(window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active)).toBe(true);
  await page.keyboard.press(remapped ? 'b' : 'Escape'); await settleCanvas(page);
  const close = await point(page, 'combat-pile-close-hit'); await page.touchscreen.tap(close.x, close.y); await settleCanvas(page);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').inspectOverlay)).toBeUndefined();
  expect(await stable()).toBe(before); expect(errors).toEqual([]);
});
