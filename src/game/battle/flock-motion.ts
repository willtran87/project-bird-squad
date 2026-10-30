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
  const targetName = contract.target === 'enemy' ? host.enemies.find((e: any) => e.id === enemyId)?.name ?? 'Target'
    : contract.target === 'allEnemies' ? 'All enemies' : 'Your flock';
  const focus = { cardId: card.id, instanceId: card.instanceId, name: displayName(card), bird: card.bird,
    target: targetName, style, phase: 'anticipation', active: true };
  host.motionFocus = focus;
  host.time.delayedCall(budget * .25, () => { if (host.motionFocus === focus) focus.phase = 'commit'; });
  host.time.delayedCall(budget, () => { if (host.motionFocus === focus) focus.active = false; });
  host.events.emit('living-cast', budget, style, enemyId);
  host.queueFlockMotion(style === 'shelter' ? 'brace' : style === 'retreat' ? 'heal' : 'cast');
  const crowded = host.enemies.length >= 4;
  // Four-enemy formations occupy the center lane. Use the clear pocket below
  // the HUD and above the leader's head instead of crossing the first support.
  const actor = host.add.container(crowded ? 385 : 450, crowded ? 142 : 190)
    .setName('combat-card-cast-ghost').setDepth(40)
    .setScale(crowded ? .58 : 1)
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
  const travel = crowded ? 0 : Math.min(64, Math.max(0, target.x - actor.x - 170));
  const end = {
    swoop: { x: actor.x + travel, y: actor.y + 6, angle: 4 },
    shove: { x: actor.x + travel * 0.65, y: actor.y + 4, angle: -3 },
    shelter: { x: actor.x - 4, y: actor.y + 4, angle: 0 },
    rally: { x: actor.x + 8, y: actor.y - 4, angle: -3 },
    retreat: { x: actor.x - 8, y: actor.y + 4, angle: 3 },
  }[style];
  if (!reduced) {
    // Anticipate in the safe pocket, commit once, then settle before impact.
    // All three segments fit inside the existing resolution budget.
    const start = { x: actor.x, y: actor.y, angle: 0 };
    host.tweens.chain({ targets: actor, tweens: [
      { x: start.x - 3, y: start.y + 2, duration: budget * .22 * host.tweens.timeScale, ease: 'Sine.easeOut' },
      { ...end, duration: budget * .48 * host.tweens.timeScale, ease: style === 'shove' ? 'Cubic.easeIn' : 'Sine.easeInOut' },
      { x: start.x + (end.x - start.x) * .85, y: start.y, angle: 0, duration: budget * .15 * host.tweens.timeScale, ease: 'Sine.easeOut' },
    ] });
  }
  host.time.delayedCall(budget, () => { if (actor.active) { killTweensForTree(host, actor); actor.destroy(true); } });
}

/** Reuses the combination lane after resolution; never replaces selection math. */
export function presentCardPayoff(host: any, card: Card, total?: CardContribution, before?: CardContribution) {
  if (!total) return;
  const delta = emptyContribution(card.id);
  for (const key of contributionKeys) delta[key] = Math.max(0, total[key] - (before?.[key] ?? 0));
  const results = contributionResults(delta);
  const partner = host.flockCombination?.cardId === card.id ? host.flockCombination : undefined;
  delete host.flockCombination;
  host.motionPayoff = {
    text: `Resolved: ${displayName(card)} · ${results[0] ?? 'effects applied'}`,
    detail: `${card.bird} · ${displayName(card)}. ${results.join(' · ') || 'No tracked numeric changes.'}${partner ? ` ${partner.name}: ${partner.first} → ${displayName(card)}.` : ''}`,
    until: host.time.now + 2200 * textPaceScale(), cardId: card.id, results,
  };
  if (host.motionFocus?.instanceId === card.instanceId) {
    const focus = host.motionFocus;
    focus.phase = 'contact'; focus.active = true;
    host.time.delayedCall(90, () => { if (host.motionFocus === focus) focus.phase = 'recovery'; });
    host.time.delayedCall(240, () => { if (host.motionFocus === focus) focus.active = false; });
  }
}
