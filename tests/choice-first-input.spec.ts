import { test, expect } from '@playwright/test';

for (const mode of ['keyboard', 'controller'] as const) test(`first picker remembers the ${mode} that opened it`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('RouteScene');
  });
  await page.waitForFunction(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.routeEssentialAssetsReady && r.cardHoverDetailModule;
  });
  const before = await page.evaluate(mode => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    r.runState.scrap = 999;
    r.openMarketNode({ ...w.__birdSquadCurrentMap().nodes.find((n: any) => n.type !== 'boss'), type: 'market' });
    const open = () => r.openMarketCardPicker(r.marketUtilityShelf.findIndex((o: any) => o.id === 'preen'), 'preen');
    // Open on the very first event, before any picker labels have been bound.
    if (mode === 'keyboard') r.input.keyboard.once('keydown-F9', open);
    else r.input.gamepad.once('down', open);
    return JSON.stringify(r.runState);
  }, mode);
  if (mode === 'keyboard') await page.keyboard.press('F9');
  else await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').input.gamepad.emit('down', {}, { index: 10 }));
  await expect.poll(() => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('card-picker-input-hint')?.getData('inputMode'))).toBe(mode);
  expect(await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState))).toBe(before);
  expect(errors).toEqual([]);
});
