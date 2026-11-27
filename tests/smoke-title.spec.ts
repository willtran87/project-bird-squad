import { test, expect } from '@playwright/test';
import { boot } from './helpers/smoke';

// Split from the former tests/smoke.spec.ts (title topics). Tests drive
// scenes through the deterministic text-state harness on window.

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

  // Phone landscape plays through the compact lens; only a window below
  // 560x320 still pauses for the minimum-size notice.
  await page.setViewportSize({ width: 540, height: 300 });
  const compactLandscape = await page.evaluate(() => ({
    gate: getComputedStyle(document.querySelector('#portrait-gate')!).display,
    game: getComputedStyle(document.querySelector('#game-container')!).display,
    running: window.__birdSquadGame.loop.running,
  }));

  await page.setViewportSize({ width: 1000, height: 560 });
  await page.waitForFunction(() => window.__birdSquadGame?.loop.running === true);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').titleBoot?.ready === true);
  await page.screenshot({ path: '.artifacts/test-results/min-supported/title-1000x560.png' });
  const tablet = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!.getBoundingClientRect();
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    // The home and setup are deliberately separate surfaces. Check their real
    // focus targets, not coordinates from the former all-in-one menu.
    const targets = ['primaryRun', 'configure', 'howToPlay', 'settings', 'codex', 'profile']
      .map(name => ({ name, rectangle: menu.menuFocusTargets.get(name) }));
    menu.setSetupOpen(true);
    targets.push(...[...menu.runModeFocusTargets.entries()].map(([name, rectangle]: any) => ({ name, rectangle })));
    targets.push(...menu.leaderPanels.map((p: any) => ({ name: p.id, rectangle: p.rect })));
    targets.push(...[140, 560].map(x => ({ name: `difficulty-${x}`, rectangle: menu.children.list.find((o: any) => o.type === 'Rectangle' && o.x === x && o.y === 476 && o.input?.enabled) })));
    const leaderBackplates = menu.children.list
      .filter((child: any) => child.name === 'title-leader-choice-backplate')
      .map((child: any) => ({
        leaderId: child.getData('leaderId'),
        unlocked: child.getData('unlocked'),
        selected: child.getData('leaderId') === menu.selectedLeaderId,
        fillAlpha: child.fillAlpha,
        strokeAlpha: child.strokeAlpha,
      }));
    const ascensionBackplate = menu.children.list.find((child: any) => child.name === 'title-ascension-backplate');
    const collectionStrip = menu.children.list.find((child: any) => child.name === 'title-collection-goal-hit');
    const collectionKicker = menu.children.list.find((child: any) => child.name === 'title-collection-goal-hit-kicker');
    const collectionLabel = menu.children.list.find((child: any) => child.name === 'title-collection-goal-hit-label');
    const logo = menu.children.list.find((child: any) => child.name === 'title-logo');
    const logoCore = logo?.list?.find((child: any) => child.name === 'title-logo-backplate');
    const collectionBounds = collectionStrip?.getBounds();
    const contains = (outer: any, inner: any) => (
      inner.left >= outer.left
      && inner.right <= outer.right
      && inner.top >= outer.top
      && inner.bottom <= outer.bottom
    );
    const scaleX = canvas.width / 1280;
    const scaleY = canvas.height / 720;
    return {
      gate: getComputedStyle(document.querySelector('#portrait-gate')!).display,
      game: getComputedStyle(document.querySelector('#game-container')!).display,
      ariaHidden: document.querySelector('#portrait-gate')?.getAttribute('aria-hidden'),
      leaderBackplates,
      ascensionBackplate: ascensionBackplate ? {
        fillAlpha: ascensionBackplate.fillAlpha,
        strokeAlpha: ascensionBackplate.strokeAlpha,
      } : null,
      collectionStrip: collectionBounds ? {
        bounds: [collectionBounds.left, collectionBounds.top, collectionBounds.right, collectionBounds.bottom],
        logoGap: collectionBounds.left - logoCore.getBounds().right,
        rightInset: 1280 - collectionBounds.right,
        contentInside: [collectionKicker, collectionLabel]
          .every((entry) => entry && contains(collectionBounds, entry.getBounds())),
        interactive: collectionStrip.input?.enabled === true,
      } : null,
      targets: targets.map((target) => {
        const rectangle = target.rectangle;
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
  expect(tablet.ascensionBackplate?.fillAlpha).toBe(1);
  expect(tablet.leaderBackplates).toHaveLength(5);
  expect(tablet.leaderBackplates.find((backplate) => backplate.selected)).toMatchObject({
    leaderId: 'fledgling',
    unlocked: true,
    fillAlpha: 0.96,
  });
  expect(tablet.leaderBackplates.filter((backplate) => backplate.unlocked && !backplate.selected))
    .toEqual([expect.objectContaining({ fillAlpha: 0.86 })]);
  expect(tablet.leaderBackplates.filter((backplate) => !backplate.unlocked))
    .toEqual(Array.from({ length: 3 }, () => expect.objectContaining({ fillAlpha: 0.68 })));
  expect(tablet.collectionStrip).toBeNull();
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
    return state.helpOpen;
  }).toBe(true);
  const readGuide = () => page.evaluate(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    const children = menu.helpOverlay?.list ?? [];
    return {
      readable: children.filter((object: any) => object.name === 'how-to-play-readable' && object.visible).length,
      actions: children.filter((object: any) => object.name === 'system-field-button-hit' && object.input?.enabled)
        .map((object: any) => object.getData('label')),
    };
  });
  await expect.poll(async () => (await readGuide()).readable).toBe(12);
  const guide = await readGuide();
  expect(guide.actions).toEqual(expect.arrayContaining(['Close', 'Practice lessons']));
  // The quiet text guide has no image controls and must not fetch unused art.
  expect((await titleBoot()).deferredHelpLoaded).toBe(0);
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

  await page.evaluate(() => window.advanceTime?.(300));
  await expect.poll(async () => (await state()).titleTransition).toEqual({
    generation: 1,
    fadeRunning: false,
    fadeComplete: true,
    fadeProgress: 1,
  });

  const initial = await state();
  expect(initial.titleFocus).toMatchObject({
    current: 'primaryRun', previous: 'A', next: 'D', confirm: 'Space', ringRendered: true,
  });
  // Daily Flight joined the title's bottom row as a focus target (engagement).
  expect(initial.titleFocus.order).toEqual([
    'primaryRun', 'configure', 'howToPlay', 'settings', 'codex', 'profile', 'daily',
  ]);

  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
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
  const afterKeyboardToggle = await state();
  expect(afterKeyboardToggle.titleFocus.current).toBe('runMode');
  expect(afterKeyboardToggle.titleFocus.label).toBe('Flight length: Quick, 3 districts, no tier unlock');
  expect(afterKeyboardToggle.runModeChoices).toEqual([
    {
      mode: 'quick',
      summary: 'Quick, 3 districts, no tier unlock',
      selected: true,
    },
    {
      mode: 'full',
      summary: 'Full, 4 districts, unlocks tiers',
      selected: false,
    },
  ]);
  expect(afterKeyboardToggle.titleBoot.generation).toBe(initial.titleBoot.generation);
  expect(afterKeyboardToggle.titleTransition).toEqual(initial.titleTransition);
  const afterToggle = await page.evaluate(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    const options = menu.children.list
      .filter((child: any) => child.name === 'title-run-mode-option')
      .map((child: any) => ({ mode: child.getData('mode'), fillColor: child.fillColor }));
    return {
      keyboardListeners: menu.input.keyboard.listenerCount('keydown'),
      gamepadListeners: menu.input.gamepad.listenerCount('down'),
      focusRings: menu.children.list.filter((child: any) => child.name === 'title-menu-focus-ring').length,
      options,
    };
  });
  expect(afterToggle).toEqual({
    keyboardListeners: 1,
    gamepadListeners: 1,
    focusRings: 1,
    options: [
      { mode: 'quick', fillColor: 0x193140 },
      { mode: 'full', fillColor: 0x0b1723 },
    ],
  });

  await page.evaluate(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    menu.children.list.find((child: any) => child.name === 'title-run-mode-option' && child.getData('mode') === 'full')?.emit('pointerdown');
  });
  expect((await state()).selectedRunMode).toBe('full');
  await page.evaluate(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    menu.children.list.find((child: any) => child.name === 'title-run-mode-option' && child.getData('mode') === 'quick')?.emit('pointerdown');
  });
  const afterPointerToggles = await state();
  expect(afterPointerToggles.selectedRunMode).toBe('quick');
  expect(afterPointerToggles.titleBoot.generation).toBe(initial.titleBoot.generation);
  expect(afterPointerToggles.titleTransition).toEqual(initial.titleTransition);

  await gamepadDown(13);
  expect((await state()).titleFocus.current).toBe('primaryRun');
  await gamepadDown(0);
  await expect.poll(async () => (await state()).scene, { timeout: 20_000 }).toBe('RouteScene');
  // RouteScene first exposes a minimal loading snapshot; its debug module adds
  // audio counters asynchronously, after the scene name has already changed.
  await expect.poll(async () => (await state()).audio?.cueRequests).toBeDefined();
  const result = await page.evaluate(() => {
    const route: any = window.__birdSquadGame.scene.getScene('RouteScene');
    const routeState = JSON.parse(window.render_game_to_text?.() ?? '{}');
    return {
      leaderId: route.runState.leaderId,
      difficulty: route.runState.difficulty,
      runMode: route.runState.runMode,
      confirmCues: (routeState.audio.cueRequests.confirm ?? 0)
        + (routeState.audio.events?.requests?.['ui.confirm'] ?? 0),
    };
  });
  expect(result).toMatchObject({ leaderId: 'spark_caller', difficulty: 1, runMode: 'quick' });
  // Activating the focused title control (Space on Flight setup, A on Start Run)
  // now plays the typed ui.confirm event instead of the soft confirm click, so
  // one cue per action is the sum of both counters.
  const initialCues = (initial.audio.cueRequests.confirm ?? 0) + (initial.audio.events?.requests?.['ui.confirm'] ?? 0);
  expect(result.confirmCues - initialCues).toBe(11);
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
  expect(await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').titleFocus.current)).toBe('howToPlay');
  await menuGamepadDown(0);
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').helpOpen)).toBe(true);
  await menuGamepadDown(1);
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}').helpOpen)).toBe(false);

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

