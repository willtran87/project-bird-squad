// Difficulty / Ascension ladder: opt-in escalating tiers, each adding one
// cumulative modifier. Beating your current top tier unlocks the next.

export interface DifficultyMods {
  tier: number;
  enemyHpMult: number; // scales enemy max Cohesion on spawn
  rewardChoices: number; // card-reward options offered
  enemyDamageBonus: number; // flat add to incoming flock damage
  openSkyBonus: number; // extra damage taken while in unguarded Open Sky
}

export const MAX_DIFFICULTY = 6;

export function difficultyMods(tier: number | undefined): DifficultyMods {
  const t = Math.max(0, Math.min(MAX_DIFFICULTY, Math.floor(tier ?? 0)));
  return {
    tier: t,
    enemyHpMult: t >= 5 ? 1.3 : t >= 1 ? 1.15 : 1,
    rewardChoices: t >= 2 ? 2 : 3,
    enemyDamageBonus: t >= 6 ? 2 : t >= 3 ? 1 : 0,
    openSkyBonus: t >= 4 ? 2 : 1,
  };
}

// Player-facing label + what each tier ADDS over the one below it.
export const difficultyTiers: Array<{ tier: number; name: string; adds: string }> = [
  { tier: 0, name: 'Standard', adds: 'The baseline flyway run.' },
  { tier: 1, name: 'Tier 1 · Tougher Birds', adds: 'Enemies have +15% Cohesion.' },
  { tier: 2, name: 'Tier 2 · Lean Pickings', adds: 'Card rewards offer 2 choices, not 3.' },
  { tier: 3, name: 'Tier 3 · Harder Hits', adds: 'Enemy attacks deal +1 damage.' },
  { tier: 4, name: 'Tier 4 · Open Skies', adds: 'Open Sky punishes for +2 instead of +1.' },
  { tier: 5, name: 'Tier 5 · Iron Flocks', adds: 'Enemies have +30% Cohesion.' },
  { tier: 6, name: 'Tier 6 · Cruel Streets', adds: 'Enemy attacks deal +2 damage.' },
];

export function difficultyLabel(tier: number): string {
  return difficultyTiers.find((entry) => entry.tier === tier)?.name ?? `Tier ${tier}`;
}

export function difficultyAdds(tier: number): string {
  return difficultyTiers.find((entry) => entry.tier === tier)?.adds ?? '';
}
