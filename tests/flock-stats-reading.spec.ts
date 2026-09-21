import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test.use({ hasTouch: true });
for (const key of ['RouteScene', 'BattleScene']) for (const remapped of [false, true]) test(`${key} Flock Stats stays readable and preserves the pending decision, remapped=${remapped}`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(remapped => {
    localStorage.setItem('birdsquad.screenReader', 'on');
    if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { back: 'KeyB' } }));
  }, remapped);
  await page.setViewportSize({ width: 2560, height: 1600 }); await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async key => {
    const w = window as any; await w.__birdSquadEnsureScene(key);
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start(key, { routeNodeId: 'm1_entry' });
  }, key);
  await page.waitForFunction(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    return key === 'RouteScene' ? s.routeEssentialAssetsReady : s.battleHandRendererModule && !s.combatInteractionLocked();
  }, key);
  if (key === 'BattleScene') await page.evaluate(() => {
    const s = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    s.onCardClicked(s.hand[0].instanceId);
    s.nextTurnEnergyBonus = 2; s.flock.openSkyGuard = 0;
    s.hand[0].runtime = { ...s.hand[0].runtime, flockStats: { ...s.hand[0].runtime.flockStats, openSkyGuard: 7 } };
    s.statDealt = 12345; s.statBlocked = 9876;
  });
  const stable = () => page.evaluate(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    return JSON.stringify({ run: s.runState, selected: s.selectedInstanceId, target: s.selectedEnemyId,
      hand: s.hand, flock: s.flock, enemies: s.enemies, turn: s.turn, energy: s.energy, node: s.selectedNodeId });
  }, key);
  const before = await stable();
  const open = async () => {
    await page.evaluate(key => {
      const s = (window as any).__birdSquadGame.scene.getScene(key);
      if (key === 'RouteScene') s.openFlockOverlay(); else s.openOverlay('flock');
    }, key);
    await page.waitForFunction(key => {
      const s = (window as any).__birdSquadGame.scene.getScene(key);
      return (key === 'RouteScene' ? s.children : s.root).getByName('flock-stats-reader');
    }, key);
    await settleCanvas(page);
  };
  await open(); expect(await stable()).toBe(before);
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Flock Stats. Reading only.');
  if (key === 'BattleScene') {
    await expect.poll(() => page.locator('#game-status').textContent()).toMatch(/Open Sky Guard: base 0, bonus [1-9]\d*, total 0\./);
    await expect.poll(() => page.locator('#game-status').textContent()).toContain('Next Wingbeats: base 3, bonus 2, total 5.');
  }
  const geometry = () => page.evaluate(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key);
    const p = (key === 'RouteScene' ? s.children : s.root).getByName('flock-stats-reader');
    const box = p.getByName('flock-stats-panel').getBounds();
    const labels = p.list.filter((o: any) => o.type === 'Text');
    const cells = labels.filter((o: any) => o.name.startsWith('flock-stats-cell-'));
    const overlap = cells.flatMap((a: any, i: number) => cells.slice(i + 1).filter((b: any) => {
      const x = a.getBounds(), y = b.getBounds(); return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
    }).map((b: any) => [a.name, b.name]));
    const hud = s.children.list.find((o: any) => o.name === 'run-hud-surface' || o.list?.some((child: any) => child.name === 'run-hud-surface'));
    return { cells: cells.length, overlap,
      aboveHud: key !== 'RouteScene' || (!!hud && s.children.list.indexOf(p) > s.children.list.indexOf(hud)),
      bounds: labels.every((o: any) => { const b = o.getBounds(); return b.left >= box.left && b.right <= box.right && b.top >= box.top && b.bottom <= box.bottom; }),
      fonts: cells.every((o: any) => o.style.fontSize === '22px' && o.style.resolution === 2),
      close: p.getByName('flock-stats-close').height * s.game.canvas.getBoundingClientRect().height / 720,
      images: p.list.filter((o: any) => o.type === 'Image').length,
      tweens: s.tweens.getTweens().filter((t: any) => t.targets.some((o: any) => o.parentContainer === p)).length };
  }, key);
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size); await settleCanvas(page);
    const g = await geometry(); expect(g.cells).toBe(key === 'RouteScene' ? 36 : 40);
    expect(g.overlap).toEqual([]); expect(g.bounds && g.fonts).toBe(true); expect(g.close).toBeGreaterThanOrEqual(44);
    expect(g.images).toBe(0); expect(g.tweens).toBe(0); expect(g.aboveHud).toBe(true);
    if (!remapped) await page.screenshot({ path: info.outputPath(`stats-${size.width}.png`) });
  }
  await page.mouse.wheel(0, 450); await page.keyboard.press('Enter'); await settleCanvas(page);
  expect(await stable()).toBe(before);
  await page.keyboard.press(remapped ? 'b' : 'Escape'); await settleCanvas(page);
  const closed = () => page.evaluate(key => { const s = (window as any).__birdSquadGame.scene.getScene(key); return !(key === 'RouteScene' ? s.flockOverlayOpen : s.inspectOverlay); }, key);
  expect(await closed()).toBe(true); expect(await stable()).toBe(before);
  await open();
  const point = await page.evaluate(key => {
    const s = (window as any).__birdSquadGame.scene.getScene(key), p = (key === 'RouteScene' ? s.children : s.root).getByName('flock-stats-reader');
    const b = p.getByName('flock-stats-close').getBounds(), c = s.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, key);
  await page.touchscreen.tap(point.x, point.y); await settleCanvas(page);
  expect(await closed()).toBe(true); expect(await stable()).toBe(before);
  await open();
  await page.evaluate(key => (window as any).__birdSquadGame.scene.getScene(key).input.gamepad.emit('down', {}, { index: 1 }), key);
  await settleCanvas(page); expect(await closed()).toBe(true); expect(await stable()).toBe(before);
  expect(errors).toEqual([]);
});
