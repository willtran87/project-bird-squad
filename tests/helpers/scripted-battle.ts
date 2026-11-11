/** Browser-evaluated mechanical policy, not a human player or balance verdict.
 * Uses live card/turn rules; it never grants resources or changes draw order.
 */
export function resolveScriptedBattle(options: 'balanced' | 'pressure' | 'sheltered' | {
  policy: 'balanced' | 'pressure' | 'sheltered';
  supplies: Array<{ id: string; timing: string; answerType: string; effects: string[] }>;
  plan?: string;
}) {
  const policy = typeof options === 'string' ? options : options.policy;
  const supplies = typeof options === 'string' ? [] : options.supplies;
  const plan = typeof options === 'string' ? undefined : options.plan;
  const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
  const render = b.renderAll;
  const decisions: Array<{ turn: number; card: string; target?: string; hp: number; molt: boolean; energy: number; resonance: number }> = [];
  const choices: Array<{ source: string; kind: string; ids: string[] }> = [];
  const supplyUses: Array<{ id: string; turn: number; hp: number; remaining: number }> = [];
  const opportunities: any[] = [], contributions: any[] = [];
  const seenTurns = new Set<number>();
  let cleanupRoosts = 0;
  const resonanceBefore = b.flyway.resonanceSpent ?? 0;
  const owned = b.allDeckCards().map((c: any) => ({ id: c.id, branch: c.preenBranch,
    effects: (c.upgraded ? c.runtime.upgrade.effects : c.runtime.effects),
    moltEffects: (c.upgraded ? c.runtime.upgrade.moltEffects : c.runtime.moltEffects) }));
  b.renderAll = () => {}; // Presentation is captured at the encounter boundary.
  const rate = (outcome: any, effects: string[], incoming: number) =>
    outcome.enemyDamage * (policy === 'pressure' ? 1.6 : plan === 'shelter' ? 0.8 : 1)
    + Math.max(0, Math.min(incoming, outcome.coverGain)) * (plan === 'shelter' ? 1.4 : policy === 'pressure' ? 0.35 : 0.9)
    + Math.max(0, outcome.cohesionDelta) * 0.8
    + effects.reduce((n, effect) => n + (/^draw\(/.test(effect) ? 1.4 : 0), 0)
    + Math.max(0, outcome.energyDelta) * (plan === 'tempo' ? 1.5 : 0.8)
    + (plan === 'tempo' ? Math.max(0, outcome.resonanceDelta) * 1.5 : 0)
    + (plan === 'shelter' ? Math.max(0, outcome.nextTurnEnergyDelta) + Math.max(0, outcome.nextTurnDrawDelta) : 0)
    + (plan === 'molt' ? Math.max(0, outcome.moltPowerApplied) * 0.8 : 0);
  try {
    for (let step = 0; step < 200 && b.mode === 'battle'; step++) {
      const candidates: any[] = [], incoming = b.incomingFlockDamagePreview().hpLoss;
      if (!seenTurns.has(b.turn)) {
        seenTurns.add(b.turn);
        opportunities.push({ turn: b.turn, incoming, energy: b.energy, resonance: b.spark, molt: b.flock.molt,
          hand: b.hand.map((c: any) => ({ id: c.id, branch: c.preenBranch, affordable: b.effectiveCost(c) <= b.energy,
            effects: b.activeCardContract(c).effects })) });
      }
      const value = (card: any, enemy: any) => {
        const contract = b.activeCardContract(card), outcome = b.simulateCardOutcome(card, enemy.id);
        // A deliberately conservative comparison policy: honor the game's
        // fourth-card warning unless this card closes the encounter.
        if (policy === 'sheltered' && b.cardsPlayedThisTurn >= 3 && !b.flock.exposed
          && outcome.enemyStates.some((e: any) => e.hpAfter > 0)) return 0;
        // The preview deliberately stops at choices. This modest exploration
        // value is a policy heuristic, NOT an exact prediction of later effects.
        return rate(outcome, contract.effects, incoming) + (outcome.requiresChoice ? 0.5 : 0);
      };
      const resolveChoices = () => {
        for (let n = 0; b.discardChoice || b.returnChoice; n++) {
          if (n >= 32) throw new Error('Interactive sequence did not terminate');
          const cardValue = (card: any) => !card || card.runtime.kind === 'snag' ? -1
            : Math.max(0, ...b.enemies.filter((e: any) => e.hp > 0).map((enemy: any) => value(card, enemy)))
              / Math.max(1, b.effectiveCost(card));
          if (b.discardChoice) {
            const choice = b.discardChoice;
            const cards = b.hand.filter((c: any) => choice.candidateIds.includes(c.instanceId))
              .sort((a: any, z: any) => cardValue(a) - cardValue(z));
            const selected = (choice.optional ? cards.filter((c: any) => cardValue(c) <= 0) : cards).slice(0, choice.max);
            selected.forEach((c: any) => b.toggleDiscardChoice(c.instanceId));
            choices.push({ kind: 'discard', source: choice.source, ids: selected.map((c: any) => c.id) });
            b.confirmDiscardChoice();
          } else {
            const choice = b.returnChoice;
            const cards = b.discardPile.filter((c: any) => choice.candidateIds.includes(c.instanceId))
              .sort((a: any, z: any) => cardValue(z) - cardValue(a));
            if (!cards.length) throw new Error('Return choice has no legal candidate');
            choices.push({ kind: 'return', source: choice.source, ids: [cards[0].id] });
            b.chooseReturnCard(cards[0].instanceId);
          }
        }
      };
      const supplyIndex = b.runSupplies.findIndex((id: string) => {
        const s = supplies.find(s => s.id === id);
        if (!s || s.timing === 'route') return false;
        switch (s.answerType) {
          case 'healNow': return b.flock.maxHp - b.flock.hp >= 6;
          case 'coverNow': case 'openSkySafety': return incoming >= 5;
          case 'antiCover': return b.enemies.some((e: any) => e.hp > 0 && e.block >= 4);
          case 'moltNow': return !b.flock.molt && b.energy >= 2;
          case 'handFix': return b.hand.length < 5 && b.discardPile.length > 0;
          case 'drawNow': case 'wingbeatNow': return b.energy <= 1 && b.cardsPlayedThisTurn < 3;
          case 'damageNow': case 'burstNow': return b.enemies.some((e: any) => e.hp > 0) && incoming > 0;
          default: return false;
        }
      });
      if (supplyIndex >= 0) {
        const id = b.runSupplies[supplyIndex], count = b.runSupplies.length;
        b.useSupply(supplyIndex); resolveChoices();
        if (b.runSupplies.length >= count) throw new Error(`Supply ${id} did not commit`);
        supplyUses.push({ id, turn: b.turn, hp: b.flock.hp, remaining: b.runSupplies.length });
        b.retireCombatFxForOutcome();
        continue;
      }
      for (const card of b.hand) {
        if (b.effectiveCost(card) > b.energy || card.runtime.kind === 'snag') continue;
        for (const enemy of b.enemies.filter((e: any) => e.hp > 0)) {
          let score = value(card, enemy);
          if (b.activeCardContract(card).effects.includes('enterMolt()') && !b.flock.molt) {
            const best = () => Math.max(0, ...b.hand.filter((c: any) => c !== card && b.effectiveCost(c) <= b.energy).map((c: any) => value(c, enemy)));
            const normal = best();
            let molted = 0;
            try { b.flock.molt = true; molted = best(); } finally { b.flock.molt = false; }
            score += Math.max(0, molted - normal) * (plan === 'molt' ? 1.5 : 1) + (molted > 0 ? 0.1 : 0);
          }
          if (score > 0) candidates.push({ card, enemy, score });
        }
      }
      candidates.sort((a, z) => z.score - a.score);
      const pick = candidates[0];
      decisions.push({ turn: b.turn, card: pick?.card.id ?? 'ROOST', target: pick?.enemy.id, hp: b.flock.hp,
        molt: b.flock.molt, energy: b.energy, resonance: b.spark });
      const before = { hp: b.flock.hp, damage: b.statDealt, blocked: b.statBlocked, molt: b.flock.molt,
        resonance: b.flyway.resonanceSpent ?? 0, cover: b.flock.block, combos: b.flightCombat.combos.length };
      if (pick) b.playCard(pick.card, pick.enemy.id, { resolveDelayMs: 0 });
      else {
        const alive = b.enemies.filter((e: any) => e.hp > 0);
        if (alive.length === 1 && alive[0].hp <= alive[0].maxHp * 0.2) cleanupRoosts++;
        b.endTurn();
      }
      resolveChoices();
      contributions.push({ turn: decisions[decisions.length - 1].turn, card: pick?.card.id ?? 'ROOST',
        branch: pick?.card.preenBranch, molt: before.molt, enteredMolt: !before.molt && b.flock.molt,
        cohesion: b.flock.hp - before.hp, cover: b.flock.block - before.cover,
        damage: b.statDealt - before.damage, blocked: b.statBlocked - before.blocked,
        resonanceSpent: (b.flyway.resonanceSpent ?? 0) - before.resonance,
        combinations: b.flightCombat.combos.length - before.combos });
      b.retireCombatFxForOutcome();
    }
  } finally { b.renderAll = render; b.renderAll(); }
  return { mode: b.mode, turn: b.turn, hp: b.flock.hp, deck: b.allDeckCards().length,
    decisions, choices, supplyUses, owned, opportunities, contributions, cleanupRoosts, blocked: b.statBlocked, plan,
    resonanceSpent: (b.flyway.resonanceSpent ?? 0) - resonanceBefore,
    combinations: [...b.flightCombat.combos],
    blockMoment: b.flyway.blockMoment, comboMoment: b.flyway.comboMoment,
    encounter: b.getTextState().route.currentPayloadId };
}
