import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { settleCanvas } from './helpers/settled-canvas';
import { boot, clickNamedGameObject } from './helpers/smoke';

// Split from the former tests/smoke.spec.ts (codex topics). Tests drive
// scenes through the deterministic text-state harness on window.

test('Codex scene stays out of boot and opens on demand from the menu', async ({ page }) => {
  await boot(page);
  const before = await page.evaluate(() => ({
    registered: Boolean(window.__birdSquadGame.scene.keys?.CodexScene),
    requested: performance.getEntriesByType('resource').some((entry) => entry.name.includes('codex-scene')),
    confirmCues: window.__birdSquadAudio?.().cueRequests?.confirm ?? 0,
  }));
  expect(before.registered).toBe(false);
  expect(before.requested).toBe(false);

  const buttonActivated = await page.evaluate(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    const codexButton = menu.menuFocusTargets.get('codex');
    codexButton?.emit('pointerdown');
    return Boolean(codexButton);
  });
  expect(buttonActivated).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__birdSquadGame.scene.isActive('CodexScene')), {
    timeout: 15_000,
  }).toBe(true);

  const after = await page.evaluate(() => ({
    registered: Boolean(window.__birdSquadGame.scene.keys?.CodexScene),
    active: window.__birdSquadGame.scene.isActive('CodexScene'),
    menuActive: window.__birdSquadGame.scene.isActive('MenuScene'),
    requested: performance.getEntriesByType('resource').some((entry) => entry.name.includes('codex-scene')),
    confirmCues: window.__birdSquadAudio?.().cueRequests?.confirm ?? 0,
    loadingNoticeActive: window.__birdSquadGame.scene.getScene('MenuScene').children.list
      .some((child: any) => child.name === 'codex-scene-loading' && child.active),
  }));
  expect(after).toEqual({
    registered: true,
    active: true,
    menuActive: false,
    requested: true,
    confirmCues: before.confirmCues + 1,
    loadingNoticeActive: false,
  });
});

test('Codex browsing follows remapped keyboard, gamepad, visible focus, and screen-reader state', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('birdsquad.controlBindings', JSON.stringify({
      version: 1,
      bindings: { confirm: 'Space', back: 'KeyQ', previous: 'KeyA', next: 'KeyD' },
    }));
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    await window.__birdSquadStartScene!('CodexScene');
    window.__birdSquadGame.scene.stop('MenuScene');
  });
  const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}'));
  await expect.poll(async () => (await state()).mode, { timeout: 20_000 }).toBe('codex');
  await expect.poll(async () => (await state()).codexFocus?.ringRendered).toBe(true);

  const initial = await state();
  expect(initial.codexFocus).toMatchObject({
    zone: 'sections', label: 'Cards section', previous: 'A', next: 'D', confirm: 'Space', back: 'Q', ringRendered: true,
  });

  await page.keyboard.press('d');
  await expect.poll(async () => (await state()).section).toBe('items');
  expect((await state()).codexFocus).toMatchObject({ zone: 'sections', label: 'Items section' });
  await page.keyboard.press('Tab');
  expect((await state()).codexFocus).toMatchObject({ zone: 'primaryTabs', label: 'All filter' });
  await page.keyboard.press('d');
  expect((await state()).codexFocus).toMatchObject({ zone: 'primaryTabs', label: 'Waymarks filter' });
  await page.keyboard.press('Tab');
  expect((await state()).codexFocus).toMatchObject({ zone: 'secondaryTabs', label: 'All filter' });
  await page.keyboard.press('d');
  expect((await state()).codexFocus).toMatchObject({ zone: 'secondaryTabs', label: 'Shelter filter' });
  await page.keyboard.press('a');
  expect((await state()).codexFocus).toMatchObject({ zone: 'secondaryTabs', label: 'All filter' });
  await page.keyboard.press('Tab');
  const entryStart = await state();
  expect(entryStart.codexFocus).toMatchObject({ zone: 'entries', index: 0, ringRendered: true });
  expect(entryStart.codexFocus.count).toBeGreaterThan(8);

  const gamepadDown = (index: number) => page.evaluate((buttonIndex) => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    codex.input.gamepad.emit('down', codex.input.gamepad.pad1, { index: buttonIndex }, 1);
  }, index);
  await gamepadDown(13);
  expect((await state()).codexFocus.index).toBe(3);
  await gamepadDown(13);
  const scrolled = await state();
  expect(scrolled.codexFocus.index).toBe(6);
  expect(scrolled.codexFocus.gridScroll).toBeGreaterThan(0);
  await gamepadDown(15);
  expect((await state()).codexFocus.index).toBe(7);
  await gamepadDown(13);
  expect((await state()).codexFocus.index).toBe(10);
  expect((await state()).codexFocus.gridScroll).toBeGreaterThan(0);
  const selectedLabel = (await state()).codexFocus.label;
  await gamepadDown(0);
  await expect.poll(async () => (await state()).codexFocus?.zone).toBe('detail');
  const opened = await state();
  expect(opened.detailOpen).not.toBe('');
  expect(opened.codexFocus).toMatchObject({ label: `Close ${selectedLabel} detail`, ringRendered: true });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain(selectedLabel);
  expect(await page.evaluate(() => document.getElementById('game-status')?.textContent ?? '')).toContain('Detail open');

  await gamepadDown(1);
  await expect.poll(async () => (await state()).codexFocus?.zone).toBe('entries');
  expect((await state()).detailOpen).toBe('');
  await page.keyboard.press('q');
  await expect.poll(() => page.evaluate(() => window.__birdSquadGame.scene.isActive('MenuScene'))).toBe(true);
});

test('codex: starting a run discovers its deck and the Codex screen renders', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    window.localStorage.removeItem('birdsquad.account'); // fresh: nothing discovered yet
    await window.__birdSquadStartScene!('MenuScene');
    await wait(120);
    const m: any = g.scene.getScene('MenuScene');
    for (let i = 0; i < 20 && !(m.leaderPanels && m.leaderPanels.length); i += 1) await wait(50);
    for (let i = 0; i < 40; i += 1) {
      const ready = m.children.list.some((child: any) => child.name === 'title-utility-hit'
        && child.getData('label') === 'Collection' && child.input?.enabled);
      if (ready) break;
      await wait(50);
    }
    const codexIconLoaded = m.textures.exists('ui-icon-codex-medallion');
    const codexIconRendered = m.children.list.some((child: any) => child.texture?.key === 'ui-icon-codex-medallion');
    const codexControlRendered = m.children.list.some((child: any) => child.name === 'title-utility-hit'
      && child.getData('label') === 'Collection' && child.visible && child.input?.enabled);
    m.selectLeader('spark_caller');
    m.startRun(); // createInitialRunState marks the starting deck discovered
    await wait(150);
    const acct = JSON.parse(window.localStorage.getItem('birdsquad.account') || '{}');
    const discoveredCount = (acct.discoveredCards || []).length;
    const collectionRecords = Object.values(acct.cardCollection ?? {});
    const newlyAcquiredIds = Object.entries(acct.cardCollection ?? {})
      .filter(([, record]: [string, any]) => record.isNew === true)
      .map(([id]) => id);
    const collectionAchievementIds = (acct.achievements ?? [])
      .filter((id: string) => id.startsWith('collection_'));
    await window.__birdSquadStartScene!('CodexScene');
    await wait(200);
    const active = g.scene.getScenes(true).map((s: any) => s.scene.key).includes('CodexScene');
    const cs: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 60; i += 1) {
      const collect = (node: any): any[] => {
        const children = node?.list ?? [];
        return children.flatMap((child: any) => [child, ...collect(child)]);
      };
      const ready = cs.textures.exists('ui-icon-codex-locked-card-medallion')
        && cs.textures.exists('ui-icon-codex-back-command-frame')
        && cs.textures.exists('ui-icon-codex-tab-frame')
        && cs.textures.exists('ui-icon-codex-close-command-frame')
        && cs.textures.exists('ui-icon-codex-scroll-cue-frame')
        && cs.textures.exists('ui-icon-codex-grid-scroll-cue-frame')
        && cs.textures.exists('ui-icon-codex-cards-medallion')
        && cs.textures.exists('ui-icon-codex-major-medallion')
        && cs.textures.exists('ui-icon-codex-aviary-medallion')
        && cs.textures.exists('ui-icon-codex-plumes-medallion')
        && cs.textures.exists('ui-icon-codex-quills-medallion')
        && cs.textures.exists('ui-icon-codex-basins-medallion')
        && cs.textures.exists('ui-icon-codex-nests-medallion')
        && collect(cs.root).some((child: any) => child.name === 'codex-back-hit')
        && collect(cs.root).some((child: any) => child.name === 'codex-tab-surface')
        && collect(cs.root).some((child: any) => child.name === 'codex-grid-scroll-cue-frame')
        && collect(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-locked-card-medallion');
      if (ready) break;
      await wait(50);
    }
    const collect = (node: any): any[] => {
      const children = node?.list ?? [];
      return children.flatMap((child: any) => [child, ...collect(child)]);
    };
    const lockedCardMedallions = collect(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-locked-card-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const cardsTabMedallions = collect(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-cards-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const backCommandFrames = collect(cs.root)
      .filter((child: any) => child.name === 'codex-back-hit')
      .map((child: any) => ({
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const codexTabFrames = collect(cs.root)
      .filter((child: any) => child.name === 'codex-tab-surface')
      .map((child: any) => ({
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name,
        active: child.getData('active'),
        label: child.getData('label')
      }));
    const codexGridScrollCueFrames = collect(cs.root)
      .filter((child: any) => child.name === 'codex-grid-scroll-cue-frame' && child.type === 'Rectangle')
      .map((child: any) => ({
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const codexGridScrollCueFrame = JSON.parse(window.render_game_to_text!()).codexGridScrollCueFrame;
    const codexGridOverflow = cs.gridMaxScroll > 0;
    const majorTabMedallions = collect(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-major-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const aviaryTabMedallions = collect(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-aviary-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    cs.activeTab = 1;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const activeAviaryTabMedallions = collect(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-aviary-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const suitTabResults: Array<{ label: string; textureKey: string; loaded: boolean; medallions: Array<{ alpha: number; visible: boolean }> }> = [];
    const suitTabIndexes = [
      { label: 'Plumes', index: 2, textureKey: 'ui-icon-codex-plumes-medallion' },
      { label: 'Quills', index: 3, textureKey: 'ui-icon-codex-quills-medallion' },
      { label: 'Basins', index: 4, textureKey: 'ui-icon-codex-basins-medallion' },
      { label: 'Nests', index: 5, textureKey: 'ui-icon-codex-nests-medallion' },
    ];
    for (const suit of suitTabIndexes) {
      cs.activeTab = suit.index;
      cs.detailId = undefined;
      cs.gridScroll = 0;
      cs.gridScrollTarget = 0;
      cs.renderAll();
      suitTabResults.push({
        label: suit.label,
        textureKey: suit.textureKey,
        loaded: cs.textures.exists(suit.textureKey),
        medallions: collect(cs.root)
          .filter((child: any) => child.texture?.key === suit.textureKey)
          .map((child: any) => ({ alpha: child.alpha, visible: child.visible }))
      });
    }
    const detailCard = cs.allCards().find((card: any) => cs.discovered.has(card.id)) ?? cs.allCards()[0];
    cs.activeSection = 'cards';
    cs.activeTab = 0;
    cs.detailId = detailCard.id;
    cs.detailScroll = 0;
    cs.detailScrollTarget = 0;
    cs.renderAll();
    for (let i = 0; i < 40; i += 1) {
      const ready = collect(cs.root).some((child: any) => child.name === 'codex-detail-close-hit' && child.visible);
      if (ready) break;
      await wait(50);
    }
    const codexArtPreviewFrames = collect(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-art-preview-frame')
      .map((child: any) => ({
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const codexCloseFrames = collect(cs.root)
      .filter((child: any) => child.name === 'codex-detail-close-hit')
      .map((child: any) => ({
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const codexScrollCueFrames = collect(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-scroll-cue-frame')
      .map((child: any) => ({
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const codexDetailState = JSON.parse(window.render_game_to_text!());
    return {
      discoveredCount,
      collectionRecords,
      newlyAcquiredIds,
      collectionAchievementIds,
      active,
      codexFound: cs.discovered ? cs.discovered.size : 0,
      codexIconLoaded,
      codexIconRendered,
      codexControlRendered,
      codexBackCommandFrame: JSON.parse(window.render_game_to_text!()).codexBackCommandFrame,
      codexTabFrame: JSON.parse(window.render_game_to_text!()).codexTabFrame,
      codexCloseCommandFrame: codexDetailState.codexCloseCommandFrame,
      codexScrollCueFrame: codexDetailState.codexScrollCueFrame,
      codexArtPreviewFrame: codexDetailState.codexArtPreviewFrame,
      codexGridScrollCueFrame,
      codexGridOverflow,
      detailOpen: codexDetailState.detailOpen,
      backCommandFrames,
      codexTabFrames,
      codexGridScrollCueFrames,
      codexArtPreviewFrames,
      codexCloseFrames,
      codexScrollCueFrames,
      cardsTabTextureLoaded: cs.textures.exists('ui-icon-codex-cards-medallion'),
      cardsTabMedallions,
      majorTabTextureLoaded: cs.textures.exists('ui-icon-codex-major-medallion'),
      majorTabMedallions,
      aviaryTabTextureLoaded: cs.textures.exists('ui-icon-codex-aviary-medallion'),
      aviaryTabMedallions,
      activeAviaryTabMedallions,
      suitTabResults,
      lockedCardTextureLoaded: cs.textures.exists('ui-icon-codex-locked-card-medallion'),
      lockedCardMedallions
    };
  });
  expect(r.discoveredCount).toBeGreaterThanOrEqual(8); // Spark-Caller's 10-card deck (distinct ids)
  expect(r.collectionRecords).toHaveLength(r.discoveredCount);
  expect(r.newlyAcquiredIds).toHaveLength(r.discoveredCount);
  expect(r.collectionAchievementIds).toEqual([
    'collection_first_shelf',
  ]);
  expect(r.collectionRecords.every((record: any) => (
    record.timesClaimed === 1
    && record.firstSource === 'starter_flock'
    && record.firstAcquiredAt > 0
  ))).toBe(true);
  expect(r.active).toBe(true);
  expect(r.codexFound).toBeGreaterThanOrEqual(8);
  expect(r.codexIconLoaded).toBe(true);
  expect(r.codexIconRendered).toBe(false);
  expect(r.codexControlRendered).toBe(true);
  expect(r.codexBackCommandFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(r.codexTabFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(r.codexCloseCommandFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(r.codexScrollCueFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(r.codexArtPreviewFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(r.codexGridScrollCueFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(r.detailOpen).toBeTruthy();
  expect(r.backCommandFrames).toHaveLength(1);
  expect(r.backCommandFrames[0]).toMatchObject({ name: 'codex-back-hit', visible: true });
  expect(r.backCommandFrames[0].displayWidth).toBe(132);
  expect(r.backCommandFrames[0].displayHeight).toBe(58);
  expect(r.backCommandFrames[0].alpha).toBeGreaterThan(0.85);
  expect(r.codexCloseFrames).toHaveLength(1);
  expect(r.codexCloseFrames[0]).toMatchObject({ name: 'codex-detail-close-hit', visible: true });
  expect(r.codexCloseFrames[0].displayWidth).toBe(80);
  expect(r.codexCloseFrames[0].displayHeight).toBe(58);
  expect(r.codexCloseFrames[0].alpha).toBeGreaterThan(0.85);
  expect(r.codexScrollCueFrames).toEqual([]); // The card dossier has explicit page controls.
  expect(r.codexArtPreviewFrames).toEqual([]);
  expect(r.codexTabFrames).toHaveLength(14);
  expect(r.codexTabFrames.every((frame: { name: string; visible: boolean }) => frame.name === 'codex-tab-surface' && frame.visible)).toBe(true);
  expect(r.codexTabFrames.filter((frame: { active: boolean }) => frame.active).map((frame: { label: string }) => frame.label)).toEqual(['Cards', 'Major']);
  expect(r.codexTabFrames.filter((frame: { active: boolean }) => frame.active).every((frame: { alpha: number }) => frame.alpha === 1)).toBe(true);
  expect(r.codexTabFrames.filter((frame: { active: boolean }) => !frame.active).every((frame: { alpha: number }) => frame.alpha === 1)).toBe(true);
  expect(r.codexTabFrames.every((frame: { displayHeight: number }) => frame.displayHeight >= 35)).toBe(true);
  expect(r.codexGridScrollCueFrames).toHaveLength(r.codexGridOverflow ? 1 : 0);
  expect(r.cardsTabTextureLoaded).toBe(true);
  expect(r.cardsTabMedallions).toEqual([]);
  expect(r.majorTabTextureLoaded).toBe(true);
  expect(r.majorTabMedallions).toEqual([]);
  expect(r.aviaryTabTextureLoaded).toBe(true);
  expect(r.aviaryTabMedallions).toEqual([]);
  expect(r.activeAviaryTabMedallions).toEqual([]);
  expect(r.suitTabResults.map((result: { label: string }) => result.label)).toEqual(['Plumes', 'Quills', 'Basins', 'Nests']);
  for (const result of r.suitTabResults as Array<{ loaded: boolean; medallions: Array<{ alpha: number; visible: boolean }> }>) {
    expect(result.loaded).toBe(true);
    expect(result.medallions).toEqual([]);
  }
  expect(r.lockedCardTextureLoaded).toBe(true);
  expect(r.lockedCardMedallions.length).toBeGreaterThan(0);
  expect(r.lockedCardMedallions.every((icon: { alpha: number }) => icon.alpha > 0.35 && icon.alpha < 0.5)).toBe(true);
});

test('codex: discovered cards can be favorited persistently with pointer, keyboard, and controller', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    window.localStorage.setItem('birdsquad.account', JSON.stringify({
      discoveredCards: ['major_00'],
      favoriteCards: ['not_discovered'],
    }));
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 0;
    cs.detailId = 'major_00';
    cs.detailScroll = 0;
    cs.detailScrollTarget = 0;
    cs.renderAll();
  });

  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const cs: any = window.__birdSquadGame?.scene?.getScene('CodexScene');
    return state.cardFavorites?.count === 0
      && state.cardFavorites?.detailId === 'major_00'
      && cs?.root?.getByName?.('codex-card-favorite-hit')?.input?.enabled;
  });
  await page.waitForFunction(() => !window.__birdSquadGame.scene.getScene('CodexScene').load.isLoading());
  await settleCanvas(page);

  const favoritePoint = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = cs.root.getByName('codex-card-favorite-hit');
    const point = hit.getWorldTransformMatrix().transformPoint(0, 0);
    return { x: point.x, y: point.y, width: hit.displayWidth, height: hit.displayHeight };
  });
  expect(favoritePoint.width).toBeGreaterThanOrEqual(142);
  expect(favoritePoint.height).toBeGreaterThanOrEqual(46);
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.click(
    canvas.x + canvas.width * (favoritePoint.x / 1280),
    canvas.y + canvas.height * (favoritePoint.y / 720),
  );
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardFavorites?.detailFavorite === true);

  const pointerState = await page.evaluate(() => ({
    state: JSON.parse(window.render_game_to_text?.() ?? '{}').cardFavorites,
    account: JSON.parse(window.localStorage.getItem('birdsquad.account') ?? '{}'),
  }));
  expect(pointerState.state).toMatchObject({
    count: 1,
    ids: ['major_00'],
    detailId: 'major_00',
    detailFavorite: true,
    keyboard: 'C',
    controller: 'X',
  });
  expect(pointerState.account.favoriteCards).toEqual(['major_00']);

  await page.keyboard.press('c');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardFavorites?.detailFavorite === false);

  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.input.gamepad.emit('down', {}, { index: 2 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardFavorites?.detailFavorite === true);

  const finalState = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const walk = (entry: any): any[] => [
      entry,
      ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : []),
    ];
    const markers = walk(cs.root).filter((entry: any) => entry.name === 'codex-favorite-marker');
    return {
      favoriteState: JSON.parse(window.render_game_to_text?.() ?? '{}').cardFavorites,
      markerIds: markers.map((marker: any) => marker.getData('cardId')),
      account: JSON.parse(window.localStorage.getItem('birdsquad.account') ?? '{}'),
    };
  });
  expect(finalState.favoriteState).toMatchObject({ count: 1, ids: ['major_00'], detailFavorite: false });
  expect(finalState.markerIds).toEqual(['major_00']);
  expect(finalState.account.favoriteCards).toEqual(['major_00']);
});

test('codex: protected owned cards persist across pointer keyboard controller search and backup-safe migration', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'wands_ace'],
      favoriteCards: ['major_00'],
      lockedCards: ['major_00', 'wands_ace', 'missing_card', 'major_00'],
      hunt: [],
      cardCollection: {
        major_00: {
          timesClaimed: 2,
          firstAcquiredAt: Date.UTC(2026, 6, 1),
          firstSource: 'combat_reward',
        },
      },
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    const codex: any = await window.__birdSquadStartScene!('CodexScene');
    codex.activeSection = 'cards';
    codex.activeTab = 0;
    codex.detailId = 'major_00';
    codex.detailScroll = 0;
    codex.detailScrollTarget = 0;
    codex.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const codex: any = window.__birdSquadGame?.scene?.getScene('CodexScene');
    return state.cardProtection?.detailProtected === true
      && codex?.root?.getByName?.('codex-card-protect-hit')?.input?.enabled;
  });

  const initial = await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = codex.root.getByName('codex-card-protect-hit');
    const account = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      account,
      hit: { x: hit.x, y: hit.y, width: hit.displayWidth, height: hit.displayHeight },
      label: codex.root.getByName('codex-card-protect-label')?.text,
      cardCollection: structuredClone(account.cardCollection),
      favoriteCards: structuredClone(account.favoriteCards),
    };
  });
  expect(initial.state.cardProtection).toMatchObject({
    count: 1,
    ids: ['major_00'],
    detailId: 'major_00',
    detailProtected: true,
    detailEligible: true,
    keyboard: 'T',
    controller: 'Y',
    private: true,
    includedInBackups: true,
    protectsFutureDestructiveActions: true,
    currentDestructiveActions: false,
    affectsPower: false,
    affectsRewardOdds: false,
    persisted: true,
    searchable: true,
  });
  expect(initial.account.lockedCards).toEqual(['major_00']);
  expect(initial.hit.width).toBeGreaterThanOrEqual(142);
  expect(initial.hit.height).toBeGreaterThanOrEqual(46);
  expect(initial.label).toBe('PROTECTED');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('This owned card is protected');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-card-protection.png' });

  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.click(
    canvas.x + canvas.width * (initial.hit.x / 1280),
    canvas.y + canvas.height * (initial.hit.y / 720),
  );
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardProtection?.detailProtected === false);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').lockedCards))
    .toEqual([]);

  await page.keyboard.press('t');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardProtection?.detailProtected === true);
  await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    codex.input.gamepad.emit('down', codex.input.gamepad.pad1, { index: 3 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardProtection?.detailProtected === false);
  await page.keyboard.press('t');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardProtection?.detailProtected === true);

  const searchState = await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    codex.detailId = undefined;
    codex.cardSearchQuery = 'protected locked';
    codex.gridScroll = 0;
    codex.gridScrollTarget = 0;
    codex.renderAll();
    return JSON.parse(window.render_game_to_text?.() ?? '{}');
  });
  expect(searchState.cardSearch).toMatchObject({
    query: 'protected locked',
    matchCount: 1,
    matchedIds: ['major_00'],
  });
  expect(searchState.cardSearch.fields).toContain('protection');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('1 owned card protected');

  const unowned = await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    codex.cardSearchQuery = '';
    codex.activeTab = 2;
    codex.detailId = 'wands_ace';
    codex.detailScroll = 0;
    codex.detailScrollTarget = 0;
    codex.renderAll();
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      protectControl: Boolean(codex.root.getByName('codex-card-protect-hit')),
      targetControl: Boolean(codex.root.getByName('codex-card-target-hit')?.input?.enabled),
    };
  });
  expect(unowned.state.cardProtection).toMatchObject({
    count: 1,
    detailId: 'wands_ace',
    detailProtected: false,
    detailEligible: false,
  });
  expect(unowned.protectControl).toBe(false);
  expect(unowned.targetControl).toBe(true);
  await page.keyboard.press('t');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionHunt?.detailTargeted === true);

  await page.evaluate(async () => {
    const codex: any = await window.__birdSquadStartScene!('CodexScene');
    codex.activeSection = 'cards';
    codex.activeTab = 0;
    codex.detailId = 'major_00';
    codex.renderAll();
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardProtection?.detailProtected === true);
  const final = await page.evaluate(() => {
    const account = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
    return {
      protection: JSON.parse(window.render_game_to_text?.() ?? '{}').cardProtection,
      lockedCards: account.lockedCards,
      hunt: account.hunt,
      cardCollection: account.cardCollection,
      favoriteCards: account.favoriteCards,
    };
  });
  expect(final.protection).toMatchObject({ count: 1, ids: ['major_00'], detailProtected: true });
  expect(final.lockedCards).toEqual(['major_00']);
  expect(final.hunt).toEqual(['wands_ace']);
  expect(final.cardCollection).toEqual(initial.cardCollection);
  expect(final.favoriteCards).toEqual(initial.favoriteCards);
});

