import Phaser from 'phaser';
import { renderCardColorCue } from '../card-color-cues';
import { MIN_SUPPORTED_TOUCH_TARGET } from '../theme';

export type RewardCeremonyKind = 'card' | 'upgrade' | 'waymark';
export type RewardNeedRank = 'low' | 'steady' | 'strong';

export interface RewardDecisionPreview {
  kind: 'add' | 'preen';
  deckBefore: number;
  before: string;
  after: string;
  moltBefore: string;
  moltAfter: string;
  statChanges: string[];
}

export interface RewardDeckNeedView {
  guide: string;
  entries: Array<{ label: string; rank: RewardNeedRank; icon: string }>;
}

export interface RewardCardView {
  id: string;
  name: string;
  bird: string;
  cost: number;
  label: string;
  summary: string;
  molt: boolean;
  upgraded: boolean;
  accent: number;
  accentText: string;
  footerRows: string[];
  footerUsesObservations: boolean;
  decisionPreview: RewardDecisionPreview;
  collectionStatus?: { firstClaim: boolean; timesClaimed: number; targeted: boolean };
  artKey?: string;
  snag: boolean;
  focused: boolean;
}

export interface RewardWaymarkView {
  id: string;
  name: string;
  glyph: string;
  familyLabel: string;
  source: string;
  rarity: string;
  description: string;
  tags: string[];
  accent: number;
  artKey?: string;
  focused: boolean;
}

export interface RewardTextureKeys {
  ceremonyBackdrop: string;
  headerPlaque: string;
  choiceSpotlight: string;
  choiceGlowBurst: string;
  choiceHoverRing: string;
  choiceCardFrame: string;
  deckNeedChipFrame: string;
  skipCommandFrame: string;
  snagBorder: string;
}

export interface RewardCeremonyRenderContext {
  scene: Phaser.Scene;
  target: Phaser.GameObjects.Container;
  width: number;
  height: number;
  kind: RewardCeremonyKind;
  title: string;
  subtitle: string;
  reducedMotion: boolean;
  leanEffects: boolean;
  reinforcedColorCues: boolean;
  fontFamily: string;
  boldFontStyle: string;
  goldColor: string;
  cyanColor: string;
  softColor: string;
  textures: RewardTextureKeys;
  deckNeeds?: RewardDeckNeedView;
  cards?: RewardCardView[];
  waymarks?: RewardWaymarkView[];
  skip?: { scrap: number; deckSize: number; scrapAfter: number };
  addIcon: (icon: string, x: number, y: number, size: number) => Phaser.GameObjects.Image | undefined;
  onCardSelect: (cardId: string) => void;
  onCardHover: (cardId: string, x: number, y: number) => void;
  onCardOut: () => void;
  onWaymarkSelect: (waymarkId: string) => void;
  onSkip: () => void;
}

