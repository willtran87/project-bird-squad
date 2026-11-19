import type { AttackPattern, PatternEntry } from './types';

// Pure attack-pattern selection (next-level-data-contracts §2): maps an
// enemy's unbounded intentIndex to the move id its pattern shows at that beat.
// Phaser-free and deterministic in intentIndex, so the telegraphed Tell always
// matches the move that later executes. `evaluate` answers conditional-pattern
// gates against live flock state; omit it (or return false) to use fallbacks.
export function selectPatternMoveId(
  pattern: AttackPattern,
  intentIndex: number,
  evaluate: (condition: string) => boolean = () => false,
): string | undefined {
  const i = Math.max(0, Math.floor(intentIndex));
  switch (pattern.type) {
    case 'cycle':
      return pattern.moveIds.length ? pattern.moveIds[i % pattern.moveIds.length] : undefined;
    case 'scripted': {
      const ids = pattern.moveIds;
      if (!ids.length) return undefined;
      if (i < ids.length) return ids[i];
      const loopFrom = Math.min(ids.length - 1, Math.max(0, pattern.loopFrom ?? 0));
      return ids[loopFrom + ((i - ids.length) % (ids.length - loopFrom))];
    }
    case 'weighted':
      return weightedMoveId(pattern.entries, i);
    case 'conditional': {
      const hit = pattern.entries.find((entry) => evaluate(entry.if));
      if (hit) return hit.moveId;
      const fallback = pattern.fallback;
      if (typeof fallback === 'string') return fallback;
      // Cycling fallback: intentIndex walks the fallback loop while no gate holds.
      return fallback.moveIds.length ? fallback.moveIds[i % fallback.moveIds.length] : undefined;
    }
    default:
      return undefined;
  }
}

// Deterministic weighted walk: entries are expanded by weight and stepped in
// order, skipping any slot whose `repeat` rule forbids it at that beat:
//  - cannotRepeat: never the same move two beats in a row;
//  - oncePerCombat: at most once per combat.
// When every slot is blocked, a non-exhausted move may repeat (cannotRepeat
// relaxes first); if all oncePerCombat moves are spent, the plain slot is used.
// The walk is replayed from beat 0, so it depends on intentIndex alone.
export function weightedMoveId(entries: readonly PatternEntry[], intentIndex: number): string | undefined {
  const slots = entries.flatMap((entry) => Array<PatternEntry>(Math.max(1, Math.floor(entry.weight ?? 1))).fill(entry));
  if (!slots.length) return undefined;
  if (!slots.some((slot) => slot.repeat)) return slots[intentIndex % slots.length].moveId;
  let cursor = 0;
  let last: string | undefined;
  const used = new Set<string>();
  let picked: PatternEntry = slots[0];
  for (let beat = 0; beat <= intentIndex; beat += 1) {
    const at = (k: number) => slots[(cursor + k) % slots.length];
    const exhausted = (slot: PatternEntry) => slot.repeat === 'oncePerCombat' && used.has(slot.moveId);
    const repeats = (slot: PatternEntry) => slot.repeat === 'cannotRepeat' && slot.moveId === last;
    let offset = slots.findIndex((_, k) => !exhausted(at(k)) && !repeats(at(k)));
    if (offset < 0) offset = slots.findIndex((_, k) => !exhausted(at(k)));
    if (offset < 0) offset = 0;
    picked = at(offset);
    cursor = (cursor + offset + 1) % slots.length;
    last = picked.moveId;
    used.add(picked.moveId);
  }
  return picked.moveId;
}
