import Phaser from 'phaser';
import { fitTextExcerpt } from '../text-excerpt';
import { artContact } from './art-grounding';
import type { enemyIntentLabel } from '../enemy-intent';
import { battleActors, type ActorBreath } from './actors';
import { combatLife } from './combat-life';

export interface BattleForegroundArtPlacement {
  artX: number;
  artY: number;
  hitBounds: { x: number; y: number; width: number; height: number };
  shadowY: number;
  shadowW: number;
  shadowH: number;
}

export interface BattleForegroundEnemyView {
  id: string;
  name: string;
  initials: string;
  hp: number;
  maxHp: number;
  block: number;
  weak: number;
  selected: boolean;
  guideTarget: boolean;
  elite: boolean;
  boss: boolean;
  phase: 1 | 2;
  phaseName?: string;
  x: number;
  y: number;
  scale: number;
  frameColor: number;
  hpBar: { x: number; y: number; w: number; h: number };
  artKey?: string;
  artFit: number;
  artPlacement?: BattleForegroundArtPlacement;
  moveLabel: string;
  incomingDamage: number;
  intent: ReturnType<typeof enemyIntentLabel>;
  moveDescription: string;
  status: string;
  objective?: {
    title: string;
    detail: string;
    status: 'active' | 'complete' | 'failed';
    remainingBeats: number;
  };
}

export interface BattleForegroundLeaderView {
  name: string;
  bird: string;
  signatureLabel: string;
  artKey?: string;
  artFit: number;
  artY: number;
  stateAccent: number;
  x: number;
  y: number;
}

export interface BattleForegroundTextureKeys {
  targetReticle: string;
  targetLockPulse: string;
  eliteCrest: string;
  enemyVitalsFrame: string;
  enemyStatusChipFrame: string;
  enemyIntentRing: string;
}

export type BattleIntentIcon = 'attack' | 'brace' | 'support' | 'pressure';

export interface BattleForegroundRenderContext {
  scene: Phaser.Scene;
  target: Phaser.GameObjects.Container;
  width: number;
  reducedMotion: boolean;
  fontFamily: string;
  boldFontStyle: string;
  goldColor: string;
  textures: BattleForegroundTextureKeys;
  enemies: BattleForegroundEnemyView[];
  leader: BattleForegroundLeaderView;
  onEnemyClicked: (enemyId: string) => void;
  onLeaderClicked: () => void;
  attachTooltip: (
    target: Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text,
    title: string,
    body: string
  ) => void;
  addIntentIcon: (icon: BattleIntentIcon, x: number, y: number, size: number) => Phaser.GameObjects.Image | undefined;
  registerEnemyPose: (enemyId: string, group: Phaser.GameObjects.Container, scale: number) => void;
  /** Top of a texture's visible pixels, as a share of its height. */
  textureTop: (key: string) => number;
}

/** Combatant bodies outlive the redraw. Each record is one retained container,
 * refilled only when its `sig` (art, fit, frame) changes and destroyed when the
 * combatant leaves play. */
interface RetainedBody { node: Phaser.GameObjects.Container; pose?: Phaser.GameObjects.Container; sig: string; seen: boolean }
interface RetainedStage { bodies: Map<string, RetainedBody>; parking: Phaser.GameObjects.Container }
const RETAINED = new WeakMap<Phaser.GameObjects.Container, RetainedStage>();

function retainedStage(context: BattleForegroundRenderContext) {
  let stage = RETAINED.get(context.target);
  if (!stage) {
    const parking = context.scene.add.container(0, 0).setVisible(false).setName('combat-actor-parking');
    stage = { bodies: new Map(), parking };
    RETAINED.set(context.target, stage);
    context.target.once(Phaser.GameObjects.Events.DESTROY, () => parking.destroy(true));
  }
  return stage;
}

/** Call before the immediate-mode layer is cleared: retained bodies step aside
 * and are re-seated, in draw order, by the next foreground render. */
export function parkBattleActors(target: Phaser.GameObjects.Container) {
  const stage = RETAINED.get(target);
  ((target.scene as any)?.combatLife as ReturnType<typeof combatLife> | undefined)?.park(target);
  if (!stage?.parking.active) return;
  for (const body of stage.bodies.values()) if (body.node.active) stage.parking.add(body.node);
}