test('codex: active flight playable status distinguishes Base, Preened, absent, and no-flight copies', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'major_01', 'wands_ace'],
      cardCollection: {
        major_00: {
          timesClaimed: 2,
          firstAcquiredAt: Date.UTC(2026, 6, 1),
          firstSource: 'combat_reward',
        },
        major_01: {
          timesClaimed: 1,
          firstAcquiredAt: Date.UTC(2026, 6, 2),
          firstSource: 'route_choice',
        },
        wands_ace: {
          timesClaimed: 1,
          firstAcquiredAt: Date.UTC(2026, 6, 3),
          firstSource: 'starter',
        },
      },
    };
    const accountRaw = JSON.stringify(account);
    const activeRun = {
      deck: [
        { id: 'major_00', upgraded: false },
        { id: 'wands_ace', upgraded: false },
        { id: 'major_00', upgraded: true },
        { id: 'missing_card', upgraded: true },
      ],
      currentHp: 38,
      scrap: 20,
      routeMarks: [],
      supplies: [],
      mapIndex: 0,
      completedRouteNodeIds: [],
      routeLog: [],
    };
    const runRaw = JSON.stringify(activeRun);
    localStorage.setItem('birdsquad.account', accountRaw);
    localStorage.setItem('birdsquad.account.backup', accountRaw);
    localStorage.setItem('birdsquad.run.active', runRaw);
    localStorage.setItem('birdsquad.run.active.backup', runRaw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  const runBefore = await page.evaluate(() => ({
    primary: localStorage.getItem('birdsquad.run.active'),
    backup: localStorage.getItem('birdsquad.run.active.backup'),
    collection: structuredClone(JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').cardCollection),
  }));

  await page.evaluate(async () => {
    const codex: any = await window.__birdSquadStartScene!('CodexScene');
    codex.activeSection = 'cards';
    codex.activeTab = 0;
    codex.detailId = 'major_00';
    codex.detailScroll = 0;
    codex.detailScrollTarget = 0;
    codex.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.activeFlightCards?.detail?.state === 'preened';
  });
  await expect(page.locator('#game-status')).toContainText('In the active flight: one playable Preened copy');

  const preened = await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const texts = codex.root.list
      .filter((entry: any) => typeof entry?.text === 'string')
      .map((entry: any) => entry.text);
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      texts,
      status: document.getElementById('game-status')?.textContent ?? '',
      primary: localStorage.getItem('birdsquad.run.active'),
      backup: localStorage.getItem('birdsquad.run.active.backup'),
      collection: structuredClone(JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').cardCollection),
    };
  });
  expect(preened.state.activeFlightCards).toMatchObject({
    active: true,
    deckSize: 2,
    ids: ['major_00', 'wands_ace'],
    entries: [
      { id: 'major_00', state: 'preened', playableQuantity: 1 },
      { id: 'wands_ace', state: 'base', playableQuantity: 1 },
    ],
    detailId: 'major_00',
    detail: {
      id: 'major_00',
      inDeck: true,
      playableQuantity: 1,
      state: 'preened',
    },
    source: 'autosaved route checkpoint',
    temporary: true,
    singletonCopies: true,
    affectsPermanentOwnership: false,
    affectsSavedFolios: false,
    readOnly: true,
    searchable: true,
  });
  expect(preened.texts).toContain('ACTIVE FLIGHT / 1 PLAYABLE COPY / PREENED');
  expect(preened.status).toContain('In the active flight: one playable Preened copy');
  expect(preened.primary).toBe(runBefore.primary);
  expect(preened.backup).toBe(runBefore.backup);
  expect(preened.collection).toEqual(runBefore.collection);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-active-flight-card-usage.png' });

  const searchable = await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    codex.detailId = undefined;
    codex.cardSearchQuery = 'active flight preened';
    codex.gridScroll = 0;
    codex.gridScrollTarget = 0;
    codex.renderAll();
    return JSON.parse(window.render_game_to_text?.() ?? '{}');
  });
  expect(searchable.cardSearch).toMatchObject({
    query: 'active flight preened',
    matchCount: 1,
    matchedIds: ['major_00'],
  });
  expect(searchable.cardSearch.fields).toContain('active flight usage');

  const absent = await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    codex.cardSearchQuery = '';
    codex.detailId = 'major_01';
    codex.detailScroll = 0;
    codex.detailScrollTarget = 0;
    codex.renderAll();
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      texts: codex.root.list
        .filter((entry: any) => typeof entry?.text === 'string')
        .map((entry: any) => entry.text),
    };
  });
  expect(absent.state.activeFlightCards.detail).toMatchObject({
    id: 'major_01',
    inDeck: false,
    playableQuantity: 0,
    state: 'not-in-flight',
  });
  expect(absent.texts).toContain('ACTIVE FLIGHT / 0 PLAYABLE COPIES / NOT IN CURRENT DECK');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('Not in the active flight deck; playable quantity there is zero');

  await page.evaluate(async () => {
    const nextRun = JSON.stringify({
      deck: [{ id: 'major_00', upgraded: false }],
      currentHp: 30,
      scrap: 25,
      routeMarks: [],
      supplies: [],
      mapIndex: 0,
      completedRouteNodeIds: [],
      routeLog: [],
    });
    localStorage.setItem('birdsquad.run.active', nextRun);
    localStorage.setItem('birdsquad.run.active.backup', nextRun);
    const codex: any = await window.__birdSquadStartScene!('CodexScene');
    codex.activeSection = 'cards';
    codex.activeTab = 0;
    codex.detailId = 'major_00';
    codex.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.activeFlightCards?.detail?.state === 'base';
  });
  expect(await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').activeFlightCards.detail))
    .toMatchObject({ id: 'major_00', inDeck: true, playableQuantity: 1, state: 'base' });

  await page.evaluate(async () => {
    localStorage.removeItem('birdsquad.run.active');
    localStorage.removeItem('birdsquad.run.active.backup');
    const codex: any = await window.__birdSquadStartScene!('CodexScene');
    codex.activeSection = 'cards';
    codex.activeTab = 0;
    codex.detailId = 'major_00';
    codex.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.activeFlightCards?.detail?.state === 'no-active-flight';
  });
  const noFlight = await page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').activeFlightCards
  ));
  expect(noFlight).toMatchObject({
    active: false,
    deckSize: 0,
    ids: [],
    entries: [],
    detail: {
      id: 'major_00',
      inDeck: false,
      playableQuantity: 0,
      state: 'no-active-flight',
    },
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('No active flight, so there are zero flight-specific playable copies');
});

test('codex: private Card Journal supports sanitized pointer, keyboard, controller, search, and screen-reader flows', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'wands_ace'],
      cardJournal: {
        major_00: '  Hold   for Surge.\r\nThen Molt.  ',
        wands_ace: 'x'.repeat(300),
        missing_card: 'must be removed',
        empty_note: '   ',
      },
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    const codex: any = await window.__birdSquadStartScene!('CodexScene');
    codex.activeSection = 'cards';
    codex.activeTab = 0;
    codex.detailId = 'major_00';
    codex.detailScroll = 0;
    codex.detailScrollTarget = 0;
    codex.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const codex: any = window.__birdSquadGame?.scene?.getScene('CodexScene');
    return state.cardJournal?.detailNote === 'Hold for Surge.\nThen Molt.'
      && codex?.root?.getByName?.('codex-card-journal-hit')?.input?.enabled;
  });

  // The journal follows the full gameplay rules; scroll its actual hit target
  // into the reading viewport before exercising pointer editing.
  await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = codex.root.getByName('codex-card-journal-hit');
    codex.detailScroll = codex.detailScrollTarget = Math.min(codex.detailMaxScroll, codex.detailScroll + hit.y - 240);
    codex.renderAll();
  });

  const initial = await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = codex.root.getByName('codex-card-journal-hit');
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      account: JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}'),
      hit: { x: hit.x, y: hit.y, width: hit.displayWidth, height: hit.displayHeight },
      noteText: codex.root.getByName('codex-card-journal-note')?.text,
    };
  });
  expect(initial.state.cardJournal).toMatchObject({
    count: 2,
    ids: ['major_00', 'wands_ace'],
    detailId: 'major_00',
    detailName: 'First Flight',
    detailNote: 'Hold for Surge.\nThen Molt.',
    editing: false,
    keyboard: 'J',
    controller: 'Start',
    maxLength: 240,
    private: true,
    includedInBackups: true,
    includedInShareCodes: false,
    affectsPower: false,
    persisted: true,
    searchable: true,
  });
  expect(initial.account.cardJournal).toEqual({
    major_00: 'Hold for Surge.\nThen Molt.',
    wands_ace: 'x'.repeat(240),
  });
  expect(initial.noteText).toBe('Hold for Surge.\nThen Molt.');
  expect(initial.hit.width).toBeGreaterThanOrEqual(400);
  expect(initial.hit.height).toBeGreaterThanOrEqual(72);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('Private Card Journal note: Hold for Surge. Then Molt.');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-private-card-journal.png' });

  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.click(
    canvas.x + canvas.width * (initial.hit.x / 1280),
    canvas.y + canvas.height * (initial.hit.y / 720),
  );
  const input = page.locator('#codex-card-journal-input');
  await expect(input).toBeVisible();
  expect(await input.getAttribute('maxlength')).toBe('240');
  await expect(page.getByRole('dialog', { name: 'Private card journal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save note', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('Editing the private Card Journal for First Flight');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-private-card-journal-editor.png' });
  await input.fill('Pointer memory.\nThen Surge.');
  await input.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardJournal?.status === 'saved');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').cardJournal.major_00))
    .toBe('Pointer memory.\nThen Surge.');

  await page.keyboard.press('j');
  await expect(input).toBeVisible();
  await input.fill('Canceled keyboard edit');
  await input.press('Escape');
  await expect(input).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').cardJournal.major_00))
    .toBe('Pointer memory.\nThen Surge.');

  await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    codex.input.gamepad.emit('down', {}, { index: 9 });
  });
  await expect(input).toBeVisible();
  await input.fill('Controller journal note');
  await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    codex.input.gamepad.emit('down', {}, { index: 0 });
  });
  await expect(input).toHaveCount(0);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardJournal?.detailNote === 'Controller journal note');

  await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    codex.detailId = undefined;
    codex.renderAll();
  });
  await page.keyboard.press('/');
  const search = page.locator('#codex-card-search-input');
  await expect(search).toBeVisible();
  await search.fill('controller journal');
  await search.press('Enter');
  const searchState = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(searchState.cardSearch).toMatchObject({
    query: 'controller journal',
    matchedIds: ['major_00'],
  });
  expect(searchState.cardSearch.fields).toContain('private journal');
});

test('codex: collection records show claim provenance and keep flight copies explicitly temporary', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'wands_ace'],
      cardCollection: {
        major_00: {
          timesClaimed: 3,
          firstAcquiredAt: Date.UTC(2026, 5, 14),
          lastAcquiredAt: Date.UTC(2026, 6, 28),
          firstSource: 'combat_reward',
          lastSource: 'market',
        },
        wands_ace: {
          timesClaimed: 0,
          firstAcquiredAt: 0,
          lastAcquiredAt: 0,
          firstSource: 'market',
          lastSource: 'market',
        },
        unknown_card: {
          timesClaimed: 9,
          firstAcquiredAt: 1,
          lastAcquiredAt: 1,
          firstSource: 'market',
          lastSource: 'market',
        },
      },
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 0;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
  });

  const grid = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    const collectedObjects = walk(cs.root);
    const collectedMarkers = collectedObjects
      .filter((entry: any) => entry.name === 'codex-card-ownership-marker')
      .map((entry: any) => ({ id: entry.getData('cardId'), collected: entry.getData('collected') }));
    const collectedLabels = collectedObjects
      .filter((entry: any) => entry.name === 'codex-card-ownership-label')
      .map((entry: any) => ({ id: entry.getData('cardId'), text: entry.text }));
    cs.openCollectionAtlas();
    const subtitle = walk(cs.root).find((entry: any) => entry.name === 'codex-atlas-totals')?.text;
    cs.closeCollectionAtlas();
    cs.activeTab = 2;
    cs.renderAll();
    const seenObjects = walk(cs.root);
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      markers: [...collectedMarkers, ...seenObjects
        .filter((entry: any) => entry.name === 'codex-card-ownership-marker')
        .map((entry: any) => ({ id: entry.getData('cardId'), collected: entry.getData('collected') }))],
      labels: [...collectedLabels, ...seenObjects
        .filter((entry: any) => entry.name === 'codex-card-ownership-label')
        .map((entry: any) => ({ id: entry.getData('cardId'), text: entry.text }))],
      subtitle,
    };
  });
  expect(grid.state.cardOwnership).toEqual(expect.objectContaining({
    collectedCount: 1,
    collectedIds: ['major_00'],
    discoveredNotCollected: ['wands_ace'],
    runCopiesTemporary: true,
  }));
  expect(grid.markers).toEqual([
    { id: 'major_00', collected: true },
    { id: 'wands_ace', collected: false },
  ]);
  expect(grid.labels).toEqual([
    { id: 'major_00', text: 'COLLECTED' },
    { id: 'wands_ace', text: 'SEEN' },
  ]);
  expect(grid.subtitle).toBe('1 collected  ·  2 encountered  ·  110 total');

  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.detailId = 'major_00';
    cs.detailScroll = 0;
    cs.detailScrollTarget = 0;
    cs.renderAll();
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Collected permanently, with 3 flight claims');
  const collectedDetail = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      texts: walk(cs.root).filter((entry: any) => entry.type === 'Text').map((entry: any) => entry.text),
    };
  });
  expect(collectedDetail.state.cardOwnership.detail).toMatchObject({
    timesClaimed: 3,
    firstSource: 'combat_reward',
  });
  expect(collectedDetail.texts).toContain('COLLECTION STATUS');
  expect(collectedDetail.texts).toContain('COLLECTED / 3 FLIGHT CLAIMS / FIRST: FIGHT REWARD / 2026-06-14');
  expect(collectedDetail.texts).toContain('Permanent collection record. Playable copies, Preens, and transformations remain specific to each flight.');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-collected-card-provenance.png' });

  const seenDetail = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.detailId = 'wands_ace';
    cs.detailScroll = 0;
    cs.detailScrollTarget = 0;
    cs.renderAll();
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      texts: walk(cs.root).filter((entry: any) => entry.type === 'Text').map((entry: any) => entry.text),
    };
  });
  expect(seenDetail.state.cardOwnership.detail).toBeNull();
  expect(seenDetail.texts).toContain('DISCOVERED / NOT YET COLLECTED');
  expect(seenDetail.texts).toContain('Seen in an offer or preview. Claim it during a flight to create its permanent collection record.');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Discovered but not yet collected');
});

