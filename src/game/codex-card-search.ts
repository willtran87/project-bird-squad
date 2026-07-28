export const CODEX_SEARCH_FUZZY_MIN_LENGTH = 4;

export interface CodexSearchMatch {
  matches: boolean;
  usedTypoTolerance: boolean;
  typoTokens: string[];
}

export function normalizeCodexSearchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchWords(value: string) {
  return normalizeCodexSearchText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function adjacentTranspositionMatches(query: string, candidate: string) {
  if (query.length !== 4 || candidate.length !== query.length) return false;
  const mismatches: number[] = [];
  for (let index = 0; index < query.length; index += 1) {
    if (query[index] !== candidate[index]) mismatches.push(index);
  }
  return mismatches.length === 2
    && mismatches[1] === mismatches[0] + 1
    && query[mismatches[0]] === candidate[mismatches[1]]
    && query[mismatches[1]] === candidate[mismatches[0]];
}

function typoBudget(token: string) {
  if (token.length < CODEX_SEARCH_FUZZY_MIN_LENGTH || /\p{N}/u.test(token)) return 0;
  if (token.length === 4) return 1;
  return token.length >= 9 ? 2 : 1;
}

function optimalStringAlignmentDistance(left: string, right: string, limit: number) {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  const matrix = Array.from(
    { length: left.length + 1 },
    (_, row) => Array.from({ length: right.length + 1 }, (__, column) => (
      row === 0 ? column : column === 0 ? row : 0
    )),
  );
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const substitution = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitution,
      );
      if (
        row > 1
        && column > 1
        && left[row - 1] === right[column - 2]
        && left[row - 2] === right[column - 1]
      ) {
        matrix[row][column] = Math.min(
          matrix[row][column],
          matrix[row - 2][column - 2] + 1,
        );
      }
    }
  }
  return matrix[left.length][right.length];
}

function typoMatchesWord(queryToken: string, candidate: string) {
  const budget = typoBudget(queryToken);
  if (budget === 0 || /\p{N}/u.test(candidate)) return false;
  if (queryToken.length === 4) return adjacentTranspositionMatches(queryToken, candidate);
  return optimalStringAlignmentDistance(queryToken, candidate, budget) <= budget;
}

export function matchCodexSearchText(queryValue: string, haystackValue: string): CodexSearchMatch {
  const query = normalizeCodexSearchText(queryValue);
  if (!query) return { matches: true, usedTypoTolerance: false, typoTokens: [] };
  const haystack = normalizeCodexSearchText(haystackValue);
  const haystackWords = [...new Set(searchWords(haystack))];
  const typoTokens: string[] = [];
  for (const token of query.split(' ')) {
    if (haystack.includes(token)) continue;
    const queryWords = searchWords(token);
    const fuzzyToken = queryWords.length === 1 ? queryWords[0] : '';
    if (!fuzzyToken || !haystackWords.some((candidate) => typoMatchesWord(fuzzyToken, candidate))) {
      return { matches: false, usedTypoTolerance: false, typoTokens: [] };
    }
    typoTokens.push(token);
  }
  return {
    matches: true,
    usedTypoTolerance: typoTokens.length > 0,
    typoTokens,
  };
}
