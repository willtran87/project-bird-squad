import { test, expect, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Device-pixel-ratio rendering. The canvas backing store follows the display's
// device pixels (capped at 2x) while game space stays 1280x720: scale sizes,
// pointer coordinates, object positions and bounds must be identical at DPR 1
// and DPR 2, and a click must still land on what it points at.

const encounter = JSON.parse(readFileSync('data/game/alpha-encounters.json', 'utf8')).encounters
  .find((entry: { id: string }) => entry.id === 'enc_roof_rat');

async function openPage(browser: Browser, deviceScaleFactor: number, storage: Record<string, string> = {}, query = '') {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(values => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value as string);
  }, storage);
  await page.goto(`./?flight=high-dpi${query}`);
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  // The renderer patches load beside boot.
  await page.waitForFunction(() => (window as any).__birdSquadRenderResolution && (window as any).__birdSquadFrameGovernor);
  return { page, context, errors };
}

const resolution = (page: Page) => page.evaluate(() => {
  const w = window as any, game = w.__birdSquadGame, box = game.canvas.getBoundingClientRect();
  return {
    ...w.__birdSquadRenderResolution(),
    gameSize: [game.scale.gameSize.width, game.scale.gameSize.height],
    css: [Math.round(box.width), Math.round(box.height)],
    drawingBuffer: [game.renderer.gl.drawingBufferWidth, game.renderer.gl.drawingBufferHeight],
  };
});

/** Every visible text and interactive object's bounds, in game space. */
const geometry = (page: Page, sceneKey: string) => page.evaluate(sceneKey => {
  const scene = (window as any).__birdSquadGame.scene.getScene(sceneKey);
  const out: string[] = [];
  const visit = (list: any[]) => list.forEach((child: any) => {
    if (!child.visible || /^combat-bark/.test(child.name)) return; // Barks follow wall time.
    if ((child.type === 'Text' || child.input) && child.getBounds) {
      const b = child.getBounds();
      out.push(`${child.name || child.type}:${child.text ?? ''}:${[b.x, b.y, b.width, b.height].map((v: number) => v.toFixed(2)).join(',')}`);
    }
    if (Array.isArray(child.list)) visit(child.list);
  });
  visit(scene.children.list);
  return out.sort();
}, sceneKey);

/** Share of each canvas quadrant that is not the clear colour, read from the
 * backing store. A viewport left at game size would draw into one quadrant. */
const quadrants = (page: Page) => page.evaluate(async () => {
  const game = (window as any).__birdSquadGame;
  await new Promise(requestAnimationFrame);
  const source = game.canvas as HTMLCanvasElement;
  const copy = document.createElement('canvas');
  copy.width = source.width;
  copy.height = source.height;
  const context = copy.getContext('2d')!;
  context.drawImage(source, 0, 0);
  const { data } = context.getImageData(0, 0, copy.width, copy.height);
  const filled = [0, 0, 0, 0], total = [0, 0, 0, 0];
  for (let y = 0; y < copy.height; y += 7) for (let x = 0; x < copy.width; x += 7) {
    const i = (y * copy.width + x) * 4, q = (y < copy.height / 2 ? 0 : 2) + (x < copy.width / 2 ? 0 : 1);
    total[q] += 1;
    // Clear colour #08101d.
    if (Math.abs(data[i] - 8) + Math.abs(data[i + 1] - 16) + Math.abs(data[i + 2] - 29) > 12) filled[q] += 1;
  }
  return filled.map((count, q) => count / total[q]);
});

async function openRoute(page: Page) {
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  await page.evaluate(() => {
    const w = window as any;
    w.__birdSquadGame.scene.getScene('RouteScene').events.emit('spectacle-skip-arrival');
    w.advanceTime(1200);
  });
}

async function openBattle(page: Page) {
  await page.evaluate(async entry => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.id === 'm1_entry');
    Object.assign(node, { payloadId: entry.id, type: entry.nodeType, label: entry.name });
    const runState = w.__birdSquadGame.scene.getScene('RouteScene').runState;
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: node.id, runState });
  }, encounter);
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued
      && b.handCardRects.size === b.hand.length;
  });
  await page.evaluate(() => (window as any).advanceTime(900));
}

test('DPR 2 renders a 2x backing store across the whole canvas with game space unchanged', async ({ browser }) => {
  const { page, context, errors } = await openPage(browser, 2);
  expect(await resolution(page)).toEqual({
    ratio: 2, backingWidth: 2560, backingHeight: 1440, gameWidth: 1280, gameHeight: 720,
    gameSize: [1280, 720], css: [1280, 720], drawingBuffer: [2560, 1440],
  });
  // The title painting covers the frame: every quadrant of the backing store is drawn.
  for (const share of await quadrants(page)) expect(share).toBeGreaterThan(0.5);
  // Shader passes (forced on here; automated browsers skip them) render through
  // framebuffers and composite back into the full backing store.
  const filtered = await openPage(browser, 2, {}, '&fx=full');
  expect(await filtered.page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').children.list
    .some((child: any) => child.filters?.internal.list.length))).toBe(true);
  for (const share of await quadrants(filtered.page)) expect(share).toBeGreaterThan(0.5);
  expect(filtered.errors).toEqual([]);
  await filtered.context.close();
  // A capture is the full backing store, not its lower-left quarter.
  const photo = await page.evaluate(() => new Promise<number[]>(resolve => (window as any).__birdSquadGame.renderer
    .snapshot((image: HTMLImageElement) => resolve([image.width, image.height]))));
  expect(photo).toEqual([2560, 1440]);
  expect(errors).toEqual([]);
  await context.close();
});

