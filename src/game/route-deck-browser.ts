import Phaser from 'phaser';
import { uiIconAssets } from '../main';
function addDeckReviewCostBadge(
  scene: Phaser.Scene,
  addTo: (object: Phaser.GameObjects.GameObject) => void,
  cx: number,
  cy: number,
  size: number,
  opts: { zero?: boolean; selected?: boolean; alpha?: number } = {}
) {
  const key = uiIconAssets['deck-review-cost-badge'].key;
  if (!scene.textures.exists(key)) {
    const accent = opts.zero ? 0x24d0d6 : 0xd8a840;
    const fallback = scene.add.circle(cx, cy, size / 2, 0x141b22, opts.alpha ?? 1)
      .setStrokeStyle(2, accent, opts.selected ? 1 : 0.82)
      .setName('deck-review-cost-badge-fallback');
    addTo(fallback);
    return fallback;
  }
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const badge = scene.add.image(cx, cy, key)
    .setDisplaySize(size, size)
    .setAlpha(opts.alpha ?? (opts.selected ? 0.98 : 0.9))
    .setName('deck-review-cost-badge');
  if (opts.zero) badge.setTint(0xd9fdff);
  addTo(badge);
  return badge;
}
import { MIN_SUPPORTED_TOUCH_TARGET, UI_BOLD, READER_UI, UI_TYPE, ROUTE_DECK_VISIBLE_ROWS } from './theme';
import { quietButton } from './quiet-ui';
import { fitTextExcerpt } from './text-excerpt';
import { controlActionForCode, controlBindingLabel } from './input-bindings';
import { comparisonPagingHint } from './deck-review-hints';
import {
  HUD_MENU_PANEL,
  renderFieldPanel,
  UI_FIELD,
  UI_FONT,
  UI_GOLD,
} from '../main';

const UI_SOFT = READER_UI.soft;
const UI_MUTED = READER_UI.muted;
const VISIBLE_ROWS = ROUTE_DECK_VISIBLE_ROWS;
const ROW_HEIGHT = 66;

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
      const query = label.getData('query') as string;
      const hints = search
        ? `Find: ${query || 'Type a card name or rule'}\n${controlBindingLabel('confirm')} or ${controlBindingLabel('back')}: finish search · Backspace: erase`
        : mode === 'controller'
          ? 'D-pad ↑/↓: card · ←/→: filter\nA: sort · X: pin · Y: save · B: close'
          : mode === 'keyboard'
            ? `Tab: card · ${controlBindingLabel('previous')}/${controlBindingLabel('next')}: filter · ${controlBindingLabel('confirm')}: sort\n${controlActionForCode('KeyC') ? 'Click Pin' : 'C: pin'} · ${controlActionForCode('KeyV') ? 'Click Save' : 'V: save'} · ${controlBindingLabel('back')}: close`
            : query ? `Finding “${query}” · Select a card to read · Pin to compare`
              : 'Select a card to read its rules · Pin to compare';
      const status = label.getData('saveStatus');
      const message = !search && status === 'failed' ? 'Flight was not saved. Use Retry save to try again.'
        : !search && status === 'full' ? 'Folios are full. Archive a flight in Flock Record → Folios to make room.' : '';
      label.setText(message || hints).setData('inputMode', mode);
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
    status: 'idle' | 'loading' | 'saved' | 'full' | 'failed';
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

function renderModeControl(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  label: string,
  name: string,
  onActivate: () => void,
  active = false,
  enabled = true,
) {
  return quietButton(scene, { x, y, width, label, name, onActivate, selected: active, enabled });
}

function renderScrollButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  enabled: boolean,
  onClick: () => void,
) {
  quietButton(scene, { x, y, width: 90, label, enabled, onActivate: onClick,
    name: `deck-review-scroll-${label.toLowerCase()}-hit` });
}

