// Authoritative hand-size rule shared by live combat and saved-deck analysis.
export const BASE_HAND_TARGET = 4;

export function flockHandTarget(drawBonus: number, plumesKeystone: boolean, leaderId: string | undefined, nextTurnBonus = 0) {
  return Math.max(0, BASE_HAND_TARGET + drawBonus + nextTurnBonus
    + (plumesKeystone && leaderId !== 'spark_caller' ? 1 : 0));
}
