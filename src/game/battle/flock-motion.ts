import Phaser from 'phaser';
import { loadedCardArtKey, prefersReducedMotion, killTweensForTree, FLOCK_FX_X, FLOCK_FX_Y, suitAccentColor, textPaceScale, UI_FONT, displayName, type Card, type ActiveCardContract } from '../../main';
import { prefersLeanEffects } from '../graphics-quality';
import { battleActors } from './actors';
import { cardObjects, paintFlightCard, FLIGHT_CARD } from './card-objects';
import { flightControl, flightPoint, flightProgress } from './card-object-rules';
import { CARD_W, GAME_WIDTH, HAND_Y } from '../shared/layout-constants';
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

/** The played card never climbs into the top bar. */
const FLIGHT_CEILING = 104;

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
  host.time.delayedCall(budget * .22, () => { if (host.motionFocus === focus) focus.phase = 'commit'; });
  host.time.delayedCall(budget * .70, () => { if (host.motionFocus === focus) focus.phase = 'settle'; });
  host.time.delayedCall(budget, () => { if (host.motionFocus === focus) focus.active = false; });
  host.events.emit('living-cast', budget, style, enemyId);
  host.queueFlockMotion(style === 'shelter' ? 'brace' : style === 'retreat' ? 'heal' : 'cast');
  const crowded = host.enemies.length >= 4;
  const enemy = host.enemies.find((entry: any) => entry.id === enemyId && entry.hp > 0);
  const stage = cardObjects(host);
  if (reduced) {
    // Still cue. Four-enemy formations occupy the center lane, so it uses the
    // clear pocket below the HUD and above the leader's head.
    const actor = host.add.container(crowded ? 385 : 450, crowded ? 142 : 190)
      .setName('combat-card-cast-ghost').setDepth(40)
      .setScale(crowded ? .58 : 1)
      .setData({ actionStyle: style, cardId: card.id, budgetMs: budget, reducedMotion: reduced });
    host.fxLayer.add(actor);
    paintFlightCard(host, actor, card);
    // A single grounding mark also distinguishes the still cues without relying
    // on color: attack slash, cover roof, rally wings, retreat landing line.
    const mark = host.add.graphics().lineStyle(3, suitAccentColor(card), 0.85);
    if (style === 'shelter') mark.strokePoints([{ x: -44, y: -48 }, { x: 0, y: -70 }, { x: 44, y: -48 }]);
    else if (style === 'rally') mark.strokePoints([{ x: -48, y: -18 }, { x: -40, y: -40 }, { x: -26, y: -28 }]);
    else if (style === 'retreat') mark.lineBetween(-42, 62, 42, 62);
    else mark.lineBetween(-50, style === 'swoop' ? 44 : 0, -28, style === 'swoop' ? 16 : 0);
    actor.add(mark);
    stage.landing = undefined;
    host.time.delayedCall(budget, () => { if (actor.active) { killTweensForTree(host, actor); actor.destroy(true); } });
    return;
  }
  // The card itself is thrown: out of its hand slot (or from under the pointer
  // after a drag), along an arc with a little spin, landing on its target as
  // the existing resolution budget ends. Presentation only: no wait is added.
  const body = battleActors(host).actors.get(`card:${card.instanceId}`);
  const from = body ? { x: body.slot.x + body.pose.x, y: body.slot.y + body.pose.y } : { x: GAME_WIDTH / 2, y: HAND_Y };
  const startScale = (CARD_W / FLIGHT_CARD.width) * (body ? body.pose.scaleX : 0.7);
  const endScale = crowded ? 0.58 : contract.target === 'enemy' ? 0.82 : 0.9;
  const living = host.enemies.filter((entry: any) => entry.hp > 0).map((entry: any) => host.enemyView(entry));
  const view = enemy ? host.enemyView(enemy) : undefined;
  // On the body, above the enemy's intent and name plate.
  const to = contract.target === 'enemy' && view ? { x: view.x - 34, y: view.y - 30 * view.scale }
    : contract.target === 'allEnemies' && living.length
      ? { x: living.reduce((sum: number, entry: any) => sum + entry.x, 0) / living.length - 20, y: living.reduce((sum: number, entry: any) => sum + entry.y, 0) / living.length + 6 }
      : contract.target === 'self' ? { x: FLOCK_FX_X + 26, y: FLOCK_FX_Y - 30 }
        : { x: GAME_WIDTH / 2, y: 262 };
  const half = FLIGHT_CARD.height / 2;
  to.y = Math.max(to.y, FLIGHT_CEILING + half * endScale + 4);
  const control = flightControl(from, to, half * Math.max(endScale, 1), FLIGHT_CEILING);
  const spin = style === 'shelter' || style === 'retreat' ? -5 : to.x >= from.x ? 13 : -13;
  const actor = host.add.container(from.x, from.y)
    .setName('combat-card-cast-ghost').setDepth(40).setScale(startScale).setAngle(body?.pose.angle ?? 0)
    .setData({ actionStyle: style, cardId: card.id, budgetMs: budget, reducedMotion: reduced, from, to, endScale });
  host.fxLayer.add(actor);
  paintFlightCard(host, actor, card);
  stage.landing = { ...to, scale: endScale };
  const startAngle = actor.angle;
  (actor as any).flight = 0;
  host.tweens.add({
    targets: actor, flight: 1, duration: budget * host.tweens.timeScale, ease: 'Linear',
    onUpdate: () => {
      if (!actor.active) return;
      const { lift, travel } = flightProgress((actor as any).flight);
      const point = flightPoint(from, control, to, travel);
      actor.setPosition(point.x, point.y - 16 * lift * (1 - travel))
        .setScale((startScale + (endScale - startScale) * travel) * (1 + 0.05 * lift * (1 - travel)))
        .setAngle(startAngle + (spin - startAngle) * travel + (travel > 0 ? 0 : -2 * lift));
    },
  });
  host.time.delayedCall(budget, () => { if (actor.active) { killTweensForTree(host, actor); actor.destroy(true); } });
}

