import type { RuntimeCard } from './types';
import { combinations } from './flyway-rules';
type Bird = { id: string; name: string; runtime: RuntimeCard; upgraded?: boolean };
const normalEffects = (card: Bird) => card.upgraded ? card.runtime.upgrade.effects : card.runtime.effects;
const baseCost = (card: Bird) => card.upgraded ? card.runtime.upgrade.cost ?? card.runtime.cost : card.runtime.cost;
const amount = (effects: string[], verb: string) => effects.reduce((total, effect) => {
  const match = new RegExp(`^${verb}\\((\\d+)\\)$`).exec(effect);
  return total + (match ? Number(match[1]) : 0);
}, 0);
/** Normal-form, three-Wingbeat baseline. Conditional refunds never fund advice. */
function canSequence(first: Bird, second: Bird) {
  const effects = normalEffects(first);
  return !effects.some(effect => /enterMolt|loseWingbeat/.test(effect)) && baseCost(first) <= 3
    && baseCost(second) <= 3 - baseCost(first) + amount(effects, 'gainWingbeat');
}
export function primaryBenefit(card: Bird) {
  const effects = card.upgraded ? card.runtime.upgrade.effects : card.runtime.effects;
  const verbs: Record<string, string> = { damage: 'damage', gainCover: 'Cover', heal: 'healing', draw: 'cards drawn', gainResonance: 'Resonance', gainWingbeat: 'Wingbeats', gainOpenSkyGuard: 'Open Sky Guard' };
  for (const effect of effects) {
    const match = /^(\w+)\((?:target, |self, )?(\d+)\)$/.exec(effect);
    if (match && verbs[match[1]]) return match[1] === 'draw' ? `Base: draw ${match[2]}.` : `Base: ${match[2]} ${verbs[match[1]]}.`;
    if (effect === 'enterMolt()' || effect === 'enterMolt') return 'Enter Molt this turn.';
  }
  const conditions: Record<string,string> = {hasResonance:'With Resonance',noResonance:'No Resonance',isMolting:'While Molting',openSky:'In Open Sky',fullCohesion:'At full Cohesion',targetWinded:'If target is Winded',targetHasCover:'If target has Cover',spentResonance:'After Resonance spent',firstPlayedThisCombat:'First play this fight'};
  for(const effect of effects) {
    const match=/^if (.*?) then (\w+)\((?:target, |self, )?(\d+)\)$/.exec(effect);
    if(!match || !verbs[match[2]])continue;
    const suit=/^playedSuitThisTurn\((\w+)\)$/.exec(match[1]);
    const condition=conditions[match[1]] ?? (suit ? `${suit[1]} this turn` : undefined);
    if(condition)return `${condition}:\n${match[2] === 'draw' ? `Draw ${match[3]}` : `${match[3]} ${verbs[match[2]]}`}.`;
  }
  return effects.some(e => e.startsWith('if ')) ? 'Conditional ability.\nRead its trigger.' : 'Tactical ability.\nRead its timing.';
}
/** A concrete owned partner and a limitation, never a claim about win rate. */
export function decisionBrief(card: Bird, deck: Bird[]) {
  const own = deck.filter(b => b.id !== card.id);
  const rules = normalEffects(card), effects = rules.join(' ');
  const primary = primaryBenefit(card);
  const tradeoff = /enterMolt/.test(effects) ? 'Molt changes your rules.'
    : /hasResonance|resonanceAtLeast|spentResonance/.test(effects) ? 'Prepare Resonance first.'
    : /targetWinded/.test(effects) ? 'Needs a Winded target.'
    : /fullyBlocksNextAttack/.test(effects) ? 'Requires a full block.'
    : /draw\(/.test(effects) && !amount(rules, 'gainWingbeat') ? 'Draw adds no Wingbeats.'
    : /targetHasCover/.test(effects) ? 'Needs enemy Cover.'
    : /playedSuitThisTurn/.test(effects) ? 'Play order matters.'
    : baseCost(card) >= 2 ? `${baseCost(card)} of 3 base Wingbeats.`
    : /gainCover/.test(effects) && !/damage\(/.test(effects) ? 'No direct damage.'
    : !/gainCover|heal|gainOpenSkyGuard/.test(effects) ? 'No direct protection.'
    : 'Both cards must be drawn.';
  const finish = (pairing: string, reason: string) => ({ primary, pairing, tradeoff,
    details: [primary, pairing, reason, tradeoff,
      'Potential, not a promised draw. Uses normal rules, base costs and a three-Wingbeat turn; temporary discounts and conditional refunds are excluded. Molt replaces these rules.'].join('\n\n') });
  // A producer must leave enough Resonance for the consumer's actual threshold.
  const threshold = Math.max(/hasResonance/.test(effects) || (/spentResonance/.test(effects) && /spendResonance|resonanceBurst/.test(effects)) ? 1 : 0,
    ...[...effects.matchAll(/(?:resonanceAtLeast|spendResonance)\((\d+)\)/g)].map(match => Number(match[1])));
  if (threshold) {
    const source = own.find(b => {
      const e = normalEffects(b);
      return canSequence(b, card) && !e.some(rule => /spendResonance|resonanceBurst/.test(rule)) && amount(e, 'gainResonance') >= threshold;
    });
    if (source) return finish(`After ${source.name}: Resonance`,
      `${source.name} unconditionally supplies at least ${threshold} Resonance before this card's trigger. Both base costs fit, including only guaranteed Wingbeat refunds.`);
  }
  if (/targetWinded/.test(effects)) {
    const source = own.find(b => canSequence(b, card) && normalEffects(b).some(rule => /^applyWinded\(target,\s*[1-9]\d*\)$/.test(rule)));
    if (source) return finish(`After ${source.name}: Winded`, 'Use the same surviving target. Winded is applied by the first card before this card checks it.');
  }
  for (const combo of combinations) {
    const before = card.runtime.suit === combo.second;
    const partner = own.find(b => b.runtime.suit === (before ? combo.first : card.runtime.suit === combo.first ? combo.second : undefined)
      && (before ? canSequence(b, card) : canSequence(card, b)));
    if (partner) return finish(`${before ? 'After' : 'Before'} ${partner.name}: ${combo.name}`,
      `${combo.rule} Play consecutively while this combination is unused in the fight. Both base costs fit, including only guaranteed Wingbeat refunds.`);
  }
  return finish('No verified owned pairing.', 'No supported pairing fits the checked normal-form budget. This is not a verdict on the card; inspect its complete rules and other resource sources.');
}
