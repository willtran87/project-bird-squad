import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { boot, clickNamedGameObject } from './helpers/smoke';

// Split from the former tests/smoke.spec.ts (deck topics). Tests drive
// scenes through the deterministic text-state harness on window.

test('route deck review supports pointer filters, sorting, find, and keyboard card navigation', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    route.openDeckOverlay();
  });

  const initial = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview);
  expect(initial).toMatchObject({
    open: true,
    total: 10,
    visible: 10,
    filter: 'all',
    sort: 'run',
    query: '',
    searchActive: false,
  });
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.browserRenderer?.loaded
  ))).toBe(true);

  const targets = await page.evaluate(() => {
    const route = window.__birdSquadGame.scene.getScene('RouteScene');
    return ['deck-review-filter-hit', 'deck-review-sort-hit', 'deck-review-search-hit'].map((name) => {
      const hit = route.children.list.find((child: any) => child.name === name && child.input?.enabled);
      if (!hit) throw new Error(`Missing ${name}`);
      return { name, width: hit.displayWidth, height: hit.displayHeight };
    });
  });
  expect(targets).toEqual([
    { name: 'deck-review-filter-hit', width: 134, height: 58 },
    { name: 'deck-review-sort-hit', width: 134, height: 58 },
    { name: 'deck-review-search-hit', width: 150, height: 58 },
  ]);

  const footer = await page.evaluate(() => {
    const r: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const guide = r.children.getByName('deck-review-control-guide');
    const pages = r.children.getByName('deck-review-page-label');
    const b = guide.getBounds();
    return { rail: !!r.children.getByName('deck-review-control-rail'), size: guide.style.fontSize,
      top: b.top, bottom: b.bottom, left: b.left, right: b.right,
      pageBottom: pages.getBounds().bottom, text: guide.text };
  });
  expect(footer.rail).toBe(false);
  expect(footer.size).toBe('19px');
  expect(footer.top).toBeGreaterThan(footer.pageBottom);
  expect(footer.bottom).toBeLessThanOrEqual(704);
  expect(footer.left).toBeGreaterThanOrEqual(120);
  expect(footer.right).toBeLessThanOrEqual(1160);
  expect(footer.text).toBe('Select a card to read its rules · Pin to compare');

  await settleCanvas(page);
  await clickNamedGameObject(page, 'RouteScene', 'deck-review-filter-hit');
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview.filter
  ))).toBe('plumes');

  await page.keyboard.press('/');
  await page.waitForTimeout(80);
  await page.keyboard.type('fledgling');
  await page.keyboard.press('Enter');
  const searched = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview);
  expect(searched).toMatchObject({
    filter: 'plumes',
    query: 'fledgling',
    searchActive: false,
    visible: 1,
  });
  expect(searched.cards).toEqual([
    expect.objectContaining({ name: 'Plume Fledgling', suit: 'plumes' }),
  ]);

  await clickNamedGameObject(page, 'RouteScene', 'deck-review-sort-hit');
  await clickNamedGameObject(page, 'RouteScene', 'deck-review-search-hit');
  for (let index = 0; index < 'fledgling'.length; index += 1) {
    await page.keyboard.press('Backspace');
  }
  await page.keyboard.press('Enter');
  const sorted = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview);
  expect(sorted).toMatchObject({
    filter: 'plumes',
    sort: 'cost',
    query: '',
    searchActive: false,
    visible: 2,
  });
  expect(sorted.cards.map((card: any) => card.cost)).toEqual([0, 1]);

  const selectedBefore = sorted.selectedCardId;
  await page.keyboard.press('ArrowDown');
  const navigated = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview);
  expect(navigated.selectedCardId).not.toBe(selectedBefore);
  expect(navigated.controls).toMatchObject({
    cards: 'Up / Down',
    sort: 'Enter',
    find: '/',
    close: 'Esc',
  });
});

