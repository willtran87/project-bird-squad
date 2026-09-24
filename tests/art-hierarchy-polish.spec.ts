import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

const viewports = [
  { width: 2560, height: 1600 },
  { width: 1440, height: 900 },
  { width: 1000, height: 560 },
];

async function boot(page: Page, sceneName: 'RouteScene' | 'BattleScene') {
  await page.setViewportSize(viewports[0]);
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async sceneName => {
    const w = window as any;
    await w.__birdSquadEnsureScene(sceneName);
    if (sceneName === 'BattleScene') await w.__birdSquadEnsureScene('CodexScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start(sceneName, sceneName === 'BattleScene' ? { routeNodeId: 'm1_entry' } : {});
  }, sceneName);
}

test('route frame recedes while future destinations remain legible', async ({ page }, info) => {
  await boot(page, 'RouteScene');
  await page.waitForFunction(() => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return route.routeEssentialAssetsReady && route.children.getByName('route-map-frame')
      && route.children.list.some((child: any) => child.name === 'route-node-icon' && child.getData('routeNodeState') === 'future');
  });
  const hierarchy = await page.evaluate(() => {
    const route = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return {
      frame: route.children.getByName('route-map-frame').alpha,
      future: route.children.list.filter((child: any) => child.name === 'route-node-icon'
        && child.getData('routeNodeState') === 'future').map((child: any) => child.alpha),
    };
  });
  expect(hierarchy.frame).toBe(0.14);
  expect(hierarchy.future.length).toBeGreaterThan(0);
  expect(hierarchy.future.every((alpha: number) => alpha >= 0.9)).toBe(true);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`route-${viewport.width}.png`) });
  }
});

test('signal resident keeps the full character inside the event composition', async ({ page }, info) => {
  await boot(page, 'RouteScene');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.evaluate(() => {
    const w = window as any;
    const route = w.__birdSquadGame.scene.getScene('RouteScene');
    const signal = w.__birdSquadCurrentMap().nodes.find((node: any) => node.type === 'signal');
    route.openNodeChoices(signal);
  });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('route-event-resident-art')));
  const bounds = await page.evaluate(() => {
    const bounds = (window as any).__birdSquadGame.scene.getScene('RouteScene')
      .children.getByName('route-event-resident-art').getBounds();
    return { top: bounds.top, bottom: bounds.bottom };
  });
  expect(bounds.bottom).toBeLessThanOrEqual(720);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`signal-${viewport.width}.png`) });
  }
});

test('normal reward choices keep authored rules bounded while showing card art', async ({ page }, info) => {
  test.setTimeout(120_000);
  await boot(page, 'BattleScene');
  await page.waitForFunction(() => {
    const battle = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return battle.battleHandRendererModule && battle.hand?.length
      && battle.combatIntroElapsedMs > 0 && !battle.combatIntroActive;
  });
  await page.evaluate(() => {
    const battle = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    battle.mode = 'cardReward';
    battle.rewardChoices = battle.allDeckCards().slice(0, 3);
    battle.battleInputActive = true;
    battle.renderAll();
  });
  await page.waitForFunction(() => {
    const battle = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return battle.root.getByName('reward-card-art') && battle.rewardPresentationReady();
  });
  const geometry = await page.evaluate(() => {
    const battle = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const named = (name: string) => battle.root.list.filter((child: any) => child.name === name);
    return {
      arts: named('reward-card-art').length,
      rules: named('reward-card-effect').map((effect: any, index: number) => {
        const panel = named('reward-card-effect-panel')[index].getBounds();
        const bounds = effect.getBounds();
        return bounds.left >= panel.left && bounds.right <= panel.right
          && bounds.top >= panel.top && bounds.bottom <= panel.bottom
          && effect.getData('fullText')?.length > 0;
      }),
    };
  });
  expect(geometry.arts).toBe(3);
  expect(geometry.rules).toEqual([true, true, true]);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`reward-${viewport.width}.png`) });
  }
});
