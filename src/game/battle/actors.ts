import Phaser from 'phaser';
import { currentFlashEffectsState, currentScreenShakeState, prefersReducedMotion } from '../../main';
import { animationPaceTimeScale } from '../shared/preferences';

/**
 * Retained battle actors.
 *
 * An actor is one combatant or hand card that outlives the immediate-mode
 * redraw. It has two separate halves:
 *
 * - the LOGICAL slot: where layout put it. Hit areas, forecasts, tests and
 *   every `getBounds()` contract read this. Animation never writes it.
 * - the VISUAL pose: an offset, scale, tilt and flash layered on top of the
 *   slot by this stage. Nothing but presentation reads it.
 *
 * Enemy and flock bodies apply the pose to their retained container. Hand
 * cards apply it in the render pass only (see `attachCardBody`), so a card's
 * objects keep their logical transforms at all times.
 *
 * The stage owns one animation clock. It follows scene time (so the manual
 * `advanceTime` test clock drives it), scales with Animation Pace, stops for
 * Reduced Motion and can be frozen for a hit-stop without touching game logic.
 */

export interface ActorPose {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  flash: number;
}

type Ease = (t: number) => number;
const linear: Ease = t => t;
const quadOut: Ease = t => t * (2 - t);
const cubicIn: Ease = t => t * t * t;
const cubicOut: Ease = t => 1 - (1 - t) ** 3;
const sineInOut: Ease = t => 0.5 - 0.5 * Math.cos(Math.PI * t);
const backOut: Ease = t => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

/** [duration ms, x, y, scaleX delta, scaleY delta, angle°, ease]. Each key
 * eases from the previous key; a motion starts from zero. */
export type MotionKey = [number, number, number, number, number, number, Ease?];

export interface ActorMotion {
  name: string;
  /** `action` motions replace each other; `react` motions layer on top. */
  channel: 'action' | 'react';
  keys: MotionKey[];
  /** Keep the last key until another motion on this channel replaces it. */
  hold?: boolean;
  /** Peak tint flash, 0–1. Follows Flash Effects. */
  flash?: number;
  /** Decaying judder in pixels. Follows Screen Shake. */
  shake?: number;
}

interface RunningMotion { motion: ActorMotion; start: number; total: number }
interface Offsets { x: number; y: number; scale: number; angle: number }
export interface ActorBreath { lift: number; squeeze: number; stretch: number; period: number; delay: number }
export interface ActorTint { image: Phaser.GameObjects.Image; from: number; to: number }

export interface BattleActor {
  id: string;
  kind: 'enemy' | 'flock' | 'card';
  /** Logical layout position. */
  slot: { x: number; y: number };
  /** Art scale, so motion distances match the body's size. */
  scale: number;
  /** Persistent visual target (fan, hover lift). */
  rest: Offsets;
  /** Smoothed approach to `rest`; also carries slide offsets. */
  settle: Offsets;
  motions: RunningMotion[];
  /** What a replaced action was still showing; it eases out instead of snapping. */
  carry: ActorPose;
  breath?: ActorBreath;
  tint?: ActorTint;
  node?: Phaser.GameObjects.Container;
  /** Returns false once the actor's objects have left play. */
  alive?: () => boolean;
  /** Composite visual pose, relative to the slot. */
  pose: ActorPose;
  shownFlash: number;
}

/** A hit is heavy when it removes at least this share of the target's maximum. */
export const HEAVY_HIT_SHARE = 0.2;
export function heavyHit(damage: number, maxHp: number) {
  return damage > 0 && damage / Math.max(1, maxHp) >= HEAVY_HIT_SHARE;
}

const SETTLE_MS = 70;
const CARRY_MS = 70;
const FRAME_MS = 1000 / 60;
const FAN_TILT = 0.8;
const FAN_DROP = 1.4;
const zero = (): Offsets => ({ x: 0, y: 0, scale: 1, angle: 0 });
const identity = (): ActorPose => ({ x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, flash: 0 });
const none = (): ActorPose => ({ x: 0, y: 0, scaleX: 0, scaleY: 0, angle: 0, flash: 0 });

function mixColor(from: number, to: number, t: number) {
  const channel = (shift: number) => Math.round(((from >> shift) & 255) + (((to >> shift) & 255) - ((from >> shift) & 255)) * t) << shift;
  return channel(16) | channel(8) | channel(0);
}

type Host = Phaser.Scene & Record<string, any>;

