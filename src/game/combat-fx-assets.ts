import type { RuntimeImageAsset } from './runtime-images';
import Phaser from 'phaser';
import { birdAudio, GAME_WIDTH, motionState, combatPacingState } from '../main';
import { controlBindingCode, controlPanelOwnsInput, matchesControlAction } from './input-bindings';

import combatFxAtlasUrl from '../../assets/runtime/fx/combat-fx-atlas.webp';
import combatCardBackUrl from '../../assets/runtime/fx/combat-card-back.webp';
import combatTargetReticleUrl from '../../assets/runtime/fx/combat-target-reticle.webp';
import combatTargetLockPulseUrl from '../../assets/runtime/fx/combat-target-lock-pulse.webp';
import combatEncounterIntroUrl from '../../assets/runtime/fx/combat-encounter-intro.webp';
import combatTurnBannerUrl from '../../assets/runtime/fx/combat-turn-banner.webp';
import combatRoostHandoffUrl from '../../assets/runtime/fx/combat-roost-handoff.webp';
import combatPlayerTurnRallyUrl from '../../assets/runtime/fx/combat-player-turn-rally.webp';
import combatDefeatBurstUrl from '../../assets/runtime/fx/combat-defeat-burst.webp';
import combatImpactFlashUrl from '../../assets/runtime/fx/combat-impact-flash.webp';
import combatPlayerHitConfirmUrl from '../../assets/runtime/fx/combat-player-hit-confirm.webp';
import combatPlayerCommitSigilUrl from '../../assets/runtime/fx/combat-player-commit-sigil.webp';
import combatSupplyUseBurstUrl from '../../assets/runtime/fx/combat-supply-use-burst.webp';
import combatActionTrailUrl from '../../assets/runtime/fx/combat-action-trail.webp';
import combatCastFocusBurstUrl from '../../assets/runtime/fx/combat-cast-focus-burst.webp';
import combatWingbeatSpendUrl from '../../assets/runtime/fx/combat-wingbeat-spend.webp';
import combatEnemySwipeUrl from '../../assets/runtime/fx/combat-enemy-swipe.webp';
import combatCoverGuardUrl from '../../assets/runtime/fx/combat-cover-guard.webp';
import combatCoverBlockBurstUrl from '../../assets/runtime/fx/combat-cover-block-burst.webp';
import combatEnemyCoverBlockUrl from '../../assets/runtime/fx/combat-enemy-cover-block.webp';
import combatPerfectBraceRiposteUrl from '../../assets/runtime/fx/combat-perfect-brace-riposte.webp';
import combatPinnedOpeningStrikeUrl from '../../assets/runtime/fx/combat-pinned-opening-strike.webp';
import combatSparkEchoUrl from '../../assets/runtime/fx/combat-spark-echo.webp';
import combatOverflowShelterUrl from '../../assets/runtime/fx/combat-overflow-shelter.webp';
import combatFormationShiftUrl from '../../assets/runtime/fx/combat-formation-shift.webp';
import combatHealBloomUrl from '../../assets/runtime/fx/combat-heal-bloom.webp';
import combatEnemyMendUrl from '../../assets/runtime/fx/combat-enemy-mend.webp';
import combatEnemyCoverUrl from '../../assets/runtime/fx/combat-enemy-cover.webp';
import combatCoverShatterUrl from '../../assets/runtime/fx/combat-cover-shatter.webp';
import combatCardDrawUrl from '../../assets/runtime/fx/combat-card-draw.webp';
import combatDiscardSweepUrl from '../../assets/runtime/fx/combat-discard-sweep.webp';
import combatShuffleVortexUrl from '../../assets/runtime/fx/combat-shuffle-vortex.webp';
import combatFouledPressureUrl from '../../assets/runtime/fx/combat-fouled-pressure.webp';
import combatRuffledBreakUrl from '../../assets/runtime/fx/combat-ruffled-break.webp';
import combatResonanceSurgeUrl from '../../assets/runtime/fx/combat-resonance-surge.webp';
import combatResonanceSpendUrl from '../../assets/runtime/fx/combat-resonance-spend.webp';
import combatWingbeatSurgeUrl from '../../assets/runtime/fx/combat-wingbeat-surge.webp';
import combatWingbeatDrainUrl from '../../assets/runtime/fx/combat-wingbeat-drain.webp';
import combatWindedGustUrl from '../../assets/runtime/fx/combat-winded-gust.webp';
import combatFlowSurgeUrl from '../../assets/runtime/fx/combat-flow-surge.webp';
import combatCleanseBurstUrl from '../../assets/runtime/fx/combat-cleanse-burst.webp';
import combatBankCacheUrl from '../../assets/runtime/fx/combat-bank-cache.webp';
import combatThreatChargeUrl from '../../assets/runtime/fx/combat-threat-charge.webp';
import combatEnemyAttackTellUrl from '../../assets/runtime/fx/combat-enemy-attack-tell.webp';
import combatEnemySupportChargeUrl from '../../assets/runtime/fx/combat-enemy-support-charge.webp';
import combatEnemySupportTellUrl from '../../assets/runtime/fx/combat-enemy-support-tell.webp';
import combatEnemyWindupPlaqueUrl from '../../assets/runtime/fx/combat-enemy-windup-plaque.webp';
import combatEnemyCommitmentSealUrl from '../../assets/runtime/fx/combat-enemy-commitment-seal.webp';
import combatEnemyRecoveryAfterglowUrl from '../../assets/runtime/fx/combat-enemy-recovery-afterglow.webp';
import combatMoltShiftUrl from '../../assets/runtime/fx/combat-molt-shift.webp';
import combatOpenSkyGuardUrl from '../../assets/runtime/fx/combat-open-sky-guard.webp';
import combatOpenSkyExposureUrl from '../../assets/runtime/fx/combat-open-sky-exposure.webp';
import combatVictoryRallyUrl from '../../assets/runtime/fx/combat-victory-rally.webp';
import combatVictoryFanfareSigilUrl from '../../assets/runtime/fx/combat-victory-fanfare-sigil.webp';
import combatAtmosphereUrl from '../../assets/runtime/fx/combat-atmosphere-strip.webp';
import combatFloatingCalloutUrl from '../../assets/runtime/fx/combat-floating-callout.webp';
import combatFlockImpactBurstUrl from '../../assets/runtime/fx/combat-flock-impact-burst.webp';
import combatEnemyImpactContactUrl from '../../assets/runtime/fx/combat-enemy-impact-contact.webp';
import combatOverextensionWarningUrl from '../../assets/runtime/fx/combat-overextension-warning.webp';
import combatBossPhaseBreakUrl from '../../assets/runtime/fx/combat-boss-phase-break.webp';
import combatStatusCleanseSpecificUrl from '../../assets/runtime/fx/combat-status-cleanse-specific.webp';
import combatOpenSkyBreakUrl from '../../assets/runtime/fx/combat-open-sky-break.webp';
import combatCacheChoiceRevealUrl from '../../assets/runtime/fx/combat-cache-choice-reveal.webp';
import combatMoltTriggerChoiceUrl from '../../assets/runtime/fx/combat-molt-trigger-choice.webp';
import combatEnemyHeavyContactUrl from '../../assets/runtime/fx/combat-enemy-heavy-contact.webp';
import combatEnemyHealBeamUrl from '../../assets/runtime/fx/combat-enemy-heal-beam.webp';
import combatResourceOvercapUrl from '../../assets/runtime/fx/combat-resource-overcap.webp';

