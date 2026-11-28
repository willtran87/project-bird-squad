import { test, expect } from '@playwright/test';
import { boot, clickNamedGameObject } from './helpers/smoke';

// Split from the former tests/smoke.spec.ts (settings topics). Tests drive
// scenes through the deterministic text-state harness on window.

test('route ESC opens pause and abandoning still requires confirmation', async ({ page }) => {
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
    for (let i = 0; i < 80 && !route.routeEssentialAssetsReady; i += 1) await wait(50);
    route.input.keyboard.emit('keydown-ESC'); // Escape opens the safe pause menu.
    const pausedBeforeAbandon = route.pauseOverlayOpen && !route.confirmExitOpen;
    for (let i = 0; i < 80 && !route.children.list.some((o: any) => o.name === 'pause-abandon-hit'); i += 1) await wait(25);
    route.children.list.find((o: any) => o.name === 'pause-abandon-hit').emit('pointerdown');
    for (let i = 0; i < 20; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (route.confirmExitOpen && route.children.list.some((o: any) => o.name === 'route-confirm-exit-keep-hit')) break;
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
    return { afterFirst, pausedBeforeAbandon, confirmAfterSecond: route.confirmExitOpen };
  });
  expect(result.pausedBeforeAbandon).toBe(true);
  expect(result.afterFirst.confirm).toBe(true);
  expect(result.afterFirst.active).toContain('RouteScene'); // still in the run, not kicked to menu
  expect(result.afterFirst.confirmExitFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.afterFirst.frameObjects).toBe(0);
  expect(result.afterFirst.confirmExitCommandFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.afterFirst.commandFrameObjects).toBe(0);
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
    const routeResumedOnEnter = !route.pauseOverlayOpen;
    route.input.keyboard.emit('keydown-P');
    await wait(80);
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
    const battleResumedOnEnter = !battle.pauseOverlayOpen;
    battle.input.keyboard.emit('keydown-P');
    await wait(80);
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
      routeResumedOnEnter,
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
      battleResumedOnEnter,
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
  // Pause intentionally uses a quiet panel, not stacked decorative frames.
  expect(result.routeCommandFrame).toBe(0);
  expect(result.routeFieldCommandFrame).toBe(0);
  expect(result.routeFieldCommandFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.routeTitlePlaque).toBe(0);
  expect(result.routeTitlePlaqueTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.routePauseDetailFrame).toBe(0);
  expect(result.routePauseDetailTelemetry.loaded).toBe(true);
  expect(result.routePauseDetailTelemetry.count).toBe(0);
  expect(result.routeDidNotCommit).toBe(true);
  expect(result.routeResumedOnEnter).toBe(true);
  expect(result.routeClosed).toBe(false);
  expect(result.routePauseBlockedDuringCommit).toBe(true);
  expect(result.battlePaused).toBe(true);
  expect(result.battleCommandFrame).toBe(0);
  expect(result.battleFieldCommandFrame).toBe(0);
  expect(result.battleFieldCommandFrameTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.battleTitlePlaque).toBe(0);
  expect(result.battleTitlePlaqueTelemetry).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.battlePauseDetailFrame).toBe(0);
  expect(result.battlePauseDetailTelemetry.loaded).toBe(true);
  expect(result.battlePauseDetailTelemetry.count).toBe(0);
  expect(result.battlePauseDepths.root).toBeGreaterThan(result.battlePauseDepths.fx);
  expect(result.battlePauseDepths.overlay).toBeGreaterThan(result.battlePauseDepths.root);
  expect(result.battleDidNotEndTurn).toBe(true);
  expect(result.battleResumedOnEnter).toBe(true);
  expect(result.battleClosed).toBe(false);
  expect(result.battleClosedDepths.root).toBeGreaterThan(result.battleClosedDepths.fx);
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
    window.localStorage.removeItem('birdsquad.animationPace');
    window.localStorage.removeItem('birdsquad.textPace');
    const findSetting = (items: any[], name: string, section: number): any => {
      collect(items).find((child: any) => child.name === `system-settings-section-${section}-hit`)?.emit('pointerdown');
      return collect(items).find((child: any) => child.name === name && child.input?.enabled);
    };
    const findSliderHit = (items: any[], control: string) => findSetting(items, `system-settings-${control}-slider-hit`, 0);
    const findMotionHit = (items: any[]) => findSetting(items, 'system-settings-motion-switch-hit', 2);
    const findContrastHit = (items: any[]) => findSetting(items, 'system-settings-contrast-toggle-hit', 2);
    const findGraphicsQualityHit = (items: any[]) => findSetting(items, 'system-settings-graphics-quality-switch-hit', 1);
    const findCombatPaceHit = (items: any[]) => findSetting(items, 'system-settings-combat-pace-switch-hit', 1);
    const findAnimationPaceHit = (items: any[]) => findSetting(items, 'system-settings-animation-pace-toggle-hit', 1);
    const findTextPaceHit = (items: any[]) => findSetting(items, 'system-settings-row-11-hit', 1);

    let menu: any = g.scene.getScene('MenuScene');
    menu.input.keyboard.emit('keydown-S');
    for (let i = 0; i < 60; i += 1) {
      const overlayItems = menu.settingsOverlay?.list ?? [];
      const ready = !menu.load.isLoading()
        && findSliderHit(overlayItems, 'music')
        && findSliderHit(overlayItems, 'sfx')
        && findSliderHit(overlayItems, 'voices')
        && findSliderHit(overlayItems, 'ambience');
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
        'system-settings-voices-slider-hit',
        'system-settings-ambience-slider-hit',
        'system-settings-motion-switch-hit',
        'system-settings-graphics-quality-switch-hit',
        'system-settings-combat-pace-switch-hit',
        'system-settings-animation-pace-toggle-hit',
        'system-settings-row-11-hit'
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
    const menuAnimationPaceInitial = JSON.parse(window.render_game_to_text!()).animationPacing;
    const menuAnimationPaceHit = findAnimationPaceHit(menu.children.list);
    if (!menuAnimationPaceHit) throw new Error('Missing menu Animation Pace hit target');
    menuAnimationPaceHit.emit('pointerdown', { x: 804, y: 428, isDown: true });
    await wait(80);
    const menuAnimationPaceAfterFast = JSON.parse(window.render_game_to_text!()).animationPacing;
    const menuTextPaceInitial = JSON.parse(window.render_game_to_text!()).textPacing;
    const menuTextPaceHit = findTextPaceHit(menu.children.list);
    if (!menuTextPaceHit) throw new Error('Missing menu Text Pace row hit target');
    menuTextPaceHit.emit('pointerdown', { x: 804, y: 552, isDown: true });
    await wait(80);
    const menuTextPaceAfterFast = JSON.parse(window.render_game_to_text!()).textPacing;
    const menuMusicHit = findSliderHit(menu.children.list, 'music');
    if (!menuMusicHit) throw new Error('Missing menu Music slider hit target');
    menuMusicHit.emit('pointerdown', { x: menuMusicHit.x - 50, y: menuMusicHit.y, isDown: true });
    await wait(80);
    const menuAudioAfterMusic = JSON.parse(window.render_game_to_text!()).audio;
    let menuSfxHit = findSliderHit(menu.children.list, 'sfx');
    for (let i = 0; i < 30 && !menuSfxHit; i += 1) {
      await wait(50);
      menuSfxHit = findSliderHit(menu.children.list, 'sfx');
    }
    if (!menuSfxHit) throw new Error('Missing menu SFX slider hit target');
    menuSfxHit.emit('pointerdown', { x: menuSfxHit.x + 20, y: menuSfxHit.y, isDown: true });
    await wait(80);
    const menuAudioAfterSfx = JSON.parse(window.render_game_to_text!()).audio;
    let menuVoicesHit = findSliderHit(menu.children.list, 'voices');
    for (let i = 0; i < 30 && !menuVoicesHit; i += 1) {
      await wait(50);
      menuVoicesHit = findSliderHit(menu.children.list, 'voices');
    }
    if (!menuVoicesHit) throw new Error('Missing menu Card Voices slider hit target');
    menuVoicesHit.emit('pointerdown', { x: menuVoicesHit.x - 15, y: menuVoicesHit.y, isDown: true });
    await wait(80);
    const menuAudioAfterVoices = JSON.parse(window.render_game_to_text!()).audio;
    let menuAmbienceHit = findSliderHit(menu.children.list, 'ambience');
    for (let i = 0; i < 30 && !menuAmbienceHit; i += 1) {
      await wait(50);
      menuAmbienceHit = findSliderHit(menu.children.list, 'ambience');
    }
    if (!menuAmbienceHit) throw new Error('Missing menu Ambience slider hit target');
    menuAmbienceHit.emit('pointerdown', { x: menuAmbienceHit.x - 15, y: menuAmbienceHit.y, isDown: true });
    await wait(80);
    const menuAudioAfterAmbience = JSON.parse(window.render_game_to_text!()).audio;
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
    route.input.keyboard.emit('keydown', new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
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
    battle.input.keyboard.emit('keydown', new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter' }));
    await wait(60);
    const afterTurn = battle.turn;
    battle.input.keyboard.emit('keydown', new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
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
      menuAnimationPaceInitial,
      menuAnimationPaceAfterFast,
      menuTextPaceInitial,
      menuTextPaceAfterFast,
      menuAudioAfterMusic,
      menuAudioAfterSfx,
      menuAudioAfterVoices,
      menuAudioAfterAmbience,
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
      routeAnimationPacing: routeState.animationPacing,
      routeTextPacing: routeState.textPacing,
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
      battleAnimationPacing: battleState.animationPacing,
      battleTextPacing: battleState.textPacing,
      battleDidNotEndTurn: beforeTurn === afterTurn,
      battleClosed
    };
  });

  expect(result.menuOpen).toBe(true);
  expect(result.menuClosed).toBe(false);
  for (const surface of ['menu', 'route', 'battle'] as const) {
    for (const element of ['Row', 'Toggle', 'VolumeSlider', 'MotionSwitch'] as const) {
      expect(result[`${surface}Settings${element}Frame`]).toBe(0);
      expect(result[`${surface}Settings${element}Telemetry`]).toMatchObject({rendered: false, count: 0});
    }
  }
  expect(result.menuSettingsFocusRings).toBe(1);
  expect(result.menuSettingsFocus).toMatchObject({ index: 0, label: 'Audio' });
  expect(result.menuSettingsControlTargets).toHaveLength(4);
  expect(result.menuSettingsControlTargets.every((target: { width: number; height: number }) => (
    target.width >= 276 && target.height === 58
  ))).toBe(true);
  expect(result.menuMotionInitial.preference).toBe('system');
  expect(result.menuMotionAfterFull.preference).toBe('full');
  expect(result.menuMotionAfterFull.reduced).toBe(false);
  expect(result.menuMotionAfterReduced.preference).toBe('reduced');
  expect(result.menuMotionAfterReduced.reduced).toBe(true);
  expect(result.menuContrastInitial).toMatchObject({ preference: 'standard', highContrast: false, applied: true });
  expect(result.menuContrastAfter).toMatchObject({ preference: 'high', highContrast: true, applied: true });
  expect(result.menuContrastTarget).toEqual({ width: 184, height: 58 });
  expect(result.menuContrastClassApplied).toBe(true);
  expect(result.menuGraphicsInitial.preference).toBe('auto');
  expect(result.menuGraphicsAfterFull).toMatchObject({ preference: 'full', effective: 'full', lean: false });
  expect(result.menuGraphicsAfterLean).toMatchObject({ preference: 'lean', effective: 'lean', lean: true });
  expect(result.menuGraphicsRuntimeAfterFull).toEqual({ ambientParticleEmitters: 0 });
  expect(result.menuGraphicsRuntimeAfterLean).toEqual({ ambientParticleEmitters: 0 });
  expect(result.menuPaceInitial.preference).toBe('standard');
  expect(result.menuPaceAfterSnappy.preference).toBe('snappy');
  expect(result.menuAnimationPaceInitial).toMatchObject({ preference: 'standard', timeScale: 1 });
  expect(result.menuAnimationPaceAfterFast).toMatchObject({
    preference: 'fast', timeScale: 1.3, tweenTimeScale: 1.3, spriteTimeScale: 1.3,
  });
  expect(result.menuTextPaceInitial).toMatchObject({ preference: 'standard', minimumReadableMs: 600, bannerHoldMs: 520 });
  expect(result.menuTextPaceAfterFast).toMatchObject({ preference: 'fast', minimumReadableMs: 390, bannerHoldMs: 338 });
  expect(result.menuAudioAfterMusic.musicVolume).toBeCloseTo(0.25, 2);
  expect(result.menuAudioAfterMusic.ambienceVolume).toBeCloseTo(0.78, 2);
  expect(result.menuAudioAfterSfx.musicVolume).toBeCloseTo(0.25, 2);
  expect(result.menuAudioAfterSfx.sfxVolume).toBeCloseTo(0.65, 2);
  expect(result.menuAudioAfterSfx.voiceVolume).toBeCloseTo(0.88, 2);
  expect(result.menuAudioAfterSfx.ambienceVolume).toBeCloseTo(0.78, 2);
  expect(result.menuAudioAfterVoices.musicVolume).toBeCloseTo(0.25, 2);
  expect(result.menuAudioAfterVoices.sfxVolume).toBeCloseTo(0.65, 2);
  expect(result.menuAudioAfterVoices.voiceVolume).toBeCloseTo(0.45, 2);
  expect(result.menuAudioAfterVoices.ambienceVolume).toBeCloseTo(0.78, 2);
  expect(result.menuAudioAfterAmbience.musicVolume).toBeCloseTo(0.25, 2);
  expect(result.menuAudioAfterAmbience.sfxVolume).toBeCloseTo(0.65, 2);
  expect(result.menuAudioAfterAmbience.voiceVolume).toBeCloseTo(0.45, 2);
  expect(result.menuAudioAfterAmbience.ambienceVolume).toBeCloseTo(0.45, 2);
  expect(result.routeSettings).toBe(true);
  expect(result.routeSettingsFocusRings).toBe(1);
  expect(result.routeSettingsFocus).toMatchObject({ index: 0, label: 'Audio' });
  expect(result.routeMotion.preference).toBe('reduced');
  expect(result.routeMotion.reduced).toBe(true);
  expect(result.routeVisualContrast).toMatchObject({ preference: 'high', highContrast: true, applied: true });
  expect(result.routeGraphics).toMatchObject({ preference: 'lean', effective: 'lean', lean: true });
  expect(result.routeCombatPacing.preference).toBe('snappy');
  expect(result.routeAnimationPacing).toMatchObject({
    preference: 'fast', timeScale: 1.3, tweenTimeScale: 1.3, spriteTimeScale: 1.3,
  });
  expect(result.routeTextPacing.preference).toBe('fast');
  expect(result.routeClosed).toBe(false);
  expect(result.battleSettings).toBe(true);
  expect(result.battleSettingsFocusRings).toBe(1);
  expect(result.battleSettingsFocus).toMatchObject({ index: 0, label: 'Audio' });
  expect(result.battleMotion.preference).toBe('reduced');
  expect(result.battleMotion.reduced).toBe(true);
  expect(result.battleVisualContrast).toMatchObject({ preference: 'high', highContrast: true, applied: true });
  expect(result.battleGraphics).toMatchObject({ preference: 'lean', effective: 'lean', lean: true });
  expect(result.battleGraphicsRuntime).toMatchObject({ atmosphereStrips: 10, particleBurstCap: 2 });
  expect(result.battleCombatPacing.preference).toBe('snappy');
  expect(result.battleAnimationPacing).toMatchObject({
    preference: 'fast', timeScale: 1.3, tweenTimeScale: 1.3, spriteTimeScale: 1.3,
  });
  expect(result.battleTextPacing.preference).toBe('fast');
  expect(result.battleDidNotEndTurn).toBe(true);
  expect(result.battleClosed).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.graphicsQuality'))).toBe('lean');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.visualContrast'))).toBe('high');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.animationPace'))).toBe('fast');
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.textPace'))).toBe('fast');
});

