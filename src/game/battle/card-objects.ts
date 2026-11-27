import Phaser from 'phaser';
import { currentFlashEffectsState, displayName, formatEffects, loadedCardArtKey, prefersReducedMotion, suitAccentColor, UI_FONT, type Card } from '../../main';
import { activeCardContract } from '../shared/card-presentation';
import { cardLibrary } from '../shared/run-session';
import { CARD_H, CARD_W, GAME_WIDTH, HAND_Y } from '../shared/layout-constants';
import { cardCoverOutcome, cardDamageOutcome } from '../combat-rules';
import { prefersLeanEffects } from '../graphics-quality';
import { fitTextExcerpt } from '../text-excerpt';
import { ACTOR_EASE, battleActors, releaseCardBody, type BattleActor } from './actors';
import {
  cardRarity, dragStarted, dropTarget, faceNumberTints, flightPoint, locateTint, preenedNumberKeys, rarityHasSheen,
  type CardRarity, type DropRect, type DropTarget, type NumberTint, type NumberTone, type Point, type StatusModifier,
} from './card-object-rules';

/**
 * Cards as physical objects.
 *
 * One `CardObjectStage` per battle scene owns everything a card does once it
 * stops being a slot in the hand: the deal from the draw pile, the trip to the
 * discard pile, the burn of an exhausted card, a drag, a refusal shake, the
 * rarity frame's sheen and the pile counters that tick as cards arrive.
 *
 * It never decides anything. Every play still goes through the scene's own
 * click handlers, and a card's logical slot and bounds are never written.
 */

type Host = Phaser.Scene & Record<string, any>;
export type CardFate = 'discard' | 'draw' | 'exhaust';
type Pile = 'DRAW' | 'DISCARD';

/** Size of the small card a played card becomes while it is in the air. */
export const FLIGHT_CARD = { width: 76, height: 114 };
const DEAL_STAGGER_MS = 55;
const DEAL_MS = 260;
const TRAVEL_MS = 300;
const TRAVEL_STAGGER_MS = 45;
const LAYER_DEPTH = 31;
const TONE_COLOR: Record<NumberTone, string> = { preen: '#ffd76a', buff: '#86f7a8', reduced: '#ff9a86' };
const SHEEN_TEXTURE = 'card-rarity-sheen';
const SHEEN_CYCLE_MS = 4400;
const SHEEN_SWEEP_MS = 1150;

/** Under the phone-landscape lens the camera is zoomed, so drags follow the
 * pointer in world space; elsewhere screen and world coincide. */
const pointerPoint = (pointer: Phaser.Input.Pointer) => document.documentElement.dataset.layout === 'compact'
  ? { x: pointer.worldX, y: pointer.worldY } : { x: pointer.x, y: pointer.y };

export class CardObjectStage {
  readonly layer: Phaser.GameObjects.Container;
  /** Where the played card landed; its trip to a pile starts here. */
  landing?: Point & { scale: number };
  /** Counters for diagnostics and tests. */
  readonly counts = { deals: 0, departures: 0, burns: 0, denials: 0, drags: 0, drops: 0, returns: 0 };
  /** What the opening deal did, for diagnostics and tests: the cards it dealt,
   * whether the encounter intro had played first, and each card's start delay. */
  opening?: { cards: number; afterIntro: boolean; delays: number[] };
  private pendingDeals = new Map<string, { index: number; at: number; from: Point }>();
  /** Cards still in the air: leaving a pile (shown as still in it) or on their way to one. */
  private leaving: Record<Pile, number> = { DRAW: 0, DISCARD: 0 };
  private arriving: Record<Pile, number> = { DRAW: 0, DISCARD: 0 };
  private tickedAt: Record<Pile, number> = { DRAW: -1e9, DISCARD: -1e9 };
  private pilesDirty = false;
  private opened = false;
  private sawIntro = false;
  private timers: Array<{ at: number; run: () => void }> = [];
  private sheens = new Set<Phaser.GameObjects.TileSprite>();
  private drag?: { id: string; origin: Point; last: Point; tilt: number; active: boolean; target: DropTarget; stop: () => void };
  private reticle: Phaser.GameObjects.Graphics;
  private scene: Host;

