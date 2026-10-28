import type { RuntimeEnemy } from './types';
/** Encounter-specific loops retain canonical species/art. Every payload lookup
 * uses these loops, including previews and live combat. */
export function tacticalFormation(id: string, enemies: RuntimeEnemy[]): RuntimeEnemy[] {
  if (!['enc_canal_open_perch', 'enc_canal_alternating_watch', 'enc_spire_quiet_beat'].includes(id)) return enemies;
  return enemies.map((original, i) => {
    const bird = structuredClone(original);
    const moves = id === 'enc_canal_open_perch'
      ? i === 0 ? [
        ['Hold the Landing', 'gainCover(4)'], ['Landing Strike', 'damage(flock, 9)'], ['Recover footing'],
      ] : [
        ['Signal the Landing', 'nextAttackBonusAlly(front, 3)'], ['Watch the Crossing', 'gainCoverAlly(front, 4)'], ['Recover footing'],
      ]
      : id === 'enc_canal_alternating_watch'
        ? i === 0 ? [['First Watch', 'damage(flock, 8)'], ['Shelter Watch', 'gainCover(4)'], ['Recover footing']]
          : [['Shelter Watch', 'gainCover(4)'], ['Second Watch', 'damage(flock, 10)'], ['Recover footing']]
        : [['Gather Force', 'nextAttackBonus(3)'], ['Crosswind Strike', 'damage(flock, 10)'], ['Quiet Beat']];
    bird.health = id === 'enc_spire_quiet_beat' ? 34 : i === 0 ? 28 : 18;
    bird.lesson = id === 'enc_canal_open_perch' ? i === 0
      ? 'Braces, strikes with stored force, then recovers. Removing its support stops future aid; stored force remains.'
      : 'Signals 3 stored force to the front living ally, then shields it for 4 Cover, then recovers.'
      : id === 'enc_canal_alternating_watch' ? i === 0
        ? 'Strikes while its partner braces, then braces while its partner strikes. Both recover on beat three.'
        : 'Braces while its partner strikes, then strikes while its partner braces. Both recover on beat three.'
        : 'Gathers 3 force, strikes, then takes a Quiet Beat with no effects. Prepare protection before the strike.';
    bird.moves = moves.map(([label, ...effects], n) => ({ id: `${id}-${i}-${n}`, label, effects }));
    bird.attackPattern = { type: 'cycle', moveIds: bird.moves.map(m => m.id) };
    return bird;
  });
}
