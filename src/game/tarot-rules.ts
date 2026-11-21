/**
 * Tarot identity for a card id: the numeral a tarot reader would look for and
 * the suit it belongs to. Majors (and the Aviary arcana that continue them)
 * carry their number; minors carry their rank, courts numbered on from Ten as
 * in the old Marseille decks. Snags are street debris, not tarot, and get none.
 */
import type { CardSuit } from './types';

export type TarotSuit = CardSuit | 'major';
export interface TarotMark { numeral: string; suit: TarotSuit; rank: string }

const MINOR_SUIT: Record<string, CardSuit> = { wands: 'plumes', cups: 'basins', swords: 'quills', pentacles: 'nests' };
const COURTS: Record<string, [number, string]> = { fledgling: [11, 'Fledgling'], outrider: [12, 'Outrider'], matron: [13, 'Matron'], elder: [14, 'Elder'] };
const SUIT_NAME: Record<TarotSuit, string> = { plumes: 'Plumes', basins: 'Basins', quills: 'Quills', nests: 'Nests', major: 'Major Arcana' };

export function roman(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 3999) return String(value);
  if (value === 0) return '0';
  let out = '', rest = value;
  for (const [step, glyph] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']] as const) {
    while (rest >= step) { out += glyph; rest -= step; }
  }
  return out;
}

export function tarotMark(cardId: string): TarotMark | undefined {
  const major = /^(?:major|aviary)_(\d+)$/.exec(cardId);
  if (major) {
    const number = Number(major[1]);
    return { numeral: roman(number), suit: 'major', rank: `Arcanum ${roman(number)}` };
  }
  const minor = /^(wands|cups|swords|pentacles)_(\w+)$/.exec(cardId);
  if (!minor) return undefined;
  const suit = MINOR_SUIT[minor[1]], rank = minor[2];
  if (rank === 'ace') return { numeral: 'I', suit, rank: `Ace of ${SUIT_NAME[suit]}` };
  const court = COURTS[rank];
  if (court) return { numeral: roman(court[0]), suit, rank: `${court[1]} of ${SUIT_NAME[suit]}` };
  const pip = Number(rank);
  return Number.isInteger(pip) && pip >= 2 && pip <= 10 ? { numeral: roman(pip), suit, rank: `${roman(pip)} of ${SUIT_NAME[suit]}` } : undefined;
}

export const tarotSuitName = (suit: TarotSuit) => SUIT_NAME[suit];
