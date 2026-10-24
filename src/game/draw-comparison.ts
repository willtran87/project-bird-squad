/** Uniform sampling benchmark, deliberately separate from protected openers. */
export function singleCardDrawChance(deckSize: number, handTarget: number) {
  if (!Number.isFinite(deckSize) || deckSize < 1 || !Number.isFinite(handTarget)) return 0;
  return Math.min(1, Math.max(0, Math.floor(handTarget)) / Math.floor(deckSize));
}

export function drawComparison(beforeSize: number, afterSize: number, beforeHand: number, afterHand: number) {
  const percent = (size: number, hand: number) => `${(singleCardDrawChance(size, hand) * 100).toFixed(1)}%`;
  return `Each retained card: ${percent(beforeSize, beforeHand)} > ${percent(afterSize, afterHand)} chance in a base-size hand. `
    + 'Benchmark: uniformly shuffled full deck, no replacement. Protected opening draws, Retain, Waymarks and temporary effects can change actual odds. ' 
    + 'A removed card has 0% chance; a new card shares the after chance. Passive Flock Stats apply without drawing the card.';
}
