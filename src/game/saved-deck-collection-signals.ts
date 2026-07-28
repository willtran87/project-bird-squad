import type { CardCollectionRecord } from './meta';
import type { SavedDeckRecord } from './saved-decks';
import type { RuntimeCard } from './types';

const SIGNAL_LIST_LIMIT = 5;
const MAX_DISPLAY_TIMESTAMP = 253_402_300_799_999;

export interface SavedDeckCollectionSignalCard {
  id: string;
  name: string;
  timesClaimed: number;
  firstAcquiredAt: number;
  folioCount: number;
  activeFolioCount: number;
  inSelectedFolio: boolean;
}

export interface SavedDeckCollectionSignalPair {
  first: { id: string; name: string };
  second: { id: string; name: string };
  folioCount: number;
  activeFolioCount: number;
  bothInSelectedFolio: boolean;
}

export interface SavedDeckCollectionSignals {
  deckId: string;
  deckName: string;
  ownedCount: number;
  folioCount: number;
  activeFolioCount: number;
  archivedFolioCount: number;
  unusedCount: number;
  unused: SavedDeckCollectionSignalCard[];
  frequentlyFiled: SavedDeckCollectionSignalCard[];
  recentlyAcquired: SavedDeckCollectionSignalCard[];
  commonlyPaired: SavedDeckCollectionSignalPair[];
  rules: {
    listLimit: number;
    usageUnit: 'distinct saved Folios';
    includesArchive: true;
    duplicateCopiesCountOncePerFolio: true;
    recentUsesFirstAcquiredAt: true;
    pairingsRequireSameFolio: true;
    pairingsTouchSelectedFolio: true;
    descriptiveOnly: true;
    editsFolio: false;
    affectsPower: false;
  };
}

function safeCount(value: unknown) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0;
}

function safeTime(value: unknown) {
  return Number.isFinite(value)
    ? Math.min(MAX_DISPLAY_TIMESTAMP, Math.max(0, Math.floor(Number(value))))
    : 0;
}

function nameFor(id: string, library: ReadonlyMap<string, Pick<RuntimeCard, 'displayName'>>) {
  return library.get(id)?.displayName ?? id;
}

function pairKey(firstId: string, secondId: string) {
  return firstId < secondId ? `${firstId}\u0000${secondId}` : `${secondId}\u0000${firstId}`;
}

export function analyzeSavedDeckCollectionSignals(
  selectedDeck: SavedDeckRecord,
  savedDecks: readonly SavedDeckRecord[],
  collection: Readonly<Record<string, CardCollectionRecord>>,
  library: ReadonlyMap<string, Pick<RuntimeCard, 'displayName'>>,
): SavedDeckCollectionSignals {
  const ownedIds = Object.entries(collection)
    .filter(([id, record]) => safeCount(record?.timesClaimed) > 0 && library.has(id))
    .map(([id]) => id);
  const ownedSet = new Set(ownedIds);
  const selectedIds = new Set(selectedDeck.cards.map((card) => card.id).filter((id) => ownedSet.has(id)));
  const folioUsage = new Map<string, { total: number; active: number }>();
  const pairingUsage = new Map<string, { total: number; active: number }>();

  savedDecks.forEach((deck) => {
    const ids = [...new Set(deck.cards.map((card) => card.id).filter((id) => ownedSet.has(id)))].sort();
    ids.forEach((id) => {
      const current = folioUsage.get(id) ?? { total: 0, active: 0 };
      current.total += 1;
      if (!deck.archived) current.active += 1;
      folioUsage.set(id, current);
    });
    for (let firstIndex = 0; firstIndex < ids.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < ids.length; secondIndex += 1) {
        const key = pairKey(ids[firstIndex], ids[secondIndex]);
        const current = pairingUsage.get(key) ?? { total: 0, active: 0 };
        current.total += 1;
        if (!deck.archived) current.active += 1;
        pairingUsage.set(key, current);
      }
    }
  });

  const cards = ownedIds.map((id): SavedDeckCollectionSignalCard => {
    const record = collection[id];
    const usage = folioUsage.get(id) ?? { total: 0, active: 0 };
    return {
      id,
      name: nameFor(id, library),
      timesClaimed: safeCount(record?.timesClaimed),
      firstAcquiredAt: safeTime(record?.firstAcquiredAt),
      folioCount: usage.total,
      activeFolioCount: usage.active,
      inSelectedFolio: selectedIds.has(id),
    };
  });
  const byName = (first: SavedDeckCollectionSignalCard, second: SavedDeckCollectionSignalCard) => (
    first.name.localeCompare(second.name) || first.id.localeCompare(second.id)
  );
  const unusedAll = cards
    .filter((card) => card.folioCount === 0)
    .sort((first, second) => second.firstAcquiredAt - first.firstAcquiredAt || byName(first, second));
  const frequentlyFiled = cards
    .filter((card) => card.folioCount > 0)
    .sort((first, second) => (
      second.folioCount - first.folioCount
      || second.activeFolioCount - first.activeFolioCount
      || Number(second.inSelectedFolio) - Number(first.inSelectedFolio)
      || byName(first, second)
    ))
    .slice(0, SIGNAL_LIST_LIMIT);
  const recentlyAcquired = [...cards]
    .sort((first, second) => second.firstAcquiredAt - first.firstAcquiredAt || byName(first, second))
    .slice(0, SIGNAL_LIST_LIMIT);
  const commonlyPaired = [...pairingUsage.entries()].flatMap(([key, usage]): SavedDeckCollectionSignalPair[] => {
    const [firstId, secondId] = key.split('\u0000');
    if (!selectedIds.has(firstId) && !selectedIds.has(secondId)) return [];
    return [{
      first: { id: firstId, name: nameFor(firstId, library) },
      second: { id: secondId, name: nameFor(secondId, library) },
      folioCount: usage.total,
      activeFolioCount: usage.active,
      bothInSelectedFolio: selectedIds.has(firstId) && selectedIds.has(secondId),
    }];
  }).sort((first, second) => (
    second.folioCount - first.folioCount
    || second.activeFolioCount - first.activeFolioCount
    || Number(second.bothInSelectedFolio) - Number(first.bothInSelectedFolio)
    || first.first.name.localeCompare(second.first.name)
    || first.second.name.localeCompare(second.second.name)
  )).slice(0, SIGNAL_LIST_LIMIT);

  return {
    deckId: selectedDeck.id,
    deckName: selectedDeck.name,
    ownedCount: cards.length,
    folioCount: savedDecks.length,
    activeFolioCount: savedDecks.filter((deck) => !deck.archived).length,
    archivedFolioCount: savedDecks.filter((deck) => deck.archived).length,
    unusedCount: unusedAll.length,
    unused: unusedAll.slice(0, SIGNAL_LIST_LIMIT),
    frequentlyFiled,
    recentlyAcquired,
    commonlyPaired,
    rules: {
      listLimit: SIGNAL_LIST_LIMIT,
      usageUnit: 'distinct saved Folios',
      includesArchive: true,
      duplicateCopiesCountOncePerFolio: true,
      recentUsesFirstAcquiredAt: true,
      pairingsRequireSameFolio: true,
      pairingsTouchSelectedFolio: true,
      descriptiveOnly: true,
      editsFolio: false,
      affectsPower: false,
    },
  };
}
