import { parseEffect, parseEffectValue } from './effect-parser';

export interface CardEffectResolutionState {
  previousDiscarded: number;
  previousDamageDefeated: boolean;
  spentResonance: boolean;
  returnSelfToDraw: boolean;
  exhaustSelf: boolean;
  builtFlow: boolean;
  flockDamageBonusUsed: boolean;
}

export interface CardEffectFlock {
  hp: number;
  maxHp: number;
  block: number;
  weak: number;
  exposed: boolean;
  exposedTurns: number;
  molt: boolean;
  openSkyGuard: number;
  flow: number;
}

export interface CardEffectCard {
  id: string;
  runtime: {
    suit?: string | null;
  };
}

export interface CardEffectEnemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  weak: number;
  nextAttackBonus: number;
}

export interface CardEffectContext<CardT extends CardEffectCard, EnemyT extends CardEffectEnemy> {
  flock: CardEffectFlock;
  cardName: (card: CardT) => string;
  checkCondition: (condition: string, card: CardT, enemyId: string, state: CardEffectResolutionState) => boolean;
  logEvent: (message: string) => void;
  logFizzle: (card: CardT, effectText: string) => void;

  getTargetWinded: (enemyId: string) => number;
  getLivingEnemy: (enemyId: string) => EnemyT | undefined;
  getEnemy: (enemyId: string) => EnemyT;
  livingEnemies: () => EnemyT[];
  firstLivingEnemy: () => EnemyT | undefined;

  damageEnemy: (enemyId: string, amount: number, source: string, card: CardT, pierceCover?: boolean, flockDamageBonus?: number) => boolean;
  gainBlock: (amount: number, source: string, card: CardT) => void;
  buildFlow: (state: CardEffectResolutionState) => void;
  spendFlockDamageBonus: (state: CardEffectResolutionState, area?: boolean) => number;

  applyOpenSky: (source: string, value: number) => void;
  loseFlockCover: (source: string, value: number) => void;
  damageFlock: (source: string, value: number) => void;
  healFlock: (value: number, source: string, overflowToCover?: boolean) => void;
  loseCohesion: (source: string, value: number) => void;
  drawCards: (value: number) => void;
  discardCards: (value: number) => number;
  gainWingbeat: (source: string, value: number) => void;
  loseWingbeat: (source: string, value: number) => void;
  gainResonance: (value: number) => void;
  spendResonance: (value: number) => boolean;
  getResonance: () => number;
  setResonance: (value: number) => void;
  checkResonanceSpentMarks: () => void;
  resonanceBurstFx: (enemyId: string, spent: number, burst: number) => void;
  windedBurstFx: (enemy: EnemyT, stacks: number, burst: number) => void;
  applyFlockWinded: (source: string, value: number) => void;
  applyEnemyWinded: (enemy: EnemyT, value: number) => void;
  removeEnemyCover: (source: string, enemy: EnemyT, value: number) => void;
  enterMolt: (source: string) => void;
  gainOpenSkyGuard: (value: number) => void;
  returnDiscardToHand: (filter: string, drawAfter: number) => void;
  addNextCoverBonus: (value: number) => void;
  retainHand: (source: string, value: number) => void;
  addNextTurnDraw: (value: number) => void;
  addNextTurnEnergy: (source: string, value: number) => void;
  addEnemyNextAttackBonus: (source: string, enemy: EnemyT, value: number) => void;
  giveEnemyCover: (enemy: EnemyT, value: number, source: string, verb: string) => void;
  shuffleSelfToDraw: (source: string) => void;
}

export function createCardEffectResolutionState(): CardEffectResolutionState {
  return {
    previousDiscarded: 0,
    previousDamageDefeated: false,
    spentResonance: false,
    returnSelfToDraw: false,
    exhaustSelf: false,
    builtFlow: false,
    flockDamageBonusUsed: false
  };
}