  constructor(scene: Phaser.Scene) {
    this.scene = scene as Host;
    this.layer = scene.add.container(0, 0).setDepth(LAYER_DEPTH).setName('combat-card-objects');
    this.reticle = scene.add.graphics().setName('combat-drag-target');
    this.layer.add(this.reticle);
    const tick = () => this.tick();
    scene.events.on('postupdate', tick);
    scene.events.on('clock-advanced', tick);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off('postupdate', tick);
      scene.events.off('clock-advanced', tick);
      this.drag?.stop();
      if (this.scene.cardObjects === this) delete this.scene.cardObjects;
    });
  }

  private get clock() { return battleActors(this.scene).time; }
  private get still() { return prefersReducedMotion(); }
  private after(ms: number, run: () => void) { this.timers.push({ at: this.clock + ms, run }); }

  private tick() {
    const now = this.clock;
    if (this.timers.length) {
      const due = this.timers.filter(timer => timer.at <= now);
      if (due.length) { this.timers = this.timers.filter(timer => timer.at > now); due.forEach(timer => timer.run()); }
    }
    if (!this.opened) this.openingDeal();
    this.refreshPiles(now);
    if (this.sheens.size) this.sweepSheens(now);
  }

  // ---- deal ---------------------------------------------------------------

  /** Cards just drawn. Each flies from the pile to its slot when the hand next
   * reconciles. Returns true: the real cards replace the stand-in card backs. */
  deal(ids: string[], from?: Point, counted = !from) {
    if (this.still || !ids.length) return true;
    const origin = from ?? this.scene.drawPilePos();
    ids.forEach((id, index) => {
      this.pendingDeals.set(id, { index, at: this.scene.time.now, from: origin });
      if (!counted) return;
      // The counter keeps a dealt card until it actually leaves the pile.
      this.leaving.DRAW += 1;
      this.after(index * DEAL_STAGGER_MS + 30, () => { this.leaving.DRAW -= 1; this.tickedAt.DRAW = this.clock; });
    });
    this.pilesDirty = true;
    this.counts.deals += ids.length;
    return true;
  }

  /**
   * The opening hand is drawn before anything can show it, under the encounter
   * intro. Deal it once, when the intro has cleared and the hand is on screen.
   * The pile counter already shows the settled count and is left alone.
   */
  private openingDeal() {
    const host = this.scene, stage = battleActors(host), ids = stage.hand.order;
    // The first hand render usually precedes the intro; wait until one has played.
    if (host.combatIntroActive) { this.sawIntro = true; return; }
    if (!this.sawIntro || host.mode !== 'battle' || !host.handLayer?.visible || !ids.length) return;
    this.opened = true;
    this.deal(ids, undefined, false);
    const delays: number[] = [];
    for (const id of ids) {
      const actor = stage.actors.get(`card:${id}`);
      const delay = actor ? this.arrive(id, actor) : undefined;
      if (delay !== undefined) delays.push(delay);
    }
    this.opening = { cards: ids.length, afterIntro: this.sawIntro, delays };
  }

  /** A card's body has just been created in the hand. Returns the deal's
   * start delay when a deal motion was played. */
  arrive(id: string, actor: BattleActor): number | undefined {
    const deal = this.pendingDeals.get(id);
    if (!deal) return undefined;
    this.pendingDeals.delete(id);
    if (this.still || this.scene.time.now - deal.at > 1500) return undefined;
    const dx = deal.from.x - actor.slot.x, dy = deal.from.y - actor.slot.y;
    actor.settle.y = 0;
    battleActors(this.scene).play(actor.id, {
      name: 'deal', channel: 'action', delay: deal.index * DEAL_STAGGER_MS, from: [dx, dy, -0.82, -0.82, -16],
      keys: [[DEAL_MS * 0.5, dx * 0.42, dy * 0.42 - 46, -0.4, -0.4, -6, ACTOR_EASE.quadOut], [DEAL_MS * 0.5, 0, 0, 0, 0, 0, ACTOR_EASE.backOut]],
    });
    return deal.index * DEAL_STAGGER_MS;
  }

  // ---- leaving the hand -----------------------------------------------------

  /** Which pile a card that left the hand went to. */
  fateOf(id: string): CardFate | undefined {
    const host = this.scene, holds = (pile?: Card[]) => Boolean(pile?.some(card => card.instanceId === id));
    return holds(host.discardPile) ? 'discard' : holds(host.clearedPile) ? 'exhaust' : holds(host.drawPile) ? 'draw' : undefined;
  }

  /** A hand card's objects leave the hand as one body and travel to their pile. */
  depart(id: string, objects: Phaser.GameObjects.GameObject[], fate: CardFate | undefined, index: number) {
    const host = this.scene, stage = battleActors(host), slot = stage.actors.get(`card:${id}`)?.slot;
    const pose = releaseCardBody(stage, id, objects);
    if (!fate || !slot || this.still || !this.layer.active) { for (const object of objects) object.destroy(); return; }
    const body = host.add.container(slot.x + pose.x, slot.y + pose.y).setScale(pose.scaleX, pose.scaleY).setAngle(pose.angle);
    for (const object of objects as Array<Phaser.GameObjects.Rectangle>) {
      if (object.input) object.disableInteractive();
      object.x -= slot.x; object.y -= slot.y;
      body.add(object);
    }
    this.sendOff(body, id, fate, index * TRAVEL_STAGGER_MS, CARD_W, CARD_H);
  }

  /** The played card, after it landed: on to the discard pile, back into the
   * draw pile, or burned away if it was cleared for this combat. */
  settle(card: Card, fate: CardFate, fallbackX = GAME_WIDTH / 2) {
    const host = this.scene, at = this.landing ?? { x: fallbackX, y: HAND_Y, scale: 1 };
    this.landing = undefined;
    if (this.still || !this.layer.active) return;
    // Played without a throw (no resolve delay): its hand card is still on
    // screen and leaves for the pile itself at the next reconcile.
    if ((host.handCardRects as Map<string, Phaser.GameObjects.Rectangle> | undefined)?.get(card.instanceId)?.visible) return;
    const body = host.add.container(at.x, at.y).setScale(at.scale).setData('played', true);
    paintFlightCard(host, body, card);
    this.sendOff(body, card.instanceId, fate, 0, FLIGHT_CARD.width, FLIGHT_CARD.height);
  }

  private sendOff(body: Phaser.GameObjects.Container, id: string, fate: CardFate, delay: number, width: number, height: number) {
    const host = this.scene;
    body.setName('combat-card-departing').setData('fate', fate).setData('cardId', id);
    this.layer.add(body);
    body.once(Phaser.GameObjects.Events.DESTROY, () => host.tweens.killTweensOf(body));
    if (fate === 'exhaust') { this.burn(body, delay, width, height); return; }
    const pile: Pile = fate === 'draw' ? 'DRAW' : 'DISCARD';
    const to: Point = fate === 'draw' ? host.drawPilePos() : host.discardPilePos();
    const from = { x: body.x, y: body.y }, scale = body.scaleX, angle = body.angle;
    const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 60 };
    const end = 30 / width, spin = to.x >= from.x ? 22 : -22;
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      this.arriving[pile] -= 1;
      this.tickedAt[pile] = this.clock;
      this.pilesDirty = true;
    };
    this.arriving[pile] += 1;
    this.pilesDirty = true;
    this.counts.departures += 1;
    body.once(Phaser.GameObjects.Events.DESTROY, land);
    const flight = { t: 0 };
    host.tweens.add({
      targets: flight, t: 1, delay, duration: TRAVEL_MS, ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (!body.active) return;
        const point = flightPoint(from, control, to, flight.t);
        body.setPosition(point.x, point.y).setScale(scale + (end - scale) * flight.t).setAngle(angle + spin * flight.t)
          .setAlpha(flight.t > 0.82 ? 1 - (flight.t - 0.82) / 0.18 * 0.7 : 1);
      },
      onComplete: () => body.destroy(),
    });
    body.once(Phaser.GameObjects.Events.DESTROY, () => host.tweens.killTweensOf(flight));
  }

  /** A cleared card does not travel: it chars from the edges, lifts and is gone. */
  private burn(body: Phaser.GameObjects.Container, delay: number, width: number, height: number) {
    const host = this.scene, soft = currentFlashEffectsState().reduced;
    this.counts.burns += 1;
    body.setData('burning', true);
    const char = host.add.rectangle(0, 0, width, height, 0x1a0a04, 1).setAlpha(0).setName('combat-card-burn-char');
    const ember = host.add.rectangle(0, 0, width, height, 0xff6a1e, 1).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setName('combat-card-burn-glow');
    body.add([char, ember]);
    const scale = body.scaleX;
    host.tweens.add({ targets: ember, alpha: soft ? 0.24 : 0.5, delay, duration: 120, ease: 'Quad.easeOut', yoyo: true, hold: 70 });
    host.tweens.add({ targets: char, alpha: 0.8, delay: delay + 70, duration: 260, ease: 'Quad.easeIn' });
    host.tweens.add({
      targets: body, y: body.y - 34, scaleX: scale * 0.8, scaleY: scale * 0.34, alpha: 0, angle: body.angle + 5,
      delay: delay + 150, duration: 340, ease: 'Quad.easeIn', onComplete: () => body.destroy(),
    });
    const sparks = prefersLeanEffects() ? 5 : 11, reach = scale;
    for (let i = 0; i < sparks; i += 1) {
      const spark = host.add.rectangle(body.x + (Math.random() - 0.5) * width * reach, body.y + (Math.random() - 0.3) * height * reach * 0.8,
        3 + Math.random() * 3, 3 + Math.random() * 3, [0xffb347, 0xff6a2a, 0xffe08a][i % 3], 1).setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD).setName('combat-card-burn-spark');
      this.layer.add(spark);
      host.tweens.add({
        targets: spark, y: spark.y - 46 - Math.random() * 60, x: spark.x + (Math.random() - 0.5) * 36, alpha: { from: 0.95, to: 0 },
        angle: 180, delay: delay + 90 + Math.random() * 180, duration: 340 + Math.random() * 220, ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
      spark.once(Phaser.GameObjects.Events.DESTROY, () => host.tweens.killTweensOf(spark));
    }
    for (const part of [char, ember]) part.once(Phaser.GameObjects.Events.DESTROY, () => host.tweens.killTweensOf(part));
  }

  // ---- pile counters --------------------------------------------------------

  /** What the pile counter shows while cards are in the air. */
  shownPileCount(pile: Pile) {
    const host = this.scene, real = (pile === 'DRAW' ? host.drawPile : host.discardPile)?.length ?? 0;
    return Math.max(0, real + this.leaving[pile] - this.arriving[pile]);
  }

  private refreshPiles(now: number) {
    const piles: Pile[] = ['DRAW', 'DISCARD'];
    const busy = piles.some(pile => this.leaving[pile] || this.arriving[pile] || now - this.tickedAt[pile] < 200);
    if (!busy && !this.pilesDirty) return;
    this.pilesDirty = busy;
    for (const object of (this.scene.root?.list ?? []) as Phaser.GameObjects.Text[]) {
      if (object.name !== 'combat-pile-count') continue;
      const pile = object.getData('pile') as Pile, shown = this.shownPileCount(pile), text = `${shown}`;
      if (object.text !== text) object.setText(text);
      object.setColor(now - this.tickedAt[pile] < 200 ? '#fff3c4' : shown ? '#e4eff2' : '#889ba5');
    }
  }

  // ---- refusal --------------------------------------------------------------

  /** A short sideways shake on a card that cannot be played. */
  deny(id: string) {
    this.counts.denials += 1;
    const { quadOut, sineInOut } = ACTOR_EASE;
    battleActors(this.scene).play(`card:${id}`, { name: 'deny', channel: 'react', keys: [
      [45, -8, 0, 0, 0, -2, quadOut], [70, 7, 0, 0, 0, 1.6, sineInOut], [60, -5, 0, 0, 0, -1, sineInOut],
      [55, 3, 0, 0, 0, 0.5, sineInOut], [60, 0, 0, 0, 0, 0, quadOut],
    ] });
  }

  // ---- drag to play ---------------------------------------------------------

  /**
   * Called after the scene has handled a press on a hand card. If that press
   * selected a playable card, moving the pointer drags it. Releasing over a
   * valid target plays it through the scene's own click handlers; anywhere
   * else returns it and clears the selection the press made.
   */
  armDrag(id: string, pointer?: Phaser.Input.Pointer) {
    const host = this.scene;
    if (!pointer?.isDown || this.drag || host.selectedInstanceId !== id || host.discardChoice || host.combatInteractionLocked()) return;
    const card = (host.hand as Card[]).find(entry => entry.instanceId === id);
    if (!card || host.effectiveCost(card) > host.energy) return;
    const input = host.input, mine = (event: Phaser.Input.Pointer) => event.id === pointer.id;
    const move = (event: Phaser.Input.Pointer) => { if (mine(event)) this.dragMove(event); };
    const up = (event: Phaser.Input.Pointer) => { if (mine(event)) this.dragEnd(true); };
    const cancel = () => this.dragEnd(false);
    input.on('pointermove', move).on('pointerup', up).on('pointerupoutside', up).on('gameout', cancel);
    const origin = pointerPoint(pointer);
    this.drag = { id, origin, last: origin, tilt: 0, active: false, target: undefined,
      stop: () => input.off('pointermove', move).off('pointerup', up).off('pointerupoutside', up).off('gameout', cancel) };
  }

  get dragging() { return this.drag?.active ? this.drag.id : undefined; }
  get dragTarget() { return this.drag?.active ? this.drag.target : undefined; }

  private dragCard() {
    const drag = this.drag;
    return drag ? (this.scene.hand as Card[]).find(entry => entry.instanceId === drag.id) : undefined;
  }

  private enemyRects(): DropRect[] {
    const host = this.scene, rects: DropRect[] = [];
    for (const object of (host.root?.list ?? []) as Phaser.GameObjects.Rectangle[]) {
      if (object.name !== 'combat-enemy-hit' || !object.active) continue;
      const id = object.getData('enemyId') as string;
      if (!host.enemies?.some((enemy: any) => enemy.id === id && enemy.hp > 0)) continue;
      const bounds = object.getBounds();
      rects.push({ id, left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom });
    }
    return rects;
  }

  private flockRect(): DropRect | undefined {
    const hit = this.scene.root?.getByName('combat-leader-hit') as Phaser.GameObjects.Rectangle | null;
    if (!hit) return undefined;
    const bounds = hit.getBounds();
    return { id: 'flock', left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
  }

  private dragMove(pointer: Phaser.Input.Pointer) {
    const host = this.scene, drag = this.drag, card = this.dragCard();
    const stage = battleActors(host), actor = drag && stage.actors.get(`card:${drag.id}`);
    if (!drag || !card || !actor || host.selectedInstanceId !== drag.id || host.combatInteractionLocked()) { this.dragEnd(false); return; }
    const point = pointerPoint(pointer);
    if (!drag.active) {
      if (!dragStarted(drag.origin, point)) return;
      drag.active = true;
      this.counts.drags += 1;
      host.hideCardPreview?.();
      raiseHandCard(host, drag.id);
    }
    drag.tilt += (Phaser.Math.Clamp((point.x - drag.last.x) * 0.9, -9, 9) - drag.tilt) * 0.35;
    drag.last = point;
    // The card rides just under the pointer so the target stays in view.
    stage.hand.dragged = this.still ? undefined : { id: drag.id, x: point.x - actor.slot.x, y: point.y - actor.slot.y + 28, tilt: drag.tilt };
    const target = host.activeCardContract(card).target as string, enemies = this.enemyRects();
    drag.target = dropTarget(target, point, enemies, DRAG_FIELD);
    this.drawTargets(target, enemies, drag.target);
  }

  private drawTargets(target: string, enemies: DropRect[], over: DropTarget) {
    const g = this.reticle.clear(), flock = this.flockRect();
    const zones = target === 'enemy' || target === 'allEnemies' ? enemies : flock ? [flock] : [];
    this.layer.bringToTop(g);
    g.setData('target', over?.kind === 'enemy' ? over.id : over?.kind).setData('zones', zones.map(zone => zone.id));
    for (const zone of zones) {
      const lit = over?.kind === 'field' || (over?.kind === 'enemy' && over.id === zone.id);
      const w = zone.right - zone.left, h = zone.bottom - zone.top, tick = 22;
      if (lit) g.fillStyle(0xffe08a, 0.1).fillRoundedRect(zone.left, zone.top, w, h, 12);
      g.lineStyle(lit ? 3 : 2, lit ? 0xffe08a : 0x8df4ff, lit ? 1 : 0.34);
      // Corner brackets: a drop zone, not a selection outline.
      for (const [x, y, sx, sy] of [[zone.left, zone.top, 1, 1], [zone.right, zone.top, -1, 1], [zone.left, zone.bottom, 1, -1], [zone.right, zone.bottom, -1, -1]]) {
        g.beginPath(); g.moveTo(x, y + sy * tick); g.lineTo(x, y); g.lineTo(x + sx * tick, y); g.strokePath();
      }
      if (lit) g.lineStyle(1, 0xffe08a, 0.5).strokeRoundedRect(zone.left, zone.top, w, h, 12);
    }
  }

  private dragEnd(released: boolean) {
    const host = this.scene, drag = this.drag;
    if (!drag) return;
    drag.stop();
    this.drag = undefined;
    this.reticle.clear().setData('target', undefined).setData('zones', []);
    battleActors(host).hand.dragged = undefined;
    if (!drag.active) return; // a plain press: the click flow already handled it
    restoreHandOrder(host);
    const target = drag.target;
    if (released && target && host.selectedInstanceId === drag.id && !host.combatInteractionLocked()) {
      this.counts.drops += 1;
      // Exactly the confirm a second click would make.
      if (target.kind === 'enemy') host.onEnemyClicked(target.id);
      else host.onCardClicked(drag.id);
      return;
    }
    this.counts.returns += 1;
    if (host.selectedInstanceId === drag.id) {
      host.selectedInstanceId = undefined;
      host.hideCardPreview?.();
      host.requestBattleRender?.();
    }
  }

  // ---- rarity sheen ---------------------------------------------------------

  trackSheen(sheen: Phaser.GameObjects.TileSprite) {
    this.sheens.add(sheen);
    this.sweepSheens(this.clock);
  }

  private sweepSheens(now: number) {
    const still = this.still;
    for (const sheen of this.sheens) {
      if (!sheen.active) { this.sheens.delete(sheen); continue; }
      const phase = (now + (sheen.getData('offset') as number)) % SHEEN_CYCLE_MS, t = phase / SHEEN_SWEEP_MS;
      if (still || t >= 1) { if (sheen.alpha) sheen.setAlpha(0); continue; }
      const from = sheen.getData('from') as number, to = sheen.getData('to') as number;
      sheen.tilePositionX = from + (to - from) * t;
      sheen.setAlpha(Math.sin(Math.PI * t) * (sheen.getData('peak') as number));
    }
  }

  /** Read-only diagnostics. */
  debugState() {
    return {
      ...this.counts, dragging: this.dragging, dragTarget: this.dragTarget,
      pendingDeals: [...this.pendingDeals.keys()],
      departing: (this.layer.list as Phaser.GameObjects.Container[]).filter(object => object.name === 'combat-card-departing')
        .map(object => ({ cardId: object.getData('cardId'), fate: object.getData('fate'), played: Boolean(object.getData('played')), x: object.x, y: object.y, scale: object.scaleX })),
      piles: { DRAW: this.shownPileCount('DRAW'), DISCARD: this.shownPileCount('DISCARD') },
      sheens: [...this.sheens].filter(sheen => sheen.active).length,
    };
  }
}

/** A dragged card plays when released between the HUD and the hand. */
const DRAG_FIELD = { top: 96, bottom: HAND_Y - CARD_H / 2 - 24 };

/** The scene's card-object stage, created on first use. */
export function cardObjects(scene: Phaser.Scene): CardObjectStage {
  const host = scene as Host;
  return host.cardObjects ??= new CardObjectStage(scene);
}

function handBodies(host: Host, id?: string) {
  const rects = host.handCardRects as Map<string, Phaser.GameObjects.Rectangle> | undefined;
  return [...(rects ?? [])].filter(([key, rect]) => rect.active && (!id || key === id))
    .map(([, rect]) => (rect.getData('presentation') ?? []) as Phaser.GameObjects.GameObject[]);
}

function raiseHandCard(host: Host, id: string) {
  for (const objects of handBodies(host, id)) for (const object of objects) object.parentContainer?.bringToTop(object);
}

function restoreHandOrder(host: Host) {
  for (const objects of handBodies(host)) for (const object of objects) object.parentContainer?.bringToTop(object);
}

/** The small illustrated card used in the air: the played card's flight and
 * its trip to a pile share one look. */
export function paintFlightCard(host: Phaser.Scene, body: Phaser.GameObjects.Container, card: Card) {
  const key = loadedCardArtKey(host, card), accent = suitAccentColor(card), { width, height } = FLIGHT_CARD;
  body.add(host.add.rectangle(0, 0, width, height, 0x07101c, 0.96).setStrokeStyle(2, accent, 0.8));
  if (key && host.textures.exists(key)) {
    body.add(host.add.image(0, 0, key).setDisplaySize(width - 4, height - 6).setName('flock-action-canonical-art'));
  } else {
    body.add(host.add.text(0, 0, displayName(card), { fontFamily: UI_FONT, fontSize: '18px',
      color: '#fff1cf', wordWrap: { width: width - 4 }, align: 'center', resolution: 2 })
      .setOrigin(0.5).setName('flock-action-art-fallback'));
  }
}

// ---- card faces: rarity and number highlights --------------------------------

export function rarityOfCard(cardId: string): CardRarity {
  return cardRarity(cardLibrary[cardId]?.runtime.rarity);
}

/** Everything a hand face shows beyond its rules: rarity and which numbers to tint. */
export function handFaceInfo(scene: Phaser.Scene, instanceId: string) {
  const host = scene as Host;
  const card = [host.hand, host.drawPile, host.discardPile, host.clearedPile].flatMap((pile?: Card[]) => pile ?? [])
    .find(entry => entry.instanceId === instanceId);
  if (!card) return { rarity: 'common' as CardRarity, preened: [] as string[], modified: undefined, key: '' };
  const molting = Boolean(host.flock?.molt);
  const lines = (entry: Card) => activeCardContract(entry, molting).effects.map(effect => formatEffects([effect]));
  const preened = card.upgraded ? preenedNumberKeys(lines(card), lines({ ...card, upgraded: false, preenBranch: undefined })) : [];
  const flock = host.flock, damageBonus = host.scaledFlockStatBonus?.('damage') ?? 0, coverBonus = host.scaledFlockStatBonus?.('cover') ?? 0;
  const firstAttack = Boolean(host.firstAttackThisTurn && host.keystoneActive?.('quills'));
  const nest = card.runtime.suit === 'nests' ? host.pendingNestCoverBonus ?? 0 : 0;
  // Only what current status changes counts: passive flock bonuses are always on.
  const modified: StatusModifier | undefined = flock ? (kind, amount) => kind === 'damage'
    ? amount + cardDamageOutcome(amount, flock, 0, true, damageBonus, firstAttack).rawDamage - (amount + damageBonus)
    : amount + cardCoverOutcome(amount, flock, coverBonus, nest) - (amount + coverBonus) : undefined;
  const probe = modified ? [1, 4, 8, 12, 20].map(amount => `${modified('damage', amount)},${modified('cover', amount)}`).join(';') : '';
  return { rarity: cardRarity(card.runtime.rarity), preened, modified, key: `${preened.join('|')}#${probe}` };
}

/** Overlay the highlighted numbers on a rules label. The label's text is left
 * exactly as it was; each overlay sits on the digit it recolours. */
export function tintFaceNumbers(scene: Phaser.Scene, label: Phaser.GameObjects.Text, tints: NumberTint[]) {
  const overlays: Phaser.GameObjects.Text[] = [];
  label.setData('numberTints', tints.map(tint => ({ value: label.text.slice(tint.start, tint.start + tint.length), tone: tint.tone })));
  if (!tints.length) return overlays;
  const lines = label.getWrappedText(), style = label.style, source = label.text;
  const lineHeight = label.getTextMetrics().fontSize + style.strokeThickness + label.lineSpacing;
  style.syncFont(label.canvas, label.context);
  for (const tint of tints) {
    const at = locateTint(source, lines, tint);
    if (!at) continue;
    const x = label.x + label.context.measureText(lines[at.line].slice(0, at.column)).width;
    overlays.push(scene.add.text(x, label.y + at.line * lineHeight, source.slice(tint.start, tint.start + tint.length), {
      fontFamily: style.fontFamily, fontSize: style.fontSize, fontStyle: style.fontStyle, color: TONE_COLOR[tint.tone], resolution: 2,
    }).setName('combat-card-number-tint').setData('tone', tint.tone));
  }
  return overlays;
}

export function numberTintsFor(face: string, info: { preened: string[]; modified?: StatusModifier }) {
  return faceNumberTints(face, info.preened, info.modified);
}

const RARITY_INK: Record<CardRarity, { line: string; bright: string; width: number; bracket: number }> = {
  common: { line: 'rgba(164,178,194,0.5)', bright: '#c5d0dc', width: 1, bracket: 0 },
  uncommon: { line: 'rgba(146,222,204,0.8)', bright: '#d6fff5', width: 1.25, bracket: 15 },
  rare: { line: '#f0c050', bright: '#ffe69a', width: 1.75, bracket: 21 },
  legendary: { line: '#f6cf6a', bright: '#fff3c9', width: 2.5, bracket: 27 },
};

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
}

