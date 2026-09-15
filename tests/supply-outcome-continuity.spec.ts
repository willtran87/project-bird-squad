import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.discardChoiceModule && b.returnChoiceModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending;
  });
});

test('a lethal Supply finishes its entire sequence before opening rewards', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const result = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    // A boundary fixture, not a balance run: Storm Lantern deals damage before
    // paying Cohesion. Rewards must observe the cost and consumed inventory.
    b.enemies.forEach((e: any) => { e.hp = 1; e.block = 0; });
    b.flock.hp = 20; b.flock.weak = 0;
    b.runSupplies = ['storm_lantern'];
    const before = { turn: b.turn, energy: b.energy, used: b.runSuppliesUsed.length };
    const begin = b.beginPostCombatRewards;
    const boundaries: any[] = [];
    b.beginPostCombatRewards = function () {
      boundaries.push({ hp: this.flock.hp, supplies: [...this.runSupplies], used: [...this.runSuppliesUsed] });
      return begin.call(this);
    };
    try { b.useSupply(0); b.useSupply(0); }
    finally { b.beginPostCombatRewards = begin; }
    return { mode: b.mode, turn: b.turn, energy: b.energy, hp: b.flock.hp, before,
      enemies: b.enemies.map((e: any) => e.hp), supplies: b.runSupplies,
      used: b.runSuppliesUsed.length, boundaries };
  });
  expect(result.enemies.every((hp: number) => hp === 0)).toBe(true);
  expect(result.mode).not.toBe('battle');
  expect(result.turn).toBe(result.before.turn);
  expect(result.energy).toBe(result.before.energy + 2);
  expect(result.hp).toBe(17);
  expect(result.supplies).toEqual([]);
  expect(result.used).toBe(result.before.used + 1);
  expect(result.boundaries).toEqual([{ hp: 17, supplies: [], used: expect.arrayContaining(['storm_lantern']) }]);
  expect(errors).toEqual([]);
});

test('repeated interactive Supplies check outcomes only after all choices and triggers', async ({ page }) => {
  const result = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const base = b.hand[0];
    b.hand = [];
    b.discardPile = [0, 1, 2].map(n => ({ ...base, type: 'minor', instanceId: `return-${n}` }));
    b.drawPile = [0, 1].map(n => ({ ...base, instanceId: `draw-${n}` }));
    b.routeMarks = ['supply_bell']; b.markFiredThisCombat = new Set();
    b.runSupplies = ['return_ticket', 'return_ticket'];
    b.runSuppliesUsed = []; b.pendingSupplyRepeats = 1;
    const energy = b.energy, outcome = b.checkOutcome;
    const boundaries: any[] = [];
    b.checkOutcome = function () {
      boundaries.push({ hand: this.hand.length, energy: this.energy, repeats: this.pendingSupplyRepeats, supplies: [...this.runSupplies], choice: Boolean(this.returnChoice) });
      return outcome.call(this);
    };
    const snapshot = () => ({ calls: boundaries.length, hand: b.hand.length, supplies: b.runSupplies.length,
      source: b.returnChoice?.source, used: b.runSuppliesUsed.length });
    let first, second, attempted;
    try {
      b.useSupply(0); first = snapshot();
      b.useSupply(1); attempted = snapshot(); // Another Supply cannot interrupt.
      b.chooseReturnCard('return-0'); second = snapshot();
      b.chooseReturnCard('return-1');
    } finally { b.checkOutcome = outcome; }
    return { first, attempted, second, final: snapshot(), boundaries, energy, mode: b.mode };
  });
  expect(result.first).toMatchObject({ calls: 0, hand: 0, supplies: 2, used: 0 });
  expect(result.attempted).toEqual(result.first);
  expect(result.second).toMatchObject({ calls: 0, hand: 2, supplies: 2, used: 0 });
  expect(result.final).toMatchObject({ calls: 1, hand: 5, supplies: 1, used: 1 });
  expect(result.boundaries).toEqual([{ hand: 5, energy: result.energy, repeats: 1, supplies: ['return_ticket'], choice: false }]);
  expect(result.mode).toBe('battle');
});

test('a confirmed lethal Supply moves directly from its drawer to rewards', async ({ page }, info) => {
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.enemies.forEach((e: any) => { e.hp = 1; e.block = 0; });
    b.runSupplies = ['bottlecap_popper']; b.renderAll();
  });
  await page.keyboard.press('x');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('supply-drawer-item-0'));
  const read = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { mode: b.mode, supplies: [...b.runSupplies], armed: b.supplyDrawerArmedIndex, turn: b.turn, drawer: b.supplyDrawerOpen };
  });
  const before = await read();
  await page.keyboard.press('Enter'); await settleCanvas(page);
  expect((await read()).armed).toBe(0);
  expect((await read()).supplies).toEqual(before.supplies);
  await page.keyboard.press('Enter'); await settleCanvas(page);
  const after = await read();
  expect(after.mode).toBe('cardReward'); expect(after.supplies).toEqual([]);
  expect(after.drawer).toBe(false); expect(after.turn).toBe(before.turn);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').rewardPresentationReady());
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`supply-victory-${width}.png`) });
  }
});