export function resolveCardEffect<CardT extends CardEffectCard, EnemyT extends CardEffectEnemy>(
  effectText: string,
  card: CardT,
  enemyId: string,
  state: CardEffectResolutionState,
  context: CardEffectContext<CardT, EnemyT>
) {
  const conditional = effectText.match(/^if ([a-zA-Z][a-zA-Z0-9]*(?:\([a-zA-Z0-9_,-]+\))?) then (.+)$/);
  if (conditional) {
    if (!context.checkCondition(conditional[1], card, enemyId, state)) return;
    resolveCardEffect(conditional[2], card, enemyId, state, context);
    return;
  }

  const parsed = parseEffect(effectText);
  if (!parsed) {
    context.logFizzle(card, effectText);
    return;
  }

  const source = context.cardName(card);
  const value = parseEffectValue(
    parsed.args[1] ?? parsed.args[0],
    state.previousDiscarded,
    context.getTargetWinded(enemyId),
    context.flock.block
  );

  switch (parsed.name) {
    case 'damage':
      state.previousDamageDefeated = context.damageEnemy(enemyId, value, source, card, false, context.spendFlockDamageBonus(state));
      context.buildFlow(state);
      break;
    case 'damagePierce':
      state.previousDamageDefeated = context.damageEnemy(enemyId, value, source, card, true, context.spendFlockDamageBonus(state));
      context.buildFlow(state);
      break;
    case 'damageAll':
      state.previousDamageDefeated = false;
      {
        const bonus = context.spendFlockDamageBonus(state, true);
        context.livingEnemies().forEach((enemy) => {
          if (context.damageEnemy(enemy.id, value, source, card, false, bonus)) state.previousDamageDefeated = true;
        });
      }
      context.buildFlow(state);
      break;
    case 'gainCover':
      context.gainBlock(value, source, card);
      context.buildFlow(state);
      break;
    case 'applyOpenSky':
      context.applyOpenSky(source, value);
      break;
    case 'loseCover':
      context.loseFlockCover(source, value);
      break;
    case 'damageFlock':
      context.damageFlock(source, value);
      break;
    case 'heal':
      context.healFlock(value, source);
      break;
    case 'overhealCover':
      context.healFlock(value, source, true);
      context.buildFlow(state);
      break;
    case 'loseCohesion':
      context.loseCohesion(source, value);
      break;
    case 'draw':
      context.drawCards(value);
      context.logEvent(`${source} draws ${value}.`);
      break;
    case 'discard':
    case 'discardUpTo':
      state.previousDiscarded = context.discardCards(value);
      break;
    case 'gainWingbeat':
      context.gainWingbeat(source, value);
      break;
    case 'loseWingbeat':
      context.loseWingbeat(source, value);
      break;
    case 'gainResonance':
      context.gainResonance(value);
      break;
    case 'spendResonance':
      state.spentResonance = context.spendResonance(value);
      break;
    case 'resonanceBurst': {
      const spent = context.getResonance();
      const burst = spent * value;
      if (burst > 0) {
        state.previousDamageDefeated = context.damageEnemy(enemyId, burst, source, card, false, 0);
        context.logEvent(`${source} releases ${spent} Resonance for ${burst} damage.`);
        context.resonanceBurstFx(enemyId, spent, burst);
      }
      context.setResonance(0);
      state.spentResonance = spent > 0;
      if (spent > 0) context.checkResonanceSpentMarks();
      context.buildFlow(state);
      break;
    }
    case 'windedBurst': {
      const enemy = context.getLivingEnemy(enemyId);
      if (!enemy) break;
      const stacks = enemy.weak;
      const burst = stacks * value;
      if (burst > 0) {
        state.previousDamageDefeated = context.damageEnemy(enemyId, burst, source, card, false, 0);
        context.logEvent(`${source} bursts ${stacks} Winded for ${burst} damage.`);
        context.windedBurstFx(enemy, stacks, burst);
      }
      enemy.weak = 0;
      context.buildFlow(state);
      break;
    }
    case 'applyWinded': {
      if (parsed.args[0] === 'flock') {
        context.applyFlockWinded(source, value);
        break;
      }
      const enemy = context.getLivingEnemy(enemyId);
      if (!enemy) break;
      enemy.weak += value;
      context.logEvent(`${enemy.name} is Winded.`);
      context.applyEnemyWinded(enemy, value);
      break;
    }
    case 'removeCover': {
      const enemy = context.getLivingEnemy(enemyId);
      if (!enemy) break;
      context.removeEnemyCover(source, enemy, value);
      break;
    }
    case 'enterMolt':
      context.enterMolt(source);
      break;
    case 'gainOpenSkyGuard':
      context.gainOpenSkyGuard(value);
      break;
    case 'returnDiscard':
      context.returnDiscardToHand(parsed.args[0], parseEffectValue(parsed.args[1], 0));
      break;
    case 'nextCoverBonus':
      context.addNextCoverBonus(value);
      break;
    case 'retainHand':
      context.retainHand(source, value);
      break;
    case 'nextTurnDraw':
      context.addNextTurnDraw(value);
      break;
    case 'gainEnergyNextTurn':
      context.addNextTurnEnergy(source, value);
      break;
    case 'enemyNextAttackBonus': {
      const enemy = context.firstLivingEnemy();
      if (!enemy) break;
      context.addEnemyNextAttackBonus(source, enemy, value);
      break;
    }
    case 'enemyGainCover': {
      const enemy = context.firstLivingEnemy();
      if (!enemy) break;
      context.giveEnemyCover(enemy, value, source, 'shields');
      break;
    }
    case 'shuffleSelfToDraw':
      state.returnSelfToDraw = true;
      context.shuffleSelfToDraw(source);
      break;
    case 'exhaustSelf':
      state.exhaustSelf = true;
      break;
  }
}
