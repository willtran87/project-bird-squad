import Phaser from 'phaser';
import { loadedCardArtKey, prefersReducedMotion, killTweensForTree, FLOCK_FX_X, FLOCK_FX_Y, suitAccentColor, textPaceScale, UI_FONT, displayName, type Card, type ActiveCardContract } from '../../main';
import { prefersLeanEffects } from '../graphics-quality';
import { contributionKeys, contributionResults, emptyContribution, type CardContribution } from '../card-contributions';

export type FlockAction = 'swoop' | 'shove' | 'shelter' | 'rally' | 'retreat';
export function flockAction(card: Card, contract: ActiveCardContract): FlockAction {
  const effects = contract.effects.join(' ');
  if (/\bdamage\(/.test(effects) || contract.target === 'enemy' || contract.target === 'allEnemies') {
    return card.runtime.suit === 'quills' ? 'swoop' : 'shove';
  }
  if (/\b(gainCover|gainOpenSkyGuard)\(/.test(effects)) return 'shelter';
  if (/\b(heal|returnDiscard|removeFouled|removeRuffled)\(/.test(effects)) return 'retreat';
  return 'rally';
}

/** One canonical illustrated actor. Existing card voices and resolved-effect
 * presenters provide sound and impact; this adds neither a wait nor a projectile. */
export function playFlockAction(host: any, card: Card, enemyId: string, contract: ActiveCardContract, budget: number) {
  if (!host.fxLayer?.active) return;
  const old = host.fxLayer.getByName('combat-card-cast-ghost');
  if (old) { killTweensForTree(host, old); old.destroy(); }
  const style = flockAction(card, contract), reduced = prefersReducedMotion() || prefersLeanEffects();
  host.queueFlockMotion(style === 'shelter' ? 'brace' : style === 'retreat' ? 'heal' : 'cast');
  const actor = host.add.container(FLOCK_FX_X + 185, FLOCK_FX_Y - 128)
    .setName('combat-card-cast-ghost').setDepth(40)
    .setData({ actionStyle: style, cardId: card.id, budgetMs: budget, reducedMotion: reduced });
  host.fxLayer.add(actor);
  const key = loadedCardArtKey(host, card), accent = suitAccentColor(card);
  actor.add(host.add.rectangle(0, 0, 76, 114, 0x07101c, 0.96).setStrokeStyle(2, accent, 0.8));
  if (key && host.textures.exists(key)) {
    actor.add(host.add.image(0, 0, key).setDisplaySize(72, 108).setName('flock-action-canonical-art'));
  } else {
    actor.add(host.add.text(0, 0, displayName(card), { fontFamily: UI_FONT, fontSize: '18px',
      color: '#fff1cf', wordWrap: { width: 72 }, align: 'center', resolution: 2 })
      .setOrigin(0.5).setName('flock-action-art-fallback'));
  }
  // A single grounding mark also distinguishes the still cues without relying
  // on color: attack slash, cover roof, rally wings, retreat landing line.
  const mark = host.add.graphics().lineStyle(3, accent, 0.85);
  if (style === 'shelter') mark.strokePoints([{ x: -44, y: -48 }, { x: 0, y: -70 }, { x: 44, y: -48 }]);
  else if (style === 'rally') mark.strokePoints([{ x: -48, y: -18 }, { x: -40, y: -40 }, { x: -26, y: -28 }]);
  else if (style === 'retreat') mark.lineBetween(-42, 62, 42, 62);
  else mark.lineBetween(-50, style === 'swoop' ? 44 : 0, -28, style === 'swoop' ? 16 : 0);
  actor.add(mark);
  const enemy = host.enemies.find((entry: any) => entry.id === enemyId && entry.hp > 0);
  const target = enemy ? host.enemyView(enemy) : { x: FLOCK_FX_X + 230, y: FLOCK_FX_Y };
  const travel = Math.min(170, Math.max(40, target.x - actor.x - 80));
  const end = {
    swoop: { x: actor.x + travel, y: actor.y + 16, angle: 14 },
    shove: { x: actor.x + travel * 0.65, y: actor.y, angle: -5 },
    shelter: { x: actor.x - 20, y: actor.y + 12, angle: 0 },
    rally: { x: actor.x + 24, y: actor.y - 28, angle: -8 },
    retreat: { x: actor.x - 62, y: actor.y + 22, angle: 6 },
  }[style];
  if (!reduced) {
    if (style === 'swoop') actor.y -= 32;
    host.tweens.add({ targets: actor, ...end, scale: style === 'shelter' ? 1.06 : 0.92,
      duration: budget * 0.85 * host.tweens.timeScale, ease: style === 'shove' ? 'Cubic.easeIn' : 'Sine.easeInOut' });
  }
  host.time.delayedCall(budget, () => { if (actor.active) { killTweensForTree(host, actor); actor.destroy(true); } });
}

/** Reuses the combination lane after resolution; never replaces selection math. */
export function presentCardPayoff(host: any, card: Card, total?: CardContribution, before?: CardContribution) {
  if (!total) return;
  const delta = emptyContribution(card.id);
  for (const key of contributionKeys) delta[key] = Math.max(0, total[key] - (before?.[key] ?? 0));
  const results = contributionResults(delta);
  host.motionPayoff = results.length ? {
    text: `Resolved: ${results.slice(0, 2).join(' · ')}`,
    until: host.time.now + 2200 * textPaceScale(), cardId: card.id, results,
  } : undefined;
}
