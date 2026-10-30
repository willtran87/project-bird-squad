// Combat-only presentation. Loaded with the existing essential battle FX module.
import Phaser from 'phaser';
import { COMBAT_BANK_CACHE_TEXTURE, COMBAT_BOSS_PHASE_BREAK_TEXTURE, COMBAT_CACHE_CHOICE_REVEAL_TEXTURE, COMBAT_CARD_DRAW_TEXTURE, COMBAT_CLEANSE_BURST_TEXTURE, COMBAT_COVER_BLOCK_BURST_TEXTURE, COMBAT_COVER_GUARD_TEXTURE, COMBAT_COVER_SHATTER_TEXTURE, COMBAT_DEFEAT_BURST_TEXTURE, COMBAT_DISCARD_SWEEP_TEXTURE, COMBAT_ENEMY_ATTACK_TELL_TEXTURE, COMBAT_ENEMY_COVER_BLOCK_TEXTURE, COMBAT_ENEMY_COVER_TEXTURE, COMBAT_ENEMY_HEAL_BEAM_TEXTURE, COMBAT_ENEMY_HEAVY_CONTACT_TEXTURE, COMBAT_ENEMY_IMPACT_CONTACT_TEXTURE, COMBAT_ENEMY_MEND_TEXTURE, COMBAT_ENEMY_SUPPORT_CHARGE_TEXTURE, COMBAT_ENEMY_SUPPORT_TELL_TEXTURE, COMBAT_ENEMY_SWIPE_TEXTURE, COMBAT_FLOCK_IMPACT_BURST_TEXTURE, COMBAT_FLOW_SURGE_TEXTURE, COMBAT_FORMATION_SHIFT_TEXTURE, COMBAT_FOULED_PRESSURE_TEXTURE, COMBAT_HEAL_BLOOM_TEXTURE, COMBAT_IMPACT_FLASH_TEXTURE, COMBAT_MOLT_SHIFT_TEXTURE, COMBAT_MOLT_TRIGGER_CHOICE_TEXTURE, COMBAT_OPEN_SKY_BREAK_TEXTURE, COMBAT_OPEN_SKY_EXPOSURE_TEXTURE, COMBAT_OPEN_SKY_GUARD_TEXTURE, COMBAT_OVEREXTENSION_WARNING_TEXTURE, COMBAT_OVERFLOW_SHELTER_TEXTURE, COMBAT_PERFECT_BRACE_RIPOSTE_TEXTURE, COMBAT_PINNED_OPENING_STRIKE_TEXTURE, COMBAT_PLAYER_COMMIT_SIGIL_TEXTURE, COMBAT_PLAYER_HIT_CONFIRM_TEXTURE, COMBAT_RESONANCE_SPEND_TEXTURE, COMBAT_RESONANCE_SURGE_TEXTURE, COMBAT_RESOURCE_OVERCAP_TEXTURE, COMBAT_RUFFLED_BREAK_TEXTURE, COMBAT_SHUFFLE_VORTEX_TEXTURE, COMBAT_SPARK_ECHO_TEXTURE, COMBAT_STATUS_CLEANSE_SPECIFIC_TEXTURE, COMBAT_SUPPLY_USE_BURST_TEXTURE, COMBAT_THREAT_CHARGE_TEXTURE, COMBAT_TURN_BANNER_TEXTURE, COMBAT_VICTORY_FANFARE_SIGIL_TEXTURE, COMBAT_VICTORY_RALLY_TEXTURE, COMBAT_WINDED_GUST_TEXTURE, COMBAT_WINGBEAT_DRAIN_TEXTURE, COMBAT_WINGBEAT_SURGE_TEXTURE, ENEMY_ATTACK_WINDUP_MS, ENEMY_FX_X, ENEMY_FX_Y, FLOCK_FX_X, FLOCK_FX_Y, GAME_WIDTH, TOKEN_DISPLAY_FONT, banner, birdAudio, combatPacePreference, currentCombatNodes, currentFlashEffectsState, floatingText, prefersReducedMotion, suitFxMeta } from '../../main';
import type { ActiveCardContract, Card, FlockState } from '../../main';

