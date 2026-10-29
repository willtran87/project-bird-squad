import type { RuntimeEnemy } from './types';

export const signatureFights = {
  enc_signature_ferry: { name: 'The Last Ferry', lesson: 'Hold the crossing for three enemy beats. The gull attacks while the crow shields it; from beat four both retreat to weaker attacks. Defeat both to win.', phases: ['Ferry loading · 1/3', 'Ferry crossing · 2/3', 'Ferry landing · 3/3', 'Ferry safe · watch retreating'] },
  enc_signature_relay: { name: 'Before the Bell', lesson: 'The relay crow charges the front ally on its third Tell. Remove the crow before then to stop the charge. Stored force remains; the gull attacks on beat four.', phases: ['Relay winding · 1/3', 'Relay winding · 2/3', 'Last chance · relay charge next', 'Relay cycle · watch stored force'] },
  enc_signature_watch: { name: 'Two Moving Rooftops', lesson: 'The gull attacks while the crow braces, then they exchange roles. Both recover on beat three. From beat four their attack order reverses for the rest of the fight.', phases: ['Gull advances · crow shelters', 'Crow advances · gull shelters', 'Both recover · positions switching', 'Positions reversed · read each Tell'] },
};
export type SignatureFight = keyof typeof signatureFights;
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
  const phase = id === 'enc_signature_relay' ? Math.min(3, beat % 5) : Math.min(3, beat);
  return { name: fight.name, phase, text: id === 'enc_signature_relay' && enemies[1]?.hp <= 0 ? 'Relay silenced · stored force still applies' : fight.phases[phase], lesson: fight.lesson };
}
