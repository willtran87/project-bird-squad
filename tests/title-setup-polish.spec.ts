import { test, expect, type Page } from '@playwright/test';
import { flockLeaders } from '../src/game/leaders';
import { leaderUnlockHints } from '../src/game/meta';
import { screenReaderSummary } from '../src/game/screen-reader-summary';
import { settleCanvas } from './helpers/settled-canvas';
import { installVirtualController, pressController } from './helpers/virtual-controller';

test.use({ hasTouch: true });
const state = (page: Page) => page.evaluate(() => JSON.parse((window as any).render_game_to_text()));
async function boot(page: Page) {
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await settleCanvas(page);
}
async function click(page: Page, id: string, touch = false) {
  const p = await page.evaluate(id => {
    const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
    const o = m.children.list.find((o: any) => o.input?.enabled && o.visible
      && (o.getData('focus') === id || o.getData('leaderId') === id || o.getData('mode') === id));
    if (!o) throw new Error(`Missing active title control ${id}`);
    const b = o.getBounds(), c = m.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, id);
  if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
  await settleCanvas(page);
}

test('title and setup share readable controls, intact portraits and accurate launch context', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page);
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size); await settleCanvas(page);
    const controls = await page.evaluate(() => {
      const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
      const scale = m.game.canvas.getBoundingClientRect().width / 1280;
      return m.children.list.filter((o: any) => o.visible && ['title-run-action', 'title-utility-hit'].includes(o.name)).map((o: any) => {
        const label = o.getData('labelObject'), b = o.getBounds(), l = label.getBounds();
        return { font: parseFloat(label.style.fontSize) * scale, target: b.height * scale,
          full: !label.getData('truncated'), kind: o.getData('controlKind'),
          fits: l.left >= b.left + 8 && l.right <= b.right - 8 && l.top >= b.top + 8 && l.bottom <= b.bottom - 8 };
      });
    });
    expect(controls).toHaveLength(6);
    for (const control of controls) {
      expect(control.font).toBeGreaterThanOrEqual(16); expect(control.target).toBeGreaterThanOrEqual(44);
      expect(control.full && control.fits).toBe(true); expect(control.kind).toBeTruthy();
    }
    await page.screenshot({ path: info.outputPath(`home-${size.width}.png`) });
    await click(page, 'configure');
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').children.list
      .filter((o: any) => o.name.startsWith('title-leader-portrait-')).length === 5);
    for (const leader of flockLeaders) {
      await click(page, leader.id, size.width === 1000);
      await expect.poll(async () => (await state(page)).inspectedLeader).toBe(leader.id);
      await expect.poll(async () => (await state(page)).leaderExplanation).toBe(leaderUnlockHints[leader.id]
        ?? `${leader.blurb} Signature: ${leader.signatureName} - ${leader.signatureText}`);
      const current = await state(page);
      expect(current.selectedLeader).toBe(leaderUnlockHints[leader.id] ? 'spark_caller' : leader.id);
      if (leaderUnlockHints[leader.id]) expect(screenReaderSummary(current)).toContain(leaderUnlockHints[leader.id]);
    }
    const geometry = await page.evaluate(() => {
      const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
      const portraits = m.leaderPanels.map((p: any) => {
        const art = m.children.getByName(`title-leader-portrait-${p.id}`), b = art.getBounds(), panel = p.rect.getBounds();
        const detail = m.children.list.find((o: any) => o.name === 'title-leader-detail' && o.getData('leaderId') === p.id).getBounds();
        return { exists: m.textures.exists(art.texture.key), visible: art.visible,
          uniform: Math.abs(art.scaleX - art.scaleY) < 0.001,
          fits: b.left >= panel.left && b.right < detail.left && b.bottom <= panel.bottom && b.top >= 236 };
      });
      const summary = m.children.getByName('title-launch-summary'), b = summary.getBounds();
      return { portraits, summary: summary.text, summaryFits: b.left >= 80 && b.right <= 1200 && b.top >= 562 && b.bottom < 600,
        focusX: m.menuFocusRing.x, inspectedX: m.leaderPanels.find((p: any) => p.id === m.inspectedLeaderId).rect.x };
    });
    for (const portrait of geometry.portraits) expect(portrait).toEqual({ exists: true, visible: true, uniform: true, fits: true });
    expect(geometry.summaryFits).toBe(true); expect(geometry.focusX).toBe(geometry.inspectedX);
    expect(geometry.summary).toContain('The Spark-Caller');
    await page.screenshot({ path: info.outputPath(`setup-locked-${size.width}.png`) });
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').setupObjects
      .every((o: any) => !o.visible && !o.input?.enabled))).toBe(true);
  }
  await click(page, 'configure'); await click(page, 'quick', true);
  expect((await state(page)).launchSummary).toContain('Quick / 3 districts');
  await click(page, 'primaryRun', true);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
  expect(await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene').runState;
    return { leader: r.leaderId, difficulty: r.difficulty, mode: r.runMode };
  })).toMatchObject({ leader: 'spark_caller', mode: 'quick' });
  expect(errors).toEqual([]);
});

