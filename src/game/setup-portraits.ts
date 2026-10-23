import { queueRuntimeImageAssets } from '../main';
import { codexLeaderArtAssets } from './leader-portrait-assets';

/** Setup-only decoration. Never gates input or paints a misleading fallback. */
export function renderSetupPortraits(scene: any) {
  const generation = scene.menuGeneration;
  const render = () => {
    if (!scene.scene.isActive() || scene.menuGeneration !== generation) return;
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
  queueRuntimeImageAssets(scene, Object.values(codexLeaderArtAssets), 'Setup portraits', render);
}
