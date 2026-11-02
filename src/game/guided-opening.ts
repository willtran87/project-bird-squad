/** Reorder existing copies only; never inject birds or change card rules. */
export function orderTeachingHand<T extends { id: string }>(cards: T[]): T[] {
  const first = ['major_00', 'swords_ace', 'pentacles_fledgling', 'cups_fledgling', 'pentacles_04'];
  const rank = (card: T) => { const index = first.indexOf(card.id); return index < 0 ? first.length : index; };
  return [...cards].sort((a, b) => rank(a) - rank(b));
}