/** Procedural rarity frame: weight and ornament rise with rarity, so it reads
 * by shape as well as by colour. Drawn once per rarity and size. */
function rarityFrameTexture(scene: Phaser.Scene, rarity: CardRarity, width: number, height: number) {
  const key = `card-rarity-${rarity}-${width}x${height}`;
  if (scene.textures.exists(key)) return key;
  const S = 2, texture = scene.textures.createCanvas(key, width * S, height * S);
  if (!texture) return undefined;
  const ctx = texture.context, ink = RARITY_INK[rarity], inset = 5.5, w = width, h = height;
  ctx.scale(S, S);
  ctx.lineJoin = 'round';
  let stroke: string | CanvasGradient = ink.line, bright: string | CanvasGradient = ink.bright;
  if (rarity === 'legendary') {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    for (const [stop, color] of [[0, '#ffe08a'], [0.3, '#ff9fb4'], [0.55, '#c9a2ff'], [0.8, '#8fe6ff'], [1, '#ffe08a']] as const) gradient.addColorStop(stop, color);
    stroke = gradient; bright = gradient;
  }
  ctx.strokeStyle = stroke; ctx.lineWidth = ink.width;
  roundedPath(ctx, inset, inset, w - inset * 2, h - inset * 2, 6); ctx.stroke();
  if (rarity === 'legendary') {
    ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
    roundedPath(ctx, inset + 4, inset + 4, w - inset * 2 - 8, h - inset * 2 - 8, 4); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (ink.bracket) {
    const b = ink.bracket, e = 3.5;
    ctx.strokeStyle = bright; ctx.fillStyle = bright; ctx.lineCap = 'round';
    ctx.lineWidth = rarity === 'uncommon' ? 2.5 : 3;
    for (const [x, y, sx, sy] of [[e, e, 1, 1], [w - e, e, -1, 1], [e, h - e, 1, -1], [w - e, h - e, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x, y + sy * b); ctx.lineTo(x, y + sy * 5); ctx.quadraticCurveTo(x, y, x + sx * 5, y); ctx.lineTo(x + sx * b, y); ctx.stroke();
      if (rarity !== 'uncommon') diamond(ctx, x + sx * 9.5, y + sy * 9.5, rarity === 'legendary' ? 4 : 3.2);
    }
    if (rarity !== 'uncommon') { diamond(ctx, inset, h / 2, 3.6); diamond(ctx, w - inset, h / 2, 3.6); }
    if (rarity === 'legendary') {
      diamond(ctx, w / 2, inset, 4.6); diamond(ctx, w / 2 - 11, inset, 2.6); diamond(ctx, w / 2 + 11, inset, 2.6);
      diamond(ctx, w / 2, h - inset, 4.2);
    }
  }
  texture.refresh();
  return key;
}

function sheenTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(SHEEN_TEXTURE)) return SHEEN_TEXTURE;
  const texture = scene.textures.createCanvas(SHEEN_TEXTURE, 512, 4);
  if (!texture) return undefined;
  const ctx = texture.context, band = ctx.createLinearGradient(226, 0, 286, 0);
  band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.5, 'rgba(255,255,255,1)'); band.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band; ctx.fillRect(226, 0, 60, 4);
  texture.refresh();
  return SHEEN_TEXTURE;
}

