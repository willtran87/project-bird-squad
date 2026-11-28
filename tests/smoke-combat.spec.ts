import { test, expect, type Page } from '@playwright/test';
import { boot } from './helpers/smoke';

// Split from the former tests/smoke.spec.ts (combat topics). Tests drive
// scenes through the deterministic text-state harness on window.

test('encounter intro queues confirm and pointer dismissal behind its readable window', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const game = window.__birdSquadGame;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const collect = (items: any[]): any[] => items.flatMap((child) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    const startIntro = async () => {
      for (const key of ['MenuScene', 'RouteScene', 'BattleScene']) {
        if (game.scene.isActive(key)) game.scene.stop(key);
      }
      await wait(0);
      game.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
      for (let attempt = 0; attempt < 240; attempt += 1) {
        const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
        if (state.scene === 'BattleScene' && state.combatIntro?.active) {
          return game.scene.getScene('BattleScene') as any;
        }
        await wait(25);
      }
      throw new Error('Battle intro did not become active');
    };

    const keyboardScene = await startIntro();
    const initial = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const keyboardObjects = collect(keyboardScene.children.list);
    const keyboardHit = keyboardObjects.find((child: any) => (
      child.name === 'combat-intro-dismiss-hit' && child.input?.enabled
    ));
    const keyboardLabel = keyboardObjects.find((child: any) => (
      child.name === 'combat-intro-dismiss-label'
    ))?.text;
    keyboardScene.input.keyboard.emit('keydown-ENTER');
    const queued = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const beforeMinimumMs = Math.max(
      0,
      initial.combatIntro.minimumReadableMs - initial.combatIntro.elapsedMs - 1,
    );
    window.advanceTime?.(beforeMinimumMs);
    const beforeMinimum = JSON.parse(window.render_game_to_text?.() ?? '{}');
    window.advanceTime?.(Math.max(
      1,
      beforeMinimum.combatIntro.minimumReadableMs - beforeMinimum.combatIntro.elapsedMs + 1,
    ));
    const keyboardFinished = JSON.parse(window.render_game_to_text?.() ?? '{}');

    const pointerScene = await startIntro();
    const pointerInitial = JSON.parse(window.render_game_to_text?.() ?? '{}');
    const pointerHit = collect(pointerScene.children.list).find((child: any) => (
      child.name === 'combat-intro-dismiss-hit' && child.input?.enabled
    ));
    pointerHit?.emit('pointerdown', { isDown: true });
    window.advanceTime?.(Math.max(
      0,
      pointerInitial.combatIntro.minimumReadableMs - pointerInitial.combatIntro.elapsedMs + 2,
    ));
    const pointerFinished = JSON.parse(window.render_game_to_text?.() ?? '{}');

    return {
      initial,
      keyboardHit: Boolean(keyboardHit),
      keyboardLabel,
      queued,
      beforeMinimum,
      keyboardFinished,
      pointerHit: Boolean(pointerHit),
      pointerFinished,
    };
  });

  expect(result.initial.combatIntro).toMatchObject({
    active: true,
    dismissQueued: false,
    dismissed: false,
    minimumReadableMs: 600,
  });
  expect(result.keyboardHit).toBe(true);
  expect(result.keyboardLabel).toContain(result.initial.combatIntro.binding.toUpperCase());
  expect(result.queued.combatIntro.dismissQueued).toBe(true);
  expect(result.beforeMinimum.combatIntro.active).toBe(true);
  expect(result.beforeMinimum.combatAnimationPending).toBe(true);
  expect(result.keyboardFinished.combatIntro).toMatchObject({ active: false, dismissed: true });
  expect(result.keyboardFinished.combatAnimationPending).toBe(false);
  expect(result.keyboardFinished.assetReadiness.interactive).toBe(true);
  expect(result.keyboardFinished.combatIntro.elapsedMs).toBeGreaterThanOrEqual(600);
  expect(result.pointerHit).toBe(true);
  expect(result.pointerFinished.combatIntro).toMatchObject({ active: false, dismissed: true });
  expect(result.pointerFinished.combatAnimationPending).toBe(false);
});

test('Text Pace scales readable intro and feedback holds without changing combat speed', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const game = window.__birdSquadGame;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const run = async (preference: 'relaxed' | 'standard' | 'fast') => {
      localStorage.setItem('birdsquad.textPace', preference);
      for (const key of ['MenuScene', 'RouteScene', 'BattleScene']) {
        if (game.scene.isActive(key)) game.scene.stop(key);
      }
      await wait(0);
      game.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
      let scene: any;
      let initial: any;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          initial = JSON.parse(window.render_game_to_text?.() ?? '{}');
        } catch {
          await wait(25);
          continue;
        }
        if (initial.scene === 'BattleScene' && initial.combatIntro?.active) {
          scene = game.scene.getScene('BattleScene');
          break;
        }
        await wait(25);
      }
      if (!scene) throw new Error(`Battle intro did not start for ${preference} Text Pace`);
      scene.combatIntroStartedAtMs = scene.time.now;
      initial = JSON.parse(window.render_game_to_text?.() ?? '{}');
      scene.input.keyboard.emit('keydown-ENTER');
      const remaining = Math.max(
        0,
        initial.combatIntro.minimumReadableMs - initial.combatIntro.elapsedMs,
      );
      window.advanceTime?.(Math.max(0, remaining - 1));
      const beforeFloor = JSON.parse(window.render_game_to_text?.() ?? '{}');
      window.advanceTime?.(2);
      const afterFloor = JSON.parse(window.render_game_to_text?.() ?? '{}');
      // Large banners are a Cinematic-only presentation; Text Pace still owns
      // their readable hold independently of combat's Standard timing snapshot.
      localStorage.setItem('birdsquad.combatPace', 'cinematic');
      scene.combatTurnBanner('Text Pace', '#dffbff', 0x8df4ff);
      localStorage.setItem('birdsquad.combatPace', 'standard');
      window.advanceTime!(1000);
      const bannerAliveAt1000Ms = scene.fxLayer.list.some((child: any) => (
        child.name === 'combat-turn-banner' && child.active
      ));
      return {
        textPacing: initial.textPacing,
        combatPacing: initial.combatPacing,
        beforeFloorActive: beforeFloor.combatIntro.active,
        afterFloorActive: afterFloor.combatIntro.active,
        afterFloorDismissed: afterFloor.combatIntro.dismissed,
        bannerAliveAt1000Ms,
      };
    };
    return {
      relaxed: await run('relaxed'),
      standard: await run('standard'),
      fast: await run('fast'),
    };
  });

  expect(result.relaxed.textPacing).toMatchObject({
    preference: 'relaxed', minimumReadableMs: 870, calloutHoldMs: 551, bannerHoldMs: 754,
  });
  expect(result.standard.textPacing).toMatchObject({
    preference: 'standard', minimumReadableMs: 600, calloutHoldMs: 380, bannerHoldMs: 520,
  });
  expect(result.fast.textPacing).toMatchObject({
    preference: 'fast', minimumReadableMs: 390, calloutHoldMs: 247, bannerHoldMs: 338,
  });
  for (const sample of Object.values(result)) {
    expect(sample.combatPacing.preference).toBe('standard');
    expect(sample.beforeFloorActive).toBe(true);
    expect(sample.afterFloorActive).toBe(false);
    expect(sample.afterFloorDismissed).toBe(true);
  }
  expect(result.relaxed.bannerAliveAt1000Ms).toBe(true);
  expect(result.fast.bannerAliveAt1000Ms).toBe(false);
});

test('combat intro keeps gameplay locked until the reveal completes', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    let scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 100 && !scene?.fxLayer; i += 1) {
      await wait(30);
      scene = g.scene.getScene('BattleScene');
    }
    if (!scene?.fxLayer) throw new Error('Battle scene did not reach its intro reveal');
    const card = scene.hand.find((candidate: any) => candidate.role === 'attack');
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    const before = {
      pending: scene.combatAnimationPending,
      turn: scene.turn,
      hand: scene.hand.length,
      energy: scene.energy,
      enemyHp: enemy?.hp,
    };
    scene.endTurnAnimated();
    if (card && enemy) scene.playCardAnimated(card, enemy.id);
    await wait(100);
    const blocked = {
      turn: scene.turn,
      hand: scene.hand.length,
      energy: scene.energy,
      enemyHp: enemy?.hp,
    };
    for (let i = 0; i < 80 && scene.combatAnimationPending; i += 1) await wait(50);
    return { before, blocked, settled: !scene.combatAnimationPending };
  });

  expect(result.before.pending).toBe(true);
  expect(result.blocked).toEqual({
    turn: result.before.turn,
    hand: result.before.hand,
    energy: result.before.energy,
    enemyHp: result.before.enemyHp,
  });
  expect(result.settled).toBe(true);
});

test('combat attacks resolve after their animation wind-up', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('birdsquad.combatPace', 'cinematic'));
  // This scenario deliberately exercises player, enemy, support, and reduced-
  // motion staging in one browser test. Keep its timeout above the measured
  // ~28-31 second runtime so a busy full-suite worker does not create a false
  // regression while the individual timing assertions remain strict.
  test.setTimeout(60_000);
  await boot(page);
  const playerAttack = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const waitForSettledState = async () => {
      for (let i = 0; i < 20; i += 1) {
        const state = window.__birdSquadState!();
        if (!state.combatAnimationPending) return state;
        await wait(100);
      }
      return window.__birdSquadState!();
    };
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.energy = 99;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    const card = scene.hand.find((candidate: any) =>
      candidate.role === 'attack' && scene.activeCardContract(candidate).target === 'enemy'
    );
    if (!enemy || !card) throw new Error('Expected an enemy-target attack card in the opening hand');

    const enemyHpBefore = enemy.hp;
    const handBefore = scene.hand.length;
    scene.combatPlayerHitConfirmBursts = 0;
    scene.combatPlayerCommitSigilBursts = 0;
    const hitConfirmCueBefore = window.__birdSquadState!().audio?.cueRequests?.hitConfirm ?? 0;
    const playerCommitmentCueBefore = window.__birdSquadState!().audio?.cueRequests?.playerCommitment ?? 0;
    scene.playCardAnimated(card, enemy.id);
    await wait(120);
    const during = window.__birdSquadState!();
    let resolved = during;
    for (let i = 0; i < 200; i += 1) {
      const state = window.__birdSquadState!();
      const enemyHp = state.enemies.find((candidate: any) => candidate.id === enemy.id)?.hp;
      if (enemyHp < enemyHpBefore && state.combatPlayerHitConfirm?.rendered) {
        resolved = state;
        break;
      }
      // Sample short hit feedback with deterministic game time.
      window.advanceTime!(10);
    }
    const after = await waitForSettledState();
    return {
      enemyHpBefore,
      handBefore,
      duringPending: during.combatAnimationPending,
      duringEnemyHp: during.enemies.find((candidate: any) => candidate.id === enemy.id)?.hp,
      duringHand: during.hand.length,
      afterPending: after.combatAnimationPending,
      afterEnemyHp: after.enemies.find((candidate: any) => candidate.id === enemy.id)?.hp,
      hitConfirmCueBefore,
      hitConfirmCueAfter: after.audio?.cueRequests?.hitConfirm ?? 0,
      playerCommitmentCueBefore,
      playerCommitmentCueDuring: during.audio?.cueRequests?.playerCommitment ?? 0,
      combatPlayerCommitSigilDuring: during.combatPlayerCommitSigil,
      combatPlayerHitConfirm: resolved.combatPlayerHitConfirm,
      playerCardFeedbackDuring: during.playerCardFeedback,
      playerCardFeedbackAfter: after.playerCardFeedback,
      combatPlayerCommitSigilAfter: after.combatPlayerCommitSigil,
      combatActionTrailAfter: after.combatActionTrail,
      combatCastFocusBurstAfter: after.combatCastFocusBurst,
      activeParticleBurstsAfter: after.graphicsRuntime?.activeParticleBursts,
    };
  });

  const enemyAttack = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const waitForSettledState = async () => {
      for (let i = 0; i < 2000; i += 1) {
        const state = window.__birdSquadState!();
        if (!state.combatAnimationPending) return state;
        window.advanceTime!(10);
        await wait(0);
      }
      return window.__birdSquadState!();
    };
    const waitForBeat = async (beat: string) => {
      for (let i = 0; i < 2000; i += 1) {
        const state = window.__birdSquadState!();
        if (state.combatEnemyTurnBeat === beat) return state;
        window.advanceTime!(10);
        // Let lazy art readiness settle without tying phase sampling to a
        // browser's render rate or skipping a short presentation window.
        await wait(0);
      }
      throw new Error(`Enemy phase never reached ${beat}`);
    };
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.hand = [];
    scene.flock.hp = scene.flock.maxHp;
    scene.flock.block = 0;
    scene.enemies.forEach((enemy: any) => {
      enemy.weak = 0;
      enemy.nextAttackBonus = 0;
      enemy.damageBonus = 0;
    });
    scene.combatEnemyAttackTellBursts = 0;
    scene.combatEnemyWindupPlaqueBursts = 0;
    scene.combatThreatChargeBursts = 0;
    scene.combatEnemyCommitmentSealBursts = 0;
    scene.combatEnemyRecoveryAfterglowBursts = 0;
    scene.combatRoostHandoffBursts = 0;
    scene.combatPlayerTurnRallyBursts = 0;
    scene.combatEnemyImpactContactBursts = 0;
    const roostHandoffCueBefore = window.__birdSquadState!().audio?.cueRequests?.roostHandoff ?? 0;
    const playerTurnRallyCueBefore = window.__birdSquadState!().audio?.cueRequests?.playerTurnRally ?? 0;
    const enemyCommitmentCueBefore = window.__birdSquadState!().audio?.cueRequests?.enemyCommitment ?? 0;
    // Observe the real handoff at emission: wall-clock polling can miss its
    // short lifetime when a browser is busy rendering the replenished hand.
    let observedPlayerTurnRally: ReturnType<NonNullable<typeof window.__birdSquadState>> | undefined;
    const presentPlayerTurnRally = scene.combatPlayerTurnRally;
    scene.combatPlayerTurnRally = function (...args: unknown[]) {
      const result = presentPlayerTurnRally.apply(this, args);
      observedPlayerTurnRally = window.__birdSquadState!();
      return result;
    };

    const flockHpBefore = scene.flock.hp;
    scene.endTurnAnimated();
    const duringPreamble = window.__birdSquadState!();
    const duringWindup = await waitForBeat('windup');
    const attackTellFlipX: boolean[] = scene.fxLayer.list
      .filter((entry: any) => entry.name === 'combat-enemy-attack-tell')
      .map((entry: any) => entry.flipX);
    window.advanceTime!(1700);
    const heldWindup = window.__birdSquadState!();
    const duringRelease = await waitForBeat('release');
    window.advanceTime!(1250);
    const heldRelease = window.__birdSquadState!();
    const duringImpact = await waitForBeat('impact');
    window.advanceTime!(900);
    const resolvedImpact = window.__birdSquadState!();
    const duringRecovery = await waitForBeat('recovery');
    const after = await waitForSettledState();
    scene.combatPlayerTurnRally = presentPlayerTurnRally;
    const playerTurnRally = observedPlayerTurnRally ?? after;
    return {
      flockHpBefore,
      preambleBeat: duringPreamble.combatEnemyTurnBeat,
      duringPending: duringPreamble.combatAnimationPending,
      duringFlockHp: duringPreamble.flock.hp,
      windupBeat: duringWindup.combatEnemyTurnBeat,
      windupPending: duringWindup.combatAnimationPending,
      windupFlockHp: duringWindup.flock.hp,
      heldWindupBeat: heldWindup.combatEnemyTurnBeat,
      heldWindupFlockHp: heldWindup.flock.hp,
      releaseBeat: duringRelease.combatEnemyTurnBeat,
      releasePending: duringRelease.combatAnimationPending,
      releaseFlockHp: duringRelease.flock.hp,
      heldReleaseBeat: heldRelease.combatEnemyTurnBeat,
      heldReleaseFlockHp: heldRelease.flock.hp,
      heldReleaseActionTrail: heldRelease.combatActionTrail,
      heldReleaseCommitmentSeal: heldRelease.combatEnemyCommitmentSeal,
      releaseMove: duringRelease.combatEnemyTurnMove,
      releaseActionTrail: duringRelease.combatActionTrail,
      releaseCommitmentSeal: duringRelease.combatEnemyCommitmentSeal,
      enemyCommitmentCueBefore,
      enemyCommitmentCueAfter: duringRelease.audio?.cueRequests?.enemyCommitment ?? 0,
      impactBeat: duringImpact.combatEnemyTurnBeat,
      impactFlockHp: duringImpact.flock.hp,
      impactProgress: duringImpact.combatEnemyTurnProgress,
      resolvedImpactBeat: resolvedImpact.combatEnemyTurnBeat,
      resolvedImpactFlockHp: resolvedImpact.flock.hp,
      resolvedImpactContact: resolvedImpact.combatEnemyImpactContact,
      recoveryBeat: duringRecovery.combatEnemyTurnBeat,
      recoveryPending: duringRecovery.combatAnimationPending,
      recoveryAfterglow: duringRecovery.combatEnemyRecoveryAfterglow,
      combatRoostHandoff: duringPreamble.combatRoostHandoff,
      roostHandoffCueBefore,
      roostHandoffCueAfter: duringPreamble.audio?.cueRequests?.roostHandoff ?? 0,
      combatPlayerTurnRally: playerTurnRally.combatPlayerTurnRally,
      playerTurnRallyCueBefore,
      playerTurnRallyCueAfter: playerTurnRally.audio?.cueRequests?.playerTurnRally ?? 0,
      combatBeatProgressFrame: heldWindup.combatBeatProgressFrame,
      windupProgress: heldWindup.combatEnemyTurnProgress,
      releaseProgress: heldRelease.combatEnemyTurnProgress,
      windupActionTrail: duringWindup.combatActionTrail,
      combatEnemyAttackTell: duringWindup.combatEnemyAttackTell,
      attackTellFlipX,
      combatEnemyWindupPlaque: duringWindup.combatEnemyWindupPlaque,
      combatThreatCharge: duringWindup.combatThreatCharge,
      afterPending: after.combatAnimationPending,
      afterFlockHp: after.flock.hp,
      afterAttackTell: after.combatEnemyAttackTell,
      afterWindupPlaque: after.combatEnemyWindupPlaque,
      afterCommitmentSeal: after.combatEnemyCommitmentSeal,
      afterActionTrail: after.combatActionTrail,
      afterPlayerTurnRally: after.combatPlayerTurnRally,
      afterTurnBanner: after.combatTurnBanner,
      afterCardDraw: after.combatCardDraw,
      afterResonanceSurge: after.combatResonanceSurge,
      afterFloatingCallout: after.combatFloatingCallout,
    };
  });

  const enemySupport = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    if (!enemy) throw new Error('Expected a living enemy for support wind-up check');
    const supportMove = {
      id: 'smoke_support_tell',
      label: 'Brace Up',
      effects: ['gainCover(4)'],
    };
    enemy.runtime.moves = [supportMove];
    enemy.runtime.attackPattern = { type: 'cycle', moveIds: [supportMove.id] };
    enemy.intentIndex = 0;
    scene.fxLayer.removeAll(true);
    scene.combatEnemyAttackTellBursts = 0;
    scene.combatEnemyWindupPlaqueBursts = 0;
    scene.combatEnemySupportChargeBursts = 0;
    scene.combatEnemySupportTellBursts = 0;
    scene.combatThreatChargeBursts = 0;
    scene.enemyAttackWindupFx(enemy, supportMove);
    await wait(120);
    const state = window.__birdSquadState!();
    return {
      combatEnemyAttackTell: state.combatEnemyAttackTell,
      combatEnemyWindupPlaque: state.combatEnemyWindupPlaque,
      combatEnemySupportCharge: state.combatEnemySupportCharge,
      combatEnemySupportTell: state.combatEnemySupportTell,
      combatThreatCharge: state.combatThreatCharge,
    };
  });

  expect(playerAttack.duringPending).toBe(true);
  expect(playerAttack.duringEnemyHp).toBe(playerAttack.enemyHpBefore);
  expect(playerAttack.duringHand).toBe(playerAttack.handBefore - 1);
  expect(playerAttack.combatPlayerCommitSigilDuring.loaded).toBe(true);
  expect(playerAttack.combatPlayerCommitSigilDuring.rendered).toBe(true);
  expect(playerAttack.combatPlayerCommitSigilDuring.count).toBeGreaterThanOrEqual(1);
  expect(playerAttack.combatPlayerCommitSigilDuring.bursts).toBeGreaterThanOrEqual(1);
  expect(playerAttack.playerCommitmentCueDuring).toBeGreaterThan(playerAttack.playerCommitmentCueBefore);
  expect(playerAttack.playerCardFeedbackDuring.active).toBe(true);
  expect(playerAttack.playerCardFeedbackDuring.transientObjects).toBeGreaterThan(0);
  expect(playerAttack.afterPending).toBe(false);
  expect(playerAttack.afterEnemyHp).toBeLessThan(playerAttack.enemyHpBefore);
  expect(playerAttack.combatPlayerHitConfirm.loaded).toBe(true);
  expect(playerAttack.combatPlayerHitConfirm.rendered).toBe(true);
  expect(playerAttack.combatPlayerHitConfirm.count).toBeGreaterThanOrEqual(1);
  expect(playerAttack.combatPlayerHitConfirm.bursts).toBeGreaterThanOrEqual(1);
  expect(playerAttack.hitConfirmCueAfter).toBeGreaterThan(playerAttack.hitConfirmCueBefore);
  expect(playerAttack.playerCardFeedbackAfter).toMatchObject({
    active: false,
    baselineObjects: 0,
    transientObjects: 0,
  });
  expect(playerAttack.playerCardFeedbackAfter.lastRetiredObjects).toBeGreaterThan(0);
  expect(playerAttack.combatPlayerCommitSigilAfter).toMatchObject({ rendered: false, count: 0 });
  expect(playerAttack.combatActionTrailAfter).toMatchObject({ rendered: false, count: 0 });
  expect(playerAttack.combatCastFocusBurstAfter).toMatchObject({ rendered: false, count: 0 });
  expect(playerAttack.activeParticleBurstsAfter).toBe(0);

  expect(enemyAttack.duringPending).toBe(true);
  expect(enemyAttack.preambleBeat).toBe('preamble');
  expect(enemyAttack.duringFlockHp).toBe(enemyAttack.flockHpBefore);
  expect(enemyAttack.combatRoostHandoff.loaded).toBe(true);
  expect(enemyAttack.combatRoostHandoff.rendered).toBe(true);
  expect(enemyAttack.combatRoostHandoff.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatRoostHandoff.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.roostHandoffCueAfter).toBeGreaterThan(enemyAttack.roostHandoffCueBefore);
  expect(enemyAttack.combatPlayerTurnRally.loaded).toBe(true);
  expect(enemyAttack.combatPlayerTurnRally.rendered).toBe(true);
  expect(enemyAttack.combatPlayerTurnRally.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatPlayerTurnRally.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.playerTurnRallyCueAfter).toBeGreaterThan(enemyAttack.playerTurnRallyCueBefore);
  expect(enemyAttack.windupBeat).toBe('windup');
  expect(enemyAttack.windupPending).toBe(true);
  expect(enemyAttack.windupFlockHp).toBe(enemyAttack.flockHpBefore);
  expect(enemyAttack.heldWindupBeat).toBe('windup');
  expect(enemyAttack.heldWindupFlockHp).toBe(enemyAttack.flockHpBefore);
  expect(enemyAttack.combatBeatProgressFrame.loaded).toBe(true);
  expect(enemyAttack.combatBeatProgressFrame.rendered).toBe(false);
  expect(enemyAttack.combatBeatProgressFrame.count).toBe(0);
  expect(enemyAttack.windupProgress.label).toBe('Wind-up');
  expect(enemyAttack.windupProgress.durationMs).toBeGreaterThanOrEqual(2500);
  expect(enemyAttack.windupProgress.progress).toBeGreaterThan(0.45);
  expect(enemyAttack.releaseBeat).toBe('release');
  expect(enemyAttack.releasePending).toBe(true);
  expect(enemyAttack.releaseFlockHp).toBe(enemyAttack.flockHpBefore);
  expect(enemyAttack.heldReleaseBeat).toBe('release');
  expect(enemyAttack.heldReleaseFlockHp).toBe(enemyAttack.flockHpBefore);
  expect(enemyAttack.releaseProgress.label).toBe('Commit');
  expect(enemyAttack.releaseProgress.durationMs).toBeGreaterThanOrEqual(1700);
  expect(enemyAttack.heldReleaseActionTrail.rendered).toBe(true);
  expect(enemyAttack.heldReleaseActionTrail.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.heldReleaseCommitmentSeal.rendered).toBe(true);
  expect(enemyAttack.heldReleaseCommitmentSeal.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.releaseMove.length).toBeGreaterThan(0);
  expect(enemyAttack.releaseActionTrail.rendered).toBe(true);
  expect(enemyAttack.releaseActionTrail.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.releaseCommitmentSeal.loaded).toBe(true);
  expect(enemyAttack.releaseCommitmentSeal.rendered).toBe(true);
  expect(enemyAttack.releaseCommitmentSeal.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.releaseCommitmentSeal.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.enemyCommitmentCueAfter).toBeGreaterThan(enemyAttack.enemyCommitmentCueBefore);
  expect(enemyAttack.impactBeat).toBe('impact');
  expect(enemyAttack.impactFlockHp).toBe(enemyAttack.flockHpBefore);
  expect(enemyAttack.impactProgress.durationMs).toBeGreaterThanOrEqual(2000);
  expect(enemyAttack.resolvedImpactBeat).toBe('impact');
  expect(enemyAttack.resolvedImpactFlockHp).toBeLessThan(enemyAttack.flockHpBefore);
  expect(enemyAttack.resolvedImpactContact.loaded).toBe(true);
  // This wall-clock sample can fall on either side of a short contact fade.
  // Exact at-impact size and retirement are covered by enemy-cadence.spec.ts.
  expect(enemyAttack.resolvedImpactContact.count).toBeLessThanOrEqual(1);
  expect(enemyAttack.resolvedImpactContact.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.recoveryBeat).toBe('recovery');
  expect(enemyAttack.recoveryPending).toBe(true);
  expect(enemyAttack.recoveryAfterglow.loaded).toBe(true);
  expect(enemyAttack.recoveryAfterglow.rendered).toBe(true);
  expect(enemyAttack.recoveryAfterglow.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.recoveryAfterglow.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatEnemyAttackTell.loaded).toBe(true);
  expect(enemyAttack.combatEnemyAttackTell.rendered).toBe(true);
  expect(enemyAttack.combatEnemyAttackTell.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatEnemyAttackTell.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.windupActionTrail.loaded).toBe(true);
  expect(enemyAttack.windupActionTrail.rendered).toBe(false);
  expect(enemyAttack.windupActionTrail.bursts).toBe(0);
  expect(enemyAttack.attackTellFlipX.length).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.attackTellFlipX.every((flipX) => flipX === false)).toBe(true);
  expect(enemyAttack.combatEnemyWindupPlaque.loaded).toBe(true);
  expect(enemyAttack.combatEnemyWindupPlaque.rendered).toBe(true);
  expect(enemyAttack.combatEnemyWindupPlaque.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatEnemyWindupPlaque.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatEnemyWindupPlaque.labels.length).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatThreatCharge.loaded).toBe(true);
  expect(enemyAttack.combatThreatCharge.rendered).toBe(true);
  expect(enemyAttack.combatThreatCharge.count).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.combatThreatCharge.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyAttack.afterPending).toBe(false);
  expect(enemyAttack.afterFlockHp).toBeLessThan(enemyAttack.flockHpBefore);
  expect(enemyAttack.afterAttackTell.rendered).toBe(false);
  expect(enemyAttack.afterAttackTell.count).toBe(0);
  expect(enemyAttack.afterWindupPlaque.rendered).toBe(false);
  expect(enemyAttack.afterWindupPlaque.count).toBe(0);
  expect(enemyAttack.afterCommitmentSeal.rendered).toBe(false);
  expect(enemyAttack.afterCommitmentSeal.count).toBe(0);
  expect(enemyAttack.afterActionTrail.rendered).toBe(false);
  expect(enemyAttack.afterActionTrail.count).toBe(0);
  expect(enemyAttack.afterPlayerTurnRally.rendered).toBe(false);
  expect(enemyAttack.afterPlayerTurnRally.count).toBe(0);
  expect(enemyAttack.afterTurnBanner.rendered).toBe(false);
  expect(enemyAttack.afterTurnBanner.count).toBe(0);
  expect(enemyAttack.afterCardDraw).toMatchObject({ rendered: false, count: 0 });
  expect(enemyAttack.afterResonanceSurge).toMatchObject({ rendered: false, count: 0 });
  expect(enemyAttack.afterFloatingCallout.rendered).toBe(false);

  expect(enemySupport.combatEnemyAttackTell.loaded).toBe(true);
  expect(enemySupport.combatEnemyAttackTell.rendered).toBe(false);
  expect(enemySupport.combatEnemyAttackTell.bursts).toBe(0);
  expect(enemySupport.combatEnemyWindupPlaque.loaded).toBe(true);
  expect(enemySupport.combatEnemyWindupPlaque.rendered).toBe(true);
  expect(enemySupport.combatEnemyWindupPlaque.count).toBeGreaterThanOrEqual(1);
  expect(enemySupport.combatEnemyWindupPlaque.bursts).toBeGreaterThanOrEqual(1);
  expect(enemySupport.combatEnemyWindupPlaque.labels).toContain('Brace Up');
  expect(enemySupport.combatThreatCharge.loaded).toBe(true);
  expect(enemySupport.combatThreatCharge.rendered).toBe(false);
  expect(enemySupport.combatThreatCharge.bursts).toBe(0);
  expect(enemySupport.combatEnemySupportCharge.loaded).toBe(true);
  expect(enemySupport.combatEnemySupportCharge.rendered).toBe(true);
  expect(enemySupport.combatEnemySupportCharge.count).toBeGreaterThanOrEqual(1);
  expect(enemySupport.combatEnemySupportCharge.bursts).toBeGreaterThanOrEqual(1);
  expect(enemySupport.combatEnemySupportTell.loaded).toBe(true);
  expect(enemySupport.combatEnemySupportTell.rendered).toBe(true);
  expect(enemySupport.combatEnemySupportTell.count).toBeGreaterThanOrEqual(1);
  expect(enemySupport.combatEnemySupportTell.bursts).toBeGreaterThanOrEqual(1);
});

