import { setTextureFilter } from '../game/texture-filter';
import Phaser from 'phaser';
import { loadFlyway } from '../game/flyway-loader';
import { rivalChapter, type PreenBranch } from '../game/flyway-rules';
import { scaledRouteHeal } from '../game/difficulty';
import { consumeSaveRecoveryGamepad } from '../game/save-recovery-dialog';
import { observeChoiceInput, bindChoiceHint } from '../game/choice-input-hints';
import { handleEventChoice, renderEventChoiceReader, eventChoiceState, eventChoiceHint } from '../game/route-event-reading';
import { renderPracticeBadge } from '../game/practice-session';
import { memoryStorageSessionActive } from '../game/safe-storage';
import routeCommitStreakUrl from '../../assets/runtime/fx/route-commit-streak.webp';
import { alphaEncounterLibrary, alphaMapProfileLibrary, alphaBasinSet, alphaCacheSet, alphaNestSet, alphaSignalLibrary, alphaRouteMarkLibrary, alphaSupplyLibrary, alphaCardSet } from '../game/runtime-data';
import { hashSeed } from '../game/route-gen';
import { flockHandTarget } from '../game/hand-size';
import { seededRng, rarityStep } from '../game/deterministic-draw';
import type { RouteNode, RuntimeSupply, RuntimeRouteMark } from '../game/types';
import { getLeader, defaultLeaderId } from '../game/leaders';
import { type CardAcquisitionSource, loadAccount, saveAccount } from '../game/meta';
import { ROUTE_DECK_VISIBLE_ROWS, MIN_SUPPORTED_TOUCH_TARGET, UI_FIELD, UI_FONT, UI_BOLD, UI_DISPLAY_FONT as TOKEN_DISPLAY_FONT, UI_GOLD, UI_CYAN, UI_SOFT, UI_BODY, DECISION_UI } from '../game/theme';
import { quietButton, quietText } from '../game/quiet-ui';
import { pendingOverlay, renderModuleStatus } from '../game/pending-overlay';
import { type RuntimeImageAsset, queuePreloadImageAssets, uniqueImageAssets, queueRuntimeImageAssets } from '../game/runtime-images';
import { killTweensForScene, countTextureInGameObjects, setDisplayTreeDepth, advanceGameTime } from '../game/scene-runtime';
import { firstFlightGuideStep, markFirstFlightGuideSeen, recordFirstFlightGuideEvent, firstFlightGuideState } from '../game/first-flight-guide';
import { controlPanelRegistryKey, controlCaptureRegistryKey, controlActionForCode, controlPanelOwnsInput, bindControlActions, controlBindingLabel } from '../game/input-bindings';
import { setGraphicsQualityPreference, prefersLeanEffects, graphicsQualityState } from '../game/graphics-quality';
import { setVisualContrastPreference, setColorCuePreference, setScreenShakePreference, setFlashEffectsPreference, colorCueState, visualContrastState } from '../game/visual-accessibility';
import { announceScreenReader, setScreenReaderPreference, screenReaderState } from '../game/screen-reader-accessibility';
import { compactBossTests, routeDecisionRead, distinctMeaningfulUpgradeCards, draftComplementaryRewardPair, rewardBuildObservations, hasMeaningfulCardUpgrade, REWARD_RARITY_WEIGHTS } from '../game/balance';
import { parseEffect, parseEffectValue } from '../game/effects/effect-parser';
import { fitTextExcerpt } from '../game/text-excerpt';
import { type RouteEffectContext, resolveRouteEffect as resolveRouteEffectRule, checkRouteCondition as checkRouteEffectCondition } from '../game/effects/route-effect-runner';
import type { Card, CardPickerMode, DeckReviewFilter, DeckReviewSort, MarketCardListing, MarketCategory, MarketDecisionPreview, MarketUtilityListing, MarketWaymarkListing, NodeChoiceOption, PendingRouteReward, PendingRouteRewardItem, RouteCardPickerPlan, RouteSceneData, RunState, SupplyFeedback } from '../game/shared/runtime-types';
import { LAZY_LOAD_FAILED } from '../game/shared/session-config';
import { alphaMarketConfig, BASE_COHESION, CACHE_SCRAP_REWARD, DECK_REVIEW_FILTERS, DECK_REVIEW_SORTS, DISTRICT_CONTRACT_DEFINITIONS, type DistrictContractId, districtContractProgressValue, KEYSTONE_AT, MARKET_BOSS_GUARD, MARKET_BOSS_GUARD_SHIELD, MARKET_BOSS_GUARD_SKY_GUARD, MARKET_PREEN_PRICE, MARKET_REFRESH_BASE_PRICE, MARKET_ROUTE_MARK_IDS, MARKET_ROUTE_MARK_PRICE, MARKET_ROUTE_SCOUT, MARKET_ROUTE_SCOUT_OPEN_SKY_REDUCTION, routeMarks, runDistrictOrdinal, runMapIndices } from '../game/shared/gameplay-constants';
import { animationPaceTimeScale, animationPacingState, combatPacingState, controlsTextState, currentFlashEffectsState, currentScreenShakeState, motionState, prefersReducedMotion, setAnimationPacePreference, setCombatPacePreference, setMotionPreference, setTextPacePreference, settingsFocusState, syncSceneAnimationPace, textPacingState } from '../game/shared/preferences';
import { SceneAssetReadinessTracker } from '../game/shared/scene-asset-readiness';
import { GAME_HEIGHT, GAME_WIDTH, ROUTE_BOSS_NODE_ICON_SIZE, ROUTE_BOSS_NODE_RADIUS, ROUTE_COMMIT_STREAK_DELAY_MS, ROUTE_COMMIT_STREAK_TEXTURE, ROUTE_CONFIRM_HIT_SIZE, ROUTE_CONFIRM_ICON_SIZE, ROUTE_CONFIRM_LABEL_OFFSET_X, ROUTE_CONFIRM_LABEL_WIDTH, ROUTE_NODE_FOCUS_PAD, ROUTE_NODE_ICON_SIZE, ROUTE_NODE_LAYOUT_PAD, ROUTE_NODE_RADIUS } from '../game/shared/layout-constants';
import { type CardComparisonModule, type CardHoverDetailModule, type CardHoverDetailView, type FlockStatsOverlayModule, loadCardComparisonModule, loadCardHoverDetailModule, loadCodexSceneModule, loadFlockStatsOverlayModule, loadRouteDebugStateModule, loadRouteDeckBrowserModule, loadRouteMapRendererModule, loadRouteRewardOverlayModule, loadRouteSecondaryPresentationModule, loadRouteSupplyDrawerModule, loadSavedDeckModule, loadWaymarkReviewModule, ownedWaymarkReviewEntry, registerCodexScene, type RouteDebugStateModule, type RouteDeckBrowserModule, type RouteMapRendererModule, type RouteRewardOverlayModule, type RouteSecondaryPresentationModule, type RouteSupplyDrawerModule, type SavedDeckModule, type SceneWaymarkReviewEntry, type WaymarkReviewModule } from '../game/shared/lazy-modules';
import { cardArtAssets, cardThumbArtAssets, DEFAULT_ROUTE_MAP_BACKDROP_ASSET, ROUTE_EVENT_BACKDROP_ASSETS, ROUTE_EVENT_PROP_ASSETS, ROUTE_EVENT_RESIDENT_ASSETS, ROUTE_SET_PIECE_PROFILES, routeEssentialUiIconIds, routeNodeIconAssets, routeUiIconIds, scrapArtAsset, snagCardBorderAsset, supplyCompactArtAssets, uiIconAssets, type UiIconId, waymarkCompactArtAssets } from '../art-assets';
import { addUiIconImage, queueRequiredUiIconAssets, queueRouteSceneEssentialArt, queueRouteSceneEventArt, queueTrackedUiIconAssets, queueUiIconAssets, withRuntimeLoadTimeout } from '../game/shared/asset-loading';
import { cacheDrawerProfile, collectionGoalSummary, marketIconForKicker, renderCollectionGoalStrip } from '../game/shared/ui-iconography';
import { activeMapIndex, activeSeed, arcanaRewardPool, cardLibrary, currentCombatNodeIds, currentMap, MARKET_SUPPLY_PROXY_MARKS, priceInBand, recordRunCardAcquisitions, runSupplyCapacity, setActiveMapIndex, setActiveRouteRhythm, setActiveSeed } from '../game/shared/run-session';
import { birdAudio } from '../game/shared/bird-audio-director';
import { cardsFromSave, clearActiveRun, cloneCard, cloneRunState, createInitialRunState, persistActiveRun } from '../game/shared/run-state';
import { activeCardContract, cardCompactArtAsset, cardLabel, compactCardArtKey, displayName, displayText, isSnagCard, loadedCardArtKey, renderSnagCardBorder } from '../game/shared/card-presentation';
import { suitAccentColor } from '../game/shared/combat-status';
import { activateRenderedAudioToggleControl, addWaymarkWithCapacity, audioToggleWaveBurstState, clamp, playUiSound, renderAudioToggleControl, renderCloseControl, renderConfirmRunExitOverlay, renderFieldPanel, renderPauseMenuOverlay, renderPauseToggleControl, renderSettingsMenuOverlay, renderUnifiedRunHud } from '../game/shared/ui-helpers';
import { compactEffectGrammar, compactSentenceText, formatEffects } from '../game/shared/effect-text';
import { aggregateFlockStats, buildFlockStatRows, cardStatRows, cardStatTotalRows, getInspectedEntry, inspectedCardPayload, targetLabel } from '../game/shared/card-stats';
import { formatWaymarkTrigger, nonCombatLesson, rewardProfileForRouteNode, routeEffectSummary, routeEffectSummaryWithPreview, routeEventAccent, routeEventLandmarkLine, routeMarkEffects, routeMarkEffectText, routeMarkFamilyLabel, routeNodeRecovery, routeNodeResolutionText, routeNodeTitle, routeNodeTypeLabel, supplyAccent, waymarkSynergyTags } from '../game/shared/route-text';
import { getEncounterEnemiesByPayload } from '../game/shared/enemy-moves';

type RouteCheckpointOutcome = 'idle' | 'saved' | 'failed';


// Codex: a collection screen reachable from the menu. Cards stay discovery
// gated; reserve enemy concepts are browsable as a design/bestiary section.
export class RouteScene extends Phaser.Scene {
  private runState!: RunState;
  private selectableNodeIds = new Set<string>();
  private selectedNodeId: string | undefined;
  private districtContractFocusIndex = 0;
  private nodeChoiceOpen = false;
  private nodeChoiceNodeId: string | undefined;
  private routeCardPickerRestoreState: RunState | undefined;
  private routeCardRewardChoices: Card[] = [];
  private routeRewardChoiceIndex = 0;
  private routeRewardInspectionCardId: string | undefined;
  routeRewardArmedCardId: string | undefined;
  routeSupplyRewardChoices: string[] = [];
  routeSupplyRewardChoiceIndex = 0;
  routeSupplyRewardArmedId: string | undefined;
  private routeStaticCardRewardChoiceIds = new Map<string, string[]>();
  private routeStaticSupplyRewardChoiceIds = new Map<string, string[]>();
  private routeStaticItemRewardChoices = new Map<string, PendingRouteRewardItem>();
  private routeStaticCacheRewardEffects = new Map<string, string[]>();
  private pendingRouteReward: PendingRouteReward | undefined;
  private cardPickerMode: CardPickerMode | undefined;
  private cardPickerContext: 'route' | 'market' | 'districtPreen' | undefined;
  private cardPickerRemainingPicks = 0;
  cardPickerFocusIndex = 0;
  cardPickerInspectionOpen = false;
  cardPickerArmedIndex: number | undefined;
  private marketPickerUtilitySlot: number | undefined;
  private deckOverlayOpen = false;
  private flockOverlayOpen = false;
  private flockOverlayMode: 'stats' | 'boss' | 'map' = 'stats';
  private mapInspectionNodeId?: string;
  private mapInspectionPage = 0;
  private mapInspectionModule?: typeof import('../game/route-map-inspection');
  private mapInspectionLoading = false;
  private mapInspectionFailed = false;
  private bossPrepPage = 0;
  private waymarkDrawerOpen = false;
  private supplyDrawerOpen = false;
  private supplyDrawerFocusIndex = 0;
  private supplyDrawerArmedIndex: number | undefined;
  private supplyDrawerInputActive = false;
  private marketOpen = false;
  private marketCategory: MarketCategory = 'cards';
  private routeCardArtRequested = new Set<string>();
  private routeCardArtFailed = new Set<string>();
  private confirmExitOpen = false;
  private pauseOverlayOpen = false;
  private settingsOverlayOpen = false;
  private marketNodeId: string | undefined;
  marketMessage = '';
  private marketRefreshCount = 0;
  private marketCardShelf: MarketCardListing[] = [];
  private marketWaymarkShelf: MarketWaymarkListing[] = [];
  private marketUtilityShelf: MarketUtilityListing[] = [];
  private inspectedCardId: string | undefined;
  private hoverCardDetail?: Phaser.GameObjects.Container;
  private marketItemHover?: Phaser.GameObjects.Container;
  marketFocusId?: string;
  marketFocusArmedId?: string;
  marketDecisionPreview: MarketDecisionPreview = [];
  marketBuildObservations: string[] = [];
  private routeChoiceHover?: Phaser.GameObjects.Container;
  private cardReviewScroll = 0;
  private deckReviewFilter: DeckReviewFilter = 'all';
  private deckReviewSort: DeckReviewSort = 'run';
  private deckReviewQuery = '';
  private deckReviewSearchActive = false;
  private deckReviewCompareCardId: string | undefined;
  private deckSaveStatus: 'idle' | 'loading' | 'saved' | 'full' | 'failed' = 'idle';
  private deckSaveRequestId = 0;
  private deckSaveTimer?: ReturnType<typeof globalThis.setTimeout>;
  private cardPickerScroll = 0;
  private routeWaymarkScroll = 0;
  private routeWaymarkSelectedId: string | undefined;
  private routeWaymarkPinnedId: string | undefined;
  private routeEventArtRequested = new Set<RouteNode['type']>();
  private routeEssentialAssetsReady = false;
  private routeArtworkRefreshPending = false;
  private resumeRouteArtwork = () => {
    this.routeArtworkRefreshPending = false;
    this.refreshRouteArtwork();
  };
  private flushRouteArtwork = () => {
    if (this.sys.isPaused()) {
      this.events.once(Phaser.Scenes.Events.RESUME, this.resumeRouteArtwork);
      return;
    }
    // A background image must not dismiss the tooltip the player is reading.
    // Keep one pending repaint until its existing close path releases it.
    const tooltip = this.children.getByName('route-node-tooltip');
    if (this.sys.isActive() && tooltip?.active) {
      tooltip.once(Phaser.GameObjects.Events.DESTROY, () => {
        this.routeArtworkRefreshPending = false;
        this.refreshRouteArtwork();
      });
      return;
    }
    this.routeArtworkRefreshPending = false;
    if (!this.sys.isActive()) return;
    if (this.hoverCardDetail?.active && (this.cardPickerInspectionOpen || this.routeRewardInspectionCardId)) {
      this.updateTextState(); return;
    }
    this.renderAll();
  };
  private routeEssentialUiReady = false;
  private routeMapRendererReady = false;
  private routeMapRendererModule?: RouteMapRendererModule;
  private routeSecondaryPresentationModule?: RouteSecondaryPresentationModule;

  private openSecondaryPresentation() {
    if (this.children.getByName('route-secondary-pending')) return;
    pendingOverlay(this, () => {}, loadRouteSecondaryPresentationModule, module => {
      this.routeSecondaryPresentationModule = module;
      this.renderAll();
    }, () => {
      if (this.cardPickerMode) {
        if (this.marketOpen) this.cancelMarketCardPicker();
        else this.cancelRouteCardPicker();
      } else this.leaveMarket();
    }).setName('route-secondary-pending').setDepth(300);
  }
  private routeAssetReadiness = new SceneAssetReadinessTracker();
  private routeMapBackdrop?: RuntimeImageAsset;
  private supplyFeedback: SupplyFeedback[] = [];
  private marketPurchaseFlourishBursts = 0;
  private marketPurchaseFlourishReplay?: { x: number; y: number; accent: number; expiresAt: number };
  private districtAdvanceNotice?: RunState['districtAdvanceNotice'];
  private districtAdvanceFlourishBursts = 0;
  private districtAdvanceFlourishShown = false;
  private districtContractCelebration?: { id: DistrictContractId; name: string; rewardScrap: number; expiresAt: number };
  private routeCommitStreakBursts = 0;
  private routeCommitPending = false;
  private routeDecisionStartedAtMs = 0;
  private systemOverlayRefreshQueued = false;
  private flockStatsOverlayModule?: FlockStatsOverlayModule;
  private flockStatsOverlayLoading = false;
  private flockStatsOverlayFailed = false;
  private cardHoverDetailModule?: CardHoverDetailModule;
  private cardHoverDetailLoading = false;
  private cardHoverDetailRequest?: CardHoverDetailView;
  private cardComparisonModule?: CardComparisonModule;
  private cardComparisonLoading = false;
  private cardComparisonFailed = false;
  private routeDeckBrowserModule?: RouteDeckBrowserModule;
  private routeDeckBrowserLoading = false;
  private routeDeckBrowserFailed = false;
  private routeSupplyDrawerModule?: RouteSupplyDrawerModule;
  private routeSupplyDrawerLoading = false;
  private routeSupplyDrawerFailed = false;
  private routeRewardOverlayModule?: RouteRewardOverlayModule;
  private routeRewardOverlayLoading = false;
  private routeRewardOverlayFailed = false;
  private waymarkReviewModule?: WaymarkReviewModule;
  private waymarkReviewLoading = false;
  private waymarkReviewFailed = false;
  private routeDebugStateModule?: RouteDebugStateModule;
  private savedDeckModule?: SavedDeckModule;
  private controllerButtonsDown = new Set<string>();
  private routeCheckpointAttempt?: string;
  private routeCheckpointIndicator?: Phaser.GameObjects.Container;
  private routeCheckpointTimer?: Phaser.Time.TimerEvent;
  private routeCodexOpening = false;
  private routeCheckpointState: {
    outcome: RouteCheckpointOutcome;
    label: string;
    visible: boolean;
    writes: number;
    failures: number;
  } = {
    outcome: 'idle',
    label: '',
    visible: false,
    writes: 0,
    failures: 0,
  };

  constructor() {
    super('RouteScene');
  }

  init(data: RouteSceneData = {}) {
    this.registry.set(controlPanelRegistryKey(this), false);
    this.registry.remove(controlCaptureRegistryKey(this));
    this.runState = cloneRunState(data.runState ?? createInitialRunState());
    const deckReviewCardIndex = this.runState.deck.findIndex((card) => card.id === data.card);
    setActiveMapIndex(this.runState.mapIndex ?? 0);
    setActiveRouteRhythm(this.runState.flyway?.routeRhythm === 1);
    setActiveSeed(this.runState.seed ?? 'alpha');
    this.ensureDistrictContract();
    this.districtContractCelebration = undefined;
    // Right after a claimed card reward, never default to "Skip two card rewards".
    this.districtContractFocusIndex = this.runState.rewardEvents?.at(-1)?.skipped === false
      && this.districtContractChoices()[0].id === 'lean_route' ? 1 : 0;
    const completedContract = this.runState.districtContracts?.find((contract) => contract.completed && !contract.celebrated);
    const completedContractDefinition = completedContract
      ? DISTRICT_CONTRACT_DEFINITIONS.find((definition) => definition.id === completedContract.id)
      : undefined;
    if (completedContract && completedContractDefinition) {
      completedContract.celebrated = true;
      this.districtContractCelebration = {
        id: completedContract.id,
        name: completedContractDefinition.name,
        rewardScrap: completedContractDefinition.rewardScrap,
        expiresAt: Date.now() + 1800,
      };
    }
    const districtAdvanced = Boolean(this.runState.districtAdvanceNotice);
    const districtPreenPicks = districtAdvanced
      ? Math.max(0, this.runState.freePreenNextDistrict ?? 0)
      : Math.max(0, this.runState.pendingDistrictPreens ?? 0);
    if (districtAdvanced) {
      this.runState.freePreenNextDistrict = 0;
      this.runState.pendingDistrictPreens = districtPreenPicks;
    }
    this.selectableNodeIds = new Set(this.getSelectableNodes().map((node) => node.id));
    this.selectedNodeId = this.getSelectableNodes()[0]?.id;
    this.routeDecisionStartedAtMs = Date.now();
    this.nodeChoiceOpen = false;
    this.nodeChoiceNodeId = undefined;
    this.routeCardPickerRestoreState = undefined;
    this.routeCardRewardChoices = [];
    this.routeRewardChoiceIndex = 0;
    this.routeRewardInspectionCardId = undefined;
    this.routeRewardArmedCardId = undefined;
    this.routeSupplyRewardChoices = [];
    this.routeSupplyRewardChoiceIndex = 0;
    this.routeSupplyRewardArmedId = undefined;
    this.routeStaticCardRewardChoiceIds.clear();
    this.routeStaticSupplyRewardChoiceIds.clear();
    this.routeStaticItemRewardChoices.clear();
    this.routeStaticCacheRewardEffects.clear();
    this.pendingRouteReward = undefined;
    this.cardPickerMode = undefined;
    this.cardPickerContext = undefined;
    this.cardPickerRemainingPicks = 0;
    this.cardPickerFocusIndex = 0;
    this.cardPickerInspectionOpen = false;
    this.cardPickerArmedIndex = undefined;
    this.marketPickerUtilitySlot = undefined;
    this.deckOverlayOpen = deckReviewCardIndex >= 0;
    this.flockOverlayOpen = false;
    this.waymarkDrawerOpen = false;
    this.supplyDrawerOpen = false;
    this.supplyDrawerFocusIndex = 0;
    this.supplyDrawerArmedIndex = undefined;
    this.supplyDrawerInputActive = false;
    this.marketOpen = false;
    this.marketCategory = 'cards';
    this.routeCardArtRequested.clear();
    this.routeCardArtFailed.clear();
    this.pauseOverlayOpen = false;
    this.settingsOverlayOpen = false;
    this.marketNodeId = undefined;
    this.marketMessage = '';
    this.marketRefreshCount = 0;
    this.marketCardShelf = [];
    this.marketWaymarkShelf = [];
    this.marketUtilityShelf = [];
    this.inspectedCardId = data.card;
    this.hoverCardDetail = undefined;
    this.marketItemHover = undefined;
    this.cardReviewScroll = Math.max(0, deckReviewCardIndex - ROUTE_DECK_VISIBLE_ROWS + 1);
    this.deckReviewFilter = 'all';
    this.deckReviewSort = 'run';
    this.deckReviewQuery = '';
    this.deckReviewSearchActive = false;
    this.deckReviewCompareCardId = undefined;
    this.deckSaveStatus = 'idle';
    this.cancelDeckSave();
    this.cardPickerScroll = 0;
    this.routeWaymarkScroll = 0;
    this.routeWaymarkSelectedId = undefined;
    this.routeWaymarkPinnedId = undefined;
    this.routeEventArtRequested.clear();
    this.routeEssentialAssetsReady = false;
    this.routeEssentialUiReady = false;
    this.routeMapRendererReady = false;
    this.routeMapRendererModule = undefined;
    this.routeAssetReadiness.reset([
      'route-essential-ui',
      'route-essential-art',
      'route-full-ui',
    ]);
    this.routeMapBackdrop = currentMap().id === 'map_01_rooftop_blocks' ? DEFAULT_ROUTE_MAP_BACKDROP_ASSET : undefined;
    this.supplyFeedback = [];
    this.marketPurchaseFlourishBursts = 0;
    this.marketPurchaseFlourishReplay = undefined;
    this.districtAdvanceNotice = this.runState.districtAdvanceNotice;
    this.runState.districtAdvanceNotice = undefined;
    this.districtAdvanceFlourishBursts = 0;
    this.districtAdvanceFlourishShown = false;
    this.routeCommitStreakBursts = 0;
    this.routeCommitPending = false;
    this.systemOverlayRefreshQueued = false;
    this.flockStatsOverlayLoading = false;
    this.flockStatsOverlayFailed = false;
    this.cardHoverDetailLoading = false;
    this.cardHoverDetailRequest = undefined;
    this.cardComparisonLoading = false;
    this.cardComparisonFailed = false;
    this.routeDeckBrowserLoading = false;
    this.routeDeckBrowserFailed = false;
    this.routeSupplyDrawerLoading = false;
    this.routeSupplyDrawerFailed = false;
    this.routeRewardOverlayLoading = false;
    this.routeRewardOverlayFailed = false;
    this.waymarkReviewLoading = false;
    this.waymarkReviewFailed = false;
    this.routeCheckpointAttempt = undefined;
    this.routeCheckpointIndicator = undefined;
    this.routeCheckpointTimer?.remove(false);
    this.routeCheckpointTimer = undefined;
    this.routeCodexOpening = false;
    this.routeCheckpointState = {
      outcome: 'idle',
      label: '',
      visible: false,
      writes: 0,
      failures: 0,
    };
    if (districtPreenPicks > 0) {
      const eligibleCount = this.pickerEligibleCards('preen', 'districtPreen').length;
      if (eligibleCount > 0) {
        this.cardPickerMode = 'preen';
        this.cardPickerContext = 'districtPreen';
        this.cardPickerRemainingPicks = Math.min(districtPreenPicks, eligibleCount);
        this.runState.pendingDistrictPreens = this.cardPickerRemainingPicks;
        this.runState.routeLog.push(
          `District prep ready: choose ${this.cardPickerRemainingPicks} card${this.cardPickerRemainingPicks === 1 ? '' : 's'} to Preen.`,
        );
      } else {
        this.runState.pendingDistrictPreens = 0;
        this.runState.routeLog.push('District prep: no unpreened card remains.');
      }
      this.runState.routeLog = this.runState.routeLog.slice(-8);
    }
  }

  preload() {
    if (!this.textures.exists(ROUTE_COMMIT_STREAK_TEXTURE)) {
      this.load.image(ROUTE_COMMIT_STREAK_TEXTURE, routeCommitStreakUrl);
    }
    queuePreloadImageAssets(
      this,
      [
        scrapArtAsset,
        snagCardBorderAsset
      ],
      'Route scene art'
    );
  }

