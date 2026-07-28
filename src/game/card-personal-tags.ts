import type { CardPersonalTag } from './meta';

export const CARD_PERSONAL_TAGS: CardPersonalTag[] = ['staple', 'experiment', 'keepsake'];

export function sanitizeCardPersonalTags(
  value: unknown,
  discoveredCards: string[],
): Partial<Record<string, CardPersonalTag>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(
    ([id, tag]) => discoveredCards.includes(id)
      && CARD_PERSONAL_TAGS.includes(tag as CardPersonalTag),
  ));
}