test('direction-neutral attack tell stays readable at minimum landscape in lean reduced motion', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => {
    localStorage.setItem('birdsquad.graphicsQuality', 'lean');
    localStorage.setItem('birdsquad.motionPreference', 'reduced');
    localStorage.setItem('birdsquad.visualContrast', 'high');
  });
  await boot(page);

  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const state = window.__birdSquadState!();
      if (scene.fxLayer && state.battleFxPresenter?.ready && state.combatEnemyAttackTell?.loaded) break;
      await wait(50);
    }
    if (!scene.fxLayer) throw new Error('Battle FX layer did not become ready for minimum-landscape tell coverage');

    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    const attackMove = enemy?.runtime.moves.find((move: any) =>
      move.effects.some((effect: string) => effect.includes('damage'))
    );
    if (!enemy || !attackMove) throw new Error('Expected a damaging enemy move for minimum-landscape tell coverage');

    scene.fxLayer.removeAll(true);
    scene.combatEnemyAttackTellBursts = 0;
    scene.combatEnemyWindupPlaqueBursts = 0;
    scene.enemyAttackWindupFx(enemy, attackMove);
    await wait(120);

    const state = window.__birdSquadState!();
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('Expected the game canvas');
    const rect = canvas.getBoundingClientRect();
    const view = scene.enemyView(enemy);
    const tellObjects = scene.fxLayer.list
      .filter((entry: any) => entry.name === 'combat-enemy-attack-tell')
      .map((entry: any) => ({
        x: entry.x,
        y: entry.y,
        displayWidth: entry.displayWidth,
        displayHeight: entry.displayHeight,
        screenDiameter: entry.displayWidth * rect.width / 1280,
        alpha: entry.alpha,
        angle: entry.angle,
        flipX: entry.flipX,
        visible: entry.visible,
      }));
    await wait(360);
    const stableTellCount = scene.fxLayer.list
      .filter((entry: any) => entry.name === 'combat-enemy-attack-tell').length;

    return {
      viewport: { width: innerWidth, height: innerHeight },
      canvas: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      enemyView: { x: view.x, y: view.y, scale: view.scale },
      tellObjects,
      stableTellCount,
      graphics: state.graphics,
      motion: state.motion,
      contrast: state.visualContrast,
      attackTell: state.combatEnemyAttackTell,
      actionTrail: state.combatActionTrail,
      windupPlaque: state.combatEnemyWindupPlaque,
    };
  });

  await page.screenshot({
    path: '.artifacts/test-results/directionless-attack-tell/minimum-landscape-lean-reduced-high-contrast.png',
  });

  expect(result.viewport).toEqual({ width: 1000, height: 560 });
  expect(result.canvas.left).toBeGreaterThanOrEqual(0);
  expect(result.canvas.top).toBeGreaterThanOrEqual(0);
  expect(result.canvas.right).toBeLessThanOrEqual(result.viewport.width + 0.5);
  expect(result.canvas.bottom).toBeLessThanOrEqual(result.viewport.height + 0.5);
  expect(result.canvas.width).toBeGreaterThanOrEqual(990);
  expect(result.graphics).toMatchObject({ preference: 'lean', effective: 'lean', lean: true });
  expect(result.motion).toMatchObject({ preference: 'reduced', reduced: true });
  expect(result.contrast).toMatchObject({ preference: 'high', highContrast: true, applied: true });
  expect(result.attackTell).toMatchObject({ loaded: true, rendered: true, count: 2, bursts: 1 });
  expect(result.actionTrail).toMatchObject({ loaded: true, rendered: false, count: 0, bursts: 0 });
  expect(result.windupPlaque.loaded).toBe(true);
  expect(result.windupPlaque.rendered).toBe(true);
  expect(result.tellObjects).toHaveLength(2);
  expect(result.tellObjects.every((tell) => tell.visible && tell.flipX === false)).toBe(true);
  expect(result.tellObjects.every((tell) => Math.abs(tell.angle) <= 4)).toBe(true);
  expect(result.tellObjects.every((tell) => Math.abs(tell.x - result.enemyView.x) < 0.5)).toBe(true);
  expect(result.tellObjects.every((tell) => tell.screenDiameter >= 60)).toBe(true);
  expect(result.stableTellCount).toBe(2);
});

test('Animation Pace scales visual clocks without changing combat or text pacing', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const game = window.__birdSquadGame;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const run = async (preference: 'relaxed' | 'standard' | 'fast') => {
      localStorage.setItem('birdsquad.animationPace', preference);
      localStorage.setItem('birdsquad.combatPace', 'standard');
      localStorage.setItem('birdsquad.textPace', 'standard');
      for (const key of ['MenuScene', 'ProfileScene', 'RouteScene', 'BattleScene']) {
        if (game.scene.isActive(key)) game.scene.stop(key);
      }
      game.scene.start('MenuScene');
      await wait(30);
      const scene: any = game.scene.getScene('MenuScene');
      const target = { progress: 0 };
      scene.tweens.add({ targets: target, progress: 100, duration: 1000, ease: 'Linear' });
      await wait(420);
      const state = JSON.parse(window.render_game_to_text?.() ?? '{}');
      scene.tweens.killTweensOf(target);
      return {
        progress: target.progress,
        animationPacing: state.animationPacing,
        combatPacing: state.combatPacing,
        textPacing: state.textPacing,
      };
    };
    return {
      relaxed: await run('relaxed'),
      standard: await run('standard'),
      fast: await run('fast'),
    };
  });

  expect(result.relaxed.animationPacing).toEqual({
    preference: 'relaxed', timeScale: 0.8, tweenTimeScale: 0.8, spriteTimeScale: 0.8,
  });
  expect(result.standard.animationPacing).toEqual({
    preference: 'standard', timeScale: 1, tweenTimeScale: 1, spriteTimeScale: 1,
  });
  expect(result.fast.animationPacing).toEqual({
    preference: 'fast', timeScale: 1.3, tweenTimeScale: 1.3, spriteTimeScale: 1.3,
  });
  expect(result.relaxed.progress).toBeLessThan(result.standard.progress);
  expect(result.standard.progress).toBeLessThan(result.fast.progress);
  for (const sample of Object.values(result)) {
    expect(sample.combatPacing).toEqual({ preference: 'standard' });
    expect(sample.textPacing).toMatchObject({ preference: 'standard', minimumReadableMs: 600 });
  }
});

test('advanceTime deterministically resolves player and enemy sequencing', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.combatAnimationPending = false;
    scene.energy = 20;
    const enemy = scene.enemies[0];
    const card = scene.hand.find((candidate: any) => {
      const contract = scene.activeCardContract(candidate);
      return contract.target === 'enemy' && contract.effects.some((effect: string) => /^(?:damage|damagePierce)\(/.test(effect));
    });
    if (!card) throw new Error('Expected an enemy-targeted card');
    enemy.block = 0;
    const hpBeforeCard = enemy.hp;
    scene.playCardAnimated(card, enemy.id);
    const pendingAfterPlay = scene.combatAnimationPending;
    window.advanceTime!(3000);
    const hpAfterCard = enemy.hp;
    scene.hand = [];
    scene.endTurnAnimated();
    const pendingAfterRoost = scene.combatAnimationPending;
    window.advanceTime!(30_000);
    return {
      pendingAfterPlay,
      hpBeforeCard,
      hpAfterCard,
      pendingAfterRoost,
      pendingAfterAdvance: scene.combatAnimationPending,
      turn: scene.turn,
      beat: scene.combatEnemyTurnBeat
    };
  });

  expect(result.pendingAfterPlay).toBe(true);
  expect(result.hpAfterCard).toBeLessThan(result.hpBeforeCard);
  expect(result.pendingAfterRoost).toBe(true);
  expect(result.pendingAfterAdvance).toBe(false);
  expect(result.turn).toBe(2);
  expect(result.beat).toBe('idle');
});

test('combat redraws reuse persistent scenery and coalesce same-frame requests', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    const renderState = () => window.__birdSquadState!().combatRender;
    const settleRenders = async () => {
      let previous = -1;
      let stableFrames = 0;
      for (let index = 0; index < 80 && stableFrames < 3; index += 1) {
        await wait(50);
        const current = renderState();
        if (!current.queued && current.passes === previous) stableFrames += 1;
        else stableFrames = 0;
        previous = current.passes;
      }
    };

    await settleRenders();
    const backdropObjects = [...scene.backdropLayer.list];
    const handObjects = [...scene.handLayer.list];
    const beforeQueue = { ...renderState() };
    for (let index = 0; index < 8; index += 1) scene.requestBattleRender();
    await settleRenders();
    const afterQueue = { ...renderState() };
    const sameHandObjectsAfterQueue = handObjects.length === scene.handLayer.list.length
      && handObjects.every((object, index) => object === scene.handLayer.list[index]);

    scene.energy = 99;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    const card = scene.hand.find((candidate: any) => {
      const contract = scene.activeCardContract(candidate);
      return candidate.role === 'attack'
        && contract.target === 'enemy'
        && !contract.effects.some((effect: string) => /(?:^| then )(?:draw|gainWingbeat|enterMolt|discard)/.test(effect));
    });
    if (!enemy || !card) throw new Error('Expected an enemy-target attack card for redraw profiling');
    enemy.maxHp = Math.max(enemy.maxHp, 500);
    enemy.hp = enemy.maxHp;
    const beforePlayer = { ...renderState() };
    scene.playCardAnimated(card, enemy.id);
    window.advanceTime!(3_000);
    await settleRenders();
    const afterPlayer = { ...renderState() };

    scene.hand = [];
    const beforeEnemy = { ...renderState() };
    scene.endTurnAnimated();
    window.advanceTime!(30_000);
    await settleRenders();
    const afterEnemy = { ...renderState() };
    const sameBackdropObjects = backdropObjects.length === scene.backdropLayer.list.length
      && backdropObjects.every((object, index) => object === scene.backdropLayer.list[index]);

    return {
      queuePasses: afterQueue.passes - beforeQueue.passes,
      queueRequests: afterQueue.requests - beforeQueue.requests,
      queueCoalesced: afterQueue.coalesced - beforeQueue.coalesced,
      queueHandBuilds: afterQueue.handBuilds - beforeQueue.handBuilds,
      queueHandReuses: afterQueue.handReuses - beforeQueue.handReuses,
      playerPasses: afterPlayer.passes - beforePlayer.passes,
      playerHandBuilds: afterPlayer.handBuilds - beforePlayer.handBuilds,
      playerHandReuses: afterPlayer.handReuses - beforePlayer.handReuses,
      enemyPasses: afterEnemy.passes - beforeEnemy.passes,
      enemyHandBuilds: afterEnemy.handBuilds - beforeEnemy.handBuilds,
      enemyHandReuses: afterEnemy.handReuses - beforeEnemy.handReuses,
      backdropBuildsBefore: beforeQueue.backdropBuilds,
      backdropBuildsAfter: afterEnemy.backdropBuilds,
      backdropReuses: afterEnemy.backdropReuses - beforeQueue.backdropReuses,
      backdropObjectCount: afterEnemy.backdropObjects,
      sameBackdropObjects,
      sameHandObjectsAfterQueue,
    };
  });

  expect(result.queueRequests).toBe(8);
  expect(result.queuePasses).toBe(1);
  expect(result.queueCoalesced).toBe(7);
  expect(result.queueHandBuilds).toBe(0);
  expect(result.queueHandReuses).toBe(1);
  // Commitment updates only the card and energy; settlement publishes one board.
  expect(result.playerPasses).toBe(1);
  expect(result.playerHandBuilds).toBe(1);
  expect(result.playerHandReuses).toBe(0);
  expect(result.enemyPasses).toBe(3);
  expect(result.enemyHandBuilds).toBe(2);
  expect(result.enemyHandReuses).toBe(1);
  expect(result.backdropBuildsBefore).toBe(1);
  expect(result.backdropBuildsAfter).toBe(1);
  expect(result.backdropReuses).toBeGreaterThanOrEqual(3);
  expect(result.backdropObjectCount).toBeGreaterThan(0);
  expect(result.sameBackdropObjects).toBe(true);
  expect(result.sameHandObjectsAfterQueue).toBe(true);
});

test('imagegen combat FX pack renders each wired asset', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.queueOutcomeCombatFxAssetLoad();
    const requiredFx = ['combat-overextension-warning', 'combat-boss-phase-break', 'combat-status-cleanse-specific',
      'combat-open-sky-break', 'combat-cache-choice-reveal', 'combat-molt-trigger-choice',
      'combat-enemy-heavy-contact', 'combat-enemy-heal-beam', 'combat-resource-overcap'];
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (requiredFx.every(key => scene.textures.exists(key))) break;
      await wait(25);
    }
    scene.fxLayer.removeAll(true);

    [
      'combatOverextensionWarning',
      'combatBossPhaseBreak',
      'combatStatusCleanseSpecific',
      'combatOpenSkyBreak',
      'combatCacheChoiceReveal',
      'combatMoltTriggerChoice',
      'combatEnemyHeavyContact',
      'combatEnemyHealBeam',
      'combatResourceOvercap',
    ].forEach((name) => {
      scene[`${name}Bursts`] = 0;
    });

    scene.combatOverextensionWarning(260, 210, 0.82);
    scene.combatBossPhaseBreak(620, 204, 0.86);
    scene.combatStatusCleanseSpecific(270, 390, 0.98);
    scene.combatOpenSkyBreak(512, 402, 0.72);
    scene.combatCacheChoiceReveal(760, 396, 0.82);
    scene.combatMoltTriggerChoice(1030, 392, 0.78);
    scene.combatEnemyHeavyContact(370, 575, 830, 0.78);
    scene.combatEnemyHealBeam(560, 610, 850, 555, 0.78);
    scene.combatResourceOvercap(1050, 580, 0.82);
    // Sample the 220ms heavy-contact effect at a precise age. A wall-clock
    // sleep can resume after that effect has retired on a busy test machine.
    window.advanceTime!(120);
    const state = window.__birdSquadState!();
    return {
      combatOverextensionWarning: state.combatOverextensionWarning,
      combatBossPhaseBreak: state.combatBossPhaseBreak,
      combatStatusCleanseSpecific: state.combatStatusCleanseSpecific,
      combatOpenSkyBreak: state.combatOpenSkyBreak,
      combatCacheChoiceReveal: state.combatCacheChoiceReveal,
      combatMoltTriggerChoice: state.combatMoltTriggerChoice,
      combatEnemyHeavyContact: state.combatEnemyHeavyContact,
      combatEnemyHealBeam: state.combatEnemyHealBeam,
      combatResourceOvercap: state.combatResourceOvercap,
    };
  });

  for (const [name, fx] of Object.entries(result)) {
    expect(fx.loaded, `${name} should be preloaded`).toBe(true);
    expect(fx.rendered, `${name} should be visible on the FX layer`).toBe(true);
    expect(fx.count, `${name} should have at least one live image`).toBeGreaterThanOrEqual(1);
    expect(fx.bursts, `${name} should increment its burst counter`).toBeGreaterThanOrEqual(1);
  }
});

test('combat reduced-motion enemy turn still holds damage until impact', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('birdsquad.combatPace', 'cinematic'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const waitForBeat = async (beat: string, attempts = 120) => {
      for (let i = 0; i < attempts; i += 1) {
        const state = window.__birdSquadState!();
        if (state.combatEnemyTurnBeat === beat) return state;
        await wait(70);
      }
      return window.__birdSquadState!();
    };

    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    if (!enemy) throw new Error('Expected a living enemy for reduced-motion combat pacing');
    const attackMove = enemy.runtime.moves.find((move: any) =>
      move.effects.some((effect: string) => effect.includes('damage'))
    );
    if (!attackMove) throw new Error('Expected a damaging enemy move for reduced-motion combat pacing');

    enemy.runtime.moves = [attackMove];
    enemy.runtime.attackPattern = { type: 'cycle', moveIds: [attackMove.id] };
    enemy.intentIndex = 0;
    enemy.weak = 0;
    enemy.nextAttackBonus = 0;
    enemy.damageBonus = 0;
    scene.hand = [];
    scene.flock.hp = scene.flock.maxHp;
    scene.flock.block = 0;
    scene.combatEnemyCommitmentSealBursts = 0;
    scene.combatEnemyImpactContactBursts = 0;
    const commitmentCueBefore = window.__birdSquadState!().audio?.cueRequests?.enemyCommitment ?? 0;

    const flockHpBefore = scene.flock.hp;
    scene.endTurnAnimated();
    await wait(60);
    const preamble = window.__birdSquadState!();
    const windup = await waitForBeat('windup');
    await wait(700);
    const heldWindup = window.__birdSquadState!();
    const release = await waitForBeat('release');
    await wait(420);
    const heldRelease = window.__birdSquadState!();
    const impact = await waitForBeat('impact');
    await wait(650);
    const resolvedImpact = window.__birdSquadState!();

    return {
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      flockHpBefore,
      preambleBeat: preamble.combatEnemyTurnBeat,
      preamblePending: preamble.combatAnimationPending,
      preambleHp: preamble.flock.hp,
      windupBeat: windup.combatEnemyTurnBeat,
      windupHp: windup.flock.hp,
      heldWindupBeat: heldWindup.combatEnemyTurnBeat,
      heldWindupHp: heldWindup.flock.hp,
      heldWindupProgress: heldWindup.combatEnemyTurnProgress,
      heldWindupAttackTell: heldWindup.combatEnemyAttackTell,
      heldWindupPlaque: heldWindup.combatEnemyWindupPlaque,
      heldWindupBeatFrame: heldWindup.combatBeatProgressFrame,
      releaseBeat: release.combatEnemyTurnBeat,
      releaseHp: release.flock.hp,
      releaseCommitmentSeal: release.combatEnemyCommitmentSeal,
      heldReleaseBeat: heldRelease.combatEnemyTurnBeat,
      heldReleaseHp: heldRelease.flock.hp,
      heldReleaseCommitmentSeal: heldRelease.combatEnemyCommitmentSeal,
      commitmentCueBefore,
      commitmentCueAfter: release.audio?.cueRequests?.enemyCommitment ?? 0,
      impactBeat: impact.combatEnemyTurnBeat,
      impactHp: impact.flock.hp,
      impactProgress: impact.combatEnemyTurnProgress,
      resolvedImpactBeat: resolvedImpact.combatEnemyTurnBeat,
      resolvedImpactHp: resolvedImpact.flock.hp,
      resolvedImpactContact: resolvedImpact.combatEnemyImpactContact,
    };
  });

  expect(result.reducedMotion).toBe(true);
  expect(result.preamblePending).toBe(true);
  expect(result.preambleBeat).toBe('preamble');
  expect(result.preambleHp).toBe(result.flockHpBefore);
  expect(result.windupBeat).toBe('windup');
  expect(result.windupHp).toBe(result.flockHpBefore);
  expect(result.heldWindupBeat).toBe('windup');
  expect(result.heldWindupHp).toBe(result.flockHpBefore);
  expect(result.heldWindupProgress.label).toBe('Wind-up');
  expect(result.heldWindupProgress.durationMs).toBeGreaterThanOrEqual(1900);
  expect(result.heldWindupAttackTell.loaded).toBe(true);
  expect(result.heldWindupAttackTell.rendered).toBe(true);
  expect(result.heldWindupAttackTell.count).toBeGreaterThanOrEqual(1);
  expect(result.heldWindupPlaque.loaded).toBe(true);
  expect(result.heldWindupPlaque.rendered).toBe(true);
  expect(result.heldWindupPlaque.count).toBeGreaterThanOrEqual(1);
  expect(result.heldWindupBeatFrame.loaded).toBe(true);
  expect(result.heldWindupBeatFrame.rendered).toBe(false);
  expect(result.releaseBeat).toBe('release');
  expect(result.releaseHp).toBe(result.flockHpBefore);
  expect(result.releaseCommitmentSeal.loaded).toBe(true);
  expect(result.releaseCommitmentSeal.rendered).toBe(true);
  expect(result.releaseCommitmentSeal.count).toBeGreaterThanOrEqual(1);
  expect(result.releaseCommitmentSeal.bursts).toBeGreaterThanOrEqual(1);
  expect(result.heldReleaseBeat).toBe('release');
  expect(result.heldReleaseHp).toBe(result.flockHpBefore);
  expect(result.heldReleaseCommitmentSeal.rendered).toBe(true);
  expect(result.heldReleaseCommitmentSeal.count).toBeGreaterThanOrEqual(1);
  expect(result.commitmentCueAfter).toBeGreaterThan(result.commitmentCueBefore);
  expect(result.impactBeat).toBe('impact');
  expect(result.impactHp).toBe(result.flockHpBefore);
  expect(result.impactProgress.durationMs).toBeGreaterThanOrEqual(1500);
  expect(result.resolvedImpactBeat).toBe('impact');
  expect(result.resolvedImpactHp).toBeLessThan(result.flockHpBefore);
  expect(result.resolvedImpactContact.loaded).toBe(true);
  expect(result.resolvedImpactContact.count).toBeLessThanOrEqual(1);
  expect(result.resolvedImpactContact.bursts).toBeGreaterThanOrEqual(1);
});

test('adaptive combat pacing preserves first move staging and shortens repeats', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    window.localStorage.setItem('birdsquad.motionPreference', 'full');
    window.localStorage.setItem('birdsquad.combatPace', 'standard');
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    const move = enemy?.runtime.moves[0];
    if (!enemy || !move) throw new Error('Expected an enemy move for pacing test');

    const firstScale = scene.enemyMoveTimingScale(enemy, move);
    const firstWindup = scene.combatFxModule.enemyMoveTimings(scene, enemy, move).windup;
    scene.runSeenEnemyMoves.add(scene.enemyMovePacingKey(enemy, move));
    const repeatScale = scene.enemyMoveTimingScale(enemy, move);
    const repeatWindup = scene.combatFxModule.enemyMoveTimings(scene, enemy, move).windup;

    window.localStorage.setItem('birdsquad.combatPace', 'cinematic');
    const cinematicScale = scene.enemyMoveTimingScale(enemy, move);
    window.localStorage.setItem('birdsquad.combatPace', 'snappy');
    const snappyScale = scene.enemyMoveTimingScale(enemy, move);
    scene.currentRouteIndex = scene.maxEncounters - 1;
    const bossScale = scene.enemyMoveTimingScale(enemy, move);

    return {
      firstScale,
      firstWindup,
      repeatScale,
      repeatWindup,
      cinematicScale,
      snappyScale,
      bossScale,
      state: JSON.parse(window.render_game_to_text!()).combatPacing
    };
  });

  expect(result.firstScale).toBe(0.38);
  expect(result.firstWindup).toBe(684);
  expect(result.repeatScale).toBeCloseTo(0.24, 2);
  expect(result.repeatWindup).toBe(302);
  expect(result.cinematicScale).toBe(1);
  expect(result.snappyScale).toBeCloseTo(0.18, 2);
  expect(result.bossScale).toBe(0.28);
  expect(result.state.preference).toBe('snappy');
});

test('holding Hustle accelerates familiar enemy staging but preserves Impact', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    localStorage.setItem('birdsquad.combatPace','standard');
    await window.__birdSquadStartScene!('BattleScene',{routeNodeId:'m1_entry'});
    const b:any=window.__birdSquadGame.scene.getScene('BattleScene');
    const enemy=b.enemies[0], move={id:'hustle_test',label:'Measured Dive',effects:['damage(4)']};
    enemy.runtime.moves=[move]; enemy.runtime.attackPattern={type:'cycle',moveIds:[move.id]}; enemy.intentIndex=0;
    b.enemies=[enemy]; b.hand=[]; b.combatAnimationPending=false;
    b.runSeenEnemyMoves.add(b.enemyMovePacingKey(enemy,move));
    const hp=b.flock.hp;
    b.endTurnAnimated();
    window.advanceTime!(180);
    b.input.keyboard.emit('keydown-SPACE');
    window.advanceTime!(100);
    const protectedTell=window.__birdSquadState!();
    // Observe the acceleration window instead of jumping past the now shorter
    // familiar windup. Impact must still retain its protected damage hold.
    let accelerated=window.__birdSquadState!();
    for(let i=0;i<200 && !accelerated.combatEnemyTurnAcceleration.active && b.combatEnemyTurnBeat!=='impact';i++) {
      window.advanceTime!(10); accelerated=window.__birdSquadState!();
    }
    for(let i=0;i<200 && b.combatEnemyTurnBeat!=='impact';i++) window.advanceTime!(10);
    const impact=window.__birdSquadState!();
    window.advanceTime!(200);
    const afterHp=b.flock.hp;
    b.input.keyboard.emit('keyup-SPACE');
    return {hp,protectedTell,accelerated,impact,afterHp};
  });
  expect(result.protectedTell.combatEnemyTurnBeat).toBe('windup');
  expect(result.protectedTell.combatEnemyTurnAcceleration.eligible).toBe(false);
  expect(result.protectedTell.flock.hp).toBe(result.hp);
  expect(result.accelerated.combatEnemyTurnAcceleration.active).toBe(true);
  expect(result.accelerated.flock.hp).toBe(result.hp);
  expect(result.impact.combatEnemyTurnBeat).toBe('impact');
  expect(result.impact.combatEnemyTurnAcceleration.available).toBe(false);
  expect(result.impact.flock.hp).toBeLessThan(result.hp);
  expect(result.afterHp).toBe(result.impact.flock.hp);
  expect(result.afterHp).toBeLessThan(result.hp);
});

test('combat hand cards accept real pointer selection', async ({ page }) => {
  await boot(page);
  const card = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const battle: any = g.scene.getScene('BattleScene');
    const candidate = battle.hand.find((entry: any) =>
      battle.activeCardContract(entry).target === 'enemy' && battle.effectiveCost(entry) <= battle.energy
    );
    if (!candidate) throw new Error('Expected an affordable enemy-target card');
    const bounds = battle.handCardRects.get(candidate.instanceId)?.getBounds();
    if (!bounds) throw new Error('Expected a live hand-card hit area');
    return {
      id: candidate.instanceId,
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  });
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected the combat canvas');
  const point = {
    x: bounds.x + card.x * (bounds.width / 1280),
    y: bounds.y + card.y * (bounds.height / 720),
  };
  await page.mouse.move(point.x, point.y);
  await page.waitForTimeout(120);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(120);
  const state = await page.evaluate(() => window.__birdSquadState!());
  expect(state.combatAnimationPending).toBe(false);
  expect(state.selectedCard).toBe(card.id);
  expect(state.selectedCardOutcome?.result.flow.after).toBeGreaterThanOrEqual(state.flow);
});

