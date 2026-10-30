import Phaser from 'phaser';
import { fitTextExcerpt } from '../text-excerpt';
import { artContact } from './art-grounding';
import type { enemyIntentLabel } from '../enemy-intent';

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
  presentEnemyMotion: (
    enemyId: string,
    breathGroup: Phaser.GameObjects.Container,
    poseGroup: Phaser.GameObjects.Container,
    scale: number
  ) => void;
  presentLeaderMotion: (
    breathGroup: Phaser.GameObjects.Container,
    poseGroup: Phaser.GameObjects.Container
  ) => void;
}

function fitSingleLine(label: Phaser.GameObjects.Text, source: string) {
  return fitTextExcerpt(label, source, 1);
}

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
  const breathGroup = scene.add.container(enemy.x, enemy.y)
    .setName('combat-enemy-art').setData('enemyId', enemy.id);
  const poseGroup = scene.add.container(0, 0);
  context.registerEnemyPose(enemy.id, poseGroup, s);
  breathGroup.add(poseGroup);
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
  if (!hasEnemyArt) {
    const body = scene.add.ellipse(0, 0, 174 * s, 136 * s, enemy.elite ? 0x5b3f6d : 0x6f4b35, 1)
      .setStrokeStyle(enemy.selected ? 5 : enemy.elite ? 4 : 2, enemy.frameColor, 1)
      .setInteractive({ useHandCursor: true });
    body.on('pointerdown', () => context.onEnemyClicked(enemy.id));
    poseGroup.add(body);
  }
  if (hasEnemyArt && enemy.artKey) {
    const art = scene.add.image(enemy.artPlacement?.artX ?? 0, enemy.artPlacement?.artY ?? -22 * s, enemy.artKey)
      .setName('combat-enemy-portrait')
      .setScale(enemy.artFit)
      // A restrained cool ambient fill reveals dark feather/workwear detail on
      // the night rooftops. Screen tint leaves existing highlights intact.
      .setTint(0x111822).setTintMode(Phaser.TintModes.SCREEN)
      .setAlpha(0.99);
    // Transparent export padding must not steal input from the HUD or another
    // enemy. The silhouette and the separate vitals are both selection targets.
    const bounds = enemy.artPlacement?.hitBounds;
    if (bounds) art.setInteractive(new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height), Phaser.Geom.Rectangle.Contains);
    else art.setInteractive();
    if (art.input) art.input.cursor = 'pointer';
    art.on('pointerdown', () => context.onEnemyClicked(enemy.id));
    poseGroup.add(art);
  } else {
    poseGroup.add(scene.add.triangle(68 * s, -10 * s, 0, 0, 22 * s, 8 * s, 0, 16 * s, 0xe7c36a, 1));
    poseGroup.add(scene.add.text(0, -10 * s, enemy.initials, {
      fontFamily,
      fontSize: `${Math.round(28 * s)}px`,
      fontStyle: boldFontStyle,
      color: '#1b1110'
    }).setOrigin(0.5));
  }
  target.add(breathGroup);
  context.presentEnemyMotion(enemy.id, breathGroup, poseGroup, s);
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
  const breathGroup = scene.add.container(leader.x, leader.y).setName('combat-leader-art');
  const poseGroup = scene.add.container(0, 0).setName('combat-leader-pose');
  breathGroup.add(poseGroup);
  if (hasLeaderArt && leader.artKey) {
    const source = scene.textures.get(leader.artKey).getSourceImage() as { width: number; height: number };
    const fit = leader.artFit, artY = leader.artY;
    const width = source.width * fit, height = source.height * fit;
    const contact = artContact(leader.artKey, 0, artY, width, height, { x: 0, y: 100, width: 112 });
    contactShadow(context, leader.x + contact.x, leader.y + contact.y, contact.width, 15, 'combat-leader-contact-shadow');
    poseGroup.add(scene.add.image(0, artY, leader.artKey).setName('combat-leader-portrait').setScale(fit).setAlpha(0.99));
  } else {
    contactShadow(context, leader.x, leader.y + 40, 112, 18, 'combat-leader-contact-shadow');
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
  // Stop the leader's inspection region above the fixed hand rail: hovering
  // or tapping a card must never be intercepted by the portrait's empty area.
  const hitbox = scene.add.rectangle(0, -36, 250, 264, 0x000000, 0.001)
    .setInteractive({ useHandCursor: true }).setName('combat-leader-hit');
  hitbox.on('pointerdown', context.onLeaderClicked);
  hitbox.on('pointerover', () => hitbox.setStrokeStyle(2, leader.stateAccent, 0.7));
  hitbox.on('pointerout', () => hitbox.setStrokeStyle());
  context.attachTooltip(hitbox, leader.name, `${leader.bird} leader. ${leader.signatureLabel} Click for Flock Stats.`);
  poseGroup.add(hitbox);
  target.add(breathGroup);
  context.presentLeaderMotion(breathGroup, poseGroup);
}

/** Render battle combatants, target affordances, vitals, and intent presentation. */
export function renderBattleForeground(context: BattleForegroundRenderContext) {
  context.enemies.forEach((enemy) => renderEnemyArt(context, enemy));
  renderLeader(context);
  // Container insertion order is the render order. Keep every status and Tell
  // above every combatant, including art belonging to a later front-row enemy.
  context.enemies.forEach((enemy) => renderEnemyLabels(context, enemy));
}
