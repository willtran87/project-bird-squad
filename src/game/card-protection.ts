export function sanitizeLockedCards(
  value: unknown,
  cardCollection: Record<string, unknown>,
) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => (
    typeof id === 'string' && Boolean(cardCollection[id])
  )))];
}
