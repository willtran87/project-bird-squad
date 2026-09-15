import Phaser from 'phaser';

export function advanceGameTime(game: Phaser.Game, requestedMs: number) {
  game.scene.getScenes(true).forEach((scene) => {
    if (!scene.sys.isActive()) return;
    let remaining = Phaser.Math.Clamp(Number.isFinite(requestedMs) ? requestedMs : 0, 0, 120_000);
    const clock = scene.time;
    const tweens = scene.tweens;
    const getDelta = tweens.getDelta;
    let delta = 0;
    // Phaser measures wall time here. Supply each manual frame's delta without
    // replacing its tween processing, scaling or cleanup, then restore the clock.
    tweens.getDelta = () => delta;
    try {
      while (remaining > 0) {
        delta = Math.min(1000 / 60, remaining);
        clock.preUpdate();
        clock.update(clock.now + delta, delta);
        if (!tweens.paused) tweens.tick();
        remaining -= delta;
      }
    } finally { tweens.getDelta = getDelta; }
  });
}

export function countTextureInGameObjects(children: any[], textureKey: string): number {
  return children.reduce((sum, child) => {
    const self = child?.texture?.key === textureKey ? 1 : 0;
    const nested = Array.isArray(child?.list) ? countTextureInGameObjects(child.list, textureKey) : 0;
    return sum + self + nested;
  }, 0);
}

export function loadedTextureState(scene: Phaser.Scene, textureKey: string, count: number) {
  return { loaded: scene.textures.exists(textureKey), rendered: count > 0, count };
}

export function countVisibleTextureInGameObjects(children: any[], textureKey: string): number {
  return children.reduce((sum, child) => {
    const alpha = typeof child?.alpha === 'number' ? child.alpha : 1;
    const self = child?.texture?.key === textureKey && child?.visible !== false && alpha > 0.01 ? 1 : 0;
    const nested = Array.isArray(child?.list) ? countVisibleTextureInGameObjects(child.list, textureKey) : 0;
    return sum + self + nested;
  }, 0);
}

export function setDisplayTreeDepth(root: Phaser.GameObjects.GameObject, baseDepth: number) {
  const visit = (obj: Phaser.GameObjects.GameObject, depth: number) => {
    (obj as Phaser.GameObjects.GameObject & { setDepth: (value: number) => Phaser.GameObjects.GameObject }).setDepth(depth);
    const children = (obj as Phaser.GameObjects.Container).list;
    if (!Array.isArray(children)) return;
    children.forEach((child, index) => visit(child, depth + index + 1));
  };
  visit(root, baseDepth);
  return root;
}

export function killTweensForTree(scene: Phaser.Scene, obj?: Phaser.GameObjects.GameObject) {
  if (!obj) return;
  scene.tweens.killTweensOf(obj);
  if (obj.type !== 'Container') return;
  const children = [...(obj as Phaser.GameObjects.Container).list];
  children.forEach((child) => killTweensForTree(scene, child));
}

export function killTweensForScene(scene: Phaser.Scene) {
  scene.children.list.forEach((child) => killTweensForTree(scene, child));
}
