import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { settleCanvas } from './helpers/settled-canvas';
import { boot, clickNamedGameObject } from './helpers/smoke';

// Split from the former tests/smoke.spec.ts (route topics). Tests drive
// scenes through the deterministic text-state harness on window.

test('route readiness gate hides fallback nodes and blocks commitment', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const scene: any = await window.__birdSquadStartScene!('RouteScene', {});
    scene.routeEssentialAssetsReady = false;
    scene.renderAll();
    const beforeNode = scene.runState.currentRouteNodeId;
    scene.input.keyboard.emit('keydown-ENTER');
    const texts = scene.children.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
    return {
      beforeNode,
      afterNode: scene.runState.currentRouteNodeId,
      routeCommitPending: scene.routeCommitPending,
      texts,
      state: JSON.parse(window.render_game_to_text?.() ?? '{}')
    };
  });
  expect(result.afterNode).toBe(result.beforeNode);
  expect(result.routeCommitPending).toBe(false);
  expect(result.texts).toContain('Charting the route...');
  expect(result.texts.some((text: string) => ['S', 'C', 'N', 'R', 'B', '?', '$', '~'].includes(text))).toBe(false);
  expect(result.state.routeAssetsReady).toBe(false);
});

test('route becomes playable while optional painted node art streams', async ({ page }) => {
  test.setTimeout(30_000);
  await page.route('**/street-*.webp*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.continue();
  });
  await boot(page);

  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const scene: any = await window.__birdSquadStartScene!('RouteScene', {});
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      if (state.assetReadiness?.interactive) break;
      await wait(25);
    }
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const texts = scene.children.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
    return {
      state,
      texts,
      enabledRouteTargets: scene.children.list.filter((child: any) => (
        child.input?.enabled && child.input?.cursor === 'pointer'
      )).length,
    };
  });

  expect(result.state.routeAssetsReady).toBe(true);
  expect(result.state.assetReadiness).toMatchObject({
    phase: 'interactive',
    interactive: true,
    fullArt: false,
  });
  expect(result.state.assetReadiness.pendingGroups).toContain('route-essential-art');
  expect(result.state.assetReadiness.timeToFirstInteractionMs).toBeLessThan(3_000);
  expect(result.texts).not.toContain('Charting the route...');
  expect(result.texts.some((text: string) => ['S', 'C', 'N', 'R', 'B', '?', '$', '~'].includes(text))).toBe(false);
  expect(result.enabledRouteTargets).toBeGreaterThan(0);
});

test('route and battle report separate interaction and full-art readiness milestones', async ({ page }) => {
  test.setTimeout(45_000);
  await boot(page);

  const routeState = await page.evaluate(async () => {
    await window.__birdSquadStartScene!('RouteScene', {});
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      if (state.assetReadiness?.interactive && state.assetReadiness?.fullArt) return state;
      await wait(50);
    }
    return JSON.parse(window.render_game_to_text?.() ?? '{}');
  });
  expect(routeState.routeAssetsReady).toBe(true);
  expect(routeState.assetReadiness).toMatchObject({
    phase: 'full-art',
    interactive: true,
    fullArt: true,
    pendingGroups: [],
    failedGroups: [],
    timedOutGroups: [],
  });
  expect(routeState.assetReadiness.timeToFirstInteractionMs).toEqual(expect.any(Number));
  expect(routeState.assetReadiness.timeToFullArtMs).toEqual(expect.any(Number));

  const battleResult = await page.evaluate(async () => {
    const game = window.__birdSquadGame;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    game.scene.stop('RouteScene');
    await wait(0);
    game.scene.start('BattleScene', {});
    let sawTransition = false;
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      if (state.scene === 'BattleScene' && state.assetReadiness?.fullArt && !state.assetReadiness?.interactive) {
        sawTransition = sawTransition || state.assetReadiness.phase === 'transition';
      }
      if (state.scene === 'BattleScene' && state.assetReadiness?.interactive && state.assetReadiness?.fullArt) {
        return { state, sawTransition };
      }
      await wait(50);
    }
    return { state: JSON.parse(window.render_game_to_text?.() ?? '{}'), sawTransition };
  });
  const battleState = battleResult.state;
  // Optional painted art may finish after the readable intro. Interaction and
  // full-art timestamps remain independent; do not require a sampled overlap.
  expect(battleState.assetReadiness.timeToFirstInteractionMs).toBeGreaterThanOrEqual(0);
  expect(battleState.combatAnimationPending).toBe(false);
  expect(battleState.assetReadiness).toMatchObject({
    phase: 'full-art',
    interactive: true,
    fullArt: true,
    pendingGroups: [],
    failedGroups: [],
    timedOutGroups: [],
  });
  expect(battleState.assetReadiness.timeToFirstInteractionMs).toEqual(expect.any(Number));
  expect(battleState.assetReadiness.timeToFullArtMs).toEqual(expect.any(Number));
});

test('route readiness timeout releases a playable fallback and reports the failed group', async ({ page }) => {
  test.setTimeout(25_000);
  await page.route('**/route-map-frame*.webp*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 9_000));
    await route.abort();
  });
  await boot(page);

  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const scene: any = await window.__birdSquadStartScene!('RouteScene', {});
    for (let attempt = 0; attempt < 220 && !scene.routeEssentialAssetsReady; attempt += 1) {
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const texts = scene.children.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
    return {
      state,
      texts,
      enabledRouteTargets: scene.children.list.filter((child: any) => (
        child.input?.enabled && child.input?.cursor === 'pointer'
      )).length,
    };
  });

  expect(result.state.routeAssetsReady).toBe(true);
  expect(result.state.assetReadiness.interactive).toBe(true);
  expect(result.state.assetReadiness.timedOutGroups).toEqual(expect.arrayContaining([
    'route-essential-ui',
    'route-full-ui',
  ]));
  expect(result.state.assetReadiness.failedGroups).toEqual(expect.arrayContaining([
    'route-essential-ui',
    'route-full-ui',
  ]));
  expect(result.state.assetReadiness.failures).toEqual(expect.arrayContaining([
    expect.objectContaining({
      group: 'route-essential-ui',
      keys: expect.arrayContaining(['ui-icon-route-map-frame']),
    }),
  ]));
  expect(result.texts).not.toContain('Charting the route...');
  expect(result.enabledRouteTargets).toBeGreaterThan(0);
});

test('route commit accepts pointer input across its full visible label and medallion', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    await window.__birdSquadStartScene!('RouteScene', {});
  });

  const target = await page.evaluate(() => {
    const route = window.__birdSquadGame.scene.getScene('RouteScene');
    const hit = route.children.list.find((child: any) => (
      child.name === 'route-commit-hit' && child.input?.enabled
    ));
    const label = route.children.list.find((child: any) => (
      child.name === 'route-commit-label' && child.type === 'Rectangle'
    ));
    if (!hit || !label) throw new Error('Missing route commit command');
    return {
      labelCenter: { x: label.x, y: label.y },
      hitBounds: {
        left: hit.x - hit.displayWidth / 2,
        right: hit.x + hit.displayWidth / 2,
        top: hit.y - hit.displayHeight / 2,
        bottom: hit.y + hit.displayHeight / 2,
      },
      labelBounds: {
        left: label.x - label.displayWidth / 2,
        right: label.x + label.displayWidth / 2,
        top: label.y - label.displayHeight / 2,
        bottom: label.y + label.displayHeight / 2,
      },
    };
  });

  expect(target.hitBounds.left).toBeLessThanOrEqual(target.labelBounds.left);
  expect(target.hitBounds.right).toBeGreaterThanOrEqual(target.labelBounds.right);
  expect(target.hitBounds.top).toBeLessThanOrEqual(target.labelBounds.top);
  expect(target.hitBounds.bottom).toBeGreaterThanOrEqual(target.labelBounds.bottom);

  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  // Enabled Phaser objects join hit testing on the next rendered frame.
  // Keep this click at the visible label center, after pointer movement settles.
  await page.mouse.move(
    canvas.x + canvas.width * (target.labelCenter.x / 1280),
    canvas.y + canvas.height * (target.labelCenter.y / 720),
  );
  await settleCanvas(page);
  await page.mouse.click(
    canvas.x + canvas.width * (target.labelCenter.x / 1280),
    canvas.y + canvas.height * (target.labelCenter.y / 720),
    { delay: 50 },
  );
  await expect.poll(async () => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.scene;
  })).toBe('BattleScene');
});