function addSpotlight(context: RewardCeremonyRenderContext, x: number, y: number, width: number, height: number, alpha: number) {
  const { scene, textures, reducedMotion, leanEffects } = context;
  if (!scene.textures.exists(textures.choiceSpotlight)) return undefined;
  scene.textures.get(textures.choiceSpotlight).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const spotlight = scene.add.image(x, y, textures.choiceSpotlight)
    .setDisplaySize(width, height)
    .setAlpha(reducedMotion ? Math.min(alpha, 0.14) : alpha)
    .setDepth(-8);
  if (!reducedMotion && !leanEffects) {
    scene.tweens.add({
      targets: spotlight,
      alpha: alpha * 0.58,
      scaleX: spotlight.scaleX * 1.015,
      scaleY: spotlight.scaleY * 1.015,
      y: y - 3,
      duration: 1480,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
  return spotlight;
}

function addGlowBurst(
  context: RewardCeremonyRenderContext,
  x: number,
  y: number,
  width: number,
  height: number,
  alphaValue: number,
  particleBurst: boolean
) {
  const { scene, textures, reducedMotion, leanEffects } = context;
  if (!scene.textures.exists(textures.choiceGlowBurst)) return { objects: [] as Phaser.GameObjects.GameObject[], burst: 0 };
  scene.textures.get(textures.choiceGlowBurst).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const animateDecor = !reducedMotion && !leanEffects;
  const alpha = reducedMotion ? Math.min(alphaValue, 0.16) : alphaValue;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const glow = scene.add.image(x, y, textures.choiceGlowBurst)
    .setDisplaySize(width, height)
    .setAlpha(alpha)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setName('reward-choice-glow-burst');
  objects.push(glow);
  if (!animateDecor) return { objects, burst: 0 };
  scene.tweens.add({
    targets: glow,
    alpha: alpha * 0.54,
    scaleX: glow.scaleX * 1.035,
    scaleY: glow.scaleY * 1.035,
    angle: 6,
    duration: 1420,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });
  if (!particleBurst) return { objects, burst: 0 };
  const emitter = scene.add.particles(x, y, textures.choiceGlowBurst, {
    emitting: false,
    frequency: -1,
    lifespan: { min: 460, max: 820 },
    speed: { min: 10, max: 42 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.055, end: 0.01, ease: 'Cubic.easeOut' },
    alpha: { start: 0.34, end: 0, ease: 'Cubic.easeIn' },
    rotate: { min: -34, max: 34 },
    blendMode: Phaser.BlendModes.ADD,
    maxParticles: 6,
    reserve: 6
  });
  emitter.explode(6);
  scene.time.delayedCall(900, () => {
    if (emitter.active) emitter.destroy();
  });
  objects.push(emitter);
  return { objects, burst: 1 };
}

function addChoiceFrame(context: RewardCeremonyRenderContext, x: number, y: number, width: number, height: number, alpha: number) {
  const { scene, textures, reducedMotion } = context;
  if (!scene.textures.exists(textures.choiceCardFrame)) return undefined;
  scene.textures.get(textures.choiceCardFrame).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const frame = scene.add.image(x, y, textures.choiceCardFrame)
    .setDisplaySize(width, height)
    .setAlpha(reducedMotion ? Math.min(alpha, 0.68) : alpha)
    .setName('reward-choice-card-frame');
  if (!reducedMotion) {
    scene.tweens.add({
      targets: frame,
      alpha: alpha * 0.86,
      scaleX: frame.scaleX * 1.004,
      scaleY: frame.scaleY * 1.004,
      duration: 1680,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
  return frame;
}

function addHoverRing(context: RewardCeremonyRenderContext, x: number, y: number, width: number, height: number) {
  const { scene, textures } = context;
  if (!scene.textures.exists(textures.choiceHoverRing)) return undefined;
  scene.textures.get(textures.choiceHoverRing).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return scene.add.image(x, y, textures.choiceHoverRing)
    .setDisplaySize(width, height)
    .setAlpha(0)
    .setVisible(false)
    .setName('reward-choice-hover-ring');
}

function showHoverRing(context: RewardCeremonyRenderContext, ring: Phaser.GameObjects.Image | undefined, width: number, height: number, alpha: number) {
  if (!ring) return;
  const { scene, reducedMotion } = context;
  scene.tweens.killTweensOf(ring);
  ring.setDisplaySize(width, height)
    .setAlpha(reducedMotion ? Math.min(alpha, 0.68) : alpha)
    .setAngle(0)
    .setVisible(true);
  if (!reducedMotion) {
    scene.tweens.add({
      targets: ring,
      alpha: alpha * 0.58,
      scaleX: ring.scaleX * 1.018,
      scaleY: ring.scaleY * 1.018,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
}

function hideHoverRing(context: RewardCeremonyRenderContext, ring: Phaser.GameObjects.Image | undefined) {
  if (!ring) return;
  context.scene.tweens.killTweensOf(ring);
  ring.setVisible(false).setAlpha(0);
}

function renderBackdrop(context: RewardCeremonyRenderContext) {
  const { scene, target, width, height, textures, reducedMotion, fontFamily, boldFontStyle, cyanColor, goldColor, softColor } = context;
  target.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x020409, 0.58));
  let hasCeremonyBackdrop = false;
  if (scene.textures.exists(textures.ceremonyBackdrop)) {
    scene.textures.get(textures.ceremonyBackdrop).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const backdrop = scene.add.image(width / 2, height / 2 + 10, textures.ceremonyBackdrop)
      .setDisplaySize(1224, 612)
      .setAlpha(reducedMotion ? 0.74 : 0.82)
      .setName('reward-ceremony-backdrop');
    target.add(backdrop);
    hasCeremonyBackdrop = true;
    if (!reducedMotion) {
      scene.tweens.add({
        targets: backdrop,
        alpha: 0.72,
        scaleX: backdrop.scaleX * 1.006,
        scaleY: backdrop.scaleY * 1.006,
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }
  target.add(scene.add.rectangle(width / 2, 90, width - 230, 96, 0x020409, hasCeremonyBackdrop ? 0.16 : 0.62)
    .setStrokeStyle(1, 0xd8a840, hasCeremonyBackdrop ? 0.08 : 0.35));
  target.add(scene.add.rectangle(width / 2, 632, width - 170, 112, 0x020409, hasCeremonyBackdrop ? 0.12 : 0.38));
  if (scene.textures.exists(textures.headerPlaque)) {
    scene.textures.get(textures.headerPlaque).setFilter(Phaser.Textures.FilterMode.LINEAR);
    target.add(scene.add.image(width / 2, 98, textures.headerPlaque)
      .setDisplaySize(570, 116)
      .setAlpha(0.56)
      .setName('reward-header-plaque'));
  } else {
    target.add(scene.add.rectangle(width / 2, 98, 612, 114, 0x07101c, 0.82)
      .setStrokeStyle(2, 0xd8a840, 0.72)
      .setName('reward-header-plaque-fallback'));
  }
  target.add(scene.add.text(width / 2, 64, 'ROOFTOP LANDMARK', {
    fontFamily, fontSize: '12px', fontStyle: boldFontStyle, color: cyanColor
  }).setOrigin(0.5));
  target.add(scene.add.text(width / 2, 91, context.title, {
    fontFamily,
    fontSize: '34px',
    fontStyle: boldFontStyle,
    color: goldColor,
    stroke: '#000000',
    strokeThickness: 4,
    align: 'center',
    fixedWidth: width - 220,
    fixedHeight: 52,
    maxLines: 1
  }).setOrigin(0.5));
  target.add(scene.add.text(width / 2, 128, context.subtitle, {
    fontFamily,
    fontSize: '15px',
    color: softColor,
    align: 'center',
    fixedWidth: width - 260,
    fixedHeight: 28,
    maxLines: 1
  }).setOrigin(0.5));
}

function renderDeckNeeds(context: RewardCeremonyRenderContext) {
  const deckNeeds = context.deckNeeds;
  if (!deckNeeds) return;
  const { scene, target, width, textures, fontFamily, boldFontStyle } = context;
  const y = 182;
  target.add(scene.add.text(width / 2, y - 22, deckNeeds.guide, {
    fontFamily, fontSize: '12px', fontStyle: boldFontStyle, color: '#7f93a8'
  }).setOrigin(0.5));
  const labels = deckNeeds.entries.map(({ label, rank }) => `${label}: ${rank}`);
  const widths = labels.map((label) => label.length * 8 + 58);
  let x = width / 2 - widths.reduce((sum, value) => sum + value, 0) / 2;
  const hasFrame = scene.textures.exists(textures.deckNeedChipFrame);
  if (hasFrame) scene.textures.get(textures.deckNeedChipFrame).setFilter(Phaser.Textures.FilterMode.LINEAR);
  deckNeeds.entries.forEach(({ label, rank, icon }, index) => {
    const chipWidth = widths[index] - 10;
    if (hasFrame) {
      target.add(scene.add.image(x + chipWidth / 2, y, textures.deckNeedChipFrame)
        .setDisplaySize(chipWidth, 34)
        .setAlpha(rank === 'low' ? 0.58 : 0.5)
        .setName('reward-deck-need-chip-frame'));
    } else {
      target.add(scene.add.rectangle(x + chipWidth / 2, y, chipWidth, 28, 0x07101c, 0.78)
        .setStrokeStyle(1, rank === 'low' ? 0xff9d4d : 0x8df4ff, 0.48)
        .setName('reward-deck-need-chip-frame-fallback'));
    }
    const image = context.addIcon(icon, x + 20, y, 24);
    if (image) target.add(image.setAlpha(0.92));
    target.add(scene.add.text(x + 38, y, `${label}: ${rank}`, {
      fontFamily,
      fontSize: '14px',
      fontStyle: boldFontStyle,
      color: rank === 'low' ? '#ff9d4d' : rank === 'strong' ? '#8fd6a0' : '#dce8f2'
    }).setOrigin(0, 0.5));
    x += widths[index];
  });
}

function renderCardArt(context: RewardCeremonyRenderContext, card: RewardCardView, x: number, y: number) {
  const { scene, target, textures, fontFamily, boldFontStyle } = context;
  const artWidth = 208;
  const artHeight = Math.round(artWidth * 1.5);
  if (card.artKey && scene.textures.exists(card.artKey)) {
    target.add(scene.add.image(x, y, card.artKey).setDisplaySize(artWidth, artHeight).setAlpha(0.98));
  } else if (card.snag && scene.textures.exists(textures.snagBorder)) {
    target.add(scene.add.rectangle(x, y, artWidth, artHeight, 0x07090d, 0.98));
    target.add(scene.add.image(x, y, textures.snagBorder).setDisplaySize(artWidth, artHeight));
  } else {
    target.add(scene.add.rectangle(x, y, artWidth, artHeight, 0x141f2f, 0.94).setStrokeStyle(1, 0x49606d, 0.8));
    target.add(scene.add.text(x, y - 20, card.label, {
      fontFamily, fontSize: '18px', fontStyle: boldFontStyle, color: '#7ab8d6', align: 'center', wordWrap: { width: artWidth - 40 }
    }).setOrigin(0.5));
  }
  target.add(scene.add.rectangle(x, y, artWidth, artHeight, 0x05101a, 0.16));
}

function compactDeltaPart(text: string, max = 12) {
  const value = text.replace(/\s+/g, ' ').replace(/[.]$/, '').trim();
  return value.length <= max ? value : `${value.slice(0, max - 3).trimEnd()}...`;
}

function rewardDecisionLabel(preview: RewardDecisionPreview) {
  if (preview.kind === 'add') return `ADD  /  DECK ${preview.deckBefore} > ${preview.deckBefore + 1}`;
  const beforeParts = preview.before.split(/[.;]\s+/);
  const afterParts = preview.after.split(/[.;]\s+/);
  const moltBeforeParts = preview.moltBefore.split(/[.;]\s+/);
  const moltAfterParts = preview.moltAfter.split(/[.;]\s+/);
  const pairs: Array<[string, string]> = [
    ...beforeParts.map((before, index) => [before, afterParts[index] ?? ''] as [string, string]),
    ...moltBeforeParts.map((before, index) => [before, moltAfterParts[index] ?? ''] as [string, string]),
  ];
  const changed = pairs.find(([before, after]) => before !== after && after) ?? pairs.find(([, after]) => after);
  const change = changed
    ? `${compactDeltaPart(changed[0])} > ${compactDeltaPart(changed[1])}`
    : preview.statChanges[0] ?? 'Ability improved';
  return `PREEN  /  ${change}`;
}

function renderCard(context: RewardCeremonyRenderContext, card: RewardCardView, x: number, y: number) {
  const { scene, target, fontFamily, boldFontStyle, goldColor, softColor } = context;
  const cardWidth = 228;
  const cardHeight = 312;
  const hoverWidth = cardWidth + 54;
  const hoverHeight = cardHeight + 78;
  const top = y - cardHeight / 2;
  const bottom = y + cardHeight / 2;
  let hoverRing: Phaser.GameObjects.Image | undefined;
  const hit = scene.add.rectangle(x, y, cardWidth, cardHeight, 0x07101c, 0.98)
    .setStrokeStyle(card.focused ? 5 : 3, card.focused ? 0x8df4ff : card.accent, 1)
    .setInteractive({ useHandCursor: true })
    .setName('reward-choice-card-hit');
  hit.on('pointerdown', () => context.onCardSelect(card.id));
  hit.on('pointerover', () => {
    context.onCardHover(card.id, x, y);
    showHoverRing(context, hoverRing, hoverWidth, hoverHeight, card.upgraded ? 0.9 : 0.82);
  });
  hit.on('pointerout', () => {
    hideHoverRing(context, hoverRing);
    context.onCardOut();
  });
  const spotlight = addSpotlight(context, x, y + 116, 226, 132, card.upgraded ? 0.014 : 0.008);
  if (spotlight) target.add(spotlight);
  const glow = addGlowBurst(context, x, y + 8, 276, 276, card.upgraded ? 0.11 : 0.055, card.upgraded);
  target.add(glow.objects);
  target.add(scene.add.rectangle(x + 8, y + 10, cardWidth, cardHeight, 0x020409, 0.42));
  target.add(hit);
  const frame = addChoiceFrame(context, x, y, cardWidth + 32, cardHeight + 44, card.upgraded ? 0.54 : 0.34);
  if (frame) target.add(frame);
  if (card.focused) {
    target.add(scene.add.rectangle(x, y, cardWidth + 30, cardHeight + 42, 0x000000, 0)
      .setStrokeStyle(4, 0x8df4ff, 1)
      .setName('reward-input-focus-ring'));
  }
  target.add(scene.add.rectangle(x, top - 8, 204, 22, 0x06111a, 0.98)
    .setStrokeStyle(1, card.accent, 0.86)
    .setName('reward-decision-delta'));
  target.add(scene.add.text(x, top - 8, rewardDecisionLabel(card.decisionPreview), {
    fontFamily,
    fontSize: '9px',
    fontStyle: boldFontStyle,
    color: '#f4f8fb',
    align: 'center',
    fixedWidth: 196,
    maxLines: 1,
  }).setOrigin(0.5).setName('reward-decision-delta'));
  renderCardArt(context, card, x, y);
  target.add(scene.add.rectangle(x, top + 18, cardWidth - 18, 2, card.accent, 0.78));
  target.add(scene.add.rectangle(x, bottom - 18, cardWidth - 18, 2, card.accent, 0.55));
  target.add(scene.add.circle(x - cardWidth / 2 + 24, top + 28, 19, card.cost === 0 ? 0x24d0d6 : 0xd8a840, 1).setStrokeStyle(2, 0x05080e, 0.95));
  target.add(scene.add.text(x - cardWidth / 2 + 24, top + 28, `${card.cost}`, {
    fontFamily, fontSize: '18px', fontStyle: boldFontStyle, color: '#07101c'
  }).setOrigin(0.5));
  target.add(scene.add.rectangle(x, top + 43, cardWidth - 18, 56, 0x05080e, 0.58));
  target.add(scene.add.text(x - cardWidth / 2 + 50, top + 24, card.name, {
    fontFamily,
    fontSize: '18px',
    fontStyle: boldFontStyle,
    color: goldColor,
    stroke: '#020409',
    strokeThickness: 3,
    fixedWidth: cardWidth - 66,
    fixedHeight: 42,
    wordWrap: { width: cardWidth - 66 },
    maxLines: 2
  }));
  target.add(scene.add.text(x - cardWidth / 2 + 50, top + 68, card.bird, {
    fontFamily,
    fontSize: '12px',
    fontStyle: boldFontStyle,
    color: softColor,
    stroke: '#020409',
    strokeThickness: 3,
    fixedWidth: cardWidth - 66,
    fixedHeight: 16,
    wordWrap: { width: cardWidth - 66 },
    maxLines: 1
  }));
  if (context.reinforcedColorCues) {
    renderCardColorCue(scene, target, x + cardWidth / 2 - 54, top + 102, card.label, card.accent, {
      name: 'reward-color-cue-badge',
      width: 92,
      height: 24,
    });
  }
  target.add(scene.add.rectangle(x, bottom - 57, cardWidth - 18, 96, 0x05080e, 0.78).setStrokeStyle(1, card.accent, 0.28));
  target.add(scene.add.text(x - cardWidth / 2 + 16, bottom - 94, card.summary, {
    fontFamily,
    fontSize: '13px',
    color: '#dce8f2',
    stroke: '#020409',
    strokeThickness: 2,
    lineSpacing: 1,
    fixedWidth: cardWidth - 32,
    fixedHeight: 54,
    wordWrap: { width: cardWidth - 32 },
    maxLines: 3
  }));
  if (card.molt) {
    target.add(scene.add.rectangle(x + cardWidth / 2 - 48, bottom - 82, 62, 18, 0x2a1208, 0.9).setStrokeStyle(1, 0xff9d4d, 0.72));
    target.add(scene.add.text(x + cardWidth / 2 - 48, bottom - 88, 'MOLT', {
      fontFamily, fontSize: '9px', fontStyle: boldFontStyle, color: '#ffc78f', align: 'center', fixedWidth: 52
    }).setOrigin(0.5, 0));
  }
  if (card.collectionStatus) {
    const firstClaim = card.collectionStatus.firstClaim;
    const targeted = card.collectionStatus.targeted;
    const label = targeted
      ? 'HUNT TARGET / CLAIM TO COMPLETE'
      : firstClaim
        ? 'NEW TO COLLECTION'
        : `COLLECTED / ${card.collectionStatus.timesClaimed} FLIGHT CLAIM${card.collectionStatus.timesClaimed === 1 ? '' : 'S'}`;
    const width = targeted ? 198 : firstClaim ? 142 : 174;
    target.add(scene.add.rectangle(x, bottom - 126, width, 22, targeted || firstClaim ? 0x3b2b0b : 0x102534, 0.98)
      .setStrokeStyle(1, targeted || firstClaim ? 0xffcf6b : 0x8df4ff, 0.96)
      .setName('reward-collection-status'));
    target.add(scene.add.text(x, bottom - 126, label, {
      fontFamily,
      fontSize: targeted ? '9px' : firstClaim ? '10px' : '9px',
      fontStyle: boldFontStyle,
      color: targeted || firstClaim ? '#ffe08a' : '#b8e8f4',
      align: 'center',
      fixedWidth: width - 10,
      maxLines: 1,
    }).setOrigin(0.5).setName('reward-collection-status'));
  }
  target.add(scene.add.text(x - cardWidth / 2 + 16, bottom - 30, card.label, {
    fontFamily,
    fontSize: '12px',
    fontStyle: boldFontStyle,
    color: card.accentText,
    stroke: '#020409',
    strokeThickness: 2,
    fixedWidth: 80,
    fixedHeight: 18,
    maxLines: 1
  }));
  card.footerRows.slice(0, 2).forEach((text, index) => {
    const caution = text.startsWith('!');
    const neutral = text.startsWith('=');
    target.add(scene.add.text(x - cardWidth / 2 + 70, bottom - 47 + index * 18, text, {
      fontFamily,
      fontSize: '10px',
      fontStyle: boldFontStyle,
      color: caution ? '#ffad73' : neutral ? '#91a6b8' : '#ffcf6b',
      stroke: '#020409',
      strokeThickness: 2,
      fixedWidth: cardWidth - 86,
      fixedHeight: 16,
      maxLines: 1
    }).setName(card.footerUsesObservations ? 'reward-build-observation' : 'reward-card-stat'));
  });
  hoverRing = addHoverRing(context, x, y, hoverWidth, hoverHeight);
  if (hoverRing) target.add(hoverRing);
  return glow.burst;
}

function renderTagRow(context: RewardCeremonyRenderContext, x: number, y: number, tags: string[], accent: number, maxWidth: number) {
  let cursor = x;
  tags.slice(0, 3).forEach((tag) => {
    const width = Math.max(70, Math.min(132, tag.length * 7 + 24));
    if (cursor + width > x + maxWidth) return;
    context.target.add(context.scene.add.rectangle(cursor + width / 2, y, width, 22, 0x1d3047, 0.98).setStrokeStyle(1, accent, 0.95));
    context.target.add(context.scene.add.text(cursor + width / 2, y, tag, {
      fontFamily: context.fontFamily,
      fontSize: '10px',
      fontStyle: context.boldFontStyle,
      color: context.goldColor,
      align: 'center',
      fixedWidth: width - 8
    }).setResolution(2).setOrigin(0.5));
    cursor += width + 8;
  });
}

function renderWaymark(context: RewardCeremonyRenderContext, waymark: RewardWaymarkView, index: number, x: number, y: number) {
  const { scene, target, fontFamily, boldFontStyle, goldColor, cyanColor } = context;
  const width = 248;
  const height = 306;
  const hit = scene.add.rectangle(x, y, width, height, 0x07101c, 0.98)
    .setStrokeStyle(waymark.focused ? 5 : 3, waymark.focused ? 0x8df4ff : waymark.accent, 0.95)
    .setInteractive({ useHandCursor: true });
  hit.on('pointerdown', () => context.onWaymarkSelect(waymark.id));
  const spotlight = addSpotlight(context, x, y + 118, 236, 136, 0.018);
  if (spotlight) target.add(spotlight);
  const glow = addGlowBurst(context, x, y + 12, 292, 292, 0.16, index === 0);
  target.add(glow.objects);
  target.add(scene.add.rectangle(x + 8, y + 10, width, height, 0x020409, 0.42));
  target.add(hit);
  const frame = addChoiceFrame(context, x, y, width + 44, height + 58, 0.56);
  if (frame) target.add(frame);
  if (waymark.focused) {
    target.add(scene.add.rectangle(x, y, width + 34, height + 46, 0x000000, 0)
      .setStrokeStyle(4, 0x8df4ff, 1)
      .setName('reward-input-focus-ring'));
  }
  if (waymark.artKey && scene.textures.exists(waymark.artKey)) {
    scene.textures.get(waymark.artKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    target.add(scene.add.image(x, y - 84, waymark.artKey).setDisplaySize(86, 86));
  } else {
    target.add(scene.add.text(x, y - 84, waymark.glyph, {
      fontFamily: 'Georgia, serif', fontSize: '32px', fontStyle: boldFontStyle, color: '#fff1c7'
    }).setOrigin(0.5));
  }
  target.add(scene.add.text(x, y - 30, waymark.name, {
    fontFamily, fontSize: '20px', fontStyle: boldFontStyle, color: goldColor, align: 'center', wordWrap: { width: 202 }, maxLines: 2
  }).setOrigin(0.5));
  target.add(scene.add.text(x, y + 24, `${waymark.familyLabel} / ${waymark.source}`, {
    fontFamily, fontSize: '12px', fontStyle: boldFontStyle, color: cyanColor, align: 'center'
  }).setOrigin(0.5));
  target.add(scene.add.text(x, y + 48, waymark.rarity.toUpperCase(), {
    fontFamily, fontSize: '11px', fontStyle: boldFontStyle, color: waymark.rarity === 'boss' ? '#ffb1a4' : '#ffcf6b', align: 'center'
  }).setOrigin(0.5));
  renderTagRow(context, x - 102, y + 76, waymark.tags, waymark.accent, 204);
  target.add(scene.add.text(x, y + 112, waymark.description, {
    fontFamily, fontSize: '13px', color: '#d7c5a6', align: 'center', wordWrap: { width: 204 }, maxLines: 3
  }).setOrigin(0.5));
  return glow.burst;
}

function renderSkip(context: RewardCeremonyRenderContext) {
  if (!context.skip) return;
  const { scene, target, width, textures, reducedMotion, fontFamily, boldFontStyle, goldColor } = context;
  if (scene.textures.exists(textures.skipCommandFrame)) {
    scene.textures.get(textures.skipCommandFrame).setFilter(Phaser.Textures.FilterMode.LINEAR);
    target.add(scene.add.image(width / 2, 652, textures.skipCommandFrame).setDisplaySize(382, 110).setAlpha(0.88).setName('reward-skip-command-frame'));
    if (!reducedMotion) {
      const glint = scene.add.image(width / 2, 652, textures.skipCommandFrame)
        .setDisplaySize(382, 110)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.032)
        .setName('reward-skip-command-frame');
      target.add(glint);
      scene.tweens.add({ targets: glint, alpha: 0.018, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  } else {
    target.add(scene.add.rectangle(width / 2, 652, 324, 48, 0x2a2320, 0.96).setStrokeStyle(2, 0xd8a840, 0.9).setName('reward-skip-command-frame-fallback'));
  }
  const hit = scene.add.rectangle(width / 2, 652, 324, MIN_SUPPORTED_TOUCH_TARGET, 0x000000, 0.01)
    .setInteractive({ useHandCursor: true })
    .setName('reward-skip-hit');
  hit.on('pointerdown', context.onSkip);
  target.add(hit);
  const icon = context.addIcon('scrap-gear', width / 2 - 132, 652, 30);
  if (icon) target.add(icon.setAlpha(0.95));
  target.add(scene.add.text(width / 2 + 10, 646, `Skip  +${context.skip.scrap} Scrap`, {
    fontFamily, fontSize: '15px', fontStyle: boldFontStyle, color: goldColor
  }).setOrigin(0.5));
  target.add(scene.add.text(width / 2 + 10, 664, `Deck stays ${context.skip.deckSize}  /  After: ${context.skip.scrapAfter} Scrap`, {
    fontFamily, fontSize: '10px', color: '#dce8f2'
  }).setOrigin(0.5));
}

/** Render card, Preen, or Waymark reward ceremony presentation from explicit view data. */
export function renderRewardCeremony(context: RewardCeremonyRenderContext) {
  renderBackdrop(context);
  renderDeckNeeds(context);
  let glowBursts = 0;
  if (context.kind === 'waymark') {
    (context.waymarks ?? []).forEach((waymark, index) => {
      glowBursts += renderWaymark(context, waymark, index, 336 + index * 304, 404);
    });
  } else {
    (context.cards ?? []).forEach((card, index) => {
      glowBursts += renderCard(context, card, 336 + index * 304, 402);
    });
    if (context.kind === 'card') renderSkip(context);
  }
  return { glowBursts };
}
