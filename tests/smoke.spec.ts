import { test, expect, type Page } from '@playwright/test';

// The game exposes a deterministic text-state harness on window; these smoke
// tests drive scenes through it rather than clicking the canvas.
declare global {
  interface Window {
    __birdSquadGame?: any;
    __birdSquadState?: () => any;
    __birdSquadLastRun?: any;
    render_game_to_text?: () => string;
  }
}

async function boot(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__birdSquadGame, undefined, { timeout: 15_000 });
}

test('route map loads and previews the boss before the final node', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
    g.scene.stop('MenuScene');
    const route = g.scene.getScene('RouteScene');
    route.selectRouteNode(window.__birdSquadCurrentMap!().bossNodeId);
    const expected = ['street', 'rival', 'boss', 'basin', 'nest', 'market', 'signal', 'cache']
      .map((type) => `route-node-${type}`);
    for (let i = 0; i < 40 && !expected.every((key) => route.textures.exists(key)); i += 1) await wait(50);
    const imageKeys = route.children.list
      .map((child: any) => child.texture?.key)
      .filter((key: string | undefined) => key?.startsWith('route-node-'));
    const state = JSON.parse(window.render_game_to_text!());
    return {
      active: g.scene.getScenes(true).map((s: any) => s.scene.key).includes('RouteScene'),
      texturesLoaded: expected.every((key) => route.textures.exists(key)),
      imageKeys: [...new Set(imageKeys)],
      hasRewardBadges: state.nodes.some((node: any) => (node.rewardBadges ?? []).length > 0),
      bossRewardBadges: state.nodes.find((node: any) => node.id === state.map.bossNodeId)?.rewardBadges ?? []
    };
  });
  expect(result.active).toBe(true);
  expect(result.texturesLoaded).toBe(true);
  expect(result.imageKeys).toContain('route-node-street');
  expect(result.imageKeys).toContain('route-node-boss');
  expect(result.hasRewardBadges).toBe(true);
  expect(result.bossRewardBadges).toContain('waymark');
});

test('generated route map node footprints do not overlap', async ({ page }) => {
  await boot(page);
  const overlaps = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    const seeds = Array.from({ length: 12 }, (_value, index) => `node-spacing-${index}`);
    const failures: Array<{ mapIndex: number; seed: string; a: string; b: string }> = [];
    const rectsOverlap = (a: any, b: any) => (
      a.left < b.right - 1
      && a.right > b.left + 1
      && a.top < b.bottom - 1
      && a.bottom > b.top + 1
    );

    for (let mapIndex = 0; mapIndex < 4; mapIndex += 1) {
      for (const seed of seeds) {
        g.scene.start('RouteScene', {
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
        const nodes = state.nodes.map((node: any) => ({ id: node.id, bounds: node.visualBounds }));
        for (let i = 0; i < nodes.length; i += 1) {
          for (let j = i + 1; j < nodes.length; j += 1) {
            if (rectsOverlap(nodes[i].bounds, nodes[j].bounds)) {
              failures.push({ mapIndex, seed, a: nodes[i].id, b: nodes[j].id });
            }
          }
        }
      }
    }
    return failures;
  });
  expect(overlaps).toEqual([]);
});

test('route map surfaces run status without opening the Flock menu', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    const texts = route.children.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
    const state = JSON.parse(window.render_game_to_text!());
    return {
      status: state.routeStatus,
      hasCohesion: texts.includes('Cohesion'),
      hasScrap: texts.includes('Scrap'),
      hasDeck: texts.some((text) => text.includes('Deck')),
      hasWaymarks: texts.some((text) => text.includes('Waymarks')),
      hasSupplies: texts.some((text) => text.includes('Supplies')),
      flockOverlayOpen: state.flockOverlayOpen
    };
  });
  expect(result.status.cohesion).toBeTruthy();
  expect(result.status.scrap).toBeGreaterThanOrEqual(0);
  expect(result.hasCohesion).toBe(true);
  expect(result.hasScrap).toBe(true);
  expect(result.hasDeck).toBe(true);
  expect(result.hasWaymarks).toBe(true);
  expect(result.hasSupplies).toBe(true);
  expect(result.flockOverlayOpen).toBe(false);
});

test('a combat route node resolves through its encounter', async ({ page }) => {
  await boot(page);
  const enemies: string[] = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    return window.__birdSquadState!().enemies.map((e: any) => e.name);
  });
  expect(enemies).toContain('Roof Rat');
});

test('encounter composition supports solo tuning and support companions', async ({ page }) => {
  await boot(page);
  const solo = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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

  await page.reload();
  await boot(page);
  const supportResult = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
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

    g.scene.start('RouteScene', { runState });
    const supportNodeId = window.__birdSquadCurrentMap!().nodes
      .find((node: any) => node.payloadId === 'enc_rooftop_skirmish')?.id;
    g.scene.start('BattleScene', { routeNodeId: supportNodeId, runState });
    g.scene.stop('MenuScene');
    const supportScene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !supportScene.enemies?.length; i += 1) {
      await wait(50);
    }
    for (let i = 0; i < 20 && !supportScene.enemies.some((enemy: any) => enemy.roles.includes('support')); i += 1) {
      await wait(50);
    }
    const support = supportScene.enemies.find((enemy: any) => enemy.roles.includes('support'));
    const ally = supportScene.enemies.find((enemy: any) => enemy.id !== support.id);
    ally.maxHp = 30;
    ally.hp = 12;
    supportScene.resolveEnemyEffect(support, 'healAlly(lowest, 4)');
    supportScene.resolveEnemyEffect(support, 'gainCoverAlly(lowest, 3)');

    return {
      supportRoles: support.roles,
      allyHp: ally.hp,
      allyBlock: ally.block,
      supportState: window.__birdSquadState!().enemies.map((enemy: any) => ({
        id: enemy.id,
        roles: enemy.roles,
        solo: enemy.solo,
      })),
    };
  });

  expect(solo.solo).toBe(true);
  expect(solo.maxHp).toBeGreaterThan(solo.baseHp);
  expect(solo.damageBonus).toBe(1);
  expect(solo.previewDamage).toBeGreaterThan(6);
  expect(supportResult.supportRoles).toContain('support');
  expect(supportResult.allyHp).toBe(16);
  expect(supportResult.allyBlock).toBe(3);
  expect(supportResult.supportState.some((enemy: any) => enemy.roles.includes('support'))).toBe(true);
  expect(supportResult.supportState.every((enemy: any) => enemy.solo === false)).toBe(true);
});

test('poison pressure applies Fouled and ticks on the next player turn', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];
    scene.flock.hp = 30;
    scene.flock.block = 99;
    scene.resolveEnemyEffect(enemy, 'applyPoison(flock, 2)');
    const afterApply = window.__birdSquadState!().flock;
    scene.startPlayerTurn();
    const afterTick = window.__birdSquadState!().flock;
    return { afterApply, afterTick, log: scene.log.slice(-4) };
  });

  expect(result.afterApply.fouled).toBe(2);
  expect(result.afterApply.statuses).toContain('Fouled 2');
  expect(result.afterTick.hp).toBe(29);
  expect(result.afterTick.fouled).toBe(1);
  expect(result.afterTick.statuses).toContain('Fouled 1');
  expect(result.log.some((line: string) => line.includes('Fouled pressure'))).toBe(true);
});

test('flock Cohesion bar exposes incoming damage prediction after Cover', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];
    const intentDamage = scene.incomingAttackDamage(enemy);
    scene.flock.hp = 30;
    scene.flock.block = 3;
    scene.renderAll();
    return {
      intentDamage,
      preview: window.__birdSquadState!().flock.incoming,
    };
  });

  expect(result.preview.total).toBe(result.intentDamage);
  expect(result.preview.blocked).toBe(3);
  expect(result.preview.hpLoss).toBe(result.intentDamage - 3);
  expect(result.preview.afterHp).toBe(30 - (result.intentDamage - 3));
  expect(result.preview.attackers).toBe(1);
});

