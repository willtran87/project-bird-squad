import { test, expect } from '@playwright/test';

test('fallback catalog retains bounded identity, rules and controls without ceremony assets', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/assets/render-reward-*.js', route => route.abort('failed'));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('CodexScene');
    await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleHandRendererModule && b.hand.length && b.combatIntroElapsedMs > 0 && !b.combatIntroActive && !b.cameras.main.fadeEffect.isRunning;
  });
  const result = await page.evaluate(() => {
    const g = (window as any).__birdSquadGame, b = g.scene.getScene('BattleScene');
    const failures: string[] = []; let count = 0;
    b.battleInputActive = true; b.controllerChoiceIndex = 0;
    b.battleRewardRendererFailed = true;
    const cards = g.scene.getScene('CodexScene').allCards();
    for (const card of cards) for (const mode of ['cardReward', 'upgradeReward']) for (const upgraded of [false, true]) {
      b.mode = mode; b.rewardChoices = [{ ...card, upgraded }]; b.upgradeChoices = b.rewardChoices;
      b.root.removeAll(true);
      // Exercise the lean presenter directly; no queued catalog-wide asset loads.
      b.battleHandRendererModule.renderCombatRewardFallback(b);
      const view = b.rewardCardView(b.rewardChoices[0], 0);
      for (const [name, full, right, bottom] of [
        ['reward-fallback-choice-name', view.name, 454, 334],
        ['reward-fallback-effect', view.summary, 454, 502],
      ] as const) {
        const o = b.root.getByName(name), r = o.getBounds();
        if (o.getData('fullText') !== full || r.right > right || r.bottom > bottom || o.style.resolution !== 2
          || (o.text !== full && !o.text.endsWith('...'))) failures.push(`${card.id}/${mode}/${upgraded}/${name}`);
      }
      const context = b.root.getByName('reward-fallback-decision-context');
      if (context.getBounds().bottom > 546 || context.getBounds().right > 454) failures.push(`${card.id}/context`);
      const ring = b.root.getByName('reward-input-focus-ring').getBounds();
      const read = b.root.getByName('reward-card-inspect-hit').getBounds();
      const take = b.root.getByName('reward-card-take-hit').getBounds();
      if (read.height < 58 || take.height < 58 || read.right >= take.left || ring.bottom >= read.top) failures.push(`${card.id}/controls`);
      count++;
    }
    // An unavailable texture must not reach Phaser's native missing-image frame.
    const original = b.rewardCardView;
    b.rewardCardView = function (...args: any[]) { return { ...original.apply(this, args), artKey: 'unavailable-catalog-art' }; };
    b.root.removeAll(true); b.battleHandRendererModule.renderCombatRewardFallback(b);
    const missingArtSafe = !b.root.getByName('reward-fallback-card-art') && Boolean(b.root.getByName('reward-fallback-art-identity'));
    // Keep the missing-art fixture through async repaint and screenshot; this
    // isolated browser context is disposed by Playwright after the scenario.
    b.renderAll();
    return { count, failures, missingArtSafe };
  });
  expect(result.count).toBe(440);
  expect(result.failures).toEqual([]);
  expect(result.missingArtSafe).toBe(true);
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('BattleScene').root.getByName('reward-fallback-art-identity')));
  await page.screenshot({ path: info.outputPath('missing-art-readable-identity.png') });
  expect(errors).toEqual([]);
});
