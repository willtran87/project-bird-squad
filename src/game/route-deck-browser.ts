import Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';
import { controlActionForCode, controlBindingLabel } from './input-bindings';
import { comparisonPagingHint } from './deck-review-hints';
import {
  addDeckReviewCostBadge,
  HUD_MENU_PANEL,
  renderFieldPanel,
  UI_FIELD,
  UI_FONT,
  UI_GOLD,
} from '../main';

const UI_BOLD = 'bold';
const UI_SOFT = '#bdc9d4';
const UI_MUTED = '#91a6b8';
const VISIBLE_ROWS = 7;
const ROW_HEIGHT = 58;

type ReviewInput = 'pointer' | 'keyboard' | 'controller';
const reviewInputs = new WeakMap<Phaser.Scene, { mode: ReviewInput; refresh: () => void }>();

function refreshReviewHints(scene: Phaser.Scene) {
  let state = reviewInputs.get(scene);
  if (!state) {
    const refresh = () => {
      const label = scene.children.getByName('deck-review-control-guide') as Phaser.GameObjects.Text | null;
      if (!label) return;
      const mode = reviewInputs.get(scene)?.mode ?? 'pointer';
      const search = Boolean(label.getData('searchActive'));
      const hints = search
        ? `Type to find cards · ${controlBindingLabel('confirm')} or ${controlBindingLabel('back')}: finish search`
        : mode === 'controller'
          ? 'D-pad ↑/↓: card · ←/→: filter\nA: sort · X: pin · Y: save · B: close'
          : mode === 'keyboard'
            ? `Tab: card · ${controlBindingLabel('previous')}/${controlBindingLabel('next')}: filter · ${controlBindingLabel('confirm')}: sort\n${controlActionForCode('KeyC') ? 'Click Pin' : 'C: pin'} · ${controlActionForCode('KeyV') ? 'Click Save' : 'V: save'} · ${controlBindingLabel('back')}: close`
            : 'Select a card to read its rules · Pin to compare';
      label.setText(hints).setData('inputMode', mode);
      const paging = scene.children.getByName('deck-review-comparison-hint') as Phaser.GameObjects.Text | null;
      paging?.setText(comparisonPagingHint(mode));
    };
    state = { mode: 'pointer', refresh };
    reviewInputs.set(scene, state);
    const setMode = (mode: ReviewInput) => { const current = reviewInputs.get(scene); if (current) current.mode = mode; refresh(); };
    const pointer = () => setMode('pointer');
    const keyboard = () => setMode('keyboard');
    const controller = () => setMode('controller');
    scene.input.on('pointerdown', pointer);
    scene.input.keyboard?.on('keydown', keyboard);
    scene.input.gamepad?.on('down', controller);
    scene.events.once('shutdown', () => {
      scene.input.off('pointerdown', pointer);
      scene.input.keyboard?.off('keydown', keyboard);
      scene.input.gamepad?.off('down', controller);
      reviewInputs.delete(scene);
    });
  }
  state.refresh();
}

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
  const frame = scene.add.rectangle(x, y, width, 54, 0x12202b, active ? 1 : 0.8)
    .setStrokeStyle(1, 0x8df4ff, active ? 0.85 : 0.12);
  const hit = scene.add.rectangle(x, y, width, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
    .setInteractive({ useHandCursor: true })
    .setName(name);
  hit.on('pointerdown', onActivate);
  hit.on('pointerover', () => frame.setAlpha(1));
  hit.on('pointerout', () => frame.setAlpha(active ? 0.98 : 0.78));
  scene.add.text(x, y, compactLabel(label, Math.max(20, Math.floor(width / 6))), {
    fontFamily: UI_FONT,
    fontSize: '14px',
    fontStyle: UI_BOLD,
    color: active ? '#dffbff' : '#bdc9d4',
    align: 'center',
    fixedWidth: width - 16,
    wordWrap: { width: width - 16, useAdvancedWrap: true },
  }).setOrigin(0.5).setResolution(2);
}

function renderScrollButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  enabled: boolean,
  onClick: () => void,
) {
  const hit = scene.add.rectangle(x, y, MIN_SUPPORTED_TOUCH_TARGET, MIN_SUPPORTED_TOUCH_TARGET, 0x12232d, enabled ? 0.8 : 0.25)
    .setStrokeStyle(1, 0x8df4ff, enabled ? 0.4 : 0.12)
    .setName(`deck-review-scroll-${label.toLowerCase()}-hit`);
  if (enabled) {
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', onClick);
    hit.on('pointerover', () => {
      hit.setFillStyle(0x203844, 1);
    });
    hit.on('pointerout', () => {
      hit.setFillStyle(0x12232d, 0.8);
    });
  }
  scene.add.text(x, y, label.toUpperCase(), {
    fontFamily: UI_FONT,
    fontSize: '14px',
    fontStyle: UI_BOLD,
    color: enabled ? '#f8df9d' : '#6f7b86',
    align: 'center',
    fixedWidth: 58,
    resolution: 2,
  }).setOrigin(0.5);
}

function renderCardColumn(scene: Phaser.Scene, view: RouteDeckBrowserView) {
  const scrollMax = Math.max(0, view.cards.length - VISIBLE_ROWS);
  const scroll = Phaser.Math.Clamp(Math.round(view.scroll), 0, scrollMax);
  const visible = view.cards.slice(scroll, scroll + VISIBLE_ROWS);

  visible.forEach((card, index) => {
    const x = 140;
    const y = 198 + index * ROW_HEIGHT;
    scene.add.rectangle(255, y + 15, 244, 54, 0x1d2224, card.selected ? 0.96 : 0)
      .setStrokeStyle(card.selected ? 1.5 : 0, 0xd8a840, 0.95);
    if (!card.selected) scene.add.rectangle(255, y + 43, 230, 1, 0x8df4ff, 0.1);
    addDeckReviewCostBadge(scene, () => {}, x + 14, y + 15, 34, { zero: card.cost === 0, selected: card.selected });
    scene.add.text(x + 14, y + 15, `${card.cost}`, {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: '#f6f2df',
      stroke: '#020409',
      strokeThickness: 2,
    }).setOrigin(0.5);
    const title = scene.add.text(176, y + 15, card.name, {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: card.selected ? UI_GOLD : '#dce8f2',
      wordWrap: { width: 194, useAdvancedWrap: true },
    }).setOrigin(0, 0.5).setResolution(2).setName('deck-review-row-title');
    const lines = title.getWrappedText();
    let excerpt = lines.slice(0, 2).join('\n');
    title.setText(excerpt + (lines.length > 2 ? '…' : ''));
    while (title.height > 48 && excerpt.length) {
      excerpt = excerpt.slice(0, -1).trimEnd();
      title.setText(`${excerpt}…`);
    }
    scene.add.rectangle(255, y + 15, 244, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('deck-review-row-hit')
      .on('pointerdown', () => view.onInspect(card.id));
    const pin = scene.add.rectangle(416, y + 15, MIN_SUPPORTED_TOUCH_TARGET, MIN_SUPPORTED_TOUCH_TARGET, 0x12232d, card.pinned ? 1 : 0)
      .setStrokeStyle(1, 0x8df4ff, card.pinned ? 0.85 : 0)
      .setInteractive({ useHandCursor: true })
      .setName(`deck-review-compare-hit-${card.id}`)
      .setData('cardId', card.id)
      .setData('pinned', card.pinned)
      .on('pointerdown', () => view.onCompare(card.id));
    pin.on('pointerover', () => pin.setStrokeStyle(2, 0x8df4ff, 1));
    pin.on('pointerout', () => pin.setStrokeStyle(1, 0x8df4ff, card.pinned ? 0.85 : 0));
    scene.add.text(416, y + 15, card.pinned ? 'Unpin' : 'Pin', {
      fontFamily: UI_FONT, fontSize: '15px', color: card.pinned ? '#dffbff' : '#a9c6d5',
    }).setOrigin(0.5).setResolution(2);
  });

  renderScrollButton(scene, 480, 214, 'Up', scroll > 0, () => view.onScroll(-1));
  renderScrollButton(scene, 480, 610, 'Down', scroll < scrollMax, () => view.onScroll(1));
  const pageLabel = view.cards.length === 0 ? '0 / 0' : `${scroll + 1}-${scroll + visible.length} / ${view.cards.length}`;
  scene.add.text(290, 616, pageLabel, {
    fontFamily: UI_FONT,
    fontSize: '14px',
    color: '#b9c9d8',
    align: 'center',
    fixedWidth: 100,
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5).setName('deck-review-page-label');
}

export function renderRouteDeckBrowser(scene: Phaser.Scene, view: RouteDeckBrowserView) {
  scene.add.rectangle(640, 360, 1280, 720, 0x07101a, 1)
    .setName('deck-review-curtain')
    .setInteractive({ useHandCursor: false });
  renderFieldPanel(scene, () => {}, HUD_MENU_PANEL.cx, HUD_MENU_PANEL.cy, HUD_MENU_PANEL.w, HUD_MENU_PANEL.h, {
    accent: UI_FIELD.gold,
  });
  const shownCount = view.cards.length === view.totalCards ? `${view.totalCards}` : `${view.cards.length}/${view.totalCards}`;
  scene.add.text(146, 106, `Deck Review (${shownCount})`, {
    fontFamily: UI_FONT,
    fontSize: '28px',
    fontStyle: UI_BOLD,
    color: UI_FIELD.warm,
    stroke: '#020409',
    strokeThickness: 4,
  });
  scene.add.text(146, 141, `Flock deck / Cohesion ${view.currentHp}/${view.maxHp}`, {
    fontFamily: UI_FONT,
    fontSize: '14px',
    color: UI_SOFT,
    wordWrap: { width: 330 },
    stroke: '#020409',
    strokeThickness: 2,
  });
  scene.add.rectangle(1142, 126, 58, 58, 0x17202b, 1).setStrokeStyle(1, 0x8df4ff, 0.3)
    .setInteractive({ useHandCursor: true }).setName('deck-review-close-hit').on('pointerdown', view.onClose);
  scene.add.text(1142, 126, 'Close', { fontFamily: UI_FONT, fontSize: '15px', color: '#ffd5cc' })
    .setOrigin(0.5).setResolution(2);

  renderModeControl(scene, 602, 126, 114, `FILTER ${view.filterLabel}`, 'deck-review-filter-hit', view.onCycleFilter);
  renderModeControl(scene, 728, 126, 122, `SORT ${view.sortLabel}`, 'deck-review-sort-hit', view.onCycleSort);
  const searchLabel = view.query
    ? `FIND ${view.query}${view.searchActive ? '_' : ''}`
    : view.searchActive ? 'FIND TYPE...' : 'FIND /';
  renderModeControl(scene, 872, 126, 150, searchLabel, 'deck-review-search-hit', view.onToggleSearch, view.searchActive);
  const saveLabel = view.savedDecks.status === 'saved'
    ? `SAVED ${view.savedDecks.count}/${view.savedDecks.capacity}`
    : view.savedDecks.status === 'full'
      ? `FOLIOS FULL ${view.savedDecks.count}/${view.savedDecks.capacity}`
      : view.savedDecks.status === 'failed'
        ? 'SAVE FAILED'
        : `SAVE FLIGHT ${view.savedDecks.count}/${view.savedDecks.capacity}`;
  renderModeControl(
    scene,
    1030,
    126,
    150,
    saveLabel,
    'deck-review-save-folio-hit',
    view.onSaveDeck,
    view.savedDecks.status === 'saved',
  );
  scene.add.text(826, 617, '', {
    fontFamily: UI_FONT,
    fontSize: '16px',
    fontStyle: UI_BOLD,
    color: '#b9d6e3',
    fixedWidth: 568,
    wordWrap: { width: 568, useAdvancedWrap: true },
    align: 'center',
  }).setOrigin(0.5).setResolution(2).setName('deck-review-control-guide').setData('searchActive', view.searchActive);
  refreshReviewHints(scene);
  scene.add.text(194, 172, 'CARDS', {
    fontFamily: UI_FONT,
    fontSize: '13px',
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