test('route deck review pins accessible card and Preen comparisons', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  await page.evaluate(async () => {
    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    route.openDeckOverlay();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.deckReview?.open && state.deckReview?.selectedCardId === 'major_00';
  });

  const pinTargets = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.children.list
      .filter((child: any) => child.name?.startsWith('deck-review-compare-hit-') && child.input?.enabled)
      .map((child: any) => ({
        cardId: child.getData('cardId'),
        pinned: child.getData('pinned'),
        width: child.displayWidth,
        height: child.displayHeight,
      }));
  });
  expect(pinTargets).toHaveLength(6);
  expect(pinTargets.every((target: any) => target.width === 88 && target.height === 58)).toBe(true);
  expect(pinTargets.every((target: any) => target.pinned === false)).toBe(true);

  const pinPoint = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const hit = route.children.list.find((child: any) => (
      child.name === 'deck-review-compare-hit-major_00' && child.input?.enabled
    ));
    if (!hit) throw new Error('Missing First Flight comparison pin');
    return { x: hit.x, y: hit.y };
  });
  const pinCanvas = await page.locator('canvas').boundingBox();
  if (!pinCanvas) throw new Error('Missing game canvas');
  const pinX = pinCanvas.x + pinCanvas.width * (pinPoint.x / 1280);
  const pinY = pinCanvas.y + pinCanvas.height * (pinPoint.y / 720);
  let pointerPinned = false;
  for (let attempt = 0; attempt < 2 && !pointerPinned; attempt += 1) {
    await page.mouse.move(pinX, pinY, { steps: 4 });
    await page.waitForTimeout(80);
    await page.mouse.down();
    await page.waitForTimeout(60);
    pointerPinned = await page.evaluate(() => (
      JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.comparison?.mode === 'preen'
    ));
    await page.mouse.up();
  }
  expect(pointerPinned).toBe(true);
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.comparison
  ))).toMatchObject({
    active: true,
    mode: 'preen',
    summary: 'PREEN CHANGES RULES  /  ADDS COHESION +1',
    pinned: { id: 'major_00', name: 'First Flight', cost: 1, role: 'attack', target: 'enemy' },
    selected: {
      id: 'major_00',
      name: 'First Flight+',
      cost: 1,
      role: 'attack',
      target: 'enemy',
      stats: ['Cohesion +3', 'Hand Target +1'],
    },
  });
  await page.waitForFunction(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.children.list.some((child: any) => child.name === 'deck-review-comparison-panel');
  });
  await page.waitForFunction(() => document.getElementById('game-status')?.textContent?.includes('Preen preview for First Flight'));
  const preenPreviewTexts = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.children.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text);
  });
  expect(preenPreviewTexts).toContain('PREEN COMPARISON');
  expect(preenPreviewTexts).toContain('BASE');
  expect(preenPreviewTexts).toContain('PREENED');
  expect(preenPreviewTexts).toContain('REMOVED / REPLACED');
  expect(preenPreviewTexts).toContain('ADDED / REPLACEMENT');
  const readHeadings = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const reading = await page.evaluate(() => JSON.parse(window.render_game_to_text!()).deckReview.comparison.reading);
    reading.headings.forEach((heading: string) => readHeadings.add(heading));
    if (reading.page === reading.total) break;
    await page.keyboard.press('PageDown');
  }
  for (const heading of ['BASE RULES', 'PREENED RULES', 'BASE MOLT', 'PREENED MOLT']) expect(readHeadings.has(heading)).toBe(true);

  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.comparison
  ))).toMatchObject({
    active: true,
    pinned: { id: 'major_00', name: 'First Flight', cost: 1 },
    selected: { id: 'wands_ace', name: 'Plume Flash', cost: 1 },
  });
  await page.waitForFunction(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.children.list.some((child: any) => child.name === 'deck-review-comparison-panel');
  });
  await page.waitForFunction(() => document.getElementById('game-status')?.textContent?.includes('Comparing pinned First Flight'));

  const comparison = await page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const texts = route.children.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text);
    return {
      state: state.deckReview,
      panels: route.children.list.filter((child: any) => child.name === 'deck-review-comparison-panel').length,
      costBadges: route.children.list.filter((child: any) => child.name === 'deck-review-comparison-cost-badge').length,
      texts,
      announcement: document.getElementById('game-status')?.textContent ?? '',
    };
  });
  expect(comparison.panels).toBe(1);
  expect(comparison.costBadges).toBe(2);
  expect(comparison.texts).toContain('CARD COMPARISON');
  expect(comparison.texts).toContain('PINNED');
  expect(comparison.texts).toContain('SELECTED');
  expect(comparison.state.controls).toMatchObject({ compare: 'C', compareController: 'X' });
  expect(comparison.state.controls.compareAction).toContain('Base versus Preened');
  expect(comparison.announcement).toContain('pin the selected card to compare Base and Preened');

  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.input.gamepad.emit('down', route.input.gamepad.pad1, { index: 2 }, 1);
  });
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.comparison
  ))).toMatchObject({
    active: true,
    mode: 'preen',
    pinned: { id: 'wands_ace', name: 'Plume Flash' },
    selected: { id: 'wands_ace', name: 'Plume Flash+' },
  });

  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.comparison
  ))).toMatchObject({
    active: true,
    pinned: { id: 'wands_ace', name: 'Plume Flash' },
    selected: { id: 'wands_fledgling', name: 'Plume Fledgling' },
  });
  const differentShape = await page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.comparison
  ));
  expect(differentShape.summary).toContain('COST 1 TO 0');
  expect(differentShape.summary).toContain('ROLE ATTACK TO UTILITY');
  expect(differentShape.summary).toContain('TARGET ENEMY TO NO TARGET');
  await page.keyboard.press('c');
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.comparison
  ))).toMatchObject({
    active: true,
    mode: 'preen',
    pinned: { id: 'wands_fledgling', name: 'Plume Fledgling' },
    selected: { id: 'wands_fledgling', name: 'Plume Fledgling+' },
  });
});

