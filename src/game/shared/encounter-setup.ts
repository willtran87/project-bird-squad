import { type FlywayState, rivalFormation } from '../flyway-rules';
import { alphaEnemyLibrary } from '../runtime-data';
import type { RouteNode } from '../types';
import type { Enemy, Flock } from './runtime-types';
import { MULTI_ENCOUNTER_DAMAGE_BONUS, MULTI_ENCOUNTER_HEALTH_MULT, SOLO_ENCOUNTER_DAMAGE_BONUS, SOLO_ENCOUNTER_HEALTH_MULT } from './gameplay-constants';
import { currentCombatNodes } from './run-session';
import { getEncounterEnemiesByPayload } from './enemy-moves';

export function createFlock(): Flock {
  return {
    hp: 36,
    maxHp: 36,
    block: 0,
    weak: 0,
    frail: 0,
    fouled: 0,
    exposed: false,
    exposedTurns: 0,
    molt: false,
    openSkyGuard: 0,
    openSkyReduction: 0,
    flow: 0,
    flowMax: 5
  };
}


export function selectedCombatRouteNode(routeNodeId: string | undefined) {
  if (routeNodeId) {
    const routeNode = currentCombatNodes().find((node) => node.id === routeNodeId);
    if (routeNode) return routeNode;
  }
  return currentCombatNodes()[0];
}



// Build every enemy an encounter declares (its enemies[] array). When the same
// enemy id appears more than once, each instance gets a unique id ("roof_rat#0")
// and a disambiguating display suffix ("Roof Rat A") so targeting/selection and
// per-enemy state stay independent.
export function createEncounterEnemiesForRouteNode(routeNode: RouteNode, flyway?: FlywayState): Enemy[] {
  const runtimes = routeNode.type === 'rival' && flyway && flyway.rivalWins<3
    ? rivalFormation(flyway.rivalWins, id=>alphaEnemyLibrary.get(id)!)
    : getEncounterEnemiesByPayload(routeNode.payloadId);
  const solo = runtimes.length === 1 && routeNode.type !== 'boss';
  const multi = runtimes.length > 1 && routeNode.type !== 'boss';
  const totalById = new Map<string, number>();
  runtimes.forEach((r) => totalById.set(r.id, (totalById.get(r.id) ?? 0) + 1));
  const seenById = new Map<string, number>();
  return runtimes.map((runtime) => {
    const seen = seenById.get(runtime.id) ?? 0;
    seenById.set(runtime.id, seen + 1);
    const duplicated = (totalById.get(runtime.id) ?? 1) > 1;
    const maxHp = solo
      ? Math.ceil(runtime.health * SOLO_ENCOUNTER_HEALTH_MULT)
      : multi
        ? Math.ceil(runtime.health * MULTI_ENCOUNTER_HEALTH_MULT)
        : runtime.health;
    return {
      id: duplicated ? `${runtime.id}#${seen}` : runtime.id,
      name: duplicated ? `${runtime.name} ${String.fromCharCode(65 + seen)}` : runtime.name,
      hp: maxHp,
      maxHp,
      block: 0,
      weak: 0,
      intentIndex: 0,
      phase: 1,
      hitThisTurn: false,
      nextAttackBonus: 0,
      damageBonus: solo ? SOLO_ENCOUNTER_DAMAGE_BONUS : (multi ? MULTI_ENCOUNTER_DAMAGE_BONUS : 0),
      roles: runtime.roles ?? [],
      solo,
      runtime
    };
  });
}
