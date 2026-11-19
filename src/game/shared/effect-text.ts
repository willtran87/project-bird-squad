import { parseEffect, parseEffectValue } from '../effects/effect-parser';

function formatConditionCompact(condition: string) {
  return formatCondition(condition)
    .replace('first played', 'first use/fight')
    .replace('target attacks', 'attack intent')
    .replace('target below half', 'low target')
    .replace('target has Cover', 'has Cover')
    .replace('target Winded', 'Winded')
    .replace('full Cohesion', 'full HP')
    .replace('low Cohesion', 'low HP');
}


function formatEffectCompact(effect: string): string {
  const conditional = effect.match(/^if ([a-zA-Z][a-zA-Z0-9]*(?:\([^)]+\))?) then (.+)$/);
  if (conditional) return `${formatConditionCompact(conditional[1])}: ${formatEffectCompact(conditional[2])}`;
  const parsed = parseEffect(effect);
  if (!parsed) return compactSentenceText(effect, 44, 1).replace(/\.$/, '');
  const value = (parsed.args[1] ?? parsed.args[0] ?? '')
    .replace(' perWinded', '/Winded')
    .replace(' perDiscarded', '/discard')
    .replace(' perCover', '/Cover');
  switch (parsed.name) {
    case 'damage': return `${value} dmg`;
    case 'damagePierce': return `${value} pierce`;
    case 'damageAll': return `${value} all`;
    case 'removeCover': return `-${value} Cover`;
    case 'gainCover': return `+${value} Cover`;
    case 'applyOpenSky': return `Open Sky ${value}`;
    case 'loseCover': return `-${value} Cover`;
    case 'damageFlock': return `-${value} HP`;
    case 'heal':
    case 'healCohesion': return `+${value} HP`;
    case 'healMissingPct': return `missing HP +${parsed.args[1] ?? value}`;
    case 'healAlly': return `ally +${value} HP`;
    case 'healAllEnemies': return `enemies +${value} HP`;
    case 'gainCoverAlly': return `ally +${value} Cover`;
    case 'gainCoverAllEnemies': return `enemies +${value} Cover`;
    case 'nextAttackBonusAlly': return `ally +${value} dmg`;
    case 'overhealCover': return `+${value} HP -> Cover`;
    case 'loseCohesion': return `-${value} HP`;
    case 'draw': return `Draw ${value}`;
    case 'discard': return `Discard ${value}`;
    case 'discardUpTo': return `Discard up to ${value}`;
    case 'gainWingbeat': return `+${value} Wingbeat`;
    case 'loseWingbeat': return `-${value} Wingbeat`;
    case 'gainResonance': return `+${value} Resonance`;
    case 'gainScrap': return `+${value} Scrap`;
    case 'payScrap': return `-${value} Scrap`;
    case 'spendResonance': return `spend ${value} Resonance`;
    case 'resonanceBurst': return `${value} dmg/Resonance`;
    case 'windedBurst': return `${value} dmg/Winded`;
    case 'applyWinded': return parsed.args[0] === 'flock' ? `flock +${value} Winded` : `+${value} Winded`;
    case 'applyPoison': return `+${value} Fouled`;
    case 'enterMolt': return 'Molt';
    case 'gainOpenSkyGuard': return `+${value} Sky Guard`;
    case 'reduceNextOpenSky':
    case 'reduceOpenSky': return `-${value} Open Sky`;
    case 'returnDiscard': {
      const drawAfter = parseEffectValue(parsed.args[1], 0);
      return drawAfter > 0 ? `return discard + Draw ${drawAfter}` : 'return discard';
    }
    case 'nextCoverBonus': return `next Cover +${value}`;
    case 'retainHand': return `retain ${value}`;
    case 'nextTurnDraw': return `next Draw ${Number(value) >= 0 ? '+' : ''}${value}`;
    case 'gainEnergyNextTurn': return `next Wingbeat +${value}`;
    case 'enemyNextAttackBonus': return `enemy +${value} dmg`;
    case 'enemyGainCover': return `enemy +${value} Cover`;
    case 'repeatNextSupply': return `repeat Supply +${value}`;
    case 'cleanseFlock': return `cleanse ${value}`;
    case 'peekNextNodes': return `plan +1 Guard, Sky -${value || 1}`;
    case 'increaseSupplySlots': return `slot +${value || 1}`;
    case 'gainSupply': return 'Supply';
    case 'gainSupplyChoice': return `Supply ${value || 1}`;
    case 'addHeal': return `Basin +${value} HP`;
    case 'reducePreenPrice': return `Preen -${value} Scrap`;
    case 'gainCoverPerWaymark': return `+${value} Cover/Waymark`;
    case 'gainRouteMark':
      if (value === 'randomRare') return 'Rare Waymark';
      if (value === 'randomUncommonOrRare') return 'High-tier Waymark';
      return 'Waymark';
    case 'addCard':
      if (value === 'chooseOneOfTwoRare' || value === 'randomRare') return 'Rare card';
      if (value === 'chooseOneOfTwoUncommonOrRare' || value === 'randomUncommonOrRare') return 'High-tier card';
      return 'Card';
    case 'addSnagToDiscard': return 'Snag to discard';
    case 'addSnagToDraw': return 'Snag to draw';
    case 'shuffleSelfToDraw': return 'returns to deck';
    case 'exhaustSelf': return 'clears';
    case 'bossDamageShield': return `boss fight +${value} Cover`;
    case 'extraCacheChoice': return `Cache +${value} choice`;
    case 'freePreenNextDistrict': return 'free Preen next';
    case 'districtStartKit': return 'next district kit';
    case 'removeRouteChoice': return 'close route';
    default: return formatEffect(effect).replace(/\.$/, '');
  }
}