test('battle hand is compact (no full effect text) and enemies expose intents', async ({ page }) => {
  await boot(page);
  const state = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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
  const ids: string[] = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    return window.__birdSquadState!().hand.map((card: any) => card.instanceId);
  });
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(typeof id).toBe('string');
});

test('boss uses a scripted attack pattern that loops from move 2', async ({ page }) => {
  await boot(page);
  const labels: string[] = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_boss' });
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
    await page.evaluate((mapIndex) => {
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
      g.scene.start('RouteScene', { runState });
      g.scene.stop('MenuScene');
      const bossNodeId = window.__birdSquadCurrentMap!().bossNodeId;
      g.scene.start('BattleScene', { routeNodeId: bossNodeId, runState });
    }, mapIndex);
    await page.waitForFunction((expectedKey) => {
      const state = window.__birdSquadState?.();
      const scene: any = window.__birdSquadGame?.scene.getScene('BattleScene');
      const rendered = scene?.root?.list?.some((child: any) => child.texture?.key === expectedKey) ?? false;
      return state?.route?.battlefieldAssetKey === expectedKey
        && state.route.battlefieldVariant
        && scene?.textures.exists(expectedKey)
        && rendered;
    }, expectedKey, { timeout: 10_000 });
    results.push(await page.evaluate((expectedKey) => {
      const state = window.__birdSquadState!();
      const scene: any = window.__birdSquadGame?.scene.getScene('BattleScene');
      return {
        stateKey: state.route.battlefieldAssetKey,
        variant: state.route.battlefieldVariant,
        textureLoaded: scene.textures.exists(expectedKey),
        rendered: scene.root?.list?.some((child: any) => child.texture?.key === expectedKey) ?? false
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
    g.scene.start('RouteScene', { runState: routeRunState });
    g.scene.stop('MenuScene');
    await wait(80);
    const map = window.__birdSquadCurrentMap!();
    const street = map.nodes.find((node: any) => node.type === 'street')?.id;
    const rival = map.nodes.find((node: any) => node.type === 'rival')?.id;
    const boss = map.bossNodeId;
    const start = async (routeNodeId: string) => {
      g.scene.start('BattleScene', { routeNodeId, runState: mkRunState() });
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
  const result = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const signalChoices = scene.nodeChoiceList({ type: 'signal', payloadId: 'faded_chalk_line' }).map((c: any) => c.key);
    const basinCount = scene.nodeChoiceList({ type: 'basin' }).length;
    const cacheCount = scene.nodeChoiceList({ type: 'cache' }).length;
    const scrapBefore = scene.runState.scrap;
    scene.resolveRouteEffect('gainScrap(45)');
    const scrapAfter = scene.runState.scrap;
    return {
      signalChoices,
      basinCount,
      cacheCount,
      scrapDelta: scrapAfter - scrapBefore,
      gatedFar: scene.requirementsMet(['scrapAtLeast(999999)']),
      gatedNear: scene.requirementsMet(['scrapAtLeast(0)'])
    };
  });
  expect(result.signalChoices).toEqual(['repaint', 'scout', 'move', 'decline']);
  expect(result.basinCount).toBe(4);
  expect(result.cacheCount).toBe(6);
  expect(result.scrapDelta).toBe(45);
  expect(result.gatedFar).toBe(false);
  expect(result.gatedNear).toBe(true);
});

test('route choice and market nodes complete only after their economy step resolves', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const map = window.__birdSquadCurrentMap!();
    const basin = map.nodes.find((node: any) => node.type === 'basin');
    scene.openNodeChoices(basin);
    const basinCompletedOnOpen = scene.runState.completedRouteNodeIds.includes(basin.id);
    scene.chooseNodeOption('recover');
    const basinCompletedAfterChoice = scene.runState.completedRouteNodeIds.includes(basin.id);

    g.scene.start('RouteScene', {});
    const marketScene: any = g.scene.getScene('RouteScene');
    const marketMap = window.__birdSquadCurrentMap!();
    const market = marketMap.nodes.find((node: any) => node.type === 'market')
      ?? marketMap.nodes.find((node: any) => node.type !== 'boss');
    market.type = 'market';
    marketScene.openMarketNode(market);
    const marketCompletedOnOpen = marketScene.runState.completedRouteNodeIds.includes(market.id);
    marketScene.leaveMarket();
    const marketCompletedAfterLeave = marketScene.runState.completedRouteNodeIds.includes(market.id);

    g.scene.start('RouteScene', {});
    const rivalFightScene: any = g.scene.getScene('RouteScene');
    await wait(50);
    const rivalFightMap = window.__birdSquadCurrentMap!();
    const rivalFight = rivalFightMap.nodes.find((node: any) => node.type === 'rival');
    rivalFightScene.openNodeChoices(rivalFight);
    const rivalCompletedOnOpen = rivalFightScene.runState.completedRouteNodeIds.includes(rivalFight.id);
    const rivalChoices = rivalFightScene.nodeChoiceList(rivalFight).map((choice: any) => choice.key);
    rivalFightScene.chooseNodeOption('challenge_rival');
    await wait(100);
    const rivalStartsBattle = g.scene.getScenes(true).some((scene: any) => scene.scene.key === 'BattleScene');

    g.scene.start('RouteScene', {});
    const rivalDeclineScene: any = g.scene.getScene('RouteScene');
    await wait(50);
    const rivalDeclineMap = window.__birdSquadCurrentMap!();
    const rivalDecline = rivalDeclineMap.nodes.find((node: any) => node.type === 'rival');
    rivalDeclineScene.openNodeChoices(rivalDecline);
    rivalDeclineScene.chooseNodeOption('decline');
    const rivalCompletedAfterDecline = rivalDeclineScene.runState.completedRouteNodeIds.includes(rivalDecline.id);

    return {
      basinCompletedOnOpen,
      basinCompletedAfterChoice,
      marketCompletedOnOpen,
      marketCompletedAfterLeave,
      rivalCompletedOnOpen,
      rivalChoices,
      rivalCompletedAfterDecline,
      rivalStartsBattle
    };
  });
  expect(result.basinCompletedOnOpen).toBe(false);
  expect(result.basinCompletedAfterChoice).toBe(true);
  expect(result.marketCompletedOnOpen).toBe(false);
  expect(result.marketCompletedAfterLeave).toBe(true);
  expect(result.rivalCompletedOnOpen).toBe(false);
  expect(result.rivalChoices).toEqual(['challenge_rival', 'decline']);
  expect(result.rivalCompletedAfterDecline).toBe(true);
  expect(result.rivalStartsBattle).toBe(true);
});