test('high contrast applies before scene boot and persists across reloads', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.setItem('birdsquad.visualContrast', 'high'));
  await page.reload();
  await page.waitForFunction(() => {
    try {
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      return state.scene === 'MenuScene'
        && state.visualContrast?.preference === 'high'
        && state.visualContrast?.applied === true;
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

test('reinforced color cues persist and add suit shapes plus labels to combat decisions', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);

  await page.keyboard.press('s');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsOpen === true);
  await page.waitForFunction(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    return (menu.settingsOverlay?.list ?? []).some((child: any) => (
      child.name === 'system-settings-row-0-hit' && child.input?.enabled
    ));
  });
  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).colorCues)
    .toEqual({ preference: 'standard', reinforced: false });

  // Wrapping up from Audio now passes Rumble (row 17) before Controls and the
  // Accessibility rows, so reaching this row takes one more ArrowUp.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsFocus?.label === 'Color Cues');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.colorCues?.reinforced === true
      && localStorage.getItem('birdsquad.colorCues') === 'reinforced';
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsOpen === false);

  await boot(page);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').colorCues?.preference === 'reinforced');
  await page.evaluate(async () => window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' }));
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.scene === 'BattleScene'
      && state.mode === 'battle'
      && state.hand?.length > 0
      && state.battleHandRenderer?.ready;
  }, undefined, { timeout: 30_000 });

  const handCues = await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    return {
      hand: JSON.parse(window.render_game_to_text?.() ?? '{}').hand.length,
      cues: collect(battle.handLayer.list)
        .filter((child: any) => child.name === 'combat-color-cue-badge')
        .map((child: any) => ({ label: child.getData('label'), shape: child.getData('shape') })),
    };
  });
  expect(handCues.cues).toHaveLength(handCues.hand);
  expect(handCues.cues.every((cue: any) => cue.label && cue.shape)).toBe(true);
  await page.screenshot({ path: '.artifacts/test-results/color-cues/reinforced-hand.png' });

  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.rewardChoices = battle.createRewardChoices();
    battle.mode = 'cardReward';
    battle.battleInputActive = true;
    battle.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    if (state.mode !== 'cardReward' || !state.battleRewardRenderer?.ready) return false;
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    return collect(battle.root.list).filter((child: any) => child.name === 'reward-color-cue-badge').length
      === battle.rewardChoices.length;
  }, undefined, { timeout: 30_000 });
  const rewardCues = await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    return collect(battle.root.list)
      .filter((child: any) => child.name === 'reward-color-cue-badge')
      .map((child: any) => ({ label: child.getData('label'), shape: child.getData('shape') }));
  });
  expect(rewardCues).toHaveLength(3);
  expect(rewardCues.every((cue: any) => cue.label && cue.shape)).toBe(true);
  await page.screenshot({ path: '.artifacts/test-results/color-cues/reinforced-reward.png' });

  await page.keyboard.press('s');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsOverlayOpen === true);
  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    collect(battle.systemOverlayLayer.list).find((child: any) => child.name === 'system-settings-section-2-hit')?.emit('pointerdown');
    const hit = collect(battle.systemOverlayLayer.list)
      .find((child: any) => child.name === 'system-settings-row-13-hit' && child.input?.enabled);
    if (!hit) throw new Error('Missing Color Cues settings row');
    hit.emit('pointerdown', { x: hit.x, y: hit.y, isDown: true });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').colorCues?.preference === 'standard');
  await boot(page);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').colorCues?.preference === 'standard');
  await page.evaluate(async () => window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' }));
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    if (state.scene !== 'BattleScene' || state.mode !== 'battle' || !state.battleHandRenderer?.ready) return false;
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    return collect(battle.handLayer.list).filter((child: any) => child.name === 'combat-color-cue-badge').length === 0;
  }, undefined, { timeout: 30_000 });
  const standardCueCount = await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    return collect(battle.handLayer.list).filter((child: any) => child.name === 'combat-color-cue-badge').length;
  });
  expect(standardCueCount).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('birdsquad.colorCues'))).toBe('standard');
});