export function presentCombatRoostHandoff(host: any, x = 468, y = 382, scale = 1) {
  if (!host.textures.exists('combat-roost-handoff')) return;
  host.textures.get('combat-roost-handoff').setFilter(Phaser.Textures.FilterMode.LINEAR);
  const reduced = motionState().reduced;
  const s = Phaser.Math.Clamp(scale, 0.74, 1.12);
  const width = 560 * s;
  const height = width * (320 / 768);
  host.combatRoostHandoffBursts += 1;
  birdAudio.play('roostHandoff', 0.92);
  // The persistent turn badge carries the label; no full-board ceremony is
  // needed for the short handoff in the everyday pacing modes.
  if (combatPacingState().preference !== 'cinematic') return;

  const shadow = host.add.image(x - 6 * s, y + 12 * s, 'combat-roost-handoff')
    .setDisplaySize(width * 1.04, height * 1.04)
    .setTint(0x07101a)
    .setAlpha(reduced ? 0.32 : 0.42)
    .setName('combat-roost-handoff');
  const glow = host.add.image(x, y, 'combat-roost-handoff')
    .setDisplaySize(width * 1.1, height * 1.1)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(reduced ? 0.26 : 0.34)
    .setName('combat-roost-handoff');
  const crest = host.add.image(x, y, 'combat-roost-handoff')
    .setDisplaySize(width, height)
    .setAlpha(reduced ? 0.68 : 0.86)
    .setName('combat-roost-handoff');
  host.fxLayer.add([shadow, glow, crest]);
  host.fxGlowPulse(x - 38 * s, y + 6 * s, 0xe8c24a, 76 * s, 520, 0.12);
  host.fxMoteBurst(x + 14 * s, y + 8 * s, 0xffcf7a, {
    count: 18,
    speed: 118,
    lifespan: 520,
    scale: 0.48,
    gravityY: 18,
    spreadX: 180 * s,
    spreadY: 18,
  });

  if (reduced) {
    host.time.delayedCall(1100, () => {
      shadow.destroy();
      glow.destroy();
      crest.destroy();
    });
    return;
  }

  const handoffHoldMs = 520;
  host.tweens.add({
    targets: shadow,
    x: shadow.x + 18 * s,
    y: shadow.y + 2 * s,
    alpha: 0,
    delay: handoffHoldMs,
    duration: 780,
    ease: 'Cubic.easeOut',
    onComplete: () => shadow.destroy(),
  });
  host.tweens.add({
    targets: glow,
    x: x + 34 * s,
    scaleX: glow.scaleX * 1.1,
    scaleY: glow.scaleY * 0.92,
    alpha: 0,
    delay: handoffHoldMs,
    duration: 860,
    ease: 'Sine.easeOut',
    onComplete: () => glow.destroy(),
  });
  host.tweens.add({
    targets: crest,
    x: x + 46 * s,
    y: y - 4 * s,
    scaleX: crest.scaleX * 1.06,
    scaleY: crest.scaleY * 0.96,
    alpha: 0,
    delay: handoffHoldMs,
    duration: 920,
    ease: 'Cubic.easeOut',
    onComplete: () => crest.destroy(),
  });
}