export class BattleActorStage {
  readonly actors = new Map<string, BattleActor>();
  /** Hand order, hover and selection drive the fan. */
  readonly hand: { order: string[]; hovered?: string; selected?: string } = { order: [] };
  /** Animation clock in milliseconds. */
  time = 0;
  hitStops = 0;
  lastHitStopFrames = 0;
  private last: number;
  private frozenUntil = 0;
  private scene: Host;

  constructor(scene: Phaser.Scene) {
    this.scene = scene as Host;
    this.last = scene.time.now;
    const events = scene.events;
    const tick = () => this.tick();
    const enemyCue = (id: string, cue: string, detail?: number) => this.enemyCue(id, cue, detail);
    const flockCue = (cue: string, detail?: number) => this.flockCue(cue, detail);
    const cast = (budget: number, style?: string, enemyId?: string) => this.flockCast(budget, style, enemyId);
    events.on('postupdate', tick);
    events.on('clock-advanced', tick);
    events.on('living-enemy-cue', enemyCue);
    events.on('living-flock-cue', flockCue);
    events.on('living-cast', cast);
    events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      events.off('postupdate', tick);
      events.off('clock-advanced', tick);
      events.off('living-enemy-cue', enemyCue);
      events.off('living-flock-cue', flockCue);
      events.off('living-cast', cast);
      this.actors.clear();
      if (this.scene.battleActors === this) delete this.scene.battleActors;
    });
  }

  private get still() { return prefersReducedMotion(); }

  /** Create an actor, or move an existing one to a new logical slot. The body
   * slides from where it was drawn instead of popping. */
  ensure(id: string, kind: BattleActor['kind'], x: number, y: number, scale = 1): BattleActor {
    let actor = this.actors.get(id);
    if (!actor) {
      actor = { id, kind, slot: { x, y }, scale, rest: zero(), settle: zero(), motions: [], carry: none(), pose: identity(), shownFlash: 0 };
      this.actors.set(id, actor);
      return actor;
    }
    if (!this.still) {
      actor.settle.x += actor.slot.x - x;
      actor.settle.y += actor.slot.y - y;
    }
    actor.slot.x = x;
    actor.slot.y = y;
    actor.scale = scale;
    return actor;
  }

  /** Bind a retained container. Its position, scale and angle now belong to the stage. */
  bindNode(id: string, kind: 'enemy' | 'flock', node: Phaser.GameObjects.Container, x: number, y: number,
    scale: number, breath?: ActorBreath, tint?: ActorTint) {
    const actor = this.ensure(id, kind, x, y, scale);
    actor.node = node;
    actor.breath = breath;
    actor.tint = tint;
    actor.shownFlash = 0;
    actor.alive = () => node.active;
    this.apply(actor);
    return actor;
  }

  retire(id: string) { this.actors.delete(id); }

  /** Start a transient motion. It layers on the slot and never moves it. */
  play(id: string, motion: ActorMotion) {
    const actor = this.actors.get(id);
    if (!actor || this.still) return;
    this.tick();
    if (motion.channel === 'action') {
      actor.motions = actor.motions.filter((running) => {
        if (running.motion.channel !== 'action') return true;
        this.sample(running, actor.carry);
        return false;
      });
      actor.carry.flash = 0;
    }
    actor.motions.push({ motion, start: this.time, total: motion.keys.reduce((sum, key) => sum + key[0], 0) });
  }

  /** Freeze every actor for a few frames on contact. Game clocks keep running. */
  hitStop(frames: number) {
    if (this.still) return;
    this.tick();
    const count = Phaser.Math.Clamp(Math.round(frames), 2, 4);
    this.frozenUntil = Math.max(this.frozenUntil, this.scene.time.now + count * FRAME_MS);
    this.hitStops += 1;
    this.lastHitStopFrames = count;
  }

  get frozen() { return this.scene.time.now < this.frozenUntil; }

  private acting(actor: BattleActor, name: string) {
    return actor.motions.some(running => running.motion.name === name && this.time - running.start < running.total);
  }

  private towardFlock(actor: BattleActor) {
    return (this.actors.get('flock')?.slot.x ?? 0) < actor.slot.x ? -1 : 1;
  }

  /** Enemy body language: wind up, lunge at the flock, recoil, stagger. */
  enemyCue(enemyId: string, cue: string, detail = 0) {
    const actor = this.actors.get(`enemy:${enemyId}`);
    if (!actor || this.still) return;
    const s = actor.scale, toward = this.towardFlock(actor), away = -toward;
    const beat = Number(this.scene.combatEnemyTurnBeatDurationMs) || 0;
    if (cue === 'windup') {
      this.play(actor.id, { name: 'windup', channel: 'action', hold: true,
        keys: [[Phaser.Math.Clamp(beat * 0.7, 120, 1050), away * 26 * s, -14 * s, -0.052, 0.07, away * 2, quadOut]] });
    } else if (cue === 'attack') {
      if (this.acting(actor, 'lunge')) return;
      const out = Phaser.Math.Clamp(beat || 140, 80, 420);
      const key: MotionKey = [out, toward * 82 * s, 18 * s, 0.072, -0.058, toward * 3, cubicIn];
      this.play(actor.id, { name: 'lunge', channel: 'action',
        keys: [key, [Math.max(60, detail), key[1], key[2], key[3], key[4], key[5], linear], [Math.max(180, out * 0.8), 0, 0, 0, 0, 0, cubicOut]] });
    } else if (cue === 'hit') {
      const maxHp = this.scene.enemies?.find((enemy: any) => enemy.id === enemyId)?.maxHp ?? 1;
      this.react(actor, detail, maxHp, away);
    }
  }

  /** Flock body language outside an attack card: brace, lift, flinch. */
  flockCue(cue: string, detail = 0) {
    const actor = this.actors.get('flock');
    if (!actor || this.still) return;
    if (cue === 'hit') {
      this.react(actor, detail || 1, this.scene.flock?.maxHp ?? 1, -1);
    } else if (cue === 'brace') {
      this.play(actor.id, { name: 'brace', channel: 'action',
        keys: [[90, -7, 8, 0.04, -0.045, -2, quadOut], [220, -6, 7, 0.034, -0.04, -1.5, linear], [240, 0, 0, 0, 0, 0, backOut]] });
    } else if (cue === 'heal') {
      this.play(actor.id, { name: 'lift', channel: 'action',
        keys: [[150, 0, -8, 0.012, 0.018, 0, quadOut], [220, 0, 0, 0, 0, 0, sineInOut]] });
    } else if (cue === 'cast' && !this.acting(actor, 'dive')) {
      this.play(actor.id, { name: 'rally', channel: 'action',
        keys: [[120, 12, -10, 0.018, -0.01, 1.5, quadOut], [200, 0, 0, 0, 0, 0, sineInOut]] });
    }
  }

  /** An attack card: crouch, dive toward the target, hold through contact, return. */
  flockCast(budget: number, style?: string, enemyId?: string) {
    const actor = this.actors.get('flock');
    if (!actor || this.still || (style !== 'swoop' && style !== 'shove')) return;
    const target = this.actors.get(`enemy:${enemyId}`)?.slot ?? { x: actor.slot.x + 420, y: actor.slot.y };
    const dx = target.x - actor.slot.x, dy = target.y - actor.slot.y, length = Math.max(1, Math.hypot(dx, dy));
    const reach = Math.min(74, length * 0.17) * (style === 'shove' ? 0.78 : 1);
    const ux = dx / length, uy = dy / length, span = Math.max(180, budget || 0);
    const strike: MotionKey = [span * 0.48, ux * reach, uy * reach - (style === 'swoop' ? 10 : 0), 0.03, -0.022,
      style === 'swoop' ? 5 : 3, style === 'shove' ? cubicIn : sineInOut];
    this.play(actor.id, { name: 'dive', channel: 'action', keys: [
      [span * 0.22, -ux * 10, 5, 0.022, -0.03, -2.5, quadOut],
      strike,
      [span * 0.3 + 90, strike[1], strike[2], strike[3], strike[4], strike[5], linear],
      [230, 0, 0, 0, 0, 0, cubicOut],
    ] });
  }

  /** Contact: freeze, then recoil. A heavy hit staggers instead. */
  private react(actor: BattleActor, damage: number, maxHp: number, away: number) {
    const share = damage / Math.max(1, maxHp), heavy = heavyHit(damage, maxHp), s = actor.scale;
    const flash = currentFlashEffectsState().reduced ? 0 : heavy ? 1 : 0.7;
    if (heavy) {
      this.play(actor.id, { name: 'stagger', channel: 'react', flash, shake: currentScreenShakeState().enabled ? 4 * s : 0, keys: [
        [40, away * 30 * s, -6 * s, -0.06, 0.04, away * 8, quadOut],
        [150, away * 34 * s, -2 * s, -0.04, 0.03, away * 9, linear],
        [170, -away * 7 * s, 2 * s, 0.02, -0.02, -away * 3, sineInOut],
        [210, 0, 0, 0, 0, 0, quadOut],
      ] });
    } else {
      const k = Phaser.Math.Clamp(0.6 + share * 4, 0.6, 1.3);
      this.play(actor.id, { name: 'recoil', channel: 'react', flash, keys: [
        [34, away * 14 * s * k, -2 * s, -0.03, 0.02, away * 2.5 * k, quadOut],
        [230, 0, 0, 0, 0, 0, backOut],
      ] });
    }
    this.hitStop(heavy ? 4 : share >= 0.08 ? 3 : 2);
  }

  /** Advance the animation clock to scene time and repose every actor. */
  tick() {
    const scene = this.scene, now = scene.time.now;
    const from = Math.max(this.last, this.frozenUntil);
    const dt = scene.time.paused ? 0 : Math.max(0, now - from) * animationPaceTimeScale();
    // The manual test clock runs ahead of the real one; never wait for it.
    this.last = now;
    if (this.frozenUntil > now + 4 * FRAME_MS + 1) this.frozenUntil = now;
    this.time += dt;
    this.layoutHand();
    const still = this.still, k = 1 - Math.exp(-dt / SETTLE_MS);
    for (const actor of this.actors.values()) {
      if (actor.alive && !actor.alive()) { this.actors.delete(actor.id); continue; }
      const { settle, rest, pose } = actor;
      if (still) {
        actor.motions.length = 0;
        Object.assign(actor.carry, none());
        Object.assign(settle, zero());
        Object.assign(pose, identity());
      } else {
        settle.x += (rest.x - settle.x) * k;
        settle.y += (rest.y - settle.y) * k;
        settle.scale += (rest.scale - settle.scale) * k;
        settle.angle += (rest.angle - settle.angle) * k;
        if (Math.abs(settle.x - rest.x) + Math.abs(settle.y - rest.y) < 0.02) { settle.x = rest.x; settle.y = rest.y; }
        if (Math.abs(settle.scale - rest.scale) < 0.0004) settle.scale = rest.scale;
        if (Math.abs(settle.angle - rest.angle) < 0.004) settle.angle = rest.angle;
        pose.x = settle.x; pose.y = settle.y; pose.scaleX = pose.scaleY = settle.scale; pose.angle = settle.angle; pose.flash = 0;
        if (actor.motions.length) actor.motions = actor.motions.filter(running => this.sample(running, pose));
        const carry = actor.carry, fade = Math.exp(-dt / CARRY_MS);
        if (carry.x || carry.y || carry.angle || carry.scaleX || carry.scaleY) {
          carry.x *= fade; carry.y *= fade; carry.scaleX *= fade; carry.scaleY *= fade; carry.angle *= fade;
          if (Math.abs(carry.x) + Math.abs(carry.y) + Math.abs(carry.angle) < 0.05) Object.assign(carry, none());
          pose.x += carry.x; pose.y += carry.y; pose.scaleX += carry.scaleX; pose.scaleY += carry.scaleY; pose.angle += carry.angle;
        }
        const breath = actor.breath;
        if (breath && this.time > breath.delay) {
          const b = 0.5 - 0.5 * Math.cos(Math.PI * (this.time - breath.delay) / breath.period);
          pose.y -= breath.lift * b;
          pose.scaleX -= breath.squeeze * b;
          pose.scaleY += breath.stretch * b;
        }
      }
      this.apply(actor);
    }
  }

  /** Adds one motion's contribution. Returns false once it has finished. */
  private sample(running: RunningMotion, pose: ActorPose) {
    const { motion } = running, elapsed = this.time - running.start;
    if (elapsed >= running.total && !motion.hold) return false;
    let x = 0, y = 0, sx = 0, sy = 0, angle = 0, at = 0;
    for (const key of motion.keys) {
      const t = Phaser.Math.Clamp((elapsed - at) / Math.max(1, key[0]), 0, 1), e = (key[6] ?? linear)(t);
      x += (key[1] - x) * e; y += (key[2] - y) * e; sx += (key[3] - sx) * e; sy += (key[4] - sy) * e; angle += (key[5] - angle) * e;
      at += key[0];
      if (elapsed < at) break;
    }
    const fade = Math.max(0, 1 - elapsed / Math.max(1, running.total));
    if (motion.shake) x += motion.shake * Math.sin(elapsed * 0.085) * fade;
    if (motion.flash) pose.flash = Math.max(pose.flash, motion.flash * Math.max(0, 1 - elapsed / 150) ** 2);
    pose.x += x; pose.y += y; pose.scaleX += sx; pose.scaleY += sy; pose.angle += angle;
    return true;
  }

  private apply(actor: BattleActor) {
    const { node, pose, slot, tint } = actor;
    if (!node?.active) return;
    node.setPosition(slot.x + pose.x, slot.y + pose.y).setScale(pose.scaleX, pose.scaleY).setAngle(pose.angle);
    if (tint?.image.active && pose.flash !== actor.shownFlash) {
      actor.shownFlash = pose.flash;
      tint.image.setTint(mixColor(tint.from, tint.to, pose.flash));
    }
  }

  /** The hand fans gently; the hovered card lifts and straightens while its
   * neighbours part, and the selected card stays raised. */
  private layoutHand() {
    const { order, hovered, selected } = this.hand, middle = (order.length - 1) / 2;
    const focus = hovered ? order.indexOf(hovered) : -1;
    order.forEach((id, index) => {
      const rest = this.actors.get(`card:${id}`)?.rest;
      if (!rest) return;
      const u = index - middle;
      rest.x = 0; rest.y = u * u * FAN_DROP; rest.angle = u * FAN_TILT; rest.scale = 1;
      if (id === selected) { rest.y = -8; rest.angle = 0; }
      if (index === focus) { rest.y = -14; rest.angle = 0; rest.scale = 1.04; }
      else if (focus >= 0) {
        const gap = index - focus;
        rest.x = (Math.sign(gap) * 9) / Math.abs(gap);
        rest.angle += Math.sign(gap) * 0.6 / Math.abs(gap);
      }
    });
  }

  /** Where an actor is drawn right now, for effects that should follow the body. */
  visualPoint(id: string) {
    const actor = this.actors.get(id);
    return actor ? { x: actor.slot.x + actor.pose.x, y: actor.slot.y + actor.pose.y } : undefined;
  }

  /** Read-only diagnostics: logical slot and visual pose for every actor. */
  debugState() {
    this.tick();
    return {
      time: this.time, frozen: this.frozen, hitStops: this.hitStops, lastHitStopFrames: this.lastHitStopFrames,
      reducedMotion: this.still, hand: { ...this.hand, order: [...this.hand.order] },
      actors: [...this.actors.values()].map(actor => ({
        id: actor.id, kind: actor.kind, slot: { ...actor.slot }, pose: { ...actor.pose },
        motions: actor.motions.map(running => running.motion.name),
      })),
    };
  }
}