test('screen shake setting persists and Reduced Motion suppresses combat camera shake', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);

  await page.waitForFunction(() => Boolean(JSON.parse(window.render_game_to_text?.() ?? '{}').screenShake));

  expect(JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).screenShake)
    .toEqual({ preference: 'on', enabled: true, reducedByMotion: false });

  await page.keyboard.press('s');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsOpen === true);
  await page.waitForFunction(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    return (menu.settingsOverlay?.list ?? []).some((child: any) => (
      child.name === 'system-settings-row-0-hit' && child.input?.enabled
    ));
  });
  // Wrapping up from Audio now passes Rumble (row 17) before Controls and the
  // Accessibility rows, so reaching this row takes one more ArrowUp.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').settingsFocus?.label === 'Screen Shake'
  ));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.screenShake?.preference === 'off'
      && state.screenShake?.enabled === false
      && state.screenShake?.reducedByMotion === false
      && localStorage.getItem('birdsquad.screenShake') === 'off';
  });
  await page.screenshot({ path: '.artifacts/test-results/screen-shake/screen-shake-off-settings.png' });

  const combatShakeCount = async () => {
    await page.evaluate(async () => window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' }));
    await page.waitForFunction(() => {
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      return state.scene === 'BattleScene'
        && state.mode === 'battle'
        && state.battleForegroundRenderer?.ready
        && state.battleHandRenderer?.ready;
    }, undefined, { timeout: 30_000 });
    return page.evaluate(() => {
      const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
      const enemy = battle.enemies.find((candidate: any) => candidate.hp > 0);
      if (!enemy) throw new Error('Missing live enemy for screen-shake probe');
      const camera: any = battle.cameras.main;
      const originalShake = camera.shake;
      let shakes = 0;
      camera.shake = () => {
        shakes += 1;
        return camera;
      };
      try {
        battle.flock.block = 0;
        battle.damageFlock(enemy, 1, 'Shake Probe');
      } finally {
        camera.shake = originalShake;
      }
      return shakes;
    });
  };

  await boot(page);
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.screenShake?.preference === 'off' && state.screenShake?.enabled === false;
  });
  expect(await combatShakeCount()).toBe(0);

  await page.evaluate(() => {
    localStorage.setItem('birdsquad.screenShake', 'on');
    localStorage.setItem('birdsquad.motionPreference', 'reduced');
  });
  await boot(page);
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.motion?.preference === 'reduced'
      && state.screenShake?.preference === 'on'
      && state.screenShake?.enabled === false
      && state.screenShake?.reducedByMotion === true;
  });
  expect(await combatShakeCount()).toBe(0);

  await page.evaluate(() => {
    localStorage.setItem('birdsquad.motionPreference', 'full');
  });
  await boot(page);
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.motion?.preference === 'full'
      && state.screenShake?.preference === 'on'
      && state.screenShake?.enabled === true
      && state.screenShake?.reducedByMotion === false;
  });
  expect(await combatShakeCount()).toBe(1);
});