test('deck review overlays retain authored art with quiet readable controls', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const countFlourish = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-deck-review-flourish' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countFlourish(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countScrollButtonFrames = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-deck-review-scroll-button-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countScrollButtonFrames(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countRowFrames = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-deck-review-row-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countRowFrames(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countPageIndicatorFrames = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-deck-review-page-indicator-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countPageIndicatorFrames(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countTitlePlaques = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-deck-review-title-plaque' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTitlePlaques(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countDetailFrames = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-deck-review-detail-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countDetailFrames(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countCostBadges = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-deck-review-cost-badge' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countCostBadges(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countMetaChipFrames = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-deck-review-meta-chip-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countMetaChipFrames(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countSectionTabFrames = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-deck-review-section-tab-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countSectionTabFrames(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const collectRowFrameObjects = (items: any[]): any[] => items.flatMap((child) => {
      const nested = Array.isArray(child.list) ? collectRowFrameObjects(child.list) : [];
      return child.texture?.key === 'ui-icon-deck-review-row-frame' ? [child, ...nested] : nested;
    });
    const collectPageIndicatorFrameObjects = (items: any[]): any[] => items.flatMap((child) => {
      const nested = Array.isArray(child.list) ? collectPageIndicatorFrameObjects(child.list) : [];
      return child.texture?.key === 'ui-icon-deck-review-page-indicator-frame' ? [child, ...nested] : nested;
    });
    const collectTitlePlaqueObjects = (items: any[]): any[] => items.flatMap((child) => {
      const nested = Array.isArray(child.list) ? collectTitlePlaqueObjects(child.list) : [];
      return child.texture?.key === 'ui-icon-deck-review-title-plaque' ? [child, ...nested] : nested;
    });
    const collectDetailFrameObjects = (items: any[]): any[] => items.flatMap((child) => {
      const nested = Array.isArray(child.list) ? collectDetailFrameObjects(child.list) : [];
      return child.texture?.key === 'ui-icon-deck-review-detail-frame' ? [child, ...nested] : nested;
    });
    const collectCostBadgeObjects = (items: any[]): any[] => items.flatMap((child) => {
      const nested = Array.isArray(child.list) ? collectCostBadgeObjects(child.list) : [];
      return child.texture?.key === 'ui-icon-deck-review-cost-badge' ? [child, ...nested] : nested;
    });
    const collectMetaChipFrameObjects = (items: any[]): any[] => items.flatMap((child) => {
      const nested = Array.isArray(child.list) ? collectMetaChipFrameObjects(child.list) : [];
      return child.texture?.key === 'ui-icon-deck-review-meta-chip-frame' ? [child, ...nested] : nested;
    });
    const collectSectionTabFrameObjects = (items: any[]): any[] => items.flatMap((child) => {
      const nested = Array.isArray(child.list) ? collectSectionTabFrameObjects(child.list) : [];
      return child.texture?.key === 'ui-icon-deck-review-section-tab-frame' ? [child, ...nested] : nested;
    });

    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    route.openDeckOverlay();
    let routeState = JSON.parse(window.render_game_to_text!());
    for (let i = 0; i < 80 && !routeState.deckReviewFlourish?.rendered; i += 1) {
      await wait(50);
      routeState = JSON.parse(window.render_game_to_text!());
    }
    const routeFlourish = countFlourish(route.children.list);
    const routeScrollButtonFrames = countScrollButtonFrames(route.children.list);
    const routeRowFrames = countRowFrames(route.children.list);
    const routePageIndicatorFrames = countPageIndicatorFrames(route.children.list);
    const routeTitlePlaques = countTitlePlaques(route.children.list);
    const routeDetailFrames = countDetailFrames(route.children.list);
    const routeCostBadges = countCostBadges(route.children.list);
    const routeMetaChipFrames = countMetaChipFrames(route.children.list);
    const routeSectionTabFrames = countSectionTabFrames(route.children.list);
    const routeScrollButtonFrameObjects = route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-deck-review-scroll-button-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
        visible: child.visible
      }));
    const routeRowFrameObjects = collectRowFrameObjects(route.children.list).map((child: any) => ({
      width: Math.round(child.displayWidth),
      height: Math.round(child.displayHeight),
      alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
      name: child.name,
      visible: child.visible
    }));
    const routePageIndicatorFrameObjects = collectPageIndicatorFrameObjects(route.children.list).map((child: any) => ({
      width: Math.round(child.displayWidth),
      height: Math.round(child.displayHeight),
      alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
      name: child.name,
      visible: child.visible
    }));
    const routeTitlePlaqueObjects = collectTitlePlaqueObjects(route.children.list).map((child: any) => ({
      width: Math.round(child.displayWidth),
      height: Math.round(child.displayHeight),
      alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
      name: child.name,
      visible: child.visible
    }));
    const routeDetailFrameObjects = collectDetailFrameObjects(route.children.list).map((child: any) => ({
      width: Math.round(child.displayWidth),
      height: Math.round(child.displayHeight),
      alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
      name: child.name,
      visible: child.visible
    }));
    const routeCostBadgeObjects = collectCostBadgeObjects(route.children.list).map((child: any) => ({
      width: Math.round(child.displayWidth),
      height: Math.round(child.displayHeight),
      alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
      name: child.name,
      visible: child.visible
    }));
    const routeMetaChipFrameObjects = collectMetaChipFrameObjects(route.children.list).map((child: any) => ({
      width: Math.round(child.displayWidth),
      height: Math.round(child.displayHeight),
      alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
      name: child.name,
      visible: child.visible
    }));
    const routeSectionTabFrameObjects = collectSectionTabFrameObjects(route.children.list).map((child: any) => ({
      width: Math.round(child.displayWidth),
      height: Math.round(child.displayHeight),
      alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
      name: child.name,
      visible: child.visible
    }));

    await window.__birdSquadStartScene!('BattleScene', { runState: route.runState, routeNodeId: 'm1_entry' });
    await wait(250);
    const battle: any = g.scene.getScene('BattleScene');
    battle.openOverlay('deck');
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.battleInspectRenderer?.loaded && battle.root.getByName('combat-pile-card-art')) break;
      await wait(50);
    }
    const battleState = JSON.parse(window.render_game_to_text!());
    const battleFlourish = countFlourish(battle.root?.list ?? battle.children.list);
    const battleRowFrames = countRowFrames(battle.root?.list ?? battle.children.list);
    const battlePageIndicatorFrames = countPageIndicatorFrames(battle.root?.list ?? battle.children.list);
    const battleTitlePlaques = countTitlePlaques(battle.root?.list ?? battle.children.list);
    const battleDetailFrames = countDetailFrames(battle.root?.list ?? battle.children.list);
    const battleCostBadges = countCostBadges(battle.root?.list ?? battle.children.list);
    const battleMetaChipFrames = countMetaChipFrames(battle.root?.list ?? battle.children.list);
    const battleSectionTabFrames = countSectionTabFrames(battle.root?.list ?? battle.children.list);
    const battleTitlePlaqueObjects = collectTitlePlaqueObjects(battle.root?.list ?? battle.children.list).map((child: any) => ({
      width: Math.round(child.displayWidth),
      height: Math.round(child.displayHeight),
      alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
      name: child.name,
      visible: child.visible
    }));
    const battleDetailFrameObjects = collectDetailFrameObjects(battle.root?.list ?? battle.children.list).map((child: any) => ({
      width: Math.round(child.displayWidth),
      height: Math.round(child.displayHeight),
      alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
      name: child.name,
      visible: child.visible
    }));
    const battleCostBadgeObjects = collectCostBadgeObjects(battle.root?.list ?? battle.children.list).map((child: any) => ({
      width: Math.round(child.displayWidth),
      height: Math.round(child.displayHeight),
      alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
      name: child.name,
      visible: child.visible
    }));
    const battleMetaChipFrameObjects = collectMetaChipFrameObjects(battle.root?.list ?? battle.children.list).map((child: any) => ({
      width: Math.round(child.displayWidth),
      height: Math.round(child.displayHeight),
      alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
      name: child.name,
      visible: child.visible
    }));
    const battleSectionTabFrameObjects = collectSectionTabFrameObjects(battle.root?.list ?? battle.children.list).map((child: any) => ({
      width: Math.round(child.displayWidth),
      height: Math.round(child.displayHeight),
      alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
      name: child.name,
      visible: child.visible
    }));

    return {
      loaded: g.textures.exists('ui-icon-deck-review-flourish'),
      scrollButtonFrameLoaded: g.textures.exists('ui-icon-deck-review-scroll-button-frame'),
      rowFrameLoaded: g.textures.exists('ui-icon-deck-review-row-frame'),
      pageIndicatorFrameLoaded: g.textures.exists('ui-icon-deck-review-page-indicator-frame'),
      titlePlaqueLoaded: g.textures.exists('ui-icon-deck-review-title-plaque'),
      detailFrameLoaded: g.textures.exists('ui-icon-deck-review-detail-frame'),
      costBadgeLoaded: g.textures.exists('ui-icon-deck-review-cost-badge'),
      metaChipFrameLoaded: g.textures.exists('ui-icon-deck-review-meta-chip-frame'),
      sectionTabFrameLoaded: g.textures.exists('ui-icon-deck-review-section-tab-frame'),
      routeOpen: routeState.deckOverlayOpen,
      routeFlourish,
      routeScrollButtonFrames,
      routeScrollButtonFrameObjects,
      routeScrollButtonTelemetry: routeState.deckReviewScrollButtonFrame,
      routeRowFrames,
      routeRowFrameObjects,
      routeRowFrameTelemetry: routeState.deckReviewRowFrame,
      routePageIndicatorFrames,
      routePageIndicatorFrameObjects,
      routePageIndicatorFrameTelemetry: routeState.deckReviewPageIndicatorFrame,
      routeTitlePlaques,
      routeTitlePlaqueObjects,
      routeTitlePlaqueTelemetry: routeState.deckReviewTitlePlaque,
      routeDetailFrames,
      routeDetailFrameObjects,
      routeDetailFrameTelemetry: routeState.deckReviewDetailFrame,
      routeCostBadges,
      routeCostBadgeObjects,
      routeCostBadgeTelemetry: routeState.deckReviewCostBadge,
      routeMetaChipFrames,
      routeMetaChipFrameObjects,
      routeMetaChipFrameTelemetry: routeState.deckReviewMetaChipFrame,
      routeSectionTabFrames,
      routeSectionTabFrameObjects,
      routeSectionTabFrameTelemetry: routeState.deckReviewSectionTabFrame,
      battleOpen: battleState.inspectOverlay,
      battleInspectRenderer: battleState.battleInspectRenderer,
      battleReadableRows: battle.root.list.filter((child: any) => child.name === 'combat-pile-row-title')
        .map((child: any) => ({ size: child.style.fontSize, resolution: child.style.resolution })),
      battleReadControl: Boolean(battle.root.getByName('combat-pile-read-hit')?.input?.enabled),
      battleQuietFrame: battle.root.list.filter((child: any) => child.name === 'combat-pile-review-frame').length,
      battleFlourish,
      battleRowFrames,
      battleRowFrameTelemetry: battleState.deckReviewRowFrame,
      battlePageIndicatorFrames,
      battlePageIndicatorFrameTelemetry: battleState.deckReviewPageIndicatorFrame,
      battleTitlePlaques,
      battleTitlePlaqueObjects,
      battleTitlePlaqueTelemetry: battleState.deckReviewTitlePlaque,
      battleDetailFrames,
      battleDetailFrameObjects,
      battleDetailFrameTelemetry: battleState.deckReviewDetailFrame,
      battleCostBadges,
      battleCostBadgeObjects,
      battleCostBadgeTelemetry: battleState.deckReviewCostBadge,
      battleMetaChipFrames,
      battleMetaChipFrameObjects,
      battleMetaChipFrameTelemetry: battleState.deckReviewMetaChipFrame,
      battleSectionTabFrames,
      battleSectionTabFrameObjects,
      battleSectionTabFrameTelemetry: battleState.deckReviewSectionTabFrame
    };
  });

  expect(result.loaded).toBe(true);
  expect(result.scrollButtonFrameLoaded).toBe(true);
  expect(result.rowFrameLoaded).toBe(true);
  expect(result.pageIndicatorFrameLoaded).toBe(true);
  expect(result.titlePlaqueLoaded).toBe(true);
  expect(result.detailFrameLoaded).toBe(true);
  expect(result.costBadgeLoaded).toBe(true);
  expect(result.metaChipFrameLoaded).toBe(true);
  expect(result.sectionTabFrameLoaded).toBe(true);
  expect(result.routeOpen).toBe(true);
  expect(result.routeFlourish).toBe(0);
  expect(result.routeScrollButtonTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.routeRowFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.routePageIndicatorFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.routeTitlePlaqueTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.routeDetailFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.routeCostBadgeTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeCostBadges });
  expect(result.routeMetaChipFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.routeSectionTabFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.routePageIndicatorFrames).toBe(0);
  expect(result.routePageIndicatorFrameObjects).toEqual([]);
  expect(result.routeTitlePlaques).toBe(0);
  expect(result.routeTitlePlaqueObjects).toEqual([]);
  expect(result.routeDetailFrames).toBe(0);
  expect(result.routeDetailFrameObjects).toEqual([]);
  expect(result.routeCostBadges).toBe(6);
  expect(result.routeCostBadgeObjects.filter((badge: { width: number; height: number }) => badge.width === 46 && badge.height === 46)).toHaveLength(0);
  expect(result.routeCostBadgeObjects.filter((badge: { width: number; height: number }) => badge.width === 34 && badge.height === 34)).toHaveLength(6);
  expect(result.routeCostBadgeObjects.every((badge: { name: string; visible: boolean }) => (
    badge.name === 'deck-review-cost-badge'
    && badge.visible
  ))).toBe(true);
  expect(result.routeMetaChipFrames).toBe(result.routeRowFrames);
  expect(result.routeMetaChipFrameObjects.every((frame: { name: string; width: number; height: number; visible: boolean }) => (
    frame.name === 'deck-review-meta-chip-frame'
    && frame.width === 118
    && frame.height === 24
    && frame.visible
  ))).toBe(true);
  expect(result.routeSectionTabFrames).toBe(0);
  expect(result.routeSectionTabFrameObjects.map((frame: { width: number }) => frame.width).sort((a: number, b: number) => a - b))
    .toEqual([]);
  expect(result.routeSectionTabFrameObjects.every((frame: { name: string; height: number; visible: boolean }) => (
    frame.name === 'deck-review-section-tab-frame'
    && [32, 34].includes(frame.height)
    && frame.visible
  ))).toBe(true);
  expect(result.routeRowFrames).toBe(0);
  expect(result.routeRowFrameObjects.every((frame: { name: string; width: number; height: number; visible: boolean }) => (
    frame.name === 'deck-review-row-frame'
    && frame.width === 334
    && frame.height === 44
    && frame.visible
  ))).toBe(true);
  expect(result.routeScrollButtonFrames).toBe(0);
  expect(result.routeScrollButtonFrameObjects).toEqual([]);
  expect(result.routeScrollButtonFrameObjects.every((frame: { name: string; width: number; height: number; visible: boolean }) => (
    frame.name === 'deck-review-scroll-button-frame'
    && frame.width === 82
    && frame.height === 34
    && frame.visible
  ))).toBe(true);
  expect(result.battleOpen).toBe('deck');
  expect(result.battleInspectRenderer).toEqual({ requested: true, loaded: true, failed: false });
  expect(result.battleFlourish).toBe(0);
  expect(result.battleRowFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.battleRowFrames).toBe(0);
  expect(result.battleReadableRows).toHaveLength(6); // six rows per page, spaced so touch areas never meet
  expect(result.battleReadableRows.every((row: { size: string; resolution: number }) => row.size === '18px' && row.resolution === 2)).toBe(true);
  expect(result.battleReadControl).toBe(true);
  expect(result.battleQuietFrame).toBe(0);
  expect(result.battlePageIndicatorFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.battlePageIndicatorFrames).toBe(0);
  expect(result.battleTitlePlaqueTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.battleTitlePlaques).toBe(0);
  expect(result.battleTitlePlaqueObjects).toEqual([]);
  expect(result.battleDetailFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.battleCostBadgeTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.battleMetaChipFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.battleSectionTabFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.battleDetailFrameObjects).toEqual([]);
  expect(result.battleCostBadgeObjects).toEqual([]);
  expect(result.battleMetaChipFrameObjects).toEqual([]);
  expect(result.battleSectionTabFrameObjects).toEqual([]);
});

