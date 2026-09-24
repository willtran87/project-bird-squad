import Phaser from 'phaser';
import { fitTextExcerpt } from '../text-excerpt';
import type { enemyIntentLabel } from '../enemy-intent';

export interface BattleForegroundArtPlacement {
  artX: number;
  artY: number;
  hitboxY: number;
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

function enemyGroundY(context: BattleForegroundRenderContext, enemy: BattleForegroundEnemyView) {
  // Reviewed contact row in the 768×512 Roof Rat cutout. Its tail extends below
  // the front paws, so the full alpha bounds are not a valid floor anchor.
  if (enemy.artKey === 'enemy-roof_rat' && enemy.artPlacement) {
    const source = context.scene.textures.get(enemy.artKey).getSourceImage() as { height: number };
    return enemy.artPlacement.artY + source.height * enemy.artFit * (416 / 512 - 0.5) + 2 * enemy.scale;
  }
  return enemy.artPlacement?.shadowY ?? 34 * enemy.scale;
}

function renderTargetReticle(context: BattleForegroundRenderContext, enemy: BattleForegroundEnemyView) {
  // One grounded selection mark leaves character art and intent unobstructed.
  context.target.add(context.scene.add.ellipse(enemy.x, enemy.y + enemyGroundY(context, enemy),
    156 * enemy.scale, 36 * enemy.scale, 0x24d0d6, 0.08)
    .setStrokeStyle(2, 0x77d9df, 0.68).setName('combat-target-reticle').setData('enemyId', enemy.id));
}

function renderEnemyArt(context: BattleForegroundRenderContext, enemy: BattleForegroundEnemyView) {
  const { scene, target, fontFamily, boldFontStyle } = context;
  const s = enemy.scale;
  const hasEnemyArt = Boolean(enemy.artKey && scene.textures.exists(enemy.artKey));
  const breathGroup = scene.add.container(enemy.x, enemy.y)
    .setName('combat-enemy-art').setData('enemyId', enemy.id);
  const poseGroup = scene.add.container(0, 0);
  context.registerEnemyPose(enemy.id, poseGroup, s);
  breathGroup.add(poseGroup);
  if (enemy.selected) renderTargetReticle(context, enemy);
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

  poseGroup.add(scene.add.ellipse(
    0,
    enemyGroundY(context, enemy),
    enemy.artPlacement?.shadowW ?? 112 * s,
    enemy.artPlacement?.shadowH ?? 22 * s,
    0x020409,
    hasEnemyArt ? 0.38 : 0.26,
  ).setName('combat-enemy-contact-shadow').setData('enemyId', enemy.id));
  // The darkest crow art needs a little separation from the roof, not a generic
  // spotlight that competes with intent, target and impact cues.
  if (hasEnemyArt && /crow/i.test(enemy.artKey ?? '')) {
    poseGroup.add(scene.add.ellipse(0, -22 * s, 170 * s, 190 * s, 0x8fb2b7, 0.075)
      .setName('combat-enemy-silhouette-separation'));
  }
  const body = hasEnemyArt
    ? scene.add.rectangle(0, enemy.artPlacement?.hitboxY ?? -18 * s, 248 * s, 236 * s, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true })
    : scene.add.ellipse(0, 0, 174 * s, 136 * s, enemy.elite ? 0x5b3f6d : 0x6f4b35, 1)
      .setStrokeStyle(enemy.selected ? 5 : enemy.elite ? 4 : 2, enemy.frameColor, 1)
      .setInteractive({ useHandCursor: true });
  body.on('pointerdown', () => context.onEnemyClicked(enemy.id));
  poseGroup.add(body);
  if (hasEnemyArt && enemy.artKey) {
    const art = scene.add.image(enemy.artPlacement?.artX ?? 0, enemy.artPlacement?.artY ?? -22 * s, enemy.artKey)
      .setName('combat-enemy-portrait')
      .setScale(enemy.artFit)
      .setAlpha(0.99)
      .setInteractive({ useHandCursor: true });
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

function renderEnemyLabels(context: BattleForegroundRenderContext, enemy: BattleForegroundEnemyView) {
  const { scene, target, textures, fontFamily, boldFontStyle } = context;
  const s = enemy.scale;
  if (enemy.elite) {
    const crestY = enemy.y - 140 * s;
    if (scene.textures.exists(textures.eliteCrest)) {
      scene.textures.get(textures.eliteCrest).setFilter(Phaser.Textures.FilterMode.LINEAR);
      target.add(scene.add.image(enemy.x, crestY, textures.eliteCrest)
        .setDisplaySize(126 * s, 43 * s)
        .setAlpha(enemy.selected ? 0.94 : 0.82)
        .setName('combat-elite-crest'));
    }
    target.add(scene.add.rectangle(enemy.x, crestY - s, 58 * s, 18 * s, 0x101017, 0.96));
    target.add(scene.add.text(enemy.x, crestY - s, 'ELITE', {
      fontFamily,
      fontSize: `${Math.round(12 * s)}px`,
      fontStyle: boldFontStyle,
      color: '#fff1a8',
      stroke: '#21120a',
      strokeThickness: 3
    }).setOrigin(0.5));
  }

  const hp = enemy.hpBar;
  const hpFraction = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
  const filledWidth = Math.max(2, hp.w * hpFraction);
  const vitals = scene.add.rectangle(hp.x, hp.y - 12, hp.w + 8, 40, 0x0b151f, 0.97)
    .setStrokeStyle(1, enemy.selected ? enemy.frameColor : 0x627078, enemy.selected ? 0.72 : 0.32)
    .setName('combat-enemy-vitals').setData('enemyId', enemy.id);
  context.attachTooltip(vitals, enemy.name, `Cohesion ${enemy.hp}/${enemy.maxHp}. ${enemy.moveLabel}`);
  vitals.on('pointerdown', () => context.onEnemyClicked(enemy.id));
  target.add(vitals);
  target.add(scene.add.rectangle(hp.x, hp.y, hp.w, hp.h - 6, 0x34252c, 1)
    .setName('combat-enemy-health-track').setData('enemyId', enemy.id));
  target.add(scene.add.rectangle(
    hp.x - hp.w / 2 + filledWidth / 2,
    hp.y,
    filledWidth,
    hp.h - 6,
    hpFraction > 0.34 ? 0xc46d75 : 0xef746b,
    0.95,
  ).setName('combat-enemy-health-fill').setData('enemyId', enemy.id));
  target.add(scene.add.rectangle(hp.x - hp.w / 2, hp.y - hp.h / 2 + 3,
    Math.max(2, hp.w * hpFraction), 2, hpFraction > 0.34 ? 0xd47778 : 0xff8176, 0.8)
    .setOrigin(0, 0.5).setName('combat-enemy-health-edge'));
  if (enemy.boss) {
    const phaseTwo = enemy.phase === 2;
    const phaseColor = phaseTwo ? 0xff9d4d : 0xf5c85b;
    target.add(scene.add.rectangle(hp.x, hp.y, 2 * s, hp.h - 4, phaseColor, 0.9)
      .setName('combat-boss-phase-threshold'));
    const phaseY = hp.y - 78;
    const phaseWidth = Math.min(hp.w + 8, 244);
    const phasePanel = scene.add.rectangle(hp.x, phaseY, phaseWidth, 28, 0x11171e, 0.94)
      .setStrokeStyle(1, phaseColor, 0.64)
      .setName('combat-boss-phase-badge');
    target.add(phasePanel);
    const phaseText = phaseTwo ? `Phase II · ${enemy.phaseName ?? 'Final pattern'}` : 'Phase I · Shifts at 50%';
    context.attachTooltip(phasePanel, phaseTwo ? 'Boss phase II' : 'Boss phase I', phaseText);
    const phaseLabel = scene.add.text(
      hp.x,
      phaseY,
      phaseText,
      {
        fontFamily,
        fontSize: '16px',
        fontStyle: boldFontStyle,
        color: phaseTwo ? '#ffd5ad' : '#fff1b8', resolution: 2,
        wordWrap: { width: phaseWidth - 16, useAdvancedWrap: true }, maxLines: 1,
      }
    ).setOrigin(0.5).setName('combat-boss-phase-badge').setData('fullText', phaseText);
    target.add(fitSingleLine(phaseLabel, phaseText));
  }
  const value = scene.add.text(hp.x + hp.w / 2 - 4, hp.y - 19, `${enemy.hp}/${enemy.maxHp}`, {
    fontFamily,
    fontSize: `${Math.max(14, Math.round(13 * s))}px`,
    fontStyle: boldFontStyle,
    color: '#c8d4dc', resolution: 2,
  }).setOrigin(1, 0.5).setName('combat-enemy-hp-value').setData('enemyId', enemy.id);
  const nameWidth = Math.max(32, hp.w - value.width - 16);
  const label = scene.add.text(hp.x - hp.w / 2 + 4, hp.y - 19, '', {
    fontFamily, fontSize: `${Math.max(15, Math.round(14 * s))}px`,
    fontStyle: boldFontStyle, color: '#f2eee6', resolution: 2,
    wordWrap: { width: nameWidth, useAdvancedWrap: true }, maxLines: 1,
  }).setOrigin(0, 0.5).setName('combat-enemy-name').setData('enemyId', enemy.id);
  fitSingleLine(label, enemy.name.replace(/^The\s+/, '')).setData('fullName', enemy.name);
  target.add([label, value]);

  const intent = enemy.intent;
  const ringColor = enemy.incomingDamage > 0
    ? (enemy.incomingDamage <= 6 ? 0xf5d38a : enemy.incomingDamage <= 10 ? 0xff9d4d : 0xff5247)
    : intent.kind === 'cover' ? 0x7ab8d6 : intent.kind === 'charge' ? 0xffcf7a : intent.kind === 'support' ? 0x8fd6a0 : 0xc98bff;
  // One named Tell is anchored directly to its own vitals, never between enemies.
  const bx = hp.x;
  const by = hp.y - 47;
  const badge = scene.add.rectangle(bx, by, Math.min(hp.w, 176), 28, 0x10171f, 0.97)
    .setStrokeStyle(1, ringColor, 0.65)
    .setName('combat-enemy-intent-badge').setData('enemyId', enemy.id)
    .setData('description', enemy.moveDescription);
  context.attachTooltip(
    badge,
    enemy.moveLabel,
    `${enemy.incomingDamage > 0 ? `Projected attack: ${enemy.incomingDamage} damage. ` : ''}${enemy.moveDescription}`
  );
  target.add(badge);
  target.add(scene.add.text(bx, by, intent.label, {
    fontFamily,
    fontSize: '18px',
    fontStyle: boldFontStyle,
    color: '#ffffff', resolution: 2,
  }).setOrigin(0.5).setName('combat-enemy-intent-value').setData('enemyId', enemy.id));
  if (enemy.objective) {
    const objectiveActive = enemy.objective.status === 'active';
    const objectiveColor = objectiveActive ? 0xf5c85b : enemy.objective.status === 'complete' ? 0x7ee2a8 : 0xff7d72;
    const objectiveText = objectiveActive
      ? `Objective · ${enemy.objective.remainingBeats} ${enemy.objective.remainingBeats === 1 ? 'beat' : 'beats'}`
      : enemy.objective.status === 'complete' ? 'Objective complete' : 'Objective missed';
    const objectiveY = hp.y - (enemy.boss ? 110 : 78);
    const objectiveWidth = Math.min(hp.w + 8, 244);
    const objectivePanel = scene.add.rectangle(hp.x, objectiveY, objectiveWidth, 28, 0x11171e, 0.94)
      .setStrokeStyle(1, objectiveColor, 0.8)
      .setName('combat-objective-target');
    context.attachTooltip(objectivePanel, enemy.objective.title, enemy.objective.detail);
    target.add(objectivePanel);
    const objectiveLabel = scene.add.text(hp.x, objectiveY, objectiveText, {
      fontFamily,
      fontSize: '16px',
      fontStyle: boldFontStyle,
      color: objectiveActive ? '#fff1b8' : enemy.objective.status === 'complete' ? '#b7f4d0' : '#ffd0ca',
      resolution: 2, wordWrap: { width: objectiveWidth - 16, useAdvancedWrap: true }, maxLines: 1,
    }).setOrigin(0.5).setName('combat-objective-target').setData('fullText', objectiveText);
    target.add(fitSingleLine(objectiveLabel, objectiveText));
  }
  if (enemy.block > 0 || enemy.weak > 0) {
    const statusY = hp.y + 23;
    const panel = scene.add.rectangle(hp.x, statusY, hp.w + 8, 24, 0x0b151f, 0.97)
      .setName('combat-enemy-status-panel').setData('enemyId', enemy.id);
    context.attachTooltip(panel, enemy.name, enemy.status);
    panel.on('pointerdown', () => context.onEnemyClicked(enemy.id));
    const status = scene.add.text(hp.x, statusY, '', {
      fontFamily, fontSize: '16px', fontStyle: boldFontStyle, color: '#cfdee3', resolution: 2,
      wordWrap: { width: hp.w - 4, useAdvancedWrap: true }, maxLines: 1,
    }).setOrigin(0.5).setName('combat-enemy-status').setData('enemyId', enemy.id);
    target.add([panel, fitTextExcerpt(status, enemy.status, 1)]);
  }
}

function renderLeader(context: BattleForegroundRenderContext) {
  const { scene, target, leader, fontFamily, boldFontStyle, goldColor } = context;
  const hasLeaderArt = Boolean(leader.artKey && scene.textures.exists(leader.artKey));
  const breathGroup = scene.add.container(leader.x, leader.y);
  const poseGroup = scene.add.container(0, 0);
  breathGroup.add(poseGroup);
  poseGroup.add(scene.add.ellipse(0, 126, 172, 26, 0x020409, 0.42));
  if (hasLeaderArt && leader.artKey) {
    const source = scene.textures.get(leader.artKey).getSourceImage() as { width?: number; height?: number };
    const fit = Math.min(230 / Math.max(1, Number(source.width ?? 1)), 288 / Math.max(1, Number(source.height ?? 1)));
    poseGroup.add(scene.add.image(0, -18, leader.artKey).setScale(fit).setAlpha(0.99));
  } else {
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
  const hitbox = scene.add.rectangle(0, -18, 250, 300, 0x000000, 0.001)
    .setInteractive({ useHandCursor: true });
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
