import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { sanitizeRewardCheckpoint } from '../src/game/reward-checkpoint';

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  await info.attach('reward-recovery-failure', { contentType: 'application/json', body: JSON.stringify(await page.evaluate(() => ({
    state: (window as any).render_game_to_text?.(), saved: localStorage.getItem('birdsquad.run.active'),
  })).catch(() => ({ state: 'page unavailable' }))) });
});

test('reward save sanitation rejects malformed stages and filters unknown content', () => {
  expect(sanitizeRewardCheckpoint({ version: 1, nodeId: 'm1_boss', stage: 'cardReward', choices: ['missing'] }, () => false, () => false)).toBeUndefined();
  expect(sanitizeRewardCheckpoint({ version: 2, nodeId: 'm1_boss', stage: 'route' }, () => true, () => true)).toBeUndefined();
  expect(sanitizeRewardCheckpoint({ version: 1, nodeId: 'm1_boss', stage: 'cardReward', choices: ['yes', 'yes', 'no'], claims: [{ id: 'yes', receipt: 'once' }] }, id => id === 'yes', () => false))
    .toMatchObject({ choices: ['yes'], claims: [{ id: 'yes', receipt: 'once' }], scrapAwarded: 0 });
  for (const claims of [null, [null], [{ id: 'missing', receipt: 'once' }], [{ id: 'yes', receipt: '' }], Array(201).fill({ id: 'yes', receipt: 'once' })]) {
    expect(sanitizeRewardCheckpoint({ version: 1, nodeId: 'm1_boss', stage: 'route', claims }, id => id === 'yes', () => false)).toBeUndefined();
  }
});

async function title(page: Page) {
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
}
async function ready(page: Page) {
  await page.waitForFunction(() => {
    const g = (window as any).__birdSquadGame;
    if (!g?.scene.isActive('BattleScene')) return false;
    const b = g.scene.getScene('BattleScene');
    return b.fxLayer?.active && !b.combatIntroActive && !b.battleRenderQueued && b.rewardPresentationReady();
  });
  await settleCanvas(page);
}
async function setupBossReward(page: Page) {
  await page.goto('./?flight=durable-rewards&length=quick'); await title(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.evaluate(() => {
    const g = (window as any).__birdSquadGame;
    const r = g.scene.getScene('RouteScene');
    r.scene.start('BattleScene', { routeNodeId: 'm1_boss', runState: r.runState });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.fxLayer?.active && !b.combatIntroActive && !b.combatAnimationPending;
  });
  // Fixture the outcome, not the reward pipeline or persistence. Live-control
  // full flights are verified separately in reference-input-paths.spec.ts.
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.flock.hp = 19; b.statTaken = 7; b.turn = 4;
    b.enemies.forEach((e: any) => { e.hp = 0; }); b.checkOutcome();
  });
  await ready(page);
}
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { mode: b.mode, hp: b.flock.hp, scrap: b.scrap, marks: b.routeMarks,
      deck: b.allDeckCards().map((c: any) => ({ id: c.id, upgraded: !!c.upgraded })).sort((a: any, z: any) => a.id.localeCompare(z.id)),
      choices: (b.mode === 'waymarkReward' ? b.waymarkChoices : b.mode === 'cardReward' ? b.rewardChoices : b.upgradeChoices).map((c: any) => c.id),
      events: JSON.parse(JSON.stringify(b.runRewardEvents)), saved: JSON.parse(localStorage.getItem('birdsquad.run.active')!) };
  });
}

test('a malformed reward claim journal recovers the complete backup transaction', async ({ page }) => {
  await setupBossReward(page);
  const before = await snapshot(page);
  await page.evaluate(() => {
    const key = 'birdsquad.run.active';
    const value = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key + '.backup', JSON.stringify(value));
    value.pendingCombatReward.claims = [{ id: 'major_00', receipt: '' }];
    localStorage.setItem(key, JSON.stringify(value));
  });
  await page.reload(); await title(page); await page.keyboard.press('Enter'); await ready(page);
  const after = await snapshot(page);
  expect(after.saved.pendingCombatReward).toEqual(before.saved.pendingCombatReward);
  expect(after.deck).toEqual(before.deck);
  expect(after.choices).toEqual(before.choices);
  expect(after.hp).toBe(before.hp);
  expect(after.scrap).toBe(before.scrap);
});

