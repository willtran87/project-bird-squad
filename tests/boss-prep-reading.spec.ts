import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import {targetGeometry,checkTargetGeometry} from './helpers/target-geometry';
import { installVirtualController, pressController } from './helpers/virtual-controller';

test.use({ hasTouch: true });

async function boot(page: Page) {
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    w.__birdSquadGame.scene.stop('MenuScene');
    w.__birdSquadGame.scene.start('RouteScene');
  });
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt);
}

async function prepare(page: Page, mapIndex = 0) {
  await page.evaluate(mapIndex => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const runState = { ...structuredClone(r.runState), mapIndex, currentRouteNodeId: undefined, completedRouteNodeIds: [] };
    w.__birdSquadGame.scene.stop('RouteScene');
    w.__birdSquadGame.scene.start('RouteScene', { runState });
  }, mapIndex);
  await page.waitForFunction(mapIndex => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    return r.runState.mapIndex === mapIndex && JSON.parse(w.render_game_to_text()).assetReadiness?.fullArt;
  }, mapIndex);
  return page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    r.runState.districtContracts.forEach((c: any) => { c.confirmed = true; });
    r.selectedNodeId = w.__birdSquadCurrentMap().bossNodeId;
    r.renderAll();
    return { run: JSON.stringify(r.runState), prep: r.bossPrepReadiness(), selected: r.selectedNodeId };
  });
}

async function click(page: Page, name: string, touch = false) {
  const point = await page.evaluate(name => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const all = (list: any[]): any[] => list.flatMap(o => [o, ...(o.list ? all(o.list) : [])]);
    const hit = all(r.children.list).find(o => o.name === name);
    if (!hit) throw Error('Missing ' + name);
    const b = hit.getBounds(), c = r.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, name);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await settleCanvas(page);
}

const snapshot = (page: Page) => page.evaluate(() => {
  const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
  const root = r.children.getByName('flock-stats-reader');
  return { run: JSON.stringify(r.runState), selected: r.selectedNodeId, open: r.flockOverlayOpen,
    page: root?.getData('page'), summary: root?.getData('summary'), pending: r.routeCommitPending };
});

test('Boss preparation preserves complete information and readable geometry across all districts and viewports', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  for (let district = 0; district < 4; district++) {
    const before = await prepare(page, district);
    for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size); await settleCanvas(page);
      checkTargetGeometry(await targetGeometry(page,'RouteScene'),`district ${district}`);
      await page.screenshot({ path: info.outputPath(`map-${district}-${size.width}.png`) });
      await click(page, 'boss-prep-open', size.width === 1000);
      await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')
        .children.getByName('flock-stats-reader')?.getData('bossPrep'));
      const summaries: string[] = [];
      for (let section = 0; section < 3; section++) {
        await click(page, 'boss-prep-tab-' + section, size.width === 1000);
        const metrics = await page.evaluate(() => {
          const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
          const root = r.children.getByName('flock-stats-reader');
          const objects = [...root.list, ...root.getByName('boss-prep-reader-body').list];
          const texts = objects.filter((o: any) => o.type === 'Text' && o.text);
          const scale = r.game.canvas.getBoundingClientRect().height / 720;
          return { summary: root.getData('summary'),
            flywayHidden: !r.children.getByName('flyway-restoration'),
            small: texts.filter((o: any) => parseFloat(o.style.fontSize) * scale < (o.getData('primary') ? 16 : 14)).map((o: any) => o.text),
            outside: texts.filter((o: any) => { const b = o.getBounds(); return b.left < 120 || b.right > 1160 || b.top < 40 || b.bottom > 680; }).map((o: any) => o.text),
            overlap: texts.flatMap((a: any, i: number) => texts.slice(i + 1).filter((b: any) => {
              const x = a.getBounds(), y = b.getBounds();
              return x.left < y.right && y.left < x.right && x.top < y.bottom && y.top < x.bottom;
            }).map((b: any) => [a.text, b.text])),
            targets: objects.filter((o: any) => o.input?.enabled && o.name.startsWith('boss-prep-')).every((o: any) => o.width * scale >= 44 && o.height * scale >= 44),
          };
        });
        expect(metrics.small).toEqual([]); expect(metrics.outside).toEqual([]); expect(metrics.overlap).toEqual([]);
        expect(metrics.targets).toBe(true);
        expect(metrics.flywayHidden).toBe(true);
        summaries.push(metrics.summary);
        await expect.poll(() => page.locator('#game-status').textContent()).toContain(metrics.summary);
        await settleCanvas(page);
        checkTargetGeometry(await targetGeometry(page,'RouteScene'),`boss prep ${district}/${section}`);
        await page.screenshot({ path: info.outputPath(`prep-${district}-${section}-${size.width}.png`) });
      }
      const complete = summaries.join('\n'), prep = before.prep;
      for (const text of [prep.bossName, prep.thesis, prep.phaseHint, ...prep.primaryTests, ...prep.strategyHints, ...prep.needs, ...prep.usefulNodes]) {
        if (text) expect(complete).toContain(text);
      }
      expect(complete).toContain('Packed supplies: ' + prep.readiness.supplies);
      await click(page, 'boss-prep-close', size.width === 1000);
      expect(await snapshot(page)).toMatchObject({ run: before.run, selected: before.selected, open: false, pending: false });
    }
  }
  expect(errors).toEqual([]);
});