test('codex: new first-copy markers support a New lens and intentional per-card or bulk acknowledgement', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'major_01', 'major_02', 'wands_ace'],
      cardCollection: {
        major_00: { timesClaimed: 1, firstAcquiredAt: 10, firstSource: 'starter_flock', isNew: true },
        major_01: { timesClaimed: 2, firstAcquiredAt: 20, firstSource: 'combat_reward', isNew: true },
        major_02: { timesClaimed: 1, firstAcquiredAt: 30, firstSource: 'route_reward', isNew: true },
        wands_ace: { timesClaimed: 1, firstAcquiredAt: 40, firstSource: 'market', isNew: 'invalid' },
      },
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.codexCardLens', 'new');
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 0;
    cs.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.newlyAcquiredCards?.count === 3
      && state.cardCollectionLens?.id === 'new'
      && state.cardCollectionLens?.visibleIds?.length === 3;
  });

  const initial = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    if (!cs.collectionToolsOpen) cs.toggleCollectionTools();
    const objects = walk(cs.root);
    const bulk = cs.root.getByName('codex-clear-new-cards-hit');
    const marker = objects.find((entry: any) => entry.name === 'codex-new-card-marker' && entry.getData('cardId') === 'major_00');
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      markerIds: objects
        .filter((entry: any) => entry.name === 'codex-new-card-marker')
        .map((entry: any) => entry.getData('cardId')),
      bulk: { x: bulk.x, y: bulk.y, width: bulk.displayWidth, height: bulk.displayHeight, count: bulk.getData('count') },
      firstCardPoint: { x: marker.x, y: marker.y },
      account: JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}'),
    };
  });
  expect(initial.state.newlyAcquiredCards).toMatchObject({
    count: 3,
    ids: ['major_00', 'major_01', 'major_02'],
    visibleIds: ['major_00', 'major_01', 'major_02'],
    lensActive: true,
    bulkControlRendered: true,
    keyboard: 'N',
    controller: 'LT',
    affectsOwnership: false,
    persisted: true,
  });
  expect(initial.markerIds).toEqual(['major_00', 'major_01', 'major_02']);
  expect(initial.bulk).toMatchObject({ width: 128, height: 58, count: 3 });
  expect(initial.account.cardCollection.wands_ace.isNew).toBeUndefined();
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('3 new card markers');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-new-cards-lens.png' });

  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.click(
    canvas.x + canvas.width * (initial.firstCardPoint.x / 1280),
    canvas.y + canvas.height * (initial.firstCardPoint.y / 720),
  );
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === 'major_00');
  const markSeen = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = cs.root.getByName('codex-card-mark-seen-hit');
    return { x: hit.x, y: hit.y, width: hit.displayWidth, height: hit.displayHeight };
  });
  expect(markSeen).toMatchObject({ width: 264, height: 58 });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('New to collection');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-new-card-detail.png' });
  await page.mouse.click(
    canvas.x + canvas.width * (markSeen.x / 1280),
    canvas.y + canvas.height * (markSeen.y / 720),
  );
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').newlyAcquiredCards?.count === 2);
  let persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}'));
  expect(persisted.cardCollection.major_00).toMatchObject({
    timesClaimed: 1,
    firstAcquiredAt: 10,
    firstSource: 'starter_flock',
  });
  expect(persisted.cardCollection.major_00.isNew).toBeUndefined();

  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.detailId = 'major_01';
    cs.renderAll();
  });
  await page.keyboard.press('n');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').newlyAcquiredCards?.count === 1);
  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.detailId = 'major_02';
    cs.renderAll();
    cs.input.gamepad.emit('down', {}, { index: 6 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').newlyAcquiredCards?.count === 0);
  persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}'));
  expect(Object.values(persisted.cardCollection).filter((record: any) => record.isNew === true)).toHaveLength(0);
  expect(Object.keys(persisted.cardCollection)).toEqual(['major_00', 'major_01', 'major_02', 'wands_ace']);

  const seedNewMarkers = async (ids: string[]) => {
    await page.evaluate(async (cardIds) => {
      const account = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
      cardIds.forEach((id) => { account.cardCollection[id].isNew = true; });
      const raw = JSON.stringify(account);
      localStorage.setItem('birdsquad.account', raw);
      localStorage.setItem('birdsquad.account.backup', raw);
      const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
      cs.activeSection = 'cards';
      cs.activeTab = 0;
      cs.cardCollection = account.cardCollection;
      cs.newlyAcquiredCards = new Set(cardIds);
      cs.detailId = undefined;
      cs.focusZone = 'sections';
      cs.gridScroll = 0;
      cs.gridScrollTarget = 0;
      cs.renderAll();
    }, ids);
    await page.waitForFunction((count) => (
      JSON.parse(window.render_game_to_text?.() ?? '{}').newlyAcquiredCards?.count === count
    ), ids.length);
  };

  await seedNewMarkers(['major_00', 'major_01', 'major_02']);
  await page.mouse.click(
    canvas.x + canvas.width * (initial.bulk.x / 1280),
    canvas.y + canvas.height * (initial.bulk.y / 720),
  );
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').newlyAcquiredCards?.count === 0);

  await seedNewMarkers(['major_00', 'major_01']);
  await page.keyboard.press('n');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').newlyAcquiredCards?.count === 0);

  await seedNewMarkers(['major_02']);
  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.input.gamepad.emit('down', {}, { index: 6 });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').newlyAcquiredCards?.count === 0);
  const finalAccount = await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}'));
  expect(Object.values(finalAccount.cardCollection).filter((record: any) => record.isNew === true)).toHaveLength(0);
  expect(Object.keys(finalAccount.cardCollection)).toEqual(['major_00', 'major_01', 'major_02', 'wands_ace']);
});

test('codex: Favorites view groups personal cards and explains its empty state accessibly', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'wands_ace'],
      favoriteCards: ['major_00'],
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('CodexScene'));
  await page.waitForFunction(() => {
    const cs: any = window.__birdSquadGame?.scene?.getScene('CodexScene');
    return cs?.root?.list?.some((entry: any) => (
      entry.name === 'codex-tab-hit'
      && entry.getData('label') === 'Favorites'
      && entry.input?.enabled
    ));
  });

  const tabPoint = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const tab = cs.root.list.find((entry: any) => entry.name === 'codex-tab-hit' && entry.getData('label') === 'Favorites');
    return { x: tab.x, y: tab.y, width: tab.displayWidth, height: tab.displayHeight };
  });
  expect(tabPoint.width).toBeGreaterThanOrEqual(104);
  expect(tabPoint.height).toBeGreaterThanOrEqual(46);
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.click(
    canvas.x + canvas.width * (tabPoint.x / 1280),
    canvas.y + canvas.height * (tabPoint.y / 720),
  );
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardFavorites?.viewActive === true);

  const populated = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    const objects = walk(cs.root);
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      texts: objects.filter((entry: any) => entry.type === 'Text').map((entry: any) => entry.text),
      markerIds: objects.filter((entry: any) => entry.name === 'codex-favorite-marker')
        .map((entry: any) => entry.getData('cardId')),
    };
  });
  expect(populated.state.cardFavorites).toMatchObject({
    count: 1,
    ids: ['major_00'],
    viewActive: true,
    viewEmpty: false,
    visibleIds: ['major_00'],
  });
  expect(populated.state.codexFocus).toMatchObject({ zone: 'primaryTabs', label: 'Favorites filter' });
  // Counts live with their tabs instead of repeating in a second subtitle.
  expect(await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    return cs.root.list.filter((entry: any) => entry.name === 'codex-tab-meta')
      .map((entry: any) => ({ label: entry.getData('label'), text: entry.text }));
  })).toEqual(expect.arrayContaining([{ label: 'Favorites', text: '1' }, { label: 'Cards', text: '2/110' }]));
  expect(populated.markerIds).toEqual(['major_00']);

  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').codexFocus?.label === 'Snags filter');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).cardFavorites.viewActive).toBe(false);
  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 15 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardFavorites?.viewActive === true);

  await page.keyboard.press('Tab');
  // Collapsed tools are not in the focus order: family -> visible cards.
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').codexFocus?.zone === 'entries');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === 'major_00');
  await page.keyboard.press('c');
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.cardFavorites?.detailFavorite === false && state.cardFavorites?.viewEmpty === true;
  });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === '');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('No favorite cards yet');

  const empty = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    const objects = walk(cs.root);
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      emptyPanels: objects.filter((entry: any) => entry.name === 'codex-favorites-empty-state').length,
      texts: objects.filter((entry: any) => entry.type === 'Text').map((entry: any) => entry.text),
      account: JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}'),
    };
  });
  expect(empty.state.cardFavorites).toMatchObject({
    count: 0,
    ids: [],
    viewActive: true,
    viewEmpty: true,
    visibleIds: [],
  });
  expect(empty.emptyPanels).toBe(1);
  expect(empty.texts).toContain('NO FAVORITES YET');
  expect(empty.account.favoriteCards).toEqual([]);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-favorites-empty.png' });
});

test('codex: Hunt List supports pointer, keyboard, controller, capacity, and an accessible empty state', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'wands_ace', 'wands_02', 'wands_03', 'wands_04'],
      hunt: ['major_00', 'wands_ace', 'unknown_card'],
      cardCollection: {
        major_00: {
          timesClaimed: 1,
          firstAcquiredAt: Date.UTC(2026, 6, 1),
          firstSource: 'starter_flock',
        },
      },
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.detailId = 'wands_ace';
    cs.detailScroll = 0;
    cs.detailScrollTarget = 0;
    cs.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const cs: any = window.__birdSquadGame?.scene?.getScene('CodexScene');
    return state.collectionHunt?.detailTargeted === true
      && cs?.root?.getByName?.('codex-card-target-hit')?.input?.enabled;
  });

  const initial = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = cs.root.getByName('codex-card-target-hit');
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}').collectionHunt,
      account: JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}'),
      hit: { x: hit.x, y: hit.y, width: hit.displayWidth, height: hit.displayHeight },
    };
  });
  expect(initial.state).toMatchObject({
    count: 1,
    capacity: 3,
    ids: ['wands_ace'],
    detailTargeted: true,
    detailCanTarget: true,
    keyboard: 'T',
    controller: 'Y',
    changesRewardOdds: false,
  });
  expect(initial.hit.width).toBeGreaterThanOrEqual(142);
  expect(initial.hit.height).toBeGreaterThanOrEqual(46);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-hunt-detail.png' });

  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await clickNamedGameObject(page, 'CodexScene', 'codex-card-target-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionHunt?.count === 0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').hunt))
    .toEqual([]);

  await page.keyboard.press('t');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionHunt?.detailTargeted === true);
  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 3 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionHunt?.count === 0);

  const targetPoint = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = cs.root.getByName('codex-card-target-hit');
    return { x: hit.x, y: hit.y };
  });
  await clickNamedGameObject(page, 'CodexScene', 'codex-card-target-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionHunt?.count === 1);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === '');

  const huntTab = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const tab = cs.root.list.find((entry: any) => entry.name === 'codex-tab-hit' && entry.getData('label') === 'Hunt List');
    return { x: tab.x, y: tab.y, width: tab.displayWidth, height: tab.displayHeight };
  });
  expect(huntTab.width).toBeGreaterThanOrEqual(104);
  expect(huntTab.height).toBeGreaterThanOrEqual(46);
  await page.mouse.click(
    canvas.x + canvas.width * (huntTab.x / 1280),
    canvas.y + canvas.height * (huntTab.y / 720),
  );
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionHunt?.viewActive === true);

  const populated = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    const objects = walk(cs.root);
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      markerIds: objects.filter((entry: any) => entry.name === 'codex-hunt-marker')
        .map((entry: any) => entry.getData('cardId')),
      texts: objects.filter((entry: any) => entry.type === 'Text').map((entry: any) => entry.text),
    };
  });
  expect(populated.state.collectionHunt).toMatchObject({
    count: 1,
    ids: ['wands_ace'],
    viewActive: true,
    viewEmpty: false,
    visibleIds: ['wands_ace'],
  });
  expect(populated.state.codexFocus).toMatchObject({ zone: 'primaryTabs', label: 'Hunt List filter' });
  expect(populated.markerIds).toEqual(['wands_ace']);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('Showing 1 active Hunt List target');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-hunt-list-populated.png' });

  await page.keyboard.press('Tab');
  // Collapsed tools are not in the focus order: family -> visible cards.
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').codexFocus?.zone === 'entries');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === 'wands_ace');
  await page.keyboard.press('t');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionHunt?.viewEmpty === true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === '');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Hunt List empty');

  const empty = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    const objects = walk(cs.root);
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}').collectionHunt,
      emptyPanels: objects.filter((entry: any) => entry.name === 'codex-hunt-empty-state').length,
      texts: objects.filter((entry: any) => entry.type === 'Text').map((entry: any) => entry.text),
      account: JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}'),
    };
  });
  expect(empty.state).toMatchObject({ count: 0, viewActive: true, viewEmpty: true, visibleIds: [] });
  expect(empty.emptyPanels).toBe(1);
  expect(empty.texts).toContain('YOUR HUNT LIST IS OPEN');
  expect(empty.account.hunt).toEqual([]);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-hunt-list-empty.png' });

  const full = await page.evaluate(async () => {
    const account = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
    account.hunt = ['wands_ace', 'wands_02', 'wands_03'];
    localStorage.setItem('birdsquad.account', JSON.stringify(account));
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.detailId = 'wands_04';
    cs.renderAll();
    const hit = cs.root.getByName('codex-card-target-hit');
    const label = cs.root.getByName('codex-card-target-label');
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}').collectionHunt,
      enabled: hit.getData('enabled'),
      label: label.text,
    };
  });
  expect(full.state).toMatchObject({ count: 3, detailTargeted: false, detailCanTarget: false });
  expect(full.enabled).toBe(false);
  expect(full.label).toBe('3/3 HUNT FULL');
});

test('codex: Collection Lens filters ownership with pointer, keyboard, controller, persistence, and an accessible empty state', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'wands_ace', 'wands_02'],
      favoriteCards: [],
      cardCollection: {
        wands_02: {
          timesClaimed: 2,
          firstAcquiredAt: Date.UTC(2026, 6, 2),
          firstSource: 'combat_reward',
        },
      },
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.codexCardLens', 'collected');
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.detailId = undefined;
    cs.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.cardCollectionLens?.id === 'collected'
      && state.cardCollectionLens?.visibleIds?.includes('wands_02');
  });

  const initial = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    if (!cs.collectionToolsOpen) cs.toggleCollectionTools();
    const hit = cs.root.getByName('codex-card-lens-hit');
    return {
      lens: JSON.parse(window.render_game_to_text?.() ?? '{}').cardCollectionLens,
      hit: { x: hit.x, y: hit.y, width: hit.displayWidth, height: hit.displayHeight },
      persistedLens: localStorage.getItem('birdsquad.codexCardLens'),
    };
  });
  expect(initial.lens).toMatchObject({
    id: 'collected',
    label: 'Collected',
    index: 1,
    count: 7,
    visibleCount: 1,
    visibleIds: ['wands_02'],
    keyboard: 'L',
    controller: 'LB',
    persisted: true,
  });
  expect(initial.persistedLens).toBe('collected');
  expect(initial.hit.width).toBeGreaterThanOrEqual(104);
  expect(initial.hit.height).toBeGreaterThanOrEqual(46);

  await settleCanvas(page);
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.move(
    canvas.x + canvas.width * (initial.hit.x / 1280),
    canvas.y + canvas.height * (initial.hit.y / 720),
  );
  await page.waitForFunction(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('CodexScene');
    return scene.input.hitTestPointer(scene.input.activePointer).some((entry: any) => entry.name === 'codex-card-lens-hit');
  });
  await page.mouse.click(
    canvas.x + canvas.width * (initial.hit.x / 1280),
    canvas.y + canvas.height * (initial.hit.y / 720),
  );
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardCollectionLens?.id === 'new');
  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.codexFocus).toMatchObject({ zone: 'secondaryTabs', label: 'New filter' });
  expect(state.cardCollectionLens).toMatchObject({ visibleCount: 0, visibleIds: [], empty: true });
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.codexCardLens')))
    .toBe('new');

  await page.keyboard.press('l');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardCollectionLens?.id === 'tagged');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.codexFocus).toMatchObject({ zone: 'secondaryTabs', label: 'Tagged filter' });
  expect(state.cardCollectionLens).toMatchObject({ visibleCount: 0, visibleIds: [], empty: true });
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.codexCardLens')))
    .toBe('tagged');

  await page.keyboard.press('l');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardCollectionLens?.id === 'uncollected');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.codexFocus).toMatchObject({ zone: 'secondaryTabs', label: 'Uncollected filter' });
  expect(state.cardCollectionLens.visibleIds).not.toContain('wands_02');
  expect(state.cardCollectionLens.visibleIds).toContain('wands_ace');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.codexCardLens')))
    .toBe('uncollected');

  await page.keyboard.press('l');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardCollectionLens?.id === 'seen');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardCollectionLens).toMatchObject({
    label: 'Seen',
    visibleCount: 1,
    visibleIds: ['wands_ace'],
    empty: false,
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Collection lens Seen, showing 1');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-collection-lens-seen.png' });

  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 4 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardCollectionLens?.id === 'folio');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardCollectionLens).toMatchObject({
    label: 'In Folios',
    visibleCount: 0,
    visibleIds: [],
    empty: true,
  });
  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 4 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardCollectionLens?.id === 'all');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.codexCardLens')))
    .toBe('all');

  await page.keyboard.press('l');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardCollectionLens?.id === 'collected');
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.renderAll();
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardCollectionLens?.id === 'collected');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).cardCollectionLens.visibleIds)
    .toEqual(['wands_02']);

  const empty = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.activeTab = 0;
    cs.detailId = undefined;
    cs.resetCodexScroll();
    cs.renderAll();
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    const objects = walk(cs.root);
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      emptyPanels: objects.filter((entry: any) => entry.name === 'codex-card-lens-empty-state').length,
      texts: objects.filter((entry: any) => entry.type === 'Text').map((entry: any) => entry.text),
    };
  });
  expect(empty.state.cardCollectionLens).toMatchObject({
    id: 'collected',
    visibleCount: 0,
    empty: true,
    visibleIds: [],
  });
  expect(empty.emptyPanels).toBe(1);
  expect(empty.texts).toContain('COLLECTED LENS');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('No cards match this lens');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-collection-lens-empty.png' });
});

test('codex: saved Folio usage marks active and archived cards and filters them without changing decks', async ({ page }) => {
  await page.addInitScript(() => {
    const acquired = (day: number) => ({
      timesClaimed: 1,
      firstAcquiredAt: Date.UTC(2026, 6, day),
      firstSource: 'combat_reward',
    });
    const account = {
      discoveredCards: ['wands_ace', 'wands_02', 'wands_03', 'wands_04'],
      favoriteCards: [],
      cardCollection: {
        wands_ace: acquired(1),
        wands_02: acquired(2),
        wands_03: acquired(3),
        wands_04: acquired(4),
      },
      decks: [
        {
          id: 'folio-active',
          name: 'Active Rooftop',
          leaderId: 'fledgling',
          cards: [
            { id: 'wands_ace', upgraded: false },
            { id: 'wands_02', upgraded: true },
            { id: 'wands_02', upgraded: false },
          ],
          lineageId: 'folio-active',
          revision: 1,
          createdAt: 10,
          updatedAt: 20,
          favorite: false,
          archived: false,
          sourceSeed: 'active-seed',
          runMode: 'full',
        },
        {
          id: 'folio-archive',
          name: 'Archived Rooftop',
          leaderId: 'fledgling',
          cards: [
            { id: 'wands_02', upgraded: false },
            { id: 'wands_03', upgraded: false },
          ],
          lineageId: 'folio-archive',
          revision: 1,
          createdAt: 30,
          updatedAt: 40,
          favorite: false,
          archived: true,
          sourceSeed: 'archive-seed',
          runMode: 'quick',
        },
      ],
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.codexCardLens', 'all');
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.detailId = undefined;
    cs.cardCollectionLens = 'all';
    cs.cardSearchQuery = '';
    cs.renderAll();
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardFolioUsage?.cardCount === 3);

  const initial = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    const objects = walk(cs.root);
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      markers: objects.filter((entry: any) => entry.name === 'codex-card-folio-marker').map((entry: any) => ({
        id: entry.getData('cardId'),
        total: entry.getData('total'),
        active: entry.getData('active'),
        archived: entry.getData('archived'),
      })),
      labels: objects.filter((entry: any) => entry.name === 'codex-card-folio-marker-label').map((entry: any) => ({
        id: entry.getData('cardId'),
        text: entry.text,
      })),
      decks: JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').decks,
    };
  });
  expect(initial.state.cardFolioUsage).toMatchObject({
    cardCount: 3,
    activeCardCount: 2,
    archivedOnlyCardCount: 1,
    ids: ['wands_ace', 'wands_02', 'wands_03'],
    derivedFromPrivateFolios: true,
    affectsPower: false,
  });
  expect(initial.state.cardFolioUsage.entries).toHaveLength(3);
  expect(initial.state.cardFolioUsage.entries).toEqual(expect.arrayContaining([
    { id: 'wands_ace', total: 1, active: 1, archived: 0, folioIds: ['folio-active'] },
    { id: 'wands_02', total: 2, active: 1, archived: 1, folioIds: ['folio-active', 'folio-archive'] },
    { id: 'wands_03', total: 1, active: 0, archived: 1, folioIds: ['folio-archive'] },
  ]));
  expect(initial.markers).toHaveLength(3);
  expect(initial.markers).toEqual(expect.arrayContaining([
    { id: 'wands_ace', total: 1, active: 1, archived: 0 },
    { id: 'wands_02', total: 2, active: 1, archived: 1 },
    { id: 'wands_03', total: 1, active: 0, archived: 1 },
  ]));
  expect(initial.labels).toHaveLength(3);
  expect(initial.labels).toEqual(expect.arrayContaining([
    { id: 'wands_ace', text: 'FOLIO 1' },
    { id: 'wands_02', text: 'FOLIO 2' },
    { id: 'wands_03', text: 'ARCHIVE 1' },
  ]));
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-folio-usage-grid.png' });

  const lensHit = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.cardCollectionLens = 'seen';
    cs.renderAll();
    if (!cs.collectionToolsOpen) cs.toggleCollectionTools();
    const hit = cs.root.getByName('codex-card-lens-hit');
    return { x: hit.x, y: hit.y, width: hit.displayWidth, height: hit.displayHeight };
  });
  expect(lensHit.width).toBeGreaterThanOrEqual(104);
  expect(lensHit.height).toBeGreaterThanOrEqual(46);
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.click(
    canvas.x + canvas.width * (lensHit.x / 1280),
    canvas.y + canvas.height * (lensHit.y / 720),
  );
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.cardCollectionLens?.id === 'folio' && state.cardCollectionLens?.visibleCount === 3;
  });
  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardFolioUsage).toMatchObject({
    lensActive: true,
    visibleIds: ['wands_02', 'wands_03', 'wands_ace'],
  });
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.codexCardLens'))).toBe('folio');

  await page.keyboard.press('l');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardCollectionLens?.id === 'all');
  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.cardCollectionLens = 'seen';
    cs.renderAll();
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 4 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardCollectionLens?.id === 'folio');

  await page.keyboard.press('/');
  await page.keyboard.type('archive');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.cardSearch?.query === 'archive' && state.cardCollectionLens?.visibleCount === 2;
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardCollectionLens.visibleIds).toEqual(['wands_02', 'wands_03']);

  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.cardSearchQuery = '';
    cs.cardCollectionLens = 'folio';
    cs.entryFocusIndex = 1;
    cs.renderAll();
  });
  const cardHit = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    const hit = walk(cs.root).find((entry: any) => (
      entry.name === 'codex-card-entry-hit' && entry.getData('cardId') === 'wands_02'
    ));
    return { x: hit.x, y: hit.y };
  });
  await page.mouse.click(
    canvas.x + canvas.width * (cardHit.x / 1280),
    canvas.y + canvas.height * (cardHit.y / 720),
  );
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === 'wands_02');
  const detail = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      texts: walk(cs.root).filter((entry: any) => entry.type === 'Text').map((entry: any) => entry.text),
      screenReader: document.getElementById('game-status')?.textContent ?? '',
      decks: JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').decks,
    };
  });
  expect(detail.state.cardFolioUsage.detail).toEqual({
    total: 2,
    active: 1,
    archived: 1,
    folioIds: ['folio-active', 'folio-archive'],
  });
  expect(detail.texts).toContain('SAVED FOLIOS / 2 TOTAL / 1 ACTIVE / 1 ARCHIVED');
  await expect(page.locator('#game-status')).toContainText('Used in 2 saved Flight Folios: 1 active and 1 archived');
  expect(detail.decks).toEqual(initial.decks);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-folio-usage-detail.png' });
});

