import { parseEffect, parseEffectValue } from './effects/effect-parser';

interface IncomingFlock {
  hp: number; maxHp: number; block: number; exposed: boolean;
  openSkyGuard: number; openSkyReduction: number;
  weak: number; frail: number; fouled: number;
  flow?: number; flowMax?: number;
}
interface IncomingEnemy {
  id: string; hp: number; maxHp: number; block: number;
  weak: number; nextAttackBonus: number; damageBonus: number;
  phase?: 1 | 2; intentIndex?: number;
  runtime?: { type?: string; phaseTwoMoveIds?: string[] };
}

export function cleanseFlockDebuffs(flock: Pick<IncomingFlock, 'weak' | 'frail' | 'fouled'>, amount: number) {
  let cleared = 0;
  for (const status of ['weak', 'frail', 'fouled'] as const) {
    const before = flock[status];
    flock[status] = Math.max(0, before - amount);
    cleared += before - flock[status];
  }
  return cleared;
}

// Shared by live resolution and forecasts. This computes one hit only; callers
// consume protection before executing first-Open-Sky hooks and absorbing Cover.
export function incomingHit(
  amount: number, enemy: IncomingEnemy, flock: IncomingFlock,
  mods: { enemyDamageBonus: number; openSkyBonus: number }, firstSkyReduction: number,
) {
  let damage = amount + enemy.nextAttackBonus + enemy.damageBonus + mods.enemyDamageBonus;
  if (enemy.weak > 0) damage = Math.floor(damage * 0.75);
  const guardUsed = flock.exposed && flock.openSkyGuard > 0;
  const reductionUsed = flock.exposed && !guardUsed ? Math.min(mods.openSkyBonus, flock.openSkyReduction) : 0;
  const firstSkyTriggered = flock.exposed && !guardUsed && firstSkyReduction > 0;
  const skyBonus = flock.exposed && !guardUsed
    ? Math.max(0, mods.openSkyBonus - reductionUsed - firstSkyReduction) : 0;
  return { damage: damage + skyBonus, guardUsed, reductionUsed, firstSkyTriggered, skyBonus };
}

