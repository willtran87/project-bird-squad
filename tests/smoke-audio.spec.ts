import { test, expect } from '@playwright/test';
import { boot } from './helpers/smoke';

// Split from the former tests/smoke.spec.ts (audio topics). Tests drive
// scenes through the deterministic text-state harness on window.

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

test('synthesized cues stay lazy and the first interaction survives the chunk load', async ({ page }) => {
  test.setTimeout(30_000);
  await page.addInitScript(() => localStorage.removeItem('birdsquad.audioMuted'));
  await boot(page);
  // MenuScene exists before its title-readiness gate accepts interaction.
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').titleBoot?.ready === true);

  const before = await page.evaluate(() => ({
    audio: window.__birdSquadAudio!(),
    sfxResources: performance.getEntriesByType('resource')
      .filter((entry) => /audio-sfx(?:-|\.ts)/.test(entry.name))
      .map((entry) => entry.name),
  }));
  expect(before.audio.sfx).toEqual({ status: 'idle', played: 0 });
  expect(before.sfxResources).toHaveLength(0);

  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => {
    const audio = window.__birdSquadAudio?.();
    return audio?.sfx?.status === 'ready' && audio.sfx.played >= 1;
  });
  const first = await page.evaluate(() => ({
    audio: window.__birdSquadAudio!(),
    sfxResources: performance.getEntriesByType('resource')
      .filter((entry) => /audio-sfx(?:-|\.ts)/.test(entry.name))
      .map((entry) => entry.name),
  }));

  expect((first.audio.cueRequests.confirm ?? 0) - (before.audio.cueRequests.confirm ?? 0)).toBe(1);
  expect(first.audio.sfx).toEqual({ status: 'ready', played: 1 });
  expect(first.sfxResources).toHaveLength(1);

  // Repeated UI cues within 80ms are intentionally coalesced by AudioCueBudget.
  // This check exercises a separate interaction, not burst suppression.
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__birdSquadAudio?.().sfx?.played >= 2);
  const second = await page.evaluate(() => ({
    audio: window.__birdSquadAudio!(),
    sfxResources: performance.getEntriesByType('resource')
      .filter((entry) => /audio-sfx(?:-|\.ts)/.test(entry.name))
      .map((entry) => entry.name),
  }));
  expect(second.audio.sfx).toEqual({ status: 'ready', played: 2 });
  expect(second.sfxResources).toEqual(first.sfxResources);

  await page.keyboard.press('KeyM');
  await page.waitForFunction(() => window.__birdSquadAudio?.().sfx?.played >= 3);
  const muted = await page.evaluate(() => window.__birdSquadAudio!());
  expect(muted.muted).toBe(true);
  expect((muted.cueRequests.close ?? 0) - (second.audio.cueRequests.close ?? 0)).toBe(1);
  expect(muted.sfx).toEqual({ status: 'ready', played: 3 });
});

test('card plays route distinct suit voices and add a Molt accent without carrying gameplay information', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem('birdsquad.sfxVolume', '0.65');
    localStorage.setItem('birdsquad.voiceVolume', '0.25');
  });
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (scene.mode === 'battle' && !scene.combatAnimationPending) break;
      await wait(25);
    }
    const base = scene.allDeckCards()[0];
    const makeCard = (voice: 'plumes' | 'quills' | 'basins' | 'nests' | null, suffix: string, molt = false) => ({
      ...base,
      id: `audio-${suffix}`,
      instanceId: `audio-${suffix}`,
      name: `Audio ${suffix}`,
      upgraded: false,
      runtime: {
        ...base.runtime,
        id: `audio-${suffix}`,
        displayName: `Audio ${suffix}`,
        kind: voice ? 'crew' : 'snag',
        suit: voice,
        cost: 0,
        target: 'self',
        tags: ['audio-test'],
        effects: ['gainCover(0)'],
        moltEffects: molt ? ['gainCover(0)'] : [],
        flockStats: {},
        upgrade: {
          ...base.runtime.upgrade,
          effects: ['gainCover(0)'],
          moltEffects: molt ? ['gainCover(0)'] : [],
          flockStats: {},
        },
      },
    });
    const cards = [
      makeCard('plumes', 'plumes'),
      makeCard('quills', 'quills'),
      makeCard('basins', 'basins'),
      makeCard('nests', 'nests'),
      makeCard(null, 'neutral'),
    ];
    scene.hand = [...cards];
    scene.energy = 9;
    scene.routeMarks = [];
    const before = window.__birdSquadAudio!();
    const enemyId = scene.enemies.find((enemy: any) => enemy.hp > 0)?.id ?? '';
    const variants: number[] = [];
    for (const card of cards) {
      scene.playCard(card, enemyId, { resolveDelayMs: 0 });
      await wait(10);
      variants.push(window.__birdSquadAudio!().music.cardVoices.last.variant);
    }

    scene.flock.molt = true;
    const moltCard = makeCard('plumes', 'plumes-molt', true);
    scene.hand = [moltCard];
    scene.playCard(moltCard, enemyId, { resolveDelayMs: 0 });
    await wait(50);
    variants.push(window.__birdSquadAudio!().music.cardVoices.last.variant);
    return { before, after: window.__birdSquadAudio!(), variants };
  });

  expect(result.after.cueRequests.card - (result.before.cueRequests.card ?? 0)).toBe(6);
  expect(result.before.sfxVolume).toBeCloseTo(0.65, 4);
  expect(result.before.voiceVolume).toBeCloseTo(0.25, 4);
  expect(result.after.music.cardVoices.requests.plumes - (result.before.music.cardVoices?.requests?.plumes ?? 0)).toBe(2);
  for (const voice of ['quills', 'basins', 'nests', 'neutral']) {
    expect(
      result.after.music.cardVoices.requests[voice] - (result.before.music.cardVoices?.requests?.[voice] ?? 0),
      voice,
    ).toBe(1);
  }
  expect(result.variants).toEqual([0, 1, 2, 0, 1, 2]);
  expect(result.after.music.cardVoices.last).toEqual({ voice: 'plumes', usesMolt: true, sequence: 6, variant: 2, volume: 0.25 });
  await page.screenshot({
    path: '.artifacts/test-results/card-suit-voices-molt-1600x900.png',
    fullPage: true,
  });
});