test('codex: personal tags organize discovered cards through pointer, keyboard, controller, search, a Tagged lens, and save sanitation', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'wands_ace', 'wands_02'],
      favoriteCards: [],
      cardTags: {
        major_00: 'keepsake',
        wands_ace: 'experiment',
        wands_02: 'invalid',
        major_21: 'staple',
      },
      cardCollection: {
        wands_ace: {
          timesClaimed: 1,
          firstAcquiredAt: Date.UTC(2026, 6, 2),
          firstSource: 'combat_reward',
        },
      },
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.codexCardLens', 'all');
    localStorage.setItem('birdsquad.codexCardSearch', '');
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.detailId = 'wands_ace';
    cs.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const cs: any = window.__birdSquadGame?.scene?.getScene('CodexScene');
    return state.personalCardTags?.detailTag === 'experiment'
      && cs?.root?.getByName?.('codex-card-tag-hit')?.input?.enabled;
  });

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.personalCardTags).toMatchObject({
    count: 2,
    ids: ['major_00', 'wands_ace'],
    entries: [
      { id: 'major_00', tag: 'keepsake' },
      { id: 'wands_ace', tag: 'experiment' },
    ],
    available: ['staple', 'experiment', 'keepsake'],
    detailId: 'wands_ace',
    detailTag: 'experiment',
    keyboard: 'V',
    controller: 'L3',
    private: true,
    affectsPower: false,
    persisted: true,
  });
  expect(JSON.stringify(state.personalCardTags)).not.toContain('major_21');
  expect(JSON.stringify(state.personalCardTags)).not.toContain('invalid');

  const tagPoint = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = cs.root.getByName('codex-card-tag-hit');
    return { x: hit.x, y: hit.y, width: hit.displayWidth, height: hit.displayHeight };
  });
  expect(tagPoint).toMatchObject({ width: 264, height: 58 });
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-personal-tag-detail-before-pointer.png' });
  await page.waitForTimeout(100);
  const tagClientX = canvas.x + canvas.width * (tagPoint.x / 1280);
  const tagClientY = canvas.y + canvas.height * (tagPoint.y / 720);
  await page.mouse.move(tagClientX, tagClientY);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').personalCardTags?.detailTag === 'keepsake');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Personal tag Keepsake');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-personal-tag-detail.png' });

  await page.keyboard.press('v');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').personalCardTags?.detailTag === '');
  await page.keyboard.press('v');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').personalCardTags?.detailTag === 'staple');
  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 10 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').personalCardTags?.detailTag === 'experiment');

  const persisted = await page.evaluate(() => ({
    account: localStorage.getItem('birdsquad.account'),
    backup: localStorage.getItem('birdsquad.account.backup'),
  }));
  expect(JSON.parse(persisted.account ?? '{}').cardTags).toEqual({ major_00: 'keepsake', wands_ace: 'experiment' });
  expect(persisted.backup).toBe(persisted.account);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === '');
  for (const expected of ['collected', 'new', 'tagged']) {
    await page.keyboard.press('l');
    await page.waitForFunction((lens) => (
      JSON.parse(window.render_game_to_text?.() ?? '{}').cardCollectionLens?.id === lens
    ), expected);
  }
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardCollectionLens).toMatchObject({
    id: 'tagged',
    label: 'Tagged',
    visibleIds: ['wands_ace'],
    visibleCount: 1,
  });
  expect(state.personalCardTags).toMatchObject({
    lensActive: true,
    visibleIds: ['wands_ace'],
  });
  const tagMarkers = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    return walk(cs.root)
      .filter((entry: any) => entry.name === 'codex-card-tag-marker')
      .map((entry: any) => ({ id: entry.getData('cardId'), tag: entry.getData('tag') }));
  });
  expect(tagMarkers).toEqual([{ id: 'wands_ace', tag: 'experiment' }]);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-personal-tag-lens.png' });

  await page.keyboard.press('/');
  const searchInput = page.locator('#codex-card-search-input');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('experiment');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardSearch?.query === 'experiment');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardSearch).toMatchObject({
    matchedIds: ['wands_ace'],
    visibleIds: ['wands_ace'],
  });

  await page.keyboard.press('/');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('');
  await page.keyboard.press('Enter');
  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.activeTab = 4;
    cs.detailId = undefined;
    cs.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.cardCollectionLens?.id === 'tagged' && state.cardCollectionLens?.empty === true;
  });
  const empty = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    const texts = walk(cs.root)
      .filter((entry: any) => entry.type === 'Text')
      .map((entry: any) => entry.text);
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      texts,
    };
  });
  expect(empty.texts).toContain('TAGGED LENS');
  expect(empty.texts).toContain('No cards in this set have a personal tag yet.\nOpen a discovered card and choose PERSONAL TAG, or press V / L3.');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('No personal tags in this set');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-personal-tag-empty.png' });
});

test('codex: card search filters real metadata without revealing undiscovered cards and supports pointer, keyboard, controller, persistence, and screen readers', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'wands_ace', 'wands_02', 'wands_03'],
      favoriteCards: [],
      cardCollection: {
        wands_02: {
          timesClaimed: 2,
          firstAcquiredAt: Date.UTC(2026, 6, 2),
          firstSource: 'combat_reward',
        },
      },
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.codexCardLens', 'all');
    localStorage.setItem('birdsquad.codexCardSearch', 'Twin Plume');
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.detailId = undefined;
    cs.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.cardSearch?.query === 'Twin Plume'
      && state.cardSearch?.matchedIds?.length === 1
      && state.cardSearch?.matchedIds?.[0] === 'wands_02';
  });

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardSearch).toMatchObject({
    active: true,
    editing: false,
    scope: 'Plumes',
    matchCount: 1,
    visibleCount: 1,
    matchedIds: ['wands_02'],
    keyboard: '/',
    controller: 'RB',
    nativeInput: false,
    maxLength: 40,
    revealsUndiscoveredDetails: false,
    persisted: true,
  });
  expect(state.cardSearch.fields).toEqual([
    'name', 'rules', 'keyword', 'character', 'set', 'type', 'cost', 'rarity', 'ownership', 'active flight usage', 'saved Folio usage', 'personal tag', 'private journal', 'showcase', 'protection',
  ]);
  expect(state.cardCollectionLens).toMatchObject({ baseCount: 1, setCount: 14, visibleIds: ['wands_02'] });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Find cards query Twin Plume');

  const searchHit = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = cs.root.getByName('codex-card-search-hit');
    return { x: hit.x, y: hit.y };
  });
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.click(
    canvas.x + canvas.width * (searchHit.x / 1280),
    canvas.y + canvas.height * (searchHit.y / 720),
  );
  const searchInput = page.locator('#codex-card-search-input');
  await expect(searchInput).toBeVisible();
  await expect(searchInput).toBeFocused();
  await expect(searchInput).toHaveAttribute('aria-label', /ownership, personal tag, private journal, or showcase/i);
  const inputBounds = await searchInput.boundingBox();
  expect(inputBounds?.width).toBeGreaterThanOrEqual(188);
  expect(inputBounds?.height).toBeGreaterThanOrEqual(40);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardSearch).toMatchObject({ editing: true, nativeInput: true });
  await page.screenshot({ path: '.artifacts/test-results/codex-card-search-editing.png', fullPage: true });

  await searchInput.fill('resonance draw');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.cardSearch?.query === 'resonance draw'
      && state.cardSearch?.matchedIds?.includes('wands_02')
      && state.cardSearch?.editing === false;
  });
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.codexCardSearch'))).toBe('resonance draw');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-card-search-populated.png' });

  await page.keyboard.press('/');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('Street Party');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardSearch?.empty === true);
  const hiddenResult = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    const objects = walk(cs.root);
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      emptyPanels: objects.filter((entry: any) => entry.name === 'codex-card-search-empty-state').length,
      texts: objects.filter((entry: any) => entry.type === 'Text').map((entry: any) => entry.text),
    };
  });
  expect(hiddenResult.state.cardSearch).toMatchObject({
    query: 'Street Party',
    matchCount: 0,
    matchedIds: [],
    visibleIds: [],
    empty: true,
  });
  expect(hiddenResult.emptyPanels).toBe(1);
  expect(hiddenResult.texts).toContain('NO CARDS FOUND');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('No card matches every search term');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-card-search-empty.png' });

  await page.keyboard.press('/');
  await searchInput.fill('Plume Flash');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardSearch?.editing === false);
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).cardSearch.query).toBe('Street Party');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.codexCardSearch'))).toBe('Street Party');

  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 5 }, 1);
  });
  await expect(searchInput).toBeVisible();
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.codexFocus).toMatchObject({ zone: 'search', label: 'Find cards, current query Street Party' });
  expect(state.cardSearch).toMatchObject({ editing: true, nativeInput: true, controller: 'RB' });
  await searchInput.fill('');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardSearch?.active === false);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.codexCardSearch'))).toBe('');

  await page.keyboard.press('/');
  await searchInput.fill('Twin Plume');
  await page.keyboard.press('Enter');
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.renderAll();
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardSearch?.query === 'Twin Plume');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).cardSearch.matchedIds)
    .toEqual(['wands_02']);

  await page.keyboard.press('/');
  await expect(searchInput).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(searchInput).toBeHidden();
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).cardSearch.editing).toBe(false);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.keyboard.press('/');
  await expect(searchInput).toBeVisible();
  const mobileInputBounds = await searchInput.boundingBox();
  expect(mobileInputBounds?.width).toBeGreaterThanOrEqual(190);
  expect(mobileInputBounds?.height).toBeGreaterThanOrEqual(46);
  expect(mobileInputBounds?.x).toBeGreaterThanOrEqual(0);
  expect((mobileInputBounds?.x ?? 0) + (mobileInputBounds?.width ?? 0)).toBeLessThanOrEqual(1000);
  await page.screenshot({ path: '.artifacts/test-results/codex-card-search-minimum-landscape-editing.png', fullPage: true });
  await page.keyboard.press('Escape');
});

test('codex: typo-tolerant search corrects conservative misspellings without weakening term or discovery boundaries', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['wands_02'],
      favoriteCards: [],
      cardCollection: {},
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.codexCardLens', 'all');
    localStorage.setItem('birdsquad.codexCardSearch', 'Twni Plume');
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.detailId = undefined;
    cs.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.cardSearch?.query === 'Twni Plume'
      && state.cardSearch?.typoToleranceUsed === true;
  });

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardSearch).toMatchObject({
    matchedIds: ['wands_02'],
    matchCount: 1,
    exactMatchCount: 0,
    typoMatchCount: 1,
    typoMatchedIds: ['wands_02'],
    typoToleranceUsed: true,
    revealsUndiscoveredDetails: false,
    typoTolerance: {
      enabled: true,
      minimumTokenLength: 4,
      fourCharacterRule: 'adjacent transposition only',
      fiveToEightCharacterEdits: 1,
      ninePlusCharacterEdits: 2,
      numericTermsRequireExactMatch: true,
      everyQueryTermMustMatch: true,
    },
  });
  const typoVisual = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    return cs.root.getByName('codex-card-search-kicker')?.text;
  });
  expect(typoVisual).toBe('FIND · 1 · TYPO');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Typo-tolerant matching helped with 1 result');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-typo-tolerant-search.png' });

  const setQuery = async (query: string) => {
    await page.evaluate((nextQuery) => {
      const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
      cs.cardSearchQuery = nextQuery;
      localStorage.setItem('birdsquad.codexCardSearch', nextQuery);
      cs.renderAll();
    }, query);
    return JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  };

  state = await setQuery('Twim Plume');
  expect(state.cardSearch).toMatchObject({
    matchedIds: [],
    typoMatchCount: 0,
    typoToleranceUsed: false,
    empty: true,
  });

  state = await setQuery('resnance draw');
  expect(state.cardSearch).toMatchObject({
    matchedIds: ['wands_02'],
    exactMatchCount: 0,
    typoMatchCount: 1,
    typoToleranceUsed: true,
  });

  state = await setQuery('resonance draw');
  expect(state.cardSearch).toMatchObject({
    matchedIds: ['wands_02'],
    exactMatchCount: 1,
    typoMatchCount: 0,
    typoToleranceUsed: false,
  });

  state = await setQuery('reso');
  expect(state.cardSearch).toMatchObject({
    matchedIds: ['wands_02'],
    exactMatchCount: 1,
    typoMatchCount: 0,
  });

  state = await setQuery('resnance absentword');
  expect(state.cardSearch).toMatchObject({
    matchedIds: [],
    typoMatchCount: 0,
    empty: true,
  });
  const emptyCopy = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    return walk(cs.root)
      .filter((entry: any) => entry.type === 'Text')
      .map((entry: any) => entry.text);
  });
  expect(emptyCopy).toContain('No cards in Plumes match every search term.\nCheck spelling, remove SEARCH above, or choose Clear filters.');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('No card matches every search term');

  state = await setQuery('Stret Party');
  expect(state.cardSearch).toMatchObject({
    matchedIds: [],
    typoMatchCount: 0,
    revealsUndiscoveredDetails: false,
  });

  state = await setQuery('cost 999');
  expect(state.cardSearch).toMatchObject({
    matchedIds: [],
    typoMatchCount: 0,
  });
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.codexCardSearch'))).toBe('cost 999');
});

test('codex: card inspection returns to the exact filtered selection and scroll context across pointer, keyboard, and controller', async ({ page }) => {
  await page.addInitScript(() => {
    const ids = [
      'wands_ace', 'wands_02', 'wands_03', 'wands_04', 'wands_05', 'wands_06', 'wands_07',
      'wands_08', 'wands_09', 'wands_10', 'wands_fledgling', 'wands_outrider', 'wands_matron', 'wands_elder',
    ];
    const cardCollection = Object.fromEntries(ids.map((id, index) => [id, {
      timesClaimed: 1,
      firstAcquiredAt: 100 + index,
      firstSource: 'combat_reward',
    }]));
    const account = { discoveredCards: ids, favoriteCards: [], cardCollection };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.codexCardLens', 'collected');
    localStorage.setItem('birdsquad.codexCardSearch', 'Plumes');
    localStorage.setItem('birdsquad.codexCardSort', 'name');
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  const setup = await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.detailId = undefined;
    cs.focusZone = 'entries';
    cs.entryFocusIndex = 11;
    cs.resetCodexScroll();
    cs.renderAll();
    cs.ensureFocusedEntryVisible();
    cs.gridScroll = cs.gridScrollTarget;
    cs.renderAll();
    const selectedId = cs.codexFocusEntries()[11].id;
    const tile = cs.gridLayer.list.find((entry: any) => entry.getData('cardId') === selectedId);
    const hit = tile.getByName('codex-card-entry-hit');
    const bounds = hit.getBounds();
    return {
      selectedId,
      entryIndex: 11,
      scroll: cs.gridScroll,
      hit: {
        x: bounds.centerX,
        y: bounds.centerY,
        width: hit.displayWidth,
        height: hit.displayHeight,
      },
    };
  });
  expect(setup.scroll).toBeGreaterThan(0);
  expect(setup.hit.width).toBeGreaterThanOrEqual(190);
  expect(setup.hit.height).toBeGreaterThanOrEqual(278);
  // The forced scene/scroll setup replaces Phaser's interactive objects.
  // Wait for streamed art and the input/render frames before a real click.
  await page.waitForFunction((selectedId) => {
    const cs = window.__birdSquadGame.scene.getScene('CodexScene');
    const tile = cs.gridLayer.list.find((entry: any) => entry.getData('cardId') === selectedId);
    return tile?.getByName('codex-card-art') && !cs.load.isLoading();
  }, setup.selectedId);
  await settleCanvas(page);
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.move(
    canvas.x + canvas.width * (setup.hit.x / 1280),
    canvas.y + canvas.height * (setup.hit.y / 720),
  );
  await page.mouse.click(
    canvas.x + canvas.width * (setup.hit.x / 1280),
    canvas.y + canvas.height * (setup.hit.y / 720),
  );
  await page.waitForFunction((selectedId) => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.detailOpen === selectedId && state.inspectionReturn?.captured === true;
  }, setup.selectedId);

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.inspectionReturn).toMatchObject({
    detailOpen: true,
    captured: true,
    selectedId: setup.selectedId,
    entryIndex: 11,
    gridScroll: setup.scroll,
    gridScrollTarget: setup.scroll,
    section: 'cards',
    set: 'Plumes',
    lens: 'collected',
    query: 'Plumes',
    sort: 'name',
    oneActionOpen: true,
    restoresExactContextWhenMembershipUnchanged: true,
    keyboard: { open: 'Enter', close: 'Enter / Esc' },
    controller: { open: 'A', close: 'A / B' },
    pointer: { open: 'Card', close: 'Close / backdrop' },
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('selected card, and prior scroll position');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-inspection-return-detail.png' });

  const close = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = cs.root.getByName('codex-detail-close-hit');
    return { x: hit.x, y: hit.y };
  });
  await page.mouse.click(
    canvas.x + canvas.width * (close.x / 1280),
    canvas.y + canvas.height * (close.y / 720),
  );
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').inspectionReturn?.lastRestoredExact === true);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.detailOpen).toBe('');
  expect(state.codexFocus).toMatchObject({ zone: 'entries', index: 11, gridScroll: setup.scroll });
  expect(state.cardSearch).toMatchObject({ query: 'Plumes' });
  expect(state.cardCollectionLens).toMatchObject({ id: 'collected' });
  expect(state.cardSort).toMatchObject({ id: 'name' });
  expect(state.inspectionReturn).toMatchObject({
    selectedId: setup.selectedId,
    lastRestoredExact: true,
    membershipChanged: false,
    gridScroll: setup.scroll,
  });
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-inspection-return-grid.png' });

  await page.keyboard.press('Enter');
  await page.waitForFunction((selectedId) => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === selectedId, setup.selectedId);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').inspectionReturn?.lastRestoredExact === true);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.codexFocus).toMatchObject({ zone: 'entries', index: 11, gridScroll: setup.scroll });

  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 0 }, 1);
  });
  await page.waitForFunction((selectedId) => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === selectedId, setup.selectedId);
  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 1 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').inspectionReturn?.lastRestoredExact === true);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.codexFocus).toMatchObject({ zone: 'entries', index: 11, gridScroll: setup.scroll });
  expect(await page.evaluate(() => ({
    lens: localStorage.getItem('birdsquad.codexCardLens'),
    query: localStorage.getItem('birdsquad.codexCardSearch'),
    sort: localStorage.getItem('birdsquad.codexCardSort'),
  }))).toEqual({ lens: 'collected', query: 'Plumes', sort: 'name' });
});

