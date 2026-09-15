import { test, expect } from '@playwright/test';

// A mechanical comparison, not a claim about human fun or full-run balance.
test('Tidewarden starter has a usable offense/defense transition', async ({ page }, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('RouteScene');
    const title = w.__birdSquadGame.scene.getScene('MenuScene'); title.selectedLeaderId = 'tidewarden'; title.startRun();
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
  const run = await page.evaluate(() => structuredClone((window as any).__birdSquadGame.scene.getScene('RouteScene').runState));
  const results: any[] = [];
  for (const seed of ['tide-pacing-a', 'tide-pacing-b']) for (const policy of ['balanced', 'pressure']) for (const transition of [false, true]) {
    await page.evaluate(async ({ run, seed, transition }) => {
      const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
      for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
      const deck = run.deck.map((card: any) => ({ ...card, id: ['aviary_41', 'aviary_25'].includes(card.id) ? transition ? 'aviary_25' : 'aviary_41' : card.id }));
      w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry', runState: { ...run, deck, seed } });
    }, { run, seed, transition });
    await page.waitForFunction(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return b.hand.length && b.fxLayer?.active && b.combatPreviewModule && !b.combatIntroActive && !b.combatAnimationPending;
    });
    const result = await page.evaluate(policy => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      // Render once per result; apply the real card/turn/trigger logic unchanged.
      const render = b.renderAll; b.renderAll = () => {};
      const score = (o: any, effects: string[], incoming: number) => o.enemyDamage * (policy === 'pressure' ? 1.6 : 1)
        + Math.max(0, Math.min(incoming, o.coverGain)) * 0.6 + Math.max(0, o.cohesionDelta) * 0.35
        + effects.reduce((n, effect) => n + (/^draw\(/.test(effect) ? 1.4 : 0), 0) + Math.max(0, o.energyDelta) * 0.8;
      let moltPlays = 0, decisions = 0;
      for (; decisions < 100 && b.mode === 'battle'; decisions++) {
        const candidates: any[] = [], incoming = b.incomingFlockDamagePreview().hpLoss;
        for (const card of b.hand) {
          const contract = b.activeCardContract(card);
          if (b.effectiveCost(card) > b.energy || /\b(discard|discardUpTo|returnDiscard)\(/.test(contract.effects.join(' '))) continue;
          for (const enemy of b.enemies.filter((e: any) => e.hp > 0)) {
            let value = score(b.simulateCardOutcome(card, enemy.id), contract.effects, incoming);
            if (contract.effects.includes('enterMolt()') && !b.flock.molt) {
              // Compare the same hand in each stance; restore before any action.
              const normal = b.hand.filter((c: any) => c !== card && b.effectiveCost(c) <= b.energy)
                .map((c: any) => score(b.simulateCardOutcome(c, enemy.id), b.activeCardContract(c).effects, incoming));
              b.flock.molt = true;
              const changed = b.hand.filter((c: any) => c !== card && b.effectiveCost(c) <= b.energy)
                .map((c: any) => score(b.simulateCardOutcome(c, enemy.id), b.activeCardContract(c).effects, incoming));
              b.flock.molt = false;
              value += Math.max(0, Math.max(0, ...changed) - Math.max(0, ...normal)) + (Math.max(0, ...changed) > 0 ? 0.1 : 0);
            }
            if (value > 0) candidates.push({ card, enemy, value });
          }
        }
        candidates.sort((a, z) => z.value - a.value);
        const pick = candidates[0];
        if (pick) { if (pick.card.id === 'aviary_25') moltPlays++; b.playCard(pick.card, pick.enemy.id, { resolveDelayMs: 0 }); }
        else b.endTurn();
        if (b.discardChoice || b.returnChoice) throw new Error('Policy encountered an unsupported card choice');
        b.fxLayer.removeAll(true);
      }
      b.renderAll = render;
      return { mode: b.mode, turns: b.turn, hp: b.flock.hp, moltPlays, decisions };
    }, policy);
    results.push({ seed, policy, transition, ...result });
  }
  await info.attach('starter-comparison', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  for (const result of results) { expect(result.mode).not.toBe('battle'); expect(Number.isFinite(result.hp)).toBe(true); }
  for (const candidate of results.filter(r => r.transition)) {
    const old = results.find(r => !r.transition && r.seed === candidate.seed && r.policy === candidate.policy);
    expect(candidate.moltPlays).toBeGreaterThan(0);
    expect(candidate.turns).toBeLessThan(old.turns);
    expect(candidate.hp).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});
