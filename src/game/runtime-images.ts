import type Phaser from 'phaser';

export type RuntimeImageAsset = { key: string; url: string };

export type RuntimeImageLoadResult = {
  requestedKeys: string[];
  loadedKeys: string[];
  failedKeys: string[];
  timedOut: boolean;
};

export const RUNTIME_IMAGE_LOAD_TIMEOUT_MS = 8_000;

const sceneLoadingAssetKeys = new WeakMap<Phaser.Scene, Set<string>>();

function loadingKeysForScene(scene: Phaser.Scene): Set<string> {
  let keys = sceneLoadingAssetKeys.get(scene);
  if (!keys) {
    keys = new Set<string>();
    sceneLoadingAssetKeys.set(scene, keys);
  }
  return keys;
}

export function uniqueImageAssets(assets: Array<RuntimeImageAsset | undefined>): RuntimeImageAsset[] {
  return [...new Map(assets.filter((asset): asset is RuntimeImageAsset => Boolean(asset)).map((asset) => [asset.key, asset])).values()];
}

function missingImageAssets(scene: Phaser.Scene, assets: Array<RuntimeImageAsset | undefined>): RuntimeImageAsset[] {
  return uniqueImageAssets(assets).filter((asset) => !scene.textures.exists(asset.key));
}

function waitForImageAssets(
  scene: Phaser.Scene,
  keys: string[],
  onComplete?: (result: RuntimeImageLoadResult) => void,
  timeoutMs = RUNTIME_IMAGE_LOAD_TIMEOUT_MS,
) {
  if (!onComplete) return;

  const loadingKeys = loadingKeysForScene(scene);
  const startedAt = performance.now();
  let settled = false;
  const result = (timedOut: boolean): RuntimeImageLoadResult => {
    const loadedKeys = keys.filter((key) => scene.textures.exists(key));
    const loaded = new Set(loadedKeys);
    return {
      requestedKeys: [...keys],
      loadedKeys,
      failedKeys: keys.filter((key) => !loaded.has(key)),
      timedOut,
    };
  };
  const check = () => {
    if (settled || !scene.sys.settings.active) return;
    const timedOut = performance.now() - startedAt >= timeoutMs;
    if (!timedOut && !keys.every((key) => scene.textures.exists(key) || !loadingKeys.has(key))) {
      scene.time.delayedCall(50, check);
      return;
    }
    settled = true;
    onComplete(result(timedOut));
  };

  check();
}

function queueImageAssets(
  scene: Phaser.Scene,
  assets: Array<RuntimeImageAsset | undefined>,
  warning: string,
  startNow: boolean,
  onComplete?: (result: RuntimeImageLoadResult) => void,
): boolean {
  const missing = missingImageAssets(scene, assets);
  if (missing.length === 0) return false;

  const loadingKeys = loadingKeysForScene(scene);
  const pending = missing.filter((asset) => !loadingKeys.has(asset.key));
  if (pending.length === 0) {
    waitForImageAssets(scene, missing.map((asset) => asset.key), onComplete);
    return true;
  }

  const pendingKeys = new Set(pending.map((asset) => asset.key));
  let settled = false;
  const onFileComplete = (key: string) => {
    if (!pendingKeys.has(key)) return;
    loadingKeys.delete(key);
  };
  const onLoadError = (file: { key?: string }) => {
    const key = file.key;
    if (!key || !pendingKeys.has(key)) return;
    loadingKeys.delete(key);
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
      loadingKeys.delete(asset.key);
    });
  };
  const onLoaderComplete = () => {
    if (settled) return;
    settled = true;
    cleanup();
    markResolvedTextures();
  };
  const onSceneEnd = () => {
    if (settled) return;
    settled = true;
    cleanup();
    markResolvedTextures();
  };

  pending.forEach((asset) => {
    loadingKeys.add(asset.key);
    scene.load.image(asset.key, asset.url);
  });
  waitForImageAssets(scene, missing.map((asset) => asset.key), onComplete);
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
  onComplete?: (result: RuntimeImageLoadResult) => void
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