export function presentCombatPlayerTurnRally(host: any, x = GAME_WIDTH / 2, y = 276, scale = 1) {
  if (!host.textures.exists('combat-player-turn-rally')) return;
  host.textures.get('combat-player-turn-rally').setFilter(Phaser.Textures.FilterMode.LINEAR);
  const reduced = motionState().reduced;
  const s = Phaser.Math.Clamp(scale, 0.74, 1.08);
  const width = 560 * s;
  const height = width * (320 / 768);
  host.combatPlayerTurnRallyBursts += 1;
  birdAudio.play('playerTurnRally', 0.9);
  if (combatPacingState().preference !== 'cinematic') return;

  const shadow = host.add.image(x, y + 16 * s, 'combat-player-turn-rally')
    .setDisplaySize(width * 1.04, height * 1.04)
    .setTint(0x04121a)
    .setAlpha(reduced ? 0.3 : 0.38)
    .setName('combat-player-turn-rally');
  const glow = host.add.image(x, y, 'combat-player-turn-rally')
    .setDisplaySize(width * 1.12, height * 1.12)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(reduced ? 0.3 : 0.42)
    .setTint(0x8fffe8)
    .setName('combat-player-turn-rally');
  const crest = host.add.image(x, y, 'combat-player-turn-rally')
    .setDisplaySize(width, height)
    .setAlpha(reduced ? 0.74 : 0.9)
    .setName('combat-player-turn-rally');
  host.fxLayer.add([shadow, glow, crest]);
  host.fxLayer.setDepth(84);
  host.children.bringToTop(host.fxLayer);
  host.fxGlowPulse(x, y + 2 * s, 0x8fffe8, 92 * s, 650, 0.16);
  host.fxMoteBurst(x, y + 10 * s, 0x8fffe8, {
    count: 18,
    speed: 126,
    lifespan: 600,
    scale: 0.52,
    gravityY: -12,
    spreadX: 230 * s,
    spreadY: 34,
  });
  host.fxMoteBurst(x, y + 20 * s, 0xffd37a, {
    count: 10,
    speed: 102,
    lifespan: 520,
    scale: 0.44,
    gravityY: -8,
    spreadX: 190 * s,
    spreadY: 28,
  });

  if (reduced) {
    host.time.delayedCall(1150, () => {
      shadow.destroy();
      glow.destroy();
      crest.destroy();
    });
    return;
  }

  const holdMs = 560;
  host.tweens.add({
    targets: shadow,
    y: shadow.y + 10 * s,
    alpha: 0,
    delay: holdMs,
    duration: 760,
    ease: 'Cubic.easeOut',
    onComplete: () => shadow.destroy(),
  });
  host.tweens.add({
    targets: glow,
    scaleX: glow.scaleX * 1.16,
    scaleY: glow.scaleY * 1.02,
    alpha: 0,
    delay: holdMs,
    duration: 840,
    ease: 'Sine.easeOut',
    onComplete: () => glow.destroy(),
  });
  host.tweens.add({
    targets: crest,
    y: y - 8 * s,
    scaleX: crest.scaleX * 1.08,
    scaleY: crest.scaleY * 0.98,
    alpha: 0,
    delay: holdMs,
    duration: 920,
    ease: 'Cubic.easeOut',
    onComplete: () => crest.destroy(),
  });
}

