import { setTextureFilter } from '../texture-filter';
import Phaser from 'phaser';
import { renderCardColorCue } from '../card-color-cues';
import { fitTextExcerpt } from '../text-excerpt';
import { renderRewardHoverPreview } from '../reward-card-inspection';
import { readableHandRules, actionFirstHandRules, compactHandRules, fitDeferredHandRules, wrapHandRules } from './hand-rule-summary';
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

/** Rules face tiers, largest first. The face shows every effect: tighter
 * phrasing before a smaller type size, and never below the compact floor. */
export const HAND_RULE_FONT_TIERS = [21, 19, 18, 17, 16, 15] as const;
/** Sizes at or above the compact-viewport type floor (14 CSS px at 1000 wide). */
const HAND_RULE_READABLE_FLOOR = 18;
export const HAND_RULE_PANEL_HEIGHT = 110;
/** Art window kept between the title banner and a raised rules panel. Dense
 * cards may trade art for rules down to the compact window, never further. */
export const HAND_ART_WINDOW = 90;
export const HAND_COMPACT_ART_WINDOW = 54;
const HAND_RULE_TOP_PAD = 5;

/** Choose phrasing, type size and panel height so the face shows every
 * effect: full wording, then the compact dialect at shrinking sizes, then
 * taller panels. Only later-resolving clauses may ever yield to "Inspect". */
