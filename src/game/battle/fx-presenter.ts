import Phaser from 'phaser';

export type BattleFxParticleQuality = {
  lean: boolean;
  particleBurstCap: number;
  particleScale: number;
};

export type BattleFxAnimationOptions = {
  scale?: number;
  alpha?: number;
  angle?: number;
  flipX?: boolean;
  tint?: number;
  additive?: boolean;
  onComplete?: () => void;
};

export type BattleFxMoteOptions = {
  count?: number;
  speed?: number;
  lifespan?: number;
  angle?: { min: number; max: number };
  scale?: number;
  gravityY?: number;
  spreadX?: number;
  spreadY?: number;
};

export interface BattleFxPresentationHost {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Container;
  reducedMotion: boolean;
  leanEffects: boolean;
  particleQuality: BattleFxParticleQuality;
  readonly activeParticleBursts: number;
  setActiveParticleBursts(value: number): void;
  onActionTrailRendered(): void;
}

export function playBattleFxAnimation(
  host: BattleFxPresentationHost,
  textureKey: string,
  animKey: string,
  x: number,
  y: number,
  options: BattleFxAnimationOptions = {},
) {
  const { scene, layer } = host;
  if (!scene.textures.exists(textureKey) || !scene.anims.exists(animKey)) return undefined;
  const sprite = scene.add.sprite(x, y, textureKey)
    .setOrigin(0.5)
    .setScale(options.scale ?? 1.35)
    .setAlpha(options.alpha ?? 0.96)
    .setAngle(options.angle ?? 0);
  if (options.flipX) sprite.setFlipX(true);
  if (options.tint) sprite.setTint(options.tint);
  if (options.additive) sprite.setBlendMode(Phaser.BlendModes.ADD);
  layer.add(sprite);
  sprite.play(animKey);
  sprite.once('animationcomplete', () => {
    options.onComplete?.();
    sprite.destroy();
  });
  return sprite;
}

export function presentBattleFxMoteBurst(
  host: BattleFxPresentationHost,
  particleTextureKey: string,
  x: number,
  y: number,
  color: number,
  options: BattleFxMoteOptions = {},
) {
  const { scene, layer, particleQuality } = host;
  if (host.reducedMotion || !scene.textures.exists(particleTextureKey)) return;
  if (host.activeParticleBursts >= particleQuality.particleBurstCap) return;
  const lifespan = options.lifespan ?? 420;
  const pressureScale = host.activeParticleBursts >= 3 ? 0.45 : host.activeParticleBursts >= 2 ? 0.68 : 1;
  const count = Math.max(
    particleQuality.lean ? 2 : 4,
    Math.round((options.count ?? 12) * pressureScale * particleQuality.particleScale),
  );
  const speed = options.speed ?? 135;
  const emitter = scene.add.particles(x, y, particleTextureKey, {
    emitting: false,
    frequency: -1,
    lifespan: { min: Math.max(140, lifespan * 0.55), max: lifespan },
    speed: { min: speed * 0.22, max: speed },
    angle: options.angle ?? { min: 0, max: 360 },
    x: { min: -(options.spreadX ?? 8), max: options.spreadX ?? 8 },
    y: { min: -(options.spreadY ?? 8), max: options.spreadY ?? 8 },
    scale: { start: (options.scale ?? 0.82) * 0.38, end: 0, ease: 'Cubic.easeOut' },
    alpha: { start: 0.95, end: 0, ease: 'Cubic.easeIn' },
    rotate: { min: -45, max: 45 },
    gravityY: options.gravityY ?? 24,
    tint: { start: 0xffffff, end: color },
    blendMode: Phaser.BlendModes.ADD,
    maxParticles: count,
    reserve: count,
  });
  host.setActiveParticleBursts(host.activeParticleBursts + 1);
  emitter.setDepth(layer.depth + 1);
  scene.children.bringToTop(emitter);
  emitter.explode(count);
  scene.time.delayedCall(lifespan + 120, () => {
    if (emitter.active) emitter.destroy();
    host.setActiveParticleBursts(Math.max(0, host.activeParticleBursts - 1));
  });
}