test('Preen commitments use the distinct upgrade signature across combat rewards, route prep, and Market service', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const cueCount = () => window.__birdSquadAudio!().cueRequests.moltPower ?? 0;

    const battle: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (battle.mode === 'battle' && !battle.combatAnimationPending) break;
      await wait(25);
    }
    const combatCard = battle.allDeckCards().find((card: any) => !card.upgraded && card.text !== card.upgradedText);
    if (!combatCard) throw new Error('No combat Preen candidate was available.');
    battle.upgradeChoices = [combatCard];
    battle.mode = 'upgradeReward';
    const combatBefore = cueCount();
    battle.chooseUpgradeCard(combatCard.id);
    const combatAfter = cueCount();

    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    const routeChoice = route.pickerEligibleCards('preen', 'districtPreen')[0];
    if (!routeChoice) throw new Error('No route Preen candidate was available.');
    route.cardPickerMode = 'preen';
    route.cardPickerContext = 'districtPreen';
    route.cardPickerRemainingPicks = 1;
    route.runState.pendingDistrictPreens = 1;
    const routeBefore = cueCount();
    route.applyCardPick(routeChoice.index);
    const routeAfter = cueCount();

    route.runState.scrap = 999;
    const marketNode = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'market')
      ?? window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type !== 'boss');
    marketNode.type = 'market';
    route.openMarketNode(marketNode);
    const preenSlot = route.marketUtilityShelf.findIndex((offer: any) => offer.id === 'preen');
    if (preenSlot < 0) throw new Error('Market did not offer Preen.');
    route.buyMarketUtility(preenSlot);
    const marketChoice = route.pickerEligibleCards('preen', 'market')
      .find((entry: any) => route.runState.scrap >= entry.cost);
    if (!marketChoice) throw new Error('No affordable Market Preen candidate was available.');
    const marketBefore = cueCount();
    route.applyCardPick(marketChoice.index);
    const marketAfter = cueCount();

    return {
      combatDelta: combatAfter - combatBefore,
      routeDelta: routeAfter - routeBefore,
      marketDelta: marketAfter - marketBefore,
      combatUpgraded: combatCard.upgraded,
      routeUpgraded: route.runState.deck[routeChoice.index]?.upgraded,
      marketUpgraded: route.runState.deck[marketChoice.index]?.upgraded,
    };
  });

  expect(result).toEqual({
    combatDelta: 1,
    routeDelta: 1,
    marketDelta: 1,
    combatUpgraded: true,
    routeUpgraded: true,
    marketUpgraded: true,
  });
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

