import { alphaRouteMarkLibrary, alphaSupplyLibrary, alphaEncounterLibrary, alphaRewardProfileLibrary } from '../runtime-data';
import type { RouteNode, RuntimeRouteMark, RuntimeSupply, RewardProfile } from '../types';
import { UI_FIELD } from '../theme';
import { parseEffect, parseEffectValue } from '../effects/effect-parser';
import type { Card, PendingRouteRewardItem } from './runtime-types';
import type { UiIconId } from '../../art-assets';
import { displayName } from './card-presentation';
import { compactSentenceText, formatEffects } from './effect-text';

export function routeNodeTitle(node: RouteNode) {
  if (node.type === 'street') return 'Street';
  if (node.type === 'rival') return 'Rival';
  if (node.type === 'boss') return 'Boss';
  return node.label;
}


// Node FILL color encodes the crossing TYPE (so the map is readable at a glance
// without hovering); risk is shown as a small pip + in the legend/side panel.


export function routeNodeTypeLabel(type: RouteNode['type']) {
  switch (type) {
    case 'street': return 'Street Encounter';
    case 'rival': return 'Rival Crew';
    case 'boss': return 'Boss';
    case 'basin': return 'Lantern Roost';
    case 'nest': return 'Nest Workshop';
    case 'market': return 'Market';
    case 'signal': return 'Signal';
    case 'cache': return 'Rooftop Cache';
    default: return 'Crossing';
  }
}


export function routeEventAccent(type: RouteNode['type']) {
  switch (type) {
    case 'basin': return UI_FIELD.green;
    case 'nest': return UI_FIELD.cyan;
    case 'market': return UI_FIELD.gold;
    case 'signal': return 0xc9a6ff;
    case 'cache': return 0xffcf6b;
    default: return UI_FIELD.gold;
  }
}


export function routeEventLandmarkLine(type: RouteNode['type']) {
  switch (type) {
    case 'basin': return 'A warm roost landmark where recovery is treated like careful maintenance.';
    case 'nest': return 'A rooftop workshop landmark for tuning the flock before the next crossing.';
    case 'market': return 'A stall-lined landmark where route currency turns into momentum.';
    case 'signal': return 'A signal landmark where one choice changes the shape of the route.';
    case 'cache': return 'A hidden rooftop cache with one useful find waiting in the open.';
    default: return 'A marked crossing on the route.';
  }
}


export function nonCombatLesson(type: RouteNode['type']) {
  switch (type) {
    case 'basin': return 'Recover Cohesion, take shelter for Open Sky Guard, or trade Scrap for a Supply.';
    case 'nest': return 'Preen or Remove a card, or buy a Waymark to shape the deck.';
    case 'market': return 'Spend Scrap on cards, Waymarks, Supplies, and Preen/Remove.';
    case 'signal': return 'A route choice with trade-offs in Scrap, Cohesion, and risk.';
    case 'cache': return 'Choose one reward from the rooftop stash.';
    default: return 'A crossing on the route.';
  }
}


export function waymarkGlyph(mark: RuntimeRouteMark) {
  switch (mark.family) {
    case 'safety': return '+';
    case 'route': return '>';
    case 'economy': return '$';
    case 'suit': return '*';
    case 'molt': return '^';
    case 'bossPrep': return '!';
    default: return '#';
  }
}


export function routeMarkAccent(mark: RuntimeRouteMark) {
  switch (mark.family) {
    case 'safety': return 0x8fd6a0;
    case 'route': return 0x7ab8d6;
    case 'economy': return 0xe8c24a;
    case 'suit': return 0xc9a6ff;
    case 'molt': return 0xff9b6a;
    case 'bossPrep': return 0xff6b57;
    default: return 0x8fa3b6;
  }
}


export function routeMarkFamilyLabel(family: RuntimeRouteMark['family']) {
  switch (family) {
    case 'safety': return 'Shelter';
    case 'economy': return 'Economy';
    case 'route': return 'Tempo';
    case 'suit': return 'Suit';
    case 'molt': return 'Molt';
    case 'bossPrep': return 'Boss';
    default: return 'Waymark';
  }
}