test('route map loads and previews the boss before the final node', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const collectObjects = (root: any): any[] => {
      const out: any[] = [];
      const visit = (node: any) => {
        if (!node) return;
        out.push(node);
        const children = node.list ?? node.children?.list;
        if (Array.isArray(children)) children.forEach(visit);
      };
      visit(root);
      return out;
    };
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route = g.scene.getScene('RouteScene');
    const bossNode = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.id === window.__birdSquadCurrentMap!().bossNodeId);
    route.selectRouteNode(window.__birdSquadCurrentMap!().bossNodeId);
    const expected = ['street', 'rival', 'boss', 'basin', 'nest', 'market', 'signal', 'cache']
      .map((type) => `route-node-${type}`);
    const expectedTextureKeys = [
      ...expected,
      'ui-icon-reward-card-badge', 'ui-icon-reward-waymark-badge', 'ui-icon-reward-preen-badge',
      'ui-icon-reward-heal-badge', 'ui-icon-reward-supply-badge', 'ui-icon-reward-scrap-badge', 'ui-icon-reward-spark-burst',
      'ui-icon-route-map-frame', 'ui-icon-route-node-tooltip-frame', 'ui-icon-route-risk-meter-frame',
      'ui-icon-route-commit-tooltip-frame', 'ui-icon-route-selected-node-ring', 'ui-icon-route-boss-beacon-ring',
      'ui-icon-boss-prep-dossier-flourish', 'ui-icon-boss-prep-readiness-chip-frame',
      'ui-icon-boss-prep-pressure-plaque', 'ui-icon-boss-prep-signal-module', 'ui-icon-boss-prep-route-for-plate'
    ];
    for (let i = 0; i < 160 && !expectedTextureKeys.every((key) => route.textures.exists(key)); i += 1) await wait(50);
    const cacheNode = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'cache');
    for (let i = 0; i < 120; i += 1) {
      const rendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-route-map-frame')
        && collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-route-selected-node-ring')
        && collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-route-boss-beacon-ring')
        && collectObjects(route.children).some((child: any) => child.name === 'route-district-banner' && child.type === 'Rectangle')
        && collectObjects(route.children).some((child: any) => child.texture?.key === 'route-node-street')
        && collectObjects(route.children).some((child: any) => child.texture?.key === 'route-node-boss');
      if (rendered) break;
      await wait(50);
    }
    let bossTooltip: any;
    let bossTooltipHeight = 0;
    if (bossNode) {
      const position = route.nodePosition(bossNode);
      bossTooltip = route.showNodeTooltip(bossNode, position.x, position.y - 40);
      bossTooltipHeight = collectObjects(bossTooltip).find((child: any) => child.name === 'route-node-tooltip-frame')?.displayHeight ?? 0;
    }
    if (cacheNode) {
      const position = route.nodePosition(cacheNode);
      route.showNodeTooltip(cacheNode, position.x, position.y - 40);
    }
    const imageKeys = route.children.list
      .map((child: any) => child.texture?.key)
      .filter((key: string | undefined) => key?.startsWith('route-node-'));
    const rewardBadgeKeys = collectObjects(route.children)
      .map((child: any) => child.texture?.key)
      .filter((key: string | undefined) => key?.startsWith('ui-icon-reward-'));
    const rewardCardBadgeRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-reward-card-badge');
    const rewardWaymarkBadgeRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-reward-waymark-badge');
    const rewardPreenBadgeRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-reward-preen-badge');
    const rewardHealBadgeRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-reward-heal-badge');
    const rewardSupplyBadgeRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-reward-supply-badge');
    const rewardScrapBadgeRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-reward-scrap-badge');
    const rewardSparkBurstRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-reward-spark-burst');
    const routeMapFrameRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-route-map-frame');
    const routeNodeTooltipFrameRendered = collectObjects(route.children).some((child: any) => child.name === 'route-node-tooltip-frame');
    const routeSelectedNodeRingRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-route-selected-node-ring');
    const routeBossBeaconRingRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-route-boss-beacon-ring');
    const routeDistrictBannerRendered = collectObjects(route.children).some((child: any) => child.name === 'route-district-banner' && child.type === 'Rectangle');
    const bossPrepDossierRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-boss-prep-dossier-flourish');
    const bossPrepReadinessChipFrameRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-boss-prep-readiness-chip-frame');
    const bossPrepPressurePlaqueRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-boss-prep-pressure-plaque');
    const bossPrepSignalModuleRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-boss-prep-signal-module');
    const bossPrepRouteForPlateRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-boss-prep-route-for-plate');
    const state = JSON.parse(window.render_game_to_text!());
    const routeNodeTooltipFrames = collectObjects(route.children)
      .filter((child: any) => child.name === 'route-node-tooltip-frame')
      .map((child: any) => ({
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        name: child.name,
        visible: child.visible,
      }));
    const routeRiskMeterFrames = collectObjects(route.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-route-risk-meter-frame')
      .map((child: any) => ({
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        name: child.name,
        visible: child.visible,
      }));
    const selectableNode = state.nodes.find((node: any) => node.selectable)?.id;
    if (selectableNode) {
      route.selectRouteNode(selectableNode);
      for (let i = 0; i < 40; i += 1) {
        const rendered = route.textures.exists('ui-icon-route-commit-medallion')
          && route.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-commit-medallion');
        if (rendered) break;
        await wait(50);
      }
      const confirm = route.routeLayout().confirm;
      route.showSimpleTooltip('Take this route', confirm.cx, confirm.cy - 60);
      // This is an immediate quiet Rectangle/Text tooltip. Waiting for its
      // retired image texture lets unrelated asset refreshes replace the scene.
    }
    const finalState = JSON.parse(window.render_game_to_text!());
    const routeMapFrames = collectObjects(route.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-route-map-frame')
      .map((child: any) => ({
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        name: child.name,
        visible: child.visible,
      }));
    const routeSelectedNodeRings = collectObjects(route.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-route-selected-node-ring')
      .map((child: any) => ({
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        name: child.name,
        visible: child.visible,
      }));
    const routeCommitTooltipFrames = collectObjects(route.children)
      .filter((child: any) => child.name === 'route-commit-tooltip-frame' && child.type === 'Rectangle')
      .map((child: any) => ({
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        name: child.name,
        visible: child.visible,
      }));
    const commitLabel = collectObjects(route.children).find((child: any) => child.text === 'Take this route');
    const commitFrame = collectObjects(route.children).find((child: any) => child.name === 'route-commit-tooltip-frame');
    const labelBounds = commitLabel?.getBounds(), frameBounds = commitFrame?.getBounds();
    const routeNodeIcons = collectObjects(route.children)
      .filter((child: any) => child.name === 'route-node-icon')
      .map((child: any) => ({
        id: child.getData('routeNodeId'),
        state: child.getData('routeNodeState'),
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        visible: child.visible,
      }));
    return {
      active: g.scene.getScenes(true).map((s: any) => s.scene.key).includes('RouteScene'),
      texturesLoaded: expected.every((key) => route.textures.exists(key)),
      imageKeys: [...new Set(imageKeys)],
      rewardBadgeKeys: [...new Set(rewardBadgeKeys)],
      routeCommitIconLoaded: route.textures.exists('ui-icon-route-commit-medallion'),
      routeCommitIconRendered: route.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-commit-medallion'),
      routeCommitTooltipFrameLoaded: route.textures.exists('ui-icon-route-commit-tooltip-frame'),
      routeCommitTooltipFrameRendered: routeCommitTooltipFrames.length > 0,
      commitTooltipText: commitLabel?.text,
      commitTooltipFont: commitLabel?.style.fontSize,
      commitTooltipContained: Boolean(labelBounds && frameBounds && labelBounds.left >= frameBounds.left
        && labelBounds.right <= frameBounds.right && labelBounds.top >= frameBounds.top && labelBounds.bottom <= frameBounds.bottom),
      routeCommitTooltipFrame: finalState.routeCommitTooltipFrame,
      routeCommitTooltipFrames,
      rewardCardBadgeLoaded: route.textures.exists('ui-icon-reward-card-badge'),
      rewardCardBadgeRendered,
      rewardWaymarkBadgeLoaded: route.textures.exists('ui-icon-reward-waymark-badge'),
      rewardWaymarkBadgeRendered,
      rewardPreenBadgeLoaded: route.textures.exists('ui-icon-reward-preen-badge'),
      rewardPreenBadgeRendered,
      rewardHealBadgeLoaded: route.textures.exists('ui-icon-reward-heal-badge'),
      rewardHealBadgeRendered,
      rewardSupplyBadgeLoaded: route.textures.exists('ui-icon-reward-supply-badge'),
      rewardSupplyBadgeRendered,
      rewardScrapBadgeLoaded: route.textures.exists('ui-icon-reward-scrap-badge'),
      rewardScrapBadgeRendered,
      rewardSparkBurstLoaded: route.textures.exists('ui-icon-reward-spark-burst'),
      rewardSparkBurstRendered,
      routeMapFrameLoaded: route.textures.exists('ui-icon-route-map-frame'),
      routeMapFrameRendered,
      routeMapFrame: finalState.routeMapFrame,
      routeMapFrames,
      routeNodeTooltipFrameLoaded: route.textures.exists('ui-icon-route-node-tooltip-frame'),
      routeNodeTooltipFrameRendered,
      routeNodeTooltipFrame: state.routeNodeTooltipFrame,
      routeNodeTooltipFrames,
      bossTooltipHeight,
      bossTooltipRetired: bossTooltip?.active === false,
      routeRiskMeterFrameLoaded: route.textures.exists('ui-icon-route-risk-meter-frame'),
      routeRiskMeterFrameRendered: routeRiskMeterFrames.length > 0,
      routeRiskMeterFrame: state.routeRiskMeterFrame,
      routeRiskMeterFrames,
      routeSelectedNodeRingLoaded: route.textures.exists('ui-icon-route-selected-node-ring'),
      routeSelectedNodeRingRendered,
      routeSelectedNodeRing: finalState.routeSelectedNodeRing,
      routeSelectedNodeRings,
      routeBossBeaconRingLoaded: route.textures.exists('ui-icon-route-boss-beacon-ring'),
      routeBossBeaconRingRendered,
      routeBossBeaconRing: finalState.routeBossBeaconRing,
      routeDistrictBannerLoaded: route.textures.exists('ui-icon-route-district-banner'),
      routeDistrictBannerRendered,
      bossPrepDossierLoaded: route.textures.exists('ui-icon-boss-prep-dossier-flourish'),
      bossPrepDossierRendered,
      bossPrepReadinessChipFrameLoaded: route.textures.exists('ui-icon-boss-prep-readiness-chip-frame'),
      bossPrepReadinessChipFrameRendered,
      bossPrepPressurePlaqueLoaded: route.textures.exists('ui-icon-boss-prep-pressure-plaque'),
      bossPrepPressurePlaqueRendered,
      bossPrepSignalModuleLoaded: route.textures.exists('ui-icon-boss-prep-signal-module'),
      bossPrepSignalModuleRendered,
      bossPrepRouteForPlateLoaded: route.textures.exists('ui-icon-boss-prep-route-for-plate'),
      bossPrepRouteForPlateRendered,
      districtBanner: state.districtBanner,
      bossPrepDossier: state.bossPrepDossier,
      bossPrepReadinessChipFrame: state.bossPrepReadinessChipFrame,
      bossPrepPressurePlaque: state.bossPrepPressurePlaque,
      bossPrepSignalModule: state.bossPrepSignalModule,
      bossPrepRouteForPlate: state.bossPrepRouteForPlate,
      hasRewardBadges: state.nodes.some((node: any) => (node.rewardBadges ?? []).length > 0),
      bossRewardBadges: state.nodes.find((node: any) => node.id === state.map.bossNodeId)?.rewardBadges ?? [],
      cacheRewardBadges: state.nodes.find((node: any) => node.type === 'cache')?.rewardBadges ?? [],
      routeNodeCount: finalState.nodes.length,
      routeNodeIcons,
      selectedBackplates: route.children.list.filter((child: any) => child.name === 'route-node-selected-backplate').length,
      selectableBackplates: route.children.list.filter((child: any) => child.name === 'route-node-selectable-backplate').length,
      selectedLabels: route.children.list.filter((child: any) => child.name === 'route-node-selected-label').length,
    };
  });
  expect(result.active).toBe(true);
  expect(result.texturesLoaded).toBe(true);
  expect(result.imageKeys).toContain('route-node-street');
  expect(result.imageKeys).toContain('route-node-boss');
  expect(result.routeCommitIconLoaded).toBe(true);
  expect(result.routeCommitIconRendered).toBe(true);
  expect(result.routeCommitTooltipFrameLoaded).toBe(true);
  expect(result.routeCommitTooltipFrameRendered).toBe(true);
  expect(result.routeCommitTooltipFrame.loaded).toBe(true);
  expect(result.routeCommitTooltipFrame.rendered).toBe(false);
  expect(result.routeCommitTooltipFrame.count).toBe(0);
  expect(result.routeCommitTooltipFrames).toHaveLength(1);
  expect(result.routeCommitTooltipFrames[0]).toMatchObject({
    name: 'route-commit-tooltip-frame',
    visible: true,
  });
  expect(result.routeCommitTooltipFrames[0].displayHeight).toBeGreaterThanOrEqual(40);
  expect(result.commitTooltipText).toBe('Take this route');
  expect(result.commitTooltipFont).toBe('19px');
  expect(result.commitTooltipContained).toBe(true);
  expect(result.routeCommitTooltipFrames[0].displayWidth).toBeGreaterThanOrEqual(146);
  expect(result.routeCommitTooltipFrames[0].alpha).toBeGreaterThan(0.9);
  expect(result.routeDistrictBannerLoaded).toBe(true);
  expect(result.routeDistrictBannerRendered).toBe(true);
  expect(result.districtBanner.loaded).toBe(true);
  expect(result.bossPrepDossierLoaded).toBe(true);
  expect(result.bossPrepDossierRendered).toBe(false);
  expect(result.bossPrepDossier.loaded).toBe(true);
  expect(result.bossPrepDossier.rendered).toBe(false);
  expect(result.bossPrepReadinessChipFrameLoaded).toBe(true);
  expect(result.bossPrepReadinessChipFrameRendered).toBe(false);
  expect(result.bossPrepReadinessChipFrame.loaded).toBe(true);
  expect(result.bossPrepReadinessChipFrame.rendered).toBe(false);
  expect(result.bossPrepReadinessChipFrame.count).toBe(0);
  expect(result.bossPrepPressurePlaqueLoaded).toBe(true);
  expect(result.bossPrepPressurePlaqueRendered).toBe(false);
  expect(result.bossPrepPressurePlaque.loaded).toBe(true);
  expect(result.bossPrepPressurePlaque.rendered).toBe(false);
  expect(result.bossPrepPressurePlaque.count).toBe(0);
  expect(result.bossPrepSignalModuleLoaded).toBe(true);
  expect(result.bossPrepSignalModuleRendered).toBe(false);
  expect(result.bossPrepSignalModule.loaded).toBe(true);
  expect(result.bossPrepSignalModule.rendered).toBe(false);
  expect(result.bossPrepSignalModule.count).toBe(0);
  expect(result.bossPrepRouteForPlateLoaded).toBe(true);
  expect(result.bossPrepRouteForPlateRendered).toBe(false);
  expect(result.bossPrepRouteForPlate.loaded).toBe(true);
  expect(result.bossPrepRouteForPlate.rendered).toBe(false);
  expect(result.bossPrepRouteForPlate.count).toBe(0);
  expect(result.districtBanner.district).toBe(1);
  expect(result.districtBanner.districtCount).toBeGreaterThanOrEqual(4);
  expect(result.districtBanner.mapName).toBe('Rooftop Blocks');
  expect(result.rewardCardBadgeLoaded).toBe(true);
  expect(result.rewardCardBadgeRendered).toBe(false);
  expect(result.rewardWaymarkBadgeLoaded).toBe(true);
  expect(result.rewardWaymarkBadgeRendered).toBe(false);
  expect(result.rewardPreenBadgeLoaded).toBe(true);
  expect(result.rewardPreenBadgeRendered).toBe(false);
  expect(result.rewardHealBadgeLoaded).toBe(true);
  expect(result.rewardHealBadgeRendered).toBe(false);
  expect(result.rewardSupplyBadgeLoaded).toBe(true);
  expect(result.rewardSupplyBadgeRendered).toBe(false);
  expect(result.rewardScrapBadgeLoaded).toBe(true);
  expect(result.rewardScrapBadgeRendered).toBe(false);
  expect(result.rewardSparkBurstLoaded).toBe(true);
  expect(result.rewardSparkBurstRendered).toBe(false);
  expect(result.routeMapFrameLoaded).toBe(true);
  expect(result.routeMapFrameRendered).toBe(true);
  expect(result.routeMapFrame.loaded).toBe(true);
  expect(result.routeMapFrame.rendered).toBe(true);
  expect(result.routeMapFrame.count).toBe(1);
  expect(result.routeMapFrames).toHaveLength(1);
  expect(result.routeMapFrames[0]).toMatchObject({
    name: 'route-map-frame',
    visible: true,
  });
  expect(result.routeMapFrames[0].displayWidth).toBe(1208);
  expect(result.routeMapFrames[0].displayHeight).toBe(590);
  expect(result.routeMapFrames[0].alpha).toBe(0.14);
  expect(result.routeNodeTooltipFrameLoaded).toBe(true);
  expect(result.routeNodeTooltipFrameRendered).toBe(true);
  expect(result.routeNodeTooltipFrame.loaded).toBe(true);
  expect(result.routeNodeTooltipFrame.rendered).toBe(true);
  expect(result.bossTooltipHeight).toBe(252);
  expect(result.bossTooltipRetired).toBe(true);
  expect(result.routeNodeTooltipFrame.count).toBe(1);
  expect(result.routeNodeTooltipFrames).toHaveLength(1);
  expect(result.routeNodeTooltipFrames.map((frame: any) => frame.displayHeight)).toEqual([174]);
  result.routeNodeTooltipFrames.forEach((frame: any) => {
    expect(frame).toMatchObject({
      name: 'route-node-tooltip-frame',
      visible: true,
    });
    expect(frame.displayWidth).toBeGreaterThanOrEqual(244);
    expect(frame.alpha).toBeGreaterThan(0.85);
  });
  expect(result.routeRiskMeterFrameLoaded).toBe(true);
  expect(result.routeRiskMeterFrameRendered).toBe(false);
  expect(result.routeRiskMeterFrame.loaded).toBe(true);
  expect(result.routeRiskMeterFrame.rendered).toBe(false);
  expect(result.routeRiskMeterFrame.count).toBe(0);
  expect(result.routeRiskMeterFrames).toHaveLength(0);
  result.routeRiskMeterFrames.forEach((frame: any) => {
    expect(frame).toMatchObject({
      name: 'route-risk-meter-frame',
      visible: true,
      displayWidth: 50,
      displayHeight: 26,
    });
    expect(frame.alpha).toBeGreaterThan(0.8);
  });
  expect(result.routeSelectedNodeRingLoaded).toBe(true);
  expect(result.routeSelectedNodeRingRendered).toBe(true);
  expect(result.routeSelectedNodeRing.loaded).toBe(true);
  expect(result.routeSelectedNodeRing.rendered).toBe(true);
  expect(result.routeSelectedNodeRing.count).toBe(1);
  expect(result.routeSelectedNodeRings).toHaveLength(1);
  expect(result.routeSelectedNodeRings[0]).toMatchObject({
    name: 'route-selected-node-ring',
    visible: true,
  });
  expect(result.routeSelectedNodeRings[0].displayWidth).toBeGreaterThanOrEqual(132);
  expect(result.routeSelectedNodeRings[0].displayHeight).toBe(result.routeSelectedNodeRings[0].displayWidth);
  expect(result.routeSelectedNodeRings[0].alpha).toBeGreaterThan(0.8);
  expect(result.routeBossBeaconRingLoaded).toBe(true);
  expect(result.routeBossBeaconRingRendered).toBe(true);
  expect(result.routeBossBeaconRing.loaded).toBe(true);
  expect(result.routeBossBeaconRing.rendered).toBe(true);
  expect(result.routeBossBeaconRing.count).toBe(1);
  expect(result.rewardBadgeKeys).toEqual([]);
  expect(result.hasRewardBadges).toBe(true);
  expect(result.bossRewardBadges).toContain('waymark');
  expect(result.bossRewardBadges).toContain('card');
  expect(result.bossRewardBadges).toContain('preen');
  expect(result.cacheRewardBadges).toContain('heal');
  expect(result.cacheRewardBadges).toContain('supply');
  expect(result.cacheRewardBadges).toContain('scrap');
  expect(result.routeNodeIcons).toHaveLength(result.routeNodeCount);
  expect(result.routeNodeIcons.every((node: any) => node.visible)).toBe(true);
  expect(result.routeNodeIcons.find((node: any) => node.state === 'selected')?.alpha).toBe(1);
  expect(result.selectedBackplates).toBe(1);
  expect(result.selectableBackplates).toBeGreaterThanOrEqual(0);
  expect(result.selectedLabels).toBe(2);
  const futureRouteNodes = result.routeNodeIcons.filter((node: any) => node.state === 'future');
  expect(futureRouteNodes.length).toBeGreaterThan(0);
  expect(futureRouteNodes.every((node: any) => node.alpha === 0.9)).toBe(true);
});

test('route commit renders generated travel streak before changing scenes', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const collectObjects = (root: any): any[] => {
      const out: any[] = [];
      const visit = (node: any) => {
        if (!node) return;
        out.push(node);
        const children = node.list ?? node.children?.list;
        if (Array.isArray(children)) children.forEach(visit);
      };
      visit(root);
      return out;
    };

    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 40 && !route.textures.exists('route-commit-streak'); i += 1) await wait(50);
    const state = JSON.parse(window.render_game_to_text!());
    const target = state.nodes.find((node: any) => node.selectable)?.id;
    if (target) {
      route.selectRouteNode(target);
      route.commitRouteNodeAnimated(target);
    }
    if (window.advanceTime) await window.advanceTime(120);
    else await wait(120);
    const duringState = JSON.parse(window.render_game_to_text!());
    const streaks = collectObjects(route.children)
      .filter((child: any) => child.texture?.key === 'route-commit-streak')
      .map((child: any) => ({
        name: child.name,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        rotation: Number(child.rotation?.toFixed?.(3) ?? child.rotation),
        visible: child.visible
      }));
    return {
      target,
      activeSceneKeys: g.scene.getScenes(true).map((scene: any) => scene.scene.key),
      loaded: route.textures.exists('route-commit-streak'),
      routeCommitPending: duringState.routeCommitPending,
      routeCommitStreak: duringState.routeCommitStreak,
      streaks
    };
  });
  expect(result.target).toBeTruthy();
  expect(result.activeSceneKeys).toContain('RouteScene');
  expect(result.loaded).toBe(true);
  expect(result.routeCommitPending).toBe(true);
  expect(result.routeCommitStreak.loaded).toBe(true);
  expect(result.routeCommitStreak.rendered).toBe(true);
  expect(result.routeCommitStreak.count).toBeGreaterThanOrEqual(1);
  expect(result.routeCommitStreak.bursts).toBe(1);
  expect(result.streaks.length).toBeGreaterThanOrEqual(1);
  expect(result.streaks[0]).toMatchObject({ name: 'route-commit-streak', visible: true });
  expect(result.streaks[0].displayWidth).toBeGreaterThanOrEqual(360);
  expect(result.streaks[0].displayHeight).toBeGreaterThanOrEqual(110);
  expect(result.streaks[0].alpha).toBeGreaterThan(0.1);
});

test('route decision hierarchy remains readable at high resolution and landscape tablet', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await boot(page);
  const state = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    const initial = JSON.parse(window.render_game_to_text!());
    const reachable = initial.nodes.find((node: any) => node.selectable);
    route.selectRouteNode(reachable.id);
    return JSON.parse(window.render_game_to_text!());
  });
  await page.screenshot({ path: '.artifacts/test-results/experience-pass/route-highres-2560x1600.png' });
  expect(state.firstRouteGuidance).toEqual({ active: true, rendered: true });

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: '.artifacts/test-results/experience-pass/route-landscape-tablet-1024x768.png' });
  const canvas = page.locator('canvas');
  expect(await canvas.count()).toBe(1);
});

test('generated route map node footprints do not overlap', async ({ page }) => {
  await boot(page);
  const layoutFailures = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    const seeds = Array.from({ length: 12 }, (_value, index) => `node-spacing-${index}`);
    const failures: Array<{ mapIndex: number; seed: string; reason: string; id?: string }> = [];

    for (let mapIndex = 0; mapIndex < 4; mapIndex += 1) {
      for (const seed of seeds) {
        await window.__birdSquadStartScene!('RouteScene', {
          runState: {
            deck: [{ id: 'major_00' }],
            leaderId: 'fledgling',
            difficulty: 0,
            seed,
            currentHp: 36,
            scrap: 40,
            routeMarks: [],
            supplies: [],
            mapIndex,
            completedRouteNodeIds: [],
            currentRouteNodeId: undefined,
            routeLog: [],
            nextCombat: undefined,
            signalChoices: [],
            rewardEvents: [],
            suppliesUsed: [],
            combatResults: [],
            freePreenNextDistrict: 0
          }
        });
        g.scene.stop('MenuScene');
        const state = JSON.parse(window.render_game_to_text!());
        const graph = g.scene.getScene('RouteScene').routeLayout().graph;
        const seenCenters = new Set<string>();
        const mapNodes = new Map(window.__birdSquadCurrentMap!().nodes.map((node: any) => [node.id, node]));
        const nodes = state.nodes.map((node: any) => ({
          id: node.id,
          position: node.position,
          bounds: node.visualBounds,
          iconSize: mapNodes.get(node.id)?.type === 'boss' ? 120 : 84,
        }));
        for (let i = 0; i < nodes.length; i += 1) {
          const node = nodes[i];
          const centerKey = `${Math.round(node.position.x)}:${Math.round(node.position.y)}`;
          if (seenCenters.has(centerKey)) {
            failures.push({ mapIndex, seed, reason: 'duplicate center', id: node.id });
          }
          seenCenters.add(centerKey);
          if (
            !Number.isFinite(node.bounds.left)
            || !Number.isFinite(node.bounds.right)
            || !Number.isFinite(node.bounds.top)
            || !Number.isFinite(node.bounds.bottom)
            || node.bounds.right <= node.bounds.left
            || node.bounds.bottom <= node.bounds.top
          ) {
            failures.push({ mapIndex, seed, reason: 'invalid visual bounds', id: node.id });
          }
          if (node.bounds.left < graph.left + 32 || node.bounds.right > graph.right - 32) {
            failures.push({ mapIndex, seed, reason: 'node overlaps map frame rail', id: node.id });
          }
          for (let otherIndex = i + 1; otherIndex < nodes.length; otherIndex += 1) {
            const other = nodes[otherIndex];
            const overlapWidth = (node.iconSize + other.iconSize) / 2 - Math.abs(node.position.x - other.position.x);
            const overlapHeight = (node.iconSize + other.iconSize) / 2 - Math.abs(node.position.y - other.position.y);
            const overlaps = overlapWidth > 12 && overlapHeight > 12;
            if (overlaps) failures.push({ mapIndex, seed, reason: `overlaps ${other.id}`, id: node.id });
          }
        }
      }
    }
    return failures;
  });
  expect(layoutFailures).toEqual([]);
});

