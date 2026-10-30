import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

const sizes = [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }];
async function battle(page: Page) {
  await page.goto('./?flight=motion-acceptance&length=full');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => { const g = (window as any).__birdSquadGame, r = g.scene.getScene('RouteScene'); return g.scene.isActive('RouteScene') && r.routeEssentialAssetsReady && r.openFlyway; });
  await page.evaluate(() => {
    const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene'), run = structuredClone(r.runState);
    const node = w.__birdSquadCurrentMap().nodes.find((n: any) => n.type === 'street');
    r.scene.start('BattleScene', { runState: run, routeNodeId: node.id });
  });
  await page.waitForFunction(() => { const g = (window as any).__birdSquadGame, b = g.scene.getScene('BattleScene'); return g.scene.isActive('BattleScene') && b.identityPacing && b.combatPreviewModule && b.discardChoiceModule && b.returnChoiceModule && b.fxLayer?.active && !b.combatIntroActive && !b.combatAnimationPending; });
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const e: string[] = []; errors.set(page, e); page.on('pageerror', error => e.push(error.message)); });
test.afterEach(async ({ page }) => { try { expect(errors.get(page)).toEqual([]); } finally { await page.goto('about:blank'); } });

test('Flock Motion observed contributions count resolved effects and exclude overkill, overheal and invalid plays', async ({ page }, info) => {
  await battle(page);
  const result = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const cards = b.allDeckCards(), first = cards.find((c: any) => c.id === 'major_00'), heal = cards.find((c: any) => c.id === 'cups_ace');
    // Keep another living enemy so the overkill boundary does not end this fixture.
    const extra = structuredClone(b.enemies[0]); extra.id += '-fixture'; extra.hp = extra.maxHp = 100; b.enemies.push(extra);
    b.enemies[0].hp = 2; b.enemies[0].block = 0; b.energy = 50;
    b.hand = [first, heal]; b.drawPile = []; b.discardPile = [];
    const coverBefore = b.flock.block;
    b.playCard(first, b.enemies[0].id);
    const firstRow = structuredClone(b.cardContributions.find((r: any) => r.cardId === first.id));
    b.playCard(first, extra.id); // The removed card cannot resolve twice.
    const playsAfterInvalid = b.cardContributions.find((r: any) => r.cardId === first.id).plays;
    b.flock.hp = b.flock.maxHp; b.playCard(heal, extra.id);
    const healRow = structuredClone(b.cardContributions.find((r: any) => r.cardId === heal.id));
    return { firstRow, healRow, cover: b.flock.block - coverBefore, playsAfterInvalid, state: b.getTextState().cardContributions };
  });
  expect(result.firstRow.damage).toBe(2); expect(result.firstRow.cover).toBe(result.cover);
  expect(result.firstRow.drawn).toBe(0); expect(result.firstRow.plays).toBe(1); expect(result.playsAfterInvalid).toBe(1);
  expect(result.healRow.healing).toBe(0); expect(result.healRow.plays).toBe(1);
  expect(result.state).toEqual([result.firstRow, result.healRow]);
  await info.attach('observed-effects', { body: JSON.stringify(result), contentType: 'application/json' });
});

test('Flock Motion contributions survive reward checkpoints and reload without duplicate attribution', async ({ page }, info) => {
  await battle(page);
  const before = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), card = b.allDeckCards().find((c: any) => c.id === 'major_00');
    b.hand = [card]; b.energy = 10; b.enemies.forEach((e: any) => { e.hp = 1; e.block = 0; }); b.playCard(card);
    return structuredClone(b.cardContributions);
  });
  await page.waitForFunction(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); return b.mode === 'cardReward' && b.rewardPresentationReady(); });
  const reading = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.openRewardCardInspection(b.rewardChoices[0].id); b.renderAll();
    const texts: string[] = [], p = b.cardPreview; const pages = p.getData('reading').total;
    for (let i = 0; i < pages; i++) { const r = p.getData('reading'); if (r.title === 'OBSERVED THIS FLIGHT') texts.push(r.text); p.getData('turnRulesPage')(1); }
    b.closeRewardCardInspection(); return texts.join('\n');
  });
  expect(reading).toContain('First Flight'); expect(reading).toContain('1 play'); expect(reading).toContain('1 damage');
  expect(reading).toContain('including Leader');
  await page.reload(); await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').continueRun());
  await page.waitForFunction(() => { const g = (window as any).__birdSquadGame, b = g.scene.getScene('BattleScene'); return g.scene.isActive('BattleScene') && b.mode === 'cardReward' && b.rewardPresentationReady(); });
  const after = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    const entries = b.runCombatResults.filter((r: any) => r.cardContributions?.length);
    b.emitRunSummary('loss');
    return { entries: entries.map((r: any) => r.cardContributions), live: b.cardContributions, summary: (window as any).__birdSquadLastRun.combatResults.filter((r: any) => r.cardContributions?.length).map((r: any) => r.cardContributions) };
  });
  expect(after.entries).toEqual([before]); expect(after.live).toEqual([]); expect(after.summary).toEqual([before]);
  await info.attach('checkpoint-contributions', { body: JSON.stringify({ before, after }), contentType: 'application/json' });
});

