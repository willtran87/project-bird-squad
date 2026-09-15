import Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from '../theme';

export type BattleInspectMode = 'deck' | 'draw' | 'discard' | 'cleared';

export interface BattleInspectStatView {
  icon?: string;
  value: number;
}

export interface BattleInspectCardView {
  id: string;
  name: string;
  bird: string;
  label: string;
  zone: string;
  zoneIcon: string;
  zoneRank: number;
  cost: number;
  upgraded: boolean;
  type: 'major' | 'minor' | 'molt' | 'aviary';
  usesMolt: boolean;
  currentText: string;
  alternateText: string;
  targetIcon: string;
  targetLabel: string;
  roleIcon: string;
  roleLabel: string;
  stats: BattleInspectStatView[];
  artKey?: string;
  snag: boolean;
}

export interface BattleInspectFrame {
  cx: number;
  cy: number;
  w: number;
  h: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface BattleInspectAssets {
  pileReviewFrame: string;
  pileRowFrame: string;
  pileScrollButtonFrame: string;
  pileCountBadge: string;
  pileDetailChipFrame: string;
  pileStatChipFrame: string;
  pileTitlePlaque: string;
  pilePageIndicatorFrame: string;
}

export interface BattleInspectDecorators {
  addFlourish: (frame: BattleInspectFrame, mode: BattleInspectMode) => void;
  addTitlePlaque: () => void;
  addSectionTab: () => void;
  addRowFrame: (x: number, y: number, selected: boolean, upgraded: boolean) => void;
  addPageIndicator: () => void;
  addDetailFrame: () => boolean;
  addCostBadge: (x: number, y: number, size: number, zero: boolean, selected: boolean) => void;
  addMetaChip: (x: number, y: number, selected: boolean, upgraded: boolean) => void;
}

export interface BattleInspectRenderContext {
  scene: Phaser.Scene;
  target: Phaser.GameObjects.Container;
  width: number;
  height: number;
  mode: BattleInspectMode;
  title: string;
  cards: BattleInspectCardView[];
  selectedCardId?: string;
  scroll: number;
  visibleRows: number;
  rowHeight: number;
  drawCount: number;
  deckCount: number;
  discardCount: number;
  clearedCount: number;
  fontFamily: string;
  boldFontStyle: string;
  goldColor: string;
  softColor: string;
  cyanColor: string;
  reducedMotion: boolean;
  inputHint: string;
  detailsLabel: string;
  assets: BattleInspectAssets;
  decorators: BattleInspectDecorators;
  renderPanel: (cx: number, cy: number, width: number, height: number, accent: number) => BattleInspectFrame;
  renderClose: (x: number, y: number) => void;
  addIcon: (icon: string, x: number, y: number, size: number) => Phaser.GameObjects.Image | undefined;
  renderSnagArt: (cardId: string, x: number, y: number, width: number, height: number, alpha: number) => boolean;
  onInspect: (cardId: string) => void;
  onRead: () => void;
  onScroll: (delta: number) => void;
  onSwitchMode: (mode: BattleInspectMode) => void;
  onConfirmSound: () => void;
}

const PANEL = { w: 1060, h: 570, cx: 640, cy: 360, headerIconX: 392, headerIconY: 58, closeX: 76, closeY: 56 };
const DETAIL = {
  panelCx: 826,
  panelCy: 379,
  panelW: 620,
  panelH: 430,
  artX: 664,
  artY: 402,
  artW: 236,
  artH: 354,
  costX: 550,
  costY: 200,
  textX: 810,
  textW: 296,
  titleY: 184,
  metaY: 234,
  targetY: 262,
  statusY: 292,
  currentHeaderY: 322,
  currentBodyY: 346,
  alternateHeaderY: 430,
  alternateBodyY: 454,
  statsHeaderY: 512,
};

function textureReady(scene: Phaser.Scene, key: string) {
  if (!key || !scene.textures.exists(key)) return false;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return true;
}

function addIcon(context: BattleInspectRenderContext, icon: string, x: number, y: number, size: number, alpha = 0.9) {
  const image = context.addIcon(icon, x, y, size);
  if (image) context.target.add(image.setAlpha(alpha));
}

function addCountBadge(context: BattleInspectRenderContext, x: number, y: number, size: number, alpha = 0.86) {
  if (!textureReady(context.scene, context.assets.pileCountBadge)) return;
  context.target.add(context.scene.add.image(x, y, context.assets.pileCountBadge)
    .setDisplaySize(size, size)
    .setAlpha(alpha)
    .setName('combat-pile-count-badge'));
}

function renderZoneCount(
  context: BattleInspectRenderContext,
  mode: BattleInspectMode,
  label: string,
  icon: string,
  value: number,
  x: number,
  accent: number,
) {
  const y = 153;
  const active = context.mode === mode;
  context.target.add(context.scene.add.rectangle(x, y + 1, 70, 56, active ? 0x102736 : 0x07101c, active ? 0.98 : 0.64)
    .setStrokeStyle(active ? 2 : 1, active ? 0x8df4ff : accent, active ? 0.96 : 0.34)
    .setName(`combat-pile-zone-${mode}-frame`));
  context.target.add(context.scene.add.text(x, y - 8, `${value}`, {
    fontFamily: context.fontFamily,
    fontSize: '18px', resolution: 2,
    fontStyle: context.boldFontStyle,
    color: '#ffffff',
  }).setOrigin(0.5));
  context.target.add(context.scene.add.text(x, y + 14, label, {
    fontFamily: context.fontFamily,
    fontSize: '13px', resolution: 2,
    fontStyle: context.boldFontStyle,
    color: active ? '#dffbff' : '#aab9c6',
    align: 'center',
    fixedWidth: 64,
  }).setOrigin(0.5));
  const hit = context.scene.add.rectangle(x, y + 1, 70, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
    .setInteractive({ useHandCursor: true })
    .setName(`combat-pile-zone-${mode}-hit`)
    .setData('mode', mode)
    .setData('active', active);
  hit.on('pointerdown', () => {
    if (active) return;
    context.onConfirmSound();
    context.onSwitchMode(mode);
  });
  context.target.add(hit);
}

function renderHeader(context: BattleInspectRenderContext, frame: BattleInspectFrame) {
  const deck = context.mode === 'deck';
  context.decorators.addFlourish(frame, context.mode);
  context.renderClose(frame.right - PANEL.closeX, frame.top + PANEL.closeY);
  addIcon(
    context,
    context.mode === 'discard'
      ? 'discard-basket'
      : context.mode === 'draw'
        ? 'draw-stack'
        : context.mode === 'cleared'
          ? 'release-card'
          : 'deck-stack',
    frame.left + PANEL.headerIconX,
    frame.top + PANEL.headerIconY,
    28,
  );
  if (deck) {
    context.decorators.addTitlePlaque();
  } else if (textureReady(context.scene, context.assets.pileTitlePlaque)) {
    context.target.add(context.scene.add.image(318, 104, context.assets.pileTitlePlaque)
      .setDisplaySize(390, 72)
      .setAlpha(0.82)
      .setName('combat-pile-title-plaque'));
  }
  context.target.add(context.scene.add.text(140, 80, context.title, {
    fontFamily: context.fontFamily,
    fontSize: '30px', resolution: 2,
    fontStyle: context.boldFontStyle,
    color: context.goldColor,
    stroke: '#020409',
    strokeThickness: deck ? 4 : 0,
  }));
  renderZoneCount(context, 'deck', 'DECK', 'deck-stack', context.deckCount, 144, 0xd8a840);
  renderZoneCount(context, 'draw', 'DRAW', 'draw-stack', context.drawCount, 220, 0x8df4ff);
  renderZoneCount(context, 'discard', 'DISCARD', 'discard-basket', context.discardCount, 296, 0xffb86b);
  renderZoneCount(context, 'cleared', 'CLEARED', 'release-card', context.clearedCount, 372, 0xc98bff);
  context.target.add(context.scene.add.text(540, 139, context.inputHint, {
    fontFamily: context.fontFamily,
    fontSize: '14px', resolution: 2,
    fontStyle: context.boldFontStyle,
    color: '#b9c9d8',
    wordWrap: { width: 500 },
    maxLines: 2,
  }).setName('combat-pile-input-hint'));
}

function renderScrollButton(
  context: BattleInspectRenderContext,
  x: number,
  y: number,
  direction: 'up' | 'down',
  enabled: boolean,
) {
  const accent = enabled ? 0xd8a840 : 0x3f4c58;
  const button = context.scene.add.rectangle(x, y, 40, 32, enabled ? 0x0d1420 : 0x0a0e15, enabled ? 0.94 : 0.7)
    .setStrokeStyle(1.5, accent, enabled ? 0.82 : 0.46);
  context.target.add(button);
  if (textureReady(context.scene, context.assets.pileScrollButtonFrame)) {
    context.target.add(context.scene.add.image(x, y, context.assets.pileScrollButtonFrame)
      .setDisplaySize(54, 42)
      .setAlpha(enabled ? 0.72 : 0.34)
      .setTint(enabled ? 0xffffff : 0x9dadba)
      .setName('combat-pile-scroll-button-frame'));
  }
  context.target.add(context.scene.add.text(x, y, direction === 'up' ? '↑' : '↓', {
    fontFamily: context.fontFamily, fontSize: '24px', resolution: 2,
    color: enabled ? '#edf3f6' : '#6e8391',
  }).setOrigin(0.5).setName(`combat-pile-scroll-${direction}-label`));
  const hit = context.scene.add.rectangle(x, y, MIN_SUPPORTED_TOUCH_TARGET, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
    .setName(`combat-pile-scroll-${direction}-hit`);
  context.target.add(hit);
  if (!enabled) return;
  hit.setInteractive({ useHandCursor: true });
  hit.on('pointerdown', () => {
    context.onConfirmSound();
    context.onScroll(direction === 'up' ? -1 : 1);
  });
}

function renderRow(context: BattleInspectRenderContext, card: BattleInspectCardView, index: number, selected: boolean) {
  const x = 140, y = 198 + index * context.rowHeight;
  context.target.add(context.scene.add.rectangle(x + 150, y + 15, 312, 54, selected ? 0x19313c : 0x0f151d, 0.96)
    .setStrokeStyle(1, selected ? 0x8df4ff : 0x344954, selected ? 0.8 : 0.35));
  const cost = context.scene.add.text(x + 14, y + 15, String(card.cost), {
    fontFamily: context.fontFamily, fontSize: '18px', resolution: 2,
    fontStyle: context.boldFontStyle, color: '#f6f2df',
  }).setOrigin(0.5);
  context.target.add(cost);
  const name = context.scene.add.text(x + 38, y + 15, card.name, {
    fontFamily: context.fontFamily, fontSize: '18px', resolution: 2,
    fontStyle: context.boldFontStyle, color: selected ? '#f6f2df' : '#cfdae1',
    wordWrap: { width: 246, useAdvancedWrap: true }, lineSpacing: 1,
  }).setOrigin(0, 0.5).setName('combat-pile-row-title');
  const lines = name.getWrappedText();
  name.setText(lines.slice(0, 2).join('\n') + (lines.length > 2 ? '…' : ''));
  context.target.add(name);
  if (selected) {
    context.target.add(context.scene.add.rectangle(x + 150, y + 15, 326, MIN_SUPPORTED_TOUCH_TARGET, 0x06151b, 0.02)
      .setStrokeStyle(2, 0x8df4ff, 0.98).setName('combat-pile-input-focus-ring').setData('instanceId', card.id));
    context.target.add(context.scene.add.rectangle(x - 17, y + 15, 5, 34, 0x8df4ff, 0.96)
      .setName('combat-pile-input-focus-marker'));
  }
  const hit = context.scene.add.rectangle(x + 150, y + 15, 312, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
    .setInteractive({ useHandCursor: true }).setName('combat-pile-row-hit')
    .setData('instanceId', card.id).setData('selected', selected);
  hit.on('pointerdown', () => context.onInspect(card.id));
  context.target.add(hit);
}


function renderCardArt(context: BattleInspectRenderContext, card: BattleInspectCardView) {
  if (card.artKey && textureReady(context.scene, card.artKey)) {
    context.target.add(context.scene.add.image(DETAIL.artX, DETAIL.artY, card.artKey)
      .setDisplaySize(DETAIL.artW, DETAIL.artH)
      .setAlpha(0.92));
    return;
  }
  if (card.snag && context.renderSnagArt(card.id, DETAIL.artX, DETAIL.artY, DETAIL.artW, DETAIL.artH, 0.92)) {
    context.target.add(context.scene.add.rectangle(DETAIL.artX, DETAIL.artY, DETAIL.artW, DETAIL.artH, 0x05101a, 0.12));
    return;
  }
  context.target.add(context.scene.add.rectangle(DETAIL.artX, DETAIL.artY, DETAIL.artW, DETAIL.artH, 0x141f2f, 0.95)
    .setStrokeStyle(1, 0x49606d, 0.8));
  context.target.add(context.scene.add.text(DETAIL.artX, DETAIL.artY, card.label, {
    fontFamily: context.fontFamily,
    fontSize: '18px',
    fontStyle: context.boldFontStyle,
    color: '#7ab8d6',
    wordWrap: { width: 190 },
    align: 'center',
  }).setOrigin(0.5));
}

function renderDetail(context: BattleInspectRenderContext, card: BattleInspectCardView) {
  const accent = card.upgraded ? 0x24d0d6 : card.type === 'major' ? 0xd8a840 : 0x7ab8d6;
  context.renderPanel(DETAIL.panelCx, DETAIL.panelCy, DETAIL.panelW, DETAIL.panelH, accent);
  // Keep the authored frame and illustration, without a second animated frame or nested chips.
  if (textureReady(context.scene, context.assets.pileReviewFrame)) {
    context.target.add(context.scene.add.image(DETAIL.panelCx, DETAIL.panelCy, context.assets.pileReviewFrame)
      .setDisplaySize(672, 466).setAlpha(0.32).setName('combat-pile-review-frame'));
  }
  renderCardArt(context, card);
  const text = (y: number, value: string, size: number, color = '#dce8f2', name = '') => {
    const object = context.scene.add.text(DETAIL.textX, y, value, {
      fontFamily: context.fontFamily, fontSize: size + 'px', resolution: 2, color,
      wordWrap: { width: DETAIL.textW, useAdvancedWrap: true }, lineSpacing: 3,
    }).setName(name);
    context.target.add(object); return object;
  };
  const excerpt = (object: Phaser.GameObjects.Text, bottom: number) => {
    const lines = object.getWrappedText();
    let visible = lines.length;
    while (visible > 0 && object.y + object.height > bottom) {
      visible--;
      object.setText(lines.slice(0, visible).join('\n') + (visible < lines.length ? '…' : ''));
    }
    object.setData('truncated', visible < lines.length);
  };
  const title = text(184, card.name, 24, context.goldColor, 'combat-pile-detail-title').setFontStyle(context.boldFontStyle);
  excerpt(title, 248);
  const meta = text(258, card.zone + ' · ' + card.cost + ' Wingbeat' + (card.cost === 1 ? '' : 's')
    + (card.upgraded ? ' · Preened' : ''), 16, '#abc0cd', 'combat-pile-detail-meta');
  excerpt(meta, 308);
  text(318, card.usesMolt ? 'ACTIVE · MOLT' : 'ACTIVE · NOW', 16, '#ffe7b0').setFontStyle(context.boldFontStyle);
  const body = text(349, card.currentText, 18, '#edf3f6', 'combat-pile-detail-excerpt');
  excerpt(body, 485);
  const hit = context.scene.add.rectangle(DETAIL.textX + DETAIL.textW / 2, 548, DETAIL.textW, MIN_SUPPORTED_TOUCH_TARGET, 0x19313c, 1)
    .setStrokeStyle(1, 0x71b8c6, 0.85).setInteractive({ useHandCursor: true }).setName('combat-pile-read-hit');
  context.target.add(hit);
  hit.on('pointerover', () => hit.setStrokeStyle(2, 0x8df4ff, 1));
  hit.on('pointerout', () => hit.setStrokeStyle(1, 0x71b8c6, 0.85));
  hit.on('pointerdown', () => { context.onConfirmSound(); context.onRead(); });
  text(548, context.detailsLabel, 18, '#edf3f6', 'combat-pile-read-label')
    .setPosition(DETAIL.textX + DETAIL.textW / 2, 548).setOrigin(0.5).setFontStyle(context.boldFontStyle);
}


export function renderBattleInspect(context: BattleInspectRenderContext) {
  context.target.add(context.scene.add.rectangle(context.width / 2, context.height / 2, context.width, context.height, 0x020409, 0.76)
    .setInteractive({ useHandCursor: false }));
  const frame = context.renderPanel(PANEL.cx, PANEL.cy, PANEL.w, PANEL.h, 0xd8a840);
  renderHeader(context, frame);
  const cards = [...context.cards].sort((a, b) => {
    const zoneOrder = a.zoneRank - b.zoneRank;
    return zoneOrder !== 0 ? zoneOrder : a.name.localeCompare(b.name);
  });
  const maxScroll = Math.max(0, cards.length - context.visibleRows);
  const scroll = Phaser.Math.Clamp(context.scroll, 0, maxScroll);
  const selected = cards.find((card) => card.id === context.selectedCardId) ?? cards[0];
  cards.slice(scroll, scroll + context.visibleRows).forEach((card, index) => renderRow(context, card, index, selected?.id === card.id));
  renderScrollButton(context, 480, 214, 'up', scroll > 0);
  renderScrollButton(context, 480, 610, 'down', scroll < maxScroll);
  if (context.mode === 'deck') context.decorators.addPageIndicator();
  else if (textureReady(context.scene, context.assets.pilePageIndicatorFrame)) {
    context.target.add(context.scene.add.image(462, 641, context.assets.pilePageIndicatorFrame)
      .setDisplaySize(126, 36)
      .setAlpha(0.72)
      .setName('combat-pile-page-indicator-frame'));
  }
  const pageText = cards.length === 0
    ? '0 / 0'
    : `${scroll + 1}-${scroll + Math.min(context.visibleRows, cards.length - scroll)} / ${cards.length}`;
  context.target.add(context.scene.add.text(462, 641, pageText, {
    fontFamily: context.fontFamily,
    fontSize: '12px',
    color: '#b9c9d8',
    align: 'center',
    fixedWidth: 100,
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5));
  if (selected) renderDetail(context, selected);
  else context.target.add(context.scene.add.text(662, 190, 'No cards in this pile.', {
    fontFamily: context.fontFamily,
    fontSize: '20px',
    fontStyle: context.boldFontStyle,
    color: '#91a6b8',
  }));
}