function retainedBody(context: BattleForegroundRenderContext, key: string, name: string, x: number, y: number) {
  const stage = retainedStage(context);
  let body = stage.bodies.get(key);
  if (!body?.node.active) {
    body = { node: context.scene.add.container(x, y).setName(name), sig: '', seen: true };
    stage.bodies.set(key, body);
  }
  body.seen = true;
  return body;
}

/** A logical hit area: it sits on the slot and never follows the animated body. */
function slotHit(context: BattleForegroundRenderContext, x: number, y: number, width: number, height: number, name: string) {
  const hit = context.scene.add.rectangle(x, y, width, height, 0x000000, 0.001)
    .setInteractive({ useHandCursor: true }).setName(name);
  context.target.add(hit);
  return hit;
}

function fitSingleLine(label: Phaser.GameObjects.Text, source: string) {
  return fitTextExcerpt(label, source, 1);
}

const ENEMY_AMBIENT_TINT = 0x111822;

function identifyEnemy<T extends Phaser.GameObjects.GameObject>(object: T, name: string, enemyId: string) {
  return object.setName(name).setData('enemyId', enemyId);
}

function combatText(context: BattleForegroundRenderContext, x: number, y: number,
  text: string, fontSize: number, color: string, width?: number, origin = 0.5) {
  return context.scene.add.text(x, y, text, {
    fontFamily: context.fontFamily, fontStyle: context.boldFontStyle,
    fontSize, color, resolution: 2,
    ...(width === undefined ? {} : { wordWrap: { width, useAdvancedWrap: true }, maxLines: 1 }),
  }).setOrigin(origin, 0.5);
}

function enemyContact(context: BattleForegroundRenderContext, enemy: BattleForegroundEnemyView) {
  const fallback = { x: 0, y: enemy.artPlacement?.shadowY ?? 34 * enemy.scale,
    width: enemy.artPlacement?.shadowW ?? 112 * enemy.scale };
  if (!enemy.artKey || !enemy.artPlacement || !context.scene.textures.exists(enemy.artKey)) return fallback;
  const source = context.scene.textures.get(enemy.artKey).getSourceImage() as { width: number; height: number };
  return artContact(enemy.artKey, enemy.artPlacement.artX, enemy.artPlacement.artY,
    source.width * enemy.artFit, source.height * enemy.artFit, fallback);
}

function contactShadow(context: BattleForegroundRenderContext, x: number, y: number, width: number,
  height: number, name: string, enemyId?: string) {
  // Floor shadows belong to the stage, not the breathing/casting pose. Two quiet
  // layers soften the silhouette without adding a spotlight behind the character.
  context.target.add(context.scene.add.ellipse(x, y + 1, width * 1.16, height * 1.35, 0x020409, 0.12)
    .setName(`${name}-penumbra`).setData('enemyId', enemyId));
  context.target.add(context.scene.add.ellipse(x, y, width, height, 0x020409, 0.30)
    .setName(name).setData('enemyId', enemyId));
}

