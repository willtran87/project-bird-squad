import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { installVirtualController, pressController } from './helpers/virtual-controller';

async function clickHandControl(page: Page, name: string) {
  const point = await page.evaluate(name => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const bounds = b.handLayer.getByName(name).getBounds();
    const canvas = b.game.canvas.getBoundingClientRect();
    return { x: canvas.left + bounds.centerX * canvas.width / 1280,
      y: canvas.top + bounds.centerY * canvas.height / 720 };
  }, name);
  await page.mouse.click(point.x, point.y);
  await settleCanvas(page);
}

for (const remapped of [false, true]) test(`large hands remain readable and page without playing, remapped=${remapped}`, async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await installVirtualController(page);
  if (remapped) await page.addInitScript(() => localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ next: 'KeyD', previous: 'KeyA' })));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => (window as any).__birdSquadEnsureScene);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.fxLayer?.active && b.battleHandRendererModule && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  const ids = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const originals = b.allDeckCards();
    // Deliberately exceeds ordinary hand sizes without changing balance data.
    b.hand = Array.from({ length: 17 }, (_, i) => ({ ...originals[i % originals.length], instanceId: `layout-hand-${i}` }));
    b.largeHandFixtureCards = [...b.hand];
    b.drawPile = []; b.discardPile = []; b.pendingRetainHand = 2;
    b.selectedInstanceId = undefined; b.handPage = 0; b.energy = 100; b.controllerChoiceIndex = 0;
    b.renderAll();
    // Direct fixture insertion bypasses drawCards(), which normally queues art.
    b.queueCardArtLoad(b.hand);
    return b.hand.map((c: any) => c.instanceId);
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return !b.battleRenderQueued && b.hand.every((card: any) => {
      const key = b.battleHandCardView(card).artKey;
      return key && b.textures.exists(key);
    });
  });
  const read = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const rects = [...b.handCardRects.values()].map((r: any) => r.getBounds());
    const scale = b.game.canvas.getBoundingClientRect().width / 1280;
    const controls = ['combat-hand-previous', 'combat-hand-next'].map(n => b.handLayer.getByName(n));
    const names = b.handLayer.list.filter((c: any) => c.name === 'combat-card-title' || c.name === 'combat-card-readable-summary');
    const roost = b.root.getByName('combat-roost-hit').getBounds();
    return { page: b.handPage, visible: [...b.handCardRects.keys()], count: b.hand.length,
      selected: b.selectedInstanceId ?? null, energy: b.energy, hp: b.enemies.map((e: any) => e.hp),
      unobscured: rects.every((r: any, i: number) => r.width === 180 && r.height === 270 && r.left >= 142 && r.right <= 1140
        && r.right + 4 <= roost.left && (i === 0 || rects[i - 1].right + 10 <= r.left)),
      typeReadable: names.every((n: any) => parseFloat(n.style.fontSize) * scale >= 16),
      targets: controls.every(c => c.width * scale >= 44 && c.height * scale >= 44),
      disabled: controls.filter(c => !c.getData('enabled')).every(c => !c.input?.enabled),
      description: b.getTextState().combatInputFocus.handPage,
      retained: b.retentionPlan().cards.map((c: any) => c.instanceId),
      artReady: b.hand.slice(b.handPage * 5, b.handPage * 5 + 5).every((card: any) => {
        const key = b.battleHandCardView(card).artKey;
        return key && b.textures.exists(key);
      }),
    };
  });
  const initial = await read();
  for (const [width, height] of [[2560,1600],[1440,900],[1000,560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    // Every page, including a partially filled final page, preserves full-size cards.
    for (let p = 0; p < 4; p++) {
      const state = await read();
      expect(state).toMatchObject({ page: p, count: 17, selected: null, energy: 100, unobscured: true,
        typeReadable: true, targets: true, disabled: true, artReady: true, hp: initial.hp, retained: initial.retained,
        description: { page: p + 1, pages: 4, first: p * 5 + 1, last: Math.min(17, p * 5 + 5) } });
      expect(state.visible).toEqual(ids.slice(p * 5, p * 5 + 5));
      await page.screenshot({ path: info.outputPath(`large-hand-${width}-${p + 1}.png`) });
      if (p < 3) await clickHandControl(page, 'combat-hand-next');
    }
    for (let p = 0; p < 3; p++) await clickHandControl(page, 'combat-hand-previous');
  }
  // Keyboard focus traverses the real hand; crossing a page never confirms it.
  for (let i = 0; i < 5; i++) { await page.keyboard.press(remapped ? 'd' : 'ArrowRight'); await settleCanvas(page); }
  expect(await read()).toMatchObject({ page: 1, selected: ids[5], energy: 100, hp: initial.hp });
  const inspect = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const panel = b.cardPreview.getBounds();
    const next = b.handLayer.getByName('combat-hand-next').getBounds();
    const draw = b.root.list.find((o: any) => o.name === 'combat-pile-hit').getBounds();
    const forecast = b.selectionOutcomePreview.getBounds();
    const hint = b.root.getByName('combat-input-hint').getBounds();
    return { separate: panel.top > next.bottom && panel.top >= draw.bottom + 2, contained: panel.bottom <= 720,
      clearHand: [...b.handCardRects.values()].every((r: any) => forecast.bottom < r.getBounds().top && hint.bottom < r.getBounds().top) };
  });
  expect(inspect).toEqual({ separate: true, contained: true, clearHand: true });
  await page.screenshot({ path: info.outputPath('large-hand-focused-1000.png') });
  await pressController(page, 14);
  expect(await read()).toMatchObject({ page: 0, selected: ids[4], energy: 100, hp: initial.hp });
  // Hidden hand controls cannot page beneath readers or system overlays.
  for (const flag of ['pauseOverlayOpen', 'settingsOverlayOpen', 'supplyDrawerOpen', 'waymarkDrawerOpen', 'combatAnimationPending']) {
    await page.evaluate(flag => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b[flag] = true; b.changeHandPage(1); b[flag] = false; }, flag);
    expect((await read()).page).toBe(0);
  }
  // A discard decision preserves selected ids while browsing other pages.
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.discardChoiceModule.beginDiscardChoice(b, 'Large hand fixture', 2, false, () => {});
    b.combatAnimationPending = true; // Discard interrupts a still-pending card animation.
    b.toggleDiscardChoice(b.hand[0].instanceId);
  });
  await settleCanvas(page);
  await clickHandControl(page, 'combat-hand-next');
  expect((await read()).page).toBe(1);
  const discard = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.toggleDiscardChoice(b.hand[5].instanceId);
    return b.discardChoice.selectedIds;
  });
  expect(discard).toEqual([ids[0], ids[5]]);
  await settleCanvas(page);
  await clickHandControl(page, 'combat-hand-previous');
  expect((await read()).page).toBe(0);
  // Reducing the hand clamps the page, removes paging controls, and restores inspection placement.
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.discardChoice = undefined; b.combatAnimationPending = false; b.selectedInstanceId = undefined; b.hand = b.hand.slice(0, 3); b.handPage = 3; b.renderAll();
  });
  expect(await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { page: b.handPage, visible: b.handCardRects.size, pager: Boolean(b.handLayer.getByName('combat-hand-next')) };
  })).toEqual({ page: 0, visible: 3, pager: false });
  // A real pointer selection on a later page still requires a separate commit.
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.hand = [...b.largeHandFixtureCards]; b.handPage = 0; b.pendingRetainHand = 0; b.renderAll();
  });
  await settleCanvas(page);
  await clickHandControl(page, 'combat-hand-next');
  const play = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const card = b.hand[5], r = b.handCardRects.get(card.instanceId).getBounds(), c = b.game.canvas.getBoundingClientRect();
    return { id: card.instanceId, played: b.cardsPlayedThisTurn,
      x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
  });
  await page.mouse.click(play.x, play.y); await settleCanvas(page);
  expect(await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { selected: b.selectedInstanceId, played: b.cardsPlayedThisTurn };
  })).toEqual({ selected: play.id, played: play.played });
  await page.keyboard.press('Enter');
  await page.waitForFunction(before => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return !b.combatAnimationPending && b.cardsPlayedThisTurn > before;
  }, play.played);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').cardsPlayedThisTurn)).toBe(play.played + 1);
  expect(errors).toEqual([]);
});
