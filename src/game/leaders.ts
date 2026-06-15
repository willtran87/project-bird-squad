// Flock Leaders: pickable starting archetypes. Each is a distinct 10-card starter
// deck of UNIQUE cards (the deck is singleton — never two of the same card; cards
// are treated as one-of-a-kind). Drawn from the existing playable pool, separate
// from the validated alpha-cards.json starterDeck which the default "Fledgling
// Flock" leader mirrors.

export interface FlockLeader {
  id: string;
  name: string;
  bird: string;
  suit: string; // display tag: Balanced / Plumes / Quills / Basins / Nests
  blurb: string;
  startingDeckIds: string[]; // 10 UNIQUE card ids (singleton — no duplicates)
  // Formation-Flow identity (optional; defaults flowMax 5 / startFlow 0). Lets a
  // leader reach Surge faster or open a fight closer to it.
  flowMax?: number;
  startFlow?: number;
}

export const flockLeaders: FlockLeader[] = [
  {
    id: 'fledgling',
    name: 'The Fledgling Flock',
    bird: 'House Sparrow',
    suit: 'Balanced',
    blurb: 'A bit of everything — the classic starting flock. Learn the ropes across all four suits.',
    startingDeckIds: ['major_00', 'wands_ace', 'wands_08', 'swords_02', 'swords_ace', 'cups_ace', 'cups_03', 'pentacles_04', 'pentacles_02', 'aviary_25'],
  },
  {
    id: 'spark_caller',
    name: 'The Spark-Caller',
    bird: 'Lilac-breasted Roller',
    suit: 'Plumes',
    blurb: 'Builds Resonance and rides the tempo — fast hands, faster plays. Surges a beat sooner.',
    startingDeckIds: ['wands_ace', 'wands_04', 'wands_02', 'wands_03', 'wands_05', 'wands_08', 'swords_ace', 'cups_03', 'pentacles_04', 'major_19'],
    flowMax: 4, // tempo archetype reaches Surge faster
  },
  {
    id: 'talon',
    name: 'The Talon',
    bird: 'Loggerhead Shrike',
    suit: 'Quills',
    blurb: 'All edge. Press Winded and finish before they recover — opens a fight already pressing.',
    startingDeckIds: ['swords_ace', 'swords_04', 'swords_02', 'swords_03', 'swords_05', 'wands_ace', 'cups_03', 'pentacles_04', 'major_07', 'aviary_25'],
    startFlow: 2, // aggressive archetype comes out of the gate near Surge
  },
  {
    id: 'tidewarden',
    name: 'The Tidewarden',
    bird: 'Great Blue Heron',
    suit: 'Basins',
    blurb: 'Outlasts the storm — heal through attrition and never break.',
    startingDeckIds: ['cups_ace', 'cups_05', 'cups_02', 'cups_03', 'cups_04', 'pentacles_04', 'swords_ace', 'wands_ace', 'major_17', 'aviary_25'],
  },
  {
    id: 'roostkeeper',
    name: 'The Roostkeeper',
    bird: 'Baya Weaver',
    suit: 'Nests',
    blurb: 'A wall of Cover — turtle up, then bury them under your nest.',
    startingDeckIds: ['pentacles_04', 'pentacles_05', 'pentacles_02', 'pentacles_ace', 'pentacles_03', 'cups_03', 'swords_ace', 'wands_ace', 'major_04', 'aviary_25'],
  },
];

// Enforce the singleton rule at load: a leader deck must be 10 unique cards.
for (const leader of flockLeaders) {
  const seen = new Set<string>();
  for (const id of leader.startingDeckIds) {
    if (seen.has(id)) {
      throw new Error(`Flock Leader "${leader.id}" has a duplicate card "${id}" — decks must be singleton (one of each).`);
    }
    seen.add(id);
  }
}

export const defaultLeaderId = flockLeaders[0].id;

export function getLeader(id: string | undefined): FlockLeader {
  return flockLeaders.find((leader) => leader.id === id) ?? flockLeaders[0];
}
