import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });

async function fixture(page: Page, comparison: boolean) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
    w.__birdSquadGame.scene.stop('MenuScene'); w.__birdSquadGame.scene.start('RouteScene');
  });
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).assetReadiness?.fullArt);
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.runState.districtContracts.forEach((c: any) => c.confirmed = true); r.openDeckOverlay();
    r.ensureCardComparisonModule();
  });
  await page.waitForFunction(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return r.routeDeckBrowserModule && r.cardHoverDetailModule && r.cardComparisonModule && !r.load.isLoading();
  });
  await settleCanvas(page);
  return page.evaluate(comparison => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const card = r.mapDeckCards()[0].card, view = r.routeCardComparisonView(card, 'Deck');
    r.closeDeckOverlay();
    for (const key of new Set([view.portraitAsset.key, view.artKey])) if (key && r.textures.exists(key)) r.textures.remove(key);
    // Suppress the already-tested compact fallback to exercise the reserved empty slot.
    const originalView = r.routeCardComparisonView.bind(r);
    r.routeCardComparisonView = (...args: any[]) => ({ ...originalView(...args), artKey: undefined });
    w.deckArtFixture = { id: card.id, asset: view.portraitAsset, comparison };
    return view.portraitAsset;
  }, comparison);
}

async function open(page: Page, comparison: boolean) {
  await page.evaluate(comparison => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    r.openDeckOverlay();
    if (comparison) r.toggleDeckReviewComparison(w.deckArtFixture.id);
  }, comparison);
  await settleCanvas(page);
}

const prefix = (comparison: boolean) => `deck-review-${comparison ? 'comparison' : 'detail'}`;
async function snapshot(page: Page, comparison: boolean, remember = false) {
  return page.evaluate(({ prefix, comparison, remember }) => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene');
    const panel = r.children.getByName(`${prefix}-panel`), next = r.children.getByName(`${prefix}-next`);
    const slots = comparison ? [0, 1].map(i => r.children.getByName(`${prefix}-art-${i}`)) : [r.children.getByName(`${prefix}-art`)];
    if (remember) w.deckArtBefore = { panel, next, slots };
    return { samePanel: panel === w.deckArtBefore?.panel, sameNext: next === w.deckArtBefore?.next,
      sameSlots: slots.every((s: any, i: number) => s === w.deckArtBefore?.slots[i]),
      reading: panel.getData('reading'), run: JSON.stringify(r.runState),
      slots: slots.map((s: any) => {
        const b = s.getBounds(), image = r.children.getByName(`${s.name}-image`), ib = image?.getBounds();
        return { state: s.getData('artState'), x: b.x, y: b.y, width: b.width, height: b.height,
          contained: !ib || (ib.left >= b.left - 0.1 && ib.right <= b.right + 0.1 && ib.top >= b.top - 0.1 && ib.bottom <= b.bottom + 0.1),
          proportional: !image || Math.abs(image.scaleX - image.scaleY) < 0.001 };
      }) };
  }, { prefix: prefix(comparison), comparison, remember });
}

for (const comparison of [false, true]) for (const failed of [false, true]) {
  test(`deck ${comparison ? 'comparison' : 'detail'} preserves art slots and reading controls during ${failed ? 'failed' : 'delayed'} portraits`, async ({ page }, info) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    const asset = await fixture(page, comparison);
    let release!: () => void, requests = 0;
    const gate = new Promise<void>(resolve => release = resolve);
    await page.route(new URL(asset.url, page.url()).href, async route => {
      requests++; await gate;
      if (failed) await route.abort('failed'); else await route.continue();
    });
    try {
      await open(page, comparison);
      await page.keyboard.press('PageDown'); await settleCanvas(page);
      const before = await snapshot(page, comparison, true);
      expect(before.slots.every(s => s.state === 'loading')).toBe(true);
      await page.screenshot({ path: info.outputPath('loading-2560.png') });
      release();
      await expect.poll(async () => (await snapshot(page, comparison)).slots.map(s => s.state)).toEqual(before.slots.map(() => failed ? 'unavailable' : 'ready'));
      const after = await snapshot(page, comparison);
      expect(after.samePanel && after.sameNext && after.sameSlots).toBe(true);
      expect(after.reading).toEqual(before.reading); expect(after.run).toBe(before.run);
      expect(after.slots.map(({ state, ...s }) => s)).toEqual(before.slots.map(({ state, ...s }) => s));
      // Failure must settle; no render/request feedback loop after built-in retries.
      const completedRequests = requests; await page.waitForTimeout(700);
      expect(requests).toBe(completedRequests); expect(requests).toBeLessThanOrEqual(3);
      for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
        await page.setViewportSize({ width, height }); await settleCanvas(page);
        await page.screenshot({ path: info.outputPath(`settled-${width}.png`) });
      }
      const point = await page.evaluate(prefix => {
        const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), b = r.children.getByName(`${prefix}-next`).getBounds(), c = r.game.canvas.getBoundingClientRect();
        return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
      }, prefix(comparison));
      await page.touchscreen.tap(point.x, point.y); await settleCanvas(page);
      expect((await snapshot(page, comparison)).reading.page).toBe(after.reading.page + 1);
      await page.keyboard.press('Escape'); await settleCanvas(page);
      expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').deckOverlayOpen)).toBe(false);
      if (failed) {
        await page.unrouteAll({ behavior: 'wait' });
        await open(page, comparison);
        await expect.poll(async () => (await snapshot(page, comparison)).slots.map(s => s.state)).toEqual(before.slots.map(() => 'ready'));
      }
      expect(errors).toEqual([]);
    } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
  });
}