test('Flock Motion five canonical action styles are bounded and reduced motion keeps still cues', async ({ page }, info) => {
  await battle(page); await page.setViewportSize(sizes[0]); await settleCanvas(page);
  for (const [id, style] of [['swords_ace', 'swoop'], ['major_00', 'shove'], ['pentacles_fledgling', 'shelter'], ['wands_fledgling', 'rally'], ['cups_ace', 'retreat']]) {
    await page.evaluate(id => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.queueCardArtLoad([b.allDeckCards().find((c: any) => c.id === id)]); }, id);
    await page.waitForFunction(id => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); return !!b.battleHandCardView(b.allDeckCards().find((c: any) => c.id === id)).preview.artKey; }, id);
    const actor = await page.evaluate(({ id }) => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), card = b.allDeckCards().find((c: any) => c.id === id);
      if (!card) throw Error(`Missing representative ${id}`);
      b.hand = [card, ...b.hand.filter((c: any) => c.id !== id)].slice(0, 5); b.energy = 99; b.enemies[0].hp = b.enemies[0].maxHp = 1000; b.renderAll();
      const audioBefore = (window as any).__birdSquadAudio().cueRequests.card ?? 0;
      b.playCard(card, b.enemies[0].id, { resolveDelayMs: 800 });
      const a = b.fxLayer.getByName('combat-card-cast-ghost'), start = { x: a.x, y: a.y };
      (window as any).advanceTime(280); b.time.paused = true; b.tweens.pauseAll();
      return { state: b.getTextState().cardAction, art: a.list.find((o: any) => o.name === 'flock-action-canonical-art')?.texture.key, children: a.list.length, count: b.fxLayer.list.filter((o: any) => o.name === a.name).length, moved: Math.hypot(a.x - start.x, a.y - start.y), sound: (window as any).__birdSquadAudio().cueRequests.card - audioBefore };
    }, { id });
    expect(actor.state).toEqual({ style, cardId: id, reducedMotion: false }); expect(actor.art).toBeTruthy(); expect(actor.children).toBeLessThanOrEqual(4); expect(actor.count).toBe(1); expect(actor.moved).toBeGreaterThan(0); expect(actor.sound).toBe(1);
    await page.screenshot({ path: info.outputPath(`action-${style}-2560.png`) });
    await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.time.paused = false; b.tweens.resumeAll(); (window as any).advanceTime(1000); });
    await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('BattleScene').combatAnimationPending);
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').fxLayer.getByName('combat-card-cast-ghost')?.active ?? false)).toBe(false);
  }
  const reduced = await page.evaluate(() => {
    localStorage.setItem('birdsquad.motionPreference', 'reduced');
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), card = b.allDeckCards().find((c: any) => c.id === 'major_00');
    b.combatFxModule.playFlockAction(b, card, b.enemies[0].id, b.activeCardContract(card), 200);
    const actor = b.fxLayer.getByName('combat-card-cast-ghost');
    return { reduced: actor.getData('reducedMotion'), tweens: b.tweens.getTweensOf(actor).length };
  });
  expect(reduced).toEqual({ reduced: true, tweens: 0 });
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').scene.stop());
  await expect(page.locator('#identity-sequence')).toHaveCount(0);
});

test('Flock Motion inspection during a cast is read only and resumes current forecasts after settlement', async ({ page }, info) => {
  await battle(page);
  const initial = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), first = b.hand[0], next = b.hand[1];
    b.energy = 99; b.enemies[0].hp = b.enemies[0].maxHp = 1000;
    b.playCard(first, b.enemies[0].id, { resolveDelayMs: 1800 });
    b.onCardClicked(next.instanceId); b.openCombatCardDetail(next);
    return { id: next.instanceId, energy: b.energy, hand: b.hand.length, hp: b.enemies[0].hp, detail: b.combatCardDetail?.active, selected: b.selectedInstanceId, forecast: b.selectedCardOutcomePreview(), name: next.name };
  });
  expect(initial.detail).toBe(true); expect(initial.selected).toBe(initial.id); expect(initial.forecast).toBeUndefined();
  const inspection = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), p = b.combatCardDetail;
    p.getData('changePage')(1);
    b.playCard(b.hand.find((c: any) => c.instanceId === b.selectedInstanceId));
    return { body: p.getData('body'), energy: b.energy, hand: b.hand.length, hp: b.enemies[0].hp };
  });
  expect(inspection.body).toContain('An action is resolving'); expect(inspection.energy).toBe(initial.energy); expect(inspection.hand).toBe(initial.hand); expect(inspection.hp).toBe(initial.hp);
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('BattleScene').combatAnimationPending);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active)).toBe(true);
  await page.setViewportSize(sizes[0]); await page.screenshot({ path: info.outputPath('cast-inspection-2560.png') });
  await page.keyboard.press('Escape'); await page.keyboard.press('h');
  await expect.poll(() => page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active)).toBe(true);
  const body = await page.evaluate(() => { const p = (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail; return p.getData('pages').filter((page: any) => page.heading === 'PLAY NOW · OUTCOME').map((page: any) => page.body).join('\n'); });
  expect(body).toContain('Card-only forecast'); expect(body).not.toContain('An action is resolving');
});