export function formatWaymarkTrigger(trigger: string, effects: string[] = []) {
  const suit = /^onSuitPlayed\(([^)]+)\)$/.exec(trigger)?.[1];
  if (suit) return `First ${suit[0].toUpperCase()}${suit.slice(1)} card played each turn`;
  const nth = /^onNthCardThisTurn\((\d+)\)$/.exec(trigger)?.[1];
  if (nth) return `First time ${nth} cards are played in one turn each combat`;
  const lowCard = /^onLowCardTurn\((\d+)\)$/.exec(trigger)?.[1];
  if (lowCard) return `First Roost after playing 1–${lowCard} cards each combat`;
  const labels: Record<string, string> = {
    afterMarketPurchase: 'After each Market purchase',
    afterStreetEncounter: 'After each Street Encounter',
    basinHeal: 'When a Basin Stop heals the flock',
    cacheChoice: 'When choosing a Rooftop Cache reward',
    combatStart: 'At the start of each combat',
    firstOpenSkyIncrease: 'First Open Sky increase each combat',
    mapStart: 'At the start of the next district',
    onEnemyCoverBroken: 'First enemy Cover break each turn',
    onEnterMolt: 'First time the flock enters Molt each combat',
    onHealFlock: 'First time the flock heals each turn',
    onResonanceSpent: 'First time Resonance is spent each combat',
    onRoostWithCardsInHand: 'First Roost with cards in hand each combat',
    onRoostWithWingbeat: 'First Roost with unspent Wingbeat each combat',
    onSupplyUsed: effects.some(effect => parseEffect(effect)?.name === 'repeatNextSupply')
      ? 'Whenever a Supply is used' : 'First Supply used each combat',
    onTurnEndNoHpLoss: 'First enemy turn with no Cohesion loss each combat',
    onTurnEndNoOverextension: 'First Roost after playing cards without overextension each combat',
    signalResolved: 'After resolving a Signal',
  };
  return labels[trigger] ?? trigger.replace(/([a-z])([A-Z])/g, '$1 $2');
}


export function routeMarkEffects(mark: RuntimeRouteMark): string[] {
  if (Array.isArray(mark.effects) && mark.effects.length) return mark.effects;
  return mark.effect ? [mark.effect] : [];
}


export function routeMarkEffectText(mark: RuntimeRouteMark): string {
  return formatEffects(routeMarkEffects(mark));
}



export function supplyAccent(supply: RuntimeSupply) {
  switch (supply.category) {
    case 'snack': return 0x8fd6a0;
    case 'flare': return 0xffcf6b;
    case 'tool': return 0x7ab8d6;
    case 'call': return 0xc9a6ff;
    default: return 0xffb86b;
  }
}


export function supplyCategoryLabel(supply: RuntimeSupply) {
  switch (supply.category) {
    case 'snack': return 'Snack';
    case 'flare': return 'Signal';
    case 'tool': return 'Tool';
    case 'call': return 'Call';
    default: return supply.category;
  }
}




function addSynergyTag(tags: string[], tag: string) {
  if (!tags.includes(tag)) tags.push(tag);
}


function effectVerb(effect: string) {
  return parseEffect(effect)?.name ?? '';
}


export function waymarkSynergyTags(mark: RuntimeRouteMark) {
  const tags: string[] = [];
  const verbs = new Set(routeMarkEffects(mark).map(effectVerb));
  addSynergyTag(tags, routeMarkFamilyLabel(mark.family));
  if (mark.rarity === 'boss') addSynergyTag(tags, 'Boss');
  if (mark.trigger.startsWith('onSuitPlayed')) addSynergyTag(tags, 'Suit Engine');
  if (mark.trigger === 'onSupplyUsed') addSynergyTag(tags, 'Supply Combo');
  if (mark.trigger === 'onEnemyCoverBroken') addSynergyTag(tags, 'Anti-Cover');
  if (mark.trigger === 'onEnterMolt') addSynergyTag(tags, 'Molt');
  if (mark.trigger === 'onHealFlock' || mark.trigger === 'basinHeal') addSynergyTag(tags, 'Recovery');
  if (mark.trigger === 'cacheChoice') addSynergyTag(tags, 'Cache');
  if (mark.trigger === 'signalResolved') addSynergyTag(tags, 'Signal');
  if (mark.trigger === 'afterStreetEncounter' || mark.trigger === 'afterMarketPurchase') addSynergyTag(tags, 'Economy');
  if (mark.trigger === 'mapStart') addSynergyTag(tags, 'Next District');
  if (verbs.has('gainCover') || verbs.has('bossDamageShield') || verbs.has('gainCoverPerWaymark')) addSynergyTag(tags, 'Cover');
  if (verbs.has('heal') || verbs.has('addHeal')) addSynergyTag(tags, 'Recovery');
  if (verbs.has('draw') || verbs.has('nextTurnDraw')) addSynergyTag(tags, 'Draw');
  if (verbs.has('gainWingbeat') || verbs.has('gainEnergyNextTurn')) addSynergyTag(tags, 'Wingbeat');
  if (verbs.has('gainOpenSkyGuard') || verbs.has('reduceOpenSky') || verbs.has('reduceNextOpenSky')) addSynergyTag(tags, 'Open Sky');
  if (verbs.has('gainScrap') || verbs.has('reducePreenPrice')) addSynergyTag(tags, 'Economy');
  if (verbs.has('damageAll') || verbs.has('damage') || verbs.has('damagePierce')) addSynergyTag(tags, 'Pressure');
  if (verbs.has('gainResonance')) addSynergyTag(tags, 'Resonance');
  if (verbs.has('extraCacheChoice')) addSynergyTag(tags, 'Cache');
  if (verbs.has('freePreenNextDistrict') || verbs.has('districtStartKit')) addSynergyTag(tags, 'Preen');
  return tags.slice(0, 5);
}