test('codex: card sorting supports binder, name, rarity, and acquisition recency without leaking unfound metadata', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'wands_ace', 'wands_02', 'wands_03', 'wands_04'],
      favoriteCards: [],
      cardCollection: {
        wands_ace: {
          timesClaimed: 1,
          firstAcquiredAt: Date.UTC(2026, 5, 1),
          firstSource: 'starter_flock',
        },
        wands_02: {
          timesClaimed: 2,
          firstAcquiredAt: Date.UTC(2026, 5, 3),
          firstSource: 'combat_reward',
        },
        wands_04: {
          timesClaimed: 1,
          firstAcquiredAt: Date.UTC(2026, 5, 4),
          firstSource: 'market_purchase',
        },
      },
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.codexCardLens', 'all');
    localStorage.setItem('birdsquad.codexCardSearch', '');
    localStorage.setItem('birdsquad.codexCardSort', 'binder');
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.detailId = undefined;
    cs.renderAll();
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardSort?.id === 'binder');

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardSort).toMatchObject({
    id: 'binder',
    label: 'Binder',
    index: 0,
    count: 4,
    discoveredIds: ['wands_02', 'wands_03', 'wands_04', 'wands_ace'],
    collectedIds: ['wands_02', 'wands_04', 'wands_ace'],
    keyboard: 'R',
    controller: 'RT',
    hidesUndiscoveredMetadata: true,
    persisted: true,
  });
  const binderHiddenIds = state.cardSort.visibleIds.filter((id: string) => !state.cardSort.discoveredIds.includes(id));
  const sortHit = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    if (!cs.collectionToolsOpen) cs.toggleCollectionTools();
    const hit = cs.root.getByName('codex-card-sort-hit');
    return { x: hit.x, y: hit.y, width: hit.displayWidth, height: hit.displayHeight };
  });
  expect(sortHit.width).toBeGreaterThanOrEqual(62);
  expect(sortHit.height).toBeGreaterThanOrEqual(46);
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.click(
    canvas.x + canvas.width * (sortHit.x / 1280),
    canvas.y + canvas.height * (sortHit.y / 720),
  );
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardSort?.id === 'name');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.codexFocus).toMatchObject({ zone: 'sort', label: 'Sort cards, Name' });
  expect(state.cardSort.discoveredIds).toEqual(['wands_ace', 'wands_03', 'wands_04', 'wands_02']);
  expect(state.cardSort.visibleIds.slice(state.cardSort.discoveredIds.length)).toEqual(binderHiddenIds);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.codexCardSort'))).toBe('name');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Sorted by Name. Use R or controller RT');

  await page.keyboard.press('r');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardSort?.id === 'rarity');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.codexCardSort'))).toBe('rarity');

  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 7 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardSort?.id === 'recent');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardSort).toMatchObject({
    label: 'Recent',
    discoveredIds: ['wands_04', 'wands_02', 'wands_ace', 'wands_03'],
    collectedIds: ['wands_04', 'wands_02', 'wands_ace'],
  });
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.codexCardSort'))).toBe('recent');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-card-sort-recent.png' });

  await page.keyboard.press('/');
  const searchInput = page.locator('#codex-card-search-input');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('resonance');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardSearch?.query === 'resonance');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardSort).toMatchObject({
    id: 'recent',
    visibleIds: ['wands_04', 'wands_02', 'wands_ace', 'wands_03'],
  });
  expect(state.cardSearch.visibleIds).toEqual(state.cardSort.visibleIds);

  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.cardSort?.id === 'recent' && state.cardSearch?.query === 'resonance';
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardSort.visibleIds).toEqual(['wands_04', 'wands_02', 'wands_ace', 'wands_03']);
});

test('codex: Saved Views preserve sanitized set, lens, search, and sort combinations across pointer, keyboard, controller, and backup-safe persistence', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'wands_ace', 'wands_02', 'swords_ace', 'swords_02'],
      favoriteCards: ['wands_02'],
      cardTags: { swords_02: 'experiment' },
      cardCollection: {
        wands_02: { timesClaimed: 1, firstAcquiredAt: 100, firstSource: 'combat_reward' },
        swords_02: { timesClaimed: 1, firstAcquiredAt: 200, firstSource: 'route_reward' },
      },
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
    localStorage.setItem('birdsquad.codexCardLens', 'all');
    localStorage.setItem('birdsquad.codexCardSearch', '');
    localStorage.setItem('birdsquad.codexCardSort', 'binder');
    localStorage.setItem('birdsquad.codexSavedViews', JSON.stringify([
      {
        id: 'view-major-all',
        name: '<untrusted name>',
        tab: 'major',
        lens: 'all',
        query: '',
        sort: 'binder',
        createdAt: 100,
      },
      {
        id: 'view-invalid',
        name: 'Invalid',
        tab: 'not-a-set',
        lens: 'all',
        query: '',
        sort: 'binder',
        createdAt: 101,
      },
      {
        id: 'view-duplicate-id',
        name: 'Duplicate',
        tab: 'plumes',
        lens: 'all',
        query: '',
        sort: 'binder',
        createdAt: 102,
      },
      {
        id: 'view-duplicate-id',
        name: 'Duplicate again',
        tab: 'quills',
        lens: 'all',
        query: '',
        sort: 'binder',
        createdAt: 103,
      },
    ]));
  });
  await boot(page);
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 3;
    cs.cardCollectionLens = 'collected';
    cs.cardSearchQuery = 'resonance';
    cs.cardSortMode = 'rarity';
    cs.detailId = undefined;
    cs.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.savedCollectionViews?.count === 2
      && state.savedCollectionViews?.current?.tab === 'quills';
  });

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedCollectionViews).toMatchObject({
    open: false,
    count: 2,
    capacity: 4,
    private: true,
    includedInBackups: true,
    affectsPower: false,
    persisted: true,
    replacesAtCapacity: false,
    controller: { open: 'Select', save: 'X', delete: 'Y', apply: 'A', close: 'B' },
  });
  expect(state.savedCollectionViews.items.map((view: any) => view.id))
    .toEqual(['view-major-all', 'view-duplicate-id']);
  expect(state.savedCollectionViews.items[0].name).toBe('Major · All');
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('birdsquad.codexSavedViews') ?? '[]')))
    .toHaveLength(2);

  const viewControl = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    if (!cs.collectionToolsOpen) cs.toggleCollectionTools();
    const hit = cs.root.getByName('codex-saved-views-hit');
    return { x: hit.x, y: hit.y, width: hit.displayWidth, height: hit.displayHeight };
  });
  expect(viewControl.width).toBeGreaterThanOrEqual(52);
  expect(viewControl.height).toBeGreaterThanOrEqual(44);
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.click(
    canvas.x + canvas.width * (viewControl.x / 1280),
    canvas.y + canvas.height * (viewControl.y / 720),
  );
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedCollectionViews?.open === true);
  const saveControl = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = cs.root.getByName('codex-saved-view-save-hit');
    return { x: hit.x, y: hit.y };
  });
  await page.mouse.click(
    canvas.x + canvas.width * (saveControl.x / 1280),
    canvas.y + canvas.height * (saveControl.y / 720),
  );
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedCollectionViews?.status === 'saved');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedCollectionViews).toMatchObject({
    count: 3,
    selectedIndex: 2,
    currentMatchesSaved: true,
  });
  expect(state.savedCollectionViews.items[2]).toMatchObject({
    name: 'Quills · Collected · “resonance” · Rarity',
    tab: 'quills',
    lens: 'collected',
    query: 'resonance',
    sort: 'rarity',
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Saved Collection Views open');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-saved-collection-views.png' });

  await page.keyboard.press('b');
  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.activeTab = 0;
    cs.cardCollectionLens = 'all';
    cs.cardSearchQuery = '';
    cs.cardSortMode = 'binder';
    cs.renderAll();
  });
  await page.keyboard.press('b');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedCollectionViews?.open === true);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.savedCollectionViews?.open === false
      && state.savedCollectionViews?.current?.tab === 'quills'
      && state.cardCollectionLens?.id === 'collected'
      && state.cardSearch?.query === 'resonance'
      && state.cardSort?.id === 'rarity';
  });
  expect(await page.evaluate(() => ({
    lens: localStorage.getItem('birdsquad.codexCardLens'),
    search: localStorage.getItem('birdsquad.codexCardSearch'),
    sort: localStorage.getItem('birdsquad.codexCardSort'),
  }))).toEqual({ lens: 'collected', search: 'resonance', sort: 'rarity' });

  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.activeTab = 0;
    cs.cardCollectionLens = 'all';
    cs.cardSearchQuery = '';
    cs.cardSortMode = 'binder';
    cs.renderAll();
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 8 }, 1);
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 13 }, 1);
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 13 }, 1);
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 0 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedCollectionViews?.current?.tab === 'quills');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedCollectionViews.open).toBe(false);
  expect(state.cardCollectionLens.id).toBe('collected');
  expect(state.cardSort.id).toBe('rarity');

  await page.keyboard.press('b');
  await page.keyboard.press('Delete');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).savedCollectionViews.removalPending).toBe(true);
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedCollectionViews?.status === 'deleted');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedCollectionViews.count).toBe(2);
  expect(state.savedCollectionViews.items.map((view: any) => view.tab)).toEqual(['major', 'plumes']);

  await page.keyboard.press('b');
  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const views = [
      { id: 'view-1', name: 'One', tab: 'major', lens: 'all', query: '', sort: 'binder', createdAt: 1 },
      { id: 'view-2', name: 'Two', tab: 'aviary', lens: 'collected', query: '', sort: 'name', createdAt: 2 },
      { id: 'view-3', name: 'Three', tab: 'plumes', lens: 'seen', query: 'draw', sort: 'rarity', createdAt: 3 },
      { id: 'view-4', name: 'Four', tab: 'quills', lens: 'tagged', query: '', sort: 'recent', createdAt: 4 },
    ];
    cs.savedCollectionViews = views;
    localStorage.setItem('birdsquad.codexSavedViews', JSON.stringify(views));
    cs.activeTab = 4;
    cs.cardCollectionLens = 'uncollected';
    cs.cardSearchQuery = 'cover';
    cs.cardSortMode = 'name';
    cs.renderAll();
  });
  await page.keyboard.press('b');
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').savedCollectionViews?.status === 'full');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.savedCollectionViews).toMatchObject({ count: 4, status: 'full', replacesAtCapacity: false });
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('birdsquad.codexSavedViews') ?? '[]')))
    .toHaveLength(4);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('four-view shelf is full');
});

test('codex: active filter chips remove search and lens individually or together without losing set and sort context', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['wands_ace', 'wands_02', 'wands_03'],
      favoriteCards: [],
      cardCollection: {
        wands_02: {
          timesClaimed: 1,
          firstAcquiredAt: 200,
          firstSource: 'combat_reward',
        },
      },
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
    localStorage.setItem('birdsquad.codexCardLens', 'collected');
    localStorage.setItem('birdsquad.codexCardSearch', 'resonance');
    localStorage.setItem('birdsquad.codexCardSort', 'recent');
  });
  await boot(page);
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.detailId = undefined;
    cs.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.activeCardFilters?.visible === true
      && state.activeCardFilters?.count === 2
      && state.activeCardFilters?.gridTop === 258;
  });

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.activeCardFilters).toMatchObject({
    visible: true,
    count: 2,
    individualRemoval: true,
    clearAllRendered: true,
    gridTop: 258,
    clearsSet: false,
    clearsSort: false,
    affectsOwnership: false,
    persisted: true,
    keyboard: { focus: 'Tab', remove: 'Enter / Delete' },
    controller: { choose: 'D-pad Left / Right', remove: 'A' },
  });
  expect(state.activeCardFilters.chips.map((chip: any) => ({
    id: chip.id,
    value: chip.value,
    clearAll: chip.clearAll,
  }))).toEqual([
    { id: 'search', value: 'resonance', clearAll: false },
    { id: 'lens', value: 'Collected', clearAll: false },
    { id: 'clear', value: '2 active', clearAll: true },
  ]);
  expect(state.cardSort.id).toBe('recent');
  expect(state.cardSearch.scope).toBe('Plumes');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Active filter chips: Search, resonance; Lens, Collected');

  const chipTargets = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    return cs.root.list
      .filter((entry: any) => entry.name === 'codex-active-filter-chip-hit')
      .map((entry: any) => ({
        id: entry.getData('filterId'),
        x: entry.x,
        y: entry.y,
        width: entry.displayWidth,
        height: entry.displayHeight,
      }));
  });
  expect(chipTargets.map((target: any) => target.id)).toEqual(['search', 'lens', 'clear']);
  expect(chipTargets.every((target: any) => target.width >= 142 && target.height >= 44)).toBe(true);
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  const searchChip = chipTargets.find((target: any) => target.id === 'search');
  await page.mouse.move(
    canvas.x + canvas.width * (searchChip.x / 1280),
    canvas.y + canvas.height * (searchChip.y / 720),
  );
  const pointerHit = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    return cs.input.hitTestPointer(cs.input.activePointer).map((entry: any) => ({
      name: entry.name,
      filterId: entry.getData?.('filterId'),
    }));
  });
  expect(pointerHit).toContainEqual({
    name: 'codex-active-filter-chip-hit',
    filterId: 'search',
  });
  await page.mouse.click(
    canvas.x + canvas.width * (searchChip.x / 1280),
    canvas.y + canvas.height * (searchChip.y / 720),
  );
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.cardSearch?.query === ''
      && state.cardCollectionLens?.id === 'collected'
      && state.activeCardFilters?.count === 1;
  });
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.codexCardSearch'))).toBe('');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.activeCardFilters.chips.map((chip: any) => chip.id)).toEqual(['lens', 'clear']);

  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.cardSearchQuery = 'resonance';
    cs.focusZone = 'primaryTabs';
    cs.activeCardFilterIndex = 0;
    localStorage.setItem('birdsquad.codexCardSearch', 'resonance');
    cs.renderAll();
  });
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').codexFocus?.zone === 'activeFilters');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.cardCollectionLens?.id === 'all'
      && state.cardSearch?.query === 'resonance'
      && state.activeCardFilters?.count === 1;
  });
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.codexCardLens'))).toBe('all');

  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.cardCollectionLens = 'collected';
    cs.focusZone = 'primaryTabs';
    cs.activeCardFilterIndex = 0;
    localStorage.setItem('birdsquad.codexCardLens', 'collected');
    cs.renderAll();
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 13 }, 1);
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 15 }, 1);
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: 0 }, 1);
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.cardCollectionLens?.id === 'all'
      && state.cardSearch?.query === 'resonance';
  });

  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.cardCollectionLens = 'collected';
    localStorage.setItem('birdsquad.codexCardLens', 'collected');
    cs.renderAll();
  });
  const clearChip = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = cs.root.list.find((entry: any) => (
      entry.name === 'codex-active-filter-chip-hit' && entry.getData('filterId') === 'clear'
    ));
    return { x: hit.x, y: hit.y };
  });
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-active-filter-chips.png' });
  await page.mouse.click(
    canvas.x + canvas.width * (clearChip.x / 1280),
    canvas.y + canvas.height * (clearChip.y / 720),
  );
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.activeCardFilters?.visible === false
      && state.activeCardFilters?.count === 0
      && state.activeCardFilters?.gridTop === 194;
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardSearch.query).toBe('');
  expect(state.cardCollectionLens.id).toBe('all');
  expect(state.cardSort.id).toBe('recent');
  expect(state.cardSearch.scope).toBe('Plumes');
  expect(await page.evaluate(() => ({
    search: localStorage.getItem('birdsquad.codexCardSearch'),
    lens: localStorage.getItem('birdsquad.codexCardLens'),
    sort: localStorage.getItem('birdsquad.codexCardSort'),
  }))).toEqual({ search: '', lens: 'all', sort: 'recent' });
});

test('codex: Collection Atlas reports permanent set, rarity, and acquisition progress with pointer, keyboard, controller, and screen-reader access', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: [
        'major_00', 'major_01', 'aviary_22', 'wands_ace', 'wands_02',
        'swords_ace', 'cups_ace', 'pentacles_ace', 'tangled_line',
      ],
      favoriteCards: [],
      cardCollection: {
        major_00: { timesClaimed: 1, firstAcquiredAt: 10, firstSource: 'starter_flock' },
        aviary_22: { timesClaimed: 1, firstAcquiredAt: 20, firstSource: 'combat_reward' },
        wands_ace: { timesClaimed: 1, firstAcquiredAt: 30, firstSource: 'route_reward' },
        swords_ace: { timesClaimed: 1, firstAcquiredAt: 40, firstSource: 'market' },
        tangled_line: { timesClaimed: 1, firstAcquiredAt: 50, firstSource: 'snag' },
      },
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
    localStorage.setItem('birdsquad.codexCardSearch', '');
    localStorage.setItem('birdsquad.codexCardLens', 'all');
  });
  await boot(page);
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.detailId = undefined;
    cs.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.collectionAtlas?.overall?.owned === 5
      && state.cardCollection?.id === 'plumes';
  });

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardCollection).toMatchObject({
    id: 'plumes',
    name: 'Plumes',
    found: 1,
    owned: 1,
    discovered: 2,
    total: 14,
    stage: 'First Shelf',
  });
  expect(state.collectionAtlas).toMatchObject({
    open: false,
    keyboard: 'G',
    controller: 'R3',
    revealsUndiscoveredIdentities: false,
    overall: { owned: 5, discovered: 9, total: 110 },
  });
  expect(state.collectionAtlas.families.map((family: any) => ({
    id: family.id,
    owned: family.owned,
    total: family.total,
  }))).toEqual([
    { id: 'major', owned: 1, total: 22 },
    { id: 'aviary', owned: 1, total: 22 },
    { id: 'plumes', owned: 1, total: 14 },
    { id: 'quills', owned: 1, total: 14 },
    { id: 'basins', owned: 0, total: 14 },
    { id: 'nests', owned: 0, total: 14 },
    { id: 'snags', owned: 1, total: 10 },
  ]);
  expect(state.collectionAtlas.rarities.reduce((sum: number, rarity: any) => sum + rarity.total, 0)).toBe(110);
  expect(state.collectionAtlas.rarities.reduce((sum: number, rarity: any) => sum + rarity.owned, 0)).toBe(5);
  expect(state.collectionAtlas.sources).toEqual([
    { id: 'starter_flock', name: 'Starter Flock', count: 1 },
    { id: 'combat_reward', name: 'Fight Rewards', count: 1 },
    { id: 'route_reward', name: 'Route Choices', count: 1 },
    { id: 'market', name: 'Canal Market', count: 1 },
    { id: 'snag', name: 'Enemy Snags', count: 1 },
  ]);
  expect(JSON.stringify(state.collectionAtlas)).not.toContain('major_21');
  expect(JSON.stringify(state.collectionAtlas)).not.toContain('The World');

  const rail = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    if (!cs.collectionToolsOpen) cs.toggleCollectionTools();
    const hit = cs.root.getByName('codex-card-collection-atlas-hit');
    return { x: hit.x, y: hit.y, width: hit.displayWidth, height: hit.displayHeight };
  });
  expect(rail.width).toBeGreaterThanOrEqual(196);
  expect(rail.height).toBeGreaterThanOrEqual(44);
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.waitForTimeout(200);
  const railClientX = canvas.x + canvas.width * (rail.x / 1280);
  const railClientY = canvas.y + canvas.height * (rail.y / 720);
  await page.mouse.move(railClientX, railClientY);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionAtlas?.open === true);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.codexFocus).toMatchObject({
    zone: 'progressOverlay',
    index: 2,
    count: 7,
    label: 'Plumes collection, 1 of 14 collected',
    ringRendered: true,
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Collection Atlas open');
  expect(await page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('Focused Plumes, 1 of 14 collected and 2 encountered');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-collection-atlas.png' });

  const quillsHit = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = cs.root.list.find((entry: any) => (
      entry.name === 'codex-collection-atlas-family-hit' && entry.getData('family') === 'quills'
    ));
    return { x: hit.x, y: hit.y };
  });
  await page.mouse.click(
    canvas.x + canvas.width * (quillsHit.x / 1280),
    canvas.y + canvas.height * (quillsHit.y / 720),
  );
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.collectionAtlas?.open === false && state.cardCollection?.id === 'quills';
  });

  await page.keyboard.press('g');
  await page.keyboard.press('ArrowDown');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.collectionAtlas).toMatchObject({
    open: true,
    selectedIndex: 4,
    selectedFamily: { id: 'basins', owned: 0, discovered: 1, total: 14 },
  });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardCollection?.id === 'basins');

  const gamepadDown = (index: number) => page.evaluate((buttonIndex) => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.input.gamepad.emit('down', cs.input.gamepad.pad1, { index: buttonIndex }, 1);
  }, index);
  await gamepadDown(11);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionAtlas?.open === true);
  await gamepadDown(11);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionAtlas?.open === false);
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).cardCollection.id).toBe('basins');

  await gamepadDown(11);
  await gamepadDown(13);
  await gamepadDown(0);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardCollection?.id === 'nests');
  await gamepadDown(11);
  await gamepadDown(1);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionAtlas?.open === false);
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).cardCollection.id).toBe('nests');

  await page.setViewportSize({ width: 1000, height: 560 });
  await page.keyboard.press('g');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionAtlas?.open === true);
  await page.screenshot({ path: '.artifacts/test-results/codex-collection-atlas-minimum-landscape.png', fullPage: true });
  const panelBounds = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const panel = cs.root.getByName('codex-collection-atlas-panel');
    return {
      left: panel.getBounds().left,
      top: panel.getBounds().top,
      right: panel.getBounds().right,
      bottom: panel.getBounds().bottom,
    };
  });
  expect(panelBounds).toEqual({ left: 40, top: 14, right: 1240, bottom: 698 });
});