test('payScrap route options are locked when Scrap is short', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
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

test('route event overlays render generated special-node backdrops', async ({ page }) => {
  test.setTimeout(45000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    const cases = [
      {
        type: 'basin',
        key: 'route-event-lantern-roost-shelter',
        residentKey: 'route-event-resident-sella-warmwick'
      },
      {
        type: 'cache',
        key: 'route-event-rooftop-cache-office',
        residentKey: 'route-event-resident-marn-valeclip'
      },
      {
        type: 'signal',
        key: 'route-event-signal-switchboard',
        residentKey: 'route-event-resident-ivo-tallymast'
      },
      {
        type: 'nest',
        key: 'route-event-featherwright-studio',
        residentKey: 'route-event-resident-oren-shearbright'
      },
      {
        type: 'rival',
        key: 'route-event-rival-wager-board',
        residentKey: 'route-event-resident-caldra-pinion'
      },
      { type: 'market', key: 'market-kit-background' }
    ];
    const mkRunState = () => ({
      deck: [{ id: 'major_00' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed: 'route-event-backdrops',
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
      g.scene.start('RouteScene', { runState: mkRunState() });
      g.scene.stop('MenuScene');
      await wait(50);
      const scene: any = g.scene.getScene('RouteScene');
      const node = window.__birdSquadCurrentMap!().nodes.find((candidate: any) => candidate.type === entry.type);
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
        if (stateKey === entry.key && scene.textures.exists(entry.key) && rendered && residentRendered && extraRendered) {
          opened.push({
            type: entry.type,
            stateKey,
            textureLoaded: true,
            rendered: true,
            residentRendered,
            extraRendered
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
            .every((key: string) => scene.children.list.some((child: any) => child.texture?.key === key))
        });
      }
    }
    return opened;
  });

  expect(result).toEqual([
    expect.objectContaining({ type: 'basin', stateKey: 'route-event-lantern-roost-shelter', textureLoaded: true, rendered: true, residentRendered: true, extraRendered: true }),
    expect.objectContaining({ type: 'cache', stateKey: 'route-event-rooftop-cache-office', textureLoaded: true, rendered: true, residentRendered: true, extraRendered: true }),
    expect.objectContaining({ type: 'signal', stateKey: 'route-event-signal-switchboard', textureLoaded: true, rendered: true, residentRendered: true, extraRendered: true }),
    expect.objectContaining({ type: 'nest', stateKey: 'route-event-featherwright-studio', textureLoaded: true, rendered: true, residentRendered: true, extraRendered: true }),
    expect.objectContaining({ type: 'rival', stateKey: 'route-event-rival-wager-board', textureLoaded: true, rendered: true, residentRendered: true, extraRendered: true }),
    expect.objectContaining({ type: 'market', stateKey: 'market-kit-background', textureLoaded: true, rendered: true })
  ]);
});

test('balance economy Waymarks resolve through generic trigger/effect hooks', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const map = window.__birdSquadCurrentMap!();
    const cache = map.nodes.find((node: any) => node.type === 'cache');
    const basin = map.nodes.find((node: any) => node.type === 'basin');
    const signal = map.nodes.find((node: any) => node.type === 'signal');

    scene.runState.routeMarks = ['cache_hook', 'roofline_compass'];
    const cacheChoices = scene.nodeChoiceList(cache).length;

    scene.runState.currentHp = 20;
    scene.runState.routeMarks = ['rain_gutter', 'blue_cup_token'];
    scene.applyRouteNodeReward(basin);
    const hpAfterBasin = scene.runState.currentHp;

    scene.runState.scrap = 0;
    scene.runState.routeMarks = ['wire_map', 'market_tally_string'];
    scene.applyRouteNodeReward(signal);
    const scrapAfterSignal = scene.runState.scrap;

    scene.runState.routeMarks = ['patched_harness'];
    const preenPrice = scene.marketPreenPrice();

    return { cacheChoices, hpAfterBasin, scrapAfterSignal, preenPrice };
  });
  expect(result.cacheChoices).toBe(6);
  expect(result.hpAfterBasin).toBe(35);      // base 8 + Rain Gutter 4 + Blue Cup Token 3
  expect(result.scrapAfterSignal).toBe(40);  // Wire Map 25 + Market Tally String 15
  expect(result.preenPrice).toBe(65);        // 95 base - Patched Harness 30
});

test('supplies are carried into combat and usable for an effect', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', {
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
  expect(result.coverAfter - result.coverBefore).toBeGreaterThanOrEqual(10);
  expect(result.remaining).toBe(0);
  expect(result.feedback.id).toBe('zip_tie_roll');
});

test('card reward can be skipped for a Scrap fallback, recorded for stats', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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
  const result = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', {
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

test('boss Waymark reward choices use boss items before the next district starts', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_boss' });
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
    scene.chooseWaymarkReward('reopened_roofline');
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
      mapIndex: routeState.map?.index ?? -1,
      routeMarks: routeState.run?.routeMarks ?? [],
      supplies: route?.runState?.supplies ?? [],
      freePreen: route?.runState?.freePreenNextDistrict ?? 0,
      upgradedCards: route?.runState?.deck?.filter((card: any) => card.upgraded).length ?? 0,
      log: route?.runState?.routeLog ?? []
    };
  });
  expect(result.rewardMode).toBe('waymarkReward');
  expect(result.choices).toEqual(expect.arrayContaining(['sky_safe_harness', 'crowbar_debt', 'reopened_roofline']));
  expect(result.choiceTags.reopened_roofline).toEqual(expect.arrayContaining(['Boss', 'Next District', 'Preen']));
  expect(result.choiceTags.crowbar_debt).toEqual(expect.arrayContaining(['Anti-Cover', 'Pressure']));
  expect(result.mapIndex).toBe(2);
  expect(result.routeMarks).toContain('reopened_roofline');
  expect(result.supplies.length).toBeGreaterThan(0);
  expect(result.freePreen).toBeGreaterThanOrEqual(0);
  expect(result.upgradedCards).toBeGreaterThan(0);
  expect(result.log.some((entry: string) => entry.includes('Boss prep'))).toBe(true);
});

test('market shelves stock multiple finite offers and paid refreshes', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
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
    const afterBuyOffer = scene.marketCardOffer()?.id ?? '';
    const afterCardOffers = scene.marketCardOffers().map((offer: any) => ({ id: offer.id, price: offer.price, sold: !!offer.sold }));
    const deckHasOffer = scene.runState.deck.some((card: any) => card.id === firstOffer);
    const scrapAfterBuy = scene.runState.scrap;
    scene.refreshMarket();
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
      refreshedCardOffers
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
  expect(result.refreshCount).toBe(1);
  expect(result.scrapAfterRefresh).toBe(result.scrapAfterBuy - result.beforeRefreshCost);
  expect(result.refreshedCardOffers.every((offer: any) => !offer.sold)).toBe(true);
});

test('market preen service lets the player choose a card before paying', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
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
    const soldBeforePick = !!scene.marketUtilityShelf[preenIndex].sold;
    const scrapAfterOpen = scene.runState.scrap;
    const choice = scene.pickerEligibleCards('preen', 'market').find((entry: any) => scene.runState.scrap >= entry.cost);
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
      pickerCleared: !scene.cardPickerMode && !scene.cardPickerContext
    };
  });
  expect(result.missing).toBe(false);
  expect(result.pickerMode).toBe('preen');
  expect(result.pickerContext).toBe('market');
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
  const result = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
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
      soldAfterPick: !!scene.marketUtilityShelf[removeIndex].sold,
      pickerCleared: !scene.cardPickerMode && !scene.cardPickerContext
    };
  });
  expect(result.missing).toBe(false);
  expect(result.pickerMode).toBe('release');
  expect(result.pickerContext).toBe('market');
  expect(result.soldBeforePick).toBe(false);
  expect(result.scrapAfterOpen).toBe(result.scrapBeforeOpen);
  expect(result.deckAfter).toBe(result.deckBefore - 1);
  expect(result.soldAfterPick).toBe(true);
  expect(result.scrapAfterPick).toBe(result.scrapBeforeOpen - result.chosenCost);
  expect(result.pickerCleared).toBe(true);
});

test('market overlay renders generated shopkeeper sign and counter kit', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    scene.runState.scrap = 999;
    const market = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes[0];
    market.type = 'market';
    scene.openMarketNode(market);
    const keys = [
      'market-kit-background',
      'market-kit-shopkeeper-starling',
      'market-kit-sign',
      'market-kit-counter-wares'
    ];
    for (let i = 0; i < 80; i += 1) {
      const loaded = keys.every((key) => scene.textures.exists(key));
      const rendered = keys.every((key) => scene.children.list.some((child: any) => child.texture?.key === key));
      if (loaded && rendered) break;
      await wait(50);
    }
    return Object.fromEntries(keys.map((key) => [key, {
      loaded: scene.textures.exists(key),
      rendered: scene.children.list.some((child: any) => child.texture?.key === key)
    }]));
  });

  expect(result['market-kit-background']).toEqual({ loaded: true, rendered: true });
  expect(result['market-kit-shopkeeper-starling']).toEqual({ loaded: true, rendered: true });
  expect(result['market-kit-sign']).toEqual({ loaded: true, rendered: true });
  expect(result['market-kit-counter-wares']).toEqual({ loaded: true, rendered: true });
});

