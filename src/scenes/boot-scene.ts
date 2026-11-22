import Phaser from 'phaser';
import splashUrl from '../../assets/splash/bird-squad-canal-run-splash-v11-menu-pop.webp';
import titleBirdUrl from '../../assets/ui/bird-squad-title-bird-textured-v2.png';
import titleSquadUrl from '../../assets/ui/bird-squad-title-squad-textured-v2.png';
import routeCommitStreakUrl from '../../assets/runtime/fx/route-commit-streak.webp';
import titleRunLaunchFlourishUrl from '../../assets/runtime/fx/title-run-launch-flourish.webp';
import { queuePreloadImageAssets } from '../game/runtime-images';
import { ROUTE_COMMIT_STREAK_TEXTURE, TITLE_RUN_LAUNCH_FLOURISH_TEXTURE } from '../game/shared/layout-constants';
import { DEFAULT_ROUTE_MAP_BACKDROP_ASSET, titleMenuPreloadAssets } from '../art-assets';
import { uiFontsReady } from '../game/theme';
import { getSpectacleReady } from '../game/shared/spectacle-ready';
import { preloadBattleScene } from './battle-scene-loader';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.image('splash', splashUrl);
    this.load.image(DEFAULT_ROUTE_MAP_BACKDROP_ASSET.key, DEFAULT_ROUTE_MAP_BACKDROP_ASSET.url);
    this.load.image('title-bird', titleBirdUrl);
    this.load.image('title-squad', titleSquadUrl);
    this.load.image(ROUTE_COMMIT_STREAK_TEXTURE, routeCommitStreakUrl);
    this.load.image(TITLE_RUN_LAUNCH_FLOURISH_TEXTURE, titleRunLaunchFlourishUrl);
    queuePreloadImageAssets(this, titleMenuPreloadAssets, 'Title UI');
  }

  create() {
    document.getElementById('boot-shell')?.remove();
    // Fetch combat beside the fonts; the title never waits for it.
    preloadBattleScene(this.game);
    void uiFontsReady(getSpectacleReady()).then(() => this.scene.start('MenuScene'));
  }
}