test('flock stats overlays use complete readable tables without decorative frames', async ({ page }) => {
  await boot(page);
  for (const key of ['RouteScene', 'BattleScene']) {
    await page.evaluate(async key => window.__birdSquadStartScene!(key, { routeNodeId: 'm1_entry' }), key);
    await page.waitForFunction(key => {
      const s: any = window.__birdSquadGame.scene.getScene(key);
      return key === 'RouteScene' ? s.routeEssentialAssetsReady : s.battleHandRendererModule && !s.combatInteractionLocked();
    }, key);
    await page.evaluate(key => {
      const s: any = window.__birdSquadGame.scene.getScene(key);
      if (key === 'RouteScene') s.openFlockOverlay(); else s.openOverlay('flock');
    }, key);
    await page.waitForFunction(key => {
      const s: any = window.__birdSquadGame.scene.getScene(key);
      return (key === 'RouteScene' ? s.children : s.root).getByName('flock-stats-reader');
    }, key);
    const result = await page.evaluate(key => {
      const s: any = window.__birdSquadGame.scene.getScene(key);
      const p = (key === 'RouteScene' ? s.children : s.root).getByName('flock-stats-reader');
      return { cells: p.list.filter((o: any) => o.name.startsWith('flock-stats-cell-')).length,
        images: p.list.filter((o: any) => o.type === 'Image').length,
        close: p.getByName('flock-stats-close').height, summary: p.getData('summary') };
    }, key);
    expect(result.cells).toBe(key === 'RouteScene' ? 36 : 40);
    expect(result.images).toBe(0); expect(result.close).toBe(58);
    expect(result.summary).toContain('Flock Stats. Reading only.');
    await page.keyboard.press('Escape');
  }
});

