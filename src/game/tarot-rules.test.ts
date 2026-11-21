import { describe, expect, it } from 'vitest';
import cards from '../../data/game/alpha-cards.json';
import { roman, tarotMark } from './tarot-rules';

describe('tarot marks', () => {
  it('writes roman numerals, with zero for the Fool', () => {
    expect([0, 1, 4, 9, 14, 19, 21, 40, 43].map(roman)).toEqual(['0', 'I', 'IV', 'IX', 'XIV', 'XIX', 'XXI', 'XL', 'XLIII']);
  });
  it('numbers majors and the Aviary arcana that continue them', () => {
    expect(tarotMark('major_00')).toMatchObject({ numeral: '0', suit: 'major' });
    expect(tarotMark('major_13')).toMatchObject({ numeral: 'XIII', suit: 'major' });
    expect(tarotMark('aviary_43')).toMatchObject({ numeral: 'XLIII', suit: 'major' });
  });
  it('maps minor suits onto the flock suits and ranks courts after Ten', () => {
    expect(tarotMark('wands_ace')).toMatchObject({ numeral: 'I', suit: 'plumes', rank: 'Ace of Plumes' });
    expect(tarotMark('cups_07')).toMatchObject({ numeral: 'VII', suit: 'basins' });
    expect(tarotMark('swords_10')).toMatchObject({ numeral: 'X', suit: 'quills' });
    expect(tarotMark('pentacles_elder')).toMatchObject({ numeral: 'XIV', suit: 'nests', rank: 'Elder of Nests' });
  });
  it('marks every tarot card in the data and no snag', () => {
    for (const card of cards.cards) {
      const mark = tarotMark(card.id);
      if (card.kind === 'snag') expect(mark, card.id).toBeUndefined();
      else {
        expect(mark, card.id).toBeDefined();
        if (card.suit) expect(mark!.suit, card.id).toBe(card.suit);
        expect(mark!.numeral.length, card.id).toBeLessThanOrEqual(7);
      }
    }
  });
});
