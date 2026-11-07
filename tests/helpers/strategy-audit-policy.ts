/** Test-only, bounded heuristic. It ranks legal offers, never creates a card or
 * changes resources. Scores describe this policy, not card strength or fun. */
export function installStrategyAuditPolicy() {
  (window as any).__auditCardScore = (card: any, plan: string, upgrade = false) => {
    const runtime = card.runtime ?? card;
    const preened = upgrade || card.upgraded;
    const effects: string[] = preened ? runtime.upgrade?.effects ?? runtime.effects ?? [] : runtime.effects ?? [];
    const molt: string[] = preened ? runtime.upgrade?.moltEffects ?? runtime.moltEffects ?? [] : runtime.moltEffects ?? [];
    const weights: Record<string, number> = plan === 'shelter'
      ? { damage: 0.5, gainCover: 1.3, heal: 0.8, retainHand: 3, nextTurnDraw: 2, gainEnergyNextTurn: 2, gainOpenSkyGuard: 2 }
      : plan === 'tempo' ? { damage: 0.6, gainResonance: 2.5, spendResonance: 1.3, draw: 2, gainWingbeat: 3, gainCover: 0.4 }
      : { damage: 0.4, gainCover: 0.8, gainOpenSkyGuard: 3, enterMolt: 5, gainWingbeat: 2 };
    const rate = (rules: string[]) => rules.reduce((total, rule) => {
      const effect = rule.replace(/^if .*? then /, ''), verb = effect.split('(')[0];
      const count = Number(effect.match(/(?:\(|,\s*)(\d+)\)$/)?.[1] ?? 1);
      return total + (weights[verb] ?? 0.2) * count * (rule.startsWith('if ') ? 0.5 : 1);
    }, 0);
    const cost = preened ? runtime.upgrade?.cost ?? runtime.cost ?? 0 : runtime.cost ?? 0;
    return rate(effects) + (plan === 'molt' ? rate(molt) * 0.9 : rate(molt) * 0.1) - cost * 1.5;
  };
}
