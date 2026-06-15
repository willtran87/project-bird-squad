import alphaCards from '../../data/game/alpha-cards.json';
import alphaEnemies from '../../data/game/alpha-enemies.json';
import alphaRouteMap from '../../data/game/alpha-route-map.json';
import alphaStatuses from '../../data/game/alpha-statuses.json';
import alphaRewardProfiles from '../../data/game/alpha-reward-profiles.json';
import alphaEncounters from '../../data/game/alpha-encounters.json';
import alphaSupplies from '../../data/game/alpha-supplies.json';
import alphaBasins from '../../data/game/alpha-basins.json';
import alphaNests from '../../data/game/alpha-nests.json';
import alphaCache from '../../data/game/alpha-cache.json';
import birdFacts from '../../data/game/bird-facts.json';
import cardMeanings from '../../data/game/card-meanings.json';
import alphaRouteMarks from '../../data/game/alpha-route-marks.json';
import alphaMarket from '../../data/game/alpha-market.json';
import alphaSignals from '../../data/game/alpha-signals.json';
import alphaMapProfiles from '../../data/game/alpha-map-profiles.json';
import map02Content from '../../data/game/map02-content.json';
import map03Content from '../../data/game/map03-content.json';
import map04Content from '../../data/game/map04-content.json';
import majorArcana from '../../data/cards/arcana/major-arcana-bird-map.json';
import aviaryArcana from '../../data/cards/arcana/aviary-arcana.json';
import wandsArcana from '../../data/cards/arcana/minor-arcana-wands.json';
import cupsArcana from '../../data/cards/arcana/minor-arcana-cups.json';
import swordsArcana from '../../data/cards/arcana/minor-arcana-swords.json';
import pentaclesArcana from '../../data/cards/arcana/minor-arcana-pentacles.json';
import alphaCardArtManifestJson from '../../assets/runtime/cards/card-art-manifest.json';
import type { RouteBlueprint } from './route-gen';
import type {
  MapDesignProfile,
  MapDesignProfileSet,
  RewardProfile,
  RewardProfileSet,
  RuntimeCard,
  RuntimeCardArtEntry,
  RuntimeCardArtManifest,
  RuntimeCardSet,
  RuntimeEncounter,
  RuntimeEncounterSet,
  RuntimeEnemy,
  RuntimeEnemySet,
  RuntimeMapContent,
  RuntimeMarketSet,
  RuntimeNodeOptionSet,
  RuntimeRouteMap,
  RuntimeRouteMark,
  RuntimeRouteMarkSet,
  RuntimeSignal,
  RuntimeSignalSet,
  RuntimeStatusSet,
  RuntimeSupply,
  RuntimeSupplySet,
} from './types';

export const alphaCardSet = alphaCards as RuntimeCardSet;
export const alphaEnemySet = alphaEnemies as RuntimeEnemySet;
export const alphaMapOne = alphaRouteMap as RuntimeRouteMap;
// District content files for Maps 2-4 (each self-contained: route map + its
// enemies, encounters, signals, profile).
const mapContents: RuntimeMapContent[] = [
  map02Content as unknown as RuntimeMapContent,
  map03Content as unknown as RuntimeMapContent,
  map04Content as unknown as RuntimeMapContent,
];
// Ordered districts for a full run: Rooftop Blocks → Canal Markets → Signal
// Spires → High Roost.
export const alphaMaps: RuntimeRouteMap[] = [alphaMapOne, ...mapContents.map((content) => content.routeMap)];
export const alphaStatusSet = alphaStatuses as RuntimeStatusSet;
export const alphaRewardProfileSet = alphaRewardProfiles as RewardProfileSet;
export const alphaEncounterSet = alphaEncounters as RuntimeEncounterSet;
export const alphaSupplySet = alphaSupplies as RuntimeSupplySet;
export const alphaBasinSet = alphaBasins as RuntimeNodeOptionSet;
export const alphaNestSet = alphaNests as RuntimeNodeOptionSet;
export const alphaCacheSet = alphaCache as RuntimeNodeOptionSet;
export const alphaRouteMarkSet = alphaRouteMarks as RuntimeRouteMarkSet;
export const alphaMarketSet = alphaMarket as RuntimeMarketSet;
export const alphaSignalSet = alphaSignals as RuntimeSignalSet;
export const alphaMapProfileSet = alphaMapProfiles as MapDesignProfileSet;
export const alphaCardArtManifest = alphaCardArtManifestJson as RuntimeCardArtManifest;