test('route Supplies resolve route-side cleanse explicitly instead of dropping it', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {
      runState: {
        deck: [{ id: 'major_00' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'route-cleanse-supply',
        currentHp: 20,
        scrap: 0,
        routeMarks: [],
        supplies: ['feather_splint'],
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
      }
    });
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    route.useRouteSupply(0);
    return {
      hp: route.runState.currentHp,
      supplies: route.runState.supplies,
      used: route.runState.suppliesUsed,
      log: route.runState.routeLog
    };
  });

  expect(result.hp).toBe(26);
  expect(result.supplies).toEqual([]);
  expect(result.used).toEqual(['feather_splint']);
  expect(result.log.some((entry: string) => entry.includes('restore 2 Cohesion'))).toBe(true);
});

test('route supply feedback retains a quiet surface behind its toast', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {
      runState: {
        deck: [{ id: 'major_00' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'route-supply-feedback-frame',
        currentHp: 20,
        scrap: 0,
        routeMarks: [],
        supplies: ['feather_splint'],
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
      }
    });
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-route-supply-feedback-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.routeSupplyFeedbackFrame?.loaded) break;
      await wait(50);
    }
    route.useRouteSupply(0);
    for (let i = 0; i < 20; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (route.children.getByName('route-supply-feedback-frame')) break;
      await wait(25);
    }
    const state = JSON.parse(window.render_game_to_text!());
    const frameObjects = countTexture(route.children.list);
    return {
      feedback: state.supplyFeedback?.[0],
      routeSupplyFeedbackFrame: state.routeSupplyFeedbackFrame,
      surfaceCount: route.children.list.filter((o: any) => o.name === 'route-supply-feedback-frame' && o.type === 'Rectangle').length,
      frameObjects,
      used: route.runState.suppliesUsed,
    };
  });

  expect(result.feedback?.id).toBe('feather_splint');
  expect(result.used).toEqual(['feather_splint']);
  expect(result.routeSupplyFeedbackFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.frameObjects).toBe(0);
  expect(result.surfaceCount).toBe(1);
});

test('Packed Supplies require confirmation and support keyboard, pointer, and controller-style navigation in both phases', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await page.setViewportSize({ width: 1000, height: 560 });
  await boot(page);
  const runState = {
    deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'cups_ace' }],
    leaderId: 'fledgling',
    difficulty: 0,
    seed: 'packed-supply-confirmation',
    currentHp: 24,
    scrap: 0,
    routeMarks: [],
    supplies: ['feather_splint', 'thermos_lid', 'bottlecap_popper'],
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
    freePreenNextDistrict: 0,
  };
  await page.evaluate(async (state) => window.__birdSquadStartScene!('RouteScene', { runState: state }), runState);
  await page.keyboard.press('x');
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text!());
    return state.supplyDrawer?.open && state.supplyDrawer?.renderer?.loaded;
  })).toBe(true);
  expect(await page.evaluate(() => JSON.parse(window.render_game_to_text!()).run.supplies)).toEqual(runState.supplies);

  await clickNamedGameObject(page, 'RouteScene', 'supply-drawer-item-0');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).supplyDrawer?.armedIndex)).toBe(0);
  expect(await page.evaluate(() => JSON.parse(window.render_game_to_text!()).run.supplies)).toEqual(runState.supplies);
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Feather Splint is selected');
  await page.screenshot({ path: '.artifacts/test-results/packed-supplies-route-armed-1000x560.png' });
  await clickNamedGameObject(page, 'RouteScene', 'supply-drawer-item-0');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).run.supplies)).toEqual(['thermos_lid', 'bottlecap_popper']);

  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).supplyDrawer?.armedIndex)).toBe(0);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).supplyDrawer?.armedIndex ?? null)).toBeNull();
  expect(await page.evaluate(() => JSON.parse(window.render_game_to_text!()).supplyDrawer?.open)).toBe(true);
  expect(await page.evaluate(() => JSON.parse(window.render_game_to_text!()).run.supplies)).toEqual(['thermos_lid', 'bottlecap_popper']);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).run.supplies)).toEqual(['bottlecap_popper']);

  await page.evaluate(async (state) => window.__birdSquadStartScene!('BattleScene', {
    routeNodeId: 'm1_entry',
    runState: {
      ...state,
      seed: 'packed-supply-battle-confirmation',
      supplies: ['chalk_dust_pouch', 'sky_sugar'],
      supplySlots: 2,
    },
  }), runState);
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text!());
    return state.scene === 'BattleScene' && state.mode === 'battle' && !state.combatAnimationPending;
  }), { timeout: 30_000 }).toBe(true);
  await page.keyboard.press('x');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).supplyDrawer?.renderer?.loaded)).toBe(true);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).supplyDrawer?.focusIndex)).toBe(1);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).supplyDrawer?.armedIndex)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(window.render_game_to_text!()).route.supplies)).toEqual(['chalk_dust_pouch', 'sky_sugar']);
  await page.screenshot({ path: '.artifacts/test-results/packed-supplies-battle-armed-1000x560.png' });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).supplyDrawer?.armedIndex ?? null)).toBeNull();
  expect(await page.evaluate(() => JSON.parse(window.render_game_to_text!()).supplyDrawer?.open)).toBe(true);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).route.supplies)).toEqual(['chalk_dust_pouch']);
  expect(await page.evaluate(() => JSON.parse(window.render_game_to_text!()).supplyDrawer?.open)).toBe(false);
});

test('route cleanse and scout effects provide meaningful fallback value', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {
      runState: {
        deck: [{ id: 'major_00' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'route-cleanse-scout-fallback',
        currentHp: 20,
        scrap: 0,
        routeMarks: [],
        supplies: [],
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
      }
    });
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    route.resolveRouteEffect('cleanseFlock(1)');
    const afterHeal = {
      hp: route.runState.currentHp,
      nextCombat: structuredClone(route.runState.nextCombat ?? {}),
      log: [...route.runState.routeLog]
    };
    route.runState.currentHp = route.runMaxHp();
    route.resolveRouteEffect('cleanseFlock(1)');
    route.resolveRouteEffect('peekNextNodes(2)');
    return {
      afterHeal,
      finalHp: route.runState.currentHp,
      finalNextCombat: route.runState.nextCombat,
      finalLog: route.runState.routeLog
    };
  });

  expect(result.afterHeal.hp).toBe(22);
  expect(result.afterHeal.nextCombat.openSkyGuard ?? 0).toBe(0);
  expect(result.afterHeal.log.some((entry: string) => entry.includes('restore 2 Cohesion'))).toBe(true);
  expect(result.finalNextCombat.openSkyGuard).toBe(2);
  expect(result.finalNextCombat.reduceNextOpenSky).toBe(2);
  expect(result.finalLog.some((entry: string) => entry.startsWith('Route plan set:'))).toBe(true);
});

test('repeat Supply Waymarks fire on each Supply use', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', {
      routeNodeId: 'm1_entry',
      runState: {
        deck: [{ id: 'major_00' }, { id: 'major_01' }, { id: 'major_02' }, { id: 'major_03' }, { id: 'major_04' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'repeat-supply-waymark',
        currentHp: 20,
        scrap: 0,
        routeMarks: ['supply_bell'],
        supplies: ['signal_flare', 'emergency_call'],
        supplySlots: 2,
        mapIndex: 0,
        completedRouteNodeIds: [],
        currentRouteNodeId: 'm1_entry',
        routeLog: [],
        nextCombat: undefined,
        signalChoices: [],
        rewardEvents: [],
        suppliesUsed: [],
        combatResults: [],
        freePreenNextDistrict: 0
      }
    });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.selectedEnemyId = scene.enemies.find((enemy: any) => enemy.hp > 0)?.id;
    scene.useSupply(0);
    const afterFirst = {
      pending: scene.pendingSupplyRepeats,
      used: [...scene.runSuppliesUsed],
      log: [...scene.log]
    };
    scene.useSupply(0);
    return {
      afterFirst,
      afterSecond: {
        pending: scene.pendingSupplyRepeats,
        used: [...scene.runSuppliesUsed],
        log: [...scene.log]
      }
    };
  });

  expect(result.afterFirst.pending).toBe(1);
  expect(result.afterFirst.used).toEqual(['signal_flare']);
  expect(result.afterSecond.used).toEqual(['signal_flare', 'emergency_call']);
  expect(result.afterSecond.pending).toBe(1);
  expect(result.afterSecond.log.filter((entry: string) => entry.startsWith('Supply Bell:'))).toHaveLength(2);
});

test('Waymark rewards have distinct identities and execute their authored tempo', async ({ page }) => {
  const authored = JSON.parse(await readFile('data/game/alpha-route-marks.json', 'utf8'));
  const marks = authored.routeMarks as Array<{
    id: string;
    trigger: string;
    effects: string[];
    description: string;
  }>;
  const byId = new Map(marks.map((mark) => [mark.id, mark]));
  const signatures = marks.map((mark) => `${mark.trigger}|${[...mark.effects].sort().join('|')}`);
  expect(new Set(signatures).size).toBe(marks.length);
  expect(byId.get('black_ink_pin')).toMatchObject({
    trigger: 'onRoostWithCardsInHand',
    effects: ['gainResonance(1)', 'retainHand(2)'],
  });
  expect(byId.get('parade_mirror')).toMatchObject({
    trigger: 'onNthCardThisTurn(3)',
    effects: ['gainResonance(1)', 'nextTurnDraw(1)'],
  });
  expect(byId.get('fresh_pinfeather')).toMatchObject({
    trigger: 'onEnterMolt',
    effects: ['gainWingbeat(1)', 'draw(1)'],
  });
  expect(byId.get('double_packed_buckle')).toMatchObject({
    trigger: 'onSupplyUsed',
    effects: ['repeatNextSupply(1)', 'gainWingbeat(1)'],
  });

  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', {
      routeNodeId: 'm1_entry',
      runState: {
        deck: [{ id: 'major_00' }, { id: 'major_01' }, { id: 'major_02' }, { id: 'major_03' }, { id: 'major_04' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'distinct-waymark-identities',
        currentHp: 20,
        scrap: 0,
        routeMarks: [],
        supplies: [],
        supplySlots: 2,
        mapIndex: 0,
        completedRouteNodeIds: [],
        currentRouteNodeId: 'm1_entry',
        routeLog: [],
        nextCombat: undefined,
        signalChoices: [],
        rewardEvents: [],
        suppliesUsed: [],
        combatResults: [],
        freePreenNextDistrict: 0,
      },
    });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const template = scene.hand[0] ?? scene.drawPile[0] ?? scene.discardPile[0];

    scene.routeMarks = ['wind_step_tag'];
    scene.markFiredThisCombat = new Set();
    scene.pendingRetainHand = 0;
    scene.nextTurnEnergyBonus = 0;
    scene.roostRetainPool = [];
    scene.checkRoostRestraintMarks(2, 0, 1);
    const windStep = {
      retained: scene.pendingRetainHand,
      nextEnergy: scene.nextTurnEnergyBonus,
      resonance: scene.spark,
    };

    scene.routeMarks = ['black_ink_pin'];
    scene.markFiredThisCombat = new Set();
    scene.pendingRetainHand = 0;
    scene.nextTurnEnergyBonus = 0;
    scene.roostRetainPool = [];
    scene.spark = 0;
    scene.checkRoostRestraintMarks(2, 0, 1);
    const blackInk = {
      retained: scene.pendingRetainHand,
      nextEnergy: scene.nextTurnEnergyBonus,
      resonance: scene.spark,
    };

    scene.routeMarks = ['parade_mirror'];
    scene.markFiredThisCombat = new Set();
    scene.spark = 0;
    scene.nextTurnDrawBonus = 0;
    scene.cardsPlayedThisTurn = 2;
    scene.checkNthCardMarks();
    const paradeBeforeThird = { resonance: scene.spark, nextDraw: scene.nextTurnDrawBonus };
    scene.cardsPlayedThisTurn = 3;
    scene.checkNthCardMarks();
    const paradeAfterThird = { resonance: scene.spark, nextDraw: scene.nextTurnDrawBonus };
    scene.checkNthCardMarks();
    const paradeAfterRepeatCheck = { resonance: scene.spark, nextDraw: scene.nextTurnDrawBonus };

    scene.routeMarks = ['plumes_applause_cap'];
    scene.markFiredThisCombat = new Set();
    scene.spark = 0;
    scene.nextTurnDrawBonus = 0;
    scene.cardsPlayedThisTurn = 3;
    scene.checkNthCardMarks();
    const applauseBeforeRoost = { resonance: scene.spark, nextDraw: scene.nextTurnDrawBonus };
    scene.checkRoostRestraintMarks(0, 0, 3);
    const applauseAfterRoost = { resonance: scene.spark, nextDraw: scene.nextTurnDrawBonus };

    scene.routeMarks = ['fresh_pinfeather'];
    scene.markFiredThisCombat = new Set();
    scene.flock.molt = false;
    scene.energy = 0;
    scene.nextTurnEnergyBonus = 0;
    scene.hand = [];
    scene.drawPile = [{ ...template, instanceId: 'fresh-pinfeather-draw' }];
    scene.enterMolt('Fresh Pinfeather test');
    const freshPinfeather = {
      energy: scene.energy,
      nextEnergy: scene.nextTurnEnergyBonus,
      hand: scene.hand.length,
    };

    scene.routeMarks = ['molt_metronome'];
    scene.markFiredThisCombat = new Set();
    scene.flock.molt = false;
    scene.energy = 0;
    scene.nextTurnEnergyBonus = 0;
    scene.hand = [];
    scene.drawPile = [{ ...template, instanceId: 'molt-metronome-draw' }];
    scene.enterMolt('Molt Metronome test');
    const moltMetronome = {
      energy: scene.energy,
      nextEnergy: scene.nextTurnEnergyBonus,
      hand: scene.hand.length,
    };

    scene.routeMarks = ['supply_bell'];
    scene.markFiredThisCombat = new Set();
    scene.pendingSupplyRepeats = 0;
    scene.energy = 0;
    scene.hand = [];
    scene.drawPile = [{ ...template, instanceId: 'supply-bell-draw' }];
    scene.runSupplies = ['seed_packet'];
    scene.runSuppliesUsed = [];
    scene.flock.hp = 10;
    scene.useSupply(0);
    const supplyBell = {
      energy: scene.energy,
      hand: scene.hand.length,
      pending: scene.pendingSupplyRepeats,
    };

    scene.fxLayer.removeAll(true);
    scene.waymarkFeedback = [];
    scene.supplyFeedback = [];
    scene.routeMarks = ['double_packed_buckle'];
    scene.markFiredThisCombat = new Set();
    scene.pendingSupplyRepeats = 0;
    scene.energy = 0;
    scene.runSupplies = ['seed_packet', 'seed_packet'];
    scene.runSuppliesUsed = [];
    scene.flock.hp = 10;
    scene.useSupply(0);
    const doublePackedAfterFirst = {
      energy: scene.energy,
      hp: scene.flock.hp,
      pending: scene.pendingSupplyRepeats,
      feedback: scene.waymarkFeedback[0],
    };
    scene.routeMarks = [];
    scene.useSupply(0);
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return {
      windStep,
      blackInk,
      paradeBeforeThird,
      paradeAfterThird,
      paradeAfterRepeatCheck,
      applauseBeforeRoost,
      applauseAfterRoost,
      freshPinfeather,
      moltMetronome,
      supplyBell,
      doublePackedAfterFirst,
      doublePackedAfterSecond: {
        energy: scene.energy,
        hp: scene.flock.hp,
        pending: scene.pendingSupplyRepeats,
        supplyFeedback: state.supplyFeedback?.[0],
      },
    };
  });

  expect(result.windStep).toEqual({ retained: 1, nextEnergy: 1, resonance: 0 });
  expect(result.blackInk).toEqual({ retained: 2, nextEnergy: 0, resonance: 1 });
  expect(result.paradeBeforeThird).toEqual({ resonance: 0, nextDraw: 0 });
  expect(result.paradeAfterThird).toEqual({ resonance: 1, nextDraw: 1 });
  expect(result.paradeAfterRepeatCheck).toEqual(result.paradeAfterThird);
  expect(result.applauseBeforeRoost).toEqual({ resonance: 0, nextDraw: 0 });
  expect(result.applauseAfterRoost).toEqual({ resonance: 1, nextDraw: 1 });
  expect(result.freshPinfeather).toEqual({ energy: 1, nextEnergy: 0, hand: 1 });
  expect(result.moltMetronome).toEqual({ energy: 0, nextEnergy: 1, hand: 1 });
  expect(result.supplyBell).toEqual({ energy: 0, hand: 1, pending: 1 });
  expect(result.doublePackedAfterFirst).toMatchObject({
    energy: 1,
    hp: 16,
    pending: 1,
    feedback: {
      id: 'double_packed_buckle',
      name: 'Double-Packed Buckle',
    },
  });
  expect(result.doublePackedAfterFirst.feedback.summary).toContain('Wingbeat');
  expect(result.doublePackedAfterFirst.feedback.summary).toContain('Supply');
  expect(result.doublePackedAfterSecond).toMatchObject({
    energy: 1,
    hp: 28,
    pending: 0,
    supplyFeedback: {
      id: 'seed_packet',
    },
  });
  expect(result.doublePackedAfterSecond.supplyFeedback.summary).toContain('x2');

  await page.screenshot({
    path: '.artifacts/test-results/waymark-identity/double-packed-feedback.png',
  });
});

