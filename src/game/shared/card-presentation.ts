import type Phaser from 'phaser';
import type { ActiveCardContract, Card, CardRole, TargetType } from './runtime-types';
import { cardArtAssets, cardThumbArtAssets, snagCardBorderAsset } from '../../art-assets';
import type { UiAdd } from './ui-helpers';

export function displayName(card: Card) {
  return card.upgraded ? `${card.name}+` : card.name;
}


export function isAviaryCard(card: Pick<Card, 'id'>) {
  return card.id.startsWith('aviary_');
}


export function cardLabel(card: Card) {
  if (isSnagCard(card)) return 'SNAG';
  if (isAviaryCard(card)) return 'AVIARY';
  if (card.type === 'major') return 'LEGEND';
  if (card.type === 'minor') return suitLabel(card);
  return 'MOLT';
}


export function fallbackCardColorCue(card: Card) {
  const label = cardLabel(card);
  const glyph = label === 'PLUMES'
    ? '▲'
    : label === 'BASINS'
      ? '≈'
      : label === 'QUILLS'
        ? '◇'
        : label === 'NESTS'
          ? '■'
          : label === 'LEGEND'
            ? '★'
            : label === 'AVIARY'
              ? '»'
              : label === 'SNAG'
                ? '×'
                : '○';
  return `${glyph} ${label}`;
}


function suitLabel(card: Card) {
  if (card.runtime.suit === 'plumes') return 'PLUMES';
  if (card.runtime.suit === 'basins') return 'BASINS';
  if (card.runtime.suit === 'quills') return 'QUILLS';
  if (card.runtime.suit === 'nests') return 'NESTS';
  return 'CREW';
}


function cardArtKey(card: Card) {
  return cardArtAssets[card.id]?.key;
}


export function compactCardArtKey(card: Card) {
  return cardCompactArtAsset(card)?.key;
}


export function loadedCardArtKey(scene: Phaser.Scene, card: Card) {
  const full = cardArtKey(card);
  if (full && scene.textures.exists(full)) return full;
  const compact = compactCardArtKey(card);
  if (compact && scene.textures.exists(compact)) return compact;
  return undefined;
}


export function isSnagCard(card: Pick<Card, 'runtime'>) {
  return card.runtime.kind === 'snag';
}


export function renderSnagCardBorder(
  scene: Phaser.Scene,
  addTo: UiAdd | undefined,
  card: Pick<Card, 'runtime'>,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 1
) {
  if (!isSnagCard(card) || !scene.textures.exists(snagCardBorderAsset.key)) return false;
  const bg = scene.add.rectangle(x, y, width, height, 0x07090d, Math.min(0.98, alpha));
  const frame = scene.add.image(x, y, snagCardBorderAsset.key)
    .setAlpha(alpha);
  frame.setScale(Math.min(width / frame.width, height / frame.height));
  if (addTo) {
    addTo(bg);
    addTo(frame);
  }
  return true;
}


export function cardCompactArtAsset(card: Pick<Card, 'id'>) {
  return cardThumbArtAssets[card.id] ?? cardArtAssets[card.id];
}


export function displayText(card: Card) {
  return card.upgraded ? card.upgradedText : card.text;
}


function activeMoltEffects(card: Card) {
  return card.upgraded && card.runtime.upgrade.moltEffects?.length
    ? (card.runtime.upgrade.moltEffects as string[])
    : (card.runtime.moltEffects ?? []);
}


function activeMoltText(card: Card) {
  if (card.upgraded && card.moltTextUpgraded) return card.moltTextUpgraded;
  return card.moltText;
}


function effectBody(effect: string) {
  return effect.replace(/^if .+? then /, '');
}


function effectsNeedEnemyTarget(effects: string[]) {
  return effects.some((effect) => {
    const body = effectBody(effect);
    return /\b(?:damage|damagePierce|applyWinded|removeCover)\(target\b/.test(body)
      || /\b(?:resonanceBurst|windedBurst)\(/.test(body)
      || /\bperWinded\b/.test(body)
      || /\btarget(?:BelowHalf|IntendsAttack|HasCover|Winded)\b/.test(effect)
      || /\bwindedAtLeast\(/.test(effect);
  });
}


function effectsHitAllEnemies(effects: string[]) {
  return effects.some((effect) => /\bdamageAll\(/.test(effectBody(effect)));
}


function effectsOnlyAffectFlock(effects: string[]) {
  return effects.some((effect) => {
    const body = effectBody(effect);
    return /\b(?:gainCover|applyOpenSky|loseCover|damageFlock|heal|overhealCover|loseCohesion|draw|discard|discardUpTo|gainWingbeat|loseWingbeat|gainResonance|spendResonance|enterMolt|gainOpenSkyGuard|returnDiscard|nextCoverBonus|nextTurnDraw|gainEnergyNextTurn|enemyNextAttackBonus|enemyGainCover|shuffleSelfToDraw|exhaustSelf)\(/.test(body);
  });
}


function effectsActAsAttack(effects: string[]) {
  return effects.some((effect) => {
    const body = effectBody(effect);
    return /\b(?:damage|damagePierce|damageAll|removeCover|resonanceBurst|windedBurst)\(/.test(body)
      || /\bapplyWinded\(target\b/.test(body)
      || /\btarget(?:BelowHalf|IntendsAttack|HasCover|Winded)\b/.test(effect)
      || /\bwindedAtLeast\(/.test(effect);
  });
}


function effectsActAsSkill(effects: string[]) {
  return effects.some((effect) => {
    const body = effectBody(effect);
    return /\b(?:gainCover|heal|overhealCover|cleanseFlock|gainOpenSkyGuard|nextCoverBonus|retainHand)\(/.test(body);
  });
}


function inferActiveTarget(baseTarget: TargetType, effects: string[]): TargetType {
  if (effectsNeedEnemyTarget(effects)) return 'enemy';
  if (effectsHitAllEnemies(effects)) return 'allEnemies';
  if (baseTarget === 'choice') return 'choice';
  if (effectsOnlyAffectFlock(effects)) return baseTarget === 'none' ? 'none' : 'self';
  return baseTarget;
}


function inferActiveRole(effects: string[], fallback: CardRole): CardRole {
  if (effectsActAsAttack(effects)) return 'attack';
  if (effectsActAsSkill(effects)) return 'skill';
  if (effects.length) return 'utility';
  return fallback;
}


export function activeCardContract(card: Card, molting: boolean): ActiveCardContract {
  const moltEffects = activeMoltEffects(card);
  const usesMolt = molting && moltEffects.length > 0;
  const effects = usesMolt
    ? moltEffects
    : (card.upgraded ? card.runtime.upgrade.effects : card.runtime.effects);
  return {
    effects,
    text: usesMolt ? activeMoltText(card) : displayText(card),
    target: usesMolt ? inferActiveTarget(card.target, effects) : card.target,
    baseTarget: card.target,
    role: inferActiveRole(effects, card.role),
    usesMolt,
    label: usesMolt ? 'Molt' : 'Normal',
  };
}
