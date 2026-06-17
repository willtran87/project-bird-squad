import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const notes = [];

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const fail = (message) => errors.push(message);

const alphaCards = readJson('data/game/alpha-cards.json');
const alphaEnemies = readJson('data/game/alpha-enemies.json');
const alphaRouteMap = readJson('data/game/alpha-route-map.json');
const alphaStatuses = readJson('data/game/alpha-statuses.json');
const alphaRewardProfiles = readJson('data/game/alpha-reward-profiles.json');
const alphaEncounters = readJson('data/game/alpha-encounters.json');
const alphaSupplies = readJson('data/game/alpha-supplies.json');
const alphaBasins = readJson('data/game/alpha-basins.json');
const alphaNests = readJson('data/game/alpha-nests.json');
const alphaCache = readJson('data/game/alpha-cache.json');
const alphaRouteMarks = readJson('data/game/alpha-route-marks.json');
const alphaMarket = readJson('data/game/alpha-market.json');
const alphaSignals = readJson('data/game/alpha-signals.json');
const alphaMapProfiles = readJson('data/game/alpha-map-profiles.json');
const alphaCardArtManifest = readJson('assets/runtime/cards/card-art-manifest.json');
const alphaEnemyArtManifest = readJson('assets/runtime/enemies/enemy-art-manifest.json');

// District content files for Maps 2-4 (each self-contained: route map + its
// enemies, encounters, signals, profile). Merged into the same id-spaces as the
// Map 1 Alpha data so cross-references resolve across the whole run.
const mapContentFiles = [
  'data/game/map02-content.json',
  'data/game/map03-content.json',
  'data/game/map04-content.json',
];
const mapContents = mapContentFiles.map((file) => ({ ...readJson(file), __file: file }));

const arcanaFiles = [
  'data/cards/arcana/major-arcana-bird-map.json',
  'data/cards/arcana/aviary-arcana.json',
  'data/cards/arcana/minor-arcana-wands.json',
  'data/cards/arcana/minor-arcana-cups.json',
  'data/cards/arcana/minor-arcana-swords.json',
  'data/cards/arcana/minor-arcana-pentacles.json',
];

const arcanaCards = arcanaFiles.flatMap((file) =>
  readJson(file).cards.map((card) => ({ ...card, file })),
);
const knownArcanaIds = new Set(arcanaCards.map((card) => card.id));

const validKinds = new Set(['legend', 'crew', 'molt', 'aviary', 'snag']);
const validSuits = new Set(['plumes', 'quills', 'basins', 'nests']);
const validRarities = new Set(['common', 'uncommon', 'rare', 'legendary']);
const validTargets = new Set(['enemy', 'allEnemies', 'self', 'none', 'choice']);
const validStatKeys = new Set([
  'cohesion',
  'damage',
  'cover',
  'regen',
  'draw',
  'resonance',
  'moltPower',
  'openSkyGuard',
]);
const validNodeTypes = new Set(['street', 'rival', 'boss', 'basin', 'nest', 'market', 'signal', 'cache']);
const validBands = new Set(['weak', 'standard', 'pressure', 'rival', 'boss']);
const validEncounterTags = new Set(['basic', 'cover', 'scavenge', 'heavy', 'winded', 'openSky', 'snag', 'elite', 'boss', 'tempo', 'molt', 'multi', 'support', 'poison']);
const validEnemyRoles = new Set(['striker', 'bruiser', 'saboteur', 'controller', 'support', 'poison', 'boss']);
const validStatusKinds = new Set(['buff', 'debuff']);
const validStatusStacks = new Set(['counter', 'flag']);
const validSupplyCategories = new Set(['snack', 'flare', 'tool', 'call']);
const validSupplyAnswerTypes = new Set(['coverNow', 'drawNow', 'wingbeatNow', 'healNow', 'openSkySafety', 'tellControl']);
const validSupplyTimings = new Set(['combat', 'route', 'either']);
const validSupplyRarities = new Set(['common', 'uncommon', 'rare']);
const validRouteMarkFamilies = new Set(['safety', 'economy', 'route', 'suit', 'molt', 'bossPrep']);
const validRouteMarkSources = new Set(['street', 'rival', 'boss', 'market', 'signal', 'cache', 'nest']);
const validRouteMarkRarities = new Set(['common', 'uncommon', 'rare', 'boss']);
const validTriggerBases = new Set([
  'combatStart', 'afterStreetEncounter', 'firstOpenSkyIncrease', 'basinHeal',
  'signalResolved', 'firstImproveThisRun', 'mapStart', 'passive', 'cacheChoice',
]);
// Signal/Market choice preconditions (next-level-data-contracts §7.2)
const validPredicates = new Set([
  'scrapAtLeast', 'cohesionAtLeast', 'cohesionBelowPct', 'hasRouteMark',
  'hasSupplySlot', 'deckHasTag', 'mapIndexAtLeast', 'not',
]);
// Selector tokens that are valid non-id arguments to reference-taking verbs.
const routeMarkSelectors = new Set(['random', 'randomCommon', 'randomNonBoss', 'choice']);
const supplySelectors = new Set(['random', 'choice']);

const validateTrigger = (trigger, label) => {
  if (typeof trigger !== 'string') { fail(`${label}: trigger must be a string`); return; }
  const [base, gate] = trigger.split(' if ');
  const nth = /^onNthCardThisTurn\((\d+)\)$/.exec(base);
  if (!validTriggerBases.has(base) && !nth) fail(`${label}: unknown trigger "${base}"`);
  if (gate !== undefined && !/^turn >= \d+$/.test(gate)) fail(`${label}: invalid trigger gate "${gate}"`);
};

const validatePredicates = (requirements, label) => {
  for (const req of requirements ?? []) {
    const match = /^([a-zA-Z][a-zA-Z0-9]*)\(([^()]*)\)$/.exec(req);
    if (!match) { fail(`${label}: malformed requirement "${req}"`); continue; }
    if (!validPredicates.has(match[1])) fail(`${label}: unknown requirement predicate "${match[1]}"`);
  }
};

