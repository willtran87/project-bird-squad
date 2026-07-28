import type { CardCollectionRecord, CardPersonalTag } from './meta';

export interface CollectionMilestoneAccount {
  achievements: string[];
  discoveredCards: string[];
  cardCollection: Record<string, CardCollectionRecord>;
  cardTags?: Partial<Record<string, CardPersonalTag>>;
}

export interface CollectionMilestoneProgress {
  id: string;
  current: number;
  target: number;
  complete: boolean;
  earned: boolean;
}

const SUITS = ['wands_', 'swords_', 'cups_', 'pentacles_'] as const;
const FAMILIES = ['major_', 'aviary_', ...SUITS] as const;
const SOURCES = ['combat_reward', 'route_reward', 'market', 'snag'] as const;
export const COLLECTION_MILESTONE_COUNT = 6;

export function collectionMilestoneProgress(account: CollectionMilestoneAccount): CollectionMilestoneProgress[] {
  const entries = Object.entries(account.cardCollection);
  const ids = entries.map(([id]) => id);
  const prefixes = (values: readonly string[]) => values
    .filter((prefix) => ids.some((id) => id.startsWith(prefix))).length;
  const discovered = new Set(account.discoveredCards);
  const tags = new Set(Object.entries(account.cardTags ?? {})
    .filter(([id]) => discovered.has(id))
    .map(([, tag]) => tag)
    .filter((tag): tag is CardPersonalTag => tag === 'staple' || tag === 'experiment' || tag === 'keepsake')).size;
  const values: Array<[string, number, number]> = [
    ['collection_first_shelf', Math.min(ids.length, 10), 10],
    ['collection_suit_sampler', prefixes(SUITS), SUITS.length],
    ['collection_curator', tags, 3],
    ['collection_wayfinder', Math.min(entries.filter(([, record]) => record.targetCompletedAt).length, 3), 3],
    ['collection_many_roads', SOURCES.filter((source) => entries.some(([, record]) => record.firstSource === source)).length, SOURCES.length],
    ['collection_citywide', prefixes(FAMILIES) + (entries.some(([, record]) => record.firstSource === 'snag') ? 1 : 0), 7],
  ];
  return values.map(([id, current, target]) => ({
    id,
    current,
    target,
    complete: current >= target,
    earned: account.achievements.includes(id),
  }));
}

export function unlockCollectionMilestones(account: CollectionMilestoneAccount): string[] {
  const unlocked = collectionMilestoneProgress(account)
    .filter((milestone) => milestone.complete && !milestone.earned)
    .map((milestone) => milestone.id);
  account.achievements.push(...unlocked);
  return unlocked;
}
