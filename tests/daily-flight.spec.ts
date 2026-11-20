import { test, expect, type Page } from '@playwright/test';
import { installVirtualController, pressController } from './helpers/virtual-controller';
import { flightSummary, frames, openTitle, overlapping, pageDate, sceneTexts, tabTo, textState } from './helpers/engagement';

// Daily Flight: a title entry that flies a route seeded from the local date,
// with the day's Leader, and keeps personal bests on this device only.

const engagement = (page: Page) => page.evaluate(() => (window as any).__birdSquadEngagement());

async function openDaily(page: Page) {
  await tabTo(page, 'daily');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).mode === 'dailyFlight');
  await frames(page);
  return textState(page);
}

const route = (page: Page) => page.evaluate(() => {
  const w = window as any, scene = w.__birdSquadGame.scene.getScene('RouteScene');
  const map = w.__birdSquadCurrentMap();
  return {
    seed: scene.runState.seed, leaderId: scene.runState.leaderId, difficulty: scene.runState.difficulty, runMode: scene.runState.runMode,
    deck: scene.runState.deck.map((card: any) => card.id),
    map: JSON.stringify({ nodes: map.nodes.map((node: any) => [node.id, node.type, node.payloadId]), edges: map.edges }),
  };
});

test('the title offers Daily Flight by keyboard and the route follows the date seed', async ({ page }, info) => {
  const errors = await openTitle(page);
  const today = await pageDate(page);
  const title = await engagement(page);
  expect(title).toMatchObject({ seed: `daily-${today}`, dailyBest: null, recapAvailable: false, focusOrder: ['daily'] });
  expect(title.caption).toContain('Today: ');

  // Existing focus stops keep their order; Daily Flight is appended after them.
  expect(await tabTo(page, 'daily')).toBe(6);
  await page.screenshot({ path: info.outputPath('title-daily-focus.png') });
  const daily = await openDaily(page);
  expect(daily).toMatchObject({ seed: `daily-${today}`, leaderId: title.dailyLeader, best: null, history: [], resumes: false, replaces: false, flyLabel: "Fly today's route" });
  expect(daily.focus).toMatchObject({ index: 0, label: "Fly today's route", count: 2 });
  const texts = await sceneTexts(page, 'DailyFlightScene');
  expect(overlapping(texts)).toEqual([]);
  for (const text of texts) {
    expect(text.size, text.text).toBeGreaterThanOrEqual(19);
    expect(text.x, text.text).toBeGreaterThanOrEqual(16);
    expect(text.right, text.text).toBeLessThanOrEqual(1264);
    expect(text.bottom, text.text).toBeLessThanOrEqual(712);
  }
  await page.screenshot({ path: info.outputPath('daily-flight.png') });

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  const first = await route(page);
  expect(first).toMatchObject({ seed: `daily-${today}`, leaderId: title.dailyLeader, difficulty: 0, runMode: 'full' });

  // The same date gives the same Leader, starting deck and district map again.
  await page.reload();
  await page.waitForFunction(() => typeof (window as any).__birdSquadEngagement === 'function');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleFocus);
  const resumed = await openDaily(page);
  // The checkpoint written on the route is today's flight: continue it, do not replace it.
  expect(resumed).toMatchObject({ resumes: true, replaces: false, flyLabel: "Continue today's flight" });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  expect(await route(page)).toEqual(first);
  await page.evaluate(() => {
    const w = window as any;
    w.localStorage.removeItem('birdsquad.run.active'); w.localStorage.removeItem('birdsquad.run.active.backup');
    w.__birdSquadGame.scene.getScene('RouteScene').scene.start('DailyFlightScene');
  });
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).mode === 'dailyFlight');
  expect(await textState(page)).toMatchObject({ resumes: false });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  expect(await route(page)).toEqual(first);
  expect(errors).toEqual([]);
});

