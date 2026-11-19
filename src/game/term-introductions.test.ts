import { describe, expect, it } from 'vitest';
import { buildKeywordTokens, canonicalKeyword, KEYWORDS, keywordTitle } from './keyword-definitions';
import { codexGlossaryTerms, findGlossaryTerm, glossarySearchSynonyms, glossaryTierCounts } from './codex-glossary';
import { pickTermIntroduction, TERM_INTRODUCTIONS } from './term-introductions';

describe('vocabulary glosses and aliases', () => {
  it('merges Energy into the single Wingbeat entry', () => {
    expect(KEYWORDS.Energy).toBeUndefined();
    expect(canonicalKeyword('energy')).toBe('Wingbeat');
    expect(canonicalKeyword('Wingbeats')).toBe('Wingbeat');
    expect(buildKeywordTokens('Gain 1 Energy.').find((token) => token.kw)?.kw).toBe('Wingbeat');
    expect(codexGlossaryTerms.filter((term) => term.term === 'Energy')).toEqual([]);
    expect(findGlossaryTerm('Energy')?.term).toBe('Wingbeat');
  });

  it('pairs themed terms with plain-language glosses', () => {
    expect(keywordTitle('Wingbeat')).toBe('Wingbeat (energy)');
    expect(keywordTitle('Cohesion')).toBe('Cohesion (flock HP)');
    expect(findGlossaryTerm('end turn')?.term).toBe('Roost');
    expect(findGlossaryTerm('upgrade')?.term).toBe('Preen');
    expect(glossarySearchSynonyms('Gain 2 Wingbeats and 4 Cover.')).toContain('energy');
    expect(glossarySearchSynonyms('Gain 2 Wingbeats and 4 Cover.')).toContain('block');
  });

  it('tiers every glossary term, core first', () => {
    const counts = glossaryTierCounts();
    expect(counts.core + counts.intermediate + counts.advanced).toBe(codexGlossaryTerms.length);
    expect(codexGlossaryTerms[0].term).toBe('Cohesion');
    const order = codexGlossaryTerms.map((term) => ['core', 'intermediate', 'advanced'].indexOf(term.tier));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const term of ['Cohesion', 'Wingbeat', 'Cover', 'Roost', 'Flow', 'Surge', 'Scatter', 'Resonance', 'Winded', 'Open Sky', 'Molt', 'Preen', 'Waymark', 'Supply']) {
      expect(codexGlossaryTerms.find((entry) => entry.term === term)?.tier).toBe('core');
    }
  });
});

describe('first-encounter term introductions', () => {
  it('introduces only unseen terms present in play, in teaching order', () => {
    expect(pickTermIntroduction(['Deal 6 damage. Apply 2 Winded.', 'Gain 1 Resonance.'], new Set())?.term).toBe('Winded');
    expect(pickTermIntroduction(['Deal 6 damage. Apply 2 Winded.', 'Gain 1 Resonance.'], new Set(['Winded'])))
      .toMatchObject({ term: 'Resonance' });
    expect(pickTermIntroduction(['Deal 6 damage.'], new Set())).toBeUndefined();
    expect(pickTermIntroduction(['Gain 2 Open Sky Guard.'], new Set())?.term).toBe('Open Sky Guard');
  });

  it('keeps every callout to one short line about a real keyword', () => {
    for (const entry of TERM_INTRODUCTIONS) {
      expect(KEYWORDS[entry.term], entry.term).toBeDefined();
      expect(entry.line.length, entry.term).toBeLessThanOrEqual(90);
      expect(entry.line.startsWith(entry.term), entry.term).toBe(true);
    }
  });
});
