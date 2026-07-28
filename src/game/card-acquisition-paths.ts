import { flockLeaders } from './leaders';
import { getAlphaRewardPool } from './runtime-data';
import type { CardAcquisitionSource } from './meta';

export interface CardAcquisitionPath {
  id: CardAcquisitionSource;
  label: string;
  description: string;
}

export interface CardAcquisitionProfile {
  permanent: true;
  rotating: false;
  seasonal: false;
  storeRequired: false;
  paths: CardAcquisitionPath[];
  starterLeaderNames: string[];
}

export const CARD_ACQUISITION_PATHS: ReadonlyArray<CardAcquisitionPath> = [
  {
    id: 'starter_flock',
    label: 'Starter Flock',
    description: 'Begin a flight with a Flock Leader whose starting deck contains this card.',
  },
  {
    id: 'combat_reward',
    label: 'Fight Rewards',
    description: 'Choose it from a card offer after combat.',
  },
  {
    id: 'route_reward',
    label: 'Route Choices',
    description: 'Choose or gain it from a card-bearing route event.',
  },
  {
    id: 'market',
    label: 'Canal Market',
    description: 'Buy it when it appears in permanent card stock.',
  },
  {
    id: 'snag',
    label: 'Enemy Snags',
    description: 'Encounter an enemy that inserts this Snag during combat.',
  },
];

const rewardCardIds = new Set(getAlphaRewardPool().map((card) => card.id));

export function cardAcquisitionProfile(
  cardId: string,
  kind: string | undefined,
): CardAcquisitionProfile {
  const starterLeaderNames = flockLeaders
    .filter((leader) => leader.startingDeckIds.includes(cardId))
    .map((leader) => leader.name);
  const pathIds = new Set<CardAcquisitionSource>();
  if (kind === 'snag') {
    pathIds.add('snag');
  } else {
    if (starterLeaderNames.length > 0) pathIds.add('starter_flock');
    if (rewardCardIds.has(cardId)) {
      pathIds.add('combat_reward');
      pathIds.add('route_reward');
      pathIds.add('market');
    }
  }
  return {
    permanent: true,
    rotating: false,
    seasonal: false,
    storeRequired: false,
    paths: CARD_ACQUISITION_PATHS.filter((path) => pathIds.has(path.id)),
    starterLeaderNames,
  };
}