test('resuming final boss rewards retains actual final-fight turns for records and achievements', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('./?flight=final-reward-resume&length=quick'); await title(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.scene.start('BattleScene', { routeNodeId: 'm4_boss', runState: { ...r.runState, mapIndex: 3 } });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.fxLayer?.active && !b.combatIntroActive && !b.combatAnimationPending;
  });
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.turn = 9; b.enemies.forEach((e: any) => { e.hp = 0; }); b.checkOutcome();
  });
  await ready(page);
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    if (b.mode === 'waymarkReward') b.chooseWaymarkReward(b.waymarkChoices[0].id);
    if (b.mode === 'cardReward') b.chooseRewardCard(b.rewardChoices[0].id);
  });
  await ready(page);
  expect((await snapshot(page)).mode).toBe('upgradeReward');
  await page.reload(); await title(page); await page.keyboard.press('Enter'); await ready(page);
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.chooseUpgradeCard(b.upgradeChoices[0].id);
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').mode === 'runComplete');
  const result = await page.evaluate(() => ({ summary: (window as any).__birdSquadLastRun,
    account: JSON.parse(localStorage.getItem('birdsquad.account')!), active: localStorage.getItem('birdsquad.run.active') }));
  expect(result.summary.turnsTaken).toBe(9);
  expect(result.account.fastestWinTurns).toBe(9);
  expect(result.account.achievements).not.toContain('swift_wings');
  expect(result.active).toBeNull();
});

test('a failed committed Preen retries on Resume without a second upgrade or reward', async ({ page }) => {
  test.setTimeout(90000);
  await setupBossReward(page);
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.chooseWaymarkReward(b.waymarkChoices[0].id);
    const id = b.rewardChoices[0].id;
    b.chooseRewardCard(id); b.chooseRewardCard(id); // A stale second callback is inert.
  });
  await ready(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).__restoreRewardStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function(k, v) {
      if (k.startsWith('birdsquad.run.active')) throw new DOMException('Full storage fixture', 'QuotaExceededError');
      original.call(this, k, v);
    };
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const id = b.upgradeChoices[0].id;
    b.chooseUpgradeCard(id); b.chooseUpgradeCard(id);
    b.setBattlePaused(false); // Still failing: keep the warning and live scene.
  });
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').pauseOverlayOpen)).toBe(true);
  // A reward/Preen may change Cohesion. Recovery must add exactly one HP to
  // the committed deck's health, not assume every generated reward is neutral.
  const committed = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { hp: b.flock.hp, maxHp: b.flock.maxHp,
      deck: b.allDeckCards().map((c: any) => ({ id: c.id, upgraded: !!c.upgraded })).sort((a: any, z: any) => a.id.localeCompare(z.id)) };
  });
  await page.evaluate(() => {
    (window as any).__restoreRewardStorage();
    (window as any).__birdSquadGame.scene.getScene('BattleScene').setBattlePaused(false);
  });
  await page.waitForFunction(() => {
    const g = (window as any).__birdSquadGame;
    return g.scene.isActive('RouteScene') && g.scene.getScene('RouteScene').routeEssentialAssetsReady
      && !JSON.parse(localStorage.getItem('birdsquad.run.active')!).pendingCombatReward;
  });
  const run = await page.evaluate(() => JSON.parse(localStorage.getItem('birdsquad.run.active')!));
  expect(run.pendingCombatReward).toBeUndefined();
  expect(run.rewardEvents).toHaveLength(1);
  expect(run.currentHp).toBe(Math.min(committed.maxHp, committed.hp + 1));
  expect(run.deck.map((c: any) => ({ id: c.id, upgraded: !!c.upgraded })).sort((a: any, z: any) => a.id.localeCompare(z.id))).toEqual(committed.deck);
  expect(run.combatResults).toHaveLength(1);
});

