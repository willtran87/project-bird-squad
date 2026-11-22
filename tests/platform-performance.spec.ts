import { test, expect, type Page } from '@playwright/test';

// Frame-time probe for the route and combat scenes at 1280x720.
//
// Method: after the scene is idle, sample N requestAnimationFrame deltas (what
// the player sees, quantised to the vsync grid) and, separately, the CPU time
// Phaser spends inside SceneManager.update and SceneManager.render per frame.
// Headless Chromium renders WebGL through SwiftShader (software), so absolute
// numbers are far worse than on a GPU; compare runs on the same machine only.
// Counts of Text re-measurements and Graphics clears per idle frame are
// deterministic and are what the assertions pin.

type Profile = {
  frames: number;
  meanFrameMs: number;
  p95FrameMs: number;
  updateMs: number;
  renderMs: number;
  textUpdatesPerFrame: number;
  graphicsClearsPerFrame: number;
  topText: [string, number][];
  topGraphics: [string, number][];
};

async function profile(page: Page, sceneKey: string, frames = 120): Promise<Profile> {
  return page.evaluate(async ({ sceneKey, frames }) => {
    const w = window as any;
    const game = w.__birdSquadGame;
    const scene = game.scene.getScene(sceneKey);
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [child, ...(Array.isArray(child.list) ? collect(child.list) : [])]);
    const all = collect(scene.children.list);
    const textProto = Object.getPrototypeOf(all.find((child: any) => child.type === 'Text'));
    const probe = scene.make.graphics({}, false);
    const graphicsProto = Object.getPrototypeOf(probe);
    probe.destroy();
    const label = (object: any) => object.name || object.parentContainer?.name || `${object.type}@${object.scene?.scene?.key ?? '?'}`;
    const textCounts = new Map<string, number>();
    const graphicsCounts = new Map<string, number>();
    let textUpdates = 0;
    let graphicsClears = 0;
    const updateText = textProto.updateText;
    const clear = graphicsProto.clear;
    textProto.updateText = function (...args: unknown[]) {
      textUpdates += 1;
      const key = label(this);
      textCounts.set(key, (textCounts.get(key) ?? 0) + 1);
      return updateText.apply(this, args);
    };
    graphicsProto.clear = function (...args: unknown[]) {
      graphicsClears += 1;
      const key = label(this);
      graphicsCounts.set(key, (graphicsCounts.get(key) ?? 0) + 1);
      return clear.apply(this, args);
    };
    const manager = game.scene;
    const update = manager.update;
    const render = manager.render;
    let updateMs = 0;
    let renderMs = 0;
    manager.update = function (...args: unknown[]) {
      const start = performance.now();
      try { return update.apply(this, args); } finally { updateMs += performance.now() - start; }
    };
    manager.render = function (...args: unknown[]) {
      const start = performance.now();
      try { return render.apply(this, args); } finally { renderMs += performance.now() - start; }
    };
    const deltas: number[] = [];
    try {
      // Warm-up frames are not counted.
      for (let i = 0; i < 10; i += 1) await new Promise(requestAnimationFrame);
      textUpdates = 0; graphicsClears = 0; updateMs = 0; renderMs = 0;
      textCounts.clear(); graphicsCounts.clear();
      let last = performance.now();
      for (let i = 0; i < frames; i += 1) {
        const now = await new Promise<number>(requestAnimationFrame);
        deltas.push(now - last);
        last = now;
      }
    } finally {
      textProto.updateText = updateText;
      graphicsProto.clear = clear;
      manager.update = update;
      manager.render = render;
    }
    const sorted = [...deltas].sort((a, b) => a - b);
    const round = (value: number) => Math.round(value * 10) / 10;
    const top = (counts: Map<string, number>) => [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([key, count]) => [key, round(count / frames)] as [string, number]);
    return {
      frames,
      meanFrameMs: round(deltas.reduce((sum, value) => sum + value, 0) / deltas.length),
      p95FrameMs: round(sorted[Math.floor(sorted.length * 0.95)]),
      updateMs: round(updateMs / frames),
      renderMs: round(renderMs / frames),
      textUpdatesPerFrame: round(textUpdates / frames),
      graphicsClearsPerFrame: round(graphicsClears / frames),
      topText: top(textCounts),
      topGraphics: top(graphicsCounts),
    };
  }, { sceneKey, frames });
}

async function frames(page: Page, count = 3) {
  const start = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame);
  await page.waitForFunction(({ start, count }) => (window as any).__birdSquadGame.loop.frame >= start + count, { start, count });
}

async function openTitle(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./?flight=platform-performance');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
}

test('route and combat idle frames do no per-frame text re-measurement and report frame time', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openTitle(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
  await page.evaluate(() => {
    const w = window as any, route = w.__birdSquadGame.scene.getScene('RouteScene');
    route.events.emit('spectacle-skip-arrival');
    w.advanceTime(400);
  });
  await frames(page, 20);
  const route = await profile(page, 'RouteScene');

  await page.evaluate(async () => {
    const w = window as any, game = w.__birdSquadGame;
    await w.__birdSquadEnsureScene('BattleScene');
    game.scene.stop('RouteScene');
    game.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const s = JSON.parse((window as any).render_game_to_text?.() ?? '{}');
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return s.scene === 'BattleScene' && s.assetReadiness?.fullArt && !s.combatIntro?.active && !s.combatAnimationPending
      && b.battleActors && b.battleHandRendererModule && b.handCardRects.size === b.hand.length && !b.battleRenderQueued;
  }, undefined, { timeout: 60_000 });
  // Let the opening deal land so the sample is an idle player turn.
  await page.evaluate(() => (window as any).advanceTime(900));
  await frames(page, 20);
  const combat = await profile(page, 'BattleScene');

  const report = { viewport: '1280x720', renderer: await page.evaluate(() => (window as any).__birdSquadGame.renderer.type === 2 ? 'WebGL' : 'Canvas'), route, combat };
  console.log(`platform-performance ${JSON.stringify(report)}`);
  await info.attach('frame-time.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });

  expect(route.frames).toBe(120);
  expect(combat.frames).toBe(120);
  // An idle scene must not re-measure text every frame: a canvas text upload is
  // a full texture re-upload. Single digits per frame are allowed for live
  // counters; anything near the object count means a redraw loop.
  expect(route.textUpdatesPerFrame, JSON.stringify(route.topText)).toBeLessThanOrEqual(2);
  expect(combat.textUpdatesPerFrame, JSON.stringify(combat.topText)).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});
