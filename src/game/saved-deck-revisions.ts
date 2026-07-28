import {
  activeSavedDecks,
  createSavedDeckRecord,
  SAVED_DECK_LIMIT,
  SAVED_DECK_NAME_LIMIT,
  type SavedDeckCard,
  type SavedDeckRecord,
} from './saved-decks';

export type SavedDeckRevisionChangeKind = 'replaced' | 'added' | 'removed' | 'state';

export interface SavedDeckRevisionCardChange {
  position: number;
  kind: SavedDeckRevisionChangeKind;
  current?: SavedDeckCard;
  target?: SavedDeckCard;
}

export interface SavedDeckRevisionComparison {
  cardChanges: SavedDeckRevisionCardChange[];
  unchangedCards: number;
  leaderChanged: boolean;
  runModeChanged: boolean;
  exactMatch: boolean;
}

function compactRestoreName(name: string, revision: number) {
  const suffix = ` Restore ${revision}`;
  const base = name
    .replace(/(\s+(?:Fork|Tune|Restore)(?: \d+)?)+$/gi, '')
    .trim() || 'Saved Flight';
  return `${base.slice(0, Math.max(1, SAVED_DECK_NAME_LIMIT - suffix.length)).trim()}${suffix}`;
}

function sameCard(left?: SavedDeckCard, right?: SavedDeckCard) {
  return Boolean(left && right && left.id === right.id && left.upgraded === right.upgraded);
}

export function compareSavedDeckRevisions(
  current: SavedDeckRecord,
  target: SavedDeckRecord,
): SavedDeckRevisionComparison {
  const cardChanges: SavedDeckRevisionCardChange[] = [];
  let unchangedCards = 0;
  const cardCount = Math.max(current.cards.length, target.cards.length);
  for (let index = 0; index < cardCount; index += 1) {
    const before = current.cards[index];
    const after = target.cards[index];
    if (sameCard(before, after)) {
      unchangedCards += 1;
      continue;
    }
    const kind: SavedDeckRevisionChangeKind = !before
      ? 'added'
      : !after
        ? 'removed'
        : before.id === after.id
          ? 'state'
          : 'replaced';
    cardChanges.push({
      position: index + 1,
      kind,
      ...(before ? { current: { ...before } } : {}),
      ...(after ? { target: { ...after } } : {}),
    });
  }
  const leaderChanged = current.leaderId !== target.leaderId;
  const runModeChanged = current.runMode !== target.runMode;
  return {
    cardChanges,
    unchangedCards,
    leaderChanged,
    runModeChanged,
    exactMatch: cardChanges.length === 0 && !leaderChanged && !runModeChanged,
  };
}

export function savedDeckRevisionTargets(
  decks: readonly SavedDeckRecord[],
  sourceId: string,
) {
  const source = decks.find((deck) => deck.id === sourceId);
  if (!source) return [];
  const lineageId = source.lineageId || source.id;
  const lineage = decks
    .filter((deck) => deck.id !== source.id && (deck.lineageId || deck.id) === lineageId)
    .sort((left, right) => (
      right.revision - left.revision
      || right.createdAt - left.createdAt
      || left.id.localeCompare(right.id)
    ));
  if (!source.parentId) return lineage;
  const parentIndex = lineage.findIndex((deck) => deck.id === source.parentId);
  if (parentIndex <= 0) return lineage;
  return [
    lineage[parentIndex],
    ...lineage.slice(0, parentIndex),
    ...lineage.slice(parentIndex + 1),
  ];
}

export function restoreSavedDeckRevision(
  decks: readonly SavedDeckRecord[],
  sourceId: string,
  targetId: string,
  now = Date.now(),
) {
  if (activeSavedDecks(decks).length >= SAVED_DECK_LIMIT) return [...decks];
  const source = decks.find((deck) => deck.id === sourceId);
  const target = decks.find((deck) => deck.id === targetId);
  if (!source || !target || source.id === target.id) return [...decks];
  const lineageId = source.lineageId || source.id;
  if ((target.lineageId || target.id) !== lineageId) return [...decks];
  if (compareSavedDeckRevisions(source, target).exactMatch) return [...decks];
  const lineage = decks.filter((deck) => (deck.lineageId || deck.id) === lineageId);
  const revision = Math.max(1, ...lineage.map((deck) => deck.revision || 1)) + 1;
  const restored = createSavedDeckRecord({
    name: compactRestoreName(source.name, revision),
    leaderId: target.leaderId,
    cards: target.cards,
    sourceSeed: target.sourceSeed,
    runMode: target.runMode,
    now,
  });
  restored.lineageId = lineageId;
  restored.revision = revision;
  restored.parentId = source.id;
  if (target.description) restored.description = target.description;
  if (target.coverCardId) restored.coverCardId = target.coverCardId;
  if (target.sleeve) restored.sleeve = target.sleeve;
  if (target.notes) restored.notes = target.notes;
  if (target.folder) restored.folder = target.folder;
  if (target.tags?.length) restored.tags = [...target.tags];
  return [restored, ...decks];
}
