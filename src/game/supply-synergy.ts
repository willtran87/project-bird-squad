import type { RuntimeSupply } from './types';
import { parseEffect } from './effects/effect-parser';

function addSynergyTag(tags: string[], tag: string) {
  if (!tags.includes(tag)) tags.push(tag);
}

function authoredEffectBodies(effects: string[]) {
  return effects.flatMap((effect) => {
    const conditional = effect.match(/^if ([a-zA-Z][a-zA-Z0-9]*(?:\([^)]+\))?) then (.+)$/);
    return conditional ? [conditional[1], conditional[2]] : [effect];
  });
}

function effectVerb(effect: string) {
  return parseEffect(effect)?.name ?? '';
}

export function supplySynergyTags(supply: RuntimeSupply) {
  const tags: string[] = [];
  const bodies = authoredEffectBodies(supply.effects);
  const text = `${supply.answerType} ${supply.timing} ${supply.effects.join(' ')}`.toLowerCase();
  const verbs = new Set(bodies.map(effectVerb));
  if (supply.timing === 'route') addSynergyTag(tags, 'Route');
  if (supply.timing === 'combat') addSynergyTag(tags, 'Combat');
  if (supply.timing === 'either') addSynergyTag(tags, 'Flexible');
  if (text.includes('visitednodetype')) addSynergyTag(tags, 'Route Memory');
  if (verbs.has('gainCover') || supply.answerType === 'coverNow') addSynergyTag(tags, 'Cover');
  if (verbs.has('healCohesion') || verbs.has('heal') || supply.answerType === 'healNow') addSynergyTag(tags, 'Recovery');
  if (verbs.has('draw') || verbs.has('nextTurnDraw') || supply.answerType === 'drawNow') addSynergyTag(tags, 'Draw');
  if (verbs.has('gainWingbeat') || verbs.has('gainEnergyNextTurn') || supply.answerType === 'wingbeatNow') addSynergyTag(tags, 'Wingbeat');
  if (verbs.has('damage') || verbs.has('damageAll') || verbs.has('damagePierce') || supply.answerType === 'damageNow') addSynergyTag(tags, 'Pressure');
  if (verbs.has('removeCover') || supply.answerType === 'antiCover') addSynergyTag(tags, 'Anti-Cover');
  if (verbs.has('cleanseFlock') || supply.answerType === 'cleanseNow') addSynergyTag(tags, 'Cleanse');
  if (verbs.has('gainSupplyChoice') || verbs.has('gainSupply')) addSynergyTag(tags, 'Packs Supply');
  if (verbs.has('increaseSupplySlots')) addSynergyTag(tags, 'Capacity');
  if (verbs.has('repeatNextSupply')) addSynergyTag(tags, 'Supply Combo');
  if (verbs.has('retainHand') || supply.answerType === 'handFix') addSynergyTag(tags, 'Hand Fix');
  if (verbs.has('enterMolt') || supply.answerType === 'moltNow') addSynergyTag(tags, 'Molt');
  if (verbs.has('peekNextNodes') || supply.answerType === 'tellControl') addSynergyTag(tags, 'Plan');
  return tags.slice(0, 5);
}