test('run kit drawers retain readable supplies and Waymarks without decorative frames', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const countFlourish = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-run-kit-drawer-flourish' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countFlourish(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countTileFrames = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-run-kit-item-tile-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTileFrames(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countEmptySlotFrames = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-run-kit-empty-slot-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countEmptySlotFrames(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const runState = {
      deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'cups_ace' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed: 'run-kit-drawer-flourish',
      currentHp: 36,
      scrap: 40,
      routeMarks: ['chalk_wingmark', 'wire_map', 'rain_gutter'],
      supplies: ['seed_packet', 'bottlecap_popper'],
      supplySlots: 3,
      mapIndex: 0,
      completedRouteNodeIds: [],
      currentRouteNodeId: undefined,
      routeLog: [],
      nextCombat: undefined,
      signalChoices: [],
      rewardEvents: [],
      suppliesUsed: [],
      combatResults: [],
      freePreenNextDistrict: 0
    };

    await window.__birdSquadStartScene!('RouteScene', { runState });
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 40 && !g.textures.exists('ui-icon-run-kit-drawer-flourish'); i += 1) await wait(50);
    route.openWaymarkDrawer();
    for (let i = 0; i < 80 && !route.waymarkReviewModule; i += 1) await wait(50);
    route.renderAll();
    await wait(0);
    const routeWaymarkState = JSON.parse(window.render_game_to_text!());
    const routeWaymarkFlourish = countFlourish(route.children.list);
    const routeWaymarkTileFrames = countTileFrames(route.children.list);
    route.openSupplyDrawer();
    for (let i = 0; i < 80 && !route.routeSupplyDrawerModule; i += 1) await wait(50);
    route.renderAll();
    await wait(0);
    const routeSupplyState = JSON.parse(window.render_game_to_text!());
    const routeSupplyNames = route.children.list.filter((child: any) => child.name === 'supply-drawer-item-name').map((child: any) => child.text);
    const routeSupplyBodySize = route.children.getByName('supply-drawer-rules')?.style.fontSize;
    const routeSupplyFlourish = countFlourish(route.children.list);
    const routeSupplyTileFrames = countTileFrames(route.children.list);
    const routeSupplyEmptySlotFrames = countEmptySlotFrames(route.children.list);

    g.scene.stop('RouteScene');
    await wait(0);
    const battle: any = await window.__birdSquadStartScene!('BattleScene', { runState: route.runState, routeNodeId: 'm1_entry' });
    for (let i = 0; i < 80 && (!battle.fxLayer || battle.combatAnimationPending); i += 1) await wait(50);
    battle.waymarkDrawerOpen = true;
    battle.supplyDrawerOpen = false;
    battle.renderAll();
    for (let i = 0; i < 80 && !battle.textures.exists('ui-icon-run-kit-drawer-flourish'); i += 1) await wait(50);
    battle.renderAll();
    await wait(0);
    const battleWaymarkState = battle.getTextState();
    const battleWaymarkFlourish = countFlourish(battle.root?.list ?? battle.children.list);
    const battleWaymarkTileFrames = countTileFrames(battle.root?.list ?? battle.children.list);
    battle.waymarkDrawerOpen = false;
    battle.supplyDrawerOpen = true;
    battle.renderAll();
    for (let i = 0; i < 80 && !battle.textures.exists('ui-icon-run-kit-empty-slot-frame'); i += 1) await wait(50);
    battle.renderAll();
    await wait(0);
    const battleSupplyState = battle.getTextState();
    const battleSupplyFlourish = countFlourish(battle.root?.list ?? battle.children.list);
    const battleSupplyTileFrames = countTileFrames(battle.root?.list ?? battle.children.list);

    return {
      loaded: g.textures.exists('ui-icon-run-kit-drawer-flourish'),
      tileFrameLoaded: g.textures.exists('ui-icon-run-kit-item-tile-frame'),
      emptySlotFrameLoaded: g.textures.exists('ui-icon-run-kit-empty-slot-frame'),
      routeWaymarkOpen: routeWaymarkState.waymarkDrawerOpen,
      routeWaymarkFlourish,
      routeWaymarkTileFrames,
      routeWaymarkTileTelemetry: routeWaymarkState.runKitItemTileFrame,
      routeSupplyOpen: routeSupplyState.supplyDrawerOpen,
      routeSupplyNames, routeSupplyBodySize,
      routeSupplyFlourish,
      routeSupplyTileFrames,
      routeSupplyTileTelemetry: routeSupplyState.runKitItemTileFrame,
      routeSupplyEmptySlotFrames,
      routeSupplyEmptySlotTelemetry: routeSupplyState.runKitEmptySlotFrame,
      battleWaymarkOpen: battleWaymarkState.waymarkDrawerOpen,
      battleWaymarkFlourish,
      battleWaymarkTileFrames,
      battleWaymarkTileTelemetry: battleWaymarkState.runKitItemTileFrame,
      battleSupplyOpen: battleSupplyState.supplyDrawerOpen,
      battleSupplyFlourish,
      battleSupplyTileFrames,
      battleSupplyTileTelemetry: battleSupplyState.runKitItemTileFrame,
      battleSupplyEmptySlotFrames: countEmptySlotFrames(battle.root?.list ?? battle.children.list),
      battleSupplyEmptySlotTelemetry: battleSupplyState.runKitEmptySlotFrame
    };
  });

  expect(result.loaded).toBe(true);
  expect(result.tileFrameLoaded).toBe(true);
  expect(result.emptySlotFrameLoaded).toBe(true);
  expect(result.routeWaymarkOpen).toBe(true);
  expect(result.routeWaymarkFlourish).toBe(0);
  expect(result.routeWaymarkTileFrames).toBe(0);
  expect(result.routeWaymarkTileTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.routeSupplyOpen).toBe(true);
  expect(result.routeSupplyNames).toEqual(['Seed Packet', 'Bottlecap Popper']);
  expect(result.routeSupplyBodySize).toBe('22px');
  expect(result.routeSupplyFlourish).toBe(0);
  expect(result.routeSupplyTileFrames).toBe(0);
  expect(result.routeSupplyTileTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.routeSupplyEmptySlotFrames).toBe(0);
  expect(result.routeSupplyEmptySlotTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.battleWaymarkOpen).toBe(true);
  expect(result.battleWaymarkFlourish).toBe(0);
  expect(result.battleWaymarkTileFrames).toBe(0);
  expect(result.battleWaymarkTileTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.battleSupplyOpen).toBe(true);
  expect(result.battleSupplyFlourish).toBe(0);
  expect(result.battleSupplyTileFrames).toBe(0);
  expect(result.battleSupplyTileTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.battleSupplyEmptySlotFrames).toBe(0);
  expect(result.battleSupplyEmptySlotTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
});

