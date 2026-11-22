/**
 * Pure rules for combat life (status badges, ghost health, counter ticks,
 * combo chain, Leader flourishes, Waymark lines). No Phaser: Vitest covers it.
 */

export type StatusIcon = 'cover' | 'winded' | 'ruffled' | 'openSky' | 'resonance' | 'molt' | 'fouled' | 'guard';
export type IntentIcon = 'attack' | 'defend' | 'buff' | 'debuff' | 'unknown';
export interface StatusBadge { icon: StatusIcon; stacks?: number; label: string }

export const STATUS_COLOR: Record<StatusIcon, number> = {
  cover: 0x7ab8d6, winded: 0xc9d6e0, ruffled: 0xff9d6b, openSky: 0xffcf7a,
  resonance: 0x8df4ff, molt: 0xc56cff, fouled: 0x9fc46a, guard: 0xffe1a3,
};
export const INTENT_COLOR: Record<IntentIcon, number> = {
  attack: 0xff6f5f, defend: 0x7ab8d6, buff: 0xffcf7a, debuff: 0xc98bff, unknown: 0xb8c4cc,
};

interface FlockLike {
  block: number; weak: number; frail: number; exposed?: boolean; molt?: boolean;
  fouled?: number; openSkyGuard?: number;
}

/** The flock's badges, in the order they read: protection, threats, then boons. */
export function flockBadges(flock: FlockLike, resonance = 0): StatusBadge[] {
  const out: StatusBadge[] = [];
  if (flock.block > 0) out.push({ icon: 'cover', stacks: flock.block, label: `${flock.block} Cover` });
  if (flock.weak > 0) out.push({ icon: 'winded', stacks: flock.weak, label: `Winded ${flock.weak}` });
  if (flock.frail > 0) out.push({ icon: 'ruffled', stacks: flock.frail, label: `Ruffled ${flock.frail}` });
  if ((flock.fouled ?? 0) > 0) out.push({ icon: 'fouled', stacks: flock.fouled, label: `Fouled ${flock.fouled}` });
  if (flock.exposed) out.push({ icon: 'openSky', label: 'Open Sky' });
  if ((flock.openSkyGuard ?? 0) > 0) out.push({ icon: 'guard', stacks: flock.openSkyGuard, label: `Open Sky Guard ${flock.openSkyGuard}` });
  if (flock.molt) out.push({ icon: 'molt', label: 'Molt' });
  if (resonance > 0) out.push({ icon: 'resonance', stacks: resonance, label: `Resonance ${resonance}` });
  return out;
}

/** An enemy's badges, in the same order as its status text ("7 Cover / 2 Winded"). */
export function enemyBadges(enemy: { block: number; weak: number }): StatusBadge[] {
  const out: StatusBadge[] = [];
  if (enemy.block > 0) out.push({ icon: 'cover', stacks: enemy.block, label: `${enemy.block} Cover` });
  if (enemy.weak > 0) out.push({ icon: 'winded', stacks: enemy.weak, label: `${enemy.weak} Winded` });
  return out;
}

/** Intent kind (from `enemyIntentLabel`) to its icon. */
export function intentIcon(kind: string | undefined): IntentIcon {
  if (kind === 'attack') return 'attack';
  if (kind === 'cover') return 'defend';
  if (kind === 'charge' || kind === 'support') return 'buff';
  if (kind === 'pressure') return 'debuff';
  return 'unknown';
}

/** Frame-rate independent approach of `current` to `target` with time constant `tau`. */
export function approach(current: number, target: number, dt: number, tau: number) {
  const next = target + (current - target) * Math.exp(-Math.max(0, dt) / Math.max(1, tau));
  return Math.abs(next - target) < 0.0015 ? target : next;
}

/** One bar's drain state, as shares of the maximum (0-1). */
export interface GhostBar { shown: number; ghost: number; holdUntil: number }
export const GHOST_HOLD_MS = 420;

/** Advance a bar toward `target`. A loss drains `shown` quickly and leaves the
 * lighter `ghost` behind for a beat before it catches up. A gain snaps. */
export function stepGhost(bar: GhostBar, target: number, now: number, dt: number): GhostBar {
  if (target >= bar.shown) {
    const ghost = Math.max(target, bar.ghost > target ? approach(bar.ghost, target, now >= bar.holdUntil ? dt : 0, 160) : target);
    return { shown: target, ghost, holdUntil: bar.holdUntil };
  }
  const holdUntil = bar.ghost <= bar.shown + 0.0001 ? now + GHOST_HOLD_MS : bar.holdUntil;
  const ghost = Math.max(bar.ghost, bar.shown);
  return { shown: approach(bar.shown, target, dt, 70), ghost: now >= holdUntil ? approach(ghost, target, dt, 160) : ghost, holdUntil };
}

/** Counter tick: how many audible steps a change takes and how long it runs. */
export function rollPlan(from: number, to: number) {
  const steps = Math.min(8, Math.abs(Math.round(to - from)));
  return { steps, duration: steps ? Math.min(420, 90 + steps * 45) : 0 };
}
/** The value a counter shows `t` (0-1) through its roll. */
export function rollValue(from: number, to: number, t: number) {
  return t >= 1 ? to : Math.round(from + (to - from) * Math.max(0, t));
}

/** Combo chain look: grows with the chain, hue walks gold, cyan, violet. */
export function comboStyle(count: number) {
  const n = Math.max(0, Math.floor(count));
  return {
    visible: n >= 2,
    scale: 1 + Math.min(0.32, (n - 2) * 0.08),
    color: n >= 6 ? 0xd59bff : n >= 4 ? 0x8df4ff : 0xffd27a,
    label: `×${n}`,
  };
}

export type LeaderFlourish = 'spiral' | 'arc' | 'slash' | 'ripple' | 'ward';
const FLOURISH: Record<string, LeaderFlourish> = {
  fledgling: 'spiral', spark_caller: 'arc', talon: 'slash', tidewarden: 'ripple', roostkeeper: 'ward',
};
export function leaderFlourish(leaderId: string | undefined): LeaderFlourish {
  return FLOURISH[leaderId ?? ''] ?? 'spiral';
}
/** The Leader accent colours already used by the Codex. */
export function leaderAccentColor(suit: string | undefined) {
  return ({ Plumes: 0xf2a54a, Quills: 0x9fb7d7, Basins: 0x2fc6c9, Nests: 0xe8c24a } as Record<string, number>)[suit ?? ''] ?? 0x8fd6a0;
}

export type WaymarkTarget = 'enemies' | 'Wingbeats' | 'Scrap' | 'hand' | 'flock';
/** What a fired Waymark's line points at, from its effect name. */
export function waymarkTarget(effects: string[]): WaymarkTarget {
  const names = effects.map(effect => /^\s*(\w+)/.exec(effect)?.[1] ?? '');
  if (names.includes('damageAll')) return 'enemies';
  if (names.some(name => name === 'gainWingbeat' || name === 'gainEnergyNextTurn')) return 'Wingbeats';
  if (names.includes('gainScrap')) return 'Scrap';
  if (names.some(name => name === 'draw' || name === 'nextTurnDraw' || name === 'retainHand')) return 'hand';
  return 'flock';
}
