/** A hand preview is an ordered excerpt, never a reordered/merged rules engine. */
export function readableHandRules(formattedEffects: readonly string[]): string {
  return formattedEffects.map(effect => effect
    .replace(/^If first played:/, 'First use this fight:')
    .replace(/^If played (plumes|basins|quills|nests):/, 'If you played $1 this turn:')
    .replace(/^If Resonance:/, 'If you have Resonance:')
    .replace(/^If spent Resonance:/, 'If this card spent Resonance:')
    .replace(/^If no Resonance:/, 'If no Resonance remains and none was spent:')
    .replace(/^If target attacks:/, 'If the target intends to attack:')
    .replace(/^If target below half:/, 'If the target is at half health or less:')
    .replace(/^If target Winded:/, 'If the target is Winded:')
    .replace(/^If target (\d+)\+ Winded:/, 'If the target has $1+ Winded:')
    .replace(/^If (\d+)\+ Resonance:/, 'If you have $1+ Resonance:')
    .replace(/^If no Cover:/, 'If the flock has no Cover:')
    .replace(/^If low Cohesion:/, 'If the flock is below half Cohesion:')
    .replace(/^If full Cohesion:/, 'If the flock has full Cohesion:')
    .replace(/^If Molting:/, 'While in Molt:')
    .replace(/^If Open Sky:/, 'If the flock is in Open Sky:')
    .replace(/^If flockSuit\(([^,]+),\s*(\d+)\):/, 'If your flock has $2+ $1 cards:')
    .replace(/^If defeats enemy:/, 'If the previous hit defeated an enemy:')
    .replace(/Deal (\d+(?: per [^.,]+)?)(?=[.,])/, 'Deal $1 damage')
    .replace(/Deal (\d+) to all\./, 'Deal $1 damage to all enemies.')
  ).join('\n');
}

/** Keep complete effect clauses when possible. Never show an effect without its predicate. */
export function fitHandRules(source: string, fits: (text: string) => boolean, maxClauses = Infinity) {
  const clauses = source.split('\n').filter(Boolean);
  if (clauses.length <= maxClauses && fits(source)) return { text: source, omitted: 0 };
  for (let count = Math.min(maxClauses, clauses.length - 1); count > 0; count--) {
    const omitted = clauses.length - count;
    const text = `${clauses.slice(0, count).join('\n')}\n+${omitted} more · Inspect`;
    if (fits(text)) return { text, omitted };
  }
  // Even one conditional may exceed the face. Do not strip its condition to fit.
  return { text: 'Complex effect\nInspect full rules', omitted: clauses.length };
}

/** Wrap with measured words, keeping short verb/quantity pairs together. */
export function wrapHandRules(source: string, measure: (text: string) => number, width: number) {
  return source.split('\n').flatMap(clause => {
    const words = clause.match(/\b(?:Deal|Draw|Retain|Heal|Discard) \d+[.!]?|\d+\+? (?:damage|Cover|Resonance|Winded)[.!:]?|\S+/g) ?? [];
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(candidate) > width) { lines.push(line); line = word; }
      else line = candidate;
    }
    if (line) lines.push(line);
    return lines;
  });
}
