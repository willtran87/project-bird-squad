import type Phaser from 'phaser';

export type RuntimeImageAsset = { key: string; url: string };

const loadingOptionalArtKeys = new Set<string>();
const loadedOptionalArtKeys = new Set<string>();

export function uniqueImageAssets(assets: Array<RuntimeImageAsset | undefined>): RuntimeImageAsset[] {
  return [...new Map(assets.filter((asset): asset is RuntimeImageAsset => Boolean(asset)).map((asset) => [asset.key, asset])).values()];
}

function unloadedImageAssets(scene: Phaser.Scene, assets: Array<RuntimeImageAsset | undefined>): RuntimeImageAsset[] {
  return uniqueImageAssets(assets).filter((asset) => (
    !scene.textures.exists(asset.key)
    && !loadingOptionalArtKeys.has(asset.key)
    && !loadedOptionalArtKeys.has(asset.key)
  ));
}

export function queueRuntimeImageAssets(
  scene: Phaser.Scene,
  assets: Array<RuntimeImageAsset | undefined>,
  warning: string,
  onComplete?: () => void
): boolean {
  const pending = unloadedImageAssets(scene, assets);
  if (pending.length === 0) return false;

  const pendingKeys = new Set(pending.map((asset) => asset.key));
  const onFileComplete = (key: string) => {
    if (!pendingKeys.has(key)) return;
    loadingOptionalArtKeys.delete(key);
    loadedOptionalArtKeys.add(key);
  };
  const onLoadError = (file: { key?: string }) => {
    const key = file.key;
    if (!key || !pendingKeys.has(key)) return;
    loadingOptionalArtKeys.delete(key);
    loadedOptionalArtKeys.delete(key);
    console.warn(`${warning}: ${key}`);
  };
  const cleanup = () => {
    scene.load.off('filecomplete', onFileComplete);
    scene.load.off('loaderror', onLoadError);
  };

  pending.forEach((asset) => {
    loadingOptionalArtKeys.add(asset.key);
    scene.load.image(asset.key, asset.url);
  });
  scene.load.on('filecomplete', onFileComplete);
  scene.load.on('loaderror', onLoadError);
  scene.load.once('complete', () => {
    cleanup();
    pending.forEach((asset) => {
      loadingOptionalArtKeys.delete(asset.key);
      if (scene.textures.exists(asset.key)) loadedOptionalArtKeys.add(asset.key);
    });
    onComplete?.();
  });
  scene.load.start();
  return true;
}
