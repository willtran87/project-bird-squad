import { test, expect } from '@playwright/test';
import { flockLeaders } from '../src/game/leaders';
import { settleCanvas } from './helpers/settled-canvas';

// A bounded scripted player, not human balance evidence. No damage, energy,
// hand, draw-order or enemy-state overrides: every action uses live controls.
for (const leader of flockLeaders) test(`starter combat control journey: ${leader.id}`, async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async leader => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene');
    const title = w.__birdSquadGame.scene.getScene('MenuScene');
    title.selectedLeaderId = leader.id;
    title.startRun();
  }, leader);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
  await page.evaluate(async () => {
    const w = window as any;
    const runState = { ...w.__birdSquadGame.scene.getScene('RouteScene').runState, seed: 'polish-starter-journey' };
    await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry', runState });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.hand?.length && b.combatPreviewModule && !b.combatAnimationPending && !b.combatIntroActive;
  });
  const actions: unknown[] = [];
  for (let step = 0; step < 60; step++) {
    const decision = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      if (b.mode !== 'battle') return { done: true, mode: b.mode, turn: b.turn };
      const candidates: any[] = [];
      const incoming = b.incomingFlockDamagePreview().hpLoss;
      const rate = (outcome: any) => outcome.enemyDamage + Math.min(incoming, outcome.coverGain) * 0.8
        + outcome.cohesionDelta * 0.7 + outcome.flowGain * 0.15;
      for (const card of b.hand) {
        const contract = b.activeCardContract(card);
        if (b.effectiveCost(card) > b.energy || contract.target === 'choice'
          || contract.effects.some((e: string) => /returnFromDiscard|discard\(/.test(e))) continue;
        for (const enemy of b.enemies.filter((e: any) => e.hp > 0)) {
          const outcome = b.simulateCardOutcome(card, enemy.id);
          if (outcome.requiresChoice) continue;
          let score = rate(outcome);
          if (contract.effects.includes('enterMolt()') && !b.flock.molt) {
            const playable = b.hand.filter((c: any) => c !== card && b.effectiveCost(c) <= b.energy);
            const normal = Math.max(0, ...playable.map((c: any) => rate(b.simulateCardOutcome(c, enemy.id))));
            // Forecast-only stance comparison; restore before sending any input.
            b.flock.molt = true;
            const molted = Math.max(0, ...playable.map((c: any) => rate(b.simulateCardOutcome(c, enemy.id))));
            b.flock.molt = false;
            score += Math.max(0, molted - normal);
          }
          if (score > 0) candidates.push({ card, enemy, score, target: contract.target });
        }
      }
      candidates.sort((a, z) => z.score - a.score);
      const pick = candidates[0];
      const canvas = b.game.canvas.getBoundingClientRect();
      const point = (x: number, y: number) => ({ x: canvas.left + x * canvas.width / 1280, y: canvas.top + y * canvas.height / 720 });
      if (!pick) return { done: false, action: 'roost', point: point(1192, 470), turn: b.turn };
      const rect = b.handCardRects.get(pick.card.instanceId).getBounds();
      const target = b.enemyHpBar(pick.enemy);
      return { done: false, action: 'card', card: pick.card.id, target: pick.target,
        instanceId: pick.card.instanceId, played: b.statCardsPlayed,
        point: point(rect.centerX, rect.centerY), enemy: point(target.x, target.y - 19), turn: b.turn };
    });
    actions.push(decision);
    if (decision.done) break;
    await page.mouse.click(decision.point!.x, decision.point!.y);
    if (decision.action === 'card') {
      await page.waitForFunction(id => (window as any).__birdSquadGame.scene.getScene('BattleScene').selectedInstanceId === id, decision.instanceId);
      if (decision.target === 'enemy') await page.mouse.click(decision.enemy!.x, decision.enemy!.y);
      else await page.keyboard.press('Enter');
    }
    await page.waitForFunction(decision => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return b.mode !== 'battle' || (decision.action === 'card'
        ? b.statCardsPlayed > decision.played! : b.turn > decision.turn!);
    }, decision);
    await page.waitForFunction(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return !b.combatAnimationPending && !b.battleRenderQueued;
    });
  }
  const result = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return { mode: b.mode, turn: b.turn, hp: b.flock.hp, pending: b.combatAnimationPending,
      choices: b.rewardChoices.map((c: any) => c.id) };
  });
  await info.attach('scripted-decisions', { body: JSON.stringify({ actions, result }, null, 2), contentType: 'application/json' });
  expect(result.pending).toBe(false);
  expect(Number.isFinite(result.hp)).toBe(true);
  expect(result.mode).not.toBe('battle');
  expect(errors).toEqual([]);
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return !['cardReward', 'waymarkReward', 'upgradeReward'].includes(b.mode) || b.rewardPresentationReady();
  });
  await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('result-1440.png') });
});