export function fitHandFaceRules(label: Phaser.GameObjects.Text, readable: string, panelHeights: number[]) {
  const full = actionFirstHandRules(readable);
  const compact = compactHandRules(readable);
  const fitsAt = (size: number, panel: number, tidy = false) => (text: string) => {
    label.setFontSize(size).setText(text);
    // At roomy sizes, also refuse a stranded one-word line ("Gain" / "1 Resonance.").
    const stranded = tidy && label.getWrappedText().some(line => /^\S+$/.test(line.trim()));
    return !stranded && label.height <= panel - HAND_RULE_TOP_PAD - 2;
  };
  const heights = [...new Set(panelHeights)].sort((a, z) => a - z);
  const candidates: Array<[number, number, string, string]> = [[21, heights[0], full, 'full']];
  // Raise the panel (trading art) before dropping below the readable floor;
  // only then shrink the type, still raising the panel as needed.
  const tier = (step: number, size: number) => `${['compact', 'tall', 'dense'][step]}-${size}`;
  heights.forEach((panel, step) => {
    for (const size of HAND_RULE_FONT_TIERS) if (size >= HAND_RULE_READABLE_FLOOR && (step === 0 || size < 21))
      candidates.push([size, panel, compact, tier(step, size)]);
  });
  for (const size of HAND_RULE_FONT_TIERS) if (size < HAND_RULE_READABLE_FLOOR)
    heights.forEach((panel, step) => candidates.push([size, panel, compact, tier(step, size)]));
  for (const tidy of [true, false]) for (const [size, panel, text, tier] of candidates) {
    if (tidy && size < HAND_RULE_READABLE_FLOOR) continue;
    if (fitsAt(size, panel, tidy)(text)) return { text, fontSize: size, panelHeight: panel, omitted: 0, tier };
  }
  const floor = HAND_RULE_FONT_TIERS[HAND_RULE_FONT_TIERS.length - 1];
  const tallest = heights[heights.length - 1];
  const deferred = fitDeferredHandRules(compact, fitsAt(floor, tallest));
  if (deferred) return { ...deferred, fontSize: floor, panelHeight: tallest, tier: 'deferred-omitted' };
  // Nothing may hide: grow the panel to the text rather than clip a rule.
  label.setFontSize(floor).setText(compact);
  return { text: compact, fontSize: floor, panelHeight: Math.ceil(label.height) + HAND_RULE_TOP_PAD + 2, omitted: 0, tier: 'overflow' };
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

/** Hover answers with light, not movement: card bounds are a layout contract
 * (forecast clearance, touch separation, pile motion), so the halo brightens
 * and nothing shifts. */
function hoverCard(rect: Phaser.GameObjects.Rectangle, hovered: boolean) {
  const glow = rect.getData('halo') as Phaser.GameObjects.Image | undefined;
  if (!glow?.active) return;
  const rest = (rect.getData('haloAlpha') as number | undefined) ?? glow.alpha;
  glow.setAlpha(hovered ? Math.max(rest, 0.78) : rest);
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
    hoverCard(rect, true);
    context.onCardHover(card.instanceId);
  });
  rect.on('pointerout', () => {
    hoverCard(rect, false);
    context.onCardOut();
  });
  // The halo travels with its card; the raster pulse map stays reserved.
  rect.setData('halo', glow).setData('haloAlpha', glowState.alpha);
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
  // Every effect stays on the face. Measure the rules first: a long card may
  // raise its rules panel, but never into the 90px art window under the title.
  const summary = scene.add.text(left + 7, 0, '', {
    fontFamily,
    fontSize: '21px', resolution: 2, lineSpacing: 1,
    color: card.canPay ? '#e5edf0' : '#a8b6bf',
    align: 'left',
    wordWrap: { width: cardWidth - 14, callback: (text: string, label: Phaser.GameObjects.Text) =>
      wrapHandRules(text, value => label.context.measureText(value).width, cardWidth - 14) },
  }).setName('combat-card-readable-summary');
  const readable = readableHandRules(card.summary.split('\n'));
  const panelFor = (window: number) => Math.max(HAND_RULE_PANEL_HEIGHT, cardHeight - CARD_ART_INSET * 2 - bannerHeight - window);
  const excerpt = fitHandFaceRules(summary, readable,
    [HAND_RULE_PANEL_HEIGHT, panelFor(HAND_ART_WINDOW), panelFor(HAND_COMPACT_ART_WINDOW)]);
  const panelHeight = excerpt.panelHeight;
  const panelTop = bottom - panelHeight - CARD_ART_INSET;
  // Two reserved rows between title and rules: identity/choice, then Flow.
  // Their geometry never depends on which other badges happen to be active;
  // a raised rules panel lifts both rows together.
  const flowY = Math.min(top + 140, panelTop - 16);
  const badgeY = Math.min(top + 111, flowY - 29);
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

  target.add(scene.add.rectangle(centerX, bottom - panelHeight / 2 - CARD_ART_INSET, cardWidth - CARD_ART_INSET * 2, panelHeight, 0x081624, 0.95)
    .setName('combat-card-rules-panel'));
  target.add(scene.add.rectangle(centerX, bottom - panelHeight - CARD_ART_INSET, cardWidth - CARD_ART_INSET * 2, 2, card.accent, card.canPay ? 0.9 : 0.4)
    .setName('combat-card-rules-rule'));
  if (card.preview.upgraded) {
    // A Preened card wears a gilt inner frame, so an upgrade reads at a glance.
    target.add(scene.add.rectangle(centerX, handY, cardWidth - CARD_ART_INSET * 2 - 2, cardHeight - CARD_ART_INSET * 2 - 2)
      .setRounded(CARD_RADIUS - 3).setStrokeStyle(2, 0xf0c36f, card.canPay ? 0.9 : 0.45).setName('combat-card-preen-gilt'));
  }
  summary.setFontSize(excerpt.fontSize).setText(excerpt.text).setY(panelTop + HAND_RULE_TOP_PAD)
    .setData('truncated', excerpt.omitted > 0)
    .setData('omittedEffects', excerpt.omitted).setData('readableRules', readable)
    .setData('faceTier', excerpt.tier).setData('panelHeight', panelHeight);
  summary.setData('fullText', card.preview.currentText.replace(/\s+/g, ' ').trim())
    .setData('quickRead', card.summary);
  target.add(summary);

  if (card.buildsFlow) {
    const container = scene.add.container(0, 0);
    const background = scene.add.rectangle(centerX, flowY, cardWidth - 16, 26, card.surgeNext ? 0x0d3b45 : 0x071b26, 0.96)
      .setStrokeStyle(1, card.surgeNext ? 0xd8a840 : 0x24d0d6, 0.82);
    const label = scene.add.text(centerX, flowY, card.surgeNext ? '+1 Flow · Surge' : '+1 Flow', {
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
    const glow = rect.getData('halo') as Phaser.GameObjects.Image | undefined;
    if (glow?.scene) { const style = glowStyle(card); glow.setTint(style.tint).setAlpha(style.alpha); rect.setData('haloAlpha', style.alpha); }

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