test('mute shortcut reuses rendered audio feedback without re-entering core scenes', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);

  const startOnly = async (sceneKey: 'MenuScene' | 'ProfileScene' | 'CodexScene' | 'RouteScene' | 'BattleScene', data: Record<string, unknown> = {}) => {
    await page.evaluate(async ({ sceneKey, data }) => {
      const game = window.__birdSquadGame;
      const target: any = await window.__birdSquadStartScene!(sceneKey, data);
      for (const active of game.scene.getScenes(true)) {
        if (active !== target) game.scene.stop(active.sys.settings.key);
      }
    }, { sceneKey, data });
    await page.waitForFunction((key) => {
      const scene: any = window.__birdSquadGame.scene.getScene(key);
      const collect = (items: any[]): any[] => items.flatMap((child: any) => [
        child,
        ...(Array.isArray(child.list) ? collect(child.list) : []),
      ]);
      if (key === 'ProfileScene') return scene.sys.settings.active;
      return collect(scene.children.list).some((child: any) => child.name === 'audio-toggle-control-hit' && child.input?.enabled)
        && scene.textures.exists('ui-icon-audio-toggle-wave-burst');
    }, sceneKey);
    await page.evaluate(() => window.advanceTime?.(300));
    await page.waitForTimeout(350);
    await page.waitForFunction(() => {
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      const transition = state.titleTransition ?? state.transition;
      return !transition || transition.fadeRunning === false;
    });
    await page.waitForFunction((key) => {
      if (key === 'ProfileScene') return true;
      const scene: any = window.__birdSquadGame.scene.getScene(key);
      const collect = (items: any[]): any[] => items.flatMap((child: any) => [
        child,
        ...(Array.isArray(child.list) ? collect(child.list) : []),
      ]);
      const hit = collect(scene.children.list)
        .filter((child: any) => child.name === 'audio-toggle-control-hit' && child.input?.enabled)
        .at(-1);
      if (!hit) return false;
      if (scene.__muteTestStableHit !== hit) {
        scene.__muteTestStableHit = hit;
        scene.__muteTestStableSince = performance.now();
        return false;
      }
      return performance.now() - scene.__muteTestStableSince >= 300;
    }, sceneKey);
  };

  const snapshot = (sceneKey: string) => page.evaluate((key) => {
    const scene: any = window.__birdSquadGame.scene.getScene(key);
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    const objects = collect(scene.children.list);
    const hits = objects.filter((child: any) => child.name === 'audio-toggle-control-hit' && child.input?.enabled);
    const visibleBursts = objects.filter((child: any) => child.name === 'audio-toggle-wave-burst' && child.visible && child.alpha > 0.01);
    return {
      audio: window.__birdSquadAudio?.(),
      hitCount: hits.length,
      hitLabel: hits.at(-1)?.getData('label'),
      feedbackBursts: Number(hits.at(-1)?.getData('feedbackBursts') ?? 0),
      visibleBursts: visibleBursts.length,
      focus: state.titleFocus?.current ?? state.focus?.current ?? state.codexFocus?.current ?? null,
      marker: state.titleTransition ?? state.transition ?? scene.activationId ?? null,
    };
  }, sceneKey);

  const surfaces: Array<{
    key: 'MenuScene' | 'ProfileScene' | 'CodexScene' | 'RouteScene' | 'BattleScene';
    data?: Record<string, unknown>;
  }> = [
    { key: 'MenuScene' },
    { key: 'ProfileScene' },
    { key: 'CodexScene' },
    { key: 'RouteScene' },
    { key: 'BattleScene', data: { routeNodeId: 'm1_entry' } },
  ];

  for (const surface of surfaces) {
    await startOnly(surface.key, surface.data);
    const before = await snapshot(surface.key);
    if (surface.key === 'ProfileScene') expect(before.hitCount).toBe(0);
    else expect(before.hitCount, surface.key).toBeGreaterThanOrEqual(1);
    expect(before.visibleBursts, surface.key).toBe(0);

    await page.keyboard.press('m');
    const during = await snapshot(surface.key);
    expect(during.audio.muted, surface.key).toBe(!before.audio.muted);
    if (surface.key === 'ProfileScene') expect(during.feedbackBursts).toBe(0);
    else {
      expect(during.hitLabel, surface.key).toBe(during.audio.muted ? 'Unmute' : 'Mute');
      expect(during.feedbackBursts, surface.key).toBe(before.feedbackBursts + 1);
    }
    expect(during.focus, surface.key).toBe(before.focus);
    expect(during.marker, surface.key).toEqual(before.marker);

    await page.waitForTimeout(520);
    expect((await snapshot(surface.key)).visibleBursts, surface.key).toBe(0);
  }
});