export function presentEnemyCommitmentSeal(host: any, enemy: any, move: any, flockX: number, flockY: number) {
  if (!host.textures.exists('combat-enemy-commitment-seal')) return;
  host.textures.get('combat-enemy-commitment-seal').setFilter(Phaser.Textures.FilterMode.LINEAR);
  const view = host.enemyView(enemy);
  const damage = Math.max(1, host.incomingAttackDamage(enemy));
  const reduced = motionState().reduced;
  const x = Phaser.Math.Linear(view.x, flockX, 0.38);
  const y = Phaser.Math.Linear(view.y, flockY, 0.34) - 26 * view.scale;
  const size = (enemy.runtime.type === 'boss' ? 226 : 178) * view.scale * Phaser.Math.Clamp(0.94 + damage * 0.018, 0.98, 1.12);
  const holdMs = host.combatTimingDelay(ENEMY_ATTACK_RELEASE_MS + ENEMY_ATTACK_IMPACT_ANTICIPATION_MS + ENEMY_ATTACK_IMPACT_HOLD_MS, host.enemyMoveTimingScale(enemy, move));
  host.combatEnemyCommitmentSealBursts += 1;
  birdAudio.play('enemyCommitment', Phaser.Math.Clamp(0.76 + damage * 0.045, 0.84, 1.28));

  const shadow = host.add.image(x + 10 * view.scale, y + 14 * view.scale, 'combat-enemy-commitment-seal')
    .setDisplaySize(size * 1.04, size * 1.04)
    .setAlpha(reduced ? 0.26 : 0.36)
    .setTint(0x150807)
    .setName('combat-enemy-commitment-seal');
  const glow = host.add.image(x, y, 'combat-enemy-commitment-seal')
    .setDisplaySize(size * 1.12, size * 1.12)
    .setAlpha(reduced ? 0.3 : 0.44)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(0xff8a42)
    .setName('combat-enemy-commitment-seal');
  const seal = host.add.image(x, y, 'combat-enemy-commitment-seal')
    .setDisplaySize(size, size)
    .setAlpha(reduced ? 0.88 : 0.96)
    .setName('combat-enemy-commitment-seal');
  host.fxLayer.add([shadow, glow, seal]);
  host.fxLayer.setDepth(86);
  host.children.bringToTop(host.fxLayer);

  if (reduced) {
    host.time.delayedCall(Math.max(420, holdMs), () => {
      shadow.destroy();
      glow.destroy();
      seal.destroy();
    });
    return;
  }

  host.fxGlowPulse(x, y, 0xff7a42, 92 * view.scale, 520, 0.16);
  host.fxMoteBurst(x, y + 16 * view.scale, 0xff9d4d, {
    count: Phaser.Math.Clamp(8 + damage, 10, 22),
    speed: 110 + damage * 3,
    lifespan: Math.max(520, Math.min(980, holdMs - 180)),
    scale: 0.42,
    gravityY: 8,
    spreadX: 20,
    spreadY: 12,
  });
  host.tweens.add({
    targets: [seal, glow],
    scaleX: '+=0.08',
    scaleY: '+=0.08',
    duration: 260,
    yoyo: true,
    repeat: 1,
    ease: 'Sine.easeInOut',
  });
  host.tweens.add({
    targets: [shadow, glow, seal],
    alpha: 0,
    duration: 420,
    delay: Math.max(420, holdMs - 420),
    ease: 'Cubic.easeIn',
    onComplete: () => {
      shadow.destroy();
      glow.destroy();
      seal.destroy();
    },
  });
}

export interface CombatFxSpritesheetAsset extends RuntimeImageAsset {
  frameWidth: number;
  frameHeight: number;
}

export const combatFxSpritesheetAssets: CombatFxSpritesheetAsset[] = [
  { key: 'combat-fx-atlas', url: combatFxAtlasUrl, frameWidth: 64, frameHeight: 64 },
  { key: 'combat-atmosphere-strip', url: combatAtmosphereUrl, frameWidth: 256, frameHeight: 96 },
];

