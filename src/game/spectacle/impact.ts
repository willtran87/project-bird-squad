import Phaser from 'phaser';
import { prefersReducedMotion } from '../../main';
import { prefersLeanEffects } from '../graphics-quality';
import { flashEffectsState } from '../visual-accessibility';
import { ensureSpectacleTextures } from './stage';

/**
 * Contact dressing: what a hit throws off. Everything lives on two layers this
 * module owns (never the scene's own FX lane), cleans itself up, and is
 * dropped under Lean graphics. Reduced Motion keeps only the still floor marks.
 */

const IMPACT_LAYER = 'spectacle-impact';
const MARK_LAYER = 'spectacle-marks';
const MAX_MARKS = 36;
const SUIT_PLUMES = 0xff9d4d, SUIT_BASINS = 0x7ab8d6, SUIT_QUILLS = 0xd8e0ea, SUIT_NESTS = 0x8fd6a0;

function ownedLayer(scene: Phaser.Scene, name: string, depth: number) {
  let layer = scene.data.get(name) as Phaser.GameObjects.Container | undefined;
  if (!layer?.active) {
    layer = scene.add.container(0, 0).setDepth(depth).setName(name);
    scene.data.set(name, layer);
  }
  return layer;
}

const still = () => prefersReducedMotion() || prefersLeanEffects();

/** Loose feathers: the game's signature debris. `direction` is the way the
 * blow travels (1 = rightwards). */
export function featherBurst(scene: Phaser.Scene, x: number, y: number, count: number, direction: 1 | -1, tints: number[]) {
  if (still()) return;
  const { feather } = ensureSpectacleTextures(scene);
  const angle = direction > 0 ? { min: -70, max: 25 } : { min: 155, max: 250 };
  const emitter = scene.add.particles(x, y, feather, {
    lifespan: { min: 620, max: 1150 },
    speed: { min: 90, max: 280 }, angle, gravityY: 360,
    rotate: { start: 0, end: 420 * direction }, scale: { min: 0.55, max: 1.05 },
    alpha: { start: 0.95, end: 0, ease: 'Cubic.easeIn' }, tint: tints,
    emitting: false,
  });
  ownedLayer(scene, IMPACT_LAYER, 20).add(emitter);
  emitter.explode(count);
  scene.time.delayedCall(1250, () => emitter.destroy());
}

/** A hit briefly lights the wet floor and the air around it. */
export function impactLight(scene: Phaser.Scene, x: number, y: number, color: number, heavy: boolean) {
  if (prefersLeanEffects()) return;
  const reduced = prefersReducedMotion();
  if (flashEffectsState(reduced).reduced) return;
  const { glow } = ensureSpectacleTextures(scene);
  const size = heavy ? 300 : 210;
  const layer = ownedLayer(scene, IMPACT_LAYER, 20);
  const pool = scene.add.image(x, y + 44, glow).setTint(color).setBlendMode(Phaser.BlendModes.ADD)
    .setDisplaySize(size * 1.5, size * 0.42).setAlpha(heavy ? 0.5 : 0.36);
  const air = scene.add.image(x, y, glow).setTint(color).setBlendMode(Phaser.BlendModes.ADD)
    .setDisplaySize(size, size).setAlpha(heavy ? 0.42 : 0.3);
  layer.add([pool, air]);
  scene.tweens.add({
    targets: [pool, air], alpha: 0, duration: reduced ? 120 : 280, ease: 'Quad.easeOut',
    onComplete: () => { pool.destroy(); air.destroy(); },
  });
}

/** Each suit lands differently: Plumes slash, Basins ripple, Quills pierce
 * as a volley, Nests thud into the ground. */
export function suitImpact(scene: Phaser.Scene, x: number, y: number, color: number, heavy: boolean) {
  if (still()) return;
  const layer = ownedLayer(scene, IMPACT_LAYER, 20);
  const { ring, streak, glow } = ensureSpectacleTextures(scene);
  const reach = heavy ? 1.3 : 1;
  const fade = (targets: Phaser.GameObjects.GameObject[], to: object, duration: number) => scene.tweens.add({
    targets, ...to, alpha: 0, duration, ease: 'Cubic.easeOut',
    onComplete: () => targets.forEach(target => target.destroy()),
  });
  if (color === SUIT_PLUMES) {
    const slash = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    [[7, 0.9, 0xffffff], [16, 0.35, color]].forEach(([width, alpha, tint]) => {
      slash.lineStyle(width, tint, alpha);
      slash.beginPath();
      slash.arc(0, 0, 62 * reach, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(40));
      slash.strokePath();
    });
    slash.setPosition(x - 18, y).setAngle(-24).setScale(0.6);
    layer.add(slash);
    fade([slash], { scale: 1.25, angle: 18 }, 230);
  } else if (color === SUIT_BASINS) {
    [0, 90].forEach((delay, index) => {
      const ripple = scene.add.image(x, y + 30, ring).setTint(color).setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.3, 0.12).setAlpha(0.9 - index * 0.25);
      layer.add(ripple);
      scene.tweens.add({
        targets: ripple, scaleX: 3.4 * reach, scaleY: 1.15 * reach, alpha: 0, delay, duration: 430, ease: 'Cubic.easeOut',
        onComplete: () => ripple.destroy(),
      });
    });
  } else if (color === SUIT_QUILLS) {
    [-22, 0, 22].forEach((offset, index) => {
      const quill = scene.add.image(x - 130, y + offset * 1.4, streak).setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD)
        .setAngle(-90 + offset * 0.35).setScale(1.6, 2.4 * reach).setAlpha(0.95);
      layer.add(quill);
      scene.tweens.add({
        targets: quill, x: x + 14, y: y + offset * 0.3, alpha: 0, delay: index * 34, duration: 170, ease: 'Quad.easeIn',
        onComplete: () => quill.destroy(),
      });
    });
  } else if (color === SUIT_NESTS) {
    const thud = scene.add.image(x, y + 42, ring).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5, 0.16).setAlpha(0.95);
    const dust = scene.add.particles(x, y + 42, glow, {
      lifespan: { min: 380, max: 640 }, speedX: { min: -150, max: 150 }, speedY: { min: -70, max: -10 },
      scale: { start: 0.22, end: 0.5 }, alpha: { start: 0.3, end: 0 }, tint: 0xb9a583, emitting: false,
    });
    layer.add([thud, dust]);
    dust.explode(heavy ? 12 : 7);
    fade([thud], { scaleX: 3 * reach, scaleY: 0.9 * reach }, 320);
    scene.time.delayedCall(700, () => dust.destroy());
  }
}