test('reduced flashes persist and remove abrupt additive hit layers without hiding impact feedback', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);

  await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').flashEffects))
    .toEqual({ preference: 'full', reduced: false, reducedByMotion: false });

  await page.keyboard.press('s');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsOpen === true);
  await page.waitForFunction(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    return (menu.settingsOverlay?.list ?? []).some((child: any) => (
      child.name === 'system-settings-row-0-hit' && child.input?.enabled
    ));
  });
  // Wrapping up from Audio now passes Rumble (row 17) before Controls and the
  // Accessibility rows, so reaching this row takes one more ArrowUp.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').settingsFocus?.label === 'Flashes'
  ));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.flashEffects?.preference === 'reduced'
      && state.flashEffects?.reduced === true
      && state.flashEffects?.reducedByMotion === false
      && localStorage.getItem('birdsquad.flashEffects') === 'reduced';
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    return state.settingsOpen === true
      && state.settingsFocus?.label === 'Flashes'
      && state.systemSettingsRowFrame?.count === 0
      && (menu.settingsOverlay?.list ?? []).some((child: any) => (
        child.name === 'system-settings-row-15-hit' && child.input?.enabled
      ));
  });
  await page.screenshot({ path: '.artifacts/test-results/reduced-flashes/reduced-flashes-settings.png' });

  const impactLayerCounts = async () => {
    await page.evaluate(async () => window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' }));
    await page.waitForFunction(() => {
      const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      return state.scene === 'BattleScene'
        && state.mode === 'battle'
        && state.battleFxPresenter?.ready
        && ['combat-impact-flash', 'combat-player-hit-confirm', 'combat-enemy-impact-contact', 'combat-cover-shatter']
          .every((key) => battle.textures.exists(key));
    }, undefined, { timeout: 30_000 });
    return page.evaluate(() => {
      const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
      const names = [
        'combat-impact-flash',
        'combat-player-hit-confirm',
        'combat-enemy-impact-contact',
        'combat-cover-shatter',
      ];
      battle.fxLayer.list
        .filter((child: any) => names.includes(child.name))
        .forEach((child: any) => child.destroy());
      battle.combatImpactFlashBursts = 0;
      battle.combatImpactFlash(860, 300, 0xff9d4d, 1, true);
      battle.combatPlayerHitConfirm(860, 300, 0xff9d4d, true);
      battle.combatEnemyImpactContact(860, 300, 1040, true);
      battle.combatCoverShatter(860, 300, 0.8);
      const count = (name: string) => battle.fxLayer.list.filter((child: any) => child.name === name).length;
      return {
        impactFlash: count('combat-impact-flash'),
        playerHitConfirm: count('combat-player-hit-confirm'),
        enemyImpactContact: count('combat-enemy-impact-contact'),
        coverShatter: count('combat-cover-shatter'),
        impactFlashBursts: battle.combatImpactFlashBursts,
      };
    });
  };

  await boot(page);
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.flashEffects?.preference === 'reduced'
      && state.flashEffects?.reduced === true
      && state.flashEffects?.reducedByMotion === false;
  });
  expect(await impactLayerCounts()).toEqual({
    impactFlash: 0,
    playerHitConfirm: 1,
    enemyImpactContact: 1,
    coverShatter: 1,
    impactFlashBursts: 0,
  });

  await page.evaluate(() => {
    localStorage.setItem('birdsquad.flashEffects', 'full');
    localStorage.setItem('birdsquad.motionPreference', 'reduced');
  });
  await boot(page);
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.motion?.preference === 'reduced'
      && state.flashEffects?.preference === 'full'
      && state.flashEffects?.reduced === true
      && state.flashEffects?.reducedByMotion === true;
  });
  expect(await impactLayerCounts()).toEqual({
    impactFlash: 0,
    playerHitConfirm: 1,
    enemyImpactContact: 1,
    coverShatter: 1,
    impactFlashBursts: 0,
  });

  await page.evaluate(() => localStorage.setItem('birdsquad.motionPreference', 'full'));
  await boot(page);
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.motion?.preference === 'full'
      && state.flashEffects?.preference === 'full'
      && state.flashEffects?.reduced === false
      && state.flashEffects?.reducedByMotion === false;
  });
  expect(await impactLayerCounts()).toEqual({
    impactFlash: 1,
    playerHitConfirm: 2,
    enemyImpactContact: 1,
    coverShatter: 2,
    impactFlashBursts: 1,
  });
});