export const combatFxImageAssets: RuntimeImageAsset[] = [
  { key: 'combat-card-back', url: combatCardBackUrl },
  { key: 'combat-target-reticle', url: combatTargetReticleUrl },
  { key: 'combat-target-lock-pulse', url: combatTargetLockPulseUrl },
  { key: 'combat-encounter-intro', url: combatEncounterIntroUrl },
  { key: 'combat-turn-banner', url: combatTurnBannerUrl },
  { key: 'combat-roost-handoff', url: combatRoostHandoffUrl },
  { key: 'combat-player-turn-rally', url: combatPlayerTurnRallyUrl },
  { key: 'combat-defeat-burst', url: combatDefeatBurstUrl },
  { key: 'combat-impact-flash', url: combatImpactFlashUrl },
  { key: 'combat-player-hit-confirm', url: combatPlayerHitConfirmUrl },
  { key: 'combat-player-commit-sigil', url: combatPlayerCommitSigilUrl },
  { key: 'combat-supply-use-burst', url: combatSupplyUseBurstUrl },
  { key: 'combat-action-trail', url: combatActionTrailUrl },
  { key: 'combat-cast-focus-burst', url: combatCastFocusBurstUrl },
  { key: 'combat-wingbeat-spend', url: combatWingbeatSpendUrl },
  { key: 'combat-enemy-swipe', url: combatEnemySwipeUrl },
  { key: 'combat-cover-guard', url: combatCoverGuardUrl },
  { key: 'combat-cover-block-burst', url: combatCoverBlockBurstUrl },
  { key: 'combat-enemy-cover-block', url: combatEnemyCoverBlockUrl },
  { key: 'combat-perfect-brace-riposte', url: combatPerfectBraceRiposteUrl },
  { key: 'combat-pinned-opening-strike', url: combatPinnedOpeningStrikeUrl },
  { key: 'combat-spark-echo', url: combatSparkEchoUrl },
  { key: 'combat-overflow-shelter', url: combatOverflowShelterUrl },
  { key: 'combat-formation-shift', url: combatFormationShiftUrl },
  { key: 'combat-heal-bloom', url: combatHealBloomUrl },
  { key: 'combat-enemy-mend', url: combatEnemyMendUrl },
  { key: 'combat-enemy-cover', url: combatEnemyCoverUrl },
  { key: 'combat-cover-shatter', url: combatCoverShatterUrl },
  { key: 'combat-card-draw', url: combatCardDrawUrl },
  { key: 'combat-discard-sweep', url: combatDiscardSweepUrl },
  { key: 'combat-shuffle-vortex', url: combatShuffleVortexUrl },
  { key: 'combat-fouled-pressure', url: combatFouledPressureUrl },
  { key: 'combat-ruffled-break', url: combatRuffledBreakUrl },
  { key: 'combat-resonance-surge', url: combatResonanceSurgeUrl },
  { key: 'combat-resonance-spend', url: combatResonanceSpendUrl },
  { key: 'combat-wingbeat-surge', url: combatWingbeatSurgeUrl },
  { key: 'combat-wingbeat-drain', url: combatWingbeatDrainUrl },
  { key: 'combat-winded-gust', url: combatWindedGustUrl },
  { key: 'combat-flow-surge', url: combatFlowSurgeUrl },
  { key: 'combat-cleanse-burst', url: combatCleanseBurstUrl },
  { key: 'combat-bank-cache', url: combatBankCacheUrl },
  { key: 'combat-threat-charge', url: combatThreatChargeUrl },
  { key: 'combat-enemy-attack-tell', url: combatEnemyAttackTellUrl },
  { key: 'combat-enemy-support-charge', url: combatEnemySupportChargeUrl },
  { key: 'combat-enemy-support-tell', url: combatEnemySupportTellUrl },
  { key: 'combat-enemy-windup-plaque', url: combatEnemyWindupPlaqueUrl },
  { key: 'combat-enemy-commitment-seal', url: combatEnemyCommitmentSealUrl },
  { key: 'combat-enemy-recovery-afterglow', url: combatEnemyRecoveryAfterglowUrl },
  { key: 'combat-molt-shift', url: combatMoltShiftUrl },
  { key: 'combat-open-sky-guard', url: combatOpenSkyGuardUrl },
  { key: 'combat-open-sky-exposure', url: combatOpenSkyExposureUrl },
  { key: 'combat-victory-rally', url: combatVictoryRallyUrl },
  { key: 'combat-victory-fanfare-sigil', url: combatVictoryFanfareSigilUrl },
  { key: 'combat-floating-callout', url: combatFloatingCalloutUrl },
  { key: 'combat-flock-impact-burst', url: combatFlockImpactBurstUrl },
  { key: 'combat-enemy-impact-contact', url: combatEnemyImpactContactUrl },
  { key: 'combat-overextension-warning', url: combatOverextensionWarningUrl },
  { key: 'combat-boss-phase-break', url: combatBossPhaseBreakUrl },
  { key: 'combat-status-cleanse-specific', url: combatStatusCleanseSpecificUrl },
  { key: 'combat-open-sky-break', url: combatOpenSkyBreakUrl },
  { key: 'combat-cache-choice-reveal', url: combatCacheChoiceRevealUrl },
  { key: 'combat-molt-trigger-choice', url: combatMoltTriggerChoiceUrl },
  { key: 'combat-enemy-heavy-contact', url: combatEnemyHeavyContactUrl },
  { key: 'combat-enemy-heal-beam', url: combatEnemyHealBeamUrl },
  { key: 'combat-resource-overcap', url: combatResourceOvercapUrl },
];