/** Cover behaves like armour: a blocked blow throws hard, bright sparks. */
export function blockSparks(scene: Phaser.Scene, x: number, y: number, color: number, count = 12) {
  if (still()) return;
  const { streak } = ensureSpectacleTextures(scene);
  const sparks = scene.add.particles(x, y, streak, {
    lifespan: { min: 160, max: 340 }, speed: { min: 240, max: 520 }, angle: { min: 0, max: 360 },
    scaleX: 0.9, scaleY: { start: 0.9, end: 0.1 }, alpha: { start: 1, end: 0 },
    tint: [0xffffff, color], blendMode: Phaser.BlendModes.ADD, emitting: false,
  });
  // Each spark is a streak aligned with its own flight.
  sparks.onParticleEmit((particle: Phaser.GameObjects.Particles.Particle) => {
    particle.angle = Phaser.Math.RadToDeg(Math.atan2(particle.velocityY, particle.velocityX)) + 90;
  });
  ownedLayer(scene, IMPACT_LAYER, 20).add(sparks);
  sparks.explode(count);
  scene.time.delayedCall(450, () => sparks.destroy());
}

/** Gains rise; damage falls and scatters. */
export function risingMotes(scene: Phaser.Scene, x: number, y: number, color: number, count = 12) {
  if (still()) return;
  const { glow } = ensureSpectacleTextures(scene);
  const motes = scene.add.particles(x, y, glow, {
    x: { min: -56, max: 56 }, y: { min: -10, max: 60 },
    lifespan: { min: 700, max: 1200 }, speedY: { min: -150, max: -60 }, speedX: { min: -16, max: 16 },
    scale: { start: 0.16, end: 0.02 }, alpha: { start: 0.9, end: 0 }, tint: color,
    blendMode: Phaser.BlendModes.ADD, emitting: false,
  });
  ownedLayer(scene, IMPACT_LAYER, 20).add(motes);
  motes.explode(count);
  scene.time.delayedCall(1300, () => motes.destroy());
}

/** While an enemy winds up, a line of intent creeps from it to the flock. */
export function dangerLine(scene: Phaser.Scene, fromX: number, fromY: number, toX: number, toY: number, windupMs: number) {
  if (still()) return;
  const line = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setName('spectacle-danger-line');
  ownedLayer(scene, IMPACT_LAYER, 20).add(line);
  const draw = (reach: number, alpha: number) => {
    line.clear();
    const dashes = 14;
    for (let index = 0; index < dashes * reach; index += 1) {
      const a = index / dashes, b = Math.min(reach, (index + 0.55) / dashes);
      line.lineStyle(2 + a * 4, 0xff5247, alpha * (0.35 + a * 0.65));
      line.lineBetween(Phaser.Math.Linear(fromX, toX, a), Phaser.Math.Linear(fromY, toY, a),
        Phaser.Math.Linear(fromX, toX, b), Phaser.Math.Linear(fromY, toY, b));
    }
  };
  const grow = Math.max(240, windupMs * 0.6);
  scene.tweens.addCounter({
    from: 0, to: 1, duration: grow, ease: 'Sine.easeIn',
    onUpdate: (tween) => { if (line.active) draw(tween.getValue() ?? 1, 0.85); },
  });
  scene.tweens.addCounter({
    from: 0.85, to: 0, delay: Math.max(grow, windupMs - 120), duration: 200,
    onUpdate: (tween) => { if (line.active) draw(1, tween.getValue() ?? 0); },
    onComplete: () => line.destroy(),
  });
}

/** What a fight leaves behind: feathers settle on the floor and stay there. */
export function leaveMarks(scene: Phaser.Scene, x: number, y: number, count: number, tints: number[]) {
  if (prefersLeanEffects()) return;
  const { feather } = ensureSpectacleTextures(scene);
  const layer = ownedLayer(scene, MARK_LAYER, -18);
  for (let index = 0; index < count; index += 1) {
    const mark = scene.add.image(x + Phaser.Math.Between(-70, 70), y + Phaser.Math.Between(34, 62), feather)
      .setAngle(Phaser.Math.Between(-80, 80)).setScale(Phaser.Math.FloatBetween(0.7, 1.1), 0.6)
      .setTint(Phaser.Utils.Array.GetRandom(tints)).setAlpha(prefersReducedMotion() ? 0.5 : 0);
    layer.add(mark);
    if (!prefersReducedMotion()) scene.tweens.add({ targets: mark, alpha: 0.5, delay: 500 + index * 60, duration: 400 });
  }
  while (layer.length > MAX_MARKS) layer.first?.destroy();
}