test('combat draw and discard piles keep clear counts without decorative docks', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-pile-dock' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatPileDock?.loaded) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!());
    return {
      combatPileDock: state.combatPileDock,
      pileDockObjects: countTexture(battle.root?.list ?? battle.children.list),
      labels: battle.root.list.filter((child: any) => child.name === 'combat-pile-label').map((child: any) => child.text),
      counts: battle.root.list.filter((child: any) => child.name === 'combat-pile-count').map((child: any) => child.text),
      expectedCounts: [`${battle.drawPile.length}`, `${battle.discardPile.length}`],
      hitCount: battle.root.list.filter((child: any) => child.name === 'combat-pile-hit' && child.input?.enabled).length,
    };
  });

  expect(result.combatPileDock).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.pileDockObjects).toBe(0);
  expect(result.labels).toEqual(['DRAW', 'DISCARD']);
  expect(result.counts).toEqual(result.expectedCounts);
  expect(result.hitCount).toBe(2);
});

test('combat pile inspector retains authored art with a quiet readable detail surface', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    window.__birdSquadGame.scene.stop('MenuScene');
  });
  await page.waitForFunction(() => {
    const b: any = window.__birdSquadGame.scene.getScene('BattleScene');
    return b.hand?.length && !b.combatAnimationPending;
  });
  await page.evaluate(() => (window.__birdSquadGame.scene.getScene('BattleScene') as any).openOverlay('draw'));
  await page.waitForFunction(() => {
    const b: any = window.__birdSquadGame.scene.getScene('BattleScene');
    return b.root.getByName('combat-pile-card-art') && b.root.getByName('combat-pile-read-hit');
  });
  const result = await page.evaluate(() => {
    const b: any = window.__birdSquadGame.scene.getScene('BattleScene');
    return {
      overlay: b.inspectOverlay,
      frames: b.root.list.filter((o: any) => o.name === 'combat-pile-review-frame').length,
      art: b.root.getByName('combat-pile-card-art')?.texture.key,
      reading: b.root.getByName('combat-pile-read-label').text,
      rowSizes: b.root.list.filter((o: any) => o.name === 'combat-pile-row-title').map((o: any) => o.style.fontSize),
      chipFrames: b.root.list.filter((o: any) => ['combat-pile-detail-chip-frame', 'combat-pile-stat-chip-frame'].includes(o.name)).length,
    };
  });
  expect(result.overlay).toBe('draw');
  expect(result.frames).toBe(0);
  expect(result.art).toBeTruthy();
  expect(result.reading).toContain('Full rules');
  expect(result.rowSizes.length).toBeGreaterThan(0);
  expect(result.rowSizes.every((size: string) => size === '18px')).toBe(true);
  expect(result.chipFrames).toBe(0);
});

