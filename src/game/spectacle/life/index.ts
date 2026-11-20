import Phaser from 'phaser';
import { arrivalCardState, dressArrivalCard } from './arrival-card';
import { backdropLifeState, dressBackdropLife, lightPose, runLight, runProgress } from './backdrop-life';
import { dressButtons } from './button-fx';
import { eachFrame, redrawWatch, renderPose } from './kit';
import { overlayEntranceState } from './overlay-fx';
import { routeLifeState } from './route-life';
import { staggerLists, type StaggerSpec } from './stagger';
import { dressTransition, installTransitions, lastTransition } from './transitions';

/**
 * The "life" layer: everything that makes the title, the route map and the
 * shared chrome feel alive, loaded after boot and applied from outside. The
 * scenes do not know it exists; with this chunk missing the game is complete.
 */

const LISTS: Record<string, readonly StaggerSpec[]> = {
  MenuScene: [
    { name: 'title-run-action' }, { name: 'title-utility-hit', axis: 'x' },
    { name: 'title-run-mode-option', axis: 'x' }, { name: 'title-leader-choice-backplate', axis: 'x' },
  ],
  RouteScene: [
    { name: 'route-choice-option-frame' }, { name: 'district-contract-card', axis: 'x' },
    { name: 'route-reward-card-frame', axis: 'x' }, { name: 'route-supply-reward-frame', axis: 'x' },
    { name: 'market-listing-frame' },
  ],
};

/** Dress one scene. Returns true when an exit transition is playing into it. */
export function dressLife(scene: Phaser.Scene, arriving: boolean) {
  const key = scene.scene.key;
  if (key === 'BootScene') return false;
  dressButtons(scene);
  const lists = LISTS[key];
  if (lists) {
    const redrawn = redrawWatch(scene);
    const scan = staggerLists(scene, lists);
    eachFrame(scene, () => { if (redrawn()) scan(); });
  }
  if (key === 'MenuScene' || key === 'RouteScene') dressBackdropLife(scene);
  if (key === 'RouteScene') dressArrivalCard(scene);
  return arriving ? dressTransition(scene) : false;
}

/** Grade a battle painting by how far the run has come. */
export function gradeBattlePainting(scene: Phaser.Scene, painting: Phaser.GameObjects.Image) {
  if (painting.getData('life-posed')) return;
  painting.setData('life-posed', true);
  renderPose(painting, () => lightPose(scene, painting.texture.key) ?? {}, 'life');
}

export function installLife(game: Phaser.Game) {
  installTransitions();
  // One read-only window onto the layer for tests and debugging.
  (window as unknown as Record<string, unknown>).__birdSquadLife = (sceneKey: string) => {
    const scene = game.scene.getScene(sceneKey);
    const district = (scene as unknown as { runState?: { mapIndex?: number } }).runState?.mapIndex ?? 0;
    return {
      route: routeLifeState(scene), backdrop: backdropLifeState(scene), arrivalCard: arrivalCardState(scene),
      overlay: overlayEntranceState(scene), transition: lastTransition(),
      light: runLight(runProgress(scene, district)),
    };
  };
}
