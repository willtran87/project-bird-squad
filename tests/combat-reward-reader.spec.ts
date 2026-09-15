import { test, expect } from '@playwright/test';

for (const remapped of [false, true]) test(`combat rewards keep full rules and pending decisions, remapped=${remapped}`, async ({ page }, info) => {
  test.setTimeout(120_000);
  const keys = remapped ? { inspect: 'j', previous: 'q', next: 'e', back: 'b' } : { inspect: 'r', previous: 'ArrowLeft', next: 'ArrowRight', back: 'Escape' };
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  if (remapped) await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { roost: 'KeyJ', previous: 'KeyQ', next: 'KeyE', back: 'KeyB' } })));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); return b.handLayer?.getByName('combat-card-title') && b.battleHandRendererModule && !b.getTextState().combatIntro?.active; });
  const press = async (key: string) => { await page.keyboard.press(key); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); };
  const reading = () => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').getTextState().rewardInspection?.reading ?? null);
  const stable = () => page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); return JSON.stringify({ deck: b.allDeckCards(), scrap: b.scrap, mode: b.mode, armed: b.rewardChoiceArmedId, focus: b.controllerChoiceIndex, skip: b.rewardSkipArmed }); });
  const click = async (name: string) => {
    const p = await page.evaluate(name => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), o = b.cardPreview.getByName(name), r = o.getBounds(), c = b.game.canvas.getBoundingClientRect(); return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 }; }, name);
    await page.mouse.move(p.x, p.y);
    await page.waitForFunction(name => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); return b.input.hitTestPointer(b.input.activePointer).some((o: any) => o.name === name); }, name);
    await page.mouse.click(p.x, p.y, { delay: 40 });
  };
  for (const mode of ['cardReward', 'upgradeReward']) {
    const expected = await page.evaluate(mode => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      b.closeRewardCardInspection(); b.mode = mode;
      const cards = b.allDeckCards().filter((c: any) => !c.upgraded && c.cost > 0).slice(0, 3);
      b.rewardChoices = cards; b.upgradeChoices = cards; b.flock.molt = true;
      b.controllerChoiceIndex = 1; b.rewardChoiceArmedId = cards[1].id; b.rewardSkipArmed = false; b.battleInputActive = true;
      b.renderAll(); return { cost: cards[1].cost, discountedCost: b.effectiveCost(cards[1]), text: cards[1].text };
    }, mode);
    expect(expected.discountedCost).toBeLessThan(expected.cost);
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').rewardPresentationReady());
    const before = await stable();
    await press(keys.inspect);
    await expect.poll(reading).not.toBeNull();
    expect((await reading()).title).toBe('NOW');
    expect((await reading()).text.replace(/\s+/g, '')).toBe(expected.text.replace(/\s+/g, ''));
    expect(await stable()).toBe(before);
    const sizes = remapped ? [{ width: 1000, height: 560 }] : [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }];
    for (const size of sizes) {
      await page.setViewportSize(size);
      const geometry = await page.evaluate(() => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), p = b.cardPreview, frame = p.getByName('route-inspection-reader-frame').getBounds();
        const impact = b.rewardInspectionLayer.getByName('reward-deck-impact');
        const rows = impact.list.filter((o: any) => o.type === 'Text');
        return { size: p.getByName('route-inspection-reader-body').style.fontSize,
          textFit: p.list.filter((o: any) => o.type === 'Text').every((o: any) => { const r = o.getBounds(); return r.left >= frame.left + 16 && r.right <= frame.right - 16 && r.bottom <= frame.bottom - 10 && o.style.resolution === 2; }),
          impactFit: rows.every((o: any, i: number) => { const r = o.getBounds(); return r.right <= 1062 && r.bottom <= 590 && (!rows[i + 1] || r.bottom + 4 <= rows[i + 1].getBounds().top); }),
          separated: frame.right + 20 <= impact.x,
          touch: ['next', 'previous'].every(s => p.getByName(`route-inspection-reader-${s}`).height >= 58),
          cost: p.list.some((o: any) => o.text === `${b.rewardChoices[1].cost} Wingbeat${b.rewardChoices[1].cost === 1 ? '' : 's'}`) };
      });
      expect(geometry).toEqual({ size: '22px', textFit: true, impactFit: true, separated: true, touch: true, cost: true });
      await page.screenshot({ path: info.outputPath(`${mode}-${size.width}.png`) });
    }
    await click('route-inspection-reader-frame'); expect(await stable()).toBe(before); expect(await reading()).not.toBeNull();
    await click('route-inspection-reader-next');
    await expect.poll(async () => (await reading())?.page).toBe(2);
    await expect.poll(() => page.locator('#game-status').textContent()).toContain('Reading page 2');
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').renderAll());
    expect((await reading()).page).toBe(2);
    await press(keys.previous); expect((await reading()).page).toBe(1);
    await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.input.gamepad.emit('down', null, { index: 15 }); });
    expect((await reading()).page).toBe(2);
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').setBattlePaused(true));
    await press(keys.next); await press('Enter');
    expect((await reading()).page).toBe(2);
    await press(keys.back);
    expect((await reading()).page).toBe(2); expect(await stable()).toBe(before);
    await press(keys.back); await expect.poll(reading).toBeNull(); expect(await stable()).toBe(before);
    await press(keys.inspect); await expect.poll(async () => (await reading())?.page).toBe(1);
    await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
    await expect.poll(reading).toBeNull(); expect(await stable()).toBe(before);
    await press(keys.inspect);
    await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.input.gamepad.emit('down', null, { index: 0 }); });
    await expect.poll(reading).toBeNull(); expect(await stable()).toBe(before);
  }
  await press(keys.inspect);
  const authored = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), c = b.upgradeChoices[1];
    c.text = 'Gain 2 Cover, then draw 1 card. '.repeat(30) + 'W'.repeat(90);
    c.upgradedText = 'Gain 3 Cover. '.repeat(20); c.moltText = 'Gain 1 Resonance. '.repeat(20); c.moltTextUpgraded = 'Gain 2 Resonance. '.repeat(20);
    b.renderAll(); return { NOW: c.text, PREEN: c.upgradedText, MOLT: c.moltText, 'MOLT · PREEN': c.moltTextUpgraded };
  });
  const seen = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), p = b.cardPreview, result: Record<string, string[]> = {};
    for (let i = 0; i < 100; i++) {
      const r = p.getData('reading'); (result[r.title] ??= []).push(r.text);
      if (p.getByName('route-inspection-reader-body').getBounds().bottom > 518) throw new Error('Rules crossed the reading boundary');
      if (r.page === r.total) break;
      p.getData('turnRulesPage')(1);
    }
    return result;
  });
  for (const [section, value] of Object.entries(authored)) expect(seen[section].join('').replace(/\s+/g, '')).toBe(value.replace(/\s+/g, ''));
  await page.screenshot({ path: info.outputPath('complete-long-rules.png') });
  expect(errors).toEqual([]);
});
