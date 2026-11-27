import { test, expect, type Page } from '@playwright/test';

// Phone landscape (below 1000x560) plays through the compact lens
// (src/game/compact-lens.ts): the scene camera magnifies the 1280x720 layout
// to 0.8125 CSS px per game unit and frames the current screen; rails beside
// the canvas carry vitals, Menu and the screen's commit action. These checks
// measure what a phone actually shows: hit areas and text in CSS px through
// the camera, and DOM rail controls.

const PHONE = { width: 844, height: 390 };
// Same primary set as tests/helpers/screen-surfaces.ts, read at phone scale.
const PRIMARY = new Set(['codex-card-title', 'codex-entry-title', 'codex-tab-label', 'codex-card-cost-label', 'codex-card-detail-title',
  'codex-card-detail-paragraph', 'combat-tooltip-title', 'run-flight-details-section-body', 'run-flight-details-section-title',
  'run-defeat-review-headline', 'route-collection-goal-hit-label', 'hud-value-Cohesion', 'hud-value-Scrap', 'hud-value-Deck',
  'hud-value-Supplies', 'hud-value-Waymarks', 'combat-enemy-name', 'combat-enemy-hp-value',
  'card-picker-card-name', 'card-picker-price', 'run-outcome-stat-value', 'title-leader-description-body',
  'combat-focused-card-name', 'combat-supply-feedback-name', 'route-supply-feedback-name',
  'market-service-label', 'market-service-cost-value']);

test.afterEach(async ({ page }) => { await page.goto('about:blank'); });

async function boot(page: Page, size = PHONE) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize(size);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.waitForFunction(() => (window as any).__birdSquadCompactLens?.().active === true);
  await settle(page);
  return errors;
}

/** Wait until every lens has reached its frame (reduced motion snaps). */
async function settle(page: Page) {
  await page.waitForFunction(() => {
    const lens = (window as any).__birdSquadCompactLens?.();
    return lens?.active && lens.scenes.length && lens.scenes.every((s: any) => s.settled);
  });
  await page.evaluate(() => new Promise(requestAnimationFrame));
}

/** Controls and text as a phone shows them: in view, measured through the camera. */
async function phoneInventory(page: Page, scene: string) {
  return page.evaluate(scene => {
    const s = (window as any).__birdSquadGame.scene.getScene(scene), cam = s.cameras.main, view = cam.worldView;
    const k = s.game.canvas.getBoundingClientRect().height / 720, css = cam.zoom * k;
    const walk = (list: any[], enemyId = ''): any[] => list.flatMap(o => o.visible && o.alpha !== 0
      ? [{ o, enemyId: o.getData?.('enemyId') ?? enemyId }, ...walk(o.list ?? [], o.getData?.('enemyId') ?? enemyId)] : []);
    const inView = (b: any) => b.right > view.left + 1 && b.left < view.right - 1 && b.bottom > view.top + 1 && b.top < view.bottom - 1;
    const all = walk(s.children.list);
    const controls = all.filter(({ o }) => o.input?.enabled && (o.listenerCount('pointerdown') || o.listenerCount('pointerup'))).map(({ o, enemyId }) => {
      const a = o.input.hitArea, m = o.getWorldTransformMatrix(); let b = o.getBounds();
      const radius = typeof a?.radius === 'number' ? a.radius : 0;
      if (a && (typeof a.width === 'number' || radius)) {
        const x = (a.x ?? 0) - radius - (o.displayOriginX ?? 0), y = (a.y ?? 0) - radius - (o.displayOriginY ?? 0);
        const w = radius ? 2 * radius : a.width, h = radius ? 2 * radius : a.height;
        const pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([x, y]) => m.transformPoint(x, y));
        b = { left: Math.min(...pts.map(p => p.x)), right: Math.max(...pts.map(p => p.x)), top: Math.min(...pts.map(p => p.y)), bottom: Math.max(...pts.map(p => p.y)) };
      }
      const cx = (Math.max(b.left, view.left) + Math.min(b.right, view.right)) / 2;
      const cy = (Math.max(b.top, view.top) + Math.min(b.bottom, view.bottom)) / 2;
      const pointer = { x: (cx - view.x) * cam.zoom, y: (cy - view.y) * cam.zoom, camera: cam };
      const receivers = s.input.manager.hitTest(pointer, s.input._list, cam, []);
      s.input.sortGameObjects(receivers, pointer);
      const backdrop = /scrim|blocker/.test(o.name) || (b.right - b.left >= 1200 && b.bottom - b.top >= 640);
      return { name: o.name || o.type, label: o.getData('fullLabel') ?? '', enemyId, backdrop, visible: inView(b),
        reachable: inView(b) && receivers[0] === o, width: (b.right - b.left) * css, height: (b.bottom - b.top) * css };
    }).filter(c => c.visible);
    const texts = all.filter(({ o }) => o.type === 'Text' && o.text.trim()).map(({ o }) => {
      const b = o.getBounds(), m = o.getWorldTransformMatrix();
      return { name: o.name, text: o.text.slice(0, 40), role: o.getData('textRole'), visible: inView(b),
        size: parseFloat(o.style.fontSize) * Math.hypot(m.c, m.d) * css };
    }).filter(t => t.visible);
    return { css, zoom: cam.zoom, controls, texts };
  }, scene);
}

