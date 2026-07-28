import Phaser from 'phaser';
import { renderCardColorCue } from '../card-color-cues';

export interface BattleHandCardPreviewView {
  name: string;
  cost: number;
  upgraded: boolean;
  accent: number;
  artKey?: string;
  snag: boolean;
  fallbackLabel: string;
  usesMolt: boolean;
  currentText: string;
  alternateLabel?: string;
  alternateText?: string;
  stats: string;
}

export interface BattleHandCardView {
  instanceId: string;
  name: string;
  label: string;
  cost: number;
  canPay: boolean;
  selected: boolean;
  guideCard: boolean;
  guideMolt: boolean;
  accent: number;
  usesMolt: boolean;
  summary: string;
  buildsFlow: boolean;
  flowVisible: boolean;
  surgeNext: boolean;
  artKey?: string;
  snag: boolean;
  fallbackLabel: string;
  preview: BattleHandCardPreviewView;
}

export interface BattleHandAssets {
  handRail: string;
  cardFrame: string;
  selectedPulse: string;
  hoverDossierFrame: string;
  hoverStatChipFrame: string;
}

export interface BattleHandRenderResult {
  rects: Map<string, Phaser.GameObjects.Rectangle>;
  artLayers: Map<string, Phaser.GameObjects.Container>;
  frames: Map<string, Phaser.GameObjects.Image>;
  selectionPulses: Map<string, Phaser.GameObjects.Image>;
  flowIndicators: Map<string, {
    container: Phaser.GameObjects.Container;
    background: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
  }>;
}

export interface BattleHandRenderContext {
  scene: Phaser.Scene;
  target: Phaser.GameObjects.Container;
  width: number;
  handY: number;
  cardWidth: number;
  cardHeight: number;
  fontFamily: string;
  boldFontStyle: string;
  cyanColor: string;
  assets: BattleHandAssets;
  reducedMotion: boolean;
  reinforcedColorCues: boolean;
  cards: BattleHandCardView[];
  cardLeft: (index: number, count: number) => number;
  renderRichText: (
    target: Phaser.GameObjects.Container,
    x: number,
    y: number,
    text: string,
    options: { wrap: number; fontSize: number; align: 'center'; lineSpacing: number; tooltips?: boolean; baseColor?: string; bold?: boolean },
  ) => number;
  renderSnagArt: (
    target: Phaser.GameObjects.Container,
    instanceId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    alpha: number,
  ) => boolean;
  onCardClick: (instanceId: string) => void;
  onCardHover: (instanceId: string) => void;
  onCardOut: () => void;
}

export interface BattleHandPreviewContext {
  scene: Phaser.Scene;
  target: Phaser.GameObjects.Container;
  width: number;
  handY: number;
  cardHeight: number;
  fontFamily: string;
  boldFontStyle: string;
  cyanColor: string;
  softColor: string;
  assets: Pick<BattleHandAssets, 'hoverDossierFrame' | 'hoverStatChipFrame'>;
  renderRichText: BattleHandRenderContext['renderRichText'];
  renderSnagArt: BattleHandRenderContext['renderSnagArt'];
}

function textureReady(scene: Phaser.Scene, key: string) {
  if (!key || !scene.textures.exists(key)) return false;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return true;
}

function compactSentenceText(text: string, maxChars: number, maxLines = 1) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const max = Math.max(8, maxChars * maxLines);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function addCardArt(
  context: Pick<BattleHandRenderContext, 'scene' | 'renderSnagArt'>,
  target: Phaser.GameObjects.Container,
  card: Pick<BattleHandCardView, 'instanceId' | 'artKey' | 'snag' | 'fallbackLabel'>,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number,
) {
  const { scene } = context;
  target.removeAll(true);
  if (card.artKey && textureReady(scene, card.artKey)) {
    target.add(scene.add.image(x, y, card.artKey).setDisplaySize(width, height).setAlpha(alpha));
    return;
  }
  if (card.snag && context.renderSnagArt(target, card.instanceId, x, y, width, height, alpha)) {
    target.add(scene.add.rectangle(x, y, width, height, 0x05101a, 0.12));
    return;
  }
  target.add(scene.add.rectangle(x, y, width, height, 0x141d2b, 0.92));
}