test('Open Sky softening is distinct from Open Sky Guard', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', {
      routeNodeId: 'm1_entry',
      runState: {
        deck: [{ id: 'major_00' }, { id: 'major_01' }, { id: 'major_02' }, { id: 'major_03' }, { id: 'major_04' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'open-sky-softening',
        currentHp: 30,
        scrap: 0,
        routeMarks: [],
        supplies: [],
        supplySlots: 2,
        mapIndex: 0,
        completedRouteNodeIds: [],
        currentRouteNodeId: 'm1_entry',
        routeLog: [],
        nextCombat: { reduceNextOpenSky: 2, startOpenSky: true },
        signalChoices: [],
        rewardEvents: [],
        suppliesUsed: [],
        combatResults: [],
        freePreenNextDistrict: 0
      }
    });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    enemy.nextAttackBonus = 0;
    enemy.damageBonus = 0;
    enemy.weak = 0;
    scene.flock.openSkyGuard = 0;
    const before = {
      hp: scene.flock.hp,
      guard: scene.flock.openSkyGuard,
      reduction: scene.flock.openSkyReduction,
      statuses: scene.flockStatuses?.(scene.flock) ?? []
    };
    scene.damageFlock(enemy, 4);
    return {
      before,
      after: {
        hp: scene.flock.hp,
        guard: scene.flock.openSkyGuard,
        reduction: scene.flock.openSkyReduction,
        log: [...scene.log]
      }
    };
  });

  expect(result.before.guard).toBe(0);
  expect(result.before.reduction).toBe(2);
  expect(result.after.guard).toBe(0);
  expect(result.after.reduction).toBeLessThan(2);
  expect(result.after.log.some((entry: string) => entry.includes('softens Open Sky'))).toBe(true);
});

test('Roost retain Waymarks retain cards from the triggering Roost', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.resolveEnemyTurn = () => {};
    scene.checkOutcome = () => {};

    scene.routeMarks = ['wind_step_tag'];
    scene.markFiredThisCombat = new Set();
    scene.hand = scene.hand.slice(0, 3);
    scene.energy = 1;
    scene.cardsPlayedThisTurn = 1;
    scene.zeroCostThisTurn = 0;
    scene.pendingRetainHand = 0;
    scene.roostRetainPool = [];
    const cardsInHandRetain = scene.hand.map((card: any) => card.instanceId);
    scene.selectedInstanceId = cardsInHandRetain[0];
    scene.endTurn();
    const retainedFromHand = cardsInHandRetain.filter((id: string) => scene.hand.some((card: any) => card.instanceId === id));
    const duplicatedFromHand = retainedFromHand.filter((id: string) => scene.discardPile.some((card: any) => card.instanceId === id));

    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    const cleanScene: any = g.scene.getScene('BattleScene');
    cleanScene.resolveEnemyTurn = () => {};
    cleanScene.checkOutcome = () => {};
    cleanScene.routeMarks = ['patched_shoulder_wrap'];
    cleanScene.markFiredThisCombat = new Set();
    cleanScene.hand = cleanScene.hand.slice(0, 3);
    cleanScene.energy = 0;
    cleanScene.cardsPlayedThisTurn = 1;
    cleanScene.zeroCostThisTurn = 0;
    cleanScene.pendingRetainHand = 0;
    cleanScene.roostRetainPool = [];
    const cardsForNoDamage = cleanScene.hand.map((card: any) => card.instanceId);
    cleanScene.selectedInstanceId = cardsForNoDamage[0];
    cleanScene.endTurn();
    const retainedAfterEnemy = cardsForNoDamage.filter((id: string) => cleanScene.hand.some((card: any) => card.instanceId === id));
    const duplicatedAfterEnemy = retainedAfterEnemy.filter((id: string) => cleanScene.discardPile.some((card: any) => card.instanceId === id));

    return {
      retainedFromHand,
      selectedFromHand: cardsInHandRetain[0],
      duplicatedFromHand,
      retainedAfterEnemy,
      selectedAfterEnemy: cardsForNoDamage[0],
      duplicatedAfterEnemy
    };
  });

  expect(result.retainedFromHand).toHaveLength(1);
  expect(result.retainedFromHand).toEqual([result.selectedFromHand]);
  expect(result.duplicatedFromHand).toHaveLength(0);
  expect(result.retainedAfterEnemy).toHaveLength(1);
  expect(result.retainedAfterEnemy).toEqual([result.selectedAfterEnemy]);
  expect(result.duplicatedAfterEnemy).toHaveLength(0);
});

test('generated route maps enforce controlled pacing beats', async ({ page }) => {
  await boot(page);
  const failures = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    const seeds = Array.from({ length: 16 }, (_value, index) => `route-pacing-${index}`);
    const pressureCaps = [5, 6, 6, 7];
    const combatTypes = new Set(['street', 'rival']);
    const safetyTypes = new Set(['basin', 'nest']);
    const buildTypes = new Set(['cache', 'market', 'signal', 'nest']);
    const found: Array<{ mapIndex: number; seed: string; reason: string; path?: string[] }> = [];

    const pathsFor = (map: any) => {
      const byId = new Map(map.nodes.map((node: any) => [node.id, node]));
      const outgoing = new Map<string, string[]>();
      for (const edge of map.edges) {
        if (!edge.locked) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
      }
      const paths: any[][] = [];
      const stack = [[map.entryNodeId]];
      while (stack.length && paths.length < 2000) {
        const path = stack.pop()!;
        const current = path[path.length - 1];
        if (current === map.bossNodeId) {
          paths.push(path.map((id) => byId.get(id)).filter(Boolean));
          continue;
        }
        for (const next of outgoing.get(current) ?? []) {
          if (!path.includes(next)) stack.push([...path, next]);
        }
      }
      return { byId, outgoing, paths };
    };

    const maxCombatRun = (path: any[]) => {
      let current = 0;
      let worst = 0;
      for (const node of path) {
        if (combatTypes.has(node.type)) {
          current += 1;
          worst = Math.max(worst, current);
        } else if (node.type !== 'boss') {
          current = 0;
        }
      }
      return worst;
    };
    const pressureScore = (path: any[]) => path.reduce((sum, node) => (
      sum + (node.type === 'rival' ? 2 : node.type === 'street' ? 1 : safetyTypes.has(node.type) ? -1 : 0)
    ), 0);

    for (let mapIndex = 0; mapIndex < 4; mapIndex += 1) {
      for (const seed of seeds) {
        await window.__birdSquadStartScene!('RouteScene', {
          runState: {
            deck: [{ id: 'major_00' }],
            leaderId: 'fledgling',
            difficulty: 0,
            seed,
            currentHp: 36,
            scrap: 40,
            routeMarks: [],
            supplies: [],
            mapIndex,
            completedRouteNodeIds: [],
            currentRouteNodeId: undefined,
            routeLog: [],
            nextCombat: undefined,
            signalChoices: [],
            rewardEvents: [],
            suppliesUsed: [],
            combatResults: [],
            freePreenNextDistrict: 0
          }
        });
        g.scene.stop('MenuScene');
        const map = window.__birdSquadCurrentMap!();
        const middleColumns = map.nodes.find((node: any) => node.id === map.bossNodeId).column - 1;
        const earlySafetyColumn = Math.max(1, Math.floor(middleColumns * 0.7));
        const { byId, outgoing, paths } = pathsFor(map);

        for (const [from, toIds] of outgoing.entries()) {
          const fromNode: any = byId.get(from);
          const targets = toIds.map((id) => byId.get(id)).filter(Boolean) as any[];
          if (fromNode?.type !== 'boss' && targets.length > 0 && targets.every((node) => node.type === 'rival')) {
            found.push({ mapIndex, seed, reason: `forced rival after ${from}` });
          }
        }

        for (const path of paths) {
          const routeNodes = path.filter((node) => node.column >= 1 && node.column <= middleColumns);
          const earlySafety = routeNodes.filter((node) => node.column <= earlySafetyColumn && safetyTypes.has(node.type)).length;
          const build = routeNodes.filter((node) => buildTypes.has(node.type)).length;
          if (maxCombatRun(path) > 2) found.push({ mapIndex, seed, reason: 'more than two consecutive combats', path: path.map((node) => node.type) });
          if (earlySafety < 1) found.push({ mapIndex, seed, reason: 'missing early safety', path: path.map((node) => node.type) });
          if (build < 1) found.push({ mapIndex, seed, reason: 'missing build/economy', path: path.map((node) => node.type) });
          if (pressureScore(path) > pressureCaps[mapIndex]) found.push({ mapIndex, seed, reason: 'pressure cap exceeded', path: path.map((node) => node.type) });
          if (found.length > 8) return found;
        }
      }
    }
    return found;
  });
  expect(failures).toEqual([]);
});

test('route map surfaces run status without opening the Flock menu', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    const texts = route.children.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
    const state = JSON.parse(window.render_game_to_text!());
    return {
      status: state.routeStatus,
      run: state.run,
      hasCohesion: texts.some((text) => text === state.routeStatus.cohesion || text.includes(state.routeStatus.cohesion)),
      hasScrap: texts.some((text) => text === String(state.routeStatus.scrap) || text.includes(String(state.routeStatus.scrap))),
      flockOverlayOpen: state.flockOverlayOpen
    };
  });
  expect(result.status.cohesion).toBeTruthy();
  expect(result.status.scrap).toBeGreaterThanOrEqual(0);
  expect(result.status.deckSize).toBe(result.run.deckSize);
  expect(result.status.waymarks).toBe(result.run.routeMarks.length);
  expect(result.status.supplies).toBe(`${result.run.supplies.length}/${result.run.supplySlots}`);
  expect(result.hasCohesion).toBe(true);
  expect(result.hasScrap).toBe(true);
  expect(result.flockOverlayOpen).toBe(false);
});

test('signals/basins/cache present structured choices resolved by the route-effect interpreter', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const scene: any = await window.__birdSquadStartScene!('RouteScene', {});
    const choices = [
      scene.nodeChoiceList({ type: 'signal', payloadId: 'faded_chalk_line' }),
      scene.nodeChoiceList({ type: 'basin' }),
      scene.nodeChoiceList({ type: 'cache' }),
    ];
    const before = scene.runState.scrap;
    scene.resolveRouteEffect('gainScrap(45)');
    const gain = scene.runState.scrap - before;
    scene.resolveRouteEffect('payScrap(6)');
    const net = scene.runState.scrap - before;
    return {
      choices: choices.map(group => group.map((choice: any) => ({ key: choice.key, text: choice.text, effects: choice.effects }))),
      gain, net,
      gatedFar: scene.requirementsMet(['scrapAtLeast(999999)']),
      gatedNear: scene.requirementsMet(['scrapAtLeast(0)']),
    };
  });
  expect(result.choices[0].map((choice: any) => choice.key)).toEqual(['repaint', 'scout', 'move', 'decline']);
  expect(result.choices[1]).toHaveLength(5);
  expect(result.choices[2]).toHaveLength(6);
  for (const choices of result.choices) {
    expect(new Set(choices.map((choice: any) => choice.key)).size).toBe(choices.length);
    expect(choices.every((choice: any) => choice.text.length > 0 && Array.isArray(choice.effects))).toBe(true);
  }
  expect(result.gain).toBe(45);
  expect(result.net).toBe(39);
  expect(result.gatedFar).toBe(false);
  expect(result.gatedNear).toBe(true);
  // Quieter event rows deliberately omit decorative effect-medallion grids.
  // Complete authored wording, paging, geometry and artwork are exercised in
  // event-choice-clarity, event-navigation-polish and the special-node art test.
});

test('route choice and market nodes complete only after their economy step resolves', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    const startRouteWithNode = async (type: string) => {
      for (let attempt = 0; attempt < 24; attempt += 1) {
        await window.__birdSquadStartScene!('RouteScene', {
          runState: {
            deck: [{ id: 'major_00' }],
            leaderId: 'fledgling',
            difficulty: 0,
            seed: `route-economy-${type}-${attempt}`,
            currentHp: 36,
            scrap: 40,
            routeMarks: [],
            supplies: [],
            mapIndex: 0,
            completedRouteNodeIds: [],
            currentRouteNodeId: undefined,
            routeLog: [],
            nextCombat: undefined,
            signalChoices: [],
            rewardEvents: [],
          }
        });
        g.scene.stop('MenuScene');
        const scene: any = g.scene.getScene('RouteScene');
        const node = window.__birdSquadCurrentMap!().nodes.find((candidate: any) => candidate.type === type);
        if (node) return { scene, node };
      }
      throw new Error(`No ${type} node generated for route economy smoke`);
    };
    const basinSetup = await startRouteWithNode('basin');
    const scene: any = basinSetup.scene;
    const basin = basinSetup.node;
    g.scene.stop('MenuScene');
    scene.openNodeChoices(basin);
    const basinCompletedOnOpen = scene.runState.completedRouteNodeIds.includes(basin.id);
    scene.chooseNodeOption('recover');
    const basinCompletedAfterChoice = scene.runState.completedRouteNodeIds.includes(basin.id);
    if (scene.routeSupplyRewardChoices.length > 1) {
      const supplyId = scene.routeSupplyRewardChoices[0];
      scene.requestRouteSupplyReward(supplyId);
      scene.requestRouteSupplyReward(supplyId);
    } else {
      scene.claimRouteReward();
    }
    const basinCompletedAfterClaim = scene.runState.completedRouteNodeIds.includes(basin.id);

    const marketSetup = await startRouteWithNode('market');
    const marketScene: any = marketSetup.scene;
    const market = marketSetup.node;
    marketScene.openMarketNode(market);
    const marketCompletedOnOpen = marketScene.runState.completedRouteNodeIds.includes(market.id);
    marketScene.leaveMarket();
    const marketCompletedAfterLeave = marketScene.runState.completedRouteNodeIds.includes(market.id);

    const rivalDeclineSetup = await startRouteWithNode('rival');
    const rivalDeclineScene: any = rivalDeclineSetup.scene;
    await wait(50);
    const rivalDecline = rivalDeclineSetup.node;
    rivalDeclineScene.openNodeChoices(rivalDecline);
    const rivalCompletedOnOpen = rivalDeclineScene.runState.completedRouteNodeIds.includes(rivalDecline.id);
    const rivalChoices = rivalDeclineScene.nodeChoiceList(rivalDecline).map((choice: any) => choice.key);
    rivalDeclineScene.chooseNodeOption('decline');
    const rivalCompletedAfterDecline = rivalDeclineScene.runState.completedRouteNodeIds.includes(rivalDecline.id);

    const rivalFightSetup = await startRouteWithNode('rival');
    const rivalFightScene: any = rivalFightSetup.scene;
    await wait(50);
    const rivalFight = rivalFightSetup.node;
    rivalFightScene.openNodeChoices(rivalFight);
    rivalFightScene.chooseNodeOption('challenge_rival');
    for (let i = 0; i < 40 && !(g.scene.isActive('BattleScene') && g.scene.getScene('BattleScene')?.fxLayer); i += 1) {
      await wait(50);
    }
    const rivalStartsBattle = g.scene.isActive('BattleScene') && Boolean(g.scene.getScene('BattleScene')?.fxLayer);

    return {
      basinCompletedOnOpen,
      basinCompletedAfterChoice,
      basinCompletedAfterClaim,
      marketCompletedOnOpen,
      marketCompletedAfterLeave,
      rivalCompletedOnOpen,
      rivalChoices,
      rivalCompletedAfterDecline,
      rivalStartsBattle
    };
  });
  expect(result.basinCompletedOnOpen).toBe(false);
  expect(result.basinCompletedAfterChoice).toBe(false);
  expect(result.basinCompletedAfterClaim).toBe(true);
  expect(result.marketCompletedOnOpen).toBe(false);
  expect(result.marketCompletedAfterLeave).toBe(true);
  expect(result.rivalCompletedOnOpen).toBe(false);
  expect(result.rivalChoices).toEqual(['challenge_rival', 'decline']);
  expect(result.rivalCompletedAfterDecline).toBe(true);
  expect(result.rivalStartsBattle).toBe(true);
});

test('payScrap route options are locked when Scrap is short', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    scene.runState.scrap = 0;
    const basin = scene.nodeChoiceList({ type: 'basin' }).find((choice: any) => choice.key === 'refill_supplies');
    scene.runState.scrap = 20;
    const basinAffordable = scene.nodeChoiceList({ type: 'basin' }).find((choice: any) => choice.key === 'refill_supplies');
    scene.runState.scrap = 0;
    const nest = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'nest');
    scene.openNodeChoices(nest);
    const nestUnlockedAtZero = scene.nodeChoiceList(nest).filter((choice: any) => !choice.locked).map((choice: any) => choice.key);
    scene.chooseNodeOption('decline');
    return {
      lockedAtZero: basin.locked,
      lockText: basin.lockedText,
      unlockedAtCost: basinAffordable.locked,
      nestUnlockedAtZero,
      nestCompletedAfterDecline: scene.runState.completedRouteNodeIds.includes(nest.id),
      nestChoiceClosedAfterDecline: !scene.nodeChoiceOpen
    };
  });
  expect(result.lockedAtZero).toBe(true);
  expect(result.lockText).toContain('20 Scrap');
  expect(result.unlockedAtCost).toBe(false);
  expect(result.nestUnlockedAtZero).toEqual(['decline']);
  expect(result.nestCompletedAfterDecline).toBe(true);
  expect(result.nestChoiceClosedAfterDecline).toBe(true);
});