async function railInventory(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.compact-rail button, .compact-rail span, .compact-rail strong, .compact-rail .compact-note')]
    .filter(el => el.offsetParent).map(el => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, text: el.textContent, width: r.width, height: r.height, font: parseFloat(getComputedStyle(el).fontSize),
        inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight };
    }));
}

async function checkFloors(page: Page, scene: string, context: string) {
  const { css, controls, texts } = await phoneInventory(page, scene);
  expect(css, `${context}: lens reading scale`).toBeGreaterThanOrEqual(0.8);
  const reachable = controls.filter(c => c.reachable && !c.backdrop);
  expect(reachable.length, `${context}: reachable controls in view`).toBeGreaterThan(0);
  expect(reachable.filter(c => (c.width < 44 || c.height < 44)
    && !(c.enemyId && reachable.some(a => a.enemyId === c.enemyId && a.width >= 44 && a.height >= 44))), `${context}: 44 CSS px touch floor`).toEqual([]);
  expect(texts.length, `${context}: text in view`).toBeGreaterThan(0);
  expect(texts.filter(t => t.size < 12 - 0.01), `${context}: 12 CSS px secondary text floor`).toEqual([]);
  expect(texts.filter(t => (t.role === 'primary' || (PRIMARY.has(t.name) && t.role !== 'secondary')) && t.size < 14 - 0.01),
    `${context}: 14 CSS px primary text floor`).toEqual([]);
  const rail = await railInventory(page);
  expect(rail.filter(r => !r.inside), `${context}: rails fit the screen`).toEqual([]);
  expect(rail.filter(r => r.tag === 'BUTTON' && (r.width < 44 || r.height < 44)), `${context}: rail touch floor`).toEqual([]);
  expect(rail.filter(r => r.font < 12), `${context}: rail text floor`).toEqual([]);
  await page.screenshot({ path: test.info().outputPath(`${context.replace(/\W+/g, '-')}.png`) });
}

/** Client point at the visible part of a control, as a finger would hit it. */
async function pointOf(page: Page, scene: string, sel: { name?: string; label?: string; card?: string; enemyId?: string }) {
  return page.evaluate(({ scene, sel }) => {
    const s = (window as any).__birdSquadGame.scene.getScene(scene), cam = s.cameras.main, view = cam.worldView;
    const walk = (l: any[]): any[] => l.flatMap(o => o.visible !== false && o.alpha !== 0 ? [o, ...walk(o.list ?? [])] : []);
    const o = sel.card ? s.handCardRects.get(sel.card) : walk(s.children.list).find(o => o.input?.enabled && o.name === sel.name
      && (!sel.label || String(o.getData('fullLabel') ?? '').startsWith(sel.label)) && (!sel.enemyId || o.getData('enemyId') === sel.enemyId));
    if (!o) return null;
    const b = o.getBounds();
    const l = Math.max(b.left, view.left), r = Math.min(b.right, view.right), t = Math.max(b.top, view.top), bt = Math.min(b.bottom, view.bottom);
    if (r - l < 20 || bt - t < 20) return null;
    const c = s.game.canvas.getBoundingClientRect(), k = c.width / 1280;
    return { x: c.left + ((l + r) / 2 - view.x) * cam.zoom * k, y: c.top + ((t + bt) / 2 - view.y) * cam.zoom * k };
  }, { scene, sel });
}

