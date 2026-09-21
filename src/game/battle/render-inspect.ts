import Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from '../theme';
import { fitTextExcerpt } from '../text-excerpt';
import { bindChoiceHint } from '../choice-input-hints';
import { controlBindingLabel } from '../input-bindings';

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
  onClose: () => void;
  renderSnagArt: (cardId: string, x: number, y: number, width: number, height: number, alpha: number) => boolean;
  onInspect: (cardId: string) => void;
  onRead: () => void;
  onScroll: (delta: number) => void;
  onSwitchMode: (mode: BattleInspectMode) => void;
  onConfirmSound: () => void;
}

const DETAIL = {
  artX: 664,
  artY: 402,
  artW: 236,
  artH: 354,
  textX: 810,
  textW: 296,
};

function textureReady(scene: Phaser.Scene, key: string) {
  if (!key || !scene.textures.exists(key)) return false;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return true;
}

function renderZoneCount(
  context: BattleInspectRenderContext,
  mode: BattleInspectMode,
  label: string,
  value: number,
  x: number,
  accent: number,
) {
  const y = 146;
  const active = context.mode === mode;
  context.target.add(context.scene.add.rectangle(x, y, 236, 58, active ? 0x102736 : 0x07101c, active ? 0.98 : 0.64)
    .setStrokeStyle(active ? 2 : 1, active ? 0x8df4ff : accent, active ? 0.96 : 0.34)
    .setName(`combat-pile-zone-${mode}-frame`));
  context.target.add(context.scene.add.text(x, y, `${label} · ${value}`, {
    fontFamily: context.fontFamily,
    fontSize: '20px', resolution: 2,
    fontStyle: context.boldFontStyle,
    color: '#ffffff',
  }).setOrigin(0.5).setName(`combat-pile-zone-${mode}-label`));
  if (active) context.target.add(context.scene.add.rectangle(x, y + 26, 212, 3, 0x8df4ff, 1));
  const hit = context.scene.add.rectangle(x, y, 236, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
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

function renderHeader(context: BattleInspectRenderContext) {
  const close = context.scene.add.rectangle(1048, 78, 176, 58, 0x14232e, 1)
    .setStrokeStyle(1, 0x536574, 1).setInteractive({ useHandCursor: true }).setName('combat-pile-close-hit');
  close.on('pointerdown', context.onClose);
  close.on('pointerover', () => close.setStrokeStyle(2, 0x8df4ff, 1));
  close.on('pointerout', () => close.setStrokeStyle(1, 0x536574, 1));
  context.target.add(close);
  const back = context.scene.add.text(1048, 78, '', {
    fontFamily: context.fontFamily, fontSize: '20px', resolution: 2, color: '#edf3f6',
  }).setOrigin(0.5).setName('combat-pile-close-label');
  context.target.add(back);
  bindChoiceHint(context.scene, back, mode => mode === 'pointer' ? 'Back' : `Back · ${mode === 'controller' ? 'B' : controlBindingLabel('back')}`);
  context.target.add(context.scene.add.text(142, 61, context.title, {
    fontFamily: context.fontFamily,
    fontSize: '30px', resolution: 2,
    fontStyle: context.boldFontStyle,
    color: context.goldColor,
  }).setName('combat-pile-title'));
  renderZoneCount(context, 'deck', 'Deck', context.deckCount, 252, 0xd8a840);
  renderZoneCount(context, 'draw', 'Draw', context.drawCount, 510, 0x8df4ff);
  renderZoneCount(context, 'discard', 'Discard', context.discardCount, 768, 0xffb86b);
  renderZoneCount(context, 'cleared', 'Cleared', context.clearedCount, 1026, 0xc98bff);
  const hint = context.scene.add.text(546, 609, '', {
    fontFamily: context.fontFamily,
    fontSize: '18px', resolution: 2,
    color: '#b9c9d8',
    wordWrap: { width: 590, useAdvancedWrap: true }, lineSpacing: 3,
  }).setName('combat-pile-input-hint');
  context.target.add(hint);
  bindChoiceHint(context.scene, hint, mode => mode === 'pointer'
    ? 'Choose a pile, then a card.\nFull rules reads without playing it.'
    : mode === 'controller' ? 'D-pad: card / pile · LB / RB: page\nR3: full rules · B: back'
    : `Up / Down: card · ${controlBindingLabel('previous')} / ${controlBindingLabel('next')}: pile\n${controlBindingLabel('guide')}: full rules · ${controlBindingLabel('back')}: back`);
}

function renderScrollButton(
  context: BattleInspectRenderContext,
  x: number,
  y: number,
  direction: 'up' | 'down',
  enabled: boolean,
) {
  const accent = enabled ? 0xd8a840 : 0x3f4c58;
  const button = context.scene.add.rectangle(x, y, 58, 58, enabled ? 0x0d1420 : 0x0a0e15, enabled ? 0.94 : 0.7)
    .setStrokeStyle(1.5, accent, enabled ? 0.82 : 0.46);
  context.target.add(button);
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
  fitTextExcerpt(name, card.name, 2);
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
      .setAlpha(1).setName('combat-pile-card-art'));
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
  // The canonical card frame belongs to the artwork, not a second UI frame.
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
  const read = text(548, '', 18, '#edf3f6', 'combat-pile-read-label')
    .setPosition(DETAIL.textX + DETAIL.textW / 2, 548).setOrigin(0.5).setFontStyle(context.boldFontStyle);
  bindChoiceHint(context.scene, read, mode => mode === 'pointer' ? 'Full rules'
    : `Full rules · ${mode === 'controller' ? 'R3' : controlBindingLabel('guide')}`);
}


export function renderBattleInspect(context: BattleInspectRenderContext) {
  context.target.add(context.scene.add.rectangle(context.width / 2, context.height / 2, context.width, context.height, 0x020409, 0.76)
    .setInteractive({ useHandCursor: false }));
  context.target.add(context.scene.add.rectangle(640, 360, 1060, 640, 0x070d15, 1)
    .setStrokeStyle(1, 0x536574, 0.8).setName('combat-pile-panel'));
  context.target.add(context.scene.add.rectangle(520, 385, 1, 400, 0x536574, 0.5));
  renderHeader(context);
  const cards = [...context.cards].sort((a, b) => {
    const zoneOrder = a.zoneRank - b.zoneRank;
    return zoneOrder !== 0 ? zoneOrder : a.name.localeCompare(b.name);
  });
  const maxScroll = Math.max(0, cards.length - context.visibleRows);
  const scroll = Phaser.Math.Clamp(context.scroll, 0, maxScroll);
  const selected = cards.find((card) => card.id === context.selectedCardId) ?? cards[0];
  cards.slice(scroll, scroll + context.visibleRows).forEach((card, index) => renderRow(context, card, index, selected?.id === card.id));
  renderScrollButton(context, 486, 214, 'up', scroll > 0);
  renderScrollButton(context, 486, 610, 'down', scroll < maxScroll);
  const pageText = cards.length === 0
    ? '0 / 0'
    : `${scroll + 1}-${scroll + Math.min(context.visibleRows, cards.length - scroll)} / ${cards.length}`;
  context.target.add(context.scene.add.text(290, 628, pageText, {
    fontFamily: context.fontFamily,
    fontSize: '18px', resolution: 2,
    color: '#b9c9d8',
    align: 'center',
  }).setOrigin(0.5).setName('combat-pile-position'));
  if (selected) renderDetail(context, selected);
  else context.target.add(context.scene.add.text(662, 190, 'No cards in this pile.', {
    fontFamily: context.fontFamily,
    fontSize: '20px',
    fontStyle: context.boldFontStyle,
    color: '#91a6b8',
  }));
}
