import { queueRuntimeImageAssets } from '../main';
import { codexLeaderArtAssets } from './leader-portrait-assets';

const pendingPortraitRequests = new WeakMap<object, { generation: number; retry: boolean }>();

/** Setup-only decoration. Never gates input or paints a misleading fallback. */
export function renderSetupPortraits(scene: any) {
  const generation = scene.menuGeneration;
  const current = () => scene.scene.isActive() && scene.menuGeneration === generation;
  const render = () => {
    if (!current()) return;
    for (const panel of scene.leaderPanels) {
      const asset = codexLeaderArtAssets[panel.id];
      const name = `title-leader-portrait-${panel.id}`;
      if (!asset || !scene.textures.exists(asset.key) || scene.children.getByName(name)) continue;
      const image = scene.add.image(panel.rect.x - 72, 310, asset.key).setOrigin(0.5, 1).setName(name);
      image.setScale(Math.min(58 / image.width, 74 / image.height));
      image.setAlpha(panel.unlocked ? 1 : 0.48).setVisible(scene.setupOpen);
      scene.setupObjects.push(image);
    }
  };
  render();
  const pending = pendingPortraitRequests.get(scene);
  if (pending && pending.generation === generation) {
    // Reopening owns one fresh attempt after the previous transfer settles.
    pending.retry = true;
    return;
  }
  const request = { generation, retry: false };
  pendingPortraitRequests.set(scene, request);
  const queued = queueRuntimeImageAssets(scene, Object.values(codexLeaderArtAssets), 'Setup portraits', result => {
    render();
    if (pendingPortraitRequests.get(scene) !== request || result.timedOut) return;
    pendingPortraitRequests.delete(scene);
    if (request.retry && result.failedKeys.length > 0 && scene.setupOpen && current()) renderSetupPortraits(scene);
  });
  if (!queued) pendingPortraitRequests.delete(scene);
}
