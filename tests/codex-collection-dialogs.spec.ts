import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });
const sizes = [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }];
async function boot(page: Page) {
  await page.setViewportSize(sizes[0]);
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('CodexScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').codexData));
}

async function audit(page: Page, kind: 'saved' | 'atlas') {
  return page.evaluate(kind => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const nodes = c.root.list, problems: string[] = [];
    const panelName = kind === 'saved' ? 'codex-saved-views-panel' : 'codex-collection-atlas-panel';
    const panel = nodes.find((n: any) => n.name === panelName).getBounds();
    const hint = nodes.find((n: any) => n.name === 'codex-input-hint');
    if (parseFloat(hint.style.fontSize) < 16 || hint.getBounds().left < 0 || hint.getBounds().right > 1280)
      problems.push('dialog input hint too small or clipped');
    const dialogNodes = nodes.slice(nodes.findIndex((n: any) => n.name === panelName) + 1);
    const texts = dialogNodes.filter((n: any) => n.type === 'Text' && n.name.startsWith('codex-' + kind + '-'));
    const overlaps = (b: any, d: any) => b.left < d.right - .5 && b.right > d.left + .5 && b.top < d.bottom - .5 && b.bottom > d.top + .5;
    for (const n of texts) {
      const b = n.getBounds();
      if (parseFloat(n.style.fontSize) < (n.name.endsWith('-shortcut') ? 16 : 18) || n.style.resolution !== 2)
        problems.push(n.name + ': small or low-resolution');
      if (b.left < panel.left || b.right > panel.right || b.top < panel.top || b.bottom > panel.bottom)
        problems.push(n.name + ': outside panel ' + JSON.stringify({left:b.left,right:b.right,top:b.top,bottom:b.bottom}));
      for (const other of texts) if (n !== other && overlaps(b, other.getBounds()))
        problems.push(n.name + ' overlaps ' + other.name);
    }
    const hits = nodes.slice(nodes.findIndex((n: any) => n.name === panelName) + 1).filter((n: any) => n.input);
    for (const hit of hits) {
      if (hit.height < 58) problems.push(hit.name + ': undersized touch target');
      const b = hit.getBounds();
      for (const other of hits) if (hit !== other && overlaps(b, other.getBounds())) problems.push(hit.name + ' overlaps ' + other.name);
    }
    const focus = c.codexFocusGeometry();
    const target = kind === 'atlas'
      ? hits.find((n: any) => n.name === 'codex-collection-atlas-family-hit' && n.getData('index') === c.collectionAtlasFamilyIndex)
      : c.savedCollectionViews.length
        ? hits.find((n: any) => n.name === 'codex-saved-view-row-hit' && n.getData('index') === c.savedCollectionViewIndex)
        : hits.find((n: any) => n.name === 'codex-saved-view-save-hit');
    const b = target.getBounds();
    if (b.centerX !== focus.x || b.centerY !== focus.y || b.width !== focus.width || b.height !== focus.height)
      problems.push('focus disagrees with target');
    return [...new Set(problems)];
  }, kind);
}

test('collection dialogs show complete saved criteria and readable states without overlapping controls', async ({ page }, info) => {
  await boot(page);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  for (const count of [0, 1, 4]) {
    await page.evaluate(count => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      c.savedCollectionViews = Array.from({length:count}, (_, i) => ({
        id:'test-' + i, name:'W'.repeat(48), tab:'hunt', lens:'uncollected', sort:'recent', query:'W'.repeat(40), createdAt:i+1,
      }));
      c.activeTab = 8; c.cardCollectionLens = 'uncollected'; c.cardSortMode = 'recent'; c.cardSearchQuery = 'W'.repeat(40);
      c.openSavedCollectionViews();
    }, count);
    await expect(page.locator('#game-status')).toContainText('Current view to save: Hunt List, Uncollected lens, search ' + 'W'.repeat(40) + ', Recent order.');
    for (const status of ['idle','saved','duplicate','full','deleted','applied','failed']) {
      await page.evaluate(status => { const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'); c.savedCollectionViewStatus = status; c.renderAll(); }, status);
      expect(await audit(page, 'saved'), 'count=' + count + ', status=' + status).toEqual([]);
    }
    const queries = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').root.list
      .filter((n: any) => ['codex-saved-current-query','codex-saved-row-query'].includes(n.name)).map((n: any) => n.text));
    expect(queries).toHaveLength(count + 1);
    expect(queries.every((q: string) => q.includes('W'.repeat(40)) && !q.includes('…'))).toBe(true);
    await page.evaluate(() => { const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'); c.savedCollectionViewStatus = 'idle'; c.renderAll(); });
    for (const size of sizes) {
      await page.setViewportSize(size); await settleCanvas(page);
      await page.screenshot({ path: info.outputPath('saved-' + count + '-' + size.width + '.png') });
    }
  }
  expect(errors).toEqual([]);
});

test('collection dialogs Atlas retains all progress and readable milestone stages without revealing hidden identities', async ({ page }, info) => {
  await boot(page);
  for (const mode of ['empty','partial','complete']) {
    await page.evaluate(mode => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'), all = c.allCards();
      const owned = mode === 'empty' ? [] : mode === 'partial' ? all.slice(0, 30) : all;
      c.discovered = new Set(owned.map((card: any) => card.id));
      c.cardCollection = Object.fromEntries(owned.map((card: any, i: number) => [card.id, { timesClaimed:1, firstAcquiredAt:1, firstSource:['starter_flock','combat_reward','route_reward','market','snag'][i % 5] }]));
      c.cardTags = mode === 'complete' ? { major_00:'staple', major_01:'experiment', major_02:'keepsake' } : {};
      c.openCollectionAtlas();
    }, mode);
    for (let index = 0; index < 7; index++) {
      await page.evaluate(index => { const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'); c.collectionAtlasFamilyIndex = index; c.renderAll(); }, index);
      expect(await audit(page, 'atlas'), mode + ' family ' + index).toEqual([]);
    }
    const snapshot = await page.evaluate(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      return { atlas:c.collectionAtlasSnapshot(), text:c.root.list.filter((n: any) => n.type === 'Text' && n.name.startsWith('codex-atlas-')).map((n: any) => n.text).join(' ') };
    });
    expect(snapshot.atlas.overall.owned).toBe(mode === 'empty' ? 0 : mode === 'partial' ? 30 : 110);
    expect(snapshot.atlas.families).toHaveLength(7); expect(snapshot.atlas.rarities).toHaveLength(4);
    expect(snapshot.text).toContain('never power'); expect(snapshot.text).not.toContain('The World');
    for (const size of sizes) {
      await page.setViewportSize(size); await settleCanvas(page);
      await page.screenshot({ path: info.outputPath('atlas-' + mode + '-' + size.width + '.png') });
    }
  }
});

async function tap(page: Page, name: string, index?: number) {
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('CodexScene').load.isLoading());
  await settleCanvas(page);
  const point = await page.evaluate(({name,index}) => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const hit = c.root.list.find((n: any) => n.name === name && (index === undefined || n.getData('index') === index));
    const b = hit.getBounds(), canvas = document.querySelector('canvas')!.getBoundingClientRect();
    return {x:canvas.left+b.centerX*canvas.width/1280,y:canvas.top+b.centerY*canvas.height/720};
  }, {name,index});
  await page.touchscreen.tap(point.x, point.y);
}

