import Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from '../theme';

export type BattleInspectMode = 'deck' | 'draw' | 'discard';

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
  handCount: number;
  discardCount: number;
  fontFamily: string;
  boldFontStyle: string;
  goldColor: string;
  softColor: string;
  cyanColor: string;
  reducedMotion: boolean;
  assets: BattleInspectAssets;
  decorators: BattleInspectDecorators;
  renderPanel: (cx: number, cy: number, width: number, height: number, accent: number) => BattleInspectFrame;
  renderClose: (x: number, y: number) => void;
  addIcon: (icon: string, x: number, y: number, size: number) => Phaser.GameObjects.Image | undefined;
  renderSnagArt: (cardId: string, x: number, y: number, width: number, height: number, alpha: number) => boolean;
  onInspect: (cardId: string) => void;
  onScroll: (delta: number) => void;
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
  textX: 826,
  textW: 282,
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

function renderZoneCount(context: BattleInspectRenderContext, icon: string, value: number, x: number, accent: number) {
  const y = 146;
  addIcon(context, icon, x, y, 14, 0.92);
  context.target.add(context.scene.add.circle(x + 25, y, 13, 0x07101c, 0.98).setStrokeStyle(1.5, accent, 0.55));
  addCountBadge(context, x + 25, y, 34, 0.84);
  context.target.add(context.scene.add.text(x + 25, y, `${value}`, {
    fontFamily: context.fontFamily,
    fontSize: '13px',
    fontStyle: context.boldFontStyle,
    color: '#ffffff',
  }).setOrigin(0.5));
}

