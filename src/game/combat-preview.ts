import {
  createCardEffectResolutionState,
  resolveCardEffect,
  type CardEffectCard,
  type CardEffectContext,
  type CardEffectEnemy,
  type CardEffectFlock,
  type CardEffectResolutionState
} from './effects/card-effect-runner';
import { spendMoltPower } from './molt-power';

interface PreviewFlock extends CardEffectFlock {
  frail: number;
  flowMax: number;
}

interface PreviewContract {
  effects: string[];
  target: 'enemy' | 'allEnemies' | 'self' | 'none' | 'choice';
  usesMolt?: boolean;
}

interface PreviewEnemy extends CardEffectEnemy {
  phase?: 1 | 2;
  runtime?: {
    type?: string;
    phaseTwoName?: string;
    phaseTwoMoveIds?: string[];
    moves?: Array<{ id: string; label: string }>;
  };
}

export interface CombatPreviewConfig<CardT extends CardEffectCard, EnemyT extends PreviewEnemy, FlockT extends PreviewFlock> {
  card: CardT;
  enemyId: string;
  contract: PreviewContract;
  flock: FlockT;
  enemies: EnemyT[];
  energy: number;
  cost?: number;
  resonance: number;
  moltPower: number;
  pendingNestCoverBonus: number;
  nextTurnDraw: number;
  nextTurnEnergy: number;
  firstAttack: boolean;
  discardableHandCount: number;
  playedCardIds: ReadonlySet<string>;
  playedSuits: ReadonlySet<string>;
  cardName: (card: CardT) => string;
  incomingNextAttackDamage: (enemies: EnemyT[], flock: FlockT) => number;
  currentMoveDealsDamage: (enemy: EnemyT) => boolean;
  flockSuitCount: (suit: string) => number;
  firstAttackKeystoneActive: () => boolean;
  scaledDamageBonus: (area: boolean) => number;
  scaledCoverBonus: () => number;
  damageOutcome: (
    amount: number,
    flock: FlockT,
    enemyCover: number,
    pierceCover: boolean,
    flockDamageBonus: number,
    firstAttackKeystone: boolean
  ) => { blocked: number; hpDamage: number };
  coverOutcome: (amount: number, flock: FlockT, flockCoverBonus: number, nestBonus: number) => number;
}

export function simulateCombatCardOutcome<
  CardT extends CardEffectCard,
  EnemyT extends PreviewEnemy,
  FlockT extends PreviewFlock
