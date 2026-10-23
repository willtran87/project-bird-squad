import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });

test('route state shapes distinguish current, completed, selected, available and future across districts', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('RouteScene');
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  for (let mapIndex = 0; mapIndex < 4; mapIndex++) {
    await page.evaluate(mapIndex => {
      const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
      const runState = { ...structuredClone(r.runState), mapIndex, currentRouteNodeId: undefined, completedRouteNodeIds: [] };
      w.__birdSquadGame.scene.stop('RouteScene');
      w.__birdSquadGame.scene.start('RouteScene', { runState });
    }, mapIndex);
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt);
    const before = await page.evaluate(() => {
      const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene'), map = w.__birdSquadCurrentMap();
      // Follow a real graph path to a branching junction, rather than fabricating
      // incompatible current/completed/available flags in the renderer.
      const queue = [[map.entryNodeId]];
      let path: string[] | undefined;
      while (queue.length) {
        const candidate = queue.shift()!;
        const edges = map.edges.filter((e: any) => e.from === candidate[candidate.length - 1] && !e.locked);
        if (candidate.length > 1 && edges.length > 1) { path = candidate; break; }
        for (const edge of edges) if (!candidate.includes(edge.to)) queue.push([...candidate, edge.to]);
      }
      if (!path) throw new Error('Expected a reachable branching junction');
      r.runState.currentRouteNodeId = path[path.length - 1];
      r.runState.completedRouteNodeIds = path;
      r.runState.districtContracts.forEach((c: any) => { c.confirmed = true; });
      r.selectableNodeIds = new Set(r.getSelectableNodes().map((n: any) => n.id));
      r.selectedNodeId = [...r.selectableNodeIds][0];
      r.renderAll();
      return JSON.stringify(r.runState);
    });
    for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size); await settleCanvas(page);
      const metrics = await page.evaluate(() => {
        const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
        const objects = r.children.list, canvas = r.game.canvas.getBoundingClientRect();
        const icons = objects.filter((o: any) => o.name === 'route-node-icon');
        const labels = objects.filter((o: any) => ['route-node-current-label', 'route-node-selected-label'].includes(o.name) && o.type === 'Text');
        return {
          states: [...new Set(icons.map((o: any) => o.getData('routeNodeState')))].sort(),
          current: icons.find((o: any) => o.getData('routeNodeState') === 'current')?.getData('routeNodeId'),
          actualCurrent: r.runState.currentRouteNodeId,
          checks: objects.filter((o: any) => o.name === 'route-node-completed-check').length,
          completed: r.runState.completedRouteNodeIds.length,
          arrows: objects.filter((o: any) => o.name === 'route-edge-direction').length,
          rings: objects.filter((o: any) => o.name === 'route-node-selectable-backplate').length,
          labels: labels.map((o: any) => {
            const b = o.getBounds(), plate = objects.find((p: any) => p.name === o.name && p.type === 'Rectangle').getBounds();
            return { text: o.text, font: parseFloat(o.style.fontSize) * canvas.height / 720,
              contained: b.left >= plate.left + 6 && b.right <= plate.right - 6 && b.top >= plate.top && b.bottom <= plate.bottom,
              clear: icons.every((icon: any) => { const h = icon.getBounds(); return b.right <= h.left || b.left >= h.right || b.bottom <= h.top || b.top >= h.bottom; }) };
          }),
          commitFont: parseFloat(objects.find((o: any) => o.name === 'route-commit-label' && o.type === 'Text').style.fontSize) * canvas.height / 720,
        };
      });
      expect(metrics.states).toEqual(['completed', 'current', 'future', 'selectable', 'selected']);
      expect(metrics.current).toBe(metrics.actualCurrent);
      expect(metrics.checks).toBe(metrics.completed);
      expect(metrics.arrows).toBeGreaterThan(0);
      expect(metrics.rings).toBeGreaterThan(0);
      expect(metrics.labels.map(l => l.text).sort()).toEqual(['Here', 'Selected']);
      for (const label of metrics.labels) {
        expect(label.contained, label.text).toBe(true);
        expect(label.clear, label.text).toBe(true);
        expect(label.font).toBeGreaterThanOrEqual(16);
      }
      expect(metrics.commitFont).toBeGreaterThanOrEqual(16);
      await page.screenshot({ path: info.outputPath(`route-states-${mapIndex}-${size.width}.png`) });
    }
    for (const input of ['pointer', 'touch', 'keyboard']) {
      const target = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
        const hit = r.children.list.find((o: any) => o.name === 'route-node-hit'
          && o.getData('routeNodeState') === 'selectable');
        const b = hit.getBounds(), c = r.game.canvas.getBoundingClientRect();
        return { id: hit.getData('routeNodeId'), x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
      });
      if (input === 'touch') await page.touchscreen.tap(target.x, target.y);
      else if (input === 'pointer') await page.mouse.click(target.x, target.y);
      else await page.keyboard.press('ArrowRight');
      await settleCanvas(page);
      const summary = await page.evaluate(() => {
        const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
        const summaries = r.children.list.filter((o: any) => o.type === 'Text'
          && ['first-route-guidance', 'route-decision-dock'].includes(o.name));
        const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.id === r.selectedNodeId);
        const decision = r.nodeDecisionSummary(node);
        return { selected: r.selectedNodeId, count: summaries.length, text: summaries[0]?.text,
          expected: `GAIN  ${decision.benefit}\nRISK  ${decision.risk}`, state: JSON.stringify(r.runState) };
      });
      if (input !== 'keyboard') expect(summary.selected).toBe(target.id);
      expect(summary.count).toBe(1);
      expect(summary.text).toBe(summary.expected);
      expect(summary.state).toBe(before);
    }
    // Replacing an inspected node must retire its root and its GAME_OUT listener.
    const tips = await page.evaluate(() => {
      const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
      const count = r.input.listenerCount('gameout');
      let previous: any, retired = true;
      for (const node of w.__birdSquadCurrentMap().nodes) {
        const p = r.nodePosition(node), next = r.showNodeTooltip(node, p.x, p.y - 40);
        if (previous?.active) retired = false;
        previous = next;
      }
      const roots = r.children.list.filter((o: any) => o.name === 'route-node-tooltip').length;
      const activeListeners = r.input.listenerCount('gameout') - count;
      previous.destroy(true);
      return { retired, roots, activeListeners, after: r.input.listenerCount('gameout') - count, state: JSON.stringify(r.runState) };
    });
    expect(tips).toEqual({ retired: true, roots: 1, activeListeners: 1, after: 0, state: before });
  }
  expect(errors).toEqual([]);
});
