export const SAVED_DECK_LIMIT = 6;
export const SAVED_DECK_CARD_LIMIT = 60;
export const SAVED_DECK_NAME_LIMIT = 32;

export interface SavedDeckCard {
  id: string;
  upgraded: boolean;
}

export interface SavedDeckRecord {
  id: string;
  name: string;
  leaderId: string;
  cards: SavedDeckCard[];
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  sourceSeed: string;
  runMode: 'full' | 'quick';
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
  return value.flatMap((raw, index): SavedDeckRecord[] => {
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
    return [{
      id,
      name,
      leaderId,
      cards,
      createdAt,
      updatedAt: Math.max(createdAt, safeTime(raw.updatedAt, createdAt)),
      favorite: raw.favorite === true,
      sourceSeed,
      runMode: raw.runMode === 'quick' ? 'quick' : 'full',
    }];
  }).slice(0, SAVED_DECK_LIMIT);
}

export function createSavedDeckRecord(input: NewSavedDeck): SavedDeckRecord {
  const now = input.now ?? Date.now();
  const random = globalThis.crypto?.randomUUID?.() ?? `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id: input.id ?? `flight-${random}`,
    name: safeText(input.name, SAVED_DECK_NAME_LIMIT) || 'Saved Flight',
    leaderId: input.leaderId,
    cards: input.cards.slice(0, SAVED_DECK_CARD_LIMIT).map((card) => ({
      id: card.id,
      upgraded: card.upgraded === true,
    })),
    createdAt: now,
    updatedAt: now,
    favorite: false,
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

export function toggleSavedDeckFavorite(
  decks: readonly SavedDeckRecord[],
  id: string,
  now = Date.now(),
) {
  return decks.map((deck) => deck.id === id
    ? { ...deck, favorite: !deck.favorite, updatedAt: now }
    : deck);
}
