import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

for (const remapped of [false, true]) test(`Preen choices expose readable changes and explicit commitment, remapped=${remapped}`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(remapped => {
    localStorage.setItem('birdsquad.screenReader', 'on');
    if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { roost: 'KeyJ', back: 'KeyB', next: 'KeyE' } }));
  }, remapped);
  await page.setViewportSize({ width: 2560, height: 1600 }); await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene'); await w.__birdSquadEnsureScene('CodexScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererModule && b.hand.length && b.combatIntroElapsedMs > 0 && !b.combatIntroActive;
  });
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.upgradeChoices = b.allDeckCards().filter((c: any) => !c.upgraded && c.text !== c.upgradedText).slice(0, 3);
    b.mode = 'upgradeReward'; b.controllerChoiceIndex = 0; b.battleInputActive = true; b.renderAll();
  });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('BattleScene').battleRewardRendererModule));
  const stable = () => page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); return JSON.stringify({ deck: b.allDeckCards(), mode: b.mode, scrap: b.scrap, focus: b.controllerChoiceIndex, armed: b.rewardChoiceArmedId }); });
  const reading = () => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').getTextState().rewardInspection?.reading ?? null);
  const press = async (key: string) => { await page.keyboard.press(key); await settleCanvas(page); };
  const click = async (name: string) => {
    const p = await page.evaluate(name => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), r = b.root.getByName(name).getBounds(), c = b.game.canvas.getBoundingClientRect(); return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 }; }, name);
    await page.mouse.click(p.x, p.y); await settleCanvas(page);
  };
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`preen-${size.width}.png`) });
    const geometry = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), list = b.root.list;
      const all = (name: string) => list.filter((o: any) => o.name === name);
      const rect = (o: any) => { const r = o.getBounds(); return { left: r.left, right: r.right, height: r.height }; };
      return { changes: all('reward-preen-change').map((o: any) => ({ font: o.style.fontSize, top: o.getBounds().top, bottom: o.getBounds().bottom, width: o.width, full: o.getData('fullText') })),
        read: all('reward-card-inspect-hit').map(rect), take: all('reward-card-take-hit').map(rect),
        effects: all('reward-card-effect').map((o: any) => ({ font: o.style.fontSize, lines: o.getWrappedText().length, resolution: o.style.resolution })) };
    });
    expect(geometry.changes).toHaveLength(3);
    geometry.changes.forEach((o: any) => { expect(o.font).toBe('16px'); expect(o.top).toBeGreaterThan(615); expect(o.bottom).toBeLessThan(702); expect(o.width).toBeLessThanOrEqual(240); expect(o.full).toBeTruthy(); });
    expect(geometry.take).toHaveLength(3);
    geometry.read.forEach((r: any, i: number) => { expect(r.height).toBe(58); expect(r.right).toBeLessThan(geometry.take[i].left); expect(geometry.take[i].height).toBe(58); });
    geometry.effects.forEach((o: any) => expect(o).toEqual({ font: '18px', lines: expect.any(Number), resolution: 2 }));
  }
  await click('reward-card-take-hit'); const armed = await stable();
  const labels = () => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').root.list.filter((o: any) => o.name === 'reward-card-take-label').map((o: any) => o.text));
  expect((await labels())[0]).toBe('Confirm');
  await click('reward-card-inspect-hit'); await expect.poll(reading).not.toBeNull(); expect(await stable()).toBe(armed);
  await click('reward-card-take-hit'); expect(await stable()).toBe(armed);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').setBattlePaused(true));
  await press('Enter'); expect(await reading()).not.toBeNull();
  await press(remapped ? 'b' : 'Escape'); expect(await reading()).not.toBeNull();
  await press(remapped ? 'b' : 'Escape'); await expect.poll(reading).toBeNull(); expect(await stable()).toBe(armed);
  await press(remapped ? 'j' : 'r'); await expect.poll(reading).not.toBeNull();
  await press(remapped ? 'e' : 'ArrowRight'); await page.screenshot({ path: info.outputPath('preen-full-comparison.png') });
  await press('Enter'); await expect.poll(reading).toBeNull(); expect(await stable()).toBe(armed);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 3 }));
  await expect.poll(reading).not.toBeNull();
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 1 }));
  await expect.poll(reading).toBeNull(); expect(await stable()).toBe(armed);
  const picked = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').rewardChoiceArmedId);
  await click('reward-card-take-hit');
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('BattleScene').upgradeChoices.length);
  expect(await page.evaluate(id => (window as any).__birdSquadGame.scene.getScene('BattleScene').allDeckCards().some((c: any) => c.id === id && c.upgraded), picked)).toBe(true);
  expect(errors).toEqual([]);
});

