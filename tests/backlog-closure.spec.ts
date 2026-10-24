import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

async function boot(page: Page) {
  await page.goto('./?flight=backlog-closure&length=quick');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
}
const disk = (page: Page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])));
async function clickObject(page: Page, scene: string, name: string) {
  await settleCanvas(page);
  const point = await page.evaluate(({ scene, name }) => {
    const game = (window as any).__birdSquadGame;
    const visit = (objects: any[]): any => { for (const object of objects) { if (object.name === name) return object; const nested = visit(object.list ?? []); if (nested) return nested; } };
    const object = visit(game.scene.getScene(scene).children.list), bounds = object.getBounds(), canvas = game.canvas.getBoundingClientRect();
    return { x: canvas.left + bounds.centerX * canvas.width / 1280, y: canvas.top + bounds.centerY * canvas.height / 720 };
  }, { scene, name });
  await page.mouse.move(point.x, point.y);
  await settleCanvas(page);
  await page.mouse.click(point.x, point.y);
}

for (const [offset, id] of ['preen', 'deck'].entries()) test(`guided ${id} decision preserves real saves and exposes full draw comparison`, async ({ page }, info) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 2560, height: 1600 });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page); await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.reload(); await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  const before = await disk(page); expect(before['birdsquad.run.active']).toBeTruthy();
  await page.keyboard.press('h');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).helpFocus?.label === 'Practice lessons');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).helpTopic?.startsWith('Practice lessons.'));
  for (let i = 0; i < 3 + offset; i++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(index => JSON.parse((window as any).render_game_to_text()).helpFocus?.index === index, i + 1);
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(id => (window as any).__birdSquadGame.registry.get('birdsquad.practiceLesson')?.id === id, id);
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`${id}-lesson-${viewport.width}.png`) });
  }
  const startingDeck = await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState.deck));
  await clickObject(page, 'RouteScene', 'card-picker-card-inspect-hit');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').hoverCardDetail?.getByName('route-inspection-reader'));
  let found = false;
  for (let i = 0; i < 40; i++) {
    const reading = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').hoverCardDetail.getByName('route-inspection-reader').getData('reading'));
    if (reading.title === 'DRAW COMPARISON' && reading.text.includes('chance in a base-size hand')) {
      expect(reading.text).toContain(id === 'preen' ? '66.7% > 66.7%' : '66.7% > 80.0%');
      found = true; break;
    }
    if (reading.page === reading.total) break;
    await clickObject(page, 'RouteScene', 'route-inspection-reader-next');
  }
  expect(found).toBe(true);
  expect(await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState.deck))).toBe(startingDeck);
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`${id}-draw-${viewport.width}.png`) });
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').cardPickerInspectionOpen);
  await page.keyboard.press('Enter'); await settleCanvas(page); await page.keyboard.press('Enter');
  if (id === 'preen') await page.getByRole('button', { name: 'Choose Shelter', exact: true }).click();
  await page.waitForFunction(() => (window as any).__birdSquadGame.registry.get('birdsquad.practiceLesson')?.complete);
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`${id}-complete-${viewport.width}.png`) });
  }
  expect(await disk(page)).toEqual(before);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('MenuScene'));
  expect(await disk(page)).toEqual(before);
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).helpFocus?.label === 'Practice lessons');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).helpTopic?.startsWith('Practice lessons.'));
  for (let i = 0; i < 3 + offset; i++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(index => JSON.parse((window as any).render_game_to_text()).helpFocus?.index === index, i + 1);
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(id => (window as any).__birdSquadGame.registry.get('birdsquad.practiceLesson')?.id === id, id);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__birdSquadGame.registry.get('birdsquad.practiceLesson')?.finished);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.registry.get('birdsquad.practiceLesson').complete)).toBe(false);
  await settleCanvas(page); // The new action-focus owner is installed on the next frame.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('MenuScene'));
  expect(await disk(page)).toEqual(before); expect(errors).toEqual([]);
});

test('shared HUD stays deferred and route/battle remain usable with smooth texture filtering', async ({ page }, info) => {
  await boot(page);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some(e => /\/(run-hud|route-transition-fx)-/.test(e.name)))).toBe(false);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.keyboard.press('Enter'); await settleCanvas(page); await page.keyboard.press('Enter');
  await page.waitForFunction(() => { const s = JSON.parse((window as any).render_game_to_text()); return s.scene === 'BattleScene' && s.assetReadiness?.fullArt && !s.combatIntro?.active; });
  expect(await page.evaluate(() => {
    const game = (window as any).__birdSquadGame, b = game.scene.getScene('BattleScene');
    return { hud: !!b.root.getByName('hud-deck-chip'), msaa: game.renderer.gl.getContextAttributes().antialias, textures: game.config.antialias, mipmap: game.config.mipmapFilter };
  })).toEqual({ hud: true, msaa: false, textures: true, mipmap: 'LINEAR_MIPMAP_LINEAR' });
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport); await settleCanvas(page); await page.screenshot({ path: info.outputPath(`hud-${viewport.width}.png`) });
  }
});

test('reduced-motion district flourish retires without needing a redraw', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await boot(page); await page.keyboard.press('Enter');
  await page.waitForFunction(() => { const r = (window as any).__birdSquadGame.scene.getScene('RouteScene'); return r.routeEssentialAssetsReady && r.districtAdvanceFlourishState().loaded; });
  const count = await page.evaluate(() => {
    const g = (window as any).__birdSquadGame, r = g.scene.getScene('RouteScene');
    r.runState.mapIndex = 1; r.runState.currentRouteNodeId = undefined; r.districtAdvanceNotice = { toMapIndex: 1, toMapName: 'Practice district' };
    r.renderDistrictAdvanceFlourish();
    const objects = r.children.list.filter((o: any) => /district-advance-(flourish|title-plaque)/.test(o.name));
    (window as any).__flourishObjects = objects;
    (window as any).advanceTime(2700);
    return { created: objects.length, active: objects.filter((o: any) => o.active).length };
  });
  expect(count.created).toBeGreaterThan(0); expect(count.active).toBe(0);
});

test('failed map renderer leaves the fallback deck control usable', async ({ page }) => {
  await page.route('**/route-map-renderer-*.js', route => route.abort());
  await boot(page); await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').shouldChooseDistrictContract());
  await clickObject(page, 'RouteScene', 'run-hud-loading-Deck');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').deckOverlayOpen);
});