test('codex: acquisition paths explain permanent missing-card sources without leaking concealed identities', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['wands_ace', 'wands_02', 'tangled_line'],
      favoriteCards: [],
      cardCollection: {
        wands_ace: {
          timesClaimed: 1,
          firstAcquiredAt: Date.UTC(2026, 6, 1),
          firstSource: 'starter_flock',
        },
      },
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
    localStorage.setItem('birdsquad.codexCardSearch', '');
    localStorage.setItem('birdsquad.codexCardLens', 'all');
  });
  await boot(page);
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.detailId = undefined;
    cs.focusZone = 'entries';
    cs.entryFocusIndex = 0;
    cs.cardCollectionLens = 'all';
    cs.cardSearchQuery = '';
    cs.renderAll();
  });

  await page.keyboard.press('g');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionAtlas?.open === true);
  const atlas = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(atlas.collectionAtlas.selectedFamily).toMatchObject({
    id: 'plumes',
    owned: 1,
    discovered: 2,
    total: 14,
  });
  expect(atlas.collectionAtlas.selectedMissing).toMatchObject({
    count: 13,
    encountered: 1,
    concealed: 12,
    revealsIdentities: false,
    permanentAvailability: true,
    rotating: false,
  });
  const missingPaths = atlas.collectionAtlas.selectedMissing.paths;
  expect(missingPaths.map((path: any) => path.id)).toEqual([
    'starter_flock',
    'combat_reward',
    'route_reward',
    'market',
  ]);
  expect(missingPaths.every((path: any) => path.count > 0)).toBe(true);
  expect(missingPaths.find((path: any) => path.id === 'combat_reward').count)
    .toBe(missingPaths.find((path: any) => path.id === 'route_reward').count);
  expect(missingPaths.find((path: any) => path.id === 'combat_reward').count)
    .toBe(missingPaths.find((path: any) => path.id === 'market').count);
  expect(atlas.cardAcquisition).toMatchObject({
    allCardsPermanentlyAvailable: true,
    hasSeasonalCards: false,
    hasRotatingCards: false,
    requiresStore: false,
    revealsUndiscoveredIdentities: false,
    pathlessCardCount: 0,
  });
  expect(JSON.stringify(atlas.collectionAtlas.selectedMissing)).not.toContain('wands_03');
  expect(JSON.stringify(atlas.collectionAtlas.selectedMissing)).not.toContain('Three of Plumes');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('13 missing');
  expect(await page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('All cards are permanent with no rotation, season, or store gate');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-acquisition-paths-atlas.png' });

  await page.keyboard.press('g');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionAtlas?.open === false);
  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.focusZone = 'entries';
    cs.entryFocusIndex = 0;
    cs.renderAll();
  });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === 'wands_02');
  let detail = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      texts: walk(cs.root).filter((entry: any) => entry.type === 'Text').map((entry: any) => entry.text),
      screenReader: document.getElementById('game-status')?.textContent ?? '',
    };
  });
  expect(detail.state.cardAcquisition.detail).toMatchObject({
    permanent: true,
    rotating: false,
    seasonal: false,
    storeRequired: false,
    starterLeaderNames: ['The Spark-Caller'],
  });
  expect(detail.state.cardAcquisition.detail.paths.map((path: any) => path.id)).toEqual([
    'starter_flock',
    'combat_reward',
    'route_reward',
    'market',
  ]);
  expect(detail.texts).toContain('PERMANENT / NO ROTATION / NO SEASON / NO STORE GATE');
  expect(detail.texts).toContain('AVAILABLE FROM / STARTER FLOCK / FIGHT REWARDS / ROUTE CHOICES / CANAL MARKET');
  expect(detail.texts).toContain('STARTER OPTIONS / THE SPARK-CALLER');
  await expect(page.locator('#game-status')).toContainText('Permanently available with no seasonal rotation, expiration, or store gate');
  await expect(page.locator('#game-status')).toContainText('Starter options: The Spark-Caller');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-acquisition-paths-card.png' });

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === '');
  await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    cs.activeTab = 6;
    cs.detailId = undefined;
    cs.cardCollectionLens = 'all';
    cs.cardSearchQuery = '';
    const entries = cs.currentCodexCards();
    cs.entryFocusIndex = Math.max(0, entries.findIndex((card: any) => card.id === 'tangled_line'));
    cs.focusZone = 'entries';
    cs.resetCodexScroll();
    cs.ensureFocusedEntryVisible();
    cs.renderAll();
  });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === 'tangled_line');
  detail = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      texts: walk(cs.root).filter((entry: any) => entry.type === 'Text').map((entry: any) => entry.text),
    };
  });
  expect(detail.state.cardAcquisition.detail.paths.map((path: any) => path.id)).toEqual(['snag']);
  expect(detail.texts).toContain('AVAILABLE FROM / ENEMY SNAGS');
  expect(detail.texts).toContain('Encounter an enemy that inserts this Snag during combat; its permanent collection record is created immediately.');
});

test('codex: virtualizes a very large card library and keeps informative art placeholders bounded to visible rows', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['wands_02'],
      favoriteCards: [],
      cardCollection: {},
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.codexCardSearch', '');
    localStorage.setItem('birdsquad.codexCardLens', 'all');
    localStorage.setItem('birdsquad.codexCardSort', 'binder');
  });
  await boot(page);
  const result = await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    const base = cs.allCards().find((card: any) => card.id === 'wands_02');
    const cards = Array.from({ length: 10_000 }, (_, index) => ({
      ...base,
      id: `stress_${String(index).padStart(5, '0')}`,
      runtime: {
        ...base.runtime,
        displayName: `Library Card ${index + 1}`,
      },
    }));
    cs.allCards = () => cards;
    cs.discovered = new Set(cards.map((card: any) => card.id));
    cs.cardCollection = {};
    cs.cardCollectionLens = 'all';
    cs.cardSearchQuery = '';
    cs.cardSortMode = 'binder';
    cs.activeSection = 'cards';
    cs.activeTab = 2;
    cs.detailId = undefined;
    cs.focusZone = 'entries';
    cs.entryFocusIndex = 0;
    cs.resetCodexScroll();

    const firstStart = performance.now();
    cs.renderAll();
    const firstDuration = performance.now() - firstStart;
    const firstState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const firstPlaceholders = cs.gridLayer.list.flatMap((entry: any) => entry.list ?? []).filter(
      (entry: any) => entry.name === 'codex-card-art-placeholder',
    ).length;

    cs.gridScroll = cs.gridMaxScroll * 0.62;
    cs.gridScrollTarget = cs.gridScroll;
    const deepStart = performance.now();
    cs.renderAll();
    const deepDuration = performance.now() - deepStart;
    const deepState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const deepPlaceholders = cs.gridLayer.list.flatMap((entry: any) => entry.list ?? []).filter(
      (entry: any) => entry.name === 'codex-card-art-placeholder',
    ).length;
    return {
      firstDuration,
      deepDuration,
      firstState,
      deepState,
      firstPlaceholders,
      deepPlaceholders,
      gridMaxScroll: cs.gridMaxScroll,
    };
  });

  expect(result.firstDuration).toBeLessThan(2_500);
  expect(result.deepDuration).toBeLessThan(2_500);
  expect(result.gridMaxScroll).toBeGreaterThan(500_000);
  expect(result.firstState.gridVirtualization).toMatchObject({
    enabled: true,
    sourceEntryCount: 10_000,
    overscanRows: 2,
    artQueueScopedToVisibleRows: true,
    scrollMovesExistingLayerBetweenRenders: true,
    diagnosticIdListLimit: 256,
  });
  expect(result.firstState.gridVirtualization.renderedEntryCount).toBeGreaterThan(0);
  expect(result.firstState.gridVirtualization.renderedEntryCount).toBeLessThanOrEqual(25);
  expect(result.firstState.gridVirtualization.offscreenEntriesSkipped).toBeGreaterThanOrEqual(9_975);
  expect(result.deepState.gridVirtualization.renderedEntryCount).toBeGreaterThan(0);
  expect(result.deepState.gridVirtualization.renderedEntryCount).toBeLessThanOrEqual(30);
  expect(result.deepState.gridVirtualization.offscreenEntriesSkipped).toBeGreaterThanOrEqual(9_970);
  expect(result.firstPlaceholders).toBe(result.firstState.gridVirtualization.renderedEntryCount);
  expect(result.deepPlaceholders).toBe(result.deepState.gridVirtualization.renderedEntryCount);
  expect(result.deepState.cardCollectionLens).toMatchObject({
    visibleCount: 10_000,
    visibleIdsTruncated: true,
  });
  expect(result.deepState.cardCollectionLens.visibleIds).toHaveLength(256);
  expect(result.deepState.cardSearch).toMatchObject({
    matchCount: 10_000,
    matchedIdsTruncated: true,
    visibleIdsTruncated: true,
  });
  expect(result.deepState.cardSearch.matchedIds).toHaveLength(256);
  expect(result.deepState.cardOwnership).toMatchObject({
    collectedCount: 0,
    discoveredNotCollectedTruncated: true,
    idListLimit: 256,
  });
  expect(result.deepState.cardOwnership.discoveredNotCollected).toHaveLength(256);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/codex-virtualized-large-library.png' });
});

test('collection milestones reward breadth, acquisition variety, Hunt goals, and personal curation without power', async ({ page }) => {
  await page.addInitScript(() => {
    const ids = [
      'major_00',
      'wands_ace',
      'swords_ace',
      'cups_ace',
      'pentacles_04',
      'aviary_25',
      'swords_fledgling',
      'cups_fledgling',
      'pentacles_fledgling',
      'wands_fledgling',
    ];
    const cardCollection = Object.fromEntries(ids.map((id) => [id, {
      timesClaimed: 1,
      firstAcquiredAt: Date.UTC(2026, 6, 28),
      firstSource: 'starter_flock',
    }]));
    const account = {
      achievements: [],
      discoveredCards: ids,
      favoriteCards: [],
      cardTags: { major_00: 'staple' },
      cardCollection,
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    const cs: any = await window.__birdSquadStartScene!('CodexScene');
    cs.activeSection = 'cards';
    cs.activeTab = 0;
    cs.detailId = undefined;
    cs.renderAll();
  });
  await page.keyboard.press('g');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionAtlas?.open === true);

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.collectionAtlas).toMatchObject({
    completedMilestones: 2,
    nextMilestone: {
      id: 'collection_curator',
      name: "Curator's Eye",
      current: 1,
      target: 3,
      complete: false,
      reward: "Curator's Eye badge",
    },
  });
  expect(state.collectionAtlas.milestones.map((milestone: any) => ({
    id: milestone.id,
    current: milestone.current,
    target: milestone.target,
    complete: milestone.complete,
  }))).toEqual([
    { id: 'collection_first_shelf', current: 10, target: 10, complete: true },
    { id: 'collection_suit_sampler', current: 4, target: 4, complete: true },
    { id: 'collection_curator', current: 1, target: 3, complete: false },
    { id: 'collection_wayfinder', current: 0, target: 3, complete: false },
    { id: 'collection_many_roads', current: 0, target: 4, complete: false },
    { id: 'collection_citywide', current: 6, target: 7, complete: false },
  ]);
  expect(state.collectionAtlas.milestones.every((milestone: any) => (
    milestone.reward.endsWith('badge') && !('power' in milestone)
  ))).toBe(true);
  const partialRows = await page.evaluate(() => {
    const cs: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const walk = (entry: any): any[] => [entry, ...(Array.isArray(entry?.list) ? entry.list.flatMap(walk) : [])];
    return walk(cs.root)
      .filter((entry: any) => entry.name === 'codex-collection-milestone-row')
      .map((entry: any) => ({ id: entry.getData('milestoneId'), complete: entry.getData('complete') }));
  });
  expect(partialRows).toEqual([
    { id: 'collection_curator', complete: false },
    { id: 'collection_wayfinder', complete: false },
    { id: 'collection_many_roads', complete: false },
  ]);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Collector milestones 2 of 6 earned');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/collection-milestones-progress.png' });

  await page.evaluate(async () => {
    const account = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
    account.cardTags = {
      major_00: 'staple',
      wands_ace: 'experiment',
      swords_ace: 'keepsake',
    };
    account.cardCollection.major_00.targetCompletedAt = Date.UTC(2026, 6, 29);
    account.cardCollection.wands_ace.targetCompletedAt = Date.UTC(2026, 6, 29);
    account.cardCollection.swords_ace.targetCompletedAt = Date.UTC(2026, 6, 29);
    account.cardCollection.aviary_25.firstSource = 'combat_reward';
    account.cardCollection.wands_ace.firstSource = 'route_reward';
    account.cardCollection.swords_ace.firstSource = 'market';
    account.discoveredCards.push('tangled_line');
    account.cardCollection.tangled_line = {
      timesClaimed: 1,
      firstAcquiredAt: Date.UTC(2026, 6, 29),
      firstSource: 'snag',
    };
    localStorage.setItem('birdsquad.account', JSON.stringify(account));
    await window.__birdSquadStartScene!('CodexScene');
  });
  await page.keyboard.press('g');
  await page.waitForFunction(() => {
    const atlas = JSON.parse(window.render_game_to_text?.() ?? '{}').collectionAtlas;
    return atlas?.open === true && atlas.completedMilestones === 6;
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.collectionAtlas.milestones.every((milestone: any) => milestone.complete && milestone.earned)).toBe(true);
  expect(state.collectionAtlas.nextMilestone).toMatchObject({
    id: 'collection_citywide',
    current: 7,
    target: 7,
    complete: true,
  });
  const persisted = await page.evaluate(() => ({
    account: localStorage.getItem('birdsquad.account'),
    backup: localStorage.getItem('birdsquad.account.backup'),
  }));
  const persistedAccount = JSON.parse(persisted.account ?? '{}');
  expect(persistedAccount.achievements.filter((id: string) => id.startsWith('collection_'))).toEqual([
    'collection_first_shelf',
    'collection_suit_sampler',
    'collection_curator',
    'collection_wayfinder',
    'collection_many_roads',
    'collection_citywide',
  ]);
  expect(persisted.backup).toBe(persisted.account);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/collection-milestones-complete.png' });

  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').badgePagination?.page === 1);
  let profile = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(profile.badgePagination.pageCount).toBe(6);
  const allBadges = [...profile.badgePagination.items];
  for (let next = 2; next <= profile.badgePagination.pageCount; next++) {
    await page.keyboard.press('PageDown');
    await page.waitForFunction(next => JSON.parse(window.render_game_to_text?.() ?? '{}').badgePagination?.page === next, next);
    profile = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
    allBadges.push(...profile.badgePagination.items);
  }
  expect(new Set(allBadges.map((item: any) => item.id)).size).toBe(18);
  expect(profile.progression).toMatchObject({
    achievementsEarned: 6,
    achievementTotal: 18,
    collectionMilestonesEarned: 6,
    collectionMilestoneTotal: 6,
  });
  expect(profile.collectionMilestones).toMatchObject({
    completed: 6,
    total: 6,
    next: null,
    rewardsAffectPower: false,
  });
  expect(allBadges
    .filter((item: any) => item.id.startsWith('collection_'))
    .map((item: any) => ({
    id: item.id,
    earned: item.earned,
  }))).toEqual([
    { id: 'collection_first_shelf', earned: true },
    { id: 'collection_suit_sampler', earned: true },
    { id: 'collection_curator', earned: true },
    { id: 'collection_wayfinder', earned: true },
    { id: 'collection_many_roads', earned: true },
    { id: 'collection_citywide', earned: true },
  ]);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Collector milestones 6 of 6 earned');
  await page.screenshot({ path: '.artifacts/test-results/collection-milestones-profile.png', fullPage: true });
});

test('title keeps collection goals in the Atlas reached from its utility', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => {
    const ids = [
      'major_00', 'wands_ace', 'swords_ace', 'cups_ace', 'pentacles_04',
      'aviary_25', 'swords_fledgling', 'cups_fledgling', 'pentacles_fledgling', 'wands_fledgling',
    ];
    const account = {
      achievements: [],
      discoveredCards: ids,
      favoriteCards: [],
      cardTags: { major_00: 'staple' },
      cardCollection: Object.fromEntries(ids.map((id) => [id, {
        timesClaimed: 1,
        firstAcquiredAt: Date.UTC(2026, 6, 28),
        firstSource: 'starter_flock',
      }])),
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
  });
  await boot(page);
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionGoal?.rendered)).toBe(false);
  await page.evaluate(() => {
    const m:any = window.__birdSquadGame.scene.getScene('MenuScene');
    m.menuFocusTargets.get('codex').emit('pointerdown');
  });
  await page.waitForFunction(() => {
    const current = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return current.mode === 'codex' && current.collectionAtlas?.open === true;
  });
  const state = await page.evaluate(() => JSON.parse(window.render_game_to_text!()));
  expect(state.collectionAtlas.nextMilestone).toMatchObject({id:'collection_curator',current:1,target:3});
  await page.screenshot({path:'.artifacts/test-results/quiet-title-collection-atlas.png'});
});

test('collection path surfaces the next optional goal from title and route and returns to the active flight', async ({ page }) => {
  await page.addInitScript(() => {
    const ids = [
      'major_00', 'wands_ace', 'swords_ace', 'cups_ace', 'pentacles_04',
      'aviary_25', 'swords_fledgling', 'cups_fledgling', 'pentacles_fledgling', 'wands_fledgling',
    ];
    const account = {
      achievements: [],
      discoveredCards: ids,
      favoriteCards: [],
      cardTags: { major_00: 'staple' },
      cardCollection: Object.fromEntries(ids.map((id) => [id, {
        timesClaimed: 1,
        firstAcquiredAt: Date.UTC(2026, 6, 28),
        firstSource: 'starter_flock',
      }])),
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').collectionGoal?.rendered)).toBe(false);
  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.collectionGoal).toMatchObject({
    owned:10,total:110,completed:2,next:{id:'collection_curator',current:1,target:3},
    optional:true,affectsPower:false,timeLimited:false,rendered:false,
  });
  await page.evaluate(() => {
    const m:any = window.__birdSquadGame.scene.getScene('MenuScene');
    m.menuFocusTargets.get('codex').emit('pointerdown');
  });
  await page.waitForFunction(() => {
    const current = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return current.mode === 'codex' && current.collectionAtlas?.open === true;
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.origin).toMatchObject({ scene: 'MenuScene', label: 'Title', preservesActiveRun: false });
  expect(state.collectionAtlas.nextMilestone).toMatchObject({ id: 'collection_curator', current: 1, target: 3 });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').scene === 'MenuScene');

  await page.evaluate(async () => window.__birdSquadStartScene!('RouteScene', {}));
  await page.waitForFunction(() => {
    const current = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return current.scene === 'RouteScene' && current.routeAssetsReady === true && current.collectionGoal?.rendered === true;
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  const routeSeed = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.runState.seed;
  });
  expect(state.collectionGoal).toMatchObject({
    owned: 10,
    completed: 2,
    next: { id: 'collection_curator', current: 1, target: 3 },
    optional: true,
    affectsPower: false,
    timeLimited: false,
    rendered: true,
    input: {
      pointer: true,
      keyboard: 'G',
      controller: 'R3',
      destination: 'Collection Atlas',
      returnsTo: 'Route',
    },
  });
  const routeStrip = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const hit = route.children.list.find((child: any) => child.name === 'route-collection-goal-hit');
    const plate = route.children.list.find((child: any) => child.name === 'route-collection-goal-hit-plate');
    const kicker = route.children.list.find((child: any) => child.name === 'route-collection-goal-hit-kicker');
    const label = route.children.list.find((child: any) => child.name === 'route-collection-goal-hit-label');
    const plateBounds = plate.getBounds();
    const contains = (inner: any) => (
      inner.left >= plateBounds.left
      && inner.right <= plateBounds.right
      && inner.top >= plateBounds.top
      && inner.bottom <= plateBounds.bottom
    );
    return {
      bounds: { left: hit.getBounds().left, top: hit.getBounds().top, right: hit.getBounds().right, bottom: hit.getBounds().bottom },
      plateBounds: { left: plateBounds.left, top: plateBounds.top, right: plateBounds.right, bottom: plateBounds.bottom },
      contentInsidePlate: [kicker, label].every((entry) => entry && contains(entry.getBounds())),
      interactive: hit.input?.enabled === true,
    };
  });
  expect(routeStrip.bounds).toEqual({ left: 720, top: 82, right: 1020, bottom: 140 });
  expect(routeStrip.plateBounds).toEqual({ left: 720, top: 82, right: 1020, bottom: 140 });
  expect(routeStrip.contentInsidePlate).toBe(true);
  expect(routeStrip.interactive).toBe(true);
  await page.screenshot({ path: '.artifacts/test-results/collection-path-route.png', fullPage: true });

  await clickNamedGameObject(page, 'RouteScene', 'route-collection-goal-hit');
  await page.waitForFunction(() => {
    const current = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return current.mode === 'codex'
      && current.collectionAtlas?.open === true
      && current.origin?.scene === 'RouteScene';
  });
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.origin).toMatchObject({ scene: 'RouteScene', label: 'Route', preservesActiveRun: true });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const current = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return current.scene === 'RouteScene' && current.routeAssetsReady === true;
  });
  const returnedSeed = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.runState.seed;
  });
  expect(returnedSeed).toBe(routeSeed);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Use G, controller R3');

  await page.keyboard.press('g');
  await page.waitForFunction(() => {
    const current = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return current.mode === 'codex' && current.origin?.scene === 'RouteScene' && current.collectionAtlas?.open === true;
  });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').scene === 'RouteScene');

  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.input.gamepad.emit('down', route.input.gamepad.pad1, { index: 11 }, 1);
  });
  await page.waitForFunction(() => {
    const current = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return current.mode === 'codex' && current.origin?.scene === 'RouteScene' && current.collectionAtlas?.open === true;
  });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').scene === 'RouteScene');
});

