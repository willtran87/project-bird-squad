import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });
async function boot(page: Page) {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(() => {
    const ids = ['major_00', 'major_01', 'wands_ace'];
    const raw = JSON.stringify({ discoveredCards: ids, favoriteCards: ['major_00'],
      cardCollection: Object.fromEntries(ids.map(id => [id, { timesClaimed: 1, firstAcquiredAt: 10,
        firstSource: 'starter_flock', isNew: true }])) });
    localStorage.setItem('birdsquad.account', raw); localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('CodexScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').codexData));
}

test('Codex toolbar keeps labels readable and input regions separate across every lens and order', async ({ page }, info) => {
  await boot(page);
  const issues = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'), issues: string[] = [];
    const check = () => {
      const nodes = c.root.list;
      const hits = nodes.filter((n: any) => n.input && n.name !== 'codex-audio-hit' && n.y < c.currentGridTop());
      for (const hit of hits) {
        const b = hit.getBounds();
        if (b.left < 0 || b.right > 1280 || b.top < 0 || b.bottom > c.currentGridTop()) issues.push(`${hit.name}: outside header`);
        for (const other of hits) {
          if (hit === other) continue;
          const d = other.getBounds();
          if (b.left < d.right - 0.5 && b.right > d.left + 0.5 && b.top < d.bottom - 0.5 && b.bottom > d.top + 0.5)
            issues.push(`${hit.name}: overlaps ${other.name}`);
        }
      }
      const texts = nodes.filter((n: any) => n.type === 'Text' && n.name && !['codex-input-hint', 'codex-grid-scroll-label'].includes(n.name)
        && n.y < c.currentGridTop());
      for (const n of texts) {
        const b = n.getBounds();
        if (parseFloat(n.style.fontSize) < 14 || n.style.resolution !== 2) issues.push(`${n.name}: small or low-res`);
        if (b.left < 0 || b.right > 1280 || b.top < 0 || b.bottom > c.currentGridTop()) issues.push(`${n.name}: clipped`);
        if (n.name.startsWith('codex-section-')) for (const hit of hits) {
          const d = hit.getBounds();
          if (b.left < d.right && b.right > d.left && b.top < d.bottom && b.bottom > d.top)
            issues.push(`${n.name}: covered by ${hit.name}`);
        }
        for (const other of texts) {
          if (other === n) continue;
          const d = other.getBounds();
          if (b.left < d.right && b.right > d.left && b.top < d.bottom && b.bottom > d.top) issues.push(`${n.name}: overlaps ${other.name}`);
        }
      }
      for (const [zone, name] of [['search', 'codex-card-search-hit'], ['sort', 'codex-card-sort-hit'],
        ['secondaryTabs', 'codex-card-lens-hit'], ['savedViews', 'codex-saved-views-hit'],
        ['progress', 'codex-card-collection-atlas-hit'], ['newCards', 'codex-clear-new-cards-hit']]) {
        if (c.activeSection !== 'cards') continue;
        c.focusZone = zone;
        const f = c.codexFocusGeometry(), h = nodes.find((n: any) => n.name === name)?.getBounds();
        if (!h || Math.abs(h.centerX - f.x) > 0.5 || Math.abs(h.centerY - f.y) > 0.5) issues.push(`${zone}: misplaced focus`);
      }
    };
    for (const sort of c.cardSortModes) for (const lens of c.cardCollectionLenses) for (const query of ['', 'W'.repeat(40)]) {
      c.cardSortMode = sort.id; c.cardCollectionLens = lens.id; c.cardSearchQuery = query; c.renderAll(); check();
    }
    c.cardSearchQuery = ''; c.cardCollectionLens = 'all'; c.focusZone = 'sections';
    for (const section of c.sections) {
      c.activeSection = section.id; c.renderAll(); check();
      if (section.id === 'items') for (const type of [0, 1, 2]) {
        c.activeItemTypeTab = type; c.renderAll(); check();
      }
      c.codexDataFailed = true; c.renderAll(); check();
      c.codexDataFailed = false;
    }
    c.activeSection = 'cards'; c.renderAll();
    return [...new Set(issues)];
  });
  expect(issues).toEqual([]);
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('CodexScene').load.isLoading());
  for (const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(size); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`toolbar-${size.width}.png`) });
  }
});

async function tap(page: Page, name: string) {
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('CodexScene').load.isLoading());
  await settleCanvas(page);
  const point = await page.evaluate(name => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'), h = c.root.getByName(name).getBounds();
    const b = document.querySelector('canvas')!.getBoundingClientRect();
    return { x: b.left + h.centerX * b.width / 1280, y: b.top + h.centerY * b.height / 720 };
  }, name);
  await page.touchscreen.tap(point.x, point.y);
}

test('Codex toolbar touch search sorting saved views Atlas and acknowledgement preserve owned cards', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await boot(page); await page.setViewportSize({ width: 1000, height: 560 });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account')!).cardCollection);
  await tap(page, 'codex-card-search-hit');
  const input = page.locator('#codex-card-search-input');
  await expect(input).toBeFocused(); await input.fill('First Flight');
  const bounds = await input.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1000);
  expect(await input.evaluate(n => parseFloat(getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual(16);
  await input.press('Enter'); await expect(input).toHaveCount(0);
  await tap(page, 'codex-card-sort-hit');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).cardSort.id === 'name');
  await tap(page, 'codex-card-lens-hit');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).cardCollectionLens.id === 'collected');
  const singleCard = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const h = c.gridLayer.list[0].getByName('codex-card-entry-hit').getBounds();
    return { top: h.top, bottom: h.bottom, gridTop: c.currentGridTop(), scroll: c.gridMaxScroll,
      fades: c.root.list.filter((n: any) => n.name === 'codex-grid-bottom-fade-strip').length };
  });
  expect(singleCard.top).toBeGreaterThanOrEqual(singleCard.gridTop);
  expect(singleCard.bottom).toBeLessThanOrEqual(690);
  expect(singleCard.scroll).toBe(0); expect(singleCard.fades).toBe(0);
  await settleCanvas(page); await page.screenshot({path: info.outputPath('filtered-1000.png')});
  await tap(page, 'codex-saved-views-hit');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').savedCollectionViewsOpen);
  await page.keyboard.press('Escape');
  await tap(page, 'codex-card-collection-atlas-hit');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').collectionAtlasOpen);
  await page.keyboard.press('Escape');
  await tap(page, 'codex-clear-new-cards-hit');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).newlyAcquiredCards.count === 0);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account')!).cardCollection);
  for (const [id, record] of Object.entries(before)) {
    const { isNew, ...ownedRecord } = record as Record<string, unknown>;
    expect(isNew).toBe(true);
    expect(after[id]).toEqual(ownedRecord); // The save format removes acknowledged flags.
  }
  expect(Object.keys(after)).toEqual(Object.keys(before));
  expect(await page.evaluate(() => JSON.parse((window as any).render_game_to_text()).cardSearch.query)).toBe('First Flight');
  await expect(page.locator('#game-status')).toContainText('Clear filters');
  expect(errors).toEqual([]);
});
