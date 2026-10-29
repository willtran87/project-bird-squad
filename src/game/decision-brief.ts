import type { RuntimeCard } from './types';
type Bird = { id: string; name: string; runtime: RuntimeCard; upgraded?: boolean };
export function primaryBenefit(card: Bird) {
  const effects = card.upgraded ? card.runtime.upgrade.effects : card.runtime.effects;
  const verbs: Record<string, string> = { damage: 'damage', gainCover: 'Cover', heal: 'healing', draw: 'cards drawn', gainResonance: 'Resonance', gainWingbeat: 'Wingbeats', gainOpenSkyGuard: 'Open Sky Guard' };
  for (const effect of effects) {
    const match = /^(\w+)\((?:target, |self, )?(\d+)\)$/.exec(effect);
    if (match && verbs[match[1]]) return `Base: ${match[2]} ${verbs[match[1]]}.`;
    if (effect === 'enterMolt()' || effect === 'enterMolt') return 'Enter Molt this turn.';
  }
  const conditions: Record<string,string> = {hasResonance:'With Resonance',noResonance:'No Resonance',isMolting:'While Molting',openSky:'In Open Sky',fullCohesion:'At full Cohesion',targetWinded:'If target is Winded',targetHasCover:'If target has Cover',spentResonance:'After Resonance spent',firstPlayedThisCombat:'First play this fight'};
  for(const effect of effects) {
    const match=/^if (.*?) then (\w+)\((?:target, |self, )?(\d+)\)$/.exec(effect);
    if(!match || !verbs[match[2]])continue;
    const suit=/^playedSuitThisTurn\((\w+)\)$/.exec(match[1]);
    const condition=conditions[match[1]] ?? (suit ? `${suit[1]} this turn` : undefined);
    if(condition)return `${condition}:\n${match[3]} ${verbs[match[2]]}.`;
  }
  return effects.some(e => e.startsWith('if ')) ? 'Conditional ability.\nRead its trigger.' : 'Tactical ability.\nRead its timing.';
}
/** A concrete owned partner and a limitation, never a claim about win rate. */
export function decisionBrief(card: Bird, deck: Bird[]) {
  const own = deck.filter(b => b.id !== card.id);
  const effects = (card.upgraded ? card.runtime.upgrade.effects : card.runtime.effects).join(' ');
  const primary = primaryBenefit(card);
  const tradeoff = /enterMolt/.test(effects) ? 'Molt needs protection.' : /\bif /.test(effects) ? 'Bonus is conditional.'
    : /draw\(/.test(effects) && !/gainWingbeat\(/.test(effects) ? 'No Wingbeats added.' : 'Uses a hand slot.';
  const sequences = [['nests', 'quills', 'Brace & Cut'], ['basins', 'plumes', 'Rain Chorus'], ['quills', 'basins', 'Safe Landing']];
  for (const [first, second, name] of sequences) {
    const before = card.runtime.suit === second;
    const partner = own.find(b => b.runtime.suit === (before ? first : card.runtime.suit === first ? second : undefined));
    if (partner) return { primary, pairing: `${before ? 'After' : 'Before'} ${partner.name}: ${name}`, tradeoff };
  }
  const source = own.find(b => /gainResonance\(/.test((b.upgraded ? b.runtime.upgrade.effects : b.runtime.effects).join(' ')));
  return { primary, pairing: /hasResonance|spendResonance/.test(effects) && source ? `After ${source.name}: Resonance` : 'Read for full rules and Molt ability.', tradeoff };
}