// Human-readable summary of route-effect verbs for the node-choice overlay.
export function routeEffectSummary(effects: string[]): string {
  if (effects.length === 0) return 'No cost';
  return effects.map((effect) => {
    const parsed = parseEffect(effect);
    if (effect === 'startRivalBattle') return 'Start rival battle';
    if (!parsed) return effect;
    const a = parsed.args[0] ?? '';
    switch (parsed.name) {
      case 'gainScrap': return `+${a} Scrap`;
      case 'payScrap': return `Pay ${a} Scrap`;
      case 'loseCohesion': return `-${a} Cohesion`;
      case 'healCohesion': case 'heal': return `Heal ${a} Cohesion`;
      case 'healMissingPct': return `Heal ${a}% missing`;
      case 'gainRouteMark':
        if (a === 'randomRare') return 'Rare Waymark';
        if (a === 'randomUncommonOrRare') return 'High-tier Waymark';
        return alphaRouteMarkLibrary.get(a) ? `Gain ${alphaRouteMarkLibrary.get(a)!.name}` : 'Gain a Waymark';
      case 'gainSupply': return 'Gain a Supply';
      case 'gainSupplyChoice': return 'Pack a Supply';
      case 'peekNextNodes': return `Plan route: Open Sky Guard +1, Sky -${a || 1}`;
      case 'gainCacheReward': return 'Open cache';
      case 'addSnagToDiscard': case 'addSnagToDraw': return 'Add Snag';
      case 'addCard':
        if (a === 'chooseOneOfTwoRare') return 'Choose rare card';
        if (a === 'randomRare') return 'Add rare card';
        if (a === 'chooseOneOfTwoUncommonOrRare') return 'Choose high-tier card';
        if (a === 'randomUncommonOrRare') return 'Add high-tier card';
        return 'Add card';
      case 'preenCard': return `Preen ${a || 1}`;
      case 'releaseCard': return `Remove ${a || 1}`;
      case 'gainOpenSkyGuard': return `+${a} Sky Guard`;
      case 'reduceNextOpenSky': return `Open Sky -${a}`;
      case 'enemyCoverNextCombat': return `Enemy Cover +${a}`;
      case 'bossDamageShield': return `Boss Cover +${a}`;
      case 'extraCacheChoice': return `Cache +${a} choice`;
      case 'freePreenNextDistrict': return `Free Preen x${a || 1}`;
      case 'increaseSupplySlots': return `Supply capacity +${a || 1}`;
      case 'startNextCombatOpenSky': return 'Open Sky next fight';
      case 'revealNodes': return `Reveal ${a} nodes`;
      case 'skipNextStreet': return 'Skip the next street encounter';
      case 'removeRouteChoice': return 'Close a route';
      default: return parsed.name;
    }
  }).join(' / ');
}


export function routeEffectSummaryWithPreview(
  effects: string[],
  previewItem?: PendingRouteRewardItem,
  previewCards: Card[] = []
): string {
  if (effects.length === 0) return 'No cost';
  return effects.map((effect) => {
    const parsed = parseEffect(effect);
    if (!parsed) return effect === 'startRivalBattle' ? 'Start rival battle' : effect;
    if (previewItem?.kind === 'supply' && (parsed.name === 'gainSupply' || parsed.name === 'gainSupplyChoice')) {
      const supply = alphaSupplyLibrary.get(previewItem.id);
      return supply ? `Gain ${supply.name}` : routeEffectSummary([effect]);
    }
    if (previewItem?.kind === 'waymark' && parsed.name === 'gainRouteMark') {
      const mark = alphaRouteMarkLibrary.get(previewItem.id);
      return mark ? `Gain ${mark.name}` : routeEffectSummary([effect]);
    }
    if ((parsed.name === 'addSnagToDiscard' || parsed.name === 'addSnagToDraw') && previewCards.length) {
      const card = previewCards.find((candidate) => candidate.id === parsed.args[0]) ?? previewCards[0];
      return `Add ${displayName(card)} to the deck`;
    }
    if (parsed.name === 'addCard' && previewCards.length) {
      const card = previewCards.find((candidate) => candidate.runtime.kind !== 'snag');
      return card ? `Add ${displayName(card)}` : routeEffectSummary([effect]);
    }
    return routeEffectSummary([effect]);
  }).join(' / ');
}


