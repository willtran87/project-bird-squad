/**
 * Plain facts about one finished flight, read from its stored summary. Shared
 * by the run recap, the photo card and Daily Flight scoring. Pure: everything
 * the function needs about the game arrives through `RunFactsContext`.
 */

export interface RunFactsSource {
  id: string;
  seed: string;
  result: 'win' | 'loss';
  leaderId?: string;
  difficulty?: number;
  runMode?: 'full' | 'quick';
  mapId: string;
  turnsTaken: number;
  durationMs: number;
  currentCohesion: number;
  maxCohesion: number;
  deck: Array<{ id: string }>;
  routeMarks: string[];
  cardRewards: Array<{ picked?: string }>;
  combatResults: Array<{
    damageDealt: number;
    cohesionLost: number;
    cardContributions?: Array<{ cardId: string; damage: number; plays: number }>;
  }>;
}

export interface RunFactsContext {
  /** District map ids in the order this flight length visits them. */
  districtIds: readonly string[];
  /** The Leader's starting deck, to tell added cards from starters. */
  starterIds: readonly string[];
  /** Snags are forced into the deck; they are not counted as chosen cards. */
  isSnag?: (id: string) => boolean;
}

export interface RunFacts {
  result: 'win' | 'loss';
  leaderId?: string;
  districtsCleared: number;
  districtTotal: number;
  /** 0-based index of the district the flight ended in. */
  lastDistrict: number;
  fightsWon: number;
  damageDealt: number;
  damageTaken: number;
  /** Most damage dealt in a single fight. Single hits are not recorded. */
  bestFightDamage: number;
  topCard?: { cardId: string; damage: number; plays: number };
  deckSize: number;
  waymarks: number;
  cardsAdded: number;
  cohesion: number;
  maxCohesion: number;
  turns: number;
  durationMs: number;
}

const whole = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

export function runFacts(summary: RunFactsSource, context: RunFactsContext): RunFacts {
  const win = summary.result === 'win';
  const districtTotal = Math.max(1, context.districtIds.length);
  const reached = Math.max(0, context.districtIds.indexOf(summary.mapId));
  const combats = Array.isArray(summary.combatResults) ? summary.combatResults : [];
  const deck = (summary.deck ?? []).filter((card) => !context.isSnag?.(card.id));
  const starters = new Set(context.starterIds);
  const drafted = (summary.cardRewards ?? []).filter((reward) => Boolean(reward.picked)).length;
  const byCard = new Map<string, { cardId: string; damage: number; plays: number }>();
  for (const combat of combats) for (const row of combat.cardContributions ?? []) {
    const total = byCard.get(row.cardId) ?? { cardId: row.cardId, damage: 0, plays: 0 };
    total.damage += whole(row.damage);
    total.plays += whole(row.plays);
    byCard.set(row.cardId, total);
  }
  const topCard = [...byCard.values()]
    .filter((row) => row.damage > 0)
    .sort((a, b) => b.damage - a.damage || b.plays - a.plays || a.cardId.localeCompare(b.cardId))[0];
  return {
    result: summary.result,
    leaderId: summary.leaderId,
    districtsCleared: win ? districtTotal : Math.min(reached, districtTotal - 1),
    districtTotal,
    lastDistrict: win ? districtTotal - 1 : reached,
    // A lost flight's final fight is recorded too; it was not won.
    fightsWon: Math.max(0, combats.length - (win ? 0 : 1)),
    damageDealt: combats.reduce((sum, combat) => sum + whole(combat.damageDealt), 0),
    damageTaken: combats.reduce((sum, combat) => sum + whole(combat.cohesionLost), 0),
    bestFightDamage: combats.reduce((best, combat) => Math.max(best, whole(combat.damageDealt)), 0),
    topCard,
    deckSize: deck.length,
    waymarks: (summary.routeMarks ?? []).length,
    cardsAdded: Math.max(drafted, deck.filter((card) => !starters.has(card.id)).length),
    cohesion: whole(summary.currentCohesion),
    maxCohesion: whole(summary.maxCohesion),
    turns: whole(summary.turnsTaken),
    durationMs: whole(summary.durationMs),
  };
}

export interface ScoreLine { label: string; detail: string; points: number }
export interface FlightScore { total: number; lines: ScoreLine[] }

export const SCORE_RULES = {
  district: 1000,
  fight: 150,
  finish: 2000,
  cohesion: 20,
  /** A finished flight earns this, less `beat` for every beat it took. */
  paceBudget: 900,
  beat: 6,
} as const;

/**
 * The Daily Flight score. Deliberately simple enough to check by hand:
 * districts and fights always count; the finish, the Cohesion the flock kept
 * and the pace bonus only count on a completed flight.
 */
export function flightScore(facts: Pick<RunFacts, 'result' | 'districtsCleared' | 'fightsWon' | 'cohesion' | 'turns'>): FlightScore {
  const win = facts.result === 'win';
  const districts = whole(facts.districtsCleared), fights = whole(facts.fightsWon);
  const cohesion = whole(facts.cohesion), turns = whole(facts.turns);
  const lines: ScoreLine[] = [
    { label: 'Districts cleared', detail: `${districts} x ${SCORE_RULES.district}`, points: districts * SCORE_RULES.district },
    { label: 'Fights won', detail: `${fights} x ${SCORE_RULES.fight}`, points: fights * SCORE_RULES.fight },
  ];
  if (win) {
    lines.push(
      { label: 'Flight completed', detail: 'bonus', points: SCORE_RULES.finish },
      { label: 'Cohesion kept', detail: `${cohesion} x ${SCORE_RULES.cohesion}`, points: cohesion * SCORE_RULES.cohesion },
      { label: 'Pace', detail: `${SCORE_RULES.paceBudget} - ${turns} beats x ${SCORE_RULES.beat}`,
        points: Math.max(0, SCORE_RULES.paceBudget - turns * SCORE_RULES.beat) },
    );
  }
  return { total: lines.reduce((sum, line) => sum + line.points, 0), lines };
}

/** `1h 04m`, `12m 05s` or `48s`. */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(whole(ms) / 1000);
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  const two = (value: number) => String(value).padStart(2, '0');
  if (h) return `${h}h ${two(m)}m`;
  return m ? `${m}m ${two(s)}s` : `${s}s`;
}