>(config: CombatPreviewConfig<CardT, EnemyT, FlockT>) {
  const flock = { ...config.flock };
  const enemies = config.enemies.map((enemy) => ({ ...enemy })) as EnemyT[];
  const beforeEnemyHp = new Map(enemies.map((enemy) => [enemy.id, enemy.hp]));
  const beforeEnemyBlock = new Map(enemies.map((enemy) => [enemy.id, enemy.block]));
  const before = {
    hp: flock.hp,
    maxHp: flock.maxHp,
    block: flock.block,
    flow: flock.flow,
    flowMax: flock.flowMax,
    energy: config.energy,
    resonance: config.resonance
  };
  let energy = Math.max(0, config.energy - (config.cost ?? 0));
  let resonance = config.resonance;
  let pendingNestCoverBonus = config.pendingNestCoverBonus;
  let nextTurnDraw = config.nextTurnDraw;
  let nextTurnEnergy = config.nextTurnEnergy;
  let firstAttack = config.firstAttack;
  let blockedDamage = 0;
  let bossPhaseBreak: { enemyId: string; name: string; nextIntent?: string } | undefined;
  const state = createCardEffectResolutionState(config.contract.usesMolt ? config.moltPower : 0);
  const livingEnemies = () => enemies.filter((enemy) => enemy.hp > 0);
  const getLivingEnemy = (id: string) => livingEnemies().find((enemy) => enemy.id === id);
  const getEnemy = (id: string) => enemies.find((enemy) => enemy.id === id) ?? enemies[0];
  const conditionMet = (condition: string, card: CardT, targetId: string, previewState: CardEffectResolutionState) => {
    const enemy = getLivingEnemy(targetId);
    if (condition === 'firstPlayedThisCombat') return !config.playedCardIds.has(card.id);
    if (!enemy && (condition.startsWith('target') || condition.startsWith('windedAtLeast'))) return false;
    if (condition === 'fullyBlocksNextAttack') return flock.block >= config.incomingNextAttackDamage(enemies, flock);
    if (condition === 'noCover') return flock.block <= 0;
    if (condition === 'targetBelowHalf') return Boolean(enemy && enemy.hp <= enemy.maxHp / 2);
    if (condition === 'targetIntendsAttack') return Boolean(enemy && config.currentMoveDealsDamage(enemy));
    if (condition === 'targetHasCover') return Boolean(enemy && enemy.block > 0);
    if (condition === 'targetWinded') return Boolean(enemy && enemy.weak > 0);
    const windedAtLeast = condition.match(/^windedAtLeast\((\d+)\)$/);
    if (windedAtLeast) return Boolean(enemy && enemy.weak >= Number(windedAtLeast[1]));
    if (condition === 'hasResonance') return resonance > 0;
    if (condition === 'noResonance') return resonance <= 0 && !previewState.spentResonance;
    if (condition === 'spentResonance') return previewState.spentResonance;
    const resonanceAtLeast = condition.match(/^resonanceAtLeast\((\d+)\)$/);
    if (resonanceAtLeast) return resonance >= Number(resonanceAtLeast[1]);
    if (condition === 'isMolting') return flock.molt;
    if (condition === 'openSky') return flock.exposed;
    if (condition === 'fullCohesion') return flock.hp >= flock.maxHp;
    if (condition === 'cohesionBelowHalf') return flock.hp < flock.maxHp / 2;
    if (condition === 'defeatsEnemy') return previewState.previousDamageDefeated;
    const suitMatch = condition.match(/^playedSuitThisTurn\(([^)]+)\)$/);
    if (suitMatch) return config.playedSuits.has(suitMatch[1]);
    const flockSuit = condition.match(/^flockSuit\(([a-z]+),\s*(\d+)\)$/);
    if (flockSuit) return config.flockSuitCount(flockSuit[1]) >= Number(flockSuit[2]);
    return false;
  };
  const context: CardEffectContext<CardT, EnemyT> = {
    flock,
    cardName: config.cardName,
    checkCondition: conditionMet,
    logEvent: () => {},
    logFizzle: () => {},
    getTargetWinded: (id) => getLivingEnemy(id)?.weak ?? 0,
    getLivingEnemy,
    getEnemy,
    livingEnemies,
    firstLivingEnemy: () => livingEnemies()[0],
    damageEnemy: (id, amount, _source, _card, pierceCover = false, flockDamageBonus = 0) => {
      const enemy = getLivingEnemy(id);
      if (!enemy) return false;
      const hpBefore = enemy.hp;
      const damage = config.damageOutcome(
        amount,
        flock,
        enemy.block,
        pierceCover,
        flockDamageBonus,
        firstAttack && config.firstAttackKeystoneActive()
      );
      firstAttack = false;
      blockedDamage += damage.blocked;
      if (!pierceCover) enemy.block -= damage.blocked;
      enemy.hp = Math.max(0, enemy.hp - damage.hpDamage);
      const phaseIds = enemy.runtime?.phaseTwoMoveIds;
      if (!bossPhaseBreak
        && enemy.runtime?.type === 'boss'
        && enemy.phase !== 2
        && phaseIds?.length
        && hpBefore > enemy.maxHp / 2
        && enemy.hp > 0
        && enemy.hp <= enemy.maxHp / 2) {
        enemy.phase = 2;
        enemy.block = 0;
        enemy.nextAttackBonus = 0;
        bossPhaseBreak = {
          enemyId: enemy.id,
          name: enemy.runtime.phaseTwoName ?? 'Phase II',
          nextIntent: enemy.runtime.moves?.find((move) => move.id === phaseIds[0])?.label
        };
      }
      return enemy.hp <= 0;
    },
    gainBlock: (amount, _source, card) => {
      const nestBonus = card.runtime.suit === 'nests' ? pendingNestCoverBonus : 0;
      flock.block += config.coverOutcome(amount, flock, config.scaledCoverBonus(), nestBonus);
      if (nestBonus > 0) pendingNestCoverBonus = 0;
    },
    buildFlow: (previewState) => {
      if (previewState.builtFlow) return;
      previewState.builtFlow = true;
      if (flock.flow < flock.flowMax) flock.flow += 1;
    },
    spendFlockDamageBonus: (previewState, area = false) => {
      if (previewState.flockDamageBonusUsed) return 0;
      previewState.flockDamageBonusUsed = true;
      return config.scaledDamageBonus(area);
    },
    applyOpenSky: (_source, value) => { flock.exposed = true; flock.exposedTurns = Math.max(flock.exposedTurns, value); },
    loseFlockCover: (_source, value) => { flock.block = Math.max(0, flock.block - value); },
    damageFlock: (_source, value) => { flock.hp = Math.max(0, flock.hp - value); if (value > 0) flock.flow = 0; },
    healFlock: (value, _source, overflowToCover = false) => {
      const healed = Math.min(value, flock.maxHp - flock.hp);
      flock.hp += healed;
      if (overflowToCover) flock.block += value - healed;
    },
    loseCohesion: (_source, value) => { flock.hp = Math.max(1, flock.hp - value); },
    drawCards: () => {},
    discardCards: (value) => Math.min(value, config.discardableHandCount),
    gainWingbeat: (_source, value) => { energy += value; },
    loseWingbeat: (_source, value) => { energy = Math.max(0, energy - value); },
    gainResonance: (value) => { resonance = Math.min(5, resonance + value); },
    spendResonance: (value) => { if (resonance < value) return false; resonance -= value; return true; },
    getResonance: () => resonance,
    setResonance: (value) => { resonance = value; },
    checkResonanceSpentMarks: () => {},
    resonanceBurstFx: () => {},
    windedBurstFx: () => {},
    moltBonus: (previewState, effectValue, area) => spendMoltPower(previewState, effectValue, area),
    applyFlockWinded: (_source, value) => { flock.weak += value; },
    applyEnemyWinded: () => {},
    removeEnemyCover: (_source, enemy, value) => { enemy.block = Math.max(0, enemy.block - value); },
    enterMolt: () => { flock.molt = true; flock.exposed = false; flock.exposedTurns = 0; },
    gainOpenSkyGuard: (value) => { flock.openSkyGuard += value; },
    returnDiscardToHand: () => {},
    addNextCoverBonus: (value) => { pendingNestCoverBonus += value; },
    retainHand: () => {},
    addNextTurnDraw: (value) => { nextTurnDraw += value; },
    addNextTurnEnergy: (_source, value) => { nextTurnEnergy += value; },
    addEnemyNextAttackBonus: (_source, enemy, value) => { enemy.nextAttackBonus += value; },
    giveEnemyCover: (enemy, value) => { enemy.block += value; },
    shuffleSelfToDraw: () => {}
  };
  // A forecast must never choose cards on the player's behalf. Resolve only
  // the known prefix; after an interactive choice, later gates are unknown.
  let requiresChoice = false;
  const steps = config.contract.effects.map(effect => {
    if (requiresChoice) return { effect, status: 'after-choice' as const };
    const conditional = /^if (.+?) then (.+)$/.exec(effect);
    if (conditional && !conditionMet(conditional[1], config.card, config.enemyId, state)) {
      return { effect, status: 'not-met' as const };
    }
    if (/^(discard|discardUpTo|returnDiscard)\(/.test(conditional?.[2] ?? effect)) {
      requiresChoice = true;
      return { effect, status: 'choose' as const };
    }
    resolveCardEffect(effect, config.card, config.enemyId, state, context);
    return { effect, status: 'resolves' as const };
  });
  const enemyDamage = enemies.reduce((total, enemy) => total + Math.max(0, (beforeEnemyHp.get(enemy.id) ?? enemy.hp) - enemy.hp), 0);
  const enemyStates = enemies.map((enemy) => ({
    id: enemy.id,
    name: enemy.name,
    maxHp: enemy.maxHp,
    hpBefore: beforeEnemyHp.get(enemy.id) ?? enemy.hp,
    hpAfter: enemy.hp,
    blockBefore: beforeEnemyBlock.get(enemy.id) ?? enemy.block,
    blockAfter: enemy.block,
    defeated: enemy.hp <= 0
  }));
  return {
    contract: config.contract,
    steps,
    requiresChoice,
    target: getEnemy(config.enemyId),
    enemyStates,
    flockBefore: before,
    flockAfter: {
      hp: flock.hp,
      maxHp: flock.maxHp,
      block: flock.block,
      flow: flock.flow,
      flowMax: flock.flowMax,
      energy,
      resonance
    },
    enemyDamage,
    blockedDamage,
    bossPhaseBreak,
    coverGain: flock.block - before.block,
    cohesionDelta: flock.hp - before.hp,
    flowGain: flock.flow - before.flow,
    energyDelta: energy - before.energy,
    resonanceDelta: resonance - before.resonance,
    nextTurnDrawDelta: nextTurnDraw - config.nextTurnDraw,
    nextTurnEnergyDelta: nextTurnEnergy - config.nextTurnEnergy,
    moltPowerApplied: state.moltApplied
  };
}
