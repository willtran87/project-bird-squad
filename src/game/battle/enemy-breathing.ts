import type Phaser from 'phaser';

/** Reserve HUD clearance for the entire breathing envelope, not just its rest pose. */
export function addEnemyBreathing(
  scene: Phaser.Scene, group: Phaser.GameObjects.Container, seed: number, scale: number,
  textureBounds: (key: string) => { top: number },
) {
  const lift = (3.5 + seed % 3) * scale;
  const stretch = 0.024 + (seed % 3) * 0.003;
  const pose = group.list[0] as Phaser.GameObjects.Container;
  const portrait = pose?.getByName('combat-enemy-portrait') as Phaser.GameObjects.Image | undefined;
  let strength = 1;
  if (portrait) {
    const box = portrait.getBounds();
    const top = box.top + box.height * textureBounds(portrait.texture.key).top;
    const rise = lift + Math.max(0, group.y - top) * stretch;
    // Two pixels of margin also keep floating-point bounds clear of the 106px HUD edge.
    strength = Math.min(1, Math.max(0, top - 108) / Math.max(0.001, rise));
  }
  scene.tweens.add({
    targets: group, y: group.y - lift * strength,
    scaleX: 0.992 - (seed % 2) * 0.002, scaleY: 1 + stretch * strength,
    duration: 1500 + seed % 420, delay: seed % 420,
    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });
}