test('normal reward catalog keeps long rules bounded and previews every kind of Preen change', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene'); await w.__birdSquadEnsureScene('CodexScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererModule && b.hand.length && b.combatIntroElapsedMs > 0 && !b.combatIntroActive;
  });
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.mode = 'upgradeReward'; b.upgradeChoices = b.hand.slice(0, 3); b.controllerChoiceIndex = 0; b.renderAll();
  });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('reward-preen-change')));
  const result = await page.evaluate(() => {
    const g = (window as any).__birdSquadGame, b = g.scene.getScene('BattleScene');
    const renderer = b.battleRewardRendererModule;
    let context: any;
    // Capture the normal scene contract once, then exercise the presenter without
    // queuing asset loads or animation loops for hundreds of synthetic choices.
    b.battleRewardRendererModule = { ...renderer, renderRewardCeremony: (value: any) => { context = value; return { glowBursts: 0 }; } };
    try { b.renderRewardCeremony(); } finally { b.battleRewardRendererModule = renderer; }
    const geometry = (o: any) => ({ x: o.x, y: o.y, width: o.displayWidth, height: o.displayHeight });
    b.root.removeAll(true); b.battleHandRendererModule.renderCombatRewardLoading(b);
    const loading = {
      read: b.root.list.filter((o: any) => o.name === 'reward-loading-inspect-slot').map(geometry),
      select: b.root.list.filter((o: any) => o.name === 'reward-loading-select-slot').map(geometry),
      interactive: b.root.list.filter((o: any) => o.input?.enabled).length,
    };
    b.root.removeAll(true); renderer.renderRewardCeremony({ ...context, reducedMotion: true, leanEffects: true });
    const ready = {
      read: b.root.list.filter((o: any) => o.name === 'reward-card-inspect-hit').map(geometry),
      select: b.root.list.filter((o: any) => o.name === 'reward-card-take-hit').map(geometry),
    };
    const failures: string[] = []; let count = 0;
    const render = (view: any, kind = 'upgrade') => {
      b.root.removeAll(true);
      renderer.renderRewardCeremony({ ...context, kind, cards: [{ ...view, focused: true }], reducedMotion: true, leanEffects: true });
    };
    for (const card of g.scene.getScene('CodexScene').allCards()) for (const mode of ['cardReward', 'upgradeReward']) for (const upgraded of [false, true]) {
      b.mode = mode; const view = b.rewardCardView({ ...card, upgraded }, 0);
      render(view, mode === 'cardReward' ? 'card' : 'upgrade');
      const effect = b.root.getByName('reward-card-effect'), panel = b.root.getByName('reward-card-effect-panel').getBounds();
      const bounds = effect.getBounds();
      if (effect.getData('fullText') !== view.summary || bounds.right > panel.right || bounds.bottom > panel.bottom
        || effect.style.fontSize !== '18px' || effect.getWrappedText().length > 4
        || (effect.text !== view.summary && !effect.text.endsWith('...'))) failures.push(`${card.id}/${mode}/${upgraded}/rules`);
      const ring = b.root.getByName('reward-input-focus-ring').getBounds();
      const read = b.root.getByName('reward-card-inspect-hit').getBounds(), take = b.root.getByName('reward-card-take-hit').getBounds();
      if (ring.bottom >= read.top || read.right >= take.left || read.height !== 58 || take.height !== 58) failures.push(`${card.id}/controls`);
      const change = b.root.getByName('reward-preen-change');
      if (change && (change.getBounds().bottom > 704 || change.width > 240 || change.getWrappedText().length > 3)) failures.push(`${card.id}/change`);
      count++;
    }
    b.mode = 'upgradeReward';
    const view = b.rewardCardView(b.upgradeChoices[0], 0);
    const base = { kind: 'preen', deckBefore: 10, before: 'Deal 5 damage.', after: 'Deal 5 damage.', moltBefore: '', moltAfter: '', statChanges: [] };
    const fixtures = [
      [{ after: 'Deal 7 damage.' }, 'Deal 5 damage → Deal 7 damage'],
      [{ moltBefore: 'Gain 2 Cover.', moltAfter: 'Gain 4 Cover.' }, 'Molt: Gain 2 Cover → Gain 4 Cover'],
      [{ after: 'Deal 5 damage. Draw 1 card.' }, 'Adds: Draw 1 card'],
      [{ before: 'Deal 5 damage. Clear this card.' }, 'Removes: Clear this card'],
      [{ statChanges: ['Cost 2 → 1'] }, 'Cost 2 → 1'],
      [{}, 'Rules unchanged'],
    ] as const;
    const previews = fixtures.map(([fixture, expected]) => {
      render({ ...view, decisionPreview: { ...base, ...fixture } });
      return { actual: b.root.getByName('reward-preen-change').getData('fullText'), expected };
    });
    render({ ...view, decisionPreview: { ...base, after: 'A long conditional upgrade description with enough words to exceed the preview rail. '.repeat(12) } });
    const long = b.root.getByName('reward-preen-change');
    const truncation = { ellipsis: long.text.endsWith('...'), preserved: long.getData('fullText').length > long.text.length, bottom: long.getBounds().bottom };
    b.renderAll();
    return { count, failures, previews, truncation, loading, ready };
  });
  expect(result.count).toBe(440); expect(result.failures).toEqual([]);
  expect(result.loading.interactive).toBe(0);
  expect(result.loading.read).toEqual(result.ready.read);
  expect(result.loading.select).toEqual(result.ready.select);
  result.previews.forEach(({ actual, expected }) => expect(actual).toBe(expected));
  expect(result.truncation).toEqual({ ellipsis: true, preserved: true, bottom: expect.any(Number) });
  expect(result.truncation.bottom).toBeLessThanOrEqual(704);
  expect(errors).toEqual([]);
});
