/**
 * Turns the stored unlock queue (`kind:id` strings, see ceremony-queue.ts)
 * into the reveals one visit to the title or Collection will show. Pure.
 */

export type RevealKind = 'leader' | 'achievement' | 'card';

export interface Reveal {
  kind: RevealKind;
  id: string;
  /** Small caps line above the card. */
  kicker: string;
  title: string;
  /** One line: why the player has this now. */
  why: string;
  /** Queue entries this reveal retires once it has been shown. */
  consumes: string[];
}

export interface RevealLookups {
  leader: (id: string) => { name: string; unlock?: string } | undefined;
  achievement: (id: string) => { name: string; desc: string } | undefined;
  card: (id: string) => { name: string; source?: string } | undefined;
}

export const MAX_CARD_REVEALS = 3;
export const MAX_QUEUE = 40;

/** Stored form: one `kind:id` per line, appended by ceremony-queue.ts. */
export function parseQueue(raw: string | null | undefined): string[] {
  return [...new Set((raw ?? '').split('\n').map((entry) => entry.trim()).filter(Boolean))].slice(-MAX_QUEUE);
}

export const serializeQueue = (queue: readonly string[]) => queue.slice(-MAX_QUEUE).join('\n');

const CARD_SOURCE: Record<string, string> = {
  combat_reward: 'First copy, claimed after a fight.',
  route_reward: 'First copy, picked up on the route.',
  market: 'First copy, bought at a market stall.',
  snag: 'First copy, picked up as a Snag.',
};

const ORDER: Record<RevealKind, number> = { leader: 0, achievement: 1, card: 2 };

function parse(entry: string): { kind: RevealKind; id: string } | undefined {
  const cut = entry.indexOf(':');
  const kind = entry.slice(0, cut), id = entry.slice(cut + 1);
  return cut > 0 && id && (kind === 'leader' || kind === 'achievement' || kind === 'card') ? { kind, id } : undefined;
}

/**
 * Leaders first, then achievements, then cards in the order they were
 * claimed. At most `maxCards` cards get their own reveal; the last one stands
 * in for the rest, so a long first flight does not become a long ceremony.
 * Entries whose content no longer exists are dropped (see `staleEntries`).
 */
export function buildReveals(queue: readonly string[], lookups: RevealLookups, maxCards = MAX_CARD_REVEALS): Reveal[] {
  const reveals: Reveal[] = [];
  const cards: Reveal[] = [];
  for (const entry of [...new Set(queue)]) {
    const parsed = parse(entry);
    if (!parsed) continue;
    if (parsed.kind === 'leader') {
      const leader = lookups.leader(parsed.id);
      if (leader) reveals.push({ ...parsed, kicker: 'LEADER UNLOCKED', title: leader.name,
        why: leader.unlock ?? 'A new crew is ready in Flight setup.', consumes: [entry] });
    } else if (parsed.kind === 'achievement') {
      const achievement = lookups.achievement(parsed.id);
      if (achievement) reveals.push({ ...parsed, kicker: 'ACHIEVEMENT', title: achievement.name, why: achievement.desc, consumes: [entry] });
    } else {
      const card = lookups.card(parsed.id);
      if (card) cards.push({ ...parsed, kicker: 'NEW CARD', title: card.name,
        why: CARD_SOURCE[card.source ?? ''] ?? 'New to your Collection.', consumes: [entry] });
    }
  }
  const shown = cards.slice(0, Math.max(1, maxCards));
  const rest = cards.slice(shown.length);
  const last = shown[shown.length - 1];
  if (last && rest.length) {
    last.why = `${last.why} ${rest.length} more new card${rest.length === 1 ? ' is' : 's are'} waiting in your Collection.`;
    last.consumes = [...last.consumes, ...rest.flatMap((card) => card.consumes)];
  }
  return [...reveals, ...shown].sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
}

/** Queue entries no reveal will ever retire: malformed, or naming removed content. */
export function staleEntries(queue: readonly string[], reveals: readonly Reveal[]): string[] {
  const live = new Set(reveals.flatMap((reveal) => reveal.consumes));
  return queue.filter((entry) => !live.has(entry));
}

/** The queue after `reveal` has been shown. */
export function retire(queue: readonly string[], consumed: readonly string[]): string[] {
  const gone = new Set(consumed);
  return queue.filter((entry) => !gone.has(entry));
}
