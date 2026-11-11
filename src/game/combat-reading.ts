import { firstFlightGuideState } from './first-flight-guide';
import { combinations } from './flyway-rules';

/** Uses the current legal hand only. No future draws or invented flock members. */
export function combinationReading(scene: any): string | undefined {
  const guide = firstFlightGuideState();
  // The existing selection/target/Roost guide owns the first turn's teaching.
  if (guide.enabled && !guide.completed && scene.isGuidedFirstCombat?.()) return;
  if (scene.flyway?.coachingOff) return;
  const combat = scene.flightCombat;
  const next = combinations.filter(c => c.first === combat.previousSuit && !combat.combos.includes(c.id));
  const available = next.find(c => scene.hand.some((card: any) => card.runtime.suit === c.second && scene.effectiveCost(card) <= scene.energy));
  if (available) return `${available.name}: ${available.first} → ${available.second}`;
  return combat.previousSuit ? `Last suit: ${combat.previousSuit} · choose your next bird`
    : 'Choose a bird. Check its cost, target and the enemy Tell.';
}

/** A brief tactical question for the existing encounters, derived from resolved
 * enemy beats. Rewards and victory conditions remain owned by gameplay. */
export function encounterDecision(id: string, enemies: any[], defeated: Map<string, number>): string | undefined {
  const living = enemies.filter(e => e.hp > 0);
  if (!living.length) return;
  const beat = Math.min(...living.map(e => e.intentIndex));
  if (id === 'enc_canal_alternating_watch') return beat % 3 === 2
    ? 'Both recover now. Answer with retained strikes, or prepare for the next attack.'
    : 'One attacks while one braces. Cover the hit, or focus a defender to reduce pressure.';
  if (id === 'enc_canal_open_perch') return beat % 3 === 2
    ? 'Recovery beat: spend your prepared sequence, or rebuild protection.'
    : living.some(e => e.nextAttackBonus > 0)
      ? 'Stored force is ready. Cover the strike or finish the attacker; removing support will not erase it.'
      : 'Build a short sequence, or remove support before it stores force. Check your Wingbeats.';
  if (id === 'enc_spire_quiet_beat') return beat % 3 === 2
    ? 'Quiet Beat: attack or rebuild. Molt changes the hand; inspect its alternate rules.'
    : beat % 3 === 0 ? 'Hit now to interrupt Gather Force, or prepare Cover for the stronger strike.'
      : living.some(e => e.nextAttackBonus > 0) ? 'Stored force is ready. Cover the charged strike or finish the attacker.'
        : 'Preparation interrupted: the base strike remains. Cover it or finish the attacker.';
  if (id === 'enc_signature_ferry') return beat < 3
    ? `Survive ${3 - beat} more beat${beat === 2 ? '' : 's'}, or clear both for +8 Scrap.`
    : 'Crossing secured.';
  if (id === 'enc_signature_relay') {
    if (enemies[1]?.hp > 0 && enemies[1].intentIndex < 3)
      return 'Stop the relay before Tell 3, or prepare for its empowered attack.';
    return living.some(e => e.nextAttackBonus > 0)
      ? 'Stored force remains. Cover the next hit or finish the attacker.'
      : 'Defeat the remaining defenders. Compare their Tells before you Roost.';
  }
  if (id === 'enc_signature_watch') {
    const gap = enemies.some(e => e.hp <= 0) && [...defeated.values()].some(turn => turn <= 3);
    return gap ? 'Gap opened: survive beat 3, or defeat both for +8 Scrap.'
      : beat < 3 ? 'Break either perch before beat 3. Compare their Tells.'
      : 'Escape window missed. Defeat both defenders to win.';
  }
}