export function renderBattleHandCardArt(
  context: BattleHandRenderContext,
  target: Phaser.GameObjects.Container,
  card: BattleHandCardView,
  centerX: number,
) {
  addCardArt(
    context,
    target,
    card,
    centerX,
    context.handY,
    context.cardWidth - 4,
    context.cardHeight - 4,
    card.canPay ? 1 : 0.55,
  );
}

function addSelectedPulse(
  context: BattleHandRenderContext,
  result: BattleHandRenderResult,
  card: BattleHandCardView,
  centerX: number,
) {
  const { scene, target, cardWidth, cardHeight, reducedMotion } = context;
  if (!textureReady(scene, context.assets.selectedPulse)) return;
  const emphasized = card.selected || card.guideMolt || card.guideCard;
  const guidePulseName = card.guideMolt
    ? 'combat-molt-guide-pulse'
    : card.guideCard
      ? 'combat-first-card-guide-pulse'
      : 'combat-hand-selected-pulse';
  const pulse = scene.add.image(centerX, context.handY, context.assets.selectedPulse)
    .setDisplaySize(card.selected ? cardWidth + 38 : cardWidth + 32, card.selected ? cardHeight + 54 : cardHeight + 46)
    .setAlpha(card.selected ? 0.54 : card.guideMolt ? 0.42 : card.guideCard ? 0.38 : 0)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setName(guidePulseName);
  target.add(pulse);
  result.selectionPulses.set(card.instanceId, pulse);
  if (emphasized && !reducedMotion) {
    scene.tweens.add({
      targets: pulse,
      alpha: 0.34,
      scaleX: pulse.scaleX * 1.035,
      scaleY: pulse.scaleY * 1.035,
      duration: 960,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

function renderCard(
  context: BattleHandRenderContext,
  result: BattleHandRenderResult,
  card: BattleHandCardView,
  left: number,
) {
  const { scene, target, handY, cardWidth, cardHeight, fontFamily, boldFontStyle } = context;
  const centerX = left + cardWidth / 2;
  const top = handY - cardHeight / 2;
  const bottom = handY + cardHeight / 2;
  const rect = scene.add.rectangle(centerX, handY, cardWidth, cardHeight, 0x0a0f18, 1)
    .setStrokeStyle(
      card.selected ? 5 : card.guideMolt || card.guideCard ? 4 : 2,
      card.selected ? 0x24d0d6 : card.guideMolt ? 0xff9d4d : card.guideCard ? 0xd8a840 : card.accent,
      1,
    )
    .setInteractive({ useHandCursor: card.canPay });
  rect.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event?: Phaser.Types.Input.EventData) => {
    event?.stopPropagation();
    context.onCardClick(card.instanceId);
  });
  rect.on('pointerover', () => context.onCardHover(card.instanceId));
  rect.on('pointerout', context.onCardOut);
  target.add(rect);
  result.rects.set(card.instanceId, rect);

  const artLayer = scene.add.container(0, 0);
  renderBattleHandCardArt(context, artLayer, card, centerX);
  target.add(artLayer);
  result.artLayers.set(card.instanceId, artLayer);
  addSelectedPulse(context, result, card, centerX);

  if (textureReady(scene, context.assets.cardFrame)) {
    const guided = card.guideMolt || card.guideCard;
    const frame = scene.add.image(centerX, handY, context.assets.cardFrame)
      .setDisplaySize(card.selected ? cardWidth + 24 : guided ? cardWidth + 20 : cardWidth + 16, card.selected ? cardHeight + 36 : guided ? cardHeight + 30 : cardHeight + 24)
      .setAlpha(card.selected ? 0.96 : guided ? 0.82 : card.canPay ? 0.52 : 0.26)
      .setName('combat-hand-card-frame');
    target.add(frame);
    result.frames.set(card.instanceId, frame);
  }

  target.add(scene.add.rectangle(centerX, top + 16, cardWidth - 4, 26, 0x05080e, 0.66));
  target.add(scene.add.text(left + 34, top + 8, card.name, {
    fontFamily,
    fontSize: '13px',
    fontStyle: boldFontStyle,
    color: card.canPay ? '#ffe7b0' : '#9aa7b6',
    wordWrap: { width: cardWidth - 44 },
  }));
  if (card.usesMolt) {
    target.add(scene.add.rectangle(left + cardWidth - 43, top + 16, 70, 18, 0x2a1208, 0.88).setStrokeStyle(1, 0xff9d4d, 0.78));
    target.add(scene.add.text(left + cardWidth - 43, top + 9, 'MOLT', {
      fontFamily,
      fontSize: '10px',
      fontStyle: boldFontStyle,
      color: '#ffc78f',
      align: 'center',
    }).setOrigin(0.5, 0));
  }
  if (card.guideMolt && !card.usesMolt) {
    target.add(scene.add.rectangle(centerX, top + 42, 76, 18, 0x2a1208, 0.94)
      .setStrokeStyle(1, 0xff9d4d, 0.95)
      .setName('combat-molt-guide-tag'));
    target.add(scene.add.text(centerX, top + 35, 'MOLT CARD', {
      fontFamily,
      fontSize: '9px',
      fontStyle: boldFontStyle,
      color: '#ffe1bd',
      align: 'center',
    }).setOrigin(0.5, 0).setName('combat-molt-guide-tag'));
  }
  if (card.guideCard && !card.guideMolt) {
    target.add(scene.add.rectangle(centerX, top + 42, 82, 18, 0x231d08, 0.94)
      .setStrokeStyle(1, 0xd8a840, 0.98)
      .setName('combat-first-card-guide-tag'));
    target.add(scene.add.text(centerX, top + 35, 'START HERE', {
      fontFamily,
      fontSize: '9px',
      fontStyle: boldFontStyle,
      color: '#fff0b8',
      align: 'center',
    }).setOrigin(0.5, 0).setName('combat-first-card-guide-tag'));
  }
  if (context.reinforcedColorCues) {
    renderCardColorCue(scene, target, left + 44, top + 68, card.label, card.accent, {
      name: 'combat-color-cue-badge',
      width: 82,
      height: 24,
    });
  }
  target.add(scene.add.circle(left + 16, top + 16, 14, card.cost === 0 ? 0x24d0d6 : 0xe8b830, 1).setStrokeStyle(2, 0x05080e, 0.9));
  target.add(scene.add.text(left + 16, top + 16, `${card.cost}`, {
    fontFamily,
    fontSize: '16px',
    fontStyle: boldFontStyle,
    color: '#06101c',
  }).setOrigin(0.5));

  const panelHeight = card.selected ? 72 : 48;
  target.add(scene.add.rectangle(centerX, bottom - panelHeight / 2 - 3, cardWidth - 6, panelHeight, 0x05080e, 0.82));
  target.add(scene.add.rectangle(centerX, bottom - panelHeight - 3, cardWidth - 6, 2, card.accent, 0.85));
  if (card.selected) {
    context.renderRichText(target, centerX, bottom - panelHeight + 8, card.summary, {
      wrap: cardWidth - 16,
      fontSize: 12,
      align: 'center',
      lineSpacing: 3,
      tooltips: true,
    });
  } else {
    target.add(scene.add.text(centerX, bottom - panelHeight + 8, compactSentenceText(card.summary, 54, 1), {
      fontFamily,
      fontSize: '10px',
      color: card.canPay ? '#c7d4df' : '#7f8b98',
      align: 'center',
      fixedWidth: cardWidth - 16,
      maxLines: 2,
      wordWrap: { width: cardWidth - 16 },
    }).setOrigin(0.5, 0));
  }

  if (card.buildsFlow) {
    const container = scene.add.container(0, 0);
    const background = scene.add.rectangle(centerX, bottom - 8, cardWidth - 18, 18, card.surgeNext ? 0x0d3b45 : 0x071b26, 0.96)
      .setStrokeStyle(1, card.surgeNext ? 0xd8a840 : 0x24d0d6, 0.82);
    const label = scene.add.text(centerX, bottom - 8, card.surgeNext ? 'SURGE NEXT  /  +1 FLOW' : '+1 FLOW', {
      fontFamily,
      fontSize: '9px',
      fontStyle: boldFontStyle,
      color: card.surgeNext ? '#ffe7a8' : '#bff8ff',
    }).setOrigin(0.5);
    container.add([background, label]);
    container.setVisible(card.flowVisible);
    target.add(container);
    result.flowIndicators.set(card.instanceId, { container, background, label });
  }
}

export function renderBattleHand(context: BattleHandRenderContext): BattleHandRenderResult {
  const result: BattleHandRenderResult = {
    rects: new Map(),
    artLayers: new Map(),
    frames: new Map(),
    selectionPulses: new Map(),
    flowIndicators: new Map(),
  };
  if (context.cards.length === 0) return result;
  if (textureReady(context.scene, context.assets.handRail)) {
    context.target.add(context.scene.add.image(context.width / 2, context.handY + 54, context.assets.handRail)
      .setDisplaySize(918, 128)
      .setAlpha(0.54));
  }
  context.cards.forEach((card, index) => renderCard(context, result, card, context.cardLeft(index, context.cards.length)));
  return result;
}

export function refreshBattleHandFlow(cards: BattleHandCardView[], result: BattleHandRenderResult) {
  cards.forEach((card) => {
    const indicator = result.flowIndicators.get(card.instanceId);
    if (!indicator?.container.active) return;
    indicator.container.setVisible(card.flowVisible);
    indicator.background
      .setFillStyle(card.surgeNext ? 0x0d3b45 : 0x071b26, 0.96)
      .setStrokeStyle(1, card.surgeNext ? 0xd8a840 : 0x24d0d6, 0.82);
    indicator.label
      .setText(card.surgeNext ? 'SURGE NEXT  /  +1 FLOW' : '+1 FLOW')
      .setColor(card.surgeNext ? '#ffe7a8' : '#bff8ff');
  });
}

export function refreshBattleHandSelection(
  context: Pick<BattleHandRenderContext, 'scene' | 'cardWidth' | 'cardHeight' | 'reducedMotion'>,
  cards: BattleHandCardView[],
  result: BattleHandRenderResult,
) {
  cards.forEach((card) => {
    const rect = result.rects.get(card.instanceId);
    if (!rect?.scene) return;
    const guided = card.guideMolt || card.guideCard;
    rect.setStrokeStyle(
      card.selected ? 5 : guided ? 4 : 2,
      card.selected ? 0x24d0d6 : card.guideMolt ? 0xff9d4d : card.guideCard ? 0xd8a840 : card.accent,
      1,
    );
    const frame = result.frames.get(card.instanceId);
    if (frame?.scene) {
      frame
        .setDisplaySize(card.selected ? context.cardWidth + 24 : guided ? context.cardWidth + 20 : context.cardWidth + 16, card.selected ? context.cardHeight + 36 : guided ? context.cardHeight + 30 : context.cardHeight + 24)
        .setAlpha(card.selected ? 0.96 : guided ? 0.82 : card.canPay ? 0.52 : 0.26);
    }
    const pulse = result.selectionPulses.get(card.instanceId);
    if (!pulse?.scene) return;
    context.scene.tweens.killTweensOf(pulse);
    pulse
      .setDisplaySize(card.selected ? context.cardWidth + 38 : context.cardWidth + 32, card.selected ? context.cardHeight + 54 : context.cardHeight + 46)
      .setAlpha(card.selected ? 0.54 : card.guideMolt ? 0.42 : card.guideCard ? 0.38 : 0)
      .setName(card.guideMolt
        ? 'combat-molt-guide-pulse'
        : card.guideCard
          ? 'combat-first-card-guide-pulse'
          : 'combat-hand-selected-pulse');
    if ((card.selected || guided) && !context.reducedMotion) {
      context.scene.tweens.add({
        targets: pulse,
        alpha: 0.34,
        scaleX: pulse.scaleX * 1.035,
        scaleY: pulse.scaleY * 1.035,
        duration: 960,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  });
  refreshBattleHandFlow(cards, result);
}

export function renderBattleHandPreview(
  context: BattleHandPreviewContext,
  card: BattleHandCardPreviewView,
  instanceId: string,
  previewX = context.width / 2,
) {
  const { scene, target, width, handY, cardHeight, fontFamily, boldFontStyle } = context;
  const previewWidth = 300;
  const previewHeight = Math.round(previewWidth * 1.5);
  const centerX = Phaser.Math.Clamp(previewX, previewWidth / 2 + 8, width - previewWidth / 2 - 8);
  const centerY = Math.max(previewHeight / 2 + 8, handY - cardHeight / 2 - previewHeight / 2 - 2);
  const top = centerY - previewHeight / 2;
  const bottom = centerY + previewHeight / 2;
  const container = scene.add.container(0, 0);
  container.add(scene.add.rectangle(centerX, centerY, previewWidth + 8, previewHeight + 8, 0x06090f, 0.99).setStrokeStyle(3, card.accent, 1));
  const artLayer = scene.add.container(0, 0);
  addCardArt(
    { scene, renderSnagArt: context.renderSnagArt },
    artLayer,
    { instanceId, artKey: card.artKey, snag: card.snag, fallbackLabel: card.fallbackLabel },
    centerX,
    centerY,
    previewWidth,
    previewHeight,
    1,
  );
  container.add(artLayer);
  if (textureReady(scene, context.assets.hoverDossierFrame)) {
    container.add(scene.add.image(centerX, centerY, context.assets.hoverDossierFrame)
      .setDisplaySize(previewWidth + 26, previewHeight + 38)
      .setAlpha(0.94)
      .setName('card-hover-dossier-frame'));
  }
  container.add(scene.add.rectangle(centerX, top + 22, previewWidth - 4, 40, 0x05080e, 0.72));
  container.add(scene.add.text(centerX - previewWidth / 2 + 52, top + 9, card.name, {
    fontFamily,
    fontSize: '21px',
    fontStyle: boldFontStyle,
    color: '#ffe7b0',
    wordWrap: { width: previewWidth - 72 },
  }));
  container.add(scene.add.text(centerX + previewWidth / 2 - 12, top + 10, card.upgraded ? 'Preen' : 'Base', {
    fontFamily,
    fontSize: '10px',
    fontStyle: boldFontStyle,
    color: card.upgraded ? context.cyanColor : context.softColor,
  }).setOrigin(1, 0));
  container.add(scene.add.circle(centerX - previewWidth / 2 + 26, top + 24, 20, card.cost === 0 ? 0x24d0d6 : 0xe8b830, 1).setStrokeStyle(2, 0x05080e, 0.9));
  container.add(scene.add.text(centerX - previewWidth / 2 + 26, top + 24, `${card.cost}`, {
    fontFamily,
    fontSize: '23px',
    fontStyle: boldFontStyle,
    color: '#06101c',
  }).setOrigin(0.5));

  const panelHeight = card.alternateText ? 152 : 118;
  container.add(scene.add.rectangle(centerX, bottom - panelHeight / 2 - 4, previewWidth - 4, panelHeight, 0x05080e, 0.92));
  container.add(scene.add.rectangle(centerX, bottom - panelHeight - 4, previewWidth - 4, 2, card.accent, 0.85));
  let textY = bottom - panelHeight + 6;
  if (card.usesMolt) {
    container.add(scene.add.text(centerX, textY, 'MOLT ACTIVE', {
      fontFamily,
      fontSize: '11px',
      fontStyle: boldFontStyle,
      color: '#ffc78f',
    }).setOrigin(0.5, 0));
    textY += 14;
  }
  textY += context.renderRichText(container, centerX, textY, card.currentText, {
    wrap: previewWidth - 24,
    fontSize: 15,
    align: 'center',
    lineSpacing: 2,
  }) + 6;
  if (card.alternateText && card.alternateLabel) {
    context.renderRichText(container, centerX, textY, `${card.alternateLabel}: ${card.alternateText}`, {
      wrap: previewWidth - 24,
      fontSize: 12,
      align: 'center',
      baseColor: card.usesMolt ? '#b9c7d6' : '#ff9d4d',
      bold: true,
      lineSpacing: 2,
    });
  }
  container.add(scene.add.text(centerX, bottom - 43, 'Flock Stats', {
    fontFamily,
    fontSize: '10px',
    fontStyle: boldFontStyle,
    color: context.softColor,
  }).setOrigin(0.5));
  if (textureReady(scene, context.assets.hoverStatChipFrame)) {
    container.add(scene.add.image(centerX, bottom - 18, context.assets.hoverStatChipFrame)
      .setDisplaySize(previewWidth - 40, 34)
      .setAlpha(0.78)
      .setName('card-hover-stat-chip-frame'));
  }
  container.add(scene.add.text(centerX, bottom - 12, card.stats, {
    fontFamily,
    fontSize: '11px',
    fontStyle: boldFontStyle,
    color: context.cyanColor,
    align: 'center',
    wordWrap: { width: previewWidth - 20 },
  }).setOrigin(0.5, 1));
  target.add(container);
  return container;
}

export {
  closeRewardCardInspection,
  focusedRewardCard,
  openRewardCardInspection,
  renderRewardInspectButton,
  syncRewardCardInspection,
} from '../reward-card-inspection';
