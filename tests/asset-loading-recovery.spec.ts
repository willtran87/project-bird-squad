import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { settleCanvas } from './helpers/settled-canvas';
import { EventEmitter } from 'node:events';
import { queueRuntimeImageAssets, type RuntimeImageLoadResult } from '../src/game/runtime-images';

test('shared image observers survive timeout, deduplicate requests and retire on shutdown', () => {
  const originalNow = performance.now;
  let now = 0;
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  try {
    const textures = new Set<string>(), ticks: Array<() => void> = [];
    const requests: unknown[] = [], results: RuntimeImageLoadResult[] = [], duplicateResults: RuntimeImageLoadResult[] = [];
    const load = Object.assign(new EventEmitter(), {
      image: (...args: unknown[]) => requests.push(args), start: () => {},
    });
    const scene: any = { load, events: new EventEmitter(), sys: { settings: { active: true } },
      textures: { exists: (key: string) => textures.has(key) },
      time: { delayedCall: (_ms: number, callback: () => void) => ticks.push(callback) },
    };
    const asset = { key: 'late-art', url: '/late.webp' };
    queueRuntimeImageAssets(scene, [asset], 'test', result => results.push(result));
    queueRuntimeImageAssets(scene, [asset], 'test', result => duplicateResults.push(result));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual(['late-art', '/late.webp', { responseType: 'blob', timeout: 15000 }]);
    now = 8001;
    ticks.splice(0).forEach(tick => tick());
    expect(results).toEqual([{ requestedKeys: ['late-art'], loadedKeys: [], failedKeys: ['late-art'], timedOut: true }]);
    now = 9000; ticks.splice(0).forEach(tick => tick());
    expect(results).toHaveLength(1); // no repeated timeout notifications
    textures.add(asset.key); load.emit('filecomplete', asset.key); load.emit('complete');
    ticks.splice(0).forEach(tick => tick());
    expect(results[1]).toEqual({ requestedKeys: ['late-art'], loadedKeys: ['late-art'], failedKeys: [], timedOut: false });
    expect(duplicateResults).toEqual(results);
    expect(load.eventNames()).toEqual([]); expect(scene.events.eventNames()).toEqual([]);
    expect(queueRuntimeImageAssets(scene, [asset], 'cached')).toBe(false);
    queueRuntimeImageAssets(scene, [{ key: 'cancelled', url: '/cancelled.webp' }], 'test', result => results.push(result));
    scene.sys.settings.active = false; scene.events.emit('shutdown');
    ticks.splice(0).forEach(tick => tick());
    expect(results).toHaveLength(2);
    expect(load.eventNames()).toEqual([]); expect(scene.events.eventNames()).toEqual([]);
  } finally {
    Object.defineProperty(performance, 'now', { configurable: true, value: originalNow });
  }
});

async function boot(page: Page, scene: string, data = {}) {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async ({ scene, data }) => {
    const w = window as any;
    await w.__birdSquadEnsureScene(scene);
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start(scene, data);
  }, { scene, data });
}

async function artState(page: Page, scene: string) {
  return page.evaluate(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    const collect = (items: any[]): any[] => items.flatMap(c => [c, ...collect(c.list ?? [])]);
    const rendered = collect(s.children.list).filter(c => c.active && c.visible && c.texture).map(c => c.texture.key);
    return { rendered, readiness: JSON.parse((window as any).render_game_to_text()).assetReadiness };
  }, scene);
}

test('combat replaces failed preload art when recovery finishes after the intro', async ({ page }, info) => {
  const attempts = new Map<string, number>();
  await page.route(/\/(roof_rat|rooftop-blocks-readability-v2|wands_ace)-[^/]+\.webp$/, async route => {
    const url = route.request().url();
    const n = (attempts.get(url) ?? 0) + 1; attempts.set(url, n);
    if (n <= 3) { await route.abort(); return; }
    await new Promise(resolve => setTimeout(resolve, 3500));
    await route.continue();
  });
  await boot(page, 'BattleScene', { routeNodeId: 'm1_entry' });
  await page.waitForFunction(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return s.fxLayer?.active && !s.combatAnimationPending;
  });
  for (const key of ['enemy-roof_rat', 'battlefield-rooftop-blocks', 'card-thumb-wands_ace', 'ui-icon-flock-heart']) {
    await expect.poll(async () => (await artState(page, 'BattleScene')).rendered.includes(key), { timeout: 12000, message: key }).toBe(true);
  }
  expect(attempts.size).toBe(3);
  expect([...attempts.values()].every(n => n >= 4)).toBe(true);
  await expect.poll(async () => (await artState(page, 'BattleScene')).readiness.failedGroups).toEqual([]);
  await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('recovered-combat-2560.png') });
});

test('route paints late node art after the readiness timeout without another input', async ({ page }, info) => {
  await page.route('**/street-*.webp*', async route => {
    await new Promise(resolve => setTimeout(resolve, 9500));
    await route.continue();
  });
  await boot(page, 'RouteScene');
  await expect.poll(async () => (await artState(page, 'RouteScene')).readiness?.timedOutGroups, { timeout: 12000 })
    .toContain('route-essential-art');
  await page.waitForFunction(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return s.textures.exists('route-node-street');
  });
  const key = 'route-node-street';
  await expect.poll(async () => (await artState(page, 'RouteScene')).rendered).toContain(key);
  await expect.poll(async () => (await artState(page, 'RouteScene')).readiness.failedGroups).not.toContain('route-essential-art');
  await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('late-route-2560.png') });
});