test('card showcase preserves three deliberate choices across Codex controls, Flock Record, and save backups', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      discoveredCards: ['major_00', 'wands_ace', 'swords_ace', 'cups_ace', 'pentacles_ace'],
      favoriteCards: [],
      showcase: ['major_00', 'wands_ace', 'major_00', 'missing_card', 'swords_ace', 'cups_ace'],
      cardCollection: {},
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    const codex: any = await window.__birdSquadStartScene!('CodexScene');
    codex.activeSection = 'cards';
    codex.activeTab = 2;
    codex.detailId = 'cups_ace';
    codex.renderAll();
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardShowcase?.count === 3);

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardShowcase).toMatchObject({
    count: 3,
    capacity: 3,
    ids: ['major_00', 'wands_ace', 'swords_ace'],
    detailId: 'cups_ace',
    detailShowcased: false,
    detailCanAdd: false,
    full: true,
    keyboard: 'G',
    controller: 'R3',
    location: 'Flock Record',
    affectsPower: false,
    persisted: true,
    replacesAtCapacity: false,
  });
  const sanitizedAccount = JSON.parse(await page.evaluate(() => localStorage.getItem('birdsquad.account') ?? '{}'));
  expect(sanitizedAccount.showcase).toEqual(['major_00', 'wands_ace', 'swords_ace']);
  const fullLabel = await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    return codex.root.getByName('codex-card-showcase-label')?.text;
  });
  expect(fullLabel).toBe('SHOWCASE FULL');
  const beforeLocked = state.audio.cueRequests.locked ?? 0;
  await page.keyboard.press('g');
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardShowcase.ids).toEqual(['major_00', 'wands_ace', 'swords_ace']);
  expect((state.audio.cueRequests.locked ?? 0) - beforeLocked).toBe(1);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('existing choices are never replaced automatically');

  await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    codex.detailId = 'major_00';
    codex.renderAll();
  });
  await page.keyboard.press('g');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardShowcase?.count === 2);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardShowcase.ids).toEqual(['wands_ace', 'swords_ace']);

  const showcaseHit = await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = codex.root.getByName('codex-card-showcase-hit');
    return { x: hit.x, y: hit.y, width: hit.displayWidth, height: hit.displayHeight };
  });
  expect(showcaseHit.width).toBeGreaterThanOrEqual(180);
  expect(showcaseHit.height).toBeGreaterThanOrEqual(46);
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  const hitX = canvas.x + canvas.width * (showcaseHit.x / 1280);
  const hitY = canvas.y + canvas.height * (showcaseHit.y / 720);
  await page.mouse.move(hitX, hitY);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardShowcase?.count === 3);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardShowcase.ids).toEqual(['wands_ace', 'swords_ace', 'major_00']);

  await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    codex.detailId = 'wands_ace';
    codex.renderAll();
    codex.input.gamepad.emit('down', codex.input.gamepad.pad1, { index: 11 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardShowcase?.count === 2);
  await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    codex.detailId = 'cups_ace';
    codex.renderAll();
    codex.input.gamepad.emit('down', codex.input.gamepad.pad1, { index: 11 }, 1);
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardShowcase?.ids?.includes('cups_ace'));
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardShowcase.ids).toEqual(['swords_ace', 'major_00', 'cups_ace']);

  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-showcase-tab-hit');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').cardShowcase?.selected === true);
  state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(state.cardShowcase).toMatchObject({
    count: 3,
    capacity: 3,
    ids: ['swords_ace', 'major_00', 'cups_ace'],
    empty: false,
    full: true,
    selected: true,
    location: 'Flock Record',
    managedIn: 'Codex card dossiers',
    affectsPower: false,
    persisted: true,
  });
  expect(state.cardShowcase.items.map((item: any) => item.name)).toEqual([
    'Quill Point',
    'First Flight',
    'Open Basin',
  ]);
  const showcaseRender = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return {
      art: profile.children.list
        .filter((child: any) => child.name === 'profile-showcase-card-art')
        .map((child: any) => child.getData('cardId')),
      names: profile.children.list
        .filter((child: any) => child.name === 'profile-showcase-card-name')
        .map((child: any) => child.text),
    };
  });
  expect(showcaseRender.art).toEqual(['swords_ace', 'major_00', 'cups_ace']);
  expect(showcaseRender.names).toEqual(['Quill Point', 'First Flight', 'Open Basin']);
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('Presented cards: Quill Point, First Flight, Open Basin');
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.screenshot({ path: '.artifacts/test-results/card-showcase-profile.png', fullPage: true });

  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-data-hit');
  const downloadPromise = page.waitForEvent('download');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-download-hit');
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('Showcase save backup did not produce a local file');
  const payload = JSON.parse(await readFile(downloadedPath, 'utf8'));
  expect(payload.data.account.showcase).toEqual(['swords_ace', 'major_00', 'cups_ace']);
});

test('codex: snag cards retain their dedicated tab and render card art', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const collect = (scene: any) => {
      const texts: string[] = [];
      const images: string[] = [];
      const imageObjects: Array<{ key: string; alpha: number; visible: boolean }> = [];
      const walk = (o: any) => {
        if (!o) return;
        if (o.type === 'Text') texts.push(o.text || '');
        const key = o.texture?.key;
        if (key) {
          images.push(key);
          imageObjects.push({ key, alpha: o.alpha, visible: o.visible });
        }
        const children = o.list;
        if (Array.isArray(children)) children.forEach(walk);
      };
      scene.children.list.forEach(walk);
      return { texts, images, imageObjects };
    };

    const g = window.__birdSquadGame;
    const acct = JSON.parse(window.localStorage.getItem('birdsquad.account') || '{}');
    acct.discoveredCards = [
      'tangled_line', 'wet_feathers', 'bad_directions', 'loose_shingle', 'static_burst', 'bent_feather',
      'glass_gap', 'jammed_strap', 'barricade_scrap', 'smeared_map'
    ];
    window.localStorage.setItem('birdsquad.account', JSON.stringify(acct));
    await window.__birdSquadStartScene!('CodexScene');
    g.scene.stop('MenuScene');
    const cs: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 20 && !cs.root; i += 1) await wait(50);

    const snagTabIndex = cs.tabs.findIndex((tab: { label: string }) => tab.label === 'Snags');
    cs.activeSection = 'cards';
    cs.activeTab = snagTabIndex;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.renderAll();
    for (let i = 0; i < 60 && (
      !cs.textures.exists('card-thumb-tangled_line')
        || !cs.textures.exists('ui-icon-codex-snags-medallion')
    ); i += 1) await wait(50);
    cs.renderAll();
    const list = collect(cs);

    cs.detailId = 'tangled_line';
    cs.detailScroll = 0;
    cs.renderAll();
    for (let i = 0; i < 40 && !cs.textures.exists('card-tangled_line'); i += 1) await wait(50);
    cs.renderAll();
    const detail = collect(cs);

    return {
      snagTabIndex,
      snagCount: cs.allCards().filter((card: any) => card.runtime.kind === 'snag').length,
      hasSnagTab: list.texts.some((text) => text === 'Snags'),
      snagsTabTextureLoaded: cs.textures.exists('ui-icon-codex-snags-medallion'),
      snagsTabMedallions: list.imageObjects.filter((image) => image.key === 'ui-icon-codex-snags-medallion'),
      hasThumbArt: [
        'card-thumb-tangled_line',
        'card-thumb-wet_feathers',
        'card-thumb-bad_directions',
        'card-thumb-loose_shingle',
        'card-thumb-static_burst',
        'card-thumb-bent_feather',
        'card-thumb-glass_gap',
        'card-thumb-jammed_strap',
        'card-thumb-barricade_scrap',
        'card-thumb-smeared_map',
      ].every((key) => (
        list.images.includes(key) || cs.textures.exists(key)
      )),
      hasDetailArt: detail.images.includes('card-tangled_line'),
      hasDetailTitle: detail.texts.some((text) => /Tangled Line/.test(text)),
      hasDossier: detail.texts.some((text) => /SNAG DOSSIER/.test(text)),
    };
  });

  expect(r.snagTabIndex).toBeGreaterThanOrEqual(0);
  expect(r.snagCount).toBe(10);
  expect(r.hasSnagTab).toBe(true);
  expect(r.snagsTabTextureLoaded).toBe(true);
  expect(r.snagsTabMedallions).toEqual([]);
  expect(r.hasThumbArt).toBe(true);
  expect(r.hasDetailArt).toBe(true);
  expect(r.hasDetailTitle).toBe(true);
  expect(r.hasDossier).toBe(true);
});

test('codex: supplies are listed as items with usable details', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const collectTexts = (scene: any) => {
      const all: any[] = [];
      const walk = (o: any) => {
        if (!o) return;
        if (o.type === 'Text') all.push(o);
        const children = o.list;
        if (Array.isArray(children)) children.forEach(walk);
      };
      scene.children.list.forEach(walk);
      return all.map((t) => t.text || '');
    };
    const collectObjects = (node: any): any[] => {
      const children = node?.list ?? [];
      return children.flatMap((child: any) => [child, ...collectObjects(child)]);
    };
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('CodexScene');
    g.scene.stop('MenuScene');
    const cs: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 20 && !cs.root; i += 1) await wait(50);
    cs.activeSection = 'items';
    cs.activeItemTypeTab = 2;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.renderAll();
    const itemMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-items-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const itemsAllMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-items-all-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const supplyMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-supplies-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const suppliesAllMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-supplies-all-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const combatMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-combat-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const routePlanMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-route-plan-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const flexibleMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-flexible-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const defenseMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-defense-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const recoveryMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-recovery-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const momentumMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-momentum-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const pressureMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-pressure-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    for (let i = 0; i < 40 && !cs.textures.exists('supply-thumb-bottlecap_popper'); i += 1) await wait(50);
    const listTexts = collectTexts(cs);

    cs.detailId = 'seed_packet';
    cs.detailScroll = 0;
    cs.renderAll();
    for (let i = 0; i < 40 && !cs.textures.exists('supply-seed_packet'); i += 1) await wait(50);
    cs.renderAll();
    const detailTexts = collectTexts(cs);
    const detailUsesFullArt = collectObjects(cs.root)
      .some((child: any) => child.texture?.key === 'supply-seed_packet');

    cs.activeSection = 'items';
    cs.activeItemTypeTab = 0;
    cs.activeItemFilterTab = 0;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const activeItemsAllMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-items-all-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));

    cs.activeSection = 'items';
    cs.activeItemTypeTab = 2;
    cs.activeItemFilterTab = 1;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const activeCombatMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-combat-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));

    cs.activeSection = 'items';
    cs.activeItemTypeTab = 2;
    cs.activeItemFilterTab = 2;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const activeRoutePlanMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-route-plan-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));

    cs.activeSection = 'items';
    cs.activeItemTypeTab = 2;
    cs.activeItemFilterTab = 3;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const activeFlexibleMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-flexible-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));

    cs.activeSection = 'items';
    cs.activeItemTypeTab = 2;
    cs.activeItemFilterTab = 4;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const activeDefenseMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-defense-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));

    cs.activeSection = 'items';
    cs.activeItemTypeTab = 2;
    cs.activeItemFilterTab = 5;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const activeRecoveryMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-recovery-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));

    cs.activeSection = 'items';
    cs.activeItemTypeTab = 2;
    cs.activeItemFilterTab = 6;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const activeMomentumMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-momentum-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));

    cs.activeSection = 'items';
    cs.activeItemTypeTab = 2;
    cs.activeItemFilterTab = 7;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const activePressureMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-pressure-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));

    cs.activeSection = 'items';
    cs.activeItemTypeTab = 1;
    cs.activeItemFilterTab = 0;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const waymarkTexts = collectTexts(cs);
    const waymarkMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-waymark-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const moltMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-molt-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const bossMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-boss-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const waymarkFamilyMedallionKeys = [
      'ui-icon-codex-waymark-all-medallion',
      'ui-icon-codex-waymark-shelter-medallion',
      'ui-icon-codex-waymark-tempo-medallion',
      'ui-icon-codex-waymark-economy-medallion',
      'ui-icon-codex-waymark-suit-medallion',
    ];
    const waymarkFamilyMedallions = [];
    for (let i = 0; i < waymarkFamilyMedallionKeys.length; i += 1) {
      const key = waymarkFamilyMedallionKeys[i];
      cs.activeSection = 'items';
      cs.activeItemTypeTab = 1;
      cs.activeItemFilterTab = i;
      cs.detailId = undefined;
      cs.gridScroll = 0;
      cs.gridScrollTarget = 0;
      cs.renderAll();
      waymarkFamilyMedallions.push({
        key,
        loaded: cs.textures.exists(key),
        icons: collectObjects(cs.root)
          .filter((child: any) => child.texture?.key === key)
          .map((child: any) => ({ alpha: child.alpha, visible: child.visible })),
      });
    }

    cs.activeSection = 'items';
    cs.activeItemTypeTab = 1;
    cs.activeItemFilterTab = 5;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const activeMoltMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-molt-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));

    cs.activeSection = 'items';
    cs.activeItemTypeTab = 1;
    cs.activeItemFilterTab = 6;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const activeBossMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-boss-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));

    return {
      totalItems: cs.allCodexItems ? cs.allCodexItems().length : 0,
      waymarks: cs.allWaymarks ? cs.allWaymarks().length : 0,
      supplies: cs.allSupplies ? cs.allSupplies().length : 0,
      itemMedallionLoaded: cs.textures.exists('ui-icon-codex-items-medallion'),
      itemMedallions,
      itemsAllMedallionLoaded: cs.textures.exists('ui-icon-codex-items-all-medallion'),
      itemsAllMedallions,
      activeItemsAllMedallions,
      supplyMedallionLoaded: cs.textures.exists('ui-icon-codex-supplies-medallion'),
      supplyMedallions,
      suppliesAllMedallionLoaded: cs.textures.exists('ui-icon-codex-supplies-all-medallion'),
      suppliesAllMedallions,
      combatMedallionLoaded: cs.textures.exists('ui-icon-codex-combat-medallion'),
      combatMedallions,
      activeCombatMedallions,
      routePlanMedallionLoaded: cs.textures.exists('ui-icon-codex-route-plan-medallion'),
      routePlanMedallions,
      activeRoutePlanMedallions,
      flexibleMedallionLoaded: cs.textures.exists('ui-icon-codex-flexible-medallion'),
      flexibleMedallions,
      activeFlexibleMedallions,
      defenseMedallionLoaded: cs.textures.exists('ui-icon-codex-defense-medallion'),
      defenseMedallions,
      activeDefenseMedallions,
      recoveryMedallionLoaded: cs.textures.exists('ui-icon-codex-recovery-medallion'),
      recoveryMedallions,
      activeRecoveryMedallions,
      momentumMedallionLoaded: cs.textures.exists('ui-icon-codex-momentum-medallion'),
      momentumMedallions,
      activeMomentumMedallions,
      pressureMedallionLoaded: cs.textures.exists('ui-icon-codex-pressure-medallion'),
      pressureMedallions,
      activePressureMedallions,
      waymarkMedallionLoaded: cs.textures.exists('ui-icon-codex-waymark-medallion'),
      waymarkMedallions,
      waymarkFamilyMedallions,
      moltMedallionLoaded: cs.textures.exists('ui-icon-codex-molt-medallion'),
      moltMedallions,
      activeMoltMedallions,
      bossMedallionLoaded: cs.textures.exists('ui-icon-codex-boss-medallion'),
      bossMedallions,
      activeBossMedallions,
      hasSubtitle: listTexts.some((t) => /89 items \(58 Waymarks \/ 31 Supplies\)/.test(t)),
      hasTab: listTexts.some((t) => /^Supplies\b/.test(t)),
      hasWaymarkTab: waymarkTexts.some((t) => /^Waymarks\b/.test(t)),
      hasSeedPacket: listTexts.some((t) => /Seed Packet/.test(t)),
      hasWaymarkItem: waymarkTexts.some((t) => /Crowbar Debt|Chalk Wingmark|Rooftop Shortcut/.test(t)),
      hasBottlecap: listTexts.some((t) => /Bottlecap Popper/.test(t)),
      hasBottlecapArt: cs.textures.exists('supply-thumb-bottlecap_popper'),
      hasDetailFullArt: cs.textures.exists('supply-seed_packet') && detailUsesFullArt,
      hasDetailUse: detailTexts.some((t) => /USE/.test(t)),
      hasDetailEffects: detailTexts.some((t) => /Heal 6 Cohesion/i.test(t)),
      hasDetailTitle: detailTexts.some((t) => /Seed Packet/.test(t)),
    };
  });
  expect(r.totalItems).toBe(89);
  expect(r.waymarks).toBe(58);
  expect(r.supplies).toBe(31);
  expect(r.hasSubtitle).toBe(false); // Item counts live in the tabs, without a duplicate subtitle.
  expect(r.hasTab).toBe(true);
  expect(r.hasWaymarkTab).toBe(true);
  expect(r.hasSeedPacket).toBe(true);
  expect(r.hasWaymarkItem).toBe(true);
  expect(r.hasBottlecap).toBe(true);
  expect(r.hasBottlecapArt).toBe(true);
  expect(r.hasDetailFullArt).toBe(true);
  expect(r.hasDetailUse).toBe(true);
  expect(r.hasDetailEffects).toBe(true);
  expect(r.hasDetailTitle).toBe(true);
  expect(r.itemMedallionLoaded).toBe(true);
  expect(r.itemMedallions).toEqual([]);
  expect(r.itemsAllMedallionLoaded).toBe(true);
  expect(r.itemsAllMedallions).toEqual([]);
  expect(r.activeItemsAllMedallions).toEqual([]);
  expect(r.supplyMedallionLoaded).toBe(true);
  expect(r.supplyMedallions).toEqual([]);
  expect(r.suppliesAllMedallionLoaded).toBe(true);
  expect(r.suppliesAllMedallions).toEqual([]);
  expect(r.combatMedallionLoaded).toBe(true);
  expect(r.combatMedallions).toEqual([]);
  expect(r.activeCombatMedallions).toEqual([]);
  expect(r.routePlanMedallionLoaded).toBe(true);
  expect(r.routePlanMedallions).toEqual([]);
  expect(r.activeRoutePlanMedallions).toEqual([]);
  expect(r.flexibleMedallionLoaded).toBe(true);
  expect(r.flexibleMedallions).toEqual([]);
  expect(r.activeFlexibleMedallions).toEqual([]);
  expect(r.defenseMedallionLoaded).toBe(true);
  expect(r.defenseMedallions).toEqual([]);
  expect(r.activeDefenseMedallions).toEqual([]);
  expect(r.recoveryMedallionLoaded).toBe(true);
  expect(r.recoveryMedallions).toEqual([]);
  expect(r.activeRecoveryMedallions).toEqual([]);
  expect(r.momentumMedallionLoaded).toBe(true);
  expect(r.momentumMedallions).toEqual([]);
  expect(r.activeMomentumMedallions).toEqual([]);
  expect(r.pressureMedallionLoaded).toBe(true);
  expect(r.pressureMedallions).toEqual([]);
  expect(r.activePressureMedallions).toEqual([]);
  expect(r.waymarkMedallionLoaded).toBe(true);
  expect(r.waymarkMedallions).toEqual([]);
  expect(r.waymarkFamilyMedallions.every((entry: { loaded: boolean }) => entry.loaded)).toBe(true);
  expect(r.waymarkFamilyMedallions.every((entry: { icons: Array<{ alpha: number; visible: boolean }> }) => (
    entry.icons.length === 0
  ))).toBe(true);
  expect(r.moltMedallionLoaded).toBe(true);
  expect(r.moltMedallions).toEqual([]);
  expect(r.activeMoltMedallions).toEqual([]);
  expect(r.bossMedallionLoaded).toBe(true);
  expect(r.bossMedallions).toEqual([]);
  expect(r.activeBossMedallions).toEqual([]);
});

test('codex: glossary lists core gameplay keywords', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const collectTexts = (scene: any) => {
      const all: any[] = [];
      const walk = (o: any) => {
        if (!o) return;
        if (o.type === 'Text') all.push(o);
        const children = o.list;
        if (Array.isArray(children)) children.forEach(walk);
      };
      scene.children.list.forEach(walk);
      return all.map((t) => t.text || '');
    };
    const collectObjects = (node: any): any[] => {
      const children = node?.list ?? [];
      return children.flatMap((child: any) => [child, ...collectObjects(child)]);
    };
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('CodexScene');
    g.scene.stop('MenuScene');
    const cs: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 20 && !cs.root; i += 1) await wait(50);
    for (let i = 0; i < 40 && !cs.codexData; i += 1) await wait(50);
    cs.activeSection = 'glossary';
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const texts = collectTexts(cs);
    const glossaryMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-glossary-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const state = JSON.parse(window.render_game_to_text!());
    cs.entryFocusIndex = cs.glossaryTerms.findIndex((term: any) => term.term === 'Molt');
    cs.ensureFocusedEntryVisible();
    cs.gridScroll = cs.gridScrollTarget;
    cs.renderAll();
    const moltTexts = collectTexts(cs);
    cs.entryFocusIndex = cs.glossaryTerms.findIndex((term: any) => term.term === 'Open Sky');
    cs.ensureFocusedEntryVisible();
    cs.gridScroll = cs.gridScrollTarget;
    cs.renderAll();
    const openSkyTexts = collectTexts(cs);
    cs.entryFocusIndex = cs.glossaryTerms.findIndex((term: any) => term.term === 'Overextension');
    cs.ensureFocusedEntryVisible();
    cs.gridScroll = cs.gridScrollTarget;
    cs.renderAll();
    const scrolledTexts = collectTexts(cs);
    return {
      section: state.section,
      stateTerms: state.glossaryTerms,
      glossaryMedallions,
      hasTab: texts.includes('Glossary'),
      hasSubtitle: texts.some((t) => /keywords/.test(t)),
      hasWingbeat: texts.some((t) => t === 'Wingbeat'),
      hasMolt: moltTexts.some((t) => t === 'Molt'),
      hasOpenSky: openSkyTexts.some((t) => t === 'Open Sky'),
      hasOverextensionSummary: scrolledTexts.some((t) => /Playing too many cards/.test(t)),
    };
  });
  expect(r.section).toBe('glossary');
  expect(r.stateTerms.length).toBeGreaterThanOrEqual(20);
  expect(r.stateTerms).toEqual(expect.arrayContaining(['Wingbeat', 'Molt', 'Open Sky', 'Waymark']));
  expect(r.hasTab).toBe(true);
  expect(r.hasSubtitle).toBe(true);
  expect(r.hasWingbeat).toBe(true);
  expect(r.hasMolt).toBe(true);
  expect(r.hasOpenSky).toBe(true);
  expect(r.hasOverextensionSummary).toBe(true);
  expect(r.glossaryMedallions).toEqual([]);
});