export function combatImpactFlash(this: any, x: number, y: number, color: number, direction: 1 | -1 = 1, heavy = false): any {
    if (!this.textures.exists(COMBAT_IMPACT_FLASH_TEXTURE)) return;
    this.textures.get(COMBAT_IMPACT_FLASH_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const reducedFlashes = currentFlashEffectsState().reduced;
    this.fxGlowPulse(
      x,
      y + 4,
      color,
      heavy ? 92 : 66,
      heavy ? 420 : 320,
      reducedFlashes ? 0.08 : heavy ? 0.24 : 0.16,
    );
    if (reducedFlashes) return;
    this.combatImpactFlashBursts += 1;
    const scale = heavy ? 0.7 : 0.52;
    const flash = this.add.image(x, y, COMBAT_IMPACT_FLASH_TEXTURE)
      .setDisplaySize(384 * scale, 384 * scale)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(heavy ? 0.94 : 0.8)
      .setAngle(direction > 0 ? -18 : 162)
      .setName('combat-impact-flash');
    this.fxLayer.add(flash);
    if (prefersReducedMotion()) {
      this.time.delayedCall(120, () => flash.destroy());
      return;
    }
    this.tweens.add({
      targets: flash,
      scaleX: flash.scaleX * (heavy ? 1.2 : 1.12),
      scaleY: flash.scaleY * (heavy ? 1.2 : 1.12),
      x: x + direction * (heavy ? 22 : 14),
      y: y - (heavy ? 10 : 6),
      alpha: 0,
      duration: heavy ? 270 : 210,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

export function combatPlayerHitConfirm(this: any, x: number, y: number, color: number, heavy = false): any {
    if (!this.textures.exists(COMBAT_PLAYER_HIT_CONFIRM_TEXTURE)) return;
    this.textures.get(COMBAT_PLAYER_HIT_CONFIRM_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatPlayerHitConfirmBursts += 1;
    const size = heavy ? 128 : 92;
    const reducedMotion = prefersReducedMotion();
    const reducedFlashes = currentFlashEffectsState().reduced;
    const angle = Phaser.Math.Between(-10, 10);
    const glow = reducedFlashes
      ? undefined
      : this.add.image(x, y, COMBAT_PLAYER_HIT_CONFIRM_TEXTURE)
        .setDisplaySize(size * 1.16, size * 1.16)
        .setAlpha(reducedMotion ? 0.12 : heavy ? 0.22 : 0.16)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(color)
        .setAngle(angle)
        .setName('combat-player-hit-confirm');
    const burstSprite = this.add.image(x, y, COMBAT_PLAYER_HIT_CONFIRM_TEXTURE)
      .setDisplaySize(size, size)
      .setAlpha(reducedMotion ? 0.48 : heavy ? 0.74 : 0.64)
      .setAngle(angle)
      .setName('combat-player-hit-confirm');
    this.fxLayer.add(glow ? [glow, burstSprite] : [burstSprite]);
    if (reducedMotion) {
      this.time.delayedCall(160, () => {
        glow?.destroy();
        burstSprite.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: glow ? [glow, burstSprite] : [burstSprite],
      scaleX: `+=${heavy ? 0.08 : 0.06}`,
      scaleY: `+=${heavy ? 0.08 : 0.06}`,
      alpha: 0,
      duration: heavy ? 360 : 300,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        glow?.destroy();
        burstSprite.destroy();
      },
    });
  }

export function combatPlayerCommitSigil(this: any, _card: Card, _enemyId: string, _contract: ActiveCardContract, _holdMs: number): any {
    const cardCue = this.fxLayer.getByName('combat-card-cast-ghost');
    if (!cardCue?.active || !this.textures.exists(COMBAT_PLAYER_COMMIT_SIGIL_TEXTURE)) return;
    this.combatPlayerCommitSigilBursts += 1;
    birdAudio.play('playerCommitment', 0.84);
    // A small seal inside the card cue shares its transform and exact lifetime.
    // No independent banner, additive glow, streak or particle burst competes
    // with the character or the impact that will follow.
    cardCue.add(this.add.image(0, 46, COMBAT_PLAYER_COMMIT_SIGIL_TEXTURE)
      .setDisplaySize(48, 16).setAlpha(.85).setName('combat-player-commit-sigil'));
  }

export function combatFlockImpactBurst(this: any, x: number, y: number, heavy = false): any {
    if (!this.textures.exists(COMBAT_FLOCK_IMPACT_BURST_TEXTURE)) return;
    this.textures.get(COMBAT_FLOCK_IMPACT_BURST_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatFlockImpactBurstBursts += 1;
    const burst = this.add.image(x, y, COMBAT_FLOCK_IMPACT_BURST_TEXTURE)
      .setDisplaySize(heavy ? 180 : 128, heavy ? 75 : 54)
      .setAlpha(heavy ? 0.5 : 0.38)
      .setAngle(heavy ? -4 : 3)
      .setName('combat-flock-impact-burst');
    this.fxLayer.add(burst);
    let retirement: Phaser.Time.TimerEvent | undefined;
    burst.once(Phaser.GameObjects.Events.DESTROY, () => {
      retirement?.remove(false);
      this.tweens.killTweensOf(burst);
    });
    if (prefersReducedMotion()) {
      retirement = this.time.delayedCall(130, () => burst.destroy());
      return;
    }
    this.tweens.add({
      targets: burst,
      alpha: 0,
      scaleX: burst.scaleX * 1.04,
      scaleY: burst.scaleY * 1.04,
      duration: heavy ? 220 : 160,
      ease: 'Cubic.easeOut',
      onComplete: () => burst.destroy(),
    });
  }

export function combatEnemyImpactContact(this: any, x: number, y: number, fromX: number, heavy = false): any {
    if (!this.textures.exists(COMBAT_ENEMY_IMPACT_CONTACT_TEXTURE)) return;
    this.textures.get(COMBAT_ENEMY_IMPACT_CONTACT_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const reducedMotion = prefersReducedMotion();
    const direction = fromX >= x ? 1 : -1;
    const width = heavy ? 228 : 180;
    const height = width * (256 / 768);
    this.combatEnemyImpactContactBursts += 1;

    const contact = this.add.image(x, y, COMBAT_ENEMY_IMPACT_CONTACT_TEXTURE)
      .setDisplaySize(width, height)
      .setAlpha(reducedMotion || currentFlashEffectsState().reduced ? 0.4 : 0.58)
      .setName('combat-enemy-impact-contact');
    this.fxLayer.add(contact);
    let retirement: Phaser.Time.TimerEvent | undefined;
    contact.once(Phaser.GameObjects.Events.DESTROY, () => {
      retirement?.remove(false);
      this.tweens.killTweensOf(contact);
    });
    if (reducedMotion) {
      retirement = this.time.delayedCall(130, () => contact.destroy());
      return;
    }
    this.tweens.add({
      targets: contact,
      alpha: 0,
      x: x - direction * 5,
      duration: heavy ? 220 : 160,
      ease: 'Cubic.easeOut',
      onComplete: () => contact.destroy(),
    });
  }

export function combatEnemySwipe(this: any, fromX: number, fromY: number, toX: number, toY: number, heavy = false): any {
    if (!this.textures.exists(COMBAT_ENEMY_SWIPE_TEXTURE)) return;
    this.textures.get(COMBAT_ENEMY_SWIPE_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatEnemySwipeBursts += 1;
    const distance = Math.max(1, Math.hypot(fromX - toX, fromY - toY));
    const targetToSource = Phaser.Math.Angle.Between(toX, toY, fromX, fromY);
    const nativeSlashAngle = Phaser.Math.DegToRad(-24);
    const width = Phaser.Math.Clamp(distance * 0.3, 110, heavy ? 220 : 170);
    const height = width * 0.5;
    const swipe = this.add.image(toX, toY + 10, COMBAT_ENEMY_SWIPE_TEXTURE)
      .setOrigin(0.12, 0.72)
      .setDisplaySize(width, height)
      .setRotation(targetToSource - nativeSlashAngle)
      .setAlpha(heavy ? 0.56 : 0.46)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('combat-enemy-swipe');
    this.fxLayer.add(swipe);
    let retirement: Phaser.Time.TimerEvent | undefined;
    swipe.once(Phaser.GameObjects.Events.DESTROY, () => {
      retirement?.remove(false);
      this.tweens.killTweensOf(swipe);
    });
    if (prefersReducedMotion()) {
      retirement = this.time.delayedCall(130, () => swipe.destroy());
      return;
    }
    this.tweens.add({
      targets: swipe,
      alpha: 0,
      scaleX: swipe.scaleX * (heavy ? 1.08 : 1.05),
      scaleY: swipe.scaleY * (heavy ? 1.08 : 1.05),
      x: toX - Math.cos(targetToSource) * 14,
      y: toY + 10 - Math.sin(targetToSource) * 10,
      duration: heavy ? 220 : 160,
      ease: 'Cubic.easeOut',
      onComplete: () => swipe.destroy(),
    });
  }

export function combatCoverGuard(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_COVER_GUARD_TEXTURE)) return;
    this.textures.get(COMBAT_COVER_GUARD_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatCoverGuardBursts += 1;
    const guard = this.add.image(x, y - 8, COMBAT_COVER_GUARD_TEXTURE)
      .setDisplaySize(164 * scale, 122 * scale)
      .setAlpha(0.48)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(Phaser.Math.Between(-8, 8))
      .setName('combat-cover-guard');
    this.fxLayer.add(guard);
    if (prefersReducedMotion()) {
      this.time.delayedCall(140, () => guard.destroy());
      return;
    }
    this.tweens.add({
      targets: guard,
      scaleX: guard.scaleX * 1.12,
      scaleY: guard.scaleY * 1.12,
      angle: guard.angle + Phaser.Math.Between(-8, 8),
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => guard.destroy(),
    });
  }

export function combatCoverBlockBurst(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_COVER_BLOCK_BURST_TEXTURE)) return;
    this.textures.get(COMBAT_COVER_BLOCK_BURST_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatCoverBlockBurstBursts += 1;
    const burst = this.add.image(x, y - 4, COMBAT_COVER_BLOCK_BURST_TEXTURE)
      .setDisplaySize(330 * scale, 138 * scale)
      .setAlpha(0.68)
      .setAngle(Phaser.Math.Between(-5, 5))
      .setName('combat-cover-block-burst');
    const glint = this.add.image(x, y - 4, COMBAT_COVER_BLOCK_BURST_TEXTURE)
      .setDisplaySize(330 * scale, 138 * scale)
      .setAlpha(0.42)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(burst.angle)
      .setName('combat-cover-block-burst');
    this.fxLayer.add([burst, glint]);
    if (prefersReducedMotion()) {
      this.time.delayedCall(150, () => {
        burst.destroy();
        glint.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: [burst, glint],
      scaleX: burst.scaleX * 1.14,
      scaleY: burst.scaleY * 1.14,
      angle: burst.angle + Phaser.Math.Between(-8, 8),
      alpha: 0,
      delay: 70,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        burst.destroy();
        glint.destroy();
      },
    });
  }

export function combatEnemyCoverBlock(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_ENEMY_COVER_BLOCK_TEXTURE)) return;
    this.textures.get(COMBAT_ENEMY_COVER_BLOCK_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatEnemyCoverBlockBursts += 1;
    const sizeScale = Phaser.Math.Clamp(scale, 0.84, 1.18);
    const reduced = prefersReducedMotion();
    const base = this.add.image(x, y, COMBAT_ENEMY_COVER_BLOCK_TEXTURE)
      .setDisplaySize(292 * sizeScale, 175 * sizeScale)
      .setAlpha(reduced ? 0.78 : 0.9)
      .setAngle(Phaser.Math.Between(-5, 5))
      .setName('combat-enemy-cover-block');
    const glint = this.add.image(x, y, COMBAT_ENEMY_COVER_BLOCK_TEXTURE)
      .setDisplaySize(306 * sizeScale, 184 * sizeScale)
      .setAlpha(reduced ? 0.26 : 0.34)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x8df4ff)
      .setAngle(base.angle)
      .setName('combat-enemy-cover-block');
    this.fxLayer.add([glint, base]);
    if (reduced) {
      this.time.delayedCall(160, () => {
        glint.destroy();
        base.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: [glint, base],
      scaleX: '+=0.055',
      scaleY: '+=0.035',
      alpha: 0,
      delay: 80,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        glint.destroy();
        base.destroy();
      },
    });
  }

export function combatPerfectBraceRiposte(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_PERFECT_BRACE_RIPOSTE_TEXTURE)) return;
    this.textures.get(COMBAT_PERFECT_BRACE_RIPOSTE_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatPerfectBraceRiposteBursts += 1;
    const crest = this.add.image(x, y, COMBAT_PERFECT_BRACE_RIPOSTE_TEXTURE)
      .setDisplaySize(420 * scale, 175 * scale)
      .setAlpha(0.82)
      .setAngle(Phaser.Math.Between(-4, 4))
      .setName('combat-perfect-brace-riposte');
    const glint = this.add.image(x + 6, y - 2, COMBAT_PERFECT_BRACE_RIPOSTE_TEXTURE)
      .setDisplaySize(420 * scale, 175 * scale)
      .setAlpha(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(crest.angle)
      .setName('combat-perfect-brace-riposte');
    this.fxLayer.add([crest, glint]);
    if (prefersReducedMotion()) {
      this.time.delayedCall(180, () => {
        crest.destroy();
        glint.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: [crest, glint],
      x: `+=${30 * scale}`,
      scaleX: crest.scaleX * 1.08,
      scaleY: crest.scaleY * 1.08,
      alpha: 0,
      delay: 90,
      duration: 460,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        crest.destroy();
        glint.destroy();
      },
    });
  }

export function combatPinnedOpeningStrike(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_PINNED_OPENING_STRIKE_TEXTURE)) return;
    this.textures.get(COMBAT_PINNED_OPENING_STRIKE_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatPinnedOpeningStrikeBursts += 1;
    const mark = this.add.image(x, y, COMBAT_PINNED_OPENING_STRIKE_TEXTURE)
      .setDisplaySize(360 * scale, 150 * scale)
      .setAlpha(0.86)
      .setAngle(Phaser.Math.Between(-6, 2))
      .setName('combat-pinned-opening-strike');
    const flare = this.add.image(x + 4, y - 2, COMBAT_PINNED_OPENING_STRIKE_TEXTURE)
      .setDisplaySize(360 * scale, 150 * scale)
      .setAlpha(0.46)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(mark.angle)
      .setName('combat-pinned-opening-strike');
    this.fxLayer.add([mark, flare]);
    this.fxShardSweep(x - 12, y + 2, 0x8df4ff, 1, 8);
    if (prefersReducedMotion()) {
      this.time.delayedCall(160, () => {
        mark.destroy();
        flare.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: [mark, flare],
      x: `+=${24 * scale}`,
      y: `-=${8 * scale}`,
      scaleX: mark.scaleX * 1.1,
      scaleY: mark.scaleY * 1.1,
      alpha: 0,
      delay: 80,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        mark.destroy();
        flare.destroy();
      },
    });
  }

export function combatGeneratedFx(this: any, textureKey: string, name: string, x: number, y: number, width: number, height: number, options: {
      alpha?: number;
      glowAlpha?: number;
      tint?: number;
      angle?: number;
      additive?: boolean;
      lifeMs?: number;
      reducedLifeMs?: number;
      delayMs?: number;
      scaleOut?: number;
      driftX?: number;
      driftY?: number;
    } = {}): any {
    if (!this.textures.exists(textureKey)) return false;
    this.textures.get(textureKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const reduced = prefersReducedMotion();
    const angle = options.angle ?? Phaser.Math.Between(-6, 6);
    const pressureAlpha = this.activeGeneratedFxSprites >= 4 ? 0.68 : this.activeGeneratedFxSprites >= 2 ? 0.82 : 1;
    const base = this.add.image(x, y, textureKey)
      .setDisplaySize(width, height)
      .setAlpha(Math.min(options.alpha ?? 0.8, 0.82) * pressureAlpha)
      .setAngle(angle)
      .setName(name);
    if (options.tint !== undefined) base.setTint(options.tint);
    if (options.additive) base.setBlendMode(Phaser.BlendModes.ADD);
    const objects: Phaser.GameObjects.Image[] = [base];
    const includeGlow = (options.glowAlpha ?? 0) > 0 && this.activeGeneratedFxSprites < 6 && !reduced;
    if (includeGlow) {
      const glow = this.add.image(x, y, textureKey)
        .setDisplaySize(width * 1.08, height * 1.08)
        .setAlpha(Math.min(options.glowAlpha ?? 0.18, 0.2) * pressureAlpha)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAngle(angle)
        .setName(name);
      if (options.tint !== undefined) glow.setTint(options.tint);
      objects.unshift(glow);
    }
    this.activeGeneratedFxSprites += objects.length;
    let retired = false;
    let retirement: Phaser.Time.TimerEvent | undefined;
    const cleanup = (destroying?: Phaser.GameObjects.Image) => {
      if (retired) return;
      retired = true;
      retirement?.remove(false);
      this.tweens.killTweensOf(objects);
      objects.forEach((object) => {
        // DESTROY fires before active becomes false. Do not recursively destroy
        // the image whose event is currently retiring this owned effect batch.
        if (object !== destroying && object.active) object.destroy();
      });
      this.activeGeneratedFxSprites = Math.max(0, this.activeGeneratedFxSprites - objects.length);
    };
    objects.forEach((object) => object.once(Phaser.GameObjects.Events.DESTROY, () => cleanup(object)));
    this.fxLayer.add(objects);
    this.children.bringToTop(this.fxLayer);
    if (reduced) {
      retirement = this.time.delayedCall(options.reducedLifeMs ?? 190, () => cleanup());
      return true;
    }
    const scaleOut = options.scaleOut ?? 1.12;
    this.tweens.add({
      targets: objects,
      x: `+=${options.driftX ?? 0}`,
      y: `+=${options.driftY ?? -8}`,
      scaleX: base.scaleX * scaleOut,
      scaleY: base.scaleY * scaleOut,
      alpha: 0,
      delay: options.delayMs ?? 100,
      duration: options.lifeMs ?? 520,
      ease: 'Cubic.easeOut',
      onComplete: () => cleanup(),
    });
    return true;
  }

export function combatOverextensionWarning(this: any, x: number, y: number, scale = 1): any {
    if (!this.combatGeneratedFx(COMBAT_OVEREXTENSION_WARNING_TEXTURE, 'combat-overextension-warning', x, y, 360 * scale, 180 * scale, {
      alpha: 0.9,
      glowAlpha: 0.32,
      tint: 0xff9d4d,
      angle: Phaser.Math.Between(-3, 3),
      lifeMs: 720,
      delayMs: 180,
      scaleOut: 1.08,
    })) return;
    this.combatOverextensionWarningBursts += 1;
    this.fxMoteBurst(x, y + 10, 0xff9d4d, { count: 18, speed: 120, lifespan: 480, scale: 0.5, gravityY: -8, spreadX: 70, spreadY: 18 });
  }

export function combatBossPhaseBreak(this: any, x: number, y: number, scale = 1): any {
    if (!this.combatGeneratedFx(COMBAT_BOSS_PHASE_BREAK_TEXTURE, 'combat-boss-phase-break', x, y, 360 * scale, 180 * scale, {
      alpha: 0.92,
      glowAlpha: 0.38,
      angle: Phaser.Math.Between(-4, 4),
      lifeMs: 900,
      delayMs: 260,
      scaleOut: 1.16,
    })) return;
    this.combatBossPhaseBreakBursts += 1;
    this.fxShockwave(x, y + 6, 0xff9d4d, 150 * scale, 620, 0);
  }

export function combatStatusCleanseSpecific(this: any, x: number, y: number, scale = 1): any {
    if (!this.combatGeneratedFx(COMBAT_STATUS_CLEANSE_SPECIFIC_TEXTURE, 'combat-status-cleanse-specific', x, y, 238 * scale, 79 * scale, {
      alpha: 0.88,
      glowAlpha: 0.24,
      tint: 0xdffbff,
      angle: Phaser.Math.Between(-8, 8),
      lifeMs: 560,
      delayMs: 120,
      scaleOut: 1.14,
    })) return;
    this.combatStatusCleanseSpecificBursts += 1;
  }

export function combatOpenSkyBreak(this: any, x: number, y: number, scale = 1): any {
    if (!this.combatGeneratedFx(COMBAT_OPEN_SKY_BREAK_TEXTURE, 'combat-open-sky-break', x, y, 300 * scale, 225 * scale, {
      alpha: 0.78,
      glowAlpha: 0.22,
      tint: 0xffcf7a,
      angle: Phaser.Math.Between(-8, 8),
      lifeMs: 620,
      delayMs: 140,
      scaleOut: 1.12,
    })) return;
    this.combatOpenSkyBreakBursts += 1;
  }

export function combatCacheChoiceReveal(this: any, x: number, y: number, scale = 1): any {
    if (!this.combatGeneratedFx(COMBAT_CACHE_CHOICE_REVEAL_TEXTURE, 'combat-cache-choice-reveal', x, y, 350 * scale, 175 * scale, {
      alpha: 0.88,
      glowAlpha: 0.26,
      angle: Phaser.Math.Between(-4, 4),
      lifeMs: 740,
      delayMs: 180,
      scaleOut: 1.08,
    })) return;
    this.combatCacheChoiceRevealBursts += 1;
  }

export function combatMoltTriggerChoice(this: any, x: number, y: number, scale = 1): any {
    if (!this.combatGeneratedFx(COMBAT_MOLT_TRIGGER_CHOICE_TEXTURE, 'combat-molt-trigger-choice', x, y, 244 * scale, 244 * scale, {
      alpha: 0.82,
      glowAlpha: 0.3,
      angle: Phaser.Math.Between(-8, 8),
      lifeMs: 620,
      delayMs: 150,
      scaleOut: 1.12,
    })) return;
    this.combatMoltTriggerChoiceBursts += 1;
  }

export function combatEnemyHeavyContact(this: any, x: number, y: number, fromX: number, scale = 1): any {
    const direction = fromX >= x ? 1 : -1;
    if (!this.combatGeneratedFx(COMBAT_ENEMY_HEAVY_CONTACT_TEXTURE, 'combat-enemy-heavy-contact', x, y, 260 * scale, 86 * scale, {
      alpha: 0.58,
      angle: direction > 0 ? -5 : 185,
      lifeMs: 220,
      reducedLifeMs: 130,
      delayMs: 0,
      scaleOut: 1.04,
      driftX: -direction * 5,
      driftY: -2,
    })) return;
    this.combatEnemyHeavyContactBursts += 1;
  }

export function combatEnemyHealBeam(this: any, fromX: number, fromY: number, toX: number, toY: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_ENEMY_HEAL_BEAM_TEXTURE)) return;
    this.textures.get(COMBAT_ENEMY_HEAL_BEAM_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const x = (fromX + toX) / 2;
    const y = (fromY + toY) / 2;
    const distance = Math.max(120, Math.hypot(toX - fromX, toY - fromY));
    const angle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(fromX, fromY, toX, toY));
    this.combatEnemyHealBeamBursts += 1;
    this.combatGeneratedFx(COMBAT_ENEMY_HEAL_BEAM_TEXTURE, 'combat-enemy-heal-beam', x, y, Math.min(520, distance * 1.18) * scale, 130 * scale, {
      alpha: 0.74,
      glowAlpha: 0.42,
      angle,
      additive: true,
      lifeMs: 640,
      delayMs: 160,
      scaleOut: 1.04,
    });
  }

export function combatResourceOvercap(this: any, x: number, y: number, scale = 1): any {
    if (!this.combatGeneratedFx(COMBAT_RESOURCE_OVERCAP_TEXTURE, 'combat-resource-overcap', x, y, 230 * scale, 173 * scale, {
      alpha: 0.88,
      glowAlpha: 0.24,
      angle: Phaser.Math.Between(-4, 4),
      lifeMs: 640,
      delayMs: 150,
      scaleOut: 1.1,
    })) return;
    this.combatResourceOvercapBursts += 1;
  }

export function combatFourSuitRally(this: any, x: number, y: number, scale = 1): any {
    this.combatFourSuitRallyBursts += 1;
    const radius = 94 * scale;
    const flourish = this.add.graphics()
      .setPosition(x, y)
      .setScale(0.86)
      .setName('combat-four-suit-flourish')
      .setData('centerClear', true)
      .setData('presentation', 'segmented-perimeter')
      .setData('radius', radius);
    const suitColors = [0xffcf6b, 0xc9a6ff, 0x6fd0e6, 0x8fd6a0];
    suitColors.forEach((color, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 2;
      const halfSegment = Math.PI * 0.27;
      flourish.lineStyle(Math.max(2, 4 * scale), color, 0.9);
      flourish.beginPath();
      flourish.arc(0, 0, radius, angle - halfSegment, angle + halfSegment);
      flourish.strokePath();
      const nodeX = Math.cos(angle) * radius;
      const nodeY = Math.sin(angle) * radius;
      flourish.fillStyle(color, 0.94);
      flourish.fillCircle(nodeX, nodeY, Math.max(3, 5 * scale));
      flourish.lineStyle(Math.max(1, 1.5 * scale), 0xfff4d6, 0.82);
      flourish.strokeCircle(nodeX, nodeY, Math.max(4, 7 * scale));
      this.fxMoteBurst(x + nodeX, y + nodeY, color, {
        count: 5,
        speed: 76,
        lifespan: 420,
        scale: 0.42,
        gravityY: -8,
        spreadX: 12,
        spreadY: 12,
      });
    });
    this.fxLayer.add(flourish);
    this.fxGlowPulse(x, y, 0xffe1a3, radius * 1.04, 440, 0.08);
    if (prefersReducedMotion()) {
      this.time.delayedCall(180, () => flourish.destroy());
      return;
    }
    this.tweens.add({
      targets: flourish,
      scaleX: 1.12,
      scaleY: 1.12,
      angle: Phaser.Math.Between(-7, 7),
      alpha: 0,
      delay: 90,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => flourish.destroy(),
    });
  }

export function combatHealBloom(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_HEAL_BLOOM_TEXTURE)) return;
    this.textures.get(COMBAT_HEAL_BLOOM_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatHealBloomBursts += 1;
    const bloom = this.add.image(x, y + 8, COMBAT_HEAL_BLOOM_TEXTURE)
      .setDisplaySize(152 * scale, 114 * scale)
      .setAlpha(0.48)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(Phaser.Math.Between(-7, 7))
      .setName('combat-heal-bloom');
    this.fxLayer.add(bloom);
    if (prefersReducedMotion()) {
      this.time.delayedCall(150, () => bloom.destroy());
      return;
    }
    this.tweens.add({
      targets: bloom,
      scaleX: bloom.scaleX * 1.14,
      scaleY: bloom.scaleY * 1.14,
      angle: bloom.angle + Phaser.Math.Between(-10, 10),
      y: bloom.y - 8,
      alpha: 0,
      duration: 460,
      ease: 'Cubic.easeOut',
      onComplete: () => bloom.destroy(),
    });
  }

export function combatOverflowShelter(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_OVERFLOW_SHELTER_TEXTURE)) return;
    this.textures.get(COMBAT_OVERFLOW_SHELTER_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatOverflowShelterBursts += 1;
    const shelter = this.add.image(x, y, COMBAT_OVERFLOW_SHELTER_TEXTURE)
      .setDisplaySize(232 * scale, 232 * scale)
      .setAlpha(0.76)
      .setAngle(Phaser.Math.Between(-4, 4))
      .setName('combat-overflow-shelter');
    const glow = this.add.image(x, y, COMBAT_OVERFLOW_SHELTER_TEXTURE)
      .setDisplaySize(244 * scale, 244 * scale)
      .setAlpha(0.3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(shelter.angle)
      .setName('combat-overflow-shelter');
    this.fxLayer.add([glow, shelter]);
    this.combatResourceOvercap(x + 6, y + 8, Phaser.Math.Clamp(scale, 0.86, 1.1));
    this.fxMoteBurst(x, y + 12, 0x8df4ff, {
      count: 18,
      speed: 98,
      lifespan: 460,
      scale: 0.46,
      gravityY: -24,
      spreadX: 26,
      spreadY: 18,
    });
    this.fxMoteBurst(x + 2, y - 2, 0x8fd6a0, {
      count: 10,
      speed: 74,
      lifespan: 420,
      scale: 0.38,
      gravityY: -20,
      spreadX: 20,
      spreadY: 18,
    });
    if (prefersReducedMotion()) {
      this.time.delayedCall(190, () => {
        shelter.destroy();
        glow.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: [shelter, glow],
      scaleX: shelter.scaleX * 1.1,
      scaleY: shelter.scaleY * 1.1,
      y: y - 8,
      alpha: 0,
      delay: 140,
      duration: 560,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        shelter.destroy();
        glow.destroy();
      },
    });
  }

export function combatFormationShift(this: any, state: FlockState, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_FORMATION_SHIFT_TEXTURE)) return;
    this.textures.get(COMBAT_FORMATION_SHIFT_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.setBattleFxDepth(90);
    this.children.bringToTop(this.fxLayer);
    this.combatFormationShiftBursts += 1;
    const tint = state === 'surging' ? 0x8df4ff : state === 'scattered' ? 0xff9d6b : 0x8fd6a0;
    const angle = state === 'scattered' ? Phaser.Math.Between(-12, 12) : Phaser.Math.Between(-5, 5);
    const size = (state === 'scattered' ? 168 : 180) * scale;
    const crest = this.add.image(x, y, COMBAT_FORMATION_SHIFT_TEXTURE)
      .setDisplaySize(size, size)
      .setAlpha(state === 'scattered' ? 0.54 : 0.62)
      .setAngle(angle)
      .setTint(tint)
      .setName('combat-formation-shift');
    const glow = this.add.image(x, y, COMBAT_FORMATION_SHIFT_TEXTURE)
      .setDisplaySize(size * 1.08, size * 1.08)
      .setAlpha(state === 'scattered' ? 0.14 : 0.2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(angle)
      .setTint(tint)
      .setName('combat-formation-shift');
    this.fxLayer.add([glow, crest]);
    this.fxMoteBurst(x, y + 6, tint, {
      count: state === 'scattered' ? 14 : 18,
      speed: state === 'scattered' ? 126 : 104,
      lifespan: state === 'scattered' ? 360 : 460,
      scale: state === 'scattered' ? 0.44 : 0.52,
      gravityY: state === 'surging' ? -20 : state === 'scattered' ? 22 : -10,
      spreadX: 24,
      spreadY: 18,
    });
    if (prefersReducedMotion()) {
      this.time.delayedCall(190, () => {
        crest.destroy();
        glow.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: [crest, glow],
      scaleX: crest.scaleX * (state === 'scattered' ? 0.96 : 1.12),
      scaleY: crest.scaleY * (state === 'scattered' ? 0.96 : 1.12),
      angle: crest.angle + (state === 'scattered' ? Phaser.Math.Between(-14, 14) : Phaser.Math.Between(-8, 8)),
      y: y + (state === 'scattered' ? 10 : -8),
      alpha: 0,
      delay: 120,
      duration: state === 'scattered' ? 460 : 560,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        crest.destroy();
        glow.destroy();
      },
    });
  }

export function combatEnemyMend(this: any, x: number, y: number, scale = 1): any {
    if (this.combatEnemySupportCue(x, y, scale, COMBAT_ENEMY_MEND_TEXTURE, 'combat-enemy-mend')) this.combatEnemyMendBursts += 1;
  }

export function combatEnemyCover(this: any, x: number, y: number, scale = 1): any {
    if (this.combatEnemySupportCue(x, y, scale, COMBAT_ENEMY_COVER_TEXTURE, 'combat-enemy-cover')) this.combatEnemyCoverBursts += 1;
  }

export function combatEnemySupportCue(this: any, x: number, y: number, scale: number, texture: string, name: string): any {
    if (!this.textures.exists(texture)) return false;
    // Repeated support on one target changes the numeric total, not its glow.
    if (this.fxLayer.list.some((object: Phaser.GameObjects.GameObject) => object.name === name && (object as Phaser.GameObjects.Image).x === x)) return false;
    this.textures.get(texture).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const reduced = prefersReducedMotion();
    const size = 128 * Phaser.Math.Clamp(scale, 0.8, 1.2);
    const cue = this.add.image(x, y - 88, texture).setDisplaySize(size, size * 0.75)
      .setAlpha(reduced ? 0.35 : 0.58).setName(name);
    this.fxLayer.add(cue);
    this.fxLayer.sendToBack(cue);
    const retirement = this.time.delayedCall(reduced ? 150 : 360, () => cue.destroy());
    if (!reduced) this.tweens.add({ targets: cue, alpha: 0, duration: 300, onComplete: () => cue.destroy() });
    cue.once(Phaser.GameObjects.Events.DESTROY, () => {
      retirement.remove(false);
      this.tweens.killTweensOf(cue);
    });
    return true;
  }

export function combatCoverShatter(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_COVER_SHATTER_TEXTURE)) return;
    this.textures.get(COMBAT_COVER_SHATTER_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatCoverShatterBursts += 1;
    const shatter = this.add.image(x, y - 18, COMBAT_COVER_SHATTER_TEXTURE)
      .setDisplaySize(450 * scale, 338 * scale)
      .setAlpha(1)
      .setAngle(Phaser.Math.Between(-10, 10))
      .setName('combat-cover-shatter');
    const flash = currentFlashEffectsState().reduced
      ? undefined
      : this.add.image(x, y - 18, COMBAT_COVER_SHATTER_TEXTURE)
        .setDisplaySize(450 * scale, 338 * scale)
        .setAlpha(1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAngle(shatter.angle)
        .setName('combat-cover-shatter');
    this.fxLayer.add(flash ? [shatter, flash] : [shatter]);
    if (prefersReducedMotion()) {
      this.time.delayedCall(150, () => {
        shatter.destroy();
        flash?.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: flash ? [shatter, flash] : [shatter],
      scaleX: shatter.scaleX * 1.16,
      scaleY: shatter.scaleY * 1.16,
      y: shatter.y + 8,
      angle: shatter.angle + Phaser.Math.Between(-16, 16),
      alpha: { value: 0, duration: 880, delay: 420 },
      duration: 880,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        shatter.destroy();
        flash?.destroy();
      },
    });
  }

export function combatCardDraw(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_CARD_DRAW_TEXTURE)) return;
    this.textures.get(COMBAT_CARD_DRAW_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatCardDrawBursts += 1;
    const burst = this.add.image(x, y, COMBAT_CARD_DRAW_TEXTURE)
      .setDisplaySize(430 * scale, 322 * scale)
      .setAlpha(1)
      .setAngle(-8)
      .setDepth(20)
      .setName('combat-card-draw');
    const shimmer = this.add.image(x, y, COMBAT_CARD_DRAW_TEXTURE)
      .setDisplaySize(430 * scale, 322 * scale)
      .setAlpha(0.86)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(-8)
      .setDepth(21)
      .setName('combat-card-draw');
    this.fxLayer.add([burst, shimmer]);
    if (prefersReducedMotion()) {
      this.time.delayedCall(180, () => {
        burst.destroy();
        shimmer.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: [burst, shimmer],
      x: x + 36,
      y: y - 16,
      scaleX: burst.scaleX * 1.08,
      scaleY: burst.scaleY * 1.08,
      angle: 4,
      alpha: { value: 0, duration: 620, delay: 500 },
      duration: 940,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        burst.destroy();
        shimmer.destroy();
      },
    });
  }