test('title logo entrance stays inside the canvas while visible', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await boot(page);
  const entrance = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    await window.__birdSquadStartScene!('MenuScene');
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    await wait(420);
    const logo = menu.children.list.find((child: any) => child.name === 'title-logo');
    const bounds = logo?.getBounds?.();
    return {
      alpha: logo?.alpha,
      bounds: bounds ? {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
      } : undefined,
    };
  });
  await page.screenshot({ path: '.artifacts/test-results/title-logo-entrance-safe-area-1024x768.png' });
  expect(entrance.alpha).toBeGreaterThan(0.1);
  expect(entrance.alpha).toBe(1);
  expect(entrance.bounds).toBeTruthy();
  expect(entrance.bounds!.left).toBeGreaterThanOrEqual(0);
  expect(entrance.bounds!.top).toBeGreaterThanOrEqual(0);
  expect(entrance.bounds!.right).toBeLessThanOrEqual(1280);
  expect(entrance.bounds!.bottom).toBeLessThanOrEqual(720);
});

test('title screen fits landscape tablet viewport with readable uncluttered controls', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await boot(page);
  await page.waitForFunction(() => Boolean(JSON.parse(window.render_game_to_text?.() ?? '{}').titleComposition));
  const result = await page.evaluate(() => {
    const menu: any = window.__birdSquadGame.scene.getScene('MenuScene');
    const state = JSON.parse(window.render_game_to_text!());
    const canvas = document.querySelector('canvas')!.getBoundingClientRect();
    const controls = menu.children.list.filter((o: any) =>
      o.visible && ['title-utility-hit', 'title-run-action', 'title-leader-choice-backplate'].includes(o.name));
    return {
      canvas: {left:canvas.left,right:canvas.right,top:canvas.top,bottom:canvas.bottom},
      controls: controls.map((o: any) => {
        const b=o.getBounds();
        return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,height:b.height,enabled:o.input?.enabled};
      }),
      composition: state.titleComposition,
      frames: [state.titleLeaderCardFrame, state.titleStartCommandFrame, state.titleUtilityCommandFrame],
    };
  });
  expect(result.canvas.left).toBeGreaterThanOrEqual(-1);
  expect(result.canvas.right).toBeLessThanOrEqual(1025);
  expect(result.canvas.top).toBeGreaterThanOrEqual(-1);
  expect(result.canvas.bottom).toBeLessThanOrEqual(769);
  expect(result.controls).toHaveLength(6);
  for (const c of result.controls) {
    expect(c.enabled).toBe(true);
    expect(c.left).toBeGreaterThanOrEqual(0);
    expect(c.right).toBeLessThanOrEqual(1280);
    expect(c.top).toBeGreaterThanOrEqual(0);
    expect(c.bottom).toBeLessThanOrEqual(720);
    expect(c.height * 0.8).toBeGreaterThanOrEqual(44);
  }
  expect(result.composition).toMatchObject({logoWithinCanvas:true,hintWithinCanvas:true,clear:true});
  expect(result.composition.logo.top).toBeGreaterThan(67);
  expect(result.frames.every((f:any) => !f.rendered)).toBe(true);
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
    // The launch module is lazy and its flourish fades after 80 ms. Sample a
    // known animation beat instead of racing a wall-clock sleep against loading.
    menu.time.paused = true;
    menu.tweens.paused = true;
    // The leader choice was already presented; this samples the launch itself.
    menu.leaderChoicePresented = true;
    menu.startRunAnimated(false, 780, 642, 286);
    for (let i = 0; i < 40 && menu.titleRunLaunchFlourishBursts === 0; i += 1) await wait(50);
    menu.time.paused = false;
    menu.tweens.paused = false;
    window.advanceTime!(80);
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

