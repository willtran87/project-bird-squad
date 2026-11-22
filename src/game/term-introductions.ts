import { buildKeywordTokens, KEYWORDS } from './keyword-definitions';
import { firstFlightGuideProgress } from './first-flight-guide';
import { readJournaledJson, writeJournaledJson } from './safe-storage';

/**
 * Persisted beside the first-flight guide, with the same journaled storage.
 * `replays` mirrors the guide's replay count: Replay Guide re-teaches terms too.
 */
export const TERM_INTRODUCTIONS_KEY = 'birdsquad.termIntroductions';
type TermIntroductionProgress = { replays: number; terms: string[] };

function sanitizeTermIntroductions(value: unknown): TermIntroductionProgress | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const terms = Array.isArray(record.terms)
    ? record.terms.filter((term): term is string => typeof term === 'string' && term.length <= 40).slice(0, 64) : [];
  return { replays: Number.isFinite(record.replays) ? Math.max(0, Math.floor(Number(record.replays))) : 0, terms: [...new Set(terms)] };
}

export function introducedTerms(replays = firstFlightGuideProgress().replays): string[] {
  const saved = readJournaledJson(TERM_INTRODUCTIONS_KEY, sanitizeTermIntroductions);
  return saved && saved.replays === replays ? saved.terms : [];
}

function markTermIntroduced(term: string, replays: number) {
  const terms = introducedTerms(replays);
  if (!terms.includes(term)) writeJournaledJson(TERM_INTRODUCTIONS_KEY, { replays, terms: [...terms, term] });
}

/**
 * One-line first-encounter explanations, in teaching order (basics first).
 * Only terms that first show up mid-run are listed; Cohesion, Wingbeats,
 * Cover, Flow and Roost are taught by the first-flight guide itself.
 */
export const TERM_INTRODUCTIONS: ReadonlyArray<{ term: string; line: string }> = [
  { term: 'Winded', line: 'Winded (weak): attacks deal 25% less while the stacks last.' },
  { term: 'Resonance', line: 'Resonance: a banked combo charge. Bank it now, spend it on payoffs.' },
  { term: 'Open Sky', line: 'Open Sky (vulnerable): the flock takes extra attack damage while exposed.' },
  { term: 'Molt', line: 'Molt: for one turn cards cost 1 less and use their Molt side. Roost leaves Open Sky.' },
  { term: 'Surge', line: 'Surge: full Flow adds +1 damage and +1 Cover until an unblocked hit.' },
  { term: 'Scatter', line: 'Scatter: low Cohesion weakens damage and Cover. Heal or fill Flow to recover.' },
  { term: 'Fouled', line: 'Fouled (poison): costs Cohesion at the start of each turn, then fades by 1.' },
  { term: 'Retain', line: 'Retain: keep cards in hand through Roost to set up a later turn.' },
  { term: 'Regen', line: 'Regen: recover Cohesion at the start of each of your turns.' },
  { term: 'Resonance Burst', line: 'Resonance Burst: spends all banked Resonance for multiplied damage.' },
  { term: 'Winded Burst', line: "Winded Burst: turns an enemy's Winded stacks into damage." },
  { term: 'Open Sky Guard', line: 'Open Sky Guard: each charge cancels the Open Sky bonus on one hit.' },
  { term: 'Keystone', line: 'Keystone: 5+ cards of one suit in your deck unlock a passive aura.' },
];

const FORMATION_TERMS: Record<string, string> = { scattered: 'Scatter', surging: 'Surge', holding: '' };

export type ActiveTermIntroduction = { term: string; text: string; turn: number; shownAt: number };

/** Minimum on-screen time before the next term may replace this one, scaled by text pace. */
export const TERM_INTRO_MIN_MS = 4000;

export function termIntroductionAccent(term: string) {
  const hex = KEYWORDS[term]?.c ?? '#8df4ff';
  return Number.parseInt(hex.slice(1), 16);
}

export function pickTermIntroduction(sources: readonly string[], introduced: ReadonlySet<string>) {
  const present = new Set(sources.flatMap((text) => buildKeywordTokens(text).flatMap((token) => token.kw ? [token.kw] : [])));
  return TERM_INTRODUCTIONS.find((entry) => present.has(entry.term) && !introduced.has(entry.term));
}

/**
 * At most one new-term callout at a time: the current one stays for the rest
 * of the turn (and at least TERM_INTRO_MIN_MS x text pace) before another term
 * may appear. Each term is recorded once per profile, as soon as it is shown.
 */
export function currentTermIntroduction(
  active: ActiveTermIntroduction | undefined,
  context: { turn: number; now: number; textPaceScale: number; sources: () => string[] },
): ActiveTermIntroduction | undefined {
  const progress = firstFlightGuideProgress();
  // Callouts start after the first-flight guide is finished, so the first
  // fight teaches only the core loop; a skipped guide also opts out.
  if (!progress.completed) return undefined;
  // A callout from an earlier battle (higher turn) is stale; otherwise it holds
  // for its own turn and at least the paced minimum.
  if (active && active.turn <= context.turn
    && (context.turn === active.turn || context.now - active.shownAt < TERM_INTRO_MIN_MS * context.textPaceScale)) return active;
  const introduced = new Set(introducedTerms(progress.replays));
  // The dedicated Molt lesson already introduced Molt.
  if (progress.moltLessonSeen > 0) introduced.add('Molt');
  // Formation state arrives as 'scattered' / 'surging'; read it as the term.
  const sources = context.sources().map((text) => FORMATION_TERMS[text] ?? text);
  const next = pickTermIntroduction(sources, introduced);
  if (!next) return undefined;
  markTermIntroduced(next.term, progress.replays);
  return { term: next.term, text: `New term · ${next.line}`, turn: context.turn, shownAt: context.now };
}