export function combatDiscardSweep(this: any, x: number, y: number, scale = 1, count = 1): any {
    if (!this.textures.exists(COMBAT_DISCARD_SWEEP_TEXTURE)) return;
    this.textures.get(COMBAT_DISCARD_SWEEP_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatDiscardSweepBursts += 1;
    const angle = Phaser.Math.Between(-7, 4);
    const sweep = this.add.image(x, y, COMBAT_DISCARD_SWEEP_TEXTURE)
      .setDisplaySize(360 * scale, 270 * scale)
      .setAlpha(0.96)
      .setAngle(angle)
      .setDepth(22)
      .setName('combat-discard-sweep');
    const glint = this.add.image(x, y, COMBAT_DISCARD_SWEEP_TEXTURE)
      .setDisplaySize(360 * scale, 270 * scale)
      .setAlpha(0.54)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(angle)
      .setDepth(23)
      .setName('combat-discard-sweep');
    this.fxLayer.add([sweep, glint]);
    this.fxGlowPulse(x + 38, y + 32, 0xffb86b, 88, 460, 0.18);
    this.fxMoteBurst(x + 34, y + 44, 0xffcf7a, {
      count: Phaser.Math.Clamp(8 + count * 2, 10, 22),
      speed: 112,
      lifespan: 360,
      scale: 0.44,
      gravityY: 12,
      spreadX: 22,
      spreadY: 12,
    });
    if (prefersReducedMotion()) {
      this.time.delayedCall(170, () => {
        sweep.destroy();
        glint.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: [sweep, glint],
      x: x + 22,
      y: y + 18,
      scaleX: sweep.scaleX * 1.08,
      scaleY: sweep.scaleY * 1.08,
      angle: angle + 9,
      alpha: { value: 0, duration: 560, delay: 430 },
      duration: 820,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        sweep.destroy();
        glint.destroy();
      },
    });
  }

export function combatShuffleVortex(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_SHUFFLE_VORTEX_TEXTURE)) return;
    this.textures.get(COMBAT_SHUFFLE_VORTEX_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatShuffleVortexBursts += 1;
    const vortex = this.add.image(x, y, COMBAT_SHUFFLE_VORTEX_TEXTURE)
      .setDisplaySize(468 * scale, 351 * scale)
      .setAlpha(0.95)
      .setAngle(-3)
      .setDepth(20)
      .setName('combat-shuffle-vortex');
    const charge = this.add.image(x, y, COMBAT_SHUFFLE_VORTEX_TEXTURE)
      .setDisplaySize(468 * scale, 351 * scale)
      .setAlpha(0.62)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(-3)
      .setDepth(21)
      .setName('combat-shuffle-vortex');
    this.fxLayer.add([vortex, charge]);
    this.fxGlowPulse(x + 114 * scale, y + 52 * scale, 0x8df4ff, 96 * scale, 540, 0.2);
    this.fxMoteBurst(x - 88 * scale, y + 44 * scale, 0xffcf7a, {
      count: 18,
      speed: 132,
      lifespan: 420,
      scale: 0.44,
      gravityY: 0,
      spreadX: 34,
      spreadY: 16,
    });
    this.fxMoteBurst(x + 118 * scale, y + 38 * scale, 0x8df4ff, {
      count: 14,
      speed: 118,
      lifespan: 390,
      scale: 0.4,
      gravityY: 0,
      spreadX: 24,
      spreadY: 12,
    });
    if (prefersReducedMotion()) {
      this.time.delayedCall(180, () => {
        vortex.destroy();
        charge.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: [vortex, charge],
      x: x - 12,
      y: y - 4,
      scaleX: vortex.scaleX * 1.06,
      scaleY: vortex.scaleY * 1.06,
      angle: 8,
      alpha: { value: 0, duration: 720, delay: 520 },
      duration: 980,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        vortex.destroy();
        charge.destroy();
      },
    });
  }