function routeChoiceShortTell(effects: string[], lockedText?: string) {
  if (lockedText) return compactSentenceText(lockedText.replace(/\.$/, ''), 22, 1);
  const tokens = routeEffectTokens(effects);
  if (tokens.length === 0) return 'No cost';
  const labels = tokens.map((token) => {
    if (token.scrap) return `${token.label} Scrap`;
    if (token.cohesion && /^[+-]\d+/.test(token.label)) return `${token.label} Coh`;
    return token.label;
  });
  if (labels.length === 1) return compactSentenceText(labels[0], 22, 1);
  const pair = `${labels[0]} / ${labels[1]}`;
  if (labels.length === 2 && pair.length <= 22) return pair;
  return `${compactSentenceText(labels[0], 16, 1)} +${labels.length - 1}`;
}


interface RouteEffectToken {
  label: string;
  color: number;
  textColor: string;
  icon?: UiIconId;
  scrap?: boolean;
  cohesion?: boolean;
}


export function routeEffectTokens(effects: string[]): RouteEffectToken[] {
  if (effects.length === 0) {
    return [{ label: 'No cost', color: 0x49606d, textColor: '#b9c7d6', icon: 'route-neutral-medallion' }];
  }
  return effects.map((effect) => {
    const parsed = parseEffect(effect);
    if (effect === 'startRivalBattle') {
      return { label: 'Rival', color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'route-rival-medallion' };
    }
    if (!parsed) {
      return { label: effect, color: 0x49606d, textColor: '#dbe6f2', icon: 'route-pin' };
    }
    const a = parsed.args[0] ?? '';
    switch (parsed.name) {
      case 'gainScrap': return { label: `+${a}`, color: UI_FIELD.gold, textColor: '#fff0b8', icon: 'route-scrap-medallion', scrap: true };
      case 'payScrap': return { label: `-${a}`, color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'route-scrap-medallion', scrap: true };
      case 'loseCohesion': return { label: `-${a}`, color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'route-cohesion-medallion', cohesion: true };
      case 'healCohesion':
      case 'heal': return { label: `+${a}`, color: UI_FIELD.green, textColor: '#e4fbe9', icon: 'route-cohesion-medallion', cohesion: true };
      case 'healMissingPct': return { label: `Heal ${a}%`, color: UI_FIELD.green, textColor: '#e4fbe9', icon: 'route-cohesion-medallion', cohesion: true };
      case 'gainRouteMark': return {
        label: a === 'randomRare' ? 'Rare Waymark' : a === 'randomUncommonOrRare' ? 'High Waymark' : 'Waymark',
        color: UI_FIELD.violet,
        textColor: '#efe4ff',
        icon: 'route-waymark-medallion'
      };
      case 'gainSupply':
      case 'gainSupplyChoice': return { label: 'Supply', color: 0xffb86b, textColor: '#ffe7c9', icon: 'route-supply-medallion' };
      case 'peekNextNodes': return { label: `Plan / Sky -${a || 1}`, color: UI_FIELD.cyan, textColor: '#dffbff', icon: 'route-scout-medallion' };
      case 'revealNodes': return { label: `Preview ${a || 1}`, color: UI_FIELD.cyan, textColor: '#dffbff', icon: 'route-scout-medallion' };
      case 'gainCacheReward': return { label: 'Cache', color: UI_FIELD.gold, textColor: '#fff0b8', icon: 'cache-lockbox-medallion' };
      case 'addSnagToDiscard':
      case 'addSnagToDraw': return { label: 'Snag', color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'route-snag-medallion' };
      case 'addCard': return {
        label: a === 'chooseOneOfTwoRare' || a === 'randomRare'
          ? 'Rare card'
          : a === 'chooseOneOfTwoUncommonOrRare' || a === 'randomUncommonOrRare'
            ? 'High card'
            : 'Card',
        color: UI_FIELD.gold,
        textColor: '#fff0b8',
        icon: 'route-card-medallion'
      };
      case 'preenCard': return { label: `Preen ${a || 1}`, color: UI_FIELD.cyan, textColor: '#dffbff', icon: 'route-preen-medallion' };
      case 'releaseCard': return { label: `Remove ${a || 1}`, color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'route-release-medallion' };
      case 'gainOpenSkyGuard': return { label: `Guard ${a}`, color: UI_FIELD.green, textColor: '#e4fbe9', icon: 'sky-guard-medallion' };
      case 'reduceNextOpenSky': return { label: `Sky -${a}`, color: UI_FIELD.cyan, textColor: '#dffbff', icon: 'sky-guard-medallion' };
      case 'enemyCoverNextCombat': return { label: `Enemy +${a}`, color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'route-cover-medallion' };
      case 'bossDamageShield': return { label: `Boss fight +${a}`, color: UI_FIELD.green, textColor: '#e4fbe9', icon: 'route-cover-medallion' };
      case 'extraCacheChoice': return { label: `Cache +${a}`, color: UI_FIELD.gold, textColor: '#fff0b8', icon: 'cache-lockbox-medallion' };
      case 'freePreenNextDistrict': return { label: `Free Preen ${a || 1}`, color: UI_FIELD.cyan, textColor: '#dffbff', icon: 'route-preen-medallion' };
      case 'increaseSupplySlots': return { label: `Slot +${a || 1}`, color: 0xffb86b, textColor: '#ffe7c9', icon: 'route-supply-medallion' };
      case 'startNextCombatOpenSky': return { label: 'Open Sky', color: UI_FIELD.cyan, textColor: '#dffbff', icon: 'open-sky-medallion' };
      case 'skipNextStreet': return { label: 'Skip street', color: UI_FIELD.cyan, textColor: '#dffbff', icon: 'route-control-medallion' };
      case 'removeRouteChoice': return { label: 'Close route', color: UI_FIELD.danger, textColor: '#ffd5cc', icon: 'route-control-medallion' };
      default: return { label: parsed.name, color: 0x49606d, textColor: '#dbe6f2', icon: 'route-pin' };
    }
  });
}


