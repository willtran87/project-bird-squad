import Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';
import {
  addDeckReviewCostBadge,
  addDeckReviewFlourish,
  addDeckReviewMetaChipFrame,
  addDeckReviewPageIndicatorFrame,
  addDeckReviewRowFrame,
  addDeckReviewSectionTabFrame,
  addDeckReviewTitlePlaque,
  addUiIconImage,
  HUD_MENU_PANEL,
  renderCloseControl,
  renderFieldButton,
  renderFieldPanel,
  UI_FIELD,
  UI_FONT,
  UI_GOLD,
  uiIconAssets,
} from '../main';

const UI_BOLD = 'bold';
const UI_SOFT = '#bdc9d4';
const UI_MUTED = '#91a6b8';
const VISIBLE_ROWS = 7;
const ROW_HEIGHT = 58;

export interface RouteDeckBrowserCard {
  id: string;
  name: string;
  cost: number;
  label: string;
  zone: string;
  upgraded: boolean;
  selected: boolean;
  pinned: boolean;
}

export interface RouteDeckBrowserView {
  cards: RouteDeckBrowserCard[];
  totalCards: number;
  currentHp: number;
  maxHp: number;
  scroll: number;
  filterLabel: string;
  sortLabel: string;
  query: string;
  searchActive: boolean;
  savedDecks: {
    count: number;
    capacity: number;
    status: 'idle' | 'saved' | 'full' | 'failed';
    canSave: boolean;
  };
  onClose: () => void;
  onCycleFilter: () => void;
  onCycleSort: () => void;
  onToggleSearch: () => void;
  onInspect: (id: string) => void;
  onCompare: (id: string) => void;
  onScroll: (delta: number) => void;
  onSaveDeck: () => void;
}

