import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { installVirtualController, pressController, controllerButton } from './helpers/virtual-controller';
test.use({ hasTouch: true });
async function boot(page: Page) {
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
    w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('RouteScene');
  });
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt);
}
async function prepare(page: Page, mapIndex = 0) {
  await page.evaluate(mapIndex => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    // A deterministic catalogue fixture must contain every type; a random
    // valid district is permitted to omit optional rivals.
    const [blueprints, generate, hash] = w.__routeAudit;
    const seed = Array.from({ length: 100 }, (_, i) => `map-inspection-${i}`).find(seed =>
      new Set(generate(blueprints[mapIndex], hash(seed, mapIndex)).nodes.map((n: any) => n.type)).size === 8);
    if (!seed) throw Error('Missing complete node-type fixture');
    const runState = { ...structuredClone(r.runState), seed, mapIndex, currentRouteNodeId: undefined, completedRouteNodeIds: [] };
    w.__birdSquadGame.scene.stop('RouteScene'); w.__birdSquadGame.scene.start('RouteScene', { runState });
  }, mapIndex);
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt);
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.runState.districtContracts.forEach((c: any) => { c.confirmed = true; }); r.renderAll();
  });
  await settleCanvas(page);
}
const state = (page: Page) => page.evaluate(() => {
  const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
  return { run: JSON.stringify(r.runState), selected: r.selectedNodeId,
    inspection: JSON.parse(w.render_game_to_text()).mapInspection, paused: r.pauseOverlayOpen,
    reading: JSON.parse(w.render_game_to_text()).flockStatsReading };
});
async function click(page: Page, name: string, touch = false, nodeId?: string) {
  const p = await page.evaluate(({ name, nodeId }) => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const all = (list: any[]): any[] => list.flatMap(o => [o, ...(o.list ? all(o.list) : [])]);
    const o = all(r.children.list).find(o => o.name === name && o.input?.enabled && (!nodeId || o.getData('routeNodeId') === nodeId));
    if (!o) throw Error('Missing enabled ' + name);
    const b = o.getBounds(), c = r.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, { name, nodeId });
  if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
  await settleCanvas(page);
}

for (let district = 0; district < 4; district++) test(`district ${district + 1}: all map stop types have complete read-only inspection at every viewport`, async ({ page }, info) => {
  test.setTimeout(180000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page);
  const types = new Set<string>();
    await prepare(page, district);
    const before = await state(page);
    const nodes = await page.evaluate(() => (window as any).__birdSquadCurrentMap().nodes.map((n: any) => ({ id: n.id, type: n.type })));
    for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size); await settleCanvas(page);
      expect(await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
        const b = r.children.getByName('route-map-inspect').getBounds();
        return r.children.list.filter((o: any) => ['route-collection-goal-hit', 'route-node-hit'].includes(o.name))
          .every((o: any) => { const a = o.getBounds(); return b.right + 12 <= a.left || b.left >= a.right + 12 || b.bottom + 12 <= a.top || b.top >= a.bottom + 12; });
      })).toBe(true);
      await click(page, 'route-map-inspect', size.width === 1000);
      await page.waitForFunction(() => !!JSON.parse((window as any).render_game_to_text()).mapInspection?.id);
      for (let i = 0; i < nodes.length; i++) {
        const current = await state(page), inspect = current.inspection;
        const expected = await page.evaluate(id => {
          const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
          const n = (window as any).__birdSquadCurrentMap().nodes.find((n: any) => n.id === id);
          return { ...r.nodeDecisionSummary(n), title: r.nodeDetail(n).title, type: n.type };
        }, inspect.id);
        types.add(expected.type);
        expect(inspect.title).toBe(expected.title); expect(inspect.benefit).toBe(expected.benefit); expect(inspect.risk).toBe(expected.risk);
        expect(current.reading).toContain(inspect.type); expect(current.reading).toContain(inspect.status);
        expect({ run: current.run, selected: current.selected }).toEqual({ run: before.run, selected: before.selected });
        const geometry = await page.evaluate(() => {
          const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), root = r.children.getByName('flock-stats-reader');
          const scale = r.game.canvas.getBoundingClientRect().height / 720;
          return { text: root.list.filter((o: any) => o.type === 'Text').map((o: any) => {
            const b = o.getBounds(); return { font: parseFloat(o.style.fontSize) * scale, floor: parseFloat(o.style.fontSize) >= 21 ? 16 : 14,
              contained: b.left >= 140 && b.right <= 1140 && b.top >= 50 && b.bottom <= 680 };
          }), hits: root.list.filter((o: any) => o.getData?.('controlKind') && o.visible).map((o: any) => o.height * scale),
            bodyBottom: root.getByName('map-inspection-body').getBounds().bottom };
        });
        geometry.text.forEach(t => { expect(t.font).toBeGreaterThanOrEqual(t.floor); expect(t.contained).toBe(true); });
        geometry.hits.forEach(h => expect(h).toBeGreaterThanOrEqual(44));
        expect(geometry.bodyBottom).toBeLessThanOrEqual(526);
        if (i === 0 || expected.type === 'boss') await page.screenshot({ path: info.outputPath(`map-${district}-${expected.type}-${size.width}.png`) });
        await click(page, 'map-inspection-next', size.width === 1000);
      }
      await click(page, 'map-inspection-close', size.width === 1000);
      expect((await state(page)).inspection).toBeUndefined();
    }
    // Direct tapping a future node opens its dossier rather than changing the destination.
    const future = nodes.at(-1)!;
    await click(page, 'route-node-hit', true, future.id);
    await expect.poll(async () => (await state(page)).inspection?.id).toBe(future.id);
    await page.keyboard.press('Escape');
    expect((await state(page)).run).toBe(before.run); expect((await state(page)).selected).toBe(before.selected);
  expect([...types].sort()).toEqual([...new Set<string>(nodes.map((n: { type: string }) => n.type))].sort());
  expect([...types].sort()).toEqual(['basin', 'boss', 'cache', 'market', 'nest', 'rival', 'signal', 'street']);
  expect(errors).toEqual([]);
});

