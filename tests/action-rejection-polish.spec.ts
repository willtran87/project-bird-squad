import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

for (const reduced of [false, true]) test(`unaffordable card feedback is bounded and non-mutating, reduced=${reduced}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); return b.battleFxPresenterModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending && !b.cameras.main.fadeEffect.isRunning; });
  const multiTarget = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const o = b.simulateCardOutcome(b.hand[0], b.enemies[0].id);
    o.contract = { ...o.contract, target: 'allEnemies' };
    o.enemyDamage = 9;
    o.enemyStates = [
      { id: 'a', hpBefore: 8, hpAfter: 3, maxHp: 8, blockBefore: 0, blockAfter: 0, defeated: false },
      { id: 'b', hpBefore: 4, hpAfter: 0, maxHp: 4, blockBefore: 0, blockAfter: 0, defeated: true },
    ];
    return b.battleHudRendererModule.formatBattleSelectionOutcome('Sweep', 'a', '', 0, o);
  });
  expect(multiTarget.target).toBe('All enemies');
  expect(multiTarget.summary).toContain('9 total damage / 1 defeated');
  const pick = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.energy = 0; b.renderAll();
    const index = b.hand.findIndex((c: any) => b.effectiveCost(c) > 0), card = b.hand[index];
    const r = b.handCardRects.get(card.instanceId).getBounds(), c = b.game.canvas.getBoundingClientRect();
    return { index, id: card.instanceId, missing: b.effectiveCost(card), x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
  });
  const stable = () => page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return JSON.stringify({ hand: b.hand, energy: b.energy, hp: b.flock.hp, enemies: b.enemies, pending: b.combatAnimationPending, turn: b.turn, history: b.combatHistory });
  });
  await settleCanvas(page); const before = await stable();
  await page.mouse.move(pick.x, pick.y); await settleCanvas(page);
  await page.waitForFunction(id => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); return b.input.hitTestPointer(b.input.activePointer).includes(b.handCardRects.get(id)); }, pick.id);
  // Observe transient feedback before input; a slow runner can miss its bounded
  // display window while awaiting a later canvas frame or screenshot.
  await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    w.rejectionEvidence = { announcements: [] as string[], summaries: [] as string[] };
    const observer = new MutationObserver(() => w.rejectionEvidence.announcements.push(document.querySelector('#game-status')?.textContent ?? ''));
    observer.observe(document.querySelector('#game-status')!, { childList: true, characterData: true, subtree: true });
    const capture = () => {
      const notice = b.fxLayer.getByName('combat-action-rejection');
      if (notice) w.rejectionEvidence.summaries.push(notice.getData('summary'));
    };
    b.events.on('postupdate', capture);
    w.stopRejectionEvidence = () => { observer.disconnect(); b.events.off('postupdate', capture); };
  });
  await page.mouse.click(pick.x, pick.y);
  await expect.poll(() => page.evaluate(() => (window as any).rejectionEvidence.announcements.join(' '))).toContain(`Needs ${pick.missing} more Wingbeat`);
  await expect.poll(() => page.evaluate(() => (window as any).rejectionEvidence.summaries.join(' '))).toContain(`Needs ${pick.missing} more Wingbeat`);
  await page.evaluate(() => (window as any).stopRejectionEvidence());
  expect(await stable()).toBe(before);
  await page.evaluate(id => (window as any).__birdSquadGame.scene.getScene('BattleScene').onCardClicked(id), pick.id);
  await page.screenshot({ path: info.outputPath('rejection-2560.png') });
  await page.evaluate(pick => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.controllerChoiceIndex = pick.index; }, pick);
  await page.keyboard.press('Enter'); await settleCanvas(page);
  expect(await stable()).toBe(before);
  const count = await page.evaluate(id => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const cues = () => JSON.parse((window as any).render_game_to_text()).audio.cueRequests.locked ?? 0;
    b.onCardClicked(id); // Establish an active notice before testing repetition.
    const original = b.fxLayer.getByName('combat-action-rejection');
    const before = cues();
    for (let i = 0; i < 50; i++) b.onCardClicked(id);
    return { notices: b.fxLayer.list.filter((o: any) => o.name === 'combat-action-rejection').length, cues: cues() - before,
      sameNotice: original === b.fxLayer.getByName('combat-action-rejection') };
  }, pick.id);
  expect(count).toEqual({ notices: 1, cues: 0, sameNotice: true }); expect(await stable()).toBe(before);
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('BattleScene').fxLayer.getByName('combat-action-rejection'));
  await page.evaluate(id => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.onCardClicked(id); b.fxLayer.removeAll(true);
  }, pick.id);
  await settleCanvas(page); expect(errors).toEqual([]);
});

test('missing targets explain rejection without spending or queuing a card', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
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
    return b.battleFxPresenterModule && b.hand?.length && !b.combatIntroActive && !b.combatAnimationPending;
  });
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const card = b.hand.find((c: any) => b.activeCardContract(c).target === 'enemy');
    if (!card) throw new Error('Expected an enemy-target opening card');
    b.energy = 9;
    for (const enemy of b.enemies) enemy.hp = 0;
    const stable = () => JSON.stringify({ hand: b.hand, draw: b.drawPile, discard: b.discardPile,
      energy: b.energy, flock: b.flock, enemies: b.enemies, history: b.combatHistory,
      played: b.statCardsPlayed, pending: b.combatAnimationPending, turn: b.turn });
    const before = stable();
    b.playCard(card, 'expired-target');
    const notice = b.fxLayer.getByName('combat-action-rejection');
    const cueCount = () => w.__birdSquadState().audio?.cueRequests?.locked ?? 0;
    const cues = cueCount();
    for (let i = 0; i < 50; i++) b.playCard(card, 'expired-target');
    const result = { summary: notice?.getData('summary'), sameNotice: notice === b.fxLayer.getByName('combat-action-rejection'),
      unchanged: before === stable(), extraCues: cueCount() - cues };
    // Rejection owns no delayed play: restoring a target must not execute it.
    b.enemies[0].hp = b.enemies[0].maxHp;
    const restored = stable();
    w.advanceTime(3000);
    return { ...result, noQueuedPlay: stable() === restored,
      retired: !b.fxLayer.getByName('combat-action-rejection') };
  });
  expect(result).toEqual({ summary: 'No living enemy to target.', sameNotice: true,
    unchanged: true, extraCues: 0, noQueuedPlay: true, retired: true });
  expect(errors).toEqual([]);
});
