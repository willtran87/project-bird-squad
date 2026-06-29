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

function queueImageAssets(
  scene: Phaser.Scene,
  assets: Array<RuntimeImageAsset | undefined>,
  warning: string,
  startNow: boolean,
  onComplete?: () => void,
): boolean {
  const pending = unloadedImageAssets(scene, assets);
  if (pending.length === 0) return false;

  const pendingKeys = new Set(pending.map((asset) => asset.key));
  let settled = false;
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
    scene.load.off('complete', onLoaderComplete);
    scene.events.off('shutdown', onSceneEnd);
    scene.events.off('destroy', onSceneEnd);
  };
  const markResolvedTextures = () => {
    pending.forEach((asset) => {
      loadingOptionalArtKeys.delete(asset.key);
      if (scene.textures.exists(asset.key)) loadedOptionalArtKeys.add(asset.key);
    });
  };
  const onLoaderComplete = () => {
    if (settled) return;
    settled = true;
    cleanup();
    markResolvedTextures();
    onComplete?.();
  };
  const onSceneEnd = () => {
    if (settled) return;
    settled = true;
    cleanup();
    markResolvedTextures();
  };

  pending.forEach((asset) => {
    loadingOptionalArtKeys.add(asset.key);
    scene.load.image(asset.key, asset.url);
  });
  scene.load.on('filecomplete', onFileComplete);
  scene.load.on('loaderror', onLoadError);
  scene.load.once('complete', onLoaderComplete);
  scene.events.once('shutdown', onSceneEnd);
  scene.events.once('destroy', onSceneEnd);
  if (startNow) scene.load.start();
  return true;
}

export function queueRuntimeImageAssets(
  scene: Phaser.Scene,
  assets: Array<RuntimeImageAsset | undefined>,
  warning: string,
  onComplete?: () => void
): boolean {
  return queueImageAssets(scene, assets, warning, true, onComplete);
}

export function queuePreloadImageAssets(
  scene: Phaser.Scene,
  assets: Array<RuntimeImageAsset | undefined>,
  warning: string
): boolean {
  return queueImageAssets(scene, assets, warning, false);
}