test('opt-in screen reader announcements follow menu, route, combat, and settings focus', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  const initial = await page.evaluate(() => {
    const region = document.getElementById('game-status');
    return {
      live: region?.getAttribute('aria-live'),
      hidden: region?.getAttribute('aria-hidden'),
      text: region?.textContent,
      runtimeModuleLoaded: performance.getEntriesByType('resource')
        .some((entry) => entry.name.includes('screen-reader-runtime')),
      summaryModuleLoaded: performance.getEntriesByType('resource')
        .some((entry) => entry.name.includes('screen-reader-summary')),
      state: JSON.parse(window.render_game_to_text?.() ?? '{}').screenReader,
    };
  });
  expect(initial).toMatchObject({
    live: 'off',
    hidden: 'true',
    text: '',
    runtimeModuleLoaded: false,
    summaryModuleLoaded: false,
    state: { preference: 'off', enabled: false, regionReady: true, observerActive: false, summaryLoaded: false },
  });

  await page.keyboard.press('s');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsOpen === true);
  await page.waitForFunction(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    return (menu.settingsOverlay?.list ?? []).some((child: any) => (
      child.name === 'system-settings-row-0-hit' && child.input?.enabled
    ));
  });
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
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
  expect(await page.evaluate(() => performance.getEntriesByType('resource')
    .some((entry) => entry.name.includes('screen-reader-summary')))).toBe(true);
  expect(await page.evaluate(() => performance.getEntriesByType('resource')
    .some((entry) => entry.name.includes('screen-reader-runtime')))).toBe(true);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window.__birdSquadGame.scene.getScene('MenuScene') as any).setupOpen);
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

  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.statOverextensions = 1;
    battle.flock.hp = 1;
    battle.flock.block = 0;
    battle.resolveEnemyEffect(battle.enemies[0], 'damage(flock, 20)', 'Review Strike');
    battle.checkOutcome();
    battle.renderAll();
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const spoken = document.getElementById('game-status')?.textContent ?? '';
    return state.mode === 'defeat'
      && state.defeatReview?.fatalMove === 'Review Strike'
      && spoken.includes('Flock scattered')
      && spoken.includes('Last hit Review Strike')
      && spoken.includes(state.defeatReview.tip)
      && spoken.includes('Focused Replay Flight');
  });
  const defeatAnnouncement = await page.evaluate(() => document.getElementById('game-status')?.textContent ?? '');
  expect(defeatAnnouncement).toContain('Pressure');
  expect(defeatAnnouncement).toContain('Press Confirm to select');

  await page.evaluate(async () => window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' }));
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return state.scene === 'BattleScene' && state.mode === 'battle' && state.hand?.length > 0;
  });
  await page.keyboard.press('s');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').settingsOverlayOpen === true);
  await page.waitForFunction(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const visit = (items: any[]): boolean => items.some((child: any) => (
      (child.name === 'system-settings-row-0-hit' && child.input?.enabled)
      || (Array.isArray(child.list) && visit(child.list))
    ));
    return visit(battle.systemOverlayLayer?.list ?? []);
  });
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
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
      collect(menu.children.list).find((child: any) => child.name === 'system-settings-section-2-hit')?.emit('pointerdown');
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
      collect(menu.children.list).find((child: any) => child.name === 'system-settings-section-1-hit')?.emit('pointerdown');
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
      collect(menu.children.list).find((child: any) => child.name === 'system-settings-section-3-hit')?.emit('pointerdown');
      const controlsHit = collect(menu.children.list)
        .find((child: any) => child.name === 'system-settings-row-5-hit' && child.input?.enabled);
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
      menu.input.keyboard.emit('keydown', {
        code: 'Escape',
        key: 'Escape',
        shiftKey: false,
        preventDefault: () => {},
        stopPropagation: () => {},
      });
      await wait(80);
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
  for (let i = 0; i < 8; i++) {
    if (await page.evaluate(() => JSON.parse(window.render_game_to_text!()).titleFocus.current === 'primaryRun')) break;
    await page.keyboard.press('ArrowDown');
  }
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').titleFocus.current
  ))).toBe('primaryRun');
  await page.keyboard.press('c'); // Start Run opens the leader choice
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').setupOpen
  ))).toBe(true);
  await page.keyboard.press('c'); // fly with the selected Leader
  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() ?? '{}').scene
  )), { timeout: 20_000 }).toBe('RouteScene');
});

