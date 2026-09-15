/** Presentation only: retain written effect order and never merge live predicates.
 * Previous-card/first-play facts cannot change between a card's own effects.
 */
export function formatCardRuleGroups(source: string) {
  const groups: Array<{ condition: string; effects: string[] }> = [];
  for (const clause of source.split(/(?<=\.)\s+/)) {
    const match = /^(If [^:]+):\s*(.*)$/.exec(clause);
    const condition = match?.[1] ?? '';
    const effect = match?.[2] ?? clause;
    const previous = groups[groups.length - 1];
    const stable = /^If (?:played (?:plumes|basins|quills|nests)|first played)$/.test(condition);
    if (previous?.condition === condition && (!condition || stable)) previous.effects.push(effect);
    else groups.push({ condition, effects: [effect] });
  }
  return groups.map(({ condition, effects }) => condition
    ? `${condition}:\n${effects.map(effect => `›\u00a0${effect}`).join('\n')}`
    : effects.join('\n'))
    .join('\n')
    // Keep quantities attached to their noun, but allow long Gain/Apply
    // phrases to wrap before that quantity rather than splitting a keyword.
    .replace(/\b(Deal|Draw|Retain|Heal) (\d+)/g, '$1\u00a0$2')
    .replace(/(\d+) (Cover|Cohesion|Resonance|Winded|Wingbeats?)/g, '$1\u00a0$2');
}
