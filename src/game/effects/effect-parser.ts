export interface ParsedEffect {
  name: string;
  args: string[];
}

export function parseEffect(effectText: string): ParsedEffect | undefined {
  const match = effectText.match(/^([a-zA-Z][a-zA-Z0-9]*)\((.*)\)$/);
  if (!match) return undefined;
  return {
    name: match[1],
    args: match[2].split(',').map((arg) => arg.trim()).filter(Boolean)
  };
}

export function parseEffectValue(raw: string | undefined, previousDiscarded: number, winded = 0, cover = 0) {
  if (!raw) return 0;
  const perDiscarded = raw.match(/^(\d+) perDiscarded$/);
  if (perDiscarded) return Number(perDiscarded[1]) * previousDiscarded;
  const perWinded = raw.match(/^(\d+) perWinded$/);
  if (perWinded) return Number(perWinded[1]) * winded;
  const perCover = raw.match(/^(\d+) perCover$/);
  if (perCover) return Number(perCover[1]) * cover;
  const value = Number(raw.replace('+', ''));
  return Number.isFinite(value) ? value : 0;
}
