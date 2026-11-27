import { test, expect, type Page } from '@playwright/test';

// Decorative weather and life layers stop drawing (and their particles pause)
// while a near-opaque full-screen overlay hides them, and come back the frame
// it goes. Only the main camera's draw is skipped: the layers, their
// visibility and everything tests read about them are unchanged.

async function openRoute(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./?flight=spectacle-occlusion');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  await page.evaluate(() => {
    const w = window as any;
    w.__birdSquadGame.scene.getScene('RouteScene').events.emit('spectacle-skip-arrival');
    w.advanceTime(1200);
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('spectacle-weather'));
  return errors;
}

const decor = (page: Page) => page.evaluate(() => {
  const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
  const camera = route.cameras.main.id;
  const weather = route.children.getByName('spectacle-weather');
  const emitters = weather.list.filter((child: any) => child.type === 'ParticleEmitter');
  return {
    skipped: (weather.cameraFilter & camera) !== 0,
    visible: weather.visible,
    paused: emitters.length > 0 && emitters.every((emitter: any) => !emitter.active),
  };
});

async function settle(page: Page, ms: number) {
  await page.evaluate(ms => new Promise(resolve => setTimeout(resolve, ms)), ms);
  const frame = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame);
  await page.waitForFunction(start => (window as any).__birdSquadGame.loop.frame >= start + 3, frame);
}

/** Hold a full-screen scrim over the route, re-adding it if the route's
 * destroy-and-redraw rendering retires it; `alpha` 0 removes it. */
const scrim = (page: Page, alpha: number) => page.evaluate(alpha => {
  const w = window as any, route = w.__birdSquadGame.scene.getScene('RouteScene');
  if (w.__testScrim) route.events.off('preupdate', w.__testScrim);
  route.children.getByName('test-scrim')?.destroy();
  w.__testScrim = undefined;
  if (!alpha) return;
  w.__testScrim = () => {
    if (!route.children.getByName('test-scrim')) route.add.rectangle(640, 360, 1280, 720, 0x020409, alpha).setDepth(5000).setName('test-scrim');
  };
  w.__testScrim();
  route.events.on('preupdate', w.__testScrim);
}, alpha);

test('weather stops drawing under a near-opaque overlay and resumes when it closes', async ({ page }) => {
  const errors = await openRoute(page);
  expect(await decor(page)).toEqual({ skipped: false, visible: true, paused: false });

  // A translucent scrim (the pause menu uses 0.84) leaves the weather drawn.
  await scrim(page, 0.84);
  await settle(page, 700);
  expect((await decor(page)).skipped).toBe(false);

  // Skipped once the scrim has held for its fade-in window (wall time, so not
  // asserted frame by frame: software-GL frames here can exceed that window).
  await scrim(page, 0.94);
  await expect.poll(() => decor(page), { timeout: 5000 }).toEqual({ skipped: true, visible: true, paused: true });

  await scrim(page, 0);
  await settle(page, 0);
  expect(await decor(page)).toEqual({ skipped: false, visible: true, paused: false });
  expect(errors).toEqual([]);
});
