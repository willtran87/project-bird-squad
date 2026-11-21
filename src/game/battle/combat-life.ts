import Phaser from 'phaser';
import { currentFlashEffectsState, currentScreenShakeState, prefersReducedMotion } from '../../main';
import { animationPaceTimeScale } from '../shared/preferences';
import { FLOCK_ART_X, FLOCK_FX_X, FLOCK_FX_Y, FLOCK_HP_BAR } from '../shared/layout-constants';
import { birdAudio } from '../shared/bird-audio-director';
import { prefersLeanEffects } from '../graphics-quality';
import { getLeader } from '../leaders';
import { UI_FONT } from '../ui-tokens';
import { ACTOR_EASE, battleActors } from './actors';
import {
  type GhostBar, type IntentIcon, type StatusBadge, type StatusIcon, comboStyle, enemyBadges, flockBadges, INTENT_COLOR,
  intentIcon, leaderAccentColor, leaderFlourish, rollPlan, rollValue, STATUS_COLOR, stepGhost, waymarkTarget,
} from './combat-life-rules';

/**
 * Combat life: the layer that makes combatants, status, numbers and big
 * moments feel alive. It decides nothing and never writes game state.
 *
 * - Retained per enemy (`combat-life-enemy`) and for the flock
 *   (`combat-life-flock`): status/intent icon badges, ghost health trails and
 *   status effects on the bodies. Parked and re-seated with the actor bodies, so
 *   they survive the immediate-mode redraw without flicker.
 * - A top layer (`combat-life-top`): set pieces, Leader flourishes, Waymark
 *   lines, counter rolls and the combo chain. Nothing in it takes input.
 *
 * It watches scene state on the scene clock (`advanceTime` drives it) and
 * reacts to transitions: Surge, Molt, Cover gained, boss entrance and phase,
 * a finishing blow, victory, defeat. Every set piece is skippable by any input,
 * shorter than 1.5 s and purely presentational. Reduced Motion keeps titles
 * and badges but drops motion; Lean graphics drops particles; Flash Effects
 * and Screen Shake gate glows and jitter.
 */

type Host = Phaser.Scene & Record<string, any>;
type Piece = { name: string; start: number; duration: number; objects: Phaser.GameObjects.GameObject[];
  update: (t: number, ms: number) => void; end?: () => void };
interface EnemyLife { node: Phaser.GameObjects.Container; intent: Phaser.GameObjects.Graphics; intentSig: string;
  statuses: Phaser.GameObjects.Graphics[]; statusSig: string; drain: Phaser.GameObjects.Rectangle;
  ghost: Phaser.GameObjects.Rectangle; shimmer: Phaser.GameObjects.Graphics; bar: GhostBar;
  hp: { x: number; y: number; w: number; h: number }; seen: boolean; badges: StatusBadge[]; intentKind: IntentIcon }
interface Roll { from: number; to: number; start: number; duration: number; steps: number; step: number; overlay?: Phaser.GameObjects.Text }

const LIFE_DEPTH = 76;
const COUNTERS = ['hud-value-Cover', 'hud-value-Wingbeats', 'hud-value-Scrap', 'combat-flow-value'];
const REWARD_MODES = ['waymarkReward', 'cardReward', 'upgradeReward', 'runComplete'];
const ENEMY_TINT = 0x111822;
const MOLT_TINT = 0xe6c4ff;
const ease = ACTOR_EASE;

function mix(from: number, to: number, t: number) {
  const c = (s: number) => Math.round(((from >> s) & 255) + (((to >> s) & 255) - ((from >> s) & 255)) * t) << s;
  return c(16) | c(8) | c(0);
}

/** Procedural icon, centred on the graphics origin, `r` is its half-size. */
export function drawLifeIcon(g: Phaser.GameObjects.Graphics, icon: StatusIcon | IntentIcon, r: number, color: number) {
  const dark = 0x071019;
  g.clear();
  g.fillStyle(dark, 0.94).fillCircle(0, 0, r + 4).lineStyle(1.5, color, 0.85).strokeCircle(0, 0, r + 4);
  g.fillStyle(color, 1).lineStyle(2, color, 1);
  const poly = (points: number[][], fill = true) => {
    const p = points.map(([x, y]) => new Phaser.Math.Vector2(x * r, y * r));
    if (fill) g.fillPoints(p, true); else g.strokePoints(p, false);
  };
  switch (icon) {
    case 'cover': case 'defend': case 'guard':
      poly([[0, -1], [0.85, -0.6], [0.7, 0.35], [0, 1], [-0.7, 0.35], [-0.85, -0.6]]);
      if (icon === 'guard') { g.fillStyle(dark, 1).fillRect(-0.12 * r, -0.5 * r, 0.24 * r, r).fillRect(-0.5 * r, -0.12 * r, r, 0.24 * r); }
      break;
    case 'winded':
      for (const [y, w] of [[-0.5, 1.5], [0, 1.9], [0.5, 1.2]]) g.lineBetween(-r, y * r, (w - 1) * r, y * r);
      g.strokeCircle(0.55 * r, -0.72 * r, 0.22 * r);
      break;
    case 'ruffled': poly([[-1, 0.3], [-0.6, -0.5], [-0.2, 0.4], [0.2, -0.6], [0.6, 0.3], [1, -0.4]], false); break;
    case 'openSky':
      g.strokeCircle(0, 0.15 * r, 0.75 * r);
      poly([[-0.45, 0.05], [0, -0.75], [0.45, 0.05]], false);
      break;
    case 'resonance': poly([[0.15, -1], [-0.55, 0.15], [-0.05, 0.15], [-0.2, 1], [0.6, -0.2], [0.05, -0.2]]); break;
    case 'molt':
      poly([[0, -1], [0.45, -0.2], [0.25, 0.7], [0, 1], [-0.25, 0.7], [-0.45, -0.2]]);
      g.lineStyle(1.5, dark, 1).lineBetween(0, -0.7 * r, 0, 0.95 * r);
      break;
    case 'fouled': g.fillCircle(0, 0.3 * r, 0.6 * r); poly([[-0.5, 0.1], [0, -1], [0.5, 0.1]]); break;
    case 'attack': for (const dx of [-0.55, 0, 0.55]) g.lineBetween((dx - 0.35) * r, 0.8 * r, (dx + 0.35) * r, -0.8 * r); break;
    case 'buff': poly([[0, -1], [0.85, 0], [0.35, 0], [0.35, 0.9], [-0.35, 0.9], [-0.35, 0], [-0.85, 0]]); break;
    case 'debuff': poly([[0, 1], [0.85, 0], [0.35, 0], [0.35, -0.9], [-0.35, -0.9], [-0.35, 0], [-0.85, 0]]); break;
    default:
      g.beginPath().arc(0, -0.35 * r, 0.45 * r, Math.PI, Math.PI * 2.25).strokePath();
      g.lineBetween(0.1 * r, 0.05 * r, 0, 0.4 * r).fillCircle(0, 0.8 * r, 0.16 * r);
  }
  return g;
}

