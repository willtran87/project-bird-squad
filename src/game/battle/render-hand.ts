import Phaser from 'phaser';
import { renderCardColorCue } from '../card-color-cues';
import { fitTextExcerpt } from '../text-excerpt';
import { renderRewardHoverPreview } from '../reward-card-inspection';
import { readableHandRules, fitHandRules, wrapHandRules } from './hand-rule-summary';
import { DECISION_UI, MIN_SUPPORTED_TOUCH_TARGET, UI_TYPE } from '../theme';
import { itemKeywordSections } from '../keyword-definitions';
import { renderCombatReader, renderCombatCardDetail as renderCardReadingPanel, renderCombatHistory as renderHistoryReadingPanel, type CardDetailContext } from './card-detail';

export function renderWaymarkRewardDetail(context: Omit<CardDetailContext, 'ui' | 'typography'>, name: string, description: string, meta: string, notes: string[]) {
  const sections = [
    { heading: 'EFFECT', body: description },
    { heading: 'CONTEXT', body: `${meta}\n\n${notes.join('\n')}\n\nCard counts include conditional and Molt effects, not guaranteed triggers.\n\nBack returns to the same reward choice. Nothing is claimed here.` },
  ];
  sections.push(...itemKeywordSections([{ title: 'EFFECT', text: description }])
    .map(section => ({ heading: section.title, body: section.text })));
  return renderCombatReader({ ...context, ui: DECISION_UI, typography: UI_TYPE }, {
    name, kind: 'waymark', badge: 'Reading only', sections,
  });
}

export function renderCombatHistory(context: Omit<CardDetailContext, 'ui' | 'typography'>, entries: string[]) {
  return renderHistoryReadingPanel({ ...context, ui: DECISION_UI, typography: UI_TYPE }, entries);
}

export function renderCombatCardDetail(context: Omit<CardDetailContext, 'ui' | 'typography'>, card: BattleHandCardPreviewView) {
  return renderCardReadingPanel({ ...context, ui: DECISION_UI, typography: UI_TYPE }, card);
}

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
  sequence?: string;
  outcome?: string;
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
  retainOrder?: number;
  retainSelectable?: boolean;
  discardSelectable?: boolean;
  discardSelected?: boolean;
  discardFocused?: boolean;
  discardOrder?: number;
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
    options: { wrap: number; fontSize: number; align: 'left' | 'center'; lineSpacing: number; tooltips?: boolean; baseColor?: string; bold?: boolean; resolution?: number },
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
  renderDiscardTag: (
    target: Phaser.GameObjects.Container,
    card: BattleHandCardView,
    x: number,
    y: number,
  ) => void;
}

export interface BattleHandPreviewContext {
  combat?: boolean;
  inspectLabel?: string;
  onInspect?: () => void;
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

function fitCardText(label: Phaser.GameObjects.Text, source: string, maxLines: number) {
  // Measure actual wrapped lines, not character counts. Always signal omission;
  // the unchanged hover/selection dossier exposes the complete authored rules.
  fitTextExcerpt(label, source, maxLines);
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
    const image = scene.add.image(x, y, card.artKey).setAlpha(alpha).setName('combat-hand-illustration');
    image.setScale(Math.min(width / image.width, height / image.height));
    target.add(image);
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
    centerX - context.cardWidth / 2 + 32,
    context.handY - context.cardHeight / 2 + 50,
    60,
    90,
    card.discardSelectable !== undefined ? card.discardSelectable ? 1 : 0.42 : card.canPay ? 1 : 0.55,
  );
}