test('reload at every boss reward step preserves choices, health, rewards and exactly-once collection claims', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await setupBossReward(page);
  let claimed = '';
  let recoveredHp = 0;
  for (const stage of ['waymarkReward', 'cardReward', 'upgradeReward']) {
    const before = await snapshot(page);
    expect(before.mode).toBe(stage);
    expect(before.saved.pendingCombatReward.stage).toBe(stage);
    await page.reload(); await title(page);
    await expect.poll(() => page.evaluate(() => JSON.parse((window as any).render_game_to_text()).resumeContext)).toContain('Rewards ready');
    await page.keyboard.press('Enter'); await ready(page);
    const after = await snapshot(page);
    expect({ ...after, saved: undefined }).toEqual({ ...before, saved: undefined });
    expect(after.saved.combatResults).toEqual(before.saved.combatResults);
    for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
      await page.setViewportSize({ width, height }); await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`${stage}-${width}.png`) });
    }
    const id = after.choices[0]; if (stage === 'cardReward') claimed = id;
    recoveredHp = await page.evaluate(({ stage, id }) => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      if (stage === 'waymarkReward') b.chooseWaymarkReward(id);
      else if (stage === 'cardReward') b.chooseRewardCard(id);
      else b.chooseUpgradeCard(id);
      return Math.min(b.flock.maxHp, b.flock.hp + 1);
    }, { stage, id });
    if (stage !== 'upgradeReward') await ready(page);
  }
  await page.waitForFunction(() => {
    const g = (window as any).__birdSquadGame;
    return g.scene.isActive('RouteScene') && g.scene.getScene('RouteScene').routeEssentialAssetsReady
      && !JSON.parse(localStorage.getItem('birdsquad.run.active')!).pendingCombatReward;
  });
  const result = await page.evaluate(id => {
    const run = JSON.parse(localStorage.getItem('birdsquad.run.active')!);
    return { run, count: JSON.parse(localStorage.getItem('birdsquad.account')!).cardCollection[id].timesClaimed };
  }, claimed);
  expect(result.run.pendingCombatReward).toBeUndefined();
  expect(result.run.currentHp).toBe(recoveredHp); // One recovery point after the chosen card/Preen's Cohesion change.
  expect(result.run.rewardEvents.filter((e: any) => e.picked === claimed)).toHaveLength(1);
  expect(result.run.combatResults).toHaveLength(1);
  expect(result.run.combatResults[0].turnsTaken).toBe(4);
  expect(result.count).toBe(1);
  expect(errors).toEqual([]);
});

for (const blockedKey of ['birdsquad.run.active', 'birdsquad.account']) test(`reward interruption retains the pending step when ${blockedKey} cannot be written`, async ({ page }, info) => {
  test.setTimeout(90000);
  await setupBossReward(page);
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.chooseWaymarkReward(b.waymarkChoices[0].id);
  });
  await ready(page);
  const cardId = (await snapshot(page)).choices[0];
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    (window as any).__restoreRewardStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (k, v) {
      if (k.startsWith(key)) throw new DOMException('Full storage fixture', 'QuotaExceededError');
      original.call(this, k, v);
    };
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.chooseRewardCard(b.rewardChoices[0].id);
  }, blockedKey);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').pauseSaveFailed);
  expect((await snapshot(page)).mode).toBe('upgradeReward');
  await page.setViewportSize({ width: 2560, height: 1600 }); await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('reward-save-failed.png') });
  await page.evaluate(() => (window as any).__restoreRewardStorage());
  const p = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const hit = b.systemOverlayLayer.list.find((o: any) => o.getData?.('label') === 'Main Menu');
    const r = hit.getBounds(), c = b.game.canvas.getBoundingClientRect();
    return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
  });
  await page.mouse.click(p.x, p.y); await title(page);
  await page.keyboard.press('Enter'); await ready(page);
  expect((await snapshot(page)).mode).toBe('upgradeReward');
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem('birdsquad.account')!).cardCollection[id].timesClaimed, cardId)).toBe(1);
  await page.reload(); await title(page); await page.keyboard.press('Enter'); await ready(page);
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem('birdsquad.account')!).cardCollection[id].timesClaimed, cardId)).toBe(1);
});
