import Phaser from 'phaser';
import { lazyModule } from '../game/lazy-module';
import { LAZY_LOAD_FAILED } from '../game/shared/session-config';
import { GAME_HEIGHT, GAME_WIDTH } from '../game/shared/layout-constants';
import { UI_FONT } from '../game/theme';

/**
 * BattleScene is ~240 KB of minified code, so it lives in its own chunk.
 *
 * The boot config registers this tiny stand-in under the real key. As soon as
 * the battle chunk arrives (requested by the boot scene, beside the fonts), the
 * stand-in is swapped for the real class in the same Scene Manager slot, so
 * every later `scene.start('BattleScene')` — from the route, the title, or a
 * test calling the manager directly — reaches the real scene synchronously.
 * If a start does win the race, the stand-in holds the requested data, shows a
 * short loading card, and hands the data to the real scene once it lands.
 */
export const BATTLE_SCENE_KEY = 'BattleScene';

type BattleSceneModule = typeof import('./battle-scene');

export const loadBattleSceneModule = lazyModule(() => import('./battle-scene'));

export function isBattleSceneLoader(scene: Phaser.Scene | null | undefined): scene is BattleSceneLoader {
  return scene instanceof BattleSceneLoader;
}

/** Replace the stand-in with the real BattleScene, keeping its render order.
 *  Returns true once the registered BattleScene is the real one. */
function swapInRealBattleScene(game: Phaser.Game, module: BattleSceneModule): boolean {
  const manager = game.scene;
  const current = manager.getScene(BATTLE_SCENE_KEY);
  if (current instanceof module.BattleScene) return true;
  if (!(current instanceof BattleSceneLoader)) return false;
  // Never mutate the scene list mid-step; the caller retries from a later tick.
  if ((manager as unknown as { isProcessing: boolean }).isProcessing) return false;
  const status = current.sys.settings.status;
  const running = status >= Phaser.Scenes.START && status <= Phaser.Scenes.SLEEPING;
  const data = current.requestedData;
  const index = manager.scenes.indexOf(current);
  manager.remove(BATTLE_SCENE_KEY);
  if (manager.getScene(BATTLE_SCENE_KEY)) return false;
  manager.add(BATTLE_SCENE_KEY, module.BattleScene, false);
  const added = manager.getScene(BATTLE_SCENE_KEY);
  if (added && index >= 0) {
    const list = manager.scenes;
    const at = list.indexOf(added);
    if (at >= 0 && at !== index) {
      list.splice(at, 1);
      list.splice(Math.min(index, list.length), 0, added);
    }
  }
  if (running) manager.start(BATTLE_SCENE_KEY, data);
  return true;
}

/** Load the battle chunk and install it. Resolves true when the registered
 *  BattleScene is the real implementation. Safe to call repeatedly. */
export async function ensureBattleScene(game: Phaser.Game): Promise<boolean> {
  const module = await loadBattleSceneModule();
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (swapInRealBattleScene(game, module)) return true;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return false;
}

/** Fire-and-forget preload used by boot. Failures surface only if combat is
 *  actually started (the stand-in then offers a retry). */
export function preloadBattleScene(game: Phaser.Game) {
  void ensureBattleScene(game).catch(() => undefined);
}

export class BattleSceneLoader extends Phaser.Scene {
  requestedData: object | undefined;
  private status?: Phaser.GameObjects.Text;
  private failed = false;

  constructor() {
    super(BATTLE_SCENE_KEY);
  }

  init(data: object | undefined) {
    this.requestedData = data;
    this.failed = false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#08101d');
    this.status = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Taking flight…', {
      fontFamily: UI_FONT,
      fontSize: '28px',
      color: '#d7e6f5',
      align: 'center',
    }).setOrigin(0.5);
    // Whole screen is the retry target after a failure: comfortably touchable.
    this.add.zone(0, 0, GAME_WIDTH, GAME_HEIGHT).setOrigin(0).setName('battle-loader-retry')
      .setInteractive().on('pointerup', () => { if (this.failed) this.requestBattle(); });
    this.input.keyboard?.on('keydown', () => { if (this.failed) this.requestBattle(); });
    this.requestBattle();
  }

  private requestBattle() {
    this.failed = false;
    this.status?.setText('Taking flight…');
    window.render_game_to_text = () => JSON.stringify({ scene: 'BattleSceneLoader', mode: 'battleLoading' });
    const game = this.game;
    void ensureBattleScene(game).catch((error) => {
      console.warn('BattleScene:', error);
      if (!this.sys.isActive()) return;
      this.failed = true;
      this.status?.setText('Combat could not load.\nCheck your connection, then tap or press any key to retry.');
      window.render_game_to_text = () => JSON.stringify({ scene: 'BattleSceneLoader', mode: 'battleLoadFailed', error: LAZY_LOAD_FAILED });
    });
  }
}