export function combatFouledPressure(this: any, x: number, y: number, scale = 1, tick = false): any {
    if (!this.textures.exists(COMBAT_FOULED_PRESSURE_TEXTURE)) return;
    this.textures.get(COMBAT_FOULED_PRESSURE_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatFouledPressureBursts += 1;
    const pressure = this.add.image(x, y, COMBAT_FOULED_PRESSURE_TEXTURE)
      .setDisplaySize((tick ? 268 : 248) * scale, (tick ? 201 : 186) * scale)
      .setAlpha(tick ? 0.82 : 0.7)
      .setBlendMode(tick ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setAngle(Phaser.Math.Between(-10, 10))
      .setName('combat-fouled-pressure');
    this.fxLayer.add(pressure);
    if (prefersReducedMotion()) {
      this.time.delayedCall(150, () => pressure.destroy());
      return;
    }
    this.tweens.add({
      targets: pressure,
      scaleX: pressure.scaleX * (tick ? 1.17 : 1.12),
      scaleY: pressure.scaleY * (tick ? 1.17 : 1.12),
      y: pressure.y + (tick ? 7 : 3),
      angle: pressure.angle + Phaser.Math.Between(-14, 14),
      alpha: 0,
      duration: tick ? 430 : 390,
      ease: 'Cubic.easeOut',
      onComplete: () => pressure.destroy(),
    });
  }

export function combatRuffledBreak(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_RUFFLED_BREAK_TEXTURE)) return;
    this.textures.get(COMBAT_RUFFLED_BREAK_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatRuffledBreakBursts += 1;
    const ruffle = this.add.image(x, y, COMBAT_RUFFLED_BREAK_TEXTURE)
      .setDisplaySize(292 * scale, 219 * scale)
      .setAlpha(0.72)
      .setBlendMode(Phaser.BlendModes.NORMAL)
      .setAngle(Phaser.Math.Between(-9, 9))
      .setName('combat-ruffled-break');
    this.fxLayer.add(ruffle);
    if (prefersReducedMotion()) {
      this.time.delayedCall(150, () => ruffle.destroy());
      return;
    }
    this.tweens.add({
      targets: ruffle,
      scaleX: ruffle.scaleX * 1.16,
      scaleY: ruffle.scaleY * 1.16,
      y: ruffle.y + 4,
      angle: ruffle.angle + Phaser.Math.Between(-16, 16),
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => ruffle.destroy(),
    });
  }

export function combatResonanceSurge(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_RESONANCE_SURGE_TEXTURE)) return;
    this.textures.get(COMBAT_RESONANCE_SURGE_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatResonanceSurgeBursts += 1;
    const surge = this.add.image(x, y, COMBAT_RESONANCE_SURGE_TEXTURE)
      .setDisplaySize(240 * scale, 180 * scale)
      .setAlpha(0.76)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(Phaser.Math.Between(-10, 10))
      .setName('combat-resonance-surge');
    this.fxLayer.add(surge);
    if (prefersReducedMotion()) {
      this.time.delayedCall(140, () => surge.destroy());
      return;
    }
    this.tweens.add({
      targets: surge,
      scaleX: surge.scaleX * 1.16,
      scaleY: surge.scaleY * 1.16,
      angle: surge.angle + Phaser.Math.Between(14, 26),
      alpha: 0,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => surge.destroy(),
    });
  }

