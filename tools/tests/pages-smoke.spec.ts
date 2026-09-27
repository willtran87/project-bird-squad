import { test, expect } from '@playwright/test';

test('Pages subdirectory serves title, lazy scenes, full-art combat and checkpoint reload', async ({ page }, info) => {
  const failures: string[] = [], assetPaths: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('requestfailed', request => failures.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin !== new URL(page.url()).origin) return;
    if (response.status() >= 400) failures.push(`${response.status()} ${url.pathname}`);
    if (url.pathname.includes('/assets/')) assetPaths.push(url.pathname);
  });
  await page.goto('./?flight=pages-release&length=quick');
  const ready = () => page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await ready();
  expect(new URL(page.url()).pathname).toBe('/project-bird-squad/');
  expect(await page.evaluate(() => new URL(document.baseURI).pathname)).toBe('/project-bird-squad/');
  await expect(page.locator('base')).toHaveCount(0); // Keep base-uri 'none' compatible.
  await page.evaluate(() => (window as any).__birdSquadEnsureScene('CodexScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const game = (window as any).__birdSquadGame;
    return game.scene.isActive('RouteScene') && game.scene.getScene('RouteScene').routeEssentialAssetsReady;
  });
  const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.run.active')!));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const state = JSON.parse((window as any).render_game_to_text?.() ?? '{}');
    return state.mode === 'battle' && state.assetReadiness?.fullArt && !state.combatIntro?.active;
  });
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.screenshot({ path: info.outputPath(`pages-combat-${width}.png`) });
  }
  await page.reload(); await ready();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.run.active')!).seed)).toBe(checkpoint.seed);
  expect(assetPaths.length).toBeGreaterThan(20);
  expect(assetPaths.every(path => path.startsWith('/project-bird-squad/assets/'))).toBe(true);
  expect(assetPaths.some(path => /codex-scene-.*\.js$/.test(path))).toBe(true);
  expect(assetPaths.some(path => /encounter-intro-.*\.js$/.test(path))).toBe(true);
  expect(failures).toEqual([]);
});