const essentialCombatFxKeys = new Set([
  'combat-card-back',
  'combat-target-reticle',
  'combat-target-lock-pulse',
  'combat-encounter-intro',
  'combat-turn-banner',
  'combat-player-turn-rally',
  'combat-impact-flash',
  'combat-player-hit-confirm',
  'combat-player-commit-sigil',
  'combat-action-trail',
  'combat-cast-focus-burst',
  'combat-wingbeat-spend',
  'combat-cover-guard',
  'combat-cover-block-burst',
  'combat-enemy-cover-block',
]);

const enemyTurnCombatFxKeys = new Set([
  'combat-roost-handoff',
  'combat-defeat-burst',
  'combat-enemy-swipe',
  'combat-enemy-attack-tell',
  'combat-enemy-support-charge',
  'combat-enemy-support-tell',
  'combat-enemy-windup-plaque',
  'combat-enemy-commitment-seal',
  'combat-enemy-recovery-afterglow',
  'combat-threat-charge',
  'combat-flock-impact-burst',
  'combat-enemy-impact-contact',
]);

// These textures cannot contribute to the opening player decision. Keep them
// out of the first-combat optional batch and warm them from the player's first
// committed action instead. Boss/elite encounters request the pack during
// setup so their phase-break feedback remains immediately available.
const outcomeCombatFxKeys = new Set([
  'combat-victory-rally',
  'combat-victory-fanfare-sigil',
  'combat-boss-phase-break',
]);

export const essentialCombatFxImageAssets = combatFxImageAssets.filter((asset) => essentialCombatFxKeys.has(asset.key));
export const enemyTurnCombatFxImageAssets = combatFxImageAssets.filter((asset) => enemyTurnCombatFxKeys.has(asset.key));
export const outcomeCombatFxImageAssets = combatFxImageAssets.filter((asset) => outcomeCombatFxKeys.has(asset.key));
export const optionalCombatFxImageAssets = combatFxImageAssets.filter((asset) =>
  !essentialCombatFxKeys.has(asset.key)
  && !enemyTurnCombatFxKeys.has(asset.key)
  && !outcomeCombatFxKeys.has(asset.key)
);

type EnemyTurnBeat = 'idle' | 'preamble' | 'windup' | 'release' | 'impact' | 'recovery' | 'interlude';

export interface EnemyTurnAccelerationState {
  available: boolean;
  eligible: boolean;
  held: boolean;
  active: boolean;
  multiplier: number;
}

const HUSTLE_MULTIPLIER = 2.2;
const HUSTLE_MINIMUM_MS: Partial<Record<EnemyTurnBeat, number>> = {
  windup: 280,
  release: 120,
  recovery: 100,
  interlude: 80,
};

