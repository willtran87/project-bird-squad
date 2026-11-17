import { setTextureFilter } from '../texture-filter';
import Phaser from 'phaser';
import { renderCardColorCue } from '../card-color-cues';
import { fitTextExcerpt } from '../text-excerpt';
import { renderRewardHoverPreview } from '../reward-card-inspection';
import { readableHandRules, actionFirstHandRules, fitHandRules, wrapHandRules } from './hand-rule-summary';
import { DECISION_UI, MIN_SUPPORTED_TOUCH_TARGET, UI_DISPLAY_FONT, UI_TYPE } from '../theme';
import { itemKeywordSections } from '../keyword-definitions';
import { renderCombatReader, renderCombatCardDetail as renderCardReadingPanel, renderCombatHistory as renderHistoryReadingPanel, type CardDetailContext } from './card-detail';

export function renderWaymarkRewardDetail(context: Omit<CardDetailContext, 'ui' | 'typography'>, name: string, description: string, meta: string, notes: string[]) {
  const sections = [
    { heading: 'EFFECT', body: description },
    { heading: 'CONTEXT', body: `${meta}\n\n${notes.join('\n')}\n\nCounts include conditional and Molt effects; triggers are not guaranteed.\n\nReading only. Back keeps your reward choice.` },
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
  setTextureFilter(scene.textures.get(key), Phaser.Textures.FilterMode.LINEAR);
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

const CARD_RADIUS = 9;
const CARD_ART_INSET = 4;
const CARD_GLOW_TEXTURE = 'combat-hand-card-glow';
const CARD_GLOW_PAD = 22;
const HOVER_LIFT = 10;
const SELECTED_LIFT = 12;

/** One soft rounded halo, generated once and tinted per card state. */
function ensureGlowTexture(scene: Phaser.Scene, cardWidth: number, cardHeight: number) {
  if (scene.textures.exists(CARD_GLOW_TEXTURE)) return;
  const width = cardWidth + CARD_GLOW_PAD * 2, height = cardHeight + CARD_GLOW_PAD * 2;
  const glow = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let step = 0; step < CARD_GLOW_PAD; step += 2) {
    glow.fillStyle(0xffffff, 0.05 + step * 0.004);
    glow.fillRoundedRect(step, step, width - step * 2, height - step * 2, CARD_RADIUS + CARD_GLOW_PAD - step);
  }
  glow.generateTexture(CARD_GLOW_TEXTURE, width, height);
  glow.destroy();
}

type GlowState = Pick<BattleHandCardView, 'selected' | 'guideCard' | 'guideMolt' | 'accent' | 'canPay'>
  & Partial<Pick<BattleHandCardView, 'discardSelected' | 'discardFocused' | 'discardSelectable'>>;

function glowStyle(card: GlowState) {
  if (card.discardSelected) return { tint: 0xff6b57, alpha: 0.9 };
  if (card.discardFocused) return { tint: 0xd8a840, alpha: 0.85 };
  if (card.selected) return { tint: 0x24d0d6, alpha: 0.95 };
  if (card.guideMolt) return { tint: 0xff9d4d, alpha: 0.8 };
  if (card.guideCard) return { tint: 0xd8a840, alpha: 0.8 };
  const live = card.discardSelectable ?? card.canPay;
  return { tint: card.accent, alpha: live ? 0.34 : 0 };
}

/** Raise or settle one card. Every presentation object moves with its hit
 * rectangle, and the hit area grows downward so a raised card cannot slip out
 * from under the pointer and flicker. */
function liftCard(scene: Phaser.Scene, rect: Phaser.GameObjects.Rectangle, cardHeight: number, reducedMotion: boolean) {
  const lift = rect.getData('selected') ? SELECTED_LIFT : rect.getData('hovered') ? HOVER_LIFT : 0;
  if (rect.getData('liftTarget') === lift) return;
  rect.setData('liftTarget', lift);
  (rect.getData('liftTween') as Phaser.Tweens.Tween | undefined)?.stop();
  const objects = rect.getData('presentation') as Array<Phaser.GameObjects.GameObject & { y: number }>;
  const apply = (value: number) => {
    if (!rect.scene) return;
    const delta = value - ((rect.getData('lift') as number | undefined) ?? 0);
    rect.setData('lift', value);
    objects.forEach((object) => { object.y -= delta; });
    const hitArea = rect.input?.hitArea as Phaser.Geom.Rectangle | undefined;
    if (hitArea) hitArea.height = cardHeight + value;
  };
  if (reducedMotion) { apply(lift); return; }
  rect.setData('liftTween', scene.tweens.addCounter({
    from: (rect.getData('lift') as number | undefined) ?? 0, to: lift, duration: 110, ease: 'Cubic.easeOut',
    onUpdate: (tween) => apply(tween.getValue() ?? lift),
  }));
}

export function renderBattleHandCardArt(
  context: BattleHandRenderContext,
  target: Phaser.GameObjects.Container,
  card: BattleHandCardView,
  centerX: number,
) {
  const live = card.discardSelectable ?? card.canPay;
  // The full portrait is the card face. Prefer the detailed texture once it
  // has loaded; the compact thumbnail keeps the first frame complete.
  const detailed = card.preview.artKey && textureReady(context.scene, card.preview.artKey) ? card.preview.artKey : card.artKey;
  addCardArt(
    context,
    target,
    { ...card, artKey: detailed },
    centerX,
    context.handY,
    context.cardWidth - CARD_ART_INSET * 2,
    context.cardHeight - CARD_ART_INSET * 2,
    live ? 1 : 0.78,
  );
  const art = target.getByName('combat-hand-illustration') as Phaser.GameObjects.Image | null;
  if (art && !live) art.setTint(0x7c8794);
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
  ensureGlowTexture(scene, cardWidth, cardHeight);
  target.add(scene.add.image(centerX, handY + 7, CARD_GLOW_TEXTURE).setTint(0x000000).setAlpha(0.6)
    .setName('combat-hand-card-shadow'));
  const glowState = glowStyle(card);
  const glow = scene.add.image(centerX, handY, CARD_GLOW_TEXTURE).setTint(glowState.tint).setAlpha(glowState.alpha)
    .setBlendMode(Phaser.BlendModes.ADD).setName('combat-hand-card-glow');
  target.add(glow);
  result.selectionPulses.set(card.instanceId, glow);
  const rect = scene.add.rectangle(centerX, handY, cardWidth, cardHeight, 0x0a0f18, 1)
    .setRounded(CARD_RADIUS)
    .setStrokeStyle(
      card.discardSelected ? 3 : card.discardFocused ? 3 : card.selected ? 3 : card.guideMolt || card.guideCard ? 3 : 2,
      card.discardSelected ? 0xff6b57 : card.discardFocused ? 0xd8a840 : card.selected ? 0x24d0d6 : card.guideMolt ? 0xff9d4d : card.guideCard ? 0xd8a840 : card.accent,
      1,
    )
    .setInteractive({ useHandCursor: card.discardSelectable ?? (card.canPay || card.retainSelectable) });
  rect.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event?: Phaser.Types.Input.EventData) => {
    event?.stopPropagation();
    context.onCardClick(card.instanceId);
  });
  rect.on('pointerover', () => {
    rect.setData('hovered', true);
    liftCard(scene, rect, cardHeight, context.reducedMotion);
    context.onCardHover(card.instanceId);
  });
  rect.on('pointerout', () => {
    rect.setData('hovered', false);
    liftCard(scene, rect, cardHeight, context.reducedMotion);
    context.onCardOut();
  });
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

  // The portrait fills the card. A name banner and the rules panel bracket an
  // unobstructed window onto the illustration; neither may grow into it.
  const title = scene.add.text(left + 42, top + 5, card.name, {
    fontFamily: UI_DISPLAY_FONT,
    fontSize: '21px',
    fontStyle: boldFontStyle,
    color: card.canPay ? '#ffe7b0' : '#aab5c1',
    wordWrap: { width: cardWidth - 48, useAdvancedWrap: true }, maxLines: 2, resolution: 2,
  }).setName('combat-card-title');
  fitCardText(title, card.name, 2);
  const bannerHeight = Math.max(38, Math.ceil(title.height) + 8);
  target.add(scene.add.rectangle(centerX, top + CARD_ART_INSET + bannerHeight / 2, cardWidth - CARD_ART_INSET * 2, bannerHeight, 0x081624, 0.94)
    .setName('combat-card-title-panel'));
  target.add(scene.add.rectangle(centerX, top + CARD_ART_INSET + bannerHeight, cardWidth - CARD_ART_INSET * 2, 2, card.accent, card.canPay ? 0.9 : 0.4)
    .setName('combat-card-title-rule'));
  title.setY(top + CARD_ART_INSET + bannerHeight / 2 - title.height / 2);
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
  // The cost sits in the banner as a recessed coin: dark face, bright rim.
  const coinY = top + CARD_ART_INSET + 19;
  target.add(scene.add.circle(left + 22, coinY, 15, 0x05080e, 1)
    .setStrokeStyle(2, card.cost === 0 ? 0x24d0d6 : 0xe8b830, card.canPay ? 1 : 0.5)
    .setName('combat-card-cost-coin'));
  target.add(scene.add.text(left + 22, coinY, `${card.cost}`, {
    fontFamily,
    fontSize: '21px',
    fontStyle: boldFontStyle,
    color: card.cost === 0 ? '#8df4ff' : card.canPay ? '#ffd76a' : '#b9a36a', resolution: 2,
  }).setOrigin(0.5).setName('combat-card-cost'));

  const panelHeight = 110;
  target.add(scene.add.rectangle(centerX, bottom - panelHeight / 2 - CARD_ART_INSET, cardWidth - CARD_ART_INSET * 2, panelHeight, 0x081624, 0.95)
    .setName('combat-card-rules-panel'));
  target.add(scene.add.rectangle(centerX, bottom - panelHeight - CARD_ART_INSET, cardWidth - CARD_ART_INSET * 2, 2, card.accent, card.canPay ? 0.9 : 0.4)
    .setName('combat-card-rules-rule'));
  {
    const summary = scene.add.text(left + 10, bottom - panelHeight + 2, '', {
      fontFamily,
      fontSize: '21px', resolution: 2, lineSpacing: 1,
      color: card.canPay ? '#e5edf0' : '#a8b6bf',
      align: 'left',
      maxLines: 4,
      wordWrap: { width: cardWidth - 20, callback: (text: string, label: Phaser.GameObjects.Text) =>
        wrapHandRules(text, value => label.context.measureText(value).width, cardWidth - 20) },
    }).setName('combat-card-readable-summary');
    const readable = readableHandRules(card.summary.split('\n'));
    const excerpt = fitHandRules(actionFirstHandRules(readable), text => summary.getWrappedText(text).length <= 4);
    summary.setText(excerpt.text).setData('truncated', excerpt.omitted > 0)
      .setData('omittedEffects', excerpt.omitted).setData('readableRules', readable);
    summary.setData('fullText', card.preview.currentText.replace(/\s+/g, ' ').trim())
      .setData('quickRead', card.summary);
    target.add(summary);
  }

  if (card.buildsFlow) {
    const container = scene.add.container(0, 0);
    const background = scene.add.rectangle(centerX, top + 140, cardWidth - 16, 26, card.surgeNext ? 0x0d3b45 : 0x071b26, 0.96)
      .setStrokeStyle(1, card.surgeNext ? 0xd8a840 : 0x24d0d6, 0.82);
    const label = scene.add.text(centerX, top + 140, card.surgeNext ? '+1 Flow · Surge' : '+1 Flow', {
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
  rect.setData('selected', card.selected);
  if (card.selected) {
    // Arrive already raised: a redraw must not replay the lift.
    rect.setData('liftTarget', SELECTED_LIFT).setData('lift', SELECTED_LIFT);
    (rect.getData('presentation') as Array<{ y: number }>).forEach((object) => { object.y -= SELECTED_LIFT; });
    (rect.input?.hitArea as Phaser.Geom.Rectangle).height = cardHeight + SELECTED_LIFT;
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
  context.cards.forEach((card, index) => renderCard(context, result, card, context.cardLeft(index, context.cards.length)));
  return result;
}

type BattleHandSelectionView = Pick<BattleHandCardView,
  'instanceId' | 'selected' | 'guideCard' | 'guideMolt' | 'accent' | 'canPay' | 'flowVisible' | 'surgeNext'>;

export function refreshBattleHandFlow(cards: Pick<BattleHandSelectionView, 'instanceId' | 'flowVisible' | 'surgeNext'>[], result: BattleHandRenderResult) {
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
  cards: BattleHandSelectionView[],
  result: BattleHandRenderResult,
) {
  cards.forEach((card) => {
    const rect = result.rects.get(card.instanceId);
    if (!rect?.scene) return;
    const guided = card.guideMolt || card.guideCard;
    rect.setStrokeStyle(
      card.selected ? 3 : guided ? 3 : 2,
      card.selected ? 0x24d0d6 : card.guideMolt ? 0xff9d4d : card.guideCard ? 0xd8a840 : card.accent,
      1,
    );
    const glow = result.selectionPulses.get(card.instanceId);
    if (glow?.scene) { const style = glowStyle(card); glow.setTint(style.tint).setAlpha(style.alpha); }
    rect.setData('selected', card.selected);
    liftCard(context.scene, rect, context.cardHeight, context.reducedMotion);
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
  card: BattleHandCardPreviewView | undefined,
  _instanceId: string,
  previewX = context.width / 2,
) {
  if (context.combat) return renderCombatCardDossier(context);
  if (!card) throw new Error('Reward preview requires a card.');
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