test('card choice surfaces expose full card details on hover', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const collectText = (container: any) => (container?.list ?? [])
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text);
    const hasFullSections = (texts: string[]) => (
      texts.includes('Current Effect')
      && texts.includes('Preened Effect')
      && texts.includes('Flock Stats')
    );

    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    await wait(80);
    const battle: any = g.scene.getScene('BattleScene');
    const rewardCard = battle.hand[0] ?? battle.drawPile[0];
    battle.showChoiceCardDetail(rewardCard, 392, 360);
    const rewardTexts = collectText(battle.cardPreview);

    g.scene.start('RouteScene', {});
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

    const preenEntry = route.pickerEligibleCards('preen')[0];
    route.showHoverCardDetail(preenEntry.card, 'Preen candidate', preenEntry.cost, 640, 430);
    const preenTexts = collectText(route.hoverCardDetail);

    return {
      reward: hasFullSections(rewardTexts),
      market: hasFullSections(marketTexts),
      preen: hasFullSections(preenTexts),
      rewardTitle: rewardTexts.includes(rewardCard.name),
      marketTitle: marketTexts.includes(marketOffer.name),
      preenTitle: preenTexts.includes(preenEntry.card.name)
    };
  });
  expect(result.reward).toBe(true);
  expect(result.market).toBe(true);
  expect(result.preen).toBe(true);
  expect(result.rewardTitle).toBe(true);
  expect(result.marketTitle).toBe(true);
  expect(result.preenTitle).toBe(true);
});

test('market item detail surfaces non-card offer stats', async ({ page }) => {
  await boot(page);
  const texts = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
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
    return (route?.marketItemHover?.list ?? [])
      .filter((child: any) => typeof child.text === 'string')
      .map((child: any) => child.text);
  });
  expect(texts.some((text: string) => text.includes('SCRAP'))).toBe(true);
  expect(texts.some((text: string) => text.includes('WAYMARK'))).toBe(true);
  expect(texts.some((text: string) => text.includes('Trigger:'))).toBe(true);
  expect(texts.some((text: string) => text.includes('Effect:'))).toBe(true);
});

test('post-combat Preen is gated by encounter reward profile', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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
      g.scene.start('BattleScene', { runState, routeNodeId: node.id });
      g.scene.stop('MenuScene');
      await wait(60);
      const battle: any = g.scene.getScene('BattleScene');
      streetPreenWindows.push(battle.shouldOfferUpgradeReward());
    }
    g.scene.start('BattleScene', { runState, routeNodeId: rival.id });
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
  const result = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('RouteScene');
    const nest = window.__birdSquadCurrentMap!().nodes.find((n: any) => n.type === 'nest');
    scene.openNodeChoices(nest);
    const deckBefore = scene.runState.deck.length;
    scene.chooseNodeOption('release');
    const pickerMode = scene.cardPickerMode;
    const firstIndex = scene.pickerEligibleCards('release')[0].index;
    scene.applyCardPick(firstIndex);
    return { pickerMode, deckBefore, deckAfter: scene.runState.deck.length };
  });
  expect(result.pickerMode).toBe('release');
  expect(result.deckAfter).toBe(result.deckBefore - 1);
});

test('clearing a district boss advances the run to the next district', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_boss' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    // returnToRouteMap on a non-final boss advances mapIndex and starts the
    // next district's RouteScene (next-level multi-map progression).
    battle.returnToRouteMap();
    const route: any = g.scene.getScene('RouteScene');
    const start = Date.now();
    while (Date.now() - start < 2000) {
      if (route.runState && route.runState.mapIndex === 1) break;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    const selectable = (route.getSelectableNodes?.() ?? []).map((n: any) => n.id);
    return { mapIndex: route.runState?.mapIndex, selectable };
  });
  expect(result.mapIndex).toBe(1);
  // The second district's nodes are namespaced m2_*; the run is now on Canal Markets.
  expect(result.selectable.length).toBeGreaterThan(0);
  for (const id of result.selectable) expect(id.startsWith('m2_')).toBe(true);
});

test('a newly-added arcana card constructs from the library and resolves its effect', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    // Seed a deck of a brand-new Major (major_07 "Dive Line" = damage 6) to prove
    // the expanded card pool both instantiates and runs through the interpreter.
    const deck = Array.from({ length: 10 }, () => ({ id: 'major_07' }));
    g.scene.start('BattleScene', {
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
  const r = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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

test('route ESC asks to confirm before abandoning a run (does not leave immediately)', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    route.input.keyboard.emit('keydown-ESC'); // first ESC: open the confirm
    const afterFirst = { confirm: route.confirmExitOpen, active: g.scene.getScenes(true).map((s: any) => s.scene.key) };
    route.input.keyboard.emit('keydown-ESC'); // second ESC: dismiss (keep playing)
    return { afterFirst, confirmAfterSecond: route.confirmExitOpen };
  });
  expect(result.afterFirst.confirm).toBe(true);
  expect(result.afterFirst.active).toContain('RouteScene'); // still in the run, not kicked to menu
  expect(result.confirmAfterSecond).toBe(false);
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
    g.scene.start('MenuScene');
    await wait(150);
    const menu: any = g.scene.getScene('MenuScene');
    for (let i = 0; i < 20 && !(menu.leaderPanels?.length); i += 1) await wait(50); // wait for the menu rebuild
    menu.selectLeader('roostkeeper'); // Nests/cover archetype
    menu.startRun();
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 20 && route.runState?.leaderId !== 'roostkeeper'; i += 1) await wait(50);
    const deck = (route.runState?.deck ?? []).map((c: any) => c.id);
    return {
      leaderId: route.runState?.leaderId,
      size: deck.length,
      unique: new Set(deck).size,
      nests: deck.filter((id: string) => id.startsWith('pentacles')).length,
    };
  });
  expect(r.leaderId).toBe('roostkeeper');
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
    for (let i = 0; i < 20 && !route.runState; i += 1) await wait(50);
    // Mutate to a recognizable mid-run state and re-checkpoint.
    route.runState.scrap = 777;
    route.runState.completedRouteNodeIds = ['x'];
    route.renderAll();
    const saved = JSON.parse(window.localStorage.getItem('birdsquad.run.active') || 'null');
    // Return to the menu and Continue.
    g.scene.start('MenuScene');
    await wait(150);
    (g.scene.getScene('MenuScene') as any).continueRun();
    const route2: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 20 && route2.runState?.scrap !== 777; i += 1) await wait(50);
    return {
      savedScrap: saved?.scrap, savedLeader: saved?.leaderId,
      resumedScrap: route2.runState?.scrap, resumedLeader: route2.runState?.leaderId,
      resumedProgress: route2.runState?.completedRouteNodeIds?.length,
    };
  });
  expect(r.savedScrap).toBe(777);
  expect(r.savedLeader).toBe('spark_caller');
  expect(r.resumedScrap).toBe(777);
  expect(r.resumedLeader).toBe('spark_caller');
  expect(r.resumedProgress).toBe(1);
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
    g.scene.start('BattleScene', { runState: mk(0), routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    await wait(250);
    const base = (g.scene.getScene('BattleScene') as any).enemies[0].maxHp;
    g.scene.start('BattleScene', { runState: mk(5), routeNodeId: 'm1_entry' });
    await wait(250);
    const scene: any = g.scene.getScene('BattleScene');
    return { base, scaled: scene.enemies[0].maxHp, rewardCount: scene.createRewardChoices().length };
  });
  expect(r.scaled).toBeGreaterThan(r.base); // +30% enemy Cohesion at tier 5
  expect(r.rewardCount).toBe(2); // tier >= 2 narrows rewards from 3 to 2
});