class EnemyTurnAccelerationController {
  private timer?: Phaser.Time.TimerEvent;
  private thresholdTimer?: Phaser.Time.TimerEvent;
  private beat: EnemyTurnBeat = 'idle';
  private available = false;
  private keyboardHeld = false;
  private keyboardCodeHeld?: string;
  private pointerHeld = false;
  private gamepadHeld = false;
  private active = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onChange: () => void,
  ) {
    scene.input.keyboard?.on('keydown', this.onKeyboardDown);
    scene.input.keyboard?.on('keyup', this.onKeyboardUp);
    scene.input.keyboard?.on('keydown-SPACE', this.onKeyboardDown);
    scene.input.keyboard?.on('keyup-SPACE', this.onKeyboardUp);
    scene.input.on('pointerdown', this.onPointerDown);
    scene.input.on('pointerup', this.onPointerUp);
    scene.events.on('update', this.updateGamepad, this);
    scene.events.once('shutdown', this.destroy, this);
    scene.events.once('destroy', this.destroy, this);
  }

  setBeat(beat: EnemyTurnBeat, available = false) {
    this.thresholdTimer?.remove(false);
    this.thresholdTimer = undefined;
    if (this.timer) this.timer.timeScale = 1;
    this.timer = undefined;
    this.beat = beat;
    this.available = available && HUSTLE_MINIMUM_MS[beat] !== undefined;
    this.active = false;
    if (beat === 'idle') {
      this.keyboardHeld = false;
      this.keyboardCodeHeld = undefined;
      this.pointerHeld = false;
      this.gamepadHeld = false;
    }
  }

  schedule(delay: number, callback: () => void) {
    const timer = this.scene.time.delayedCall(delay, () => {
      this.thresholdTimer?.remove(false);
      this.thresholdTimer = undefined;
      this.timer = undefined;
      this.active = false;
      callback();
    });
    this.timer = timer;
    const minimum = Math.min(delay, HUSTLE_MINIMUM_MS[this.beat] ?? delay);
    if (this.available && minimum < delay) {
      this.thresholdTimer = this.scene.time.delayedCall(minimum, () => {
        this.thresholdTimer = undefined;
        this.sync();
      });
    }
    this.sync();
    return timer;
  }

  elapsed() {
    return this.available && this.timer ? this.timer.getElapsed() : undefined;
  }

  state(): EnemyTurnAccelerationState {
    const held = this.keyboardHeld || this.pointerHeld || this.gamepadHeld;
    const minimum = HUSTLE_MINIMUM_MS[this.beat] ?? Number.POSITIVE_INFINITY;
    return {
      available: this.available,
      eligible: this.available && !!this.timer && this.timer.getElapsed() >= minimum,
      held,
      active: this.active,
      multiplier: HUSTLE_MULTIPLIER,
    };
  }

  destroy() {
    this.setBeat('idle');
    this.scene.input.keyboard?.off('keydown', this.onKeyboardDown);
    this.scene.input.keyboard?.off('keyup', this.onKeyboardUp);
    this.scene.input.keyboard?.off('keydown-SPACE', this.onKeyboardDown);
    this.scene.input.keyboard?.off('keyup-SPACE', this.onKeyboardUp);
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.scene.input.off('pointerup', this.onPointerUp);
    this.scene.events.off('update', this.updateGamepad, this);
    this.scene.events.off('shutdown', this.destroy, this);
    this.scene.events.off('destroy', this.destroy, this);
  }

  private readonly onKeyboardDown = (event?: KeyboardEvent) => {
    if (controlPanelOwnsInput(this.scene)) return;
    if (event ? !matchesControlAction(event, 'hustle') : controlBindingCode('hustle') !== 'Space') return;
    this.keyboardHeld = true;
    this.keyboardCodeHeld = event?.code ?? 'Space';
    this.sync();
  };

  private readonly onKeyboardUp = (event?: KeyboardEvent) => {
    if (event ? event.code !== this.keyboardCodeHeld : this.keyboardCodeHeld !== 'Space') return;
    this.keyboardHeld = false;
    this.keyboardCodeHeld = undefined;
    this.sync();
  };

  private readonly onPointerDown = () => {
    this.pointerHeld = true;
    this.sync();
  };

  private readonly onPointerUp = () => {
    this.pointerHeld = false;
    this.sync();
  };

  private updateGamepad() {
    const pad = this.scene.input.gamepad?.pad1;
    const held = !!pad?.connected && (pad.A || pad.R2 > 0.5);
    if (held === this.gamepadHeld) return;
    this.gamepadHeld = held;
    this.sync();
  }

  private sync() {
    const before = this.active;
    const state = this.state();
    this.active = state.eligible && state.held;
    if (this.timer) this.timer.timeScale = this.active ? HUSTLE_MULTIPLIER : 1;
    if (before !== this.active) this.onChange();
  }
}

const enemyTurnAccelerationControllers = new WeakMap<Phaser.Scene, EnemyTurnAccelerationController>();

export function initEnemyTurnAcceleration(scene: Phaser.Scene, onChange: () => void) {
  enemyTurnAccelerationControllers.get(scene)?.destroy();
  enemyTurnAccelerationControllers.set(scene, new EnemyTurnAccelerationController(scene, onChange));
}

export function enemyTurnAccelerationState(scene: Phaser.Scene): EnemyTurnAccelerationState {
  return enemyTurnAccelerationControllers.get(scene)?.state() ?? {
    available: false,
    eligible: false,
    held: false,
    active: false,
    multiplier: HUSTLE_MULTIPLIER,
  };
}

export function enemyTurnAccelerationElapsed(scene: Phaser.Scene) {
  return enemyTurnAccelerationControllers.get(scene)?.elapsed();
}

const ENEMY_ATTACK_WINDUP_MS = 2600;
const ENEMY_ATTACK_RELEASE_MS = 1800;
const ENEMY_ATTACK_IMPACT_ANTICIPATION_MS = 720;
const ENEMY_ATTACK_IMPACT_HOLD_MS = 1350;
const ENEMY_ATTACK_RECOVER_MS = 1450;
const ENEMY_ATTACK_INTERLUDE_MS = 120;