function renderEnemyArt(context: BattleForegroundRenderContext, enemy: BattleForegroundEnemyView) {
  const { scene, target, fontFamily, boldFontStyle } = context;
  const s = enemy.scale;
  const hasEnemyArt = Boolean(enemy.artKey && scene.textures.exists(enemy.artKey));
  const contact = enemyContact(context, enemy);
  const reticle = context.textures.targetReticle;
  const body = retainedBody(context, `enemy:${enemy.id}`, 'combat-enemy-art', enemy.x, enemy.y);
  const breathGroup = body.node.setData('enemyId', enemy.id);
  const placement = enemy.artPlacement;
  const sig = [hasEnemyArt && enemy.artKey, enemy.artFit, s, placement?.artX, placement?.artY,
    hasEnemyArt || enemy.selected, enemy.elite, enemy.frameColor].join('|');
  if (body.sig !== sig || !body.pose?.active) {
    breathGroup.removeAll(true);
    body.sig = sig;
    const pose = body.pose = scene.add.container(0, 0);
    breathGroup.add(pose);
    if (hasEnemyArt && enemy.artKey) {
      pose.add(scene.add.image(placement?.artX ?? 0, placement?.artY ?? -22 * s, enemy.artKey)
        .setName('combat-enemy-portrait')
        .setScale(enemy.artFit)
        // A restrained cool ambient fill reveals dark feather/workwear detail on
        // the night rooftops. Screen tint leaves existing highlights intact.
        .setTint(ENEMY_AMBIENT_TINT).setTintMode(Phaser.TintModes.SCREEN)
        .setAlpha(0.99));
    } else {
      pose.add(scene.add.ellipse(0, 0, 174 * s, 136 * s, enemy.elite ? 0x5b3f6d : 0x6f4b35, 1)
        .setStrokeStyle(enemy.selected ? 5 : enemy.elite ? 4 : 2, enemy.frameColor, 1));
      pose.add(scene.add.triangle(68 * s, -10 * s, 0, 0, 22 * s, 8 * s, 0, 16 * s, 0xe7c36a, 1));
      pose.add(scene.add.text(0, -10 * s, enemy.initials, {
        fontFamily,
        fontSize: `${Math.round(28 * s)}px`,
        fontStyle: boldFontStyle,
        color: '#1b1110'
      }).setOrigin(0.5));
    }
  }
  const poseGroup = body.pose!;
  // District stances (High Roost) treat the pose as new on every redraw and
  // ease it from neutral; hand them the same clean pose a rebuild used to.
  scene.tweens.killTweensOf(poseGroup);
  poseGroup.setAngle(0).data?.reset();
  const art = poseGroup.getByName('combat-enemy-portrait') as Phaser.GameObjects.Image | null;
  context.registerEnemyPose(enemy.id, poseGroup, s);
  // Authored enamel target art keeps its native proportions under the feet.
  if (enemy.selected && scene.textures.exists(reticle)) {
    target.add(scene.add.image(enemy.x + contact.x, enemy.y + contact.y, reticle)
      .setScale(s / 4).setName('combat-target-reticle'));
  }
  if (enemy.guideTarget) {
    const guideY = enemy.y - 88 * s;
    target.add(scene.add.circle(enemy.x, guideY, 13 * s, 0x231d08, 0.96)
      .setStrokeStyle(2, 0xd8a840, 0.98)
      .setName('combat-first-target-guide'));
    target.add(scene.add.text(enemy.x, guideY, '2', {
      fontFamily,
      fontSize: `${Math.round(12 * s)}px`,
      fontStyle: boldFontStyle,
      color: '#fff0b8',
    }).setOrigin(0.5).setName('combat-first-target-guide'));
  }

  contactShadow(context, enemy.x + contact.x, enemy.y + contact.y, contact.width,
    Math.min(18 * s, contact.width * 0.16), 'combat-enemy-contact-shadow', enemy.id);
  // The silhouette is a selection target, but its hit area belongs to the slot:
  // a lunge or recoil never moves what the player can click. Transparent export
  // padding stays outside it, so it cannot steal input from the HUD or a neighbour.
  let hitX = enemy.x, hitY = enemy.y, hitW = 174 * s, hitH = 136 * s, restTop = hitY, restBottom = enemy.y + contact.y;
  if (art) {
    const fit = enemy.artFit, bounds = placement?.hitBounds ?? { x: 0, y: 0, width: art.width, height: art.height };
    hitW = bounds.width * fit; hitH = bounds.height * fit;
    hitX = enemy.x + art.x + (bounds.x - art.width / 2) * fit + hitW / 2;
    hitY = enemy.y + art.y + (bounds.y - art.height / 2) * fit + hitH / 2;
    restTop = enemy.y + art.y + art.height * fit * (context.textureTop(art.texture.key) - 0.5);
    restBottom = hitY + hitH / 2;
  }
  identifyEnemy(slotHit(context, hitX, hitY, hitW, hitH, 'combat-enemy-hit'), 'combat-enemy-hit', enemy.id)
    .on('pointerdown', () => context.onEnemyClicked(enemy.id));
  target.add(breathGroup);
  // Reserve HUD clearance for the entire breathing envelope, not just its rest pose.
  let breath: ActorBreath | undefined;
  if (!context.reducedMotion) {
    const seed = [...enemy.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    // The lowest visible pixel stays planted; only the top of the body rises,
    // so nothing under the silhouette (its own vitals included) is approached.
    const anchor = restBottom - enemy.y + 0.5, stretch = 0.028 + (seed % 3) * 0.003;
    const rise = (anchor + Math.max(0, enemy.y - restTop)) * stretch;
    // Two pixels of margin also keep floating-point bounds clear of the 106px HUD edge.
    // In a cluster the ceiling may instead be another enemy's vitals stack.
    let ceiling = 108;
    for (const other of context.enemies) {
      const bar = other.hpBar, bottom = bar.y + (other.block > 0 || other.weak > 0 ? 40 : 15);
      if (other.id !== enemy.id && bottom <= restTop && bottom > ceiling
        && Math.abs(bar.x - hitX) < (bar.w + 8 + hitW) / 2) ceiling = bottom;
    }
    const strength = art ? Math.min(1, Math.max(0, restTop - ceiling) / Math.max(0.001, rise)) : 1;
    breath = { anchor, stretch: stretch * strength, squeeze: 0.008 + (seed % 2) * 0.002,
      period: 1500 + seed % 420, delay: seed % 420 };
  }
  battleActors(scene).bindNode(`enemy:${enemy.id}`, 'enemy', breathGroup, enemy.x, enemy.y, s, breath,
    art ? { image: art, from: ENEMY_AMBIENT_TINT, to: 0xb8b0a8 } : undefined);
}

function renderRankBadge(context: BattleForegroundRenderContext, enemy: BattleForegroundEnemyView,
  y: number, name: string, text: string, border: number, color: string, alpha = 0.64,
  fontSize = 16, labelName = name) {
  const { scene, target } = context;
  const width = Math.min(enemy.hpBar.w + 8, 244);
  const panel = identifyEnemy(scene.add.rectangle(enemy.hpBar.x, y, width, 28, 0x11171e, 0.94)
    .setStrokeStyle(1, border, alpha), name, enemy.id);
  const label = identifyEnemy(combatText(context, enemy.hpBar.x, y, text, fontSize, color, width - 16),
    labelName, enemy.id).setData('fullText', text);
  target.add([panel, fitSingleLine(label, text)]);
  return panel;
}

function renderEnemyLabels(context: BattleForegroundRenderContext, enemy: BattleForegroundEnemyView) {
  const { scene, target } = context;
  const s = enemy.scale;
  const hp = enemy.hpBar;
  if (enemy.elite) {
    // Rank belongs to the measured label stack, not a free-floating crest
    // above the portrait where small/back-row enemies can cross the top HUD.
    renderRankBadge(context, enemy, hp.y - 78, 'combat-elite-badge', 'Elite',
      0xd8a840, '#fff1a8', 0.64, 19, 'combat-elite-label');
  }

  const hpFraction = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
  const filledWidth = Math.max(2, hp.w * hpFraction);
  const vitals = identifyEnemy(scene.add.rectangle(hp.x, hp.y - 25, hp.w + 8, 76, 0x0b151f, 0.97)
    .setStrokeStyle(1, enemy.selected ? enemy.frameColor : 0x627078, enemy.selected ? 0.72 : 0.32),
    'combat-enemy-vitals', enemy.id);
  context.attachTooltip(vitals, enemy.name, `Cohesion ${enemy.hp}/${enemy.maxHp}. ${enemy.moveLabel}`);
  vitals.on('pointerdown', () => context.onEnemyClicked(enemy.id));
  target.add(vitals);
  target.add(identifyEnemy(scene.add.rectangle(hp.x, hp.y, hp.w, hp.h - 6, 0x34252c, 1)
    .setStrokeStyle(1, 0x7c6563, 0.4), 'combat-enemy-health-track', enemy.id));
  target.add(identifyEnemy(scene.add.rectangle(
    hp.x - hp.w / 2 + filledWidth / 2,
    hp.y,
    filledWidth,
    hp.h - 6,
    hpFraction > 0.34 ? 0xc46d75 : 0xef746b,
    0.95,
  ), 'combat-enemy-health-fill', enemy.id));
  if (enemy.boss) {
    const phaseTwo = enemy.phase === 2;
    const phaseColor = phaseTwo ? 0xff9d4d : 0xf5c85b;
    target.add(scene.add.rectangle(hp.x, hp.y, 2 * s, hp.h - 4, phaseColor, 0.9)
      .setName('combat-boss-phase-threshold'));
    const phaseText = phaseTwo ? `Phase II · ${enemy.phaseName ?? 'Final pattern'}` : 'Phase I · Shifts at 50%';
    const phasePanel = renderRankBadge(context, enemy, hp.y - 78, 'combat-boss-phase-badge',
      phaseText, phaseColor, phaseTwo ? '#ffd5ad' : '#fff1b8');
    context.attachTooltip(phasePanel, phaseTwo ? 'Boss phase II' : 'Boss phase I', phaseText);
  }
  const value = identifyEnemy(combatText(context, hp.x + hp.w / 2 - 4, hp.y - 20,
    `${enemy.hp}/${enemy.maxHp}`, 21, '#c8d4dc', undefined, 1), 'combat-enemy-hp-value', enemy.id);
  const nameWidth = Math.max(32, hp.w - value.width - 16);
  const label = identifyEnemy(combatText(context, hp.x - hp.w / 2 + 4, hp.y - 20, '', 21, '#f2eee6', nameWidth, 0),
    'combat-enemy-name', enemy.id);
  fitSingleLine(label, enemy.name.replace(/^The\s+/, '')).setData('fullName', enemy.name);
  target.add([label, value]);

  const intent = enemy.intent;
  const ringColor = enemy.incomingDamage > 0
    ? (enemy.incomingDamage <= 6 ? 0xf5d38a : enemy.incomingDamage <= 10 ? 0xff9d4d : 0xff5247)
    : intent.kind === 'cover' ? 0x7ab8d6 : intent.kind === 'charge' ? 0xffcf7a : intent.kind === 'support' ? 0x8fd6a0 : 0xc98bff;
  // One named Tell is anchored directly to its own vitals, never between enemies.
  const bx = hp.x;
  const by = hp.y - 48;
  const badge = identifyEnemy(scene.add.rectangle(bx, by, Math.min(hp.w, 176), 28, 0x10171f, 0.97)
    .setStrokeStyle(1, ringColor, 0.24), 'combat-enemy-intent-badge', enemy.id)
    .setData('description', enemy.moveDescription);
  context.attachTooltip(
    badge,
    enemy.moveLabel,
    `${enemy.incomingDamage > 0 ? `Projected attack: ${enemy.incomingDamage} damage. ` : ''}${enemy.moveDescription}`
  );
  target.add(badge);
  target.add(identifyEnemy(combatText(context, bx, by, intent.label, 21, '#ffffff'),
    'combat-enemy-intent-value', enemy.id));
  if (enemy.objective) {
    const objectiveActive = enemy.objective.status === 'active';
    const objectiveColor = objectiveActive ? 0xf5c85b : enemy.objective.status === 'complete' ? 0x7ee2a8 : 0xff7d72;
    const objectiveText = objectiveActive
      ? `Objective · ${enemy.objective.remainingBeats} ${enemy.objective.remainingBeats === 1 ? 'beat' : 'beats'}`
      : enemy.objective.status === 'complete' ? 'Objective complete' : 'Objective missed';
    const objectiveY = hp.y - (enemy.boss || enemy.elite ? 110 : 78);
    const objectivePanel = renderRankBadge(context, enemy, objectiveY, 'combat-objective-target',
      objectiveText, objectiveColor, objectiveActive ? '#fff1b8' : enemy.objective.status === 'complete' ? '#b7f4d0' : '#ffd0ca', 0.8);
    context.attachTooltip(objectivePanel, enemy.objective.title, enemy.objective.detail);
  }
  if (enemy.block > 0 || enemy.weak > 0) {
    const statusY = hp.y + 26;
    const panel = identifyEnemy(scene.add.rectangle(hp.x, statusY, hp.w + 8, 24, 0x0b151f, 0.97),
      'combat-enemy-status-panel', enemy.id);
    context.attachTooltip(panel, enemy.name, enemy.status);
    panel.on('pointerdown', () => context.onEnemyClicked(enemy.id));
    const status = identifyEnemy(combatText(context, hp.x, statusY, '', 19, '#cfdee3', hp.w - 4),
      'combat-enemy-status', enemy.id);
    target.add([panel, fitTextExcerpt(status, enemy.status, 1)]);
  }
}

function renderLeader(context: BattleForegroundRenderContext) {
  const { scene, target, leader, fontFamily, boldFontStyle, goldColor } = context;
  const hasLeaderArt = Boolean(leader.artKey && scene.textures.exists(leader.artKey));
  const body = retainedBody(context, 'flock', 'combat-leader-art', leader.x, leader.y);
  const breathGroup = body.node;
  const sig = [hasLeaderArt && leader.artKey, leader.artFit, leader.artY, hasLeaderArt || leader.stateAccent].join('|');
  const rebuild = body.sig !== sig || !body.pose?.active;
  if (rebuild) {
    breathGroup.removeAll(true);
    body.sig = sig;
    body.pose = scene.add.container(0, 0).setName('combat-leader-pose');
    breathGroup.add(body.pose);
  }
  const poseGroup = body.pose!;
  let foot = 40;
  if (hasLeaderArt && leader.artKey) {
    const source = scene.textures.get(leader.artKey).getSourceImage() as { width: number; height: number };
    const fit = leader.artFit, artY = leader.artY;
    const width = source.width * fit, height = source.height * fit;
    const contact = artContact(leader.artKey, 0, artY, width, height, { x: 0, y: 100, width: 112 });
    contactShadow(context, leader.x + contact.x, leader.y + contact.y, contact.width, 15, 'combat-leader-contact-shadow');
    foot = contact.y;
    if (rebuild) poseGroup.add(scene.add.image(0, artY, leader.artKey).setName('combat-leader-portrait').setScale(fit).setAlpha(0.99));
  } else {
    contactShadow(context, leader.x, leader.y + 40, 112, 18, 'combat-leader-contact-shadow');
    if (rebuild) {
      poseGroup.add(scene.add.ellipse(0, -18, 142, 118, 0x6f4b35, 0.96).setStrokeStyle(3, leader.stateAccent, 0.9));
      poseGroup.add(scene.add.triangle(52, -26, 0, 0, 28, 7, 0, 16, 0x1b1110, 1));
      poseGroup.add(scene.add.text(0, -18, 'FF', {
        fontFamily,
        fontSize: '28px',
        fontStyle: boldFontStyle,
        color: goldColor,
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5));
    }
  }
  target.add(breathGroup);
  // Stop the leader's inspection region above the fixed hand rail: hovering
  // or tapping a card must never be intercepted by the portrait's empty area.
  // Like every actor's hit area it stays on the slot while the body moves.
  const hitbox = slotHit(context, leader.x, leader.y - 36, 250, 264, 'combat-leader-hit');
  hitbox.on('pointerdown', context.onLeaderClicked);
  hitbox.on('pointerover', () => hitbox.setStrokeStyle(2, leader.stateAccent, 0.7));
  hitbox.on('pointerout', () => hitbox.setStrokeStyle());
  context.attachTooltip(hitbox, leader.name, `${leader.bird} leader. ${leader.signatureLabel} Click for Flock Stats.`);
  const portrait = poseGroup.getByName('combat-leader-portrait') as Phaser.GameObjects.Image | null;
  battleActors(scene).bindNode('flock', 'flock', breathGroup, leader.x, leader.y, 1,
    context.reducedMotion ? undefined : { anchor: foot, squeeze: 0.006, stretch: 0.014, period: 1700, delay: 0 },
    portrait ? { image: portrait, from: 0xffffff, to: 0xff9c8c } : undefined);
}

/** Render battle combatants, target affordances, vitals, and intent presentation. */
export function renderBattleForeground(context: BattleForegroundRenderContext) {
  const retained = retainedStage(context);
  for (const body of retained.bodies.values()) body.seen = false;
  context.enemies.forEach((enemy) => renderEnemyArt(context, enemy));
  renderLeader(context);
  const life = combatLife(context.scene);
  life.seatFlock(context.target);
  // A combatant that was not drawn this pass has left play.
  for (const [key, body] of retained.bodies) {
    if (body.seen) continue;
    body.node.destroy(true);
    retained.bodies.delete(key);
    battleActors(context.scene).retire(key);
  }
  // Container insertion order is the render order. Keep every status and Tell
  // above every combatant, including art belonging to a later front-row enemy.
  context.enemies.forEach((enemy) => renderEnemyLabels(context, enemy));
  // Status and intent badges, ghost health and body status effects: retained, seated above the labels.
  life.seatEnemies(context.target, context.enemies);
}
