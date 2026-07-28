import type { SavedDeckCard, SavedDeckRecord } from './saved-decks';

export interface SavedDeckFlightSnapshot {
  id: string;
  seed: string;
  result: 'win' | 'loss';
  leaderId: string;
  difficulty: string;
  runMode: 'full' | 'quick';
  completedAtMs: number;
  durationMs: number;
  currentCohesion: number;
  maxCohesion: number;
  turns: number;
  deck: SavedDeckCard[];
}

export interface SavedDeckFieldRecord {
  flights: number;
  wins: number;
  losses: number;
  winRate: number;
  averageTurns: number | null;
  fastestWinTurns: number | null;
  bestCohesionPercent: number | null;
  recent: SavedDeckFlightSnapshot[];
  exactMatchRules: {
    leader: true;
    runMode: true;
    cardOrder: true;
    preenedState: true;
  };
}

function deckShape(
  leaderId: string,
  runMode: SavedDeckRecord['runMode'],
  cards: readonly SavedDeckCard[],
) {
  return JSON.stringify([
    leaderId,
    runMode,
    cards.map((card) => [card.id, card.upgraded ? 1 : 0]),
  ]);
}

export function buildSavedDeckFieldRecord(
  deck: SavedDeckRecord,
  flights: readonly SavedDeckFlightSnapshot[],
): SavedDeckFieldRecord {
  const shape = deckShape(deck.leaderId, deck.runMode, deck.cards);
  const matching = flights
    .filter((flight) => deckShape(flight.leaderId, flight.runMode, flight.deck) === shape)
    .sort((left, right) => (
      right.completedAtMs - left.completedAtMs
      || right.id.localeCompare(left.id)
    ));
  const wins = matching.filter((flight) => flight.result === 'win');
  const totalTurns = matching.reduce((sum, flight) => sum + Math.max(0, flight.turns), 0);
  const cohesionPercents = matching
    .filter((flight) => flight.maxCohesion > 0)
    .map((flight) => Math.round(flight.currentCohesion / flight.maxCohesion * 100));
  return {
    flights: matching.length,
    wins: wins.length,
    losses: matching.length - wins.length,
    winRate: matching.length > 0 ? Math.round(wins.length / matching.length * 100) : 0,
    averageTurns: matching.length > 0
      ? Number((totalTurns / matching.length).toFixed(1))
      : null,
    fastestWinTurns: wins.length > 0
      ? Math.min(...wins.map((flight) => flight.turns))
      : null,
    bestCohesionPercent: cohesionPercents.length > 0
      ? Math.max(...cohesionPercents)
      : null,
    recent: matching.slice(0, 5).map((flight) => ({
      ...flight,
      deck: flight.deck.map((card) => ({ ...card })),
    })),
    exactMatchRules: {
      leader: true,
      runMode: true,
      cardOrder: true,
      preenedState: true,
    },
  };
}
