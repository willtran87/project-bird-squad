export const CARD_JOURNAL_NOTE_LIMIT = 240;

export type CardJournalNotes = Partial<Record<string, string>>;

export function sanitizeCardJournalNote(value: unknown) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, CARD_JOURNAL_NOTE_LIMIT)
    .trim();
}

export function sanitizeCardJournalNotes(
  value: unknown,
  discoveredCards: readonly string[],
): CardJournalNotes {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const discovered = new Set(discoveredCards);
  return Object.fromEntries(Object.entries(value).flatMap(([id, rawNote]) => {
    if (!discovered.has(id)) return [];
    const note = sanitizeCardJournalNote(rawNote);
    return note ? [[id, note]] : [];
  }));
}
