export const CARD_SHOWCASE_LIMIT = 3;

export function sanitizeCardShowcase(value: unknown, discoveredCards: readonly string[]) {
  if (!Array.isArray(value)) return [];
  const discovered = new Set(discoveredCards);
  return [...new Set(value.filter((id): id is string => (
    typeof id === 'string' && discovered.has(id)
  )))].slice(0, CARD_SHOWCASE_LIMIT);
}