test('codex: leaders tab renders roster with text-led navigation', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const collectTexts = (scene: any) => {
      const all: any[] = [];
      const walk = (o: any) => {
        if (!o) return;
        if (o.type === 'Text') all.push(o);
        const children = o.list;
        if (Array.isArray(children)) children.forEach(walk);
      };
      scene.children.list.forEach(walk);
      return all.map((t) => t.text || '');
    };
    const collectObjects = (node: any): any[] => {
      const children = node?.list ?? [];
      return children.flatMap((child: any) => [child, ...collectObjects(child)]);
    };
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('CodexScene');
    g.scene.stop('MenuScene');
    const cs: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 20 && !cs.root; i += 1) await wait(50);
    cs.activeSection = 'leaders';
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.gridScrollTarget = 0;
    cs.renderAll();
    const texts = collectTexts(cs);
    const leaderMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-leader-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const state = JSON.parse(window.render_game_to_text!());
    return {
      section: state.section,
      leaderCount: state.leaderCount,
      leaderMedallions,
      hasTab: texts.includes('Leaders'),
      hasSubtitle: texts.some((t) => /Flock Leaders rallied/.test(t)),
      hasFledgling: texts.some((t) => /Fledgling Flock/.test(t)),
      hasSparkCaller: texts.some((t) => /Spark-Caller/.test(t)),
      hasRoostkeeper: texts.some((t) => /Roostkeeper/.test(t)),
    };
  });
  expect(r.section).toBe('leaders');
  expect(r.leaderCount).toBe(5);
  expect(r.hasTab).toBe(true);
  expect(r.hasSubtitle).toBe(true);
  expect(r.hasFledgling).toBe(true);
  expect(r.hasSparkCaller).toBe(true);
  expect(r.hasRoostkeeper).toBe(true);
  expect(r.leaderMedallions).toEqual([]);
});

test('codex: all dossiers keep quiet surfaces without redundant art frames', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const collectObjects = (node: any): any[] => {
      const children = node?.list ?? [];
      return children.flatMap((child: any) => [child, ...collectObjects(child)]);
    };
    const g = window.__birdSquadGame;
    const acct = JSON.parse(window.localStorage.getItem('birdsquad.account') || '{}');
    acct.discoveredCards = Array.from(new Set([...(acct.discoveredCards ?? []), 'tangled_line']));
    window.localStorage.setItem('birdsquad.account', JSON.stringify(acct));

    await window.__birdSquadStartScene!('CodexScene');
    g.scene.stop('MenuScene');
    const cs: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 20 && !cs.root; i += 1) await wait(50);
    for (let i = 0; i < 40 && !cs.textures.exists('ui-icon-codex-dossier-frame'); i += 1) await wait(50);

    const openDetail = async (label: string, section: string, id: string, configure?: () => void) => {
      cs.activeSection = section;
      cs.detailId = id;
      cs.detailScroll = 0;
      cs.detailScrollTarget = 0;
      configure?.();
      cs.renderAll();
      const frames = collectObjects(cs.root)
        .filter((child: any) => child.texture?.key === 'ui-icon-codex-dossier-frame')
        .map((child: any) => ({ alpha: child.alpha, visible: child.visible, name: child.name }));
      const state = JSON.parse(window.render_game_to_text!());
      return { label, id, frames, telemetry: state.codexDossierFrame, detailOpen: state.detailOpen };
    };

    const waymark = cs.allWaymarks().find((entry: any) => entry.id === 'crowbar_debt') ?? cs.allWaymarks()[0];
    const enemy = cs.allCodexEnemies().find((entry: any) => entry.id === 'roof_rat') ?? cs.allCodexEnemies()[0];
    const results = [
      await openDetail('card', 'cards', 'tangled_line', () => {
        cs.activeTab = cs.tabs.findIndex((tab: { label: string }) => tab.label === 'Snags');
      }),
      await openDetail('supply', 'items', 'seed_packet', () => { cs.activeItemTypeTab = 2; }),
      await openDetail('waymark', 'items', waymark.id, () => { cs.activeItemTypeTab = 1; }),
      await openDetail('leader', 'leaders', 'fledgling'),
      await openDetail('enemy', 'enemies', enemy.id, () => { cs.activeEnemyTab = 0; }),
    ];
    return {
      loaded: cs.textures.exists('ui-icon-codex-dossier-frame'),
      results,
    };
  });

  expect(r.loaded).toBe(true);
  for (const result of r.results as Array<{
    label: string;
    id: string;
    detailOpen: string;
    frames: Array<{ alpha: number; visible: boolean; name: string }>;
    telemetry: { loaded: boolean; rendered: boolean; count: number };
  }>) {
    expect(result.detailOpen).toBe(result.id);
    expect(result.frames).toEqual([]);
    expect(result.telemetry).toMatchObject({ loaded: true, rendered: false, count: 0 });
  }
});

test('codex: collection tiles omit redundant decorative entry frames', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const collectObjects = (node: any): any[] => {
      const children = node?.list ?? [];
      return children.flatMap((child: any) => [child, ...collectObjects(child)]);
    };
    const g = window.__birdSquadGame;
    const acct = JSON.parse(window.localStorage.getItem('birdsquad.account') || '{}');
    acct.discoveredCards = Array.from(new Set([...(acct.discoveredCards ?? []), 'wingbeat_dash', 'tangled_line']));
    window.localStorage.setItem('birdsquad.account', JSON.stringify(acct));

    await window.__birdSquadStartScene!('CodexScene');
    g.scene.stop('MenuScene');
    const cs: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 20 && !cs.root; i += 1) await wait(50);
    for (let i = 0; i < 40 && !cs.textures.exists('ui-icon-codex-entry-frame'); i += 1) await wait(50);

    const renderMode = async (label: string, configure: () => void) => {
      configure();
      cs.detailId = undefined;
      cs.gridScroll = 0;
      cs.gridScrollTarget = 0;
      cs.renderAll();
      const frames = collectObjects(cs.root)
        .filter((child: any) => child.texture?.key === 'ui-icon-codex-entry-frame')
        .map((child: any) => ({
          alpha: child.alpha,
          visible: child.visible,
          name: child.name,
          width: child.displayWidth,
          height: child.displayHeight,
        }));
      const state = JSON.parse(window.render_game_to_text!());
      return { label, section: state.section, frames, telemetry: state.codexEntryFrame };
    };

    const results = [
      await renderMode('cards', () => { cs.activeSection = 'cards'; cs.activeTab = 0; }),
      await renderMode('items', () => {
        cs.activeSection = 'items';
        cs.activeItemTypeTab = 2;
        cs.activeItemFilterTab = 0;
      }),
      await renderMode('leaders', () => { cs.activeSection = 'leaders'; }),
      await renderMode('glossary', () => { cs.activeSection = 'glossary'; }),
      await renderMode('enemies', () => { cs.activeSection = 'enemies'; cs.activeEnemyTab = 0; }),
    ];
    return {
      loaded: cs.textures.exists('ui-icon-codex-entry-frame'),
      results,
    };
  });

  expect(r.loaded).toBe(true);
  for (const result of r.results as Array<{
    label: string;
    section: string;
    frames: Array<{ alpha: number; visible: boolean; name: string; width: number; height: number }>;
    telemetry: { loaded: boolean; rendered: boolean; count: number };
  }>) {
    expect(result.frames, result.label).toEqual([]);
    expect(result.telemetry).toMatchObject({ loaded: true, rendered: false, count: 0 });
  }
});

test('enemy codex: entire cast retains art details and text-led district navigation', async ({ page }) => {
  test.setTimeout(60000);
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const collectTexts = (scene: any) => {
      const all: any[] = [];
      const walk = (o: any) => {
        if (!o) return;
        if (o.type === 'Text') all.push(o);
        const children = o.list;
        if (Array.isArray(children)) children.forEach(walk);
      };
      scene.children.list.forEach(walk);
      return all.map((t) => t.text || '');
    };
    const collectObjects = (node: any): any[] => {
      const children = node?.list ?? [];
      return children.flatMap((child: any) => [child, ...collectObjects(child)]);
    };
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('CodexScene');
    g.scene.stop('MenuScene');
    const cs: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 20 && !cs.root; i += 1) await wait(50);
    cs.activeSection = 'enemies';
    cs.activeEnemyTab = 0;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.renderAll();
    for (let i = 0; i < 40 && !cs.codexData; i += 1) await wait(50);
    const enemyMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-enemy-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const districtLabels = ['All', 'Rooftops', 'Canals', 'Signals', 'Roost'];
    const districtTabs = [];
    for (let i = 0; i < districtLabels.length; i += 1) {
      const label = districtLabels[i];
      cs.activeEnemyTab = i;
      cs.detailId = undefined;
      cs.renderAll();
      districtTabs.push({
        label,
        active: collectObjects(cs.root).some((child: any) => child.name === 'codex-tab-surface'
          && child.getData('label') === label && child.getData('active')),
        interactive: collectObjects(cs.root).some((child: any) => child.name === 'codex-tab-hit'
          && child.getData('label') === label && child.input?.enabled),
        count: cs.currentCodexEnemies().length,
      });
    }
    cs.activeEnemyTab = 0;
    cs.detailId = undefined;
    cs.renderAll();
    for (
      let i = 0;
      i < 40 && (!cs.textures.exists('enemy-roof_rat') || !cs.textures.exists('reserve-enemy-mole_tunnelbreaker'));
      i += 1
    ) await wait(100);
    const listTexts = collectTexts(cs);

    cs.detailId = 'roof_rat';
    cs.detailScroll = 0;
    cs.renderAll();
    for (let i = 0; i < 40 && !cs.textures.exists('enemy-roof_rat'); i += 1) await wait(100);
    const runtimeTexts = collectTexts(cs);

    cs.detailId = 'mole_tunnelbreaker';
    cs.detailScroll = 0;
    cs.renderAll();
    for (let i = 0; i < 40 && !cs.textures.exists('reserve-enemy-mole_tunnelbreaker'); i += 1) await wait(100);
    const reserveTexts = collectTexts(cs);

    const count = cs.allCodexEnemies ? cs.allCodexEnemies().length : 0;
    const encounterCount = cs.allEncounterEnemies ? cs.allEncounterEnemies().length : 0;
    const reserveCount = cs.allReserveEnemies ? cs.allReserveEnemies().length : 0;
    return {
      count,
      encounterCount,
      reserveCount,
      hasCatalogCount: listTexts.some((t) => /81 enemies \(64 playable \/ 17 reserve\)/.test(t)),
      hasRuntimeEnemyName: runtimeTexts.some((t) => /Roof Rat/.test(t)),
      hasCombatKit: runtimeTexts.some((t) => /COMBAT KIT/.test(t)),
      hasReserveEnemyName: reserveTexts.some((t) => /Mole Tunnelbreaker/.test(t)),
      hasMoveKit: reserveTexts.some((t) => /MOVE KIT/.test(t)),
      hasFashion: reserveTexts.some((t) => /FASHION DIRECTION/.test(t)),
      hasRuntimeArt: cs.textures.exists('enemy-roof_rat'),
      hasReserveArt: cs.textures.exists('reserve-enemy-mole_tunnelbreaker'),
      enemyMedallions,
      districtTabs,
    };
  });
  expect(r.count).toBe(81);
  expect(r.encounterCount).toBe(64);
  expect(r.reserveCount).toBe(17);
  expect(r.hasCatalogCount).toBe(true);
  expect(r.hasRuntimeEnemyName).toBe(true);
  expect(r.hasCombatKit).toBe(true);
  expect(r.hasReserveEnemyName).toBe(true);
  expect(r.hasMoveKit).toBe(true);
  expect(r.hasFashion).toBe(true);
  expect(r.hasRuntimeArt).toBe(true);
  expect(r.hasReserveArt).toBe(true);
  expect(r.enemyMedallions).toEqual([]);
  expect(r.districtTabs.map((entry: { label: string }) => entry.label)).toEqual(['All', 'Rooftops', 'Canals', 'Signals', 'Roost']);
  expect(r.districtTabs.every((entry: { active: boolean; interactive: boolean; count: number }) =>
    entry.active && entry.interactive && entry.count > 0)).toBe(true);
});

for (const mapIndex of [0, 1]) test(`new card shortcut opens the exact dossier and returns to the active run across pointer keyboard and controller (district ${mapIndex + 1})`, async ({ page }) => {
  test.setTimeout(120_000);
  const newestId = 'wands_02';
  const olderId = 'cups_02';
  await page.addInitScript(({ newest, older }) => {
    const account = {
      discoveredCards: [newest, older, 'major_00'],
      favoriteCards: [],
      cardCollection: {
        [newest]: {
          timesClaimed: 1,
          firstAcquiredAt: Date.UTC(2026, 6, 28, 12),
          firstSource: 'combat_reward',
          isNew: true,
        },
        [older]: {
          timesClaimed: 1,
          firstAcquiredAt: Date.UTC(2026, 6, 27, 12),
          firstSource: 'route_reward',
          isNew: true,
        },
        major_00: {
          timesClaimed: 1,
          firstAcquiredAt: Date.UTC(2026, 5, 1, 12),
          firstSource: 'starter_flock',
        },
      },
    };
    const raw = JSON.stringify(account);
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('birdsquad.screenReader', 'on');
  }, { newest: newestId, older: olderId });
  await boot(page);
  const runState = {
    deck: [{ id: 'major_00' }, { id: newestId }, { id: olderId }],
    leaderId: 'fledgling',
    difficulty: 0,
    seed: 'new-card-direct-dossier',
    currentHp: 31,
    scrap: 73,
    routeMarks: [],
    supplies: [],
    supplySlots: 2,
    mapIndex,
    districtContracts: [{ mapIndex, id: 'bright_signal', baselineCombatResults: 0, baselineRewardEvents: 0, baselineSnags: 0, confirmed: true }],
    completedRouteNodeIds: [],
    currentRouteNodeId: undefined,
    routeLog: [],
    nextCombat: undefined,
    signalChoices: [],
    rewardEvents: [],
    suppliesUsed: [],
    combatResults: [],
    freePreenNextDistrict: 0,
  };
  const strip = await page.evaluate(async (state) => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const route: any = await window.__birdSquadStartScene!('RouteScene', { runState: state });
    window.__birdSquadGame.scene.stop('MenuScene');
    for (let index = 0; index < 80; index += 1) {
      const hit = route.children.getByName('route-collection-goal-hit');
      if (hit?.getData('newCardId')) break;
      await wait(50);
    }
    const hit = route.children.getByName('route-collection-goal-hit');
    const label = route.children.getByName('route-collection-goal-hit-label');
    return {
      x: hit.x,
      y: hit.y,
      width: hit.displayWidth,
      height: hit.displayHeight,
      newCardId: hit.getData('newCardId'),
      destination: hit.getData('destination'),
      label: label?.text,
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
    };
  }, runState);
  expect(strip).toMatchObject({
    newCardId: newestId,
    destination: 'Newest card dossier',
    width: 300,
    x: mapIndex === 0 ? 870 : 620,
    y: mapIndex === 0 ? 111 : 656,
  });
  expect(strip.height).toBeGreaterThanOrEqual(44);
  expect(strip.label).toBe('View new card');
  expect(strip.state.collectionGoal).toMatchObject({
    newCardId: newestId,
    destination: 'Newest card dossier',
    rendered: true,
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''), {
    timeout: 5_000,
  }).toContain('newly claimed card is ready for review');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/new-card-direct-route-strip.png' });

  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.click(
    canvas.x + canvas.width * (strip.x / 1280),
    canvas.y + canvas.height * (strip.y / 720),
  );
  await page.waitForFunction((id) => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === id, newestId);
  let directState = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(directState).toMatchObject({
    mode: 'codex',
    section: 'cards',
    detailOpen: newestId,
    origin: { scene: 'RouteScene', preservesActiveRun: true },
  });
  expect(directState.cardCollectionLens).toMatchObject({ id: 'all' });
  expect(directState.newlyAcquiredCards).toMatchObject({
    count: 2,
    detailId: newestId,
    detailNew: true,
    persisted: true,
  });
  expect(directState.activeFlightCards).toMatchObject({
    active: true,
    deckSize: 3,
    detail: {
      id: newestId,
      inDeck: true,
      playableQuantity: 1,
      state: 'base',
      canOpenDeckReview: true,
    },
    deckReviewHandoff: {
      pointer: true,
      keyboard: 'D',
      controller: 'RB',
      requiresRouteOrigin: true,
      exactCardSelection: true,
      preservesRun: true,
      editsDeck: false,
      savesFolio: false,
    },
  });
  expect(await page.evaluate((id) => (
    JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').cardCollection[id].isNew
  ), newestId)).toBe(true);
  const handoffPoint = await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    const hit = codex.root.getByName('codex-card-flight-deck-hit');
    return {
      x: hit.x,
      y: hit.y,
      width: hit.displayWidth,
      height: hit.displayHeight,
      cardId: hit.getData('cardId'),
      state: hit.getData('state'),
    };
  });
  expect(handoffPoint).toMatchObject({
    cardId: newestId,
    state: 'base',
    width: 264,
    height: 58,
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? ''))
    .toContain('Use D, controller right shoulder, or View in Flight Deck');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/new-card-direct-dossier.png' });

  await page.keyboard.press('n');
  await page.waitForFunction((id) => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.detailOpen === id && state.newlyAcquiredCards?.detailNew === false;
  }, newestId);
  directState = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(directState.newlyAcquiredCards).toMatchObject({ count: 1, detailNew: false });
  await page.mouse.click(
    canvas.x + canvas.width * (handoffPoint.x / 1280),
    canvas.y + canvas.height * (handoffPoint.y / 720),
  );
  await page.waitForFunction((id) => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.scene === 'RouteScene'
      && state.deckReview?.open === true
      && state.deckReview?.selectedCardId === id
      && state.deckReview?.browserRenderer?.loaded === true;
  }, newestId);
  let deckHandoff = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(deckHandoff.run).toMatchObject({ currentHp: 31, scrap: 73, deckSize: 3 });
  expect(deckHandoff.deckReview).toMatchObject({
    open: true,
    total: 3,
    selectedCardId: newestId,
    filter: 'all',
    sort: 'run',
    query: '',
    searchActive: false,
  });
  expect(deckHandoff.deckReview.cards.find((card: any) => card.id === newestId))
    .toMatchObject({ id: newestId, upgraded: false });
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/new-card-flight-deck-handoff.png' });
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.scene === 'RouteScene'
      && state.deckReview?.open === false
      && state.collectionGoal?.newCardId === id;
  }, olderId);
  let returned = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(returned.run).toMatchObject({ currentHp: 31, scrap: 73, deckSize: 3 });
  expect(returned.collectionGoal).toMatchObject({ newCardId: olderId, destination: 'Newest card dossier' });

  await page.keyboard.press('g');
  await page.waitForFunction((id) => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === id, olderId);
  directState = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(directState.newlyAcquiredCards).toMatchObject({ count: 1, detailId: olderId, detailNew: true });
  await page.keyboard.press('d');
  await page.waitForFunction((id) => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.scene === 'RouteScene'
      && state.deckReview?.open === true
      && state.deckReview?.selectedCardId === id;
  }, olderId);
  deckHandoff = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(deckHandoff.run).toMatchObject({ currentHp: 31, scrap: 73, deckSize: 3 });
  expect(deckHandoff.deckReview).toMatchObject({ selectedCardId: olderId, total: 3 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.scene === 'RouteScene' && state.deckReview?.open === false;
  });

  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.input.gamepad.emit('down', route.input.gamepad.pad1, { index: 11 }, 1);
  });
  await page.waitForFunction((id) => JSON.parse(window.render_game_to_text?.() ?? '{}').detailOpen === id, olderId);
  directState = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(directState).toMatchObject({
    detailOpen: olderId,
    origin: { scene: 'RouteScene', preservesActiveRun: true },
  });
  await page.evaluate(() => {
    const codex: any = window.__birdSquadGame.scene.getScene('CodexScene');
    codex.input.gamepad.emit('down', codex.input.gamepad.pad1, { index: 5 }, 1);
  });
  await page.waitForFunction((id) => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.scene === 'RouteScene'
      && state.deckReview?.open === true
      && state.deckReview?.selectedCardId === id;
  }, olderId);
  returned = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(returned.run).toMatchObject({ currentHp: 31, scrap: 73, deckSize: 3 });
  expect(returned.deckReview).toMatchObject({ selectedCardId: olderId, total: 3 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').deckReview?.open === false);
  expect(await page.evaluate((ids) => {
    const account = JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}');
    return ids.map((id) => account.cardCollection[id].isNew === true);
  }, [newestId, olderId])).toEqual([false, true]);
});