export function routeNodeRecovery(node: RouteNode, routeMarkIds: string[] = []) {
  if (node.type === 'basin') {
    const bonus = routeMarkIds.reduce((total, id) => {
      const mark = alphaRouteMarkLibrary.get(id);
      if (!mark || mark.trigger !== 'basinHeal') return total;
      return total + routeMarkEffects(mark).reduce((sum, effect) => {
        const parsed = parseEffect(effect);
        return parsed?.name === 'addHeal' ? sum + parseEffectValue(parsed.args[1] ?? parsed.args[0], 0) : sum;
      }, 0);
    }, 0);
    return 8 + bonus;
  }
  if (node.type === 'cache') return 3;
  return 0;
}


export function routeNodeResolutionText(node: RouteNode, result: { recovery?: number; scrap?: number; preened?: Card } = {}) {
  if (node.type === 'basin') return `${node.label}: the flock recovers ${result.recovery ?? 0} Cohesion.`;
  if (node.type === 'nest') {
    return result.preened
      ? `${node.label}: ${result.preened.name} is preened.`
      : `${node.label}: the flock checks gear; nothing needs preening.`;
  }
  if (node.type === 'market') return `${node.label}: market business settled.`;
  if (node.type === 'cache') return `${node.label}: cache found. +${result.scrap ?? 0} Scrap and a Waymark if available.`;
  if (node.type === 'signal') {
    return result.scrap
      ? `${node.label}: a street signal points the way. +${result.scrap} Scrap.`
      : `${node.label}: a street signal points the way.`;
  }
  return `${node.label}: route stop cleared.`;
}


// Reward tuning lives in encounter reward profiles, not on enemy definitions
// (next-level-data-contracts Â§3; impl-spec "reward tuning does not live on enemy
// definitions"). Resolve the route node's encounter -> reward profile.
export function rewardProfileForRouteNode(routeNode: RouteNode | undefined): RewardProfile | undefined {
  if (!routeNode) return undefined;
  const encounter = alphaEncounterLibrary.get(routeNode.payloadId);
  if (!encounter) return undefined;
  return alphaRewardProfileLibrary.get(encounter.rewardProfileId);
}


export function combatScrapReward(routeNode: RouteNode | undefined) {
  const reward = rewardProfileForRouteNode(routeNode)?.scrap;
  if (Array.isArray(reward)) return Math.round((reward[0] + reward[1]) / 2);
  if (typeof reward === 'number') return reward;
  if (routeNode?.type === 'boss') return 120;
  return 0;
}
