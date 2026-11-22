import { test, expect } from '@playwright/test';

// An enemy "lose Wingbeat" resolves during the enemy phase, after the player's
// Wingbeats are already spent, so it must tax the NEXT player turn instead of
// being erased by the startPlayerTurn refill.
test('enemy loseWingbeat taxes the next player turn', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('birdsquad.combatPace', 'standard'));
  await page.goto('./');
  await page.waitForFunction(() => (window as any).__birdSquadEnsureScene);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.scene.isActive() && b.fxLayer?.active && b.hand?.length && !b.combatAnimationPending;
  });
  const setup = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.hand = []; b.flock.hp = b.flock.maxHp; b.flock.block = 0;
    const enemy = b.enemies[0];
    const move = { id: 'tax-test', label: 'Wing Tax', effects: ['loseWingbeat(1)'] };
    enemy.runtime = { ...enemy.runtime, moves: [move], attackPattern: { type: 'cycle', moveIds: [move.id] } };
    enemy.intentIndex = 0;
    b.enemies = [enemy];
    b.renderAll();
    const tell = b.root.list.find((o: any) => o.name === 'combat-enemy-intent-badge')?.getData('description');
    return { turn: b.turn, tell };
  });
  expect(setup.tell).toContain('next turn with 1 fewer Wingbeat');
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.endTurnAnimated();
  });
  await page.waitForFunction((turn) => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    if (b.turn <= turn) w.advanceTime?.(50);
    return b.turn > turn && !b.combatAnimationPending;
  }, setup.turn, { timeout: 20_000 });
  const after = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { energy: b.energy, bank: b.nextTurnEnergyBonus };
  });
  expect(after).toEqual({ energy: 2, bank: 0 });
  expect(errors).toEqual([]);
});