test('grouped Settings isolate hidden controls and preserve focus and values across surfaces', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await boot(page);
  const sections = [
    { label: 'Audio', rows: [0, 1, 2, 3, 4] },
    { label: 'Presentation', rows: [8, 9, 10, 11, 16] },
    { label: 'Accessibility', rows: [6, 7, 12, 13, 14, 15] },
    { label: 'Controls', rows: [5, 17] },
  ];
  const snapshot = () => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text!());
    const scene = window.__birdSquadGame.scene.getScene(state.scene);
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [child, ...(Array.isArray(child.list) ? collect(child.list) : [])]);
    const rows = [...new Set(collect(scene.children.list))].filter((child: any) => /^system-settings-row-\d+-hit$/.test(child.name ?? ''));
    return {
      focus: state.settingsFocus,
      keyboardListeners: scene.input.keyboard.listenerCount('keydown'),
      gamepadListeners: scene.input.gamepad.listenerCount('down'),
      visible: rows.filter((row: any) => row.visible).map((row: any) => Number(row.name.split('-')[3])),
      enabled: rows.filter((row: any) => row.input?.enabled).map((row: any) => Number(row.name.split('-')[3])),
      bounds: rows.filter((row: any) => row.visible).map((row: any) => ({ top: row.getBounds().top, bottom: row.getBounds().bottom, left: row.getBounds().left, right: row.getBounds().right })),
    };
  });
  for (const sceneKey of ['MenuScene', 'RouteScene', 'BattleScene']) {
    if (sceneKey !== 'MenuScene') await page.evaluate(async (key) => window.__birdSquadStartScene!(key, key === 'BattleScene' ? { routeNodeId: 'm1_entry' } : {}), sceneKey);
    await page.keyboard.press('s', { delay: 50 });
    await expect.poll(async () => (await snapshot()).focus?.section).toBe('Audio');
    await page.waitForFunction((key) => {
      const scene = window.__birdSquadGame.scene.getScene(key);
      const collect = (items: any[]): any[] => items.flatMap((child: any) => [child, ...(Array.isArray(child.list) ? collect(child.list) : [])]);
      return !scene.load.isLoading() && collect(scene.children.list).some((child: any) => child.name === 'system-settings-row-0-hit');
    }, sceneKey);
    const beforeInput = await snapshot();
    const beforeAudio = await page.evaluate(() => JSON.parse(window.render_game_to_text!()).audio);
    for (const [index, section] of sections.entries()) {
      await clickNamedGameObject(page, sceneKey, `system-settings-section-${index}-hit`);
      await expect.poll(async () => (await snapshot()).focus?.section).toBe(section.label);
      const current = await snapshot();
      expect(current.visible.sort((a, b) => a - b)).toEqual([...section.rows].sort((a, b) => a - b));
      expect(current.enabled.sort((a, b) => a - b)).toEqual(current.visible);
      expect(current.bounds.every((box) => box.left >= 640 && box.right <= 1180 && box.top >= 190 && box.bottom <= 590)).toBe(true);
      current.bounds.forEach((box, index) => {
        expect(box.bottom - box.top).toBe(58);
        if (index) expect(box.top - current.bounds[index - 1].bottom).toBeGreaterThanOrEqual(8);
      });
      await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? '')).toContain(`Settings. ${section.label}.`);
      await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? '')).toContain(`${current.focus.label}: ${current.focus.value}`);
      await page.screenshot({ path: `.artifacts/test-results/grouped-settings/${sceneKey}-${index}-2560x1600.png` });
    }
    const afterAudio = await page.evaluate(() => JSON.parse(window.render_game_to_text!()).audio);
    for (const preference of ['muted', 'musicVolume', 'sfxVolume', 'voiceVolume', 'ambienceVolume']) expect(afterAudio[preference]).toBe(beforeAudio[preference]);
    await page.keyboard.press('PageDown', { delay: 50 });
    await expect.poll(async () => (await snapshot()).focus.section).toBe('Audio');
    await page.keyboard.press('ArrowDown', { delay: 50 });
    await page.keyboard.press('ArrowLeft', { delay: 50 });
    await expect.poll(async () => (await snapshot()).focus).toMatchObject({ section: 'Audio', index: 1, label: 'Music', position: 2, count: 5 });
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.evaluate((key) => window.__birdSquadGame.scene.getScene(key).input.gamepad.emit('down', {}, { index: 5 }), sceneKey);
    await expect.poll(async () => (await snapshot()).focus.section).toBe('Presentation');
    expect((await snapshot()).keyboardListeners).toBe(beforeInput.keyboardListeners);
    expect((await snapshot()).gamepadListeners).toBe(beforeInput.gamepadListeners);
    const mutedBefore = await page.evaluate(() => JSON.parse(window.render_game_to_text!()).audio.muted);
    await page.keyboard.press('m', { delay: 50 });
    await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).audio.muted)).toBe(!mutedBefore);
    expect((await snapshot()).focus.section).toBe('Presentation');
    await page.keyboard.press('Escape', { delay: 50 });
  }
  await page.evaluate(async () => window.__birdSquadStartScene!('MenuScene'));
  await page.keyboard.press('s', { delay: 50 });
  for (const size of [{ width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size);
    for (let section = 0; section < sections.length; section++) {
      await clickNamedGameObject(page, 'MenuScene', `system-settings-section-${section}-hit`);
      await page.screenshot({ path: `.artifacts/test-results/grouped-settings/Menu-${section}-${size.width}x${size.height}.png` });
    }
  }
  await page.keyboard.press('Escape', { delay: 50 });
  expect(errors).toEqual([]);
});