function renderCard(
  context: BattleHandRenderContext,
  result: BattleHandRenderResult,
  card: BattleHandCardView,
  left: number,
) {
  const { scene, target, handY, cardWidth, cardHeight, fontFamily, boldFontStyle } = context;
  const presentationStart = target.list.length;
  const centerX = left + cardWidth / 2;
  const top = handY - cardHeight / 2;
  const bottom = handY + cardHeight / 2;
  const rect = scene.add.rectangle(centerX, handY, cardWidth, cardHeight, 0x0a0f18, 1)
    .setStrokeStyle(
      card.discardSelected ? 3 : card.discardFocused ? 3 : card.selected ? 3 : card.guideMolt || card.guideCard ? 3 : 1,
      card.discardSelected ? 0xff6b57 : card.discardFocused ? 0xd8a840 : card.selected ? 0x24d0d6 : card.guideMolt ? 0xff9d4d : card.guideCard ? 0xd8a840 : card.accent,
      1,
    )
    .setInteractive({ useHandCursor: card.discardSelectable ?? (card.canPay || card.retainSelectable) });
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

  if (card.usesMolt && textureReady(scene, context.assets.cardFrame)) {
    const guided = card.guideMolt || card.guideCard;
    const frame = scene.add.image(centerX, handY, context.assets.cardFrame)
      .setDisplaySize(cardWidth - 2, cardHeight - 2)
      .setAlpha(card.selected ? 0.96 : guided ? 0.82 : card.canPay ? 0.52 : 0.26)
      .setName('combat-hand-card-frame');
    target.add(frame);
    result.frames.set(card.instanceId, frame);
  }

  // A reserved portrait beside the name keeps the entire illustration visible.
  // Text and state badges must never turn it into an accidental cropped strip.
  target.add(scene.add.rectangle(left + 64 + (cardWidth - 68) / 2, top + 50, cardWidth - 68, 90, 0x081624, 0.98)
    .setName('combat-card-title-panel'));
  const title = scene.add.text(left + 64, top + 5, card.name, {
    fontFamily,
    fontSize: '21px',
    fontStyle: boldFontStyle,
    color: card.canPay ? '#ffe7b0' : '#9aa7b6',
    wordWrap: { width: cardWidth - 68, useAdvancedWrap: true }, maxLines: 3, resolution: 2,
  }).setName('combat-card-title');
  fitCardText(title, card.name, 3);
  title.setY(top + 50 - title.height / 2);
  target.add(title);
  // Two reserved rows between title and rules: identity/choice, then Flow.
  // Their geometry never depends on which other badges happen to be active.
  const badgeY = top + 111;
  if (card.usesMolt || card.guideMolt) {
    const badgeName = card.usesMolt ? 'combat-card-molt-badge' : 'combat-molt-guide-tag';
    target.add(scene.add.rectangle(left + 62, badgeY, 60, 28, 0x2a1208, 0.96)
      .setStrokeStyle(1, 0xff9d4d, 0.78).setName(badgeName));
    target.add(scene.add.text(left + 62, badgeY, card.usesMolt ? 'MOLT' : 'Molt?', {
      fontFamily,
      fontSize: UI_TYPE.secondary,
      fontStyle: boldFontStyle,
      color: '#ffc78f',
      align: 'center',
      resolution: 2,
    }).setOrigin(0.5).setName(card.usesMolt ? 'combat-card-molt-label' : badgeName));
  }
  if (card.guideCard && !card.guideMolt && !card.usesMolt) {
    target.add(scene.add.circle(left + 62, badgeY, 12, 0x231d08, 0.96)
      .setStrokeStyle(2, 0xd8a840, 0.98)
      .setName('combat-first-card-guide-tag'));
    target.add(scene.add.text(left + 62, badgeY, '1', {
      fontFamily,
      fontSize: UI_TYPE.secondary,
      fontStyle: boldFontStyle,
      color: '#fff0b8',
      align: 'center',
    }).setOrigin(0.5).setName('combat-first-card-guide-tag'));
  }
  if (card.retainOrder && !card.discardSelectable) {
    target.add(scene.add.rectangle(left + cardWidth - 44, badgeY, 84, 28, 0x08241f, 0.96)
      .setStrokeStyle(1, 0x8fd6a0, 0.96)
      .setName('combat-retain-priority-tag')
      .setData('order', card.retainOrder));
    target.add(scene.add.text(left + cardWidth - 44, badgeY, `KEEP ${card.retainOrder}`, {
      fontFamily,
      fontSize: UI_TYPE.secondary,
      resolution: UI_TYPE.resolution,
      fontStyle: boldFontStyle,
      color: '#dfffe8',
      align: 'center',
    }).setOrigin(0.5).setName('combat-retain-priority-tag').setData('order', card.retainOrder));
  }
  if (card.discardSelectable) {
    context.renderDiscardTag(target, card, left + cardWidth - 44, badgeY);
  }
  if (context.reinforcedColorCues) {
    renderCardColorCue(scene, target, left + 16, badgeY, card.label, card.accent, {
      name: 'combat-color-cue-badge',
      width: 26,
      height: 28,
      iconOnly: true,
    });
  }
  target.add(scene.add.circle(left + 16, top + 141, 14, card.cost === 0 ? 0x24d0d6 : 0xe8b830, 1).setStrokeStyle(2, 0x05080e, 0.9));
  target.add(scene.add.text(left + 16, top + 141, `${card.cost}`, {
    fontFamily,
    fontSize: '21px',
    fontStyle: boldFontStyle,
    color: '#06101c', resolution: 2,
  }).setOrigin(0.5));

  const panelHeight = 110;
  target.add(scene.add.rectangle(centerX, bottom - panelHeight / 2 - 3, cardWidth - 6, panelHeight, 0x081624, 0.98)
    .setName('combat-card-rules-panel'));
  {
    const summary = scene.add.text(left + 8, bottom - panelHeight + 6, '', {
      fontFamily,
      fontSize: '21px', resolution: 2, lineSpacing: 1,
      color: card.canPay ? '#e5edf0' : '#a8b6bf',
      align: 'left',
      maxLines: 4,
      wordWrap: { width: cardWidth - 16, callback: (text: string, label: Phaser.GameObjects.Text) =>
        wrapHandRules(text, value => label.context.measureText(value).width, cardWidth - 16) },
    }).setName('combat-card-readable-summary');
    const readable = readableHandRules(card.summary.split('\n'));
    const excerpt = fitHandRules(readable, text => summary.getWrappedText(text).length <= 4, 2);
    summary.setText(excerpt.text).setData('truncated', excerpt.omitted > 0)
      .setData('omittedEffects', excerpt.omitted).setData('readableRules', readable);
    summary.setData('fullText', card.preview.currentText.replace(/\s+/g, ' ').trim())
      .setData('quickRead', card.summary);
    target.add(summary);
  }

  if (card.buildsFlow) {
    const container = scene.add.container(0, 0);
    const background = scene.add.rectangle(centerX + 14, top + 141, cardWidth - 36, 28, card.surgeNext ? 0x0d3b45 : 0x071b26, 0.96)
      .setStrokeStyle(1, card.surgeNext ? 0xd8a840 : 0x24d0d6, 0.82);
    const label = scene.add.text(centerX + 14, top + 141, card.surgeNext ? '+1 Flow · Surge' : '+1 Flow', {
      fontFamily,
      fontSize: UI_TYPE.secondary,
      resolution: UI_TYPE.resolution,
      fontStyle: boldFontStyle,
      color: card.surgeNext ? '#ffe7a8' : '#bff8ff',
    }).setOrigin(0.5);
    container.add([background, label]);
    container.setVisible(card.flowVisible);
    target.add(container);
    result.flowIndicators.set(card.instanceId, { container, background, label });
  }
  rect.setData('presentation', target.list.slice(presentationStart));
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
      .setText(card.surgeNext ? '+1 Flow · Surge' : '+1 Flow')
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
      card.selected ? 3 : guided ? 3 : 1,
      card.selected ? 0x24d0d6 : card.guideMolt ? 0xff9d4d : card.guideCard ? 0xd8a840 : card.accent,
      1,
    );
    const frame = result.frames.get(card.instanceId);
    if (frame?.scene) {
      frame
        .setDisplaySize(context.cardWidth - 2, context.cardHeight - 2)
        .setAlpha(card.selected ? 0.96 : guided ? 0.82 : card.canPay ? 0.52 : 0.26);
    }
  });
  refreshBattleHandFlow(cards, result);
}