test('combat pile inspector supports keyboard and controller navigation accessibly', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    game.scene.stop('MenuScene');
    const battle: any = game.scene.getScene('BattleScene');
    for (let index = 0; index < 60 && !battle.hand?.length; index += 1) await wait(50);
    const seed = battle.hand[0] ?? battle.drawPile[0];
    if (!seed) throw new Error('No card available for accessible inspector setup');
    battle.drawPile = Array.from({ length: 12 }, (_, index) => ({
      ...seed,
      instanceId: `accessible-inspect-${String(index).padStart(2, '0')}`,
    }));
    battle.discardPile = Array.from({ length: 2 }, (_, index) => ({
      ...seed,
      instanceId: `accessible-discard-${String(index).padStart(2, '0')}`,
    }));
    battle.clearedPile = [{
      ...seed,
      instanceId: 'accessible-cleared-00',
    }];
    battle.openOverlay('draw');
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.battleInspectRenderer?.loaded && state.cardInspectFocus?.count === 12;
  });
  await page.waitForFunction(() => document.getElementById('game-status')?.textContent?.includes('draw pile'));
  const initial = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(initial.cardInspectFocus).toMatchObject({
    active: true,
    overlay: 'draw',
    instanceId: 'accessible-inspect-00',
    index: 0,
    count: 12,
    visibleStart: 1,
    visibleEnd: 6,
    zoneCounts: { deck: expect.any(Number), draw: 12, discard: 2, cleared: 1 },
    bindings: { select: 'Up / Down', previousZone: 'Left', nextZone: 'Right', back: 'Esc' },
    controller: { choose: 'D-pad Up / Down', zone: 'D-pad Left / Right', page: 'LB / RB', back: 'B' },
  });

  const clearedPoint = await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const target = battle.root.list.find((child: any) => child.name === 'combat-pile-zone-cleared-hit');
    return { x: target.x, y: target.y };
  });
  const canvasBounds = await page.locator('canvas').boundingBox();
  if (!canvasBounds) throw new Error('Missing game canvas');
  const clearedCanvasPoint = {
    x: canvasBounds.x + canvasBounds.width * (clearedPoint.x / 1280),
    y: canvasBounds.y + canvasBounds.height * (clearedPoint.y / 720),
  };
  await page.mouse.move(clearedCanvasPoint.x, clearedCanvasPoint.y);
  await page.waitForTimeout(80);
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardInspectFocus))
    .toMatchObject({ overlay: 'cleared', instanceId: 'accessible-cleared-00', count: 1 });
  await page.waitForFunction(() => document.getElementById('game-status')?.textContent?.includes('cleared pile'));

  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardInspectFocus))
    .toMatchObject({ overlay: 'discard', instanceId: 'accessible-discard-00', count: 2 });
  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.input.gamepad.emit('down', {}, { index: 14 });
  });
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardInspectFocus))
    .toMatchObject({ overlay: 'draw', instanceId: 'accessible-inspect-00', count: 12 });

  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardInspectFocus?.instanceId))
    .toBe('accessible-inspect-01');
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardInspectFocus?.instanceId))
    .toBe('accessible-inspect-02');
  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.input.gamepad.emit('down', {}, { index: 5 });
  });
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardInspectFocus))
    .toMatchObject({
      instanceId: 'accessible-inspect-08',
      index: 8,
      visibleStart: 4,
      visibleEnd: 9,
    });
  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.input.gamepad.emit('down', {}, { index: 12 });
  });
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardInspectFocus?.instanceId))
    .toBe('accessible-inspect-07');
  await page.waitForFunction(() => document.getElementById('game-status')?.textContent?.includes('Selected 8 of 12'));
  await page.screenshot({ path: '.artifacts/test-results/combat-pile-accessibility/minimum-landscape-controller-page.png' });

  const navigated = await page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const rows = battle.root.list.filter((child: any) => child.name === 'combat-pile-row-hit');
    const zoneTargets = battle.root.list.filter((child: any) => child.name?.startsWith('combat-pile-zone-') && child.name.endsWith('-hit'));
    const hint = battle.root.list.find((child: any) => child.name === 'combat-pile-input-hint');
    const focusRings = battle.root.list.filter((child: any) => child.name === 'combat-pile-input-focus-ring');
    const scale = document.querySelector('canvas')!.getBoundingClientRect().width / 1280;
    return {
      state,
      rows: rows.map((row: any) => ({
        instanceId: row.getData('instanceId'),
        selected: row.getData('selected'),
        width: row.width,
        height: row.height,
        cssWidth: Number((row.displayWidth * scale).toFixed(1)),
        cssHeight: Number((row.displayHeight * scale).toFixed(1)),
      })),
      zoneTargets: zoneTargets.map((target: any) => ({
        mode: target.getData('mode'),
        active: target.getData('active'),
        width: target.width,
        height: target.height,
        cssWidth: Number((target.displayWidth * scale).toFixed(1)),
        cssHeight: Number((target.displayHeight * scale).toFixed(1)),
      })),
      hint: hint?.text,
      focusRings: focusRings.map((ring: any) => ({
        instanceId: ring.getData('instanceId'),
        width: ring.width,
        height: ring.height,
        lineWidth: ring.geom?.lineWidth ?? ring.lineWidth,
      })),
      announcement: document.getElementById('game-status')?.textContent ?? '',
    };
  });
  expect(navigated.state.cardInspectFocus).toMatchObject({
    instanceId: 'accessible-inspect-07',
    index: 7,
    count: 12,
    visibleStart: 4,
    visibleEnd: 9,
  });
  expect(navigated.state.inspectedCard.id).toBe(initial.inspectedCard.id);
  expect(navigated.rows).toHaveLength(6);
  expect(navigated.rows.filter((row: any) => row.selected)).toEqual([
    expect.objectContaining({ instanceId: 'accessible-inspect-07' }),
  ]);
  expect(navigated.rows.every((row: any) => row.width === 312 && row.height === 58)).toBe(true);
  expect(navigated.rows.every((row: any) => row.cssWidth >= 44 && row.cssHeight >= 44)).toBe(true);
  expect(navigated.zoneTargets).toHaveLength(4);
  expect(navigated.zoneTargets.map((target: any) => target.mode)).toEqual(['deck', 'draw', 'discard', 'cleared']);
  expect(navigated.zoneTargets.filter((target: any) => target.active)).toEqual([
    expect.objectContaining({ mode: 'draw' }),
  ]);
  expect(navigated.zoneTargets.every((target: any) => target.width === 236 && target.height === 58)).toBe(true);
  expect(navigated.zoneTargets.every((target: any) => target.cssWidth >= 44 && target.cssHeight >= 44)).toBe(true);
  expect(navigated.focusRings).toEqual([
    expect.objectContaining({ instanceId: 'accessible-inspect-07', width: 326, height: 58 }),
  ]);
  expect(navigated.hint).toContain('D-pad: card / pile');
  expect(navigated.hint).toContain('LB / RB: page');
  expect(navigated.announcement).toContain('draw pile');
  expect(navigated.announcement).toContain('Selected 8 of 12');
  expect(navigated.announcement).toContain('Draw 12, Discard 2, Cleared 1');
  expect(navigated.announcement).toContain('switch zones');
  expect(navigated.announcement).toContain('controller shoulders to page');

  const beforeClose = navigated.state;
  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.input.gamepad.emit('down', {}, { index: 1 });
  });
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').inspectOverlay))
    .toBeUndefined();
  const closed = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(closed).toMatchObject({
    mode: 'battle',
    turn: beforeClose.turn,
    energy: beforeClose.energy,
    flock: { hp: beforeClose.flock.hp },
  });
  expect(closed.cardInspectFocus).toBeUndefined();
});