test('routes are procedurally generated: larger, branching, fully connected', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {
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
  const r = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
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
  const r = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    const texts = route.children.list
      .map((child: any) => child.text)
      .filter((text: unknown): text is string => typeof text === 'string');
    const state = JSON.parse(window.render_game_to_text!());
    return { ...state.bossPrep, hasInspectorSummary: texts.includes('BOSS PREP') };
  });
  expect(r.bossName).toBeTruthy();
  expect(r.pressure).toContain('cover');
  expect(['low', 'steady', 'strong']).toContain(r.readiness.cover);
  expect(Array.isArray(r.usefulNodes)).toBe(true);
  expect(r.hasInspectorSummary).toBe(true);
});

test('combat tracks per-fight stats (damage dealt / taken / blocked)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !scene.flock; i += 1) await wait(50); // create() runs a tick after start
    scene.flock.hp = 0;
    scene.checkOutcome();
    return window.__birdSquadLastRun;
  });
  expect(run.result).toBe('loss');
  expect(run.killedBy).toBe('Roof Rat');
  expect(run.deck.length).toBeGreaterThan(0);
  expect(run.mapId).toBe('map_01_rooftop_blocks');
  expect(run.combatResults.length).toBeGreaterThan(0);
  expect(run.combatResults[0].encounterId).toBe('enc_roof_rat');
  expect(Array.isArray(run.suppliesUsed)).toBe(true);
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
      g.scene.start('BattleScene', { routeNodeId: 'm1_entry', runState: base(leaderId) });
      g.scene.stop('MenuScene');
      await wait(80);
      return g.scene.getScene('BattleScene') as any;
    };

    const spark = await start('spark_caller');
    const sparkSeedCard = spark.hand.pop();
    if (sparkSeedCard) spark.drawPile.unshift(sparkSeedCard);
    spark.spark = 1;
    const sparkHandBefore = spark.hand.length;
    spark.spendResonance(1);
    const sparkDraw = spark.hand.length - sparkHandBefore;

    const talon = await start('talon');
    const talonEnemy = talon.enemies[0];
    talonEnemy.hp = 20;
    talon.resolveCardEffect('applyWinded(target, 1)', talon.hand[0], talonEnemy.id, {
      previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false
    });
    const talonDamage = 20 - talonEnemy.hp;

    const tide = await start('tidewarden');
    tide.flock.hp = tide.flock.maxHp;
    tide.flock.block = 0;
    tide.healFlock(3, 'test');
    const tideCover = tide.flock.block;

    const roost = await start('roostkeeper');
    roost.flock.flow = 0;
    roost.flock.block = 99;
    roost.damageFlock(roost.enemies[0], 5);
    const roostFlow = roost.flock.flow;

    return {
      sparkDraw,
      talonDamage,
      tideCover,
      roostFlow
    };
  });
  expect(r.sparkDraw).toBe(1);
  expect(r.talonDamage).toBe(2);
  expect(r.tideCover).toBe(3);
  expect(r.roostFlow).toBe(1);
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
      runs: 1, wins: 1, losses: 0, winsByLeader: { fledgling: 1 }, bestWinTier: 0, fastestWinTurns: 6,
      unlockedLeaders: ['fledgling', 'spark_caller', 'talon'], achievements: ['first_flight'],
    }));
    g.scene.start('MenuScene');
    await wait(150);
    const menu2: any = g.scene.getScene('MenuScene');
    menu2.selectLeader('talon');
    const afterUnlockTalon = menu2.selectedLeaderId;
    // The Profile screen renders against the account without throwing.
    g.scene.start('ProfileScene');
    await wait(150);
    const profileActive = g.scene.getScenes(true).map((s: any) => s.scene.key).includes('ProfileScene');
    return { def, afterLockedPick, afterUnlockedPick, afterUnlockTalon, profileActive };
  });
  expect(r.afterLockedPick).toBe(r.def);             // locked pick ignored
  expect(r.afterLockedPick).not.toBe('talon');
  expect(r.afterUnlockedPick).toBe('spark_caller');  // unlocked pick works
  expect(r.afterUnlockTalon).toBe('talon');          // pickable once unlocked
  expect(r.profileActive).toBe(true);
});

test('route marks are real relics: combatStart marks reshape the fight', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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
    // Equip two combatStart relics and re-run combat start.
    scene.routeMarks = ['patched_shoulder_wrap', 'loose_feather_token']; // +3 Cover, +1 Wingbeat
    scene.flock.block = 0;
    scene.energy = 3;
    scene.applyCombatStartMarks();
    const markBlock = scene.flock.block;
    const markEnergy = scene.energy;

    scene.routeMarks = ['chalk_wingmark'];
    scene.markFiredThisTurn = new Set();
    scene.flock.block = 0;
    scene.checkEnemyCoverBrokenMarks();
    const chalkCover = scene.flock.block;

    scene.routeMarks = ['stage_pin', 'quill_notch', 'feather_tape', 'workshop_stamp'];
    scene.markFiredThisTurn = new Set();
    scene.flock.maxHp = 40;
    scene.flock.hp = 20;
    scene.flock.block = 0;
    scene.flock.openSkyGuard = 0;
    scene.checkSuitPlayedMarks('plumes');
    scene.checkSuitPlayedMarks('quills');
    scene.checkSuitPlayedMarks('basins');
    scene.checkSuitPlayedMarks('nests');
    const suitMarks = {
      hp: scene.flock.hp,
      block: scene.flock.block,
      guard: scene.flock.openSkyGuard,
    };

    scene.routeMarks = ['rooftop_relay_bell'];
    scene.markFiredThisCombat = new Set();
    scene.energy = 3;
    scene.checkSupplyUsedMarks();
    const relayEnergy = scene.energy;

    scene.routeMarks = ['parade_mirror'];
    scene.markFiredThisCombat = new Set();
    scene.cardsPlayedThisTurn = 2;
    scene.spark = 0;
    scene.checkNthCardMarks();
    const paradeSpark = scene.spark;

    scene.routeMarks = ['fresh_pinfeather'];
    scene.markFiredThisCombat = new Set();
    scene.flock.molt = false;
    scene.nextTurnEnergyBonus = 0;
    scene.enterMolt('test');
    const pinfeatherNextEnergy = scene.nextTurnEnergyBonus;

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
    scene.checkNoDamageTurnMarks();
    const nestLiningCover = scene.flock.block;

    scene.routeMarks = ['crowbar_debt'];
    scene.markFiredThisTurn = new Set();
    scene.enemies.forEach((enemy: any) => { enemy.maxHp = 20; enemy.hp = 20; });
    scene.checkEnemyCoverBrokenMarks();
    const crowbarDamage = scene.enemies.map((enemy: any) => 20 - enemy.hp);
    const waymarkFeedback = window.__birdSquadState!().waymarkFeedback ?? [];

    return {
      baseBlock,
      baseEnergy,
      markBlock,
      markEnergy,
      chalkCover,
      suitMarks,
      relayEnergy,
      paradeSpark,
      pinfeatherNextEnergy,
      harborNextDraw,
      nestLiningCover,
      crowbarDamage,
      waymarkFeedback,
    };
  });
  expect(r.baseBlock).toBe(0);          // no relic, no bonus cover
  expect(r.baseEnergy).toBe(3);
  expect(r.markBlock).toBeGreaterThanOrEqual(3); // patched_shoulder_wrap grants Cover at combat start
  expect(r.markEnergy).toBeGreaterThanOrEqual(4); // loose_feather_token grants a turn-1 Wingbeat
  expect(r.chalkCover).toBe(3);
  expect(r.suitMarks.guard).toBe(1);
  expect(r.suitMarks.block).toBe(8);
  expect(r.suitMarks.hp).toBe(22);
  expect(r.relayEnergy).toBe(4);
  expect(r.paradeSpark).toBe(1);
  expect(r.pinfeatherNextEnergy).toBe(1);
  expect(r.harborNextDraw).toBe(1);
  expect(r.nestLiningCover).toBe(6);
  expect(r.crowbarDamage.every((damage: number) => damage === 2)).toBe(true);
  expect(r.waymarkFeedback[0]).toEqual(expect.objectContaining({
    id: 'crowbar_debt',
    name: 'Crowbar Debt',
  }));
  expect(r.waymarkFeedback[0].summary).toContain('Cover broken');
});