export const alphaRouteMarkLibrary: ReadonlyMap<string, RuntimeRouteMark> = new Map(
  alphaRouteMarkSet.routeMarks.map((mark) => [mark.id, mark]),
);

export const alphaMapProfileLibrary: ReadonlyMap<string, MapDesignProfile> = new Map(
  [
    ...alphaMapProfileSet.profiles,
    ...mapContents.map((content) => content.mapProfile),
  ].map((profile) => [profile.mapId, profile]),
);

export const alphaEncounterLibrary: ReadonlyMap<string, RuntimeEncounter> = new Map(
  [
    ...alphaEncounterSet.encounters,
    ...mapContents.flatMap((content) => content.encounters),
  ].map((encounter) => [encounter.id, encounter]),
);

// All enemies from Map 1's enemy set plus every district content file, keyed by
// id. Maps 2-4 resolve encounters → enemies through this combined library.
export const alphaEnemyLibrary: ReadonlyMap<string, RuntimeEnemy> = new Map(
  [
    ...alphaEnemySet.normalEncounters,
    ...alphaEnemySet.rivalEncounters,
    ...alphaEnemySet.bosses,
    ...mapContents.flatMap((content) => content.enemies),
  ].map((enemy) => [enemy.id, enemy]),
);

// All signals from Map 1 plus every district content file, keyed by id.
export const alphaSignalLibrary: ReadonlyMap<string, RuntimeSignal> = new Map(
  [
    ...alphaSignalSet.signals,
    ...mapContents.flatMap((content) => content.signals),
  ].map((signal) => [signal.id, signal]),
);

export const alphaRewardProfileLibrary: ReadonlyMap<string, RewardProfile> = new Map(
  alphaRewardProfileSet.profiles.map((profile) => [profile.id, profile]),
);

// Per-district generation blueprints: the content pools the procedural route
// generator draws from, derived from each authored route map (entry/boss/payloads
// by type) unioned with the map's encounter/signal libraries for a fuller pool.
const blueprintFromMap = (map: RuntimeRouteMap): RouteBlueprint => {
  const payloadsOf = (type: string) => [...new Set(map.nodes.filter((node) => node.type === type).map((node) => node.payloadId))];
  const uniq = (ids: string[]) => [...new Set(ids.filter(Boolean))];
  const entryNode = map.nodes.find((node) => node.id === map.entryNodeId);
  const bossNode = map.nodes.find((node) => node.id === map.bossNodeId);
  const libStreet = [...alphaEncounterLibrary.values()].filter((enc) => enc.mapId === map.id && enc.nodeType === 'street').map((enc) => enc.id);
  const libRival = [...alphaEncounterLibrary.values()].filter((enc) => enc.mapId === map.id && enc.nodeType === 'rival').map((enc) => enc.id);
  const libSignal = [...alphaSignalLibrary.values()].filter((sig) => sig.mapId === map.id).map((sig) => sig.id);
  const first = (type: string, fallback: string) => payloadsOf(type)[0] ?? fallback;
  return {
    id: map.id,
    name: map.name,
    index: map.index,
    entryEncounterId: entryNode?.payloadId ?? payloadsOf('street')[0] ?? '',
    bossEncounterId: bossNode?.payloadId ?? payloadsOf('boss')[0] ?? '',
    streetEncounterIds: uniq([...payloadsOf('street'), ...libStreet]),
    rivalEncounterIds: uniq([...payloadsOf('rival'), ...libRival]),
    signalIds: uniq([...payloadsOf('signal'), ...libSignal]),
    basinPayloadId: first('basin', 'basin_alpha'),
    nestPayloadId: first('nest', 'nest_alpha'),
    marketPayloadId: first('market', 'alpha_market'),
    cachePayloadId: first('cache', 'alpha_rooftop_cache'),
  };
};
export const routeBlueprints: RouteBlueprint[] = alphaMaps.map(blueprintFromMap);