/**
 * Add a rarity frame, and for rare and above a sheen that sweeps the face.
 * Returns the objects it made, frame first. The sheen keeps the frame's fixed
 * bounds: only its texture slides.
 */
export function addRarityFrame(scene: Phaser.Scene, cx: number, cy: number, width: number, height: number, rarityValue: unknown,
  options: { alpha?: number; sheen?: boolean; name?: string; phase?: number } = {}) {
  const rarity = cardRarity(rarityValue), made: Phaser.GameObjects.GameObject[] = [], name = options.name ?? 'card-rarity';
  const key = rarityFrameTexture(scene, rarity, Math.round(width), Math.round(height));
  if (!key) return made;
  made.push(scene.add.image(cx, cy, key).setDisplaySize(width, height).setAlpha(options.alpha ?? 1)
    .setName(`${name}-frame`).setData('rarity', rarity));
  const band = options.sheen !== false && rarityHasSheen(rarity) && !prefersLeanEffects() ? sheenTexture(scene) : undefined;
  if (band) {
    const sheen = scene.add.tileSprite(cx, cy, width - 12, height - 12, band).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
      .setName(`${name}-sheen`).setData('rarity', rarity)
      .setData('peak', (rarity === 'legendary' ? 0.34 : 0.22) * (options.alpha ?? 1)).setData('from', 316).setData('to', 196 - width - height * 0.45)
      .setData('offset', (options.phase ?? 0) * 620);
    sheen.tileRotation = -0.42;
    if (rarity === 'legendary') sheen.setTint(0xfff0c8);
    made.push(sheen);
    cardObjects(scene).trackSheen(sheen);
  }
  return made;
}

