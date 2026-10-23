import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

for (const surface of ['market', 'picker'] as const) for (const late of [false, true]) test(`${surface} card art ${late ? 'late arrival' : 'failure'} is bounded and recovery preserves its armed decision`, async ({ page }, info) => {
  test.setTimeout(60000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
    w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('RouteScene');
  });
  await page.waitForFunction(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.cardHoverDetailModule && r.routeEssentialAssetsReady && !r.load.isLoading();
  });
  const id = await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    r.runState.scrap = 999;
    r.openMarketNode({ ...w.__birdSquadCurrentMap().nodes.find((n: any) => n.type !== 'boss'), type: 'market' });
    r.setMarketCategory('services');
    return r.pickerEligibleCards('preen')[0].card.id;
  });
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').load.isLoading());
  let requests = 0, fail = !late, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const pattern = new RegExp(`/${id}-[^/]+\\.webp$`);
  await page.route(pattern, async route => { requests++; if (late) await gate; if (fail) await route.abort(); else await route.continue(); });
  try {
  await page.evaluate(({ id, surface }) => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    for (const key of [`card-${id}`, `card-thumb-${id}`]) if (r.textures.exists(key)) r.textures.remove(key);
    if (surface === 'market') {
      r.marketCardShelf = [{ id, price: 1, sold: false }];
      r.setMarketCategory('cards'); r.marketFocusId = 'card:0'; r.marketFocusArmedId = 'card:0'; r.renderAll();
    } else {
      r.openMarketCardPicker(r.marketUtilityShelf.findIndex((o: any) => o.id === 'preen'), 'preen');
      r.requestCardPick(r.pickerEligibleCards('preen')[0].index);
    }
  }, { id, surface });
  const snapshot = () => page.evaluate(surface => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const controls = r.children.list.filter((o: any) => surface === 'market'
      ? o.getData?.('marketFocusId') === 'card:0' || o.name === 'market-purchase-action'
      : ['card-picker-card-hit', 'card-picker-confirmation-command-frame'].includes(o.name));
    return { run: JSON.stringify(r.runState), armed: surface === 'market' ? r.marketFocusArmedId : r.cardPickerArmedIndex,
      focus: surface === 'market' ? r.marketFocusId : r.cardPickerFocusIndex,
      bounds: controls.map((o: any) => { const b = o.getBounds(); return [b.x, b.y, b.width, b.height]; }) };
  }, surface);
  const before = await snapshot();
  await expect.poll(() => requests).toBeGreaterThan(0);
  if (!late) await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').load.isLoading());
  await settleCanvas(page);
  const initialRequests = requests;
  // Exercise repeated redraws while the original request is still pending;
  // browser round trips must not turn this into the separate XHR-timeout case.
  await page.evaluate(() => {
    const scene = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    for (let i = 0; i < 10; i++) scene.renderAll();
  });
  await settleCanvas(page);
  expect(requests).toBe(initialRequests);
  expect(initialRequests).toBeLessThanOrEqual(3); // one compact portrait, including Phaser's two retries
  expect(await snapshot()).toEqual(before);
  await page.screenshot({ path: info.outputPath(`${late ? 'loading' : 'failed'}-1000.png`) });
  fail = false;
  if (late) release();
  else {
  // Explicit art-only recovery must not clear selection or purchase anything.
  const point = await page.evaluate(surface => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const b = r.children.getByName('route-art-retry-hit').getBounds(), c = r.game.canvas.getBoundingClientRect();
    const otherNames = surface === 'market'
      ? ['market-enamel-button-hit', 'market-category-tab-hit', 'market-purchase-action']
      : ['card-picker-card-hit', 'route-event-cancel-hit', 'card-picker-confirmation-command-frame'];
    const overlaps = r.children.list.filter((o: any) => otherNames.includes(o.name)).filter((o: any) => {
      const z = o.getBounds(); return b.left < z.right && z.left < b.right && b.top < z.bottom && z.top < b.bottom;
    }).map((o: any) => o.name);
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720,
      width: b.width * c.width / 1280, height: b.height * c.height / 720, overlaps };
  }, surface);
  expect(point.overlaps).toEqual([]);
  expect(point.width).toBeGreaterThanOrEqual(44); expect(point.height).toBeGreaterThanOrEqual(44);
  if (surface === 'picker') await page.keyboard.press('r');
  else await page.mouse.click(point.x, point.y);
  }
  await page.waitForFunction(id => (window as any).__birdSquadGame.scene.getScene('RouteScene').textures.exists(`card-thumb-${id}`), id);
  await settleCanvas(page);
  expect(await snapshot()).toEqual(before);
  for (const [width, height] of [[1000,560], [1440,900], [2560,1600]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    const art = await page.evaluate(id => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      return r.children.list.filter((o: any) => o.texture?.key === `card-thumb-${id}`).map((o: any) =>
        ({ width: o.displayWidth, height: o.displayHeight, intact: !o.isCropped && !o.mask && Math.abs(o.scaleX - o.scaleY) < 0.0001 }));
    }, id);
    expect(art.length).toBeGreaterThan(0); expect(art.every(o => o.intact)).toBe(true);
    await page.screenshot({ path: info.outputPath(`recovered-${width}.png`) });
  }
  expect(errors).toEqual([]);
  } finally { release(); }
});