test('settings are fully navigable by keyboard and standard gamepad controls', async ({ page }) => {
  await boot(page);
  const snapshot = () => page.evaluate(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    const objects = menu.settingsOverlay?.list ?? [];
    const ring = objects.find((child: any) => child.name === 'system-settings-focus-ring');
    return {
      state: JSON.parse(window.render_game_to_text?.() ?? '{}'),
      listenerCount: menu.input.keyboard.listenerCount('keydown'),
      focusRings: objects.filter((child: any) => child.name === 'system-settings-focus-ring').length,
      rowTargets: objects.filter((child: any) => /^system-settings-row-\d+-hit$/.test(child.name ?? '')).length,
      hasScreenShakeTarget: objects.some((child: any) => child.name === 'system-settings-row-14-hit'),
      hasFlashesTarget: objects.some((child: any) => child.name === 'system-settings-row-15-hit'),
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
    localStorage.removeItem('birdsquad.animationPace');
    localStorage.removeItem('birdsquad.textPace');
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    menu.input.keyboard.emit('keydown-S');
  });
  await expect.poll(async () => {
    const current = await snapshot();
    return current.listenerCount === beforeOpenListeners + 1
      && current.focusRings === 1
      && current.hasScreenShakeTarget
      && current.hasFlashesTarget;
  }).toBe(true);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 0, label: 'Audio' });
  const opened = await snapshot();
  expect(beforeOpenListeners).toBe(1);
  expect(opened.listenerCount).toBe(2);
  expect(opened.focusRings).toBe(1);
  expect(opened.rowTargets).toBe(18);
  expect(opened.ring).toMatchObject({ index: 0, label: 'Audio' });

  const initialMusic = opened.state.audio.musicVolume;
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 1, label: 'Music' });
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await snapshot()).state.audio.musicVolume).toBeLessThan(initialMusic);
  const musicAdjusted = await snapshot();
  expect(musicAdjusted.state.settingsFocus).toMatchObject({ index: 1, label: 'Music' });
  expect(musicAdjusted.listenerCount).toBe(2);
  expect(musicAdjusted.focusRings).toBe(1);

  const initialSfx = musicAdjusted.state.audio.sfxVolume;
  await gamepadDown(13);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 2, label: 'SFX' });
  await gamepadDown(14);
  await expect.poll(async () => (await snapshot()).state.audio.sfxVolume).toBeLessThan(initialSfx);
  const sfxAdjusted = await snapshot();
  expect(sfxAdjusted.listenerCount).toBe(2);
  expect(sfxAdjusted.focusRings).toBe(1);

  const initialVoices = sfxAdjusted.state.audio.voiceVolume;
  const musicBeforeVoices = sfxAdjusted.state.audio.musicVolume;
  const sfxBeforeVoices = sfxAdjusted.state.audio.sfxVolume;
  await gamepadDown(13);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 3, label: 'Card Voices' });
  await gamepadDown(14);
  await expect.poll(async () => (await snapshot()).state.audio.voiceVolume).toBeLessThan(initialVoices);
  const voicesAdjusted = await snapshot();
  expect(voicesAdjusted.state.audio.musicVolume).toBeCloseTo(musicBeforeVoices, 4);
  expect(voicesAdjusted.state.audio.sfxVolume).toBeCloseTo(sfxBeforeVoices, 4);
  expect(voicesAdjusted.listenerCount).toBe(2);
  expect(voicesAdjusted.focusRings).toBe(1);

  const initialAmbience = voicesAdjusted.state.audio.ambienceVolume;
  const musicBeforeAmbience = voicesAdjusted.state.audio.musicVolume;
  const sfxBeforeAmbience = voicesAdjusted.state.audio.sfxVolume;
  const voicesBeforeAmbience = voicesAdjusted.state.audio.voiceVolume;
  await gamepadDown(13);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 4, label: 'Ambience' });
  await gamepadDown(14);
  await expect.poll(async () => (await snapshot()).state.audio.ambienceVolume).toBeLessThan(initialAmbience);
  const ambienceAdjusted = await snapshot();
  expect(ambienceAdjusted.state.audio.musicVolume).toBeCloseTo(musicBeforeAmbience, 4);
  expect(ambienceAdjusted.state.audio.sfxVolume).toBeCloseTo(sfxBeforeAmbience, 4);
  expect(ambienceAdjusted.state.audio.voiceVolume).toBeCloseTo(voicesBeforeAmbience, 4);
  expect(ambienceAdjusted.listenerCount).toBe(2);
  expect(ambienceAdjusted.focusRings).toBe(1);

  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 6, label: 'Motion' });
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await snapshot()).state.motion.preference).toBe('reduced');
  expect((await snapshot()).state.settingsFocus).toMatchObject({ index: 6, label: 'Motion' });

  await gamepadDown(13);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 7, label: 'Contrast' });
  await gamepadDown(15);
  await expect.poll(async () => (await snapshot()).state.visualContrast).toMatchObject({ preference: 'high', highContrast: true, applied: true });
  expect((await snapshot()).state.settingsFocus).toMatchObject({ index: 7, label: 'Contrast' });

  await gamepadDown(4);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 8, label: 'Effects' });
  await gamepadDown(15);
  await expect.poll(async () => (await snapshot()).state.graphics.preference).toBe('lean');
  expect((await snapshot()).state.settingsFocus).toMatchObject({ index: 8, label: 'Effects' });

  await gamepadDown(13);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 9, label: 'Combat Pace' });
  await gamepadDown(15);
  await expect.poll(async () => (await snapshot()).state.combatPacing.preference).toBe('snappy');
  expect((await snapshot()).state.settingsFocus).toMatchObject({ index: 9, label: 'Combat Pace' });

  await gamepadDown(13);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 10, label: 'Animation Pace' });
  await gamepadDown(15);
  await expect.poll(async () => (await snapshot()).state.animationPacing.preference).toBe('fast');
  expect((await snapshot()).state.settingsFocus).toMatchObject({ index: 10, label: 'Animation Pace' });

  await gamepadDown(13);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 11, label: 'Text Pace' });
  await gamepadDown(15);
  await expect.poll(async () => (await snapshot()).state.textPacing.preference).toBe('fast');
  expect((await snapshot()).state.settingsFocus).toMatchObject({ index: 11, label: 'Text Pace' });

  await gamepadDown(12);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 10, label: 'Animation Pace' });
  await gamepadDown(12);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 9, label: 'Combat Pace' });
  await gamepadDown(12);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 8, label: 'Effects' });
  await gamepadDown(0);
  await expect.poll(async () => (await snapshot()).state.graphics.preference).toBe('auto');
  expect((await snapshot()).state.settingsFocus).toMatchObject({ index: 8, label: 'Effects' });

  await gamepadDown(5);
  await gamepadDown(13);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 7, label: 'Contrast' });
  await gamepadDown(0);
  await expect.poll(async () => (await snapshot()).state.visualContrast).toMatchObject({ preference: 'standard', highContrast: false, applied: true });

  await gamepadDown(12);
  await expect.poll(async () => (await snapshot()).state.settingsFocus).toMatchObject({ index: 6, label: 'Motion' });
  await gamepadDown(0);
  await expect.poll(async () => (await snapshot()).state.motion.preference).toBe('system');
  expect((await snapshot()).state.settingsFocus).toMatchObject({ index: 6, label: 'Motion' });

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
      settingsRows: (scene.settingsOverlay?.list ?? objects)
        .filter((child: any) => /^system-settings-row-\d+-hit$/.test(child.name ?? '')).length,
    };
  });

  await page.keyboard.press('s');
  await expect.poll(async () => (await controlsSnapshot()).state.settingsOpen).toBe(true);
  // 18 rows since Fast Mode (Presentation) and Rumble (Controls) joined Settings.
  await expect.poll(async () => {
    const snapshot = await controlsSnapshot();
    return snapshot.settingsFocusRings === 1 && snapshot.settingsRows === 18;
  }).toBe(true);
  await page.keyboard.press('PageUp');
  await expect.poll(async () => (await controlsSnapshot()).state.settingsFocus).toMatchObject({ index: 5, label: 'Controls' });
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await controlsSnapshot()).state.controls.panelOpen).toBe(true);
  await expect.poll(async () => {
    const current = await controlsSnapshot();
    return current.panels === 1
      && current.focusRings === 1
      && current.bindingRows === 6
      && current.closeFrames === 0
      && current.closeMedallions === 0;
  }, { timeout: 20_000 }).toBe(true);
  const opened = await controlsSnapshot();
  expect(opened.panels).toBe(1);
  expect(opened.focusRings).toBe(1);
  expect(opened.bindingRows).toBe(6);
  expect(opened.closeFrames).toBe(0);
  expect(opened.closeMedallions).toBe(0);
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
  // The first text snapshot after boot is a placeholder until the lazy menu debug module installs.
  await expect.poll(async () => Boolean((await controlsSnapshot()).state.controls)).toBe(true);
  const persisted = await controlsSnapshot();
  expect(persisted.state.controls.customized).toBe(true);
  expect(persisted.state.controls.bindings.confirm.key).toBe('P');
  expect(persisted.state.controls.bindings.pause.key).toBe('C');
  expect(persisted.state.controls.bindings.roost.key).toBe('T');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  expect((await controlsSnapshot()).state.scene).toBe('MenuScene');
  for (let i = 0; i < 8; i++) {
    if ((await controlsSnapshot()).state.titleFocus.current === 'primaryRun') break;
    await page.keyboard.press('ArrowDown');
  }
  await expect.poll(async () => (await controlsSnapshot()).state.titleFocus.current).toBe('primaryRun');
  await page.keyboard.press('p'); // Start Run opens the leader choice
  await expect.poll(async () => (await controlsSnapshot()).state.setupOpen).toBe(true);
  await page.keyboard.press('p'); // fly with the selected Leader
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
    return snapshot.settingsFocusRings === 1 && snapshot.settingsRows === 18;
  }).toBe(true);
  await page.keyboard.press('PageUp');
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
  await page.evaluate(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    menu.input.gamepad.emit('down', menu.input.gamepad.pad1, { index: 15 }, 1);
  });
  await expect.poll(async () => (await controlsSnapshot()).state.controls.focusIndex).toBe(6);
  await page.evaluate(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    menu.input.gamepad.emit('down', menu.input.gamepad.pad1, { index: 1 }, 1);
  });
  await expect.poll(async () => (await controlsSnapshot()).state.controls.panelOpen).toBe(false);
  await expect.poll(async () => (await controlsSnapshot()).state.settingsOpen).toBe(true);
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
      inputHintTexts: objects.filter((child: any) => child.name === 'combat-input-hint' && child.type === 'Text').map((child: any) => child.text),
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
  expect(selected.inputHints).toBe(0);
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
  expect(reward.inputHints).toBe(1);
  expect(reward.inputHintTexts[0]).toContain('A/D: choose');
  expect(reward.inputHintTexts[0]).toContain('Space: confirm');
  await expect.poll(async () => (await snapshot()).liveText).toContain(`Focused ${reward.state.combatInputFocus.label}`);
  expect((await snapshot()).liveText).toContain('choice 2 of 3');
});

