import { test, expect } from '@playwright/test';
import { flockLeaders } from '../src/game/leaders';
import { resolveScriptedBattle } from './helpers/scripted-battle';
import { writeFile } from 'node:fs/promises';

// Explicit deck fixtures measure mechanical choices, not acquisition rates or
// human enjoyment. Full seeded progression remains a separate release gate.
const plans = {
  lean: ['wands_ace', 'swords_ace', 'cups_fledgling', 'pentacles_04', 'pentacles_fledgling', 'major_00'],
  wide: ['major_00', 'wands_ace', 'wands_fledgling', 'swords_ace', 'swords_fledgling', 'cups_ace', 'cups_fledgling', 'pentacles_04', 'pentacles_fledgling', 'aviary_25', 'wands_02', 'swords_02', 'cups_02', 'pentacles_02'],
  molt: ['aviary_25', 'wands_ace', 'wands_fledgling', 'swords_ace', 'cups_ace', 'cups_fledgling', 'pentacles_04', 'pentacles_fledgling'],
};
for (const leader of flockLeaders) for (const [plan, ids] of Object.entries(plans)) {
  test(`strategy audit: ${leader.id} ${plan} resolves opening, rival and boss without loops`, async ({ page }, info) => {
    test.setTimeout(180000);
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('./');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    await page.evaluate(leader => { const m = (window as any).__birdSquadGame.scene.getScene('MenuScene'); m.selectedLeaderId = leader; m.startRun(); }, leader.id);
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
    const base = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState)));
    const results: any[] = [];
    for (const stage of ['opening', 'rival', 'boss']) {
      await page.evaluate(({ base, ids, stage, plan }) => {
        const g = (window as any).__birdSquadGame;
        for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key);
        g.scene.start('RouteScene', { runState: { ...base, seed: `strategy-${plan}-${stage}`, currentRouteNodeId: undefined,
          mapIndex: stage === 'opening' ? 0 : stage === 'rival' ? 1 : 3,
          deck: ids.map(id => ({ id, upgraded: stage !== 'opening' })) } });
      }, { base, ids, stage, plan });
      await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
      await page.evaluate(stage => {
        const w = window as any, g = w.__birdSquadGame, r = g.scene.getScene('RouteScene'), map = w.__birdSquadCurrentMap();
        const node = stage === 'opening' ? map.nodes.find((n: any) => n.id === map.entryNodeId)
          : stage === 'boss' ? map.nodes.find((n: any) => n.id === map.bossNodeId)
            : map.nodes.find((n: any) => n.type === 'rival');
        if (!node) throw new Error(`Missing authored ${stage} fixture`);
        const runState = JSON.parse(JSON.stringify(r.runState));
        r.scene.start('BattleScene', { runState, routeNodeId: node.id });
      }, stage);
      await page.waitForFunction(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); return b.fxLayer?.active && b.combatPreviewModule && b.discardChoiceModule && b.returnChoiceModule && !b.combatIntroActive && !b.combatAnimationPending; });
      const result = await page.evaluate(resolveScriptedBattle, plan === 'molt' ? 'balanced' : plan === 'lean' ? 'pressure' : 'sheltered');
      expect(result.mode, JSON.stringify(result)).not.toBe('battle');
      expect(Number.isFinite(result.hp)).toBe(true);
      expect(result.decisions.length).toBeGreaterThan(0);
      results.push({ stage, ...result });
    }
    // Each plan must be usable in the opening; later defeats are evidence for
    // comparison, not silently converted into wins or a speculative balance fix.
    expect(results[0].mode, JSON.stringify(results[0])).not.toBe('defeat');
    const report = JSON.stringify({ leader: leader.id, plan, cards: ids, results }, null, 2);
    await writeFile(info.outputPath('strategy.json'), report); await info.attach('strategy', { body: report, contentType: 'application/json' });
    expect(errors).toEqual([]);
  });
}

test('warm route and battle transitions keep textures and menu listeners bounded', async ({ page }, info) => {
  test.setTimeout(180000);
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  const runState = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState)));
  const samples: any[] = [];
  for (let iteration = 0; iteration < 8; iteration++) {
    await page.evaluate(runState => {
      const g = (window as any).__birdSquadGame;
      for (const scene of g.scene.getScenes(true)) g.scene.stop(scene.scene.key);
      g.scene.start('BattleScene', { runState, routeNodeId: 'm1_entry' });
    }, runState);
    await page.waitForFunction(() => { const s = JSON.parse((window as any).render_game_to_text()); return s.scene === 'BattleScene' && s.assetReadiness?.fullArt && !s.combatIntro?.active; });
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').scene.start('MenuScene'));
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).titleBoot?.ready);
    samples.push(await page.evaluate(() => {
      const g = (window as any).__birdSquadGame, m = g.scene.getScene('MenuScene'), b = g.scene.getScene('BattleScene');
      return { textures: Object.keys(g.textures.list).length, objects: m.children.length,
        keys: m.input.keyboard.eventNames().reduce((n: number, key: string) => n + m.input.keyboard.listenerCount(key), 0),
        controller: m.input.gamepad.listenerCount('down'), battleObjects: b.children.length,
        battleTimers: b.time._active.length + b.time._pendingInsertion.length + b.time._pendingRemoval.length };
    }));
  }
  for (const sample of samples.slice(3)) {
    expect(sample.keys).toBe(samples[3].keys); expect(sample.controller).toBe(samples[3].controller);
    expect(sample.textures).toBeLessThanOrEqual(samples[3].textures + 2);
    expect(sample.objects).toBeLessThanOrEqual(samples[3].objects + 2);
    expect(sample.battleObjects).toBe(0); expect(sample.battleTimers).toBe(0);
  }
  await writeFile(info.outputPath('lifetime.json'), JSON.stringify(samples, null, 2));
});
