import {
  COLLECTION_MILESTONE_COUNT,
  collectionMilestoneProgress,
  type CollectionMilestoneAccount,
} from './collection-milestone-progress';

export { COLLECTION_MILESTONE_COUNT };

export interface CollectionMilestoneSnapshot {
  id: string;
  name: string;
  description: string;
  reward: string;
  current: number;
  target: number;
  complete: boolean;
  earned: boolean;
}

export function collectionMilestoneSnapshots(account: CollectionMilestoneAccount): CollectionMilestoneSnapshot[] {
  const definitions: Array<Pick<CollectionMilestoneSnapshot, 'id' | 'name' | 'description' | 'reward'>> = [
    {
      id: 'collection_first_shelf',
      name: 'First Shelf',
      description: 'Bring home 10 different cards.',
      reward: 'First Shelf badge',
    },
    {
      id: 'collection_suit_sampler',
      name: 'Four Winds',
      description: 'Collect a Plumes, Quills, Basins, and Nests card.',
      reward: 'Four Winds badge',
    },
    {
      id: 'collection_curator',
      name: "Curator's Eye",
      description: 'Use Staple, Experiment, and Keepsake on discovered cards.',
      reward: "Curator's Eye badge",
    },
    {
      id: 'collection_wayfinder',
      name: 'Marked Routes',
      description: 'Bring home 3 cards from your Hunt List.',
      reward: 'Marked Routes badge',
    },
    {
      id: 'collection_many_roads',
      name: 'Many Roads Home',
      description: 'Collect through fights, routes, the market, and enemy Snags.',
      reward: 'Many Roads Home badge',
    },
    {
      id: 'collection_citywide',
      name: 'Citywide Binder',
      description: 'Collect from all 7 Major, Aviary, suit, and Snag families.',
      reward: 'Citywide Binder badge',
    },
  ];
  const progress = collectionMilestoneProgress(account);
  return definitions.map((milestone, index) => ({ ...milestone, ...progress[index] }));
}
