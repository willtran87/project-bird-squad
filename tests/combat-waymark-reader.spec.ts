import { test, expect } from '@playwright/test';
import marks from '../data/game/alpha-route-marks.json' with { type: 'json' };
import { settleCanvas } from './helpers/settled-canvas';
import { itemKeywordSections } from '../src/game/keyword-definitions';

const expectedTerms = Object.fromEntries(marks.routeMarks.map(mark => [mark.id,
  itemKeywordSections([{ title: 'EFFECT', text: mark.description }])])) as Record<string, Array<{ title: string; text: string }>>;

for (const remapped of [false, true]) test(`combat Waymark reading is complete and Back preserves the pending card, remapped=${remapped}`, async ({ page }, info) => {
  test.setTimeout(120_000); // Full 58-item, multi-viewport catalog qualification.
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(remapped => {
    localStorage.setItem('birdsquad.screenReader', 'on');
    if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { previous: 'KeyQ', next: 'KeyE', roost: 'KeyJ', back: 'KeyB', skipReward: 'KeyK' } }));
  }, remapped);
  const press = async (key: string) => { await page.keyboard.press(key); await settleCanvas(page); };
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending && !b.cameras.main.fadeEffect.isRunning;
  });
  const before = await page.evaluate(ids => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.routeMarks = ids; b.selectedInstanceId = b.hand[0].instanceId;
    b.renderAll();
    return { selected: b.selectedInstanceId, target: b.selectedEnemyId, cancelled: b.statCancelledActions };
  }, marks.routeMarks.map(m => m.id));
  const click = async (name: string) => {
    const point = await page.evaluate(name => {
      const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
      const r = b.root.getByName(name).getBounds(), c = w.__birdSquadGame.canvas.getBoundingClientRect();
      return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
    }, name);
    await page.mouse.click(point.x, point.y); await settleCanvas(page);
  };
  await click('hud-waymarks-chip');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('route-waymark-reader-body'));
  await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('inventory-2560.png') });
  expect(await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.root.getByName('route-waymark-reader-body')?.style.fontSize;
  })).toBe('22px');
  const stable = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ selected: b.selectedInstanceId, target: b.selectedEnemyId, cancelled: b.statCancelledActions,
      deck: b.allDeckCards(), enemies: b.enemies, flock: b.flock, turn: b.turn, energy: b.energy, scrap: b.scrap, marks: b.routeMarks });
  });
  const reading = () => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').getTextState().waymarkReview);
  const unchanged = await stable();
  const failures = await page.evaluate(expectedTerms => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), failures: string[] = [];
    const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
    for (const compare of [false, true]) {
      if (compare) b.waymarkReviewModule.battleWaymarkAction(b, 'pin');
      for (let index = 0; index < b.ownedMarkDefs().length; index++) {
        b.renderAll();
        const state = b.getTextState().waymarkReview, selected = state.selected;
        const mark = b.ownedMarkDefs().find((mark: any) => mark.id === selected.id);
        const seen: string[] = [], panel = b.root.getByName('route-waymark-review-panel');
        for (let page = 0; page < state.reading.total; page++) {
          const bodies = b.root.list.filter((o: any) => o.name === 'route-waymark-reader-body');
          if (bodies.some((o: any) => o.getBounds().bottom > 568)) failures.push(`${selected.id} overflow`);
          seen.push(bodies.at(-1).text); panel.getData('turnRulesPage')(1);
        }
        const text = clean(seen.join(' '));
        for (const value of [mark.name, mark.description, mark.flavorText, selected.trigger, ...selected.effects.map((e: any) => e.text), ...selected.tags]) {
          if (value && !text.includes(clean(value))) failures.push(`${selected.id} missing ${value}`);
        }
        for (const section of expectedTerms[selected.id]) {
          if (!text.includes(clean(section.text))) failures.push(`${selected.id} missing ${section.title}`);
        }
        b.waymarkReviewModule.battleWaymarkAction(b, 'choose', 1);
      }
    }
    b.waymarkReviewModule.battleWaymarkAction(b, 'pin'); b.renderAll();
    return failures;
  }, expectedTerms);
  expect(failures).toEqual([]); expect(await stable()).toBe(unchanged);
  await press(remapped ? 'j' : 'r'); await press(remapped ? 'e' : 'ArrowRight');
  expect((await reading()).comparing).toBe(true);
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    const bounds = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return b.root.list.filter((o: any) => o.name === 'route-waymark-reader-body').map((o: any) => ({ size: o.style.fontSize, bottom: o.getBounds().bottom }));
    });
    expect(bounds).toHaveLength(2); expect(bounds.every(o => o.size === '18px' && o.bottom <= 568)).toBe(true);
    await page.screenshot({ path: info.outputPath(`comparison-${width}.png`) });
  }
  await press('PageDown');
  const paged = await reading(); expect(paged.reading.page).toBe(2);
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const stale = b.root.getByName('route-waymark-review-panel').getData('turnRulesPage');
    b.renderAll(); stale(1);
  });
  expect(await reading()).toEqual(paged);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').setBattlePaused(true));
  await press(remapped ? 'j' : 'r'); await press('PageDown'); await press('Tab');
  await press('ArrowDown'); await press(remapped ? 'e' : 'ArrowRight');
  expect(await reading()).toEqual(paged); expect(await stable()).toBe(unchanged);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').openSettingsOverlay());
  await press('PageDown'); await press(remapped ? 'j' : 'r');
  expect(await reading()).toEqual(paged); expect(await stable()).toBe(unchanged);
  await press(remapped ? 'b' : 'Escape'); await press(remapped ? 'b' : 'Escape');
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('BattleScene').pauseOverlayOpen);
  await click('route-waymark-reader-next'); expect((await reading()).reading.page).toBe(3);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 4 }));
  expect((await reading()).reading.page).toBe(2);
  const wheelPoint = await page.evaluate(() => { const c = (window as any).__birdSquadGame.canvas.getBoundingClientRect(); return { x: c.left + 640 * c.width / 1280, y: c.top + 515 * c.height / 720 }; });
  await page.mouse.move(wheelPoint.x, wheelPoint.y); await page.mouse.wheel(0, 110); await settleCanvas(page);
  expect((await reading()).reading.page).toBe(3); expect(await stable()).toBe(unchanged);
  await expect(page.locator('#game-status')).toContainText('Found Waymarks');
  const counts = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const count = () => [b.children.length, b.root.length, b.input.listenerCount('pointerdown'), b.input.keyboard.listenerCount('keydown'), b.input.gamepad.listenerCount('down')];
    const before = count(); const old = b.root.getByName('route-waymark-reader-body');
    for (let i = 0; i < 20; i++) b.renderAll();
    return { before, after: count(), retired: !old.scene };
  });
  expect(counts.after).toEqual(counts.before); expect(counts.retired).toBe(true);
  await press(remapped ? 'b' : 'Escape');
  expect(await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { selected: b.selectedInstanceId, target: b.selectedEnemyId, cancelled: b.statCancelledActions };
  })).toEqual(before);
  expect(await stable()).toBe(unchanged);
  await press(remapped ? 'Shift+k' : 'Shift+x');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').waymarkDrawerOpen);
  expect((await reading()).reading.page).toBe(3);
  await press('1'); await press('Enter'); await press('h'); await press('Space');
  for (const index of [0, 3, 10, 11]) await page.evaluate(index => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index }), index);
  expect(await stable()).toBe(unchanged);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 7 }));
  await settleCanvas(page);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').waymarkDrawerOpen)).toBe(false);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 7 }));
  await settleCanvas(page); expect((await reading()).open).toBe(true);
  await press(remapped ? 'b' : 'Escape'); expect(await stable()).toBe(unchanged);
  // Resume the actual selected card with its original no-Waymark combat setup.
  await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.routeMarks = []; b.renderAll(); });
  await press('Enter');
  await page.waitForFunction(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); return !b.combatAnimationPending && b.statCardsPlayed === 1; });
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').energy)).toBe(2);
  expect(errors).toEqual([]);
});
