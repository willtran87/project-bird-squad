import { test, expect } from '@playwright/test';
import { KEYWORDS } from '../src/game/keyword-definitions';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });

test('Waymark comparison aligns contextual definitions without changing the run', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('RouteScene', {});
  });
  await page.waitForFunction(() => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return route.routeEssentialAssetsReady && !route.cameras.main.fadeEffect.isRunning;
  });
  const before = await page.evaluate(() => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    route.runState.routeMarks = ['chalk_wingmark', 'patched_shoulder_wrap'];
    route.openWaymarkDrawer();
    route.routeWaymarkPinnedId = 'chalk_wingmark';
    route.selectRouteWaymark('patched_shoulder_wrap', false);
    route.renderAll();
    return JSON.stringify(route.runState);
  });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-waymark-review-panel')));
  const reading = await page.evaluate(() => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const panel = route.children.getByName('route-waymark-review-panel');
    for (let i = 0; i < panel.getData('reading').total; i++) {
      if (panel.getData('reading').headings.every((heading: string) => heading.endsWith('TERM · COVER'))) break;
      panel.getData('turnRulesPage')(1);
    }
    return panel.getData('reading');
  });
  expect(reading.headings).toEqual([
    'Chalk Wingmark · TERM · COVER',
    'Patched Shoulder Wrap · TERM · COVER',
  ]);
  expect(reading.bodies.map((body: string) => body.replace(/\s+/g, ' '))).toEqual([KEYWORDS.Cover.def, KEYWORDS.Cover.def]);
  await expect(page.locator('#game-status')).toContainText('TERM · COVER');
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport); await settleCanvas(page);
    const geometry = await page.evaluate(() => {
      const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      const bodies = route.children.list.filter((object: any) => object.name === 'route-waymark-reader-body');
      return bodies.map((body: any) => ({ size: body.style.fontSize, bottom: body.getBounds().bottom, width: body.width }));
    });
    expect(geometry).toHaveLength(2);
    geometry.forEach((body: any) => {
      expect(body.size).toBe('18px'); expect(body.bottom).toBeLessThanOrEqual(568); expect(body.width).toBeLessThanOrEqual(444);
    });
    await page.screenshot({ path: info.outputPath(`cover-definition-${viewport.width}.png`) });
  }
  expect(await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState))).toBe(before);
  expect(errors).toEqual([]);
});
