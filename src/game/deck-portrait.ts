import Phaser from 'phaser';
import { queueRuntimeImageAssets, type RuntimeImageAsset } from './runtime-images';
import { UI_FONT } from './theme';

/** A reserved, non-interactive slot. Image completion never rebuilds a reader. */
export function renderDeckPortrait(scene: Phaser.Scene, view: {
  artKey?: string; snagBorderKey?: string; portraitAsset?: RuntimeImageAsset; accent: number;
}, x: number, y: number, width: number, height: number, name: string) {
  const slot = scene.add.rectangle(x, y, width, height, 0x141f2f, 1)
    .setStrokeStyle(1, view.accent, 0.5).setName(name);
  let image: Phaser.GameObjects.Image | undefined;
  const label = width >= 100 ? scene.add.text(x, y, 'Loading art', {
    fontFamily: UI_FONT, fontSize: '19px', color: '#a9c6d5', resolution: 2,
    wordWrap: { width: width - 20 }, align: 'center',
  }).setOrigin(0.5).setName(`${name}-status`) : undefined;
  const paint = (failed = false) => {
    if (!slot.active) return;
    const key = [view.portraitAsset?.key, view.artKey, view.snagBorderKey]
      .find(key => key && scene.textures.exists(key));
    if (key) {
      image ??= scene.add.image(x, y, key).setName(`${name}-image`).setAbove(slot);
      image.setTexture(key);
      // Contain even unexpected source dimensions; never stretch a canonical frame.
      image.setScale(Math.min(width / image.width, height / image.height));
    }
    const state = key ? 'ready' : failed || !view.portraitAsset ? 'unavailable' : 'loading';
    slot.setData('artState', state).setData('artKey', key ?? null);
    label?.setText(state === 'unavailable'
      ? `Art unavailable${view.portraitAsset ? '\nReopen to retry' : ''}` : 'Loading art').setVisible(!key);
  };
  paint();
  if (view.portraitAsset) queueRuntimeImageAssets(scene, [view.portraitAsset], 'Deck portrait', result => paint(result.failedKeys.length > 0));
  // The host removes its display list on navigation; no late callback may restore it.
  slot.once('destroy', () => { image?.destroy(); label?.destroy(); });
  return slot;
}