test('map inspection remains keyboard reachable when I is remapped and exposes current and completed stops', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ next: 'KeyI' })));
  await boot(page); await prepare(page);
  const ids = await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene'), map = w.__birdSquadCurrentMap();
    const entry = map.entryNodeId, next = map.edges.find((e: any) => e.from === entry && !e.locked).to;
    r.runState.currentRouteNodeId = next; r.runState.completedRouteNodeIds = [entry, next];
    r.selectableNodeIds = new Set(r.getSelectableNodes().map((n: any) => n.id));
    r.selectedNodeId = [...r.selectableNodeIds][0]; r.renderAll();
    return [entry, next];
  });
  const before = await state(page);
  await page.keyboard.press('F2');
  await page.waitForFunction(() => !!JSON.parse((window as any).render_game_to_text()).mapInspection?.id);
  await page.keyboard.press('Escape');
  for (const [index, id] of ids.entries()) {
    await click(page, 'route-node-hit', true, id);
    expect((await state(page)).inspection).toMatchObject({ id, status: index ? 'Current stop' : 'Completed' });
    await page.keyboard.press('Escape');
  }
  expect((await state(page)).run).toBe(before.run); expect((await state(page)).selected).toBe(before.selected);
  await page.setViewportSize({ width: 2560, height: 1600 }); await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('map-inspection-entry.png') });
});

test('map inspection loading owns input and cannot reopen itself after dismissal', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route(/route-map-inspection-.*\.js/, async route => { requested = true; await gate; await route.continue(); });
  try {
    await boot(page); await prepare(page); const before = await state(page);
    expect(requested).toBe(false);
    await page.keyboard.press('i'); await expect.poll(() => requested).toBe(true);
    expect((await state(page)).inspection).toMatchObject({ loading: true });
    await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight');
    expect((await state(page)).run).toBe(before.run); expect((await state(page)).selected).toBe(before.selected);
    await page.keyboard.press('Escape'); release();
    await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').mapInspectionModule);
    expect((await state(page)).inspection).toBeUndefined();
    await page.keyboard.press('i');
    await page.waitForFunction(() => !!JSON.parse((window as any).render_game_to_text()).mapInspection?.id);
  } finally { release(); }
});

