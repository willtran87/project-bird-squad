import type { CardAcquisitionSource } from './meta';

export interface PendingCardClaim { id: string; source: CardAcquisitionSource; receipt: string }

export function sanitizeCardClaims(value: unknown, validCard: (id: string) => boolean): PendingCardClaim[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 200) return;
  const claims: PendingCardClaim[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !validCard(entry.id)
      || !['starter_flock', 'combat_reward', 'route_reward', 'market', 'snag'].includes(entry.source)
      || typeof entry.receipt !== 'string' || !entry.receipt.length || entry.receipt.length > 256) return;
    claims.push({ id: entry.id, source: entry.source, receipt: entry.receipt });
  }
  return claims;
}
