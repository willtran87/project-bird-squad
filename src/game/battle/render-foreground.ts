import Phaser from 'phaser';

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
  bracePressure: number;
  hasDebuff: boolean;
  hasSupport: boolean;
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

function renderTargetReticle(context: BattleForegroundRenderContext, enemy: BattleForegroundEnemyView) {
  const { scene, target, reducedMotion, textures } = context;
  if (!scene.textures.exists(textures.targetReticle)) return;
  scene.textures.get(textures.targetReticle).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const width = (enemy.boss ? 316 : 274) * enemy.scale;
  const height = (enemy.boss ? 158 : 136) * enemy.scale;
  if (scene.textures.exists(textures.targetLockPulse)) {
    scene.textures.get(textures.targetLockPulse).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const pulse = scene.add.image(enemy.x, enemy.y + 8 * enemy.scale, textures.targetLockPulse)
      .setDisplaySize(width * 1.18, height * 1.28)
      .setAlpha(reducedMotion ? 0.2 : 0.3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('combat-target-lock-pulse');
    target.add(pulse);
    if (!reducedMotion) {
      scene.tweens.add({
        targets: pulse,
        alpha: 0.12,
        scaleX: pulse.scaleX * 1.075,
        scaleY: pulse.scaleY * 1.075,
        duration: 1180,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
  const reticle = scene.add.image(enemy.x, enemy.y + 8 * enemy.scale, textures.targetReticle)
    .setDisplaySize(width, height)
    .setAlpha(reducedMotion ? 0.44 : 0.56)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setName('combat-target-reticle');
  target.add(reticle);
  if (!reducedMotion) {
    scene.tweens.add({
      targets: reticle,
      alpha: 0.34,
      scaleX: reticle.scaleX * 1.035,
      scaleY: reticle.scaleY * 1.035,
      duration: 1040,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

function renderEnemy(context: BattleForegroundRenderContext, enemy: BattleForegroundEnemyView) {
  const { scene, target, textures, fontFamily, boldFontStyle } = context;
  const s = enemy.scale;
  const hasEnemyArt = Boolean(enemy.artKey && scene.textures.exists(enemy.artKey));
  const breathGroup = scene.add.container(enemy.x, enemy.y);
  const poseGroup = scene.add.container(0, 0);
  context.registerEnemyPose(enemy.id, poseGroup, s);
  breathGroup.add(poseGroup);
  if (enemy.selected) renderTargetReticle(context, enemy);
  if (enemy.guideTarget) {
    const guideY = enemy.y - 88 * s;
    target.add(scene.add.rectangle(enemy.x, guideY, 86 * s, 22 * s, 0x231d08, 0.94)
      .setStrokeStyle(2, 0xd8a840, 0.98)
      .setName('combat-first-target-guide'));
    target.add(scene.add.text(enemy.x, guideY, 'PLAY HERE', {
      fontFamily,
      fontSize: `${Math.round(10 * s)}px`,
      fontStyle: boldFontStyle,
      color: '#fff0b8',
    }).setOrigin(0.5).setName('combat-first-target-guide'));
  }

  poseGroup.add(scene.add.ellipse(
    0,
    enemy.artPlacement?.shadowY ?? 34 * s,
    enemy.artPlacement?.shadowW ?? 112 * s,
    enemy.artPlacement?.shadowH ?? 22 * s,
    0x020409,
    hasEnemyArt ? 0.38 : 0.26,
  ));
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
  if (scene.textures.exists(textures.enemyVitalsFrame)) {
    scene.textures.get(textures.enemyVitalsFrame).setFilter(Phaser.Textures.FilterMode.LINEAR);
    target.add(scene.add.image(hp.x, hp.y, textures.enemyVitalsFrame)
      .setDisplaySize(hp.w + 48 * s, 50 * s)
      .setAlpha(enemy.selected ? 0.72 : 0.6)
      .setName('combat-enemy-vitals-frame'));
  }
  target.add(scene.add.rectangle(hp.x, hp.y, hp.w, hp.h, 0x140d0d, 0.92)
    .setStrokeStyle(enemy.selected ? 3 : enemy.elite || enemy.boss ? 2 : 1, enemy.selected || enemy.elite || enemy.boss ? enemy.frameColor : 0x000000, enemy.selected || enemy.elite || enemy.boss ? 0.95 : 0.55));
  target.add(scene.add.rectangle(
    hp.x - hp.w / 2 + (hp.w * hpFraction) / 2,
    hp.y,
    Math.max(2, hp.w * hpFraction),
    hp.h - 6,
    hpFraction > 0.34 ? 0xb23b33 : 0xff5247,
    0.95,
  ));
  if (enemy.boss) {
    const phaseTwo = enemy.phase === 2;
    const phaseColor = phaseTwo ? 0xff9d4d : 0xf5c85b;
    target.add(scene.add.rectangle(hp.x, hp.y, 2 * s, hp.h - 4, phaseColor, 0.9)
      .setName('combat-boss-phase-threshold'));
    const phaseY = hp.y - 27 * s;
    const phasePanel = scene.add.rectangle(hp.x, phaseY, 188 * s, 20 * s, 0x11171e, 0.94)
      .setStrokeStyle(2, phaseColor, 0.96)
      .setName('combat-boss-phase-badge');
    target.add(phasePanel);
    target.add(scene.add.text(
      hp.x,
      phaseY,
      phaseTwo ? `PHASE II  /  ${enemy.phaseName ?? 'FINAL PATTERN'}` : 'PHASE I  /  SHIFTS AT 50%',
      {
        fontFamily,
        fontSize: `${Math.round(10 * s)}px`,
        fontStyle: boldFontStyle,
        color: phaseTwo ? '#ffd5ad' : '#fff1b8'
      }
    ).setOrigin(0.5).setName('combat-boss-phase-badge'));
  }
  target.add(scene.add.text(hp.x, hp.y, `${enemy.name.replace(/^The\s+/, '')}  ${enemy.hp}/${enemy.maxHp}`, {
    fontFamily,
    fontSize: `${Math.round((enemy.boss ? 15 : 18) * s)}px`,
    fontStyle: boldFontStyle,
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 4
  }).setOrigin(0.5));

  const isBrace = enemy.incomingDamage === 0 && enemy.bracePressure > 0;
  const ringColor = enemy.incomingDamage > 0
    ? (enemy.incomingDamage <= 6 ? 0xf5d38a : enemy.incomingDamage <= 10 ? 0xff9d4d : 0xff5247)
    : isBrace ? 0xffcf7a : enemy.hasSupport ? 0x8fd6a0 : 0xc98bff;
  const badgeValue = enemy.incomingDamage > 0 ? `${enemy.incomingDamage}` : isBrace ? `+${enemy.bracePressure}` : enemy.hasSupport ? '+' : '!';
  const bossEnemy = context.enemies.length > 1 ? context.enemies.find((candidate) => candidate.boss) : undefined;
  const intentSide = enemy.boss ? -1 : bossEnemy && enemy.x < bossEnemy.x ? -1 : enemy.x > context.width - 210 * s ? -1 : 1;
  const bx = enemy.x + intentSide * (hp.w / 2 + 38 * s);
  const by = hp.y;
  if (scene.textures.exists(textures.enemyIntentRing)) {
    scene.textures.get(textures.enemyIntentRing).setFilter(Phaser.Textures.FilterMode.LINEAR);
    target.add(scene.add.image(bx, by, textures.enemyIntentRing)
      .setDisplaySize(70 * s, 70 * s)
      .setAlpha(enemy.incomingDamage > 0 ? 0.88 : 0.68));
  }
  const badge = scene.add.circle(bx, by, 24 * s, 0x10171f, 0.96)
    .setStrokeStyle(enemy.incomingDamage >= 11 ? 5 : 3, ringColor, 1);
  context.attachTooltip(
    badge,
    enemy.moveLabel,
    enemy.incomingDamage > 0
      ? `Incoming attack: ${enemy.incomingDamage} damage${enemy.hasDebuff ? ' plus a debuff' : ''}.`
      : isBrace
        ? `Enemy winds up: next attack gains +${enemy.bracePressure} damage.`
        : 'Applies pressure - a debuff or special move.'
  );
  target.add(badge);
  target.add(scene.add.text(bx, by, badgeValue, {
    fontFamily,
    fontSize: `${Math.round(21 * s)}px`,
    fontStyle: boldFontStyle,
    color: '#ffffff'
  }).setOrigin(0.5));
  const intentIcon: BattleIntentIcon = enemy.incomingDamage > 0 ? 'attack' : isBrace ? 'brace' : enemy.hasSupport ? 'support' : 'pressure';
  const intentMark = context.addIntentIcon(intentIcon, bx, by + 32 * s, Math.round(13 * s));
  if (intentMark) target.add(intentMark.setAlpha(0.92));
  if (enemy.objective) {
    const objectiveActive = enemy.objective.status === 'active';
    const objectiveColor = objectiveActive ? 0xf5c85b : enemy.objective.status === 'complete' ? 0x7ee2a8 : 0xff7d72;
    const objectiveText = objectiveActive
      ? `OBJECTIVE  /  ${enemy.objective.remainingBeats} ${enemy.objective.remainingBeats === 1 ? 'BEAT' : 'BEATS'}`
      : enemy.objective.status === 'complete' ? 'OBJECTIVE COMPLETE' : 'OBJECTIVE MISSED';
    const objectiveY = hp.y - 34 * s;
    const objectiveWidth = 158 * s;
    const objectivePanel = scene.add.rectangle(hp.x, objectiveY, objectiveWidth, 23 * s, 0x11171e, 0.94)
      .setStrokeStyle(2, objectiveColor, 0.96)
      .setName('combat-objective-target');
    context.attachTooltip(objectivePanel, enemy.objective.title, enemy.objective.detail);
    target.add(objectivePanel);
    target.add(scene.add.text(hp.x, objectiveY, objectiveText, {
      fontFamily,
      fontSize: `${Math.round(10 * s)}px`,
      fontStyle: boldFontStyle,
      color: objectiveActive ? '#fff1b8' : enemy.objective.status === 'complete' ? '#b7f4d0' : '#ffd0ca'
    }).setOrigin(0.5).setName('combat-objective-target'));
  }
  if (enemy.hasDebuff && enemy.incomingDamage > 0) {
    target.add(scene.add.circle(bx + 20 * s, by - 17 * s, 7 * s, 0xc98bff, 1));
    target.add(scene.add.text(bx + 20 * s, by - 17 * s, '!', {
      fontFamily,
      fontSize: `${Math.round(12 * s)}px`,
      fontStyle: boldFontStyle,
      color: '#170f1e'
    }).setOrigin(0.5));
  }
  if (enemy.block > 0 || enemy.weak > 0) {
    const statusY = enemy.y + 95 * s;
    if (scene.textures.exists(textures.enemyStatusChipFrame)) {
      scene.textures.get(textures.enemyStatusChipFrame).setFilter(Phaser.Textures.FilterMode.LINEAR);
      target.add(scene.add.image(enemy.x, statusY, textures.enemyStatusChipFrame)
        .setDisplaySize(162 * s, 40 * s)
        .setAlpha(enemy.selected ? 0.84 : 0.7)
        .setName('combat-enemy-status-chip-frame'));
    }
    target.add(scene.add.text(enemy.x, statusY, enemy.status, {
      fontFamily,
      fontSize: `${Math.round(15 * s)}px`,
      fontStyle: boldFontStyle,
      color: '#f4ecd7',
      stroke: '#090b10',
      strokeThickness: 3
    }).setOrigin(0.5));
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
  context.enemies.forEach((enemy) => renderEnemy(context, enemy));
  renderLeader(context);
}