test('a zoomed main camera (the compact lens uses about 1.5x) still fills the 2x backing store and maps pointers', async ({ browser }) => {
  const { page, context, errors } = await openPage(browser, 2);
  await page.evaluate(() => {
    const camera = (window as any).__birdSquadGame.scene.getScene('MenuScene').cameras.main;
    camera.setZoom(1.5);
    camera.centerOn(640, 360);
  });
  for (const share of await quadrants(page)) expect(share).toBeGreaterThan(0.5);
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + 100 * box.width / 1280, box.y + 100 * box.height / 720);
  const mapped = await page.evaluate(() => {
    const game = (window as any).__birdSquadGame, pointer = game.input.activePointer;
    const world = game.scene.getScene('MenuScene').cameras.main.getWorldPoint(pointer.x, pointer.y);
    return [pointer.x, pointer.y, world.x, world.y].map(value => Math.round(value * 10) / 10);
  });
  // Pointer stays in game space; the camera alone applies the zoom.
  expect(mapped[0]).toBeCloseTo(100, 0);
  expect(mapped[1]).toBeCloseTo(100, 0);
  expect(mapped[2]).toBeCloseTo(640 + (100 - 640) / 1.5, 0);
  expect(mapped[3]).toBeCloseTo(360 + (100 - 360) / 1.5, 0);
  expect(await resolution(page)).toMatchObject({ ratio: 2, backingWidth: 2560, gameSize: [1280, 720] });
  expect(errors).toEqual([]);
  await context.close();
});

test('Lean graphics and DPR 1 keep the 1280x720 backing store', async ({ browser }) => {
  const lean = await openPage(browser, 2, { 'birdsquad.graphicsQuality': 'lean' });
  expect(await resolution(lean.page)).toMatchObject({ ratio: 1, backingWidth: 1280, backingHeight: 720, css: [1280, 720] });
  await lean.context.close();
  const standard = await openPage(browser, 1);
  expect(await resolution(standard.page)).toMatchObject({ ratio: 1, backingWidth: 1280, backingHeight: 720 });
  await standard.context.close();
});

test('pointer input still maps to game space at DPR 2: route nodes and hand cards', async ({ browser }) => {
  test.setTimeout(120_000);
  const { page, context, errors } = await openPage(browser, 2);
  await openRoute(page);
  // Pointing at a future node reports the game-space point the mouse is on;
  // tapping it opens that node's dossier.
  const node = await page.evaluate(() => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const hit = route.children.list.filter((child: any) => child.name === 'route-node-hit'
      && child.getData('routeNodeState') === 'future').at(-1);
    const bounds = hit.getBounds();
    return { id: hit.getData('routeNodeId'), x: bounds.centerX, y: bounds.centerY };
  });
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + node.x * box.width / 1280, box.y + node.y * box.height / 720);
  const pointer = await page.evaluate(() => {
    const p = (window as any).__birdSquadGame.input.activePointer;
    return [p.x, p.y];
  });
  expect(Math.abs(pointer[0] - node.x)).toBeLessThan(1.5);
  expect(Math.abs(pointer[1] - node.y)).toBeLessThan(1.5);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => JSON.parse((window as any).render_game_to_text()).mapInspection?.id)).toBe(node.id);
  await page.keyboard.press('Escape');

  await openBattle(page);
  const card = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const [id, rect] = [...b.handCardRects.entries()][1];
    return { id, x: rect.x, y: rect.y, selected: b.selectedInstanceId };
  });
  expect(card.selected).not.toBe(card.id);
  await page.mouse.click(box.x + card.x * box.width / 1280, box.y + card.y * box.height / 720);
  await expect.poll(() => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').selectedInstanceId)).toBe(card.id);
  expect(errors).toEqual([]);
  await context.close();
});

/** Geometry of both pages once lazily loaded panels (the collection goal,
 * deferred chunks) have settled the same way on each. */
async function settledGeometry(one: Page, two: Page, sceneKey: string) {
  let a: string[] = [], b: string[] = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    [a, b] = [await geometry(one, sceneKey), await geometry(two, sceneKey)];
    if (JSON.stringify(a) === JSON.stringify(b)) break;
    await one.waitForTimeout(250);
  }
  return [a, b];
}

test('text and control geometry is identical at DPR 1 and DPR 2 on title, route and combat', async ({ browser }) => {
  test.setTimeout(150_000);
  const one = await openPage(browser, 1);
  const two = await openPage(browser, 2);
  for (const { page } of [one, two]) await page.evaluate(() => (window as any).advanceTime(2000));
  const [titleOne, titleTwo] = await settledGeometry(one.page, two.page, 'MenuScene');
  expect(titleOne.length).toBeGreaterThan(5);
  expect(titleTwo).toEqual(titleOne);
  for (const { page } of [one, two]) await openRoute(page);
  const [routeOne, routeTwo] = await settledGeometry(one.page, two.page, 'RouteScene');
  expect(routeOne.length).toBeGreaterThan(10);
  expect(routeTwo).toEqual(routeOne);
  for (const { page } of [one, two]) await openBattle(page);
  const [battleOne, battleTwo] = await settledGeometry(one.page, two.page, 'BattleScene');
  expect(battleOne.length).toBeGreaterThan(10);
  expect(battleTwo).toEqual(battleOne);
  expect(one.errors).toEqual([]);
  expect(two.errors).toEqual([]);
  await one.context.close();
  await two.context.close();
});
