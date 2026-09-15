import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

for (const mode of ['runComplete', 'defeat']) test(`quiet outcome surface: ${mode}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    w.__birdSquadGame.scene.stop('MenuScene');
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.flock && b.fxLayer?.active && !b.combatIntroActive && !b.combatAnimationPending;
  });
  await page.evaluate(mode => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.completedRouteNodeIds = ['won-combat', 'visited-cache'];
    b.runCombatResults = [{ nodeId: 'won-combat' }, { nodeId: 'lost-combat' }];
    b.retireCombatFxForOutcome(); b.mode = mode; b.renderAll();
  }, mode);
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.bossDossierModule && b.textures.exists('ui-icon-run-outcome-crest');
  });
  for (const unlocks of [false, true]) {
    await page.evaluate(unlocks => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      b.outcomeUnlockHighlights = () => unlocks ? [{ id: 'test', name: 'A New Flight', kind: 'record', description: 'Personal record' }] : [];
      b.renderAll();
    }, unlocks);
    for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size); await settleCanvas(page);
      const metrics = await page.evaluate(() => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        const nodes = b.root.list, scale = b.game.canvas.getBoundingClientRect().height / 720;
        const labels = nodes.filter((n: any) => n.name === 'run-outcome-stat-label');
        const values = nodes.filter((n: any) => n.name === 'run-outcome-stat-value');
        const hits = nodes.filter((n: any) => n.name === 'run-outcome-command-hit');
        const commands = nodes.filter((n: any) => n.name === 'run-outcome-command-label');
        const goal = nodes.find((n: any) => n.name === 'leader-mastery-next-goal');
        const copy = nodes.find((n: any) => n.name === 'run-outcome-flight-link-label');
        const copyHit = nodes.find((n: any) => n.name === 'run-outcome-flight-link-hit');
        return {
          gaps: labels.map((n: any, i: number) => values[i].getBounds().left - n.getBounds().right),
          labelFonts: labels.map((n: any) => n.style.fontSize),
          cleared: values[1].text,
          targetHeights: hits.map((n: any) => n.height * scale),
          commandsContained: commands.every((n: any, i: number) => n.getBounds().left >= hits[i].getBounds().left && n.getBounds().right <= hits[i].getBounds().right),
          goal: { bottom: goal.getBounds().bottom, top: goal.getBounds().top, font: goal.style.fontSize },
          copy: { text: copy.text, font: copy.style.fontSize, height: copyHit.height * scale, gap: Math.min(...hits.map((n: any) => n.getBounds().top)) - copyHit.getBounds().bottom },
          frames: nodes.filter((n: any) => /run-outcome-(stat-row-frame|command-frame|report-frame|title-plaque)/.test(n.texture?.key ?? '')).length,
          unlock: nodes.filter((n: any) => /run-outcome-unlock-(icon|heading|names)$/.test(n.name)).map((n: any) => ({ left: n.getBounds().left, right: n.getBounds().right, top: n.getBounds().top, bottom: n.getBounds().bottom })),
        };
      });
      expect(metrics.frames).toBe(0); expect(metrics.gaps).toHaveLength(3);
      expect(metrics.unlock).toHaveLength(unlocks ? 3 : 0);
      metrics.unlock.forEach((bounds: any) => { expect(bounds.left).toBeGreaterThanOrEqual(546); expect(bounds.right).toBeLessThanOrEqual(984); expect(bounds.top).toBeGreaterThanOrEqual(243); expect(bounds.bottom).toBeLessThanOrEqual(297); });
      metrics.gaps.forEach((gap: number) => expect(gap).toBeGreaterThan(12));
      expect(metrics.labelFonts).toEqual(['20px', '20px', '20px']);
      expect(metrics.cleared).toBe('1');
      metrics.targetHeights.forEach((height: number) => expect(height).toBeGreaterThanOrEqual(44));
      expect(metrics.commandsContained).toBe(true);
      expect(metrics.goal.font).toBe('16px'); expect(metrics.goal.top).toBeGreaterThan(615); expect(metrics.goal.bottom).toBeLessThan(667);
      expect(metrics.copy.text).toBe('COPY SEEDED FLIGHT'); expect(metrics.copy.font).toBe('18px');
      expect(metrics.copy.height).toBeGreaterThanOrEqual(44); expect(metrics.copy.gap).toBeGreaterThanOrEqual(8);
      await page.screenshot({ path: info.outputPath(`${mode}-${unlocks ? 'unlock' : 'plain'}-${size.width}.png`) });
    }
  }
  expect(errors).toEqual([]);
});
