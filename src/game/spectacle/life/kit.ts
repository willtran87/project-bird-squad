import Phaser from 'phaser';

import { prefersLeanEffects } from '../../graphics-quality';
import { animationPaceTimeScale, prefersReducedMotion } from '../../shared/preferences';

/**
 * Shared plumbing for the presentation-only "life" layer.
 *
 * Two rules keep this layer invisible to game logic and to the tests that read
 * geometry between frames:
 *  - Entrances never tween an object's real position or alpha. `renderPose`
 *    offsets an object only for the duration of its own draw call, the same
 *    save/modify/restore trick Phaser's container renderer uses for children.
 *  - Anything that must survive the scenes' destroy-and-redraw rendering is a
 *    pure function of a clock, rebuilt on demand, never a tween.
 */

export type Motion = 'full' | 'reduced' | 'lean';

/** Lean graphics outranks Reduced Motion: it removes the dressing entirely. */
export function motion(): Motion {
  return prefersLeanEffects() ? 'lean' : prefersReducedMotion() ? 'reduced' : 'full';
}

/** Scale an authored duration by the player's Animation Pace. */
export const paced = (ms: number) => ms / animationPaceTimeScale();

export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

const watches = new WeakMap<Phaser.Scene, Phaser.Time.TimerEvent>();

/** Milliseconds on the scene clock since the scene started. Stops while the
 * scene clock is paused and advances under the deterministic `advanceTime`
 * hook, unlike `scene.time.now`, which follows the wall clock. */
export function sceneNow(scene: Phaser.Scene) {
  let watch = watches.get(scene);
  if (!watch) {
    watch = scene.time.addEvent({ delay: Number.MAX_SAFE_INTEGER });
    watches.set(scene, watch);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => watches.delete(scene));
  }
  return watch.elapsed;
}

/** Wall time, for overlays shown while the scene clock is paused. */
export const wallNow = () => performance.now();

export interface Pose {
  dx?: number; dy?: number; alpha?: number; scale?: number;
  /** Horizontal scale only, for a card turning over. */
  sx?: number;
  /** Multiply tint per corner: top-left, top-right, bottom-left, bottom-right. */
  tint?: readonly [number, number, number, number];
}
type Posable = Phaser.GameObjects.GameObject & {
  x: number; y: number; alpha?: number; scaleX?: number; scaleY?: number;
  tintTopLeft?: number; tintTopRight?: number; tintBottomLeft?: number; tintBottomRight?: number;
};
const POSE = Symbol('life-pose');
type Sampler = () => Pose | undefined;
type Channels = Map<string, Sampler>;

/** Merge every live channel; drop the ones that have finished. */
function samplePose(channels: Channels): Pose | undefined {
  let pose: Pose | undefined;
  for (const [channel, sampler] of channels) {
    const next = sampler();
    if (!next) { channels.delete(channel); continue; }
    pose = pose ? {
      dx: (pose.dx ?? 0) + (next.dx ?? 0), dy: (pose.dy ?? 0) + (next.dy ?? 0),
      alpha: (pose.alpha ?? 1) * (next.alpha ?? 1), scale: (pose.scale ?? 1) * (next.scale ?? 1),
      sx: (pose.sx ?? 1) * (next.sx ?? 1), tint: next.tint ?? pose.tint,
    } : next;
  }
  return pose;
}

/** Draw `object` with a temporary offset while `sampler` returns a pose. The
 * object's logical state is restored before the draw call returns, so bounds,
 * hit areas and anything a test reads are always the settled values. Channels
 * are independent, so an entrance and a press can overlap. */
export function renderPose(object: Phaser.GameObjects.GameObject, sampler: Sampler, channel = 'enter') {
  const target = object as Posable & { [POSE]?: Channels } & Record<string, unknown>;
  const installed = target[POSE];
  if (installed) { installed.set(channel, sampler); return; }
  const channels: Channels = new Map([[channel, sampler]]);
  target[POSE] = channels;
  for (const method of ['renderWebGLStep', 'renderCanvas'] as const) {
    const base = target[method] as ((...args: unknown[]) => unknown) | undefined;
    if (typeof base !== 'function') continue;
    target[method] = function (this: unknown, ...args: unknown[]) {
      const pose = samplePose(channels);
      if (!pose) {
        if (!channels.size) {
          target[POSE] = undefined;
          delete (target as Record<string, unknown>).renderWebGLStep;
          delete (target as Record<string, unknown>).renderCanvas;
        }
        return base.apply(this, args);
      }
      const { x, y, alpha, scaleX, scaleY } = target;
      const tints = pose.tint && target.tintTopLeft !== undefined
        ? [target.tintTopLeft, target.tintTopRight, target.tintBottomLeft, target.tintBottomRight] as number[] : undefined;
      target.x = x + (pose.dx ?? 0);
      target.y = y + (pose.dy ?? 0);
      const fade = pose.alpha !== undefined && typeof alpha === 'number';
      if (fade) target.alpha = alpha! * pose.alpha!;
      const grow = (pose.scale !== undefined || pose.sx !== undefined) && typeof scaleX === 'number' && typeof scaleY === 'number';
      if (grow) { target.scaleX = scaleX! * (pose.scale ?? 1) * (pose.sx ?? 1); target.scaleY = scaleY! * (pose.scale ?? 1); }
      if (tints) [target.tintTopLeft, target.tintTopRight, target.tintBottomLeft, target.tintBottomRight] = pose.tint!;
      try {
        return base.apply(this, args);
      } finally {
        target.x = x;
        target.y = y;
        if (fade) target.alpha = alpha;
        if (grow) { target.scaleX = scaleX; target.scaleY = scaleY; }
        if (tints) [target.tintTopLeft, target.tintTopRight, target.tintBottomLeft, target.tintBottomRight] = tints;
      }
    };
  }
}

/** The pose `object` would be drawn with right now, without drawing it. */
export function currentPose(object: Phaser.GameObjects.GameObject) {
  const channels = (object as unknown as { [POSE]?: Channels })[POSE];
  return channels ? samplePose(channels) : undefined;
}

/** Run `sync` just before each render of `scene`, until the scene shuts down. */
export function eachFrame(scene: Phaser.Scene, sync: () => void, shutdown?: () => void) {
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, sync);
    shutdown?.();
  });
}

/** True once after any object joins the scene; the destroy-and-redraw scenes
 * rebuild everything at once, so this is the cue to re-adopt their objects. */
export function redrawWatch(scene: Phaser.Scene) {
  let dirty = true;
  const mark = () => { dirty = true; };
  scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, mark);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, mark));
  return () => { const was = dirty; dirty = false; return was; };
}

/** Deterministic 0..1 value from an integer seed. */
export function hash01(seed: number) {
  let value = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

const BIRD = 'life-bird';

/** A small gliding bird silhouette, drawn once: a shallow double-arc "M". */
export function birdTexture(scene: Phaser.Scene) {
  if (!scene.textures.exists(BIRD)) {
    const canvas = scene.textures.createCanvas(BIRD, 40, 20);
    const context = canvas?.getContext();
    if (canvas && context) {
      context.strokeStyle = '#ffffff';
      context.lineWidth = 3;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(3, 12);
      context.quadraticCurveTo(11, 1, 20, 12);
      context.quadraticCurveTo(29, 1, 37, 12);
      context.stroke();
      canvas.refresh();
    }
  }
  return BIRD;
}
