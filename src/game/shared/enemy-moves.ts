import { tacticalFormation } from '../tactical-formations';
import { alphaEncounterLibrary, alphaEnemyLibrary } from '../runtime-data';
import type { RuntimeEnemy, EnemyMove } from '../types';
import type { Enemy, Flock } from './runtime-types';

// Resolve a combat route node's payloadId (an encounter id) to EVERY enemy the
// encounter declares, via the combined enemy library (Map 1 + districts). Falls
// back to a raw enemy id for backward compatibility (next-level-data-contracts Â§4).
export function getEncounterEnemiesByPayload(payloadId: string | undefined): RuntimeEnemy[] {
  const encounter = payloadId ? alphaEncounterLibrary.get(payloadId) : undefined;
  if (encounter) {
    return tacticalFormation(encounter.id, encounter.enemies.map((enemyId) => {
      const enemy = alphaEnemyLibrary.get(enemyId);
      if (!enemy) throw new Error(`Encounter ${payloadId} references missing enemy: ${enemyId}`);
      return enemy;
    }));
  }
  const enemy = payloadId ? alphaEnemyLibrary.get(payloadId) : undefined;
  if (!enemy) throw new Error(`Missing encounter payload: ${payloadId}`);
  return [enemy];
}



// Select the enemy's current move by walking its attack pattern with intentIndex
// (next-level-data-contracts Â§2). intentIndex is unbounded; the pattern maps it.
export function currentMove(enemy: Enemy, context = enemyMoveContext): EnemyMove {
  if (enemy.flywayBroken) return { id: 'flyway-stagger', label: 'Disrupted: regaining footing', effects: [] };
  const { moves, attackPattern } = enemy.runtime;
  const byId = (id: string) => moves.find((move) => move.id === id) ?? moves[0];
  const i = enemy.intentIndex;
  const phaseIds = enemy.phase === 2 ? enemy.runtime.phaseTwoMoveIds : undefined;
  if (phaseIds?.length) return byId(phaseIds[i % phaseIds.length]);
  switch (attackPattern.type) {
    case 'cycle':
      return byId(attackPattern.moveIds[i % attackPattern.moveIds.length]);
    case 'scripted': {
      const ids = attackPattern.moveIds;
      if (i < ids.length) return byId(ids[i]);
      const loopFrom = attackPattern.loopFrom ?? 0;
      const loopLen = Math.max(1, ids.length - loopFrom);
      return byId(ids[loopFrom + ((i - ids.length) % loopLen)]);
    }
    case 'weighted': {
      // Deterministic weighted cycle: expand entries by weight and walk by
      // intentIndex so frequencies honor the weights AND the telegraphed intent
      // always matches the move that later executes (no per-call RNG drift).
      const expanded = attackPattern.entries.flatMap((entry) =>
        Array<string>(Math.max(1, entry.weight ?? 1)).fill(entry.moveId));
      return byId(expanded[i % expanded.length]);
    }
    case 'conditional': {
      const hit = attackPattern.entries.find((entry) => context && evaluateEnemyCondition(entry.if, enemy, context));
      return byId(hit ? hit.moveId : attackPattern.fallback);
    }
    default:
      return moves[i % moves.length];
  }
}


export function moveDealsDamage(move: EnemyMove): boolean {
  return move.effects.some((effect) => /(?:^|then )damage\(flock/.test(effect));
}


// Live flock/turn snapshot so the free `currentMove`/`evalPatternCondition`
// functions can evaluate conditional attack patterns (which branch on flock
// state) without a scene reference. BattleScene refreshes it before any move
// is selected for rendering or execution.
export interface EnemyMoveContext {
  flock: Flock;
  turn: number;
  c: number;
  z: number;
  h: number;
}


let enemyMoveContext: EnemyMoveContext | null = null;
export function setEnemyMoveContext(value: typeof enemyMoveContext) {
  enemyMoveContext = value;
}


// The single source of truth for the closed enemy/pattern condition grammar
// (next-level-data-contracts Â§1.3). Used by both the per-effect gate
// (checkEnemyCondition) and the attack-pattern selector (evalPatternCondition),
// so authored `conditional` patterns branch on exactly the same rules cards do.
export function evaluateEnemyCondition(condition: string, enemy: Enemy, context: EnemyMoveContext): boolean {
  const { flock, turn } = context;
  const turnGate = condition.match(/^turn >= (\d+)$/);
  if (turnGate) return turn >= Number(turnGate[1]);
  const playedCardsAtLeast = condition.match(/^playedCardsAtLeast\((\d+)\)$/);
  if (playedCardsAtLeast) return context.c >= Number(playedCardsAtLeast[1]);
  const zeroCostCardsAtLeast = condition.match(/^zeroCostCardsAtLeast\((\d+)\)$/);
  if (zeroCostCardsAtLeast) return context.z >= Number(zeroCostCardsAtLeast[1]);
  if (condition === 'handEmptyAtRoost') return context.c > 0 && context.h === 0;
  if (condition === 'notHitThisTurn') return !enemy.hitThisTurn;
  if (condition === 'flockHasNoCover') return flock.block <= 0;
  if (condition === 'flockHasCover') return flock.block > 0;
  if (condition === 'isMolting') return flock.molt;
  if (condition === 'flockOpenSky') return flock.exposed;
  if (condition === 'flockCohesionBelowHalf') return flock.hp < flock.maxHp / 2;
  if (condition === 'selfBelowHalf') return enemy.hp < enemy.maxHp / 2;
  return false;
}


function evalPatternCondition(condition: string, enemy: Enemy): boolean {
  if (!enemyMoveContext) return false; // no live flock/turn yet Ã¢â€ â€™ use pattern fallback
  return evaluateEnemyCondition(condition, enemy, enemyMoveContext);
}