test('card previews preserve live effect ordering and selection stays incremental', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.combatAnimationPending = false;
    scene.runLeaderId = 'sky_guard';
    scene.routeMarks = [];
    scene.energy = 10;

    const card = scene.hand[0];
    card.target = 'enemy';
    card.role = 'attack';
    card.cost = 0;
    card.upgraded = false;
    card.runtime.effects = [
      'damage(enemy, 3)',
      'if targetHasCover then damagePierce(enemy, 2)'
    ];
    const enemy = scene.enemies[0];
    enemy.hp = Math.max(12, enemy.hp);
    enemy.block = 4;
    scene.selectedEnemyId = enemy.id;

    let fullRenderCount = 0;
    const originalRenderAll = scene.renderAll.bind(scene);
    scene.renderAll = (...args: unknown[]) => {
      fullRenderCount += 1;
      return originalRenderAll(...args);
    };
    scene.onCardClicked(card.instanceId);
    const preview = scene.simulateCardOutcome(card, enemy.id);
    const selectedOutcome = scene.selectedCardOutcomePreview();
    const selectedPreviewRendered = scene.root.list.some((child: any) => child.name === 'combat-selection-preview');
    const forecastObjects = scene.root.list.filter((child: any) => child.name === 'combat-enemy-outcome-preview');
    const forecastLabels = forecastObjects.filter((child: any) => typeof child.text === 'string').map((child: any) => child.text);
    const selectionRenderCount = fullRenderCount;
    scene.handleBattleBack();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const forecastObjectsAfterDeselect = scene.root.list.filter((child: any) => child.name === 'combat-enemy-outcome-preview').length;
    scene.onCardClicked(card.instanceId);
    const hpBefore = enemy.hp;
    const coverBefore = enemy.block;
    const flowBefore = scene.flock.flow;
    const targetPreview = preview.enemyStates.find((candidate: any) => candidate.id === enemy.id);
    scene.playCard(card, enemy.id, { resolveDelayMs: 0 });

    return {
      selectionRenderCount,
      selectedPreviewRendered,
      selectedOutcome,
      targetPreview,
      forecastObjectCount: forecastObjects.length,
      forecastLabels,
      forecastObjectsAfterDeselect,
      preview: {
        enemyDamage: preview.enemyDamage,
        blockedDamage: preview.blockedDamage,
        flowGain: preview.flowGain
      },
      live: {
        enemyDamage: hpBefore - enemy.hp,
        blockedDamage: coverBefore - enemy.block,
        flowGain: scene.flock.flow - flowBefore
      }
    };
  });

  expect(result.selectionRenderCount).toBe(0);
  expect(result.selectedPreviewRendered).toBe(true);
  expect(result.forecastObjectCount).toBe(2);
  expect(result.forecastLabels).toEqual([]);
  expect(result.forecastObjectsAfterDeselect).toBe(0);
  expect(result.selectedOutcome.summary).toContain(`Cohesion ${result.targetPreview.hpBefore} -> ${result.targetPreview.hpAfter}`);
  expect(result.selectedOutcome.result.targetHp).toEqual({
    enemyId: result.targetPreview.id,
    before: result.targetPreview.hpBefore,
    after: result.targetPreview.hpAfter,
    max: result.targetPreview.maxHp,
    defeated: false
  });
  expect(result.targetPreview.blockBefore - result.targetPreview.blockAfter).toBe(result.live.blockedDamage);
  expect(result.targetPreview.hpBefore - result.targetPreview.hpAfter).toBe(result.live.enemyDamage);
  expect(result.preview).toEqual(result.live);
  expect(result.preview).toEqual({ enemyDamage: 1, blockedDamage: 4, flowGain: 1 });
});

test('combat card plays require intentional selection across pointer keyboard and controller', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);

  const prepare = () => page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    game.scene.stop('MenuScene');
    const scene: any = game.scene.getScene('BattleScene');
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (scene.fxLayer?.active && scene.battleHandRendererReady && scene.battleDebugStateReady) break;
      await wait(50);
    }
    scene.mode = 'battle';
    scene.combatAnimationPending = false;
    scene.combatIntroActive = false;
    scene.combatIntroDismissQueued = false;
    scene.combatIntroDismissed = true;
    scene.energy = 10;
    const index = scene.hand.findIndex((card: any) => (
      scene.activeCardContract(card).target !== 'enemy'
      && scene.effectiveCost(card) <= scene.energy
    ));
    if (index < 0) throw new Error('No affordable untargeted card was available.');
    const card = scene.hand[index];
    scene.controllerChoiceIndex = index;
    scene.battleInputActive = false;
    scene.selectedInstanceId = undefined;
    scene.renderAll();
    await wait(20);
    return { id: card.instanceId, index, name: card.runtime.displayName, target: scene.activeCardContract(card).target };
  });
  const snapshot = () => page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const state = JSON.parse(window.render_game_to_text!());
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    const objects = collect(scene.children.list);
    return {
      state,
      handLength: scene.hand.length,
      energy: scene.energy,
      cardsPlayed: scene.statCardsPlayed,
      cancelledActions: scene.statCancelledActions,
      instructionCount: objects.filter((child: any) => (
        child.name === 'combat-selection-command' && child.text === 'CONFIRM TO PLAY'
      )).length,
      liveText: document.getElementById('game-status')?.textContent ?? '',
    };
  });
  const pointerCard = (id: string) => page.evaluate((instanceId) => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const hit = scene.handCardRects.get(instanceId);
    if (!hit) throw new Error(`Missing card hit target for ${instanceId}`);
    hit.emit('pointerdown', {}, 0, 0, { stopPropagation() {} });
  }, id);
  const gamepadDown = (index: number) => page.evaluate((buttonIndex) => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    scene.input.gamepad.emit('down', scene.input.gamepad.pad1, { index: buttonIndex }, 1);
  }, index);

  const pointer = await prepare();
  expect(pointer.target).not.toBe('enemy');
  const pointerBefore = await snapshot();
  expect(pointerBefore.state.cardPlayConfirmation).toMatchObject({
    available: true,
    armed: false,
    commitBlockedUntilSelected: true,
  });
  await pointerCard(pointer.id);
  await expect.poll(async () => (await snapshot()).state.selectedCard).toBe(pointer.id);
  const pointerArmed = await snapshot();
  expect(pointerArmed).toMatchObject({
    handLength: pointerBefore.handLength,
    energy: pointerBefore.energy,
    cardsPlayed: pointerBefore.cardsPlayed,
  });
  expect(pointerArmed.state.cardPlayConfirmation).toMatchObject({
    armed: true,
    cardId: pointer.id,
    cardName: pointer.name,
    target: pointer.target,
    commitBlockedUntilSelected: false,
    input: {
      keyboard: 'Enter',
      controller: 'A',
      cancel: 'Esc / B',
    },
  });
  expect(pointerArmed.instructionCount).toBe(1);
  await expect.poll(async () => (await snapshot()).liveText).toContain('activate the selected card again to play');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/combat-card-intentional-selection-1000x560.png' });

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot()).state.selectedCard).toBeUndefined();
  const pointerCancelled = await snapshot();
  expect(pointerCancelled).toMatchObject({
    handLength: pointerBefore.handLength,
    energy: pointerBefore.energy,
    cardsPlayed: pointerBefore.cardsPlayed,
    cancelledActions: pointerBefore.cancelledActions + 1,
  });
  expect(pointerCancelled.state.cardPlayConfirmation).toMatchObject({
    armed: false,
    commitBlockedUntilSelected: true,
  });
  await pointerCard(pointer.id);
  await expect.poll(async () => (await snapshot()).state.selectedCard).toBe(pointer.id);
  await pointerCard(pointer.id);
  // Assert the durable commitment, not a brief animation flag that can finish
  // between browser polls. Dedicated clock tests cover wind-up/result ordering.
  await expect.poll(async () => (await snapshot()).cardsPlayed).toBe(pointerBefore.cardsPlayed + 1);
  const pointerCommitted = await snapshot();
  expect(pointerCommitted.handLength).toBe(pointerBefore.handLength - 1);
  expect(pointerCommitted.cardsPlayed).toBe(pointerBefore.cardsPlayed + 1);
  await page.evaluate(() => window.advanceTime?.(2400));

  const keyboard = await prepare();
  const keyboardBefore = await snapshot();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot()).state.selectedCard).toBe(keyboard.id);
  expect(await snapshot()).toMatchObject({
    handLength: keyboardBefore.handLength,
    energy: keyboardBefore.energy,
    cardsPlayed: keyboardBefore.cardsPlayed,
  });
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot()).cardsPlayed).toBe(keyboardBefore.cardsPlayed + 1);
  expect((await snapshot()).cardsPlayed).toBe(keyboardBefore.cardsPlayed + 1);
  await page.evaluate(() => window.advanceTime?.(2400));

  const controller = await prepare();
  const controllerBefore = await snapshot();
  await gamepadDown(0);
  await expect.poll(async () => (await snapshot()).state.selectedCard).toBe(controller.id);
  expect((await snapshot()).cardsPlayed).toBe(controllerBefore.cardsPlayed);
  await gamepadDown(1);
  await expect.poll(async () => (await snapshot()).state.selectedCard).toBeUndefined();
  expect((await snapshot()).cancelledActions).toBe(controllerBefore.cancelledActions + 1);
  await gamepadDown(0);
  await expect.poll(async () => (await snapshot()).state.selectedCard).toBe(controller.id);
  await gamepadDown(0);
  await expect.poll(async () => (await snapshot()).cardsPlayed).toBe(controllerBefore.cardsPlayed + 1);
  expect((await snapshot()).cardsPlayed).toBe(controllerBefore.cardsPlayed + 1);
});

test('combat confirmation rail separates long card and target names from its commit command', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await boot(page);
  const layout = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    game.scene.stop('MenuScene');
    const scene: any = game.scene.getScene('BattleScene');
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (scene.battleHudRendererModule && scene.root?.active) break;
      await wait(50);
    }
    scene.mode = 'battle';
    scene.combatAnimationPending = false;
    scene.combatIntroActive = false;
    scene.renderAll();
    scene.selectionOutcomePreview?.destroy(true);
    const context = scene.battleHudRenderContext();
    const preview = scene.battleHudRendererModule.renderBattleSelectionPreview({
      scene,
      root: scene.root,
      gameWidth: context.gameWidth,
      fontFamily: context.fontFamily,
      boldFontStyle: context.boldFontStyle,
      cyan: 0x24d0d6,
      gold: 0xd8a840,
    }, {
      card: 'Plume Victory Wire',
      target: 'Mongoose Counterfighter',
      summary: 'Cohesion 46 → 40  /  Phase II: Chokepoint Lockdown  /  Enemy Cover 8 → 0',
    });
    scene.selectionOutcomePreview = preview;
    const panel: any = preview.getByName('combat-outcome-preview');
    const cardTarget: any = preview.getByName('combat-selection-card-target');
    const commandFrame: any = preview.getByName('combat-selection-command-frame');
    const command: any = preview.getByName('combat-selection-command');
    const summary: any = preview.getByName('combat-selection-summary');
    const bounds = (object: any) => {
      const value = object.getBounds();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    return {
      panel: bounds(panel),
      cardTarget: bounds(cardTarget),
      commandFrame: bounds(commandFrame),
      command: bounds(command),
      summary: bounds(summary),
      cardTargetText: cardTarget.text,
      cardTargetFullText: cardTarget.getData('fullText'),
      cardTargetNaturalWidth: cardTarget.context.measureText(cardTarget.text).width / (cardTarget.resolution || 1),
      commandText: command.text,
      summaryText: summary.text,
      summaryFullText: summary.getData('fullText'),
      summaryNaturalWidth: summary.context.measureText(summary.text).width / (summary.resolution || 1),
    };
  });
  expect(layout.panel).toMatchObject({ width: 600, height: 52 });
  expect(layout.cardTargetFullText).toBe('Plume Victory Wire → Mongoose Counterfighter');
  expect(layout.cardTargetText).toMatch(/…$/);
  expect(layout.commandText).toBe('CONFIRM TO PLAY');
  expect(layout.summaryFullText).toContain('Phase II: Chokepoint Lockdown');
  expect(layout.summaryText).toMatch(/…$/);
  expect(layout.cardTargetNaturalWidth).toBeLessThanOrEqual(368);
  expect(layout.summaryNaturalWidth).toBeLessThanOrEqual(570);
  expect(layout.cardTarget.left).toBeGreaterThanOrEqual(layout.panel.left);
  expect(layout.cardTarget.right).toBeLessThanOrEqual(layout.commandFrame.left - 8);
  expect(layout.command.left).toBeGreaterThanOrEqual(layout.commandFrame.left);
  expect(layout.command.right).toBeLessThanOrEqual(layout.commandFrame.right);
  expect(layout.summary.left).toBeGreaterThanOrEqual(layout.panel.left);
  expect(layout.summary.right).toBeLessThanOrEqual(layout.panel.right);
  expect(layout.summary.bottom).toBeLessThanOrEqual(layout.panel.bottom);
  await page.locator('canvas').screenshot({
    path: '.artifacts/test-results/combat-selection-long-content-1000x560.png',
  });
});

test('selected attacks identify lethal results before commitment', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.combatAnimationPending = false;
    scene.routeMarks = [];
    scene.energy = 10;

    const card = scene.hand[0];
    card.target = 'enemy';
    card.role = 'attack';
    card.cost = 0;
    card.upgraded = false;
    card.runtime.effects = ['damage(enemy, 99)'];
    const enemy = scene.enemies[0];
    enemy.hp = 5;
    enemy.block = 0;
    scene.selectedEnemyId = enemy.id;
    scene.onCardClicked(card.instanceId);

    const outcome = scene.selectedCardOutcomePreview();
    const markerLabels = scene.root.list
      .filter((child: any) => child.name === 'combat-enemy-outcome-preview' && typeof child.text === 'string')
      .map((child: any) => child.text);
    const markerCount = scene.root.list.filter((child: any) => child.name === 'combat-enemy-outcome-preview').length;
    scene.playCard(card, enemy.id, { resolveDelayMs: 0 });
    return { outcome, markerLabels, markerCount, liveHp: enemy.hp };
  });

  expect(result.outcome.summary).toContain('Cohesion 5 -> DEFEATED');
  expect(result.outcome.result.targetHp).toMatchObject({ before: 5, after: 0, defeated: true });
  expect(result.markerLabels).toEqual([]);
  expect(result.markerCount).toBe(2);
  expect(result.liveHp).toBe(0);
});

test('district contracts, encounter objectives, and leader mastery stay horizontal', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    window.localStorage.removeItem('birdsquad.account');
    await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const route: any = g.scene.getScene('RouteScene');
    route.runState.combatResults = [{
      encounterId: 'guided-opening', nodeId: 'm1_entry', nodeType: 'street', enemyIds: [],
      turnsTaken: 1, damageDealt: 1, cohesionLost: 0, decisionStats: {}
    }];
    route.renderAll();
    const routeState = JSON.parse(window.render_game_to_text!());
    const contractChoice = routeState.districtContractChoice;
    const districtNodeIds = routeState.nodes.map((node: any) => node.id);
    const bossNodeId = routeState.nodes.find((node: any) => node.type === 'boss').id;
    route.chooseDistrictContract(contractChoice.options[0].id);
    const afterContract = JSON.parse(window.render_game_to_text!()).districtContract;
    const contractRendered = route.children.list.some((child: any) => child.name === 'district-contract');

    g.scene.stop('RouteScene');
    const battle: any = await window.__birdSquadStartScene!('BattleScene', { runState: route.runState, routeNodeId: 'm1_entry' });
    const initialObjective = battle.getTextState().encounterObjective;
    battle.flock.flow = 1;
    battle.enemies.forEach((enemy: any) => { enemy.hp = 0; });
    if (battle.encounterObjective?.targetEnemyId) battle.enemyDefeatedTurns.set(battle.encounterObjective.targetEnemyId, 1);
    battle.renderAll();
    const completeObjective = battle.getTextState().encounterObjective;
    const scrapBefore = battle.scrap;
    battle.applyCombatEconomyRewards();
    const objectiveAward = battle.scrap - scrapBefore;
    const snagCount = battle.allDeckCards().filter((card: any) => card.runtime.kind === 'snag').length;
    const contractCompletions: Record<string, boolean> = {};
    const contractCases = [
      { id: 'hold_line', prior: [{ nodeId: districtNodeIds[0], cohesionLost: 0 }], surges: 0, rewards: [] },
      { id: 'bright_signal', prior: [{ nodeId: districtNodeIds[0], cohesionLost: 1, surges: 1 }, { nodeId: districtNodeIds[1], cohesionLost: 1, surges: 1 }], surges: 1, rewards: [] },
      { id: 'lean_route', prior: [], surges: 0, rewards: [{ skipped: true }, { skipped: true }] },
      { id: 'clean_flight', prior: [], surges: 0, rewards: [] }
    ];
    for (const contractCase of contractCases) {
      battle.runCombatResults = contractCase.prior.map((entry: any, index: number) => ({
        encounterId: `prior-${index}`,
        nodeId: entry.nodeId,
        nodeType: 'street',
        enemyIds: [],
        turnsTaken: 1,
        damageDealt: 0,
        cohesionLost: entry.cohesionLost,
        decisionStats: { surgesTriggered: entry.surges ?? 0 }
      }));
      battle.statTaken = 0;
      battle.statSurgesTriggered = contractCase.surges;
      battle.runRewardEvents = contractCase.rewards;
      battle.runDistrictContracts = [{
        id: contractCase.id,
        mapIndex: 0,
        baselineCombatResults: 0,
        baselineRewardEvents: 0,
        baselineSnags: snagCount,
        completed: false
      }];
      battle.finalizeDistrictContract(bossNodeId);
      contractCompletions[contractCase.id] = battle.runDistrictContracts[0].completed;
    }
    battle.runDistrictContracts = [{
      id: 'clean_flight',
      mapIndex: 0,
      baselineCombatResults: 0,
      baselineRewardEvents: 0,
      baselineSnags: snagCount,
      completed: false
    }];
    battle.finalizeDistrictContract(bossNodeId);
    battle.emitRunSummary('loss');
    const account = JSON.parse(window.localStorage.getItem('birdsquad.account') ?? '{}');
    const celebrationRun = structuredClone(route.runState);
    celebrationRun.districtContracts = [{
      id: 'clean_flight', mapIndex: 0, baselineCombatResults: 0,
      baselineRewardEvents: 0, baselineSnags: 0, confirmed: true,
      completed: true, rewardClaimed: true, celebrated: false,
    }];
    const celebrationRoute: any = await window.__birdSquadStartScene!('RouteScene', { runState: celebrationRun });
    const celebrationInitial = JSON.parse(window.render_game_to_text!());
    const celebrationObjects = celebrationRoute.children.list
      .filter((child: any) => child.name?.startsWith('district-contract-celebration'))
      .map((child: any) => child.name);
    await window.advanceTime!(1950);
    await wait(100);
    const celebrationExpired = JSON.parse(window.render_game_to_text!()).districtContractCelebration;
    const celebratedPersisted = celebrationRoute.runState.districtContracts[0].celebrated;
    const checkpoint = JSON.parse(window.localStorage.getItem('birdsquad.run.active') ?? '{}');
    const completionCuesBeforeResume = window.__birdSquadAudio!().cueRequests.objectiveComplete ?? 0;
    const menu: any = await window.__birdSquadStartScene!('MenuScene');
    menu.continueRun();
    for (let i = 0; i < 120 && !g.scene.isActive('RouteScene'); i += 1) await wait(25);
    const resumedState = JSON.parse(window.render_game_to_text!());

    return {
      contractChoice,
      afterContract,
      contractRendered,
      initialObjective,
      completeObjective,
      objectiveAward,
      account,
      contractCompletions,
      cleanFlightComplete: battle.runDistrictContracts[0].completed,
      recordedContract: window.__birdSquadLastRun?.districtContracts?.[0],
      recordedObjective: window.__birdSquadLastRun?.combatResults?.at(-1)?.objective,
      celebrationInitial: celebrationInitial.districtContractCelebration,
      celebrationCueRequests: celebrationInitial.audio.cueRequests,
      celebrationObjects,
      celebrationExpired,
      celebratedPersisted,
      checkpointCelebrated: checkpoint.districtContracts?.[0]?.celebrated,
      resumedCelebration: resumedState.districtContractCelebration,
      completionCuesAfterResume: resumedState.audio.cueRequests.objectiveComplete ?? 0,
      completionCuesBeforeResume,
    };
  });

  expect(result.contractChoice.open).toBe(true);
  expect(result.contractChoice.options).toHaveLength(3);
  expect(result.contractChoice.options.every((choice: any) => choice.rewardScrap > 0)).toBe(true);
  expect(result.afterContract.id).toBe(result.contractChoice.options[0].id);
  expect(result.contractRendered).toBe(true);
  expect(result.initialObjective.status).toBe('active');
  expect(result.completeObjective.status).toBe('complete');
  expect(result.objectiveAward).toBeGreaterThanOrEqual(result.completeObjective.bonusScrap);
  expect(result.account.runsByLeader.fledgling).toBe(1);
  expect(result.account.contractBadges).toContain('0:clean_flight');
  expect(result.account.leaderProgress.fledgling.contracts).toBe(1);
  expect(result.contractCompletions).toEqual({ hold_line: true, bright_signal: true, lean_route: true, clean_flight: true });
  expect(result.cleanFlightComplete).toBe(true);
  expect(result.recordedContract).toMatchObject({ id: 'clean_flight', completed: true });
  expect(result.recordedObjective.status).toBe('complete');
  expect(result.celebrationInitial).toMatchObject({
    id: 'clean_flight', name: 'Clean Flight', rewardScrap: 20, rendered: true,
  });
  expect(result.celebrationInitial.remainingMs).toBeGreaterThan(0);
  expect(result.celebrationInitial.remainingMs).toBeLessThanOrEqual(1800);
  expect(result.celebrationCueRequests.objectiveComplete).toBeGreaterThanOrEqual(1);
  expect(result.celebrationObjects).toEqual(expect.arrayContaining([
    'district-contract-celebration-frame',
    'district-contract-celebration',
  ]));
  expect(result.celebrationExpired).toBeUndefined();
  expect(result.celebratedPersisted).toBe(true);
  expect(result.checkpointCelebrated).toBe(true);
  expect(result.resumedCelebration).toBeUndefined();
  expect(result.completionCuesAfterResume).toBe(result.completionCuesBeforeResume);
});

test('encounter objectives are seeded, varied, and resolve from visible combat state', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.runCombatResults = [
      { nodeId: 'prior-flight-1' },
      { nodeId: 'prior-flight-2' },
      { nodeId: 'prior-flight-3' }
    ];
    const objectives = Array.from({ length: 24 }, (_value, index) => scene.createEncounterObjective({
      id: `objective-${index}`,
      type: 'street',
      risk: 'medium'
    }));
    const repeatA = scene.createEncounterObjective({ id: 'repeat-objective', type: 'street', risk: 'medium' });
    const repeatB = scene.createEncounterObjective({ id: 'repeat-objective', type: 'street', risk: 'medium' });

    scene.encounterObjective = { type: 'clean_roost', title: 'Measured Flight', description: '', bonusScrap: 14 };
    scene.statOverextensions = 1;
    const failedRestraint = scene.encounterObjectiveStatus();
    scene.encounterObjective = { type: 'trigger_surge', title: 'Bright Signal', description: '', bonusScrap: 15 };
    scene.statSurgesTriggered = 1;
    const completedSurge = scene.encounterObjectiveStatus();

    scene.enemies.forEach((enemy: any) => { enemy.hp = Math.max(1, enemy.hp); });
    scene.encounterObjective = { type: 'bank_wingbeat', title: 'Keep A Reserve', description: '', bonusScrap: 14, targetAmount: 1 };
    scene.statUnspentWingbeatAtRoost = 1;
    const bankedProgress = scene.encounterObjectiveTextState();
    scene.enemies.forEach((enemy: any) => { enemy.hp = 0; });
    const completedReserve = scene.encounterObjectiveStatus();

    scene.enemies.forEach((enemy: any) => { enemy.hp = 1; });
    scene.encounterObjective = { type: 'block_damage', title: 'Breakwater Guard', description: '', bonusScrap: 15, targetAmount: 8 };
    scene.statBlocked = 5;
    const blockedProgress = scene.encounterObjectiveTextState();
    scene.statBlocked = 8;
    scene.enemies.forEach((enemy: any) => { enemy.hp = 0; });
    const completedGuard = scene.encounterObjectiveStatus();

    return {
      types: [...new Set(objectives.map((objective: any) => objective.type))],
      deterministic: repeatA.type === repeatB.type && repeatA.title === repeatB.title,
      failedRestraint: failedRestraint.status,
      completedSurge: completedSurge.status,
      bankedProgress: bankedProgress.progress,
      completedReserve: completedReserve.status,
      blockedProgress: blockedProgress.progress,
      completedGuard: completedGuard.status
    };
  });

  expect(result.types.length).toBeGreaterThanOrEqual(4);
  expect(result.deterministic).toBe(true);
  expect(result.failedRestraint).toBe('failed');
  expect(result.completedSurge).toBe('complete');
  expect(result.bankedProgress).toEqual({ current: 1, target: 1, label: 'Wingbeat banked 1/1' });
  expect(result.completedReserve).toBe('complete');
  expect(result.blockedProgress).toEqual({ current: 5, target: 8, label: 'Damage blocked 5/8' });
  expect(result.completedGuard).toBe('complete');
});

test('district encounter goals create distinct strategic objective pools', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    const route: any = await window.__birdSquadStartScene!('RouteScene', {});
    g.scene.stop('MenuScene');
    const baseRunState = structuredClone(route.runState);
    const pools = [];
    for (let mapIndex = 0; mapIndex < 4; mapIndex += 1) {
      const scene: any = await window.__birdSquadStartScene!('BattleScene', {
        routeNodeId: `m${mapIndex + 1}_entry`,
        runState: {
          ...structuredClone(baseRunState),
          mapIndex,
          seed: `district-objectives-${mapIndex}`,
          combatResults: [
            { encounterId: '', nodeId: 'prior-1', nodeType: 'street', enemyIds: [], turnsTaken: 1, damageDealt: 0, cohesionLost: 0 },
            { encounterId: '', nodeId: 'prior-2', nodeType: 'street', enemyIds: [], turnsTaken: 1, damageDealt: 0, cohesionLost: 0 },
            { encounterId: '', nodeId: 'prior-3', nodeType: 'street', enemyIds: [], turnsTaken: 1, damageDealt: 0, cohesionLost: 0 }
          ]
        }
      });
      const types = new Set<string>();
      for (let index = 0; index < 48; index += 1) {
        const objective = scene.createEncounterObjective({
          id: `district-${mapIndex}-objective-${index}`,
          type: 'street',
          risk: 'medium'
        });
        if (objective) types.add(objective.type);
      }
      pools.push([...types].sort());
    }
    return pools;
  });

  expect(result[0]).toEqual(expect.arrayContaining(['clean_roost', 'finish_guarded', 'preserve_flow']));
  expect(result[0]).not.toContain('block_damage');
  expect(result[1]).toEqual(expect.arrayContaining(['bank_wingbeat', 'block_damage', 'no_damage']));
  expect(result[1]).not.toContain('trigger_surge');
  expect(result[2]).toEqual(expect.arrayContaining(['bank_wingbeat', 'preserve_flow', 'trigger_surge']));
  expect(result[2]).not.toContain('block_damage');
  expect(result[3]).toEqual(expect.arrayContaining(['bank_wingbeat', 'block_damage', 'swift_clear']));
  expect(result[3]).not.toContain('trigger_surge');
});

test('encounter goal HUD shows live progress and an explanatory tooltip', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    scene.encounterObjective = {
      type: 'bank_wingbeat',
      title: 'Keep A Reserve',
      description: 'Roost with at least 1 Wingbeat unspent, then win',
      bonusScrap: 14,
      targetAmount: 1
    };
    scene.statUnspentWingbeatAtRoost = 1;
    scene.requestBattleRender();
    let objectiveText: any;
    let panel: any;
    for (let i = 0; i < 80; i += 1) {
      objectiveText = scene.root?.list.find((child: any) => child.name === 'encounter-objective' && child.type === 'Text');
      panel = scene.root?.list.find((child: any) => child.name === 'encounter-objective' && child.type === 'Rectangle');
      if (objectiveText?.text.includes('Wingbeat banked 1/1') && panel?.input?.enabled) break;
      await wait(50);
    }
    panel.emit('pointerover');
    await wait(20);
    const tooltipTexts = scene.root.list
      .filter((child: any) => child.type === 'Container')
      .flatMap((container: any) => container.list ?? [])
      .filter((child: any) => child.type === 'Text')
      .map((child: any) => child.text);
    const state = JSON.parse(window.render_game_to_text!()).encounterObjective;
    return {
      hudText: objectiveText?.text,
      panelInteractive: !!panel?.input?.enabled,
      tooltipTexts,
      state
    };
  });

  expect(result.hudText).toContain('Keep A Reserve');
  expect(result.hudText).toContain('Wingbeat banked 1/1');
  expect(result.hudText).toContain('+14');
  expect(result.panelInteractive).toBe(true);
  expect(result.tooltipTexts).toContain('Keep A Reserve');
  expect(result.tooltipTexts.some((text: string) => text.includes('Roost with at least 1 Wingbeat unspent'))).toBe(true);
  expect(result.state.progress).toEqual({ current: 1, target: 1, label: 'Wingbeat banked 1/1' });
});

test('priority encounter goal marks its enemy beside the Tell and exposes the deadline', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const target = scene.enemies[0];
    scene.turn = 2;
    scene.encounterObjective = {
      type: 'priority',
      title: 'Break The Signal',
      description: `Defeat ${target.name} by Beat 3`,
      bonusScrap: 14,
      targetEnemyId: target.id,
      deadlineTurn: 3
    };
    scene.requestBattleRender();

    const objectiveObjects = () => scene.root.list.filter((child: any) => child.name === 'combat-objective-target');
    for (let i = 0; i < 80 && objectiveObjects().length < 2; i += 1) await wait(50);
    const activePanel = objectiveObjects().find((child: any) => child.type === 'Rectangle');
    const activeText = objectiveObjects().find((child: any) => child.type === 'Text')?.text;
    const panelInteractive = !!activePanel?.input?.enabled;
    activePanel.emit('pointerover');
    await wait(20);
    const tooltipTexts = scene.root.list
      .filter((child: any) => child.type === 'Container')
      .flatMap((container: any) => container.list ?? [])
      .filter((child: any) => child.type === 'Text')
      .map((child: any) => child.text);

    scene.turn = 4;
    scene.requestBattleRender();
    let failedText = '';
    for (let i = 0; i < 80; i += 1) {
      failedText = objectiveObjects().find((child: any) => child.type === 'Text')?.text ?? '';
      if (failedText === 'Objective missed') break;
      await wait(50);
    }
    const state = JSON.parse(window.render_game_to_text!()).encounterObjective;
    return {
      activeText,
      failedText,
      panelInteractive,
      tooltipTexts,
      state
    };
  });

  expect(result.activeText).toBe('Objective · 2 beats');
  expect(result.failedText).toBe('Objective missed');
  expect(result.panelInteractive).toBe(true);
  expect(result.tooltipTexts).toContain('Break The Signal');
  expect(result.tooltipTexts.some((text: string) => text.includes('Complete the goal for +14 Scrap'))).toBe(true);
  expect(result.state.status).toBe('failed');
  expect(result.state.progress.label).toContain('Beat 4/3');
});

