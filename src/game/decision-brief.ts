import type { RuntimeCard } from './types';
type Bird = { id: string; name: string; runtime: RuntimeCard; upgraded?: boolean };
/** A concrete owned partner and a limitation, never a claim about win rate. */
export function decisionBrief(card: Bird, deck: Bird[]) {
  const own = deck.filter(b => b.id !== card.id);
  const effects = (card.upgraded ? card.runtime.upgrade.effects : card.runtime.effects).join(' ');
  const sequences = [['nests', 'quills', 'Brace & Cut'], ['basins', 'plumes', 'Rain Chorus'], ['quills', 'basins', 'Safe Landing']];
  for (const [first, second, name] of sequences) {
    const before = card.runtime.suit === second;
    const partner = own.find(b => b.runtime.suit === (before ? first : card.runtime.suit === first ? second : undefined));
    if (partner) return { pairing: `${before ? 'After' : 'Before'} ${partner.name}: ${name}`,
      tradeoff: /enterMolt/.test(effects) ? 'Molt needs protection.' : /draw\(/.test(effects) ? 'No extra Wingbeats.' : 'Once each turn.' };
  }
  const source = own.find(b => /gainResonance\(/.test((b.upgraded ? b.runtime.upgrade.effects : b.runtime.effects).join(' ')));
  return { pairing: /hasResonance|spendResonance/.test(effects) && source ? `After ${source.name}: Resonance` : 'No named pairing.',
    tradeoff: /enterMolt/.test(effects) ? 'Molt needs protection.' : /hasResonance|spendResonance/.test(effects) ? 'Needs Resonance.' : 'Spreads your draws.' };
}
