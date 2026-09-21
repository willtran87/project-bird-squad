import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
test.use({ hasTouch: true });

async function boot(page: Page) {
  await page.setViewportSize({ width: 2560, height: 1600 }); await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('CodexScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').codexData));
}

async function visibleArtReady(page: Page) {
  await page.waitForFunction(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const walk = (n: any): any[] => (n.list ?? []).flatMap((child: any) => [child, ...walk(child)]);
    const tiles = walk(c.root).filter((n: any) => ['codex-item-tile', 'codex-leader-tile'].includes(n.name));
    const shape = c.codexGridShape();
    const visible = tiles.filter((t: any) => {
      const b = t.getByName('codex-entry-hit').getBounds(); return b.bottom > shape.top && b.top < shape.bottom;
    });
    return visible.length > 0 && visible.every((t: any) => t.getByName('codex-entry-art'));
  });
}

test('all item and leader previews fit measured tiles and explicitly mark shortened text', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const issues: string[] = []; let count = 0, shortened = 0;
    for (const [kind, entries] of [['Supply', c.allSupplies()], ['Waymark', c.allWaymarks()], ['Leader', c.allLeaders()]] as const) {
      for (const item of entries) {
        c.root.removeAll(true);
        if (kind === 'Supply') c.renderSupplyThumb(c.root, item, 640, 360);
        else if (kind === 'Waymark') c.renderWaymarkThumb(c.root, item, 640, 360);
        else c.renderLeaderThumb(c.root, item, 640, 360);
        const tile = c.root.getByName(kind === 'Leader' ? 'codex-leader-tile' : 'codex-item-tile');
        const hit = tile.getByName('codex-entry-hit'), b = hit.getBounds();
        const texts = tile.list.filter((n: any) => n.type === 'Text' && n.name !== 'codex-entry-fallback');
        for (let i = 0; i < texts.length; i++) {
          const n = texts[i], full = n.getData('fullText'), bounds = n.getBounds();
          if (n.style.maxLines || n.style.resolution !== 2 || bounds.right > b.right - 15 || bounds.bottom > b.bottom - 10
            || bounds.left < b.left + 12 || bounds.top < b.top + 12) issues.push(`${item.id}: text bounds`);
          if (i && bounds.top < texts[i - 1].getBounds().bottom) issues.push(`${item.id}: overlap`);
          if (n.text !== full) { shortened++; if (!n.text.endsWith('…') || !full.startsWith(n.text.slice(0, -1))) issues.push(`${item.id}: silent truncation`); }
        }
        if (tile.getByName('codex-entry-title').getData('fullText') !== item.name) issues.push(`${item.id}: title lost`);
        if (tile.getByName('codex-entry-summary').style.fontSize !== '18px') issues.push(`${item.id}: small summary`);
        count++;
      }
    }
    // Deliberately hostile names/long unbroken text must still fit.
    c.root.removeAll(true);
    const supply = { ...c.allSupplies()[0], name: 'X'.repeat(240) };
    c.renderSupplyThumb(c.root, supply, 640, 360);
    const title = c.root.getByName('codex-item-tile').getByName('codex-entry-title');
    if (!title.text.endsWith('…') || title.width > 264 || title.height > 50) issues.push('long title clipping');
    return { count, shortened, issues };
  });
  expect(result.count).toBe(94); expect(result.shortened).toBeGreaterThan(0); expect(result.issues).toEqual([]);
});

test('item and leader grids render real art at three viewport sizes', async ({ page }, info) => {
  await boot(page);
  for (const [section, tab] of [['items', 0], ['items', 1], ['items', 2], ['leaders', 0]] as const) {
    await page.evaluate(({ section, tab }) => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      c.activeSection = section; c.activeItemTypeTab = tab; c.activeItemFilterTab = 0;
      c.gridScroll = c.gridScrollTarget = 0; c.renderAll();
    }, { section, tab });
    await visibleArtReady(page);
    for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size); await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`${section}-${tab}-${size.width}.png`) });
    }
  }
});

