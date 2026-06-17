import birdFacts from '../../data/game/bird-facts.json';
import cardMeanings from '../../data/game/card-meanings.json';
import enemyVarietyContractsJson from '../../data/game/enemy-variety-contracts.json';
import majorArcana from '../../data/cards/arcana/major-arcana-bird-map.json';
import aviaryArcana from '../../data/cards/arcana/aviary-arcana.json';
import wandsArcana from '../../data/cards/arcana/minor-arcana-wands.json';
import cupsArcana from '../../data/cards/arcana/minor-arcana-cups.json';
import swordsArcana from '../../data/cards/arcana/minor-arcana-swords.json';
import pentaclesArcana from '../../data/cards/arcana/minor-arcana-pentacles.json';
import type { CardFlavor, CardMeaning, ReserveEnemyContract } from './runtime-data';

const enemyVarietyContracts = enemyVarietyContractsJson as {
  reserveEnemies: ReserveEnemyContract[];
  fashionDirections?: Record<string, string>;
};

export const reserveEnemyContracts = enemyVarietyContracts.reserveEnemies;
export const reserveEnemyFashionDirections = enemyVarietyContracts.fashionDirections ?? {};

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

const birdFactSet = birdFacts as { facts: Record<string, string> };
export const birdFactLibrary: ReadonlyMap<string, string> = new Map(Object.entries(birdFactSet.facts ?? {}));

export function getBirdFact(bird: string | undefined): string | undefined {
  return bird ? birdFactLibrary.get(bird) : undefined;
}

const cardMeaningSet = cardMeanings as { meanings: Record<string, CardMeaning> };
export const cardMeaningLibrary: ReadonlyMap<string, CardMeaning> = new Map(Object.entries(cardMeaningSet.meanings ?? {}));

export function getCardMeaning(cardId: string): CardMeaning | undefined {
  return cardMeaningLibrary.get(cardId);
}