/** Reuses the combination lane after resolution; never replaces selection math. */
export function presentCardPayoff(host: any, card: Card, total?: CardContribution, before?: CardContribution) {
  const actor = host.fxLayer?.getByName('combat-card-cast-ghost');
  if (actor) { killTweensForTree(host, actor); actor.destroy(true); }
  if (!total) return;
  const delta = emptyContribution(card.id);
  for (const key of contributionKeys) delta[key] = Math.max(0, total[key] - (before?.[key] ?? 0));
  const results = contributionResults(delta);
  const partner = host.flockCombination?.cardId === card.id ? host.flockCombination : undefined;
  delete host.flockCombination;
  const victory = host.signatureWin?.();
  const objective = host.encounterObjectiveStatus?.();
  const consequence = victory?.reason ?? (objective?.status === 'complete' ? `${objective.title} · +${objective.bonusScrap} Scrap on victory` : undefined);
  host.motionPayoff = {
    text: `Resolved: ${displayName(card)} · ${results[0] ?? 'effects applied'}`,
    detail: `${card.bird} · ${displayName(card)}. ${results.join(' · ') || 'No tracked numeric changes.'}${partner ? ` ${partner.name}: ${partner.first} → ${displayName(card)}.` : ''}${consequence ? ` ${consequence}.` : ''}`,
    until: host.time.now + 2200 * textPaceScale(), cardId: card.id, results,
  };
  if (host.motionFocus?.instanceId === card.instanceId) {
    const focus = host.motionFocus;
    focus.phase = 'contact'; focus.active = true;
    host.time.delayedCall(90, () => { if (host.motionFocus === focus) focus.phase = 'recovery'; });
    host.time.delayedCall(240, () => { if (host.motionFocus === focus) focus.active = false; });
  }
}