test('run outcomes expose equivalent keyboard and gamepad command focus', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);

  const openOutcome = () => page.evaluate(async () => {
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    scene.mode = 'defeat';
    scene.emitRunSummary('loss');
    scene.battleInputActive = false;
    scene.controllerChoiceIndex = 0;
    scene.renderAll();
  });
  const snapshot = () => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    const objects = collect(scene.children.list);
    return {
      state,
      commands: objects
        .filter((child: any) => child.name === 'run-outcome-command-hit' && child.input?.enabled)
        .map((child: any) => child.getData?.('label')),
      focusRings: objects.filter((child: any) => child.name === 'run-outcome-input-focus-ring').length,
    };
  });

  await openOutcome();
  await expect.poll(async () => (await snapshot()).commands).toEqual(['Replay Flight', 'Flight Details', 'Practice This Fight', 'Main Menu']);
  expect((await snapshot()).state.combatInputFocus).toMatchObject({
    active: false,
    kind: 'outcome',
    index: 0,
    count: 5,
    label: 'Replay Flight',
    visibleFocus: false,
  });
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await snapshot()).state.combatInputFocus).toMatchObject({
    active: true,
    kind: 'outcome',
    index: 1,
    count: 5,
    label: 'Flight Details',
    visibleFocus: true,
  });
  expect((await snapshot()).focusRings).toBe(1);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot()).state).toMatchObject({
    outcomeFlightDetails: { open: true },
    combatInputFocus: {
      active: true,
      kind: 'outcome',
      index: 0,
      count: 1,
      label: 'Close Flight Details',
      visibleFocus: true,
    },
  });
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot()).state.outcomeFlightDetails).toMatchObject({ open: false });
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await snapshot()).state.combatInputFocus).toMatchObject({
    index: 2,
    count: 5,
    label: 'Practice This Fight',
  });
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await snapshot()).state.combatInputFocus).toMatchObject({
    index: 3,
    count: 5,
    label: 'Main Menu',
  });
  await page.keyboard.press('Enter');
  await expect.poll(async () => JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).scene).toBe('MenuScene');

  await openOutcome();
  await expect.poll(async () => (await snapshot()).commands).toHaveLength(4);
  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.input.gamepad.emit('down', battle.input.gamepad.pad1, { index: 15 }, 1);
  });
  await expect.poll(async () => (await snapshot()).state.combatInputFocus).toMatchObject({
    active: true,
    kind: 'outcome',
    index: 1,
    label: 'Flight Details',
    visibleFocus: true,
  });
  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.input.gamepad.emit('down', battle.input.gamepad.pad1, { index: 0 }, 1);
  });
  await expect.poll(async () => (await snapshot()).state.outcomeFlightDetails).toMatchObject({ open: true });
  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.input.gamepad.emit('down', battle.input.gamepad.pad1, { index: 1 }, 1);
  });
  await expect.poll(async () => (await snapshot()).state.outcomeFlightDetails).toMatchObject({ open: false });
  await page.evaluate(() => {
    const battle: any = window.__birdSquadGame.scene.getScene('BattleScene');
    battle.input.gamepad.emit('down', battle.input.gamepad.pad1, { index: 15 }, 1);
    battle.input.gamepad.emit('down', battle.input.gamepad.pad1, { index: 15 }, 1);
    battle.input.gamepad.emit('down', battle.input.gamepad.pad1, { index: 0 }, 1);
  });
  await expect.poll(async () => JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')).scene).toBe('MenuScene');
});
