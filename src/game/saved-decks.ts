export const SAVED_DECK_LIMIT = 6;
export const SAVED_DECK_ARCHIVE_LIMIT = 24;
export const SAVED_DECK_TOTAL_LIMIT = SAVED_DECK_LIMIT + SAVED_DECK_ARCHIVE_LIMIT;
export const SAVED_DECK_CARD_LIMIT = 60;
export const SAVED_DECK_NAME_LIMIT = 32;
export const SAVED_DECK_NOTES_LIMIT = 240;

export interface SavedDeckCard {
  id: string;
  upgraded: boolean;
}

export interface SavedDeckRecord {
  id: string;
  name: string;
  leaderId: string;
  cards: SavedDeckCard[];
  lineageId: string;
  revision: number;
  parentId?: string;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  archived: boolean;
  sourceSeed: string;
  runMode: 'full' | 'quick';
  notes?: string;
}

export interface NewSavedDeck {
  name: string;
  leaderId: string;
  cards: ReadonlyArray<{ id: string; upgraded?: boolean }>;
  sourceSeed: string;
  runMode: 'full' | 'quick';
  now?: number;
  id?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeText(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function safeNotes(value: unknown) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, SAVED_DECK_NOTES_LIMIT)
    .trim();
}

function safeTime(value: unknown, fallback: number) {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
}

function safeCard(value: unknown): SavedDeckCard | undefined {
  if (!isRecord(value)) return undefined;
  const id = safeText(value.id, 80);
  if (!id || !/^[a-z0-9_-]+$/i.test(id)) return undefined;
  return { id, upgraded: value.upgraded === true };
}

export function sanitizeSavedDecks(value: unknown): SavedDeckRecord[] {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set<string>();
  const now = Date.now();
  const records = value.flatMap((raw, index): SavedDeckRecord[] => {
    if (!isRecord(raw)) return [];
    const id = safeText(raw.id, 80);
    const name = safeText(raw.name, SAVED_DECK_NAME_LIMIT);
    const leaderId = safeText(raw.leaderId, 80);
    const sourceSeed = safeText(raw.sourceSeed, 80);
    const cards = Array.isArray(raw.cards)
      ? raw.cards.map(safeCard).filter((card): card is SavedDeckCard => Boolean(card)).slice(0, SAVED_DECK_CARD_LIMIT)
      : [];
    if (!id || usedIds.has(id) || !name || !leaderId || cards.length === 0) return [];
    usedIds.add(id);
    const createdAt = safeTime(raw.createdAt, now + index);
    const rawLineageId = safeText(raw.lineageId, 80);
    const lineageId = rawLineageId && /^[a-z0-9_-]+$/i.test(rawLineageId) ? rawLineageId : id;
    const rawParentId = safeText(raw.parentId, 80);
    const parentId = rawParentId && /^[a-z0-9_-]+$/i.test(rawParentId) ? rawParentId : '';
    const notes = safeNotes(raw.notes);
    return [{
      id,
      name,
      leaderId,
      cards,
      lineageId,
      revision: Number.isFinite(raw.revision)
        ? Math.max(1, Math.min(9999, Math.floor(Number(raw.revision))))
        : 1,
      ...(parentId && parentId !== id ? { parentId } : {}),
      createdAt,
      updatedAt: Math.max(createdAt, safeTime(raw.updatedAt, createdAt)),
      favorite: raw.favorite === true,
      archived: raw.archived === true,
      sourceSeed,
      runMode: raw.runMode === 'quick' ? 'quick' : 'full',
      ...(notes ? { notes } : {}),
    }];
  });
  let activeCount = 0;
  let archivedCount = 0;
  return records.filter((record) => {
    if (record.archived) {
      archivedCount += 1;
      return archivedCount <= SAVED_DECK_ARCHIVE_LIMIT;
    }
    activeCount += 1;
    return activeCount <= SAVED_DECK_LIMIT;
  }).slice(0, SAVED_DECK_TOTAL_LIMIT);
}

export function activeSavedDecks(decks: readonly SavedDeckRecord[]) {
  return decks.filter((deck) => !deck.archived);
}

export function archivedSavedDecks(decks: readonly SavedDeckRecord[]) {
  return decks.filter((deck) => deck.archived);
}

export function createSavedDeckRecord(input: NewSavedDeck): SavedDeckRecord {
  const now = input.now ?? Date.now();
  const random = globalThis.crypto?.randomUUID?.() ?? `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const id = input.id ?? `flight-${random}`;
  return {
    id,
    name: safeText(input.name, SAVED_DECK_NAME_LIMIT) || 'Saved Flight',
    leaderId: input.leaderId,
    cards: input.cards.slice(0, SAVED_DECK_CARD_LIMIT).map((card) => ({
      id: card.id,
      upgraded: card.upgraded === true,
    })),
    lineageId: id,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    favorite: false,
    archived: false,
    sourceSeed: safeText(input.sourceSeed, 80),
    runMode: input.runMode,
  };
}

export function renameSavedDeck(
  decks: readonly SavedDeckRecord[],
  id: string,
  name: string,
  now = Date.now(),
) {
  const cleanName = safeText(name, SAVED_DECK_NAME_LIMIT);
  if (!cleanName) return [...decks];
  return decks.map((deck) => deck.id === id ? { ...deck, name: cleanName, updatedAt: now } : deck);
}

export function updateSavedDeckNotes(
  decks: readonly SavedDeckRecord[],
  id: string,
  notes: string,
  now = Date.now(),
) {
  const cleanNotes = safeNotes(notes);
  return decks.map((deck) => {
    if (deck.id !== id) return deck;
    const withoutNotes = { ...deck };
    delete withoutNotes.notes;
    return cleanNotes
      ? { ...withoutNotes, notes: cleanNotes, updatedAt: now }
      : { ...withoutNotes, updatedAt: now };
  });
}

export function toggleSavedDeckFavorite(
  decks: readonly SavedDeckRecord[],
  id: string,
  now = Date.now(),
) {
  return decks.map((deck) => deck.id === id
    ? { ...deck, favorite: !deck.favorite, updatedAt: now }
    : deck);
}

export function setSavedDeckArchived(
  decks: readonly SavedDeckRecord[],
  id: string,
  archived: boolean,
  now = Date.now(),
) {
  const source = decks.find((deck) => deck.id === id);
  if (!source || source.archived === archived) return [...decks];
  if (archived && archivedSavedDecks(decks).length >= SAVED_DECK_ARCHIVE_LIMIT) return [...decks];
  if (!archived && activeSavedDecks(decks).length >= SAVED_DECK_LIMIT) return [...decks];
  return decks.map((deck) => deck.id === id
    ? { ...deck, archived, updatedAt: now }
    : deck);
}