test('route event art stays cold until its matching overlay opens', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const eventTextureKeys = () => Object.keys(g.textures.list)
      .filter((key) => key.startsWith('route-event-') || key.startsWith('market-kit-'))
      .sort();
    const beforeOpen = eventTextureKeys();

    const basin = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'basin');
    scene.openNodeChoices(basin);
    const basinKeys = [
      'route-event-lantern-roost-shelter',
      'route-event-prop-basin-hearth-cart',
      'route-event-resident-sella-warmwick'
    ];
    for (let i = 0; i < 80 && !basinKeys.every((key) => scene.textures.exists(key)); i += 1) {
      await wait(50);
    }
    const afterBasin = eventTextureKeys();

    const market = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes[0];
    market.type = 'market';
    scene.openMarketNode(market);
    const marketKeys = [
      'market-kit-background',
      'market-kit-counter-wares',
      'market-kit-shopkeeper-starling',
      'market-kit-sign'
    ];
    for (let i = 0; i < 80 && !marketKeys.every((key) => scene.textures.exists(key)); i += 1) {
      await wait(50);
    }
    return { beforeOpen, afterBasin, afterMarket: eventTextureKeys() };
  });

  expect(result.beforeOpen).toEqual([]);
  expect(result.afterBasin).toEqual([
    'route-event-lantern-roost-shelter',
    'route-event-prop-basin-hearth-cart',
    'route-event-resident-sella-warmwick'
  ]);
  expect(result.afterMarket).toEqual([
    'market-kit-background',
    'market-kit-counter-wares',
    'market-kit-shopkeeper-starling',
    'market-kit-sign',
    'route-event-lantern-roost-shelter',
    'route-event-prop-basin-hearth-cart',
    'route-event-resident-sella-warmwick'
  ]);
});

test('route event overlays render generated special-node backdrops', async ({ page }, info) => {
  test.setTimeout(120000);
  await boot(page);
  for (const [type, key, resident] of [
    ['basin', 'route-event-lantern-roost-shelter', 'route-event-resident-sella-warmwick'],
    ['cache', 'route-event-rooftop-cache-office', 'route-event-resident-marn-valeclip'],
    ['signal', 'route-event-signal-switchboard', 'route-event-resident-ivo-tallymast'],
    ['nest', 'route-event-featherwright-studio', 'route-event-resident-oren-shearbright'],
    ['rival', 'route-event-rival-wager-board', 'route-event-resident-caldra-pinion'],
    ['market', 'market-kit-background', ''],
  ]) {
    await page.evaluate(async type => {
      for (let attempt = 0; attempt < 24; attempt++) {
        const scene: any = await window.__birdSquadStartScene!('RouteScene', { runState: {
          deck: [{ id: 'major_00' }], leaderId: 'fledgling', difficulty: 0,
          seed: `event-art-${type}-${attempt}`, currentHp: 36, scrap: 999,
          routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [],
          routeLog: [], signalChoices: [], rewardEvents: [],
        } });
        window.__birdSquadGame.scene.stop('MenuScene');
        const node = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === type);
        if (!node) continue;
        if (type === 'market') scene.openMarketNode(node); else scene.openNodeChoices(node);
        return;
      }
      throw new Error('Missing authored node: ' + type);
    }, type);
    await page.waitForFunction(({ key, resident }) => {
      const r: any = window.__birdSquadGame.scene.getScene('RouteScene');
      return r.children.list.some((o: any) => o.texture?.key === key)
        && (!resident || r.children.list.some((o: any) => o.texture?.key === resident));
    }, { key, resident });
    await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`${type}-art.png`) });
    if (type !== 'market') {
      const before = await page.evaluate(() => JSON.stringify(window.__birdSquadGame.scene.getScene('RouteScene').runState));
      await clickNamedGameObject(page, 'RouteScene', 'route-event-details-hit');
      await page.waitForFunction(() => window.__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-event-reader'));
      const reading = await page.evaluate(() => {
        const r: any = window.__birdSquadGame.scene.getScene('RouteScene');
        const body = r.children.getByName('route-event-reader').getByName('route-event-reader-body');
        return { text: body.text, size: body.style.fontSize, bottom: body.getBounds().bottom,
          run: JSON.stringify(r.runState), oldDetailFrame: r.routeChoiceDetailFrameState().rendered };
      });
      expect(reading.text.length).toBeGreaterThan(0);
      expect(reading.size).toBe('22px'); expect(reading.bottom).toBeLessThanOrEqual(495);
      expect(reading.run).toBe(before); expect(reading.oldDetailFrame).toBe(false);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !window.__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-event-reader'));
    }
  }
});

test('route event confirmation previews commit the exact projected state across event families', async ({ page }) => {
  test.setTimeout(90_000);
  const runScenario = async (kind: 'basin' | 'signal' | 'cache' | 'nest') => {
    const scenarioPage = await page.context().newPage();
    await boot(scenarioPage);
    const result = await scenarioPage.evaluate(async (scenario) => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    const digest = (run: any) => ({
      currentHp: run.currentHp,
      scrap: run.scrap,
      deck: run.deck.map((card: any) => ({ id: card.id, upgraded: !!card.upgraded })),
      supplies: [...run.supplies],
      routeMarks: [...run.routeMarks],
      nextCombat: { ...(run.nextCombat ?? {}) },
      signalChoices: [...(run.signalChoices ?? [])],
    });
    const makeRun = (seed: string, patch: Record<string, unknown> = {}) => ({
      deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'pentacles_04' }],
      leaderId: 'fledgling', difficulty: 0, seed, runMode: 'full',
      currentHp: 20, scrap: 200, routeMarks: [], supplies: [], mapIndex: 0,
      completedRouteNodeIds: [], currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined,
      signalChoices: [], rewardEvents: [], routeDecisions: [], suppliesUsed: [], combatResults: [],
      ...patch,
    });
    const patches = {
      basin: { routeMarks: ['blue_cup_token'] },
      signal: { routeMarks: ['wire_map'], currentHp: 30, scrap: 40 },
      cache: { routeMarks: ['cache_divining_hook'], currentHp: 24 },
      nest: { currentHp: 30, scrap: 220 },
    } as const;
    const runState = makeRun(`route-preview-${scenario}`, patches[scenario]);
    await window.__birdSquadStartScene!('RouteScene', { runState });
    game.scene.stop('MenuScene');
    await wait(100);
    const scene: any = game.scene.getScene('RouteScene');
    for (let i = 0; i < 120 && !scene.routeEssentialAssetsReady; i += 1) await wait(50);

    const node = window.__birdSquadCurrentMap!().nodes.find((candidate: any) => candidate.type === scenario);
    if (scenario === 'signal') node.payloadId = 'blackout_sign';
    const originalRandom = Math.random;
    const choiceKey = scenario === 'basin'
      ? 'refill_supplies'
      : scenario === 'signal'
        ? 'cut'
        : scenario === 'cache'
          ? 'cache_card'
          : 'boss_ready_tune';
    if (scenario === 'signal' || scenario === 'cache') Math.random = () => 0;
    if (scenario === 'basin') {
      scene.openNodeChoices(node);
      scene.chooseNodeOption(choiceKey);
    } else {
      const choice = scene.nodeChoiceList(node).find((candidate: any) => candidate.key === choiceKey);
      const restoreState = structuredClone(scene.runState);
      scene.pendingRouteReward = scene.preparePendingRouteReward(node, choice, restoreState);
    }
    Math.random = originalRandom;
    const pending = scene.pendingRouteReward;
    const projection = digest(pending.projectedState);
    const preview = [...pending.decisionPreview];
    const textPreview = scenario === 'basin'
      ? [...(JSON.parse(window.render_game_to_text!()).routeReward?.decisionPreview ?? [])]
      : undefined;

    if (scenario === 'cache') {
      const chosenCard = scene.routeCardRewardChoices[0];
      const expected = digest(pending.projectedState);
      expected.deck.push({ id: chosenCard.id, upgraded: false });
      scene.finishPendingRouteReward = () => undefined;
      scene.chooseRouteRewardCard(chosenCard.id);
      return { expected, actual: digest(scene.runState), preview };
    }

    scene.finishPendingRouteReward = () => undefined;
    scene.openRoutePickerForPendingReward = (_pending: any, pickerPlan: any) => {
      scene.cardPickerMode = pickerPlan.mode;
      scene.cardPickerContext = 'route';
      scene.cardPickerRemainingPicks = pickerPlan.count;
      scene.pendingRouteReward = undefined;
    };
    if (scene.routeSupplyRewardChoices.length > 1) {
      const chosenSupplyId = scene.routeSupplyRewardChoices[0];
      scene.requestRouteSupplyReward(chosenSupplyId);
      scene.requestRouteSupplyReward(chosenSupplyId);
    } else {
      scene.claimRouteReward();
    }
    const common = { projection, actual: digest(scene.runState), preview };
    if (scenario === 'basin') {
      return { ...common, textPreview };
    }
    if (scenario === 'signal') return { ...common, resolvedEffects: [...pending.effects] };
    return {
      ...common,
      picker: {
        mode: scene.cardPickerMode,
        context: scene.cardPickerContext,
        remaining: scene.cardPickerRemainingPicks,
        upgraded: scene.runState.deck.filter((card: any) => card.upgraded).length,
      },
      rivalRows: scene.routeChoicePreviewRows({
        key: 'challenge_rival', text: 'Take wager', effects: ['startRivalBattle'], locked: false,
      }),
    };
    }, kind);
    await scenarioPage.close();
    return result;
  };

  const result = {
    basin: await runScenario('basin'),
    signal: await runScenario('signal'),
    cache: await runScenario('cache'),
    nest: await runScenario('nest'),
  } as any;

  expect(result.basin.actual).toEqual(result.basin.projection);
  expect(result.basin.textPreview).toEqual(result.basin.preview);
  expect(result.basin.preview).toEqual(expect.arrayContaining([
    'COHESION 20/38 > 28/38',
    'SCRAP 200 > 180',
    'SUPPLIES 0/2 > 2/2',
    'SKY GUARD 0 > 1',
  ]));
  expect(result.signal.actual).toEqual(result.signal.projection);
  expect(result.signal.resolvedEffects).not.toContain('gainCacheReward()');
  expect(result.signal.preview).toEqual(expect.arrayContaining([
    'COHESION 30/38 > 28/38',
    'SCRAP 40 > 70',
    'DECK 3 > 4',
    'SUPPLIES 0/2 > 1/2',
    'WAYMARKS 1 > 2',
    'SKY GUARD 0 > 2',
    'OPEN SKY CUT 0 > 2',
  ]));
  expect(result.cache.actual).toEqual(result.cache.expected);
  expect(result.cache.preview).toEqual(expect.arrayContaining([
    'COHESION 24/38 > 21/38',
    'DECK 3 > 4',
    'SUPPLIES 0/2 > 1/2',
  ]));
  expect(result.nest.actual).toEqual(result.nest.projection);
  expect(result.nest.preview).toEqual(expect.arrayContaining([
    'COHESION 30/38 > 27/38',
    'SCRAP 220 > 90',
    'BOSS SHIELD 0 > 18',
    'SKY GUARD 0 > 2',
    'NEXT CHOOSE 2 CARDS TO PREEN',
  ]));
  expect(result.nest.picker).toEqual({ mode: 'preen', context: 'route', remaining: 2, upgraded: 0 });
  expect(result.nest.rivalRows).toEqual([expect.objectContaining({ label: 'Rival', before: 'Route', after: 'Battle' })]);
});

test('route Supply rewards offer two exact choices before packing one', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  const initial = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    game.scene.stop('MenuScene');
    const route: any = game.scene.getScene('RouteScene');
    for (let index = 0; index < 120 && !route.routeEssentialAssetsReady; index += 1) await wait(50);
    const basin = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'basin');
    route.openNodeChoices(basin);
    route.chooseNodeOption('refill_supplies');
    for (let index = 0; index < 120; index += 1) {
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      if (state.routeReward?.supplyChoices?.length === 2
        && state.routeReward?.inputFocus?.visible
        && route.children.list.filter((child: any) => child.name === 'route-supply-reward-hit').length === 2
        && document.getElementById('game-status')?.textContent?.includes('Route Supply choice')) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const choices = [...route.routeSupplyRewardChoices];
    const hits = route.children.list
      .filter((child: any) => child.name === 'route-supply-reward-hit')
      .map((child: any) => ({
        id: child.getData('supplyId'),
        width: child.displayWidth,
        height: child.displayHeight,
      }));
    const labels = route.children.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text);
    route.claimRouteReward();
    return {
      basinId: basin.id,
      choices,
      state,
      hits,
      labels,
      claimGuard: {
        pending: Boolean(route.pendingRouteReward),
        supplies: [...route.runState.supplies],
      },
      live: document.getElementById('game-status')?.textContent ?? '',
    };
  });

  expect(initial.choices).toHaveLength(2);
  expect(new Set(initial.choices).size).toBe(2);
  expect(initial.state.routeReward).toMatchObject({
    decisionPreview: expect.arrayContaining(['SUPPLIES 0/2 > 1/2']),
    supplyChoices: [
      expect.objectContaining({ id: initial.choices[0], name: expect.any(String), description: expect.any(String) }),
      expect.objectContaining({ id: initial.choices[1], name: expect.any(String), description: expect.any(String) }),
    ],
    inputFocus: expect.objectContaining({
      kind: 'supply',
      index: 0,
      supplyId: initial.choices[0],
      armed: false,
      commitBlockedUntilSelected: true,
      visible: true,
    }),
  });
  expect(initial.hits).toEqual([
    { id: initial.choices[0], width: 214, height: 284 },
    { id: initial.choices[1], width: 214, height: 284 },
  ]);
  expect(initial.labels).toEqual(expect.arrayContaining([
    'Choose a Supply',
    'Select this Supply',
    'Choose',
  ]));
  expect(initial.labels).toContain('Click a choice to select\nInspect reads without committing');
  expect(initial.claimGuard).toEqual({ pending: true, supplies: [] });
  expect(initial.live).toContain('Route Supply choice');
  await page.screenshot({ path: '.artifacts/test-results/route-supply-choice-1000x560.png' });

  const pointerArm = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const hit = route.children.list.find((child: any) => child.name === 'route-supply-reward-hit');
    hit.emit('pointerdown');
    return {
      armed: route.routeSupplyRewardArmedId,
      supplies: [...route.runState.supplies],
      pending: Boolean(route.pendingRouteReward),
    };
  });
  expect(pointerArm).toEqual({ armed: initial.choices[0], supplies: [], pending: true });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.routeSupplyRewardArmedId;
  })).toBeUndefined();

  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.routeSupplyRewardChoiceIndex;
  })).toBe(1);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return route.routeSupplyRewardArmedId;
  })).toBe(initial.choices[1]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return { pending: Boolean(route.pendingRouteReward), nodeChoiceOpen: route.nodeChoiceOpen, supplies: route.runState.supplies };
  })).toEqual({ pending: false, nodeChoiceOpen: true, supplies: [] });

  const reopened = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.chooseNodeOption('refill_supplies');
    for (let index = 0; index < 80 && route.routeSupplyRewardChoices.length !== 2; index += 1) await wait(50);
    return [...route.routeSupplyRewardChoices];
  });
  expect(reopened).toEqual(initial.choices);

  const controllerArm = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const module = route.routeRewardInteractionModule();
    const buttons = route.controllerButtonsDown;
    const pad = (patch: Record<string, boolean>) => ({
      left: false, right: false, up: false, down: false, A: false, B: false, Y: false,
      ...patch,
    });
    module.updateRouteRewardGamepad(route, pad({ right: true }), buttons);
    module.updateRouteRewardGamepad(route, pad({}), buttons);
    module.updateRouteRewardGamepad(route, pad({ A: true }), buttons);
    module.updateRouteRewardGamepad(route, pad({}), buttons);
    return {
      index: route.routeSupplyRewardChoiceIndex,
      armed: route.routeSupplyRewardArmedId,
      supplies: [...route.runState.supplies],
    };
  });
  expect(controllerArm).toEqual({ index: 1, armed: initial.choices[1], supplies: [] });

  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const module = route.routeRewardInteractionModule();
    const buttons = route.controllerButtonsDown;
    const released = { left: false, right: false, up: false, down: false, A: false, B: false, Y: false };
    module.updateRouteRewardGamepad(route, { ...released, A: true }, buttons);
    module.updateRouteRewardGamepad(route, released, buttons);
  });
  await expect.poll(() => page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    return {
      supplies: [...route.runState.supplies],
      pending: Boolean(route.pendingRouteReward),
      completed: route.runState.completedRouteNodeIds,
    };
  })).toEqual({ supplies: [initial.choices[1]], pending: false, completed: expect.arrayContaining([initial.basinId]) });
});