function renderCombatCardDossier(context: BattleHandPreviewContext) {
  if (context.onInspect) {
    const container = context.scene.add.container(26, 472).setName('combat-card-inspect-control');
    const hit = context.scene.add.rectangle(64, 33, 128, MIN_SUPPORTED_TOUCH_TARGET, DECISION_UI.surface, 0.98)
      .setStrokeStyle(1, DECISION_UI.border, 0.8).setInteractive({ useHandCursor: true })
      .setName('combat-card-inspect-hit');
    container.add(hit);
    container.add(context.scene.add.text(64, 10, 'Full rules', {
      fontFamily: context.fontFamily, fontSize: '21px', fontStyle: context.boldFontStyle,
      color: DECISION_UI.text, resolution: DECISION_UI.resolution,
    }).setOrigin(0.5, 0));
    container.add(context.scene.add.text(64, 40, context.inspectLabel ?? 'Help', {
      fontFamily: context.fontFamily, fontSize: '18px', color: DECISION_UI.secondary,
      resolution: DECISION_UI.resolution,
    }).setOrigin(0.5, 0).setName('combat-card-inspect-shortcut'));
    hit.on('pointerover', () => hit.setStrokeStyle(2, DECISION_UI.accent, 1));
    hit.on('pointerout', () => hit.setStrokeStyle(1, DECISION_UI.border, 0.8));
    hit.on('pointerdown', context.onInspect);
    context.target.add(container);
    return container;
  }
  throw new Error('Missing card inspection action.');
}

export function renderBattleHandPreview(
  context: BattleHandPreviewContext,
  card: BattleHandCardPreviewView,
  _instanceId: string,
  previewX = context.width / 2,
) {
  if (context.combat) return renderCombatCardDossier(context);
  return renderRewardHoverPreview(context, card, previewX);
}

export {
  armCombatRewardAt,
  cardPickerDeckImpact,
  closeRewardCardInspection,
  focusedRewardCard,
  openRewardCardInspection,
  renderCombatRewardLoading,
  renderCombatRewardFallback,
  renderRewardSkipFallback,
  requestCombatReward,
  requestCombatRewardAt,
  rewardDeckImpact,
  syncRewardCardInspection,
} from '../reward-card-inspection';