test('waymark artifact drawer renders found item art and run tooltips', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !window.__birdSquadState?.()?.hand?.length; i += 1) await wait(50);
    scene.routeMarks = ['chalk_wingmark', 'rooftop_shortcut', 'wire_map', 'crowbar_debt', 'rain_gutter'];
    scene.waymarkDrawerOpen = true;
    scene.renderAll();
    for (
      let i = 0;
      i < 40 && !scene.routeMarks.every((id: string) => scene.textures.exists(`waymark-${id}`));
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
      hasIconTexture: scene.textures.exists('waymark-chalk_wingmark'),
      hasAllIconTextures: scene.routeMarks.every((id: string) => scene.textures.exists(`waymark-${id}`)),
      hasDrawerTitle: texts.includes('Found Waymarks'),
      hasShelfLabel: texts.includes('WAYMARKS'),
      hasArtifactName: texts.includes('Chalk Wingmark')
    };
  });
  expect(r.drawerOpen).toBe(true);
  expect(r.carried).toContain('chalk_wingmark');
  expect(r.hasIconTexture).toBe(true);
  expect(r.hasAllIconTextures).toBe(true);
  expect(r.hasDrawerTitle).toBe(true);
  expect(r.hasShelfLabel).toBe(true);
  expect(r.hasArtifactName).toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.artifacts/test-results/waymark-artifact-drawer.png' });
  await page.mouse.move(8, 8);
  await page.mouse.move(224, 220, { steps: 8 });
  await page.waitForTimeout(250);
  const tooltipTexts = await page.evaluate(() => {
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
  expect(tooltipTexts.some((text) => text.includes('The first time enemy Cover is broken each turn, gain 3 Cover.'))).toBe(true);
  await page.screenshot({ path: '.artifacts/test-results/waymark-artifact-tooltip.png' });
});

test('flock formation states reshape combat and an unblocked hit shatters Flow', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    const enemy = s.enemies[0];

    // Holding baseline (full Cohesion, no Flow).
    s.flock.hp = s.flock.maxHp; s.flock.flow = 0;
    const holding = s.flockState();

    // Surging hit (Flow full) vs Holding hit - Surge adds +1 outgoing damage.
    enemy.block = 0; enemy.maxHp = 200; enemy.hp = 200;
    s.flock.flow = s.flock.flowMax;
    const surging = s.flockState();
    s.damageEnemy(enemy.id, 5, 'test');
    const surgeDamage = 200 - enemy.hp;

    enemy.block = 0; enemy.hp = 200;
    s.flock.hp = s.flock.maxHp; s.flock.flow = 0; // back to Holding
    s.damageEnemy(enemy.id, 5, 'test');
    const holdDamage = 200 - enemy.hp;

    // Scatter when Cohesion drops below the threshold.
    s.flock.hp = 1; s.flock.flow = 0;
    const scattered = s.flockState();

    // An unblocked hit shatters Flow back to 0.
    s.flock.hp = s.flock.maxHp; s.flock.flow = 3; s.flock.block = 0;
    s.damageFlock(enemy, 5);
    const flowAfterHit = s.flock.flow;

    return { holding, surging, scattered, surgeDamage, holdDamage, flowAfterHit };
  });
  expect(r.holding).toBe('holding');
  expect(r.surging).toBe('surging');
  expect(r.scattered).toBe('scattered');
  expect(r.surgeDamage).toBe(r.holdDamage + 1); // Surge = +1 outgoing damage
  expect(r.flowAfterHit).toBe(0);               // unblocked hit broke formation
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
    g.scene.start('BattleScene', { runState: route.runState, routeNodeId: 'm1_entry' });
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