function renderHeader(context: BattleInspectRenderContext, frame: BattleInspectFrame) {
  const deck = context.mode === 'deck';
  context.decorators.addFlourish(frame, context.mode);
  context.renderClose(frame.right - PANEL.closeX, frame.top + PANEL.closeY);
  addIcon(
    context,
    context.mode === 'discard' ? 'discard-basket' : context.mode === 'draw' ? 'draw-stack' : 'deck-stack',
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
  context.target.add(context.scene.add.text(deck ? 218 : 140, 86, context.title, {
    fontFamily: context.fontFamily,
    fontSize: '32px',
    fontStyle: context.boldFontStyle,
    color: context.goldColor,
    stroke: '#020409',
    strokeThickness: deck ? 4 : 0,
  }));
  renderZoneCount(context, 'draw-stack', context.drawCount, 146, 0x8df4ff);
  renderZoneCount(context, 'deck-stack', context.handCount, 202, 0xd8a840);
  renderZoneCount(context, 'discard-basket', context.discardCount, 258, 0xffb86b);
  if (deck) {
    context.decorators.addSectionTab();
    context.target.add(context.scene.add.text(194, 174, 'CARD INDEX', {
      fontFamily: context.fontFamily,
      fontSize: '10px',
      fontStyle: context.boldFontStyle,
      color: '#d8f7ff',
      stroke: '#020409',
      strokeThickness: 2,
      align: 'center',
      fixedWidth: 112,
    }).setOrigin(0.5));
  }
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
  addIcon(context, direction === 'up' ? 'scroll-up-chevron' : 'scroll-down-chevron', x, y, 13, enabled ? 0.9 : 0.38);
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
  const deck = context.mode === 'deck';
  const x = 140;
  const y = 198 + index * context.rowHeight;
  context.target.add(context.scene.add.rectangle(x + 150, y + 15, 312, 42, selected ? 0x1d2224 : 0x0f151d, selected ? 0.96 : 0.44)
    .setStrokeStyle(selected ? 1.5 : 1, selected ? 0xd8a840 : card.upgraded ? 0x24d0d6 : 0xffffff, selected ? 0.95 : 0.08));
  if (deck) {
    context.decorators.addRowFrame(x + 140, y + 15, selected, card.upgraded);
  } else if (textureReady(context.scene, context.assets.pileRowFrame)) {
    context.target.add(context.scene.add.image(x + 150, y + 15, context.assets.pileRowFrame)
      .setDisplaySize(330, 42)
      .setAlpha(selected ? 0.9 : 0.72)
      .setName('combat-pile-row-frame'));
  }
  context.target.add(context.scene.add.rectangle(x + 150, y + 31, 280, 1, card.upgraded ? 0x24d0d6 : 0xd8a840, selected ? 0.6 : 0.18));
  if (deck) context.decorators.addCostBadge(x + 14, y + 15, 34, card.cost === 0, selected);
  else addCountBadge(context, x + 14, y + 15, 38, selected ? 0.94 : 0.82);
  context.target.add(context.scene.add.text(x + 14, y + 15, `${card.cost}`, {
    fontFamily: context.fontFamily,
    fontSize: '13px',
    fontStyle: context.boldFontStyle,
    color: '#f6f2df',
    stroke: '#020409',
    strokeThickness: 2,
  }).setOrigin(0.5));
  context.target.add(context.scene.add.text(x + 36, y + 5, card.name, {
    fontFamily: context.fontFamily,
    fontSize: '13px',
    fontStyle: context.boldFontStyle,
    color: context.goldColor,
    wordWrap: { width: 170 },
  }));
  context.decorators.addMetaChip(x + 246, y + 16, selected, card.upgraded);
  context.target.add(context.scene.add.text(x + 200, y + 11, card.label, {
    fontFamily: context.fontFamily,
    fontSize: '10px',
    fontStyle: context.boldFontStyle,
    color: '#8df4ff',
    align: 'center',
    fixedWidth: 92,
  }));
  addIcon(context, card.zoneIcon, x + 414, y + 16, 14);
  const rowHit = context.scene.add.rectangle(x + 150, y + 15, 312, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
    .setInteractive({ useHandCursor: true })
    .setName('combat-pile-row-hit');
  rowHit.on('pointerdown', () => context.onInspect(card.id));
  context.target.add(rowHit);
}

function renderDetailChip(context: BattleInspectRenderContext, x: number, y: number, icon: string, text: string, accent: number) {
  const width = 112;
  context.target.add(context.scene.add.rectangle(x, y, width, 26, 0x0b1017, 0.9).setStrokeStyle(1, accent, 0.42));
  if (textureReady(context.scene, context.assets.pileDetailChipFrame)) {
    context.target.add(context.scene.add.image(x, y, context.assets.pileDetailChipFrame)
      .setDisplaySize(width + 12, 36)
      .setAlpha(0.76)
      .setTint(accent === 0xff9d4d ? 0xffd1a1 : 0xffffff)
      .setName('combat-pile-detail-chip-frame'));
  }
  addIcon(context, icon, x - width / 2 + 16, y, 8, 0.86);
  context.target.add(context.scene.add.text(x + 10, y - 7, text, {
    fontFamily: context.fontFamily,
    fontSize: '10px',
    fontStyle: context.boldFontStyle,
    color: '#dce8f2',
    fixedWidth: width - 42,
    maxLines: 1,
  }).setOrigin(0.5, 0));
}

function renderStats(context: BattleInspectRenderContext, card: BattleInspectCardView) {
  if (card.stats.length === 0) {
    context.target.add(context.scene.add.text(DETAIL.textX, DETAIL.statsHeaderY + 6, 'No flock bonuses', {
      fontFamily: context.fontFamily,
      fontSize: '12px',
      color: '#91a6b8',
    }));
    return;
  }
  let x = DETAIL.textX;
  card.stats.slice(0, 5).forEach((stat) => {
    const width = 54;
    if (x + width > DETAIL.textX + DETAIL.textW) return;
    context.target.add(context.scene.add.rectangle(x + width / 2, DETAIL.statsHeaderY + 16, width, 24, 0x0b1017, 0.9)
      .setStrokeStyle(1, 0x8df4ff, 0.52));
    if (textureReady(context.scene, context.assets.pileStatChipFrame)) {
      context.target.add(context.scene.add.image(x + width / 2, DETAIL.statsHeaderY + 16, context.assets.pileStatChipFrame)
        .setDisplaySize(width + 12, 34)
        .setAlpha(0.74)
        .setName('combat-pile-stat-chip-frame'));
    }
    if (stat.icon) addIcon(context, stat.icon, x + 14, DETAIL.statsHeaderY + 16, 8, 0.82);
    context.target.add(context.scene.add.text(x + 35, DETAIL.statsHeaderY + 9, `+${stat.value}`, {
      fontFamily: context.fontFamily,
      fontSize: '12px',
      fontStyle: context.boldFontStyle,
      color: context.cyanColor,
    }).setOrigin(0.5, 0));
    x += width + 6;
  });
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
  const deckFrame = context.mode === 'deck' && context.decorators.addDetailFrame();
  if (!deckFrame && textureReady(context.scene, context.assets.pileReviewFrame)) {
    context.target.add(context.scene.add.image(DETAIL.panelCx, DETAIL.panelCy, context.assets.pileReviewFrame)
      .setDisplaySize(672, 466)
      .setAlpha(0.68)
      .setName('combat-pile-review-frame'));
    const glint = context.scene.add.image(DETAIL.panelCx, DETAIL.panelCy, context.assets.pileReviewFrame)
      .setDisplaySize(672, 466)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(context.reducedMotion ? 0.025 : 0.045)
      .setName('combat-pile-review-frame');
    context.target.add(glint);
    if (!context.reducedMotion) {
      context.scene.tweens.add({ targets: glint, alpha: 0.025, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  } else if (!deckFrame) {
    context.target.add(context.scene.add.rectangle(DETAIL.panelCx, DETAIL.panelCy, DETAIL.panelW - 22, DETAIL.panelH - 18, 0x07101c, 0.2)
      .setStrokeStyle(1, accent, 0.28)
      .setName('combat-pile-review-frame-fallback'));
  }
  renderCardArt(context, card);
  context.decorators.addCostBadge(DETAIL.costX, DETAIL.costY, 46, card.cost === 0, true);
  context.target.add(context.scene.add.text(DETAIL.costX, DETAIL.costY, `${card.cost}`, {
    fontFamily: context.fontFamily,
    fontSize: '17px',
    fontStyle: context.boldFontStyle,
    color: '#f6f2df',
    stroke: '#020409',
    strokeThickness: 2,
  }).setOrigin(0.5));
  context.target.add(context.scene.add.text(DETAIL.textX, DETAIL.titleY, card.name, {
    fontFamily: context.fontFamily,
    fontSize: '26px',
    fontStyle: context.boldFontStyle,
    color: context.goldColor,
    wordWrap: { width: DETAIL.textW },
  }));
  context.target.add(context.scene.add.text(DETAIL.textX, DETAIL.metaY, `${card.bird} / ${card.label} / ${card.zone}`, {
    fontFamily: context.fontFamily,
    fontSize: '15px',
    fontStyle: context.boldFontStyle,
    color: '#7ab8d6',
    wordWrap: { width: DETAIL.textW },
  }));
  renderDetailChip(context, DETAIL.textX + 56, DETAIL.targetY + 8, card.targetIcon, card.targetLabel, card.usesMolt ? 0xff9d4d : 0x7ab8d6);
  renderDetailChip(context, DETAIL.textX + 186, DETAIL.targetY + 8, card.roleIcon, card.roleLabel, card.usesMolt ? 0xff9d4d : 0xd8a840);
  if (card.usesMolt) {
    context.target.add(context.scene.add.rectangle(DETAIL.textX + 40, DETAIL.statusY + 9, 80, 22, 0x2a1208, 0.96).setStrokeStyle(1, 0xff9d4d, 0.82));
    context.target.add(context.scene.add.text(DETAIL.textX + 40, DETAIL.statusY, 'MOLT', {
      fontFamily: context.fontFamily,
      fontSize: '10px',
      fontStyle: context.boldFontStyle,
      color: '#ffc78f',
      align: 'center',
      fixedWidth: 72,
    }).setOrigin(0.5, 0));
  }
  const headerStyle = { fontFamily: context.fontFamily, fontSize: '15px', fontStyle: context.boldFontStyle, color: context.goldColor };
  const bodyStyle = (lines: number) => ({ fontFamily: context.fontFamily, fontSize: '14px', color: '#dce8f2', lineSpacing: 3, wordWrap: { width: DETAIL.textW }, maxLines: lines });
  context.target.add(context.scene.add.text(DETAIL.textX, DETAIL.currentHeaderY, card.usesMolt ? 'Now (Molt)' : 'Now', headerStyle));
  context.target.add(context.scene.add.text(DETAIL.textX, DETAIL.currentBodyY, card.currentText, bodyStyle(3)));
  context.target.add(context.scene.add.text(DETAIL.textX, DETAIL.alternateHeaderY, card.usesMolt ? 'Base' : 'Preen', headerStyle));
  context.target.add(context.scene.add.text(DETAIL.textX, DETAIL.alternateBodyY, card.alternateText, bodyStyle(2)));
  renderStats(context, card);
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
