import type { AttackPattern } from './types';

// Difficulty / Ascension ladder: opt-in escalating tiers, each adding one
// cumulative modifier. Beating your current top tier unlocks the next.

export interface DifficultyMods {
  tier: number;
  enemyHpMult: number; // scales enemy max Cohesion on spawn
  rewardChoices: number; // card-reward options offered
  enemyDamageBonus: number; // flat add to incoming flock damage
  openSkyBonus: number; // extra damage taken while in unguarded Open Sky
  shiftedOpeners: boolean; // cyclic enemies start from a seeded alternate Tell
  restlessPatterns: boolean; // cyclic enemies reroute their next Tell after Roost
}

export const MAX_DIFFICULTY = 6;

export function difficultyMods(tier: number | undefined): DifficultyMods {
  const t = Math.max(0, Math.min(MAX_DIFFICULTY, Math.floor(tier ?? 0)));
  return {
    tier: t,
    enemyHpMult: t >= 5 ? 1.3 : t >= 1 ? 1.15 : 1,
    rewardChoices: t >= 2 ? 2 : 3,
    enemyDamageBonus: t >= 6 ? 1 : 0,
    openSkyBonus: t >= 4 ? 2 : 1,
    shiftedOpeners: t >= 3,
    restlessPatterns: t >= 6,
  };
}

// Player-facing label + what each tier ADDS over the one below it.
export const difficultyTiers: Array<{ tier: number; name: string; adds: string }> = [
  { tier: 0, name: 'Standard', adds: 'The baseline flyway run.' },
  { tier: 1, name: 'Tier 1 · Tougher Birds', adds: 'Enemies have +15% Cohesion.' },
  { tier: 2, name: 'Tier 2 · Lean Pickings', adds: 'Card rewards offer 2 choices, not 3.' },
  { tier: 3, name: 'Tier 3 · Unfamiliar Tells', adds: 'Cyclic foes start on a seeded alternate Tell.' },
  { tier: 4, name: 'Tier 4 · Open Skies', adds: 'Open Sky punishes for +2 instead of +1.' },
  { tier: 5, name: 'Tier 5 · Iron Flocks', adds: 'Enemies have +30% Cohesion.' },
  { tier: 6, name: 'Tier 6 · Restless Patterns', adds: 'Cyclic Tells reroute each Roost; attacks gain +1.' },
];

export function difficultyLabel(tier: number): string {
  return difficultyTiers.find((entry) => entry.tier === tier)?.name ?? `Tier ${tier}`;
}

export function difficultyAdds(tier: number): string {
  return difficultyTiers.find((entry) => entry.tier === tier)?.adds ?? '';
}

export function difficultyStatSummary(tier: number): string {
  const mods = difficultyMods(tier);
  const tells = mods.restlessPatterns ? 'reroute' : mods.shiftedOpeners ? 'shifted start' : 'fixed';
  return `HP x${mods.enemyHpMult.toFixed(2)} · Rewards ${mods.rewardChoices} · Hit +${mods.enemyDamageBonus} · Sky +${mods.openSkyBonus} · Tells ${tells}`;
}

function ascensionHash(text: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function ascensionOpeningIntentIndex(
  tier: number,
  pattern: AttackPattern,
  seed: string,
  mapIndex: number,
  nodeId: string,
  enemyId: string,
): number {
  if (!difficultyMods(tier).shiftedOpeners || pattern.type !== 'cycle' || pattern.moveIds.length < 2) return 0;
  const roll = ascensionHash(
    `${seed}:ascension-opener:${mapIndex}:${nodeId}:${enemyId}`,
    0x51ed270b,
  );
  return 1 + roll % (pattern.moveIds.length - 1);
}

function ascensionNextIntentIndex(
  tier: number,
  pattern: AttackPattern,
  currentIndex: number,
  seed: string,
  mapIndex: number,
  nodeId: string,
  enemyId: string,
  turn: number,
): number {
  if (!difficultyMods(tier).restlessPatterns || pattern.type !== 'cycle' || pattern.moveIds.length < 3) {
    return currentIndex + 1;
  }
  const roll = ascensionHash(
    `${seed}:ascension-next:${mapIndex}:${nodeId}:${enemyId}:${turn}:${currentIndex}`,
    0x7f4a7c15,
  );
  // Skip the authored next step, forcing mastery-tier players to read the newly
  // shown Tell rather than relying on a memorized cycle.
  return currentIndex + 2 + roll % (pattern.moveIds.length - 2);
}

interface AscensionIntentEnemy {
  id: string;
  intentIndex: number;
  runtime: { attackPattern: AttackPattern };
}

export function applyAscensionOpeningIntents(
  tier: number,
  enemies: AscensionIntentEnemy[],
  seed: string,
  mapIndex: number,
  nodeId: string,
): void {
  if (!difficultyMods(tier).shiftedOpeners) return;
  enemies.forEach((enemy) => {
    enemy.intentIndex = ascensionOpeningIntentIndex(
      tier,
      enemy.runtime.attackPattern,
      seed,
      mapIndex,
      nodeId,
      enemy.id,
    );
  });
}

export function advanceAscensionEnemyIntent(
  tier: number,
  enemy: AscensionIntentEnemy,
  seed: string,
  mapIndex: number,
  nodeId: string,
  turn: number,
): boolean {
  const ordinaryNext = enemy.intentIndex + 1;
  enemy.intentIndex = ascensionNextIntentIndex(
    tier,
    enemy.runtime.attackPattern,
    enemy.intentIndex,
    seed,
    mapIndex,
    nodeId,
    enemy.id,
    turn,
  );
  return enemy.intentIndex !== ordinaryNext;
}
