import { currentTermIntroduction, termIntroductionAccent, type ActiveTermIntroduction } from '../term-introductions';
import { formatEffects } from '../shared/effect-text';
import { currentMove } from '../shared/enemy-moves';
import { flockStatuses } from '../shared/combat-status';
import { textPaceScale } from '../shared/preferences';
import { enemyStatus } from '../enemy-display';
import type { BattleScene } from '../../main';

// Typed access to the battle scene fields a first-encounter callout reads.
type CalloutScene = {
  activeTermIntroduction?: ActiveTermIntroduction;
  turn: number;
  time: { now: number };
  hand: BattleScene['hand'];
  enemies: BattleScene['enemies'];
  flock: BattleScene['flock'];
  activeCardContract: BattleScene['activeCardContract'];
  flockState: BattleScene['flockState'];
  battleStartingData: BattleScene['battleStartingData'];
};

const calloutBattle = new WeakMap<object, unknown>();

/**
 * First encounter of a mid-run term (a card in hand, an enemy move or status,
 * or a flock state that uses it): one callout at a time, once per profile,
 * shown through the existing guidance lane.
 */
export function battleTermCallout(raw: BattleScene) {
  const scene = raw as unknown as CalloutScene;
  // A callout belongs to one battle; init() replaces battleStartingData.
  if (calloutBattle.get(raw) !== scene.battleStartingData) scene.activeTermIntroduction = undefined;
  calloutBattle.set(raw, scene.battleStartingData);
  scene.activeTermIntroduction = currentTermIntroduction(scene.activeTermIntroduction, {
    turn: scene.turn,
    now: scene.time.now,
    textPaceScale: textPaceScale(),
    sources: () => [
      ...scene.hand.map((card) => scene.activeCardContract(card).text),
      ...scene.enemies.filter((enemy) => enemy.hp > 0)
        .flatMap((enemy) => [formatEffects(currentMove(enemy).effects), enemyStatus(enemy)]),
      ...flockStatuses(scene.flock),
      scene.flockState(),
    ],
  });
  const intro = scene.activeTermIntroduction;
  return intro ? { text: intro.text, accent: termIntroductionAccent(intro.term) } : undefined;
}
