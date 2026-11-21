/**
 * Pure rules for cards as physical objects: where a played card flies, which
 * numbers on a face are highlighted, and when a press becomes a drag. No
 * Phaser and no scene state, so every decision here is unit-tested.
 */

export type CardRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export const CARD_RARITIES: readonly CardRarity[] = ['common', 'uncommon', 'rare', 'legendary'];
export function cardRarity(value: unknown): CardRarity {
  return CARD_RARITIES.includes(value as CardRarity) ? value as CardRarity : 'common';
}
/** Rare and above carry the animated sheen. */
export function rarityHasSheen(rarity: CardRarity) { return rarity === 'rare' || rarity === 'legendary'; }

export interface Point { x: number; y: number }

/** Control point of a played card's arc. The arc rises above both ends but the
 * card's top edge never climbs past `ceiling` (the HUD's lower edge). */
export function flightControl(from: Point, to: Point, halfHeight: number, ceiling: number, lift = 90): Point {
  const apex = Math.min(from.y, to.y) - lift;
  // A quadratic curve reaches halfway to its control point at most.
  const highest = ceiling + halfHeight;
  const y = Math.max(apex, 2 * highest - Math.min(from.y, to.y));
  return { x: from.x + (to.x - from.x) * 0.42, y: Math.min(y, Math.min(from.y, to.y)) };
}

export function flightPoint(from: Point, control: Point, to: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * from.x + 2 * u * t * control.x + t * t * to.x, y: u * u * from.y + 2 * u * t * control.y + t * t * to.y };
}

/** Flight progress for a share of the play budget: a short lift out of the
 * hand, then an accelerating throw that lands exactly as the budget ends. */
export const FLIGHT_LIFT_SHARE = 0.18;
export function flightProgress(share: number) {
  const t = Math.min(1, Math.max(0, share));
  if (t <= FLIGHT_LIFT_SHARE) return { lift: Math.sin((t / FLIGHT_LIFT_SHARE) * Math.PI / 2), travel: 0 };
  const u = (t - FLIGHT_LIFT_SHARE) / (1 - FLIGHT_LIFT_SHARE);
  return { lift: 1, travel: u * u * (3 - 2 * u) * 0.4 + u * u * 0.6 };
}

/** A press becomes a drag once the pointer has travelled this far (game px). */
export const DRAG_START_DISTANCE = 14;
export function dragStarted(from: Point, to: Point, threshold = DRAG_START_DISTANCE) {
  return Math.hypot(to.x - from.x, to.y - from.y) >= threshold;
}

export interface DropRect { id: string; left: number; right: number; top: number; bottom: number }
export type DropTarget = { kind: 'enemy'; id: string } | { kind: 'field' } | undefined;

/**
 * What releasing a dragged card here would do. A targeted card needs an enemy
 * under the pointer; every other card plays anywhere on the field above the
 * hand. Anything else returns the card.
 */
export function dropTarget(target: string, point: Point, enemies: readonly DropRect[], field: { top: number; bottom: number }): DropTarget {
  if (target === 'enemy') {
    const hit = enemies.find(rect => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom);
    return hit ? { kind: 'enemy', id: hit.id } : undefined;
  }
  return point.y >= field.top && point.y <= field.bottom ? { kind: 'field' } : undefined;
}

export type NumberTone = 'preen' | 'buff' | 'reduced';
export interface NumberTint { start: number; length: number; tone: NumberTone }
interface NumberToken { value: string; start: number; before: string; after: string }

function numberTokens(text: string): NumberToken[] {
  const tokens: NumberToken[] = [];
  for (const match of text.matchAll(/\d+/g)) {
    const start = match.index ?? 0, end = start + match[0].length;
    tokens.push({ value: match[0], start, before: /([A-Za-z+×x]+)\s*$/.exec(text.slice(0, start))?.[1] ?? '',
      after: /^\s*([A-Za-z]+)/.exec(text.slice(end))?.[1] ?? '' });
  }
  return tokens;
}

/**
 * The numbers a Preen changed, as `word number` / `number word` keys taken
 * from the formatted effect lines. A line the upgrade added marks all of its
 * numbers. Matching by neighbouring word survives the face's shorter dialect.
 */
export function preenedNumberKeys(current: readonly string[], base: readonly string[]): string[] {
  const keys: string[] = [];
  current.forEach((line, index) => {
    const now = numberTokens(line), was = numberTokens(base[index] ?? '');
    now.forEach((token, at) => {
      if (was.length === now.length && was[at].value === token.value) return;
      if (token.before) keys.push(`${token.before.toLowerCase()} ${token.value}`);
      if (token.after) keys.push(`${token.value} ${token.after.toLowerCase()}`);
    });
  });
  return [...new Set(keys)];
}

export type StatusModifier = (kind: 'damage' | 'cover', amount: number) => number;

/**
 * Which numbers on a card face to tint. Rules text is never rewritten: a
 * damage or Cover number is green when current status makes it land for more,
 * red for less; otherwise a number the Preen changed is gilt.
 */
export function faceNumberTints(face: string, preenedKeys: readonly string[], modified?: StatusModifier): NumberTint[] {
  const tints: NumberTint[] = [];
  for (const token of numberTokens(face)) {
    const before = token.before.toLowerCase(), after = token.after.toLowerCase();
    const kind = before === 'deal' || after === 'damage' ? 'damage'
      : after === 'cover' && before !== 'strip' && before !== 'remove' && before !== 'has' ? 'cover' : undefined;
    const amount = Number(token.value);
    const now = kind && modified ? modified(kind, amount) : amount;
    const tone: NumberTone | undefined = now > amount ? 'buff' : now < amount ? 'reduced'
      : preenedKeys.includes(`${before} ${token.value}`) || preenedKeys.includes(`${token.value} ${after}`) ? 'preen' : undefined;
    if (tone) tints.push({ start: token.start, length: token.value.length, tone });
  }
  return tints;
}

/** Where each wrapped line starts in the unwrapped text, so a tint can be
 * placed on the line it was wrapped to. */
export function locateTint(source: string, lines: readonly string[], tint: NumberTint) {
  let cursor = 0;
  for (let line = 0; line < lines.length; line++) {
    const text = lines[line].trimEnd();
    if (!text) continue;
    const at = source.indexOf(text, cursor);
    if (at < 0) return undefined;
    if (tint.start >= at && tint.start + tint.length <= at + text.length) return { line, column: tint.start - at };
    cursor = at + text.length;
  }
  return undefined;
}