test('failed map inspection module leaves a readable escape path without changing the run', async ({ page }, info) => {
  await page.route(/route-map-inspection-.*\.js/, route => route.abort());
  await boot(page); await prepare(page); const before = await state(page);
  await page.setViewportSize({ width: 1000, height: 560 }); await settleCanvas(page);
  await page.keyboard.press('i');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).mapInspection?.failed);
  await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight');
  expect((await state(page)).run).toBe(before.run); expect((await state(page)).selected).toBe(before.selected);
  expect((await state(page)).reading).toContain('Map inspection unavailable');
  await page.screenshot({ path: info.outputPath('map-inspection-unavailable.png') });
  await click(page, 'map-inspection-close', true);
  expect((await state(page)).inspection).toBeUndefined();
});

test('map inspection finishes loading when explicitly reopened after a scene restart', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route(/route-map-inspection-.*\.js/, async route => { requested = true; await gate; await route.continue(); });
  try {
    await boot(page); await prepare(page);
    await page.keyboard.press('i'); await expect.poll(() => requested).toBe(true);
    await prepare(page, 1); const before = await state(page);
    await page.keyboard.press('i'); release();
    await page.waitForFunction(() => !!JSON.parse((window as any).render_game_to_text()).mapInspection?.id);
    expect((await state(page)).run).toBe(before.run); expect((await state(page)).selected).toBe(before.selected);
  } finally { release(); }
});

test('map inspection supports remapped keyboard, controller, pause ownership and held-confirm safety', async ({ page }) => {
  test.setTimeout(90000);
  await installVirtualController(page);
  await page.addInitScript(() => {
    localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ previous: 'KeyA', next: 'KeyD', confirm: 'KeyQ' }));
    localStorage.setItem('birdsquad.motionPreference', 'reduced');
  });
  await boot(page); await prepare(page);
  const before = await state(page);
  await page.keyboard.press('i');
  await page.waitForFunction(() => !!JSON.parse((window as any).render_game_to_text()).mapInspection?.id);
  const first = (await state(page)).inspection;
  for (let i = 1; i <= first.count; i++) {
    await page.keyboard.press('d'); expect((await state(page)).inspection.index).toBe((first.index + i) % first.count);
    await page.keyboard.press('q'); expect((await state(page)).run).toBe(before.run);
  }
  await page.keyboard.press('Escape'); await pressController(page, 4);
  for (let i = 1; i <= first.count; i++) {
    await pressController(page, 15); expect((await state(page)).inspection.index).toBe((first.index + i) % first.count);
  }
  const inspected = (await state(page)).inspection.id;
  await page.keyboard.press('p'); expect((await state(page)).paused).toBe(true);
  await page.keyboard.press('d'); await pressController(page, 15);
  expect((await state(page)).inspection.id).toBe(inspected);
  await page.keyboard.press('Escape');
  await controllerButton(page, 0, true); await pressController(page, 1);
  expect((await state(page)).inspection).toBeUndefined();
  await settleCanvas(page); expect((await state(page)).run).toBe(before.run);
  await controllerButton(page, 0, false);
  expect((await state(page)).selected).toBe(before.selected);
});

test('oversized map details paginate completely and reader listeners retire on close', async ({ page }, info) => {
  await boot(page); await prepare(page);
  const counts = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const original = r.nodeDecisionSummary.bind(r); r.nodeDecisionSummary = (n: any) => ({ ...original(n), risk: 'Long risk and exact consequences. '.repeat(80) + 'END OF FULL RISK' });
    return { keys: r.input.keyboard.listenerCount('keydown'), pad: r.input.gamepad.listenerCount('down') };
  });
  await click(page, 'route-map-inspect');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).mapInspection?.pages > 1);
  const pages = (await state(page)).inspection.pages;
  let full = '';
  for (let i = 0; i < pages; i++) { full += (await state(page)).inspection.text + '\n'; await click(page, 'map-inspection-more', true); }
  expect(full).toContain('END OF FULL RISK');
  await page.screenshot({ path: info.outputPath('long-map-details.png') });
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return { keys: r.input.keyboard.listenerCount('keydown'), pad: r.input.gamepad.listenerCount('down') };
  })).toEqual(counts);
});
