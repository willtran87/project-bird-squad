import { alphaStatusSet } from '../runtime-data';
import { parseEffect } from '../effects/effect-parser';
import type { Card, Flock } from './runtime-types';
import { ENEMY_FX_Y } from './layout-constants';

const STATUS_TOOLTIPS: Record<string, string> = {
  winded: "Winded reduces the flock's attack output and ticks down each turn.",
  openSky: 'Open Sky increases incoming damage until it ticks down.',
  openSkyGuard: 'Open Sky Guard cancels Open Sky damage increases - one per point.',
  openSkyReduction: 'Softens the next Open Sky damage increase without spending Open Sky Guard.',
  molt: 'Molt: a whole-turn stance. Non-Molt cards cost 1 less, every card uses its alternate ability, and its first positive damage, Cover, or recovery gains Molt Power. Roost leaves you Open Sky.',
  fouled: 'Fouled deals Cohesion damage at the start of your turn, then ticks down by 1.',
  ruffled: 'Ruffled is a lingering debuff on the flock.'
};


export function flockStatuses(flock: Flock) {
  return flockStatusEntries(flock).map((entry) => entry.label);
}


// Status display is driven by the registry (alpha-statuses.json): each active
// status is classified buff/debuff by the registry, and debuffs (threats) sort
// first (next-level-data-contracts Â§5.5 - the registry as source of truth).
function flockStatusEntries(flock: Flock): Array<{ id: string; label: string; kind: 'buff' | 'debuff' }> {
  const kindOf = (id: string): 'buff' | 'debuff' =>
    alphaStatusSet.statuses.find((status) => status.id === id)?.kind ?? 'buff';
  const entries: Array<{ id: string; label: string; kind: 'buff' | 'debuff' }> = [];
  if (flock.weak > 0) entries.push({ id: 'winded', label: `Winded ${flock.weak}`, kind: kindOf('winded') });
  if (flock.fouled > 0) entries.push({ id: 'fouled', label: `Fouled ${flock.fouled}`, kind: kindOf('fouled') });
  if (flock.exposed) entries.push({ id: 'openSky', label: 'Open Sky', kind: kindOf('openSky') });
  if (flock.frail > 0) entries.push({ id: 'ruffled', label: `Ruffled ${flock.frail}`, kind: 'debuff' });
  if (flock.molt) entries.push({ id: 'molt', label: 'Molt', kind: kindOf('molt') });
  if (flock.openSkyGuard > 0) entries.push({ id: 'openSkyGuard', label: `Open Sky Guard ${flock.openSkyGuard}`, kind: kindOf('openSkyGuard') });
  if (flock.openSkyReduction > 0) entries.push({ id: 'openSkyReduction', label: `Open Sky -${flock.openSkyReduction}`, kind: 'buff' });
  return entries.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'debuff' ? -1 : 1));
}


// Board placement for enemy `index` of `count`. A solo opponent uses the open
// central stage; groups retain stable independent columns throughout the fight.
export function enemyViewAt(index: number, count: number): { x: number; y: number; scale: number } {
  if (count <= 1) return { x: 845, y: 225, scale: 1.12 };
  const layouts: Record<number, Array<{ x: number; y: number; scale: number }>> = {
    2: [
      { x: 760, y: ENEMY_FX_Y - 45, scale: 0.98 },
      { x: 1040, y: ENEMY_FX_Y - 45, scale: 0.98 },
    ],
    3: [
      { x: 675, y: 197, scale: 0.8 },
      { x: 910, y: 185, scale: 0.84 },
      { x: 1130, y: 207, scale: 0.8 },
    ],
    4: [
      { x: 540, y: 210, scale: 0.68 },
      { x: 750, y: 210, scale: 0.68 },
      { x: 960, y: 210, scale: 0.68 },
      { x: 1170, y: 210, scale: 0.68 },
    ],
  };
  return layouts[Math.min(4, count)]?.[index] ?? layouts[4][layouts[4].length - 1];
}


export function bossGoonViewAt(index: number, count: number): { x: number; y: number; scale: number } {
  const layouts: Record<number, Array<{ x: number; y: number; scale: number }>> = {
    1: [
      { x: 680, y: 249, scale: 0.66 },
    ],
    2: [
      { x: 650, y: 249, scale: 0.64 },
      { x: 1178, y: 249, scale: 0.64 },
    ],
    3: [
      { x: 498, y: 249, scale: 0.62 },
      { x: 704, y: 249, scale: 0.62 },
      { x: 1178, y: 249, scale: 0.62 },
    ],
  };
  return layouts[Math.min(3, count)]?.[index] ?? layouts[3][layouts[3].length - 1];
}


export function intentCoverValue(intent: { effects: string[] }) {
  for (const effect of intent.effects) {
    const parsed = parseEffect(effect);
    if (parsed && parsed.name === 'gainCover') return Number(parsed.args[0]) || 0;
  }
  return 0;
}


export function suitAccentColor(card: Card) {
  switch (card.runtime.suit) {
    case 'plumes': return 0xff9d4d;
    case 'basins': return 0x7ab8d6;
    case 'quills': return 0xd8e0ea;
    case 'nests': return 0x8fd6a0;
    default: return 0x7ab8d6;
  }
}


export function suitFxMeta(suit: string | null | undefined) {
  switch (suit) {
    case 'plumes': return { color: 0xff9d4d, hex: '#ff9d4d', label: 'PLUMES', glyph: '>>' };
    case 'quills': return { color: 0xd8e0ea, hex: '#d8e0ea', label: 'QUILLS', glyph: '//' };
    case 'basins': return { color: 0x7ab8d6, hex: '#7ab8d6', label: 'BASINS', glyph: '~~' };
    case 'nests': return { color: 0x8fd6a0, hex: '#8fd6a0', label: 'NESTS', glyph: '##' };
    default: return { color: 0xd8a840, hex: '#d8a840', label: 'CREW', glyph: '**' };
  }
}
