import type Phaser from 'phaser';
import { installFrameGovernor } from './frame-governor';
import { installRenderResolution } from './render-resolution';
import { installShapeBatching } from './shape-batching';

/** Renderer-level platform work, loaded lazily once the game has booted: the
 * device-pixel-ratio backing store, shape batching (with the multi-texture
 * lookup fix) and the Auto quality step. */
export function installPlatformRendering(game: Phaser.Game) {
  installRenderResolution(game);
  installShapeBatching(game);
  installFrameGovernor(game);
}