test('locked requirements are reachable by remapped keys and real controller polling without selecting locked leaders', async ({ page }, info) => {
  test.setTimeout(90000);
  await installVirtualController(page);
  await page.addInitScript(() => {
    localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ next: 'KeyD', previous: 'KeyA', confirm: 'KeyQ' }));
    localStorage.setItem('birdsquad.motionPreference', 'reduced');
  });
  await page.setViewportSize({ width: 1000, height: 560 }); await boot(page);
  await page.keyboard.press('Tab'); await page.keyboard.press('q');
  for (const leader of flockLeaders.slice(1)) {
    await page.keyboard.press('d');
    await expect.poll(async () => (await state(page)).inspectedLeader).toBe(leader.id);
    if (leaderUnlockHints[leader.id]) {
      await expect.poll(async () => (await state(page)).leaderExplanation).toBe(leaderUnlockHints[leader.id]);
      await page.keyboard.press('q');
      expect((await state(page)).selectedLeader).toBe('spark_caller');
    }
  }
  // D-pad wraps through every card, including locked requirements, and A only inspects.
  for (const leader of flockLeaders) {
    await pressController(page, 15);
    await expect.poll(async () => (await state(page)).inspectedLeader).toBe(leader.id);
    await pressController(page, 0);
    if (leaderUnlockHints[leader.id]) {
      await expect.poll(async () => (await state(page)).leaderExplanation).toBe(leaderUnlockHints[leader.id]);
      expect((await state(page)).selectedLeader).toBe('spark_caller');
    }
  }
  await page.screenshot({ path: info.outputPath('controller-locked-1000.png') });
  await page.keyboard.press('s');
  await expect.poll(async () => (await state(page)).settingsOpen).toBe(true);
  const before = (await state(page)).selectedLeader;
  // Even a stale pointer callback cannot activate the obscured title controls.
  await page.evaluate(() => {
    const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
    m.menuFocusTargets.get('primaryRun').emit('pointerdown');
    m.leaderPanels[0].rect.emit('pointerdown');
    m.runModeViews.get('quick').hit.emit('pointerdown');
    localStorage.setItem('birdsquad.maxTier', '6'); m.stepDifficulty(1);
  });
  expect((await state(page)).selectedLeader).toBe(before);
  expect((await state(page)).settingsOpen).toBe(true);
  expect((await state(page)).selectedDifficulty).toBe(0);
  expect((await state(page)).selectedRunMode).toBe('full');
  expect((await state(page)).motion.reduced).toBe(true);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').titleRunLaunchPending)).toBe(false);
  await page.keyboard.press('Escape'); await pressController(page, 1);
  expect((await state(page)).setupOpen).toBe(false);
});

test('late setup portraits reserve their space and cannot reappear over home', async ({ page }, info) => {
  test.setTimeout(60000);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route(/combat-front-3q[^/]*\.webp/, async route => {
    requests++; await held; await route.continue();
  });
  try {
    await page.setViewportSize({ width: 1000, height: 560 }); await boot(page);
    await click(page, 'configure');
    await expect.poll(() => requests).toBe(5);
    const bounds = () => page.evaluate(() => {
      const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
      return m.children.list.filter((o: any) => ['title-leader-name', 'title-leader-detail', 'title-launch-summary'].includes(o.name))
        .map((o: any) => { const b = o.getBounds(); return [o.name, b.x, b.y, b.width, b.height]; });
    });
    const before = await bounds();
    await page.screenshot({ path: info.outputPath('portraits-pending-1000.png') });
    await page.keyboard.press('Escape'); release();
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').children.list
      .filter((o: any) => o.name.startsWith('title-leader-portrait-')).length === 5);
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').children.list
      .filter((o: any) => o.name.startsWith('title-leader-portrait-')).every((o: any) => !o.visible))).toBe(true);
    await click(page, 'configure');
    expect(await bounds()).toEqual(before);
    await page.screenshot({ path: info.outputPath('portraits-ready-1000.png') });
  } finally { release(); }
});

test('saved-flight Continue ignores new-flight choices while Start New Run honors its summary', async ({ page }, info) => {
  test.setTimeout(90000);
  await boot(page); await click(page, 'primaryRun');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').routeAssetsReady);
  const saved = await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    localStorage.setItem('birdsquad.run.active', JSON.stringify(r.runState));
    return { leader: r.runState.leaderId, mode: r.runState.runMode, seed: r.runState.seed };
  });
  const home = async () => {
    await page.evaluate(() => {
      const g = (window as any).__birdSquadGame;
      g.scene.stop('RouteScene'); g.scene.start('MenuScene');
    });
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').hasSavedRun);
    await click(page, 'configure'); await click(page, 'spark_caller'); await click(page, 'quick');
    expect((await state(page)).launchSummary).toBe('Start New Run: The Spark-Caller · Standard · Quick / 3 districts');
  };
  await home();
  await page.screenshot({ path: info.outputPath('saved-flight-setup.png') });
  await click(page, 'primaryRun');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
  expect(await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene').runState;
    return { leader: r.leaderId, mode: r.runMode, seed: r.seed };
  })).toEqual(saved);
  await home(); await click(page, 'secondaryRun');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
  expect(await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene').runState;
    return { leader: r.leaderId, mode: r.runMode };
  })).toEqual({ leader: 'spark_caller', mode: 'quick' });
});
