import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { settleCanvas } from './helpers/settled-canvas';

// A deliberately losing player: ordinary Roost input, no scene jumps, state edits,
// damage overrides or mechanical fast-forward. Victory is covered separately.
test('reference flight reaches natural defeat and replay through live keyboard controls', async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./?flight=all-a-defeat&length=quick');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const g = (window as any).__birdSquadGame;
    return g.scene.isActive('RouteScene') && g.scene.getScene('RouteScene').routeEssentialAssetsReady;
  });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('RouteScene').shouldChooseDistrictContract());
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const g = (window as any).__birdSquadGame, b = g.scene.getScene('BattleScene');
    return g.scene.isActive('BattleScene') && b.hand.length && !b.combatIntroActive && !b.combatAnimationPending;
  });
  for (let step = 0; step < 40; step++) {
    const before = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return { mode: b.mode, turn: b.turn };
    });
    if (before.mode === 'defeat') break;
    expect(before.mode).toBe('battle');
    await page.keyboard.press('r');
    await page.waitForFunction(turn => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return b.mode === 'defeat' || (b.turn > turn && !b.combatAnimationPending);
    }, before.turn);
  }
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.mode === 'defeat' && b.root.getByName('run-outcome-command-hit');
  });
  const report = await page.evaluate(() => (window as any).__birdSquadLastRun);
  expect(report.result).toBe('loss');
  expect(report.seed).toBe('all-a-defeat');
  expect(report.currentCohesion).toBe(0);
  expect(report.turnsTaken).toBeGreaterThan(0);
  await writeFile(info.outputPath('natural-defeat-report.json'), JSON.stringify(report, null, 2));
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height });
    await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`defeat-${width}.png`) });
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const g = (window as any).__birdSquadGame;
    return !g.scene.isActive('BattleScene') || g.scene.getScene('BattleScene').mode !== 'defeat';
  });
  expect(errors).toEqual([]);
});
