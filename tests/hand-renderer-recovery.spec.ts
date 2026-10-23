import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('Rooftop fallback preserves card art, readable rules and isolated inspection', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  // Fault injection is deliberate: one JS chunk and one illustration, not the
  // entire asset system. Other uncaught errors still fail the test.
  await page.route('**/render-hand-*.js', route => route.abort());
  const missingArt = /\/wands_ace-[^/]+\.webp$/;
  await page.route(missingArt, route => route.abort());
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererReady && !b.battleHandRendererModule && b.hand.length
      && !b.combatIntroActive && !b.combatAnimationPending;
  }, undefined, { timeout: 20000 });
  await expect.poll(() => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return [...b.handCardArtLayers.values()].map((a: any) => a.getData('artState')).sort();
  }), { timeout: 15000 }).toEqual(['ready', 'ready', 'ready', 'ready', 'unavailable']);
  // The download-recovery notice intentionally owns these clicks until the
  // player explicitly chooses to continue the unsaved battle.
  await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
  const measure = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const scale = b.game.canvas.getBoundingClientRect().width / 1280;
    const texts = b.handLayer.list.filter((o: any) => o.type === 'Text');
    const rects = [...b.handCardRects.values()].map((r: any) => r.getBounds());
    return { readable: texts.every((o: any) => parseFloat(o.style.fontSize) * scale >= 14),
      primary: texts.filter((o: any) => ['combat-card-title', 'combat-card-readable-summary'].includes(o.name))
        .every((o: any) => parseFloat(o.style.fontSize) * scale >= 16),
      contained: texts.every((o: any) => { const r = o.getBounds(); return rects.some(a =>
        r.left >= a.left && r.right <= a.right && r.top >= a.top && r.bottom <= a.bottom); }),
      rects: rects.map(r => [r.x, r.y, r.width, r.height]),
      images: [...b.handCardArtLayers.values()].flatMap((a: any) => a.list.filter((o: any) => o.texture))
        .map((o: any) => ({ key: o.texture.key, uniform: Math.abs(o.scaleX - o.scaleY) < .00001,
          visible: o.displayHeight === 90 && !o.isCropped && !o.mask && texts.every((t:any)=>{
            const a=o.getBounds(), z=t.getBounds(); return a.right<=z.left||a.left>=z.right||a.bottom<=z.top||a.top>=z.bottom;
          }) })),
      hand: b.hand.map((c: any) => c.instanceId), energy: b.energy, turn: b.turn, selected: b.selectedInstanceId ?? null };
  });
  for (const [width, height] of [[2560,1600], [1440,900], [1000,560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    expect(await measure()).toMatchObject({ readable: true, primary: true, contained: true });
    await page.screenshot({ path: info.outputPath(`fallback-${width}.png`) });
  }
  const before = await measure();
  await page.unroute(missingArt);
  await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.queueCardArtLoad(b.hand); });
  await page.waitForFunction(() => [...(window as any).__birdSquadGame.scene.getScene('BattleScene').handCardArtLayers.values()]
    .every((a: any) => a.getData('artState') === 'ready'));
  const after = await measure();
  expect(after).toMatchObject({ rects: before.rects, hand: before.hand, energy: before.energy, turn: before.turn, selected: before.selected });
  expect(after.images).toHaveLength(5); expect(after.images.every(i => i.uniform && i.visible)).toBe(true);
  await page.screenshot({ path: info.outputPath('recovered-art-1000.png') });
  const point = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const r = b.handCardRects.get(b.hand[0].instanceId).getBounds(), c = b.game.canvas.getBoundingClientRect();
    return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
  });
  await page.mouse.click(point.x, point.y); await settleCanvas(page);
  const selected = await measure();
  const inspect = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const r = b.cardPreview.getByName('combat-card-inspect-hit').getBounds(), c = b.game.canvas.getBoundingClientRect();
    return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720,
      width: r.width * c.width / 1280, height: r.height * c.height / 720 };
  });
  expect(inspect.width).toBeGreaterThanOrEqual(44); expect(inspect.height).toBeGreaterThanOrEqual(44);
  await page.mouse.click(inspect.x, inspect.y);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active);
  for (const [width, height] of [[2560,1600], [1440,900], [1000,560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    const reader = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), layer = b.combatCardDetail;
      const scale = b.game.canvas.getBoundingClientRect().width / 1280, panel = layer.getByName('combat-card-detail-panel').getBounds();
      return { readable: layer.list.filter((o: any) => o.type === 'Text').every((o: any) => parseFloat(o.style.fontSize) * scale >= 14),
        contained: layer.list.filter((o: any) => o.type === 'Text').every((o: any) => { const r = o.getBounds();
          return r.left >= panel.left && r.right <= panel.right && r.top >= panel.top && r.bottom <= panel.bottom; }),
        exact: layer.getData('pages').some((p: any) => p.body.replace(/\s+/g, ' ') === b.activeCardContract(b.hand[0]).text.replace(/\s+/g, ' ')) };
    });
    expect(reader).toEqual({ readable: true, contained: true, exact: true });
    await page.screenshot({ path: info.outputPath(`reader-${width}.png`) });
  }
  await page.keyboard.press('r'); // The reader owns input; this must not end a turn.
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Escape');
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active);
  expect(await measure()).toMatchObject({ energy: selected.energy, hand: selected.hand, turn: selected.turn, selected: selected.selected });
  expect(errors).toEqual([]);
});
