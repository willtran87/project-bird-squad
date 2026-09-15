import { test, expect } from '@playwright/test';

for (const setting of [
  { pace: 'standard', animation: 'standard', reduced: false },
  { pace: 'snappy', animation: 'relaxed', reduced: false },
  { pace: 'cinematic', animation: 'fast', reduced: false },
  { pace: 'standard', animation: 'standard', reduced: true },
]) test(`card motion finishes before impact: ${JSON.stringify(setting)}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(setting => {
    localStorage.setItem('birdsquad.combatPace', setting.pace);
    localStorage.setItem('birdsquad.animationPace', setting.animation);
    localStorage.setItem('birdsquad.motionPreference', setting.reduced ? 'reduced' : 'full');
  }, setting);
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.hand.length && b.combatPreviewModule && !b.combatIntroActive && !b.combatAnimationPending && !b.cameras.main.fadeEffect.isRunning;
  });
  const start = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    const card = b.hand[0], enemy = b.enemies[0];
    w.castEvidence = { samples: [] as any[], before: enemy.hp, start: b.time.now };
    const record = () => w.castEvidence.samples.push({ elapsed: b.time.now - w.castEvidence.start,
      ghost: Boolean(b.fxLayer.getByName('combat-card-cast-ghost')), hp: enemy.hp, pending: b.combatAnimationPending });
    b.events.on('postupdate', record); w.recordCastEvidence = record; w.stopCastEvidence = () => b.events.off('postupdate', record);
    b.selectedInstanceId = card.instanceId; b.playCardAnimated(card, enemy.id);
    const ghost = b.fxLayer.getByName('combat-card-cast-ghost');
    const budget = ghost?.getData('budgetMs');
    w.advanceTime(60); record(); b.time.paused = true; b.tweens.pauseAll();
    return { ghost: Boolean(ghost), budget };
  });
  expect(start.ghost).toBe(!setting.reduced);
  await page.screenshot({ path: info.outputPath('cast-2560.png') });
  const result = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
    b.time.paused = false; b.tweens.resumeAll();
    for (let i = 0; i < 160 && b.combatAnimationPending; i++) { w.advanceTime(10); w.recordCastEvidence(); }
    const result = { ...w.castEvidence, ghost: Boolean(b.fxLayer.getByName('combat-card-cast-ghost')), pending: b.combatAnimationPending };
    w.stopCastEvidence(); return result;
  });
  const impact = result.samples.find((s: any) => s.hp < result.before);
  await info.attach('cast-timeline', { body: JSON.stringify(result), contentType: 'application/json' });
  expect(impact).toBeTruthy(); expect(impact.ghost).toBe(false);
  expect(result.ghost).toBe(false); expect(result.pending).toBe(false);
  expect(result.samples.filter((s: any) => s.hp < result.before).every((s: any) => !s.ghost)).toBe(true);
  await page.screenshot({ path: info.outputPath('settled-2560.png') });
  expect(errors).toEqual([]);
});
