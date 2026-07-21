import Phaser from 'phaser';

export function advanceSceneTime(scene: Phaser.Scene, requestedMs: number) {
  if (!scene.sys?.settings?.active) return;
  let remaining = Phaser.Math.Clamp(Number.isFinite(requestedMs) ? requestedMs : 0, 0, 120_000);
  const frameMs = 1000 / 60;
  while (remaining > 0) {
    const delta = Math.min(frameMs, remaining);
    scene.time.preUpdate();
    scene.time.update(scene.time.now + delta, delta);
    scene.tweens.prevTime -= delta;
    scene.tweens.tick();
    remaining -= delta;
  }
}

export function advanceGameTime(game: Phaser.Game, requestedMs: number) {
  game.scene.getScenes(true).forEach((scene) => advanceSceneTime(scene, requestedMs));
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