test('title leader hover tooltip keeps its rules on a quiet surface', async ({ page }) => {
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
    menu.setSetupOpen(true);
    menu.showLeaderTooltip('fledgling', 178);
    for (let i = 0; i < 40; i += 1) {
      const state = JSON.parse(window.render_game_to_text!());
      if (menu.leaderTooltip?.active) break;
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

  expect(result.state).toMatchObject({ rendered: false, count: 0 });
  expect(result.frameObjects).toHaveLength(0);
  expect(result.hasLeaderName).toBe(true);
  expect(result.hasSignature).toBe(true);
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
    for (let i = 0; i < 80 && !menu.leaderPanels?.length; i += 1) {
      await wait(50);
      menu = g.scene.getScene('MenuScene');
    }
    menu.selectLeader('roostkeeper'); // Nests/cover archetype
    const selectedLeader = menu.selectedLeaderId;
    menu.startRun();
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 20 && route.runState?.leaderId !== 'roostkeeper'; i += 1) await wait(50);
    const deck = (route.runState?.deck ?? []).map((c: any) => c.id);
    return {
      leaderId: route.runState?.leaderId,
      selectedLeader,
      size: deck.length,
      unique: new Set(deck).size,
      nests: deck.filter((id: string) => id.startsWith('pentacles')).length,
    };
  });
  expect(r.leaderId).toBe('roostkeeper');
  expect(r.selectedLeader).toBe('roostkeeper');
  expect(r.size).toBe(10);
  expect(r.unique).toBe(10); // singleton: every card is unique (no duplicates)
  expect(r.nests).toBeGreaterThanOrEqual(4); // a Nests-biased starter
});