test('cleared cards stay in the run deck and remain inspectable for the combat', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  await page.evaluate(async () => {
    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    const runState = structuredClone(route.runState);
    if (!runState.deck.some((card: any) => card.id === 'bent_feather')) {
      runState.deck.push({ id: 'bent_feather' });
    }
    const battle: any = await window.__birdSquadStartScene!('BattleScene', {
      runState,
      routeNodeId: 'm1_entry',
    });
    const card = [...battle.hand, ...battle.drawPile, ...battle.discardPile]
      .find((candidate: any) => candidate.id === 'bent_feather');
    if (!card) throw new Error('Bent Feather was not restored into combat');
    battle.hand = battle.hand.filter((candidate: any) => candidate.instanceId !== card.instanceId);
    battle.drawPile = battle.drawPile.filter((candidate: any) => candidate.instanceId !== card.instanceId);
    battle.discardPile = battle.discardPile.filter((candidate: any) => candidate.instanceId !== card.instanceId);
    battle.hand.unshift(card);
    battle.energy = Math.max(3, battle.energy);
    battle.playCard(card, battle.enemies[0]?.id, { resolveDelayMs: 0 });
    battle.openOverlay('cleared');
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.battleInspectRenderer?.loaded
      && state.inspectOverlay === 'cleared'
      && state.clearedPile === 1;
  });

  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardInspectFocus?.zone))
    .toBe('Cleared');
  await page.waitForFunction(() => document.getElementById('game-status')?.textContent?.includes('Bent Feather, Cleared'));
  await page.screenshot({ path: '.artifacts/test-results/cleared-card-zone/minimum-landscape-cleared-card.png' });

  const result = await page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const snapshot = { deck: battle.allDeckCards().map((card: any) => ({ id: card.id, upgraded: !!card.upgraded })) };
    const zoneControls = battle.root.list.filter((child: any) => (
      child.name?.startsWith('combat-pile-zone-') && child.name.endsWith('-hit')
    ));
    return {
      state,
      playableCards: battle.drawPile.length + battle.hand.length + battle.discardPile.length,
      clearedIds: battle.clearedPile.map((card: any) => card.id),
      permanentDeckIds: snapshot.deck.map((card: any) => card.id),
      zoneControlCount: zoneControls.length,
      activeZone: zoneControls.find((child: any) => child.getData('active'))?.getData('mode'),
      announcement: document.getElementById('game-status')?.textContent ?? '',
    };
  });

  expect(result.state).toMatchObject({
    clearedPile: 1,
    inspectedCard: {
      id: 'bent_feather',
      name: 'Bent Feather',
      zone: 'Cleared',
      activeRole: 'utility',
    },
    cardInspectFocus: {
      overlay: 'cleared',
      label: 'Bent Feather',
      zone: 'Cleared',
    },
    piles: {
      deck: result.playableCards + 1,
      draw: expect.any(Number),
      hand: expect.any(Number),
      discard: expect.any(Number),
      cleared: 1,
    },
  });
  expect(result.state.deckSize).toBe(result.playableCards + 1);
  expect(result.clearedIds).toEqual(['bent_feather']);
  expect(result.permanentDeckIds).toContain('bent_feather');
  expect(result.zoneControlCount).toBe(4);
  expect(result.activeZone).toBe('cleared');
  expect(result.announcement).toContain('cleared pile');
  expect(result.announcement).toContain('Bent Feather, Cleared');
});

test('singleton deck rejects duplicate Snags and preserves upgraded save state', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);

  const routeResult = await page.evaluate(async () => {
    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    route.runState.deck = route.runState.deck.filter((card: any) => (
      card.id !== 'bent_feather' && card.id !== 'tangled_line'
    ));
    route.runState.deck.push({ id: 'bent_feather', upgraded: false });
    const before = route.runState.deck.length;
    route.resolveRouteEffect('addSnagToDiscard(bent_feather)');
    route.resolveRouteEffect('addSnagToDraw(bent_feather)');
    const preview = route.routeChoicePreviewRows({
      key: 'singleton_safety',
      text: 'Take the same Snag again.',
      effects: ['addSnagToDiscard(bent_feather)'],
      locked: false,
    }).find((row: any) => row.label === 'Deck');
    const restoredRunState = structuredClone(route.runState);
    restoredRunState.deck.push({ id: 'bent_feather', upgraded: true });
    return {
      before,
      after: route.runState.deck.length,
      bentCount: route.runState.deck.filter((card: any) => card.id === 'bent_feather').length,
      preview,
      routeLog: [...route.runState.routeLog],
      restoredRunState,
    };
  });

  expect(routeResult.after).toBe(routeResult.before);
  expect(routeResult.bentCount).toBe(1);
  expect(routeResult.preview).toEqual(expect.objectContaining({
    before: String(routeResult.before),
    after: String(routeResult.before),
  }));
  expect(routeResult.routeLog.at(-1)).toContain('cannot carry a second copy');

  await page.evaluate(async (runState) => {
    const battle: any = await window.__birdSquadStartScene!('BattleScene', {
      runState,
      routeNodeId: 'm1_entry',
    });
    const enemy = battle.enemies[0];
    if (!enemy) throw new Error('Missing enemy for singleton Snag test');
    battle.resolveEnemyEffect(enemy, 'addSnagToDiscard(bent_feather)', 'Singleton test');
    battle.resolveEnemyEffect(enemy, 'addSnagToDraw(tangled_line)', 'Singleton test');
    battle.resolveEnemyEffect(enemy, 'addSnagToDraw(tangled_line)', 'Singleton test');
    battle.openOverlay('deck');
  }, routeResult.restoredRunState);

  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.battleInspectRenderer?.loaded && state.inspectOverlay === 'deck';
  });
  for (let index = 0; index < 30; index += 1) {
    const selectedId = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').inspectedCard?.id);
    if (selectedId === 'tangled_line') break;
    await page.keyboard.press('ArrowDown');
  }
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').inspectedCard?.id))
    .toBe('tangled_line');
  await page.screenshot({ path: '.artifacts/test-results/singleton-deck/minimum-landscape-singleton-snag.png' });

  const battleResult = await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const allCards = battle.allDeckCards();
    const snapshot = { deck: battle.allDeckCards().map((card: any) => ({ id: card.id, upgraded: !!card.upgraded })) };
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      bent: allCards.filter((card: any) => card.id === 'bent_feather')
        .map((card: any) => ({ upgraded: card.upgraded === true })),
      tangledCount: allCards.filter((card: any) => card.id === 'tangled_line').length,
      savedBent: snapshot.deck.filter((card: any) => card.id === 'bent_feather'),
      savedTangledCount: snapshot.deck.filter((card: any) => card.id === 'tangled_line').length,
      log: [...battle.log],
      announcement: document.getElementById('game-status')?.textContent ?? '',
    };
  });

  expect(battleResult.bent).toEqual([{ upgraded: true }]);
  expect(battleResult.tangledCount).toBe(1);
  expect(battleResult.savedBent).toEqual([{ id: 'bent_feather', upgraded: true }]);
  expect(battleResult.savedTangledCount).toBe(1);
  expect(battleResult.log.filter((entry: string) => entry.includes('Snag fails'))).toHaveLength(2);
  expect(battleResult.state.deckIds.filter((id: string) => id === 'bent_feather')).toHaveLength(1);
  expect(battleResult.state.deckIds.filter((id: string) => id === 'tangled_line')).toHaveLength(1);
  expect(battleResult.state.inspectedCard).toMatchObject({
    id: 'tangled_line',
    name: 'Tangled Line',
  });
  await expect(page.locator('#game-status')).toContainText('Tangled Line');
});
