import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

// No scene jumps, resource grants, damage overrides or mechanical fast-forward.
// This is a reproducible scripted player, not authentic player/balance evidence.
test('reference flight uses live controls from title through outcome and replay', async ({ page }, info) => {
  test.setTimeout(600000);
  page.setDefaultTimeout(20000);
  const errors: string[] = [], journey: any[] = [];
  const captured = new Set<string>();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./?flight=all-a-reference&length=quick');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  let terminal = '';
  let lastDecision = '', repeated = 0;
  for (let step = 0; step < 320 && !terminal; step++) {
    await page.waitForFunction(() => {
      const g = (window as any).__birdSquadGame;
      if (g.scene.isActive('RouteScene')) {
        const r = g.scene.getScene('RouteScene');
        return r.routeEssentialAssetsReady && !r.routeCommitPending;
      }
      if (!g.scene.isActive('BattleScene')) return false;
      const b = g.scene.getScene('BattleScene');
      return b.fxLayer?.active && b.combatPreviewModule && !b.combatIntroActive && !b.combatAnimationPending
        && !b.battleRenderQueued && (b.mode === 'battle' || b.rewardPresentationReady());
    });
    const decision = await page.evaluate(() => {
      const g = (window as any).__birdSquadGame;
      if (g.scene.isActive('RouteScene')) {
        const r = g.scene.getScene('RouteScene');
        if (r.shouldChooseDistrictContract()) return { kind: 'contract', key: 'Enter' };
        if (r.cardPickerMode) return { kind: 'preen', key: 'Enter' };
        if (r.pendingRouteReward) return { kind: 'route-reward', key: 'Enter' };
        if (r.marketOpen) return { kind: 'market-exit', key: 'Escape' };
        if (r.nodeChoiceOpen) {
          const choices = r.eventChoices();
          const wanted = choices.findIndex((c: any) => !c.locked && /recover|cache_scrap|decline/.test(c.key));
          const index = wanted >= 0 ? wanted : choices.findIndex((c: any) => !c.locked);
          const focus = JSON.parse((window as any).render_game_to_text()).nodeChoice.focus.index;
          return { kind: 'event', key: focus === index ? 'Enter' : 'ArrowRight' };
        }
        const nodes = r.getSelectableNodes();
        const rank = (n: any) => n.type === 'basin' && r.runState.currentHp < r.runMaxHp() * 0.8 ? 0
          : n.type === 'boss' ? 1 : n.type === 'cache' ? 2 : n.type === 'street' ? 3 : 4;
        nodes.sort((a: any, b: any) => rank(a) - rank(b) || a.id.localeCompare(b.id));
        const target = nodes[0];
        return { kind: 'route', key: r.selectedNodeId === target?.id ? 'Enter' : 'ArrowRight', node: target?.id };
      }
      const b = g.scene.getScene('BattleScene');
      if (['defeat', 'runComplete'].includes(b.mode)) return { kind: b.mode };
      if (b.mode !== 'battle') return { kind: b.mode, key: 'Enter' };
      if (b.returnChoice || b.discardChoice) return { kind: 'choice', key: 'Enter' };
      const incoming = b.incomingFlockDamagePreview().hpLoss;
      const candidates: any[] = [];
      for (const [index, card] of b.hand.entries()) {
        const contract = b.activeCardContract(card);
        if (b.effectiveCost(card) > b.energy || contract.target === 'choice'
          || contract.effects.some((e: string) => /returnFromDiscard|discard\(/.test(e))) continue;
        for (const enemy of b.enemies.filter((e: any) => e.hp > 0)) {
          const outcome = b.simulateCardOutcome(card, enemy.id);
          const score = outcome.enemyDamage + Math.min(incoming, outcome.coverGain) * 0.85
            + outcome.cohesionDelta * 0.8 + outcome.flowGain * 0.15;
          if (score > 0 && !outcome.requiresChoice) candidates.push({ index, card, enemy, target: contract.target, score });
        }
      }
      candidates.sort((a, z) => z.score - a.score);
      const pick = candidates[0];
      if (!pick) return { kind: 'roost', key: 'r', turn: b.turn };
      const canvas = b.game.canvas.getBoundingClientRect();
      const hp = b.enemyHpBar(pick.enemy);
      return { kind: 'play', key: String(pick.index + 1), id: pick.card.id, target: pick.target,
        played: b.statCardsPlayed, instance: pick.card.instanceId,
        point: { x: canvas.left + hp.x * canvas.width / 1280, y: canvas.top + (hp.y - 19) * canvas.height / 720 } };
    });
    journey.push(decision);
    const fingerprint = JSON.stringify(decision);
    repeated = fingerprint === lastDecision ? repeated + 1 : 0;
    lastDecision = fingerprint;
    expect(repeated, `No live-control progress: ${fingerprint}`).toBeLessThan(12);
    if (!captured.has(decision.kind)) {
      captured.add(decision.kind);
      await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`${decision.kind}-1440.png`) });
    }
    if (['defeat', 'runComplete'].includes(decision.kind)) { terminal = decision.kind; break; }
    await page.keyboard.press(decision.key!);
    if (decision.kind === 'play') {
      await page.waitForFunction(id => (window as any).__birdSquadGame.scene.getScene('BattleScene').selectedInstanceId === id, decision.instance);
      if (!captured.has('inspected-card')) {
        const stable = () => page.evaluate(() => {
          const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
          return JSON.stringify({ selected: b.selectedInstanceId, target: b.selectedEnemyId, energy: b.energy, turn: b.turn });
        });
        const before = await stable();
        await page.keyboard.press('h');
        await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active);
        await page.keyboard.press('Escape');
        expect(await stable()).toBe(before); captured.add('inspected-card');
      }
      if (decision.target === 'enemy') await page.mouse.click(decision.point!.x, decision.point!.y);
      else await page.keyboard.press('Enter');
      await page.waitForFunction(played => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        return b.statCardsPlayed > played! || b.mode !== 'battle';
      }, decision.played);
    } else if (decision.kind === 'roost') {
      await page.waitForFunction(turn => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        return b.turn > turn! || b.mode !== 'battle';
      }, decision.turn);
    }
    await settleCanvas(page);
  }
  const report = await page.evaluate(() => (window as any).__birdSquadLastRun);
  await info.attach('live-control-journey', { body: JSON.stringify({ terminal, journey, report }, null, 2), contentType: 'application/json' });
  expect(['defeat', 'runComplete']).toContain(terminal);
  expect(captured.has('play')).toBe(true);
  expect(captured.has('cardReward')).toBe(true);
  expect(report.seed).toBe('all-a-reference');
  expect(errors).toEqual([]);
  // Outcome's primary action must remain reachable without a scene API call.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.isActive('BattleScene')
    || !['defeat', 'runComplete'].includes((window as any).__birdSquadGame.scene.getScene('BattleScene').mode));
});

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  const state = await page.evaluate(() => (window as any).render_game_to_text?.() ?? '{}').catch(() => 'unavailable');
  await info.attach('failed-live-state', { body: state, contentType: 'application/json' });
});
