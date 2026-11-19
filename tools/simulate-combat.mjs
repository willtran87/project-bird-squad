#!/usr/bin/env node
// Seeded combat simulator: a NAIVE left-to-right player fights every authored
// encounter with a leader starter deck grown to the district's expected size.
//
// The bot plays the leftmost affordable card, repeatedly, targets the first
// living enemy, and never plans around Tells. It is the "playtester who just
// clicks cards in order" baseline: if this player takes ~0 Cohesion damage the
// district is free; if it loses often the district is a wall. Card effects use
// the real runtime runner (src/game/effects/card-effect-runner.ts) and enemy
// hits use the real incomingHit()/difficulty modifiers, bundled with esbuild.
//
// Known simplifications (keep in mind when reading results): no Waymarks,
// Supplies, leader signature powers, district conditions or relics; snags are
// added as real cards but held-at-Roost penalties are skipped; every fight
// starts at full Cohesion. Results are relative pressure signals, not exact
// win rates.
//
// Usage: node tools/simulate-combat.mjs [--seeds=40] [--tier=0] [--json]
//        [--leader=fledgling|all] [--rarity=common,uncommon,rare,legendary]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';

const root = process.cwd();
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
const seeds = Math.max(1, Number(args.get('seeds') ?? 40));
const tier = Math.max(0, Number(args.get('tier') ?? 0));
const jsonOutput = args.has('json');
const leaderArg = args.get('leader') ?? 'all';