  create() {
    loadFlyway(this);
    syncSceneAnimationPace(this);
    birdAudio.setMood('route');
    this.routeArtworkRefreshPending = false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.STEP, this.flushRouteArtwork);
      this.events.off(Phaser.Scenes.Events.RESUME, this.resumeRouteArtwork);
      this.routeArtworkRefreshPending = false;
    });
    observeChoiceInput(this);
    window.__birdSquadAudio = () => birdAudio.snapshot();
    void loadRouteDebugStateModule()
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.routeDebugStateModule = module;
        this.updateTextState();
      })
      .catch((error) => console.warn('Route text-state module failed to load.', error));
    void loadSavedDeckModule()
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.savedDeckModule = module;
      })
      .catch(console.warn);
    this.time.paused = false;
    this.tweens.resumeAll();
    this.cameras.main.setBackgroundColor('#08101d');
    this.cameras.main.fadeIn(200);
    void withRuntimeLoadTimeout(loadRouteMapRendererModule(), 'Route map renderer')
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.routeMapRendererModule = module;
        this.routeMapRendererReady = true;
        this.queueRouteEssentialAssetLoad();
      })
      .catch((error) => {
        console.warn(LAZY_LOAD_FAILED, error);
        if (!this.sys.settings.active) return;
        this.routeMapRendererReady = true;
        this.queueRouteEssentialAssetLoad();
      });
    this.preloadCardHoverDetail();
    queueTrackedUiIconAssets(this, routeUiIconIds, 'Route UI', (result) => {
      this.routeAssetReadiness.settle('route-full-ui', result);
      this.markRouteFullArtReady();
      this.refreshRouteArtwork();
    });
    this.renderAll();
    if (this.districtContractCelebration) {
      birdAudio.play('objectiveComplete', 1);
      this.time.delayedCall(1800, () => {
        this.districtContractCelebration = undefined;
        if (this.scene.isActive()) this.renderAll();
      });
    }

    this.input.keyboard?.on('keydown-UP', () => {
      if (controlActionForCode('ArrowUp')) return;
      if (handleEventChoice(this, 'previous')) return;
      if (this.supplyDrawerOpen) this.moveRouteSupplyFocus(-1);
      else if (this.waymarkDrawerOpen) this.moveRouteWaymarkSelection(-3);
      else if (this.deckOverlayOpen) this.moveDeckReviewSelection(-1);
      else if (this.marketOpen) this.cardHoverDetailModule?.cycleMarketFocus(this, -1);
      else this.cycleSelectableRouteNode(-1);
    });
    this.input.keyboard?.on('keydown-DOWN', () => {
      if (controlActionForCode('ArrowDown')) return;
      if (handleEventChoice(this, 'next')) return;
      if (this.supplyDrawerOpen) this.moveRouteSupplyFocus(1);
      else if (this.waymarkDrawerOpen) this.moveRouteWaymarkSelection(3);
      else if (this.deckOverlayOpen) this.moveDeckReviewSelection(1);
      else if (this.marketOpen) this.cardHoverDetailModule?.cycleMarketFocus(this, 1);
      else this.cycleSelectableRouteNode(1);
    });
    this.input.keyboard?.on('keydown-TAB', (event: KeyboardEvent) => {
      if (handleEventChoice(this, event.shiftKey ? 'previous' : 'next')) { event.preventDefault(); return; }
      if (this.supplyDrawerOpen) this.moveRouteSupplyFocus(1);
      else if (this.waymarkDrawerOpen) this.moveRouteWaymarkSelection(1);
      else if (this.deckOverlayOpen) this.moveDeckReviewSelection(1);
      else if (this.marketOpen) this.cardHoverDetailModule?.cycleMarketFocus(this, 1);
      else this.cycleSelectableRouteNode(1);
    });
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.marketOpen && (event.code === 'Home' || event.code === 'End') && !controlActionForCode(event.code)) {
        if (!event.repeat && this.cardHoverDetailModule?.changeMarketReaderSection(this, event.code === 'Home' ? -1 : 1)) event.preventDefault();
        return;
      }
      if (this.waymarkDrawerOpen && (event.code === 'PageUp' || event.code === 'PageDown') && !controlActionForCode(event.code)) {
        event.preventDefault();
        this.waymarkReviewModule?.changeWaymarkPage(this, event.code === 'PageUp' ? -1 : 1);
        return;
      }
      this.handleDeckReviewSearchKey(event);
    });
    this.input.keyboard?.on('keydown-C', (event: KeyboardEvent) => {
      if (!this.waymarkDrawerOpen || controlActionForCode(event.code)) return;
      event.preventDefault?.();
      this.toggleRouteWaymarkPin();
    });
    const onRouteGamepadDown = (_pad: Phaser.Input.Gamepad.Gamepad, button: { index?: number }) => {
      if (consumeSaveRecoveryGamepad(button.index)) return;
      if (controlPanelOwnsInput(this)) return;
      if (this.settingsOverlayOpen || this.pauseOverlayOpen) return;
      if (this.flockOverlayOpen) {
        if (button.index === 1) this.closeFlockOverlay();
        return;
      }
      if (button.index === 4 && this.openMapInspection()) return;
      if (this.waymarkDrawerOpen && (button.index === 4 || button.index === 5)) {
        this.waymarkReviewModule?.changeWaymarkPage(this, button.index === 4 ? -1 : 1);
        return;
      }
      if (this.deckOverlayOpen && !this.deckReviewSearchActive && (button.index === 4 || button.index === 5)) {
        this.cardComparisonModule?.changeComparisonPage(this, button.index === 4 ? -1 : 1);
        this.cardHoverDetailModule?.changeSceneCardDetailPage(this, button.index === 4 ? -1 : 1);
        return;
      }
      if (button.index === 1) {
        if (handleEventChoice(this, 'back')) return;
        if (this.routeRewardInteractionModule()?.handleRouteRewardAction(this, 'back')) return;
        if (this.supplyDrawerOpen) this.cancelOrCloseRouteSupplyDrawer();
        else if (this.routeRewardInspectionCardId) this.closeRouteRewardInspection();
        else if (this.pendingRouteReward) this.cancelRouteCardReward();
        else if (this.marketOpen) this.leaveMarket();
      } else if (this.marketOpen && !this.cardPickerMode && (button.index === 4 || button.index === 5)) {
        this.cardHoverDetailModule?.cycleMarketCategory(this, button.index === 4 ? -1 : 1);
      } else if (this.marketOpen && !this.cardPickerMode && (button.index === 6 || button.index === 7)) {
        this.cardHoverDetailModule?.changeMarketReaderSection(this, button.index === 6 ? -1 : 1);
      } else if (button.index === 2) {
        if (this.supplyDrawerOpen) this.closeSupplyDrawer();
        else if (!this.deckOverlayOpen && !this.waymarkDrawerOpen && !this.marketOpen && !this.nodeChoiceOpen && !this.pendingRouteReward && !this.cardPickerMode) this.openSupplyDrawer(true);
        else if (this.waymarkDrawerOpen) this.toggleRouteWaymarkPin();
        else if (this.deckOverlayOpen && !this.deckReviewSearchActive) this.toggleDeckReviewComparison();
      } else if (button.index === 3) {
        if (this.openBossPrep()) return;
        if (this.supplyDrawerOpen) { this.routeSupplyDrawerModule?.turnSupplyDrawerPage(this); return; }
        if (handleEventChoice(this, 'inspect')) return;
        if (this.routeRewardInteractionModule()?.handleRouteRewardAction(this, 'inspect')) return;
        if (this.deckOverlayOpen && !this.deckReviewSearchActive) this.saveCurrentDeckToFolio();
      } else if (
        button.index === 11
        && this.children.list.some((child) => child.name === 'route-collection-goal-hit')
      ) this.openRouteCollectionGoals();
    };
    const onSaveDeck = (event: KeyboardEvent) => {
      if (!this.deckOverlayOpen || this.deckReviewSearchActive || controlActionForCode(event.code)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.saveCurrentDeckToFolio();
    };
    const onCollectionGoals = (event: KeyboardEvent) => {
      if (!this.children.list.some((child) => child.name === 'route-collection-goal-hit')) return;
      event.preventDefault();
      event.stopPropagation();
      this.openRouteCollectionGoals();
    };
    this.input.keyboard?.on('keydown-V', onSaveDeck);
    this.input.keyboard?.on('keydown-G', onCollectionGoals);
    const onInspectMap = (event: KeyboardEvent) => {
      if (!event.repeat && !controlActionForCode(event.code) && this.openMapInspection()) event.preventDefault();
    };
    this.input.keyboard?.on('keydown-I', onInspectMap);
    this.input.keyboard?.on('keydown-F2', onInspectMap);
    this.input.gamepad?.on('down', onRouteGamepadDown);
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown-V', onSaveDeck);
      this.cancelDeckSave();
      this.input.keyboard?.off('keydown-G', onCollectionGoals);
      this.input.keyboard?.off('keydown-I', onInspectMap);
      this.input.keyboard?.off('keydown-F2', onInspectMap);
      this.input.gamepad?.off('down', onRouteGamepadDown);
    });
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((key, index) => this.input.keyboard?.on(`keydown-${key}`, () => {
      if (this.marketOpen) {
        const category: MarketCategory[] = ['cards', 'waymarks', 'supplies', 'services'];
        if (category[index]) this.setMarketCategory(category[index]);
        return;
      }
      if (!this.shouldChooseDistrictContract()) return;
      const choice = this.districtContractChoices()[index];
      if (choice) this.chooseDistrictContract(choice.id);
    }));
    bindControlActions(this, {
      confirm: (event) => {
        if (event?.repeat) return;
        if (handleEventChoice(this, 'confirm')) return;
        if (this.routeRewardInteractionModule()?.handleRouteRewardAction(this, 'confirm')) return;
        if (this.supplyDrawerOpen) {
          this.requestRouteSupplyUse(this.supplyDrawerFocusIndex);
          return;
        }
        if (this.deckOverlayOpen) {
          if (this.deckReviewSearchActive) this.setDeckReviewSearchActive(false);
          else this.cycleDeckReviewSort(1);
          return;
        }
        this.activateRouteSelection();
      },
      previous: (event) => {
        if (handleEventChoice(this, 'previous')) return;
        if (this.routeRewardInteractionModule()?.handleRouteRewardAction(this, 'previous')) return;
        if (this.supplyDrawerOpen) {
          this.moveRouteSupplyFocus(-1);
          return;
        }
        if (this.deckReviewSearchActive) {
          if (event) this.handleDeckReviewSearchKey(event);
          return;
        }
        if (this.waymarkDrawerOpen) {
          this.moveRouteWaymarkSelection(-1);
          return;
        }
        if (this.deckOverlayOpen) {
          this.cycleDeckReviewFilter(-1);
          return;
        }
        if (!this.settingsOverlayOpen && !this.pauseOverlayOpen) this.cycleSelectableRouteNode(-1);
      },
      next: (event) => {
        if (handleEventChoice(this, 'next')) return;
        if (this.routeRewardInteractionModule()?.handleRouteRewardAction(this, 'next')) return;
        if (this.supplyDrawerOpen) {
          this.moveRouteSupplyFocus(1);
          return;
        }
        if (this.deckReviewSearchActive) {
          if (event) this.handleDeckReviewSearchKey(event);
          return;
        }
        if (this.waymarkDrawerOpen) {
          this.moveRouteWaymarkSelection(1);
          return;
        }
        if (this.deckOverlayOpen) {
          this.cycleDeckReviewFilter(1);
          return;
        }
        if (!this.settingsOverlayOpen && !this.pauseOverlayOpen) this.cycleSelectableRouteNode(1);
      },
      mute: (event) => {
        if (this.deckReviewSearchActive) {
          if (event) this.handleDeckReviewSearchKey(event);
          return;
        }
        if (!activateRenderedAudioToggleControl(this)) {
          birdAudio.toggleMute();
          this.refreshRouteSystemOverlay();
        }
      },
      fullscreen: (event) => {
        if (this.deckReviewSearchActive) {
          if (event) this.handleDeckReviewSearchKey(event);
          return;
        }
        this.scale.toggleFullscreen();
      },
      settings: (event) => {
        if (this.deckReviewSearchActive) {
          if (event) this.handleDeckReviewSearchKey(event);
          return;
        }
        if (!this.routeEssentialAssetsReady) return;
        if (!this.pauseOverlayOpen) this.setRoutePaused(true);
        if (!this.settingsOverlayOpen) this.openSettingsOverlay();
      },
      pause: (event) => {
        if (this.deckReviewSearchActive) {
          if (event) this.handleDeckReviewSearchKey(event);
          return;
        }
        if (!this.routeEssentialAssetsReady) return;
        this.togglePauseOverlay();
      },
      roost: (event) => {
        if (!event?.repeat && this.openBossPrep()) return;
        if (this.supplyDrawerOpen) { if (!event?.repeat) this.routeSupplyDrawerModule?.turnSupplyDrawerPage(this); return; }
        if (this.waymarkDrawerOpen) { this.toggleRouteWaymarkPin(); return; }
        if (!handleEventChoice(this, 'inspect')) this.routeRewardInteractionModule()?.handleRouteRewardAction(this, 'inspect');
      },
      skipReward: () => {
        if (this.supplyDrawerOpen) this.closeSupplyDrawer();
        else if (!this.deckOverlayOpen && !this.flockOverlayOpen && !this.waymarkDrawerOpen && !this.marketOpen && !this.nodeChoiceOpen && !this.pendingRouteReward && !this.cardPickerMode) this.openSupplyDrawer(true);
      },
      back: () => {
        if (!this.routeEssentialAssetsReady) return;
        if (this.deckReviewSearchActive) {
          this.setDeckReviewSearchActive(false);
          return;
        }
        if (this.settingsOverlayOpen) {
          this.settingsOverlayOpen = false;
          playUiSound('close');
          this.refreshRouteSystemOverlay();
          return;
        }
        if (this.pauseOverlayOpen) {
          this.setRoutePaused(false);
          return;
        }
        if (this.routeRewardInteractionModule()?.handleRouteRewardAction(this, 'back')) return;
        if (this.cardPickerMode && this.cardPickerContext === 'market') {
          this.cancelMarketCardPicker();
          return;
        }
        if (handleEventChoice(this, 'back') || this.cardPickerMode) return;
        if (this.confirmExitOpen) {
          this.confirmExitOpen = false;
          this.renderAll();
          return;
        }
        if (this.marketOpen) {
          this.leaveMarket();
          return;
        }
        if (this.deckOverlayOpen) {
          this.closeDeckOverlay();
          return;
        }
        if (this.flockOverlayOpen) {
          this.closeFlockOverlay();
          return;
        }
        if (this.waymarkDrawerOpen) {
          this.closeWaymarkDrawer();
          return;
        }
        if (this.supplyDrawerOpen) {
          this.cancelOrCloseRouteSupplyDrawer();
          return;
        }
        this.setRoutePaused(true);
      },
    });
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      // Scene-level wheel events also fire over modal scrims. Keep the active
      // reader/system panel in charge and ignore horizontal-only gestures.
      if (!deltaY || this.pauseOverlayOpen || this.settingsOverlayOpen || this.confirmExitOpen) return;
      if (this.cardPickerInspectionOpen || this.routeRewardInspectionCardId) {
        this.routeRewardInteractionModule()?.handleRouteRewardAction(this, deltaY > 0 ? 'next' : 'previous');
        return;
      }
      if (this.cardPickerMode) {
        this.scrollCardPicker(deltaY > 0 ? 1 : -1);
        return;
      }
      if (this.waymarkDrawerOpen) {
        if (this.waymarkReviewModule?.handleWaymarkWheel(this, _pointer, deltaY)) return;
        this.scrollRouteWaymarks(deltaY > 0 ? 1 : -1);
        return;
      }
      if (this.supplyDrawerOpen) return;
      if (!this.deckOverlayOpen || this.marketOpen) return;
      this.scrollDeck(deltaY > 0 ? 1 : -1);
    });
  }

  private renderAll() {
    // Runtime asset callbacks can settle during the short route-travel beat.
    // Preserve its transient streak/tweens until commitment hands off; the
    // destination path performs the next stable render or scene transition.
    if (this.routeCommitPending) {
      this.updateTextState();
      return;
    }
    killTweensForScene(this);
    // DisplayList.removeAll(true) skips removal callbacks; it does not destroy
    // objects. Retire the snapshot so readers and Settings release their input
    // listeners/ownership, including children removed by a container's destroy.
    for (const child of this.children.list.slice()) child.destroy();
    this.routeCheckpointIndicator = undefined;
    renderPracticeBadge(this);
    this.hoverCardDetail = undefined;
    this.marketItemHover = undefined;
    this.marketDecisionPreview = [];
    this.routeChoiceHover = undefined;
    if (!this.routeEssentialAssetsReady) {
      this.renderRouteReadinessScreen();
      this.updateTextState();
      return;
    }
    this.renderBackdrop();
    this.renderRouteMap();
    this.renderFlywayRestoration();
    this.renderRouteDistrictBanner();
    if (this.shouldShowBossPrepDossier()) this.renderBossPrepDossier();
    this.renderDistrictAdvanceFlourish();
    this.renderFirstRouteGuidance();
    this.renderDistrictContract();
    this.renderDistrictContractCelebration();
    const contractChoiceOpen = this.shouldChooseDistrictContract();
    const hasBlockingOverlay = contractChoiceOpen || this.pauseOverlayOpen || this.settingsOverlayOpen || this.deckOverlayOpen || this.flockOverlayOpen || this.waymarkDrawerOpen || this.supplyDrawerOpen || this.marketOpen || this.nodeChoiceOpen || !!this.pendingRouteReward || !!this.cardPickerMode;
    if (!hasBlockingOverlay) {
      this.renderRouteSupplyFeedbackStrip();
    }
    if (this.deckOverlayOpen) this.renderMapDeckOverlay();
    if (this.marketOpen) this.renderMarketOverlay();
    if (this.nodeChoiceOpen) this.renderNodeChoiceOverlay();
    if (this.pendingRouteReward) this.renderRouteCardRewardOverlay();
    if (this.cardPickerMode) this.renderCardPickerOverlay();
    if (contractChoiceOpen) this.renderDistrictContractChoice();
    if (!this.confirmExitOpen) this.renderRunHud();
    if (this.waymarkDrawerOpen) this.renderRouteWaymarkDrawer();
    if (this.flockOverlayOpen) this.renderRouteFlockOverlay();
    if (this.supplyDrawerOpen) this.renderRouteSupplyDrawer();
    renderEventChoiceReader(this);
    if (this.confirmExitOpen) this.renderConfirmExitOverlay();
    if (this.pauseOverlayOpen) this.renderPauseOverlay();
    if (this.settingsOverlayOpen) this.renderSettingsOverlay();
    this.replayMarketPurchaseFlourish();
    if (!this.marketOpen && !this.nodeChoiceOpen && !this.pendingRouteReward && !this.cardPickerMode) {
      this.checkpointRouteIfChanged(); // checkpoint: resume lands back on the route map
    }
    this.renderRouteCheckpointFeedback();
    this.updateTextState();
    if (this.pauseOverlayOpen) this.tweens.pauseAll();
  }

  private checkpointRouteIfChanged(force = false) {
    let snapshot: string;
    try {
      snapshot = JSON.stringify(this.runState);
    } catch {
      snapshot = '';
    }
    if (!force && snapshot === this.routeCheckpointAttempt) return;
    this.routeCheckpointAttempt = snapshot;
    const saved = !!snapshot.length && persistActiveRun(this.runState);
    this.routeCheckpointState = {
      outcome: saved ? 'saved' : 'failed',
      label: saved ? 'FLIGHT SAVED' : 'SAVE UNAVAILABLE',
      visible: true,
      writes: this.routeCheckpointState.writes + (saved ? 1 : 0),
      failures: this.routeCheckpointState.failures + (saved ? 0 : 1),
    };
    if (!saved) {
      announceScreenReader('Flight could not be saved. Keep this tab open to preserve the current run.');
    }
    this.routeCheckpointTimer?.remove(false);
    this.routeCheckpointTimer = undefined;
    // A failed checkpoint remains actionable until a later write succeeds.
    if (saved) this.routeCheckpointTimer = this.time.delayedCall(1800, () => {
      this.routeCheckpointState.visible = false;
      this.routeCheckpointIndicator?.destroy(true);
      this.routeCheckpointIndicator = undefined;
      this.updateTextState();
    });
  }

  private renderRouteCheckpointFeedback() {
    this.routeCheckpointIndicator?.destroy(true);
    this.routeCheckpointIndicator = undefined;
    if (!this.routeCheckpointState.visible || !this.routeEssentialAssetsReady) return;
    if (this.deckOverlayOpen || this.flockOverlayOpen || this.waymarkDrawerOpen || this.supplyDrawerOpen
      || this.marketOpen || this.nodeChoiceOpen || this.pendingRouteReward || this.cardPickerMode
      || this.pauseOverlayOpen || this.settingsOverlayOpen || this.confirmExitOpen) return;
    const saved = this.routeCheckpointState.outcome === 'saved';
    if (this.shouldShowBossPrepDossier()) {
      const name = this.children.getByName('boss-prep-name') as Phaser.GameObjects.Text | undefined;
      const phase = this.children.getByName('boss-prep-pressure') as Phaser.GameObjects.Text | undefined;
      name?.setX(saved ? 110 : 370);
      phase?.setX(saved ? 110 : 370).setText(saved
        ? 'Phase II at 50% · Review before crossing' : 'Phase II at 50%');
      if (saved) return;
    }
    if (saved && this.isFirstRouteDecision()) return;
    const x = 210;
    const y = this.shouldShowBossPrepDossier() ? 671 : 656;
    const indicator = this.add.container(x, y)
      .setDepth(48)
      .setName('route-checkpoint-feedback');
    const plate = this.add.graphics().setName('route-checkpoint-feedback-plate');
    const height = saved ? 40 : MIN_SUPPORTED_TOUCH_TARGET;
    plate.fillStyle(0x050b14, 0.9);
    plate.fillRoundedRect(-126, -height / 2, 252, height, 6);
    plate.lineStyle(1.5, saved ? UI_FIELD.cyan : 0xff9b7a, 0.86);
    plate.strokeRoundedRect(-126, -height / 2, 252, height, 6);
    const pip = this.add.circle(-108, 0, 4, saved ? UI_FIELD.cyan : 0xff765f, 0.95)
      .setStrokeStyle(1, saved ? UI_FIELD.gold : 0xffc1a8, 0.9);
    const label = this.add.text(-94, 0, saved ? this.routeCheckpointState.label : 'SAVE FAILED · RETRY', {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: saved ? '#bff8ff' : '#ffd0bf',
      stroke: '#03070d',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0, 0.5);
    indicator.add([plate, pip, label]);
    if (!saved) {
      const retry = this.add.rectangle(0, 0, 252, height, 0, 0)
        .setName('route-checkpoint-retry-hit').setInteractive({ useHandCursor: true });
      retry.on('pointerdown', () => {
        this.checkpointRouteIfChanged(true);
        this.renderRouteCheckpointFeedback();
        this.updateTextState();
      });
      indicator.add(retry);
    }
    this.routeCheckpointIndicator = indicator;
  }

  private cycleSelectableRouteNode(direction: -1 | 1) {
    if (!this.routeEssentialAssetsReady) return;
    if (this.shouldChooseDistrictContract()) {
      const count = this.districtContractChoices().length;
      this.focusDistrictContract((this.districtContractFocusIndex + direction + count) % count);
      return;
    }
    if (this.routeCommitPending || this.pauseOverlayOpen || this.settingsOverlayOpen || this.confirmExitOpen) return;
    if (this.deckOverlayOpen || this.flockOverlayOpen || this.waymarkDrawerOpen || this.supplyDrawerOpen || this.marketOpen || this.nodeChoiceOpen || this.pendingRouteReward || this.cardPickerMode) return;
    const selectable = this.getSelectableNodes();
    if (!selectable.length) return;
    const current = selectable.findIndex((node) => node.id === this.selectedNodeId);
    const next = current < 0 ? 0 : (current + direction + selectable.length) % selectable.length;
    this.selectedNodeId = selectable[next].id;
    this.renderAll();
  }

  private renderFlywayRestoration() {
    if (this.flockOverlayOpen) return;
    const { restoredSegments, totalSegments } = this.flywayRestorationProgress();
    if (restoredSegments <= 0) return;
    // Meta-progress belongs outside the route graph: a diagonal rail reads as
    // a playable connection even though it has no corresponding destination.
    // It sits in the header row beside the district banner: the graph below
    // is reserved for nodes, which the old lower-left plate used to cover.
    this.add.rectangle(872, 158, 252, 40, 0x050b14, 0.94)
      .setDepth(7).setName('flyway-restoration');
    const segmentWidth = (224 - (totalSegments - 1) * 6) / totalSegments;
    for (let index = 0; index < totalSegments; index += 1) {
      this.add.rectangle(760 + index * (segmentWidth + 6), 172, segmentWidth, 3,
        index < restoredSegments ? UI_FIELD.cyan : 0x49606d, 0.9)
        .setOrigin(0, 0.5)
        .setDepth(8)
        .setName('flyway-restoration');
    }
    this.add.text(760, 152, `FLYWAY  ${restoredSegments}/${totalSegments} RESTORED`, {
      fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: '#bff8ff', resolution: 2,
    }).setOrigin(0, 0.5).setDepth(8).setName('flyway-restoration');
  }

  private flywayRestorationProgress() {
    const mapIndices = runMapIndices(this.runState.runMode ?? 'full');
    const clearedDistricts = mapIndices.filter((mapIndex) => mapIndex < activeMapIndex).length;
    const completedContracts = (this.runState.districtContracts ?? []).filter((contract) => contract.completed).length;
    return {
      restoredSegments: Math.min(mapIndices.length, clearedDistricts + completedContracts),
      totalSegments: mapIndices.length
    };
  }

  private queueRouteEssentialAssetLoad() {
    const openInteractiveRoute = () => {
      // The route map already has complete procedural/glyph fallbacks. Do not
      // hold the first decision behind the much heavier district backdrop and
      // eight painted node icons; they can replace the fallbacks in place.
      if (!this.routeEssentialUiReady || !this.routeMapRendererReady || this.routeEssentialAssetsReady || !this.sys.settings.active) return;
      this.routeEssentialAssetsReady = true;
      this.routeAssetReadiness.markInteractive();
      this.markRouteFullArtReady();
      this.renderAll();
    };
    queueRequiredUiIconAssets(this, routeEssentialUiIconIds, 'Essential route UI', (result) => {
      this.routeAssetReadiness.settle('route-essential-ui', result);
      this.routeEssentialUiReady = true;
      openInteractiveRoute();
    });
      queueRouteSceneEssentialArt(this, currentMap().id, 'Route node art', (backdrop, result) => {
        this.routeMapBackdrop = backdrop;
        this.routeAssetReadiness.settle('route-essential-art', result);
        this.markRouteFullArtReady();
      if (this.routeEssentialAssetsReady) this.refreshRouteArtwork();
    });
  }

  private markRouteFullArtReady() {
    if (!this.routeEssentialAssetsReady) return;
    if (!this.routeAssetReadiness.groupSettled('route-essential-art')) return;
    if (!this.routeAssetReadiness.groupSettled('route-full-ui')) return;
    this.routeAssetReadiness.markFullArt();
  }

  update() {
    const pad = this.input.gamepad?.pad1;
    if (!pad?.connected) {
      this.controllerButtonsDown.clear();
      return;
    }
    if (controlPanelOwnsInput(this)) return;
    if (this.deckOverlayOpen) {
      const deckControls: Array<[string, boolean, () => void]> = [
        ['deck-up', pad.up, () => this.moveDeckReviewSelection(-1)],
        ['deck-down', pad.down, () => this.moveDeckReviewSelection(1)],
        ['deck-filter-previous', pad.left, () => this.cycleDeckReviewFilter(-1)],
        ['deck-filter-next', pad.right, () => this.cycleDeckReviewFilter(1)],
        ['deck-sort', pad.A, () => this.cycleDeckReviewSort(1)],
      ];
      deckControls.forEach(([id, pressed, action]) => {
        if (pressed && !this.controllerButtonsDown.has(id)) action();
        if (pressed) this.controllerButtonsDown.add(id);
        else this.controllerButtonsDown.delete(id);
      });
      return;
    }
    if (this.supplyDrawerOpen) {
      const supplyControls: Array<[string, boolean, () => void]> = [
        ['supply-previous', pad.left || pad.up, () => this.moveRouteSupplyFocus(-1)],
        ['supply-next', pad.right || pad.down, () => this.moveRouteSupplyFocus(1)],
        ['supply-confirm', pad.A, () => this.requestRouteSupplyUse(this.supplyDrawerFocusIndex)],
      ];
      supplyControls.forEach(([id, pressed, action]) => {
        if (pressed && !this.controllerButtonsDown.has(id)) action();
        if (pressed) this.controllerButtonsDown.add(id);
        else this.controllerButtonsDown.delete(id);
      });
      return;
    }
    if (this.nodeChoiceOpen) {
      // Share the confirm latch with the route map: a held arrival press must
      // not choose the first event, or carry through into its reward review.
      const controls: Array<[string, boolean, () => void]> = [
        ['previous', pad.left || pad.up, () => handleEventChoice(this, 'previous')],
        ['next', pad.right || pad.down, () => handleEventChoice(this, 'next')],
        ['confirm', pad.A, () => handleEventChoice(this, 'confirm')],
        ['pause', pad.isButtonDown(9), () => this.togglePauseOverlay()],
      ];
      controls.forEach(([id, pressed, action]) => {
        if (pressed && !this.controllerButtonsDown.has(id)) action();
        if (pressed) this.controllerButtonsDown.add(id);
        else this.controllerButtonsDown.delete(id);
      });
      return;
    }
    if (this.routeRewardInteractionModule()?.updateRouteRewardGamepad(this, pad, this.controllerButtonsDown)) return;
    const controls: Array<[string, boolean, () => void]> = [
      ['previous', pad.left || pad.up, () => this.cycleSelectableRouteNode(-1)],
      ['next', pad.right || pad.down, () => this.cycleSelectableRouteNode(1)],
      ['confirm', pad.A, () => this.activateRouteSelection()],
      ['pause', pad.isButtonDown(9), () => this.togglePauseOverlay()]
    ];
    controls.forEach(([id, pressed, action]) => {
      if (pressed && !this.controllerButtonsDown.has(id)) action();
      if (pressed) this.controllerButtonsDown.add(id);
      else this.controllerButtonsDown.delete(id);
    });
  }

  private activateRouteSelection() {
    if (!this.routeEssentialAssetsReady || this.settingsOverlayOpen || this.pauseOverlayOpen) return;
    if (this.deckOverlayOpen || this.flockOverlayOpen || this.waymarkDrawerOpen || this.supplyDrawerOpen || this.marketOpen) return;
    if (this.shouldChooseDistrictContract()) {
      const choice = this.districtContractChoices()[this.districtContractFocusIndex];
      if (choice) this.chooseDistrictContract(choice.id);
      return;
    }
    const target = (this.selectedNodeId && this.selectableNodeIds.has(this.selectedNodeId))
      ? this.selectedNodeId
      : this.getSelectableNodes()[0]?.id;
    if (target) this.commitRouteNodeAnimated(target);
  }

  private renderRouteReadinessScreen() {
    const backdropAsset = this.routeMapBackdrop;
    const backdropKey = backdropAsset && this.textures.exists(backdropAsset.key)
      ? backdropAsset.key
      : 'splash';
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, backdropKey)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(0.72);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020711, 0.76)
      .setInteractive({ useHandCursor: false });
    this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 38, 34, 0x07131d, 0.96)
      .setStrokeStyle(3, UI_FIELD.cyan, 0.88);
    this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 38, 15, UI_FIELD.gold, 0.9)
      .setStrokeStyle(2, 0x07131d, 0.9);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 22, 'Charting the route...', {
      fontFamily: TOKEN_DISPLAY_FONT,
      fontSize: '28px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 62, `Reading ${currentMap().name}, safe roosts, and the next crossing.`, {
      fontFamily: UI_FONT,
      fontSize: '14px',
      color: UI_CYAN
    }).setOrigin(0.5);
  }

  private togglePauseOverlay() {
    if (this.confirmExitOpen) {
      this.confirmExitOpen = false;
      this.renderAll();
      return;
    }
    if (this.routeCommitPending || this.nodeChoiceOpen || this.pendingRouteReward || this.cardPickerMode) return;
    this.settingsOverlayOpen = false;
    this.setRoutePaused(!this.pauseOverlayOpen);
  }

  private setRoutePaused(paused: boolean) {
    if (this.pauseOverlayOpen === paused) return;
    this.pauseOverlayOpen = paused;
    playUiSound(paused ? 'confirm' : 'close');
    if (!paused) {
      this.time.paused = false;
      this.tweens.resumeAll();
    }
    this.renderAll();
    if (paused) {
      this.time.paused = true;
      this.tweens.pauseAll();
    }
  }

  private refreshRouteSystemOverlay() {
    if (this.systemOverlayRefreshQueued) return;
    this.systemOverlayRefreshQueued = true;
    this.events.once('postupdate', () => {
      this.systemOverlayRefreshQueued = false;
      if (!this.sys.settings.active) return;
      this.renderAll();
    });
  }

  private openSettingsOverlay() {
    this.settingsOverlayOpen = true;
    playUiSound('confirm');
    this.refreshRouteSystemOverlay();
  }

  private queueDeckCardArtLoad() {
    const ids = new Set(this.runState.deck.map((card) => card.id));
    this.queueCardThumbArtLoad([...ids], 'Route deck art');
  }

  marketShelfArtAssets() {
    return uniqueImageAssets([
      ...this.marketCardShelf.map((offer) => cardThumbArtAssets[offer.id] ?? cardArtAssets[offer.id]),
      this.marketWaymarkShelf.length ? uiIconAssets['market-waymark-badge'] : undefined,
      ...this.marketUtilityShelf.map((offer) => this.marketUtilityShelfArtAsset(offer)),
      uiIconAssets['market-refresh-service']
    ]);
  }

  private queueMarketShelfArtLoad() {
    this.queueRouteCardArtwork(
      uniqueImageAssets([
        ...this.marketCardShelf.map((offer) => cardThumbArtAssets[offer.id] ?? cardArtAssets[offer.id]),
        ...this.marketWaymarkShelf.map((offer) => waymarkCompactArtAssets[offer.id]),
        ...this.marketUtilityShelf.map((offer) => supplyCompactArtAssets[offer.supplyId ?? '']),
      ]),
      'Market art'
    );
  }

  /** Render passes observe one attempt; only an explicit recovery starts another. */
  private queueRouteCardArtwork(assets: Array<RuntimeImageAsset | undefined>, warning: string) {
    const pending = uniqueImageAssets(assets).filter(asset =>
      !this.textures.exists(asset.key) && !this.routeCardArtRequested.has(asset.key));
    if (!pending.length) return;
    pending.forEach(asset => this.routeCardArtRequested.add(asset.key));
    queueRuntimeImageAssets(this, pending, warning, result => {
      result.loadedKeys.forEach(key => {
        this.routeCardArtFailed.delete(key);
        this.routeCardArtRequested.delete(key);
      });
      // A soft timeout is still loading, not an invitation to duplicate it.
      if (!result.timedOut) result.failedKeys.forEach(key => this.routeCardArtFailed.add(key));
      this.refreshRouteArtwork();
    });
  }

  retryRouteCardArtwork() {
    if ((!this.marketOpen && !this.cardPickerMode) || this.pauseOverlayOpen || this.settingsOverlayOpen
      || this.cardPickerInspectionOpen || !this.routeCardArtFailed.size) return false;
    this.routeCardArtFailed.forEach(key => this.routeCardArtRequested.delete(key));
    this.routeCardArtFailed.clear();
    this.renderAll();
    return true;
  }

  private renderRouteCardArtRetry(x: number, y: number) {
    if (!this.routeCardArtFailed.size) return;
    quietButton(this, { x, y, width: 160, label: `Retry art · ${controlBindingLabel('roost')}`,
      name: 'route-art-retry-hit', onActivate: () => { this.retryRouteCardArtwork(); } });
  }

  private queueCardThumbArtLoad(ids: string[], warning: string) {
    if (ids.length === 0) return;
    queueRuntimeImageAssets(
      this,
      ids.map((id) => cardThumbArtAssets[id] ?? cardArtAssets[id]),
      warning,
      () => this.refreshRouteArtwork()
    );
  }

  private refreshRouteArtwork() {
    // Background shelf/UI assets can finish while an explicit reader is open.
    // Its opaque modal already owns the interaction; rebuild the updated shelf
    // when reading closes, never replace its controls for an unrelated image.
    if (this.hoverCardDetail?.active && (this.cardPickerInspectionOpen || this.routeRewardInspectionCardId)) {
      this.updateTextState();
      return;
    }
    if (this.routeArtworkRefreshPending || (!this.sys.isActive() && !this.sys.isPaused())) return;
    this.routeArtworkRefreshPending = true;
    // Rebuild before the scene's InputPlugin PRE_UPDATE registers hit areas.
    // A later scene PRE_UPDATE listener creates visible controls that cannot
    // receive input until the following frame.
    this.game.events.once(Phaser.Core.Events.STEP, this.flushRouteArtwork);
  }

  private queueCardPortraitArtLoad(card: Pick<Card, 'id'>, warning: string, onComplete: () => void = () => this.refreshRouteArtwork()) {
    queueRuntimeImageAssets(
      this,
      [cardArtAssets[card.id]],
      warning,
      onComplete
    );
  }

  private queueRouteRewardCardArtLoad() {
    const cards = [
      ...this.routeCardRewardChoices,
      ...(this.pendingRouteReward?.previewCards ?? [])
    ];
    if (cards.length === 0) return;
    queueRuntimeImageAssets(
      this,
      uniqueImageAssets(cards.map((card) => cardCompactArtAsset(card))),
      'Reward card art',
      () => this.refreshRouteArtwork()
    );
  }

  private queueCardPickerArtLoad(entries: Array<{ card: Card }>) {
    if (!entries.length) return;
    this.queueRouteCardArtwork(
      uniqueImageAssets(entries.map((entry) => cardCompactArtAsset(entry.card))),
      'Card picker art'
    );
  }

  private queueRouteRewardItemArtLoad() {
    const item = this.pendingRouteReward?.previewItem;
    const supplyChoices = this.routeSupplyRewardChoices
      .map((id) => supplyCompactArtAssets[id])
      .filter((asset): asset is RuntimeImageAsset => Boolean(asset));
    if (!item && supplyChoices.length === 0) return;
    queueRuntimeImageAssets(
      this,
      uniqueImageAssets([
        ...(item ? [item.kind === 'supply' ? supplyCompactArtAssets[item.id] : waymarkCompactArtAssets[item.id]] : []),
        ...supplyChoices,
      ]),
      'Item art',
      () => this.refreshRouteArtwork()
    );
  }

  private queueRouteEventArtLoad(node?: RouteNode) {
    if (!node || this.routeEventArtRequested.has(node.type)) return;
    this.routeEventArtRequested.add(node.type);
    queueRouteSceneEventArt(this, node.type, `${node.label} art`, () => this.refreshRouteArtwork());
  }

  private queueRouteRewardUiLoad() {
    queueUiIconAssets(this, ['reward-reveal-halo'], 'Reward UI', () => this.refreshRouteArtwork());
  }

  private routeEventBackdropAsset(node?: RouteNode) {
    return node ? ROUTE_EVENT_BACKDROP_ASSETS[node.type] : undefined;
  }

  private routeEventResidentAsset(node?: RouteNode) {
    return node ? ROUTE_EVENT_RESIDENT_ASSETS[node.type] : undefined;
  }

  private queueRouteEventBackdropArtLoad(node?: RouteNode) {
    this.queueRouteEventArtLoad(node);
  }

  private queueRouteEventSetPieceArtLoad(node?: RouteNode) {
    this.queueRouteEventArtLoad(node);
  }

  private queueRouteSupplyArtLoad() {
    queueRuntimeImageAssets(
      this,
      this.runState.supplies.map((id) => supplyCompactArtAssets[id]),
      'Route supply art',
      () => this.refreshRouteArtwork()
    );
  }

  private queueRouteWaymarkArtLoad() {
    queueRuntimeImageAssets(
      this,
      this.runState.routeMarks.map((id) => waymarkCompactArtAssets[id]),
      'Route waymark art',
      () => this.refreshRouteArtwork()
    );
  }

  private renderRouteEventBackdrop(
    node?: RouteNode,
    opacity = 0.74,
    options: { showBottomBand?: boolean } = {}
  ) {
    this.queueRouteEventBackdropArtLoad(node);
    const asset = this.routeEventBackdropAsset(node);
    const hasBackdrop = !!asset && this.textures.exists(asset.key);
    if (hasBackdrop && asset) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, asset.key)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(opacity);
    }
    const accent = node ? routeEventAccent(node.type) : UI_FIELD.gold;
    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x020409,
      hasBackdrop ? 0.28 : 0.74
    ).setInteractive({ useHandCursor: false });
    this.add.rectangle(GAME_WIDTH / 2, 78, GAME_WIDTH, 156, 0x020409, hasBackdrop ? 0.42 : 0.18);
    if (options.showBottomBand ?? true) {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 66, GAME_WIDTH, 132, 0x020409, hasBackdrop ? 0.46 : 0.18);
    }
    // Short corner glints sit with the painted set rather than drawing a
    // viewport-wide colored ruler over its horizon or floor.
    for (const edgeX of [86, GAME_WIDTH - 86]) {
      this.add.rectangle(edgeX, 25, 44, 2, accent, hasBackdrop ? 0.38 : 0.22);
      this.add.rectangle(edgeX, GAME_HEIGHT - 29, 44, 2, accent, hasBackdrop ? 0.3 : 0.18);
    }
  }

  private renderConfirmExitOverlay() {
    renderConfirmRunExitOverlay(this, () => {}, {
      onKeepPlaying: () => {
        this.confirmExitOpen = false;
        this.renderAll();
      },
      onAbandonRun: () => {
        clearActiveRun();
        this.scene.start('MenuScene');
      },
    });
  }

  private renderBackdrop() {
    const layout = this.routeLayout();
    const backdropAsset = this.routeMapBackdrop;
    const backdropKey = backdropAsset && this.textures.exists(backdropAsset.key)
      ? backdropAsset.key
      : 'splash';
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, backdropKey)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(backdropKey === backdropAsset?.key ? 1 : 0.48)
      .setName('route-map-backdrop');
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, backdropKey === backdropAsset?.key ? 0.34 : 0.62);
    renderFieldPanel(this, () => {}, layout.map.cx, layout.map.cy, layout.map.w, layout.map.h, {
      accent: 0x49606d,
      fill: 0x07101a,
      fillAlpha: 0.44,
      showRails: false,
    });
    this.add.rectangle(layout.map.cx, layout.map.cy, layout.map.w - 34, layout.map.h - 34, 0x03070d, 0.14);
    this.renderRouteMapFrame(layout);
    this.events.emit('opening-route-backdrop');

  }

  private renderRunHud() {
    const status = this.routeStatusSummary();
    renderUnifiedRunHud(this, () => {}, {
      context: 'route',
      title: '',
      subtitle: '',
      cohesion: status.cohesion,
      scrap: status.scrap,
      deckSize: status.deckSize,
      waymarks: status.waymarks,
      supplies: status.supplies,
      statusLabel: '',
      statusColor: '#8df4ff',
      flow: 0,
      flowMax: getLeader(this.runState.leaderId).flowMax ?? 0,
      cover: 0,
      resonance: '0/5',
      onFlock: () => this.openFlockOverlay(),
      onDeck: () => this.openDeckOverlay(),
      onWaymarks: () => this.openWaymarkDrawer(),
      onSupplies: () => this.openSupplyDrawer()
    });
    renderPauseToggleControl(this, () => {}, GAME_WIDTH - 100, 45, () => this.togglePauseOverlay());
    renderAudioToggleControl(this, () => {}, GAME_WIDTH - 34, 45, () => this.updateTextState());
    if (
      !this.pauseOverlayOpen
      && !this.settingsOverlayOpen
      && !this.deckOverlayOpen
      && !this.flockOverlayOpen
      && !this.waymarkDrawerOpen
      && !this.supplyDrawerOpen
      && !this.marketOpen
      && !this.nodeChoiceOpen
      && !this.pendingRouteReward
      && !this.cardPickerMode
      && !this.shouldChooseDistrictContract()
      && !this.shouldShowBossPrepDossier()
    ) {
      const hasContract = Boolean(this.children.getByName('district-contract'));
      renderCollectionGoalStrip(
        this,
        hasContract ? 620 : 870,
        hasContract ? 656 : 111,
        300,
        'route-collection-goal-hit',
        (cardId) => this.openRouteCollectionGoals(cardId),
      );
    }
  }

  private openRouteCollectionGoals(openCardId?: string) {
    if (this.routeCodexOpening || !this.routeEssentialAssetsReady) return;
    openCardId ||= this.children.getByName('route-collection-goal-hit')?.getData('newCardId') || undefined;
    this.routeCodexOpening = true;
    persistActiveRun(this.runState);
    const returnData = { runState: cloneRunState(this.runState) };
    const game = this.game;
    void loadCodexSceneModule()
      .then((module) => {
        if (!this.sys.settings.active) return;
        registerCodexScene(game, module);
        this.scene.start('CodexScene', {
          openCollectionAtlas: true,
          openCardId,
          returnScene: 'RouteScene',
          returnData,
        });
      })
      .catch((error) => {
        console.warn(LAZY_LOAD_FAILED, error);
        if (!this.sys.settings.active) return;
        this.routeCodexOpening = false;
        playUiSound('locked');
        this.updateTextState();
      });
  }

  private renderPauseOverlay() {
    renderPauseMenuOverlay(this, () => {}, {
      title: 'Run Paused',
      saveFailed: this.routeCheckpointState.outcome === 'failed',
      subtitle: `${currentMap().name} / ${getLeader(this.runState.leaderId).name}`,
      details: [
        ['Cohesion', `${this.runState.currentHp}/${this.runMaxHp()}`],
        ['Scrap', `${this.runState.scrap}`],
        ['Deck', `${this.runState.deck.length} cards`],
        ['Route', `${this.runState.completedRouteNodeIds.length} cleared`],
      ],
      onResume: () => {
        this.setRoutePaused(false);
      },
      onAbandon: () => {
        this.pauseOverlayOpen = false;
        this.confirmExitOpen = true;
        this.time.paused = false;
        this.tweens.resumeAll();
        this.renderAll();
      },
      onMenu: () => {
        this.checkpointRouteIfChanged(true);
        if (this.routeCheckpointState.outcome === 'failed') {
          playUiSound('locked');
          this.refreshRouteSystemOverlay();
          return;
        }
        this.time.paused = false;
        this.tweens.resumeAll();
        playUiSound('close');
        this.scene.start('MenuScene');
      },
      onToggleAudio: () => this.updateTextState(),
      onSettings: () => this.openSettingsOverlay()
    });
  }

  private renderSettingsOverlay() {
    renderSettingsMenuOverlay(this, () => {}, {
      title: 'Settings',
      subtitle: `${currentMap().name} / Route`,
      onClose: () => {
        this.settingsOverlayOpen = false;
        playUiSound('close');
        this.refreshRouteSystemOverlay();
      },
      onToggleAudio: () => this.updateTextState(),
      onSetMusicVolume: (value) => {
        birdAudio.setMusicVolume(value);
        this.refreshRouteSystemOverlay();
      },
      onSetSfxVolume: (value) => {
        birdAudio.setSfxVolume(value);
        this.refreshRouteSystemOverlay();
      },
      onSetVoiceVolume: (value) => {
        birdAudio.setVoiceVolume(value);
        this.refreshRouteSystemOverlay();
      },
      onSetAmbienceVolume: (value) => {
        birdAudio.setAmbienceVolume(value);
        this.refreshRouteSystemOverlay();
      },
      onSetMotionPreference: (value) => {
        setMotionPreference(value);
        this.refreshRouteSystemOverlay();
      },
      onSetVisualContrastPreference: (value) => {
        setVisualContrastPreference(value);
        this.refreshRouteSystemOverlay();
      },
      onSetColorCuePreference: (value) => {
        setColorCuePreference(value);
        this.refreshRouteSystemOverlay();
      },
      onSetScreenShakePreference: (value) => {
        setScreenShakePreference(value);
        this.refreshRouteSystemOverlay();
      },
      onSetFlashEffectsPreference: (value) => {
        setFlashEffectsPreference(value);
        this.refreshRouteSystemOverlay();
      },
      onSetGraphicsQualityPreference: (value) => {
        setGraphicsQualityPreference(value);
        this.refreshRouteSystemOverlay();
      },
      onSetCombatPacePreference: (value) => {
        setCombatPacePreference(value);
        this.refreshRouteSystemOverlay();
      },
      onSetAnimationPacePreference: (value) => {
        setAnimationPacePreference(this, value);
        this.refreshRouteSystemOverlay();
      },
      onSetTextPacePreference: (value) => {
        setTextPacePreference(value);
        this.refreshRouteSystemOverlay();
      },
      onSetScreenReaderPreference: (value) => {
        setScreenReaderPreference(value);
        this.refreshRouteSystemOverlay();
      },
      onToggleFullscreen: () => {
        this.scale.toggleFullscreen();
        this.refreshRouteSystemOverlay();
      }
    });
  }

  private renderRouteMapFrame(layout: ReturnType<RouteScene['routeLayout']>) {
    this.routeMapRendererModule?.renderRouteMapFrame(this, layout.map);
  }

  private renderRouteDistrictBanner() {
    const runMode = this.runState.runMode ?? 'full';
    this.routeMapRendererModule?.renderRouteDistrictBanner(this,
      `District ${runDistrictOrdinal(runMode, activeMapIndex)} / ${runMapIndices(runMode).length} · ${currentMap().name}`);
  }

  private shouldShowDistrictAdvanceFlourish() {
    return !!this.districtAdvanceNotice
      && (this.runState.mapIndex ?? 0) > 0
      && !this.runState.currentRouteNodeId;
  }

  districtAdvanceFlourishState() {
    const key = uiIconAssets['district-advance-flourish'].key;
    const count = this.children.list.filter((child: any) => (
      child.texture?.key === key || child.name === 'district-advance-flourish'
    )).length;
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count,
      bursts: this.districtAdvanceFlourishBursts,
      notice: this.districtAdvanceNotice
        ? {
            fromMapName: this.districtAdvanceNotice.fromMapName,
            toMapName: this.districtAdvanceNotice.toMapName,
            toMapIndex: this.districtAdvanceNotice.toMapIndex
          }
        : undefined
    };
  }

  private shouldShowBossPrepDossier() {
    const bossId = currentMap().bossNodeId;
    return this.selectedNodeId === bossId || this.selectableNodeIds.has(bossId);
  }

  districtAdvanceTitlePlaqueState() {
    const key = uiIconAssets['district-advance-title-plaque'].key;
    const count = countTextureInGameObjects(this.children.list, key);
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count,
      notice: this.districtAdvanceNotice
        ? {
            fromMapName: this.districtAdvanceNotice.fromMapName,
            toMapName: this.districtAdvanceNotice.toMapName,
            toMapIndex: this.districtAdvanceNotice.toMapIndex
          }
        : undefined
    };
  }

  private renderDistrictAdvanceFlourish() {
    this.routeMapRendererModule?.renderDistrictAdvanceFlourish(this);
  }

  private renderBossPrepDossier() {
    const prep = this.bossPrepReadiness();
    const cy = this.routeLayout().map.y + this.routeLayout().map.h - 31;
    this.add.rectangle(486, cy, 788, 58, UI_FIELD.ink, 0.96)
      .setStrokeStyle(1, UI_FIELD.brass, 0.42).setName('boss-prep-dossier-backplate');
    this.add.text(110, cy - 24, prep.bossName, {
      fontFamily: UI_FONT, fontSize: '21px', color: UI_GOLD, resolution: 2,
    }).setName('boss-prep-name');
    this.add.text(110, cy + 3, 'Phase II at 50% · Review before crossing', {
      fontFamily: UI_FONT, fontSize: '19px', color: UI_SOFT, resolution: 2,
    }).setName('boss-prep-pressure');
    const hit = quietButton(this, { x: 778, y: cy, width: 184, label: 'Boss prep', name: 'boss-prep-open',
      onActivate: () => this.openBossPrep() });
    bindChoiceHint(this, hit.getData('labelObject'), mode => mode === 'pointer' ? 'Boss prep'
      : 'Prep · ' + (mode === 'controller' ? 'Y' : controlBindingLabel('roost')));
  }

  private openBossPrep() {
    if (!this.routeEssentialAssetsReady || this.routeCommitPending || this.shouldChooseDistrictContract()
      || !this.shouldShowBossPrepDossier() || this.pauseOverlayOpen || this.settingsOverlayOpen
      || this.confirmExitOpen || this.deckOverlayOpen || this.flockOverlayOpen || this.waymarkDrawerOpen
      || this.supplyDrawerOpen || this.marketOpen || this.nodeChoiceOpen || this.pendingRouteReward || this.cardPickerMode) return false;
    this.openFlockOverlay('boss');
    return true;
  }

  private openMapInspection(nodeId = this.selectedNodeId) {
    if (!this.routeEssentialAssetsReady || this.routeCommitPending || this.shouldChooseDistrictContract()
      || this.pauseOverlayOpen || this.settingsOverlayOpen || this.confirmExitOpen || this.deckOverlayOpen
      || this.flockOverlayOpen || this.waymarkDrawerOpen || this.supplyDrawerOpen || this.marketOpen
      || this.nodeChoiceOpen || this.pendingRouteReward || this.cardPickerMode) return false;
    this.mapInspectionNodeId = nodeId ?? currentMap().entryNodeId;
    this.mapInspectionPage = 0;
    this.openFlockOverlay('map');
    return true;
  }

  private routeLayout() {
    return {
      top: { y: 124 },
      map: { x: 32, y: 112, w: 1208, h: 590, cx: 636, cy: 407 },
      // Top clears the banner row (ends at y 179) for a four-lane column; left
      // leaves a gutter for the node legend.
      graph: { left: 104, right: 1158, top: 177, bottom: 638 },
      confirm: { cx: 1138, cy: 662, w: 260, h: 42 },
      footer: { x: 62, y: 612, w: 848, h: 56, cx: 486, cy: 640 }
    };
  }

  private routeStatusSummary() {
    return {
      cohesion: `${this.runState.currentHp}/${this.runMaxHp()}`,
      scrap: this.runState.scrap,
      deckSize: this.runState.deck.length,
      waymarks: this.runState.routeMarks.length,
      supplies: `${this.runState.supplies.length}/${runSupplyCapacity(this.runState)}`
    };
  }

  private routeSupplyFeedbackSummary(supply: RuntimeSupply) {
    return routeEffectSummary(supply.effects);
  }

  private recordRouteSupplyFeedback(supply: RuntimeSupply) {
    this.supplyFeedback = [
      {
        id: supply.id,
        name: supply.name,
        summary: this.routeSupplyFeedbackSummary(supply),
        timing: supply.timing
      },
      ...this.supplyFeedback
    ].slice(0, 4);
  }

  private renderRouteSupplyFeedbackStrip() {
    const latest = this.supplyFeedback[0];
    if (!latest) return;
    const x = 1139;
    const y = 110;
    this.add.rectangle(x, y, 222, 58, 0x07101a, 0.96)
      .setStrokeStyle(1, 0xffb86b, 0.5).setName('route-supply-feedback-frame');
    fitTextExcerpt(this.add.text(x - 99, y - 24, '', {
      fontFamily: UI_FONT, fontSize: '21px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: 198, useAdvancedWrap: true }, resolution: 2,
    }).setName('route-supply-feedback-name'), latest.name, 1);
    this.add.text(x - 99, y + 3, 'Used · Read in Supplies', {
      fontFamily: UI_FONT, fontSize: '19px', color: UI_BODY, resolution: 2,
    }).setName('route-supply-feedback-hint');
  }

  private renderRouteMap() {
    const inspect = quietButton(this, { x: 1128, y: 174, width: 184, label: 'Inspect map',
      name: 'route-map-inspect', kind: 'secondary', onActivate: () => this.openMapInspection() });
    bindChoiceHint(this, inspect.getData('labelObject'), mode => mode === 'controller' ? 'Inspect · LB'
      : mode === 'keyboard' ? `Inspect · ${controlActionForCode('KeyI') ? 'F2' : 'I'}` : 'Inspect map');
    const onChosenPath = new Set(this.runState.completedRouteNodeIds);
    const previewEdges = this.routePreviewEdges();
    const nodes = currentMap().nodes.map((node) => {
      const { x, y } = this.nodePosition(node);
      const boss = node.type === 'boss';
      return {
        id: node.id,
        type: node.type,
        x,
        y,
        radius: boss ? ROUTE_BOSS_NODE_RADIUS : ROUTE_NODE_RADIUS,
        iconSize: boss ? ROUTE_BOSS_NODE_ICON_SIZE : ROUTE_NODE_ICON_SIZE,
        completed: onChosenPath.has(node.id),
        current: this.runState.currentRouteNodeId === node.id,
        selected: this.selectedNodeId === node.id,
        selectable: this.selectableNodeIds.has(node.id),
        boss,
      };
    });
    if (!this.routeMapRendererModule) {
      currentMap().edges.forEach((edge) => {
        const from = nodes.find((node) => node.id === edge.from);
        const to = nodes.find((node) => node.id === edge.to);
        if (from && to) this.add.line(0, 0, from.x, from.y, to.x, to.y, 0x4fb2a9, 0.48).setOrigin(0);
      });
      currentMap().nodes.forEach((node) => this.renderRouteNodeFallback(node, this.selectableNodeIds.has(node.id)));
      const selectedNodeId = this.selectedNodeId;
      if (selectedNodeId && this.selectableNodeIds.has(selectedNodeId)) {
        const confirm = this.routeLayout().confirm;
        this.add.rectangle(confirm.cx, confirm.cy, 150, ROUTE_CONFIRM_HIT_SIZE, 0x06111a, 0.96)
          .setStrokeStyle(2, UI_FIELD.gold, 0.84)
          .setName('route-commit-hit')
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.commitRouteNodeAnimated(selectedNodeId));
        this.add.text(confirm.cx, confirm.cy, 'TAKE ROUTE', {
          fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_GOLD,
        }).setOrigin(0.5).setName('route-commit-label');
      }
      return;
    }
    this.routeMapRendererModule.renderRouteMap({
      scene: this,
      nodes,
      edges: currentMap().edges.map((edge) => {
        const key = this.routeEdgeKey(edge.from, edge.to);
        return {
          from: edge.from,
          to: edge.to,
          key,
          lit: onChosenPath.has(edge.from) && onChosenPath.has(edge.to),
          primaryPreview: previewEdges.primary.has(key),
          secondaryPreview: previewEdges.secondary.has(key),
          available: this.selectableNodeIds.has(edge.to),
        };
      }),
      activeMapIndex,
      fontFamily: UI_FONT,
      boldFontStyle: UI_BOLD,
      renderNodeIcon: (view, alpha) => this.renderRouteNodeTypeIcon(view.type as RouteNode['type'], view.x, view.y, view.iconSize, alpha),
      renderBossBeacon: (view, subdued) => this.renderRouteBossBeaconRing(view.x, view.y, subdued),
      renderSelectedFocus: (view) => this.renderSelectedRouteNodeFocus(view.x, view.y, view.radius),
      showNodeTooltip: (nodeId, x, anchorY) => {
        const node = currentMap().nodes.find((candidate) => candidate.id === nodeId);
        return node ? this.showNodeTooltip(node, x, anchorY) : undefined;
      },
      selectNode: (nodeId) => this.selectRouteNode(nodeId),
      inspectNode: (nodeId) => { this.openMapInspection(nodeId); },
      confirm: this.selectedNodeId && this.selectableNodeIds.has(this.selectedNodeId) ? {
        cx: this.routeLayout().confirm.cx,
        cy: this.routeLayout().confirm.cy,
        labelCx: this.routeLayout().confirm.cx + ROUTE_CONFIRM_LABEL_OFFSET_X,
        labelWidth: ROUTE_CONFIRM_LABEL_WIDTH,
        hitSize: ROUTE_CONFIRM_HIT_SIZE,
        goldColor: UI_FIELD.gold,
        goldText: UI_GOLD,
        addIcon: () => addUiIconImage(this, 'route-commit-medallion', this.routeLayout().confirm.cx, this.routeLayout().confirm.cy, ROUTE_CONFIRM_ICON_SIZE),
        showTooltip: () => this.showSimpleTooltip('Take this route', this.routeLayout().confirm.cx, this.routeLayout().confirm.cy - 60),
        commit: () => this.commitRouteNodeAnimated(this.selectedNodeId!),
      } : undefined,
    });
  }

  private isFirstRouteDecision() {
    return activeMapIndex === 0
      && this.runState.completedRouteNodeIds.length === 0
      && !this.runState.currentRouteNodeId;
  }

  private renderFirstRouteGuidance() {
    const firstDecision = this.isFirstRouteDecision();
    const guideStep = firstFlightGuideStep();
    const guided = guideStep === 'route';
    if (guided) markFirstFlightGuideSeen(guideStep);
    const node = this.selectedNodeId
      ? currentMap().nodes.find((candidate) => candidate.id === this.selectedNodeId)
      : undefined;
    if (!node && !guided && !firstDecision) return;
    const text = node
      ? `GAIN  ${this.nodeDecisionSummary(node).benefit}\nRISK  ${this.nodeDecisionSummary(node).risk}`
      : `${guided ? 'TAKE ROUTE   |   ' : firstDecision ? 'FIRST FLIGHT   |   ' : ''}CHOOSE A BRIGHT NODE   |   REVIEW GAIN + RISK`;
    const name = guided || firstDecision ? 'first-route-guidance' : 'route-decision-dock';
    this.routeMapRendererModule?.renderRouteGuidance({
      scene: this,
      text,
      name,
      selected: Boolean(node),
      fontFamily: UI_FONT,
      boldFontStyle: UI_BOLD,
      goldColor: UI_FIELD.gold,
      cyanColor: UI_FIELD.cyan,
    });
  }

  private districtContractDefinitions() {
    return DISTRICT_CONTRACT_DEFINITIONS;
  }

  private ensureDistrictContract() {
    this.runState.districtContracts ??= [];
    if (this.runState.districtContracts.some((contract) => contract.mapIndex === activeMapIndex)) return;
    const definitions = this.districtContractDefinitions();
    const index = hashSeed(`${activeSeed}:${activeMapIndex}:contract`, activeMapIndex) % definitions.length;
    this.runState.districtContracts.push({
      mapIndex: activeMapIndex,
      id: definitions[index].id,
      baselineCombatResults: this.runState.combatResults?.length ?? 0,
      baselineRewardEvents: this.runState.rewardEvents?.length ?? 0,
      baselineSnags: cardsFromSave(this.runState.deck).filter(isSnagCard).length,
      confirmed: false
    });
  }

  private activeDistrictContract() {
    return this.runState.districtContracts?.find((contract) => contract.mapIndex === activeMapIndex);
  }

  private shouldChooseDistrictContract() {
    const contract = this.activeDistrictContract();
    if (!contract || contract.confirmed !== false) return false;
    if (activeMapIndex === 0 && (this.runState.combatResults?.length ?? 0) === 0) return false;
    return !this.pauseOverlayOpen && !this.settingsOverlayOpen && !this.confirmExitOpen;
  }

  private districtContractChoices() {
    const definitions = this.districtContractDefinitions();
    const start = hashSeed(`${activeSeed}:${activeMapIndex}:contract-offer`, activeMapIndex) % definitions.length;
    return [0, 1, 2].map((offset) => definitions[(start + offset) % definitions.length]);
  }

  private chooseDistrictContract(id: DistrictContractId) {
    const contract = this.activeDistrictContract();
    if (!contract || contract.confirmed !== false || !this.districtContractChoices().some((choice) => choice.id === id)) return;
    contract.id = id;
    contract.confirmed = true;
    contract.baselineCombatResults = this.runState.combatResults?.length ?? 0;
    contract.baselineRewardEvents = this.runState.rewardEvents?.length ?? 0;
    contract.baselineSnags = cardsFromSave(this.runState.deck).filter(isSnagCard).length;
    playUiSound('confirm');
    this.runState.routeLog.push(`Contract accepted: ${this.districtContractDefinitions().find((choice) => choice.id === id)?.name ?? id}.`);
    this.renderAll();
  }

  private focusDistrictContract(index: number) {
    const choice = this.districtContractChoices()[index];
    if (!this.shouldChooseDistrictContract() || !choice) return;
    this.districtContractFocusIndex = index;
    this.children.list.forEach((child: any) => {
      if (child.name === 'district-contract-option') {
        const focused = child.getData('index') === index;
        child.setStrokeStyle(focused ? 3 : 1, focused ? DECISION_UI.accent : DECISION_UI.border, 1);
        child.setData('focused', focused);
      }
      if (child.name === 'district-contract-focus-label') child.setVisible(child.getData('index') === index);
    });
    announceScreenReader(`${choice.name}. ${index + 1} of ${this.districtContractChoices().length}. ${choice.goal}. On completion: ${choice.rewardScrap} Scrap and a record badge. Confirm to accept.`);
    this.updateTextState();
  }

  private renderDistrictContractChoice() {
    const choices = this.districtContractChoices();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.72)
      .setInteractive()
      .setDepth(24000)
      .setName('district-contract-choice');
    this.routeMapRendererModule?.renderDistrictFraming(this, activeMapIndex);
    this.add.rectangle(GAME_WIDTH / 2, 356, 1120, 438, DECISION_UI.surface, 1)
      .setStrokeStyle(1, DECISION_UI.border, 0.8)
      .setDepth(24001)
      .setName('district-contract-choice');
    this.add.text(GAME_WIDTH / 2, 178, 'Choose A District Contract', {
      fontFamily: TOKEN_DISPLAY_FONT, fontSize: '30px', fontStyle: UI_BOLD, color: UI_GOLD
    }).setOrigin(0.5).setDepth(24002);
    this.add.text(GAME_WIDTH / 2, 222, 'Choose a goal for this district. Earn its Scrap and record badge on completion.', {
      fontFamily: UI_FONT, fontSize: '20px', color: DECISION_UI.secondary, resolution: DECISION_UI.resolution,
      fixedWidth: 1000, align: 'center', wordWrap: { width: 1000 }
    }).setOrigin(0.5).setDepth(24002).setName('district-contract-guidance');
    choices.forEach((choice, index) => {
      const x = 310 + index * 330;
      const focused = index === this.districtContractFocusIndex;
      const hit = this.add.rectangle(x, 388, 306, 244, DECISION_UI.raised, 1)
        .setStrokeStyle(focused ? 3 : 1, focused ? DECISION_UI.accent : DECISION_UI.border, 1)
        .setInteractive({ useHandCursor: true })
        .setDepth(24002)
        .setName('district-contract-option').setData('index', index).setData('focused', focused);
      this.add.text(x, 310, choice.name, {
        fontFamily: UI_FONT, fontSize: '22px', fontStyle: UI_BOLD, color: DECISION_UI.text, resolution: 2,
        fixedWidth: 278, align: 'center', wordWrap: { width: 278 }
      }).setOrigin(0.5).setDepth(24003).setName('district-contract-option-name');
      this.add.text(x, 372, choice.goal, {
        fontFamily: UI_FONT, fontSize: '20px', color: DECISION_UI.text, resolution: 2,
        fixedWidth: 278, align: 'center', wordWrap: { width: 278 }
      }).setOrigin(0.5).setDepth(24003).setName('district-contract-option-goal');
      this.add.text(x, 446, `REWARD  +${choice.rewardScrap} Scrap`, {
        fontFamily: UI_FONT, fontSize: '20px', fontStyle: UI_BOLD, color: '#bff4d0', resolution: 2
      }).setOrigin(0.5).setDepth(24003).setName('district-contract-option-reward');
      this.add.text(x, 486, 'SELECTED', {
        fontFamily: UI_FONT, fontSize: '19px', color: DECISION_UI.secondary, resolution: 2
      }).setOrigin(0.5).setDepth(24003).setName('district-contract-focus-label').setData('index', index).setVisible(focused);
      hit.on('pointerover', () => this.focusDistrictContract(index));
      hit.on('pointerdown', () => this.chooseDistrictContract(choice.id));
    });
    this.add.text(GAME_WIDTH / 2, 548,
      `${controlBindingLabel('previous')} / ${controlBindingLabel('next')} or D-pad: choose · ${controlBindingLabel('confirm')} / A: accept`, {
        fontFamily: UI_FONT, fontSize: '18px', color: DECISION_UI.secondary, resolution: 2,
      }).setOrigin(0.5).setDepth(24003).setName('district-contract-input-hint');
  }

  private districtContractProgress(contract = this.activeDistrictContract()) {
    if (!contract || contract.confirmed === false) return undefined;
    const definition = this.districtContractDefinitions().find((candidate) => candidate.id === contract.id)!;
    const current = districtContractProgressValue(
      contract,
      currentMap(),
      cardsFromSave(this.runState.deck),
      this.runState.combatResults ?? [],
      this.runState.rewardEvents ?? [],
      this.runState.currentRouteNodeId,
      this.runState.completedRouteNodeIds
    );
    if (current >= definition.target && !contract.completed) {
      contract.completed = true;
      if (!contract.rewardClaimed) {
        contract.rewardClaimed = true;
        this.runState.scrap += definition.rewardScrap;
        this.runState.scrapEarned = (this.runState.scrapEarned ?? 0) + definition.rewardScrap;
      }
      this.runState.routeLog.push(`Contract complete: ${definition.name}. +${definition.rewardScrap} Scrap and record badge secured.`);
      this.runState.routeLog = this.runState.routeLog.slice(-8);
    }
    return { ...definition, current: Math.min(current, definition.target), completed: Boolean(contract.completed) };
  }

  private renderDistrictContract() {
    if (activeMapIndex === 0 && (this.runState.combatResults?.length ?? 0) === 0) return;
    const progress = this.districtContractProgress();
    if (!progress) return;
    const x = 975;
    const y = 104;
    this.add.rectangle(x, y, 510, 48, 0x06111a, 0.96)
      .setStrokeStyle(1, progress.completed ? UI_FIELD.green : UI_FIELD.gold, 0.65)
      .setName('district-contract');
    this.add.text(x - 239, y - 21, `${progress.completed ? 'COMPLETE' : 'CONTRACT'}  ${progress.name}  ${progress.current}/${progress.target}`, {
      fontFamily: UI_FONT, fontSize: '18px', fontStyle: UI_BOLD, color: progress.completed ? '#bff4d0' : '#ffe7a8'
    }).setResolution(2).setName('district-contract-title');
    this.add.text(x - 239, y + 2, `${progress.goal}  /  +${progress.rewardScrap} Scrap`, {
      fontFamily: UI_FONT, fontSize: '16px', color: '#d2dce5'
    }).setResolution(2).setName('district-contract-goal');
  }

  private renderDistrictContractCelebration() {
    const celebration = this.districtContractCelebration;
    if (!celebration || Date.now() >= celebration.expiresAt) return;
    const x = GAME_WIDTH / 2;
    const y = 208;
    this.add.rectangle(x, y, 520, 68, 0x07131b, 0.98)
      .setStrokeStyle(1, UI_FIELD.green, 0.7).setDepth(25020)
      .setName('district-contract-celebration-frame');
    this.add.text(x, y - 14, 'CONTRACT COMPLETE', {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: '#9af0bb',
      letterSpacing: 1.4,
    }).setOrigin(0.5).setDepth(25021).setName('district-contract-celebration');
    this.add.text(x, y + 10, `${celebration.name}  /  +${celebration.rewardScrap} Scrap  /  Record badge secured`, {
      fontFamily: UI_FONT,
      fontSize: '14px',
      fontStyle: UI_BOLD,
      color: '#f2f7fb',
      fixedWidth: 470,
      align: 'center',
      maxLines: 1,
    }).setOrigin(0.5).setDepth(25021).setName('district-contract-celebration');
  }

  private routeEdgeKey(from: string, to: string) {
    return `${from}->${to}`;
  }

  private routePreviewEdges() {
    const primary = new Set<string>();
    const secondary = new Set<string>();
    if (!this.selectedNodeId) return { primary, secondary };
    const firstHop = currentMap().edges.filter((edge) => edge.from === this.selectedNodeId && !edge.locked);
    firstHop.forEach((edge) => primary.add(this.routeEdgeKey(edge.from, edge.to)));
    firstHop.forEach((edge) => {
      currentMap().edges
        .filter((candidate) => candidate.from === edge.to && !candidate.locked)
        .forEach((candidate) => secondary.add(this.routeEdgeKey(candidate.from, candidate.to)));
    });
    return { primary, secondary };
  }

  private showSimpleTooltip(label: string, x: number, y: number) {
    const container = this.add.container(0, 0);
    const text = this.add.text(0, 0, label, {
      fontFamily: UI_FONT,
      fontSize: '19px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#020409',
      strokeThickness: 2
    }).setOrigin(0.5);
    const width = text.width + 28, height = text.height + 18;
    x = Phaser.Math.Clamp(x, width / 2 + 8, GAME_WIDTH - width / 2 - 8);
    y = Phaser.Math.Clamp(y, height / 2 + 8, GAME_HEIGHT - height / 2 - 8);
    container.add(this.add.rectangle(x, y, width, height, 0x05161f, 0.98)
      .setStrokeStyle(1, UI_FIELD.green, 0.7).setName('route-commit-tooltip-frame'));
    container.add(text.setPosition(x, y));
    return container;
  }



  private nodeDetail(node: RouteNode) {
    const encounter = alphaEncounterLibrary.get(node.payloadId);
    const profile = node.type === 'boss' ? alphaMapProfileLibrary.get(currentMap().id) : undefined;
    return {
      title: node.type==='rival' && (this.runState.flyway?.rivalWins??0)<3 ? `Caldra · ${rivalChapter(this.runState.flyway?.rivalWins).name}` : encounter?.name ?? routeNodeTitle(node),
      lesson: node.type==='rival' && (this.runState.flyway?.rivalWins??0)<3 ? rivalChapter(this.runState.flyway?.rivalWins).weakness : activeMapIndex >= 1 ? encounter?.lesson : undefined,
      bossPrep: profile ? {
        thesis: profile.thesis,
        tests: [...profile.primaryTests],
        testLabels: compactBossTests(profile.primaryTests),
        hints: [...profile.bossPrepHints],
      } : undefined,
    };
  }

  private nodeDecisionSummary(node: RouteNode) {
    const encounter = alphaEncounterLibrary.get(node.payloadId);
    const choiceNodes = node.type === 'cache' || node.type === 'signal';
    const choices = choiceNodes ? this.nodeChoiceList(node).filter((choice) => choice.key !== 'decline') : [];
    return routeDecisionRead({
      type: node.type,
      risk: node.risk,
      encounterTags: node.type==='rival' && (this.runState.flyway?.rivalWins??0)<3 ? ['cover','support'] : encounter?.tags ?? [],
      enemyCount: node.type==='rival' && (this.runState.flyway?.rivalWins??0)<3 ? (this.runState.flyway?.rivalWins??0)<2?2:3 : encounter?.enemies.length,
      recovery: routeNodeRecovery(node, this.runState.routeMarks),
      currentHp: this.runState.currentHp,
      maxHp: this.runMaxHp(),
      preenTargets: node.type === 'nest' ? distinctMeaningfulUpgradeCards(cardsFromSave(this.runState.deck)).length : 0,
      scrap: this.runState.scrap,
      deckSize: this.runState.deck.length,
      openSupplySlots: Math.max(0, runSupplyCapacity(this.runState) - this.runState.supplies.length),
      availableChoices: choices.filter((choice) => !choice.locked).length,
      totalChoices: choices.length,
      bossTests: node.type === 'boss' ? alphaMapProfileLibrary.get(currentMap().id)?.primaryTests ?? [] : [],
    });
  }

  private renderRouteNodeFallback(node: RouteNode, selectable: boolean) {
    const { x, y } = this.nodePosition(node);
    const isBoss = node.type === 'boss';
    const radius = isBoss ? ROUTE_BOSS_NODE_RADIUS : ROUTE_NODE_RADIUS;
    const iconSize = isBoss ? ROUTE_BOSS_NODE_ICON_SIZE : ROUTE_NODE_ICON_SIZE;
    const hitTarget = this.add.circle(x, y, radius + 10, selectable ? 0x123846 : 0x07101a, selectable ? 0.72 : 0.34)
      .setStrokeStyle(selectable ? 2 : 1, selectable ? UI_FIELD.cyan : 0x345466, selectable ? 0.9 : 0.3)
      .setInteractive({ useHandCursor: true });
    if (selectable) hitTarget.on('pointerdown', () => this.selectRouteNode(node.id));
    else hitTarget.on('pointerdown', () => this.openMapInspection(node.id));
    let tip: Phaser.GameObjects.Container | undefined;
    hitTarget.on('pointerover', () => { tip = this.showNodeTooltip(node, x, y - radius - 8); });
    hitTarget.on('pointerout', () => { tip?.destroy(true); tip = undefined; });
    this.renderRouteNodeTypeIcon(node.type, x, y, iconSize, selectable ? 1 : 0.26);
  }

  private renderRouteBossBeaconRing(x: number, y: number, completed: boolean) {
    this.routeMapRendererModule?.renderRouteBossBeaconRing(this, x, y, completed);
  }

  private renderSelectedRouteNodeFocus(x: number, y: number, radius: number) {
    const key = uiIconAssets['route-selected-node-ring'].key;
    if (this.textures.exists(key)) {
      setTextureFilter(this.textures.get(key), Phaser.Textures.FilterMode.LINEAR);
      const size = radius * 2 + ROUTE_NODE_FOCUS_PAD * 2 + (radius > ROUTE_NODE_RADIUS ? 20 : 12);
      this.add.image(x, y, key)
        .setDisplaySize(size, size)
        .setAlpha(0.82)
        .setName('route-selected-node-ring');
      return;
    }
    const r = radius + ROUTE_NODE_FOCUS_PAD;
    const tick = 12;
    const g = this.add.graphics();
    g.lineStyle(2, 0x24d0d6, 0.86);
    g.lineBetween(x - r, y - r + tick, x - r, y - r);
    g.lineBetween(x - r, y - r, x - r + tick, y - r);
    g.lineBetween(x + r - tick, y - r, x + r, y - r);
    g.lineBetween(x + r, y - r, x + r, y - r + tick);
    g.lineBetween(x - r, y + r - tick, x - r, y + r);
    g.lineBetween(x - r, y + r, x - r + tick, y + r);
    g.lineBetween(x + r - tick, y + r, x + r, y + r);
    g.lineBetween(x + r, y + r - tick, x + r, y + r);
  }

  private renderRouteNodeTypeIcon(type: RouteNode['type'], x: number, y: number, size: number, alpha = 1) {
    const asset = routeNodeIconAssets[type];
    if (asset && this.textures.exists(asset.key)) {
      const icon = this.add.image(x, y, asset.key)
        .setDisplaySize(size, size)
        .setAlpha(alpha);
      if (alpha < 1) icon.setTint(0xa6b3c2);
      return icon;
    }
    // Small engraved motifs keep loading and failed-image states distinguishable
    // without flashing out-of-style single-letter placeholders.
    const marker = this.add.container(x, y).setAlpha(alpha);
    const radius = Math.max(8, size * 0.28);
    marker.add(this.add.circle(0, 0, radius, 0x0b1a24, 0.96)
      .setStrokeStyle(2, 0x76939c, 0.72));
    const motif = this.add.graphics();
    const unit = Math.max(4, size * 0.095);
    motif.lineStyle(2, 0xd8bd78, 0.9);
    switch (type) {
      case 'street':
        motif.lineBetween(-unit, -unit, unit, unit);
        motif.lineBetween(-unit, unit, unit, -unit);
        break;
      case 'rival':
        motif.lineBetween(-unit, -unit * 0.7, 0, 0);
        motif.lineBetween(0, 0, unit, -unit * 0.7);
        motif.lineBetween(-unit, unit * 0.3, 0, unit);
        motif.lineBetween(0, unit, unit, unit * 0.3);
        break;
      case 'boss':
        motif.strokeTriangle(-unit, unit, 0, -unit, unit, unit);
        break;
      case 'basin':
        motif.lineBetween(-unit, -unit * 0.4, -unit * 0.35, 0);
        motif.lineBetween(-unit * 0.35, 0, unit * 0.35, -unit * 0.4);
        motif.lineBetween(unit * 0.35, -unit * 0.4, unit, 0);
        motif.lineBetween(-unit, unit * 0.55, unit, unit * 0.55);
        break;
      case 'nest':
        motif.strokeEllipse(0, 0, unit * 2.2, unit * 1.45);
        break;
      case 'market':
        motif.lineBetween(0, -unit, unit, 0);
        motif.lineBetween(unit, 0, 0, unit);
        motif.lineBetween(0, unit, -unit, 0);
        motif.lineBetween(-unit, 0, 0, -unit);
        break;
      case 'signal':
        motif.strokeCircle(0, 0, unit * 0.32);
        motif.lineBetween(-unit, -unit, -unit * 0.45, -unit * 0.45);
        motif.lineBetween(unit, -unit, unit * 0.45, -unit * 0.45);
        motif.lineBetween(0, unit * 0.5, 0, unit);
        break;
      case 'cache':
        motif.strokeRect(-unit, -unit * 0.7, unit * 2, unit * 1.6);
        motif.lineBetween(-unit * 0.3, 0, unit * 0.3, 0);
        break;
    }
    marker.add(motif);
    return marker;
  }

  private routeRewardBadges(node: RouteNode): Array<{ id: string; icon: string; color: number; text: string; label: string }> {
    const addUnique = (badges: Array<{ id: string; icon: string; color: number; text: string; label: string }>, badge: { id: string; icon: string; color: number; text: string; label: string }) => {
      if (!badges.some((entry) => entry.id === badge.id)) badges.push(badge);
    };
    const badges: Array<{ id: string; icon: string; color: number; text: string; label: string }> = [];
    const defs = {
      waymark: { id: 'waymark', icon: 'W', color: 0xc9a6ff, text: '#efe4ff', label: 'Waymark' },
      card: { id: 'card', icon: 'C', color: 0xd8a840, text: '#fff0b8', label: 'Card' },
      supply: { id: 'supply', icon: 'S', color: 0xffb86b, text: '#ffe7c9', label: 'Supply' },
      preen: { id: 'preen', icon: 'P', color: 0x24d0d6, text: '#dffbff', label: 'Preen' },
      heal: { id: 'heal', icon: '+', color: 0x8fd6a0, text: '#e4fbe9', label: 'Heal' },
      scrap: { id: 'scrap', icon: '$', color: 0x8df4ff, text: '#dffbff', label: 'Scrap' }
    };
    const fromEffect = (effect: string) => {
      const parsed = parseEffect(effect);
      if (!parsed) return;
      switch (parsed.name) {
        case 'gainRouteMark':
          addUnique(badges, defs.waymark);
          break;
        case 'addCard':
          addUnique(badges, defs.card);
          break;
        case 'gainSupply':
        case 'gainSupplyChoice':
          addUnique(badges, defs.supply);
          break;
        case 'preenCard':
          addUnique(badges, defs.preen);
          break;
        case 'heal':
        case 'healCohesion':
        case 'healMissingPct':
          addUnique(badges, defs.heal);
          break;
        case 'gainScrap':
          addUnique(badges, defs.scrap);
          break;
      }
    };

    const profile = rewardProfileForRouteNode(node);
    if (profile) {
      if (node.type === 'rival' || node.type === 'boss' || profile.routeMarkGuaranteed) addUnique(badges, defs.waymark);
      if (node.type === 'rival' || node.type === 'boss') addUnique(badges, defs.card);
      if (node.type === 'rival' || node.type === 'boss' || profile.preenGuaranteed) addUnique(badges, defs.preen);
      return badges;
    }

    if (node.type === 'market') {
      [defs.scrap, defs.card, defs.waymark, defs.supply].forEach((badge) => addUnique(badges, badge));
      return badges;
    }
    if (node.type === 'cache') {
      [defs.scrap, defs.waymark, defs.supply, defs.card, defs.heal].forEach((badge) => addUnique(badges, badge));
      return badges;
    }
    this.nodeChoiceList(node).forEach((choice) => choice.effects.forEach(fromEffect));
    return badges;
  }

  private showNodeTooltip(node: RouteNode, x: number, anchorY: number) {
    if (this.flockOverlayOpen || this.pauseOverlayOpen || this.settingsOverlayOpen || this.nodeChoiceOpen || this.marketOpen) return;
    this.children.getByName('route-node-tooltip')?.destroy();
    const detail = this.nodeDetail(node);
    const decision = this.nodeDecisionSummary(node);
    const width = 440;
    const height = detail.bossPrep ? 252 : 174;
    const graph = this.routeLayout().graph;
    const cx = Math.max(graph.left + width / 2, Math.min(graph.right - width / 2, x));
    const top = Phaser.Math.Clamp(anchorY - height - 12, 160, 624 - height);
    const container = this.add.container(0, 0).setDepth(120).setName('route-node-tooltip');
    const dismiss = () => container.destroy(true);
    this.input.once(Phaser.Input.Events.GAME_OUT, dismiss);
    container.once(Phaser.GameObjects.Events.DESTROY, () => this.input.off(Phaser.Input.Events.GAME_OUT, dismiss));
    container.add(this.add.rectangle(cx, top + height / 2, width, height, 0x07121c, 0.98)
      .setStrokeStyle(1, 0x7ab8d6, 0.65).setName('route-node-tooltip-frame'));
    const addLine = (text: string, y: number, name: string, color: string, lines: number, size = 18) => {
      const label = this.add.text(cx - width / 2 + 20, top + y, '', {
        fontFamily: UI_FONT, fontSize: `${size}px`, color,
        fontStyle: size > 18 ? UI_BOLD : undefined,
        wordWrap: { width: width - 40, useAdvancedWrap: true },
      }).setResolution(2).setName(name);
      container.add(fitTextExcerpt(label, text, lines));
    };
    addLine(detail.title, 16, 'route-node-title', UI_GOLD, 1, 22);
    addLine(`GAIN  ${decision.benefit}`, 52, 'route-node-gain', '#bff4d0', 2);
    addLine(`${detail.bossPrep ? 'TEST' : 'RISK'}  ${decision.risk}`, 106,
      detail.bossPrep ? 'route-boss-prep-test' : 'route-node-risk', '#ffc7b5', 2);
    if (detail.bossPrep) {
      addLine(`PLAN  ${detail.bossPrep.hints[0] ?? detail.bossPrep.thesis}`, 162, 'route-boss-prep-plan', '#e7eef7', 3);
    }
    return container;
  }

  private nodePosition(node: RouteNode) {
    const columns = currentMap().columns;
    const columnNodes = columns[node.column] ?? [node.id];
    const laneIndex = Math.max(0, columnNodes.indexOf(node.id));
    // Spread across the graph area with explicit room for the icon footprint
    // and focus ticks.
    const { left: leftX, right: rightX, top, bottom } = this.routeLayout().graph;
    const colCount = Math.max(1, columns.length);
    const safeLeft = leftX + 132;
    const safeRight = rightX - 102;
    const baseX = colCount > 1 ? safeLeft + (node.column * (safeRight - safeLeft)) / (colCount - 1) : (leftX + rightX) / 2;
    const topPad = ROUTE_NODE_ICON_SIZE / 2 + ROUTE_NODE_FOCUS_PAD + ROUTE_NODE_LAYOUT_PAD;
    const bottomPad = ROUTE_NODE_ICON_SIZE / 2 + ROUTE_NODE_FOCUS_PAD + ROUTE_NODE_LAYOUT_PAD;
    const usableTop = top + topPad;
    const usableBottom = bottom - bottomPad;
    const laneGap = columnNodes.length > 1
      ? Math.min(126, (usableBottom - usableTop) / Math.max(1, columnNodes.length - 1))
      : 0;
    const stackHeight = laneGap * Math.max(0, columnNodes.length - 1);
    const startY = (usableTop + usableBottom) / 2 - stackHeight / 2;
    const baseY = columnNodes.length > 1 ? startY + laneIndex * laneGap : (top + bottom) / 2;
    const iconSize = node.type === 'boss' ? ROUTE_BOSS_NODE_ICON_SIZE : ROUTE_NODE_ICON_SIZE;
    const horizontalPad = iconSize / 2 + ROUTE_NODE_FOCUS_PAD + 8;
    const verticalPad = iconSize / 2 + ROUTE_NODE_FOCUS_PAD + 2;
    const x = clamp(baseX, leftX + horizontalPad, rightX - horizontalPad);
    const y = clamp(baseY, top + verticalPad, bottom - verticalPad);
    return { x, y };
  }

  nodeVisualBounds(node: RouteNode) {
    const { x, y } = this.nodePosition(node);
    const iconSize = node.type === 'boss' ? ROUTE_BOSS_NODE_ICON_SIZE : ROUTE_NODE_ICON_SIZE;
    const horizontal = iconSize / 2 + ROUTE_NODE_FOCUS_PAD;
    return {
      left: x - horizontal,
      right: x + horizontal,
      top: y - iconSize / 2 - ROUTE_NODE_FOCUS_PAD,
      bottom: y + iconSize / 2 + ROUTE_NODE_FOCUS_PAD
    };
  }

  private getEntryNode() {
    const entryNode = currentMap().nodes.find((node) => node.id === currentMap().entryNodeId);
    if (!entryNode) throw new Error(`Missing route entry node: ${currentMap().entryNodeId}`);
    return entryNode;
  }

  private getSelectableNodes() {
    const completed = new Set(this.runState.completedRouteNodeIds);
    if (!this.runState.currentRouteNodeId) {
      const entry = this.getEntryNode();
      return completed.has(entry.id) ? [] : [entry];
    }

    const outgoingNodeIds = currentMap().edges
      .filter((edge) => edge.from === this.runState.currentRouteNodeId && !edge.locked)
      .map((edge) => edge.to);
    return outgoingNodeIds
      .map((id) => currentMap().nodes.find((node) => node.id === id))
      .filter((node): node is RouteNode => {
        if (!node) return false;
        return !completed.has(node.id);
      });
  }

  // Selection previews a reachable node; commitment separately confirms travel.
  private selectRouteNode(routeNodeId: string) {
    if (!this.routeEssentialAssetsReady || this.routeCommitPending || !this.selectableNodeIds.has(routeNodeId)) return;
    if (this.pauseOverlayOpen || this.settingsOverlayOpen || this.confirmExitOpen) return;
    if (this.deckOverlayOpen || this.flockOverlayOpen || this.waymarkDrawerOpen || this.supplyDrawerOpen || this.marketOpen || this.nodeChoiceOpen || this.pendingRouteReward || this.cardPickerMode) return;
    this.selectedNodeId = routeNodeId;
    this.renderAll();
  }

  private routeCommitDelayMs() {
    return prefersReducedMotion() ? 0 : Math.round(ROUTE_COMMIT_STREAK_DELAY_MS / animationPaceTimeScale());
  }

  routeCommitStreakState() {
    const count = countTextureInGameObjects(this.children.list, ROUTE_COMMIT_STREAK_TEXTURE);
    return {
      loaded: this.textures.exists(ROUTE_COMMIT_STREAK_TEXTURE),
      rendered: count > 0,
      count,
      bursts: this.routeCommitStreakBursts
    };
  }

  private routeCommitStreakFx(routeNodeId: string) {
    this.routeMapRendererModule?.routeCommitStreakFx(this, routeNodeId);
  }

  private commitRouteNodeAnimated(routeNodeId: string) {
    if (this.routeCommitPending) return;
    if (this.pauseOverlayOpen || this.settingsOverlayOpen || this.deckOverlayOpen || this.flockOverlayOpen || this.marketOpen || this.nodeChoiceOpen) return;
    if (!this.selectableNodeIds.has(routeNodeId)) return;
    this.selectedNodeId = routeNodeId;
    this.routeCommitPending = true;
    playUiSound('confirm');
    this.routeCommitStreakFx(routeNodeId);
    const delay = this.routeCommitDelayMs();
    this.time.delayedCall(delay, () => {
      if (!this.scene.isActive()) return;
      this.routeCommitPending = false;
      this.commitRouteNode(routeNodeId);
    });
  }

  // Confirm: actually travel to the node (battle / market / data-driven choice).
  private commitRouteNode(routeNodeId: string) {
    if (this.pauseOverlayOpen || this.settingsOverlayOpen || this.deckOverlayOpen || this.flockOverlayOpen || this.marketOpen || this.nodeChoiceOpen) return;
    if (!this.selectableNodeIds.has(routeNodeId)) return;
    this.runState.routeDecisions ??= [];
    this.runState.routeDecisions.push({
      offered: [...this.selectableNodeIds],
      picked: routeNodeId,
      decisionMs: Math.max(0, Date.now() - this.routeDecisionStartedAtMs)
    });
    const node = currentMap().nodes.find((candidate) => candidate.id === routeNodeId);
    recordFirstFlightGuideEvent('route');
    birdAudio.play(node?.type === 'boss' || node?.type === 'rival' ? 'heavyAttack' : currentCombatNodeIds().has(routeNodeId) ? 'attack' : 'route');
    if (node?.type === 'rival') {
      this.openNodeChoices(node);
      return;
    }
    if (currentCombatNodeIds().has(routeNodeId)) {
      this.scene.start('BattleScene', { routeNodeId, runState: cloneRunState(this.runState) });
      return;
    }
    if (node?.type === 'market') {
      this.openMarketNode(node);
      return;
    }
    if (node && (node.type === 'basin' || node.type === 'nest' || node.type === 'cache' || node.type === 'signal')) {
      this.openNodeChoices(node);
      return;
    }
    this.resolveRouteNode(routeNodeId);
  }

  // Data-driven node choices (Basin/Nest/Cache options + Signal choices) resolved
  // through the route-effect interpreter (next-level-data-contracts Â§6.3/Â§7).
  private openNodeChoices(node: RouteNode) {
    this.runState.currentRouteNodeId = node.id;
    this.nodeChoiceOpen = true;
    this.nodeChoiceNodeId = node.id;
    eventChoiceState(this, true);
    this.selectableNodeIds = new Set();
    this.routeStaticCardRewardChoiceIds.clear();
    this.routeStaticSupplyRewardChoiceIds.clear();
    this.routeStaticItemRewardChoices.clear();
    this.routeStaticCacheRewardEffects.clear();
    birdAudio.play('routeChoice', 0.86);
    this.renderAll();
  }

  private nodeChoiceList(node: RouteNode): NodeChoiceOption[] {
    const lockFor = (effects: string[], explicitCost?: number, requirements?: string[], lockedText?: string) => {
      const scrapCost = explicitCost ?? this.scrapCostOfEffects(effects);
      const lacksScrap = scrapCost > 0 && this.runState.scrap < scrapCost;
      const lacksRequirement = !this.requirementsMet(requirements);
      return {
        locked: lacksScrap || lacksRequirement,
        lockedText: lacksScrap ? `Need ${scrapCost} Scrap` : lockedText
      };
    };
    const nodeOption = (option: { id: string; label: string; effects: string[]; cost?: number }) => {
      const lock = lockFor(option.effects, option.cost);
      return {
        key: option.id,
        text: option.label,
        effects: option.effects,
        locked: lock.locked,
        lockedText: lock.lockedText
      };
    };
    const withDecline = (choices: NodeChoiceOption[], text = 'Move on.') => {
      if (choices.some((choice) => choice.key === 'decline')) return choices;
      return [...choices, { key: 'decline', text, effects: [], locked: false }];
    };
    if (node.type === 'basin') return withDecline(alphaBasinSet.options.map(nodeOption));
    if (node.type === 'cache') {
      const bonus = this.routeMarkValue('cacheChoice', 'extraCacheChoice');
      return withDecline(alphaCacheSet.options
        .slice(0, Math.min(alphaCacheSet.options.length, 5 + bonus))
        .map(nodeOption));
    }
    if (node.type === 'nest') {
      return withDecline(alphaNestSet.options.map(nodeOption), 'Leave nest.');
    }
    if (node.type === 'rival') {
      return [
        {
          key: 'challenge_rival',
          text: (this.runState.flyway?.rivalWins??0)<3 ? `Take Caldra's wager · ${rivalChapter(this.runState.flyway?.rivalWins).name}. ${rivalChapter(this.runState.flyway?.rivalWins).weakness}` : `Challenge the rival crew · ${alphaEncounterLibrary.get(node.payloadId)?.name??node.label}`,
          effects: ['startRivalBattle'],
          locked: false
        },
        {
          key: 'decline',
          text: 'Walk away.',
          effects: [],
          locked: false
        }
      ];
    }
    const signal = alphaSignalLibrary.get(node.payloadId);
    return withDecline((signal?.choices ?? []).map((choice) => {
      const lock = lockFor(choice.outcomes, undefined, choice.requirements, choice.lockedText);
      return {
        key: choice.key,
        text: choice.text,
        effects: choice.outcomes,
        locked: lock.locked,
        lockedText: lock.lockedText
      };
    }), 'Move on.');
  }

  private routeMarkValue(trigger: string, verb: string) {
    let total = 0;
    for (const id of this.runState.routeMarks ?? []) {
      const mark = alphaRouteMarkLibrary.get(id);
      if (!mark || mark.trigger !== trigger) continue;
      for (const effect of routeMarkEffects(mark)) {
        const parsed = parseEffect(effect);
        if (parsed && parsed.name === verb) total += parseEffectValue(parsed.args[1] ?? parsed.args[0], 0);
      }
    }
    return total;
  }

  private applyRouteMarkTrigger(trigger: string) {
    for (const id of this.runState.routeMarks ?? []) {
      const mark = alphaRouteMarkLibrary.get(id);
      if (!mark || mark.trigger !== trigger) continue;
      routeMarkEffects(mark).forEach((effect) => this.resolveRouteEffect(effect));
      this.runState.routeLog.push(`${mark.name}: ${mark.description}`);
    }
    this.runState.routeLog = this.runState.routeLog.slice(-8);
  }

  private scrapCostOfEffects(effects: string[]) {
    return effects.reduce((total, effect) => {
      const parsed = parseEffect(effect);
      return parsed?.name === 'payScrap' ? total + parseEffectValue(parsed.args[0], 0) : total;
    }, 0);
  }

  private completePendingRouteNode(nodeId: string | undefined = this.nodeChoiceNodeId) {
    if (!nodeId) return;
    this.runState.currentRouteNodeId = nodeId;
    if (!this.runState.completedRouteNodeIds.includes(nodeId)) {
      this.runState.completedRouteNodeIds.push(nodeId);
    }
  }

  private returnToRouteMapAfterNode(nodeId: string | undefined = this.nodeChoiceNodeId) {
    this.completePendingRouteNode(nodeId);
    this.routeCardRewardChoices = [];
    this.routeRewardChoiceIndex = 0;
    this.routeRewardInspectionCardId = undefined;
    this.routeRewardArmedCardId = undefined;
    this.routeSupplyRewardChoices = [];
    this.routeSupplyRewardChoiceIndex = 0;
    this.routeSupplyRewardArmedId = undefined;
    this.pendingRouteReward = undefined;
    this.nodeChoiceOpen = false;
    this.nodeChoiceNodeId = undefined;
    this.routeCardPickerRestoreState = undefined;
    this.hideRouteChoiceDetail();
    this.hideHoverCardDetail();
    this.hideMarketItemDetail();
    this.scene.restart({ runState: cloneRunState(this.runState) });
  }

  private chooseNodeOption(key: string) {
    if (!this.nodeChoiceOpen || this.pauseOverlayOpen || this.settingsOverlayOpen || eventChoiceState(this).open) return;
    const node = currentMap().nodes.find((candidate) => candidate.id === this.nodeChoiceNodeId);
    if (!node) return;
    const choice = this.nodeChoiceList(node).find((entry) => entry.key === key);
    if (!choice || choice.locked) return;
    const scrapCost = this.scrapCostOfEffects(choice.effects);
    if (scrapCost > this.runState.scrap) return;
    const pickerRestoreState = cloneRunState(this.runState);
    if (!choice.effects.length) {
      this.runState.routeLog.push(`${node.label}: ${choice.text}`);
      this.runState.routeLog = this.runState.routeLog.slice(-8);
      this.returnToRouteMapAfterNode(node.id);
      return;
    }
    if (node.type === 'basin' || node.type === 'cache' || node.type === 'nest' || node.type === 'signal') {
      this.openRouteRewardMenu(node, choice, pickerRestoreState);
      return;
    }
    if (node.type === 'rival' && choice.key === 'challenge_rival') {
      this.runState.currentRouteNodeId = node.id;
      this.runState.routeLog.push(`${node.label}: ${choice.text}`);
      this.runState.routeLog = this.runState.routeLog.slice(-8);
      this.nodeChoiceOpen = false;
      this.nodeChoiceNodeId = undefined;
      this.scene.start('BattleScene', { routeNodeId: node.id, runState: cloneRunState(this.runState) });
      return;
    }
    // Preen/Remove defer to a card picker so the player chooses the card; other
    // effects resolve immediately.
    let pickerPlan: RouteCardPickerPlan | undefined;
    let routeCardRewardSelector: string | undefined;
    for (const effect of choice.effects) {
      const parsed = parseEffect(effect);
      if (parsed?.name === 'preenCard') {
        pickerPlan = { mode: 'preen', count: Math.max(1, parseEffectValue(parsed.args[0], 0) || 1) };
        continue;
      }
      if (parsed?.name === 'releaseCard') {
        pickerPlan = { mode: 'release', count: Math.max(1, parseEffectValue(parsed.args[0], 0) || 1) };
        continue;
      }
      if (parsed?.name === 'addCard' && parsed.args[0]?.startsWith('choose')) {
        routeCardRewardSelector = parsed.args[0];
        continue;
      }
      this.resolveRouteEffect(effect);
    }
    this.runState.routeLog.push(`${node.label}: ${choice.text}`);
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    if (pickerPlan && this.pickerEligibleCards(pickerPlan.mode).length) {
      this.cardPickerMode = pickerPlan.mode;
      this.cardPickerContext = 'route';
      this.cardPickerRemainingPicks = pickerPlan.count;
      this.cardPickerFocusIndex = 0;
      this.cardPickerInspectionOpen = false;
      this.cardPickerArmedIndex = undefined;
      this.marketPickerUtilitySlot = undefined;
      this.routeCardPickerRestoreState = pickerRestoreState;
      this.cardPickerScroll = 0;
      this.nodeChoiceOpen = false;
      this.renderAll();
      return;
    }
    if (routeCardRewardSelector) {
      const choices = this.staticRouteCardRewardChoices(node.id, choice.key, routeCardRewardSelector);
      if (choices.length) {
        this.routeCardRewardChoices = choices;
        this.routeRewardChoiceIndex = 0;
        this.routeRewardInspectionCardId = undefined;
        this.routeRewardArmedCardId = undefined;
        this.pendingRouteReward = {
          nodeId: node.id,
          nodeType: node.type,
          choiceKey: choice.key,
          choiceText: choice.text,
          effects: choice.effects,
          effectText: routeEffectSummary(choice.effects),
          restoreState: pickerRestoreState,
          accent: routeEventAccent(node.type),
          effectsAppliedOnOpen: true
        };
        this.nodeChoiceOpen = false;
        this.hideRouteChoiceDetail();
        this.routeRewardOverlayFailed = false;
        this.queueRouteRewardUiLoad();
        this.queueRouteRewardCardArtLoad();
        this.renderAll();
        return;
      }
    }
    this.returnToRouteMapAfterNode(node.id);
  }

  private openRouteRewardMenu(
    node: RouteNode,
    choice: NodeChoiceOption,
    restoreState: RunState
  ) {
    this.pendingRouteReward = this.preparePendingRouteReward(node, choice, restoreState);
    this.nodeChoiceOpen = false;
    this.hideRouteChoiceDetail();
    this.routeRewardOverlayFailed = false;
    this.queueRouteRewardUiLoad();
    this.queueRouteRewardCardArtLoad();
    this.queueRouteRewardItemArtLoad();
    this.renderAll();
  }

  private preparePendingRouteReward(
    node: RouteNode,
    choice: NodeChoiceOption,
    restoreState: RunState
  ): PendingRouteReward {
    const resolvedEffects = this.resolvedRouteRewardEffects(node.id, choice.key, choice.effects);
    const cardSelector = this.routeCardRewardSelector(resolvedEffects);
    this.routeCardRewardChoices = cardSelector
      ? this.staticRouteCardRewardChoices(node.id, choice.key, cardSelector)
      : [];
    this.routeRewardChoiceIndex = 0;
    this.routeRewardInspectionCardId = undefined;
    this.routeRewardArmedCardId = undefined;
    const supplyChoices = this.staticRouteSupplyRewardChoices(node.id, choice.key, resolvedEffects);
    this.routeSupplyRewardChoices = [...supplyChoices];
    this.routeSupplyRewardChoiceIndex = 0;
    this.routeSupplyRewardArmedId = undefined;
    const previewItem = supplyChoices[0]
      ? { kind: 'supply' as const, id: supplyChoices[0] }
      : this.staticRouteItemRewardChoice(node.id, choice.key, resolvedEffects);
    const previewCards = cardSelector ? [] : this.routeRewardPreviewCards(node.id, choice.key, resolvedEffects);
    const projection = this.projectRouteReward(
      node,
      choice,
      resolvedEffects,
      restoreState,
      previewItem,
      previewCards,
      this.routeRewardRng(restoreState, `${node.id}:${choice.key}:projection`),
    );
    const effectText = routeEffectSummaryWithPreview(
      resolvedEffects,
      supplyChoices.length > 1 ? undefined : projection.previewItem,
      projection.previewCards,
    );
    return {
      nodeId: node.id,
      nodeType: node.type,
      choiceKey: choice.key,
      choiceText: choice.text,
      effects: resolvedEffects,
      effectText,
      restoreState,
      accent: routeEventAccent(node.type),
      effectsAppliedOnOpen: false,
      previewItem: projection.previewItem,
      previewCards: projection.previewCards,
      projectedState: projection.runState,
      decisionPreview: projection.decisionPreview,
      supplyChoices,
    };
  }

  private routeRewardRng(runState: RunState, salt: string) {
    const deck = runState.deck.map(({ id, upgraded }) => `${id}${upgraded ? '+' : ''}`);
    return seededRng(`${runState.seed ?? activeSeed}:${runState.mapIndex ?? activeMapIndex}:${runState.currentRouteNodeId ?? 'route'}:${salt}:${deck}:${runState.routeMarks}:${runState.supplies}:${runState.currentHp}:${runState.scrap}`);
  }

  private resolvedRouteRewardEffects(nodeId: string, choiceKey: string, effects: string[]) {
    const key = `${nodeId}:${choiceKey}:cache-outcome`;
    return effects.flatMap((effect) => {
      const parsed = parseEffect(effect);
      if (parsed?.name !== 'gainCacheReward') return [effect];
      const cached = this.routeStaticCacheRewardEffects.get(key);
      if (cached) return [...cached];
      const options = alphaCacheSet.options;
      const random = seededRng(`${this.runState.seed ?? activeSeed}:${this.runState.mapIndex ?? activeMapIndex}:${key}`);
      const selected = options[Math.floor(random() * options.length)];
      const resolved = selected ? [...selected.effects] : [];
      this.routeStaticCacheRewardEffects.set(key, resolved);
      return resolved;
    });
  }

  private projectRouteReward(
    node: RouteNode,
    choice: NodeChoiceOption,
    effects: string[],
    restoreState: RunState,
    previewItem?: PendingRouteRewardItem,
    previewCards: Card[] = [],
    random: () => number = this.routeRewardRng(restoreState, `${node.id}:${choice.key}:projection`),
  ) {
    const projected = cloneRunState(restoreState);
    const capturedCards = previewCards.map((card) => cloneCard(card.id));
    let capturedItem = previewItem ? { ...previewItem } : undefined;
    let previewSupplyConsumed = false;
    let previewWaymarkConsumed = false;
    let previewCardConsumed = false;
    const context: RouteEffectContext = {
      runState: projected,
      currentMapNodes: () => currentMap().nodes,
      runMaxHp: () => this.runMaxHp(),
      runSupplyCapacity,
      grantRouteMark: (selector) => {
        const preferred = !previewWaymarkConsumed && previewItem?.kind === 'waymark' ? previewItem.id : undefined;
        const id = preferred ?? this.selectRouteMarkRewardIdFor(projected, selector);
        previewWaymarkConsumed ||= Boolean(preferred);
        if (!id || projected.routeMarks.includes(id)) return;
        projected.routeMarks = addWaymarkWithCapacity(projected.routeMarks, id).routeMarks;
        capturedItem ??= { kind: 'waymark', id };
      },
      grantSupply: (selector) => {
        const preferred = !previewSupplyConsumed && previewItem?.kind === 'supply' ? previewItem.id : undefined;
        const id = preferred ?? this.selectSupplyRewardIdFor(projected, selector);
        previewSupplyConsumed ||= Boolean(preferred);
        if (!id || projected.supplies.length >= runSupplyCapacity(projected)) return;
        projected.supplies.push(id);
        capturedItem ??= { kind: 'supply', id };
      },
      grantCard: (selector) => {
        if (selector.startsWith('choose')) return;
        const preferred = !previewCardConsumed
          ? capturedCards.find((card) => card.runtime.kind !== 'snag')?.id
          : undefined;
        const id = preferred ?? this.selectCardRewardIdFor(projected, selector);
        previewCardConsumed ||= Boolean(preferred);
        if (!id || !cardLibrary[id]) return;
        projected.deck.push({ id });
        if (!capturedCards.some((card) => card.id === id)) capturedCards.push(cloneCard(id));
      },
      preenFirstAvailableCard: () => undefined,
      releaseFirstReleasable: () => undefined,
      random,
    };
    const resolveProjectedEffect = (effect: string) => resolveRouteEffectRule(effect, context);
    effects.forEach((effect) => {
      const parsed = parseEffect(effect);
      if (parsed?.name === 'preenCard' || parsed?.name === 'releaseCard') return;
      if (parsed?.name === 'addCard' && parsed.args[0]?.startsWith('choose')) return;
      resolveProjectedEffect(effect);
    });
    const triggerValue = (trigger: string, verb: string) => projected.routeMarks.reduce((total, id) => {
      const mark = alphaRouteMarkLibrary.get(id);
      if (!mark || mark.trigger !== trigger) return total;
      return total + routeMarkEffects(mark).reduce((sum, effect) => {
        const parsed = parseEffect(effect);
        return parsed?.name === verb ? sum + parseEffectValue(parsed.args[1] ?? parsed.args[0], 0) : sum;
      }, 0);
    }, 0);
    const applyProjectedTrigger = (trigger: string) => {
      [...projected.routeMarks].forEach((id) => {
        const mark = alphaRouteMarkLibrary.get(id);
        if (!mark || mark.trigger !== trigger) return;
        routeMarkEffects(mark).forEach(resolveProjectedEffect);
        projected.routeLog.push(`${mark.name}: ${mark.description}`);
      });
      projected.routeLog = projected.routeLog.slice(-8);
    };
    const basinHealChoice = node.type === 'basin' && effects.some((effect) => {
      const parsed = parseEffect(effect);
      return parsed?.name === 'heal' || parsed?.name === 'healCohesion' || parsed?.name === 'healMissingPct';
    });
    if (basinHealChoice) {
      const bonusHeal = triggerValue('basinHeal', 'addHeal');
      if (bonusHeal > 0) {
        projected.currentHp = Math.min(this.runMaxHp(), projected.currentHp + bonusHeal);
        projected.routeLog.push(`Basin Waymarks add ${bonusHeal} Cohesion.`);
      }
      applyProjectedTrigger('basinHeal');
    }
    if (node.type === 'cache') applyProjectedTrigger('cacheChoice');
    if (node.type === 'signal') {
      applyProjectedTrigger('signalResolved');
      (projected.signalChoices ??= []).push({ signalId: node.payloadId, choiceKey: choice.key });
    }
    projected.routeLog.push(`${node.label}: ${choice.text}`);
    projected.routeLog = projected.routeLog.slice(-8);
    return {
      runState: projected,
      previewItem: capturedItem,
      previewCards: capturedCards,
      decisionPreview: this.routeRewardProjectionRows(restoreState, projected, effects),
    };
  }

  private routeRewardProjectionRows(before: RunState, after: RunState, effects: string[]): MarketDecisionPreview {
    const rows: string[] = [];
    const maxHp = this.runMaxHp();
    if (before.currentHp !== after.currentHp) rows.push(`COHESION ${before.currentHp}/${maxHp} > ${after.currentHp}/${maxHp}`);
    if (before.scrap !== after.scrap) rows.push(`SCRAP ${before.scrap} > ${after.scrap}`);
    const cardSelector = this.routeCardRewardSelector(effects);
    const projectedDeckSize = after.deck.length + (cardSelector ? 1 : 0);
    if (before.deck.length !== projectedDeckSize) rows.push(`DECK ${before.deck.length} > ${projectedDeckSize}`);
    const beforeSupplyCap = runSupplyCapacity(before);
    const afterSupplyCap = runSupplyCapacity(after);
    if (before.supplies.length !== after.supplies.length || beforeSupplyCap !== afterSupplyCap) {
      rows.push(`SUPPLIES ${before.supplies.length}/${beforeSupplyCap} > ${after.supplies.length}/${afterSupplyCap}`);
    }
    if (before.routeMarks.join('|') !== after.routeMarks.join('|')) {
      const removedId = before.routeMarks.find((id) => !after.routeMarks.includes(id));
      const addedId = after.routeMarks.find((id) => !before.routeMarks.includes(id));
      if (removedId && addedId) {
        rows.push(`WAYMARK ${alphaRouteMarkLibrary.get(removedId)?.name ?? removedId} > ${alphaRouteMarkLibrary.get(addedId)?.name ?? addedId}`);
      } else {
        rows.push(`WAYMARKS ${before.routeMarks.length} > ${after.routeMarks.length}`);
      }
    }
    const nextCombatRows: Array<[string, number, number]> = [
      ['BOSS SHIELD', before.nextCombat?.bossDamageShield ?? 0, after.nextCombat?.bossDamageShield ?? 0],
      ['SKY GUARD', before.nextCombat?.openSkyGuard ?? 0, after.nextCombat?.openSkyGuard ?? 0],
      ['OPEN SKY CUT', before.nextCombat?.reduceNextOpenSky ?? 0, after.nextCombat?.reduceNextOpenSky ?? 0],
      ['ENEMY COVER', before.nextCombat?.enemyCover ?? 0, after.nextCombat?.enemyCover ?? 0],
    ];
    nextCombatRows.forEach(([label, from, to]) => {
      if (from !== to) rows.push(`${label} ${from} > ${to}`);
    });
    if (!before.nextCombat?.startOpenSky && after.nextCombat?.startOpenSky) rows.push('NEXT FIGHT GROUNDED > OPEN SKY');
    const pickerPlan = this.routeRewardPickerPlan(effects);
    if (pickerPlan) rows.push(`NEXT CHOOSE ${pickerPlan.count} CARD${pickerPlan.count === 1 ? '' : 'S'} TO ${pickerPlan.mode === 'preen' ? 'PREEN' : 'REMOVE'}`);
    return (rows.length ? rows : ['NO STATE CHANGE']).slice(0, 7);
  }

  private routeCardRewardSelector(effects: string[]) {
    for (const effect of effects) {
      const parsed = parseEffect(effect);
      if (parsed?.name === 'addCard' && parsed.args[0]?.startsWith('choose')) return parsed.args[0];
    }
    return undefined;
  }

  private routeRewardPreviewCards(nodeId: string, choiceKey: string, effects: string[]) {
    return effects.flatMap((effect) => {
      const parsed = parseEffect(effect);
      if (parsed?.name === 'addCard') {
        const selector = parsed.args[0] ?? '';
        if (selector.startsWith('choose')) return [];
        const card = this.staticRouteCardPreviewChoice(nodeId, choiceKey, selector);
        return card ? [card] : [];
      }
      if (parsed?.name !== 'addSnagToDiscard' && parsed?.name !== 'addSnagToDraw') return [];
      const id = parsed.args[0];
      return id && cardLibrary[id] ? [cloneCard(id)] : [];
    });
  }

  private routeRewardPickerPlan(effects: string[]): RouteCardPickerPlan | undefined {
    for (const effect of effects) {
      const parsed = parseEffect(effect);
      if (parsed?.name === 'preenCard') return { mode: 'preen', count: Math.max(1, parseEffectValue(parsed.args[0], 0) || 1) };
      if (parsed?.name === 'releaseCard') return { mode: 'release', count: Math.max(1, parseEffectValue(parsed.args[0], 0) || 1) };
    }
    return undefined;
  }

  private applyPendingRouteRewardEffects(
    pending: PendingRouteReward,
    skipCardChoice = false,
    skipInteractiveCardEffects = false
  ) {
    const basinHealChoice = pending.nodeType === 'basin' && pending.effects.some((effect) => {
      const parsed = parseEffect(effect);
      return parsed?.name === 'heal' || parsed?.name === 'healCohesion' || parsed?.name === 'healMissingPct';
    });
    for (const effect of pending.effects) {
      const parsed = parseEffect(effect);
      if (skipCardChoice && parsed?.name === 'addCard' && parsed.args[0]?.startsWith('choose')) continue;
      if (skipInteractiveCardEffects && (parsed?.name === 'preenCard' || parsed?.name === 'releaseCard')) continue;
      if (pending.previewItem?.kind === 'supply' && (parsed?.name === 'gainSupply' || parsed?.name === 'gainSupplyChoice')) {
        this.grantSupply(pending.previewItem.id);
        continue;
      }
      if (pending.previewItem?.kind === 'waymark' && parsed?.name === 'gainRouteMark') {
        this.grantRouteMark(pending.previewItem.id);
        continue;
      }
      if (parsed?.name === 'addCard' && !parsed.args[0]?.startsWith('choose')) {
        const card = pending.previewCards?.find((candidate) => candidate.runtime.kind !== 'snag');
        if (card) {
          this.grantSpecificCard(card.id);
          continue;
        }
      }
      this.resolveRouteEffect(effect);
    }
    if (basinHealChoice) {
      const bonusHeal = this.routeMarkValue('basinHeal', 'addHeal');
      if (bonusHeal > 0) {
        this.runState.currentHp = Math.min(this.runMaxHp(), this.runState.currentHp + bonusHeal);
        this.runState.routeLog.push(`Basin Waymarks add ${bonusHeal} Cohesion.`);
      }
      this.applyRouteMarkTrigger('basinHeal');
    }
    if (pending.nodeType === 'cache') this.applyRouteMarkTrigger('cacheChoice');
    if (pending.nodeType === 'signal') {
      this.applyRouteMarkTrigger('signalResolved');
      (this.runState.signalChoices ??= []).push({ signalId: currentMap().nodes.find((candidate) => candidate.id === pending.nodeId)?.payloadId ?? '', choiceKey: pending.choiceKey });
    }
    const node = currentMap().nodes.find((candidate) => candidate.id === pending.nodeId);
    this.runState.routeLog.push(`${node?.label ?? routeNodeTypeLabel(pending.nodeType)}: ${pending.choiceText}`);
    this.runState.routeLog = this.runState.routeLog.slice(-8);
  }

  private finishPendingRouteReward(pending: PendingRouteReward) {
    this.returnToRouteMapAfterNode(pending.nodeId);
  }

  private openRoutePickerForPendingReward(pending: PendingRouteReward, pickerPlan: RouteCardPickerPlan) {
    this.cardPickerMode = pickerPlan.mode;
    this.cardPickerContext = 'route';
    this.cardPickerRemainingPicks = pickerPlan.count;
    this.cardPickerFocusIndex = 0;
    this.cardPickerInspectionOpen = false;
    this.cardPickerArmedIndex = undefined;
    this.marketPickerUtilitySlot = undefined;
    this.routeCardPickerRestoreState = cloneRunState(pending.restoreState);
    this.cardPickerScroll = 0;
    this.routeCardRewardChoices = [];
    this.routeRewardChoiceIndex = 0;
    this.routeRewardInspectionCardId = undefined;
    this.routeRewardArmedCardId = undefined;
    this.pendingRouteReward = undefined;
    this.nodeChoiceOpen = false;
    this.hideHoverCardDetail();
    this.hideMarketItemDetail();
    this.renderAll();
  }

  claimRouteReward() {
    const pending = this.pendingRouteReward;
    if (!pending) return;
    if (this.routeCardRewardChoices.length || this.routeSupplyRewardChoices.length > 1) return;
    if (pending.projectedState) {
      this.runState = cloneRunState(pending.projectedState);
      const priorIds = new Set(pending.restoreState.deck.map((card) => card.id));
      const acquisition = recordRunCardAcquisitions(this.runState,
        this.runState.deck.map((card) => card.id).filter((id) => !priorIds.has(id)),
        'route_reward',
      );
      acquisition.completedTargets.forEach((id) => {
        this.runState.routeLog.push(`Hunt complete! ${cardLibrary[id].runtime.displayName} is now a permanent collection milestone.`);
      });
      this.runState.routeLog = this.runState.routeLog.slice(-8);
    }
    const pickerPlan = this.routeRewardPickerPlan(pending.effects);
    if (pickerPlan && this.pickerEligibleCards(pickerPlan.mode, 'route').length) {
      if (!pending.projectedState && !pending.effectsAppliedOnOpen) this.applyPendingRouteRewardEffects(pending, false, true);
      this.openRoutePickerForPendingReward(pending, pickerPlan);
      return;
    }
    if (!pending.projectedState && !pending.effectsAppliedOnOpen) this.applyPendingRouteRewardEffects(pending);
    this.finishPendingRouteReward(pending);
  }

  private createRouteCardRewardChoices(selector: string, salt = selector) {
    const owned = new Set(this.runState.deck.map((card) => card.id));
    const basePool = arcanaRewardPool.filter((id) => !owned.has(id));
    let pool = [...basePool];
    if (selector === 'chooseOneOfTwoCommon') {
      pool = pool.filter((id) => cardLibrary[id]?.runtime.rarity === 'common');
    } else if (selector === 'chooseOneOfTwoRare') {
      pool = pool.filter((id) => cardLibrary[id]?.runtime.rarity === 'rare');
      if (pool.length === 0) pool = basePool.filter((id) => cardLibrary[id]?.runtime.rarity === 'uncommon');
    } else if (selector === 'chooseOneOfTwoUncommonOrRare') {
      pool = pool.filter((id) => {
        const rarity = cardLibrary[id]?.runtime.rarity;
        return rarity === 'uncommon' || rarity === 'rare';
      });
    }
    // Route rewards are only two cards, so make the tradeoff legible: first
    // offer the least-represented role (favoring current-suit synergy on ties),
    // then prefer a different role and an off-suit pivot when the pool permits.
    return draftComplementaryRewardPair(
      pool,
      this.runState.deck.map((card) => card.id),
      this.routeRewardRng(this.runState, `card-pair:${salt}`),
      (id) => cardLibrary[id]?.role,
      (id) => cardLibrary[id]?.runtime.suit ?? undefined,
    ).map((id) => cloneCard(id));
  }

  private staticRouteCardRewardChoices(nodeId: string, choiceKey: string, selector: string) {
    const key = `${nodeId}:${choiceKey}:${selector}`;
    const cachedIds = this.routeStaticCardRewardChoiceIds.get(key);
    if (cachedIds) return cachedIds.map((id) => cloneCard(id));
    const choices = this.createRouteCardRewardChoices(selector, key);
    this.routeStaticCardRewardChoiceIds.set(key, choices.map((card) => card.id));
    return choices;
  }

  routeRewardCardObservations(card: Card) {
    const waymarks = this.runState.routeMarks.flatMap((id) => {
      const mark = alphaRouteMarkLibrary.get(id);
      return mark ? [mark] : [];
    });
    return rewardBuildObservations(
      card,
      cardsFromSave(this.runState.deck),
      waymarks,
      (name) => compactSentenceText(name, 18, 1),
      KEYSTONE_AT,
    );
  }

  private staticRouteCardPreviewChoice(nodeId: string, choiceKey: string, selector: string) {
    const key = `${nodeId}:${choiceKey}:preview:${selector}`;
    const cachedIds = this.routeStaticCardRewardChoiceIds.get(key);
    const cachedId = cachedIds?.[0];
    if (cachedId && cardLibrary[cachedId]) return cloneCard(cachedId);
    const id = this.selectCardRewardId(selector, key);
    if (!id) return undefined;
    this.routeStaticCardRewardChoiceIds.set(key, [id]);
    return cloneCard(id);
  }

  private staticRouteSupplyRewardChoices(nodeId: string, choiceKey: string, effects: string[]) {
    const parsed = effects.map(parseEffect).find((effect) => effect?.name === 'gainSupplyChoice');
    if (!parsed || this.runState.supplies.length >= runSupplyCapacity(this.runState)) return [];
    const key = `${nodeId}:${choiceKey}:supply-choice:${parsed.args.join(',')}`;
    const cached = this.routeStaticSupplyRewardChoiceIds.get(key);
    if (cached) return [...cached];
    const pool = [...alphaSupplyLibrary.keys()].filter((id) => !this.runState.supplies.includes(id));
    const random = this.routeRewardRng(this.runState, key);
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [pool[index], pool[swap]] = [pool[swap], pool[index]];
    }
    const choices = pool.slice(0, Math.min(2, pool.length));
    this.routeStaticSupplyRewardChoiceIds.set(key, choices);
    return [...choices];
  }

  private staticRouteItemRewardChoice(nodeId: string, choiceKey: string, effects: string[]) {
    const parsed = effects.map(parseEffect).find((effect) => (
      effect?.name === 'gainSupply'
      || effect?.name === 'gainSupplyChoice'
      || effect?.name === 'gainRouteMark'
    ));
    if (!parsed) return undefined;
    const key = `${nodeId}:${choiceKey}:${parsed.name}:${parsed.args.join(',')}`;
    const cached = this.routeStaticItemRewardChoices.get(key);
    if (cached) return { ...cached };

    let item: PendingRouteRewardItem | undefined;
    if (parsed.name === 'gainRouteMark') {
      const id = this.selectRouteMarkRewardId(parsed.args[0] ?? 'random', key);
      if (id) item = { kind: 'waymark', id };
    } else {
      const id = this.selectSupplyRewardId(parsed.name === 'gainSupplyChoice' ? 'random' : parsed.args[0] ?? 'random', key);
      if (id) item = { kind: 'supply', id };
    }
    if (item) this.routeStaticItemRewardChoices.set(key, { ...item });
    return item;
  }

  private selectRouteMarkRewardId(selector: string, salt = `waymark:${selector}`) {
    return this.selectRouteMarkRewardIdFor(this.runState, selector, salt);
  }

  private selectRouteMarkRewardIdFor(runState: RunState, selector: string, salt = `waymark:${selector}`) {
    if (selector && !['random', 'randomNonBoss', 'randomCommon', 'randomRare', 'randomUncommonOrRare', 'choice'].includes(selector)) {
      return !runState.routeMarks.includes(selector) && alphaRouteMarkLibrary.has(selector) ? selector : undefined;
    }
    const basePool = MARKET_ROUTE_MARK_IDS.filter((markId) => !runState.routeMarks.includes(markId));
    let pool = [...basePool];
    if (selector === 'randomCommon') {
      pool = pool.filter((markId) => alphaRouteMarkLibrary.get(markId)?.rarity === 'common');
    } else if (selector === 'randomRare') {
      pool = pool.filter((markId) => alphaRouteMarkLibrary.get(markId)?.rarity === 'rare');
      if (pool.length === 0) pool = basePool.filter((markId) => alphaRouteMarkLibrary.get(markId)?.rarity === 'uncommon');
    } else if (selector === 'randomUncommonOrRare') {
      pool = pool.filter((markId) => {
        const rarity = alphaRouteMarkLibrary.get(markId)?.rarity;
        return rarity === 'uncommon' || rarity === 'rare';
      });
    } else if (selector === 'randomNonBoss') {
      pool = pool.filter((markId) => alphaRouteMarkLibrary.get(markId)?.rarity !== 'boss');
    }
    if (!pool.length) return undefined;
    return pool[Math.floor(this.routeRewardRng(runState, salt)() * pool.length)];
  }

  private selectSupplyRewardId(selector: string, salt = `supply:${selector}`) {
    return this.selectSupplyRewardIdFor(this.runState, selector, salt);
  }

  private selectSupplyRewardIdFor(runState: RunState, selector: string, salt = `supply:${selector}`) {
    if ((runState.supplies ?? []).length >= runSupplyCapacity(runState)) return undefined;
    if (selector && !['random', 'choice'].includes(selector) && alphaSupplyLibrary.has(selector)) {
      return runState.supplies.includes(selector) ? undefined : selector;
    }
    const ids = [...alphaSupplyLibrary.keys()].filter((candidate) => !runState.supplies.includes(candidate));
    if (!ids.length) return undefined;
    return ids[Math.floor(this.routeRewardRng(runState, salt)() * ids.length)];
  }

  focusedRouteSupplyReward() {
    const id = this.routeSupplyRewardChoices[clamp(this.routeSupplyRewardChoiceIndex, 0, this.routeSupplyRewardChoices.length - 1)];
    return id ? alphaSupplyLibrary.get(id) : undefined;
  }

  cycleRouteSupplyRewardChoice(delta: number) {
    if (!this.routeSupplyRewardChoices.length) return;
    this.routeSupplyRewardChoiceIndex = (
      this.routeSupplyRewardChoiceIndex + delta + this.routeSupplyRewardChoices.length
    ) % this.routeSupplyRewardChoices.length;
    this.routeSupplyRewardArmedId = undefined;
    this.hideMarketItemDetail();
    this.renderAll();
  }

  requestRouteSupplyReward(supplyId: string) {
    const index = this.routeSupplyRewardChoices.indexOf(supplyId);
    if (index < 0) return;
    this.routeSupplyRewardChoiceIndex = index;
    if (this.routeSupplyRewardArmedId !== supplyId) {
      this.routeSupplyRewardArmedId = supplyId;
      playUiSound('confirm');
      this.renderAll();
      return;
    }
    this.chooseRouteSupplyReward(supplyId);
  }

  private chooseRouteSupplyReward(supplyId: string) {
    const pending = this.pendingRouteReward;
    const node = pending ? currentMap().nodes.find((candidate) => candidate.id === pending.nodeId) : undefined;
    if (!pending || !node || !this.routeSupplyRewardChoices.includes(supplyId)) return;
    const projection = this.projectRouteReward(
      node,
      { key: pending.choiceKey, text: pending.choiceText, effects: pending.effects, locked: false },
      pending.effects,
      pending.restoreState,
      { kind: 'supply', id: supplyId },
      pending.previewCards ?? [],
      this.routeRewardRng(pending.restoreState, `${node.id}:${pending.choiceKey}:projection`),
    );
    this.runState = cloneRunState(projection.runState);
    this.routeSupplyRewardArmedId = undefined;
    const supply = alphaSupplyLibrary.get(supplyId);
    if (supply) this.runState.routeLog.push(`Packed ${supply.name}.`);
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    const pickerPlan = this.routeRewardPickerPlan(pending.effects);
    if (pickerPlan && this.pickerEligibleCards(pickerPlan.mode, 'route').length) {
      this.openRoutePickerForPendingReward(pending, pickerPlan);
      return;
    }
    this.finishPendingRouteReward(pending);
  }

  chooseRouteRewardCard(cardId: string) {
    const pending = this.pendingRouteReward;
    if (!pending) return;
    const reward = this.routeCardRewardChoices.find((card) => card.id === cardId);
    if (!reward) return;
    this.routeRewardArmedCardId = undefined;
    this.routeRewardInspectionCardId = undefined;
    if (pending.projectedState) this.runState = cloneRunState(pending.projectedState);
    else if (!pending.effectsAppliedOnOpen) this.applyPendingRouteRewardEffects(pending, true, true);
    if (this.grantSpecificCard(reward.id)) {
      this.runState.routeLog.push(`${displayName(reward)} joins the flock.`);
    }
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    const pickerPlan = this.routeRewardPickerPlan(pending.effects);
    if (pickerPlan && this.pickerEligibleCards(pickerPlan.mode, 'route').length) {
      this.openRoutePickerForPendingReward(pending, pickerPlan);
      return;
    }
    this.finishPendingRouteReward(pending);
  }

  cancelRouteCardReward() {
    const pending = this.pendingRouteReward;
    if (!pending) return;
    if (this.routeSupplyRewardArmedId) {
      this.routeSupplyRewardArmedId = undefined;
      this.hideMarketItemDetail();
      this.renderAll();
      return;
    }
    if (this.routeRewardArmedCardId) {
      this.routeRewardArmedCardId = undefined;
      this.hideHoverCardDetail();
      this.renderAll();
      return;
    }
    this.runState = cloneRunState(pending.restoreState);
    this.routeCardRewardChoices = [];
    this.routeRewardChoiceIndex = 0;
    this.routeRewardInspectionCardId = undefined;
    this.routeRewardArmedCardId = undefined;
    this.routeSupplyRewardChoices = [];
    this.routeSupplyRewardChoiceIndex = 0;
    this.routeSupplyRewardArmedId = undefined;
    this.pendingRouteReward = undefined;
    this.nodeChoiceOpen = true;
    this.hideHoverCardDetail();
    this.renderAll();
  }

  private pickerEligibleCards(mode: CardPickerMode, context = this.cardPickerContext) {
    return this.runState.deck
      .map((saved, index) => ({ saved, index }))
      .filter(({ saved }) => {
        const card = cardLibrary[saved.id];
        if (!card) return false;
        if (mode === 'preen') return !saved.upgraded && hasMeaningfulCardUpgrade(card.runtime);
        return true;
      })
      .map(({ saved, index }) => {
        const card = cardsFromSave([saved])[0];
        const cost = context === 'market' ? this.marketCardPickerPrice(mode, card) : card.cost;
        return { index, card, name: card.name, cost, upgraded: !!saved.upgraded };
      });
  }

  requestCardPick(index: number) {
    const request = (module: CardHoverDetailModule | RouteRewardOverlayModule) => {
      module.requestCardPick(this, index, () => playUiSound('confirm'));
    };
    const module = this.routeRewardInteractionModule();
    if (module) {
      request(module);
      return;
    }
    void loadCardHoverDetailModule().then((loaded) => {
      if (!this.scene.isActive() || !this.cardPickerMode) return;
      this.cardHoverDetailModule = loaded;
      this.cardHoverDetailLoading = false;
      request(loaded);
    });
  }


  // Commands retain the canonical automatic upgrade; player commits request a branch.
  applyCardPick(index: number, interactive = false) {
    this.cardPickerArmedIndex = undefined;
    this.cardPickerInspectionOpen = false;
    if (this.cardPickerContext === 'market') {
      this.applyMarketCardPick(index, interactive);
      return;
    }
    const isDistrictPreen = this.cardPickerContext === 'districtPreen';
    const mode = this.cardPickerMode;
    const saved = this.runState.deck[index];
    if (!saved || !mode) return;
    const context = this.cardPickerContext;
    if (interactive && mode === 'preen' && (this as any).flywayPreenRequest?.(saved, (branch: PreenBranch) => { saved.preenBranch = branch; this.applyCardPick(index); }, () => this.cardPickerMode === mode && this.cardPickerContext === context && this.runState.deck[index] === saved && !saved.upgraded)) return;
    const name = cardLibrary[saved.id]?.name ?? saved.id;
    if (mode === 'preen') {
      saved.upgraded = true;
      birdAudio.play('moltPower');
      this.runState.routeLog.push(`Preened ${name}.`);
    } else {
      this.runState.routeLog.push(`Removed ${name}.`);
      this.runState.deck.splice(index, 1);
    }
    this.cardPickerRemainingPicks = Math.max(0, (this.cardPickerRemainingPicks || 1) - 1);
    if (isDistrictPreen) this.runState.pendingDistrictPreens = this.cardPickerRemainingPicks;
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    if (this.cardPickerRemainingPicks > 0 && this.pickerEligibleCards(mode, 'route').length) {
      const remaining = this.pickerEligibleCards(mode, 'route');
      this.cardPickerFocusIndex = clamp(this.cardPickerFocusIndex, 0, remaining.length - 1);
      this.cardPickerScroll = clamp(this.cardPickerScroll, 0, this.cardPickerMaxScroll(remaining.length));
      this.hideHoverCardDetail();
      this.renderAll();
      return;
    }
    if (!isDistrictPreen) this.completePendingRouteNode();
    this.cardPickerMode = undefined;
    this.cardPickerContext = undefined;
    this.cardPickerRemainingPicks = 0;
    this.cardPickerFocusIndex = 0;
    this.cardPickerInspectionOpen = false;
    this.cardPickerArmedIndex = undefined;
    this.marketPickerUtilitySlot = undefined;
    this.routeCardPickerRestoreState = undefined;
    this.cardPickerScroll = 0;
    this.nodeChoiceNodeId = undefined;
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    if (isDistrictPreen) {
      this.renderAll();
      return;
    }
    this.scene.restart({ runState: cloneRunState(this.runState) });
  }

  private marketCardPickerPrice(mode: CardPickerMode, card?: Card) {
    return mode === 'preen' ? this.marketPreenPrice(card) : this.marketReleasePrice();
  }

  private cancelMarketCardPicker() {
    (this as any).flywayCancelPreen?.();
    this.cardPickerMode = undefined;
    this.cardPickerContext = undefined;
    this.cardPickerRemainingPicks = 0;
    this.cardPickerFocusIndex = 0;
    this.cardPickerInspectionOpen = false;
    this.cardPickerArmedIndex = undefined;
    this.marketPickerUtilitySlot = undefined;
    this.cardPickerScroll = 0;
    this.renderAll();
  }

  private cancelRouteCardPicker() {
    (this as any).flywayCancelPreen?.();
    const isDistrictPreen = this.cardPickerContext === 'districtPreen';
    const skippedDistrictPreens = Math.max(1, this.cardPickerRemainingPicks || 1);
    const nodeId = this.nodeChoiceNodeId;
    if (!isDistrictPreen && this.routeCardPickerRestoreState) {
      this.runState = cloneRunState(this.routeCardPickerRestoreState);
    }
    this.cardPickerMode = undefined;
    this.cardPickerContext = undefined;
    this.cardPickerRemainingPicks = 0;
    this.cardPickerFocusIndex = 0;
    this.cardPickerInspectionOpen = false;
    this.cardPickerArmedIndex = undefined;
    this.marketPickerUtilitySlot = undefined;
    this.routeCardPickerRestoreState = undefined;
    this.cardPickerScroll = 0;
    this.nodeChoiceOpen = !isDistrictPreen && !!nodeId;
    if (isDistrictPreen) {
      this.runState.pendingDistrictPreens = 0;
      this.runState.routeLog.push(`District prep ended with ${skippedDistrictPreens} free Preen${skippedDistrictPreens === 1 ? '' : 's'} skipped.`);
      this.runState.routeLog = this.runState.routeLog.slice(-8);
    }
    this.hideHoverCardDetail();
    this.renderAll();
  }

  private applyMarketCardPick(index: number, interactive = false) {
    const mode = this.cardPickerMode;
    const slot = this.marketPickerUtilitySlot;
    if (!mode || slot === undefined) return;
    const listing = this.marketUtilityShelf[slot];
    if (!listing || listing.sold || listing.id !== mode) return;
    const entry = this.pickerEligibleCards(mode, 'market').find((candidate) => candidate.index === index);
    const saved = this.runState.deck[index];
    if (!entry || !saved || this.runState.scrap < entry.cost) return;
    if (interactive && mode === 'preen' && (this as any).flywayPreenRequest?.(saved, (branch: PreenBranch) => { saved.preenBranch = branch; this.applyMarketCardPick(index); }, () => this.cardPickerMode === mode && this.cardPickerContext === 'market' && this.marketPickerUtilitySlot === slot && this.marketUtilityShelf[slot] === listing && !listing.sold && this.runState.deck[index] === saved && !saved.upgraded && this.runState.scrap >= entry.cost)) return;
    const name = cardLibrary[saved.id]?.name ?? saved.id;
    this.spendRouteScrap(entry.cost);
    listing.price = entry.cost;
    listing.sold = true;
    if (mode === 'preen') {
      saved.upgraded = true;
      birdAudio.play('moltPower');
      this.marketMessage = `${name} is preened for ${entry.cost} Scrap.`;
    } else {
      this.runState.deck.splice(index, 1);
      this.marketMessage = `${name} is removed from the travel pack for ${entry.cost} Scrap.`;
    }
    const anchor = this.marketUtilityOfferAnchor(slot);
    this.applyRouteMarkTrigger('afterMarketPurchase');
    this.cardPickerMode = undefined;
    this.cardPickerContext = undefined;
    this.cardPickerRemainingPicks = 0;
    this.cardPickerFocusIndex = 0;
    this.cardPickerInspectionOpen = false;
    this.cardPickerArmedIndex = undefined;
    this.marketPickerUtilitySlot = undefined;
    this.cardPickerScroll = 0;
    this.renderMarketPurchaseFeedback(anchor.x, anchor.y, mode === 'preen' ? UI_FIELD.cyan : UI_FIELD.danger);
  }

  private cardPickerMaxScroll(totalCards: number) {
    return Math.max(0, Math.ceil(totalCards / 5) - 2);
  }

  private scrollCardPicker(deltaRows: number) {
    if (!this.cardPickerMode) return;
    const totalCards = this.pickerEligibleCards(this.cardPickerMode).length;
    const next = clamp(this.cardPickerScroll + deltaRows, 0, this.cardPickerMaxScroll(totalCards));
    if (next === this.cardPickerScroll) return;
    this.cardPickerScroll = next;
    this.cardPickerFocusIndex = next * 5;
    this.hideHoverCardDetail();
    this.renderAll();
  }

  private renderCardPickerScrollButton(x: number, y: number, direction: 'up' | 'down', enabled: boolean, onClick: () => void) {
    return this.routeSecondaryPresentationModule?.renderCardPickerScrollButton.call(this, x, y, direction, enabled, onClick);
  }

  private renderCardPickerPageIndicatorFrame(x: number, y: number) {
    return this.routeSecondaryPresentationModule?.renderCardPickerPageIndicatorFrame.call(this, x, y);
  }

  private renderCardPickerOverlay() {
    if (!this.routeSecondaryPresentationModule) { this.openSecondaryPresentation(); return; }
    return this.routeSecondaryPresentationModule?.renderCardPickerOverlay.call(this, );
  }

  private renderRouteRewardCardOption(card: Card, x: number, y: number, cardW: number, cardH: number, accent: number) {
    this.add.rectangle(x + 6, y + 8, cardW, cardH, 0x020409, 0.72);
    const key = compactCardArtKey(card);
    if (key && this.textures.exists(key)) {
      this.add.image(x, y, key).setDisplaySize(cardW, cardH);
      return;
    }
    if (renderSnagCardBorder(this, undefined, card, x, y, cardW, cardH, 1)) {
      this.add.rectangle(x, y, cardW - 4, cardH - 4, 0x05101a, 0.12);
      return;
    }

    // The surrounding choice owns readable identity and the full rules reader.
    // A missing portrait reserves its slot, not a second tiny imitation card.
    this.add.rectangle(x, y, cardW, cardH, 0x0b1420, 0.98)
      .setStrokeStyle(2, accent, 0.9).setName('route-card-art-placeholder').setData('cardId', card.id);
    this.add.rectangle(x, y, cardW - 14, cardH - 14, 0x101e2b, 0.6)
      .setStrokeStyle(1, accent, 0.22);
  }


  private renderRouteModuleStatus(title: string, hint: string, failed: boolean, name: string, close: () => void) {
    renderModuleStatus(this, title, hint, failed, name, () => {
      if (!this.pauseOverlayOpen && !this.settingsOverlayOpen) close();
    });
  }

  private renderRouteCardRewardOverlay() {
    if (!this.routeRewardOverlayModule) {
      this.renderRouteModuleStatus('Reward review', 'Preparing the decision preview.',
        this.routeRewardOverlayFailed, 'route-reward-module', () => this.cancelRouteCardReward());
      this.ensureRouteRewardOverlay();
      return;
    }
    this.routeRewardOverlayModule.renderRouteRewardOverlay(this);
  }

  private ensureRouteRewardOverlay() {
    if (this.routeRewardOverlayModule || this.routeRewardOverlayLoading || this.routeRewardOverlayFailed) return;
    this.routeRewardOverlayLoading = true;
    void loadRouteRewardOverlayModule()
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.routeRewardOverlayModule = module;
        this.routeRewardOverlayLoading = false;
        if (this.pendingRouteReward) this.renderAll();
      })
      .catch((error) => {
        this.routeRewardOverlayLoading = false;
        this.routeRewardOverlayFailed = true;
        console.warn(LAZY_LOAD_FAILED, error);
        if (this.sys.settings.active && this.pendingRouteReward) this.renderAll();
      });
  }

  private applyProjectedMarketPurchaseTriggers(runState: RunState) {
    const context: RouteEffectContext = {
      runState,
      currentMapNodes: () => currentMap().nodes,
      runMaxHp: () => this.runMaxHp(),
      runSupplyCapacity,
      grantRouteMark: () => undefined,
      grantSupply: () => undefined,
      grantCard: () => undefined,
      preenFirstAvailableCard: () => undefined,
      releaseFirstReleasable: () => undefined,
    };
    runState.routeMarks.forEach((markId) => {
      const mark = alphaRouteMarkLibrary.get(markId);
      if (mark?.trigger !== 'afterMarketPurchase') return;
      (mark.effects ?? []).forEach((effect) => resolveRouteEffectRule(effect, context));
    });
  }

  private projectedMarketSpend(runState: RunState, price: number) {
    runState.scrap = Math.max(0, runState.scrap - Math.max(0, price));
  }

  private marketProjectionRows(after: RunState): MarketDecisionPreview {
    const before = this.runState;
    const rows: string[] = [];
    if (before.deck.length !== after.deck.length) rows.push(`DECK ${before.deck.length} > ${after.deck.length}`);
    if (before.routeMarks.join('|') !== after.routeMarks.join('|')) {
      const removedId = before.routeMarks.find((id) => !after.routeMarks.includes(id));
      const addedId = after.routeMarks.find((id) => !before.routeMarks.includes(id));
      if (removedId && addedId) {
        rows.push(`WAYMARK ${alphaRouteMarkLibrary.get(removedId)?.name ?? removedId} > ${alphaRouteMarkLibrary.get(addedId)?.name ?? addedId}`);
      } else {
        rows.push(`WAYMARKS ${before.routeMarks.length} > ${after.routeMarks.length}`);
      }
    }
    const beforeSupplyCap = runSupplyCapacity(before);
    const afterSupplyCap = runSupplyCapacity(after);
    if (before.supplies.length !== after.supplies.length || beforeSupplyCap !== afterSupplyCap) {
      rows.push(`SUPPLIES ${before.supplies.length}/${beforeSupplyCap} > ${after.supplies.length}/${afterSupplyCap}`);
    }
    const beforeBossShield = before.nextCombat?.bossDamageShield ?? 0;
    const afterBossShield = after.nextCombat?.bossDamageShield ?? 0;
    if (beforeBossShield !== afterBossShield) rows.push(`BOSS SHIELD ${beforeBossShield} > ${afterBossShield}`);
    const beforeSkyGuard = before.nextCombat?.openSkyGuard ?? 0;
    const afterSkyGuard = after.nextCombat?.openSkyGuard ?? 0;
    if (beforeSkyGuard !== afterSkyGuard) rows.push(`SKY GUARD ${beforeSkyGuard} > ${afterSkyGuard}`);
    const beforeSkyCut = before.nextCombat?.reduceNextOpenSky ?? 0;
    const afterSkyCut = after.nextCombat?.reduceNextOpenSky ?? 0;
    if (beforeSkyCut !== afterSkyCut) rows.push(`OPEN SKY CUT ${beforeSkyCut} > ${afterSkyCut}`);
    if (before.scrap !== after.scrap) rows.push(`SCRAP ${before.scrap} > ${after.scrap}`);
    return rows.slice(0, 6);
  }

  private marketCardDecisionPreview(listing: MarketCardListing): MarketDecisionPreview {
    if (listing.sold) return ['SOLD OUT'];
    if (this.runState.scrap < listing.price) return [`NEED ${listing.price - this.runState.scrap} MORE SCRAP`];
    const projected = cloneRunState(this.runState);
    this.projectedMarketSpend(projected, listing.price);
    projected.deck.push({ id: listing.id });
    this.applyProjectedMarketPurchaseTriggers(projected);
    const hand = (run: RunState) => {
      const cards = cardsFromSave(run.deck);
      return flockHandTarget(aggregateFlockStats(cards).draw ?? 0,
        cards.filter(card => card.runtime.suit === 'plumes').length >= KEYSTONE_AT, run.leaderId);
    };
    return [...this.marketProjectionRows(projected), `BASE HAND ${hand(this.runState)} > ${hand(projected)}`];
  }

  private marketWaymarkDecisionPreview(listing: MarketWaymarkListing): MarketDecisionPreview {
    const projected = cloneRunState(this.runState);
    this.projectedMarketSpend(projected, listing.price);
    projected.routeMarks = addWaymarkWithCapacity(projected.routeMarks, listing.id).routeMarks;
    this.applyProjectedMarketPurchaseTriggers(projected);
    return this.marketProjectionRows(projected);
  }

  marketUtilityDecisionPreview(listing: MarketUtilityListing): MarketDecisionPreview {
    if (listing.id === 'preen' || listing.id === 'release') {
      return ['CHOOSE CARD FIRST', 'COST + RESULT SHOWN PER CARD'];
    }
    const projected = cloneRunState(this.runState);
    this.projectedMarketSpend(projected, listing.price);
    if (listing.id === MARKET_BOSS_GUARD) {
      projected.nextCombat = {
        ...projected.nextCombat,
        openSkyGuard: (projected.nextCombat?.openSkyGuard ?? 0) + MARKET_BOSS_GUARD_SKY_GUARD,
        bossDamageShield: (projected.nextCombat?.bossDamageShield ?? 0) + MARKET_BOSS_GUARD_SHIELD,
      };
    } else if (listing.id === MARKET_ROUTE_SCOUT) {
      resolveRouteEffectRule(`peekNextNodes(${MARKET_ROUTE_SCOUT_OPEN_SKY_REDUCTION})`, {
        runState: projected,
        currentMapNodes: () => currentMap().nodes,
        runMaxHp: () => this.runMaxHp(),
        runSupplyCapacity,
        grantRouteMark: () => undefined,
        grantSupply: () => undefined,
        grantCard: () => undefined,
        preenFirstAvailableCard: () => undefined,
        releaseFirstReleasable: () => undefined,
      });
    } else if (listing.supplyId) {
      projected.supplies.push(listing.supplyId);
    }
    this.applyProjectedMarketPurchaseTriggers(projected);
    return this.marketProjectionRows(projected);
  }

  private marketRefreshDecisionPreview(price = this.marketRefreshCost()): MarketDecisionPreview {
    if (price > this.runState.scrap) return [`NEED ${price - this.runState.scrap} MORE SCRAP`];
    const projected = cloneRunState(this.runState);
    this.projectedMarketSpend(projected, price);
    return [`STOCK ROUND ${this.marketRefreshCount} > ${this.marketRefreshCount + 1}`, ...this.marketProjectionRows(projected)];
  }

  private showHoverCardDetail(
    card: Card,
    zone: string,
    cost: number,
    anchorX: number,
    anchorY: number,
    decisionPreview: MarketDecisionPreview = []
  ) {
    this.hideMarketItemDetail();
    this.hideHoverCardDetail();
    const preview = this.marketOpen && !this.cardPickerInspectionOpen && cost > this.runState.scrap
      ? [`NEED ${cost - this.runState.scrap} MORE SCRAP`]
      : decisionPreview;
    this.marketDecisionPreview = [...preview];
    this.marketBuildObservations = this.marketOpen && zone.startsWith('Market offer')
      ? this.routeRewardCardObservations(card).slice(0, 2)
      : [];
    const marketCard = this.marketOpen && zone.startsWith('Market offer');
    const displayZone = marketCard ? `Market / ${cost} Scrap to buy` : preview.length ? `Market / ${preview.join(' / ')}` : zone;
    const adjustedAnchorX = this.marketOpen && zone.startsWith('Market offer')
      ? 440
      : anchorX;
    const contract = activeCardContract(card, false);
    this.cardHoverDetailRequest = {
      card,
      cardId: card.id,
      marketCardId: marketCard ? card.id : undefined,
      name: displayName(card),
      bird: card.bird,
      label: cardLabel(card),
      zone: displayZone,
      cost: marketCard ? card.cost : cost,
      anchorX: adjustedAnchorX,
      anchorY,
      accent: card.upgraded ? 0x24d0d6 : card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card),
      artKey: loadedCardArtKey(this, card),
      snagBorderKey: isSnagCard(card) ? snagCardBorderAsset.key : undefined,
      target: targetLabel(contract.target),
      role: contract.role,
      currentText: contract.text,
      upgradedText: card.upgraded ? 'Already preened.' : card.upgradedText,
      baseText: displayText(card),
      moltText: card.moltText ? (card.upgraded && card.moltTextUpgraded ? card.moltTextUpgraded : card.moltText) : undefined,
      upgradedMoltText: card.moltTextUpgraded,
      usesMolt: contract.usesMolt,
      stats: cardStatRows(card),
      reducedMotion: prefersReducedMotion(),
      dossierFrameKey: uiIconAssets['card-hover-dossier-frame'].key,
      statChipFrameKey: uiIconAssets['card-hover-stat-chip-frame'].key,
    };
    this.renderHoverCardDetailRequest();
    // Market's rules-only dossier uses the illustration already on its shelf.
    // Do not download an unused full portrait on every focus/render pass.
    if (marketCard) return;
    this.queueCardPortraitArtLoad(card, 'Hover art', () => {
      if (!this.cardHoverDetailRequest || this.cardHoverDetailRequest.name !== displayName(card)) return;
      this.cardHoverDetailRequest.artKey = loadedCardArtKey(this, card);
      const updateArt = this.hoverCardDetail?.getByName('route-inspection-reader')?.getData('updateArt');
      if (updateArt) updateArt(this.cardHoverDetailRequest.artKey);
      else this.renderHoverCardDetailRequest();
    });
  }

  private hideHoverCardDetail() {
    this.hoverCardDetail?.destroy(true);
    this.hoverCardDetail = undefined;
    this.cardHoverDetailRequest = undefined;
    this.marketDecisionPreview = [];
  }

  private preloadCardHoverDetail() {
    if (this.cardHoverDetailModule || this.cardHoverDetailLoading) return;
    this.cardHoverDetailLoading = true;
    void loadCardHoverDetailModule()
      .then((module) => {
        if (!this.scene.isActive()) return;
        this.cardHoverDetailModule = module;
        this.cardHoverDetailLoading = false;
        this.renderHoverCardDetailRequest();
        if (this.deckOverlayOpen || this.cardPickerMode || this.marketOpen) this.renderAll();
      })
      .catch(() => {
        if (!this.scene.isActive()) return;
        this.cardHoverDetailLoading = false;
      });
  }

  private renderHoverCardDetailRequest() {
    const view = this.cardHoverDetailRequest;
    if (!view) return;
    if (view.marketCardId) {
      const listing = this.marketCardShelf.find(offer => offer.id === view.marketCardId);
      if (!this.marketOpen || this.marketCategory !== 'cards' || this.cardPickerMode || !listing || listing.sold) {
        this.hideHoverCardDetail();
        return;
      }
      this.marketDecisionPreview = this.marketCardDecisionPreview(listing);
      this.marketBuildObservations = this.routeRewardCardObservations(cloneCard(listing.id)).slice(0, 2);
      view.zone = `Market / ${listing.price} Scrap to buy`;
    }
    this.hoverCardDetail?.destroy(true);
    this.hoverCardDetail = this.add.container(0, 0).setDepth(23020);
    if (this.cardHoverDetailModule) {
      const detail = setDisplayTreeDepth(
        this.cardHoverDetailModule.renderCardHoverDetail(this, view),
        23020
      ) as Phaser.GameObjects.Container;
      this.hoverCardDetail.add(detail);
      return;
    }
    const cx = view.anchorX < GAME_WIDTH / 2
      ? Math.min(GAME_WIDTH - 168, view.anchorX + 232)
      : Math.max(168, view.anchorX - 232);
    const cy = clamp(view.anchorY, 72, GAME_HEIGHT - 72);
    this.hoverCardDetail.add(this.renderLazyDetailFallback(
      view.name,
      'Opening full card detail…',
      view.accent,
      cx,
      cy,
    ));
    this.preloadCardHoverDetail();
  }

  private renderLazyDetailFallback(title: string, body: string, accent: number, x: number, y: number) {
    return this.add.container(clamp(x, 190, GAME_WIDTH - 190), clamp(y, 110, GAME_HEIGHT - 110), [
      this.add.rectangle(0, 0, 360, 188, DECISION_UI.surface, 0.98).setStrokeStyle(1, accent, 0.65),
      fitTextExcerpt(this.add.text(0, -74, title, {
        fontFamily: UI_FONT, fontSize: '22px', fontStyle: UI_BOLD, color: UI_GOLD,
        wordWrap: { width: 320 }, align: 'center', resolution: 2,
      }).setOrigin(0.5, 0), title, 2),
      this.add.text(0, 12, body, {
        fontFamily: UI_FONT, fontSize: '18px', color: UI_SOFT, wordWrap: { width: 320 }, align: 'center', resolution: 2,
      }).setOrigin(0.5, 0),
    ]).setDepth(23040);
  }

  private showMarketWaymarkDetail(mark: RuntimeRouteMark, price: number, anchorX: number, anchorY: number) {
    const listing = this.marketWaymarkShelf.find((candidate) => candidate.id === mark.id && !candidate.sold);
    this.showMarketItemDetail({
      title: mark.name,
      kicker: `${routeMarkFamilyLabel(mark.family)} Waymark / ${mark.rarity} / ${mark.source}`,
      body: mark.description,
      meta: `Trigger: ${formatWaymarkTrigger(mark.trigger, routeMarkEffects(mark))}\nEffect: ${routeMarkEffectText(mark)}`,
      price,
      observations: this.cardHoverDetailModule?.marketMarkNotes(this, mark) ?? [],
      decisionPreview: listing
        ? this.cardHoverDetailModule?.marketPreview(this, listing, this.marketWaymarkDecisionPreview(listing)) ?? []
        : [],
      accent: UI_FIELD.gold,
      anchorX,
      anchorY
    });
  }

  private showMarketUtilityDetail(listing: MarketUtilityListing, anchorX: number, anchorY: number) {
    const supply = listing.supplyId ? alphaSupplyLibrary.get(listing.supplyId) : undefined;
    this.showMarketItemDetail({
      title: supply?.name ?? this.marketUtilityLabel(listing),
      kicker: supply ? `${supply.rarity} ${supply.category} / ${supply.timing}` : 'Market service',
      body: supply?.description ?? this.marketUtilityDetail(listing),
      meta: supply
        ? `Effects: ${formatEffects(supply.effects)}`
        : listing.id === 'preen' || listing.id === 'release'
          ? 'Final cost and result are shown on each eligible card.'
          : 'One-time preparation; applied immediately.',
      price: listing.price,
      observations: this.cardHoverDetailModule?.marketItemNotes(this, listing) ?? [],
      decisionPreview: this.cardHoverDetailModule?.marketPreview(this, listing) ?? [],
      accent: listing.id === 'supply' ? UI_FIELD.green : listing.id === 'release' ? UI_FIELD.danger : UI_FIELD.cyan,
      anchorX,
      anchorY
    });
  }

  private showRewardWaymarkDetail(mark: RuntimeRouteMark, anchorX: number, anchorY: number) {
    this.showMarketItemDetail({
      title: mark.name,
      kicker: `${routeMarkFamilyLabel(mark.family)} Waymark / ${mark.rarity} / ${mark.source}`,
      body: mark.description,
      meta: `Trigger: ${formatWaymarkTrigger(mark.trigger, routeMarkEffects(mark))}\nEffect: ${routeMarkEffectText(mark)}`,
      accent: UI_FIELD.gold,
      anchorX,
      anchorY
    });
  }

  private showRewardSupplyDetail(supply: RuntimeSupply, anchorX: number, anchorY: number) {
    this.showMarketItemDetail({
      title: supply.name,
      kicker: `${supply.rarity} ${supply.category} / ${supply.timing}`,
      body: supply.description,
      meta: `Effects: ${formatEffects(supply.effects)}`,
      accent: UI_FIELD.green,
      anchorX,
      anchorY
    });
  }

  private showMarketRefreshDetail(price: number, anchorX: number, anchorY: number) {
    this.showMarketItemDetail({
      title: 'New Stock',
      kicker: 'Market service',
      body: 'Refresh the current market offers.',
      meta: `Refresh count: ${this.marketRefreshCount}`,
      price,
      observations: ['+ Rerolls every unbought offer', `! Costs rise after refresh ${this.marketRefreshCount + 1}`],
      decisionPreview: this.marketRefreshDecisionPreview(price),
      accent: UI_FIELD.cyan,
      anchorX,
      anchorY
    });
  }

  private showMarketItemDetail(opts: {
    title: string;
    kicker: string;
    body: string;
    meta: string;
    price?: number;
    observations?: string[];
    decisionPreview?: MarketDecisionPreview;
    accent: number;
    anchorX: number;
    anchorY: number;
  }) {
    this.hideMarketItemDetail();
    this.hideHoverCardDetail();
    this.marketDecisionPreview = [...(opts.decisionPreview ?? [])];
    this.marketBuildObservations = [...(opts.observations ?? [])].slice(0, 2);
    const afterPurchase = opts.price === undefined || (opts.decisionPreview?.length ?? 0) > 0
      ? ''
      : `  /  After purchase: ${Math.max(0, this.runState.scrap - opts.price)} Scrap`;
    this.marketItemHover = this.cardHoverDetailModule?.renderMarketItemDetail(this, {
      ...opts,
      afterPurchase,
      build: opts.observations ?? [],
      decisionPreview: opts.decisionPreview ?? [],
      enabled: opts.price === undefined || this.runState.scrap >= opts.price,
      dossierFrameKey: uiIconAssets['market-detail-dossier-frame'].key,
      scrapIconKey: uiIconAssets['scrap-gear'].key,
    }) ?? this.renderLazyDetailFallback(opts.title, 'Full details are downloading.\nIf unavailable, reopen to retry.', opts.accent, opts.anchorX, opts.anchorY - 70);
    if (!this.cardHoverDetailModule) this.preloadCardHoverDetail();
  }

  private hideMarketItemDetail() {
    this.marketItemHover?.destroy(true);
    this.marketItemHover = undefined;
    this.marketDecisionPreview = [];
  }

  private requirementsMet(requirements?: string[]): boolean {
    for (const req of requirements ?? []) {
      const match = /^([a-zA-Z][a-zA-Z0-9]*)\(([^()]*)\)$/.exec(req);
      if (!match) continue;
      const name = match[1];
      const arg = match[2];
      const n = Number(arg);
      if (name === 'scrapAtLeast' && this.runState.scrap < n) return false;
      if (name === 'cohesionAtLeast' && this.runState.currentHp < n) return false;
      if (name === 'cohesionBelowPct' && this.runState.currentHp >= (this.runMaxHp() * n) / 100) return false;
      if (name === 'hasRouteMark' && !this.hasRouteMark(arg)) return false;
      if (name === 'hasSupplySlot' && (this.runState.supplies ?? []).length >= runSupplyCapacity(this.runState)) return false;
      if (name === 'mapIndexAtLeast' && (currentMap().index ?? 1) < n) return false;
    }
    return true;
  }

  // The route-effect interpreter: executes a single route-effect verb against the
  // run state (next-level-data-contracts Â§6.3).
  private routeEffectContext(salt = 'route-effect'): RouteEffectContext {
    return {
      runState: this.runState,
      currentMapNodes: () => currentMap().nodes,
      runMaxHp: () => this.runMaxHp(),
      runSupplyCapacity,
      grantRouteMark: (selector) => this.grantRouteMark(selector),
      grantSupply: (selector) => this.grantSupply(selector),
      grantCard: (selector) => this.grantCard(selector),
      preenFirstAvailableCard: () => this.preenFirstAvailableCard(),
      releaseFirstReleasable: (count) => this.releaseFirstReleasable(count),
      random: this.routeRewardRng(this.runState, salt),
      scaleRouteHeal: (n) => scaledRouteHeal(n, this.runState.difficulty),
    };
  }

  private checkRouteCondition(condition: string) {
    return checkRouteEffectCondition(condition, this.routeEffectContext());
  }

  private resolveRouteEffect(effect: string) {
    resolveRouteEffectRule(effect, this.routeEffectContext(effect));
  }

  private grantRouteMark(selector: string) {
    const id = this.selectRouteMarkRewardId(selector);
    if (id && !this.hasRouteMark(id)) this.addRouteMark(id);
  }

  private grantSupply(selector: string) {
    const id = this.selectSupplyRewardId(selector);
    if (id && alphaSupplyLibrary.has(id)) this.runState.supplies.push(id);
  }

  private supplyGlyph(supply: RuntimeSupply) {
    switch (supply.category) {
      case 'snack': return '+';
      case 'flare': return '!';
      case 'call': return '~';
      case 'tool': return '#';
      default: return '?';
    }
  }

  private useRouteSupply(index: number) {
    const id = this.runState.supplies[index];
    const supply = id ? alphaSupplyLibrary.get(id) : undefined;
    if (!supply || supply.timing === 'combat') return;
    supply.effects.forEach((effect) => this.resolveRouteEffect(effect));
    this.recordRouteSupplyFeedback(supply);
    this.runState.supplies.splice(index, 1);
    const remainingUsable = this.routeUsableSupplyIndices();
    this.supplyDrawerFocusIndex = remainingUsable[0] ?? 0;
    this.supplyDrawerArmedIndex = undefined;
    this.supplyDrawerInputActive = true;
    (this.runState.suppliesUsed ??= []).push(id);
    this.runState.routeLog.push(`Used ${supply.name}: ${supply.description}`);
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    this.renderAll();
  }

  private grantCard(selector: string) {
    const granted = this.selectCardRewardId(selector);
    if (!granted) return;
    this.grantSpecificCard(granted);
  }

  private grantSpecificCard(cardId: string, source: CardAcquisitionSource = 'route_reward') {
    const card = cardLibrary[cardId];
    if (!card) return false;
    if (this.runState.deck.some((saved) => saved.id === cardId)) {
      this.runState.routeLog.push(`${card.runtime.displayName} is already in the flock; no duplicate was added.`);
      this.runState.routeLog = this.runState.routeLog.slice(-8);
      return false;
    }
    this.runState.deck.push({ id: cardId });
    const acquisition = recordRunCardAcquisitions(this.runState, [cardId], source);
    if (acquisition.completedTargets.includes(cardId)) {
      this.runState.routeLog.push(`Hunt complete! ${card.runtime.displayName} is now a permanent collection milestone.`);
      this.runState.routeLog = this.runState.routeLog.slice(-8);
    }
    return true;
  }

  private selectCardRewardId(selector: string, salt = `card:${selector}`) {
    return this.selectCardRewardIdFor(this.runState, selector, salt);
  }

  private selectCardRewardIdFor(runState: RunState, selector: string, salt = `card:${selector}`) {
    const owned = new Set(runState.deck.map((card) => card.id));
    if (selector && cardLibrary[selector] && !owned.has(selector)) return selector;
    const basePool = arcanaRewardPool.filter((id) => !owned.has(id));
    let pool = [...basePool];
    if (selector === 'randomCommonPlumesOrQuills') {
      pool = pool.filter((id) => {
        const card = cardLibrary[id];
        return card && card.runtime.rarity === 'common' && (card.runtime.suit === 'plumes' || card.runtime.suit === 'quills');
      });
    } else if (selector === 'randomCommon' || selector === 'chooseOneOfTwoCommon') {
      pool = pool.filter((id) => cardLibrary[id]?.runtime.rarity === 'common');
    } else if (selector === 'randomRare' || selector === 'chooseOneOfTwoRare') {
      pool = pool.filter((id) => cardLibrary[id]?.runtime.rarity === 'rare');
      if (pool.length === 0) pool = basePool.filter((id) => cardLibrary[id]?.runtime.rarity === 'uncommon');
    } else if (selector === 'randomUncommonOrRare' || selector === 'chooseOneOfTwoUncommonOrRare') {
      pool = pool.filter((id) => {
        const rarity = cardLibrary[id]?.runtime.rarity;
        return rarity === 'uncommon' || rarity === 'rare';
      });
    }
    if (!pool.length) return;
    return pool[Math.floor(this.routeRewardRng(runState, salt)() * pool.length)];
  }

  private releaseFirstReleasable(count: number) {
    for (let i = 0; i < count; i += 1) {
      const snagIndex = this.runState.deck.findIndex((card) => cardLibrary[card.id]?.runtime.kind === 'snag');
      const starter = new Set(alphaCardSet.starterDeck);
      const index = snagIndex >= 0 ? snagIndex : this.runState.deck.findIndex((card) => !starter.has(card.id));
      if (index >= 0) this.runState.deck.splice(index, 1);
    }
  }

  private renderNodeChoiceOverlay() {
    const node = currentMap().nodes.find((candidate) => candidate.id === this.nodeChoiceNodeId);
    if (!node) return;
    if (node.type === 'basin') {
      this.renderLanternRoostOverlay(node);
      return;
    }
    if (ROUTE_SET_PIECE_PROFILES[node.type]) {
      this.renderRouteSetPieceOverlay(node);
      return;
    }
    const choices = this.nodeChoiceList(node);
    const signal = node.type === 'signal' ? alphaSignalLibrary.get(node.payloadId) : undefined;
    const accent = routeEventAccent(node.type);
    this.renderRouteEventBackdrop(node, 0.84);
    const frame = renderFieldPanel(this, () => {}, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, 1100, 560, {
      eyebrow: routeNodeTypeLabel(node.type),
      title: signal?.title ?? node.label,
      subtitle: routeEventLandmarkLine(node.type),
      accent,
      fill: 0x07101a
    });
    this.add.rectangle(frame.left + 258, frame.cy + 40, 430, 392, 0x020409, 0.22).setStrokeStyle(1, accent, 0.2);
    this.add.circle(frame.left + 96, frame.top + 138, 42, 0x111a27, 0.82).setStrokeStyle(2, accent, 0.78);
    this.renderRouteNodeTypeIcon(node.type, frame.left + 96, frame.top + 138, 66);
    this.add.text(frame.left + 54, frame.top + 202, signal?.prompt ?? nonCombatLesson(node.type), {
      fontFamily: UI_FONT,
      fontSize: '17px',
      color: '#dbe6f0',
      lineSpacing: 4,
      wordWrap: { width: 400 },
      maxLines: 6
    });
    this.add.rectangle(frame.left + 506, frame.cy + 42, 2, 394, accent, 0.4);
    choices.forEach((choice, index) => {
      const x = frame.left + 792;
      const y = frame.top + 164 + index * 82;
      this.renderRouteEventChoiceTile(node, choice, x, y, 520, 72, index, accent);
    });
  }

  private resolveRouteNode(routeNodeId: string) {
    const node = currentMap().nodes.find((candidate) => candidate.id === routeNodeId);
    if (!node) return;

    this.runState.currentRouteNodeId = node.id;
    if (!this.runState.completedRouteNodeIds.includes(node.id)) {
      this.runState.completedRouteNodeIds.push(node.id);
    }
    this.applyRouteNodeReward(node);
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    this.scene.restart({ runState: cloneRunState(this.runState) });
  }

  private openMarketNode(node: RouteNode) {
    this.runState.currentRouteNodeId = node.id;
    this.marketOpen = true;
    this.marketCategory = 'cards';
    this.cardHoverDetailModule?.resetMarketFocus(this);
    this.marketNodeId = node.id;
    this.marketRefreshCount = 0;
    this.marketCardShelf = this.createMarketCardShelf(this.marketRng('cards'));
    this.marketWaymarkShelf = this.createMarketWaymarkShelf(this.marketRng('waymarks'));
    this.marketUtilityShelf = this.createMarketUtilityShelf(this.marketRng('utilities'));
    this.marketMessage = 'Fresh stock. Spend Scrap, tune up, or call new offers.';
    this.selectableNodeIds = new Set();
    this.queueMarketShelfArtLoad();
    this.renderAll();
  }

  private applyRouteNodeReward(node: RouteNode) {
    const recovery = routeNodeRecovery(node, this.runState.routeMarks);
    if (recovery > 0) this.runState.currentHp = Math.min(this.runMaxHp(), this.runState.currentHp + recovery);
    let signalScrap = 0;

    if (node.type === 'basin') {
      this.applyRouteMarkTrigger('basinHeal');
    }

    if (node.type === 'cache') {
      this.gainRouteScrap(CACHE_SCRAP_REWARD);
      const mark = this.firstUnownedRouteMark();
      if (mark) this.addRouteMark(mark.id);
    }

    if (node.type === 'signal') {
      signalScrap = this.routeMarkValue('signalResolved', 'gainScrap');
      this.applyRouteMarkTrigger('signalResolved');
    }

    if (node.type === 'nest') {
      const preened = this.preenFirstAvailableCard();
      this.runState.routeLog.push(routeNodeResolutionText(node, { recovery, preened }));
      return;
    }

    this.runState.routeLog.push(routeNodeResolutionText(node, {
      recovery,
      scrap: node.type === 'cache' ? CACHE_SCRAP_REWARD : signalScrap
    }));
  }

  private renderMarketOverlay() {
    if (!this.routeSecondaryPresentationModule) { this.openSecondaryPresentation(); return; }
    return this.routeSecondaryPresentationModule?.renderMarketOverlay.call(this, );
  }

  private renderMarketSectionHeader(x: number, y: number, w: number, title: string, subtitle: string, accent: number) {
    return this.routeSecondaryPresentationModule?.renderMarketSectionHeader.call(this, x, y, w, title, subtitle, accent);
  }

  private renderMarketVendorTitle(frame: { cx: number; top: number }) {
    return this.routeSecondaryPresentationModule?.renderMarketVendorTitle.call(this, frame);
  }


  private renderMarketSceneBackdrop(frame: { left: number; right: number; top: number; bottom: number; cx: number; w: number }) {
    return this.routeSecondaryPresentationModule?.renderMarketSceneBackdrop.call(this, frame);
  }

  private renderMarketVendor(frame: { left: number; top: number; bottom: number }) {
    return this.routeSecondaryPresentationModule?.renderMarketVendor.call(this, frame);
  }

  private animateMarketVendorIdle(vendor: Phaser.GameObjects.Image) {
    const baseScaleX = vendor.scaleX;
    const baseScaleY = vendor.scaleY;
    this.tweens.add({
      targets: vendor,
      scaleX: baseScaleX * 1.004,
      scaleY: baseScaleY * 1.004,
      duration: 1900,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
  }

  private fitImageInside(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number) {
    const sourceWidth = image.width || image.frame.width || maxWidth;
    const sourceHeight = image.height || image.frame.height || maxHeight;
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    image.setDisplaySize(sourceWidth * scale, sourceHeight * scale);
    return image;
  }

  private routeSetPieceResidentFrame(node: RouteNode) {
    if (node.type === 'nest') {
      return { x: 190, y: GAME_HEIGHT - 8, maxWidth: 332, maxHeight: 500 };
    }

    return { x: 176, y: GAME_HEIGHT - 8, maxWidth: 304, maxHeight: 500 };
  }


  private renderRouteEventTitlePlaque(node: RouteNode, x: number, y: number) {
    const profile = ROUTE_SET_PIECE_PROFILES[node.type];
    const w = 1120;
    this.add.rectangle(x, y, w, 82, 0x08121b, 0.96).setName('route-event-title-plaque');
    this.add.text(x - w / 2 + 24, y - 27, profile?.residentName ?? node.label, {
      fontFamily: UI_FONT, fontSize: '26px', fontStyle: UI_BOLD,
      color: '#f4e7cd', resolution: 2, wordWrap: { width: 310 }
    }).setName('route-event-resident-name');
    this.add.text(x - w / 2 + 24, y + 9, profile?.residentRole ?? routeNodeTypeLabel(node.type), {
      fontFamily: UI_FONT, fontSize: '19px', color: '#a9c3ca', resolution: 2,
      wordWrap: { width: 310 }
    }).setName('route-event-resident-role');
    const context = this.eventNarrativeContext(node);
    const narrative = this.add.text(x - w / 2 + 362, y - 30, '', {
      fontFamily: UI_FONT, fontSize: '19px', color: '#dbe6f0', resolution: 2,
      wordWrap: { width: w - 386, useAdvancedWrap: true }, lineSpacing: 0,
    }).setName('route-event-context');
    // The complete context remains in Read if future/localized prose exceeds
    // this three-line header; an explicit ellipsis never hides an omission.
    fitTextExcerpt(narrative, context, 3);
  }

  eventNarrativeContext(node: RouteNode) {
    const signal = node.type === 'signal' ? alphaSignalLibrary.get(node.payloadId) : undefined;
    if (signal) return `${signal.title}. ${signal.prompt}`;
    return ROUTE_SET_PIECE_PROFILES[node.type]?.visitLine ?? nonCombatLesson(node.type);
  }

  private renderRouteEventResident(
    node: RouteNode,
    x: number,
    floorY: number,
    maxWidth: number,
    maxHeight: number,
    options: { showGlow?: boolean } = {}
  ) {
    const accent = routeEventAccent(node.type);
    const resident = this.routeEventResidentAsset(node);
    const showGlow = options.showGlow ?? true;
    this.add.ellipse(x, floorY - 18, Math.min(300, maxWidth * 0.8), 38, 0x020409, 0.48);
    if (showGlow) {
      this.add.circle(x, floorY - maxHeight * 0.46, Math.min(168, maxWidth * 0.45), accent, 0.055)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
    if (resident && this.textures.exists(resident.key)) {
      const residentImage = this.add.image(x, floorY, resident.key)
        .setOrigin(0.5, 1)
        .setAlpha(0.99)
        .setName('route-event-resident-art');
      this.fitImageInside(residentImage, Math.min(maxWidth, (x - 24) * 2), maxHeight);
      return;
    }
    this.add.circle(x, floorY - maxHeight * 0.34, 82, 0x1c2230, 0.98)
      .setStrokeStyle(2, accent, 0.82);
    this.renderRouteNodeTypeIcon(node.type, x, floorY - maxHeight * 0.34, 96);
  }


  private routeChoicePreviewRows(choice: NodeChoiceOption): Array<{ label: string; before: string; after: string; color: string }> {
    const rows = new Map<string, { label: string; before: string; after: string; color: string }>();
    const maxHp = this.runMaxHp();
    let scrap = this.runState.scrap;
    let hp = this.runState.currentHp;
    let deck = this.runState.deck.length;
    let supplies = this.runState.supplies.length;
    let waymarks = this.runState.routeMarks.length;
    let skyGuard = this.runState.nextCombat?.openSkyGuard ?? 0;
    let openSkyCut = this.runState.nextCombat?.reduceNextOpenSky ?? 0;
    let enemyCover = this.runState.nextCombat?.enemyCover ?? 0;
    let bossShield = this.runState.nextCombat?.bossDamageShield ?? 0;
    const ownedCardIds = new Set(this.runState.deck.map((card) => card.id));
    const supplyCap = runSupplyCapacity(this.runState);
    const setRow = (id: string, label: string, before: string, after: string, color: string) => {
      rows.set(id, { label, before: rows.get(id)?.before ?? before, after, color });
    };
    const visit = (effect: string) => {
      if (effect === 'startRivalBattle') {
        setRow('rival', 'Rival', 'Route', 'Battle', '#ffd5cc');
        return;
      }
      const conditional = /^if (.+?) then (.+)$/.exec(effect);
      if (conditional) {
        if (this.checkRouteCondition(conditional[1])) visit(conditional[2]);
        return;
      }
      const parsed = parseEffect(effect);
      if (!parsed) return;
      const arg0 = parsed.args[0] ?? '';
      const n = Number(arg0) || 0;
      switch (parsed.name) {
        case 'gainScrap': {
          const before = scrap;
          scrap += n;
          setRow('scrap', 'Scrap', `${before}`, `${scrap}`, '#fff0b8');
          break;
        }
        case 'payScrap': {
          const before = scrap;
          scrap = Math.max(0, scrap - n);
          setRow('scrap', 'Scrap', `${before}`, `${scrap}`, '#ffd5cc');
          break;
        }
        case 'loseCohesion': {
          const before = hp;
          hp = Math.max(0, hp - n);
          setRow('hp', 'Cohesion', `${before}/${maxHp}`, `${hp}/${maxHp}`, '#ffd5cc');
          break;
        }
        case 'heal':
        case 'healCohesion': {
          const before = hp;
          hp = Math.min(maxHp, hp + scaledRouteHeal(n, this.runState.difficulty));
          setRow('hp', 'Cohesion', `${before}/${maxHp}`, `${hp}/${maxHp}`, '#e4fbe9');
          break;
        }
        case 'healMissingPct': {
          const before = hp;
          const heal = Math.max(Number(parsed.args[1]) || 0, Math.round(((maxHp - hp) * n) / 100));
          hp = Math.min(maxHp, hp + scaledRouteHeal(heal, this.runState.difficulty));
          setRow('hp', 'Cohesion', `${before}/${maxHp}`, `${hp}/${maxHp}`, '#e4fbe9');
          break;
        }
        case 'addCard': {
          const before = deck;
          const isSpecificCard = Boolean(cardLibrary[arg0]);
          if (!isSpecificCard || !ownedCardIds.has(arg0)) {
            deck += 1;
            if (isSpecificCard) ownedCardIds.add(arg0);
          }
          setRow('deck', 'Deck', `${before}`, `${deck}`, '#fff0b8');
          break;
        }
        case 'addSnagToDiscard':
        case 'addSnagToDraw': {
          const before = deck;
          if (arg0 && !ownedCardIds.has(arg0)) {
            deck += 1;
            ownedCardIds.add(arg0);
          }
          setRow('deck', 'Deck', `${before}`, `${deck}`, '#ffd5cc');
          break;
        }
        case 'releaseCard': {
          const before = deck;
          deck = Math.max(0, deck - (n || 1));
          setRow('deck', 'Deck', `${before}`, `${deck}`, '#ffd5cc');
          break;
        }
        case 'gainSupply':
        case 'gainSupplyChoice': {
          const before = supplies;
          supplies = Math.min(supplyCap, supplies + 1);
          setRow('supplies', 'Supplies', `${before}/${supplyCap}`, `${supplies}/${supplyCap}`, '#ffe7c9');
          break;
        }
        case 'gainRouteMark': {
          const before = waymarks;
          waymarks += 1;
          setRow('waymarks', 'Waymarks', `${before}`, `${waymarks}`, '#efe4ff');
          break;
        }
        case 'preenCard':
          setRow('preen', 'Deck tune', 'Base', `Preen ${n || 1}`, '#dffbff');
          break;
        case 'gainOpenSkyGuard': {
          const before = skyGuard;
          skyGuard += n;
          setRow('guard', 'Sky Guard', `${before}`, `${skyGuard}`, '#e4fbe9');
          break;
        }
        case 'reduceNextOpenSky': {
          const before = openSkyCut;
          openSkyCut += n;
          setRow('sky', 'Open Sky cut', `${before}`, `${openSkyCut}`, '#dffbff');
          break;
        }
        case 'enemyCoverNextCombat': {
          const before = enemyCover;
          enemyCover += n;
          setRow('enemy-cover', 'Enemy Cover', `${before}`, `${enemyCover}`, '#ffd5cc');
          break;
        }
        case 'bossDamageShield': {
          const before = bossShield;
          bossShield += n;
          setRow('boss-shield', 'Boss Shield', `${before}`, `${bossShield}`, '#e4fbe9');
          break;
        }
        case 'startNextCombatOpenSky':
          setRow('start-open-sky', 'Next fight', 'Grounded', 'Open Sky', '#ffd5cc');
          break;
        case 'peekNextNodes':
        case 'revealNodes':
          setRow('plan', 'Route plan', 'Guard / Sky', `+1 / -${n || 1}`, '#dffbff');
          break;
        case 'gainCacheReward':
          setRow('cache', 'Cache', 'Closed', 'Open', '#fff0b8');
          break;
        default:
          break;
      }
    };
    choice.effects.forEach(visit);
    return [...rows.values()].slice(0, 5);
  }

  routeChoiceChangeAmountText(row: { before: string; after: string }) {
    const leadingNumber = (value: string) => {
      const match = /^([+-]?\d+)/.exec(value);
      return match ? Number(match[1]) : undefined;
    };
    const before = leadingNumber(row.before);
    const after = leadingNumber(row.after);
    if (before !== undefined && after !== undefined && before !== after) {
      const delta = after - before;
      return `${delta > 0 ? '+' : ''}${delta}`;
    }
    if (/^[+-]\d+/.test(row.after)) return row.after;
    return row.after;
  }

  eventChoices() {
    const node = currentMap().nodes.find((candidate) => candidate.id === this.nodeChoiceNodeId);
    return node ? this.nodeChoiceList(node).map((choice, index) => node.type === 'cache'
      ? { ...choice, text: cacheDrawerProfile(choice, index).title } : choice) : [];
  }

  eventChoiceSections(choice: NodeChoiceOption) {
    const node = currentMap().nodes.find((candidate) => candidate.id === this.nodeChoiceNodeId);
    const changes = choice.locked ? 'This option cannot be chosen yet.' :
      this.routeChoicePreviewRows(choice).map((row) => `${row.label}: ${row.before} → ${row.after}`).join(' · ') || 'No resource change.';
    return [{ title: 'DECISION SUMMARY', text: [choice.text,
      ...(choice.locked ? [`Unavailable: ${choice.lockedText ?? 'Requirements not met.'}`] : []),
      routeEffectSummary(choice.effects), changes,
      ...(node ? [this.eventNarrativeContext(node), nonCombatLesson(node.type),
        [ROUTE_SET_PIECE_PROFILES[node.type]?.residentRole, ROUTE_SET_PIECE_PROFILES[node.type]?.species].filter(Boolean).join(' · ')] : []),
    ].join('\n\n') }];
  }

  private renderMarketCategoryTabs(frame: { top: number }) {
    return this.routeSecondaryPresentationModule?.renderMarketCategoryTabs.call(this, frame);
  }

  private setMarketCategory(category: MarketCategory) {
    if (this.pauseOverlayOpen || this.settingsOverlayOpen || this.cardPickerMode) return;
    if (this.marketCategory === category) {
      if (!this.marketFocusArmedId) return;
      playUiSound('close');
      this.leaveMarket();
      return;
    }
    playUiSound('confirm');
    this.marketFocusId = undefined;
    this.marketFocusArmedId = undefined;
    this.marketCategory = category;
    this.marketItemHover = undefined;
    this.hoverCardDetail = undefined;
    this.renderAll();
  }

  private routeRewardInteractionModule() {
    return this.routeRewardOverlayModule ?? this.cardHoverDetailModule;
  }

  routeRewardChoiceDebugState() {
    return this.routeRewardOverlayModule?.routeRewardChoiceDebugState(this)
      ?? { cardChoices: [], supplyChoices: [], inputFocus: undefined };
  }

  focusedRouteRewardCard() {
    return this.routeRewardInteractionModule()?.focusedRouteRewardCard(this)
      ?? this.routeCardRewardChoices[this.routeRewardChoiceIndex];
  }

  cycleRouteRewardChoice(direction: -1 | 1) {
    if (this.routeRewardInteractionModule()?.cycleRouteRewardChoice(this, direction)) playUiSound('confirm');
  }

  setRouteRewardChoice(cardId: string) {
    this.routeRewardInteractionModule()?.setRouteRewardChoice(this, cardId);
  }

  requestRouteRewardCard(cardId: string) {
    this.routeRewardInteractionModule()?.requestRouteRewardCard(this, cardId, () => playUiSound('confirm'));
  }

  toggleFocusedRouteRewardInspection() {
    if (this.routeRewardInspectionCardId) {
      this.closeRouteRewardInspection();
      return;
    }
    const card = this.focusedRouteRewardCard();
    if (card) this.openRouteRewardInspection(card.id);
  }

  openRouteRewardInspection(cardId: string) {
    const card = this.routeRewardInteractionModule()?.openRouteRewardInspection(this, cardId);
    if (card) {
      playUiSound('confirm');
      const armedCard = this.routeRewardArmedCardId
        ? this.routeCardRewardChoices.find((choice) => choice.id === this.routeRewardArmedCardId)
        : undefined;
      const returnMessage = armedCard
        ? `${displayName(armedCard)} remains selected; Back restores its confirmation without claiming it.`
        : 'Back returns to the same route reward without claiming it.';
      announceScreenReader(`Inspecting ${displayName(card)}. ${returnMessage}`);
    }
  }

  closeRouteRewardInspection() {
    if (this.routeRewardInteractionModule()?.closeRouteRewardInspection(this)) playUiSound('close');
  }

  private gainRouteScrap(amount: number) {
    const gained = Math.max(0, amount);
    this.runState.scrap += gained;
    this.runState.scrapEarned = (this.runState.scrapEarned ?? 0) + gained;
  }

  private spendRouteScrap(amount: number) {
    const spent = Math.min(this.runState.scrap, Math.max(0, amount));
    this.runState.scrap -= spent;
    this.runState.scrapSpent = (this.runState.scrapSpent ?? 0) + spent;
    return spent;
  }

  private hideRouteChoiceDetail() {
    this.routeChoiceHover?.destroy(true);
    this.routeChoiceHover = undefined;
  }

  private renderLanternRoostOverlay(node: RouteNode) {
    const choices = this.nodeChoiceList(node);
    const accent = routeEventAccent(node.type);
    const background = this.routeEventBackdropAsset(node);
    this.queueRouteEventSetPieceArtLoad(node);

    if (background && this.textures.exists(background.key)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, background.key)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(1);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.08)
        .setInteractive({ useHandCursor: false });
    } else {
      this.renderRouteEventBackdrop(node, 1);
    }

    this.renderRouteEventTitlePlaque(node, GAME_WIDTH / 2, 132);
    this.renderRouteEventResident(node, 146, GAME_HEIGHT - 8, 350, 448, { showGlow: false });
    this.renderBasinHearthBench(1022, 492, 428, 316, accent);
    this.renderRouteEventChoiceColumn(node, choices, 560, 326, 472, accent);
  }

  private renderRouteEventPropCenterpiece(
    asset: RuntimeImageAsset,
    x: number,
    y: number,
    maxW: number,
    maxH: number,
    accent: number,
    glow: number,
    options: { showGlow?: boolean; showAccentLine?: boolean } = {}
  ) {
    const showGlow = options.showGlow ?? true;
    const showAccentLine = options.showAccentLine ?? true;
    this.add.ellipse(x, y + maxH * 0.38, maxW * 0.82, 42, 0x020409, 0.38);
    if (showGlow) {
      this.add.circle(x, y + 18, Math.min(maxW, maxH) * 0.42, glow, 0.12)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.add.circle(x, y + 18, Math.min(maxW, maxH) * 0.28, glow, 0.08)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
    const image = this.add.image(x, y, asset.key);
    const scale = Math.min(maxW / image.width, maxH / image.height);
    image.setScale(scale);
    image.setAlpha(0.98);
    if (showAccentLine) {
      this.add.rectangle(x, y + maxH * 0.43, maxW * 0.72, 2, accent, 0.32);
    }
  }

  private renderBasinHearthBench(x: number, y: number, w: number, h: number, accent: number) {
    const prop = ROUTE_EVENT_PROP_ASSETS.basinHearthCart;
    if (!this.textures.exists(prop.key)) return;
    this.renderRouteEventPropCenterpiece(prop, x + 12, y + 8, w + 76, h + 84, accent, 0xff8c36, {
      showGlow: false, showAccentLine: false
    });
  }

  private renderRouteSetPieceOverlay(node: RouteNode) {
    if (node.type === 'cache') {
      this.renderCacheSetPieceOverlay(node);
      return;
    }
    if (node.type === 'signal') {
      this.renderSignalSetPieceOverlay(node);
      return;
    }
    if (node.type === 'nest') {
      this.renderNestSetPieceOverlay(node);
      return;
    }
    const choices = this.nodeChoiceList(node);
    const accent = routeEventAccent(node.type);
    this.queueRouteEventSetPieceArtLoad(node);
    this.renderRouteEventBackdrop(node, 1, { showBottomBand: false });
    const background = this.routeEventBackdropAsset(node);

    if (background && this.textures.exists(background.key)) {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.08)
        .setInteractive({ useHandCursor: false });
    }

    this.renderRouteEventTitlePlaque(node, GAME_WIDTH / 2, 132);
    const residentFrame = this.routeSetPieceResidentFrame(node);
    this.renderRouteEventResident(node, residentFrame.x, residentFrame.y, residentFrame.maxWidth, residentFrame.maxHeight, { showGlow: false });

    const compact = choices.length > 5;
    const choiceHeight = compact ? 56 : 78;
    const gap = compact ? 9 : 18;
    const totalHeight = choices.length * choiceHeight + Math.max(0, choices.length - 1) * gap;
    const startY = GAME_HEIGHT / 2 - totalHeight / 2 + choiceHeight / 2 + (compact ? 24 : 20);
    this.renderRouteEventChoiceColumn(node, choices, 1000, startY, 438, accent);
  }

  private renderNestSetPieceOverlay(node: RouteNode) {
    const choices = this.nodeChoiceList(node);
    const accent = routeEventAccent(node.type);
    const background = this.routeEventBackdropAsset(node);
    this.queueRouteEventSetPieceArtLoad(node);
    this.renderRouteEventBackdrop(node, 1);
    if (background && this.textures.exists(background.key)) {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.08)
        .setInteractive({ useHandCursor: false });
    }
    this.renderRouteEventTitlePlaque(node, GAME_WIDTH / 2, 132);
    this.renderRouteEventResident(node, 146, GAME_HEIGHT - 8, 350, 508, { showGlow: false });
    this.renderNestWorkbench(1018, 488, 392, 300, accent);
    this.renderRouteEventChoiceColumn(node, choices, 560, 316, 472, accent);
  }

  private renderNestWorkbench(x: number, y: number, w: number, h: number, accent: number) {
    const prop = ROUTE_EVENT_PROP_ASSETS.nestFeatherwrightBench;
    if (!this.textures.exists(prop.key)) return;
    this.renderRouteEventPropCenterpiece(prop, x + 18, y + 8, w + 94, h + 70, accent, 0xffd37a, {
      showGlow: false, showAccentLine: false
    });
  }

  private renderCacheSetPieceOverlay(node: RouteNode) {
    const choices = this.nodeChoiceList(node);
    const accent = routeEventAccent(node.type);
    const background = this.routeEventBackdropAsset(node);
    this.queueRouteEventSetPieceArtLoad(node);
    this.renderRouteEventBackdrop(node, 1);
    if (background && this.textures.exists(background.key)) {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.06)
        .setInteractive({ useHandCursor: false });
    }
    this.renderRouteEventTitlePlaque(node, GAME_WIDTH / 2, 132);
    this.renderRouteEventResident(node, 146, GAME_HEIGHT - 8, 244, 464, { showGlow: false });
    this.renderCacheCabinet(node, 620, 438, 590, 506, choices, accent);
  }

  private renderCacheCabinet(node: RouteNode, x: number, y: number, _w: number, h: number, choices: NodeChoiceOption[], accent: number) {
    const top = y - h / 2;
    const cabinetAsset = ROUTE_EVENT_PROP_ASSETS.marnLockboxCabinet;
    const cabinetX = x + 412;
    const optionX = x - 58;

    if (this.textures.exists(cabinetAsset.key)) {
      this.add.ellipse(cabinetX, top + 420, 418, 42, 0x020409, 0.32);
      const cabinetImage = this.add.image(cabinetX, top + 302, cabinetAsset.key)
        .setAlpha(0.98);
      this.fitImageInside(cabinetImage, 438, 386);
    }

    this.renderRouteEventChoiceColumn(node, choices, optionX, top + 144, 472, accent);
  }

  private renderRouteEventChoiceColumn(node: RouteNode, choices: NodeChoiceOption[], x: number, top: number, w: number, accent: number) {
    const optionH = choices.length > 6 ? 58 : choices.length <= 4 ? 84 : 64;
    const gap = 8;
    top = Math.min(top, GAME_HEIGHT - 44 - (choices.length - 1) * (optionH + gap) - optionH / 2);
    const panelH = (choices.length - 1) * (optionH + gap) + optionH + 78;
    this.renderRouteChoiceDecisionFrame(x, top - optionH / 2 - 58 + panelH / 2, w + 32, panelH);
    // Reserve two lines even while pointer copy is short: long remapped key
    // names must not run into the first option when input devices change.
    eventChoiceHint(this, x - w / 2 + 12, top - optionH / 2 - 47, w - 24);
    choices.forEach((choice, index) => {
      const y = top + index * (optionH + gap);
      if (node.type === 'cache') this.renderCacheDrawerTile(node, choice, x, y, w, optionH, index, accent);
      else this.renderRouteEventChoiceTile(node, choice, x, y, w, optionH, index, accent);
    });
  }

  private renderRouteChoiceDecisionFrame(x: number, y: number, width: number, height: number) {
    const w = Math.min(width, 2 * (GAME_WIDTH - x - 24));
    this.add.rectangle(x, y, w, height, 0x08121b, 0.97)
      .setStrokeStyle(1, 0x66818c, 0.3).setName('route-choice-decision-frame');
  }

  routeChoiceDecisionFrameState() {
    const key = uiIconAssets['route-choice-decision-frame'].key;
    const count = this.children.list.filter((child: any) => (
      child.texture?.key === key || child.name === 'route-choice-decision-frame'
    )).length;
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count
    };
  }

  routeEventTitlePlaqueState() {
    const key = uiIconAssets['route-event-title-plaque'].key;
    const count = this.children.list.filter((child) => child.name === 'route-event-title-plaque').length;
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count
    };
  }

  routeChoiceOptionFrameState() {
    const key = uiIconAssets['route-choice-option-frame'].key;
    const count = this.children.list.filter((child) => child.name === 'route-choice-option-frame').length;
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count
    };
  }

  routeChoiceDetailFrameState() {
    const key = uiIconAssets['route-choice-detail-frame'].key;
    const count = countTextureInGameObjects(this.routeChoiceHover?.list ?? [], key);
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count
    };
  }

  routeChoicePreviewRowFrameState() {
    const key = uiIconAssets['route-choice-preview-row-frame'].key;
    const count = countTextureInGameObjects(this.routeChoiceHover?.list ?? [], key);
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count
    };
  }


  private renderRouteChoiceOptionFrame(x: number, y: number, w: number, h: number, alpha: number) {
    return this.add.rectangle(x, y, w, h, 0x14232d, alpha)
      .setName('route-choice-option-frame');
  }

  private renderRouteEventChoiceTile(
    node: RouteNode, choice: NodeChoiceOption, x: number, y: number,
    w: number, h: number, index: number, accent: number
  ) {
    const left = x - w / 2;
    const bg = this.renderRouteChoiceOptionFrame(x, y, w, h, choice.locked ? 0.25 : 0.82);
    const focused = eventChoiceState(this).index === index;
    const restore = () => bg.setFillStyle(0x14232d, choice.locked ? 0.25 : 0.82)
      .setStrokeStyle(focused ? 2 : 0, accent, 0.9);
    restore();
    bg.setName('route-choice-option-frame').setData('choiceKey', choice.key)
      .setInteractive({ useHandCursor: !choice.locked });
    if (!choice.locked) bg.on('pointerdown', () => handleEventChoice(this, 'confirm', index));
    bg.on('pointerover', () => {
      bg.setFillStyle(0x203944, 1).setStrokeStyle(1, choice.locked ? 0xaa7970 : accent, 0.8);
    });
    bg.on('pointerout', () => {
      restore();
    });
    this.add.text(left + 18, y, choice.locked ? '–' : String(index + 1).padStart(2, '0'), {
      fontFamily: UI_FONT, fontSize: '19px', color: '#a9bdc5', resolution: 2
    }).setOrigin(0, 0.5);
    const title = this.add.text(left + 54, y - h / 2 + 8, choice.text, {
      fontFamily: UI_FONT, fontSize: '21px', fontStyle: UI_BOLD,
      color: choice.locked ? '#a9b3bb' : '#f3e6c9', resolution: 2,
      wordWrap: { width: w - 162 }, maxLines: 1
    }).setName('route-choice-title');
    const summary = choice.locked ? choice.lockedText ?? 'Locked' : routeEffectSummary(choice.effects);
    const detail = this.add.text(left + 54, y - h / 2 + (h >= 84 ? 36 : 33), summary, {
      fontFamily: UI_FONT, fontSize: '19px', color: choice.locked ? '#e5a59c' : '#b8cdd2',
      resolution: 2, wordWrap: { width: w - 162, useAdvancedWrap: true }, maxLines: h >= 84 ? 2 : 1, lineSpacing: 0
    }).setName('route-choice-summary');
    // Measured word excerpts avoid repeatedly re-wrapping one character at a
    // time while keeping the full copy in the adjacent read-only detail view.
    fitTextExcerpt(title, choice.text, 1);
    fitTextExcerpt(detail, summary, h >= 84 ? 2 : 1);
    const titleOverflow = Boolean(title.getData('truncated'));
    const detailOverflow = Boolean(detail.getData('truncated'));
    bg.setData('hasOverflowDetail', titleOverflow || detailOverflow).setData('focused', focused);
    quietButton(this, { x: x + w / 2 - 48, y, width: 88, label: 'Read', name: 'route-event-details-hit',
      onActivate: () => handleEventChoice(this, 'inspect', index) }).setData('choiceIndex', index);
  }

  private renderCacheDrawerTile(
    node: RouteNode, choice: NodeChoiceOption, x: number, y: number,
    w: number, h: number, index: number, accent: number
  ) {
    this.renderRouteEventChoiceTile(node, { ...choice, text: cacheDrawerProfile(choice, index).title }, x, y, w, h, index, accent);
  }



  private renderSignalSetPieceOverlay(node: RouteNode) {
    const choices = this.nodeChoiceList(node);
    const accent = routeEventAccent(node.type);
    const background = this.routeEventBackdropAsset(node);
    this.queueRouteEventSetPieceArtLoad(node);
    this.renderRouteEventBackdrop(node, 1, { showBottomBand: false });
    if (background && this.textures.exists(background.key)) {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.08)
        .setInteractive({ useHandCursor: false });
    }
    this.renderRouteEventTitlePlaque(node, GAME_WIDTH / 2, 132);
    this.renderRouteEventResident(node, 146, GAME_HEIGHT - 8, 330, 456, { showGlow: false });
    this.renderSignalSwitchboard(1018, 486, 430, 386, accent);
    this.renderRouteEventChoiceColumn(node, choices, 560, 316, 472, accent);
  }

  private renderSignalSwitchboard(x: number, y: number, w: number, h: number, accent: number) {
    const prop = ROUTE_EVENT_PROP_ASSETS.signalSwitchboard;
    if (!this.textures.exists(prop.key)) return;
    this.renderRouteEventPropCenterpiece(prop, x + 12, y + 12, w + 92, h + 54, accent, UI_FIELD.cyan, {
      showGlow: false, showAccentLine: false
    });
  }

  private renderMarketCardOffers(x: number, y: number) {
    return this.routeSecondaryPresentationModule?.renderMarketCardOffers.call(this, x, y);
  }

  private renderMarketWaymarkOffers(x: number, rowY: number) {
    return this.routeSecondaryPresentationModule?.renderMarketWaymarkOffers.call(this, x, rowY);
  }

  private renderMarketUtilityOffers(x: number, y: number, goodsRowY?: number, view: 'all' | 'supplies' | 'services' = 'all') {
    return this.routeSecondaryPresentationModule?.renderMarketUtilityOffers.call(this, x, y, goodsRowY, view);
  }

  private renderMarketObjectBackplate(x: number, y: number, w: number, h: number, accent: number) {
    return this.routeSecondaryPresentationModule?.renderMarketObjectBackplate.call(this, x, y, w, h, accent);
  }

  private renderMarketOfferTray(x: number, y: number, w: number, h: number, enabled: boolean, alpha = 0.42) {
    return this.routeSecondaryPresentationModule?.renderMarketOfferTray.call(this, x, y, w, h, enabled, alpha);
  }

  private renderMarketPriceChipFrame(x: number, y: number, w: number, h: number, enabled: boolean, alpha = 0.62) {
    return this.routeSecondaryPresentationModule?.renderMarketPriceChipFrame.call(this, x, y, w, h, enabled, alpha);
  }

  private renderMarketItemLabelBox(
    x: number,
    y: number,
    w: number,
    h: number,
    kicker: string,
    title: string,
    price: number,
    enabled: boolean,
    accent: number
  ) {
    return this.routeSecondaryPresentationModule?.renderMarketItemLabelBox.call(this, x, y, w, h, kicker, title, price, enabled, accent);
  }

  private renderMarketItemLabelFrame(x: number, y: number, w: number, h: number, enabled: boolean) {
    return this.routeSecondaryPresentationModule?.renderMarketItemLabelFrame.call(this, x, y, w, h, enabled);
  }

  private renderMarketServiceButton(
    x: number,
    y: number,
    w: number,
    h: number,
    iconId: UiIconId,
    price: number,
    enabled: boolean,
    accent: number,
    label?: string
  ) {
    return this.routeSecondaryPresentationModule?.renderMarketServiceButton.call(this, x, y, w, h, iconId, price, enabled, accent, label);
  }

  private renderMarketServiceButtonFrame(x: number, y: number, w: number, h: number, enabled: boolean) {
    return this.routeSecondaryPresentationModule?.renderMarketServiceButtonFrame.call(this, x, y, w, h, enabled);
  }

  private renderMarketPriceTag(x: number, y: number, price: number, enabled: boolean, accent: number, verb: string) {
    return this.routeSecondaryPresentationModule?.renderMarketPriceTag.call(this, x, y, price, enabled, accent, verb);
  }

  private renderMarketCardPriceTagFrame(x: number, y: number, w: number, h: number, enabled: boolean) {
    return this.routeSecondaryPresentationModule?.renderMarketCardPriceTagFrame.call(this, x, y, w, h, enabled);
  }

  private renderMarketEnamelButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    enabled: boolean,
    onClick: () => void,
    accent = UI_FIELD.gold,
    fontSize = '14px',
    detail?: string
  ) {
    return this.routeSecondaryPresentationModule?.renderMarketEnamelButton.call(this, x, y, w, h, label, enabled, onClick, accent, fontSize, detail);
  }

  private renderMarketSoldSlat(x: number, y: number, w: number, _h: number) {
    return this.routeSecondaryPresentationModule?.renderMarketSoldSlat.call(this, x, y, w, _h);
  }

  private marketOverlayFrame() {
    return {
      left: 62,
      right: GAME_WIDTH - 62,
      top: 102,
      bottom: GAME_HEIGHT - 32,
      cx: GAME_WIDTH / 2,
      w: GAME_WIDTH - 124
    };
  }

  private marketShelfLayout() {
    const frame = this.marketOverlayFrame();
    const shelfLift = 34;
    return {
      frame,
      cardShelfX: frame.left + 576,
      cardShelfY: frame.top + 286 - shelfLift,
      goodsRowY: frame.top + 526 - shelfLift,
      utilityX: frame.left + 810,
      serviceBaseY: frame.top + 292 - 44
    };
  }

  private marketCardOfferAnchor(slotIndex: number) {
    const layout = this.marketShelfLayout();
    return {
      x: layout.cardShelfX - 250 + slotIndex * 205,
      y: layout.cardShelfY - 4 + (slotIndex % 2 === 0 ? -8 : 8)
    };
  }

  private marketWaymarkOfferAnchor(slotIndex: number) {
    const layout = this.marketShelfLayout();
    return {
      x: layout.frame.left + 458 - 134 + slotIndex * 134,
      y: layout.goodsRowY - 16
    };
  }

  private marketUtilityOfferAnchor(slotIndex: number) {
    const layout = this.marketShelfLayout();
    let serviceIndex = 0;
    let supplyIndex = 0;
    for (let i = 0; i < this.marketUtilityShelf.length; i += 1) {
      const listing = this.marketUtilityShelf[i];
      if (listing?.id !== 'supply') {
        const anchor = { x: layout.utilityX + 300, y: layout.serviceBaseY + serviceIndex * 58 };
        if (i === slotIndex) return anchor;
        serviceIndex += 1;
        continue;
      }
      const anchor = { x: layout.utilityX - 72 + supplyIndex * 134, y: layout.goodsRowY - 16 };
      if (i === slotIndex) return anchor;
      supplyIndex += 1;
    }
    return { x: layout.utilityX + 300, y: layout.serviceBaseY };
  }

  private marketRefreshAnchor() {
    const layout = this.marketShelfLayout();
    const serviceCount = this.marketUtilityShelf.filter((listing) => listing.id !== 'supply').length;
    return { x: layout.utilityX + 300, y: layout.serviceBaseY + serviceCount * 58 };
  }

  marketPurchaseFlourishState() {
    const key = uiIconAssets['market-purchase-flourish'].key;
    const count = this.children.list.filter((child: any) => child.texture?.key === key || child.name === 'market-purchase-flourish').length;
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count,
      bursts: this.marketPurchaseFlourishBursts
    };
  }

  private renderMarketPurchaseFeedback(x: number, y: number, accent = UI_FIELD.gold) {
    return this.routeSecondaryPresentationModule?.renderMarketPurchaseFeedback.call(this, x, y, accent);
  }

  marketOfferTrayState() {
    const key = uiIconAssets['market-offer-tray'].key;
    const count = countTextureInGameObjects(this.children.list, key);
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count
    };
  }

  marketPriceChipFrameState() {
    const key = uiIconAssets['market-price-chip-frame'].key;
    const count = countTextureInGameObjects(this.children.list, key);
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count
    };
  }

  marketServiceButtonFrameState() {
    const key = uiIconAssets['market-service-button-frame'].key;
    const count = countTextureInGameObjects(this.children.list, key);
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count
    };
  }

  marketItemLabelFrameState() {
    const key = uiIconAssets['market-item-label-frame'].key;
    const count = countTextureInGameObjects(this.children.list, key);
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count
    };
  }

  marketCardPriceTagFrameState() {
    const key = uiIconAssets['market-card-price-tag-frame'].key;
    const count = countTextureInGameObjects(this.children.list, key);
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count
    };
  }

  marketObjectBackplateFrameState() {
    const key = uiIconAssets['market-object-backplate-frame'].key;
    const count = countTextureInGameObjects(this.children.list, key);
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count
    };
  }

  marketSectionHeaderFrameState() {
    const key = uiIconAssets['market-section-header-frame'].key;
    const count = countTextureInGameObjects(this.children.list, key);
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count
    };
  }

  marketVendorTitlePlaqueState() {
    const key = uiIconAssets['market-vendor-title-plaque'].key;
    const count = countTextureInGameObjects(this.children.list, key);
    return {
      loaded: this.textures.exists(key),
      rendered: count > 0,
      count
    };
  }

  private replayMarketPurchaseFlourish() {
    if (!this.marketPurchaseFlourishReplay || !this.marketOpen) return;
    if (this.time.now > this.marketPurchaseFlourishReplay.expiresAt) {
      this.marketPurchaseFlourishReplay = undefined;
      return;
    }
    this.marketPurchaseFlourish(
      this.marketPurchaseFlourishReplay.x,
      this.marketPurchaseFlourishReplay.y,
      this.marketPurchaseFlourishReplay.accent,
      false
    );
  }

  private marketPurchaseFlourish(x: number, y: number, accent = UI_FIELD.gold, countBurst = true) {
    const key = uiIconAssets['market-purchase-flourish'].key;
    if (!this.textures.exists(key)) return;
    setTextureFilter(this.textures.get(key), Phaser.Textures.FilterMode.LINEAR);
    if (countBurst) {
      this.marketPurchaseFlourishBursts += 1;
      birdAudio.play('marketPurchase', 1);
    }
    const leanEffects = prefersLeanEffects();
    const glow = this.add.circle(x, y, 76, accent, 0.2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(22990)
      .setName('market-purchase-flourish');
    const burst = this.add.image(x, y, key)
      .setDisplaySize(174, 174)
      .setAlpha(0.96)
      .setDepth(23000)
      .setName('market-purchase-flourish');
    const glint = this.add.image(x, y, key)
      .setDisplaySize(184, 184)
      .setAlpha(0.46)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(23001)
      .setName('market-purchase-flourish');
    const particleBurst = this.add.particles(x, y, key, {
      lifespan: 360,
      speed: { min: 52, max: 132 },
      scale: { start: 0.035, end: 0 },
      alpha: { start: 0.38, end: 0 },
      rotate: { min: -80, max: 80 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false
    }).setDepth(22999).setName('market-purchase-flourish');
    particleBurst.explode(leanEffects ? 5 : 10);
    const motes: Phaser.GameObjects.GameObject[] = [];
    const moteCount = leanEffects ? 6 : 12;
    for (let i = 0; i < moteCount; i += 1) {
      const angle = Phaser.Math.DegToRad(i * (360 / moteCount) + Phaser.Math.Between(-9, 9));
      const radius = 18 + Phaser.Math.Between(8, 46);
      const color = i % 3 === 0 ? 0x8df4ff : i % 3 === 1 ? 0xf0c36f : 0xc98bff;
      const mote = this.add.rectangle(x + Math.cos(angle) * 16, y + Math.sin(angle) * 12, 18, 3, color, 0.78)
        .setAngle(Phaser.Math.RadToDeg(angle))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(23002)
        .setName('market-purchase-flourish');
      motes.push(mote);
      this.tweens.add({
        targets: mote,
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        alpha: 0,
        scaleX: 0.45,
        duration: 420,
        ease: 'Cubic.easeOut',
        onComplete: () => mote.destroy()
      });
    }
    if (prefersReducedMotion()) {
      this.time.delayedCall(1400, () => {
        glow.destroy();
        burst.destroy();
        glint.destroy();
        particleBurst.destroy();
        motes.forEach((mote) => mote.destroy());
      });
      return;
    }
    this.tweens.add({
      targets: [glow, burst, glint],
      scaleX: '+=0.18',
      scaleY: '+=0.18',
      angle: 10,
      alpha: { value: 0, duration: 520, delay: 900 },
      duration: 1400,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        glow.destroy();
        burst.destroy();
        glint.destroy();
        particleBurst.destroy();
      }
    });
  }



  buyMarketCard(slotIndex = 0) {
    const listing = this.marketCardShelf[slotIndex] ?? this.marketCardShelf.find((offer) => !offer.sold);
    if (!listing || listing.sold || this.runState.scrap < listing.price) return;
    const offer = cloneCard(listing.id);
    const anchor = this.marketCardOfferAnchor(slotIndex);
    this.spendRouteScrap(listing.price);
    this.runState.deck.push({ id: offer.id, upgraded: offer.upgraded });
    const acquisition = recordRunCardAcquisitions(this.runState, [offer.id], 'market');
    listing.sold = true;
    this.applyRouteMarkTrigger('afterMarketPurchase');
    this.marketMessage = memoryStorageSessionActive()
      ? `${displayName(offer)} joins this practice flight for ${listing.price} Scrap. Nothing saved.`
      : !acquisition.saved ? `${displayName(offer)} joins this flight. Collection save pending; keep this tab open and retry saving.`
      : acquisition.completedTargets.includes(offer.id)
      ? `Hunt complete! ${displayName(offer)} joins this flight for ${listing.price} Scrap. Milestone recorded.`
      : acquisition.firstCopies.includes(offer.id)
        ? `First collection claim! ${displayName(offer)} joins this flight for ${listing.price} Scrap.`
        : `${displayName(offer)} joins this flight for ${listing.price} Scrap. Collection history updated.`;
    this.renderMarketPurchaseFeedback(anchor.x, anchor.y, offer.type === 'major' ? UI_FIELD.gold : suitAccentColor(offer));
    this.queueMarketShelfArtLoad();
  }

  buyMarketRouteMark(slotIndex = 0) {
    const listing = this.marketWaymarkShelf[slotIndex] ?? this.marketWaymarkShelf.find((offer) => !offer.sold);
    const mark = listing ? alphaRouteMarkLibrary.get(listing.id) : undefined;
    if (!listing || listing.sold || !mark || this.runState.scrap < listing.price) return;
    const anchor = this.marketWaymarkOfferAnchor(slotIndex);
    this.spendRouteScrap(listing.price);
    this.addRouteMark(mark.id);
    listing.sold = true;
    this.applyRouteMarkTrigger('afterMarketPurchase');
    this.marketMessage = `${mark.name} is pinned to the route board for ${listing.price} Scrap.`;
    this.renderMarketPurchaseFeedback(anchor.x, anchor.y, UI_FIELD.violet);
  }


  buyMarketUtility(slotIndex = 0) {
    const listing = this.marketUtilityShelf[slotIndex] ?? this.marketUtilityShelf.find((offer) => !offer.sold);
    if (!listing || listing.sold || !this.marketUtilityEnabled(listing)) return;
    const anchor = this.marketUtilityOfferAnchor(slotIndex);
    if (listing.id === 'preen') {
      this.openMarketCardPicker(slotIndex, 'preen');
      return;
    } else if (listing.id === 'release') {
      this.openMarketCardPicker(slotIndex, 'release');
      return;
    } else if (listing.id === MARKET_BOSS_GUARD) {
      this.spendRouteScrap(listing.price);
      this.runState.nextCombat = {
        ...this.runState.nextCombat,
        openSkyGuard: (this.runState.nextCombat?.openSkyGuard ?? 0) + MARKET_BOSS_GUARD_SKY_GUARD,
        bossDamageShield: (this.runState.nextCombat?.bossDamageShield ?? 0) + MARKET_BOSS_GUARD_SHIELD
      };
      listing.sold = true;
      this.applyRouteMarkTrigger('afterMarketPurchase');
      this.marketMessage = `Boss rigging secured for ${listing.price} Scrap.`;
    } else if (listing.id === MARKET_ROUTE_SCOUT) {
      this.spendRouteScrap(listing.price);
      this.resolveRouteEffect(`peekNextNodes(${MARKET_ROUTE_SCOUT_OPEN_SKY_REDUCTION})`);
      listing.sold = true;
      this.applyRouteMarkTrigger('afterMarketPurchase');
      this.marketMessage = `Route plan packed for ${listing.price} Scrap.`;
    } else {
      const supply = listing.supplyId ? alphaSupplyLibrary.get(listing.supplyId) : undefined;
      if (!supply || (this.runState.supplies ?? []).length >= runSupplyCapacity(this.runState)) return;
      this.runState.supplies.push(supply.id);
      this.spendRouteScrap(listing.price);
      listing.sold = true;
      this.applyRouteMarkTrigger('afterMarketPurchase');
      this.marketMessage = `${supply.name} is packed for the road for ${listing.price} Scrap.`;
    }
    this.renderMarketPurchaseFeedback(anchor.x, anchor.y, listing.id === 'supply' ? UI_FIELD.green : UI_FIELD.cyan);
  }

  private openMarketCardPicker(slotIndex: number, mode: CardPickerMode) {
    this.cardPickerMode = mode;
    this.cardPickerContext = 'market';
    this.cardPickerRemainingPicks = 1;
    this.cardPickerFocusIndex = 0;
    this.cardPickerInspectionOpen = false;
    this.cardPickerArmedIndex = undefined;
    this.marketPickerUtilitySlot = slotIndex;
    this.cardPickerScroll = 0;
    this.hideHoverCardDetail();
    this.hideMarketItemDetail();
    this.renderAll();
  }

  private marketRefreshCost() {
    return MARKET_REFRESH_BASE_PRICE + this.marketRefreshCount * 20 + activeMapIndex * 8;
  }

  refreshMarket() {
    const cost = this.marketRefreshCost();
    if (this.runState.scrap < cost) return;
    const anchor = this.marketRefreshAnchor();
    this.spendRouteScrap(cost);
    this.marketRefreshCount += 1;
    this.marketCardShelf = this.createMarketCardShelf(this.marketRng('cards'));
    this.marketWaymarkShelf = this.createMarketWaymarkShelf(this.marketRng('waymarks'));
    this.marketUtilityShelf = this.createMarketUtilityShelf(this.marketRng('utilities'));
    this.marketMessage = `A runner calls down the line. Fresh stock arrives for ${cost} Scrap.`;
    this.renderMarketPurchaseFeedback(anchor.x, anchor.y, UI_FIELD.cyan);
    this.queueMarketShelfArtLoad();
  }

  private marketRng(salt: string) {
    return seededRng(`${this.runState.seed ?? activeSeed}:${this.marketNodeId ?? 'market'}:${this.marketRefreshCount}:${salt}`);
  }

  private createMarketCardShelf(rng: () => number): MarketCardListing[] {
    const owned = new Set(this.runState.deck.map((card) => card.id));
    const picked = new Set<string>();
    const listings: MarketCardListing[] = [];
    for (const slot of alphaMarketConfig.cardSlots) {
      const basePool = arcanaRewardPool.filter((id) => !owned.has(id) && !picked.has(id));
      let pool = slot.rarity === 'weighted'
        ? basePool
        : basePool.filter((id) => cardLibrary[id]?.runtime.rarity === slot.rarity);
      if (pool.length === 0) pool = basePool;
      const id = this.pickWeighted(pool, (candidate) => this.marketCardWeight(candidate, slot.rarity), rng);
      const card = id ? cardLibrary[id] : undefined;
      if (!id || !card) continue;
      picked.add(id);
      listings.push({
        id,
        price: priceInBand(slot.price, rarityStep(card.runtime.rarity))
      });
    }
    return listings;
  }

  private marketCardWeight(id: string, slotRarity: 'common' | 'uncommon' | 'rare' | 'weighted') {
    const rarity = cardLibrary[id]?.runtime.rarity ?? 'common';
    if (slotRarity !== 'weighted') return rarity === slotRarity ? 100 : 20;
    const base = REWARD_RARITY_WEIGHTS[rarity] ?? 50;
    if (rarity === 'legendary') return base + activeMapIndex * 3;
    if (rarity === 'rare') return base + activeMapIndex * 8;
    if (rarity === 'uncommon') return base + activeMapIndex * 6;
    return base;
  }

  private createMarketWaymarkShelf(rng: () => number): MarketWaymarkListing[] {
    const picked = new Set<string>();
    const listings: MarketWaymarkListing[] = [];
    for (const slot of alphaMarketConfig.routeMarkSlots) {
      const pool = MARKET_ROUTE_MARK_IDS
        .filter((id) => !this.hasRouteMark(id) && !picked.has(id))
        .filter((id) => slot.selector !== 'nonBoss' || alphaRouteMarkLibrary.get(id)?.rarity !== 'boss');
      const id = this.pickWeighted(pool, (candidate) => this.marketWaymarkWeight(candidate), rng);
      const mark = id ? alphaRouteMarkLibrary.get(id) : undefined;
      if (!id || !mark) continue;
      picked.add(id);
      listings.push({
        id,
        price: priceInBand(slot.price, rarityStep(mark.rarity))
      });
    }
    return listings;
  }

  private marketWaymarkWeight(id: string) {
    const rarity = alphaRouteMarkLibrary.get(id)?.rarity ?? 'common';
    if (rarity === 'rare') return 24 + activeMapIndex * 5;
    if (rarity === 'uncommon') return 58 + activeMapIndex * 4;
    return 100;
  }

  private createMarketUtilityShelf(rng: () => number): MarketUtilityListing[] {
    const listings: MarketUtilityListing[] = [];
    const preenPrices = this.pickerEligibleCards('preen', 'market').map((entry) => entry.cost);
    if (preenPrices.length) listings.push({ id: 'preen', price: Math.min(...preenPrices) });
    const releasePrices = this.pickerEligibleCards('release', 'market').map((entry) => entry.cost);
    if (releasePrices.length) listings.push({ id: 'release', price: Math.min(...releasePrices) });
    if (activeMapIndex) listings.push({ id: MARKET_BOSS_GUARD, price: 120 + activeMapIndex * 35 });
    if (activeMapIndex) listings.push({ id: MARKET_ROUTE_SCOUT, price: 80 + activeMapIndex * 25 });

    const pickedSupplies = new Set(this.runState.supplies ?? []);
    for (const slot of alphaMarketConfig.supplySlots) {
      const pool = [...alphaSupplyLibrary.values()].filter((supply) => !pickedSupplies.has(supply.id));
      const supply = this.pickWeighted(pool, (candidate) => this.marketSupplyWeight(candidate), rng);
      if (!supply) continue;
      pickedSupplies.add(supply.id);
      listings.push({
        id: 'supply',
        supplyId: supply.id,
        price: priceInBand(slot.price, rarityStep(supply.rarity))
      });
    }
    return listings;
  }

  private marketSupplyWeight(supply: RuntimeSupply) {
    if (supply.rarity === 'rare') return 20 + activeMapIndex * 4;
    if (supply.rarity === 'uncommon') return 52 + activeMapIndex * 4;
    return 100;
  }

  private pickWeighted<T>(items: T[], weightOf: (item: T) => number, rng: () => number) {
    if (items.length === 0) return undefined;
    const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0);
    if (total <= 0) return items[Math.floor(rng() * items.length)];
    let roll = rng() * total;
    for (const item of items) {
      roll -= Math.max(0, weightOf(item));
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }

  private marketUtilityLabel(listing: MarketUtilityListing) {
    if (listing.id === 'preen') return 'Preen a Card';
    if (listing.id === 'release') return 'Release a Card';
    if (listing.id === MARKET_BOSS_GUARD) return 'Boss Rigging';
    if (listing.id === MARKET_ROUTE_SCOUT) return 'Route Plan';
    const supply = listing.supplyId ? alphaSupplyLibrary.get(listing.supplyId) : undefined;
    return supply?.name ?? 'Supply Crate';
  }

  private marketUtilityProxyArtAsset(listing: MarketUtilityListing) {
    if (!listing.supplyId) return undefined;
    const supplyArt = supplyCompactArtAssets[listing.supplyId];
    if (supplyArt) return supplyArt;
    const markId = MARKET_SUPPLY_PROXY_MARKS[listing.supplyId];
    return markId ? waymarkCompactArtAssets[markId] : undefined;
  }

  private marketUtilityShelfArtAsset(listing: MarketUtilityListing) {
    if (listing.id === 'preen') return uiIconAssets['market-preen-service'];
    if (listing.id === 'release') return uiIconAssets['market-remove-service'];
    if (listing.id === MARKET_BOSS_GUARD) return uiIconAssets['market-boss-rigging-service'];
    if (listing.id === MARKET_ROUTE_SCOUT) return uiIconAssets['market-route-plan-service'];
    if (listing.id === 'supply') return uiIconAssets['market-supply-crate'];
    return this.marketUtilityProxyArtAsset(listing);
  }

  private marketUtilityServiceIcon(listing: MarketUtilityListing): UiIconId {
    if (listing.id === 'preen') return 'market-preen-service';
    if (listing.id === 'release') return 'market-remove-service';
    if (listing.id === MARKET_BOSS_GUARD) return 'market-boss-rigging-service';
    if (listing.id === MARKET_ROUTE_SCOUT) return 'market-route-plan-service';
    return marketIconForKicker(this.marketUtilityVerb(listing)) ?? 'market-basket';
  }

  private marketUtilityDetail(listing: MarketUtilityListing) {
    if (listing.id === 'preen') return 'Choose one card in the flock deck to upgrade.';
    if (listing.id === 'release') return 'Choose one card to remove from the flock deck.';
    if (listing.id === MARKET_BOSS_GUARD) return 'Start the next boss fight with extra Cover and Open Sky Guard.';
    if (listing.id === MARKET_ROUTE_SCOUT) return 'Pack next-fight Open Sky Guard and soften the next Open Sky increase.';
    const supply = listing.supplyId ? alphaSupplyLibrary.get(listing.supplyId) : undefined;
    return supply?.description ?? 'Pack a one-use tool.';
  }

  private marketUtilityVerb(listing: MarketUtilityListing) {
    if (listing.id === 'preen') return 'Preen';
    if (listing.id === 'release') return 'Remove';
    if (listing.id === MARKET_BOSS_GUARD) return 'Rig';
    if (listing.id === MARKET_ROUTE_SCOUT) return 'Plan';
    return 'Pack';
  }

  private marketUtilityEnabled(listing: MarketUtilityListing) {
    if (listing.id === 'preen') return this.pickerEligibleCards('preen', 'market').some((entry) => this.runState.scrap >= entry.cost);
    if (listing.id === 'release') return this.pickerEligibleCards('release', 'market').some((entry) => this.runState.scrap >= entry.cost);
    if (listing.id === MARKET_BOSS_GUARD || listing.id === MARKET_ROUTE_SCOUT) return this.runState.scrap >= listing.price;
    if (this.runState.scrap < listing.price) return false;
    return !!listing.supplyId && (this.runState.supplies ?? []).length < runSupplyCapacity(this.runState);
  }

  private leaveMarket() {
    if (this.marketFocusArmedId) {
      this.marketFocusArmedId = undefined;
      this.renderAll();
      return;
    }
    const node = currentMap().nodes.find((candidate) => candidate.id === this.marketNodeId);
    this.completePendingRouteNode(node?.id);
    this.runState.routeLog.push(node ? `${node.label}: market business settled.` : 'Market business settled.');
    this.runState.routeLog = this.runState.routeLog.slice(-8);
    this.marketOpen = false;
    this.marketNodeId = undefined;
    this.marketMessage = '';
    this.scene.restart({ runState: cloneRunState(this.runState) });
  }

  marketCardOffer() {
    const listing = this.marketCardShelf.find((offer) => !offer.sold);
    if (!listing) return undefined;
    const card = cloneCard(listing.id);
    card.upgraded = false;
    return card;
  }

  marketCardOffers() {
    return this.marketCardShelf.map((listing) => ({
      ...listing,
      card: cloneCard(listing.id)
    }));
  }

  marketWaymark(id: string) {
    return alphaRouteMarkLibrary.get(id);
  }

  marketSupply(id?: string) {
    return id ? alphaSupplyLibrary.get(id) : undefined;
  }

  marketRouteMarkOffer() {
    const listing = this.marketWaymarkShelf.find((offer) => !offer.sold);
    const mark = listing ? alphaRouteMarkLibrary.get(listing.id) : undefined;
    return mark ? { id: mark.id, name: mark.name, text: mark.description, price: listing?.price ?? MARKET_ROUTE_MARK_PRICE } : undefined;
  }

  marketRouteMarkOffers() {
    return this.marketWaymarkShelf.map((listing) => {
      const mark = alphaRouteMarkLibrary.get(listing.id);
      return {
        ...listing,
        name: mark?.name ?? listing.id,
        text: mark?.description ?? ''
      };
    });
  }

  marketPreenCandidate() {
    return this.firstPreenCandidate();
  }

  private firstPreenCandidate() {
    const saved = this.runState.deck.find((card) => (
      !card.upgraded && hasMeaningfulCardUpgrade(cardLibrary[card.id]?.runtime)
    ));
    if (!saved) return undefined;
    const card = cloneCard(saved.id);
    card.upgraded = saved.upgraded;
    return card;
  }

  private marketPreenPrice(card?: Card) {
    const shelfPreen = !card ? this.marketUtilityShelf.find((offer) => offer.id === 'preen' && !offer.sold) : undefined;
    if (shelfPreen) return shelfPreen.price;
    const raritySurcharge = card ? Math.min(2, rarityStep(card.runtime.rarity)) * 10 : 0;
    return Math.max(35, MARKET_PREEN_PRICE + raritySurcharge - this.routeMarkValue('passive', 'reducePreenPrice'));
  }


  private marketReleasePrice() {
    const service = alphaMarketConfig.services.find((entry) => entry.id === 'release');
    const starterSize = getLeader(this.runState.leaderId).startingDeckIds.length;
    const thinnerDeckSurcharge = Math.max(0, starterSize - this.runState.deck.length) * (service?.priceIncrease ?? 0);
    return (service?.basePrice ?? 70) + thinnerDeckSurcharge + activeMapIndex * 8;
  }

  private firstUnownedRouteMark() {
    return routeMarks.find((mark) => !this.hasRouteMark(mark.id));
  }

  private addRouteMark(markId: string) {
    const result = addWaymarkWithCapacity(this.runState.routeMarks, markId);
    this.runState.routeMarks = result.routeMarks;
    if (result.replaced) {
      const gained = alphaRouteMarkLibrary.get(markId)?.name ?? 'Waymark';
      const replaced = alphaRouteMarkLibrary.get(result.replaced)?.name ?? 'older Waymark';
      this.runState.routeLog.push(`${gained} replaces ${replaced}.`);
    }
  }

  private hasRouteMark(markId: string) {
    return this.runState.routeMarks.includes(markId);
  }

  private preenFirstAvailableCard() {
    const saved = this.runState.deck.find((card) => (
      !card.upgraded && hasMeaningfulCardUpgrade(cardLibrary[card.id]?.runtime)
    ));
    if (!saved) return undefined;
    saved.upgraded = true;
    return cloneCard(saved.id);
  }

  private openDeckOverlay() {
    this.cancelDeckSave();
    this.deckOverlayOpen = true;
    this.flockOverlayOpen = false;
    this.waymarkDrawerOpen = false;
    this.supplyDrawerOpen = false;
    this.inspectedCardId = undefined;
    this.cardReviewScroll = 0;
    this.deckReviewFilter = 'all';
    this.deckReviewSort = 'run';
    this.deckReviewQuery = '';
    this.deckReviewSearchActive = false;
    this.deckReviewCompareCardId = undefined;
    this.deckSaveStatus = 'idle';
    this.routeDeckBrowserFailed = false;
    this.renderAll();
    this.ensureRouteDeckBrowser();
  }

  savedDeckRecordState() {
    const allSavedDecks = this.savedDeckModule?.sanitizeSavedDecks(loadAccount().decks) ?? [];
    const savedDecks = this.savedDeckModule?.activeSavedDecks(allSavedDecks) ?? [];
    const capacity = this.savedDeckModule?.SAVED_DECK_LIMIT ?? 6;
    return {
      count: savedDecks.length,
      capacity,
      archived: allSavedDecks.length - savedDecks.length,
      status: this.deckSaveStatus,
      canSave: Boolean(this.savedDeckModule) && savedDecks.length < capacity && this.runState.deck.length > 0,
      currentDeckCards: this.runState.deck.length,
      persisted: true,
      affectsPower: false,
      refusesReplacementAtCapacity: true,
      location: 'Flock Record / Folios',
      input: {
        pointer: true,
        keyboard: 'V',
        controller: 'Y',
      },
    };
  }

  private cancelDeckSave() {
    this.deckSaveRequestId++;
    globalThis.clearTimeout(this.deckSaveTimer);
    this.deckSaveTimer = undefined;
    if (this.deckSaveStatus === 'loading') this.deckSaveStatus = 'idle';
  }

  private saveCurrentDeckToFolio() {
    if (!this.deckOverlayOpen || this.deckReviewSearchActive || this.pauseOverlayOpen || this.settingsOverlayOpen
      || this.deckSaveStatus === 'loading' || !this.runState.deck.length) return;
    if (!this.savedDeckModule) {
      const requestId = ++this.deckSaveRequestId;
      this.deckSaveStatus = 'loading';
      this.deckSaveTimer = globalThis.setTimeout(() => {
        if (requestId !== this.deckSaveRequestId) return;
        this.cancelDeckSave();
        this.deckSaveStatus = 'failed';
        if (this.sys.settings.active && this.deckOverlayOpen) this.renderAll();
      }, 8000);
      this.renderAll();
      void loadSavedDeckModule()
        .then((module) => {
          if (!this.sys.settings.active) return;
          this.savedDeckModule = module;
          if (requestId !== this.deckSaveRequestId) return;
          globalThis.clearTimeout(this.deckSaveTimer);
          this.deckSaveTimer = undefined;
          this.deckSaveStatus = 'idle';
          if (!this.deckOverlayOpen || this.deckReviewSearchActive || this.pauseOverlayOpen || this.settingsOverlayOpen) {
            this.renderAll();
            return;
          }
          this.saveCurrentDeckToFolio();
        })
        .catch((error) => {
          if (!this.sys.settings.active || requestId !== this.deckSaveRequestId) return;
          globalThis.clearTimeout(this.deckSaveTimer);
          this.deckSaveTimer = undefined;
          console.warn('Flight Folios unavailable.', error);
          this.deckSaveStatus = 'failed';
          playUiSound('locked');
          this.renderAll();
        });
      return;
    }
    const account = loadAccount();
    const leaderId = this.runState.leaderId ?? defaultLeaderId;
    const decks = this.savedDeckModule.appendFlightFolio(account.decks, {
      leaderName: getLeader(leaderId).name,
      leaderId,
      cards: this.runState.deck,
      sourceSeed: this.runState.seed ?? '',
      runMode: this.runState.runMode ?? 'full',
    });
    if (decks) {
      account.decks = decks;
      this.deckSaveStatus = saveAccount(account) ? 'saved' : 'failed';
    } else this.deckSaveStatus = 'full';
    playUiSound(this.deckSaveStatus === 'saved' ? 'confirm' : 'locked');
    this.renderAll();
  }

  private ensureRouteDeckBrowser() {
    if (this.routeDeckBrowserModule || this.routeDeckBrowserLoading || this.routeDeckBrowserFailed) return;
    this.queueDeckCardArtLoad();
    this.routeDeckBrowserLoading = true;
    void loadRouteDeckBrowserModule()
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.routeDeckBrowserModule = module;
        this.routeDeckBrowserLoading = false;
        if (this.deckOverlayOpen) this.renderAll();
      })
      .catch((error) => {
        this.routeDeckBrowserLoading = false;
        this.routeDeckBrowserFailed = true;
        console.warn(LAZY_LOAD_FAILED, error);
        if (this.sys.settings.active && this.deckOverlayOpen) this.renderAll();
      });
  }

  private openFlockOverlay(mode: 'stats' | 'boss' | 'map' = 'stats') {
    this.flockOverlayMode = mode;
    this.bossPrepPage = 0;
    this.flockOverlayOpen = true;
    this.deckOverlayOpen = false;
    this.waymarkDrawerOpen = false;
    this.supplyDrawerOpen = false;
    this.supplyDrawerFocusIndex = 0;
    this.supplyDrawerArmedIndex = undefined;
    this.supplyDrawerInputActive = false;
    if (mode === 'map') this.ensureMapInspection();
    else this.ensureFlockStatsOverlay();
    this.renderAll();
  }

  private ensureFlockStatsOverlay() {
    if (this.flockStatsOverlayModule || this.flockStatsOverlayLoading) return;
    this.flockStatsOverlayLoading = true;
    this.flockStatsOverlayFailed = false;
    void loadFlockStatsOverlayModule()
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.flockStatsOverlayModule = module;
        this.flockStatsOverlayLoading = false;
        if (this.flockOverlayOpen) this.renderAll();
      })
      .catch((error) => {
        this.flockStatsOverlayLoading = false;
        this.flockStatsOverlayFailed = true;
        console.warn(LAZY_LOAD_FAILED, error);
        if (this.sys.settings.active && this.flockOverlayOpen) this.renderAll();
      });
  }

  private ensureMapInspection() {
    if (this.mapInspectionModule || this.mapInspectionLoading) return;
    this.mapInspectionLoading = true;
    this.mapInspectionFailed = false;
    void import('../game/route-map-inspection').then(module => {
      this.mapInspectionModule = module;
    }).catch(error => {
      this.mapInspectionFailed = true;
      console.warn(LAZY_LOAD_FAILED, error);
    }).finally(() => {
      this.mapInspectionLoading = false;
      // Only repaint an explicitly open reader, including one opened after a scene restart.
      if (this.scene.isActive() && this.flockOverlayOpen && this.flockOverlayMode === 'map') this.renderAll();
    });
  }

  private closeFlockOverlay() {
    this.flockOverlayOpen = false;
    this.renderAll();
  }

  private openWaymarkDrawer() {
    const marks = this.ownedRouteMarkDefs();
    this.waymarkDrawerOpen = true;
    this.routeWaymarkScroll = 0;
    this.routeWaymarkSelectedId = marks[0]?.id;
    this.routeWaymarkPinnedId = undefined;
    this.waymarkReviewFailed = false;
    this.deckOverlayOpen = false;
    this.flockOverlayOpen = false;
    this.supplyDrawerOpen = false;
    this.renderAll();
    this.queueRouteWaymarkArtLoad();
    this.ensureWaymarkReviewModule();
  }

  private closeWaymarkDrawer() {
    this.waymarkDrawerOpen = false;
    this.routeWaymarkSelectedId = undefined;
    this.routeWaymarkPinnedId = undefined;
    this.renderAll();
  }

  private routeUsableSupplyIndices() {
    return this.runState.supplies.flatMap((id, index) => {
      const supply = alphaSupplyLibrary.get(id);
      return supply && supply.timing !== 'combat' ? [index] : [];
    });
  }

  private openSupplyDrawer(inputActive = false) {
    const usable = this.routeUsableSupplyIndices();
    this.supplyDrawerOpen = true;
    this.supplyDrawerFocusIndex = usable[0] ?? 0;
    this.supplyDrawerArmedIndex = undefined;
    this.supplyDrawerInputActive = inputActive;
    this.deckOverlayOpen = false;
    this.flockOverlayOpen = false;
    this.waymarkDrawerOpen = false;
    this.routeSupplyDrawerFailed = false;
    this.renderAll();
    this.ensureRouteSupplyDrawer();
    this.queueRouteSupplyArtLoad();
  }

  private ensureRouteSupplyDrawer() {
    if (this.routeSupplyDrawerModule || this.routeSupplyDrawerLoading || this.routeSupplyDrawerFailed) return;
    this.routeSupplyDrawerLoading = true;
    void loadRouteSupplyDrawerModule()
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.routeSupplyDrawerModule = module;
        this.routeSupplyDrawerLoading = false;
        if (this.supplyDrawerOpen) this.renderAll();
      })
      .catch((error) => {
        this.routeSupplyDrawerLoading = false;
        this.routeSupplyDrawerFailed = true;
        console.warn(LAZY_LOAD_FAILED, error);
        if (this.sys.settings.active && this.supplyDrawerOpen) this.renderAll();
      });
  }

  private closeSupplyDrawer() {
    this.supplyDrawerOpen = false;
    this.supplyDrawerArmedIndex = undefined;
    this.supplyDrawerInputActive = false;
    this.renderAll();
  }

  private cancelOrCloseRouteSupplyDrawer() {
    if (this.supplyDrawerOpen && this.supplyDrawerArmedIndex !== undefined) {
      this.supplyDrawerArmedIndex = undefined;
      playUiSound('close');
      announceScreenReader('Supply use cancelled; the item remains packed.');
      this.renderAll();
      return;
    }
    this.closeSupplyDrawer();
  }

  private moveRouteSupplyFocus(direction: -1 | 1) {
    if (this.pauseOverlayOpen || this.settingsOverlayOpen) return;
    const usable = this.runState.supplies.map((_id, index) => index);
    if (!usable.length) {
      playUiSound('locked');
      return;
    }
    const current = usable.indexOf(this.supplyDrawerFocusIndex);
    this.supplyDrawerFocusIndex = usable[(current < 0 ? 0 : current + direction + usable.length) % usable.length];
    this.supplyDrawerArmedIndex = undefined;
    this.supplyDrawerInputActive = true;
    playUiSound('confirm');
    this.renderAll();
  }

  private requestRouteSupplyUse(index: number) {
    if (this.pauseOverlayOpen || this.settingsOverlayOpen) return;
    const id = this.runState.supplies[index];
    const supply = id ? alphaSupplyLibrary.get(id) : undefined;
    if (!supply || supply.timing === 'combat') {
      if (supply) {
        this.supplyDrawerFocusIndex = index;
        this.supplyDrawerArmedIndex = undefined;
        this.renderAll();
      }
      playUiSound('locked');
      return;
    }
    this.supplyDrawerFocusIndex = index;
    this.supplyDrawerInputActive = true;
    if (this.supplyDrawerArmedIndex !== index) {
      this.supplyDrawerArmedIndex = index;
      playUiSound('confirm');
      announceScreenReader(`${supply.name} selected. Confirm again to use it, or Back to keep it packed.`);
      this.renderAll();
      return;
    }
    this.supplyDrawerArmedIndex = undefined;
    this.useRouteSupply(index);
  }

  private ownedRouteMarkDefs() {
    return this.runState.routeMarks
      .map((id) => alphaRouteMarkLibrary.get(id))
      .filter((mark): mark is RuntimeRouteMark => Boolean(mark));
  }

  private ensureWaymarkReviewModule() {
    if (this.waymarkReviewModule || this.waymarkReviewLoading || this.waymarkReviewFailed) return;
    this.waymarkReviewLoading = true;
    void loadWaymarkReviewModule()
      .then((module) => {
        this.waymarkReviewModule = module;
        this.waymarkReviewLoading = false;
        if (this.sys.settings.active && this.waymarkDrawerOpen) this.renderAll();
      })
      .catch((error) => {
        this.waymarkReviewLoading = false;
        this.waymarkReviewFailed = true;
        console.warn(LAZY_LOAD_FAILED, error);
        if (this.sys.settings.active && this.waymarkDrawerOpen) this.renderAll();
      });
  }

  private selectedRouteWaymark() {
    const marks = this.ownedRouteMarkDefs();
    return marks.find((mark) => mark.id === this.routeWaymarkSelectedId) ?? marks[0];
  }

  private pinnedRouteWaymark() {
    return this.ownedRouteMarkDefs().find((mark) => mark.id === this.routeWaymarkPinnedId);
  }

  private selectRouteWaymark(id: string, announce = true) {
    if (!this.waymarkDrawerOpen || this.pauseOverlayOpen || this.settingsOverlayOpen) return;
    const marks = this.ownedRouteMarkDefs();
    const index = marks.findIndex((mark) => mark.id === id);
    if (index < 0 || this.routeWaymarkSelectedId === id) return;
    this.routeWaymarkSelectedId = id;
    const selectedRow = Math.floor(index / 3);
    if (selectedRow < this.routeWaymarkScroll) this.routeWaymarkScroll = selectedRow;
    else if (selectedRow >= this.routeWaymarkScroll + 2) this.routeWaymarkScroll = selectedRow - 1;
    if (announce) playUiSound('confirm');
    this.renderAll();
  }

  private moveRouteWaymarkSelection(delta: number) {
    if (!this.waymarkDrawerOpen || this.pauseOverlayOpen || this.settingsOverlayOpen) return;
    const marks = this.ownedRouteMarkDefs();
    if (marks.length === 0) return;
    const current = Math.max(0, marks.findIndex((mark) => mark.id === this.selectedRouteWaymark()?.id));
    const next = (current + delta % marks.length + marks.length) % marks.length;
    this.selectRouteWaymark(marks[next].id);
  }

  private toggleRouteWaymarkPin(id = this.selectedRouteWaymark()?.id) {
    if (!this.waymarkDrawerOpen || !id || this.pauseOverlayOpen || this.settingsOverlayOpen) return;
    this.routeWaymarkPinnedId = this.routeWaymarkPinnedId === id ? undefined : id;
    this.ensureWaymarkReviewModule();
    playUiSound(this.routeWaymarkPinnedId ? 'confirm' : 'close');
    this.renderAll();
  }

  private routeWaymarkReviewEntry(mark: RuntimeRouteMark): SceneWaymarkReviewEntry {
    return ownedWaymarkReviewEntry(mark);
  }

  routeWaymarkTextEntry(mark: RuntimeRouteMark) {
    return {
      id: mark.id,
      name: mark.name,
      family: routeMarkFamilyLabel(mark.family),
      rarity: mark.rarity,
      source: mark.source,
      trigger: formatWaymarkTrigger(mark.trigger, routeMarkEffects(mark)),
      description: mark.description,
      effects: routeMarkEffects(mark).map((effect, index) => ({
        order: index + 1,
        text: formatEffects([effect]),
        grammar: effect,
      })),
      tags: waymarkSynergyTags(mark),
    };
  }


  private renderRouteWaymarkDrawer() {
    const marks = this.ownedRouteMarkDefs();
    const selected = this.selectedRouteWaymark();
    const pinned = this.pinnedRouteWaymark();
    this.queueRouteWaymarkArtLoad();

    if (this.waymarkReviewModule) {
      const entries = marks.map((mark) => this.routeWaymarkReviewEntry(mark));
      this.waymarkReviewModule.renderSceneWaymarkDrawer(this, {
        entries,
        selected: entries.find((entry) => entry.id === selected?.id),
        pinned: entries.find((entry) => entry.id === pinned?.id),
        scrollRow: this.routeWaymarkScroll,
        onClose: () => this.closeWaymarkDrawer(),
        onSelect: (id) => this.selectRouteWaymark(id),
        onPin: () => this.toggleRouteWaymarkPin(),
        onScroll: (rows) => this.scrollRouteWaymarks(rows),
      });
      return;
    }

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.72)
      .setInteractive({ useHandCursor: false });
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 620, 220, 0x050a12, 0.97)
      .setStrokeStyle(1.5, this.waymarkReviewFailed ? UI_FIELD.danger : UI_FIELD.violet, 0.62)
      .setName('route-waymark-review-panel');
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, this.waymarkReviewFailed
      ? 'Waymark detail unavailable'
      : 'Opening Waymark detail?', {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: this.waymarkReviewFailed ? '#ffb09a' : UI_FIELD.warm,
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 26, this.waymarkReviewFailed
      ? 'Close and reopen the drawer to retry.'
      : 'Reading trigger and effect order.', {
      fontFamily: UI_FONT,
      fontSize: '12px',
      color: UI_SOFT,
    }).setOrigin(0.5);
    this.ensureWaymarkReviewModule();
  }


  private renderRouteSupplyDrawer() {
    this.queueRouteSupplyArtLoad();
    const capacity = runSupplyCapacity(this.runState);
    if (!this.routeSupplyDrawerModule) {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.72)
        .setInteractive({ useHandCursor: false });
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 620, 220, 0x050a12, 0.97)
        .setStrokeStyle(1.5, this.routeSupplyDrawerFailed ? UI_FIELD.danger : UI_FIELD.gold, 0.62);
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, this.routeSupplyDrawerFailed
        ? 'Supply drawer unavailable'
        : 'Opening Supply drawer...', {
        fontFamily: UI_FONT,
        fontSize: '18px',
        fontStyle: UI_BOLD,
        color: this.routeSupplyDrawerFailed ? '#ffb09a' : UI_FIELD.warm,
      }).setOrigin(0.5);
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 26, this.routeSupplyDrawerFailed
        ? 'Close and reopen the drawer to retry.'
        : 'Checking packed tools.', {
        fontFamily: UI_FONT,
        fontSize: '19px',
        color: UI_SOFT,
      }).setOrigin(0.5);
      this.ensureRouteSupplyDrawer();
      return;
    }

    this.routeSupplyDrawerModule.renderRouteSupplyDrawer(this, {
      recent: this.supplyFeedback,
      entries: Array.from({ length: capacity }, (_entry, index) => {
        const supply = alphaSupplyLibrary.get(this.runState.supplies[index] ?? '');
        if (!supply) return {};
        return {
          id: supply.id,
          glyph: this.supplyGlyph(supply),
          accent: supplyAccent(supply),
          name: supply.name,
          summary: formatEffects(supply.effects),
          timing: supply.timing,
          usable: supply.timing !== 'combat',
        };
      }),
      filled: this.runState.supplies.length,
      capacity,
      focusIndex: this.supplyDrawerFocusIndex,
      inputActive: this.supplyDrawerInputActive,
      armedIndex: this.supplyDrawerArmedIndex,
      confirmLabel: controlBindingLabel('confirm'),
      backLabel: controlBindingLabel('back'),
      onClose: () => this.cancelOrCloseRouteSupplyDrawer(),
      onActivate: (index) => this.requestRouteSupplyUse(index),
      onBrowse: (direction) => this.moveRouteSupplyFocus(direction),
    });
  }

  private scrollRouteWaymarks(deltaRows: number) {
    if (!this.waymarkDrawerOpen || this.pauseOverlayOpen || this.settingsOverlayOpen) return;
    const marks = this.ownedRouteMarkDefs();
    const maxScrollRows = Math.max(0, Math.ceil(marks.length / 3) - 2);
    const next = clamp(this.routeWaymarkScroll + deltaRows, 0, maxScrollRows);
    if (next === this.routeWaymarkScroll) return;
    this.routeWaymarkScroll = next;
    this.renderAll();
  }

  // Flock passive stats sourced from the run deck so the flock is examinable
  // between fights without duplicating run-resource readouts from the HUD.
  private renderRouteFlockOverlay() {
    if (this.flockOverlayMode === 'map' && this.mapInspectionModule) {
      this.mapInspectionModule.renderRouteMapInspection(this, currentMap(), routeNodeTypeLabel);
      return;
    }
    if (this.flockOverlayMode === 'map') {
      const message = this.mapInspectionFailed ? 'Map inspection unavailable' : 'Opening map inspection…';
      const guidance = this.mapInspectionFailed
        ? 'Close to return to your route. Reload to try again.' : 'Preparing stop details. You can close this reader at any time.';
      const root = this.add.container(0, 0).setName('flock-stats-reader').setData('summary', `${message}. ${guidance}`);
      root.add(this.add.rectangle(640, 360, 1280, 720, 0x020409, 0.94).setInteractive());
      root.add(this.add.rectangle(640, 360, 1040, 640, DECISION_UI.surface, 1).setStrokeStyle(1, DECISION_UI.border));
      root.add(quietText(this, 156, 64, 'MAP INSPECTION · READ ONLY', 780, 21, DECISION_UI.secondary));
      root.add(quietText(this, 156, 104, message, 760, 30));
      root.add(quietText(this, 156, 246, guidance, 920));
      const close = quietButton(this, { x: 1060, y: 94, width: 140, label: 'Back', name: 'map-inspection-close',
        onActivate: () => { if (!this.pauseOverlayOpen && !this.settingsOverlayOpen && !this.confirmExitOpen) this.closeFlockOverlay(); } });
      root.add([close, close.getData('labelObject')]);
      return;
    }
    const rows = buildFlockStatRows(cardsFromSave(this.runState.deck), this.runMaxHp())
      .filter((row) => row.label !== 'Cohesion');
    if (this.flockStatsOverlayModule) {
      if (this.flockOverlayMode === 'boss') {
        this.flockStatsOverlayModule.renderBossPrep({
          scene: this, prep: this.bossPrepReadiness(), page: this.bossPrepPage,
          onPage: page => { this.bossPrepPage = page; },
          onClose: () => this.closeFlockOverlay(),
          ownsInput: () => this.flockOverlayOpen && !this.pauseOverlayOpen && !this.settingsOverlayOpen && !this.confirmExitOpen,
        });
        return;
      }
      this.flockStatsOverlayModule.renderRouteFlockStats({
        scene: this,
        rows,
        renderFieldPanel,
        renderCloseControl,
        onClose: () => this.closeFlockOverlay(),
        reducedMotion: prefersReducedMotion(),
      });
      return;
    }
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.78)
      .setInteractive({ useHandCursor: false });
    const failed = this.flockStatsOverlayFailed;
    const frame = renderFieldPanel(this, () => {}, GAME_WIDTH / 2, GAME_HEIGHT / 2, 820, 540, {
      eyebrow: 'Crew Dossier',
      accent: failed ? UI_FIELD.danger : UI_FIELD.cyan,
    });
    renderCloseControl(this, () => {}, frame.right - 72, frame.top + 54, () => this.closeFlockOverlay());
    const title = this.flockOverlayMode === 'boss' ? 'Boss prep' : 'Flock Stats';
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, failed ? `${title} unavailable` : `Opening ${title}…`, {
      fontFamily: UI_FONT,
      fontSize: '24px',
      fontStyle: UI_BOLD,
      color: failed ? '#ffb09a' : UI_FIELD.warm,
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 28, failed
      ? 'Close and reopen the dossier to retry.'
      : 'Preparing the dossier.', {
      fontFamily: UI_FONT,
      fontSize: '19px',
      color: UI_SOFT,
    }).setOrigin(0.5);
  }

  private closeDeckOverlay() {
    this.cancelDeckSave();
    this.deckOverlayOpen = false;
    this.inspectedCardId = undefined;
    this.cardReviewScroll = 0;
    this.deckReviewSearchActive = false;
    this.deckReviewCompareCardId = undefined;
    this.renderAll();
  }

  private scrollDeck(delta: number) {
    const cards = this.mapDeckCards();
    this.cardReviewScroll = clamp(this.cardReviewScroll + delta, 0, Math.max(0, cards.length - ROUTE_DECK_VISIBLE_ROWS));
    this.renderAll();
  }

  private inspectDeckCard(cardId: string) {
    this.inspectedCardId = cardId;
    this.renderAll();
  }

  private toggleDeckReviewComparison(cardId = this.inspectedCardId) {
    if (!this.deckOverlayOpen || this.deckReviewSearchActive) return;
    const selected = getInspectedEntry(this.mapDeckCards(), cardId)?.card;
    if (!selected) {
      playUiSound('locked');
      return;
    }
    this.deckReviewCompareCardId = this.deckReviewCompareCardId === selected.id
      ? undefined
      : selected.id;
    if (this.deckReviewCompareCardId) {
      this.cardComparisonFailed = false;
      this.ensureCardComparisonModule();
    }
    playUiSound(this.deckReviewCompareCardId ? 'confirm' : 'close');
    this.renderAll();
  }

  private ensureCardComparisonModule() {
    if (this.cardComparisonModule || this.cardComparisonLoading || this.cardComparisonFailed) return;
    this.cardComparisonLoading = true;
    this.cardComparisonFailed = false;
    void loadCardComparisonModule()
      .then((module) => {
        this.cardComparisonModule = module;
        this.cardComparisonLoading = false;
        if (this.scene.isActive() && this.deckOverlayOpen && this.deckReviewCompareCardId) {
          this.renderAll();
        }
      })
      .catch((error) => {
        this.cardComparisonLoading = false;
        this.cardComparisonFailed = true;
        console.warn('Card comparison renderer failed to load.', error);
        if (this.scene.isActive() && this.deckOverlayOpen && this.deckReviewCompareCardId) {
          this.renderAll();
        }
      });
  }

  private deckReviewComparison(selected: Card | undefined) {
    const pinned = this.allMapDeckCards().find(({ card }) => card.id === this.deckReviewCompareCardId)?.card;
    if (!pinned || !selected) return undefined;
    const mode: 'preen' | 'cards' = pinned.id === selected.id ? 'preen' : 'cards';
    const leftCard = mode === 'preen' ? { ...selected, upgraded: false } : pinned;
    const rightCard = mode === 'preen' ? { ...selected, upgraded: true } : selected;
    const pinnedContract = activeCardContract(leftCard, false);
    const selectedContract = activeCardContract(rightCard, false);
    const cost = leftCard.cost === rightCard.cost
      ? `COST SAME ${leftCard.cost}`
      : `COST ${leftCard.cost} TO ${rightCard.cost}`;
    const role = pinnedContract.role === selectedContract.role
      ? `ROLE SAME ${pinnedContract.role.toUpperCase()}`
      : `ROLE ${pinnedContract.role.toUpperCase()} TO ${selectedContract.role.toUpperCase()}`;
    const target = pinnedContract.target === selectedContract.target
      ? `TARGET SAME ${targetLabel(pinnedContract.target).toUpperCase()}`
      : `TARGET ${targetLabel(pinnedContract.target).toUpperCase()} TO ${targetLabel(selectedContract.target).toUpperCase()}`;
    const baseStats = cardStatRows(leftCard);
    const statChange = cardStatRows(rightCard).find((row) => !baseStats.includes(row));
    const summary = mode === 'preen'
      ? [
          leftCard.text === rightCard.upgradedText ? 'PREEN KEEPS RULES' : 'PREEN CHANGES RULES',
          pinnedContract.role === selectedContract.role ? '' : role,
          pinnedContract.target === selectedContract.target ? '' : target,
          statChange ? `ADDS ${statChange.toUpperCase()}` : '',
        ].filter(Boolean).slice(0, 3).join('  /  ')
      : `${cost}  /  ${role}  /  ${target}`;
    return {
      pinned: leftCard,
      selected: rightCard,
      active: true,
      mode,
      summary,
      pinnedContract,
      selectedContract,
    };
  }

  private allMapDeckCards() {
    return cardsFromSave(this.runState.deck).map((card) => ({ card, zone: 'Flock' }));
  }

  private deckReviewFilterLabel(filter = this.deckReviewFilter) {
    if (filter === 'all') return 'ALL';
    if (filter === 'special') return 'SPECIAL';
    if (filter === 'preened') return 'PREENED';
    return filter.toUpperCase();
  }

  private deckReviewSortLabel(sort = this.deckReviewSort) {
    if (sort === 'run') return 'RUN';
    return sort.toUpperCase();
  }

  private mapDeckCards() {
    const query = this.deckReviewQuery.trim().toLocaleLowerCase();
    const cards = this.allMapDeckCards().filter(({ card }) => {
      const filterMatches = this.deckReviewFilter === 'all'
        || (this.deckReviewFilter === 'preened' && card.upgraded)
        || (this.deckReviewFilter === 'special' && !card.runtime.suit)
        || card.runtime.suit === this.deckReviewFilter;
      if (!filterMatches) return false;
      if (!query) return true;
      const contract = activeCardContract(card, false);
      return [
        displayName(card),
        card.bird,
        cardLabel(card),
        card.runtime.suit ?? '',
        contract.role,
        contract.target,
        contract.text,
        card.upgradedText,
      ].join(' ').toLocaleLowerCase().includes(query);
    });
    if (this.deckReviewSort === 'cost') {
      cards.sort((a, b) => a.card.cost - b.card.cost || displayName(a.card).localeCompare(displayName(b.card)));
    } else if (this.deckReviewSort === 'name') {
      cards.sort((a, b) => displayName(a.card).localeCompare(displayName(b.card)) || a.card.cost - b.card.cost);
    }
    return cards;
  }

  private resetDeckReviewSelection() {
    this.cardReviewScroll = 0;
    this.inspectedCardId = this.mapDeckCards()[0]?.card.id;
  }

  private cycleDeckReviewFilter(delta: -1 | 1) {
    if (!this.deckOverlayOpen || this.deckReviewSearchActive) return;
    const current = Math.max(0, DECK_REVIEW_FILTERS.indexOf(this.deckReviewFilter));
    this.deckReviewFilter = DECK_REVIEW_FILTERS[(current + delta + DECK_REVIEW_FILTERS.length) % DECK_REVIEW_FILTERS.length];
    this.resetDeckReviewSelection();
    playUiSound('confirm');
    this.renderAll();
  }

  private cycleDeckReviewSort(delta: -1 | 1) {
    if (!this.deckOverlayOpen || this.deckReviewSearchActive) return;
    const current = Math.max(0, DECK_REVIEW_SORTS.indexOf(this.deckReviewSort));
    this.deckReviewSort = DECK_REVIEW_SORTS[(current + delta + DECK_REVIEW_SORTS.length) % DECK_REVIEW_SORTS.length];
    this.resetDeckReviewSelection();
    playUiSound('confirm');
    this.renderAll();
  }

  private moveDeckReviewSelection(delta: -1 | 1) {
    if (!this.deckOverlayOpen || this.deckReviewSearchActive || controlPanelOwnsInput(this)) return;
    const cards = this.mapDeckCards();
    if (!cards.length) return;
    const selected = getInspectedEntry(cards, this.inspectedCardId);
    const current = Math.max(0, cards.findIndex(({ card }) => card.id === selected?.card.id));
    const next = (current + delta + cards.length) % cards.length;
    this.inspectedCardId = cards[next].card.id;
    if (next < this.cardReviewScroll) this.cardReviewScroll = next;
    else if (next >= this.cardReviewScroll + ROUTE_DECK_VISIBLE_ROWS) {
      this.cardReviewScroll = next - ROUTE_DECK_VISIBLE_ROWS + 1;
    }
    playUiSound('confirm');
    this.renderAll();
  }

  private setDeckReviewSearchActive(active: boolean) {
    if (!this.deckOverlayOpen || this.deckReviewSearchActive === active) return;
    this.deckReviewSearchActive = active;
    playUiSound(active ? 'confirm' : 'close');
    this.renderAll();
  }

  private setDeckReviewQuery(query: string) {
    const next = query.slice(0, 24);
    if (next === this.deckReviewQuery) return;
    this.deckReviewQuery = next;
    this.resetDeckReviewSelection();
    this.renderAll();
  }

  private handleDeckReviewSearchKey(event: KeyboardEvent) {
    if (!this.deckOverlayOpen || this.settingsOverlayOpen || this.pauseOverlayOpen) return;
    const taggedEvent = event as KeyboardEvent & { __birdSquadDeckSearchHandled?: boolean };
    if (taggedEvent.__birdSquadDeckSearchHandled) return;
    if (!this.deckReviewSearchActive) {
      if ((event.code === 'PageUp' || event.code === 'PageDown') && !controlActionForCode(event.code)) {
        taggedEvent.__birdSquadDeckSearchHandled = true;
        event.preventDefault?.();
        this.cardComparisonModule?.changeComparisonPage(this, event.code === 'PageUp' ? -1 : 1);
        this.cardHoverDetailModule?.changeSceneCardDetailPage(this, event.code === 'PageUp' ? -1 : 1);
        return;
      }
      if ((event.key.toLocaleLowerCase() === 'c' || event.code === 'KeyC') && !controlActionForCode(event.code)) {
        taggedEvent.__birdSquadDeckSearchHandled = true;
        event.preventDefault?.();
        this.toggleDeckReviewComparison();
        return;
      }
      if ((event.key === '/' || event.code === 'Slash') && !controlActionForCode(event.code)) {
        taggedEvent.__birdSquadDeckSearchHandled = true;
        event.preventDefault?.();
        this.setDeckReviewSearchActive(true);
      }
      return;
    }
    if (event.key === 'Backspace') {
      taggedEvent.__birdSquadDeckSearchHandled = true;
      event.preventDefault?.();
      this.setDeckReviewQuery(this.deckReviewQuery.slice(0, -1));
      return;
    }
    if (event.key === 'Enter' || event.key === 'Escape') return;
    if (event.key.length !== 1 || !/^[a-z0-9 '\-]$/i.test(event.key)) return;
    taggedEvent.__birdSquadDeckSearchHandled = true;
    event.preventDefault?.();
    this.setDeckReviewQuery(`${this.deckReviewQuery}${event.key}`);
  }

  private renderMapDeckOverlay() {
    const cards = this.mapDeckCards();
    const totalCards = this.allMapDeckCards().length;
    const selectedEntry = getInspectedEntry(cards, this.inspectedCardId);
    this.cardReviewScroll = clamp(this.cardReviewScroll, 0, Math.max(0, cards.length - ROUTE_DECK_VISIBLE_ROWS));

    if (!this.routeDeckBrowserModule) {
      this.renderRouteModuleStatus('Deck Review', 'Indexing the flock deck.',
        this.routeDeckBrowserFailed, 'deck-review-module', () => this.closeDeckOverlay());
      this.ensureRouteDeckBrowser();
      return;
    }

    this.routeDeckBrowserModule.renderRouteDeckBrowser(this, {
      cards: cards.map(({ card, zone }) => ({
        id: card.id,
        name: displayName(card),
        cost: card.cost,
        label: cardLabel(card),
        zone,
        upgraded: Boolean(card.upgraded),
        selected: selectedEntry?.card.id === card.id,
        pinned: this.deckReviewCompareCardId === card.id,
      })),
      totalCards,
      currentHp: this.runState.currentHp,
      maxHp: this.runMaxHp(),
      scroll: this.cardReviewScroll,
      filterLabel: this.deckReviewFilterLabel(),
      sortLabel: this.deckReviewSortLabel(),
      query: this.deckReviewQuery,
      searchActive: this.deckReviewSearchActive,
      savedDecks: this.savedDeckRecordState(),
      onClose: () => this.closeDeckOverlay(),
      onCycleFilter: () => this.cycleDeckReviewFilter(1),
      onCycleSort: () => this.cycleDeckReviewSort(1),
      onToggleSearch: () => this.setDeckReviewSearchActive(!this.deckReviewSearchActive),
      onInspect: (id) => this.inspectDeckCard(id),
      onCompare: (id) => this.toggleDeckReviewComparison(id),
      onScroll: (delta) => this.scrollDeck(delta),
      onSaveDeck: () => this.saveCurrentDeckToFolio(),
    });

    const comparison = this.deckReviewComparison(selectedEntry?.card);
    if (comparison) this.renderRouteCardComparison(comparison);
    else if (selectedEntry) this.renderRouteCardDetailPanel(selectedEntry.card, selectedEntry.zone);
  }

  private routeCardComparisonView(card: Card, zone: string) {
    const contract = activeCardContract(card, false);
    return {
      portraitAsset: cardArtAssets[card.id],
      name: displayName(card),
      bird: card.bird,
      label: cardLabel(card),
      zone,
      cost: card.cost,
      accent: card.upgraded ? 0x24d0d6 : card.type === 'major' ? 0xd8a840 : 0x7ab8d6,
      artKey: loadedCardArtKey(this, card),
      snagBorderKey: isSnagCard(card) ? snagCardBorderAsset.key : undefined,
      target: targetLabel(contract.target),
      role: contract.role,
      currentText: contract.text,
      alternateText: contract.usesMolt ? displayText(card) : card.upgraded ? 'Already preened.' : card.upgradedText,
      moltText: card.runtime.moltEffects?.length ? activeCardContract(card, true).text : undefined,
      usesMolt: contract.usesMolt,
      stats: cardStatRows(card),
    };
  }

  private routeCardPreenComparisonView(card: Card, upgraded: boolean) {
    const previewCard = { ...card, upgraded };
    const view = this.routeCardComparisonView(previewCard, upgraded ? 'Preened Form' : 'Base Form');
    const moltContract = activeCardContract(previewCard, true);
    const hasMolt = previewCard.runtime.moltEffects?.length;
    return {
      ...view,
      currentLabel: upgraded ? 'PREENED RULES' : 'BASE RULES',
      alternateLabel: upgraded ? 'PREENED MOLT' : 'BASE MOLT',
      alternateText: hasMolt ? moltContract.text : 'No Molt ability.',
      moltText: undefined,
      usesMolt: Boolean(hasMolt),
      stats: cardStatTotalRows(previewCard),
    };
  }

  private renderRouteCardComparison(comparison: {
    pinned: Card;
    selected: Card;
    summary: string;
    mode: 'cards' | 'preen';
  }) {
    this.ensureCardComparisonModule();
    if (!this.cardComparisonModule) {
      this.add.rectangle(826, 389, 620, 450, 0x070b12, 0.99);
      this.add.text(826, 389, this.cardComparisonFailed
        ? 'COMPARISON UNAVAILABLE / UNPIN AND REPIN TO RETRY'
        : 'OPENING COMPARISON…', {
        fontFamily: UI_FONT,
        fontSize: '18px',
        fontStyle: UI_BOLD,
        color: this.cardComparisonFailed ? '#ffc78f' : '#dffbff',
        align: 'center',
        fixedWidth: 420,
        wordWrap: { width: 420 },
        backgroundColor: '#07151f',
        padding: { x: 8, y: 6 },
      }).setOrigin(0.5).setName('deck-review-comparison-loading');
      return;
    }
    this.cardComparisonModule.renderSceneCardComparison(this, {
      pinned: comparison.mode === 'preen'
        ? this.routeCardPreenComparisonView(comparison.pinned, false)
        : this.routeCardComparisonView(comparison.pinned, 'Pinned'),
      selected: comparison.mode === 'preen'
        ? this.routeCardPreenComparisonView(comparison.selected, true)
        : this.routeCardComparisonView(comparison.selected, 'Selected'),
      summary: comparison.summary,
      title: comparison.mode === 'preen' ? 'PREEN COMPARISON' : 'CARD COMPARISON',
      leftHeading: comparison.mode === 'preen' ? 'BASE' : 'PINNED',
      rightHeading: comparison.mode === 'preen' ? 'PREENED' : 'SELECTED',
      dossierFrameKey: uiIconAssets['card-hover-dossier-frame'].key,
      detailFrameKey: uiIconAssets['deck-review-detail-frame'].key,
      costBadgeKey: uiIconAssets['deck-review-cost-badge'].key,
    });
  }

  private renderRouteCardDetailPanel(card: Card, zone: string) {
    this.cardHoverDetailModule?.renderSceneCardDetail(this, {
      ...this.routeCardComparisonView(card, zone),
      moltText: card.runtime.moltEffects?.length ? activeCardContract(card, true).text : undefined,
      upgradedMoltText: !card.upgraded && card.runtime.moltEffects?.length ? activeCardContract({ ...card, upgraded: true }, true).text : undefined,
    });
  }

  private updateTextState() {
    window.advanceTime = (ms: number) => advanceGameTime(this.game, ms);
    if (!this.routeDebugStateModule) {
      window.render_game_to_text = () => JSON.stringify({
        mode: 'routeSelection',
        scene: 'RouteScene',
        routeTextStateLoading: true,
      });
      return;
    }
    this.routeDebugStateModule.updateRouteDebugState(this, {
      activeMapIndex, advanceGameTime, alphaSupplyLibrary, animationPacingState, audioToggleWaveBurstState, birdAudio,
      cardStatRows, cardStatTotalRows, colorCueState, combatPacingState, controlBindingLabel,
      compactEffectGrammar, controlsTextState, countTextureInGameObjects, currentFlashEffectsState, currentMap,
      currentScreenShakeState, displayName, firstFlightGuideState, firstFlightGuideStep,
      getInspectedEntry, graphicsQualityState, inspectedCardPayload, motionState, runDistrictOrdinal,
      runMapIndices, runSupplyCapacity, screenReaderState, settingsFocusState, textPacingState,
      uiIconAssets, visualContrastState, collectionGoalSummary,
    });
  }

  private runMaxHp() {
    return BASE_COHESION + (aggregateFlockStats(cardsFromSave(this.runState.deck)).cohesion ?? 0);
  }


  private bossPrepReadiness() {
    const bossNode = currentMap().nodes.find((node) => node.id === currentMap().bossNodeId);
    const encounter = bossNode ? alphaEncounterLibrary.get(bossNode.payloadId) : undefined;
    const profile = alphaMapProfileLibrary.get(currentMap().id);
    const boss = bossNode
      ? getEncounterEnemiesByPayload(bossNode.payloadId).find((enemy) => enemy.type === 'boss')
      : undefined;
    const phaseOpener = boss?.moves.find((move) => move.id === boss.phaseTwoMoveIds?.[0]);
    const cards = cardsFromSave(this.runState.deck);
    const count = (predicate: (card: Card) => boolean) => cards.filter(predicate).length;
    const rate = (n: number): 'low' | 'steady' | 'strong' => (n <= 1 ? 'low' : n <= 3 ? 'steady' : 'strong');
    const hasTag = (card: Card, tag: string) => card.runtime.tags.includes(tag);
    const readiness = {
      cover: rate(count((card) => hasTag(card, 'cover'))),
      damage: rate(count((card) => card.role === 'attack' || hasTag(card, 'attack'))),
      recovery: rate(count((card) => hasTag(card, 'heal') || hasTag(card, 'regen'))),
      moltSafety: rate(count((card) => card.type === 'molt' || hasTag(card, 'molt') || hasTag(card, 'openSky'))),
      supplies: this.runState.supplies.length
    };
    const needs = [
      readiness.cover === 'low' ? 'Cover' : '',
      readiness.damage === 'low' ? 'Damage' : '',
      readiness.recovery === 'low' ? 'Recovery' : '',
      readiness.moltSafety === 'low' ? 'Molt' : '',
      readiness.supplies <= 0 ? 'Supply' : ''
    ].filter(Boolean);
    const nodePrepTags = (node: RouteNode) => {
      switch (node.type) {
        case 'basin': return ['Recovery', 'Molt', 'Supply'];
        case 'nest': return ['Cover', 'Molt'];
        case 'market': return ['Supply', 'Cover', 'Damage'];
        case 'cache': return ['Supply', 'Damage'];
        case 'rival': return ['Damage', 'Cover'];
        case 'signal': return ['Molt', 'Damage'];
        default: return [];
      }
    };
    // Recommend only stops still reachable from the current route. Unchosen
    // branches behind the Flock must not appear as preparation opportunities.
    const reachable = new Set<string>();
    const pending = this.getSelectableNodes().map(node => node.id);
    while (pending.length) {
      const id = pending.shift()!;
      if (reachable.has(id) || this.runState.completedRouteNodeIds.includes(id)) continue;
      reachable.add(id);
      for (const edge of currentMap().edges) if (edge.from === id && !edge.locked) pending.push(edge.to);
    }
    const usefulNodes = [...new Set(currentMap().nodes
      .filter(node => reachable.has(node.id))
      .filter((node) => !this.runState.completedRouteNodeIds.includes(node.id))
      .filter((node) => {
        if (!['basin', 'nest', 'market', 'rival', 'cache', 'signal'].includes(node.type)) return false;
        return needs.length === 0 || nodePrepTags(node).some((tag) => needs.includes(tag));
      })
      .map((node) => routeNodeTypeLabel(node.type).replace(' Workshop', '')))]
      .slice(0, 4);
    return {
      bossName: encounter?.name ?? bossNode?.label ?? 'Boss',
      pressure: encounter?.tags.filter((tag) => ['cover', 'heavy', 'snag', 'openSky', 'multi', 'tempo', 'winded'].includes(tag)).join(', ') || 'unknown',
      readiness,
      needs,
      usefulNodes,
      thesis: profile?.thesis,
      primaryTests: profile ? [...profile.primaryTests] : [],
      testLabels: compactBossTests(profile?.primaryTests ?? []),
      strategyHints: profile ? [...profile.bossPrepHints] : [],
      phaseHint: boss?.phaseTwoName
        ? `Phase II at 50%: ${boss.phaseTwoName}${phaseOpener ? ` opens with ${phaseOpener.label}` : ''}`
        : undefined,
      flourishLoaded: this.textures.exists(uiIconAssets['boss-prep-dossier-flourish'].key)
    };
  }

}
