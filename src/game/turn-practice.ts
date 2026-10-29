import { hashSeed } from './route-gen';
/** Same LCG as seededRng, with an explicit private checkpoint for turn practice. */
export function combatRandom(key: string) {
  let state = hashSeed(key, 0x85ebca6b) >>> 0;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000);
  return Object.assign(random, {snapshot: () => state, restore: (value: number) => { state = value >>> 0; }});
}
/** Plain combat data only. Phaser objects, timers and hidden draws never enter an export. */
const fields = `flock enemies hand drawPile discardPile clearedPile openingDraw energy nextTurnEnergyBonus nextTurnDrawBonus pendingNestCoverBonus pendingRetainHand roostRetainPool roostRetainPriorityInstanceId pendingSupplyRepeats spark turn selectedEnemyId flightCombat flyway routeMarks runSupplies runSuppliesUsed runSeenEnemyMoves scrap runScrapEarned runScrapSpent playedCardIdsThisCombat playedSuitsThisTurn markFiredThisCombat markFiredThisTurn markFirstOpenSkyConsumed cardsPlayedThisTurn firstAttackThisTurn leaderSignatureUsed fledglingSuitRallies enemyDefeatedTurns zeroCostThisTurn roostCards roostFree roostHeld cardContributions log combatHistory waymarkFeedback supplyFeedback killedByMove encounterObjectiveFeedbackStatus`.split(' ');
type Host = Record<string, any>;
export type TurnResult = { cohesion: number; cover: number; wingbeats: number; resonance: number; survivors: number; damage: number };
export type TurnCheckpoint = { values: Record<string, any>; random: number; result?: TurnResult };
export function turnResult(scene: Host): TurnResult {
  return { cohesion: scene.flock.hp, cover: scene.flock.block, wingbeats: scene.energy, resonance: scene.spark,
    survivors: scene.enemies.filter((enemy: any) => enemy.hp > 0).length, damage: scene.statDealt };
}
export function captureTurn(scene: Host): void {
  if (scene.practiceTurn) return;
  const keys = [...fields, ...Object.keys(scene).filter(key => key.startsWith('stat'))];
  scene.turnCheckpoint = { values: structuredClone(Object.fromEntries(keys.map(key => [key, scene[key]]))), random: scene.combatRandom.snapshot() } satisfies TurnCheckpoint;
}
export function finishPracticeTurn(scene: Host): void {
  if (scene.practiceTurn) {
    if (!scene.practiceTurnResult) scene.practiceTurnResult = turnResult(scene);
  } else if (scene.turnCheckpoint && !scene.turnCheckpoint.result) scene.turnCheckpoint.result = turnResult(scene);
}
export function restoreTurn(scene: Host, checkpoint: TurnCheckpoint): void {
  Object.assign(scene, structuredClone(checkpoint.values));
  scene.combatRandom.restore(checkpoint.random);
  scene.turnCheckpoint = structuredClone(checkpoint);
  scene.practiceTurn = true;
  scene.practiceTurnResult = undefined;
}