export class CombatLife {
  readonly top: Phaser.GameObjects.Container;
  readonly seen: Record<string, number> = {};
  time = 0;
  private scene: Host;
  private last: number;
  private enemies = new Map<string, EnemyLife>();
  private flockNode?: Phaser.GameObjects.Container;
  private flockShield?: Phaser.GameObjects.Graphics;
  private flockBadgeSig = '';
  private flockBadges: StatusBadge[] = [];
  private flockBar: GhostBar = { shown: 1, ghost: 1, holdUntil: 0 };
  private flockBarRects: Phaser.GameObjects.Rectangle[] = [];
  private flockBarGeom?: { left: number; y: number };
  private parking: Phaser.GameObjects.Container;
  private pieces: Piece[] = [];
  private rolls = new Map<string, Roll>();
  private counts = new Map<string, number>();
  private combo?: Phaser.GameObjects.Container;
  private comboCount = 0;
  private watched?: { surging: boolean; molt: boolean; block: number; turn: number; mode: string; signatures: number;
    hp: Map<string, number>; phase: Map<string, number>; points: Map<string, { x: number; y: number; s: number }> };
  private bossIntroduced = new Set<string>();
  private nextFeather = 0;
  private zoomPiece?: Piece;

  constructor(scene: Phaser.Scene) {
    this.scene = scene as Host;
    this.last = scene.time.now;
    this.top = scene.add.container(0, 0).setDepth(LIFE_DEPTH).setName('combat-life-top');
    this.parking = scene.add.container(0, 0).setVisible(false).setName('combat-life-parking');
    const events = scene.events;
    const tick = () => this.tick();
    const hud = () => this.afterHud();
    const waymark = (mark: { effect?: string; effects?: string[] }) => this.waymarkLine(mark);
    const skip = () => this.skip();
    events.on('postupdate', tick);
    events.on('clock-advanced', tick);
    events.on('battle-hud-rendered', hud);
    events.on('waymark-fired', waymark);
    scene.input?.on('pointerdown', skip);
    scene.input?.keyboard?.on('keydown', skip);
    events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      events.off('postupdate', tick); events.off('clock-advanced', tick);
      events.off('battle-hud-rendered', hud); events.off('waymark-fired', waymark);
      scene.input?.off('pointerdown', skip); scene.input?.keyboard?.off('keydown', skip);
      this.skip();
      this.top.destroy(true); this.parking.destroy(true);
      this.enemies.clear();
      if (this.scene.combatLife === this) delete this.scene.combatLife;
    });
  }

  private get still() { return prefersReducedMotion(); }
  private get lean() { return prefersLeanEffects(); }
  private get flashScale() { return currentFlashEffectsState().reduced ? 0.4 : 1; }

  /** Step retained objects out of `root` before it is cleared. */
  park(root: Phaser.GameObjects.Container) {
    if (!this.parking.active) return;
    for (const life of this.enemies.values()) if (life.node.active && life.node.parentContainer === root) this.parking.add(life.node);
    if (this.flockNode?.active && this.flockNode.parentContainer === root) this.parking.add(this.flockNode);
  }

  /** Seat the flock's retained life right after its body. */
  seatFlock(target: Phaser.GameObjects.Container) {
    const scene = this.scene;
    if (!this.flockNode?.active) {
      this.flockNode = scene.add.container(0, 0).setName('combat-life-flock');
      this.flockShield = scene.add.graphics().setName('combat-life-cover-shield').setVisible(false);
      this.flockNode.add(this.flockShield);
      this.flockBadgeSig = '';
    }
    target.add(this.flockNode);
    const flock = scene.flock;
    if (!flock) return;
    const badges = flockBadges(flock, Number(scene.spark) || 0), sig = badges.map(b => `${b.icon}${b.stacks ?? ''}`).join('|');
    this.flockBadges = badges;
    if (sig === this.flockBadgeSig) return;
    this.flockBadgeSig = sig;
    this.flockNode.list.filter(o => o.name === 'combat-flock-status-badge' || o.name === 'combat-flock-status-stack').forEach(o => o.destroy());
    let x = 30;
    for (const badge of badges) {
      const color = STATUS_COLOR[badge.icon];
      const icon = drawLifeIcon(scene.add.graphics({ x, y: 228 }), badge.icon, 8, color)
        .setName('combat-flock-status-badge').setData('label', badge.label).setData('icon', badge.icon);
      this.flockNode.add(icon);
      x += 15;
      if (badge.stacks !== undefined) {
        const stack = scene.add.text(x, 228, `${badge.stacks}`, { fontFamily: UI_FONT, fontSize: '17px',
          fontStyle: 'bold', color: '#eef6fb', stroke: '#071019', strokeThickness: 3, resolution: 2 })
          .setOrigin(0, 0.5).setName('combat-flock-status-stack').setData('label', badge.label);
        this.flockNode.add(stack);
        x += stack.width + 4;
      }
      x += 16;
    }
  }

  /** Seat each enemy's retained life above its labels; place icons beside the text they repeat. */
  seatEnemies(target: Phaser.GameObjects.Container, views: Array<{ id: string; hp: number; maxHp: number; block: number; weak: number;
    hpBar: { x: number; y: number; w: number; h: number }; intent: { kind?: string } }>) {
    const scene = this.scene;
    for (const life of this.enemies.values()) life.seen = false;
    const find = (name: string, id: string) => target.list.find(o => o.name === name && (o as any).getData?.('enemyId') === id) as any;
    for (const view of views) {
      let life = this.enemies.get(view.id);
      if (!life?.node.active) {
        const node = scene.add.container(0, 0).setName('combat-life-enemy').setData('enemyId', view.id);
        const share = Math.max(0, Math.min(1, view.hp / Math.max(1, view.maxHp)));
        life = { node, intent: scene.add.graphics().setName('combat-life-intent-icon'), intentSig: '', statuses: [], statusSig: '',
          drain: scene.add.rectangle(0, 0, 1, 1, 0xffd0c9, 0.92).setOrigin(0, 0.5).setName('combat-life-health-drain'),
          ghost: scene.add.rectangle(0, 0, 1, 1, 0xf6e7da, 0.42).setOrigin(0, 0.5).setName('combat-life-health-ghost'),
          shimmer: scene.add.graphics().setName('combat-life-cover-shimmer'), bar: { shown: share, ghost: share, holdUntil: 0 },
          hp: view.hpBar, seen: true, badges: [], intentKind: 'unknown' };
        node.add([life.shimmer, life.ghost, life.drain, life.intent]);
        this.enemies.set(view.id, life);
      }
      life.seen = true;
      life.hp = { ...view.hpBar };
      target.add(life.node);
      // Intent icon sits in the badge's free left margin, never over its text.
      const kind = intentIcon(view.intent.kind), label = find('combat-enemy-intent-value', view.id), badge = find('combat-enemy-intent-badge', view.id);
      life.intentKind = kind;
      if (label && badge) {
        const text = label.getBounds(), frame = badge.getBounds(), x = text.left - 15;
        const fits = x - 12 >= frame.left + 2;
        if (life.intentSig !== kind) { drawLifeIcon(life.intent, kind, 8, INTENT_COLOR[kind]); life.intentSig = kind; }
        life.intent.setPosition(x, frame.centerY).setVisible(fits).setData('icon', kind);
      } else life.intent.setVisible(false);
      // Status icons line up left of the status text they repeat, when they fit.
      const badges = enemyBadges(view), sig = badges.map(b => b.icon).join('|');
      life.badges = badges;
      if (sig !== life.statusSig) {
        life.statuses.forEach(g => g.destroy());
        life.statuses = badges.map(b => drawLifeIcon(scene.add.graphics(), b.icon, 5, STATUS_COLOR[b.icon])
          .setName('combat-life-status-icon').setData('icon', b.icon).setData('label', b.label));
        life.node.add(life.statuses);
        life.statusSig = sig;
      }
      const status = find('combat-enemy-status', view.id), panel = find('combat-enemy-status-panel', view.id);
      if (status && panel && life.statuses.length) {
        const text = status.getBounds(), frame = panel.getBounds(), n = life.statuses.length;
        const fits = text.left - n * 18 >= frame.left + 1;
        life.statuses.forEach((g, i) => g.setPosition(text.left - 10 - (n - 1 - i) * 18, frame.centerY).setVisible(fits));
      } else life.statuses.forEach(g => g.setVisible(false));
    }
    for (const [id, life] of this.enemies) if (!life.seen) { life.node.destroy(true); this.enemies.delete(id); }
    this.paint(0);
  }

  /** The HUD has been rebuilt: re-hide rolling counters and draw the Cohesion ghost behind its value. */
  private afterHud() {
    const root: Phaser.GameObjects.Container | undefined = this.scene.root;
    if (!root?.active) return;
    for (const name of COUNTERS) {
      const label = root.getByName(name) as Phaser.GameObjects.Text | null;
      if (!label) continue;
      const value = Number(/-?\d+/.exec(label.text)?.[0]);
      if (!Number.isFinite(value)) continue;
      const before = this.counts.get(name), roll = this.rolls.get(name);
      this.counts.set(name, value);
      if (before !== undefined && before !== value && !this.still && this.scene.mode === 'battle') {
        const from = roll ? rollValue(roll.from, roll.to, (this.time - roll.start) / roll.duration) : before;
        const plan = rollPlan(from, value);
        roll?.overlay?.destroy();
        if (plan.steps) this.rolls.set(name, { from, to: value, start: this.time, duration: plan.duration, steps: plan.steps, step: 0 });
      }
      const active = this.rolls.get(name);
      if (active) this.mountRoll(active, label);
    }
    const cohesion = root.getByName('hud-value-Cohesion') as Phaser.GameObjects.Text | null;
    this.flockBarRects = [];
    if (cohesion && this.scene.flock) {
      const y = cohesion.y, left = FLOCK_HP_BAR.x - FLOCK_HP_BAR.w / 2, at = root.getIndex(cohesion);
      this.flockBarGeom = { left, y };
      this.flockBarRects = [
        this.scene.add.rectangle(left, y, 1, FLOCK_HP_BAR.h - 6, 0xf4f0d8, 0.4).setOrigin(0, 0.5).setName('combat-life-cohesion-ghost'),
        this.scene.add.rectangle(left, y, 1, FLOCK_HP_BAR.h - 6, 0xffe2c4, 0.9).setOrigin(0, 0.5).setName('combat-life-cohesion-drain'),
      ];
      this.flockBarRects.forEach(rect => root.addAt(rect, at));
    }
    this.paint(0);
  }

  private mountRoll(roll: Roll, label: Phaser.GameObjects.Text) {
    const style = label.style, m = label.getWorldTransformMatrix();
    if (!roll.overlay?.active) {
      roll.overlay = this.scene.add.text(0, 0, '', { fontFamily: style.fontFamily, fontSize: style.fontSize as string, fontStyle: style.fontStyle,
        color: style.color as string, stroke: style.stroke as string, strokeThickness: style.strokeThickness, resolution: 2 })
        .setName('combat-count-roll');
      this.top.add(roll.overlay);
    }
    roll.overlay.setOrigin(label.originX, label.originY).setPosition(m.tx, m.ty).setData('for', label.name).setData('template', label.text);
    label.setAlpha(0);
    roll.overlay.setData('label', label);
    this.drawRoll(roll);
  }

  private drawRoll(roll: Roll) {
    const overlay = roll.overlay;
    if (!overlay?.active) return;
    const t = Math.min(1, (this.time - roll.start) / roll.duration), value = rollValue(roll.from, roll.to, t);
    overlay.setText(String(overlay.getData('template')).replace(/-?\d+/, String(value)));
    const step = Math.min(roll.steps, Math.floor(t * roll.steps + 0.0001));
    if (step > roll.step) { roll.step = step; birdAudio.play('count.tick', { step, of: roll.steps }); }
    overlay.setScale(t >= 1 || this.still ? 1 : 1 + 0.16 * (1 - ((t * roll.steps) % 1)));
  }

  private endRoll(name: string) {
    const roll = this.rolls.get(name);
    if (!roll) return;
    const label = roll.overlay?.getData('label') as Phaser.GameObjects.Text | undefined;
    if (label?.active) label.setAlpha(1);
    roll.overlay?.destroy();
    this.rolls.delete(name);
  }

  /** Advance the life clock and react to state transitions. */
  tick() {
    const scene = this.scene, now = scene.time.now;
    const dt = scene.time.paused ? 0 : Math.max(0, now - this.last) * animationPaceTimeScale();
    this.last = now;
    this.time += dt;
    if (!this.top.active) return;
    const modal = Boolean(scene.inspectOverlay || scene.waymarkDrawerOpen || scene.supplyDrawerOpen || scene.pauseOverlayOpen);
    this.top.setVisible(!modal);
    this.watch();
    for (const piece of [...this.pieces]) {
      const ms = this.time - piece.start, t = Math.min(1, ms / piece.duration);
      piece.update(t, ms);
      if (t >= 1) this.finish(piece);
    }
    for (const [name, roll] of this.rolls) {
      this.drawRoll(roll);
      if (modal || this.time - roll.start >= roll.duration) this.endRoll(name);
    }
    this.paint(dt);
  }

  /** Body status effects, ghost bars, the target's rim light and the combo chain. */
  private paint(dt: number) {
    const scene = this.scene, stage = scene.battleActors as ReturnType<typeof battleActors> | undefined, still = this.still;
    const t = this.time, flock = scene.flock, shake = currentScreenShakeState().enabled;
    for (const [id, life] of this.enemies) {
      const enemy = scene.enemies?.find((e: any) => e.id === id);
      if (!enemy || !life.node.active) continue;
      life.bar = stepGhost(life.bar, Math.max(0, Math.min(1, enemy.hp / Math.max(1, enemy.maxHp))), t, still ? 1e6 : dt);
      this.paintBar(life.drain, life.ghost, life.bar, life.hp.x - life.hp.w / 2, life.hp.y, life.hp.w, life.hp.h - 6);
      const actor = stage?.actors.get(`enemy:${id}`);
      if (actor) {
        actor.life = enemy.weak > 0 && !still ? { droop: 3 * actor.scale, jitter: 0, tempo: 1.6 } : undefined;
        const selected = scene.selectedEnemyId === id && scene.mode === 'battle';
        if (actor.tint) {
          const from = selected && !still ? mix(ENEMY_TINT, 0x3a4a66, 0.55 + 0.45 * Math.sin(t * 0.004)) : selected ? 0x2c3a52 : ENEMY_TINT;
          if (actor.tint.from !== from) { actor.tint.from = from; actor.shownFlash = Number.NaN; }
        }
      }
      // Cover: a shield shimmer on the side facing the flock.
      const g = life.shimmer, point = stage?.visualPoint(`enemy:${id}`);
      g.clear();
      if (enemy.block > 0 && point && actor) {
        const s = actor.scale, pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.005 + s);
        const cx = point.x + 18 * s, cy = point.y - 52 * s, r = 96 * s;
        g.lineStyle(3, 0x9fdcff, (0.28 + 0.3 * pulse) * (this.lean ? 0.7 : 1));
        g.beginPath().arc(cx, cy, r, Math.PI * 0.78, Math.PI * 1.22).strokePath();
        g.lineStyle(1.5, 0xe6f7ff, 0.18 + 0.3 * pulse).beginPath().arc(cx + 5, cy, r - 7, Math.PI * 0.84, Math.PI * 1.16).strokePath();
      }
    }
    // The flock: ghost Cohesion, Cover shield, Molt feathers, Winded droop, Ruffled jitter, Molt palette.
    if (flock && this.flockBarGeom && this.flockBarRects.every(r => r.active)) {
      this.flockBar = stepGhost(this.flockBar, Math.max(0, Math.min(1, flock.hp / Math.max(1, flock.maxHp))), t, still ? 1e6 : dt);
      const [ghost, drain] = this.flockBarRects;
      if (ghost && drain) this.paintBar(drain, ghost, this.flockBar, this.flockBarGeom.left, this.flockBarGeom.y, FLOCK_HP_BAR.w, FLOCK_HP_BAR.h - 6);
    }
    const flockActor = stage?.actors.get('flock');
    if (flock && flockActor) {
      flockActor.life = still ? undefined : (flock.weak > 0 || flock.frail > 0)
        ? { droop: flock.weak > 0 ? 3 : 0, jitter: flock.frail > 0 && shake ? 1.6 : 0, tempo: flock.weak > 0 ? 1.6 : 1 } : undefined;
      if (flockActor.tint) {
        const from = flock.molt ? MOLT_TINT : 0xffffff;
        if (flockActor.tint.from !== from) { flockActor.tint.from = from; flockActor.shownFlash = Number.NaN; }
      }
      const shield = this.flockShield, point = stage?.visualPoint('flock');
      if (shield?.active && point) {
        const forming = this.pieces.some(p => p.name === 'cover-form');
        shield.setVisible(flock.block > 0 && !forming);
        if (flock.block > 0 && !forming) this.drawShield(shield, point.x, point.y, still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.0045), 1);
      }
      if (flock.molt && !still && !this.lean && t >= this.nextFeather && point && this.top.visible) {
        this.nextFeather = t + 260;
        this.feathers(point.x + Phaser.Math.Between(-50, 50), point.y - 150, 1, 0xd8a4ff, 60, 900, 'molt-feather');
      }
    }
    this.paintCombo(dt);
  }

  private paintBar(drain: Phaser.GameObjects.Rectangle, ghost: Phaser.GameObjects.Rectangle, bar: GhostBar, left: number, y: number, w: number, h: number) {
    if (!drain.active || !ghost.active) return;
    const target = this.targetShare(drain, bar);
    drain.setPosition(left + w * target, y).setSize(Math.max(0, w * (bar.shown - target)), h).setVisible(bar.shown > target + 0.001);
    ghost.setPosition(left + w * bar.shown, y).setSize(Math.max(0, w * (bar.ghost - bar.shown)), h).setVisible(bar.ghost > bar.shown + 0.001);
    drain.setData('shown', bar.shown); ghost.setData('ghost', bar.ghost);
  }

  private targetShare(drain: Phaser.GameObjects.Rectangle, bar: GhostBar) {
    const scene = this.scene;
    const id = drain.parentContainer?.getData('enemyId');
    if (id) { const e = scene.enemies?.find((enemy: any) => enemy.id === id); return e ? Math.max(0, Math.min(1, e.hp / Math.max(1, e.maxHp))) : bar.shown; }
    return scene.flock ? Math.max(0, Math.min(1, scene.flock.hp / Math.max(1, scene.flock.maxHp))) : bar.shown;
  }

  private drawShield(g: Phaser.GameObjects.Graphics, x: number, y: number, pulse: number, built: number) {
    g.clear();
    const cx = x + 18, cy = y - 92, r = 112;
    for (let i = 0; i < 5; i++) {
      const k = Phaser.Math.Clamp(built * 5 - i, 0, 1);
      if (!k) continue;
      const a = -0.5 + i * 0.25, px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 1.15, size = 15 * k;
      const hex = Array.from({ length: 6 }, (_, j) => new Phaser.Math.Vector2(px + Math.cos(j * Math.PI / 3) * size * 0.8, py + Math.sin(j * Math.PI / 3) * size));
      g.fillStyle(0x7ab8d6, (0.12 + 0.12 * pulse) * k).fillPoints(hex, true);
      g.lineStyle(1.5, 0xc6ecff, (0.35 + 0.35 * pulse) * k).strokePoints(hex, true);
    }
  }

  private paintCombo(_dt: number) {
    const scene = this.scene, count = scene.mode === 'battle' ? Number(scene.cardsPlayedThisTurn) || 0 : 0;
    const style = comboStyle(count);
    if (count !== this.comboCount) {
      const grew = count > this.comboCount;
      this.comboCount = count;
      if (style.visible) this.showCombo(style, grew);
      else if (this.combo?.active) this.combo.destroy(true);
    }
  }

  private showCombo(style: ReturnType<typeof comboStyle>, grew: boolean) {
    const scene = this.scene;
    if (!this.combo?.active) {
      this.combo = scene.add.container(88, 398).setName('combat-combo-counter');
      this.combo.add([
        scene.add.rectangle(0, 0, 118, 36, 0x071019, 0.94).setName('combat-combo-frame'),
        scene.add.text(-48, 0, 'CHAIN', { fontFamily: UI_FONT, fontSize: '14px', fontStyle: 'bold', color: '#aabcc8', resolution: 2 })
          .setOrigin(0, 0.5).setName('combat-combo-label'),
        scene.add.text(48, 0, '', { fontFamily: UI_FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff', resolution: 2 })
          .setOrigin(1, 0.5).setName('combat-combo-value'),
      ]);
      this.top.add(this.combo);
    }
    const [frame, , value] = this.combo.list as [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Text, Phaser.GameObjects.Text];
    frame.setStrokeStyle(2, style.color, 0.9);
    value.setText(style.label).setColor(`#${style.color.toString(16).padStart(6, '0')}`);
    this.combo.setData('count', this.comboCount).setScale(style.scale);
    if (grew && !this.still) {
      const node = this.combo;
      this.play('combo-pop', 220, [], (t) => { if (node.active) node.setScale(style.scale * (1 + 0.3 * (1 - ease.cubicOut(t)))); });
    }
  }

  /** Compare state with what was last seen and launch the matching moments. */
  private watch() {
    const scene = this.scene, flock = scene.flock, enemies: any[] = scene.enemies ?? [];
    if (!flock) return;
    const surging = flock.flow >= flock.flowMax, mode = String(scene.mode), signatures = scene.leaderSignatureUsed?.size ?? 0;
    const stage = scene.battleActors as ReturnType<typeof battleActors> | undefined;
    const w = this.watched;
    if (!w) {
      this.watched = { surging, molt: Boolean(flock.molt), block: flock.block, turn: scene.turn, mode, signatures,
        hp: new Map(enemies.map(e => [e.id, e.hp])), phase: new Map(enemies.map(e => [e.id, e.phase])), points: new Map() };
      return;
    }
    const intro = Boolean(scene.combatIntroActive);
    if (mode === 'battle' && !intro) {
      if (surging && !w.surging) this.surge();
      if (flock.molt && !w.molt) this.molt();
      if (flock.block > w.block) this.coverForm();
      if (signatures > w.signatures && !(surging && !w.surging)) this.flourish();
      if (scene.turn > w.turn) birdAudio.play('turn.start', {});
      const boss = enemies.find(e => e.runtime?.type === 'boss' && e.hp > 0);
      const key = boss && `${scene.currentRouteIndex}:${boss.id}`;
      if (boss && key && !this.bossIntroduced.has(key)) { this.bossIntroduced.add(key); this.bossEntrance(boss); }
    }
    for (const enemy of enemies) {
      const point = stage?.visualPoint(`enemy:${enemy.id}`);
      if (point) w.points.set(enemy.id, { ...point, s: stage!.actors.get(`enemy:${enemy.id}`)!.scale });
      const hp = w.hp.get(enemy.id), phase = w.phase.get(enemy.id);
      if (hp !== undefined && hp > 0 && enemy.hp <= 0) this.finishingBlow(enemy.id);
      if (phase === 1 && enemy.phase === 2 && enemy.hp > 0) this.phaseChange(enemy.id);
      w.hp.set(enemy.id, enemy.hp); w.phase.set(enemy.id, enemy.phase);
    }
    if (w.mode === 'battle' && mode !== 'battle') {
      if (REWARD_MODES.includes(mode)) this.victory();
      else if (mode === 'defeat') this.defeat();
    }
    Object.assign(w, { surging, molt: Boolean(flock.molt), block: flock.block, turn: scene.turn, mode, signatures });
  }

  private play(name: string, duration: number, objects: Phaser.GameObjects.GameObject[], update: Piece['update'], end?: () => void) {
    const piece: Piece = { name, start: this.time, duration, objects, update, end };
    this.pieces.push(piece);
    if (!name.endsWith('-pop') && !name.endsWith('-feather')) this.seen[name] = (this.seen[name] ?? 0) + 1;
    objects.forEach(o => { if (!o.parentContainer) this.top.add(o); });
    update(0, 0);
    return piece;
  }

  private finish(piece: Piece) {
    const index = this.pieces.indexOf(piece);
    if (index < 0) return;
    this.pieces.splice(index, 1);
    piece.end?.();
    piece.objects.forEach(o => o.destroy());
  }

  /** Any input skips every running set piece to its end. Game state never waited for them. */
  skip() {
    for (const piece of [...this.pieces]) if (!piece.name.endsWith('-feather')) this.finish(piece);
  }

  private edgeGlow(name: string, color: number, duration: number, peak: number) {
    const scene = this.scene, w = scene.scale.width, h = scene.scale.height, k = peak * this.flashScale;
    const bands = [[w / 2, 8, w, 16], [w / 2, h - 8, w, 16], [8, h / 2, 16, h], [w - 8, h / 2, 16, h]]
      .map(([x, y, bw, bh]) => scene.add.rectangle(x, y, bw, bh, color, 0).setName('combat-life-edge-glow'));
    this.play(name, duration, bands, (t) => bands.forEach(b => b.setAlpha(k * Math.sin(Math.PI * t))));
  }

  private title(name: string, text: string, color: string, x: number, y: number, size = 28) {
    const label = this.scene.add.text(x, y, text, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: 'bold',
      color, stroke: '#071019', strokeThickness: 5, resolution: 2 }).setOrigin(0.5).setName(`combat-life-title-${name}`);
    const still = this.still;
    this.play(`${name}-title`, 1100, [label], (t) => {
      label.setAlpha(t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1);
      if (!still) label.setScale(1 + 0.25 * (1 - ease.backOut(Math.min(1, t * 4)))).setY(y - 8 * t);
    });
  }

  private surge() {
    this.edgeGlow('surge', 0x8df4ff, 1100, 0.5);
    this.title('surge', 'SURGE', '#8df4ff', FLOCK_ART_X, 196);
    this.scene.battleActors?.play('flock', { name: 'surge-rise', channel: 'action', keys: [
      [220, 0, -20, 0.025, 0.035, 0, ease.quadOut], [240, 0, -20, 0.025, 0.035, 0, ease.linear], [420, 0, 0, 0, 0, 0, ease.sineInOut]] });
    this.flourish();
  }

  private molt() {
    const point = this.scene.battleActors?.visualPoint('flock') ?? { x: FLOCK_FX_X, y: FLOCK_FX_Y };
    this.feathers(point.x, point.y - 110, 14, 0xd8a4ff, 150, 900, 'molt');
  }

  private feathers(x: number, y: number, count: number, color: number, spread: number, duration: number, name: string, down = false) {
    // Particles: none under Reduced Motion or Lean graphics.
    if (this.still || this.lean) return;
    const scene = this.scene, still = this.still;
    const items = Array.from({ length: count }, (_, i) => {
      const g = drawFeather(scene.add.graphics({ x, y }), color);
      const a = count === 1 ? Math.PI / 2 : down ? Math.PI * (0.15 + 0.7 * i / (count - 1)) : (i / count) * Math.PI * 2 + 0.3, v = spread * (0.6 + ((i * 37) % 10) / 25);
      return { g, dx: Math.cos(a) * v, dy: Math.sin(a) * v, spin: (i % 2 ? 1 : -1) * (90 + i * 13) };
    });
    this.play(count === 1 ? name : `${name}-burst`, duration, items.map(i => i.g), (t) => {
      for (const { g, dx, dy, spin } of items) {
        const k = still ? 0 : ease.cubicOut(t);
        g.setPosition(x + dx * k, y + dy * k + (count === 1 ? 70 * t : 40 * t * t)).setAngle(spin * t).setAlpha(1 - t);
      }
    });
  }

  private coverForm() {
    const shield = this.flockShield, point = this.scene.battleActors?.visualPoint('flock');
    if (!shield?.active || !point || this.still) return;
    const g = this.scene.add.graphics().setName('combat-life-cover-forming');
    this.flockNode?.add(g);
    this.play('cover-form', 420, [g], (t) => this.drawShield(g, point.x, point.y, 1 - t * 0.5, ease.cubicOut(t)));
  }

  private flourish() {
    const scene = this.scene, leader = getLeader(scene.runLeaderId), kind = leaderFlourish(leader.id), color = leaderAccentColor(leader.suit);
    const p = scene.battleActors?.visualPoint('flock') ?? { x: FLOCK_FX_X, y: FLOCK_FX_Y };
    const cx = p.x, cy = p.y - 110, still = this.still;
    const g = scene.add.graphics().setName(`combat-life-flourish-${kind}`).setData('leader', leader.id);
    this.play(`flourish-${kind}`, 900, [g], (t) => {
      g.clear();
      const fade = 1 - t, k = still ? 1 : ease.cubicOut(t);
      if (kind === 'spiral') {
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 + k * 4, r = 30 + 70 * k;
          g.fillStyle(color, 0.85 * fade).fillCircle(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6 - 50 * k, 5);
        }
      } else if (kind === 'arc') {
        g.lineStyle(3, color, 0.9 * fade * (Math.floor(t * 12) % 2 ? 0.6 : 1));
        for (let i = 0; i < 4; i++) {
          const a = -Math.PI / 2 + (i - 1.5) * 0.45; let x = cx, y = cy;
          g.beginPath().moveTo(x, y);
          for (let j = 1; j <= 4; j++) { x = cx + Math.cos(a) * 28 * j * k + (j % 2 ? 8 : -8); y = cy + Math.sin(a) * 28 * j * k; g.lineTo(x, y); }
          g.strokePath();
        }
      } else if (kind === 'slash') {
        g.lineStyle(4, color, 0.9 * fade);
        for (let i = 0; i < 3; i++) g.lineBetween(cx - 60 + i * 26, cy + 60, cx - 60 + i * 26 + 160 * k, cy + 60 - 140 * k);
      } else if (kind === 'ripple') {
        for (let i = 0; i < 3; i++) {
          const q = Phaser.Math.Clamp(t * 1.6 - i * 0.25, 0, 1);
          if (q > 0) g.lineStyle(3, color, 0.8 * (1 - q)).strokeEllipse(cx, p.y + 72, 80 + 200 * q, 22 + 50 * q);
        }
      } else {
        const r = 130 - 50 * k;
        g.lineStyle(3, color, 0.9 * fade).strokePoints(Array.from({ length: 6 }, (_, j) =>
          new Phaser.Math.Vector2(cx + Math.cos(j * Math.PI / 3 + Math.PI / 6) * r, cy + 20 + Math.sin(j * Math.PI / 3 + Math.PI / 6) * r)), true);
      }
    });
  }

  private bossEntrance(boss: any) {
    const scene = this.scene, w = scene.scale.width;
    const x = w / 2, y = 172;
    const band = scene.add.rectangle(x, y, 480, 64, 0x070b12, 0.92).setStrokeStyle(2, 0xff6f6f, 0.8).setName('combat-boss-name-card');
    const name = scene.add.text(x, y - 8, String(boss.name).toUpperCase(), { fontFamily: UI_FONT, fontSize: '26px',
      fontStyle: 'bold', color: '#ffe1a3', resolution: 2 }).setOrigin(0.5).setName('combat-boss-name-card-title');
    const sub = scene.add.text(x, y + 19, 'BOSS', { fontFamily: UI_FONT, fontSize: '15px', fontStyle: 'bold',
      color: '#ff9d8d', resolution: 2 }).setOrigin(0.5).setName('combat-boss-name-card-rank');
    if (name.width > 450) name.setScale(450 / name.width);
    const cam = scene.cameras.main, still = this.still, nameScale = name.scaleX;
    this.zoomPiece = this.play('boss-entrance', 1400, [band, name, sub], (t) => {
      const alpha = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1;
      [band, name, sub].forEach(o => o.setAlpha(alpha));
      if (!still) {
        const slide = (1 - ease.cubicOut(Math.min(1, t * 5))) * 60;
        band.setX(x + slide); name.setX(x + slide * 0.8).setScale(nameScale); sub.setX(x + slide * 0.6);
        cam.setZoom(1 + 0.03 * Math.sin(Math.PI * t));
      }
    }, () => { cam.setZoom(1); this.zoomPiece = undefined; });
  }

  private phaseChange(enemyId: string) {
    const stage = this.scene.battleActors as ReturnType<typeof battleActors> | undefined;
    const p = stage?.visualPoint(`enemy:${enemyId}`) ?? this.watched?.points.get(enemyId);
    this.edgeGlow('boss-phase', 0xff8a4d, 900, 0.55);
    stage?.hitStop(4);
    stage?.play(`enemy:${enemyId}`, { name: 'phase-roar', channel: 'react', keys: [[160, 0, -6, 0.05, 0.05, 0, ease.quadOut], [380, 0, 0, 0, 0, 0, ease.sineInOut]] });
    if (p) this.ring('boss-phase-ring', p.x, p.y - 70, 0xff8a4d, 220, 700);
  }

  private ring(name: string, x: number, y: number, color: number, radius: number, duration: number, shards = 0) {
    const g = this.scene.add.graphics().setName(`combat-life-${name}`), still = this.still;
    const count = this.lean ? Math.min(shards, 6) : shards;
    this.play(name, duration, [g], (t) => {
      const k = still ? 0.7 : ease.cubicOut(t), fade = 1 - t;
      g.clear().lineStyle(4, color, 0.85 * fade).strokeCircle(x, y, radius * k);
      g.lineStyle(2, 0xffffff, 0.5 * fade * this.flashScale).strokeCircle(x, y, radius * 0.6 * k);
      for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2, r = radius * 1.1 * k;
        g.fillStyle(i % 2 ? color : 0xfff1c9, fade).fillRect(x + Math.cos(a) * r - 3, y + Math.sin(a) * r - 3, 6, 6);
      }
    });
  }

  private finishingBlow(enemyId: string) {
    const stage = this.scene.battleActors as ReturnType<typeof battleActors> | undefined;
    const p = this.watched?.points.get(enemyId);
    stage?.slowMo(320, 0.3);
    stage?.hitStop(4);
    if (!p) return;
    const flash = this.scene.add.circle(p.x, p.y - 60 * p.s, 70 * p.s, 0xfff4d6, 0).setName('combat-life-finishing-flash');
    const k = 0.6 * this.flashScale;
    this.play('finishing-blow', 760, [flash], (t) => flash.setAlpha(k * (1 - t) * (t < 0.1 ? t / 0.1 : 1)).setScale(1 + t));
    this.ring('finishing-ring', p.x, p.y - 60 * p.s, 0xffc46b, 120 * p.s, 760, 16);
  }

  private victory() {
    const scene = this.scene, w = scene.scale.width, h = scene.scale.height, still = this.still;
    const bands = [0.12, 0.22, 0.12].map((a, i) => scene.add.rectangle(-200, h / 2, 70 + i * 30, h, 0xffe1a3, a * this.flashScale)
      .setName('combat-life-victory-sweep').setAngle(12));
    this.play('victory', 1200, bands, (t) => bands.forEach((b, i) => {
      b.setX(still ? w / 2 : -200 + (w + 400) * ease.sineInOut(t) + (i - 1) * 60).setAlpha(Math.sin(Math.PI * t) * (i === 1 ? 0.26 : 0.14) * this.flashScale);
    }));
    for (const x of [w * 0.3, w * 0.5, w * 0.7]) this.feathers(x, 190, 6, 0xffd27a, 120, 1200, 'victory', true);
  }

  private defeat() {
    const scene = this.scene, w = scene.scale.width, h = scene.scale.height;
    const bands = [[w / 2, 40, w, 80], [w / 2, h - 40, w, 80], [60, h / 2, 120, h], [w - 60, h / 2, 120, h]]
      .map(([x, y, bw, bh]) => scene.add.rectangle(x, y, bw, bh, 0x05070c, 0).setName('combat-life-defeat-vignette'));
    this.play('defeat', 1400, bands, (t) => bands.forEach(b => b.setAlpha(0.55 * Math.sin(Math.PI * Math.min(1, t * 1.2)))));
    this.feathers(FLOCK_FX_X, FLOCK_FX_Y - 120, 8, 0x9aa6b2, 90, 1400, 'defeat', true);
  }

  /** A brief line from the Waymarks chip to what the Waymark changed. */
  private waymarkLine(mark: { effect?: string; effects?: string[] }) {
    const scene = this.scene, root: Phaser.GameObjects.Container | undefined = scene.root;
    const chip = root?.getByName('hud-waymarks-chip') as Phaser.GameObjects.Rectangle | null;
    if (!chip || scene.mode !== 'battle') return;
    const from = chip.getBounds(), sx = from.centerX, sy = from.bottom - 4;
    const target = waymarkTarget(mark.effects ?? (mark.effect ? [mark.effect] : []));
    const stage = scene.battleActors as ReturnType<typeof battleActors> | undefined;
    let ends: Array<{ x: number; y: number }> = [];
    if (target === 'enemies') ends = (scene.enemies ?? []).filter((e: any) => e.hp > 0).map((e: any) => {
      const p = stage?.visualPoint(`enemy:${e.id}`); return p ? { x: p.x, y: p.y - 70 } : undefined; }).filter(Boolean);
    else if (target === 'Wingbeats' || target === 'Scrap') {
      const b = (root?.getByName(`hud-value-${target}`) as Phaser.GameObjects.Text | null)?.getBounds();
      if (b) ends = [{ x: b.centerX, y: b.bottom }];
    } else if (target === 'hand') ends = [{ x: scene.scale.width / 2, y: 470 }];
    else { const p = stage?.visualPoint('flock'); ends = [{ x: p?.x ?? FLOCK_FX_X, y: (p?.y ?? FLOCK_FX_Y) - 90 }]; }
    if (!ends.length) return;
    const g = scene.add.graphics().setName('combat-waymark-line').setData('target', target), still = this.still;
    this.play('waymark-line', 560, [g], (t) => {
      g.clear();
      const head = still ? 1 : ease.cubicOut(Math.min(1, t * 2)), fade = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
      for (const end of ends) {
        const x = sx + (end.x - sx) * head, y = sy + (end.y - sy) * head;
        g.lineStyle(3, 0xc9a6ff, 0.75 * fade).lineBetween(sx, sy, x, y);
        g.fillStyle(0xf1e6ff, fade).fillCircle(x, y, 5);
      }
    });
  }

  /** Read-only diagnostics for tests. */
  debugState() {
    this.tick();
    return {
      time: this.time, pieces: this.pieces.map(p => p.name), seen: { ...this.seen }, combo: this.comboCount,
      zoom: this.scene.cameras.main.zoom, rolls: [...this.rolls.keys()],
      flockBadges: this.flockBadges.map(b => b.label), cohesion: { ...this.flockBar },
      enemies: [...this.enemies].map(([id, life]) => ({ id, intent: life.intentKind, intentShown: life.intent.visible,
        badges: life.badges.map(b => b.label), iconsShown: life.statuses.filter(g => g.visible).length, bar: { ...life.bar } })),
    };
  }
}

function drawFeather(g: Phaser.GameObjects.Graphics, color: number) {
  const p = [[0, -9], [4, -3], [2.5, 6], [0, 9], [-2.5, 6], [-4, -3]].map(([x, y]) => new Phaser.Math.Vector2(x, y));
  return g.fillStyle(color, 0.95).fillPoints(p, true).lineStyle(1, 0x2a1c33, 0.8).lineBetween(0, -7, 0, 9).setName('combat-life-feather');
}

/** The scene's combat life, created on first use. */
export function combatLife(scene: Phaser.Scene): CombatLife {
  const host = scene as Host;
  return host.combatLife ??= new CombatLife(scene);
}
