import { KEYWORDS, keywordIconId, type KeywordIconId } from './keyword-definitions';

export type CodexGlossaryIconId = KeywordIconId
  | 'waymark-compass'
  | 'supply-pouch'
  | 'scrap-gear'
  | 'roost-nest'
  | 'preen-kit'
  | 'route-pin'
  | 'cache-lockbox-medallion';

/**
 * When a term starts to matter. Core: the first Map-1 fights. Intermediate:
 * once the route, deck tuning and status payoffs open up. Advanced: build and
 * late-run detail a new player can safely ignore at first.
 */
export type GlossaryTier = 'core' | 'intermediate' | 'advanced';
export const GLOSSARY_TIER_LABELS: Record<GlossaryTier, string> = {
  core: 'Core',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export type CodexGlossaryTerm = {
  term: string;
  category: string;
  tier: GlossaryTier;
  /** Plain-language genre name, e.g. "energy" for Wingbeat. */
  gloss?: string;
  /** Other names that resolve to this entry, so search finds both. */
  aliases: string[];
  summary: string;
  detail: string;
  icon: CodexGlossaryIconId;
};

type CodexGlossarySeed = Omit<CodexGlossaryTerm, 'icon' | 'aliases'> & { icon?: CodexGlossaryIconId; aliases?: string[] };

function resolveGlossaryTerm(entry: CodexGlossarySeed): CodexGlossaryTerm {
  const keyword = KEYWORDS[entry.term];
  return {
    ...entry,
    gloss: entry.gloss ?? keyword?.gloss,
    aliases: [...new Set([...(keyword?.aliases ?? []), ...(entry.aliases ?? [])])]
      .filter((alias) => alias.toLowerCase() !== `${entry.term.toLowerCase()}s`),
    detail: keyword?.def ?? entry.detail,
    icon: keyword ? keywordIconId(entry.term) : entry.icon ?? 'route-pin',
  };
}

const TIER_ORDER: GlossaryTier[] = ['core', 'intermediate', 'advanced'];

/** Ordered basics to advanced; entries keep authored order within a tier. */
export const codexGlossaryTerms: CodexGlossaryTerm[] = ([
  // Core: what the first Map-1 fights and route stops ask of the player.
  { term: 'Cohesion', tier: 'core', category: 'Flock', summary: 'Flock HP: your health total.', detail: '' },
  { term: 'Wingbeat', tier: 'core', category: 'Turn Resource', summary: 'Energy: spent to play cards each turn.', detail: '' },
  { term: 'Cover', tier: 'core', category: 'Defense', summary: 'Block: absorbs hits until your next turn.', detail: '' },
  { term: 'Roost', tier: 'core', category: 'Turn Timing', gloss: 'end turn', summary: 'End turn: enemies act, then a new hand.', detail: 'Roost ends your turn. Enemies act, Cover and Wingbeats refresh, and you draw a new hand. Roost timing matters: some enemies and Waymarks check held cards, unspent Wingbeats, low-card turns, or overextension.', icon: 'roost-nest' },
  { term: 'Flow', tier: 'core', category: 'Formation', summary: 'Momentum built by playing cards.', detail: '' },
  { term: 'Surge', tier: 'core', category: 'Formation', summary: 'Full Flow: +1 damage and +1 Cover.', detail: '' },
  { term: 'Scatter', tier: 'core', category: 'Formation', summary: 'Low-Cohesion formation: weaker hits.', detail: '' },
  { term: 'Resonance', tier: 'core', category: 'Tempo', summary: 'A banked combo charge for payoffs.', detail: '' },
  { term: 'Winded', tier: 'core', category: 'Attack Debuff', summary: 'Weak: attacks deal 25% less.', detail: '' },
  { term: 'Open Sky', tier: 'core', category: 'Pressure', summary: 'Vulnerable: incoming attacks hit harder.', detail: '' },
  { term: 'Molt', tier: 'core', category: 'Stance', summary: 'A one-turn alternate card mode.', detail: '' },
  { term: 'Preen', tier: 'core', category: 'Deck Growth', gloss: 'upgrade', summary: 'Upgrade: improve a card for this run.', detail: 'Preen upgrades a card for this flight. Preened cards improve their main effects, Flock Stats, or Molt abilities. Nests and markets commonly offer Preen.', icon: 'preen-kit' },
  { term: 'Waymark', tier: 'core', category: 'Run Item', gloss: 'relic', aliases: ['Waymarks'], summary: 'Relic: a lasting run modifier.', detail: 'Waymarks are lasting run modifiers, like relics. They trigger from combat, route, suit, Molt, or economy events. Non-boss Waymarks have an active carry limit.', icon: 'waymark-compass' },
  { term: 'Supply', tier: 'core', category: 'Run Item', gloss: 'consumable', aliases: ['Supplies'], summary: 'Consumable: a single-use packed item.', detail: 'Supplies are single-use tools, like potions. Some work in combat, some on the route, and flexible Supplies work in either place.', icon: 'supply-pouch' },
  // Intermediate: route economy, deck flow, and status payoffs.
  { term: 'Hold', tier: 'intermediate', category: 'Formation', summary: 'The steady middle formation.', detail: '' },
  { term: 'Draw', tier: 'intermediate', category: 'Cards', summary: 'Add cards from draw pile to hand.', detail: '' },
  { term: 'Discard', tier: 'intermediate', category: 'Cards', summary: 'Move cards from hand to discard.', detail: '' },
  { term: 'Retain', tier: 'intermediate', category: 'Hand Planning', summary: 'Keep cards for next turn.', detail: '' },
  { term: 'Regen', tier: 'intermediate', category: 'Recovery', summary: 'Automatic start-of-turn recovery.', detail: '' },
  { term: 'Fouled', tier: 'intermediate', category: 'Flock Debuff', summary: 'Poison: lingering start-of-turn damage.', detail: '' },
  { term: 'Resonance Burst', tier: 'intermediate', category: 'Tempo', summary: 'Spend all Resonance for multiplied damage.', detail: '' },
  { term: 'Winded Burst', tier: 'intermediate', category: 'Attack Payoff', summary: 'Convert enemy Winded stacks into damage.', detail: '' },
  { term: 'Overextension', tier: 'intermediate', category: 'Risk', summary: 'Playing too many cards in one turn.', detail: 'Crossing the safe-card threshold can trigger Open Sky pressure, enemy punishers, and post-combat repair costs.', icon: 'open-sky-medallion' },
  { term: 'Snag', tier: 'intermediate', category: 'Deck Trouble', gloss: 'curse', summary: 'Curse: a bad card added to the deck.', detail: 'Snags clog hands, drain tempo, or loop back until removed at a route stop or market service.', icon: 'codex-pressure-medallion' },
  { term: 'Scrap', tier: 'intermediate', category: 'Economy', gloss: 'gold', summary: 'Gold: the run currency.', detail: 'Spend Scrap on cards, Preen, releases, Waymarks, Supplies, and late boss-prep services.', icon: 'scrap-gear' },
  { term: 'Basin', tier: 'intermediate', category: 'Route Node', gloss: 'rest stop', summary: 'Rest stop: recover Cohesion.', detail: 'Basins restore Cohesion and can offer safety, Supplies, or emergency boss-prep options.', icon: 'flock-heart' },
  { term: 'Nest', tier: 'intermediate', category: 'Route Node', summary: 'A deck-tuning route stop.', detail: 'Nests usually support Preen, card removal, Waymarks, and boss-ready tune-ups.', icon: 'preen-kit' },
  { term: 'Signal', tier: 'intermediate', category: 'Route Node', gloss: 'event', summary: 'Event: a planning and bargain stop.', detail: 'Signals offer choices that can grant Scrap, cards, Preen, Supplies, Waymarks, or route preview.', icon: 'route-pin' },
  { term: 'Cache', tier: 'intermediate', category: 'Route Node', gloss: 'treasure', summary: 'Treasure: a scavenged reward stop.', detail: 'Caches offer a choice of useful rewards and interact with cache-focused Waymarks and Supplies.', icon: 'cache-lockbox-medallion' },
  // Advanced: build-defining detail.
  { term: 'Open Sky Guard', tier: 'advanced', category: 'Defense', summary: 'Protection against Open Sky pressure.', detail: '' },
  { term: 'Frail', tier: 'advanced', category: 'Flock Debuff', summary: 'A defensive weakness status.', detail: 'Frail makes it harder to stabilize and can be reduced by cleanse effects.', icon: 'codex-pressure-medallion' },
  { term: 'Keystone', tier: 'advanced', category: 'Deck Growth', summary: 'A whole-deck suit aura.', detail: '' },
  { term: 'Flock Stats', tier: 'advanced', category: 'Deck Growth', summary: 'Permanent stats carried by cards.', detail: 'Cards contribute stats such as Cohesion, Damage, Cover, Draw, Regen, Resonance, Molt Power, and Open Sky Guard.', icon: 'flock-heart' },
] satisfies CodexGlossarySeed[]).map(resolveGlossaryTerm)
  .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));

export function glossaryTierCounts() {
  return Object.fromEntries(TIER_ORDER.map((tier) => [tier, codexGlossaryTerms.filter((term) => term.tier === tier).length])) as Record<GlossaryTier, number>;
}

/** Term, gloss or alias lookup ("energy" -> Wingbeat, "end turn" -> Roost). */
export function findGlossaryTerm(query: string): CodexGlossaryTerm | undefined {
  const needle = query.trim().toLowerCase();
  if (!needle) return undefined;
  return codexGlossaryTerms.find((entry) => [entry.term, entry.gloss ?? '', ...entry.aliases]
    .some((name) => name.toLowerCase() === needle));
}

/** Extra searchable words: aliases and glosses for every glossary term named in the text. */
export function glossarySearchSynonyms(text: string): string {
  const words = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return codexGlossaryTerms
    .filter((entry) => [entry.term, ...entry.aliases].some((name) => words.includes(` ${name.toLowerCase()} `)
      || words.includes(` ${name.toLowerCase()}s `)))
    .flatMap((entry) => [entry.gloss ?? '', ...entry.aliases])
    .filter(Boolean)
    .join(' ');
}