test('encounter objective feedback celebrates or softens failure once with matching audio', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const read = () => JSON.parse(window.render_game_to_text!());
    const feedbackText = (scene: any) => {
      const group = scene.fxLayer.list.find((child: any) => child.name === 'combat-objective-feedback');
      return group?.list.find((child: any) => child.type === 'Text')?.text ?? '';
    };
    const g = window.__birdSquadGame;

    const missedScene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const missedTarget = missedScene.enemies[0];
    missedScene.encounterObjective = {
      type: 'priority',
      title: 'Break The Signal',
      description: `Defeat ${missedTarget.name} by Beat 3`,
      bonusScrap: 14,
      targetEnemyId: missedTarget.id,
      deadlineTurn: 3
    };
    missedScene.encounterObjectiveFeedbackStatus = 'active';
    missedScene.turn = 4;
    missedScene.requestBattleRender();
    for (let index = 0; index < 80 && read().encounterObjectiveFeedback?.status !== 'failed'; index += 1) await wait(50);
    const missedState = read();
    const missedText = feedbackText(missedScene);
    missedScene.requestBattleRender();
    await wait(100);
    const missedAfterDuplicateRender = read();

    const completeScene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    const completeTarget = completeScene.enemies[0];
    completeTarget.hp = 1;
    completeScene.encounterObjective = {
      type: 'priority',
      title: 'Break The Signal',
      description: `Defeat ${completeTarget.name} by Beat 3`,
      bonusScrap: 14,
      targetEnemyId: completeTarget.id,
      deadlineTurn: 3
    };
    completeScene.encounterObjectiveFeedbackStatus = 'active';
    completeScene.damageEnemy(completeTarget.id, 1, 'Objective feedback test');
    completeScene.requestBattleRender();
    for (let index = 0; index < 80 && read().encounterObjectiveFeedback?.status !== 'complete'; index += 1) await wait(50);
    const completeState = read();
    const completeText = feedbackText(completeScene);
    completeScene.requestBattleRender();
    await wait(100);
    const completeAfterDuplicateRender = read();

    return {
      missed: {
        text: missedText,
        feedback: missedState.encounterObjectiveFeedback,
        cue: missedState.audio.cueRequests.objectiveMissed ?? 0,
        duplicateBursts: missedAfterDuplicateRender.encounterObjectiveFeedback.bursts,
        duplicateCue: missedAfterDuplicateRender.audio.cueRequests.objectiveMissed ?? 0
      },
      complete: {
        text: completeText,
        feedback: completeState.encounterObjectiveFeedback,
        cue: completeState.audio.cueRequests.objectiveComplete ?? 0,
        duplicateBursts: completeAfterDuplicateRender.encounterObjectiveFeedback.bursts,
        duplicateCue: completeAfterDuplicateRender.audio.cueRequests.objectiveComplete ?? 0
      }
    };
  });

  expect(result.missed.text).toBe('GOAL MISSED');
  expect(result.missed.feedback).toEqual({ status: 'failed', bursts: 1, rendered: true });
  expect(result.missed.cue).toBe(1);
  expect(result.missed.duplicateBursts).toBe(1);
  expect(result.missed.duplicateCue).toBe(1);
  expect(result.complete.text).toBe('GOAL COMPLETE  +14');
  expect(result.complete.feedback).toEqual({ status: 'complete', bursts: 1, rendered: true });
  expect(result.complete.cue).toBe(1);
  expect(result.complete.duplicateBursts).toBe(1);
  expect(result.complete.duplicateCue).toBe(1);
});

test('combat starts after essential FX while specialized FX stream during the intro', async ({ page }) => {
  await boot(page);
  const state = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    return {
      essentialReady: scene.textures.exists('combat-encounter-intro'),
      fxPresenter: JSON.parse(window.render_game_to_text!()).battleFxPresenter,
      debugState: JSON.parse(window.render_game_to_text!()).battleDebugState,
      backdropRenderer: JSON.parse(window.render_game_to_text!()).battleBackdropRenderer,
      foregroundRenderer: JSON.parse(window.render_game_to_text!()).battleForegroundRenderer,
      hudRenderer: JSON.parse(window.render_game_to_text!()).battleHudRenderer,
      handRenderer: JSON.parse(window.render_game_to_text!()).battleHandRenderer,
      rewardRenderer: JSON.parse(window.render_game_to_text!()).battleRewardRenderer,
      optionalRequested: scene.combatOptionalFxAssetsRequested,
      enemyTurnRequested: scene.combatEnemyTurnFxAssetsRequested,
      mode: scene.mode
    };
  });

  expect(state.essentialReady).toBe(true);
  expect(state.fxPresenter).toEqual({ ready: true, loaded: true });
  expect(state.debugState).toEqual({ ready: true, loaded: true });
  expect(state.backdropRenderer).toEqual({ ready: true, loaded: true });
  expect(state.foregroundRenderer).toEqual({ ready: true, loaded: true });
  expect(state.hudRenderer).toEqual({ ready: true, loaded: true });
  expect(state.handRenderer).toEqual({ ready: true, loaded: true });
  expect(state.rewardRenderer).toEqual({ requested: false, ready: false, loaded: false, failed: false });
  expect(state.optionalRequested).toBe(true);
  expect(state.enemyTurnRequested).toBe(true);
  expect(state.mode).toBe('battle');
});

test('Retain exposes exact priority and accepts pointer keyboard and controller selection', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);

  const ids = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    game.scene.stop('MenuScene');
    const scene: any = game.scene.getScene('BattleScene');
    for (let index = 0; index < 60 && !(scene.hand?.length >= 3 && scene.battleHandRendererModule && scene.fxLayer); index += 1) await wait(50);
    scene.routeMarks = [];
    scene.markFiredThisCombat = new Set();
    scene.hand = scene.hand.slice(0, 3);
    scene.energy = 0;
    scene.pendingRetainHand = 2;
    scene.roostRetainPool = [];
    scene.roostRetainPriorityInstanceId = undefined;
    scene.cardsPlayedThisTurn = 1;
    scene.combatAnimationPending = false;
    scene.combatIntroActive = false;
    scene.combatIntroDismissQueued = false;
    scene.combatIntroDismissed = true;
    scene.mode = 'battle';
    scene.battleInputActive = true;
    scene.controllerChoiceIndex = 0;
    scene.selectedInstanceId = undefined;
    scene.renderAll();
    await wait(50);
    return scene.hand.map((card: any) => card.instanceId);
  });

  const snapshot = () => page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const state = window.__birdSquadState!();
    return {
      state,
      selected: scene.selectedInstanceId,
      tags: scene.handLayer.list
        .filter((object: any) => object.name === 'combat-retain-priority-tag' && object.type === 'Text')
        .map((object: any) => ({ text: object.text, order: object.getData('order') }))
        .sort((a: any, b: any) => a.order - b.order),
      hints: scene.root.list
        .filter((object: any) => object.name === 'combat-input-hint' && object.type === 'Text')
        .map((object: any) => object.text),
      cursors: state.hand.map((card: any) => scene.handCardRects.get(card.instanceId)?.input?.cursor),
      liveText: document.getElementById('game-status')?.textContent ?? '',
    };
  });
  const resetSelection = () => page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    scene.selectedInstanceId = undefined;
    scene.controllerChoiceIndex = 0;
    scene.handRenderKey = '';
    scene.renderAll();
  });

  const initial = await snapshot();
  expect(initial.state.retentionPlan.cards.map((card: any) => card.instanceId)).toEqual([ids[2], ids[1]]);
  expect(initial.state.retentionPlan.rule).toContain('Selected card first');
  expect(initial.tags).toEqual([{ text: 'KEEP 1', order: 1 }, { text: 'KEEP 2', order: 2 }]);
  expect(initial.hints).toHaveLength(1);
  expect(initial.hints[0]).toContain('SELECT CARD = KEEP FIRST');
  expect(initial.cursors).toEqual(['pointer', 'pointer', 'pointer']);

  await page.evaluate((instanceId) => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    scene.handCardRects.get(instanceId).emit('pointerdown', {}, 0, 0, { stopPropagation() {} });
  }, ids[0]);
  await expect.poll(async () => (await snapshot()).state.retentionPlan.cards[0].instanceId).toBe(ids[0]);
  const pointer = await snapshot();
  expect(pointer.state.hand.find((card: any) => card.instanceId === ids[0]).retainOrder).toBe(1);
  await expect.poll(async () => (await snapshot()).liveText).toContain('first Retain priority');

  await resetSelection();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await snapshot()).selected).toBe(ids[1]);
  expect((await snapshot()).state.retentionPlan.cards[0].instanceId).toBe(ids[1]);

  await resetSelection();
  await page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    scene.input.gamepad.emit('down', scene.input.gamepad.pad1, { index: 15 }, 1);
  });
  await expect.poll(async () => (await snapshot()).selected).toBe(ids[1]);
  expect((await snapshot()).state.retentionPlan.cards[0].instanceId).toBe(ids[1]);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/retain-priority-1000x560.png' });
});

test('discard choices resolve after draws with pointer keyboard and controller parity', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);

  const ids = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    for (let index = 0; index < 60 && !(scene.discardChoiceModule && scene.returnChoiceModule); index += 1) await wait(50);
    const base = scene.hand[0];
    const makeCard = (id: string, name: string, effects: string[], instanceId: string) => ({
      ...base,
      instanceId,
      id,
      name,
      type: 'minor',
      role: 'utility',
      target: 'self',
      cost: 0,
      text: effects.join('; '),
      upgradedText: effects.join('; '),
      heldText: '',
      moltText: '',
      moltTextUpgraded: '',
      runtime: {
        ...base.runtime,
        id,
        displayName: name,
        kind: 'crew',
        suit: 'nests',
        cost: 0,
        target: 'self',
        tags: ['draw', 'discard'],
        effects,
        heldEffects: [],
        moltEffects: [],
        upgrade: { ...base.runtime.upgrade, effects, moltEffects: [] },
      },
    });
    const nest = makeCard('discard_test_nest', 'Nest Juggle Test', ['draw(1)', 'discard(1)'], 'discard-nest');
    const keep = makeCard('discard_test_keep', 'Keep Card', [], 'discard-keep');
    const drawn = makeCard('discard_test_drawn', 'Fresh Draw', [], 'discard-drawn');
    scene.hand = [nest, keep];
    scene.drawPile = [drawn];
    scene.discardPile = [];
    scene.energy = 3;
    scene.mode = 'battle';
    scene.combatAnimationPending = false;
    scene.combatIntroActive = false;
    scene.combatIntroDismissed = true;
    scene.playCard(nest);
    await wait(50);
    return { nest: nest.instanceId, keep: keep.instanceId, drawn: drawn.instanceId };
  });

  const choiceState = await page.evaluate(() => window.__birdSquadState!());
  expect(choiceState.discardChoice).toMatchObject({
    source: 'Nest Juggle Test', optional: false, max: 1, required: 1, selectedCount: 0, canConfirm: false,
  });
  expect(choiceState.discardChoice.candidates.map((card: any) => card.instanceId)).toEqual([ids.keep, ids.drawn]);
  expect(choiceState.discardPile).toBe(0);
  expect(choiceState.hand.find((card: any) => card.instanceId === ids.drawn).discardSelectable).toBe(true);
  await expect.poll(async () => page.locator('#game-status').textContent()).toContain('Choose exactly 1 card');

  await page.evaluate((instanceId) => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    scene.handCardRects.get(instanceId).emit('pointerdown', {}, 0, 0, { stopPropagation() {} });
  }, ids.drawn);
  await expect.poll(async () => page.evaluate(() => window.__birdSquadState!().discardChoice?.selectedCount)).toBe(1);
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/discard-choice-1000x560.png' });
  await page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    scene.root.list.find((object: any) => object.name === 'combat-discard-confirm' && object.input?.enabled)
      .emit('pointerdown');
  });
  const pointerResult = await page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    return {
      state: window.__birdSquadState!(),
      hand: scene.hand.map((card: any) => card.instanceId),
      discard: scene.discardPile.map((card: any) => card.instanceId),
    };
  });
  expect(pointerResult.state.discardChoice).toBeUndefined();
  expect(pointerResult.hand).toEqual([ids.keep]);
  expect(pointerResult.discard).toEqual([ids.drawn, ids.nest]);

  const optional = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const base = scene.hand[0];
    const make = (instanceId: string, name: string, effects: string[] = []) => ({
      ...base,
      instanceId,
      id: instanceId,
      name,
      cost: 0,
      target: 'self',
      text: effects.join('; '),
      runtime: { ...base.runtime, id: instanceId, displayName: name, kind: 'crew', suit: 'basins', cost: 0, target: 'self', tags: ['discard'], effects, heldEffects: [], moltEffects: [], upgrade: { ...base.runtime.upgrade, effects, moltEffects: [] } },
    });
    const walkaway = make('optional-walkaway', 'Basin Walkaway Test', ['discardUpTo(2)', 'heal(3 perDiscarded)', 'gainCover(2 perDiscarded)']);
    scene.hand = [walkaway, make('optional-one', 'First Option'), make('optional-two', 'Second Option')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.flock.hp = scene.flock.maxHp - 10;
    scene.flock.block = 0;
    scene.energy = 3;
    scene.combatAnimationPending = false;
    scene.playCard(walkaway);
    await wait(30);
    scene.input.gamepad.emit('down', scene.input.gamepad.pad1, { index: 1 }, 1);
    await wait(30);
    const skipped = { hp: scene.flock.hp, block: scene.flock.block, hand: scene.hand.length, choice: scene.discardChoice };

    const partial = make('partial-walkaway', 'Basin Walkaway Partial', ['discardUpTo(2)', 'heal(3 perDiscarded)', 'gainCover(2 perDiscarded)']);
    scene.hand = [partial, make('partial-one', 'Partial One'), make('partial-two', 'Partial Two')];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.flock.hp = scene.flock.maxHp - 10;
    scene.flock.block = 0;
    scene.energy = 3;
    scene.combatAnimationPending = false;
    scene.playCard(partial);
    await wait(30);
    scene.input.gamepad.emit('down', scene.input.gamepad.pad1, { index: 0 }, 1);
    scene.input.gamepad.emit('down', scene.input.gamepad.pad1, { index: 3 }, 1);
    await wait(30);
    return {
      skipped,
      partial: { hp: scene.flock.hp, maxHp: scene.flock.maxHp, block: scene.flock.block, hand: scene.hand.map((card: any) => card.instanceId), discard: scene.discardPile.map((card: any) => card.instanceId), choice: scene.discardChoice },
    };
  });
  expect(optional.skipped).toMatchObject({ block: 0, hand: 2, choice: undefined });
  expect(optional.partial.hp).toBe(optional.partial.maxHp - 7);
  expect(optional.partial.block).toBe(2);
  expect(optional.partial.hand).toEqual(['partial-two']);
  expect(optional.partial.discard).toEqual(['partial-one', 'partial-walkaway']);
  expect(optional.partial.choice).toBeUndefined();
});

test('discard sequencing delays Supply consumption and keeps a held Snag in one zone', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    for (let index = 0; index < 60 && !(scene.discardChoiceModule && scene.returnChoiceModule); index += 1) await wait(50);
    const base = scene.hand[0];
    const make = (instanceId: string, name: string, heldEffects: string[] = []) => ({
      ...base,
      instanceId,
      id: instanceId,
      name,
      cost: 0,
      target: 'self',
      runtime: { ...base.runtime, id: instanceId, displayName: name, kind: heldEffects.length ? 'snag' : 'crew', suit: null, cost: 0, target: 'self', tags: heldEffects.length ? ['snag'] : [], effects: [], heldEffects, moltEffects: [], upgrade: { ...base.runtime.upgrade, effects: [], moltEffects: [] } },
    });

    const held = make('supply-held', 'Supply Held');
    const drawA = make('supply-draw-a', 'Supply Draw A');
    const drawB = make('supply-draw-b', 'Supply Draw B');
    scene.hand = [held];
    scene.drawPile = [drawA, drawB];
    scene.discardPile = [];
    scene.runSupplies = ['mirror_shard'];
    scene.pendingSupplyRepeats = 0;
    scene.mode = 'battle';
    scene.combatAnimationPending = false;
    scene.useSupply(0);
    await wait(30);
    const beforeSupplyConfirm = {
      supplies: [...scene.runSupplies],
      candidates: [...scene.discardChoice.candidateIds],
      hand: scene.hand.map((card: any) => card.instanceId),
    };
    scene.onCardClicked('supply-draw-a');
    scene.confirmDiscardChoice();
    await wait(30);
    const afterSupplyConfirm = {
      supplies: [...scene.runSupplies],
      used: [...scene.runSuppliesUsed],
      hand: scene.hand.map((card: any) => card.instanceId),
      discard: scene.discardPile.map((card: any) => card.instanceId),
    };

    const snag = make('held-snag-one-zone', 'Jammed Strap Test', ['discard(1)', 'shuffleSelfToDraw()']);
    const filler = make('held-snag-filler', 'Roost Filler');
    scene.hand = [snag, filler];
    scene.drawPile = [];
    scene.discardPile = [];
    scene.clearedPile = [];
    scene.energy = 0;
    scene.combatAnimationPending = false;
    const turnBefore = scene.turn;
    scene.endTurn({ enemyPacing: false });
    await wait(30);
    const roostChoice = { candidates: [...scene.discardChoice.candidateIds], source: scene.discardChoice.source };
    scene.input.gamepad.emit('down', scene.input.gamepad.pad1, { index: 0 }, 1);
    scene.input.gamepad.emit('down', scene.input.gamepad.pad1, { index: 3 }, 1);
    await wait(30);
    const zones = [...scene.hand, ...scene.drawPile, ...scene.discardPile, ...scene.clearedPile];
    return {
      beforeSupplyConfirm,
      afterSupplyConfirm,
      roostChoice,
      turnBefore,
      turnAfter: scene.turn,
      snagCopies: zones.filter((card: any) => card.instanceId === snag.instanceId).length,
      snagZones: {
        hand: scene.hand.some((card: any) => card.instanceId === snag.instanceId),
        draw: scene.drawPile.some((card: any) => card.instanceId === snag.instanceId),
        discard: scene.discardPile.some((card: any) => card.instanceId === snag.instanceId),
        cleared: scene.clearedPile.some((card: any) => card.instanceId === snag.instanceId),
      },
      choice: scene.discardChoice,
    };
  });

  expect(result.beforeSupplyConfirm.supplies).toEqual(['mirror_shard']);
  expect(result.beforeSupplyConfirm.hand).toEqual(['supply-held', 'supply-draw-a', 'supply-draw-b']);
  expect(result.beforeSupplyConfirm.candidates).toEqual(result.beforeSupplyConfirm.hand);
  expect(result.afterSupplyConfirm.supplies).toEqual([]);
  expect(result.afterSupplyConfirm.used).toContain('mirror_shard');
  expect(result.afterSupplyConfirm.discard).toEqual(['supply-draw-a']);
  expect(result.roostChoice).toEqual({ candidates: ['held-snag-filler'], source: 'Jammed Strap Test' });
  expect(result.turnAfter).toBe(result.turnBefore + 1);
  expect(result.snagCopies).toBe(1);
  expect(Object.values(result.snagZones).filter(Boolean)).toHaveLength(1);
  expect(result.choice).toBeUndefined();
});

test('discard recovery pauses in written order and returns the explicit pointer choice', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);

  const setup = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    for (let index = 0; index < 60 && !(scene.discardChoiceModule && scene.returnChoiceModule); index += 1) await wait(50);
    const base = scene.hand[0];
    const make = (instanceId: string, name: string, effects: string[] = [], type = 'minor') => ({
      ...base,
      instanceId,
      id: instanceId,
      name,
      type,
      role: effects.some((effect) => effect.startsWith('damage')) ? 'attack' : 'utility',
      target: 'self',
      cost: effects.length ? 1 : 0,
      text: effects.join('; '),
      upgradedText: effects.join('; '),
      heldText: '',
      moltText: '',
      moltTextUpgraded: '',
      runtime: {
        ...base.runtime,
        id: instanceId,
        displayName: name,
        kind: type === 'molt' ? 'molt' : 'crew',
        suit: type === 'molt' ? null : 'basins',
        cost: effects.length ? 1 : 0,
        target: 'self',
        role: effects.some((effect) => effect.startsWith('damage')) ? 'attack' : 'utility',
        tags: ['recursion'],
        effects,
        heldEffects: [],
        moltEffects: [],
        upgrade: { ...base.runtime.upgrade, effects, moltEffects: [] },
      },
    });
    const recall = make('return-recall', 'Route Recall', ['discard(1)', 'returnDiscard(nonMolt, +1)', 'heal(2)']);
    const sacrifice = make('return-sacrifice', 'Freshly Discarded');
    const old = make('return-old', 'Old Memory', ['gainCover(3)']);
    const molt = make('return-molt', 'Molt Memory', [], 'molt');
    const drawn = make('return-drawn', 'Follow-up Draw');
    scene.hand = [recall, sacrifice];
    scene.discardPile = [old, molt];
    scene.drawPile = [drawn];
    scene.clearedPile = [];
    scene.energy = 3;
    scene.flock.hp = scene.flock.maxHp - 5;
    scene.mode = 'battle';
    scene.combatAnimationPending = false;
    scene.combatIntroActive = false;
    scene.combatIntroDismissed = true;
    scene.playCard(recall);
    await wait(30);
    scene.onCardClicked(sacrifice.instanceId);
    scene.confirmDiscardChoice();
    await wait(60);
    return {
      ids: { recall: recall.instanceId, sacrifice: sacrifice.instanceId, old: old.instanceId, molt: molt.instanceId, drawn: drawn.instanceId },
      maxHp: scene.flock.maxHp,
    };
  });

  const before = await page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const state = window.__birdSquadState!();
    const panel: any = scene.root.list.find((object: any) => object.name === 'combat-return-choice-panel');
    const rows: any[] = scene.root.list.filter((object: any) => object.name === 'combat-return-choice-row');
    return {
      state,
      panel: panel ? { width: panel.width, height: panel.height } : undefined,
      rows: rows.map((row) => ({ instanceId: row.getData('instanceId'), width: row.width, height: row.height })),
      rowTargetFloor: rows.every((row) => row.height * scene.game.canvas.getBoundingClientRect().height / 720 >= 44),
      rowSeparation: rows.every((row, index) => rows.slice(index + 1).every(other => {
        const a = row.getBounds(), b = other.getBounds();
        return Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom) >= 8;
      })),
      hand: scene.hand.map((card: any) => card.instanceId),
      discard: scene.discardPile.map((card: any) => card.instanceId),
      liveText: document.getElementById('game-status')?.textContent ?? '',
    };
  });
  expect(before.state.returnChoice).toMatchObject({
    source: 'Route Recall', filter: 'nonMolt', drawAfter: 1, required: 1, canCancel: false, focusIndex: 0,
  });
  expect(before.state.returnChoice.candidates.map((card: any) => card.instanceId)).toEqual([
    setup.ids.sacrifice,
    setup.ids.old,
  ]);
  expect(before.state.returnChoice.candidates[0]).toMatchObject({ focused: true, discardOrder: 1 });
  expect(before.state.returnChoice.candidates.some((card: any) => card.instanceId === setup.ids.molt)).toBe(false);
  expect(before.panel).toEqual({ width: 1060, height: 600 });
  expect(before.rows).toEqual([
    { instanceId: setup.ids.sacrifice, width: 448, height: 62 },
    { instanceId: setup.ids.old, width: 448, height: 62 },
  ]);
  expect(before.rowTargetFloor).toBe(true);
  expect(before.rowSeparation).toBe(true);
  expect(before.hand).toEqual([]);
  expect(before.discard).toEqual([setup.ids.old, setup.ids.molt, setup.ids.sacrifice]);
  expect(before.discard).not.toContain(setup.ids.recall);
  // The immediate choice announcement can precede the debounced scene summary.
  // Both convey the mandatory return; do not depend on a narration race.
  await expect(page.locator('#game-status')).toContainText(/requires one card from discard to return|Choose one of 2 eligible discard cards to return for Route Recall\./);

  await page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    scene.input.gamepad.emit('down', scene.input.gamepad.pad1, { index: 1 }, 1);
  });
  await expect.poll(async () => page.evaluate(() => window.__birdSquadState!().returnChoice?.candidates.length)).toBe(2);

  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => page.evaluate(() => window.__birdSquadState!().returnChoice?.focusedId)).toBe(setup.ids.old);
  await expect.poll(async () => page.locator('#game-status').textContent()).toContain('Focused Old Memory');
  await page.locator('canvas').screenshot({ path: '.artifacts/test-results/return-choice-1000x560.png' });
  await page.evaluate((instanceId) => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const row: any = scene.root.list.find((object: any) => object.name === 'combat-return-choice-row' && object.getData('instanceId') === instanceId);
    row.emit('pointerdown');
    scene.root.getByName('combat-return-choice-confirm').emit('pointerdown');
  }, setup.ids.old);

  const after = await page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    return {
      state: window.__birdSquadState!(),
      hp: scene.flock.hp,
      hand: scene.hand.map((card: any) => card.instanceId),
      discard: scene.discardPile.map((card: any) => card.instanceId),
      log: [...scene.log],
    };
  });
  expect(after.state.returnChoice).toBeUndefined();
  expect(after.hp).toBe(setup.maxHp - 3);
  expect(after.hand).toEqual([setup.ids.old, setup.ids.drawn]);
  expect(after.discard).toEqual([setup.ids.molt, setup.ids.sacrifice, setup.ids.recall]);
  expect(after.log.findIndex((entry: string) => entry.includes('Freshly Discarded discarded')))
    .toBeLessThan(after.log.findIndex((entry: string) => entry.includes('Old Memory returns')));
  expect(after.log.findIndex((entry: string) => entry.includes('Old Memory returns')))
    .toBeLessThan(after.log.findIndex((entry: string) => entry.includes('Route memory draws 1')));
});

