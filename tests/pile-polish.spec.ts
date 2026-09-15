import { test, expect } from '@playwright/test';

for (const remapped of [false, true]) test(`pile reading preserves pending decisions, remapped=${remapped}`, async ({ page }, info) => {
  const keys = remapped ? { help: 'j', back: 'b', next: 'e' } : { help: 'h', back: 'Escape', next: 'ArrowRight' };
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  if (remapped) await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { guide: 'KeyJ', back: 'KeyB', previous: 'KeyQ', next: 'KeyE' } })));
  // Phaser consumes keyboard events on its frame, not when browser dispatch resolves.
  // This also lets ignored inputs finish before a direct pause/gamepad test action.
  const press = async (key: string) => {
    await page.keyboard.press(key);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  };
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready === true);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererModule && b.hand.length && !b.combatAnimationPending && !JSON.parse(w.render_game_to_text()).combatIntro?.active;
  });
  const state = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { selected: b.selectedInstanceId, target: b.selectedEnemyId, hand: b.hand.map((c: any) => c.instanceId),
      energy: b.energy, turn: b.turn, cancelled: b.statCancelledActions, hp: b.enemies.map((e: any) => e.hp) };
  });
  const focus = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { overlay: b.inspectOverlay ?? null, card: b.inspectedCardId ?? null, scroll: b.cardReviewScroll, detail: Boolean(b.combatCardDetail?.active) };
  });
  const click = async (name: string) => {
    const p = await page.evaluate(name => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const o = b.combatCardDetail?.getByName(name) ?? b.root.getByName(name), r = o.getBounds(), c = b.game.canvas.getBoundingClientRect();
      return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
    }, name);
    await page.mouse.move(p.x, p.y);
    // Lazy art can rebuild the inspector after its screenshot. Wait for the
    // current rendered control to enter Phaser's input list before pressing.
    await page.waitForFunction(name => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return b.input.hitTestPointer(b.input.activePointer).some((o: any) => o.name === name);
    }, name);
    await page.mouse.click(p.x, p.y, { delay: 40 });
  };
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.onCardClicked(b.hand[0].instanceId);
    const seed = b.drawPile[0];
    b.drawPile = Array.from({ length: 12 }, (_, i) => ({ ...seed, instanceId: `pile-${String(i).padStart(2, '0')}` }));
    b.discardPile = [{ ...seed, instanceId: 'discard-reading' }];
    b.clearedPile = [{ ...seed, instanceId: 'cleared-reading' }];
    b.openOverlay('draw');
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('combat-pile-read-hit'));
  const baseline = await state();
  expect(baseline.selected).toBeTruthy();
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport);
    const bounds = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const names = ['combat-pile-detail-title', 'combat-pile-detail-meta', 'combat-pile-detail-excerpt', 'combat-pile-read-label'];
      return { text: names.map(name => { const o = b.root.getByName(name), r = o.getBounds(); return { name, left: r.left, right: r.right, top: r.top, bottom: r.bottom, resolution: o.style.resolution }; }),
        rows: b.root.list.filter((o: any) => o.name === 'combat-pile-row-title').map((o: any) => ({ h: o.height, size: o.style.fontSize, width: o.width })),
        touch: b.root.getByName('combat-pile-read-hit').height };
    });
    expect(bounds.touch).toBeGreaterThanOrEqual(58);
    for (const t of bounds.text) { expect(t.left).toBeGreaterThanOrEqual(810); expect(t.right).toBeLessThanOrEqual(1110); expect(t.bottom).toBeLessThan(594); expect(t.resolution).toBe(2); }
    for (const r of bounds.rows) { expect(r.h).toBeLessThanOrEqual(54); expect(r.width).toBeLessThanOrEqual(250); expect(r.size).toBe('18px'); }
    await page.screenshot({ path: info.outputPath(`pile-${viewport.width}.png`) });
    await click('combat-pile-read-hit');
    await expect.poll(async () => (await focus()).detail).toBe(true);
    await page.screenshot({ path: info.outputPath(`reading-${viewport.width}.png`) });
    await press(keys.back);
    expect(await state()).toEqual(baseline);
  }
  await press('ArrowDown');
  const selectedPile = await focus();
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').setBattlePaused(true));
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Battle paused.');
  await press('ArrowDown'); await press(keys.next);
  expect(await focus()).toEqual(selectedPile);
  await press(keys.back);
  await press(keys.help);
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Card details, reading only.');
  for (const key of ['1', 'r', 'x', 'ArrowUp', 'ArrowDown']) await press(key);
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.endTurnAnimated(); b.onCardClicked(b.hand[0].instanceId);
    for (const index of [2, 3, 12, 13]) b.input.gamepad.emit('down', {}, { index });
  });
  expect(await state()).toEqual(baseline);
  expect(await focus()).toEqual({ ...selectedPile, detail: true });
  await press(keys.next);
  await press(keys.back);
  expect(await focus()).toEqual(selectedPile);
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.input.gamepad.emit('down', {}, { index: 11 }); b.setBattlePaused(true);
  });
  await press(keys.back);
  expect((await focus()).detail).toBe(true);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 1 }));
  expect(await focus()).toEqual(selectedPile);
  await press(keys.back);
  expect((await focus()).overlay).toBeNull(); expect(await state()).toEqual(baseline);
  // Every pile, including an empty zone, blocks gameplay and restores the same decision.
  for (const mode of ['deck', 'discard', 'cleared']) {
    await page.evaluate(mode => (window as any).__birdSquadGame.scene.getScene('BattleScene').openOverlay(mode), mode);
    await press('r'); await press('1');
    await press(keys.help); expect((await focus()).detail).toBe(true);
    await press(keys.back); await press(keys.back);
    expect(await state()).toEqual(baseline);
  }
  await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.clearedPile = []; b.openOverlay('cleared'); });
  await press(keys.help); expect((await focus()).detail).toBe(false);
  await press(keys.back); expect(await state()).toEqual(baseline);
  // Full authored text remains available without shrinking or truncation.
  const longRule = 'Gain 4 Cover. If the target is Winded, deal 8 damage. Retain 1 card. '.repeat(18).trim();
  await page.evaluate(longRule => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), original = b.battleInspectCardView.bind(b);
    b.battleInspectCardView = (card: any, zone: string) => ({ ...original(card, zone), name: 'Featherwright Emergency Relay Station', currentText: longRule, alternateText: longRule + ' Upgrade complete.' });
    b.openOverlay('draw');
  }, longRule);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('combat-pile-detail-excerpt')?.getData('truncated'));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.screenshot({ path: info.outputPath('long-pile-2560.png') });
  await press(keys.help);
  const pages = await page.evaluate(() => {
    const layer = (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail, pages = layer.getData('pages');
    const fits = pages.map((_p: any, i: number) => { layer.getData('changePage')(i - layer.getData('page')); return layer.getByName('combat-card-detail-body').getBounds().bottom <= 502; });
    layer.getData('changePage')(-pages.length);
    return { fits, rules: pages.map((p: any) => p.body).join(' ').replace(/\s+/g, ' ').trim(), headings: pages.map((p: any) => p.heading) };
  });
  expect(pages.fits.every(Boolean)).toBe(true); expect(pages.rules).toContain(longRule); expect(pages.rules).toContain('Upgrade complete.');
  expect(pages.headings).toContain('PREEN · UPGRADE');
  await page.screenshot({ path: info.outputPath('long-reading-2560.png') });
  await press(keys.back); await press(keys.back);
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), original = b.battleInspectCardView.bind(b);
    b.battleInspectCardView = (card: any, zone: string) => ({ ...original(card, zone), usesMolt: true });
    b.openOverlay('draw'); b.toggleCombatCardDetail();
  });
  const moltHeading = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail.getData('pages').map((p: any) => p.heading));
  expect(moltHeading).toContain('BASE · WITHOUT MOLT');
  await press(keys.back); await press(keys.back);
  expect(await state()).toEqual(baseline); expect(errors).toEqual([]);
});