async function tapControl(page: Page, scene: string, sel: Parameters<typeof pointOf>[2]) {
  await settle(page);
  const point = await pointOf(page, scene, sel);
  expect(point, `${scene} ${JSON.stringify(sel)} is in view`).not.toBeNull();
  await page.touchscreen.tap(point!.x, point!.y);
}

async function tapRail(page: Page, name: string) {
  const button = page.locator(`.compact-rail button[data-name="${name}"]`);
  await expect(button).toBeEnabled();
  const box = (await button.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function openBattle(page: Page) {
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await waitForBattle(page);
}

async function waitForBattle(page: Page) {
  await page.waitForFunction(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    return w.__birdSquadGame.scene.isActive('BattleScene') && b.battleActors && b.battleHandRendererModule && b.hand?.length
      && b.handCardRects?.size === b.hand.length && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  }, undefined, { timeout: 60_000 });
  await settle(page);
}

test.describe('phone landscape', () => {
  test.use({ hasTouch: true, isMobile: false });

  test('title, route, combat, reward, pause and settings meet the phone touch and text floors at 844x390', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = await boot(page);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#portrait-gate')!).display)).toBe('none');
    await checkFloors(page, 'MenuScene', 'title');
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').setSetupOpen(true));
    await settle(page);
    await checkFloors(page, 'MenuScene', 'setup');

    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').setSetupOpen(false));
    await page.evaluate(async () => {
      const w = window as any;
      await w.__birdSquadEnsureScene('RouteScene');
      w.__birdSquadGame.scene.getScene('MenuScene').startRun();
    });
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
    await page.evaluate(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      s.events.emit('spectacle-skip-arrival');
      s.runState.districtContracts.forEach((c: any) => c.confirmed = true);
      s.renderAll();
    });
    await settle(page);
    await checkFloors(page, 'RouteScene', 'route map');
    expect(await page.locator('.compact-rail button[data-name="route-commit-hit"]').textContent()).toBe('Take route');

    await tapRail(page, 'pause-toggle-control-hit');
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('pause-actions'));
    await settle(page);
    await checkFloors(page, 'RouteScene', 'pause');
    // Commands behind the pause overlay get no rail shortcut.
    await expect(page.locator('.compact-rail button[data-name="route-commit-hit"]')).toHaveCount(0);
    await tapControl(page, 'RouteScene', { name: 'system-field-button-hit', label: 'Settings' });
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.list.some((o: any) => /system-settings-row/.test(o.name)));
    await settle(page);
    await checkFloors(page, 'RouteScene', 'settings');
    await expect(page.locator('.compact-rail button[data-name="dismiss"]')).toHaveText('Close');

    await openBattle(page);
    await checkFloors(page, 'BattleScene', 'combat hand');
    const lens = await page.evaluate(() => (window as any).__birdSquadCompactLens());
    const battle = lens.scenes.find((s: any) => s.key === 'BattleScene');
    // The hand frame keeps the enemy panels (name, Cohesion, intent) in view above the cards.
    const enemy = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const v = b.root.list.find((o: any) => o.name === 'combat-enemy-vitals').getBounds();
      return { left: v.left, top: v.top, right: v.right, bottom: v.bottom };
    });
    expect(enemy.top).toBeGreaterThanOrEqual(battle.view.top);
    expect(enemy.right).toBeLessThanOrEqual(battle.view.right);
    for (const name of ['Cohesion', 'Incoming', 'Wingbeats', 'Cover']) {
      await expect(page.locator(`.compact-rail [data-stat="${name}"] strong`)).not.toBeEmpty();
    }
    await expect(page.locator('.compact-rail button[data-name="combat-roost-hit"]')).toHaveText('Roost');

    // A selected card shows its forecast and a reachable confirm.
    const id = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return b.hand.find((c: any) => b.effectiveCost(c) <= b.energy).instanceId;
    });
    await tapControl(page, 'BattleScene', { card: id });
    await expect.poll(() => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').selectedInstanceId)).toBe(id);
    await settle(page);
    await checkFloors(page, 'BattleScene', 'combat selected');

    await page.evaluate(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      s.rewardChoices = s.createRewardChoices(); s.mode = 'cardReward'; s.renderAll();
    });
    await page.waitForFunction(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return s.battleRewardRendererModule && s.root.getByName('reward-card-take-hit');
    });
    await page.evaluate(() => (window as any).advanceTime?.(2000));
    await settle(page);
    await checkFloors(page, 'BattleScene', 'reward');
    expect(errors).toEqual([]);
  });

  for (const size of [{ width: 932, height: 430 }, { width: 740, height: 360 }]) {
    test(`title, route and combat keep the floors at ${size.width}x${size.height}`, async ({ page }) => {
      test.setTimeout(90_000);
      const errors = await boot(page, size);
      await checkFloors(page, 'MenuScene', `title ${size.width}`);
      await page.evaluate(async () => {
        const w = window as any;
        await w.__birdSquadEnsureScene('RouteScene');
        w.__birdSquadGame.scene.getScene('MenuScene').startRun();
      });
      await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene')?.routeEssentialAssetsReady);
      await page.evaluate(() => {
        const s = (window as any).__birdSquadGame.scene.getScene('RouteScene');
        s.events.emit('spectacle-skip-arrival');
        s.runState.districtContracts.forEach((c: any) => c.confirmed = true);
        s.renderAll();
      });
      await settle(page);
      await checkFloors(page, 'RouteScene', `route ${size.width}`);
      await openBattle(page);
      await checkFloors(page, 'BattleScene', `combat ${size.width}`);
      expect(errors).toEqual([]);
    });
  }

  test('a short flight is played start to finish with touch taps at 844x390', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = await boot(page);
    // Title -> setup (first flight) -> start.
    await tapControl(page, 'MenuScene', { name: 'title-run-action', label: 'Start' });
    await page.waitForTimeout(300);
    if (await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').setupOpen)) {
      await settle(page);
      await tapControl(page, 'MenuScene', { name: 'title-run-action', label: 'Start' });
    }
    await page.waitForFunction(() => {
      const w = window as any;
      return w.__birdSquadGame.scene.isActive('RouteScene') && w.__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady;
    }, undefined, { timeout: 60_000 });
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').events.emit('spectacle-skip-arrival'));
    await settle(page);
    // The entry stop is selected; the rail forwards to TAKE ROUTE.
    await tapRail(page, 'route-commit-hit');
    await waitForBattle(page);

    const played: string[] = [];
    for (let step = 0; step < 120; step++) {
      const st = await page.evaluate(() => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        const busy = b.combatAnimationPending || b.combatIntroActive || b.combatInteractionLocked?.() || b.battleRenderQueued;
        const card = b.hand.find((c: any) => c.instanceId === b.selectedInstanceId);
        return {
          mode: b.mode, busy, selected: b.selectedInstanceId, target: card && b.activeCardContract(card).target,
          playable: b.hand.filter((c: any) => b.effectiveCost(c) <= b.energy && b.activeCardContract(c).target !== 'choice'
            && !b.activeCardContract(c).effects.some((e: string) => /returnFromDiscard|discard\(/.test(e))).map((c: any) => c.instanceId),
          enemy: b.enemies.find((e: any) => e.hp > 0)?.id, roost: !!b.root.getByName('combat-roost-hit')?.input?.enabled,
        };
      });
      if (st.mode !== 'battle') break;
      if (st.busy) { await page.waitForTimeout(250); continue; }
      if (st.selected) {
        if (st.target === 'enemy') await tapControl(page, 'BattleScene', { name: 'combat-enemy-hit', enemyId: st.enemy });
        else await tapRail(page, 'combat-selection-command-frame');
        played.push(String(st.target));
        await page.waitForTimeout(400);
        continue;
      }
      if (st.playable.length) { await tapControl(page, 'BattleScene', { card: st.playable[0] }); await page.waitForTimeout(200); continue; }
      if (st.roost) { await tapRail(page, 'combat-roost-hit'); await page.waitForTimeout(800); continue; }
      await page.waitForTimeout(250);
    }
    expect(played.length).toBeGreaterThan(2);
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').mode === 'cardReward', undefined, { timeout: 30_000 });
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('reward-card-take-hit'));
    // Reward: the in-view Select, confirmed if it asks.
    for (let i = 0; i < 4 && await page.evaluate(() => (window as any).__birdSquadGame.scene.isActive('BattleScene')); i++) {
      await tapControl(page, 'BattleScene', { name: 'reward-card-take-hit' });
      await page.waitForTimeout(700);
    }
    await page.waitForFunction(() => {
      const w = window as any;
      return w.__birdSquadGame.scene.isActive('RouteScene') && w.__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady;
    }, undefined, { timeout: 60_000 });
    const after = await page.evaluate(() => JSON.parse((window as any).render_game_to_text()));
    expect(after.scene).toBe('RouteScene');
    // Back on the map: a district contract may ask first; a tap chooses it.
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').events.emit('spectacle-skip-arrival'));
    await settle(page);
    if (await pointOf(page, 'RouteScene', { name: 'district-contract-option' })) {
      await tapControl(page, 'RouteScene', { name: 'district-contract-option' });
      await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('district-contract-choice'));
    }
    // Menu -> Settings -> Close -> Resume, all by touch.
    await settle(page);
    await tapRail(page, 'pause-toggle-control-hit');
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('pause-actions'));
    await tapControl(page, 'RouteScene', { name: 'system-field-button-hit', label: 'Settings' });
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.list.some((o: any) => /system-settings-row/.test(o.name)));
    await settle(page);
    await tapRail(page, 'dismiss');
    await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').children.list.some((o: any) => /system-settings-row/.test(o.name)));
    await settle(page);
    await tapControl(page, 'RouteScene', { name: 'system-field-button-hit', label: 'Resume' });
    await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('pause-actions'));
    // A drag on empty map pans; "Whole screen" then a tap chooses where to look.
    await settle(page);
    const before = await page.evaluate(() => (window as any).__birdSquadCompactLens().scenes[0].view.left);
    await page.locator('.compact-rail button[data-lens="overview"]').tap();
    await expect.poll(() => page.evaluate(() => (window as any).__birdSquadCompactLens().zoom)).toBe(1);
    const canvas = (await page.locator('canvas').boundingBox())!;
    await page.locator('#compact-overview-catcher').tap({ position: { x: canvas.width * 0.85, y: canvas.height * 0.5 } });
    await settle(page);
    const lens = await page.evaluate(() => (window as any).__birdSquadCompactLens());
    expect(lens.zoom).toBeGreaterThan(1.4);
    expect(lens.scenes[0].view.left).toBeGreaterThan(before);
    expect(errors).toEqual([]);
  });
});

test('desktop and tablet sizes never load the compact lens', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', request => requested.push(request.url()));
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => ({
    layout: document.documentElement.dataset.layout ?? null,
    rails: document.querySelectorAll('.compact-rail').length,
    zoom: (window as any).__birdSquadGame.scene.getScene('MenuScene').cameras.main.zoom,
    canvasWidth: document.querySelector('canvas')!.getBoundingClientRect().width,
  }));
  expect(state).toMatchObject({ layout: null, rails: 0, zoom: 1 });
  // The full-width 16:9 canvas, not narrowed for rails.
  expect(state.canvasWidth).toBeCloseTo(560 * 16 / 9, 0);
  expect(requested.filter(url => /compact-lens/.test(url))).toEqual([]);
});
