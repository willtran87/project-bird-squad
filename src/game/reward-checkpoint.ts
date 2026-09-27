/** Durable post-combat decisions, not a serialization of live Phaser objects. */
export interface RewardCheckpoint {
  version: 1;
  nodeId: string;
  stage: 'waymarkReward' | 'cardReward' | 'upgradeReward' | 'route';
  choices: string[];
  scrapAwarded: number;
  waymarkAwarded?: string;
  claims: Array<{ id: string; receipt: string }>;
}

export function sanitizeRewardCheckpoint(
  value: unknown,
  validCard: (id: string) => boolean,
  validMark: (id: string) => boolean,
): RewardCheckpoint | undefined {
  if (!value || typeof value !== 'object') return;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || typeof v.nodeId !== 'string' || !/^[\w-]{1,96}$/.test(v.nodeId)) return;
  if (!['waymarkReward', 'cardReward', 'upgradeReward', 'route'].includes(String(v.stage))) return;
  const stage = v.stage as RewardCheckpoint['stage'];
  const valid = stage === 'waymarkReward' ? validMark : validCard;
  const choices = Array.isArray(v.choices)
    ? [...new Set(v.choices.filter((id): id is string => typeof id === 'string' && valid(id)))].slice(0, 200) : [];
  if (stage !== 'route' && !choices.length) return;
  // Never silently discard part of a committed claim journal. The caller can
  // recover the complete backup transaction if the primary is malformed.
  const claims: RewardCheckpoint['claims'] = [];
  if (v.claims !== undefined) {
    if (!Array.isArray(v.claims) || v.claims.length > 200) return;
    for (const entry of v.claims) {
      if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !validCard(entry.id)
        || typeof entry.receipt !== 'string' || !entry.receipt.length || entry.receipt.length > 256) return;
      claims.push({ id: entry.id, receipt: entry.receipt });
    }
  }
  return {
    version: 1, nodeId: v.nodeId, stage, choices,
    scrapAwarded: Number.isFinite(v.scrapAwarded) ? Math.max(0, Math.floor(v.scrapAwarded as number)) : 0,
    waymarkAwarded: typeof v.waymarkAwarded === 'string' && validMark(v.waymarkAwarded) ? v.waymarkAwarded : undefined,
    claims,
  };
}

export function cloneRewardCheckpoint(value?: RewardCheckpoint): RewardCheckpoint | undefined {
  return value ? { ...value, choices: [...value.choices], claims: value.claims.map(claim => ({ ...claim })) } : undefined;
}
