import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('opening the combat Deck retries failed hand art without spending or clearing selection', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  let requests = 0;
  const missing = /\/wands_ace-[^/]+\.webp$/;
  await page.route(missing, route => { requests++; return route.abort(); });
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererModule && b.handCardRects.size && !b.combatIntroActive && !b.combatAnimationPending && !b.load.isLoading();
  });
  const click = async (name: string) => {
    const p = await page.evaluate(name => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const o = name === 'card' ? b.handCardRects.get(b.hand.find((c: any) => c.id === 'wands_ace').instanceId) : b.root.getByName(name);
      const r = o.getBounds(), c = b.game.canvas.getBoundingClientRect();
      return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
    }, name);
    await page.mouse.click(p.x, p.y); await settleCanvas(page);
  };
  await click('card');
  const state = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { hand: b.hand.map((c: any) => c.instanceId), selected: b.selectedInstanceId, energy: b.energy, turn: b.turn,
      bounds: [...b.handCardRects.values()].map((o: any) => { const r = o.getBounds(); return [r.x, r.y, r.width, r.height]; }) };
  });
  const before = await state(); expect(before.selected).toBeTruthy();
  const count = requests;
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').renderAll());
    await settleCanvas(page);
  }
  expect(requests).toBe(count); expect(count).toBeLessThanOrEqual(6);
  await page.screenshot({ path: info.outputPath('failed-hand-1000.png') });
  await page.unroute(missing);
  await click('hud-deck-chip');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').textures.exists('card-thumb-wands_ace'));
  await page.keyboard.press('Escape'); await settleCanvas(page);
  expect(await state()).toEqual(before);
  expect(await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.inspectOverlay === undefined && [...b.handCardArtLayers.values()].some((layer: any) =>
      layer.list.some((o: any) => o.texture?.key === 'card-thumb-wands_ace'));
  })).toBe(true);
  await page.screenshot({ path: info.outputPath('deck-recovered-hand-1000.png') });
  expect(errors).toEqual([]);
});