export function projectEnemyPhase<F extends IncomingFlock, E extends IncomingEnemy>(config: {
  flock: F; enemies: E[];
  mods: { enemyDamageBonus: number; openSkyBonus: number };
  move: (enemy: E, flock: F) => { effects: string[] };
  condition: (condition: string, enemy: E, flock: F) => boolean;
  firstSkyReduction: number;
  firstSkyEffects: string[];
  healing?: { overflowAvailable: boolean; markEffects: string[][] };
  counterstrike?: {
    available: boolean;
    firstAttackKeystone: boolean;
    damage: (amount: number, flock: F, enemy: E, firstAttackKeystone: boolean) => { blocked: number; hpDamage: number };
    coverBreakEffects: string[][];
  };
  uncertainty?: string[];
  prepare?: (flock: F, enemies: E[], uncertainty: Set<string>, heal: (amount: number) => void) => void;
  onlyEnemyId?: string;
  stopAfterFirstAttack?: boolean;
}) {
  const flock = { ...config.flock };
  const enemies = config.enemies.map(enemy => ({ ...enemy }));
  const uncertainty = new Set(config.uncertainty);
  let overflowAvailable = config.healing?.overflowAvailable ?? false;
  const healingMarks = config.healing?.markEffects.map(effects => [...effects]) ?? [];
  const coverBreakMarks = config.counterstrike?.coverBreakEffects.map(effects => [...effects]) ?? [];
  let braceAvailable = config.counterstrike?.available ?? false;
  let firstAttackKeystone = config.counterstrike?.firstAttackKeystone ?? false;
  let firstSkyReduction = config.firstSkyReduction;
  let total = 0;
  let blocked = 0;
  const attacks: Array<{ enemyId: string; total: number; blocked: number; hpLoss: number }> = [];
  const living = () => enemies.filter(enemy => enemy.hp > 0);
  const damageEnemy = (enemy: E, amount: number) => {
    if (enemy.hp <= 0) return;
    if (!config.counterstrike) { uncertainty.add('Waymark damage not projected'); return; }
    const hpBefore = enemy.hp, hadCover = enemy.block > 0;
    const damage = config.counterstrike.damage(amount, flock, enemy, firstAttackKeystone);
    firstAttackKeystone = false;
    enemy.block -= damage.blocked;
    // Live Cover-break hooks resolve before applying the original hit's HP loss.
    if (hadCover && enemy.block <= 0) for (const effects of coverBreakMarks) effects.splice(0).forEach(markEffect);
    enemy.hp = Math.max(0, enemy.hp - damage.hpDamage);
    if (enemy.runtime?.type === 'boss' && enemy.phase === 1 && enemy.runtime.phaseTwoMoveIds?.length
      && hpBefore > enemy.maxHp / 2 && enemy.hp > 0 && enemy.hp <= enemy.maxHp / 2) {
      enemy.phase = 2; enemy.intentIndex = 0; enemy.block = 0; enemy.nextAttackBonus = 0;
    }
  };
  const heal = (amount: number) => {
    const restored = Math.min(amount, flock.maxHp - flock.hp);
    flock.hp += restored;
    if (restored > 0) for (const effects of healingMarks) {
      // Consume this copied queue before effects, matching live nested latches.
      effects.splice(0).forEach(markEffect);
    }
    const overflow = amount - restored;
    if (overflowAvailable && overflow > 0) {
      overflowAvailable = false;
      flock.block += overflow;
    }
  };

  const markEffect = (text: string) => {
    const effect = parseEffect(text);
    if (!effect) { uncertainty.add('Unprojected Waymark rule'); return; }
    const value = parseEffectValue(effect.args[1] ?? effect.args[0], 0);
    switch (effect.name) {
      case 'gainCover': flock.block += value; break;
      case 'gainOpenSkyGuard': flock.openSkyGuard += value; break;
      case 'reduceNextOpenSky': flock.openSkyReduction += value; break;
      case 'heal': heal(value); break;
      case 'damageAll': living().forEach(enemy => damageEnemy(enemy, value)); break;
      case 'cleanseFlock':
        cleanseFlockDebuffs(flock, value);
        break;
      case 'reduceOpenSky': case 'gainEnergyNextTurn': case 'gainWingbeat':
      case 'gainResonance': case 'nextTurnDraw': case 'retainHand': case 'gainScrap': case 'draw': break;
      default: uncertainty.add('Unprojected Waymark rule');
    }
  };
  config.prepare?.(flock, enemies, uncertainty, heal);
  for (const enemy of enemies) enemy.block = 0;
  for (const enemy of enemies) {
    if (enemy.hp <= 0 || flock.hp <= 0 || (config.onlyEnemyId && enemy.id !== config.onlyEnemyId)) continue;
    const attack = { enemyId: enemy.id, total: 0, blocked: 0, hpLoss: 0 };
    const supportTarget = (selector: string) => {
      const allies = living().filter(ally => ally.id !== enemy.id);
      if (!allies.length) return enemy;
      if (selector === 'random' && allies.length > 1) uncertainty.add('Random ally target');
      if (selector === 'front' || selector === 'random') return allies[0];
      return allies.sort((a, b) => (a.hp / a.maxHp - b.hp / b.maxHp) * (selector === 'highest' ? -1 : 1))[0];
    };
    const resolve = (text: string): void => {
      const gate = /^if (.+?) then (.+)$/.exec(text);
      if (gate) { if (config.condition(gate[1], enemy, flock)) resolve(gate[2]); return; }
      const effect = parseEffect(text);
      if (!effect) { uncertainty.add('Unprojected enemy rule'); return; }
      const value = parseEffectValue(effect.args[1] ?? effect.args[0], 0);
      switch (effect.name) {
        case 'damage': {
          const hit = incomingHit(value, enemy, flock, config.mods, firstSkyReduction);
          enemy.nextAttackBonus = 0;
          if (hit.guardUsed) flock.openSkyGuard -= 1;
          flock.openSkyReduction -= hit.reductionUsed;
          if (hit.firstSkyTriggered) {
            firstSkyReduction = 0;
            config.firstSkyEffects.forEach(markEffect);
          }
          const absorbed = Math.min(flock.block, hit.damage);
          flock.block -= absorbed;
          const lost = Math.min(flock.hp, hit.damage - absorbed);
          flock.hp -= lost;
          total += hit.damage; blocked += absorbed;
          attack.total += hit.damage; attack.blocked += absorbed; attack.hpLoss += lost;
          if (braceAvailable && absorbed > 0 && lost === 0) {
            braceAvailable = false;
            if (flock.flow !== undefined && flock.flowMax !== undefined) flock.flow = Math.min(flock.flowMax, flock.flow + 1);
            living().forEach(target => damageEnemy(target, 3));
          }
          if (lost > 0 && flock.flow !== undefined) flock.flow = 0;
          break;
        }
        case 'nextAttackBonus': enemy.nextAttackBonus += value; break;
        case 'nextAttackBonusAlly': supportTarget(effect.args[0]).nextAttackBonus += value; break;
        case 'gainCover': enemy.block += value; break;
        case 'gainCoverAlly': supportTarget(effect.args[0]).block += value; break;
        case 'gainCoverAllEnemies': living().forEach(target => { target.block += value; }); break;
        case 'heal': enemy.hp = Math.min(enemy.maxHp, enemy.hp + value); break;
        case 'healAlly': { const target = supportTarget(effect.args[0]); target.hp = Math.min(target.maxHp, target.hp + value); break; }
        case 'healAllEnemies': living().forEach(target => { target.hp = Math.min(target.maxHp, target.hp + value); }); break;
        case 'applyOpenSky': flock.exposed = true; break;
        case 'applyWinded': flock.weak += value; break;
        case 'applyFrail': flock.frail += value; break;
        case 'applyPoison': flock.fouled += value; break;
        // These cannot alter damage within this phase. Never consume live RNG.
        case 'loseWingbeat': case 'addSnagToDraw': case 'addSnagToDiscard': break;
        default: uncertainty.add('Unprojected enemy rule');
      }
    };
    for (const effect of config.move(enemy, flock).effects) {
      if (enemy.hp <= 0 || flock.hp <= 0) break;
      resolve(effect);
    }
    if (attack.total > 0) attacks.push(attack);
    if (config.stopAfterFirstAttack && attack.total > 0) break;
  }
  return {
    total, blocked, hpLoss: Math.max(0, config.flock.hp - flock.hp), afterHp: flock.hp,
    attackers: attacks.length, attacks, uncertainty: [...uncertainty],
    scope: 'Enemy phase only; next-turn Fouled/Regen excluded',
  };
}