test('every approved card, enemy and district image is deployed and decodes under the Pages base path', async ({ page }) => {
  const cards = JSON.parse(readFileSync('assets/runtime/cards/card-art-manifest.json', 'utf8')).cards;
  const enemies = JSON.parse(readFileSync('assets/runtime/enemies/enemy-art-manifest.json', 'utf8')).enemies;
  const backdropFiles = ['assets/runtime/backdrops', 'assets/runtime/backdrops/variants']
    .flatMap(dir => readdirSync(dir).filter(name => name.endsWith('.webp')).map(name => `${dir}/${name}`));
  const sources: string[] = [...cards.flatMap((c: any) => [c.portrait, c.thumbnail]), ...enemies.map((e: any) => e.full), ...backdropFiles];
  expect(cards).toHaveLength(110); expect(enemies).toHaveLength(64);
  const deployed = readdirSync('.artifacts/build/assets');
  const urls = sources.map(source => {
    const bytes = readFileSync(source), stem = path.basename(source, '.webp');
    const candidates = deployed.filter(name => name.startsWith(`${stem}-`) && name.endsWith('.webp'));
    const exact = candidates.find(name => readFileSync(`.artifacts/build/assets/${name}`).equals(bytes));
    expect(exact, `Missing exact deployed art for ${source}`).toBeTruthy();
    return `assets/${exact}`;
  });
  await page.goto('./');
  const failures = await page.evaluate(async urls => {
    const failed: string[] = [];
    // Small batches bound decoded image memory; no game texture-cache mutation.
    for (let i = 0; i < urls.length; i += 6) {
      await Promise.all(urls.slice(i, i + 6).map(async url => {
        const image = new Image(); image.src = new URL(url, location.href).href;
        try { await image.decode(); if (!image.naturalWidth || !image.naturalHeight) failed.push(url); }
        catch { failed.push(url); }
        finally { image.src = ''; }
      }));
    }
    return failed;
  }, urls);
  expect(failures).toEqual([]);
});

test('district and boss transitions reuse the scene without losing current art', async ({ page }, info) => {
  // Eight cold/warm encounter transitions and 24 high-resolution captures.
  // Keep each readiness wait bounded independently of the full journey.
  test.setTimeout(120000);
  const errors: string[] = [];
  const platformWarnings: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    // Keep driver/readback and Firefox platform notices as evidence, separate
    // from missing-art warnings. Console errors and unknown warnings still fail.
    const platformNotice = /AudioContext was prevented from starting automatically|Alpha-premult and y-flip are deprecated/.test(m.text())
      || /^\[\.WebGL-[^\]]+\]GL Driver Message \(OpenGL, Performance, [^)]+\): GPU stall due to ReadPixels(?: \(this message will no longer repeat\))?$/.test(m.text());
    if (m.type() === 'warning' && platformNotice) platformWarnings.push(m.text());
    else if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text());
  });
  await boot(page, 'RouteScene');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  const runState = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState);
  for (let mapIndex = 0; mapIndex < 4; mapIndex++) {
    for (const kind of ['entry', 'boss']) {
      await page.evaluate(async ({ runState, mapIndex, kind }) => {
        const w = window as any, game = w.__birdSquadGame;
        await w.__birdSquadEnsureScene('BattleScene');
        for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.scene.key);
        game.scene.start('BattleScene', { runState: { ...runState, mapIndex }, routeNodeId: `m${mapIndex + 1}_${kind}` });
      }, { runState, mapIndex, kind });
      await page.waitForFunction(() => {
        const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
        return b.fxLayer?.active && !b.combatAnimationPending && JSON.parse(w.render_game_to_text()).assetReadiness?.fullArt;
      }, undefined, { timeout: 15000 });
      const expected = await page.evaluate(() => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        return b.battleArtAssets().filter((a: any) => /^(enemy-|battlefield-|flock-leader-|card-thumb-)/.test(a.key)).map((a: any) => a.key);
      });
      expect((await artState(page, 'BattleScene')).rendered).toEqual(expect.arrayContaining(expected));
      const atmosphere = await page.evaluate(() => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        const collect = (items: any[]): any[] => items.flatMap(c => [c, ...collect(c.list ?? [])]);
        return collect(b.backdropLayer.list).filter(c => c.name === 'combat-atmosphere-strip').map(c => c.frame.name);
      });
      expect(atmosphere.length).toBeGreaterThan(0);
      expect(atmosphere.every(frame => String(frame) === String(Math.min(2, mapIndex)))).toBe(true);
      for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
        await page.setViewportSize(viewport); await settleCanvas(page);
        await page.screenshot({ path: info.outputPath(`district-${mapIndex + 1}-${kind}-${viewport.width}.png`) });
      }
    }
  }
  await info.attach('platform-warnings', {
    body: JSON.stringify([...new Set(platformWarnings)], null, 2), contentType: 'application/json',
  });
  expect(errors).toEqual([]);
});