// --- Bundle the pure runtime modules --------------------------------------
const bundle = buildSync({
  stdin: {
    contents: [
      "export { resolveCardEffect, createCardEffectResolutionState } from './src/game/effects/card-effect-runner';",
      "export { incomingHit } from './src/game/enemy-damage';",
      "export { difficultyMods, applyAscensionOpeningIntents, advanceAscensionEnemyIntent, MAX_DIFFICULTY } from './src/game/difficulty';",
      "export { tacticalFormation } from './src/game/tactical-formations';",
      "export { playCombination } from './src/game/flyway-rules';",
      "export * as balanceModule from './src/game/balance';",
      "export { flockHandTarget } from './src/game/hand-size';",
    ].join('\n'),
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent',
});
const bundlePath = path.join(os.tmpdir(), `bird-squad-sim-${process.pid}.mjs`);
fs.writeFileSync(bundlePath, bundle.outputFiles[0].text);
const rt = await import(pathToFileURL(bundlePath).href);
fs.rmSync(bundlePath, { force: true });

const rarityWeights = args.has('rarity')
  ? Object.fromEntries(args.get('rarity').split(',').map((value, index) => [['common', 'uncommon', 'rare', 'legendary'][index], Number(value)]))
  // Older checkouts kept the weights inline in main.ts (80/75/32/10).
  : rt.balanceModule.REWARD_RARITY_WEIGHTS ?? { common: 80, uncommon: 75, rare: 32, legendary: 10 };

// --- Data ---------------------------------------------------------------------
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const cardsData = readJson('data/game/alpha-cards.json');
const cardById = new Map(cardsData.cards.map((card) => [card.id, card]));
const balance = readJson('data/game/balance-config.json');
const alphaEnemies = readJson('data/game/alpha-enemies.json');
const maps = [
  {
    id: 'map_01_rooftop_blocks',
    enemies: [...alphaEnemies.normalEncounters, ...alphaEnemies.rivalEncounters, ...alphaEnemies.bosses],
    encounters: readJson('data/game/alpha-encounters.json').encounters,
  },
  ...['map02', 'map03', 'map04'].map((file) => {
    const content = readJson(`data/game/${file}-content.json`);
    return { id: content.routeMap.id, enemies: content.enemies, encounters: content.encounters };
  }),
];
const leaderSource = fs.readFileSync(path.join(root, 'src/game/leaders.ts'), 'utf8');
const leaders = [...leaderSource.matchAll(/id: '([^']+)'[\s\S]*?startingDeckIds: \[([^\]]+)\]/g)]
  .map((match) => ({ id: match[1], cards: [...match[2].matchAll(/'([^']+)'/g)].map((m) => m[1]) }))
  .filter((leader) => leaderArg === 'all' || leader.id === leaderArg);

// Deck growth per district: reward picks and Preens the flock has banked by the
// time it fights there (boss fights see the boss-entry deck).
const DECK_GROWTH = [
  { fight: 2, boss: 4, upgrades: 0, bossUpgrades: 1 },
  { fight: 6, boss: 7, upgrades: 2, bossUpgrades: 3 },
  { fight: 9, boss: 10, upgrades: 4, bossUpgrades: 5 },
  { fight: 12, boss: 14, upgrades: 6, bossUpgrades: 7 },
];

// Same index the static balance audit uses (tools/balance-audit.mjs).
function flockPowerIndex(deck) {
  const stats = deckStats(deck);
  const suitCounts = {};
  for (const card of deck) if (card.data.suit) suitCounts[card.data.suit] = (suitCounts[card.data.suit] ?? 0) + 1;
  const keystones = Object.values(suitCounts).filter((count) => count >= 5).length;
  return (stats.damage ?? 0) * 1.3 + (stats.cover ?? 0) + (stats.regen ?? 0) * 1.2 + (stats.draw ?? 0) * 2
    + (stats.resonance ?? 0) * 0.8 + (stats.openSkyGuard ?? 0) + (stats.moltPower ?? 0) * 1.1
    + (stats.cohesion ?? 0) / 6 + keystones * 3 + deck.filter((card) => card.upgraded).length * 1.5;
}

// --- RNG -------------------------------------------------------------------------
const hashString = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const mulberry32 = (seed) => () => {
  let t = seed += 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = (items, rng) => {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

let instanceCounter = 0;
const makeCard = (id, upgraded = false) => {
  const data = cardById.get(id);
  if (!data) throw new Error(`Unknown card ${id}`);
  return { instanceId: `c${instanceCounter += 1}`, id, data, upgraded, runtime: { suit: data.suit } };
};
const cardCost = (card) => (card.upgraded ? card.data.upgrade?.cost ?? card.data.cost : card.data.cost);
const cardEffects = (card) => (card.upgraded ? card.data.upgrade?.effects ?? card.data.effects : card.data.effects);
const cardMoltEffects = (card) => (card.upgraded && card.data.upgrade?.moltEffects?.length
  ? card.data.upgrade.moltEffects : card.data.moltEffects ?? []);

function deckStats(deck) {
  const stats = {};
  for (const card of deck) {
    for (const source of [card.data.flockStats, card.upgraded ? card.data.upgrade?.flockStats : undefined]) {
      for (const [key, value] of Object.entries(source ?? {})) stats[key] = (stats[key] ?? 0) + value;
    }
  }
  return stats;
}

// Mirrors the card-library role rule in main.ts (attack / skill / utility).
const roleOf = (id) => {
  const tags = cardById.get(id)?.tags ?? [];
  return tags.includes('attack') ? 'attack' : tags.some((tag) => ['cover', 'heal'].includes(tag)) ? 'skill' : 'utility';
};
const suitOf = (id) => cardById.get(id)?.suit ?? undefined;
const rarityWeight = (id) => rarityWeights[cardById.get(id)?.rarity ?? 'common'] ?? 50;

// Reward offers use the live structured drafter; the naive player takes the
// leftmost offer, mirroring left-to-right play.
function rewardOffer(ownedIds, rng) {
  const remaining = cardsData.rewardPool.filter((id) => !ownedIds.includes(id));
  return rt.balanceModule.draftStructuredRewardChoices(remaining, ownedIds, 3, rng, rarityWeight, () => false, roleOf, suitOf, () => false);
}

function buildDeck(leader, mapIndex, boss, rng) {
  const growth = DECK_GROWTH[mapIndex];
  const ids = [...leader.cards];
  for (let i = 0; i < (boss ? growth.boss : growth.fight); i += 1) {
    const offer = rewardOffer(ids, rng);
    if (offer.length) ids.push(offer[0]);
  }
  const deck = ids.map((id) => makeCard(id));
  const upgradable = shuffle([...deck], rng).filter((card) => card.data.upgrade?.effects?.length);
  upgradable.slice(0, boss ? growth.bossUpgrades : growth.upgrades).forEach((card) => { card.upgraded = true; });
  return deck;
}

// --- Enemy helpers (mirror main.ts currentMove / evaluateEnemyCondition) -------
function currentMove(enemy, ctx) {
  const { moves, attackPattern } = enemy.runtime;
  const byId = (id) => moves.find((move) => move.id === id) ?? moves[0];
  const i = enemy.intentIndex;
  const phaseIds = enemy.phase === 2 ? enemy.runtime.phaseTwoMoveIds : undefined;
  if (phaseIds?.length) return byId(phaseIds[i % phaseIds.length]);
  switch (attackPattern.type) {
    case 'cycle': return byId(attackPattern.moveIds[i % attackPattern.moveIds.length]);
    case 'scripted': {
      const ids = attackPattern.moveIds;
      if (i < ids.length) return byId(ids[i]);
      const loopFrom = attackPattern.loopFrom ?? 0;
      return byId(ids[loopFrom + ((i - ids.length) % Math.max(1, ids.length - loopFrom))]);
    }
    case 'weighted': {
      const expanded = attackPattern.entries.flatMap((entry) => Array(Math.max(1, entry.weight ?? 1)).fill(entry.moveId));
      return byId(expanded[i % expanded.length]);
    }
    case 'conditional': {
      const hit = attackPattern.entries.find((entry) => ctx && enemyCondition(entry.if, enemy, ctx));
      return byId(hit ? hit.moveId : attackPattern.fallback);
    }
    default: return moves[i % moves.length];
  }
}

function enemyCondition(condition, enemy, ctx) {
  const { flock } = ctx;
  const turnGate = condition.match(/^turn >= (\d+)$/);
  if (turnGate) return ctx.turn >= Number(turnGate[1]);
  const played = condition.match(/^playedCardsAtLeast\((\d+)\)$/);
  if (played) return ctx.c >= Number(played[1]);
  const zero = condition.match(/^zeroCostCardsAtLeast\((\d+)\)$/);
  if (zero) return ctx.z >= Number(zero[1]);
  if (condition === 'handEmptyAtRoost') return ctx.c > 0 && ctx.h === 0;
  if (condition === 'notHitThisTurn') return !enemy.hitThisTurn;
  if (condition === 'flockHasNoCover') return flock.block <= 0;
  if (condition === 'flockHasCover') return flock.block > 0;
  if (condition === 'isMolting') return flock.molt;
  if (condition === 'flockOpenSky') return flock.exposed;
  if (condition === 'flockCohesionBelowHalf') return flock.hp < flock.maxHp / 2;
  if (condition === 'selfBelowHalf') return enemy.hp < enemy.maxHp / 2;
  return false;
}

const moveDealsDamage = (move) => move.effects.some((effect) => /(?:^|then )damage\(flock/.test(effect));

// --- One fight -----------------------------------------------------------------
// Optional what-if tuning: --scale=<json file> of
// {"<mapIndex>": {"normal"|"pack"|"elite"|"packElite"|"boss": {hp, dmg}}}
// rescales authored HP and damage(flock, N) before encounter formations apply,
// exactly like editing the data files would. "pack" enemies are the ones a
// district mostly fields in multi-enemy fights (never solo, or in 2+ groups).
const scaleOverride = args.has('scale') ? JSON.parse(fs.readFileSync(args.get('scale'), 'utf8')) : undefined;
const packEnemyIds = new Map();
for (const [mapIndex, map] of maps.entries()) {
  const usage = new Map();
  for (const encounter of map.encounters) {
    for (const id of encounter.enemies) {
      const entry = usage.get(id) ?? { solo: 0, multi: 0 };
      if (encounter.enemies.length === 1) entry.solo += 1; else entry.multi += 1;
      usage.set(id, entry);
    }
  }
  packEnemyIds.set(mapIndex, new Set([...usage].filter(([, entry]) => entry.solo === 0 || entry.multi >= 2).map(([id]) => id)));
}
const enemyBand = (enemy, mapIndex) => {
  if (enemy.type === 'boss') return 'boss';
  const pack = packEnemyIds.get(mapIndex)?.has(enemy.id);
  if (enemy.type === 'normal') return pack ? 'pack' : 'normal';
  return pack ? 'packElite' : 'elite';
};
function scaledEnemy(enemy, mapIndex) {
  const scale = scaleOverride?.[mapIndex]?.[enemyBand(enemy, mapIndex)];
  if (!scale) return enemy;
  const copy = structuredClone(enemy);
  copy.health = Math.round(copy.health * (scale.hp ?? 1));
  for (const move of copy.moves) {
    move.effects = move.effects.map((effect) => effect.replace(/damage\(flock, (\d+)\)/g,
      (_, value) => `damage(flock, ${Math.max(1, Math.round(Number(value) * (scale.dmg ?? 1)))})`));
  }
  return copy;
}

function simulateFight(encounter, mapIndex, enemyById, deckCards, rng, mods, leaderId) {
  const runtimeEnemies = rt.tacticalFormation(encounter.id, encounter.enemies.map((id) => enemyById.get(id)).filter(Boolean)
    .map((enemy) => scaledEnemy(enemy, mapIndex)));
  // Ascension HP: global multiplier plus the elite/boss tier levers.
  const hpMult = (runtime) => mods.enemyHpMult
    * (runtime.type === 'boss' ? mods.bossHpMult ?? 1 : runtime.type === 'normal' ? 1 : mods.eliteHpMult ?? 1);
  const enemies = runtimeEnemies.map((runtime, index) => ({
    id: `${runtime.id}#${index}`, name: runtime.name, runtime,
    hp: Math.round(runtime.health * hpMult(runtime)), maxHp: Math.round(runtime.health * hpMult(runtime)),
    block: 0, weak: 0, intentIndex: 0, phase: 1, hitThisTurn: false, nextAttackBonus: 0, damageBonus: 0,
  }));
  rt.applyAscensionOpeningIntents(tier, enemies, `sim:${encounter.id}`, mapIndex, encounter.id);

  const stats = deckStats(deckCards);
  const suitCounts = {};
  for (const card of deckCards) if (card.data.suit) suitCounts[card.data.suit] = (suitCounts[card.data.suit] ?? 0) + 1;
  const keystone = (suit) => (suitCounts[suit] ?? 0) >= 5;
  const maxHp = 36 + (stats.cohesion ?? 0);
  const flock = {
    hp: maxHp, maxHp, block: 0, weak: 0, frail: 0, fouled: 0, exposed: false, exposedTurns: 0, molt: false,
    openSkyGuard: stats.openSkyGuard ?? 0, openSkyReduction: 0, flow: 0, flowMax: 5,
  };
  const statBonus = (kind, area = false) => {
    const raw = stats[kind] ?? 0;
    return raw > 0 ? Math.max(1, Math.ceil(raw * (area ? 0.4 : 0.65))) : 0;
  };
  const formation = () => (flock.flow >= flock.flowMax ? 'surging' : flock.hp < flock.maxHp * 0.34 ? 'scattered' : 'holding');

  let drawPile = shuffle([...deckCards], rng);
  let discardPile = [];
  let hand = [];
  let energy = 3;
  let resonance = 0;
  let turn = 0;
  let played = 0;
  let zeroPlayed = 0;
  let nextTurnEnergy = 0;
  let nextTurnDraw = 0;
  let pendingRetain = 0;
  let pendingNestCover = 0;
  let firstAttackThisTurn = true;
  let playedSuits = new Set();
  const playedIdsThisCombat = new Set();
  const combat = { previousSuit: undefined, combos: [] };
  const deckIds = new Set(deckCards.map((card) => card.id));
  let damageTaken = 0;
  const coverAtRoost = [];

  const drawCards = (count) => {
    for (let i = 0; i < count; i += 1) {
      if (!drawPile.length) {
        if (!discardPile.length) return;
        drawPile = shuffle(discardPile, rng);
        discardPile = [];
      }
      hand.push(drawPile.shift());
    }
  };
  const living = () => enemies.filter((enemy) => enemy.hp > 0);
  const target = () => living()[0];
  const healFlock = (value, overflowToCover = false) => {
    const healed = Math.min(Math.max(0, value), flock.maxHp - flock.hp);
    flock.hp += healed;
    if (overflowToCover) flock.block += Math.max(0, value - healed);
  };
  const loseHp = (value) => {
    const lost = Math.min(flock.hp, Math.max(0, value));
    flock.hp -= lost;
    damageTaken += lost;
    if (lost > 0) flock.flow = 0;
  };

  const context = {
    flock,
    cardName: (card) => card.data.displayName,
    checkCondition: (condition, card, enemyId, state) => {
      const enemy = enemies.find((candidate) => candidate.id === enemyId && candidate.hp > 0);
      if (condition === 'firstPlayedThisCombat') return !playedIdsThisCombat.has(card.id);
      if (!enemy && (condition.startsWith('target') || condition.startsWith('windedAtLeast'))) return false;
      if (condition === 'fullyBlocksNextAttack') return flock.block >= incomingNextAttack();
      if (condition === 'noCover') return flock.block <= 0;
      if (condition === 'targetBelowHalf') return enemy.hp <= enemy.maxHp / 2;
      if (condition === 'targetIntendsAttack') return moveDealsDamage(currentMove(enemy, enemyCtx()));
      if (condition === 'targetHasCover') return enemy.block > 0;
      if (condition === 'targetWinded') return enemy.weak > 0;
      const windedAtLeast = condition.match(/^windedAtLeast\((\d+)\)$/);
      if (windedAtLeast) return enemy.weak >= Number(windedAtLeast[1]);
      if (condition === 'hasResonance') return resonance > 0;
      if (condition === 'noResonance') return resonance <= 0 && !state.spentResonance;
      if (condition === 'spentResonance') return state.spentResonance;
      const resAtLeast = condition.match(/^resonanceAtLeast\((\d+)\)$/);
      if (resAtLeast) return resonance >= Number(resAtLeast[1]);
      if (condition === 'isMolting') return flock.molt;
      if (condition === 'openSky') return flock.exposed;
      if (condition === 'fullCohesion') return flock.hp >= flock.maxHp;
      if (condition === 'cohesionBelowHalf') return flock.hp < flock.maxHp / 2;
      if (condition === 'defeatsEnemy') return state.previousDamageDefeated;
      const suit = condition.match(/^playedSuitThisTurn\(([^)]+)\)$/);
      if (suit) return playedSuits.has(suit[1]);
      const flockSuit = condition.match(/^flockSuit\(([a-z]+),\s*(\d+)\)$/);
      if (flockSuit) return (suitCounts[flockSuit[1]] ?? 0) >= Number(flockSuit[2]);
      return false;
    },
    logEvent: () => {},
    logFizzle: () => {},
    getTargetWinded: (enemyId) => enemies.find((enemy) => enemy.id === enemyId)?.weak ?? 0,
    getLivingEnemy: (enemyId) => enemies.find((enemy) => enemy.id === enemyId && enemy.hp > 0),
    getEnemy: (enemyId) => enemies.find((enemy) => enemy.id === enemyId),
    livingEnemies: living,
    firstLivingEnemy: target,
    damageEnemy: (enemyId, amount, _source, _card, pierce = false, bonus = 0) => {
      const enemy = enemies.find((candidate) => candidate.id === enemyId && candidate.hp > 0);
      if (!enemy) return false;
      let raw = amount + bonus;
      if (flock.weak > 0) raw = Math.floor(raw * 0.75);
      const state = formation();
      if (state === 'surging') raw += 1;
      else if (state === 'scattered') raw = Math.floor(raw * 0.75);
      if (firstAttackThisTurn && keystone('quills')) raw += 2;
      firstAttackThisTurn = false;
      const blocked = pierce ? 0 : Math.min(enemy.block, raw);
      if (!pierce) enemy.block -= blocked;
      const hpBefore = enemy.hp;
      enemy.hp = Math.max(0, enemy.hp - (raw - blocked));
      enemy.hitThisTurn = true;
      if (enemy.runtime.type === 'boss' && enemy.phase === 1 && enemy.runtime.phaseTwoMoveIds?.length
        && hpBefore > enemy.maxHp / 2 && enemy.hp > 0 && enemy.hp <= enemy.maxHp / 2) {
        enemy.phase = 2; enemy.intentIndex = 0; enemy.block = 0; enemy.nextAttackBonus = 0;
      }
      return enemy.hp <= 0;
    },
    gainBlock: (amount, _source, card) => {
      const nest = card.data.suit === 'nests' ? pendingNestCover : 0;
      if (nest) pendingNestCover = 0;
      let cover = amount + statBonus('cover') + nest;
      const state = formation();
      if (state === 'surging') cover += 1;
      else if (state === 'scattered') cover = Math.floor(cover * 0.75);
      if (flock.frail > 0) cover = Math.max(0, Math.floor(cover * 0.75));
      flock.block += cover;
    },
    buildFlow: (state) => {
      if (state.builtFlow) return;
      state.builtFlow = true;
      flock.flow = Math.min(flock.flowMax, flock.flow + 1);
    },
    spendFlockDamageBonus: (state, area = false) => {
      if (state.flockDamageBonusUsed) return 0;
      state.flockDamageBonusUsed = true;
      return statBonus('damage', area);
    },
    applyOpenSky: (_source, value) => { flock.exposed = true; flock.exposedTurns = Math.max(flock.exposedTurns, value); },
    loseFlockCover: (_source, value) => { flock.block = Math.max(0, flock.block - value); },
    damageFlock: (_source, value) => loseHp(value),
    healFlock: (value, _source, overflow = false) => healFlock(value, overflow),
    loseCohesion: (_source, value) => {
      const lost = Math.min(value, Math.max(0, flock.hp - 1));
      flock.hp -= lost;
      damageTaken += lost;
    },
    drawCards,
    discardCards: (value) => {
      const discarded = hand.splice(Math.max(0, hand.length - value));
      discardPile.push(...discarded);
      return discarded.length;
    },
    gainWingbeat: (_source, value) => { energy += value; },
    loseWingbeat: (_source, value) => { energy = Math.max(0, energy - value); },
    gainResonance: (value) => { resonance = Math.min(5, resonance + value); },
    spendResonance: (value) => {
      if (resonance < value) return false;
      resonance -= value;
      return true;
    },
    getResonance: () => resonance,
    setResonance: (value) => { resonance = value; },
    checkResonanceSpentMarks: () => {},
    resonanceBurstFx: () => {},
    windedBurstFx: () => {},
    moltBonus: (state, effectValue, area) => {
      const available = Math.max(0, state.moltPower);
      if (available <= 0 || effectValue <= 0) return 0;
      const amount = area ? Math.ceil(available / 2) : available;
      state.moltPower = 0;
      state.moltApplied = amount;
      return amount;
    },
    applyFlockWinded: (_source, value) => { flock.weak += value; },
    applyEnemyWinded: () => {},
    removeEnemyCover: (_source, enemy, value) => { enemy.block = Math.max(0, enemy.block - value); },
    enterMolt: () => { flock.molt = true; flock.exposed = false; flock.exposedTurns = 0; },
    gainOpenSkyGuard: (value) => { flock.openSkyGuard += value; },
    returnDiscardToHand: (_filter, drawAfter) => {
      const returned = discardPile.pop();
      if (returned) hand.push(returned);
      drawCards(drawAfter);
    },
    addNextCoverBonus: (value) => { pendingNestCover += value; },
    retainHand: (_source, value) => { pendingRetain += value; },
    addNextTurnDraw: (value) => { nextTurnDraw += value; },
    addNextTurnEnergy: (_source, value) => { nextTurnEnergy += value; },
    addEnemyNextAttackBonus: (_source, enemy, value) => { enemy.nextAttackBonus += value; },
    giveEnemyCover: (enemy, value) => { enemy.block += value; },
    shuffleSelfToDraw: () => {},
  };

  let roostHeld = 0;
  const enemyCtx = () => ({ flock, turn, c: played, z: zeroPlayed, h: roostHeld });
  const incomingNextAttack = () => {
    const attacker = living().find((enemy) => moveDealsDamage(currentMove(enemy, enemyCtx())));
    if (!attacker) return 0;
    const move = currentMove(attacker, enemyCtx());
    const first = move.effects.map((effect) => /damage\(flock, (\d+)\)/.exec(effect)).find(Boolean);
    return first ? rt.incomingHit(Number(first[1]), attacker, flock, mods, 0).damage : 0;
  };

  const supportTarget = (enemy, selector) => {
    const allies = living().filter((ally) => ally.id !== enemy.id);
    if (!allies.length) return enemy;
    if (selector === 'front' || selector === 'random') return allies[0];
    return [...allies].sort((a, b) => (a.hp / a.maxHp - b.hp / b.maxHp) * (selector === 'highest' ? -1 : 1))[0];
  };

  const resolveEnemyEffect = (enemy, text) => {
    const gate = /^if (.+?) then (.+)$/.exec(text);
    if (gate) {
      if (enemyCondition(gate[1], enemy, enemyCtx())) resolveEnemyEffect(enemy, gate[2]);
      return;
    }
    const match = /^([a-zA-Z]+)\((.*)\)$/.exec(text);
    if (!match) return;
    const parts = match[2].split(',').map((part) => part.trim()).filter(Boolean);
    const value = Number(parts[1] ?? parts[0]) || 0;
    switch (match[1]) {
      case 'damage': {
        const hit = rt.incomingHit(value, enemy, flock, mods, 0);
        enemy.nextAttackBonus = 0;
        if (hit.guardUsed) flock.openSkyGuard -= 1;
        flock.openSkyReduction -= hit.reductionUsed;
        const absorbed = Math.min(flock.block, hit.damage);
        flock.block -= absorbed;
        loseHp(hit.damage - absorbed);
        break;
      }
      case 'nextAttackBonus': enemy.nextAttackBonus += value; break;
      case 'nextAttackBonusAlly': supportTarget(enemy, parts[0]).nextAttackBonus += value; break;
      case 'gainCover': enemy.block += value; break;
      case 'gainCoverAlly': supportTarget(enemy, parts[0]).block += value; break;
      case 'gainCoverAllEnemies': living().forEach((ally) => { ally.block += value; }); break;
      case 'heal': enemy.hp = Math.min(enemy.maxHp, enemy.hp + value); break;
      case 'healAlly': { const ally = supportTarget(enemy, parts[0]); ally.hp = Math.min(ally.maxHp, ally.hp + value); break; }
      case 'healAllEnemies': living().forEach((ally) => { ally.hp = Math.min(ally.maxHp, ally.hp + value); }); break;
      case 'applyOpenSky': flock.exposed = true; flock.exposedTurns = Math.max(flock.exposedTurns, value); break;
      case 'applyWinded': flock.weak += value; break;
      case 'applyFrail': flock.frail += value; break;
      case 'applyPoison': flock.fouled += value; break;
      case 'loseWingbeat': energy = Math.max(0, energy - value); break;
      case 'addSnagToDiscard': case 'addSnagToDraw': {
        const snagId = parts[0];
        if (snagId && cardById.has(snagId) && !deckIds.has(snagId)) {
          deckIds.add(snagId);
          discardPile.push(makeCard(snagId));
        }
        break;
      }
      default: break;
    }
  };

  const playCard = (card) => {
    hand.splice(hand.indexOf(card), 1);
    const cost = cardCost(card);
    energy -= cost;
    played += 1;
    if (cost === 0) zeroPlayed += 1;
    const molting = flock.molt;
    const moltEffects = cardMoltEffects(card);
    const effects = molting && moltEffects.length ? moltEffects : cardEffects(card);
    const state = rt.createCardEffectResolutionState(molting ? 2 + (stats.moltPower ?? 0) : 0);
    const targetId = target()?.id ?? '';
    for (const effect of effects) {
      if (!living().length) break;
      rt.resolveCardEffect(effect, card, targetId, state, context);
    }
    const combo = rt.playCombination(combat, card.data.suit);
    if (combo?.effect === 'damage' && target()) context.damageEnemy(target().id, 2, combo.name, card);
    if (combo?.effect === 'cover') context.gainBlock(3, combo.name, card);
    if (combo?.effect === 'resonance') context.gainResonance(1);
    if (card.data.suit) playedSuits.add(card.data.suit);
    playedIdsThisCombat.add(card.id);
    if (!state.exhaustSelf) (state.returnSelfToDraw ? drawPile : discardPile).push(card);
  };

  const playable = (card) => !card.data.tags?.includes('unplayable') && cardCost(card) <= energy;

  const startTurn = () => {
    turn += 1;
    energy = 3 + nextTurnEnergy;
    nextTurnEnergy = 0;
    flock.block = Math.min(flock.block, keystone('nests') ? 8 : 0);
    combat.previousSuit = undefined;
    combat.combos = [];
    played = 0;
    zeroPlayed = 0;
    firstAttackThisTurn = true;
    playedSuits = new Set();
    if (flock.frail > 0) flock.frail -= 1;
    if (flock.weak > 0) flock.weak -= 1;
    if (flock.fouled > 0) { loseHp(flock.fouled); flock.fouled -= 1; }
    if ((stats.regen ?? 0) > 0) healFlock(stats.regen);
    if (keystone('basins')) healFlock(2);
    for (const enemy of enemies) { enemy.hitThisTurn = false; if (enemy.weak > 0) enemy.weak -= 1; }
    drawCards(Math.max(0, rt.flockHandTarget(stats.draw ?? 0, keystone('plumes'), leaderId, nextTurnDraw) - hand.length));
    nextTurnDraw = 0;
    if ((stats.resonance ?? 0) > 0) resonance = Math.min(5, resonance + stats.resonance);
  };

  const MAX_TURNS = 25;
  startTurn();
  while (turn <= MAX_TURNS) {
    // Naive policy: always the leftmost affordable card.
    for (let card = hand.find(playable); card && living().length && flock.hp > 0; card = hand.find(playable)) playCard(card);
    if (!living().length || flock.hp <= 0) break;
    roostHeld = hand.length;
    const retained = hand.slice(0, pendingRetain);
    discardPile.push(...hand.slice(pendingRetain));
    hand = retained;
    pendingRetain = 0;
    if (flock.molt) { flock.molt = false; flock.exposed = true; flock.exposedTurns = Math.max(flock.exposedTurns, 1); }
    if (played >= 4 && !flock.exposed) { flock.exposed = true; flock.exposedTurns = Math.max(flock.exposedTurns, 1); }
    coverAtRoost.push(flock.block);
    for (const enemy of enemies) enemy.block = 0;
    for (const enemy of living()) {
      if (flock.hp <= 0) break;
      const move = currentMove(enemy, enemyCtx());
      for (const effect of move.effects) {
        if (enemy.hp <= 0 || flock.hp <= 0) break;
        resolveEnemyEffect(enemy, effect);
      }
      rt.advanceAscensionEnemyIntent(tier, enemy, `sim:${encounter.id}`, mapIndex, encounter.id, turn);
    }
    if (flock.exposed && flock.exposedTurns > 0) {
      flock.exposedTurns -= 1;
      if (flock.exposedTurns <= 0) flock.exposed = false;
    }
    if (flock.hp <= 0) break;
    startTurn();
  }
  const avgCover = coverAtRoost.length ? coverAtRoost.reduce((a, b) => a + b, 0) / coverAtRoost.length : 0;
  return { won: !living().length && flock.hp > 0, damageTaken, turns: turn, hpLeft: flock.hp, maxHp, avgCover };
}

// --- Driver -----------------------------------------------------------------------
const mods = rt.difficultyMods(tier);
const bandOf = (encounter) => (encounter.band === 'boss' ? 'boss' : encounter.band === 'rival' ? 'elite' : 'normal');
const results = [];
for (const [mapIndex, map] of maps.entries()) {
  const enemyById = new Map(map.enemies.map((enemy) => [enemy.id, enemy]));
  if (mapIndex > 0) for (const enemy of maps[0].enemies) if (!enemyById.has(enemy.id)) enemyById.set(enemy.id, enemy);
  const profile = balance.maps.find((entry) => entry.mapId === map.id);
  const rows = { normal: [], elite: [], boss: [] };
  const byEncounter = {};
  const fpis = [];
  for (const leader of leaders) {
    for (let seed = 0; seed < seeds; seed += 1) {
      for (const encounter of map.encounters) {
        const rng = mulberry32(hashString(`${leader.id}:${map.id}:${encounter.id}:${seed}`));
        const deck = buildDeck(leader, mapIndex, encounter.band === 'boss', rng);
        if (encounter.band !== 'boss') fpis.push(flockPowerIndex(deck));
        const outcome = simulateFight(encounter, mapIndex, enemyById, deck, rng, mods, leader.id);
        rows[bandOf(encounter)].push(outcome);
        (byEncounter[encounter.id] ??= []).push(outcome);
      }
    }
  }
  if (args.has('by-encounter')) {
    for (const [id, list] of Object.entries(byEncounter)) {
      const avg = (fn) => list.reduce((sum, row) => sum + fn(row), 0) / list.length;
      console.log(`  ${id.padEnd(34)} win ${(avg((row) => (row.won ? 1 : 0)) * 100).toFixed(0).padStart(3)}% | avg loss ${avg((row) => row.damageTaken).toFixed(1).padStart(5)} | 0-dmg ${(avg((row) => (row.damageTaken === 0 ? 1 : 0)) * 100).toFixed(0).padStart(3)}% | turns ${avg((row) => row.turns).toFixed(1)}`);
    }
  }
  const summarize = (list) => {
    const avg = (fn) => list.length ? list.reduce((sum, row) => sum + fn(row), 0) / list.length : 0;
    const losses = list.map((row) => row.damageTaken).sort((a, b) => a - b);
    return {
      fights: list.length,
      winRate: Math.round(avg((row) => (row.won ? 1 : 0)) * 1000) / 10,
      avgLoss: Math.round(avg((row) => row.damageTaken) * 10) / 10,
      medianLoss: losses[Math.floor(losses.length / 2)] ?? 0,
      zeroDamagePct: Math.round(avg((row) => (row.damageTaken === 0 ? 1 : 0)) * 1000) / 10,
      avgTurns: Math.round(avg((row) => row.turns) * 10) / 10,
      avgCoverAtRoost: Math.round(avg((row) => row.avgCover) * 10) / 10,
    };
  };
  results.push({
    mapId: map.id,
    expectedFlockPower: profile?.expectedFlockPower,
    simulatedFlockPower: Math.round((fpis.reduce((a, b) => a + b, 0) / Math.max(1, fpis.length)) * 10) / 10,
    targets: profile?.targets,
    normal: summarize(rows.normal),
    elite: summarize(rows.elite),
    boss: summarize(rows.boss),
  });
}

// Reward rarity: share of 3-card offers that contain at least one non-common.
const rarityRng = mulberry32(hashString('rarity-offers'));
// A run sees ~10 card offers across four districts; the naive taker keeps the
// leftmost card, which is how the deck actually depletes the pool.
let offersWithNonCommon = 0;
let offersWithRarePlus = 0;
let offerCount = 0;
let firstOffersWithNonCommon = 0;
let firstOffers = 0;
for (const leader of leaders.length ? leaders : []) {
  for (let i = 0; i < 400; i += 1) {
    const owned = [...leader.cards];
    for (let pick = 0; pick < 10; pick += 1) {
      const offer = rewardOffer(owned, rarityRng);
      if (!offer.length) break;
      offerCount += 1;
      const nonCommon = offer.some((id) => cardById.get(id).rarity !== 'common');
      if (nonCommon) offersWithNonCommon += 1;
      if (offer.some((id) => ['rare', 'legendary'].includes(cardById.get(id).rarity))) offersWithRarePlus += 1;
      if (pick === 0) { firstOffers += 1; if (nonCommon) firstOffersWithNonCommon += 1; }
      owned.push(offer[Math.floor(rarityRng() * offer.length)]);
    }
  }
}
const pct = (count, total) => Math.round((count / Math.max(1, total)) * 1000) / 10;
const rarity = {
  weights: rarityWeights,
  offers: offerCount,
  nonCommonOfferPct: pct(offersWithNonCommon, offerCount),
  rareOrBetterOfferPct: pct(offersWithRarePlus, offerCount),
  firstOfferNonCommonPct: pct(firstOffersWithNonCommon, firstOffers),
};

if (jsonOutput) {
  console.log(JSON.stringify({ tier, seeds, leaders: leaders.map((leader) => leader.id), results, rarity }, null, 2));
} else {
  console.log(`Bird Squad naive combat sim · tier ${tier} · ${seeds} seeds × ${leaders.length} leader(s)`);
  for (const row of results) {
    console.log(`- ${row.mapId}: expected FPI ${row.expectedFlockPower}, simulated deck FPI ${row.simulatedFlockPower}, target normal Cohesion loss ${row.targets?.normalCohesionLoss?.join('-')}`);
    for (const band of ['normal', 'elite', 'boss']) {
      const s = row[band];
      console.log(`    ${band.padEnd(6)} win ${String(s.winRate).padStart(5)}% | avg loss ${String(s.avgLoss).padStart(5)} | median ${String(s.medianLoss).padStart(3)} | 0-dmg ${String(s.zeroDamagePct).padStart(5)}% | turns ${s.avgTurns} | Cover at Roost ${s.avgCoverAtRoost}`);
    }
  }
  console.log(`Reward offers with a non-common: ${rarity.nonCommonOfferPct}% (first offer ${rarity.firstOfferNonCommonPct}%), with a rare/legendary: ${rarity.rareOrBetterOfferPct}% (weights ${JSON.stringify(rarity.weights)})`);
}
