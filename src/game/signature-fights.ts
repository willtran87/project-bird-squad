import type { RuntimeEnemy } from './types';

export const signatureFights = {
  enc_signature_ferry: { name: 'The Last Ferry', lesson: 'Survive three enemy beats to win the crossing. Defeat both defenders sooner for +8 Scrap. The gull attacks while the crow shields it.', phases: ['Survive · crossing 1/3', 'Survive · crossing 2/3', 'Survive · crossing 3/3', 'Ferry safe · crossing won'] },
  enc_signature_relay: { name: 'Before the Bell', lesson: 'Defeat the relay crow before its third Tell to win by interception. If it rings, defeat both enemies to win; stored force remains. Defeating both grants +8 Scrap.', phases: ['Intercept crow · before beat 3', 'Intercept crow · before beat 3', 'Last chance · stop the relay', 'Bell rang · defeat both'] },
  enc_signature_watch: { name: 'Two Moving Rooftops', lesson: 'Defeat either defender before the third enemy beat, then survive that beat to escape through the gap. Otherwise defeat both to win. Defeating both grants +8 Scrap.', phases: ['Break one perch · then escape', 'Break one perch · then escape', 'Escape window · survive beat 3', 'Window closed · defeat both'] },
};
export type SignatureFight = keyof typeof signatureFights;
/** Intent counters advance only after a Tell resolves; never infer survival from the player turn number. */
export function signatureVictory(id: string, enemies: Array<{ hp: number; intentIndex: number }>, hp: number, defeatedTurns: Map<string, number> = new Map()) {
  if (hp <= 0 || !Object.hasOwn(signatureFights, id)) return undefined;
  if (enemies.length && enemies.every(e => e.hp <= 0)) return { reason: 'Both defenders defeated', bonus: 8 };
  const survivors = enemies.filter(e => e.hp > 0);
  if (id === 'enc_signature_ferry' && survivors.length && survivors.every(e => e.intentIndex >= 3)) return { reason: 'The ferry crosses safely', bonus: 0 };
  if (id === 'enc_signature_relay' && enemies[1]?.hp <= 0 && enemies[1].intentIndex < 3) return { reason: 'Relay intercepted; the watch withdraws', bonus: 0 };
  if (id === 'enc_signature_watch' && enemies.some(e => e.hp <= 0) && [...defeatedTurns.values()].some(turn => turn <= 3)
    && survivors.length && survivors.every(e => e.intentIndex >= 3)) return { reason: 'Formation broken; the flock escapes', bonus: 0 };
  return undefined;
}
export function signatureFormation(id: string, enemies: RuntimeEnemy[]): RuntimeEnemy[] | undefined {
  if (!Object.hasOwn(signatureFights, id)) return;
  const fight = signatureFights[id as SignatureFight];
  return enemies.map((original, index) => {
    const bird = structuredClone(original), front = index === 0;
    const moves = id === 'enc_signature_ferry' ? front
      ? [['Guard the Dock', 'damage(flock, 7)'], ['Block the Passage', 'damage(flock, 8)'], ['Last Toll', 'damage(flock, 9)'], ['Retreating Peck', 'damage(flock, 4)'], ['Give Ground']]
      : [['Dock Shield', 'gainCoverAlly(front, 3)'], ['Dock Shield', 'gainCoverAlly(front, 3)'], ['Last Shield', 'gainCoverAlly(front, 3)'], ['Retreating Peck', 'damage(flock, 3)'], ['Give Ground']]
      : id === 'enc_signature_relay' ? front
        ? [['Watch the Bell', 'gainCover(3)'], ['Crossing Peck', 'damage(flock, 5)'], ['Wait for Signal'], ['Charged Crossing', 'damage(flock, 9)'], ['Recover footing']]
        : [['Wind the Relay', 'gainCover(2)'], ['Raise the Bell'], ['Sound the Relay', 'nextAttackBonusAlly(front, 6)'], ['Relay Peck', 'damage(flock, 4)'], ['Recover footing']]
        : front
          ? [['First Roof Strike', 'damage(flock, 8)'], ['First Roof Shelter', 'gainCover(5)'], ['Change Perches'], ['Second Roof Shelter', 'gainCover(5)'], ['Second Roof Strike', 'damage(flock, 8)'], ['Recover footing']]
          : [['Second Roof Shelter', 'gainCover(5)'], ['Second Roof Strike', 'damage(flock, 8)'], ['Change Perches'], ['First Roof Strike', 'damage(flock, 8)'], ['First Roof Shelter', 'gainCover(5)'], ['Recover footing']];
    bird.health = front ? 32 : 20;
    bird.lesson = fight.lesson;
    bird.moves = moves.map(([label, ...effects], n) => ({ id: `${id}-${index}-${n}`, label, effects }));
    bird.attackPattern = { type: 'scripted', moveIds: bird.moves.map(m => m.id), loopFrom: id === 'enc_signature_relay' ? 0 : 3 };
    return bird;
  });
}
export function signaturePhase(id: string, enemies: Array<{ hp: number; intentIndex: number }>) {
  if (!Object.hasOwn(signatureFights, id)) return undefined;
  const fight = signatureFights[id as SignatureFight];
  const beat = Math.max(0, ...enemies.filter(e => e.hp > 0).map(e => e.intentIndex));
  const phase = Math.min(3, beat);
  return { name: fight.name, phase, text: id === 'enc_signature_relay' && enemies[1]?.hp <= 0 ? 'Relay silenced · stored force still applies' : fight.phases[phase], lesson: fight.lesson };
}