export function resolveEnemyTurnAnimated(
  host: any,
  getCurrentMove: (enemy: any) => any,
  dealsDamage: (move: any) => boolean,
  onComplete: () => void,
) {
  const controller = enemyTurnAccelerationControllers.get(host);
  const attackers = host.enemies.filter((candidate: any) => candidate.hp > 0);
  const setBeat = (beat: EnemyTurnBeat, move = '', duration = 0, available = false) => {
    controller?.setBeat(beat, available);
    host.setEnemyTurnBeat(beat, move, duration);
  };
  const schedule = (delay: number, callback: () => void) => controller?.schedule(delay, callback)
    ?? host.time.delayedCall(delay, callback);
  if (attackers.length === 0) {
    setBeat('idle');
    onComplete();
    return;
  }

  host.combatTurnBanner('Enemy Turn', '#ff9d6b', 0xff9d6b);
  host.enemies.forEach((enemy: any) => { enemy.block = 0; });
  let attackerIndex = 0;
  const preambleDelay = host.enemyTurnPreambleDelay();
  const interludeDelay = host.combatTimingDelay(ENEMY_ATTACK_INTERLUDE_MS);
  const finish = () => {
    host.tickOpenSkyAfterEnemyPhase();
    host.queueOptionalCombatFxAssetLoad();
    setBeat('idle');
    onComplete();
  };
  const abort = () => {
    setBeat('idle');
    onComplete();
  };
  const step = () => {
    if (host.mode !== 'battle' || host.flock.hp <= 0 || attackerIndex >= attackers.length) {
      finish();
      return;
    }
    const enemy = attackers[attackerIndex];
    attackerIndex += 1;
    if (enemy.hp <= 0) {
      step();
      return;
    }

    host.prepareEnemyMoveContext();
    const move = getCurrentMove(enemy);
    const moveTimingScale = host.enemyMoveTimingScale(enemy, move);
    const canHustle = moveTimingScale < 1 && host.runSeenEnemyMoves.has(host.enemyMovePacingKey(enemy, move));
    const windupDelay = host.combatTimingDelay(ENEMY_ATTACK_WINDUP_MS, moveTimingScale);
    const releaseDelay = host.combatTimingDelay(ENEMY_ATTACK_RELEASE_MS, moveTimingScale);
    const anticipationDelay = host.combatTimingDelay(ENEMY_ATTACK_IMPACT_ANTICIPATION_MS, moveTimingScale);
    const impactHoldDelay = host.combatTimingDelay(ENEMY_ATTACK_IMPACT_HOLD_MS, moveTimingScale);
    const recoveryDelay = host.combatTimingDelay(ENEMY_ATTACK_RECOVER_MS, moveTimingScale);
    setBeat('windup', move.label, windupDelay, canHustle);
    host.queueEnemyMotion(enemy.id, 'windup');
    host.playQueuedEnemyMotion(enemy.id);
    host.refreshBeatProgressBadge();
    host.enemyAttackWindupFx(enemy, move);
    schedule(windupDelay, () => {
      if (host.mode !== 'battle') return abort();
      setBeat('release', move.label, releaseDelay, canHustle);
      if (dealsDamage(move)) {
        host.queueEnemyMotion(enemy.id, 'attack');
        host.playQueuedEnemyMotion(enemy.id);
      }
      host.refreshBeatProgressBadge();
      host.enemyAttackCommitmentSealFx(enemy, move);
      host.enemyAttackReleaseFx(enemy, move);
      schedule(releaseDelay, () => {
        if (host.mode !== 'battle') return abort();
        setBeat('impact', move.label, anticipationDelay + impactHoldDelay);
        host.refreshBeatProgressBadge();
        schedule(anticipationDelay, () => {
          if (host.mode !== 'battle') return abort();
          for (const effect of move.effects) {
            if (host.flock.hp <= 0) break;
            host.resolveEnemyEffect(enemy, effect, move.label);
          }
          if (dealsDamage(move)) host.enemyMotionCues.delete(enemy.id);
          host.runSeenEnemyMoves.add(host.enemyMovePacingKey(enemy, move));
          host.advanceEnemyIntent(enemy);
          host.renderAll();
          schedule(impactHoldDelay, () => {
            if (host.mode !== 'battle') return abort();
            setBeat('recovery', move.label, recoveryDelay, canHustle);
            host.refreshBeatProgressBadge();
            host.enemyAttackRecoveryAfterglowFx(enemy, move);
            schedule(recoveryDelay, () => {
              if (host.mode !== 'battle') return abort();
              if (attackerIndex < attackers.length && host.flock.hp > 0) {
                setBeat('interlude', '', interludeDelay, canHustle);
                host.refreshBeatProgressBadge();
                schedule(interludeDelay, step);
                return;
              }
              step();
            });
          });
        });
      });
    });
  };

  setBeat('preamble', '', preambleDelay);
  schedule(preambleDelay, step);
  host.renderAll();
  host.combatRoostHandoff();
}
