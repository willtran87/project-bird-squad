import { KEYWORDS, keywordIconId, type KeywordIconId } from './keyword-definitions';

export type CodexGlossaryIconId = KeywordIconId
  | 'waymark-compass'
  | 'supply-pouch'
  | 'scrap-gear'
  | 'roost-nest'
  | 'preen-kit'
  | 'route-pin'
  | 'cache-lockbox-medallion';
export type CodexGlossaryTerm = {
  term: string;
  category: string;
  summary: string;
  detail: string;
  icon: CodexGlossaryIconId;
};

type CodexGlossarySeed = Omit<CodexGlossaryTerm, 'icon'> & { icon?: CodexGlossaryIconId };

function resolveGlossaryTerm(entry: CodexGlossarySeed): CodexGlossaryTerm {
  const keyword = KEYWORDS[entry.term];
  return {
    ...entry,
    detail: keyword?.def ?? entry.detail,
    icon: keyword ? keywordIconId(entry.term) : entry.icon ?? 'route-pin',
  };
}

export const codexGlossaryTerms: CodexGlossaryTerm[] = ([
  { term: 'Cohesion', category: 'Flock', summary: 'The flock health total.', detail: 'If Cohesion reaches 0, the run fails. Healing restores Cohesion up to the current maximum.' },
  { term: 'Cover', category: 'Defense', summary: 'Temporary protection against enemy damage.', detail: 'Cover blocks incoming attack damage first and usually resets at the start of your next turn.' },
  { term: 'Regen', category: 'Recovery', summary: 'Automatic start-of-turn recovery.', detail: '' },
  { term: 'Wingbeat', category: 'Turn Resource', summary: 'The energy spent to play cards.', detail: 'Most cards cost Wingbeat. Unspent Wingbeat can also matter for clean Roost and restraint Waymarks.' },
  { term: 'Energy', category: 'Turn Resource', summary: 'Another name for the card-playing resource.', detail: '' },
  { term: 'Resonance', category: 'Tempo', summary: 'A banked combo resource.', detail: 'Cards and Supplies can gain or spend Resonance. Burst effects spend stored Resonance for larger payoffs.' },
  { term: 'Resonance Burst', category: 'Tempo', summary: 'Spend all Resonance for multiplied damage.', detail: '' },
  { term: 'Flow', category: 'Formation', summary: 'Momentum built by playing cards.', detail: '' },
  { term: 'Surge', category: 'Formation', summary: 'The bonus state created by full Flow.', detail: '' },
  { term: 'Hold', category: 'Formation', summary: 'The steady middle formation.', detail: '' },
  { term: 'Scatter', category: 'Formation', summary: 'The weakened low-Cohesion formation.', detail: '' },
  { term: 'Molt', category: 'Stance', summary: 'A one-turn alternate card mode.', detail: 'Entering Molt changes cards to their Molt abilities for the turn. Ending a Molt turn can leave the flock exposed.' },
  { term: 'Open Sky', category: 'Pressure', summary: 'A dangerous exposed state.', detail: 'Open Sky makes enemy pressure sharper. Open Sky Guard prevents or softens exposure damage increases.' },
  { term: 'Open Sky Guard', category: 'Defense', summary: 'Protection against Open Sky pressure.', detail: 'Guard is spent before Open Sky pressure lands, and some route effects can carry it into the next fight.' },
  { term: 'Winded', category: 'Attack Debuff', summary: 'Weakens the affected enemy or flock.', detail: '' },
  { term: 'Winded Burst', category: 'Attack Payoff', summary: 'Convert enemy Winded stacks into damage.', detail: '' },
  { term: 'Fouled', category: 'Flock Debuff', summary: 'A lingering harmful status.', detail: 'Fouled is pressure on the flock that can be reduced by cleanse effects.' },
  { term: 'Frail', category: 'Flock Debuff', summary: 'A defensive weakness status.', detail: 'Frail makes it harder to stabilize and can be reduced by cleanse effects.', icon: 'codex-pressure-medallion' },
  { term: 'Snag', category: 'Deck Trouble', summary: 'A bad card added to the deck.', detail: 'Snags clog hands, drain tempo, or loop back until removed at a route stop or market service.', icon: 'codex-pressure-medallion' },
  { term: 'Roost', category: 'Turn Timing', summary: 'Ending the current combat turn.', detail: 'Roost timing matters: some enemies and Waymarks check held cards, unspent Wingbeat, low-card turns, or overextension.', icon: 'roost-nest' },
  { term: 'Overextension', category: 'Risk', summary: 'Playing too many cards in one turn.', detail: 'Crossing the safe-card threshold can trigger Open Sky pressure, enemy punishers, and post-combat repair costs.', icon: 'open-sky-medallion' },
  { term: 'Retain', category: 'Hand Planning', summary: 'Keep cards for next turn.', detail: 'Retained cards stay in hand through Roost, helping set up combos instead of dumping every card immediately.' },
  { term: 'Draw', category: 'Cards', summary: 'Add cards from draw pile to hand.', detail: 'Draw improves options now or next turn, but can encourage overextension if played carelessly.' },
  { term: 'Discard', category: 'Cards', summary: 'Move cards from hand to discard.', detail: 'Discard can be a cost, a filter, or a payoff for cards that scale with discarded cards.' },
  { term: 'Preen', category: 'Deck Growth', summary: 'Upgrade a card.', detail: 'Preened cards improve their main effects, Flock Stats, or Molt abilities. Nests and markets commonly offer Preen.', icon: 'preen-kit' },
  { term: 'Flock Stats', category: 'Deck Growth', summary: 'Permanent stats carried by cards.', detail: 'Cards contribute stats such as Cohesion, Damage, Cover, Draw, Regen, Resonance, Molt Power, and Open Sky Guard.', icon: 'flock-heart' },
  { term: 'Keystone', category: 'Deck Growth', summary: 'A whole-deck suit aura.', detail: '' },
  { term: 'Waymark', category: 'Run Item', summary: 'A lasting run modifier.', detail: 'Waymarks trigger from combat, route, suit, Molt, or economy events. Non-boss Waymarks have an active carry limit.', icon: 'waymark-compass' },
  { term: 'Supply', category: 'Run Item', summary: 'A packed consumable item.', detail: 'Supplies are single-use tools. Some work in combat, some on the route, and flexible Supplies work in either place.', icon: 'supply-pouch' },
  { term: 'Scrap', category: 'Economy', summary: 'The run currency.', detail: 'Spend Scrap on cards, Preen, releases, Waymarks, Supplies, and late boss-prep services.', icon: 'scrap-gear' },
  { term: 'Basin', category: 'Route Node', summary: 'A recovery route stop.', detail: 'Basins restore Cohesion and can offer safety, Supplies, or emergency boss-prep options.', icon: 'flock-heart' },
  { term: 'Nest', category: 'Route Node', summary: 'A deck-tuning route stop.', detail: 'Nests usually support Preen, card removal, Waymarks, and boss-ready tune-ups.', icon: 'preen-kit' },
  { term: 'Signal', category: 'Route Node', summary: 'A planning and bargain stop.', detail: 'Signals offer choices that can grant Scrap, cards, Preen, Supplies, Waymarks, or route preview.', icon: 'route-pin' },
  { term: 'Cache', category: 'Route Node', summary: 'A scavenged reward stop.', detail: 'Caches offer a choice of useful rewards and interact with cache-focused Waymarks and Supplies.', icon: 'cache-lockbox-medallion' },
] satisfies CodexGlossarySeed[]).map(resolveGlossaryTerm);