test('collection dialogs compact touch save apply remove and Atlas return preserve collection data', async ({page}) => {
  await boot(page); await page.setViewportSize(sizes[2]);
  const account = await page.evaluate(() => localStorage.getItem('birdsquad.account'));
  await tap(page, 'codex-saved-views-hit'); await tap(page, 'codex-saved-view-save-hit');
  await expect(page.locator('#game-status')).toContainText('View saved');
  await tap(page, 'codex-saved-view-close-hit');
  await page.keyboard.press('r');
  await tap(page, 'codex-saved-views-hit'); await tap(page, 'codex-saved-view-save-hit');
  await tap(page, 'codex-saved-view-row-hit', 0);
  await expect(page.locator('#game-status')).toContainText('Current view to save: Major, All lens, no search, Name order.');
  await expect(page.locator('#game-status')).toContainText('Selected 1 of 2, Major · All: Major, All lens, no search, Binder order.');
  await tap(page, 'codex-saved-view-apply-hit');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).cardSort.id === 'binder');
  await tap(page, 'codex-saved-views-hit'); await tap(page, 'codex-saved-view-delete-hit');
  await expect(page.locator('#game-status')).toContainText('View removed without changing collection data');
  await tap(page, 'codex-saved-view-close-hit');
  await tap(page, 'codex-card-collection-atlas-hit'); await tap(page, 'codex-collection-atlas-family-hit', 3);
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).cardCollection.id === 'quills');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.account'))).toBe(account);
});

test('collection dialogs block background wheel and preserve the exact shelf position after Back', async ({page}) => {
  await boot(page); await page.setViewportSize(sizes[2]);
  for (const dialog of ['saved', 'atlas']) for (const momentum of [false, true]) {
    const opened = await page.evaluate(({dialog,momentum}) => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      c.activeTab = 0; c.cardSearchQuery = ''; c.cardCollectionLens = 'all';
      c.gridScroll = 480; c.gridScrollTarget = momentum ? 600 : 480; c.renderAll();
      if (dialog === 'saved') c.openSavedCollectionViews(); else c.openCollectionAtlas();
      return { scroll:c.gridScroll, target:c.gridScrollTarget };
    }, {dialog,momentum});
    expect(opened, dialog + ' stops pending movement on open').toEqual({scroll:480,target:480});
    const canvas = await page.locator('canvas').boundingBox();
    await page.mouse.move(canvas!.x + canvas!.width / 2, canvas!.y + canvas!.height / 2);
    await page.mouse.wheel(0, 600);
    await page.evaluate(async () => { for (let i = 0; i < 20; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
    expect(await page.evaluate(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      return {scroll:c.gridScroll,target:c.gridScrollTarget};
    }), dialog + ' owns wheel input').toEqual({scroll:480,target:480});
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => { const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'); return !c.savedCollectionViewsOpen && !c.collectionAtlasOpen; });
    expect(await page.evaluate(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      return {scroll:c.gridScroll,target:c.gridScrollTarget};
    }), dialog + ' restores shelf position').toEqual({scroll:480,target:480});
  }
  // Normal grid scrolling must remain available after the modal closes.
  await page.mouse.wheel(0, 600);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').gridScroll > 480);
});
