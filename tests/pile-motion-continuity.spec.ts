import { test, expect } from '@playwright/test';

for (const reduced of [false, true]) test(`pile motion is bounded, anchored and non-blocking, reduced=${reduced}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
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
    return b.fxLayer?.active && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  const state = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    b.fxLayer.removeAll(true);
    const stable = () => JSON.stringify({ hand: b.hand, draw: b.drawPile, discard: b.discardPile, flock: b.flock, energy: b.energy, pending: b.combatAnimationPending });
    const before = stable();
    b.animateDraw(50, true); b.animateDiscard(50); b.animateShuffle(); b.animateReturnCard(b.hand[0].instanceId);
    const objects = b.fxLayer.list.filter((o: any) => o.name === 'combat-pile-transfer');
    const transfers = objects.map((o: any) => ({ kind: o.getData('kind'), from: o.getData('from'), to: o.getData('to'), width: o.displayWidth }));
    const unchanged = before === stable();
    w.advanceTime(60); b.time.paused = true; b.tweens.pauseAll();
    w.pileMotionObjects = objects;
    return { transfers, draw: b.drawPilePos(), discard: b.discardPilePos(), unchanged, before };
  });
  expect(state.unchanged).toBe(true);
  expect(state.transfers).toHaveLength(reduced ? 0 : 8);
  for (const transfer of state.transfers) {
    expect(transfer.width).toBeLessThanOrEqual(32);
    if (transfer.kind === 'draw') expect(transfer.from).toEqual(state.draw);
    if (transfer.kind === 'shuffle') { expect(transfer.from).toEqual(state.discard); expect(transfer.to).toEqual(state.draw); }
    if (transfer.kind === 'discard') expect(transfer.to).toEqual(state.discard);
    if (transfer.kind === 'return') expect(transfer.from).toEqual(state.discard);
  }
  await page.screenshot({ path: info.outputPath('pile-motion-2560.png') });
  const retired = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    b.time.paused = false; b.tweens.resumeAll();
    w.advanceTime(500);
    const complete = w.pileMotionObjects.every((o: any) => !o.active && b.tweens.getTweensOf(o).length === 0);
    const lifetime = w.pileMotionObjects.map((o: any) => ({ active: o.active, alpha: o.alpha,
      tweens: b.tweens.getTweensOf(o).map((t: any) => ({ progress: t.progress, elapsed: t.elapsed, duration: t.duration, paused: t.paused })) }));
    b.animateDraw(3); const pending = [...b.fxLayer.list]; b.fxLayer.removeAll(true); w.advanceTime(500);
    return { complete, cleanup: pending.every((o: any) => b.tweens.getTweensOf(o).length === 0), pending: b.combatAnimationPending, lifetime };
  });
  await info.attach('transfer-lifetimes', { body: JSON.stringify(retired), contentType: 'application/json' });
  expect(retired, JSON.stringify(retired.lifetime)).toMatchObject({ complete: true, cleanup: true, pending: false });
  expect(errors).toEqual([]);
});
