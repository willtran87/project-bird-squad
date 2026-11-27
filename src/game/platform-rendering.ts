import type Phaser from 'phaser';
import { installFrameGovernor } from './frame-governor';
import { installRenderResolution } from './render-resolution';

/** Renderer-level platform work, loaded lazily once the game has booted: the
 * device-pixel-ratio backing store and the Auto quality step. */
export function installPlatformRendering(game: Phaser.Game) {
  installRenderResolution(game);
  installFrameGovernor(game);
}