test('mute shortcut preserves pause and settings overlays while reusing their audio feedback', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);

  type OverlayScenario = {
    name: string;
    sceneKey: 'MenuScene' | 'RouteScene' | 'BattleScene';
    openKey: 'p' | 's';
    settings: boolean;
    data?: Record<string, unknown>;
  };
  const scenarios: OverlayScenario[] = [
    { name: 'menu settings', sceneKey: 'MenuScene', openKey: 's', settings: true },
    { name: 'route pause', sceneKey: 'RouteScene', openKey: 'p', settings: false },
    { name: 'route settings', sceneKey: 'RouteScene', openKey: 's', settings: true },
    { name: 'battle pause', sceneKey: 'BattleScene', openKey: 'p', settings: false, data: { routeNodeId: 'm1_entry' } },
    { name: 'battle settings', sceneKey: 'BattleScene', openKey: 's', settings: true, data: { routeNodeId: 'm1_entry' } },
  ];

  const snapshot = (scenario: OverlayScenario, mark = false) => page.evaluate(({ scenario, mark }) => {
    const scene: any = window.__birdSquadGame.scene.getScene(scenario.sceneKey);
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    const objects = collect(scene.children.list).filter((child: any) => child.active !== false && child.visible !== false);
    const hits = objects.filter((child: any) => child.name === 'audio-toggle-control-hit' && child.input?.enabled);
    const topHit = hits.at(-1);
    if (mark) topHit?.setData('overlayMuteProbe', scenario.name);
    const focusRing = objects.find((child: any) => child.name === 'system-settings-focus-ring');
    const audioValue = objects.find((child: any) => child.name === 'system-settings-audio-value');
    const visibleBursts = objects.filter((child: any) => child.name === 'audio-toggle-wave-burst' && child.alpha > 0.01);
    return {
      muted: Boolean(window.__birdSquadAudio?.().muted),
      hitCount: hits.length,
      hitLabels: hits.map((hit: any) => hit.getData('label')),
      topFeedbackBursts: Number(topHit?.getData('feedbackBursts') ?? 0),
      marker: topHit?.getData('overlayMuteProbe') ?? null,
      visibleBursts: visibleBursts.length,
      settingsOpen: Boolean(scene.settingsOverlay?.active ?? scene.settingsOverlayOpen),
      pauseOpen: Boolean(scene.pauseOverlayOpen),
      focusIndex: focusRing?.getData('index') ?? null,
      focusLabel: focusRing?.getData('label') ?? null,
      audioValue: audioValue?.text ?? null,
    };
  }, { scenario, mark });

  for (const scenario of scenarios) {
    await page.evaluate(async ({ sceneKey, data }) => {
      const game = window.__birdSquadGame;
      const target: any = await window.__birdSquadStartScene!(sceneKey, data ?? {});
      for (const active of game.scene.getScenes(true)) {
        if (active !== target) game.scene.stop(active.sys.settings.key);
      }
    }, { sceneKey: scenario.sceneKey, data: scenario.data });
    await page.waitForFunction((sceneKey) => {
      const scene: any = window.__birdSquadGame.scene.getScene(sceneKey);
      const ready = sceneKey === 'RouteScene'
        ? scene.routeEssentialAssetsReady
        : sceneKey === 'BattleScene'
          ? scene.fxLayer?.active
          : true;
      return Boolean(scene.sys.settings.active && ready && scene.textures.exists('ui-icon-audio-toggle-wave-burst'));
    }, scenario.sceneKey);

    await page.keyboard.press(scenario.openKey);
    await page.waitForFunction(({ sceneKey, settings }) => {
      const scene: any = window.__birdSquadGame.scene.getScene(sceneKey);
      const collect = (items: any[]): any[] => items.flatMap((child: any) => [
        child,
        ...(Array.isArray(child.list) ? collect(child.list) : []),
      ]);
      const hits = collect(scene.children.list)
        .filter((child: any) => child.active !== false && child.visible !== false
          && child.name === 'audio-toggle-control-hit' && child.input?.enabled);
      const settingsOpen = Boolean(scene.settingsOverlay?.active ?? scene.settingsOverlayOpen);
      const pauseOpen = Boolean(scene.pauseOverlayOpen);
      return hits.length >= 2 && (settings ? settingsOpen : pauseOpen && !settingsOpen);
    }, { sceneKey: scenario.sceneKey, settings: scenario.settings });

    const before = await snapshot(scenario, true);
    await page.keyboard.press('m');
    const during = await snapshot(scenario);

    expect(during.muted, scenario.name).toBe(!before.muted);
    expect(during.hitCount, scenario.name).toBe(before.hitCount);
    expect(during.marker, scenario.name).toBe(scenario.name);
    expect(during.topFeedbackBursts, scenario.name).toBe(before.topFeedbackBursts + 1);
    expect(during.hitLabels, scenario.name).toEqual(Array(during.hitCount).fill(during.muted ? 'Unmute' : 'Mute'));
    expect(during.settingsOpen, scenario.name).toBe(scenario.settings);
    expect(during.pauseOpen, scenario.name).toBe(scenario.sceneKey !== 'MenuScene');
    if (scenario.settings) {
      expect(during.focusIndex, scenario.name).toBe(0);
      expect(during.focusLabel, scenario.name).toBe('Audio');
      expect(during.audioValue, scenario.name).toBe(during.muted ? 'Muted' : 'On');
    }

    await page.waitForTimeout(520);
    expect((await snapshot(scenario)).visibleBursts, scenario.name).toBe(0);
  }
});