// Cross-check that id-taking outcome verbs reference real route marks / supplies /
// snags (selector tokens like `random` are allowed).
const validateOutcomeRefs = (effects, label, refs) => {
  for (const effect of effects ?? []) {
    const stripped = effect.replace(/^if .+? then /, '');
    const match = /^([a-zA-Z][a-zA-Z0-9]*)\(([^()]*)\)$/.exec(stripped);
    if (!match) continue;
    const verb = match[1];
    const arg = (match[2].split(',')[0] ?? '').trim();
    if (!arg) continue;
    if (verb === 'gainRouteMark' && !routeMarkSelectors.has(arg) && !refs.routeMarks.has(arg)) {
      fail(`${label}: gainRouteMark references unknown route mark "${arg}"`);
    }
    if (verb === 'gainSupply' && !supplySelectors.has(arg) && !refs.supplies.has(arg)) {
      fail(`${label}: gainSupply references unknown supply "${arg}"`);
    }
    if ((verb === 'addSnagToDiscard' || verb === 'addSnagToDraw') && !refs.snags.has(arg)) {
      fail(`${label}: ${verb} references unknown snag "${arg}"`);
    }
  }
};

// Effect-verb allowlist for the route/supply/option data files (combat verbs from
// core-gameplay-spec §Effect Syntax + route verbs and helpers from
// next-level-data-contracts §1.2/§6.3). Catches typo'd or invented verbs.
const validEffectVerbs = new Set([
  // combat verbs
  'damage', 'damagePierce', 'damageAll', 'removeCover', 'gainCover', 'heal', 'draw', 'discard', 'discardUpTo',
  'gainWingbeat', 'loseWingbeat', 'gainResonance', 'spendResonance', 'applyWinded', 'enterMolt',
  'gainOpenSkyGuard', 'returnDiscard', 'nextCoverBonus', 'nextTurnDraw',
  // enemy verbs
  'applyOpenSky', 'addSnagToDiscard', 'addSnagToDraw', 'nextAttackBonus',
  'healAlly', 'healAllEnemies', 'gainCoverAlly', 'gainCoverAllEnemies', 'nextAttackBonusAlly', 'applyPoison',
  // route verbs (only those the runtime resolveRouteEffect actually executes;
  // revealNodes/skipNextStreet/removeRouteChoice were removed — the Alpha
  // pre-reveals the map, so they no-op'd and were re-authored out of the data)
  'gainScrap', 'payScrap', 'loseCohesion', 'healCohesion', 'healMissingPct',
  'gainRouteMark', 'gainSupply', 'gainSupplyChoice', 'gainCacheReward', 'addCard',
  'preenCard', 'releaseCard',
  'reduceNextOpenSky', 'enemyCoverNextCombat', 'bossDamageShield', 'startNextCombatOpenSky',
  // route-mark resolver helpers
  'reducePreenPrice', 'reduceOpenSky', 'addHeal', 'addBonusStat', 'extraCacheChoice',
  'freePreenNextDistrict',
]);

const effectVerbName = (effect) => {
  const stripped = effect.replace(/^if .+? then /, '');
  const match = /^([a-zA-Z][a-zA-Z0-9]*)\(/.exec(stripped);
  return match ? match[1] : null;
};

const validateEffectVerbs = (effects, label) => {
  if (!Array.isArray(effects) || effects.length === 0) {
    fail(`${label}: effects must be a nonempty array`);
    return;
  }
  for (const effect of effects) {
    if (typeof effect !== 'string' || !effectPattern.test(effect)) {
      fail(`${label}: malformed effect "${effect}"`);
      continue;
    }
    const verb = effectVerbName(effect);
    if (verb && !validEffectVerbs.has(verb)) fail(`${label}: unknown effect verb "${verb}"`);
  }
};

const validateNodeOptions = (set, file) => {
  const ids = new Set();
  for (const option of set.options ?? []) {
    const label = `data/game/${file}:${option.id ?? '<missing id>'}`;
    if (!option.id || typeof option.id !== 'string') { fail(`${label}: missing id`); continue; }
    if (ids.has(option.id)) fail(`${label}: duplicate option id`);
    ids.add(option.id);
    if (!option.label || typeof option.label !== 'string') fail(`${label}: missing label`);
    if (option.cost !== undefined && (!Number.isInteger(option.cost) || option.cost < 0)) {
      fail(`${label}: cost must be a nonnegative integer`);
    }
    validateEffectVerbs(option.effects, `${label}:effects`);
  }
  return ids.size;
};
const validRisk = new Set(['low', 'medium', 'high', 'boss']);
const validPreview = new Set(['known', 'typeOnly', 'hidden']);
const validArtStatus = new Set(['approved', 'placeholder', 'needs-review']);
const generatedImagePathPattern = /^\.generated\/imagegen\/(?:tarot|enemies)\/selected\/[a-z0-9_]+\.png$/;

// Effect expression shape: `verb(args)` with an optional `if COND then ` prefix.
// COND is a bare name, an optional `(arg)`, or the `turn >= N` comparison form
// (the only comparison the condition grammar permits — see next-level-data-contracts §1.3).
const effectPattern = /^(?:if [a-zA-Z][a-zA-Z0-9]*(?:\([a-zA-Z0-9_,-]+\))?(?: >= [0-9]+)? then )?[a-zA-Z][a-zA-Z0-9]*\((?:[^()]*)\)$/;

const validateStats = (stats, label) => {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    fail(`${label}: stats must be an object`);
    return 0;
  }

  let total = 0;
  for (const [key, value] of Object.entries(stats)) {
    if (!validStatKeys.has(key)) {
      fail(`${label}: unknown stat "${key}"`);
    }
    if (!Number.isInteger(value) || value < 1) {
      fail(`${label}: stat "${key}" must be a whole number of at least 1`);
    } else {
      total += value;
    }
  }
  return total;
};

// `allowedVerbs` (optional) is the runtime's CLOSED verb set for this content
// type. Passing it closes the silent-no-op gap: a well-formed verb that the
// runtime switch never handles (e.g. a typo, or a verb only the validator knew
// about) fails the build instead of doing nothing in game.
const validateEffects = (effects, label, allowedVerbs) => {
  if (!Array.isArray(effects) || effects.length === 0) {
    fail(`${label}: effects must be a nonempty array`);
    return;
  }

  for (const effect of effects) {
    if (typeof effect !== 'string' || !effectPattern.test(effect)) {
      fail(`${label}: malformed effect "${effect}"`);
      continue;
    }
    if (allowedVerbs) {
      const verb = effectVerbName(effect);
      if (verb && !allowedVerbs.has(verb)) fail(`${label}: verb "${verb}" is not in the runtime interpreter (would no-op)`);
    }
  }
};

