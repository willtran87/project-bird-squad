import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

async function clickObject(page: Page, name: string, instanceId?: string) {
  const point = await page.evaluate(({ name, instanceId }) => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const o = b.root.list.find((o: any) => o.name === name && (!instanceId || o.getData('instanceId') === instanceId));
    const r = o.getBounds(), canvas = b.game.canvas.getBoundingClientRect();
    return { x: canvas.left + r.centerX * canvas.width / 1280, y: canvas.top + r.centerY * canvas.height / 720 };
  }, { name, instanceId });
  await page.mouse.click(point.x, point.y);
  await settleCanvas(page);
}

test('return reader exposes every discard and all rules without accidental commitment', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.returnChoiceModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const base = b.hand[0];
    b.discardPile = Array.from({ length: 10 }, (_, i) => {
      const name = i === 9 ? 'An unusually long route memory with its complete printed identity preserved' : `Route memory ${i + 1}`;
      const effects = i === 9 ? Array.from({ length: 42 }, (_, n) => `gainCover(${n + 1})`) : ['gainCover(3)'];
      return { ...base, id: `reader-${i}`, instanceId: `reader-${i}`, name, type: 'minor', upgraded: false,
        runtime: { ...base.runtime, displayName: name, effects, heldEffects: [], moltEffects: [], cost: 1, role: 'guard' } };
    });
    b.readerResolved = 0;
    b.beginReturnChoice('Route Recall', 'nonMolt', 0, () => { b.readerResolved += 1; });
    b.renderAll();
  });
  const snapshot = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const text = b.root.getByName('combat-return-choice-summary');
    const bounds = text?.getBounds();
    return { focused: b.returnChoice?.candidateIds[b.returnChoice.focusIndex], resolved: b.readerResolved,
      page: text?.getData('page'), pages: text?.getData('pages'), full: text?.getData('fullText'), text: text?.text,
      bounds: bounds && { x: bounds.x, right: bounds.right, bottom: bounds.bottom },
      bodySize: text?.style.fontSize,
      touchTargets: b.root.list.filter((o: any) => o.name?.startsWith('combat-return-') && o.input?.enabled)
        .every((o: any) => o.displayHeight * b.game.canvas.getBoundingClientRect().height / 720 >= 44),
      hint: b.root.getByName('combat-return-choice-hint')?.text, discard: b.discardPile.length };
  });
  const before = await snapshot();
  await expect.poll(() => page.locator('#game-status').textContent()).toContain('Browsing does not commit.');
  expect(before.pages).toBeGreaterThan(1);
  expect(before.full).toContain('42');
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height });
    await settleCanvas(page);
    const state = await snapshot();
    expect(state.bounds!.right).toBeLessThanOrEqual(1140);
    expect(state.bounds!.bottom).toBeLessThan(485);
    expect(state.bodySize).toBe('22px');
    expect(state.touchTargets).toBe(true);
    await page.screenshot({ path: info.outputPath(`return-reader-${width}.png`) });
  }
  // Paging must never return a card, including keyboard and controller paths.
  await page.keyboard.press('Tab');
  await settleCanvas(page);
  await expect.poll(async () => (await snapshot()).page).toBe(1);
  expect((await snapshot()).hint).toContain('Tab/Shift+Tab');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').renderAll());
  await settleCanvas(page);
  expect((await snapshot()).page).toBe(1);
  await page.keyboard.press('Shift+Tab');
  await settleCanvas(page);
  await expect.poll(async () => (await snapshot()).page).toBe(0);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 5 }));
  expect((await snapshot()).page).toBe(1);
  expect((await snapshot()).hint).toContain('LB/RB');
  await clickObject(page, 'combat-return-rules-previous');
  expect((await snapshot()).page).toBe(0);
  const seen: string[] = [];
  for (let i = 0; i < before.pages; i += 1) {
    seen.push((await snapshot()).text);
    await clickObject(page, 'combat-return-rules-next');
  }
  expect(seen.join(' ').replace(/\s+/g, ' ')).toBe(before.full.replace(/\s+/g, ' '));
  await page.keyboard.press('Escape');
  expect((await snapshot()).resolved).toBe(0);
  for (let i = 0; i < 9; i += 1) await clickObject(page, 'combat-return-choice-next');
  expect((await snapshot()).focused).toBe('reader-0');
  expect((await snapshot()).discard).toBe(10);
  await clickObject(page, 'combat-return-choice-row', 'reader-2');
  expect((await snapshot()).focused).toBe('reader-2');
  expect((await snapshot()).resolved).toBe(0);
  await page.screenshot({ path: info.outputPath('return-reader-selected.png') });
  await clickObject(page, 'combat-return-choice-confirm');
  await expect.poll(async () => (await snapshot()).resolved).toBe(1);
  expect((await snapshot()).discard).toBe(9);
  // The visible confirm object may predate the next queued render. It must
  // commit current focus, not the card captured when that object was drawn.
  const rapid = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.beginReturnChoice('Rapid return', 'nonMolt', 0, () => { b.readerResolved += 1; });
    b.renderAll();
    const confirm = b.root.getByName('combat-return-choice-confirm');
    b.root.list.find((o: any) => o.name === 'combat-return-choice-row' && o.getData('instanceId') === 'reader-8').emit('pointerdown');
    confirm.emit('pointerdown');
    return { hand: b.hand.map((c: any) => c.instanceId), resolved: b.readerResolved };
  });
  expect(rapid.resolved).toBe(2);
  expect(rapid.hand).toContain('reader-8');
  expect(rapid.hand).not.toContain('reader-9');
  expect(errors).toEqual([]);
});
