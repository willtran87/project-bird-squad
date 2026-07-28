import { sanitizeSavedDecks } from './saved-decks';

export interface CardFolioUsage {
  total: number;
  active: number;
  archived: number;
  folioIds: string[];
}

export type CardFolioUsageIndex = Record<string, CardFolioUsage>;

/**
 * Derives collection-browser usage from private saved Flight Folios.
 * A card counts at most once per Folio even if malformed input repeats it.
 */
export function cardFolioUsageIndex(value: unknown): CardFolioUsageIndex {
  const usage: CardFolioUsageIndex = {};
  for (const folio of sanitizeSavedDecks(value)) {
    for (const cardId of new Set(folio.cards.map((card) => card.id))) {
      const current = usage[cardId] ?? {
        total: 0,
        active: 0,
        archived: 0,
        folioIds: [],
      };
      current.total += 1;
      if (folio.archived) current.archived += 1;
      else current.active += 1;
      current.folioIds.push(folio.id);
      usage[cardId] = current;
    }
  }
  return usage;
}
