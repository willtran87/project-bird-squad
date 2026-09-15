import { test, expect } from '@playwright/test';

for (const remapped of [false, true]) test(`explicit card details preserve decisions and paginate complete rules, remapped=${remapped}`, async ({ page }, info) => {
  const keys = remapped ? { help: 'j', back: 'b', next: 'e', previous: 'q' } : { help: 'h', back: 'Escape', next: 'ArrowRight', previous: 'ArrowLeft' };
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  if (remapped) await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { guide: 'KeyJ', back: 'KeyB', previous: 'KeyQ', next: 'KeyE' } })));
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => (window as any).__birdSquadEnsureScene);
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready === true);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    return b.handLayer?.getByName('combat-card-title') && b.battleHandRendererModule && !JSON.parse(w.render_game_to_text()).combatIntro?.active;
  });
  const state = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { selected: b.selectedInstanceId, target: b.selectedEnemyId, hand: b.hand.map((c: any) => c.instanceId),
      energy: b.energy, turn: b.turn, hp: b.enemies.map((e: any) => e.hp) };
  });
  const modal = () => page.evaluate(() => JSON.parse((window as any).render_game_to_text()).combatCardDetail ?? null);
  const clickNamed = async (name: string) => {
    const point = await page.evaluate(name => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const obj = b.combatCardDetail?.getByName(name) ?? b.cardPreview?.getByName(name);
      const r = obj.getBounds(), canvas = b.game.canvas.getBoundingClientRect();
      return { x: canvas.left + r.centerX * canvas.width / 1280, y: canvas.top + r.centerY * canvas.height / 720 };
    }, name);
    await page.mouse.click(point.x, point.y);
  };
  const checkPages = async () => {
    const result = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), layer = b.combatCardDetail;
      const panel = layer.getByName('combat-card-detail-panel').getBounds(), pages = layer.getData('pages');
      const allFit: boolean[] = [];
      for (let i = 0; i < pages.length; i++) {
        layer.getData('changePage')(i - layer.getData('page'));
        allFit.push(layer.list.filter((o: any) => o.type === 'Text').every((o: any) => {
          const r = o.getBounds();
          return r.left >= panel.left && r.right <= panel.right && r.top >= panel.top && r.bottom <= panel.bottom
            && o.style.resolution === 2 && o.scaleX === 1 && o.scaleY === 1;
        }));
        allFit.push(layer.getByName('combat-card-detail-body').getBounds().bottom <= 502);
      }
      layer.getData('changePage')(-pages.length);
      return { fit: allFit.every(Boolean), bodySize: layer.getByName('combat-card-detail-body').style.fontSize,
        touch: ['previous', 'next', 'close'].every(s => { const o = layer.getByName(`combat-card-detail-${s}`); return o.height >= 58 && o.width >= 58; }),
        rules: pages.map((p: any) => p.body).join(' ').replace(/\s+/g, ' ').trim() };
    });
    expect(result.fit).toBe(true); expect(result.touch).toBe(true); expect(result.bodySize).toBe('22px');
    return result.rules;
  };
  await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.onCardClicked(b.hand[0].instanceId); });
  const baseline = await state();
  expect(await modal()).toBeNull();
  await page.screenshot({ path: info.outputPath('selected-2560.png') });
  await clickNamed('combat-card-inspect-hit');
  expect(await modal()).not.toBeNull(); await checkPages();
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Card details, reading only.');
  for (const key of ['1', 'r', 'x', 'ArrowUp', 'ArrowDown']) {
    await page.keyboard.press(key); expect(await modal(), `modal survives ${key}`).not.toBeNull();
  }
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    for (const index of [2, 3, 12, 13]) b.input.gamepad.emit('down', {}, { index });
  });
  expect(await modal(), 'modal survives controller non-reading inputs').not.toBeNull();
  await page.mouse.click(2300, 650);
  expect(await modal(), 'modal survives outside click').not.toBeNull();
  expect(await state()).toEqual(baseline);
  await page.keyboard.press(keys.next); expect((await modal()).page).toBe(2);
  await page.keyboard.press(keys.previous); expect((await modal()).page).toBe(1);
  await page.keyboard.press(keys.back); expect(await modal()).toBeNull(); expect(await state()).toEqual(baseline);
  await page.keyboard.press(keys.help); expect(await modal()).not.toBeNull();
  await page.evaluate(remapped => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.input.keyboard.emit(remapped ? 'keydown-J' : 'keydown-H', { repeat: true }); b.setBattlePaused(true);
  }, remapped);
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Battle paused.');
  await page.keyboard.press(keys.back); expect(await modal()).not.toBeNull();
  await page.keyboard.press('Enter'); expect(await modal()).toBeNull(); expect(await state()).toEqual(baseline);
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.input.gamepad.emit('down', {}, { index: 11 }); b.input.gamepad.emit('down', {}, { index: 15 });
  });
  expect((await modal()).page).toBe(2);
  await clickNamed('combat-card-detail-close'); expect(await state()).toEqual(baseline);
  for (const molt of [false, true]) {
    const count = await page.evaluate(molt => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.flock.molt = molt; return b.hand.length; }, molt);
    for (let i = 0; i < count; i++) {
      const authored = await page.evaluate(i => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        b.openCombatCardDetail(b.hand[i]); return b.battleHandCardView(b.hand[i]).preview.currentText;
      }, i);
      expect(await checkPages()).toContain(authored.replace(/\s+/g, ' ').trim());
      await page.keyboard.press(keys.back);
    }
  }
  await page.keyboard.press(keys.help);
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport); await checkPages();
    await page.screenshot({ path: info.outputPath(`details-${viewport.width}.png`) });
  }
  await page.keyboard.press(keys.back);
  const longRule = 'Gain 4 Cover. If the target is Winded, deal 8 damage. Retain 1 card. '.repeat(18).trim();
  await page.evaluate(longRule => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), original = b.battleHandCardView.bind(b);
    b.battleHandCardView = (card: any) => { const view = original(card); return { ...view, preview: { ...view.preview,
      name: 'Featherwright Emergency Relay Station', cost: 3, currentText: longRule } }; };
    b.openCombatCardDetail(b.hand[0]);
  }, longRule);
  expect(await checkPages()).toContain(longRule); expect((await modal()).pageCount).toBeGreaterThan(3);
  await page.screenshot({ path: info.outputPath('long-rules-1000.png') });
  expect(errors).toEqual([]);
});