test('route maps render a distinct world backdrop for every district', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    const cases = [
      { mapIndex: 0, mapId: 'map_01_rooftop_blocks', assetKey: 'route-map-backdrop-rooftop-blocks' },
      { mapIndex: 1, mapId: 'map_02_canal_markets', assetKey: 'route-map-backdrop-canal-markets' },
      { mapIndex: 2, mapId: 'map_03_signal_spires', assetKey: 'route-map-backdrop-signal-spires' },
      { mapIndex: 3, mapId: 'map_04_high_roost', assetKey: 'route-map-backdrop-high-roost' },
    ];
    const states = [];
    for (const entry of cases) {
      await window.__birdSquadStartScene!('RouteScene', {
        runState: {
          deck: [{ id: 'major_00' }],
          leaderId: 'fledgling',
          difficulty: 0,
          seed: `district-backdrop-${entry.mapIndex}`,
          currentHp: 36,
          scrap: 40,
          routeMarks: [],
          supplies: [],
          mapIndex: entry.mapIndex,
          completedRouteNodeIds: [],
          currentRouteNodeId: undefined,
          routeLog: [],
          nextCombat: undefined,
          signalChoices: [],
          rewardEvents: [],
        }
      });
      g.scene.stop('MenuScene');
      let state: any;
      for (let i = 0; i < 100; i += 1) {
        state = JSON.parse(window.render_game_to_text!());
        if (state.routeMapBackdrop?.loaded && state.routeMapBackdrop?.rendered) break;
        await wait(50);
      }
      states.push({
        expected: entry,
        mapId: state.map?.id,
        backdrop: state.routeMapBackdrop,
      });
    }
    return states;
  });

  expect(result).toHaveLength(4);
  for (const state of result) {
    expect(state.mapId).toBe(state.expected.mapId);
    expect(state.backdrop).toEqual({
      assetKey: state.expected.assetKey,
      loaded: true,
      rendered: true,
    });
  }
  expect(new Set(result.map((state) => state.backdrop.assetKey)).size).toBe(4);
});

test('combat route choices expose concise authored encounter pressure before commitment', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const baseRunState = {
      deck: [{ id: 'major_00' }],
      leaderId: 'fledgling',
      difficulty: 0,
      currentHp: 36,
      scrap: 40,
      routeMarks: [],
      supplies: [],
      completedRouteNodeIds: [],
      currentRouteNodeId: undefined,
      routeLog: [],
      nextCombat: undefined,
      signalChoices: [],
      rewardEvents: [],
      districtContracts: [],
    };
    const knownCases = [
      ['enc_rooftop_rat_pack', 'medium', 'medium: 4 foes / enemy Cover'],
      ['enc_canal_toll_magpie', 'high', 'high: 1 foe / Snags / Open Sky'],
      ['enc_spire_static_callers', 'medium', 'medium: 2 foes / Winded / tempo loss'],
      ['enc_roost_cleanup_crew', 'high', 'high: 2 foes / Open Sky / enemy Cover'],
      ['enc_skunk_chemist', 'medium', 'medium: 1 foe / Snags / tempo loss'],
    ];
    const maps: any[] = [];
    let mappings: any[] = [];
    for (let mapIndex = 0; mapIndex < 4; mapIndex += 1) {
      const route: any = await window.__birdSquadStartScene!('RouteScene', {
        runState: {
          ...structuredClone(baseRunState),
          seed: `route-pressure-read-${mapIndex}`,
          mapIndex,
        },
      });
      for (let attempt = 0; attempt < 120; attempt += 1) {
        if (JSON.parse(window.render_game_to_text?.() ?? '{}').assetReadiness?.fullArt) break;
        await wait(50);
      }
      const contract = route.runState.districtContracts?.find((entry: any) => entry.mapIndex === mapIndex);
      if (contract) contract.confirmed = true;
      const map = window.__birdSquadCurrentMap!();
      const combatNodes = map.nodes.filter((node: any) => node.type === 'street' || node.type === 'rival');
      const selected = combatNodes[0];
      route.selectedNodeId = selected.id;
      route.renderAll();
      const position = route.nodePosition(selected);
      const tooltip: any = route.showNodeTooltip(selected, position.x, position.y - 60);
      // The live region polls every 300 ms and preserves direct announcements
      // for 1.8 seconds. Wait for this selection instead of sampling stale speech.
      const expectedRisk = `Risk: ${route.nodeDecisionSummary(selected).risk}.`;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (document.getElementById('game-status')?.textContent?.includes(expectedRisk)) break;
        await wait(50);
      }
      const state = JSON.parse(window.render_game_to_text!());
      const selectedState = state.nodes.find((node: any) => node.id === selected.id);
      const riskText: any = tooltip.getByName('route-node-risk');
      const frame: any = tooltip.getByName('route-node-tooltip-frame');
      const riskBounds = riskText.getBounds();
      const frameBounds = frame.getBounds();
      const guidance: any = route.children.list.find((child: any) => (
        (child.name === 'first-route-guidance' || child.name === 'route-decision-dock')
        && typeof child.text === 'string'
      ));
      if (mapIndex === 0) {
        const template = selected;
        mappings = knownCases.map(([payloadId, risk, expected]) => ({
          expected,
          actual: route.nodeDecisionSummary({ ...template, payloadId, risk, type: 'street' }).risk,
        }));
      }
      maps.push({
        mapId: map.id,
        risks: combatNodes.map((node: any) => route.nodeDecisionSummary(node).risk),
        selectedRisk: selectedState.decision.risk,
        riskText: riskText.text,
        guidance: guidance?.text ?? '',
        riskInsideFrame: riskBounds.left >= frameBounds.left
          && riskBounds.right <= frameBounds.right
          && riskBounds.bottom <= frameBounds.bottom,
        live: document.getElementById('game-status')?.textContent ?? '',
      });
    }
    return { mappings, maps };
  });

  expect(result.mappings.map((entry) => entry.actual)).toEqual(result.mappings.map((entry) => entry.expected));
  expect(result.maps).toHaveLength(4);
  for (const map of result.maps) {
    expect(map.risks.length).toBeGreaterThan(0);
    for (const risk of map.risks) {
      expect(risk).toMatch(/^(?:low|medium|high): /);
      expect(risk).not.toMatch(/(?:low pressure|medium damage risk|high pressure)/);
      expect(risk).not.toMatch(/\b(?:basic|elite|boss)\b/i);
    }
    expect(map.riskText).toBe(`RISK ${map.selectedRisk}`);
    expect(map.guidance).toContain(`RISK  ${map.selectedRisk}`);
    expect(map.riskInsideFrame).toBe(true);
    expect(map.live).toContain(`Risk: ${map.selectedRisk}.`);
  }
  await page.screenshot({ path: '.artifacts/test-results/route-encounter-pressure-high-roost-1000x560.png', fullPage: true });
});

test('route gains update from live Cohesion deck Scrap Supply and choice availability', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const route: any = await window.__birdSquadStartScene!('RouteScene', {
      runState: {
        deck: [{ id: 'major_00' }, { id: 'bad_directions' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'contextual-route-gains',
        currentHp: 20,
        scrap: 27,
        routeMarks: [],
        supplies: ['feather_splint'],
        supplySlots: 2,
        mapIndex: 0,
        completedRouteNodeIds: [],
        currentRouteNodeId: undefined,
        routeLog: [],
        nextCombat: undefined,
        signalChoices: [],
        rewardEvents: [],
        districtContracts: [],
      },
    });
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (JSON.parse(window.render_game_to_text?.() ?? '{}').assetReadiness?.fullArt) break;
      await wait(50);
    }
    const contract = route.runState.districtContracts?.find((entry: any) => entry.mapIndex === 0);
    if (contract) contract.confirmed = true;
    const map = window.__birdSquadCurrentMap!();
    const template = map.nodes[0];
    const nodeOfType = (type: string, payloadId = '') => map.nodes.find((node: any) => node.type === type) ?? {
      ...template,
      id: `context-${type}`,
      label: type,
      type,
      payloadId,
      risk: type === 'boss' ? 'boss' : 'low',
    };
    const nodes = {
      street: nodeOfType('street'),
      rival: nodeOfType('rival'),
      basin: nodeOfType('basin', 'basin_alpha'),
      nest: nodeOfType('nest', 'nest_alpha'),
      market: nodeOfType('market', 'alpha_market'),
      cache: nodeOfType('cache', 'alpha_rooftop_cache'),
      signal: nodeOfType('signal', 'faded_chalk_line'),
    };
    const maxHp = route.runMaxHp();
    route.runState.currentHp = maxHp - 5;
    const initial = Object.fromEntries(Object.entries(nodes).map(([type, node]) => [type, route.nodeDecisionSummary(node)]));
    const signalChoices = route.nodeChoiceList(nodes.signal).filter((choice: any) => choice.key !== 'decline');
    const signalAvailable = signalChoices.filter((choice: any) => !choice.locked).length;

    route.runState.currentHp = maxHp;
    const basinFull = route.nodeDecisionSummary(nodes.basin).benefit;
    route.runState.currentHp = maxHp - 5;
    route.runState.deck.push({ id: 'wands_ace' });
    route.runState.scrap = 81;
    route.runState.supplies.push('seed_packet');
    const updated = {
      street: route.nodeDecisionSummary(nodes.street),
      nest: route.nodeDecisionSummary(nodes.nest),
      market: route.nodeDecisionSummary(nodes.market),
      cache: route.nodeDecisionSummary(nodes.cache),
    };

    route.runState.deck.pop();
    route.runState.scrap = 27;
    route.runState.supplies.pop();
    route.selectedNodeId = nodes.basin.id;
    route.renderAll();
    const position = route.nodePosition(nodes.basin);
    const tooltip: any = route.showNodeTooltip(nodes.basin, position.x, position.y - 60);
    await wait(150);
    const state = JSON.parse(window.render_game_to_text!());
    const selected = state.nodes.find((node: any) => node.id === nodes.basin.id);
    const guidance: any = route.children.list.find((child: any) => (
      (child.name === 'first-route-guidance' || child.name === 'route-decision-dock')
      && typeof child.text === 'string'
    ));
    const gain: any = tooltip.getByName('route-node-gain');
    const frame: any = tooltip.getByName('route-node-tooltip-frame');
    const gainBounds = gain.getBounds();
    const frameBounds = frame.getBounds();
    return {
      maxHp,
      initial,
      updated,
      basinFull,
      signalAvailable,
      signalTotal: signalChoices.length,
      selected: selected?.decision,
      guidance: guidance?.text ?? '',
      gainText: gain.text,
      gainInsideFrame: gainBounds.left >= frameBounds.left
        && gainBounds.right <= frameBounds.right
        && gainBounds.bottom <= frameBounds.bottom,
      live: document.getElementById('game-status')?.textContent ?? '',
    };
  });

  expect(result.initial.street.benefit).toBe('Card + Scrap; deck 2');
  expect(result.initial.rival.benefit).toBe('Rare draft + Waymark chance; deck 2');
  expect(result.initial.basin.benefit).toBe(`Heal 5/8 Cohesion (${result.maxHp - 5} > ${result.maxHp})`);
  expect(result.basinFull).toBe('Healing 0/8; Cohesion full');
  expect(result.initial.nest.benefit).toBe('1 Preen target; 27 Scrap');
  expect(result.initial.market.benefit).toBe('Shop with 27 Scrap; deck 2');
  expect(result.initial.cache.benefit).toBe('Reward choice; 1 Supply slot open');
  expect(result.initial.signal.benefit).toBe(`${result.signalAvailable}/${result.signalTotal} Signal choices available`);
  expect(result.updated.street.benefit).toBe('Card + Scrap; deck 3');
  expect(result.updated.nest.benefit).toBe('2 Preen targets; 81 Scrap');
  expect(result.updated.market.benefit).toBe('Shop with 81 Scrap; deck 3');
  expect(result.updated.cache.benefit).toBe('Reward choice; 0 Supply slots open');
  expect(result.selected.benefit).toBe(result.initial.basin.benefit);
  expect(result.guidance).toContain(`GAIN  ${result.initial.basin.benefit}`);
  expect(result.gainText).toBe(`GAIN ${result.initial.basin.benefit}`);
  expect(result.gainInsideFrame).toBe(true);
  await expect(page.locator('#game-status')).toContainText(`Gain: ${result.initial.basin.benefit}.`);
  await page.screenshot({ path: '.artifacts/test-results/contextual-route-gain-basin-1000x560.png', fullPage: true });
});

test('balance economy Waymarks resolve through generic trigger/effect hooks', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const map = window.__birdSquadCurrentMap!();
    const nodeOfType = (type: string) => map.nodes.find((node: any) => node.type === type) ?? {
      id: `economy-${type}`,
      type,
      label: type,
      payloadId: '',
      risk: 'low',
      column: 0,
      lane: 0,
      revealed: true,
      completed: false
    };
    const cache = nodeOfType('cache');
    const basin = nodeOfType('basin');
    const signal = nodeOfType('signal');

    scene.runState.routeMarks = ['cache_hook', 'roofline_compass'];
    const cacheChoices = scene.nodeChoiceList(cache).length;

    scene.runState.currentHp = 20;
    scene.runState.nextCombat = undefined;
    scene.runState.routeMarks = ['rain_gutter', 'blue_cup_token'];
    scene.applyRouteNodeReward(basin);
    const hpAfterBasin = scene.runState.currentHp;
    const guardAfterBasin = scene.runState.nextCombat?.openSkyGuard ?? 0;

    scene.runState.scrap = 0;
    scene.runState.routeMarks = ['wire_map', 'market_tally_string'];
    scene.applyRouteNodeReward(signal);
    const scrapAfterSignal = scene.runState.scrap;
    const planAfterSignal = scene.runState.routeLog.some((line: string) => /Route plan set/.test(line));

    scene.runState.scrap = 0;
    scene.runState.nextCombat = {};
    scene.runState.routeMarks = ['patched_harness'];
    scene.applyRouteMarkTrigger('afterMarketPurchase');
    const harness = {
      scrap: scene.runState.scrap,
      guard: scene.runState.nextCombat?.openSkyGuard ?? 0,
    };

    return { cacheChoices, hpAfterBasin, guardAfterBasin, scrapAfterSignal, planAfterSignal, harness };
  });
  expect(result.cacheChoices).toBe(7);
  expect(result.hpAfterBasin).toBe(37);      // base 8 + Rain Gutter 4 + Blue Cup Token 5
  expect(result.guardAfterBasin).toBe(3);
  expect(result.scrapAfterSignal).toBe(25);  // Wire Map 10 + Market Tally String 15
  expect(result.planAfterSignal).toBe(true);
  expect(result.harness).toEqual({ scrap: 10, guard: 2 });
});

test('clearing a district boss advances the run to the next district', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    // returnToRouteMap on a non-final boss advances mapIndex and starts the
    // next district's RouteScene (next-level multi-map progression).
    battle.returnToRouteMap();
    const route: any = g.scene.getScene('RouteScene');
    let textState: any = {};
    const start = Date.now();
    while (Date.now() - start < 5000) {
      try {
        textState = JSON.parse(window.render_game_to_text?.() ?? '{}');
      } catch {
        textState = {};
      }
      if (route.runState?.mapIndex === 1
        && textState.districtAdvanceFlourish?.rendered
        && textState.districtAdvanceTitlePlaque?.rendered) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    // Asset callbacks can redraw RouteScene immediately after the one-shot
    // district celebration begins. The active flourish must survive that rebuild.
    route.renderAll();
    try {
      textState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    } catch {
      textState = {};
    }
    const selectable = (route.getSelectableNodes?.() ?? []).map((n: any) => n.id);
    const flourishObjects = route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-district-advance-flourish' || child.name === 'district-advance-flourish')
      .length;
    const titlePlaqueObjects = route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-district-advance-title-plaque')
      .length;
    return {
      mapIndex: route.runState?.mapIndex,
      selectable,
      districtAdvanceFlourish: textState.districtAdvanceFlourish,
      districtAdvanceTitlePlaque: textState.districtAdvanceTitlePlaque,
      flourishObjects,
      titlePlaqueObjects,
      persistedNotice: route.runState?.districtAdvanceNotice
    };
  });
  expect(result.mapIndex).toBe(1);
  // The second district's nodes are namespaced m2_*; the run is now on Canal Markets.
  expect(result.selectable.length).toBeGreaterThan(0);
  for (const id of result.selectable) expect(id.startsWith('m2_')).toBe(true);
  expect(result.districtAdvanceFlourish).toMatchObject({
    loaded: true,
    rendered: true,
    bursts: 1,
    notice: {
      fromMapName: 'Rooftop Blocks',
      toMapName: 'Canal Markets',
      toMapIndex: 2
    }
  });
  expect(result.districtAdvanceFlourish.count).toBeGreaterThanOrEqual(6);
  expect(result.flourishObjects).toBeGreaterThanOrEqual(6);
  expect(result.districtAdvanceTitlePlaque).toMatchObject({
    loaded: true,
    rendered: true,
    count: 1,
    notice: {
      fromMapName: 'Rooftop Blocks',
      toMapName: 'Canal Markets',
      toMapIndex: 2
    }
  });
  expect(result.titlePlaqueObjects).toBe(1);
  expect(result.persistedNotice).toBeUndefined();
});

test('Quick Flight skips the long middle district and restores the flyway visibly', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    battle.runMode = 'quick';
    battle.returnToRouteMap();
    const route: any = g.scene.getScene('RouteScene');
    let state: any = {};
    const started = Date.now();
    while (Date.now() - started < 5000) {
      state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      if (route.runState?.mapIndex === 2 && state.flywayRestoration?.rendered) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return {
      runMode: route.runState.runMode,
      mapIndex: route.runState.mapIndex,
      nodeIds: route.getSelectableNodes().map((node: any) => node.id),
      banner: state.districtBanner,
      restoration: state.flywayRestoration,
      restorationObjects: route.children.list.filter((child: any) => child.name === 'flyway-restoration').length
    };
  });

  expect(result.runMode).toBe('quick');
  expect(result.mapIndex).toBe(2);
  expect(result.nodeIds.every((id: string) => id.startsWith('m3_'))).toBe(true);
  expect(result.banner).toMatchObject({ district: 2, districtCount: 3 });
  expect(result.restoration).toMatchObject({ restoredSegments: 1, totalSegments: 3, rendered: true });
  expect(result.restorationObjects).toBeGreaterThan(2);
});

