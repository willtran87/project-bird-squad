import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('route tooltips keep readable decisions contained across all nodes', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const w = window as any; w.__routeInputLog = [];
    for (const type of ['keydown', 'mousedown', 'pointerdown']) document.addEventListener(type, (event: any) => {
      w.__routeInputLog.push({ type, key: event.key, x: event.clientX, y: event.clientY, trusted: event.isTrusted });
    }, true);
  });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('RouteScene');
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  for (let mapIndex = 0; mapIndex < 4; mapIndex++) {
    await page.evaluate(mapIndex => {
      const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
      const runState = { ...structuredClone(r.runState), mapIndex, seed: 'route-tooltip-readability', completedRouteNodeIds: [], currentRouteNodeId: undefined };
      w.__birdSquadGame.scene.stop('RouteScene');
      w.__birdSquadGame.scene.start('RouteScene', { runState });
    }, mapIndex);
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt);
    await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      r.runState.districtContracts.forEach((contract: any) => { contract.confirmed = true; });
      r.renderAll();
    });
    await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').cameras.main.fadeEffect.isRunning);
    for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size); await settleCanvas(page);
      const metrics = await page.evaluate(async () => {
        const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
        const before = JSON.stringify(r.runState);
        const results = w.__birdSquadCurrentMap().nodes.map((node: any) => {
          const p = r.nodePosition(node), tip = r.showNodeTooltip(node, p.x, p.y - 40), bounds = tip.getBounds();
          const texts = tip.list.filter((o: any) => o.type === 'Text');
          const frame = tip.getByName('route-node-tooltip-frame').getBounds();
          r.children.list.filter((o: any) => ['first-route-guidance', 'route-decision-dock'].includes(o.name)).forEach((o: any) => o.destroy());
          const selected = r.selectedNodeId;
          r.selectedNodeId = node.id; r.renderFirstRouteGuidance(); r.selectedNodeId = selected;
          const guide = r.children.list.find((o: any) => ['first-route-guidance', 'route-decision-dock'].includes(o.name) && o.type === 'Text');
          const guidePanel = r.children.list.find((o: any) => ['first-route-guidance', 'route-decision-dock'].includes(o.name) && o.type === 'Rectangle').getBounds();
          const gb = guide.getBounds();
          const out = { node: node.id, bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom },
            guideInside: gb.left >= guidePanel.left + 14 && gb.right <= guidePanel.right - 14 && gb.top >= guidePanel.top && gb.bottom <= guidePanel.bottom,
            guideLines: guide.getWrappedText().length,
            labels: texts.map((o: any, i: number) => {
              const b = o.getBounds(), next = texts[i + 1]?.getBounds();
              return { text: o.text, font: Number.parseFloat(o.style.fontSize), name: o.name,
                contained: b.left >= frame.left + 18 && b.right <= frame.right - 18 && b.top >= frame.top + 12 && b.bottom <= frame.bottom - 12,
                separated: !next || b.bottom + 6 <= next.top,
                truncated: o.getData('truncated') };
            }) };
          tip.destroy(true); return out;
        });
        r.renderAll();
        // Collection is lazy-rendered after renderAll, even when cached.
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'boss');
        const p = r.nodePosition(node); (window as any).__routeTip = r.showNodeTooltip(node, p.x, p.y - 40);
        const contract = r.children.getByName('district-contract')?.getBounds();
        const collection = r.children.getByName('route-collection-goal-hit')?.getBounds();
        const collectionPlate = r.children.getByName('route-collection-goal-hit-plate')?.getBounds();
        const collectionLabels = ['kicker', 'label'].map(suffix => r.children.getByName(`route-collection-goal-hit-${suffix}`)).filter(Boolean);
        const collectionReadable = collectionLabels.length === 2 && collectionLabels.every((o: any) => {
          const b = o.getBounds();
          return Number.parseFloat(o.style.fontSize) >= 16 && b.left >= collectionPlate.left + 12
            && b.right <= collectionPlate.right - 8 && b.top >= collectionPlate.top && b.bottom <= collectionPlate.bottom;
        });
        const restoration = r.children.list.filter((o: any) => o.name === 'flyway-restoration');
        const restorationContained = restoration.every((o: any) => {
          const b = o.getBounds();
          return b.left >= 84 && b.right <= 336 && b.top >= 590 && b.bottom <= 630 && !o.input?.enabled;
        });
        const restorationLabels = restoration.filter((o: any) => o.type === 'Text');
        const contractLabels = ['district-contract-title', 'district-contract-goal'].map(name => r.children.getByName(name)).filter(Boolean);
        const contractInside = contractLabels.every((o: any) => {
          const b = o.getBounds();
          return b.left >= contract.left + 14 && b.right <= contract.right - 14 && b.top >= contract.top && b.bottom <= contract.bottom;
        });
        return { results, unchanged: JSON.stringify(r.runState) === before, contractInside, collectionReadable,
          collectionGeometry: { plate: collectionPlate, labels: collectionLabels.map((o: any) => ({ text: o.text, bounds: o.getBounds(), font: o.style.fontSize })) },
          restorationContained, restorationLabels: restorationLabels.map((o: any) => ({ text: o.text, font: o.style.fontSize })),
          contractOverlapsCollection: Boolean(contract && collection && contract.left < collection.right && contract.right > collection.left && contract.top < collection.bottom && contract.bottom > collection.top) };
      });
      await settleCanvas(page);
      // A late lazy-module render can retire a manually opened tooltip. Restore
      // only after display sizing has settled, then require an active render root.
      await page.evaluate(() => {
        const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
        w.__routeTip?.destroy(true);
        const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'boss'), p = r.nodePosition(node);
        w.__routeTip = r.showNodeTooltip(node, p.x, p.y - 40);
      });
      await page.waitForFunction(() => (window as any).__routeTip?.active);
      await page.screenshot({ path: info.outputPath(`boss-tooltip-${mapIndex}-${size.width}.png`) });
      expect(metrics.unchanged).toBe(true);
      expect(metrics.contractInside).toBe(true);
      expect(metrics.contractOverlapsCollection).toBe(false);
      expect(metrics.collectionReadable, JSON.stringify(metrics.collectionGeometry)).toBe(true);
      expect(metrics.restorationContained).toBe(true);
      expect(metrics.restorationLabels).toHaveLength(mapIndex > 0 ? 1 : 0);
      if (mapIndex > 0) expect(metrics.restorationLabels[0]).toEqual({ text: `FLYWAY  ${mapIndex}/4 RESTORED`, font: '16px' });
      for (const result of metrics.results) {
        expect(result.bounds.left, result.node).toBeGreaterThanOrEqual(12);
        expect(result.bounds.right, result.node).toBeLessThanOrEqual(1268);
        expect(result.bounds.top, result.node).toBeGreaterThanOrEqual(100);
        expect(result.bounds.bottom, result.node).toBeLessThanOrEqual(624);
        expect(result.guideInside, result.node).toBe(true);
        expect(result.guideLines, result.node).toBeLessThanOrEqual(2);
        result.labels.forEach((label: any) => {
          expect(label.font, `${result.node}: ${label.text}`).toBeGreaterThanOrEqual(18);
          expect(label.contained, `${result.node}: ${label.text}`).toBe(true);
          expect(label.separated, `${result.node}: ${label.text}`).toBe(true);
          if (label.name !== 'route-node-title') expect(label.truncated, `${result.node}: ${label.text}`).toBe(false);
        });
      }
      await page.evaluate(() => (window as any).__routeTip.destroy(true));
    }
    const hover = await page.evaluate(() => {
      const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
      const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'boss'), p = r.nodePosition(node), c = r.game.canvas.getBoundingClientRect();
      return { x: c.left + p.x * c.width / 1280, y: c.top + p.y * c.height / 720,
        listeners: r.input.listenerCount('gameout'),
        before: JSON.stringify({ run: r.runState, selected: r.selectedNodeId }) };
    });
    await page.mouse.move(hover.x, hover.y);
    await expect.poll(() => page.evaluate(() => {
      const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene'), p = r.input.activePointer;
      return { tooltip: Boolean(r.children.getByName('route-node-tooltip')?.active), active: r.scene.isActive(),
        mode: JSON.parse(w.render_game_to_text()).mode, events: w.__routeInputLog,
        pointer: { x: p.x, y: p.y, down: p.isDown },
        hits: r.input.hitTestPointer(p).map((o: any) => o.name) };
    }), { timeout: 5000 }).toMatchObject({ tooltip: true, active: true });
    await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`real-hover-${mapIndex}-1000.png`) });
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-node-tooltip'), undefined, { timeout: 5000 });
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').input.listenerCount('gameout'))).toBe(hover.listeners);
    expect(await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      return JSON.stringify({ run: r.runState, selected: r.selectedNodeId });
    })).toBe(hover.before);
  }
  expect(errors).toEqual([]);
});