test('playing four or more cards overextends the flock into Open Sky', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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

test('codex: starting a run discovers its deck and the Codex screen renders', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    window.localStorage.removeItem('birdsquad.account'); // fresh: nothing discovered yet
    g.scene.start('MenuScene');
    await wait(120);
    const m: any = g.scene.getScene('MenuScene');
    for (let i = 0; i < 20 && !(m.leaderPanels && m.leaderPanels.length); i += 1) await wait(50);
    m.selectLeader('spark_caller');
    m.startRun(); // createInitialRunState marks the starting deck discovered
    await wait(150);
    const acct = JSON.parse(window.localStorage.getItem('birdsquad.account') || '{}');
    const discoveredCount = (acct.discoveredCards || []).length;
    g.scene.start('CodexScene');
    await wait(200);
    const active = g.scene.getScenes(true).map((s: any) => s.scene.key).includes('CodexScene');
    const cs: any = g.scene.getScene('CodexScene');
    return { discoveredCount, active, codexFound: cs.discovered ? cs.discovered.size : 0 };
  });
  expect(r.discoveredCount).toBeGreaterThanOrEqual(8); // Spark-Caller's 10-card deck (distinct ids)
  expect(r.active).toBe(true);
  expect(r.codexFound).toBeGreaterThanOrEqual(8);
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
    const g = window.__birdSquadGame;
    g.scene.start('CodexScene');
    g.scene.stop('MenuScene');
    const cs: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 20 && !cs.root; i += 1) await wait(50);
    cs.activeSection = 'items';
    cs.activeItemTab = 1;
    cs.detailId = undefined;
    cs.gridScroll = 0;
    cs.renderAll();
    for (let i = 0; i < 40 && !cs.textures.exists('supply-bottlecap_popper'); i += 1) await wait(50);
    const listTexts = collectTexts(cs);

    cs.detailId = 'seed_packet';
    cs.detailScroll = 0;
    cs.renderAll();
    const detailTexts = collectTexts(cs);
    return {
      totalItems: cs.allCodexItems ? cs.allCodexItems().length : 0,
      supplies: cs.allSupplies ? cs.allSupplies().length : 0,
      hasSubtitle: listTexts.some((t) => /89 items cataloged \(58 Waymarks \/ 31 Supplies\)/.test(t)),
      hasTab: listTexts.some((t) => t === 'Supplies'),
      hasSeedPacket: listTexts.some((t) => /Seed Packet/.test(t)),
      hasBottlecap: listTexts.some((t) => /Bottlecap Popper/.test(t)),
      hasBottlecapArt: cs.textures.exists('supply-bottlecap_popper'),
      hasDetailUse: detailTexts.some((t) => /USE/.test(t)),
      hasDetailEffects: detailTexts.some((t) => /healCohesion\(6\)/.test(t)),
      hasImageBrief: detailTexts.some((t) => /IMAGE BRIEF/.test(t))
        && detailTexts.some((t) => /Bird Squad title splash art/.test(t)),
    };
  });
  expect(r.totalItems).toBe(89);
  expect(r.supplies).toBe(31);
  expect(r.hasSubtitle).toBe(true);
  expect(r.hasTab).toBe(true);
  expect(r.hasSeedPacket).toBe(true);
  expect(r.hasBottlecap).toBe(true);
  expect(r.hasBottlecapArt).toBe(true);
  expect(r.hasDetailUse).toBe(true);
  expect(r.hasDetailEffects).toBe(true);
  expect(r.hasImageBrief).toBe(true);
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
    const supplyTextureKeys = supplyIds.map((id) => `supply-${id}`);
    g.scene.start('BattleScene', {
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
  expect(r.afterPierce.hp).toBe(34);
  expect(r.afterPierce.block).toBe(12);
  expect(r.afterSolvent.block).toBe(2);
  expect(r.afterSnips.block).toBe(0);
  expect(r.afterSnips.winded).toBe(2);
  expect(r.afterSplint.hp).toBe(24);
  expect(r.afterSplint.weak).toBe(1);
  expect(r.afterSplint.frail).toBe(0);
  expect(r.afterSplint.fouled).toBe(1);
  expect(r.afterMolt.molt).toBe(true);
  expect(r.afterMolt.guard).toBe(1);
  expect(r.afterStorm.energy).toBe(r.beforeStorm.energy + 2);
  expect(r.afterStorm.hp).toBe(r.beforeStorm.hp - 4);
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
    const newSupplyTextures = newSupplyIds.map((id) => `supply-${id}`);
    const newWaymarkTextures = newWaymarkIds.map((id) => `waymark-${id}`);
    g.scene.start('BattleScene', {
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
    for (let i = 0; i < 20 && !(s.enemies && s.enemies.length && s.hand && s.hand.length); i += 1) await wait(50);
    for (let i = 0; i < 60 && ![...newSupplyTextures, ...newWaymarkTextures].every((key) => s.textures.exists(key)); i += 1) await wait(100);

    const enemy = s.enemies[0];
    enemy.maxHp = 60;
    enemy.hp = 60;
    enemy.block = 0;
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
    s.applyCombatStartMarks();
    const afterCounterweight = { block: s.flock.block };

    s.runSupplies = ['seed_packet'];
    s.runSuppliesUsed = [];
    if (s.drawPile.length === 0 && s.hand.length > 0) s.drawPile = [{ ...s.hand[0], instanceId: 'supply-bell-draw' }];
    const handBeforeBell = s.hand.length;
    s.useSupply(0);
    const afterBell = { hand: s.hand.length };

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
  expect(r.afterClamp.block).toBeGreaterThanOrEqual(4);
  expect(r.afterClamp.pendingNest).toBe(8);
  expect(r.afterClamp.retain).toBe(1);
  expect(r.afterSmoke.winded).toBe(3);
  expect(r.afterSmoke.nextDraw).toBe(1);
  expect(r.afterWindcatcher.nextEnergy).toBe(2);
  expect(r.afterBattery.hp).toBe(54);
  expect(r.afterBattery.spark).toBe(0);
  expect(r.afterLedger.scrap).toBe(20);
  expect(r.afterLedger.hp).toBe(r.afterLedger.beforeHp - 3);
  expect(r.afterCounterweight.block).toBe(6);
  expect(r.afterBell.hand).toBeGreaterThanOrEqual(r.handBeforeBell + 1);
  expect(r.afterMoltMarks.hand).toBeGreaterThanOrEqual(r.handBeforeMolt + 1);
  expect(r.afterMoltMarks.block).toBe(6);
  expect(r.afterSuitMarks.spark).toBe(1);
  expect(r.afterSuitMarks.hp).toBe(19);
  expect(r.afterSuitMarks.pendingNest).toBe(4);
  expect(r.afterHealMark.hp).toBe(22);
  expect(r.afterHealMark.block).toBe(2);
});

test('next item pass supplies and Waymarks execute route and combat hooks', async ({ page }) => {
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

    g.scene.start('RouteScene', {
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
    const routeSupplyKeys = ['supply-spare_pocket', 'supply-map_sticker_strip', 'supply-thermos_lid', 'supply-market_iou'];
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
      previewLogged: route.runState.routeLog.some((line: string) => /Route preview/.test(line)),
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
    route.applyRouteMarkTrigger('afterMarketPurchase');
    const afterLedger = { scrap: route.runState.scrap };
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
      previewLogged: route.runState.routeLog.some((line: string) => /Route preview/.test(line)),
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

    g.scene.start('BattleScene', {
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
      ...nextSupplies.map((id) => `supply-${id}`),
      ...nextWaymarks.map((id) => `waymark-${id}`),
    ];
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
    battle.checkSupplyUsedMarks();
    const afterDoublePacked = { pending: battle.pendingSupplyRepeats };
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
    battle.flock.weak = 2;
    battle.flock.frail = 2;
    battle.flock.fouled = 2;
    battle.healFlock(2, 'test heal');
    const afterSafetyPin = { hp: battle.flock.hp, weak: battle.flock.weak, frail: battle.flock.frail, fouled: battle.flock.fouled };

    battle.routeMarks = ['nest_measure_line'];
    battle.markFiredThisTurn = new Set();
    battle.pendingRetainHand = 0;
    battle.checkSuitPlayedMarks('nests');
    const afterMeasureLine = { retain: battle.pendingRetainHand };

    battle.routeMarks = ['plumes_applause_cap'];
    battle.markFiredThisCombat = new Set();
    battle.cardsPlayedThisTurn = 4;
    battle.spark = 0;
    battle.checkNthCardMarks();
    const afterApplauseCap = { spark: battle.spark };

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
  expect(r.afterSticker.previewLogged).toBe(true);
  expect(r.afterSticker.scrap).toBe(17);
  expect(r.afterSticker.feedback.id).toBe('map_sticker_strip');
  expect(r.afterSticker.feedback.summary).toContain('Preview');
  expect(r.afterThermos.hp).toBe(25);
  expect(r.afterThermos.guard).toBe(1);
  expect(r.afterIou.hp).toBe(23);
  expect(r.afterIou.scrap).toBe(27);
  expect(r.afterIou.freePreen).toBe(1);
  expect(r.afterLedger.scrap).toBe(20);
  expect(r.afterCacheHook.supplies).toBe(1);
  expect(r.afterIouAfterMarket.hadMarketNode).toBe(true);
  expect(r.afterIouAfterMarket.hp).toBe(20);
  expect(r.afterIouAfterMarket.scrap).toBe(22);
  expect(r.afterIouAfterMarket.freePreen).toBe(1);
  expect(r.afterBusAfterSignal.hadSignalNode).toBe(true);
  expect(r.afterBusAfterSignal.scrap).toBe(32);
  expect(r.afterBusAfterSignal.supplies).toBe(1);
  expect(r.afterBusAfterSignal.previewLogged).toBe(true);
  expect(r.afterSeedAfterBasin.hadBasinNode).toBe(true);
  expect(r.afterSeedAfterBasin.hp).toBe(28);
  expect(r.afterChalk.block).toBe(0);
  expect(r.afterChalk.hand).toBeGreaterThanOrEqual(r.afterChalk.beforeHand + 1);
  expect(r.afterChalk.feedback.id).toBe('chalk_dust_pouch');
  expect(r.afterChalk.feedback.summary).toContain('Remove');
  expect(r.afterChalk.waymarkFeedback.id).toBe('broken_cover_chime');
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
  expect(r.afterSparkClip.block).toBe(5);
  expect(r.afterQuietRoost.hp).toBe(22);
  expect(r.afterDoublePacked.pending).toBe(1);
  expect(r.afterRepeatedSupply.hp).toBe(32);
  expect(r.afterRepeatedSupply.pending).toBe(0);
  expect(r.afterRepeatedSupply.feedback.id).toBe('seed_packet');
  expect(r.afterRepeatedSupply.feedback.summary).toContain('x2');
  expect(r.afterSafetyPin.hp).toBe(22);
  expect(r.afterSafetyPin.weak).toBe(1);
  expect(r.afterSafetyPin.frail).toBe(1);
  expect(r.afterSafetyPin.fouled).toBe(1);
  expect(r.afterMeasureLine.retain).toBe(1);
  expect(r.afterApplauseCap.spark).toBe(2);
  expect(r.afterShadowTag.guard).toBe(2);
});

test('enemy codex: entire enemy cast renders with art and details', async ({ page }) => {
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
    const g = window.__birdSquadGame;
    g.scene.start('CodexScene');
    g.scene.stop('MenuScene');
    const cs: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 20 && !cs.root; i += 1) await wait(50);
    cs.activeSection = 'enemies';
    cs.activeEnemyTab = 0;
    cs.detailId = undefined;
    cs.gridScroll = 0;
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
      hasCatalogCount: listTexts.some((t) => /81 enemies cataloged \(64 playable \/ 17 reserve concepts\)/.test(t)),
      hasRuntimeEnemyName: runtimeTexts.some((t) => /Roof Rat/.test(t)),
      hasCombatKit: runtimeTexts.some((t) => /COMBAT KIT/.test(t)),
      hasReserveEnemyName: reserveTexts.some((t) => /Mole Tunnelbreaker/.test(t)),
      hasMoveKit: reserveTexts.some((t) => /MOVE KIT/.test(t)),
      hasFashion: reserveTexts.some((t) => /FASHION DIRECTION/.test(t)),
      hasRuntimeArt: cs.textures.exists('enemy-roof_rat'),
      hasReserveArt: cs.textures.exists('reserve-enemy-mole_tunnelbreaker'),
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
});

test('promoted reserve enemies can surface in generated route encounters', async ({ page }) => {
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
        g.scene.start('RouteScene', { runState: mkRunState(`promoted-enemy-${group.mapIndex}-${i}`, group.mapIndex) });
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
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && (!(s.hand && s.hand.length) || !s.fxLayer); i += 1) await wait(50);
    const card = s.hand[0];
    const enemy = s.enemies[0];

    s.routeMarks = ['black_ink_pin'];
    s.markFiredThisCombat = new Set();
    s.energy = 3;
    s.cardsPlayedThisTurn = 2;
    s.checkNthCardMarks();
    const energyAfterSecondCard = s.energy;

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
      energyAfterSecondCard,
      nextEnergyAfterMolt,
      returnSelfToDraw: loopOutcome.returnSelfToDraw,
      enemyBlockAfterBreaker: enemy.block,
      enemyHpAfterBreaker: enemy.hp
    };
  });
  expect(r.energyAfterSecondCard).toBe(4);
  expect(r.nextEnergyAfterMolt).toBe(1);
  expect(r.returnSelfToDraw).toBe(true);
  expect(r.enemyBlockAfterBreaker).toBe(3);
  expect(r.enemyHpAfterBreaker).toBeLessThanOrEqual(48);
});

