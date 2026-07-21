import Phaser from 'phaser';

const FLOATING_CALLOUT_TEXTURE = 'combat-floating-callout';

/** Floating combat text that drifts up and fades out, then self-destructs. */
export function floatingText(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  text: string,
  color: string,
  options: { name?: string; holdMs?: number } = {},
): void {
  const group = scene.add.container(x, y).setAlpha(0).setScale(0.96);
  if (options.name) group.setName(options.name);
  const label = scene.add.text(0, -1, text, {
    fontFamily: 'sans-serif',
    fontSize: '22px',
    fontStyle: 'bold',
    color,
    stroke: '#101018',
    strokeThickness: 3,
  });
  label.setOrigin(0.5);
  if (scene.textures.exists(FLOATING_CALLOUT_TEXTURE)) {
    scene.textures.get(FLOATING_CALLOUT_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const plateWidth = Phaser.Math.Clamp(label.width + 78, 154, 360);
    const plate = scene.add.image(0, 2, FLOATING_CALLOUT_TEXTURE)
      .setDisplaySize(plateWidth, 48)
      .setAlpha(0.9)
      .setName(options.name ? `${options.name}-plate` : 'combat-floating-callout');
    group.add(plate);
  }
  group.add(label);
  layer.add(group);
  scene.time.delayedCall(0, () => {
    if (group.active) layer.bringToTop(group);
  });
  scene.tweens.add({
    targets: group,
    alpha: 1,
    scale: 1,
    y: y - 8,
    duration: 110,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: group,
        y: y - 48,
        alpha: 0,
        delay: options.holdMs ?? 380,
        duration: 330,
        ease: 'Cubic.easeOut',
        onComplete: () => group.destroy(true),
      });
    },
  });
}

/** Flash + shake a target without setTint (works on shapes). */
export function flashTarget(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject & { x: number; y: number },
  color = 0xffffff,
): void {
  const sized = target as Partial<{ displayWidth: number; displayHeight: number }>;
  const w = sized.displayWidth ?? 160;
  const h = sized.displayHeight ?? 120;
  const layer = (target as Phaser.GameObjects.GameObject & {
    parentContainer?: Phaser.GameObjects.Container;
  }).parentContainer;

  const overlay = scene.add.ellipse(target.x, target.y, w, h, color, 0.5);
  if (layer) {
    layer.add(overlay);
  }
  scene.tweens.add({
    targets: overlay,
    alpha: 0,
    duration: 220,
    onComplete: () => overlay.destroy(),
  });

  const baseX = target.x;
  scene.tweens.add({
    targets: target,
    x: baseX + 7,
    duration: 50,
    yoyo: true,
    repeat: 1,
    onComplete: () => {
      target.x = baseX;
    },
  });
}

/** Brief screen shake. */
export function shakeCamera(scene: Phaser.Scene, intensity?: number): void {
  scene.cameras.main.shake(150, intensity ?? 0.006);
}

/** Expanding ring that fades — reads as a hit/impact pop at (x, y). */
export function impactRing(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  color: number,
): void {
  const ring = scene.add.circle(x, y, 12, color, 0);
  ring.setStrokeStyle(3, color, 0.9);
  layer.add(ring);
  scene.tweens.add({
    targets: ring,
    scale: 2.8,
    alpha: 0,
    duration: 280,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });
}

/** A streak that travels from (fromX,fromY) to (toX,toY) then pops an impact ring,
 *  so an attack visibly connects with its target. */
export function strike(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: number,
): void {
  const dot = scene.add.circle(fromX, fromY, 7, color, 0.95);
  layer.add(dot);
  scene.tweens.add({
    targets: dot,
    x: toX,
    y: toY,
    duration: 170,
    ease: 'Quad.easeIn',
    onComplete: () => {
      dot.destroy();
      impactRing(scene, layer, toX, toY, color);
    },
  });
}

/** A rectangle that shrinks horizontally and fades — the "drained" (or gained)
 *  segment of an HP bar, giving health changes a sense of motion. */
export function fadeRect(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
): void {
  const rect = scene.add.rectangle(x, y, Math.max(2, width), height, color, 0.85);
  layer.add(rect);
  scene.tweens.add({
    targets: rect,
    alpha: 0,
    scaleX: 0.15,
    duration: 380,
    ease: 'Cubic.easeOut',
    onComplete: () => rect.destroy(),
  });
}

/** Centered phase banner that pops in and fades — turn / outcome announcements. */
export function banner(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  text: string,
  color: string,
  options: {
    textureKey?: string;
    width?: number;
    height?: number;
    name?: string;
  } = {},
): void {
  const group = scene.add.container(x, y).setAlpha(0).setScale(0.92);
  if (options.textureKey && scene.textures.exists(options.textureKey)) {
    scene.textures.get(options.textureKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const backing = scene.add.image(0, 0, options.textureKey)
      .setDisplaySize(options.width ?? 520, options.height ?? 150);
    if (options.name) backing.setName(options.name);
    group.add(backing);
  }

  const label = scene.add.text(0, 0, text, {
    fontFamily: 'Georgia, serif',
    fontSize: '34px',
    fontStyle: 'bold',
    color,
    stroke: '#0a0e14',
    strokeThickness: 5,
  });
  label.setOrigin(0.5);
  group.add(label);
  layer.add(group);
  scene.tweens.add({
    targets: group,
    alpha: 1,
    scale: 1,
    duration: 170,
    ease: 'Back.easeOut',
    onComplete: () =>
      scene.tweens.add({
        targets: group,
        alpha: 0,
        delay: 520,
        duration: 320,
        onComplete: () => group.destroy(true),
      }),
  });
}

/** Particle-style burst of small circles fanning outward and fading. */
export function burst(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  color: number,
  count?: number,
): void {
  const total = count ?? 8;
  for (let i = 0; i < total; i += 1) {
    const r = 3 + Math.random();
    const dot = scene.add.circle(x, y, r, color);
    layer.add(dot);
    scene.tweens.add({
      targets: dot,
      x: x + (Math.random() - 0.5) * 100,
      y: y + (Math.random() - 0.5) * 100,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
}
