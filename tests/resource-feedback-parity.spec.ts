import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

for (const reduced of [false, true]) test(`Resonance feedback reports actual capped gains, reduced=${reduced}`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleFxPresenterModule && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending;
  });
  const cases = await page.evaluate(() => {
    const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene'), results = [];
    for (let before = 0; before <= 5; before++) for (const amount of [1, 2, 5, 8]) {
      w.advanceTime(1500); b.fxLayer.removeAll(true); b.spark = before;
      const bursts = b.combatResonanceSurgeBursts;
      b.gainResonance(amount);
      const label = b.fxLayer.list.find((o: any) => o.name === 'combat-number-feedback')?.getByName('combat-number-label');
      results.push({ before, amount, after: b.spark, label: label?.getData('fullText'),
        history: b.combatHistory.at(-1), turn: b.turn, burst: b.combatResonanceSurgeBursts - bursts });
    }
    return results;
  });
  for (const c of cases) {
    const gained = Math.min(5 - c.before, c.amount);
    expect(c.after).toBe(c.before + gained);
    expect(c.label).toBe(gained ? `+${gained} Resonance` : 'Resonance full');
    expect(c.history).toBe(`Beat ${c.turn} · ${gained ? `The flock gains ${gained} Resonance.` : 'Resonance is full.'}`);
    expect(c.burst).toBe(gained ? 1 : 0);
  }
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height }); await settleCanvas(page);
    for (const before of [4, 5]) {
      await page.evaluate(before => {
        const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
        b.time.paused = false; b.tweens.resumeAll(); w.advanceTime(1500); b.fxLayer.removeAll(true);
        b.spark = before; b.gainResonance(3); b.renderAll(); w.advanceTime(20);
        b.time.paused = true; b.tweens.pauseAll();
      }, before);
      await page.screenshot({ path: info.outputPath(`resonance-${before}-${width}.png`) });
    }
  }
  expect(errors).toEqual([]);
});