test('Boss preparation supports remapped keyboard, controller, modal ownership and listener cleanup', async ({ page }) => {
  // Three full reopen/pause/controller cycles include real Phaser frame polling.
  // Budget the complete lifecycle audit, not a single input action.
  test.setTimeout(90000);
  await installVirtualController(page);
  await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ roost: 'KeyI', previous: 'KeyJ', next: 'KeyK', back: 'KeyQ' })));
  await boot(page); const before = await prepare(page);
  const listeners = () => page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return [r.input.keyboard.listenerCount('keydown'), r.input.keyboard.listenerCount('keydown-K'), r.input.gamepad.listenerCount('down')];
  });
  const baseline = await listeners();
  for (let repeat = 0; repeat < 3; repeat++) {
    await page.keyboard.press('i');
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('flock-stats-reader')?.getData('bossPrep'));
    await page.keyboard.press('k'); await settleCanvas(page);
    expect((await snapshot(page)).page).toBe(1);
    await page.keyboard.press('j'); await settleCanvas(page);
    expect((await snapshot(page)).page).toBe(0);
    await pressController(page, 5); expect((await snapshot(page)).page).toBe(1);
    await pressController(page, 15); expect((await snapshot(page)).page).toBe(2);
    await page.keyboard.press('Enter'); await pressController(page, 0);
    expect(await snapshot(page)).toMatchObject({ run: before.run, selected: before.selected, open: true, pending: false });
    await page.keyboard.press('p'); await settleCanvas(page);
    await page.keyboard.press('k'); await pressController(page, 5);
    expect((await snapshot(page)).page).toBe(2);
    await page.keyboard.press('p'); await settleCanvas(page);
    await page.keyboard.press('q'); await settleCanvas(page);
    expect((await snapshot(page)).open).toBe(false);
    expect(await listeners()).toEqual(baseline);
    await pressController(page, 3);
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('flock-stats-reader')?.getData('bossPrep'));
    await pressController(page, 1); expect((await snapshot(page)).open).toBe(false);
  }
  expect(await snapshot(page)).toMatchObject({ run: before.run, selected: before.selected, pending: false });
});

test('Boss preparation keeps save failure recovery separate from its name and open action', async ({ page }, info) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await boot(page); await prepare(page);
  await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const set = Storage.prototype.setItem;
    w.restoreBossStorage = () => { Storage.prototype.setItem = set; };
    Storage.prototype.setItem = () => { throw Error('quota'); };
    r.checkpointRouteIfChanged(true); r.renderAll();
  });
  const metrics = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const failure = r.children.getByName('route-checkpoint-feedback').getByName('route-checkpoint-retry-hit').getBounds();
    const name = r.children.getByName('boss-prep-name').getBounds();
    const phase = r.children.getByName('boss-prep-pressure').getBounds();
    const action = r.children.getByName('boss-prep-open').getBounds();
    return { clear: failure.right + 12 <= name.left && failure.right + 12 <= phase.left
      && name.right + 12 <= action.left && phase.right + 12 <= action.left,
      contained: failure.top >= 642 && failure.bottom <= 700 };
  });
  expect(metrics).toEqual({ clear: true, contained: true });
  await page.screenshot({ path: info.outputPath('boss-save-failure.png') });
  await page.evaluate(() => (window as any).restoreBossStorage());
  await click(page, 'route-checkpoint-retry-hit');
  expect(await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return { outcome: r.routeCheckpointState.outcome, nameX: r.children.getByName('boss-prep-name').x,
      feedback: !!r.children.getByName('route-checkpoint-feedback') };
  })).toEqual({ outcome: 'saved', nameX: 110, feedback: false });
});

