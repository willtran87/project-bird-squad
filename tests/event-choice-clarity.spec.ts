import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import {targetGeometry,checkTargetGeometry} from './helpers/target-geometry';
import { flockLeaders } from '../src/game/leaders';

test.use({ hasTouch: true });

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
    await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('RouteScene')
      .children.getByName('route-event-resident-art')?.texture?.source[0]?.image?.complete));
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport); await settle();
      await settleCanvas(page);
      const header = await page.evaluate(() => {
        const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
        const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.id === r.nodeChoiceNodeId);
        const frame = r.children.getByName('route-event-title-plaque').getBounds();
        const labels = ['route-event-resident-name', 'route-event-resident-role', 'route-event-context']
          .map(name => r.children.getByName(name));
        const scale = r.game.canvas.getBoundingClientRect().width / 1280;
        return { labels: labels.map((o: any) => ({ text: o.text, font: parseFloat(o.style.fontSize) * scale,
          inside: o.getBounds().left >= frame.left + 12 && o.getBounds().right <= frame.right - 12
            && o.getBounds().top >= frame.top + 8 && o.getBounds().bottom <= frame.bottom - 8 })),
          context: r.eventNarrativeContext(node),
          separated: labels[0].getBounds().bottom + 2 <= labels[1].getBounds().top
            && labels[0].getBounds().right + 16 <= labels[2].getBounds().left,
          decorativeStreaks: r.children.list.filter((o: any) => o.type === 'Rectangle' && o.blendMode === 1 && o.height <= 4).length };
      });
      expect(header.labels[2].text).toBe(header.context);
      expect(header.labels.every((label: any) => label.inside && label.font >= 14), JSON.stringify(header)).toBe(true);
      expect(header.labels[0].font).toBeGreaterThanOrEqual(16);
      expect(header.separated).toBe(true);
      expect(header.decorativeStreaks).toBe(0);
      const rows = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
        const titles = r.children.list.filter((o: any) => o.name === 'route-choice-title');
        const summaries = r.children.list.filter((o: any) => o.name === 'route-choice-summary');
        const frames = r.children.list.filter((o: any) => o.name === 'route-choice-option-frame');
        const readers = r.children.list.filter((o: any) => o.name === 'route-event-details-hit');
        const scale = r.game.canvas.getBoundingClientRect().width / 1280;
        return frames.map((o: any, i: number) => {
          const frame = o.getBounds(), title = titles[i], summary = summaries[i];
          const reader = readers[i], label = reader.getData('labelObject');
          const contains = (b: any) => b.left >= frame.left && b.right <= frame.right && b.top >= frame.top && b.bottom <= frame.bottom;
          return { fits: contains(title.getBounds()) && contains(summary.getBounds()),
            readFits: contains(reader.getBounds()) && contains(label.getBounds())
              && label.getWrappedText().length === 1 && label.text === 'Read'
              && Math.max(title.getBounds().right, summary.getBounds().right) + 8 <= reader.getBounds().left,
            separation: summary.getBounds().top - title.getBounds().bottom,
            titleSize: title.style.fontSize, summarySize: summary.style.fontSize,
            readable: parseFloat(title.style.fontSize) * scale >= 16 && parseFloat(summary.style.fontSize) * scale >= 14,
            marked: [title, summary].every((t: any) => t.text === t.getData('fullText') || t.text.endsWith('…')),
            inStage: frame.left >= 0 && frame.right <= 1280 && frame.top > 80 && frame.bottom <= 720,
          };
        });
      });
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.fits).toBe(true); expect(row.inStage).toBe(true); expect(row.marked).toBe(true);
        expect(row.readFits).toBe(true);
        expect(row.separation).toBeGreaterThanOrEqual(1);
        expect(row.titleSize).toBe('21px'); expect(row.summarySize).toBe('19px');
        expect(row.readable).toBe(true);
      }
      const staging = await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
        const art = r.children.getByName('route-event-resident-art'), bounds = art.getBounds();
        const panel = r.children.getByName('route-choice-decision-frame').getBounds();
        const shadow = r.children.list.find((o: any) => o.type === 'Ellipse'
          && Math.abs(o.x - art.x) < 1 && Math.abs(o.y - (art.y - 18)) < 1);
        const title = r.children.getByName('route-event-title-plaque').getBounds();
        return { uniform: Math.abs(art.scaleX - art.scaleY) < 0.0001,
          visible: bounds.left >= 0 && bounds.right <= 1280 && bounds.top >= 80 && bounds.bottom <= 720,
          grounded: Boolean(shadow && shadow.getBounds().bottom >= bounds.bottom - 4),
          clear: bounds.right + 8 <= panel.left && title.bottom + 8 <= panel.top,
          height: bounds.height, source: art.texture.key };
      });
      expect(staging, type).toMatchObject({ uniform: true, visible: true, grounded: true, clear: true });
      expect(staging.height).toBeGreaterThan(200);
      await settleCanvas(page);
      checkTargetGeometry(await targetGeometry(page,'RouteScene'),`event ${type}`);
      await page.screenshot({ path: info.outputPath(`${type}-${viewport.width}.png`) });
    }
    const missingArt = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      const before = JSON.stringify(r.runState);
      const choices = () => r.children.list.filter((o: any) => o.name === 'route-choice-option-frame')
        .map((o: any) => ({ key: o.getData('choiceKey'), bounds: o.getBounds() }));
      const baseline = JSON.stringify(choices());
      r.savedEventTextureExists = r.textures.exists;
      r.textures.exists = function(key: string) {
        return !key.startsWith('route-event-prop-') && r.savedEventTextureExists.call(this, key);
      };
      r.renderAll();
      return { unchanged: JSON.stringify(r.runState) === before,
        stableChoices: JSON.stringify(choices()) === baseline,
        props: r.children.list.filter((o: any) => o.texture?.key?.startsWith('route-event-prop-')).length,
        substitutes: r.children.list.filter((o: any) => o.type === 'Text'
          && /HEARTH SERVICE|DECK BENCH|SWITCHBOARD ROUTE MAP|WIRE PATHS ACTIVE/.test(o.text)).length };
    });
    try {
      expect(missingArt).toEqual({ unchanged: true, stableChoices: true, props: 0, substitutes: 0 });
      await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`${type}-missing-prop-1000.png`) });
    } finally {
      await page.evaluate(() => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
        r.textures.exists = r.savedEventTextureExists; delete r.savedEventTextureExists; r.renderAll();
      });
    }
    const touch = await page.evaluate(() => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      const b = r.children.getByName('route-event-details-hit').getBounds(), c = r.game.canvas.getBoundingClientRect();
      return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720, run: JSON.stringify(r.runState) };
    });
    await page.touchscreen.tap(touch.x, touch.y);
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-event-reader'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-event-reader'));
    expect(await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState))).toBe(touch.run);
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