export function presentBattleFxShardSweep(
  host: BattleFxPresentationHost,
  particleTextureKey: string,
  x: number,
  y: number,
  color: number,
  direction: 1 | -1,
  count = 10,
) {
  presentBattleFxMoteBurst(host, particleTextureKey, x, y, color, {
    count,
    speed: 180,
    lifespan: 360,
    angle: direction > 0 ? { min: -40, max: 40 } : { min: 140, max: 220 },
    scale: 0.72,
    gravityY: 8,
    spreadX: 4,
    spreadY: 10,
  });
}

export function presentBattleFxGlowPulse(
  host: BattleFxPresentationHost,
  x: number,
  y: number,
  color: number,
  radius = 72,
  duration = 360,
  alpha = 0.2,
) {
  if (host.reducedMotion || host.leanEffects) return;
  const { scene, layer } = host;
  const glow = scene.add.container(x, y);
  const falloff = scene.add.ellipse(0, 0, radius * 1.12, radius * 0.56, color, alpha * 0.5)
    .setOrigin(0.5);
  const core = scene.add.ellipse(0, 0, radius * 0.5, radius * 0.24, color, Math.min(0.38, alpha * 1.28))
    .setOrigin(0.5)
    .setBlendMode(Phaser.BlendModes.ADD);
  glow.add([falloff, core]);
  glow.setScale(0.68).setAlpha(1);
  layer.add(glow);
  scene.tweens.add({
    targets: glow,
    scaleX: 1.52,
    scaleY: 1.2,
    alpha: 0,
    duration,
    ease: 'Cubic.easeOut',
    onComplete: () => glow.destroy(true),
  });
}

export function presentBattleFxShockwave(
  host: BattleFxPresentationHost,
  x: number,
  y: number,
  color: number,
  radius = 86,
  duration = 430,
  tilt = -8,
) {
  if (host.reducedMotion || host.leanEffects) return;
  const { scene, layer } = host;
  const ring = scene.add.graphics();
  ring.lineStyle(3, 0x020409, 0.38);
  ring.strokeEllipse(0, 0, radius * 1.03, radius * 0.44);
  ring.lineStyle(2, color, 0.9);
  ring.strokeEllipse(0, 0, radius, radius * 0.42);
  ring.lineStyle(1, 0xffffff, 0.42);
  ring.strokeEllipse(0, 0, radius * 0.66, radius * 0.25);
  ring.setPosition(x, y).setAngle(tilt).setScale(0.68).setBlendMode(Phaser.BlendModes.ADD);
  layer.add(ring);
  scene.tweens.add({
    targets: ring,
    scaleX: 1.38,
    scaleY: 1.12,
    alpha: 0,
    duration,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });
}

export function presentBattleFxDirectionalStreak(
  host: BattleFxPresentationHost,
  actionTrailTextureKey: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number,
  duration = 260,
  hold = 0,
) {
  if (host.reducedMotion) return;
  const { scene, layer } = host;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const angle = Phaser.Math.Angle.Between(x1, y1, x2, y2);
  const streak = scene.add.container(0, 0);
  if (scene.textures.exists(actionTrailTextureKey)) {
    scene.textures.get(actionTrailTextureKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    host.onActionTrailRendered();
    const width = Phaser.Math.Clamp(distance * 1.24, 220, 680);
    const height = Phaser.Math.Clamp(width * 0.28, 52, 96);
    const trail = scene.add.image((x1 + x2) / 2, (y1 + y2) / 2, actionTrailTextureKey)
      .setDisplaySize(width, height)
      .setRotation(angle)
      .setAlpha(0.72)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('combat-action-trail');
    streak.add(trail);
  }
  const shadow = scene.add.line(0, 0, x1, y1, x2, y2, 0x020409, 0.36).setOrigin(0);
  shadow.setLineWidth(6, 1);
  const ribbon = scene.add.line(0, 0, x1, y1, x2, y2, color, 0.94).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
  ribbon.setLineWidth(4, 0.9);
  const glint = scene.add.line(0, 0, x1 + 3, y1 - 3, x2 - 6, y2 + 5, 0xffffff, 0.48).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
  glint.setLineWidth(1.6, 0.25);
  streak.add([shadow, ribbon, glint]);
  streak.setAlpha(0.96);
  layer.add(streak);
  scene.tweens.add({
    targets: streak,
    alpha: 0,
    x: dx * 0.018,
    y: dy * 0.018,
    delay: hold,
    duration,
    ease: 'Cubic.easeOut',
    onComplete: () => streak.destroy(true),
  });
}