export const RARITY_LABEL: Record<CardRarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' };

/** The inspected card, large: centre of the reader's left column. */
export const INSPECT_FACE = { x: 262, y: 312, scale: 1.5 };

/**
 * Put the inspected card in the reader at one and a half times hand size, with
 * its rarity and flavor beneath. It grows out of the card's place in the hand
 * and returns there when the reader closes; the reader itself still opens and
 * closes at once, so nothing waits on the motion.
 */
export function mountInspectFace(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, source: { instanceId: string; id: string }, options: {
  label: string; rarity: CardRarity; fontFamily: string; boldFontStyle: string; fontSize: number | string; softColor: string;
  resolution: number; cardHeight: number; draw: (face: Phaser.GameObjects.Container) => void;
}) {
  const host = scene as Host, { rarity } = options;
  const face = scene.add.container(INSPECT_FACE.x, INSPECT_FACE.y).setScale(INSPECT_FACE.scale).setName('combat-card-detail-face');
  options.draw(face);
  for (const object of face.list as Phaser.GameObjects.Rectangle[]) {
    if (object.input) object.disableInteractive();
    if (object.name) object.setName(`inspect-${object.name}`);
  }
  const captionY = INSPECT_FACE.y + options.cardHeight * INSPECT_FACE.scale / 2 + 12;
  const caption = scene.add.text(INSPECT_FACE.x, captionY, `${RARITY_LABEL[rarity]} · ${options.label}`, {
    fontFamily: options.fontFamily, fontSize: options.fontSize, fontStyle: options.boldFontStyle, resolution: options.resolution,
    color: { common: '#c5d0dc', uncommon: '#b9f3e4', rare: '#ffe08a', legendary: '#ffd0f0' }[rarity],
  }).setOrigin(0.5, 0).setName('combat-card-detail-rarity');
  const flavor = scene.add.text(INSPECT_FACE.x, captionY + 30, '', {
    fontFamily: options.fontFamily, fontSize: options.fontSize, fontStyle: 'italic', color: options.softColor,
    resolution: options.resolution, align: 'center', wordWrap: { width: 284, useAdvancedWrap: true }, lineSpacing: 2,
  }).setOrigin(0.5, 0).setName('combat-card-detail-flavor');
  layer.add([face, caption, flavor]);
  layer.setData('rarity', rarity).setData('flavor', '');
  // Flavor lives with the Codex lore; it joins the reader when that arrives.
  void import('../codex-data').then(({ getCardFlavor }) => {
    const line = getCardFlavor(source.id)?.flavor;
    if (!line || !flavor.active) return;
    fitTextExcerpt(flavor, `\u201c${line}\u201d`, 3);
    layer.setData('flavor', line);
  }).catch(() => undefined);

  const rect = (host.handCardRects as Map<string, Phaser.GameObjects.Rectangle> | undefined)?.get(source.instanceId);
  const pose = battleActors(scene).actors.get(`card:${source.instanceId}`)?.pose;
  const home = rect?.active && rect.visible ? { x: rect.x + (pose?.x ?? 0), y: rect.y + (pose?.y ?? 0), scale: pose?.scaleX ?? 1, alpha: 1 }
    : { x: INSPECT_FACE.x, y: INSPECT_FACE.y + 36, scale: INSPECT_FACE.scale * 0.72, alpha: 0 };
  layer.setData('faceHome', home);
  if (prefersReducedMotion()) return;
  face.setPosition(home.x, home.y).setScale(home.scale).setAlpha(home.alpha);
  scene.tweens.add({ targets: face, x: INSPECT_FACE.x, y: INSPECT_FACE.y, scale: INSPECT_FACE.scale, alpha: 1, duration: 210, ease: 'Cubic.easeOut' });
  for (const label of [caption, flavor]) scene.tweens.add({ targets: label.setAlpha(0), alpha: 1, delay: 140, duration: 120 });
  for (const object of [face, caption, flavor]) object.once(Phaser.GameObjects.Events.DESTROY, () => scene.tweens.killTweensOf(object));
  const destroy = layer.destroy;
  layer.destroy = function (this: Phaser.GameObjects.Container, fromScene?: boolean) {
    // The scene closes readers with destroy(true), so only its own state tells a close from a shutdown.
    if (face.active && scene.sys.isActive() && cardObjects(scene).layer.active && !prefersReducedMotion()) {
      scene.tweens.killTweensOf(face);
      cardObjects(scene).layer.add(face.setName('combat-card-detail-return'));
      scene.tweens.add({ targets: face, x: home.x, y: home.y, scale: home.scale, alpha: home.alpha, duration: 170, ease: 'Cubic.easeIn',
        onComplete: () => face.destroy() });
    }
    destroy.call(this, fromScene);
  };
}