export function combatResonanceSpend(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_RESONANCE_SPEND_TEXTURE)) return;
    this.textures.get(COMBAT_RESONANCE_SPEND_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatResonanceSpendBursts += 1;
    const spend = this.add.image(x, y, COMBAT_RESONANCE_SPEND_TEXTURE)
      .setDisplaySize(252 * scale, 189 * scale)
      .setAlpha(0.8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(Phaser.Math.Between(-12, 12))
      .setName('combat-resonance-spend');
    this.fxLayer.add(spend);
    if (prefersReducedMotion()) {
      this.time.delayedCall(140, () => spend.destroy());
      return;
    }
    this.tweens.add({
      targets: spend,
      scaleX: spend.scaleX * 1.18,
      scaleY: spend.scaleY * 1.18,
      angle: spend.angle + Phaser.Math.Between(-18, 18),
      alpha: 0,
      duration: 340,
      ease: 'Cubic.easeOut',
      onComplete: () => spend.destroy(),
    });
  }

export function combatSparkEcho(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_SPARK_ECHO_TEXTURE)) return;
    this.textures.get(COMBAT_SPARK_ECHO_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatSparkEchoBursts += 1;
    const crest = this.add.image(x, y, COMBAT_SPARK_ECHO_TEXTURE)
      .setDisplaySize(224 * scale, 224 * scale)
      .setAlpha(0.78)
      .setAngle(Phaser.Math.Between(-8, 8))
      .setName('combat-spark-echo');
    const glow = this.add.image(x, y, COMBAT_SPARK_ECHO_TEXTURE)
      .setDisplaySize(236 * scale, 236 * scale)
      .setAlpha(0.28)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(crest.angle)
      .setName('combat-spark-echo');
    this.fxLayer.add([glow, crest]);
    this.fxMoteBurst(x - 6, y + 8, 0x8df4ff, {
      count: 16,
      speed: 124,
      lifespan: 420,
      scale: 0.48,
      gravityY: -18,
      spreadX: 20,
      spreadY: 18,
    });
    this.fxMoteBurst(x + 10, y + 4, 0xff5bd7, {
      count: 8,
      speed: 92,
      lifespan: 340,
      scale: 0.36,
      gravityY: -12,
      spreadX: 16,
      spreadY: 14,
    });
    if (prefersReducedMotion()) {
      this.time.delayedCall(180, () => {
        crest.destroy();
        glow.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: [crest, glow],
      scaleX: crest.scaleX * 1.13,
      scaleY: crest.scaleY * 1.13,
      angle: crest.angle + Phaser.Math.Between(-16, 16),
      alpha: 0,
      delay: 130,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        crest.destroy();
        glow.destroy();
      },
    });
  }