// The runtime's CLOSED verb sets, mirrored from src/main.ts so authored content
// that passes validation actually executes. Card verbs = resolveCardEffect's
// switch; enemy verbs = resolveEnemyEffect's switch. Keep these in lockstep with
// the runtime — adding a verb to one without the other reintroduces the gap.
const validCardVerbs = new Set([
  'damage', 'damagePierce', 'damageAll', 'removeCover', 'gainCover', 'heal', 'draw', 'discard', 'discardUpTo',
  'gainWingbeat', 'loseWingbeat', 'gainResonance', 'spendResonance', 'resonanceBurst',
  'applyWinded', 'windedBurst', 'enterMolt', 'gainOpenSkyGuard', 'returnDiscard',
  'nextCoverBonus', 'nextTurnDraw', 'gainEnergyNextTurn', 'shuffleSelfToDraw',
  'overhealCover', 'loseCohesion',
]);
const validEnemyVerbs = new Set([
  'damage', 'gainCover', 'heal', 'applyWinded', 'loseWingbeat', 'applyFrail', 'applyOpenSky',
  'addSnagToDiscard', 'addSnagToDraw', 'nextAttackBonus',
  'healAlly', 'healAllEnemies', 'gainCoverAlly', 'gainCoverAllEnemies', 'nextAttackBonusAlly', 'applyPoison',
]);
// Route-mark effect verbs the runtime actually honors: the combat relics fire
// through resolveMarkEffect (gainCover/gainWingbeat/gainOpenSkyGuard/draw/heal);
// the economy/passive ones are consumed at dedicated sites (reducePreenPrice,
// gainScrap, addHeal, reduceOpenSky, gainSupplyChoice).
const validMarkVerbs = new Set([
  'gainCover', 'gainWingbeat', 'gainOpenSkyGuard', 'draw', 'heal', 'bossDamageShield',
  'reducePreenPrice', 'gainScrap', 'addHeal', 'reduceOpenSky', 'gainSupplyChoice',
  'extraCacheChoice', 'freePreenNextDistrict',
]);

// Condition allowlists for the optional `if COND then` effect prefix
// (next-level-data-contracts §1.3 enemy set + the player condition set; §8.3
// closes the silent-pass gap). A condition that is syntactically valid but not
// in the runtime's closed set would no-op silently — this catches it at build.
const validCardConditions = new Set([
  'firstPlayedThisCombat', 'targetBelowHalf', 'targetIntendsAttack', 'targetHasCover', 'targetWinded',
  'hasResonance', 'spentResonance', 'isMolting', 'openSky', 'fullCohesion',
  'cohesionBelowHalf', 'defeatsEnemy', 'fullyBlocksNextAttack', 'playedSuitThisTurn',
  'flockSuit', // flockSuit(suit,count): deck holds >= count of a suit (composition payoffs)
  'resonanceAtLeast', // resonanceAtLeast(N): banked Resonance >= N (hoard payoffs)
  'windedAtLeast', // windedAtLeast(N): target has >= N Winded (stacking payoffs)
]);
const validEnemyConditions = new Set([
  'notHitThisTurn', 'flockHasNoCover', 'flockHasCover', 'isMolting', 'flockOpenSky',
  'flockCohesionBelowHalf', 'selfBelowHalf',
]);

const conditionOf = (effect) => {
  const match = /^if (.+?) then /.exec(effect);
  return match ? match[1] : null;
};

const validateConditions = (effects, label, allowed, allowTurnGate) => {
  for (const effect of effects ?? []) {
    if (typeof effect !== 'string') continue;
    const cond = conditionOf(effect);
    if (cond === null) continue;
    if (allowTurnGate && /^turn >= [0-9]+$/.test(cond)) continue;
    const base = cond.replace(/\([^()]*\)$/, ''); // strip an optional (arg) like playedSuitThisTurn(plumes)
    if (!allowed.has(base)) fail(`${label}: unknown condition "${cond}"`);
  }
};

