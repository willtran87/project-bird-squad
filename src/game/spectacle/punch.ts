import Phaser from 'phaser';
import { prefersReducedMotion } from '../../main';
import { prefersLeanEffects } from '../graphics-quality';
import { flashEffectsState, screenShakeState } from '../visual-accessibility';
import { ensureSpectacleTextures } from './stage';

/**
 * Impact weight. Each helper is a short, self-cleaning presentation beat that
 * reads the same accessibility preferences as the rest of combat: camera
 * movement follows Screen Shake, light bursts follow Flash Effects, and none
 * of it changes combat timing or state.
 */

const PUNCH_KEY = 'spectacle-punch';

/** Snap the camera in on contact, hold a beat, then settle. The hold is the
 * hit-stop: a visible freeze of framing that leaves game clocks untouched. */
export function cameraPunch(scene: Phaser.Scene, strength: number) {
  const reduced = prefersReducedMotion();
  if (reduced || !screenShakeState(reduced).enabled) return;
  const camera = scene.cameras.main;
  const data = scene.data;
  (data.get(PUNCH_KEY) as Phaser.Tweens.Tween | undefined)?.stop();
  camera.setZoom(Math.max(camera.zoom, 1 + strength));
  data.set(PUNCH_KEY, scene.tweens.add({
    targets: camera, zoom: 1, delay: 45, duration: 190, ease: 'Cubic.easeOut',
    onStop: () => camera.setZoom(1),
  }));
}

/** A brief coloured wash at the screen edges (taking a hit, a finishing blow). */
export function edgeFlash(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, color: number, strength = 0.34) {
  const reduced = prefersReducedMotion();
  if (reduced || flashEffectsState(reduced).reduced || scene.game.renderer.type !== Phaser.WEBGL) return;
  const { width, height } = scene.scale.gameSize;
  const wash = scene.add.graphics().setName('spectacle-edge-flash').setBlendMode(Phaser.BlendModes.ADD);
  wash.fillGradientStyle(color, color, color, color, strength, strength, 0, 0);
  wash.fillRect(0, 0, width, height * 0.22);
  wash.fillGradientStyle(color, color, color, color, 0, 0, strength, strength);
  wash.fillRect(0, height * 0.78, width, height * 0.22);
  wash.fillGradientStyle(color, color, color, color, strength, 0, strength, 0);
  wash.fillRect(0, 0, width * 0.16, height);
  wash.fillGradientStyle(color, color, color, color, 0, strength, 0, strength);
  wash.fillRect(width * 0.84, 0, width * 0.16, height);
  layer.add(wash);
  scene.tweens.add({ targets: wash, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => wash.destroy() });
}

type Portrait = Phaser.GameObjects.Image;

function nearestEnemyPortrait(scene: Phaser.Scene, x: number, y: number): Portrait | undefined {
  const root = (scene as unknown as { root?: Phaser.GameObjects.Container }).root;
  let best: Portrait | undefined;
  let bestDistance = 180;
  const visit = (object: Phaser.GameObjects.GameObject, depth: number) => {
    if (object.name === 'combat-enemy-portrait') {
      const matrix = (object as Portrait).getWorldTransformMatrix();
      const distance = Phaser.Math.Distance.Between(matrix.tx, matrix.ty, x, y);
      if (distance < bestDistance) { best = object as Portrait; bestDistance = distance; }
      return;
    }
    if (depth < 3 && object instanceof Phaser.GameObjects.Container) object.list.forEach(child => visit(child, depth + 1));
  };
  root?.list.forEach(child => visit(child, 0));
  return best;
}

/** A fallen enemy does not blink out: its silhouette staggers, darkens and
 * drops away while loose feathers scatter. The copy lives in the FX layer, so
 * the authoritative redraw can remove the real combatant immediately. */
export function defeatGhost(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, x: number, y: number) {
  if (prefersReducedMotion()) return;
  const portrait = nearestEnemyPortrait(scene, x, y);
  if (!portrait) return;
  const matrix = portrait.getWorldTransformMatrix();
  const ghost = scene.add.image(matrix.tx, matrix.ty, portrait.texture.key, portrait.frame.name)
    .setOrigin(portrait.originX, portrait.originY)
    .setScale(matrix.scaleX, matrix.scaleY)
    .setFlip(portrait.flipX, portrait.flipY)
    .setName('spectacle-defeat-ghost');
  layer.addAt(ghost, 0);
  const lean = x > scene.scale.gameSize.width / 2 ? 1 : -1;
  scene.tweens.add({
    targets: ghost, x: ghost.x + 26 * lean, y: ghost.y + 34, angle: 16 * lean,
    scaleX: ghost.scaleX * 0.94, scaleY: ghost.scaleY * 0.86, alpha: 0,
    duration: 560, ease: 'Cubic.easeIn', onComplete: () => ghost.destroy(),
  });
  scene.tweens.addCounter({
    from: 255, to: 60, duration: 420,
    onUpdate: (tween) => {
      const value = Math.round(tween.getValue() ?? 60);
      if (ghost.active) ghost.setTint(Phaser.Display.Color.GetColor(value, value * 0.9, value * 0.95));
    },
  });
  if (prefersLeanEffects()) return;
  const { streak } = ensureSpectacleTextures(scene);
  const feathers = scene.add.particles(x, y - 20, streak, {
    lifespan: { min: 520, max: 900 },
    speed: { min: 70, max: 230 }, angle: { min: 200, max: 340 }, gravityY: 420,
    rotate: { start: 0, end: 300 }, scaleX: { min: 1.6, max: 2.6 }, scaleY: { min: 0.35, max: 0.6 },
    alpha: { start: 0.9, end: 0 }, tint: [0xe8e0d0, 0x9aa6b4, 0x5d6772],
    emitting: false,
  });
  layer.add(feathers);
  feathers.explode(14);
  scene.time.delayedCall(1000, () => feathers.destroy());
}