test('late deck portrait cannot resurrect a closed reader', async ({ page }) => {
  const asset = await fixture(page, false);
  let release!: () => void; const gate = new Promise<void>(resolve => release = resolve);
  await page.route(new URL(asset.url, page.url()).href, async route => { await gate; await route.continue(); });
  try {
    await open(page, false);
    await page.keyboard.press('Escape'); await settleCanvas(page);
    release();
    await page.waitForFunction(key => (window as any).__birdSquadGame.textures.exists(key), asset.key);
    await settleCanvas(page);
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.list.filter((c: any) => c.name.startsWith('deck-review-detail')).length)).toBe(0);
    await open(page, false);
    expect((await snapshot(page, false)).slots[0].state).toBe('ready');
  } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
});

for (const comparison of [false, true]) test(`deck ${comparison ? 'comparison' : 'detail'} keeps long rules readable and modal-owned`, async ({ page }, info) => {
  await fixture(page, comparison);
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), original = r.routeCardComparisonView.bind(r);
    r.routeCardComparisonView = (...args: any[]) => ({ ...original(...args),
      name: 'Very long named streetwise flock member with a complete identity END NAME',
      currentText: 'Draw 1. '.repeat(90) + 'END RULES',
      stats: ['Gain 1 Cover. '.repeat(55) + 'END BONUSES'],
    });
  });
  await open(page, comparison);
  if (comparison) await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.inspectDeckCard(r.mapDeckCards()[1].card.id);
  });
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    const result = await page.evaluate(prefix => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), p = r.children.getByName(`${prefix}-panel`);
      const contents: string[] = [], failures: any[] = [], sections: Record<string, string[]> = {}, scale = r.game.canvas.getBoundingClientRect().width / 1280;
      const change = p.getData('changePage'); change(-999);
      const count = p.getData('reading').total;
      for (let i = 0; i < count; i++) {
        const reading = p.getData('reading');
        contents.push([reading.text, ...(reading.bodies ?? [])].filter(Boolean).join(' '));
        (reading.bodies ?? [reading.text]).forEach((body: string, column: number) => {
          const key = `${reading.title ?? reading.headings[column]}:${column}`;
          (sections[key] ??= []).push(body);
        });
        const outer = p.getBounds();
        // Only this reader's display-list entries, not map labels behind its opaque curtain.
        for (const o of r.children.list.slice(r.children.list.indexOf(p) + 1)) {
          if (o.type !== 'Text' || !o.text || o.x < outer.left || o.x > outer.right || o.y < outer.top || o.y > outer.bottom) continue;
          const b = o.getBounds(), css = parseFloat(o.style.fontSize) * scale;
          const primary = o.name.includes('-body') || o.name.includes('-title');
          if (b.left < outer.left || b.right > outer.right || b.bottom > outer.bottom || css < (primary ? 16 : 14)
            || (o.name.includes('-body') && b.bottom > (prefix.includes('comparison') ? 502 : 528))) failures.push({ text: o.text, bounds: b, css });
        }
        change(1);
      }
      change(-999);
      return { contents: contents.join(' ').replace(/\s+/g, ' '), sections: Object.fromEntries(Object.entries(sections).map(([key, values]) => [key, values.join(' ').replace(/\s+/g, ' ')])), failures, count };
    }, prefix(comparison));
    expect(result.count).toBeGreaterThan(10);
    expect(result.contents).toContain('END RULES'); expect(result.contents).toContain('END BONUSES'); expect(result.contents).toContain('END NAME');
    expect(result.sections['NOW:0']).toBe('Draw 1. '.repeat(90) + 'END RULES');
    expect(result.sections['PASSIVE FLOCK BONUSES:0']).toBe('Gain 1 Cover. '.repeat(55) + 'END BONUSES');
    expect(result.failures).toEqual([]);
    await page.screenshot({ path: info.outputPath(`long-${width}.png`) });
  }
  const before = (await snapshot(page, comparison)).reading.page;
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').input.gamepad.emit('down', {}, { index: 5 }));
  await expect.poll(async () => (await snapshot(page, comparison)).reading.page).toBe(before + 1);
  for (const field of ['pauseOverlayOpen', 'settingsOverlayOpen', 'deckReviewSearchActive']) {
    const blocked = await page.evaluate(({ prefix, field }) => {
      const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'), p = r.children.getByName(`${prefix}-panel`);
      const before = JSON.stringify(p.getData('reading'));
      r[field] = true; p.getData('changePage')(1); r[field] = false;
      return JSON.stringify(p.getData('reading')) === before;
    }, { prefix: prefix(comparison), field });
    expect(blocked).toBe(true);
  }
});