test('deep item navigation keeps focus, visible artwork and detail return on the same grid', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page); await page.setViewportSize({ width: 1000, height: 560 });
  await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    c.activeSection = 'items'; c.activeItemTypeTab = 0; c.activeItemFilterTab = 0;
    c.focusZone = 'entries'; c.entryFocusIndex = 0; c.gridScroll = c.gridScrollTarget = 0; c.renderAll();
  });
  await visibleArtReady(page);
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').entryFocusIndex === 3);
  for (const index of [3, 47, 88, 1]) {
    await page.evaluate(index => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      c.entryFocusIndex = index; c.ensureFocusedEntryVisible(); c.gridScroll = c.gridScrollTarget; c.renderAll();
    }, index);
    await visibleArtReady(page); await settleCanvas(page);
    const result = await page.evaluate(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      const entry = c.codexFocusEntries()[c.entryFocusIndex], focus = c.entryFocusGeometry();
      const walk = (n: any): any[] => (n.list ?? []).flatMap((child: any) => [child, ...walk(child)]);
      const hit = walk(c.root).find((n: any) => n.name === 'codex-entry-hit' && n.getData('id') === entry.id);
      const b = hit.getBounds();
      return { id: entry.id, dx: Math.abs(focus.x - b.centerX), dy: Math.abs(focus.y - b.centerY),
        top: b.top, bottom: b.bottom, shape: c.codexGridShape(), scroll: c.gridScroll, index: c.entryFocusIndex };
    });
    expect(result.dx).toBeLessThan(1); expect(result.dy).toBeLessThan(1);
    expect(result.top).toBeGreaterThanOrEqual(result.shape.top); expect(result.bottom).toBeLessThanOrEqual(result.shape.bottom);
    await page.screenshot({ path: info.outputPath(`item-${index}-1000.png`) });
    await page.keyboard.press('Enter');
    await page.waitForFunction(id => JSON.parse((window as any).render_game_to_text()).detailOpen === id, result.id);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !JSON.parse((window as any).render_game_to_text()).detailOpen);
    expect(await page.evaluate(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      return { index: c.entryFocusIndex, scroll: c.gridScroll };
    })).toEqual({ index: result.index, scroll: result.scroll });
  }
  expect(errors).toEqual([]);
});

test('item and leader artwork and text open the correct detail with pointer and touch', async ({ page }) => {
  await boot(page);
  await page.setViewportSize({ width: 1000, height: 560 });
  for (const [section, tab] of [['items', 1], ['items', 2], ['leaders', 0]] as const) {
    await page.evaluate(({ section, tab }) => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      c.activeSection = section; c.activeItemTypeTab = tab; c.activeItemFilterTab = 0;
      c.gridScroll = c.gridScrollTarget = 0; c.renderAll();
    }, { section, tab });
    await visibleArtReady(page);
    for (const target of ['codex-entry-art', 'codex-entry-title']) {
      await settleCanvas(page);
      const point = await page.evaluate(target => {
        const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
        const walk = (n: any): any[] => (n.list ?? []).flatMap((child: any) => [child, ...walk(child)]);
        const tile = walk(c.root).find((n: any) => ['codex-item-tile', 'codex-leader-tile'].includes(n.name));
        const bounds = tile.getByName(target).getBounds();
        const canvas = document.querySelector('canvas')!.getBoundingClientRect();
        return { id: tile.getData('id'), x: canvas.x + bounds.centerX * canvas.width / 1280,
          y: canvas.y + bounds.centerY * canvas.height / 720 };
      }, target);
      if (target === 'codex-entry-art') await page.mouse.click(point.x, point.y);
      else await page.touchscreen.tap(point.x, point.y);
      await page.waitForFunction(id => JSON.parse((window as any).render_game_to_text()).detailOpen === id, point.id);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !JSON.parse((window as any).render_game_to_text()).detailOpen);
    }
  }
});
