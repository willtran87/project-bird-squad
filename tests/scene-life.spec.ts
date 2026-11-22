import { test, expect, type Page } from '@playwright/test';

// The "life" layer (src/game/spectacle/life) dresses the title, the route map
// and the shared chrome from outside the scenes. These checks pin its contract:
// it is presentation only. Logical state, geometry and input are final from
// the first frame; movement follows Reduced Motion, Lean graphics and the
// deterministic advanceTime clock.

type Storage = Record<string, string>;
const REDUCED: Storage = { 'birdsquad.motionPreference': 'reduced' };
const LEAN: Storage = { 'birdsquad.graphicsQuality': 'lean' };

async function frames(page: Page, count = 3) {
  const start = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame);
  await page.waitForFunction(({ start, count }) => (window as any).__birdSquadGame.loop.frame >= start + count, { start, count });
}

async function openTitle(page: Page, storage: Storage = {}) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript((values) => {
    if (sessionStorage.getItem('scene-life-seeded')) return;
    sessionStorage.setItem('scene-life-seeded', '1');
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value as string);
  }, storage);
  await page.goto('./?flight=scene-life');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.waitForFunction(() => typeof (window as any).__birdSquadLife === 'function');
  return errors;
}

async function openRoute(page: Page, storage: Storage = {}) {
  const errors = await openTitle(page, storage);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  await frames(page);
  return errors;
}

/** Restart the route in a given district, optionally part-way through it. */
async function enterDistrict(page: Page, mapIndex: number, seed = 's1', flown = false) {
  await page.evaluate(({ mapIndex, seed }) => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    route.scene.restart({ runState: { ...route.runState, mapIndex, seed, completedRouteNodeIds: [], currentRouteNodeId: undefined } });
  }, { mapIndex, seed });
  await frames(page, 4);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  if (flown) {
    await page.evaluate(() => {
      const w = window as any, route = w.__birdSquadGame.scene.getScene('RouteScene');
      const entry = w.__birdSquadCurrentMap().entryNodeId;
      route.scene.restart({ runState: { ...route.runState, completedRouteNodeIds: [entry], currentRouteNodeId: entry } });
    });
    await frames(page, 4);
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  }
  await frames(page);
}

const life = (page: Page, scene = 'RouteScene') => page.evaluate(key => (window as any).__birdSquadLife(key), scene);
const skipCard = async (page: Page) => {
  await page.evaluate(() => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    route.events.emit('spectacle-skip-arrival');
    (window as any).advanceTime(400);
  });
  await frames(page);
};

test('route map shows a legend, a flock marker, flight trails and pulsing reachable nodes', async ({ page }) => {
  const errors = await openRoute(page);
  await enterDistrict(page, 0, 'alpha', true);
  const read = () => page.evaluate(() => {
    const w = window as any, route = w.__birdSquadGame.scene.getScene('RouteScene');
    const named = (name: string) => route.children.list.filter((child: any) => child.name === name);
    const types = [...new Set(w.__birdSquadCurrentMap().nodes.map((node: any) => node.type))];
    return {
      types: types.length, legendIcons: named('route-legend-icon').length,
      legendLabels: named('route-legend-label').map((label: any) => ({ text: label.text, size: Number.parseFloat(label.style.fontSize) })),
      nodeIcons: named('route-node-icon').length, nodes: w.__birdSquadCurrentMap().nodes.length,
      // The selected node wears its own focus ring instead of a pulse.
      selectable: [...route.selectableNodeIds].filter((id: string) => id !== route.selectedNodeId), current: route.runState.currentRouteNodeId,
      life: w.__birdSquadLife('RouteScene').route,
    };
  });
  const before = await read();
  // One legend row per node type on this map; the map's own icons are untouched.
  expect(before.legendIcons).toBe(before.types);
  expect(before.legendLabels.every(label => label.text.length > 0 && label.size >= 16)).toBe(true);
  expect(before.nodeIcons).toBe(before.nodes);
  expect(before.life.marker).toMatchObject({ nodeId: before.current, perched: false, flying: false });
  expect(before.life.pulses.map((pulse: any) => pulse.nodeId).sort()).toEqual([...before.selectable].sort());
  expect(before.life.motes).toBe(0);
  // The pulse is a function of the scene clock: advanceTime moves it.
  await page.evaluate(() => (window as any).advanceTime(400));
  await frames(page);
  const after = await read();
  expect(after.life.pulses[0].scale).not.toBe(before.life.pulses[0].scale);
  expect(errors).toEqual([]);
});

