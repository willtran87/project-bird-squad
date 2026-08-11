import Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';
import { safeStorageGet, safeStorageSet, writeJournaledJson } from './safe-storage';
import { saveAccount, type CardPersonalTag } from './meta';
import { CARD_PERSONAL_TAGS, sanitizeCardPersonalTags } from './card-personal-tags';
import {
  CODEX_SEARCH_FUZZY_MIN_LENGTH,
  matchCodexSearchText,
  normalizeCodexSearchText,
} from './codex-card-search';
import {
  CARD_JOURNAL_NOTE_LIMIT,
  sanitizeCardJournalNote,
  sanitizeCardJournalNotes,
  type CardJournalNotes,
} from './card-journal';
import { CARD_SHOWCASE_LIMIT, sanitizeCardShowcase } from './card-showcase';
import { sanitizeLockedCards } from './card-protection';
import {
  loadActiveFlightCardUsage,
  type ActiveFlightCardUsage,
} from './active-flight-card-usage';
import {
  CARD_ACQUISITION_PATHS,
  cardAcquisitionProfile,
} from './card-acquisition-paths';
import {
  cardFolioUsageIndex,
  type CardFolioUsageIndex,
} from './card-folio-usage';
import {
  CODEX_SAVED_VIEW_LIMIT,
  CODEX_SAVED_VIEW_STORAGE_KEY,
  CODEX_SAVED_VIEW_TABS,
  codexSavedViewMatches,
  createCodexSavedView,
  sanitizeCodexSavedViews,
  type CodexSavedView,
  type CodexSavedViewCriteria,
} from './codex-saved-views';
import { collectionMilestoneSnapshots } from './collection-milestones';
import { unlockCollectionMilestones } from './collection-milestone-progress';
import {
  activateRenderedAudioToggleControl, addCodexDossierFrame, addCodexEntryFrame, addSupplyArtImage,
  addUiIconImage, addWaymarkArtImage,
  advanceGameTime, alphaEnemyLibrary, alphaRouteMarkLibrary, alphaRouteMarkSet, alphaSupplyLibrary,
  bindControlActions, birdAudio, cardArtAssets, cardCompactArtAsset, cardLabel, cardLibrary, clamp,
  codexIconForLabel, codexLeaderArtAssets, codexUiIconIds, compactCardArtKey, compactEffectSummary,
  controlActionForCode, controlBindingLabel,
  countTextureInGameObjects, displayName, enemyArtAssets, enemyCodexIconForLabel, flockLeaders,
  GAME_HEIGHT, GAME_WIDTH, getLeader, hideKwTooltip, isAviaryCard, isLeaderUnlocked, isSnagCard,
  itemTypeCodexIconForLabel, KEYWORDS, killTweensForTree, LAZY_LOAD_FAILED, leaderUnlockHints,
  loadAccount, loadBossDossierModule, loadedCardArtKey, playUiSound, queueReserveEnemyArtAssets,
  queueRuntimeImageAssets, queueUiIconAssets, renderAudioToggleControl, renderRichText,
  renderSnagCardBorder, reserveEnemyArtAsset, routeMarkEffectGrammar, routeMarkEffectText,
  showKwTooltip, suitAccentColor, supplyArtAssets, supplyCodexIconForLabel, supplyCompactArtAssets,
  supplySynergyTags, UI_BODY, UI_BOLD, UI_CYAN, UI_FIELD, UI_FONT, UI_GOLD, UI_MUTED, UI_SOFT,
  uiIconAssets, waymarkArtAssets, waymarkCodexIconForLabel, waymarkCompactArtAssets, waymarkGlyph,
  waymarkSynergyTags,
  type BossDossierModule, type Card, type CodexDataModule, type CodexEnemyEntry,
  type CodexEnemySource, type CodexGlossaryTerm, type CodexItemEntry, type CodexItemTab,
  type CodexSection, type ReserveEnemyContract, type RuntimeEnemy, type RuntimeImageAsset,
  type RuntimeRouteMark, type RuntimeSupply, type TextureVisibleBounds, type UiIconId,
} from '../main';

type CodexFocusZone = 'sections' | 'search' | 'sort' | 'savedViews' | 'savedViewsOverlay' | 'primaryTabs' | 'progress' | 'secondaryTabs' | 'activeFilters' | 'newCards' | 'entries' | 'back' | 'detail' | 'progressOverlay';
type CardCollectionLens = 'all' | 'collected' | 'new' | 'tagged' | 'uncollected' | 'seen' | 'folio';
type CardSortMode = 'binder' | 'name' | 'rarity' | 'recent';
type CollectionFamilyId = 'major' | 'aviary' | 'plumes' | 'quills' | 'basins' | 'nests' | 'snags';
type CollectionRarityId = 'common' | 'uncommon' | 'rare' | 'legendary';
const COLLECTION_TARGET_LIMIT = 3;
const CARD_COLLECTION_LENS_KEY = 'birdsquad.codexCardLens';
const CARD_SEARCH_KEY = 'birdsquad.codexCardSearch';
const CARD_SORT_KEY = 'birdsquad.codexCardSort';
const CARD_SEARCH_MAX_LENGTH = 40;
const CODEX_DIAGNOSTIC_ID_LIMIT = 256;
const CARD_SEARCH_X = 245;
const CARD_SEARCH_Y = 42;
const CARD_SEARCH_WIDTH = 190;
const CARD_SEARCH_HEIGHT = 42;
const CARD_SORT_WIDTH = 62;
const CARD_SEARCH_ACTION_WIDTH = CARD_SEARCH_WIDTH - CARD_SORT_WIDTH;
const CARD_SEARCH_ACTION_X = CARD_SEARCH_X - CARD_SORT_WIDTH / 2;
const CARD_SORT_X = CARD_SEARCH_X + CARD_SEARCH_ACTION_WIDTH / 2;
const CARD_FILTER_CHIP_Y = 180;
const CARD_FILTER_GRID_TOP = 210;

interface CodexFocusEntry {
  id: string;
  label: string;
  canOpen: boolean;
}

interface CodexFocusGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ActiveCardFilterChip {
  id: 'search' | 'lens' | 'clear';
  label: string;
  value: string;
  x: number;
  width: number;
}

interface CodexDetailReturnContext {
  section: CodexSection;
  activeTab: number;
  activeItemTypeTab: number;
  activeItemFilterTab: number;
  activeEnemyTab: number;
  cardCollectionLens: CardCollectionLens;
  cardSearchQuery: string;
  cardSortMode: CardSortMode;
  entryId: string;
  entryIndex: number;
  gridScroll: number;
  gridScrollTarget: number;
}

interface CodexDetailReturnResult {
  entryId: string;
  exact: boolean;
  membershipChanged: boolean;
  gridScroll: number;
}

interface CollectionProgress {
  id: string;
  name: string;
  found: number;
  owned: number;
  discovered: number;
  total: number;
  stage: string;
  complete: boolean;
}