/** The scene's actor stage, created on first use. */
export function battleActors(scene: Phaser.Scene): BattleActorStage {
  const host = scene as Host;
  return host.battleActors ??= new BattleActorStage(scene);
}

const visual = new Phaser.GameObjects.Components.TransformMatrix();
const composed = new Phaser.GameObjects.Components.TransformMatrix();
const BODY = '__battleActor';

function poseMatrix(actor: BattleActor, parent?: Phaser.GameObjects.Components.TransformMatrix) {
  const pose = actor.pose;
  if (!pose.x && !pose.y && !pose.angle && pose.scaleX === 1 && pose.scaleY === 1) return parent;
  const { x, y } = actor.slot;
  visual.applyITRS(x + pose.x, y + pose.y, Phaser.Math.DegToRad(pose.angle), pose.scaleX, pose.scaleY);
  visual.translate(-x, -y);
  if (!parent) return visual;
  parent.multiply(visual, composed);
  return composed;
}

/**
 * Make a hand card's flat objects one retained body. Each object keeps its
 * logical transform, so bounds, hit areas and layout assertions are untouched;
 * the actor's pose is multiplied in only while the object is drawn.
 */
export function attachCardBody(stage: BattleActorStage, id: string, objects: Phaser.GameObjects.GameObject[],
  x: number, y: number, alive: () => boolean) {
  const key = `card:${id}`, known = stage.actors.has(key);
  const actor = stage.ensure(key, 'card', x, y);
  actor.alive = alive;
  // A card that joins the hand settles into its slot instead of appearing in it.
  if (!known && !prefersReducedMotion()) actor.settle.y = 22;
  for (const object of objects as Array<Phaser.GameObjects.GameObject & Record<string, any>>) {
    const wrapped = object[BODY] !== undefined;
    object[BODY] = actor;
    if (wrapped) continue;
    for (const method of ['renderWebGLStep', 'renderCanvas'] as const) {
      const draw = object[method];
      if (typeof draw !== 'function') continue;
      object[method] = function (this: unknown, renderer: unknown, self: unknown, context: unknown,
        parent?: Phaser.GameObjects.Components.TransformMatrix, ...rest: unknown[]) {
        return draw.call(this, renderer, self, context, poseMatrix(object[BODY], parent), ...rest);
      };
    }
  }
  return actor;
}
