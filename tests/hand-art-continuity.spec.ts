import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('late hand artwork paints in place without moving or playing the selected card', async ({ page }, info) => {
  test.setTimeout(60000);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  let requests = 0;
  await page.route(/\/wands_ace-[^/]+\.webp$/, async route => {
    // Fail preload promptly, then hold its real runtime recovery while the hand
    // is interactive. This avoids spending 45 seconds on transport deadlines.
    if (++requests <= 3) { await route.abort(); return; }
    await gate; await route.continue();
  });
  try {
    await page.setViewportSize({ width: 1000, height: 560 });
    await page.goto('./');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    await page.evaluate(async () => {
      const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
      w.__birdSquadGame.scene.stop('MenuScene');
      w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    });
    await page.waitForFunction(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return b.battleHandRendererModule && b.handCardRects.size && !b.combatIntroActive && !b.combatAnimationPending;
    });
    const continueButton = page.getByRole('button', { name: 'Keep playing', exact: true });
    if (await continueButton.isVisible()) await continueButton.click();
    const point = await page.evaluate(() => {
      const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
      const card = b.hand.find((c: any) => c.id === 'wands_ace');
      w.__lateHandCard = card.instanceId;
      const hit = b.handCardRects.get(card.instanceId);
      const r = hit.getBounds(), c = b.game.canvas.getBoundingClientRect();
      return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
    });
    await page.mouse.click(point.x, point.y); await settleCanvas(page);
    await page.evaluate(() => {
      const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
      w.__lateHandHit = b.handCardRects.get(w.__lateHandCard);
    });
    const snapshot = () => page.evaluate(() => {
      const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
      const hit = b.handCardRects.get(w.__lateHandCard), r = hit.getBounds();
      return { selected: b.selectedInstanceId, expected: w.__lateHandCard,
        sameHit: hit === w.__lateHandHit, bounds: [r.x, r.y, r.width, r.height],
        hand: b.hand.map((c: any) => c.instanceId), energy: b.energy, turn: b.turn,
        enemy: b.enemies.map((e: any) => [e.id, e.hp]) };
    });
    const before = await snapshot(); expect(before.selected).toBe(before.expected);
    expect(requests).toBeGreaterThanOrEqual(4);
    await page.screenshot({ path: info.outputPath('loading-selected-1000.png') });
    release();
    await page.waitForFunction(() => {
      const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
      return b.handCardArtLayers.get(w.__lateHandCard).list.some((o: any) => o.texture?.key === 'card-thumb-wands_ace');
    });
    await settleCanvas(page);
    expect(await snapshot()).toEqual(before);
    await page.screenshot({ path: info.outputPath('loaded-selected-1000.png') });
    expect(errors).toEqual([]);
  } finally { release(); }
});