test('Flock Motion fixed hand grid, HUD and resolved feedback fit all supported sizes', async ({ page }, info) => {
  await battle(page);
  const grid = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return [1, 2, 3, 4, 5].map(count => Array.from({ length: count }, (_, i) => b.handCardLeft(i, count)));
  });
  for (const row of grid) expect(row).toEqual(grid[4].slice(0, row.length));
  await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.energy = 99; b.enemies[0].hp = b.enemies[0].maxHp = 1000;
    b.playCard(b.hand[0]); b.motionPayoff.until = b.time.now + 60000;
  });
  await expect(page.locator('#identity-sequence')).toContainText('Resolved:');
  for (const size of sizes) {
    await page.setViewportSize(size); await settleCanvas(page);
    expect(await page.locator('#identity-sequence').evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    const layout = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const wing = b.root.getByName('hud-value-Wingbeats'), scrap = b.root.getByName('hud-value-Scrap');
      const rects = [...b.handCardRects.values()].map((r: any) => r.getBounds());
      return { wingSize: Number.parseFloat(wing.style.fontSize), scrapSize: Number.parseFloat(scrap.style.fontSize), handFits: rects.every((r: any) => r.left >= 160 && r.right <= 1110 && r.bottom <= 720), overlaps: rects.some((r: any, i: number) => rects.some((o: any, j: number) => i !== j && r.left < o.right && r.right > o.left)) };
    });
    expect(layout.wingSize).toBeGreaterThan(layout.scrapSize); expect(layout.handFits).toBe(true); expect(layout.overlaps).toBe(false);
    await page.screenshot({ path: info.outputPath(`resolved-hud-${size.width}.png`) });
  }
  await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.selectedInstanceId = undefined; b.onCardClicked(b.hand[0].instanceId); });
  await expect(page.locator('#identity-sequence')).toBeHidden();
  await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.flock.hp = 0; b.checkOutcome(); b.renderAll(); });
  await expect(page.locator('#flyway-launch')).toBeVisible();
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').openOutcomeFlightDetails());
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('run-flight-details-section-body'));
  await expect(page.locator('#flyway-launch')).toBeHidden();
  await page.keyboard.press('j'); await expect(page.locator('#flyway-book')).toHaveCount(0);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').closeOutcomeFlightDetails());
  await expect(page.locator('#flyway-launch')).toBeVisible();
});

test('Flock Motion familiar attacks shorten preparation while preserving impact holds and cinematic timing', async ({ page }, info) => {
  await battle(page);
  const timings = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), e = b.enemies[0], move = e.runtime.moves[0];
    localStorage.setItem('birdsquad.combatPace', 'standard'); localStorage.setItem('birdsquad.motionPreference', 'full');
    const first = b.combatFxModule.enemyMoveTimings(b, e, move); b.runSeenEnemyMoves.add(b.enemyMovePacingKey(e, move));
    const scale = b.enemyMoveTimingScale(e, move), repeat = b.combatFxModule.enemyMoveTimings(b, e, move);
    const old = { windup: b.combatTimingDelay(1800, scale), release: b.combatTimingDelay(550, scale), impact: b.combatTimingDelay(650, scale), recovery: b.combatTimingDelay(240, scale) };
    localStorage.setItem('birdsquad.combatPace', 'cinematic'); const cinematic = b.combatFxModule.enemyMoveTimings(b, e, move);
    return { first, repeat, old, cinematic };
  });
  expect(timings.repeat.windup).toBeLessThan(timings.old.windup); expect(timings.repeat.release).toBeLessThan(timings.old.release);
  expect(timings.repeat.impact).toBe(timings.old.impact); expect(timings.repeat.recovery).toBe(timings.old.recovery);
  expect(timings.first.windup).toBeGreaterThan(timings.repeat.windup); expect(timings.cinematic.windup).toBe(2600); expect(timings.cinematic.impact).toBe(1350);
  await info.attach('timing-comparison', { body: JSON.stringify(timings), contentType: 'application/json' });
});