test('routes are procedurally generated: larger, branching, fully connected', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {
      runState: {
        deck: [{ id: 'major_00' }], leaderId: 'fledgling', difficulty: 0, seed: 'testseed-xyz', currentHp: 36,
        scrap: 0, routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [], currentRouteNodeId: undefined,
        routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
      },
    });
    g.scene.stop('MenuScene');
    const map = window.__birdSquadCurrentMap!();
    const adj = new Map<string, string[]>();
    map.edges.forEach((e: any) => { if (!adj.has(e.from)) adj.set(e.from, []); adj.get(e.from)!.push(e.to); });
    const seen = new Set<string>([map.entryNodeId]);
    const stack = [map.entryNodeId];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const next of adj.get(cur) ?? []) if (!seen.has(next)) { seen.add(next); stack.push(next); }
    }
    // branching: at least some node has 2+ outgoing edges
    const branching = [...adj.values()].some((outs) => new Set(outs).size >= 2);
    return {
      nodeCount: map.nodes.length,
      typeCount: new Set(map.nodes.map((n: any) => n.type)).size,
      reachesBoss: seen.has(map.bossNodeId),
      allReachable: map.nodes.every((n: any) => seen.has(n.id)),
      branching,
      entry: map.entryNodeId,
      boss: map.bossNodeId,
    };
  });
  expect(r.nodeCount).toBeGreaterThanOrEqual(16); // bigger than the old ~14-node hand-authored maps
  expect(r.typeCount).toBeGreaterThanOrEqual(7); // variety of node types
  expect(r.reachesBoss).toBe(true);
  expect(r.allReachable).toBe(true); // no stranded nodes
  expect(r.branching).toBe(true); // multiple paths
  expect(r.entry).toBe('m1_entry');
  expect(r.boss).toBe('m1_boss');
});

test('procedural routes satisfy fairness rules and remain varied across 1024 seeded districts', async ({ page }) => {
  await boot(page);
  const report = await page.evaluate(() => {
    const [
      routeBlueprints,
      generateRouteMap,
      hashSeed,
      getMapBalanceProfile,
    ] = window.__routeAudit!;
    const samplesPerMap = 256;
    const combatTypes = new Set(['street', 'rival']);
    const safetyTypes = new Set(['basin', 'nest']);
    const buildTypes = new Set(['cache', 'market', 'signal', 'nest']);
    const maps = [];

    for (const blueprint of routeBlueprints) {
      const balance = getMapBalanceProfile(blueprint.id, blueprint.index).routeGeneration;
      const signatures = new Set<string>();
      const pathSignatures = new Set<string>();
      const streetPayloads = new Set<string>();
      const rivalPayloads = new Set<string>();
      const violations: string[] = [];
      let minNodeCount = Infinity;
      let maxNodeCount = 0;
      let minPathCount = Infinity;
      let maxPathCount = 0;

      for (let sample = 0; sample < samplesPerMap; sample += 1) {
        const seed = hashSeed(`route-fairness-${sample}`, blueprint.index);
        const map = generateRouteMap(blueprint, seed);
        const repeated = sample < 4 ? generateRouteMap(blueprint, seed) : undefined;
        if (repeated && JSON.stringify(map) !== JSON.stringify(repeated)) {
          violations.push(`seed ${sample}: non-deterministic output`);
        }
        minNodeCount = Math.min(minNodeCount, map.nodes.length);
        maxNodeCount = Math.max(maxNodeCount, map.nodes.length);
        const byId = new Map(map.nodes.map((node) => [node.id, node]));
        const outgoing = new Map<string, string[]>();
        const incoming = new Map<string, string[]>();
        for (const edge of map.edges.filter((candidate) => !candidate.locked)) {
          outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
          incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge.from]);
        }

        const forward = new Set<string>([map.entryNodeId]);
        const forwardStack = [map.entryNodeId];
        while (forwardStack.length) {
          const current = forwardStack.pop()!;
          for (const next of outgoing.get(current) ?? []) {
            if (forward.has(next)) continue;
            forward.add(next);
            forwardStack.push(next);
          }
        }
        const reverse = new Set<string>([map.bossNodeId]);
        const reverseStack = [map.bossNodeId];
        while (reverseStack.length) {
          const current = reverseStack.pop()!;
          for (const previous of incoming.get(current) ?? []) {
            if (reverse.has(previous)) continue;
            reverse.add(previous);
            reverseStack.push(previous);
          }
        }
        if (map.nodes.some((node) => !forward.has(node.id))) violations.push(`seed ${sample}: unreachable node`);
        if (map.nodes.some((node) => !reverse.has(node.id))) violations.push(`seed ${sample}: node cannot reach boss`);
        if (map.nodes.some((node) => node.id !== map.entryNodeId && !(incoming.get(node.id)?.length))) {
          violations.push(`seed ${sample}: missing incoming edge`);
        }
        if (map.nodes.some((node) => node.id !== map.bossNodeId && !(outgoing.get(node.id)?.length))) {
          violations.push(`seed ${sample}: missing outgoing edge`);
        }
        if (![...(outgoing.values())].some((targets) => new Set(targets).size >= 2)) {
          violations.push(`seed ${sample}: no meaningful branch`);
        }
        for (const targets of outgoing.values()) {
          const targetNodes = targets.map((id) => byId.get(id)).filter(Boolean);
          if (targetNodes.length > 0 && targetNodes.every((node) => node?.type === 'rival')) {
            violations.push(`seed ${sample}: forced rival path`);
            break;
          }
        }

        const paths: string[][] = [];
        const stack: string[][] = [[map.entryNodeId]];
        while (stack.length && paths.length < 5000) {
          const path = stack.pop()!;
          const current = path.at(-1)!;
          if (current === map.bossNodeId) {
            paths.push(path);
            continue;
          }
          for (const next of outgoing.get(current) ?? []) {
            if (!path.includes(next)) stack.push([...path, next]);
          }
        }
        minPathCount = Math.min(minPathCount, paths.length);
        maxPathCount = Math.max(maxPathCount, paths.length);
        if (paths.length < 2 || paths.length >= 5000) violations.push(`seed ${sample}: invalid path count ${paths.length}`);

        const middleColumns = map.columns.length - 2;
        const safetyColumnLimit = Math.max(
          1,
          Math.floor(middleColumns * (balance.pathRules?.minSafetyBeforeColumnPct ?? 0.7)),
        );
        const maxCombat = balance.pathRules?.maxConsecutiveCombat ?? 2;
        const minSafety = balance.pathRules?.minSafetyBeforeBoss ?? 1;
        const minBuild = balance.pathRules?.minBuildBeforeBoss ?? 1;
        const maxPressure = balance.pathRules?.maxPressureScore ?? Math.max(4, middleColumns - 2);
        for (const pathIds of paths) {
          const path = pathIds.map((id) => byId.get(id)!).filter(Boolean);
          const routeNodes = path.filter((node) => node.column >= 1 && node.column <= middleColumns);
          let consecutiveCombat = 0;
          let worstCombat = 0;
          let pressure = 0;
          for (const node of path) {
            if (combatTypes.has(node.type)) {
              consecutiveCombat += 1;
              worstCombat = Math.max(worstCombat, consecutiveCombat);
            } else if (node.type !== 'boss') {
              consecutiveCombat = 0;
            }
            if (node.type === 'rival') pressure += 2;
            else if (node.type === 'street') pressure += 1;
            else if (safetyTypes.has(node.type)) pressure -= 1;
          }
          const safety = routeNodes.filter((node) => (
            node.column <= safetyColumnLimit && safetyTypes.has(node.type)
          )).length;
          const build = routeNodes.filter((node) => buildTypes.has(node.type)).length;
          if (worstCombat > maxCombat) violations.push(`seed ${sample}: ${worstCombat} consecutive combats`);
          if (safety < minSafety) violations.push(`seed ${sample}: no timely safety node`);
          if (build < minBuild) violations.push(`seed ${sample}: no build node`);
          if (pressure > maxPressure) violations.push(`seed ${sample}: pressure ${pressure} > ${maxPressure}`);
          pathSignatures.add(path.map((node) => node.type).join('>'));
        }

        map.nodes.forEach((node) => {
          if (node.type === 'street' && node.payloadId !== blueprint.entryEncounterId) streetPayloads.add(node.payloadId);
          if (node.type === 'rival') rivalPayloads.add(node.payloadId);
        });
        signatures.add(JSON.stringify({
          columns: map.columns.map((column) => column.length),
          nodes: map.nodes.map((node) => [node.column, node.lane, node.type, node.payloadId]),
          edges: map.edges.map((edge) => [edge.from, edge.to]),
        }));
      }

      maps.push({
        id: blueprint.id,
        violations: violations.slice(0, 20),
        uniqueMaps: signatures.size,
        uniquePathPatterns: pathSignatures.size,
        streetPayloads: streetPayloads.size,
        streetPool: blueprint.streetEncounterIds.filter((id) => id !== blueprint.entryEncounterId).length,
        rivalPayloads: rivalPayloads.size,
        rivalPool: blueprint.rivalEncounterIds.length,
        minNodeCount,
        maxNodeCount,
        minPathCount,
        maxPathCount,
      });
    }
    return { samplesPerMap, maps };
  });

  await test.info().attach('procedural-route-fairness-report', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json',
  });
  expect(report.samplesPerMap).toBe(256);
  for (const map of report.maps) {
    expect(map.violations, `${map.id} fairness violations`).toEqual([]);
    expect(map.uniqueMaps, `${map.id} unique generated maps`).toBeGreaterThanOrEqual(220);
    expect(map.uniquePathPatterns, `${map.id} route-type patterns`).toBeGreaterThanOrEqual(12);
    expect(map.streetPayloads, `${map.id} street encounter coverage`).toBe(map.streetPool);
    expect(map.rivalPayloads, `${map.id} rival encounter coverage`).toBe(map.rivalPool);
    expect(map.minNodeCount).toBeGreaterThanOrEqual(16);
    expect(map.maxNodeCount).toBeGreaterThan(map.minNodeCount);
    expect(map.minPathCount).toBeGreaterThanOrEqual(2);
    expect(map.maxPathCount).toBeGreaterThan(map.minPathCount);
  }
});

test('the route map exposes a Flock view (flock examinable between fights)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    route.openFlockOverlay();
    const opened = route.flockOverlayOpen;
    route.input.keyboard.emit('keydown-ESC'); // Esc closes it
    return { opened, closed: route.flockOverlayOpen, active: g.scene.getScenes(true).map((s: any) => s.scene.key) };
  });
  expect(r.opened).toBe(true);
  expect(r.closed).toBe(false);
  expect(r.active).toContain('RouteScene'); // overlay, not a scene change
});

test('route map exposes boss prep readiness before the final crossing', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 160; i += 1) {
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      if (state.assetReadiness?.fullArt) break;
      await wait(50);
    }
    route.selectedNodeId = window.__birdSquadCurrentMap!().bossNodeId;
    route.renderAll();
    const texts = route.children.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
    const state = JSON.parse(window.render_game_to_text!());
    const dossierRendered = route.children.list.some((child: any) => child.texture?.key === 'ui-icon-boss-prep-dossier-flourish');
    const chipFrameCount = route.children.list.filter((child: any) => child.texture?.key === 'ui-icon-boss-prep-readiness-chip-frame').length;
    const pressurePlaqueCount = route.children.list.filter((child: any) => child.texture?.key === 'ui-icon-boss-prep-pressure-plaque').length;
    const signalModuleCount = route.children.list.filter((child: any) => child.texture?.key === 'ui-icon-boss-prep-signal-module').length;
    const routeForPlateCount = route.children.list.filter((child: any) => child.texture?.key === 'ui-icon-boss-prep-route-for-plate').length;
    const dossierBounds = route.children.getByName('boss-prep-dossier-backplate')?.getBounds();
    return {
      ...state.bossPrep,
      bossPrepDossier: state.bossPrepDossier,
      bossPrepReadinessChipFrame: state.bossPrepReadinessChipFrame,
      bossPrepPressurePlaque: state.bossPrepPressurePlaque,
      bossPrepSignalModule: state.bossPrepSignalModule,
      bossPrepRouteForPlate: state.bossPrepRouteForPlate,
      dossierRendered,
      chipFrameCount,
      pressurePlaqueCount,
      signalModuleCount,
      routeForPlateCount,
      visiblePressure: route.children.getByName('boss-prep-pressure')?.text,
      openTarget: route.children.getByName('boss-prep-open')?.getBounds().height,
      dossierBounds: dossierBounds ? {
        left: dossierBounds.left,
        top: dossierBounds.top,
        right: dossierBounds.right,
        bottom: dossierBounds.bottom,
      } : null,
      hasBossPrepState: Boolean(state.bossPrep),
      hasInspectorSummary: !!route.children.getByName('boss-prep-open'),
      phaseThresholdRendered: texts.some((text: string) => text.includes('Phase II at 50%'))
    };
  });
  expect(r.bossName).toBeTruthy();
  expect(r.pressure).toContain('cover');
  expect(r.phaseHint).toContain('Phase II at 50%');
  expect(r.phaseHint).toContain('opens with');
  expect(r.phaseThresholdRendered).toBe(true);
  expect(['low', 'steady', 'strong']).toContain(r.readiness.cover);
  expect(Array.isArray(r.usefulNodes)).toBe(true);
  expect(new Set(r.usefulNodes).size).toBe(r.usefulNodes.length);
  expect(r.visiblePressure).toBe('Phase II at 50% · Review before crossing');
  expect(r.openTarget).toBe(58);
  expect(r.dossierBounds).toEqual({ left: 92, top: 642, right: 880, bottom: 700 });
  expect(r.hasBossPrepState).toBe(true);
  expect(r.flourishLoaded).toBe(true);
  expect(r.bossPrepDossier.loaded).toBe(true);
  expect(r.bossPrepDossier.rendered).toBe(false);
  expect(r.bossPrepReadinessChipFrame.loaded).toBe(true);
  expect(r.bossPrepReadinessChipFrame.rendered).toBe(false);
  expect(r.bossPrepReadinessChipFrame.count).toBe(0);
  expect(r.chipFrameCount).toBe(0);
  expect(r.bossPrepPressurePlaque.loaded).toBe(true);
  expect(r.bossPrepPressurePlaque.rendered).toBe(false);
  expect(r.bossPrepPressurePlaque.count).toBe(0);
  expect(r.pressurePlaqueCount).toBe(0);
  expect(r.bossPrepSignalModule.loaded).toBe(true);
  expect(r.bossPrepSignalModule.rendered).toBe(false);
  expect(r.bossPrepSignalModule.count).toBe(0);
  expect(r.signalModuleCount).toBe(0);
  expect(r.bossPrepRouteForPlate.loaded).toBe(true);
  expect(r.bossPrepRouteForPlate.rendered).toBe(false);
  expect(r.bossPrepRouteForPlate.count).toBe(0);
  expect(r.routeForPlateCount).toBe(0);
  expect(r.dossierRendered).toBe(false);
  expect(r.hasInspectorSummary).toBe(true);
  await page.screenshot({ path: '.artifacts/test-results/boss-prep-dossier-current-1000x560.png', fullPage: true });
});