test('Boss preparation recommends only future reachable stops, not abandoned branches', async ({ page }) => {
  await boot(page); await prepare(page);
  const result = await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene'), map = w.__birdSquadCurrentMap();
    const queue: string[][] = [[map.entryNodeId]];
    let path: string[] | undefined;
    while (queue.length) {
      const candidate = queue.shift()!;
      const edges = map.edges.filter((e: any) => e.from === candidate[candidate.length - 1] && !e.locked);
      if (edges.length === 1 && edges[0].to === map.bossNodeId) { path = candidate; break; }
      for (const e of edges) if (!candidate.includes(e.to)) queue.push([...candidate, e.to]);
    }
    if (!path) throw Error('No final crossing found');
    r.runState.currentRouteNodeId = path[path.length - 1];
    r.runState.completedRouteNodeIds = path;
    r.renderAll();
    return { selectable: r.getSelectableNodes().map((n: any) => n.id), boss: map.bossNodeId,
      unvisited: map.nodes.filter((n: any) => !path!.includes(n.id) && ['market', 'cache', 'basin', 'nest'].includes(n.type)).length,
      useful: r.bossPrepReadiness().usefulNodes };
  });
  expect(result.selectable).toEqual([result.boss]);
  expect(result.unvisited).toBeGreaterThan(0);
  expect(result.useful).toEqual([]);
  await click(page, 'boss-prep-open');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('flock-stats-reader')?.getData('bossPrep'));
  await click(page, 'boss-prep-tab-2');
  expect((await snapshot(page)).summary).toContain('Useful stops: Final crossing');
});

test('Boss preparation keeps long remapped shortcut labels inside their targets', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({
    roost: 'Backspace', previous: 'PageUp', next: 'PageDown', back: 'Delete',
  })));
  await boot(page); await prepare(page);
  await page.keyboard.press('Shift'); await settleCanvas(page);
  expect(await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const label = r.children.getByName('boss-prep-open-label').getBounds();
    const hit = r.children.getByName('boss-prep-open').getBounds();
    return label.left >= hit.left + 6 && label.right <= hit.right - 6;
  })).toBe(true);
  await page.keyboard.press('Backspace');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('flock-stats-reader')?.getData('bossPrep'));
  await page.keyboard.press('PageDown'); await settleCanvas(page);
  expect((await snapshot(page)).page).toBe(1);
  await page.keyboard.press('Delete'); await settleCanvas(page);
  expect((await snapshot(page)).open).toBe(false);
});

test('Boss preparation owns input while loading and late completion never reopens a closed reader', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route(/flock-stats-overlay-.*\.js/, async route => { requested = true; await gate; await route.continue(); });
  try {
    await boot(page); const before = await prepare(page);
    await click(page, 'boss-prep-open');
    await expect.poll(() => requested).toBe(true);
    await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight'); await settleCanvas(page);
    expect(await snapshot(page)).toMatchObject({ run: before.run, selected: before.selected, open: true, pending: false });
    await page.keyboard.press('Escape'); await settleCanvas(page);
    release();
    await page.waitForFunction(() => !!(window as any).__birdSquadGame.scene.getScene('RouteScene').flockStatsOverlayModule);
    expect((await snapshot(page)).open).toBe(false);
    await click(page, 'boss-prep-open');
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('flock-stats-reader')?.getData('bossPrep'));
    await page.keyboard.press('ArrowRight'); await settleCanvas(page);
    expect((await snapshot(page)).page).toBe(1);
  } finally { release(); }
});