export function compactEffectGrammar(effects: string[] | string, maxChars = 96, maxParts = 3) {
  const raw = Array.isArray(effects) ? effects : effects.split(/\.\s+/).filter(Boolean);
  const text = raw.slice(0, maxParts).map(formatEffectCompact).join(' | ');
  return compactSentenceText(text, maxChars, 1).replace(/\.$/, '');
}


export function compactCardEffectSummary(effects: string[]) {
  return compactEffectGrammar(effects, 86, 3);
}


export function compactHandCardSummary(effects: string[]) {
  // Preserve every effect and its position. The lazy hand renderer measures the
  // readable clauses and discloses any overflow; full inspection is unchanged.
  return effects.map(effect => formatEffects([effect])).join('\n');
}


export function compactEffectSummary(effects: string[] | string, maxChars = 96, maxSentences = 2) {
  const text = (Array.isArray(effects) ? formatEffects(effects) : effects)
    .replace(/\s+/g, ' ')
    .trim();
  return compactSentenceText(text, maxChars, maxSentences);
}


export function compactSentenceText(text: string, maxChars = 96, maxSentences = 2) {
  const sentences = text.match(/[^.!?]+[.!?]/g)?.map((part) => part.trim()) ?? [text];
  const source = sentences.slice(0, maxSentences).join(' ').trim() || text;
  if (source.length <= maxChars) return source;
  const clipped = source.slice(0, maxChars - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > 42 ? lastSpace : clipped.length).trim()}...`;
}


export function formatEffects(effects: string[]) {
  return effects.map((effect) => {
    const conditional = effect.match(/^if ([a-zA-Z][a-zA-Z0-9]*(?:\([^)]+\))?) then (.+)$/);
    if (conditional) return `If ${formatCondition(conditional[1])}: ${formatEffect(conditional[2])}`;
    return formatEffect(effect);
  }).join(' ');
}


function formatCondition(condition: string) {
  return condition
    .replace('flockHasNoCover', 'the flock has no Cover')
    .replace('flockHasCover', 'the flock has Cover')
    .replace('flockOpenSky', 'the flock is in Open Sky')
    .replace('flockCohesionBelowHalf', 'the flock is below half Cohesion')
    .replace('handEmptyAtRoost', 'no cards were held at Roost')
    .replace('notHitThisTurn', 'this enemy was not hit this turn')
    .replace('selfBelowHalf', 'this enemy is below half Cohesion')
    .replace(/^playedCardsAtLeast\((\d+)\)$/, '$1+ cards were played this turn')
    .replace(/^zeroCostCardsAtLeast\((\d+)\)$/, '$1+ zero-cost cards were played this turn')
    .replace('firstPlayedThisCombat', 'first played')
    .replace('targetBelowHalf', 'target below half')
    .replace('targetIntendsAttack', 'target attacks')
    .replace('targetHasCover', 'target has Cover')
    .replace('targetWinded', 'target Winded')
    .replace(/^resonanceAtLeast\((\d+)\)$/, '$1+ Resonance')
    .replace(/^windedAtLeast\((\d+)\)$/, 'target $1+ Winded')
    .replace('hasResonance', 'Resonance')
    .replace('noResonance', 'no Resonance')
    .replace('noCover', 'no Cover')
    .replace('spentResonance', 'spent Resonance')
    .replace('isMolting', 'Molting')
    .replace('openSky', 'Open Sky')
    .replace('fullCohesion', 'full Cohesion')
    .replace('cohesionBelowHalf', 'low Cohesion')
    .replace('defeatsEnemy', 'defeats enemy')
    .replace('fullyBlocksNextAttack', 'fully blocks next attack')
    .replace(/^visitedNodeType\(([^)]+)\)$/, 'visited $1')
    .replace(/^playedSuitThisTurn\(([^)]+)\)$/, 'played $1');
}


function formatEffect(effect: string) {
  const parsed = parseEffect(effect);
  if (!parsed) return effect;
  const value = (parsed.args[1] ?? parsed.args[0] ?? '')
    .replace(' perWinded', ' per Winded')
    .replace(' perDiscarded', ' per card discarded')
    .replace(' perCover', ' per Cover');
  switch (parsed.name) {
    case 'damage':
      return `Deal ${value}.`;
    case 'damagePierce':
      return `Deal ${value}, ignoring Cover.`;
    case 'damageAll':
      return `Deal ${value} to all.`;
    case 'removeCover':
      return `Remove ${value} Cover.`;
    case 'gainCover':
      return `Gain ${value} Cover.`;
    case 'applyOpenSky':
      return `Enter Open Sky for ${value}.`;
    case 'loseCover':
      return `Lose ${value} Cover.`;
    case 'damageFlock':
      return `Take ${value} damage.`;
    case 'heal':
      return `Heal ${value}.`;
    case 'healCohesion':
      return `Heal ${value} Cohesion.`;
    case 'healMissingPct':
      return `Heal based on missing Cohesion, up to ${parsed.args[1] ?? value}.`;
    case 'healAlly':
      return `Heal an ally ${value}.`;
    case 'healAllEnemies':
      return `Heal all enemies ${value}.`;
    case 'gainCoverAlly':
      return `Give an ally ${value} Cover.`;
    case 'gainCoverAllEnemies':
      return `Give all enemies ${value} Cover.`;
    case 'nextAttackBonusAlly':
      return `Give an ally +${value} damage.`;
    case 'nextAttackBonus':
      return `Next attack gains +${value} damage.`;
    case 'overhealCover':
      return `Heal ${value}; overflow becomes Cover.`;
    case 'loseCohesion':
      return `Lose ${value} Cohesion.`;
    case 'draw':
      return `Draw ${value}.`;
    case 'discard':
      return `Discard ${value}.`;
    case 'discardUpTo':
      return `Discard up to ${value}.`;
    case 'gainWingbeat':
      return `Gain ${value} Wingbeat.`;
    case 'loseWingbeat':
      return `Lose ${value} Wingbeat.`;
    case 'gainResonance':
      return `Gain ${value} Resonance.`;
    case 'gainScrap':
      return `Gain ${value} Scrap.`;
    case 'payScrap':
      return `Pay ${value} Scrap.`;
    case 'spendResonance':
      return `Spend ${value} Resonance.`;
    case 'resonanceBurst':
      return `Spend all Resonance: deal ${value} damage per point.`;
    case 'windedBurst':
      return `Consume the target's Winded: deal ${value} damage per stack.`;
    case 'applyWinded':
      if (parsed.args[0] === 'flock') return `Apply ${value} Winded to the flock.`;
      return `Apply ${value} Winded.`;
    case 'applyPoison':
      return `Apply ${value} Fouled.`;
    case 'applyFrail':
      return `Apply ${value} Frail.`;
    case 'enterMolt':
      return 'Enter Molt.';
    case 'gainOpenSkyGuard':
      return `Gain ${value} Open Sky Guard.`;
    case 'reduceNextOpenSky':
    case 'reduceOpenSky':
      return `Reduce the next Open Sky increase by ${value}.`;
    case 'returnDiscard': {
      const drawAfter = parseEffectValue(parsed.args[1], 0);
      return drawAfter > 0
        ? `Return a card from discard, then draw ${drawAfter}.`
        : 'Return a card from discard.';
    }
    case 'nextCoverBonus':
      return `Next Nest Cover +${value}.`;
    case 'retainHand':
      return `Retain ${value} card${value === '1' ? '' : 's'}.`;
    case 'nextTurnDraw': {
      const n = Number(value);
      if (Number.isFinite(n) && n < 0) return `Draw ${Math.abs(n)} fewer next turn.`;
      return `Draw ${value} next turn.`;
    }
    case 'gainEnergyNextTurn':
      return `Gain ${value} Wingbeat next turn.`;
    case 'enemyNextAttackBonus':
      return `The next enemy attack gains +${value} damage.`;
    case 'enemyGainCover':
      return `The enemy gains ${value} Cover.`;
    case 'repeatNextSupply':
      return `The next Supply resolves ${value} extra time${value === '1' ? '' : 's'}.`;
    case 'cleanseFlock':
      return `Reduce each flock debuff by ${value}.`;
    case 'peekNextNodes':
      return `Pack 1 Open Sky Guard and soften the next Open Sky increase by ${value || 1}.`;
    case 'increaseSupplySlots':
      return `Supply capacity +${value || 1}.`;
    case 'gainSupply':
      return 'Pack a Supply.';
    case 'gainSupplyChoice':
      return `Pack ${value || 1} random Supply${value === '1' ? '' : 's'}.`;
    case 'addHeal':
      return `Basin Stops heal +${value} Cohesion.`;
    case 'reducePreenPrice':
      return `Market Preen costs ${value} less Scrap.`;
    case 'gainCoverPerWaymark':
      return `Combat starts with ${value} Cover per Waymark.`;
    case 'gainRouteMark':
      return 'Gain a Waymark.';
    case 'addCard':
      return 'Add a card.';
    case 'addSnagToDiscard':
      return 'Add a Snag to discard.';
    case 'addSnagToDraw':
      return 'Add a Snag to draw.';
    case 'shuffleSelfToDraw':
      return 'Return this to the draw pile after play.';
    case 'exhaustSelf':
      return 'Remove this from combat.';
    case 'bossDamageShield':
      return `Flock starts boss fights with ${value} Cover.`;
    case 'extraCacheChoice':
      return `Caches offer +${value} choice.`;
    case 'freePreenNextDistrict':
      return `Next district starts with ${value || 1} free Preen.`;
    case 'districtStartKit':
      return `Next district starts with ${value || 1} free Preen and ${value || 1} Supply.`;
    default:
      return effect;
  }
}
