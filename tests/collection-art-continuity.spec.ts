import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('late Collection artwork preserves the registered card hit target and hovered tile', async ({ page }, info) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/assets\/wands_03[^/]*\.webp/, async route => {
    await gate;
    await route.continue();
  });
  try {
    await page.setViewportSize({ width: 1000, height: 560 });
    await page.goto('./');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    await page.evaluate(async () => {
      const w = window as any;
      await w.__birdSquadEnsureScene('CodexScene');
      w.__birdSquadGame.scene.stop('MenuScene');
      w.__birdSquadGame.scene.start('CodexScene');
    });
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').codexData);
    await page.evaluate(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      c.activeTab = 2; c.discovered.add('wands_03'); c.renderAll();
    });
    await settleCanvas(page);
    const before = await page.evaluate(() => {
      const w = window as any, c = w.__birdSquadGame.scene.getScene('CodexScene');
      const tile = c.gridLayer.list.find((o: any) => o.getData('cardId') === 'wands_03');
      w.artContinuityTile = tile; w.artContinuityHit = tile.getByName('codex-card-entry-hit');
      w.artContinuityRedraws = [];
      const render = c.renderAll.bind(c);
      c.renderAll = (...args: any[]) => { w.artContinuityRedraws.push(new Error().stack); render(...args); };
      const b = tile.getByName('codex-card-title').getBounds(), canvas = c.game.canvas.getBoundingClientRect();
      return { x: canvas.left + b.centerX * canvas.width / 1280,
        y: canvas.top + b.centerY * canvas.height / 720, scroll: c.gridScroll,
        saved: JSON.stringify(localStorage), placeholder: !!tile.getByName('codex-card-art-placeholder') };
    });
    expect(before.placeholder).toBe(true);
    await page.mouse.move(before.x, before.y); await settleCanvas(page);
    release();
    await page.waitForFunction(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      return !!c.gridLayer.list.find((o: any) => o.getData('cardId') === 'wands_03')?.getByName('codex-card-art');
    });
    const after = await page.evaluate(() => {
      const w = window as any, c = w.__birdSquadGame.scene.getScene('CodexScene');
      const tile = c.gridLayer.list.find((o: any) => o.getData('cardId') === 'wands_03');
      const hit = tile.getByName('codex-card-entry-hit');
      return { sameTile: tile === w.artContinuityTile, sameHit: hit === w.artContinuityHit,
        active: hit.active, hovered: hit.fillColor === 0x142334,
        registered: c.input.hitTestPointer(c.input.activePointer).includes(hit),
        scroll: c.gridScroll, saved: JSON.stringify(localStorage) };
    });
    await info.attach('art-refresh-redraws', { body: JSON.stringify(await page.evaluate(() => (window as any).artContinuityRedraws)), contentType: 'application/json' });
    expect(after).toEqual({ sameTile: true, sameHit: true, active: true, hovered: true,
      registered: true, scroll: before.scroll, saved: before.saved });
    // Retaining the grid must still replace decorative fallback circles when
    // the real undiscovered-card medallion arrives with the UI asset batch.
    await page.waitForFunction(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      const locked = c.gridLayer.list.filter((o: any) => o.name === 'codex-card-tile' && !c.discovered.has(o.getData('cardId')));
      return locked.length > 0 && locked.every((tile: any) => tile.getByName('codex-undiscovered-medallion')?.type === 'Image');
    });
    await page.mouse.click(before.x, before.y);
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).detailOpen === 'wands_03');
    await settleCanvas(page);
    await page.screenshot({ path: info.outputPath('late-art-opened-1000.png') });
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});
