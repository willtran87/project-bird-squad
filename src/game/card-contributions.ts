/** Observed effects during a card's resolution, including its triggered effects.
 * These are neither forecasts nor an estimate of the card's isolated value. */
export const contributionKeys = ['plays', 'flow', 'damage', 'cover', 'healing', 'drawn', 'wingbeats', 'resonance', 'spent'] as const;
export type ContributionKey = typeof contributionKeys[number];
export type CardContribution = { cardId: string } & Record<ContributionKey, number>;
const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
  ? Math.min(1_000_000, Math.max(0, Math.floor(value))) : 0;

export function emptyContribution(cardId: string): CardContribution {
  return { cardId, plays: 0, flow: 0, damage: 0, cover: 0, healing: 0, drawn: 0, wingbeats: 0, resonance: 0, spent: 0 };
}

export function recordContribution(records: CardContribution[], cardId: string, key: ContributionKey, amount: number) {
  if (!count(amount)) return;
  let row = records.find(entry => entry.cardId === cardId);
  if (!row) { row = emptyContribution(cardId); records.push(row); }
  row[key] = count(row[key] + amount);
}

export function sanitizeContributions(value: unknown, known: (id: string) => boolean): CardContribution[] | undefined {
  if (!Array.isArray(value)) return undefined; // Older saves did not record this evidence.
  const rows: CardContribution[] = [];
  const seen = new Set<string>();
  for (const entry of value.slice(0, 256)) {
    if (!entry || typeof entry !== 'object' || typeof entry.cardId !== 'string'
      || !known(entry.cardId) || seen.has(entry.cardId)) continue;
    seen.add(entry.cardId);
    const row = emptyContribution(entry.cardId);
    for (const key of contributionKeys) row[key] = count(entry[key]);
    if (row.plays) rows.push(row);
  }
  return rows;
}

export function totalContributions(combats: Array<{ cardContributions?: CardContribution[] }>): CardContribution[] {
  const rows: CardContribution[] = [];
  for (const combat of combats) for (const row of combat.cardContributions ?? []) {
    for (const key of contributionKeys) recordContribution(rows, row.cardId, key, row[key]);
  }
  return rows.sort((a, b) => b.plays - a.plays || a.cardId.localeCompare(b.cardId));
}

export function contributionResults(row: CardContribution): string[] {
  return [row.damage && `${row.damage} damage`, row.cover && `${row.cover} Cover gained`,
    row.healing && `${row.healing} Cohesion restored`, row.drawn && `${row.drawn} cards drawn`,
    row.wingbeats && `${row.wingbeats} Wingbeats gained`, row.resonance && `${row.resonance} Resonance gained`,
    row.spent && `${row.spent} Resonance spent`, row.flow && `${row.flow} Flow built`].filter(Boolean) as string[];
}

export const contributionScope = 'Observed during card resolution, including Leader, Waymark and combination triggers. Damage excludes overkill; healing excludes overheal. Cover gained is not damage prevented. Older encounters may have no records.';

export function contributionReading(combats: Array<{ cardContributions?: CardContribution[] }>, name: (id: string) => string): string {
  const rows = totalContributions(combats);
  return (rows.length ? rows.map(row => `${name(row.cardId)} · ${row.plays} play${row.plays === 1 ? '' : 's'}\n${contributionResults(row).join(' · ') || 'No tracked numeric effects.'}`).join('\n\n')
    : 'No card contributions recorded yet.') + `\n\n${contributionScope}`;
}
