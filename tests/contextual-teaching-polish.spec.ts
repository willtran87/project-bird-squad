import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('Roost lesson yields to card decisions, restores on Back and retires after Roost', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    // Begin at the already-taught first-card checkpoint; progress is test-local.
    const progress = { enabled: true, completed: false, routeCommits: 1, cardsPlayed: 1, roosts: 0, rewardsResolved: 0 };
    localStorage.setItem('birdsquad.firstFlightGuide', JSON.stringify(progress));
    localStorage.setItem('birdsquad.firstFlightGuide.backup', JSON.stringify(progress));
    await w.__birdSquadEnsureScene('BattleScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.hand?.length && b.fxLayer?.active && b.battleHudRendererModule
      && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  const read = () => page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const lesson = b.root.list.filter((o: any) => o.getData('deferToCard'));
    return { count: lesson.length, visible: lesson.every((o: any) => o.visible), hidden: lesson.every((o: any) => !o.visible),
      stateVisible: JSON.parse(w.render_game_to_text()).firstCombatGuidance.rendered,
      cards: b.statCardsPlayed, hp: b.flock.hp, energy: b.energy, turn: b.turn,
      roost: b.root.getByName('combat-roost-hit')?.listenerCount('pointerdown') };
  });
  const before = await read();
  expect(before.count).toBe(2); expect(before.visible).toBe(true); expect(before.stateVisible).toBe(true);
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    const point = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const rect = b.handCardRects.get(b.hand[0].instanceId).getBounds(), canvas = b.game.canvas.getBoundingClientRect();
      return { x: canvas.left + rect.centerX * canvas.width / 1280, y: canvas.top + rect.centerY * canvas.height / 720 };
    });
    await page.mouse.click(point.x, point.y);
    const focused = await read();
    expect(focused.hidden).toBe(true); expect(focused.stateVisible).toBe(false); expect(focused.roost).toBe(1);
    expect([focused.cards, focused.hp, focused.energy, focused.turn]).toEqual([before.cards, before.hp, before.energy, before.turn]);
    await page.screenshot({ path: info.outputPath(`focused-${width}.png`) });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return !b.selectedInstanceId && !b.battleRenderQueued;
    });
    const restored = await read();
    expect(restored.visible).toBe(true); expect(restored.stateVisible).toBe(true);
  }
  await page.keyboard.press('r');
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.turn > 1 && !b.combatAnimationPending;
  });
  expect((await read()).count).toBe(0);
  // Lesson retirement survives browser reload and a fresh battle; it must not
  // reappear just because the presentation layer or scene was reconstructed.
  await page.reload();
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.hand?.length && b.fxLayer?.active && b.battleHudRendererModule
      && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  expect((await read()).count).toBe(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.firstFlightGuide')!));
  expect(saved.roosts).toBe(1);
  expect(errors).toEqual([]);
});
