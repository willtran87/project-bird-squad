import { readJournaledJson } from './safe-storage';

const ACTIVE_RUN_KEY = 'birdsquad.run.active';

export type ActiveFlightCardState = 'base' | 'preened';

export interface ActiveFlightCardUsage {
  deckSize: number;
  cards: Record<string, ActiveFlightCardState>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function loadActiveFlightCardUsage(
  validCardIds: ReadonlySet<string>,
): ActiveFlightCardUsage | undefined {
  return readJournaledJson(ACTIVE_RUN_KEY, (value) => {
    if (!isRecord(value) || !Array.isArray(value.deck)) return undefined;
    const cards: Record<string, ActiveFlightCardState> = {};
    value.deck.forEach((entry) => {
      if (!isRecord(entry) || typeof entry.id !== 'string' || !validCardIds.has(entry.id)) return;
      if (!cards[entry.id] || entry.upgraded === true) {
        cards[entry.id] = entry.upgraded === true ? 'preened' : 'base';
      }
    });
    const deckSize = Object.keys(cards).length;
    return deckSize > 0 ? { deckSize, cards } : undefined;
  });
}
