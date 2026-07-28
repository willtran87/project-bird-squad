export const SAVED_DECK_LIMIT = 6;
export const SAVED_DECK_ARCHIVE_LIMIT = 24;
export const SAVED_DECK_TOTAL_LIMIT = SAVED_DECK_LIMIT + SAVED_DECK_ARCHIVE_LIMIT;
export const SAVED_DECK_CARD_LIMIT = 60;
export const SAVED_DECK_NAME_LIMIT = 32;
export const SAVED_DECK_DESCRIPTION_LIMIT = 120;
export const SAVED_DECK_NOTES_LIMIT = 240;
export const SAVED_DECK_TAG_LIMIT = 3;

export const SAVED_DECK_FOLDERS = [
  { id: 'unfiled', label: 'Open Shelf', description: 'No collection folder assigned.' },
  { id: 'workbench', label: 'Workbench', description: 'Brews and experiments still being shaped.' },
  { id: 'ready', label: 'Flight Ready', description: 'Trusted lists prepared for another run.' },
  { id: 'signature', label: 'Signature', description: 'Personal favorites that define your flock.' },
] as const;

export const SAVED_DECK_TAGS = [
  { id: 'pressure', label: 'Pressure', description: 'Direct damage and tempo.' },
  { id: 'guard', label: 'Guard', description: 'Cover, healing, and survival.' },
  { id: 'flow', label: 'Flow', description: 'Draw, Wingbeats, and hand shaping.' },
  { id: 'molt', label: 'Molt', description: 'Molt setup and transformed effects.' },
  { id: 'economy', label: 'Economy', description: 'Scrap, Supplies, and route value.' },
  { id: 'combo', label: 'Combo', description: 'Sequenced engines and payoffs.' },
  { id: 'flexible', label: 'Flexible', description: 'Adaptable plans and mixed roles.' },
  { id: 'challenge', label: 'Challenge', description: 'Self-imposed or unusual constraints.' },
] as const;

export const SAVED_DECK_SLEEVES = [
  {
    id: 'field',
    label: 'Field Canvas',
    description: 'Weathered blue canvas with a clear brass flight mark.',
    primary: 0x102332,
    accent: 0x7ab8d6,
    ink: 0xf0c36f,
  },
  {
    id: 'signal',
    label: 'Signal Violet',
    description: 'Deep violet cloth crossed by a bright rooftop signal.',
    primary: 0x201b36,
    accent: 0xc9a6ff,
    ink: 0x8df4ff,
  },
  {
    id: 'canal',
    label: 'Canal Teal',
    description: 'Tidewatch teal with warm repair-market stitching.',
    primary: 0x0e3032,
    accent: 0x8fd6a0,
    ink: 0xffe1a3,
  },
  {
    id: 'rooftop',
    label: 'Rooftop Ember',
    description: 'Charcoal fabric with an ember-red skyline seam.',
    primary: 0x2b1b1b,
    accent: 0xe58d6b,
    ink: 0xffd7a0,
  },
] as const;

export type SavedDeckFolderId = typeof SAVED_DECK_FOLDERS[number]['id'];
export type SavedDeckTagId = typeof SAVED_DECK_TAGS[number]['id'];
export type SavedDeckSleeveId = typeof SAVED_DECK_SLEEVES[number]['id'];

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
  description?: string;
  coverCardId?: string;
  sleeve?: Exclude<SavedDeckSleeveId, 'field'>;
  notes?: string;
  folder?: Exclude<SavedDeckFolderId, 'unfiled'>;
  tags?: SavedDeckTagId[];
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

function safeFolder(value: unknown): Exclude<SavedDeckFolderId, 'unfiled'> | undefined {
  return SAVED_DECK_FOLDERS.find(
    (folder) => folder.id !== 'unfiled' && folder.id === value,
  )?.id as Exclude<SavedDeckFolderId, 'unfiled'> | undefined;
}

function safeSleeve(value: unknown): Exclude<SavedDeckSleeveId, 'field'> | undefined {
  return SAVED_DECK_SLEEVES.find(
    (sleeve) => sleeve.id !== 'field' && sleeve.id === value,
  )?.id as Exclude<SavedDeckSleeveId, 'field'> | undefined;
}

function safeTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  const valid = new Set<SavedDeckTagId>();
  value.forEach((candidate) => {
    const tag = SAVED_DECK_TAGS.find((entry) => entry.id === candidate)?.id;
    if (tag && valid.size < SAVED_DECK_TAG_LIMIT) valid.add(tag);
  });
  return [...valid];
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
    const description = safeText(raw.description, SAVED_DECK_DESCRIPTION_LIMIT);
    const coverCardId = safeText(raw.coverCardId, 80);
    const validCoverCardId = coverCardId && cards.some((card) => card.id === coverCardId)
      ? coverCardId
      : '';
    const sleeve = safeSleeve(raw.sleeve);
    const folder = safeFolder(raw.folder);
    const tags = safeTags(raw.tags);
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
      ...(description ? { description } : {}),
      ...(validCoverCardId ? { coverCardId: validCoverCardId } : {}),
      ...(sleeve ? { sleeve } : {}),
      ...(notes ? { notes } : {}),
      ...(folder ? { folder } : {}),
      ...(tags.length > 0 ? { tags } : {}),
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

export function updateSavedDeckDescription(
  decks: readonly SavedDeckRecord[],
  id: string,
  description: string,
  now = Date.now(),
) {
  const cleanDescription = safeText(description, SAVED_DECK_DESCRIPTION_LIMIT);
  return decks.map((deck) => {
    if (deck.id !== id) return deck;
    const updated = { ...deck };
    delete updated.description;
    return cleanDescription
      ? { ...updated, description: cleanDescription, updatedAt: now }
      : { ...updated, updatedAt: now };
  });
}

export function setSavedDeckCoverCard(
  decks: readonly SavedDeckRecord[],
  id: string,
  coverCardId: string,
  now = Date.now(),
) {
  return decks.map((deck) => {
    if (deck.id !== id || !deck.cards.some((card) => card.id === coverCardId)) return deck;
    return deck.coverCardId === coverCardId
      ? deck
      : { ...deck, coverCardId, updatedAt: now };
  });
}

export function setSavedDeckSleeve(
  decks: readonly SavedDeckRecord[],
  id: string,
  sleeve: SavedDeckSleeveId,
  now = Date.now(),
) {
  if (!SAVED_DECK_SLEEVES.some((candidate) => candidate.id === sleeve)) return [...decks];
  return decks.map((deck) => {
    if (deck.id !== id) return deck;
    const updated = { ...deck };
    delete updated.sleeve;
    return sleeve === 'field'
      ? { ...updated, updatedAt: now }
      : { ...updated, sleeve, updatedAt: now };
  });
}

export function setSavedDeckFolder(
  decks: readonly SavedDeckRecord[],
  id: string,
  folder: SavedDeckFolderId,
  now = Date.now(),
) {
  if (!SAVED_DECK_FOLDERS.some((candidate) => candidate.id === folder)) return [...decks];
  return decks.map((deck) => {
    if (deck.id !== id) return deck;
    const updated = { ...deck };
    delete updated.folder;
    return folder === 'unfiled'
      ? { ...updated, updatedAt: now }
      : { ...updated, folder, updatedAt: now };
  });
}

export function toggleSavedDeckTag(
  decks: readonly SavedDeckRecord[],
  id: string,
  tag: SavedDeckTagId,
  now = Date.now(),
) {
  if (!SAVED_DECK_TAGS.some((candidate) => candidate.id === tag)) return [...decks];
  return decks.map((deck) => {
    if (deck.id !== id) return deck;
    const current = safeTags(deck.tags);
    const next = current.includes(tag)
      ? current.filter((candidate) => candidate !== tag)
      : current.length < SAVED_DECK_TAG_LIMIT
        ? [...current, tag]
        : current;
    if (next.length === current.length && next.every((candidate, index) => candidate === current[index])) return deck;
    const updated = { ...deck };
    delete updated.tags;
    return next.length > 0
      ? { ...updated, tags: next, updatedAt: now }
      : { ...updated, updatedAt: now };
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
