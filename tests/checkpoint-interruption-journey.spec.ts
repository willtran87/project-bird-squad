import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

for (const exit of ['reload', 'Main Menu']) test(`${exit} during a paused live fight restores the advertised route checkpoint without spending twice`, async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./?flight=checkpoint-live-controls&length=quick');
  const title = () => page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  const route = () => page.waitForFunction(() => {
    const g = (window as any).__birdSquadGame;
    return g.scene.isActive('RouteScene') && g.scene.getScene('RouteScene').routeEssentialAssetsReady;
  });
  const battle = () => page.waitForFunction(() => {
    const g = (window as any).__birdSquadGame;
    if (!g.scene.isActive('BattleScene')) return false;
    const b = g.scene.getScene('BattleScene');
    return b.hand?.length && b.fxLayer?.active && !b.combatIntroActive && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  await title(); await page.keyboard.press('Enter'); await route(); await settleCanvas(page);
  const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.run.active')!));
  await page.keyboard.press('Enter'); await battle(); await settleCanvas(page);
  const initial = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { hand: b.hand.map((c: any) => c.id), hp: b.flock.hp, energy: b.energy, enemies: b.enemies.map((e: any) => ({ id: e.id, hp: e.hp })) };
  });
  await page.keyboard.press('1'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.statCardsPlayed === 1 && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  await page.keyboard.press('r');
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.turn === 2 && !b.combatAnimationPending && !b.battleRenderQueued;
  });
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').flock.hp)).toBeLessThan(initial.hp);
  const persistent = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => /^birdsquad\.account(?:\.|$)/.test(key))));
  await page.keyboard.press('p');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').pauseOverlayOpen);
  const paused = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ turn: b.turn, hand: b.hand, energy: b.energy, hp: b.flock.hp, enemies: b.enemies });
  });
  await page.keyboard.press('r');
  expect(await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ turn: b.turn, hand: b.hand, energy: b.energy, hp: b.flock.hp, enemies: b.enemies });
  })).toBe(paused);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.run.active')!))).toEqual(checkpoint);
  if (exit === 'reload') await page.reload();
  else {
    await settleCanvas(page);
    const p = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const hit = b.systemOverlayLayer.list.find((o: any) => o.getData?.('label') === 'Main Menu');
      const r = hit.getBounds(), c = b.game.canvas.getBoundingClientRect();
      return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
    });
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('MenuScene'));
  }
  await title();
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`continue-${width}.png`) });
  }
  await page.keyboard.press('Enter'); await route(); await settleCanvas(page);
  const resumed = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState);
  expect(resumed.districtContracts).toEqual(checkpoint.districtContracts.map((contract: any) => ({
    ...contract, completed: Boolean(contract.completed), celebrated: Boolean(contract.celebrated), rewardClaimed: Boolean(contract.rewardClaimed),
  })));
  for (const field of ['runMode', 'nextCombat', 'supplies', 'supplySlots', 'routeMarks', 'freePreenNextDistrict', 'scrapEarned', 'scrapSpent']) {
    expect(resumed[field], `restored ${field}`).toEqual(checkpoint[field]);
  }
  expect(await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    return { hp: r.runState.currentHp, scrap: r.runState.scrap, deck: r.runState.deck, completed: r.runState.completedRouteNodeIds };
  })).toEqual({ hp: checkpoint.currentHp, scrap: checkpoint.scrap,
    // Save sanitation makes the implicit base-card flag explicit on resume.
    deck: checkpoint.deck.map((card: any) => ({ ...card, upgraded: Boolean(card.upgraded) })),
    completed: checkpoint.completedRouteNodeIds });
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => /^birdsquad\.account(?:\.|$)/.test(key))))).toEqual(persistent);
  await page.keyboard.press('Enter'); await battle(); await settleCanvas(page);
  expect(await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { hand: b.hand.map((c: any) => c.id), hp: b.flock.hp, energy: b.energy, enemies: b.enemies.map((e: any) => ({ id: e.id, hp: e.hp })) };
  })).toEqual(initial);
  expect(errors).toEqual([]);
});