test('the flock flies the chosen edge during the commit beat while the commit stays logical', async ({ page }) => {
  await openRoute(page);
  await enterDistrict(page, 0, 'alpha', true);
  const flight = await page.evaluate(() => {
    const w = window as any, route = w.__birdSquadGame.scene.getScene('RouteScene');
    const target = [...route.selectableNodeIds].find((id: string) => !w.__birdSquadCurrentMap().nodes.find((n: any) => n.id === id).type.match(/street|boss|rival/))
      ?? [...route.selectableNodeIds][0];
    route.selectRouteNode(target);
    const before = w.__birdSquadLife('RouteScene').route.marker;
    route.commitRouteNodeAnimated(target);
    const pending = route.routeCommitPending;
    w.advanceTime(90);
    return { before, pending, mid: w.__birdSquadLife('RouteScene').route.marker, wake: Boolean(route.children.getByName('route-flock-wake')) };
  });
  expect(flight.pending).toBe(true);
  expect(flight.mid.flying).toBe(true);
  expect(flight.wake).toBe(true);
  expect(Math.hypot(flight.mid.x - flight.before.x, flight.mid.y - flight.before.y)).toBeGreaterThan(8);
});

test('a four-lane district keeps every node clear of the header row, the Flyway bar and the legend', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await openRoute(page);
  await enterDistrict(page, 1, 's1');
  const layout = await page.evaluate(() => {
    const w = window as any, route = w.__birdSquadGame.scene.getScene('RouteScene');
    const map = w.__birdSquadCurrentMap();
    const box = (object: any) => { const b = object.getBounds(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
    const nodes = map.nodes.map((node: any) => {
      const { x, y } = route.nodePosition(node), r = node.type === 'boss' ? 66 : 50;
      return { left: x - r, right: x + r, top: y - r, bottom: y + r };
    });
    const named = (name: string) => route.children.list.filter((child: any) => child.name === name).map(box);
    return { lanes: Math.max(...map.columns.map((column: any[]) => column.length)), nodes,
      banner: named('route-district-banner'), flyway: named('flyway-restoration'), legend: named('route-legend') };
  });
  const overlaps = (a: any, b: any) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  expect(layout.lanes).toBe(4);
  expect(layout.flyway.length).toBeGreaterThan(0);
  expect(layout.legend).toHaveLength(1);
  for (const node of layout.nodes) {
    for (const plate of [...layout.banner, ...layout.flyway, ...layout.legend]) expect(overlaps(node, plate)).toBe(false);
  }
});

test('district arrival card shows once per district per run, is skippable and only dismisses itself', async ({ page }) => {
  const errors = await openRoute(page);
  const first = await page.evaluate(() => {
    const w = window as any, route = w.__birdSquadGame.scene.getScene('RouteScene');
    return { card: w.__birdSquadLife('RouteScene').arrivalCard, mode: JSON.parse(w.render_game_to_text()).mode,
      selectable: route.selectableNodeIds.size, interactive: route.children.list.filter((c: any) => c.name === 'route-node-hit' && c.input?.enabled).length,
      cardInput: route.children.getByName('district-arrival-card').list.filter((c: any) => c.input).length };
  });
  expect(first.card).toMatchObject({ district: 0, name: 'Rooftop Blocks' });
  expect(first.card.depth).toBeGreaterThan(24002);
  // The route under the card is live, and the card itself takes no pointer input.
  expect(first).toMatchObject({ mode: 'routeSelection', cardInput: 0 });
  expect(first.selectable).toBeGreaterThan(0);
  expect(first.interactive).toBeGreaterThan(0);
  // Confirm only dismisses the card: it never acts on the hidden route.
  const before = await page.evaluate(() => JSON.parse((window as any).render_game_to_text()));
  await page.keyboard.press('Enter');
  await page.evaluate(() => (window as any).advanceTime(400));
  await frames(page);
  expect((await life(page)).arrivalCard).toBeUndefined();
  const after = await page.evaluate(() => JSON.parse((window as any).render_game_to_text()));
  expect({ mode: after.mode, selected: after.selectedNodeId, node: after.currentNodeId })
    .toEqual({ mode: before.mode, selected: before.selectedNodeId, node: before.currentNodeId });
  // Same district, same run: not again.
  await enterDistrict(page, 0, 'alpha');
  expect((await life(page)).arrivalCard).toBeUndefined();
  for (const [index, name] of [[1, 'Canal Markets'], [2, 'Signal Spires'], [3, 'High Roost']] as const) {
    await enterDistrict(page, index);
    expect((await life(page)).arrivalCard).toMatchObject({ district: index, name });
    // It plays out on the scene clock without any input.
    await page.evaluate(() => (window as any).advanceTime(3600));
    await frames(page);
    expect((await life(page)).arrivalCard).toBeUndefined();
  }
  expect(errors).toEqual([]);
});

test('light progresses across a run: dusk, night, night, dawn', async ({ page }) => {
  await openRoute(page);
  const names: string[] = [(await life(page)).light.name];
  for (const index of [1, 2, 3]) {
    await enterDistrict(page, index);
    names.push((await life(page)).light.name);
  }
  expect(names).toEqual(['dusk', 'night', 'night', 'dawn']);
  // The painting itself is graded at draw time only: its own tint stays clean.
  const painting = await page.evaluate(() => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const image = route.children.getByName('route-map-backdrop');
    return { tint: image.tintTopLeft, width: image.displayWidth, x: image.x, layers: route.children.list.slice(0, 5).map((c: any) => c.name) };
  });
  expect(painting).toMatchObject({ tint: 0xffffff, width: 1280, x: 640 });
  expect(painting.layers[0]).toBe('route-map-backdrop');
});

