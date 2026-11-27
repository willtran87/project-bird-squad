import Phaser from 'phaser';
import { autoGraphicsStep, graphicsQualityState, MAX_AUTO_STEP, setAutoGraphicsStep } from './graphics-quality';
import { FrameGovernor } from './frame-rules';

/**
 * Automatic graphics step for the Auto quality preference.
 *
 * Reads the real game loop's raw frame delta. When the mean over a two-second
 * window stays above 25 ms (under 40 fps), Auto steps down once: first to the
 * trimmed tier (one device pixel per game pixel, no fog, splash rings, motes,
 * horizon glow, steam or shader passes), then, if still slow, to Lean. It
 * never steps back up within a session, so the picture cannot oscillate.
 *
 * Ignored: frames over 250 ms (a tab switch, a GC pause or an asset decode),
 * the first three seconds after boot and after any scene starts or stops
 * (loading is not steady play), hidden tabs, and every explicit Full or Lean
 * choice. Automated browsers (`navigator.webdriver`) never step on their own,
 * so the deterministic test clock sees the tier it asked for; `?autoQuality=on`
 * opts back in and the `__birdSquadFrameGovernor.feed` hook drives it directly.
 */

function automationAllowed() {
  if (typeof window === 'undefined') return false;
  const requested = new URLSearchParams(window.location.search).get('autoQuality');
  if (requested === 'off') return false;
  if (requested === 'on') return true;
  return !navigator.webdriver;
}

let governor: FrameGovernor | undefined;

/** Take one step down if Auto still has one to take. */
function stepDown(core: FrameGovernor) {
  const state = graphicsQualityState();
  if (state.preference !== 'auto' || state.tier === 'lean' || autoGraphicsStep() >= MAX_AUTO_STEP) return false;
  setAutoGraphicsStep(state.tier === 'trimmed' ? 2 : 1);
  core.settle();
  return true;
}

export function installFrameGovernor(game: Phaser.Game) {
  if (governor) return;
  const core = governor = new FrameGovernor();
  const enabled = automationAllowed();
  let scenes = '';
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    if (!enabled || document.visibilityState !== 'visible') return;
    const state = graphicsQualityState();
    if (state.preference !== 'auto' || state.tier === 'lean') return;
    const running = game.scene.getScenes(true).map(scene => scene.scene.key).join('|');
    if (running !== scenes) { scenes = running; core.settle(); return; }
    if (core.frame(game.loop.rawDelta)) stepDown(core);
  });
  game.events.on(Phaser.Core.Events.HIDDEN, () => core.settle());
  game.events.on(Phaser.Core.Events.VISIBLE, () => core.settle());

  // Test hook: drive the governor with synthetic frame times.
  (window as unknown as Record<string, unknown>).__birdSquadFrameGovernor = {
    enabled,
    state: () => ({ enabled, ...core.sample, step: autoGraphicsStep(), tier: graphicsQualityState().tier }),
    feed: (deltas: number[], options: { skipGrace?: boolean } = {}) => {
      if (options.skipGrace) core.settle(0);
      let stepped = 0;
      for (const delta of deltas) {
        if (graphicsQualityState().preference !== 'auto') break;
        if (core.frame(delta) && stepDown(core)) {
          stepped += 1;
          if (options.skipGrace) core.settle(0);
        }
      }
      return stepped;
    },
  };
}