function renderCardColumn(scene: Phaser.Scene, view: RouteDeckBrowserView) {
  const scrollMax = Math.max(0, view.cards.length - VISIBLE_ROWS);
  const scroll = Phaser.Math.Clamp(Math.round(view.scroll), 0, scrollMax);
  const visible = view.cards.slice(scroll, scroll + VISIBLE_ROWS);

  visible.forEach((card, index) => {
    const x = 140;
    const y = 199 + index * ROW_HEIGHT;
    const frame = scene.add.rectangle(264, y + 15, 262, 58, 0x1d2224, card.selected ? 0.96 : 0)
      .setStrokeStyle(card.selected ? 1.5 : 0, 0xd8a840, 0.95);
    addDeckReviewCostBadge(scene, () => {}, x + 14, y + 15, 34, { zero: card.cost === 0, selected: card.selected });
    scene.add.text(x + 14, y + 15, `${card.cost}`, {
      fontFamily: UI_FONT,
      fontSize: `${UI_TYPE.primary}px`,
      resolution: UI_TYPE.resolution,
      fontStyle: UI_BOLD,
      color: '#f6f2df',
      stroke: '#020409',
      strokeThickness: 2,
    }).setOrigin(0.5).setName('deck-review-row-cost');
    const title = scene.add.text(176, y + 15, card.name, {
      fontFamily: UI_FONT,
      fontSize: `${UI_TYPE.primary}px`,
      fontStyle: UI_BOLD,
      color: card.selected ? UI_GOLD : '#dce8f2',
      wordWrap: { width: 212, useAdvancedWrap: true },
      maxLines: 2,
    }).setOrigin(0, 0.5).setResolution(2).setName('deck-review-row-title');
    fitTextExcerpt(title, card.name, 2);
    scene.add.rectangle(264, y + 15, 262, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('deck-review-row-hit')
      .setData('cardId', card.id).setData('selected', card.selected)
      .on('pointerover', () => frame.setStrokeStyle(2, 0x8df4ff, 1))
      .on('pointerout', () => frame.setStrokeStyle(card.selected ? 1.5 : 0, 0xd8a840, 0.95))
      .on('pointerdown', () => view.onInspect(card.id));
    quietButton(scene, { x: 449, y: y + 15, width: 88, label: card.pinned ? 'Unpin' : 'Pin',
      name: `deck-review-compare-hit-${card.id}`, kind: 'utility', selected: card.pinned,
      enabled: !view.searchActive, onActivate: () => view.onCompare(card.id) })
      .setData('cardId', card.id)
      .setData('pinned', card.pinned);
  });

  renderScrollButton(scene, 178, 614, 'Up', scroll > 0 && !view.searchActive, () => view.onScroll(-1));
  renderScrollButton(scene, 448, 614, 'Down', scroll < scrollMax && !view.searchActive, () => view.onScroll(1));
  const pageLabel = view.cards.length === 0 ? '0 / 0' : `${scroll + 1}-${scroll + visible.length} / ${view.cards.length}`;
  scene.add.text(313, 614, pageLabel, {
    fontFamily: UI_FONT,
    fontSize: `${UI_TYPE.secondary}px`,
    resolution: UI_TYPE.resolution,
    color: '#b9c9d8',
    align: 'center',
    fixedWidth: 164,
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5).setName('deck-review-page-label');
}

export function renderRouteDeckBrowser(scene: Phaser.Scene, view: RouteDeckBrowserView) {
  const original = view;
  // Retained callbacks must not act behind a newer modal or after closure.
  const owned = (action: () => void) => () => {
    const owner = scene as Phaser.Scene & { deckOverlayOpen?: boolean; pauseOverlayOpen?: boolean; settingsOverlayOpen?: boolean };
    if (owner.deckOverlayOpen === false || owner.pauseOverlayOpen || owner.settingsOverlayOpen) return;
    action();
  };
  view = { ...view, onClose: owned(view.onClose), onCycleFilter: owned(view.onCycleFilter),
    onCycleSort: owned(view.onCycleSort), onToggleSearch: owned(view.onToggleSearch),
    onSaveDeck: owned(view.onSaveDeck), onInspect: id => owned(() => original.onInspect(id))(),
    onCompare: id => owned(() => original.onCompare(id))(), onScroll: delta => owned(() => original.onScroll(delta))() };
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
    fontSize: `${UI_TYPE.secondary}px`,
    resolution: UI_TYPE.resolution,
    color: UI_SOFT,
    wordWrap: { width: 330 },
    stroke: '#020409',
    strokeThickness: 2,
  });
  quietButton(scene, { x: 1142, y: 126, width: 80, label: 'Close', name: 'deck-review-close-hit', onActivate: view.onClose });

  renderModeControl(scene, 569, 126, 134, `Filter ${view.filterLabel}`, 'deck-review-filter-hit', view.onCycleFilter, false, !view.searchActive);
  renderModeControl(scene, 711, 126, 134, `Sort ${view.sortLabel}`, 'deck-review-sort-hit', view.onCycleSort, false, !view.searchActive);
  const searchLabel = view.query
    ? `Find ${view.query}${view.searchActive ? '_' : ''}`
    : view.searchActive ? 'Find: type…' : 'Find /';
  renderModeControl(scene, 861, 126, 150, searchLabel, 'deck-review-search-hit', view.onToggleSearch, view.searchActive);
  const full = view.savedDecks.count >= view.savedDecks.capacity;
  const saveLabel = view.savedDecks.status === 'loading' ? 'Saving…'
    : view.savedDecks.status === 'saved'
    ? `Saved ${view.savedDecks.count}/${view.savedDecks.capacity}`
    : view.savedDecks.status === 'full' || full
      ? `Folios full ${view.savedDecks.count}/${view.savedDecks.capacity}`
      : view.savedDecks.status === 'failed'
        ? 'Retry save'
        : `Save flight ${view.savedDecks.count}/${view.savedDecks.capacity}`;
  const save = renderModeControl(
    scene,
    1019,
    126,
    150,
    saveLabel,
    'deck-review-save-folio-hit',
    view.onSaveDeck,
    view.savedDecks.status === 'saved',
    !view.searchActive && view.savedDecks.status !== 'loading' && !full && view.totalCards > 0,
  );
  if (view.savedDecks.status === 'loading' || view.savedDecks.status === 'failed') {
    save.setData({statusLabel: saveLabel, status: view.savedDecks.status === 'loading' ? 'loading' : 'error'});
  }
  // Keep the input guide below both the single-card and comparison readers.
  scene.add.text(640, 672, '', {
    fontFamily: UI_FONT,
    fontSize: `${UI_TYPE.secondary}px`,
    fontStyle: UI_BOLD,
    color: '#b9d6e3',
    fixedWidth: 1008,
    wordWrap: { width: 1008, useAdvancedWrap: true },
    align: 'center',
  }).setOrigin(0.5).setResolution(2).setName('deck-review-control-guide')
    .setData('searchActive', view.searchActive).setData('query', view.query)
    .setData('saveStatus', full ? 'full' : view.savedDecks.status);
  refreshReviewHints(scene);

  renderCardColumn(scene, view);
  if (view.cards.length === 0) {
    scene.add.text(290, 358, 'No matching cards', {
      fontFamily: UI_FONT,
      fontSize: `${UI_TYPE.primary}px`,
      resolution: UI_TYPE.resolution,
      fontStyle: UI_BOLD,
      color: UI_MUTED,
    }).setOrigin(0.5).setName('deck-review-empty-title');
    scene.add.text(290, 390, 'Change Filter or edit Find.', {
      fontFamily: UI_FONT,
      fontSize: `${UI_TYPE.secondary}px`,
      resolution: UI_TYPE.resolution,
      color: UI_SOFT,
    }).setOrigin(0.5).setName('deck-review-empty-hint');
  }
}