test('Molt is a do-DIFFERENT transform stance: a card resolves its molt ability while Molting', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !(s.hand && s.hand.length); i += 1) await wait(50);
    // Locked Nest (in the Fledgling deck): normal = gainCover(7), Molt = damage.
    const nest = [...s.drawPile, ...s.hand, ...s.discardPile].find((c: any) => c.id === 'pentacles_04');
    const enemy = s.enemies[0];

    const hasMoltText = !!(nest && nest.moltText);

    // Normal mode: gains Cover, deals no damage.
    s.flock.flow = 0; s.flock.molt = false; s.flock.block = 0;
    enemy.block = 0; enemy.maxHp = 500; enemy.hp = 500;
    s.resolveCardEffects(nest, enemy.id);
    const coverNormal = s.flock.block;
    const dmgNormal = 500 - enemy.hp;

    // Molt mode: the wall lashes out — deals damage, no Cover.
    s.flock.molt = true; s.flock.block = 0; enemy.hp = 500;
    s.resolveCardEffects(nest, enemy.id);
    const coverMolt = s.flock.block;
    const dmgMolt = 500 - enemy.hp;

    return { hasMoltText, coverNormal, dmgNormal, coverMolt, dmgMolt };
  });
  expect(r.hasMoltText).toBe(true);                 // every card has a molt ability
  expect(r.coverNormal).toBeGreaterThanOrEqual(7);  // normal: gains Cover
  expect(r.dmgNormal).toBe(0);                      // normal: no damage
  expect(r.coverMolt).toBe(0);                      // molt: no Cover (does DIFFERENT)
  expect(r.dmgMolt).toBeGreaterThanOrEqual(7);      // molt: deals damage instead
});

test('Molt active card contract drives hand display and enemy targeting', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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
    const selectedAfterCardClick = s.selectedInstanceId === card.instanceId;
    const hpAfterCardClick = enemy.hp;
    s.onEnemyClicked(enemy.id);

    return {
      activeTarget: handPayload.activeTarget,
      activeText: handPayload.activeText,
      usesMolt: handPayload.usesMolt,
      selectedAfterCardClick,
      hpAfterCardClick,
      hpAfterEnemyClick: enemy.hp,
      handAfterEnemyClick: s.hand.length,
    };
  });

  expect(r.usesMolt).toBe(true);
  expect(r.activeTarget).toBe('enemy');
  expect(r.activeText).toContain('Deal');
  expect(r.selectedAfterCardClick).toBe(true);
  expect(r.hpAfterCardClick).toBe(500);
  expect(r.hpAfterEnemyClick).toBeLessThan(500);
  expect(r.handAfterEnemyClick).toBe(0);
});

test('none-target cards that Molt into target effects no longer auto-fire ambiguously', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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
    g.scene.start('CodexScene'); g.scene.stop('BattleScene');
    const cs: any = g.scene.getScene('CodexScene');
    for (let i = 0; i < 20 && !cs.root; i += 1) await wait(50);
    cs.detailId = 'pentacles_04'; cs.detailScroll = 0; cs.renderAll();
    await wait(150);
    const all: any[] = []; const walk = (o: any) => { if (!o) return; if (o.type === 'Text') all.push(o); const k = o.list; if (Array.isArray(k)) k.forEach(walk); };
    cs.children.list.forEach(walk);
    const texts = all.map((t) => t.text || '');
    const hasTarot = texts.some((t) => /TAROT MEANING/.test(t)) && texts.some((t) => /UPRIGHT/.test(t)) && texts.some((t) => /REVERSED/.test(t));
    const hasFacts = texts.some((t) => /ABOUT THE/.test(t));
    // a keyword token is interactive and pops a tooltip on hover
    const kw = all.filter((t) => t.input).find((t) => (t.text || '').toLowerCase().includes('cover'));
    kw?.emit('pointerover');
    await wait(100);
    const tip = cs.children.list.find((o: any) => o.depth === 99999);

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
    for (const id of (cs.allCards ? cs.allCards() : []).map((c: any) => c.id)) {
      cs.detailId = id; cs.detailScroll = 0; cs.renderAll();
      if (cs.detailMaxScroll > heavyMax) heavyMax = cs.detailMaxScroll;
    }
    return { hasTarot, hasFacts, keywordTooltip: !!tip, hasAviaryDossier, hasAviaryLegend, aviarySaysTarot, heavyMax };
  });
  expect(codex.hasTarot).toBe(true);
  expect(codex.hasFacts).toBe(true);
  expect(codex.keywordTooltip).toBe(true);
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
    g.scene.start('BattleScene', {});
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

    const names = s.enemies.map((e: any) => e.name);
    const types = s.enemies.map((e: any) => e.runtime.type);
    const snap = window.__birdSquadState!();
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
    g.scene.start('BattleScene', {});
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
    const targetCard = s.hand.find((card: any) => card.target === 'enemy');
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
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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

  expect(r.beforeMode).toBe('cardReward');
  expect(r.afterMode).toBe('cardReward');
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
    g.scene.start('BattleScene', {
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
    g.scene.start('BattleScene', {});
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
  expect(r.taken).toBe(9);
  expect(r.blocksAfter.every((block: number) => block === 0)).toBe(true);
  expect(r.intentsAfter).toEqual([r.intentsBefore[0] + 1, r.intentsBefore[1], r.intentsBefore[2]]);
  expect(r.log).toEqual(expect.arrayContaining(['Gutter Baron hits the flock for 9.']));
  expect(r.log.some((entry: string) => entry.includes('Roof Rat A hits'))).toBe(false);
});

test('fullyBlocksNextAttack checks the next incoming attack, not stale selection', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
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