export class CodexScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private returnScene: 'MenuScene' | 'RouteScene' = 'MenuScene';
  private returnData?: object;
  private openAtlasOnCreate = false;
  private openCardOnCreate?: string;
  private activeSection: CodexSection = 'cards';
  private activeTab = 0;
  private activeEnemyTab = 0;
  private activeItemTypeTab = 0;
  private activeItemFilterTab = 0;
  private discovered = new Set<string>();
  private favoriteCards = new Set<string>();
  private lockedCards = new Set<string>();
  private collectionTargets = new Set<string>();
  private newlyAcquiredCards = new Set<string>();
  private cardFolioUsage: CardFolioUsageIndex = {};
  private activeFlightCardUsage?: ActiveFlightCardUsage;
  private cardTags: Partial<Record<string, CardPersonalTag>> = {};
  private cardJournal: CardJournalNotes = {};
  private cardJournalInput?: HTMLTextAreaElement;
  private cardJournalEditingId?: string;
  private cardJournalStatus: 'idle' | 'saved' | 'failed' = 'idle';
  private cardShowcase: string[] = [];
  private accountAchievements = new Set<string>();
  private cardCollectionLens: CardCollectionLens = 'all';
  private cardSortMode: CardSortMode = 'binder';
  private cardSearchQuery = '';
  private cardSearchBeforeEdit = '';
  private cardSearchEditing = false;
  private cardSearchInput?: HTMLInputElement;
  private cardCollection: ReturnType<typeof loadAccount>['cardCollection'] = {};
  private collectionAtlasOpen = false;
  private collectionAtlasFamilyIndex = 0;
  private savedCollectionViews: CodexSavedView[] = [];
  private savedCollectionViewsOpen = false;
  private savedCollectionViewIndex = 0;
  private savedCollectionViewStatus: 'idle' | 'saved' | 'duplicate' | 'full' | 'deleted' | 'applied' | 'failed' = 'idle';
  private activeCardFilterIndex = 0;
  private detailReturnContext?: CodexDetailReturnContext;
  private lastDetailReturnResult?: CodexDetailReturnResult;
  private observedEnemyMoves = new Set<string>();
  private detailId?: string;
  private detailScroll = 0;
  private detailMaxScroll = 0;
  private detailScrollTarget = 0;
  private gridScroll = 0;
  private gridMaxScroll = 0;
  private gridScrollTarget = 0;
  private gridLayer?: Phaser.GameObjects.Container;
  private gridRenderScroll = 0;
  private gridRenderCellH = 0;
  private lastScrollRenderAt = 0;
  private codexData?: CodexDataModule;
  private codexBossDossierModule?: BossDossierModule;
  private codexDataLoad?: Promise<void>;
  private codexDataFailed = false;
  private activationId = 0;
  private textureBoundsCache = new Map<string, TextureVisibleBounds>();
  private focusZone: CodexFocusZone = 'sections';
  private entryFocusIndex = 0;
  private focusRing?: Phaser.GameObjects.Rectangle;
  private detailClosePoint?: { x: number; y: number };
  private static readonly GRID_TOP = 158;
  private static readonly ITEM_GRID_TOP = 190;
  private static readonly GRID_BOTTOM = 690;
  private static readonly GRID_BOTTOM_FADE_HEIGHT = 72;
  private static readonly GRID_BOTTOM_FADE_STEPS = 8;
  private static readonly CARD_TAB_START_X = 54;
  private static readonly CARD_TAB_STEP = 104;
  private static readonly CARD_TAB_WIDTH = 104;
  private readonly tabs: Array<{ label: string; match: (c: Card) => boolean; view?: 'favorites' | 'targets' }> = [
    { label: 'Major', match: (c) => c.id.startsWith('major_') },
    { label: 'Aviary', match: (c) => c.id.startsWith('aviary_') },
    { label: 'Plumes', match: (c) => c.runtime.suit === 'plumes' },
    { label: 'Quills', match: (c) => c.runtime.suit === 'quills' },
    { label: 'Basins', match: (c) => c.runtime.suit === 'basins' },
    { label: 'Nests', match: (c) => c.runtime.suit === 'nests' },
    { label: 'Snags', match: (c) => c.runtime.kind === 'snag' },
    { label: 'Favorites', match: (c) => this.favoriteCards.has(c.id), view: 'favorites' },
    { label: 'Hunt List', match: (c) => this.collectionTargets.has(c.id), view: 'targets' },
  ];
  private readonly cardCollectionLenses: Array<{
    id: CardCollectionLens;
    label: string;
    match: (card: Card) => boolean;
  }> = [
    { id: 'all', label: 'All', match: () => true },
    { id: 'collected', label: 'Collected', match: (card) => Boolean(this.cardCollection[card.id]) },
    { id: 'new', label: 'New', match: (card) => this.newlyAcquiredCards.has(card.id) },
    { id: 'tagged', label: 'Tagged', match: (card) => Boolean(this.cardTags[card.id]) },
    { id: 'uncollected', label: 'Uncollected', match: (card) => !this.cardCollection[card.id] },
    { id: 'seen', label: 'Seen', match: (card) => this.discovered.has(card.id) && !this.cardCollection[card.id] },
    { id: 'folio', label: 'In Folios', match: (card) => Boolean(this.cardFolioUsage[card.id]) },
  ];
  private readonly cardSortModes: Array<{ id: CardSortMode; label: string }> = [
    { id: 'binder', label: 'Binder' },
    { id: 'name', label: 'Name' },
    { id: 'rarity', label: 'Rarity' },
    { id: 'recent', label: 'Recent' },
  ];
  private readonly enemyTabs: Array<{ label: string; match: (e: CodexEnemyEntry) => boolean }> = [
    { label: 'All', match: () => true },
    { label: 'Rooftops', match: (e) => e.district === 'Rooftop Blocks' },
    { label: 'Canals', match: (e) => e.district === 'Canal Markets' },
    { label: 'Signals', match: (e) => e.district === 'Signal Spires' },
    { label: 'Roost', match: (e) => e.district === 'High Roost' },
  ];
  private readonly itemTypeTabs: CodexItemTab[] = [
    { label: 'All', match: () => true },
    { label: 'Waymarks', match: (item) => item.kind === 'waymark' },
    { label: 'Supplies', match: (item) => item.kind === 'supply' },
  ];
  private readonly waymarkFilterTabs: CodexItemTab[] = [
    { label: 'All', match: (item) => item.kind === 'waymark' },
    { label: 'Shelter', match: (item) => item.kind === 'waymark' && item.mark.family === 'safety' },
    { label: 'Tempo', match: (item) => item.kind === 'waymark' && item.mark.family === 'route' },
    { label: 'Economy', match: (item) => item.kind === 'waymark' && item.mark.family === 'economy' },
    { label: 'Suit', match: (item) => item.kind === 'waymark' && item.mark.family === 'suit' },
    { label: 'Molt', match: (item) => item.kind === 'waymark' && item.mark.family === 'molt' },
    { label: 'Boss', match: (item) => item.kind === 'waymark' && item.mark.family === 'bossPrep' },
  ];
  private readonly supplyFilterTabs: CodexItemTab[] = [
    { label: 'All', match: (item) => item.kind === 'supply' },
    { label: 'Combat', match: (item) => item.kind === 'supply' && item.supply.timing === 'combat' },
    { label: 'Route', match: (item) => item.kind === 'supply' && item.supply.timing === 'route' },
    { label: 'Flexible', match: (item) => item.kind === 'supply' && item.supply.timing === 'either' },
    { label: 'Defense', match: (item) => item.kind === 'supply' && (['coverNow', 'openSkySafety', 'cleanseNow'] as RuntimeSupply['answerType'][]).includes(item.supply.answerType) },
    { label: 'Recovery', match: (item) => item.kind === 'supply' && (['healNow', 'cleanseNow'] as RuntimeSupply['answerType'][]).includes(item.supply.answerType) },
    { label: 'Momentum', match: (item) => item.kind === 'supply' && (['drawNow', 'wingbeatNow', 'handFix', 'moltNow'] as RuntimeSupply['answerType'][]).includes(item.supply.answerType) },
    { label: 'Pressure', match: (item) => item.kind === 'supply' && (['damageNow', 'antiCover', 'burstNow'] as RuntimeSupply['answerType'][]).includes(item.supply.answerType) },
    { label: 'Plan', match: (item) => item.kind === 'supply' && item.supply.answerType === 'tellControl' },
  ];
  private readonly sections: Array<{ id: CodexSection; label: string }> = [
    { id: 'cards', label: 'Cards' },
    { id: 'items', label: 'Items' },
    { id: 'leaders', label: 'Leaders' },
    { id: 'enemies', label: 'Enemies' },
    { id: 'glossary', label: 'Glossary' },
  ];
  private get glossaryTerms(): CodexGlossaryTerm[] {
    return this.codexData?.codexGlossaryTerms ?? [];
  }

  constructor() {
    super('CodexScene');
  }

  init(data: { returnScene?: string; returnData?: object; openCollectionAtlas?: boolean; openCardId?: string } = {}) {
    this.activationId += 1;
    this.returnScene = data.returnScene === 'RouteScene' ? 'RouteScene' : 'MenuScene';
    this.returnData = data.returnData;
    this.openAtlasOnCreate = data.openCollectionAtlas === true;
    this.openCardOnCreate = typeof data.openCardId === 'string' ? data.openCardId : undefined;
    this.focusZone = this.openAtlasOnCreate ? 'progressOverlay' : 'sections';
  }

  get activeItemTab() {
    if (this.activeItemTypeTab === 2) return 1;
    if (this.activeItemTypeTab === 1) return 2;
    return 0;
  }

  set activeItemTab(value: number) {
    // Legacy smoke/debug hook: old tab indexes were 1 = Supplies, 2 = Waymarks.
    this.activeItemTypeTab = value === 1 ? 2 : value === 2 ? 1 : 0;
    this.activeItemFilterTab = 0;
  }

  create() {
    birdAudio.setMood('menu');
    this.cameras.main.fadeIn(180);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.32);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.82);
    this.root = this.add.container(0, 0);
    const account = loadAccount();
    this.discovered = new Set(account.discoveredCards);
    this.favoriteCards = new Set(account.favoriteCards);
    let storedLockedCards: unknown;
    try {
      storedLockedCards = (JSON.parse(safeStorageGet('birdsquad.account') ?? '{}') as { lockedCards?: unknown }).lockedCards;
    } catch {
      storedLockedCards = undefined;
    }
    const lockedCards = sanitizeLockedCards(storedLockedCards, account.cardCollection);
    const repairedLockedState = JSON.stringify(lockedCards) !== JSON.stringify(storedLockedCards ?? []);
    account.lockedCards = lockedCards;
    this.lockedCards = new Set(lockedCards);
    const cardTags = sanitizeCardPersonalTags(account.cardTags, account.discoveredCards);
    const repairedTagState = Object.keys(cardTags).length !== Object.keys(account.cardTags ?? {}).length;
    account.cardTags = cardTags;
    this.cardTags = cardTags;
    const cardJournal = sanitizeCardJournalNotes(account.cardJournal, account.discoveredCards);
    let storedCardJournal: unknown;
    try {
      storedCardJournal = (JSON.parse(safeStorageGet('birdsquad.account') ?? '{}') as { cardJournal?: unknown }).cardJournal;
    } catch {
      storedCardJournal = undefined;
    }
    const repairedJournalState = JSON.stringify(cardJournal) !== JSON.stringify(storedCardJournal ?? {});
    account.cardJournal = cardJournal;
    this.cardJournal = cardJournal;
    const cardShowcase = sanitizeCardShowcase(account.showcase, account.discoveredCards);
    const repairedShowcase = JSON.stringify(cardShowcase) !== JSON.stringify(account.showcase ?? []);
    account.showcase = cardShowcase;
    this.cardShowcase = cardShowcase;
    this.cardCollection = account.cardCollection;
    this.cardFolioUsage = cardFolioUsageIndex(account.decks);
    this.activeFlightCardUsage = loadActiveFlightCardUsage(new Set(Object.keys(cardLibrary)));
    this.collectionAtlasOpen = this.openAtlasOnCreate;
    this.collectionAtlasFamilyIndex = 0;
    if (this.collectionAtlasOpen) this.focusZone = 'progressOverlay';
    let repairedNewCardState = false;
    Object.values(account.cardCollection).forEach((record) => {
      if (!('isNew' in record) || record.isNew === true) return;
      delete record.isNew;
      repairedNewCardState = true;
    });
    const repairedCollectionMilestones = unlockCollectionMilestones(account);
    this.accountAchievements = new Set(account.achievements);
    if (
      repairedNewCardState
      || repairedTagState
      || repairedJournalState
      || repairedShowcase
      || repairedLockedState
      || repairedCollectionMilestones.length > 0
    ) {
      writeJournaledJson('birdsquad.account', account);
    }
    this.newlyAcquiredCards = new Set(Object.entries(account.cardCollection)
      .filter(([, record]) => record.isNew === true)
      .map(([id]) => id));
    const directCardId = this.openCardOnCreate && this.cardCollection[this.openCardOnCreate]
      ? this.openCardOnCreate
      : undefined;
    if (directCardId) {
      const directCard = cardLibrary[directCardId];
      this.collectionAtlasOpen = false;
      this.activeSection = 'cards';
      this.activeTab = Math.max(0, this.tabs.findIndex((tab) => tab.match(directCard)));
      this.cardCollectionLens = 'all';
      this.cardSearchQuery = '';
      queueMicrotask(() => {
        if (this.sys.settings.active) this.openCodexDetail(directCardId, false);
      });
    }
    const savedLens = safeStorageGet(CARD_COLLECTION_LENS_KEY);
    this.cardCollectionLens = this.cardCollectionLenses.some((lens) => lens.id === savedLens)
      ? savedLens as CardCollectionLens
      : 'all';
    this.cardSearchQuery = this.sanitizeCardSearchQuery(safeStorageGet(CARD_SEARCH_KEY) ?? '', true);
    const savedSort = safeStorageGet(CARD_SORT_KEY);
    this.cardSortMode = this.cardSortModes.some((mode) => mode.id === savedSort)
      ? savedSort as CardSortMode
      : 'binder';
    const savedViewsRaw = safeStorageGet(CODEX_SAVED_VIEW_STORAGE_KEY);
    let savedViewsValue: unknown = [];
    try {
      savedViewsValue = JSON.parse(savedViewsRaw ?? '[]');
    } catch {
      savedViewsValue = [];
    }
    this.savedCollectionViews = sanitizeCodexSavedViews(savedViewsValue);
    this.savedCollectionViewsOpen = false;
    this.savedCollectionViewIndex = 0;
    this.savedCollectionViewStatus = 'idle';
    const repairedSavedViews = JSON.stringify(this.savedCollectionViews);
    if (savedViewsRaw !== repairedSavedViews) {
      safeStorageSet(CODEX_SAVED_VIEW_STORAGE_KEY, repairedSavedViews);
    }
    this.collectionTargets = new Set((account.hunt ?? []).filter((id) => (
      this.discovered.has(id) && !this.cardCollection[id] && Boolean(cardLibrary[id])
    )));
    this.observedEnemyMoves = new Set(account.observedEnemyMoves);
    void this.ensureCodexData();
    queueUiIconAssets(this, codexUiIconIds, 'Codex UI', () => this.renderAll());
    this.queueArt();
    this.renderAll();
    bindControlActions(this, {
      confirm: () => this.activateCodexFocus(),
      previous: () => this.moveCodexHorizontal(-1),
      next: () => this.moveCodexHorizontal(1),
      back: () => this.handleCodexBack(),
      mute: () => {
        if (!activateRenderedAudioToggleControl(this)) birdAudio.toggleMute();
      },
      fullscreen: () => this.scale.toggleFullscreen(),
    });
    const onTab = (event: KeyboardEvent) => {
      if (this.cardSearchEditing) return;
      event.preventDefault();
      event.stopPropagation();
      this.cycleCodexFocusZone(event.shiftKey ? -1 : 1);
    };
    const onUp = (event?: KeyboardEvent) => {
      if (this.cardSearchEditing) return;
      if (event?.code && controlActionForCode(event.code)) return;
      this.moveCodexVertical(-1);
    };
    const onDown = (event?: KeyboardEvent) => {
      if (this.cardSearchEditing) return;
      if (event?.code && controlActionForCode(event.code)) return;
      this.moveCodexVertical(1);
    };
    const onFavorite = (event: KeyboardEvent) => {
      if (this.nativeTextInputActive()) return;
      if (event.repeat || this.activeSection !== 'cards' || !this.detailId) return;
      this.toggleCurrentCardFavorite();
    };
    const onTarget = (event: KeyboardEvent) => {
      if (this.nativeTextInputActive()) return;
      if (event.repeat || this.activeSection !== 'cards' || !this.detailId) return;
      this.toggleCurrentCollectionTarget();
    };
    const onCardTag = (event: KeyboardEvent) => {
      if (this.nativeTextInputActive() || event.repeat || this.activeSection !== 'cards' || !this.detailId) return;
      this.cycleCurrentCardTag();
    };
    const onOpenFlightDeck = (event: KeyboardEvent) => {
      if (this.nativeTextInputActive() || event.repeat || this.activeSection !== 'cards' || !this.detailId) return;
      this.openCurrentCardInFlightDeck();
    };
    const onCardJournal = (event: KeyboardEvent) => {
      if (this.nativeTextInputActive() || event.repeat || this.activeSection !== 'cards' || !this.detailId) return;
      this.openCardJournal();
    };
    const onCollectionLens = (event: KeyboardEvent) => {
      if (this.cardSearchEditing) return;
      if (event.repeat || this.activeSection !== 'cards' || this.detailId || this.collectionAtlasOpen || this.savedCollectionViewsOpen) return;
      this.cycleCardCollectionLens(1);
    };
    const onCardSort = (event: KeyboardEvent) => {
      if (this.cardSearchEditing) return;
      if (event.repeat || this.activeSection !== 'cards' || this.detailId || this.collectionAtlasOpen || this.savedCollectionViewsOpen) return;
      this.cycleCardSortMode(1);
    };
    const onNewCards = (event: KeyboardEvent) => {
      if (this.cardSearchEditing || event.repeat || this.activeSection !== 'cards' || this.collectionAtlasOpen || this.savedCollectionViewsOpen) return;
      if (this.detailId) this.acknowledgeCurrentNewCard();
      else this.clearAllNewCards();
    };
    const onCollectionAtlas = (event: KeyboardEvent) => {
      if (
        this.cardSearchEditing
        || event.repeat
        || this.activeSection !== 'cards'
        || this.savedCollectionViewsOpen
      ) return;
      if (this.detailId) {
        this.toggleCurrentCardShowcase();
        return;
      }
      if (this.collectionAtlasOpen) this.closeCollectionAtlas();
      else this.openCollectionAtlas();
    };
    const onCardSearch = (event: KeyboardEvent) => {
      if (
        this.cardSearchEditing
        || event.repeat
        || this.activeSection !== 'cards'
        || this.detailId
        || this.collectionAtlasOpen
        || this.savedCollectionViewsOpen
        || (event.key !== '/' && event.code !== 'Slash')
      ) return;
      event.preventDefault();
      event.stopPropagation();
      this.openCardSearch();
    };
    const onCardSearchPointer = (pointer: Phaser.Input.Pointer) => {
      if (
        this.cardSearchEditing
        || this.activeSection !== 'cards'
        || this.detailId
        || this.collectionAtlasOpen
        || this.savedCollectionViewsOpen
        || Math.abs(pointer.x - CARD_SEARCH_X) > CARD_SEARCH_WIDTH / 2
        || Math.abs(pointer.y - CARD_SEARCH_Y) > MIN_SUPPORTED_TOUCH_TARGET / 2
      ) return;
      const sortBoundary = CARD_SEARCH_X - CARD_SEARCH_WIDTH / 2 + CARD_SEARCH_ACTION_WIDTH;
      if (pointer.x >= sortBoundary) this.cycleCardSortMode(1);
      else this.scheduleCardSearchOpen();
    };
    const onNewCardsPointer = (pointer: Phaser.Input.Pointer) => {
      if (
        this.cardSearchEditing
        || this.activeSection !== 'cards'
        || this.detailId
        || this.collectionAtlasOpen
        || this.savedCollectionViewsOpen
        || this.newlyAcquiredCards.size === 0
        || Math.abs(pointer.x - (GAME_WIDTH - 72)) > 66
        || Math.abs(pointer.y - CARD_FILTER_CHIP_Y) > MIN_SUPPORTED_TOUCH_TARGET / 2
      ) return;
      this.focusZone = 'newCards';
      this.clearAllNewCards();
    };
    const onSavedViewsPointer = (pointer: Phaser.Input.Pointer) => {
      if (
        this.cardSearchEditing
        || this.activeSection !== 'cards'
        || this.detailId
        || this.collectionAtlasOpen
        || this.savedCollectionViewsOpen
        || Math.abs(pointer.x - 482) > 26
        || Math.abs(pointer.y - 42) > MIN_SUPPORTED_TOUCH_TARGET / 2
      ) return;
      this.focusZone = 'savedViews';
      this.openSavedCollectionViews();
    };
    const onSavedCollectionViews = (event: KeyboardEvent) => {
      if (
        this.nativeTextInputActive()
        || event.repeat
        || controlActionForCode(event.code)
        || this.activeSection !== 'cards'
        || this.detailId
        || this.collectionAtlasOpen
      ) return;
      event.preventDefault();
      event.stopPropagation();
      if (this.savedCollectionViewsOpen) this.closeSavedCollectionViews();
      else this.openSavedCollectionViews();
    };
    const onSaveCollectionView = (event: KeyboardEvent) => {
      if (
        this.nativeTextInputActive()
        || event.repeat
        || !event.ctrlKey
        || !this.savedCollectionViewsOpen
      ) return;
      event.preventDefault();
      event.stopPropagation();
      this.saveCurrentCollectionView();
    };
    const onDeleteCollectionView = (event: KeyboardEvent) => {
      if (
        this.nativeTextInputActive()
        || event.repeat
        || controlActionForCode(event.code)
      ) return;
      const deleteSavedView = this.savedCollectionViewsOpen;
      const clearFilter = !deleteSavedView && this.focusZone === 'activeFilters';
      if (!deleteSavedView && !clearFilter) return;
      event.preventDefault();
      event.stopPropagation();
      if (deleteSavedView) this.deleteSelectedCollectionView();
      else this.clearActiveCardFilter();
    };
    const onGamepadDown = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      if (this.cardJournalInput) {
        if (button.index === 0) this.finishCardJournal(true);
        else if (button.index === 1) this.finishCardJournal(false);
        return;
      }
      if (this.cardSearchEditing) {
        if (button.index === 0) this.finishCardSearch(true);
        else if (button.index === 1) this.finishCardSearch(false);
        return;
      }
      if (this.savedCollectionViewsOpen) {
        if (button.index === 12) this.moveSavedCollectionViewSelection(-1);
        else if (button.index === 13) this.moveSavedCollectionViewSelection(1);
        else if (button.index === 0) this.applySelectedCollectionView();
        else if (button.index === 1 || button.index === 8) this.closeSavedCollectionViews();
        else if (button.index === 2) this.saveCurrentCollectionView();
        else if (button.index === 3) this.deleteSelectedCollectionView();
        return;
      }
      if (this.collectionAtlasOpen) {
        if (button.index === 12) this.moveCodexVertical(-1);
        else if (button.index === 13) this.moveCodexVertical(1);
        else if (button.index === 0) this.selectCollectionAtlasFamily();
        else if (button.index === 1 || button.index === 11) this.closeCollectionAtlas();
        return;
      }
      if (button.index === 12) this.moveCodexVertical(-1);
      else if (button.index === 13) this.moveCodexVertical(1);
      else if (button.index === 14) this.moveCodexHorizontal(-1);
      else if (button.index === 15) this.moveCodexHorizontal(1);
      else if (button.index === 0) this.activateCodexFocus();
      else if (button.index === 1) this.handleCodexBack();
      else if (button.index === 2 && this.activeSection === 'cards' && this.detailId) this.toggleCurrentCardFavorite();
      else if (button.index === 3 && this.activeSection === 'cards' && this.detailId) this.toggleCurrentCollectionTarget();
      else if (button.index === 4 && this.activeSection === 'cards' && !this.detailId) this.cycleCardCollectionLens(1);
      else if (button.index === 5 && this.activeSection === 'cards') {
        if (this.detailId) this.openCurrentCardInFlightDeck();
        else this.openCardSearch();
      }
      else if (button.index === 6 && this.activeSection === 'cards') {
        if (this.detailId) this.acknowledgeCurrentNewCard();
        else this.clearAllNewCards();
      }
      else if (button.index === 7 && this.activeSection === 'cards' && !this.detailId) this.cycleCardSortMode(1);
      else if (button.index === 8 && this.activeSection === 'cards' && !this.detailId) this.openSavedCollectionViews();
      else if (button.index === 9 && this.activeSection === 'cards' && this.detailId) this.openCardJournal();
      else if (button.index === 10 && this.activeSection === 'cards' && this.detailId) this.cycleCurrentCardTag();
      else if (button.index === 11 && this.activeSection === 'cards') {
        if (this.detailId) this.toggleCurrentCardShowcase();
        else this.openCollectionAtlas();
      }
    };
    this.input.keyboard?.on('keydown-TAB', onTab);
    this.input.keyboard?.on('keydown-UP', onUp);
    this.input.keyboard?.on('keydown-DOWN', onDown);
    this.input.keyboard?.on('keydown-C', onFavorite);
    this.input.keyboard?.on('keydown-T', onTarget);
    this.input.keyboard?.on('keydown-V', onCardTag);
    this.input.keyboard?.on('keydown-D', onOpenFlightDeck);
    this.input.keyboard?.on('keydown-J', onCardJournal);
    this.input.keyboard?.on('keydown-L', onCollectionLens);
    this.input.keyboard?.on('keydown-R', onCardSort);
    this.input.keyboard?.on('keydown-N', onNewCards);
    this.input.keyboard?.on('keydown-G', onCollectionAtlas);
    this.input.keyboard?.on('keydown-B', onSavedCollectionViews);
    this.input.keyboard?.on('keydown-S', onSaveCollectionView);
    this.input.keyboard?.on('keydown-DELETE', onDeleteCollectionView);
    this.input.keyboard?.on('keydown-BACKSPACE', onDeleteCollectionView);
    this.input.keyboard?.on('keydown', onCardSearch);
    this.input.on('pointerdown', onCardSearchPointer);
    this.input.on('pointerdown', onNewCardsPointer);
    this.input.on('pointerdown', onSavedViewsPointer);
    this.input.gamepad?.on('down', onGamepadDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-TAB', onTab);
      this.input.keyboard?.off('keydown-UP', onUp);
      this.input.keyboard?.off('keydown-DOWN', onDown);
      this.input.keyboard?.off('keydown-C', onFavorite);
      this.input.keyboard?.off('keydown-T', onTarget);
      this.input.keyboard?.off('keydown-V', onCardTag);
      this.input.keyboard?.off('keydown-D', onOpenFlightDeck);
      this.input.keyboard?.off('keydown-J', onCardJournal);
      this.input.keyboard?.off('keydown-L', onCollectionLens);
      this.input.keyboard?.off('keydown-R', onCardSort);
      this.input.keyboard?.off('keydown-N', onNewCards);
      this.input.keyboard?.off('keydown-G', onCollectionAtlas);
      this.input.keyboard?.off('keydown-B', onSavedCollectionViews);
      this.input.keyboard?.off('keydown-S', onSaveCollectionView);
      this.input.keyboard?.off('keydown-DELETE', onDeleteCollectionView);
      this.input.keyboard?.off('keydown-BACKSPACE', onDeleteCollectionView);
      this.input.keyboard?.off('keydown', onCardSearch);
      this.input.off('pointerdown', onCardSearchPointer);
      this.input.off('pointerdown', onNewCardsPointer);
      this.input.off('pointerdown', onSavedViewsPointer);
      this.input.gamepad?.off('down', onGamepadDown);
      this.finishCardSearch(true, false);
      this.finishCardJournal(false, false);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.detailId) {
        if (this.detailMaxScroll <= 0) return;
        this.detailScrollTarget = clamp(
          this.detailScrollTarget + this.normalizedWheelDelta(dy),
          0,
          this.detailMaxScroll
        );
        return;
      }
      if (this.gridMaxScroll <= 0) return;
      this.gridScrollTarget = clamp(
        this.gridScrollTarget + this.normalizedWheelDelta(dy),
        0,
        this.gridMaxScroll
      );
    });
  }

  update(time: number, delta: number) {
    if (this.detailId) {
      this.updateDetailScroll(time, delta);
      return;
    }
    this.updateGridScroll(delta);
  }

  private updateDetailScroll(time: number, delta: number) {
    if (this.detailMaxScroll <= 0) return;
    const target = clamp(this.detailScrollTarget, 0, this.detailMaxScroll);
    const distance = target - this.detailScroll;
    if (Math.abs(distance) < 0.1) return;

    const ease = 1 - Math.pow(0.0015, Math.min(delta, 50) / 180);
    const next = Math.abs(distance) < 0.75 ? target : this.detailScroll + distance * ease;
    this.detailScroll = clamp(next, 0, this.detailMaxScroll);
    if (time - this.lastScrollRenderAt >= 16 || next === target) {
      this.lastScrollRenderAt = time;
      this.renderAll();
    }
  }

  private updateGridScroll(delta: number) {
    if (this.gridMaxScroll <= 0) return;
    const target = clamp(this.gridScrollTarget, 0, this.gridMaxScroll);
    const distance = target - this.gridScroll;
    if (Math.abs(distance) < 0.1) return;

    const ease = 1 - Math.pow(0.0015, Math.min(delta, 50) / 180);
    const next = Math.abs(distance) < 0.75 ? target : this.gridScroll + distance * ease;
    this.gridScroll = clamp(next, 0, this.gridMaxScroll);
    if (this.gridLayer?.active) {
      this.gridLayer.y = -this.gridScroll;
    }

    const drift = Math.abs(this.gridScroll - this.gridRenderScroll);
    const rerenderDistance = Math.max(128, this.gridRenderCellH * 1.5);
    if (drift >= rerenderDistance || (next === target && drift > 1)) {
      this.renderAll();
    }
  }

  private normalizedWheelDelta(dy: number) {
    if (!Number.isFinite(dy) || dy === 0) return 0;
    const magnitude = clamp(Math.abs(dy) * 0.78, 4, 128);
    return Math.sign(dy) * magnitude;
  }

  private resetCodexScroll() {
    this.detailScroll = 0;
    this.detailScrollTarget = 0;
    this.gridScroll = 0;
    this.gridScrollTarget = 0;
  }

  private openCodexDetail(id: string, sound = true) {
    const entries = this.codexFocusEntries();
    const entryIndex = entries.findIndex((entry) => entry.id === id);
    if (entryIndex >= 0) this.entryFocusIndex = entryIndex;
    this.detailReturnContext = {
      section: this.activeSection,
      activeTab: this.activeTab,
      activeItemTypeTab: this.activeItemTypeTab,
      activeItemFilterTab: this.activeItemFilterTab,
      activeEnemyTab: this.activeEnemyTab,
      cardCollectionLens: this.cardCollectionLens,
      cardSearchQuery: this.cardSearchQuery,
      cardSortMode: this.cardSortMode,
      entryId: id,
      entryIndex: entryIndex >= 0 ? entryIndex : this.entryFocusIndex,
      gridScroll: this.gridScroll,
      gridScrollTarget: this.gridScrollTarget,
    };
    this.lastDetailReturnResult = undefined;
    this.detailId = id;
    this.focusZone = 'detail';
    this.detailScroll = 0;
    this.detailScrollTarget = 0;
    if (sound) playUiSound('confirm');
    this.renderAll();
  }

  private closeCodexDetail(sound = true) {
    const context = this.detailReturnContext;
    this.detailId = undefined;
    if (context) {
      this.activeSection = context.section;
      this.activeTab = context.activeTab;
      this.activeItemTypeTab = context.activeItemTypeTab;
      this.activeItemFilterTab = context.activeItemFilterTab;
      this.activeEnemyTab = context.activeEnemyTab;
      this.cardCollectionLens = context.cardCollectionLens;
      this.cardSearchQuery = context.cardSearchQuery;
      this.cardSortMode = context.cardSortMode;
      const entryIndex = this.codexFocusEntries().findIndex((entry) => entry.id === context.entryId);
      const membershipChanged = entryIndex < 0;
      this.entryFocusIndex = membershipChanged
        ? clamp(context.entryIndex, 0, Math.max(0, this.codexFocusEntries().length - 1))
        : entryIndex;
      this.gridScroll = context.gridScroll;
      this.gridScrollTarget = context.gridScrollTarget;
      if (membershipChanged) this.ensureFocusedEntryVisible();
      this.lastDetailReturnResult = {
        entryId: context.entryId,
        exact: !membershipChanged,
        membershipChanged,
        gridScroll: this.gridScroll,
      };
    } else {
      this.ensureFocusedEntryVisible();
    }
    this.detailReturnContext = undefined;
    this.focusZone = 'entries';
    this.detailScroll = 0;
    this.detailScrollTarget = 0;
    if (sound) playUiSound('close');
    this.renderAll();
  }

  private allCards(): Card[] {
    return Object.values(cardLibrary);
  }

  private collectionStage(owned: number, total: number) {
    if (total > 0 && owned >= total) return 'Collection Complete';
    const ratio = owned / Math.max(1, total);
    if (owned === 0) return 'Ready to Begin';
    if (ratio < 0.25) return 'First Shelf';
    if (ratio < 0.5) return 'Growing Library';
    if (ratio < 0.75) return 'Established Archive';
    return 'Near Complete';
  }

  private collectionFamilyId(card: Card): CollectionFamilyId | undefined {
    if (card.id.startsWith('major_')) return 'major';
    if (card.id.startsWith('aviary_')) return 'aviary';
    if (card.runtime.kind === 'snag') return 'snags';
    const suit = card.runtime.suit;
    return suit === 'plumes' || suit === 'quills' || suit === 'basins' || suit === 'nests'
      ? suit
      : undefined;
  }

  private collectionProgress(
    id: string,
    name: string,
    cards: Card[],
  ): CollectionProgress {
    const owned = cards.filter((card) => Boolean(this.cardCollection[card.id])).length;
    const discovered = cards.filter((card) => this.discovered.has(card.id)).length;
    return {
      id,
      name,
      found: owned,
      owned,
      discovered,
      total: cards.length,
      stage: this.collectionStage(owned, cards.length),
      complete: cards.length > 0 && owned >= cards.length,
    };
  }

  private collectionAtlasSnapshot() {
    const all = this.allCards();
    const familyDefs: Array<{ id: CollectionFamilyId; name: string }> = [
      { id: 'major', name: 'Major Arcana' },
      { id: 'aviary', name: 'Aviary' },
      { id: 'plumes', name: 'Plumes' },
      { id: 'quills', name: 'Quills' },
      { id: 'basins', name: 'Basins' },
      { id: 'nests', name: 'Nests' },
      { id: 'snags', name: 'Snags' },
    ];
    const families = familyDefs.map(({ id, name }) => this.collectionProgress(
      id,
      name,
      all.filter((card) => this.collectionFamilyId(card) === id),
    ));
    const rarityDefs: Array<{ id: CollectionRarityId; name: string }> = [
      { id: 'common', name: 'Common' },
      { id: 'uncommon', name: 'Uncommon' },
      { id: 'rare', name: 'Rare' },
      { id: 'legendary', name: 'Legendary' },
    ];
    const rarities = rarityDefs.map(({ id, name }) => this.collectionProgress(
      id,
      name,
      all.filter((card) => card.runtime.rarity === id),
    ));
    const sources = CARD_ACQUISITION_PATHS.map(({ id, label }) => ({
      id,
      name: label,
      count: all.filter((card) => this.cardCollection[card.id]?.firstSource === id).length,
    }));
    const milestones = collectionMilestoneSnapshots({
      achievements: [...this.accountAchievements],
      discoveredCards: [...this.discovered],
      cardCollection: this.cardCollection,
      cardTags: this.cardTags,
    });
    const overall = this.collectionProgress('all', 'All Cards', all);
    const selectedIndex = clamp(Math.round(this.collectionAtlasFamilyIndex), 0, families.length - 1);
    const selectedFamilyId = familyDefs[selectedIndex]?.id;
    const selectedCards = all.filter((card) => this.collectionFamilyId(card) === selectedFamilyId);
    const selectedMissingCards = selectedCards.filter((card) => !this.cardCollection[card.id]);
    const missingPaths = CARD_ACQUISITION_PATHS.map((path) => ({
      id: path.id,
      name: path.label,
      description: path.description,
      count: selectedMissingCards.filter((card) => (
        cardAcquisitionProfile(card.id, card.runtime.kind).paths.some((candidate) => candidate.id === path.id)
      )).length,
    })).filter((path) => path.count > 0);
    return {
      open: this.collectionAtlasOpen,
      keyboard: 'G',
      controller: 'R3',
      revealsUndiscoveredIdentities: false,
      overall,
      families,
      rarities,
      sources,
      milestones,
      completedMilestones: milestones.filter((milestone) => milestone.complete).length,
      nextMilestone: milestones.find((milestone) => !milestone.complete) ?? milestones.at(-1),
      selectedIndex,
      selectedFamily: families[selectedIndex],
      selectedMissing: {
        count: selectedMissingCards.length,
        encountered: selectedMissingCards.filter((card) => this.discovered.has(card.id)).length,
        concealed: selectedMissingCards.filter((card) => !this.discovered.has(card.id)).length,
        paths: missingPaths,
        revealsIdentities: false,
        permanentAvailability: true,
        rotating: false,
      },
    };
  }

  private activeCollectionProgress() {
    const atlas = this.collectionAtlasSnapshot();
    return this.activeTab >= 0 && this.activeTab < atlas.families.length
      ? atlas.families[this.activeTab]
      : atlas.overall;
  }

  private openCollectionAtlas() {
    if (this.activeSection !== 'cards' || this.detailId) return;
    const familyCount = this.collectionAtlasSnapshot().families.length;
    this.collectionAtlasFamilyIndex = this.activeTab >= 0 && this.activeTab < familyCount
      ? this.activeTab
      : 0;
    this.collectionAtlasOpen = true;
    this.focusZone = 'progressOverlay';
    playUiSound('confirm');
    this.renderAll();
  }

  private closeCollectionAtlas(sound = true) {
    if (!this.collectionAtlasOpen) return;
    this.collectionAtlasOpen = false;
    this.focusZone = 'progress';
    if (sound) playUiSound('close');
    this.renderAll();
  }

  private moveCollectionAtlasSelection(direction: -1 | 1) {
    const families = this.collectionAtlasSnapshot().families;
    if (families.length === 0) return;
    this.collectionAtlasFamilyIndex = (
      this.collectionAtlasFamilyIndex + direction + families.length
    ) % families.length;
    playUiSound('confirm');
    this.renderAll();
  }

  private selectCollectionAtlasFamily(index = this.collectionAtlasFamilyIndex) {
    const families = this.collectionAtlasSnapshot().families;
    const next = clamp(Math.round(index), 0, families.length - 1);
    this.collectionAtlasFamilyIndex = next;
    this.collectionAtlasOpen = false;
    this.activeTab = next;
    this.focusZone = 'primaryTabs';
    this.entryFocusIndex = 0;
    this.resetCodexScroll();
    playUiSound('confirm');
    this.renderAll();
  }

  private currentSavedCollectionViewCriteria(): CodexSavedViewCriteria {
    return {
      tab: CODEX_SAVED_VIEW_TABS[this.activeTab]?.id ?? 'major',
      lens: this.cardCollectionLens,
      query: this.sanitizeCardSearchQuery(this.cardSearchQuery, true),
      sort: this.cardSortMode,
    };
  }

  private persistSavedCollectionViews(views: CodexSavedView[]) {
    return safeStorageSet(CODEX_SAVED_VIEW_STORAGE_KEY, JSON.stringify(views));
  }

  private openSavedCollectionViews() {
    if (this.activeSection !== 'cards' || this.detailId || this.collectionAtlasOpen) return;
    const current = this.currentSavedCollectionViewCriteria();
    const matching = this.savedCollectionViews.findIndex((view) => codexSavedViewMatches(view, current));
    this.savedCollectionViewIndex = matching >= 0
      ? matching
      : clamp(this.savedCollectionViewIndex, 0, Math.max(0, this.savedCollectionViews.length - 1));
    this.savedCollectionViewStatus = 'idle';
    this.savedCollectionViewsOpen = true;
    this.focusZone = 'savedViewsOverlay';
    playUiSound('confirm');
    this.renderAll();
  }

  private closeSavedCollectionViews(sound = true) {
    if (!this.savedCollectionViewsOpen) return;
    this.savedCollectionViewsOpen = false;
    this.savedCollectionViewStatus = 'idle';
    this.focusZone = 'savedViews';
    if (sound) playUiSound('close');
    this.renderAll();
  }

  private moveSavedCollectionViewSelection(direction: -1 | 1) {
    if (!this.savedCollectionViewsOpen || this.savedCollectionViews.length === 0) return;
    this.savedCollectionViewIndex = (
      this.savedCollectionViewIndex + direction + this.savedCollectionViews.length
    ) % this.savedCollectionViews.length;
    this.savedCollectionViewStatus = 'idle';
    playUiSound('confirm');
    this.renderAll();
  }

  private saveCurrentCollectionView() {
    if (!this.savedCollectionViewsOpen) return;
    const criteria = this.currentSavedCollectionViewCriteria();
    const duplicate = this.savedCollectionViews.findIndex((view) => codexSavedViewMatches(view, criteria));
    if (duplicate >= 0) {
      this.savedCollectionViewIndex = duplicate;
      this.savedCollectionViewStatus = 'duplicate';
      playUiSound('locked');
      this.renderAll();
      return;
    }
    if (this.savedCollectionViews.length >= CODEX_SAVED_VIEW_LIMIT) {
      this.savedCollectionViewStatus = 'full';
      playUiSound('locked');
      this.renderAll();
      return;
    }
    const previous = this.savedCollectionViews;
    const next = [...previous, createCodexSavedView(criteria)];
    if (!this.persistSavedCollectionViews(next)) {
      this.savedCollectionViewStatus = 'failed';
      playUiSound('locked');
      this.renderAll();
      return;
    }
    this.savedCollectionViews = next;
    this.savedCollectionViewIndex = next.length - 1;
    this.savedCollectionViewStatus = 'saved';
    playUiSound('confirm');
    this.renderAll();
  }

  private deleteSelectedCollectionView() {
    if (!this.savedCollectionViewsOpen || this.savedCollectionViews.length === 0) return;
    const index = clamp(this.savedCollectionViewIndex, 0, this.savedCollectionViews.length - 1);
    const next = this.savedCollectionViews.filter((_, candidate) => candidate !== index);
    if (!this.persistSavedCollectionViews(next)) {
      this.savedCollectionViewStatus = 'failed';
      playUiSound('locked');
      this.renderAll();
      return;
    }
    this.savedCollectionViews = next;
    this.savedCollectionViewIndex = clamp(index, 0, Math.max(0, next.length - 1));
    this.savedCollectionViewStatus = 'deleted';
    playUiSound('close');
    this.renderAll();
  }

  private applySelectedCollectionView(index = this.savedCollectionViewIndex) {
    if (!this.savedCollectionViewsOpen) return;
    if (this.savedCollectionViews.length === 0) {
      this.saveCurrentCollectionView();
      return;
    }
    const next = this.savedCollectionViews[clamp(index, 0, this.savedCollectionViews.length - 1)];
    if (!next) return;
    const tabIndex = CODEX_SAVED_VIEW_TABS.findIndex((tab) => tab.id === next.tab);
    this.activeTab = tabIndex >= 0 ? tabIndex : 0;
    this.cardCollectionLens = next.lens;
    this.cardSearchQuery = this.sanitizeCardSearchQuery(next.query, true);
    this.cardSortMode = next.sort;
    safeStorageSet(CARD_COLLECTION_LENS_KEY, this.cardCollectionLens);
    safeStorageSet(CARD_SEARCH_KEY, this.cardSearchQuery);
    safeStorageSet(CARD_SORT_KEY, this.cardSortMode);
    this.detailId = undefined;
    this.entryFocusIndex = 0;
    this.resetCodexScroll();
    this.savedCollectionViewsOpen = false;
    this.savedCollectionViewStatus = 'applied';
    this.focusZone = 'entries';
    playUiSound('confirm');
    this.renderAll();
  }

  private activeCardCollectionLens() {
    return this.cardCollectionLenses.find((lens) => lens.id === this.cardCollectionLens)
      ?? this.cardCollectionLenses[0];
  }

  private activeCardSortMode() {
    return this.cardSortModes.find((mode) => mode.id === this.cardSortMode)
      ?? this.cardSortModes[0];
  }

  private compareDiscoveredCardNames(a: Card, b: Card) {
    const aDiscovered = this.discovered.has(a.id);
    const bDiscovered = this.discovered.has(b.id);
    if (aDiscovered !== bDiscovered) return aDiscovered ? -1 : 1;
    if (!aDiscovered) return a.id.localeCompare(b.id);
    return displayName(a).localeCompare(displayName(b)) || a.id.localeCompare(b.id);
  }

  private sortCodexCards(cards: Card[]) {
    const rarityOrder: Record<string, number> = {
      legendary: 0,
      rare: 1,
      uncommon: 2,
      common: 3,
    };
    return [...cards].sort((a, b) => {
      if (this.cardSortMode === 'binder') return a.id.localeCompare(b.id);
      if (this.cardSortMode === 'name') return this.compareDiscoveredCardNames(a, b);
      if (this.cardSortMode === 'rarity') {
        const aDiscovered = this.discovered.has(a.id);
        const bDiscovered = this.discovered.has(b.id);
        if (aDiscovered !== bDiscovered) return aDiscovered ? -1 : 1;
        if (!aDiscovered) return a.id.localeCompare(b.id);
        return (
          (rarityOrder[a.runtime.rarity] ?? 9) - (rarityOrder[b.runtime.rarity] ?? 9)
          || this.compareDiscoveredCardNames(a, b)
        );
      }
      const aCollection = this.cardCollection[a.id];
      const bCollection = this.cardCollection[b.id];
      if (Boolean(aCollection) !== Boolean(bCollection)) return aCollection ? -1 : 1;
      if (aCollection && bCollection) {
        return (
          bCollection.firstAcquiredAt - aCollection.firstAcquiredAt
          || this.compareDiscoveredCardNames(a, b)
        );
      }
      return this.compareDiscoveredCardNames(a, b);
    });
  }

  private currentCardTabCards(): Card[] {
    const tab = this.tabs[this.activeTab];
    return this.sortCodexCards(this.allCards().filter(tab?.match ?? (() => true)));
  }

  private sanitizeCardSearchQuery(value: string, trim: boolean) {
    const clean = value
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, CARD_SEARCH_MAX_LENGTH);
    return trim ? clean.trim() : clean.replace(/^\s+/, '');
  }

  private normalizeCardSearchText(value: string) {
    return normalizeCodexSearchText(value);
  }

  private cardSearchText(card: Card) {
    const discovered = this.discovered.has(card.id);
    const ownership = this.cardCollection[card.id]
      ? 'collected owned permanent'
      : discovered
        ? 'seen discovered uncollected unowned'
        : 'unfound undiscovered unowned';
    const family = [
      card.runtime.suit,
      card.runtime.kind,
      this.tabs.find((tab) => tab.match(card))?.label,
      ownership,
    ];
    if (!discovered) return this.normalizeCardSearchText(family.filter(Boolean).join(' '));
    return this.normalizeCardSearchText([
      ...family,
      displayName(card),
      card.name,
      card.bird,
      card.type,
      card.role,
      card.target,
      card.runtime.target,
      card.runtime.rarity,
      this.cardTags[card.id],
      this.cardJournal[card.id],
      this.cardShowcase.includes(card.id) ? 'showcase presented flock record' : '',
      this.lockedCards.has(card.id) ? 'protected locked card lock safety' : '',
      this.cardFolioUsage[card.id]
        ? `folio folios saved deck deck used ${this.cardFolioUsage[card.id].active ? 'active' : ''} ${this.cardFolioUsage[card.id].archived ? 'archive archived' : ''}`
        : '',
      this.activeFlightCardUsage?.cards[card.id]
        ? `active flight current deck playable copy ${this.activeFlightCardUsage.cards[card.id]}`
        : this.activeFlightCardUsage
          ? 'outside current flight deck zero playable copies'
          : '',
      `cost ${card.cost}`,
      `${card.cost} cost`,
      card.text,
      card.upgradedText,
      card.heldText,
      card.moltText,
      card.moltTextUpgraded,
      ...card.runtime.tags,
      ...card.runtime.effects,
      ...(card.runtime.moltEffects ?? []),
      ...(card.runtime.heldEffects ?? []),
      ...card.runtime.upgrade.effects,
    ].filter(Boolean).join(' '));
  }

  private cardMatchesSearch(card: Card) {
    return this.cardSearchMatch(card).matches;
  }

  private cardSearchMatch(card: Card) {
    return matchCodexSearchText(this.cardSearchQuery, this.cardSearchText(card));
  }

  private currentCardSearchMatches() {
    return this.currentCardTabCards().filter((card) => this.cardMatchesSearch(card));
  }

  private currentCodexCards(): Card[] {
    const lens = this.activeCardCollectionLens();
    return this.currentCardSearchMatches().filter(lens.match);
  }

  private activeCardFilterChips(): ActiveCardFilterChip[] {
    if (this.activeSection !== 'cards') return [];
    const definitions: Array<Omit<ActiveCardFilterChip, 'x' | 'width'>> = [];
    const query = this.sanitizeCardSearchQuery(this.cardSearchQuery, true);
    if (query) definitions.push({ id: 'search', label: 'Search', value: query });
    if (this.cardCollectionLens !== 'all') {
      definitions.push({
        id: 'lens',
        label: 'Lens',
        value: this.activeCardCollectionLens().label,
      });
    }
    if (definitions.length === 0) return [];
    definitions.push({
      id: 'clear',
      label: 'Clear all',
      value: `${definitions.length} active`,
    });
    let cursor = 52;
    return definitions.map((definition) => {
      const width = definition.id === 'clear'
        ? 142
        : clamp(92 + definition.value.length * 7, 148, definition.id === 'search' ? 340 : 210);
      const chip = {
        ...definition,
        x: cursor + width / 2,
        width,
      };
      cursor += width + 10;
      return chip;
    });
  }

  private clearAllActiveCardFilters() {
    if (this.activeSection !== 'cards') return;
    const hadFilters = this.activeCardFilterChips().length > 0;
    this.cardSearchQuery = '';
    this.cardCollectionLens = 'all';
    this.activeCardFilterIndex = 0;
    this.entryFocusIndex = 0;
    this.resetCodexScroll();
    safeStorageSet(CARD_SEARCH_KEY, '');
    safeStorageSet(CARD_COLLECTION_LENS_KEY, 'all');
    this.focusZone = 'search';
    playUiSound(hadFilters ? 'close' : 'locked');
    this.renderAll();
  }

  private clearActiveCardFilter(index = this.activeCardFilterIndex) {
    const chips = this.activeCardFilterChips();
    const chip = chips[clamp(index, 0, Math.max(0, chips.length - 1))];
    if (!chip) return;
    if (chip.id === 'clear') {
      this.clearAllActiveCardFilters();
      return;
    }
    if (chip.id === 'search') {
      this.cardSearchQuery = '';
      safeStorageSet(CARD_SEARCH_KEY, '');
    } else {
      this.cardCollectionLens = 'all';
      safeStorageSet(CARD_COLLECTION_LENS_KEY, 'all');
    }
    this.entryFocusIndex = 0;
    this.resetCodexScroll();
    const next = this.activeCardFilterChips();
    this.activeCardFilterIndex = clamp(index, 0, Math.max(0, next.length - 1));
    this.focusZone = next.length > 0 ? 'activeFilters' : 'search';
    playUiSound('close');
    this.renderAll();
  }

  private setCardSortMode(index: number, persist = true) {
    const next = this.cardSortModes[
      (index + this.cardSortModes.length) % this.cardSortModes.length
    ];
    if (!next) return;
    this.cardSortMode = next.id;
    this.detailId = undefined;
    this.entryFocusIndex = 0;
    this.resetCodexScroll();
    if (persist) safeStorageSet(CARD_SORT_KEY, next.id);
  }

  private cycleCardSortMode(direction: -1 | 1) {
    const current = Math.max(
      0,
      this.cardSortModes.findIndex((mode) => mode.id === this.cardSortMode),
    );
    playUiSound('confirm');
    this.focusZone = 'sort';
    this.setCardSortMode(current + direction);
    this.renderAll();
  }

  private positionCardSearchInput = () => {
    const input = this.cardSearchInput;
    const canvas = this.game?.canvas;
    if (!input || !canvas?.isConnected) return;
    const gameContainer = document.getElementById('game-container');
    if (gameContainer && window.getComputedStyle(gameContainer).display === 'none') {
      this.finishCardSearch(true);
      return;
    }
    const bounds = canvas.getBoundingClientRect();
    const scaleX = bounds.width / GAME_WIDTH;
    const scaleY = bounds.height / GAME_HEIGHT;
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const width = Math.min(Math.max(CARD_SEARCH_WIDTH * scaleX, 190), Math.max(120, viewportWidth - 16));
    const height = Math.min(Math.max(CARD_SEARCH_HEIGHT * scaleY, MIN_SUPPORTED_TOUCH_TARGET), 56);
    const centerX = bounds.left + CARD_SEARCH_X * scaleX;
    const centerY = bounds.top + CARD_SEARCH_Y * scaleY;
    const minLeft = viewportLeft + 8;
    const maxLeft = Math.max(minLeft, viewportRight - width - 8);
    input.style.left = `${clamp(centerX - width / 2, minLeft, maxLeft)}px`;
    input.style.top = `${clamp(
      centerY - height / 2,
      viewportTop + 8,
      Math.max(viewportTop + 8, viewportBottom - height - 8),
    )}px`;
    input.style.width = `${width}px`;
    input.style.height = `${height}px`;
    input.style.fontSize = `${clamp(13 * Math.min(scaleX, scaleY), 13, 18)}px`;
  };

  private openCardSearch() {
    if (this.activeSection !== 'cards' || this.detailId || this.cardSearchInput) return;
    this.focusZone = 'search';
    this.cardSearchBeforeEdit = this.cardSearchQuery;
    this.cardSearchEditing = true;
    playUiSound('confirm');
    this.renderAll();

    const input = document.createElement('input');
    input.id = 'codex-card-search-input';
    input.type = 'search';
    input.value = this.cardSearchQuery;
    input.maxLength = CARD_SEARCH_MAX_LENGTH;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.enterKeyHint = 'search';
    input.setAttribute('aria-label', 'Find cards by name, rules, keyword, character, set, type, cost, rarity, ownership, personal tag, private journal, or showcase');
    input.setAttribute('aria-keyshortcuts', '/');
    Object.assign(input.style, {
      position: 'fixed',
      zIndex: '2147483000',
      boxSizing: 'border-box',
      margin: '0',
      padding: '0 11px',
      border: '2px solid #8df4ff',
      borderRadius: '5px',
      outline: 'none',
      background: 'rgba(8, 20, 32, 0.99)',
      color: '#e7f8ff',
      caretColor: '#f5d38a',
      boxShadow: '0 0 0 2px rgba(5, 7, 12, 0.9), 0 0 16px rgba(141, 244, 255, 0.34)',
      fontFamily: UI_FONT,
      fontWeight: '700',
      letterSpacing: '0.02em',
      appearance: 'none',
    });
    this.cardSearchInput = input;
    input.addEventListener('input', () => {
      if (this.cardSearchInput !== input) return;
      this.cardSearchQuery = this.sanitizeCardSearchQuery(input.value, false);
      if (input.value !== this.cardSearchQuery) input.value = this.cardSearchQuery;
      this.entryFocusIndex = 0;
      this.resetCodexScroll();
      safeStorageSet(CARD_SEARCH_KEY, this.sanitizeCardSearchQuery(this.cardSearchQuery, true));
      this.renderAll();
      this.positionCardSearchInput();
    });
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        this.finishCardSearch(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.finishCardSearch(false);
      }
    });
    input.addEventListener('blur', () => {
      if (this.cardSearchInput === input) this.finishCardSearch(true);
    });
    document.body.append(input);
    window.addEventListener('resize', this.positionCardSearchInput);
    window.addEventListener('scroll', this.positionCardSearchInput, true);
    window.visualViewport?.addEventListener('resize', this.positionCardSearchInput);
    window.visualViewport?.addEventListener('scroll', this.positionCardSearchInput);
    this.positionCardSearchInput();
    window.requestAnimationFrame(() => {
      if (this.cardSearchInput !== input) return;
      input.focus({ preventScroll: true });
      input.select();
    });
  }

  private scheduleCardSearchOpen() {
    this.focusZone = 'search';
    window.setTimeout(() => {
      if (this.sys.settings.active && this.activeSection === 'cards' && !this.detailId) {
        this.openCardSearch();
      }
    }, 0);
  }

  private finishCardSearch(commit: boolean, rerender = true) {
    const input = this.cardSearchInput;
    if (!input) return;
    const next = commit
      ? this.sanitizeCardSearchQuery(input.value, true)
      : this.cardSearchBeforeEdit;
    this.cardSearchInput = undefined;
    this.cardSearchEditing = false;
    window.removeEventListener('resize', this.positionCardSearchInput);
    window.removeEventListener('scroll', this.positionCardSearchInput, true);
    window.visualViewport?.removeEventListener('resize', this.positionCardSearchInput);
    window.visualViewport?.removeEventListener('scroll', this.positionCardSearchInput);
    input.remove();
    this.cardSearchQuery = next;
    this.entryFocusIndex = 0;
    this.resetCodexScroll();
    safeStorageSet(CARD_SEARCH_KEY, next);
    if (rerender && this.sys.settings.active && this.root?.active) this.renderAll();
  }

  private nativeTextInputActive() {
    return this.cardSearchEditing || Boolean(this.cardJournalInput);
  }

  private openCardJournal() {
    const id = this.activeSection === 'cards' ? this.detailId : undefined;
    if (!id || !this.discovered.has(id) || this.cardJournalInput) {
      playUiSound('locked');
      return;
    }
    const input = document.createElement('textarea');
    input.id = 'codex-card-journal-input';
    input.value = this.cardJournal[id] ?? '';
    input.maxLength = CARD_JOURNAL_NOTE_LIMIT;
    input.rows = 5;
    input.setAttribute('aria-label', `Private Card Journal note for ${displayName(cardLibrary[id])}`);
    input.setAttribute('aria-keyshortcuts', 'J');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'true');
    Object.assign(input.style, {
      position: 'fixed',
      left: '50%',
      top: '52%',
      width: 'min(620px, calc(100vw - 48px))',
      minHeight: '144px',
      transform: 'translate(-50%, -50%)',
      zIndex: '2147483000',
      boxSizing: 'border-box',
      padding: '14px 18px',
      border: '2px solid #c9a6ff',
      borderRadius: '5px',
      outline: '4px solid rgba(5, 7, 12, 0.94)',
      background: '#101323',
      color: '#f0e7ff',
      caretColor: '#ffe1a3',
      font: 'bold 16px Arial',
      lineHeight: '1.45',
      resize: 'none',
      boxShadow: '0 0 24px rgba(201, 166, 255, 0.28)',
    });
    this.cardJournalInput = input;
    this.cardJournalEditingId = id;
    this.cardJournalStatus = 'idle';
    document.body.append(input);
    playUiSound('confirm');
    this.renderAll();

    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.finishCardJournal(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.finishCardJournal(false);
      }
    });
    input.addEventListener('blur', () => {
      if (this.cardJournalInput === input) this.finishCardJournal(true);
    });
    window.requestAnimationFrame(() => {
      if (this.cardJournalInput !== input) return;
      input.focus({ preventScroll: true });
      input.select();
    });
  }

  private finishCardJournal(commit: boolean, rerender = true) {
    const input = this.cardJournalInput;
    const id = this.cardJournalEditingId;
    if (!input || !id) return;
    this.cardJournalInput = undefined;
    this.cardJournalEditingId = undefined;
    input.remove();
    if (commit) {
      const account = loadAccount();
      account.cardJournal = sanitizeCardJournalNotes(account.cardJournal, account.discoveredCards);
      const note = sanitizeCardJournalNote(input.value);
      if (note) account.cardJournal[id] = note;
      else delete account.cardJournal[id];
      if (saveAccount(account)) {
        this.cardJournal = account.cardJournal;
        this.cardJournalStatus = 'saved';
        playUiSound('confirm');
      } else {
        this.cardJournalStatus = 'failed';
        playUiSound('locked');
      }
    } else {
      this.cardJournalStatus = 'idle';
      playUiSound('close');
    }
    if (rerender && this.sys.settings.active && this.root?.active) this.renderAll();
  }

  private setCardCollectionLens(index: number, persist = true) {
    const next = this.cardCollectionLenses[
      (index + this.cardCollectionLenses.length) % this.cardCollectionLenses.length
    ];
    if (!next) return;
    this.cardCollectionLens = next.id;
    this.detailId = undefined;
    this.entryFocusIndex = 0;
    this.resetCodexScroll();
    if (persist) safeStorageSet(CARD_COLLECTION_LENS_KEY, next.id);
  }

  private cycleCardCollectionLens(direction: -1 | 1) {
    const current = Math.max(
      0,
      this.cardCollectionLenses.findIndex((lens) => lens.id === this.cardCollectionLens),
    );
    playUiSound('confirm');
    this.focusZone = 'secondaryTabs';
    this.setCardCollectionLens(current + direction);
    this.renderAll();
  }

  private allReserveEnemies(): CodexEnemyEntry[] {
    return (this.codexData?.reserveEnemyContracts ?? [])
      .filter((enemy) => !alphaEnemyLibrary.has(enemy.id))
      .map((enemy) => this.reserveEnemyEntry(enemy));
  }

  private allEncounterEnemies(): CodexEnemyEntry[] {
    return [...alphaEnemyLibrary.values()].map((enemy) => this.runtimeEnemyEntry(enemy));
  }

  private allCodexEnemies(): CodexEnemyEntry[] {
    const entries = this.allEncounterEnemies();
    const seen = new Set(entries.map((enemy) => enemy.id));
    this.allReserveEnemies().forEach((enemy) => {
      if (!seen.has(enemy.id)) entries.push(enemy);
    });
    return entries;
  }

  private allLeaders() {
    return [...flockLeaders];
  }

  private currentCodexEnemies(): CodexEnemyEntry[] {
    const sourceOrder: Record<CodexEnemySource, number> = { encounter: 0, reserve: 1 };
    return this.allCodexEnemies()
      .filter(this.enemyTabs[this.activeEnemyTab].match)
      .sort((a, b) => (
        a.district.localeCompare(b.district)
        || sourceOrder[a.source] - sourceOrder[b.source]
        || a.name.localeCompare(b.name)
      ));
  }

  private reserveEnemyEntry(enemy: ReserveEnemyContract): CodexEnemyEntry {
    return {
      ...enemy,
      moveKit: enemy.moveKit.map((text) => ({ text })),
      source: 'reserve',
    };
  }

  private runtimeEnemyEntry(enemy: RuntimeEnemy): CodexEnemyEntry {
    const typeLabel = this.runtimeEnemyTypeLabel(enemy);
    return {
      id: enemy.id,
      name: enemy.name,
      species: 'Encounter cast',
      district: this.runtimeEnemyDistrict(enemy.id),
      role: `${typeLabel} / ${enemy.health} HP`,
      typeHint: typeLabel,
      varietyContribution: enemy.lesson ?? `${typeLabel} enemy from the playable encounter roster.`,
      description: enemy.description,
      visualBrief: enemy.visualBrief,
      silhouette: enemy.silhouette,
      artPose: enemy.artPose,
      moveKit: enemy.moves.map((move) => ({ id: move.id, text: `${move.label}: ${compactEffectSummary(move.effects, 132, 3)}` })),
      source: 'encounter',
      health: enemy.health,
    };
  }

  private runtimeEnemyDistrict(enemyId: string) {
    if (enemyId.startsWith('canal_')) return 'Canal Markets';
    if (enemyId.startsWith('spire_')) return 'Signal Spires';
    if (enemyId.startsWith('roost_')) return 'High Roost';
    return 'Rooftop Blocks';
  }

  private runtimeEnemyTypeLabel(enemy: RuntimeEnemy) {
    switch (enemy.type) {
      case 'boss': return 'Boss';
      case 'elite': return 'Elite';
      case 'rival': return 'Rival';
      default: return 'Encounter';
    }
  }

  private allWaymarks(): RuntimeRouteMark[] {
    return [...alphaRouteMarkSet.routeMarks];
  }

  private allSupplies(): RuntimeSupply[] {
    return [...alphaSupplyLibrary.values()];
  }

  private allCodexItems(): CodexItemEntry[] {
    return [
      ...this.allWaymarks().map((mark) => ({ kind: 'waymark' as const, id: mark.id, mark })),
      ...this.allSupplies().map((supply) => ({ kind: 'supply' as const, id: supply.id, supply })),
    ];
  }

  private currentGridTop() {
    if (this.activeSection === 'items') return CodexScene.ITEM_GRID_TOP;
    if (this.activeSection === 'cards' && this.activeCardFilterChips().length > 0) {
      return CARD_FILTER_GRID_TOP;
    }
    return CodexScene.GRID_TOP;
  }

  private activeItemTypeDef() {
    return this.itemTypeTabs[this.activeItemTypeTab] ?? this.itemTypeTabs[0];
  }

  private currentItemFilterTabs(): CodexItemTab[] {
    const type = this.itemTypeTabs[this.activeItemTypeTab]?.label;
    if (type === 'Waymarks') return this.waymarkFilterTabs;
    if (type === 'Supplies') return this.supplyFilterTabs;
    return [];
  }

  private activeItemFilterDef() {
    const tabs = this.currentItemFilterTabs();
    return tabs[this.activeItemFilterTab] ?? tabs[0];
  }

  private normalizeItemTabs() {
    this.activeItemTypeTab = clamp(this.activeItemTypeTab, 0, this.itemTypeTabs.length - 1);
    const filters = this.currentItemFilterTabs();
    this.activeItemFilterTab = filters.length > 0 ? clamp(this.activeItemFilterTab, 0, filters.length - 1) : 0;
  }

  private currentCodexItems(): CodexItemEntry[] {
    const rarityOrder: Record<string, number> = { common: 0, uncommon: 1, rare: 2, boss: 3 };
    const kindOrder: Record<CodexItemEntry['kind'], number> = { supply: 0, waymark: 1 };
    const itemName = (item: CodexItemEntry) => item.kind === 'waymark' ? item.mark.name : item.supply.name;
    const itemRarity = (item: CodexItemEntry) => item.kind === 'waymark' ? item.mark.rarity : item.supply.rarity;
    const itemType = this.activeItemTypeDef();
    const itemFilter = this.activeItemFilterDef();
    return this.allCodexItems()
      .filter((item) => itemType.match(item) && (!itemFilter || itemFilter.match(item)))
      .sort((a, b) => (
        kindOrder[a.kind] - kindOrder[b.kind]
        || (rarityOrder[itemRarity(a)] ?? 9) - (rarityOrder[itemRarity(b)] ?? 9)
        || itemName(a).localeCompare(itemName(b))
      ));
  }

  private codexFocusEntries(): CodexFocusEntry[] {
    if (this.activeSection === 'cards') {
      const family = this.tabs[this.activeTab]?.label ?? 'Card';
      return this.currentCodexCards()
        .map((card, index) => ({
          id: card.id,
          label: this.discovered.has(card.id) ? displayName(card) : `Undiscovered ${family} card ${index + 1}`,
          canOpen: this.discovered.has(card.id),
        }));
    }
    if (this.activeSection === 'items') {
      return this.currentCodexItems().map((item) => ({
        id: item.id,
        label: item.kind === 'waymark' ? item.mark.name : item.supply.name,
        canOpen: true,
      }));
    }
    if (this.activeSection === 'leaders') {
      return this.allLeaders().map((leader) => ({ id: leader.id, label: leader.name, canOpen: true }));
    }
    if (this.activeSection === 'enemies') {
      return this.currentCodexEnemies().map((enemy) => ({ id: enemy.id, label: enemy.name, canOpen: true }));
    }
    return this.glossaryTerms.map((term) => ({ id: term.term, label: `${term.term}. ${term.summary}`, canOpen: false }));
  }

  private codexFocusZones(): CodexFocusZone[] {
    if (this.savedCollectionViewsOpen) return ['savedViewsOverlay'];
    if (this.collectionAtlasOpen) return ['progressOverlay'];
    if (this.detailId) return ['detail'];
    const zones: CodexFocusZone[] = ['sections'];
    if (this.activeSection === 'cards') zones.push('search', 'sort', 'savedViews');
    if (this.activeSection === 'cards' || this.activeSection === 'items' || this.activeSection === 'enemies') {
      zones.push('primaryTabs');
    }
    if (
      this.activeSection === 'cards'
      || (this.activeSection === 'items' && this.currentItemFilterTabs().length > 0)
    ) zones.push('secondaryTabs');
    if (this.activeSection === 'cards' && this.activeCardFilterChips().length > 0) zones.push('activeFilters');
    if (this.activeSection === 'cards' && this.newlyAcquiredCards.size > 0) zones.push('newCards');
    if (this.codexFocusEntries().length > 0) zones.push('entries');
    if (this.activeSection === 'cards') zones.push('progress');
    zones.push('back');
    return zones;
  }

  private normalizeCodexFocus() {
    if (this.activeSection === 'items') this.normalizeItemTabs();
    if (this.savedCollectionViewsOpen) {
      this.savedCollectionViewIndex = clamp(
        Math.round(this.savedCollectionViewIndex),
        0,
        Math.max(0, this.savedCollectionViews.length - 1),
      );
      this.focusZone = 'savedViewsOverlay';
      return;
    }
    if (this.collectionAtlasOpen) {
      this.collectionAtlasFamilyIndex = clamp(
        Math.round(this.collectionAtlasFamilyIndex),
        0,
        this.collectionAtlasSnapshot().families.length - 1,
      );
      this.focusZone = 'progressOverlay';
      return;
    }
    if (this.detailId) {
      this.focusZone = 'detail';
      return;
    }
    if (this.focusZone === 'detail') this.focusZone = 'entries';
    const zones = this.codexFocusZones();
    if (!zones.includes(this.focusZone)) this.focusZone = zones[0];
    const entries = this.codexFocusEntries();
    this.entryFocusIndex = entries.length > 0
      ? clamp(Math.round(this.entryFocusIndex), 0, entries.length - 1)
      : 0;
    const activeFilters = this.activeCardFilterChips();
    this.activeCardFilterIndex = activeFilters.length > 0
      ? clamp(Math.round(this.activeCardFilterIndex), 0, activeFilters.length - 1)
      : 0;
  }

  private primaryTabLabels(): string[] {
    if (this.activeSection === 'cards') return this.tabs.map((tab) => tab.label);
    if (this.activeSection === 'items') return this.itemTypeTabs.map((tab) => tab.label);
    if (this.activeSection === 'enemies') return this.enemyTabs.map((tab) => tab.label);
    return [];
  }

  private activePrimaryTabIndex(): number {
    if (this.activeSection === 'cards') return this.activeTab;
    if (this.activeSection === 'items') return this.activeItemTypeTab;
    if (this.activeSection === 'enemies') return this.activeEnemyTab;
    return 0;
  }

  private detailFocusLabel() {
    if (!this.detailId) return 'Detail';
    const entry = this.codexFocusEntries().find((candidate) => candidate.id === this.detailId);
    if (entry) return `Close ${entry.label} detail`;
    if (cardLibrary[this.detailId]) return `Close ${displayName(cardLibrary[this.detailId])} detail`;
    if (alphaRouteMarkLibrary.has(this.detailId)) return `Close ${alphaRouteMarkLibrary.get(this.detailId)?.name ?? 'Waymark'} detail`;
    if (alphaSupplyLibrary.has(this.detailId)) return `Close ${alphaSupplyLibrary.get(this.detailId)?.name ?? 'Supply'} detail`;
    const leader = flockLeaders.find((candidate) => candidate.id === this.detailId);
    if (leader) return `Close ${leader.name} detail`;
    const enemy = this.allCodexEnemies().find((candidate) => candidate.id === this.detailId);
    return `Close ${enemy?.name ?? 'Codex'} detail`;
  }

  private codexFocusState() {
    this.normalizeCodexFocus();
    const entries = this.codexFocusEntries();
    const sectionIndex = Math.max(0, this.sections.findIndex((section) => section.id === this.activeSection));
    const primaryLabels = this.primaryTabLabels();
    const secondaryLabels = this.activeSection === 'cards'
      ? this.cardCollectionLenses.map((lens) => lens.label)
      : this.currentItemFilterTabs().map((tab) => tab.label);
    let index = 0;
    let count = 1;
    let label = 'Codex';
    if (this.focusZone === 'sections') {
      index = sectionIndex;
      count = this.sections.length;
      label = `${this.sections[index]?.label ?? 'Cards'} section`;
    } else if (this.focusZone === 'search') {
      label = this.cardSearchQuery
        ? `Find cards, current query ${this.cardSearchQuery}`
        : 'Find cards';
    } else if (this.focusZone === 'sort') {
      label = `Sort cards, ${this.activeCardSortMode().label}`;
    } else if (this.focusZone === 'savedViews') {
      label = `Open saved collection views, ${this.savedCollectionViews.length} of ${CODEX_SAVED_VIEW_LIMIT} saved`;
    } else if (this.focusZone === 'savedViewsOverlay') {
      index = this.savedCollectionViewIndex;
      count = this.savedCollectionViews.length;
      label = this.savedCollectionViews[index]?.name
        ?? 'No saved views; save the current collection view';
    } else if (this.focusZone === 'primaryTabs') {
      index = this.activePrimaryTabIndex();
      count = primaryLabels.length;
      label = `${primaryLabels[index] ?? 'All'} filter`;
    } else if (this.focusZone === 'secondaryTabs') {
      index = this.activeSection === 'cards'
        ? Math.max(0, this.cardCollectionLenses.findIndex((lens) => lens.id === this.cardCollectionLens))
        : this.activeItemFilterTab;
      count = secondaryLabels.length;
      label = `${secondaryLabels[index] ?? 'All'} filter`;
    } else if (this.focusZone === 'activeFilters') {
      const filters = this.activeCardFilterChips();
      index = this.activeCardFilterIndex;
      count = filters.length;
      const filter = filters[index];
      label = filter?.id === 'clear'
        ? `Clear all active card filters, ${filter.value}`
        : `Remove ${filter?.label ?? 'card'} filter, ${filter?.value ?? ''}`;
    } else if (this.focusZone === 'newCards') {
      label = `Clear all ${this.newlyAcquiredCards.size} new card marker${this.newlyAcquiredCards.size === 1 ? '' : 's'}`;
    } else if (this.focusZone === 'progress') {
      const progress = this.activeCollectionProgress();
      label = `Open Collection Atlas, ${progress.name}, ${progress.owned} of ${progress.total} collected`;
    } else if (this.focusZone === 'progressOverlay') {
      const atlas = this.collectionAtlasSnapshot();
      index = atlas.selectedIndex;
      count = atlas.families.length;
      label = `${atlas.selectedFamily?.name ?? 'Collection'} collection, ${atlas.selectedFamily?.owned ?? 0} of ${atlas.selectedFamily?.total ?? 0} collected`;
    } else if (this.focusZone === 'entries') {
      index = this.entryFocusIndex;
      count = entries.length;
      label = entries[index]?.label ?? 'Codex entry';
    } else if (this.focusZone === 'back') {
      label = this.returnScene === 'RouteScene' ? 'Back to route' : 'Back to title';
    } else {
      label = this.detailFocusLabel();
    }
    return {
      zone: this.focusZone,
      index,
      count,
      label,
      previous: controlBindingLabel('previous'),
      next: controlBindingLabel('next'),
      confirm: controlBindingLabel('confirm'),
      back: controlBindingLabel('back'),
      ringRendered: Boolean(this.focusRing?.active),
      gridScroll: Math.round(this.gridScroll),
      gridMaxScroll: Math.round(this.gridMaxScroll),
      detailScroll: Math.round(this.detailScroll),
      detailMaxScroll: Math.round(this.detailMaxScroll),
    };
  }

  private codexGridShape() {
    const cardMode = this.activeSection === 'cards';
    const itemMode = this.activeSection === 'items';
    const leaderMode = this.activeSection === 'leaders';
    const glossaryMode = this.activeSection === 'glossary';
    return {
      top: this.currentGridTop(),
      bottom: CodexScene.GRID_BOTTOM,
      cols: cardMode ? 5 : leaderMode ? 3 : glossaryMode ? 2 : 4,
      cellW: cardMode ? 202 : itemMode ? 360 : leaderMode ? 360 : glossaryMode ? 580 : 274,
      cellH: cardMode ? 286 : itemMode ? 148 : leaderMode ? 238 : glossaryMode ? 94 : 228,
    };
  }

  private entryFocusGeometry(): CodexFocusGeometry | undefined {
    const entries = this.codexFocusEntries();
    if (entries.length === 0) return undefined;
    const shape = this.codexGridShape();
    const index = clamp(this.entryFocusIndex, 0, entries.length - 1);
    const gridLeft = (GAME_WIDTH - shape.cols * shape.cellW) / 2;
    const cardMode = this.activeSection === 'cards';
    const itemMode = this.activeSection === 'items';
    const leaderMode = this.activeSection === 'leaders';
    const glossaryMode = this.activeSection === 'glossary';
    return {
      x: gridLeft + (index % shape.cols) * shape.cellW + shape.cellW / 2,
      y: shape.top + Math.floor(index / shape.cols) * shape.cellH + shape.cellH / 2 - this.gridScroll,
      width: cardMode ? 198 : itemMode ? 342 : leaderMode ? 338 : glossaryMode ? shape.cellW - 16 : 258,
      height: cardMode ? 290 : itemMode ? 134 : leaderMode ? 220 : glossaryMode ? shape.cellH - 10 : 212,
    };
  }

  private ensureFocusedEntryVisible() {
    const entries = this.codexFocusEntries();
    if (entries.length === 0) return;
    const shape = this.codexGridShape();
    const row = Math.floor(clamp(this.entryFocusIndex, 0, entries.length - 1) / shape.cols);
    const rowTop = shape.top + row * shape.cellH;
    const rowBottom = rowTop + shape.cellH;
    const rows = Math.ceil(entries.length / shape.cols);
    const maxScroll = Math.max(0, rows * shape.cellH - (shape.bottom - shape.top) + 12);
    let next = this.gridScroll;
    if (rowTop - next < shape.top + 6) next = rowTop - shape.top;
    if (rowBottom - next > shape.bottom - 6) next = rowBottom - shape.bottom + 6;
    next = clamp(next, 0, maxScroll);
    this.gridScroll = next;
    this.gridScrollTarget = next;
  }

  private setActiveSection(index: number) {
    const next = this.sections[(index + this.sections.length) % this.sections.length];
    if (!next) return;
    this.activeSection = next.id;
    this.savedCollectionViewsOpen = false;
    this.collectionAtlasOpen = false;
    this.detailId = undefined;
    this.entryFocusIndex = 0;
    this.resetCodexScroll();
  }

  private setActivePrimaryTab(index: number) {
    const labels = this.primaryTabLabels();
    if (labels.length === 0) return;
    const next = (index + labels.length) % labels.length;
    if (this.activeSection === 'cards') this.activeTab = next;
    else if (this.activeSection === 'items') {
      this.activeItemTypeTab = next;
      this.activeItemFilterTab = 0;
    } else if (this.activeSection === 'enemies') this.activeEnemyTab = next;
    this.detailId = undefined;
    this.entryFocusIndex = 0;
    this.resetCodexScroll();
  }

  private setActiveSecondaryTab(index: number) {
    if (this.activeSection === 'cards') {
      this.setCardCollectionLens(index);
      return;
    }
    const tabs = this.currentItemFilterTabs();
    if (tabs.length === 0) return;
    this.activeItemFilterTab = (index + tabs.length) % tabs.length;
    this.detailId = undefined;
    this.entryFocusIndex = 0;
    this.resetCodexScroll();
  }

  private cycleCodexFocusZone(direction: -1 | 1, sound = true) {
    this.normalizeCodexFocus();
    const zones = this.codexFocusZones();
    if (zones.length <= 1) return;
    const current = Math.max(0, zones.indexOf(this.focusZone));
    this.focusZone = zones[(current + direction + zones.length) % zones.length];
    if (this.focusZone === 'entries') this.ensureFocusedEntryVisible();
    if (sound) playUiSound('confirm');
    this.renderAll();
  }

  private moveCodexHorizontal(direction: -1 | 1) {
    this.normalizeCodexFocus();
    if (this.focusZone === 'savedViewsOverlay') {
      this.moveSavedCollectionViewSelection(direction);
      return;
    }
    if (this.focusZone === 'progressOverlay') {
      this.moveCollectionAtlasSelection(direction);
      return;
    }
    if (this.focusZone === 'detail') {
      this.scrollCodexDetail(direction);
      return;
    }
    playUiSound('confirm');
    if (this.focusZone === 'sections') {
      const current = Math.max(0, this.sections.findIndex((section) => section.id === this.activeSection));
      this.setActiveSection(current + direction);
    } else if (this.focusZone === 'primaryTabs') {
      this.setActivePrimaryTab(this.activePrimaryTabIndex() + direction);
    } else if (this.focusZone === 'secondaryTabs') {
      const current = this.activeSection === 'cards'
        ? Math.max(0, this.cardCollectionLenses.findIndex((lens) => lens.id === this.cardCollectionLens))
        : this.activeItemFilterTab;
      this.setActiveSecondaryTab(current + direction);
    } else if (this.focusZone === 'sort') {
      const current = Math.max(0, this.cardSortModes.findIndex((mode) => mode.id === this.cardSortMode));
      this.setCardSortMode(current + direction);
    } else if (this.focusZone === 'activeFilters') {
      const filters = this.activeCardFilterChips();
      if (filters.length > 0) {
        this.activeCardFilterIndex = (
          this.activeCardFilterIndex + direction + filters.length
        ) % filters.length;
      }
    } else if (this.focusZone === 'entries') {
      const entries = this.codexFocusEntries();
      if (entries.length > 0) this.entryFocusIndex = (this.entryFocusIndex + direction + entries.length) % entries.length;
      this.ensureFocusedEntryVisible();
    } else {
      this.cycleCodexFocusZone(direction, false);
      return;
    }
    this.renderAll();
  }

  private moveCodexVertical(direction: -1 | 1) {
    this.normalizeCodexFocus();
    if (this.focusZone === 'savedViewsOverlay') {
      this.moveSavedCollectionViewSelection(direction);
      return;
    }
    if (this.focusZone === 'progressOverlay') {
      this.moveCollectionAtlasSelection(direction);
      return;
    }
    if (this.focusZone === 'detail') {
      this.scrollCodexDetail(direction);
      return;
    }
    if (this.focusZone !== 'entries') {
      this.cycleCodexFocusZone(direction);
      return;
    }
    const entries = this.codexFocusEntries();
    const cols = this.codexGridShape().cols;
    const next = this.entryFocusIndex + direction * cols;
    if (next < 0 || next >= entries.length) {
      this.cycleCodexFocusZone(direction);
      return;
    }
    playUiSound('confirm');
    this.entryFocusIndex = next;
    this.ensureFocusedEntryVisible();
    this.renderAll();
  }

  private activateCodexFocus() {
    this.normalizeCodexFocus();
    if (this.focusZone === 'savedViewsOverlay') {
      this.applySelectedCollectionView();
      return;
    }
    if (this.focusZone === 'progressOverlay') {
      this.selectCollectionAtlasFamily();
      return;
    }
    if (this.focusZone === 'search') {
      this.openCardSearch();
      return;
    }
    if (this.focusZone === 'sort') {
      this.cycleCardSortMode(1);
      return;
    }
    if (this.focusZone === 'savedViews') {
      this.openSavedCollectionViews();
      return;
    }
    if (this.focusZone === 'activeFilters') {
      this.clearActiveCardFilter();
      return;
    }
    if (this.focusZone === 'newCards') {
      this.clearAllNewCards();
      return;
    }
    if (this.focusZone === 'progress') {
      this.openCollectionAtlas();
      return;
    }
    if (this.focusZone === 'detail') {
      this.closeCodexDetail(true);
      return;
    }
    if (this.focusZone === 'back') {
      playUiSound('close');
      this.returnToOrigin();
      return;
    }
    if (this.focusZone !== 'entries') {
      this.cycleCodexFocusZone(1);
      return;
    }
    const entry = this.codexFocusEntries()[this.entryFocusIndex];
    if (!entry?.canOpen) {
      playUiSound(this.activeSection === 'glossary' ? 'confirm' : 'locked');
      return;
    }
    this.openCodexDetail(entry.id, true);
  }

  private handleCodexBack() {
    if (this.cardJournalInput) {
      this.finishCardJournal(false);
      return;
    }
    if (this.cardSearchEditing) {
      this.finishCardSearch(false);
      return;
    }
    if (this.collectionAtlasOpen) {
      this.closeCollectionAtlas();
      return;
    }
    if (this.savedCollectionViewsOpen) {
      this.closeSavedCollectionViews();
      return;
    }
    if (this.detailId) {
      this.closeCodexDetail(true);
      return;
    }
    playUiSound('close');
    this.returnToOrigin();
  }

  private returnToOrigin() {
    this.scene.start(this.returnScene, this.returnData);
  }

  private scrollCodexDetail(direction: -1 | 1) {
    if (this.detailMaxScroll <= 0) return;
    this.detailScrollTarget = clamp(this.detailScrollTarget + direction * 180, 0, this.detailMaxScroll);
  }

  private ensureCodexData() {
    if (this.codexData) return Promise.resolve();
    if (!this.codexDataLoad) {
      this.codexDataFailed = false;
      const request = Promise.all([import('./codex-data'), loadBossDossierModule()])
        .then(([data, dossier]) => {
          this.codexData = data;
          this.codexBossDossierModule = dossier;
          this.codexDataFailed = false;
        })
        .catch((error) => {
          this.codexDataFailed = true;
          console.warn(LAZY_LOAD_FAILED, error);
          if (this.codexDataLoad === request) this.codexDataLoad = undefined;
        });
      this.codexDataLoad = request;
    }
    const activationId = this.activationId;
    return this.codexDataLoad.then(() => {
      if (activationId !== this.activationId || !this.sys.settings.active || !this.root?.active) return;
      this.renderAll();
    });
  }

  private codexBossView(enemy: CodexEnemyEntry) {
    return this.codexBossDossierModule?.codexBossDossier(
      enemy.id,
      enemy.moveKit,
      this.observedEnemyMoves,
      enemy.typeHint === 'Boss'
    ) ?? {
      observed: 0,
      total: enemy.moveKit.length,
      rows: enemy.moveKit.map((move) => ({
        text: enemy.typeHint === 'Boss' ? '- Undocumented tactic - face this boss to reveal' : `- ${move.text}`,
        revealed: enemy.typeHint !== 'Boss'
      }))
    };
  }

  private codexDataPending(): boolean {
    return !this.codexData && Boolean(this.codexDataLoad) && !this.codexDataFailed;
  }

  private visibleGridEntries<T>(entries: T[], cols: number, cellH: number): T[] {
    const top = this.currentGridTop();
    const overscan = cellH * 2;
    return entries.filter((_entry, i) => {
      const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
      return cy - this.gridScroll >= top - overscan && cy - this.gridScroll <= CodexScene.GRID_BOTTOM + overscan;
    });
  }

  private currentDetailArtAsset(): RuntimeImageAsset | undefined {
    if (!this.detailId) return undefined;
    if (this.activeSection === 'items') {
      if (alphaRouteMarkLibrary.has(this.detailId)) return waymarkArtAssets[this.detailId];
      if (alphaSupplyLibrary.has(this.detailId)) return supplyArtAssets[this.detailId];
      return undefined;
    }
    if (this.activeSection === 'leaders') return codexLeaderArtAssets[this.detailId];
    if (this.activeSection === 'enemies') {
      const enemy = this.currentCodexEnemies().find((candidate) => candidate.id === this.detailId);
      return enemy ? this.enemyArtAsset(enemy) : undefined;
    }
    return this.discovered.has(this.detailId) ? cardArtAssets[this.detailId] : undefined;
  }

  private queueArt() {
    const cards = this.currentCodexCards();
    const items = this.currentCodexItems();
    const leaders = this.allLeaders();
    const enemies = this.currentCodexEnemies();
    const reserveEnemyIds = new Set<string>();
    const enemyGridArtAsset = (enemy: CodexEnemyEntry) => {
      if (enemy.source === 'reserve') {
        reserveEnemyIds.add(enemy.id);
        return undefined;
      }
      return this.enemyArtAsset(enemy);
    };
    const source = this.activeSection === 'items'
      ? this.visibleGridEntries(items, 4, 176).map((item) => item.kind === 'waymark' ? waymarkCompactArtAssets[item.id] : supplyCompactArtAssets[item.id])
      : this.activeSection === 'leaders'
        ? this.visibleGridEntries(leaders, 3, 238).map((leader) => codexLeaderArtAssets[leader.id])
        : this.activeSection === 'enemies'
          ? this.visibleGridEntries(enemies, 4, 228).map((enemy) => enemyGridArtAsset(enemy))
          : this.activeSection === 'glossary'
            ? []
            : this.visibleGridEntries(cards, 5, 286)
            .filter((c) => this.discovered.has(c.id))
            .map((c) => cardCompactArtAsset(c));
    let detailArt = this.currentDetailArtAsset();
    if (this.activeSection === 'enemies' && this.detailId) {
      const enemy = enemies.find((candidate) => candidate.id === this.detailId);
      if (enemy?.source === 'reserve') {
        reserveEnemyIds.add(enemy.id);
        detailArt = undefined;
      }
    }
    queueRuntimeImageAssets(this, [...source, detailArt], 'Codex art', () => this.renderAll());
    queueReserveEnemyArtAssets(this, [...reserveEnemyIds], 'Codex enemy art', () => this.renderAll());
  }

  private renderAll() {
    hideKwTooltip();
    killTweensForTree(this, this.root);
    this.root.removeAll(true);
    this.gridLayer = undefined;
    this.focusRing = undefined;
    this.detailClosePoint = undefined;
    this.normalizeCodexFocus();
    this.queueArt();
    const all = this.allCards();
    const diagnosticIds = <T extends { id: string }>(entries: T[]) => (
      entries.slice(0, CODEX_DIAGNOSTIC_ID_LIMIT).map((entry) => entry.id)
    );
    const found = all.filter((c) => this.discovered.has(c.id)).length;
    const collectedIds = all.filter((card) => Boolean(this.cardCollection[card.id])).map((card) => card.id);
    const lockedIds = all.filter((card) => this.lockedCards.has(card.id)).map((card) => card.id);
    const taggedIds = all.filter((card) => Boolean(this.cardTags[card.id])).map((card) => card.id);
    const newlyAcquiredIds = all.filter((card) => this.newlyAcquiredCards.has(card.id)).map((card) => card.id);
    const folioUsageEntries = all
      .filter((card) => this.discovered.has(card.id) && Boolean(this.cardFolioUsage[card.id]))
      .map((card) => ({ id: card.id, ...this.cardFolioUsage[card.id] }));
    const activeFlightEntries = Object.entries(this.activeFlightCardUsage?.cards ?? {})
      .map(([id, state]) => ({ id, state, playableQuantity: 1 }));
    const enemyAll = this.allCodexEnemies();
    const reserveEnemyCount = this.allReserveEnemies().length;
    const encounterEnemyCount = this.allEncounterEnemies().length;
    const enemies = this.currentCodexEnemies();
    const waymarkAll = this.allWaymarks();
    const supplyAll = this.allSupplies();
    const itemAll = this.allCodexItems();
    if (this.activeSection === 'items') this.normalizeItemTabs();
    const items = this.currentCodexItems();
    const leaders = this.allLeaders();
    const top = this.currentGridTop();
    const bottom = CodexScene.GRID_BOTTOM;
    const glossaryTerms = this.glossaryTerms;
    const cardMode = this.activeSection === 'cards';
    const itemMode = this.activeSection === 'items';
    const leaderMode = this.activeSection === 'leaders';
    const cardView = cardMode ? this.tabs[this.activeTab]?.view : undefined;
    const favoriteView = cardView === 'favorites';
    const targetView = cardView === 'targets';
    const cardTabCards = cardMode ? this.currentCardTabCards() : [];
    const cardSearchResults = cardMode
      ? cardTabCards.map((card) => ({ card, result: this.cardSearchMatch(card) }))
      : [];
    const cardSearchMatches = cardSearchResults
      .filter(({ result }) => result.matches)
      .map(({ card }) => card);
    const cardTypoMatchedIds = cardSearchResults
      .filter(({ result }) => result.matches && result.usedTypoTolerance)
      .map(({ card }) => card.id);
    const cardSearchActive = Boolean(this.normalizeCardSearchText(this.cardSearchQuery));
    const activeLens = this.activeCardCollectionLens();
    const targetMilestones = Object.values(this.cardCollection).filter((record) => Boolean(record.targetCompletedAt)).length;
    const cards = cardMode ? cardSearchMatches.filter(activeLens.match) : [];
    const collectionAtlas = this.collectionAtlasSnapshot();
    const activeCardCollection = cardMode ? this.activeCollectionProgress() : undefined;
    const activeCardDiscovery = cardMode && this.activeTab < collectionAtlas.families.length
      ? this.codexBossDossierModule?.cardDiscoverySets(
        all,
        this.discovered
      )[this.activeTab]
      : undefined;
    window.advanceTime = (ms: number) => advanceGameTime(this.game, ms);
    window.render_game_to_text = () => JSON.stringify({
      mode: 'codex',
      section: this.activeSection,
      origin: {
        scene: this.returnScene,
        label: this.returnScene === 'RouteScene' ? 'Route' : 'Title',
        preservesActiveRun: this.returnScene === 'RouteScene',
      },
      audio: birdAudio.snapshot(),
      cardsDiscovered: found,
      cardsTotal: all.length,
      cardFavorites: {
        count: this.favoriteCards.size,
        ids: [...this.favoriteCards],
        detailId: this.activeSection === 'cards' ? this.detailId ?? '' : '',
        detailFavorite: Boolean(this.activeSection === 'cards' && this.detailId && this.favoriteCards.has(this.detailId)),
        keyboard: 'C',
        controller: 'X',
        viewActive: favoriteView,
        viewEmpty: favoriteView && cardTabCards.length === 0,
        visibleIds: favoriteView ? cards.map((card) => card.id) : [],
      },
      cardProtection: {
        count: lockedIds.length,
        ids: lockedIds,
        detailId: this.activeSection === 'cards' ? this.detailId ?? '' : '',
        detailProtected: Boolean(
          this.activeSection === 'cards'
          && this.detailId
          && this.lockedCards.has(this.detailId)
        ),
        detailEligible: Boolean(
          this.activeSection === 'cards'
          && this.detailId
          && this.cardCollection[this.detailId]
        ),
        keyboard: 'T',
        controller: 'Y',
        private: true,
        includedInBackups: true,
        protectsFutureDestructiveActions: true,
        currentDestructiveActions: false,
        affectsPower: false,
        affectsRewardOdds: false,
        persisted: true,
        searchable: true,
      },
      personalCardTags: {
        count: taggedIds.length,
        ids: taggedIds,
        entries: taggedIds.map((id) => ({ id, tag: this.cardTags[id] })),
        available: ['staple', 'experiment', 'keepsake'],
        detailId: this.activeSection === 'cards' ? this.detailId ?? '' : '',
        detailTag: this.activeSection === 'cards' && this.detailId
          ? this.cardTags[this.detailId] ?? ''
          : '',
        visibleIds: cards.filter((card) => Boolean(this.cardTags[card.id])).map((card) => card.id),
        lensActive: activeLens.id === 'tagged',
        keyboard: 'V',
        controller: 'L3',
        private: true,
        affectsPower: false,
        persisted: true,
      },
      cardJournal: {
        count: Object.keys(this.cardJournal).length,
        ids: Object.keys(this.cardJournal),
        detailId: this.activeSection === 'cards' ? this.detailId ?? '' : '',
        detailName: this.activeSection === 'cards' && this.detailId && cardLibrary[this.detailId]
          ? displayName(cardLibrary[this.detailId])
          : '',
        detailNote: this.activeSection === 'cards' && this.detailId
          ? this.cardJournal[this.detailId] ?? ''
          : '',
        editing: Boolean(this.cardJournalInput),
        editingId: this.cardJournalEditingId ?? '',
        status: this.cardJournalStatus,
        keyboard: 'J',
        controller: 'Start',
        maxLength: CARD_JOURNAL_NOTE_LIMIT,
        private: true,
        includedInBackups: true,
        includedInShareCodes: false,
        affectsPower: false,
        persisted: true,
        searchable: true,
      },
      savedCollectionViews: {
        open: this.savedCollectionViewsOpen,
        count: this.savedCollectionViews.length,
        capacity: CODEX_SAVED_VIEW_LIMIT,
        selectedIndex: this.savedCollectionViewIndex,
        selectedId: this.savedCollectionViews[this.savedCollectionViewIndex]?.id ?? '',
        status: this.savedCollectionViewStatus,
        current: this.currentSavedCollectionViewCriteria(),
        currentMatchesSaved: this.savedCollectionViews.some((view) => (
          codexSavedViewMatches(view, this.currentSavedCollectionViewCriteria())
        )),
        items: this.savedCollectionViews.map((view) => ({
          ...view,
          tabLabel: CODEX_SAVED_VIEW_TABS.find((tab) => tab.id === view.tab)?.label ?? 'Cards',
          lensLabel: this.cardCollectionLenses.find((lens) => lens.id === view.lens)?.label ?? 'All',
          sortLabel: this.cardSortModes.find((sort) => sort.id === view.sort)?.label ?? 'Binder',
        })),
        keyboard: {
          open: 'B',
          save: 'Ctrl+S',
          delete: 'Delete',
          apply: controlBindingLabel('confirm'),
          close: controlBindingLabel('back'),
        },
        controller: {
          open: 'Select',
          save: 'X',
          delete: 'Y',
          apply: 'A',
          close: 'B',
        },
        includedInBackups: true,
        private: true,
        affectsPower: false,
        persisted: true,
        replacesAtCapacity: false,
      },
      cardShowcase: {
        count: this.cardShowcase.length,
        capacity: CARD_SHOWCASE_LIMIT,
        ids: [...this.cardShowcase],
        detailId: this.activeSection === 'cards' ? this.detailId ?? '' : '',
        detailShowcased: Boolean(this.detailId && this.cardShowcase.includes(this.detailId)),
        detailCanAdd: Boolean(
          this.detailId
          && this.discovered.has(this.detailId)
          && (this.cardShowcase.includes(this.detailId) || this.cardShowcase.length < CARD_SHOWCASE_LIMIT)
        ),
        full: this.cardShowcase.length >= CARD_SHOWCASE_LIMIT,
        keyboard: 'G',
        controller: 'R3',
        location: 'Flock Record',
        affectsPower: false,
        persisted: true,
        replacesAtCapacity: false,
      },
      collectionHunt: {
        count: this.collectionTargets.size,
        capacity: COLLECTION_TARGET_LIMIT,
        ids: [...this.collectionTargets],
        completed: targetMilestones,
        detailId: this.activeSection === 'cards' ? this.detailId ?? '' : '',
        detailTargeted: Boolean(this.activeSection === 'cards' && this.detailId && this.collectionTargets.has(this.detailId)),
        detailCanTarget: Boolean(
          this.activeSection === 'cards'
          && this.detailId
          && this.discovered.has(this.detailId)
          && !this.cardCollection[this.detailId]
          && (this.collectionTargets.has(this.detailId) || this.collectionTargets.size < COLLECTION_TARGET_LIMIT)
        ),
        keyboard: 'T',
        controller: 'Y',
        changesRewardOdds: false,
        viewActive: targetView,
        viewEmpty: targetView && cardTabCards.length === 0,
        visibleIds: targetView ? cards.map((card) => card.id) : [],
      },
      cardOwnership: {
        collectedCount: collectedIds.length,
        collectedIds,
        detailId: this.activeSection === 'cards' ? this.detailId ?? '' : '',
        detail: this.activeSection === 'cards' && this.detailId
          ? this.cardCollection[this.detailId] ?? null
          : null,
        discoveredNotCollected: all
          .filter((card) => this.discovered.has(card.id) && !this.cardCollection[card.id])
          .slice(0, CODEX_DIAGNOSTIC_ID_LIMIT)
          .map((card) => card.id),
        idListLimit: CODEX_DIAGNOSTIC_ID_LIMIT,
        discoveredNotCollectedTruncated: all.filter((card) => (
          this.discovered.has(card.id) && !this.cardCollection[card.id]
        )).length > CODEX_DIAGNOSTIC_ID_LIMIT,
        runCopiesTemporary: true,
      },
      cardAcquisition: {
        detailId: this.activeSection === 'cards' ? this.detailId ?? '' : '',
        detail: this.activeSection === 'cards' && this.detailId && cardLibrary[this.detailId]
          ? cardAcquisitionProfile(
            this.detailId,
            cardLibrary[this.detailId].runtime.kind,
          )
          : null,
        selectedSetMissing: collectionAtlas.selectedMissing,
        allCardsPermanentlyAvailable: true,
        hasSeasonalCards: false,
        hasRotatingCards: false,
        requiresStore: false,
        revealsUndiscoveredIdentities: false,
        pathlessCardCount: all.filter((card) => (
          cardAcquisitionProfile(card.id, card.runtime.kind).paths.length === 0
        )).length,
      },
      cardFolioUsage: {
        cardCount: folioUsageEntries.length,
        activeCardCount: folioUsageEntries.filter((entry) => entry.active > 0).length,
        archivedOnlyCardCount: folioUsageEntries.filter((entry) => entry.active === 0 && entry.archived > 0).length,
        ids: folioUsageEntries.map((entry) => entry.id),
        entries: folioUsageEntries,
        detailId: this.activeSection === 'cards' ? this.detailId ?? '' : '',
        detail: this.activeSection === 'cards' && this.detailId
          ? this.cardFolioUsage[this.detailId] ?? null
          : null,
        visibleIds: cards.filter((card) => Boolean(this.cardFolioUsage[card.id])).map((card) => card.id),
        lensActive: activeLens.id === 'folio',
        derivedFromPrivateFolios: true,
        affectsPower: false,
      },
      activeFlightCards: {
        active: Boolean(this.activeFlightCardUsage),
        deckSize: this.activeFlightCardUsage?.deckSize ?? 0,
        ids: activeFlightEntries.map((entry) => entry.id),
        entries: activeFlightEntries,
        detailId: this.activeSection === 'cards' ? this.detailId ?? '' : '',
        detail: this.activeSection === 'cards' && this.detailId
          ? {
              id: this.detailId,
              inDeck: Boolean(this.activeFlightCardUsage?.cards[this.detailId]),
              playableQuantity: this.activeFlightCardUsage?.cards[this.detailId] ? 1 : 0,
              state: this.activeFlightCardUsage?.cards[this.detailId]
                ?? (this.activeFlightCardUsage ? 'not-in-flight' : 'no-active-flight'),
              canOpenDeckReview: this.canOpenCurrentCardInFlightDeck(this.detailId),
            }
          : null,
        source: 'autosaved route checkpoint',
        temporary: true,
        singletonCopies: true,
        affectsPermanentOwnership: false,
        affectsSavedFolios: false,
        readOnly: true,
        searchable: true,
        deckReviewHandoff: {
          pointer: true,
          keyboard: 'D',
          controller: 'RB',
          requiresRouteOrigin: true,
          exactCardSelection: true,
          preservesRun: true,
          editsDeck: false,
          savesFolio: false,
        },
      },
      newlyAcquiredCards: {
        count: newlyAcquiredIds.length,
        ids: newlyAcquiredIds,
        detailId: this.activeSection === 'cards' ? this.detailId ?? '' : '',
        detailNew: Boolean(
          this.activeSection === 'cards'
          && this.detailId
          && this.newlyAcquiredCards.has(this.detailId)
        ),
        visibleIds: cards.filter((card) => this.newlyAcquiredCards.has(card.id)).map((card) => card.id),
        lensActive: activeLens.id === 'new',
        bulkControlRendered: cardMode && !this.detailId && newlyAcquiredIds.length > 0,
        keyboard: 'N',
        controller: 'LT',
        affectsOwnership: false,
        persisted: true,
      },
      cardCollectionLens: {
        id: activeLens.id,
        label: activeLens.label,
        index: this.cardCollectionLenses.indexOf(activeLens),
        count: this.cardCollectionLenses.length,
        visibleCount: cards.length,
        baseCount: cardSearchMatches.length,
        setCount: cardTabCards.length,
        empty: cardMode && cardSearchMatches.length > 0 && cards.length === 0,
        visibleIds: diagnosticIds(cards),
        visibleIdsTruncated: cards.length > CODEX_DIAGNOSTIC_ID_LIMIT,
        keyboard: 'L',
        controller: 'LB',
        persisted: true,
      },
      activeCardFilters: {
        visible: cardMode && !this.detailId && this.activeCardFilterChips().length > 0,
        count: this.activeCardFilterChips().filter((chip) => chip.id !== 'clear').length,
        selectedIndex: this.activeCardFilterIndex,
        chips: this.activeCardFilterChips().map((chip) => ({
          id: chip.id,
          label: chip.label,
          value: chip.value,
          removable: true,
          clearAll: chip.id === 'clear',
          width: chip.width,
        })),
        gridTop: this.currentGridTop(),
        individualRemoval: true,
        clearAllRendered: cardMode && !this.detailId && this.activeCardFilterChips().length > 0,
        keyboard: {
          focus: 'Tab',
          choose: `${controlBindingLabel('previous')} / ${controlBindingLabel('next')}`,
          remove: `${controlBindingLabel('confirm')} / Delete`,
        },
        controller: {
          choose: 'D-pad Left / Right',
          remove: 'A',
        },
        clearsSet: false,
        clearsSort: false,
        affectsOwnership: false,
        persisted: true,
      },
      cardSearch: {
        query: this.cardSearchQuery,
        normalizedQuery: this.normalizeCardSearchText(this.cardSearchQuery),
        active: cardSearchActive,
        editing: this.cardSearchEditing,
        scope: this.tabs[this.activeTab]?.label ?? 'Cards',
        setCount: cardTabCards.length,
        matchCount: cardSearchMatches.length,
        exactMatchCount: cardSearchActive ? cardSearchMatches.length - cardTypoMatchedIds.length : 0,
        typoMatchCount: cardTypoMatchedIds.length,
        typoMatchedIds: cardTypoMatchedIds,
        typoToleranceUsed: cardTypoMatchedIds.length > 0,
        typoTolerance: {
          enabled: true,
          minimumTokenLength: CODEX_SEARCH_FUZZY_MIN_LENGTH,
          fourCharacterRule: 'adjacent transposition only',
          fiveToEightCharacterEdits: 1,
          ninePlusCharacterEdits: 2,
          numericTermsRequireExactMatch: true,
          everyQueryTermMustMatch: true,
        },
        visibleCount: cards.length,
        matchedIds: diagnosticIds(cardSearchMatches),
        matchedIdsTruncated: cardSearchMatches.length > CODEX_DIAGNOSTIC_ID_LIMIT,
        visibleIds: diagnosticIds(cards),
        visibleIdsTruncated: cards.length > CODEX_DIAGNOSTIC_ID_LIMIT,
        empty: cardMode && cardSearchActive && cardSearchMatches.length === 0,
        keyboard: '/',
        controller: 'RB',
        nativeInput: Boolean(this.cardSearchInput),
        maxLength: CARD_SEARCH_MAX_LENGTH,
        fields: ['name', 'rules', 'keyword', 'character', 'set', 'type', 'cost', 'rarity', 'ownership', 'active flight usage', 'saved Folio usage', 'personal tag', 'private journal', 'showcase', 'protection'],
        revealsUndiscoveredDetails: false,
        persisted: true,
      },
      cardSort: {
        id: this.cardSortMode,
        label: this.activeCardSortMode().label,
        index: this.cardSortModes.findIndex((mode) => mode.id === this.cardSortMode),
        count: this.cardSortModes.length,
        visibleIds: diagnosticIds(cards),
        visibleIdsTruncated: cards.length > CODEX_DIAGNOSTIC_ID_LIMIT,
        discoveredIds: diagnosticIds(cards.filter((card) => this.discovered.has(card.id))),
        collectedIds: diagnosticIds(cards.filter((card) => Boolean(this.cardCollection[card.id]))),
        keyboard: 'R',
        controller: 'RT',
        hidesUndiscoveredMetadata: true,
        persisted: true,
      },
      collectionAtlas,
      itemCount: itemAll.length,
      leaderCount: leaders.length,
      enemyCount: enemyAll.length,
      detailOpen: this.detailId ?? '',
      inspectionReturn: {
        detailOpen: Boolean(this.detailId),
        captured: Boolean(this.detailReturnContext),
        selectedId: this.detailReturnContext?.entryId ?? this.lastDetailReturnResult?.entryId ?? '',
        entryIndex: this.detailReturnContext?.entryIndex ?? this.entryFocusIndex,
        gridScroll: Math.round(this.detailReturnContext?.gridScroll ?? this.gridScroll),
        gridScrollTarget: Math.round(this.detailReturnContext?.gridScrollTarget ?? this.gridScrollTarget),
        section: this.detailReturnContext?.section ?? this.activeSection,
        set: this.tabs[this.detailReturnContext?.activeTab ?? this.activeTab]?.label ?? '',
        lens: this.detailReturnContext?.cardCollectionLens ?? this.cardCollectionLens,
        query: this.detailReturnContext?.cardSearchQuery ?? this.cardSearchQuery,
        sort: this.detailReturnContext?.cardSortMode ?? this.cardSortMode,
        lastRestoredExact: this.lastDetailReturnResult?.exact ?? false,
        membershipChanged: this.lastDetailReturnResult?.membershipChanged ?? false,
        oneActionOpen: true,
        restoresExactContextWhenMembershipUnchanged: true,
        keyboard: { open: controlBindingLabel('confirm'), close: `${controlBindingLabel('confirm')} / ${controlBindingLabel('back')}` },
        controller: { open: 'A', close: 'A / B' },
        pointer: { open: 'Card', close: 'Close / backdrop' },
      },
      gridVirtualization: {
        enabled: true,
        sourceEntryCount: cardMode ? cards.length : undefined,
        renderedEntryCount: cardMode
          ? this.gridLayer?.list.filter((entry) => entry.name === 'codex-card-entry-hit').length ?? 0
          : undefined,
        offscreenEntriesSkipped: cardMode
          ? Math.max(
            0,
            cards.length - (this.gridLayer?.list.filter((entry) => entry.name === 'codex-card-entry-hit').length ?? 0),
          )
          : undefined,
        overscanRows: 2,
        artQueueScopedToVisibleRows: true,
        scrollMovesExistingLayerBetweenRenders: true,
        rerenderDistance: Math.max(128, this.gridRenderCellH * 1.5),
        placeholderStrategy: 'card identity and family remain visible while art streams',
        diagnosticIdListLimit: CODEX_DIAGNOSTIC_ID_LIMIT,
      },
      codexFocus: this.codexFocusState(),
      cardCollection: activeCardCollection,
      cardDiscovery: activeCardDiscovery,
      bossDossier: this.activeSection === 'enemies' && this.detailId
        ? (() => {
          const enemy = enemyAll.find((candidate) => candidate.id === this.detailId);
          if (enemy?.typeHint !== 'Boss') return undefined;
          const { observed, total } = this.codexBossView(enemy);
          return { enemyId: enemy.id, observed, total };
        })()
        : undefined,
      codexDossierFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-dossier-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-dossier-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-dossier-frame'].key)
      },
      codexEntryFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-entry-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-entry-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-entry-frame'].key)
      },
      codexArtPreviewFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-art-preview-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-art-preview-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-art-preview-frame'].key)
      },
      codexBackCommandFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-back-command-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-back-command-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-back-command-frame'].key)
      },
      codexTabFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-tab-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-tab-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-tab-frame'].key)
      },
      codexCloseCommandFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-close-command-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-close-command-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-close-command-frame'].key)
      },
      codexScrollCueFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-scroll-cue-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-scroll-cue-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-scroll-cue-frame'].key)
      },
      codexGridScrollCueFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-grid-scroll-cue-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-grid-scroll-cue-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-grid-scroll-cue-frame'].key)
      },
      keywordTooltipFrame: {
        loaded: this.textures.exists(uiIconAssets['keyword-tooltip-frame'].key),
        rendered: ((this as Phaser.Scene & { keywordTooltipFrameCount?: number }).keywordTooltipFrameCount ?? 0) > 0,
        count: (this as Phaser.Scene & { keywordTooltipFrameCount?: number }).keywordTooltipFrameCount ?? 0
      },
      glossaryTerms: this.activeSection === 'glossary'
        ? glossaryTerms.map((term) => term.term)
        : undefined,
    });

    // 1) Scrollable grid. Drawn FIRST so the
    //    header/footer curtains below can hide anything scrolled out of view
    //    (WebGL doesn't support geometry masks, so we clip with opaque strips).
    const glossaryMode = this.activeSection === 'glossary';
    const cols = cardMode ? 5 : itemMode ? 3 : leaderMode ? 3 : glossaryMode ? 2 : 4;
    const cellW = cardMode ? 202 : itemMode ? 360 : leaderMode ? 360 : glossaryMode ? 580 : 274;
    const cellH = cardMode ? 286 : itemMode ? 148 : leaderMode ? 238 : glossaryMode ? 94 : 228;
    const gridLeft = (GAME_WIDTH - cols * cellW) / 2;
    const rows = Math.ceil((cardMode ? cards.length : itemMode ? items.length : leaderMode ? leaders.length : glossaryMode ? glossaryTerms.length : enemies.length) / cols);
    this.gridMaxScroll = Math.max(0, rows * cellH - (bottom - top) + 12);
    this.gridScrollTarget = clamp(this.gridScrollTarget, 0, this.gridMaxScroll);
    this.gridScroll = clamp(this.gridScroll, 0, this.gridMaxScroll);

    const gridOverscan = cellH * 2;
    const grid = this.add.container(0, -this.gridScroll);
    this.gridLayer = grid;
    this.gridRenderScroll = this.gridScroll;
    this.gridRenderCellH = cellH;
    if (cardMode) {
      const searchEmpty = cardSearchActive && cardSearchMatches.length === 0;
      const lensEmpty = cardSearchMatches.length > 0 && cards.length === 0;
      if (favoriteView && cardTabCards.length === 0) this.renderFavoriteEmptyState(grid, top, bottom);
      else if (targetView && cardTabCards.length === 0) this.renderHuntListEmptyState(grid, top, bottom);
      else if (searchEmpty) this.renderCardSearchEmptyState(grid, top, bottom);
      else if (lensEmpty) this.renderCardCollectionLensEmptyState(grid, top, bottom, activeLens.label);
      cards.forEach((card, i) => {
        const cx = gridLeft + (i % cols) * cellW + cellW / 2;
        const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
        // Cull rows fully outside the viewport (cheap + avoids drawing offscreen).
        if (cy - this.gridScroll < top - gridOverscan || cy - this.gridScroll > bottom + gridOverscan) return;
        this.renderThumb(grid, card, cx, cy);
      });
    } else if (itemMode) {
      items.forEach((item, i) => {
        const cx = gridLeft + (i % cols) * cellW + cellW / 2;
        const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
        if (cy - this.gridScroll < top - gridOverscan || cy - this.gridScroll > bottom + gridOverscan) return;
        if (item.kind === 'waymark') this.renderWaymarkThumb(grid, item.mark, cx, cy);
        else this.renderSupplyThumb(grid, item.supply, cx, cy);
      });
    } else if (leaderMode) {
      leaders.forEach((leader, i) => {
        const cx = gridLeft + (i % cols) * cellW + cellW / 2;
        const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
        if (cy - this.gridScroll < top - gridOverscan || cy - this.gridScroll > bottom + gridOverscan) return;
        this.renderLeaderThumb(grid, leader, cx, cy);
      });
    } else if (glossaryMode) {
      glossaryTerms.forEach((term, i) => {
        const cx = gridLeft + (i % cols) * cellW + cellW / 2;
        const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
        if (cy - this.gridScroll < top - gridOverscan || cy - this.gridScroll > bottom + gridOverscan) return;
        this.renderGlossaryEntry(grid, term, cx, cy, cellW - 24, cellH - 16);
      });
    } else {
      enemies.forEach((enemy, i) => {
        const cx = gridLeft + (i % cols) * cellW + cellW / 2;
        const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
        if (cy - this.gridScroll < top - gridOverscan || cy - this.gridScroll > bottom + gridOverscan) return;
        this.renderEnemyThumb(grid, enemy, cx, cy);
      });
    }
    this.root.add(grid);

    // 2) Curtains hide grid overflow above/below the viewport. While more rows
    //    remain, a short ink fade lets the partial next row recede into the
    //    command rail instead of ending on a hard crop.
    if (this.gridScroll < this.gridMaxScroll - 0.5) {
      const fadeStepH = CodexScene.GRID_BOTTOM_FADE_HEIGHT / CodexScene.GRID_BOTTOM_FADE_STEPS;
      for (let step = 0; step < CodexScene.GRID_BOTTOM_FADE_STEPS; step += 1) {
        const progress = (step + 1) / CodexScene.GRID_BOTTOM_FADE_STEPS;
        const alpha = 0.04 + progress * progress * 0.86;
        const strip = this.add.rectangle(
          GAME_WIDTH / 2,
          bottom - CodexScene.GRID_BOTTOM_FADE_HEIGHT + fadeStepH * (step + 0.5),
          GAME_WIDTH,
          fadeStepH,
          0x070a11,
          alpha,
        )
          .setName('codex-grid-bottom-fade-strip')
          .setData('step', step)
          .setData('progress', progress)
          .setData('fadeAlpha', alpha)
          .setData('gridBottom', bottom);
        this.root.add(strip);
      }
    }
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, top / 2, GAME_WIDTH, top, 0x070a11, 1));
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, (bottom + GAME_HEIGHT) / 2, GAME_WIDTH, GAME_HEIGHT - bottom, 0x070a11, 1));

    // 3) Header (title / counter / Back / tabs) on top of the curtain.
    const headerH = itemMode
      ? 188
      : cardMode && this.activeCardFilterChips().length > 0
        ? CARD_FILTER_GRID_TOP
        : 156;
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, headerH / 2, GAME_WIDTH, headerH, 0x08111e, 0.96));
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, headerH - 6, GAME_WIDTH - 80, 2, 0x1b2c3e, 0.82));
    this.root.add(this.add.rectangle(838, 42, 486, 54, 0x05080e, 0.64).setStrokeStyle(1, 0x22364d, 0.72));
    this.root.add(this.add.text(40, 24, 'Codex', { fontFamily: 'Georgia, serif', fontSize: '34px', fontStyle: UI_BOLD, color: UI_GOLD, stroke: '#000000', strokeThickness: 4 }));
    const subtitle = cardMode
      ? favoriteView
        ? `${cardTabCards.length} favorite card${cardTabCards.length === 1 ? '' : 's'} / ${found} discovered${activeLens.id === 'all' ? '' : ` / ${activeLens.label} lens: ${cards.length}`}`
        : targetView
          ? `${cardTabCards.length}/${COLLECTION_TARGET_LIMIT} active hunts / ${targetMilestones} completed${activeLens.id === 'all' ? '' : ` / ${activeLens.label} lens: ${cards.length}`}`
          : activeLens.id === 'all'
            ? `${collectedIds.length} collected / ${found} discovered / ${all.length} total`
            : `${activeLens.label} lens: ${cards.length}/${cardTabCards.length} in ${this.tabs[this.activeTab]?.label ?? 'Cards'} / ${collectedIds.length} collected`
      : itemMode
        ? `${itemAll.length} items (${waymarkAll.length} Waymarks / ${supplyAll.length} Supplies)`
        : glossaryMode
          ? `${glossaryTerms.length} keywords`
          : leaderMode
            ? `${flockLeaders.filter((leader) => isLeaderUnlocked(loadAccount(), leader.id)).length} / ${flockLeaders.length} Flock Leaders rallied`
            : this.codexDataPending()
            ? `${encounterEnemyCount} enemies (loading reserves)`
            : `${enemyAll.length} enemies (${encounterEnemyCount} playable / ${reserveEnemyCount} reserve)`;
    this.root.add(this.add.text(42, 66, subtitle, { fontFamily: UI_FONT, fontSize: '15px', color: UI_MUTED }));
    const codexStatus = this.codexDataFailed
      ? 'Extended Codex notes unavailable'
      : this.codexDataPending()
        ? 'Loading extended Codex notes...'
        : '';
    if (codexStatus) {
      this.root.add(this.add.text(42, 84, codexStatus, {
        fontFamily: UI_FONT,
        fontSize: '12px',
        color: this.codexDataFailed ? '#ff9b6a' : '#8df4ff'
      }));
    }

    const backX = GAME_WIDTH - 76;
    const backFrameKey = uiIconAssets['codex-back-command-frame'].key;
    const hasBackFrame = this.textures.exists(backFrameKey);
    const back = this.add.rectangle(backX, 42, 132, 44, 0x122235, hasBackFrame ? 0.14 : 0.96)
      .setStrokeStyle(2, 0xd8a840, hasBackFrame ? 0.24 : 1);
    this.root.add(back);
    const backHit = this.add.rectangle(backX, 42, 132, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('codex-back-hit');
    backHit.on('pointerdown', () => { playUiSound('close'); this.returnToOrigin(); });
    this.root.add(backHit);
    if (hasBackFrame) {
      this.textures.get(backFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.root.add(this.add.image(backX, 42, backFrameKey)
        .setDisplaySize(132, 42)
        .setAlpha(0.9)
        .setName('codex-back-command-frame'));
    }
    this.root.add(this.add.text(backX, 42, this.returnScene === 'RouteScene' ? 'Route' : 'Back', {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5));
    renderAudioToggleControl(this, (obj) => this.root.add(obj), GAME_WIDTH - 174, 42);
    if (cardMode) {
      this.renderCardSearchControl(CARD_SEARCH_X, CARD_SEARCH_Y);
      this.renderCardCollectionLensControl(430, 42);
      if (!this.detailId && this.newlyAcquiredCards.size > 0) {
        this.renderClearNewCardsControl(GAME_WIDTH - 72, CARD_FILTER_CHIP_Y);
      }
    }

    const sectionMeta: Record<CodexSection, string> = {
      cards: `${found}/${all.length}`,
      items: `${itemAll.length}`,
      glossary: `${glossaryTerms.length}`,
      leaders: `${flockLeaders.filter((leader) => isLeaderUnlocked(loadAccount(), leader.id)).length}/${flockLeaders.length}`,
      enemies: `${enemyAll.length}`,
    };
    const sectionAccent: Record<CodexSection, number> = {
      cards: 0x7ab8d6,
      items: 0xc9a6ff,
      glossary: 0x8df4ff,
      leaders: 0xe8c24a,
      enemies: 0xff9b6a,
    };
    this.sections.forEach(({ id: section, label }, i) => {
      const tx = 568 + i * 110;
      const active = section === this.activeSection;
      this.renderCodexTab(tx, 42, 104, 42, label, sectionMeta[section], active, sectionAccent[section], () => {
        this.focusZone = 'sections';
        playUiSound('confirm');
        this.setActiveSection(i);
        this.renderAll();
      }, 14);
    });

    if (cardMode) {
      this.tabs.forEach((tab, i) => {
        const tx = CodexScene.CARD_TAB_START_X + i * CodexScene.CARD_TAB_STEP;
        const active = i === this.activeTab;
        const tabCards = this.allCards().filter(tab.match);
        const got = tabCards.filter((c) => this.discovered.has(c.id)).length;
        const sampleCard = tabCards[0];
        const accent = tab.view === 'favorites'
          ? UI_FIELD.gold
          : tab.view === 'targets'
            ? 0xff9b6a
            : sampleCard ? this.cardAccent(sampleCard) : 0x7ab8d6;
        const meta = tab.view === 'targets'
          ? `${tabCards.length}/${COLLECTION_TARGET_LIMIT}`
          : tab.view === 'favorites'
            ? `${tabCards.length}`
            : `${got}/${tabCards.length}`;
        this.renderCodexTab(tx, 116, CodexScene.CARD_TAB_WIDTH, 40, tab.label, meta, active, accent, () => {
          this.focusZone = 'primaryTabs';
          playUiSound('confirm');
          this.setActivePrimaryTab(i);
          this.renderAll();
        }, tab.view ? 10 : 11);
      });
      if (activeCardCollection) {
        const activeCards = this.allCards().filter(this.tabs[this.activeTab].match);
        this.renderCollectionAtlasRail(
          activeCardCollection,
          activeCards[0] ? this.cardAccent(activeCards[0]) : 0x7ab8d6,
        );
      }
      if (!this.detailId && this.activeCardFilterChips().length > 0) {
        this.renderActiveCardFilters();
      }
    } else if (itemMode) {
      this.itemTypeTabs.forEach((tab, i) => {
        const tx = 72 + i * 132;
        const active = i === this.activeItemTypeTab;
        const tabItems = this.allCodexItems().filter(tab.match);
        const accent = tab.label === 'Supplies' ? 0xffb86b : tab.label === 'Waymarks' ? 0xc9a6ff : 0xd8a840;
        const iconOverride = itemTypeCodexIconForLabel(tab.label);
        this.renderCodexTab(tx, 102, 120, 32, tab.label, `${tabItems.length}`, active, accent, () => {
          this.focusZone = 'primaryTabs';
          playUiSound('confirm');
          this.setActivePrimaryTab(i);
          this.renderAll();
        }, 11, iconOverride);
      });
      const contextTabs = this.currentItemFilterTabs();
      const typeDef = this.activeItemTypeDef();
      const typeItems = this.allCodexItems().filter(typeDef.match);
      contextTabs.forEach((tab, i) => {
        const tx = 62 + i * 108;
        const active = i === this.activeItemFilterTab;
        const tabItems = typeItems.filter(tab.match);
        const accent = tabItems[0]
          ? tabItems[0].kind === 'waymark' ? this.waymarkAccent(tabItems[0].mark) : this.supplyAccent(tabItems[0].supply)
          : typeDef.label === 'Supplies' ? 0xffb86b : 0xc9a6ff;
        const iconOverride = typeDef.label === 'Waymarks'
          ? waymarkCodexIconForLabel(tab.label)
          : typeDef.label === 'Supplies'
            ? supplyCodexIconForLabel(tab.label)
            : undefined;
        this.renderCodexTab(tx, 160, 100, 30, tab.label, `${tabItems.length}`, active, accent, () => {
          this.focusZone = 'secondaryTabs';
          playUiSound('confirm');
          this.setActiveSecondaryTab(i);
          this.renderAll();
        }, 10, iconOverride);
      });
    } else if (!leaderMode && !glossaryMode) {
      this.enemyTabs.forEach((tab, i) => {
        const tx = 72 + i * 150;
        const active = i === this.activeEnemyTab;
        const tabEnemies = this.allCodexEnemies().filter(tab.match);
        const accent = tabEnemies[0] ? this.enemyAccent(tabEnemies[0]) : 0x7ab8d6;
        this.renderCodexTab(tx, 116, 140, 40, tab.label, `${tabEnemies.length}`, active, accent, () => {
          this.focusZone = 'primaryTabs';
          playUiSound('confirm');
          this.setActivePrimaryTab(i);
          this.renderAll();
        }, 13, enemyCodexIconForLabel(tab.label));
      });
    }

    if (this.gridMaxScroll > 0) {
      this.renderCodexGridScrollCue(GAME_WIDTH - 88, bottom + 11, this.gridScroll >= this.gridMaxScroll);
    }

    if (this.detailId) {
      if (this.activeSection === 'items') {
        if (alphaSupplyLibrary.has(this.detailId)) this.renderSupplyDetail(this.detailId);
        else this.renderWaymarkDetail(this.detailId);
      }
      else if (this.activeSection === 'leaders') this.renderLeaderDetail(this.detailId);
      else if (this.activeSection === 'enemies') this.renderEnemyDetail(this.detailId);
      else this.renderDetail(this.detailId);
    }
    if (this.collectionAtlasOpen) this.renderCollectionAtlas();
    if (this.savedCollectionViewsOpen) this.renderSavedCollectionViews();
    this.renderCodexFocusRing();
    this.renderCodexInputHint();
  }

  private hexColor(color: number) {
    return `#${color.toString(16).padStart(6, '0')}`;
  }

  private renderCodexDossierHeader(
    left: number,
    right: number,
    mTop: number,
    label: string,
    meta: string,
    accent: number,
    accentText: string
  ) {
    const x = (left + right) / 2;
    const headerW = right - left - 40;
    const headerY = mTop + 36;
    this.root.add(this.add.rectangle(x, headerY, headerW, 48, 0x07101c, 0.98).setStrokeStyle(1, accent, 0.72));
    this.root.add(this.add.rectangle(left + 31, headerY, 5, 30, accent, 0.9));
    this.root.add(this.add.text(left + 48, headerY - 7, label, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: accentText,
      fixedWidth: 228,
      maxLines: 1
    }).setResolution(2).setOrigin(0, 0.5));
    this.root.add(this.add.text(left + 296, headerY - 7, meta, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: '#7f93a8',
      fixedWidth: headerW - 360,
      maxLines: 1
    }).setResolution(2).setOrigin(0, 0.5));
    this.root.add(this.add.rectangle(x, mTop + 68, headerW - 26, 2, accent, 0.42));
  }

  private addCodexChip(
    layer: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    label: string,
    accent: number,
    active = false,
  ) {
    const chip = this.add.rectangle(x, y, w, 22, active ? 0x1d3047 : 0x08111e, active ? 0.98 : 0.9)
      .setStrokeStyle(1, accent, active ? 0.95 : 0.68);
    layer.add(chip);
    layer.add(this.add.text(x, y, label, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: active ? '#ffe1a3' : '#aebed0',
      align: 'center',
      fixedWidth: w - 8,
    }).setResolution(2).setOrigin(0.5));
  }

  private addCodexTagRow(
    layer: Phaser.GameObjects.Container,
    x: number,
    y: number,
    tags: string[],
    accent: number,
    maxWidth: number,
    active = false,
  ) {
    let cursor = x;
    tags.slice(0, 4).forEach((tag) => {
      const w = clamp(tag.length * 7 + 24, 72, 138);
      if (cursor + w > x + maxWidth) return;
      this.addCodexChip(layer, cursor + w / 2, y, w, tag, accent, active);
      cursor += w + 8;
    });
  }

  private renderCodexCloseControl(x: number, y: number, onClick: () => void) {
    this.detailClosePoint = { x, y };
    const frameKey = uiIconAssets['codex-close-command-frame'].key;
    const hasFrame = this.textures.exists(frameKey);
    const close = this.add.rectangle(x, y, 38, 38, 0x3d2a2d, hasFrame ? 0.22 : 0.97)
      .setStrokeStyle(2, 0xff6b57, hasFrame ? 0.38 : 1);
    this.root.add(close);
    const closeHit = this.add.rectangle(x, y, MIN_SUPPORTED_TOUCH_TARGET, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('codex-detail-close-hit');
    closeHit.on('pointerdown', onClick);
    this.root.add(closeHit);

    let frame: Phaser.GameObjects.Image | undefined;
    if (hasFrame) {
      this.textures.get(frameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      frame = this.add.image(x, y, frameKey)
        .setDisplaySize(46, 46)
        .setAlpha(0.92)
        .setName('codex-close-command-frame');
      this.root.add(frame);
    }

    closeHit.on('pointerover', () => {
      close.setFillStyle(0x4d3034, hasFrame ? 0.34 : 1);
      frame?.setAlpha(1);
      frame?.setDisplaySize(48, 48);
    });
    closeHit.on('pointerout', () => {
      close.setFillStyle(0x3d2a2d, hasFrame ? 0.22 : 0.97);
      frame?.setAlpha(0.92);
      frame?.setDisplaySize(46, 46);
    });

    this.root.add(this.add.text(x, y, 'X', {
      fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: '#ffd5cc',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5));
  }

  private renderCollectionAtlasRail(progress: CollectionProgress, accent: number) {
    const x = 1100;
    const y = 116;
    const width = 280;
    const left = x - width / 2;
    const barX = left + 12;
    const barWidth = width - 24;
    const ratio = progress.found / Math.max(1, progress.total);
    const rail = this.add.rectangle(x, y, width, 44, 0x06101a, 0.96)
      .setStrokeStyle(1, accent, progress.complete ? 0.94 : 0.56)
      .setName('codex-card-collection-rail');
    this.root.add(rail);
    const hit = this.add.rectangle(x, y, width, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('codex-card-collection-atlas-hit')
      .setData('owned', progress.owned)
      .setData('total', progress.total);
    hit.on('pointerover', () => rail.setFillStyle(0x102235, 1));
    hit.on('pointerout', () => rail.setFillStyle(0x06101a, 0.96));
    hit.on('pointerdown', () => {
      this.focusZone = 'progress';
      queueMicrotask(() => this.openCollectionAtlas());
    });
    this.root.add(hit);
    this.root.add(this.add.text(left + 12, y - 14, `${progress.name.toUpperCase()} COLLECTION`, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: '#dffbff',
    }).setResolution(2));
    this.root.add(this.add.text(left + width - 12, y - 14, `${progress.owned}/${progress.total}`, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: progress.complete ? '#ffe1a3' : '#a8bac9',
    }).setResolution(2).setOrigin(1, 0));
    this.root.add(this.add.text(left + 12, y + 1, `${progress.stage.toUpperCase()}  ·  VIEW ATLAS  G / R3`, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: '#91cbdc',
    }).setResolution(2));
    this.root.add(this.add.rectangle(barX, y + 17, barWidth, 4, 0x172534, 0.95).setOrigin(0, 0.5));
    if (ratio > 0) {
      this.root.add(this.add.rectangle(barX, y + 17, barWidth * ratio, 4, accent, 0.94).setOrigin(0, 0.5));
    }
  }

  private renderCollectionAtlas() {
    const atlas = this.collectionAtlasSnapshot();
    const scrim = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x02050a,
      0.86,
    ).setInteractive().setName('codex-collection-atlas-scrim');
    scrim.on('pointerdown', () => this.closeCollectionAtlas());
    this.root.add(scrim);

    const panel = this.add.rectangle(GAME_WIDTH / 2, 352, 1140, 588, 0x09131f, 0.995)
      .setStrokeStyle(2, UI_FIELD.cyan, 0.9)
      .setInteractive()
      .setName('codex-collection-atlas-panel');
    this.root.add(panel);
    this.root.add(this.add.rectangle(640, 116, 1060, 112, 0x07101a, 0.96)
      .setStrokeStyle(1, UI_FIELD.gold, 0.42));
    this.root.add(this.add.text(110, 75, 'COLLECTION ATLAS', {
      fontFamily: 'Georgia, serif',
      fontSize: '30px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#000000',
      strokeThickness: 4,
    }).setResolution(2));
    this.root.add(this.add.text(112, 108, 'A permanent record of every card brought home from a flight.', {
      fontFamily: UI_FONT,
      fontSize: '13px',
      color: '#b7c8d8',
    }).setResolution(2));
    this.root.add(this.add.text(112, 137, `${atlas.overall.owned} COLLECTED  ·  ${atlas.overall.discovered} ENCOUNTERED  ·  ${atlas.overall.total} TOTAL`, {
      fontFamily: UI_FONT,
      fontSize: '15px',
      fontStyle: UI_BOLD,
      color: '#dffbff',
    }).setResolution(2));
    this.root.add(this.add.text(1168, 137, atlas.overall.stage.toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: atlas.overall.complete ? '#ffe1a3' : '#91cbdc',
    }).setResolution(2).setOrigin(1, 0));
    const overallBarX = 112;
    const overallBarWidth = 1056;
    this.root.add(this.add.rectangle(overallBarX, 161, overallBarWidth, 7, 0x172534, 1).setOrigin(0, 0.5));
    if (atlas.overall.owned > 0) {
      this.root.add(this.add.rectangle(
        overallBarX,
        161,
        overallBarWidth * atlas.overall.owned / Math.max(1, atlas.overall.total),
        7,
        UI_FIELD.gold,
        0.94,
      ).setOrigin(0, 0.5));
    }
    this.renderCodexCloseControl(1170, 82, () => this.closeCollectionAtlas());

    this.root.add(this.add.text(110, 188, 'SETS  /  CHOOSE A SHELF TO OPEN', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: '#8df4ff',
    }).setResolution(2));
    atlas.families.forEach((family, index) => {
      const x = 360;
      const y = 226 + index * 50;
      const width = 500;
      const selected = index === atlas.selectedIndex;
      const accent = this.tabs[index]
        ? this.allCards().find(this.tabs[index].match)
        : undefined;
      const accentColor = accent ? this.cardAccent(accent) : UI_FIELD.cyan;
      const row = this.add.rectangle(x, y, width, 44, selected ? 0x173148 : 0x0b1826, 0.98)
        .setStrokeStyle(selected ? 2 : 1, selected ? UI_FIELD.gold : accentColor, selected ? 0.96 : 0.5);
      this.root.add(row);
      const hit = this.add.rectangle(x, y, width, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
        .setInteractive({ useHandCursor: true })
        .setName('codex-collection-atlas-family-hit')
        .setData('family', family.id)
        .setData('index', index);
      hit.on('pointerover', () => row.setFillStyle(0x173148, 1));
      hit.on('pointerout', () => row.setFillStyle(selected ? 0x173148 : 0x0b1826, 0.98));
      hit.on('pointerdown', () => this.selectCollectionAtlasFamily(index));
      this.root.add(hit);
      this.root.add(this.add.rectangle(118, y, 5, 28, accentColor, 0.92));
      this.root.add(this.add.text(132, y - 15, family.name.toUpperCase(), {
        fontFamily: UI_FONT,
        fontSize: '12px',
        fontStyle: UI_BOLD,
        color: selected ? '#ffe1a3' : '#dffbff',
      }).setResolution(2));
      this.root.add(this.add.text(132, y + 3, `${family.stage.toUpperCase()}  ·  ${family.discovered}/${family.total} ENCOUNTERED`, {
        fontFamily: UI_FONT,
        fontSize: '9px',
        color: '#91a6b8',
      }).setResolution(2));
      this.root.add(this.add.text(596, y - 8, `${family.owned}/${family.total}`, {
        fontFamily: UI_FONT,
        fontSize: '14px',
        fontStyle: UI_BOLD,
        color: family.complete ? '#ffe1a3' : '#b8e8f4',
      }).setResolution(2).setOrigin(1, 0.5));
      this.root.add(this.add.text(596, y + 10, 'COLLECTED', {
        fontFamily: UI_FONT,
        fontSize: '8px',
        fontStyle: UI_BOLD,
        color: '#70869a',
      }).setResolution(2).setOrigin(1, 0.5));
      const rowBarWidth = 130;
      this.root.add(this.add.rectangle(446, y + 12, rowBarWidth, 3, 0x263748, 1).setOrigin(0, 0.5));
      if (family.owned > 0) {
        this.root.add(this.add.rectangle(
          446,
          y + 12,
          rowBarWidth * family.owned / Math.max(1, family.total),
          3,
          accentColor,
          1,
        ).setOrigin(0, 0.5));
      }
    });

    this.root.add(this.add.text(690, 188, 'RARITY BREAKDOWN', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: '#8df4ff',
    }).setResolution(2));
    atlas.rarities.forEach((rarity, index) => {
      const y = 226 + index * 50;
      const accent = [0x86a9b9, 0x8fd7b2, 0x77bdf2, 0xe8c24a][index] ?? UI_FIELD.cyan;
      this.root.add(this.add.rectangle(930, y, 480, 44, 0x0b1826, 0.98)
        .setStrokeStyle(1, accent, 0.52));
      this.root.add(this.add.text(708, y - 8, rarity.name.toUpperCase(), {
        fontFamily: UI_FONT,
        fontSize: '12px',
        fontStyle: UI_BOLD,
        color: '#dffbff',
      }).setResolution(2).setOrigin(0, 0.5));
      this.root.add(this.add.text(1148, y - 8, `${rarity.owned}/${rarity.total} COLLECTED`, {
        fontFamily: UI_FONT,
        fontSize: '11px',
        fontStyle: UI_BOLD,
        color: rarity.complete ? '#ffe1a3' : '#b8e8f4',
      }).setResolution(2).setOrigin(1, 0.5));
      this.root.add(this.add.text(708, y + 10, rarity.stage.toUpperCase(), {
        fontFamily: UI_FONT,
        fontSize: '9px',
        color: '#91a6b8',
      }).setResolution(2).setOrigin(0, 0.5));
      this.root.add(this.add.rectangle(930, y + 12, 206, 4, 0x263748, 1).setOrigin(0, 0.5));
      if (rarity.owned > 0) {
        this.root.add(this.add.rectangle(
          930,
          y + 12,
          206 * rarity.owned / Math.max(1, rarity.total),
          4,
          accent,
          1,
        ).setOrigin(0, 0.5));
      }
    });

    const selectedMissing = atlas.selectedMissing;
    const missingTitle = selectedMissing.count > 0
      ? `MISSING PATHS  /  ${atlas.selectedFamily.name.toUpperCase()}  /  ${selectedMissing.count} LEFT`
      : `${atlas.selectedFamily.name.toUpperCase()}  /  SET COMPLETE`;
    this.root.add(this.add.text(690, 424, missingTitle, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: '#8df4ff',
    }).setResolution(2));
    this.root.add(this.add.text(
      690,
      443,
      selectedMissing.count > 0
        ? selectedMissing.paths.map((path) => {
          const shortName = path.id === 'starter_flock'
            ? 'STARTER'
            : path.id === 'combat_reward'
              ? 'FIGHTS'
              : path.id === 'route_reward'
                ? 'ROUTE'
                : path.id === 'market'
                  ? 'MARKET'
                  : 'SNAGS';
          return `${shortName} ${path.count}`;
        }).join('  /  ')
        : 'Every card on this shelf has a permanent collection record.',
      {
        fontFamily: UI_FONT,
        fontSize: '9px',
        fontStyle: UI_BOLD,
        color: selectedMissing.count > 0 ? '#dffbff' : '#ffe1a3',
        fixedWidth: 480,
      },
    ).setResolution(2));
    this.root.add(this.add.text(
      690,
      459,
      'PERMANENT / NO ROTATION / NO SEASON / NO STORE GATE',
      {
        fontFamily: UI_FONT,
        fontSize: '8px',
        color: '#8196aa',
        fixedWidth: 480,
      },
    ).setResolution(2));

    this.root.add(this.add.text(
      690,
      476,
      `COLLECTOR MILESTONES  /  ${atlas.completedMilestones}/${atlas.milestones.length} EARNED`,
      {
        fontFamily: UI_FONT,
        fontSize: '11px',
        fontStyle: UI_BOLD,
        color: '#8df4ff',
      },
    ).setResolution(2));
    const incompleteMilestones = atlas.milestones.filter((milestone) => !milestone.complete);
    const featuredMilestones = [
      ...incompleteMilestones.slice(0, 3),
      ...atlas.milestones.filter((milestone) => milestone.complete).reverse(),
    ].slice(0, 3);
    featuredMilestones.forEach((milestone, index) => {
      const y = 512 + index * 42;
      const ratio = milestone.current / Math.max(1, milestone.target);
      const accent = milestone.complete ? UI_FIELD.gold : UI_FIELD.cyan;
      this.root.add(this.add.rectangle(930, y, 480, 36, 0x0b1826, 0.98)
        .setStrokeStyle(1, accent, milestone.complete ? 0.72 : 0.42)
        .setName('codex-collection-milestone-row')
        .setData('milestoneId', milestone.id)
        .setData('complete', milestone.complete));
      this.root.add(this.add.text(704, y - 11, milestone.name.toUpperCase(), {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: milestone.complete ? '#ffe1a3' : '#dffbff',
      }).setResolution(2));
      this.root.add(this.add.text(1152, y - 11, milestone.complete ? 'EARNED' : `${milestone.current}/${milestone.target}`, {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: milestone.complete ? '#ffe1a3' : '#b8e8f4',
      }).setResolution(2).setOrigin(1, 0));
      this.root.add(this.add.text(704, y + 4, milestone.complete ? milestone.reward : milestone.description, {
        fontFamily: UI_FONT,
        fontSize: '8px',
        color: '#91a6b8',
        fixedWidth: 370,
      }).setResolution(2));
      this.root.add(this.add.rectangle(1090, y + 9, 62, 3, 0x263748, 1).setOrigin(0, 0.5));
      if (ratio > 0) {
        this.root.add(this.add.rectangle(1090, y + 9, 62 * Math.min(1, ratio), 3, accent, 1).setOrigin(0, 0.5));
      }
    });
    this.root.add(this.add.text(690, 624, 'Breadth goals grant badges, never power; undiscovered identities stay concealed.', {
      fontFamily: UI_FONT,
      fontSize: '8px',
      color: '#7f93a8',
    }).setResolution(2));
  }

  private codexFocusGeometry(): CodexFocusGeometry | undefined {
    this.normalizeCodexFocus();
    if (this.focusZone === 'savedViewsOverlay') {
      return this.savedCollectionViews.length > 0
        ? {
          x: 640,
          y: 260 + this.savedCollectionViewIndex * 74,
          width: 920,
          height: 62,
        }
        : {
          x: 1028,
          y: 170,
          width: 210,
          height: MIN_SUPPORTED_TOUCH_TARGET,
        };
    }
    if (this.focusZone === 'progressOverlay') {
      return {
        x: 360,
        y: 226 + this.collectionAtlasFamilyIndex * 50,
        width: 500,
        height: MIN_SUPPORTED_TOUCH_TARGET,
      };
    }
    if (this.focusZone === 'entries') return this.entryFocusGeometry();
    if (this.focusZone === 'back') return { x: GAME_WIDTH - 76, y: 42, width: 140, height: MIN_SUPPORTED_TOUCH_TARGET };
    if (this.focusZone === 'detail') {
      const point = this.detailClosePoint ?? { x: GAME_WIDTH - 206, y: 74 };
      return { x: point.x, y: point.y, width: MIN_SUPPORTED_TOUCH_TARGET, height: MIN_SUPPORTED_TOUCH_TARGET };
    }
    if (this.focusZone === 'sections') {
      const index = Math.max(0, this.sections.findIndex((section) => section.id === this.activeSection));
      return { x: 568 + index * 110, y: 42, width: 110, height: MIN_SUPPORTED_TOUCH_TARGET };
    }
    if (this.focusZone === 'search') {
      return {
        x: CARD_SEARCH_ACTION_X,
        y: CARD_SEARCH_Y,
        width: CARD_SEARCH_ACTION_WIDTH + 4,
        height: MIN_SUPPORTED_TOUCH_TARGET,
      };
    }
    if (this.focusZone === 'sort') {
      return {
        x: CARD_SORT_X,
        y: CARD_SEARCH_Y,
        width: CARD_SORT_WIDTH + 4,
        height: MIN_SUPPORTED_TOUCH_TARGET,
      };
    }
    if (this.focusZone === 'savedViews') {
      return {
        x: 482,
        y: 42,
        width: 52,
        height: MIN_SUPPORTED_TOUCH_TARGET,
      };
    }
    if (this.focusZone === 'newCards') {
      return {
        x: GAME_WIDTH - 72,
        y: CARD_FILTER_CHIP_Y,
        width: 132,
        height: MIN_SUPPORTED_TOUCH_TARGET,
      };
    }
    if (this.focusZone === 'progress') {
      return {
        x: 1100,
        y: 116,
        width: 280,
        height: MIN_SUPPORTED_TOUCH_TARGET,
      };
    }
    if (this.focusZone === 'primaryTabs') {
      const index = this.activePrimaryTabIndex();
      if (this.activeSection === 'cards') {
        return {
          x: CodexScene.CARD_TAB_START_X + index * CodexScene.CARD_TAB_STEP,
          y: 116,
          width: CodexScene.CARD_TAB_WIDTH,
          height: MIN_SUPPORTED_TOUCH_TARGET,
        };
      }
      if (this.activeSection === 'items') return { x: 72 + index * 132, y: 102, width: 126, height: MIN_SUPPORTED_TOUCH_TARGET };
      return { x: 72 + index * 150, y: 116, width: 146, height: MIN_SUPPORTED_TOUCH_TARGET };
    }
    if (this.focusZone === 'secondaryTabs') {
      if (this.activeSection === 'cards') {
        return { x: 404, y: 42, width: 104, height: MIN_SUPPORTED_TOUCH_TARGET };
      }
      return { x: 62 + this.activeItemFilterTab * 108, y: 160, width: 106, height: MIN_SUPPORTED_TOUCH_TARGET };
    }
    if (this.focusZone === 'activeFilters') {
      const chip = this.activeCardFilterChips()[this.activeCardFilterIndex];
      return chip
        ? { x: chip.x, y: CARD_FILTER_CHIP_Y, width: chip.width, height: MIN_SUPPORTED_TOUCH_TARGET }
        : undefined;
    }
    return undefined;
  }

  private renderCodexFocusRing() {
    const geometry = this.codexFocusGeometry();
    if (!geometry) return;
    const state = this.codexFocusState();
    const accent = this.focusZone === 'back' || this.focusZone === 'detail' ? UI_FIELD.gold : UI_FIELD.cyan;
    this.focusRing = this.add.rectangle(geometry.x, geometry.y, geometry.width, geometry.height, 0x06151b, 0.04)
      .setStrokeStyle(3, accent, 0.98)
      .setName('codex-focus-ring')
      .setData('zone', state.zone)
      .setData('index', state.index)
      .setData('label', state.label);
    this.root.add(this.focusRing);
  }

  private renderCodexInputHint() {
    const detail = Boolean(this.detailId);
    const activeFilterHint = this.activeCardFilterChips().length > 0
      ? '   |   Filter chips: Enter / Delete'
      : '';
    const label = this.savedCollectionViewsOpen
      ? `Up / Down: Choose   |   ${controlBindingLabel('confirm')} / A: Apply   |   Ctrl+S / X: Save current   |   Delete / Y: Remove   |   B / Select / ${controlBindingLabel('back')}: Close`
      : this.collectionAtlasOpen
      ? `Up / Down: Browse sets   |   ${controlBindingLabel('confirm')}: Open set   |   G / R3 / ${controlBindingLabel('back')}: Close atlas`
      : detail
      ? `Up/Down: Scroll   |   C/X: Favorite   |   V/L3: Tag   |   T/Y: Hunt / Protect   |   G/R3: Showcase   |   J/Start: Journal   |   N/LT: Seen   |   ${controlBindingLabel('confirm')}: Close`
      : this.activeSection === 'cards'
        ? `Tab: Focus   |   B / Select: Views   |   G / R3: Atlas   |   / / RB: Find   |   R / RT: Sort   |   L / LB: Lens${activeFilterHint}   |   ${controlBindingLabel('previous')} / ${controlBindingLabel('next')}: Navigate`
        : `Tab: Focus   |   ${controlBindingLabel('previous')} / ${controlBindingLabel('next')}: Navigate   |   ${controlBindingLabel('confirm')}: Select   |   ${controlBindingLabel('back')}: Back`;
    const width = this.savedCollectionViewsOpen ? 1120 : this.collectionAtlasOpen ? 830 : detail ? 1180 : this.activeSection === 'cards' ? 1240 : 710;
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 13, width, 22, 0x05070c, 0.86)
      .setStrokeStyle(1, UI_FIELD.cyan, 0.34)
      .setName('codex-input-hint-backdrop'));
    this.root.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 13, label, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: '#a9d9e8',
      stroke: '#05070c',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0.5).setName('codex-input-hint'));
  }

  private renderCodexScrollCue(x: number, y: number, atTop: boolean) {
    const frameKey = uiIconAssets['codex-scroll-cue-frame'].key;
    const hasFrame = this.textures.exists(frameKey);
    if (hasFrame) {
      this.textures.get(frameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.root.add(this.add.image(x, y, frameKey)
        .setDisplaySize(118, 30)
        .setAlpha(0.62)
        .setName('codex-scroll-cue-frame'));
    } else {
      this.root.add(this.add.rectangle(x, y, 104, 24, 0x07101c, 0.86).setStrokeStyle(1, UI_FIELD.cyan, 0.45));
    }
    this.root.add(this.add.text(x, y, atTop ? 'TOP' : 'SCROLL', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: atTop ? '#f5d38a' : UI_MUTED,
      align: 'center',
      fixedWidth: 82,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5));
  }

  private renderCodexGridScrollCue(x: number, y: number, atEnd: boolean) {
    const frameKey = uiIconAssets['codex-grid-scroll-cue-frame'].key;
    const hasFrame = this.textures.exists(frameKey);
    if (hasFrame) {
      this.textures.get(frameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.root.add(this.add.image(x, y, frameKey)
        .setDisplaySize(150, 34)
        .setAlpha(0.7)
        .setName('codex-grid-scroll-cue-frame'));
    } else {
      this.root.add(this.add.rectangle(x, y, 132, 28, 0x07101c, 0.88).setStrokeStyle(1, UI_FIELD.cyan, 0.5));
    }
    this.root.add(this.add.text(x, y, atEnd ? 'UP' : 'SCROLL', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: atEnd ? '#f5d38a' : UI_MUTED,
      align: 'center',
      fixedWidth: 104,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5));
  }

  private renderCodexTab(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    meta: string,
    active: boolean,
    accent: number,
    onClick: () => void,
    labelSize = 13,
    iconOverride?: UiIconId,
  ) {
    const fill = active ? 0x1d3047 : 0x0d1420;
    const tabFrameKey = uiIconAssets['codex-tab-frame'].key;
    const hasTabFrame = this.textures.exists(tabFrameKey);
    const rect = this.add.rectangle(x, y, w, h, fill, hasTabFrame ? (active ? 0.22 : 0.1) : (active ? 1 : 0.9))
      .setStrokeStyle(active ? 2 : 1, active ? accent : 0x2a3a4d, hasTabFrame ? (active ? 0.36 : 0.18) : (active ? 1 : 0.82));
    this.root.add(rect);
    const hit = this.add.rectangle(x, y, Math.max(w, MIN_SUPPORTED_TOUCH_TARGET), MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('codex-tab-hit')
      .setData('label', label);
    hit.on('pointerover', () => rect.setFillStyle(active ? 0x243954 : 0x121d2b, hasTabFrame ? 0.24 : 0.98));
    hit.on('pointerout', () => rect.setFillStyle(fill, hasTabFrame ? (active ? 0.22 : 0.1) : (active ? 1 : 0.9)));
    hit.on('pointerdown', onClick);
    this.root.add(hit);
    if (hasTabFrame) {
      this.textures.get(tabFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.root.add(this.add.image(x, y, tabFrameKey)
        .setDisplaySize(w, h + 5)
        .setAlpha(active ? 0.82 : 0.18)
        .setName('codex-tab-frame')
        .setData('active', active)
        .setData('label', label));
    }
    const iconId = iconOverride ?? codexIconForLabel(label);
    const icon = iconId ? addUiIconImage(this, iconId, x - w / 2 + 18, y - 2, Math.min(26, h - 10)) : undefined;
    if (icon) {
      icon.setAlpha(active ? 0.96 : 0.3);
      this.root.add(icon);
    }
    this.root.add(this.add.text(x + (icon ? 8 : 0), y - 8, label, {
      fontFamily: UI_FONT,
      fontSize: `${labelSize}px`,
      fontStyle: UI_BOLD,
      color: active ? '#ffe1a3' : '#9fb1c4',
    }).setResolution(2).setOrigin(0.5));
    this.root.add(this.add.text(x, y + 10, meta, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      color: active ? this.hexColor(accent) : '#708296',
    }).setResolution(2).setOrigin(0.5));
  }

  private renderGlossaryEntry(
    layer: Phaser.GameObjects.Container,
    term: CodexGlossaryTerm,
    cx: number,
    cy: number,
    w: number,
    h: number,
  ) {
    const accent = 0x8df4ff;
    layer.add(this.add.rectangle(cx, cy, w, h, 0x0b121d, 0.96).setStrokeStyle(1, accent, 0.68));
    addCodexEntryFrame(this, (obj) => layer.add(obj), { cx, cy, w, h }, { alpha: 0.38, padX: 18, padY: 16 });
    layer.add(this.add.text(cx - w / 2 + 24, cy - h / 2 + 18, term.term, {
      fontFamily: UI_FONT,
      fontSize: '17px',
      fontStyle: UI_BOLD,
      color: '#ffe1a3',
    }).setResolution(2).setOrigin(0, 0.5));
    this.addCodexChip(layer, cx + w / 2 - 68, cy - h / 2 + 18, 126, term.category, accent, true);
    layer.add(this.add.text(cx - w / 2 + 24, cy - h / 2 + 42, term.summary, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: this.hexColor(accent),
    }).setResolution(2));
  }

  private cardAccent(card: Card) {
    if (isSnagCard(card)) return 0xff6b57;
    if (isAviaryCard(card)) return 0xe8c24a;
    if (card.type === 'major') return 0xd8a840;
    if (card.type === 'molt') return 0xc56cff;
    return suitAccentColor(card);
  }

  private cardFamilyLabel(card: Card) {
    if (isSnagCard(card)) return 'Snag';
    if (isAviaryCard(card)) return 'Aviary';
    if (card.type === 'major') return 'Major Arcana';
    if (card.type === 'molt') return 'Molt';
    switch (card.runtime.suit) {
      case 'plumes': return 'Plumes';
      case 'quills': return 'Quills';
      case 'basins': return 'Basins';
      case 'nests': return 'Nests';
      default: return 'Aviary';
    }
  }

  private cardDossierLabel(card: Card) {
    if (isSnagCard(card)) return 'SNAG DOSSIER';
    if (isAviaryCard(card)) return 'AVIARY DOSSIER';
    if (card.type === 'major') return 'LEGEND DOSSIER';
    if (card.type === 'molt') return 'MOLT DOSSIER';
    return `${this.cardFamilyLabel(card).toUpperCase()} DOSSIER`;
  }

  private drawLockedCardBack(layer: Phaser.GameObjects.Container, card: Card, cx: number, cy: number, aw: number, ah: number, accent: number) {
    layer.add(this.add.rectangle(cx, cy, aw, ah, 0x08101b, 0.98).setStrokeStyle(1, 0x1b2c3e, 0.9));
    layer.add(this.add.rectangle(cx, cy, aw - 18, ah - 18, 0x0d1420, 0.68).setStrokeStyle(1, accent, 0.46));
    layer.add(this.add.rectangle(cx, cy - ah / 2 + 34, aw - 34, 2, accent, 0.42));
    layer.add(this.add.rectangle(cx, cy + ah / 2 - 34, aw - 34, 2, accent, 0.42));
    layer.add(this.add.triangle(cx - aw / 2 + 22, cy - ah / 2 + 22, 0, 0, 28, 0, 0, 28, accent, 0.8));
    layer.add(this.add.triangle(cx + aw / 2 - 22, cy + ah / 2 - 22, 0, 0, -28, 0, 0, -28, accent, 0.62));
    layer.add(this.add.text(cx, cy - 52, this.cardFamilyLabel(card).toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: this.hexColor(accent),
      align: 'center',
      fixedWidth: aw - 34,
    }).setResolution(2).setOrigin(0.5));
    const lockedIcon = addUiIconImage(this, 'codex-locked-card-medallion', cx, cy - 4, 28);
    if (lockedIcon) {
      layer.add(lockedIcon.setAlpha(0.42).setTint(0x7f93a8));
    } else {
      layer.add(this.add.text(cx, cy - 6, '?', {
        fontFamily: 'Georgia, serif',
        fontSize: '68px',
        fontStyle: UI_BOLD,
        color: '#344558',
        stroke: '#05070c',
        strokeThickness: 2,
      }).setResolution(2).setOrigin(0.5));
    }
    layer.add(this.add.text(cx, cy + 66, 'UNFOUND', {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: UI_MUTED,
      align: 'center',
      fixedWidth: aw - 34,
    }).setResolution(2).setOrigin(0.5));
  }

  private renderThumb(layer: Phaser.GameObjects.Container, card: Card, cx: number, cy: number) {
    // The art is a complete 2:3 card illustration - show it whole, undistorted.
    const aw = 184;
    const ah = Math.round(aw * 1.5); // exact 2:3, no smashing
    const w = aw + 8;
    const h = ah + 8;
    const found = this.discovered.has(card.id);
    const accent = this.cardAccent(card);
    const bg = this.add.rectangle(cx, cy, w, h, found ? 0x0e131d : 0x0a0d13, found ? 1 : 0.9)
      .setStrokeStyle(found ? 3 : 2, found ? accent : 0x232b35, found ? 1 : 0.7)
      .setInteractive({ useHandCursor: found })
      .setName('codex-card-entry-hit')
      .setData('cardId', card.id);
    bg.on('pointerover', () => bg.setFillStyle(found ? 0x162235 : 0x0d1420, found ? 1 : 0.94));
    bg.on('pointerout', () => bg.setFillStyle(found ? 0x0e131d : 0x0a0d13, found ? 1 : 0.9));
    if (found) bg.on('pointerdown', () => this.openCodexDetail(card.id));
    layer.add(bg);
    addCodexEntryFrame(this, (obj) => layer.add(obj), { cx, cy, w, h }, {
      alpha: found ? 0.38 : 0.26,
      tint: found ? undefined : 0x7f93a8,
      padX: 18,
      padY: 20
    });

    const key = compactCardArtKey(card);
    if (found && key && this.textures.exists(key)) {
      layer.add(this.add.image(cx, cy, key).setDisplaySize(aw, ah).setAlpha(0.99));
      // Cost badge (gameplay info not shown in the illustration).
      layer.add(this.add.circle(cx - aw / 2 + 18, cy - ah / 2 + 18, 15, card.cost === 0 ? 0x24d0d6 : 0xe8b830, 1).setStrokeStyle(2, 0x05080e, 0.95));
      layer.add(this.add.text(cx - aw / 2 + 18, cy - ah / 2 + 18, `${card.cost}`, { fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: '#06101c' }).setOrigin(0.5));
    } else if (found && renderSnagCardBorder(this, (obj) => layer.add(obj), card, cx, cy, aw, ah, 0.99)) {
      // Snag cards use their own border template even before full illustration art exists.
    } else if (found) {
      layer.add(this.add.text(cx, cy, displayName(card), {
        fontFamily: UI_FONT,
        fontSize: '15px',
        fontStyle: UI_BOLD,
        color: UI_BODY,
        align: 'center',
        wordWrap: { width: aw - 16 },
      }).setOrigin(0.5)
        .setName('codex-card-art-placeholder')
        .setData('cardId', card.id)
        .setData('status', key ? 'streaming' : 'fallback'));
      if (key) {
        layer.add(this.add.text(cx, cy + 48, 'ART STREAMING', {
          fontFamily: UI_FONT,
          fontSize: '8px',
          fontStyle: UI_BOLD,
          color: '#91a6b8',
        }).setResolution(2).setOrigin(0.5)
          .setName('codex-card-art-streaming-label')
          .setData('cardId', card.id));
      }
      this.addCodexChip(layer, cx, cy + 72, 118, this.cardFamilyLabel(card), accent, true);
    } else {
      this.drawLockedCardBack(layer, card, cx, cy, aw, ah, accent);
    }
    if (found) {
      const collected = Boolean(this.cardCollection[card.id]);
      const width = collected ? 82 : 52;
      layer.add(this.add.rectangle(cx, cy - ah / 2 + 18, width, 20, collected ? 0x3b2b0b : 0x102534, 0.96)
        .setStrokeStyle(1, collected ? UI_FIELD.gold : UI_FIELD.cyan, 0.96)
        .setName('codex-card-ownership-marker')
        .setData('cardId', card.id)
        .setData('collected', collected));
      layer.add(this.add.text(cx, cy - ah / 2 + 18, collected ? 'COLLECTED' : 'SEEN', {
        fontFamily: UI_FONT,
        fontSize: '9px',
        fontStyle: UI_BOLD,
        color: collected ? '#ffe08a' : '#b8e8f4',
        stroke: '#05070c',
        strokeThickness: 2,
      }).setResolution(2).setOrigin(0.5).setName('codex-card-ownership-label').setData('cardId', card.id));
    }
    const folioUsage = found ? this.cardFolioUsage[card.id] : undefined;
    if (folioUsage) {
      const archiveOnly = folioUsage.active === 0;
      const label = archiveOnly
        ? `ARCHIVE ${folioUsage.archived}`
        : `FOLIO ${folioUsage.total}`;
      layer.add(this.add.rectangle(cx, cy - ah / 2 + 42, 70, 18, archiveOnly ? 0x211738 : 0x102534, 0.97)
        .setStrokeStyle(1, archiveOnly ? 0xc9a6ff : UI_FIELD.cyan, 0.96)
        .setName('codex-card-folio-marker')
        .setData('cardId', card.id)
        .setData('total', folioUsage.total)
        .setData('active', folioUsage.active)
        .setData('archived', folioUsage.archived));
      layer.add(this.add.text(cx, cy - ah / 2 + 42, label, {
        fontFamily: UI_FONT,
        fontSize: '8px',
        fontStyle: UI_BOLD,
        color: archiveOnly ? '#eadcff' : '#b8e8f4',
        stroke: '#05070c',
        strokeThickness: 2,
      }).setResolution(2).setOrigin(0.5).setName('codex-card-folio-marker-label').setData('cardId', card.id));
    }
    if (found && this.newlyAcquiredCards.has(card.id)) {
      layer.add(this.add.rectangle(cx - aw / 2 + 28, cy + ah / 2 - 18, 50, 22, 0x31215a, 0.98)
        .setStrokeStyle(2, 0xc9a6ff, 0.98)
        .setName('codex-new-card-marker')
        .setData('cardId', card.id));
      layer.add(this.add.text(cx - aw / 2 + 28, cy + ah / 2 - 18, 'NEW', {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: '#eadcff',
        stroke: '#05070c',
        strokeThickness: 2,
      }).setResolution(2).setOrigin(0.5).setName('codex-new-card-marker-label').setData('cardId', card.id));
    }
    const personalTag = found ? this.cardTags[card.id] : undefined;
    if (personalTag) {
      const accentColor = this.cardTagAccent(personalTag);
      const label = this.cardTagLabel(personalTag).toUpperCase();
      const width = personalTag === 'experiment' ? 86 : 72;
      layer.add(this.add.rectangle(cx + aw / 2 - width / 2, cy + ah / 2 - 18, width, 22, 0x0d1c28, 0.98)
        .setStrokeStyle(2, accentColor, 0.98)
        .setName('codex-card-tag-marker')
        .setData('cardId', card.id)
        .setData('tag', personalTag));
      layer.add(this.add.text(cx + aw / 2 - width / 2, cy + ah / 2 - 18, label, {
        fontFamily: UI_FONT,
        fontSize: '8px',
        fontStyle: UI_BOLD,
        color: this.hexColor(accentColor),
        stroke: '#05070c',
        strokeThickness: 2,
      }).setResolution(2).setOrigin(0.5).setName('codex-card-tag-marker-label').setData('cardId', card.id));
    }
    if (found && this.favoriteCards.has(card.id)) {
      layer.add(this.add.circle(cx + aw / 2 - 18, cy - ah / 2 + 18, 16, 0x07101c, 0.94)
        .setStrokeStyle(2, UI_FIELD.gold, 0.98)
        .setName('codex-favorite-marker')
        .setData('cardId', card.id));
      layer.add(this.add.text(cx + aw / 2 - 18, cy - ah / 2 + 18, '★', {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: '#ffe08a',
        stroke: '#05070c',
        strokeThickness: 2,
      }).setResolution(2).setOrigin(0.5).setName('codex-favorite-marker-label').setData('cardId', card.id));
    }
    if (found && this.collectionTargets.has(card.id)) {
      layer.add(this.add.circle(cx + aw / 2 - 18, cy - ah / 2 + 54, 16, 0x28130e, 0.96)
        .setStrokeStyle(2, 0xff9b6a, 0.98)
        .setName('codex-hunt-marker')
        .setData('cardId', card.id));
      layer.add(this.add.text(cx + aw / 2 - 18, cy - ah / 2 + 54, '◎', {
        fontFamily: UI_FONT,
        fontSize: '18px',
        fontStyle: UI_BOLD,
        color: '#ffc09f',
        stroke: '#05070c',
        strokeThickness: 2,
      }).setResolution(2).setOrigin(0.5).setName('codex-hunt-marker-label').setData('cardId', card.id));
    }
  }

  private renderFavoriteEmptyState(layer: Phaser.GameObjects.Container, top: number, bottom: number) {
    const cx = GAME_WIDTH / 2;
    const cy = (top + bottom) / 2 - 6;
    layer.add(this.add.rectangle(cx, cy, 620, 248, 0x0b1521, 0.98)
      .setStrokeStyle(2, UI_FIELD.gold, 0.82)
      .setName('codex-favorites-empty-state'));
    layer.add(this.add.circle(cx, cy - 52, 38, 0x2a2211, 0.96).setStrokeStyle(2, UI_FIELD.gold, 0.9));
    layer.add(this.add.text(cx, cy - 52, '☆', {
      fontFamily: 'Georgia, serif',
      fontSize: '42px',
      color: '#ffe08a',
      stroke: '#05070c',
      strokeThickness: 3,
    }).setResolution(2).setOrigin(0.5));
    layer.add(this.add.text(cx, cy + 8, 'NO FAVORITES YET', {
      fontFamily: UI_FONT,
      fontSize: '22px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#05070c',
      strokeThickness: 3,
    }).setResolution(2).setOrigin(0.5));
    layer.add(this.add.text(
      cx,
      cy + 58,
      'Open any discovered card and choose ☆ FAVORITE.\nFavorite cards are saved locally and gathered here.',
      {
        fontFamily: UI_FONT,
        fontSize: '14px',
        color: UI_SOFT,
        align: 'center',
        lineSpacing: 5,
        wordWrap: { width: 520 },
      },
    ).setResolution(2).setOrigin(0.5));
  }

  private renderHuntListEmptyState(layer: Phaser.GameObjects.Container, top: number, bottom: number) {
    const cx = GAME_WIDTH / 2;
    const cy = (top + bottom) / 2 - 6;
    layer.add(this.add.rectangle(cx, cy, 660, 260, 0x11131a, 0.98)
      .setStrokeStyle(2, 0xff9b6a, 0.86)
      .setName('codex-hunt-empty-state'));
    layer.add(this.add.circle(cx, cy - 58, 38, 0x28130e, 0.96).setStrokeStyle(2, 0xff9b6a, 0.94));
    layer.add(this.add.text(cx, cy - 58, '◎', {
      fontFamily: UI_FONT,
      fontSize: '42px',
      fontStyle: UI_BOLD,
      color: '#ffc09f',
      stroke: '#05070c',
      strokeThickness: 3,
    }).setResolution(2).setOrigin(0.5));
    layer.add(this.add.text(cx, cy + 4, 'YOUR HUNT LIST IS OPEN', {
      fontFamily: UI_FONT,
      fontSize: '22px',
      fontStyle: UI_BOLD,
      color: '#ffc09f',
      stroke: '#05070c',
      strokeThickness: 3,
    }).setResolution(2).setOrigin(0.5));
    layer.add(this.add.text(
      cx,
      cy + 64,
      `Open a discovered, uncollected card and choose ◎ TRACK.\nKeep up to ${COLLECTION_TARGET_LIMIT} personal goals. Hunts never change reward odds.`,
      {
        fontFamily: UI_FONT,
        fontSize: '14px',
        color: UI_SOFT,
        align: 'center',
        lineSpacing: 5,
        wordWrap: { width: 560 },
      },
    ).setResolution(2).setOrigin(0.5));
  }

  private renderCardCollectionLensEmptyState(
    layer: Phaser.GameObjects.Container,
    top: number,
    bottom: number,
    lensLabel: string,
  ) {
    const cx = GAME_WIDTH / 2;
    const cy = (top + bottom) / 2 - 6;
    layer.add(this.add.rectangle(cx, cy, 610, 226, 0x0b1521, 0.98)
      .setStrokeStyle(2, UI_FIELD.cyan, 0.8)
      .setName('codex-card-lens-empty-state'));
    layer.add(this.add.text(cx, cy - 40, `${lensLabel.toUpperCase()} LENS`, {
      fontFamily: UI_FONT,
      fontSize: '22px',
      fontStyle: UI_BOLD,
      color: '#b8e8f4',
      stroke: '#05070c',
      strokeThickness: 3,
    }).setResolution(2).setOrigin(0.5));
    layer.add(this.add.text(
      cx,
      cy + 28,
      lensLabel === 'Tagged'
        ? 'No cards in this set have a personal tag yet.\nOpen a discovered card and choose PERSONAL TAG, or press V / L3.'
        : `No cards in this set match the ${lensLabel} lens.\nChoose COLLECTION LENS or press L / LB to keep browsing.`,
      {
        fontFamily: UI_FONT,
        fontSize: '14px',
        color: UI_SOFT,
        align: 'center',
        lineSpacing: 5,
        wordWrap: { width: 520 },
      },
    ).setResolution(2).setOrigin(0.5));
  }

  private renderCardSearchEmptyState(
    layer: Phaser.GameObjects.Container,
    top: number,
    bottom: number,
  ) {
    const cx = GAME_WIDTH / 2;
    const cy = (top + bottom) / 2 - 6;
    const query = this.cardSearchQuery.length > 28
      ? `${this.cardSearchQuery.slice(0, 27)}…`
      : this.cardSearchQuery;
    layer.add(this.add.rectangle(cx, cy, 650, 238, 0x0b1521, 0.98)
      .setStrokeStyle(2, UI_FIELD.cyan, 0.8)
      .setName('codex-card-search-empty-state'));
    layer.add(this.add.text(cx, cy - 46, 'NO CARDS FOUND', {
      fontFamily: UI_FONT,
      fontSize: '22px',
      fontStyle: UI_BOLD,
      color: '#b8e8f4',
      stroke: '#05070c',
      strokeThickness: 3,
    }).setResolution(2).setOrigin(0.5));
    layer.add(this.add.text(cx, cy - 10, `“${query}”`, {
      fontFamily: UI_FONT,
      fontSize: '17px',
      fontStyle: UI_BOLD,
      color: '#f5d38a',
      stroke: '#05070c',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0.5));
    layer.add(this.add.text(
      cx,
      cy + 52,
      `No cards in ${this.tabs[this.activeTab]?.label ?? 'this set'} match every search term.\nCheck spelling, remove SEARCH above, or choose CLEAR ALL.`,
      {
        fontFamily: UI_FONT,
        fontSize: '14px',
        color: UI_SOFT,
        align: 'center',
        lineSpacing: 5,
        wordWrap: { width: 560 },
      },
    ).setResolution(2).setOrigin(0.5));
  }

  private renderCardSearchControl(x: number, y: number) {
    const searchActive = this.focusZone === 'search' || this.cardSearchEditing;
    const sortActive = this.focusZone === 'sort';
    const matchingCards = this.currentCardSearchMatches();
    const matches = matchingCards.length;
    const typoToleranceUsed = matchingCards.some((card) => this.cardSearchMatch(card).usedTypoTolerance);
    const query = this.cardSearchQuery;
    const sort = this.activeCardSortMode();
    const displayQuery = query.length > 11 ? `${query.slice(0, 10)}…` : query;
    this.root.add(this.add.rectangle(x, y, CARD_SEARCH_WIDTH, CARD_SEARCH_HEIGHT, 0x0b1724, 0.98)
      .setStrokeStyle(2, UI_FIELD.cyan, searchActive || sortActive ? 0.98 : 0.66)
      .setName('codex-card-search-control'));
    this.root.add(this.add.rectangle(
      CARD_SEARCH_ACTION_X,
      y,
      CARD_SEARCH_ACTION_WIDTH - 4,
      CARD_SEARCH_HEIGHT - 4,
      searchActive ? 0x183047 : 0x0b1724,
      0.98,
    ));
    this.root.add(this.add.rectangle(
      CARD_SORT_X,
      y,
      CARD_SORT_WIDTH - 4,
      CARD_SEARCH_HEIGHT - 4,
      sortActive ? 0x3a2b13 : 0x101a25,
      0.98,
    ));
    this.root.add(this.add.rectangle(
      CARD_SEARCH_X - CARD_SEARCH_WIDTH / 2 + CARD_SEARCH_ACTION_WIDTH,
      y,
      1,
      CARD_SEARCH_HEIGHT - 8,
      UI_FIELD.cyan,
      0.42,
    ));
    const hit = this.add.rectangle(
      CARD_SEARCH_ACTION_X,
      y,
      CARD_SEARCH_ACTION_WIDTH,
      MIN_SUPPORTED_TOUCH_TARGET,
      0x020409,
      0.001,
    )
      .setInteractive({ useHandCursor: true })
      .setName('codex-card-search-hit')
      .setData('query', query);
    this.root.add(hit);
    const sortHit = this.add.rectangle(
      CARD_SORT_X,
      y,
      CARD_SORT_WIDTH,
      MIN_SUPPORTED_TOUCH_TARGET,
      0x020409,
      0.001,
    )
      .setInteractive({ useHandCursor: true })
      .setName('codex-card-sort-hit')
      .setData('sort', sort.id);
    this.root.add(sortHit);
    this.root.add(this.add.text(
      CARD_SEARCH_ACTION_X,
      y - 9,
      query ? `FIND · ${matches}${typoToleranceUsed ? ' · TYPO' : ''}` : 'FIND CARDS',
      {
      fontFamily: UI_FONT,
      fontSize: typoToleranceUsed ? '7px' : '8px',
      fontStyle: UI_BOLD,
      color: '#7f93a8',
      },
    ).setResolution(2).setOrigin(0.5).setName('codex-card-search-kicker'));
    this.root.add(this.add.text(CARD_SEARCH_ACTION_X, y + 8, query ? displayQuery : '/  OR  RB', {
      fontFamily: UI_FONT,
      fontSize: query ? '11px' : '10px',
      fontStyle: UI_BOLD,
      color: query ? '#f5d38a' : '#b8e8f4',
    }).setResolution(2).setOrigin(0.5).setName('codex-card-search-label'));
    this.root.add(this.add.text(CARD_SORT_X, y - 9, 'SORT', {
      fontFamily: UI_FONT,
      fontSize: '8px',
      fontStyle: UI_BOLD,
      color: '#7f93a8',
    }).setResolution(2).setOrigin(0.5).setName('codex-card-sort-kicker'));
    this.root.add(this.add.text(CARD_SORT_X, y + 8, sort.label.toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: sort.id === 'rarity' ? '8px' : '9px',
      fontStyle: UI_BOLD,
      color: '#f5d38a',
    }).setResolution(2).setOrigin(0.5).setName('codex-card-sort-label'));
  }

  private renderActiveCardFilters() {
    const chips = this.activeCardFilterChips();
    if (chips.length === 0) return;
    this.root.add(this.add.rectangle(580, CARD_FILTER_CHIP_Y, 1080, 52, 0x07101a, 0.98)
      .setStrokeStyle(1, UI_FIELD.cyan, 0.42)
      .setName('codex-active-filter-rail'));
    this.root.add(this.add.text(52, CARD_FILTER_CHIP_Y - 21, 'ACTIVE FILTERS  /  SELECT A CHIP TO REMOVE', {
      fontFamily: UI_FONT,
      fontSize: '8px',
      fontStyle: UI_BOLD,
      color: '#7f93a8',
    }).setResolution(2).setOrigin(0, 0.5).setName('codex-active-filter-kicker'));
    chips.forEach((chip, index) => {
      const selected = this.focusZone === 'activeFilters' && index === this.activeCardFilterIndex;
      const clearAll = chip.id === 'clear';
      const panel = this.add.rectangle(
        chip.x,
        CARD_FILTER_CHIP_Y + 3,
        chip.width,
        38,
        clearAll ? 0x2d2026 : selected ? 0x183047 : 0x0f1f2e,
        0.99,
      ).setStrokeStyle(
        selected ? 2 : 1,
        clearAll ? 0xff9b6a : selected ? UI_FIELD.gold : UI_FIELD.cyan,
        selected ? 0.98 : 0.68,
      ).setName('codex-active-filter-chip')
        .setData('filterId', chip.id)
        .setData('index', index)
        .setData('value', chip.value);
      this.root.add(panel);
      const hit = this.add.rectangle(
        chip.x,
        CARD_FILTER_CHIP_Y,
        chip.width,
        MIN_SUPPORTED_TOUCH_TARGET,
        0x020409,
        0.001,
      ).setInteractive({ useHandCursor: true })
        .setName('codex-active-filter-chip-hit')
        .setData('filterId', chip.id)
        .setData('index', index)
        .setData('value', chip.value);
      hit.on('pointerover', () => panel.setFillStyle(clearAll ? 0x4b2c35 : 0x183047, 1));
      hit.on('pointerout', () => panel.setFillStyle(
        clearAll ? 0x2d2026 : selected ? 0x183047 : 0x0f1f2e,
        0.99,
      ));
      hit.on('pointerdown', () => {
        this.focusZone = 'activeFilters';
        this.activeCardFilterIndex = index;
        this.clearActiveCardFilter(index);
      });
      this.root.add(hit);
      this.root.add(this.add.text(
        chip.x,
        CARD_FILTER_CHIP_Y + 3,
        clearAll
          ? `CLEAR ALL  ·  ${chip.value.toUpperCase()}`
          : `${chip.label.toUpperCase()}  ·  ${chip.value}   ×`,
        {
          fontFamily: UI_FONT,
          fontSize: clearAll ? '10px' : chip.value.length > 24 ? '9px' : '10px',
          fontStyle: UI_BOLD,
          color: clearAll ? '#ffd0c4' : selected ? '#ffe1a3' : '#dffbff',
          fixedWidth: chip.width - 12,
          align: 'center',
        },
      ).setResolution(2).setOrigin(0.5).setName('codex-active-filter-chip-label')
        .setData('filterId', chip.id));
    });
  }

  private renderCardCollectionLensControl(x: number, y: number) {
    const lens = this.activeCardCollectionLens();
    const lensActive = this.focusZone === 'secondaryTabs';
    const viewsActive = this.focusZone === 'savedViews' || this.savedCollectionViewsOpen;
    const lensX = x - 26;
    const viewsX = x + 52;
    this.root.add(this.add.rectangle(x, y, 156, 42, 0x0b1724, 0.98)
      .setStrokeStyle(2, UI_FIELD.cyan, lensActive || viewsActive ? 0.98 : 0.66)
      .setName('codex-card-lens-control'));
    this.root.add(this.add.rectangle(lensX, y, 102, 38, lensActive ? 0x183047 : 0x0b1724, 0.98));
    this.root.add(this.add.rectangle(viewsX, y, 50, 38, viewsActive ? 0x3a2b13 : 0x101a25, 0.98));
    this.root.add(this.add.rectangle(x + 26, y, 1, 34, UI_FIELD.cyan, 0.42));
    const hit = this.add.rectangle(lensX, y, 104, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('codex-card-lens-hit')
      .setData('lens', lens.id);
    hit.on('pointerdown', () => this.cycleCardCollectionLens(1));
    this.root.add(hit);
    const viewsHit = this.add.rectangle(viewsX, y, 52, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('codex-saved-views-hit')
      .setData('count', this.savedCollectionViews.length);
    this.root.add(viewsHit);
    this.root.add(this.add.text(lensX, y - 9, 'LENS', {
      fontFamily: UI_FONT,
      fontSize: '8px',
      fontStyle: UI_BOLD,
      color: '#7f93a8',
    }).setResolution(2).setOrigin(0.5));
    this.root.add(this.add.text(lensX, y + 8, lens.label.toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: lens.label.length > 9 ? '9px' : '11px',
      fontStyle: UI_BOLD,
      color: '#b8e8f4',
    }).setResolution(2).setOrigin(0.5).setName('codex-card-lens-label'));
    this.root.add(this.add.text(viewsX, y - 9, 'VIEWS', {
      fontFamily: UI_FONT,
      fontSize: '7px',
      fontStyle: UI_BOLD,
      color: '#7f93a8',
    }).setResolution(2).setOrigin(0.5));
    this.root.add(this.add.text(viewsX, y + 8, `${this.savedCollectionViews.length}/${CODEX_SAVED_VIEW_LIMIT}`, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: viewsActive ? '#ffe1a3' : '#b8e8f4',
    }).setResolution(2).setOrigin(0.5).setName('codex-saved-views-count'));
  }

  private renderSavedCollectionViews() {
    const current = this.currentSavedCollectionViewCriteria();
    const currentTab = CODEX_SAVED_VIEW_TABS.find((tab) => tab.id === current.tab)?.label ?? 'Cards';
    const currentLens = this.cardCollectionLenses.find((lens) => lens.id === current.lens)?.label ?? 'All';
    const currentSort = this.cardSortModes.find((sort) => sort.id === current.sort)?.label ?? 'Binder';
    const currentDescription = [
      currentTab,
      `${currentLens} lens`,
      current.query ? `“${current.query}”` : 'No search',
      `${currentSort} order`,
    ].join('  ·  ');

    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050a, 0.88)
      .setInteractive()
      .setName('codex-saved-views-scrim');
    scrim.on('pointerdown', () => this.closeSavedCollectionViews());
    this.root.add(scrim);

    const panel = this.add.rectangle(640, 358, 1040, 584, 0x09131f, 0.995)
      .setStrokeStyle(2, UI_FIELD.cyan, 0.9)
      .setInteractive()
      .setName('codex-saved-views-panel');
    this.root.add(panel);
    this.root.add(this.add.text(140, 88, 'SAVED COLLECTION VIEWS', {
      fontFamily: 'Georgia, serif',
      fontSize: '30px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#000000',
      strokeThickness: 4,
    }).setResolution(2));
    this.root.add(this.add.text(142, 124, 'Keep up to four reusable combinations of set, lens, search, and sorting.', {
      fontFamily: UI_FONT,
      fontSize: '13px',
      color: '#b7c8d8',
    }).setResolution(2));
    this.renderCodexCloseControl(1130, 102, () => this.closeSavedCollectionViews());

    this.root.add(this.add.rectangle(530, 170, 760, 58, 0x07101a, 0.98)
      .setStrokeStyle(1, UI_FIELD.gold, 0.48));
    this.root.add(this.add.text(166, 151, 'CURRENT VIEW', {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: '#8df4ff',
    }).setResolution(2));
    this.root.add(this.add.text(166, 171, currentDescription, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: '#dffbff',
      fixedWidth: 700,
    }).setResolution(2));
    this.renderSavedCollectionViewButton(
      1028,
      170,
      210,
      this.savedCollectionViews.length >= CODEX_SAVED_VIEW_LIMIT ? 'SHELF FULL' : 'SAVE CURRENT',
      'CTRL+S  /  X',
      () => this.saveCurrentCollectionView(),
      'codex-saved-view-save-hit',
      this.savedCollectionViews.length >= CODEX_SAVED_VIEW_LIMIT,
    );

    if (this.savedCollectionViews.length === 0) {
      this.root.add(this.add.rectangle(640, 360, 920, 216, 0x0b1826, 0.98)
        .setStrokeStyle(1, UI_FIELD.cyan, 0.42));
      this.root.add(this.add.text(640, 330, 'NO SAVED VIEWS YET', {
        fontFamily: UI_FONT,
        fontSize: '20px',
        fontStyle: UI_BOLD,
        color: '#dffbff',
      }).setResolution(2).setOrigin(0.5));
      this.root.add(this.add.text(
        640,
        376,
        'Set up the card shelf you want, then save it here.\nSaved views are private conveniences. They never change drops, ownership, or card power.',
        {
          fontFamily: UI_FONT,
          fontSize: '13px',
          color: UI_SOFT,
          align: 'center',
          lineSpacing: 7,
          wordWrap: { width: 700 },
        },
      ).setResolution(2).setOrigin(0.5));
    } else {
      this.savedCollectionViews.forEach((view, index) => {
        const y = 260 + index * 74;
        const selected = index === this.savedCollectionViewIndex;
        const tab = CODEX_SAVED_VIEW_TABS.find((candidate) => candidate.id === view.tab)?.label ?? 'Cards';
        const lens = this.cardCollectionLenses.find((candidate) => candidate.id === view.lens)?.label ?? 'All';
        const sort = this.cardSortModes.find((candidate) => candidate.id === view.sort)?.label ?? 'Binder';
        const row = this.add.rectangle(640, y, 920, 62, selected ? 0x173148 : 0x0b1826, 0.98)
          .setStrokeStyle(selected ? 2 : 1, selected ? UI_FIELD.gold : UI_FIELD.cyan, selected ? 0.94 : 0.38)
          .setName('codex-saved-view-row')
          .setData('viewId', view.id)
          .setData('index', index);
        this.root.add(row);
        const hit = this.add.rectangle(640, y, 920, 62, 0x020409, 0.001)
          .setInteractive({ useHandCursor: true })
          .setName('codex-saved-view-row-hit')
          .setData('viewId', view.id)
          .setData('index', index);
        hit.on('pointerdown', () => {
          this.savedCollectionViewIndex = index;
          this.savedCollectionViewStatus = 'idle';
          playUiSound('confirm');
          this.renderAll();
        });
        this.root.add(hit);
        this.root.add(this.add.text(204, y - 17, `${index + 1}`.padStart(2, '0'), {
          fontFamily: UI_FONT,
          fontSize: '10px',
          fontStyle: UI_BOLD,
          color: selected ? '#ffe1a3' : '#7f93a8',
        }).setResolution(2));
        this.root.add(this.add.text(244, y - 18, view.name.toUpperCase(), {
          fontFamily: UI_FONT,
          fontSize: '13px',
          fontStyle: UI_BOLD,
          color: selected ? '#ffe1a3' : '#dffbff',
          fixedWidth: 700,
        }).setResolution(2));
        this.root.add(this.add.text(
          244,
          y + 7,
          `${tab}  ·  ${lens} lens  ·  ${view.query ? `“${view.query}”` : 'No search'}  ·  ${sort} order`,
          {
            fontFamily: UI_FONT,
            fontSize: '10px',
            color: '#91a6b8',
            fixedWidth: 760,
          },
        ).setResolution(2));
      });
    }

    const hasSelection = this.savedCollectionViews.length > 0;
    this.renderSavedCollectionViewButton(
      360,
      588,
      280,
      hasSelection ? 'APPLY SELECTED' : 'SAVE FIRST VIEW',
      hasSelection ? `${controlBindingLabel('confirm')}  /  A` : 'CTRL+S  /  X',
      () => hasSelection ? this.applySelectedCollectionView() : this.saveCurrentCollectionView(),
      'codex-saved-view-apply-hit',
      false,
    );
    this.renderSavedCollectionViewButton(
      680,
      588,
      280,
      'REMOVE SELECTED',
      'DELETE  /  Y',
      () => this.deleteSelectedCollectionView(),
      'codex-saved-view-delete-hit',
      !hasSelection,
    );
    this.renderSavedCollectionViewButton(
      1000,
      588,
      280,
      'CLOSE',
      `B  /  SELECT  /  ${controlBindingLabel('back')}`,
      () => this.closeSavedCollectionViews(),
      'codex-saved-view-close-hit',
      false,
    );

    const status: Record<typeof this.savedCollectionViewStatus, string> = {
      idle: `${this.savedCollectionViews.length}/${CODEX_SAVED_VIEW_LIMIT} saved  ·  Included in complete save backups  ·  Never affects power`,
      saved: 'View saved. The current combination now has a permanent shortcut.',
      duplicate: 'That exact combination is already saved and selected.',
      full: 'The four-view shelf is full. Remove one before saving another.',
      deleted: 'Saved view removed. Card ownership and collection data were untouched.',
      applied: 'Saved view applied.',
      failed: 'Could not write this view safely. Nothing was changed.',
    };
    this.root.add(this.add.text(640, 636, status[this.savedCollectionViewStatus], {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: this.savedCollectionViewStatus === 'failed' || this.savedCollectionViewStatus === 'full'
        ? '#ffb38a'
        : this.savedCollectionViewStatus === 'saved'
          ? '#ffe1a3'
          : '#91cbdc',
      fixedWidth: 980,
      align: 'center',
    }).setResolution(2).setOrigin(0.5));
  }

  private renderSavedCollectionViewButton(
    x: number,
    y: number,
    width: number,
    label: string,
    shortcut: string,
    onClick: () => void,
    name: string,
    disabled: boolean,
  ) {
    const panel = this.add.rectangle(x, y, width, 52, disabled ? 0x111722 : 0x102235, 0.98)
      .setStrokeStyle(1, disabled ? 0x46515f : UI_FIELD.cyan, disabled ? 0.45 : 0.72);
    this.root.add(panel);
    const hit = this.add.rectangle(x, y, width, 52, 0x020409, 0.001)
      .setInteractive({ useHandCursor: !disabled })
      .setName(name);
    if (!disabled) {
      hit.on('pointerover', () => panel.setFillStyle(0x183047, 1));
      hit.on('pointerout', () => panel.setFillStyle(0x102235, 0.98));
      hit.on('pointerdown', onClick);
    }
    this.root.add(hit);
    this.root.add(this.add.text(x, y - 8, label, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: disabled ? '#6f7b88' : '#dffbff',
    }).setResolution(2).setOrigin(0.5));
    this.root.add(this.add.text(x, y + 10, shortcut, {
      fontFamily: UI_FONT,
      fontSize: '8px',
      fontStyle: UI_BOLD,
      color: disabled ? '#59636e' : '#91cbdc',
    }).setResolution(2).setOrigin(0.5));
  }

  private waymarkAccent(mark: RuntimeRouteMark) {
    switch (mark.family) {
      case 'safety': return 0x8fd6a0;
      case 'route': return 0x7ab8d6;
      case 'economy': return 0xe8c24a;
      case 'suit': return 0xc9a6ff;
      case 'molt': return 0xff9b6a;
      case 'bossPrep': return 0xff6b57;
      default: return 0x8fa3b6;
    }
  }

  private waymarkFamilyLabel(mark: RuntimeRouteMark) {
    switch (mark.family) {
      case 'safety': return 'Shelter';
      case 'route': return 'Tempo';
      case 'economy': return 'Economy';
      case 'suit': return 'Suit Engine';
      case 'molt': return 'Molt';
      case 'bossPrep': return 'Boss';
      default: return mark.family;
    }
  }

  private supplyAccent(supply: RuntimeSupply) {
    switch (supply.category) {
      case 'snack': return 0x8fd6a0;
      case 'flare': return 0xffb86b;
      case 'tool': return 0x7ab8d6;
      case 'call': return 0xc9a6ff;
      default: return 0x8fa3b6;
    }
  }

  private supplyCategoryLabel(supply: RuntimeSupply) {
    switch (supply.category) {
      case 'snack': return 'Snack';
      case 'flare': return 'Flare';
      case 'tool': return 'Tool';
      case 'call': return 'Call';
      default: return supply.category;
    }
  }

  private supplyTimingLabel(supply: RuntimeSupply) {
    switch (supply.timing) {
      case 'combat': return 'Combat';
      case 'route': return 'Route';
      case 'either': return 'Either';
      default: return supply.timing;
    }
  }

  private supplyAnswerLabel(supply: RuntimeSupply) {
    switch (supply.answerType) {
      case 'coverNow': return 'Cover';
      case 'drawNow': return 'Draw';
      case 'wingbeatNow': return 'Wingbeat';
      case 'healNow': return 'Healing';
      case 'openSkySafety': return 'Open Sky';
      case 'tellControl': return 'Plan';
      case 'damageNow': return 'Damage';
      case 'antiCover': return 'Anti-Cover';
      case 'cleanseNow': return 'Cleanse';
      case 'handFix': return 'Hand Fix';
      case 'moltNow': return 'Molt';
      case 'burstNow': return 'Burst';
      default: return supply.answerType;
    }
  }

  private supplyGlyph(supply: RuntimeSupply) {
    switch (supply.category) {
      case 'snack': return 'S';
      case 'flare': return 'F';
      case 'tool': return 'T';
      case 'call': return 'C';
      default: return '?';
    }
  }

  private renderSupplyThumb(layer: Phaser.GameObjects.Container, supply: RuntimeSupply, cx: number, cy: number) {
    const w = 330;
    const h = 126;
    const accent = this.supplyAccent(supply);
    const bg = this.add.rectangle(cx, cy, w, h, 0x0d1720, 0.96)
      .setStrokeStyle(2, accent, 0.9)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x142334, 0.98));
    bg.on('pointerout', () => bg.setFillStyle(0x0d1720, 0.96));
    bg.on('pointerdown', () => this.openCodexDetail(supply.id));
    layer.add(bg);
    addCodexEntryFrame(this, (obj) => layer.add(obj), { cx, cy, w, h }, {
      alpha: 0.36,
      padX: 18,
      padY: 16,
    });
    layer.add(this.add.rectangle(cx, cy - h / 2 + 7, w - 16, 4, accent, 0.82));
    const artAsset = supplyCompactArtAssets[supply.id];
    if (artAsset && this.textures.exists(artAsset.key)) {
      layer.add(addSupplyArtImage(this, cx - 132, cy - 20, artAsset.key).setDisplaySize(64, 64));
    } else {
      layer.add(this.add.text(cx - 132, cy - 20, this.supplyGlyph(supply), {
        fontFamily: UI_FONT, fontSize: '22px', fontStyle: UI_BOLD, color: '#e7eef7'
      }).setOrigin(0.5));
    }
    layer.add(this.add.text(cx - 90, cy - 50, supply.name, {
      fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: 238 }, maxLines: 1,
    }).setOrigin(0, 0));
    layer.add(this.add.text(cx - 90, cy - 24, `${this.supplyCategoryLabel(supply)} / ${supply.rarity}  ·  ${this.supplyTimingLabel(supply)} / ${this.supplyAnswerLabel(supply)}`, {
      fontFamily: UI_FONT, fontSize: '10px', fontStyle: UI_BOLD, color: UI_CYAN,
      wordWrap: { width: 238 }, maxLines: 1,
    }).setOrigin(0, 0));
    layer.add(this.add.text(cx - 90, cy + 4, compactEffectSummary(supply.effects, 82), {
      fontFamily: UI_FONT, fontSize: '12px', color: UI_BODY,
      wordWrap: { width: 238 }, maxLines: 2,
    }).setOrigin(0, 0));
  }

  private renderSupplyDetail(id: string) {
    const supply = alphaSupplyLibrary.get(id);
    if (!supply) return;
    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.76).setInteractive();
    scrim.on('pointerdown', () => this.closeCodexDetail());
    this.root.add(scrim);

    const px = GAME_WIDTH / 2;
    const py = GAME_HEIGHT / 2;
    const MW = 780;
    const MH = 560;
    const left = px - MW / 2;
    const top = py - MH / 2;
    const accent = this.supplyAccent(supply);
    const accentText = `#${accent.toString(16).padStart(6, '0')}`;
    const artAsset = supplyArtAssets[supply.id];
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x0c1420, 0.995).setStrokeStyle(2, accent, 1));
    addCodexDossierFrame(this, (obj) => this.root.add(obj), { cx: px, cy: py, w: MW, h: MH }, { alpha: 0.88 });
    if (artAsset && this.textures.exists(artAsset.key)) {
      this.root.add(addSupplyArtImage(this, left + 92, top + 92, artAsset.key).setDisplaySize(126, 126));
    } else {
      this.root.add(this.add.text(left + 92, top + 91, this.supplyGlyph(supply), {
        fontFamily: UI_FONT, fontSize: '38px', fontStyle: UI_BOLD, color: '#e7eef7'
      }).setOrigin(0.5));
    }

    const tx = left + 168;
    const wrap = MW - 214;
    let yy = top + 48;
    this.root.add(this.add.text(tx, yy, supply.name, {
      fontFamily: UI_FONT, fontSize: '30px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: wrap }
    }));
    yy += 42;
    this.root.add(this.add.text(tx, yy, `${this.supplyCategoryLabel(supply)} Supply / ${supply.rarity} / ${this.supplyTimingLabel(supply)}`, {
      fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_MUTED,
      wordWrap: { width: wrap }
    }));
    yy += 28;
    this.root.add(this.add.text(tx, yy, 'TAGS', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 22;
    this.addCodexTagRow(this.root, tx, yy, supplySynergyTags(supply), accent, wrap, true);
    yy += 34;
    this.root.add(this.add.text(tx, yy, 'USE', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    const effect = this.add.text(tx, yy, supply.description, {
      fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: '#cfe0ef',
      lineSpacing: 4, wordWrap: { width: wrap }
    });
    this.root.add(effect);
    yy += effect.height + 24;
    this.root.add(this.add.text(tx, yy, 'SUMMARY', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    const summary = this.add.text(tx, yy, compactEffectSummary(supply.effects, 168, 2), {
      fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: '#ffe1a3',
      lineSpacing: 3, wordWrap: { width: wrap }, maxLines: 3
    });
    this.root.add(summary);
    yy += summary.height + 18;
    this.root.add(this.add.text(tx, yy, 'RULES', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    this.root.add(this.add.text(tx, yy, supply.effects.join(' -> '), {
      fontFamily: UI_FONT, fontSize: '13px', color: '#9fb1c4',
      wordWrap: { width: wrap },
      maxLines: 2
    }));
    yy += 38;
    this.root.add(this.add.text(tx, yy, 'ROLE', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    this.root.add(this.add.text(tx, yy, `${this.supplyAnswerLabel(supply)} answer. Can be packed in a supply slot and consumed once.`, {
      fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'italic', color: '#d9c8ff',
      lineSpacing: 4, wordWrap: { width: wrap }
    }));
    this.renderCodexCloseControl(left + MW - 30, top + 30, () => this.closeCodexDetail());
  }

  private renderWaymarkThumb(layer: Phaser.GameObjects.Container, mark: RuntimeRouteMark, cx: number, cy: number) {
    const w = 330;
    const h = 126;
    const accent = this.waymarkAccent(mark);
    const bg = this.add.rectangle(cx, cy, w, h, 0x0d1420, 0.96)
      .setStrokeStyle(2, accent, 0.9)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x142033, 0.98));
    bg.on('pointerout', () => bg.setFillStyle(0x0d1420, 0.96));
    bg.on('pointerdown', () => this.openCodexDetail(mark.id));
    layer.add(bg);
    addCodexEntryFrame(this, (obj) => layer.add(obj), { cx, cy, w, h }, {
      alpha: 0.36,
      padX: 18,
      padY: 16,
    });
    layer.add(this.add.rectangle(cx, cy - h / 2 + 7, w - 16, 4, accent, 0.82));

    const artAsset = waymarkCompactArtAssets[mark.id];
    if (artAsset && this.textures.exists(artAsset.key)) {
      layer.add(addWaymarkArtImage(this, cx - 132, cy - 20, artAsset.key).setDisplaySize(64, 64));
    } else {
      layer.add(this.add.text(cx - 132, cy - 20, waymarkGlyph(mark), {
        fontFamily: UI_FONT, fontSize: '22px', fontStyle: UI_BOLD, color: '#e7eef7'
      }).setOrigin(0.5));
    }
    layer.add(this.add.text(cx - 90, cy - 50, mark.name, {
      fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: 238 }, maxLines: 1,
    }).setOrigin(0, 0));
    layer.add(this.add.text(cx - 90, cy - 24, `${this.waymarkFamilyLabel(mark)} / ${mark.rarity}  ·  ${mark.source}`, {
      fontFamily: UI_FONT, fontSize: '10px', fontStyle: UI_BOLD, color: UI_CYAN,
      wordWrap: { width: 238 }, maxLines: 1,
    }).setOrigin(0, 0));
    layer.add(this.add.text(cx - 90, cy + 4, compactEffectSummary(routeMarkEffectText(mark), 82), {
      fontFamily: UI_FONT, fontSize: '12px', color: UI_BODY,
      wordWrap: { width: 238 }, maxLines: 2,
    }).setOrigin(0, 0));
  }

  private renderWaymarkDetail(id: string) {
    const mark = alphaRouteMarkLibrary.get(id);
    if (!mark) return;
    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.76).setInteractive();
    scrim.on('pointerdown', () => this.closeCodexDetail());
    this.root.add(scrim);

    const px = GAME_WIDTH / 2;
    const py = GAME_HEIGHT / 2;
    const MW = 780;
    const MH = 520;
    const left = px - MW / 2;
    const top = py - MH / 2;
    const accent = this.waymarkAccent(mark);
    const accentText = `#${accent.toString(16).padStart(6, '0')}`;
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x0c1420, 0.995).setStrokeStyle(2, accent, 1));
    addCodexDossierFrame(this, (obj) => this.root.add(obj), { cx: px, cy: py, w: MW, h: MH }, { alpha: 0.88 });
    const artAsset = waymarkArtAssets[mark.id];
    if (artAsset && this.textures.exists(artAsset.key)) {
      this.root.add(addWaymarkArtImage(this, left + 92, top + 92, artAsset.key).setDisplaySize(126, 126));
    } else {
      this.root.add(this.add.text(left + 92, top + 91, waymarkGlyph(mark), {
        fontFamily: UI_FONT, fontSize: '36px', fontStyle: UI_BOLD, color: '#e7eef7'
      }).setOrigin(0.5));
    }

    const tx = left + 168;
    const wrap = MW - 214;
    let yy = top + 48;
    this.root.add(this.add.text(tx, yy, mark.name, {
      fontFamily: UI_FONT, fontSize: '30px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: wrap }
    }));
    yy += 42;
    this.root.add(this.add.text(tx, yy, `${this.waymarkFamilyLabel(mark)} Waymark / ${mark.rarity} / ${mark.source}`, {
      fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_MUTED,
      wordWrap: { width: wrap }
    }));
    yy += 28;
    this.root.add(this.add.text(tx, yy, 'TAGS', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 22;
    this.addCodexTagRow(this.root, tx, yy, waymarkSynergyTags(mark), accent, wrap, true);
    yy += 34;
    this.root.add(this.add.text(tx, yy, 'EFFECT', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    const effect = this.add.text(tx, yy, mark.description, {
      fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: '#cfe0ef',
      lineSpacing: 4, wordWrap: { width: wrap }
    });
    this.root.add(effect);
    yy += effect.height + 24;
    this.root.add(this.add.text(tx, yy, 'SUMMARY', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    const summary = this.add.text(tx, yy, compactEffectSummary(routeMarkEffectText(mark), 168, 2), {
      fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: '#ffe1a3',
      lineSpacing: 3, wordWrap: { width: wrap }, maxLines: 3
    });
    this.root.add(summary);
    yy += summary.height + 18;
    this.root.add(this.add.text(tx, yy, 'TRIGGER', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    this.root.add(this.add.text(tx, yy, `${mark.trigger} -> ${routeMarkEffectGrammar(mark)}`, {
      fontFamily: UI_FONT, fontSize: '13px', color: '#9fb1c4',
      wordWrap: { width: wrap },
      maxLines: 2
    }));
    yy += 38;
    this.root.add(this.add.text(tx, yy, 'OBJECT', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    const flavor = this.add.text(tx, yy, mark.flavorText ?? 'A real route artifact carried by the flock.', {
      fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'italic', color: '#d9c8ff',
      lineSpacing: 4, wordWrap: { width: wrap }
    });
    this.root.add(flavor);

    this.renderCodexCloseControl(left + MW - 30, top + 30, () => this.closeCodexDetail());
  }

  private leaderAccent(leader: typeof flockLeaders[number]) {
    switch (leader.suit) {
      case 'Plumes': return 0xf2a54a;
      case 'Quills': return 0x9fb7d7;
      case 'Basins': return 0x2fc6c9;
      case 'Nests': return 0xe8c24a;
      default: return 0x8fd6a0;
    }
  }

  private renderLeaderThumb(layer: Phaser.GameObjects.Container, leader: typeof flockLeaders[number], cx: number, cy: number) {
    const account = loadAccount();
    const unlocked = isLeaderUnlocked(account, leader.id);
    const wins = account.winsByLeader[leader.id] ?? 0;
    const lore = this.codexData?.getLeaderLore(leader.id);
    const w = 332;
    const h = 214;
    const accent = this.leaderAccent(leader);
    const bg = this.add.rectangle(cx, cy, w, h, unlocked ? 0x0d1420 : 0x0a0d13, unlocked ? 0.98 : 0.92)
      .setStrokeStyle(2, unlocked ? accent : 0x2a3a4d, unlocked ? 0.9 : 0.72)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(unlocked ? 0x142033 : 0x0d1420, unlocked ? 1 : 0.94));
    bg.on('pointerout', () => bg.setFillStyle(unlocked ? 0x0d1420 : 0x0a0d13, unlocked ? 0.98 : 0.92));
    bg.on('pointerdown', () => this.openCodexDetail(leader.id));
    layer.add(bg);
    addCodexEntryFrame(this, (obj) => layer.add(obj), { cx, cy, w, h }, {
      alpha: unlocked ? 0.42 : 0.26,
      tint: unlocked ? undefined : 0x7f93a8,
      padX: 20,
      padY: 18
    });
    layer.add(this.add.rectangle(cx, cy - h / 2 + 8, w - 18, 4, unlocked ? accent : 0x2a3a4d, unlocked ? 0.84 : 0.6));

    const art = codexLeaderArtAssets[leader.id];
    if (art && this.textures.exists(art.key)) {
      const fit = this.fittedTextureSize(art.key, 132, 160);
      layer.add(this.add.image(cx - 104, cy - 8, art.key).setDisplaySize(fit.w, fit.h).setAlpha(unlocked ? 0.99 : 0.38));
    } else {
      layer.add(this.add.rectangle(cx - 104, cy - 8, 116, 154, 0x141d2b, 0.9).setStrokeStyle(1, 0x2a3a4d, 0.8));
      layer.add(this.add.text(cx - 104, cy - 12, leader.bird, {
        fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_BODY,
        align: 'center', wordWrap: { width: 98 }
      }).setOrigin(0.5));
    }

    layer.add(this.add.text(cx + 26, cy - 86, leader.name, {
      fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: unlocked ? '#ffe1a3' : '#6f7d8c',
      wordWrap: { width: 176 }
    }).setOrigin(0.5, 0));
    layer.add(this.add.text(cx + 26, cy - 42, lore?.epithet ?? leader.signatureName, {
      fontFamily: 'Georgia, serif', fontSize: '13px', fontStyle: 'italic', color: unlocked ? '#d9c8ff' : '#657385',
      align: 'center', wordWrap: { width: 176 }
    }).setOrigin(0.5, 0));
    this.addCodexChip(layer, cx - 24, cy + 8, 86, leader.suit, accent, unlocked);
    this.addCodexChip(layer, cx + 72, cy + 8, 86, unlocked ? 'Rallied' : 'Locked', accent, unlocked);
    layer.add(this.add.text(cx + 26, cy + 20, lore?.codexSummary ?? leader.blurb, {
      fontFamily: UI_FONT, fontSize: '12px', color: unlocked ? '#cdd9e6' : '#7f93a8',
      align: 'center', wordWrap: { width: 178 }
    }).setOrigin(0.5, 0));
    layer.add(this.add.text(cx + 26, cy + 76, unlocked ? `${wins} ${wins === 1 ? 'win' : 'wins'}` : 'Locked', {
      fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: unlocked ? '#ffe1a3' : '#6f7d8c',
      align: 'center', wordWrap: { width: 176 }
    }).setOrigin(0.5, 0));
  }

  private renderLeaderDetail(id: string) {
    const leader = getLeader(id);
    const lore = this.codexData?.getLeaderLore(leader.id);
    if (!lore) return;
    const account = loadAccount();
    const unlocked = isLeaderUnlocked(account, leader.id);
    const wins = account.winsByLeader[leader.id] ?? 0;
    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.76).setInteractive();
    scrim.on('pointerdown', () => this.closeCodexDetail());
    this.root.add(scrim);

    const px = GAME_WIDTH / 2;
    const py = GAME_HEIGHT / 2;
    const MW = 980;
    const MH = 624;
    const left = px - MW / 2;
    const right = px + MW / 2;
    const mTop = py - MH / 2;
    const mBottom = py + MH / 2;
    const accent = this.leaderAccent(leader);
    const accentText = `#${accent.toString(16).padStart(6, '0')}`;
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x0c1420, 0.995).setStrokeStyle(2, accent, 1));
    addCodexDossierFrame(this, (obj) => this.root.add(obj), { cx: px, cy: py, w: MW, h: MH }, { alpha: 0.9 });

    const art = codexLeaderArtAssets[leader.id];
    const artBoxX = left + 205;
    const artBoxY = py + 24;
    this.renderCodexArtPreviewBacking(artBoxX, artBoxY, 348, 516, accent);
    if (art && this.textures.exists(art.key)) {
      const fit = this.fittedTextureSize(art.key, 340, 500);
      this.root.add(this.add.image(artBoxX, artBoxY, art.key).setDisplaySize(fit.w, fit.h).setAlpha(unlocked ? 0.99 : 0.42));
    } else {
      this.root.add(this.add.rectangle(artBoxX, artBoxY, 320, 480, 0x141d2b, 0.9).setStrokeStyle(1, 0x2a3a4d, 0.8));
      this.root.add(this.add.text(artBoxX, artBoxY, leader.bird, {
        fontFamily: UI_FONT, fontSize: '20px', fontStyle: UI_BOLD, color: UI_BODY,
        align: 'center', wordWrap: { width: 260 }
      }).setOrigin(0.5));
    }
    this.renderCodexArtPreviewFrame(artBoxX, artBoxY, 348, 516, unlocked ? 0.82 : 0.52);
    if (!unlocked) {
      this.root.add(this.add.rectangle(artBoxX, artBoxY + 224, 260, 36, 0x05070c, 0.8).setStrokeStyle(1, 0x2a3a4d, 0.85));
      this.root.add(this.add.text(artBoxX, artBoxY + 224, leaderUnlockHints[leader.id] ?? 'Locked', {
        fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_GOLD,
        align: 'center', wordWrap: { width: 238 }
      }).setOrigin(0.5));
    }

    const tx = left + 410;
    const wrap = right - tx - 118;
    const viewTop = mTop + 86;
    const viewBottom = mBottom - 124;
    const viewH = viewBottom - viewTop;
    let yy = viewTop - this.detailScroll;
    const heading = (t: string, color: string) => {
      this.root.add(this.add.text(tx, yy, t, { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color }));
      yy += 17;
    };
    const para = (t: string, opts: { color?: string; size?: number; italic?: boolean; bold?: boolean } = {}) => {
      const o = this.add.text(tx, yy, t, {
        fontFamily: opts.italic ? 'Georgia, serif' : 'Arial',
        fontSize: `${opts.size ?? 13}px`,
        fontStyle: opts.bold ? 'bold' : opts.italic ? 'italic' : 'normal',
        color: opts.color ?? '#cfe0ef',
        lineSpacing: 3,
        wordWrap: { width: wrap }
      });
      this.root.add(o);
      yy += o.height;
    };

    this.root.add(this.add.text(tx, yy, leader.name, {
      fontFamily: UI_FONT, fontSize: '29px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: wrap }
    }));
    yy += 38;
    this.root.add(this.add.text(tx, yy, lore.epithet, {
      fontFamily: 'Georgia, serif', fontSize: '17px', fontStyle: 'italic', color: '#d9c8ff',
      wordWrap: { width: wrap }
    }));
    yy += 29;
    this.root.add(this.add.text(tx, yy, `${leader.bird} / ${leader.suit} Leader / ${unlocked ? `${wins} career ${wins === 1 ? 'win' : 'wins'}` : 'Locked'}`, {
      fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_MUTED,
      wordWrap: { width: wrap }
    }));
    yy += 28;

    heading('ROLE', accentText);
    para(lore.flockRole, { size: 14, bold: true, color: '#dbe6f0' });
    yy += 12;

    heading('BACKSTORY', '#7f93a8');
    para(lore.backstory, { size: 13 });
    yy += 12;

    heading('NARRATIVE BEATS', '#8df4ff');
    lore.narrativeBeats.forEach((beat) => {
      para(`- ${beat}`, { size: 13, color: '#dbe6f0' });
      yy += 5;
    });
    yy += 8;

    heading('COMBAT READ', '#e8c24a');
    para(lore.playstyleRead, { size: 13, bold: true, color: UI_GOLD });
    yy += 12;

    heading('SIGNATURE', '#c9a6ff');
    para(`${leader.signatureName}: ${leader.signatureText}`, { size: 13, color: '#d9c8ff' });
    yy += 12;

    heading('STARTING DECK', '#7f93a8');
    const starterNames = leader.startingDeckIds
      .map((cardId) => cardLibrary[cardId])
      .filter((card): card is Card => Boolean(card))
      .map((card) => displayName(card));
    para(starterNames.join(' / '), { size: 12, color: UI_SOFT });
    yy += 12;

    heading(unlocked ? 'FIELD QUOTE' : 'LOCKED NOTE', unlocked ? '#8fd6a0' : '#ff9b6a');
    para(unlocked ? `"${lore.quote}"` : lore.unlockFlavor, { size: 14, italic: true, color: unlocked ? '#bfe9cc' : '#ffd5cc' });

    const contentBottom = yy + this.detailScroll;
    const SCROLL_PAD = 16;
    this.detailMaxScroll = Math.max(0, (contentBottom - viewTop) - viewH + SCROLL_PAD);
    this.detailScrollTarget = clamp(this.detailScrollTarget, 0, this.detailMaxScroll);
    this.detailScroll = clamp(this.detailScroll, 0, this.detailMaxScroll);

    const closeDetail = () => this.closeCodexDetail();
    const curtainX = tx - 24;
    const curtainW = right - curtainX - 1;
    this.root.add(this.add.rectangle(0, 0, GAME_WIDTH, mTop, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(0, mBottom, GAME_WIDTH, GAME_HEIGHT - mBottom, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(curtainX, mTop + 1, curtainW, viewTop - mTop - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(curtainX, viewBottom, curtainW, mBottom - viewBottom - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x000000, 0).setStrokeStyle(2, accent, 1));
    this.renderCodexDossierHeader(left, right, mTop, 'FLOCK LEADER DOSSIER', `ID ${leader.id.toUpperCase().replace(/_/g, '-')}`, accent, accentText);
    this.root.add(this.add.rectangle(tx - 18, (viewTop + viewBottom) / 2, 2, viewH - 8, accent, 0.5));

    if (this.detailMaxScroll > 0) {
      this.renderCodexScrollCue(right - 64, mBottom - 18, this.detailScroll >= this.detailMaxScroll);
    }

    this.renderCodexCloseControl(right - 26, mTop + 26, closeDetail);
  }

  private fittedTextureSize(key: string, maxW: number, maxH: number) {
    const src = this.textures.get(key).getSourceImage() as { width?: number; height?: number };
    const iw = Math.max(1, src.width ?? maxW);
    const ih = Math.max(1, src.height ?? maxH);
    const scale = Math.min(maxW / iw, maxH / ih);
    return { w: iw * scale, h: ih * scale };
  }

  private renderCodexArtPreviewBacking(cx: number, cy: number, w: number, h: number, accent: number) {
    const key = uiIconAssets['codex-art-preview-frame'].key;
    const hasFrame = this.textures.exists(key);
    this.root.add(this.add.rectangle(cx, cy, w, h, 0x05080e, hasFrame ? 0.42 : 0.78)
      .setStrokeStyle(hasFrame ? 1 : 2, accent, hasFrame ? 0.28 : 0.72));
  }

  private renderCodexArtPreviewFrame(cx: number, cy: number, w: number, h: number, alpha = 0.86) {
    const key = uiIconAssets['codex-art-preview-frame'].key;
    const hasFrame = this.textures.exists(key);
    if (!hasFrame) return;
    this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const frame = this.add.image(cx, cy, key)
      .setDisplaySize(w + 24, h + 40)
      .setAlpha(alpha)
      .setName('codex-art-preview-frame');
    this.root.add(frame);
  }

  private textureVisibleBounds(key: string): TextureVisibleBounds {
    const cached = this.textureBoundsCache.get(key);
    if (cached) return cached;

    const src = this.textures.get(key).getSourceImage() as CanvasImageSource & { width?: number; height?: number };
    const width = Math.max(1, Number(src.width ?? 1));
    const height = Math.max(1, Number(src.height ?? 1));
    let bounds: TextureVisibleBounds = { left: 0, right: 1, top: 0, bottom: 1 };

    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(src, 0, 0, width, height);
        const alpha = ctx.getImageData(0, 0, width, height).data;
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        const alphaThreshold = 28;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (alpha[(y * width + x) * 4 + 3] <= alphaThreshold) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
        if (maxX >= minX && maxY >= minY) {
          bounds = {
            left: minX / width,
            right: (maxX + 1) / width,
            top: minY / height,
            bottom: (maxY + 1) / height,
          };
        }
      }
    } catch {
      // Fall back to the full texture box if the browser refuses pixel reads.
    }

    this.textureBoundsCache.set(key, bounds);
    return bounds;
  }

  private enemyShadowMetrics(key: string, imageX: number, imageY: number, fitW: number, fitH: number, maxW: number, maxH: number) {
    const bounds = this.textureVisibleBounds(key);
    const visibleW = fitW * Math.max(0.05, bounds.right - bounds.left);
    const visibleH = fitH * Math.max(0.05, bounds.bottom - bounds.top);
    const visibleCenterX = imageX - fitW / 2 + fitW * ((bounds.left + bounds.right) / 2);
    const visibleBottom = imageY - fitH / 2 + fitH * bounds.bottom;
    const shadowW = Math.max(maxW * 0.34, Math.min(maxW * 0.84, visibleW * 0.78));
    const shadowH = Math.max(8, Math.min(maxH * 0.18, visibleH * 0.11));
    return {
      x: visibleCenterX,
      y: Math.min(imageY + maxH / 2 - shadowH * 0.45, visibleBottom - shadowH * 0.18),
      w: shadowW,
      h: shadowH,
    };
  }

  private enemyArtAsset(enemy: CodexEnemyEntry) {
    return enemy.source === 'reserve' ? reserveEnemyArtAsset(enemy.id) : enemyArtAssets[enemy.id];
  }

  private renderEnemyThumb(layer: Phaser.GameObjects.Container, enemy: CodexEnemyEntry, cx: number, cy: number) {
    const w = 252;
    const h = 206;
    const accent = this.enemyAccent(enemy);
    const artX = cx - 68;
    const artY = cy - 22;
    const artW = 108;
    const artH = 124;
    const textX = cx + 42;
    const textW = 122;
    const bg = this.add.rectangle(cx, cy, w, h, 0x0d1420, 0.96)
      .setStrokeStyle(1, 0x22364d, 0.84)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x142033, 0.98));
    bg.on('pointerout', () => bg.setFillStyle(0x0d1420, 0.96));
    bg.on('pointerdown', () => this.openCodexDetail(enemy.id));
    layer.add(bg);
    addCodexEntryFrame(this, (obj) => layer.add(obj), { cx, cy, w, h }, { alpha: 0.42, padX: 18, padY: 18 });
    layer.add(this.add.rectangle(cx, cy - h / 2 + 7, w - 18, 3, accent, 0.62));
    layer.add(this.add.rectangle(cx - w / 2 + 8, cy - h / 2 + 28, 3, 42, accent, 0.7));

    const art = this.enemyArtAsset(enemy);
    if (art && this.textures.exists(art.key)) {
      const fit = this.fittedTextureSize(art.key, artW, artH);
      const shadow = this.enemyShadowMetrics(art.key, artX, artY, fit.w, fit.h, artW, artH);
      layer.add(this.add.ellipse(shadow.x, shadow.y, shadow.w, shadow.h, 0x020409, 0.3));
      layer.add(this.add.image(artX, artY, art.key).setDisplaySize(fit.w, fit.h).setAlpha(0.99));
    } else {
      layer.add(this.add.rectangle(artX, artY, artW, artH, 0x141d2b, 0.9).setStrokeStyle(1, 0x22364d, 0.8));
      layer.add(this.add.text(artX, artY - 2, enemy.typeHint, {
        fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_BODY,
        align: 'center', wordWrap: { width: artW - 14 }
      }).setOrigin(0.5));
    }

    layer.add(this.add.text(textX, cy - 82, enemy.name, {
      fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: UI_GOLD,
      align: 'center', wordWrap: { width: textW }
    }).setOrigin(0.5, 0));
    layer.add(this.add.text(textX, cy - 30, enemy.role, {
      fontFamily: UI_FONT, fontSize: '12px', fontStyle: UI_BOLD, color: UI_CYAN,
      align: 'center', wordWrap: { width: textW }
    }).setOrigin(0.5, 0));
    this.addCodexChip(layer, textX, cy - 1, 108, enemy.source === 'encounter' ? enemy.typeHint : 'Concept', accent);
    layer.add(this.add.text(textX, cy + 8, enemy.district, {
      fontFamily: UI_FONT, fontSize: '11px', color: UI_MUTED,
      align: 'center', wordWrap: { width: textW }
    }).setOrigin(0.5, 0));
    const bossProgress = this.codexBossView(enemy);
    const footer = enemy.typeHint === 'Boss'
      ? `DOSSIER  ${bossProgress.observed} / ${bossProgress.total} TACTICS`
      : enemy.varietyContribution;
    layer.add(this.add.text(cx, cy + 76, footer, {
      fontFamily: UI_FONT, fontSize: '11px', color: UI_SOFT,
      fontStyle: enemy.typeHint === 'Boss' ? UI_BOLD : '',
      align: 'center', wordWrap: { width: w - 24 }
    }).setOrigin(0.5, 0.5));
  }

  private enemyAccent(enemy: CodexEnemyEntry) {
    if (enemy.district === 'Canal Markets') return 0x2fc6c9;
    if (enemy.district === 'Signal Spires') return 0xc9a6ff;
    if (enemy.district === 'High Roost') return 0xe8c24a;
    return 0x7ab8d6;
  }

  private acknowledgeNewCardIds(ids: Iterable<string>) {
    const acknowledged = new Set(ids);
    const account = loadAccount();
    let changed = false;
    acknowledged.forEach((id) => {
      const record = account.cardCollection[id];
      if (!record?.isNew) return;
      delete record.isNew;
      changed = true;
    });
    if (!changed) {
      playUiSound('locked');
      return;
    }
    writeJournaledJson('birdsquad.account', account);
    this.cardCollection = account.cardCollection;
    this.newlyAcquiredCards = new Set(Object.entries(account.cardCollection)
      .filter(([, record]) => record.isNew === true)
      .map(([id]) => id));
    playUiSound('confirm');
    this.renderAll();
  }

  private acknowledgeCurrentNewCard() {
    const id = this.activeSection === 'cards' ? this.detailId : undefined;
    if (!id || !this.newlyAcquiredCards.has(id)) {
      playUiSound('locked');
      return;
    }
    this.acknowledgeNewCardIds([id]);
  }

  private clearAllNewCards() {
    if (this.activeSection !== 'cards' || this.newlyAcquiredCards.size === 0) {
      playUiSound('locked');
      return;
    }
    this.acknowledgeNewCardIds(this.newlyAcquiredCards);
  }

  private cardTagLabel(tag?: CardPersonalTag) {
    if (tag === 'staple') return 'Staple';
    if (tag === 'experiment') return 'Experiment';
    if (tag === 'keepsake') return 'Keepsake';
    return 'None';
  }

  private cardTagAccent(tag?: CardPersonalTag) {
    if (tag === 'staple') return 0x74d7f2;
    if (tag === 'experiment') return 0xc9a6ff;
    if (tag === 'keepsake') return 0x8fd7b2;
    return 0x627184;
  }

  private cycleCurrentCardTag() {
    const id = this.activeSection === 'cards' ? this.detailId : undefined;
    if (!id || !this.discovered.has(id)) {
      playUiSound('locked');
      return;
    }
    const account = loadAccount();
    account.cardTags = sanitizeCardPersonalTags(account.cardTags, account.discoveredCards);
    const order: Array<CardPersonalTag | undefined> = [undefined, ...CARD_PERSONAL_TAGS];
    const current = order.indexOf(account.cardTags[id]);
    const next = order[(Math.max(0, current) + 1) % order.length];
    if (next) account.cardTags[id] = next;
    else delete account.cardTags[id];
    const newMilestones = unlockCollectionMilestones(account);
    writeJournaledJson('birdsquad.account', account);
    this.cardTags = account.cardTags;
    this.accountAchievements = new Set(account.achievements);
    if (newMilestones.length > 0) birdAudio.play('objectiveComplete', 1);
    else playUiSound('confirm');
    this.renderAll();
  }

  private toggleCurrentCardFavorite() {
    const id = this.activeSection === 'cards' ? this.detailId : undefined;
    if (!id || !this.discovered.has(id)) {
      playUiSound('locked');
      return;
    }
    const account = loadAccount();
    const favorites = new Set(account.favoriteCards);
    const favorite = !favorites.has(id);
    if (favorite) favorites.add(id);
    else favorites.delete(id);
    account.favoriteCards = [...favorites];
    writeJournaledJson('birdsquad.account', account);
    if (favorite) this.favoriteCards.add(id);
    else this.favoriteCards.delete(id);
    playUiSound('confirm');
    this.renderAll();
  }

  private toggleCurrentCardShowcase() {
    const id = this.activeSection === 'cards' ? this.detailId : undefined;
    if (!id || !this.discovered.has(id)) {
      playUiSound('locked');
      return;
    }
    const account = loadAccount();
    const showcase = sanitizeCardShowcase(account.showcase, account.discoveredCards);
    const index = showcase.indexOf(id);
    if (index >= 0) showcase.splice(index, 1);
    else if (showcase.length >= CARD_SHOWCASE_LIMIT) {
      playUiSound('locked');
      return;
    } else showcase.push(id);
    account.showcase = showcase;
    writeJournaledJson('birdsquad.account', account);
    this.cardShowcase = showcase;
    playUiSound('confirm');
    this.renderAll();
  }

  private toggleCurrentCardProtection() {
    const id = this.activeSection === 'cards' ? this.detailId : undefined;
    if (!id || !this.cardCollection[id]) {
      playUiSound('locked');
      return;
    }
    const account = loadAccount();
    if (!account.cardCollection[id]) {
      playUiSound('locked');
      return;
    }
    const lockedCards = new Set(this.lockedCards);
    if (lockedCards.has(id)) lockedCards.delete(id);
    else lockedCards.add(id);
    account.lockedCards = [...lockedCards];
    if (!writeJournaledJson('birdsquad.account', account)) {
      playUiSound('locked');
      return;
    }
    this.lockedCards = lockedCards;
    playUiSound('confirm');
    this.renderAll();
  }

  private canOpenCurrentCardInFlightDeck(id = this.detailId) {
    return Boolean(
      id
      && this.returnScene === 'RouteScene'
      && this.activeFlightCardUsage?.cards[id]
    );
  }

  private openCurrentCardInFlightDeck() {
    const id = this.activeSection === 'cards' ? this.detailId : undefined;
    if (!this.canOpenCurrentCardInFlightDeck(id)) {
      playUiSound('locked');
      return;
    }
    playUiSound('confirm');
    this.scene.start('RouteScene', {
      ...(this.returnData ?? {}),
      card: id,
    });
  }

  private toggleCurrentCollectionTarget() {
    const id = this.activeSection === 'cards' ? this.detailId : undefined;
    if (id && this.cardCollection[id]) {
      this.toggleCurrentCardProtection();
      return;
    }
    if (!id || !this.discovered.has(id)) {
      playUiSound('locked');
      return;
    }
    const account = loadAccount();
    const targets = new Set((account.hunt ?? []).filter((targetId) => (
      this.discovered.has(targetId) && !this.cardCollection[targetId] && Boolean(cardLibrary[targetId])
    )));
    const targeted = targets.has(id);
    if (targeted) targets.delete(id);
    else if (targets.size >= COLLECTION_TARGET_LIMIT) {
      playUiSound('locked');
      return;
    } else targets.add(id);
    account.hunt = [...targets];
    writeJournaledJson('birdsquad.account', account);
    this.collectionTargets = targets;
    playUiSound('confirm');
    this.renderAll();
  }

  private renderCardFavoriteControl(x: number, y: number, card: Card) {
    const favorite = this.favoriteCards.has(card.id);
    const accent = favorite ? UI_FIELD.gold : UI_FIELD.cyan;
    const hit = this.add.rectangle(x, y, 142, 46, favorite ? 0x392d12 : 0x102534, 0.98)
      .setStrokeStyle(2, accent, 0.96)
      .setInteractive({ useHandCursor: true })
      .setName('codex-card-favorite-hit')
      .setData('cardId', card.id)
      .setData('favorite', favorite);
    hit.on('pointerover', () => hit.setFillStyle(favorite ? 0x51401a : 0x17384b, 1));
    hit.on('pointerout', () => hit.setFillStyle(favorite ? 0x392d12 : 0x102534, 0.98));
    hit.on('pointerdown', () => this.toggleCurrentCardFavorite());
    this.root.add(hit);
    this.root.add(this.add.text(x, y, favorite ? '★  FAVORITED' : '☆  FAVORITE', {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: favorite ? '#ffe08a' : '#b8e8f4',
      stroke: '#05070c',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0.5).setName('codex-card-favorite-label').setData('cardId', card.id));
  }

  private renderCardTagControl(x: number, y: number, card: Card) {
    const tag = this.cardTags[card.id];
    const accent = this.cardTagAccent(tag);
    const hit = this.add.rectangle(x, y, 180, 46, tag ? 0x102534 : 0x151b24, 0.98)
      .setStrokeStyle(2, accent, tag ? 0.96 : 0.68)
      .setInteractive({ useHandCursor: true })
      .setName('codex-card-tag-hit')
      .setData('cardId', card.id)
      .setData('tag', tag ?? '');
    hit.on('pointerover', () => hit.setFillStyle(tag ? 0x17384b : 0x1d2734, 1));
    hit.on('pointerout', () => hit.setFillStyle(tag ? 0x102534 : 0x151b24, 0.98));
    hit.on('pointerdown', () => this.cycleCurrentCardTag());
    this.root.add(hit);
    this.root.add(this.add.text(x, y - 9, 'PERSONAL TAG  ·  V / L3', {
      fontFamily: UI_FONT,
      fontSize: '8px',
      fontStyle: UI_BOLD,
      color: tag ? '#b8e8f4' : '#91a0ad',
    }).setResolution(2).setOrigin(0.5).setName('codex-card-tag-hint').setData('cardId', card.id));
    this.root.add(this.add.text(x, y + 9, this.cardTagLabel(tag).toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: tag ? this.hexColor(accent) : '#91a0ad',
      stroke: '#05070c',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0.5).setName('codex-card-tag-label').setData('cardId', card.id));
  }

  private renderCardShowcaseControl(x: number, y: number, card: Card) {
    const shown = this.cardShowcase.includes(card.id);
    const full = !shown && this.cardShowcase.length >= CARD_SHOWCASE_LIMIT;
    const accent = shown ? UI_FIELD.gold : full ? 0x627184 : UI_FIELD.violet;
    const hit = this.add.rectangle(x, y, 180, 46, shown ? 0x392d12 : 0x151b24, 0.98)
      .setStrokeStyle(2, accent, shown || !full ? 0.96 : 0.58)
      .setInteractive({ useHandCursor: !full })
      .setName('codex-card-showcase-hit')
      .setData('cardId', card.id)
      .setData('showcased', shown)
      .setData('full', full);
    hit.on('pointerover', () => hit.setFillStyle(shown ? 0x51401a : 0x1d2734, 1));
    hit.on('pointerout', () => hit.setFillStyle(shown ? 0x392d12 : 0x151b24, 0.98));
    hit.on('pointerdown', () => this.toggleCurrentCardShowcase());
    this.root.add(hit);
    this.root.add(this.add.text(x, y - 9, `FLOCK RECORD  /  G / R3  /  ${this.cardShowcase.length}/${CARD_SHOWCASE_LIMIT}`, {
      fontFamily: UI_FONT,
      fontSize: '8px',
      fontStyle: UI_BOLD,
      color: shown ? '#ffe08a' : full ? '#7f8b98' : '#d9c7ff',
    }).setResolution(2).setOrigin(0.5).setName('codex-card-showcase-hint').setData('cardId', card.id));
    this.root.add(this.add.text(x, y + 9, shown ? 'SHOWCASED' : full ? 'SHOWCASE FULL' : 'ADD TO SHOWCASE', {
      fontFamily: UI_FONT,
      fontSize: full ? '10px' : '11px',
      fontStyle: UI_BOLD,
      color: shown ? '#ffe08a' : full ? '#7f8b98' : '#d9c7ff',
      stroke: '#05070c',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0.5).setName('codex-card-showcase-label').setData('cardId', card.id));
  }

  private renderCardFlightDeckControl(x: number, y: number, card: Card) {
    const hit = this.add.rectangle(x, y, 224, 44, 0x102534, 0.99)
      .setStrokeStyle(2, UI_FIELD.cyan, 0.96)
      .setInteractive({ useHandCursor: true })
      .setName('codex-card-flight-deck-hit')
      .setData('cardId', card.id)
      .setData('state', this.activeFlightCardUsage?.cards[card.id] ?? '');
    hit.on('pointerover', () => hit.setFillStyle(0x17384b, 1));
    hit.on('pointerout', () => hit.setFillStyle(0x102534, 0.99));
    hit.on('pointerdown', () => this.openCurrentCardInFlightDeck());
    this.root.add(hit);
    this.root.add(this.add.text(x, y - 9, 'ACTIVE FLIGHT  /  D / RB', {
      fontFamily: UI_FONT,
      fontSize: '8px',
      fontStyle: UI_BOLD,
      color: '#91a6b8',
    }).setResolution(2).setOrigin(0.5).setName('codex-card-flight-deck-hint').setData('cardId', card.id));
    this.root.add(this.add.text(x, y + 9, 'VIEW IN FLIGHT DECK', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: '#b8e8f4',
      stroke: '#05070c',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0.5).setName('codex-card-flight-deck-label').setData('cardId', card.id));
  }

  private renderClearNewCardsControl(x: number, y: number) {
    const active = this.focusZone === 'newCards';
    const count = this.newlyAcquiredCards.size;
    const hit = this.add.rectangle(x, y, 132, 46, active ? 0x3a285d : 0x211738, 0.99)
      .setStrokeStyle(2, 0xc9a6ff, active ? 1 : 0.92)
      .setInteractive({ useHandCursor: true })
      .setName('codex-clear-new-cards-hit')
      .setData('count', count);
    hit.on('pointerover', () => hit.setFillStyle(0x48316f, 1));
    hit.on('pointerout', () => hit.setFillStyle(active ? 0x3a285d : 0x211738, 0.99));
    this.root.add(hit);
    this.root.add(this.add.text(x, y - 9, `${count} NEW CARD${count === 1 ? '' : 'S'}`, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: '#c9a6ff',
    }).setResolution(2).setOrigin(0.5).setName('codex-clear-new-cards-count'));
    this.root.add(this.add.text(x, y + 8, 'CLEAR ALL', {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: '#eadcff',
      stroke: '#05070c',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0.5).setName('codex-clear-new-cards-label'));
  }

  private renderCardTargetControl(x: number, y: number, card: Card) {
    if (this.newlyAcquiredCards.has(card.id)) {
      const hit = this.add.rectangle(x, y, 142, 46, 0x31215a, 0.98)
        .setStrokeStyle(2, 0xc9a6ff, 0.98)
        .setInteractive({ useHandCursor: true })
        .setName('codex-card-mark-seen-hit')
        .setData('cardId', card.id);
      hit.on('pointerover', () => hit.setFillStyle(0x48316f, 1));
      hit.on('pointerout', () => hit.setFillStyle(0x31215a, 0.98));
      hit.on('pointerdown', () => this.acknowledgeCurrentNewCard());
      this.root.add(hit);
      this.root.add(this.add.text(x, y, 'NEW  /  MARK SEEN', {
        fontFamily: UI_FONT,
        fontSize: '11px',
        fontStyle: UI_BOLD,
        color: '#eadcff',
        stroke: '#05070c',
        strokeThickness: 2,
      }).setResolution(2).setOrigin(0.5).setName('codex-card-mark-seen-label').setData('cardId', card.id));
      return;
    }
    const collected = Boolean(this.cardCollection[card.id]);
    if (collected) {
      const protectedCard = this.lockedCards.has(card.id);
      const hit = this.add.rectangle(x, y, 142, 46, protectedCard ? 0x392d12 : 0x102534, 0.98)
        .setStrokeStyle(2, protectedCard ? UI_FIELD.gold : UI_FIELD.cyan, 0.96)
        .setInteractive({ useHandCursor: true })
        .setName('codex-card-protect-hit')
        .setData('cardId', card.id)
        .setData('protected', protectedCard)
        .setData('enabled', true);
      hit.on('pointerover', () => hit.setFillStyle(protectedCard ? 0x51401a : 0x17384b, 1));
      hit.on('pointerout', () => hit.setFillStyle(protectedCard ? 0x392d12 : 0x102534, 0.98));
      hit.on('pointerdown', () => this.toggleCurrentCardProtection());
      this.root.add(hit);
      this.root.add(this.add.text(x, y - 9, 'CARD SAFETY  /  T / Y', {
        fontFamily: UI_FONT,
        fontSize: '8px',
        fontStyle: UI_BOLD,
        color: protectedCard ? '#ffe08a' : '#91a6b8',
      }).setResolution(2).setOrigin(0.5).setName('codex-card-protect-hint').setData('cardId', card.id));
      this.root.add(this.add.text(x, y + 9, protectedCard ? 'PROTECTED' : 'PROTECT CARD', {
        fontFamily: UI_FONT,
        fontSize: '11px',
        fontStyle: UI_BOLD,
        color: protectedCard ? '#ffe08a' : '#b8e8f4',
        stroke: '#05070c',
        strokeThickness: 2,
      }).setResolution(2).setOrigin(0.5).setName('codex-card-protect-label').setData('cardId', card.id));
      return;
    }
    const targeted = this.collectionTargets.has(card.id);
    const full = !targeted && this.collectionTargets.size >= COLLECTION_TARGET_LIMIT;
    const enabled = !full;
    const label = targeted
      ? '◎  TRACKED'
      : full
        ? `${COLLECTION_TARGET_LIMIT}/${COLLECTION_TARGET_LIMIT}  HUNT FULL`
        : '◎  TRACK';
    const accent = targeted ? 0xff9b6a : enabled ? UI_FIELD.cyan : 0x627184;
    const hit = this.add.rectangle(x, y, 142, 46, targeted ? 0x3a1d14 : enabled ? 0x102534 : 0x151b24, 0.98)
      .setStrokeStyle(2, accent, enabled ? 0.96 : 0.62)
      .setInteractive({ useHandCursor: enabled })
      .setName('codex-card-target-hit')
      .setData('cardId', card.id)
      .setData('targeted', targeted)
      .setData('enabled', enabled);
    hit.on('pointerover', () => {
      if (enabled) hit.setFillStyle(targeted ? 0x54291c : 0x17384b, 1);
    });
    hit.on('pointerout', () => hit.setFillStyle(targeted ? 0x3a1d14 : enabled ? 0x102534 : 0x151b24, 0.98));
    hit.on('pointerdown', () => this.toggleCurrentCollectionTarget());
    this.root.add(hit);
    this.root.add(this.add.text(x, y, label, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: targeted ? '#ffc09f' : enabled ? '#b8e8f4' : '#91a0ad',
      stroke: '#05070c',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0.5).setName('codex-card-target-label').setData('cardId', card.id));
  }

  private cardAcquisitionSourceLabel(source: string) {
    switch (source) {
      case 'starter_flock': return 'Starter flock';
      case 'combat_reward': return 'Fight reward';
      case 'route_reward': return 'Route choice';
      case 'market': return 'Canal market';
      case 'snag': return 'Enemy Snag';
      default: return 'Flight claim';
    }
  }

  private cardAcquisitionDateLabel(timestamp: number) {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toISOString().slice(0, 10);
  }

  private renderCardJournalPrompt(card: Card) {
    this.root.add(this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x02050a,
      0.7,
    ).setInteractive().setName('codex-card-journal-scrim'));
    this.root.add(this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      720,
      346,
      0x0b1020,
      0.998,
    ).setStrokeStyle(3, UI_FIELD.violet, 0.96).setName('codex-card-journal-prompt-frame'));
    this.root.add(this.add.text(GAME_WIDTH / 2, 218, 'EDIT PRIVATE CARD JOURNAL', {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      fontStyle: UI_BOLD,
      color: UI_FIELD.warm,
      stroke: '#020409',
      strokeThickness: 3,
    }).setResolution(2).setOrigin(0.5).setName('codex-card-journal-prompt-title'));
    this.root.add(this.add.text(
      GAME_WIDTH / 2,
      256,
      `${displayName(card).toUpperCase()}  ·  ${CARD_JOURNAL_NOTE_LIMIT} CHARACTER LIMIT`,
      {
        fontFamily: UI_FONT,
        fontSize: '10px',
        fontStyle: UI_BOLD,
        color: '#d9c7ff',
      },
    ).setResolution(2).setOrigin(0.5).setName('codex-card-journal-prompt-card'));
    this.root.add(this.add.rectangle(
      GAME_WIDTH / 2,
      374,
      620,
      154,
      0x101323,
      1,
    ).setStrokeStyle(2, UI_FIELD.violet, 0.9).setName('codex-card-journal-prompt-field'));
    this.root.add(this.add.text(GAME_WIDTH / 2 - 290, 312, 'TYPE YOUR PRIVATE NOTE…', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: '#716987',
    }).setResolution(2).setName('codex-card-journal-prompt-placeholder'));
    this.root.add(this.add.text(
      GAME_WIDTH / 2,
      500,
      'Enter: Save  ·  Shift+Enter: New Line  ·  Esc: Cancel\nController A: Save  ·  B: Cancel  ·  Local save + backups only  ·  Never affects play',
      {
        fontFamily: UI_FONT,
        fontSize: '11px',
        color: UI_SOFT,
        align: 'center',
        lineSpacing: 5,
      },
    ).setResolution(2).setOrigin(0.5).setName('codex-card-journal-prompt-help'));
  }

  private renderDetail(id: string) {
    const card = cardLibrary[id];
    if (!card) return;
    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.76).setInteractive();
    scrim.on('pointerdown', () => this.closeCodexDetail());
    this.root.add(scrim);

    const px = GAME_WIDTH / 2;
    const py = GAME_HEIGHT / 2;
    const MW = 920;
    const MH = 624;
    const left = px - MW / 2;
    const right = px + MW / 2;
    const mTop = py - MH / 2;
    const mBottom = py + MH / 2;
    const accentColor = this.cardAccent(card);
    const accentText = this.hexColor(accentColor);
    const isAviary = isAviaryCard(card);
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x0c1420, 0.995).setStrokeStyle(2, accentColor, 1));
    addCodexDossierFrame(this, (obj) => this.root.add(obj), { cx: px, cy: py, w: MW, h: MH }, { alpha: 0.9 });

    // Large card art on the left, at the art's true 2:3 aspect (no distortion).
    const key = loadedCardArtKey(this, card);
    const artW = 320;
    const artH = artW * 1.5;
    const artX = left + 24 + artW / 2;
    this.renderCodexArtPreviewBacking(artX, py, artW + 14, artH + 14, accentColor);
    if (key && this.textures.exists(key)) {
      this.root.add(this.add.image(artX, py, key).setDisplaySize(artW, artH).setAlpha(0.99));
    } else {
      this.root.add(this.add.rectangle(artX, py, artW, artH, 0x141d2b, 0.9));
    }
    this.renderCodexArtPreviewFrame(artX, py, artW + 14, artH + 14, 0.86);

    // Right column is a scrollable viewport (lots of content now). Text is drawn
    // in absolute coords offset by -detailScroll, then clipped by opaque curtains
    // top & bottom (WebGL has no geometry masks).
    const tx = artX + artW / 2 + 26;
    const wrap = right - tx - 108;
    const flightDeckAction = this.canOpenCurrentCardInFlightDeck(card.id);
    const viewTop = mTop + 16 + (flightDeckAction ? 48 : 0);
    const viewBottom = mBottom - 44;
    const viewH = viewBottom - viewTop;
    const flav = this.codexData?.getCardFlavor(card.id);
    const meaning = this.codexData?.getCardMeaning(card.id);
    const accent = accentText;
    let yy = viewTop - this.detailScroll;
    const heading = (t: string, color: string) => { this.root.add(this.add.text(tx, yy, t, { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color })); yy += 17; };
    const para = (t: string, opts: { color?: string; size?: number; italic?: boolean }) => {
      const o = this.add.text(tx, yy, t, { fontFamily: opts.italic ? 'Georgia, serif' : 'Arial', fontSize: `${opts.size ?? 13}px`, fontStyle: opts.italic ? 'italic' : 'normal', color: opts.color ?? '#cfe0ef', lineSpacing: 3, wordWrap: { width: wrap } });
      this.root.add(o); yy += o.height;
    };

    // Title block.
    const title = this.add.text(tx, yy, displayName(card), {
      fontFamily: UI_FONT, fontSize: '27px', fontStyle: UI_BOLD, color: UI_GOLD, wordWrap: { width: wrap }
    });
    this.root.add(title);
    yy += Math.max(38, title.height + 7);
    const meta = this.add.text(tx, yy, `${cardLabel(card)} / Cost ${card.cost}${flav?.bird ? ` / ${flav.bird}` : ''}`, {
      fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_MUTED, wordWrap: { width: wrap }
    });
    this.root.add(meta);
    yy += Math.max(26, meta.height + 8);

    const collection = this.cardCollection[card.id];
    heading('COLLECTION STATUS', '#e8c24a');
    if (collection) {
      if (this.newlyAcquiredCards.has(card.id)) {
        para('NEW TO COLLECTION / Choose MARK SEEN, press N, or use controller LT to acknowledge this marker.', {
          color: '#eadcff',
          size: 12,
        });
        yy += 5;
      }
      para(
        `COLLECTED / ${collection.timesClaimed} FLIGHT CLAIM${collection.timesClaimed === 1 ? '' : 'S'} / FIRST: ${this.cardAcquisitionSourceLabel(collection.firstSource).toUpperCase()} / ${this.cardAcquisitionDateLabel(collection.firstAcquiredAt)}`,
        { color: '#ffe08a', size: 12 },
      );
      yy += 5;
      para('Permanent collection record. Playable copies, Preens, and transformations remain specific to each flight.', {
        color: '#b8e8f4',
        size: 12,
      });
      yy += 5;
      para(
        this.lockedCards.has(card.id)
          ? 'PROTECTED / Reserved against future conversion or destruction tools. Private, backup-safe, and no effect on play.'
          : 'UNPROTECTED / Choose PROTECT CARD, press T, or use controller Y to reserve it against future destructive tools.',
        { color: this.lockedCards.has(card.id) ? '#ffe08a' : '#91a6b8', size: 12 },
      );
      if (collection.targetCompletedAt) {
        yy += 5;
        para(
          `HUNT COMPLETED / ${this.cardAcquisitionSourceLabel(collection.targetSource ?? collection.firstSource).toUpperCase()} / ${this.cardAcquisitionDateLabel(collection.targetCompletedAt)}`,
          { color: '#ffc09f', size: 12 },
        );
      }
    } else {
      para('DISCOVERED / NOT YET COLLECTED', { color: '#b8e8f4', size: 12 });
      yy += 5;
      para('Seen in an offer or preview. Claim it during a flight to create its permanent collection record.', {
        color: '#a9b9c8',
        size: 12,
      });
      yy += 5;
      para(
        this.collectionTargets.has(card.id)
          ? 'ACTIVE HUNT TARGET / Claiming it records a personal milestone. Reward odds are unchanged.'
          : `Choose ◎ TRACK to add this card to your Hunt List (${this.collectionTargets.size}/${COLLECTION_TARGET_LIMIT}). Reward odds are unchanged.`,
        { color: this.collectionTargets.has(card.id) ? '#ffc09f' : '#91a6b8', size: 12 },
      );
    }
    const folioUsage = this.cardFolioUsage[card.id];
    const activeFlightState = this.activeFlightCardUsage?.cards[card.id];
    yy += 5;
    if (this.activeFlightCardUsage) {
      para(
        activeFlightState
          ? `ACTIVE FLIGHT / 1 PLAYABLE COPY / ${activeFlightState.toUpperCase()}`
          : 'ACTIVE FLIGHT / 0 PLAYABLE COPIES / NOT IN CURRENT DECK',
        { color: activeFlightState ? '#8df4ff' : '#91a6b8', size: 12 },
      );
      yy += 5;
      para(
        activeFlightState
          ? 'Run-specific checkpoint state. Preening or removing this copy does not change permanent ownership or saved Folios.'
          : 'This card remains permanently owned or discovered as shown above; the current flight deck is separate.',
        { color: '#91a6b8', size: 12 },
      );
    } else {
      para('NO ACTIVE FLIGHT / 0 FLIGHT-SPECIFIC PLAYABLE COPIES', {
        color: '#91a6b8',
        size: 12,
      });
      yy += 5;
      para('Permanent ownership and saved Folios remain available independently of a suspended flight.', {
        color: '#91a6b8',
        size: 12,
      });
    }
    if (folioUsage) {
      yy += 5;
      para(
        `SAVED FOLIOS / ${folioUsage.total} TOTAL / ${folioUsage.active} ACTIVE / ${folioUsage.archived} ARCHIVED`,
        { color: folioUsage.active > 0 ? '#b8e8f4' : '#eadcff', size: 12 },
      );
      yy += 5;
      para('Private organization only. Removing or archiving a Folio does not change this card or its collection record.', {
        color: '#91a6b8',
        size: 12,
      });
    }
    yy += 12;

    const acquisition = cardAcquisitionProfile(card.id, card.runtime.kind);
    heading('HOW TO ACQUIRE', '#8df4ff');
    para('PERMANENT / NO ROTATION / NO SEASON / NO STORE GATE', {
      color: '#dffbff',
      size: 12,
    });
    yy += 5;
    para(`AVAILABLE FROM / ${acquisition.paths.map((path) => path.label.toUpperCase()).join(' / ')}`, {
      color: '#b8e8f4',
      size: 12,
    });
    if (acquisition.starterLeaderNames.length > 0) {
      yy += 5;
      para(`STARTER OPTIONS / ${acquisition.starterLeaderNames.map((name) => name.toUpperCase()).join(' / ')}`, {
        color: '#ffe08a',
        size: 11,
      });
    }
    yy += 5;
    para(
      card.runtime.kind === 'snag'
        ? 'Encounter an enemy that inserts this Snag during combat; its permanent collection record is created immediately.'
        : acquisition.paths.some((path) => path.id === 'combat_reward')
          ? 'This card may appear after fights, in card-bearing route choices, or in Canal Market stock.'
          : 'Begin a flight with one of the listed starter Flocks to create its permanent collection record.',
      { color: '#91a6b8', size: 12 },
    );
    yy += 12;

    heading('CARD JOURNAL', '#c9a6ff');
    const journalNote = this.cardJournal[card.id] ?? '';
    const journalText = this.add.text(
      tx + 12,
      yy + 26,
      journalNote || 'No private note yet. Record a combo idea, memory, or collection goal.',
      {
        fontFamily: journalNote ? 'Arial' : 'Georgia, serif',
        fontSize: '12px',
        fontStyle: journalNote ? 'normal' : 'italic',
        color: journalNote ? '#e7dcff' : '#a99abd',
        lineSpacing: 3,
        wordWrap: { width: wrap - 24 },
      },
    );
    const journalHeight = Math.max(72, journalText.height + 48);
    const journalHit = this.add.rectangle(
      tx + wrap / 2,
      yy + journalHeight / 2,
      wrap,
      journalHeight,
      0x17172b,
      0.98,
    )
      .setStrokeStyle(2, UI_FIELD.violet, 0.82)
      .setInteractive({ useHandCursor: true })
      .setName('codex-card-journal-hit')
      .setData('cardId', card.id)
      .setData('hasNote', Boolean(journalNote))
      .setData('noteLength', journalNote.length);
    journalHit.on('pointerover', () => journalHit.setFillStyle(0x211f3a, 1));
    journalHit.on('pointerout', () => journalHit.setFillStyle(0x17172b, 0.98));
    journalHit.on('pointerdown', () => this.openCardJournal());
    this.root.add(journalHit);
    this.root.add(this.add.text(tx + 12, yy + 8, 'PRIVATE  ·  J / START  ·  EDIT', {
      fontFamily: UI_FONT,
      fontSize: '9px',
      fontStyle: UI_BOLD,
      color: '#d9c7ff',
    }).setResolution(2).setName('codex-card-journal-control-label').setData('cardId', card.id));
    this.root.add(journalText.setResolution(2).setName('codex-card-journal-note').setData('cardId', card.id));
    yy += journalHeight + 8;
    para(
      this.cardJournalStatus === 'saved'
        ? 'JOURNAL SAVED / Included in local save backups / excluded from shared deck codes / never affects power.'
        : this.cardJournalStatus === 'failed'
          ? 'JOURNAL SAVE FAILED / The previous note remains unchanged.'
          : 'Included in local save backups / excluded from shared deck codes / never affects power.',
      { color: this.cardJournalStatus === 'failed' ? '#ffb6a6' : '#91a6b8', size: 10 },
    );
    yy += 12;

    // Effect - base + preened (keywords highlighted, hoverable).
    heading('EFFECT', '#7f93a8');
    yy += renderRichText(this, this.root, tx, yy, card.text, { wrap, fontSize: 15, tooltips: true }) + 6;
    if (card.upgradedText && card.upgradedText !== card.text) {
      this.root.add(this.add.text(tx, yy, 'PREENED  +', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: '#7fe39a' })); yy += 16;
      yy += renderRichText(this, this.root, tx, yy, card.upgradedText, { wrap, fontSize: 14, baseColor: '#bfe9cc', tooltips: true }) + 12;
    } else { yy += 6; }

    // Molt ability - base + preened.
    if (card.moltText) {
      heading('MOLT ABILITY', '#c8923a');
      yy += renderRichText(this, this.root, tx, yy, card.moltText, { wrap, fontSize: 14, baseColor: '#ffc78f', bold: true, tooltips: true }) + 6;
      if (card.moltTextUpgraded && card.moltTextUpgraded !== card.moltText) {
        this.root.add(this.add.text(tx, yy, 'PREENED  +', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: '#7fe39a' })); yy += 16;
        yy += renderRichText(this, this.root, tx, yy, card.moltTextUpgraded, { wrap, fontSize: 13, baseColor: '#f0b487', tooltips: true }) + 12;
      } else { yy += 6; }
    }

    // Flock Stats this card contributes to the flock.
    const statLabels: Record<string, string> = {
      cohesion: 'Cohesion', damage: 'Damage', cover: 'Cover', draw: 'Hand Size',
      resonance: 'Resonance/turn', regen: 'Regen/turn', moltPower: 'Molt Power', openSkyGuard: 'Open Sky Guard',
    };
    const statStr = Object.entries(card.runtime.flockStats).map(([k, v]) => `${statLabels[k] ?? k} +${v}`).join(' / ') || 'None';
    heading('FLOCK STATS', '#7f93a8');
    const statText = this.add.text(tx, yy, statStr, { fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: UI_CYAN, wordWrap: { width: wrap } });
    const statKw = Object.keys(card.runtime.flockStats).map((k) => statLabels[k] ?? k).find((label) => KEYWORDS[label]);
    if (statKw) {
      statText.setInteractive({ useHandCursor: true });
      statText.on('pointerover', () => showKwTooltip(this, statKw, tx + statText.width / 2, yy));
      statText.on('pointerout', () => hideKwTooltip());
    }
    this.root.add(statText);
    yy += Math.max(30, statText.height + 10);

    if (!this.codexData && this.codexDataPending()) {
      heading(isAviary ? 'AVIARY LEGEND' : 'TAROT MEANING', '#c9a6ff');
      para(isAviary ? 'Loading Aviary notes and bird facts...' : 'Loading tarot notes and bird facts...', { color: '#d9c8ff', italic: true, size: 13 });
      yy += 8;
      this.root.add(this.add.text(tx, yy, isAviary ? 'SIGNAL' : 'UPRIGHT', { fontFamily: UI_FONT, fontSize: '10px', fontStyle: UI_BOLD, color: '#9d86c8' })); yy += 15;
      para('Loading note...', { color: '#cfd9ea', size: 13 }); yy += 8;
      this.root.add(this.add.text(tx, yy, isAviary ? 'SHADOW' : 'REVERSED', { fontFamily: UI_FONT, fontSize: '10px', fontStyle: UI_BOLD, color: '#9d86c8' })); yy += 15;
      para('Loading note...', { color: '#b9a7bd', size: 13 }); yy += 14;
      heading(`ABOUT THE ${(flav?.bird ?? card.bird).toUpperCase()}`, '#e8c24a');
      para('Loading field note...', { color: '#cfe0ef', size: 13 });
      yy += 14;
    } else if (this.codexDataFailed) {
      heading('CODEX NOTES', '#ff9b6a');
      para('Extended Codex notes are unavailable. Gameplay data is still ready.', { color: '#ffd0bd', size: 13 });
      yy += 14;
    }

    // Card meaning - keyword line plus orientation variants.
    if (meaning) {
      heading(isAviary ? 'AVIARY LEGEND' : 'TAROT MEANING', '#c9a6ff');
      if (meaning.core) { para(meaning.core, { color: '#d9c8ff', italic: true, size: 13 }); yy += 8; }
      this.root.add(this.add.text(tx, yy, isAviary ? 'SIGNAL' : 'UPRIGHT', { fontFamily: UI_FONT, fontSize: '10px', fontStyle: UI_BOLD, color: '#9d86c8' })); yy += 15;
      para(meaning.upright, { color: '#cfd9ea', size: 13 }); yy += 8;
      this.root.add(this.add.text(tx, yy, isAviary ? 'SHADOW' : 'REVERSED', { fontFamily: UI_FONT, fontSize: '10px', fontStyle: UI_BOLD, color: '#9d86c8' })); yy += 15;
      para(meaning.reversed, { color: '#b9a7bd', size: 13 }); yy += 14;
    }

    // Real-world bird facts.
    const fact = this.codexData?.getBirdFact(flav?.bird ?? card.bird);
    if (fact) {
      heading(`ABOUT THE ${(flav?.bird ?? card.bird).toUpperCase()}`, '#e8c24a');
      para(fact, { color: '#cfe0ef', size: 13 }); yy += 14;
    }

    const contentBottom = yy + this.detailScroll; // absolute end if scroll were 0
    const SCROLL_PAD = 16; // breathing room below the last line at max scroll
    this.detailMaxScroll = Math.max(0, (contentBottom - viewTop) - viewH + SCROLL_PAD);
    this.detailScrollTarget = clamp(this.detailScrollTarget, 0, this.detailMaxScroll);
    this.detailScroll = clamp(this.detailScroll, 0, this.detailMaxScroll);

    // Clip the scroll viewport (WebGL has no geometry masks, so we paint over the
    // overflow). Two layers: opaque "outside" covers hide anything that bled past
    // the panel edges (above mTop / below mBottom), and panel-bg "inside" curtains
    // restore the panel face over the header/footer scroll gaps. All interactive so
    // they also swallow hovers on keyword tokens scrolled out of view; the outside
    // covers double as click-to-close, matching the scrim.
    const closeDetail = () => this.closeCodexDetail();
    this.root.add(this.add.rectangle(0, 0, GAME_WIDTH, mTop, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(0, mBottom, GAME_WIDTH, GAME_HEIGHT - mBottom, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(left + 1, mTop + 1, MW - 2, viewTop - mTop - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(left + 1, viewBottom, MW - 2, mBottom - viewBottom - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    // Redraw the panel border crisply over the covers.
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x000000, 0).setStrokeStyle(2, accentColor, 1));
    const dossierLabel = this.cardDossierLabel(card);
    const dossierW = Math.max(150, Math.min(190, dossierLabel.length * 9 + 30));
    const dossierX = left + 24 + dossierW / 2;
    this.root.add(this.add.rectangle(dossierX, mTop + 28, dossierW, 28, 0x07101c, 0.96).setStrokeStyle(1, accentColor, 0.9));
    this.root.add(this.add.text(dossierX, mTop + 28, dossierLabel, {
      fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText,
      align: 'center', fixedWidth: dossierW - 18,
    }).setResolution(2).setOrigin(0.5));
    // Thin accent rule between art and text column (clipped to the viewport band).
    this.root.add(this.add.rectangle(tx - 14, (viewTop + viewBottom) / 2, 2, viewH - 8, Phaser.Display.Color.HexStringToColor(accent).color, 0.5));

    if (this.detailMaxScroll > 0) {
      this.renderCodexScrollCue(right - 64, mBottom - 18, this.detailScroll >= this.detailMaxScroll);
    }

    this.renderCardFavoriteControl(artX - 78, mBottom - 24, card);
    this.renderCardTargetControl(artX + 78, mBottom - 24, card);
    this.renderCardTagControl(tx + 96, mBottom - 24, card);
    this.renderCardShowcaseControl(tx + 296, mBottom - 24, card);
    if (flightDeckAction) this.renderCardFlightDeckControl(tx + wrap / 2, mTop + 28, card);
    this.renderCodexCloseControl(right - 26, mTop + 26, closeDetail);
    if (this.cardJournalInput && this.cardJournalEditingId === card.id) {
      this.renderCardJournalPrompt(card);
    }
  }

  private renderEnemyDetail(id: string) {
    const enemy = this.allCodexEnemies().find((entry) => entry.id === id);
    if (!enemy) return;
    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.76).setInteractive();
    scrim.on('pointerdown', () => this.closeCodexDetail());
    this.root.add(scrim);

    const px = GAME_WIDTH / 2;
    const py = GAME_HEIGHT / 2;
    const MW = 980;
    const MH = 624;
    const left = px - MW / 2;
    const right = px + MW / 2;
    const mTop = py - MH / 2;
    const mBottom = py + MH / 2;
    const accent = this.enemyAccent(enemy);
    const accentText = `#${accent.toString(16).padStart(6, '0')}`;
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x0c1420, 0.995).setStrokeStyle(2, accent, 1));
    addCodexDossierFrame(this, (obj) => this.root.add(obj), { cx: px, cy: py, w: MW, h: MH }, { alpha: 0.9 });

    const art = this.enemyArtAsset(enemy);
    const artBoxX = left + 220;
    const artBoxY = py + 24;
    this.renderCodexArtPreviewBacking(artBoxX, artBoxY, 372, 516, accent);
    if (art && this.textures.exists(art.key)) {
      const fit = this.fittedTextureSize(art.key, 360, 500);
      const shadow = this.enemyShadowMetrics(art.key, artBoxX, artBoxY, fit.w, fit.h, 360, 500);
      this.root.add(this.add.ellipse(shadow.x, shadow.y, shadow.w, shadow.h, 0x020409, 0.34));
      this.root.add(this.add.image(artBoxX, artBoxY, art.key).setDisplaySize(fit.w, fit.h).setAlpha(0.99));
    } else {
      this.root.add(this.add.rectangle(artBoxX, artBoxY, 340, 480, 0x141d2b, 0.9).setStrokeStyle(1, 0x2a3a4d, 0.8));
      this.root.add(this.add.text(artBoxX, artBoxY, enemy.typeHint, {
        fontFamily: UI_FONT, fontSize: '20px', fontStyle: UI_BOLD, color: UI_BODY,
        align: 'center', wordWrap: { width: 280 }
      }).setOrigin(0.5));
    }
    this.renderCodexArtPreviewFrame(artBoxX, artBoxY, 372, 516, 0.84);

    const tx = left + 430;
    const wrap = right - tx - 118;
    const viewTop = mTop + 86;
    const viewBottom = mBottom - 124;
    const viewH = viewBottom - viewTop;
    let yy = viewTop - this.detailScroll;
    const heading = (t: string, color: string) => {
      this.root.add(this.add.text(tx, yy, t, { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color }));
      yy += 17;
    };
    const para = (t: string, opts: { color?: string; size?: number; italic?: boolean; bold?: boolean } = {}) => {
      const o = this.add.text(tx, yy, t, {
        fontFamily: opts.italic ? 'Georgia, serif' : 'Arial',
        fontSize: `${opts.size ?? 13}px`,
        fontStyle: opts.bold ? 'bold' : opts.italic ? 'italic' : 'normal',
        color: opts.color ?? '#cfe0ef',
        lineSpacing: 3,
        wordWrap: { width: wrap }
      });
      this.root.add(o);
      yy += o.height;
    };

    this.root.add(this.add.text(tx, yy, enemy.name, {
      fontFamily: UI_FONT, fontSize: '29px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: wrap }
    }));
    yy += 40;
    this.root.add(this.add.text(tx, yy, `${enemy.source === 'encounter' ? 'Playable encounter' : enemy.species} / ${enemy.district} / ${enemy.role}`, {
      fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_MUTED,
      wordWrap: { width: wrap }
    }));
    yy += 28;

    heading('FIELD NOTE', '#7f93a8');
    para(enemy.description, { size: 14 });
    yy += 12;

    heading(enemy.source === 'encounter' ? 'COMBAT ROLE' : 'VARIETY ROLE', '#8df4ff');
    para(enemy.varietyContribution, { size: 13, bold: true, color: '#bceff4' });
    yy += 12;

    const dossier = this.codexBossView(enemy);
    heading(
      enemy.typeHint === 'Boss'
        ? `COMBAT KIT  /  ${dossier.observed} OF ${dossier.total} OBSERVED`
        : enemy.source === 'encounter' ? 'COMBAT KIT' : 'MOVE KIT',
      accentText
    );
    dossier.rows.forEach((move) => {
      para(move.text, {
        size: 13,
        color: move.revealed ? '#dbe6f0' : '#788694',
        italic: !move.revealed
      });
      yy += 5;
    });
    yy += 8;

    heading('SILHOUETTE', '#e8c24a');
    para(enemy.silhouette, { size: 13 });
    yy += 12;

    heading('FASHION DIRECTION', '#c9a6ff');
    const fashionDirection = enemy.source === 'reserve'
      ? this.codexData?.reserveEnemyFashionDirections[enemy.id]
        ?? (this.codexDataPending() ? 'Loading reserve fashion direction...' : enemy.visualBrief)
      : enemy.visualBrief;
    para(fashionDirection, { size: 13 });
    yy += 12;

    heading('ART CONTRACT', '#7f93a8');
    para(enemy.artPose, { size: 12, italic: true, color: UI_SOFT });

    const contentBottom = yy + this.detailScroll;
    const SCROLL_PAD = 16;
    this.detailMaxScroll = Math.max(0, (contentBottom - viewTop) - viewH + SCROLL_PAD);
    this.detailScrollTarget = clamp(this.detailScrollTarget, 0, this.detailMaxScroll);
    this.detailScroll = clamp(this.detailScroll, 0, this.detailMaxScroll);

    const closeDetail = () => this.closeCodexDetail();
    const curtainX = tx - 24;
    const curtainW = right - curtainX - 1;
    this.root.add(this.add.rectangle(0, 0, GAME_WIDTH, mTop, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(0, mBottom, GAME_WIDTH, GAME_HEIGHT - mBottom, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(curtainX, mTop + 1, curtainW, viewTop - mTop - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(curtainX, viewBottom, curtainW, mBottom - viewBottom - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x000000, 0).setStrokeStyle(2, accent, 1));
    this.renderCodexDossierHeader(
      left,
      right,
      mTop,
      'ENEMY FIELD DOSSIER',
      `${enemy.source === 'encounter' ? 'PLAYABLE ENCOUNTER' : 'RESERVE CONCEPT'} / ${enemy.district.toUpperCase()}`,
      accent,
      accentText
    );
    this.root.add(this.add.rectangle(tx - 18, (viewTop + viewBottom) / 2, 2, viewH - 8, accent, 0.5));

    if (this.detailMaxScroll > 0) {
      this.renderCodexScrollCue(right - 64, mBottom - 18, this.detailScroll >= this.detailMaxScroll);
    }

    this.renderCodexCloseControl(right - 26, mTop + 26, closeDetail);
  }
}
