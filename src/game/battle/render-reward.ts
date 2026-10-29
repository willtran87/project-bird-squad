import Phaser from 'phaser';
import { quietButton } from '../quiet-ui';
import { renderCardColorCue } from '../card-color-cues';
import { UI_TYPE } from '../theme';
import { renderFocusedBuildRead, renderRewardInspectButton, renderRewardSkipCommand, renderWaymarkRewardChoice as renderWaymark } from '../reward-card-inspection';
import { boundedRewardText, renderRewardCardFace, rewardDecisionPreviewLabel } from './reward-card-face';

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
  quickRead?: { pairing: string; tradeoff: string };
  passiveDelta?: string;
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
  armed: boolean;
}

export interface RewardWaymarkView {
  id: string;
  name: string;
  glyph: string;
  familyLabel: string;
  source: string;
  rarity: string;
  trigger: string;
  familyCount: number;
  description: string;
  tags: string[];
  accent: number;
  artKey?: string;
  focused: boolean;
  armed: boolean;
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
  waymarkBuildCards?: any[];
  waymarkSupplyCount?: number;
  skip?: {
    scrap: number;
    deckSize: number;
    scrapAfter: number;
    armed: boolean;
  };
  addIcon: (icon: string, x: number, y: number, size: number) => Phaser.GameObjects.Image | undefined;
  onCardSelect: (cardId: string) => void;
  onCardInspect: (cardId: string) => void;
  failedArtKeys?: ReadonlySet<string>;
  onCardArtRetry?: (cardId: string) => void;
  onCardOut: () => void;
  onWaymarkSelect: (waymarkId: string) => void;
  onWaymarkInspect: (waymarkId: string) => void;
  onWaymarkBuildRead: (waymarkId: string, observations: string[]) => void;
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

function addHoverRing(context: RewardCeremonyRenderContext, x: number, y: number, width: number, height: number) {
  const { scene, textures } = context;
  if (!scene.textures.exists(textures.choiceHoverRing)) return undefined;
  scene.textures.get(textures.choiceHoverRing).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return scene.add.nineslice(x, y, textures.choiceHoverRing, undefined, width, height, 24, 24, 24, 24)
    .setAlpha(0)
    .setVisible(false)
    .setName('reward-choice-hover-ring');
}

function renderBackdrop(context: RewardCeremonyRenderContext) {
  const { scene, target, width, height, textures, reducedMotion, fontFamily, boldFontStyle, cyanColor, goldColor, softColor } = context;
  target.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x020409, 0.58));
  let hasCeremonyBackdrop = false;
  if (context.kind !== 'waymark' && scene.textures.exists(textures.ceremonyBackdrop)) {
    scene.textures.get(textures.ceremonyBackdrop).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const backdrop = scene.add.image(width / 2, height / 2 + 10, textures.ceremonyBackdrop)
      .setDisplaySize(1224, 612)
      .setAlpha(0.6)
      .setName('reward-ceremony-backdrop');
    target.add(backdrop);
    hasCeremonyBackdrop = true;
  }
  target.add(scene.add.rectangle(width / 2, 148, 80, 2, 0xd8a840, 0.65));
  target.add(scene.add.text(width / 2, 64, 'ROOFTOP LANDMARK', {
    fontFamily, fontSize: UI_TYPE.secondary, resolution: 2, fontStyle: boldFontStyle, color: cyanColor
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
    fontSize: UI_TYPE.secondary, resolution: 2,
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
  const labels = deckNeeds.entries.map(({ label, rank }) => `${label}: ${rank}`);
  const widths = labels.map((label) => label.length * 11 + 30);
  let x = width / 2 - widths.reduce((sum, value) => sum + value, 0) / 2;
  deckNeeds.entries.forEach(({ label, rank, icon }, index) => {
    const chipWidth = widths[index] - 10;
    target.add(scene.add.rectangle(x + chipWidth / 2, y, chipWidth, 32, 0x07101c, 0.92)
      .setStrokeStyle(1, rank === 'low' ? 0xff9d4d : 0x8df4ff, 0.35)
      .setName('reward-deck-need-chip-frame-fallback'));
    target.add(scene.add.text(x + 10, y, `${label}: ${rank}`, {
      fontFamily,
      fontSize: UI_TYPE.secondary, resolution: 2,
      fontStyle: boldFontStyle,
      color: rank === 'low' ? '#ff9d4d' : rank === 'strong' ? '#8fd6a0' : '#dce8f2'
    }).setOrigin(0, 0.5));
    x += widths[index];
  });
}

function renderCard(
  context: RewardCeremonyRenderContext,
  card: RewardCardView,
  x: number,
  y: number,
  hoverEnabled: boolean,
  inspectEnabled: boolean,
) {
  const { scene, target, fontFamily, boldFontStyle, goldColor, softColor } = context;
  const cardWidth = 264;
  const cardHeight = 312;
  const hoverWidth = cardWidth + 16;
  const hoverHeight = cardHeight + 8;
  const top = y - cardHeight / 2;
  const bottom = y + cardHeight / 2;
  let hoverRing: Phaser.GameObjects.NineSlice | undefined;
  const hit = scene.add.rectangle(x, y, cardWidth, cardHeight, 0x07101c, 0.98)
    .setStrokeStyle(2, card.accent, 0.9)
    .setInteractive({ useHandCursor: true })
    .setName('reward-choice-card-hit');
  hit.on('pointerdown', () => context.onCardSelect(card.id));
  hit.on('pointerover', () => {
    if (!hoverEnabled) {
      hoverRing?.setVisible(false).setAlpha(0);
      context.onCardOut();
      return;
    }
    // Hover highlights the choice; full rules stay in the explicit Read action.
    // A floating dossier would cover the neighboring choices and their effects.
    hoverRing?.setAlpha(card.upgraded ? 0.9 : 0.82)
      .setVisible(true);
  });
  hit.on('pointerout', () => {
    hoverRing?.setVisible(false).setAlpha(0);
    context.onCardOut();
  });
  const spotlight = addSpotlight(context, x, y + 116, 226, 132, card.upgraded ? 0.014 : 0.008);
  if (spotlight) target.add(spotlight);
  const glow = addGlowBurst(context, x, y + 8, 276, 276, card.upgraded ? 0.11 : 0.055, card.upgraded);
  target.add(glow.objects);
  target.add(scene.add.rectangle(x + 8, y + 10, cardWidth, cardHeight, 0x020409, 0.42));
  target.add(hit);
  if (card.focused) {
    target.add(scene.add.rectangle(x, y, cardWidth + 14, cardHeight + 8, 0x000000, 0)
      .setStrokeStyle(3, card.armed ? 0xd8a840 : 0x8df4ff, 1)
      .setName('reward-input-focus-ring'));
  }
  renderRewardCardFace({ ...context, typography: UI_TYPE }, card, x);
  if (context.reinforcedColorCues) renderCardColorCue(scene, target, x - 102, 359, card.label, card.accent,
    { name: 'reward-color-cue-badge', width: 26, height: 28, iconOnly: true });
  if (context.kind === 'upgrade') {
    const change = rewardDecisionPreviewLabel(card.decisionPreview);
    target.add(boundedRewardText(scene.add.text(x - 120, 632, change, {
      fontFamily, fontSize: UI_TYPE.secondary, color: '#bfe8f4', resolution: 2,
      wordWrap: { width: 240, useAdvancedWrap: true }, lineSpacing: 2,
    }), 2).setName('reward-preen-change').setData('fullText', change).setData('cardId', card.id));
  }
  const inspectY = 586;
  renderRewardInspectButton({ scene, target, x: x - 76, y: inspectY, width: 104, label: 'Read',
    accent: card.accent, fontFamily, boldFontStyle, enabled: inspectEnabled,
    onInspect: () => context.onCardInspect(card.id) });
  {
    const primary = card.focused || card.armed;
    const take = quietButton(scene, { x: x + 56, y: inspectY, width: 144,
      label: card.armed ? 'Confirm' : 'Select', name: 'reward-card-take-hit', enabled: inspectEnabled,
      kind: primary ? 'primary' : 'secondary', focused: card.focused,
      onActivate: () => context.onCardSelect(card.id) }).setData('cardId', card.id).setData('disabled', !inspectEnabled);
    if (card.armed) take.setData('statusLabel', 'Confirm').setData('status', 'armed');
    target.add(take);
    target.add(take.getData('labelObject').setName('reward-card-take-label'));
  }
  hoverRing = addHoverRing(context, x, y, hoverWidth, hoverHeight);
  if (hoverRing) target.add(hoverRing);
  return glow.burst;
}


function renderSkip(context: RewardCeremonyRenderContext) {
  if (!context.skip) return;
  renderRewardSkipCommand(context.scene, context.target, context.skip, context.onSkip);
}

/** Render card, Preen, or Waymark reward ceremony presentation from explicit view data. */
export function renderRewardCeremony(context: RewardCeremonyRenderContext) {
  renderBackdrop(context);
  renderDeckNeeds(context);
  if (context.kind === 'upgrade') context.target.add(context.scene.add.rectangle(context.width / 2, 654, 920, 60, 0x050c14, 0.8)
    .setName('reward-preen-preview-rail'));
  let glowBursts = 0;
  if (context.kind === 'waymark') {
    (context.waymarks ?? []).forEach((waymark, index) => {
      glowBursts += renderWaymark(context, waymark, 336 + index * 304);
    });
  } else {
    const cards = context.cards ?? [];
    const skipCommitmentActive = context.kind === 'card' && context.skip?.armed === true;
    const commitmentActive = cards.some((card) => card.armed) || skipCommitmentActive;
    cards.forEach((card, index) => {
      glowBursts += renderCard(
        context,
        card,
        336 + index * 304,
        396,
        !commitmentActive,
        !skipCommitmentActive,
      );
    });
    if (context.kind === 'card') {
      renderFocusedBuildRead(context);
      renderSkip(context);
    }
  }
  return { glowBursts };
}
