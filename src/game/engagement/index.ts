import type Phaser from 'phaser';
import { flockLeaders, getLeader } from '../leaders';
import { quietButton } from '../quiet-ui';
import { safeStorageGet } from '../safe-storage';
import { loadRunHistory } from '../shared/run-state';
import type { MenuFocus } from '../shared/runtime-types';
import { playUiSound } from '../shared/ui-helpers';
import { CeremonyScene, pendingReveals } from './ceremony-scene';
import { dailyBestFor, dailyDateKey, dailyLeaderId, dailySeed } from './daily-flight';
import { DailyFlightScene } from './daily-flight-scene';
import { RECAP_SEEN_KEY, RecapScene, type RecapSceneData } from './recap-scene';
import { C, enter, label, readCeremonyQueue, syncDaily, thousands } from './ui';

/**
 * Engagement outside combat: Daily Flight, the run recap and photo card, and
 * the Collection ceremony. One lazy chunk; the title asks for it after it has
 * drawn itself, and is complete without it.
 */

const registered = new WeakSet<Phaser.Game>();

export function registerEngagementScenes(game: Phaser.Game) {
  if (registered.has(game)) return;
  registered.add(game);
  game.scene.add('DailyFlightScene', DailyFlightScene, false);
  game.scene.add('RecapScene', RecapScene, false);
  game.scene.add('CeremonyScene', CeremonyScene, false);
  // Read-only windows for tests and debugging.
  const hooks = window as unknown as Record<string, unknown>;
  hooks.__birdSquadCeremony = () => {
    const scene = game.scene.getScene('CeremonyScene') as CeremonyScene;
    return scene.sys.isActive() ? scene.state() : { active: false, queue: readCeremonyQueue() };
  };
}

/** Open the recap for a flight in the flight log (the latest by default). */
export function openRunRecap(scene: Phaser.Scene, data: RecapSceneData = {}) {
  registerEngagementScenes(scene.game);
  scene.scene.start('RecapScene', data);
}

/** Show any waiting reveals above `host`. Returns true when one is showing. */
export function presentCeremony(host: Phaser.Scene) {
  registerEngagementScenes(host.game);
  if (!host.sys.isActive() || host.game.scene.isActive('CeremonyScene') || !pendingReveals().length) return false;
  host.scene.launch('CeremonyScene', { hostKey: host.scene.key });
  return true;
}

interface TitleScene extends Phaser.Scene {
  setupOpen: boolean;
  settingsOverlay?: unknown;
  helpOverlay?: unknown;
  titleRunLaunchPending: boolean;
  menuFocus: MenuFocus;
  menuFocusTargets: Map<MenuFocus, Phaser.GameObjects.Rectangle>;
  menuExtraFocus: MenuFocus[];
  updateMenuFocusRing(): void;
  updateMenuTextState(): void;
}

/** Add Daily Flight and Flight Recap to the title's quiet bottom row, then
 * play any waiting reveals. Called once per title visit. */
export function installMenuEngagement(raw: Phaser.Scene) {
  const menu = raw as TitleScene;
  registerEngagementScenes(menu.game);
  const history = loadRunHistory();
  const store = syncDaily(history);
  const date = dailyDateKey();
  const leader = getLeader(dailyLeaderId(dailySeed(date), flockLeaders.map((entry) => entry.id)));
  const best = dailyBestFor(store, date);
  const latest = history[history.length - 1];
  const recapNew = Boolean(latest) && safeStorageGet(RECAP_SEEN_KEY) !== latest.id;
  const made: Array<Phaser.GameObjects.GameObject & { setVisible(value: boolean): unknown }> = [];

  const add = (focus: MenuFocus, x: number, text: string, open: () => void) => {
    const hit = quietButton(menu, { x, y: 662, width: 164, label: text, name: 'title-engagement-hit', kind: 'utility',
      onActivate: () => {
        if (menu.settingsOverlay || menu.helpOverlay || menu.titleRunLaunchPending || menu.setupOpen) return;
        menu.menuFocus = focus;
        playUiSound('confirm');
        open();
      },
    }).setData('label', text).setData('focus', focus);
    menu.menuFocusTargets.set(focus, hit);
    menu.menuExtraFocus.push(focus);
    made.push(hit, hit.getData('labelObject'));
    return hit;
  };

  add('daily', 776, 'Daily Flight', () => menu.scene.start('DailyFlightScene'));
  const caption = best ? `Today: ${leader.name} · Best ${thousands(best.score)}` : `Today: ${leader.name}`;
  made.push(label(menu, 776, 620, caption, 20, C.soft).setOrigin(0.5).setName('title-daily-caption'));
  if (latest) {
    add('recap', 588, 'Flight Recap', () => menu.scene.start('RecapScene', {}));
    if (recapNew) made.push(menu.add.circle(588 + 70, 662 - 17, 5, 0xe8b830).setName('title-recap-new'));
  }

  const sync = () => made.forEach((object) => {
    object.setVisible(!menu.setupOpen);
    if (object.input) object.input.enabled = !menu.setupOpen;
  });
  menu.events.on('title-layout', sync);
  menu.events.once('shutdown', () => menu.events.off('title-layout', sync));
  sync();
  enter(menu, made, 0, 10);
  menu.updateMenuTextState();

  (window as unknown as Record<string, unknown>).__birdSquadEngagement = () => ({
    date, seed: dailySeed(date), dailyLeader: leader.id, dailyBest: dailyBestFor(syncDaily(), date) ?? null,
    caption, recapAvailable: Boolean(latest), recapNew, focusOrder: [...menu.menuExtraFocus],
    ceremonyQueue: readCeremonyQueue(),
  });
  presentCeremony(menu);
}