export const alphaSupplyLibrary: ReadonlyMap<string, RuntimeSupply> = new Map(
  alphaSupplySet.supplies.map((supply) => [supply.id, supply]),
);

export const alphaCardLibrary: ReadonlyMap<string, RuntimeCard> = new Map(
  alphaCardSet.cards.map((card) => [card.id, card]),
);

export const alphaCardArtLibrary: ReadonlyMap<string, RuntimeCardArtEntry> = new Map(
  alphaCardArtManifest.cards.map((entry) => [entry.cardId, entry]),
);

// Card flavor / bird identity, joined from the canonical arcana lore files so the
// runtime card view can show description + gameplay fantasy that the playable
// alpha-cards.json deliberately omits.
export interface CardFlavor {
  bird?: string;
  flavor: string; // short gameplay fantasy
  lore: string; // longer descriptive blurb
}
type ArcanaLoreEntry = {
  id?: string;
  bird?: string;
  gameplayFantasy?: string;
  coreMeaning?: string;
  description?: string;
};
const arcanaLoreSets = [majorArcana, aviaryArcana, wandsArcana, cupsArcana, swordsArcana, pentaclesArcana] as Array<{
  cards?: ArcanaLoreEntry[];
}>;
export const cardFlavorLibrary: ReadonlyMap<string, CardFlavor> = new Map(
  arcanaLoreSets.flatMap((set) =>
    (set.cards ?? [])
      .filter((entry) => typeof entry.id === 'string')
      .map((entry) => [
        entry.id as string,
        {
          bird: entry.bird,
          flavor: entry.gameplayFantasy ?? entry.coreMeaning ?? '',
          lore: entry.description ?? '',
        },
      ] as const),
  ),
);

export function getCardFlavor(cardId: string): CardFlavor | undefined {
  return cardFlavorLibrary.get(cardId);
}

// Real-world ornithology trivia for the Card Codex, keyed by bird common name.
const birdFactSet = birdFacts as { facts: Record<string, string> };
export const birdFactLibrary: ReadonlyMap<string, string> = new Map(Object.entries(birdFactSet.facts ?? {}));
export function getBirdFact(bird: string | undefined): string | undefined {
  return bird ? birdFactLibrary.get(bird) : undefined;
}

// Tarot reading per card: keyword line (core) + upright + reversed meanings,
// shown in the Card Codex. Keyed by card id (data/game/card-meanings.json).
export interface CardMeaning { core: string; upright: string; reversed: string }
const cardMeaningSet = cardMeanings as { meanings: Record<string, CardMeaning> };
export const cardMeaningLibrary: ReadonlyMap<string, CardMeaning> = new Map(Object.entries(cardMeaningSet.meanings ?? {}));
export function getCardMeaning(cardId: string): CardMeaning | undefined {
  return cardMeaningLibrary.get(cardId);
}

export function getAlphaCard(cardId: string): RuntimeCard {
  const card = alphaCardLibrary.get(cardId);
  if (!card) {
    throw new Error(`Unknown Alpha card: ${cardId}`);
  }
  return card;
}

export function getAlphaStarterDeck(): RuntimeCard[] {
  return alphaCardSet.starterDeck.map(getAlphaCard);
}

export function getAlphaRewardPool(): RuntimeCard[] {
  return alphaCardSet.rewardPool.map(getAlphaCard);
}

export function getAlphaOwnedCardIds(): Set<string> {
  return new Set(alphaCardSet.starterDeck);
}

export function getAlphaCardArt(cardId: string): RuntimeCardArtEntry {
  const entry = alphaCardArtLibrary.get(cardId);
  if (!entry) {
    throw new Error(`Missing Alpha card art manifest entry: ${cardId}`);
  }
  return entry;
}
