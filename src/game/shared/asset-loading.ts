import { setTextureFilter } from '../texture-filter';
import Phaser from 'phaser';
import type { RouteNode } from '../types';
import { RUNTIME_IMAGE_LOAD_TIMEOUT_MS, type RuntimeImageAsset, type RuntimeImageLoadResult, queueRuntimeImageAssets } from '../runtime-images';
import { lazyModule } from '../lazy-module';
import { DEFAULT_ROUTE_MAP_BACKDROP_ASSET, loadUiIconAssetsModule, UI_ICON_PREVIEW_SCALE, uiIconAssets, type UiIconId } from '../../art-assets';

export function sceneCanQueueRuntimeAssets(scene: Phaser.Scene): boolean {
  return Boolean(scene.sys?.settings?.active);
}


export class RuntimeLoadTimeoutError extends Error {}


export function withRuntimeLoadTimeout<T>(request: Promise<T>, group: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      reject(new RuntimeLoadTimeoutError(`${group} timed out after ${RUNTIME_IMAGE_LOAD_TIMEOUT_MS}ms`));
    }, RUNTIME_IMAGE_LOAD_TIMEOUT_MS);
    request.then(
      (value) => {
        globalThis.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}


export function runtimeImageLoadSnapshot(
  scene: Phaser.Scene,
  assets: readonly RuntimeImageAsset[],
  timedOut = false,
): RuntimeImageLoadResult {
  const requestedKeys = assets.map((asset) => asset.key);
  const loadedKeys = requestedKeys.filter((key) => scene.textures.exists(key));
  const loaded = new Set(loadedKeys);
  return {
    requestedKeys,
    loadedKeys,
    failedKeys: requestedKeys.filter((key) => !loaded.has(key)),
    timedOut,
  };
}


export function failedModuleLoadResult(group: string, timedOut = false): RuntimeImageLoadResult {
  return {
    requestedKeys: [group],
    loadedKeys: [],
    failedKeys: [group],
    timedOut,
  };
}


export function queueUiIconAssets(
  scene: Phaser.Scene,
  ids: readonly UiIconId[],
  warning: string,
  onComplete?: () => void
) {
  void withRuntimeLoadTimeout(loadUiIconAssetsModule(), warning)
    .then(({ uiIconAssetsFor }) => {
      if (!sceneCanQueueRuntimeAssets(scene)) return;
      queueRuntimeImageAssets(scene, uiIconAssetsFor(ids), warning, onComplete);
    })
    .catch((error) => console.warn(`${warning}:`, error));
}


export function queueRequiredUiIconAssets(
  scene: Phaser.Scene,
  ids: readonly UiIconId[],
  warning: string,
  onReady: (result: RuntimeImageLoadResult) => void
) {
  void withRuntimeLoadTimeout(loadUiIconAssetsModule(), warning)
    .then(({ uiIconAssetsFor }) => {
      if (!sceneCanQueueRuntimeAssets(scene)) return;
      const assets = uiIconAssetsFor(ids);
      const queued = queueRuntimeImageAssets(scene, assets, warning, onReady);
      if (!queued) onReady(runtimeImageLoadSnapshot(scene, assets));
    })
    .catch((error) => {
      console.warn(`${warning}:`, error);
      if (sceneCanQueueRuntimeAssets(scene)) {
        onReady(failedModuleLoadResult(`${warning} module`, error instanceof RuntimeLoadTimeoutError));
      }
    });
}


export function queueTrackedUiIconAssets(
  scene: Phaser.Scene,
  ids: readonly UiIconId[],
  warning: string,
  onComplete: (result: RuntimeImageLoadResult) => void,
) {
  void withRuntimeLoadTimeout(loadUiIconAssetsModule(), warning)
    .then(({ uiIconAssetsFor }) => {
      if (!sceneCanQueueRuntimeAssets(scene)) return;
      const assets = uiIconAssetsFor(ids);
      const queued = queueRuntimeImageAssets(scene, assets, warning, onComplete);
      if (!queued) onComplete(runtimeImageLoadSnapshot(scene, assets));
    })
    .catch((error) => {
      console.warn(`${warning}:`, error);
      if (sceneCanQueueRuntimeAssets(scene)) {
        onComplete(failedModuleLoadResult(`${warning} module`, error instanceof RuntimeLoadTimeoutError));
      }
    });
}


type RouteSceneAssetsModule = typeof import('../route-scene-assets');

const loadRouteSceneAssetsModule = lazyModule(() => import('../route-scene-assets'));


export function queueRouteSceneEventArt(
  scene: Phaser.Scene,
  type: RouteNode['type'],
  warning: string,
  onComplete?: () => void
) {
  void withRuntimeLoadTimeout(loadRouteSceneAssetsModule(), warning)
    .then(({ routeSceneEventArtAssetsFor }) => {
      if (!sceneCanQueueRuntimeAssets(scene)) return;
      queueRuntimeImageAssets(scene, routeSceneEventArtAssetsFor(type), warning, onComplete);
    })
    .catch((error) => console.warn(`${warning}:`, error));
}


export function queueRouteSceneEssentialArt(
  scene: Phaser.Scene,
  mapId: string,
  warning: string,
  onReady: (backdrop: RuntimeImageAsset, result: RuntimeImageLoadResult) => void
) {
  void withRuntimeLoadTimeout(loadRouteSceneAssetsModule(), warning)
    .then(({ routeSceneEssentialArtAssetsFor, routeSceneMapBackdropAsset }) => {
      if (!sceneCanQueueRuntimeAssets(scene)) return;
      const backdrop = routeSceneMapBackdropAsset(mapId);
      const assets = routeSceneEssentialArtAssetsFor(mapId);
      const finish = (result: RuntimeImageLoadResult) => onReady(backdrop, result);
      const queued = queueRuntimeImageAssets(scene, assets, warning, finish);
      if (!queued) finish(runtimeImageLoadSnapshot(scene, assets));
    })
    .catch((error) => {
      console.warn(`${warning}:`, error);
      if (sceneCanQueueRuntimeAssets(scene)) {
        onReady(
          DEFAULT_ROUTE_MAP_BACKDROP_ASSET,
          failedModuleLoadResult(`${warning} module`, error instanceof RuntimeLoadTimeoutError),
        );
      }
    });
}



export function addUiIconImage(scene: Phaser.Scene, iconId: UiIconId, x: number, y: number, size: number) {
  const asset = uiIconAssets[iconId];
  if (!asset || !scene.textures.exists(asset.key)) return undefined;
  setTextureFilter(scene.textures.get(asset.key), Phaser.Textures.FilterMode.LINEAR);
  return scene.add.image(x, y, asset.key).setDisplaySize(size * UI_ICON_PREVIEW_SCALE, size * UI_ICON_PREVIEW_SCALE);
}
