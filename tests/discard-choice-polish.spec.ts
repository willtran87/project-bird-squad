import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

for (const remapped of [false, true]) test(`discard decisions are readable and explicit, remapped=${remapped}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  if (remapped) await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({
    confirm: 'KeyK', back: 'KeyQ', previous: 'KeyA', next: 'KeyD', roost: 'Backspace',
  })));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.discardChoiceModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending;
  });
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.runSupplies = ['mirror_shard']; b.useSupply(0);
  });
  const state = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const hint = b.root.getByName('combat-discard-choice-hint'), prompt = b.root.getByName('combat-discard-choice-prompt');
    const hit = b.root.getByName('combat-discard-confirm'), rail = b.root.getByName('combat-discard-choice-rail');
    return { choice: b.discardChoice && { ids: b.discardChoice.candidateIds, selected: b.discardChoice.selectedIds },
      hand: b.hand.length, turn: b.turn, supplies: [...b.runSupplies], hint: hint?.text,
      roost: b.root.getByName('combat-roost-hit')?.visible,
      promptSize: prompt?.style.fontSize, hintSize: hint?.style.fontSize,
      hintRight: hint?.getBounds().right, buttonLeft: hit?.getBounds().left,
      targetHeight: hit?.height * b.game.canvas.getBoundingClientRect().height / 720,
      handTop: Math.min(...[...b.handCardRects.values()].map((o: any) => o.getBounds().top)),
      railBottom: rail?.getBounds().bottom };
  });
  await settleCanvas(page);
  const initial = await state();
  const press = async (key: string) => { await page.keyboard.press(key); await settleCanvas(page); };
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    await press('Shift');
    const keyboard = await state();
    expect(keyboard.hint).toContain(remapped ? 'A/D: choose · K: toggle · Backspace: confirm' : 'Left/Right: choose · Enter: toggle · R: confirm');
    expect(keyboard.promptSize).toBe('20px'); expect(keyboard.hintSize).toBe('18px');
    expect(keyboard.hintRight).toBeLessThan(keyboard.buttonLeft - 12);
    expect(keyboard.targetHeight).toBeGreaterThanOrEqual(44);
    expect(keyboard.railBottom).toBeLessThanOrEqual(keyboard.handTop - 8);
    expect(keyboard.roost).toBe(false);
    await page.screenshot({ path: info.outputPath(`discard-${width}.png`) });
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 10 }));
    expect((await state()).hint).toContain('D-pad: choose · A: toggle · Y: confirm');
    expect((await state()).choice?.selected).toEqual([]);
  }
  await press(remapped ? 'q' : 'Escape'); // Required choices cannot be cancelled.
  expect((await state()).choice).toEqual(initial.choice);
  await press(remapped ? 'Backspace' : 'r'); // Too few selected: no mutation.
  expect((await state()).supplies).toEqual(['mirror_shard']);
  const cardPoint = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const r = b.handCardRects.get(b.discardChoice.candidateIds[0]).getBounds(), c = b.game.canvas.getBoundingClientRect();
    return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
  });
  await page.mouse.click(cardPoint.x, cardPoint.y); await settleCanvas(page);
  expect((await state()).choice?.selected).toHaveLength(1);
  expect((await state()).hint).toContain('Tap cards to toggle');
  const tag = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const tags = b.handLayer.list.filter((o: any) => o.name === 'combat-discard-choice-tag' && o.type === 'Text');
    return { count: tags.length, text: tags[0]?.text, right: tags[0]?.getBounds().right,
      nextLeft: b.handCardLeft(1) };
  });
  expect(tag.count).toBe(1); expect(tag.text).toBe('Drop 1');
  expect(tag.right).toBeLessThan(tag.nextLeft - 6);
  await page.screenshot({ path: info.outputPath('discard-pointer-selected.png') });
  await page.mouse.click(cardPoint.x, cardPoint.y); await settleCanvas(page);
  expect((await state()).choice?.selected).toHaveLength(0);
  await press(remapped ? 'k' : 'Enter');
  expect((await state()).choice?.selected).toHaveLength(1);
  expect((await state()).supplies).toEqual(['mirror_shard']);
  const p = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const r = b.root.getByName('combat-discard-confirm').getBounds(), c = b.game.canvas.getBoundingClientRect();
    return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
  });
  await page.mouse.click(p.x, p.y); await settleCanvas(page);
  const final = await state();
  expect(final.choice).toBeUndefined(); expect(final.supplies).toEqual([]);
  expect(final.hand).toBe(initial.hand - 1); expect(final.turn).toBe(initial.turn); expect(final.roost).toBe(true);
  // Optional selection uses the same lane but can keep the complete hand.
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.beginDiscardChoice('Optional hand fix', 2, true, (count: number) => { b.polishDiscarded = count; });
  });
  await press('Shift');
  expect((await state()).hint).toContain(remapped ? 'Q: keep hand' : 'Esc: keep hand');
  expect((await state()).hintRight).toBeLessThan((await state()).buttonLeft - 12);
  await press(remapped ? 'q' : 'Escape');
  expect((await state()).hand).toBe(final.hand);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').polishDiscarded)).toBe(0);
  expect(errors).toEqual([]);
});