test('boss prep footer fits every district boss name and complete pressure set', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  const baseRunState = await page.evaluate(async () => {
    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    return structuredClone(route.runState);
  });
  const expectedBosses = [
    { name: 'The Tar-Crowned Crow', test: 'Cover', compactTest: 'Cover', hint: 'Build Cover' },
    { name: 'The Canal Gatekeeper', test: 'recovery', compactTest: 'recovery', hint: 'Thin the dock escorts' },
    { name: 'The Beacon-Breaker', test: 'tempo', compactTest: 'tempo', hint: 'Cover the charged broadcast' },
    { name: 'The Roost Warden', test: 'full Flock build', compactTest: 'full build', hint: 'Stockpile Cover' },
  ];

  for (let mapIndex = 0; mapIndex < expectedBosses.length; mapIndex += 1) {
    const result = await page.evaluate(async ({ base, index }) => {
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const runState = {
        ...structuredClone(base),
        seed: `boss-prep-layout-${index}`,
        mapIndex: index,
        completedRouteNodeIds: [],
        currentRouteNodeId: undefined,
        districtContracts: [],
      };
      const route: any = await window.__birdSquadStartScene!('RouteScene', { runState });
      for (let attempt = 0; attempt < 160; attempt += 1) {
        if (JSON.parse(window.render_game_to_text?.() ?? '{}').assetReadiness?.fullArt) break;
        await wait(50);
      }
      const contract = route.runState.districtContracts?.find((candidate: any) => candidate.mapIndex === index);
      if (contract) contract.confirmed = true;
      route.selectedNodeId = window.__birdSquadCurrentMap!().bossNodeId;
      route.renderAll();
      const bossNode = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.id === window.__birdSquadCurrentMap!().bossNodeId);
      const bossPosition = route.nodePosition(bossNode);
      const tooltip: any = route.showNodeTooltip(bossNode, bossPosition.x, bossPosition.y - 78);
      // Observe the current district after the live-region poll/direct-speech hold.
      const expectedAnnouncement = `Boss prep for ${route.children.getByName('boss-prep-name').text}`;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (document.getElementById('game-status')?.textContent?.includes(expectedAnnouncement)) break;
        await wait(50);
      }
      const name: any = route.children.getByName('boss-prep-name');
      const pressure: any = route.children.getByName('boss-prep-pressure');
      const backplate: any = route.children.getByName('boss-prep-dossier-backplate');
      const plan: any = tooltip.getByName('route-boss-prep-plan');
      const testRead: any = tooltip.getByName('route-boss-prep-test');
      const tooltipFrame: any = tooltip.getByName('route-node-tooltip-frame');
      const pressureLines: string[] = pressure.getWrappedText(pressure.text);
      const resolution = pressure.resolution || 1;
      const state = JSON.parse(window.render_game_to_text!());
      const bossState = state.nodes.find((node: any) => node.type === 'boss');
      const planBounds = plan.getBounds();
      const tooltipBounds = tooltipFrame.getBounds();
      return {
        bossName: name.text,
        nameNaturalWidth: name.context.measureText(name.text).width / (name.resolution || 1),
        pressure: pressure.text,
        pressureLines,
        widestPressureLine: Math.max(...pressureLines.map((line) => pressure.context.measureText(line).width / resolution)),
        pressureBottom: pressure.getBounds().bottom,
        backplateBottom: backplate.getBounds().bottom,
        primaryTests: state.bossPrep.primaryTests,
        strategyHints: state.bossPrep.strategyHints,
        nodeBossPrep: route.nodeDetail(bossNode).bossPrep,
        decisionRisk: bossState.decision.risk,
        testRead: testRead.text,
        plan: plan.text,
        planLines: plan.getWrappedText(plan.text),
        planInsideFrame: planBounds.left >= tooltipBounds.left
          && planBounds.right <= tooltipBounds.right
          && planBounds.bottom <= tooltipBounds.bottom,
        live: document.getElementById('game-status')?.textContent ?? '',
      };
    }, { base: baseRunState, index: mapIndex });

    const expected = expectedBosses[mapIndex];
    expect(result.bossName).toBe(expected.name);
    expect(result.nameNaturalWidth).toBeLessThanOrEqual(550);
    expect(result.pressure).not.toContain('openSky');
    expect(result.pressureLines.length).toBeGreaterThanOrEqual(1);
    expect(result.pressureLines.length).toBeLessThanOrEqual(2);
    expect(result.widestPressureLine).toBeLessThanOrEqual(550);
    expect(result.pressureBottom).toBeLessThanOrEqual(result.backplateBottom);
    expect(result.primaryTests).toContain(expected.test);
    expect(result.strategyHints[0]).toContain(expected.hint);
    expect(result.nodeBossPrep.tests).toEqual(result.primaryTests);
    expect(result.nodeBossPrep.hints).toEqual(result.strategyHints);
    expect(result.decisionRisk).toContain(expected.compactTest);
    expect(result.testRead).toContain(`TEST ${expected.compactTest}`);
    expect(result.plan).toContain(expected.hint);
    expect(result.planLines.length).toBeLessThanOrEqual(3);
    expect(result.planInsideFrame).toBe(true);
    expect(result.live).toContain(`Boss prep for ${expected.name}`);
    expect(result.live).toContain(expected.test);
    expect(result.live).toContain(expected.hint);
    await page.screenshot({
      path: `.artifacts/test-results/boss-prep-profile-${mapIndex + 1}-1000x560.png`,
      fullPage: true,
    });
  }
});

test('waymark artifact drawer renders found item art and complete readable rules', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !window.__birdSquadState?.()?.hand?.length; i += 1) await wait(50);
    scene.routeMarks = ['chalk_wingmark', 'rooftop_shortcut', 'wire_map', 'crowbar_debt', 'rain_gutter'];
    scene.waymarkDrawerOpen = true;
    scene.renderAll();
    for (
      let i = 0;
      i < 40 && (!scene.waymarkReviewModule || !scene.routeMarks.every((id: string) => scene.textures.exists(`waymark-thumb-${id}`)));
      i += 1
    ) await wait(100);
    scene.renderAll();
    const texts: string[] = [];
    const walk = (obj: any) => {
      if (!obj) return;
      if (obj.type === 'Text') texts.push(obj.text || '');
      if (Array.isArray(obj.list)) obj.list.forEach(walk);
    };
    scene.children.list.forEach(walk);
    const state = window.__birdSquadState!();
    return {
      drawerOpen: state.waymarkDrawerOpen,
      carried: state.route.routeMarks,
      hasIconTexture: scene.textures.exists('waymark-thumb-chalk_wingmark'),
      hasAllIconTextures: scene.routeMarks.every((id: string) => scene.textures.exists(`waymark-thumb-${id}`)),
      hasDrawerTitle: texts.includes('Found Waymarks'),
      hasArtifactName: texts.includes('Chalk Wingmark')
    };
  });
  expect(r.drawerOpen).toBe(true);
  expect(r.carried).toContain('chalk_wingmark');
  expect(r.hasIconTexture).toBe(true);
  expect(r.hasAllIconTextures).toBe(true);
  expect(r.hasDrawerTitle).toBe(true);
  expect(r.hasArtifactName).toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.artifacts/test-results/waymark-artifact-drawer.png' });
  const reading = () => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').getTextState().waymarkReview.reading);
  expect((await reading()).bodies.join(' ')).toContain('Gain 3 Cover');
  await page.keyboard.press('PageDown');
  await expect.poll(async () => (await reading()).page).toBe(2);
  expect((await reading()).bodies.join(' ')).toContain('First enemy Cover break each turn');
  await page.keyboard.press('PageDown');
  await expect.poll(async () => (await reading()).page).toBe(3);
  expect((await reading()).bodies.join(' ')).toContain('The first time enemy Cover is broken each turn');
  await page.screenshot({ path: '.artifacts/test-results/waymark-artifact-reader.png' });
});

test('route HUD Waymarks chip opens found Waymarks drawer', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {
      runState: {
        deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'cups_ace' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'route-waymarks-hud',
        currentHp: 36,
        scrap: 40,
        routeMarks: ['chalk_wingmark', 'wire_map', 'rain_gutter'],
        supplies: [],
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
      }
    });
    g.scene.stop('MenuScene');
  });
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).scene === 'RouteScene');
  await page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const chip = scene.children.getByName('hud-waymarks-chip');
    if (!chip) throw new Error('Route Waymarks HUD chip was not rendered.');
    chip.emit('pointerdown');
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text!()).waymarkDrawerOpen === true);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const scene: any = g.scene.getScene('RouteScene');
    for (
      let i = 0;
      i < 40 && !['chalk_wingmark', 'wire_map', 'rain_gutter'].every((id) => scene.textures.exists(`waymark-thumb-${id}`));
      i += 1
    ) await wait(100);
    scene.renderAll();
    const texts: string[] = [];
    const walk = (obj: any) => {
      if (!obj) return;
      if (obj.type === 'Text') texts.push(obj.text || '');
      if (Array.isArray(obj.list)) obj.list.forEach(walk);
    };
    scene.children.list.forEach(walk);
    return {
      state: JSON.parse(window.render_game_to_text!()),
      hasAllIconTextures: ['chalk_wingmark', 'wire_map', 'rain_gutter'].every((id) => scene.textures.exists(`waymark-thumb-${id}`)),
      hasDrawerTitle: texts.includes('Found Waymarks'),
      hasChalk: texts.includes('Chalk Wingmark'),
      hasWire: texts.includes('Wire Map'),
      hasRain: texts.includes('Rain Gutter')
    };
  });
  expect(result.state.waymarkDrawerOpen).toBe(true);
  expect(result.state.run.routeMarks).toEqual(['chalk_wingmark', 'wire_map', 'rain_gutter']);
  expect(result.hasAllIconTextures).toBe(true);
  expect(result.hasDrawerTitle).toBe(true);
  expect(result.hasChalk).toBe(true);
  expect(result.hasWire).toBe(true);
  expect(result.hasRain).toBe(true);
  await page.screenshot({ path: '.artifacts/test-results/route-hud-waymarks-drawer.png' });
});

test('route Waymark review exposes trigger order and pinned comparison across inputs', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);
  await page.evaluate(async () => {
    await window.__birdSquadStartScene!('RouteScene', {
      runState: {
        deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'cups_ace' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'route-waymark-review',
        currentHp: 36,
        scrap: 40,
        routeMarks: ['chalk_wingmark', 'wire_map', 'rain_gutter', 'rooftop_shortcut'],
        supplies: [],
        mapIndex: 0,
        completedRouteNodeIds: [],
        currentRouteNodeId: undefined,
        routeLog: [],
        nextCombat: undefined,
        signalChoices: [],
        rewardEvents: [],
        suppliesUsed: [],
        combatResults: [],
        freePreenNextDistrict: 0,
      },
    });
    window.__birdSquadGame.scene.stop('MenuScene');
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.openWaymarkDrawer();
  });

  await expect.poll(async () => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text!());
    return state.waymarkReview?.renderer?.loaded;
  })).toBe(true);

  const initial = await page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text!());
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const pin = route.children.getByName('route-waymark-pin-hit');
    return {
      review: state.waymarkReview,
      pinTarget: pin ? { width: pin.displayWidth, height: pin.displayHeight } : undefined,
      panelCount: route.children.list.filter((child: any) => child.name === 'route-waymark-review-panel').length,
      orderedRows: route.children.getByName('route-waymark-reader-body')?.text.match(/^\d+\./gm)?.length ?? 0,
    };
  });

  expect(initial.review).toMatchObject({
    open: true,
    count: 4,
    selectedIndex: 0,
    comparing: false,
    selected: {
      id: 'chalk_wingmark',
      name: 'Chalk Wingmark',
      trigger: 'First enemy Cover break each turn',
      effects: [
        { order: 1, text: 'Gain 3 Cover.', grammar: 'gainCover(3)' },
        { order: 2, text: 'Gain 1 Resonance.', grammar: 'gainResonance(1)' },
        { order: 3, text: 'Draw 1 next turn.', grammar: 'nextTurnDraw(1)' },
      ],
    },
    renderer: { requested: true, loaded: true, failed: false },
  });
  expect(initial.pinTarget).toEqual({ width: 112, height: 58 });
  expect(initial.panelCount).toBe(1);
  expect(initial.orderedRows).toBe(3);

  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.children.getByName('route-waymark-pin-hit')?.emit('pointerdown');
  });
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text!()).waymarkReview.pinned?.id
  ))).toBe('chalk_wingmark');
  await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.children.getByName('route-waymark-tile-wire_map')?.emit('pointerdown');
  });
  await expect.poll(async () => page.evaluate(() => {
    const review = JSON.parse(window.render_game_to_text!()).waymarkReview;
    return `${review.pinned?.id}|${review.selected?.id}|${review.comparing}`;
  })).toBe('chalk_wingmark|wire_map|true');

  const compared = await page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text!());
    const region = document.getElementById('game-status');
    return {
      review: state.waymarkReview,
      announcement: region?.textContent ?? '',
    };
  });
  expect(compared.review.selected).toMatchObject({
    id: 'wire_map',
    trigger: 'After resolving a Signal',
  });
  expect(compared.review.pinned).toMatchObject({
    id: 'chalk_wingmark',
    trigger: 'First enemy Cover break each turn',
  });
  await expect.poll(async () => page.evaluate(() => (
    document.getElementById('game-status')?.textContent ?? ''
  ))).toContain('Comparing pinned Chalk Wingmark');
  await page.screenshot({ path: '.artifacts/test-results/route-waymark-comparison.png' });

  await page.keyboard.press('Tab');
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text!()).waymarkReview.selected?.id
  ))).toBe('rain_gutter');

  const controllerPinned = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    route.input.gamepad.emit('down', {}, { index: 2 });
    return JSON.parse(window.render_game_to_text!()).waymarkReview;
  });
  expect(controllerPinned).toMatchObject({
    comparing: false,
    selected: { id: 'rain_gutter' },
    pinned: { id: 'rain_gutter' },
  });

  await page.keyboard.press('c');
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text!()).waymarkReview.pinned
  ))).toBeUndefined();
});

test('waymark drawer renders generated scroll rail when carried artifacts overflow', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const routeMarks = [
      'chalk_wingmark',
      'rooftop_shortcut',
      'wire_map',
      'crowbar_debt',
      'rain_gutter',
      'sky_safe_harness',
      'cache_divining_hook',
      'under_eave_charm',
      'quiet_roost_token',
      'loose_shingle',
      'broken_cover_chime'
    ];
    const runState = {
      deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'cups_ace' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed: 'route-waymark-scroll-rail',
      currentHp: 36,
      scrap: 40,
      routeMarks,
      supplies: [],
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
    for (let i = 0; i < 40 && !g.textures.exists('ui-icon-route-waymark-scroll-rail-frame'); i += 1) await wait(50);
    route.openWaymarkDrawer();
    for (let i = 0; i < 100 && !route.children.list.some(
      (child: any) => child.texture?.key === 'ui-icon-route-waymark-scroll-rail-frame'
    ); i += 1) await wait(40);
    const routeState = JSON.parse(window.render_game_to_text!()).routeWaymarkScrollRailFrame;
    const routeObjects = route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-waymark-scroll-rail-frame')
      .map((child: any) => ({
        x: child.x,
        y: child.y,
        displayWidth: child.displayWidth,
        displayHeight: child.displayHeight,
        alpha: child.alpha
      }));

    await window.__birdSquadStartScene!('BattleScene', { runState: route.runState, routeNodeId: 'm1_entry' });
    await wait(250);
    const battle: any = g.scene.getScene('BattleScene');
    battle.routeMarks = routeMarks;
    battle.waymarkDrawerOpen = true;
    battle.renderAll();
    await wait(80);
    const battleState = JSON.parse(window.render_game_to_text!()).routeWaymarkScrollRailFrame;
    const battleRoot = battle.root?.list ?? battle.children.list;
    const battleObjects = battleRoot
      .filter((child: any) => child.texture?.key === 'ui-icon-route-waymark-scroll-rail-frame')
      .map((child: any) => ({
        x: child.x,
        y: child.y,
        displayWidth: child.displayWidth,
        displayHeight: child.displayHeight,
        alpha: child.alpha
      }));

    return {
      loaded: g.textures.exists('ui-icon-route-waymark-scroll-rail-frame'),
      routeState,
      routeObjects,
      battleState,
      battleObjects
    };
  });

  expect(result.loaded).toBe(true);
  expect(result.routeState).toEqual({ loaded: true, rendered: true, count: 1 });
  expect(result.battleState).toEqual({ loaded: true, rendered: true, count: 1 });
  expect(result.routeObjects).toHaveLength(1);
  expect(result.battleObjects).toHaveLength(1);
  expect(result.routeObjects[0].displayHeight).toBeGreaterThan(150);
  expect(result.routeObjects[0].displayHeight).toBeLessThan(300);
  // Combat and route share the same two-row inventory beside the full reader.
  expect(result.battleObjects[0].displayHeight).toBe(result.routeObjects[0].displayHeight);
});

test('promoted reserve enemies can surface in generated route encounters', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const promotedByMap = [
      {
        mapIndex: 0,
        ids: [
          'enc_rooftop_raccoon', 'enc_pigeon_enforcer', 'enc_crow_saboteur',
          'enc_rat_courier', 'enc_weasel_cutpurse', 'enc_skunk_chemist', 'enc_armadillo_roller',
          'enc_alley_cat', 'enc_jackrabbit_sprinter', 'enc_hedgehog_curb_crosser', 'enc_mongoose_counterfighter',
        ],
      },
      {
        mapIndex: 1,
        ids: [
          'enc_canal_otter', 'enc_crab_dockguard', 'enc_frog_canal_jumper',
          'enc_turtle_barricader', 'enc_cormorant_netter', 'enc_kingfisher_snapdiver', 'enc_heron_spearstepper',
          'enc_opossum_decoy', 'enc_goose_bouncer', 'enc_mantis_street_duelist',
        ],
      },
      {
        mapIndex: 2,
        ids: [
          'enc_cicada_static_swarm', 'enc_crane_signal_caller',
          'enc_bat_nightcaller', 'enc_kite_hawk_courier',
          'enc_moth_lantern_drifter',
        ],
      },
      {
        mapIndex: 3,
        ids: [
          'enc_vulture_cleanup_crew', 'enc_woodpecker_riveter', 'enc_porcupine_bristleguard',
          'enc_fox_lookout', 'enc_peacock_intimidator',
        ],
      },
    ];
    const seen = new Set<string>();
    const mkRunState = (seed: string, mapIndex: number) => ({
      deck: [{ id: 'major_00' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed,
      currentHp: 36,
      scrap: 40,
      routeMarks: [],
      supplies: [],
      mapIndex,
      completedRouteNodeIds: [],
      currentRouteNodeId: undefined,
      routeLog: [],
      nextCombat: undefined,
      signalChoices: [],
      rewardEvents: [],
    });

    for (const group of promotedByMap) {
      for (let i = 0; i < 160 && group.ids.some((id) => !seen.has(id)); i += 1) {
        await window.__birdSquadStartScene!('RouteScene', { runState: mkRunState(`promoted-enemy-${group.mapIndex}-${i}`, group.mapIndex) });
        g.scene.stop('MenuScene');
        await wait(5);
        for (const node of window.__birdSquadCurrentMap!().nodes) {
          if (node.type === 'street' || node.type === 'rival') seen.add(node.payloadId);
        }
      }
    }

    const expected = promotedByMap.flatMap((group) => group.ids);
    return {
      seen: expected.filter((id) => seen.has(id)),
      missing: expected.filter((id) => !seen.has(id)),
    };
  });
  expect(r.missing).toEqual([]);
  expect(r.seen.length).toBe(31);
});