test('scene changes are immediate and a wing wipe carries the old scene away', async ({ page }) => {
  const errors = await openTitle(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
  await page.waitForFunction(() => (window as any).__birdSquadLife('RouteScene').transition?.pair === 'MenuScene>RouteScene');
  const state = await page.evaluate(() => {
    const g = (window as any).__birdSquadGame;
    return { transition: (window as any).__birdSquadLife('RouteScene').transition, active: g.scene.getScenes(true).map((s: any) => s.scene.key) };
  });
  expect(state.transition).toMatchObject({ pair: 'MenuScene>RouteScene', style: 'wing' });
  // No holding scene and no delay: the route is the only active scene.
  expect(state.active).toEqual(['RouteScene']);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.evaluate(() => (window as any).advanceTime(1200));
  await frames(page);
  const settled = await page.evaluate(() => {
    const g = (window as any).__birdSquadGame, route = g.scene.getScene('RouteScene');
    return { layer: Boolean(route.children.getByName('spectacle-exit-transition')), snapshot: g.textures.exists('life-exit-snapshot') };
  });
  expect(settled).toEqual({ layer: false, snapshot: false });
  expect(errors).toEqual([]);
});

test('overlays arrive at draw time only, over a slate scrim, with the weather behind them', async ({ page }) => {
  await openRoute(page);
  await skipCard(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('system-quiet-menu-panel'));
  const pause = await page.evaluate(() => {
    const w = window as any, route = w.__birdSquadGame.scene.getScene('RouteScene');
    const names = route.children.list.map((child: any) => child.name);
    const panel = route.children.getByName('system-quiet-menu-panel'), scrim = route.children.getByName('pause-actions');
    const buttons = route.children.list.filter((child: any) => child.name === 'system-field-button-hit');
    return {
      overlay: w.__birdSquadLife('RouteScene').overlay,
      panel: { x: panel.x, y: panel.y, alpha: panel.alpha }, scrim: { alpha: scrim.alpha, fillAlpha: scrim.fillAlpha, fill: scrim.fillColor },
      order: { weather: names.indexOf('spectacle-weather'), life: names.indexOf('spectacle-life'), scrim: names.indexOf('pause-actions') },
      buttons: buttons.map((hit: any) => ({ y: hit.y, alpha: hit.alpha, height: hit.height, enabled: hit.input?.enabled,
        label: hit.getData('labelObject').text, bevel: hit.getData('bevel')?.name, bevelInput: Boolean(hit.getData('bevel')?.input) })),
    };
  });
  expect(pause.overlay.kind).toBe('pause');
  // Settled geometry and opacity from the first frame, whatever the entrance is doing.
  expect(pause.panel).toEqual({ x: 640, y: 360, alpha: 1 });
  expect(pause.scrim).toEqual({ alpha: 1, fillAlpha: 0.84, fill: 0x0a121c });
  // Rain and ambient life stay behind the overlay.
  expect(pause.order.weather).toBeGreaterThanOrEqual(0);
  expect(pause.order.weather).toBeLessThan(pause.order.scrim);
  expect(pause.order.life).toBeLessThan(pause.order.scrim);
  expect(pause.buttons.length).toBeGreaterThanOrEqual(3);
  for (const button of pause.buttons) {
    expect(button).toMatchObject({ alpha: 1, enabled: true, bevel: 'quiet-button-bevel', bevelInput: false });
    expect(button.height).toBeGreaterThanOrEqual(44);
  }
  expect(pause.buttons.map(button => button.label)).toContain('Resume');
});

test('Reduced Motion keeps the legend, marker, grade and card but removes movement', async ({ page }) => {
  const errors = await openRoute(page, REDUCED);
  const card = (await life(page)).arrivalCard;
  expect(card).toMatchObject({ district: 0, alpha: 1 });
  await skipCard(page);
  await enterDistrict(page, 0, 'alpha', true);
  const state = await page.evaluate(() => {
    const w = window as any, route = w.__birdSquadGame.scene.getScene('RouteScene');
    return { life: w.__birdSquadLife('RouteScene'), legend: route.children.list.filter((c: any) => c.name === 'route-legend-icon').length };
  });
  expect(state.legend).toBeGreaterThan(0);
  expect(state.life.route.marker).toBeTruthy();
  expect(state.life.route.pulses).toEqual([]);
  expect(state.life.backdrop).toMatchObject({ present: true, birds: 0, steam: 0 });
  expect(errors).toEqual([]);
});

test('Lean graphics removes the living backdrop and transitions and keeps the readable parts', async ({ page }) => {
  const errors = await openRoute(page, LEAN);
  const state = await page.evaluate(() => {
    const w = window as any, route = w.__birdSquadGame.scene.getScene('RouteScene');
    return { life: w.__birdSquadLife('RouteScene'), legend: route.children.list.filter((c: any) => c.name === 'route-legend-icon').length,
      wipe: Boolean(route.children.getByName('spectacle-exit-transition')) };
  });
  expect(state.life.backdrop.present).toBe(false);
  expect(state.life.transition).toBeUndefined();
  expect(state.wipe).toBe(false);
  expect(state.legend).toBeGreaterThan(0);
  expect(state.life.route.marker).toBeTruthy();
  expect(state.life.route.pulses).toEqual([]);
  expect(errors).toEqual([]);
});

test('title rows and buttons are dressed without moving, fading or renaming them', async ({ page }) => {
  const errors = await openTitle(page);
  const read = () => page.evaluate(() => {
    const menu = (window as any).__birdSquadGame.scene.getScene('MenuScene');
    return { life: (window as any).__birdSquadLife('MenuScene').backdrop,
      rows: menu.children.list.filter((child: any) => child.name === 'title-run-action').map((hit: any) => {
        const b = hit.getBounds();
        return { bounds: [b.x, b.y, b.width, b.height], alpha: hit.alpha, label: hit.getData('labelObject').text,
          labelY: hit.getData('labelObject').y, enabled: Boolean(hit.input?.enabled) };
      }) };
  });
  // Read during the staggered entrance, then after it: nothing logical changed.
  const during = await read();
  await page.evaluate(() => (window as any).advanceTime(1500));
  await frames(page);
  const after = await read();
  expect(during.rows.length).toBeGreaterThan(0);
  expect(during.rows).toEqual(after.rows);
  for (const row of during.rows) expect(row).toMatchObject({ alpha: 1, enabled: true });
  expect(after.life).toMatchObject({ present: true });
  expect(after.life.birds).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