test('Return Ticket waits for controller choice, closes its drawer, and handles an empty eligible pile', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    for (let index = 0; index < 60 && !(scene.discardChoiceModule && scene.returnChoiceModule); index += 1) await wait(50);
    const base = scene.hand[0];
    const make = (instanceId: string, name: string, effects: string[] = [], type = 'minor') => ({
      ...base,
      instanceId,
      id: instanceId,
      name,
      type,
      role: 'utility',
      target: 'self',
      cost: 0,
      text: effects.join('; '),
      runtime: {
        ...base.runtime,
        id: instanceId,
        displayName: name,
        kind: type === 'molt' ? 'molt' : 'crew',
        suit: type === 'molt' ? null : 'basins',
        cost: 0,
        target: 'self',
        role: 'utility',
        tags: ['recursion'],
        effects,
        heldEffects: [],
        moltEffects: [],
        upgrade: { ...base.runtime.upgrade, effects, moltEffects: [] },
      },
    });
    const held = make('ticket-held', 'Held Card');
    const old = make('ticket-old', 'Older Recall');
    const newer = make('ticket-newer', 'Newer Recall');
    const molt = make('ticket-molt', 'Molt Recall', [], 'molt');
    const drawn = make('ticket-drawn', 'Ticket Draw');
    scene.hand = [held];
    scene.discardPile = [old, molt, newer];
    scene.drawPile = [drawn];
    scene.runSupplies = ['return_ticket'];
    scene.runSuppliesUsed = [];
    scene.supplyDrawerOpen = true;
    scene.pendingSupplyRepeats = 0;
    scene.mode = 'battle';
    scene.combatAnimationPending = false;
    scene.combatIntroActive = false;
    scene.combatIntroDismissed = true;
    scene.useSupply(0);
    await wait(40);
    const pending = {
      drawerOpen: scene.supplyDrawerOpen,
      supplies: [...scene.runSupplies],
      used: [...scene.runSuppliesUsed],
      candidates: [...scene.returnChoice.candidateIds],
      focusIndex: scene.returnChoice.focusIndex,
    };
    scene.input.gamepad.emit('down', scene.input.gamepad.pad1, { index: 15 }, 1);
    await wait(20);
    const movedFocus = scene.returnChoice.focusIndex;
    scene.input.gamepad.emit('down', scene.input.gamepad.pad1, { index: 1 }, 1);
    await wait(20);
    const afterBack = { exists: Boolean(scene.returnChoice), supplies: [...scene.runSupplies] };
    scene.input.gamepad.emit('down', scene.input.gamepad.pad1, { index: 0 }, 1);
    await wait(50);
    const committed = {
      choice: scene.returnChoice,
      supplies: [...scene.runSupplies],
      used: [...scene.runSuppliesUsed],
      hand: scene.hand.map((card: any) => card.instanceId),
      discard: scene.discardPile.map((card: any) => card.instanceId),
    };

    const emptyRecall = make('empty-recall', 'Empty Recall', ['returnDiscard(nonMolt, 0)', 'heal(2)']);
    scene.hand = [emptyRecall];
    scene.discardPile = [molt];
    scene.drawPile = [];
    scene.flock.hp = scene.flock.maxHp - 4;
    scene.energy = 3;
    scene.combatAnimationPending = false;
    scene.playCard(emptyRecall);
    await wait(30);
    const empty = {
      choice: scene.returnChoice,
      hp: scene.flock.hp,
      maxHp: scene.flock.maxHp,
      hand: scene.hand.map((card: any) => card.instanceId),
      discard: scene.discardPile.map((card: any) => card.instanceId),
      noMatchLogged: scene.log.some((entry: string) => entry.includes('No route memory is ready to return')),
    };
    return { ids: { held: held.instanceId, old: old.instanceId, newer: newer.instanceId, molt: molt.instanceId, drawn: drawn.instanceId, emptyRecall: emptyRecall.instanceId }, pending, movedFocus, afterBack, committed, empty };
  });

  expect(result.pending).toEqual({
    drawerOpen: false,
    supplies: ['return_ticket'],
    used: [],
    candidates: [result.ids.newer, result.ids.old],
    focusIndex: 0,
  });
  expect(result.movedFocus).toBe(1);
  expect(result.afterBack).toEqual({ exists: true, supplies: ['return_ticket'] });
  expect(result.committed.choice).toBeUndefined();
  expect(result.committed.supplies).toEqual([]);
  expect(result.committed.used).toEqual(['return_ticket']);
  expect(result.committed.hand).toEqual([result.ids.held, result.ids.old, result.ids.drawn]);
  expect(result.committed.discard).toEqual([result.ids.molt, result.ids.newer]);
  expect(result.empty).toMatchObject({ choice: undefined, hp: result.empty.maxHp - 2, hand: [], noMatchLogged: true });
  expect(result.empty.discard).toEqual([result.ids.molt, result.ids.emptyRecall]);
});

test('a combat route node resolves through its encounter', async ({ page }) => {
  test.setTimeout(120_000);
  // These independent snapshots must all be checked even when one effect
  // regresses. Soft assertions still fail the test; they expose the full set.
  const expect = test.expect.configure({ soft: true });
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    const hpBefore = enemy.hp;
    scene.damageEnemy(enemy.id, 3, 'Smoke impact check');
    const state = window.__birdSquadState!();
    return {
      enemies: state.enemies.map((e: any) => e.name),
      battleHudRail: state.battleHudRail,
      enemyIntentRing: state.enemyIntentRing,
      combatEncounterIntro: state.combatEncounterIntro,
      combatImpactFlash: state.combatImpactFlash,
      combatPlayerHitConfirm: state.combatPlayerHitConfirm,
      damage: hpBefore - enemy.hp,
      numberDamage: scene.fxLayer.list.find((child: any) => child.name === 'combat-number-feedback'
        && child.getData('target') === enemy.id && child.getData('kind') === 'damage')?.getData('amount'),
      combatActionTrail: state.combatActionTrail,
      combatCastFocusBurst: state.combatCastFocusBurst,
      combatWingbeatSpend: state.combatWingbeatSpend,
      combatEnemySwipe: state.combatEnemySwipe,
      combatFlockImpactBurst: state.combatFlockImpactBurst,
      combatCoverGuard: state.combatCoverGuard,
      combatCoverBlockBurst: state.combatCoverBlockBurst,
      combatEnemyCoverBlock: state.combatEnemyCoverBlock,
      combatPerfectBraceRiposte: state.combatPerfectBraceRiposte,
      combatHealBloom: state.combatHealBloom,
      combatEnemyMend: state.combatEnemyMend,
      combatEnemyCover: state.combatEnemyCover,
      combatCoverShatter: state.combatCoverShatter,
      combatCardDraw: state.combatCardDraw,
      combatDiscardSweep: state.combatDiscardSweep,
      combatShuffleVortex: state.combatShuffleVortex,
      combatFouledPressure: state.combatFouledPressure,
      combatRuffledBreak: state.combatRuffledBreak,
      combatResonanceSurge: state.combatResonanceSurge,
      combatResonanceSpend: state.combatResonanceSpend,
      combatWingbeatSurge: state.combatWingbeatSurge,
      combatWingbeatDrain: state.combatWingbeatDrain,
      combatWindedGust: state.combatWindedGust,
      combatFlowSurge: state.combatFlowSurge,
      combatCleanseBurst: state.combatCleanseBurst,
      combatBankCache: state.combatBankCache,
      combatThreatCharge: state.combatThreatCharge,
      combatEnemyRecoveryAfterglow: state.combatEnemyRecoveryAfterglow,
      combatMoltShift: state.combatMoltShift,
      combatOpenSkyGuard: state.combatOpenSkyGuard,
      combatOpenSkyExposure: state.combatOpenSkyExposure,
      combatVictoryRally: state.combatVictoryRally,
      combatVictoryFanfareSigil: state.combatVictoryFanfareSigil,
      combatAtmosphereStrip: state.combatAtmosphereStrip,
      combatCardBack: state.combatCardBack,
      combatTargetReticle: state.combatTargetReticle,
      combatTargetLockPulse: state.combatTargetLockPulse,
    };
  });
  const castResult = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatActionTrailBursts = 0;
    scene.combatCastFocusBurstBursts = 0;
    scene.combatWingbeatSpendBursts = 0;
    scene.energy = 99;
    const paidCard = scene.hand.find((candidate: any) => scene.effectiveCost(candidate) > 0) ?? scene.hand[0];
    const spendCost = scene.effectiveCost(paidCard);
    scene.playCard(paidCard, scene.enemies.find((candidate: any) => candidate.hp > 0).id);
    await wait(350);
    const state = window.__birdSquadState!();
    return {
      hand: state.hand.length,
      spendCost,
      played: scene.statCardsPlayed,
      playedCardInHand: scene.hand.some((candidate: any) => candidate.instanceId === paidCard.instanceId),
      playedCardInDiscard: scene.discardPile.some((candidate: any) => candidate.instanceId === paidCard.instanceId),
      combatActionTrail: state.combatActionTrail,
      combatCastFocusBurst: state.combatCastFocusBurst,
      combatWingbeatSpend: state.combatWingbeatSpend,
    };
  });
  const deferredOutcomeResult = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const keys = ['combat-victory-rally', 'combat-victory-fanfare-sigil', 'combat-boss-phase-break'];
    const before = keys.map((key) => scene.textures.exists(key));
    scene.energy = 99;
    const card = scene.hand[0];
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.playCardAnimated(card, enemy.id);
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (keys.every((key) => scene.textures.exists(key))) break;
      await wait(25);
    }
    return { before, after: keys.map((key) => scene.textures.exists(key)) };
  });
  const enemySwipeResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatEnemySwipeBursts = 0;
    scene.combatFlockImpactBurstBursts = 0;
    scene.flock.block = 0;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.damageFlock(enemy, 7);
    const state = window.__birdSquadState!();
    return {
      flockHp: state.flock.hp,
      flockMaxHp: state.flock.maxHp,
      combatEnemySwipe: state.combatEnemySwipe,
      combatEnemyImpactContact: state.combatEnemyImpactContact,
      combatFlockImpactBurst: state.combatFlockImpactBurst,
    };
  });
  const coverGuardResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatCoverGuardBursts = 0;
    scene.combatCoverBlockBurstBursts = 0;
    scene.flock.block = 99;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.damageFlock(enemy, 7);
    const state = window.__birdSquadState!();
    return {
      flockHp: state.flock.hp,
      flockMaxHp: state.flock.maxHp,
      flockBlock: state.flock.block,
      combatCoverGuard: state.combatCoverGuard,
      combatCoverBlockBurst: state.combatCoverBlockBurst,
      log: state.log,
    };
  });
  const coverBuildResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatCoverGuardBursts = 0;
    scene.flock.block = 0;
    scene.gainBlock(6, 'Smoke cover build check');
    const state = window.__birdSquadState!();
    return {
      flockBlock: state.flock.block,
      combatCoverGuard: state.combatCoverGuard,
    };
  });
  const enemyCoverBlockResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatEnemyCoverBlockBursts = 0;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    enemy.block = 12;
    scene.firstAttackThisTurn = false;
    const hpBefore = enemy.hp;
    const blockBefore = enemy.block;
    const audioBefore = JSON.parse(window.render_game_to_text!()).audio?.cueRequests?.coverBlock ?? 0;
    scene.damageEnemy(enemy.id, 5, 'Smoke cover block check');
    const state = window.__birdSquadState!();
    return {
      hpBefore,
      hpAfter: state.enemies.find((candidate: any) => candidate.id === enemy.id)?.hp,
      blockBefore,
      blockAfter: state.enemies.find((candidate: any) => candidate.id === enemy.id)?.block,
      combatEnemyCoverBlock: state.combatEnemyCoverBlock,
      coverBlockCueBefore: audioBefore,
      coverBlockCueAfter: state.audio?.cueRequests?.coverBlock ?? 0,
    };
  });
  const healBloomResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatHealBloomBursts = 0;
    scene.flock.hp = Math.max(1, scene.flock.maxHp - 9);
    scene.healFlock(5, 'Smoke heal check');
    const state = window.__birdSquadState!();
    return {
      flockHp: state.flock.hp,
      flockMaxHp: state.flock.maxHp,
      combatHealBloom: state.combatHealBloom,
    };
  });
  const resonanceSurgeResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatResonanceSurgeBursts = 0;
    scene.spark = 0;
    scene.gainResonance(2);
    const state = window.__birdSquadState!();
    return {
      resonance: state.resonance,
      combatResonanceSurge: state.combatResonanceSurge,
    };
  });
  const cardDrawResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatCardDrawBursts = 0;
    const handBefore = scene.hand.length;
    const drawBefore = scene.drawPile.length;
    scene.drawCards(1);
    const state = window.__birdSquadState!();
    return {
      handBefore,
      drawBefore,
      handAfter: state.hand.length,
      drawAfter: state.drawPile,
      combatCardDraw: state.combatCardDraw,
      cardObjects: Boolean(scene.cardObjects),
      transfers: scene.fxLayer.list.filter((child: any) => child.name === 'combat-pile-transfer').map((child: any) => child.getData('kind')),
    };
  });
  const discardSweepResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatDiscardSweepBursts = 0;
    const handBefore = scene.hand.length;
    const discardBefore = scene.discardPile.length;
    const discarded = scene.discardCards(1);
    const state = window.__birdSquadState!();
    return {
      handBefore,
      discardBefore,
      discarded,
      handAfter: state.hand.length,
      discardAfter: state.discardPile,
      combatDiscardSweep: state.combatDiscardSweep,
      cardObjects: Boolean(scene.cardObjects),
      transfers: scene.fxLayer.list.filter((child: any) => child.name === 'combat-pile-transfer').map((child: any) => child.getData('kind')),
    };
  });
  const shuffleVortexResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatShuffleVortexBursts = 0;
    const seed = scene.hand.splice(0, 2);
    scene.drawPile = [];
    scene.discardPile = seed;
    const discardBefore = scene.discardPile.length;
    const handBefore = scene.hand.length;
    scene.drawCards(1);
    const state = window.__birdSquadState!();
    return {
      discardBefore,
      handBefore,
      handAfter: state.hand.length,
      drawAfter: state.drawPile,
      discardAfter: state.discardPile,
      combatShuffleVortex: state.combatShuffleVortex,
      cardObjects: Boolean(scene.cardObjects),
      transfers: scene.fxLayer.list.filter((child: any) => child.name === 'combat-pile-transfer').map((child: any) => child.getData('kind')),
    };
  });
  const ruffledBreakResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatRuffledBreakBursts = 0;
    scene.flock.frail = 0;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.resolveEnemyEffect(enemy, 'applyFrail(flock, 2)');
    const state = window.__birdSquadState!();
    return {
      statuses: state.flock.statuses,
      combatRuffledBreak: state.combatRuffledBreak,
    };
  });
  const resonanceSpendResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatResonanceSpendBursts = 0;
    scene.spark = 3;
    const spent = scene.spendResonance(2);
    const state = window.__birdSquadState!();
    return {
      spent,
      resonance: state.resonance,
      combatResonanceSpend: state.combatResonanceSpend,
    };
  });
  const wingbeatSurgeResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatWingbeatSurgeBursts = 0;
    scene.energy = 3;
    scene.applySupplyEffect('gainWingbeat(2)', 'Smoke wingbeat check');
    const state = window.__birdSquadState!();
    return {
      energy: state.energy,
      combatWingbeatSurge: state.combatWingbeatSurge,
    };
  });
  const wingbeatDrainResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatWingbeatDrainBursts = 0;
    scene.energy = 3;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.nextTurnEnergyBonus = 0;
    scene.resolveEnemyEffect(enemy, 'loseWingbeat(flock, 2)');
    const state = window.__birdSquadState!();
    return {
      energy: state.energy,
      nextTurnEnergyBonus: scene.nextTurnEnergyBonus,
      combatWingbeatDrain: state.combatWingbeatDrain,
    };
  });
  const windedGustResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatWindedGustBursts = 0;
    scene.flock.weak = 0;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.resolveEnemyEffect(enemy, 'applyWinded(flock, 2)');
    const state = window.__birdSquadState!();
    return {
      statuses: state.flock.statuses,
      combatWindedGust: state.combatWindedGust,
    };
  });
  const flowSurgeResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatFlowSurgeBursts = 0;
    scene.flock.flow = 0;
    scene.buildFlow({ builtFlow: false });
    const state = window.__birdSquadState!();
    return {
      flow: state.flow,
      combatFlowSurge: state.combatFlowSurge,
    };
  });
  const cleanseBurstResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatCleanseBurstBursts = 0;
    scene.flock.weak = 2;
    scene.flock.frail = 1;
    scene.flock.fouled = 1;
    scene.cleanseFlock(2, 'Smoke cleanse check');
    const state = window.__birdSquadState!();
    return {
      statuses: state.flock.statuses,
      combatCleanseBurst: state.combatCleanseBurst,
    };
  });
  const bankCacheResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatBankCacheBursts = 0;
    scene.nextTurnEnergyBonus = 0;
    scene.nextTurnDrawBonus = 0;
    scene.pendingRetainHand = 0;
    scene.applySupplyEffect('gainEnergyNextTurn(2)', 'Smoke bank check');
    scene.applySupplyEffect('nextTurnDraw(1)', 'Smoke bank check');
    scene.applySupplyEffect('retainHand(1)', 'Smoke bank check');
    const state = window.__birdSquadState!();
    return {
      nextEnergy: scene.nextTurnEnergyBonus,
      nextDraw: scene.nextTurnDrawBonus,
      retain: scene.pendingRetainHand,
      combatBankCache: state.combatBankCache,
    };
  });
  const threatChargeResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatThreatChargeBursts = 0;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    enemy.nextAttackBonus = 0;
    scene.resolveEnemyEffect(enemy, 'nextAttackBonus(3)');
    const state = window.__birdSquadState!();
    return {
      nextAttackBonus: enemy.nextAttackBonus,
      intentDamage: scene.incomingAttackDamage(enemy),
      combatThreatCharge: state.combatThreatCharge,
    };
  });
  const moltShiftResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatMoltShiftBursts = 0;
    scene.flock.molt = false;
    scene.enterMolt('Smoke molt check');
    const state = window.__birdSquadState!();
    return {
      statuses: state.flock.statuses,
      combatMoltShift: state.combatMoltShift,
    };
  });
  const openSkyGuardGainResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatOpenSkyGuardBursts = 0;
    scene.flock.openSkyGuard = 0;
    scene.gainOpenSkyGuard(2, 'Smoke sky guard check');
    const state = window.__birdSquadState!();
    return {
      statuses: state.flock.statuses,
      combatOpenSkyGuard: state.combatOpenSkyGuard,
    };
  });
  const openSkyExposureResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatOpenSkyExposureBursts = 0;
    scene.flock.exposed = false;
    scene.flock.exposedTurns = 0;
    scene.enterOpenSky(2, 'Smoke Open Sky check leaves the flock in Open Sky.');
    const state = window.__birdSquadState!();
    return {
      statuses: state.flock.statuses,
      combatOpenSkyExposure: state.combatOpenSkyExposure,
    };
  });
  const openSkyGuardConsumeResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatOpenSkyGuardBursts = 0;
    scene.flock.exposed = true;
    scene.flock.exposedTurns = 1;
    scene.flock.openSkyGuard = 1;
    scene.flock.block = 0;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.damageFlock(enemy, 0);
    const state = window.__birdSquadState!();
    return {
      guardRemaining: scene.flock.openSkyGuard,
      combatOpenSkyGuard: state.combatOpenSkyGuard,
    };
  });
  const defeatResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatDefeatBurstBursts = 0;
    const enemy = scene.enemies.find((candidate: any) => candidate.hp > 0);
    scene.damageEnemy(enemy.id, enemy.maxHp + 8, 'Smoke defeat check', undefined, true);
    const state = window.__birdSquadState!();
    return {
      enemies: state.enemies.map((e: any) => ({ name: e.name, hp: e.hp })),
      combatDefeatBurst: state.combatDefeatBurst,
    };
  });
  const victoryResult = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.queueOutcomeCombatFxAssetLoad();
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (scene.textures.exists('combat-victory-rally') && scene.textures.exists('combat-victory-fanfare-sigil')) break;
      await wait(25);
    }
    scene.fxLayer.removeAll(true);
    scene.combatVictoryRallyBursts = 0;
    scene.combatVictoryFanfareSigilBursts = 0;
    const audioBefore = JSON.parse(window.render_game_to_text!()).audio;
    const fanfareBefore = audioBefore?.cueRequests?.victoryFanfare ?? 0;
    scene.enemies.forEach((enemy: any) => { enemy.hp = 0; });
    scene.checkOutcome();
    const state = window.__birdSquadState!();
    return {
      mode: state.mode,
      enemies: state.enemies.map((e: any) => ({ name: e.name, hp: e.hp })),
      combatVictoryRally: state.combatVictoryRally,
      combatVictoryFanfareSigil: state.combatVictoryFanfareSigil,
      fanfareBefore,
      fanfareAfter: state.audio?.cueRequests?.victoryFanfare ?? 0,
    };
  });
  const turnBannerResult = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    scene.fxLayer.removeAll(true);
    scene.combatTurnBannerBursts = 0;
    scene.endTurn();
    const state = window.__birdSquadState!();
    return {
      turn: state.turn,
      combatTurnBanner: state.combatTurnBanner,
    };
  });
  expect(result.enemies).toContain('Roof Rat');
  expect(result.battleHudRail.loaded).toBe(true);
  expect(result.battleHudRail.rendered).toBe(false);
  expect(result.enemyIntentRing.loaded).toBe(true);
  // The quiet foreground intentionally replaces the decorative ring with one
  // grounded vector reticle. Verify the live replacement, not retired artwork.
  expect(result.enemyIntentRing.rendered).toBe(false);
  expect(result.enemyIntentRing.count).toBe(0);
  expect(result.combatTargetReticle.rendered).toBe(true);
  expect(result.combatTargetReticle.count).toBe(1);
  expect(result.combatEncounterIntro.loaded).toBe(true);
  expect(result.combatEncounterIntro.rendered).toBe(false);
  expect(result.combatEncounterIntro.count).toBe(0);
  expect(result.combatEncounterIntro.bursts).toBeGreaterThanOrEqual(1);
  expect(result.combatImpactFlash.loaded).toBe(true);
  // One compact contact and exact number replace the redundant full hit flash.
  expect(result.combatImpactFlash.rendered).toBe(false);
  expect(result.combatImpactFlash.count).toBe(0);
  expect(result.combatImpactFlash.bursts).toBe(0);
  expect(result.combatPlayerHitConfirm.loaded).toBe(true);
  expect(result.combatPlayerHitConfirm.rendered).toBe(true);
  expect(result.combatPlayerHitConfirm.bursts).toBe(1);
  expect(result.numberDamage).toBe(result.damage);
  expect(result.damage).toBeGreaterThan(0);
  expect(result.combatActionTrail.loaded).toBe(true);
  expect(result.combatCastFocusBurst.loaded).toBe(true);
  expect(result.combatWingbeatSpend.loaded).toBe(true);
  expect(result.combatEnemySwipe.loaded).toBe(true);
  expect(result.combatFlockImpactBurst.loaded).toBe(true);
  expect(result.combatCoverGuard.loaded).toBe(true);
  expect(result.combatCoverBlockBurst.loaded).toBe(true);
  expect(result.combatEnemyCoverBlock.loaded).toBe(true);
  expect(result.combatPerfectBraceRiposte.loaded).toBe(true);
  expect(result.combatHealBloom.loaded).toBe(true);
  expect(result.combatEnemyMend.loaded).toBe(true);
  expect(result.combatEnemyCover.loaded).toBe(true);
  expect(result.combatCoverShatter.loaded).toBe(true);
  expect(result.combatCardDraw.loaded).toBe(true);
  expect(result.combatDiscardSweep.loaded).toBe(true);
  expect(result.combatShuffleVortex.loaded).toBe(true);
  expect(result.combatFouledPressure.loaded).toBe(true);
  expect(result.combatRuffledBreak.loaded).toBe(true);
  expect(result.combatResonanceSurge.loaded).toBe(true);
  expect(result.combatResonanceSpend.loaded).toBe(true);
  expect(result.combatWingbeatSurge.loaded).toBe(true);
  expect(result.combatWingbeatDrain.loaded).toBe(true);
  expect(result.combatWindedGust.loaded).toBe(true);
  expect(result.combatFlowSurge.loaded).toBe(true);
  expect(result.combatCleanseBurst.loaded).toBe(true);
  expect(result.combatBankCache.loaded).toBe(true);
  expect(result.combatThreatCharge.loaded).toBe(true);
  expect(result.combatEnemyRecoveryAfterglow.loaded).toBe(true);
  expect(result.combatMoltShift.loaded).toBe(true);
  expect(result.combatOpenSkyGuard.loaded).toBe(true);
  expect(result.combatOpenSkyExposure.loaded).toBe(true);
  expect(result.combatVictoryRally.loaded).toBe(false);
  expect(result.combatVictoryFanfareSigil.loaded).toBe(false);
  expect(result.combatAtmosphereStrip.loaded).toBe(true);
  expect(result.combatAtmosphereStrip.rendered).toBe(true);
  expect(result.combatAtmosphereStrip.count).toBeGreaterThanOrEqual(21);
  expect(result.combatCardBack.loaded).toBe(true);
  expect(result.combatCardBack.rendered).toBe(true);
  expect(result.combatCardBack.count).toBeGreaterThanOrEqual(2);
  expect(result.combatTargetReticle.loaded).toBe(true);
  expect(result.combatTargetReticle.rendered).toBe(true);
  expect(result.combatTargetReticle.count).toBe(1);
  expect(result.combatTargetLockPulse.loaded).toBe(true);
  expect(result.combatTargetLockPulse.rendered).toBe(false);
  expect(result.combatTargetLockPulse.count).toBe(0);
  expect(castResult.hand).toBeGreaterThanOrEqual(0);
  expect(castResult.spendCost).toBeGreaterThan(0);
  expect(castResult.played).toBe(1);
  expect(castResult.playedCardInHand).toBe(false);
  expect(castResult.playedCardInDiscard).toBe(true);
  expect(castResult.combatActionTrail.loaded).toBe(true);
  expect(castResult.combatActionTrail.rendered).toBe(false);
  expect(castResult.combatActionTrail.count).toBe(0);
  expect(castResult.combatActionTrail.bursts).toBe(0);
  expect(castResult.combatCastFocusBurst.loaded).toBe(true);
  expect(castResult.combatWingbeatSpend.loaded).toBe(true);
  expect(castResult.combatWingbeatSpend.rendered).toBe(true);
  expect(castResult.combatWingbeatSpend.count).toBeGreaterThanOrEqual(1);
  expect(castResult.combatWingbeatSpend.bursts).toBeGreaterThanOrEqual(1);
  expect(deferredOutcomeResult.before).toEqual([false, false, false]);
  expect(deferredOutcomeResult.after).toEqual([true, true, true]);
  expect(enemySwipeResult.flockHp).toBeLessThan(enemySwipeResult.flockMaxHp);
  expect(enemySwipeResult.combatEnemySwipe.loaded).toBe(true);
  expect(enemySwipeResult.combatEnemySwipe.rendered).toBe(true);
  expect(enemySwipeResult.combatEnemySwipe.count).toBeGreaterThanOrEqual(1);
  expect(enemySwipeResult.combatEnemySwipe.bursts).toBeGreaterThanOrEqual(1);
  expect(enemySwipeResult.combatFlockImpactBurst.loaded).toBe(true);
  expect(enemySwipeResult.combatFlockImpactBurst.rendered).toBe(false);
  expect(enemySwipeResult.combatFlockImpactBurst.count).toBe(0);
  expect(enemySwipeResult.combatFlockImpactBurst.bursts).toBe(0);
  expect(enemySwipeResult.combatEnemyImpactContact.rendered).toBe(true);
  expect(enemySwipeResult.combatEnemyImpactContact.count).toBe(1);
  expect(coverGuardResult.flockHp).toBe(coverGuardResult.flockMaxHp);
  expect(coverGuardResult.flockBlock).toBeLessThan(99);
  expect(coverGuardResult.combatCoverGuard.loaded).toBe(true);
  expect(coverGuardResult.combatCoverGuard.rendered).toBe(true);
  expect(coverGuardResult.combatCoverGuard.count).toBeGreaterThanOrEqual(1);
  expect(coverGuardResult.combatCoverGuard.bursts).toBeGreaterThanOrEqual(1);
  expect(coverGuardResult.combatCoverBlockBurst.loaded).toBe(true);
  expect(coverGuardResult.combatCoverBlockBurst.rendered).toBe(true);
  expect(coverGuardResult.combatCoverBlockBurst.count).toBeGreaterThanOrEqual(1);
  expect(coverGuardResult.combatCoverBlockBurst.bursts).toBeGreaterThanOrEqual(1);
  expect(coverGuardResult.log).toContain(`Roof Rat's hit is blocked. Strike 6: Cover absorbed ${99 - coverGuardResult.flockBlock}; no Cohesion lost.`);
  expect(coverGuardResult.log.some((entry: string) => entry.includes('hits the flock for 0'))).toBe(false);
  expect(coverBuildResult.flockBlock).toBeGreaterThanOrEqual(6);
  expect(coverBuildResult.combatCoverGuard.loaded).toBe(true);
  expect(coverBuildResult.combatCoverGuard.rendered).toBe(true);
  expect(coverBuildResult.combatCoverGuard.count).toBeGreaterThanOrEqual(1);
  expect(coverBuildResult.combatCoverGuard.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyCoverBlockResult.hpAfter).toBe(enemyCoverBlockResult.hpBefore);
  expect(enemyCoverBlockResult.blockAfter).toBeLessThan(enemyCoverBlockResult.blockBefore);
  expect(enemyCoverBlockResult.combatEnemyCoverBlock.loaded).toBe(true);
  expect(enemyCoverBlockResult.combatEnemyCoverBlock.rendered).toBe(true);
  expect(enemyCoverBlockResult.combatEnemyCoverBlock.count).toBeGreaterThanOrEqual(1);
  expect(enemyCoverBlockResult.combatEnemyCoverBlock.bursts).toBeGreaterThanOrEqual(1);
  expect(enemyCoverBlockResult.coverBlockCueAfter).toBeGreaterThan(enemyCoverBlockResult.coverBlockCueBefore);
  expect(healBloomResult.flockHp).toBe(healBloomResult.flockMaxHp - 4);
  expect(healBloomResult.combatHealBloom.loaded).toBe(true);
  expect(healBloomResult.combatHealBloom.rendered).toBe(true);
  expect(healBloomResult.combatHealBloom.count).toBeGreaterThanOrEqual(1);
  expect(healBloomResult.combatHealBloom.bursts).toBeGreaterThanOrEqual(1);
  expect(resonanceSurgeResult.resonance).toBe(2);
  expect(resonanceSurgeResult.combatResonanceSurge.loaded).toBe(true);
  expect(resonanceSurgeResult.combatResonanceSurge.rendered).toBe(true);
  expect(resonanceSurgeResult.combatResonanceSurge.count).toBeGreaterThanOrEqual(1);
  expect(resonanceSurgeResult.combatResonanceSurge.bursts).toBeGreaterThanOrEqual(1);
  expect(cardDrawResult.drawBefore).toBeGreaterThanOrEqual(1);
  expect(cardDrawResult.handAfter).toBe(cardDrawResult.handBefore + 1);
  expect(cardDrawResult.drawAfter).toBe(cardDrawResult.drawBefore - 1);
  expect(cardDrawResult.combatCardDraw.loaded).toBe(true);
  // Actual dock-to-hand transfers replace the decorative pile splashes.
  expect(cardDrawResult.combatCardDraw.rendered).toBe(false);
  expect(cardDrawResult.combatCardDraw.count).toBe(0);
  expect(cardDrawResult.combatCardDraw.bursts).toBe(0);
  // Once the card-object stage is up the drawn card itself flies in; the
  // stand-in card back remains only as the fallback before it has loaded.
  expect(cardDrawResult.transfers).toEqual(cardDrawResult.cardObjects ? [] : ['draw']);
  expect(discardSweepResult.handBefore).toBeGreaterThanOrEqual(1);
  expect(discardSweepResult.discarded).toBe(1);
  expect(discardSweepResult.handAfter).toBe(discardSweepResult.handBefore - 1);
  expect(discardSweepResult.discardAfter).toBe(discardSweepResult.discardBefore + 1);
  expect(discardSweepResult.combatDiscardSweep.loaded).toBe(true);
  expect(discardSweepResult.combatDiscardSweep.rendered).toBe(false);
  expect(discardSweepResult.combatDiscardSweep.count).toBe(0);
  expect(discardSweepResult.combatDiscardSweep.bursts).toBe(0);
  expect(discardSweepResult.transfers).toEqual(discardSweepResult.cardObjects ? [] : ['discard']);
  expect(shuffleVortexResult.discardBefore).toBe(2);
  expect(shuffleVortexResult.handAfter).toBe(shuffleVortexResult.handBefore + 1);
  expect(shuffleVortexResult.drawAfter).toBe(1);
  expect(shuffleVortexResult.discardAfter).toBe(0);
  expect(shuffleVortexResult.combatShuffleVortex.loaded).toBe(true);
  expect(shuffleVortexResult.combatShuffleVortex.rendered).toBe(false);
  expect(shuffleVortexResult.combatShuffleVortex.count).toBe(0);
  expect(shuffleVortexResult.combatShuffleVortex.bursts).toBe(0);
  expect(shuffleVortexResult.transfers).toEqual(shuffleVortexResult.cardObjects ? ['shuffle'] : ['shuffle', 'draw']);
  expect(ruffledBreakResult.statuses).toContain('Ruffled 2');
  expect(ruffledBreakResult.combatRuffledBreak.loaded).toBe(true);
  expect(ruffledBreakResult.combatRuffledBreak.rendered).toBe(true);
  expect(ruffledBreakResult.combatRuffledBreak.count).toBeGreaterThanOrEqual(1);
  expect(ruffledBreakResult.combatRuffledBreak.bursts).toBeGreaterThanOrEqual(1);
  expect(resonanceSpendResult.spent).toBe(true);
  expect(resonanceSpendResult.resonance).toBe(1);
  expect(resonanceSpendResult.combatResonanceSpend.loaded).toBe(true);
  expect(resonanceSpendResult.combatResonanceSpend.rendered).toBe(true);
  expect(resonanceSpendResult.combatResonanceSpend.count).toBeGreaterThanOrEqual(1);
  expect(resonanceSpendResult.combatResonanceSpend.bursts).toBeGreaterThanOrEqual(1);
  expect(wingbeatSurgeResult.energy).toBe(5);
  expect(wingbeatSurgeResult.combatWingbeatSurge.loaded).toBe(true);
  expect(wingbeatSurgeResult.combatWingbeatSurge.rendered).toBe(true);
  expect(wingbeatSurgeResult.combatWingbeatSurge.count).toBeGreaterThanOrEqual(1);
  expect(wingbeatSurgeResult.combatWingbeatSurge.bursts).toBeGreaterThanOrEqual(1);
  // The enemy tax lands on the next player turn, not the current Wingbeats.
  expect(wingbeatDrainResult.energy).toBe(3);
  expect(wingbeatDrainResult.nextTurnEnergyBonus).toBe(-2);
  expect(wingbeatDrainResult.combatWingbeatDrain.loaded).toBe(true);
  expect(wingbeatDrainResult.combatWingbeatDrain.rendered).toBe(true);
  expect(wingbeatDrainResult.combatWingbeatDrain.count).toBeGreaterThanOrEqual(1);
  expect(wingbeatDrainResult.combatWingbeatDrain.bursts).toBeGreaterThanOrEqual(1);
  expect(windedGustResult.statuses).toContain('Winded 2');
  expect(windedGustResult.combatWindedGust.loaded).toBe(true);
  expect(windedGustResult.combatWindedGust.rendered).toBe(true);
  expect(windedGustResult.combatWindedGust.count).toBeGreaterThanOrEqual(1);
  expect(windedGustResult.combatWindedGust.bursts).toBeGreaterThanOrEqual(1);
  expect(flowSurgeResult.flow).toBe(1);
  expect(flowSurgeResult.combatFlowSurge.loaded).toBe(true);
  expect(flowSurgeResult.combatFlowSurge.rendered).toBe(true);
  expect(flowSurgeResult.combatFlowSurge.count).toBeGreaterThanOrEqual(1);
  expect(flowSurgeResult.combatFlowSurge.bursts).toBeGreaterThanOrEqual(1);
  expect(cleanseBurstResult.statuses).not.toContain('Winded 2');
  expect(cleanseBurstResult.statuses).not.toContain('Ruffled 1');
  expect(cleanseBurstResult.statuses).not.toContain('Fouled 1');
  expect(cleanseBurstResult.combatCleanseBurst.loaded).toBe(true);
  expect(cleanseBurstResult.combatCleanseBurst.rendered).toBe(true);
  expect(cleanseBurstResult.combatCleanseBurst.count).toBeGreaterThanOrEqual(1);
  expect(cleanseBurstResult.combatCleanseBurst.bursts).toBeGreaterThanOrEqual(1);
  expect(bankCacheResult.nextEnergy).toBe(2);
  expect(bankCacheResult.nextDraw).toBe(1);
  expect(bankCacheResult.retain).toBe(1);
  expect(bankCacheResult.combatBankCache.loaded).toBe(true);
  expect(bankCacheResult.combatBankCache.rendered).toBe(true);
  expect(bankCacheResult.combatBankCache.count).toBeGreaterThanOrEqual(1);
  expect(bankCacheResult.combatBankCache.bursts).toBeGreaterThanOrEqual(3);
  expect(threatChargeResult.nextAttackBonus).toBe(3);
  expect(threatChargeResult.intentDamage).toBeGreaterThanOrEqual(3);
  expect(threatChargeResult.combatThreatCharge.loaded).toBe(true);
  expect(threatChargeResult.combatThreatCharge.rendered).toBe(true);
  expect(threatChargeResult.combatThreatCharge.count).toBeGreaterThanOrEqual(1);
  expect(threatChargeResult.combatThreatCharge.bursts).toBeGreaterThanOrEqual(1);
  expect(moltShiftResult.statuses).toContain('Molt');
  expect(moltShiftResult.combatMoltShift.loaded).toBe(true);
  expect(moltShiftResult.combatMoltShift.rendered).toBe(true);
  expect(moltShiftResult.combatMoltShift.count).toBeGreaterThanOrEqual(1);
  expect(moltShiftResult.combatMoltShift.bursts).toBeGreaterThanOrEqual(1);
  expect(openSkyGuardGainResult.statuses).toContain('Open Sky Guard 2');
  expect(openSkyGuardGainResult.combatOpenSkyGuard.loaded).toBe(true);
  expect(openSkyGuardGainResult.combatOpenSkyGuard.rendered).toBe(true);
  expect(openSkyGuardGainResult.combatOpenSkyGuard.count).toBeGreaterThanOrEqual(1);
  expect(openSkyGuardGainResult.combatOpenSkyGuard.bursts).toBeGreaterThanOrEqual(1);
  expect(openSkyExposureResult.statuses).toContain('Open Sky');
  expect(openSkyExposureResult.combatOpenSkyExposure.loaded).toBe(true);
  expect(openSkyExposureResult.combatOpenSkyExposure.rendered).toBe(true);
  expect(openSkyExposureResult.combatOpenSkyExposure.count).toBeGreaterThanOrEqual(1);
  expect(openSkyExposureResult.combatOpenSkyExposure.bursts).toBeGreaterThanOrEqual(1);
  expect(openSkyGuardConsumeResult.guardRemaining).toBe(0);
  expect(openSkyGuardConsumeResult.combatOpenSkyGuard.loaded).toBe(true);
  expect(openSkyGuardConsumeResult.combatOpenSkyGuard.rendered).toBe(true);
  expect(openSkyGuardConsumeResult.combatOpenSkyGuard.count).toBeGreaterThanOrEqual(1);
  expect(openSkyGuardConsumeResult.combatOpenSkyGuard.bursts).toBeGreaterThanOrEqual(1);
  expect(defeatResult.enemies).toContainEqual(expect.objectContaining({ name: 'Roof Rat', hp: 0 }));
  expect(defeatResult.combatDefeatBurst.loaded).toBe(true);
  expect(defeatResult.combatDefeatBurst.rendered).toBe(true);
  expect(defeatResult.combatDefeatBurst.count).toBeGreaterThanOrEqual(1);
  expect(defeatResult.combatDefeatBurst.bursts).toBeGreaterThanOrEqual(1);
  expect(['cardReward', 'waymarkReward', 'upgradeReward', 'runComplete']).toContain(victoryResult.mode);
  expect(victoryResult.enemies.every((enemy: { hp: number }) => enemy.hp <= 0)).toBe(true);
  expect(victoryResult.combatVictoryRally.loaded).toBe(true);
  expect(victoryResult.combatVictoryRally.rendered).toBe(true);
  expect(victoryResult.combatVictoryRally.count).toBeGreaterThanOrEqual(2);
  expect(victoryResult.combatVictoryRally.bursts).toBeGreaterThanOrEqual(1);
  expect(victoryResult.combatVictoryFanfareSigil.loaded).toBe(true);
  expect(victoryResult.combatVictoryFanfareSigil.rendered).toBe(true);
  expect(victoryResult.combatVictoryFanfareSigil.count).toBeGreaterThanOrEqual(2);
  expect(victoryResult.combatVictoryFanfareSigil.bursts).toBeGreaterThanOrEqual(1);
  expect(victoryResult.fanfareAfter).toBeGreaterThan(victoryResult.fanfareBefore);
  expect(turnBannerResult.turn).toBeGreaterThanOrEqual(2);
  expect(turnBannerResult.combatTurnBanner.loaded).toBe(true);
  expect(turnBannerResult.combatTurnBanner.rendered).toBe(false);
  expect(turnBannerResult.combatTurnBanner.count).toBe(0);
  expect(turnBannerResult.combatTurnBanner.bursts).toBeGreaterThanOrEqual(1);
});

