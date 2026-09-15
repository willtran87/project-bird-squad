import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { flockLeaders } from '../src/game/leaders';

test('event choices retain readable text, marked omissions and safe review', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  // Random opening seeds need not contain every event type. Use the real
  // generator to select a reproducible five-surface fixture, without skipping one.
  const fixtureSeed = await page.evaluate(async deckIds => {
    const w = window as any;
    const [blueprints, generate, hash] = w.__routeAudit;
    for (let i = 0; i < 100; i++) {
      const seed = `event-clarity-${i}`, nodes = generate(blueprints[0], hash(seed, 0)).nodes;
      if (['basin', 'nest', 'signal', 'cache', 'rival'].every(type => nodes.some((n: any) => n.type === type))) {
        await w.__birdSquadEnsureScene('RouteScene');
        for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
        w.__birdSquadGame.scene.start('RouteScene', { runState: {
          seed, deck: deckIds.map(id => ({ id })), leaderId: 'fledgling', currentHp: 38,
          scrap: 40, completedRouteNodeIds: [], routeLog: [],
        } });
        return seed;
      }
    }
    throw new Error('No complete event-clarity fixture found in 100 deterministic seeds');
  }, flockLeaders.find(leader => leader.id === 'fledgling')!.startingDeckIds);
  await page.waitForFunction(seed => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.runState.seed === seed && r.routeEssentialAssetsReady;
  }, fixtureSeed);
  const settle = async () => {
    const f = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame);
    await page.waitForFunction(f => (window as any).__birdSquadGame.loop.frame >= f + 2, f);
  };
  for (const type of ['basin', 'nest', 'signal', 'cache', 'rival']) {
    const found = await page.evaluate(type => {
      const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
      const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === type);
      if (!node) return false;
      r.openNodeChoices(node); return true;
    }, type);
    expect(found).toBe(true);
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport); await settle();
      await settleCanvas(page);
      const rows = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
        const titles = r.children.list.filter((o: any) => o.name === 'route-choice-title');
        const summaries = r.children.list.filter((o: any) => o.name === 'route-choice-summary');
        const frames = r.children.list.filter((o: any) => o.name === 'route-choice-option-frame');
        return frames.map((o: any, i: number) => {
          const frame = o.getBounds(), title = titles[i], summary = summaries[i];
          const contains = (b: any) => b.left >= frame.left && b.right <= frame.right && b.top >= frame.top && b.bottom <= frame.bottom;
          return { fits: contains(title.getBounds()) && contains(summary.getBounds()),
            separation: summary.getBounds().top - title.getBounds().bottom,
            titleSize: title.style.fontSize, summarySize: summary.style.fontSize,
            marked: [title, summary].every((t: any) => t.text === t.getData('fullText') || t.text.endsWith('…')),
            inStage: frame.left >= 0 && frame.right <= 1280 && frame.top > 80 && frame.bottom <= 720,
          };
        });
      });
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.fits).toBe(true); expect(row.inStage).toBe(true); expect(row.marked).toBe(true);
        expect(row.separation).toBeGreaterThanOrEqual(1);
        expect(row.titleSize).toBe('18px'); expect(row.summarySize).toBe('16px');
      }
      await page.screenshot({ path: info.outputPath(`${type}-${viewport.width}.png`) });
    }
  }
  // A real pointer choice opens the review; only its separate Claim can spend.
  const reviewStart = await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    r.openNodeChoices(w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'cache'));
    const tile = r.children.list.find((o: any) => o.name === 'route-choice-option-frame' && o.listenerCount('pointerdown'));
    return { key: tile.getData('choiceKey'), run: JSON.stringify(r.runState) };
  });
  await settle();
  const point = await page.evaluate(key => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    const tile = r.children.list.find((o: any) => o.name === 'route-choice-option-frame' && o.getData('choiceKey') === key);
    const b = tile.getBounds(), c = r.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, reviewStart.key);
  await page.mouse.click(point.x, point.y, { delay: 40 });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('RouteScene').pendingRouteReward));
  expect(await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState))).toBe(reviewStart.run);
  // Long/locked text exercises the same tile renderer without applying effects.
  const stress = await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'signal');
    r.children.removeAll(true);
    r.renderRouteEventChoiceTile(node, { key: 'locked-stress', text: 'A very long title '.repeat(12), locked: true,
      lockedText: 'Requires a complete flight and enough Scrap to repair the rooftop signal station.', effects: [] }, 640, 360, 472, 72, 0, 0xd5b775);
    const frame = r.children.getByName('route-choice-option-frame');
    return { handlers: frame.listenerCount('pointerdown'), overflow: frame.getData('hasOverflowDetail'),
      titles: r.children.list.filter((o: any) => ['route-choice-title', 'route-choice-summary'].includes(o.name)).map((o: any) => o.text) };
  });
  expect(stress.handlers).toBe(0); expect(stress.overflow).toBe(true);
  expect(stress.titles[0]).toMatch(/…$/);
  expect(errors).toEqual([]);
});