test('personal bests are kept per date from the flight log, with a short history', async ({ page }, info) => {
  await openTitle(page);
  const [today, yesterday, earlier] = [await pageDate(page), await pageDate(page, -1), await pageDate(page, -2)];
  const log = [
    flightSummary(1, { seed: `daily-${earlier}`, leaderId: 'roostkeeper' }),
    flightSummary(2, { seed: `daily-${yesterday}`, result: 'loss', leaderId: 'spark_caller', mapId: 'map_03_signal_spires', currentCohesion: 0 }),
    flightSummary(3, { seed: `daily-${today}`, result: 'loss', leaderId: 'fledgling', mapId: 'map_02_canal_markets', currentCohesion: 0 }),
    flightSummary(4, { seed: `daily-${today}`, result: 'loss', leaderId: 'fledgling', mapId: 'map_03_signal_spires', currentCohesion: 0 }),
    flightSummary(5, { seed: 'not-daily' }),
    // An unrelated flight in progress: starting today's route would replace it.
  ];
  await page.evaluate(({ log }) => {
    localStorage.setItem('birdsquad.runs', JSON.stringify(log));
    localStorage.setItem('birdsquad.recapSeen', log[log.length - 1].id);
  }, { log });
  await page.reload();
  await page.waitForFunction(() => typeof (window as any).__birdSquadEngagement === 'function');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleFocus);

  // Lost in district 3 of 4 after 10 won fights: 2 x 1000 + 10 x 150.
  const best = { score: 3500, districts: 2, districtTotal: 4, result: 'loss', leaderId: 'fledgling', attempts: 2 };
  const title = await engagement(page);
  expect(title.dailyBest).toMatchObject(best);
  expect(title.caption).toContain('Best 3,500');
  expect(title.focusOrder).toEqual(['daily', 'recap']);
  await page.screenshot({ path: info.outputPath('title-with-best.png') });

  const daily = await openDaily(page);
  expect(daily.best).toMatchObject(best);
  expect(daily.flyLabel).toBe('Fly it again');
  expect(daily.history.map((entry: any) => [entry.result, entry.score, entry.leaderId])).toEqual([
    ['loss', 3500, 'spark_caller'],
    // A completed flight: 4000 + 1650 + 2000 + 31 x 20 + (900 - 62 x 6).
    ['win', 8798, 'roostkeeper'],
  ]);
  expect(overlapping(await sceneTexts(page, 'DailyFlightScene'))).toEqual([]);
  await page.screenshot({ path: info.outputPath('daily-flight-bests.png') });

  // Stored through the journaled safe-storage helper, and never counted twice.
  const stored = await page.evaluate(() => [localStorage.getItem('birdsquad.daily'), localStorage.getItem('birdsquad.daily.backup')]);
  expect(stored[0]).toBe(stored[1]);
  expect(JSON.parse(stored[0]!).bests).toHaveLength(3);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleFocus);
  await page.waitForFunction(() => typeof (window as any).__birdSquadEngagement === 'function');
  expect((await engagement(page)).dailyBest).toMatchObject(best);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.daily'))).toBe(stored[0]);
});

test('Daily Flight is reachable and usable with a controller, and warns before replacing a saved flight', async ({ page }) => {
  await installVirtualController(page);
  await openTitle(page, {}, './?flight=saved-elsewhere');
  // A shared-route start writes an unrelated checkpoint.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  await page.goto('./');
  await page.waitForFunction(() => typeof (window as any).__birdSquadEngagement === 'function');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleFocus);
  await frames(page, 6);
  for (let presses = 0; presses < 12 && (await textState(page)).titleFocus?.current !== 'daily'; presses += 1) await pressController(page, 13);
  expect((await textState(page)).titleFocus?.current).toBe('daily');
  await pressController(page, 0);
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).mode === 'dailyFlight');
  const daily = await textState(page);
  expect(daily).toMatchObject({ resumes: false, replaces: true });
  expect((await sceneTexts(page, 'DailyFlightScene')).some((text) => text.name === 'daily-replace-warning')).toBe(true);
  await pressController(page, 15);
  expect((await textState(page)).focus).toMatchObject({ label: 'Back' });
  await pressController(page, 1);
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').mode === 'menu');
  // Backing out left the saved flight alone.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.run.active')!).seed)).toBe('saved-elsewhere');
});
