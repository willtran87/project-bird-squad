import { hashSeed } from './route-gen';

export interface OpeningDrawCard {
  id: string;
  cost: number;
  target: string;
  runtime: { kind: string };
}

export interface OpeningDrawState {
  shuffled: boolean;
  protectionSwaps: number;
}

export function deterministicChance(key: string, chance: number): boolean {
  if (chance <= 0) return false;
  if (chance >= 1) return true;
  return (hashSeed(key, 0x9e3779b9) / 0xffffffff) < chance;
}

export function seededRng(key: string) {
  let state = hashSeed(key, 0x85ebca6b) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function deterministicRankedIds(ids: string[], key: string) {
  return [...new Set(ids)].sort((a, b) => {
    const scoreA = hashSeed(`${key}:${a}`, 0x27d4eb2d);
    const scoreB = hashSeed(`${key}:${b}`, 0x27d4eb2d);
    return scoreA - scoreB || a.localeCompare(b);
  });
}

export function rarityStep(rarity: string): number {
  if (rarity === 'legendary' || rarity === 'boss') return 3;
  if (rarity === 'rare') return 2;
  if (rarity === 'uncommon') return 1;
  return 0;
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export function finiteInt(value: unknown, fallback: number, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  const number = Number.isFinite(value) ? Number(value) : fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

export function prepareOpeningDraw<T extends OpeningDrawCard>(
  cards: T[],
  seedKey: string,
  shuffleDeck: boolean,
  handSize: number,
  energy = 3,
): { deck: T[]; state: OpeningDrawState } {
  const deck = [...cards];
  if (shuffleDeck) {
    const random = seededRng(seedKey);
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
    }
  }
  const limit = Math.min(handSize, deck.length);
  const playable = (card: T) => card.cost <= energy && card.runtime.kind !== 'snag';
  const pressure = (card: T) => playable(card) && (card.target === 'enemy' || card.target === 'allEnemies');
  let protectionSwaps = 0;
  const swapCandidate = (candidate: (card: T) => boolean, victim: (card: T) => boolean) => {
    const source = deck.findIndex((card, index) => index >= limit && candidate(card));
    let target = -1;
    for (let index = limit - 1; index >= 0; index -= 1) {
      if (victim(deck[index])) {
        target = index;
        break;
      }
    }
    if (source < 0 || target < 0) return false;
    [deck[target], deck[source]] = [deck[source], deck[target]];
    protectionSwaps += 1;
    return true;
  };

  const availablePlayable = Math.min(2, deck.filter(playable).length, limit);
  while (deck.slice(0, limit).filter(playable).length < availablePlayable) {
    if (!swapCandidate(playable, (card) => !playable(card))) break;
  }
  if (!deck.slice(0, limit).some(pressure) && deck.some(pressure)) {
    swapCandidate(pressure, (card) => !pressure(card));
  }

  return {
    deck,
    state: {
      shuffled: shuffleDeck,
      protectionSwaps,
    },
  };
}