export function combatWingbeatSurge(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_WINGBEAT_SURGE_TEXTURE)) return;
    this.textures.get(COMBAT_WINGBEAT_SURGE_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatWingbeatSurgeBursts += 1;
    const surge = this.add.image(x, y, COMBAT_WINGBEAT_SURGE_TEXTURE)
      .setDisplaySize(250 * scale, 188 * scale)
      .setAlpha(0.78)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(Phaser.Math.Between(-7, 7))
      .setName('combat-wingbeat-surge');
    this.fxLayer.add(surge);
    if (prefersReducedMotion()) {
      this.time.delayedCall(140, () => surge.destroy());
      return;
    }
    this.tweens.add({
      targets: surge,
      scaleX: surge.scaleX * 1.14,
      scaleY: surge.scaleY * 1.14,
      y: surge.y - 10,
      angle: surge.angle + Phaser.Math.Between(-10, 10),
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => surge.destroy(),
    });
  }

export function combatWingbeatDrain(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_WINGBEAT_DRAIN_TEXTURE)) return;
    this.textures.get(COMBAT_WINGBEAT_DRAIN_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatWingbeatDrainBursts += 1;
    const drain = this.add.image(x, y, COMBAT_WINGBEAT_DRAIN_TEXTURE)
      .setDisplaySize(264 * scale, 198 * scale)
      .setAlpha(0.82)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(Phaser.Math.Between(-10, 10))
      .setName('combat-wingbeat-drain');
    this.fxLayer.add(drain);
    if (prefersReducedMotion()) {
      this.time.delayedCall(150, () => drain.destroy());
      return;
    }
    this.tweens.add({
      targets: drain,
      scaleX: drain.scaleX * 0.82,
      scaleY: drain.scaleY * 0.82,
      angle: drain.angle + Phaser.Math.Between(-18, 18),
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeIn',
      onComplete: () => drain.destroy(),
    });
  }

export function combatMoltShift(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_MOLT_SHIFT_TEXTURE)) return;
    this.textures.get(COMBAT_MOLT_SHIFT_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatMoltShiftBursts += 1;
    const shift = this.add.image(x, y, COMBAT_MOLT_SHIFT_TEXTURE)
      .setDisplaySize(284 * scale, 213 * scale)
      .setAlpha(0.78)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(Phaser.Math.Between(-10, 10))
      .setName('combat-molt-shift');
    this.fxLayer.add(shift);
    this.combatMoltTriggerChoice(x, y + 2, Phaser.Math.Clamp(scale, 0.86, 1.12));
    if (prefersReducedMotion()) {
      this.time.delayedCall(150, () => shift.destroy());
      return;
    }
    this.tweens.add({
      targets: shift,
      scaleX: shift.scaleX * 1.13,
      scaleY: shift.scaleY * 1.13,
      y: shift.y - 8,
      angle: shift.angle + Phaser.Math.Between(-16, 16),
      alpha: 0,
      duration: 460,
      ease: 'Cubic.easeOut',
      onComplete: () => shift.destroy(),
    });
  }

export function combatOpenSkyGuard(this: any, x: number, y: number, scale = 1, consume = false): any {
    if (!this.textures.exists(COMBAT_OPEN_SKY_GUARD_TEXTURE)) return;
    this.textures.get(COMBAT_OPEN_SKY_GUARD_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatOpenSkyGuardBursts += 1;
    const guard = this.add.image(x, y, COMBAT_OPEN_SKY_GUARD_TEXTURE)
      .setDisplaySize((consume ? 276 : 258) * scale, (consume ? 207 : 194) * scale)
      .setAlpha(consume ? 0.86 : 0.74)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(Phaser.Math.Between(-8, 8))
      .setName('combat-open-sky-guard');
    this.fxLayer.add(guard);
    if (prefersReducedMotion()) {
      this.time.delayedCall(150, () => guard.destroy());
      return;
    }
    this.tweens.add({
      targets: guard,
      scaleX: guard.scaleX * (consume ? 1.2 : 1.12),
      scaleY: guard.scaleY * (consume ? 1.2 : 1.12),
      y: guard.y - (consume ? 5 : 9),
      angle: guard.angle + Phaser.Math.Between(-12, 12),
      alpha: 0,
      duration: consume ? 380 : 420,
      ease: 'Cubic.easeOut',
      onComplete: () => guard.destroy(),
    });
  }

export function combatOpenSkyExposure(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_OPEN_SKY_EXPOSURE_TEXTURE)) return;
    this.textures.get(COMBAT_OPEN_SKY_EXPOSURE_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatOpenSkyExposureBursts += 1;
    const exposure = this.add.image(x, y, COMBAT_OPEN_SKY_EXPOSURE_TEXTURE)
      .setDisplaySize(284 * scale, 213 * scale)
      .setAlpha(0.76)
      .setBlendMode(Phaser.BlendModes.NORMAL)
      .setAngle(Phaser.Math.Between(-10, 10))
      .setName('combat-open-sky-exposure');
    this.fxLayer.add(exposure);
    if (prefersReducedMotion()) {
      this.time.delayedCall(150, () => exposure.destroy());
      return;
    }
    this.tweens.add({
      targets: exposure,
      scaleX: exposure.scaleX * 1.14,
      scaleY: exposure.scaleY * 1.14,
      y: exposure.y - 8,
      angle: exposure.angle + Phaser.Math.Between(-14, 14),
      alpha: 0,
      duration: 430,
      ease: 'Cubic.easeOut',
      onComplete: () => exposure.destroy(),
    });
  }

export function combatDefeatBurst(this: any, x: number, y: number): any {
    if (!this.textures.exists(COMBAT_DEFEAT_BURST_TEXTURE)) return;
    this.textures.get(COMBAT_DEFEAT_BURST_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatDefeatBurstBursts += 1;
    const burstImage = this.add.image(x, y, COMBAT_DEFEAT_BURST_TEXTURE)
      .setDisplaySize(316, 316)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.94)
      .setAngle(Phaser.Math.Between(-12, 12))
      .setName('combat-defeat-burst');
    this.fxLayer.add(burstImage);
    if (!prefersReducedMotion()) {
      this.fxMoteBurst(x, y, 0xffd37a, {
        count: 22,
        speed: 235,
        lifespan: 520,
        scale: 0.8,
        gravityY: 18,
        spreadX: 12,
        spreadY: 12,
      });
      this.fxShockwave(x, y + 6, 0xffd37a, 118, 520, 0);
      this.tweens.add({
        targets: burstImage,
        scaleX: burstImage.scaleX * 1.2,
        scaleY: burstImage.scaleY * 1.2,
        angle: burstImage.angle + Phaser.Math.Between(10, 22),
        alpha: 0,
        duration: 520,
        ease: 'Cubic.easeOut',
        onComplete: () => burstImage.destroy(),
      });
      return;
    }
    this.time.delayedCall(160, () => burstImage.destroy());
  }