test('combat HUD keeps readable metrics without decorative frames', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const state = window.__birdSquadState!();
    const metricTextureKey = 'ui-icon-combat-hud-metric-chip-frame';
    const keystoneTextureKey = 'ui-icon-combat-suit-keystone-chip-frame';
    const beatTextureKey = 'ui-icon-combat-beat-progress-frame';
    const frameObjects = scene.root.list.filter((child: any) => child.texture?.key === metricTextureKey).length;
    const keystoneFrameObjects = scene.root.list.filter((child: any) => child.texture?.key === keystoneTextureKey).length;
    const collectObjects = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collectObjects(child.list) : [])
    ]);
    const beatFrameObjects = collectObjects(scene.root.list)
      .filter((child: any) => child.texture?.key === beatTextureKey)
      .map((child: any) => ({
        displayWidth: Math.round(child.displayWidth),
        displayHeight: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(3) ?? child.alpha),
        name: child.name,
        visible: child.visible,
      }));
    return {
      combatHudMetricChipFrame: state.combatHudMetricChipFrame,
      combatSuitKeystoneChipFrame: state.combatSuitKeystoneChipFrame,
      combatBeatProgressFrame: state.combatBeatProgressFrame,
      frameObjects,
      keystoneFrameObjects,
      beatFrameObjects,
      energy: scene.root.getByName('hud-value-Wingbeats')?.text,
      expectedEnergy: `${scene.energy}/${3 + scene.nextTurnEnergyBonus}`,
    };
  });
  expect(result.combatHudMetricChipFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.frameObjects).toBe(0);
  expect(result.energy).toBe(result.expectedEnergy);
  expect(result.combatSuitKeystoneChipFrame).toEqual({ loaded: true, rendered: false, count: result.keystoneFrameObjects });
  expect(result.keystoneFrameObjects).toBe(0);
  expect(result.combatBeatProgressFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.beatFrameObjects).toEqual([]);
});

test('encounter composition supports solo tuning and support companions', async ({ page }) => {
  await boot(page);
  const solo = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const soloScene: any = g.scene.getScene('BattleScene');
    const soloEnemy = soloScene.enemies[0];
    return {
      solo: soloEnemy.solo,
      maxHp: soloEnemy.maxHp,
      baseHp: soloEnemy.runtime.health,
      damageBonus: soloEnemy.damageBonus,
      previewDamage: soloScene.incomingAttackDamage(soloEnemy),
    };
  });

  const supportResult = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    g.scene.stop('BattleScene');
    const runState = {
      deck: [{ id: 'major_00' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed: 'support-companion-test',
      currentHp: 36,
      scrap: 0,
      routeMarks: [],
      supplies: [],
      mapIndex: 0,
      completedRouteNodeIds: [],
      currentRouteNodeId: undefined,
      routeLog: [],
      nextCombat: undefined,
      signalChoices: [],
      rewardEvents: [],
    };

    await window.__birdSquadStartScene!('RouteScene', { runState });
    const supportNode = window.__birdSquadCurrentMap!().nodes.find((node: any) => node.type === 'street');
    if (!supportNode) throw new Error('Expected a street node for support encounter smoke');
    supportNode.payloadId = 'enc_rooftop_skirmish';
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: supportNode.id, runState });
    g.scene.stop('MenuScene');
    const supportScene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && (!supportScene.enemies?.length || !supportScene.fxLayer); i += 1) {
      await wait(50);
    }
    for (let i = 0; i < 20 && !supportScene.enemies.some((enemy: any) => enemy.roles.includes('support')); i += 1) {
      await wait(50);
    }
    const support = supportScene.enemies.find((enemy: any) => enemy.roles.includes('support'));
    const ally = supportScene.enemies.find((enemy: any) => enemy.id !== support.id);
    supportScene.fxLayer.removeAll(true);
    supportScene.combatEnemyMendBursts = 0;
    supportScene.combatEnemyCoverBursts = 0;
    ally.maxHp = 30;
    ally.hp = 12;
    supportScene.resolveEnemyEffect(support, 'healAlly(lowest, 4)');
    supportScene.resolveEnemyEffect(support, 'gainCoverAlly(lowest, 3)');
    supportScene.resolveEnemyEffect(support, 'gainCover(5)');

    return {
      supportRoles: support.roles,
      allyHp: ally.hp,
      allyBlock: ally.block,
      supportBlock: support.block,
      supportNextAttackBonus: support.nextAttackBonus,
      combatEnemyMend: window.__birdSquadState!().combatEnemyMend,
      combatEnemyCover: window.__birdSquadState!().combatEnemyCover,
      supportState: supportScene.enemies.map((enemy: any) => ({
        id: enemy.id,
        roles: enemy.roles,
        solo: enemy.solo,
        maxHp: enemy.maxHp,
        baseHp: enemy.runtime.health,
        damageBonus: enemy.damageBonus,
      })),
    };
  });

  expect(solo.solo).toBe(true);
  expect(solo.maxHp).toBeGreaterThan(solo.baseHp);
  expect(solo.damageBonus).toBe(2);
  expect(solo.previewDamage).toBeGreaterThan(6);
  expect(supportResult.supportRoles).toContain('support');
  expect(supportResult.allyHp).toBe(16);
  expect(supportResult.allyBlock).toBe(3);
  expect(supportResult.supportBlock).toBe(5);
  expect(supportResult.supportNextAttackBonus).toBe(0);
  expect(supportResult.combatEnemyMend.loaded).toBe(true);
  expect(supportResult.combatEnemyMend.rendered).toBe(true);
  expect(supportResult.combatEnemyMend.count).toBeGreaterThanOrEqual(1);
  expect(supportResult.combatEnemyMend.bursts).toBeGreaterThanOrEqual(1);
  expect(supportResult.combatEnemyCover.loaded).toBe(true);
  expect(supportResult.combatEnemyCover.rendered).toBe(true);
  expect(supportResult.combatEnemyCover.count).toBeGreaterThanOrEqual(1);
  expect(supportResult.combatEnemyCover.bursts).toBeGreaterThanOrEqual(2);
  expect(supportResult.supportState.some((enemy: any) => enemy.roles.includes('support'))).toBe(true);
  expect(supportResult.supportState.every((enemy: any) => enemy.solo === false)).toBe(true);
  expect(supportResult.supportState.every((enemy: any) => enemy.maxHp > enemy.baseHp)).toBe(true);
  expect(supportResult.supportState.every((enemy: any) => enemy.damageBonus === 2)).toBe(true);
});

test('generated combat payloads favor multi-enemy encounters', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const multiPayloadIds = new Set([
      'enc_rooftop_rat_pack',
      'enc_rooftop_skirmish',
      'enc_gutter_baron',
      'enc_signal_gull',
      'enc_rooftop_scrapper_mix',
      'enc_rooftop_cutpurse_alarm',
      'enc_rooftop_speed_trap',
    ]);
    const mkRunState = (seed: string) => ({
      deck: [{ id: 'major_00' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed,
      currentHp: 36,
      scrap: 40,
      routeMarks: [],
      supplies: [],
      mapIndex: 0,
      completedRouteNodeIds: [],
      currentRouteNodeId: undefined,
      routeLog: [],
      nextCombat: undefined,
      signalChoices: [],
      rewardEvents: [],
    });
    let multi = 0;
    let solo = 0;
    for (let i = 0; i < 40; i += 1) {
      await window.__birdSquadStartScene!('RouteScene', { runState: mkRunState(`multi-rate-${i}`) });
      g.scene.stop('MenuScene');
      await wait(5);
      for (const node of window.__birdSquadCurrentMap!().nodes) {
        if (node.type !== 'street' && node.type !== 'rival') continue;
        if (node.id === window.__birdSquadCurrentMap!().entryNodeId) continue;
        if (multiPayloadIds.has(node.payloadId)) multi += 1;
        else solo += 1;
      }
    }
    return { multi, solo };
  });
  expect(result.multi).toBeGreaterThan(result.solo);
});

test('poison pressure applies Fouled and ticks on the next player turn', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];
    scene.fxLayer.removeAll(true);
    scene.combatFouledPressureBursts = 0;
    scene.flock.hp = 30;
    scene.flock.block = 0;
    scene.flockStats = () => ({});
    scene.resolveEnemyEffect(enemy, 'applyPoison(flock, 2)');
    const applyState = window.__birdSquadState!();
    scene.startPlayerTurn();
    const tickState = window.__birdSquadState!();
    return {
      afterApply: applyState.flock,
      afterTick: tickState.flock,
      afterApplyFx: applyState.combatFouledPressure,
      afterTickFx: tickState.combatFouledPressure,
      log: scene.log.slice(-4)
    };
  });

  expect(result.afterApply.fouled).toBe(2);
  expect(result.afterApply.statuses).toContain('Fouled 2');
  expect(result.afterTick.hp).toBe(28);
  expect(result.afterTick.fouled).toBe(1);
  expect(result.afterTick.statuses).toContain('Fouled 1');
  expect(result.afterApplyFx.loaded).toBe(true);
  expect(result.afterApplyFx.rendered).toBe(true);
  expect(result.afterApplyFx.count).toBeGreaterThanOrEqual(1);
  expect(result.afterApplyFx.bursts).toBeGreaterThanOrEqual(1);
  expect(result.afterTickFx.loaded).toBe(true);
  expect(result.afterTickFx.rendered).toBe(true);
  // The next player turn retires the apply beat before presenting the tick,
  // so only the live tick sprite remains even though both bursts fired.
  expect(result.afterTickFx.count).toBeGreaterThanOrEqual(1);
  expect(result.afterTickFx.bursts).toBeGreaterThanOrEqual(2);
  expect(result.log.some((line: string) => line.includes('Fouled pressure'))).toBe(true);
});

test('flock Cohesion bar exposes incoming damage prediction after Cover', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    const enemy = scene.enemies[0];
    const intentDamage = scene.incomingAttackDamage(enemy);
    scene.flock.hp = 30;
    scene.flock.block = 3;
    scene.renderAll();
    const countTexture = (items: any[], textureKey: string): number => items.reduce((sum, child) => {
      const self = child.texture?.key === textureKey ? 1 : 0;
      const nested = Array.isArray(child.list) ? countTexture(child.list, textureKey) : 0;
      return sum + self + nested;
    }, 0);
    const frameObjects = (scene.root?.list ?? scene.children.list)
      .filter((child: any) => child.texture?.key === 'ui-icon-combat-incoming-forecast-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const gaugeObjects = (scene.root?.list ?? scene.children.list)
      .filter((child: any) => child.texture?.key === 'ui-icon-combat-cohesion-gauge-frame')
      .map((child: any) => ({
        width: Math.round(child.displayWidth),
        height: Math.round(child.displayHeight),
        alpha: Number(child.alpha?.toFixed?.(2) ?? child.alpha),
        name: child.name,
      }));
    const forecastLabels = (scene.root?.list ?? scene.children.list)
      .filter((child: any) => child.name === 'combat-incoming-forecast-label')
      .map((child: any) => child.text);
    const state = window.__birdSquadState!();
    scene.flock.block = 0;
    scene.renderAll();
    const uncoveredForecastLabels = (scene.root?.list ?? scene.children.list)
      .filter((child: any) => child.name === 'combat-incoming-forecast-label')
      .map((child: any) => child.text);
    return {
      intentDamage,
      preview: state.flock.incoming,
      combatIncomingForecastFrame: state.combatIncomingForecastFrame,
      combatCohesionGaugeFrame: state.combatCohesionGaugeFrame,
      frameCount: countTexture(scene.root?.list ?? scene.children.list, 'ui-icon-combat-incoming-forecast-frame'),
      gaugeFrameCount: countTexture(scene.root?.list ?? scene.children.list, 'ui-icon-combat-cohesion-gauge-frame'),
      frameObjects,
      gaugeObjects,
      forecastLabels,
      uncoveredForecastLabels,
    };
  });

  expect(result.preview.total).toBe(result.intentDamage);
  expect(result.preview.blocked).toBe(3);
  expect(result.preview.hpLoss).toBe(result.intentDamage - 3);
  expect(result.preview.afterHp).toBe(30 - (result.intentDamage - 3));
  expect(result.preview.attackers).toBe(1);
  expect(result.forecastLabels).toEqual([
    `−${result.intentDamage - 3} HP · ${30 - (result.intentDamage - 3)} left`
  ]);
  expect(result.forecastLabels[0]).not.toContain('Incoming -');
  expect(result.uncoveredForecastLabels).toEqual([
    `−${result.intentDamage} HP · ${30 - result.intentDamage} left`
  ]);
  expect(result.uncoveredForecastLabels[0]).not.toContain('Incoming -');
  expect(result.combatIncomingForecastFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.frameCount).toBe(0);
  expect(result.frameObjects).toEqual([]);
  expect(result.combatCohesionGaugeFrame).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(result.gaugeFrameCount).toBe(0);
  expect(result.gaugeObjects).toEqual([]);
});

test('boss Phase II is previewed before a real pointer commit and shifts its Tell once at half Cohesion', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await boot(page);
  const setup = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
    game.scene.stop('MenuScene');
    const scene: any = game.scene.getScene('BattleScene');
    for (let index = 0; index < 80; index += 1) {
      if (scene.hand?.length
        && scene.combatPreviewModule
        && scene.battleForegroundRendererModule
        && scene.textures.exists('combat-boss-phase-break')) break;
      await wait(50);
    }
    const card = scene.hand[0];
    const boss = scene.enemies[0];
    card.target = 'enemy';
    card.role = 'attack';
    card.cost = 0;
    card.runtime.target = 'enemy';
    card.runtime.effects = ['damagePierce(target, 1)'];
    scene.flock.molt = false;
    scene.energy = 3;
    scene.selectedEnemyId = boss.id;
    boss.hp = Math.floor(boss.maxHp / 2) + 1;
    boss.block = 5;
    boss.nextAttackBonus = 3;
    scene.renderAll();
    return {
      cardId: card.instanceId,
      hpBefore: boss.hp,
      maxHp: boss.maxHp,
      phaseName: boss.runtime.phaseTwoName,
      phaseOpener: boss.runtime.moves.find((move: any) => move.id === boss.runtime.phaseTwoMoveIds[0]).label
    };
  });
  const clickCard = async () => {
    const center = await page.evaluate((cardId) => {
      const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
      const bounds = scene.handCardRects.get(cardId)?.getBounds();
      if (!bounds) throw new Error('Missing boss-phase card hit target');
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    }, setup.cardId);
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Missing game canvas');
    await page.mouse.click(
      canvas.x + canvas.width * (center.x / 1280),
      canvas.y + canvas.height * (center.y / 720)
    );
  };

  await clickCard();
  await page.waitForFunction((cardId) => window.__birdSquadState?.().selectedCard === cardId, setup.cardId);
  await page.waitForFunction(() => document.getElementById('game-status')?.textContent?.includes('Phase II'));
  const preview = await page.evaluate(() => ({
    state: window.__birdSquadState!(),
    spoken: document.getElementById('game-status')?.textContent ?? ''
  }));

  await clickCard();
  await page.evaluate(() => window.advanceTime?.(5000));
  await page.waitForFunction(() => {
    const state = window.__birdSquadState?.();
    return state?.enemies?.[0]?.phase === 2 && state.combatAnimationPending === false;
  });
  await page.screenshot({ path: '.artifacts/test-results/boss-phase-two-1000x560.png' });
  const result = await page.evaluate(() => {
    const scene: any = window.__birdSquadGame.scene.getScene('BattleScene');
    const boss = scene.enemies[0];
    const state = window.__birdSquadState!();
    const burstCount = state.combatBossPhaseBreak?.bursts ?? 0;
    const badgeText = scene.root.list
      .filter((child: any) => child.name === 'combat-boss-phase-badge' && typeof child.text === 'string')
      .map((child: any) => child.text);
    const thresholdCount = scene.root.list
      .filter((child: any) => child.name === 'combat-boss-phase-threshold').length;
    scene.damageEnemy(boss.id, 1, 'repeat phase probe', undefined, true);
    scene.renderAll();
    const repeated = window.__birdSquadState!();
    return {
      state,
      badgeText,
      thresholdCount,
      spoken: document.getElementById('game-status')?.textContent ?? '',
      repeatedPhase: boss.phase,
      repeatedIntentIndex: boss.intentIndex,
      repeatedBurstCount: repeated.combatBossPhaseBreak?.bursts ?? 0,
      burstCount
    };
  });

  expect(preview.state.enemies[0]).toMatchObject({ phase: 1, block: 5 });
  expect(preview.state.selectedCardOutcome.result.bossPhaseBreak).toMatchObject({
    name: setup.phaseName,
    nextIntent: setup.phaseOpener
  });
  expect(preview.state.selectedCardOutcome.summary).toContain(`Phase II: ${setup.phaseName}`);
  expect(preview.state.selectedCardOutcome.summary).toContain(`next ${setup.phaseOpener}`);
  expect(preview.state.selectedCardOutcome.summary).toContain('Enemy Cover 5 -> 0');
  expect(preview.state.selectedCardOutcome.result.targetCover).toEqual({ before: 5, after: 0 });
  expect(preview.spoken).toContain(`Preview: ${preview.state.selectedCardOutcome.summary}`);
  expect(result.state.enemies[0]).toMatchObject({
    phase: 2,
    phaseName: setup.phaseName,
    intent: setup.phaseOpener,
    intentIndex: 0,
    block: 0
  });
  expect(result.state.enemies[0].hp).toBeGreaterThan(0);
  expect(result.state.enemies[0].hp).toBeLessThanOrEqual(Math.floor(setup.maxHp / 2));
  expect(result.state.enemies[0].hp).toBe(preview.state.selectedCardOutcome.result.targetHp.after);
  expect(result.state.log.some((entry: string) =>
    entry.includes(`enters Phase II: ${setup.phaseName}`)
    && entry.includes(`Next Tell: ${setup.phaseOpener}`))).toBe(true);
  expect(result.badgeText.some((text: string) => text.includes('Phase II'))).toBe(true);
  expect(result.thresholdCount).toBe(1);
  expect(result.burstCount).toBe(1);
  expect(result.spoken).toContain(`is in Phase II, ${setup.phaseName}`);
  expect(result.spoken).toContain(`next Tell ${setup.phaseOpener}`);
  expect(result.repeatedPhase).toBe(2);
  expect(result.repeatedIntentIndex).toBe(0);
  expect(result.repeatedBurstCount).toBe(result.burstCount);
});

