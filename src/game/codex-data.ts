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
import { KEYWORDS } from './keyword-definitions';

export { getLeaderLore } from './leader-lore';

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


export type CodexGlossaryTerm = { term: string; category: string; summary: string; detail: string };

export const codexGlossaryTerms: CodexGlossaryTerm[] = [
    { term: 'Cohesion', category: 'Flock', summary: 'The flock health total.', detail: 'If Cohesion reaches 0, the run fails. Healing restores Cohesion up to the current maximum.' },
    { term: 'Cover', category: 'Defense', summary: 'Temporary protection against enemy damage.', detail: 'Cover blocks incoming attack damage first and usually resets at the start of your next turn.' },
    { term: 'Wingbeat', category: 'Turn Resource', summary: 'The energy spent to play cards.', detail: 'Most cards cost Wingbeat. Unspent Wingbeat can also matter for clean Roost and restraint Waymarks.' },
    { term: 'Resonance', category: 'Tempo', summary: 'A banked combo resource.', detail: 'Cards and Supplies can gain or spend Resonance. Burst effects spend stored Resonance for larger payoffs.' },
    { term: 'Molt', category: 'Stance', summary: 'A one-turn alternate card mode.', detail: 'Entering Molt changes cards to their Molt abilities for the turn. Ending a Molt turn can leave the flock exposed.' },
    { term: 'Open Sky', category: 'Pressure', summary: 'A dangerous exposed state.', detail: 'Open Sky makes enemy pressure sharper. Open Sky Guard prevents or softens exposure damage increases.' },
    { term: 'Open Sky Guard', category: 'Defense', summary: 'Protection against Open Sky pressure.', detail: 'Guard is spent before Open Sky pressure lands, and some route effects can carry it into the next fight.' },
    { term: 'Winded', category: 'Attack Debuff', summary: 'Weakens the affected enemy or flock.', detail: '' },
    { term: 'Fouled', category: 'Flock Debuff', summary: 'A lingering harmful status.', detail: 'Fouled is pressure on the flock that can be reduced by cleanse effects.' },
    { term: 'Frail', category: 'Flock Debuff', summary: 'A defensive weakness status.', detail: 'Frail makes it harder to stabilize and can be reduced by cleanse effects.' },
    { term: 'Snag', category: 'Deck Trouble', summary: 'A bad card added to the deck.', detail: 'Snags clog hands, drain tempo, or loop back until removed at a route stop or market service.' },
    { term: 'Roost', category: 'Turn Timing', summary: 'Ending the current combat turn.', detail: 'Roost timing matters: some enemies and Waymarks check held cards, unspent Wingbeat, low-card turns, or overextension.' },
    { term: 'Overextension', category: 'Risk', summary: 'Playing too many cards in one turn.', detail: 'Crossing the safe-card threshold can trigger Open Sky pressure, enemy punishers, and post-combat repair costs.' },
    { term: 'Retain', category: 'Hand Planning', summary: 'Keep cards for next turn.', detail: 'Retained cards stay in hand through Roost, helping set up combos instead of dumping every card immediately.' },
    { term: 'Draw', category: 'Cards', summary: 'Add cards from draw pile to hand.', detail: 'Draw improves options now or next turn, but can encourage overextension if played carelessly.' },
    { term: 'Discard', category: 'Cards', summary: 'Move cards from hand to discard.', detail: 'Discard can be a cost, a filter, or a payoff for cards that scale with discarded cards.' },
    { term: 'Preen', category: 'Deck Growth', summary: 'Upgrade a card.', detail: 'Preened cards improve their main effects, Flock Stats, or Molt abilities. Nests and markets commonly offer Preen.' },
    { term: 'Flock Stats', category: 'Deck Growth', summary: 'Permanent stats carried by cards.', detail: 'Cards contribute stats such as Cohesion, Damage, Cover, Draw, Regen, Resonance, Molt Power, and Open Sky Guard.' },
    { term: 'Waymark', category: 'Run Item', summary: 'A lasting run modifier.', detail: 'Waymarks trigger from combat, route, suit, Molt, or economy events. Non-boss Waymarks have an active carry limit.' },
    { term: 'Supply', category: 'Run Item', summary: 'A packed consumable item.', detail: 'Supplies are single-use tools. Some work in combat, some on the route, and flexible Supplies work in either place.' },
    { term: 'Scrap', category: 'Economy', summary: 'The run currency.', detail: 'Spend Scrap on cards, Preen, releases, Waymarks, Supplies, and late boss-prep services.' },
    { term: 'Basin', category: 'Route Node', summary: 'A recovery route stop.', detail: 'Basins restore Cohesion and can offer safety, Supplies, or emergency boss-prep options.' },
    { term: 'Nest', category: 'Route Node', summary: 'A deck-tuning route stop.', detail: 'Nests usually support Preen, card removal, Waymarks, and boss-ready tune-ups.' },
    { term: 'Signal', category: 'Route Node', summary: 'A planning and bargain stop.', detail: 'Signals offer choices that can grant Scrap, cards, Preen, Supplies, Waymarks, or route preview.' },
    { term: 'Cache', category: 'Route Node', summary: 'A scavenged reward stop.', detail: 'Caches offer a choice of useful rewards and interact with cache-focused Waymarks and Supplies.' },
].map(entry => ({ ...entry, detail: KEYWORDS[entry.term]?.def ?? entry.detail }));