export function combatVictoryRally(this: any, x = GAME_WIDTH / 2, y = 292): any {
    if (!this.textures.exists(COMBAT_VICTORY_RALLY_TEXTURE)) return;
    this.textures.get(COMBAT_VICTORY_RALLY_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatVictoryRallyBursts += 1;
    const currentNode = currentCombatNodes()[this.currentRouteIndex];
    const reduced = prefersReducedMotion();
    const rally = this.add.image(x, y, COMBAT_VICTORY_RALLY_TEXTURE)
      .setDisplaySize(430, 322)
      .setAlpha(reduced ? 0.64 : 0.82)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('combat-victory-rally');
    const crest = this.add.image(x, y, COMBAT_VICTORY_RALLY_TEXTURE)
      .setDisplaySize(288, 216)
      .setAlpha(reduced ? 0.72 : 0.92)
      .setName('combat-victory-rally');
    this.fxLayer.add([rally, crest]);
    if (currentNode?.type === 'boss' || currentNode?.type === 'rival') {
      this.combatBossPhaseBreak(x, y - 8, 1.05);
    }
    this.combatVictoryFanfareSigil(x, y - 62);
    floatingText(this, this.fxLayer, x, y - 114, 'Rooftop Clear', '#ffe5a3');
    birdAudio.play('victory', 0.62);
    birdAudio.play('victoryFanfare', 0.94);

    if (reduced) {
      this.time.delayedCall(260, () => {
        rally.destroy();
        crest.destroy();
      });
      return;
    }

    this.fxMoteBurst(x, y + 8, 0xffd37a, {
      count: 30,
      speed: 210,
      lifespan: 700,
      scale: 0.86,
      gravityY: -18,
      spreadX: 210,
      spreadY: 48,
    });
    this.fxMoteBurst(x, y - 28, 0x8df4ff, {
      count: 18,
      speed: 170,
      lifespan: 620,
      scale: 0.64,
      gravityY: 0,
      spreadX: 250,
      spreadY: 72,
    });
    this.fxShockwave(x, y + 18, 0xffd37a, 220, 700, 0);
    this.tweens.add({
      targets: rally,
      scaleX: rally.scaleX * 1.18,
      scaleY: rally.scaleY * 1.18,
      angle: 7,
      alpha: 0,
      duration: 760,
      ease: 'Cubic.easeOut',
      onComplete: () => rally.destroy(),
    });
    this.tweens.add({
      targets: crest,
      scaleX: crest.scaleX * 1.08,
      scaleY: crest.scaleY * 1.08,
      y: y - 12,
      alpha: 0,
      duration: 880,
      ease: 'Sine.easeOut',
      onComplete: () => crest.destroy(),
    });
  }

export function combatVictoryFanfareSigil(this: any, x: number, y: number): any {
    if (!this.textures.exists(COMBAT_VICTORY_FANFARE_SIGIL_TEXTURE)) return;
    this.textures.get(COMBAT_VICTORY_FANFARE_SIGIL_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.setBattleFxDepth(110);
    this.children.bringToTop(this.fxLayer);
    this.combatVictoryFanfareSigilBursts += 1;
    const reduced = prefersReducedMotion();
    const sigil = this.add.image(x, y, COMBAT_VICTORY_FANFARE_SIGIL_TEXTURE)
      .setDisplaySize(206, 206)
      .setAlpha(reduced ? 0.88 : 0)
      .setDepth(4)
      .setName('combat-victory-fanfare-sigil');
    const glint = this.add.image(x, y, COMBAT_VICTORY_FANFARE_SIGIL_TEXTURE)
      .setDisplaySize(286, 286)
      .setAlpha(reduced ? 0.28 : 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffd37a)
      .setDepth(3)
      .setName('combat-victory-fanfare-sigil');
    const sidePins = [-1, 1].map((direction) => this.add.image(x + direction * 500, y + 135, COMBAT_VICTORY_FANFARE_SIGIL_TEXTURE)
      .setDisplaySize(132, 132)
      .setAlpha(reduced ? 0.56 : 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(direction < 0 ? 0x8df4ff : 0xffd37a)
      .setDepth(5)
      .setName('combat-victory-fanfare-sigil'));
    this.fxLayer.add([glint, sigil, ...sidePins]);
    if (!reduced) {
      this.fxMoteBurst(x, y - 22, 0xffd37a, {
        count: 20,
        speed: 190,
        lifespan: 760,
        scale: 0.72,
        gravityY: -32,
        spreadX: 230,
        spreadY: 58,
      });
      this.fxMoteBurst(x, y + 8, 0xff5acb, {
        count: 10,
        speed: 150,
        lifespan: 620,
        scale: 0.54,
        gravityY: -8,
        spreadX: 170,
        spreadY: 74,
      });
      this.tweens.add({
        targets: sigil,
        alpha: { from: 0, to: 0.94 },
        scaleX: { from: sigil.scaleX * 0.72, to: sigil.scaleX },
        scaleY: { from: sigil.scaleY * 0.72, to: sigil.scaleY },
        y: y - 8,
        duration: 260,
        ease: 'Back.easeOut',
      });
      this.tweens.add({
        targets: glint,
        alpha: { from: 0, to: 0.4 },
        scaleX: { from: glint.scaleX * 0.78, to: glint.scaleX },
        scaleY: { from: glint.scaleY * 0.78, to: glint.scaleY },
        angle: 9,
        duration: 340,
        ease: 'Cubic.easeOut',
      });
      this.tweens.add({
        targets: sidePins,
        alpha: { from: 0, to: 0.72 },
        scaleX: { from: sidePins[0].scaleX * 0.64, to: sidePins[0].scaleX },
        scaleY: { from: sidePins[0].scaleY * 0.64, to: sidePins[0].scaleY },
        duration: 260,
        delay: 80,
        ease: 'Back.easeOut',
      });
      this.tweens.add({
        targets: sigil,
        alpha: 0,
        y: y - 34,
        scaleX: sigil.scaleX * 1.08,
        scaleY: sigil.scaleY * 1.08,
        delay: 900,
        duration: 520,
        ease: 'Sine.easeIn',
        onComplete: () => sigil.destroy(),
      });
      this.tweens.add({
        targets: glint,
        alpha: 0,
        scaleX: glint.scaleX * 1.14,
        scaleY: glint.scaleY * 1.14,
        angle: 18,
        delay: 520,
        duration: 780,
        ease: 'Cubic.easeOut',
        onComplete: () => glint.destroy(),
      });
      this.tweens.add({
        targets: sidePins,
        alpha: 0,
        scaleX: sidePins[0].scaleX * 1.12,
        scaleY: sidePins[0].scaleY * 1.12,
        delay: 760,
        duration: 420,
        ease: 'Sine.easeIn',
        onComplete: () => sidePins.forEach((pin) => pin.destroy()),
      });
      return;
    }
    this.time.delayedCall(320, () => {
      sigil.destroy();
      glint.destroy();
      sidePins.forEach((pin) => pin.destroy());
    });
  }

export function combatTurnBanner(this: any, text: string, color: string, accent: number): any {
    this.combatTurnBannerBursts += 1;
    if (combatPacePreference() !== 'cinematic') return;
    banner(this, this.fxLayer, GAME_WIDTH / 2, 140, text, color, {
      fontFamily: TOKEN_DISPLAY_FONT,
      textureKey: COMBAT_TURN_BANNER_TEXTURE,
      width: 560,
      height: 186,
      name: 'combat-turn-banner'
    });
    this.fxMoteBurst(GAME_WIDTH / 2, 140, accent, {
      count: 10,
      speed: 74,
      lifespan: 430,
      scale: 0.56,
      gravityY: 0,
      spreadX: 240,
      spreadY: 18,
    });
  }

export function combatRoostHandoff(this: any, x = 468, y = 382, scale = 1): any {
    this.combatFxModule?.presentCombatRoostHandoff(this, x, y, scale);
  }

export function combatPlayerTurnRally(this: any, x = GAME_WIDTH / 2, y = 276, scale = 1): any {
    this.combatFxModule?.presentCombatPlayerTurnRally(this, x, y, scale);
  }

export function combatWindedGust(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_WINDED_GUST_TEXTURE)) return;
    this.textures.get(COMBAT_WINDED_GUST_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatWindedGustBursts += 1;
    const gust = this.add.image(x, y, COMBAT_WINDED_GUST_TEXTURE)
      .setDisplaySize(276 * scale, 207 * scale)
      .setAlpha(0.7)
      .setBlendMode(Phaser.BlendModes.NORMAL)
      .setAngle(Phaser.Math.Between(-14, 14))
      .setName('combat-winded-gust');
    this.fxLayer.add(gust);
    if (prefersReducedMotion()) {
      this.time.delayedCall(140, () => gust.destroy());
      return;
    }
    this.tweens.add({
      targets: gust,
      scaleX: gust.scaleX * 1.08,
      scaleY: gust.scaleY * 1.08,
      angle: gust.angle + Phaser.Math.Between(18, 34),
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => gust.destroy(),
    });
  }

export function combatFlowSurge(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_FLOW_SURGE_TEXTURE)) return;
    this.textures.get(COMBAT_FLOW_SURGE_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatFlowSurgeBursts += 1;
    const surge = this.add.image(x, y, COMBAT_FLOW_SURGE_TEXTURE)
      .setDisplaySize(286 * scale, 214 * scale)
      .setAlpha(0.76)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(Phaser.Math.Between(-10, 10))
      .setName('combat-flow-surge');
    this.fxLayer.add(surge);
    if (prefersReducedMotion()) {
      this.time.delayedCall(150, () => surge.destroy());
      return;
    }
    this.tweens.add({
      targets: surge,
      scaleX: surge.scaleX * 1.14,
      scaleY: surge.scaleY * 1.14,
      y: surge.y - 10,
      angle: surge.angle + Phaser.Math.Between(16, 30),
      alpha: 0,
      duration: 480,
      ease: 'Cubic.easeOut',
      onComplete: () => surge.destroy(),
    });
  }

export function combatCleanseBurst(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_CLEANSE_BURST_TEXTURE)) return;
    this.textures.get(COMBAT_CLEANSE_BURST_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatCleanseBurstBursts += 1;
    const burst = this.add.image(x, y, COMBAT_CLEANSE_BURST_TEXTURE)
      .setDisplaySize(270 * scale, 203 * scale)
      .setAlpha(0.78)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(Phaser.Math.Between(-12, 12))
      .setName('combat-cleanse-burst');
    this.fxLayer.add(burst);
    if (prefersReducedMotion()) {
      this.time.delayedCall(160, () => burst.destroy());
      return;
    }
    this.tweens.add({
      targets: burst,
      scaleX: burst.scaleX * 1.18,
      scaleY: burst.scaleY * 1.18,
      angle: burst.angle + Phaser.Math.Between(-28, -16),
      alpha: 0,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => burst.destroy(),
    });
  }

export function combatBankCache(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_BANK_CACHE_TEXTURE)) return;
    this.textures.get(COMBAT_BANK_CACHE_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatBankCacheBursts += 1;
    const cache = this.add.image(x, y, COMBAT_BANK_CACHE_TEXTURE)
      .setDisplaySize(330 * scale, 248 * scale)
      .setAlpha(0.86)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(Phaser.Math.Between(-8, 8))
      .setName('combat-bank-cache');
    this.fxLayer.add(cache);
    if (prefersReducedMotion()) {
      this.time.delayedCall(170, () => cache.destroy());
      return;
    }
    this.tweens.add({
      targets: cache,
      scaleX: cache.scaleX * 1.1,
      scaleY: cache.scaleY * 1.1,
      y: cache.y - 8,
      angle: cache.angle + Phaser.Math.Between(-24, -12),
      alpha: { value: 0, duration: 620, delay: 180 },
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => cache.destroy(),
    });
  }

