import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// The game exposes a deterministic text-state harness on window; these smoke
// tests drive scenes through it rather than clicking the canvas.
declare global {
  interface Window {
    __birdSquadGame?: any;
    __birdSquadState?: () => any;
    __birdSquadLastRun?: any;
    __birdSquadStartScene?: (key: string, data?: any) => Promise<any>;
    __birdSquadEnsureScene?: (key: string) => Promise<boolean>;
    __birdSquadAudio?: () => any;
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    __birdSquadShowKeywordTooltip?: (sceneKey: string, keyword: string, x: number, y: number) => {
      shown: boolean;
      loaded: boolean;
      count: number;
      sceneKey: string;
      frame?: { displayWidth: number; displayHeight: number; alpha: number; name: string; visible: boolean };
    };
  }
}

async function boot(page: Page, path = '/') {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await page.goto(path);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(250 + attempt * 250);
    }
  }
  if (lastError) throw lastError;
  await page.waitForFunction(() => !!window.__birdSquadGame, undefined, { timeout: 15_000 });
  await page.waitForFunction(() => {
    try {
      return JSON.parse(window.render_game_to_text?.() ?? '{}').scene === 'MenuScene';
    } catch {
      return false;
    }
  }, undefined, { timeout: 15_000 });
  await page.evaluate(async () => {
    if (window.__birdSquadStartScene) return;
    window.__birdSquadStartScene = async (key: string, data?: any) => {
      const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
      const g = window.__birdSquadGame;
      await window.__birdSquadEnsureScene?.(key);
      for (const sceneKey of ['MenuScene', 'ProfileScene', 'CodexScene', 'RouteScene', 'BattleScene']) {
        if (sceneKey !== key && g.scene.isActive(sceneKey)) g.scene.stop(sceneKey);
      }
      if (g.scene.isActive(key)) {
        g.scene.stop(key);
        await wait(0);
      }
      g.scene.start(key, data);
      for (let i = 0; i < 120; i += 1) {
        const scene = g.scene.getScene(key);
        const active = Boolean(scene?.scene?.isActive?.());
        const hasRequestedRouteSeed = key !== 'RouteScene'
          || !data?.runState?.seed
          || scene?.runState?.seed === data.runState.seed;
        const battleReady = key !== 'BattleScene'
          || (Boolean(scene?.fxLayer) && !scene?.combatAnimationPending);
        const routeReady = key !== 'RouteScene' || scene?.routeEssentialAssetsReady === true;
        if (active && hasRequestedRouteSeed && battleReady && routeReady) return scene;
        await wait(50);
      }
      return g.scene.getScene(key);
    };
  });
}

async function clickNamedGameObject(page: Page, sceneKey: string, name: string) {
  await page.waitForFunction(({ sceneKey: key, name: objectName }) => {
    const scene = window.__birdSquadGame?.scene?.getScene(key);
    return scene?.children?.list?.some((child: any) => child.name === objectName && child.input?.enabled);
  }, { sceneKey, name });
  const center = await page.evaluate(({ sceneKey: key, name: objectName }) => {
    const scene = window.__birdSquadGame.scene.getScene(key);
    const hit = scene.children.list.find((child: any) => child.name === objectName && child.input?.enabled);
    if (!hit) throw new Error(`Missing enabled ${objectName} command`);
    return { x: hit.x, y: hit.y };
  }, { sceneKey, name });
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.click(
    canvas.x + canvas.width * (center.x / 1280),
    canvas.y + canvas.height * (center.y / 720),
  );
}

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
        && collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-route-district-banner');
      if (rendered) break;
      await wait(50);
    }
    if (bossNode) {
      const position = route.nodePosition(bossNode);
      route.showNodeTooltip(bossNode, position.x, position.y - 40);
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
    const routeNodeTooltipFrameRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-route-node-tooltip-frame');
    const routeSelectedNodeRingRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-route-selected-node-ring');
    const routeBossBeaconRingRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-route-boss-beacon-ring');
    const routeDistrictBannerRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-route-district-banner');
    const bossPrepDossierRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-boss-prep-dossier-flourish');
    const bossPrepReadinessChipFrameRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-boss-prep-readiness-chip-frame');
    const bossPrepPressurePlaqueRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-boss-prep-pressure-plaque');
    const bossPrepSignalModuleRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-boss-prep-signal-module');
    const bossPrepRouteForPlateRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-boss-prep-route-for-plate');
    const state = JSON.parse(window.render_game_to_text!());
    const routeNodeTooltipFrames = collectObjects(route.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-route-node-tooltip-frame')
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
      for (let i = 0; i < 40; i += 1) {
        const rendered = collectObjects(route.children)
          .some((child: any) => child.texture?.key === 'ui-icon-route-commit-tooltip-frame');
        if (rendered) break;
        await wait(50);
      }
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
      .filter((child: any) => child.texture?.key === 'ui-icon-route-commit-tooltip-frame')
      .map((child: any) => ({
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        name: child.name,
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
      cacheRewardBadges: state.nodes.find((node: any) => node.type === 'cache')?.rewardBadges ?? []
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
  expect(result.routeCommitTooltipFrame.rendered).toBe(true);
  expect(result.routeCommitTooltipFrame.count).toBe(1);
  expect(result.routeCommitTooltipFrames).toHaveLength(1);
  expect(result.routeCommitTooltipFrames[0]).toMatchObject({
    name: 'route-commit-tooltip-frame',
    visible: true,
    displayHeight: 48,
  });
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
  expect(result.rewardCardBadgeRendered).toBe(true);
  expect(result.rewardWaymarkBadgeLoaded).toBe(true);
  expect(result.rewardWaymarkBadgeRendered).toBe(true);
  expect(result.rewardPreenBadgeLoaded).toBe(true);
  expect(result.rewardPreenBadgeRendered).toBe(true);
  expect(result.rewardHealBadgeLoaded).toBe(true);
  expect(result.rewardHealBadgeRendered).toBe(true);
  expect(result.rewardSupplyBadgeLoaded).toBe(true);
  expect(result.rewardSupplyBadgeRendered).toBe(true);
  expect(result.rewardScrapBadgeLoaded).toBe(true);
  expect(result.rewardScrapBadgeRendered).toBe(true);
  expect(result.rewardSparkBurstLoaded).toBe(true);
  expect(result.rewardSparkBurstRendered).toBe(true);
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
  expect(result.routeMapFrames[0].alpha).toBeGreaterThan(0.75);
  expect(result.routeNodeTooltipFrameLoaded).toBe(true);
  expect(result.routeNodeTooltipFrameRendered).toBe(true);
  expect(result.routeNodeTooltipFrame.loaded).toBe(true);
  expect(result.routeNodeTooltipFrame.rendered).toBe(true);
  expect(result.routeNodeTooltipFrame.count).toBe(2);
  expect(result.routeNodeTooltipFrames).toHaveLength(2);
  result.routeNodeTooltipFrames.forEach((frame: any) => {
    expect(frame).toMatchObject({
      name: 'route-node-tooltip-frame',
      visible: true,
    });
    expect(frame.displayWidth).toBeGreaterThanOrEqual(244);
    expect(frame.displayHeight).toBe(122);
    expect(frame.alpha).toBeGreaterThan(0.85);
  });
  expect(result.routeRiskMeterFrameLoaded).toBe(true);
  expect(result.routeRiskMeterFrameRendered).toBe(true);
  expect(result.routeRiskMeterFrame.loaded).toBe(true);
  expect(result.routeRiskMeterFrame.rendered).toBe(true);
  expect(result.routeRiskMeterFrame.count).toBe(2);
  expect(result.routeRiskMeterFrames).toHaveLength(2);
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
  expect(result.rewardBadgeKeys).toContain('ui-icon-reward-card-badge');
  expect(result.rewardBadgeKeys).toContain('ui-icon-reward-waymark-badge');
  expect(result.rewardBadgeKeys).toContain('ui-icon-reward-preen-badge');
  expect(result.rewardBadgeKeys).toContain('ui-icon-reward-heal-badge');
  expect(result.rewardBadgeKeys).toContain('ui-icon-reward-supply-badge');
  expect(result.rewardBadgeKeys).toContain('ui-icon-reward-scrap-badge');
  expect(result.hasRewardBadges).toBe(true);
  expect(result.bossRewardBadges).toContain('waymark');
  expect(result.bossRewardBadges).toContain('card');
  expect(result.bossRewardBadges).toContain('preen');
  expect(result.cacheRewardBadges).toContain('heal');
  expect(result.cacheRewardBadges).toContain('supply');
  expect(result.cacheRewardBadges).toContain('scrap');
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
    await wait(20);
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

test('combat intro keeps gameplay locked until the reveal completes', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    let scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 100 && !scene?.fxLayer; i += 1) {
      await wait(30);
      scene = g.scene.getScene('BattleScene');
    }
    if (!scene?.fxLayer) throw new Error('Battle scene did not reach its intro reveal');
    const card = scene.hand.find((candidate: any) => candidate.role === 'attack');
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    const before = {
      pending: scene.combatAnimationPending,
      turn: scene.turn,
      hand: scene.hand.length,
      energy: scene.energy,
      enemyHp: enemy?.hp,
    };
    scene.endTurnAnimated();
    if (card && enemy) scene.playCardAnimated(card, enemy.id);
    await wait(100);
    const blocked = {
      turn: scene.turn,
      hand: scene.hand.length,
      energy: scene.energy,
      enemyHp: enemy?.hp,
    };
    for (let i = 0; i < 80 && scene.combatAnimationPending; i += 1) await wait(50);
    return { before, blocked, settled: !scene.combatAnimationPending };
  });

  expect(result.before.pending).toBe(true);
  expect(result.blocked).toEqual({
    turn: result.before.turn,
    hand: result.before.hand,
    energy: result.before.energy,
    enemyHp: result.before.enemyHp,
  });
  expect(result.settled).toBe(true);
});

test('combat attacks resolve after their animation wind-up', async ({ page }) => {
  // This scenario deliberately exercises player, enemy, support, and reduced-
  // motion staging in one browser test. Keep its timeout above the measured
  // ~28-31 second runtime so a busy full-suite worker does not create a false
  // regression while the individual timing assertions remain strict.
  test.setTimeout(60_000);
  await boot(page);
  const playerAttack = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const waitForSettledState = async () => {
      for (let i = 0; i < 20; i += 1) {
        const state = window.__birdSquadState!();
        if (!state.combatAnimationPending) return state;
        await wait(100);
      }
      return window.__birdSquadState!();
    };
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.energy = 99;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    const card = scene.hand.find((candidate: any) =>
      candidate.role === 'attack' && scene.activeCardContract(candidate).target === 'enemy'
    );
    if (!enemy || !card) throw new Error('Expected an enemy-target attack card in the opening hand');

    const enemyHpBefore = enemy.hp;
    const handBefore = scene.hand.length;
    scene.combatPlayerHitConfirmBursts = 0;
    scene.combatPlayerCommitSigilBursts = 0;
    const hitConfirmCueBefore = window.__birdSquadState!().audio?.cueRequests?.hitConfirm ?? 0;
    const playerCommitmentCueBefore = window.__birdSquadState!().audio?.cueRequests?.playerCommitment ?? 0;
    scene.playCardAnimated(card, enemy.id);
    await wait(120);
    const during = window.__birdSquadState!();
    const after = await waitForSettledState();
    return {
      enemyHpBefore,
      handBefore,
      duringPending: during.combatAnimationPending,
      duringEnemyHp: during.enemies.find((candidate: any) => candidate.id === enemy.id)?.hp,
      duringHand: during.hand.length,
      afterPending: after.combatAnimationPending,
      afterEnemyHp: after.enemies.find((candidate: any) => candidate.id === enemy.id)?.hp,
      hitConfirmCueBefore,
      hitConfirmCueAfter: after.audio?.cueRequests?.hitConfirm ?? 0,
      playerCommitmentCueBefore,
      playerCommitmentCueDuring: during.audio?.cueRequests?.playerCommitment ?? 0,
      combatPlayerCommitSigilDuring: during.combatPlayerCommitSigil,
      combatPlayerHitConfirm: after.combatPlayerHitConfirm,
    };
  });

  const enemyAttack = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const waitForSettledState = async () => {
      for (let i = 0; i < 120; i += 1) {
        const state = window.__birdSquadState!();
        if (!state.combatAnimationPending) return state;
        await wait(100);
      }
      return window.__birdSquadState!();
    };
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.hand = [];
    scene.flock.hp = scene.flock.maxHp;
    scene.flock.block = 0;
    scene.enemies.forEach((enemy: any) => {
      enemy.weak = 0;
      enemy.nextAttackBonus = 0;
      enemy.damageBonus = 0;
    });
    scene.combatEnemyAttackTellBursts = 0;
    scene.combatEnemyWindupPlaqueBursts = 0;
    scene.combatThreatChargeBursts = 0;
    scene.combatEnemyCommitmentSealBursts = 0;
    scene.combatEnemyRecoveryAfterglowBursts = 0;
    scene.combatRoostHandoffBursts = 0;
    scene.combatPlayerTurnRallyBursts = 0;
    scene.combatEnemyImpactContactBursts = 0;
    const roostHandoffCueBefore = window.__birdSquadState!().audio?.cueRequests?.roostHandoff ?? 0;
    const playerTurnRallyCueBefore = window.__birdSquadState!().audio?.cueRequests?.playerTurnRally ?? 0;
    const enemyCommitmentCueBefore = window.__birdSquadState!().audio?.cueRequests?.enemyCommitment ?? 0;

    const flockHpBefore = scene.flock.hp;
    scene.endTurnAnimated();
    await wait(160);
    const duringPreamble = window.__birdSquadState!();
    let duringWindup = duringPreamble;
    for (let i = 0; i < 24; i += 1) {
      const state = window.__birdSquadState!();
      if (state.combatEnemyAttackTell?.rendered) {
        duringWindup = state;
        break;
      }
      await wait(80);
    }
    await wait(1700);
    const heldWindup = window.__birdSquadState!();
    let duringRelease = duringWindup;
    for (let i = 0; i < 40; i += 1) {
      const state = window.__birdSquadState!();
      if (state.combatEnemyTurnBeat === 'release') {
        duringRelease = state;
        break;
      }
      await wait(80);
    }
    await wait(1250);
    const heldRelease = window.__birdSquadState!();
    let duringImpact = duringRelease;
    for (let i = 0; i < 20; i += 1) {
      const state = window.__birdSquadState!();
      if (state.combatEnemyTurnBeat === 'impact') {
        duringImpact = state;
        break;
      }
      await wait(80);
    }
    await wait(900);
    const resolvedImpact = window.__birdSquadState!();
    let duringRecovery = duringImpact;
    for (let i = 0; i < 24; i += 1) {
      const state = window.__birdSquadState!();
      if (state.combatEnemyTurnBeat === 'recovery') {
        duringRecovery = state;
        break;
      }
      await wait(80);
    }
    const after = await waitForSettledState();
    let playerTurnRally = after;
    for (let i = 0; i < 32; i += 1) {
      const state = window.__birdSquadState!();
      if (state.combatPlayerTurnRally?.rendered) {
        playerTurnRally = state;
        break;
      }
      await wait(80);
    }
    return {
      flockHpBefore,
      preambleBeat: duringPreamble.combatEnemyTurnBeat,
      duringPending: duringPreamble.combatAnimationPending,
      duringFlockHp: duringPreamble.flock.hp,
      windupBeat: duringWindup.combatEnemyTurnBeat,
      windupPending: duringWindup.combatAnimationPending,
      windupFlockHp: duringWindup.flock.hp,
      heldWindupBeat: heldWindup.combatEnemyTurnBeat,
      heldWindupFlockHp: heldWindup.flock.hp,
      releaseBeat: duringRelease.combatEnemyTurnBeat,
      releasePending: duringRelease.combatAnimationPending,
      releaseFlockHp: duringRelease.flock.hp,
      heldReleaseBeat: heldRelease.combatEnemyTurnBeat,
      heldReleaseFlockHp: heldRelease.flock.hp,
      heldReleaseActionTrail: heldRelease.combatActionTrail,
      heldReleaseCommitmentSeal: heldRelease.combatEnemyCommitmentSeal,
      releaseMove: duringRelease.combatEnemyTurnMove,
      releaseActionTrail: duringRelease.combatActionTrail,
      releaseCommitmentSeal: duringRelease.combatEnemyCommitmentSeal,
      enemyCommitmentCueBefore,
      enemyCommitmentCueAfter: duringRelease.audio?.cueRequests?.enemyCommitment ?? 0,
      impactBeat: duringImpact.combatEnemyTurnBeat,
      impactFlockHp: duringImpact.flock.hp,
      impactProgress: duringImpact.combatEnemyTurnProgress,
      resolvedImpactBeat: resolvedImpact.combatEnemyTurnBeat,
      resolvedImpactFlockHp: resolvedImpact.flock.hp,
      resolvedImpactContact: resolvedImpact.combatEnemyImpactContact,
      recoveryBeat: duringRecovery.combatEnemyTurnBeat,
      recoveryPending: duringRecovery.combatAnimationPending,
      recoveryAfterglow: duringRecovery.combatEnemyRecoveryAfterglow,
      combatRoostHandoff: duringPreamble.combatRoostHandoff,
      roostHandoffCueBefore,
      roostHandoffCueAfter: duringPreamble.audio?.cueRequests?.roostHandoff ?? 0,
      combatPlayerTurnRally: playerTurnRally.combatPlayerTurnRally,
      playerTurnRallyCueBefore,
      playerTurnRallyCueAfter: playerTurnRally.audio?.cueRequests?.playerTurnRally ?? 0,
      combatBeatProgressFrame: heldWindup.combatBeatProgressFrame,
      windupProgress: heldWindup.combatEnemyTurnProgress,
      releaseProgress: heldRelease.combatEnemyTurnProgress,
      combatEnemyAttackTell: duringWindup.combatEnemyAttackTell,
      combatEnemyWindupPlaque: duringWindup.combatEnemyWindupPlaque,
      combatThreatCharge: duringWindup.combatThreatCharge,
      afterPending: after.combatAnimationPending,
      afterFlockHp: after.flock.hp,
    };
  });

  const enemySupport = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    if (!enemy) throw new Error('Expected a living enemy for support wind-up check');
    const supportMove = {
      id: 'smoke_support_tell',
      label: 'Brace Up',
      effects: ['gainCover(4)'],
    };
    enemy.runtime.moves = [supportMove];
    enemy.runtime.attackPattern = { type: 'cycle', moveIds: [supportMove.id] };
    enemy.intentIndex = 0;
    scene.fxLayer.removeAll(true);
    scene.combatEnemyAttackTellBursts = 0;
    scene.combatEnemyWindupPlaqueBursts = 0;
    scene.combatEnemySupportChargeBursts = 0;
    scene.combatEnemySupportTellBursts = 0;
    scene.combatThreatChargeBursts = 0;
    scene.enemyAttackWindupFx(enemy, supportMove);
    await wait(120);
    const state = window.__birdSquadState!();
    return {
      combatEnemyAttackTell: state.combatEnemyAttackTell,
      combatEnemyWindupPlaque: state.combatEnemyWindupPlaque,
      combatEnemySupportCharge: state.combatEnemySupportCharge,
      combatEnemySupportTell: state.combatEnemySupportTell,
      combatThreatCharge: state.combatThreatCharge,
    };
  });

  expect(playerAttack.duringPending).toBe(true);
  expect(playerAttack.duringEnemyHp).toBe(playerAttack.enemyHpBefore);
  expect(playerAttack.duringHand).toBe(playerAttack.handBefore - 1);
  expect(playerAttack.combatPlayerCommitSigilDuring.loaded).toBe(true);
  expect(playerAttack.combatPlayerCommitSigilDuring.rendered).toBe(true);
  expect(playerAttack.combatPlayerCommitSigilDuring.count).toBeGreaterThanOrEqual(1);
  expect(playerAttack.combatPlayerCommitSigilDuring.bursts).toBeGreaterThanOrEqual(1);
  expect(playerAttack.playerCommitmentCueDuring).toBeGreaterThan(playerAttack.playerCommitmentCueBefore);
  expect(playerAttack.afterPending).toBe(false);
  expect(playerAttack.afterEnemyHp).toBeLessThan(playerAttack.enemyHpBefore);
  expect(playerAttack.combatPlayerHitConfirm.loaded).toBe(true);
  expect(playerAttack.combatPlayerHitConfirm.rendered).toBe(true);
  expect(playerAttack.combatPlayerHitConfirm.count).toBeGreaterThanOrEqual(1);
  expect(playerAttack.combatPlayerHitConfirm.bursts).toBeGreaterThanOrEqual(1);
  expect(playerAttack.hitConfirmCueAfter).toBeGreaterThan(playerAttack.hitConfirmCueBefore);

  expect(enemyAttack.duringPending).toBe(true);
  expect(enemyAttack.preambleBeat).toBe('preamble');
  expect(enemyAttack.duringFlockHp).toBe(enemyAttack.flockHpBefore);
  expect(enemyAttack.combatRoostHandoff.loaded).toBe(true);
  expect(enemyAttack.combatRoostHandoff.rendered).toBe(true);
  expect(enemyAttack.combatRoostHandoff.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatRoostHandoff.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.roostHandoffCueAfter).toBeGreaterThan(enemyAttack.roostHandoffCueBefore);
  expect(enemyAttack.combatPlayerTurnRally.loaded).toBe(true);
  expect(enemyAttack.combatPlayerTurnRally.rendered).toBe(true);
  expect(enemyAttack.combatPlayerTurnRally.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatPlayerTurnRally.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.playerTurnRallyCueAfter).toBeGreaterThan(enemyAttack.playerTurnRallyCueBefore);
  expect(enemyAttack.windupBeat).toBe('windup');
  expect(enemyAttack.windupPending).toBe(true);
  expect(enemyAttack.windupFlockHp).toBe(enemyAttack.flockHpBefore);
  expect(enemyAttack.heldWindupBeat).toBe('windup');
  expect(enemyAttack.heldWindupFlockHp).toBe(enemyAttack.flockHpBefore);
  expect(enemyAttack.combatBeatProgressFrame.loaded).toBe(true);
  expect(enemyAttack.combatBeatProgressFrame.rendered).toBe(true);
  expect(enemyAttack.combatBeatProgressFrame.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.windupProgress.label).toBe('Wind-up');
  expect(enemyAttack.windupProgress.durationMs).toBeGreaterThanOrEqual(2500);
  expect(enemyAttack.windupProgress.progress).toBeGreaterThan(0.45);
  expect(enemyAttack.releaseBeat).toBe('release');
  expect(enemyAttack.releasePending).toBe(true);
  expect(enemyAttack.releaseFlockHp).toBe(enemyAttack.flockHpBefore);
  expect(enemyAttack.heldReleaseBeat).toBe('release');
  expect(enemyAttack.heldReleaseFlockHp).toBe(enemyAttack.flockHpBefore);
  expect(enemyAttack.releaseProgress.label).toBe('Commit');
  expect(enemyAttack.releaseProgress.durationMs).toBeGreaterThanOrEqual(1700);
  expect(enemyAttack.heldReleaseActionTrail.rendered).toBe(true);
  expect(enemyAttack.heldReleaseActionTrail.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.heldReleaseCommitmentSeal.rendered).toBe(true);
  expect(enemyAttack.heldReleaseCommitmentSeal.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.releaseMove.length).toBeGreaterThan(0);
  expect(enemyAttack.releaseActionTrail.rendered).toBe(true);
  expect(enemyAttack.releaseActionTrail.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.releaseCommitmentSeal.loaded).toBe(true);
  expect(enemyAttack.releaseCommitmentSeal.rendered).toBe(true);
  expect(enemyAttack.releaseCommitmentSeal.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.releaseCommitmentSeal.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.enemyCommitmentCueAfter).toBeGreaterThan(enemyAttack.enemyCommitmentCueBefore);
  expect(enemyAttack.impactBeat).toBe('impact');
  expect(enemyAttack.impactFlockHp).toBe(enemyAttack.flockHpBefore);
  expect(enemyAttack.impactProgress.durationMs).toBeGreaterThanOrEqual(2000);
  expect(enemyAttack.resolvedImpactBeat).toBe('impact');
  expect(enemyAttack.resolvedImpactFlockHp).toBeLessThan(enemyAttack.flockHpBefore);
  expect(enemyAttack.resolvedImpactContact.loaded).toBe(true);
  expect(enemyAttack.resolvedImpactContact.rendered).toBe(true);
  expect(enemyAttack.resolvedImpactContact.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.resolvedImpactContact.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.recoveryBeat).toBe('recovery');
  expect(enemyAttack.recoveryPending).toBe(true);
  expect(enemyAttack.recoveryAfterglow.loaded).toBe(true);
  expect(enemyAttack.recoveryAfterglow.rendered).toBe(true);
  expect(enemyAttack.recoveryAfterglow.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.recoveryAfterglow.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatEnemyAttackTell.loaded).toBe(true);
  expect(enemyAttack.combatEnemyAttackTell.rendered).toBe(true);
  expect(enemyAttack.combatEnemyAttackTell.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatEnemyAttackTell.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatEnemyWindupPlaque.loaded).toBe(true);
  expect(enemyAttack.combatEnemyWindupPlaque.rendered).toBe(true);
  expect(enemyAttack.combatEnemyWindupPlaque.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatEnemyWindupPlaque.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatEnemyWindupPlaque.labels.length).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatThreatCharge.loaded).toBe(true);
  expect(enemyAttack.combatThreatCharge.rendered).toBe(true);
  expect(enemyAttack.combatThreatCharge.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatThreatCharge.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.afterPending).toBe(false);
  expect(enemyAttack.afterFlockHp).toBeLessThan(enemyAttack.flockHpBefore);

  expect(enemySupport.combatEnemyAttackTell.loaded).toBe(true);
  expect(enemySupport.combatEnemyAttackTell.rendered).toBe(false);
  expect(enemySupport.combatEnemyAttackTell.bursts).toBe(0);
  expect(enemySupport.combatEnemyWindupPlaque.loaded).toBe(true);
  expect(enemySupport.combatEnemyWindupPlaque.rendered).toBe(true);
  expect(enemySupport.combatEnemyWindupPlaque.count).toBeGreaterThanOrEqual(1);
  expect(enemySupport.combatEnemyWindupPlaque.bursts).toBeGreaterThanOrEqual(1);
  expect(enemySupport.combatEnemyWindupPlaque.labels).toContain('Brace Up');
  expect(enemySupport.combatThreatCharge.loaded).toBe(true);
  expect(enemySupport.combatThreatCharge.rendered).toBe(false);
  expect(enemySupport.combatThreatCharge.bursts).toBe(0);
  expect(enemySupport.combatEnemySupportCharge.loaded).toBe(true);
  expect(enemySupport.combatEnemySupportCharge.rendered).toBe(true);
  expect(enemySupport.combatEnemySupportCharge.count).toBeGreaterThanOrEqual(1);
  expect(enemySupport.combatEnemySupportCharge.bursts).toBeGreaterThanOrEqual(1);
  expect(enemySupport.combatEnemySupportTell.loaded).toBe(true);
  expect(enemySupport.combatEnemySupportTell.rendered).toBe(true);
  expect(enemySupport.combatEnemySupportTell.count).toBeGreaterThanOrEqual(1);
  expect(enemySupport.combatEnemySupportTell.bursts).toBeGreaterThanOrEqual(1);
});

test('advanceTime deterministically resolves player and enemy sequencing', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.combatAnimationPending = false;
    scene.energy = 20;
    const enemy = scene.enemies[0];
    const card = scene.hand.find((candidate: any) => {
      const contract = scene.activeCardContract(candidate);
      return contract.target === 'enemy' && contract.effects.some((effect: string) => /^(?:damage|damagePierce)\(/.test(effect));
    });
    if (!card) throw new Error('Expected an enemy-targeted card');
    enemy.block = 0;
    const hpBeforeCard = enemy.hp;
    scene.playCardAnimated(card, enemy.id);
    const pendingAfterPlay = scene.combatAnimationPending;
    window.advanceTime!(3000);
    const hpAfterCard = enemy.hp;
    scene.hand = [];
    scene.endTurnAnimated();
    const pendingAfterRoost = scene.combatAnimationPending;
    window.advanceTime!(30_000);
    return {
      pendingAfterPlay,
      hpBeforeCard,
      hpAfterCard,
      pendingAfterRoost,
      pendingAfterAdvance: scene.combatAnimationPending,
      turn: scene.turn,
      beat: scene.combatEnemyTurnBeat
    };
  });

  expect(result.pendingAfterPlay).toBe(true);
  expect(result.hpAfterCard).toBeLessThan(result.hpBeforeCard);
  expect(result.pendingAfterRoost).toBe(true);
  expect(result.pendingAfterAdvance).toBe(false);
  expect(result.turn).toBe(2);
  expect(result.beat).toBe('idle');
});

test('combat redraws reuse persistent scenery and coalesce same-frame requests', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    const renderState = () => window.__birdSquadState!().combatRender;
    const settleRenders = async () => {
      let previous = -1;
      let stableFrames = 0;
      for (let index = 0; index < 80 && stableFrames < 3; index += 1) {
        await wait(50);
        const current = renderState();
        if (!current.queued && current.passes === previous) stableFrames += 1;
        else stableFrames = 0;
        previous = current.passes;
      }
    };

    await settleRenders();
    const backdropObjects = [...scene.backdropLayer.list];
    const handObjects = [...scene.handLayer.list];
    const beforeQueue = { ...renderState() };
    for (let index = 0; index < 8; index += 1) scene.requestBattleRender();
    await settleRenders();
    const afterQueue = { ...renderState() };
    const sameHandObjectsAfterQueue = handObjects.length === scene.handLayer.list.length
      && handObjects.every((object, index) => object === scene.handLayer.list[index]);

    scene.energy = 99;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    const card = scene.hand.find((candidate: any) => {
      const contract = scene.activeCardContract(candidate);
      return candidate.role === 'attack'
        && contract.target === 'enemy'
        && !contract.effects.some((effect: string) => /(?:^| then )(?:draw|gainWingbeat|enterMolt|discard)/.test(effect));
    });
    if (!enemy || !card) throw new Error('Expected an enemy-target attack card for redraw profiling');
    enemy.maxHp = Math.max(enemy.maxHp, 500);
    enemy.hp = enemy.maxHp;
    const beforePlayer = { ...renderState() };
    scene.playCardAnimated(card, enemy.id);
    window.advanceTime!(3_000);
    await settleRenders();
    const afterPlayer = { ...renderState() };

    scene.hand = [];
    const beforeEnemy = { ...renderState() };
    scene.endTurnAnimated();
    window.advanceTime!(30_000);
    await settleRenders();
    const afterEnemy = { ...renderState() };
    const sameBackdropObjects = backdropObjects.length === scene.backdropLayer.list.length
      && backdropObjects.every((object, index) => object === scene.backdropLayer.list[index]);

    return {
      queuePasses: afterQueue.passes - beforeQueue.passes,
      queueRequests: afterQueue.requests - beforeQueue.requests,
      queueCoalesced: afterQueue.coalesced - beforeQueue.coalesced,
      queueHandBuilds: afterQueue.handBuilds - beforeQueue.handBuilds,
      queueHandReuses: afterQueue.handReuses - beforeQueue.handReuses,
      playerPasses: afterPlayer.passes - beforePlayer.passes,
      playerHandBuilds: afterPlayer.handBuilds - beforePlayer.handBuilds,
      playerHandReuses: afterPlayer.handReuses - beforePlayer.handReuses,
      enemyPasses: afterEnemy.passes - beforeEnemy.passes,
      enemyHandBuilds: afterEnemy.handBuilds - beforeEnemy.handBuilds,
      enemyHandReuses: afterEnemy.handReuses - beforeEnemy.handReuses,
      backdropBuildsBefore: beforeQueue.backdropBuilds,
      backdropBuildsAfter: afterEnemy.backdropBuilds,
      backdropReuses: afterEnemy.backdropReuses - beforeQueue.backdropReuses,
      backdropObjectCount: afterEnemy.backdropObjects,
      sameBackdropObjects,
      sameHandObjectsAfterQueue,
    };
  });

  expect(result.queueRequests).toBe(8);
  expect(result.queuePasses).toBe(1);
  expect(result.queueCoalesced).toBe(7);
  expect(result.queueHandBuilds).toBe(0);
  expect(result.queueHandReuses).toBe(1);
  expect(result.playerPasses).toBe(2);
  expect(result.playerHandBuilds).toBe(1);
  expect(result.playerHandReuses).toBe(1);
  expect(result.enemyPasses).toBe(3);
  expect(result.enemyHandBuilds).toBe(2);
  expect(result.enemyHandReuses).toBe(1);
  expect(result.backdropBuildsBefore).toBe(1);
  expect(result.backdropBuildsAfter).toBe(1);
  expect(result.backdropReuses).toBeGreaterThanOrEqual(3);
  expect(result.backdropObjectCount).toBeGreaterThan(0);
  expect(result.sameBackdropObjects).toBe(true);
  expect(result.sameHandObjectsAfterQueue).toBe(true);
});

test('imagegen combat FX pack renders each wired asset', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.queueOutcomeCombatFxAssetLoad();
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (scene.textures.exists('combat-victory-rally') && scene.textures.exists('combat-boss-phase-break')) break;
      await wait(25);
    }
    scene.fxLayer.removeAll(true);

    [
      'combatOverextensionWarning',
      'combatBossPhaseBreak',
      'combatPerfectChain',
      'combatStatusCleanseSpecific',
      'combatOpenSkyBreak',
      'combatCacheChoiceReveal',
      'combatMoltTriggerChoice',
      'combatEnemyHeavyContact',
      'combatEnemyHealBeam',
      'combatResourceOvercap',
    ].forEach((name) => {
      scene[`${name}Bursts`] = 0;
    });

    scene.combatOverextensionWarning(260, 210, 0.82);
    scene.combatBossPhaseBreak(620, 204, 0.86);
    scene.combatPerfectChain(950, 210, 0.76);
    scene.combatStatusCleanseSpecific(270, 390, 0.98);
    scene.combatOpenSkyBreak(512, 402, 0.72);
    scene.combatCacheChoiceReveal(760, 396, 0.82);
    scene.combatMoltTriggerChoice(1030, 392, 0.78);
    scene.combatEnemyHeavyContact(370, 575, 830, 0.78);
    scene.combatEnemyHealBeam(560, 610, 850, 555, 0.78);
    scene.combatResourceOvercap(1050, 580, 0.82);
    await wait(120);
    const state = window.__birdSquadState!();
    return {
      combatOverextensionWarning: state.combatOverextensionWarning,
      combatBossPhaseBreak: state.combatBossPhaseBreak,
      combatPerfectChain: state.combatPerfectChain,
      combatStatusCleanseSpecific: state.combatStatusCleanseSpecific,
      combatOpenSkyBreak: state.combatOpenSkyBreak,
      combatCacheChoiceReveal: state.combatCacheChoiceReveal,
      combatMoltTriggerChoice: state.combatMoltTriggerChoice,
      combatEnemyHeavyContact: state.combatEnemyHeavyContact,
      combatEnemyHealBeam: state.combatEnemyHealBeam,
      combatResourceOvercap: state.combatResourceOvercap,
    };
  });

  for (const [name, fx] of Object.entries(result)) {
    expect(fx.loaded, `${name} should be preloaded`).toBe(true);
    expect(fx.rendered, `${name} should be visible on the FX layer`).toBe(true);
    expect(fx.count, `${name} should have at least one live image`).toBeGreaterThanOrEqual(1);
    expect(fx.bursts, `${name} should increment its burst counter`).toBeGreaterThanOrEqual(1);
  }
});

test('combat reduced-motion enemy turn still holds damage until impact', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const waitForBeat = async (beat: string, attempts = 60) => {
      for (let i = 0; i < attempts; i += 1) {
        const state = window.__birdSquadState!();
        if (state.combatEnemyTurnBeat === beat) return state;
        await wait(70);
      }
      return window.__birdSquadState!();
    };

    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    if (!enemy) throw new Error('Expected a living enemy for reduced-motion combat pacing');
    const attackMove = enemy.runtime.moves.find((move: any) =>
      move.effects.some((effect: string) => effect.includes('damage'))
    );
    if (!attackMove) throw new Error('Expected a damaging enemy move for reduced-motion combat pacing');

    enemy.runtime.moves = [attackMove];
    enemy.runtime.attackPattern = { type: 'cycle', moveIds: [attackMove.id] };
    enemy.intentIndex = 0;
    enemy.weak = 0;
    enemy.nextAttackBonus = 0;
    enemy.damageBonus = 0;
    scene.hand = [];
    scene.flock.hp = scene.flock.maxHp;
    scene.flock.block = 0;
    scene.combatEnemyCommitmentSealBursts = 0;
    scene.combatEnemyImpactContactBursts = 0;
    const commitmentCueBefore = window.__birdSquadState!().audio?.cueRequests?.enemyCommitment ?? 0;

    const flockHpBefore = scene.flock.hp;
    scene.endTurnAnimated();
    await wait(60);
    const preamble = window.__birdSquadState!();
    const windup = await waitForBeat('windup', 40);
    await wait(700);
    const heldWindup = window.__birdSquadState!();
    const release = await waitForBeat('release', 50);
    await wait(420);
    const heldRelease = window.__birdSquadState!();
    const impact = await waitForBeat('impact', 45);
    await wait(650);
    const resolvedImpact = window.__birdSquadState!();

    return {
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      flockHpBefore,
      preambleBeat: preamble.combatEnemyTurnBeat,
      preamblePending: preamble.combatAnimationPending,
      preambleHp: preamble.flock.hp,
      windupBeat: windup.combatEnemyTurnBeat,
      windupHp: windup.flock.hp,
      heldWindupBeat: heldWindup.combatEnemyTurnBeat,
      heldWindupHp: heldWindup.flock.hp,
      heldWindupProgress: heldWindup.combatEnemyTurnProgress,
      heldWindupAttackTell: heldWindup.combatEnemyAttackTell,
      heldWindupPlaque: heldWindup.combatEnemyWindupPlaque,
      heldWindupBeatFrame: heldWindup.combatBeatProgressFrame,
      releaseBeat: release.combatEnemyTurnBeat,
      releaseHp: release.flock.hp,
      releaseCommitmentSeal: release.combatEnemyCommitmentSeal,
      heldReleaseBeat: heldRelease.combatEnemyTurnBeat,
      heldReleaseHp: heldRelease.flock.hp,
      heldReleaseCommitmentSeal: heldRelease.combatEnemyCommitmentSeal,
      commitmentCueBefore,
      commitmentCueAfter: release.audio?.cueRequests?.enemyCommitment ?? 0,
      impactBeat: impact.combatEnemyTurnBeat,
      impactHp: impact.flock.hp,
      impactProgress: impact.combatEnemyTurnProgress,
      resolvedImpactBeat: resolvedImpact.combatEnemyTurnBeat,
      resolvedImpactHp: resolvedImpact.flock.hp,
      resolvedImpactContact: resolvedImpact.combatEnemyImpactContact,
    };
  });

  expect(result.reducedMotion).toBe(true);
  expect(result.preamblePending).toBe(true);
  expect(result.preambleBeat).toBe('preamble');
  expect(result.preambleHp).toBe(result.flockHpBefore);
  expect(result.windupBeat).toBe('windup');
  expect(result.windupHp).toBe(result.flockHpBefore);
  expect(result.heldWindupBeat).toBe('windup');
  expect(result.heldWindupHp).toBe(result.flockHpBefore);
  expect(result.heldWindupProgress.label).toBe('Wind-up');
  expect(result.heldWindupProgress.durationMs).toBeGreaterThanOrEqual(1900);
  expect(result.heldWindupAttackTell.loaded).toBe(true);
  expect(result.heldWindupAttackTell.rendered).toBe(true);
  expect(result.heldWindupAttackTell.count).toBeGreaterThanOrEqual(1);
  expect(result.heldWindupPlaque.loaded).toBe(true);
  expect(result.heldWindupPlaque.rendered).toBe(true);
  expect(result.heldWindupPlaque.count).toBeGreaterThanOrEqual(1);
  expect(result.heldWindupBeatFrame.loaded).toBe(true);
  expect(result.heldWindupBeatFrame.rendered).toBe(true);
  expect(result.releaseBeat).toBe('release');
  expect(result.releaseHp).toBe(result.flockHpBefore);
  expect(result.releaseCommitmentSeal.loaded).toBe(true);
  expect(result.releaseCommitmentSeal.rendered).toBe(true);
  expect(result.releaseCommitmentSeal.count).toBeGreaterThanOrEqual(1);
  expect(result.releaseCommitmentSeal.bursts).toBeGreaterThanOrEqual(1);
  expect(result.heldReleaseBeat).toBe('release');
  expect(result.heldReleaseHp).toBe(result.flockHpBefore);
  expect(result.heldReleaseCommitmentSeal.rendered).toBe(true);
  expect(result.heldReleaseCommitmentSeal.count).toBeGreaterThanOrEqual(1);
  expect(result.commitmentCueAfter).toBeGreaterThan(result.commitmentCueBefore);
  expect(result.impactBeat).toBe('impact');
  expect(result.impactHp).toBe(result.flockHpBefore);
  expect(result.impactProgress.durationMs).toBeGreaterThanOrEqual(1500);
  expect(result.resolvedImpactBeat).toBe('impact');
  expect(result.resolvedImpactHp).toBeLessThan(result.flockHpBefore);
  expect(result.resolvedImpactContact.loaded).toBe(true);
  expect(result.resolvedImpactContact.rendered).toBe(true);
  expect(result.resolvedImpactContact.count).toBeGreaterThanOrEqual(1);
  expect(result.resolvedImpactContact.bursts).toBeGreaterThanOrEqual(1);
});

test('adaptive combat pacing preserves first move staging and shortens repeats', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    window.localStorage.setItem('birdsquad.motionPreference', 'full');
    window.localStorage.setItem('birdsquad.combatPace', 'standard');
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    const move = enemy?.runtime.moves[0];
    if (!enemy || !move) throw new Error('Expected an enemy move for pacing test');

    const firstScale = scene.enemyMoveTimingScale(enemy, move);
    const firstWindup = scene.combatTimingDelay(2600, firstScale);
    scene.runSeenEnemyMoves.add(scene.enemyMovePacingKey(enemy, move));
    const repeatScale = scene.enemyMoveTimingScale(enemy, move);
    const repeatWindup = scene.combatTimingDelay(2600, repeatScale);

    window.localStorage.setItem('birdsquad.combatPace', 'cinematic');
    const cinematicScale = scene.enemyMoveTimingScale(enemy, move);
    window.localStorage.setItem('birdsquad.combatPace', 'snappy');
    const snappyScale = scene.enemyMoveTimingScale(enemy, move);
    scene.currentRouteIndex = scene.maxEncounters - 1;
    const bossScale = scene.enemyMoveTimingScale(enemy, move);

    return {
      firstScale,
      firstWindup,
      repeatScale,
      repeatWindup,
      cinematicScale,
      snappyScale,
      bossScale,
      state: JSON.parse(window.render_game_to_text!()).combatPacing
    };
  });

  expect(result.firstScale).toBe(1);
  expect(result.firstWindup).toBe(2600);
  expect(result.repeatScale).toBeCloseTo(0.68, 2);
  expect(result.repeatWindup).toBeCloseTo(1768, 0);
  expect(result.cinematicScale).toBe(1);
  expect(result.snappyScale).toBeCloseTo(0.62, 2);
  expect(result.bossScale).toBe(1);
  expect(result.state.preference).toBe('snappy');
});

test('holding Hustle accelerates familiar enemy staging but preserves Impact', async ({ page }) => {
  await boot(page);
  const hpBefore = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    window.localStorage.setItem('birdsquad.motionPreference', 'full');
    window.localStorage.setItem('birdsquad.combatPace', 'standard');
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];
    const move = { id: 'hustle_test_strike', label: 'Measured Dive', effects: ['damage(4)'] };
    enemy.runtime.moves = [move];
    enemy.runtime.attackPattern = { type: 'cycle', moveIds: [move.id] };
    enemy.intentIndex = 0;
    scene.enemies.slice(1).forEach((candidate: any) => { candidate.hp = 0; });
    scene.runSeenEnemyMoves.add(scene.enemyMovePacingKey(enemy, move));
    scene.combatAnimationPending = false;
    scene.hand = [];
    scene.endTurnAnimated();
    return scene.flock.hp;
  });

  await page.evaluate(() => window.advanceTime!(800));
  const offered = await page.evaluate(() => window.__birdSquadState!());
  expect(offered.combatEnemyTurnBeat).toBe('windup');
  expect(offered.combatEnemyTurnAcceleration?.available).toBe(true);
  expect(offered.combatEnemyTurnAcceleration?.active).toBe(false);

  await page.keyboard.down('Space');
  await page.evaluate(() => window.advanceTime!(700));
  const protectedTell = await page.evaluate(() => window.__birdSquadState!());
  expect(protectedTell.combatEnemyTurnBeat).toBe('windup');
  expect(protectedTell.combatEnemyTurnAcceleration?.eligible).toBe(false);
  expect(protectedTell.flock.hp).toBe(hpBefore);

  await page.evaluate(() => window.advanceTime!(250));
  const accelerated = await page.evaluate(() => window.__birdSquadState!());
  expect(accelerated.combatEnemyTurnBeat).toBe('windup');
  expect(accelerated.combatEnemyTurnAcceleration?.active).toBe(true);
  expect(accelerated.combatEnemyTurnAcceleration?.multiplier).toBeCloseTo(2.2, 1);

  await page.evaluate(() => window.advanceTime!(1_250));
  const impact = await page.evaluate(() => window.__birdSquadState!());
  expect(impact.combatEnemyTurnBeat).toBe('impact');
  expect(impact.combatEnemyTurnAcceleration?.available).toBe(false);
  expect(impact.combatEnemyTurnAcceleration?.active).toBe(false);
  expect(impact.flock.hp).toBe(hpBefore);

  await page.evaluate(() => window.advanceTime!(600));
  const resolved = await page.evaluate(() => window.__birdSquadState!());
  await page.keyboard.up('Space');
  expect(resolved.flock.hp).toBeLessThan(hpBefore);
});

test('first-flight guidance exposes route tradeoffs and Flow outcome previews', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    const routeState = JSON.parse(window.render_game_to_text!());
    const reachable = routeState.nodes.find((node: any) => node.selectable);
    route.selectRouteNode(reachable.id);
    const selectedRouteState = JSON.parse(window.render_game_to_text!());
    const routeGuidanceText = route.children.list
      .filter((child: any) => child.name === 'first-route-guidance' && typeof child.text === 'string')
      .map((child: any) => child.text)
      .join(' ');
    const routeCommitLabel = route.children.list.some((child: any) => child.name === 'route-commit-label');

    route.commitRouteNode(reachable.id);
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 120 && (!battle.scene.isActive() || battle.combatAnimationPending); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
    battle.flock.flow = Math.min(2, battle.flock.flowMax - 1);
    battle.flock.block = 0;
    battle.renderAll();
    const flowBreakState = JSON.parse(window.render_game_to_text!());
    const incoming = battle.incomingFlockDamagePreview();
    if (incoming.total <= 0) throw new Error('Expected the opening Tell to threaten the Flow rail');
    battle.flock.block = incoming.total;
    battle.renderAll();
    const flowHoldState = JSON.parse(window.render_game_to_text!());
    battle.flock.block = 0;
    battle.flock.flow = Math.max(0, battle.flock.flowMax - 1);
    battle.renderAll();
    const card = battle.hand.find((candidate: any) => {
      const contract = battle.activeCardContract(candidate);
      return contract.target === 'enemy' && battle.cardBuildsFlow(candidate) && battle.effectiveCost(candidate) <= battle.energy;
    });
    if (!card) throw new Error('Expected a targeted Flow-building card in the opening hand');
    battle.onCardClicked(card.instanceId);
    const battleState = JSON.parse(window.render_game_to_text!());
    const flowRailRect = battle.root.list.find((child: any) => child.name === 'combat-flow-rail')?.getBounds();
    const guideRect = battle.root.list.find((child: any) => child.name === 'first-combat-guidance' && child.geom)?.getBounds();
    const flowRailBounds = flowRailRect && {
      width: flowRailRect.width,
      bottom: flowRailRect.y + flowRailRect.height,
    };
    const guideBounds = guideRect && { top: guideRect.y };

    return {
      routeGuidance: routeState.firstRouteGuidance,
      selectedRouteGuidance: selectedRouteState.firstRouteGuidance,
      routeGuidanceText,
      routeCommitLabel,
      routeDecision: reachable?.decision,
      flowRail: battleState.flowRail,
      flowPreview: battleState.flowPreview,
      flowBreakRail: flowBreakState.flowRail,
      flowHoldRail: flowHoldState.flowRail,
      flowRailBounds,
      guideBounds,
      combatGuidance: battleState.firstCombatGuidance,
      outcome: battleState.selectedCardOutcome
    };
  });
  await page.screenshot({ path: '.artifacts/test-results/flow-centered-hud/selected-surge-next-1280x720.png' });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: '.artifacts/test-results/flow-centered-hud/selected-surge-next-1024x768.png' });

  expect(result.routeGuidance).toEqual({ active: true, rendered: true });
  expect(result.selectedRouteGuidance).toEqual({ active: true, rendered: true });
  expect(result.routeGuidanceText).toContain('GAIN');
  expect(result.routeGuidanceText).toContain('RISK');
  expect(result.routeCommitLabel).toBe(true);
  expect(result.routeDecision.benefit.length).toBeGreaterThan(0);
  expect(result.routeDecision.risk.length).toBeGreaterThan(0);
  expect(result.flowRail.rendered).toBe(true);
  expect(result.flowRail.previewPips).toBe(1);
  expect(result.flowRail.status).toBe('SURGE / BREAK');
  expect(result.flowPreview).toBe(1);
  expect(result.flowBreakRail.status).toBe('FLOW BREAKS');
  expect(result.flowBreakRail.breakPreview).toBe(true);
  expect(result.flowHoldRail.status).toBe('FLOW HOLDS');
  expect(result.flowHoldRail.holdPreview).toBe(true);
  expect(result.flowRailBounds.width).toBeGreaterThanOrEqual(190);
  expect(result.flowRailBounds.bottom).toBeLessThan(result.guideBounds.top);
  expect(result.combatGuidance).toEqual({ active: true, rendered: true });
  expect(result.outcome.result.flow.before).toBe(result.outcome.result.flow.max - 1);
  expect(result.outcome.result.flow.after).toBe(result.outcome.result.flow.max);
  expect(result.outcome.summary).toContain(`Flow ${result.outcome.result.flow.before} -> Surge`);
  expect(result.outcome.target.length).toBeGreaterThan(0);
});

test('combat hand cards accept real pointer selection', async ({ page }) => {
  await boot(page);
  const card = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const candidate = battle.hand.find((entry: any) =>
      battle.activeCardContract(entry).target === 'enemy' && battle.effectiveCost(entry) <= battle.energy
    );
    if (!candidate) throw new Error('Expected an affordable enemy-target card');
    const bounds = battle.handCardRects.get(candidate.instanceId)?.getBounds();
    if (!bounds) throw new Error('Expected a live hand-card hit area');
    return {
      id: candidate.instanceId,
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  });
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected the combat canvas');
  const point = {
    x: bounds.x + card.x * (bounds.width / 1280),
    y: bounds.y + card.y * (bounds.height / 720),
  };
  await page.mouse.move(point.x, point.y);
  await page.waitForTimeout(120);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(120);
  const state = await page.evaluate(() => window.__birdSquadState!());
  expect(state.combatAnimationPending).toBe(false);
  expect(state.selectedCard).toBe(card.id);
  expect(state.selectedCardOutcome?.result.flow.after).toBeGreaterThanOrEqual(state.flow);
});

test('first-flight guide persists, can be skipped or replayed, and completes through live decisions', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    const helpActions = (menu: any) => menu.helpOverlay?.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text) ?? [];
    const waitForHelpAction = async (menu: any, expected: string) => {
      for (let i = 0; i < 80; i += 1) {
        const actions = helpActions(menu);
        if (actions.includes(expected)) return actions;
        await wait(50);
      }
      throw new Error(`How to Play did not render ${expected}`);
    };
    window.localStorage.removeItem('birdsquad.firstFlightGuide');

    await window.__birdSquadStartScene!('MenuScene');
    const menu: any = g.scene.getScene('MenuScene');
    menu.openHelpOverlay();
    const initialActions = await waitForHelpAction(menu, 'Skip Guide');
    const initialGuide = JSON.parse(window.render_game_to_text!()).firstFlightGuide;
    menu.toggleFirstFlightGuide();
    const skippedActions = await waitForHelpAction(menu, 'Replay Guide');
    const skippedGuide = JSON.parse(window.render_game_to_text!()).firstFlightGuide;
    menu.toggleFirstFlightGuide();
    await waitForHelpAction(menu, 'Skip Guide');
    const replayedGuide = JSON.parse(window.render_game_to_text!()).firstFlightGuide;
    menu.closeHelpOverlay();

    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    const routeState = JSON.parse(window.render_game_to_text!());
    const reachable = route.getSelectableNodes()[0];
    route.commitRouteNode(reachable.id);
    await wait(100);
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 120 && (!battle.scene.isActive() || battle.combatAnimationPending); i += 1) await wait(50);
    const cardStage = JSON.parse(window.render_game_to_text!()).firstFlightGuide;
    const card = battle.hand.find((candidate: any) => battle.effectiveCost(candidate) <= battle.energy && battle.activeCardContract(candidate).target !== 'enemy')
      ?? battle.hand.find((candidate: any) => battle.effectiveCost(candidate) <= battle.energy);
    const target = battle.enemies.find((enemy: any) => enemy.hp > 0)?.id;
    battle.playCard(card, target);
    await wait(50);
    const roostStage = JSON.parse(window.render_game_to_text!()).firstFlightGuide;
    battle.endTurn({ enemyPacing: false });
    await wait(50);
    const rewardStage = JSON.parse(window.render_game_to_text!()).firstFlightGuide;
    battle.rewardChoices = battle.createRewardChoices();
    battle.mode = 'cardReward';
    battle.renderAll();
    const rewardCard = battle.rewardChoices[0];
    battle.chooseRewardCard(rewardCard.id);
    await wait(30);
    const completedGuide = JSON.parse(window.localStorage.getItem('birdsquad.firstFlightGuide') ?? '{}');

    return {
      initialGuide,
      initialActions,
      skippedGuide,
      skippedActions,
      replayedGuide,
      routeGuide: routeState.firstFlightGuide,
      cardStage,
      roostStage,
      rewardStage,
      completedGuide
    };
  });

  expect(result.initialGuide.step).toBe('route');
  expect(result.initialActions).toContain('Skip Guide');
  expect(result.skippedGuide.step).toBe('off');
  expect(result.skippedGuide.skipped).toBe(1);
  expect(result.skippedActions).toContain('Replay Guide');
  expect(result.replayedGuide.step).toBe('route');
  expect(result.replayedGuide.replays).toBe(1);
  expect(result.routeGuide.seen).toContain('route');
  expect(result.cardStage.step).toBe('card');
  expect(result.roostStage.step).toBe('roost');
  expect(result.rewardStage.step).toBe('reward');
  expect(result.completedGuide.completed).toBe(true);
  expect(result.completedGuide.enabled).toBe(false);
  expect(result.completedGuide.seen).toEqual(expect.arrayContaining(['route', 'card', 'roost', 'reward']));
});

test('contextual Molt lesson waits for a Molt card, respects skip, and retires after play', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const guideKey = 'birdsquad.firstFlightGuide';
    const baseGuide = {
      enabled: false,
      completed: false,
      routeCommits: 0,
      cardsPlayed: 0,
      roosts: 0,
      rewardsResolved: 0,
      seen: [],
      skipped: 1,
      replays: 0,
      moltLessonSeen: 0,
      moltLessonCompleted: false,
    };
    window.localStorage.setItem(guideKey, JSON.stringify(baseGuide));
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    for (let i = 0; i < 120 && (!scene.scene.isActive() || scene.combatAnimationPending); i += 1) await wait(50);
    const moltCard = scene.allDeckCards().find((card: any) => card.runtime?.kind === 'molt');
    if (!moltCard) throw new Error('Starter flight did not contain a Molt card.');
    scene.hand = scene.hand.filter((card: any) => card.instanceId !== moltCard.instanceId);
    scene.drawPile = scene.drawPile.filter((card: any) => card.instanceId !== moltCard.instanceId);
    scene.discardPile = scene.discardPile.filter((card: any) => card.instanceId !== moltCard.instanceId);
    scene.hand.unshift(moltCard);
    scene.energy = 99;
    scene.combatAnimationPending = false;
    scene.mode = 'battle';
    scene.renderAll();
    await wait(120);
    const skipped = JSON.parse(window.render_game_to_text!());

    window.localStorage.setItem(guideKey, JSON.stringify({
      ...baseGuide,
      completed: true,
      routeCommits: 1,
      cardsPlayed: 1,
      roosts: 1,
      rewardsResolved: 1,
      skipped: 0,
      seen: ['route', 'card', 'roost', 'reward'],
    }));
    scene.renderAll();
    for (let i = 0; i < 80; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.firstMoltGuide?.rendered) break;
      await wait(50);
      scene.renderAll();
    }
    const active = JSON.parse(window.render_game_to_text!());
    const activeObjects = scene.handLayer.list.filter((child: any) => child.name?.startsWith('combat-molt-guide'));
    const guideText = scene.root.list
      .filter((child: any) => typeof child.text === 'string' && child.text.includes('GUIDE: MOLT'))
      .map((child: any) => child.text);
    const storedSeen = JSON.parse(window.localStorage.getItem(guideKey) ?? '{}');

    scene.playCard(moltCard, scene.enemies.find((enemy: any) => enemy.hp > 0)?.id, { resolveDelayMs: 0 });
    await wait(100);
    const completed = JSON.parse(window.render_game_to_text!());
    const storedCompleted = JSON.parse(window.localStorage.getItem(guideKey) ?? '{}');
    const remainingGuideObjects = scene.handLayer.list.filter((child: any) => child.name?.startsWith('combat-molt-guide')).length;

    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    await wait(100);
    const restarted = JSON.parse(window.render_game_to_text!());
    return {
      cardName: active.firstMoltGuide.cardName,
      skipped: skipped.firstMoltGuide,
      active: active.firstMoltGuide,
      activeObjectNames: activeObjects.map((child: any) => child.name),
      guideText,
      storedSeen,
      completed: completed.firstMoltGuide,
      storedCompleted,
      remainingGuideObjects,
      restarted: restarted.firstMoltGuide,
    };
  });

  expect(result.skipped).toMatchObject({ eligible: false, active: false, seen: 0, completed: false, rendered: false });
  expect(result.active).toMatchObject({ eligible: true, active: true, seen: 1, completed: false, rendered: true });
  expect(result.cardName).toBe('Hot Feathers');
  expect(result.activeObjectNames).toContain('combat-molt-guide-pulse');
  expect(result.activeObjectNames).toContain('combat-molt-guide-tag');
  expect(result.guideText).toEqual([expect.stringContaining('Play Hot Feathers')]);
  expect(result.storedSeen.moltLessonSeen).toBe(1);
  expect(result.completed).toMatchObject({ eligible: false, active: false, seen: 1, completed: true, rendered: false });
  expect(result.storedCompleted.moltLessonCompleted).toBe(true);
  expect(result.remainingGuideObjects).toBe(0);
  expect(result.restarted).toMatchObject({ eligible: false, active: false, completed: true, rendered: false });
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

test('card previews preserve live effect ordering and selection stays incremental', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.combatAnimationPending = false;
    scene.runLeaderId = 'sky_guard';
    scene.routeMarks = [];
    scene.energy = 10;

    const card = scene.hand[0];
    card.target = 'enemy';
    card.role = 'attack';
    card.cost = 0;
    card.upgraded = false;
    card.runtime.effects = [
      'damage(enemy, 3)',
      'if targetHasCover then damagePierce(enemy, 2)'
    ];
    const enemy = scene.enemies[0];
    enemy.hp = Math.max(12, enemy.hp);
    enemy.block = 4;
    scene.selectedEnemyId = enemy.id;

    let fullRenderCount = 0;
    const originalRenderAll = scene.renderAll.bind(scene);
    scene.renderAll = (...args: unknown[]) => {
      fullRenderCount += 1;
      return originalRenderAll(...args);
    };
    scene.onCardClicked(card.instanceId);
    const preview = scene.simulateCardOutcome(card, enemy.id);
    const selectedOutcome = scene.selectedCardOutcomePreview();
    const selectedPreviewRendered = scene.root.list.some((child: any) => child.name === 'combat-selection-preview');
    const forecastObjects = scene.root.list.filter((child: any) => child.name === 'combat-enemy-outcome-preview');
    const forecastLabels = forecastObjects.filter((child: any) => typeof child.text === 'string').map((child: any) => child.text);
    scene.onCardClicked(card.instanceId);
    const forecastObjectsAfterDeselect = scene.root.list.filter((child: any) => child.name === 'combat-enemy-outcome-preview').length;
    scene.onCardClicked(card.instanceId);
    const hpBefore = enemy.hp;
    const coverBefore = enemy.block;
    const flowBefore = scene.flock.flow;
    const targetPreview = preview.enemyStates.find((candidate: any) => candidate.id === enemy.id);
    scene.playCard(card, enemy.id, { resolveDelayMs: 0 });

    return {
      selectionRenderCount: fullRenderCount - 1,
      selectedPreviewRendered,
      selectedOutcome,
      targetPreview,
      forecastObjectCount: forecastObjects.length,
      forecastLabels,
      forecastObjectsAfterDeselect,
      preview: {
        enemyDamage: preview.enemyDamage,
        blockedDamage: preview.blockedDamage,
        flowGain: preview.flowGain
      },
      live: {
        enemyDamage: hpBefore - enemy.hp,
        blockedDamage: coverBefore - enemy.block,
        flowGain: scene.flock.flow - flowBefore
      }
    };
  });

  expect(result.selectionRenderCount).toBe(0);
  expect(result.selectedPreviewRendered).toBe(true);
  expect(result.forecastObjectCount).toBe(4);
  expect(result.forecastLabels).toEqual([`AFTER ${result.targetPreview.hpAfter}`]);
  expect(result.forecastObjectsAfterDeselect).toBe(0);
  expect(result.selectedOutcome.summary).toContain(`Cohesion ${result.targetPreview.hpBefore} -> ${result.targetPreview.hpAfter}`);
  expect(result.selectedOutcome.result.targetHp).toEqual({
    enemyId: result.targetPreview.id,
    before: result.targetPreview.hpBefore,
    after: result.targetPreview.hpAfter,
    max: result.targetPreview.maxHp,
    defeated: false
  });
  expect(result.targetPreview.blockBefore - result.targetPreview.blockAfter).toBe(result.live.blockedDamage);
  expect(result.targetPreview.hpBefore - result.targetPreview.hpAfter).toBe(result.live.enemyDamage);
  expect(result.preview).toEqual(result.live);
  expect(result.preview).toEqual({ enemyDamage: 1, blockedDamage: 4, flowGain: 1 });
});

test('selected attacks identify lethal results before commitment', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.combatAnimationPending = false;
    scene.routeMarks = [];
    scene.energy = 10;

    const card = scene.hand[0];
    card.target = 'enemy';
    card.role = 'attack';
    card.cost = 0;
    card.upgraded = false;
    card.runtime.effects = ['damage(enemy, 99)'];
    const enemy = scene.enemies[0];
    enemy.hp = 5;
    enemy.block = 0;
    scene.selectedEnemyId = enemy.id;
    scene.onCardClicked(card.instanceId);

    const outcome = scene.selectedCardOutcomePreview();
    const markerLabels = scene.root.list
      .filter((child: any) => child.name === 'combat-enemy-outcome-preview' && typeof child.text === 'string')
      .map((child: any) => child.text);
    const markerCount = scene.root.list.filter((child: any) => child.name === 'combat-enemy-outcome-preview').length;
    scene.playCard(card, enemy.id, { resolveDelayMs: 0 });
    return { outcome, markerLabels, markerCount, liveHp: enemy.hp };
  });

  expect(result.outcome.summary).toContain('Cohesion 5 -> DEFEATED');
  expect(result.outcome.result.targetHp).toMatchObject({ before: 5, after: 0, defeated: true });
  expect(result.markerLabels).toEqual(['LETHAL']);
  expect(result.markerCount).toBe(4);
  expect(result.liveHp).toBe(0);
});

test('district contracts, encounter objectives, and leader mastery stay horizontal', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    window.localStorage.removeItem('birdsquad.account');
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    route.runState.combatResults = [{
      encounterId: 'guided-opening', nodeId: 'm1_entry', nodeType: 'street', enemyIds: [],
      turnsTaken: 1, damageDealt: 1, cohesionLost: 0, decisionStats: {}
    }];
    route.renderAll();
    const routeState = JSON.parse(window.render_game_to_text!());
    const contractChoice = routeState.districtContractChoice;
    const districtNodeIds = routeState.nodes.map((node: any) => node.id);
    const bossNodeId = routeState.nodes.find((node: any) => node.type === 'boss').id;
    route.chooseDistrictContract(contractChoice.options[0].id);
    const afterContract = JSON.parse(window.render_game_to_text!()).districtContract;
    const contractRendered = route.children.list.some((child: any) => child.name === 'district-contract');

    g.scene.stop('RouteScene');
    const battle: any = await window.__birdSquadStartScene!('BattleScene', { runState: route.runState, routeNodeId: 'm1_entry' });
    const initialObjective = battle.getTextState().encounterObjective;
    battle.flock.flow = 1;
    battle.enemies.forEach((enemy: any) => { enemy.hp = 0; });
    if (battle.encounterObjective?.targetEnemyId) battle.enemyDefeatedTurns.set(battle.encounterObjective.targetEnemyId, 1);
    battle.renderAll();
    const completeObjective = battle.getTextState().encounterObjective;
    const scrapBefore = battle.scrap;
    battle.applyCombatEconomyRewards();
    const objectiveAward = battle.scrap - scrapBefore;
    const snagCount = battle.allDeckCards().filter((card: any) => card.runtime.kind === 'snag').length;
    const contractCompletions: Record<string, boolean> = {};
    const contractCases = [
      { id: 'hold_line', prior: [{ nodeId: districtNodeIds[0], cohesionLost: 0 }], surges: 0, rewards: [] },
      { id: 'bright_signal', prior: [{ nodeId: districtNodeIds[0], cohesionLost: 1, surges: 1 }, { nodeId: districtNodeIds[1], cohesionLost: 1, surges: 1 }], surges: 1, rewards: [] },
      { id: 'lean_route', prior: [], surges: 0, rewards: [{ skipped: true }, { skipped: true }] },
      { id: 'clean_flight', prior: [], surges: 0, rewards: [] }
    ];
    for (const contractCase of contractCases) {
      battle.runCombatResults = contractCase.prior.map((entry: any, index: number) => ({
        encounterId: `prior-${index}`,
        nodeId: entry.nodeId,
        nodeType: 'street',
        enemyIds: [],
        turnsTaken: 1,
        damageDealt: 0,
        cohesionLost: entry.cohesionLost,
        decisionStats: { surgesTriggered: entry.surges ?? 0 }
      }));
      battle.statTaken = 0;
      battle.statSurgesTriggered = contractCase.surges;
      battle.runRewardEvents = contractCase.rewards;
      battle.runDistrictContracts = [{
        id: contractCase.id,
        mapIndex: 0,
        baselineCombatResults: 0,
        baselineRewardEvents: 0,
        baselineSnags: snagCount,
        completed: false
      }];
      battle.finalizeDistrictContract(bossNodeId);
      contractCompletions[contractCase.id] = battle.runDistrictContracts[0].completed;
    }
    battle.runDistrictContracts = [{
      id: 'clean_flight',
      mapIndex: 0,
      baselineCombatResults: 0,
      baselineRewardEvents: 0,
      baselineSnags: snagCount,
      completed: false
    }];
    battle.finalizeDistrictContract(bossNodeId);
    battle.emitRunSummary('loss');
    const account = JSON.parse(window.localStorage.getItem('birdsquad.account') ?? '{}');
    const celebrationRun = structuredClone(route.runState);
    celebrationRun.districtContracts = [{
      id: 'clean_flight', mapIndex: 0, baselineCombatResults: 0,
      baselineRewardEvents: 0, baselineSnags: 0, confirmed: true,
      completed: true, rewardClaimed: true, celebrated: false,
    }];
    const celebrationRoute: any = await window.__birdSquadStartScene!('RouteScene', { runState: celebrationRun });
    const celebrationInitial = JSON.parse(window.render_game_to_text!());
    const celebrationObjects = celebrationRoute.children.list
      .filter((child: any) => child.name?.startsWith('district-contract-celebration'))
      .map((child: any) => child.name);
    await window.advanceTime!(1950);
    await wait(100);
    const celebrationExpired = JSON.parse(window.render_game_to_text!()).districtContractCelebration;
    const celebratedPersisted = celebrationRoute.runState.districtContracts[0].celebrated;
    const checkpoint = JSON.parse(window.localStorage.getItem('birdsquad.run.active') ?? '{}');
    const completionCuesBeforeResume = window.__birdSquadAudio!().cueRequests.objectiveComplete ?? 0;
    const menu: any = await window.__birdSquadStartScene!('MenuScene');
    menu.continueRun();
    for (let i = 0; i < 120 && !g.scene.isActive('RouteScene'); i += 1) await wait(25);
    const resumedState = JSON.parse(window.render_game_to_text!());

    return {
      contractChoice,
      afterContract,
      contractRendered,
      initialObjective,
      completeObjective,
      objectiveAward,
      account,
      contractCompletions,
      cleanFlightComplete: battle.runDistrictContracts[0].completed,
      recordedContract: window.__birdSquadLastRun?.districtContracts?.[0],
      recordedObjective: window.__birdSquadLastRun?.combatResults?.at(-1)?.objective,
      celebrationInitial: celebrationInitial.districtContractCelebration,
      celebrationCueRequests: celebrationInitial.audio.cueRequests,
      celebrationObjects,
      celebrationExpired,
      celebratedPersisted,
      checkpointCelebrated: checkpoint.districtContracts?.[0]?.celebrated,
      resumedCelebration: resumedState.districtContractCelebration,
      completionCuesAfterResume: resumedState.audio.cueRequests.objectiveComplete ?? 0,
      completionCuesBeforeResume,
    };
  });

  expect(result.contractChoice.open).toBe(true);
  expect(result.contractChoice.options).toHaveLength(3);
  expect(result.contractChoice.options.every((choice: any) => choice.rewardScrap > 0)).toBe(true);
  expect(result.afterContract.id).toBe(result.contractChoice.options[0].id);
  expect(result.contractRendered).toBe(true);
  expect(result.initialObjective.status).toBe('active');
  expect(result.completeObjective.status).toBe('complete');
  expect(result.objectiveAward).toBeGreaterThanOrEqual(result.completeObjective.bonusScrap);
  expect(result.account.runsByLeader.fledgling).toBe(1);
  expect(result.account.contractBadges).toContain('0:clean_flight');
  expect(result.account.leaderProgress.fledgling.contracts).toBe(1);
  expect(result.contractCompletions).toEqual({ hold_line: true, bright_signal: true, lean_route: true, clean_flight: true });
  expect(result.cleanFlightComplete).toBe(true);
  expect(result.recordedContract).toMatchObject({ id: 'clean_flight', completed: true });
  expect(result.recordedObjective.status).toBe('complete');
  expect(result.celebrationInitial).toMatchObject({
    id: 'clean_flight', name: 'Clean Flight', rewardScrap: 20, rendered: true,
  });
  expect(result.celebrationInitial.remainingMs).toBeGreaterThan(0);
  expect(result.celebrationInitial.remainingMs).toBeLessThanOrEqual(1800);
  expect(result.celebrationCueRequests.objectiveComplete).toBeGreaterThanOrEqual(1);
  expect(result.celebrationObjects).toEqual(expect.arrayContaining([
    'district-contract-celebration-frame',
    'district-contract-celebration',
  ]));
  expect(result.celebrationExpired).toBeUndefined();
  expect(result.celebratedPersisted).toBe(true);
  expect(result.checkpointCelebrated).toBe(true);
  expect(result.resumedCelebration).toBeUndefined();
  expect(result.completionCuesAfterResume).toBe(result.completionCuesBeforeResume);
});

test('encounter objectives are seeded, varied, and resolve from visible combat state', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.runCombatResults = [
      { nodeId: 'prior-flight-1' },
      { nodeId: 'prior-flight-2' },
      { nodeId: 'prior-flight-3' }
    ];
    const objectives = Array.from({ length: 24 }, (_value, index) => scene.createEncounterObjective({
      id: `objective-${index}`,
      type: 'street',
      risk: 'medium'
    }));
    const repeatA = scene.createEncounterObjective({ id: 'repeat-objective', type: 'street', risk: 'medium' });
    const repeatB = scene.createEncounterObjective({ id: 'repeat-objective', type: 'street', risk: 'medium' });

    scene.encounterObjective = { type: 'clean_roost', title: 'Measured Flight', description: '', bonusScrap: 14 };
    scene.statOverextensions = 1;
    const failedRestraint = scene.encounterObjectiveStatus();
    scene.encounterObjective = { type: 'trigger_surge', title: 'Bright Signal', description: '', bonusScrap: 15 };
    scene.statSurgesTriggered = 1;
    const completedSurge = scene.encounterObjectiveStatus();

    scene.enemies.forEach((enemy: any) => { enemy.hp = Math.max(1, enemy.hp); });
    scene.encounterObjective = { type: 'bank_wingbeat', title: 'Keep A Reserve', description: '', bonusScrap: 14, targetAmount: 1 };
    scene.statUnspentWingbeatAtRoost = 1;
    const bankedProgress = scene.encounterObjectiveTextState();
    scene.enemies.forEach((enemy: any) => { enemy.hp = 0; });
    const completedReserve = scene.encounterObjectiveStatus();

    scene.enemies.forEach((enemy: any) => { enemy.hp = 1; });
    scene.encounterObjective = { type: 'block_damage', title: 'Breakwater Guard', description: '', bonusScrap: 15, targetAmount: 8 };
    scene.statBlocked = 5;
    const blockedProgress = scene.encounterObjectiveTextState();
    scene.statBlocked = 8;
    scene.enemies.forEach((enemy: any) => { enemy.hp = 0; });
    const completedGuard = scene.encounterObjectiveStatus();

    return {
      types: [...new Set(objectives.map((objective: any) => objective.type))],
      deterministic: repeatA.type === repeatB.type && repeatA.title === repeatB.title,
      failedRestraint: failedRestraint.status,
      completedSurge: completedSurge.status,
      bankedProgress: bankedProgress.progress,
      completedReserve: completedReserve.status,
      blockedProgress: blockedProgress.progress,
      completedGuard: completedGuard.status
    };
  });

  expect(result.types.length).toBeGreaterThanOrEqual(4);
  expect(result.deterministic).toBe(true);
  expect(result.failedRestraint).toBe('failed');
  expect(result.completedSurge).toBe('complete');
  expect(result.bankedProgress).toEqual({ current: 1, target: 1, label: 'Wingbeat banked 1/1' });
  expect(result.completedReserve).toBe('complete');
  expect(result.blockedProgress).toEqual({ current: 5, target: 8, label: 'Damage blocked 5/8' });
  expect(result.completedGuard).toBe('complete');
});

test('district encounter goals create distinct strategic objective pools', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const baseRunState = structuredClone(route.runState);
    const pools = [];
    for (let mapIndex = 0; mapIndex < 4; mapIndex += 1) {
      const scene: any = await window.__birdSquadStartScene!('BattleScene', {
        routeNodeId: `m${mapIndex + 1}_entry`,
        runState: {
          ...structuredClone(baseRunState),
          mapIndex,
          seed: `district-objectives-${mapIndex}`,
          combatResults: [
            { encounterId: '', nodeId: 'prior-1', nodeType: 'street', enemyIds: [], turnsTaken: 1, damageDealt: 0, cohesionLost: 0 },
            { encounterId: '', nodeId: 'prior-2', nodeType: 'street', enemyIds: [], turnsTaken: 1, damageDealt: 0, cohesionLost: 0 },
            { encounterId: '', nodeId: 'prior-3', nodeType: 'street', enemyIds: [], turnsTaken: 1, damageDealt: 0, cohesionLost: 0 }
          ]
        }
      });
      const types = new Set<string>();
      for (let index = 0; index < 48; index += 1) {
        const objective = scene.createEncounterObjective({
          id: `district-${mapIndex}-objective-${index}`,
          type: 'street',
          risk: 'medium'
        });
        if (objective) types.add(objective.type);
      }
      pools.push([...types].sort());
    }
    return pools;
  });

  expect(result[0]).toEqual(expect.arrayContaining(['clean_roost', 'finish_guarded', 'preserve_flow']));
  expect(result[0]).not.toContain('block_damage');
  expect(result[1]).toEqual(expect.arrayContaining(['bank_wingbeat', 'block_damage', 'no_damage']));
  expect(result[1]).not.toContain('trigger_surge');
  expect(result[2]).toEqual(expect.arrayContaining(['bank_wingbeat', 'preserve_flow', 'trigger_surge']));
  expect(result[2]).not.toContain('block_damage');
  expect(result[3]).toEqual(expect.arrayContaining(['bank_wingbeat', 'block_damage', 'swift_clear']));
  expect(result[3]).not.toContain('trigger_surge');
});

test('encounter goal HUD shows live progress and an explanatory tooltip', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    scene.encounterObjective = {
      type: 'bank_wingbeat',
      title: 'Keep A Reserve',
      description: 'Roost with at least 1 Wingbeat unspent, then win',
      bonusScrap: 14,
      targetAmount: 1
    };
    scene.statUnspentWingbeatAtRoost = 1;
    scene.requestBattleRender();
    let objectiveText: any;
    let panel: any;
    for (let i = 0; i < 80; i += 1) {
      objectiveText = scene.root?.list.find((child: any) => child.name === 'encounter-objective' && child.type === 'Text');
      panel = scene.root?.list.find((child: any) => child.name === 'encounter-objective' && child.type === 'Rectangle');
      if (objectiveText?.text.includes('Wingbeat banked 1/1') && panel?.input?.enabled) break;
      await wait(50);
    }
    panel.emit('pointerover');
    await wait(20);
    const tooltipTexts = scene.root.list
      .filter((child: any) => child.type === 'Container')
      .flatMap((container: any) => container.list ?? [])
      .filter((child: any) => child.type === 'Text')
      .map((child: any) => child.text);
    const state = JSON.parse(window.render_game_to_text!()).encounterObjective;
    return {
      hudText: objectiveText?.text,
      panelInteractive: !!panel?.input?.enabled,
      tooltipTexts,
      state
    };
  });

  expect(result.hudText).toContain('Keep A Reserve');
  expect(result.hudText).toContain('Wingbeat banked 1/1');
  expect(result.hudText).toContain('+14');
  expect(result.panelInteractive).toBe(true);
  expect(result.tooltipTexts).toContain('Keep A Reserve');
  expect(result.tooltipTexts.some((text: string) => text.includes('Roost with at least 1 Wingbeat unspent'))).toBe(true);
  expect(result.state.progress).toEqual({ current: 1, target: 1, label: 'Wingbeat banked 1/1' });
});

test('priority encounter goal marks its enemy beside the Tell and exposes the deadline', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const target = scene.enemies[0];
    scene.turn = 2;
    scene.encounterObjective = {
      type: 'priority',
      title: 'Break The Signal',
      description: `Defeat ${target.name} by Beat 3`,
      bonusScrap: 14,
      targetEnemyId: target.id,
      deadlineTurn: 3
    };
    scene.requestBattleRender();

    const objectiveObjects = () => scene.root.list.filter((child: any) => child.name === 'combat-objective-target');
    for (let i = 0; i < 80 && objectiveObjects().length < 2; i += 1) await wait(50);
    const activePanel = objectiveObjects().find((child: any) => child.type === 'Rectangle');
    const activeText = objectiveObjects().find((child: any) => child.type === 'Text')?.text;
    const panelInteractive = !!activePanel?.input?.enabled;
    activePanel.emit('pointerover');
    await wait(20);
    const tooltipTexts = scene.root.list
      .filter((child: any) => child.type === 'Container')
      .flatMap((container: any) => container.list ?? [])
      .filter((child: any) => child.type === 'Text')
      .map((child: any) => child.text);

    scene.turn = 4;
    scene.requestBattleRender();
    let failedText = '';
    for (let i = 0; i < 80; i += 1) {
      failedText = objectiveObjects().find((child: any) => child.type === 'Text')?.text ?? '';
      if (failedText === 'OBJECTIVE MISSED') break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!()).encounterObjective;
    return {
      activeText,
      failedText,
      panelInteractive,
      tooltipTexts,
      state
    };
  });

  expect(result.activeText).toBe('OBJECTIVE  /  2 BEATS');
  expect(result.failedText).toBe('OBJECTIVE MISSED');
  expect(result.panelInteractive).toBe(true);
  expect(result.tooltipTexts).toContain('Break The Signal');
  expect(result.tooltipTexts.some((text: string) => text.includes('Complete the goal for +14 Scrap'))).toBe(true);
  expect(result.state.status).toBe('failed');
  expect(result.state.progress.label).toContain('Beat 4/3');
});

test('encounter objective feedback celebrates or softens failure once with matching audio', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const read = () => JSON.parse(window.render_game_to_text!());
    const feedbackText = (scene: any) => {
      const group = scene.fxLayer.list.find((child: any) => child.name === 'combat-objective-feedback');
      return group?.list.find((child: any) => child.type === 'Text')?.text ?? '';
    };
    const g = window.__birdSquadGame;

    const missedScene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const missedTarget = missedScene.enemies[0];
    missedScene.encounterObjective = {
      type: 'priority',
      title: 'Break The Signal',
      description: `Defeat ${missedTarget.name} by Beat 3`,
      bonusScrap: 14,
      targetEnemyId: missedTarget.id,
      deadlineTurn: 3
    };
    missedScene.encounterObjectiveFeedbackStatus = 'active';
    missedScene.turn = 4;
    missedScene.requestBattleRender();
    for (let index = 0; index < 80 && read().encounterObjectiveFeedback?.status !== 'failed'; index += 1) await wait(50);
    const missedState = read();
    const missedText = feedbackText(missedScene);
    missedScene.requestBattleRender();
    await wait(100);
    const missedAfterDuplicateRender = read();

    const completeScene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    const completeTarget = completeScene.enemies[0];
    completeTarget.hp = 1;
    completeScene.encounterObjective = {
      type: 'priority',
      title: 'Break The Signal',
      description: `Defeat ${completeTarget.name} by Beat 3`,
      bonusScrap: 14,
      targetEnemyId: completeTarget.id,
      deadlineTurn: 3
    };
    completeScene.encounterObjectiveFeedbackStatus = 'active';
    completeScene.damageEnemy(completeTarget.id, 1, 'Objective feedback test');
    completeScene.requestBattleRender();
    for (let index = 0; index < 80 && read().encounterObjectiveFeedback?.status !== 'complete'; index += 1) await wait(50);
    const completeState = read();
    const completeText = feedbackText(completeScene);
    completeScene.requestBattleRender();
    await wait(100);
    const completeAfterDuplicateRender = read();

    return {
      missed: {
        text: missedText,
        feedback: missedState.encounterObjectiveFeedback,
        cue: missedState.audio.cueRequests.objectiveMissed ?? 0,
        duplicateBursts: missedAfterDuplicateRender.encounterObjectiveFeedback.bursts,
        duplicateCue: missedAfterDuplicateRender.audio.cueRequests.objectiveMissed ?? 0
      },
      complete: {
        text: completeText,
        feedback: completeState.encounterObjectiveFeedback,
        cue: completeState.audio.cueRequests.objectiveComplete ?? 0,
        duplicateBursts: completeAfterDuplicateRender.encounterObjectiveFeedback.bursts,
        duplicateCue: completeAfterDuplicateRender.audio.cueRequests.objectiveComplete ?? 0
      }
    };
  });

  expect(result.missed.text).toBe('GOAL MISSED');
  expect(result.missed.feedback).toEqual({ status: 'failed', bursts: 1, rendered: true });
  expect(result.missed.cue).toBe(1);
  expect(result.missed.duplicateBursts).toBe(1);
  expect(result.missed.duplicateCue).toBe(1);
  expect(result.complete.text).toBe('GOAL COMPLETE  +14');
  expect(result.complete.feedback).toEqual({ status: 'complete', bursts: 1, rendered: true });
  expect(result.complete.cue).toBe(1);
  expect(result.complete.duplicateBursts).toBe(1);
  expect(result.complete.duplicateCue).toBe(1);
});

test('combat starts after essential FX while specialized FX stream during the intro', async ({ page }) => {
  await boot(page);
  const state = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    return {
      essentialReady: scene.textures.exists('combat-encounter-intro'),
      fxPresenter: JSON.parse(window.render_game_to_text!()).battleFxPresenter,
      debugState: JSON.parse(window.render_game_to_text!()).battleDebugState,
      backdropRenderer: JSON.parse(window.render_game_to_text!()).battleBackdropRenderer,
      foregroundRenderer: JSON.parse(window.render_game_to_text!()).battleForegroundRenderer,
      hudRenderer: JSON.parse(window.render_game_to_text!()).battleHudRenderer,
      handRenderer: JSON.parse(window.render_game_to_text!()).battleHandRenderer,
      rewardRenderer: JSON.parse(window.render_game_to_text!()).battleRewardRenderer,
      optionalRequested: scene.combatOptionalFxAssetsRequested,
      enemyTurnRequested: scene.combatEnemyTurnFxAssetsRequested,
      mode: scene.mode
    };
  });

  expect(state.essentialReady).toBe(true);
  expect(state.fxPresenter).toEqual({ ready: true, loaded: true });
  expect(state.debugState).toEqual({ ready: true, loaded: true });
  expect(state.backdropRenderer).toEqual({ ready: true, loaded: true });
  expect(state.foregroundRenderer).toEqual({ ready: true, loaded: true });
  expect(state.hudRenderer).toEqual({ ready: true, loaded: true });
  expect(state.handRenderer).toEqual({ ready: true, loaded: true });
  expect(state.rewardRenderer).toEqual({ requested: false, ready: false, loaded: false, failed: false });
  expect(state.optionalRequested).toBe(true);
  expect(state.enemyTurnRequested).toBe(true);
  expect(state.mode).toBe('battle');
});

test('unsupported displays pause the game while landscape tablets remain playable', async ({ page }) => {
  const markup = await (await page.request.get('/')).text();
  expect(markup).toContain('Desktop + landscape tablet');
  expect(markup).toContain('bird-squad-bold-streetwear-splash-v3-gate-');
  expect(markup).toMatch(/bird-squad-bold-streetwear-splash-v3-gate-[^"']+\.webp/);

  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await page.waitForFunction(() => window.__birdSquadGame?.loop.running === false);
  const portrait = await page.evaluate(() => ({
    gate: getComputedStyle(document.querySelector('#portrait-gate')!).display,
    game: getComputedStyle(document.querySelector('#game-container')!).display,
    ariaHidden: document.querySelector('#portrait-gate')?.getAttribute('aria-hidden'),
    title: document.querySelector('#portrait-gate-title')?.textContent,
    requirement: document.querySelector('.portrait-gate-title')?.textContent,
    art: (() => {
      const image = document.querySelector<HTMLImageElement>('.portrait-gate-art');
      return {
        currentSrc: image?.currentSrc ?? '',
        complete: image?.complete ?? false,
        naturalWidth: image?.naturalWidth ?? 0,
        loading: image?.loading ?? '',
      };
    })(),
    frame: window.__birdSquadGame.loop.frame,
  }));
  await page.waitForTimeout(250);
  const pausedFrame = await page.evaluate(() => window.__birdSquadGame.loop.frame);

  await page.setViewportSize({ width: 844, height: 390 });
  const compactLandscape = await page.evaluate(() => ({
    gate: getComputedStyle(document.querySelector('#portrait-gate')!).display,
    game: getComputedStyle(document.querySelector('#game-container')!).display,
    running: window.__birdSquadGame.loop.running,
  }));

  await page.setViewportSize({ width: 1000, height: 560 });
  await page.waitForFunction(() => window.__birdSquadGame?.loop.running === true);
  await page.screenshot({ path: '.artifacts/test-results/min-supported/title-1000x560.png' });
  const tablet = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!.getBoundingClientRect();
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    const targetPositions = [
      { name: 'audio', x: 48, y: 38 },
      { name: 'help', x: 744, y: 38 },
      { name: 'settings', x: 892, y: 38 },
      { name: 'codex', x: 1040, y: 38 },
      { name: 'record', x: 1188, y: 38 },
      { name: 'difficulty-down', x: 100, y: 632 },
      { name: 'difficulty-up', x: 356, y: 632 },
      { name: 'quick-flight', x: 456, y: 640 },
      { name: 'full-flight', x: 544, y: 640 },
      { name: 'start-run', x: 780, y: 642 },
    ];
    const rectangles = menu.children.list.filter((child: any) => child.type === 'Rectangle' && child.input?.enabled);
    const scaleX = canvas.width / 1280;
    const scaleY = canvas.height / 720;
    return {
      gate: getComputedStyle(document.querySelector('#portrait-gate')!).display,
      game: getComputedStyle(document.querySelector('#game-container')!).display,
      ariaHidden: document.querySelector('#portrait-gate')?.getAttribute('aria-hidden'),
      targets: targetPositions.map((target) => {
        const rectangle = rectangles.find((item: any) => item.x === target.x && item.y === target.y);
        return {
          name: target.name,
          found: Boolean(rectangle),
          cssWidth: rectangle ? rectangle.width * scaleX : 0,
          cssHeight: rectangle ? rectangle.height * scaleY : 0,
        };
      }),
    };
  });

  expect(portrait.gate).not.toBe('none');
  expect(portrait.game).toBe('none');
  expect(portrait.ariaHidden).toBe('false');
  expect(portrait.title).toBe('Bird Squad');
  expect(portrait.requirement).toContain('Landscape');
  expect(portrait.art.currentSrc).toContain('bird-squad-bold-streetwear-splash-v3-gate');
  expect(portrait.art.currentSrc).toMatch(/\.webp$/);
  expect(portrait.art.complete).toBe(true);
  expect(portrait.art.naturalWidth).toBe(1280);
  expect(portrait.art.loading).toBe('lazy');
  expect(pausedFrame).toBe(portrait.frame);
  expect(compactLandscape.gate).not.toBe('none');
  expect(compactLandscape.game).toBe('none');
  expect(compactLandscape.running).toBe(false);
  expect(tablet.gate).toBe('none');
  expect(tablet.game).not.toBe('none');
  expect(tablet.ariaHidden).toBe('true');
  expect(tablet.targets.filter((target) => !target.found)).toEqual([]);
  for (const target of tablet.targets) {
    expect(target.cssWidth, target.name).toBeGreaterThanOrEqual(44);
    expect(target.cssHeight, target.name).toBeGreaterThanOrEqual(44);
  }
});

test('production security policy boots without inline-script exceptions', async ({ page }) => {
  const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; worker-src 'self' blob:";
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': csp,
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
      },
    });
  });
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(String(error)));

  await boot(page);
  const result = await page.evaluate(() => ({
    scene: JSON.parse(window.render_game_to_text?.() ?? '{}').scene,
    inlineScripts: [...document.scripts].filter((script) => !script.src && script.textContent?.trim()).length,
    gateHidden: document.querySelector('#portrait-gate')?.getAttribute('aria-hidden'),
    canvas: Boolean(document.querySelector('canvas')),
  }));

  expect(result).toEqual({ scene: 'MenuScene', inlineScripts: 0, gateHidden: 'true', canvas: true });
  expect(browserErrors).toEqual([]);
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
        const seenCenters = new Set<string>();
        const nodes = state.nodes.map((node: any) => ({ id: node.id, position: node.position, bounds: node.visualBounds }));
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
        }
      }
    }
    return failures;
  });
  expect(layoutFailures).toEqual([]);
});

test('mixed route card-choice rewards preserve the card choice before opening Preen', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
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
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    route.runState.deck = [
      { id: 'major_00' },
      { id: 'major_01' },
      { id: 'major_02' }
    ];
    const node = { id: 'audit_tangled_antenna', type: 'signal', label: 'Tangled Antenna', payloadId: 'rooftop_tangled_antenna' };
    const choice = {
      key: 'untangle',
      text: 'Untangle carefully.',
      effects: ['addCard(chooseOneOfTwoUncommonOrRare)', 'preenCard(1)'],
      locked: false
    };
    route.openRouteRewardMenu(node, choice, structuredClone(route.runState));
    for (let i = 0; i < 40 && !route.textures.exists('ui-icon-reward-reveal-halo'); i += 1) await wait(50);
    route.renderAll();
    for (let i = 0; i < 40; i += 1) {
      if (collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-reward-reveal-halo')) break;
      await wait(50);
    }
    const offered = route.routeCardRewardChoices.map((card: any) => card.id);
    const rewardRevealHaloLoaded = route.textures.exists('ui-icon-reward-reveal-halo');
    const rewardRevealHaloRendered = collectObjects(route.children).some((child: any) => child.texture?.key === 'ui-icon-reward-reveal-halo');
    route.chooseRouteRewardCard(offered[0]);
    return {
      offered,
      rewardRevealHaloLoaded,
      rewardRevealHaloRendered,
      deckIds: route.runState.deck.map((card: any) => card.id),
      cardPickerMode: route.cardPickerMode,
      remainingPicks: route.cardPickerRemainingPicks,
      pendingCleared: !route.pendingRouteReward,
      choicesCleared: route.routeCardRewardChoices.length
    };
  });

  expect(result.offered).toHaveLength(2);
  expect(result.rewardRevealHaloLoaded).toBe(true);
  expect(result.rewardRevealHaloRendered).toBe(true);
  expect(result.deckIds).toContain(result.offered[0]);
  expect(result.deckIds).not.toContain(result.offered[1]);
  expect(result.cardPickerMode).toBe('preen');
  expect(result.remainingPicks).toBe(1);
  expect(result.pendingCleared).toBe(true);
  expect(result.choicesCleared).toBe(0);
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

test('route supply feedback renders generated frame behind toast', async ({ page }) => {
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
      const nested = Array.isArray(child.list) ? countTexture(child.list, key) : 0;
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
      if (state.routeSupplyFeedbackFrame?.loaded && state.routeSupplyFeedbackFrame?.rendered) break;
      await wait(25);
    }
    const state = JSON.parse(window.render_game_to_text!());
    const frameObjects = countTexture(route.children.list);
    return {
      feedback: state.supplyFeedback?.[0],
      routeSupplyFeedbackFrame: state.routeSupplyFeedbackFrame,
      frameObjects,
      used: route.runState.suppliesUsed,
    };
  });

  expect(result.feedback?.id).toBe('feather_splint');
  expect(result.used).toEqual(['feather_splint']);
  expect(result.routeSupplyFeedbackFrame).toEqual({ loaded: true, rendered: true, count: result.frameObjects });
  expect(result.frameObjects).toBeGreaterThanOrEqual(1);
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
    cleanScene.endTurn();
    const retainedAfterEnemy = cardsForNoDamage.filter((id: string) => cleanScene.hand.some((card: any) => card.instanceId === id));
    const duplicatedAfterEnemy = retainedAfterEnemy.filter((id: string) => cleanScene.discardPile.some((card: any) => card.instanceId === id));

    return {
      retainedFromHand,
      duplicatedFromHand,
      retainedAfterEnemy,
      duplicatedAfterEnemy
    };
  });

  expect(result.retainedFromHand).toHaveLength(1);
  expect(result.duplicatedFromHand).toHaveLength(0);
  expect(result.retainedAfterEnemy).toHaveLength(1);
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

test('a combat route node resolves through its encounter', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.damageEnemy(enemy.id, 3, 'Smoke impact check');
    const state = window.__birdSquadState!();
    return {
      enemies: state.enemies.map((e: any) => e.name),
      battleHudRail: state.battleHudRail,
      enemyIntentRing: state.enemyIntentRing,
      combatEncounterIntro: state.combatEncounterIntro,
      combatImpactFlash: state.combatImpactFlash,
      combatPlayerHitConfirm: state.combatPlayerHitConfirm,
      combatActionTrail: state.combatActionTrail,
      combatCastFocusBurst: state.combatCastFocusBurst,
      combatWingbeatSpend: state.combatWingbeatSpend,
      combatEnemySwipe: state.combatEnemySwipe,
      combatFlockImpactBurst: state.combatFlockImpactBurst,
      combatCoverGuard: state.combatCoverGuard,
      combatCoverBlockBurst: state.combatCoverBlockBurst,
      combatEnemyCoverBlock: state.combatEnemyCoverBlock,
      combatPerfectBraceRiposte: state.combatPerfectBraceRiposte,
      combatHealBloom: state.combatHealBloom,
      combatEnemyMend: state.combatEnemyMend,
      combatEnemyCover: state.combatEnemyCover,
      combatCoverShatter: state.combatCoverShatter,
      combatCardDraw: state.combatCardDraw,
      combatDiscardSweep: state.combatDiscardSweep,
      combatShuffleVortex: state.combatShuffleVortex,
      combatFouledPressure: state.combatFouledPressure,
      combatRuffledBreak: state.combatRuffledBreak,
      combatResonanceSurge: state.combatResonanceSurge,
      combatResonanceSpend: state.combatResonanceSpend,
      combatWingbeatSurge: state.combatWingbeatSurge,
      combatWingbeatDrain: state.combatWingbeatDrain,
      combatWindedGust: state.combatWindedGust,
      combatFlowSurge: state.combatFlowSurge,
      combatCleanseBurst: state.combatCleanseBurst,
      combatBankCache: state.combatBankCache,
      combatThreatCharge: state.combatThreatCharge,
      combatEnemyRecoveryAfterglow: state.combatEnemyRecoveryAfterglow,
      combatMoltShift: state.combatMoltShift,
      combatOpenSkyGuard: state.combatOpenSkyGuard,
      combatOpenSkyExposure: state.combatOpenSkyExposure,
      combatVictoryRally: state.combatVictoryRally,
      combatVictoryFanfareSigil: state.combatVictoryFanfareSigil,
      combatAtmosphereStrip: state.combatAtmosphereStrip,
      combatCardBack: state.combatCardBack,
      combatTargetReticle: state.combatTargetReticle,
      combatTargetLockPulse: state.combatTargetLockPulse,
    };
  });
  const castResult = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatActionTrailBursts = 0;
    scene.combatCastFocusBurstBursts = 0;
    scene.combatWingbeatSpendBursts = 0;
    scene.energy = 99;
    const paidCard = scene.hand.find((candidate: any) => scene.effectiveCost(candidate) > 0) ?? scene.hand[0];
    const spendCost = scene.effectiveCost(paidCard);
    scene.playCard(paidCard, scene.enemies.find((candidate: any) => candidate.hp > 0).id);
    await wait(350);
    const state = window.__birdSquadState!();
    return {
      hand: state.hand.length,
      spendCost,
      combatActionTrail: state.combatActionTrail,
      combatCastFocusBurst: state.combatCastFocusBurst,
      combatWingbeatSpend: state.combatWingbeatSpend,
    };
  });
  const deferredOutcomeResult = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const keys = ['combat-victory-rally', 'combat-victory-fanfare-sigil', 'combat-boss-phase-break'];
    const before = keys.map((key) => scene.textures.exists(key));
    scene.energy = 99;
    const card = scene.hand[0];
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.playCardAnimated(card, enemy.id);
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (keys.every((key) => scene.textures.exists(key))) break;
      await wait(25);
    }
    return { before, after: keys.map((key) => scene.textures.exists(key)) };
  });
  const enemySwipeResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatEnemySwipeBursts = 0;
    scene.combatFlockImpactBurstBursts = 0;
    scene.flock.block = 0;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.damageFlock(enemy, 7);
    const state = window.__birdSquadState!();
    return {
      flockHp: state.flock.hp,
      flockMaxHp: state.flock.maxHp,
      combatEnemySwipe: state.combatEnemySwipe,
      combatFlockImpactBurst: state.combatFlockImpactBurst,
    };
  });
  const coverGuardResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatCoverGuardBursts = 0;
    scene.combatCoverBlockBurstBursts = 0;
    scene.flock.block = 99;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.damageFlock(enemy, 7);
    const state = window.__birdSquadState!();
    return {
      flockHp: state.flock.hp,
      flockMaxHp: state.flock.maxHp,
      flockBlock: state.flock.block,
      combatCoverGuard: state.combatCoverGuard,
      combatCoverBlockBurst: state.combatCoverBlockBurst,
      log: state.log,
    };
  });
  const coverBuildResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatCoverGuardBursts = 0;
    scene.flock.block = 0;
    scene.gainBlock(6, 'Smoke cover build check');
    const state = window.__birdSquadState!();
    return {
      flockBlock: state.flock.block,
      combatCoverGuard: state.combatCoverGuard,
    };
  });
  const enemyCoverBlockResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatEnemyCoverBlockBursts = 0;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    enemy.block = 12;
    scene.firstAttackThisTurn = false;
    const hpBefore = enemy.hp;
    const blockBefore = enemy.block;
    const audioBefore = JSON.parse(window.render_game_to_text!()).audio?.cueRequests?.coverBlock ?? 0;
    scene.damageEnemy(enemy.id, 5, 'Smoke cover block check');
    const state = window.__birdSquadState!();
    return {
      hpBefore,
      hpAfter: state.enemies.find((candidate: any) => candidate.id === enemy.id)?.hp,
      blockBefore,
      blockAfter: state.enemies.find((candidate: any) => candidate.id === enemy.id)?.block,
      combatEnemyCoverBlock: state.combatEnemyCoverBlock,
      coverBlockCueBefore: audioBefore,
      coverBlockCueAfter: state.audio?.cueRequests?.coverBlock ?? 0,
    };
  });
  const healBloomResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatHealBloomBursts = 0;
    scene.flock.hp = Math.max(1, scene.flock.maxHp - 9);
    scene.healFlock(5, 'Smoke heal check');
    const state = window.__birdSquadState!();
    return {
      flockHp: state.flock.hp,
      flockMaxHp: state.flock.maxHp,
      combatHealBloom: state.combatHealBloom,
    };
  });
  const resonanceSurgeResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatResonanceSurgeBursts = 0;
    scene.spark = 0;
    scene.gainResonance(2);
    const state = window.__birdSquadState!();
    return {
      resonance: state.resonance,
      combatResonanceSurge: state.combatResonanceSurge,
    };
  });
  const cardDrawResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatCardDrawBursts = 0;
    const handBefore = scene.hand.length;
    const drawBefore = scene.drawPile.length;
    scene.drawCards(1);
    const state = window.__birdSquadState!();
    return {
      handBefore,
      drawBefore,
      handAfter: state.hand.length,
      drawAfter: state.drawPile,
      combatCardDraw: state.combatCardDraw,
    };
  });
  const discardSweepResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatDiscardSweepBursts = 0;
    const handBefore = scene.hand.length;
    const discardBefore = scene.discardPile.length;
    const discarded = scene.discardCards(1);
    const state = window.__birdSquadState!();
    return {
      handBefore,
      discardBefore,
      discarded,
      handAfter: state.hand.length,
      discardAfter: state.discardPile,
      combatDiscardSweep: state.combatDiscardSweep,
    };
  });
  const shuffleVortexResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatShuffleVortexBursts = 0;
    const seed = scene.hand.splice(0, 2);
    scene.drawPile = [];
    scene.discardPile = seed;
    const discardBefore = scene.discardPile.length;
    const handBefore = scene.hand.length;
    scene.drawCards(1);
    const state = window.__birdSquadState!();
    return {
      discardBefore,
      handBefore,
      handAfter: state.hand.length,
      drawAfter: state.drawPile,
      discardAfter: state.discardPile,
      combatShuffleVortex: state.combatShuffleVortex,
    };
  });
  const ruffledBreakResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatRuffledBreakBursts = 0;
    scene.flock.frail = 0;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.resolveEnemyEffect(enemy, 'applyFrail(flock, 2)');
    const state = window.__birdSquadState!();
    return {
      statuses: state.flock.statuses,
      combatRuffledBreak: state.combatRuffledBreak,
    };
  });
  const resonanceSpendResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatResonanceSpendBursts = 0;
    scene.spark = 3;
    const spent = scene.spendResonance(2);
    const state = window.__birdSquadState!();
    return {
      spent,
      resonance: state.resonance,
      combatResonanceSpend: state.combatResonanceSpend,
    };
  });
  const wingbeatSurgeResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatWingbeatSurgeBursts = 0;
    scene.energy = 3;
    scene.applySupplyEffect('gainWingbeat(2)', 'Smoke wingbeat check');
    const state = window.__birdSquadState!();
    return {
      energy: state.energy,
      combatWingbeatSurge: state.combatWingbeatSurge,
    };
  });
  const wingbeatDrainResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatWingbeatDrainBursts = 0;
    scene.energy = 3;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.resolveEnemyEffect(enemy, 'loseWingbeat(flock, 2)');
    const state = window.__birdSquadState!();
    return {
      energy: state.energy,
      combatWingbeatDrain: state.combatWingbeatDrain,
    };
  });
  const windedGustResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatWindedGustBursts = 0;
    scene.flock.weak = 0;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.resolveEnemyEffect(enemy, 'applyWinded(flock, 2)');
    const state = window.__birdSquadState!();
    return {
      statuses: state.flock.statuses,
      combatWindedGust: state.combatWindedGust,
    };
  });
  const flowSurgeResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatFlowSurgeBursts = 0;
    scene.flock.flow = 0;
    scene.buildFlow({ builtFlow: false });
    const state = window.__birdSquadState!();
    return {
      flow: state.flow,
      combatFlowSurge: state.combatFlowSurge,
    };
  });
  const cleanseBurstResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatCleanseBurstBursts = 0;
    scene.flock.weak = 2;
    scene.flock.frail = 1;
    scene.flock.fouled = 1;
    scene.cleanseFlock(2, 'Smoke cleanse check');
    const state = window.__birdSquadState!();
    return {
      statuses: state.flock.statuses,
      combatCleanseBurst: state.combatCleanseBurst,
    };
  });
  const bankCacheResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatBankCacheBursts = 0;
    scene.nextTurnEnergyBonus = 0;
    scene.nextTurnDrawBonus = 0;
    scene.pendingRetainHand = 0;
    scene.applySupplyEffect('gainEnergyNextTurn(2)', 'Smoke bank check');
    scene.applySupplyEffect('nextTurnDraw(1)', 'Smoke bank check');
    scene.applySupplyEffect('retainHand(1)', 'Smoke bank check');
    const state = window.__birdSquadState!();
    return {
      nextEnergy: scene.nextTurnEnergyBonus,
      nextDraw: scene.nextTurnDrawBonus,
      retain: scene.pendingRetainHand,
      combatBankCache: state.combatBankCache,
    };
  });
  const threatChargeResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatThreatChargeBursts = 0;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    enemy.nextAttackBonus = 0;
    scene.resolveEnemyEffect(enemy, 'nextAttackBonus(3)');
    const state = window.__birdSquadState!();
    return {
      nextAttackBonus: enemy.nextAttackBonus,
      intentDamage: scene.incomingAttackDamage(enemy),
      combatThreatCharge: state.combatThreatCharge,
    };
  });
  const moltShiftResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatMoltShiftBursts = 0;
    scene.flock.molt = false;
    scene.enterMolt('Smoke molt check');
    const state = window.__birdSquadState!();
    return {
      statuses: state.flock.statuses,
      combatMoltShift: state.combatMoltShift,
    };
  });
  const openSkyGuardGainResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatOpenSkyGuardBursts = 0;
    scene.flock.openSkyGuard = 0;
    scene.gainOpenSkyGuard(2, 'Smoke sky guard check');
    const state = window.__birdSquadState!();
    return {
      statuses: state.flock.statuses,
      combatOpenSkyGuard: state.combatOpenSkyGuard,
    };
  });
  const openSkyExposureResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatOpenSkyExposureBursts = 0;
    scene.flock.exposed = false;
    scene.flock.exposedTurns = 0;
    scene.enterOpenSky(2, 'Smoke Open Sky check leaves the flock in Open Sky.');
    const state = window.__birdSquadState!();
    return {
      statuses: state.flock.statuses,
      combatOpenSkyExposure: state.combatOpenSkyExposure,
    };
  });
  const openSkyGuardConsumeResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatOpenSkyGuardBursts = 0;
    scene.flock.exposed = true;
    scene.flock.exposedTurns = 1;
    scene.flock.openSkyGuard = 1;
    scene.flock.block = 0;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.damageFlock(enemy, 0);
    const state = window.__birdSquadState!();
    return {
      guardRemaining: scene.flock.openSkyGuard,
      combatOpenSkyGuard: state.combatOpenSkyGuard,
    };
  });
  const defeatResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatDefeatBurstBursts = 0;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.damageEnemy(enemy.id, enemy.maxHp + 8, 'Smoke defeat check', undefined, true);
    const state = window.__birdSquadState!();
    return {
      enemies: state.enemies.map((e: any) => ({ name: e.name, hp: e.hp })),
      combatDefeatBurst: state.combatDefeatBurst,
    };
  });
  const victoryResult = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.queueOutcomeCombatFxAssetLoad();
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (scene.textures.exists('combat-victory-rally') && scene.textures.exists('combat-victory-fanfare-sigil')) break;
      await wait(25);
    }
    scene.fxLayer.removeAll(true);
    scene.combatVictoryRallyBursts = 0;
    scene.combatVictoryFanfareSigilBursts = 0;
    const audioBefore = JSON.parse(window.render_game_to_text!()).audio;
    const fanfareBefore = audioBefore?.cueRequests?.victoryFanfare ?? 0;
    scene.enemies.forEach((enemy: any) => { enemy.hp = 0; });
    scene.checkOutcome();
    const state = window.__birdSquadState!();
    return {
      mode: state.mode,
      enemies: state.enemies.map((e: any) => ({ name: e.name, hp: e.hp })),
      combatVictoryRally: state.combatVictoryRally,
      combatVictoryFanfareSigil: state.combatVictoryFanfareSigil,
      fanfareBefore,
      fanfareAfter: state.audio?.cueRequests?.victoryFanfare ?? 0,
    };
  });
  const turnBannerResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatTurnBannerBursts = 0;
    scene.endTurn();
    const state = window.__birdSquadState!();
    return {
      turn: state.turn,
      combatTurnBanner: state.combatTurnBanner,
    };
  });
  expect(result.enemies).toContain('Roof Rat');
  expect(result.battleHudRail.loaded).toBe(true);
  expect(result.battleHudRail.rendered).toBe(true);
  expect(result.enemyIntentRing.loaded).toBe(true);
  expect(result.enemyIntentRing.rendered).toBe(true);
  expect(result.enemyIntentRing.count).toBeGreaterThanOrEqual(1);
  expect(result.combatEncounterIntro.loaded).toBe(true);
  expect(result.combatEncounterIntro.rendered).toBe(false);
  expect(result.combatEncounterIntro.count).toBe(0);
  expect(result.combatEncounterIntro.bursts).toBeGreaterThanOrEqual(1);
  expect(result.combatImpactFlash.loaded).toBe(true);
  expect(result.combatImpactFlash.rendered).toBe(true);
  expect(result.combatImpactFlash.count).toBeGreaterThanOrEqual(1);
  expect(result.combatImpactFlash.bursts).toBeGreaterThanOrEqual(1);
  expect(result.combatPlayerHitConfirm.loaded).toBe(true);
  expect(result.combatActionTrail.loaded).toBe(true);
  expect(result.combatCastFocusBurst.loaded).toBe(true);
  expect(result.combatWingbeatSpend.loaded).toBe(true);
  expect(result.combatEnemySwipe.loaded).toBe(true);
  expect(result.combatFlockImpactBurst.loaded).toBe(true);
  expect(result.combatCoverGuard.loaded).toBe(true);
  expect(result.combatCoverBlockBurst.loaded).toBe(true);
  expect(result.combatEnemyCoverBlock.loaded).toBe(true);
  expect(result.combatPerfectBraceRiposte.loaded).toBe(true);
  expect(result.combatHealBloom.loaded).toBe(true);
  expect(result.combatEnemyMend.loaded).toBe(true);
  expect(result.combatEnemyCover.loaded).toBe(true);
  expect(result.combatCoverShatter.loaded).toBe(true);
  expect(result.combatCardDraw.loaded).toBe(true);
  expect(result.combatDiscardSweep.loaded).toBe(true);
  expect(result.combatShuffleVortex.loaded).toBe(true);
  expect(result.combatFouledPressure.loaded).toBe(true);
  expect(result.combatRuffledBreak.loaded).toBe(true);
  expect(result.combatResonanceSurge.loaded).toBe(true);
  expect(result.combatResonanceSpend.loaded).toBe(true);
  expect(result.combatWingbeatSurge.loaded).toBe(true);
  expect(result.combatWingbeatDrain.loaded).toBe(true);
  expect(result.combatWindedGust.loaded).toBe(true);
  expect(result.combatFlowSurge.loaded).toBe(true);
  expect(result.combatCleanseBurst.loaded).toBe(true);
  expect(result.combatBankCache.loaded).toBe(true);
  expect(result.combatThreatCharge.loaded).toBe(true);
  expect(result.combatEnemyRecoveryAfterglow.loaded).toBe(true);
  expect(result.combatMoltShift.loaded).toBe(true);
  expect(result.combatOpenSkyGuard.loaded).toBe(true);
  expect(result.combatOpenSkyExposure.loaded).toBe(true);
  expect(result.combatVictoryRally.loaded).toBe(false);
  expect(result.combatVictoryFanfareSigil.loaded).toBe(false);
  expect(result.combatAtmosphereStrip.loaded).toBe(true);
  expect(result.combatAtmosphereStrip.rendered).toBe(true);
  expect(result.combatAtmosphereStrip.count).toBeGreaterThanOrEqual(21);
  expect(result.combatCardBack.loaded).toBe(true);
  expect(result.combatCardBack.rendered).toBe(true);
  expect(result.combatCardBack.count).toBeGreaterThanOrEqual(2);
  expect(result.combatTargetReticle.loaded).toBe(true);
  expect(result.combatTargetReticle.rendered).toBe(true);
  expect(result.combatTargetReticle.count).toBe(1);
  expect(result.combatTargetLockPulse.loaded).toBe(true);
  expect(result.combatTargetLockPulse.rendered).toBe(true);
  expect(result.combatTargetLockPulse.count).toBe(1);
  expect(castResult.hand).toBeGreaterThanOrEqual(0);
  expect(castResult.spendCost).toBeGreaterThan(0);
  expect(castResult.combatActionTrail.loaded).toBe(true);
  expect(castResult.combatActionTrail.rendered).toBe(true);
  expect(castResult.combatActionTrail.count).toBeGreaterThanOrEqual(1);
  expect(castResult.combatActionTrail.bursts).toBeGreaterThanOrEqual(1);
  expect(castResult.combatCastFocusBurst.loaded).toBe(true);
  expect(castResult.combatWingbeatSpend.loaded).toBe(true);
  expect(castResult.combatWingbeatSpend.rendered).toBe(true);
  expect(castResult.combatWingbeatSpend.count).toBeGreaterThanOrEqual(1);
  expect(castResult.combatWingbeatSpend.bursts).toBeGreaterThanOrEqual(1);
  expect(deferredOutcomeResult.before).toEqual([false, false, false]);
  expect(deferredOutcomeResult.after).toEqual([true, true, true]);
  expect(enemySwipeResult.flockHp).toBeLessThan(enemySwipeResult.flockMaxHp);
  expect(enemySwipeResult.combatEnemySwipe.loaded).toBe(true);
  expect(enemySwipeResult.combatEnemySwipe.rendered).toBe(true);
  expect(enemySwipeResult.combatEnemySwipe.count).toBeGreaterThanOrEqual(1);
  expect(enemySwipeResult.combatEnemySwipe.bursts).toBeGreaterThanOrEqual(1);
  expect(enemySwipeResult.combatFlockImpactBurst.loaded).toBe(true);
  expect(enemySwipeResult.combatFlockImpactBurst.rendered).toBe(true);
  expect(enemySwipeResult.combatFlockImpactBurst.count).toBeGreaterThanOrEqual(1);
  expect(enemySwipeResult.combatFlockImpactBurst.bursts).toBeGreaterThanOrEqual(1);
  expect(coverGuardResult.flockHp).toBe(coverGuardResult.flockMaxHp);
  expect(coverGuardResult.flockBlock).toBeLessThan(99);
  expect(coverGuardResult.combatCoverGuard.loaded).toBe(true);
  expect(coverGuardResult.combatCoverGuard.rendered).toBe(true);
  expect(coverGuardResult.combatCoverGuard.count).toBeGreaterThanOrEqual(1);
  expect(coverGuardResult.combatCoverGuard.bursts).toBeGreaterThanOrEqual(1);
  expect(coverGuardResult.combatCoverBlockBurst.loaded).toBe(true);
  expect(coverGuardResult.combatCoverBlockBurst.rendered).toBe(true);
  expect(coverGuardResult.combatCoverBlockBurst.count).toBeGreaterThanOrEqual(1);
  expect(coverGuardResult.combatCoverBlockBurst.bursts).toBeGreaterThanOrEqual(1);
  expect(coverGuardResult.log).toContain("Roof Rat's hit is blocked.");
  expect(coverGuardResult.log.some((entry: string) => entry.includes('hits the flock for 0'))).toBe(false);
  expect(coverBuildResult.flockBlock).toBeGreaterThanOrEqual(6);
  expect(coverBuildResult.combatCoverGuard.loaded).toBe(true);
  expect(coverBuildResult.combatCoverGuard.rendered).toBe(true);
  expect(coverBuildResult.combatCoverGuard.count).toBeGreaterThanOrEqual(1);
  expect(coverBuildResult.combatCoverGuard.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyCoverBlockResult.hpAfter).toBe(enemyCoverBlockResult.hpBefore);
  expect(enemyCoverBlockResult.blockAfter).toBeLessThan(enemyCoverBlockResult.blockBefore);
  expect(enemyCoverBlockResult.combatEnemyCoverBlock.loaded).toBe(true);
  expect(enemyCoverBlockResult.combatEnemyCoverBlock.rendered).toBe(true);
  expect(enemyCoverBlockResult.combatEnemyCoverBlock.count).toBeGreaterThanOrEqual(1);
  expect(enemyCoverBlockResult.combatEnemyCoverBlock.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyCoverBlockResult.coverBlockCueAfter).toBeGreaterThan(enemyCoverBlockResult.coverBlockCueBefore);
  expect(healBloomResult.flockHp).toBe(healBloomResult.flockMaxHp - 4);
  expect(healBloomResult.combatHealBloom.loaded).toBe(true);
  expect(healBloomResult.combatHealBloom.rendered).toBe(true);
  expect(healBloomResult.combatHealBloom.count).toBeGreaterThanOrEqual(1);
  expect(healBloomResult.combatHealBloom.bursts).toBeGreaterThanOrEqual(1);
  expect(resonanceSurgeResult.resonance).toBe(2);
  expect(resonanceSurgeResult.combatResonanceSurge.loaded).toBe(true);
  expect(resonanceSurgeResult.combatResonanceSurge.rendered).toBe(true);
  expect(resonanceSurgeResult.combatResonanceSurge.count).toBeGreaterThanOrEqual(1);
  expect(resonanceSurgeResult.combatResonanceSurge.bursts).toBeGreaterThanOrEqual(1);
  expect(cardDrawResult.drawBefore).toBeGreaterThanOrEqual(1);
  expect(cardDrawResult.handAfter).toBe(cardDrawResult.handBefore + 1);
  expect(cardDrawResult.drawAfter).toBe(cardDrawResult.drawBefore - 1);
  expect(cardDrawResult.combatCardDraw.loaded).toBe(true);
  expect(cardDrawResult.combatCardDraw.rendered).toBe(true);
  expect(cardDrawResult.combatCardDraw.count).toBeGreaterThanOrEqual(1);
  expect(cardDrawResult.combatCardDraw.bursts).toBeGreaterThanOrEqual(1);
  expect(discardSweepResult.handBefore).toBeGreaterThanOrEqual(1);
  expect(discardSweepResult.discarded).toBe(1);
  expect(discardSweepResult.handAfter).toBe(discardSweepResult.handBefore - 1);
  expect(discardSweepResult.discardAfter).toBe(discardSweepResult.discardBefore + 1);
  expect(discardSweepResult.combatDiscardSweep.loaded).toBe(true);
  expect(discardSweepResult.combatDiscardSweep.rendered).toBe(true);
  expect(discardSweepResult.combatDiscardSweep.count).toBeGreaterThanOrEqual(1);
  expect(discardSweepResult.combatDiscardSweep.bursts).toBeGreaterThanOrEqual(1);
  expect(shuffleVortexResult.discardBefore).toBe(2);
  expect(shuffleVortexResult.handAfter).toBe(shuffleVortexResult.handBefore + 1);
  expect(shuffleVortexResult.drawAfter).toBe(1);
  expect(shuffleVortexResult.discardAfter).toBe(0);
  expect(shuffleVortexResult.combatShuffleVortex.loaded).toBe(true);
  expect(shuffleVortexResult.combatShuffleVortex.rendered).toBe(true);
  expect(shuffleVortexResult.combatShuffleVortex.count).toBeGreaterThanOrEqual(1);
  expect(shuffleVortexResult.combatShuffleVortex.bursts).toBeGreaterThanOrEqual(1);
  expect(ruffledBreakResult.statuses).toContain('Ruffled 2');
  expect(ruffledBreakResult.combatRuffledBreak.loaded).toBe(true);
  expect(ruffledBreakResult.combatRuffledBreak.rendered).toBe(true);
  expect(ruffledBreakResult.combatRuffledBreak.count).toBeGreaterThanOrEqual(1);
  expect(ruffledBreakResult.combatRuffledBreak.bursts).toBeGreaterThanOrEqual(1);
  expect(resonanceSpendResult.spent).toBe(true);
  expect(resonanceSpendResult.resonance).toBe(1);
  expect(resonanceSpendResult.combatResonanceSpend.loaded).toBe(true);
  expect(resonanceSpendResult.combatResonanceSpend.rendered).toBe(true);
  expect(resonanceSpendResult.combatResonanceSpend.count).toBeGreaterThanOrEqual(1);
  expect(resonanceSpendResult.combatResonanceSpend.bursts).toBeGreaterThanOrEqual(1);
  expect(wingbeatSurgeResult.energy).toBe(5);
  expect(wingbeatSurgeResult.combatWingbeatSurge.loaded).toBe(true);
  expect(wingbeatSurgeResult.combatWingbeatSurge.rendered).toBe(true);
  expect(wingbeatSurgeResult.combatWingbeatSurge.count).toBeGreaterThanOrEqual(1);
  expect(wingbeatSurgeResult.combatWingbeatSurge.bursts).toBeGreaterThanOrEqual(1);
  expect(wingbeatDrainResult.energy).toBe(1);
  expect(wingbeatDrainResult.combatWingbeatDrain.loaded).toBe(true);
  expect(wingbeatDrainResult.combatWingbeatDrain.rendered).toBe(true);
  expect(wingbeatDrainResult.combatWingbeatDrain.count).toBeGreaterThanOrEqual(1);
  expect(wingbeatDrainResult.combatWingbeatDrain.bursts).toBeGreaterThanOrEqual(1);
  expect(windedGustResult.statuses).toContain('Winded 2');
  expect(windedGustResult.combatWindedGust.loaded).toBe(true);
  expect(windedGustResult.combatWindedGust.rendered).toBe(true);
  expect(windedGustResult.combatWindedGust.count).toBeGreaterThanOrEqual(1);
  expect(windedGustResult.combatWindedGust.bursts).toBeGreaterThanOrEqual(1);
  expect(flowSurgeResult.flow).toBe(1);
  expect(flowSurgeResult.combatFlowSurge.loaded).toBe(true);
  expect(flowSurgeResult.combatFlowSurge.rendered).toBe(true);
  expect(flowSurgeResult.combatFlowSurge.count).toBeGreaterThanOrEqual(1);
  expect(flowSurgeResult.combatFlowSurge.bursts).toBeGreaterThanOrEqual(1);
  expect(cleanseBurstResult.statuses).not.toContain('Winded 2');
  expect(cleanseBurstResult.statuses).not.toContain('Ruffled 1');
  expect(cleanseBurstResult.statuses).not.toContain('Fouled 1');
  expect(cleanseBurstResult.combatCleanseBurst.loaded).toBe(true);
  expect(cleanseBurstResult.combatCleanseBurst.rendered).toBe(true);
  expect(cleanseBurstResult.combatCleanseBurst.count).toBeGreaterThanOrEqual(1);
  expect(cleanseBurstResult.combatCleanseBurst.bursts).toBeGreaterThanOrEqual(1);
  expect(bankCacheResult.nextEnergy).toBe(2);
  expect(bankCacheResult.nextDraw).toBe(1);
  expect(bankCacheResult.retain).toBe(1);
  expect(bankCacheResult.combatBankCache.loaded).toBe(true);
  expect(bankCacheResult.combatBankCache.rendered).toBe(true);
  expect(bankCacheResult.combatBankCache.count).toBeGreaterThanOrEqual(1);
  expect(bankCacheResult.combatBankCache.bursts).toBeGreaterThanOrEqual(3);
  expect(threatChargeResult.nextAttackBonus).toBe(3);
  expect(threatChargeResult.intentDamage).toBeGreaterThanOrEqual(3);
  expect(threatChargeResult.combatThreatCharge.loaded).toBe(true);
  expect(threatChargeResult.combatThreatCharge.rendered).toBe(true);
  expect(threatChargeResult.combatThreatCharge.count).toBeGreaterThanOrEqual(1);
  expect(threatChargeResult.combatThreatCharge.bursts).toBeGreaterThanOrEqual(1);
  expect(moltShiftResult.statuses).toContain('Molt');
  expect(moltShiftResult.combatMoltShift.loaded).toBe(true);
  expect(moltShiftResult.combatMoltShift.rendered).toBe(true);
  expect(moltShiftResult.combatMoltShift.count).toBeGreaterThanOrEqual(1);
  expect(moltShiftResult.combatMoltShift.bursts).toBeGreaterThanOrEqual(1);
  expect(openSkyGuardGainResult.statuses).toContain('Open Sky Guard 2');
  expect(openSkyGuardGainResult.combatOpenSkyGuard.loaded).toBe(true);
  expect(openSkyGuardGainResult.combatOpenSkyGuard.rendered).toBe(true);
  expect(openSkyGuardGainResult.combatOpenSkyGuard.count).toBeGreaterThanOrEqual(1);
  expect(openSkyGuardGainResult.combatOpenSkyGuard.bursts).toBeGreaterThanOrEqual(1);
  expect(openSkyExposureResult.statuses).toContain('Open Sky');
  expect(openSkyExposureResult.combatOpenSkyExposure.loaded).toBe(true);
  expect(openSkyExposureResult.combatOpenSkyExposure.rendered).toBe(true);
  expect(openSkyExposureResult.combatOpenSkyExposure.count).toBeGreaterThanOrEqual(1);
  expect(openSkyExposureResult.combatOpenSkyExposure.bursts).toBeGreaterThanOrEqual(1);
  expect(openSkyGuardConsumeResult.guardRemaining).toBe(0);
  expect(openSkyGuardConsumeResult.combatOpenSkyGuard.loaded).toBe(true);
  expect(openSkyGuardConsumeResult.combatOpenSkyGuard.rendered).toBe(true);
  expect(openSkyGuardConsumeResult.combatOpenSkyGuard.count).toBeGreaterThanOrEqual(1);
  expect(openSkyGuardConsumeResult.combatOpenSkyGuard.bursts).toBeGreaterThanOrEqual(1);
  expect(defeatResult.enemies).toContainEqual(expect.objectContaining({ name: 'Roof Rat', hp: 0 }));
  expect(defeatResult.combatDefeatBurst.loaded).toBe(true);
  expect(defeatResult.combatDefeatBurst.rendered).toBe(true);
  expect(defeatResult.combatDefeatBurst.count).toBeGreaterThanOrEqual(1);
  expect(defeatResult.combatDefeatBurst.bursts).toBeGreaterThanOrEqual(1);
  expect(['cardReward', 'waymarkReward', 'upgradeReward', 'runComplete']).toContain(victoryResult.mode);
  expect(victoryResult.enemies.every((enemy: { hp: number }) => enemy.hp <= 0)).toBe(true);
  expect(victoryResult.combatVictoryRally.loaded).toBe(true);
  expect(victoryResult.combatVictoryRally.rendered).toBe(true);
  expect(victoryResult.combatVictoryRally.count).toBeGreaterThanOrEqual(2);
  expect(victoryResult.combatVictoryRally.bursts).toBeGreaterThanOrEqual(1);
  expect(victoryResult.combatVictoryFanfareSigil.loaded).toBe(true);
  expect(victoryResult.combatVictoryFanfareSigil.rendered).toBe(true);
  expect(victoryResult.combatVictoryFanfareSigil.count).toBeGreaterThanOrEqual(2);
  expect(victoryResult.combatVictoryFanfareSigil.bursts).toBeGreaterThanOrEqual(1);
  expect(victoryResult.fanfareAfter).toBeGreaterThan(victoryResult.fanfareBefore);
  expect(turnBannerResult.turn).toBeGreaterThanOrEqual(2);
  expect(turnBannerResult.combatTurnBanner.loaded).toBe(true);
  expect(turnBannerResult.combatTurnBanner.rendered).toBe(true);
  expect(turnBannerResult.combatTurnBanner.count).toBeGreaterThanOrEqual(1);
  expect(turnBannerResult.combatTurnBanner.bursts).toBeGreaterThanOrEqual(1);
});

test('combat HUD metric chips render generated frames', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const state = window.__birdSquadState!();
    const metricTextureKey = 'ui-icon-combat-hud-metric-chip-frame';
    const keystoneTextureKey = 'ui-icon-combat-suit-keystone-chip-frame';
    const beatTextureKey = 'ui-icon-combat-beat-progress-frame';
    const frameObjects = scene.root.list.filter((child: any) => child.texture?.key === metricTextureKey).length;
    const keystoneFrameObjects = scene.root.list.filter((child: any) => child.texture?.key === keystoneTextureKey).length;
    const collectObjects = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collectObjects(child.list) : [])
    ]);
    const beatFrameObjects = collectObjects(scene.root.list)
      .filter((child: any) => child.texture?.key === beatTextureKey)
      .map((child: any) => ({
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        name: child.name,
        visible: child.visible,
      }));
    return {
      combatHudMetricChipFrame: state.combatHudMetricChipFrame,
      combatSuitKeystoneChipFrame: state.combatSuitKeystoneChipFrame,
      combatBeatProgressFrame: state.combatBeatProgressFrame,
      frameObjects,
      keystoneFrameObjects,
      beatFrameObjects
    };
  });
  expect(result.combatHudMetricChipFrame).toEqual({ loaded: true, rendered: true, count: result.frameObjects });
  // Starter combat keeps zero-value Cover and Resonance out of the primary rail.
  expect(result.frameObjects).toBe(5);
  expect(result.combatSuitKeystoneChipFrame).toEqual({ loaded: true, rendered: false, count: result.keystoneFrameObjects });
  expect(result.keystoneFrameObjects).toBe(0);
  expect(result.combatBeatProgressFrame).toEqual({ loaded: true, rendered: true, count: result.beatFrameObjects.length });
  expect(result.beatFrameObjects).toEqual([
    expect.objectContaining({
      displayWidth: 148,
      displayHeight: 37,
      alpha: 1,
      name: 'combat-beat-progress-frame',
      visible: true,
    }),
  ]);
});

test('encounter composition supports solo tuning and support companions', async ({ page }) => {
  await boot(page);
  const solo = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const soloScene: any = g.scene.getScene('BattleScene');
    const soloEnemy = soloScene.enemies[0];
    return {
      solo: soloEnemy.solo,
      maxHp: soloEnemy.maxHp,
      baseHp: soloEnemy.runtime.health,
      damageBonus: soloEnemy.damageBonus,
      previewDamage: soloScene.incomingAttackDamage(soloEnemy),
    };
  });

  const supportResult = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.stop('BattleScene');
    const runState = {
      deck: [{ id: 'major_00' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed: 'support-companion-test',
      currentHp: 36,
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
    };

    await window.__birdSquadStartScene!('RouteScene', { runState });
    const supportNode = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'street');
    if (!supportNode) throw new Error('Expected a street node for support encounter smoke');
    supportNode.payloadId = 'enc_rooftop_skirmish';
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: supportNode.id, runState });
    g.scene.stop('MenuScene');
    const supportScene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && (!supportScene.enemies?.length || !supportScene.fxLayer); i += 1) {
      await wait(50);
    }
    for (let i = 0; i < 20 && !supportScene.enemies.some((enemy: any) => enemy.roles.includes('support')); i += 1) {
      await wait(50);
    }
    const support = supportScene.enemies.find((enemy: any) => enemy.roles.includes('support'));
    const ally = supportScene.enemies.find((enemy: any) => enemy.id !== support.id);
    supportScene.fxLayer.removeAll(true);
    supportScene.combatEnemyMendBursts = 0;
    supportScene.combatEnemyCoverBursts = 0;
    ally.maxHp = 30;
    ally.hp = 12;
    supportScene.resolveEnemyEffect(support, 'healAlly(lowest, 4)');
    supportScene.resolveEnemyEffect(support, 'gainCoverAlly(lowest, 3)');
    supportScene.resolveEnemyEffect(support, 'gainCover(5)');

    return {
      supportRoles: support.roles,
      allyHp: ally.hp,
      allyBlock: ally.block,
      supportBlock: support.block,
      supportNextAttackBonus: support.nextAttackBonus,
      combatEnemyMend: window.__birdSquadState!().combatEnemyMend,
      combatEnemyCover: window.__birdSquadState!().combatEnemyCover,
      supportState: supportScene.enemies.map((enemy: any) => ({
        id: enemy.id,
        roles: enemy.roles,
        solo: enemy.solo,
        maxHp: enemy.maxHp,
        baseHp: enemy.runtime.health,
        damageBonus: enemy.damageBonus,
      })),
    };
  });

  expect(solo.solo).toBe(true);
  expect(solo.maxHp).toBeGreaterThan(solo.baseHp);
  expect(solo.damageBonus).toBe(2);
  expect(solo.previewDamage).toBeGreaterThan(6);
  expect(supportResult.supportRoles).toContain('support');
  expect(supportResult.allyHp).toBe(16);
  expect(supportResult.allyBlock).toBe(3);
  expect(supportResult.supportBlock).toBe(5);
  expect(supportResult.supportNextAttackBonus).toBe(0);
  expect(supportResult.combatEnemyMend.loaded).toBe(true);
  expect(supportResult.combatEnemyMend.rendered).toBe(true);
  expect(supportResult.combatEnemyMend.count).toBeGreaterThanOrEqual(1);
  expect(supportResult.combatEnemyMend.bursts).toBeGreaterThanOrEqual(1);
  expect(supportResult.combatEnemyCover.loaded).toBe(true);
  expect(supportResult.combatEnemyCover.rendered).toBe(true);
  expect(supportResult.combatEnemyCover.count).toBeGreaterThanOrEqual(1);
  expect(supportResult.combatEnemyCover.bursts).toBeGreaterThanOrEqual(2);
  expect(supportResult.supportState.some((enemy: any) => enemy.roles.includes('support'))).toBe(true);
  expect(supportResult.supportState.every((enemy: any) => enemy.solo === false)).toBe(true);
  expect(supportResult.supportState.every((enemy: any) => enemy.maxHp > enemy.baseHp)).toBe(true);
  expect(supportResult.supportState.every((enemy: any) => enemy.damageBonus === 2)).toBe(true);
});

test('generated combat payloads favor multi-enemy encounters', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const multiPayloadIds = new Set([
      'enc_rooftop_rat_pack',
      'enc_rooftop_skirmish',
      'enc_gutter_baron',
      'enc_signal_gull',
      'enc_rooftop_scrapper_mix',
      'enc_rooftop_cutpurse_alarm',
      'enc_rooftop_speed_trap',
    ]);
    const mkRunState = (seed: string) => ({
      deck: [{ id: 'major_00' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed,
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
    });
    let multi = 0;
    let solo = 0;
    for (let i = 0; i < 40; i += 1) {
      await window.__birdSquadStartScene!('RouteScene', { runState: mkRunState(`multi-rate-${i}`) });
      g.scene.stop('MenuScene');
      await wait(5);
      for (const node of window.__birdSquadCurrentMap!().nodes) {
        if (node.type !== 'street' && node.type !== 'rival') continue;
        if (node.id === window.__birdSquadCurrentMap!().entryNodeId) continue;
        if (multiPayloadIds.has(node.payloadId)) multi += 1;
        else solo += 1;
      }
    }
    return { multi, solo };
  });
  expect(result.multi).toBeGreaterThan(result.solo);
});

test('poison pressure applies Fouled and ticks on the next player turn', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];
    scene.fxLayer.removeAll(true);
    scene.combatFouledPressureBursts = 0;
    scene.flock.hp = 30;
    scene.flock.block = 0;
    scene.flockStats = () => ({});
    scene.resolveEnemyEffect(enemy, 'applyPoison(flock, 2)');
    const applyState = window.__birdSquadState!();
    scene.startPlayerTurn();
    const tickState = window.__birdSquadState!();
    return {
      afterApply: applyState.flock,
      afterTick: tickState.flock,
      afterApplyFx: applyState.combatFouledPressure,
      afterTickFx: tickState.combatFouledPressure,
      log: scene.log.slice(-4)
    };
  });

  expect(result.afterApply.fouled).toBe(2);
  expect(result.afterApply.statuses).toContain('Fouled 2');
  expect(result.afterTick.hp).toBe(28);
  expect(result.afterTick.fouled).toBe(1);
  expect(result.afterTick.statuses).toContain('Fouled 1');
  expect(result.afterApplyFx.loaded).toBe(true);
  expect(result.afterApplyFx.rendered).toBe(true);
  expect(result.afterApplyFx.count).toBeGreaterThanOrEqual(1);
  expect(result.afterApplyFx.bursts).toBeGreaterThanOrEqual(1);
  expect(result.afterTickFx.loaded).toBe(true);
  expect(result.afterTickFx.rendered).toBe(true);
  expect(result.afterTickFx.count).toBeGreaterThanOrEqual(2);
  expect(result.afterTickFx.bursts).toBeGreaterThanOrEqual(2);
  expect(result.log.some((line: string) => line.includes('Fouled pressure'))).toBe(true);
});

test('flock Cohesion bar exposes incoming damage prediction after Cover', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];
    const intentDamage = scene.incomingAttackDamage(enemy);
    scene.flock.hp = 30;
    scene.flock.block = 3;
    scene.renderAll();
    const countTexture = (items: any[], textureKey: string): number => items.reduce((sum, child) => {
      const self = child.texture?.key === textureKey ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, textureKey) : 0;
      return sum + self + nested;
    }, 0);
    const frameObjects = (scene.root?.list ?? scene.children.list)
      .filter((child: any) => child.texture?.key === 'ui-icon-combat-incoming-forecast-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const gaugeObjects = (scene.root?.list ?? scene.children.list)
      .filter((child: any) => child.texture?.key === 'ui-icon-combat-cohesion-gauge-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const state = window.__birdSquadState!();
    return {
      intentDamage,
      preview: state.flock.incoming,
      combatIncomingForecastFrame: state.combatIncomingForecastFrame,
      combatCohesionGaugeFrame: state.combatCohesionGaugeFrame,
      frameCount: countTexture(scene.root?.list ?? scene.children.list, 'ui-icon-combat-incoming-forecast-frame'),
      gaugeFrameCount: countTexture(scene.root?.list ?? scene.children.list, 'ui-icon-combat-cohesion-gauge-frame'),
      frameObjects,
      gaugeObjects,
    };
  });

  expect(result.preview.total).toBe(result.intentDamage);
  expect(result.preview.blocked).toBe(3);
  expect(result.preview.hpLoss).toBe(result.intentDamage - 3);
  expect(result.preview.afterHp).toBe(30 - (result.intentDamage - 3));
  expect(result.preview.attackers).toBe(1);
  expect(result.combatIncomingForecastFrame).toEqual({ loaded: true, rendered: true, count: result.frameCount });
  expect(result.frameCount).toBeGreaterThanOrEqual(1);
  expect(result.frameObjects.every((frame: { width: number; height: number }) => frame.width === 188 && frame.height === 38)).toBe(true);
  expect(result.combatCohesionGaugeFrame).toEqual({ loaded: true, rendered: true, count: result.gaugeFrameCount });
  expect(result.gaugeFrameCount).toBeGreaterThanOrEqual(1);
  expect(result.gaugeObjects).toEqual([
    expect.objectContaining({ name: 'combat-cohesion-gauge-frame', width: 248, height: 52, alpha: 0.9 })
  ]);
});

test('battle hand is compact (no full effect text) and enemies expose intents', async ({ page }) => {
  await boot(page);
  const state = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    // create() (which draws the opening hand) runs a tick after start.
    for (let i = 0; i < 20 && !(window.__birdSquadState?.()?.hand?.length); i += 1) await wait(50);
    return window.__birdSquadState!();
  });
  expect(state.hand.length).toBeGreaterThan(0);
  for (const card of state.hand) expect(card.text).toBeUndefined();
  for (const enemy of state.enemies) expect(typeof enemy.intent).toBe('string');
});

test('hand cards carry unique per-combat instance ids', async ({ page }) => {
  await boot(page);
  const ids: string[] = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    return window.__birdSquadState!().hand.map((card: any) => card.instanceId);
  });
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(typeof id).toBe('string');
});

test('boss uses a scripted attack pattern that loops from move 2', async ({ page }) => {
  await boot(page);
  const labels: string[] = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    g.scene.stop('MenuScene');
    const boss = g.scene.getScene('BattleScene').enemies[0];
    const seq: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      boss.intentIndex = i;
      seq.push(window.__birdSquadState!().enemies[0].intent);
    }
    return seq;
  });
  expect(labels[0]).toBe('Toll Line');
  expect(labels[4]).toBe('Heavy Strike 13');
  // turn 6 (index 5) repeats from move index 1 (loopFrom), not the opener.
  expect(labels[5]).toBe('Crowbar Tap 8');
  expect(labels[6]).toBe('Tar Toss 5');
});

test('boss fights render generated boss battlefield variants', async ({ page }) => {
  await boot(page);
  const expectedKeys = [
    'battlefield-rooftop-blocks-boss-tar-crow',
    'battlefield-canal-markets-boss-gatekeeper',
    'battlefield-signal-spires-boss-beacon-breaker',
    'battlefield-high-roost-boss-warden'
  ];
  const results = [];
  for (let mapIndex = 0; mapIndex < expectedKeys.length; mapIndex += 1) {
    const expectedKey = expectedKeys[mapIndex];
    await page.evaluate(async (mapIndex) => {
      const g = window.__birdSquadGame;
      const runState = {
      deck: [{ id: 'major_00' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed: 'boss-backdrop-variant-test',
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
      };
      await window.__birdSquadStartScene!('RouteScene', { runState });
      g.scene.stop('MenuScene');
      const bossNodeId = window.__birdSquadCurrentMap!().bossNodeId;
      await window.__birdSquadStartScene!('BattleScene', { routeNodeId: bossNodeId, runState });
    }, mapIndex);
    await page.waitForFunction((expectedKey) => {
      const state = window.__birdSquadState?.();
      const scene: any = window.__birdSquadGame?.scene.getScene('BattleScene');
      const rendered = scene?.backdropLayer?.list?.some((child: any) => child.texture?.key === expectedKey) ?? false;
      return state?.route?.battlefieldAssetKey === expectedKey
        && state.route.battlefieldVariant
        && scene?.textures.exists(expectedKey)
        && rendered;
    }, expectedKey, { timeout: 10_000 });
    results.push(await page.evaluate(async (expectedKey) => {
      const state = window.__birdSquadState!();
      const scene: any = window.__birdSquadGame?.scene.getScene('BattleScene');
      return {
        stateKey: state.route.battlefieldAssetKey,
        variant: state.route.battlefieldVariant,
        textureLoaded: scene.textures.exists(expectedKey),
        rendered: scene.backdropLayer?.list?.some((child: any) => child.texture?.key === expectedKey) ?? false
      }
    }, expectedKey));
  }

  expect(results).toEqual([
    expect.objectContaining({ stateKey: 'battlefield-rooftop-blocks-boss-tar-crow', variant: true, textureLoaded: true, rendered: true }),
    expect.objectContaining({ stateKey: 'battlefield-canal-markets-boss-gatekeeper', variant: true, textureLoaded: true, rendered: true }),
    expect.objectContaining({ stateKey: 'battlefield-signal-spires-boss-beacon-breaker', variant: true, textureLoaded: true, rendered: true }),
    expect.objectContaining({ stateKey: 'battlefield-high-roost-boss-warden', variant: true, textureLoaded: true, rendered: true })
  ]);
});

test('combat backdrop presentation varies by route encounter type', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    const mkRunState = () => ({
      deck: [{ id: 'major_00' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed: 'combat-backdrop-mood-test',
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
    });
    const routeRunState = mkRunState();
    await window.__birdSquadStartScene!('RouteScene', { runState: routeRunState });
    g.scene.stop('MenuScene');
    await wait(80);
    const map = window.__birdSquadCurrentMap!();
    const street = map.nodes.find((node: any) => node.type === 'street')?.id;
    const rival = map.nodes.find((node: any) => node.type === 'rival')?.id;
    const boss = map.bossNodeId;
    const start = async (routeNodeId: string) => {
      await window.__birdSquadStartScene!('BattleScene', { routeNodeId, runState: mkRunState() });
      g.scene.stop('MenuScene');
      await wait(120);
      return window.__birdSquadState!().route;
    };
    return {
      street: street ? await start(street) : undefined,
      rival: rival ? await start(rival) : undefined,
      boss: await start(boss)
    };
  });

  expect(result.street?.battlefieldMood).toBe('street');
  expect(result.street?.battlefieldVariant).toBe(false);
  expect(result.rival?.battlefieldMood).toBe('rival');
  expect(result.rival?.battlefieldVariant).toBe(false);
  expect(result.boss.battlefieldMood).toBe('boss');
  expect(result.boss.battlefieldVariant).toBe(true);
  expect(result.boss.battlefieldAssetKey).toBe('battlefield-rooftop-blocks-boss-tar-crow');
});

test('signals/basins/cache present structured choices resolved by the route-effect interpreter', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const signalChoices = scene.nodeChoiceList({ type: 'signal', payloadId: 'faded_chalk_line' }).map((c: any) => c.key);
    const basinCount = scene.nodeChoiceList({ type: 'basin' }).length;
    const cacheCount = scene.nodeChoiceList({ type: 'cache' }).length;
    const scrapBefore = scene.runState.scrap;
    scene.resolveRouteEffect('gainScrap(45)');
    const scrapAfter = scene.runState.scrap;
    const signalNode: any = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'signal');
    if (signalNode) {
      signalNode.payloadId = 'blackout_sign';
      signalNode.label = 'Blackout Sign';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-cache-lockbox-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-cache-lockbox-medallion');
      if (ready) break;
      await wait(50);
    }
    const cacheLockboxIconLoaded = scene.textures.exists('ui-icon-cache-lockbox-medallion');
    const cacheLockboxIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-cache-lockbox-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    if (signalNode) {
      signalNode.payloadId = 'rooftop_thermal_updraft';
      signalNode.label = 'Thermal Updraft';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-open-sky-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-open-sky-medallion');
      if (ready) break;
      await wait(50);
    }
    const openSkyIconLoaded = scene.textures.exists('ui-icon-open-sky-medallion');
    const openSkyIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-open-sky-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    if (signalNode) {
      const originalNodeChoiceList = scene.nodeChoiceList.bind(scene);
      scene.nodeChoiceList = (node: any) => node.id === signalNode.id
        ? [
          {
            key: 'gain_scrap',
            text: 'Pocket route scrap.',
            effects: ['gainScrap(18)'],
            locked: false
          },
          {
            key: 'pay_scrap',
            text: 'Spend scrap on the pass.',
            effects: ['payScrap(6)'],
            locked: false
          },
          {
            key: 'decline',
            text: 'Move on.',
            effects: [],
            locked: false
          }
        ]
        : originalNodeChoiceList(node);
      signalNode.payloadId = 'route_scrap_probe';
      signalNode.label = 'Route Scrap Probe';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-route-scrap-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-scrap-medallion');
      if (ready) break;
      await wait(50);
    }
    const routeScrapIconLoaded = scene.textures.exists('ui-icon-route-scrap-medallion');
    const routeScrapIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-scrap-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    if (signalNode) {
      scene.nodeChoiceList = (node: any) => node.id === signalNode.id
        ? [
          {
            key: 'heal_cohesion',
            text: 'Share canteen water.',
            effects: ['healCohesion(6)'],
            locked: false
          },
          {
            key: 'lose_cohesion',
            text: 'Push through the wire.',
            effects: ['loseCohesion(3)'],
            locked: false
          },
          {
            key: 'decline',
            text: 'Move on.',
            effects: [],
            locked: false
          }
        ]
        : originalNodeChoiceList(node);
      signalNode.payloadId = 'route_cohesion_probe';
      signalNode.label = 'Route Cohesion Probe';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-route-cohesion-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-cohesion-medallion');
      if (ready) break;
      await wait(50);
    }
    const routeCohesionIconLoaded = scene.textures.exists('ui-icon-route-cohesion-medallion');
    const routeCohesionIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-cohesion-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    if (signalNode) {
      scene.nodeChoiceList = (node: any) => node.id === signalNode.id
        ? [
          {
            key: 'enemy_cover',
            text: 'Let rivals brace up.',
            effects: ['enemyCoverNextCombat(4)'],
            locked: false
          },
          {
            key: 'boss_shield',
            text: 'Rig boss-fight cover.',
            effects: ['bossDamageShield(8)'],
            locked: false
          },
          {
            key: 'decline',
            text: 'Move on.',
            effects: [],
            locked: false
          }
        ]
        : originalNodeChoiceList(node);
      signalNode.payloadId = 'route_cover_probe';
      signalNode.label = 'Route Cover Probe';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-route-cover-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-cover-medallion');
      if (ready) break;
      await wait(50);
    }
    const routeCoverIconLoaded = scene.textures.exists('ui-icon-route-cover-medallion');
    const routeCoverIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-cover-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    if (signalNode) {
      scene.nodeChoiceList = (node: any) => node.id === signalNode.id
        ? [
          {
            key: 'guard_sky',
            text: 'Guard the crossing.',
            effects: ['gainOpenSkyGuard(2)'],
            locked: false
          },
          {
            key: 'soften_sky',
            text: 'Lower the exposure.',
            effects: ['reduceNextOpenSky(2)'],
            locked: false
          },
          {
            key: 'decline',
            text: 'Move on.',
            effects: [],
            locked: false
          }
        ]
        : originalNodeChoiceList(node);
      signalNode.payloadId = 'sky_guard_probe';
      signalNode.label = 'Sky Guard Probe';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-sky-guard-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-sky-guard-medallion');
      if (ready) break;
      await wait(50);
    }
    const skyGuardIconLoaded = scene.textures.exists('ui-icon-sky-guard-medallion');
    const skyGuardIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-sky-guard-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    if (signalNode) {
      scene.nodeChoiceList = (node: any) => node.id === signalNode.id
        ? [
          {
            key: 'claim_waymark',
            text: 'Claim a waymark.',
            effects: ['gainRouteMark(randomRare)'],
            locked: false
          },
          {
            key: 'decline',
            text: 'Move on.',
            effects: [],
            locked: false
          }
        ]
        : [];
      signalNode.payloadId = 'route_waymark_probe';
      signalNode.label = 'Route Waymark Probe';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-route-waymark-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-waymark-medallion');
      if (ready) break;
      await wait(50);
    }
    const routeWaymarkIconLoaded = scene.textures.exists('ui-icon-route-waymark-medallion');
    const routeWaymarkIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-waymark-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    if (signalNode) {
      scene.nodeChoiceList = (node: any) => node.id === signalNode.id
        ? [
          {
            key: 'claim_card',
            text: 'Claim a card.',
            effects: ['addCard(chooseOneOfTwo)'],
            locked: false
          },
          {
            key: 'claim_high_card',
            text: 'Claim a high card.',
            effects: ['addCard(chooseOneOfTwoUncommonOrRare)'],
            locked: false
          },
          {
            key: 'decline',
            text: 'Move on.',
            effects: [],
            locked: false
          }
        ]
        : [];
      signalNode.payloadId = 'route_card_probe';
      signalNode.label = 'Route Card Probe';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-route-card-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-card-medallion');
      if (ready) break;
      await wait(50);
    }
    const routeCardIconLoaded = scene.textures.exists('ui-icon-route-card-medallion');
    const routeCardIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-card-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    if (signalNode) {
      scene.nodeChoiceList = (node: any) => node.id === signalNode.id
        ? [
          {
            key: 'remove_one',
            text: 'Release a stale card.',
            effects: ['releaseCard(1)'],
            locked: false
          },
          {
            key: 'remove_two',
            text: 'Thin the deck hard.',
            effects: ['releaseCard(2)'],
            locked: false
          },
          {
            key: 'decline',
            text: 'Move on.',
            effects: [],
            locked: false
          }
        ]
        : [];
      signalNode.payloadId = 'route_release_probe';
      signalNode.label = 'Route Release Probe';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-route-release-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-release-medallion');
      if (ready) break;
      await wait(50);
    }
    const routeReleaseIconLoaded = scene.textures.exists('ui-icon-route-release-medallion');
    const routeReleaseIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-release-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    if (signalNode) {
      scene.nodeChoiceList = (node: any) => node.id === signalNode.id
        ? [
          {
            key: 'snag_discard',
            text: 'Take a discard snag.',
            effects: ['addSnagToDiscard(tangled_line)'],
            locked: false
          },
          {
            key: 'snag_draw',
            text: 'Take a draw snag.',
            effects: ['addSnagToDraw(bent_feather)'],
            locked: false
          },
          {
            key: 'decline',
            text: 'Move on.',
            effects: [],
            locked: false
          }
        ]
        : [];
      signalNode.payloadId = 'route_snag_probe';
      signalNode.label = 'Route Snag Probe';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-route-snag-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-snag-medallion');
      if (ready) break;
      await wait(50);
    }
    const routeSnagIconLoaded = scene.textures.exists('ui-icon-route-snag-medallion');
    const routeSnagIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-snag-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    if (signalNode) {
      scene.nodeChoiceList = (node: any) => node.id === signalNode.id
        ? [
          {
            key: 'challenge_rival',
            text: 'Challenge the rival.',
            effects: ['startRivalBattle'],
            locked: false
          },
          {
            key: 'decline',
            text: 'Move on.',
            effects: [],
            locked: false
          }
        ]
        : [];
      signalNode.payloadId = 'route_rival_probe';
      signalNode.label = 'Route Rival Probe';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-route-rival-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-rival-medallion');
      if (ready) break;
      await wait(50);
    }
    const routeRivalIconLoaded = scene.textures.exists('ui-icon-route-rival-medallion');
    const routeRivalIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-rival-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    if (signalNode) {
      scene.nodeChoiceList = (node: any) => node.id === signalNode.id
        ? [
          {
            key: 'preen_now',
            text: 'Tune the featherwork.',
            effects: ['preenCard(1)'],
            locked: false
          },
          {
            key: 'free_preen',
            text: 'Bank a free preen.',
            effects: ['freePreenNextDistrict(1)'],
            locked: false
          },
          {
            key: 'decline',
            text: 'Move on.',
            effects: [],
            locked: false
          }
        ]
        : [];
      signalNode.payloadId = 'route_preen_probe';
      signalNode.label = 'Route Preen Probe';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-route-preen-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-preen-medallion');
      if (ready) break;
      await wait(50);
    }
    const routePreenIconLoaded = scene.textures.exists('ui-icon-route-preen-medallion');
    const routePreenIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-preen-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    if (signalNode) {
      scene.nodeChoiceList = (node: any) => node.id === signalNode.id
        ? [
          {
            key: 'pack_supply',
            text: 'Pack a route supply.',
            effects: ['gainSupplyChoice(1)'],
            locked: false
          },
          {
            key: 'expand_slots',
            text: 'Add a supply slot.',
            effects: ['increaseSupplySlots(1)'],
            locked: false
          },
          {
            key: 'decline',
            text: 'Move on.',
            effects: [],
            locked: false
          }
        ]
        : [];
      signalNode.payloadId = 'route_supply_probe';
      signalNode.label = 'Route Supply Probe';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-route-supply-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-supply-medallion');
      if (ready) break;
      await wait(50);
    }
    const routeSupplyIconLoaded = scene.textures.exists('ui-icon-route-supply-medallion');
    const routeSupplyIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-supply-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    if (signalNode) {
      scene.nodeChoiceList = (node: any) => node.id === signalNode.id
        ? [
          {
            key: 'plan_route',
            text: 'Plan route.',
            effects: ['peekNextNodes(2)'],
            locked: false
          },
          {
            key: 'decline',
            text: 'Move on.',
            effects: [],
            locked: false
          }
        ]
        : originalNodeChoiceList(node);
      signalNode.payloadId = 'route_scout_probe';
      signalNode.label = 'Route Scout Probe';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-route-scout-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-scout-medallion');
      if (ready) break;
      await wait(50);
    }
    const routeScoutIconLoaded = scene.textures.exists('ui-icon-route-scout-medallion');
    const routeScoutIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-scout-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    if (signalNode) {
      scene.nodeChoiceList = (node: any) => node.id === signalNode.id
        ? [
          {
            key: 'skip_street',
            text: 'Detour past street.',
            effects: ['skipNextStreet()'],
            locked: false
          },
          {
            key: 'close_route',
            text: 'Close route.',
            effects: ['removeRouteChoice()'],
            locked: false
          },
          {
            key: 'decline',
            text: 'Move on.',
            effects: [],
            locked: false
          }
        ]
        : [];
      signalNode.payloadId = 'route_control_probe';
      signalNode.label = 'Route Control Probe';
      scene.openNodeChoices(signalNode);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-route-control-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-control-medallion');
      if (ready) break;
      await wait(50);
    }
    for (let i = 0; i < 40; i += 1) {
      const ready = scene.textures.exists('ui-icon-route-neutral-medallion')
        && scene.children.list.some((child: any) => child.texture?.key === 'ui-icon-route-neutral-medallion');
      if (ready) break;
      await wait(50);
    }
    const routeNeutralIconLoaded = scene.textures.exists('ui-icon-route-neutral-medallion');
    const routeNeutralIcons = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-neutral-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    return {
      signalChoices,
      basinCount,
      cacheCount,
      scrapDelta: scrapAfter - scrapBefore,
      gatedFar: scene.requirementsMet(['scrapAtLeast(999999)']),
      gatedNear: scene.requirementsMet(['scrapAtLeast(0)']),
      cacheLockboxIconLoaded,
      cacheLockboxIcons,
      openSkyIconLoaded,
      openSkyIcons,
      routeScrapIconLoaded,
      routeScrapIcons,
      routeCohesionIconLoaded,
      routeCohesionIcons,
      routeCoverIconLoaded,
      routeCoverIcons,
      skyGuardIconLoaded,
      skyGuardIcons,
      routeWaymarkIconLoaded,
      routeWaymarkIcons,
      routeCardIconLoaded,
      routeCardIcons,
      routeReleaseIconLoaded,
      routeReleaseIcons,
      routeSnagIconLoaded,
      routeSnagIcons,
      routeRivalIconLoaded,
      routeRivalIcons,
      routePreenIconLoaded,
      routePreenIcons,
      routeSupplyIconLoaded,
      routeSupplyIcons,
      routeScoutIconLoaded,
      routeScoutIcons,
      routeControlIconLoaded: scene.textures.exists('ui-icon-route-control-medallion'),
      routeControlIcons: scene.children.list
        .filter((child: any) => child.texture?.key === 'ui-icon-route-control-medallion')
        .map((child: any) => ({ alpha: child.alpha, visible: child.visible })),
      routeNeutralIconLoaded,
      routeNeutralIcons
    };
  });
  expect(result.signalChoices).toEqual(['repaint', 'scout', 'move', 'decline']);
  expect(result.basinCount).toBe(5);
  expect(result.cacheCount).toBe(6);
  expect(result.scrapDelta).toBe(45);
  expect(result.gatedFar).toBe(false);
  expect(result.gatedNear).toBe(true);
  expect(result.cacheLockboxIconLoaded).toBe(true);
  expect(result.cacheLockboxIcons.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7)).toBe(true);
  expect(result.openSkyIconLoaded).toBe(true);
  expect(result.openSkyIcons.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7)).toBe(true);
  expect(result.routeScrapIconLoaded).toBe(true);
  expect(result.routeScrapIcons.filter((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7).length).toBeGreaterThanOrEqual(2);
  expect(result.routeCohesionIconLoaded).toBe(true);
  expect(result.routeCohesionIcons.filter((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7).length).toBeGreaterThanOrEqual(2);
  expect(result.routeCoverIconLoaded).toBe(true);
  expect(result.routeCoverIcons.filter((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7).length).toBeGreaterThanOrEqual(2);
  expect(result.skyGuardIconLoaded).toBe(true);
  expect(result.skyGuardIcons.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7)).toBe(true);
  expect(result.routeWaymarkIconLoaded).toBe(true);
  expect(result.routeWaymarkIcons.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7)).toBe(true);
  expect(result.routeCardIconLoaded).toBe(true);
  expect(result.routeCardIcons.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7)).toBe(true);
  expect(result.routeReleaseIconLoaded).toBe(true);
  expect(result.routeReleaseIcons.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7)).toBe(true);
  expect(result.routeSnagIconLoaded).toBe(true);
  expect(result.routeSnagIcons.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7)).toBe(true);
  expect(result.routeRivalIconLoaded).toBe(true);
  expect(result.routeRivalIcons.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7)).toBe(true);
  expect(result.routePreenIconLoaded).toBe(true);
  expect(result.routePreenIcons.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7)).toBe(true);
  expect(result.routeSupplyIconLoaded).toBe(true);
  expect(result.routeSupplyIcons.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7)).toBe(true);
  expect(result.routeScoutIconLoaded).toBe(true);
  expect(result.routeScoutIcons.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7)).toBe(true);
  expect(result.routeControlIconLoaded).toBe(true);
  expect(result.routeControlIcons.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7)).toBe(true);
  expect(result.routeNeutralIconLoaded).toBe(true);
  expect(result.routeNeutralIcons.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.7)).toBe(true);
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
    scene.claimRouteReward();
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

test('route event overlays render generated special-node backdrops', async ({ page }) => {
  test.setTimeout(60000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    const cases = [
        {
          type: 'basin',
          key: 'route-event-lantern-roost-shelter',
          residentKey: 'route-event-resident-sella-warmwick',
          choiceFrame: true,
          optionFrame: true,
          detailFrame: true,
          previewRowFrame: true
        },
        {
          type: 'cache',
          key: 'route-event-rooftop-cache-office',
          residentKey: 'route-event-resident-marn-valeclip',
          optionFrame: true,
          detailFrame: true,
          previewRowFrame: true
        },
        {
          type: 'signal',
          key: 'route-event-signal-switchboard',
          residentKey: 'route-event-resident-ivo-tallymast',
          choiceFrame: true,
          optionFrame: true,
          detailFrame: true,
          previewRowFrame: true
        },
        {
          type: 'nest',
          key: 'route-event-featherwright-studio',
          residentKey: 'route-event-resident-oren-shearbright',
          choiceFrame: true,
          optionFrame: true,
          detailFrame: true,
          previewRowFrame: true
        },
        {
          type: 'rival',
          key: 'route-event-rival-wager-board',
          residentKey: 'route-event-resident-caldra-pinion',
          choiceFrame: true,
          optionFrame: true,
          detailFrame: true
        },
      { type: 'market', key: 'market-kit-background' }
    ];
    const mkRunState = (seed = 'route-event-backdrops') => ({
      deck: [{ id: 'major_00' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed,
      currentHp: 36,
      scrap: 999,
      routeMarks: [],
      supplies: [],
      mapIndex: 0,
      completedRouteNodeIds: [],
      currentRouteNodeId: undefined,
      routeLog: [],
      nextCombat: undefined,
      signalChoices: [],
      rewardEvents: [],
    });
    const opened = [];
    for (const entry of cases) {
      let scene: any;
      let node: any;
      for (let attempt = 0; attempt < 24 && !node; attempt += 1) {
        await window.__birdSquadStartScene!('RouteScene', {
          runState: mkRunState(`route-event-backdrops-${entry.type}-${attempt}`)
        });
        g.scene.stop('MenuScene');
        await wait(50);
        scene = g.scene.getScene('RouteScene');
        node = window.__birdSquadCurrentMap!().nodes.find((candidate: any) => candidate.type === entry.type);
      }
      if (!node) {
        opened.push({ type: entry.type, missing: true });
        continue;
        }
        if (entry.type === 'market') scene.openMarketNode(node);
        else scene.openNodeChoices(node);
        for (let i = 0; i < 80; i += 1) {
          const state = JSON.parse(window.render_game_to_text!());
          const stateKey = state.market?.backdropAssetKey ?? state.nodeChoice?.backdropAssetKey ?? '';
        const rendered = scene.children.list.some((child: any) => child.texture?.key === entry.key);
        const residentRendered = !entry.residentKey
          || scene.children.list.some((child: any) => child.texture?.key === entry.residentKey);
          const extraRendered = (entry.extraKeys ?? [])
            .every((key: string) => scene.children.list.some((child: any) => child.texture?.key === key));
          const titlePlaque = state.nodeChoice?.titlePlaque;
          const choiceFrame = state.nodeChoice?.choiceFrame;
          const optionFrame = state.nodeChoice?.optionFrame;
          const titlePlaqueReady = entry.type === 'market' || (titlePlaque?.loaded && titlePlaque?.rendered && titlePlaque?.count >= 2);
          const choiceFrameReady = !entry.choiceFrame || (choiceFrame?.loaded && choiceFrame?.rendered && choiceFrame?.count >= 2);
          const optionFrameReady = !entry.optionFrame || (optionFrame?.loaded && optionFrame?.rendered && optionFrame?.count >= 2);
          if (stateKey === entry.key && scene.textures.exists(entry.key) && rendered && residentRendered && extraRendered && titlePlaqueReady && choiceFrameReady && optionFrameReady) {
            let detailFrame = state.nodeChoice?.detailFrame;
            let previewRowFrame = state.nodeChoice?.previewRowFrame;
            if (entry.detailFrame) {
              await wait(650);
              const firstChoice = scene.nodeChoiceList(node).find((choice: any) => {
                if (choice.locked) return false;
                return scene.routeChoicePreviewRows(choice).length > 0;
              }) ?? scene.nodeChoiceList(node).find((choice: any) => !choice.locked) ?? scene.nodeChoiceList(node)[0];
              for (let detailAttempt = 0; detailAttempt < 20; detailAttempt += 1) {
                if (firstChoice) scene.showRouteChoiceDetail(node, firstChoice, 1010, 402, 0x59dce8);
                await wait(50);
                const detailState = JSON.parse(window.render_game_to_text!());
                detailFrame = detailState.nodeChoice?.detailFrame;
                previewRowFrame = detailState.nodeChoice?.previewRowFrame;
                if (detailFrame?.loaded && detailFrame?.rendered && detailFrame?.count >= 1
                  && (!entry.previewRowFrame || (previewRowFrame?.loaded && previewRowFrame?.rendered && previewRowFrame?.count >= 1))) break;
              }
            }
            opened.push({
              type: entry.type,
              stateKey,
            textureLoaded: true,
            rendered: true,
              residentRendered,
              extraRendered,
              titlePlaque,
              choiceFrame,
              optionFrame,
              detailFrame,
              previewRowFrame
            });
            break;
          }
        await wait(50);
      }
      if (opened.length === cases.indexOf(entry)) {
        const state = JSON.parse(window.render_game_to_text!());
        opened.push({
          type: entry.type,
          stateKey: state.market?.backdropAssetKey ?? state.nodeChoice?.backdropAssetKey ?? '',
          textureLoaded: scene.textures.exists(entry.key),
          rendered: scene.children.list.some((child: any) => child.texture?.key === entry.key),
          residentRendered: !entry.residentKey
            || scene.children.list.some((child: any) => child.texture?.key === entry.residentKey),
            extraRendered: (entry.extraKeys ?? [])
              .every((key: string) => scene.children.list.some((child: any) => child.texture?.key === key)),
            titlePlaque: state.nodeChoice?.titlePlaque,
            choiceFrame: state.nodeChoice?.choiceFrame,
            optionFrame: state.nodeChoice?.optionFrame,
            detailFrame: state.nodeChoice?.detailFrame,
            previewRowFrame: state.nodeChoice?.previewRowFrame
          });
        }
    }
    return opened;
  });

  expect(result).toEqual([
    expect.objectContaining({ type: 'basin', stateKey: 'route-event-lantern-roost-shelter', textureLoaded: true, rendered: true, residentRendered: true, extraRendered: true, titlePlaque: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), choiceFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), optionFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), detailFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), previewRowFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }) }),
    expect.objectContaining({ type: 'cache', stateKey: 'route-event-rooftop-cache-office', textureLoaded: true, rendered: true, residentRendered: true, extraRendered: true, titlePlaque: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), optionFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), detailFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), previewRowFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }) }),
    expect.objectContaining({ type: 'signal', stateKey: 'route-event-signal-switchboard', textureLoaded: true, rendered: true, residentRendered: true, extraRendered: true, titlePlaque: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), choiceFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), optionFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), detailFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), previewRowFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }) }),
    expect.objectContaining({ type: 'nest', stateKey: 'route-event-featherwright-studio', textureLoaded: true, rendered: true, residentRendered: true, extraRendered: true, titlePlaque: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), choiceFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), optionFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), detailFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), previewRowFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }) }),
    expect.objectContaining({ type: 'rival', stateKey: 'route-event-rival-wager-board', textureLoaded: true, rendered: true, residentRendered: true, extraRendered: true, titlePlaque: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), choiceFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), optionFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }), detailFrame: expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }) }),
    expect.objectContaining({ type: 'market', stateKey: 'market-kit-background', textureLoaded: true, rendered: true })
  ]);
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
    scene.claimRouteReward();
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
    'SCRAP 40 > 85',
    'DECK 3 > 4',
    'NEXT FIGHT GROUNDED > OPEN SKY',
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

test('supplies are carried into combat and usable for an effect', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', {
      routeNodeId: 'm1_entry',
      runState: {
        deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'cups_ace' }, { id: 'swords_ace' }, { id: 'pentacles_04' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'combat-supply-test',
        currentHp: 32,
        scrap: 0,
        routeMarks: [],
        supplies: ['zip_tie_roll'],
        supplySlots: 2,
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
      }
    });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(scene.root && scene.hand?.length); i += 1) await wait(50);
    const carried = window.__birdSquadState!().route.supplies;
    const coverBefore = scene.flock.block;
    scene.useSupply(0);
    return {
      carried,
      coverBefore,
      coverAfter: scene.flock.block,
      remaining: scene.runSupplies.length,
      feedback: window.__birdSquadState!().supplyFeedback?.[0],
    };
  });
  expect(result.carried).toEqual(['zip_tie_roll']);
  expect(result.coverAfter - result.coverBefore).toBeGreaterThanOrEqual(8);
  expect(result.remaining).toBe(0);
  expect(result.feedback.id).toBe('zip_tie_roll');
});

test('card reward can be skipped for a Scrap fallback, recorded for stats', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.rewardChoices = [{ id: 'wands_02' }, { id: 'cups_02' }];
    scene.mode = 'cardReward';
    scene.shouldOfferUpgradeReward = () => true;
    const scrapBefore = scene.scrap;
    scene.skipCardReward();
    return { scrapDelta: scene.scrap - scrapBefore, rewardEvents: scene.runRewardEvents, mode: scene.mode };
  });
  expect(result.scrapDelta).toBe(12);
  expect(result.mode).toBe('upgradeReward');
  expect(result.rewardEvents[0].skipped).toBe(true);
  expect(result.rewardEvents[0].offered).toContain('wands_02');
});

test('card reward skip Scrap follows the active map economy profile', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', {
      routeNodeId: 'm4_c0_street_opening',
      runState: {
        deck: [{ id: 'major_00' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'skip-scrap-map4',
        currentHp: 36,
        scrap: 0,
        routeMarks: [],
        supplies: [],
        mapIndex: 3,
        completedRouteNodeIds: [],
        currentRouteNodeId: undefined,
        routeLog: [],
        nextCombat: undefined,
        signalChoices: [],
        rewardEvents: [],
      }
    });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.rewardChoices = [{ id: 'wands_02' }, { id: 'cups_02' }];
    scene.mode = 'cardReward';
    scene.combatEconomyAwarded = true;
    scene.shouldOfferUpgradeReward = () => false;
    const before = scene.scrap;
    scene.skipCardReward();
    return scene.scrap - before;
  });
  expect(result).toBe(18);
});

test('post-combat reward screens render generated choice ceremony art', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
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
    const spotlightCount = (scene: any) => collectObjects(scene.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-reward-choice-spotlight').length;
    const backdropCount = (scene: any) => collectObjects(scene.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-reward-ceremony-backdrop').length;
    const choiceFrameCount = (scene: any) => collectObjects(scene.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-reward-choice-card-frame').length;
    const choiceGlowBurstCount = (scene: any) => collectObjects(scene.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-reward-choice-glow-burst').length;
    const headerPlaqueCount = (scene: any) => collectObjects(scene.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-reward-header-plaque').length;
    const deckNeedChipFrameCount = (scene: any) => collectObjects(scene.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-reward-deck-need-chip-frame').length;
    const skipFrameCount = (scene: any) => collectObjects(scene.children)
      .filter((child: any) => child.texture?.key === 'ui-icon-reward-skip-command-frame').length;
    const g = window.__birdSquadGame;
    const rewardTextureKeys = [
      'ui-icon-reward-choice-spotlight',
      'ui-icon-reward-choice-glow-burst',
      'ui-icon-reward-ceremony-backdrop',
      'ui-icon-reward-choice-card-frame',
      'ui-icon-reward-header-plaque',
      'ui-icon-reward-deck-need-chip-frame',
      'ui-icon-reward-skip-command-frame'
    ];
    const waitForRewardUi = async (scene: any) => {
      for (
        let i = 0;
        i < 80 && (
          !rewardTextureKeys.every((key) => scene.textures.exists(key))
          || !scene.getTextState().battleRewardRenderer?.ready
        );
        i += 1
      ) {
        await wait(50);
      }
      scene.renderAll();
      await wait(0);
    };
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    let scene: any = g.scene.getScene('BattleScene');
    scene.rewardChoices = scene.hand.slice(0, 3);
    scene.mode = 'cardReward';
    scene.renderAll();
    await waitForRewardUi(scene);
    const cardRewardSpotlights = spotlightCount(scene);
    const cardRewardBackdrop = backdropCount(scene);
    const cardRewardFrames = choiceFrameCount(scene);
    const cardRewardGlowBursts = choiceGlowBurstCount(scene);
    const cardRewardHeaderPlaque = headerPlaqueCount(scene);
    const cardRewardDeckNeedChipFrame = deckNeedChipFrameCount(scene);
    const cardRewardSkipFrame = skipFrameCount(scene);
    const cardRewardObservationTexts = collectObjects(scene.children)
      .filter((child: any) => child.name === 'reward-build-observation')
      .map((child: any) => child.text);
    const cardRewardBattleChrome = collectObjects(scene.children)
      .filter((child: any) => ['ui-icon-combat-pile-dock', 'ui-icon-combat-roost-command-frame', 'ui-icon-combat-hand-rail'].includes(child.texture?.key))
      .length;
    const cardRewardState = scene.getTextState();
    const cardRewardTelemetry = cardRewardState.rewardCeremonyBackdrop;
    const cardRewardFrameTelemetry = cardRewardState.rewardChoiceCardFrame;
    const cardRewardGlowTelemetry = cardRewardState.rewardChoiceGlowBurst;
    const cardRewardHeaderTelemetry = cardRewardState.rewardHeaderPlaque;
    const cardRewardDeckNeedTelemetry = cardRewardState.rewardDeckNeedChipFrame;
    const cardRewardSkipTelemetry = cardRewardState.rewardSkipCommandFrame;
    const cardRewardGuidance = cardRewardState.rewardChoices;
    scene.showChoiceCardDetail(scene.rewardChoices[0], 336, 402);
    const cardRewardPreviewCenter = scene.cardPreview?.list?.[0]?.x;
    scene.hideCardPreview();

    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    scene = g.scene.getScene('BattleScene');
    scene.waymarkChoices = scene.createWaymarkRewardChoices().slice(0, 3);
    scene.mode = 'waymarkReward';
    scene.renderAll();
    await waitForRewardUi(scene);
    const waymarkRewardSpotlights = spotlightCount(scene);
    const waymarkRewardBackdrop = backdropCount(scene);
    const waymarkRewardFrames = choiceFrameCount(scene);
    const waymarkRewardGlowBursts = choiceGlowBurstCount(scene);
    const waymarkRewardHeaderPlaque = headerPlaqueCount(scene);
    const waymarkRewardDeckNeedChipFrame = deckNeedChipFrameCount(scene);
    const waymarkRewardState = scene.getTextState();
    const waymarkRewardTelemetry = waymarkRewardState.rewardCeremonyBackdrop;
    const waymarkRewardFrameTelemetry = waymarkRewardState.rewardChoiceCardFrame;
    const waymarkRewardGlowTelemetry = waymarkRewardState.rewardChoiceGlowBurst;
    const waymarkRewardHeaderTelemetry = waymarkRewardState.rewardHeaderPlaque;
    const waymarkRewardDeckNeedTelemetry = waymarkRewardState.rewardDeckNeedChipFrame;

    scene.upgradeChoices = scene.allDeckCards().slice(0, 3);
    scene.mode = 'upgradeReward';
    scene.renderAll();
    await waitForRewardUi(scene);
    const upgradeRewardSpotlights = spotlightCount(scene);
    const upgradeRewardBackdrop = backdropCount(scene);
    const upgradeRewardFrames = choiceFrameCount(scene);
    const upgradeRewardGlowBursts = choiceGlowBurstCount(scene);
    const upgradeRewardHeaderPlaque = headerPlaqueCount(scene);
    const upgradeRewardDeckNeedChipFrame = deckNeedChipFrameCount(scene);
    const upgradeRewardState = scene.getTextState();
    const upgradeRewardTelemetry = upgradeRewardState.rewardCeremonyBackdrop;
    const upgradeRewardFrameTelemetry = upgradeRewardState.rewardChoiceCardFrame;
    const upgradeRewardGlowTelemetry = upgradeRewardState.rewardChoiceGlowBurst;
    const upgradeRewardHeaderTelemetry = upgradeRewardState.rewardHeaderPlaque;
    const upgradeRewardDeckNeedTelemetry = upgradeRewardState.rewardDeckNeedChipFrame;

    return {
      loaded: scene.textures.exists('ui-icon-reward-choice-spotlight'),
      glowBurstLoaded: scene.textures.exists('ui-icon-reward-choice-glow-burst'),
      backdropLoaded: scene.textures.exists('ui-icon-reward-ceremony-backdrop'),
      frameLoaded: scene.textures.exists('ui-icon-reward-choice-card-frame'),
      headerPlaqueLoaded: scene.textures.exists('ui-icon-reward-header-plaque'),
      deckNeedChipFrameLoaded: scene.textures.exists('ui-icon-reward-deck-need-chip-frame'),
      skipFrameLoaded: scene.textures.exists('ui-icon-reward-skip-command-frame'),
      cardRewardSpotlights,
      waymarkRewardSpotlights,
      upgradeRewardSpotlights,
      cardRewardBackdrop,
      waymarkRewardBackdrop,
      upgradeRewardBackdrop,
      cardRewardFrames,
      cardRewardGlowBursts,
      cardRewardHeaderPlaque,
      cardRewardDeckNeedChipFrame,
      cardRewardSkipFrame,
      cardRewardObservationTexts,
      cardRewardGuidance,
      cardRewardPreviewCenter,
      cardRewardBattleChrome,
      waymarkRewardFrames,
      waymarkRewardGlowBursts,
      waymarkRewardHeaderPlaque,
      waymarkRewardDeckNeedChipFrame,
      upgradeRewardFrames,
      upgradeRewardGlowBursts,
      upgradeRewardHeaderPlaque,
      upgradeRewardDeckNeedChipFrame,
      cardRewardTelemetry,
      waymarkRewardTelemetry,
      upgradeRewardTelemetry,
      cardRewardFrameTelemetry,
      cardRewardGlowTelemetry,
      cardRewardHeaderTelemetry,
      cardRewardDeckNeedTelemetry,
      cardRewardSkipTelemetry,
      waymarkRewardFrameTelemetry,
      waymarkRewardGlowTelemetry,
      waymarkRewardHeaderTelemetry,
      waymarkRewardDeckNeedTelemetry,
      upgradeRewardFrameTelemetry,
      upgradeRewardGlowTelemetry,
      upgradeRewardHeaderTelemetry,
      upgradeRewardDeckNeedTelemetry,
      rewardRenderer: upgradeRewardState.battleRewardRenderer
    };
  });

  expect(result.loaded).toBe(true);
  expect(result.glowBurstLoaded).toBe(true);
  expect(result.backdropLoaded).toBe(true);
  expect(result.frameLoaded).toBe(true);
  expect(result.headerPlaqueLoaded).toBe(true);
  expect(result.deckNeedChipFrameLoaded).toBe(true);
  expect(result.skipFrameLoaded).toBe(true);
  expect(result.cardRewardSpotlights).toBeGreaterThanOrEqual(3);
  expect(result.waymarkRewardSpotlights).toBeGreaterThanOrEqual(3);
  expect(result.upgradeRewardSpotlights).toBeGreaterThanOrEqual(3);
  expect(result.cardRewardBackdrop).toBeGreaterThanOrEqual(1);
  expect(result.waymarkRewardBackdrop).toBeGreaterThanOrEqual(1);
  expect(result.upgradeRewardBackdrop).toBeGreaterThanOrEqual(1);
  expect(result.cardRewardFrames).toBeGreaterThanOrEqual(3);
  expect(result.cardRewardGlowBursts).toBeGreaterThanOrEqual(3);
  expect(result.cardRewardHeaderPlaque).toBe(1);
  expect(result.cardRewardDeckNeedChipFrame).toBe(3);
  expect(result.cardRewardSkipFrame).toBeGreaterThanOrEqual(1);
  expect(result.cardRewardObservationTexts.length).toBeGreaterThanOrEqual(3);
  expect(result.cardRewardObservationTexts.every((text: string) => !text.includes(' / '))).toBe(true);
  expect(result.cardRewardGuidance.every((choice: { observations: string[] }) => choice.observations.length > 0 && choice.observations.length <= 2)).toBe(true);
  expect(result.cardRewardPreviewCenter).toBe(336);
  expect(result.cardRewardBattleChrome).toBe(0);
  expect(result.waymarkRewardFrames).toBeGreaterThanOrEqual(3);
  expect(result.waymarkRewardGlowBursts).toBeGreaterThanOrEqual(3);
  expect(result.waymarkRewardHeaderPlaque).toBe(1);
  expect(result.waymarkRewardDeckNeedChipFrame).toBe(0);
  expect(result.upgradeRewardFrames).toBeGreaterThanOrEqual(3);
  expect(result.upgradeRewardGlowBursts).toBeGreaterThanOrEqual(3);
  expect(result.upgradeRewardHeaderPlaque).toBe(1);
  expect(result.upgradeRewardDeckNeedChipFrame).toBe(0);
  expect(result.cardRewardTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }));
  expect(result.waymarkRewardTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }));
  expect(result.upgradeRewardTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }));
  expect(result.cardRewardFrameTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }));
  expect(result.cardRewardGlowTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: result.cardRewardGlowBursts }));
  expect(result.cardRewardHeaderTelemetry).toEqual({ loaded: true, rendered: true, count: result.cardRewardHeaderPlaque });
  expect(result.cardRewardDeckNeedTelemetry).toEqual({ loaded: true, rendered: true, count: result.cardRewardDeckNeedChipFrame });
  expect(result.cardRewardSkipTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: result.cardRewardSkipFrame }));
  expect(result.waymarkRewardFrameTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }));
  expect(result.waymarkRewardGlowTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: result.waymarkRewardGlowBursts }));
  expect(result.waymarkRewardHeaderTelemetry).toEqual({ loaded: true, rendered: true, count: result.waymarkRewardHeaderPlaque });
  expect(result.waymarkRewardDeckNeedTelemetry).toEqual({ loaded: true, rendered: false, count: result.waymarkRewardDeckNeedChipFrame });
  expect(result.upgradeRewardFrameTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }));
  expect(result.upgradeRewardGlowTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: result.upgradeRewardGlowBursts }));
  expect(result.upgradeRewardHeaderTelemetry).toEqual({ loaded: true, rendered: true, count: result.upgradeRewardHeaderPlaque });
  expect(result.upgradeRewardDeckNeedTelemetry).toEqual({ loaded: true, rendered: false, count: result.upgradeRewardDeckNeedChipFrame });
  expect(result.rewardRenderer).toEqual({ requested: true, ready: true, loaded: true, failed: false });
});

test('reward decision chips preview the exact add and Preen outcomes before commitment', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const start = async () => {
      const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
      for (let i = 0; i < 100 && (!scene.scene.isActive() || scene.combatAnimationPending); i += 1) await wait(50);
      return scene;
    };
    const waitForDeltas = async (scene: any, count: number) => {
      for (let i = 0; i < 100; i += 1) {
        scene.renderAll();
        await wait(40);
        const state = JSON.parse(window.render_game_to_text!());
        if (state.rewardDecisionDeltas?.length === count) return state.rewardDecisionDeltas;
      }
      throw new Error(`Reward decision deltas did not settle at ${count}.`);
    };

    let scene = await start();
    const addCard = scene.createRewardChoices()[0];
    scene.rewardChoices = [addCard];
    scene.mode = 'cardReward';
    const addPreview = scene.rewardCardView(addCard).decisionPreview;
    const addDeltas = await waitForDeltas(scene, 1);
    const deckBefore = scene.allDeckCards().length;
    scene.chooseRewardCard(addCard.id);
    const deckAfter = scene.allDeckCards().length;

    scene = await start();
    const preenCard = scene.allDeckCards().find((card: any) => !card.upgraded && card.text !== card.upgradedText)
      ?? scene.allDeckCards().find((card: any) => !card.upgraded);
    if (!preenCard) throw new Error('No Preen candidate was available.');
    scene.upgradeChoices = [preenCard];
    scene.mode = 'upgradeReward';
    const preenPreview = scene.rewardCardView(preenCard).decisionPreview;
    const preenDeltas = await waitForDeltas(scene, 1);
    scene.chooseUpgradeCard(preenCard.id);
    const preenActual = preenCard.upgraded ? preenCard.upgradedText : preenCard.text;

    return {
      addPreview,
      addDeltas,
      deckBefore,
      deckAfter,
      preenPreview,
      preenDeltas,
      preenUpgraded: preenCard.upgraded,
      preenActual,
    };
  });

  expect(result.addPreview).toEqual({ kind: 'add', deckBefore: result.deckBefore, before: expect.any(String), after: expect.any(String), moltBefore: expect.any(String), moltAfter: expect.any(String), statChanges: expect.any(Array) });
  expect(result.addDeltas).toEqual([`ADD  /  DECK ${result.deckBefore} > ${result.deckBefore + 1}`]);
  expect(result.deckAfter).toBe(result.deckBefore + 1);
  expect(result.preenPreview.kind).toBe('preen');
  expect(result.preenDeltas[0]).toMatch(/^PREEN  \/  /);
  expect(result.preenUpgraded).toBe(true);
  expect(result.preenActual).toBe(result.preenPreview.after);
});

test('boss Waymark reward choices mix boss items with rare-and-above items', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !scene.root; i += 1) await wait(50);
    scene.createRewardChoices = () => [];
    scene.shouldOfferUpgradeReward = () => false;
    scene.enemies.forEach((enemy: any) => { enemy.hp = 0; });
    scene.checkOutcome();
    const rewardState = window.__birdSquadState!();
    const choices = rewardState.waymarkChoices.map((choice: any) => choice.id);
    const choiceTags = Object.fromEntries(rewardState.waymarkChoices.map((choice: any) => [choice.id, choice.tags]));
    const choiceMeta = rewardState.waymarkChoices.map((choice: any) => ({
      id: choice.id,
      rarity: choice.rarity,
      source: choice.source
    }));
    const picked = rewardState.waymarkChoices.find((choice: any) => choice.source === 'boss')?.id ?? choices[0];
    scene.chooseWaymarkReward(picked);
    let route: any = g.scene.getScene('RouteScene');
    let routeState: any = {};
    for (let i = 0; i < 40; i += 1) {
      route = g.scene.getScene('RouteScene');
      routeState = JSON.parse(window.render_game_to_text!());
      if (route?.root && routeState.map) break;
      await wait(50);
    }
    return {
      rewardMode: rewardState.mode,
      choices,
      choiceTags,
      choiceMeta,
      picked,
      mapIndex: routeState.map?.index ?? -1,
      routeMarks: routeState.run?.routeMarks ?? [],
      supplies: route?.runState?.supplies ?? [],
      freePreen: route?.runState?.freePreenNextDistrict ?? 0,
      upgradedCards: route?.runState?.deck?.filter((card: any) => card.upgraded).length ?? 0,
      log: route?.runState?.routeLog ?? []
    };
  });
  expect(result.rewardMode).toBe('waymarkReward');
  expect(result.choices).toHaveLength(3);
  expect(result.choiceMeta.some((choice: any) => choice.source === 'boss')).toBe(true);
  expect(result.choiceMeta.every((choice: any) => choice.rarity === 'rare' || choice.rarity === 'boss')).toBe(true);
  const pickedTags = result.choiceTags[result.picked] ?? [];
  if (result.picked === 'reopened_roofline') {
    expect(pickedTags).toEqual(expect.arrayContaining(['Boss', 'Next District', 'Preen']));
  }
  if (result.picked === 'crowbar_debt') {
    expect(pickedTags).toEqual(expect.arrayContaining(['Anti-Cover', 'Pressure']));
  }
  expect(result.mapIndex).toBe(2);
  expect(result.routeMarks).toContain(result.picked);
});

test('market categories keep one merchandise family visible at a time', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const market = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes[0];
    market.type = 'market';
    scene.openMarketNode(market);
    const visibleSections = () => scene.children.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text)
      .filter((text: string) => ['CREW CARDS', 'WAYMARKS', 'SUPPLIES', 'SERVICES'].includes(text));
    const states: Array<{ category: string; sections: string[] }> = [];
    states.push({ category: JSON.parse(window.render_game_to_text!()).market.category, sections: visibleSections() });
    for (const key of ['TWO', 'THREE', 'FOUR']) {
      scene.input.keyboard.emit(`keydown-${key}`);
      states.push({ category: JSON.parse(window.render_game_to_text!()).market.category, sections: visibleSections() });
    }
    return {
      states,
      tabObjects: scene.children.list.filter((child: any) => child.name === 'market-category-tab').length,
      merchandiseScrims: scene.children.list.filter((child: any) => child.name === 'market-merchandise-scrim').length,
      serviceLabels: scene.children.list
        .filter((child: any) => typeof child.text === 'string')
        .map((child: any) => child.text)
        .filter((text: string) => ['Preen a Card', 'Release a Card', 'Refresh stock'].includes(text))
    };
  });

  expect(result.states).toEqual([
    { category: 'cards', sections: ['CREW CARDS'] },
    { category: 'waymarks', sections: ['WAYMARKS'] },
    { category: 'supplies', sections: ['SUPPLIES'] },
    { category: 'services', sections: ['SERVICES'] }
  ]);
  expect(result.tabObjects).toBe(8);
  expect(result.merchandiseScrims).toBe(1);
  expect(result.serviceLabels).toEqual(expect.arrayContaining(['Preen a Card', 'Release a Card', 'Refresh stock']));
});

test('market shelves stock multiple finite offers and paid refreshes', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type !== 'boss');
    market.type = 'market';
    scene.openMarketNode(market);
    scene.runState.scrap = 999;
    const firstOffer = scene.marketCardOffer()?.id;
    const beforeCardOffers = scene.marketCardOffers().map((offer: any) => ({ id: offer.id, price: offer.price, sold: !!offer.sold }));
    const beforeWaymarkOffers = scene.marketRouteMarkOffers().map((offer: any) => ({ id: offer.id, price: offer.price, sold: !!offer.sold }));
    const beforeSupplyOffers = scene.marketUtilityShelf
      .filter((offer: any) => offer.id === 'supply')
      .map((offer: any) => ({ id: offer.supplyId, price: offer.price, sold: !!offer.sold }));
    const beforeRefreshCost = scene.marketRefreshCost();
    scene.buyMarketCard();
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.marketSoldSlatFrame?.count >= 1) break;
      await wait(50);
    }
    const soldSlatAfterBuy = JSON.parse(window.render_game_to_text!()).marketSoldSlatFrame;
    const soldSlatFramesAfterBuy = scene.children.list
      .filter((child: any) => child?.texture?.key === 'ui-icon-market-sold-slat-frame')
      .map((child: any) => ({
        name: child.name,
        x: Math.round(child.x),
        y: Math.round(child.y),
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        angle: Math.round(child.angle),
        alpha: Number(child.alpha.toFixed(2)),
        visible: child.visible
      }));
    const purchaseFlourishAfterBuy = JSON.parse(window.render_game_to_text!()).market.purchaseFlourish;
    const afterBuyOffer = scene.marketCardOffer()?.id ?? '';
    const afterCardOffers = scene.marketCardOffers().map((offer: any) => ({ id: offer.id, price: offer.price, sold: !!offer.sold }));
    const deckHasOffer = scene.runState.deck.some((card: any) => card.id === firstOffer);
    const scrapAfterBuy = scene.runState.scrap;
    scene.refreshMarket();
    const purchaseFlourishAfterRefresh = JSON.parse(window.render_game_to_text!()).market.purchaseFlourish;
    const refreshedCardOffers = scene.marketCardOffers().map((offer: any) => ({ id: offer.id, price: offer.price, sold: !!offer.sold }));
    return {
      firstOffer,
      beforeCardOffers,
      beforeWaymarkOffers,
      beforeSupplyOffers,
      beforeRefreshCost,
      afterBuyOffer,
      afterCardOffers,
      deckHasOffer,
      scrapAfterBuy,
      scrapAfterRefresh: scene.runState.scrap,
      refreshCount: scene.marketRefreshCount,
      refreshedCardOffers,
      soldSlatAfterBuy,
      soldSlatFramesAfterBuy,
      purchaseFlourishAfterBuy,
      purchaseFlourishAfterRefresh
    };
  });
  expect(result.firstOffer).toBeTruthy();
  expect(result.beforeCardOffers).toHaveLength(4);
  expect(result.beforeWaymarkOffers).toHaveLength(3);
  expect(result.beforeSupplyOffers).toHaveLength(3);
  expect(new Set(result.beforeCardOffers.map((offer: any) => offer.price)).size).toBeGreaterThan(1);
  expect(result.deckHasOffer).toBe(true);
  expect(result.afterCardOffers.filter((offer: any) => offer.sold)).toHaveLength(1);
  expect(result.afterBuyOffer).toBeTruthy();
  expect(result.afterBuyOffer).not.toBe(result.firstOffer);
  expect(result.soldSlatAfterBuy).toEqual(expect.objectContaining({
    loaded: true,
    rendered: true,
    count: expect.any(Number)
  }));
  expect(result.soldSlatAfterBuy.count).toBeGreaterThanOrEqual(1);
  expect(result.soldSlatFramesAfterBuy).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: 'market-sold-slat-frame',
      width: 236,
      height: 58,
      angle: -16,
      visible: true
    })
  ]));
  expect(result.purchaseFlourishAfterBuy.loaded).toBe(true);
  expect(result.purchaseFlourishAfterBuy.rendered).toBe(true);
  expect(result.purchaseFlourishAfterBuy.bursts).toBeGreaterThanOrEqual(1);
  expect(result.refreshCount).toBe(1);
  expect(result.scrapAfterRefresh).toBe(result.scrapAfterBuy - result.beforeRefreshCost);
  expect(result.refreshedCardOffers.every((offer: any) => !offer.sold)).toBe(true);
  expect(result.purchaseFlourishAfterRefresh.loaded).toBe(true);
  expect(result.purchaseFlourishAfterRefresh.rendered).toBe(true);
  expect(result.purchaseFlourishAfterRefresh.bursts).toBeGreaterThanOrEqual(2);
});

test('late markets sell premium boss-prep and route-scout services', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {
      runState: {
        deck: [{ id: 'major_00' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'late-market-prep-test',
        currentHp: 36,
        scrap: 999,
        routeMarks: [],
        supplies: [],
        mapIndex: 2,
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
    const scene: any = g.scene.getScene('RouteScene');
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type !== 'boss');
    market.type = 'market';
    scene.openMarketNode(market);
    scene.marketCategory = 'services';
    scene.renderAll();

    const bossIndex = scene.marketUtilityShelf.findIndex((offer: any) => offer.id === 'boss_guard');
    const scoutIndex = scene.marketUtilityShelf.findIndex((offer: any) => offer.id === 'route_scout');
    const beforeScrap = scene.runState.scrap;
    const bossPrice = scene.marketUtilityShelf[bossIndex]?.price ?? 0;
    const scoutPrice = scene.marketUtilityShelf[scoutIndex]?.price ?? 0;
    const serviceKeys = [
      'ui-icon-market-boss-rigging-service',
      'ui-icon-market-route-plan-service',
      'ui-icon-market-refresh-service',
      'ui-icon-scrap-gear'
    ];
    for (let i = 0; i < 80; i += 1) {
      const ready = serviceKeys.every((key) => scene.textures.exists(key) && scene.children.list.some((child: any) => child.texture?.key === key));
      if (ready) break;
      await wait(50);
    }
    const textureState = Object.fromEntries(serviceKeys.map((key) => [key, {
      loaded: scene.textures.exists(key),
      rendered: scene.children.list.some((child: any) => child.texture?.key === key)
    }]));
    const shelfAssetKeys = scene.marketShelfArtAssets().map((asset: any) => asset?.key).filter(Boolean);
    if (bossIndex >= 0) scene.buyMarketUtility(bossIndex);
    if (scoutIndex >= 0) scene.buyMarketUtility(scoutIndex);

    return {
      bossIndex,
      scoutIndex,
      bossPrice,
      scoutPrice,
      scrapDelta: beforeScrap - scene.runState.scrap,
      nextCombat: scene.runState.nextCombat,
      routeLog: scene.runState.routeLog,
      textureState,
      shelfAssetKeys,
      sold: scene.marketUtilityShelf
        .filter((offer: any) => offer.id === 'boss_guard' || offer.id === 'route_scout')
        .map((offer: any) => ({ id: offer.id, sold: !!offer.sold }))
    };
  });

  expect(result.bossIndex).toBeGreaterThanOrEqual(0);
  expect(result.scoutIndex).toBeGreaterThanOrEqual(0);
  expect(result.scrapDelta).toBe(result.bossPrice + result.scoutPrice);
  expect(result.nextCombat.openSkyGuard).toBe(2);
  expect(result.nextCombat.bossDamageShield).toBe(18);
  expect(result.routeLog.some((entry: string) => entry.startsWith('Route plan set:'))).toBe(true);
  expect(result.textureState['ui-icon-market-boss-rigging-service']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-route-plan-service']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-refresh-service']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-scrap-gear']).toEqual({ loaded: true, rendered: true });
  expect(result.shelfAssetKeys).toContain('ui-icon-market-boss-rigging-service');
  expect(result.shelfAssetKeys).toContain('ui-icon-market-route-plan-service');
  expect(result.shelfAssetKeys).toContain('ui-icon-market-refresh-service');
  expect(result.sold).toEqual(expect.arrayContaining([
    { id: 'boss_guard', sold: true },
    { id: 'route_scout', sold: true }
  ]));
});

test('market preen service lets the player choose a card before paying', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    scene.runState.scrap = 999;
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type !== 'boss');
    market.type = 'market';
    scene.openMarketNode(market);
    const preenIndex = scene.marketUtilityShelf.findIndex((offer: any) => offer.id === 'preen');
    if (preenIndex < 0) return { missing: true };
    const shelfPrice = scene.marketUtilityShelf[preenIndex].price;
    const scrapBeforeOpen = scene.runState.scrap;
    scene.buyMarketUtility(preenIndex);
    const pickerMode = scene.cardPickerMode;
    const pickerContext = scene.cardPickerContext;
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (
        state.cardPickerFrame?.rendered
        && state.cardPickerFrame.count >= 2
        && state.cardPickerCostBadge?.rendered
        && state.marketEnamelCommandFrame?.count >= 1
      ) break;
      await wait(50);
    }
    const pickerState = JSON.parse(window.render_game_to_text!());
    const pickerFrameState = pickerState.cardPickerFrame;
    const pickerCostBadgeState = pickerState.cardPickerCostBadge;
    const marketEnamelCommandFrameState = pickerState.marketEnamelCommandFrame;
    const marketCommandFrames = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-market-enamel-command-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
        visible: child.visible
      }));
    const hasBackToMarketLabel = scene.children.list
      .filter((child: any) => typeof child.text === 'string')
      .some((child: any) => child.text === 'Back to Market');
    const soldBeforePick = !!scene.marketUtilityShelf[preenIndex].sold;
    const scrapAfterOpen = scene.runState.scrap;
    const choice = scene.pickerEligibleCards('preen', 'market').find((entry: any) => scene.runState.scrap >= entry.cost);
    const decisionPreview = scene.cardPickerDecisionDelta('preen', choice.card);
    const decisionDeltas = pickerState.cardPickerDecisionDeltas;
    scene.applyCardPick(choice.index);
    return {
      missing: false,
      shelfPrice,
      chosenCost: choice.cost,
      pickerMode,
      pickerContext,
      soldBeforePick,
      scrapBeforeOpen,
      scrapAfterOpen,
      scrapAfterPick: scene.runState.scrap,
      upgraded: !!scene.runState.deck[choice.index].upgraded,
      soldAfterPick: !!scene.marketUtilityShelf[preenIndex].sold,
      shelfPriceAfterPick: scene.marketUtilityShelf[preenIndex].price,
      pickerCleared: !scene.cardPickerMode && !scene.cardPickerContext,
      pickerFrameState,
      pickerCostBadgeState,
      decisionPreview,
      decisionDeltas,
      marketEnamelCommandFrameState,
      marketCommandFrames,
      hasBackToMarketLabel
    };
  });
  expect(result.missing).toBe(false);
  expect(result.pickerMode).toBe('preen');
  expect(result.pickerContext).toBe('market');
  expect(result.pickerFrameState).toEqual(expect.objectContaining({
    loaded: true,
    rendered: true,
    count: expect.any(Number),
    mode: 'preen',
    context: 'market'
  }));
  expect(result.pickerFrameState.count).toBeGreaterThanOrEqual(2);
  expect(result.pickerCostBadgeState).toEqual(expect.objectContaining({
    loaded: true,
    rendered: true,
    count: expect.any(Number)
  }));
  expect(result.pickerCostBadgeState.count).toBeGreaterThanOrEqual(1);
  expect(result.decisionPreview).toMatch(/\n> /);
  expect(result.decisionDeltas).toContain(result.decisionPreview);
  expect(result.decisionDeltas.every((delta: string) => {
    const [before, after] = delta.split('\n> ');
    return !!before && !!after && before !== after;
  })).toBe(true);
  expect(result.marketEnamelCommandFrameState).toEqual(expect.objectContaining({
    loaded: true,
    rendered: true,
    count: expect.any(Number)
  }));
  expect(result.marketEnamelCommandFrameState.count).toBeGreaterThanOrEqual(1);
  expect(result.marketCommandFrames.some((frame: { name: string; width: number; height: number; visible: boolean }) => (
    frame.name === 'market-enamel-command-frame'
    && frame.width === 200
    && frame.height === 56
    && frame.visible
  ))).toBe(true);
  expect(result.hasBackToMarketLabel).toBe(true);
  expect(result.soldBeforePick).toBe(false);
  expect(result.scrapAfterOpen).toBe(result.scrapBeforeOpen);
  expect(result.upgraded).toBe(true);
  expect(result.soldAfterPick).toBe(true);
  expect(result.scrapAfterPick).toBe(result.scrapBeforeOpen - result.chosenCost);
  expect(result.shelfPriceAfterPick).toBe(result.chosenCost);
  expect(result.shelfPrice).toBeLessThanOrEqual(result.chosenCost);
  expect(result.pickerCleared).toBe(true);
});

test('market remove service lets the player choose which card leaves the deck', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    scene.runState.scrap = 999;
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type !== 'boss');
    market.type = 'market';
    scene.openMarketNode(market);
    const removeIndex = scene.marketUtilityShelf.findIndex((offer: any) => offer.id === 'release');
    if (removeIndex < 0) return { missing: true };
    const deckBefore = scene.runState.deck.length;
    const scrapBeforeOpen = scene.runState.scrap;
    scene.buyMarketUtility(removeIndex);
    const pickerMode = scene.cardPickerMode;
    const pickerContext = scene.cardPickerContext;
    const soldBeforePick = !!scene.marketUtilityShelf[removeIndex].sold;
    const scrapAfterOpen = scene.runState.scrap;
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.cardPickerDecisionDeltas?.length > 0) break;
      await wait(50);
    }
    const decisionDeltas = JSON.parse(window.render_game_to_text!()).cardPickerDecisionDeltas;
    const choice = scene.pickerEligibleCards('release', 'market').find((entry: any) => scene.runState.scrap >= entry.cost);
    scene.applyCardPick(choice.index);
    return {
      missing: false,
      chosenCost: choice.cost,
      pickerMode,
      pickerContext,
      soldBeforePick,
      scrapBeforeOpen,
      scrapAfterOpen,
      scrapAfterPick: scene.runState.scrap,
      deckBefore,
      deckAfter: scene.runState.deck.length,
      decisionDeltas,
      soldAfterPick: !!scene.marketUtilityShelf[removeIndex].sold,
      pickerCleared: !scene.cardPickerMode && !scene.cardPickerContext
    };
  });
  expect(result.missing).toBe(false);
  expect(result.pickerMode).toBe('release');
  expect(result.pickerContext).toBe('market');
  expect(result.soldBeforePick).toBe(false);
  expect(result.scrapAfterOpen).toBe(result.scrapBeforeOpen);
  expect(result.decisionDeltas.every((delta: string) => delta === `DECK ${result.deckBefore} > ${result.deckBefore - 1}`)).toBe(true);
  expect(result.deckAfter).toBe(result.deckBefore - 1);
  expect(result.soldAfterPick).toBe(true);
  expect(result.scrapAfterPick).toBe(result.scrapBeforeOpen - result.chosenCost);
  expect(result.pickerCleared).toBe(true);
});

test('route workbench decision deltas update after each committed removal', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const node = window.__birdSquadCurrentMap!().nodes.find((candidate: any) => candidate.type !== 'boss');
    scene.cardPickerMode = 'release';
    scene.cardPickerContext = 'route';
    scene.cardPickerRemainingPicks = 2;
    scene.nodeChoiceNodeId = node.id;
    scene.nodeChoiceOpen = false;
    scene.renderAll();
    const settle = async (expected: string) => {
      for (let i = 0; i < 40; i += 1) {
        const state = JSON.parse(window.render_game_to_text!());
        if (state.cardPickerDecisionDeltas?.length > 0 && state.cardPickerDecisionDeltas.every((delta: string) => delta === expected)) {
          return state.cardPickerDecisionDeltas;
        }
        await wait(50);
      }
      return JSON.parse(window.render_game_to_text!()).cardPickerDecisionDeltas;
    };
    const deckBefore = scene.runState.deck.length;
    const beforeDeltas = await settle(`DECK ${deckBefore} > ${deckBefore - 1}`);
    const choice = scene.pickerEligibleCards('release', 'route')[0];
    scene.applyCardPick(choice.index);
    const deckAfter = scene.runState.deck.length;
    const afterDeltas = await settle(`DECK ${deckAfter} > ${deckAfter - 1}`);
    return {
      deckBefore,
      deckAfter,
      beforeDeltas,
      afterDeltas,
      pickerMode: scene.cardPickerMode,
      remainingPicks: scene.cardPickerRemainingPicks,
    };
  });

  expect(result.beforeDeltas.length).toBeGreaterThan(0);
  expect(result.beforeDeltas.every((delta: string) => delta === `DECK ${result.deckBefore} > ${result.deckBefore - 1}`)).toBe(true);
  expect(result.deckAfter).toBe(result.deckBefore - 1);
  expect(result.afterDeltas.length).toBeGreaterThan(0);
  expect(result.afterDeltas.every((delta: string) => delta === `DECK ${result.deckAfter} > ${result.deckAfter - 1}`)).toBe(true);
  expect(result.pickerMode).toBe('release');
  expect(result.remainingPicks).toBe(1);
});

test('market overlay renders generated shopkeeper sign and counter kit', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    scene.runState.scrap = 999;
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes[0];
    market.type = 'market';
    scene.openMarketNode(market);
    scene.marketCategory = 'catalog';
    scene.renderAll();
    const keys = [
      'market-kit-background',
      'market-kit-shopkeeper-starling',
      'market-kit-sign',
      'market-kit-counter-wares',
      'ui-icon-market-offer-tray',
      'ui-icon-market-object-backplate-frame',
      'ui-icon-market-section-header-frame',
      'ui-icon-market-vendor-title-plaque',
      'ui-icon-market-supply-crate',
      'ui-icon-market-waymark-badge',
      'ui-icon-market-preen-service',
      'ui-icon-market-remove-service',
      'ui-icon-market-refresh-service',
      'ui-icon-market-service-button-frame',
      'ui-icon-market-item-label-frame',
      'ui-icon-market-card-price-tag-frame',
      'ui-icon-market-price-chip-frame',
      'ui-icon-scrap-gear'
    ];
    for (let i = 0; i < 80; i += 1) {
      const loaded = keys.every((key) => scene.textures.exists(key));
      const rendered = keys.every((key) => scene.children.list.some((child: any) => child.texture?.key === key));
      if (loaded && rendered) break;
      await wait(50);
    }
    const textureState = Object.fromEntries(keys.map((key) => [key, {
      loaded: scene.textures.exists(key),
      rendered: scene.children.list.some((child: any) => child.texture?.key === key)
    }]));
    const offerTrayTelemetry = JSON.parse(window.render_game_to_text!()).market.offerTray;
    const priceChipFrameTelemetry = JSON.parse(window.render_game_to_text!()).market.priceChipFrame;
    const serviceButtonFrameTelemetry = JSON.parse(window.render_game_to_text!()).market.serviceButtonFrame;
    const itemLabelFrameTelemetry = JSON.parse(window.render_game_to_text!()).market.itemLabelFrame;
    const cardPriceTagFrameTelemetry = JSON.parse(window.render_game_to_text!()).market.cardPriceTagFrame;
    const objectBackplateFrameTelemetry = JSON.parse(window.render_game_to_text!()).market.objectBackplateFrame;
    const sectionHeaderFrameTelemetry = JSON.parse(window.render_game_to_text!()).market.sectionHeaderFrame;
    const vendorTitlePlaqueTelemetry = JSON.parse(window.render_game_to_text!()).marketVendorTitlePlaque;
    const objectBackplateFrames = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-market-object-backplate-frame')
      .map((child: any) => ({
        name: child.name,
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        visible: child.visible
      }));
    const sectionHeaderFrames = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-market-section-header-frame')
      .map((child: any) => ({
        name: child.name,
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        visible: child.visible
      }));
    const vendorTitlePlaques = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-market-vendor-title-plaque')
      .map((child: any) => ({
        name: child.name,
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        visible: child.visible
      }));
    const serviceButtonFrames = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-market-service-button-frame')
      .map((child: any) => ({
        name: child.name,
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha.toFixed(2)),
        visible: child.visible
      }));
    const itemLabelFrames = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-market-item-label-frame')
      .map((child: any) => ({
        name: child.name,
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha.toFixed(2)),
        visible: child.visible
      }));
    const cardPriceTagFrames = scene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-market-card-price-tag-frame')
      .map((child: any) => ({
        name: child.name,
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha.toFixed(2)),
        visible: child.visible
      }));
    const shelfAssetKeys = scene.marketShelfArtAssets().map((asset: any) => asset?.key).filter(Boolean);
    const expectedServiceButtonFrames = scene.marketUtilityShelf.filter((offer: any) => offer.id !== 'supply').length + 1;
    const expectedItemLabelFrames = scene.marketWaymarkShelf.length
      + scene.marketUtilityShelf.filter((offer: any) => offer.id === 'supply').length;
    const expectedCardPriceTagFrames = scene.marketCardShelf.length;
    return {
      textureState,
      offerTrayTelemetry,
      priceChipFrameTelemetry,
      serviceButtonFrameTelemetry,
      itemLabelFrameTelemetry,
      cardPriceTagFrameTelemetry,
      objectBackplateFrameTelemetry,
      sectionHeaderFrameTelemetry,
      vendorTitlePlaqueTelemetry,
      objectBackplateFrames,
      sectionHeaderFrames,
      vendorTitlePlaques,
      serviceButtonFrames,
      itemLabelFrames,
      cardPriceTagFrames,
      expectedServiceButtonFrames,
      expectedItemLabelFrames,
      expectedCardPriceTagFrames,
      shelfAssetKeys,
      supplyShelfOffers: scene.marketUtilityShelf.filter((offer: any) => offer.id === 'supply').length,
      waymarkShelfOffers: scene.marketWaymarkShelf.length
    };
  });

  expect(result.textureState['market-kit-background']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['market-kit-shopkeeper-starling']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['market-kit-sign']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['market-kit-counter-wares']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-offer-tray']).toEqual({ loaded: true, rendered: true });
  expect(result.offerTrayTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }));
  expect(result.offerTrayTelemetry.count).toBeGreaterThanOrEqual(10);
  expect(result.textureState['ui-icon-market-object-backplate-frame']).toEqual({ loaded: true, rendered: true });
  expect(result.objectBackplateFrameTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }));
  expect(result.objectBackplateFrameTelemetry.count).toBeGreaterThanOrEqual(6);
  expect(result.objectBackplateFrames.every((frame: { name: string; width: number; height: number; visible: boolean }) => (
    frame.name === 'market-object-backplate-frame'
    && frame.width === 130
    && frame.height === 108
    && frame.visible
  ))).toBe(true);
  expect(result.textureState['ui-icon-market-section-header-frame']).toEqual({ loaded: true, rendered: true });
  expect(result.sectionHeaderFrameTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }));
  expect(result.sectionHeaderFrameTelemetry.count).toBe(4);
  expect(result.sectionHeaderFrames).toHaveLength(4);
  expect(result.sectionHeaderFrames.every((frame: { name: string; width: number; height: number; visible: boolean }) => (
    frame.name === 'market-section-header-frame'
    && frame.height === 60
    && frame.width >= 280
    && frame.visible
  ))).toBe(true);
  expect(result.sectionHeaderFrames.some((frame: { width: number }) => frame.width >= 700)).toBe(true);
  expect(result.textureState['ui-icon-market-vendor-title-plaque']).toEqual({ loaded: true, rendered: true });
  expect(result.vendorTitlePlaqueTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: 1 }));
  expect(result.vendorTitlePlaques).toEqual([
    expect.objectContaining({
      name: 'market-vendor-title-plaque',
      width: 500,
      height: 104,
      visible: true
    })
  ]);
  expect(result.textureState['ui-icon-market-supply-crate']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-waymark-badge']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-preen-service']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-remove-service']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-refresh-service']).toEqual({ loaded: true, rendered: true });
  expect(result.textureState['ui-icon-market-service-button-frame']).toEqual({ loaded: true, rendered: true });
  expect(result.serviceButtonFrameTelemetry).toEqual({
    loaded: true,
    rendered: true,
    count: result.expectedServiceButtonFrames
  });
  expect(result.serviceButtonFrames).toHaveLength(result.expectedServiceButtonFrames);
  expect(result.serviceButtonFrames.every((frame: { name: string; width: number; height: number; alpha: number; visible: boolean }) => (
    frame.name === 'market-service-button-frame'
    && frame.width === 174
    && frame.height === 66
    && frame.alpha >= 0.9
    && frame.visible
  ))).toBe(true);
  expect(result.textureState['ui-icon-market-item-label-frame']).toEqual({ loaded: true, rendered: true });
  expect(result.itemLabelFrameTelemetry).toEqual({
    loaded: true,
    rendered: true,
    count: result.expectedItemLabelFrames
  });
  expect(result.itemLabelFrames).toHaveLength(result.expectedItemLabelFrames);
  expect(result.itemLabelFrames.every((frame: { name: string; width: number; height: number; alpha: number; visible: boolean }) => (
    frame.name === 'market-item-label-frame'
    && frame.width === 154
    && frame.height === 62
    && frame.alpha >= 0.9
    && frame.visible
  ))).toBe(true);
  expect(result.textureState['ui-icon-market-card-price-tag-frame']).toEqual({ loaded: true, rendered: true });
  expect(result.cardPriceTagFrameTelemetry).toEqual({
    loaded: true,
    rendered: true,
    count: result.expectedCardPriceTagFrames
  });
  expect(result.cardPriceTagFrames).toHaveLength(result.expectedCardPriceTagFrames);
  expect(result.cardPriceTagFrames.every((frame: { name: string; width: number; height: number; alpha: number; visible: boolean }) => (
    frame.name === 'market-card-price-tag-frame'
    && frame.width === 154
    && frame.height === 48
    && frame.alpha >= 0.9
    && frame.visible
  ))).toBe(true);
  expect(result.textureState['ui-icon-market-price-chip-frame']).toEqual({ loaded: true, rendered: true });
  expect(result.priceChipFrameTelemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }));
  expect(result.priceChipFrameTelemetry.count).toBeGreaterThanOrEqual(10);
  expect(result.textureState['ui-icon-scrap-gear']).toEqual({ loaded: true, rendered: true });
  expect(result.supplyShelfOffers).toBeGreaterThan(0);
  expect(result.waymarkShelfOffers).toBeGreaterThan(0);
  expect(result.shelfAssetKeys).toContain('ui-icon-market-supply-crate');
  expect(result.shelfAssetKeys).toContain('ui-icon-market-waymark-badge');
  expect(result.shelfAssetKeys).toContain('ui-icon-market-preen-service');
  expect(result.shelfAssetKeys).toContain('ui-icon-market-remove-service');
  expect(result.shelfAssetKeys).toContain('ui-icon-market-refresh-service');
  expect(result.shelfAssetKeys.some((key: string) => key.startsWith('supply-'))).toBe(false);
  expect(result.shelfAssetKeys.some((key: string) => key.startsWith('waymark-'))).toBe(false);
});

test('card choice surfaces expose full card details on hover', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const collectText = (container: any): string[] => (container?.list ?? []).flatMap((child: any) => (
      typeof child.text === 'string' ? [child.text] : collectText(child)
    ));
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
    const countTexture = (container: any, textureKey: string): number => (container?.list ?? []).reduce((sum: number, child: any) => {
      const self = child?.texture?.key === textureKey ? 1 : 0;
      const nested = child?.list ? countTexture(child, textureKey) : 0;
      return sum + self + nested;
    }, 0);
    const countVisibleTexture = (container: any, textureKey: string): number => collectObjects(container)
      .filter((child: any) => (
        child?.texture?.key === textureKey
        && child.visible !== false
        && (child.alpha ?? 1) > 0.01
      )).length;
    const hasFullSections = (texts: string[]) => (
      (texts.includes('Preen') || texts.includes('Base'))
      && texts.includes('Flock Stats')
    );

    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    await wait(80);
    const battle: any = g.scene.getScene('BattleScene');
    const rewardCard = battle.hand[0] ?? battle.drawPile[0];
    battle.showCardPreview(rewardCard);
    const handFrameCount = countTexture(battle.cardPreview, 'ui-icon-card-hover-dossier-frame');
    const handStatFrameCount = countTexture(battle.cardPreview, 'ui-icon-card-hover-stat-chip-frame');
    battle.showChoiceCardDetail(rewardCard, 392, 360);
    const rewardTexts = collectText(battle.cardPreview);
    const rewardFrameCount = countTexture(battle.cardPreview, 'ui-icon-card-hover-dossier-frame');
    const rewardStatFrameCount = countTexture(battle.cardPreview, 'ui-icon-card-hover-stat-chip-frame');
    const battleFrameTelemetry = JSON.parse(window.render_game_to_text()).cardHoverDossierFrame;
    const battleStatFrameTelemetry = JSON.parse(window.render_game_to_text()).cardHoverStatChipFrame;
    battle.rewardChoices = battle.hand.slice(0, 3);
    battle.mode = 'cardReward';
    battle.renderAll();
    const rewardUiKeys = [
      'ui-icon-reward-choice-hover-ring',
      'ui-icon-reward-choice-spotlight',
      'ui-icon-reward-choice-glow-burst',
      'ui-icon-reward-choice-card-frame',
      'ui-icon-reward-ceremony-backdrop'
    ];
    for (let i = 0; i < 80 && !rewardUiKeys.every((key) => battle.textures.exists(key)); i += 1) await wait(50);
    battle.renderAll();
    for (let i = 0; i < 80 && battle.getTextState().rewardChoiceHoverRing?.count !== 3; i += 1) await wait(50);
    const rewardChoiceHit = collectObjects(battle.children)
      .find((child: any) => (
        child.name === 'reward-choice-card-hit'
        && Math.abs((child.x ?? 0) - 336) < 2
      ));
    const rewardHoverRingBefore = countVisibleTexture(battle.children, 'ui-icon-reward-choice-hover-ring');
    rewardChoiceHit?.emit('pointerover');
    const rewardHoverRingDuring = countVisibleTexture(battle.children, 'ui-icon-reward-choice-hover-ring');
    const rewardHoverRingTelemetry = JSON.parse(window.render_game_to_text()).rewardChoiceHoverRing;
    rewardChoiceHit?.emit('pointerout');
    await wait(40);
    const rewardHoverRingAfter = countVisibleTexture(battle.children, 'ui-icon-reward-choice-hover-ring');

    await window.__birdSquadStartScene!('RouteScene', {});
    await wait(80);
    const route: any = g.scene.getScene('RouteScene');
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type !== 'boss');
    market.type = 'market';
    route.openMarketNode(market);
    route.runState.scrap = 999;
    const marketOffer = route.marketCardOffer();
    route.showHoverCardDetail(marketOffer, 'Market offer', 55, 250, 372);
    const marketTexts = collectText(route.hoverCardDetail);
    const marketFrameCount = countTexture(route.hoverCardDetail, 'ui-icon-card-hover-dossier-frame');
    const marketStatFrameCount = countTexture(route.hoverCardDetail, 'ui-icon-card-hover-stat-chip-frame');

    const preenEntry = route.pickerEligibleCards('preen')[0];
    route.showHoverCardDetail(preenEntry.card, 'Preen candidate', preenEntry.cost, 640, 430);
    const preenTexts = collectText(route.hoverCardDetail);
    const preenFrameCount = countTexture(route.hoverCardDetail, 'ui-icon-card-hover-dossier-frame');
    const preenStatFrameCount = countTexture(route.hoverCardDetail, 'ui-icon-card-hover-stat-chip-frame');
    const routeFrameTelemetry = JSON.parse(window.render_game_to_text()).cardHoverDossierFrame;
    const routeStatFrameTelemetry = JSON.parse(window.render_game_to_text()).cardHoverStatChipFrame;

    return {
      reward: hasFullSections(rewardTexts),
      market: hasFullSections(marketTexts),
      preen: hasFullSections(preenTexts),
      rewardTitle: rewardTexts.includes(rewardCard.name),
      marketTitle: marketTexts.includes(marketOffer.name),
      preenTitle: preenTexts.includes(preenEntry.card.name),
      handFrameCount,
      handStatFrameCount,
      rewardFrameCount,
      rewardStatFrameCount,
      marketFrameCount,
      marketStatFrameCount,
      preenFrameCount,
      preenStatFrameCount,
      battleFrameTelemetry,
      battleStatFrameTelemetry,
      routeStatFrameTelemetry,
      routeFrameTelemetry,
      rewardHoverRingLoaded: battle.textures.exists('ui-icon-reward-choice-hover-ring'),
      rewardHoverRingBefore,
      rewardHoverRingDuring,
      rewardHoverRingAfter,
      rewardHoverRingTelemetry
    };
  });
  expect(result.reward).toBe(true);
  expect(result.market).toBe(true);
  expect(result.preen).toBe(true);
  expect(result.rewardTitle).toBe(true);
  expect(result.marketTitle).toBe(true);
  expect(result.preenTitle).toBe(true);
  expect(result.handFrameCount).toBeGreaterThanOrEqual(1);
  expect(result.handStatFrameCount).toBeGreaterThanOrEqual(1);
  expect(result.rewardFrameCount).toBeGreaterThanOrEqual(1);
  expect(result.rewardStatFrameCount).toBeGreaterThanOrEqual(1);
  expect(result.marketFrameCount).toBeGreaterThanOrEqual(1);
  expect(result.marketStatFrameCount).toBeGreaterThanOrEqual(1);
  expect(result.preenFrameCount).toBeGreaterThanOrEqual(1);
  expect(result.preenStatFrameCount).toBeGreaterThanOrEqual(1);
  expect(result.battleFrameTelemetry).toMatchObject({ loaded: true, rendered: true });
  expect(result.battleStatFrameTelemetry).toMatchObject({ loaded: true, rendered: true });
  expect(result.routeFrameTelemetry).toMatchObject({ loaded: true, rendered: true });
  expect(result.routeStatFrameTelemetry).toMatchObject({ loaded: true, rendered: true });
  expect(result.rewardHoverRingLoaded).toBe(true);
  expect(result.rewardHoverRingBefore).toBe(0);
  expect(result.rewardHoverRingDuring).toBe(1);
  expect(result.rewardHoverRingAfter).toBe(0);
  expect(result.rewardHoverRingTelemetry).toMatchObject({ loaded: true, rendered: true, count: 3, visible: 1 });
});

test('route preen picker keeps large decks inside a two-row viewport', async ({ page }) => {
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
    await wait(80);
    const route: any = g.scene.getScene('RouteScene');
    const nest = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'nest')
      ?? window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type !== 'boss');
    route.runState.deck = Array.from({ length: 18 }, (_, index) => ({
      id: ['major_00', 'wands_ace', 'cups_ace', 'swords_ace', 'pentacles_04', 'major_07'][index % 6],
      upgraded: false
    }));
    route.cardPickerMode = 'preen';
    route.cardPickerContext = 'route';
    route.nodeChoiceNodeId = nest.id;
    route.renderAll();

    const visibleCardArtCount = () => route.children.list
      .filter((child: any) => typeof child.texture?.key === 'string')
      .filter((child: any) => child.texture.key.startsWith('card-thumb-') || child.texture.key.startsWith('card-'))
      .length;
    for (let i = 0; i < 60 && visibleCardArtCount() < 10; i += 1) await wait(50);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (
        state.cardPickerFrame?.rendered
        && state.cardPickerFrame.count >= 2
        && state.cardPickerCostBadge?.count >= 10
        && state.cardPickerNameplateFrame?.count >= 10
        && state.cardPickerContextPlaque?.count === 1
      ) break;
      await wait(50);
    }
    const firstState = JSON.parse(window.render_game_to_text!());
    const pickerFrameState = firstState.cardPickerFrame;
    const pickerCostBadgeState = firstState.cardPickerCostBadge;
    const pickerNameplateFrameState = firstState.cardPickerNameplateFrame;
    const pickerContextPlaqueState = firstState.cardPickerContextPlaque;

    const pickerHitAreas = () => route.children.list
      .filter((child: any) => child.type === 'Rectangle' && Math.abs((child.fillAlpha ?? 0) - 0.01) < 0.001)
      .map((child: any) => {
        const bounds = child.getBounds();
        return { bottom: bounds.bottom, height: bounds.height };
      })
      .filter((bounds: any) => bounds.height > 180);
    const rangeTexts = () => route.children.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text);
    const scrollButtonFrames = () => route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-card-picker-scroll-button-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
        visible: child.visible
      }));
    const pageIndicatorFrames = () => route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-card-picker-page-indicator-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
        visible: child.visible
      }));
    const nameplateFrames = () => route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-card-picker-nameplate-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
        visible: child.visible
      }));
    const contextPlaques = () => route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-card-picker-context-plaque')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
        visible: child.visible
      }));
    const cancelCommandFrames = () => route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-route-event-cancel-command-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
        visible: child.visible
      }));

    const firstPageHitAreas = pickerHitAreas();
    const firstPageScrollButtonFrames = scrollButtonFrames();
    const firstPagePageIndicatorFrames = pageIndicatorFrames();
    const firstPageNameplateFrames = nameplateFrames();
    const firstPageContextPlaques = contextPlaques();
    const firstPageCancelCommandFrames = cancelCommandFrames();
    const hasCancelLabel = rangeTexts().includes('Cancel');
    const hasContextLabel = rangeTexts().includes(nest.label ?? 'Workshop stop');
    const firstPageRange = rangeTexts().find((text: string) => text.includes(' / 18'));
    route.scrollCardPicker(1);
    const secondPageRange = rangeTexts().find((text: string) => text.includes(' / 18'));
    const updatedState = JSON.parse(window.render_game_to_text!());
    const pickerScrollButtonFrameState = updatedState.cardPickerScrollButtonFrame;
    const pickerPageIndicatorFrameState = updatedState.cardPickerPageIndicatorFrame;
    const routeEventCancelCommandFrameState = updatedState.routeEventCancelCommandFrame;

    return {
      firstPageCount: firstPageHitAreas.length,
      maxHitBottom: Math.max(...firstPageHitAreas.map((bounds: any) => bounds.bottom)),
      firstPageRange,
      secondPageRange,
      firstPageArtCount: visibleCardArtCount(),
      firstPageScrollButtonFrames,
      firstPagePageIndicatorFrames,
      firstPageNameplateFrames,
      firstPageContextPlaques,
      firstPageCancelCommandFrames,
      hasCancelLabel,
      hasContextLabel,
      scroll: route.cardPickerScroll,
      pickerFrameState,
      pickerCostBadgeState,
      pickerNameplateFrameState,
      pickerContextPlaqueState,
      pickerScrollButtonFrameState,
      pickerPageIndicatorFrameState,
      routeEventCancelCommandFrameState
    };
  });

  expect(result.firstPageCount).toBe(10);
  expect(result.firstPageArtCount).toBeGreaterThanOrEqual(10);
  expect(result.maxHitBottom).toBeLessThan(650);
  expect(result.firstPageRange).toBe('1-10 / 18');
  expect(result.secondPageRange).toBe('6-15 / 18');
  expect(result.scroll).toBe(1);
  expect(result.pickerFrameState).toEqual(expect.objectContaining({
    loaded: true,
    rendered: true,
    count: expect.any(Number),
    mode: 'preen',
    context: 'route'
  }));
  expect(result.pickerFrameState.count).toBeGreaterThanOrEqual(2);
  expect(result.pickerCostBadgeState).toEqual({
    loaded: true,
    rendered: true,
    count: 10
  });
  expect(result.pickerNameplateFrameState).toEqual({
    loaded: true,
    rendered: true,
    count: 10
  });
  expect(result.pickerContextPlaqueState).toEqual({
    loaded: true,
    rendered: true,
    count: 1
  });
  expect(result.firstPageContextPlaques).toHaveLength(1);
  expect(result.firstPageContextPlaques[0]).toEqual(expect.objectContaining({
    name: 'card-picker-context-plaque',
    width: 336,
    height: 66,
    visible: true
  }));
  expect(result.firstPageNameplateFrames).toHaveLength(10);
  expect(result.firstPageNameplateFrames.every((frame: { name: string; width: number; height: number; visible: boolean }) => (
    frame.name === 'card-picker-nameplate-frame'
    && frame.width === 106
    && frame.height === 32
    && frame.visible
  ))).toBe(true);
  expect(result.pickerScrollButtonFrameState).toEqual({
    loaded: true,
    rendered: true,
    count: 2
  });
  expect(result.pickerPageIndicatorFrameState).toEqual({
    loaded: true,
    rendered: true,
    count: 1
  });
  expect(result.firstPagePageIndicatorFrames).toHaveLength(1);
  expect(result.firstPagePageIndicatorFrames[0]).toEqual(expect.objectContaining({
    name: 'card-picker-page-indicator-frame',
    width: 104,
    height: 30,
    visible: true
  }));
  expect(result.firstPageScrollButtonFrames).toHaveLength(2);
  expect(result.firstPageScrollButtonFrames.every((frame: { name: string; width: number; height: number; visible: boolean }) => (
    frame.name === 'card-picker-scroll-button-frame'
    && frame.width === 48
    && frame.height === 36
    && frame.visible
  ))).toBe(true);
  expect(result.routeEventCancelCommandFrameState).toEqual({
    loaded: true,
    rendered: true,
    count: 1
  });
  expect(result.firstPageCancelCommandFrames).toHaveLength(1);
  expect(result.firstPageCancelCommandFrames[0]).toEqual(expect.objectContaining({
    name: 'route-event-cancel-command-frame',
    width: 188,
    height: 52,
    visible: true
  }));
  expect(result.hasCancelLabel).toBe(true);
  expect(result.hasContextLabel).toBe(true);
});

test('market item detail surfaces non-card offer stats', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const countTexture = (container: any, textureKey: string): number => (container?.list ?? []).reduce((sum: number, child: any) => {
      const self = child?.texture?.key === textureKey ? 1 : 0;
      const nested = child?.list ? countTexture(child, textureKey) : 0;
      return sum + self + nested;
    }, 0);
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    await wait(80);
    const route: any = g.scene.getScene('RouteScene');
    route.runState.scrap = 999;
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type !== 'boss');
    market.type = 'market';
    route.openMarketNode(market);
    await wait(120);
    const offer = route.marketRouteMarkOffers().find((candidate: any) => !candidate.sold);
    route.showMarketWaymarkDetail({
      ...offer,
      family: 'route',
      rarity: 'common',
      source: 'market',
      trigger: 'Market hover',
      effect: offer.text,
      description: offer.text
    }, offer.price, 510, 568);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.marketItemDetailFrame?.rendered && state.marketItemDetailFrame.count >= 2) break;
      await wait(50);
    }
    const texts = (route?.marketItemHover?.list ?? [])
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text);
    return {
      texts,
      frameCount: countTexture(route.marketItemHover, 'ui-icon-market-detail-dossier-frame'),
      telemetry: JSON.parse(window.render_game_to_text!()).marketItemDetailFrame
    };
  });
  expect(result.texts.some((text: string) => /^\d+$/.test(text))).toBe(true);
  expect(result.texts.some((text: string) => text.toLowerCase().includes('waymark'))).toBe(true);
  expect(result.texts.some((text: string) => text.includes('Trigger:'))).toBe(true);
  expect(result.texts.some((text: string) => text.includes('Effect:'))).toBe(true);
  expect(result.frameCount).toBeGreaterThanOrEqual(2);
  expect(result.telemetry).toEqual(expect.objectContaining({ loaded: true, rendered: true, count: expect.any(Number) }));
  expect(result.telemetry.count).toBeGreaterThanOrEqual(2);
});

test('every Market purchase previews the same primary deltas its commit resolves', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {
      runState: {
        deck: [{ id: 'major_00' }, { id: 'wands_ace' }],
        leaderId: 'fledgling', difficulty: 0, seed: 'market-preview-parity', runMode: 'full',
        currentHp: 36, scrap: 1500, routeMarks: ['ledger_tab'], supplies: [], mapIndex: 2,
        completedRouteNodeIds: [], currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined,
        signalChoices: [], rewardEvents: [], routeDecisions: [], suppliesUsed: [], combatResults: [],
        freePreenNextDistrict: 0
      }
    });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const market = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type !== 'boss');
    market.type = 'market';
    scene.openMarketNode(market);
    scene.runState.scrap = 1500;

    const cardListing = scene.marketCardShelf[0];
    const cardBefore = {
      deck: scene.runState.deck.length,
      guard: scene.runState.nextCombat?.openSkyGuard ?? 0,
      skyCut: scene.runState.nextCombat?.reduceNextOpenSky ?? 0,
      scrap: scene.runState.scrap
    };
    const cardPreview = scene.marketCardDecisionPreview(cardListing);
    const card = scene.marketCardOffers()[0].card;
    scene.showHoverCardDetail(card, 'Market offer', cardListing.price, 650, 360, cardPreview);
    const cardRenderedPreview = JSON.parse(window.render_game_to_text!()).market.decisionPreview;
    scene.buyMarketCard(0);
    const cardAfter = {
      deck: scene.runState.deck.length,
      guard: scene.runState.nextCombat?.openSkyGuard ?? 0,
      skyCut: scene.runState.nextCombat?.reduceNextOpenSky ?? 0,
      scrap: scene.runState.scrap
    };

    const waymarkListing = scene.marketWaymarkShelf.find((listing: any) => !listing.sold);
    const waymarkOffer = scene.marketRouteMarkOffers().find((offer: any) => offer.id === waymarkListing.id);
    const waymarkBefore = { count: scene.runState.routeMarks.length, scrap: scene.runState.scrap };
    const waymarkPreview = scene.marketWaymarkDecisionPreview(waymarkListing);
    scene.showMarketWaymarkDetail({
      ...waymarkOffer,
      family: 'route', rarity: 'common', source: 'market', trigger: 'Market hover',
      effect: waymarkOffer.text, effects: [], description: waymarkOffer.text
    }, waymarkListing.price, 510, 568);
    const waymarkRenderedPreview = JSON.parse(window.render_game_to_text!()).market.decisionPreview;
    scene.buyMarketRouteMark(scene.marketWaymarkShelf.indexOf(waymarkListing));
    const waymarkAfter = { count: scene.runState.routeMarks.length, scrap: scene.runState.scrap };

    const supplyIndex = scene.marketUtilityShelf.findIndex((listing: any) => listing.id === 'supply' && !listing.sold);
    const supplyListing = scene.marketUtilityShelf[supplyIndex];
    const supplyBefore = {
      count: scene.runState.supplies.length,
      cap: JSON.parse(window.render_game_to_text!()).run.supplySlots,
      scrap: scene.runState.scrap
    };
    const supplyPreview = scene.marketUtilityDecisionPreview(supplyListing);
    scene.buyMarketUtility(supplyIndex);
    const supplyAfter = {
      count: scene.runState.supplies.length,
      cap: JSON.parse(window.render_game_to_text!()).run.supplySlots,
      scrap: scene.runState.scrap
    };

    const bossIndex = scene.marketUtilityShelf.findIndex((listing: any) => listing.id === 'boss_guard');
    const bossListing = scene.marketUtilityShelf[bossIndex];
    const bossBefore = {
      shield: scene.runState.nextCombat?.bossDamageShield ?? 0,
      guard: scene.runState.nextCombat?.openSkyGuard ?? 0,
      scrap: scene.runState.scrap
    };
    const bossPreview = scene.marketUtilityDecisionPreview(bossListing);
    scene.showMarketUtilityDetail(bossListing, 780, 300);
    const bossRenderedPreview = JSON.parse(window.render_game_to_text!()).market.decisionPreview;
    scene.buyMarketUtility(bossIndex);
    const bossAfter = {
      shield: scene.runState.nextCombat?.bossDamageShield ?? 0,
      guard: scene.runState.nextCombat?.openSkyGuard ?? 0,
      scrap: scene.runState.scrap
    };

    const scoutIndex = scene.marketUtilityShelf.findIndex((listing: any) => listing.id === 'route_scout');
    const scoutListing = scene.marketUtilityShelf[scoutIndex];
    const scoutBefore = {
      guard: scene.runState.nextCombat?.openSkyGuard ?? 0,
      skyCut: scene.runState.nextCombat?.reduceNextOpenSky ?? 0,
      scrap: scene.runState.scrap
    };
    const scoutPreview = scene.marketUtilityDecisionPreview(scoutListing);
    scene.buyMarketUtility(scoutIndex);
    const scoutAfter = {
      guard: scene.runState.nextCombat?.openSkyGuard ?? 0,
      skyCut: scene.runState.nextCombat?.reduceNextOpenSky ?? 0,
      scrap: scene.runState.scrap
    };

    const refreshBefore = { round: scene.marketRefreshCount, scrap: scene.runState.scrap };
    const refreshCost = scene.marketRefreshCost();
    const refreshPreview = scene.marketRefreshDecisionPreview(refreshCost);
    scene.showMarketRefreshDetail(refreshCost, 780, 560);
    const refreshRenderedPreview = JSON.parse(window.render_game_to_text!()).market.decisionPreview;
    scene.refreshMarket();
    const refreshAfter = { round: scene.marketRefreshCount, scrap: scene.runState.scrap };

    return {
      cardBefore, cardAfter, cardPreview, cardRenderedPreview,
      waymarkBefore, waymarkAfter, waymarkPreview, waymarkRenderedPreview,
      supplyBefore, supplyAfter, supplyPreview,
      bossBefore, bossAfter, bossPreview, bossRenderedPreview,
      scoutBefore, scoutAfter, scoutPreview,
      refreshBefore, refreshAfter, refreshPreview, refreshRenderedPreview
    };
  });

  expect(result.cardPreview).toEqual(result.cardRenderedPreview);
  expect(result.cardPreview).toContain(`DECK ${result.cardBefore.deck} > ${result.cardAfter.deck}`);
  expect(result.cardPreview).toContain(`SKY GUARD ${result.cardBefore.guard} > ${result.cardAfter.guard}`);
  expect(result.cardPreview).toContain(`OPEN SKY CUT ${result.cardBefore.skyCut} > ${result.cardAfter.skyCut}`);
  expect(result.cardPreview).toContain(`SCRAP ${result.cardBefore.scrap} > ${result.cardAfter.scrap}`);
  expect(result.waymarkPreview).toEqual(result.waymarkRenderedPreview);
  expect(result.waymarkPreview.some((row: string) => row.startsWith('WAYMARK'))).toBe(true);
  expect(result.waymarkPreview).toContain(`SCRAP ${result.waymarkBefore.scrap} > ${result.waymarkAfter.scrap}`);
  expect(result.waymarkAfter.count).toBe(result.waymarkBefore.count + 1);
  expect(result.supplyPreview).toContain(`SUPPLIES ${result.supplyBefore.count}/${result.supplyBefore.cap} > ${result.supplyAfter.count}/${result.supplyAfter.cap}`);
  expect(result.supplyPreview).toContain(`SCRAP ${result.supplyBefore.scrap} > ${result.supplyAfter.scrap}`);
  expect(result.bossPreview).toEqual(result.bossRenderedPreview);
  expect(result.bossPreview).toContain(`BOSS SHIELD ${result.bossBefore.shield} > ${result.bossAfter.shield}`);
  expect(result.bossPreview).toContain(`SKY GUARD ${result.bossBefore.guard} > ${result.bossAfter.guard}`);
  expect(result.bossPreview).toContain(`SCRAP ${result.bossBefore.scrap} > ${result.bossAfter.scrap}`);
  expect(result.scoutPreview).toContain(`SKY GUARD ${result.scoutBefore.guard} > ${result.scoutAfter.guard}`);
  expect(result.scoutPreview).toContain(`OPEN SKY CUT ${result.scoutBefore.skyCut} > ${result.scoutAfter.skyCut}`);
  expect(result.scoutPreview).toContain(`SCRAP ${result.scoutBefore.scrap} > ${result.scoutAfter.scrap}`);
  expect(result.refreshPreview).toEqual(result.refreshRenderedPreview);
  expect(result.refreshPreview).toContain(`STOCK ROUND ${result.refreshBefore.round} > ${result.refreshAfter.round}`);
  expect(result.refreshPreview).toContain(`SCRAP ${result.refreshBefore.scrap} > ${result.refreshAfter.scrap}`);
});

test('post-combat Preen is gated by encounter reward profile', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const seedBattle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(seedBattle.hand && seedBattle.hand.length); i += 1) await wait(50);
    const deck = [...seedBattle.drawPile, ...seedBattle.hand, ...seedBattle.discardPile]
      .map((card: any) => ({ id: card.id, upgraded: !!card.upgraded }));
    const runState = {
      deck, leaderId: seedBattle.runLeaderId, difficulty: 0, seed: 'preen-profile-test', currentHp: 36,
      scrap: 0, routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [],
      currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
    };
    seedBattle.init({ runState });
    const map = (window as any).__birdSquadCurrentMap();
    const streets = map.nodes.filter((node: any) => node.type === 'street');
    const rival = map.nodes.find((node: any) => node.type === 'rival');
    const streetPreenWindows: boolean[] = [];
    for (const node of streets) {
      await window.__birdSquadStartScene!('BattleScene', { runState, routeNodeId: node.id });
      g.scene.stop('MenuScene');
      await wait(60);
      const battle: any = g.scene.getScene('BattleScene');
      streetPreenWindows.push(battle.shouldOfferUpgradeReward());
    }
    await window.__birdSquadStartScene!('BattleScene', { runState, routeNodeId: rival.id });
    await wait(60);
    const rivalBattle: any = g.scene.getScene('BattleScene');
    return {
      streetPreenWindows,
      hasRoutineNoPreen: streetPreenWindows.includes(false),
      rivalPreen: rivalBattle.shouldOfferUpgradeReward()
    };
  });
  expect(result.streetPreenWindows.length).toBeGreaterThan(0);
  expect(result.hasRoutineNoPreen).toBe(true);
  expect(result.rivalPreen).toBe(true);
});

test('nest remove opens a card picker and removes the chosen card', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const nest = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'nest');
    scene.openNodeChoices(nest);
    const deckBefore = scene.runState.deck.length;
    scene.chooseNodeOption('release');
    scene.claimRouteReward();
    const pickerMode = scene.cardPickerMode;
    const firstIndex = scene.pickerEligibleCards('release')[0].index;
    scene.applyCardPick(firstIndex);
    return { pickerMode, deckBefore, deckAfter: scene.runState.deck.length };
  });
  expect(result.pickerMode).toBe('release');
  expect(result.deckAfter).toBe(result.deckBefore - 1);
});

test('nest boss ready up allows two chosen preens before completing', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const nest = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'nest');
    scene.runState.scrap = 999;
    scene.runState.currentHp = 38;
    scene.runState.deck = [
      { id: 'major_00' },
      { id: 'wands_ace' },
      { id: 'cups_ace' },
      { id: 'swords_ace' }
    ];
    scene.openNodeChoices(nest);
    scene.chooseNodeOption('boss_ready_tune');
    const pendingKey = scene.pendingRouteReward?.choiceKey;
    scene.claimRouteReward();
    const titleBeforePick = scene.children.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text)
      .find((text: string) => text.includes('Preen'));
    const firstIndex = scene.pickerEligibleCards('preen')[0].index;
    scene.applyCardPick(firstIndex);
    const afterFirst = {
      remaining: scene.cardPickerRemainingPicks,
      pickerMode: scene.cardPickerMode,
      upgraded: scene.runState.deck.filter((card: any) => card.upgraded).length,
      completed: scene.runState.completedRouteNodeIds.includes(nest.id)
    };
    const secondIndex = scene.pickerEligibleCards('preen')[0].index;
    scene.applyCardPick(secondIndex);
    return {
      pendingKey,
      titleBeforePick,
      afterFirst,
      afterSecond: {
        pickerMode: scene.cardPickerMode,
        upgraded: scene.runState.deck.filter((card: any) => card.upgraded).length,
        completed: scene.runState.completedRouteNodeIds.includes(nest.id),
        nextCombat: scene.runState.nextCombat,
        scrap: scene.runState.scrap,
        currentHp: scene.runState.currentHp
      }
    };
  });

  expect(result.pendingKey).toBe('boss_ready_tune');
  expect(result.titleBeforePick).toBe('Preen 2 Cards');
  expect(result.afterFirst).toMatchObject({
    remaining: 1,
    pickerMode: 'preen',
    upgraded: 1,
    completed: false
  });
  expect(result.afterSecond.pickerMode).toBeUndefined();
  expect(result.afterSecond.upgraded).toBe(2);
  expect(result.afterSecond.completed).toBe(true);
  expect(result.afterSecond.nextCombat).toMatchObject({ bossDamageShield: 18, openSkyGuard: 2 });
  expect(result.afterSecond.scrap).toBe(869);
  expect(result.afterSecond.currentHp).toBe(35);
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

test('combat rewards deliberately mix deck need, suit synergy, and wildcard slots', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const anchor = battle.allDeckCards().find((card: any) => card.runtime.suit);
    if (!anchor) throw new Error('Expected a suited starter card');
    battle.drawPile = Array.from({ length: 4 }, (_value, index) => ({
      ...anchor,
      instanceId: `dominant-${index}`,
      runtime: { ...anchor.runtime }
    }));
    battle.discardPile = [];
    battle.hand = [];
    const waymarkBySuit: Record<string, string> = {
      plumes: 'stage_pin', basins: 'feather_tape', quills: 'quill_notch', nests: 'workshop_stamp'
    };
    battle.routeMarks = [waymarkBySuit[anchor.runtime.suit]];
    const choices = battle.createRewardChoices();
    return {
      dominantSuit: anchor.runtime.suit,
      choiceSuits: choices.map((card: any) => card.runtime.suit),
      firstNeedTags: battle.cardNeedTags(choices[0]),
      synergyTags: battle.cardNeedTags(choices[1]),
      allTagCounts: choices.map((card: any) => battle.cardNeedTags(card).length),
      ids: choices.map((card: any) => card.id)
    };
  });

  expect(result.ids).toHaveLength(3);
  expect(new Set(result.ids).size).toBe(3);
  expect(result.firstNeedTags.some((tag: string) => tag.includes('First ') || tag.includes('Fills ') || tag.includes('KEYSTONE'))).toBe(true);
  expect(result.choiceSuits[1]).toBe(result.dominantSuit);
  expect(result.synergyTags.some((tag: string) => tag.includes('Feeds '))).toBe(true);
  expect(result.synergyTags.some((tag: string) => tag.includes('KEYSTONE'))).toBe(true);
  expect(result.allTagCounts.every((count: number) => count > 0 && count <= 2)).toBe(true);
});

test('a newly-added arcana card constructs from the library and resolves its effect', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    // Seed a deck of a brand-new Major (major_07 "Dive Line" = damage 6) to prove
    // the expanded card pool both instantiates and runs through the interpreter.
    const deck = Array.from({ length: 10 }, () => ({ id: 'major_07' }));
    await window.__birdSquadStartScene!('BattleScene', {
      runState: {
        deck, currentHp: 40, scrap: 0, routeMarks: [], supplies: [], mapIndex: 0,
        completedRouteNodeIds: [], currentRouteNodeId: undefined, routeLog: [],
        nextCombat: undefined, signalChoices: [], rewardEvents: []
      },
      routeNodeId: 'm1_entry'
    });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const card = scene.hand[0] ?? scene.drawPile[0];
    const enemyId = scene.enemies[0].id;
    const before = scene.enemies[0].hp;
    scene.resolveCardEffects(card, enemyId);
    return { cardId: card?.id, displayName: card?.runtime?.displayName, delta: before - scene.enemies[0].hp };
  });
  expect(result.cardId).toBe('major_07');
  expect(result.displayName).toBe('Dive Line');
  expect(result.delta).toBeGreaterThanOrEqual(6);
});

test('enemy combat effects: snag insertion lands and Flock-state conditions gate correctly', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];
    // (1) addSnagToDiscard now inserts the named snag card into the discard pile.
    const before = scene.discardPile.length;
    scene.resolveEnemyEffect(enemy, 'addSnagToDiscard(tangled_line)');
    const added = scene.discardPile[scene.discardPile.length - 1];
    // (2) flockCohesionBelowHalf (previously unimplemented) now evaluates: false at
    // full cohesion, true below half.
    scene.flock.hp = scene.flock.maxHp; scene.flock.exposed = false;
    scene.resolveEnemyEffect(enemy, 'if flockCohesionBelowHalf then applyOpenSky(1)');
    const firedAtFull = scene.flock.exposed;
    scene.flock.hp = 1; scene.flock.exposed = false;
    scene.resolveEnemyEffect(enemy, 'if flockCohesionBelowHalf then applyOpenSky(1)');
    const firedAtLow = scene.flock.exposed;
    return {
      snagDelta: scene.discardPile.length - before,
      addedSnagKind: added?.runtime?.kind,
      firedAtFull, firedAtLow
    };
  });
  expect(r.snagDelta).toBe(1);
  expect(r.addedSnagKind).toBe('snag');
  expect(r.firedAtFull).toBe(false);
  expect(r.firedAtLow).toBe(true);
});

test('snag cards punish being held at Roost instead of acting as inert dead cards', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];
    const makeSnag = (id: string) => {
      scene.resolveEnemyEffect(enemy, `addSnagToDiscard(${id})`);
      return scene.discardPile.pop();
    };
    const fillerCard = { ...scene.hand[0], instanceId: 'held-snag-filler' };

    scene.hand = [makeSnag('tangled_line')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.energy = 3;
    scene.resolveHeldSnagEffects();
    const tangledHeld = {
      hand: scene.hand.length,
      draw: scene.drawPile.map((card: any) => card.id),
      energy: scene.energy,
    };

    scene.hand = [makeSnag('wet_feathers')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.flock.weak = 0;
    scene.resolveHeldSnagEffects();
    const wetHeld = {
      hand: scene.hand.map((card: any) => card.id),
      weak: scene.flock.weak,
    };

    scene.hand = [makeSnag('bad_directions')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.spark = 1;
    scene.resolveHeldSnagEffects();
    const badHeld = {
      hand: scene.hand.length,
      draw: scene.drawPile.map((card: any) => card.id),
      spark: scene.spark,
    };

    scene.hand = [makeSnag('loose_shingle')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.flock.hp = 10;
    scene.flock.block = 0;
    scene.resolveHeldSnagEffects();
    const looseHeld = {
      hand: scene.hand.map((card: any) => card.id),
      hp: scene.flock.hp,
    };

    scene.hand = [makeSnag('static_burst')];
    scene.drawPile = [];
    scene.discardPile = [];
    enemy.nextAttackBonus = 0;
    scene.resolveHeldSnagEffects();
    const staticHeld = {
      hand: scene.hand.map((card: any) => card.id),
      nextAttackBonus: enemy.nextAttackBonus,
    };

    scene.hand = [makeSnag('bent_feather')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.flock.weak = 0;
    scene.resolveHeldSnagEffects();
    const bentHeld = {
      hand: scene.hand.map((card: any) => card.id),
      weak: scene.flock.weak,
    };

    scene.hand = [makeSnag('glass_gap')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.flock.exposed = false;
    scene.flock.exposedTurns = 0;
    enemy.nextAttackBonus = 0;
    scene.resolveHeldSnagEffects();
    const glassHeld = {
      hand: scene.hand.map((card: any) => card.id),
      exposed: scene.flock.exposed,
      exposedTurns: scene.flock.exposedTurns,
      nextAttackBonus: enemy.nextAttackBonus,
    };

    scene.hand = [makeSnag('jammed_strap'), { ...fillerCard, instanceId: 'held-snag-filler-jammed' }];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.resolveHeldSnagEffects();
    const jammedHeld = {
      hand: scene.hand.map((card: any) => card.id),
      draw: scene.drawPile.map((card: any) => card.id),
      discardCount: scene.discardPile.length,
    };

    scene.hand = [makeSnag('barricade_scrap')];
    scene.drawPile = [];
    scene.discardPile = [];
    enemy.block = 0;
    scene.resolveHeldSnagEffects();
    const barricadeHeld = {
      hand: scene.hand.map((card: any) => card.id),
      enemyCover: enemy.block,
    };

    scene.hand = [makeSnag('smeared_map')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.nextTurnDrawBonus = 0;
    scene.resolveHeldSnagEffects();
    const smearedHeld = {
      hand: scene.hand.map((card: any) => card.id),
      draw: scene.drawPile.map((card: any) => card.id),
      nextDraw: scene.nextTurnDrawBonus,
    };

    return { tangledHeld, wetHeld, badHeld, looseHeld, staticHeld, bentHeld, glassHeld, jammedHeld, barricadeHeld, smearedHeld };
  });

  expect(r.tangledHeld).toEqual({ hand: 0, draw: ['tangled_line'], energy: 2 });
  expect(r.wetHeld).toEqual({ hand: ['wet_feathers'], weak: 1 });
  expect(r.badHeld).toEqual({ hand: 0, draw: ['bad_directions'], spark: 0 });
  expect(r.looseHeld).toEqual({ hand: ['loose_shingle'], hp: 8 });
  expect(r.staticHeld).toEqual({ hand: ['static_burst'], nextAttackBonus: 1 });
  expect(r.bentHeld).toEqual({ hand: ['bent_feather'], weak: 1 });
  expect(r.glassHeld).toEqual({ hand: ['glass_gap'], exposed: true, exposedTurns: 1, nextAttackBonus: 1 });
  expect(r.jammedHeld).toEqual({ hand: [], draw: ['jammed_strap'], discardCount: 1 });
  expect(r.barricadeHeld).toEqual({ hand: ['barricade_scrap'], enemyCover: 6 });
  expect(r.smearedHeld).toEqual({ hand: [], draw: ['smeared_map'], nextDraw: -1 });
});

test('new snag cards have playable cleanup tradeoffs', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];
    const makeSnag = (id: string) => {
      scene.resolveEnemyEffect(enemy, `addSnagToDiscard(${id})`);
      return scene.discardPile.pop();
    };
    const fillerCard = { ...scene.hand[0], instanceId: 'played-snag-filler' };

    scene.hand = [makeSnag('loose_shingle')];
    scene.flock.block = 5;
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const loosePlayed = {
      block: scene.flock.block,
      discard: scene.discardPile.map((card: any) => card.id),
    };

    scene.hand = [makeSnag('static_burst')];
    scene.discardPile = [];
    scene.spark = 1;
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const staticWithResonance = {
      spark: scene.spark,
      energy: scene.energy,
      discard: scene.discardPile.map((card: any) => card.id),
    };

    scene.hand = [makeSnag('static_burst')];
    scene.discardPile = [];
    scene.spark = 0;
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const staticNoResonance = {
      spark: scene.spark,
      energy: scene.energy,
      discard: scene.discardPile.map((card: any) => card.id),
    };

    scene.hand = [makeSnag('bent_feather')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.flock.weak = 0;
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const bentPlayed = {
      weak: scene.flock.weak,
      hand: scene.hand.map((card: any) => card.id),
      discard: scene.discardPile.map((card: any) => card.id),
      draw: scene.drawPile.map((card: any) => card.id),
    };

    scene.hand = [makeSnag('glass_gap')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.flock.exposed = false;
    scene.flock.exposedTurns = 0;
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const glassPlayed = {
      exposed: scene.flock.exposed,
      exposedTurns: scene.flock.exposedTurns,
      discard: scene.discardPile.map((card: any) => card.id),
    };

    scene.hand = [makeSnag('jammed_strap'), { ...fillerCard, instanceId: 'played-snag-filler-jammed' }];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const jammedPlayed = {
      hand: scene.hand.map((card: any) => card.id),
      discard: scene.discardPile.map((card: any) => card.id),
    };

    scene.hand = [makeSnag('barricade_scrap')];
    scene.drawPile = [];
    scene.discardPile = [];
    enemy.block = 0;
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const barricadePlayed = {
      enemyCover: enemy.block,
      discard: scene.discardPile.map((card: any) => card.id),
    };

    scene.hand = [makeSnag('smeared_map')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.nextTurnDrawBonus = 0;
    scene.energy = 3;
    scene.playCard(scene.hand[0]);
    const smearedPlayed = {
      nextDraw: scene.nextTurnDrawBonus,
      discard: scene.discardPile.map((card: any) => card.id),
    };

    return { loosePlayed, staticWithResonance, staticNoResonance, bentPlayed, glassPlayed, jammedPlayed, barricadePlayed, smearedPlayed };
  });

  expect(r.loosePlayed).toEqual({ block: 3, discard: ['loose_shingle'] });
  expect(r.staticWithResonance).toEqual({ spark: 0, energy: 3, discard: ['static_burst'] });
  expect(r.staticNoResonance).toEqual({ spark: 0, energy: 2, discard: ['static_burst'] });
  expect(r.bentPlayed).toEqual({ weak: 1, hand: [], discard: [], draw: [] });
  expect(r.glassPlayed).toEqual({ exposed: true, exposedTurns: 1, discard: ['glass_gap'] });
  expect(r.jammedPlayed.discard).toContain('jammed_strap');
  expect(r.jammedPlayed.discard.length).toBe(2);
  expect(r.jammedPlayed.hand).toEqual([]);
  expect(r.barricadePlayed).toEqual({ enemyCover: 3, discard: ['barricade_scrap'] });
  expect(r.smearedPlayed).toEqual({ nextDraw: -1, discard: ['smeared_map'] });
});

test('enemy post-Roost punishers react to card spam and empty hands', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];

    scene.roostCards = 3;
    scene.roostFree = 1;
    scene.roostHeld = 1;
    scene.flock.frail = 0;
    scene.energy = 3;
    scene.resolveEnemyEffect(enemy, 'if playedCardsAtLeast(4) then applyFrail(1)');
    scene.resolveEnemyEffect(enemy, 'if zeroCostCardsAtLeast(2) then loseWingbeat(1)');
    scene.resolveEnemyEffect(enemy, 'if handEmptyAtRoost then applyWinded(flock, 1)');
    const restrained = { frail: scene.flock.frail, energy: scene.energy, weak: scene.flock.weak };

    scene.roostCards = 4;
    scene.roostFree = 2;
    scene.roostHeld = 0;
    scene.flock.frail = 0;
    scene.flock.weak = 0;
    scene.energy = 3;
    scene.resolveEnemyEffect(enemy, 'if playedCardsAtLeast(4) then applyFrail(1)');
    scene.resolveEnemyEffect(enemy, 'if zeroCostCardsAtLeast(2) then loseWingbeat(1)');
    scene.resolveEnemyEffect(enemy, 'if handEmptyAtRoost then applyWinded(flock, 1)');
    const spammed = { frail: scene.flock.frail, energy: scene.energy, weak: scene.flock.weak };

    return { restrained, spammed };
  });

  expect(r.restrained).toEqual({ frail: 0, energy: 3, weak: 0 });
  expect(r.spammed).toEqual({ frail: 1, energy: 2, weak: 1 });
});

test('free draw effects require setup instead of refunding every zero-cost play', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const base = scene.hand[0];
    const rush = {
      ...base,
      id: 'wands_08',
      instanceId: 'test-plume-rush',
      target: 'none',
      runtime: {
        ...base.runtime,
        id: 'wands_08',
        target: 'none',
        effects: ['if isMolting then draw(1)', 'if isMolting then gainWingbeat(1)'],
        upgrade: { ...base.runtime.upgrade, effects: ['draw(1)', 'if isMolting then draw(1)', 'if isMolting then gainWingbeat(1)'] },
      },
    };
    const filler = { ...base, id: 'major_00', instanceId: 'test-filler' };

    scene.drawPile = [filler];
    scene.hand = [rush];
    scene.flock.molt = false;
    scene.energy = 9;
    scene.resolveCardEffects(rush, '');
    const normal = { hand: scene.hand.length, draw: scene.drawPile.length, energy: scene.energy };

    scene.drawPile = [filler];
    scene.hand = [rush];
    scene.flock.molt = true;
    scene.energy = 9;
    scene.resolveCardEffects(rush, '');
    const molting = { hand: scene.hand.length, draw: scene.drawPile.length, energy: scene.energy };

    return { normal, molting };
  });

  expect(r.normal).toEqual({ hand: 1, draw: 1, energy: 9 });
  expect(r.molting).toEqual({ hand: 2, draw: 0, energy: 10 });
});

test('route ESC asks to confirm before abandoning a run (does not leave immediately)', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const countTexture = (items: any[], key: string): number => items.reduce((sum, child) => {
      const self = child.texture?.key === key ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, key) : 0;
      return sum + self + nested;
    }, 0);
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.confirmExitFrame?.loaded && state.confirmExitCommandFrame?.loaded) break;
      await wait(50);
    }
    route.input.keyboard.emit('keydown-ESC'); // first ESC: open the confirm
    for (let i = 0; i < 20; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.confirmExitFrame?.rendered && state.confirmExitCommandFrame?.rendered) break;
      await wait(25);
    }
    const afterState = JSON.parse(window.render_game_to_text!());
    const frameObjects = countTexture(route.children.list, 'ui-icon-confirm-exit-frame');
    const commandFrameObjects = countTexture(route.children.list, 'ui-icon-confirm-exit-command-frame');
    const afterFirst = {
      confirm: route.confirmExitOpen,
      active: g.scene.getScenes(true).map((s: any) => s.scene.key),
      confirmExitFrame: afterState.confirmExitFrame,
      confirmExitCommandFrame: afterState.confirmExitCommandFrame,
      frameObjects,
      commandFrameObjects
    };
    route.input.keyboard.emit('keydown-ESC'); // second ESC: dismiss (keep playing)
    return { afterFirst, confirmAfterSecond: route.confirmExitOpen };
  });
  expect(result.afterFirst.confirm).toBe(true);
  expect(result.afterFirst.active).toContain('RouteScene'); // still in the run, not kicked to menu
  expect(result.afterFirst.confirmExitFrame).toEqual({ loaded: true, rendered: true, count: result.afterFirst.frameObjects });
  expect(result.afterFirst.frameObjects).toBeGreaterThanOrEqual(1);
  expect(result.afterFirst.confirmExitCommandFrame).toEqual({ loaded: true, rendered: true, count: result.afterFirst.commandFrameObjects });
  expect(result.afterFirst.commandFrameObjects).toBe(2);
  expect(result.confirmAfterSecond).toBe(false);
});

test('pause overlay opens on route and combat without advancing play', async ({ page }) => {
  test.setTimeout(60000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const countTexture = (items: any[], key: string): number => items.reduce((sum, child) => {
      const self = child.texture?.key === key ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, key) : 0;
      return sum + self + nested;
    }, 0);

    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    const pauseFrameKeys = [
      'ui-icon-system-menu-command-frame',
      'ui-icon-system-field-command-frame',
      'ui-icon-system-overlay-title-plaque',
      'ui-icon-system-pause-detail-row-frame',
    ];
    for (let i = 0; i < 60 && !pauseFrameKeys.every((key) => route.textures.exists(key)); i += 1) {
      await wait(50);
    }
    route.renderAll();
    const beforeRouteNode = route.runState.currentRouteNodeId ?? '';
    route.input.keyboard.emit('keydown-P');
    let routePausedText = JSON.parse(window.render_game_to_text!());
    for (let i = 0; i < 40 && !routePausedText.systemPauseDetailRowFrame?.rendered; i += 1) {
      await wait(50);
      routePausedText = JSON.parse(window.render_game_to_text!());
    }
    const routeCommandFrame = countTexture(route.root?.list ?? route.children.list, 'ui-icon-system-menu-command-frame');
    const routeFieldCommandFrame = countTexture(route.root?.list ?? route.children.list, 'ui-icon-system-field-command-frame');
    const routeTitlePlaque = countTexture(route.root?.list ?? route.children.list, 'ui-icon-system-overlay-title-plaque');
    const routePauseDetailFrame = countTexture(route.root?.list ?? route.children.list, 'ui-icon-system-pause-detail-row-frame');
    route.input.keyboard.emit('keydown-ENTER');
    await wait(60);
    const afterRouteEnter = route.runState.currentRouteNodeId ?? '';
    route.input.keyboard.emit('keydown-ESC');
    await wait(60);
    const routeClosed = JSON.parse(window.render_game_to_text!());
    route.routeCommitPending = true;
    route.input.keyboard.emit('keydown-P');
    await wait(60);
    const routePauseBlockedDuringCommit = route.pauseOverlayOpen === false;
    route.routeCommitPending = false;

    await window.__birdSquadStartScene!('BattleScene', { runState: route.runState, routeNodeId: 'm1_entry' });
    const battle: any = g.scene.getScene('BattleScene');
    const beforeTurn = battle.turn;
    battle.input.keyboard.emit('keydown-P');
    let battlePausedText = JSON.parse(window.render_game_to_text!());
    for (let i = 0; i < 40 && !battlePausedText.systemPauseDetailRowFrame?.rendered; i += 1) {
      await wait(50);
      battlePausedText = JSON.parse(window.render_game_to_text!());
    }
    const battleObjects = [
      ...(battle.root?.list ?? []),
      ...(battle.systemOverlayLayer?.list ?? []),
    ];
    const battleCommandFrame = countTexture(battleObjects, 'ui-icon-system-menu-command-frame');
    const battleFieldCommandFrame = countTexture(battleObjects, 'ui-icon-system-field-command-frame');
    const battleTitlePlaque = countTexture(battleObjects, 'ui-icon-system-overlay-title-plaque');
    const battlePauseDetailFrame = countTexture(battleObjects, 'ui-icon-system-pause-detail-row-frame');
    const battlePauseDepths = {
      root: battle.root?.depth ?? 0,
      fx: battle.fxLayer?.depth ?? 0,
      overlay: battle.systemOverlayLayer?.depth ?? 0,
    };
    battle.input.keyboard.emit('keydown-ENTER');
    await wait(60);
    const afterBattleEnter = battle.turn;
    battle.input.keyboard.emit('keydown-ESC');
    await wait(60);
    const battleClosedText = JSON.parse(window.render_game_to_text!());
    const battleClosedDepths = { root: battle.root?.depth ?? 0, fx: battle.fxLayer?.depth ?? 0 };

    const enemy = battle.enemies.find((candidate: any) => candidate.hp > 0);
    const attackMove = enemy?.runtime.moves.find((move: any) =>
      move.effects.some((effect: string) => effect.includes('damage'))
    );
    if (!enemy || !attackMove) throw new Error('Expected a damaging enemy move for pause sequencing');
    enemy.runtime.moves = [attackMove];
    enemy.runtime.attackPattern = { type: 'cycle', moveIds: [attackMove.id] };
    enemy.intentIndex = 0;
    enemy.weak = 0;
    enemy.nextAttackBonus = 0;
    enemy.damageBonus = 0;
    battle.hand = [];
    battle.flock.hp = battle.flock.maxHp;
    battle.flock.block = 0;
    battle.runSupplies = ['seed_packet'];
    battle.endTurnAnimated();
    for (let i = 0; i < 50 && window.__birdSquadState!().combatEnemyTurnBeat !== 'windup'; i += 1) {
      await wait(80);
    }
    const windupBeforeSupply = window.__birdSquadState!();
    battle.useSupply(0);
    const lockedSupply = {
      hp: battle.flock.hp,
      supplies: [...battle.runSupplies],
    };
    battle.input.keyboard.emit('keydown-P');
    await wait(100);
    const pausedBeforeImpact = window.__birdSquadState!();
    await wait(6500);
    const pausedAfterImpactWindow = window.__birdSquadState!();
    battle.input.keyboard.emit('keydown-P');

    let handoffState = window.__birdSquadState!();
    for (let i = 0; i < 160; i += 1) {
      handoffState = window.__birdSquadState!();
      if (handoffState.turn > beforeTurn || !handoffState.combatAnimationPending) break;
      await wait(100);
    }
    let resumedState = handoffState;
    for (let i = 0; i < 30 && resumedState.combatAnimationPending; i += 1) {
      await wait(100);
      resumedState = window.__birdSquadState!();
    }

    return {
      routePaused: routePausedText.pauseOverlayOpen,
      commandFrameLoaded: g.textures.exists('ui-icon-system-menu-command-frame'),
      fieldCommandFrameLoaded: g.textures.exists('ui-icon-system-field-command-frame'),
      titlePlaqueLoaded: g.textures.exists('ui-icon-system-overlay-title-plaque'),
      pauseDetailFrameLoaded: g.textures.exists('ui-icon-system-pause-detail-row-frame'),
      routeCommandFrame,
      routeFieldCommandFrame,
      routeTitlePlaque,
      routePauseDetailFrame,
      routeFieldCommandFrameTelemetry: routePausedText.systemFieldCommandFrame,
      routeTitlePlaqueTelemetry: routePausedText.systemOverlayTitlePlaque,
      routePauseDetailTelemetry: routePausedText.systemPauseDetailRowFrame,
      routeDidNotCommit: beforeRouteNode === afterRouteEnter,
      routeClosed: routeClosed.pauseOverlayOpen,
      routePauseBlockedDuringCommit,
      battlePaused: battlePausedText.paused,
      battleCommandFrame,
      battleFieldCommandFrame,
      battleTitlePlaque,
      battlePauseDetailFrame,
      battleFieldCommandFrameTelemetry: battlePausedText.systemFieldCommandFrame,
      battleTitlePlaqueTelemetry: battlePausedText.systemOverlayTitlePlaque,
      battlePauseDetailTelemetry: battlePausedText.systemPauseDetailRowFrame,
      battlePauseDepths,
      battleDidNotEndTurn: beforeTurn === afterBattleEnter,
      battleClosed: battleClosedText.paused,
      battleClosedDepths,
      windupBeforeSupply,
      lockedSupply,
      pausedBeforeImpact,
      pausedAfterImpactWindow,
      handoffState,
      resumedState,
    };
  });

  expect(result.routePaused).toBe(true);
  expect(result.commandFrameLoaded).toBe(true);
  expect(result.fieldCommandFrameLoaded).toBe(true);
  expect(result.titlePlaqueLoaded).toBe(true);
  expect(result.pauseDetailFrameLoaded).toBe(true);
  expect(result.routeCommandFrame).toBeGreaterThanOrEqual(2);
  expect(result.routeFieldCommandFrame).toBeGreaterThanOrEqual(3);
  expect(result.routeFieldCommandFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeFieldCommandFrame });
  expect(result.routeTitlePlaque).toBe(1);
  expect(result.routeTitlePlaqueTelemetry).toEqual({ loaded: true, rendered: true, count: 1 });
  expect(result.routePauseDetailFrame).toBeGreaterThanOrEqual(4);
  expect(result.routePauseDetailTelemetry.loaded).toBe(true);
  expect(result.routePauseDetailTelemetry.count).toBeGreaterThanOrEqual(4);
  expect(result.routeDidNotCommit).toBe(true);
  expect(result.routeClosed).toBe(false);
  expect(result.routePauseBlockedDuringCommit).toBe(true);
  expect(result.battlePaused).toBe(true);
  expect(result.battleCommandFrame).toBeGreaterThanOrEqual(2);
  expect(result.battleFieldCommandFrame).toBeGreaterThanOrEqual(3);
  expect(result.battleFieldCommandFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleFieldCommandFrame });
  expect(result.battleTitlePlaque).toBe(1);
  expect(result.battleTitlePlaqueTelemetry).toEqual({ loaded: true, rendered: true, count: 1 });
  expect(result.battlePauseDetailFrame).toBeGreaterThanOrEqual(4);
  expect(result.battlePauseDetailTelemetry.loaded).toBe(true);
  expect(result.battlePauseDetailTelemetry.count).toBeGreaterThanOrEqual(4);
  expect(result.battlePauseDepths.root).toBeLessThan(result.battlePauseDepths.fx);
  expect(result.battlePauseDepths.overlay).toBeGreaterThan(result.battlePauseDepths.fx);
  expect(result.battleDidNotEndTurn).toBe(true);
  expect(result.battleClosed).toBe(false);
  expect(result.battleClosedDepths.root).toBeLessThan(result.battleClosedDepths.fx);
  expect(result.windupBeforeSupply.combatEnemyTurnBeat).toBe('windup');
  expect(result.windupBeforeSupply.combatAnimationPending).toBe(true);
  expect(result.lockedSupply.hp).toBe(result.windupBeforeSupply.flock.hp);
  expect(result.lockedSupply.supplies).toEqual(['seed_packet']);
  expect(result.pausedBeforeImpact.paused).toBe(true);
  expect(result.pausedAfterImpactWindow.paused).toBe(true);
  expect(result.pausedAfterImpactWindow.flock.hp).toBe(result.pausedBeforeImpact.flock.hp);
  expect(result.pausedAfterImpactWindow.turn).toBe(result.pausedBeforeImpact.turn);
  expect(result.pausedAfterImpactWindow.combatEnemyTurnBeat).toBe(result.pausedBeforeImpact.combatEnemyTurnBeat);
  expect(result.handoffState.turn).toBeGreaterThan(result.pausedBeforeImpact.turn);
  expect(result.handoffState.combatAnimationPending).toBe(true);
  expect(result.resumedState.combatAnimationPending).toBe(false);
  expect(result.resumedState.flock.hp).toBeLessThan(result.pausedBeforeImpact.flock.hp);
});

test('adaptive procedural music follows scene pressure and mute ownership', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);

  await page.keyboard.press('KeyM');
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(1050);
  const menu = await page.evaluate(() => window.__birdSquadAudio!());

  const route = await page.evaluate(async () => {
    await window.__birdSquadStartScene!('RouteScene', {});
    await new Promise((resolve) => setTimeout(resolve, 900));
    return window.__birdSquadAudio!();
  });

  const battle = await page.evaluate(async () => {
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    await new Promise((resolve) => setTimeout(resolve, 700));
    return window.__birdSquadAudio!();
  });

  const boss = await page.evaluate(async () => {
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    await new Promise((resolve) => setTimeout(resolve, 700));
    return window.__birdSquadAudio!();
  });

  const victory = await page.evaluate(async () => {
    const scene: any = window.__birdSquadGame!.scene.getScene('BattleScene');
    scene.enemies.forEach((enemy: any) => { enemy.hp = 0; });
    scene.checkOutcome();
    await new Promise((resolve) => setTimeout(resolve, 700));
    return window.__birdSquadAudio!();
  });

  const defeat = await page.evaluate(async () => {
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    scene.flock.hp = 0;
    scene.checkOutcome();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return window.__birdSquadAudio!();
  });

  await page.keyboard.press('KeyM');
  await page.waitForTimeout(100);
  const muted = await page.evaluate(() => window.__birdSquadAudio!());
  await page.waitForTimeout(950);
  const mutedStable = await page.evaluate(() => window.__birdSquadAudio!());
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(650);
  const resumed = await page.evaluate(() => window.__birdSquadAudio!());

  expect(menu.unlocked).toBe(true);
  expect(menu.music).toMatchObject({ pattern: 'canal-lights', active: true });
  expect(menu.music.pulses).toBeGreaterThanOrEqual(1);
  expect(route.mood).toBe('route');
  expect(route.music).toMatchObject({ pattern: 'rooftop-wayfinding', active: true });
  expect(route.music.pulses).toBeGreaterThan(menu.music.pulses);
  expect(battle.mood).toBe('battle');
  expect(battle.music).toMatchObject({ pattern: 'street-beat', active: true });
  expect(battle.music.pulses).toBeGreaterThan(route.music.pulses);
  expect(boss.mood).toBe('boss');
  expect(boss.music).toMatchObject({ pattern: 'high-pressure-flight', active: true });
  expect(boss.music.pulses).toBeGreaterThan(battle.music.pulses);
  expect(victory.mood).toBe('victory');
  expect(victory.music).toMatchObject({ pattern: 'roost-homecoming', active: true });
  expect(victory.music.pulses).toBeGreaterThan(boss.music.pulses);
  expect(defeat.mood).toBe('defeat');
  expect(defeat.music).toMatchObject({ pattern: 'scattered-feathers', active: true });
  expect(defeat.music.pulses).toBeGreaterThan(victory.music.pulses);
  expect(muted.muted).toBe(true);
  expect(muted.music.active).toBe(false);
  expect(mutedStable.muted).toBe(true);
  expect(mutedStable.music.active).toBe(false);
  expect(mutedStable.music.pulses).toBe(muted.music.pulses);
  expect(resumed.muted).toBe(false);
  expect(resumed.music).toMatchObject({ pattern: 'scattered-feathers', active: true });
  expect(resumed.music.pulses).toBeGreaterThan(muted.music.pulses);
});

test('settings overlay opens from menu and paused run surfaces', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const countTexture = (items: any[], key: string): number => items.reduce((sum, child) => {
      const self = child.texture?.key === key ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, key) : 0;
      return sum + self + nested;
    }, 0);
    const collect = (items: any[]): any[] => items.flatMap((child) => {
      const nested = Array.isArray(child.list) ? collect(child.list) : [];
      return [child, ...nested];
    });
    window.localStorage.removeItem('birdsquad.motionPreference');
    window.localStorage.removeItem('birdsquad.visualContrast');
    window.localStorage.removeItem('birdsquad.graphicsQuality');
    window.localStorage.removeItem('birdsquad.combatPace');
    const findSliderHit = (items: any[], control: 'music' | 'sfx'): any | undefined => collect(items)
      .find((child: any) => child.name === `system-settings-${control}-slider-hit`
        && (child.input?.enabled ?? false));
    const findMotionHit = (items: any[]): any | undefined => collect(items)
      .find((child: any) => child.name === 'system-settings-motion-switch-hit'
        && (child.input?.enabled ?? false));
    const findContrastHit = (items: any[]): any | undefined => collect(items)
      .find((child: any) => child.name === 'system-settings-contrast-toggle-hit'
        && (child.input?.enabled ?? false));
    const findGraphicsQualityHit = (items: any[]): any | undefined => collect(items)
      .find((child: any) => child.name === 'system-settings-graphics-quality-switch-hit'
        && (child.input?.enabled ?? false));
    const findCombatPaceHit = (items: any[]): any | undefined => collect(items)
      .find((child: any) => child.name === 'system-settings-combat-pace-switch-hit'
        && (child.input?.enabled ?? false));

    let menu: any = g.scene.getScene('MenuScene');
    menu.input.keyboard.emit('keydown-S');
    for (let i = 0; i < 60; i += 1) {
      const overlayItems = menu.settingsOverlay?.list ?? [];
      const ready = countTexture(overlayItems, 'ui-icon-overlay-panel-flourish') >= 1
        && countTexture(overlayItems, 'ui-icon-system-menu-command-frame') >= 2
        && findSliderHit(overlayItems, 'music')
        && findSliderHit(overlayItems, 'sfx');
      if (ready) break;
      await wait(50);
    }
    const menuState = JSON.parse(window.render_game_to_text!());
    const menuOpen = menuState.settingsOpen;
    const menuFlourish = countTexture(menu.children.list, 'ui-icon-overlay-panel-flourish');
    const menuCommandFrame = countTexture(menu.children.list, 'ui-icon-system-menu-command-frame');
    const menuFieldCommandFrame = countTexture(menu.children.list, 'ui-icon-system-field-command-frame');
    const menuTitlePlaque = countTexture(menu.children.list, 'ui-icon-system-overlay-title-plaque');
    const menuSettingsRowFrame = countTexture(menu.children.list, 'ui-icon-system-settings-row-frame');
    const menuSettingsToggleFrame = countTexture(menu.children.list, 'ui-icon-system-settings-toggle-frame');
    const menuSettingsVolumeSliderFrame = countTexture(menu.children.list, 'ui-icon-system-settings-volume-slider-frame');
    const menuSettingsMotionSwitchFrame = countTexture(menu.children.list, 'ui-icon-system-settings-motion-switch-frame');
    const menuSettingsFocusRings = collect(menu.children.list)
      .filter((child: any) => child.name === 'system-settings-focus-ring').length;
    const menuSettingsControlTargets = collect(menu.settingsOverlay?.list ?? [])
      .filter((child: any) => child.input?.enabled && [
        'system-settings-music-slider-hit',
        'system-settings-sfx-slider-hit',
        'system-settings-motion-switch-hit',
        'system-settings-graphics-quality-switch-hit',
        'system-settings-combat-pace-switch-hit'
      ].includes(child.name))
      .map((child: any) => ({ name: child.name, width: child.displayWidth, height: child.displayHeight }));
    const menuGraphicsInitial = menuState.graphics;
    const menuGraphicsHit = findGraphicsQualityHit(menu.children.list);
    if (!menuGraphicsHit) throw new Error('Missing menu Effects quality switch hit target');
    menuGraphicsHit.emit('pointerdown', { x: 804, y: 484, isDown: true });
    await wait(80);
    const menuGraphicsAfterFullState = JSON.parse(window.render_game_to_text!());
    const menuGraphicsAfterFull = menuGraphicsAfterFullState.graphics;
    const menuGraphicsHit2 = findGraphicsQualityHit(menu.children.list);
    if (!menuGraphicsHit2) throw new Error('Missing menu Effects quality switch after first toggle');
    menuGraphicsHit2.emit('pointerdown', { x: 804, y: 484, isDown: true });
    await wait(80);
    const menuGraphicsAfterLeanState = JSON.parse(window.render_game_to_text!());
    const menuGraphicsAfterLean = menuGraphicsAfterLeanState.graphics;
    const menuMotionInitial = menuState.motion;
    const menuMotionHit = findMotionHit(menu.children.list);
    if (!menuMotionHit) throw new Error('Missing menu Motion switch hit target');
    menuMotionHit.emit('pointerdown', { x: 804, y: 484, isDown: true });
    await wait(80);
    const menuMotionAfterFull = JSON.parse(window.render_game_to_text!()).motion;
    const menuMotionHit2 = findMotionHit(menu.children.list);
    if (!menuMotionHit2) throw new Error('Missing menu Motion switch after first toggle');
    menuMotionHit2.emit('pointerdown', { x: 804, y: 484, isDown: true });
    await wait(80);
    const menuMotionAfterReduced = JSON.parse(window.render_game_to_text!()).motion;
    const menuContrastInitial = menuState.visualContrast;
    const menuContrastHit = findContrastHit(menu.children.list);
    if (!menuContrastHit) throw new Error('Missing menu Contrast toggle hit target');
    const menuContrastTarget = { width: menuContrastHit.displayWidth, height: menuContrastHit.displayHeight };
    menuContrastHit.emit('pointerdown', { x: 846, y: 510, isDown: true });
    await wait(80);
    const menuContrastAfter = JSON.parse(window.render_game_to_text!()).visualContrast;
    const menuContrastClassApplied = document.getElementById('game-container')?.classList.contains('birdsquad-high-contrast');
    const menuPaceInitial = JSON.parse(window.render_game_to_text!()).combatPacing;
    const menuPaceHit = findCombatPaceHit(menu.children.list);
    if (!menuPaceHit) throw new Error('Missing menu Combat Pace switch hit target');
    menuPaceHit.emit('pointerdown', { x: 804, y: 504, isDown: true });
    await wait(80);
    const menuPaceAfterSnappy = JSON.parse(window.render_game_to_text!()).combatPacing;
    const menuMusicHit = findSliderHit(menu.children.list, 'music');
    if (!menuMusicHit) throw new Error('Missing menu Music slider hit target');
    menuMusicHit.emit('pointerdown', { x: 754, y: 328, isDown: true });
    await wait(80);
    const menuAudioAfterMusic = JSON.parse(window.render_game_to_text!()).audio;
    let menuSfxHit = findSliderHit(menu.children.list, 'sfx');
    for (let i = 0; i < 30 && !menuSfxHit; i += 1) {
      await wait(50);
      menuSfxHit = findSliderHit(menu.children.list, 'sfx');
    }
    if (!menuSfxHit) throw new Error('Missing menu SFX slider hit target');
    menuSfxHit.emit('pointerdown', { x: 824, y: 380, isDown: true });
    await wait(80);
    const menuAudioAfterSfx = JSON.parse(window.render_game_to_text!()).audio;
    menu.input.keyboard.emit('keydown-ESC');
    await wait(60);
    const menuClosed = JSON.parse(window.render_game_to_text!()).settingsOpen;

    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    route.input.keyboard.emit('keydown-P');
    await wait(60);
    route.openSettingsOverlay();
    await wait(60);
    const routeState = JSON.parse(window.render_game_to_text!());
    const routeSettings = routeState.settingsOverlayOpen;
    const routeFlourish = countTexture(route.root?.list ?? route.children.list, 'ui-icon-overlay-panel-flourish');
    const routeCommandFrame = countTexture(route.root?.list ?? route.children.list, 'ui-icon-system-menu-command-frame');
    const routeFieldCommandFrame = countTexture(route.root?.list ?? route.children.list, 'ui-icon-system-field-command-frame');
    const routeTitlePlaque = countTexture(route.root?.list ?? route.children.list, 'ui-icon-system-overlay-title-plaque');
    const routeSettingsRowFrame = countTexture(route.root?.list ?? route.children.list, 'ui-icon-system-settings-row-frame');
    const routeSettingsToggleFrame = countTexture(route.root?.list ?? route.children.list, 'ui-icon-system-settings-toggle-frame');
    const routeSettingsVolumeSliderFrame = countTexture(route.root?.list ?? route.children.list, 'ui-icon-system-settings-volume-slider-frame');
    const routeSettingsMotionSwitchFrame = countTexture(route.root?.list ?? route.children.list, 'ui-icon-system-settings-motion-switch-frame');
    const routeSettingsFocusRings = collect(route.children.list)
      .filter((child: any) => child.name === 'system-settings-focus-ring').length;
    route.input.keyboard.emit('keydown-ESC');
    await wait(60);
    const routeClosed = JSON.parse(window.render_game_to_text!()).settingsOverlayOpen;

    await window.__birdSquadStartScene!('BattleScene', { runState: route.runState, routeNodeId: 'm1_entry' });
    const battle: any = g.scene.getScene('BattleScene');
    battle.input.keyboard.emit('keydown-P');
    await wait(60);
    battle.openSettingsOverlay();
    await wait(60);
    const beforeTurn = battle.turn;
    const battleState = JSON.parse(window.render_game_to_text!());
    const battleSettings = battleState.settingsOverlayOpen;
    const battleSystemObjects = battle.systemOverlayLayer?.list ?? [];
    const battleFlourish = countTexture(battleSystemObjects, 'ui-icon-overlay-panel-flourish');
    const battleCommandFrame = countTexture(battleSystemObjects, 'ui-icon-system-menu-command-frame');
    const battleFieldCommandFrame = countTexture(battleSystemObjects, 'ui-icon-system-field-command-frame');
    const battleTitlePlaque = countTexture(battleSystemObjects, 'ui-icon-system-overlay-title-plaque');
    const battleSettingsRowFrame = countTexture(battleSystemObjects, 'ui-icon-system-settings-row-frame');
    const battleSettingsToggleFrame = countTexture(battleSystemObjects, 'ui-icon-system-settings-toggle-frame');
    const battleSettingsVolumeSliderFrame = countTexture(battleSystemObjects, 'ui-icon-system-settings-volume-slider-frame');
    const battleSettingsMotionSwitchFrame = countTexture(battleSystemObjects, 'ui-icon-system-settings-motion-switch-frame');
    const battleSettingsFocusRings = collect(battleSystemObjects)
      .filter((child: any) => child.name === 'system-settings-focus-ring').length;
    battle.input.keyboard.emit('keydown-ENTER');
    await wait(60);
    const afterTurn = battle.turn;
    battle.input.keyboard.emit('keydown-ESC');
    await wait(60);
    const battleClosed = JSON.parse(window.render_game_to_text!()).settingsOverlayOpen;

    return {
      menuOpen,
      menuClosed,
      flourishLoaded: g.textures.exists('ui-icon-overlay-panel-flourish'),
      commandFrameLoaded: g.textures.exists('ui-icon-system-menu-command-frame'),
      fieldCommandFrameLoaded: g.textures.exists('ui-icon-system-field-command-frame'),
      titlePlaqueLoaded: g.textures.exists('ui-icon-system-overlay-title-plaque'),
      settingsRowFrameLoaded: g.textures.exists('ui-icon-system-settings-row-frame'),
      settingsToggleFrameLoaded: g.textures.exists('ui-icon-system-settings-toggle-frame'),
      settingsVolumeSliderFrameLoaded: g.textures.exists('ui-icon-system-settings-volume-slider-frame'),
      settingsMotionSwitchFrameLoaded: g.textures.exists('ui-icon-system-settings-motion-switch-frame'),
      menuFlourish,
      menuCommandFrame,
      menuFieldCommandFrame,
      menuTitlePlaque,
      menuSettingsRowFrame,
      menuSettingsToggleFrame,
      menuSettingsVolumeSliderFrame,
      menuSettingsMotionSwitchFrame,
      menuSettingsFocusRings,
      menuSettingsFocus: menuState.settingsFocus,
      menuSettingsControlTargets,
      menuMotionInitial,
      menuMotionAfterFull,
      menuMotionAfterReduced,
      menuContrastInitial,
      menuContrastAfter,
      menuContrastTarget,
      menuContrastClassApplied,
      menuGraphicsInitial,
      menuGraphicsAfterFull,
      menuGraphicsAfterLean,
      menuGraphicsRuntimeAfterFull: menuGraphicsAfterFullState.graphicsRuntime,
      menuGraphicsRuntimeAfterLean: menuGraphicsAfterLeanState.graphicsRuntime,
      menuPaceInitial,
      menuPaceAfterSnappy,
      menuAudioAfterMusic,
      menuAudioAfterSfx,
      menuTitlePlaqueTelemetry: menuState.systemOverlayTitlePlaque,
      menuFieldCommandFrameTelemetry: menuState.systemFieldCommandFrame,
      menuSettingsRowTelemetry: menuState.systemSettingsRowFrame,
      menuSettingsToggleTelemetry: menuState.systemSettingsToggleFrame,
      menuSettingsVolumeSliderTelemetry: menuState.systemSettingsVolumeSliderFrame,
      menuSettingsMotionSwitchTelemetry: menuState.systemSettingsMotionSwitchFrame,
      routeSettings,
      routeFlourish,
      routeCommandFrame,
      routeFieldCommandFrame,
      routeTitlePlaque,
      routeSettingsRowFrame,
      routeSettingsToggleFrame,
      routeSettingsVolumeSliderFrame,
      routeSettingsMotionSwitchFrame,
      routeSettingsFocusRings,
      routeSettingsFocus: routeState.settingsFocus,
      routeTitlePlaqueTelemetry: routeState.systemOverlayTitlePlaque,
      routeFieldCommandFrameTelemetry: routeState.systemFieldCommandFrame,
      routeSettingsRowTelemetry: routeState.systemSettingsRowFrame,
      routeSettingsToggleTelemetry: routeState.systemSettingsToggleFrame,
      routeSettingsVolumeSliderTelemetry: routeState.systemSettingsVolumeSliderFrame,
      routeSettingsMotionSwitchTelemetry: routeState.systemSettingsMotionSwitchFrame,
      routeMotion: routeState.motion,
      routeVisualContrast: routeState.visualContrast,
      routeGraphics: routeState.graphics,
      routeCombatPacing: routeState.combatPacing,
      routeClosed,
      battleSettings,
      battleFlourish,
      battleCommandFrame,
      battleFieldCommandFrame,
      battleTitlePlaque,
      battleSettingsRowFrame,
      battleSettingsToggleFrame,
      battleSettingsVolumeSliderFrame,
      battleSettingsMotionSwitchFrame,
      battleSettingsFocusRings,
      battleSettingsFocus: battleState.settingsFocus,
      battleTitlePlaqueTelemetry: battleState.systemOverlayTitlePlaque,
      battleFieldCommandFrameTelemetry: battleState.systemFieldCommandFrame,
      battleSettingsRowTelemetry: battleState.systemSettingsRowFrame,
      battleSettingsToggleTelemetry: battleState.systemSettingsToggleFrame,
      battleSettingsVolumeSliderTelemetry: battleState.systemSettingsVolumeSliderFrame,
      battleSettingsMotionSwitchTelemetry: battleState.systemSettingsMotionSwitchFrame,
      battleMotion: battleState.motion,
      battleVisualContrast: battleState.visualContrast,
      battleGraphics: battleState.graphics,
      battleGraphicsRuntime: battleState.graphicsRuntime,
      battleCombatPacing: battleState.combatPacing,
      battleDidNotEndTurn: beforeTurn === afterTurn,
      battleClosed
    };
  });

  expect(result.menuOpen).toBe(true);
  expect(result.menuClosed).toBe(false);
  expect(result.flourishLoaded).toBe(true);
  expect(result.commandFrameLoaded).toBe(true);
  expect(result.fieldCommandFrameLoaded).toBe(true);
  expect(result.titlePlaqueLoaded).toBe(true);
  expect(result.settingsRowFrameLoaded).toBe(true);
  expect(result.settingsToggleFrameLoaded).toBe(true);
  expect(result.settingsVolumeSliderFrameLoaded).toBe(true);
  expect(result.settingsMotionSwitchFrameLoaded).toBe(true);
  expect(result.menuFlourish).toBeGreaterThanOrEqual(1);
  expect(result.menuCommandFrame).toBeGreaterThanOrEqual(2);
  expect(result.menuFieldCommandFrame).toBeGreaterThanOrEqual(2);
  expect(result.menuFieldCommandFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.menuFieldCommandFrame });
  expect(result.menuTitlePlaque).toBe(1);
  expect(result.menuTitlePlaqueTelemetry).toEqual({ loaded: true, rendered: true, count: 1 });
  expect(result.menuSettingsRowFrame).toBeGreaterThanOrEqual(8);
  expect(result.menuSettingsRowTelemetry.loaded).toBe(true);
  expect(result.menuSettingsRowTelemetry.count).toBeGreaterThanOrEqual(8);
  expect(result.menuSettingsToggleFrame).toBeGreaterThanOrEqual(3);
  expect(result.menuSettingsToggleTelemetry).toEqual({ loaded: true, rendered: true, count: result.menuSettingsToggleFrame });
  expect(result.menuSettingsVolumeSliderFrame).toBe(2);
  expect(result.menuSettingsVolumeSliderTelemetry).toEqual({ loaded: true, rendered: true, count: 2 });
  expect(result.menuSettingsMotionSwitchFrame).toBe(3);
  expect(result.menuSettingsMotionSwitchTelemetry).toEqual({ loaded: true, rendered: true, count: 3 });
  expect(result.menuSettingsFocusRings).toBe(1);
  expect(result.menuSettingsFocus).toEqual({ index: 0, label: 'Audio' });
  expect(result.menuSettingsControlTargets).toHaveLength(5);
  expect(result.menuSettingsControlTargets.every((target: { width: number; height: number }) => (
    target.width >= 276 && target.height === 56
  ))).toBe(true);
  expect(result.menuMotionInitial.preference).toBe('system');
  expect(result.menuMotionAfterFull.preference).toBe('full');
  expect(result.menuMotionAfterFull.reduced).toBe(false);
  expect(result.menuMotionAfterReduced.preference).toBe('reduced');
  expect(result.menuMotionAfterReduced.reduced).toBe(true);
  expect(result.menuContrastInitial).toMatchObject({ preference: 'standard', highContrast: false, applied: true });
  expect(result.menuContrastAfter).toMatchObject({ preference: 'high', highContrast: true, applied: true });
  expect(result.menuContrastTarget).toEqual({ width: 184, height: 44 });
  expect(result.menuContrastClassApplied).toBe(true);
  expect(result.menuGraphicsInitial.preference).toBe('auto');
  expect(result.menuGraphicsAfterFull).toMatchObject({ preference: 'full', effective: 'full', lean: false });
  expect(result.menuGraphicsAfterLean).toMatchObject({ preference: 'lean', effective: 'lean', lean: true });
  expect(result.menuGraphicsRuntimeAfterFull).toEqual({ ambientParticleEmitters: 1 });
  expect(result.menuGraphicsRuntimeAfterLean).toEqual({ ambientParticleEmitters: 0 });
  expect(result.menuPaceInitial.preference).toBe('standard');
  expect(result.menuPaceAfterSnappy.preference).toBe('snappy');
  expect(result.menuAudioAfterMusic.musicVolume).toBeCloseTo(0.25, 2);
  expect(result.menuAudioAfterSfx.musicVolume).toBeCloseTo(0.25, 2);
  expect(result.menuAudioAfterSfx.sfxVolume).toBeCloseTo(0.65, 2);
  expect(result.routeSettings).toBe(true);
  expect(result.routeFlourish).toBeGreaterThanOrEqual(1);
  expect(result.routeCommandFrame).toBeGreaterThanOrEqual(2);
  expect(result.routeFieldCommandFrame).toBeGreaterThanOrEqual(2);
  expect(result.routeFieldCommandFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeFieldCommandFrame });
  expect(result.routeTitlePlaque).toBeGreaterThanOrEqual(1);
  expect(result.routeTitlePlaqueTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeTitlePlaque });
  expect(result.routeSettingsRowFrame).toBeGreaterThanOrEqual(8);
  expect(result.routeSettingsRowTelemetry.loaded).toBe(true);
  expect(result.routeSettingsRowTelemetry.count).toBeGreaterThanOrEqual(8);
  expect(result.routeSettingsToggleFrame).toBeGreaterThanOrEqual(3);
  expect(result.routeSettingsToggleTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeSettingsToggleFrame });
  expect(result.routeSettingsVolumeSliderFrame).toBe(2);
  expect(result.routeSettingsVolumeSliderTelemetry).toEqual({ loaded: true, rendered: true, count: 2 });
  expect(result.routeSettingsMotionSwitchFrame).toBe(3);
  expect(result.routeSettingsMotionSwitchTelemetry).toEqual({ loaded: true, rendered: true, count: 3 });
  expect(result.routeSettingsFocusRings).toBe(1);
  expect(result.routeSettingsFocus).toEqual({ index: 0, label: 'Audio' });
  expect(result.routeMotion.preference).toBe('reduced');
  expect(result.routeMotion.reduced).toBe(true);
  expect(result.routeVisualContrast).toMatchObject({ preference: 'high', highContrast: true, applied: true });
  expect(result.routeGraphics).toMatchObject({ preference: 'lean', effective: 'lean', lean: true });
  expect(result.routeCombatPacing.preference).toBe('snappy');
  expect(result.routeClosed).toBe(false);
  expect(result.battleSettings).toBe(true);
  expect(result.battleFlourish).toBeGreaterThanOrEqual(1);
  expect(result.battleCommandFrame).toBeGreaterThanOrEqual(2);
  expect(result.battleFieldCommandFrame).toBeGreaterThanOrEqual(2);
  expect(result.battleFieldCommandFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleFieldCommandFrame });
  expect(result.battleTitlePlaque).toBeGreaterThanOrEqual(1);
  expect(result.battleTitlePlaqueTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleTitlePlaque });
  expect(result.battleSettingsRowFrame).toBeGreaterThanOrEqual(8);
  expect(result.battleSettingsRowTelemetry.loaded).toBe(true);
  expect(result.battleSettingsRowTelemetry.count).toBeGreaterThanOrEqual(8);
  expect(result.battleSettingsToggleFrame).toBeGreaterThanOrEqual(3);
  expect(result.battleSettingsToggleTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleSettingsToggleFrame });
  expect(result.battleSettingsVolumeSliderFrame).toBe(2);
  expect(result.battleSettingsVolumeSliderTelemetry).toEqual({ loaded: true, rendered: true, count: 2 });
  expect(result.battleSettingsMotionSwitchFrame).toBe(3);
  expect(result.battleSettingsMotionSwitchTelemetry).toEqual({ loaded: true, rendered: true, count: 3 });
  expect(result.battleSettingsFocusRings).toBe(1);
  expect(result.battleSettingsFocus).toEqual({ index: 0, label: 'Audio' });
  expect(result.battleMotion.preference).toBe('reduced');
  expect(result.battleMotion.reduced).toBe(true);
  expect(result.battleVisualContrast).toMatchObject({ preference: 'high', highContrast: true, applied: true });
  expect(result.battleGraphics).toMatchObject({ preference: 'lean', effective: 'lean', lean: true });
  expect(result.battleGraphicsRuntime).toMatchObject({ atmosphereStrips: 10, particleBurstCap: 2 });
  expect(result.battleCombatPacing.preference).toBe('snappy');
  expect(result.battleDidNotEndTurn).toBe(true);
  expect(result.battleClosed).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.graphicsQuality'))).toBe('lean');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.visualContrast'))).toBe('high');
});

test('high contrast applies before scene boot and persists across reloads', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.setItem('birdsquad.visualContrast', 'high'));
  await page.reload();
  await page.waitForFunction(() => {
    try {
      return JSON.parse(window.render_game_to_text?.() ?? '{}').scene === 'MenuScene';
    } catch {
      return false;
    }
  }, undefined, { timeout: 15_000 });

  const result = await page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const container = document.getElementById('game-container');
    const canvas = container?.querySelector('canvas');
    return {
      state: state.visualContrast,
      classApplied: container?.classList.contains('birdsquad-high-contrast'),
      filter: canvas ? getComputedStyle(canvas).filter : '',
    };
  });

  expect(result.state).toMatchObject({ preference: 'high', highContrast: true, applied: true });
  expect(result.classApplied).toBe(true);
  expect(result.filter).toContain('contrast(1.16)');
  expect(result.filter).toContain('brightness(1.08)');
});

test('opt-in screen reader announcements follow menu, route, combat, and settings focus', async ({ page }) => {
  await boot(page);
  const initial = await page.evaluate(() => {
    const region = document.getElementById('game-status');
    return {
      live: region?.getAttribute('aria-live'),
      hidden: region?.getAttribute('aria-hidden'),
      text: region?.textContent,
      state: JSON.parse(window.render_game_to_text?.() ?? '{}').screenReader,
    };
  });
  expect(initial).toMatchObject({ live: 'off', hidden: 'true', text: '', state: { preference: 'off', enabled: false, regionReady: true, observerActive: false } });

  await page.keyboard.press('s');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsOpen === true);
  await page.waitForFunction(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    const visit = (items: any[]): boolean => items.some((child: any) => (
      (child.name === 'system-settings-row-8-hit' && child.input?.enabled)
      || (Array.isArray(child.list) && visit(child.list))
    ));
    return visit(menu.children.list);
  });
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsFocus?.label === 'Screen Reader');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const region = document.getElementById('game-status');
    return state.screenReader?.enabled === true
      && localStorage.getItem('birdsquad.screenReader') === 'on'
      && region?.getAttribute('aria-live') === 'polite'
      && region?.getAttribute('aria-hidden') === 'false';
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsOpen === false);
  await page.waitForFunction(() => document.getElementById('game-status')?.textContent?.includes('Bird Squad menu'));
  const menuLabelBefore = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').titleFocus?.label);
  await page.evaluate(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    menu.input.keyboard.emit('keydown-RIGHT');
  });
  await page.waitForFunction((before) => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const spoken = document.getElementById('game-status')?.textContent ?? '';
    return state.titleFocus?.label !== before && spoken.includes(state.titleFocus.label);
  }, menuLabelBefore);

  await page.evaluate(async () => window.__birdSquadStartScene!('RouteScene', {}));
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const selected = state.nodes?.find((node: any) => node.id === state.selectedNodeId);
    const spoken = document.getElementById('game-status')?.textContent ?? '';
    return state.scene === 'RouteScene' && selected && spoken.includes(selected.label) && spoken.includes(state.map.name);
  });
  const routeState = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(routeState.selectedNodeId).toBeTruthy();
  expect(routeState.screenReader).toMatchObject({ preference: 'on', enabled: true, regionReady: true, observerActive: true });

  await page.evaluate(async () => window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' }));
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.scene === 'BattleScene' && state.mode === 'battle' && state.hand?.length > 0;
  });
  const selectedName = await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const candidate = state.hand.find((card: any) => card.activeTarget === 'enemy' && card.cost <= state.energy);
    if (!candidate) throw new Error('No payable enemy-target card for screen-reader selection probe');
    const rect = battle.handCardRects.get(candidate.instanceId);
    if (!rect) throw new Error('Missing live hand hit target for screen-reader selection probe');
    rect.emit('pointerdown', {}, 0, 0, { stopPropagation() {} });
    return candidate.name;
  });
  await page.waitForFunction((cardName) => document.getElementById('game-status')?.textContent?.includes(`Selected ${cardName}`), selectedName);
  const battleAnnouncement = await page.evaluate(() => document.getElementById('game-status')?.textContent ?? '');
  expect(battleAnnouncement).toContain('Wingbeats');
  expect(battleAnnouncement).toContain('Cohesion');

  await page.keyboard.press('s');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsOverlayOpen === true);
  await page.waitForFunction(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const visit = (items: any[]): boolean => items.some((child: any) => (
      (child.name === 'system-settings-row-8-hit' && child.input?.enabled)
      || (Array.isArray(child.list) && visit(child.list))
    ));
    return visit(battle.systemOverlayLayer?.list ?? []);
  });
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsFocus?.label === 'Screen Reader');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const region = document.getElementById('game-status');
    return state.screenReader?.enabled === false
      && localStorage.getItem('birdsquad.screenReader') === 'off'
      && region?.getAttribute('aria-live') === 'off'
      && region?.getAttribute('aria-hidden') === 'true'
      && region?.textContent === '';
  });
});

test('settings remain usable when browser preference storage is unavailable', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const storagePrototype: any = Object.getPrototypeOf(window.localStorage);
    const originalGetItem = storagePrototype.getItem;
    const originalSetItem = storagePrototype.setItem;
    let resultState: any;
    try {
      storagePrototype.getItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
      storagePrototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
      const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
      menu.input.keyboard.emit('keydown-S');
      for (let i = 0; i < 80; i += 1) {
        const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
        const motionHit = menu.children.list.flatMap((child: any) => child.list ?? [child])
          .find((child: any) => child.name === 'system-settings-motion-switch-hit');
        if (state.settingsOpen && motionHit) break;
        await wait(50);
      }
      const collect = (items: any[]): any[] => items.flatMap((child: any) => [child, ...(Array.isArray(child.list) ? collect(child.list) : [])]);
      const motionHit = collect(menu.children.list)
        .find((child: any) => child.name === 'system-settings-motion-switch-hit' && child.input?.enabled);
      if (!motionHit) throw new Error('Missing Motion control while storage is blocked');
      motionHit.emit('pointerdown', { x: 804, y: 484, isDown: true });
      await wait(80);
      const contrastHit = collect(menu.children.list)
        .find((child: any) => child.name === 'system-settings-contrast-toggle-hit' && child.input?.enabled);
      if (!contrastHit) throw new Error('Missing Contrast control while storage is blocked');
      contrastHit.emit('pointerdown', { x: 846, y: 510, isDown: true });
      await wait(80);
      let graphicsHit = collect(menu.children.list)
        .find((child: any) => child.name === 'system-settings-graphics-quality-switch-hit' && child.input?.enabled);
      if (!graphicsHit) throw new Error('Missing Effects quality control while storage is blocked');
      graphicsHit.emit('pointerdown', { x: 804, y: 484, isDown: true });
      await wait(80);
      graphicsHit = collect(menu.children.list)
        .find((child: any) => child.name === 'system-settings-graphics-quality-switch-hit' && child.input?.enabled);
      if (!graphicsHit) throw new Error('Missing Effects quality control after first blocked-storage change');
      graphicsHit.emit('pointerdown', { x: 804, y: 484, isDown: true });
      await wait(80);
      const controlsHit = collect(menu.children.list)
        .find((child: any) => child.name === 'system-settings-row-3-hit' && child.input?.enabled);
      if (!controlsHit) throw new Error('Missing Controls row while storage is blocked');
      controlsHit.emit('pointerdown', { x: 640, y: 436, isDown: true });
      await wait(80);
      const confirmHit = collect(menu.children.list)
        .find((child: any) => child.name === 'system-controls-binding-confirm-hit' && child.input?.enabled);
      if (!confirmHit) throw new Error('Missing Confirm binding while storage is blocked');
      confirmHit.emit('pointerdown', { x: 640, y: 238, isDown: true });
      menu.input.keyboard.emit('keydown', {
        code: 'KeyC',
        key: 'c',
        shiftKey: false,
        preventDefault: () => {},
        stopPropagation: () => {},
      });
      await wait(80);
      const doneHit = collect(menu.children.list)
        .find((child: any) => child.name === 'system-controls-done-hit' && child.input?.enabled);
      if (!doneHit) throw new Error('Missing Done control while storage is blocked');
      doneHit.emit('pointerdown', { x: 810, y: 612, isDown: true });
      menu.input.keyboard.emit('keydown', {
        code: 'Escape',
        key: 'Escape',
        shiftKey: false,
        preventDefault: () => {},
        stopPropagation: () => {},
      });
      await wait(80);
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      resultState = {
        settingsOpen: state.settingsOpen,
        motion: state.motion,
        visualContrast: state.visualContrast,
        contrastClassApplied: document.getElementById('game-container')?.classList.contains('birdsquad-high-contrast'),
        graphics: state.graphics,
        pace: state.combatPacing,
        controls: state.controls,
        motionControlActive: collect(menu.children.list)
          .some((child: any) => child.name === 'system-settings-motion-switch-hit' && child.input?.enabled),
      };
    } finally {
      storagePrototype.getItem = originalGetItem;
      storagePrototype.setItem = originalSetItem;
    }
    return resultState;
  });

  expect(result.settingsOpen).toBe(false);
  expect(result.motion).toMatchObject({ preference: 'system' });
  expect(result.visualContrast).toMatchObject({ preference: 'high', highContrast: true, applied: true });
  expect(result.contrastClassApplied).toBe(true);
  expect(result.graphics).toMatchObject({ preference: 'lean', effective: 'lean', lean: true });
  expect(result.pace).toEqual({ preference: 'standard' });
  expect(result.controls).toMatchObject({ customized: true });
  expect(result.controls.bindings.confirm.key).toBe('C');
  expect(result.motionControlActive).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.controlBindings'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.graphicsQuality'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.visualContrast'))).toBeNull();
  await page.keyboard.press('c');
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').scene
  )), { timeout: 20_000 }).toBe('RouteScene');
});

test('title boot paints generated controls once and defers overlay artwork until requested', async ({ page }) => {
  await boot(page);
  const titleBoot = () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').titleBoot);
  await page.waitForTimeout(1200);
  const initial = await titleBoot();
  expect(initial).toMatchObject({
    generation: 1,
    splashFormat: 'webp',
    ready: true,
    deferredHelpLoaded: 0,
    deferredSettingsLoaded: 0,
  });
  expect(initial.essentialAssetCount).toBeGreaterThan(20);
  expect(initial.essentialLoaded).toBe(initial.essentialAssetCount);
  expect(initial.essentialTexturePixels).toBeLessThan(2_200_000);
  expect(initial.compactAssetCount).toBe(12);
  expect(initial.compactLoaded).toBe(initial.compactAssetCount);
  expect(initial.compactMaxDimension).toBe(128);
  expect(initial.deferredHelpAssetCount).toBeGreaterThan(0);
  expect(initial.deferredSettingsAssetCount).toBeGreaterThan(0);

  await page.keyboard.press('h');
  await expect.poll(async () => {
    const state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
    return state.helpOpen && state.titleBoot.deferredHelpLoaded === state.titleBoot.deferredHelpAssetCount;
  }).toBe(true);
  expect((await titleBoot()).generation).toBe(1);
  await page.keyboard.press('Escape');
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').helpOpen)).toBe(false);

  await page.keyboard.press('s');
  await expect.poll(async () => {
    const state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
    return state.settingsOpen && state.titleBoot.deferredSettingsLoaded === state.titleBoot.deferredSettingsAssetCount;
  }).toBe(true);
  expect((await titleBoot()).generation).toBe(1);
});

test('title setup follows remapped keyboard and gamepad controls with one cue per action', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('birdsquad.controlBindings', JSON.stringify({
      version: 1,
      bindings: { confirm: 'Space', back: 'KeyQ', previous: 'KeyA', next: 'KeyD' },
    }));
    localStorage.setItem('birdsquad.maxTier', '2');
    localStorage.setItem('birdsquad.account', JSON.stringify({
      runs: 3, wins: 2, losses: 1, winsByLeader: { fledgling: 2 }, bestWinTier: 1,
      fastestWinTurns: 8, unlockedLeaders: ['fledgling', 'spark_caller', 'talon'], achievements: [],
    }));
    localStorage.removeItem('birdsquad.run.active');
    localStorage.removeItem('birdsquad.run.active.backup');
  });
  await boot(page);
  const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}'));
  const gamepadDown = (index: number) => page.evaluate((buttonIndex) => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    menu.input.gamepad.emit('down', menu.input.gamepad.pad1, { index: buttonIndex }, 1);
  }, index);

  const initial = await state();
  expect(initial.titleFocus).toMatchObject({
    current: 'leader', previous: 'A', next: 'D', confirm: 'Space', ringRendered: true,
  });
  expect(initial.titleFocus.order).toEqual([
    'leader', 'difficulty', 'runMode', 'primaryRun', 'howToPlay', 'settings', 'codex', 'profile',
  ]);

  await page.keyboard.press('d');
  expect((await state()).selectedLeader).toBe('spark_caller');
  await page.keyboard.press('Tab');
  expect((await state()).titleFocus.current).toBe('difficulty');
  await page.keyboard.press('d');
  expect((await state()).selectedDifficulty).toBe(1);
  await page.keyboard.press('Tab');
  expect((await state()).titleFocus.current).toBe('runMode');
  await page.keyboard.press('d');
  await expect.poll(async () => (await state()).selectedRunMode).toBe('quick');
  await expect.poll(async () => (await state()).titleFocus.current).toBe('runMode');
  const afterRestart = await page.evaluate(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    return {
      keyboardListeners: menu.input.keyboard.listenerCount('keydown'),
      gamepadListeners: menu.input.gamepad.listenerCount('down'),
      focusRings: menu.children.list.filter((child: any) => child.name === 'title-menu-focus-ring').length,
    };
  });
  expect(afterRestart).toEqual({ keyboardListeners: 1, gamepadListeners: 1, focusRings: 1 });

  await gamepadDown(13);
  expect((await state()).titleFocus.current).toBe('primaryRun');
  await gamepadDown(0);
  await expect.poll(async () => (await state()).scene, { timeout: 20_000 }).toBe('RouteScene');
  const result = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const routeState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return {
      leaderId: route.runState.leaderId,
      difficulty: route.runState.difficulty,
      runMode: route.runState.runMode,
      confirmCues: routeState.audio.cueRequests.confirm ?? 0,
    };
  });
  expect(result).toMatchObject({ leaderId: 'spark_caller', difficulty: 1, runMode: 'quick' });
  expect(result.confirmCues - (initial.audio.cueRequests.confirm ?? 0)).toBe(7);
});

test('title utility destinations are reachable by controller without starting a run', async ({ page }) => {
  await boot(page);
  const menuGamepadDown = (index: number) => page.evaluate((buttonIndex) => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    menu.input.gamepad.emit('down', menu.input.gamepad.pad1, { index: buttonIndex }, 1);
  }, index);
  const sceneName = () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').scene);

  await menuGamepadDown(12);
  expect(await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').titleFocus.current)).toBe('profile');
  await menuGamepadDown(0);
  await expect.poll(sceneName).toBe('ProfileScene');
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').focus?.current
  ))).toBe('achievements');
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 1 });
  });
  await expect.poll(sceneName).toBe('MenuScene');

  await menuGamepadDown(13);
  await menuGamepadDown(13);
  await menuGamepadDown(13);
  await menuGamepadDown(13);
  await menuGamepadDown(13);
  expect(await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').titleFocus.current)).toBe('howToPlay');
  await menuGamepadDown(0);
  expect(await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').helpOpen)).toBe(true);
  await menuGamepadDown(1);
  expect(await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').helpOpen)).toBe(false);

  await menuGamepadDown(13);
  await menuGamepadDown(0);
  expect(await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsOpen)).toBe(true);
  await menuGamepadDown(1);
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsOpen)).toBe(false);

  await menuGamepadDown(13);
  await menuGamepadDown(0);
  await expect.poll(async () => page.evaluate(() => (
    window.__birdSquadGame.scene.isActive('CodexScene')
  )), { timeout: 20_000 }).toBe(true);
});

test('settings are fully navigable by keyboard and standard gamepad controls', async ({ page }) => {
  await boot(page);
  const snapshot = () => page.evaluate(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    const objects = collect(menu.children.list);
    const ring = objects.find((child: any) => child.name === 'system-settings-focus-ring');
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      listenerCount: menu.input.keyboard.listenerCount('keydown'),
      focusRings: objects.filter((child: any) => child.name === 'system-settings-focus-ring').length,
      rowTargets: objects.filter((child: any) => /^system-settings-row-\d-hit$/.test(child.name ?? '')).length,
      ring: ring ? { index: ring.getData('index'), label: ring.getData('label'), y: Math.round(ring.y) } : undefined,
    };
  });
  const gamepadDown = (index: number) => page.evaluate((buttonIndex) => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    menu.input.gamepad.emit('down', menu.input.gamepad.pad1, { index: buttonIndex }, 1);
  }, index);

  const beforeOpenListeners = await page.evaluate(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    return menu.input.keyboard.listenerCount('keydown');
  });
  await page.evaluate(async () => {
    localStorage.removeItem('birdsquad.motionPreference');
    localStorage.removeItem('birdsquad.visualContrast');
    localStorage.removeItem('birdsquad.graphicsQuality');
    localStorage.removeItem('birdsquad.combatPace');
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    menu.input.keyboard.emit('keydown-S');
  });
  await expect.poll(async () => {
    const current = await snapshot();
    return current.listenerCount === beforeOpenListeners + 1 && current.focusRings === 1 && current.rowTargets === 8;
  }).toBe(true);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toEqual({ index: 0, label: 'Audio' });
  const opened = await snapshot();
  expect(beforeOpenListeners).toBe(1);
  expect(opened.listenerCount).toBe(2);
  expect(opened.focusRings).toBe(1);
  expect(opened.rowTargets).toBe(8);
  expect(opened.ring).toMatchObject({ index: 0, label: 'Audio' });

  const initialMusic = opened.state.audio.musicVolume;
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toEqual({ index: 1, label: 'Music' });
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await snapshot()).state.audio.musicVolume).toBeLessThan(initialMusic);
  const musicAdjusted = await snapshot();
  expect(musicAdjusted.state.settingsFocus).toEqual({ index: 1, label: 'Music' });
  expect(musicAdjusted.listenerCount).toBe(2);
  expect(musicAdjusted.focusRings).toBe(1);

  const initialSfx = musicAdjusted.state.audio.sfxVolume;
  await gamepadDown(13);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toEqual({ index: 2, label: 'SFX' });
  await gamepadDown(14);
  await expect.poll(async () => (await snapshot()).state.audio.sfxVolume).toBeLessThan(initialSfx);
  const sfxAdjusted = await snapshot();
  expect(sfxAdjusted.listenerCount).toBe(2);
  expect(sfxAdjusted.focusRings).toBe(1);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toEqual({ index: 4, label: 'Motion' });
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await snapshot()).state.motion.preference).toBe('reduced');
  expect((await snapshot()).state.settingsFocus).toEqual({ index: 4, label: 'Motion' });

  await gamepadDown(13);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toEqual({ index: 5, label: 'Contrast' });
  await gamepadDown(15);
  await expect.poll(async () => (await snapshot()).state.visualContrast).toMatchObject({ preference: 'high', highContrast: true, applied: true });
  expect((await snapshot()).state.settingsFocus).toEqual({ index: 5, label: 'Contrast' });

  await gamepadDown(13);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toEqual({ index: 6, label: 'Effects' });
  await gamepadDown(15);
  await expect.poll(async () => (await snapshot()).state.graphics.preference).toBe('lean');
  expect((await snapshot()).state.settingsFocus).toEqual({ index: 6, label: 'Effects' });

  await gamepadDown(13);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toEqual({ index: 7, label: 'Combat Pace' });
  await gamepadDown(15);
  await expect.poll(async () => (await snapshot()).state.combatPacing.preference).toBe('snappy');
  expect((await snapshot()).state.settingsFocus).toEqual({ index: 7, label: 'Combat Pace' });

  await gamepadDown(12);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toEqual({ index: 6, label: 'Effects' });
  await gamepadDown(0);
  await expect.poll(async () => (await snapshot()).state.graphics.preference).toBe('auto');
  expect((await snapshot()).state.settingsFocus).toEqual({ index: 6, label: 'Effects' });

  await gamepadDown(12);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toEqual({ index: 5, label: 'Contrast' });
  await gamepadDown(0);
  await expect.poll(async () => (await snapshot()).state.visualContrast).toMatchObject({ preference: 'standard', highContrast: false, applied: true });

  await gamepadDown(12);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toEqual({ index: 4, label: 'Motion' });
  await gamepadDown(0);
  await expect.poll(async () => (await snapshot()).state.motion.preference).toBe('system');
  expect((await snapshot()).state.settingsFocus).toEqual({ index: 4, label: 'Motion' });

  await gamepadDown(1);
  await expect.poll(async () => (await snapshot()).state.settingsOpen).toBe(false);
  const closed = await snapshot();
  expect(closed.listenerCount).toBe(1);
  expect(closed.focusRings).toBe(0);
});

test('keyboard bindings persist, swap conflicts, and apply live across scenes', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  const controlsSnapshot = () => page.evaluate(() => {
    const game: any = window.__birdSquadGame;
    const sceneKey = JSON.parse(window.render_game_to_text?.() ?? '{}').scene;
    const scene: any = game.scene.getScene(sceneKey);
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    const objects = collect(scene.children.list);
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      panels: objects.filter((child: any) => child.name === 'system-controls-panel').length,
      focusRings: objects.filter((child: any) => child.name === 'system-controls-focus-ring').length,
      bindingRows: objects.filter((child: any) => /^system-controls-binding-.+-hit$/.test(child.name ?? '')).length,
      closeFrames: objects.filter((child: any) => child.texture?.key === 'ui-icon-overlay-close-command-frame').length,
      closeMedallions: objects.filter((child: any) => child.texture?.key === 'ui-icon-close-medallion').length,
      settingsFocusRings: objects.filter((child: any) => child.name === 'system-settings-focus-ring' && child.visible).length,
      settingsRows: objects.filter((child: any) => /^system-settings-row-\d-hit$/.test(child.name ?? '')).length,
    };
  });

  await page.keyboard.press('s');
  await expect.poll(async () => (await controlsSnapshot()).state.settingsOpen).toBe(true);
  await expect.poll(async () => {
    const snapshot = await controlsSnapshot();
    return snapshot.settingsFocusRings === 1 && snapshot.settingsRows === 8;
  }).toBe(true);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await controlsSnapshot()).state.settingsFocus).toEqual({ index: 3, label: 'Controls' });
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await controlsSnapshot()).state.controls.panelOpen).toBe(true);
  const opened = await controlsSnapshot();
  expect(opened.panels).toBe(1);
  expect(opened.focusRings).toBe(1);
  expect(opened.bindingRows).toBe(6);
  expect(opened.closeFrames).toBeGreaterThanOrEqual(1);
  expect(opened.closeMedallions).toBeGreaterThanOrEqual(1);
  expect(opened.state.controls).toMatchObject({ page: 'play', focusIndex: 0, customized: false });

  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await controlsSnapshot()).state.controls.page).toBe('utility');
  expect((await controlsSnapshot()).bindingRows).toBe(6);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await controlsSnapshot()).state.controls.page).toBe('play');

  await page.keyboard.press('Enter');
  await expect.poll(async () => (await controlsSnapshot()).state.controls.captureAction).toBe('confirm');
  await page.keyboard.press('c');
  await expect.poll(async () => (await controlsSnapshot()).state.controls.bindings.confirm.key).toBe('C');

  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await controlsSnapshot()).state.controls.focusIndex).toBe(4);
  await page.keyboard.press('Enter');
  await page.keyboard.press('c');
  await expect.poll(async () => (await controlsSnapshot()).state.controls.bindings.pause.key).toBe('C');
  const swapped = await controlsSnapshot();
  expect(swapped.state.controls.bindings.confirm.key).toBe('P');
  expect(swapped.state.controls.customized).toBe(true);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('t');
  await expect.poll(async () => (await controlsSnapshot()).state.controls.bindings.roost.key).toBe('T');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await controlsSnapshot()).state.controls.panelOpen).toBe(false);
  await expect.poll(async () => (await controlsSnapshot()).state.settingsOpen).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await controlsSnapshot()).state.settingsOpen).toBe(false);

  await boot(page);
  const persisted = await controlsSnapshot();
  expect(persisted.state.controls.customized).toBe(true);
  expect(persisted.state.controls.bindings.confirm.key).toBe('P');
  expect(persisted.state.controls.bindings.pause.key).toBe('C');
  expect(persisted.state.controls.bindings.roost.key).toBe('T');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  expect((await controlsSnapshot()).state.scene).toBe('MenuScene');
  await page.keyboard.press('p');
  await expect.poll(async () => (await controlsSnapshot()).state.scene, { timeout: 20_000 }).toBe('RouteScene');
  await expect.poll(async () => (await controlsSnapshot()).state.routeAssetsReady, { timeout: 20_000 }).toBe(true);
  await page.keyboard.press('c');
  await expect.poll(async () => (await controlsSnapshot()).state.pauseOverlayOpen).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await controlsSnapshot()).state.pauseOverlayOpen).toBe(false);

  const routeState = await page.evaluate(() => (window.__birdSquadGame.scene.getScene('RouteScene') as any).runState);
  await page.evaluate(async (runState) => {
    await window.__birdSquadStartScene!('BattleScene', { runState, routeNodeId: 'm1_entry' });
  }, routeState);
  await page.keyboard.press('r');
  await page.waitForTimeout(250);
  let battleState = await controlsSnapshot();
  expect(battleState.state.combatAnimationPending).toBe(false);
  await page.keyboard.press('t');
  await expect.poll(async () => (await controlsSnapshot()).state.combatAnimationPending).toBe(true);

  await page.evaluate(async () => window.__birdSquadStartScene!('MenuScene'));
  await page.keyboard.press('s');
  await expect.poll(async () => (await controlsSnapshot()).state.settingsOpen).toBe(true);
  await expect.poll(async () => {
    const snapshot = await controlsSnapshot();
    return snapshot.settingsFocusRings === 1 && snapshot.settingsRows === 8;
  }).toBe(true);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await controlsSnapshot()).state.controls.panelOpen).toBe(true);
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await controlsSnapshot()).state.controls.focusIndex).toBe(6);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await controlsSnapshot()).state.controls.customized).toBe(false);
  const reset = await controlsSnapshot();
  expect(reset.state.controls.bindings.confirm.key).toBe('Enter');
  expect(reset.state.controls.bindings.pause.key).toBe('P');
  expect(reset.state.controls.bindings.roost.key).toBe('R');
});

test('combat and rewards expose remapped keyboard and standard gamepad focus', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => {
    localStorage.setItem('birdsquad.controlBindings', JSON.stringify({
      version: 1,
      bindings: {
        confirm: 'Space',
        back: 'KeyQ',
        previous: 'KeyA',
        next: 'KeyD',
        pause: 'KeyP',
        roost: 'KeyR',
        hustle: 'KeyH',
        skipReward: 'KeyX',
        mute: 'KeyM',
        fullscreen: 'KeyF',
        settings: 'KeyS',
        guide: 'KeyG',
      },
    }));
    localStorage.setItem('birdsquad.screenReader', 'on');
  });
  await boot(page);

  const startBattle = async () => {
    await page.evaluate(async () => window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' }));
    await expect.poll(async () => {
      const state = await page.evaluate(() => JSON.parse(window.render_game_to_text!()));
      return state.scene === 'BattleScene'
        && state.mode === 'battle'
        && state.battleHandRenderer?.ready
        && !state.combatAnimationPending
        && state.hand?.length > 0;
    }, { timeout: 30_000 }).toBe(true);
  };
  const snapshot = () => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text!());
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    const objects = collect(scene.children.list);
    return {
      state,
      focusRings: objects.filter((child: any) => child.name === 'reward-input-focus-ring').length,
      inputHints: objects.filter((child: any) => child.name === 'combat-input-hint').length,
      liveText: document.getElementById('game-status')?.textContent ?? '',
    };
  });
  const gamepadDown = (index: number) => page.evaluate((buttonIndex) => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.input.gamepad.emit('down', battle.input.gamepad.pad1, { index: buttonIndex }, 1);
  }, index);

  await startBattle();
  const initial = await snapshot();
  expect(initial.state.combatInputFocus).toMatchObject({ active: false, count: initial.state.hand.length });
  await page.keyboard.press('d');
  await expect.poll(async () => (await snapshot()).state.combatInputFocus).toMatchObject({
    active: true,
    kind: 'card',
    index: 1,
    visibleFocus: true,
    bindings: { previous: 'A', next: 'D', confirm: 'Space', roost: 'R', pause: 'P' },
  });
  let selected = await snapshot();
  expect(selected.state.selectedCard).toBe(selected.state.hand[1].instanceId);
  expect(selected.inputHints).toBe(2);
  expect(selected.state.combatInputFocus.target).toBeTruthy();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot()).state.combatAnimationPending).toBe(true);
  await page.evaluate(() => window.advanceTime?.(2400));
  await expect.poll(async () => (await snapshot()).state.combatAnimationPending).toBe(false);
  expect((await snapshot()).state.hand.length).toBe(initial.state.hand.length - 1);

  await page.keyboard.press('p');
  await expect.poll(async () => (await snapshot()).state.paused).toBe(true);
  await gamepadDown(1);
  await expect.poll(async () => (await snapshot()).state.paused).toBe(false);

  await startBattle();
  await gamepadDown(15);
  await expect.poll(async () => (await snapshot()).state.combatInputFocus).toMatchObject({ active: true, kind: 'card', index: 1, visibleFocus: true });
  const beforeGamepadPlay = await snapshot();
  await gamepadDown(0);
  await expect.poll(async () => (await snapshot()).state.combatAnimationPending).toBe(true);
  expect((await snapshot()).state.selectedEnemy).toBe(beforeGamepadPlay.state.selectedEnemy);
  await page.evaluate(() => window.advanceTime?.(2400));
  await expect.poll(async () => (await snapshot()).state.combatAnimationPending).toBe(false);
  await gamepadDown(9);
  await expect.poll(async () => (await snapshot()).state.paused).toBe(true);
  await gamepadDown(1);
  await expect.poll(async () => (await snapshot()).state.paused).toBe(false);

  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.mode = 'cardReward';
    battle.rewardChoices = battle.createRewardChoices();
    battle.controllerChoiceIndex = 0;
    battle.battleInputActive = false;
    battle.renderAll();
  });
  await expect.poll(async () => (await snapshot()).state.battleRewardRenderer?.ready, { timeout: 20_000 }).toBe(true);
  await page.keyboard.press('d');
  await expect.poll(async () => (await snapshot()).state.combatInputFocus).toMatchObject({
    active: true,
    kind: 'cardReward',
    index: 1,
    count: 3,
    visibleFocus: true,
  });
  const reward = await snapshot();
  expect(reward.focusRings).toBe(1);
  expect(reward.inputHints).toBe(2);
  await expect.poll(async () => (await snapshot()).liveText).toContain(`Focused ${reward.state.combatInputFocus.label}`);
  expect((await snapshot()).liveText).toContain('choice 2 of 3');
});

test('title How to Play overlay opens, reports state, and loads its medallion', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    let menu: any = g.scene.getScene('MenuScene');
    const countTexture = (items: any[], key: string): number => items.reduce((sum, child) => {
      const self = child.texture?.key === key ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, key) : 0;
      return sum + self + nested;
    }, 0);

    menu.input.keyboard.emit('keydown-H');
    for (let i = 0; i < 80; i += 1) {
      await wait(50);
      menu = g.scene.getScene('MenuScene');
      const state = JSON.parse(window.render_game_to_text!());
      if (
        state.helpOpen
        && menu.textures.exists('ui-icon-how-to-play-tip-row-frame')
        && countTexture(menu.children.list, 'ui-icon-overlay-panel-flourish') > 0
        && countTexture(menu.children.list, 'ui-icon-how-to-play-guide-frame') >= 2
        && countTexture(menu.children.list, 'ui-icon-how-to-play-topic-card-frame') >= 4
        && countTexture(menu.children.list, 'ui-icon-how-to-play-tip-row-frame') >= 2
      ) break;
    }
    const opened = JSON.parse(window.render_game_to_text!());
    const helpTextureLoaded = g.textures.exists('ui-icon-help-medallion');
    const flourishLoaded = g.textures.exists('ui-icon-overlay-panel-flourish');
    const flourishRendered = countTexture(menu.children.list, 'ui-icon-overlay-panel-flourish');
    const titlePlaqueLoaded = g.textures.exists('ui-icon-system-overlay-title-plaque');
    const titlePlaqueRendered = countTexture(menu.children.list, 'ui-icon-system-overlay-title-plaque');
    const guideFrameLoaded = g.textures.exists('ui-icon-how-to-play-guide-frame');
    const guideFrameRendered = countTexture(menu.children.list, 'ui-icon-how-to-play-guide-frame');
    const topicCardFrameLoaded = g.textures.exists('ui-icon-how-to-play-topic-card-frame');
    const topicCardFrameRendered = countTexture(menu.children.list, 'ui-icon-how-to-play-topic-card-frame');
    const tipRowFrameLoaded = g.textures.exists('ui-icon-how-to-play-tip-row-frame');
    const tipRowFrameRendered = countTexture(menu.children.list, 'ui-icon-how-to-play-tip-row-frame');
    const collectTextureObjects = (items: any[], key: string): any[] => {
      const found: any[] = [];
      for (const child of items ?? []) {
        if (child.texture?.key === key) found.push(child);
        if (Array.isArray(child.list)) found.push(...collectTextureObjects(child.list, key));
      }
      return found;
    };
    const tipRowFrameObjects = collectTextureObjects(menu.children.list, 'ui-icon-how-to-play-tip-row-frame')
      .map((child: any) => ({
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        name: child.name,
        visible: child.visible,
      }));
    const guideActionTargets = (menu.helpOverlay?.list ?? [])
      .filter((child: any) => child.input?.enabled && child.type === 'Rectangle' && child.displayWidth === 190)
      .map((child: any) => ({ width: child.displayWidth, height: child.displayHeight }));
    menu.input.keyboard.emit('keydown-ESC');
    await wait(80);
    const closed = JSON.parse(window.render_game_to_text!());

    return {
      opened: opened.helpOpen,
      settingsStayedClosed: opened.settingsOpen === false,
      closed: closed.helpOpen,
      helpTextureLoaded,
      flourishLoaded,
      flourishRendered,
      titlePlaqueLoaded,
      titlePlaqueRendered,
      titlePlaqueTelemetry: opened.systemOverlayTitlePlaque,
      guideFrameLoaded,
      guideFrameRendered,
      topicCardFrameLoaded,
      topicCardFrameRendered,
      topicCardFrameTelemetry: opened.howToPlayTopicCardFrame,
      tipRowFrameLoaded,
      tipRowFrameRendered,
      tipRowFrameObjects,
      tipRowFrameTelemetry: opened.howToPlayTipRowFrame,
      guideActionTargets
    };
  });

  expect(result.opened).toBe(true);
  expect(result.settingsStayedClosed).toBe(true);
  expect(result.closed).toBe(false);
  expect(result.helpTextureLoaded).toBe(true);
  expect(result.flourishLoaded).toBe(true);
  expect(result.flourishRendered).toBeGreaterThanOrEqual(1);
  expect(result.titlePlaqueLoaded).toBe(true);
  expect(result.titlePlaqueRendered).toBe(1);
  expect(result.titlePlaqueTelemetry).toEqual({ loaded: true, rendered: true, count: 1 });
  expect(result.guideFrameLoaded).toBe(true);
  expect(result.guideFrameRendered).toBeGreaterThanOrEqual(2);
  expect(result.topicCardFrameLoaded).toBe(true);
  expect(result.topicCardFrameRendered).toBeGreaterThanOrEqual(4);
  expect(result.topicCardFrameTelemetry.loaded).toBe(true);
  expect(result.topicCardFrameTelemetry.count).toBeGreaterThanOrEqual(4);
  expect(result.tipRowFrameLoaded).toBe(true);
  expect(result.tipRowFrameRendered).toBe(2);
  expect(result.tipRowFrameTelemetry).toEqual({ loaded: true, rendered: true, count: 2 });
  expect(result.tipRowFrameObjects).toHaveLength(2);
  expect(result.guideActionTargets).toEqual([
    { width: 190, height: 56 },
    { width: 190, height: 56 }
  ]);
  for (const frame of result.tipRowFrameObjects) {
    expect(frame).toMatchObject({
      displayWidth: 616,
      displayHeight: 38,
      name: 'how-to-play-tip-row-frame',
      visible: true,
    });
    expect(frame.alpha).toBeGreaterThan(0.6);
  }
});

test('deck review overlays render generated dossier flourish art', async ({ page }) => {
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
    await wait(80);
    const routeState = JSON.parse(window.render_game_to_text!());
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
      if (state.battleInspectRenderer?.loaded && state.deckReviewFlourish?.rendered) break;
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
  expect(result.routeFlourish).toBeGreaterThanOrEqual(1);
  expect(result.routeScrollButtonTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeScrollButtonFrames });
  expect(result.routeRowFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeRowFrames });
  expect(result.routePageIndicatorFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.routePageIndicatorFrames });
  expect(result.routeTitlePlaqueTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeTitlePlaques });
  expect(result.routeDetailFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeDetailFrames });
  expect(result.routeCostBadgeTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeCostBadges });
  expect(result.routeMetaChipFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeMetaChipFrames });
  expect(result.routeSectionTabFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeSectionTabFrames });
  expect(result.routePageIndicatorFrames).toBe(1);
  expect(result.routePageIndicatorFrameObjects).toHaveLength(1);
  expect(result.routePageIndicatorFrameObjects[0]).toEqual(expect.objectContaining({
    name: 'deck-review-page-indicator-frame',
    width: 126,
    height: 36,
    visible: true
  }));
  expect(result.routeTitlePlaques).toBe(1);
  expect(result.routeTitlePlaqueObjects[0]).toEqual(expect.objectContaining({
    name: 'deck-review-title-plaque',
    width: 452,
    height: 92,
    visible: true
  }));
  expect(result.routeDetailFrames).toBe(1);
  expect(result.routeDetailFrameObjects[0]).toEqual(expect.objectContaining({
    name: 'deck-review-detail-frame',
    width: 642,
    height: 444,
    visible: true
  }));
  expect(result.routeCostBadges).toBe(result.routeRowFrames + 1);
  expect(result.routeCostBadgeObjects.filter((badge: { width: number; height: number }) => badge.width === 46 && badge.height === 46)).toHaveLength(1);
  expect(result.routeCostBadgeObjects.filter((badge: { width: number; height: number }) => badge.width === 34 && badge.height === 34)).toHaveLength(result.routeRowFrames);
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
  expect(result.routeSectionTabFrames).toBe(1);
  expect(result.routeSectionTabFrameObjects[0]).toEqual(expect.objectContaining({
    name: 'deck-review-section-tab-frame',
    width: 136,
    height: 32,
    visible: true
  }));
  expect(result.routeRowFrames).toBeGreaterThanOrEqual(6);
  expect(result.routeRowFrameObjects.every((frame: { name: string; width: number; height: number; visible: boolean }) => (
    frame.name === 'deck-review-row-frame'
    && frame.width === 334
    && frame.height === 44
    && frame.visible
  ))).toBe(true);
  expect(result.routeScrollButtonFrames).toBe(2);
  expect(result.routeScrollButtonFrameObjects).toHaveLength(2);
  expect(result.routeScrollButtonFrameObjects.every((frame: { name: string; width: number; height: number; visible: boolean }) => (
    frame.name === 'deck-review-scroll-button-frame'
    && frame.width === 82
    && frame.height === 34
    && frame.visible
  ))).toBe(true);
  expect(result.battleOpen).toBe('deck');
  expect(result.battleInspectRenderer).toEqual({ requested: true, loaded: true, failed: false });
  expect(result.battleFlourish).toBeGreaterThanOrEqual(1);
  expect(result.battleRowFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleRowFrames });
  expect(result.battleRowFrames).toBeGreaterThanOrEqual(6);
  expect(result.battlePageIndicatorFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.battlePageIndicatorFrames });
  expect(result.battlePageIndicatorFrames).toBe(1);
  expect(result.battleTitlePlaqueTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleTitlePlaques });
  expect(result.battleTitlePlaques).toBe(1);
  expect(result.battleTitlePlaqueObjects[0]).toEqual(expect.objectContaining({
    name: 'deck-review-title-plaque',
    width: 430,
    height: 78,
    visible: true
  }));
  expect(result.battleDetailFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleDetailFrames });
  expect(result.battleCostBadgeTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleCostBadges });
  expect(result.battleMetaChipFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleMetaChipFrames });
  expect(result.battleSectionTabFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleSectionTabFrames });
  expect(result.battleDetailFrames).toBe(2);
  expect(result.battleDetailFrameObjects.every((frame: { name: string; width: number; height: number; visible: boolean }) => (
    frame.name === 'deck-review-detail-frame'
    && frame.width === 672
    && frame.height === 466
    && frame.visible
  ))).toBe(true);
  expect(result.battleCostBadges).toBe(result.battleRowFrames + 1);
  expect(result.battleCostBadgeObjects.filter((badge: { width: number; height: number }) => badge.width === 46 && badge.height === 46)).toHaveLength(1);
  expect(result.battleCostBadgeObjects.filter((badge: { width: number; height: number }) => badge.width === 34 && badge.height === 34)).toHaveLength(result.battleRowFrames);
  expect(result.battleCostBadgeObjects.every((badge: { name: string; visible: boolean }) => (
    badge.name === 'deck-review-cost-badge'
    && badge.visible
  ))).toBe(true);
  expect(result.battleMetaChipFrames).toBe(result.battleRowFrames);
  expect(result.battleMetaChipFrameObjects.every((frame: { name: string; width: number; height: number; visible: boolean }) => (
    frame.name === 'deck-review-meta-chip-frame'
    && frame.width === 92
    && frame.height === 24
    && frame.visible
  ))).toBe(true);
  expect(result.battleSectionTabFrames).toBe(1);
  expect(result.battleSectionTabFrameObjects[0]).toEqual(expect.objectContaining({
    name: 'deck-review-section-tab-frame',
    width: 136,
    height: 32,
    visible: true
  }));
});

test('flock stats overlays render generated formation flourish art', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const countFlourish = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-flock-stats-flourish' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countFlourish(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countFlockTitlePlaque = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-flock-stats-title-plaque' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countFlockTitlePlaque(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countFlockCaptionFrame = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-flock-stats-caption-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countFlockCaptionFrame(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countFlockFooterFrame = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-flock-stats-footer-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countFlockFooterFrame(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countFlockHeaderFrame = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-flock-stats-header-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countFlockHeaderFrame(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countStatsFrame = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-stats-tally-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countStatsFrame(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countStatsRowFrame = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-stats-tally-row-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countStatsRowFrame(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countStatsTitlePlaque = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-stats-tally-title-plaque' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countStatsTitlePlaque(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countRowFrame = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-flock-stats-row-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countRowFrame(child.list) : 0;
      return sum + self + nested;
    }, 0);

    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    route.openFlockOverlay();
    await wait(80);
    const routeState = JSON.parse(window.render_game_to_text!());
    const routeFlourish = countFlourish(route.children.list);
    const routeTitlePlaque = countFlockTitlePlaque(route.children.list);
    const routeCaptionFrame = countFlockCaptionFrame(route.children.list);
    const routeFooterFrame = countFlockFooterFrame(route.children.list);
    const routeHeaderFrame = countFlockHeaderFrame(route.children.list);
    const routeRowFrames = countRowFrame(route.children.list);
    const routeTitlePlaqueObjects = route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-flock-stats-title-plaque')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const routeHeaderFrameObjects = route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-flock-stats-header-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const routeCaptionFrameObjects = route.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-flock-stats-caption-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));

    await window.__birdSquadStartScene!('BattleScene', { runState: route.runState, routeNodeId: 'm1_entry' });
    await wait(250);
    const battle: any = g.scene.getScene('BattleScene');
    battle.openOverlay('flock');
    const battleFlockTextureKeys = [
      'ui-icon-combat-stats-tally-frame',
      'ui-icon-combat-stats-tally-row-frame',
      'ui-icon-combat-stats-tally-title-plaque'
    ];
    for (let i = 0; i < 80 && !battleFlockTextureKeys.every((key) => battle.textures.exists(key)); i += 1) {
      await wait(50);
    }
    battle.renderAll();
    await wait(0);
    const battleState = JSON.parse(window.render_game_to_text!());
    const battleRoot = battle.root?.list ?? battle.children.list;
    const battleFlourish = countFlourish(battleRoot);
    const battleTitlePlaque = countFlockTitlePlaque(battleRoot);
    const battleCaptionFrame = countFlockCaptionFrame(battleRoot);
    const battleFooterFrame = countFlockFooterFrame(battleRoot);
    const battleHeaderFrame = countFlockHeaderFrame(battleRoot);
    const battleRowFrames = countRowFrame(battleRoot);
    const battleStatsFrame = countStatsFrame(battleRoot);
    const battleStatsRowFrame = countStatsRowFrame(battleRoot);
    const battleStatsTitlePlaque = countStatsTitlePlaque(battleRoot);
    const battleRowFrameObjects = battleRoot
      .filter((child: any) => child.texture?.key === 'ui-icon-flock-stats-row-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const battleTitlePlaqueObjects = battleRoot
      .filter((child: any) => child.texture?.key === 'ui-icon-flock-stats-title-plaque')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const battleHeaderFrameObjects = battleRoot
      .filter((child: any) => child.texture?.key === 'ui-icon-flock-stats-header-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const battleCaptionFrameObjects = battleRoot
      .filter((child: any) => child.texture?.key === 'ui-icon-flock-stats-caption-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const battleFooterFrameObjects = battleRoot
      .filter((child: any) => child.texture?.key === 'ui-icon-flock-stats-footer-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const battleStatsRowFrameObjects = battleRoot
      .filter((child: any) => child.texture?.key === 'ui-icon-combat-stats-tally-row-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const battleStatsFrameObjects = battleRoot
      .filter((child: any) => child.texture?.key === 'ui-icon-combat-stats-tally-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const battleStatsTitlePlaqueObjects = battleRoot
      .filter((child: any) => child.texture?.key === 'ui-icon-combat-stats-tally-title-plaque')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));

    return {
      loaded: g.textures.exists('ui-icon-flock-stats-flourish'),
      titlePlaqueLoaded: g.textures.exists('ui-icon-flock-stats-title-plaque'),
      captionFrameLoaded: g.textures.exists('ui-icon-flock-stats-caption-frame'),
      footerFrameLoaded: g.textures.exists('ui-icon-flock-stats-footer-frame'),
      headerFrameLoaded: g.textures.exists('ui-icon-flock-stats-header-frame'),
      rowFrameLoaded: g.textures.exists('ui-icon-flock-stats-row-frame'),
      tallyFrameLoaded: g.textures.exists('ui-icon-combat-stats-tally-frame'),
      tallyRowFrameLoaded: g.textures.exists('ui-icon-combat-stats-tally-row-frame'),
      tallyTitlePlaqueLoaded: g.textures.exists('ui-icon-combat-stats-tally-title-plaque'),
      routeOpen: routeState.flockOverlayOpen,
      routeFlourish,
      routeTitlePlaque,
      routeCaptionFrame,
      routeFooterFrame,
      routeHeaderFrame,
      routeRowFrames,
      routeTitlePlaqueObjects,
      routeCaptionFrameObjects,
      routeHeaderFrameObjects,
      routeTelemetry: routeState.flockStatsFlourish,
      routeTitlePlaqueTelemetry: routeState.flockStatsTitlePlaque,
      routeCaptionFrameTelemetry: routeState.flockStatsCaptionFrame,
      routeFooterFrameTelemetry: routeState.flockStatsFooterFrame,
      routeHeaderFrameTelemetry: routeState.flockStatsHeaderFrame,
      routeRowFrameTelemetry: routeState.flockStatsRowFrame,
      battleOpen: battleState.inspectOverlay,
      battleFlourish,
      battleTitlePlaque,
      battleCaptionFrame,
      battleFooterFrame,
      battleHeaderFrame,
      battleRowFrames,
      battleTitlePlaqueObjects,
      battleCaptionFrameObjects,
      battleFooterFrameObjects,
      battleHeaderFrameObjects,
      battleTelemetry: battleState.flockStatsFlourish,
      battleTitlePlaqueTelemetry: battleState.flockStatsTitlePlaque,
      battleCaptionFrameTelemetry: battleState.flockStatsCaptionFrame,
      battleFooterFrameTelemetry: battleState.flockStatsFooterFrame,
      battleHeaderFrameTelemetry: battleState.flockStatsHeaderFrame,
      battleRowFrameTelemetry: battleState.flockStatsRowFrame,
      battleStatsFrame,
      battleStatsRowFrame,
      battleStatsTitlePlaque,
      battleRowFrameObjects,
      battleStatsRowFrameObjects,
      battleStatsFrameObjects,
      battleStatsTitlePlaqueObjects,
      battleStatsTelemetry: battleState.combatStatsTallyFrame,
      battleStatsRowTelemetry: battleState.combatStatsTallyRowFrame,
      battleStatsTitleTelemetry: battleState.combatStatsTallyTitlePlaque
    };
  });

  expect(result.loaded).toBe(true);
  expect(result.routeOpen).toBe(true);
  expect(result.routeFlourish).toBeGreaterThanOrEqual(1);
  expect(result.routeTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeFlourish });
  expect(result.titlePlaqueLoaded).toBe(true);
  expect(result.routeTitlePlaque).toBe(1);
  expect(result.routeTitlePlaqueTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeTitlePlaque });
  expect(result.routeTitlePlaqueObjects.every((frame: { width: number; height: number }) => frame.width === 560 && frame.height === 86)).toBe(true);
  expect(result.captionFrameLoaded).toBe(true);
  expect(result.routeCaptionFrame).toBe(1);
  expect(result.routeCaptionFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeCaptionFrame });
  expect(result.routeCaptionFrameObjects.every((frame: { width: number; height: number }) => frame.width === 520 && frame.height === 34)).toBe(true);
  expect(result.footerFrameLoaded).toBe(true);
  expect(result.routeFooterFrame).toBe(0);
  expect(result.routeFooterFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.headerFrameLoaded).toBe(true);
  expect(result.routeHeaderFrame).toBe(1);
  expect(result.routeHeaderFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeHeaderFrame });
  expect(result.routeHeaderFrameObjects.every((frame: { width: number; height: number }) => frame.width === 566 && frame.height === 30)).toBe(true);
  expect(result.rowFrameLoaded).toBe(true);
  expect(result.routeRowFrames).toBeGreaterThanOrEqual(9);
  expect(result.routeRowFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.routeRowFrames });
  expect(result.battleOpen).toBe('flock');
  expect(result.battleFlourish).toBeGreaterThanOrEqual(1);
  expect(result.battleTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleFlourish });
  expect(result.battleTitlePlaque).toBe(1);
  expect(result.battleTitlePlaqueTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleTitlePlaque });
  expect(result.battleTitlePlaqueObjects.every((frame: { width: number; height: number }) => frame.width === 560 && frame.height === 86)).toBe(true);
  expect(result.battleCaptionFrame).toBe(1);
  expect(result.battleCaptionFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleCaptionFrame });
  expect(result.battleCaptionFrameObjects.every((frame: { width: number; height: number }) => frame.width === 520 && frame.height === 34)).toBe(true);
  expect(result.battleFooterFrame).toBe(1);
  expect(result.battleFooterFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleFooterFrame });
  expect(result.battleFooterFrameObjects.every((frame: { width: number; height: number }) => frame.width === 540 && frame.height === 36)).toBe(true);
  expect(result.battleHeaderFrame).toBe(1);
  expect(result.battleHeaderFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleHeaderFrame });
  expect(result.battleHeaderFrameObjects.every((frame: { width: number; height: number }) => frame.width === 566 && frame.height === 30)).toBe(true);
  expect(result.battleRowFrames).toBeGreaterThanOrEqual(10);
  expect(result.battleRowFrameTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleRowFrames });
  expect(result.battleRowFrameObjects.every((frame: { width: number; height: number }) => frame.width === 566 && frame.height === 34)).toBe(true);
  expect(result.tallyFrameLoaded).toBe(true);
  expect(result.battleStatsFrame).toBeGreaterThanOrEqual(1);
  expect(result.battleStatsTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleStatsFrame });
  expect(result.battleStatsFrameObjects.every((frame: { width: number; height: number }) => frame.width === 286 && frame.height === 338)).toBe(true);
  expect(result.tallyRowFrameLoaded).toBe(true);
  expect(result.battleStatsRowFrame).toBe(6);
  expect(result.battleStatsRowTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleStatsRowFrame });
  expect(result.battleStatsRowFrameObjects.every((frame: { width: number; height: number }) => frame.width === 314 && frame.height === 30)).toBe(true);
  expect(result.tallyTitlePlaqueLoaded).toBe(true);
  expect(result.battleStatsTitlePlaque).toBe(1);
  expect(result.battleStatsTitleTelemetry).toEqual({ loaded: true, rendered: true, count: result.battleStatsTitlePlaque });
  expect(result.battleStatsTitlePlaqueObjects.every((frame: { width: number; height: number }) => frame.width === 318 && frame.height === 54)).toBe(true);
});

test('run kit drawers render generated inventory flourish art', async ({ page }) => {
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
    await wait(80);
    const routeWaymarkState = JSON.parse(window.render_game_to_text!());
    const routeWaymarkFlourish = countFlourish(route.children.list);
    const routeWaymarkTileFrames = countTileFrames(route.children.list);
    route.openSupplyDrawer();
    await wait(80);
    const routeSupplyState = JSON.parse(window.render_game_to_text!());
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
  expect(result.routeWaymarkFlourish).toBeGreaterThanOrEqual(1);
  expect(result.routeWaymarkTileFrames).toBe(3);
  expect(result.routeWaymarkTileTelemetry).toEqual({ loaded: true, rendered: true, count: 3 });
  expect(result.routeSupplyOpen).toBe(true);
  expect(result.routeSupplyFlourish).toBeGreaterThanOrEqual(1);
  expect(result.routeSupplyTileFrames).toBe(2);
  expect(result.routeSupplyTileTelemetry).toEqual({ loaded: true, rendered: true, count: 2 });
  expect(result.routeSupplyEmptySlotFrames).toBe(1);
  expect(result.routeSupplyEmptySlotTelemetry).toEqual({ loaded: true, rendered: true, count: 1 });
  expect(result.battleWaymarkOpen).toBe(true);
  expect(result.battleWaymarkFlourish).toBeGreaterThanOrEqual(1);
  expect(result.battleWaymarkTileFrames).toBe(3);
  expect(result.battleWaymarkTileTelemetry).toEqual({ loaded: true, rendered: true, count: 3 });
  expect(result.battleSupplyOpen).toBe(true);
  expect(result.battleSupplyFlourish).toBeGreaterThanOrEqual(1);
  expect(result.battleSupplyTileFrames).toBe(2);
  expect(result.battleSupplyTileTelemetry).toEqual({ loaded: true, rendered: true, count: 2 });
  expect(result.battleSupplyEmptySlotFrames).toBe(1);
  expect(result.battleSupplyEmptySlotTelemetry).toEqual({ loaded: true, rendered: true, count: 1 });
});

test('combat draw and discard piles render generated dock art', async ({ page }) => {
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
      if (state.combatPileDock?.loaded && state.combatPileDock?.rendered && state.combatPileDock?.count >= 2) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!());
    return {
      combatPileDock: state.combatPileDock,
      pileDockObjects: countTexture(battle.root?.list ?? battle.children.list),
    };
  });

  expect(result.combatPileDock).toEqual({ loaded: true, rendered: true, count: result.pileDockObjects });
  expect(result.pileDockObjects).toBeGreaterThanOrEqual(2);
});

test('combat pile inspector renders generated review dossier frame', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const seedCard = battle.drawPile[0] ?? battle.hand[0];
    if (seedCard) {
      while (battle.drawPile.length < 13) {
        const seedIndex = battle.drawPile.length;
        battle.drawPile.push({
          ...seedCard,
          id: `${seedCard.id}-review-scroll-frame-seed-${seedIndex}`,
          instanceId: `review-scroll-frame-seed-${seedIndex}`
        });
      }
    }
    const beforeOpen = JSON.parse(window.render_game_to_text!()).battleInspectRenderer;
    battle.openOverlay('draw');
    await wait(120);
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-pile-review-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countRowFrames = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-pile-row-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countRowFrames(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countScrollButtonFrames = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-pile-scroll-button-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countScrollButtonFrames(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countBadges = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-pile-count-badge' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countBadges(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countDetailChipFrames = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-pile-detail-chip-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countDetailChipFrames(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countStatChipFrames = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-pile-stat-chip-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countStatChipFrames(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countTitlePlaques = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-pile-title-plaque' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTitlePlaques(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countPageIndicatorFrames = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-pile-page-indicator-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countPageIndicatorFrames(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const countCloseFrames = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-overlay-close-command-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countCloseFrames(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (
        state.combatPileReviewFrame?.loaded
        && state.battleInspectRenderer?.loaded
        && state.combatPileReviewFrame?.rendered
        && state.combatPileRowFrame?.rendered
        && state.combatPileScrollButtonFrame?.rendered
        && state.combatPileCountBadge?.rendered
        && state.combatPileDetailChipFrame?.rendered
        && state.combatPileStatChipFrame?.rendered
        && state.combatPileTitlePlaque?.rendered
        && state.combatPilePageIndicatorFrame?.rendered
        && state.overlayCloseCommandFrame?.rendered
      ) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!());
    return {
      inspectOverlay: state.inspectOverlay,
      beforeOpen,
      battleInspectRenderer: state.battleInspectRenderer,
      combatPileReviewFrame: state.combatPileReviewFrame,
      combatPileRowFrame: state.combatPileRowFrame,
      combatPileScrollButtonFrame: state.combatPileScrollButtonFrame,
      combatPileCountBadge: state.combatPileCountBadge,
      combatPileDetailChipFrame: state.combatPileDetailChipFrame,
      combatPileStatChipFrame: state.combatPileStatChipFrame,
      combatPileTitlePlaque: state.combatPileTitlePlaque,
      combatPilePageIndicatorFrame: state.combatPilePageIndicatorFrame,
      overlayCloseCommandFrame: state.overlayCloseCommandFrame,
      frameObjects: countTexture(battle.root?.list ?? battle.children.list),
      rowFrameObjects: countRowFrames(battle.root?.list ?? battle.children.list),
      scrollButtonFrameObjects: countScrollButtonFrames(battle.root?.list ?? battle.children.list),
      countBadgeObjects: countBadges(battle.root?.list ?? battle.children.list),
      detailChipFrameObjects: countDetailChipFrames(battle.root?.list ?? battle.children.list),
      statChipFrameObjects: countStatChipFrames(battle.root?.list ?? battle.children.list),
      titlePlaqueObjects: countTitlePlaques(battle.root?.list ?? battle.children.list),
      pageIndicatorFrameObjects: countPageIndicatorFrames(battle.root?.list ?? battle.children.list),
      closeFrameObjects: countCloseFrames(battle.root?.list ?? battle.children.list),
      visibleRows: Math.min(battle.drawPile.length, 11),
    };
  });

  expect(result.inspectOverlay).toBe('draw');
  expect(result.beforeOpen).toEqual({ requested: false, loaded: false, failed: false });
  expect(result.battleInspectRenderer).toEqual({ requested: true, loaded: true, failed: false });
  expect(result.combatPileReviewFrame).toEqual({ loaded: true, rendered: true, count: result.frameObjects });
  expect(result.frameObjects).toBeGreaterThanOrEqual(2);
  expect(result.combatPileRowFrame).toEqual({ loaded: true, rendered: true, count: result.rowFrameObjects });
  expect(result.rowFrameObjects).toBe(result.visibleRows);
  expect(result.combatPileScrollButtonFrame).toEqual({ loaded: true, rendered: true, count: result.scrollButtonFrameObjects });
  expect(result.scrollButtonFrameObjects).toBe(2);
  expect(result.combatPileCountBadge).toEqual({ loaded: true, rendered: true, count: result.countBadgeObjects });
  expect(result.countBadgeObjects).toBe(result.visibleRows + 3);
  expect(result.combatPileDetailChipFrame).toEqual({ loaded: true, rendered: true, count: result.detailChipFrameObjects });
  expect(result.detailChipFrameObjects).toBe(2);
  expect(result.combatPileStatChipFrame).toEqual({ loaded: true, rendered: true, count: result.statChipFrameObjects });
  expect(result.statChipFrameObjects).toBeGreaterThanOrEqual(1);
  expect(result.combatPileTitlePlaque).toEqual({ loaded: true, rendered: true, count: result.titlePlaqueObjects });
  expect(result.titlePlaqueObjects).toBe(1);
  expect(result.combatPilePageIndicatorFrame).toEqual({ loaded: true, rendered: true, count: result.pageIndicatorFrameObjects });
  expect(result.pageIndicatorFrameObjects).toBe(1);
  expect(result.overlayCloseCommandFrame).toEqual({ loaded: true, rendered: true, count: result.closeFrameObjects });
  expect(result.closeFrameObjects).toBe(1);
});

test('combat end turn control renders generated roost command frame', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-roost-command-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatRoostCommandFrame?.loaded && state.combatRoostCommandFrame?.rendered) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!());
    return {
      combatRoostCommandFrame: state.combatRoostCommandFrame,
      frameObjects: countTexture(battle.root?.list ?? battle.children.list),
    };
  });

  expect(result.combatRoostCommandFrame).toEqual({ loaded: true, rendered: true, count: result.frameObjects });
  expect(result.frameObjects).toBeGreaterThanOrEqual(1);
});

test('combat floating text uses generated callout backplate', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'combat-floating-callout' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const objectsFor = (items: any[]): Array<{ name: string; width: number; height: number; alpha: number }> => items
      .flatMap((child: any) => {
        const nested = Array.isArray(child.list) ? objectsFor(child.list) : [];
        const self = child.texture?.key === 'combat-floating-callout'
          ? [{
              name: child.name,
              width: Math.round(child.displayWidth),
              height: Math.round(child.displayHeight),
              alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
            }]
          : [];
        return [...self, ...nested];
      });
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatFloatingCallout?.loaded) break;
      await wait(50);
    }
    const target = battle.enemies.find((enemy: any) => enemy.hp > 1) ?? battle.enemies[0];
    battle.damageEnemy(target.id, 1, 'Smoke');
    await wait(80);
    const state = JSON.parse(window.render_game_to_text!());
    const trees = [battle.root, battle.fxLayer].filter(Boolean);
    const calloutObjects = objectsFor(trees);
    return {
      combatFloatingCallout: state.combatFloatingCallout,
      count: countTexture(trees),
      calloutObjects,
    };
  });

  expect(result.combatFloatingCallout).toEqual({ loaded: true, rendered: true, count: result.count });
  expect(result.count).toBeGreaterThanOrEqual(1);
  expect(result.calloutObjects.every((frame: { name: string }) => frame.name === 'combat-floating-callout')).toBe(true);
  expect(result.calloutObjects.every((frame: { height: number }) => frame.height === 48)).toBe(true);
  expect(result.calloutObjects.every((frame: { width: number }) => frame.width >= 154 && frame.width <= 360)).toBe(true);
  expect(result.calloutObjects.every((frame: { alpha: number }) => frame.alpha >= 0.88 && frame.alpha <= 0.92)).toBe(true);
});

test('combat event log renders generated dossier frame', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[], key = 'ui-icon-combat-log-frame'): number => items.reduce((sum, child) => {
      const self = child.texture?.key === key ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, key) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatLogFrame?.loaded && state.combatLogFrame?.rendered && state.combatLogEventBead?.loaded) break;
      await wait(50);
    }
    battle.logEvent('Smoke test event log polish entry.');
    battle.renderAll();
    await wait(40);
    const state = JSON.parse(window.render_game_to_text!());
    const frameObjects = (battle.root?.list ?? battle.children.list)
      .filter((child: any) => child.texture?.key === 'ui-icon-combat-log-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const beadObjects = (battle.root?.list ?? battle.children.list)
      .filter((child: any) => child.texture?.key === 'ui-icon-combat-log-event-bead')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    return {
      combatLogFrame: state.combatLogFrame,
      combatLogEventBead: state.combatLogEventBead,
      frameObjects,
      frameCount: countTexture(battle.root?.list ?? battle.children.list),
      beadObjects,
      beadCount: countTexture(battle.root?.list ?? battle.children.list, 'ui-icon-combat-log-event-bead'),
      log: state.log,
    };
  });

  expect(result.combatLogFrame).toEqual({ loaded: true, rendered: true, count: result.frameCount });
  expect(result.combatLogEventBead).toEqual({ loaded: true, rendered: true, count: result.beadCount });
  expect(result.frameCount).toBe(1);
  expect(result.beadCount).toBeGreaterThanOrEqual(1);
  expect(result.frameObjects).toHaveLength(1);
  expect(result.frameObjects.every((frame: { width: number; height: number }) => frame.width === 390 && frame.height === 50)).toBe(true);
  expect(result.beadObjects.every((bead: { width: number; height: number }) => bead.width >= 18 && bead.width <= 22 && bead.height >= 18 && bead.height <= 22)).toBe(true);
  expect(result.beadObjects.every((bead: { alpha: number }) => bead.alpha >= 0.58 && bead.alpha <= 0.92)).toBe(true);
  expect(result.log).toContain('Smoke test event log polish entry.');
});

test('combat hover tooltip renders generated dossier frame', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatTooltipFrame?.loaded) break;
      await wait(50);
    }
    const tooltip = battle.buildTooltip('End Turn', 'Roost and let enemies act.', 1192, 470);
    await wait(40);
    const state = JSON.parse(window.render_game_to_text!());
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-tooltip-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const frameObjects = (tooltip?.list ?? [])
      .filter((child: any) => child.texture?.key === 'ui-icon-combat-tooltip-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    return {
      combatTooltipFrame: state.combatTooltipFrame,
      frameCount: countTexture(battle.root?.list ?? battle.children.list),
      frameObjects,
    };
  });

  expect(result.combatTooltipFrame).toEqual({ loaded: true, rendered: true, count: result.frameCount });
  expect(result.frameCount).toBe(1);
  expect(result.frameObjects).toEqual([
    expect.objectContaining({ name: 'combat-tooltip-frame', width: 260, alpha: 0.94 })
  ]);
});

test('combat hand renders generated support rail behind cards', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-hand-rail' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatHandRail?.loaded && state.combatHandRail?.rendered) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!());
    return {
      combatHandRail: state.combatHandRail,
      handSize: state.hand.length,
      railObjects: countTexture(battle.handLayer?.list ?? battle.children.list),
    };
  });

  expect(result.handSize).toBeGreaterThan(0);
  expect(result.combatHandRail).toEqual({ loaded: true, rendered: true, count: result.railObjects });
  expect(result.railObjects).toBeGreaterThanOrEqual(1);
});

test('combat hand cards render generated playable frames', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[], key = 'ui-icon-combat-hand-card-frame'): number => items.reduce((sum, child) => {
      const self = child.texture?.key === key ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, key) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatHandCardFrame?.loaded && state.combatHandCardFrame?.rendered) break;
      await wait(50);
    }
    const candidate = battle.hand.find((card: any) =>
      battle.activeCardContract(card).target === 'enemy' && battle.effectiveCost(card) <= battle.energy
    ) ?? battle.hand[0];
    const beforeFrame = battle.handCardFrames.get(candidate.instanceId);
    const before = beforeFrame ? { width: beforeFrame.displayWidth, height: beforeFrame.displayHeight, alpha: beforeFrame.alpha } : undefined;
    const beforePulse = battle.handCardSelectionPulses.get(candidate.instanceId);
    const beforePulseState = beforePulse ? { width: beforePulse.displayWidth, height: beforePulse.displayHeight, alpha: beforePulse.alpha } : undefined;
    battle.onCardClicked(candidate.instanceId);
    await wait(40);
    const afterFrame = battle.handCardFrames.get(candidate.instanceId);
    const after = afterFrame ? { width: afterFrame.displayWidth, height: afterFrame.displayHeight, alpha: afterFrame.alpha } : undefined;
    const afterPulse = battle.handCardSelectionPulses.get(candidate.instanceId);
    const afterPulseState = afterPulse ? { width: afterPulse.displayWidth, height: afterPulse.displayHeight, alpha: afterPulse.alpha } : undefined;
    const state = JSON.parse(window.render_game_to_text!());
    const pulseObjects = (battle.handLayer?.list ?? battle.children.list)
      .filter((child: any) => child.texture?.key === 'ui-icon-combat-hand-selected-pulse')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    return {
      combatHandCardFrame: state.combatHandCardFrame,
      combatHandSelectedPulse: state.combatHandSelectedPulse,
      handSize: state.hand.length,
      selectedCard: state.selectedCard,
      candidateId: candidate.instanceId,
      frameObjects: countTexture(battle.handLayer?.list ?? battle.children.list),
      pulseObjects: countTexture(battle.handLayer?.list ?? battle.children.list, 'ui-icon-combat-hand-selected-pulse'),
      visiblePulses: pulseObjects.filter((pulse: { alpha: number }) => pulse.alpha > 0),
      before,
      after,
      beforePulse: beforePulseState,
      afterPulse: afterPulseState,
    };
  });

  expect(result.handSize).toBeGreaterThan(0);
  expect(result.combatHandCardFrame).toEqual({ loaded: true, rendered: true, count: result.frameObjects });
  expect(result.combatHandSelectedPulse).toEqual({ loaded: true, rendered: true, count: result.pulseObjects });
  expect(result.frameObjects).toBeGreaterThanOrEqual(result.handSize);
  expect(result.pulseObjects).toBeGreaterThanOrEqual(result.handSize);
  expect(result.selectedCard).toBe(result.candidateId);
  expect(result.before?.alpha).toBeGreaterThanOrEqual(0.5);
  expect(result.before?.alpha).toBeLessThan(0.7);
  expect(result.after?.alpha).toBeGreaterThan(result.before?.alpha ?? 0);
  expect(result.after?.width).toBeGreaterThan(result.before?.width ?? 0);
  expect(result.after?.height).toBeGreaterThan(result.before?.height ?? 0);
  expect(result.beforePulse?.alpha).toBe(0);
  expect(result.afterPulse?.alpha).toBeGreaterThan(0.25);
  expect(result.afterPulse?.width).toBeGreaterThan(result.beforePulse?.width ?? 0);
  expect(result.afterPulse?.height).toBeGreaterThan(result.beforePulse?.height ?? 0);
  expect(result.visiblePulses).toHaveLength(1);
});

test('combat enemies render generated vitals frames behind HP bars', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-enemy-vitals-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatEnemyVitalsFrame?.loaded && state.combatEnemyVitalsFrame?.rendered) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!());
    return {
      combatEnemyVitalsFrame: state.combatEnemyVitalsFrame,
      livingEnemies: state.enemies.filter((enemy: { hp: number }) => enemy.hp > 0).length,
      frameObjects: countTexture(battle.root?.list ?? battle.children.list),
    };
  });

  expect(result.livingEnemies).toBeGreaterThan(0);
  expect(result.combatEnemyVitalsFrame).toEqual({ loaded: true, rendered: true, count: result.frameObjects });
  expect(result.frameObjects).toBeGreaterThanOrEqual(result.livingEnemies);
});

test('combat enemy status text renders generated condition chip frame', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const enemy = battle.enemies.find((candidate: any) => candidate.hp > 0);
    enemy.block = 7;
    enemy.weak = 2;
    battle.renderAll();
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-enemy-status-chip-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatEnemyStatusChipFrame?.loaded && state.combatEnemyStatusChipFrame?.rendered) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!());
    const stateEnemy = state.enemies.find((candidate: { id: string }) => candidate.id === enemy.id);
    return {
      combatEnemyStatusChipFrame: state.combatEnemyStatusChipFrame,
      enemyBlock: stateEnemy?.block,
      enemyWeak: stateEnemy?.weak,
      frameObjects: countTexture(battle.root?.list ?? battle.children.list),
    };
  });

  expect(result.enemyBlock).toBe(7);
  expect(result.enemyWeak).toBe(2);
  expect(result.combatEnemyStatusChipFrame).toEqual({ loaded: true, rendered: true, count: result.frameObjects });
  expect(result.frameObjects).toBe(1);
});

test('combat intro renders generated encounter plaque behind caption', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.stop('MenuScene');
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-encounter-plaque' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 120; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatEncounterPlaque?.loaded && state.combatEncounterPlaque?.rendered) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!());
    const plaqueObjects = countTexture([
      ...(battle.root?.list ?? []),
      ...(battle.fxLayer?.list ?? []),
    ]);
    return {
      combatEncounterPlaque: state.combatEncounterPlaque,
      combatEncounterIntro: state.combatEncounterIntro,
      plaqueObjects,
    };
  });

  expect(result.combatEncounterIntro.loaded).toBe(true);
  expect(result.combatEncounterPlaque).toEqual({ loaded: true, rendered: true, count: result.plaqueObjects });
  expect(result.plaqueObjects).toBeGreaterThanOrEqual(1);
});

test('combat supply feedback renders generated frame behind toast', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[], textureKey: string): number => items.reduce((sum, child) => {
      const self = child.texture?.key === textureKey ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, textureKey) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 60 && !(battle.enemies?.length && battle.hand?.length); i += 1) await wait(50);
    battle.runSupplies = ['seed_packet'];
    battle.runSuppliesUsed = [];
    battle.combatSupplyUseBurstBursts = 0;
    const supplyUseCueBefore = window.__birdSquadState!().audio?.cueRequests?.supplyUse ?? 0;
    battle.useSupply(0);
    for (let i = 0; i < 20; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (
        state.combatSupplyFeedbackFrame?.loaded
        && state.combatSupplyFeedbackFrame?.rendered
        && state.combatSupplyUseBurst?.loaded
        && state.combatSupplyUseBurst?.rendered
      ) break;
      await wait(25);
    }
    const state = JSON.parse(window.render_game_to_text!());
    const visibleObjects = [
      ...(battle.root?.list ?? []),
      ...(battle.fxLayer?.list ?? []),
    ];
    const frameObjects = countTexture(visibleObjects, 'ui-icon-combat-supply-feedback-frame');
    const burstObjects = countTexture(visibleObjects, 'combat-supply-use-burst');
    return {
      combatSupplyFeedbackFrame: state.combatSupplyFeedbackFrame,
      combatSupplyUseBurst: state.combatSupplyUseBurst,
      feedback: state.supplyFeedback?.[0],
      frameObjects,
      burstObjects,
      supplyUseCueBefore,
      supplyUseCueAfter: state.audio?.cueRequests?.supplyUse ?? 0,
    };
  });

  expect(result.feedback?.id).toBe('seed_packet');
  expect(result.combatSupplyFeedbackFrame).toEqual({ loaded: true, rendered: true, count: result.frameObjects });
  expect(result.frameObjects).toBeGreaterThanOrEqual(1);
  expect(result.combatSupplyUseBurst.loaded).toBe(true);
  expect(result.combatSupplyUseBurst.rendered).toBe(true);
  expect(result.combatSupplyUseBurst.count).toBe(result.burstObjects);
  expect(result.combatSupplyUseBurst.count).toBeGreaterThanOrEqual(1);
  expect(result.combatSupplyUseBurst.bursts).toBeGreaterThanOrEqual(1);
  expect(result.supplyUseCueAfter).toBeGreaterThan(result.supplyUseCueBefore);
});

test('combat waymark feedback renders generated frame behind toast', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const countTexture = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-waymark-feedback-frame' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list) : 0;
      return sum + self + nested;
    }, 0);
    for (let i = 0; i < 60 && !(battle.enemies?.length && battle.hand?.length); i += 1) await wait(50);
    battle.routeMarks = ['broken_cover_chime'];
    battle.markFiredThisTurn = new Set();
    battle.spark = 0;
    battle.checkEnemyCoverBrokenMarks();
    for (let i = 0; i < 20; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.combatWaymarkFeedbackFrame?.loaded && state.combatWaymarkFeedbackFrame?.rendered) break;
      await wait(25);
    }
    const state = JSON.parse(window.render_game_to_text!());
    const frameObjects = countTexture([
      ...(battle.root?.list ?? []),
      ...(battle.fxLayer?.list ?? []),
    ]);
    return {
      combatWaymarkFeedbackFrame: state.combatWaymarkFeedbackFrame,
      feedback: state.waymarkFeedback?.[0],
      frameObjects,
    };
  });

  expect(result.feedback?.id).toBe('broken_cover_chime');
  expect(result.combatWaymarkFeedbackFrame).toEqual({ loaded: true, rendered: true, count: result.frameObjects });
  expect(result.frameObjects).toBeGreaterThanOrEqual(1);
});

test('audio toggle renders generated wave burst feedback across game surfaces', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const findAudioHit = (items: any[], x: number, y: number): any | undefined => {
      for (const child of items ?? []) {
        if (
          child.type === 'Rectangle'
          && Math.round(child.x) === x
          && Math.round(child.y) === y
          && Math.round(child.width) === 58
          && Math.round(child.height) === 58
        ) {
          return child;
        }
        if (Array.isArray(child.list)) {
          const nested = findAudioHit(child.list, x, y);
          if (nested) return nested;
        }
      }
      return undefined;
    };
    const exercise = async (sceneKey: 'MenuScene' | 'RouteScene' | 'BattleScene', x: number, y: number, start: () => Promise<void>) => {
      await start();
      const scene: any = g.scene.getScene(sceneKey);
      for (let i = 0; i < 40; i += 1) {
        const state = JSON.parse(window.render_game_to_text!());
        if (state.audioToggleWaveBurst?.loaded && state.audioToggleWaveBurst?.count >= 1) break;
        await wait(50);
      }
      const before = JSON.parse(window.render_game_to_text!()).audioToggleWaveBurst;
      const hit = findAudioHit(scene.children.list, x, y);
      if (!hit) throw new Error(`Missing audio hit target for ${sceneKey}`);
      hit.emit('pointerdown');
      let during = JSON.parse(window.render_game_to_text!()).audioToggleWaveBurst;
      for (let i = 0; i < 12 && !during?.rendered; i += 1) {
        await wait(25);
        during = JSON.parse(window.render_game_to_text!()).audioToggleWaveBurst;
      }
      await wait(520);
      const after = JSON.parse(window.render_game_to_text!()).audioToggleWaveBurst;
      return { before, during, after };
    };
    return {
      menu: await exercise('MenuScene', 48, 38, async () => {
        await window.__birdSquadStartScene!('MenuScene');
      }),
      route: await exercise('RouteScene', 1246, 45, async () => {
        await window.__birdSquadStartScene!('RouteScene', {});
        g.scene.stop('MenuScene');
      }),
      battle: await exercise('BattleScene', 1246, 45, async () => {
        await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
        g.scene.stop('MenuScene');
        g.scene.stop('RouteScene');
      }),
    };
  });

  for (const surface of [result.menu, result.route, result.battle]) {
    expect(surface.before).toEqual({ loaded: true, rendered: false, count: 1, visible: 0 });
    expect(surface.during.loaded).toBe(true);
    expect(surface.during.count).toBe(1);
    expect(surface.during.rendered).toBe(true);
    expect(surface.during.visible).toBe(1);
    expect(surface.after).toEqual({ loaded: true, rendered: false, count: 1, visible: 0 });
  }
});

test('title screen fits landscape tablet viewport with all utility icons visible', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('MenuScene');
    const menu: any = g.scene.getScene('MenuScene');
    const collectTextureObjects = (children: any[], textureKey: string): any[] => {
      const found: any[] = [];
      for (const child of children ?? []) {
        if (child.texture?.key === textureKey) found.push(child);
        if (Array.isArray(child.list)) found.push(...collectTextureObjects(child.list, textureKey));
      }
      return found;
    };
    const expected = [
      'ui-icon-audio-toggle-medallion',
      'ui-icon-audio-toggle-pulse-ring',
      'ui-icon-help-medallion',
      'ui-icon-settings-medallion',
      'ui-icon-codex-medallion',
      'ui-icon-record-medallion',
      'ui-icon-start-run-medallion',
      'ui-icon-ascension-medallion',
      'ui-icon-leader-select-medallion',
      'ui-icon-leader-lock-medallion',
      'ui-icon-leader-ready-medallion',
      'ui-icon-title-utility-command-frame',
      'ui-icon-title-leader-card-frame',
      'ui-icon-title-leader-selected-flourish',
      'ui-icon-title-leader-header-frame',
      'ui-icon-title-start-command-frame',
      'ui-icon-title-home-command-dais',
      'ui-icon-title-logo-backplate',
      'ui-icon-title-ascension-plaque',
      'ui-icon-title-ascension-value-frame',
      'ui-icon-title-ascension-stepper-frame',
      'ui-icon-title-ascension-status-strip',
    ];
    for (let i = 0; i < 120; i += 1) {
      const ready = expected.every((key) => menu.textures.exists(key))
        && expected.every((key) => collectTextureObjects(menu.children.list, key).length > 0);
      if (ready) break;
      await wait(50);
    }
    for (let i = 0; i < 80; i += 1) {
      const composition = JSON.parse(window.render_game_to_text!()).titleComposition;
      if (composition?.logoWithinCanvas && composition?.hintWithinCanvas && composition?.clear) break;
      await wait(50);
    }
    const canvas = document.querySelector('canvas')?.getBoundingClientRect();
    const state = JSON.parse(window.render_game_to_text!());
    return {
      canvas: canvas ? {
        left: canvas.left,
        right: canvas.right,
        top: canvas.top,
        bottom: canvas.bottom,
        width: canvas.width,
        height: canvas.height,
      } : undefined,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      utilityIcons: expected.map((key) => ({
        key,
        loaded: menu.textures.exists(key),
        rendered: collectTextureObjects(menu.children.list, key).length > 0,
      })),
      titleAscensionStepperFrames: menu.children.list
        .filter((child: any) => child.texture?.key === 'ui-icon-title-ascension-stepper-frame')
        .map((child: any) => ({
          displayWidth: Math.round(child.displayWidth),
          displayHeight: Math.round(child.displayHeight),
          alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
          name: child.name,
          visible: child.visible,
        })),
      titleAscensionValueFrames: menu.children.list
        .filter((child: any) => child.texture?.key === 'ui-icon-title-ascension-value-frame')
        .map((child: any) => ({
          displayWidth: Math.round(child.displayWidth),
          displayHeight: Math.round(child.displayHeight),
          alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
          name: child.name,
          visible: child.visible,
        })),
      titleAscensionStatusStrips: menu.children.list
        .filter((child: any) => child.texture?.key === 'ui-icon-title-ascension-status-strip')
        .map((child: any) => ({
          displayWidth: Math.round(child.displayWidth),
          displayHeight: Math.round(child.displayHeight),
          alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
          name: child.name,
          visible: child.visible,
        })),
      titleLeaderHeaderFrames: menu.children.list
        .filter((child: any) => child.texture?.key === 'ui-icon-title-leader-header-frame')
        .map((child: any) => ({
          displayWidth: Math.round(child.displayWidth),
          displayHeight: Math.round(child.displayHeight),
          alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
          name: child.name,
          visible: child.visible,
        })),
      titleLeaderSelectedFlourishes: menu.children.list
        .filter((child: any) => child.texture?.key === 'ui-icon-title-leader-selected-flourish')
        .map((child: any) => ({
          displayWidth: Math.round(child.displayWidth),
          displayHeight: Math.round(child.displayHeight),
          alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
          name: child.name,
          visible: child.visible,
        })),
      titleLogoBackplates: collectTextureObjects(menu.children.list, 'ui-icon-title-logo-backplate')
        .map((child: any) => ({
          displayWidth: Math.round(child.displayWidth),
          displayHeight: Math.round(child.displayHeight),
          alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
          name: child.name,
          visible: child.visible,
        })),
      titleAscensionPlaque: state.titleAscensionPlaque,
      titleAscensionValueFrame: state.titleAscensionValueFrame,
      titleAscensionStepperFrame: state.titleAscensionStepperFrame,
      titleAscensionStatusStrip: state.titleAscensionStatusStrip,
      titleHomeCommandDais: state.titleHomeCommandDais,
      titleLogoBackplate: state.titleLogoBackplate,
      titleComposition: state.titleComposition,
      titleLeaderCardFrame: state.titleLeaderCardFrame,
      titleLeaderSelectedFlourish: state.titleLeaderSelectedFlourish,
      titleLeaderHeaderFrame: state.titleLeaderHeaderFrame,
      titleLeaderTooltipFrame: state.titleLeaderTooltipFrame,
      titleStartCommandFrame: state.titleStartCommandFrame,
      titleUtilityCommandFrame: state.titleUtilityCommandFrame,
      audioTogglePulseRing: state.audioTogglePulseRing,
      audioToggleWaveBurst: state.audioToggleWaveBurst,
      selectedDifficulty: state.selectedDifficulty,
      maxUnlockedDifficulty: state.maxUnlockedDifficulty,
    };
  });
  expect(result.canvas).toBeTruthy();
  expect(result.canvas!.left).toBeGreaterThanOrEqual(-1);
  expect(result.canvas!.right).toBeLessThanOrEqual(result.viewport.width + 1);
  expect(result.canvas!.top).toBeGreaterThanOrEqual(-1);
  expect(result.canvas!.bottom).toBeLessThanOrEqual(result.viewport.height + 1);
  expect(result.utilityIcons.filter((icon) => !icon.loaded || !icon.rendered)).toEqual([]);
  expect(result.titleAscensionPlaque.loaded).toBe(true);
  expect(result.titleAscensionPlaque.rendered).toBe(true);
  expect(result.titleAscensionValueFrame.loaded).toBe(true);
  expect(result.titleAscensionValueFrame.rendered).toBe(true);
  expect(result.titleAscensionValueFrame.count).toBe(1);
  expect(result.titleAscensionValueFrames).toHaveLength(1);
  expect(result.titleAscensionValueFrames[0]).toMatchObject({
    displayWidth: 190,
    displayHeight: 58,
    name: 'title-ascension-value-frame',
    visible: true,
  });
  expect(result.titleAscensionValueFrames[0].alpha).toBeGreaterThan(0.6);
  expect(result.titleAscensionStepperFrame.loaded).toBe(true);
  expect(result.titleAscensionStepperFrame.rendered).toBe(true);
  expect(result.titleAscensionStepperFrame.count).toBe(2);
  expect(result.titleAscensionStepperFrames).toHaveLength(2);
  for (const frame of result.titleAscensionStepperFrames) {
    expect(frame).toMatchObject({
      displayWidth: 46,
      displayHeight: 46,
      name: 'title-ascension-stepper-frame',
      visible: true,
    });
    expect(frame.alpha).toBeGreaterThan(0.7);
  }
  expect(result.titleAscensionStatusStrip.loaded).toBe(true);
  expect(result.titleAscensionStatusStrip.rendered).toBe(true);
  expect(result.titleAscensionStatusStrip.count).toBe(1);
  expect(result.titleAscensionStatusStrips).toHaveLength(1);
  expect(result.titleAscensionStatusStrips[0]).toMatchObject({
    displayWidth: 306,
    displayHeight: 58,
    name: 'title-ascension-status-strip',
    visible: true,
  });
  expect(result.titleAscensionStatusStrips[0].alpha).toBeGreaterThan(0.35);
  expect(result.titleHomeCommandDais.loaded).toBe(true);
  expect(result.titleHomeCommandDais.rendered).toBe(true);
  expect(result.titleHomeCommandDais.count).toBeGreaterThanOrEqual(1);
  expect(result.titleLogoBackplate.loaded).toBe(true);
  expect(result.titleLogoBackplate.rendered).toBe(true);
  expect(result.titleLogoBackplate.count).toBe(1);
  expect(result.titleLogoBackplates).toHaveLength(1);
  expect(result.titleLogoBackplates[0]).toMatchObject({
    displayWidth: 456,
    displayHeight: 171,
    name: 'title-logo-backplate',
    visible: true,
  });
  expect(result.titleLogoBackplates[0].alpha).toBeGreaterThan(0.3);
  expect(result.titleComposition).toMatchObject({
    logoWithinCanvas: true,
    hintWithinCanvas: true,
    clear: true,
  });
  expect(result.titleComposition.logo.top).toBeGreaterThanOrEqual(0);
  expect(result.titleComposition.hintBackdrop.top).toBeGreaterThan(result.titleComposition.logo.bottom);
  expect(result.titleComposition.hint.width).toBeGreaterThan(380);
  expect(result.titleLeaderCardFrame.loaded).toBe(true);
  expect(result.titleLeaderCardFrame.rendered).toBe(true);
  expect(result.titleLeaderCardFrame.count).toBeGreaterThanOrEqual(5);
  expect(result.titleLeaderSelectedFlourish.loaded).toBe(true);
  expect(result.titleLeaderSelectedFlourish.rendered).toBe(true);
  expect(result.titleLeaderSelectedFlourish.count).toBe(1);
  expect(result.titleLeaderSelectedFlourishes.filter((frame: any) => frame.visible)).toHaveLength(1);
  expect(result.titleLeaderSelectedFlourishes.some((frame: any) => (
    frame.name === 'title-leader-selected-flourish'
      && frame.displayWidth >= 236
      && frame.displayWidth <= 241
      && frame.displayHeight >= 82
      && frame.displayHeight <= 84
  ))).toBe(true);
  expect(result.titleLeaderSelectedFlourishes.find((frame: any) => frame.visible)?.alpha).toBeGreaterThan(0.7);
  expect(result.titleLeaderHeaderFrame.loaded).toBe(true);
  expect(result.titleLeaderHeaderFrame.rendered).toBe(true);
  expect(result.titleLeaderHeaderFrame.count).toBe(1);
  expect(result.titleLeaderHeaderFrames).toHaveLength(1);
  expect(result.titleLeaderHeaderFrames[0]).toMatchObject({
    displayWidth: 386,
    displayHeight: 80,
    name: 'title-leader-header-frame',
    visible: true,
  });
  expect(result.titleLeaderHeaderFrames[0].alpha).toBeGreaterThan(0.5);
  expect(result.titleLeaderTooltipFrame.loaded).toBe(true);
  expect(result.titleLeaderTooltipFrame.rendered).toBe(false);
  expect(result.titleLeaderTooltipFrame.count).toBe(0);
  expect(result.titleStartCommandFrame.loaded).toBe(true);
  expect(result.titleStartCommandFrame.rendered).toBe(true);
  expect(result.titleStartCommandFrame.count).toBeGreaterThanOrEqual(1);
  expect(result.titleUtilityCommandFrame.loaded).toBe(true);
  expect(result.titleUtilityCommandFrame.rendered).toBe(true);
  expect(result.titleUtilityCommandFrame.count).toBeGreaterThanOrEqual(4);
  expect(result.audioTogglePulseRing).toEqual({ loaded: true, rendered: true, count: 1 });
  expect(result.audioToggleWaveBurst).toEqual({ loaded: true, rendered: false, count: 1, visible: 0 });
  expect(result.selectedDifficulty).toBeGreaterThanOrEqual(0);
  expect(result.maxUnlockedDifficulty).toBeGreaterThanOrEqual(0);
});

test('title start run renders generated launch flourish before route transition', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    window.localStorage.removeItem('birdsquad.run.active');
    await window.__birdSquadStartScene!('MenuScene');
    const menu: any = g.scene.getScene('MenuScene');
    for (let i = 0; i < 40 && !menu.textures.exists('title-run-launch-flourish'); i += 1) await wait(50);
    menu.startRunAnimated(false, 780, 642, 286);
    await wait(160);
    const during = JSON.parse(window.render_game_to_text!());
    const activeDuring = g.scene.getScenes(true).map((scene: any) => scene.scene.key);
    const collectObjects = (children: any[], textureKey: string): any[] => {
      const found: any[] = [];
      for (const child of children ?? []) {
        if (child.texture?.key === textureKey) found.push(child);
        if (Array.isArray(child.list)) found.push(...collectObjects(child.list, textureKey));
      }
      return found;
    };
    const flourishObjects = collectObjects(menu.children.list, 'title-run-launch-flourish').map((obj: any) => ({
      displayWidth: Math.round(obj.displayWidth ?? 0),
      displayHeight: Math.round(obj.displayHeight ?? 0),
      alpha: Number(obj.alpha?.toFixed?.(3) ?? obj.alpha),
      name: obj.name,
      visible: obj.visible
    }));
    window.advanceTime!(1000);
    for (let i = 0; i < 30 && !g.scene.isActive('RouteScene'); i += 1) await wait(50);
    const route: any = g.scene.getScene('RouteScene');
    return {
      activeDuring,
      duringFlourish: during.titleRunLaunchFlourish,
      flourishObjects,
      routeActiveAfter: g.scene.isActive('RouteScene'),
      routeLeader: route.runState?.leaderId
    };
  });

  expect(result.activeDuring).toContain('MenuScene');
  expect(result.activeDuring).not.toContain('RouteScene');
  expect(result.duringFlourish).toMatchObject({
    loaded: true,
    rendered: true,
    pending: true,
    bursts: 1
  });
  expect(result.duringFlourish.count).toBeGreaterThanOrEqual(1);
  expect(result.flourishObjects.length).toBeGreaterThanOrEqual(1);
  expect(result.flourishObjects[0]).toMatchObject({ name: 'title-run-launch-flourish', visible: true });
  expect(result.flourishObjects[0].displayWidth).toBeGreaterThanOrEqual(430);
  expect(result.flourishObjects[0].displayHeight).toBeGreaterThanOrEqual(130);
  expect(result.flourishObjects[0].alpha).toBeGreaterThan(0.1);
  expect(result.routeActiveAfter).toBe(true);
  expect(result.routeLeader).toBe('fledgling');
});

test('title leader hover tooltip renders generated frame art', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const countTexture = (items: any[], key: string): number => items.reduce((sum, child) => {
      const self = child.texture?.key === key ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, key) : 0;
      return sum + self + nested;
    }, 0);
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('MenuScene');
    const menu: any = g.scene.getScene('MenuScene');
    for (let i = 0; i < 40; i += 1) {
      if (menu.textures.exists('ui-icon-title-leader-tooltip-frame')) break;
      await wait(50);
    }
    menu.showLeaderTooltip('fledgling', 178);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (state.titleLeaderTooltipFrame?.rendered) break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!());
    const frameObjects = (menu.leaderTooltip?.list ?? [])
      .filter((child: any) => child.texture?.key === 'ui-icon-title-leader-tooltip-frame')
      .map((child: any) => ({
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        name: child.name,
        visible: child.visible,
      }));
    const texts = (menu.leaderTooltip?.list ?? [])
      .filter((child: any) => child.type === 'Text')
      .map((child: any) => child.text);
    return {
      state: state.titleLeaderTooltipFrame,
      frameCount: countTexture(menu.leaderTooltip?.list ?? [], 'ui-icon-title-leader-tooltip-frame'),
      frameObjects,
      hasLeaderName: texts.some((text: string) => text.includes('The Fledgling Flock')),
      hasSignature: texts.some((text: string) => text.includes('Signature:')),
    };
  });

  expect(result.state).toEqual({ loaded: true, rendered: true, count: result.frameCount });
  expect(result.frameObjects).toHaveLength(1);
  expect(result.frameObjects[0]).toMatchObject({
    displayWidth: 704,
    displayHeight: 126,
    name: 'title-leader-tooltip-frame',
    visible: true,
  });
  expect(result.frameObjects[0].alpha).toBeGreaterThan(0.7);
  expect(result.hasLeaderName).toBe(true);
  expect(result.hasSignature).toBe(true);
});

test('keyword hover tooltip renders generated dossier frame', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const countTexture = (items: any[], key: string): number => items.reduce((sum, child) => {
      const self = child.texture?.key === key ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, key) : 0;
      return sum + self + nested;
    }, 0);
    const collectObjects = (items: any[]): any[] => {
      const out: any[] = [];
      const visit = (node: any) => {
        if (!node) return;
        out.push(node);
        if (Array.isArray(node.list)) node.list.forEach(visit);
      };
      items.forEach(visit);
      return out;
    };
    const g = window.__birdSquadGame;
    const account = JSON.parse(window.localStorage.getItem('birdsquad.account') || '{}');
    account.discoveredCards = Array.from(new Set([...(account.discoveredCards ?? []), 'pentacles_04']));
    window.localStorage.setItem('birdsquad.account', JSON.stringify(account));
    await window.__birdSquadStartScene!('CodexScene');
    g.scene.stop('MenuScene');
    const codex: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 40; i += 1) {
      if (codex.textures.exists('ui-icon-keyword-tooltip-frame')) break;
      await wait(50);
    }
    codex.detailId = 'pentacles_04';
    codex.detailScroll = 0;
    codex.renderAll();
    await wait(500);
    const keyword = collectObjects(codex.root?.list ?? [])
      .filter((child: any) => child.type === 'Text' && child.input)
      .find((child: any) => /^(Cover|Cohesion|Energy|Draw|Wingbeat|Keystone)$/i.test(child.text ?? '')
        && (child.listenerCount?.('pointerover') ?? 0) > 0);
    const hookResult = window.__birdSquadShowKeywordTooltip!('CodexScene', 'Cover', 760, 304);
    await wait(20);
    const state = JSON.parse(window.render_game_to_text!()).keywordTooltipFrame;
    const frameObjects = collectObjects(codex.children.list)
      .filter((child: any) => child.texture?.key === 'ui-icon-keyword-tooltip-frame')
      .map((child: any) => ({
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        name: child.name,
        visible: child.visible,
      }));
    const texts = collectObjects(codex.children.list)
      .filter((child: any) => child.type === 'Text')
      .map((child: any) => child.text);
    return {
      hasKeyword: !!keyword,
      hookResult,
      state,
      sceneCount: codex.keywordTooltipFrameCount ?? 0,
      frameCount: countTexture(codex.children.list, 'ui-icon-keyword-tooltip-frame'),
      frameObjects,
      hasDefinitionText: texts.some((text: string) => /Temporary shielding|flock's health|resource/i.test(text)),
    };
  });

  expect(result.hasKeyword).toBe(true);
  expect(result.hookResult).toMatchObject({ shown: true, loaded: true, count: 1 });
  expect(result.state.loaded).toBe(true);
  expect(result.hookResult.frame).toMatchObject({
    displayWidth: 288,
    name: 'keyword-tooltip-frame',
    visible: true,
  });
  expect(result.hookResult.frame?.displayHeight).toBeGreaterThanOrEqual(70);
  expect(result.hookResult.frame?.alpha).toBeGreaterThan(0.9);
  expect(result.hasDefinitionText).toBe(true);
});

test('selecting a Flock Leader sets the run starter deck', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    // Unlock every Leader, then re-enter the menu so its gating re-reads the account.
    window.localStorage.setItem('birdsquad.account', JSON.stringify({
      runs: 0, wins: 0, losses: 0, winsByLeader: {}, bestWinTier: -1, fastestWinTurns: null,
      unlockedLeaders: ['fledgling', 'spark_caller', 'talon', 'tidewarden', 'roostkeeper'], achievements: [],
    }));
    await window.__birdSquadStartScene!('MenuScene');
    await wait(150);
    let menu: any = g.scene.getScene('MenuScene');
    for (let i = 0; i < 80 && !menu.leaderPanels?.every((entry: any) => entry.selectedIcon); i += 1) {
      await wait(50);
      menu = g.scene.getScene('MenuScene');
    }
    menu.selectLeader('roostkeeper'); // Nests/cover archetype
    const readyBadges = menu.leaderPanels
      .filter((entry: any) => entry.selectedIcon?.visible)
      .map((entry: any) => entry.id);
    menu.startRun();
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 20 && route.runState?.leaderId !== 'roostkeeper'; i += 1) await wait(50);
    const deck = (route.runState?.deck ?? []).map((c: any) => c.id);
    return {
      leaderId: route.runState?.leaderId,
      readyBadges,
      size: deck.length,
      unique: new Set(deck).size,
      nests: deck.filter((id: string) => id.startsWith('pentacles')).length,
    };
  });
  expect(r.leaderId).toBe('roostkeeper');
  expect(r.readyBadges).toEqual(['roostkeeper']);
  expect(r.size).toBe(10);
  expect(r.unique).toBe(10); // singleton: every card is unique (no duplicates)
  expect(r.nests).toBeGreaterThanOrEqual(4); // a Nests-biased starter
});

test('an active run is checkpointed to storage and can be continued', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const menu: any = g.scene.getScene('MenuScene');
    menu.selectLeader('spark_caller');
    menu.startRun();
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 120 && !route.routeEssentialAssetsReady; i += 1) await wait(50);
    // Mutate to a recognizable mid-run state and re-checkpoint.
    route.runState.scrap = 777;
    route.runState.completedRouteNodeIds = ['x'];
    const objectiveTypes = ['priority', 'preserve_flow', 'swift_clear', 'clean_roost', 'finish_guarded', 'no_damage', 'trigger_surge', 'bank_wingbeat', 'block_damage'];
    route.runState.combatResults = objectiveTypes.map((type: string, index: number) => ({
      encounterId: `save-${index}`,
      nodeId: `save-node-${index}`,
      nodeType: 'street',
      enemyIds: [],
      turnsTaken: 2,
      damageDealt: 4,
      cohesionLost: 0,
      damageTakenByMove: [{
        enemyId: 'checkpoint-enemy', moveId: `checkpoint-move-${index}`, moveLabel: 'Checkpoint Strike',
        damageTaken: index + 1, blockedDamage: 3, hitCount: 1
      }],
      objective: { type, title: type, status: 'complete', bonusScrap: 12 },
      decisionStats: {
        cardsPlayed: 2, overextensions: 0, lowCardTurns: 1, noOverextensionTurns: 1,
        turnEnds: 1, cardsHeldAtRoost: 0, unspentWingbeatAtRoost: 1,
        maxCardsPlayedTurn: 2, waymarksAtStart: 0, waymarksAtEnd: 0,
        surgesTriggered: 1, blockedDamage: 9, invalidActions: 4, cancelledActions: 2
      }
    }));
    route.renderAll();
    const saved = JSON.parse(window.localStorage.getItem('birdsquad.run.active') || 'null');
    // Return to the menu and Continue.
    await window.__birdSquadStartScene!('MenuScene');
    await wait(150);
    (g.scene.getScene('MenuScene') as any).continueRun();
    const route2: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 20 && route2.runState?.scrap !== 777; i += 1) await wait(50);
    return {
      savedScrap: saved?.scrap, savedLeader: saved?.leaderId,
      resumedScrap: route2.runState?.scrap, resumedLeader: route2.runState?.leaderId,
      resumedProgress: route2.runState?.completedRouteNodeIds?.length,
      resumedObjectives: route2.runState?.combatResults?.map((result: any) => result.objective?.type),
      resumedBlockedDamage: route2.runState?.combatResults?.[0]?.decisionStats?.blockedDamage,
      resumedInvalidActions: route2.runState?.combatResults?.[0]?.decisionStats?.invalidActions,
      resumedCancelledActions: route2.runState?.combatResults?.[0]?.decisionStats?.cancelledActions,
      resumedMovePressure: route2.runState?.combatResults?.[0]?.damageTakenByMove,
    };
  });
  expect(r.savedScrap).toBe(777);
  expect(r.savedLeader).toBe('spark_caller');
  expect(r.resumedScrap).toBe(777);
  expect(r.resumedLeader).toBe('spark_caller');
  expect(r.resumedProgress).toBe(1);
  expect(r.resumedObjectives).toEqual(['priority', 'preserve_flow', 'swift_clear', 'clean_roost', 'finish_guarded', 'no_damage', 'trigger_surge', 'bank_wingbeat', 'block_damage']);
  expect(r.resumedBlockedDamage).toBe(9);
  expect(r.resumedInvalidActions).toBe(4);
  expect(r.resumedCancelledActions).toBe(2);
  expect(r.resumedMovePressure).toEqual([{
    enemyId: 'checkpoint-enemy',
    moveId: 'checkpoint-move-0',
    moveLabel: 'Checkpoint Strike',
    damageTaken: 1,
    blockedDamage: 3,
    hitCount: 1
  }]);
});

test('corrupt or missing primary saves recover the Flock Record and active flight from mirrored checkpoints', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    window.localStorage.setItem('birdsquad.account', JSON.stringify({
      runs: 4,
      wins: 2,
      losses: 2,
      winsByLeader: { fledgling: 2 },
      runsByLeader: { fledgling: 4 },
      bestWinTier: 2,
      fastestWinTurns: 7,
      unlockedLeaders: ['fledgling', 'spark_caller', 'talon'],
      achievements: ['first_flight'],
      discoveredCards: ['major_00'],
      observedEnemyMoves: ['roof_rat:scrap_swipe'],
      contractBadges: ['0:clean_flight'],
      leaderProgress: { fledgling: { surges: 5, cleanFights: 2, swiftFights: 1, blockedDamage: 12, contracts: 1 } },
      leaderRecords: {
        fledgling: {
          clears: {
            'full:2': { wins: 1, fastestRunTurns: 42 },
            'quick:0': { wins: 2, fastestRunTurns: 24 },
          }
        }
      },
    }));
    window.localStorage.removeItem('birdsquad.maxTier');
    await window.__birdSquadStartScene!('MenuScene');
    await wait(180);
    const menu: any = g.scene.getScene('MenuScene');
    menu.startRun();
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 120 && !route.routeEssentialAssetsReady; i += 1) await wait(50);
    route.runState.scrap = 777;
    route.runState.completedRouteNodeIds = ['recovery-checkpoint'];
    route.renderAll();
    const accountBackupBefore = window.localStorage.getItem('birdsquad.account.backup');
    const runBackupBefore = window.localStorage.getItem('birdsquad.run.active.backup');

    window.localStorage.setItem('birdsquad.account', '{damaged-account');
    window.localStorage.removeItem('birdsquad.run.active');
    await window.__birdSquadStartScene!('MenuScene');
    for (let i = 0; i < 80; i += 1) {
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      if (state.storageRecovery?.rendered) break;
      await wait(50);
    }
    const menuState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const recoveredAccount = JSON.parse(window.localStorage.getItem('birdsquad.account') ?? '{}');
    const recoveredRun = JSON.parse(window.localStorage.getItem('birdsquad.run.active') ?? '{}');
    const recoveryObjects = (g.scene.getScene('MenuScene') as any).children.list
      .filter((child: any) => child.name === 'storage-recovery-notice').length;
    (g.scene.getScene('MenuScene') as any).continueRun();
    const resumed: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 40 && resumed.runState?.scrap !== 777; i += 1) await wait(50);
    return {
      accountBackupBefore,
      runBackupBefore,
      recovery: menuState.storageRecovery,
      recoveryObjects,
      recoveredAccount,
      recoveredRun,
      maxUnlockedDifficulty: menuState.maxUnlockedDifficulty,
      resumedScrap: resumed.runState?.scrap,
      resumedProgress: resumed.runState?.completedRouteNodeIds,
    };
  });

  expect(result.accountBackupBefore).not.toBeNull();
  expect(result.runBackupBefore).not.toBeNull();
  expect(result.recovery).toMatchObject({ outcome: 'recovered', rendered: true });
  expect(result.recovery.scopes).toEqual(expect.arrayContaining(['Flock Record', 'flight checkpoint']));
  expect(result.recoveryObjects).toBe(3);
  expect(result.recoveredAccount).toMatchObject({
    runs: 4,
    wins: 2,
    bestWinTier: 2,
    leaderRecords: {
      fledgling: {
        clears: {
          'full:2': { wins: 1, fastestRunTurns: 42 },
          'quick:0': { wins: 2, fastestRunTurns: 24 },
        }
      }
    }
  });
  expect(result.recoveredRun).toMatchObject({ scrap: 777, completedRouteNodeIds: ['recovery-checkpoint'] });
  expect(result.maxUnlockedDifficulty).toBe(3);
  expect(result.resumedScrap).toBe(777);
  expect(result.resumedProgress).toEqual(['recovery-checkpoint']);
});

test('invalid active run saves are ignored instead of crashing Continue', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    window.localStorage.setItem('birdsquad.run.active', JSON.stringify({
      deck: [{ id: 'missing_card' }],
      leaderId: 'missing_leader',
      currentHp: 36,
      scrap: 40,
      routeMarks: [],
      supplies: [],
      mapIndex: 0,
      completedRouteNodeIds: [],
      routeLog: []
    }));
    await window.__birdSquadStartScene!('MenuScene');
    await wait(150);
    const active = g.scene.getScenes(true).map((s: any) => s.scene.key);
    return {
      active,
      savedAfterMenu: window.localStorage.getItem('birdsquad.run.active'),
      quarantined: window.localStorage.getItem('birdsquad.run.active.corrupt'),
    };
  });
  expect(r.active).toContain('MenuScene');
  expect(r.savedAfterMenu).toBeNull();
  expect(r.quarantined).toContain('missing_card');
  await expect.poll(async () => page.evaluate(() => {
    const menuState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return menuState.storageRecovery;
  })).toMatchObject({ outcome: 'reset', scopes: ['flight checkpoint'], rendered: true });
});

test('Ascension difficulty scales enemy Cohesion and narrows card rewards', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const mk = (difficulty: number) => ({
      deck: [{ id: 'major_07' }], leaderId: 'fledgling', difficulty, currentHp: 36, scrap: 0,
      routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [], currentRouteNodeId: undefined,
      routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
    });
    await window.__birdSquadStartScene!('BattleScene', { runState: mk(0), routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    await wait(250);
    const base = (g.scene.getScene('BattleScene') as any).enemies[0].maxHp;
    await window.__birdSquadStartScene!('BattleScene', { runState: mk(5), routeNodeId: 'm1_entry' });
    await wait(250);
    const scene: any = g.scene.getScene('BattleScene');
    return { base, scaled: scene.enemies[0].maxHp, rewardCount: scene.createRewardChoices().length };
  });
  expect(r.scaled).toBeGreaterThan(r.base); // +30% enemy Cohesion at tier 5
  expect(r.rewardCount).toBe(2); // tier >= 2 narrows rewards from 3 to 2
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
  await boot(page);
  const r = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
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
      hasBossPrepState: Boolean(state.bossPrep),
      hasInspectorSummary: texts.includes('BOSS PREP')
    };
  });
  expect(r.bossName).toBeTruthy();
  expect(r.pressure).toContain('cover');
  expect(['low', 'steady', 'strong']).toContain(r.readiness.cover);
  expect(Array.isArray(r.usefulNodes)).toBe(true);
  expect(r.hasBossPrepState).toBe(true);
  expect(r.flourishLoaded).toBe(true);
  expect(r.bossPrepDossier.loaded).toBe(true);
  expect(r.bossPrepDossier.rendered).toBe(true);
  expect(r.bossPrepReadinessChipFrame.loaded).toBe(true);
  expect(r.bossPrepReadinessChipFrame.rendered).toBe(true);
  expect(r.bossPrepReadinessChipFrame.count).toBe(4);
  expect(r.chipFrameCount).toBe(4);
  expect(r.bossPrepPressurePlaque.loaded).toBe(true);
  expect(r.bossPrepPressurePlaque.rendered).toBe(true);
  expect(r.bossPrepPressurePlaque.count).toBe(1);
  expect(r.pressurePlaqueCount).toBe(1);
  expect(r.bossPrepSignalModule.loaded).toBe(true);
  expect(r.bossPrepSignalModule.rendered).toBe(true);
  expect(r.bossPrepSignalModule.count).toBe(1);
  expect(r.signalModuleCount).toBe(1);
  expect(r.bossPrepRouteForPlate.loaded).toBe(true);
  expect(r.bossPrepRouteForPlate.rendered).toBe(true);
  expect(r.bossPrepRouteForPlate.count).toBe(1);
  expect(r.routeForPlateCount).toBe(1);
  expect(r.dossierRendered).toBe(true);
  expect(r.hasInspectorSummary).toBe(true);
});

test('combat tracks per-fight stats (damage dealt / taken / blocked)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];
    scene.damageEnemy(enemy.id, 5, 'Test');
    scene.resolveEnemyEffect(enemy, 'damage(flock, 6)');
    return { dealt: scene.statDealt, taken: scene.statTaken + scene.statBlocked };
  });
  expect(r.dealt).toBeGreaterThanOrEqual(5);
  expect(r.taken).toBeGreaterThanOrEqual(1);
});

test('a defeat emits a local run-summary artifact', async ({ page }) => {
  await boot(page);
  const run = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !scene.flock; i += 1) await wait(50); // create() runs a tick after start
    scene.runCombatResults = [{
      encounterId: 'enc_prior', nodeId: 'prior-node', nodeType: 'street', enemyIds: ['prior-enemy'],
      turnsTaken: 3, damageDealt: 12, cohesionLost: 2,
      damageTakenByMove: [{
        enemyId: 'prior-enemy', moveId: 'prior_move', moveLabel: 'Prior Move',
        damageTaken: 2, blockedDamage: 3, hitCount: 1
      }],
      decisionStats: {
        cardsPlayed: 5, overextensions: 0, lowCardTurns: 1, noOverextensionTurns: 2,
        turnEnds: 3, cardsHeldAtRoost: 1, unspentWingbeatAtRoost: 0,
        maxCardsPlayedTurn: 3, waymarksAtStart: 0, waymarksAtEnd: 1,
        invalidActions: 3, cancelledActions: 2
      }
    }];
    scene.completedRouteNodeIds = ['prior-node'];
    scene.turn = 4;
    scene.runScrapEarned = 120;
    scene.runScrapSpent = 45;
    scene.runRouteDecisions = [{ offered: ['m1_entry', 'm1_cache'], picked: 'm1_entry', decisionMs: 2300 }];
    scene.runRewardEvents = [{ offered: ['wands_02', 'cups_02'], picked: 'wands_02', skipped: false, decisionMs: 1700 }];
    scene.runStartedAtMs = Date.now() - 8000;
    scene.scrap = 115;
    scene.combatAnimationPending = false;
    scene.mode = 'battle';
    const targetedCard = scene.hand.find((card: any) => (
      scene.activeCardContract(card).target === 'enemy' && scene.effectiveCost(card) <= scene.energy
    ));
    if (!targetedCard) throw new Error('No targeted card was available for input telemetry.');
    scene.onCardClicked(targetedCard.instanceId);
    scene.onCardClicked(targetedCard.instanceId);
    scene.onCardClicked('missing-card-instance');
    scene.onEnemyClicked('missing-enemy-id');
    scene.flock.hp = 1;
    scene.flock.block = 0;
    scene.resolveEnemyEffect(scene.enemies[0], 'damage(flock, 20)', 'Review Strike');
    scene.checkOutcome();
    return window.__birdSquadLastRun;
  });
  expect(run.result).toBe('loss');
  expect(run.killedBy).toBe('Review Strike');
  expect(run.deck.length).toBeGreaterThan(0);
  expect(run.mapId).toBe('map_01_rooftop_blocks');
  expect(run.combatResults.length).toBeGreaterThan(0);
  expect(run.combatResults.some((combat: any) => combat.encounterId === 'enc_roof_rat')).toBe(true);
  expect(run.combatResults.at(-1).objective).toBeUndefined();
  expect(run.combatResults.at(-1).killedByMove).toBe('Review Strike');
  expect(run.combatResults.at(-1).durationMs).toBeGreaterThan(0);
  expect(run.combatResults.at(-1).cohesionLost).toBe(1);
  expect(run.combatResults.at(-1).damageTakenByMove).toContainEqual(expect.objectContaining({
    enemyId: 'roof_rat',
    moveLabel: 'Review Strike',
    damageTaken: 1,
    blockedDamage: 0,
    hitCount: 1
  }));
  expect(run.combatResults[0].damageTakenByMove).toEqual([{
    enemyId: 'prior-enemy',
    moveId: 'prior_move',
    moveLabel: 'Prior Move',
    damageTaken: 2,
    blockedDamage: 3,
    hitCount: 1
  }]);
  expect(run.turnsTaken).toBe(7);
  expect(run.scrapEarned).toBe(120);
  expect(run.scrapSpent).toBe(45);
  expect(run.finalScrap).toBe(115);
  expect(run.durationMs).toBeGreaterThanOrEqual(7000);
  expect(run.routeDecisions[0]).toEqual({ offered: ['m1_entry', 'm1_cache'], picked: 'm1_entry', decisionMs: 2300 });
  expect(run.cardRewards[0].decisionMs).toBe(1700);
  expect(run.combatPace).toBe('standard');
  expect(run.firstFlightGuide).toBeTruthy();
  expect(run.decisionStats.cardsPlayed).toBeGreaterThanOrEqual(5);
  expect(run.decisionStats.invalidActions).toBe(5);
  expect(run.decisionStats.cancelledActions).toBe(3);
  expect(Array.isArray(run.suppliesUsed)).toBe(true);
});

test('outcome replay preserves the flight seed and setup through keyboard confirmation', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('RouteScene');
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    const runState = {
      ...route.runState,
      leaderId: 'spark_caller',
      difficulty: 2,
      runMode: 'quick',
      seed: 'replay-flight-42',
      completedRouteNodeIds: ['m1_entry'],
      currentRouteNodeId: 'm1_entry',
      routeLog: ['Prior flight progress'],
      scrap: 88
    };
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry', runState });
    g.scene.stop('RouteScene');
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && !battle.fxLayer?.active; i += 1) await wait(50);
    battle.mode = 'defeat';
    battle.emitRunSummary('loss');
    battle.controllerChoiceIndex = 0;
    battle.renderAll();
    const outcomeTexts = battle.root.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text);
    battle.input.keyboard.emit('keydown-ENTER');
    const replayRoute: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 40 && replayRoute.runState?.seed !== 'replay-flight-42'; i += 1) await wait(50);
    return {
      flightCodeVisible: outcomeTexts.some((text: string) => text.includes('FLIGHT replay-flight-42')),
      replay: {
        leaderId: replayRoute.runState.leaderId,
        difficulty: replayRoute.runState.difficulty,
        runMode: replayRoute.runState.runMode,
        seed: replayRoute.runState.seed,
        mapIndex: replayRoute.runState.mapIndex,
        completedRouteNodeIds: replayRoute.runState.completedRouteNodeIds,
        currentRouteNodeId: replayRoute.runState.currentRouteNodeId,
        scrap: replayRoute.runState.scrap
      }
    };
  });
  expect(result.flightCodeVisible).toBe(true);
  expect(result.replay).toMatchObject({
    leaderId: 'spark_caller',
    difficulty: 2,
    runMode: 'quick',
    seed: 'replay-flight-42',
    mapIndex: 0,
    completedRouteNodeIds: [],
    scrap: 40
  });
  expect(result.replay.currentRouteNodeId).toBeUndefined();
});

test('witnessed boss tactics persist into outcome goals and Codex dossier progress', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    window.localStorage.removeItem('birdsquad.account');
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && !battle.flock; i += 1) await wait(50);
    battle.runSeenEnemyMoves = new Set(['tar_crowned_crow:toll_line']);
    battle.mode = 'defeat';
    battle.emitRunSummary('loss');
    battle.renderAll();
    for (let i = 0; i < 80 && !battle.getTextState().unlockHighlights?.items?.length; i += 1) await wait(50);
    battle.renderAll();
    const outcomeState = battle.getTextState();
    const outcomeTexts = battle.root.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
    const accountAfterFirst = JSON.parse(window.localStorage.getItem('birdsquad.account') ?? '{}');

    await window.__birdSquadStartScene!('CodexScene');
    g.scene.stop('BattleScene');
    const codex: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 40 && !codex.root; i += 1) await wait(50);
    codex.activeSection = 'enemies';
    codex.detailId = 'tar_crowned_crow';
    codex.renderAll();
    let codexState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    for (let i = 0; i < 80 && codexState.bossDossier?.observed !== 1; i += 1) {
      await wait(50);
      codexState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    }
    const codexTexts = codex.root.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
    return {
      persisted: accountAfterFirst.observedEnemyMoves,
      summaryMoves: window.__birdSquadLastRun?.seenEnemyMoves,
      unlocks: outcomeState.unlockHighlights.items,
      nextGoal: outcomeTexts.find((text: string) => text.startsWith('NEXT FLIGHT')) ?? '',
      dossier: codexState.bossDossier,
      observedText: codexTexts.find((text: string) => text.includes('Toll Line')) ?? '',
      hiddenCount: codexTexts.filter((text: string) => text.includes('Undocumented tactic')).length,
      progressHeading: codexTexts.find((text: string) => text.includes('COMBAT KIT')) ?? ''
    };
  });
  expect(result.persisted).toEqual(['tar_crowned_crow:toll_line']);
  expect(result.summaryMoves).toContain('tar_crowned_crow:toll_line');
  expect(result.unlocks).toContainEqual(expect.objectContaining({
    id: 'dossier:tar_crowned_crow',
    kind: 'dossier',
    name: 'The Tar-Crowned Crow Dossier'
  }));
  expect(result.nextGoal).toContain('Witness 4 more tactics');
  expect(result.dossier).toEqual({ enemyId: 'tar_crowned_crow', observed: 1, total: 5 });
  expect(result.observedText).toContain('Toll Line');
  expect(result.hiddenCount).toBe(4);
  expect(result.progressHeading).toContain('1 OF 5 OBSERVED');
});

test('Codex card collections expose discovery milestones and feed the next-flight goal', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const discoveredCards = ['wands_ace', 'wands_02', 'wands_03'];
    window.localStorage.setItem('birdsquad.account', JSON.stringify({ discoveredCards }));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('CodexScene');
    g.scene.stop('MenuScene');
    const codex: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 40 && !codex.root; i += 1) await wait(50);
    codex.activeSection = 'cards';
    codex.activeTab = 2;
    codex.renderAll();
    let codexState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    for (let i = 0; i < 80 && !codexState.cardCollection; i += 1) {
      await wait(50);
      codexState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    }
    const railCount = codex.root.list.filter((child: any) => child.name === 'codex-card-collection-rail').length;
    const codexTexts = codex.root.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');

    g.scene.stop('CodexScene');
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && !battle.flock; i += 1) await wait(50);
    window.localStorage.setItem('birdsquad.account', JSON.stringify({ discoveredCards }));
    battle.mode = 'defeat';
    battle.emitRunSummary('loss');
    battle.renderAll();
    let outcomeTexts: string[] = [];
    for (let i = 0; i < 80; i += 1) {
      outcomeTexts = battle.root.list
        .map((child: any) => child.text)
        .filter((text: unknown): text is string => typeof text === 'string');
      if (outcomeTexts.some((text) => text.includes('PLUMES TRAIL MARK'))) break;
      await wait(50);
    }
    return {
      collection: codexState.cardCollection,
      railCount,
      collectionHeading: codexTexts.find((text) => text.includes('PLUMES COLLECTION')) ?? '',
      nextGoal: outcomeTexts.find((text) => text.startsWith('NEXT FLIGHT')) ?? ''
    };
  });
  expect(result.collection).toMatchObject({
    id: 'plumes',
    name: 'Plumes',
    found: 3,
    total: 14,
    stage: 'Uncharted',
    nextMilestone: 'Trail Mark',
    nextTarget: 4,
    complete: false
  });
  expect(result.railCount).toBe(1);
  expect(result.collectionHeading).toContain('PLUMES COLLECTION');
  expect(result.nextGoal).toContain('PLUMES TRAIL MARK');
  expect(result.nextGoal).toContain('Discover 1 more card');
});

test('outcome flight codes copy a shared route link that launches the same seed and length', async ({ page }) => {
  await boot(page);
  const copied = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value: string) => window.localStorage.setItem('test.sharedRouteLink', value) }
    });
    await window.__birdSquadStartScene!('RouteScene');
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    const runState = { ...route.runState, seed: 'shared-rooftop-7', runMode: 'quick' };
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry', runState });
    g.scene.stop('RouteScene');
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && !battle.fxLayer?.active; i += 1) await wait(50);
    battle.mode = 'defeat';
    battle.emitRunSummary('loss');
    battle.renderAll();
    const collectObjects = (children: any[]): any[] => children.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collectObjects(child.list) : [])
    ]);
    let flightCode: any;
    for (let i = 0; i < 80 && !flightCode; i += 1) {
      flightCode = collectObjects(battle.root?.list ?? []).find((child: any) => child.text?.includes('COPY ROUTE LINK'));
      if (!flightCode) await wait(50);
    }
    if (!flightCode) return {
      link: '',
      feedback: collectObjects(battle.root?.list ?? [])
        .map((child: any) => child.text)
        .filter((text: unknown): text is string => typeof text === 'string')
        .join(' || ')
    };
    flightCode.emit('pointerdown');
    for (let i = 0; i < 40 && !flightCode.text.includes('LINK COPIED'); i += 1) await wait(25);
    return {
      link: window.localStorage.getItem('test.sharedRouteLink') ?? '',
      feedback: flightCode.text
    };
  });
  expect(copied.link, copied.feedback).not.toBe('');
  const copiedUrl = new URL(copied.link);
  expect(copiedUrl.searchParams.get('flight')).toBe('shared-rooftop-7');
  expect(copiedUrl.searchParams.get('length')).toBe('quick');
  expect(copied.feedback).toContain('LINK COPIED');

  await boot(page, `${copiedUrl.pathname}${copiedUrl.search}`);
  const launched = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const menuState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    const startLabelVisible = menu.children.list.some((child: any) => child.text === 'Fly Shared Route');
    menu.startRun();
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    for (let i = 0; i < 40 && route.runState?.seed !== 'shared-rooftop-7'; i += 1) await wait(50);
    return {
      menuState,
      seed: route.runState.seed,
      runMode: route.runState.runMode,
      startLabelVisible
    };
  });
  expect(launched.menuState.sharedRoute).toEqual({ seed: 'shared-rooftop-7', runMode: 'quick' });
  expect(launched.menuState.selectedRunMode).toBe('quick');
  expect(launched.startLabelVisible).toBe(true);
  expect(launched.seed).toBe('shared-rooftop-7');
  expect(launched.runMode).toBe('quick');
});

test('run-complete outcome celebrates fresh meta progress with a record strip', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    window.localStorage.removeItem('birdsquad.account');
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !scene.flock; i += 1) await wait(50);
    scene.flock.hp = Math.max(scene.flock.hp, 36);
    scene.turn = 4;
    scene.runDistrictContracts = [{
      mapIndex: 0,
      id: 'hold_line',
      baselineCombatResults: 0,
      baselineRewardEvents: 0,
      baselineSnags: 0,
      completed: true
    }];
    scene.mode = 'runComplete';
    scene.emitRunSummary('win');
    scene.renderAll();
    const outcomeKeys = [
      'ui-icon-unlock-badge',
      'ui-icon-progression-unlock-flourish',
      'ui-icon-run-outcome-flourish',
      'ui-icon-run-outcome-stat-row-frame',
      'ui-icon-run-outcome-command-frame',
      'ui-icon-run-outcome-report-frame',
      'ui-icon-run-outcome-title-plaque'
    ];
    for (let i = 0; i < 80 && !outcomeKeys.every((key) => scene.textures.exists(key)); i += 1) await wait(50);
    scene.renderAll();
    await wait(0);
    const state = scene.getTextState();
    const rootTexts = scene.root.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
    return {
      iconLoaded: scene.textures.exists('ui-icon-unlock-badge'),
      unlockFlourishLoaded: scene.textures.exists('ui-icon-progression-unlock-flourish'),
      flourishLoaded: scene.textures.exists('ui-icon-run-outcome-flourish'),
      flourishRendered: scene.root.list.some((child: any) => child.texture?.key === 'ui-icon-run-outcome-flourish'),
      unlockFlourishRendered: scene.root.list.some((child: any) => child.texture?.key === 'ui-icon-progression-unlock-flourish'),
      unlockHighlights: state.unlockHighlights,
      runOutcomeStatRowFrame: state.runOutcomeStatRowFrame,
      runOutcomeCommandFrame: state.runOutcomeCommandFrame,
      runOutcomeReportFrame: state.runOutcomeReportFrame,
      runOutcomeTitlePlaque: state.runOutcomeTitlePlaque,
      account: JSON.parse(window.localStorage.getItem('birdsquad.account') ?? '{}'),
      rootTexts
    };
  });
  const names = result.unlockHighlights.items.map((item: any) => item.name);
  expect(result.iconLoaded).toBe(true);
  expect(result.unlockFlourishLoaded).toBe(true);
  expect(result.flourishLoaded).toBe(true);
  expect(result.flourishRendered).toBe(true);
  expect(result.unlockFlourishRendered).toBe(true);
  expect(result.unlockHighlights.iconLoaded).toBe(true);
  expect(result.unlockHighlights.flourishLoaded).toBe(true);
  expect(result.runOutcomeStatRowFrame.loaded).toBe(true);
  expect(result.runOutcomeStatRowFrame.rendered).toBe(true);
  expect(result.runOutcomeStatRowFrame.count).toBe(10);
  expect(result.runOutcomeCommandFrame.loaded).toBe(true);
  expect(result.runOutcomeCommandFrame.rendered).toBe(true);
  expect(result.runOutcomeCommandFrame.count).toBe(2);
  expect(result.runOutcomeReportFrame.loaded).toBe(true);
  expect(result.runOutcomeReportFrame.rendered).toBe(true);
  expect(result.runOutcomeReportFrame.count).toBe(1);
  expect(result.runOutcomeTitlePlaque.loaded).toBe(true);
  expect(result.runOutcomeTitlePlaque.rendered).toBe(true);
  expect(result.runOutcomeTitlePlaque.count).toBe(1);
  expect(names).toContain('The Talon');
  expect(names).toContain('First Flight');
  expect(names).toContain('Hold The Line');
  expect(names).toContain('The Fledgling Flock Ascension 0 Clear');
  expect(result.unlockHighlights.items.some((item: any) => item.kind === 'contract')).toBe(true);
  expect(result.unlockHighlights.items.some((item: any) => item.kind === 'record')).toBe(true);
  expect(result.account.leaderRecords.fledgling.clears['full:0']).toEqual({ wins: 1, fastestRunTurns: 4 });
  expect(result.rootTexts.some((text: string) => text.startsWith('NEW PROGRESS:'))).toBe(true);
});

test('Leader records separate Full and Quick clears and only celebrate real improvements', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    window.localStorage.removeItem('birdsquad.account');
    const finish = async (runMode: 'full' | 'quick', difficulty: number, turns: number) => {
      await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
      game.scene.stop('MenuScene');
      const scene: any = game.scene.getScene('BattleScene');
      for (let i = 0; i < 40 && !scene.flock; i += 1) await wait(50);
      scene.runMode = runMode;
      scene.runDifficulty = difficulty;
      scene.turn = turns;
      scene.mode = 'runComplete';
      scene.emitRunSummary('win');
      return scene.lastRunRewards.newPersonalRecords;
    };
    const firstFull = await finish('full', 2, 7);
    const fasterFull = await finish('full', 2, 5);
    const slowerFull = await finish('full', 2, 6);
    const firstQuick = await finish('quick', 2, 3);
    return {
      firstFull,
      fasterFull,
      slowerFull,
      firstQuick,
      account: JSON.parse(window.localStorage.getItem('birdsquad.account') ?? '{}'),
    };
  });

  expect(result.firstFull).toEqual([
    { leaderId: 'fledgling', mode: 'full', tier: 2, turns: 7, firstClear: true, newAscensionClear: true },
  ]);
  expect(result.fasterFull).toEqual([
    { leaderId: 'fledgling', mode: 'full', tier: 2, turns: 5, firstClear: false, newAscensionClear: false },
  ]);
  expect(result.slowerFull).toEqual([]);
  expect(result.firstQuick).toEqual([
    { leaderId: 'fledgling', mode: 'quick', tier: 2, turns: 3, firstClear: true, newAscensionClear: false },
  ]);
  expect(result.account.leaderRecords.fledgling.clears).toMatchObject({
    'full:2': { wins: 3, fastestRunTurns: 5 },
    'quick:2': { wins: 1, fastestRunTurns: 3 },
  });
});

test('outcome screens render generated flourish art for win and defeat', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !scene.flock; i += 1) await wait(50);
    const count = () => scene.root.list
      .filter((child: any) => child.texture?.key === 'ui-icon-run-outcome-flourish')
      .length;
    const rowFrameCount = () => scene.root.list
      .filter((child: any) => child.texture?.key === 'ui-icon-run-outcome-stat-row-frame')
      .length;
    const commandFrameCount = () => scene.root.list
      .filter((child: any) => child.texture?.key === 'ui-icon-run-outcome-command-frame')
      .length;
    const reportFrameCount = () => scene.root.list
      .filter((child: any) => child.texture?.key === 'ui-icon-run-outcome-report-frame')
      .length;
    const titlePlaqueCount = () => scene.root.list
      .filter((child: any) => child.texture?.key === 'ui-icon-run-outcome-title-plaque')
      .length;
    scene.mode = 'runComplete';
    scene.renderAll();
    const outcomeKeys = [
      'ui-icon-run-outcome-flourish',
      'ui-icon-run-outcome-stat-row-frame',
      'ui-icon-run-outcome-command-frame',
      'ui-icon-run-outcome-report-frame',
      'ui-icon-run-outcome-title-plaque'
    ];
    for (let i = 0; i < 80 && !outcomeKeys.every((key) => scene.textures.exists(key)); i += 1) await wait(50);
    scene.renderAll();
    await wait(0);
    const winCount = count();
    const winRowFrameCount = rowFrameCount();
    const winCommandFrameCount = commandFrameCount();
    const winReportFrameCount = reportFrameCount();
    const winTitlePlaqueCount = titlePlaqueCount();
    const winCrest = scene.root.list.find((child: any) => child.texture?.key === 'ui-icon-run-outcome-crest');
    scene.mode = 'defeat';
    scene.renderAll();
    const defeatCount = count();
    const defeatRowFrameCount = rowFrameCount();
    const defeatCommandFrameCount = commandFrameCount();
    const defeatReportFrameCount = reportFrameCount();
    const defeatTitlePlaqueCount = titlePlaqueCount();
    const defeatCrest = scene.root.list.find((child: any) => child.texture?.key === 'ui-icon-run-outcome-crest');
    return {
      loaded: scene.textures.exists('ui-icon-run-outcome-flourish'),
      rowFrameLoaded: scene.textures.exists('ui-icon-run-outcome-stat-row-frame'),
      commandFrameLoaded: scene.textures.exists('ui-icon-run-outcome-command-frame'),
      reportFrameLoaded: scene.textures.exists('ui-icon-run-outcome-report-frame'),
      titlePlaqueLoaded: scene.textures.exists('ui-icon-run-outcome-title-plaque'),
      winCount,
      defeatCount,
      winRowFrameCount,
      defeatRowFrameCount,
      winCommandFrameCount,
      defeatCommandFrameCount,
      winReportFrameCount,
      defeatReportFrameCount,
      winTitlePlaqueCount,
      defeatTitlePlaqueCount,
      winCrest: winCrest ? { width: winCrest.displayWidth, height: winCrest.displayHeight } : null,
      defeatCrest: defeatCrest ? { width: defeatCrest.displayWidth, height: defeatCrest.displayHeight } : null
    };
  });

  expect(result.loaded).toBe(true);
  expect(result.rowFrameLoaded).toBe(true);
  expect(result.commandFrameLoaded).toBe(true);
  expect(result.reportFrameLoaded).toBe(true);
  expect(result.titlePlaqueLoaded).toBe(true);
  expect(result.winCount).toBeGreaterThanOrEqual(1);
  expect(result.defeatCount).toBeGreaterThanOrEqual(1);
  expect(result.winRowFrameCount).toBe(10);
  expect(result.defeatRowFrameCount).toBe(10);
  expect(result.winCommandFrameCount).toBe(2);
  expect(result.defeatCommandFrameCount).toBe(2);
  expect(result.winReportFrameCount).toBe(1);
  expect(result.defeatReportFrameCount).toBe(1);
  expect(result.winTitlePlaqueCount).toBe(1);
  expect(result.defeatTitlePlaqueCount).toBe(1);
  expect(result.winCrest?.width).toBeLessThanOrEqual(190);
  expect(result.winCrest?.height).toBeLessThanOrEqual(190);
  expect(result.defeatCrest?.width).toBeLessThanOrEqual(190);
  expect(result.defeatCrest?.height).toBeLessThanOrEqual(190);
});

test('Flock Leader signatures fire at their once-per-combat hooks', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const base = (leaderId: string) => ({
      deck: [
        { id: 'wands_03' }, { id: 'swords_ace' }, { id: 'cups_ace' }, { id: 'pentacles_04' }, { id: 'major_00' },
        { id: 'wands_ace' }, { id: 'cups_03' }, { id: 'swords_02' }, { id: 'pentacles_02' }, { id: 'aviary_25' }
      ],
      leaderId, difficulty: 0, seed: `sig-${leaderId}`, currentHp: 36,
      scrap: 0, routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [],
      currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
      suppliesUsed: [], combatResults: [],
    });
    const start = async (leaderId: string) => {
      await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry', runState: base(leaderId) });
      g.scene.stop('MenuScene');
      await wait(80);
      return g.scene.getScene('BattleScene') as any;
    };

    const fledgling = await start('fledgling');
    fledgling.fxLayer.removeAll(true);
    fledgling.combatFourSuitRallyBursts = 0;
    fledgling.fledglingSuitRallies = new Set();
    fledgling.flock.flow = 0;
    const rallyCard = fledgling.hand.find((card: any) => card.runtime?.suit && fledgling.effectiveCost(card) <= fledgling.energy);
    if (!rallyCard) throw new Error('No playable suited card for Fledgling rally smoke.');
    const rallyContract = fledgling.activeCardContract(rallyCard);
    fledgling.playCard(rallyCard, rallyContract.target === 'enemy' ? fledgling.enemies[0].id : undefined);
    await wait(80);
    const fledglingState = window.__birdSquadState!();
    const fledglingFlow = fledgling.flock.flow;

    const spark = await start('spark_caller');
    spark.fxLayer.removeAll(true);
    spark.combatSparkEchoBursts = 0;
    const sparkSeedCard = spark.hand.pop();
    if (sparkSeedCard) spark.drawPile.unshift(sparkSeedCard);
    spark.spark = 1;
    const sparkHandBefore = spark.hand.length;
    spark.spendResonance(1);
    await wait(80);
    const sparkDraw = spark.hand.length - sparkHandBefore;
    const sparkState = window.__birdSquadState!();

    const talon = await start('talon');
    talon.fxLayer.removeAll(true);
    talon.combatPinnedOpeningStrikeBursts = 0;
    const talonEnemy = talon.enemies[0];
    talonEnemy.hp = 20;
    talon.resolveCardEffect('applyWinded(target, 1)', talon.hand[0], talonEnemy.id, {
      previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false
    });
    const talonDamage = 20 - talonEnemy.hp;
    const talonState = window.__birdSquadState!();

    const tide = await start('tidewarden');
    tide.fxLayer.removeAll(true);
    tide.combatOverflowShelterBursts = 0;
    tide.flock.hp = tide.flock.maxHp;
    tide.flock.block = 0;
    tide.healFlock(3, 'test');
    await wait(80);
    const tideCover = tide.flock.block;
    const tideState = window.__birdSquadState!();

    const roost = await start('roostkeeper');
    roost.fxLayer.removeAll(true);
    roost.combatPerfectBraceRiposteBursts = 0;
    roost.flock.flow = 0;
    roost.flock.block = 99;
    roost.damageFlock(roost.enemies[0], 5);
    const roostState = window.__birdSquadState!();
    const roostFlow = roost.flock.flow;

    return {
      fledglingFlow,
      fledglingFourSuitRally: fledglingState.combatFourSuitRally,
      fledglingLog: fledglingState.log,
      sparkDraw,
      sparkEcho: sparkState.combatSparkEcho,
      sparkLog: sparkState.log,
      talonDamage,
      talonPinnedOpeningStrike: talonState.combatPinnedOpeningStrike,
      talonLog: talonState.log,
      tideCover,
      tideOverflowShelter: tideState.combatOverflowShelter,
      tideLog: tideState.log,
      roostFlow,
      roostPerfectBraceRiposte: roostState.combatPerfectBraceRiposte,
      roostLog: roostState.log,
    };
  });
  expect(r.fledglingFlow).toBeGreaterThanOrEqual(1);
  expect(r.fledglingFourSuitRally.loaded).toBe(true);
  expect(r.fledglingFourSuitRally.rendered).toBe(true);
  expect(r.fledglingFourSuitRally.count).toBeGreaterThanOrEqual(1);
  expect(r.fledglingFourSuitRally.bursts).toBe(1);
  expect(r.fledglingLog.some((entry: string) => entry.startsWith('Four-Suit Rally:'))).toBe(true);
  expect(r.sparkDraw).toBe(1);
  expect(r.sparkEcho.loaded).toBe(true);
  expect(r.sparkEcho.rendered).toBe(true);
  expect(r.sparkEcho.count).toBeGreaterThanOrEqual(1);
  expect(r.sparkEcho.bursts).toBe(1);
  expect(r.sparkLog).toContain('Spark Echo draws 1 card.');
  expect(r.talonDamage).toBe(2);
  expect(r.talonPinnedOpeningStrike.loaded).toBe(true);
  expect(r.talonPinnedOpeningStrike.rendered).toBe(true);
  expect(r.talonPinnedOpeningStrike.count).toBeGreaterThanOrEqual(1);
  expect(r.talonPinnedOpeningStrike.bursts).toBe(1);
  expect(r.talonLog).toContain('Pinned Opening hits Roof Rat for 2.');
  expect(r.tideCover).toBe(3);
  expect(r.tideOverflowShelter.loaded).toBe(true);
  expect(r.tideOverflowShelter.rendered).toBe(true);
  expect(r.tideOverflowShelter.count).toBeGreaterThanOrEqual(1);
  expect(r.tideOverflowShelter.bursts).toBe(1);
  expect(r.tideLog).toContain('Overflow Shelter turns 3 wasted healing into Cover.');
  expect(r.roostFlow).toBe(1);
  expect(r.roostPerfectBraceRiposte.loaded).toBe(true);
  expect(r.roostPerfectBraceRiposte.rendered).toBe(true);
  expect(r.roostPerfectBraceRiposte.count).toBeGreaterThanOrEqual(1);
  expect(r.roostPerfectBraceRiposte.bursts).toBe(1);
  expect(r.roostLog).toContain('Perfect Brace: +1 Flow and a counterstrike.');
});

test('locked Flock Leaders are gated until unlocked, and the Profile screen renders', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const menu: any = g.scene.getScene('MenuScene');
    for (let i = 0; i < 20 && !(menu.leaderPanels?.length); i += 1) await wait(50); // panels build a tick after boot
    // Default account: talon is locked, so selecting it must be a no-op.
    const def = menu.selectedLeaderId;
    menu.selectLeader('talon');
    const afterLockedPick = menu.selectedLeaderId;
    // spark_caller ships unlocked — selecting it sticks.
    menu.selectLeader('spark_caller');
    const afterUnlockedPick = menu.selectedLeaderId;
    // Unlock talon, re-enter the menu, and confirm it can now be picked.
    window.localStorage.setItem('birdsquad.account', JSON.stringify({
      runs: 3, wins: 3, losses: 0, winsByLeader: { fledgling: 3 }, runsByLeader: { fledgling: 3 }, bestWinTier: 2, fastestWinTurns: 6,
      unlockedLeaders: ['fledgling', 'spark_caller', 'talon'], achievements: ['first_flight'],
      contractBadges: ['0:clean_flight'],
      discoveredCards: ['major_00', 'cups_ace', 'wands_ace'],
      leaderRecords: {
        fledgling: {
          clears: {
            'full:2': { wins: 1, fastestRunTurns: 42 },
            'quick:0': { wins: 2, fastestRunTurns: 24 },
          }
        }
      },
    }));
    await window.__birdSquadStartScene!('MenuScene');
    await wait(150);
    const menu2: any = g.scene.getScene('MenuScene');
    menu2.selectLeader('talon');
    const afterUnlockTalon = menu2.selectedLeaderId;
    // The Profile screen renders against the account without throwing.
    await window.__birdSquadStartScene!('ProfileScene');
    for (let i = 0; i < 80 && !g.textures.exists('ui-icon-profile-record-flourish'); i += 1) await wait(50);
    for (let i = 0; i < 40; i += 1) {
      const profileState = JSON.parse(window.render_game_to_text?.() ?? '{}');
      if (profileState.profileRecordFlourish?.rendered) break;
      await wait(50);
    }
    const profileActive = g.scene.getScenes(true).map((s: any) => s.scene.key).includes('ProfileScene');
    const profileText = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const recordTextureLoaded = g.textures.exists('ui-icon-record-medallion');
    const achievementTextureLoaded = g.textures.exists('ui-icon-achievement-medallion');
    const leaderRecordTextureLoaded = g.textures.exists('ui-icon-leader-record-medallion');
    const profileScene: any = g.scene.getScene('ProfileScene');
    const profileFlourishLoaded = g.textures.exists('ui-icon-profile-record-flourish');
    const profileTitlePlaqueLoaded = g.textures.exists('ui-icon-profile-title-plaque');
    const profileStatChipFrameLoaded = g.textures.exists('ui-icon-profile-stat-chip-frame');
    const profileRecordRowFrameLoaded = g.textures.exists('ui-icon-profile-record-row-frame');
    const profileSectionTabFrameLoaded = g.textures.exists('ui-icon-profile-section-tab-frame');
    const profileProgressRailFrameLoaded = g.textures.exists('ui-icon-profile-progress-rail-frame');
    const profileProgressFillStripLoaded = g.textures.exists('ui-icon-profile-progress-fill-strip');
    const profileReturnCommandFrameLoaded = g.textures.exists('ui-icon-profile-return-command-frame');
    const profileFlourishObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-record-flourish' || child.name === 'profile-record-flourish')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible, name: child.name, texture: child.texture?.key }));
    const profileTitlePlaqueObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-title-plaque')
      .map((child: any) => ({
        alpha: child.alpha,
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const profileStatChipFrameObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-stat-chip-frame')
      .map((child: any) => ({
        alpha: child.alpha,
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const profileRecordRowFrameObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-record-row-frame')
      .map((child: any) => ({
        alpha: child.alpha,
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const profileSectionTabFrameObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-section-tab-frame')
      .map((child: any) => ({
        alpha: child.alpha,
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const profileProgressRailFrameObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-progress-rail-frame')
      .map((child: any) => ({
        alpha: child.alpha,
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const profileProgressFillStripObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-progress-fill-strip')
      .map((child: any) => ({
        alpha: child.alpha,
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name,
        tint: child.tintTopLeft
      }));
    const profileReturnCommandFrameObjects = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-profile-return-command-frame')
      .map((child: any) => ({
        alpha: child.alpha,
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const leaderRecordIcons = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-leader-record-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const achievementIcons = profileScene.children.list
      .filter((child: any) => child.texture?.key === 'ui-icon-achievement-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const profileTouchTargets = profileScene.children.list
      .filter((child: any) => child.input?.enabled && child.type === 'Rectangle')
      .map((child: any) => ({ width: child.displayWidth, height: child.displayHeight }));
    const profileKeyListenersBefore = {
      escape: profileScene.input.keyboard.listenerCount('keydown-ESC'),
      mute: profileScene.input.keyboard.listenerCount('keydown-M')
    };
    profileScene.badgeView = 'contracts';
    profileScene.renderPremiumProfileScene();
    const profileKeyListenersAfter = {
      escape: profileScene.input.keyboard.listenerCount('keydown-ESC'),
      mute: profileScene.input.keyboard.listenerCount('keydown-M')
    };
    const contractProfileText = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const contractBadgeLabels = profileScene.children.list
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text)
      .filter((text: string) => text.includes('Clean Flight') || text.includes('District 1'));
    const personalRecordLabels = profileScene.children.list
      .filter((child: any) => child.name === 'leader-personal-record-fledgling')
      .map((child: any) => child.text);
    return {
      def,
      afterLockedPick,
      afterUnlockedPick,
      afterUnlockTalon,
      profileActive,
      profileText,
      recordTextureLoaded,
      profileFlourishLoaded,
      profileTitlePlaqueLoaded,
      profileStatChipFrameLoaded,
      profileRecordRowFrameLoaded,
      profileSectionTabFrameLoaded,
      profileProgressRailFrameLoaded,
      profileProgressFillStripLoaded,
      profileReturnCommandFrameLoaded,
      profileFlourishObjects,
      profileTitlePlaqueObjects,
      profileStatChipFrameObjects,
      profileRecordRowFrameObjects,
      profileSectionTabFrameObjects,
      profileProgressRailFrameObjects,
      profileProgressFillStripObjects,
      profileReturnCommandFrameObjects,
      achievementTextureLoaded,
      leaderRecordTextureLoaded,
      leaderRecordIcons,
      achievementIcons,
      profileTouchTargets,
      profileKeyListenersBefore,
      profileKeyListenersAfter,
      contractProfileText,
      contractBadgeLabels,
      personalRecordLabels
    };
  });
  expect(r.afterLockedPick).toBe(r.def);             // locked pick ignored
  expect(r.afterLockedPick).not.toBe('talon');
  expect(r.afterUnlockedPick).toBe('spark_caller');  // unlocked pick works
  expect(r.afterUnlockTalon).toBe('talon');          // pickable once unlocked
  expect(r.profileActive).toBe(true);
  expect(r.recordTextureLoaded).toBe(true);
  expect(r.profileFlourishLoaded).toBe(true);
  expect(r.profileText.scene).toBe('ProfileScene');
  expect(r.profileText.playtestExport).toMatchObject({ enabled: false, localOnly: true, status: 'idle' });
  expect(r.profileText.progression.contractBadges).toBe(1);
  expect(r.profileText.leaderRecords.find((record: any) => record.id === 'fledgling')).toMatchObject({
    bestFullWinTier: 2,
    fastestFullWinTurns: 42,
    fastestQuickWinTurns: 24,
  });
  expect(r.personalRecordLabels).toEqual(['A2  /  FULL 42B  /  QUICK 24B']);
  expect(r.contractProfileText.badgeView).toBe('contracts');
  expect(r.profileKeyListenersBefore).toEqual({ escape: 1, mute: 1 });
  expect(r.profileKeyListenersAfter).toEqual(r.profileKeyListenersBefore);
  expect(r.profileTouchTargets.filter((target: { width: number; height: number }) => target.width === 124)).toEqual([
    { width: 124, height: 56 },
    { width: 124, height: 56 }
  ]);
  expect(r.profileTouchTargets).toContainEqual({ width: 186, height: 56 });
  expect(r.contractProfileText.contractBadges).toContain('0:clean_flight');
  expect(r.contractBadgeLabels.length).toBeGreaterThanOrEqual(2);
  expect(r.profileText.profileRecordFlourish.loaded).toBe(true);
  expect(r.profileText.profileRecordFlourish.rendered).toBe(true);
  expect(r.profileText.profileRecordFlourish.count).toBeGreaterThanOrEqual(2);
  expect(r.profileText.profileRecordFlourish.revealBursts).toBe(1);
  expect(r.contractProfileText.profileRecordFlourish.revealBursts).toBe(1);
  expect(r.profileText.audio.cueRequests.profileRecord).toBeGreaterThanOrEqual(1);
  expect(r.contractProfileText.audio.cueRequests.profileRecord).toBe(r.profileText.audio.cueRequests.profileRecord);
  expect(r.profileFlourishObjects.length).toBeGreaterThanOrEqual(2);
  expect(r.profileFlourishObjects.some((obj: { visible: boolean; alpha: number }) => obj.visible && obj.alpha > 0.3)).toBe(true);
  expect(r.profileTitlePlaqueLoaded).toBe(true);
  expect(r.profileText.profileTitlePlaque).toEqual({
    loaded: true,
    rendered: true,
    count: r.profileTitlePlaqueObjects.length
  });
  expect(r.profileTitlePlaqueObjects).toEqual([
    expect.objectContaining({
      visible: true,
      displayWidth: 560,
      displayHeight: 104,
      name: 'profile-title-plaque'
    })
  ]);
  expect(r.profileTitlePlaqueObjects[0].alpha).toBeGreaterThanOrEqual(0.5);
  expect(r.profileStatChipFrameLoaded).toBe(true);
  expect(r.profileText.profileStatChipFrame).toEqual({
    loaded: true,
    rendered: true,
    count: r.profileStatChipFrameObjects.length
  });
  expect(r.profileStatChipFrameObjects.length).toBe(10);
  expect(r.profileStatChipFrameObjects.some((obj: { visible: boolean; alpha: number }) => obj.visible && obj.alpha > 0.6)).toBe(true);
  expect(r.profileStatChipFrameObjects.every((obj: { displayWidth: number; displayHeight: number }) => obj.displayWidth >= 142 && obj.displayHeight >= 54)).toBe(true);
  expect(r.profileRecordRowFrameLoaded).toBe(true);
  expect(r.profileText.profileRecordRowFrame).toEqual({
    loaded: true,
    rendered: true,
    count: r.profileRecordRowFrameObjects.length
  });
  expect(r.profileRecordRowFrameObjects.length).toBe(r.profileText.progression.leaderTotal + r.profileText.progression.achievementTotal);
  expect(r.profileRecordRowFrameObjects.some((obj: { visible: boolean; alpha: number }) => obj.visible && obj.alpha > 0.4)).toBe(true);
  expect(r.profileRecordRowFrameObjects.some((obj: { visible: boolean; alpha: number }) => obj.visible && obj.alpha < 0.25)).toBe(true);
  expect(r.profileRecordRowFrameObjects.every((obj: { displayWidth: number; displayHeight: number }) => obj.displayWidth >= 310 && obj.displayHeight >= 40)).toBe(true);
  expect(r.profileSectionTabFrameLoaded).toBe(true);
  expect(r.profileText.profileSectionTabFrame).toEqual({
    loaded: true,
    rendered: true,
    count: r.profileSectionTabFrameObjects.length
  });
  expect(r.profileSectionTabFrameObjects).toHaveLength(2);
  expect(r.profileSectionTabFrameObjects).toEqual(expect.arrayContaining([
    expect.objectContaining({
      visible: true,
      displayWidth: 220,
      displayHeight: 48,
      name: 'profile-section-tab-frame'
    }),
    expect.objectContaining({
      visible: true,
      displayWidth: 300,
      displayHeight: 48,
      name: 'profile-section-tab-frame'
    })
  ]));
  expect(r.profileSectionTabFrameObjects.every((obj: { alpha: number }) => obj.alpha >= 0.55)).toBe(true);
  expect(r.profileProgressRailFrameLoaded).toBe(true);
  expect(r.profileText.profileProgressRailFrame).toEqual({
    loaded: true,
    rendered: true,
    count: r.profileProgressRailFrameObjects.length
  });
  expect(r.profileProgressRailFrameObjects.length).toBe(3);
  expect(r.profileProgressRailFrameObjects.every((obj: { visible: boolean; alpha: number }) => obj.visible && obj.alpha >= 0.45)).toBe(true);
  expect(r.profileProgressRailFrameObjects.every((obj: { displayWidth: number; displayHeight: number }) => obj.displayWidth >= 332 && obj.displayHeight >= 34)).toBe(true);
  expect(r.profileProgressFillStripLoaded).toBe(true);
  expect(r.profileText.profileProgressFillStrip).toEqual({
    loaded: true,
    rendered: true,
    count: r.profileProgressFillStripObjects.length
  });
  expect(r.profileProgressFillStripObjects.length).toBe(3);
  expect(r.profileProgressFillStripObjects.every((obj: { visible: boolean; alpha: number }) => obj.visible && obj.alpha >= 0.8)).toBe(true);
  expect(r.profileProgressFillStripObjects.every((obj: { displayWidth: number; displayHeight: number }) => obj.displayWidth >= 20 && obj.displayHeight === 16)).toBe(true);
  expect(r.profileReturnCommandFrameLoaded).toBe(true);
  expect(r.profileText.profileReturnCommandFrame).toEqual({
    loaded: true,
    rendered: true,
    count: r.profileReturnCommandFrameObjects.length
  });
  expect(r.profileReturnCommandFrameObjects.length).toBe(1);
  expect(r.profileReturnCommandFrameObjects[0]).toMatchObject({
    visible: true,
    displayWidth: 220,
    displayHeight: 62,
    name: 'profile-return-command-frame'
  });
  expect(r.profileReturnCommandFrameObjects[0].alpha).toBeGreaterThan(0.6);
  expect(r.profileText.progression.leadersUnlocked).toBe(3);
  expect(r.profileText.progression.achievementsEarned).toBe(1);
  expect(r.profileText.progression.discoveredCards).toBe(3);
  expect(r.leaderRecordTextureLoaded).toBe(true);
  expect(r.leaderRecordIcons.length).toBe(r.profileText.progression.leaderTotal);
  expect(r.leaderRecordIcons.some((icon: { alpha: number }) => icon.alpha > 0.85)).toBe(true);
  expect(r.leaderRecordIcons.some((icon: { alpha: number }) => icon.alpha < 0.35)).toBe(true);
  expect(r.achievementTextureLoaded).toBe(true);
  expect(r.achievementIcons.length).toBe(r.profileText.progression.achievementTotal);
  expect(r.achievementIcons.some((icon: { alpha: number }) => icon.alpha > 0.9)).toBe(true);
});

test('Flock Record focus follows remapped keyboard and gamepad controls with one cue per action', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('birdsquad.controlBindings', JSON.stringify({
      version: 1,
      bindings: { confirm: 'Space', back: 'KeyQ', previous: 'KeyA', next: 'KeyD' },
    }));
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').scene === 'ProfileScene');
  const initial = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));

  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 15 });
  });
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).focus.current).toBe('contracts');
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 14 });
  });
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).focus.current).toBe('achievements');

  await page.keyboard.press('d');
  await page.keyboard.press('d');
  await page.keyboard.press('d');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).focus.current).toBe('saveData');
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 0 });
  });
  let modal = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(modal.saveData.open).toBe(true);
  expect(modal.focus).toMatchObject({ current: 'saveDownload', order: ['saveDownload', 'saveRestore'], previous: 'A', next: 'D', confirm: 'Space', back: 'Q' });
  const modalLabels = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return profile.children.list.map((child: any) => child.text).filter((text: unknown) => typeof text === 'string');
  });
  expect(modalLabels).toContain('A / D: Navigate   Space: Select   Q: Close');
  await page.keyboard.press('d');
  await page.keyboard.press('d');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).focus.current).toBe('saveDownload');
  await page.keyboard.press('q');
  modal = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect(modal.saveData.open).toBe(false);
  expect(modal.focus.current).toBe('saveData');
  await page.keyboard.press('Space');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).saveData.open).toBe(true);
  await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    profile.input.gamepad.emit('down', {}, { index: 1 });
  });
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).saveData.open).toBe(false);
  await page.keyboard.press('a');
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).focus.current).toBe('return');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').scene === 'MenuScene');
  const finalState = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  expect((finalState.audio.cueRequests.confirm ?? 0) - (initial.audio.cueRequests.confirm ?? 0)).toBe(10);
  expect((finalState.audio.cueRequests.close ?? 0) - (initial.audio.cueRequests.close ?? 0)).toBe(3);
});

test('Flock Record downloads a complete local save backup without uploading data', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      runs: 7, wins: 3, losses: 4, unlockedLeaders: ['fledgling', 'talon'],
      achievements: ['first_win'], discoveredCards: ['major_00'], bestWinTier: 1,
    };
    const activeRun = {
      deck: [{ id: 'major_00', upgraded: true }], leaderId: 'talon', difficulty: 1,
      runMode: 'quick', seed: 'backup-flight', currentHp: 27, scrap: 19,
    };
    const runs = [{ id: 'backup-history-1', result: 'win', seed: 'history-seed' }];
    const guide = { version: 1, seen: ['welcome'], completed: false, skipped: 0 };
    for (const [key, value] of Object.entries({
      'birdsquad.account': account,
      'birdsquad.run.active': activeRun,
      'birdsquad.runs': runs,
      'birdsquad.firstFlightGuide': guide,
    })) {
      const raw = JSON.stringify(value);
      localStorage.setItem(key, raw);
      localStorage.setItem(`${key}.backup`, raw);
    }
    localStorage.setItem('birdsquad.graphicsQuality', 'lean');
    localStorage.setItem('birdsquad.visualContrast', 'high');
    localStorage.setItem('birdsquad.motionPreference', 'reduced');
    localStorage.setItem('birdsquad.combatPace', 'snappy');
    localStorage.setItem('birdsquad.screenReader', 'on');
    localStorage.setItem('birdsquad.musicVolume', '0.35');
    localStorage.setItem('birdsquad.sfxVolume', '0.65');
    localStorage.setItem('birdsquad.audioMuted', '1');
    localStorage.setItem('birdsquad.maxTier', '2');
    localStorage.setItem('unrelated.origin.key', 'must-not-export');
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  const mutatingRequests: string[] = [];
  page.on('request', (request) => {
    if (['POST', 'PUT', 'PATCH'].includes(request.method())) mutatingRequests.push(request.url());
  });
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-data-hit');
  const beforeDownload = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  const downloadPromise = page.waitForEvent('download');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-download-hit');
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('Save backup did not produce a local file');
  const raw = await readFile(downloadedPath, 'utf8');
  const payload = JSON.parse(raw);
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));

  expect(download.suggestedFilename()).toMatch(/^bird-squad-save-\d{4}-\d{2}-\d{2}\.json$/);
  expect(payload).toMatchObject({
    format: 'bird-squad-save',
    version: 1,
    data: {
      account: { runs: 7, wins: 3, losses: 4 },
      activeRun: { seed: 'backup-flight', leaderId: 'talon', difficulty: 1 },
      runHistory: [{ id: 'backup-history-1' }],
      preferences: {
        graphicsQuality: 'lean', visualContrast: 'high', motion: 'reduced', combatPace: 'snappy',
        screenReader: 'on',
        musicVolume: 0.35, sfxVolume: 0.65, audioMuted: true, maxTier: 2,
      },
    },
  });
  expect(Object.keys(payload.data)).toEqual(['account', 'activeRun', 'runHistory', 'guide', 'preferences']);
  expect(Object.keys(payload.data.preferences).sort()).toEqual([
    'audioMuted', 'combatPace', 'controls', 'graphicsQuality', 'maxTier',
    'motion', 'musicVolume', 'screenReader', 'sfxVolume', 'visualContrast',
  ]);
  expect(Object.keys(payload.data.preferences.controls).length).toBeGreaterThan(0);
  expect(raw).not.toContain('must-not-export');
  expect(state.saveData).toMatchObject({ open: true, status: 'downloaded' });
  expect((state.audio.cueRequests.confirm ?? 0) - (beforeDownload.audio.cueRequests.confirm ?? 0)).toBe(1);
  expect(mutatingRequests).toEqual([]);
});

test('Flock Record rejects an invalid restore before changing local data', async ({ page }) => {
  await page.addInitScript(() => {
    const raw = JSON.stringify({ runs: 2, wins: 1, losses: 1 });
    localStorage.setItem('birdsquad.account', raw);
    localStorage.setItem('birdsquad.account.backup', raw);
    localStorage.setItem('unrelated.origin.key', 'keep-me');
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-data-hit');
  const chooserPromise = page.waitForEvent('filechooser');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-restore-file-hit');
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'not-a-bird-squad-save.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"wrong","version":1,"data":{}}'),
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').saveData?.status === 'invalid');
  const result = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return {
      account: localStorage.getItem('birdsquad.account'),
      accountBackup: localStorage.getItem('birdsquad.account.backup'),
      unrelated: localStorage.getItem('unrelated.origin.key'),
      confirmVisible: profile.children.list.some((child: any) => child.name === 'profile-save-restore-confirm-hit'),
      state: JSON.parse(window.render_game_to_text?.() ?? '{}').saveData,
    };
  });
  expect(JSON.parse(result.account ?? '{}')).toMatchObject({ runs: 2, wins: 1, losses: 1 });
  expect(result.accountBackup).toBe(result.account);
  expect(result.unrelated).toBe('keep-me');
  expect(result.confirmVisible).toBe(false);
  expect(result.state).toMatchObject({ open: true, status: 'invalid', pending: null });
});

test('Flock Record previews and confirms a transactional save restore', async ({ page }) => {
  await page.addInitScript(() => {
    const account = {
      runs: 9, wins: 4, losses: 5, unlockedLeaders: ['fledgling', 'talon'],
      achievements: ['first_win'], bestWinTier: 1,
    };
    const activeRun = {
      deck: [{ id: 'major_00' }], leaderId: 'talon', difficulty: 1,
      runMode: 'quick', seed: 'restore-target', currentHp: 24, scrap: 33,
    };
    const runs = [{ id: 'restore-history', result: 'loss', seed: 'restore-history-seed' }];
    const guide = { version: 1, seen: ['welcome'], completed: true, skipped: 0 };
    for (const [key, value] of Object.entries({
      'birdsquad.account': account,
      'birdsquad.run.active': activeRun,
      'birdsquad.runs': runs,
      'birdsquad.firstFlightGuide': guide,
    })) {
      const raw = JSON.stringify(value);
      localStorage.setItem(key, raw);
      localStorage.setItem(`${key}.backup`, raw);
    }
    localStorage.setItem('birdsquad.graphicsQuality', 'lean');
    localStorage.setItem('birdsquad.visualContrast', 'high');
    localStorage.setItem('birdsquad.motionPreference', 'reduced');
    localStorage.setItem('birdsquad.combatPace', 'snappy');
    localStorage.setItem('birdsquad.musicVolume', '0.40');
    localStorage.setItem('birdsquad.sfxVolume', '0.60');
    localStorage.setItem('birdsquad.audioMuted', '1');
    localStorage.setItem('birdsquad.maxTier', '2');
  });
  await boot(page);
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-data-hit');
  const downloadPromise = page.waitForEvent('download');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-download-hit');
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('Restore fixture backup was not downloaded');
  const backupRaw = await readFile(downloadedPath, 'utf8');

  await page.evaluate(() => {
    const current = JSON.stringify({ runs: 1, wins: 0, losses: 1 });
    localStorage.setItem('birdsquad.account', current);
    localStorage.setItem('birdsquad.account.backup', current);
    localStorage.setItem('birdsquad.runs', '[]');
    localStorage.setItem('birdsquad.runs.backup', '[]');
    localStorage.removeItem('birdsquad.run.active');
    localStorage.removeItem('birdsquad.run.active.backup');
    localStorage.setItem('birdsquad.graphicsQuality', 'full');
    localStorage.setItem('birdsquad.visualContrast', 'standard');
    localStorage.setItem('birdsquad.motionPreference', 'full');
    localStorage.setItem('unrelated.origin.key', 'keep-current');
  });
  const chooserPromise = page.waitForEvent('filechooser');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-restore-file-hit');
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'bird-squad-save.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backupRaw),
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').saveData?.status === 'restoreReady');
  const beforeConfirm = await page.evaluate(() => ({
    account: JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}'),
    activeRun: localStorage.getItem('birdsquad.run.active'),
    unrelated: localStorage.getItem('unrelated.origin.key'),
    pending: JSON.parse(window.render_game_to_text?.() ?? '{}').saveData?.pending,
  }));
  expect(beforeConfirm.account).toMatchObject({ runs: 1, wins: 0 });
  expect(beforeConfirm.activeRun).toBeNull();
  expect(beforeConfirm.unrelated).toBe('keep-current');
  expect(beforeConfirm.pending).toMatchObject({ runs: 9, wins: 4, leaders: 3, activeRun: true });

  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-restore-confirm-hit');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}').runs === 9);
  const restored = await page.evaluate(() => ({
    account: JSON.parse(localStorage.getItem('birdsquad.account') ?? '{}'),
    runHistory: JSON.parse(localStorage.getItem('birdsquad.runs') ?? '[]'),
    activeRun: JSON.parse(localStorage.getItem('birdsquad.run.active') ?? '{}'),
    graphics: localStorage.getItem('birdsquad.graphicsQuality'),
    contrast: localStorage.getItem('birdsquad.visualContrast'),
    motion: localStorage.getItem('birdsquad.motionPreference'),
    accountMirror: localStorage.getItem('birdsquad.account.backup') === localStorage.getItem('birdsquad.account'),
    runMirror: localStorage.getItem('birdsquad.runs.backup') === localStorage.getItem('birdsquad.runs'),
    activeMirror: localStorage.getItem('birdsquad.run.active.backup') === localStorage.getItem('birdsquad.run.active'),
    guideMirror: localStorage.getItem('birdsquad.firstFlightGuide.backup') === localStorage.getItem('birdsquad.firstFlightGuide'),
    unrelated: localStorage.getItem('unrelated.origin.key'),
  }));
  expect(restored.account).toMatchObject({ runs: 9, wins: 4, losses: 5 });
  expect(restored.runHistory).toEqual([expect.objectContaining({ id: 'restore-history' })]);
  expect(restored.activeRun).toMatchObject({ seed: 'restore-target', leaderId: 'talon', scrap: 33 });
  expect(restored).toMatchObject({
    graphics: 'lean', contrast: 'high', motion: 'reduced',
    accountMirror: true, runMirror: true, activeMirror: true, guideMirror: true,
    unrelated: 'keep-current',
  });
});

test('playtest mode exports local run history from the Flock Record without an upload', async ({ page }) => {
  const exportedRun = {
    id: 'human-session-1', seed: 'first-run-export', result: 'loss', leaderId: 'fledgling', difficulty: 0,
    runMode: 'quick', mapId: 'map_0', finalNodeId: 'm0_street_1', turnsTaken: 2, durationMs: 60_000,
    currentCohesion: 0, maxCohesion: 38, scrapEarned: 12, scrapSpent: 0, finalScrap: 52,
    path: ['m0_street_1'], deck: [], routeMarks: [], suppliesUsed: [], signals: [], cardRewards: [],
    routeDecisions: [{ offered: ['m0_street_1'], picked: 'm0_street_1', decisionMs: 4_200 }],
    combatResults: [{
      encounterId: 'rooftop_first_flight', nodeId: 'm0_street_1', nodeType: 'street', turnsTaken: 2,
      durationMs: 48_000, cohesionLost: 38, damageDealt: 12, killedByMove: 'Review Strike',
      decisionStats: { cardsPlayed: 2, turnEnds: 1, invalidActions: 1, cancelledActions: 0 },
    }],
    districtContracts: [], seenEnemyMoves: [], combatPace: 'standard',
    firstFlightGuide: { completed: false, skipped: 0 },
  };
  await page.addInitScript((run) => {
    const raw = JSON.stringify([run]);
    localStorage.setItem('birdsquad.runs', raw);
    localStorage.setItem('birdsquad.runs.backup', raw);
  }, exportedRun);
  await boot(page, '/?playtest=1');
  await page.evaluate(async () => window.__birdSquadStartScene!('ProfileScene'));
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.scene === 'ProfileScene' && state.playtestExport?.enabled && state.playtestExport?.runs === 1;
  });

  const mutatingRequests: string[] = [];
  page.on('request', (request) => {
    if (['POST', 'PUT', 'PATCH'].includes(request.method())) mutatingRequests.push(request.url());
  });
  await clickNamedGameObject(page, 'ProfileScene', 'profile-save-data-hit');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-playtest-feedback-fun-5');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-playtest-feedback-fairness-4');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-playtest-feedback-clarity-5');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-playtest-feedback-replay-4');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').playtestFeedback?.ratings?.replay === 5);
  const locallyRated = await page.evaluate(() => ({
    primary: JSON.parse(localStorage.getItem('birdsquad.runs') ?? '[]'),
    mirror: JSON.parse(localStorage.getItem('birdsquad.runs.backup') ?? '[]'),
    view: JSON.parse(window.render_game_to_text?.() ?? '{}').playtestFeedback,
  }));
  const downloadPromise = page.waitForEvent('download');
  await clickNamedGameObject(page, 'ProfileScene', 'profile-playtest-export-hit');
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('Playtest export did not produce a local file');
  const payload = JSON.parse(await readFile(downloadedPath, 'utf8'));
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}'));
  const labels = await page.evaluate(() => {
    const profile: any = window.__birdSquadGame.scene.getScene('ProfileScene');
    return profile.children.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
  });

  expect(download.suggestedFilename()).toMatch(/^bird-squad-runs-\d{4}-\d{2}-\d{2}\.json$/);
  const expectedFeedback = {
    fun: 5,
    fairness: 4,
    clarity: 5,
    replay: 5,
    updatedAt: expect.any(String),
  };
  expect(locallyRated.primary).toEqual([{ ...exportedRun, experienceFeedback: expectedFeedback }]);
  expect(locallyRated.mirror).toEqual(locallyRated.primary);
  expect(locallyRated.view).toMatchObject({
    enabled: true,
    localOnly: true,
    runId: 'human-session-1',
    result: 'loss',
    ratings: expectedFeedback,
    complete: true,
    status: 'saved',
  });
  expect(payload).toEqual([{ ...exportedRun, experienceFeedback: expectedFeedback }]);
  expect(state.playtestExport).toEqual({ enabled: true, localOnly: true, runs: 1, status: 'downloaded' });
  expect(labels).toContain('1 local run downloaded');
  expect(mutatingRequests).toEqual([]);
});

test('route marks are real relics: combatStart marks reshape the fight', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !scene.fxLayer; i += 1) await wait(50);
    // Baseline: no marks → no relic cover/energy beyond the turn-1 default.
    scene.routeMarks = [];
    scene.flock.block = 0;
    scene.energy = 3;
    scene.applyCombatStartMarks();
    const baseBlock = scene.flock.block;
    const baseEnergy = scene.energy;
    // Equip a clean-turn relic and one low-card Roost relic, then prove each
    // fires at its authored timing.
    scene.routeMarks = ['patched_shoulder_wrap', 'loose_feather_token'];
    scene.flock.block = 0;
    scene.energy = 3;
    scene.nextTurnEnergyBonus = 0;
    scene.pendingRetainHand = 0;
    scene.markFiredThisCombat = new Set();
    scene.applyCombatStartMarks();
    const markBlock = scene.flock.block;
    const markEnergy = scene.energy;
    scene.checkNoDamageTurnMarks();
    const shoulderAfterCleanTurn = {
      block: scene.flock.block,
      retain: scene.pendingRetainHand,
    };
    scene.checkRoostRestraintMarks(0, 1, 2);
    const featherNextEnergy = scene.nextTurnEnergyBonus;

    scene.routeMarks = ['chalk_wingmark'];
    scene.markFiredThisTurn = new Set();
    scene.flock.block = 0;
    scene.spark = 0;
    scene.nextTurnDrawBonus = 0;
    scene.checkEnemyCoverBrokenMarks();
    const chalkCover = scene.flock.block;
    const chalkNextDraw = scene.nextTurnDrawBonus;
    const chalkSpark = scene.spark;

    scene.routeMarks = ['stage_pin', 'quill_notch', 'feather_tape', 'workshop_stamp'];
    scene.markFiredThisTurn = new Set();
    scene.flock.maxHp = 40;
    scene.flock.hp = 20;
    scene.flock.block = 0;
    scene.flock.openSkyGuard = 0;
    scene.nextTurnEnergyBonus = 0;
    scene.checkSuitPlayedMarks('plumes');
    scene.checkSuitPlayedMarks('quills');
    scene.checkSuitPlayedMarks('basins');
    scene.checkSuitPlayedMarks('nests');
    const suitMarks = {
      hp: scene.flock.hp,
      block: scene.flock.block,
      guard: scene.flock.openSkyGuard,
      nextEnergy: scene.nextTurnEnergyBonus,
    };

    scene.routeMarks = ['rooftop_relay_bell'];
    scene.markFiredThisCombat = new Set();
    scene.energy = 3;
    const handBeforeRelay = scene.hand.length;
    scene.checkSupplyUsedMarks();
    const relay = { energy: scene.energy, hand: scene.hand.length, beforeHand: handBeforeRelay };

    scene.routeMarks = ['parade_mirror'];
    scene.markFiredThisCombat = new Set();
    scene.cardsPlayedThisTurn = 2;
    scene.spark = 0;
    scene.checkRoostRestraintMarks(0, 0, 2);
    const paradeResonance = scene.spark;

    scene.routeMarks = ['fresh_pinfeather'];
    scene.markFiredThisCombat = new Set();
    scene.flock.molt = false;
    scene.nextTurnEnergyBonus = 0;
    const handBeforePinfeather = scene.hand.length;
    scene.enterMolt('test');
    const pinfeather = { nextEnergy: scene.nextTurnEnergyBonus, hand: scene.hand.length, beforeHand: handBeforePinfeather };

    scene.routeMarks = ['harbor_bead_strand'];
    scene.markFiredThisTurn = new Set();
    scene.flock.maxHp = 40;
    scene.flock.hp = 20;
    scene.nextTurnDrawBonus = 0;
    scene.healFlock(2, 'test');
    const harborNextDraw = scene.nextTurnDrawBonus;

    scene.routeMarks = ['rooftop_nest_lining'];
    scene.markFiredThisCombat = new Set();
    scene.flock.block = 0;
    scene.pendingRetainHand = 0;
    scene.checkNoDamageTurnMarks();
    const nestLining = { cover: scene.flock.block, retain: scene.pendingRetainHand };

    scene.routeMarks = ['rooftop_shortcut'];
    scene.markFiredThisCombat = new Set();
    scene.nextTurnDrawBonus = 0;
    scene.checkRoostRestraintMarks(0, 1, 1);
    const shortcutNextDraw = scene.nextTurnDrawBonus;

    scene.routeMarks = ['courier_thread'];
    scene.markFiredThisCombat = new Set();
    scene.nextTurnDrawBonus = 0;
    scene.checkRoostRestraintMarks(0, 0, 2);
    const courierNextDraw = scene.nextTurnDrawBonus;

    scene.routeMarks = ['crowbar_debt'];
    scene.markFiredThisTurn = new Set();
    scene.enemies.forEach((enemy: any) => { enemy.maxHp = 20; enemy.hp = 20; });
    scene.checkEnemyCoverBrokenMarks();
    const crowbarDamage = scene.enemies.map((enemy: any) => 20 - enemy.hp);
    const waymarkFeedback = window.__birdSquadState!().waymarkFeedback ?? [];

    scene.routeMarks = ['chalk_wingmark', 'rooftop_shortcut', 'patched_harness', 'quiet_landing', 'loose_change_tin', 'rain_gutter'];
    scene.claimWaymarkReward('sky_safe_harness');
    const withBossExempt = [...scene.routeMarks];
    scene.claimWaymarkReward('cache_divining_hook');
    const withCapacityReplace = [...scene.routeMarks];

    return {
      baseBlock,
      baseEnergy,
      markBlock,
      markEnergy,
      shoulderAfterCleanTurn,
      featherNextEnergy,
      chalkCover,
      chalkNextDraw,
      chalkSpark,
      suitMarks,
      relay,
      paradeResonance,
      pinfeather,
      harborNextDraw,
      nestLining,
      shortcutNextDraw,
      courierNextDraw,
      crowbarDamage,
      waymarkFeedback,
      withBossExempt,
      withCapacityReplace,
    };
  });
  expect(r.baseBlock).toBe(0);          // no relic, no bonus cover
  expect(r.baseEnergy).toBe(3);
  expect(r.markBlock).toBe(0); // patched_shoulder_wrap waits for a no-damage enemy turn
  expect(r.markEnergy).toBe(3); // loose_feather_token waits for a restrained Roost
  expect(r.shoulderAfterCleanTurn.block).toBeGreaterThanOrEqual(4);
  expect(r.shoulderAfterCleanTurn.retain).toBe(1);
  expect(r.featherNextEnergy).toBe(1); // loose_feather_token banks next-turn Wingbeat
  expect(r.chalkCover).toBe(3);
  expect(r.chalkNextDraw).toBe(1);
  expect(r.chalkSpark).toBe(1);
  expect(r.suitMarks.guard).toBe(1);
  expect(r.suitMarks.block).toBe(8);
  expect(r.suitMarks.hp).toBe(23);
  expect(r.suitMarks.nextEnergy).toBe(1);
  expect(r.relay.energy).toBe(4);
  expect(r.relay.hand).toBeGreaterThanOrEqual(r.relay.beforeHand + 1);
  expect(r.paradeResonance).toBe(1);
  expect(r.pinfeather.nextEnergy).toBe(1);
  expect(r.pinfeather.hand).toBeGreaterThanOrEqual(r.pinfeather.beforeHand + 1);
  expect(r.harborNextDraw).toBe(1);
  expect(r.nestLining.cover).toBe(8);
  expect(r.nestLining.retain).toBe(1);
  expect(r.shortcutNextDraw).toBe(1);
  expect(r.courierNextDraw).toBe(1);
  expect(r.crowbarDamage.every((damage: number) => damage === 5)).toBe(true);
  expect(r.waymarkFeedback[0]).toEqual(expect.objectContaining({
    id: 'crowbar_debt',
    name: 'Crowbar Debt',
  }));
  expect(r.waymarkFeedback[0].summary).toContain('Cover broken');
  expect(r.withBossExempt).toHaveLength(7);
  expect(r.withBossExempt).toContain('sky_safe_harness');
  expect(r.withCapacityReplace).toHaveLength(7);
  expect(r.withCapacityReplace).not.toContain('chalk_wingmark');
  expect(r.withCapacityReplace).toContain('cache_divining_hook');
});

test('waymark artifact drawer renders found item art and run tooltips', async ({ page }) => {
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
      i < 40 && !scene.routeMarks.every((id: string) => scene.textures.exists(`waymark-thumb-${id}`));
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
  await page.mouse.move(8, 8);
  await page.mouse.move(224, 220, { steps: 8 });
  await page.waitForTimeout(250);
  const tooltipTexts = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    const scene: any = g.scene.getScene('BattleScene');
    const texts: string[] = [];
    const walk = (obj: any) => {
      if (!obj) return;
      if (obj.type === 'Text') texts.push(obj.text || '');
      if (Array.isArray(obj.list)) obj.list.forEach(walk);
    };
    scene.children.list.forEach(walk);
    return texts;
  });
  expect(tooltipTexts.some((text) => (
    text.includes('The first time enemy Cover is broken each turn')
    && text.includes('gain 3 Cover')
    && text.includes('gain 1 Resonance')
  ))).toBe(true);
  await page.screenshot({ path: '.artifacts/test-results/waymark-artifact-tooltip.png' });
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
    await wait(80);
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
  expect(result.routeObjects[0].displayHeight).toBeGreaterThan(300);
  expect(result.battleObjects[0].displayHeight).toBeGreaterThan(300);
});

test('flock formation states reshape combat and an unblocked hit shatters Flow', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.enemies && s.enemies.length && s.fxLayer); i += 1) await wait(50);
    const enemy = s.enemies[0];
    s.fxLayer.removeAll(true);
    s.combatFormationShiftBursts = 0;

    // Holding baseline (full Cohesion, no Flow).
    s.flock.hp = s.flock.maxHp; s.flock.flow = 0;
    const holding = s.flockState();

    // Surging hit (Flow full) vs Holding hit - Surge adds +1 outgoing damage.
    enemy.block = 0; enemy.maxHp = 200; enemy.hp = 200;
    s.flock.flow = s.flock.flowMax;
    const surging = s.flockState();
    s.updateFormationFx();
    await wait(80);
    const surgeFormationFx = window.__birdSquadState!().combatFormationShift;
    s.damageEnemy(enemy.id, 5, 'test');
    const surgeDamage = 200 - enemy.hp;

    enemy.block = 0; enemy.hp = 200;
    s.flock.hp = s.flock.maxHp; s.flock.flow = 0; // back to Holding
    s.damageEnemy(enemy.id, 5, 'test');
    const holdDamage = 200 - enemy.hp;

    // Scatter when Cohesion drops below the threshold.
    s.fxLayer.removeAll(true);
    s.combatFormationShiftBursts = 0;
    s.lastFlockState = 'holding';
    s.flock.hp = 1; s.flock.flow = 0;
    const scattered = s.flockState();
    s.updateFormationFx();
    await wait(80);
    const scatterFormationFx = window.__birdSquadState!().combatFormationShift;

    // An unblocked hit shatters Flow back to 0.
    s.flock.hp = s.flock.maxHp; s.flock.flow = 3; s.flock.block = 0;
    s.damageFlock(enemy, 5);
    const flowAfterHit = s.flock.flow;

    return { holding, surging, scattered, surgeDamage, holdDamage, flowAfterHit, surgeFormationFx, scatterFormationFx };
  });
  expect(r.holding).toBe('holding');
  expect(r.surging).toBe('surging');
  expect(r.scattered).toBe('scattered');
  expect(r.surgeDamage).toBe(r.holdDamage + 1); // Surge = +1 outgoing damage
  expect(r.flowAfterHit).toBe(0);               // unblocked hit broke formation
  expect(r.surgeFormationFx.loaded).toBe(true);
  expect(r.surgeFormationFx.rendered).toBe(true);
  expect(r.surgeFormationFx.count).toBeGreaterThanOrEqual(1);
  expect(r.surgeFormationFx.bursts).toBe(1);
  expect(r.scatterFormationFx.loaded).toBe(true);
  expect(r.scatterFormationFx.rendered).toBe(true);
  expect(r.scatterFormationFx.count).toBeGreaterThanOrEqual(1);
  expect(r.scatterFormationFx.bursts).toBe(1);
});

test('flock composition keystone: a Plumes-heavy flock activates its aura (+1 draw)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const menu: any = g.scene.getScene('MenuScene');
    for (let i = 0; i < 20 && !(menu.leaderPanels?.length); i += 1) await wait(50);
    menu.selectLeader('spark_caller'); // 6-Plumes starter → Plumes keystone live
    menu.startRun();
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 20 && !route.runState; i += 1) await wait(50);
    await window.__birdSquadStartScene!('BattleScene', { runState: route.runState, routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene'); g.scene.stop('RouteScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !(s.enemies && s.enemies.length); i += 1) await wait(50);
    return {
      plumes: s.flockSuitCounts().plumes,
      keystone: s.keystoneActive('plumes'),
      handSize: s.hand.length, // base 4 + keystone 1 (+ any deck draw bonus)
    };
  });
  expect(r.plumes).toBeGreaterThanOrEqual(5);
  expect(r.keystone).toBe(true);
  expect(r.handSize).toBeGreaterThanOrEqual(6); // keystone plus deck draw keeps Plumes hands wider
});

test('recursion effects honor draw bonuses and Basins suit gates use the live suit key', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && (!(s.hand && s.hand.length > 1) || !s.enemies?.length); i += 1) await wait(50);
    const card = s.hand[0];
    const enemy = s.enemies[0];
    const mkState = () => ({ previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false });

    s.hand = [];
    s.discardPile = [{ ...card, instanceId: 'return-plus' }];
    s.drawPile = [{ ...card, instanceId: 'draw-plus' }];
    s.returnDiscardToHand('nonMolt', 1);
    const plusOne = { hand: s.hand.length, discard: s.discardPile.length, draw: s.drawPile.length };

    s.hand = [];
    s.discardPile = [{ ...card, instanceId: 'return-zero' }];
    s.drawPile = [{ ...card, instanceId: 'draw-zero' }];
    s.returnDiscardToHand('nonMolt', 0);
    const zero = { hand: s.hand.length, discard: s.discardPile.length, draw: s.drawPile.length };

    s.hand = [
      { ...card, instanceId: 'basins-gate-1', runtime: { ...card.runtime, suit: 'basins' } },
      { ...card, instanceId: 'basins-gate-2', runtime: { ...card.runtime, suit: 'basins' } },
      { ...card, instanceId: 'plumes-gate-1', runtime: { ...card.runtime, suit: 'plumes' } },
    ];
    s.drawPile = [];
    s.discardPile = [];
    const basinsGate = s.checkCardCondition('flockSuit(basins,2)', card, enemy.id, mkState());
    const staleCupsGate = s.checkCardCondition('flockSuit(cups,2)', card, enemy.id, mkState());

    return { plusOne, zero, basinsGate, staleCupsGate };
  });
  expect(r.plusOne).toEqual({ hand: 2, discard: 0, draw: 0 });
  expect(r.zero).toEqual({ hand: 1, discard: 0, draw: 1 });
  expect(r.basinsGate).toBe(true);
  expect(r.staleCupsGate).toBe(false);
});

test('playing four or more cards overextends the flock into Open Sky', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.enemies && s.enemies.length && s.hand && s.hand.length && s.fxLayer); i += 1) await wait(50);

    s.flock.exposed = false;
    s.flock.exposedTurns = 0;
    s.flock.openSkyGuard = 0;
    s.cardsPlayedThisTurn = 3;
    s.applyOverextensionPenalty();
    const safe = { exposed: s.flock.exposed, turns: s.flock.exposedTurns };

    s.cardsPlayedThisTurn = 4;
    s.applyOverextensionPenalty();
    const overextended = { exposed: s.flock.exposed, turns: s.flock.exposedTurns, log: s.log.at(-1) };

    s.flock.hp = 30;
    s.flock.block = 0;
    s.enemies[0].damageBonus = 0;
    s.enemies[0].nextAttackBonus = 0;
    s.damageFlock(s.enemies[0], 5);
    return { safe, overextended, hpAfterHit: s.flock.hp };
  });

  expect(r.safe.exposed).toBe(false);
  expect(r.overextended.exposed).toBe(true);
  expect(r.overextended.turns).toBe(1);
  expect(r.overextended.log).toContain('overextend');
  expect(r.hpAfterHit).toBe(24); // 5 base + 1 Standard Open Sky bonus
});

test('Resonance has real sinks: a threshold gate and a spend-all burst', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && (!(s.hand && s.hand.length) || !s.fxLayer); i += 1) await wait(50);
    const card = s.hand[0];
    const enemy = s.enemies[0];
    const mkState = () => ({ previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false });

    // resonanceAtLeast(N): a hoard gate that does NOT consume Resonance.
    s.spark = 3;
    const gateAt3 = s.checkCardCondition('resonanceAtLeast(3)', card, enemy.id, mkState());
    s.spark = 2;
    const gateAt2 = s.checkCardCondition('resonanceAtLeast(3)', card, enemy.id, mkState());

    // resonanceBurst(n): spend the whole pool for n damage per point.
    enemy.block = 0; enemy.maxHp = 500; enemy.hp = 500;
    s.flock.hp = s.flock.maxHp; s.flock.flow = 0; // Holding (no formation modifier)
    s.spark = 4;
    s.resolveCardEffect('resonanceBurst(2)', card, enemy.id, mkState());
    return { gateAt3, gateAt2, burstDamage: 500 - enemy.hp, sparkAfterBurst: s.spark };
  });
  expect(r.gateAt3).toBe(true);   // 3 banked clears the 3+ gate
  expect(r.gateAt2).toBe(false);  // 2 banked does not
  expect(r.sparkAfterBurst).toBe(0);                 // burst empties the pool
  expect(r.burstDamage).toBeGreaterThanOrEqual(8);   // 4 Resonance x 2 = 8 (+ deck damage bonus)
});

test('Winded stacking matters: perWinded scaling, windedAtLeast gate, consuming burst, overheal Cover', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && (!(s.hand && s.hand.length) || !s.fxLayer); i += 1) await wait(50);
    const card = s.hand[0];
    const enemy = s.enemies[0];
    const mkState = () => ({ previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false });
    s.flock.hp = s.flock.maxHp; s.flock.flow = 0; // Holding (no formation modifier)

    // windedAtLeast(N) threshold gate.
    enemy.weak = 3;
    const gate3 = s.checkCardCondition('windedAtLeast(3)', card, enemy.id, mkState());
    enemy.weak = 2;
    const gate2 = s.checkCardCondition('windedAtLeast(3)', card, enemy.id, mkState());

    // perWinded: damage scales with the target's Winded stacks (no consume).
    enemy.block = 0; enemy.maxHp = 500; enemy.hp = 500; enemy.weak = 3;
    s.resolveCardEffect('damage(target, 2 perWinded)', card, enemy.id, mkState());
    const perWindedDamage = 500 - enemy.hp;     // 2 x 3 (+ deck damage bonus)
    const weakAfterScale = enemy.weak;          // unchanged — perWinded does not consume

    // windedBurst: consume ALL Winded for damage per stack.
    enemy.hp = 500; enemy.weak = 4; enemy.block = 0;
    s.resolveCardEffect('windedBurst(2)', card, enemy.id, mkState());
    const burstDamage = 500 - enemy.hp;         // 2 x 4 (+ deck damage bonus)
    const weakAfterBurst = enemy.weak;          // 0

    // overheal → temp Cover (opt-in: healFlock with overflowToCover = true).
    s.flock.maxHp = 40; s.flock.hp = 38; s.flock.block = 0;
    s.healFlock(10, 'test', true);              // heals 2 to full, 8 spills to Cover
    return { gate3, gate2, perWindedDamage, weakAfterScale, burstDamage, weakAfterBurst, hp: s.flock.hp, cover: s.flock.block };
  });
  expect(r.gate3).toBe(true);
  expect(r.gate2).toBe(false);
  expect(r.perWindedDamage).toBeGreaterThanOrEqual(6); // 2 x 3 Winded
  expect(r.weakAfterScale).toBe(3);                    // perWinded left the stacks
  expect(r.weakAfterBurst).toBe(0);                    // burst consumed them
  expect(r.burstDamage).toBeGreaterThanOrEqual(8);     // 2 x 4 Winded
  expect(r.hp).toBe(40);                               // healed to full
  expect(r.cover).toBeGreaterThanOrEqual(8);           // overheal became Cover
});

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
    const codexButton = menu.children.list.find((child: any) => child.type === 'Rectangle'
      && child.input?.enabled && child.x === 1040 && child.y === 38);
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
  expect((await state()).codexFocus.index).toBe(4);
  await gamepadDown(13);
  const scrolled = await state();
  expect(scrolled.codexFocus.index).toBe(8);
  expect(scrolled.codexFocus.gridScroll).toBeGreaterThan(0);
  await gamepadDown(15);
  expect((await state()).codexFocus.index).toBe(9);
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
      const ready = m.textures.exists('ui-icon-codex-medallion')
        && m.children.list.some((child: any) => child.texture?.key === 'ui-icon-codex-medallion');
      if (ready) break;
      await wait(50);
    }
    const codexIconLoaded = m.textures.exists('ui-icon-codex-medallion');
    const codexIconRendered = m.children.list.some((child: any) => child.texture?.key === 'ui-icon-codex-medallion');
    m.selectLeader('spark_caller');
    m.startRun(); // createInitialRunState marks the starting deck discovered
    await wait(150);
    const acct = JSON.parse(window.localStorage.getItem('birdsquad.account') || '{}');
    const discoveredCount = (acct.discoveredCards || []).length;
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
        && collect(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-cards-medallion')
        && collect(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-major-medallion')
        && collect(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-back-command-frame')
        && collect(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-tab-frame')
        && collect(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-grid-scroll-cue-frame')
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
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-back-command-frame')
      .map((child: any) => ({
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const codexTabFrames = collect(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-tab-frame')
      .map((child: any) => ({
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const codexGridScrollCueFrames = collect(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-grid-scroll-cue-frame')
      .map((child: any) => ({
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        visible: child.visible,
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        name: child.name
      }));
    const codexGridScrollCueFrame = JSON.parse(window.render_game_to_text!()).codexGridScrollCueFrame;
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-aviary-medallion')
        && collect(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-aviary-medallion' && child.visible && child.alpha > 0.9);
      if (ready) break;
      await wait(50);
    }
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
      for (let i = 0; i < 40; i += 1) {
        const ready = cs.textures.exists(suit.textureKey)
          && collect(cs.root).some((child: any) => child.texture?.key === suit.textureKey && child.visible && child.alpha > 0.9);
        if (ready) break;
        await wait(50);
      }
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
      const ready = collect(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-close-command-frame' && child.visible)
        && collect(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-scroll-cue-frame' && child.visible)
        && collect(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-art-preview-frame' && child.visible);
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
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-close-command-frame')
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
      active,
      codexFound: cs.discovered ? cs.discovered.size : 0,
      codexIconLoaded,
      codexIconRendered,
      codexBackCommandFrame: JSON.parse(window.render_game_to_text!()).codexBackCommandFrame,
      codexTabFrame: JSON.parse(window.render_game_to_text!()).codexTabFrame,
      codexCloseCommandFrame: codexDetailState.codexCloseCommandFrame,
      codexScrollCueFrame: codexDetailState.codexScrollCueFrame,
      codexArtPreviewFrame: codexDetailState.codexArtPreviewFrame,
      codexGridScrollCueFrame,
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
  expect(r.active).toBe(true);
  expect(r.codexFound).toBeGreaterThanOrEqual(8);
  expect(r.codexIconLoaded).toBe(true);
  expect(r.codexIconRendered).toBe(true);
  expect(r.codexBackCommandFrame).toEqual({ loaded: true, rendered: true, count: 1 });
  expect(r.codexTabFrame).toEqual({ loaded: true, rendered: true, count: 12 });
  expect(r.codexCloseCommandFrame).toEqual({ loaded: true, rendered: true, count: 1 });
  expect(r.codexScrollCueFrame).toEqual({ loaded: true, rendered: true, count: 1 });
  expect(r.codexArtPreviewFrame).toEqual({ loaded: true, rendered: true, count: 1 });
  expect(r.codexGridScrollCueFrame).toEqual({ loaded: true, rendered: true, count: 1 });
  expect(r.detailOpen).toBeTruthy();
  expect(r.backCommandFrames).toHaveLength(1);
  expect(r.backCommandFrames[0]).toMatchObject({ name: 'codex-back-command-frame', visible: true });
  expect(r.backCommandFrames[0].displayWidth).toBe(132);
  expect(r.backCommandFrames[0].displayHeight).toBe(42);
  expect(r.backCommandFrames[0].alpha).toBeGreaterThan(0.85);
  expect(r.codexCloseFrames).toHaveLength(1);
  expect(r.codexCloseFrames[0]).toMatchObject({ name: 'codex-close-command-frame', visible: true });
  expect(r.codexCloseFrames[0].displayWidth).toBe(46);
  expect(r.codexCloseFrames[0].displayHeight).toBe(46);
  expect(r.codexCloseFrames[0].alpha).toBeGreaterThan(0.85);
  expect(r.codexScrollCueFrames).toHaveLength(1);
  expect(r.codexScrollCueFrames[0]).toMatchObject({ name: 'codex-scroll-cue-frame', visible: true });
  expect(r.codexScrollCueFrames[0].displayWidth).toBe(118);
  expect(r.codexScrollCueFrames[0].displayHeight).toBe(30);
  expect(r.codexScrollCueFrames[0].alpha).toBeGreaterThan(0.55);
  expect(r.codexArtPreviewFrames).toHaveLength(1);
  expect(r.codexArtPreviewFrames[0]).toMatchObject({ name: 'codex-art-preview-frame', visible: true });
  expect(r.codexArtPreviewFrames[0].displayWidth).toBe(358);
  expect(r.codexArtPreviewFrames[0].displayHeight).toBe(534);
  expect(r.codexArtPreviewFrames[0].alpha).toBeGreaterThan(0.8);
  expect(r.codexTabFrames).toHaveLength(12);
  expect(r.codexTabFrames.every((frame: { name: string; visible: boolean }) => frame.name === 'codex-tab-frame' && frame.visible)).toBe(true);
  expect(r.codexTabFrames.some((frame: { alpha: number }) => frame.alpha > 0.7)).toBe(true);
  expect(r.codexTabFrames.every((frame: { alpha: number; displayHeight: number }) => frame.alpha >= 0.45 && frame.displayHeight >= 35)).toBe(true);
  expect(r.codexGridScrollCueFrames).toHaveLength(1);
  expect(r.codexGridScrollCueFrames[0]).toMatchObject({ name: 'codex-grid-scroll-cue-frame', visible: true });
  expect(r.codexGridScrollCueFrames[0].displayWidth).toBe(150);
  expect(r.codexGridScrollCueFrames[0].displayHeight).toBe(34);
  expect(r.codexGridScrollCueFrames[0].alpha).toBeGreaterThan(0.65);
  expect(r.cardsTabTextureLoaded).toBe(true);
  expect(r.cardsTabMedallions.length).toBeGreaterThan(0);
  expect(r.cardsTabMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.majorTabTextureLoaded).toBe(true);
  expect(r.majorTabMedallions.length).toBeGreaterThan(0);
  expect(r.majorTabMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.aviaryTabTextureLoaded).toBe(true);
  expect(r.aviaryTabMedallions.length).toBeGreaterThan(0);
  expect(r.activeAviaryTabMedallions.length).toBeGreaterThan(0);
  expect(r.activeAviaryTabMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.suitTabResults.map((result: { label: string }) => result.label)).toEqual(['Plumes', 'Quills', 'Basins', 'Nests']);
  for (const result of r.suitTabResults as Array<{ loaded: boolean; medallions: Array<{ alpha: number; visible: boolean }> }>) {
    expect(result.loaded).toBe(true);
    expect(result.medallions.length).toBeGreaterThan(0);
    expect(result.medallions.some((icon) => icon.visible && icon.alpha > 0.9)).toBe(true);
  }
  expect(r.lockedCardTextureLoaded).toBe(true);
  expect(r.lockedCardMedallions.length).toBeGreaterThan(0);
  expect(r.lockedCardMedallions.every((icon: { alpha: number }) => icon.alpha > 0.35 && icon.alpha < 0.5)).toBe(true);
});

test('codex: snag cards have their own rightmost tab and render card art', async ({ page }) => {
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

    const rightmost = cs.tabs[cs.tabs.length - 1]?.label;
    cs.activeSection = 'cards';
    cs.activeTab = cs.tabs.length - 1;
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
      rightmost,
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

  expect(r.rightmost).toBe('Snags');
  expect(r.snagCount).toBe(10);
  expect(r.hasSnagTab).toBe(true);
  expect(r.snagsTabTextureLoaded).toBe(true);
  expect(r.snagsTabMedallions.length).toBeGreaterThan(0);
  expect(r.snagsTabMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-items-medallion')
        && cs.textures.exists('ui-icon-codex-items-all-medallion')
        && cs.textures.exists('ui-icon-codex-supplies-medallion')
        && cs.textures.exists('ui-icon-codex-supplies-all-medallion')
        && cs.textures.exists('ui-icon-codex-combat-medallion')
        && cs.textures.exists('ui-icon-codex-route-plan-medallion')
        && cs.textures.exists('ui-icon-codex-flexible-medallion')
        && cs.textures.exists('ui-icon-codex-defense-medallion')
        && cs.textures.exists('ui-icon-codex-recovery-medallion')
        && cs.textures.exists('ui-icon-codex-momentum-medallion')
        && cs.textures.exists('ui-icon-codex-pressure-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-items-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-items-all-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-supplies-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-supplies-all-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-combat-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-route-plan-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-flexible-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-defense-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-recovery-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-momentum-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-pressure-medallion');
      if (ready) break;
      await wait(50);
    }
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-items-all-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-items-all-medallion' && child.visible && child.alpha > 0.9);
      if (ready) break;
      await wait(50);
    }
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-combat-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-combat-medallion' && child.visible && child.alpha > 0.9);
      if (ready) break;
      await wait(50);
    }
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-route-plan-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-route-plan-medallion' && child.visible && child.alpha > 0.9);
      if (ready) break;
      await wait(50);
    }
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-flexible-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-flexible-medallion' && child.visible && child.alpha > 0.9);
      if (ready) break;
      await wait(50);
    }
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-defense-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-defense-medallion' && child.visible && child.alpha > 0.9);
      if (ready) break;
      await wait(50);
    }
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-recovery-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-recovery-medallion' && child.visible && child.alpha > 0.9);
      if (ready) break;
      await wait(50);
    }
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-momentum-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-momentum-medallion' && child.visible && child.alpha > 0.9);
      if (ready) break;
      await wait(50);
    }
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-pressure-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-pressure-medallion' && child.visible && child.alpha > 0.9);
      if (ready) break;
      await wait(50);
    }
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-waymark-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-waymark-medallion');
      if (ready) break;
      await wait(50);
    }
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
      for (let tick = 0; tick < 40; tick += 1) {
        const ready = cs.textures.exists(key)
          && collectObjects(cs.root).some((child: any) => child.texture?.key === key && child.visible && child.alpha > 0.9);
        if (ready) break;
        await wait(50);
      }
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-molt-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-molt-medallion' && child.visible && child.alpha > 0.9);
      if (ready) break;
      await wait(50);
    }
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-boss-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-boss-medallion' && child.visible && child.alpha > 0.9);
      if (ready) break;
      await wait(50);
    }
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
      hasTab: listTexts.some((t) => t === 'Supplies'),
      hasWaymarkTab: waymarkTexts.some((t) => t === 'Waymarks'),
      hasSeedPacket: listTexts.some((t) => /Seed Packet/.test(t)),
      hasWaymarkItem: waymarkTexts.some((t) => /Crowbar Debt|Chalk Wingmark|Rooftop Shortcut/.test(t)),
      hasBottlecap: listTexts.some((t) => /Bottlecap Popper/.test(t)),
      hasBottlecapArt: cs.textures.exists('supply-thumb-bottlecap_popper'),
      hasDetailFullArt: cs.textures.exists('supply-seed_packet') && detailUsesFullArt,
      hasDetailUse: detailTexts.some((t) => /USE/.test(t)),
      hasDetailEffects: detailTexts.some((t) => /healCohesion\(6\)/.test(t)),
      hasDetailTitle: detailTexts.some((t) => /Seed Packet/.test(t)),
    };
  });
  expect(r.totalItems).toBe(89);
  expect(r.waymarks).toBe(58);
  expect(r.supplies).toBe(31);
  expect(r.hasSubtitle).toBe(true);
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
  expect(r.itemMedallions.length).toBeGreaterThan(0);
  expect(r.itemMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.itemsAllMedallionLoaded).toBe(true);
  expect(r.itemsAllMedallions.length).toBeGreaterThan(0);
  expect(r.itemsAllMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.35)).toBe(true);
  expect(r.activeItemsAllMedallions.length).toBeGreaterThan(0);
  expect(r.activeItemsAllMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.supplyMedallionLoaded).toBe(true);
  expect(r.supplyMedallions.length).toBeGreaterThan(0);
  expect(r.supplyMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.suppliesAllMedallionLoaded).toBe(true);
  expect(r.suppliesAllMedallions.length).toBeGreaterThan(0);
  expect(r.suppliesAllMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.combatMedallionLoaded).toBe(true);
  expect(r.combatMedallions.length).toBeGreaterThan(0);
  expect(r.activeCombatMedallions.length).toBeGreaterThan(0);
  expect(r.activeCombatMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.routePlanMedallionLoaded).toBe(true);
  expect(r.routePlanMedallions.length).toBeGreaterThan(0);
  expect(r.activeRoutePlanMedallions.length).toBeGreaterThan(0);
  expect(r.activeRoutePlanMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.flexibleMedallionLoaded).toBe(true);
  expect(r.flexibleMedallions.length).toBeGreaterThan(0);
  expect(r.activeFlexibleMedallions.length).toBeGreaterThan(0);
  expect(r.activeFlexibleMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.defenseMedallionLoaded).toBe(true);
  expect(r.defenseMedallions.length).toBeGreaterThan(0);
  expect(r.activeDefenseMedallions.length).toBeGreaterThan(0);
  expect(r.activeDefenseMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.recoveryMedallionLoaded).toBe(true);
  expect(r.recoveryMedallions.length).toBeGreaterThan(0);
  expect(r.activeRecoveryMedallions.length).toBeGreaterThan(0);
  expect(r.activeRecoveryMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.momentumMedallionLoaded).toBe(true);
  expect(r.momentumMedallions.length).toBeGreaterThan(0);
  expect(r.activeMomentumMedallions.length).toBeGreaterThan(0);
  expect(r.activeMomentumMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.pressureMedallionLoaded).toBe(true);
  expect(r.pressureMedallions.length).toBeGreaterThan(0);
  expect(r.activePressureMedallions.length).toBeGreaterThan(0);
  expect(r.activePressureMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.waymarkMedallionLoaded).toBe(true);
  expect(r.waymarkMedallions.length).toBeGreaterThan(0);
  expect(r.waymarkMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.waymarkFamilyMedallions.every((entry: { loaded: boolean }) => entry.loaded)).toBe(true);
  expect(r.waymarkFamilyMedallions.every((entry: { icons: Array<{ alpha: number; visible: boolean }> }) => (
    entry.icons.some((icon) => icon.visible && icon.alpha > 0.9)
  ))).toBe(true);
  expect(r.moltMedallionLoaded).toBe(true);
  expect(r.moltMedallions.length).toBeGreaterThan(0);
  expect(r.activeMoltMedallions.length).toBeGreaterThan(0);
  expect(r.activeMoltMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.bossMedallionLoaded).toBe(true);
  expect(r.bossMedallions.length).toBeGreaterThan(0);
  expect(r.activeBossMedallions.length).toBeGreaterThan(0);
  expect(r.activeBossMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-glossary-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-glossary-medallion');
      if (ready) break;
      await wait(50);
    }
    const texts = collectTexts(cs);
    const glossaryMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-glossary-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const state = JSON.parse(window.render_game_to_text!());
    return {
      section: state.section,
      stateTerms: state.glossaryTerms,
      glossaryMedallionLoaded: cs.textures.exists('ui-icon-codex-glossary-medallion'),
      glossaryMedallions,
      hasTab: texts.includes('Glossary'),
      hasSubtitle: texts.some((t) => /keywords/.test(t)),
      hasWingbeat: texts.some((t) => t === 'Wingbeat'),
      hasMolt: texts.some((t) => t === 'Molt'),
      hasOpenSky: texts.some((t) => t === 'Open Sky'),
      hasOverextensionSummary: texts.some((t) => /Playing too many cards/.test(t)),
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
  expect(r.glossaryMedallionLoaded).toBe(true);
  expect(r.glossaryMedallions.length).toBeGreaterThan(0);
  expect(r.glossaryMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
});

test('codex: leaders tab renders roster with bespoke medallion', async ({ page }) => {
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-leader-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-leader-medallion');
      if (ready) break;
      await wait(50);
    }
    const texts = collectTexts(cs);
    const leaderMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-leader-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const state = JSON.parse(window.render_game_to_text!());
    return {
      section: state.section,
      leaderCount: state.leaderCount,
      leaderMedallionLoaded: cs.textures.exists('ui-icon-codex-leader-medallion'),
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
  expect(r.leaderMedallionLoaded).toBe(true);
  expect(r.leaderMedallions.length).toBeGreaterThan(0);
  expect(r.leaderMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
});

test('codex: detail dossiers render generated frame art on every detail type', async ({ page }) => {
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
      for (let i = 0; i < 20; i += 1) {
        const frames = collectObjects(cs.root).filter((child: any) => child.texture?.key === 'ui-icon-codex-dossier-frame');
        if (frames.some((frame: any) => frame.visible && frame.alpha > 0.8)) break;
        await wait(50);
      }
      const frames = collectObjects(cs.root)
        .filter((child: any) => child.texture?.key === 'ui-icon-codex-dossier-frame')
        .map((child: any) => ({ alpha: child.alpha, visible: child.visible, name: child.name }));
      const state = JSON.parse(window.render_game_to_text!());
      return { label, id, frames, telemetry: state.codexDossierFrame, detailOpen: state.detailOpen };
    };

    const waymark = cs.allWaymarks().find((entry: any) => entry.id === 'crowbar_debt') ?? cs.allWaymarks()[0];
    const enemy = cs.allCodexEnemies().find((entry: any) => entry.id === 'roof_rat') ?? cs.allCodexEnemies()[0];
    const results = [
      await openDetail('card', 'cards', 'tangled_line', () => { cs.activeTab = cs.tabs.length - 1; }),
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
    expect(result.frames.length, `${result.label} frame count`).toBeGreaterThan(0);
    expect(result.frames.some((frame) => frame.visible && frame.alpha > 0.8 && frame.name === 'codex-dossier-frame')).toBe(true);
    expect(result.telemetry.loaded, `${result.label} telemetry loaded`).toBe(true);
    expect(result.telemetry.rendered, `${result.label} telemetry rendered`).toBe(true);
    expect(result.telemetry.count, `${result.label} telemetry count`).toBeGreaterThan(0);
  }
});

test('codex: browser entries render generated frame art across sections', async ({ page }) => {
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
      for (let i = 0; i < 40; i += 1) {
        const frames = collectObjects(cs.root).filter((child: any) => child.texture?.key === 'ui-icon-codex-entry-frame');
        if (frames.some((frame: any) => frame.visible && frame.alpha > 0.25)) break;
        await wait(50);
      }
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
      await renderMode('items', () => { cs.activeSection = 'items'; cs.activeItemTypeTab = 2; }),
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
    expect(result.frames.length, `${result.label} entry frame count`).toBeGreaterThan(0);
    expect(result.frames.some((frame) => (
      frame.visible
      && frame.name === 'codex-entry-frame'
      && frame.alpha > 0.25
      && frame.width >= 200
      && frame.height >= 90
    )), `${result.label} visible entry frame`).toBe(true);
    expect(result.telemetry.loaded, `${result.label} telemetry loaded`).toBe(true);
    expect(result.telemetry.rendered, `${result.label} telemetry rendered`).toBe(true);
    expect(result.telemetry.count, `${result.label} telemetry count`).toBeGreaterThan(0);
  }
});

test('expanded supplies resolve tactical combat verbs', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const supplyIds = [
      'seed_packet',
      'signal_flare',
      'zip_tie_roll',
      'bottlecap_popper',
      'tar_solvent',
      'feather_splint',
      'mirror_shard',
      'emergency_call',
      'shade_cloth',
      'rooftop_decoy',
      'molt_pin',
      'wire_snips',
      'spare_harness',
      'signal_kite',
      'storm_lantern',
      'cache_key',
      'rain_cape',
      'return_ticket',
      'nest_clamp',
      'smoke_thread',
      'windcatcher_spool',
      'resonance_battery',
      'oath_ledger',
    ];
    const supplyTextureKeys = supplyIds.map((id) => `supply-thumb-${id}`);
    await window.__birdSquadStartScene!('BattleScene', {
      routeNodeId: 'm1_entry',
      runState: {
        deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'swords_ace' }, { id: 'cups_ace' }, { id: 'pentacles_04' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'expanded-supplies-art',
        currentHp: 36,
        scrap: 0,
        routeMarks: [],
        supplies: supplyIds,
        supplySlots: supplyIds.length,
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
      }
    });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && (!(s.enemies && s.enemies.length) || !s.fxLayer); i += 1) await wait(50);
    s.queueCurrentSupplyArtLoad();
    for (let i = 0; i < 60 && !supplyTextureKeys.every((key) => s.textures.exists(key)); i += 1) await wait(100);
    const enemy = s.enemies[0];
    enemy.maxHp = 40;
    enemy.hp = 40;
    enemy.block = 12;
    enemy.weak = 0;
    s.selectedEnemyId = enemy.id;
    s.runSupplies = ['bottlecap_popper', 'tar_solvent', 'wire_snips', 'feather_splint', 'molt_pin', 'storm_lantern'];
    s.runSuppliesUsed = [];

    s.useSupply(0);
    const afterPierce = { hp: enemy.hp, block: enemy.block };
    s.useSupply(0);
    const afterSolvent = { hp: enemy.hp, block: enemy.block };
    s.useSupply(0);
    const afterSnips = { block: enemy.block, winded: enemy.weak };

    s.flock.hp = 20;
    s.flock.weak = 2;
    s.flock.frail = 1;
    s.flock.fouled = 2;
    s.useSupply(0);
    const afterSplint = { hp: s.flock.hp, weak: s.flock.weak, frail: s.flock.frail, fouled: s.flock.fouled };

    s.flock.molt = false;
    s.flock.openSkyGuard = 0;
    s.useSupply(0);
    const afterMolt = { molt: s.flock.molt, guard: s.flock.openSkyGuard };

    const beforeStorm = { energy: s.energy, hp: s.flock.hp, hand: s.hand.length };
    s.useSupply(0);
    const afterStorm = { energy: s.energy, hp: s.flock.hp, hand: s.hand.length };

    return {
      afterPierce,
      afterSolvent,
      afterSnips,
      afterSplint,
      afterMolt,
      beforeStorm,
      afterStorm,
      used: s.runSuppliesUsed,
      hasAllSupplyArt: supplyTextureKeys.every((key) => s.textures.exists(key)),
    };
  });
  expect(r.afterPierce.hp).toBe(35);
  expect(r.afterPierce.block).toBe(12);
  expect(r.afterSolvent.block).toBe(0);
  expect(r.afterSnips.block).toBe(0);
  expect(r.afterSnips.winded).toBe(2);
  expect(r.afterSplint.hp).toBe(24);
  expect(r.afterSplint.weak).toBe(1);
  expect(r.afterSplint.frail).toBe(0);
  expect(r.afterSplint.fouled).toBe(1);
  expect(r.afterMolt.molt).toBe(true);
  expect(r.afterMolt.guard).toBe(2);
  expect(r.afterStorm.energy).toBe(r.beforeStorm.energy + 2);
  expect(r.afterStorm.hp).toBe(r.beforeStorm.hp - 3);
  expect(r.afterStorm.hand).toBeGreaterThanOrEqual(r.beforeStorm.hand);
  expect(r.used).toEqual(['bottlecap_popper', 'tar_solvent', 'wire_snips', 'feather_splint', 'molt_pin', 'storm_lantern']);
  expect(r.hasAllSupplyArt).toBe(true);
});

test('new supplies and build-around Waymarks execute their scaling hooks', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const newSupplyIds = [
      'return_ticket',
      'nest_clamp',
      'smoke_thread',
      'windcatcher_spool',
      'resonance_battery',
      'oath_ledger',
    ];
    const newWaymarkIds = [
      'flock_counterweight',
      'supply_bell',
      'molt_metronome',
      'eave_bloom',
      'plumes_busker_patch',
      'quills_pressure_gauge',
      'basin_overflow_cup',
      'nest_ratchet',
    ];
    const newSupplyTextures = newSupplyIds.map((id) => `supply-thumb-${id}`);
    const newWaymarkTextures = newWaymarkIds.map((id) => `waymark-thumb-${id}`);
    await window.__birdSquadStartScene!('BattleScene', {
      routeNodeId: 'm1_entry',
      runState: {
        deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'swords_ace' }, { id: 'cups_ace' }, { id: 'pentacles_04' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'scaling-items-art',
        currentHp: 36,
        scrap: 0,
        routeMarks: newWaymarkIds,
        supplies: newSupplyIds,
        supplySlots: newSupplyIds.length,
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
      }
    });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !(s.enemies && s.enemies.length && s.hand && s.hand.length && s.fxLayer); i += 1) await wait(50);
    s.queueCurrentSupplyArtLoad();
    s.queueCurrentWaymarkArtLoad();
    for (let i = 0; i < 60 && ![...newSupplyTextures, ...newWaymarkTextures].every((key) => s.textures.exists(key)); i += 1) await wait(100);

    const enemy = s.enemies[0];
    enemy.maxHp = 60;
    enemy.hp = 60;
    enemy.block = 0;
    enemy.weak = 0;
    s.selectedEnemyId = enemy.id;
    const map = (window as any).__birdSquadCurrentMap();
    const nestNode = map.nodes.find((node: any) => node.type === 'nest');

    const discarded = s.hand.pop();
    if (discarded) s.discardPile = [discarded];
    const handBeforeReturn = s.hand.length;
    s.runSupplies = ['return_ticket', 'nest_clamp', 'smoke_thread', 'windcatcher_spool', 'resonance_battery', 'oath_ledger'];
    s.runSuppliesUsed = [];
    s.scrap = 0;
    s.flock.hp = 30;
    s.flock.block = 0;
    s.spark = 0;
    s.nextTurnDrawBonus = 0;
    s.nextTurnEnergyBonus = 0;
    s.pendingNestCoverBonus = 0;
    s.pendingRetainHand = 0;
    s.completedRouteNodeIds = nestNode ? [nestNode.id] : [];

    s.useSupply(0);
    const afterReturn = { hand: s.hand.length, discard: s.discardPile.length };
    s.useSupply(0);
    const afterClamp = { block: s.flock.block, pendingNest: s.pendingNestCoverBonus, retain: s.pendingRetainHand, hadNestNode: !!nestNode };
    s.useSupply(0);
    const afterSmoke = { winded: enemy.weak, nextDraw: s.nextTurnDrawBonus };
    s.useSupply(0);
    const afterWindcatcher = { nextEnergy: s.nextTurnEnergyBonus };
    s.useSupply(0);
    const afterBattery = { hp: enemy.hp, spark: s.spark };
    const hpBeforeLedger = s.flock.hp;
    s.useSupply(0);
    const afterLedger = { scrap: s.scrap, hp: s.flock.hp, beforeHp: hpBeforeLedger };

    s.routeMarks = ['flock_counterweight', 'patched_shoulder_wrap', 'supply_bell'];
    s.flock.block = 0;
    s.energy = 3;
    s.nextTurnEnergyBonus = 0;
    s.pendingRetainHand = 0;
    s.markFiredThisCombat = new Set();
    s.checkRoostRestraintMarks(1, 1, 2);
    const afterCounterweight = {
      block: s.flock.block,
      nextEnergy: s.nextTurnEnergyBonus,
    };
    s.checkNoDamageTurnMarks();
    const afterShoulderWrap = {
      block: s.flock.block,
      retain: s.pendingRetainHand,
    };

    s.runSupplies = ['seed_packet'];
    s.runSuppliesUsed = [];
    if (s.drawPile.length === 0 && s.hand.length > 0) s.drawPile = [{ ...s.hand[0], instanceId: 'supply-bell-draw' }];
    s.pendingSupplyRepeats = 0;
    const handBeforeBell = s.hand.length;
    s.useSupply(0);
    const afterBell = { hand: s.hand.length, repeats: s.pendingSupplyRepeats };

    s.routeMarks = ['molt_metronome', 'eave_bloom'];
    s.markFiredThisCombat = new Set();
    s.flock.molt = false;
    s.flock.block = 0;
    if (s.drawPile.length === 0 && s.hand.length > 0) s.drawPile = [s.hand[0]];
    const handBeforeMolt = s.hand.length;
    s.enterMolt('test');
    const afterMoltMarks = { hand: s.hand.length, block: s.flock.block };

    s.routeMarks = ['plumes_busker_patch', 'quills_pressure_gauge', 'nest_ratchet'];
    s.markFiredThisTurn = new Set();
    s.spark = 0;
    enemy.hp = 20;
    s.pendingNestCoverBonus = 0;
    s.checkSuitPlayedMarks('plumes');
    s.checkSuitPlayedMarks('quills');
    s.checkSuitPlayedMarks('nests');
    const afterSuitMarks = { spark: s.spark, hp: enemy.hp, pendingNest: s.pendingNestCoverBonus };

    s.routeMarks = ['basin_overflow_cup'];
    s.markFiredThisTurn = new Set();
    s.flock.hp = 20;
    s.flock.block = 0;
    s.healFlock(2, 'test heal');
    const afterHealMark = { hp: s.flock.hp, block: s.flock.block };

    return {
      hasNewSupplyArt: newSupplyTextures.every((key) => s.textures.exists(key)),
      hasNewWaymarkArt: newWaymarkTextures.every((key) => s.textures.exists(key)),
      handBeforeReturn,
      afterReturn,
      afterClamp,
      afterSmoke,
      afterWindcatcher,
      afterBattery,
      afterLedger,
      afterCounterweight,
      afterShoulderWrap,
      handBeforeBell,
      afterBell,
      handBeforeMolt,
      afterMoltMarks,
      afterSuitMarks,
      afterHealMark,
    };
  });
  expect(r.hasNewSupplyArt).toBe(true);
  expect(r.hasNewWaymarkArt).toBe(true);
  expect(r.afterReturn.hand).toBeGreaterThanOrEqual(r.handBeforeReturn + 1);
  expect(r.afterReturn.discard).toBe(0);
  expect(r.afterClamp.hadNestNode).toBe(true);
  expect(r.afterClamp.block).toBeGreaterThanOrEqual(8);
  expect(r.afterClamp.pendingNest).toBe(16);
  expect(r.afterClamp.retain).toBe(2);
  expect(r.afterSmoke.winded).toBe(6);
  expect(r.afterSmoke.nextDraw).toBe(2);
  expect(r.afterWindcatcher.nextEnergy).toBe(4);
  expect(r.afterBattery.hp).toBe(48);
  expect(r.afterBattery.spark).toBe(0);
  expect(r.afterLedger.scrap).toBe(50);
  expect(r.afterLedger.hp).toBe(r.afterLedger.beforeHp - 4);
  expect(r.afterCounterweight.block).toBe(3);
  expect(r.afterCounterweight.nextEnergy).toBe(1);
  expect(r.afterShoulderWrap.block).toBe(7);
  expect(r.afterShoulderWrap.retain).toBe(1);
  expect(r.afterBell.hand).toBeGreaterThanOrEqual(r.handBeforeBell + 1);
  expect(r.afterBell.repeats).toBe(1);
  expect(r.afterMoltMarks.hand).toBeGreaterThanOrEqual(r.handBeforeMolt + 1);
  expect(r.afterMoltMarks.block).toBe(6);
  expect(r.afterSuitMarks.spark).toBe(1);
  expect(r.afterSuitMarks.hp).toBe(18);
  expect(r.afterSuitMarks.pendingNest).toBe(4);
  expect(r.afterHealMark.hp).toBe(22);
  expect(r.afterHealMark.block).toBe(4);
});

test('next item pass supplies and Waymarks execute route and combat hooks', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const nextSupplies = [
      'map_sticker_strip',
      'thermos_lid',
      'bus_token_cache',
      'chalk_dust_pouch',
      'market_iou',
      'sky_sugar',
      'anchor_threader',
      'spare_pocket',
    ];
    const nextWaymarks = [
      'broken_cover_chime',
      'spark_ground_clip',
      'quiet_roost_token',
      'double_packed_buckle',
      'ledger_tab',
      'basin_safety_pin',
      'nest_measure_line',
      'plumes_applause_cap',
      'molt_shadow_tag',
      'cache_divining_hook',
    ];
    const mkRunState = (patch: any = {}) => ({
      deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'cups_ace' }, { id: 'swords_ace' }, { id: 'pentacles_04' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed: 'next-items-test',
      currentHp: 24,
      scrap: 12,
      routeMarks: [],
      supplies: [],
      supplySlots: 2,
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
      ...patch,
    });

    await window.__birdSquadStartScene!('RouteScene', {
      runState: mkRunState({
        currentHp: 20,
        routeMarks: ['ledger_tab', 'cache_divining_hook'],
        supplies: ['spare_pocket', 'map_sticker_strip', 'thermos_lid', 'market_iou'],
        supplySlots: 4,
      })
    });
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 40 && !(window as any).render_game_to_text; i += 1) await wait(50);
    const routeSupplyKeys = ['supply-thumb-spare_pocket', 'supply-thumb-map_sticker_strip', 'supply-thumb-thermos_lid', 'supply-thumb-market_iou'];
    route.queueRouteSupplyArtLoad();
    for (let i = 0; i < 60 && !routeSupplyKeys.every((key) => route.textures.exists(key)); i += 1) await wait(100);

    route.useRouteSupply(0);
    const afterPocketText = JSON.parse((window as any).render_game_to_text());
    const afterPocket = {
      slots: route.runState.supplySlots,
      used: [...route.runState.suppliesUsed],
      feedback: afterPocketText.supplyFeedback?.[0],
    };
    route.useRouteSupply(0);
    const afterStickerText = JSON.parse((window as any).render_game_to_text());
    const afterSticker = {
      scrap: route.runState.scrap,
      used: [...route.runState.suppliesUsed],
      planLogged: route.runState.routeLog.some((line: string) => /Route plan set/.test(line)),
      feedback: afterStickerText.supplyFeedback?.[0],
    };
    route.useRouteSupply(0);
    const afterThermos = {
      hp: route.runState.currentHp,
      guard: route.runState.nextCombat?.openSkyGuard ?? 0,
      used: [...route.runState.suppliesUsed],
    };
    route.useRouteSupply(0);
    const afterIou = {
      hp: route.runState.currentHp,
      scrap: route.runState.scrap,
      freePreen: route.runState.freePreenNextDistrict ?? 0,
      used: [...route.runState.suppliesUsed],
    };
    route.runState.scrap = 12;
    route.runState.nextCombat = undefined;
    route.applyRouteMarkTrigger('afterMarketPurchase');
    const afterLedger = { scrap: route.runState.scrap, guard: route.runState.nextCombat?.openSkyGuard ?? 0 };
    route.runState.supplies = [];
    route.runState.supplySlots = 4;
    route.applyRouteMarkTrigger('cacheChoice');
    const afterCacheHook = { supplies: route.runState.supplies.length };

    const routeMap = (window as any).__birdSquadCurrentMap();
    const marketNode = routeMap.nodes.find((node: any) => node.type === 'market');
    route.runState.supplies = ['market_iou'];
    route.runState.suppliesUsed = [];
    route.runState.currentHp = 20;
    route.runState.scrap = 12;
    route.runState.freePreenNextDistrict = 0;
    route.runState.completedRouteNodeIds = marketNode ? [marketNode.id] : [];
    route.useRouteSupply(0);
    const afterIouAfterMarket = {
      hadMarketNode: !!marketNode,
      hp: route.runState.currentHp,
      scrap: route.runState.scrap,
      freePreen: route.runState.freePreenNextDistrict ?? 0,
    };

    const signalNode = routeMap.nodes.find((node: any) => node.type === 'signal');
    route.runState.supplies = ['bus_token_cache'];
    route.runState.suppliesUsed = [];
    route.runState.supplySlots = 4;
    route.runState.scrap = 12;
    route.runState.completedRouteNodeIds = signalNode ? [signalNode.id] : [];
    route.useRouteSupply(0);
    const afterBusAfterSignal = {
      hadSignalNode: !!signalNode,
      scrap: route.runState.scrap,
      supplies: route.runState.supplies.length,
      planLogged: route.runState.routeLog.some((line: string) => /Route plan set/.test(line)),
    };

    const basinNode = routeMap.nodes.find((node: any) => node.type === 'basin');
    route.runState.supplies = ['seed_packet'];
    route.runState.suppliesUsed = [];
    route.runState.currentHp = 20;
    route.runState.completedRouteNodeIds = basinNode ? [basinNode.id] : [];
    route.useRouteSupply(0);
    const afterSeedAfterBasin = {
      hadBasinNode: !!basinNode,
      hp: route.runState.currentHp,
    };

    await window.__birdSquadStartScene!('BattleScene', {
      routeNodeId: 'm1_entry',
      runState: mkRunState({
        currentHp: 32,
        routeMarks: nextWaymarks,
        supplies: nextSupplies,
        supplySlots: 8,
      })
    });
    g.scene.stop('RouteScene');
    const battle: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(battle.enemies && battle.enemies.length && battle.hand && battle.hand.length); i += 1) await wait(50);
    const textureKeys = [
      ...nextSupplies.map((id) => `supply-thumb-${id}`),
      ...nextWaymarks.map((id) => `waymark-thumb-${id}`),
    ];
    battle.queueCurrentSupplyArtLoad();
    battle.queueCurrentWaymarkArtLoad();
    for (let i = 0; i < 100 && !textureKeys.every((key) => battle.textures.exists(key)); i += 1) await wait(100);

    const enemy = battle.enemies[0];
    enemy.maxHp = 60;
    enemy.hp = 60;
    enemy.block = 6;
    battle.selectedEnemyId = enemy.id;
    const filler = battle.hand[0] ?? battle.drawPile[0] ?? battle.discardPile[0];
    if (filler) {
      for (let i = battle.drawPile.length; i < 10; i += 1) {
        battle.drawPile.push({ ...filler, instanceId: `test-draw-${i}` });
      }
    }

    battle.routeMarks = ['broken_cover_chime'];
    battle.markFiredThisTurn = new Set();
    battle.runSupplies = ['chalk_dust_pouch', 'sky_sugar', 'anchor_threader'];
    battle.runSuppliesUsed = [];
    battle.energy = 3;
    battle.spark = 0;
    battle.flock.block = 0;
    battle.pendingRetainHand = 0;
    battle.nextTurnDrawBonus = 0;
    const handBeforeChalk = battle.hand.length;
    battle.useSupply(0);
    const afterChalkState = (window as any).__birdSquadState();
    const afterChalk = {
      block: enemy.block,
      hand: battle.hand.length,
      beforeHand: handBeforeChalk,
      spark: battle.spark,
      feedback: afterChalkState.supplyFeedback?.[0],
      waymarkFeedback: afterChalkState.waymarkFeedback?.[0],
    };
    const handBeforeSugar = battle.hand.length;
    battle.useSupply(0);
    const afterSugar = { energy: battle.energy, nextDraw: battle.nextTurnDrawBonus, hand: battle.hand.length, beforeHand: handBeforeSugar };
    battle.useSupply(0);
    const afterAnchor = { block: battle.flock.block, retain: battle.pendingRetainHand, pendingNest: battle.pendingNestCoverBonus };

    const map = (window as any).__birdSquadCurrentMap();
    const cacheNode = map.nodes.find((node: any) => node.type === 'cache');
    battle.completedRouteNodeIds = cacheNode ? [cacheNode.id] : [];
    battle.runSupplies = ['cache_key'];
    battle.runSuppliesUsed = [];
    battle.flock.block = 0;
    const handBeforeCacheKey = battle.hand.length;
    battle.useSupply(0);
    const afterCacheKey = {
      block: battle.flock.block,
      hand: battle.hand.length,
      beforeHand: handBeforeCacheKey,
      hadCacheNode: !!cacheNode,
    };

    battle.routeMarks = ['spark_ground_clip'];
    battle.markFiredThisCombat = new Set();
    battle.spark = 2;
    battle.flock.block = 0;
    battle.spendResonance(1);
    const afterSparkClip = { spark: battle.spark, block: battle.flock.block };

    battle.routeMarks = ['quiet_roost_token'];
    battle.markFiredThisCombat = new Set();
    battle.flock.maxHp = 40;
    battle.flock.hp = 20;
    battle.checkNoDamageTurnMarks();
    const afterQuietRoost = { hp: battle.flock.hp };

    battle.routeMarks = ['double_packed_buckle'];
    battle.markFiredThisCombat = new Set();
    battle.pendingSupplyRepeats = 0;
    if (battle.drawPile.length === 0 && battle.hand.length > 0) battle.drawPile = [{ ...battle.hand[0], instanceId: 'buckle-draw' }];
    const handBeforeBuckle = battle.hand.length;
    battle.checkSupplyUsedMarks();
    const afterDoublePacked = { pending: battle.pendingSupplyRepeats, hand: battle.hand.length, beforeHand: handBeforeBuckle };
    battle.routeMarks = [];
    battle.runSupplies = ['seed_packet'];
    battle.runSuppliesUsed = [];
    battle.flock.hp = 20;
    battle.useSupply(0);
    const afterRepeatedState = (window as any).__birdSquadState();
    const afterRepeatedSupply = {
      hp: battle.flock.hp,
      pending: battle.pendingSupplyRepeats,
      feedback: afterRepeatedState.supplyFeedback?.[0],
    };

    battle.routeMarks = ['basin_safety_pin'];
    battle.markFiredThisTurn = new Set();
    battle.flock.hp = 20;
    battle.flock.block = 0;
    battle.flock.weak = 2;
    battle.flock.frail = 2;
    battle.flock.fouled = 2;
    battle.healFlock(2, 'test heal');
    const afterSafetyPin = { hp: battle.flock.hp, block: battle.flock.block, weak: battle.flock.weak, frail: battle.flock.frail, fouled: battle.flock.fouled };

    battle.routeMarks = ['nest_measure_line'];
    battle.markFiredThisTurn = new Set();
    battle.pendingRetainHand = 0;
    battle.pendingNestCoverBonus = 0;
    battle.checkSuitPlayedMarks('nests');
    const afterMeasureLine = { retain: battle.pendingRetainHand, pendingNest: battle.pendingNestCoverBonus };

    battle.routeMarks = ['plumes_applause_cap'];
    battle.markFiredThisCombat = new Set();
    battle.cardsPlayedThisTurn = 2;
    battle.spark = 0;
    battle.nextTurnDrawBonus = 0;
    battle.checkRoostRestraintMarks(0, 0, 2);
    const afterApplauseCap = { spark: battle.spark, nextDraw: battle.nextTurnDrawBonus };

    battle.routeMarks = ['molt_shadow_tag'];
    battle.markFiredThisCombat = new Set();
    battle.flock.molt = false;
    battle.flock.openSkyGuard = 0;
    battle.enterMolt('test molt');
    const afterShadowTag = { guard: battle.flock.openSkyGuard };

    return {
      hasRouteSupplyArt: routeSupplyKeys.every((key) => route.textures.exists(key)),
      hasNextPassArt: textureKeys.every((key) => battle.textures.exists(key)),
      afterPocket,
      afterSticker,
      afterThermos,
      afterIou,
      afterLedger,
      afterCacheHook,
      afterIouAfterMarket,
      afterBusAfterSignal,
      afterSeedAfterBasin,
      afterChalk,
      afterSugar,
      afterAnchor,
      afterCacheKey,
      afterSparkClip,
      afterQuietRoost,
      afterDoublePacked,
      afterRepeatedSupply,
      afterSafetyPin,
      afterMeasureLine,
      afterApplauseCap,
      afterShadowTag,
    };
  });
  expect(r.hasRouteSupplyArt).toBe(true);
  expect(r.hasNextPassArt).toBe(true);
  expect(r.afterPocket.slots).toBe(5);
  expect(r.afterPocket.used).toContain('spare_pocket');
  expect(r.afterPocket.feedback.id).toBe('spare_pocket');
  expect(r.afterPocket.feedback.summary).toContain('Supply capacity');
  expect(r.afterSticker.planLogged).toBe(true);
  expect(r.afterSticker.scrap).toBe(27);
  expect(r.afterSticker.feedback.id).toBe('map_sticker_strip');
  expect(r.afterSticker.feedback.summary).toContain('Open Sky Guard');
  expect(r.afterThermos.hp).toBe(25);
  expect(r.afterThermos.guard).toBe(2);
  expect(r.afterIou.hp).toBe(24);
  expect(r.afterIou.scrap).toBe(47);
  expect(r.afterIou.freePreen).toBe(1);
  expect(r.afterLedger.scrap).toBe(24);
  expect(r.afterLedger.guard).toBe(2);
  expect(r.afterCacheHook.supplies).toBe(1);
  expect(r.afterIouAfterMarket.hadMarketNode).toBe(true);
  expect(r.afterIouAfterMarket.hp).toBe(20);
  expect(r.afterIouAfterMarket.scrap).toBe(32);
  expect(r.afterIouAfterMarket.freePreen).toBe(1);
  expect(r.afterBusAfterSignal.hadSignalNode).toBe(true);
  expect(r.afterBusAfterSignal.scrap).toBe(32);
  expect(r.afterBusAfterSignal.supplies).toBe(1);
  expect(r.afterBusAfterSignal.planLogged).toBe(true);
  expect(r.afterSeedAfterBasin.hadBasinNode).toBe(true);
  expect(r.afterSeedAfterBasin.hp).toBe(28);
  expect(r.afterChalk.block).toBe(0);
  expect(r.afterChalk.hand).toBeGreaterThanOrEqual(r.afterChalk.beforeHand + 1);
  expect(r.afterChalk.feedback.id).toBe('chalk_dust_pouch');
  expect(r.afterChalk.feedback.summary).toContain('Remove');
  expect(r.afterChalk.waymarkFeedback.id).toBe('broken_cover_chime');
  expect(r.afterChalk.spark).toBe(1);
  expect(r.afterSugar.energy).toBe(4);
  expect(r.afterSugar.nextDraw).toBe(1);
  expect(r.afterSugar.hand).toBeGreaterThanOrEqual(r.afterSugar.beforeHand + 1);
  expect(r.afterAnchor.block).toBeGreaterThanOrEqual(6);
  expect(r.afterAnchor.retain).toBe(1);
  expect(r.afterAnchor.pendingNest).toBe(3);
  expect(r.afterCacheKey.hadCacheNode).toBe(true);
  expect(r.afterCacheKey.block).toBeGreaterThanOrEqual(8);
  expect(r.afterCacheKey.hand).toBeGreaterThanOrEqual(r.afterCacheKey.beforeHand + 2);
  expect(r.afterSparkClip.spark).toBe(1);
  expect(r.afterSparkClip.block).toBe(7);
  expect(r.afterQuietRoost.hp).toBe(23);
  expect(r.afterDoublePacked.pending).toBe(1);
  expect(r.afterDoublePacked.hand).toBeGreaterThanOrEqual(r.afterDoublePacked.beforeHand + 1);
  expect(r.afterRepeatedSupply.hp).toBe(32);
  expect(r.afterRepeatedSupply.pending).toBe(0);
  expect(r.afterRepeatedSupply.feedback.id).toBe('seed_packet');
  expect(r.afterRepeatedSupply.feedback.summary).toContain('x2');
  expect(r.afterSafetyPin.hp).toBe(22);
  expect(r.afterSafetyPin.block).toBe(3);
  expect(r.afterSafetyPin.weak).toBe(1);
  expect(r.afterSafetyPin.frail).toBe(1);
  expect(r.afterSafetyPin.fouled).toBe(1);
  expect(r.afterMeasureLine.retain).toBe(1);
  expect(r.afterMeasureLine.pendingNest).toBe(3);
  expect(r.afterApplauseCap.spark).toBe(1);
  expect(r.afterApplauseCap.nextDraw).toBe(1);
  expect(r.afterShadowTag.guard).toBe(2);
});

test('enemy codex: entire enemy cast renders with art and details', async ({ page }) => {
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
    for (let i = 0; i < 40; i += 1) {
      const ready = cs.textures.exists('ui-icon-codex-enemy-medallion')
        && collectObjects(cs.root).some((child: any) => child.texture?.key === 'ui-icon-codex-enemy-medallion');
      if (ready) break;
      await wait(50);
    }
    const enemyMedallions = collectObjects(cs.root)
      .filter((child: any) => child.texture?.key === 'ui-icon-codex-enemy-medallion')
      .map((child: any) => ({ alpha: child.alpha, visible: child.visible }));
    const districtMedallionKeys = [
      'ui-icon-codex-enemy-all-medallion',
      'ui-icon-codex-enemy-rooftops-medallion',
      'ui-icon-codex-enemy-canals-medallion',
      'ui-icon-codex-enemy-signals-medallion',
      'ui-icon-codex-enemy-roost-medallion',
    ];
    const districtMedallions = [];
    for (let i = 0; i < districtMedallionKeys.length; i += 1) {
      const key = districtMedallionKeys[i];
      cs.activeEnemyTab = i;
      cs.detailId = undefined;
      cs.renderAll();
      for (let tick = 0; tick < 40; tick += 1) {
        const ready = cs.textures.exists(key)
          && collectObjects(cs.root).some((child: any) => child.texture?.key === key);
        if (ready) break;
        await wait(50);
      }
      districtMedallions.push({
        key,
        loaded: cs.textures.exists(key),
        icons: collectObjects(cs.root)
          .filter((child: any) => child.texture?.key === key)
          .map((child: any) => ({ alpha: child.alpha, visible: child.visible })),
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
      enemyMedallionLoaded: cs.textures.exists('ui-icon-codex-enemy-medallion'),
      enemyMedallions,
      districtMedallions,
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
  expect(r.enemyMedallionLoaded).toBe(true);
  expect(r.enemyMedallions.length).toBeGreaterThan(0);
  expect(r.enemyMedallions.some((icon: { alpha: number; visible: boolean }) => icon.visible && icon.alpha > 0.9)).toBe(true);
  expect(r.districtMedallions.every((entry: { loaded: boolean }) => entry.loaded)).toBe(true);
  expect(r.districtMedallions.every((entry: { icons: Array<{ alpha: number; visible: boolean }> }) => (
    entry.icons.some((icon) => icon.visible && icon.alpha > 0.9)
  ))).toBe(true);
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

test('Cover and Heal are distinct axes, and the new card verbs work', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && (!(s.hand && s.hand.length) || !s.fxLayer); i += 1) await wait(50);
    const card = s.hand[0];
    const enemy = s.enemies[0];
    const mkState = () => ({ previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false });
    s.flock.flow = 0; s.flock.molt = false;

    // Plain heal at full Cohesion is WASTED (no overflow to Cover).
    s.flock.maxHp = 40; s.flock.hp = 40; s.flock.block = 0;
    s.resolveCardEffect('heal(5)', card, enemy.id, mkState());
    const coverAfterPlainHeal = s.flock.block;

    // overhealCover converts the overflow to Cover.
    s.flock.hp = 40; s.flock.block = 0;
    s.resolveCardEffect('overhealCover(5)', card, enemy.id, mkState());
    const coverAfterOverheal = s.flock.block;

    // perCover damage scales with current Cover.
    s.flock.block = 6; enemy.block = 0; enemy.maxHp = 500; enemy.hp = 500;
    s.resolveCardEffect('damage(target, 1 perCover)', card, enemy.id, mkState());
    const perCoverDamage = 500 - enemy.hp;

    // loseCohesion is a self-cost, clamped to a minimum of 1.
    s.flock.hp = 3;
    s.resolveCardEffect('loseCohesion(10)', card, enemy.id, mkState());
    const hpAfterLose = s.flock.hp;

    return { coverAfterPlainHeal, coverAfterOverheal, perCoverDamage, hpAfterLose };
  });
  expect(r.coverAfterPlainHeal).toBe(0);                 // heal no longer makes Cover at full
  expect(r.coverAfterOverheal).toBeGreaterThanOrEqual(5); // overhealCover does
  expect(r.perCoverDamage).toBeGreaterThanOrEqual(6);     // 1 x 6 Cover (+ deck damage)
  expect(r.hpAfterLose).toBe(1);                         // loseCohesion clamps to 1
});

test('new balance verbs: timed Waymarks, self-loop cards, and anti-Cover conditionals', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && (!(s.hand && s.hand.length) || !s.fxLayer); i += 1) await wait(50);
    const card = s.hand[0];
    const enemy = s.enemies[0];

    s.routeMarks = ['black_ink_pin'];
    s.markFiredThisCombat = new Set();
    s.energy = 3;
    s.nextTurnEnergyBonus = 0;
    s.checkRoostRestraintMarks(1, 0, 2);
    const nextEnergyAfterHeldCardRoost = s.nextTurnEnergyBonus;

    s.routeMarks = ['fresh_pinfeather'];
    s.markFiredThisCombat = new Set();
    s.nextTurnEnergyBonus = 0;
    s.checkEnterMoltMarks();
    const nextEnergyAfterMolt = s.nextTurnEnergyBonus;

    const fakeLoopCard = {
      ...card,
      runtime: {
        ...card.runtime,
        effects: ['shuffleSelfToDraw()'],
        upgrade: { ...card.runtime.upgrade, effects: ['shuffleSelfToDraw()'] }
      },
      upgraded: false
    };
    const loopOutcome = s.resolveCardEffects(fakeLoopCard, enemy.id);

    s.fxLayer.removeAll(true);
    s.combatCoverShatterBursts = 0;
    enemy.block = 5;
    enemy.maxHp = 50;
    enemy.hp = 50;
    const fakeShatterCard = {
      ...card,
      runtime: {
        ...card.runtime,
        effects: ['removeCover(target, 2)'],
        upgrade: { ...card.runtime.upgrade, effects: ['removeCover(target, 3)'] }
      },
      upgraded: false
    };
    s.resolveCardEffect('removeCover(target, 2)', fakeShatterCard, enemy.id, {
      previousDiscarded: 0,
      previousDamageDefeated: false,
      spentResonance: false,
      returnSelfToDraw: false,
      exhaustSelf: false,
      builtFlow: false,
      flockDamageBonusUsed: false
    });
    const coverShatterState = window.__birdSquadState!().combatCoverShatter;

    s.fxLayer.removeAll(true);
    enemy.block = 5;
    enemy.maxHp = 50;
    enemy.hp = 50;
    const fakeBreakerCard = {
      ...card,
      runtime: {
        ...card.runtime,
        effects: [
          'if targetHasCover then removeCover(target, 2)',
          'if targetHasCover then damagePierce(target, 2)'
        ],
        upgrade: {
          ...card.runtime.upgrade,
          effects: [
            'if targetHasCover then removeCover(target, 3)',
            'if targetHasCover then damagePierce(target, 3)'
          ]
        }
      },
      upgraded: false
    };
    s.resolveCardEffects(fakeBreakerCard, enemy.id);

    return {
      nextEnergyAfterHeldCardRoost,
      nextEnergyAfterMolt,
      returnSelfToDraw: loopOutcome.returnSelfToDraw,
      enemyBlockAfterBreaker: enemy.block,
      enemyHpAfterBreaker: enemy.hp,
      combatCoverShatter: coverShatterState
    };
  });
  expect(r.nextEnergyAfterHeldCardRoost).toBe(1);
  expect(r.nextEnergyAfterMolt).toBe(1);
  expect(r.returnSelfToDraw).toBe(true);
  expect(r.enemyBlockAfterBreaker).toBe(3);
  expect(r.enemyHpAfterBreaker).toBeLessThanOrEqual(48);
  expect(r.combatCoverShatter.loaded).toBe(true);
  expect(r.combatCoverShatter.rendered).toBe(true);
  expect(r.combatCoverShatter.count).toBeGreaterThanOrEqual(1);
  expect(r.combatCoverShatter.bursts).toBeGreaterThanOrEqual(1);
});

test('Molt is a do-DIFFERENT transform stance: a card resolves its molt ability while Molting', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && (!(s.hand && s.hand.length) || !s.combatPreviewModule); i += 1) await wait(50);
    // Locked Nest (in the Fledgling deck): normal = gainCover(6), Molt = damage.
    const nest = [...s.drawPile, ...s.hand, ...s.discardPile].find((c: any) => c.id === 'pentacles_04');
    const enemy = s.enemies[0];

    const hasMoltText = !!(nest && nest.moltText);
    const moltCueBefore = window.__birdSquadState!().audio?.cueRequests?.moltPower ?? 0;

    // Normal mode: gains Cover, deals no damage.
    s.flock.flow = 0; s.flock.molt = false; s.flock.block = 0;
    enemy.block = 0; enemy.maxHp = 500; enemy.hp = 500;
    const normalResolution = s.resolveCardEffects(nest, enemy.id);
    const moltCueAfterNormal = window.__birdSquadState!().audio?.cueRequests?.moltPower ?? 0;
    const coverNormal = s.flock.block;
    const dmgNormal = 500 - enemy.hp;

    // Molt mode: the wall lashes out — deals damage, no Cover.
    s.flock.molt = true; s.flock.block = 0; enemy.hp = 500;
    const baseMoltPower = s.activeMoltPower();
    const basePreview = s.simulateCardOutcome(nest, enemy.id);
    const moltResolution = s.resolveCardEffects(nest, enemy.id);
    const moltCueAfterBase = window.__birdSquadState!().audio?.cueRequests?.moltPower ?? 0;
    const coverMolt = s.flock.block;
    const dmgMolt = 500 - enemy.hp;

    // A deck stat carrier proves Molt Power is not merely a fixed display value.
    s.discardPile.push({
      ...nest,
      id: 'molt_power_test_carrier',
      instanceId: 'molt_power_test_carrier_1',
      runtime: {
        ...nest.runtime,
        id: 'molt_power_test_carrier',
        flockStats: { ...nest.runtime.flockStats, moltPower: 2 },
      },
    });
    enemy.hp = 500;
    const poweredMoltPower = s.activeMoltPower();
    const poweredPreview = s.simulateCardOutcome(nest, enemy.id);
    const poweredResolution = s.resolveCardEffects(nest, enemy.id);
    const moltCueAfterPowered = window.__birdSquadState!().audio?.cueRequests?.moltPower ?? 0;
    const dmgPowered = 500 - enemy.hp;
    const feedback = window.__birdSquadState!().combatMoltPower;

    return {
      hasMoltText,
      moltCueBefore,
      moltCueAfterNormal,
      moltCueAfterBase,
      moltCueAfterPowered,
      coverNormal,
      dmgNormal,
      normalMoltPowerApplied: normalResolution.moltApplied,
      coverMolt,
      dmgMolt,
      baseMoltPower,
      basePreviewDamage: basePreview.enemyDamage,
      basePreviewMoltPower: basePreview.moltPowerApplied,
      baseResolutionMoltPower: moltResolution.moltApplied,
      poweredMoltPower,
      poweredPreviewDamage: poweredPreview.enemyDamage,
      poweredPreviewMoltPower: poweredPreview.moltPowerApplied,
      poweredResolutionMoltPower: poweredResolution.moltApplied,
      dmgPowered,
      feedback,
    };
  });
  expect(r.hasMoltText).toBe(true);                 // every card has a molt ability
  expect(r.coverNormal).toBeGreaterThanOrEqual(6);  // normal: gains Cover
  expect(r.dmgNormal).toBe(0);                      // normal: no damage
  expect(r.coverMolt).toBe(0);                      // molt: no Cover (does DIFFERENT)
  expect(r.dmgMolt).toBeGreaterThanOrEqual(7);      // molt: deals damage instead
  expect(r.normalMoltPowerApplied).toBe(0);
  expect(r.moltCueAfterNormal).toBe(r.moltCueBefore);
  expect(r.moltCueAfterBase).toBe(r.moltCueBefore + 1);
  expect(r.moltCueAfterPowered).toBe(r.moltCueBefore + 2);
  expect(r.baseMoltPower).toBeGreaterThanOrEqual(2);
  expect(r.basePreviewDamage).toBe(r.dmgMolt);
  expect(r.basePreviewMoltPower).toBe(r.baseMoltPower);
  expect(r.baseResolutionMoltPower).toBe(r.baseMoltPower);
  expect(r.poweredMoltPower).toBe(r.baseMoltPower + 2);
  expect(r.poweredPreviewDamage).toBe(r.dmgPowered);
  expect(r.poweredPreviewMoltPower).toBe(r.poweredMoltPower);
  expect(r.poweredResolutionMoltPower).toBe(r.poweredMoltPower);
  expect(r.dmgPowered).toBe(r.dmgMolt + 2);
  expect(r.feedback.total).toBe(r.poweredMoltPower);
  expect(r.feedback.bursts).toBeGreaterThanOrEqual(2);
  expect(r.feedback.rendered).toBe(true);
});

test('Molt active card contract drives hand display and enemy targeting', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !(s.hand && s.hand.length); i += 1) await wait(50);
    const enemy = s.enemies[0];
    const card = [...s.drawPile, ...s.hand, ...s.discardPile].find((c: any) => c.id === 'pentacles_04');
    s.drawPile = s.drawPile.filter((c: any) => c.instanceId !== card.instanceId);
    s.discardPile = s.discardPile.filter((c: any) => c.instanceId !== card.instanceId);
    s.hand = [card];
    s.flock.molt = true;
    s.energy = 99;
    s.selectedEnemyId = '';
    enemy.hp = 500;
    s.renderAll();

    const handPayload = window.__birdSquadState!().hand[0];
    s.onCardClicked(card.instanceId);
    const selectedOutcome = window.__birdSquadState!().selectedCardOutcome;
    const selectedAfterCardClick = s.selectedInstanceId === card.instanceId;
    const hpAfterCardClick = enemy.hp;
    s.onEnemyClicked(enemy.id);
    window.advanceTime!(3000);

    return {
      activeTarget: handPayload.activeTarget,
      activeText: handPayload.activeText,
      usesMolt: handPayload.usesMolt,
      selectedOutcome,
      selectedAfterCardClick,
      hpAfterCardClick,
      hpAfterEnemyClick: enemy.hp,
      handAfterEnemyClick: s.hand.length,
    };
  });

  expect(r.usesMolt).toBe(true);
  expect(r.activeTarget).toBe('enemy');
  expect(r.activeText).toContain('Deal');
  expect(r.selectedOutcome.moltPower.applied).toBeGreaterThanOrEqual(2);
  expect(r.selectedOutcome.summary).toContain('Molt Power');
  expect(r.selectedAfterCardClick).toBe(true);
  expect(r.hpAfterCardClick).toBe(500);
  expect(r.hpAfterEnemyClick).toBeLessThan(500);
  expect(r.handAfterEnemyClick).toBe(0);
});

test('Molt Power applies once to the first positive line and scales area damage at half strength', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    game.scene.stop('MenuScene');
    const scene: any = game.scene.getScene('BattleScene');
    for (let i = 0; i < 40 && (!(scene.hand && scene.hand.length) || !scene.combatPreviewModule); i += 1) await wait(50);
    const base = scene.hand[0];
    scene.enemies = [
      { ...scene.enemies[0], id: 'molt_target_a', hp: 500, maxHp: 500, block: 0 },
      { ...scene.enemies[0], id: 'molt_target_b', hp: 500, maxHp: 500, block: 0 },
    ];
    scene.selectedEnemyId = scene.enemies[0].id;
    scene.flock.hp = Math.max(1, scene.flock.maxHp - 20);
    scene.flock.block = 0;

    const previewPair = (id: string, effects: string[]) => {
      const card = {
        ...base,
        id,
        instanceId: `${id}_1`,
        upgraded: false,
        target: 'enemy',
        text: effects.join('; '),
        moltText: effects.join('; '),
        runtime: {
          ...base.runtime,
          id,
          effects,
          moltEffects: effects,
        },
      };
      scene.flock.molt = false;
      const normal = scene.simulateCardOutcome(card, scene.enemies[0].id);
      scene.flock.molt = true;
      const molt = scene.simulateCardOutcome(card, scene.enemies[0].id);
      return { normal, molt };
    };

    const coverFirst = previewPair('molt_cover_first', ['damage(target, 0)', 'gainCover(3)', 'heal(4)']);
    const healFirst = previewPair('molt_heal_first', ['heal(4)', 'gainCover(3)']);
    const area = previewPair('molt_area', ['damageAll(4)']);
    return {
      power: scene.activeMoltPower(),
      coverFirst: {
        applied: coverFirst.molt.moltPowerApplied,
        coverDelta: coverFirst.molt.coverGain - coverFirst.normal.coverGain,
        healDelta: coverFirst.molt.cohesionDelta - coverFirst.normal.cohesionDelta,
      },
      healFirst: {
        applied: healFirst.molt.moltPowerApplied,
        coverDelta: healFirst.molt.coverGain - healFirst.normal.coverGain,
        healDelta: healFirst.molt.cohesionDelta - healFirst.normal.cohesionDelta,
      },
      area: {
        applied: area.molt.moltPowerApplied,
        perTargetDelta: area.molt.enemyStates.map((enemy: any, index: number) =>
          (area.normal.enemyStates[index].hpAfter - enemy.hpAfter)),
      },
    };
  });

  expect(r.coverFirst.applied).toBe(r.power);
  expect(r.coverFirst.coverDelta).toBe(r.power);
  expect(r.coverFirst.healDelta).toBe(0);
  expect(r.healFirst.applied).toBe(r.power);
  expect(r.healFirst.healDelta).toBe(r.power);
  expect(r.healFirst.coverDelta).toBe(0);
  expect(r.area.applied).toBe(Math.ceil(r.power / 2));
  expect(r.area.perTargetDelta).toEqual([Math.ceil(r.power / 2), Math.ceil(r.power / 2)]);
});

test('none-target cards that Molt into target effects no longer auto-fire ambiguously', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !(s.hand && s.hand.length); i += 1) await wait(50);
    const enemy = s.enemies[0];
    const base = s.hand[0];
    const fake = {
      ...base,
      instanceId: 'fake_none_molt_target_1',
      id: 'fake_none_molt_target',
      name: 'Fake Molt Target',
      target: 'none',
      cost: 0,
      text: 'Draw 1.',
      upgradedText: 'Draw 2.',
      moltText: 'Deal 3. Apply 1 Winded.',
      moltTextUpgraded: 'Deal 5. Apply 1 Winded.',
      runtime: {
        ...base.runtime,
        id: 'fake_none_molt_target',
        displayName: 'Fake Molt Target',
        target: 'none',
        effects: ['draw(1)'],
        moltEffects: ['damage(target, 3)', 'applyWinded(target, 1)'],
        upgrade: {
          ...base.runtime.upgrade,
          effects: ['draw(2)'],
          moltEffects: ['damage(target, 5)', 'applyWinded(target, 1)'],
        },
      },
    };
    s.hand = [fake];
    s.drawPile = [];
    s.discardPile = [];
    s.flock.molt = true;
    s.energy = 99;
    s.selectedEnemyId = '';
    enemy.hp = 500;
    enemy.weak = 0;
    s.renderAll();

    const handPayload = window.__birdSquadState!().hand[0];
    s.onCardClicked(fake.instanceId);
    const afterCardClick = {
      selected: s.selectedInstanceId,
      hp: enemy.hp,
      weak: enemy.weak,
      hand: s.hand.length,
    };
    s.onEnemyClicked(enemy.id);
    window.advanceTime!(3000);

    return {
      activeTarget: handPayload.activeTarget,
      usesMolt: handPayload.usesMolt,
      afterCardClick,
      afterEnemyClick: { hp: enemy.hp, weak: enemy.weak, hand: s.hand.length },
    };
  });

  expect(r.usesMolt).toBe(true);
  expect(r.activeTarget).toBe('enemy');
  expect(r.afterCardClick.selected).toBe('fake_none_molt_target_1');
  expect(r.afterCardClick.hp).toBe(500);
  expect(r.afterCardClick.weak).toBe(0);
  expect(r.afterCardClick.hand).toBe(1);
  expect(r.afterEnemyClick.hp).toBeLessThan(500);
  expect(r.afterEnemyClick.weak).toBeGreaterThan(0);
  expect(r.afterEnemyClick.hand).toBe(0);
});

test('preened cards have a stronger Molt ability, and the Codex carries tarot and Aviary notes correctly', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !(s.hand && s.hand.length); i += 1) await wait(50);
    const nest = [...s.drawPile, ...s.hand, ...s.discardPile].find((c: any) => c.id === 'pentacles_04');
    const enemy = s.enemies[0];
    enemy.block = 0; enemy.maxHp = 500;

    // Base molt (not preened): damage(7).
    s.flock.molt = true; nest.upgraded = false; enemy.hp = 500;
    s.resolveCardEffects(nest, enemy.id);
    const dmgBaseMolt = 500 - enemy.hp;

    // Preened molt: the upgraded molt ability is strictly stronger.
    nest.upgraded = true; s.flock.molt = true; enemy.hp = 500;
    s.resolveCardEffects(nest, enemy.id);
    const dmgPreenedMolt = 500 - enemy.hp;
    const hasPreenedMoltText = !!nest.moltTextUpgraded && nest.moltTextUpgraded !== nest.moltText;

    return { dmgBaseMolt, dmgPreenedMolt, hasPreenedMoltText };
  });
  expect(r.dmgBaseMolt).toBeGreaterThanOrEqual(7);
  expect(r.dmgPreenedMolt).toBeGreaterThan(r.dmgBaseMolt); // preened molt does more
  expect(r.hasPreenedMoltText).toBe(true);

  // Codex content: tarot meaning + expanded bird fact are loaded for the card.
  const codex = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const acct = JSON.parse(window.localStorage.getItem('birdsquad.account') || '{}');
    acct.discoveredCards = ['pentacles_04', 'aviary_25'];
    window.localStorage.setItem('birdsquad.account', JSON.stringify(acct));
    await window.__birdSquadStartScene!('CodexScene'); g.scene.stop('BattleScene');
    const cs: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 20 && !cs.root; i += 1) await wait(50);
    let all: any[] = [];
    let texts: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      cs.detailId = 'pentacles_04'; cs.detailScroll = 0; cs.renderAll();
      await wait(100);
      all = [];
      const walk = (o: any) => { if (!o) return; if (o.type === 'Text') all.push(o); const k = o.list; if (Array.isArray(k)) k.forEach(walk); };
      cs.children.list.forEach(walk);
      texts = all.map((t) => t.text || '');
      if (texts.some((t) => /TAROT MEANING/.test(t)) && texts.some((t) => /ABOUT THE/.test(t))) break;
    }
    const hasTarot = texts.some((t) => /TAROT MEANING/.test(t)) && texts.some((t) => /UPRIGHT/.test(t)) && texts.some((t) => /REVERSED/.test(t));
    const hasFacts = texts.some((t) => /ABOUT THE/.test(t));
    // a keyword token is interactive and wired for tooltip hover.
    const kw = all.filter((t) => t.input).find((t) => (t.listenerCount?.('pointerover') ?? 0) > 0);
    cs.detailId = 'aviary_25'; cs.detailScroll = 0; cs.renderAll();
    await wait(150);
    const aviaryAll: any[] = [];
    const collectAviary = (o: any) => {
      if (!o) return;
      if (o.type === 'Text') aviaryAll.push(o);
      const k = o.list;
      if (Array.isArray(k)) k.forEach(collectAviary);
    };
    cs.children.list.forEach(collectAviary);
    const aviaryDetailTexts = aviaryAll.map((t) => t.text || '');
    const hasAviaryDossier = aviaryDetailTexts.some((t) => /AVIARY DOSSIER/.test(t));
    const hasAviaryLegend = aviaryDetailTexts.some((t) => /AVIARY LEGEND/.test(t))
      && aviaryDetailTexts.some((t) => /SIGNAL/.test(t))
      && aviaryDetailTexts.some((t) => /SHADOW/.test(t));
    const aviarySaysTarot = aviaryDetailTexts.some((t) => /TAROT MEANING|UPRIGHT|REVERSED/.test(t));

    // A content-heavy card must engage scrolling (fixed panel + scroll), not overflow.
    let heavyMax = 0;
    const cardIds = (cs.allCards ? cs.allCards() : []).map((card: any) => card.id);
    for (let index = 0; index < cardIds.length; index += 1) {
      cs.detailId = cardIds[index]; cs.detailScroll = 0; cs.renderAll();
      if (cs.detailMaxScroll > heavyMax) heavyMax = cs.detailMaxScroll;
      // Yield occasionally so this exhaustive 110-card layout scan does not
      // starve queued loader completions during a long single-worker run.
      if (index % 25 === 24) await wait(0);
    }
    return { hasTarot, hasFacts, keywordHoverWired: !!kw, hasAviaryDossier, hasAviaryLegend, aviarySaysTarot, heavyMax };
  });
  expect(codex.hasTarot).toBe(true);
  expect(codex.hasFacts).toBe(true);
  expect(codex.keywordHoverWired).toBe(true);
  expect(codex.hasAviaryDossier).toBe(true);
  expect(codex.hasAviaryLegend).toBe(true);
  expect(codex.aviarySaysTarot).toBe(false);
  expect(codex.heavyMax).toBeGreaterThan(0); // the longest card scrolls instead of spilling
});

test('elite encounters spawn multiple enemies: every enemy telegraphs, all act, and all must fall', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    // Boot a normal battle so create() builds root/fxLayer; let it settle.
    await window.__birdSquadStartScene!('BattleScene', {});
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.hand && s.hand.length); i += 1) await wait(50);
    // Build a fixed-seed runState from the live run so re-init reuses ONE cached
    // procedural map — the one we mutate is the one the next fight reads.
    const deck = [...s.drawPile, ...s.hand, ...s.discardPile].map((c: any) => ({ id: c.id, upgraded: !!c.upgraded }));
    const runState = {
      deck, leaderId: s.runLeaderId, difficulty: 0, seed: 'elite-multi-test', currentHp: 36,
      scrap: 0, routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [],
      currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
    };
    // First re-init caches the fixed-seed map (no render, no scene teardown).
    s.init({ runState });
    // Repoint a real combat node at the elite "Gutter Baron" encounter (an elite
    // bruiser + rat escorts), then re-init there and redraw — exercises the
    // multi-enemy spawn + render path.
    const map = (window as any).__birdSquadCurrentMap();
    const node = map.nodes.find((n: any) => ['street', 'rival', 'boss'].includes(n.type));
    node.payloadId = 'enc_gutter_baron';
    s.init({ runState, routeNodeId: node.id });
    s.renderAll();

    const countCrests = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-elite-crest' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countCrests(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const names = s.enemies.map((e: any) => e.name);
    const types = s.enemies.map((e: any) => e.runtime.type);
    const snap = window.__birdSquadState!();
    const crestObjects = countCrests(s.root?.list ?? s.children.list);
    const intentsBefore = s.enemies.map((e: any) => e.intentIndex);
    const flockBefore = s.flock.hp;

    // Resolve a full enemy phase: EVERY living enemy should take its move.
    s.resolveEnemyTurn();
    const intentsAfter = s.enemies.map((e: any) => e.intentIndex);
    const flockAfter = s.flock.hp;

    // Targeting stays per-enemy: damaging only one escort leaves the elite alive,
    // so victory must require clearing the whole encounter (checkOutcome uses .every).
    const escort = s.enemies.find((e: any) => e.runtime.type !== 'elite');
    escort.hp = 0;
    const allDownAfterOne = s.enemies.every((e: any) => e.hp <= 0);

    return {
      count: s.enemies.length,
      names,
      types,
      hasElite: types.includes('elite'),
      combatEliteCrest: snap.combatEliteCrest,
      crestObjects,
      snapCount: snap.enemies.length,
      snapIntents: snap.enemies.map((e: any) => e.intent),
      intentsBefore,
      intentsAfter,
      flockBefore,
      flockAfter,
      allDownAfterOne,
    };
  });

  expect(r.count).toBe(3);                       // every authored encounter enemy spawned
  expect(r.snapCount).toBe(3);                   // and every enemy is exposed to the UI/harness
  expect(r.hasElite).toBe(true);                 // one carries the elite tier
  expect(r.combatEliteCrest).toEqual({ loaded: true, rendered: true, count: r.crestObjects });
  expect(r.crestObjects).toBe(1);
  expect(r.names).toContain('Gutter Baron');
  for (const intent of r.snapIntents) expect(typeof intent).toBe('string'); // each telegraphs
  // a full enemy phase advances EVERY enemy's move counter, not just the first
  expect(r.intentsAfter).toEqual(r.intentsBefore.map((n: number) => n + 1));
  expect(r.flockAfter).toBeLessThan(r.flockBefore); // both attackers contributed damage
  expect(r.allDownAfterOne).toBe(false);         // killing one does not end the fight
});

test('defeated enemies cannot remain selected or receive stale target effects', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', {});
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.hand && s.hand.length); i += 1) await wait(50);
    const deck = [...s.drawPile, ...s.hand, ...s.discardPile].map((c: any) => ({ id: c.id, upgraded: !!c.upgraded }));
    const runState = {
      deck, leaderId: s.runLeaderId, difficulty: 0, seed: 'dead-target-test', currentHp: 36,
      scrap: 0, routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [],
      currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
    };
    s.init({ runState });
    const map = (window as any).__birdSquadCurrentMap();
    const node = map.nodes.find((n: any) => ['street', 'rival', 'boss'].includes(n.type));
    node.payloadId = 'enc_gutter_baron';
    s.init({ runState, routeNodeId: node.id });
    s.renderAll();

    const defeated = s.enemies[0];
    const survivor = s.enemies.find((enemy: any) => enemy.id !== defeated.id);
    const targetCard = s.hand.find((card: any) => card.target === 'enemy')
      ?? [...s.drawPile, ...s.discardPile].find((card: any) => card.target === 'enemy');
    if (!targetCard) throw new Error('Expected an enemy-target card for stale target smoke');
    if (!s.hand.includes(targetCard)) s.hand.push(targetCard);
    s.selectedEnemyId = defeated.id;
    s.damageEnemy(defeated.id, defeated.hp + 100, 'Test');
    s.renderAll();
    const selectedAfterDefeat = window.__birdSquadState!().selectedEnemy;
    const selectedAfterDefeatHp = s.enemies.find((enemy: any) => enemy.id === selectedAfterDefeat)?.hp ?? 0;

    const survivorHpBeforeStale = survivor.hp;
    const staleDamageResult = s.damageEnemy(defeated.id, 999, 'Stale Test');
    const survivorHpAfterStale = survivor.hp;

    s.selectedEnemyId = defeated.id;
    s.energy = 99;
    const survivorHpBeforeCard = survivor.hp;
    s.playCard(targetCard, defeated.id);
    const survivorHpAfterCard = survivor.hp;

    return {
      defeatedHp: defeated.hp,
      selectedAfterDefeat,
      selectedAfterDefeatHp,
      staleDamageResult,
      staleChangedSurvivor: survivorHpAfterStale !== survivorHpBeforeStale,
      cardRetargetedToSurvivor: survivorHpAfterCard < survivorHpBeforeCard,
      selectedAfterCard: window.__birdSquadState!().selectedEnemy,
    };
  });

  expect(r.defeatedHp).toBe(0);
  expect(r.selectedAfterDefeat).toBeTruthy();
  expect(r.selectedAfterDefeatHp).toBeGreaterThan(0);
  expect(r.staleDamageResult).toBe(false);
  expect(r.staleChangedSurvivor).toBe(false);
  expect(r.cardRetargetedToSurvivor).toBe(true);
  expect(r.selectedAfterCard).not.toBe('');
});

test('reward screens ignore end-turn input instead of restarting combat', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.hand && s.hand.length); i += 1) await wait(50);
    s.enemies.forEach((enemy: any) => { enemy.hp = 0; });
    s.checkOutcome();
    const before = window.__birdSquadState!();
    s.endTurn();
    const after = window.__birdSquadState!();
    return {
      beforeMode: before.mode,
      afterMode: after.mode,
      beforeRewards: before.rewardChoices.length,
      afterRewards: after.rewardChoices.length,
      afterEnemyHp: after.enemies[0]?.hp ?? 0,
    };
  });

  expect(['cardReward', 'waymarkReward']).toContain(r.beforeMode);
  expect(r.afterMode).toBe(r.beforeMode);
  expect(r.afterRewards).toBe(r.beforeRewards);
  expect(r.afterEnemyHp).toBe(0);
});

test('played cards leave hand before resolving discard effects', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const deck = ['major_00', 'wands_02', 'wands_08', 'swords_02', 'wet_feathers', 'cups_03', 'pentacles_04', 'cups_ace', 'wands_02', 'cups_ace']
      .map((id) => ({ id }));
    await window.__birdSquadStartScene!('BattleScene', {
      runState: {
        deck, leaderId: 'fledgling', difficulty: 0, seed: 'discard-order-regression', currentHp: 39,
        scrap: 0, routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [],
        currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
      },
      routeNodeId: 'm1_entry',
    });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.hand && s.hand.length); i += 1) await wait(50);
    const card = [...s.hand, ...s.drawPile, ...s.discardPile].find((candidate: any) => candidate.id === 'wet_feathers');
    s.hand = s.hand.filter((candidate: any) => candidate.instanceId !== card.instanceId);
    s.drawPile = s.drawPile.filter((candidate: any) => candidate.instanceId !== card.instanceId);
    s.discardPile = s.discardPile.filter((candidate: any) => candidate.instanceId !== card.instanceId);
    s.hand.push(card);
    const discardBefore = s.discardPile.length;
    s.energy = 99;
    s.playCard(card, s.enemies[0].id);
    const discarded = s.discardPile.slice(discardBefore).map((candidate: any) => candidate.id);
    return {
      discarded,
      handHasPlayedCard: s.hand.some((candidate: any) => candidate.instanceId === card.instanceId),
    };
  });

  expect(r.handHasPlayedCard).toBe(false);
  expect(r.discarded).toHaveLength(2);
  expect(r.discarded[0]).not.toBe('wet_feathers');
  expect(r.discarded[1]).toBe('wet_feathers');
});

test('enemy phase stops after lethal Cohesion damage and enemy Cover expires', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', {});
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.hand && s.hand.length); i += 1) await wait(50);
    const deck = [...s.drawPile, ...s.hand, ...s.discardPile].map((card: any) => ({ id: card.id, upgraded: !!card.upgraded }));
    const runState = {
      deck, leaderId: s.runLeaderId, difficulty: 0, seed: 'lethal-phase-regression', currentHp: 36,
      scrap: 0, routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [],
      currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
    };
    s.init({ runState });
    const map = (window as any).__birdSquadCurrentMap();
    const node = map.nodes.find((candidate: any) => ['street', 'rival', 'boss'].includes(candidate.type));
    node.payloadId = 'enc_gutter_baron';
    s.init({ runState, routeNodeId: node.id });
    s.renderAll();
    s.enemies.forEach((enemy: any) => { enemy.block = 7; });
    s.flock.hp = 1;
    s.flock.block = 0;
    const intentsBefore = s.enemies.map((enemy: any) => enemy.intentIndex);
    s.resolveEnemyTurn();
    return {
      hp: s.flock.hp,
      taken: s.statTaken,
      blocksAfter: s.enemies.map((enemy: any) => enemy.block),
      intentsBefore,
      intentsAfter: s.enemies.map((enemy: any) => enemy.intentIndex),
      log: s.log.slice(-4),
    };
  });

  expect(r.hp).toBe(0);
  expect(r.taken).toBe(1); // telemetry records Cohesion actually lost, not overkill damage
  expect(r.blocksAfter.every((block: number) => block === 0)).toBe(true);
  expect(r.intentsAfter).toEqual([r.intentsBefore[0] + 1, r.intentsBefore[1], r.intentsBefore[2]]);
  expect(r.log).toEqual(expect.arrayContaining(['Gutter Baron hits the flock for 11.']));
  expect(r.log.some((entry: string) => entry.includes('Roof Rat A hits'))).toBe(false);
});

test('fullyBlocksNextAttack checks the next incoming attack, not stale selection', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.hand && s.hand.length); i += 1) await wait(50);
    const card = s.hand[0];
    const state = { previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false };
    s.enemies[0].damageBonus = 0;
    s.enemies[0].nextAttackBonus = 0;
    s.selectedEnemyId = 'missing-enemy';
    s.flock.block = 6;
    const blocksNext = s.checkCardCondition('fullyBlocksNextAttack', card, 'missing-enemy', state);
    s.flock.block = 5;
    const shortNext = s.checkCardCondition('fullyBlocksNextAttack', card, 'missing-enemy', state);
    return { blocksNext, shortNext };
  });

  expect(r.blocksNext).toBe(true);
  expect(r.shortNext).toBe(false);
});