function compactLabel(value: string, maxChars: number) {
  return value.length <= maxChars ? value : `${value.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

function renderModeControl(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  label: string,
  name: string,
  onActivate: () => void,
  active = false,
) {
  const frame = addDeckReviewSectionTabFrame(scene, () => {}, x, y, width, 34, {
    alpha: active ? 0.98 : 0.78,
    tint: active ? 0xd9fdff : undefined,
  });
  const hit = scene.add.rectangle(x, y, width, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
    .setInteractive({ useHandCursor: true })
    .setName(name);
  hit.on('pointerdown', onActivate);
  hit.on('pointerover', () => frame.setAlpha(1));
  hit.on('pointerout', () => frame.setAlpha(active ? 0.98 : 0.78));
  scene.add.text(x, y, compactLabel(label, Math.max(20, Math.floor(width / 8))), {
    fontFamily: UI_FONT,
    fontSize: '9px',
    fontStyle: UI_BOLD,
    color: active ? '#dffbff' : '#f8df9d',
    stroke: '#020409',
    strokeThickness: 2,
    align: 'center',
    fixedWidth: width - 16,
  }).setOrigin(0.5);
}

function renderScrollButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  enabled: boolean,
  onClick: () => void,
) {
  const frameKey = uiIconAssets['deck-review-scroll-button-frame'].key;
  if (!scene.textures.exists(frameKey)) {
    renderFieldButton(scene, () => {}, x, y, 72, 28, label, enabled, onClick, UI_FIELD.gold)
      .setName(`deck-review-scroll-${label.toLowerCase()}-hit`);
    return;
  }

  const button = scene.add.rectangle(x, y, 78, 32, 0x141a22, enabled ? 0.16 : 0.08)
    .setStrokeStyle(1, UI_FIELD.gold, enabled ? 0.16 : 0.06);
  scene.textures.get(frameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const frame = scene.add.image(x, y, frameKey)
    .setDisplaySize(82, 34)
    .setAlpha(enabled ? 0.82 : 0.34)
    .setName('deck-review-scroll-button-frame');
  const hit = scene.add.rectangle(x, y, MIN_SUPPORTED_TOUCH_TARGET, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
    .setName(`deck-review-scroll-${label.toLowerCase()}-hit`);
  if (enabled) {
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', onClick);
    hit.on('pointerover', () => {
      button.setFillStyle(0x1e2833, 0.24);
      frame.setAlpha(0.96).setDisplaySize(86, 36);
    });
    hit.on('pointerout', () => {
      button.setFillStyle(0x141a22, 0.16);
      frame.setAlpha(0.82).setDisplaySize(82, 34);
    });
  }
  scene.add.text(x, y, label.toUpperCase(), {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: enabled ? '#f8df9d' : '#6f7b86',
    align: 'center',
    fixedWidth: 58,
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5);
}

function renderCardColumn(scene: Phaser.Scene, view: RouteDeckBrowserView) {
  const scrollMax = Math.max(0, view.cards.length - VISIBLE_ROWS);
  const scroll = Phaser.Math.Clamp(Math.round(view.scroll), 0, scrollMax);
  const visible = view.cards.slice(scroll, scroll + VISIBLE_ROWS);

  visible.forEach((card, index) => {
    const x = 140;
    const y = 198 + index * ROW_HEIGHT;
    scene.add.rectangle(x + 150, y + 15, 312, 42, card.selected ? 0x1d2224 : 0x0f151d, card.selected ? 0.96 : 0.44)
      .setStrokeStyle(card.selected ? 1.5 : 1, card.selected ? 0xd8a840 : card.upgraded ? 0x24d0d6 : 0xffffff, card.selected ? 0.95 : 0.08);
    addDeckReviewRowFrame(scene, () => {}, x + 140, y + 15, { selected: card.selected, upgraded: card.upgraded });
    scene.add.rectangle(x + 150, y + 31, 280, 1, card.upgraded ? 0x24d0d6 : 0xd8a840, card.selected ? 0.6 : 0.18);
    addDeckReviewCostBadge(scene, () => {}, x + 14, y + 15, 34, { zero: card.cost === 0, selected: card.selected });
    scene.add.text(x + 14, y + 15, `${card.cost}`, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: '#f6f2df',
      stroke: '#020409',
      strokeThickness: 2,
    }).setOrigin(0.5);
    scene.add.text(x + 36, y + 5, card.name, {
      fontFamily: UI_FONT,
      fontSize: '14px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      wordWrap: { width: 170 },
    });
    addDeckReviewMetaChipFrame(scene, () => {}, x + 252, y + 16, 118, 24, {
      selected: card.selected,
      upgraded: card.upgraded,
    });
    scene.add.text(x + 194, y + 11, `${card.label} / ${card.zone}`, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: '#8df4ff',
      align: 'center',
      fixedWidth: 116,
    });
    scene.add.rectangle(x + 150, y + 15, 312, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('deck-review-row-hit')
      .on('pointerdown', () => view.onInspect(card.id));
    scene.add.circle(x + 14, y + 15, 21, 0x020409, 0.001)
      .setStrokeStyle(card.pinned ? 2 : 1, card.pinned ? 0x8df4ff : 0x8fa3b6, card.pinned ? 0.96 : 0.22);
    addUiIconImage(scene, 'route-pin', x + 26, y + 28, 10)
      ?.setAlpha(card.pinned ? 1 : 0.5)
      .setTint(card.pinned ? 0xdffbff : 0xaab9c6);
    scene.add.rectangle(x + 14, y + 15, MIN_SUPPORTED_TOUCH_TARGET, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName(`deck-review-compare-hit-${card.id}`)
      .setData('cardId', card.id)
      .setData('pinned', card.pinned)
      .on('pointerdown', () => view.onCompare(card.id));
  });

  renderScrollButton(scene, 480, 214, 'Up', scroll > 0, () => view.onScroll(-1));
  renderScrollButton(scene, 480, 610, 'Down', scroll < scrollMax, () => view.onScroll(1));
  addDeckReviewPageIndicatorFrame(scene, () => {}, 480, 651);
  const pageLabel = view.cards.length === 0 ? '0 / 0' : `${scroll + 1}-${scroll + visible.length} / ${view.cards.length}`;
  scene.add.text(480, 651, pageLabel, {
    fontFamily: UI_FONT,
    fontSize: '12px',
    color: '#b9c9d8',
    align: 'center',
    fixedWidth: 100,
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5);
}

export function renderRouteDeckBrowser(scene: Phaser.Scene, view: RouteDeckBrowserView) {
  scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.76)
    .setInteractive({ useHandCursor: false });
  const frame = renderFieldPanel(scene, () => {}, HUD_MENU_PANEL.cx, HUD_MENU_PANEL.cy, HUD_MENU_PANEL.w, HUD_MENU_PANEL.h, {
    eyebrow: 'Field Binder',
    accent: UI_FIELD.gold,
  });
  addDeckReviewFlourish(scene, () => {}, frame, { alpha: 0.11, yOffset: 10 });
  addDeckReviewTitlePlaque(scene, () => {}, frame.left + 266, frame.top + 62, 416, 92, { alpha: 0.76 });
  const shownCount = view.cards.length === view.totalCards ? `${view.totalCards}` : `${view.cards.length}/${view.totalCards}`;
  scene.add.text(frame.left + 92, frame.top + 44, `Deck Review (${shownCount})`, {
    fontFamily: UI_FONT,
    fontSize: '28px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 4,
  });
  scene.add.text(frame.left + 92, frame.top + 75, `Flock deck / Cohesion ${view.currentHp}/${view.maxHp}`, {
    fontFamily: UI_FONT,
    fontSize: '14px',
    color: UI_SOFT,
    wordWrap: { width: 330 },
    stroke: '#020409',
    strokeThickness: 2,
  });
  addUiIconImage(scene, 'deck-stack', frame.left + HUD_MENU_PANEL.headerIconX, frame.top + HUD_MENU_PANEL.headerIconY, 28)?.setAlpha(0.9);
  addUiIconImage(scene, 'flock-heart', frame.left + 292, frame.top + 86, 20)?.setAlpha(0.85);
  renderCloseControl(scene, () => {}, frame.right - HUD_MENU_PANEL.closeX, frame.top + HUD_MENU_PANEL.closeY, view.onClose);

  renderModeControl(scene, 666, 126, 132, `FILTER ${view.filterLabel}`, 'deck-review-filter-hit', view.onCycleFilter);
  renderModeControl(scene, 806, 126, 124, `SORT ${view.sortLabel}`, 'deck-review-sort-hit', view.onCycleSort);
  const searchLabel = view.query
    ? `FIND ${view.query}${view.searchActive ? '_' : ''}`
    : view.searchActive ? 'FIND TYPE...' : 'FIND /';
  renderModeControl(scene, 944, 126, 144, searchLabel, 'deck-review-search-hit', view.onToggleSearch, view.searchActive);
  const saveLabel = view.savedDecks.status === 'saved'
    ? `SAVED ${view.savedDecks.count}/${view.savedDecks.capacity}`
    : view.savedDecks.status === 'full'
      ? `FOLIOS FULL ${view.savedDecks.count}/${view.savedDecks.capacity}`
      : view.savedDecks.status === 'failed'
        ? 'SAVE FAILED'
        : `SAVE FLIGHT ${view.savedDecks.count}/${view.savedDecks.capacity} · V/Y`;
  renderModeControl(
    scene,
    1120,
    126,
    180,
    saveLabel,
    'deck-review-save-folio-hit',
    view.onSaveDeck,
    view.savedDecks.status === 'saved',
  );
  scene.add.text(884, 154, 'UP/DOWN CARD  /  LEFT/RIGHT FILTER  /  A SORT  /  C/X PIN  /  V/Y SAVE', {
    fontFamily: UI_FONT,
    fontSize: '9px',
    fontStyle: UI_BOLD,
    color: '#8fa9b7',
    stroke: '#020409',
    strokeThickness: 2,
    fixedWidth: 600,
    align: 'center',
  }).setOrigin(0.5);
  addDeckReviewSectionTabFrame(scene, () => {}, 194, 172, 136, 32, { alpha: 0.76 });
  scene.add.text(194, 172, 'CARD INDEX', {
    fontFamily: UI_FONT,
    fontSize: '10px',
    fontStyle: UI_BOLD,
    color: '#d8f7ff',
    stroke: '#020409',
    strokeThickness: 2,
    align: 'center',
    fixedWidth: 112,
  }).setOrigin(0.5);

  renderCardColumn(scene, view);
  if (view.cards.length === 0) {
    scene.add.text(290, 358, 'No matching cards', {
      fontFamily: UI_FONT,
      fontSize: '20px',
      fontStyle: UI_BOLD,
      color: UI_MUTED,
    }).setOrigin(0.5);
    scene.add.text(290, 390, 'Change FILTER or edit FIND.', {
      fontFamily: UI_FONT,
      fontSize: '12px',
      color: UI_SOFT,
    }).setOrigin(0.5);
  }
}