test('boss fights render generated boss battlefield variants', async ({ page }) => {
  await boot(page);
  const expectedKeys = [
    'battlefield-rooftop-blocks-boss-tar-crow',
    'battlefield-canal-markets-boss-gatekeeper',
    'battlefield-signal-spires-boss-beacon-breaker',
    'battlefield-high-roost-boss-warden'
  ];
  const results = [];
  for (let mapIndex = 0; mapIndex < expectedKeys.length; mapIndex += 1) {
    const expectedKey = expectedKeys[mapIndex];
    await page.evaluate(async (mapIndex) => {
      const g = window.__birdSquadGame;
      const runState = {
      deck: [{ id: 'major_00' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed: 'boss-backdrop-variant-test',
      currentHp: 36,
      scrap: 40,
      routeMarks: [],
      supplies: [],
      mapIndex,
      completedRouteNodeIds: [],
      currentRouteNodeId: undefined,
      routeLog: [],
      nextCombat: undefined,
      signalChoices: [],
      rewardEvents: [],
      };
      await window.__birdSquadStartScene!('RouteScene', { runState });
      g.scene.stop('MenuScene');
      const bossNodeId = window.__birdSquadCurrentMap!().bossNodeId;
      await window.__birdSquadStartScene!('BattleScene', { routeNodeId: bossNodeId, runState });
    }, mapIndex);
    await page.waitForFunction((expectedKey) => {
      const state = window.__birdSquadState?.();
      const scene: any = window.__birdSquadGame?.scene.getScene('BattleScene');
      const rendered = scene?.backdropLayer?.list?.some((child: any) => child.texture?.key === expectedKey) ?? false;
      return state?.route?.battlefieldAssetKey === expectedKey
        && state.route.battlefieldVariant
        && scene?.textures.exists(expectedKey)
        && rendered;
    }, expectedKey, { timeout: 10_000 });
    results.push(await page.evaluate(async (expectedKey) => {
      const state = window.__birdSquadState!();
      const scene: any = window.__birdSquadGame?.scene.getScene('BattleScene');
      return {
        stateKey: state.route.battlefieldAssetKey,
        variant: state.route.battlefieldVariant,
        textureLoaded: scene.textures.exists(expectedKey),
        rendered: scene.backdropLayer?.list?.some((child: any) => child.texture?.key === expectedKey) ?? false
      }
    }, expectedKey));
  }

  expect(results).toEqual([
    expect.objectContaining({ stateKey: 'battlefield-rooftop-blocks-boss-tar-crow', variant: true, textureLoaded: true, rendered: true }),
    expect.objectContaining({ stateKey: 'battlefield-canal-markets-boss-gatekeeper', variant: true, textureLoaded: true, rendered: true }),
    expect.objectContaining({ stateKey: 'battlefield-signal-spires-boss-beacon-breaker', variant: true, textureLoaded: true, rendered: true }),
    expect.objectContaining({ stateKey: 'battlefield-high-roost-boss-warden', variant: true, textureLoaded: true, rendered: true })
  ]);
});

test('combat backdrop presentation varies by route encounter type', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const g = window.__birdSquadGame;
    const mkRunState = () => ({
      deck: [{ id: 'major_00' }],
      leaderId: 'fledgling',
      difficulty: 0,
      seed: 'combat-backdrop-mood-test',
      currentHp: 36,
      scrap: 40,
      routeMarks: [],
      supplies: [],
      mapIndex: 0,
      completedRouteNodeIds: [],
      currentRouteNodeId: undefined,
      routeLog: [],
      nextCombat: undefined,
      signalChoices: [],
      rewardEvents: [],
    });
    const routeRunState = mkRunState();
    await window.__birdSquadStartScene!('RouteScene', { runState: routeRunState });
    g.scene.stop('MenuScene');
    await wait(80);
    const map = window.__birdSquadCurrentMap!();
    const street = map.nodes.find((node: any) => node.type === 'street')?.id;
    const rival = map.nodes.find((node: any) => node.type === 'rival')?.id;
    const boss = map.bossNodeId;
    const start = async (routeNodeId: string) => {
      await window.__birdSquadStartScene!('BattleScene', { routeNodeId, runState: mkRunState() });
      g.scene.stop('MenuScene');
      await wait(120);
      return window.__birdSquadState!().route;
    };
    return {
      street: street ? await start(street) : undefined,
      rival: rival ? await start(rival) : undefined,
      boss: await start(boss)
    };
  });

  expect(result.street?.battlefieldMood).toBe('street');
  expect(result.street?.battlefieldVariant).toBe(false);
  expect(result.rival?.battlefieldMood).toBe('rival');
  expect(result.rival?.battlefieldVariant).toBe(false);
  expect(result.boss.battlefieldMood).toBe('boss');
  expect(result.boss.battlefieldVariant).toBe(true);
  expect(result.boss.battlefieldAssetKey).toBe('battlefield-rooftop-blocks-boss-tar-crow');
});

test('supplies are carried into combat and usable for an effect', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', {
      routeNodeId: 'm1_entry',
      runState: {
        deck: [{ id: 'major_00' }, { id: 'wands_ace' }, { id: 'cups_ace' }, { id: 'swords_ace' }, { id: 'pentacles_04' }],
        leaderId: 'fledgling',
        difficulty: 0,
        seed: 'combat-supply-test',
        currentHp: 32,
        scrap: 0,
        routeMarks: [],
        supplies: ['zip_tie_roll'],
        supplySlots: 2,
        mapIndex: 0,
        completedRouteNodeIds: [],
        currentRouteNodeId: undefined,
        routeLog: [],
        nextCombat: undefined,
        signalChoices: [],
        rewardEvents: [],
        suppliesUsed: [],
        combatResults: [],
        freePreenNextDistrict: 0,
      }
    });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(scene.root && scene.hand?.length); i += 1) await wait(50);
    const carried = window.__birdSquadState!().route.supplies;
    const coverBefore = scene.flock.block;
    scene.useSupply(0);
    return {
      carried,
      coverBefore,
      coverAfter: scene.flock.block,
      remaining: scene.runSupplies.length,
      feedback: window.__birdSquadState!().supplyFeedback?.[0],
    };
  });
  expect(result.carried).toEqual(['zip_tie_roll']);
  expect(result.coverAfter - result.coverBefore).toBeGreaterThanOrEqual(8);
  expect(result.remaining).toBe(0);
  expect(result.feedback.id).toBe('zip_tie_roll');
});

test('opening draws are deterministic, varied, and pressure-protected after the curated first fight', async ({ page }) => {
  await boot(page);
  const report = await page.evaluate(async () => {
    const g = window.__birdSquadGame;
    const scene: any = await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const curated = {
      state: structuredClone(scene.openingDraw),
      hand: scene.hand.map((card: any) => card.id),
    };
    const tidewardenDeck = [
      'cups_ace',
      'cups_02',
      'cups_03',
      'cups_fledgling',
      'cups_09',
      'cups_outrider',
      'major_17',
      'aviary_41',
      'pentacles_06',
      'swords_ace',
    ];
    const priorCombat = {
      encounterId: 'prior',
      nodeId: 'prior-node',
      nodeType: 'street',
      enemyIds: [],
      turnsTaken: 1,
      damageDealt: 1,
      cohesionLost: 0,
    };
    const runState = (seed: string) => ({
      deck: tidewardenDeck.map((id) => ({ id })),
      leaderId: 'tidewarden',
      difficulty: 0,
      runMode: 'full',
      seed,
      currentHp: 38,
      scrap: 40,
      routeMarks: [],
      supplies: [],
      supplySlots: 2,
      mapIndex: 0,
      completedRouteNodeIds: ['prior-node'],
      currentRouteNodeId: undefined,
      routeLog: [],
      nextCombat: undefined,
      signalChoices: [],
      rewardEvents: [],
      routeDecisions: [],
      suppliesUsed: [],
      combatResults: [priorCombat],
    });
    const samples = [];
    for (let index = 0; index < 256; index += 1) {
      scene.init({ runState: runState(`opening-fairness-${index}`), routeNodeId: 'm1_entry' });
      const hand = scene.hand.map((card: any) => card.id);
      samples.push({
        shuffled: scene.openingDraw.shuffled,
        protectionSwaps: scene.openingDraw.protectionSwaps,
        playableCount: scene.hand.filter((card: any) => card.cost <= scene.energy && card.runtime.kind !== 'snag').length,
        pressureCount: scene.hand.filter((card: any) => (
          card.cost <= scene.energy
          && card.runtime.kind !== 'snag'
          && (card.target === 'enemy' || card.target === 'allEnemies')
        )).length,
        hand,
      });
    }
    scene.init({ runState: runState('opening-repeat'), routeNodeId: 'm1_entry' });
    const repeatedA = {
      hand: scene.hand.map((card: any) => card.id),
      rewards: scene.createRewardChoices().map((card: any) => card.id),
    };
    scene.init({ runState: runState('opening-repeat'), routeNodeId: 'm1_entry' });
    const repeatedB = {
      hand: scene.hand.map((card: any) => card.id),
      rewards: scene.createRewardChoices().map((card: any) => card.id),
    };
    return {
      curated,
      samples,
      repeatedA,
      repeatedB,
      uniqueHands: new Set(samples.map((sample) => sample.hand.join('>'))).size,
      protectedSamples: samples.filter((sample) => sample.protectionSwaps > 0).length,
    };
  });

  await test.info().attach('opening-draw-fairness-report', {
    body: Buffer.from(JSON.stringify({
      curated: report.curated,
      uniqueHands: report.uniqueHands,
      protectedSamples: report.protectedSamples,
      repeatedA: report.repeatedA,
      repeatedB: report.repeatedB,
    }, null, 2)),
    contentType: 'application/json',
  });
  expect(report.curated.state).toMatchObject({
    shuffled: false,
    protectionSwaps: 0,
  });
  expect(report.curated.hand).toEqual([
    'major_00',
    'wands_ace',
    'wands_fledgling',
    'swords_ace',
    'swords_fledgling',
  ]);
  expect(report.uniqueHands).toBeGreaterThanOrEqual(220);
  expect(report.protectedSamples).toBeGreaterThan(80);
  for (const sample of report.samples) {
    expect(sample).toMatchObject({
      shuffled: true,
      pressureCount: 1,
    });
    expect(sample.playableCount).toBeGreaterThanOrEqual(2);
  }
  expect(report.repeatedB).toEqual(report.repeatedA);
});

test('Flock Leader signatures fire at their once-per-combat hooks', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const base = (leaderId: string) => ({
      deck: [
        { id: 'wands_03' }, { id: 'swords_ace' }, { id: 'cups_ace' }, { id: 'pentacles_04' }, { id: 'major_00' },
        { id: 'wands_ace' }, { id: 'cups_03' }, { id: 'swords_02' }, { id: 'pentacles_02' }, { id: 'aviary_25' }
      ],
      leaderId, difficulty: 0, seed: `sig-${leaderId}`, currentHp: 36,
      scrap: 0, routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [],
      currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
      suppliesUsed: [], combatResults: [],
    });
    const start = async (leaderId: string) => {
      await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry', runState: base(leaderId) });
      g.scene.stop('MenuScene');
      await wait(80);
      return g.scene.getScene('BattleScene') as any;
    };

    const fledgling = await start('fledgling');
    fledgling.fxLayer.removeAll(true);
    fledgling.combatFourSuitRallyBursts = 0;
    fledgling.fledglingSuitRallies = new Set();
    fledgling.flock.flow = 0;
    const rallyCard = fledgling.hand.find((card: any) => card.runtime?.suit && fledgling.effectiveCost(card) <= fledgling.energy);
    if (!rallyCard) throw new Error('No playable suited card for Fledgling rally smoke.');
    const rallyContract = fledgling.activeCardContract(rallyCard);
    fledgling.playCard(rallyCard, rallyContract.target === 'enemy' ? fledgling.enemies[0].id : undefined);
    await wait(80);
    const fledglingState = window.__birdSquadState!();
    const fledglingFlow = fledgling.flock.flow;
    const fledglingRallyVisuals = fledgling.fxLayer.list
      .filter((entry: any) => entry.name === 'combat-four-suit-flourish')
      .map((entry: any) => ({
        type: entry.type,
        centerClear: entry.getData('centerClear'),
        presentation: entry.getData('presentation'),
        radius: entry.getData('radius'),
      }));
    const fledglingLegacyRallyTextures = fledgling.fxLayer.list
      .filter((entry: any) => entry.texture?.key === 'combat-four-suit-rally').length;
    const fledglingLegacyPerfectChainTextures = fledgling.fxLayer.list
      .filter((entry: any) => entry.texture?.key === 'combat-perfect-chain').length;
    const fledglingLegacyTexturesLoaded = {
      rally: fledgling.textures.exists('combat-four-suit-rally'),
      perfectChain: fledgling.textures.exists('combat-perfect-chain'),
    };

    const spark = await start('spark_caller');
    spark.fxLayer.removeAll(true);
    spark.combatSparkEchoBursts = 0;
    const sparkSeedCard = spark.hand.pop();
    if (sparkSeedCard) spark.drawPile.unshift(sparkSeedCard);
    spark.spark = 1;
    const sparkHandBefore = spark.hand.length;
    spark.spendResonance(1);
    await wait(80);
    const sparkDraw = spark.hand.length - sparkHandBefore;
    const sparkState = window.__birdSquadState!();

    const talon = await start('talon');
    talon.fxLayer.removeAll(true);
    talon.combatPinnedOpeningStrikeBursts = 0;
    const talonEnemy = talon.enemies[0];
    talonEnemy.hp = 20;
    talon.resolveCardEffect('applyWinded(target, 1)', talon.hand[0], talonEnemy.id, {
      previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false
    });
    const talonDamage = 20 - talonEnemy.hp;
    const talonState = window.__birdSquadState!();

    const tide = await start('tidewarden');
    tide.fxLayer.removeAll(true);
    tide.combatOverflowShelterBursts = 0;
    tide.flock.hp = tide.flock.maxHp;
    tide.flock.block = 0;
    tide.healFlock(3, 'test');
    await wait(80);
    const tideCover = tide.flock.block;
    const tideState = window.__birdSquadState!();

    const roost = await start('roostkeeper');
    roost.fxLayer.removeAll(true);
    roost.combatPerfectBraceRiposteBursts = 0;
    roost.flock.flow = 0;
    roost.flock.block = 99;
    roost.damageFlock(roost.enemies[0], 5);
    const roostState = window.__birdSquadState!();
    const roostFlow = roost.flock.flow;

    return {
      fledglingFlow,
      fledglingFourSuitRally: fledglingState.combatFourSuitRally,
      fledglingRallyVisuals,
      fledglingLegacyRallyTextures,
      fledglingLegacyPerfectChainTextures,
      fledglingLegacyTexturesLoaded,
      fledglingLog: fledglingState.log,
      sparkDraw,
      sparkEcho: sparkState.combatSparkEcho,
      sparkLog: sparkState.log,
      talonDamage,
      talonPinnedOpeningStrike: talonState.combatPinnedOpeningStrike,
      talonLog: talonState.log,
      tideCover,
      tideOverflowShelter: tideState.combatOverflowShelter,
      tideLog: tideState.log,
      roostFlow,
      roostPerfectBraceRiposte: roostState.combatPerfectBraceRiposte,
      roostLog: roostState.log,
    };
  });
  expect(r.fledglingFlow).toBeGreaterThanOrEqual(1);
  expect(r.fledglingFourSuitRally.loaded).toBe(true);
  expect(r.fledglingFourSuitRally.rendered).toBe(true);
  expect(r.fledglingFourSuitRally.count).toBeGreaterThanOrEqual(1);
  expect(r.fledglingFourSuitRally.bursts).toBe(1);
  expect(r.fledglingRallyVisuals).toEqual([
    expect.objectContaining({
      type: 'Graphics',
      centerClear: true,
      presentation: 'segmented-perimeter',
      radius: 94,
    })
  ]);
  expect(r.fledglingRallyVisuals[0].radius * 2 * 1.12).toBeLessThanOrEqual(215);
  expect(r.fledglingLegacyRallyTextures).toBe(0);
  expect(r.fledglingLegacyPerfectChainTextures).toBe(0);
  expect(r.fledglingLegacyTexturesLoaded).toEqual({ rally: false, perfectChain: false });
  expect(r.fledglingLog.some((entry: string) => entry.startsWith('Four-Suit Rally:'))).toBe(true);
  expect(r.sparkDraw).toBe(1);
  expect(r.sparkEcho.loaded).toBe(true);
  expect(r.sparkEcho.rendered).toBe(true);
  expect(r.sparkEcho.count).toBeGreaterThanOrEqual(1);
  expect(r.sparkEcho.bursts).toBe(1);
  expect(r.sparkLog).toContain('Spark Echo draws 1 card.');
  expect(r.talonDamage).toBe(2);
  expect(r.talonPinnedOpeningStrike.loaded).toBe(true);
  expect(r.talonPinnedOpeningStrike.rendered).toBe(true);
  expect(r.talonPinnedOpeningStrike.count).toBeGreaterThanOrEqual(1);
  expect(r.talonPinnedOpeningStrike.bursts).toBe(1);
  expect(r.talonLog).toContain('Pinned Opening hits Roof Rat for 2.');
  expect(r.tideCover).toBe(3);
  expect(r.tideOverflowShelter.loaded).toBe(true);
  expect(r.tideOverflowShelter.rendered).toBe(true);
  expect(r.tideOverflowShelter.count).toBeGreaterThanOrEqual(1);
  expect(r.tideOverflowShelter.bursts).toBe(1);
  expect(r.tideLog).toContain('Overflow Shelter turns 3 wasted healing into 3 Cover.');
  expect(r.roostFlow).toBe(1);
  expect(r.roostPerfectBraceRiposte.loaded).toBe(true);
  expect(r.roostPerfectBraceRiposte.rendered).toBe(true);
  expect(r.roostPerfectBraceRiposte.count).toBeGreaterThanOrEqual(1);
  expect(r.roostPerfectBraceRiposte.bursts).toBe(1);
  expect(r.roostLog).toContain('Perfect Brace: +1 Flow and a counterstrike.');
});

test('route marks are real relics: combatStart marks reshape the fight', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const scene: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !scene.fxLayer; i += 1) await wait(50);
    // Baseline: no marks → no relic cover/energy beyond the turn-1 default.
    scene.routeMarks = [];
    scene.flock.block = 0;
    scene.energy = 3;
    scene.applyCombatStartMarks();
    const baseBlock = scene.flock.block;
    const baseEnergy = scene.energy;
    // Equip a clean-turn relic and one low-card Roost relic, then prove each
    // fires at its authored timing.
    scene.routeMarks = ['patched_shoulder_wrap', 'loose_feather_token'];
    scene.flock.block = 0;
    scene.energy = 3;
    scene.nextTurnEnergyBonus = 0;
    scene.pendingRetainHand = 0;
    scene.markFiredThisCombat = new Set();
    scene.applyCombatStartMarks();
    const markBlock = scene.flock.block;
    const markEnergy = scene.energy;
    scene.checkNoDamageTurnMarks();
    const shoulderAfterCleanTurn = {
      block: scene.flock.block,
      retain: scene.pendingRetainHand,
    };
    scene.checkRoostRestraintMarks(0, 1, 2);
    const featherNextEnergy = scene.nextTurnEnergyBonus;

    scene.routeMarks = ['chalk_wingmark'];
    scene.markFiredThisTurn = new Set();
    scene.flock.block = 0;
    scene.spark = 0;
    scene.nextTurnDrawBonus = 0;
    scene.checkEnemyCoverBrokenMarks();
    const chalkCover = scene.flock.block;
    const chalkNextDraw = scene.nextTurnDrawBonus;
    const chalkSpark = scene.spark;

    scene.routeMarks = ['stage_pin', 'quill_notch', 'feather_tape', 'workshop_stamp'];
    scene.markFiredThisTurn = new Set();
    scene.flock.maxHp = 40;
    scene.flock.hp = 20;
    scene.flock.block = 0;
    scene.flock.openSkyGuard = 0;
    scene.nextTurnEnergyBonus = 0;
    scene.checkSuitPlayedMarks('plumes');
    scene.checkSuitPlayedMarks('quills');
    scene.checkSuitPlayedMarks('basins');
    scene.checkSuitPlayedMarks('nests');
    const suitMarks = {
      hp: scene.flock.hp,
      block: scene.flock.block,
      guard: scene.flock.openSkyGuard,
      nextEnergy: scene.nextTurnEnergyBonus,
    };

    scene.routeMarks = ['rooftop_relay_bell'];
    scene.markFiredThisCombat = new Set();
    scene.energy = 3;
    const handBeforeRelay = scene.hand.length;
    scene.checkSupplyUsedMarks();
    const relay = { energy: scene.energy, hand: scene.hand.length, beforeHand: handBeforeRelay };

    scene.routeMarks = ['parade_mirror'];
    scene.markFiredThisCombat = new Set();
    scene.cardsPlayedThisTurn = 2;
    scene.spark = 0;
    scene.checkNthCardMarks();
    scene.cardsPlayedThisTurn = 3;
    scene.checkNthCardMarks();
    const paradeResonance = scene.spark;

    scene.routeMarks = ['fresh_pinfeather'];
    scene.markFiredThisCombat = new Set();
    scene.flock.molt = false;
    scene.nextTurnEnergyBonus = 0;
    const energyBeforePinfeather = scene.energy;
    const handBeforePinfeather = scene.hand.length;
    scene.enterMolt('test');
    const pinfeather = {
      immediateEnergy: scene.energy - energyBeforePinfeather,
      nextEnergy: scene.nextTurnEnergyBonus,
      hand: scene.hand.length,
      beforeHand: handBeforePinfeather
    };

    scene.routeMarks = ['harbor_bead_strand'];
    scene.markFiredThisTurn = new Set();
    scene.flock.maxHp = 40;
    scene.flock.hp = 20;
    scene.nextTurnDrawBonus = 0;
    scene.healFlock(2, 'test');
    const harborNextDraw = scene.nextTurnDrawBonus;

    scene.routeMarks = ['rooftop_nest_lining'];
    scene.markFiredThisCombat = new Set();
    scene.flock.block = 0;
    scene.pendingRetainHand = 0;
    scene.checkNoDamageTurnMarks();
    const nestLining = { cover: scene.flock.block, retain: scene.pendingRetainHand };

    scene.routeMarks = ['rooftop_shortcut'];
    scene.markFiredThisCombat = new Set();
    scene.nextTurnDrawBonus = 0;
    scene.checkRoostRestraintMarks(0, 1, 1);
    const shortcutNextDraw = scene.nextTurnDrawBonus;

    scene.routeMarks = ['courier_thread'];
    scene.markFiredThisCombat = new Set();
    scene.nextTurnDrawBonus = 0;
    scene.checkRoostRestraintMarks(0, 0, 2);
    const courierNextDraw = scene.nextTurnDrawBonus;

    scene.routeMarks = ['crowbar_debt'];
    scene.markFiredThisTurn = new Set();
    scene.enemies.forEach((enemy: any) => { enemy.maxHp = 20; enemy.hp = 20; });
    scene.checkEnemyCoverBrokenMarks();
    const crowbarDamage = scene.enemies.map((enemy: any) => 20 - enemy.hp);
    const waymarkFeedback = window.__birdSquadState!().waymarkFeedback ?? [];

    scene.routeMarks = ['chalk_wingmark', 'rooftop_shortcut', 'patched_harness', 'quiet_landing', 'loose_change_tin', 'rain_gutter'];
    scene.claimWaymarkReward('sky_safe_harness');
    const withBossExempt = [...scene.routeMarks];
    scene.claimWaymarkReward('cache_divining_hook');
    const withCapacityReplace = [...scene.routeMarks];

    return {
      baseBlock,
      baseEnergy,
      markBlock,
      markEnergy,
      shoulderAfterCleanTurn,
      featherNextEnergy,
      chalkCover,
      chalkNextDraw,
      chalkSpark,
      suitMarks,
      relay,
      paradeResonance,
      pinfeather,
      harborNextDraw,
      nestLining,
      shortcutNextDraw,
      courierNextDraw,
      crowbarDamage,
      waymarkFeedback,
      withBossExempt,
      withCapacityReplace,
    };
  });
  expect(r.baseBlock).toBe(0);          // no relic, no bonus cover
  expect(r.baseEnergy).toBe(3);
  expect(r.markBlock).toBe(0); // patched_shoulder_wrap waits for a no-damage enemy turn
  expect(r.markEnergy).toBe(3); // loose_feather_token waits for a restrained Roost
  expect(r.shoulderAfterCleanTurn.block).toBeGreaterThanOrEqual(4);
  expect(r.shoulderAfterCleanTurn.retain).toBe(1);
  expect(r.featherNextEnergy).toBe(1); // loose_feather_token banks next-turn Wingbeat
  expect(r.chalkCover).toBe(3);
  expect(r.chalkNextDraw).toBe(1);
  expect(r.chalkSpark).toBe(1);
  expect(r.suitMarks.guard).toBe(1);
  expect(r.suitMarks.block).toBe(8);
  expect(r.suitMarks.hp).toBe(23);
  expect(r.suitMarks.nextEnergy).toBe(1);
  expect(r.relay.energy).toBe(4);
  expect(r.relay.hand).toBeGreaterThanOrEqual(r.relay.beforeHand + 1);
  expect(r.paradeResonance).toBe(1);
  expect(r.pinfeather.immediateEnergy).toBe(1);
  expect(r.pinfeather.nextEnergy).toBe(0);
  expect(r.pinfeather.hand).toBeGreaterThanOrEqual(r.pinfeather.beforeHand + 1);
  expect(r.harborNextDraw).toBe(1);
  expect(r.nestLining.cover).toBe(8);
  expect(r.nestLining.retain).toBe(1);
  expect(r.shortcutNextDraw).toBe(1);
  expect(r.courierNextDraw).toBe(1);
  expect(r.crowbarDamage.every((damage: number) => damage === 5)).toBe(true);
  expect(r.waymarkFeedback[0]).toEqual(expect.objectContaining({
    id: 'crowbar_debt',
    name: 'Crowbar Debt',
  }));
  expect(r.waymarkFeedback[0].summary).toContain('Cover broken');
  expect(r.withBossExempt).toHaveLength(7);
  expect(r.withBossExempt).toContain('sky_safe_harness');
  expect(r.withCapacityReplace).toHaveLength(7);
  expect(r.withCapacityReplace).not.toContain('chalk_wingmark');
  expect(r.withCapacityReplace).toContain('cache_divining_hook');
});

test('flock formation states reshape combat and an unblocked hit shatters Flow', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.enemies && s.enemies.length && s.fxLayer); i += 1) await wait(50);
    const enemy = s.enemies[0];
    s.fxLayer.removeAll(true);
    s.combatFormationShiftBursts = 0;

    // Holding baseline (full Cohesion, no Flow).
    s.flock.hp = s.flock.maxHp; s.flock.flow = 0;
    const holding = s.flockState();

    // Surging hit (Flow full) vs Holding hit - Surge adds +1 outgoing damage.
    enemy.block = 0; enemy.maxHp = 200; enemy.hp = 200;
    s.flock.flow = s.flock.flowMax;
    const surging = s.flockState();
    s.updateFormationFx();
    await wait(80);
    const surgeFormationFx = window.__birdSquadState!().combatFormationShift;
    s.damageEnemy(enemy.id, 5, 'test');
    const surgeDamage = 200 - enemy.hp;

    enemy.block = 0; enemy.hp = 200;
    s.flock.hp = s.flock.maxHp; s.flock.flow = 0; // back to Holding
    s.damageEnemy(enemy.id, 5, 'test');
    const holdDamage = 200 - enemy.hp;

    // Scatter when Cohesion drops below the threshold.
    s.fxLayer.removeAll(true);
    s.combatFormationShiftBursts = 0;
    s.lastFlockState = 'holding';
    s.flock.hp = 1; s.flock.flow = 0;
    const scattered = s.flockState();
    s.updateFormationFx();
    await wait(80);
    const scatterFormationFx = window.__birdSquadState!().combatFormationShift;

    // An unblocked hit shatters Flow back to 0.
    s.flock.hp = s.flock.maxHp; s.flock.flow = 3; s.flock.block = 0;
    s.damageFlock(enemy, 5);
    const flowAfterHit = s.flock.flow;

    return { holding, surging, scattered, surgeDamage, holdDamage, flowAfterHit, surgeFormationFx, scatterFormationFx };
  });
  expect(r.holding).toBe('holding');
  expect(r.surging).toBe('surging');
  expect(r.scattered).toBe('scattered');
  expect(r.surgeDamage).toBe(r.holdDamage + 1); // Surge = +1 outgoing damage
  expect(r.flowAfterHit).toBe(0);               // unblocked hit broke formation
  expect(r.surgeFormationFx.loaded).toBe(true);
  expect(r.surgeFormationFx.rendered).toBe(true);
  expect(r.surgeFormationFx.count).toBeGreaterThanOrEqual(1);
  expect(r.surgeFormationFx.bursts).toBe(1);
  expect(r.scatterFormationFx.loaded).toBe(true);
  expect(r.scatterFormationFx.rendered).toBe(true);
  expect(r.scatterFormationFx.count).toBeGreaterThanOrEqual(1);
  expect(r.scatterFormationFx.bursts).toBe(1);
});

