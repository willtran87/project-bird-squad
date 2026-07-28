import {
  activeSavedDecks,
  createSavedDeckRecord,
  SAVED_DECK_LIMIT,
  SAVED_DECK_NAME_LIMIT,
  type SavedDeckCard,
  type SavedDeckRecord,
} from './saved-decks';

export const SAVED_DECK_CODE_VERSION = 1;
export const SAVED_DECK_CODE_LIMIT = 8192;

export type SavedDeckCodeError = 'empty' | 'format' | 'version' | 'checksum' | 'deck';
export type SavedDeckCodeResult =
  | { ok: true; deck: SavedDeckRecord }
  | { ok: false; error: SavedDeckCodeError };

function compactCopyName(name: string, copyNumber: number) {
  const suffix = copyNumber > 1 ? ` Fork ${copyNumber}` : ' Fork';
  const base = name.replace(/(\s+Fork(?: \d+)?)+$/gi, '').trim() || 'Saved Flight';
  return `${base.slice(0, Math.max(1, SAVED_DECK_NAME_LIMIT - suffix.length)).trim()}${suffix}`;
}

function compactTuneName(name: string, revision: number) {
  const suffix = ` Tune ${revision}`;
  const base = name.replace(/(\s+(?:Fork|Tune)(?: \d+)?)+$/gi, '').trim() || 'Saved Flight';
  return `${base.slice(0, Math.max(1, SAVED_DECK_NAME_LIMIT - suffix.length)).trim()}${suffix}`;
}

function checksum(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function safeId(value: unknown) {
  return typeof value === 'string' && value.length > 0 && value.length <= 80 && /^[a-z0-9_-]+$/i.test(value)
    ? value
    : undefined;
}

export function duplicateSavedDeck(
  decks: readonly SavedDeckRecord[],
  id: string,
  now = Date.now(),
) {
  if (activeSavedDecks(decks).length >= SAVED_DECK_LIMIT) return [...decks];
  const source = decks.find((deck) => deck.id === id);
  if (!source) return [...decks];
  const lineageId = source.lineageId || source.id;
  const lineage = decks.filter((deck) => (deck.lineageId || deck.id) === lineageId);
  const revision = Math.max(1, ...lineage.map((deck) => deck.revision || 1)) + 1;
  const duplicate = createSavedDeckRecord({
    name: compactCopyName(source.name, revision),
    leaderId: source.leaderId,
    cards: source.cards,
    sourceSeed: source.sourceSeed,
    runMode: source.runMode,
    now,
  });
  duplicate.lineageId = lineageId;
  duplicate.revision = revision;
  duplicate.parentId = source.id;
  if (source.description) duplicate.description = source.description;
  if (source.coverCardId) duplicate.coverCardId = source.coverCardId;
  if (source.sleeve) duplicate.sleeve = source.sleeve;
  if (source.notes) duplicate.notes = source.notes;
  if (source.folder) duplicate.folder = source.folder;
  if (source.tags?.length) duplicate.tags = [...source.tags];
  return [duplicate, ...decks];
}

export function savedDeckShareCode(deck: SavedDeckRecord) {
  const payload = encodeBase64Url(JSON.stringify([
    deck.leaderId,
    deck.runMode === 'quick' ? 1 : 0,
    deck.cards.map((card) => [card.id, card.upgraded ? 1 : 0]),
  ]));
  return `BSF${SAVED_DECK_CODE_VERSION}.${payload}.${checksum(payload)}`;
}

export function tuneSavedDeck(
  decks: readonly SavedDeckRecord[],
  id: string,
  cardIndex: number,
  replacementId: string,
  now = Date.now(),
) {
  if (activeSavedDecks(decks).length >= SAVED_DECK_LIMIT) return [...decks];
  const source = decks.find((deck) => deck.id === id);
  const index = Math.floor(cardIndex);
  if (
    !source
    || index < 0
    || index >= source.cards.length
    || !safeId(replacementId)
    || source.cards[index].id === replacementId
    || source.cards.some((card, sourceIndex) => sourceIndex !== index && card.id === replacementId)
  ) return [...decks];
  const lineageId = source.lineageId || source.id;
  const lineage = decks.filter((deck) => (deck.lineageId || deck.id) === lineageId);
  const revision = Math.max(1, ...lineage.map((deck) => deck.revision || 1)) + 1;
  const cards = source.cards.map((card, sourceIndex) => sourceIndex === index
    ? { id: replacementId, upgraded: false }
    : { ...card });
  const tuned = createSavedDeckRecord({
    name: compactTuneName(source.name, revision),
    leaderId: source.leaderId,
    cards,
    sourceSeed: source.sourceSeed,
    runMode: source.runMode,
    now,
  });
  tuned.lineageId = lineageId;
  tuned.revision = revision;
  tuned.parentId = source.id;
  if (source.description) tuned.description = source.description;
  if (source.coverCardId && cards.some((card) => card.id === source.coverCardId)) {
    tuned.coverCardId = source.coverCardId;
  }
  if (source.sleeve) tuned.sleeve = source.sleeve;
  if (source.notes) tuned.notes = source.notes;
  if (source.folder) tuned.folder = source.folder;
  if (source.tags?.length) tuned.tags = [...source.tags];
  return [tuned, ...decks];
}

export function importSavedDeckCode(code: string, now = Date.now()): SavedDeckCodeResult {
  const clean = code.replace(/\s+/g, '').trim();
  if (!clean) return { ok: false, error: 'empty' };
  if (clean.length > SAVED_DECK_CODE_LIMIT) return { ok: false, error: 'format' };
  const [prefix, payload, suppliedChecksum, extra] = clean.split('.');
  if (!prefix || !payload || !suppliedChecksum || extra !== undefined) return { ok: false, error: 'format' };
  if (prefix !== `BSF${SAVED_DECK_CODE_VERSION}`) return { ok: false, error: 'version' };
  if (checksum(payload) !== suppliedChecksum) return { ok: false, error: 'checksum' };
  try {
    const decoded: unknown = JSON.parse(decodeBase64Url(payload));
    if (!Array.isArray(decoded) || decoded.length !== 3) return { ok: false, error: 'deck' };
    const leaderId = safeId(decoded[0]);
    const runMode = decoded[1] === 1 ? 'quick' : decoded[1] === 0 ? 'full' : undefined;
    const rawCards = decoded[2];
    if (!leaderId || !runMode || !Array.isArray(rawCards) || rawCards.length === 0 || rawCards.length > 60) {
      return { ok: false, error: 'deck' };
    }
    const cards = rawCards.flatMap((raw): SavedDeckCard[] => {
      if (!Array.isArray(raw) || raw.length !== 2) return [];
      const id = safeId(raw[0]);
      if (!id || (raw[1] !== 0 && raw[1] !== 1)) return [];
      return [{ id, upgraded: raw[1] === 1 }];
    });
    if (cards.length !== rawCards.length) return { ok: false, error: 'deck' };
    return {
      ok: true,
      deck: createSavedDeckRecord({
        name: 'Shared Flight',
        leaderId,
        cards,
        sourceSeed: '',
        runMode,
        now,
      }),
    };
  } catch {
    return { ok: false, error: 'format' };
  }
}
