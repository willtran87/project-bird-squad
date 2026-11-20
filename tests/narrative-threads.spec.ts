import { test, expect, type Page } from '@playwright/test';
import { narrativeThreads } from '../src/game/narrative-content';
import { flightSummary, frames, openTitle, tabTo, textState } from './helpers/engagement';

// Narrative threads: a Leader-specific line on entering each district, shown
// on the district arrival card (never blocking), and a closing line on the
// run recap that reflects the Leader, the result and the last district.

const life = (page: Page) => page.evaluate(() => (window as any).__birdSquadLife('RouteScene'));

async function startRoute(page: Page, seed: string, storage: Record<string, string> = {}) {
  const errors = await openTitle(page, storage, `./?flight=${seed}`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  await page.waitForFunction(() => (window as any).__birdSquadLife?.('RouteScene').arrivalCard);
  return errors;
}

async function enterDistrict(page: Page, mapIndex: number, leaderId: string, startedAtMs: number) {
  await page.evaluate(({ mapIndex, leaderId, startedAtMs }) => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    route.scene.restart({ runState: { ...route.runState, mapIndex, leaderId, startedAtMs, completedRouteNodeIds: [], currentRouteNodeId: undefined } });
  }, { mapIndex, leaderId, startedAtMs });
  await frames(page, 4);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  await page.waitForFunction(() => (window as any).__birdSquadLife('RouteScene').arrivalCard);
  await frames(page);
}

test('each district opens with a Leader line picked by the seed, and never takes input', async ({ page }, info) => {
  const errors = await startRoute(page, 'thread-a');
  const first = await page.evaluate(() => {
    const w = window as any, route = w.__birdSquadGame.scene.getScene('RouteScene');
    const card = route.children.getByName('district-arrival-card');
    const bounds = (name: string) => { const b = card.getByName(name).getBounds(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom }; };
    return { state: w.__birdSquadLife('RouteScene').arrivalCard, mode: JSON.parse(w.render_game_to_text()).mode,
      leaderId: route.runState.leaderId, cardInput: card.list.filter((child: any) => child.input).length,
      interactive: route.children.list.filter((child: any) => child.name === 'route-node-hit' && child.input?.enabled).length,
      thread: bounds('district-arrival-card-thread'), premise: bounds('district-arrival-card-premise'), hint: bounds('district-arrival-card-hint'),
      size: parseFloat(card.getByName('district-arrival-card-thread').style.fontSize) };
  });
  expect(first.leaderId).toBe('fledgling');
  expect(narrativeThreads.fledgling.arrivals[0]).toContain(first.state.thread);
  // The line sits under the premise, on screen, clear of the dismiss hint.
  expect(first.size).toBeGreaterThanOrEqual(20);
  expect(first.thread.y).toBeGreaterThanOrEqual(first.premise.bottom);
  expect(first.thread.bottom).toBeLessThan(first.hint.y);
  expect(first.thread.x).toBeGreaterThanOrEqual(16);
  expect(first.thread.right).toBeLessThanOrEqual(1264);
  // The route beneath stays live: the card is a picture, not a modal.
  expect(first).toMatchObject({ mode: 'routeSelection', cardInput: 0 });
  expect(first.interactive).toBeGreaterThan(0);
  await page.waitForTimeout(900);
  await page.screenshot({ path: info.outputPath('arrival-thread.png') });

  // It holds a little longer for the extra line, then leaves on its own.
  expect(first.state.holdMs).toBe(3400);
  await page.evaluate(() => (window as any).advanceTime(3700));
  await frames(page);
  expect((await life(page)).arrivalCard).toBeUndefined();
  expect((await textState(page)).mode).toBe('routeSelection');

  // Every Leader has their own line in every district.
  const seen = new Map<string, string>();
  let run = 10;
  for (const leaderId of Object.keys(narrativeThreads)) for (let district = 0; district < 4; district += 1) {
    await enterDistrict(page, district, leaderId, run += 1);
    const thread = (await life(page)).arrivalCard.thread as string;
    expect(narrativeThreads[leaderId].arrivals[district], `${leaderId} district ${district}`).toContain(thread);
    seen.set(`${leaderId}:${district}`, thread);
  }
  expect(new Set(seen.values()).size).toBe(20);
  // Same seed, Leader and district: the same line again.
  await enterDistrict(page, 2, 'talon', run += 1);
  expect((await life(page)).arrivalCard.thread).toBe(seen.get('talon:2'));
  // Any key dismisses it and still reaches the route.
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').events.emit('spectacle-skip-arrival'));
  await page.evaluate(() => (window as any).advanceTime(400));
  await frames(page);
  expect((await life(page)).arrivalCard).toBeUndefined();
  expect(errors).toEqual([]);
});

test('the picked line follows the seed, not the visit', async ({ browser }) => {
  const read = async (seed: string) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await startRoute(page, seed, { 'birdsquad.motionPreference': 'reduced' });
    const card = (await life(page)).arrivalCard;
    // Reduced Motion: the line is fully shown at once.
    const alpha = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('district-arrival-card')
      .getByName('district-arrival-card-thread').alpha);
    await context.close();
    return { thread: card.thread as string, alpha };
  };
  const seeds = ['thread-a', 'thread-b', 'thread-c', 'thread-d', 'thread-e', 'thread-f'];
  const lines: string[] = [];
  for (const seed of seeds) lines.push((await read(seed)).thread);
  const again = await read('thread-a');
  expect(again).toEqual({ thread: lines[0], alpha: 1 });
  // Four lines to pick from: six seeds do not all land on one.
  expect(new Set(lines).size).toBeGreaterThan(1);
});

test('the recap closes on a line for the Leader, the result and the last district', async ({ page }) => {
  const loss = flightSummary(1, { seed: 'closing-loss', result: 'loss', leaderId: 'roostkeeper', mapId: 'map_03_signal_spires', currentCohesion: 0 });
  const win = flightSummary(2, { seed: 'closing-win', leaderId: 'spark_caller' });
  await openTitle(page, { 'birdsquad.runs': JSON.stringify([loss, win]), 'birdsquad.motionPreference': 'reduced' });
  await tabTo(page, 'recap');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).mode === 'runRecap');
  const fill = (lines: readonly string[], district: string) => lines.map((line) => line.replace(/\{district\}/g, district));
  const won = await textState(page);
  expect(fill(narrativeThreads.spark_caller.closings.win, 'High Roost')).toContain(won.closing);
  const shown = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RecapScene').children.getByName('recap-card').getByName('recap-closing').text);
  expect(shown.replace(/\s+/g, ' ')).toBe(won.closing);

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.waitForFunction((id) => JSON.parse((window as any).render_game_to_text()).runId === id, loss.id);
  const lost = await textState(page);
  expect(fill(narrativeThreads.roostkeeper.closings.loss, 'Signal Spires')).toContain(lost.closing);
  expect(lost.closing).toContain('Signal Spires');
});