test('flock composition keystone: a Plumes-heavy flock activates its aura (+1 draw)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const menu: any = g.scene.getScene('MenuScene');
    for (let i = 0; i < 20 && !(menu.leaderPanels?.length); i += 1) await wait(50);
    menu.selectLeader('spark_caller'); // 6-Plumes starter → Plumes keystone live
    menu.startRun();
    const route: any = g.scene.getScene('RouteScene');
    for (let i = 0; i < 20 && !route.runState; i += 1) await wait(50);
    await window.__birdSquadStartScene!('BattleScene', { runState: route.runState, routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene'); g.scene.stop('RouteScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 20 && !(s.enemies && s.enemies.length); i += 1) await wait(50);
    return {
      plumes: s.flockSuitCounts().plumes,
      keystone: s.keystoneActive('plumes'),
      handSize: s.hand.length, // base 4 + keystone 1 (+ any deck draw bonus)
    };
  });
  expect(r.plumes).toBeGreaterThanOrEqual(5);
  expect(r.keystone).toBe(true);
  expect(r.handSize).toBeGreaterThanOrEqual(6); // keystone plus deck draw keeps Plumes hands wider
});

test('recursion effects honor draw bonuses and Basins suit gates use the live suit key', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && (!(s.hand && s.hand.length > 1) || !s.enemies?.length); i += 1) await wait(50);
    const card = s.hand[0];
    const enemy = s.enemies[0];
    const mkState = () => ({ previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false });

    s.hand = [];
    s.discardPile = [{ ...card, instanceId: 'return-plus' }];
    s.drawPile = [{ ...card, instanceId: 'draw-plus' }];
    s.returnDiscardToHand('nonMolt', 1);
    const plusOne = { hand: s.hand.length, discard: s.discardPile.length, draw: s.drawPile.length };

    s.hand = [];
    s.discardPile = [{ ...card, instanceId: 'return-zero' }];
    s.drawPile = [{ ...card, instanceId: 'draw-zero' }];
    s.returnDiscardToHand('nonMolt', 0);
    const zero = { hand: s.hand.length, discard: s.discardPile.length, draw: s.drawPile.length };

    s.hand = [
      { ...card, instanceId: 'basins-gate-1', runtime: { ...card.runtime, suit: 'basins' } },
      { ...card, instanceId: 'basins-gate-2', runtime: { ...card.runtime, suit: 'basins' } },
      { ...card, instanceId: 'plumes-gate-1', runtime: { ...card.runtime, suit: 'plumes' } },
    ];
    s.drawPile = [];
    s.discardPile = [];
    const basinsGate = s.checkCardCondition('flockSuit(basins,2)', card, enemy.id, mkState());
    const staleCupsGate = s.checkCardCondition('flockSuit(cups,2)', card, enemy.id, mkState());

    return { plusOne, zero, basinsGate, staleCupsGate };
  });
  expect(r.plusOne).toEqual({ hand: 2, discard: 0, draw: 0 });
  expect(r.zero).toEqual({ hand: 1, discard: 0, draw: 1 });
  expect(r.basinsGate).toBe(true);
  expect(r.staleCupsGate).toBe(false);
});

test('playing four or more cards overextends the flock into Open Sky', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.enemies && s.enemies.length && s.hand && s.hand.length && s.fxLayer); i += 1) await wait(50);

    s.flock.exposed = false;
    s.flock.exposedTurns = 0;
    s.flock.openSkyGuard = 0;
    s.cardsPlayedThisTurn = 3;
    s.applyOverextensionPenalty();
    const safe = { exposed: s.flock.exposed, turns: s.flock.exposedTurns };

    s.cardsPlayedThisTurn = 4;
    s.applyOverextensionPenalty();
    const overextended = { exposed: s.flock.exposed, turns: s.flock.exposedTurns, log: s.log.at(-1) };

    s.flock.hp = 30;
    s.flock.block = 0;
    s.enemies[0].damageBonus = 0;
    s.enemies[0].nextAttackBonus = 0;
    s.damageFlock(s.enemies[0], 5);
    return { safe, overextended, hpAfterHit: s.flock.hp };
  });

  expect(r.safe.exposed).toBe(false);
  expect(r.overextended.exposed).toBe(true);
  expect(r.overextended.turns).toBe(1);
  expect(r.overextended.log).toContain('overextend');
  expect(r.hpAfterHit).toBe(24); // 5 base + 1 Standard Open Sky bonus
});

test('Resonance has real sinks: a threshold gate and a spend-all burst', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && (!(s.hand && s.hand.length) || !s.fxLayer); i += 1) await wait(50);
    const card = s.hand[0];
    const enemy = s.enemies[0];
    const mkState = () => ({ previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false });

    // resonanceAtLeast(N): a hoard gate that does NOT consume Resonance.
    s.spark = 3;
    const gateAt3 = s.checkCardCondition('resonanceAtLeast(3)', card, enemy.id, mkState());
    s.spark = 2;
    const gateAt2 = s.checkCardCondition('resonanceAtLeast(3)', card, enemy.id, mkState());

    // resonanceBurst(n): spend the whole pool for n damage per point.
    enemy.block = 0; enemy.maxHp = 500; enemy.hp = 500;
    s.flock.hp = s.flock.maxHp; s.flock.flow = 0; // Holding (no formation modifier)
    s.spark = 4;
    s.resolveCardEffect('resonanceBurst(2)', card, enemy.id, mkState());
    return { gateAt3, gateAt2, burstDamage: 500 - enemy.hp, sparkAfterBurst: s.spark };
  });
  expect(r.gateAt3).toBe(true);   // 3 banked clears the 3+ gate
  expect(r.gateAt2).toBe(false);  // 2 banked does not
  expect(r.sparkAfterBurst).toBe(0);                 // burst empties the pool
  expect(r.burstDamage).toBeGreaterThanOrEqual(8);   // 4 Resonance x 2 = 8 (+ deck damage bonus)
});

test('Winded stacking matters: perWinded scaling, windedAtLeast gate, consuming burst, overheal Cover', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && (!(s.hand && s.hand.length) || !s.fxLayer); i += 1) await wait(50);
    const card = s.hand[0];
    const enemy = s.enemies[0];
    const mkState = () => ({ previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false });
    s.flock.hp = s.flock.maxHp; s.flock.flow = 0; // Holding (no formation modifier)

    // windedAtLeast(N) threshold gate.
    enemy.weak = 3;
    const gate3 = s.checkCardCondition('windedAtLeast(3)', card, enemy.id, mkState());
    enemy.weak = 2;
    const gate2 = s.checkCardCondition('windedAtLeast(3)', card, enemy.id, mkState());

    // perWinded: damage scales with the target's Winded stacks (no consume).
    enemy.block = 0; enemy.maxHp = 500; enemy.hp = 500; enemy.weak = 3;
    s.resolveCardEffect('damage(target, 2 perWinded)', card, enemy.id, mkState());
    const perWindedDamage = 500 - enemy.hp;     // 2 x 3 (+ deck damage bonus)
    const weakAfterScale = enemy.weak;          // unchanged — perWinded does not consume

    // windedBurst: consume ALL Winded for damage per stack.
    enemy.hp = 500; enemy.weak = 4; enemy.block = 0;
    s.resolveCardEffect('windedBurst(2)', card, enemy.id, mkState());
    const burstDamage = 500 - enemy.hp;         // 2 x 4 (+ deck damage bonus)
    const weakAfterBurst = enemy.weak;          // 0

    // overheal → temp Cover (opt-in: healFlock with overflowToCover = true).
    s.flock.maxHp = 40; s.flock.hp = 38; s.flock.block = 0;
    s.healFlock(10, 'test', true);              // heals 2 to full, 8 spills to Cover
    return { gate3, gate2, perWindedDamage, weakAfterScale, burstDamage, weakAfterBurst, hp: s.flock.hp, cover: s.flock.block };
  });
  expect(r.gate3).toBe(true);
  expect(r.gate2).toBe(false);
  expect(r.perWindedDamage).toBeGreaterThanOrEqual(6); // 2 x 3 Winded
  expect(r.weakAfterScale).toBe(3);                    // perWinded left the stacks
  expect(r.weakAfterBurst).toBe(0);                    // burst consumed them
  expect(r.burstDamage).toBeGreaterThanOrEqual(8);     // 2 x 4 Winded
  expect(r.hp).toBe(40);                               // healed to full
  expect(r.cover).toBeGreaterThanOrEqual(8);           // overheal became Cover
});

test('elite encounters spawn multiple enemies: every enemy telegraphs, all act, and all must fall', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    // Boot a normal battle so create() builds root/fxLayer; let it settle.
    await window.__birdSquadStartScene!('BattleScene', {});
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.hand && s.hand.length); i += 1) await wait(50);
    // Build a fixed-seed runState from the live run so re-init reuses ONE cached
    // procedural map — the one we mutate is the one the next fight reads.
    const deck = [...s.drawPile, ...s.hand, ...s.discardPile].map((c: any) => ({ id: c.id, upgraded: !!c.upgraded }));
    const runState = {
      deck, leaderId: s.runLeaderId, difficulty: 0, seed: 'elite-multi-test', currentHp: 36,
      scrap: 0, routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [],
      currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
    };
    // First re-init caches the fixed-seed map (no render, no scene teardown).
    s.init({ runState });
    // Repoint a real combat node at the elite "Gutter Baron" encounter (an elite
    // bruiser + rat escorts), then re-init there and redraw — exercises the
    // multi-enemy spawn + render path.
    const map = (window as any).__birdSquadCurrentMap();
    const node = map.nodes.find((n: any) => ['street', 'rival', 'boss'].includes(n.type));
    node.payloadId = 'enc_gutter_baron';
    s.init({ runState, routeNodeId: node.id });
    s.renderAll();

    const countCrests = (items: any[]): number => items.reduce((sum, child) => {
      const self = child.texture?.key === 'ui-icon-combat-elite-crest' ? 1 : 0;
      const nested = Array.isArray(child.list) ? countCrests(child.list) : 0;
      return sum + self + nested;
    }, 0);
    const names = s.enemies.map((e: any) => e.name);
    const types = s.enemies.map((e: any) => e.runtime.type);
    const snap = window.__birdSquadState!();
    const crestObjects = countCrests(s.root?.list ?? s.children.list);
    const intentsBefore = s.enemies.map((e: any) => e.intentIndex);
    const flockBefore = s.flock.hp;

    // Resolve a full enemy phase: EVERY living enemy should take its move.
    s.resolveEnemyTurn();
    const intentsAfter = s.enemies.map((e: any) => e.intentIndex);
    const flockAfter = s.flock.hp;

    // Targeting stays per-enemy: damaging only one escort leaves the elite alive,
    // so victory must require clearing the whole encounter (checkOutcome uses .every).
    const escort = s.enemies.find((e: any) => e.runtime.type !== 'elite');
    escort.hp = 0;
    const allDownAfterOne = s.enemies.every((e: any) => e.hp <= 0);

    return {
      count: s.enemies.length,
      names,
      types,
      hasElite: types.includes('elite'),
      combatEliteCrest: snap.combatEliteCrest,
      crestObjects,
      eliteBadges: s.root.list.filter((o: any) => o.name === 'combat-elite-badge').length,
      snapCount: snap.enemies.length,
      snapIntents: snap.enemies.map((e: any) => e.intent),
      intentsBefore,
      intentsAfter,
      flockBefore,
      flockAfter,
      allDownAfterOne,
    };
  });

  expect(r.count).toBe(3);                       // every authored encounter enemy spawned
  expect(r.snapCount).toBe(3);                   // and every enemy is exposed to the UI/harness
  expect(r.hasElite).toBe(true);                 // one carries the elite tier
  // Rank now occupies the bounded label stack, not the old floating art crest.
  expect(r.combatEliteCrest).toEqual({ loaded: true, rendered: false, count: 0 });
  expect(r.crestObjects).toBe(0);
  expect(r.eliteBadges).toBe(1);
  expect(r.names).toContain('Gutter Baron');
  for (const intent of r.snapIntents) expect(typeof intent).toBe('string'); // each telegraphs
  // a full enemy phase advances EVERY enemy's move counter, not just the first
  expect(r.intentsAfter).toEqual(r.intentsBefore.map((n: number) => n + 1));
  expect(r.flockAfter).toBeLessThan(r.flockBefore); // both attackers contributed damage
  expect(r.allDownAfterOne).toBe(false);         // killing one does not end the fight
});

test('multi-enemy elite formation stays readable at the minimum viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await boot(page);
  const state = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const game = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', {});
    game.scene.stop('MenuScene');
    const scene: any = game.scene.getScene('BattleScene');
    for (let attempt = 0; attempt < 80 && !(scene.hand?.length); attempt += 1) await wait(50);
    const deck = [...scene.drawPile, ...scene.hand, ...scene.discardPile]
      .map((card: any) => ({ id: card.id, upgraded: Boolean(card.upgraded) }));
    const runState = {
      deck,
      leaderId: scene.runLeaderId,
      difficulty: 0,
      seed: 'elite-multi-layout',
      currentHp: 36,
      scrap: 0,
      routeMarks: [],
      supplies: [],
      mapIndex: 0,
      completedRouteNodeIds: [],
      currentRouteNodeId: undefined,
      routeLog: [],
      nextCombat: undefined,
      signalChoices: [],
      rewardEvents: [],
    };
    scene.init({ runState });
    const map = window.__birdSquadCurrentMap!();
    const node = map.nodes.find((candidate: any) => ['street', 'rival', 'boss'].includes(candidate.type));
    node.payloadId = 'enc_gutter_baron';
    await window.__birdSquadStartScene!('BattleScene', { runState, routeNodeId: node.id });
    const activeScene: any = game.scene.getScene('BattleScene');
    activeScene.mode = 'battle';
    activeScene.combatAnimationPending = false;
    activeScene.combatIntroActive = false;
    activeScene.combatIntroDismissed = true;
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const readiness = JSON.parse(window.render_game_to_text?.() ?? '{}').assetReadiness;
      if (readiness?.fullArt && activeScene.battleForegroundRendererModule) break;
      await wait(50);
    }
    activeScene.renderAll();
    await wait(80);
    const rendered = JSON.parse(window.render_game_to_text!());
    const collect = (items: any[]): any[] => items.flatMap((child: any) => [
      child,
      ...(Array.isArray(child.list) ? collect(child.list) : []),
    ]);
    const objects = collect(activeScene.root?.list ?? activeScene.children.list);
    const bounds = (object: any) => {
      const value = object.getBounds();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    const overlaps = (a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>) => (
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    );
    const bars = objects.filter((object: any) => object.name === 'combat-enemy-vitals');
    const badges = objects.filter((object: any) => object.name === 'combat-enemy-intent-badge');
    const formation = activeScene.enemies.map((enemy: any) => {
      const label: any = objects.find((object: any) => object.name === 'combat-enemy-name' && object.getData('enemyId') === enemy.id);
      const hpValue: any = objects.find((object: any) => object.name === 'combat-enemy-hp-value' && object.getData('enemyId') === enemy.id);
      const bar: any = bars.find((object: any) => object.getData('enemyId') === enemy.id);
      const barBounds = bounds(bar);
      const badge: any = badges.find((object: any) => object.getData('enemyId') === enemy.id);
      const badgeBounds = bounds(badge);
      const badgeGap = bounds(label).top - badgeBounds.bottom;
      const foreignBars = bars.filter((candidate: any) => candidate !== bar).map(bounds);
      const foreignBadges = badges.filter((candidate: any) => candidate !== badge).map(bounds);
      return {
        id: enemy.id,
        name: enemy.name,
        bar: barBounds,
        badge: badgeBounds,
        badgeGap,
        badgeContained: badgeBounds.left >= barBounds.left && badgeBounds.right <= barBounds.right
          && badgeBounds.top >= barBounds.top && badgeBounds.bottom <= barBounds.bottom,
        overlapsForeignBar: foreignBars.some((candidate: ReturnType<typeof bounds>) => overlaps(badgeBounds, candidate)),
        overlapsForeignBadge: foreignBadges.some((candidate: ReturnType<typeof bounds>) => overlaps(badgeBounds, candidate)),
        nameFits: bounds(label).left >= barBounds.left && bounds(label).right <= bounds(hpValue).left,
        hpFits: bounds(hpValue).right <= barBounds.right,
        fullName: label.getData('fullName'),
      };
    });
    return {
      mode: rendered.mode,
      enemies: rendered.enemies.map((enemy: any) => ({ name: enemy.name, intent: enemy.intent })),
      fullArt: rendered.assetReadiness.fullArt,
      formation,
    };
  });
  expect(state.mode).toBe('battle');
  expect(state.fullArt).toBe(true);
  expect(state.enemies).toHaveLength(3);
  expect(state.enemies.map((enemy: any) => enemy.name)).toContain('Gutter Baron');
  expect(state.enemies.every((enemy: any) => typeof enemy.intent === 'string' && enemy.intent.length > 0)).toBe(true);
  expect(state.formation).toHaveLength(3);
  for (const enemy of state.formation) {
    expect(enemy.badgeContained).toBe(true);
    expect(enemy.badgeGap).toBeLessThanOrEqual(10);
    expect(enemy.badgeGap).toBeGreaterThanOrEqual(0);
    expect(enemy.overlapsForeignBar).toBe(false);
    expect(enemy.overlapsForeignBadge).toBe(false);
    expect(enemy.nameFits).toBe(true);
    expect(enemy.hpFits).toBe(true);
    expect(enemy.fullName).toBe(enemy.name);
  }
  await page.locator('canvas').screenshot({
    path: '.artifacts/test-results/combat-multi-enemy-1000x560.png',
  });
});

test('defeated enemies cannot remain selected or receive stale target effects', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', {});
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.hand && s.hand.length); i += 1) await wait(50);
    const deck = [...s.drawPile, ...s.hand, ...s.discardPile].map((c: any) => ({ id: c.id, upgraded: !!c.upgraded }));
    const runState = {
      deck, leaderId: s.runLeaderId, difficulty: 0, seed: 'dead-target-test', currentHp: 36,
      scrap: 0, routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [],
      currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
    };
    s.init({ runState });
    const map = (window as any).__birdSquadCurrentMap();
    const node = map.nodes.find((n: any) => ['street', 'rival', 'boss'].includes(n.type));
    node.payloadId = 'enc_gutter_baron';
    s.init({ runState, routeNodeId: node.id });
    s.renderAll();

    const defeated = s.enemies[0];
    const survivor = s.enemies.find((enemy: any) => enemy.id !== defeated.id);
    const targetCard = s.hand.find((card: any) => card.target === 'enemy')
      ?? [...s.drawPile, ...s.discardPile].find((card: any) => card.target === 'enemy');
    if (!targetCard) throw new Error('Expected an enemy-target card for stale target smoke');
    if (!s.hand.includes(targetCard)) s.hand.push(targetCard);
    s.selectedEnemyId = defeated.id;
    s.damageEnemy(defeated.id, defeated.hp + 100, 'Test');
    s.renderAll();
    const selectedAfterDefeat = window.__birdSquadState!().selectedEnemy;
    const selectedAfterDefeatHp = s.enemies.find((enemy: any) => enemy.id === selectedAfterDefeat)?.hp ?? 0;

    const survivorHpBeforeStale = survivor.hp;
    const staleDamageResult = s.damageEnemy(defeated.id, 999, 'Stale Test');
    const survivorHpAfterStale = survivor.hp;

    s.selectedEnemyId = defeated.id;
    s.energy = 99;
    const survivorHpBeforeCard = survivor.hp;
    s.playCard(targetCard, defeated.id);
    const survivorHpAfterCard = survivor.hp;

    return {
      defeatedHp: defeated.hp,
      selectedAfterDefeat,
      selectedAfterDefeatHp,
      staleDamageResult,
      staleChangedSurvivor: survivorHpAfterStale !== survivorHpBeforeStale,
      cardRetargetedToSurvivor: survivorHpAfterCard < survivorHpBeforeCard,
      selectedAfterCard: window.__birdSquadState!().selectedEnemy,
    };
  });

  expect(r.defeatedHp).toBe(0);
  expect(r.selectedAfterDefeat).toBeTruthy();
  expect(r.selectedAfterDefeatHp).toBeGreaterThan(0);
  expect(r.staleDamageResult).toBe(false);
  expect(r.staleChangedSurvivor).toBe(false);
  expect(r.cardRetargetedToSurvivor).toBe(true);
  expect(r.selectedAfterCard).not.toBe('');
});

test('reward screens ignore end-turn input instead of restarting combat', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.hand && s.hand.length); i += 1) await wait(50);
    s.enemies.forEach((enemy: any) => { enemy.hp = 0; });
    s.checkOutcome();
    const before = window.__birdSquadState!();
    s.endTurn();
    const after = window.__birdSquadState!();
    return {
      beforeMode: before.mode,
      afterMode: after.mode,
      beforeRewards: before.rewardChoices.length,
      afterRewards: after.rewardChoices.length,
      afterEnemyHp: after.enemies[0]?.hp ?? 0,
    };
  });

  expect(['cardReward', 'waymarkReward']).toContain(r.beforeMode);
  expect(r.afterMode).toBe(r.beforeMode);
  expect(r.afterRewards).toBe(r.beforeRewards);
  expect(r.afterEnemyHp).toBe(0);
});

test('played cards leave hand before resolving discard effects', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    const deck = ['major_00', 'wands_02', 'wands_08', 'swords_02', 'wet_feathers', 'cups_03', 'pentacles_04', 'cups_ace', 'wands_02', 'cups_ace']
      .map((id) => ({ id }));
    await window.__birdSquadStartScene!('BattleScene', {
      runState: {
        deck, leaderId: 'fledgling', difficulty: 0, seed: 'discard-order-regression', currentHp: 39,
        scrap: 0, routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [],
        currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
      },
      routeNodeId: 'm1_entry',
    });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.hand && s.hand.length); i += 1) await wait(50);
    const card = [...s.hand, ...s.drawPile, ...s.discardPile].find((candidate: any) => candidate.id === 'wet_feathers');
    s.hand = s.hand.filter((candidate: any) => candidate.instanceId !== card.instanceId);
    s.drawPile = s.drawPile.filter((candidate: any) => candidate.instanceId !== card.instanceId);
    s.discardPile = s.discardPile.filter((candidate: any) => candidate.instanceId !== card.instanceId);
    s.hand.push(card);
    const discardBefore = s.discardPile.length;
    s.energy = 99;
    s.playCard(card, s.enemies[0].id);
    if (s.discardChoice) {
      const choice = s.hand.find((candidate: any) => candidate.instanceId !== card.instanceId);
      if (!choice) throw new Error('Expected another card for the discard choice');
      s.toggleDiscardChoice(choice.instanceId);
      s.confirmDiscardChoice();
      await wait(20);
    }
    const discarded = s.discardPile.slice(discardBefore).map((candidate: any) => candidate.id);
    return {
      discarded,
      handHasPlayedCard: s.hand.some((candidate: any) => candidate.instanceId === card.instanceId),
    };
  });

  expect(r.handHasPlayedCard).toBe(false);
  expect(r.discarded).toHaveLength(2);
  expect(r.discarded[0]).not.toBe('wet_feathers');
  expect(r.discarded[1]).toBe('wet_feathers');
});

test('enemy phase stops after lethal Cohesion damage and enemy Cover expires', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', {});
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.hand && s.hand.length); i += 1) await wait(50);
    const deck = [...s.drawPile, ...s.hand, ...s.discardPile].map((card: any) => ({ id: card.id, upgraded: !!card.upgraded }));
    const runState = {
      deck, leaderId: s.runLeaderId, difficulty: 0, seed: 'lethal-phase-regression', currentHp: 36,
      scrap: 0, routeMarks: [], supplies: [], mapIndex: 0, completedRouteNodeIds: [],
      currentRouteNodeId: undefined, routeLog: [], nextCombat: undefined, signalChoices: [], rewardEvents: [],
    };
    s.init({ runState });
    const map = (window as any).__birdSquadCurrentMap();
    const node = map.nodes.find((candidate: any) => ['street', 'rival', 'boss'].includes(candidate.type));
    node.payloadId = 'enc_gutter_baron';
    s.init({ runState, routeNodeId: node.id });
    s.renderAll();
    s.enemies.forEach((enemy: any) => { enemy.block = 7; });
    s.flock.hp = 1;
    s.flock.block = 0;
    const intentsBefore = s.enemies.map((enemy: any) => enemy.intentIndex);
    s.resolveEnemyTurn();
    return {
      hp: s.flock.hp,
      taken: s.statTaken,
      blocksAfter: s.enemies.map((enemy: any) => enemy.block),
      intentsBefore,
      intentsAfter: s.enemies.map((enemy: any) => enemy.intentIndex),
      log: s.log.slice(-4),
    };
  });

  expect(r.hp).toBe(0);
  expect(r.taken).toBe(1); // telemetry records Cohesion actually lost, not overkill damage
  expect(r.blocksAfter.every((block: number) => block === 0)).toBe(true);
  expect(r.intentsAfter).toEqual([r.intentsBefore[0] + 1, r.intentsBefore[1], r.intentsBefore[2]]);
  expect(r.log).toEqual(expect.arrayContaining([expect.stringContaining('Gutter Baron hits the flock for 11.')]));
  expect(r.log).toEqual(expect.arrayContaining([expect.stringContaining('Cover absorbed 0; 1 Cohesion lost.')]));
  expect(r.log.some((entry: string) => entry.includes('Roof Rat A hits'))).toBe(false);
});

test('fullyBlocksNextAttack checks the next incoming attack, not stale selection', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const g = window.__birdSquadGame;
    await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
    g.scene.stop('MenuScene');
    const s: any = g.scene.getScene('BattleScene');
    for (let i = 0; i < 30 && !(s.hand && s.hand.length); i += 1) await wait(50);
    const card = s.hand[0];
    const state = { previousDiscarded: 0, previousDamageDefeated: false, spentResonance: false, returnSelfToDraw: false, builtFlow: false };
    s.enemies[0].damageBonus = 0;
    s.enemies[0].nextAttackBonus = 0;
    s.selectedEnemyId = 'missing-enemy';
    s.flock.block = 6;
    const blocksNext = s.checkCardCondition('fullyBlocksNextAttack', card, 'missing-enemy', state);
    s.flock.block = 5;
    const shortNext = s.checkCardCondition('fullyBlocksNextAttack', card, 'missing-enemy', state);
    return { blocksNext, shortNext };
  });

  expect(r.blocksNext).toBe(true);
  expect(r.shortNext).toBe(false);
});

// These tests only start a combat and read state from it, so one booted page
// serves them all; each restarts BattleScene from its own route node.
test.describe('combat state reads', () => {
  let page: Page;
  test.beforeAll(async ({ browser }, info) => {
    page = await browser.newPage({ baseURL: info.project.use.baseURL });
    await boot(page);
  });
  test.afterAll(async () => { await page.close(); });

  test('battle hand is compact (no full effect text) and enemies expose intents', async () => {
    const state = await page.evaluate(async () => {
      const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
      const g = window.__birdSquadGame;
      await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
      g.scene.stop('MenuScene');
      // create() (which draws the opening hand) runs a tick after start.
      for (let i = 0; i < 20 && !(window.__birdSquadState?.()?.hand?.length); i += 1) await wait(50);
      return window.__birdSquadState!();
    });
    expect(state.hand.length).toBeGreaterThan(0);
    for (const card of state.hand) expect(card.text).toBeUndefined();
    for (const enemy of state.enemies) expect(typeof enemy.intent).toBe('string');
  });

  test('hand cards carry unique per-combat instance ids', async () => {
    const ids: string[] = await page.evaluate(async () => {
      const g = window.__birdSquadGame;
      await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
      g.scene.stop('MenuScene');
      return window.__birdSquadState!().hand.map((card: any) => card.instanceId);
    });
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(typeof id).toBe('string');
  });

  test('boss uses a scripted attack pattern that loops from move 2', async () => {
    const labels: string[] = await page.evaluate(async () => {
      const g = window.__birdSquadGame;
      await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_boss' });
      g.scene.stop('MenuScene');
      const boss = g.scene.getScene('BattleScene').enemies[0];
      const seq: string[] = [];
      for (let i = 0; i < 7; i += 1) {
        boss.intentIndex = i;
        seq.push(window.__birdSquadState!().enemies[0].intent);
      }
      return seq;
    });
    expect(labels[0]).toBe('Toll Line');
    expect(labels[4]).toBe('Heavy Strike 13');
    // turn 6 (index 5) repeats from move index 1 (loopFrom), not the opener.
    expect(labels[5]).toBe('Crowbar Tap 8');
    expect(labels[6]).toBe('Tar Toss 5');
  });

  test('combat tracks per-fight stats (damage dealt / taken / blocked)', async () => {
    const r = await page.evaluate(async () => {
      const g = window.__birdSquadGame;
      await window.__birdSquadStartScene!('BattleScene', { routeNodeId: 'm1_entry' });
      g.scene.stop('MenuScene');
      const scene: any = g.scene.getScene('BattleScene');
      const enemy = scene.enemies[0];
      scene.damageEnemy(enemy.id, 5, 'Test');
      scene.resolveEnemyEffect(enemy, 'damage(flock, 6)');
      return { dealt: scene.statDealt, taken: scene.statTaken + scene.statBlocked };
    });
    expect(r.dealt).toBeGreaterThanOrEqual(5);
    expect(r.taken).toBeGreaterThanOrEqual(1);
  });
});