export function combatSupplyUseBurst(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_SUPPLY_USE_BURST_TEXTURE)) return;
    this.textures.get(COMBAT_SUPPLY_USE_BURST_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatSupplyUseBurstBursts += 1;
    const reduced = prefersReducedMotion();
    const clamped = Phaser.Math.Clamp(scale, 0.7, 1.08);
    const size = 216 * clamped;
    const angle = Phaser.Math.Between(-7, 7);
    const glow = this.add.image(x, y, COMBAT_SUPPLY_USE_BURST_TEXTURE)
      .setDisplaySize(size * 1.12, size * 1.12)
      .setAlpha(reduced ? 0.28 : 0.36)
      .setTint(0xffd37a)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(angle)
      .setName('combat-supply-use-burst');
    const burst = this.add.image(x, y, COMBAT_SUPPLY_USE_BURST_TEXTURE)
      .setDisplaySize(size, size)
      .setAlpha(reduced ? 0.86 : 0.96)
      .setAngle(angle)
      .setName('combat-supply-use-burst');
    this.fxLayer.add([glow, burst]);
    this.fxLayer.bringToTop(glow);
    this.fxLayer.bringToTop(burst);
    if (reduced) {
      this.time.delayedCall(180, () => {
        glow.destroy();
        burst.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: glow,
      scaleX: glow.scaleX * 1.18,
      scaleY: glow.scaleY * 1.18,
      y: y - 10,
      angle: angle + Phaser.Math.Between(-10, 10),
      alpha: 0,
      duration: 540,
      ease: 'Cubic.easeOut',
      onComplete: () => glow.destroy(),
    });
    this.tweens.add({
      targets: burst,
      scaleX: burst.scaleX * 1.08,
      scaleY: burst.scaleY * 1.08,
      y: y - 8,
      angle: angle + Phaser.Math.Between(-6, 6),
      alpha: { value: 0, duration: 360, delay: 180 },
      duration: 560,
      ease: 'Cubic.easeOut',
      onComplete: () => burst.destroy(),
    });
    this.fxMoteBurst(x, y + 8, 0xffcf7a, {
      count: 12,
      speed: 112,
      lifespan: 420,
      scale: 0.44,
      gravityY: -10,
      spreadX: 24,
      spreadY: 14,
    });
    this.fxMoteBurst(x + 8, y - 4, 0x8df4ff, {
      count: 7,
      speed: 92,
      lifespan: 360,
      scale: 0.38,
      gravityY: -8,
      spreadX: 18,
      spreadY: 10,
    });
  }

export function combatThreatCharge(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_THREAT_CHARGE_TEXTURE)) return;
    this.textures.get(COMBAT_THREAT_CHARGE_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatThreatChargeBursts += 1;
    const warning = this.add.image(x, y, COMBAT_THREAT_CHARGE_TEXTURE)
      .setDisplaySize(340 * scale, 255 * scale)
      .setAlpha(0.46)
      .setAngle(Phaser.Math.Between(-10, 10))
      .setName('combat-threat-charge');
    const charge = this.add.image(x, y, COMBAT_THREAT_CHARGE_TEXTURE)
      .setDisplaySize(340 * scale, 255 * scale)
      .setAlpha(0.96)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(warning.angle)
      .setName('combat-threat-charge');
    this.fxLayer.add([warning, charge]);
    if (prefersReducedMotion()) {
      this.time.delayedCall(Math.max(520, this.combatTimingDelay(ENEMY_ATTACK_WINDUP_MS) - 80), () => {
        warning.destroy();
        charge.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: [warning, charge],
      scaleX: charge.scaleX * 1.12,
      scaleY: charge.scaleY * 1.12,
      angle: charge.angle + Phaser.Math.Between(18, 32),
      alpha: { value: 0, duration: 720, delay: Math.max(1500, ENEMY_ATTACK_WINDUP_MS - 460) },
      duration: 840,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        warning.destroy();
        charge.destroy();
      },
    });
  }

export function combatEnemySupportCharge(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_ENEMY_SUPPORT_CHARGE_TEXTURE)) return;
    this.textures.get(COMBAT_ENEMY_SUPPORT_CHARGE_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatEnemySupportChargeBursts += 1;
    const size = 360 * scale;
    const angle = Phaser.Math.Between(-5, 5);
    const backing = this.add.image(x, y, COMBAT_ENEMY_SUPPORT_CHARGE_TEXTURE)
      .setDisplaySize(size * 1.04, size * 1.04)
      .setAlpha(0.56)
      .setAngle(angle)
      .setName('combat-enemy-support-charge');
    const charge = this.add.image(x, y, COMBAT_ENEMY_SUPPORT_CHARGE_TEXTURE)
      .setDisplaySize(size, size)
      .setAlpha(0.92)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(angle)
      .setName('combat-enemy-support-charge');
    this.fxLayer.add([backing, charge]);
    if (prefersReducedMotion()) {
      this.time.delayedCall(Math.max(520, this.combatTimingDelay(ENEMY_ATTACK_WINDUP_MS) - 80), () => {
        backing.destroy();
        charge.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: [backing, charge],
      scaleX: charge.scaleX * 1.08,
      scaleY: charge.scaleY * 1.08,
      angle: charge.angle + Phaser.Math.Between(-12, 12),
      alpha: { value: 0, duration: 720, delay: Math.max(1500, ENEMY_ATTACK_WINDUP_MS - 460) },
      duration: 880,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        backing.destroy();
        charge.destroy();
      },
    });
    this.tweens.add({
      targets: charge,
      y: y - 6,
      duration: 280,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
  }

export function combatEnemyAttackTell(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_ENEMY_ATTACK_TELL_TEXTURE)) return;
    this.textures.get(COMBAT_ENEMY_ATTACK_TELL_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatEnemyAttackTellBursts += 1;
    const size = 210 * scale;
    const angle = Phaser.Math.Between(-4, 4);
    const halo = this.add.image(x, y, COMBAT_ENEMY_ATTACK_TELL_TEXTURE)
      .setDisplaySize(size * 1.08, size * 1.08)
      .setAlpha(0.46)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(angle)
      .setName('combat-enemy-attack-tell');
    const tell = this.add.image(x, y, COMBAT_ENEMY_ATTACK_TELL_TEXTURE)
      .setDisplaySize(size, size)
      .setAlpha(0.96)
      .setAngle(angle)
      .setName('combat-enemy-attack-tell');
    this.fxLayer.add([halo, tell]);
    if (prefersReducedMotion()) {
      this.time.delayedCall(Math.max(520, this.combatTimingDelay(ENEMY_ATTACK_WINDUP_MS) - 80), () => {
        halo.destroy();
        tell.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: [halo, tell],
      alpha: { value: 0, duration: 720, delay: Math.max(1500, ENEMY_ATTACK_WINDUP_MS - 460) },
      duration: 840,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        halo.destroy();
        tell.destroy();
      },
    });
    this.tweens.add({
      targets: halo,
      scaleX: halo.scaleX * 1.12,
      scaleY: halo.scaleY * 1.12,
      duration: 620,
      ease: 'Cubic.easeOut',
    });
    this.tweens.add({
      targets: tell,
      scaleX: tell.scaleX * 1.06,
      scaleY: tell.scaleY * 1.06,
      duration: 620,
      ease: 'Cubic.easeOut',
    });
    this.tweens.add({
      targets: tell,
      y: y - 10,
      duration: 220,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
  }

export function combatEnemySupportTell(this: any, x: number, y: number, scale = 1): any {
    if (!this.textures.exists(COMBAT_ENEMY_SUPPORT_TELL_TEXTURE)) return;
    this.textures.get(COMBAT_ENEMY_SUPPORT_TELL_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.combatEnemySupportTellBursts += 1;
    const size = 202 * scale;
    const angle = Phaser.Math.Between(-3, 3);
    const aura = this.add.image(x, y, COMBAT_ENEMY_SUPPORT_TELL_TEXTURE)
      .setDisplaySize(size * 1.12, size * 1.12)
      .setAlpha(0.44)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(angle)
      .setName('combat-enemy-support-tell');
    const tell = this.add.image(x, y, COMBAT_ENEMY_SUPPORT_TELL_TEXTURE)
      .setDisplaySize(size, size)
      .setAlpha(0.94)
      .setAngle(angle)
      .setName('combat-enemy-support-tell');
    this.fxLayer.add([aura, tell]);
    if (prefersReducedMotion()) {
      this.time.delayedCall(Math.max(520, this.combatTimingDelay(ENEMY_ATTACK_WINDUP_MS) - 80), () => {
        aura.destroy();
        tell.destroy();
      });
      return;
    }
    this.tweens.add({
      targets: [aura, tell],
      alpha: { value: 0, duration: 720, delay: Math.max(1500, ENEMY_ATTACK_WINDUP_MS - 460) },
      duration: 840,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        aura.destroy();
        tell.destroy();
      },
    });
    this.tweens.add({
      targets: aura,
      scaleX: aura.scaleX * 1.12,
      scaleY: aura.scaleY * 1.12,
      duration: 660,
      ease: 'Cubic.easeOut',
    });
    this.tweens.add({
      targets: tell,
      y: y - 8,
      scaleX: tell.scaleX * 1.045,
      scaleY: tell.scaleY * 1.045,
      duration: 260,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
  }

