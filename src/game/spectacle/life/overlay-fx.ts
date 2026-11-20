import type Phaser from 'phaser';
import { clamp01, easeOut, motion, paced, renderPose, wallNow } from './kit';

/**
 * Entrances for the shared system overlays (pause, settings, how to play,
 * confirm). The panel rises and gathers toward the centre while the scrim
 * fades up over the scene. Overlays open while the scene clock is paused, so
 * this runs on wall time; every object is at its final position and alpha from
 * the first frame as far as input, focus and tests are concerned.
 */

interface Session { kind: string; start: number; seen: number }
const sessions = new WeakMap<Phaser.Scene, Session>();

type UiAdd = (object: Phaser.GameObjects.GameObject) => void;
type Placed = Phaser.GameObjects.GameObject & { x: number; y: number; width?: number; height?: number };

/** Wrap an overlay's `addTo` so every object it mounts joins the entrance.
 * A redraw of the same overlay (a toggled setting, a moved focus) continues
 * the entrance already under way instead of replaying it. */
export function overlayEntrance(scene: Phaser.Scene, kind: string, addTo: UiAdd): UiAdd {
  const mode = motion();
  if (mode === 'lean') return addTo;
  const frame = scene.game.loop.frame;
  const previous = sessions.get(scene);
  const session = previous && previous.kind === kind && frame - previous.seen <= 1
    ? previous : { kind, start: wallNow(), seen: frame };
  sessions.set(scene, session);
  const duration = paced(mode === 'reduced' ? 120 : 220);
  const { width, height } = scene.scale.gameSize;
  let first = true;
  return (object) => {
    addTo(object);
    if (first) {
      first = false;
      // The scrim is the overlay's lifecycle owner: note when it is retired.
      object.once('destroy', () => { session.seen = scene.game.loop.frame; });
    }
    if (wallNow() - session.start >= duration) return;
    const placed = object as Placed;
    const covers = (placed.width ?? 0) >= width - 8 && (placed.height ?? 0) >= height - 8;
    renderPose(object, () => {
      const t = (wallNow() - session.start) / duration;
      if (t >= 1) return undefined;
      const eased = easeOut(clamp01(t));
      if (covers || mode === 'reduced') return { alpha: eased };
      const gather = (1 - eased) * 0.04;
      return { alpha: eased, dx: (width / 2 - placed.x) * gather, dy: (1 - eased) * 18 + (height / 2 - placed.y) * gather };
    });
  };
}

export function overlayEntranceState(scene: Phaser.Scene) {
  const session = sessions.get(scene);
  return session ? { kind: session.kind, elapsed: wallNow() - session.start } : undefined;
}
