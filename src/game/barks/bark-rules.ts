/**
 * Pure rules for combat barks: which moment just happened, who speaks, which
 * line they say, and where the speech tag may sit. No Phaser here, so every
 * rule is unit tested.
 */

export type BarkTrigger = 'start' | 'bigHit' | 'lowCohesion' | 'defeated' | 'phase';
export type BarkPools = Partial<Record<BarkTrigger, string[]>>;
export interface BarkContent {
  families: Array<{ id: string; match: string }>;
  leaders: Record<string, BarkPools>;
  enemies: Record<string, BarkPools>;
}

export const BIG_HIT_SHARE = 0.2;
export const LOW_COHESION_SHARE = 0.3;
export const BARK_HOLD_MS = 1500;
/** Minimum quiet time between unrelated barks, so they stay notable. */
export const BARK_GAP_MS = 2200;

export function enemyFamily(content: BarkContent, enemyId: string, type?: string) {
  if (type === 'boss') return 'boss';
  for (const family of content.families) if (new RegExp(family.match).test(enemyId)) return family.id;
  return 'crew';
}

function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) { value ^= text.charCodeAt(index); value = Math.imul(value, 16777619); }
  return value >>> 0;
}

/** Seeded shuffle order for a pool: each line once before any repeats. */
export function shuffled(count: number, seed: string) {
  const order = Array.from({ length: count }, (_, index) => index);
  let state = hash(seed) || 1;
  for (let index = count - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0;
    const pick = state % (index + 1);
    [order[index], order[pick]] = [order[pick], order[index]];
  }
  return order;
}

/** Draws lines from seeded decks, one deck per speaker and trigger. */
export class BarkDeck {
  private drawn = new Map<string, number>();
  constructor(private content: BarkContent, private seed: string) {}

  line(kind: 'leader' | 'enemy', speaker: string, trigger: BarkTrigger) {
    const pools = kind === 'leader' ? this.content.leaders[speaker] ?? this.content.leaders.fledgling : this.content.enemies[speaker] ?? this.content.enemies.crew;
    const lines = pools?.[trigger];
    if (!lines?.length) return undefined;
    const key = `${kind}:${speaker}:${trigger}`;
    const count = this.drawn.get(key) ?? 0;
    this.drawn.set(key, count + 1);
    const pass = Math.floor(count / lines.length), at = count % lines.length;
    const order = this.order(key, lines.length, pass);
    return lines[order[at]];
  }

  /** Reshuffled each pass; a pass never opens with the line the last one ended on. */
  private order(key: string, count: number, pass: number): number[] {
    const order = shuffled(count, `${this.seed}|${key}|${pass}`);
    if (pass === 0 || count < 2) return order;
    const previous = this.order(key, count, pass - 1);
    return order[0] === previous[count - 1] ? [...order.slice(1), order[0]] : order;
  }

  /** A seeded coin, so who answers a moment is stable for a given flight. */
  coin(key: string) {
    return (hash(`${this.seed}|coin|${key}`) & 1) === 0;
  }
}

export interface CombatSnapshot {
  mode: string;
  ready: boolean;
  flock: { hp: number; maxHp: number };
  enemies: Array<{ id: string; hp: number; maxHp: number; phase: number; type?: string }>;
}

export type BarkMoment =
  | { trigger: 'start' }
  | { trigger: 'bigHit'; target: 'flock' } | { trigger: 'bigHit'; target: 'enemy'; enemyId: string }
  | { trigger: 'lowCohesion' }
  | { trigger: 'defeated'; enemyId: string }
  | { trigger: 'phase'; enemyId: string };

/**
 * Moments between two snapshots of the same fight. The opening is announced
 * once, when the intro has cleared (`started` is the caller's memory of it);
 * hits, defeats and phase turns are read on every frame after that, including
 * while the enemy turn is animating.
 */
export function barkMoments(before: CombatSnapshot | undefined, after: CombatSnapshot, started: boolean): BarkMoment[] {
  const moments: BarkMoment[] = [];
  if (after.mode !== 'battle') return moments;
  if (!started) return after.ready ? [{ trigger: 'start' }] : moments;
  if (!before || before.mode !== 'battle') return moments;
  const flockLoss = before.flock.hp - after.flock.hp;
  if (flockLoss >= after.flock.maxHp * BIG_HIT_SHARE && after.flock.hp > 0) moments.push({ trigger: 'bigHit', target: 'flock' });
  const low = after.flock.maxHp * LOW_COHESION_SHARE;
  if (before.flock.hp > low && after.flock.hp <= low && after.flock.hp > 0) moments.push({ trigger: 'lowCohesion' });
  for (const enemy of after.enemies) {
    const previous = before.enemies.find(candidate => candidate.id === enemy.id);
    if (!previous) continue;
    if (previous.hp > 0 && enemy.hp <= 0) moments.push({ trigger: 'defeated', enemyId: enemy.id });
    else if (previous.phase === 1 && enemy.phase === 2 && enemy.hp > 0) moments.push({ trigger: 'phase', enemyId: enemy.id });
    else if (enemy.hp > 0 && previous.hp - enemy.hp >= enemy.maxHp * BIG_HIT_SHARE) moments.push({ trigger: 'bigHit', target: 'enemy', enemyId: enemy.id });
  }
  return moments;
}

export interface Rect { x: number; y: number; width: number; height: number }
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * The first spot near `anchor` where a `width`x`height` tag fits inside
 * `area` without touching any obstacle (with `pad` clearance). Tries above,
 * then beside, then below the speaker. Undefined when nowhere is clear: the
 * bark is dropped rather than drawn over a panel or the HUD.
 */
export function placeTag(anchor: { x: number; y: number; reach: number }, width: number, height: number,
  obstacles: Rect[], area: Rect, pad = 6): Rect | undefined {
  const { x, y, reach } = anchor;
  const candidates = [
    [x - width / 2, y - reach - height], [x - width / 2, y - reach - height - 36],
    [x + reach * 0.6, y - reach * 0.6 - height], [x - reach * 0.6 - width, y - reach * 0.6 - height],
    [x + reach, y - height / 2], [x - reach - width, y - height / 2],
    [x - width / 2, y + reach * 0.4],
  ];
  for (const [left, top] of candidates) {
    const rect = { x: Math.round(left), y: Math.round(top), width, height };
    if (rect.x < area.x || rect.y < area.y || rect.x + width > area.x + area.width || rect.y + height > area.y + area.height) continue;
    const padded = { x: rect.x - pad, y: rect.y - pad, width: width + pad * 2, height: height + pad * 2 };
    if (obstacles.every(obstacle => !overlaps(padded, obstacle))) return rect;
  }
  return undefined;
}