const effectBody = (effect) => effect.replace(/^if .+? then /, '');
const effectsNeedEnemyTarget = (effects = []) => effects.some((effect) => {
  const body = effectBody(effect);
  return /\b(?:damage|damagePierce|applyWinded|removeCover)\(target\b/.test(body)
    || /\b(?:resonanceBurst|windedBurst)\(/.test(body)
    || /\bperWinded\b/.test(body)
    || /\btarget(?:BelowHalf|IntendsAttack|HasCover|Winded)\b/.test(effect)
    || /\bwindedAtLeast\(/.test(effect);
});
const effectsHitAllEnemies = (effects = []) => effects.some((effect) => /\bdamageAll\(/.test(effectBody(effect)));
const effectsOnlyAffectFlock = (effects = []) => effects.some((effect) => {
  const body = effectBody(effect);
  return /\b(?:gainCover|heal|overhealCover|loseCohesion|draw|discard|discardUpTo|gainWingbeat|loseWingbeat|gainResonance|spendResonance|enterMolt|gainOpenSkyGuard|returnDiscard|nextCoverBonus|nextTurnDraw|gainEnergyNextTurn|shuffleSelfToDraw)\(/.test(body);
});
const inferMoltTarget = (baseTarget, effects = []) => {
  if (effectsNeedEnemyTarget(effects)) return 'enemy';
  if (effectsHitAllEnemies(effects)) return 'allEnemies';
  if (baseTarget === 'choice') return 'choice';
  if (effectsOnlyAffectFlock(effects)) return baseTarget === 'none' ? 'none' : 'self';
  return baseTarget;
};

const cardsById = new Map();
let moltTargetShiftCount = 0;
for (const card of alphaCards.cards ?? []) {
  const label = `data/game/alpha-cards.json:${card.id ?? '<missing id>'}`;
  if (!card.id || typeof card.id !== 'string') {
    fail(`${label}: missing id`);
    continue;
  }
  if (cardsById.has(card.id)) {
    fail(`${label}: duplicate card id`);
  }
  cardsById.set(card.id, card);

  // Snags are game-only cards with no tarot/arcana origin, so they are exempt
  // from the arcana cross-check (next-level-data-contracts §7.3).
  if (card.kind !== 'snag' && !knownArcanaIds.has(card.id)) {
    fail(`${label}: id does not exist in arcana card data`);
  }
  if (!card.displayName || typeof card.displayName !== 'string') {
    fail(`${label}: missing displayName`);
  }
  if (!card.bird || typeof card.bird !== 'string') {
    fail(`${label}: missing bird`);
  }
  if (!validKinds.has(card.kind)) {
    fail(`${label}: invalid kind "${card.kind}"`);
  }
  if (card.kind === 'crew' && !validSuits.has(card.suit)) {
    fail(`${label}: crew card must have a valid suit`);
  }
  if (card.kind !== 'crew' && card.suit !== null) {
    fail(`${label}: non-crew card suit must be null`);
  }
  if (!validRarities.has(card.rarity)) {
    fail(`${label}: invalid rarity "${card.rarity}"`);
  }
  if (!Number.isInteger(card.cost) || card.cost < 0) {
    fail(`${label}: cost must be a nonnegative integer`);
  }
  if (!validTargets.has(card.target)) {
    fail(`${label}: invalid target "${card.target}"`);
  }
  if (!Array.isArray(card.tags) || card.tags.length === 0) {
    fail(`${label}: tags must be a nonempty array`);
  }

  validateEffects(card.effects, `${label}:effects`, validCardVerbs);
  validateConditions(card.effects, `${label}:effects`, validCardConditions, false);

  // Molt ability (optional during rollout): the alternate effect resolved while
  // Molting. Validated against the same runtime card verb/condition set.
  if (card.moltEffects !== undefined) {
    validateEffects(card.moltEffects, `${label}:moltEffects`, validCardVerbs);
    validateConditions(card.moltEffects, `${label}:moltEffects`, validCardConditions, false);
    if (inferMoltTarget(card.target, card.moltEffects) !== card.target) moltTargetShiftCount += 1;
  }

  if (!card.upgrade || typeof card.upgrade !== 'object') {
    fail(`${label}: missing upgrade object`);
  } else {
    validateEffects(card.upgrade.effects, `${label}:upgrade.effects`, validCardVerbs);
    validateConditions(card.upgrade.effects, `${label}:upgrade.effects`, validCardConditions, false);
    validateStats(card.upgrade.flockStats, `${label}:upgrade.flockStats`);
    // Preened Molt ability — same closed verb/condition set as moltEffects.
    if (card.upgrade.moltEffects !== undefined) {
      validateEffects(card.upgrade.moltEffects, `${label}:upgrade.moltEffects`, validCardVerbs);
      validateConditions(card.upgrade.moltEffects, `${label}:upgrade.moltEffects`, validCardConditions, false);
    }
  }

  const statTotal = validateStats(card.flockStats, `${label}:flockStats`);
  if (card.kind !== 'snag' && statTotal < 1) {
    fail(`${label}: every playable card must grant at least one Flock Stat`);
  }
}

if (moltTargetShiftCount > 0) {
  notes.push(`${moltTargetShiftCount} card(s) derive a different active Molt target from moltEffects than their base target.`);
}

const starterDeck = alphaCards.starterDeck ?? [];
const rewardPool = alphaCards.rewardPool ?? [];
const starterSet = new Set(starterDeck);
const rewardSet = new Set(rewardPool);

// Snags are not part of the starter deck or reward pool (they are injected at
// runtime), so they are excluded from the deck-partition count.
const playableCardCount = (alphaCards.cards ?? []).filter((c) => c.kind !== 'snag').length;

if (starterDeck.length !== 10) {
  fail(`data/game/alpha-cards.json: starterDeck expected 10 cards, found ${starterDeck.length}`);
}
// The reward pool holds every playable (non-snag) card not in the starter deck,
// so all designed cards are obtainable in a run.
const expectedRewardPool = playableCardCount - starterDeck.length;
if (rewardPool.length !== expectedRewardPool) {
  fail(`data/game/alpha-cards.json: rewardPool expected ${expectedRewardPool} cards (all non-snag minus starter), found ${rewardPool.length}`);
}
if (playableCardCount !== starterDeck.length + rewardPool.length) {
  fail('data/game/alpha-cards.json: non-snag cards count must equal starterDeck + rewardPool');
}

for (const id of [...starterDeck, ...rewardPool]) {
  if (!cardsById.has(id)) {
    fail(`data/game/alpha-cards.json: listed card "${id}" is missing from cards`);
  }
}
for (const id of starterSet) {
  if (rewardSet.has(id)) {
    fail(`data/game/alpha-cards.json: card "${id}" appears in both starterDeck and rewardPool`);
  }
}

// Snag ids (kind:'snag' cards) are referenced by enemy moves and signal
// outcomes; build the set before validating those references.
const snagIds = new Set();
for (const [cardId, card] of cardsById) if (card.kind === 'snag') snagIds.add(cardId);

const enemiesByPayload = new Map();
const validateEnemy = (enemy, file) => {
  const label = `${file}:${enemy.id ?? '<missing id>'}`;
  if (!enemy.id || typeof enemy.id !== 'string') {
    fail(`${label}: missing id`);
    return;
  }
    if (enemiesByPayload.has(enemy.id)) {
      fail(`${label}: duplicate enemy id`);
    }
    enemiesByPayload.set(enemy.id, enemy);
    if (!enemy.name || typeof enemy.name !== 'string') {
      fail(`${label}: missing name`);
    }
    if (!Number.isInteger(enemy.health) || enemy.health < 1) {
      fail(`${label}: health must be a positive integer`);
    }
    if (enemy.roles !== undefined) {
      if (!Array.isArray(enemy.roles) || enemy.roles.length === 0) {
        fail(`${label}: roles must be a nonempty array when present`);
      } else {
        for (const role of enemy.roles) if (!validEnemyRoles.has(role)) fail(`${label}: unknown role "${role}"`);
      }
    }
    if (!enemy.description || typeof enemy.description !== 'string') {
      fail(`${label}: missing description`);
    }
    if (!enemy.visualBrief || typeof enemy.visualBrief !== 'string') {
      fail(`${label}: missing visualBrief`);
    }
    if (!enemy.silhouette || typeof enemy.silhouette !== 'string') {
      fail(`${label}: missing silhouette`);
    }
    if (!enemy.artPose || typeof enemy.artPose !== 'string') {
      fail(`${label}: missing artPose`);
    }
    // Moves + attack pattern (next-level-data-contracts §2)
    const moveIds = new Set();
    if (!Array.isArray(enemy.moves) || enemy.moves.length === 0) {
      fail(`${label}: missing moves`);
    } else {
      for (const move of enemy.moves) {
        const moveLabel = `${label}:${move.id ?? '<missing move id>'}`;
        if (!move.id || !move.label) fail(`${moveLabel}: move requires id and label`);
        else if (moveIds.has(move.id)) fail(`${moveLabel}: duplicate move id`);
        else moveIds.add(move.id);
        validateEffects(move.effects, `${moveLabel}:effects`, validEnemyVerbs);
        validateConditions(move.effects, `${moveLabel}:effects`, validEnemyConditions, true);
      }
    }
    const pattern = enemy.attackPattern;
    const checkMoveRef = (id, ctx) => {
      if (!moveIds.has(id)) fail(`${label}: attackPattern ${ctx} references unknown move "${id}"`);
    };
    if (!pattern || typeof pattern !== 'object') {
      fail(`${label}: missing attackPattern`);
    } else if (pattern.type === 'cycle' || pattern.type === 'scripted') {
      if (!Array.isArray(pattern.moveIds) || pattern.moveIds.length === 0) {
        fail(`${label}: ${pattern.type} attackPattern needs a nonempty moveIds`);
      } else {
        pattern.moveIds.forEach((id) => checkMoveRef(id, pattern.type));
        if (pattern.type === 'scripted' && pattern.loopFrom !== undefined &&
          (!Number.isInteger(pattern.loopFrom) || pattern.loopFrom < 0 || pattern.loopFrom >= pattern.moveIds.length)) {
          fail(`${label}: scripted loopFrom out of range`);
        }
      }
    } else if (pattern.type === 'weighted') {
      if (!Array.isArray(pattern.entries) || pattern.entries.length === 0) fail(`${label}: weighted attackPattern needs entries`);
      else for (const entry of pattern.entries) {
        checkMoveRef(entry.moveId, 'weighted');
        if (entry.weight !== undefined && (typeof entry.weight !== 'number' || entry.weight <= 0)) fail(`${label}: weighted entry weight must be > 0`);
        if (entry.repeat !== undefined && !['cannotRepeat', 'oncePerCombat'].includes(entry.repeat)) fail(`${label}: invalid entry repeat "${entry.repeat}"`);
      }
    } else if (pattern.type === 'conditional') {
      if (!Array.isArray(pattern.entries) || pattern.entries.length === 0) fail(`${label}: conditional attackPattern needs entries`);
      else for (const entry of pattern.entries) {
        checkMoveRef(entry.moveId, 'conditional');
        if (!entry.if || typeof entry.if !== 'string') fail(`${label}: conditional entry needs an "if"`);
      }
      if (!pattern.fallback || !moveIds.has(pattern.fallback)) fail(`${label}: conditional attackPattern needs a valid fallback move`);
    } else {
      fail(`${label}: unknown attackPattern type "${pattern?.type}"`);
    }

    // Snag-existence: every addSnagTo{Discard,Draw}(id) reference must resolve to
    // a kind:'snag' card (next-level-data-contracts §8.1). Catches dangling refs.
    for (const move of enemy.moves ?? []) {
      for (const effect of move.effects ?? []) {
        const m = /addSnagTo(?:Discard|Draw)\(([a-zA-Z0-9_-]+)\)/.exec(effect);
        if (m && !snagIds.has(m[1])) {
          fail(`${label}:${move.id}: references unknown snag card "${m[1]}"`);
        }
      }
    }
};

for (const group of ['normalEncounters', 'rivalEncounters', 'bosses']) {
  for (const enemy of alphaEnemies[group] ?? []) validateEnemy(enemy, 'data/game/alpha-enemies.json');
}
for (const content of mapContents) {
  for (const enemy of content.enemies ?? []) validateEnemy(enemy, content.__file);
}

// Status registry (next-level-data-contracts §5.5)
const statusIds = new Set();
for (const status of alphaStatuses.statuses ?? []) {
  const label = `data/game/alpha-statuses.json:${status.id ?? '<missing id>'}`;
  if (!status.id || typeof status.id !== 'string') { fail(`${label}: missing id`); continue; }
  if (statusIds.has(status.id)) fail(`${label}: duplicate status id`);
  statusIds.add(status.id);
  if (!validStatusKinds.has(status.kind)) fail(`${label}: invalid kind "${status.kind}"`);
  if (!validStatusStacks.has(status.stack)) fail(`${label}: invalid stack "${status.stack}"`);
}

// Reward profiles (next-level-data-contracts §3)
const rewardProfileIds = new Set();
const validScrap = (scrap) =>
  scrap === undefined ||
  (Number.isInteger(scrap) && scrap >= 0) ||
  (Array.isArray(scrap) && scrap.length === 2 && scrap.every((n) => Number.isInteger(n) && n >= 0) && scrap[0] <= scrap[1]);
for (const profile of alphaRewardProfiles.profiles ?? []) {
  const label = `data/game/alpha-reward-profiles.json:${profile.id ?? '<missing id>'}`;
  if (!profile.id || typeof profile.id !== 'string') { fail(`${label}: missing id`); continue; }
  if (rewardProfileIds.has(profile.id)) fail(`${label}: duplicate profile id`);
  rewardProfileIds.add(profile.id);
  if (!validScrap(profile.scrap)) fail(`${label}: scrap must be a nonnegative integer or [min,max] range`);
}

// Encounters (next-level-data-contracts §4) — resolve enemies + reward profile.
const encounterIds = new Set();
const validateEncounter = (encounter, file) => {
  const label = `${file}:${encounter.id ?? '<missing id>'}`;
  if (!encounter.id || typeof encounter.id !== 'string') { fail(`${label}: missing id`); return; }
  if (encounterIds.has(encounter.id)) fail(`${label}: duplicate encounter id`);
  encounterIds.add(encounter.id);
  if (!encounter.name || typeof encounter.name !== 'string') fail(`${label}: missing name`);
  if (!validNodeTypes.has(encounter.nodeType)) fail(`${label}: invalid nodeType "${encounter.nodeType}"`);
  if (!validBands.has(encounter.band)) fail(`${label}: invalid band "${encounter.band}"`);
  if (!encounter.lesson || typeof encounter.lesson !== 'string') fail(`${label}: missing lesson`);
  if (!Array.isArray(encounter.tags) || encounter.tags.length === 0) {
    fail(`${label}: tags must be a nonempty array`);
  } else {
    for (const tag of encounter.tags) if (!validEncounterTags.has(tag)) fail(`${label}: unknown tag "${tag}"`);
  }
  if (!Array.isArray(encounter.enemies) || encounter.enemies.length === 0) {
    fail(`${label}: enemies must be a nonempty array`);
  } else {
    if (encounter.enemies.length > 4) fail(`${label}: enemies supports at most 4 combatants`);
    const resolvedEnemies = [];
    for (const enemyId of encounter.enemies) {
      const enemy = enemiesByPayload.get(enemyId);
      if (!enemy) {
        fail(`${label}: enemy "${enemyId}" does not exist in enemy data`);
      } else {
        resolvedEnemies.push(enemy);
      }
    }
    const hasSupport = resolvedEnemies.some((enemy) => enemy.roles?.includes('support'));
    const hasNonSupport = resolvedEnemies.some((enemy) => !enemy.roles?.includes('support'));
    if (hasSupport && !hasNonSupport) {
      fail(`${label}: support enemies must spawn with at least one non-support companion`);
    }
  }
  if (!rewardProfileIds.has(encounter.rewardProfileId)) {
    fail(`${label}: rewardProfileId "${encounter.rewardProfileId}" does not exist`);
  }
};

for (const encounter of alphaEncounters.encounters ?? []) validateEncounter(encounter, 'data/game/alpha-encounters.json');
for (const content of mapContents) {
  for (const encounter of content.encounters ?? []) validateEncounter(encounter, content.__file);
}

// Route Marks (next-level-data-contracts §6)
const routeMarkIds = new Set();
for (const mark of alphaRouteMarks.routeMarks ?? []) {
  const label = `data/game/alpha-route-marks.json:${mark.id ?? '<missing id>'}`;
  if (!mark.id || typeof mark.id !== 'string') { fail(`${label}: missing id`); continue; }
  if (routeMarkIds.has(mark.id)) fail(`${label}: duplicate route mark id`);
  routeMarkIds.add(mark.id);
  if (!mark.name || typeof mark.name !== 'string') fail(`${label}: missing name`);
  if (!mark.description || typeof mark.description !== 'string') fail(`${label}: missing description`);
  if (!validRouteMarkFamilies.has(mark.family)) fail(`${label}: invalid family "${mark.family}"`);
  if (!validRouteMarkSources.has(mark.source)) fail(`${label}: invalid source "${mark.source}"`);
  if (!validRouteMarkRarities.has(mark.rarity)) fail(`${label}: invalid rarity "${mark.rarity}"`);
  validateTrigger(mark.trigger, label);
  validateEffects([mark.effect], `${label}:effect`, validMarkVerbs);
}

// Supplies (next-level-data-contracts §7.1)
const supplyIds = new Set();
for (const supply of alphaSupplies.supplies ?? []) {
  const label = `data/game/alpha-supplies.json:${supply.id ?? '<missing id>'}`;
  if (!supply.id || typeof supply.id !== 'string') { fail(`${label}: missing id`); continue; }
  if (supplyIds.has(supply.id)) fail(`${label}: duplicate supply id`);
  supplyIds.add(supply.id);
  if (!supply.name || typeof supply.name !== 'string') fail(`${label}: missing name`);
  if (!supply.description || typeof supply.description !== 'string') fail(`${label}: missing description`);
  if (!validSupplyCategories.has(supply.category)) fail(`${label}: invalid category "${supply.category}"`);
  if (!validSupplyAnswerTypes.has(supply.answerType)) fail(`${label}: invalid answerType "${supply.answerType}"`);
  if (!validSupplyTimings.has(supply.timing)) fail(`${label}: invalid timing "${supply.timing}"`);
  if (!validSupplyRarities.has(supply.rarity)) fail(`${label}: invalid rarity "${supply.rarity}"`);
  validateEffectVerbs(supply.effects, `${label}:effects`);
}

// Basin / Nest / Cache node options (next-level-data-contracts §7.4)
const basinOptionCount = validateNodeOptions(alphaBasins, 'alpha-basins.json');
const nestOptionCount = validateNodeOptions(alphaNests, 'alpha-nests.json');
const cacheOptionCount = validateNodeOptions(alphaCache, 'alpha-cache.json');

// Market (next-level-data-contracts §9)
const validCardSlotRarities = new Set(['common', 'uncommon', 'rare', 'weighted']);
const validPriceBand = (band) =>
  band && typeof band === 'object' &&
  Number.isInteger(band.base) && band.base >= 0 &&
  Number.isInteger(band.min) && Number.isInteger(band.max) &&
  band.min >= 0 && band.min <= band.base && band.base <= band.max;
const marketIds = new Set();
for (const market of alphaMarket.markets ?? []) {
  const label = `data/game/alpha-market.json:${market.id ?? '<missing id>'}`;
  if (!market.id || typeof market.id !== 'string') { fail(`${label}: missing id`); continue; }
  if (marketIds.has(market.id)) fail(`${label}: duplicate market id`);
  marketIds.add(market.id);
  for (const slot of market.cardSlots ?? []) {
    if (!validCardSlotRarities.has(slot.rarity)) fail(`${label}: invalid card slot rarity "${slot.rarity}"`);
    if (!validPriceBand(slot.price)) fail(`${label}: invalid card slot price band`);
  }
  for (const slot of market.routeMarkSlots ?? []) {
    if (slot.selector !== 'nonBoss') fail(`${label}: route mark slot selector must be "nonBoss"`);
    if (!validPriceBand(slot.price)) fail(`${label}: invalid route mark slot price band`);
  }
  for (const slot of market.supplySlots ?? []) {
    if (slot.selector !== 'pool') fail(`${label}: supply slot selector must be "pool"`);
    if (!validPriceBand(slot.price)) fail(`${label}: invalid supply slot price band`);
  }
  for (const service of market.services ?? []) {
    if (service.id !== 'preen' && service.id !== 'release') fail(`${label}: invalid service id "${service.id}"`);
    if (!Number.isInteger(service.basePrice) || service.basePrice < 0) fail(`${label}: service "${service.id}" basePrice must be a nonnegative integer`);
    if (service.priceIncrease !== undefined && (!Number.isInteger(service.priceIncrease) || service.priceIncrease < 0)) {
      fail(`${label}: service "${service.id}" priceIncrease must be a nonnegative integer`);
    }
    for (const markId of service.discountRouteMarkIds ?? []) {
      if (!routeMarkIds.has(markId)) fail(`${label}: service "${service.id}" discountRouteMarkIds references unknown route mark "${markId}"`);
    }
  }
}

// Signals (next-level-data-contracts §7.2)
const signalRefs = { routeMarks: routeMarkIds, supplies: supplyIds, snags: snagIds };
const signalIds = new Set();
const validateSignal = (signal, file) => {
  const label = `${file}:${signal.id ?? '<missing id>'}`;
  if (!signal.id || typeof signal.id !== 'string') { fail(`${label}: missing id`); return; }
  if (signalIds.has(signal.id)) fail(`${label}: duplicate signal id`);
  signalIds.add(signal.id);
  if (!signal.title || typeof signal.title !== 'string') fail(`${label}: missing title`);
  if (!signal.prompt || typeof signal.prompt !== 'string') fail(`${label}: missing prompt`);
  if (!Array.isArray(signal.choices) || signal.choices.length === 0) { fail(`${label}: choices must be a nonempty array`); return; }
  const choiceKeys = new Set();
  for (const choice of signal.choices) {
    const clabel = `${label}:${choice.key ?? '<missing key>'}`;
    if (!choice.key || typeof choice.key !== 'string') { fail(`${clabel}: missing key`); continue; }
    if (choiceKeys.has(choice.key)) fail(`${clabel}: duplicate choice key`);
    choiceKeys.add(choice.key);
    if (!choice.text || typeof choice.text !== 'string') fail(`${clabel}: missing text`);
    if (!Array.isArray(choice.outcomes)) {
      fail(`${clabel}: outcomes must be an array`);
    } else {
      for (const outcome of choice.outcomes) {
        if (typeof outcome !== 'string' || !effectPattern.test(outcome)) { fail(`${clabel}: malformed outcome "${outcome}"`); continue; }
        const verb = effectVerbName(outcome);
        if (verb && !validEffectVerbs.has(verb)) fail(`${clabel}: unknown outcome verb "${verb}"`);
      }
      validateOutcomeRefs(choice.outcomes, clabel, signalRefs);
    }
    validatePredicates(choice.requirements, `${clabel}:requirements`);
  }
};

for (const signal of alphaSignals.signals ?? []) validateSignal(signal, 'data/game/alpha-signals.json');
for (const content of mapContents) {
  for (const signal of content.signals ?? []) validateSignal(signal, content.__file);
}

// Map design profiles (next-level-implementation-spec Phase 6)
const mapProfileIds = new Set();
const validateMapProfile = (profile, file) => {
  const label = `${file}:${profile.mapId ?? '<missing mapId>'}`;
  if (!profile.mapId || typeof profile.mapId !== 'string') { fail(`${label}: missing mapId`); return; }
  if (mapProfileIds.has(profile.mapId)) fail(`${label}: duplicate mapId`);
  mapProfileIds.add(profile.mapId);
  if (!profile.thesis || typeof profile.thesis !== 'string') fail(`${label}: missing thesis`);
  for (const field of ['primaryTests', 'preferredNodeTypes', 'encounterTags', 'rewardBias', 'bossPrepHints']) {
    if (!Array.isArray(profile[field]) || profile[field].length === 0) fail(`${label}: ${field} must be a nonempty array`);
  }
  for (const nodeType of profile.preferredNodeTypes ?? []) {
    if (!validNodeTypes.has(nodeType)) fail(`${label}: invalid preferredNodeType "${nodeType}"`);
  }
  for (const tag of profile.encounterTags ?? []) {
    if (!validEncounterTags.has(tag)) fail(`${label}: invalid encounterTag "${tag}"`);
  }
};

for (const profile of alphaMapProfiles.profiles ?? []) validateMapProfile(profile, 'data/game/alpha-map-profiles.json');
for (const content of mapContents) {
  validateMapProfile(content.mapProfile, content.__file);
}


// Each district's route map is its own graph: node ids, edges, entry/boss, and
// reachability are validated independently. Payload cross-checks resolve against
// the combined id-spaces (encounters/markets/signals span all maps).
let totalRouteNodes = 0;
let totalRouteEdges = 0;
const validateRouteMap = (routeMap, file) => {
  const nodeIds = new Set();
  const outgoing = new Map();
  const incoming = new Map();

  for (const node of routeMap.nodes ?? []) {
    const label = `${file}:${node.id ?? '<missing id>'}`;
    if (!node.id || typeof node.id !== 'string') {
      fail(`${label}: missing id`);
      continue;
    }
    if (nodeIds.has(node.id)) {
      fail(`${label}: duplicate node id`);
    }
    nodeIds.add(node.id);
    if (!Number.isInteger(node.column) || node.column < 0) {
      fail(`${label}: column must be a nonnegative integer`);
    }
    if (!Number.isInteger(node.lane) || node.lane < 0) {
      fail(`${label}: lane must be a nonnegative integer`);
    }
    if (!validNodeTypes.has(node.type)) {
      fail(`${label}: invalid node type "${node.type}"`);
    }
    if (!validRisk.has(node.risk)) {
      fail(`${label}: invalid risk "${node.risk}"`);
    }
    if (!node.payloadId || typeof node.payloadId !== 'string') {
      fail(`${label}: missing payloadId`);
    }
    // Route nodes resolve through the new data layer, not raw enemy ids
    // (next-level-data-contracts §4/§8.1). Basin/Nest/Cache map to their single
    // option set, so their payloadId is not cross-checked.
    if (['street', 'rival', 'boss'].includes(node.type)) {
      if (!encounterIds.has(node.payloadId)) fail(`${label}: combat payload "${node.payloadId}" is not an encounter id`);
    } else if (node.type === 'market') {
      if (!marketIds.has(node.payloadId)) fail(`${label}: market payload "${node.payloadId}" is not a market id`);
    } else if (node.type === 'signal') {
      if (!signalIds.has(node.payloadId)) fail(`${label}: signal payload "${node.payloadId}" is not a signal id`);
    }
  }

  for (const edge of routeMap.edges ?? []) {
    const label = `${file}:edge ${edge.from ?? '?'} -> ${edge.to ?? '?'}`;
    if (!nodeIds.has(edge.from)) {
      fail(`${label}: missing from node`);
    }
    if (!nodeIds.has(edge.to)) {
      fail(`${label}: missing to node`);
    }
    if (typeof edge.locked !== 'boolean') {
      fail(`${label}: locked must be boolean`);
    }
    if (!validPreview.has(edge.preview)) {
      fail(`${label}: invalid preview "${edge.preview}"`);
    }
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge.from]);
  }

  if (!nodeIds.has(routeMap.entryNodeId)) {
    fail(`${file}: entryNodeId missing from nodes`);
  }
  if (!nodeIds.has(routeMap.bossNodeId)) {
    fail(`${file}: bossNodeId missing from nodes`);
  }

  for (const nodeId of nodeIds) {
    if (nodeId !== routeMap.bossNodeId && !outgoing.has(nodeId)) {
      fail(`${file}:${nodeId}: non-boss node has no outgoing edge`);
    }
    if (nodeId !== routeMap.entryNodeId && !incoming.has(nodeId)) {
      fail(`${file}:${nodeId}: non-entry node has no incoming edge`);
    }
  }

  const canReachBoss = (start) => {
    const seen = new Set();
    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === routeMap.bossNodeId) return true;
      if (!current || seen.has(current)) continue;
      seen.add(current);
      stack.push(...(outgoing.get(current) ?? []));
    }
    return false;
  };

  for (const nodeId of nodeIds) {
    if (!canReachBoss(nodeId)) {
      fail(`${file}:${nodeId}: cannot reach boss`);
    }
  }

  const routeNodeTypes = new Set((routeMap.nodes ?? []).map((node) => node.type));
  for (const required of ['street', 'rival', 'boss', 'basin', 'nest', 'market', 'signal', 'cache']) {
    if (!routeNodeTypes.has(required)) {
      fail(`${file}: missing node type "${required}"`);
    }
  }

  totalRouteNodes += nodeIds.size;
  totalRouteEdges += (routeMap.edges ?? []).length;
};

validateRouteMap(alphaRouteMap, 'data/game/alpha-route-map.json');
for (const content of mapContents) {
  validateRouteMap(content.routeMap, content.__file);
}

const artEntriesByCardId = new Map();
for (const entry of alphaCardArtManifest.cards ?? []) {
  const label = `assets/runtime/cards/card-art-manifest.json:${entry.cardId ?? '<missing cardId>'}`;
  if (!entry.cardId || typeof entry.cardId !== 'string') {
    fail(`${label}: missing cardId`);
    continue;
  }
  if (artEntriesByCardId.has(entry.cardId)) {
    fail(`${label}: duplicate cardId`);
  }
  artEntriesByCardId.set(entry.cardId, entry);
  if (!cardsById.has(entry.cardId)) {
    fail(`${label}: cardId is not in Alpha card data`);
  }
  if (!validArtStatus.has(entry.status)) {
    fail(`${label}: invalid status "${entry.status}"`);
  }
  if (entry.status === 'approved') {
    if (!entry.source || typeof entry.source !== 'string') {
      fail(`${label}: approved art requires a source path`);
    } else if (!generatedImagePathPattern.test(entry.source)) {
      fail(`${label}: source must be an ignored .generated/imagegen selected PNG path`);
    }
  }
  if (entry.status === 'placeholder' && entry.source !== null) {
    fail(`${label}: placeholder source must be null`);
  }
  for (const [field, expectedPattern] of [
    ['portrait', new RegExp(`^assets/runtime/cards/portrait/${entry.cardId}\\.webp$`)],
    ['thumbnail', new RegExp(`^assets/runtime/cards/thumb/${entry.cardId}\\.webp$`)],
  ]) {
    const value = entry[field];
    if (typeof value !== 'string' || !expectedPattern.test(value)) {
      fail(`${label}: ${field} must match ${expectedPattern}`);
    } else if (entry.status === 'approved' && !fs.existsSync(path.join(root, value))) {
      fail(`${label}: approved ${field} does not exist at ${value}`);
    }
  }
  if (entry.icon !== null && (typeof entry.icon !== 'string' || !new RegExp(`^assets/runtime/cards/icon/${entry.cardId}\\.webp$`).test(entry.icon))) {
    fail(`${label}: icon path must match assets/runtime/cards/icon/${entry.cardId}.webp or be null`);
  } else if (entry.status === 'approved' && entry.icon !== null && !fs.existsSync(path.join(root, entry.icon))) {
    fail(`${label}: approved icon does not exist at ${entry.icon}`);
  }
}

for (const [cardId, card] of cardsById) {
  // Snags render with a generic hazard visual and need no per-card art entry.
  if (card.kind !== 'snag' && !artEntriesByCardId.has(cardId)) {
    fail(`assets/runtime/cards/card-art-manifest.json: missing Alpha card ${cardId}`);
  }
}

const enemyArtEntriesByEnemyId = new Map();
for (const entry of alphaEnemyArtManifest.enemies ?? []) {
  const label = `assets/runtime/enemies/enemy-art-manifest.json:${entry.enemyId ?? '<missing enemyId>'}`;
  if (!entry.enemyId || typeof entry.enemyId !== 'string') {
    fail(`${label}: missing enemyId`);
    continue;
  }
  if (enemyArtEntriesByEnemyId.has(entry.enemyId)) {
    fail(`${label}: duplicate enemyId`);
  }
  enemyArtEntriesByEnemyId.set(entry.enemyId, entry);
  if (!enemiesByPayload.has(entry.enemyId)) {
    fail(`${label}: enemyId is not in enemy data`);
  }
  if (!validArtStatus.has(entry.status)) {
    fail(`${label}: invalid status "${entry.status}"`);
  }
  if (entry.status === 'approved') {
    if (!entry.source || typeof entry.source !== 'string') {
      fail(`${label}: approved art requires a source path`);
    } else if (!generatedImagePathPattern.test(entry.source)) {
      fail(`${label}: source must be an ignored .generated/imagegen selected PNG path`);
    }
    const expectedFull = new RegExp(`^assets/runtime/enemies/full/${entry.enemyId}\\.webp$`);
    if (typeof entry.full !== 'string' || !expectedFull.test(entry.full)) {
      fail(`${label}: full must match ${expectedFull}`);
    } else if (!fs.existsSync(path.join(root, entry.full))) {
      fail(`${label}: approved full asset does not exist at ${entry.full}`);
    }
  }
}

for (const enemyId of enemiesByPayload.keys()) {
  if (!enemyArtEntriesByEnemyId.has(enemyId)) {
    fail(`assets/runtime/enemies/enemy-art-manifest.json: missing enemy ${enemyId}`);
  }
}

if (errors.length > 0) {
  console.error(`Runtime data validation failed with ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Runtime data validation passed.');
for (const note of notes) {
  console.log(`Note: ${note}`);
}
console.log(`Checked ${cardsById.size} Alpha cards, ${enemiesByPayload.size} enemies, ${encounterIds.size} encounters, ${rewardProfileIds.size} reward profiles, ${statusIds.size} statuses, ${supplyIds.size} supplies, ${routeMarkIds.size} route marks, ${signalIds.size} signals, ${marketIds.size} markets, ${mapProfileIds.size} map profiles, ${basinOptionCount + nestOptionCount + cacheOptionCount} node options, ${totalRouteNodes} route nodes across ${1 + mapContents.length} maps, ${totalRouteEdges} route edges, ${artEntriesByCardId.size} card art entries, and ${enemyArtEntriesByEnemyId.size} enemy art entries.`);
