import { setTextureFilter } from '../game/texture-filter';
import { type CardContribution, type ContributionKey, recordContribution, totalContributions } from '../game/card-contributions';
import Phaser from 'phaser';
import { loadFlyway } from '../game/flyway-loader';
import { persistFlywayEnding } from '../game/flyway-storage';
import { newFlywayState, newFlightCombat, normalizeFlyway, flywayCoverGain, rivalChapter, playCombination, bossDisruption, rooftopPlanMatch, takeCall, resolvedLeaderCall, chargeCall, type PreenBranch, branchUpgrade, journal, conditions, restoreDistrict, finishStory } from '../game/flyway-rules';
import { consumeSaveRecoveryGamepad, showSaveRecovery } from '../game/save-recovery-dialog';
import { type RewardCheckpoint, cloneRewardCheckpoint } from '../game/reward-checkpoint';
import { observeChoiceInput, bindChoiceHint } from '../game/choice-input-hints';
import { practiceHudOffset, practiceStartingDeck, beginPracticeSession } from '../game/practice-session';
import { capstoneMarks } from '../game/signature-capstones';
import { signatureVictory } from '../game/signature-fights';
import { orderTeachingHand } from '../game/guided-opening';
import { combatRandom, type TurnCheckpoint, restoreTurn, captureTurn, finishPracticeTurn } from '../game/turn-practice';
import { decisionBrief } from '../game/decision-brief';
import type { FlockStatKey } from '../game/types';
import { memoryStorageSessionActive } from '../game/safe-storage';
import { alphaRouteMarkLibrary, alphaSupplyLibrary, alphaEncounterLibrary, alphaMapProfileLibrary, alphaEnemyLibrary, alphaCardSet, alphaMaps } from '../game/runtime-data';
import { hashSeed } from '../game/route-gen';
import { flockHandTarget } from '../game/hand-size';
import { type OpeningDrawState, prepareOpeningDraw, deterministicChance, deterministicRankedIds } from '../game/deterministic-draw';
import type { RuntimeRouteMark, RuntimeSupply, EnemyMove, RouteNode } from '../game/types';
import { floatingText, setFeedbackTextHoldScale, shakeCamera, banner, burst, strike, fadeRect } from '../game/fx';
import { getLeader, defaultLeaderId } from '../game/leaders';
import { difficultyMods, applyAscensionOpeningIntents, advanceAscensionEnemyIntent, enemyHpMultFor } from '../game/difficulty';
import { type recordRun, type CardCollectionRecord, loadAccount, leaderUnlockHints, achievements, discoverCards } from '../game/meta';
import { UI_FONT, UI_FIELD, UI_DISPLAY_FONT as TOKEN_DISPLAY_FONT, UI_BOLD, UI_GOLD, UI_CYAN, UI_SOFT, UI_BODY, UI_TYPE, DECISION_UI } from '../game/theme';
import { quietButton } from '../game/quiet-ui';
import { pendingOverlay } from '../game/pending-overlay';
import { type RuntimeImageLoadResult, uniqueImageAssets, type RuntimeImageAsset, queuePreloadImageAssets, queueRuntimeImageAssets, RUNTIME_IMAGE_LOAD_TIMEOUT_MS } from '../game/runtime-images';
import { advanceGameTime, killTweensForTree } from '../game/scene-runtime';
import { firstFlightGuideStep, markFirstMoltGuideSeen, markFirstFlightGuideSeen, firstMoltGuideState, recordFirstFlightGuideEvent, completeFirstMoltGuide, firstFlightGuideState } from '../game/first-flight-guide';
import { controlPanelRegistryKey, controlCaptureRegistryKey, controlPanelOwnsInput, bindControlActions, controlActionForCode, controlBindingLabel } from '../game/input-bindings';
import { graphicsQualityState, prefersLeanEffects, setGraphicsQualityPreference } from '../game/graphics-quality';
import { setVisualContrastPreference, setColorCuePreference, setScreenShakePreference, setFlashEffectsPreference, colorCueState } from '../game/visual-accessibility';
import { announceScreenReader, setScreenReaderPreference } from '../game/screen-reader-accessibility';
import { rewardBuildObservations, districtCardRewardLeans, districtRewardObservations, getMapBalanceProfile, draftStructuredRewardChoices, districtRewardAffinity, distinctMeaningfulUpgradeCards, REWARD_RARITY_WEIGHTS } from '../game/balance';
import { enemyInitials, enemyStatus } from '../game/enemy-display';
import type { ActiveTermIntroduction } from '../game/term-introductions';
import { lazyModule } from '../game/lazy-module';

// New-term callouts are optional teaching: fetched beside combat, never blocking it.
const loadTermCalloutModule = lazyModule(() => import('../game/battle/term-callout'));
import { parseEffect, parseEffectValue } from '../game/effects/effect-parser';
import { cleanseFlockDebuffs, projectEnemyPhase, incomingHit } from '../game/enemy-damage';
import { fitTextExcerpt } from '../game/text-excerpt';
import { enemyIntentLabel } from '../game/enemy-intent';
import { type CardEffectResolutionState as EffectResolutionState, createCardEffectResolutionState, type CardEffectContext, resolveCardEffect as resolveCardEffectRule } from '../game/effects/card-effect-runner';
import { roostRetainTriggerMatches, retainPriorityItems, retainedInOriginalOrder, retainInputHint } from '../game/effects/retain';
import { spendMoltPower } from '../game/molt-power';
import type { BattleFxPresentationHost, BattleFxAnimationOptions, BattleFxMoteOptions } from '../game/battle/fx-presenter';
import type { ActiveCardContract, BattleSceneData, BossDossierModule, Card, CardRewardEvent, CombatInputChoiceKind, CombatResultSummary, EncounterObjective, EncounterObjectiveProgress, EndTurnOptions, Enemy, EnemyMotionCue, EnemyMoveDamageSummary, EnemyTurnBeat, EnemyTurnProgress, Flock, FlockState, GameMode, InspectOverlay, NextCombatMods, PlayCardOptions, RenderPayload, RetainSource, RouteDecisionEvent, RunMode, RunState, RunSummary, SignalChoiceEvent, StartPlayerTurnOptions, SupplyFeedback, TextureVisibleBounds, WaymarkFeedback } from '../game/shared/runtime-types';
import { isRunOutcome, LAZY_LOAD_FAILED, PLAYTEST_MODE } from '../game/shared/session-config';
import { cardCoverOutcome, cardDamageOutcome, flockStateOf, intentCoverValue, moveDealsDamage } from '../game/combat-rules';
import { ALL_ROUTE_MARK_IDS, BASE_COHESION, BASE_MOLT_POWER, BASE_RESONANCE_CAP, BASE_SUPPLY_SLOTS, CARD_REVIEW_ROW_H, CARD_REVIEW_VISIBLE_ROWS, DEFAULT_REWARD_SKIP_SCRAP, DISTRICT_CONTRACT_DEFINITIONS, districtContractProgressValue, type DistrictContractState, HIGH_TIER_ROUTE_MARK_IDS, KEYSTONE_AT, MARKET_ROUTE_MARK_IDS, NESTS_COVER_CARRY_CAP, nextRunMapIndex, OVEREXTENSION_CARD_THRESHOLD, POST_COMBAT_RECOVERY, runDistrictOrdinal, WAYMARK_ACTIVE_CAP, WAYMARK_REWARD_CHOICE_COUNT } from '../game/shared/gameplay-constants';
import { animationPacePreference, combatPacePreference, currentScreenShakeState, prefersReducedMotion, setAnimationPacePreference, setCombatPacePreference, setMotionPreference, setTextPacePreference, syncSceneAnimationPace, textPaceScale, textPacingState } from '../game/shared/preferences';
import { SceneAssetReadinessTracker } from '../game/shared/scene-asset-readiness';
import { CARD_H, CARD_W, COMBAT_REDUCED_MOTION_MIN_DELAY_MS, COMBAT_REDUCED_MOTION_TIMING_SCALE, COMBAT_SNAPPY_MIN_DELAY_MS, COMBAT_SNAPPY_TIMING_SCALE, COMBAT_STANDARD_REPEAT_TIMING_SCALE, ENEMY_ATTACK_RECOVER_MS, ENEMY_ATTACK_WINDUP_MS, ENEMY_HP_BAR, ENEMY_TURN_PREAMBLE_MS, FLOCK_ART_X, FLOCK_ART_Y, FLOCK_FX_X, FLOCK_FX_Y, FLOCK_HP_BAR, FLOW_HUD_PIP_GAP, FLOW_HUD_PIP_OFFSET, FLOW_HUD_X_OFFSET, FLOW_HUD_Y_OFFSET, GAME_HEIGHT, GAME_WIDTH, HAND_Y, HUD_MENU_PANEL, PLAYER_ATTACK_RESOLVE_DELAY_MS, PLAYER_CARD_FEEDBACK_SETTLE_MS, PLAYER_CARD_RESOLVE_DELAY_MS, PLAYER_TURN_HANDOFF_DELAY_MS } from '../game/shared/layout-constants';
import { COMBAT_ACTION_TRAIL_TEXTURE, COMBAT_ATMOSPHERE_TEXTURE, COMBAT_CARD_BACK_TEXTURE, COMBAT_CAST_FOCUS_BURST_TEXTURE, COMBAT_ENCOUNTER_INTRO_TEXTURE, COMBAT_ENEMY_RECOVERY_AFTERGLOW_TEXTURE, COMBAT_ENEMY_WINDUP_PLAQUE_TEXTURE, COMBAT_FX_PARTICLE_TEXTURE, COMBAT_FX_TEXTURE, COMBAT_TARGET_LOCK_PULSE_TEXTURE, COMBAT_TARGET_RETICLE_TEXTURE, COMBAT_WINGBEAT_SPEND_TEXTURE, SUIT_FX_ANIM } from '../game/shared/fx-textures';
import { type BattleBackdropRendererModule, type BattleDebugStateModule, type BattleForegroundRendererModule, type BattleFxPresenterModule, type BattleHandCardView, type BattleHandRendererModule, type BattleHudRendererModule, type BattleInspectCardView, type BattleInspectMode, type BattleInspectRendererModule, type BattleRewardRendererModule, type CombatDiscardChoice, type CombatFxAssetsModule, type CombatPreviewModule, type CombatReturnChoice, type DiscardChoiceModule, type FlockStatsOverlayModule, type InterruptibleDecision, loadBattleBackdropRendererModule, loadBattleDebugStateModule, loadBattleForegroundRendererModule, loadBattleFxPresenterModule, loadBattleHandRendererModule, loadBattleHudRendererModule, loadBattleInspectRendererModule, loadBattleRewardRendererModule, loadBossDossierModule, loadCombatFxAssetsModule, loadCombatPreviewModule, loadDiscardChoiceModule, loadFlockStatsOverlayModule, loadReturnChoiceModule, loadRouteSupplyDrawerModule, loadWaymarkReviewModule, openProfileScene, ownedWaymarkReviewEntry, type ReturnChoiceModule, type RouteSupplyDrawerModule, type WaymarkReviewModule } from '../game/shared/lazy-modules';
import { battleCoreUiIconIds, battleDrawerUiIconIds, battleEssentialUiIconIds, battleInspectUiIconIds, battleRewardUiIconIds, battleSystemUiIconIds, enemyArtAssets, flockLeaderArtAssets, scrapArtAsset, snagCardBorderAsset, supplyCompactArtAssets, uiIconAssets, type UiIconId, waymarkCompactArtAssets } from '../art-assets';
import { addUiIconImage, failedModuleLoadResult, queueRequiredUiIconAssets, queueUiIconAssets, runtimeImageLoadSnapshot, RuntimeLoadTimeoutError, withRuntimeLoadTimeout } from '../game/shared/asset-loading';
import { roleIconForCard, statIconForKey, targetIconForTarget, zoneIconForLabel } from '../game/shared/ui-iconography';
import { activeMapIndex, activeSeed, arcanaRewardPool, buildOutcomeFlightDetailsFor, cardLibrary, currentBattlefieldAsset, currentCombatNodes, currentMap, practiceEncounterId, recordCardAcquisitions, recordRunCardAcquisitions, runSupplyCapacity, setActiveMapIndex, setActiveRouteRhythm, setActiveSeed, setPracticeEncounterId } from '../game/shared/run-session';
import { birdAudio } from '../game/shared/bird-audio-director';
import { createEncounterEnemiesForRouteNode, createFlock, selectedCombatRouteNode } from '../game/shared/encounter-setup';
import { cardsFromSave, clearActiveRun, cloneCard, cloneRunState, completedRunId, createInitialRunState, loadRunHistory, persistActiveRun, persistFinishedRun, saveCards, shuffle } from '../game/shared/run-state';
import { activeCardContract, cardCompactArtAsset, cardLabel, compactCardArtKey, displayName, displayText, fallbackCardColorCue, isSnagCard, loadedCardArtKey, renderSnagCardBorder } from '../game/shared/card-presentation';
import { bossGoonViewAt, enemyViewAt, suitAccentColor, suitFxMeta } from '../game/shared/combat-status';
import { activateRenderedAudioToggleControl, addWaymarkWithCapacity, clamp, flowHudPresentation, hideKwTooltip, playUiSound, renderAudioToggleControl, renderCloseControl, renderFieldPanel, renderPauseMenuOverlay, renderPauseToggleControl, renderRichText, renderSettingsMenuOverlay, renderUnifiedRunHud, zoneRank } from '../game/shared/ui-helpers';
import { compactCardEffectSummary, compactHandCardSummary, compactSentenceText, formatEffects } from '../game/shared/effect-text';
import { aggregateFlockStats, buildFlockStatRows, cardStatEntries, cardStatRows, flockStatLabel, targetLabel } from '../game/shared/card-stats';
import { combatScrapReward, rewardProfileForRouteNode, routeMarkAccent, routeMarkEffects, routeMarkEffectText, routeMarkFamilyLabel, supplyAccent, waymarkGlyph, waymarkSynergyTags } from '../game/shared/route-text';
import { currentMove, type EnemyMoveContext, evaluateEnemyCondition, setEnemyMoveContext } from '../game/shared/enemy-moves';

export class BattleScene extends Phaser.Scene {
  private resolvingCard?: Card;
  flyway = newFlywayState();
  flightCombat = newFlightCombat();
  flywayMapIndex = 0;
  private flock!: Flock;
  private enemies: Enemy[] = [];
  private drawPile: Card[] = [];
  private combatRandom!: ReturnType<typeof combatRandom>;
  private turnCheckpoint?: TurnCheckpoint;
  private practiceTurn = false;
  private openingDraw!: OpeningDrawState;
  private discardPile: Card[] = [];
  private clearedPile: Card[] = [];
  private hand: Card[] = [];
  private selectedInstanceId: string | undefined;
  private discardChoice: CombatDiscardChoice | undefined;
  private returnChoice: CombatReturnChoice | undefined;
  private selectedEnemyId = 'roof-rat';
  private energy = 3;
  private nextTurnEnergyBonus = 0;
  private nextTurnDrawBonus = 0;
  private pendingNestCoverBonus = 0;
  private pendingRetainHand = 0;
  private roostRetainPool: Card[] = [];
  private roostRetainPriorityInstanceId?: string;
  private pendingSupplyRepeats = 0;
  private spark = 0;
  private turn = 1;
  private encounter = 1;
  private maxEncounters = 2;
  private currentRouteIndex = 0;
  private completedRouteNodeIds: string[] = [];
  private scrap = 0;
  private runScrapEarned = 0;
  private runScrapSpent = 0;
  private runStartedAtMs = 0;
  private runSeenEnemyMoves = new Set<string>();
  private runDistrictContracts: DistrictContractState[] = [];
  private routeMarks: string[] = [];
  private runSupplies: string[] = [];
  private runSupplyCapacity = BASE_SUPPLY_SLOTS;
  private runLeaderId?: string;
  private runDifficulty = 0;
  private runMode: RunMode = 'full';
  private lastRunRewards?: ReturnType<typeof recordRun>;
  private outcomeSaved = true;
  private flywayArchiveSaved = true;
  private runSignalChoices: SignalChoiceEvent[] = [];
  private runRewardEvents: CardRewardEvent[] = [];
  private runRouteDecisions: RouteDecisionEvent[] = [];
  private rewardDecisionStartedAtMs = 0;
  private combatStartedAtMs = 0;
  private runSuppliesUsed: string[] = [];
  private runCombatResults: CombatResultSummary[] = [];
  private killedByMove: string | undefined;
  private freePreenNextDistrict = 0;
  private mode: GameMode = 'battle';
  private combatEconomyAwarded = false;
  private combatScrapAwarded = 0;
  private combatRouteMarkAwarded?: RuntimeRouteMark;
  private combatRouteMarkResolved = false;
  private waymarkChoices: RuntimeRouteMark[] = [];
  private waymarkRewardBuildObservations: Record<string, string[]> = {};
  private rewardChoices: Card[] = [];
  private upgradeChoices: Card[] = [];
  private rewardInspectionCardId: string | undefined;
  private rewardSkipArmed = false;
  private rewardChoiceArmedId: string | undefined;
  private rewardArtFailedKeys = new Set<string>();
  private rewardArtRequestedKeys = new Set<string>();
  private log: string[] = [];
  private combatHistory: string[] = [];
  private waymarkFeedback: WaymarkFeedback[] = [];
  private supplyFeedback: SupplyFeedback[] = [];
  private backdropLayer!: Phaser.GameObjects.Container;
  private backdropRenderKey = '';
  private handLayer!: Phaser.GameObjects.Container;
  private handRenderKey = '';
  private handPage = 0;
  private root!: Phaser.GameObjects.Container;
  // Persistent FX layer: renderAll() only clears `root`, so transient juice
  // (floating numbers, bursts) spawned here survives the synchronous redraw.
  private fxLayer!: Phaser.GameObjects.Container;
  private inspectOverlay: InspectOverlay | undefined;
  private inspectedCardId: string | undefined;
  private pauseOverlayOpen = false;
  private pauseSaveFailed = false;
  private settingsOverlayOpen = false;
  private systemOverlayLayer?: Phaser.GameObjects.Container;
  private systemOverlayRefreshQueued = false;
  private waymarkDrawerOpen = false;
  private waymarkReviewModule?: WaymarkReviewModule;
  private waymarkReviewLoading = false;
  private waymarkReviewFailed = false;
  private supplyDrawerOpen = false;
  private supplyDrawerFocusIndex = 0;
  private supplyDrawerArmedIndex: number | undefined;
  private supplyDrawerInputActive = false;
  private waymarkDrawerScroll = 0;
  private cardReviewScroll = 0;
  private optionalArtRequested = false;
  private rewardChoiceGlowBurstBursts = 0;
  private controllerChoiceIndex = 0;
  private battleInputActive = false;
  private playedCardIdsThisCombat = new Set<string>();
  private playedSuitsThisTurn = new Set<string>();
  // Per-combat tracking for the battle-stats readout (reset each combat in init).
  private cardContributions: CardContribution[] = [];
  private cardContributionStart?: CardContribution;
  private statDealt = 0;
  private statTaken = 0;
  private statBlocked = 0;
  private statCardsPlayed = 0;
  private statDefeated = 0;
  private statOverextensions = 0;
  private statLowCardTurns = 0;
  private statNoOverextensionTurns = 0;
  private statTurnEnds = 0;
  private statCardsHeldAtRoost = 0;
  private statUnspentWingbeatAtRoost = 0;
  private statMaxCardsPlayedTurn = 0;
  private statWaymarksAtStart = 0;
  private statSurgesTriggered = 0;
  private statInvalidActions = 0;
  private statCancelledActions = 0;
  private statDamageTakenByMove = new Map<string, EnemyMoveDamageSummary>();
  private encounterObjective?: EncounterObjective;
  private encounterObjectiveFeedbackStatus?: 'active' | 'complete' | 'failed';
  private encounterObjectiveFeedbackBursts = 0;
  private enemyDefeatedTurns = new Map<string, number>();
  private zeroCostThisTurn = 0;
  private roostCards = 0;
  private roostFree = 0;
  private roostHeld = 0;
  // Waymark per-combat latches: which once-per-combat marks have
  // fired, whether the first Open Sky increase has been softened, and the
  // per-turn card count that drives onNthCardThisTurn marks.
  private markFiredThisCombat = new Set<string>();
  private markFiredThisTurn = new Set<string>();
  private markFirstOpenSkyConsumed = false;
  private cardsPlayedThisTurn = 0;
  private activeTermIntroduction?: ActiveTermIntroduction;
  private termCalloutModule?: typeof import('../game/battle/term-callout');
  // Last-rendered formation state, so transitions fire a one-shot banner/FX.
  private lastFlockState: FlockState = 'holding';
  // Floating large-card preview shown while hovering a hand card.
  private cardPreview?: Phaser.GameObjects.Container;
  private combatCardDetail?: Phaser.GameObjects.Container;
  private selectionOutcomePreview?: Phaser.GameObjects.Container;
  private handCardRects = new Map<string, Phaser.GameObjects.Rectangle>();
  private handCardArtLayers = new Map<string, Phaser.GameObjects.Container>();
  private handCardFrames = new Map<string, Phaser.GameObjects.Image>();
  private handCardSelectionPulses = new Map<string, Phaser.GameObjects.Image>();
  private handCardFlowIndicators = new Map<string, {
    container: Phaser.GameObjects.Container;
    background: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
  }>();
  // Quills keystone: the first attack each turn hits harder (consumed on use).
  private firstAttackThisTurn = true;
  // Retained combatants and hand cards (game/battle/actors.ts). The stage is
  // created by the lazy renderers; the scene only announces what happened.
  battleActors?: import('../game/battle/actors').BattleActorStage;
  private enemyPoseGroups = new Map<string, { group: Phaser.GameObjects.Container; enemy: Enemy; scale: number }>();
  private enemyTurnBeatUi?: Phaser.GameObjects.Container;
  private enemyTextureBoundsCache = new Map<string, TextureVisibleBounds>();
  private combatAnimationPending = false;
  private playerCardFxBaseline?: Set<Phaser.GameObjects.GameObject>;
  private playerCardFxLastRetired = 0;
  private combatEnemyTurnBeat: EnemyTurnBeat = 'idle';
  private combatEnemyTurnMove = '';
  private combatEnemyTurnBeatStartedAtMs = 0;
  private combatEnemyTurnBeatDurationMs = 0;
  private leaderSignatureUsed = new Set<string>();
  private fledglingSuitRallies = new Set<string>();
  private introPlayed = false;
  private combatIntroActive = false;
  private combatIntroDismissQueued = false;
  private combatIntroDismissed = false;
  private combatIntroStartedAtMs = 0;
  private combatIntroElapsedMs = 0;
  private combatIntroFinish?: () => void;
  private outcomeFxPlayed?: GameMode;
  private outcomeDetailsOpen = false;
  private bossDossierModule?: BossDossierModule;
  private combatDefeatBurstBursts = 0;
  private combatImpactFlashBursts = 0;
  private combatPlayerHitConfirmBursts = 0;
  private combatPlayerCommitSigilBursts = 0;
  private combatSupplyUseBurstBursts = 0;
  private combatActionTrailBursts = 0;
  private combatCastFocusBurstBursts = 0;
  private combatWingbeatSpendBursts = 0;
  private combatEnemySwipeBursts = 0;
  private combatEnemyCommitmentSealBursts = 0;
  private combatEnemyAttackTellBursts = 0;
  private combatEnemyWindupPlaqueBursts = 0;
  private combatEnemySupportChargeBursts = 0;
  private combatEnemySupportTellBursts = 0;
  private combatFlockImpactBurstBursts = 0;
  private combatEnemyImpactContactBursts = 0;
  private combatOverextensionWarningBursts = 0;
  private combatBossPhaseBreakBursts = 0;
  private combatStatusCleanseSpecificBursts = 0;
  private combatOpenSkyBreakBursts = 0;
  private combatCacheChoiceRevealBursts = 0;
  private combatMoltTriggerChoiceBursts = 0;
  private combatEnemyHeavyContactBursts = 0;
  private combatEnemyHealBeamBursts = 0;
  private combatResourceOvercapBursts = 0;
  private combatCoverGuardBursts = 0;
  private combatCoverBlockBurstBursts = 0;
  private combatEnemyCoverBlockBursts = 0;
  private combatPerfectBraceRiposteBursts = 0;
  private combatPinnedOpeningStrikeBursts = 0;
  private combatFourSuitRallyBursts = 0;
  private combatSparkEchoBursts = 0;
  private combatOverflowShelterBursts = 0;
  private combatFormationShiftBursts = 0;
  private combatHealBloomBursts = 0;
  private combatEnemyMendBursts = 0;
  private combatEnemyCoverBursts = 0;
  private combatCoverShatterBursts = 0;
  private combatCardDrawBursts = 0;
  private combatDiscardSweepBursts = 0;
  private combatShuffleVortexBursts = 0;
  private combatFouledPressureBursts = 0;
  private combatRuffledBreakBursts = 0;
  private combatResonanceSurgeBursts = 0;
  private combatResonanceSpendBursts = 0;
  private combatWingbeatSurgeBursts = 0;
  private combatWingbeatDrainBursts = 0;
  private combatWindedGustBursts = 0;
  private combatFlowSurgeBursts = 0;
  private combatCleanseBurstBursts = 0;
  private combatBankCacheBursts = 0;
  private combatThreatChargeBursts = 0;
  private combatEnemyRecoveryAfterglowBursts = 0;
  private combatMoltShiftBursts = 0;
  private combatMoltPowerBursts = 0;
  private combatOpenSkyGuardBursts = 0;
  private combatOpenSkyExposureBursts = 0;
  private combatEncounterIntroBursts = 0;
  private combatVictoryRallyBursts = 0;
  private combatVictoryFanfareSigilBursts = 0;
  private combatTurnBannerBursts = 0;
  private combatRoostHandoffBursts = 0;
  private combatPlayerTurnRallyBursts = 0;
  private activeFxParticleBursts = 0;
  private activeGeneratedFxSprites = 0;
  private combatFxAssetsRequested = false;
  private combatFxModule?: CombatFxAssetsModule;
  private battleFxPresenterReady = false;
  private battleFxPresenterModule?: BattleFxPresenterModule;
  private battleDebugStateReady = false;
  private battleDebugStateModule?: BattleDebugStateModule;
  private battleBackdropRendererReady = false;
  private battleBackdropRendererModule?: BattleBackdropRendererModule;
  private battleForegroundRendererReady = false;
  private battleForegroundRendererModule?: BattleForegroundRendererModule;
  private battleHudRendererReady = false;
  private battleHudRendererModule?: BattleHudRendererModule;
  private battleHandRendererReady = false;
  private battleHandRendererModule?: BattleHandRendererModule;
  private battleSupplyDrawerModule?: RouteSupplyDrawerModule;
  private battleSupplyDrawerLoading = false;
  private battleSupplyDrawerFailed = false;
  private discardChoiceModule?: DiscardChoiceModule;
  private discardChoiceModuleReady = false;
  private returnChoiceModule?: ReturnChoiceModule;
  private returnChoiceModuleReady = false;
  private battleRewardRendererModule?: BattleRewardRendererModule;
  private battleRewardRendererLoading = false;
  private battleRewardRendererFailed = false;
  private battleInspectRendererModule?: BattleInspectRendererModule;
  private battleInspectRendererLoading = false;
  private battleInspectRendererFailed = false;
  private flockStatsOverlayModule?: FlockStatsOverlayModule;
  private flockStatsOverlayLoading = false;
  private flockStatsOverlayFailed = false;
  private combatEnemyTurnFxAssetsRequested = false;
  private combatOptionalFxAssetsRequested = false;
  private combatOutcomeFxAssetsRequested = false;
  private combatPreviewModule?: CombatPreviewModule;
  private battleEssentialUiReady = false;
  private battleCoreUiReady = false;
  private combatFxReady = false;
  private battleAssetReadiness = new SceneAssetReadinessTracker();
  private battleFullArtGroups: string[] = [];
  private battleFullArtTrackingStarted = false;
  private battleRenderQueued = false;
  private battleRenderScheduleToken = 0;
  private battleRenderRequests = 0;
  private battleRenderPasses = 0;
  private battleRenderCoalesced = 0;
  private battleRenderLastMs = 0;
  private battleRenderMaxMs = 0;
  private battleRenderTotalMs = 0;
  private battleBackdropBuilds = 0;
  private battleBackdropReuses = 0;
  private battleHandBuilds = 0;
  private battleHandReuses = 0;
  private battleRouteCheckpoint!: RunState;
  private battleStartingData!: BattleSceneData;
  private practiceRematch = false;
  private rewardClaims: RewardCheckpoint['claims'] = [];
  private rewardResume?: RewardCheckpoint;

  constructor() {
    super('BattleScene');
  }

  init(data: BattleSceneData = {}) {
    this.practiceTurn = false;
    this.practiceRematch = data.practiceRematch === true && memoryStorageSessionActive();
    this.outcomeSaved = true;
    this.flywayArchiveSaved = true;
    this.lastRunRewards = undefined;
    this.registry.set(controlPanelRegistryKey(this), false);
    this.registry.remove(controlCaptureRegistryKey(this));
    const runState = cloneRunState(data.runState ?? createInitialRunState());
    setPracticeEncounterId(this.practiceRematch && ['enc_canal_open_perch', 'enc_canal_alternating_watch', 'enc_spire_quiet_beat', 'enc_signature_ferry', 'enc_signature_relay', 'enc_signature_watch'].includes(data.practiceEncounterId ?? '') ? data.practiceEncounterId : undefined);
    this.battleStartingData = { runState: cloneRunState(runState), routeNodeId: data.routeNodeId, practiceEncounterId };
    this.runLeaderId = runState.leaderId;
    this.resolvingCard = undefined;
    this.flyway = normalizeFlyway(runState.flyway);
    this.flightCombat = newFlightCombat();
    this.flywayMapIndex = runState.mapIndex ?? 0;
    // Combat is not a resumable save format. Keep the complete route state,
    // including mode/contracts/modifiers, rather than persisting a partial fight.
    this.battleRouteCheckpoint = cloneRunState(runState);
    this.rewardResume = cloneRewardCheckpoint(runState.pendingCombatReward);
    this.rewardClaims = this.rewardResume?.claims ?? [];
    this.runDifficulty = runState.difficulty ?? 0;
    this.runMode = runState.runMode ?? 'full';
    setActiveSeed(runState.seed ?? 'alpha');
    setActiveMapIndex(runState.mapIndex ?? 0);
    setActiveRouteRhythm(runState.flyway?.routeRhythm === 1);
    const initialRouteNode = selectedCombatRouteNode(data.routeNodeId);
    const initialRouteIndex = currentCombatNodes().findIndex((node) => node.id === initialRouteNode.id);
    this.flock = createFlock();
    // Per-leader formation-Flow identity (e.g. Spark-Caller surges sooner, Talon opens near Surge).
    const leader = getLeader(this.runLeaderId);
    this.flock.flowMax = leader.flowMax ?? this.flock.flowMax;
    this.flock.flow = Math.min(this.flock.flowMax, leader.startFlow ?? 0);
    this.enemies = createEncounterEnemiesForRouteNode(initialRouteNode, this.flyway);
    if (this.flyway.conditionNode && this.flyway.conditionNode !== initialRouteNode.id) { this.flyway.condition = 'clear'; this.flyway.conditionNode = undefined; }
    const ascension = difficultyMods(this.runDifficulty);
    applyAscensionOpeningIntents(
      this.runDifficulty,
      this.enemies,
      activeSeed,
      activeMapIndex,
      initialRouteNode.id,
    );
    this.battleFullArtGroups = [
      'battle-current-art',
      'battle-enemy-turn-fx',
      'battle-optional-fx',
      ...(this.enemies.some((enemy) => enemy.runtime.type === 'boss' || enemy.runtime.type === 'elite')
        ? ['battle-outcome-fx']
        : []),
    ];
    this.battleAssetReadiness.reset([
      'battle-preloaded-art',
      'battle-essential-ui',
      'battle-core-ui',
      'battle-essential-fx',
      'battle-fx-presenter',
      'battle-debug-state',
      'battle-backdrop-renderer',
      'battle-foreground-renderer',
      'battle-hud-renderer',
      'battle-hand-renderer',
      'battle-discard-choice',
      'battle-return-choice',
      ...this.battleFullArtGroups,
    ]);
    this.battleFullArtTrackingStarted = false;
    this.runCombatResults = [...(runState.combatResults ?? [])];
    this.encounterObjective = this.createEncounterObjective(initialRouteNode);
    this.encounterObjectiveFeedbackStatus = this.encounterObjective ? 'active' : undefined;
    this.encounterObjectiveFeedbackBursts = 0;
    this.enemyDefeatedTurns = new Map();
    // Ascension: scale enemy Cohesion by the run's difficulty tier, with the
    // Tier 7/9 elite and boss levers stacked per enemy type.
    this.enemies.forEach((enemy) => {
      enemy.maxHp = Math.round(enemy.maxHp * enemyHpMultFor(ascension, enemy.runtime.type));
      enemy.hp = enemy.maxHp;
    });
    this.combatRandom = combatRandom(`${activeSeed}:combat:${activeMapIndex}:${initialRouteNode.id}`);
    this.drawPile = cardsFromSave(runState.deck);
    this.discardPile = [];
    this.clearedPile = [];
    this.hand = [];
    this.selectedInstanceId = undefined;
    this.discardChoice = undefined;
    this.returnChoice = undefined;
    this.selectedEnemyId = this.enemies[0]?.id ?? '';
    this.energy = this.flyway.condition === 'crosswind' ? 2 : 3;
    this.nextTurnEnergyBonus = 0;
    this.nextTurnDrawBonus = 0;
    this.pendingNestCoverBonus = 0;
    this.pendingRetainHand = 0;
    this.roostRetainPool = [];
    this.roostRetainPriorityInstanceId = undefined;
    this.pendingSupplyRepeats = 0;
    this.spark = 0;
    this.turn = 1;
    this.encounter = initialRouteIndex + 1;
    this.maxEncounters = currentCombatNodes().length;
    this.currentRouteIndex = initialRouteIndex;
    this.completedRouteNodeIds = [...runState.completedRouteNodeIds];
    this.scrap = runState.scrap;
    this.runScrapEarned = runState.scrapEarned ?? 0;
    this.runScrapSpent = runState.scrapSpent ?? 0;
    this.runStartedAtMs = runState.startedAtMs ?? Date.now();
    this.runSeenEnemyMoves = new Set(runState.seenEnemyMoves ?? []);
    this.runDistrictContracts = (runState.districtContracts ?? []).map((contract) => ({ ...contract }));
    this.routeMarks = [...runState.routeMarks];
    this.runSupplies = [...(runState.supplies ?? [])];
    this.runSupplyCapacity = runSupplyCapacity(runState);
    this.runSignalChoices = [...(runState.signalChoices ?? [])];
    this.runRewardEvents = [...(runState.rewardEvents ?? [])];
    this.runRouteDecisions = [...(runState.routeDecisions ?? [])];
    this.combatStartedAtMs = Date.now();
    this.runSuppliesUsed = [...(runState.suppliesUsed ?? [])];
    this.killedByMove = undefined;
    this.freePreenNextDistrict = runState.freePreenNextDistrict ?? 0;
    this.mode = 'battle';
    this.combatEconomyAwarded = false;
    this.combatScrapAwarded = 0;
    this.combatRouteMarkAwarded = undefined;
    this.combatRouteMarkResolved = false;
    this.waymarkChoices = [];
    this.waymarkRewardBuildObservations = {};
    this.inspectOverlay = undefined;
    this.inspectedCardId = undefined;
    this.pauseOverlayOpen = false;
    this.pauseSaveFailed = false;
    this.settingsOverlayOpen = false;
    this.systemOverlayLayer = undefined;
    this.systemOverlayRefreshQueued = false;
    this.waymarkDrawerOpen = false;
    this.waymarkReviewModule?.resetBattleWaymarks(this);
    this.waymarkReviewFailed = false;
    this.supplyDrawerOpen = false;
    this.supplyDrawerFocusIndex = 0;
    this.supplyDrawerArmedIndex = undefined;
    this.supplyDrawerInputActive = false;
    this.waymarkDrawerScroll = 0;
    this.cardReviewScroll = 0;
    this.rewardChoices = [];
    this.upgradeChoices = [];
    this.rewardInspectionCardId = undefined;
    this.rewardSkipArmed = false;
    this.rewardChoiceArmedId = undefined;
    this.controllerChoiceIndex = 0;
    this.rewardArtFailedKeys.clear();
    this.rewardArtRequestedKeys.clear();
    this.battleInputActive = false;
    this.log = [`${currentMap().name}: ${initialRouteNode.label} begins.`];
    this.handPage = 0;
    this.combatHistory = [...this.log];
    this.waymarkFeedback = [];
    this.supplyFeedback = [];
    this.optionalArtRequested = false;
    this.playedCardIdsThisCombat = new Set();
    this.playedSuitsThisTurn = new Set();
    (this as BattleScene & { motionPayoff?: unknown }).motionPayoff = undefined;
    this.cardContributions = [];
    this.cardContributionStart = undefined;
    this.statDealt = 0;
    this.statTaken = 0;
    this.statBlocked = 0;
    this.statCardsPlayed = 0;
    this.statDefeated = 0;
    this.statOverextensions = 0;
    this.statLowCardTurns = 0;
    this.statNoOverextensionTurns = 0;
    this.statTurnEnds = 0;
    this.statCardsHeldAtRoost = 0;
    this.statUnspentWingbeatAtRoost = 0;
    this.statMaxCardsPlayedTurn = 0;
    this.statWaymarksAtStart = this.routeMarks.length;
    this.statSurgesTriggered = 0;
    this.statInvalidActions = 0;
    this.statCancelledActions = 0;
    this.statDamageTakenByMove = new Map();
    this.zeroCostThisTurn = 0;
    this.roostCards = 0;
    this.roostFree = 0;
    this.roostHeld = 0;
    this.applyFlockStats(true);
    this.flock.hp = Math.min(this.flock.maxHp, Math.max(1, runState.currentHp));
    if (!this.rewardResume) this.applyNextCombatMods(runState.nextCombat);
    this.firstAttackThisTurn = true;
    this.enemyPoseGroups = new Map();
    this.handCardRects = new Map();
    this.handCardArtLayers = new Map();
    this.handCardFrames = new Map();
    this.handCardSelectionPulses = new Map();
    this.handCardFlowIndicators = new Map();
    this.enemyTurnBeatUi = undefined;
    this.combatAnimationPending = false;
    this.battleSupplyDrawerLoading = false;
    this.battleSupplyDrawerFailed = false;
    this.discardChoiceModule = undefined;
    this.discardChoiceModuleReady = false;
    this.returnChoiceModule = undefined;
    this.returnChoiceModuleReady = false;
    this.playerCardFxBaseline = undefined;
    this.playerCardFxLastRetired = 0;
    this.combatEnemyTurnBeat = 'idle';
    this.combatEnemyTurnMove = '';
    this.combatEnemyTurnBeatStartedAtMs = 0;
    this.combatEnemyTurnBeatDurationMs = 0;
    this.leaderSignatureUsed = new Set();
    this.fledglingSuitRallies = new Set();
    this.introPlayed = false;
    this.combatIntroActive = false;
    this.combatIntroDismissQueued = false;
    this.combatIntroDismissed = false;
    this.combatIntroStartedAtMs = 0;
    this.combatIntroElapsedMs = 0;
    this.combatIntroFinish = undefined;
    this.outcomeFxPlayed = undefined;
    this.outcomeDetailsOpen = false;
    this.combatTurnBannerBursts = 0;
    this.combatPlayerTurnRallyBursts = 0;
    this.combatDefeatBurstBursts = 0;
    this.combatImpactFlashBursts = 0;
    this.combatPlayerHitConfirmBursts = 0;
    this.combatPlayerCommitSigilBursts = 0;
    this.combatSupplyUseBurstBursts = 0;
    this.combatActionTrailBursts = 0;
    this.combatCastFocusBurstBursts = 0;
    this.combatWingbeatSpendBursts = 0;
    this.combatEnemySwipeBursts = 0;
    this.combatEnemyCommitmentSealBursts = 0;
    this.combatEnemyAttackTellBursts = 0;
    this.combatEnemyWindupPlaqueBursts = 0;
    this.combatEnemySupportChargeBursts = 0;
    this.combatEnemySupportTellBursts = 0;
    this.combatFlockImpactBurstBursts = 0;
    this.combatEnemyImpactContactBursts = 0;
    this.combatOverextensionWarningBursts = 0;
    this.combatBossPhaseBreakBursts = 0;
    this.combatStatusCleanseSpecificBursts = 0;
    this.combatOpenSkyBreakBursts = 0;
    this.combatCacheChoiceRevealBursts = 0;
    this.combatMoltTriggerChoiceBursts = 0;
    this.combatEnemyHeavyContactBursts = 0;
    this.combatEnemyHealBeamBursts = 0;
    this.combatResourceOvercapBursts = 0;
    this.combatCoverGuardBursts = 0;
    this.combatCoverBlockBurstBursts = 0;
    this.combatEnemyCoverBlockBursts = 0;
    this.combatPerfectBraceRiposteBursts = 0;
    this.combatPinnedOpeningStrikeBursts = 0;
    this.combatFourSuitRallyBursts = 0;
    this.combatSparkEchoBursts = 0;
    this.combatOverflowShelterBursts = 0;
    this.combatFormationShiftBursts = 0;
    this.combatHealBloomBursts = 0;
    this.combatEnemyMendBursts = 0;
    this.combatEnemyCoverBursts = 0;
    this.combatCoverShatterBursts = 0;
    this.combatCardDrawBursts = 0;
    this.combatDiscardSweepBursts = 0;
    this.combatShuffleVortexBursts = 0;
    this.combatFouledPressureBursts = 0;
    this.combatRuffledBreakBursts = 0;
    this.combatResonanceSurgeBursts = 0;
    this.combatResonanceSpendBursts = 0;
    this.combatWingbeatSurgeBursts = 0;
    this.combatWingbeatDrainBursts = 0;
    this.combatWindedGustBursts = 0;
    this.combatFlowSurgeBursts = 0;
    this.combatCleanseBurstBursts = 0;
    this.combatBankCacheBursts = 0;
    this.combatThreatChargeBursts = 0;
    this.combatEnemyRecoveryAfterglowBursts = 0;
    this.combatMoltShiftBursts = 0;
    this.combatMoltPowerBursts = 0;
    this.combatOpenSkyGuardBursts = 0;
    this.combatOpenSkyExposureBursts = 0;
    this.combatEncounterIntroBursts = 0;
    this.combatVictoryRallyBursts = 0;
    this.combatVictoryFanfareSigilBursts = 0;
    this.activeFxParticleBursts = 0;
    this.activeGeneratedFxSprites = 0;
    this.combatFxAssetsRequested = false;
    this.combatFxModule = undefined;
    this.battleFxPresenterReady = false;
    this.battleFxPresenterModule = undefined;
    // The telemetry builder is pure and safe to retain across scene restarts.
    // This also keeps render_game_to_text complete for harnesses that re-init a
    // live BattleScene instance without running create() again.
    this.battleDebugStateReady = Boolean(this.battleDebugStateModule);
    // Backdrop rendering is pure scene presentation and can also be retained
    // when Phaser reuses this BattleScene instance.
    this.battleBackdropRendererReady = Boolean(this.battleBackdropRendererModule);
    // Foreground composition is also pure presentation and safe to retain
    // across BattleScene reuse.
    this.battleForegroundRendererReady = Boolean(this.battleForegroundRendererModule);
    // Battle HUD chrome is pure presentation and safe to retain across scene
    // reuse; callbacks and live values are supplied per render.
    this.battleHudRendererReady = Boolean(this.battleHudRendererModule);
    // Hand composition is also pure presentation and safe to retain; card
    // behavior and callbacks are supplied by BattleScene for every render.
    this.battleHandRendererReady = Boolean(this.battleHandRendererModule);
    this.battleRewardRendererLoading = false;
    this.battleRewardRendererFailed = false;
    this.battleInspectRendererLoading = false;
    this.battleInspectRendererFailed = false;
    this.flockStatsOverlayLoading = false;
    this.flockStatsOverlayFailed = false;
    this.combatEnemyTurnFxAssetsRequested = false;
    this.combatOptionalFxAssetsRequested = false;
    this.combatOutcomeFxAssetsRequested = false;
    this.combatPreviewModule = undefined;
    this.battleEssentialUiReady = false;
    this.battleCoreUiReady = false;
    this.combatFxReady = false;
    this.backdropRenderKey = '';
    this.handRenderKey = '';
    this.battleRenderQueued = false;
    this.battleRenderScheduleToken = 0;
    this.battleRenderRequests = 0;
    this.battleRenderPasses = 0;
    this.battleRenderCoalesced = 0;
    this.battleRenderLastMs = 0;
    this.battleRenderMaxMs = 0;
    this.battleRenderTotalMs = 0;
    this.battleBackdropBuilds = 0;
    this.battleBackdropReuses = 0;
    this.battleHandBuilds = 0;
    this.battleHandReuses = 0;
    this.combatRoostHandoffBursts = 0;
    this.combatPlayerTurnRallyBursts = 0;
    this.rewardChoiceGlowBurstBursts = 0;
    const teachingOrder = activeMapIndex === 0 && this.runCombatResults.length === 0 && ['card', 'roost', 'reward'].includes(firstFlightGuideStep());
    const preparedOpening = prepareOpeningDraw(
      teachingOrder ? orderTeachingHand(this.drawPile) : this.drawPile,
      `${activeSeed}:opening:${activeMapIndex}:${initialRouteNode.id}`,
      this.runCombatResults.length > 0,
      this.handTargetSize(),
    );
    this.drawPile = preparedOpening.deck;
    this.openingDraw = preparedOpening.state;
    if (teachingOrder) this.openingDraw.teachingOrder = true;
    if (this.openingDraw.protectionSwaps > 0) {
      this.log.push('Opening draw steadied: playable pressure is ready.');
    }
    this.drawToHandSize();
    this.lastFlockState = this.flockState();
    if (this.rewardResume) {
      const reward = this.rewardResume;
      this.mode = reward.stage === 'route' ? 'upgradeReward' : reward.stage;
      this.enemies.forEach(enemy => { enemy.hp = 0; });
      this.combatEconomyAwarded = true;
      this.combatScrapAwarded = reward.scrapAwarded;
      this.combatRouteMarkResolved = reward.stage !== 'waymarkReward';
      this.combatRouteMarkAwarded = reward.waymarkAwarded ? alphaRouteMarkLibrary.get(reward.waymarkAwarded) : undefined;
      this.waymarkChoices = reward.stage === 'waymarkReward'
        ? reward.choices.flatMap(id => { const mark = alphaRouteMarkLibrary.get(id); return mark ? [mark] : []; }) : [];
      this.rewardChoices = reward.stage === 'cardReward' ? reward.choices.map(id => cloneCard(id)) : [];
      this.upgradeChoices = reward.stage === 'upgradeReward'
        ? reward.choices.flatMap(id => {
          const card = this.allDeckCards().find(card => card.id === id && !card.upgraded);
          return card ? [card] : [];
        }) : [];
      this.rewardDecisionStartedAtMs = Date.now();
      this.log = [...runState.routeLog];
    }
    if (data.turnCheckpoint && this.practiceRematch) restoreTurn(this, data.turnCheckpoint);
    else captureTurn(this);
  }

  // Consume route-granted pending combat modifiers at combat start (Supplies,
  // Signals, and Waymarks that set up the next fight).
  private applyNextCombatMods(pending: NextCombatMods | undefined) {
    if (!pending) return;
    if (pending.wingbeatBonus) { this.energy += pending.wingbeatBonus; this.logEvent(`Ivo’s relay adds ${pending.wingbeatBonus} Wingbeat on the opening turn.`); }
    if (pending.openSkyGuard) this.flock.openSkyGuard += pending.openSkyGuard;
    if (pending.reduceNextOpenSky) this.flock.openSkyReduction += pending.reduceNextOpenSky;
    if (pending.startOpenSky) { this.flock.exposed = true; this.flock.exposedTurns = 2; }
    if (pending.enemyCover) this.enemies.forEach((enemy) => { enemy.block += pending.enemyCover ?? 0; });
    if (pending.bossDamageShield && currentCombatNodes()[this.currentRouteIndex]?.type === 'boss') {
      const cover = flywayCoverGain(this.flyway, pending.bossDamageShield);
      this.flock.block += cover;
      this.observeCardEffect('cover', cover);
      this.logEvent(`Boss prep adds ${cover} Cover.`);
    }
  }

  // --- Waymarks --------------------------------------------------------------
  // Waymarks are persistent run-long item modifiers. Each owned mark fires its authored
  // `effect` at its `trigger` through resolveMarkEffect, so authored marks
  // actually reshape combat instead of being decorative collectibles.
  private ownedMarkDefs() {
    return [...this.routeMarks
      .map((id) => alphaRouteMarkLibrary.get(id))
      .filter((mark): mark is NonNullable<typeof mark> => !!mark), ...capstoneMarks(this.flyway.capstone)];
  }

  // The closed mark-effect verb set the runtime honors at a trigger point.
  // Economy/passive verbs (gainScrap/addHeal/reducePreenPrice/reduceOpenSky/
  // gainSupplyChoice) are consumed at their own dedicated sites, not here.
  private resolveMarkEffect(effect: string, markName: string) {
    const parsed = parseEffect(effect);
    if (!parsed) return;
    const rawValue = parseEffectValue(parsed.args[1] ?? parsed.args[0], 0);
    const value = ['gainCover', 'bossDamageShield'].includes(parsed.name) ? flywayCoverGain(this.flyway, rawValue) : rawValue;
    switch (parsed.name) {
      case 'gainCover':
        this.flock.block += value;
        this.observeCardEffect('cover', value);
        if (value > 0) {
          birdAudio.play('cover', Math.min(1.25, 0.72 + value / 14));
          this.queueFlockMotion('brace');
          this.presentNumberFeedback(FLOCK_FX_X, FLOCK_FX_Y, '#c9a6ff', {
            target: 'flock', kind: 'cover', source: `Waymark: ${markName}`, amount: value, suffix: ' Cover', reducedMotion: prefersReducedMotion(),
          });
          this.coverBuildFx('nests');
        }
        break;
      case 'gainCoverPerWaymark': {
        const cover = flywayCoverGain(this.flyway, value * this.routeMarks.length);
        this.flock.block += cover;
        this.observeCardEffect('cover', cover);
        if (cover > 0) {
          birdAudio.play('cover', Math.min(1.25, 0.72 + cover / 14));
          this.queueFlockMotion('brace');
          this.presentNumberFeedback(FLOCK_FX_X, FLOCK_FX_Y, '#c9a6ff', {
            target: 'flock', kind: 'cover', source: `Waymark: ${markName}`, amount: cover, suffix: ' Cover', reducedMotion: prefersReducedMotion(),
          });
          this.coverBuildFx('nests');
        }
        break;
      }
      case 'gainWingbeat':
        this.energy += value;
        this.observeCardEffect('wingbeats', value);
        this.wingbeatGainFx(value);
        break;
      case 'gainEnergyNextTurn':
        this.nextTurnEnergyBonus += value;
        this.bankNextTurnFx(value, `+${value} next Wingbeat`, '#dffbff', 0x8df4ff);
        break;
      case 'gainResonance':
        this.gainResonance(value);
        break;
      case 'gainScrap':
        this.scrap += value;
        this.runScrapEarned += Math.max(0, value);
        break;
      case 'gainOpenSkyGuard':
        this.gainOpenSkyGuard(value, markName);
        break;
      case 'reduceNextOpenSky':
        this.flock.openSkyReduction += value;
        break;
      case 'draw':
        this.drawCards(value);
        break;
      case 'damageAll':
        this.enemies
          .filter((enemy) => enemy.hp > 0)
          .forEach((enemy) => this.damageEnemy(enemy.id, value, markName));
        break;
      case 'heal':
        this.healFlock(value, markName);
        break;
      case 'nextCoverBonus':
        this.pendingNestCoverBonus += value;
        this.bankNextTurnFx(value, `+${value} next Cover`, '#c9a6ff', 0xc9a6ff);
        break;
      case 'retainHand':
        this.retainCards(value, markName);
        break;
      case 'nextTurnDraw':
        this.nextTurnDrawBonus += value;
        this.bankNextTurnFx(value, value >= 0 ? `+${value} next draw` : `${value} next draw`, '#f7d889', 0xf7d889);
        break;
      case 'repeatNextSupply':
        this.pendingSupplyRepeats += value;
        break;
      case 'cleanseFlock':
        this.cleanseFlock(value, markName);
        break;
      case 'bossDamageShield':
        if (currentCombatNodes()[this.currentRouteIndex]?.type === 'boss') {
          this.flock.block += value;
          this.observeCardEffect('cover', value);
          if (value > 0) {
            birdAudio.play('cover', Math.min(1.25, 0.72 + value / 14));
            this.queueFlockMotion('brace');
            this.presentNumberFeedback(FLOCK_FX_X, FLOCK_FX_Y, '#ffe1a3', {
              target: 'flock', kind: 'cover', source: `Waymark: ${markName}`, amount: value, suffix: ' Cover', reducedMotion: prefersReducedMotion(),
            });
            this.coverBuildFx('nests');
          }
        }
        break;
    }
  }

  private markFeedbackSummary(mark: RuntimeRouteMark) {
    const effect = routeMarkEffectText(mark)
      .replace(/\.$/, '')
      .replace(/^The next Supply resolves /, 'Next Supply x')
      .replace(/^Next district starts with /, 'Next district: ');
    if (mark.trigger === 'combatStart') return effect;
    if (mark.trigger === 'onSupplyUsed') return `Supply combo: ${effect}`;
    if (mark.trigger === 'onEnemyCoverBroken') return `Cover broken: ${effect}`;
    if (mark.trigger === 'onEnterMolt') return `Molt: ${effect}`;
    if (mark.trigger === 'onHealFlock') return `Healing: ${effect}`;
    if (mark.trigger === 'onRoostWithWingbeat') return `Unspent Wingbeat: ${effect}`;
    if (mark.trigger === 'onRoostWithCardsInHand') return `Held card: ${effect}`;
    if (mark.trigger === 'onTurnEndNoOverextension') return `Clean Roost: ${effect}`;
    const suit = /^onSuitPlayed\(([^)]+)\)$/.exec(mark.trigger)?.[1];
    if (suit) return `${suit[0].toUpperCase()}${suit.slice(1)}: ${effect}`;
    const nth = /^onNthCardThisTurn\((\d+)\)$/.exec(mark.trigger)?.[1];
    if (nth) return `Card ${nth}: ${effect}`;
    const lowCard = /^onLowCardTurn\((\d+)\)$/.exec(mark.trigger)?.[1];
    if (lowCard) return `${lowCard}-card Roost: ${effect}`;
    return effect;
  }

  private showWaymarkFeedback(mark: RuntimeRouteMark) {
    const summary = this.markFeedbackSummary(mark);
    this.waymarkFeedback = [
      { id: mark.id, name: mark.name, summary, turn: this.turn },
      ...this.waymarkFeedback
    ].slice(0, 4);

    this.presentTriggerFeedback(mark.name, summary, this.waymarkAccent(mark));
  }

  private presentTriggerFeedback(name: string, summary: string, accent: number) {
    if (!this.fxLayer?.active) return;
    this.battleFxPresenterModule?.presentTriggerFeedback(this, this.fxLayer, {
      name, summary, accent, turn: this.turn, fontFamily: UI_FONT,
      reducedMotion: prefersReducedMotion(), holdScale: textPaceScale(),
    });
  }

  private presentNumberFeedback(x: number, y: number, color: string, value: import('../game/battle/number-feedback').NumberFeedback) {
    if (this.battleFxPresenterModule) {
      this.battleFxPresenterModule.presentNumberFeedback(this, this.fxLayer, x, y, color, value, textPaceScale());
    } else {
      floatingText(this, this.fxLayer, x, y, value.label ?? `${value.amount}${value.suffix}`, color);
    }
  }

  private presentFlockStatus(label: string, color: string, source: string) {
    this.presentNumberFeedback(FLOCK_FX_X, FLOCK_FX_Y, color, {
      target: 'flock', kind: `status:${label}`, source, amount: 0, suffix: '', label,
      reducedMotion: prefersReducedMotion(),
    });
  }

  private presentFlockResult(amount: number, suffix: string, color: string, source: string) {
    this.presentNumberFeedback(FLOCK_FX_X, FLOCK_FX_Y, color, {
      target: 'flock', kind: suffix.trim(), source, amount, suffix, reducedMotion: prefersReducedMotion(),
    });
  }

  private presentEnemyStatus(enemy: Enemy, label: string, color: string) {
    const view = this.enemyView(enemy);
    this.presentNumberFeedback(view.x, view.y, color, {
      target: enemy.id, kind: `status:${label}`, source: label, amount: 0, suffix: '', label,
      reducedMotion: prefersReducedMotion(),
    });
  }

  private supplyFeedbackSummary(supply: RuntimeSupply, repeats = 1) {
    const summary = formatEffects(supply.effects)
      .replace(/\s+/g, ' ')
      .replace(/\.$/, '');
    return repeats > 1 ? `x${repeats}: ${summary}` : summary;
  }

  private showSupplyFeedback(supply: RuntimeSupply, repeats = 1) {
    const summary = this.supplyFeedbackSummary(supply, repeats);
    this.supplyFeedback = [
      { id: supply.id, name: supply.name, summary, timing: supply.timing, turn: this.turn },
      ...this.supplyFeedback
    ].slice(0, 4);

    this.presentTriggerFeedback(supply.name, summary, 0xffb86b);
  }

  private triggerWaymark(mark: RuntimeRouteMark) {
    routeMarkEffects(mark).forEach((effect) => this.resolveMarkEffect(effect, mark.name));
    this.showWaymarkFeedback(mark);
    this.logEvent(`${mark.name}: ${mark.description}`);
  }

  private applyMarkTrigger(trigger: string) {
    for (const mark of this.ownedMarkDefs()) {
      if (mark.trigger !== trigger) continue;
      this.triggerWaymark(mark);
    }
  }

  // Sum the numeric arg of a verb across owned marks at a trigger (for passive
  // modifiers like quiet_landing's reduceOpenSky).
  private markValue(trigger: string, verb: string) {
    let total = 0;
    for (const mark of this.ownedMarkDefs()) {
      if (mark.trigger !== trigger) continue;
      for (const effect of routeMarkEffects(mark)) {
        const parsed = parseEffect(effect);
        if (parsed && parsed.name === verb) total += parseEffectValue(parsed.args[1] ?? parsed.args[0], 0);
      }
    }
    return total;
  }

  // Reset the per-combat latches and fire combatStart marks. Called once per
  // combat from create() (after fxLayer exists), so cover/wingbeat marks land
  // on turn 1 and aren't wiped by the next turn's energy/block reset.
  private applyCombatStartMarks() {
    this.markFiredThisCombat = new Set();
    this.markFiredThisTurn = new Set();
    this.markFirstOpenSkyConsumed = false;
    this.cardsPlayedThisTurn = 0;
    this.applyMarkTrigger('combatStart');
  }

  private roostRestraintMarkMatches(mark: RuntimeRouteMark, cardsHeld: number, wingbeat: number, cardsPlayed: number) {
    return roostRetainTriggerMatches(mark.trigger, cardsHeld, wingbeat, cardsPlayed, OVEREXTENSION_CARD_THRESHOLD);
  }

  private projectedRoostRetainCount() {
    const triggered = this.ownedMarkDefs()
      .filter((mark) => !this.markFiredThisCombat.has(mark.id))
      .filter((mark) => this.roostRestraintMarkMatches(mark, this.hand.length, this.energy, this.cardsPlayedThisTurn))
      .reduce((total, mark) => total + routeMarkEffects(mark).reduce((sum, effect) => {
        const parsed = parseEffect(effect);
        return sum + (parsed?.name === 'retainHand' ? Number(parsed.args[0]) || 0 : 0);
      }, 0), 0);
    return Math.min(this.hand.length, Math.max(0, this.pendingRetainHand + triggered));
  }

  private retentionPlan() {
    const count = this.projectedRoostRetainCount();
    const cards = retainPriorityItems(this.hand, count, this.selectedInstanceId);
    return {
      count,
      cards,
      selectedPriority: cards.some((card) => card.instanceId === this.selectedInstanceId)
        ? this.selectedInstanceId
        : undefined,
    };
  }

  private retainCards(amount: number, source: string): RetainSource {
    if (this.roostRetainPool.length) {
      const retained = retainedInOriginalOrder(
        this.roostRetainPool,
        amount,
        this.roostRetainPriorityInstanceId,
      );
      if (retained.length) {
        const retainedIds = new Set(retained.map((card) => card.instanceId));
        this.roostRetainPool = this.roostRetainPool.filter((card) => !retainedIds.has(card.instanceId));
        this.discardPile = this.discardPile.filter((card) => !retainedIds.has(card.instanceId));
        this.hand.push(...retained);
        this.logEvent(`${source} retains ${retained.length} card${retained.length === 1 ? '' : 's'} for next turn.`);
        this.bankNextTurnFx(retained.length, `Retain ${retained.length}`, '#dffbff', 0x8df4ff);
        return 'roostDiscard';
      }
    }
    this.pendingRetainHand += amount;
    this.logEvent(`${source} retains ${amount} card${amount === 1 ? '' : 's'} for next turn.`);
    this.bankNextTurnFx(amount, `Retain ${amount}`, '#dffbff', 0x8df4ff);
    return 'pending';
  }

  private fireOncePerCombatMark(mark: RuntimeRouteMark) {
    if (this.markFiredThisCombat.has(mark.id)) return;
    this.markFiredThisCombat.add(mark.id);
    this.triggerWaymark(mark);
  }

  private fireOncePerTurnMark(mark: RuntimeRouteMark) {
    if (this.markFiredThisTurn.has(mark.id)) return;
    this.markFiredThisTurn.add(mark.id);
    this.triggerWaymark(mark);
  }

  // onNthCardThisTurn(N) marks: fire once per combat the first time the player
  // has played N cards in a single turn.
  private checkNthCardMarks() {
    for (const mark of this.ownedMarkDefs()) {
      const nth = /^onNthCardThisTurn\((\d+)\)$/.exec(mark.trigger);
      if (!nth || this.cardsPlayedThisTurn !== Number(nth[1]) || this.markFiredThisCombat.has(mark.id)) continue;
      this.markFiredThisCombat.add(mark.id);
      this.triggerWaymark(mark);
    }
  }

  private checkRoostRestraintMarks(cardsHeldAtRoost: number, wingbeatAtRoost: number, cardsPlayedAtRoost: number) {
    for (const mark of this.ownedMarkDefs()) {
      if (this.roostRestraintMarkMatches(mark, cardsHeldAtRoost, wingbeatAtRoost, cardsPlayedAtRoost)) this.fireOncePerCombatMark(mark);
    }
  }

  private checkSupplyUsedMarks() {
    for (const mark of this.ownedMarkDefs()) {
      if (mark.trigger !== 'onSupplyUsed') continue;
      if (routeMarkEffects(mark).some((effect) => parseEffect(effect)?.name === 'repeatNextSupply')) {
        this.triggerWaymark(mark);
        continue;
      }
      this.fireOncePerCombatMark(mark);
    }
  }

  private checkEnterMoltMarks() {
    for (const mark of this.ownedMarkDefs()) {
      if (mark.trigger !== 'onEnterMolt') continue;
      this.fireOncePerCombatMark(mark);
    }
  }

  private checkSuitPlayedMarks(suit: string | null) {
    if (!suit) return;
    for (const mark of this.ownedMarkDefs()) {
      const suitTrigger = /^onSuitPlayed\((plumes|quills|basins|nests)\)$/.exec(mark.trigger);
      if (!suitTrigger || suitTrigger[1] !== suit) continue;
      this.fireOncePerTurnMark(mark);
    }
  }

  private checkHealFlockMarks() {
    for (const mark of this.ownedMarkDefs()) {
      if (mark.trigger !== 'onHealFlock') continue;
      this.fireOncePerTurnMark(mark);
    }
  }

  private checkEnemyCoverBrokenMarks() {
    for (const mark of this.ownedMarkDefs()) {
      if (mark.trigger !== 'onEnemyCoverBroken') continue;
      this.fireOncePerTurnMark(mark);
    }
  }

  private checkResonanceSpentMarks() {
    for (const mark of this.ownedMarkDefs()) {
      if (mark.trigger !== 'onResonanceSpent') continue;
      this.fireOncePerCombatMark(mark);
    }
  }

  private checkNoDamageTurnMarks() {
    for (const mark of this.ownedMarkDefs()) {
      if (mark.trigger !== 'onTurnEndNoHpLoss') continue;
      this.fireOncePerCombatMark(mark);
    }
  }

  // mapStart marks grant their supply into the run as the flock enters the next
  // district (reused this.runSupplies flows into createRouteReturnState).
  private applyMapStartMarks() {
    for (const mark of this.ownedMarkDefs()) {
      if (mark.trigger !== 'mapStart') continue;
      for (const effect of routeMarkEffects(mark)) {
        const parsed = parseEffect(effect);
        if (parsed && parsed.name === 'gainSupplyChoice' && this.runSupplies.length < 2) {
          const ids = [...alphaSupplyLibrary.keys()].filter((id) => !this.runSupplies.includes(id));
          const pick = ids[Math.floor(this.combatRandom() * ids.length)];
          if (pick) {
            this.runSupplies.push(pick);
            this.logEvent(`${mark.name}: a Supply is stashed for the new district.`);
          }
        }
        if (parsed && parsed.name === 'freePreenNextDistrict') {
          const value = parseEffectValue(parsed.args[1] ?? parsed.args[0], 0) || 1;
          this.freePreenNextDistrict += value;
          this.logEvent(`${mark.name}: ${value} free Preen waits in the next district.`);
        }
        if (parsed && parsed.name === 'districtStartKit') {
          const value = parseEffectValue(parsed.args[1] ?? parsed.args[0], 0) || 1;
          this.freePreenNextDistrict += value;
          for (let i = 0; i < value && this.runSupplies.length < this.runSupplyCapacity; i += 1) {
            const ids = [...alphaSupplyLibrary.keys()].filter((id) => !this.runSupplies.includes(id));
            const pick = ids[Math.floor(this.combatRandom() * ids.length)];
            if (pick) this.runSupplies.push(pick);
          }
          this.logEvent(`${mark.name}: the next district starts with Preen and packed gear.`);
        }
        if (parsed && parsed.name === 'gainScrap') {
          const value = parseEffectValue(parsed.args[1] ?? parsed.args[0], 0);
          this.scrap += value;
          this.runScrapEarned += Math.max(0, value);
          this.logEvent(`${mark.name}: +${value} Scrap waits on the reopened route.`);
        }
      }
    }
  }

  create() {
    loadFlyway(this);
    syncSceneAnimationPace(this);
    birdAudio.setMood(this.battlefieldMood() === 'boss' ? 'boss' : 'battle');
    birdAudio.play('battle.enter', { tier: this.battlefieldMood() === 'boss' ? 'boss' : this.enemies.some((enemy) => enemy.runtime.type === 'elite') ? 'elite' : 'street', district: this.flywayMapIndex });
    observeChoiceInput(this);
    window.__birdSquadAudio = () => birdAudio.snapshot();
    this.time.paused = false;
    this.tweens.resumeAll();
    this.cameras.main.setBackgroundColor('#08101d');
    this.backdropLayer = this.add.container(0, 0).setDepth(-20);
    this.handLayer = this.add.container(0, 0).setDepth(30).setVisible(false);
    this.root = this.add.container(0, 0);
    this.ensureFxTextures();
    this.combatAnimationPending = true;
    this.renderBattleReadinessScreen();
    this.battleAssetReadiness.settle(
      'battle-preloaded-art',
      runtimeImageLoadSnapshot(this, this.battleArtAssets()),
    );
    queueRequiredUiIconAssets(this, battleEssentialUiIconIds, 'Essential battle UI', (result) => {
      this.battleAssetReadiness.settle('battle-essential-ui', result);
      this.battleEssentialUiReady = true;
      this.finishCombatCreate();
    });
    queueRequiredUiIconAssets(this, battleCoreUiIconIds, 'Battle UI', (result) => {
      this.battleAssetReadiness.settle('battle-core-ui', result);
      this.battleCoreUiReady = true;
      this.finishCombatCreate();
    });
    this.queueCombatFxAssetLoad((result) => {
      this.battleAssetReadiness.settle('battle-essential-fx', result);
      this.combatFxReady = true;
      this.finishCombatCreate();
    });
    void withRuntimeLoadTimeout(loadBattleFxPresenterModule(), 'Battle FX presenter')
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.battleFxPresenterModule = module;
        this.battleAssetReadiness.settle('battle-fx-presenter');
        this.battleFxPresenterReady = true;
        this.finishCombatCreate();
      })
      .catch((error) => {
        console.warn(LAZY_LOAD_FAILED, error);
        if (!this.sys.settings.active) return;
        // Secondary presentation may degrade, but a chunk failure must not
        // strand the player behind the battle readiness screen.
        this.battleAssetReadiness.settle('battle-fx-presenter', failedModuleLoadResult(
          'battle FX presenter module',
          error instanceof RuntimeLoadTimeoutError,
        ));
        this.battleFxPresenterReady = true;
        this.finishCombatCreate();
      });
    void withRuntimeLoadTimeout(loadBattleDebugStateModule(), 'Battle debug state')
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.battleDebugStateModule = module;
        this.battleAssetReadiness.settle('battle-debug-state');
        this.battleDebugStateReady = true;
        this.finishCombatCreate();
      })
      .catch((error) => {
        console.warn(LAZY_LOAD_FAILED, error);
        if (!this.sys.settings.active) return;
        // Debug telemetry may degrade, but an optional diagnostics chunk must
        // never strand the player behind the battle readiness screen.
        this.battleAssetReadiness.settle('battle-debug-state', failedModuleLoadResult(
          'battle debug-state module',
          error instanceof RuntimeLoadTimeoutError,
        ));
        this.battleDebugStateReady = true;
        this.finishCombatCreate();
      });
    void withRuntimeLoadTimeout(loadBattleBackdropRendererModule(), 'Battle backdrop renderer')
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.battleBackdropRendererModule = module;
        this.battleAssetReadiness.settle('battle-backdrop-renderer');
        this.battleBackdropRendererReady = true;
        this.finishCombatCreate();
      })
      .catch((error) => {
        console.warn(LAZY_LOAD_FAILED, error);
        if (!this.sys.settings.active) return;
        // A presentation chunk failure may simplify scenery, but must never
        // strand the player behind the battle readiness screen.
        this.battleAssetReadiness.settle('battle-backdrop-renderer', failedModuleLoadResult(
          'battle backdrop renderer module',
          error instanceof RuntimeLoadTimeoutError,
        ));
        this.battleBackdropRendererReady = true;
        this.finishCombatCreate();
      });
    void withRuntimeLoadTimeout(loadBattleForegroundRendererModule(), 'Battle foreground renderer')
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.battleForegroundRendererModule = module;
        this.battleAssetReadiness.settle('battle-foreground-renderer');
        this.battleForegroundRendererReady = true;
        this.finishCombatCreate();
      })
      .catch((error) => {
        console.warn(LAZY_LOAD_FAILED, error);
        if (!this.sys.settings.active) return;
        // A presentation chunk failure may simplify combatants, but must never
        // strand the player behind the battle readiness screen.
        this.battleAssetReadiness.settle('battle-foreground-renderer', failedModuleLoadResult(
          'battle foreground renderer module',
          error instanceof RuntimeLoadTimeoutError,
        ));
        this.battleForegroundRendererReady = true;
        this.finishCombatCreate();
      });
    void withRuntimeLoadTimeout(loadBattleHudRendererModule(), 'Battle HUD renderer')
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.battleHudRendererModule = module;
        this.battleAssetReadiness.settle('battle-hud-renderer');
        this.battleHudRendererReady = true;
        this.finishCombatCreate();
      })
      .catch((error) => {
        console.warn(LAZY_LOAD_FAILED, error);
        if (!this.sys.settings.active) return;
        // HUD presentation may simplify, but Roost and pile inspection remain
        // available through the scene fallback instead of blocking readiness.
        this.battleAssetReadiness.settle('battle-hud-renderer', failedModuleLoadResult(
          'battle HUD renderer module',
          error instanceof RuntimeLoadTimeoutError,
        ));
        this.battleHudRendererReady = true;
        this.finishCombatCreate();
      });
    void withRuntimeLoadTimeout(loadBattleHandRendererModule(), 'Battle hand renderer')
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.battleHandRendererModule = module;
        this.battleAssetReadiness.settle('battle-hand-renderer');
        this.battleHandRendererReady = true;
        this.finishCombatCreate();
      })
      .catch((error) => {
        console.warn(LAZY_LOAD_FAILED, error);
        if (!this.sys.settings.active) return;
        // A hand-renderer failure still leaves compact, clickable cards through
        // the scene fallback instead of blocking combat readiness.
        this.battleAssetReadiness.settle('battle-hand-renderer', failedModuleLoadResult(
          'battle hand renderer module',
          error instanceof RuntimeLoadTimeoutError,
        ));
        this.battleHandRendererReady = true;
        this.finishCombatCreate();
      });
    void withRuntimeLoadTimeout(loadDiscardChoiceModule(), 'Discard choice rules')
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.discardChoiceModule = module;
        this.battleAssetReadiness.settle('battle-discard-choice');
        this.discardChoiceModuleReady = true;
        this.finishCombatCreate();
      })
      .catch((error) => {
        console.warn(LAZY_LOAD_FAILED, error);
        if (!this.sys.settings.active) return;
        this.battleAssetReadiness.settle('battle-discard-choice', failedModuleLoadResult(
          'discard choice module',
          error instanceof RuntimeLoadTimeoutError,
        ));
        this.discardChoiceModuleReady = true;
        this.finishCombatCreate();
      });
    void withRuntimeLoadTimeout(loadReturnChoiceModule(), 'Discard return choice rules')
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.returnChoiceModule = module;
        this.battleAssetReadiness.settle('battle-return-choice');
        this.returnChoiceModuleReady = true;
        this.finishCombatCreate();
      })
      .catch((error) => {
        console.warn(LAZY_LOAD_FAILED, error);
        if (!this.sys.settings.active) return;
        this.battleAssetReadiness.settle('battle-return-choice', failedModuleLoadResult(
          'discard return choice module',
          error instanceof RuntimeLoadTimeoutError,
        ));
        this.returnChoiceModuleReady = true;
        this.finishCombatCreate();
      });
    void loadCombatPreviewModule()
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.combatPreviewModule = module;
        if (this.fxLayer?.active && this.mode === 'battle' && !this.combatAnimationPending) {
          this.requestBattleRender();
        }
      })
      .catch((error) => console.warn(LAZY_LOAD_FAILED, error));
    this.cameras.main.fadeIn(200);

    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'].forEach((key, index) => {
      this.input.keyboard?.on(`keydown-${key}`, (event?: KeyboardEvent) => {
        if (!event?.repeat && !controlPanelOwnsInput(this)) this.activateCombatChoice(index);
      });
    });
    bindControlActions(this, {
      back: () => this.handleBattleBack(),
      guide: (event) => {
        if (event?.repeat) return;
        if (event?.shiftKey) this.openCombatHistory();
        else this.toggleCombatCardDetail();
      },
      confirm: (event) => {
        if (!this.fxLayer?.active) return;
        if (event?.repeat) return;
        if (this.settingsOverlayOpen || this.pauseOverlayOpen) return;
        if (this.requestBattleIntroDismiss()) return;
        if (this.rewardInspectionCardId) {
          this.closeRewardCardInspection();
          return;
        }
        if (this.outcomeDetailsOpen) {
          this.closeOutcomeFlightDetails();
          return;
        }
        if (this.settingsOverlayOpen || this.pauseOverlayOpen) return;
        if (this.combatCardDetail?.active) { this.closeCombatCardDetail(); return; }
        if (this.supplyDrawerOpen) {
          this.requestBattleSupplyUse(this.supplyDrawerFocusIndex);
          return;
        }
        if (this.inspectOverlay || this.waymarkDrawerOpen) return;
        if (this.mode === 'cardReward' && this.rewardSkipArmed) return;
        if (this.returnChoice) {
          this.chooseReturnCard();
          return;
        }
        this.activateCombatChoice(this.controllerChoiceIndex);
      },
      previous: () => {
        if (this.waymarkDrawerOpen) { this.waymarkReviewModule?.battleWaymarkAction(this, 'choose', -1); return; }
        if (this.changeCombatCardDetailPage(-1)) return;
        if (this.rewardInspectionCardId) return;
        if (this.supplyDrawerOpen) {
          this.moveBattleSupplyFocus(-1);
          return;
        }
        if (!this.cycleBattleInspectMode(-1)) this.cycleControllerChoice(-1);
      },
      next: () => {
        if (this.waymarkDrawerOpen) { this.waymarkReviewModule?.battleWaymarkAction(this, 'choose', 1); return; }
        if (this.changeCombatCardDetailPage(1)) return;
        if (this.rewardInspectionCardId) return;
        if (this.supplyDrawerOpen) {
          this.moveBattleSupplyFocus(1);
          return;
        }
        if (!this.cycleBattleInspectMode(1)) this.cycleControllerChoice(1);
      },
      roost: (event) => {
        if (this.supplyDrawerOpen) { if (!event?.repeat) this.battleSupplyDrawerModule?.turnSupplyDrawerPage(this); return; }
        if (this.waymarkDrawerOpen) { this.waymarkReviewModule?.battleWaymarkAction(this, 'pin'); return; }
        if (this.mode === 'waymarkReward') { this.openWaymarkRewardDetail(); return; }
        if (
          (this.mode === 'cardReward' || this.mode === 'upgradeReward')
          && this.rewardPresentationReady()
          && !this.settingsOverlayOpen
          && !this.pauseOverlayOpen
        ) {
          this.toggleFocusedRewardCardInspection();
          return;
        }
        if (this.mode === 'battle' && !this.settingsOverlayOpen && !this.pauseOverlayOpen && !this.inspectOverlay && !this.waymarkDrawerOpen && !this.supplyDrawerOpen) {
          if (this.discardChoice) this.confirmDiscardChoice();
          else if (this.returnChoice) this.chooseReturnCard();
          else this.endTurnAnimated();
        }
      },
      skipReward: (event) => {
        if (event?.shiftKey) { if (!event.repeat) this.toggleBattleWaymarks(); return; }
        this.handleBattleSkipOrRunKit();
      },
      fullscreen: () => this.scale.toggleFullscreen(),
      mute: () => {
        if (!this.fxLayer?.active) return;
        if (!activateRenderedAudioToggleControl(this)) {
          birdAudio.toggleMute();
          if (this.pauseOverlayOpen) this.queueBattleSystemOverlayRender();
          else this.requestBattleRender();
        }
      },
      settings: () => {
        if (!this.fxLayer?.active || isRunOutcome(this.mode)) return;
        if (!this.pauseOverlayOpen) this.setBattlePaused(true);
        if (!this.settingsOverlayOpen) this.openSettingsOverlay();
      },
      pause: () => {
        if (!this.fxLayer?.active) return;
        this.togglePauseOverlay();
      },
    });
    const onTab = (event: KeyboardEvent) => {
      if (controlPanelOwnsInput(this)) return;
      if (controlActionForCode(event.code)) return;
      event.preventDefault?.();
      const direction = event.shiftKey ? -1 : 1;
      if (this.waymarkDrawerOpen) { this.waymarkReviewModule?.battleWaymarkAction(this, 'choose', direction); return; }
      if (this.changeReturnChoiceRulesPage(direction)) return;
      if (this.changeCombatCardDetailPage(direction)) return;
      if (this.supplyDrawerOpen) {
        this.moveBattleSupplyFocus(direction);
        return;
      }
      if (!this.moveCardReviewFocus(direction)) this.cycleControllerChoice(direction);
    };
    const onUp = () => {
      if (controlPanelOwnsInput(this)) return;
      if (controlActionForCode('ArrowUp')) return;
      if (this.waymarkDrawerOpen) { this.waymarkReviewModule?.battleWaymarkAction(this, 'choose', -3); return; }
      if (this.supplyDrawerOpen) {
        this.moveBattleSupplyFocus(-1);
        return;
      }
      if (!this.moveCardReviewFocus(-1)) this.cycleLivingEnemy(-1, true);
    };
    const onDown = () => {
      if (controlPanelOwnsInput(this)) return;
      if (controlActionForCode('ArrowDown')) return;
      if (this.waymarkDrawerOpen) { this.waymarkReviewModule?.battleWaymarkAction(this, 'choose', 3); return; }
      if (this.supplyDrawerOpen) {
        this.moveBattleSupplyFocus(1);
        return;
      }
      if (!this.moveCardReviewFocus(1)) this.cycleLivingEnemy(1, true);
    };
    const onGamepadDown = (_pad: Phaser.Input.Gamepad.Gamepad, button: { index?: number }) => {
      if (consumeSaveRecoveryGamepad(button.index)) return;
      if (controlPanelOwnsInput(this)) return;
      if (this.waymarkDrawerOpen && !this.pauseOverlayOpen && !this.settingsOverlayOpen) {
        if (button.index === 1 || button.index === 7) this.closeBattleWaymarks();
        else if (button.index === 2) this.waymarkReviewModule?.battleWaymarkAction(this, 'pin');
        else if (button.index === 4 || button.index === 5) this.waymarkReviewModule?.battleWaymarkAction(this, 'page', button.index === 4 ? -1 : 1);
        else if (button.index === 12 || button.index === 13) this.waymarkReviewModule?.battleWaymarkAction(this, 'choose', button.index === 12 ? -3 : 3);
        else if (button.index === 14 || button.index === 15) this.waymarkReviewModule?.battleWaymarkAction(this, 'choose', button.index === 14 ? -1 : 1);
        else if (button.index === 9) this.togglePauseOverlay();
        return;
      }
      if (this.rewardInspectionCardId && !this.pauseOverlayOpen && !this.settingsOverlayOpen) {
        if (button.index === 0 || button.index === 1 || button.index === 3) this.closeRewardCardInspection();
        else if (button.index === 4 || button.index === 14) this.changeCombatCardDetailPage(-1);
        else if (button.index === 5 || button.index === 15) this.changeCombatCardDetailPage(1);
        else if (button.index === 9) this.togglePauseOverlay();
        return;
      }
      if (this.combatCardDetail?.active && !this.pauseOverlayOpen && !this.settingsOverlayOpen) {
        if (button.index === 0 || button.index === 1 || button.index === 10 || button.index === 11) this.closeCombatCardDetail();
        else if (button.index === 4 || button.index === 14) this.changeCombatCardDetailPage(-1);
        else if (button.index === 5 || button.index === 15) this.changeCombatCardDetailPage(1);
        else if (button.index === 9) this.togglePauseOverlay();
        return;
      }
      switch (button.index) {
        case 7: this.toggleBattleWaymarks(); break; // RT: owned Waymarks
        case 0:
          if (!this.requestBattleIntroDismiss()) {
            if (this.rewardInspectionCardId) this.closeRewardCardInspection();
            else if (this.outcomeDetailsOpen) this.closeOutcomeFlightDetails();
            else if (this.supplyDrawerOpen) this.requestBattleSupplyUse(this.supplyDrawerFocusIndex);
            else if (this.mode === 'cardReward' && this.rewardSkipArmed) return;
            else this.activateCombatChoice(this.controllerChoiceIndex);
          }
          break; // A
        case 1: this.handleBattleBack(); break; // B
        case 2: // X
          this.handleBattleSkipOrRunKit();
          break;
        case 3: // Y
          if (this.supplyDrawerOpen) { this.battleSupplyDrawerModule?.turnSupplyDrawerPage(this); break; }
          if (this.mode === 'waymarkReward') { this.openWaymarkRewardDetail(); break; }
          if (
            (this.mode === 'cardReward' || this.mode === 'upgradeReward')
            && this.rewardPresentationReady()
            && !this.settingsOverlayOpen
            && !this.pauseOverlayOpen
          ) this.toggleFocusedRewardCardInspection();
            else if (this.mode === 'battle' && this.discardChoice) this.confirmDiscardChoice();
            else if (this.mode === 'battle' && this.returnChoice) this.chooseReturnCard();
            else if (this.mode === 'battle' && !this.combatInteractionLocked()) this.endTurnAnimated();
          break;
        case 4:
          if (this.changeReturnChoiceRulesPage(-1)) break;
          if (!this.moveCardReviewFocus(-1, true)) this.cycleLivingEnemy(-1, true);
          break; // L1
        case 5:
          if (this.changeReturnChoiceRulesPage(1)) break;
          if (!this.moveCardReviewFocus(1, true)) this.cycleLivingEnemy(1, true);
          break; // R1
        case 9: this.togglePauseOverlay(); break; // Start
        case 11: this.toggleCombatCardDetail(); break; // R3: contextual card help
        case 10: this.openCombatHistory(); break; // L3: recent combat history
        case 12:
          if (this.supplyDrawerOpen) this.moveBattleSupplyFocus(-1);
          else if (!this.moveCardReviewFocus(-1)) this.cycleLivingEnemy(-1, true);
          break; // D-pad up
        case 13:
          if (this.supplyDrawerOpen) this.moveBattleSupplyFocus(1);
          else if (!this.moveCardReviewFocus(1)) this.cycleLivingEnemy(1, true);
          break; // D-pad down
        case 14:
          if (this.supplyDrawerOpen) this.moveBattleSupplyFocus(-1);
          else if (!this.cycleBattleInspectMode(-1)) this.cycleControllerChoice(-1);
          break; // D-pad left
        case 15:
          if (this.supplyDrawerOpen) this.moveBattleSupplyFocus(1);
          else if (!this.cycleBattleInspectMode(1)) this.cycleControllerChoice(1);
          break; // D-pad right
      }
    };
    this.input.keyboard?.on('keydown-TAB', onTab);
    this.input.keyboard?.on('keydown-UP', onUp);
    this.input.keyboard?.on('keydown-DOWN', onDown);
    const onWaymarkKey = (event: KeyboardEvent) => {
      if (!this.waymarkDrawerOpen || controlActionForCode(event.code)) return;
      if (event.code === 'PageUp' || event.code === 'PageDown') {
        if (this.pauseOverlayOpen || this.settingsOverlayOpen) return;
        event.preventDefault();
        this.waymarkReviewModule?.battleWaymarkAction(this, 'page', event.code === 'PageUp' ? -1 : 1);
      } else if (event.code === 'KeyC') this.waymarkReviewModule?.battleWaymarkAction(this, 'pin');
    };
    this.input.keyboard?.on('keydown', onWaymarkKey);
    this.input.gamepad?.on('down', onGamepadDown);
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown-TAB', onTab);
      this.input.keyboard?.off('keydown-UP', onUp);
      this.input.keyboard?.off('keydown-DOWN', onDown);
      this.input.keyboard?.off('keydown', onWaymarkKey);
      this.input.gamepad?.off('down', onGamepadDown);
      this.combatCardDetail?.destroy(true);
      this.combatCardDetail = undefined;
    });
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      if (!deltaY || !this.fxLayer?.active || this.pauseOverlayOpen || this.settingsOverlayOpen) return;
      if (this.changeReturnChoiceRulesPage(deltaY > 0 ? 1 : -1)) return;
      if (this.changeCombatCardDetailPage(deltaY > 0 ? 1 : -1)) return;
      if (this.waymarkDrawerOpen) {
        if (this.waymarkReviewModule?.handleWaymarkWheel(this, _pointer, deltaY)) return;
        this.scrollWaymarkDrawer(deltaY > 0 ? 1 : -1);
        return;
      }
      if (this.supplyDrawerOpen) return;
      if (!this.inspectOverlay || this.inspectOverlay === 'flock') return;
      this.scrollCardReview(deltaY > 0 ? 1 : -1);
    });

    window.__birdSquadState = () => this.getTextState();
    window.__birdSquadExportRuns = () => JSON.stringify(loadRunHistory());
    window.render_game_to_text = () => JSON.stringify(this.getTextState());
    window.advanceTime = (ms: number) => advanceGameTime(this.game, ms);

  }

  private cycleControllerChoice(direction: -1 | 1) {
    if (this.combatCardDetail?.active) return;
    if (this.rewardInspectionCardId || this.outcomeDetailsOpen || this.settingsOverlayOpen || this.pauseOverlayOpen || this.inspectOverlay || this.waymarkDrawerOpen || this.supplyDrawerOpen) return;
    if (this.mode === 'battle' && this.returnChoice) {
      this.returnChoiceModule?.moveReturnChoice(this, direction);
      return;
    }
    if (this.mode === 'battle' && this.discardChoice) {
      const candidates = this.discardChoiceModule?.candidateHandIndices(
        this.discardChoice.candidateIds,
        this.hand.map((card) => card.instanceId),
      ) ?? [];
      if (candidates.length === 0) return;
      const current = candidates.indexOf(this.controllerChoiceIndex);
      this.controllerChoiceIndex = candidates[(current < 0 ? 0 : current + direction + candidates.length) % candidates.length];
      this.battleInputActive = true;
      playUiSound('confirm');
      this.requestBattleRender();
      return;
    }
    const count = this.combatChoiceCount();
    if (count <= 0) return;
    const enteringCardsFromSkip = this.mode === 'cardReward' && this.rewardSkipArmed && !this.battleInputActive;
    this.rewardSkipArmed = false;
    this.battleInputActive = true;
    this.controllerChoiceIndex = enteringCardsFromSkip
      ? direction > 0 ? 0 : count - 1
      : (this.controllerChoiceIndex + direction + count) % count;
    if (this.mode === 'battle') {
      this.selectedInstanceId = this.hand[this.controllerChoiceIndex]?.instanceId;
    } else {
      this.battleHandRendererModule?.armCombatRewardAt(this, this.controllerChoiceIndex);
    }
    playUiSound('confirm');
    this.requestBattleRender();
  }

  private combatChoiceCount() {
    if (this.outcomeDetailsOpen) return 1;
    if (this.mode === 'battle' && this.returnChoice) return this.returnChoice.candidateIds.length;
    if (this.mode === 'battle') return this.hand.length;
    if (this.mode === 'waymarkReward') return this.waymarkChoices.length;
    if (this.mode === 'cardReward') return this.rewardChoices.length;
    if (this.mode === 'upgradeReward') return this.upgradeChoices.length;
    if (isRunOutcome(this.mode)) return this.outcomeInputActions().length;
    return 0;
  }

  private normalizeCombatChoiceIndex() {
    const count = this.combatChoiceCount();
    this.controllerChoiceIndex = count > 0
      ? Phaser.Math.Clamp(Math.round(this.controllerChoiceIndex), 0, count - 1)
      : 0;
    return this.controllerChoiceIndex;
  }

  private requestRewardChoice(choiceId: string) {
    if (this.combatCardDetail?.active) return;
    this.battleHandRendererModule?.requestCombatReward(this, choiceId, () => playUiSound('confirm'));
  }

  private combatInputFocusState(): NonNullable<RenderPayload['combatInputFocus']> {
    const index = this.normalizeCombatChoiceIndex();
    const count = this.combatChoiceCount();
    const returnCard = this.mode === 'battle' && this.returnChoice
      ? this.discardPile.find((candidate) => candidate.instanceId === this.returnChoice!.candidateIds[index])
      : undefined;
    const card = this.mode === 'battle' && !this.returnChoice ? this.hand[index] : undefined;
    const reward = this.mode === 'cardReward' ? this.rewardChoices[index] : undefined;
    const upgrade = this.mode === 'upgradeReward' ? this.upgradeChoices[index] : undefined;
    const waymark = this.mode === 'waymarkReward' ? this.waymarkChoices[index] : undefined;
    const outcome = isRunOutcome(this.mode)
      ? this.outcomeDetailsOpen
        ? { label: 'Close Flight Details' }
        : this.outcomeInputActions()[index]
      : undefined;
    const enemy = this.enemies.find((candidate) => candidate.id === this.selectedEnemyId && candidate.hp > 0);
    const kind: CombatInputChoiceKind | undefined = this.mode === 'battle'
      ? this.returnChoice ? 'returnChoice' : 'card'
      : this.mode === 'cardReward' || this.mode === 'upgradeReward' || this.mode === 'waymarkReward'
        ? this.mode
        : isRunOutcome(this.mode)
          ? 'outcome'
        : undefined;
    return {
      active: this.battleInputActive,
      kind,
      index: count > 0 ? index : undefined,
      count,
      handPage: this.mode === 'battle' && this.hand.length > 5 ? {
        page: this.handPage + 1, pages: Math.ceil(this.hand.length / 5),
        first: this.handPage * 5 + 1, last: Math.min(this.hand.length, this.handPage * 5 + 5),
      } : undefined,
      label: returnCard ? displayName(returnCard) : card ? displayName(card) : reward ? displayName(reward) : upgrade ? displayName(upgrade) : waymark?.name ?? outcome?.label,
      target: this.mode === 'battle' && !this.returnChoice ? enemy?.name : undefined,
      visibleFocus: this.battleInputActive && (
        this.mode === 'battle'
          ? this.returnChoice
            ? this.root?.list.some((child) => child.name === 'combat-return-choice-row' && child.getData('focused') === true) ?? false
            : Boolean(this.selectedInstanceId && this.hand.some((candidate) => candidate.instanceId === this.selectedInstanceId))
          : isRunOutcome(this.mode)
            ? this.root?.list.some((child) => child.name === (
              this.outcomeDetailsOpen
                ? 'run-flight-details-input-focus-ring'
                : 'run-outcome-input-focus-ring'
            )) ?? false
          : this.root?.list.some((child) => child.name === 'reward-input-focus-ring') ?? false
      ),
      bindings: {
        previous: controlBindingLabel('previous'),
        next: controlBindingLabel('next'),
        confirm: controlBindingLabel('confirm'),
        roost: controlBindingLabel('roost'),
        pause: controlBindingLabel('pause'),
        history: `Shift+${controlBindingLabel('guide')} / L3`,
      },
      controller: {
        choose: 'D-pad Left / Right',
        target: 'D-pad Up / Down or L1 / R1',
        play: 'A',
        back: 'B',
        pause: 'Start',
        roost: 'Y',
      },
    };
  }

  private activateCombatChoice(index: number) {
    if (this.combatCardDetail?.active) return;
    if (!this.fxLayer?.active || this.rewardInspectionCardId || this.settingsOverlayOpen || this.pauseOverlayOpen || this.inspectOverlay || this.waymarkDrawerOpen || this.supplyDrawerOpen) return;
    if (this.outcomeDetailsOpen) {
      this.closeOutcomeFlightDetails();
      return;
    }
    if (isRunOutcome(this.mode)) {
      const actions = this.outcomeInputActions();
      const normalized = Phaser.Math.Clamp(Math.round(index), 0, Math.max(0, actions.length - 1));
      this.controllerChoiceIndex = normalized;
      this.battleInputActive = true;
      actions[normalized]?.activate();
      return;
    }
    if (this.mode === 'battle' && this.returnChoice) {
      const normalized = Phaser.Math.Clamp(Math.round(index), 0, Math.max(0, this.returnChoice.candidateIds.length - 1));
      this.returnChoice.focusIndex = normalized;
      this.controllerChoiceIndex = normalized;
      this.battleInputActive = true;
      this.chooseReturnCard(this.returnChoice.candidateIds[normalized]);
      return;
    }
    if ((this.mode === 'waymarkReward' || this.mode === 'cardReward' || this.mode === 'upgradeReward') && !this.rewardPresentationReady()) return;
    this.battleInputActive = true;
    this.controllerChoiceIndex = Math.max(0, index);
    if (this.battleHandRendererModule?.requestCombatRewardAt(this, index, () => playUiSound('confirm'))) return;
    const card = this.hand[index];
    if (card) this.onCardClicked(card.instanceId);
  }

  private cycleLivingEnemy(direction: -1 | 1, inputFeedback = false) {
    if (this.mode !== 'battle' || this.combatInteractionLocked() || this.supplyDrawerOpen || this.waymarkDrawerOpen) return;
    const living = this.enemies.filter((enemy) => enemy.hp > 0);
    if (living.length <= 1) return;
    const current = living.findIndex((enemy) => enemy.id === this.selectedEnemyId);
    this.selectedEnemyId = living[(current < 0 ? 0 : current + direction + living.length) % living.length].id;
    if (inputFeedback) {
      this.battleInputActive = true;
      playUiSound('confirm');
    }
    this.requestBattleRender();
  }

  private finishCombatCreate() {
    if (!this.sys.settings.active || !this.root?.active) return;
    if (!this.battleEssentialUiReady || !this.battleCoreUiReady || !this.combatFxReady || !this.battleFxPresenterReady || !this.battleDebugStateReady || !this.battleBackdropRendererReady || !this.battleForegroundRendererReady || !this.battleHudRendererReady || !this.battleHandRendererReady || !this.discardChoiceModuleReady || !this.returnChoiceModuleReady) return;
    if (this.fxLayer?.active) return;
    this.fxLayer = this.add.container(0, 0);
    this.ensureFxTextures();
    if (this.rewardResume) {
      const stage = this.rewardResume.stage;
      this.rewardResume = undefined;
      this.queueBattleRewardUiLoad();
      this.battleAssetReadiness.markInteractive();
      this.queueBattleFullArtTracking();
      if (stage === 'route') this.returnToRouteMap();
      else {
        this.saveRewardCheckpoint(stage);
        this.renderAll();
      }
      return;
    }
    this.applyCombatStartMarks(); // relic effects need fxLayer, so fire after create()
    this.renderAll();
    this.queueBattleFullArtTracking();
    this.playBattleIntro(() => {
      if (!this.sys.settings.active || this.mode !== 'battle') return;
      this.combatAnimationPending = false;
      this.battleAssetReadiness.markInteractive();
      this.markBattleFullArtReady();
      this.renderAll();
    });
  }

  private queueBattleFullArtTracking() {
    if (this.battleFullArtTrackingStarted) return;
    this.battleFullArtTrackingStarted = true;
    const settle = (group: string) => (result: RuntimeImageLoadResult) => {
      if (!this.sys.settings.active) return;
      this.battleAssetReadiness.settle(group, result);
      this.markBattleFullArtReady();
    };
    this.queueOptionalArtLoad(settle('battle-current-art'));
    this.queueEnemyTurnCombatFxAssetLoad(settle('battle-enemy-turn-fx'));
    this.queueOptionalCombatFxAssetLoad(settle('battle-optional-fx'));
    if (this.battleFullArtGroups.includes('battle-outcome-fx')) {
      this.queueOutcomeCombatFxAssetLoad(settle('battle-outcome-fx'));
    }
  }

  private markBattleFullArtReady() {
    if (!this.battleFullArtGroups.every((group) => this.battleAssetReadiness.groupSettled(group))) return;
    this.battleAssetReadiness.markFullArt();
  }

  private renderBattleReadinessScreen() {
    this.root.removeAll(true);
    const battlefield = this.currentBattlefieldAsset();
    if (this.textures.exists(battlefield.key)) {
      this.root.add(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, battlefield.key)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(0.78));
    } else {
      this.root.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x08101d, 1));
    }
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020711, 0.72));
    this.root.add(this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 38, 34, 0x07131d, 0.96)
      .setStrokeStyle(3, UI_FIELD.danger, 0.88));
    this.root.add(this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 38, 15, UI_FIELD.gold, 0.9)
      .setStrokeStyle(2, 0x07131d, 0.9));
    this.root.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 22, 'Flock taking position...', {
      fontFamily: TOKEN_DISPLAY_FONT,
      fontSize: '28px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5));
    this.root.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 62, 'Reading the threat and setting the first beat.', {
      fontFamily: UI_FONT,
      fontSize: '14px',
      color: UI_CYAN
    }).setOrigin(0.5));
  }

  private ensureFxTextures() {
    if (!this.textures.exists(COMBAT_FX_PARTICLE_TEXTURE)) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillRect(3, 0, 2, 8);
      g.fillRect(0, 3, 8, 2);
      g.fillStyle(0xffffff, 0.72);
      g.fillRect(2, 2, 4, 4);
      g.generateTexture(COMBAT_FX_PARTICLE_TEXTURE, 8, 8);
      g.destroy();
    }
    if (!this.textures.exists(COMBAT_FX_TEXTURE)) return;
    const create = (key: string, start: number, end: number, frameRate = 18) => {
      if (this.anims.exists(key)) return;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(COMBAT_FX_TEXTURE, { start, end }),
        frameRate,
        repeat: 0,
      });
    };
    create('fx-plumes', 0, 5, 20);
    create('fx-quills', 6, 11, 22);
    create('fx-basins', 12, 17, 16);
    create('fx-nests', 18, 23, 16);
    create('fx-heal', 24, 29, 16);
    create('fx-winded', 30, 35, 18);
    create('fx-open-sky', 36, 41, 18);
    create('fx-hostile', 42, 47, 20);
  }

private playBattleIntro(onComplete?: () => void) {
    if (this.introPlayed) { onComplete?.(); return; }
    this.introPlayed = true;
    if (!this.battleFxPresenterModule) { onComplete?.(); return; }
    const textTiming = textPacingState();
    setFeedbackTextHoldScale(textTiming.holdScale);
    this.combatIntroActive = true;
    this.combatIntroDismissQueued = false;
    this.combatIntroDismissed = false;
    this.combatIntroStartedAtMs = this.time.now;
    this.combatIntroElapsedMs = 0;
    if (this.textures.exists(COMBAT_ENCOUNTER_INTRO_TEXTURE)) this.combatEncounterIntroBursts += 1;
    birdAudio.play('encounter', 0.72);
    this.setBattleFxDepth(200);
    this.combatIntroFinish = this.battleFxPresenterModule.playEncounterIntro(this, this.fxLayer, {
      reduced: prefersReducedMotion(), holdScale: textTiming.holdScale, minimumReadableMs: textTiming.minimumReadableMs,
      width: GAME_WIDTH, height: GAME_HEIGHT, district: currentMap().name,
      enemies: this.enemies.map(enemy => enemy.runtime.id),
      purpose: this.battlefieldMood() === 'rival' && this.flyway.rivalWins<3 ? rivalChapter(this.flyway.rivalWins).weakness : activeMapIndex >= 1 ? alphaEncounterLibrary.get(currentCombatNodes()[this.currentRouteIndex]?.payloadId)?.lesson : undefined,
      encounter: this.battlefieldMood() === 'rival' && this.flyway.rivalWins<3 ? `Caldra · ${rivalChapter(this.flyway.rivalWins).name}` : this.enemies.find(enemy => enemy.runtime.type === 'boss')?.name ?? (activeMapIndex === 1 || activeMapIndex === 2 ? alphaEncounterLibrary.get(currentCombatNodes()[this.currentRouteIndex]?.payloadId)?.name : undefined) ?? currentCombatNodes()[this.currentRouteIndex]?.label ?? 'Rooftop Fight',
      confirm: controlBindingLabel('confirm'), texture: COMBAT_ENCOUNTER_INTRO_TEXTURE,
      plaque: uiIconAssets['combat-encounter-plaque'].key,
      font: UI_FONT, displayFont: TOKEN_DISPLAY_FONT, bold: UI_BOLD, gold: UI_GOLD, cyan: UI_CYAN, soft: UI_SOFT,
      dismiss: () => this.requestBattleIntroDismiss(),
      finish: (dismissed) => {
        this.combatIntroActive = false;
        this.setBattleFxDepth(20);
        this.combatIntroDismissed = dismissed;
        this.combatIntroElapsedMs = Math.max(0, Math.round(this.time.now - this.combatIntroStartedAtMs));
        this.combatIntroFinish = undefined;
        onComplete?.();
      },
      accent: () => {
        this.fxMoteBurst(GAME_WIDTH / 2, 356, 0x8df4ff, {
          count: 18, speed: 122, lifespan: 620, scale: 0.6, gravityY: 0, spreadX: 260, spreadY: 44,
        });
        this.pulseRing(FLOCK_FX_X, FLOCK_FX_Y, 0x8df4ff, 92, 720);
      },
    });
  }

  private requestBattleIntroDismiss() {
    if (!this.combatIntroActive || !this.combatIntroFinish) return false;
    if (this.combatIntroDismissQueued) return true;
    this.combatIntroDismissQueued = true;
    playUiSound('confirm');
    const elapsed = Math.max(0, this.time.now - this.combatIntroStartedAtMs);
    const remaining = Math.max(0, textPacingState().minimumReadableMs - elapsed);
    if (remaining <= 0) {
      this.combatIntroFinish();
      return true;
    }
    this.time.delayedCall(remaining, () => {
      if (this.combatIntroActive && this.combatIntroDismissQueued) this.combatIntroFinish?.();
    });
    return true;
  }

  private requestBattleRender() {
    this.battleRenderRequests += 1;
    if (this.battleRenderQueued) {
      this.battleRenderCoalesced += 1;
      return;
    }
    this.battleRenderQueued = true;
    const token = ++this.battleRenderScheduleToken;
    const rewardMode = this.mode === 'cardReward' || this.mode === 'upgradeReward' || this.mode === 'waymarkReward'
      || isRunOutcome(this.mode);
    // Reward and outcome redraws replace all hit targets. Rebuild before InputPlugin flushes
    // its registration queue so visible buttons are clickable in the same frame.
    const emitter = rewardMode ? this.game.events : this.events;
    const event = rewardMode ? Phaser.Core.Events.PRE_STEP : Phaser.Scenes.Events.POST_UPDATE;
    const cancel = () => emitter.off(event, render);
    const render = () => {
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
      if (!this.battleRenderQueued || token !== this.battleRenderScheduleToken) return;
      this.battleRenderQueued = false;
      this.performBattleRender();
    };
    emitter.once(event, render);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
  }

  private renderAll() {
    this.battleRenderRequests += 1;
    if (this.battleRenderQueued) {
      this.battleRenderQueued = false;
      this.battleRenderScheduleToken += 1;
      this.battleRenderCoalesced += 1;
    }
    this.performBattleRender();
  }

  private setBattleFxDepth(depth: number) {
    this.fxLayer.setDepth(this.combatIntroActive ? 200 : this.mode === 'battle' ? 20 : depth);
  }

  private performBattleRender() {
    if (!this.root?.active) return;
    const startedAt = performance.now();
    try {
      if (this.pauseOverlayOpen) {
        this.renderBattleSystemOverlay();
        return;
      }
      hideKwTooltip();
      setEnemyMoveContext(this.enemyContext()); // keep conditional intents live
      this.normalizeSelectedEnemy();
      this.updateFormationFx();
      this.updateEncounterObjectiveFeedback();
      const modalUiOpen = Boolean(
        this.inspectOverlay
        || this.waymarkDrawerOpen
        || this.supplyDrawerOpen
      );
      this.backdropLayer.setDepth(-20);
      this.setBattleFxDepth(20);
      // Readable decisions stay above transient effects, including boss breaks.
      // Battlefield art remains grounded; effects surround it without covering Tells.
      this.root.setDepth(40);
      // Retained combatant bodies step out before the immediate layer is cleared.
      this.battleForegroundRendererModule?.parkBattleActors(this.root);
      killTweensForTree(this, this.root);
      this.enemyPoseGroups.clear();
      this.enemyTurnBeatUi = undefined;
      this.root.removeAll(true);
      this.selectionOutcomePreview = undefined;
      if (this.inspectOverlay || this.waymarkDrawerOpen || this.supplyDrawerOpen) {
        this.fxLayer.removeAll(true);
        this.activeGeneratedFxSprites = 0;
        this.activeFxParticleBursts = 0;
      }
      this.ensureBattlefieldBackdrop();
      const ceremonyMode = this.mode === 'waymarkReward' || this.mode === 'cardReward' || this.mode === 'upgradeReward';
      if (ceremonyMode) {
        this.clearPersistentHand();
        this.renderRewardCeremony();
        this.renderCombatInputHint();
        this.renderRewardCardInspection();
        this.setBattleFxDepth(80);
        this.children.bringToTop(this.fxLayer);
        return;
      }
      if (isRunOutcome(this.mode)) {
        this.clearPersistentHand();
        this.renderOutcome();
        // Outcome reveal motion belongs between the dimmed battlefield and the
        // report. Keeping the report above this layer prevents even an opaque
        // animation frame from masking the title, diagnosis, stats, or actions.
        this.setBattleFxDepth(10);
        this.root.setDepth(20);
        this.children.bringToTop(this.root);
        return;
      }
      this.handLayer.setVisible(true);
      this.renderTopBar();
      this.renderBattleForeground();
      this.renderBattleHudPiles();
      this.renderHand();
      this.renderSupplyFeedbackStrip();
      this.renderBattleHudOverlay();
      this.renderSelectedCardOutcomePreview();
      if (!modalUiOpen) this.renderCombatInputHint();
      if (this.inspectOverlay) this.renderInspectOverlay(this.inspectOverlay);
      if (this.waymarkDrawerOpen) this.renderWaymarkDrawer();
      if (this.supplyDrawerOpen) this.renderSupplyDrawer();
      this.events.emit('battle-hud-rendered');
      if (!modalUiOpen) {
        this.setBattleFxDepth(80);
        this.children.bringToTop(this.fxLayer);
        const selected = this.getSelectedCard();
        if (selected && !this.discardChoice && !this.returnChoice) this.showCardPreview(selected);
      }
    } finally {
      const elapsed = performance.now() - startedAt;
      this.battleRenderPasses += 1;
      this.battleRenderLastMs = elapsed;
      this.battleRenderMaxMs = Math.max(this.battleRenderMaxMs, elapsed);
      this.battleRenderTotalMs += elapsed;
    }
  }

  private ensureBattlefieldBackdrop() {
    const battlefield = this.currentBattlefieldAsset();
    const renderKey = `${battlefield.key}:${this.textures.exists(battlefield.key) ? 'loaded' : 'fallback'}:${activeMapIndex}:${this.battlefieldMood()}`;
    if (this.backdropRenderKey === renderKey && this.backdropLayer?.active) {
      this.battleBackdropReuses += 1;
      return;
    }
    killTweensForTree(this, this.backdropLayer);
    this.backdropLayer.removeAll(true);
    this.backdropRenderKey = renderKey;
    this.battleBackdropBuilds += 1;
    this.renderBackdrop();
  }

  private renderBackdrop() {
    const battlefield = this.currentBattlefieldAsset();
    if (this.battleBackdropRendererModule) {
      this.battleBackdropRendererModule.renderBattleBackdrop({
        scene: this,
        target: this.backdropLayer,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        battlefieldTextureKey: battlefield.key,
        atmosphereTextureKey: COMBAT_ATMOSPHERE_TEXTURE,
        mapIndex: activeMapIndex,
        mood: this.battlefieldMood(),
        leanEffects: graphicsQualityState().lean,
        reducedMotion: prefersReducedMotion()
      });
      return;
    }

    // Degraded but playable fallback for a failed optional render chunk.
    if (this.textures.exists(battlefield.key)) {
      this.backdropLayer.add(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, battlefield.key)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(0.82));
    } else {
      this.backdropLayer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f1b2a));
    }
  }

  private battlefieldMood(): 'street' | 'rival' | 'boss' {
    const type = this.currentRouteNode()?.type;
    if (type === 'boss') return 'boss';
    if (type === 'rival') return 'rival';
    return 'street';
  }

  private battleFxPresentationHost(): BattleFxPresentationHost {
    const battle = this;
    return {
      scene: this,
      layer: this.fxLayer,
      reducedMotion: prefersReducedMotion(),
      leanEffects: prefersLeanEffects(),
      particleQuality: graphicsQualityState(),
      get activeParticleBursts() {
        return battle.activeFxParticleBursts;
      },
      setActiveParticleBursts(value) {
        battle.activeFxParticleBursts = value;
      },
      onActionTrailRendered() {
        battle.combatActionTrailBursts += 1;
      },
    };
  }

  private playFxAnimation(
    animKey: string,
    x: number,
    y: number,
    options: BattleFxAnimationOptions = {}
  ) {
    return this.battleFxPresenterModule?.playBattleFxAnimation(
      this.battleFxPresentationHost(),
      COMBAT_FX_TEXTURE,
      animKey,
      x,
      y,
      options,
    );
  }

  private fxMoteBurst(
    x: number,
    y: number,
    color: number,
    options: BattleFxMoteOptions = {}
  ) {
    this.battleFxPresenterModule?.presentBattleFxMoteBurst(
      this.battleFxPresentationHost(),
      COMBAT_FX_PARTICLE_TEXTURE,
      x,
      y,
      color,
      options,
    );
  }

  private fxShardSweep(x: number, y: number, color: number, direction: 1 | -1, count = 10) {
    this.battleFxPresenterModule?.presentBattleFxShardSweep(
      this.battleFxPresentationHost(),
      COMBAT_FX_PARTICLE_TEXTURE,
      x,
      y,
      color,
      direction,
      count,
    );
  }

  private fxGlowPulse(x: number, y: number, color: number, radius = 72, duration = 360, alpha = 0.2) {
    this.battleFxPresenterModule?.presentBattleFxGlowPulse(
      this.battleFxPresentationHost(),
      x,
      y,
      color,
      radius,
      duration,
      alpha,
    );
  }

  private fxShockwave(x: number, y: number, color: number, radius = 86, duration = 430, tilt = -8) {
    this.battleFxPresenterModule?.presentBattleFxShockwave(
      this.battleFxPresentationHost(),
      x,
      y,
      color,
      radius,
      duration,
      tilt,
    );
  }

  private combatImpactFlash(x: number, y: number, color: number, direction: 1 | -1 = 1, heavy = false) {
    return this.combatFxModule?.combatImpactFlash.call(this, x, y, color, direction, heavy);
  }

  private combatPlayerHitConfirm(x: number, y: number, color: number, heavy = false) {
    return this.combatFxModule?.combatPlayerHitConfirm.call(this, x, y, color, heavy);
  }

  private combatPlayerCommitSigil(card: Card, enemyId: string, contract: ActiveCardContract, holdMs: number) {
    return this.combatFxModule?.combatPlayerCommitSigil.call(this, card, enemyId, contract, holdMs);
  }

  private combatFlockImpactBurst(x: number, y: number, heavy = false) {
    return this.combatFxModule?.combatFlockImpactBurst.call(this, x, y, heavy);
  }

  private combatEnemyImpactContact(x: number, y: number, fromX: number, heavy = false) {
    return this.combatFxModule?.combatEnemyImpactContact.call(this, x, y, fromX, heavy);
  }

  private combatEnemySwipe(fromX: number, fromY: number, toX: number, toY: number, heavy = false) {
    return this.combatFxModule?.combatEnemySwipe.call(this, fromX, fromY, toX, toY, heavy);
  }

  private combatCoverGuard(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatCoverGuard.call(this, x, y, scale);
  }

  private combatCoverBlockBurst(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatCoverBlockBurst.call(this, x, y, scale);
  }

  private combatEnemyCoverBlock(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatEnemyCoverBlock.call(this, x, y, scale);
  }

  private combatPerfectBraceRiposte(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatPerfectBraceRiposte.call(this, x, y, scale);
  }

  private combatPinnedOpeningStrike(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatPinnedOpeningStrike.call(this, x, y, scale);
  }

  private combatGeneratedFx(
    textureKey: string,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: {
      alpha?: number;
      glowAlpha?: number;
      tint?: number;
      angle?: number;
      additive?: boolean;
      lifeMs?: number;
      reducedLifeMs?: number;
      delayMs?: number;
      scaleOut?: number;
      driftX?: number;
      driftY?: number;
    } = {}
  ) {
    return this.combatFxModule?.combatGeneratedFx.call(this, textureKey, name, x, y, width, height, options);
  }

  private combatOverextensionWarning(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatOverextensionWarning.call(this, x, y, scale);
  }

  private combatBossPhaseBreak(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatBossPhaseBreak.call(this, x, y, scale);
  }

  private combatStatusCleanseSpecific(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatStatusCleanseSpecific.call(this, x, y, scale);
  }

  private combatOpenSkyBreak(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatOpenSkyBreak.call(this, x, y, scale);
  }

  private combatCacheChoiceReveal(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatCacheChoiceReveal.call(this, x, y, scale);
  }

  private combatMoltTriggerChoice(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatMoltTriggerChoice.call(this, x, y, scale);
  }

  private combatEnemyHeavyContact(x: number, y: number, fromX: number, scale = 1) {
    return this.combatFxModule?.combatEnemyHeavyContact.call(this, x, y, fromX, scale);
  }

  private combatEnemyHealBeam(fromX: number, fromY: number, toX: number, toY: number, scale = 1) {
    return this.combatFxModule?.combatEnemyHealBeam.call(this, fromX, fromY, toX, toY, scale);
  }

  private combatResourceOvercap(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatResourceOvercap.call(this, x, y, scale);
  }

  private combatFourSuitRally(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatFourSuitRally.call(this, x, y, scale);
  }

  private combatHealBloom(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatHealBloom.call(this, x, y, scale);
  }

  private combatOverflowShelter(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatOverflowShelter.call(this, x, y, scale);
  }

  private combatFormationShift(state: FlockState, x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatFormationShift.call(this, state, x, y, scale);
  }

  private combatEnemyMend(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatEnemyMend.call(this, x, y, scale);
  }

  private combatEnemyCover(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatEnemyCover.call(this, x, y, scale);
  }

  private combatEnemySupportCue(x: number, y: number, scale: number, texture: string, name: string) {
    return this.combatFxModule?.combatEnemySupportCue.call(this, x, y, scale, texture, name);
  }

  private combatCoverShatter(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatCoverShatter.call(this, x, y, scale);
  }

  private combatCardDraw(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatCardDraw.call(this, x, y, scale);
  }

  private combatDiscardSweep(x: number, y: number, scale = 1, count = 1) {
    return this.combatFxModule?.combatDiscardSweep.call(this, x, y, scale, count);
  }

  private combatShuffleVortex(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatShuffleVortex.call(this, x, y, scale);
  }

  private combatFouledPressure(x: number, y: number, scale = 1, tick = false) {
    return this.combatFxModule?.combatFouledPressure.call(this, x, y, scale, tick);
  }

  private fouledPressureFx(value: number, tick = false) {
    const x = FLOCK_FX_X - 4;
    const y = FLOCK_FX_Y + (tick ? 12 : -4);
    if (!tick && this.statusAccentActive('combat-fouled-pressure', x)) return;
    const scale = tick ? Phaser.Math.Clamp(0.9 + value * 0.05, 0.95, 1.18)
      : Phaser.Math.Clamp(0.76 + value * 0.04, 0.82, 1.02);
    this.combatFouledPressure(x, y, scale, tick);
    if (tick) this.sparkBurst(x, y + 12, 0x8bd2a0, Phaser.Math.Clamp(10 + value * 3, 12, 24), 150);
  }

  private combatRuffledBreak(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatRuffledBreak.call(this, x, y, scale);
  }

  private ruffledBreakFx(value: number) {
    const x = FLOCK_FX_X - 4;
    const y = FLOCK_FX_Y - 12;
    if (this.statusAccentActive('combat-ruffled-break', x)) return;
    const scale = Phaser.Math.Clamp(0.78 + value * 0.04, 0.82, 1.02);
    this.combatRuffledBreak(x, y, scale);
  }

  private statusAccentActive(name: string, x: number) {
    return this.fxLayer.list.some(object => object.name === name
      && Math.abs((object as Phaser.GameObjects.Image).x - x) < 24);
  }

  private combatResonanceSurge(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatResonanceSurge.call(this, x, y, scale);
  }

  private combatResonanceSpend(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatResonanceSpend.call(this, x, y, scale);
  }

  private combatSparkEcho(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatSparkEcho.call(this, x, y, scale);
  }

  private combatWingbeatSurge(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatWingbeatSurge.call(this, x, y, scale);
  }

  private wingbeatGainFx(amount: number) {
    if (amount <= 0) return;
    const x = FLOCK_FX_X - 10;
    const y = FLOCK_FX_Y - 48;
    const scale = Phaser.Math.Clamp(0.84 + amount * 0.08, 0.92, 1.18);
    this.combatWingbeatSurge(x, y, scale);
    this.sparkBurst(x, y + 12, 0xffcf7a, Phaser.Math.Clamp(10 + amount * 3, 12, 22), 132);
  }

  private combatWingbeatDrain(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatWingbeatDrain.call(this, x, y, scale);
  }

  private wingbeatDrainFx(amount: number, label = ' Wingbeat') {
    if (amount <= 0) return;
    const x = FLOCK_FX_X - 10;
    const y = FLOCK_FX_Y - 48;
    const scale = Phaser.Math.Clamp(0.88 + amount * 0.08, 0.94, 1.22);
    birdAudio.play('drain', Math.min(1.3, 0.72 + amount * 0.16));
    this.combatWingbeatDrain(x, y + 2, scale);
    this.fxMoteBurst(x, y + 10, 0xffcf7a, {
      count: Phaser.Math.Clamp(10 + amount * 4, 12, 28),
      speed: 155,
      lifespan: 420,
      scale: 0.72,
      gravityY: -8,
      spreadX: 10,
      spreadY: 8,
    });
    this.presentFlockResult(-amount, label, '#ffcf7a', 'wingbeat-drain');
  }

  private combatMoltShift(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatMoltShift.call(this, x, y, scale);
  }

  private combatOpenSkyGuard(x: number, y: number, scale = 1, consume = false) {
    return this.combatFxModule?.combatOpenSkyGuard.call(this, x, y, scale, consume);
  }

  private combatOpenSkyExposure(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatOpenSkyExposure.call(this, x, y, scale);
  }

  private enterOpenSky(turns: number, logMessage: string, label = 'Open Sky!') {
    this.flock.exposed = true;
    this.flock.exposedTurns = Math.max(this.flock.exposedTurns, turns);
    this.logEvent(logMessage);
    if (!this.fxLayer?.active) return;
    const x = FLOCK_FX_X;
    const y = FLOCK_FX_Y - 20;
    this.presentFlockStatus(label, '#ff9d4d', logMessage);
    if (!this.statusAccentActive('combat-open-sky-exposure', x - 4)) {
      this.combatOpenSkyExposure(x - 4, y - 14, 0.9);
    }
  }

  private gainOpenSkyGuard(amount: number, source = 'Open Sky Guard') {
    if (amount <= 0) return;
    this.flock.openSkyGuard += amount;
    this.logEvent(`${source} adds ${amount} Open Sky Guard.`);
    const x = FLOCK_FX_X - 6;
    const y = FLOCK_FX_Y - 34;
    this.combatOpenSkyGuard(x, y, Phaser.Math.Clamp(0.86 + amount * 0.08, 0.92, 1.18));
    this.sparkBurst(x, y + 8, 0x8df4ff, Phaser.Math.Clamp(10 + amount * 3, 12, 22), 142);
    this.presentFlockResult(amount, ' Sky Guard', '#dffbff', 'sky-guard');
  }

  private combatDefeatBurst(x: number, y: number) {
    return this.combatFxModule?.combatDefeatBurst.call(this, x, y);
  }

  private combatVictoryRally(x = GAME_WIDTH / 2, y = 292) {
    return this.combatFxModule?.combatVictoryRally.call(this, x, y);
  }

  private combatVictoryFanfareSigil(x: number, y: number) {
    return this.combatFxModule?.combatVictoryFanfareSigil.call(this, x, y);
  }

  private combatTurnBanner(text: string, color: string, accent: number) {
    return this.combatFxModule?.combatTurnBanner.call(this, text, color, accent);
  }

  combatRoostHandoff(x = 468, y = 382, scale = 1) {
    return this.combatFxModule?.combatRoostHandoff.call(this, x, y, scale);
  }

  private combatPlayerTurnRally(x = GAME_WIDTH / 2, y = 276, scale = 1) {
    return this.combatFxModule?.combatPlayerTurnRally.call(this, x, y, scale);
  }

  private fxDirectionalStreak(x1: number, y1: number, x2: number, y2: number, color: number, duration = 260, hold = 0) {
    this.battleFxPresenterModule?.presentBattleFxDirectionalStreak(
      this.battleFxPresentationHost(),
      COMBAT_ACTION_TRAIL_TEXTURE,
      x1,
      y1,
      x2,
      y2,
      color,
      duration,
      hold,
    );
  }

  private fxCastFocusBurst(x: number, y: number, color: number, scale = 1) {
    if (prefersReducedMotion()) return;
    if (!this.textures.exists(COMBAT_CAST_FOCUS_BURST_TEXTURE)) return;
    setTextureFilter(this.textures.get(COMBAT_CAST_FOCUS_BURST_TEXTURE), Phaser.Textures.FilterMode.LINEAR);
    this.combatCastFocusBurstBursts += 1;
    const size = 220 * scale;
    const burst = this.add.image(x, y, COMBAT_CAST_FOCUS_BURST_TEXTURE)
      .setDisplaySize(size, size)
      .setAlpha(0.76)
      .setTint(color)
      .setName('combat-cast-focus-burst');
    this.fxLayer.add(burst);
    this.fxLayer.bringToTop(burst);
    this.tweens.add({
      targets: burst,
      angle: 12,
      scaleX: burst.scaleX * 1.08,
      scaleY: burst.scaleY * 1.08,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => burst.destroy(),
    });
  }

  private wingbeatSpendFx(x: number, y: number, amount: number, suitColor: number) {
    if (prefersReducedMotion()) return;
    if (!this.textures.exists(COMBAT_WINGBEAT_SPEND_TEXTURE)) return;
    setTextureFilter(this.textures.get(COMBAT_WINGBEAT_SPEND_TEXTURE), Phaser.Textures.FilterMode.LINEAR);
    this.combatWingbeatSpendBursts += 1;
    const scale = Phaser.Math.Clamp(0.72 + amount * 0.08, 0.78, 1.06);
    const glow = this.add.circle(x, y + 2, 74 * scale, 0xffd37a, 0.18)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('combat-wingbeat-spend-glow');
    const pulse = this.add.image(x, y, COMBAT_WINGBEAT_SPEND_TEXTURE)
      .setDisplaySize(184 * scale, 184 * scale)
      .setAlpha(0.9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(-8)
      .setName('combat-wingbeat-spend');
    const ring = this.add.circle(x, y, 64 * scale, 0xdffbff, 0.02)
      .setStrokeStyle(5 * scale, 0xffd37a, 0.62)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('combat-wingbeat-spend-ring');
    const glint = this.add.rectangle(x + 20 * scale, y - 18 * scale, 122 * scale, 6 * scale, 0xdffbff, 0.64)
      .setAngle(-18)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('combat-wingbeat-spend-glint');
    this.fxLayer.add([glow, pulse, ring, glint]);
    this.fxMoteBurst(x, y, 0xffd37a, {
      count: 6 + Math.min(6, amount * 2),
      speed: 96 + amount * 18,
      lifespan: 430,
      scale: 0.48,
      gravityY: -26,
      spreadX: 86,
      spreadY: 42,
    });
    this.fxMoteBurst(x, y, suitColor, {
      count: 4,
      speed: 82,
      lifespan: 360,
      scale: 0.42,
      gravityY: -18,
      spreadX: 68,
      spreadY: 36,
    });
    this.tweens.add({
      targets: [glow, ring],
      scaleX: 1.44,
      scaleY: 1.44,
      alpha: 0,
      duration: 460,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        glow.destroy();
        ring.destroy();
      },
    });
    this.tweens.add({
      targets: pulse,
      scaleX: pulse.scaleX * 1.16,
      scaleY: pulse.scaleY * 1.16,
      angle: 9,
      alpha: 0,
      duration: 520,
      ease: 'Sine.easeOut',
      onComplete: () => pulse.destroy(),
    });
    this.tweens.add({
      targets: glint,
      x: x + 52 * scale,
      alpha: 0,
      duration: 330,
      ease: 'Quad.easeOut',
      onComplete: () => glint.destroy(),
    });
  }

  private drawSuitHex(g: Phaser.GameObjects.Graphics, color: number) {
    const points = [
      [0, -30],
      [26, -14],
      [24, 16],
      [0, 32],
      [-24, 16],
      [-26, -14],
    ];
    g.lineStyle(3, 0x020409, 0.34);
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => g.lineTo(x, y));
    g.closePath();
    g.strokePath();
    g.lineStyle(2, color, 0.82);
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => g.lineTo(x, y));
    g.closePath();
    g.strokePath();
    g.lineStyle(1.5, 0xffffff, 0.38);
    g.beginPath();
    g.moveTo(-16, 4);
    g.lineTo(-2, 18);
    g.lineTo(19, -10);
    g.strokePath();
  }

  private fxSuitSignature(suit: string | null | undefined, x: number, y: number, color: number, scale = 1) {
    if (prefersReducedMotion()) return;
    const sig = this.add.graphics();
    sig.setBlendMode(Phaser.BlendModes.ADD);
    if (suit === 'nests') {
      this.drawSuitHex(sig, color);
    } else if (suit === 'basins') {
      sig.lineStyle(3, 0x020409, 0.24);
      sig.strokeEllipse(0, 10, 62, 16);
      sig.strokeEllipse(0, 0, 44, 12);
      sig.lineStyle(2, color, 0.8);
      sig.strokeEllipse(0, 10, 62, 16);
      sig.strokeEllipse(0, 0, 44, 12);
      sig.lineStyle(1, 0xffffff, 0.36);
      sig.strokeEllipse(0, -9, 26, 8);
    } else if (suit === 'plumes') {
      sig.lineStyle(4, 0x020409, 0.24);
      sig.beginPath();
      sig.moveTo(-28, 12);
      sig.lineTo(24, -20);
      sig.moveTo(-12, 18);
      sig.lineTo(30, 2);
      sig.moveTo(-22, -8);
      sig.lineTo(8, -28);
      sig.strokePath();
      sig.lineStyle(2, color, 0.82);
      sig.beginPath();
      sig.moveTo(-28, 12);
      sig.lineTo(24, -20);
      sig.moveTo(-12, 18);
      sig.lineTo(30, 2);
      sig.moveTo(-22, -8);
      sig.lineTo(8, -28);
      sig.strokePath();
    } else if (suit === 'quills') {
      sig.lineStyle(4, 0x020409, 0.24);
      sig.beginPath();
      sig.moveTo(-22, 26);
      sig.lineTo(20, -28);
      sig.moveTo(4, 28);
      sig.lineTo(28, -8);
      sig.moveTo(-28, 4);
      sig.lineTo(10, -18);
      sig.strokePath();
      sig.lineStyle(2, color, 0.86);
      sig.beginPath();
      sig.moveTo(-22, 26);
      sig.lineTo(20, -28);
      sig.moveTo(4, 28);
      sig.lineTo(28, -8);
      sig.moveTo(-28, 4);
      sig.lineTo(10, -18);
      sig.strokePath();
    } else {
      sig.lineStyle(2, color, 0.76);
      for (let i = 0; i < 8; i += 1) {
        const a = Phaser.Math.DegToRad(i * 45);
        sig.beginPath();
        sig.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
        sig.lineTo(Math.cos(a) * 32, Math.sin(a) * 32);
        sig.strokePath();
      }
    }
    sig.setPosition(x, y).setScale(scale * 0.82).setAlpha(0.96);
    this.fxLayer.add(sig);
    this.tweens.add({
      targets: sig,
      scaleX: scale * 1.14,
      scaleY: scale * 1.14,
      alpha: 0,
      duration: 440,
      ease: 'Cubic.easeOut',
      onComplete: () => sig.destroy(),
    });
  }

  private fxImpactBurst(x: number, y: number, color: number, suit: string | null | undefined, intensity = 1) {
    if (prefersReducedMotion()) return;
    const burst = this.add.graphics();
    const reach = 37 * intensity;
    const inner = 7 * intensity;
    const angles = suit === 'basins'
      ? [-164, -126, -88, -50]
      : suit === 'nests'
        ? [-150, -90, -30, 30, 90, 150]
        : suit === 'plumes'
          ? [-178, -142, -108, -72]
          : [-64, -34, -4, 28];
    burst.setBlendMode(Phaser.BlendModes.ADD);
    burst.fillStyle(color, 0.2);
    burst.fillCircle(0, 0, 29 * intensity);
    burst.fillStyle(0xffffff, 0.58);
    burst.fillCircle(0, 0, 8 * intensity);
    const drawRays = (width: number, rayColor: number, alpha: number, offset = 0) => {
      burst.lineStyle(width, rayColor, alpha);
      angles.forEach((deg, index) => {
        const angle = Phaser.Math.DegToRad(deg + offset + index * 3);
        burst.beginPath();
        burst.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        burst.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
        burst.strokePath();
      });
    };
    drawRays(7, 0x020409, 0.34);
    drawRays(3, color, 0.96);
    drawRays(1.4, 0xffffff, 0.78, -2);
    burst.setPosition(x, y).setScale(0.54).setAlpha(1);
    this.fxLayer.add(burst);
    this.tweens.add({
      targets: burst,
      scaleX: 1.24,
      scaleY: 1.24,
      alpha: 0,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => burst.destroy(),
    });
    this.time.delayedCall(50, () => {
      this.fxMoteBurst(x, y, color, {
        count: Math.round(7 * intensity),
        speed: 150 * intensity,
        lifespan: 300,
        scale: 0.5,
        gravityY: suit === 'basins' ? -18 : 10,
        spreadX: 14,
        spreadY: 10,
      });
    });
  }

  private fxAnimForColor(color: number) {
    if (color === 0xc98bff) return 'fx-winded';
    if (color === 0x8fd6a0) return 'fx-heal';
    if (color === 0x7ab8d6 || color === 0x9fb1c4) return 'fx-nests';
    if (color === 0xff9d4d || color === 0xff9d6b || color === 0xff7a6e || color === 0xffcf7a) return 'fx-hostile';
    return 'fx-quills';
  }

  private pulseRing(x: number, y: number, color: number, radius = 58, duration = 460) {
    if (prefersReducedMotion()) return;
    const scale = Phaser.Math.Clamp(radius / 44, 0.9, 2.5);
    this.fxGlowPulse(x, y, color, radius * 1.02, duration * 0.82, 0.15);
    this.fxShockwave(x, y, color, radius * 0.96, duration * 0.9, -8);
    this.playFxAnimation(this.fxAnimForColor(color), x, y, { scale: scale * 0.94, alpha: 0.74, additive: true });
    this.fxMoteBurst(x, y, color, {
      count: radius >= 84 ? 14 : 8,
      speed: radius * 1.38,
      lifespan: duration * 0.82,
      scale: radius >= 84 ? 0.56 : 0.44,
      gravityY: 4,
      spreadX: 8,
      spreadY: 8,
    });
  }

  private sparkBurst(x: number, y: number, color: number, count = 18, speed = 145) {
    if (prefersReducedMotion()) return;
    const anim = this.fxAnimForColor(color);
    const repeats = count >= 22 ? 2 : 1;
    this.fxGlowPulse(x, y, color, count >= 22 ? 64 : 48, 270, 0.11);
    this.fxMoteBurst(x, y, color, {
      count: Math.max(6, Math.round(count * 0.72)),
      speed: speed * 0.88,
      lifespan: count >= 22 ? 440 : 340,
      scale: count >= 18 ? 0.56 : 0.44,
      gravityY: color === 0x8fd6a0 ? -18 : 28,
    });
    for (let i = 0; i < repeats; i += 1) {
      this.time.delayedCall(i * 55, () => {
        this.playFxAnimation(anim, x + (i - 1) * 12, y + (i % 2) * 8, {
          scale: Phaser.Math.Clamp(speed / 105, 0.9, 2.1),
          alpha: 0.58,
          angle: -10 + i * 18,
          flipX: i % 2 === 1,
          additive: true,
        });
      });
    }
  }

  private suitPulseAt(x: number, y: number, suit: string | null | undefined, label = '') {
    const meta = suitFxMeta(suit ?? undefined);
    this.fxGlowPulse(x, y, meta.color, 58, 300, 0.11);
    this.fxSuitSignature(suit, x, y + 2, meta.color, 0.8);
    this.playFxAnimation(SUIT_FX_ANIM[suit ?? ''] ?? this.fxAnimForColor(meta.color), x, y, {
      scale: 1.26,
      alpha: 0.72,
      additive: true,
    });
    this.fxMoteBurst(x, y, meta.color, { count: 8, speed: 96, lifespan: 300, scale: 0.44, gravityY: 0 });
    if (label) {
      this.presentFlockStatus(label, meta.hex, 'suit-pulse');
    }
  }

  private windedFx(x: number, y: number) {
    if (this.statusAccentActive('combat-winded-gust', x)) return;
    this.combatWindedGust(x, y - 10, 0.86);
  }

  private combatWindedGust(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatWindedGust.call(this, x, y, scale);
  }

  private combatFlowSurge(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatFlowSurge.call(this, x, y, scale);
  }

  private combatCleanseBurst(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatCleanseBurst.call(this, x, y, scale);
  }

  private combatBankCache(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatBankCache.call(this, x, y, scale);
  }

  private combatSupplyUseBurst(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatSupplyUseBurst.call(this, x, y, scale);
  }

  private combatThreatCharge(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatThreatCharge.call(this, x, y, scale);
  }

  private combatEnemySupportCharge(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatEnemySupportCharge.call(this, x, y, scale);
  }

  private combatEnemyAttackTell(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatEnemyAttackTell.call(this, x, y, scale);
  }

  private combatEnemySupportTell(x: number, y: number, scale = 1) {
    return this.combatFxModule?.combatEnemySupportTell.call(this, x, y, scale);
  }

  private combatEnemyWindupPlaque(x: number, y: number, label: string, labelColor: string, scale = 1) {
    if (!this.textures.exists(COMBAT_ENEMY_WINDUP_PLAQUE_TEXTURE)) {
      floatingText(this, this.fxLayer, x, y, label, labelColor);
      return;
    }
    setTextureFilter(this.textures.get(COMBAT_ENEMY_WINDUP_PLAQUE_TEXTURE), Phaser.Textures.FilterMode.LINEAR);
    this.combatEnemyWindupPlaqueBursts += 1;
    const plaqueScale = Phaser.Math.Clamp(scale, 0.9, 1.18);
    const group = this.add.container(x, y).setName('combat-enemy-windup-plaque');
    const plate = this.add.image(0, 0, COMBAT_ENEMY_WINDUP_PLAQUE_TEXTURE)
      .setDisplaySize(292 * plaqueScale, 73 * plaqueScale)
      .setAlpha(0.94)
      .setName('combat-enemy-windup-plaque');
    const text = this.add.text(0, -1 * plaqueScale, label, {
      fontFamily: UI_FONT,
      fontSize: `${Math.round(17 * plaqueScale)}px`,
      fontStyle: UI_BOLD,
      color: labelColor,
      stroke: '#05070c',
      strokeThickness: Math.max(3, Math.round(4 * plaqueScale)),
      align: 'center',
      fixedWidth: Math.round(202 * plaqueScale),
      maxLines: 1,
    })
      .setOrigin(0.5)
      .setName('combat-enemy-windup-plaque-label');
    const underline = this.add.rectangle(0, 19 * plaqueScale, 150 * plaqueScale, Math.max(2, 2 * plaqueScale), Phaser.Display.Color.HexStringToColor(labelColor).color, 0.72)
      .setName('combat-enemy-windup-plaque-line');
    group.add([plate, text, underline]);
    this.fxLayer.add(group);
    this.fxLayer.bringToTop(group);
    if (prefersReducedMotion()) {
      this.time.delayedCall(Math.max(620, this.combatTimingDelay(ENEMY_ATTACK_WINDUP_MS) - 80), () => group.destroy(true));
      return;
    }
    group.setAlpha(0.01).setScale(0.94);
    this.tweens.add({
      targets: group,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y: y - 8 * plaqueScale,
      duration: 180,
      ease: 'Cubic.easeOut',
    });
    this.tweens.add({
      targets: group,
      alpha: { value: 0, duration: 620, delay: Math.max(1560, ENEMY_ATTACK_WINDUP_MS - 620) },
      y: y - 22 * plaqueScale,
      duration: 560,
      ease: 'Cubic.easeIn',
      onComplete: () => group.destroy(true),
    });
  }

  private flowGainFx(amount = 1, color = '#8df4ff') {
    if (amount <= 0) return;
    const x = FLOCK_FX_X + 4;
    const y = FLOCK_FX_Y - 32;
    birdAudio.play('flow', Math.min(1.25, 0.75 + amount * 0.14));
    this.combatFlowSurge(x, y, Phaser.Math.Clamp(0.9 + amount * 0.08, 0.96, 1.18));
    this.fxMoteBurst(x, y + 8, 0x8df4ff, {
      count: Phaser.Math.Clamp(10 + amount * 5, 12, 26),
      speed: 130,
      lifespan: 430,
      scale: 0.58,
      gravityY: -18,
      spreadX: 16,
      spreadY: 10,
    });
    this.presentFlockResult(amount, ' Flow', color, 'flow');
  }

  private cleanseFx(cleared: number) {
    if (cleared <= 0) return;
    const x = FLOCK_FX_X + 2;
    const y = FLOCK_FX_Y - 26;
    birdAudio.play('cleanse', Math.min(1.25, 0.78 + cleared * 0.08));
    this.queueFlockMotion('brace');
    this.combatCleanseBurst(x, y, Phaser.Math.Clamp(0.92 + cleared * 0.04, 0.98, 1.2));
    this.combatStatusCleanseSpecific(x, y + 2, Phaser.Math.Clamp(0.82 + cleared * 0.04, 0.9, 1.12));
    this.fxGlowPulse(x, y + 4, 0x8df4ff, 86, 420, 0.16);
    this.fxShockwave(x, y + 8, 0x8df4ff, 78, 420, -9);
    this.fxMoteBurst(x, y + 10, 0xdffbff, {
      count: Phaser.Math.Clamp(12 + cleared * 4, 14, 28),
      speed: 118,
      lifespan: 420,
      scale: 0.52,
      gravityY: -10,
      spreadX: 18,
      spreadY: 14,
    });
    this.presentFlockResult(cleared, ' cleansed', '#dffbff', 'cleanse');
  }

  private bankNextTurnFx(amount: number, label: string, color = '#dffbff', moteColor = 0x8df4ff) {
    if (amount === 0) return;
    const x = FLOCK_FX_X + 118;
    const y = FLOCK_FX_Y - 18;
    const magnitude = Math.max(1, Math.abs(amount));
    birdAudio.play('bank', Math.min(1.25, 0.76 + magnitude * 0.08));
    this.queueFlockMotion(amount > 0 ? 'brace' : 'hit');
    this.combatBankCache(x, y, Phaser.Math.Clamp(0.9 + magnitude * 0.04, 0.96, 1.16));
    this.combatCacheChoiceReveal(x, y + 2, Phaser.Math.Clamp(0.78 + magnitude * 0.03, 0.84, 1.05));
    this.fxGlowPulse(x, y + 4, moteColor, 70, 360, 0.12);
    this.fxMoteBurst(x, y + 8, moteColor, {
      count: Phaser.Math.Clamp(9 + magnitude * 3, 10, 22),
      speed: 104,
      lifespan: 380,
      scale: 0.48,
      gravityY: -12,
      spreadX: 20,
      spreadY: 10,
    });
    this.presentFlockStatus(label, color, 'next-turn');
  }

  private enemyThreatChargeFx(enemy: Enemy, amount: number) {
    if (amount <= 0) return;
    const view = this.enemyView(enemy);
    const scale = Phaser.Math.Clamp(0.86 + amount * 0.05, 0.92, 1.16);
    const y = view.y + (enemy.runtime.type === 'boss' ? 8 : 16);
    birdAudio.play('threat', Math.min(1.3, 0.78 + amount * 0.08));
    this.queueEnemyMotion(enemy.id, 'attack');
    this.combatThreatCharge(view.x, y, scale);
    this.fxGlowPulse(view.x, y, 0xff9d4d, 92, 420, 0.18);
    this.fxMoteBurst(view.x, y + 8, 0xff9d4d, {
      count: Phaser.Math.Clamp(10 + amount * 3, 12, 24),
      speed: 118,
      lifespan: 380,
      scale: 0.5,
      gravityY: 6,
      spreadX: 16,
      spreadY: 10,
    });
    this.presentEnemyStatus(enemy, `+${amount} next damage`, '#ffcf7a');
  }

  enemyAttackWindupFx(enemy: Enemy, move: EnemyMove) {
    const reduced = prefersReducedMotion();
    const view = this.enemyView(enemy);
    const damage = this.incomingAttackDamage(enemy);
    const supportMove = move.effects.some((effect) => /heal|gainCover|nextAttackBonus/.test(effect));
    const pressure = Math.max(1, damage || intentCoverValue(move) || move.effects.length);
    const color = damage > 0 ? 0xff9d4d : supportMove ? 0x8fd6a0 : 0xc98bff;
    const labelColor = damage > 0 ? '#ffcf7a' : supportMove ? '#8fd6a0' : '#c98bff';
    const y = view.y + (enemy.runtime.type === 'boss' ? 8 : 18);
    const scale = Phaser.Math.Clamp(0.94 + pressure * 0.035, 0.98, enemy.runtime.type === 'boss' ? 1.28 : 1.14);
    const cinematic = combatPacePreference() === 'cinematic';
    const tellY = cinematic ? y - 8 * view.scale : view.y - 24 * view.scale;
    const tellScale = scale * (cinematic ? 1 : 0.55);

    birdAudio.play('threat', Phaser.Math.Clamp(0.72 + pressure * 0.045, 0.78, 1.12));
    if (damage > 0) {
      if (cinematic) this.combatThreatCharge(view.x, y, scale);
      this.combatEnemyAttackTell(view.x, tellY, tellScale);
    } else {
      if (cinematic) this.combatEnemySupportCharge(view.x, y, scale);
      this.combatEnemySupportTell(view.x, tellY, tellScale);
    }
    this.combatEnemyWindupPlaque(view.x, view.y - 112 * view.scale, move.label, labelColor, scale);
    if (reduced || !cinematic) return;
    this.fxGlowPulse(view.x, y, color, 100 * scale, 760, 0.2);
    this.fxShockwave(view.x, y + 18 * view.scale, color, 98 * scale, 720, -8);
    this.fxMoteBurst(view.x, y + 8, color, {
      count: Phaser.Math.Clamp(14 + pressure * 2, 16, 30),
      speed: 118 + pressure * 5,
      lifespan: 680,
      scale: 0.56,
      gravityY: 8,
      spreadX: 22,
      spreadY: 12,
    });
    if (damage > 0) {
      // Keep the anticipation tell centered on the acting enemy. A travel
      // streak here made the neutral perimeter flourish read like an arrow
      // aimed across the board; directional motion belongs to release.
      this.fxGlowPulse(FLOCK_FX_X, FLOCK_FX_Y + 10, color, 72, 620, 0.12);
    }
  }

  enemyAttackReleaseFx(enemy: Enemy, move: EnemyMove) {
    if (prefersReducedMotion()) return;
    const view = this.enemyView(enemy);
    const damage = this.incomingAttackDamage(enemy);
    const supportMove = move.effects.some((effect) => /heal|gainCover|nextAttackBonus/.test(effect));
    const pressure = Math.max(1, damage || intentCoverValue(move) || move.effects.length);
    const color = damage > 0 ? 0xff7a6e : supportMove ? 0x8fd6a0 : 0xc98bff;
    const y = view.y + (enemy.runtime.type === 'boss' ? 10 : 20);
    const timing = this.combatFxModule!.enemyMoveTimings(this, enemy, move);
    const releaseWindowMs = timing.release + timing.anticipation;

    this.fxGlowPulse(view.x, y, color, 78 + pressure * 4, Math.min(560, releaseWindowMs), 0.18);
    this.fxShockwave(view.x, y + 18 * view.scale, color, 82 + pressure * 3, Math.min(520, releaseWindowMs), -7);
    this.fxMoteBurst(view.x - 18 * view.scale, y + 10, color, {
      count: Phaser.Math.Clamp(8 + pressure * 2, 10, 22),
      speed: 116 + pressure * 3,
      lifespan: Math.max(120, releaseWindowMs - 80),
      scale: 0.48,
      gravityY: 12,
      spreadX: 18,
      spreadY: 10,
    });
    if (damage > 0) {
      this.fxDirectionalStreak(
        view.x - 30 * view.scale,
        y + 14 * view.scale,
        FLOCK_FX_X + 18,
        FLOCK_FX_Y + 16,
        color,
        Math.min(900, releaseWindowMs * 0.8),
        Math.max(0, releaseWindowMs - Math.min(900, releaseWindowMs * 0.8))
      );
      this.fxGlowPulse(FLOCK_FX_X, FLOCK_FX_Y + 18, color, 74, releaseWindowMs, 0.12);
    }
  }

  enemyAttackCommitmentSealFx(enemy: Enemy, move: EnemyMove) {
    if (moveDealsDamage(move)) this.combatFxModule?.presentEnemyCommitmentSeal(this, enemy, move, FLOCK_FX_X, FLOCK_FX_Y);
  }

  enemyAttackRecoveryAfterglowFx(enemy: Enemy, move: EnemyMove) {
    if (combatPacePreference() !== 'cinematic') return;
    if (!this.textures.exists(COMBAT_ENEMY_RECOVERY_AFTERGLOW_TEXTURE)) return;
    const view = this.enemyView(enemy);
    const damage = move.effects.reduce((total, effect) => {
      const parsed = parseEffect(effect);
      if (!parsed || parsed.name !== 'damage') return total;
      return total + parseEffectValue(parsed.args[1] ?? parsed.args[0], 0) + enemy.damageBonus;
    }, 0);
    const supportMove = move.effects.some((effect) => /heal|gainCover|nextAttackBonus/.test(effect));
    const pressure = Math.max(1, damage || intentCoverValue(move) || move.effects.length);
    const reduced = prefersReducedMotion();
    const y = view.y + (enemy.runtime.type === 'boss' ? 56 : 64) * view.scale;
    const width = (enemy.runtime.type === 'boss' ? 430 : 350) * view.scale * Phaser.Math.Clamp(0.96 + pressure * 0.025, 1, 1.16);
    const height = width * (320 / 768);
    const tint = damage > 0 ? 0xffffff : supportMove ? 0x9be6b0 : 0xd7a6ff;

    setTextureFilter(this.textures.get(COMBAT_ENEMY_RECOVERY_AFTERGLOW_TEXTURE), Phaser.Textures.FilterMode.LINEAR);
    this.combatEnemyRecoveryAfterglowBursts += 1;
    const base = this.add.image(view.x, y, COMBAT_ENEMY_RECOVERY_AFTERGLOW_TEXTURE)
      .setDisplaySize(width, height)
      .setAlpha(reduced ? 0.58 : 0.76)
      .setTint(tint)
      .setName('combat-enemy-recovery-afterglow');
    const glow = this.add.image(view.x, y - 2 * view.scale, COMBAT_ENEMY_RECOVERY_AFTERGLOW_TEXTURE)
      .setDisplaySize(width * 1.08, height * 1.08)
      .setAlpha(reduced ? 0.24 : 0.32)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(damage > 0 ? 0xffd37a : supportMove ? 0x8fd6a0 : 0xc98bff)
      .setName('combat-enemy-recovery-afterglow');
    this.fxLayer.add([glow, base]);

    if (reduced) {
      this.time.delayedCall(Math.max(620, this.combatTimingDelay(ENEMY_ATTACK_RECOVER_MS) - 120), () => {
        glow.destroy();
        base.destroy();
      });
      return;
    }

    this.fxMoteBurst(view.x, y - 10 * view.scale, damage > 0 ? 0xffd37a : supportMove ? 0x8fd6a0 : 0xc98bff, {
      count: Phaser.Math.Clamp(8 + pressure * 2, 10, 20),
      speed: 92 + pressure * 3,
      lifespan: 460,
      scale: 0.42,
      gravityY: 18,
      spreadX: 90 * view.scale,
      spreadY: 10,
    });
    this.tweens.add({
      targets: [glow, base],
      scaleX: '+=0.06',
      scaleY: '-=0.015',
      y: `+=${8 * view.scale}`,
      alpha: 0,
      duration: 780,
      ease: 'Sine.easeOut',
      onComplete: () => {
        glow.destroy();
        base.destroy();
      }
    });
  }

  private coverImpactFx(x: number, y: number, color = 0x7ab8d6) {
    const hostile = color === 0x9fb1c4;
    this.fxGlowPulse(x, y - 8, hostile ? 0xff9d6b : color, hostile ? 48 : 62, 280, hostile ? 0.1 : 0.13);
    this.fxShockwave(x, y - 8, hostile ? 0xff9d6b : color, hostile ? 48 : 66, 320, hostile ? 9 : -8);
    if (!hostile) this.combatCoverGuard(x, y - 8, 1);
    if (!hostile) this.fxSuitSignature('nests', x, y - 10, color, 0.9);
    this.fxImpactBurst(x, y - 8, hostile ? 0xff9d6b : color, hostile ? null : 'nests', hostile ? 0.64 : 0.78);
    this.playFxAnimation(hostile ? 'fx-hostile' : 'fx-nests', x, y - 8, {
      scale: hostile ? 1.04 : 1.22,
      alpha: 0.72,
      additive: true,
    });
    this.fxMoteBurst(x, y - 6, hostile ? 0x9fb1c4 : 0x7ab8d6, {
      count: hostile ? 7 : 9,
      speed: hostile ? 108 : 82,
      lifespan: 300,
      scale: 0.44,
      gravityY: hostile ? 22 : 4,
      spreadX: 18,
      spreadY: 12,
    });
  }

  private coverBuildFx(suit?: string | null) {
    const meta = suitFxMeta(suit ?? 'nests');
    this.combatCoverGuard(FLOCK_FX_X, FLOCK_FX_Y + 24, 1);
    this.fxMoteBurst(FLOCK_FX_X, FLOCK_FX_Y + 32, meta.color, {
      count: 5, speed: 44, lifespan: 280, scale: 0.32,
      gravityY: -12, spreadX: 22, spreadY: 6,
    });
  }

  private healFx() {
    this.combatHealBloom(FLOCK_FX_X, FLOCK_FX_Y + 8, 1);
    this.fxMoteBurst(FLOCK_FX_X, FLOCK_FX_Y + 14, 0x8fd6a0, {
      count: 5,
      speed: 42,
      lifespan: 320,
      angle: { min: 235, max: 305 },
      scale: 0.32,
      gravityY: -42,
      spreadX: 24,
      spreadY: 12,
    });
  }

  private battleArtAssets() {
    return uniqueImageAssets([
      scrapArtAsset,
      snagCardBorderAsset,
      this.currentBattlefieldAsset(),
      this.currentFlockLeaderArtAsset(),
      ...this.hand.map((card) => cardCompactArtAsset(card)),
      ...this.enemies
        .map((enemy) => enemyArtAssets[enemy.runtime.id] ?? enemyArtAssets[enemy.id])
        .filter((asset): asset is RuntimeImageAsset => Boolean(asset))
    ]);
  }

  preload() {
    queuePreloadImageAssets(this, this.battleArtAssets(), 'Battle scene art');
  }

  private queueOptionalArtLoad(onReady?: (result: RuntimeImageLoadResult) => void) {
    if (this.optionalArtRequested) return;
    this.optionalArtRequested = true;

    const assets = this.battleArtAssets();
    const refresh = (result: RuntimeImageLoadResult) => {
      // A failed preload may recover after the intro's last render. Refresh
      // the visible scene as well as its readiness report, without user input.
      this.battleAssetReadiness.settle('battle-preloaded-art', result);
      onReady?.(result);
      this.refreshLoadedHandCardArt(this.hand);
      this.requestBattleRender();
    };
    const queued = queueRuntimeImageAssets(this, assets, 'Optional art', refresh);
    if (!queued) onReady?.(runtimeImageLoadSnapshot(this, assets));
  }

  private currentRouteNode() {
    return currentCombatNodes()[this.currentRouteIndex];
  }

  private currentBattlefieldAsset() {
    return currentBattlefieldAsset(this.currentRouteNode());
  }

  private queueCardArtLoad(cards: Card[], retry = false) {
    const assets = uniqueImageAssets([
      ...cards.map((card) => cardCompactArtAsset(card)),
      ...(cards.some(isSnagCard) ? [snagCardBorderAsset] : [])
    ]);
    const reward = this.mode === 'cardReward' || this.mode === 'upgradeReward';
    if (retry) assets.forEach(asset => {
      this.rewardArtFailedKeys.delete(asset.key); this.rewardArtRequestedKeys.delete(asset.key);
    });
    const handOnly = this.mode === 'battle'
      && !this.inspectOverlay
      && cards.every((card) => this.hand.some((candidate) => candidate.instanceId === card.instanceId));
    // Redrawing chrome is not a network retry. A visible Retry or Read action
    // explicitly resets the attempt; the original observer owns late completion.
    const pending = assets.filter(asset => !reward || !this.rewardArtRequestedKeys.has(asset.key));
    if (reward) pending.forEach(asset => this.rewardArtRequestedKeys.add(asset.key));
    this.queueImageAssets(pending, 'Card art', (result) => {
      if (this.mode === 'cardReward' || this.mode === 'upgradeReward') {
        result.failedKeys.forEach(key => this.rewardArtFailedKeys.add(key));
        result.loadedKeys.forEach(key => this.rewardArtFailedKeys.delete(key));
        const slots = this.root.list.filter(child => child.getData('rewardArtRefresh'));
        if (slots.length) {
          slots.forEach(slot => slot.getData('rewardArtRefresh')(result.failedKeys));
          return;
        }
      }
      const refreshed = this.refreshLoadedHandCardArt(cards);
      if (!handOnly || refreshed < cards.length) this.requestBattleRender();
    });
  }

  private queueCurrentWaymarkArtLoad() {
    const assets = uniqueImageAssets(this.routeMarks.map((id) => waymarkCompactArtAssets[id]));
    this.queueImageAssets(assets, 'Waymark art');
  }

  private queueWaymarkRewardArtLoad() {
    const assets = uniqueImageAssets(this.waymarkChoices.map((mark) => waymarkCompactArtAssets[mark.id]));
    this.queueImageAssets(assets, 'Waymark reward art');
  }

  private queueImageAssets(assets: RuntimeImageAsset[], warning: string, onComplete: (result: RuntimeImageLoadResult) => void = () => this.requestBattleRender()) {
    queueRuntimeImageAssets(this, assets, warning, onComplete);
  }

  private queueCurrentSupplyArtLoad() {
    const assets = uniqueImageAssets(this.runSupplies.map((id) => supplyCompactArtAssets[id]));
    this.queueImageAssets(assets, 'Supply art');
  }

  private queueBattleInspectUiLoad() {
    queueUiIconAssets(this, battleInspectUiIconIds, 'Inspect UI', () => {
      if (this.root?.active) this.requestBattleRender();
    });
  }

  private queueBattleDrawerUiLoad() {
    queueUiIconAssets(this, battleDrawerUiIconIds, 'Drawer UI', () => {
      if (this.root?.active) this.requestBattleRender();
    });
  }

  private queueBattleRewardUiLoad() {
    queueUiIconAssets(this, battleRewardUiIconIds, 'Reward UI', () => {
      if (this.root?.active) this.requestBattleRender();
    });
  }

  private queueCombatFxAssetLoad(onReady?: (result: RuntimeImageLoadResult) => void) {
    if (this.combatFxAssetsRequested) return;
    this.combatFxAssetsRequested = true;

    void withRuntimeLoadTimeout(loadCombatFxAssetsModule(), 'Essential combat FX')
      .then((module) => {
        const { essentialCombatFxImageAssets, combatFxSpritesheetAssets } = module;
        this.combatFxModule = module;
        module.initEnemyTurnAcceleration(this, () => this.refreshBeatProgressBadge());
        this.queueCombatFxAssetBatch(essentialCombatFxImageAssets, combatFxSpritesheetAssets, onReady);
      })
      .catch((error) => {
        console.warn(LAZY_LOAD_FAILED, error);
        if (!this.sys.settings.active) return;
        onReady?.(failedModuleLoadResult('combat FX module', error instanceof RuntimeLoadTimeoutError));
      });
  }

  private queueOptionalCombatFxAssetLoad(onReady?: (result: RuntimeImageLoadResult) => void) {
    if (this.combatOptionalFxAssetsRequested) return;
    this.combatOptionalFxAssetsRequested = true;
    void withRuntimeLoadTimeout(loadCombatFxAssetsModule(), 'Optional combat FX')
      .then(({ optionalCombatFxImageAssets }) => {
        this.queueCombatFxAssetBatch(optionalCombatFxImageAssets, [], onReady);
      })
      .catch((error) => {
        this.combatOptionalFxAssetsRequested = false;
        console.warn(LAZY_LOAD_FAILED, error);
        if (this.sys.settings.active) {
          onReady?.(failedModuleLoadResult('optional combat FX module', error instanceof RuntimeLoadTimeoutError));
        }
      });
  }

  private queueEnemyTurnCombatFxAssetLoad(onReady?: (result: RuntimeImageLoadResult) => void) {
    if (this.combatEnemyTurnFxAssetsRequested) return;
    this.combatEnemyTurnFxAssetsRequested = true;
    void withRuntimeLoadTimeout(loadCombatFxAssetsModule(), 'Enemy-turn combat FX')
      .then(({ enemyTurnCombatFxImageAssets }) => {
        this.queueCombatFxAssetBatch(enemyTurnCombatFxImageAssets, [], onReady);
      })
      .catch((error) => {
        this.combatEnemyTurnFxAssetsRequested = false;
        console.warn(LAZY_LOAD_FAILED, error);
        if (this.sys.settings.active) {
          onReady?.(failedModuleLoadResult('enemy-turn combat FX module', error instanceof RuntimeLoadTimeoutError));
        }
      });
  }

  private queueOutcomeCombatFxAssetLoad(onReady?: (result: RuntimeImageLoadResult) => void) {
    if (this.combatOutcomeFxAssetsRequested) return;
    this.combatOutcomeFxAssetsRequested = true;
    void withRuntimeLoadTimeout(loadCombatFxAssetsModule(), 'Outcome combat FX')
      .then(({ outcomeCombatFxImageAssets }) => {
        this.queueCombatFxAssetBatch(outcomeCombatFxImageAssets, [], onReady);
      })
      .catch((error) => {
        this.combatOutcomeFxAssetsRequested = false;
        console.warn(LAZY_LOAD_FAILED, error);
        if (this.sys.settings.active) {
          onReady?.(failedModuleLoadResult('outcome combat FX module', error instanceof RuntimeLoadTimeoutError));
        }
      });
  }

  private queueCombatFxAssetBatch(
    imageAssets: RuntimeImageAsset[],
    spritesheetAssets: Array<RuntimeImageAsset & { frameWidth: number; frameHeight: number }>,
    onReady?: (result: RuntimeImageLoadResult) => void
  ) {
    if (!this.sys.settings.active) return;
    const requestedAssets: RuntimeImageAsset[] = [...imageAssets, ...spritesheetAssets];
    const pendingImages = imageAssets.filter((asset) => !this.textures.exists(asset.key));
    const pendingSheets = spritesheetAssets.filter((asset) => !this.textures.exists(asset.key));
    if (pendingImages.length === 0 && pendingSheets.length === 0) {
      this.ensureFxTextures();
      onReady?.(runtimeImageLoadSnapshot(this, requestedAssets));
      return;
    }

    let settled = false;
    let timeoutEvent: Phaser.Time.TimerEvent | undefined;
    const cleanup = () => {
      this.load.off('complete', onComplete);
      this.load.off('loaderror', onLoadError);
      this.events.off('shutdown', onSceneEnd);
      this.events.off('destroy', onSceneEnd);
      timeoutEvent?.remove(false);
    };
    const finish = (timedOut: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      this.ensureFxTextures();
      onReady?.(runtimeImageLoadSnapshot(this, requestedAssets, timedOut));
    };
    const onComplete = () => finish(false);
    const onLoadError = (file: { key?: string }) => {
      const key = file.key ?? 'unknown';
      if (!pendingImages.some((asset) => asset.key === key) && !pendingSheets.some((asset) => asset.key === key)) return;
      console.warn(`Combat FX: ${key}`);
    };
    const onSceneEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
    };

    pendingImages.forEach((asset) => this.load.image(asset.key, asset.url));
    pendingSheets.forEach((asset) => {
      this.load.spritesheet(asset.key, asset.url, {
        frameWidth: asset.frameWidth,
        frameHeight: asset.frameHeight
      });
    });
    this.load.on('loaderror', onLoadError);
    this.load.once('complete', onComplete);
    this.events.once('shutdown', onSceneEnd);
    this.events.once('destroy', onSceneEnd);
    timeoutEvent = this.time.delayedCall(RUNTIME_IMAGE_LOAD_TIMEOUT_MS, () => finish(true));
    this.load.start();
  }

  // Per-enemy board placement: solo opponents move into the open central stage.
  // Four enemies occupy separate columns instead of hiding one another.
  // Art and impact anchors sit above the fixed information band.
  private enemyView(enemy: Enemy): { x: number; y: number; scale: number } {
    const index = Math.max(0, this.enemies.indexOf(enemy));
    const count = this.enemies.length;
    const bossIndex = this.enemies.findIndex((candidate) => candidate.runtime.type === 'boss');
    if (bossIndex >= 0 && count > 1) {
      if (index === bossIndex) {
        return { x: count >= 4 ? 940 : 930, y: 225, scale: count >= 4 ? 1 : 1.08 };
      }
      const goonIndex = this.enemies.slice(0, index).filter((candidate) => candidate.runtime.type !== 'boss').length;
      return bossGoonViewAt(goonIndex, count - 1);
    }
    if (enemy.runtime.type === 'boss') return { x: 875, y: 215, scale: 1.24 };
    return enemyViewAt(index, count);
  }

  // Shared meter geometry keeps the health fill, forecast and damage drain aligned.
  // The name/value header is laid out above this meter by the foreground renderer.
  private enemyHpBar(enemy: Enemy): { x: number; y: number; w: number; h: number } {
    const { x, y, scale } = this.enemyView(enemy);
    return { x, y: y + 68 * scale + 39, w: Math.max(190, (enemy.runtime.type === 'boss' ? 250 : ENEMY_HP_BAR.w) * scale), h: ENEMY_HP_BAR.h };
  }

  /** Body language is played by the retained actor stage. `detail` is the
   * damage of a hit, or the hold of an attack, in the cue's own unit. */
  private queueEnemyMotion(enemyId: string, cue: EnemyMotionCue, detail?: number) {
    this.events.emit('living-enemy-cue', enemyId, cue, detail);
  }

  private queueFlockMotion(cue: 'cast' | 'brace' | 'heal' | 'hit', detail?: number) {
    this.events.emit('living-flock-cue', cue, detail);
  }

  private enemyTextureVisibleBounds(key: string): TextureVisibleBounds {
    const cached = this.enemyTextureBoundsCache.get(key);
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
        const alphaThreshold = 44;
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
      // Fall back to the full texture box if pixel reads are unavailable.
    }

    this.enemyTextureBoundsCache.set(key, bounds);
    return bounds;
  }

  private combatEnemyArtPlacement(key: string, fit: number, scale: number) {
    const src = this.textures.get(key).getSourceImage() as { width?: number; height?: number };
    const width = Math.max(1, Number(src.width ?? 1));
    const height = Math.max(1, Number(src.height ?? 1));
    const bounds = this.enemyTextureVisibleBounds(key);
    const displayW = width * fit;
    const displayH = height * fit;
    const visibleW = displayW * Math.max(0.05, bounds.right - bounds.left);
    const visibleH = displayH * Math.max(0.05, bounds.bottom - bounds.top);
    const visibleCenterOffsetX = displayW * ((bounds.left + bounds.right) / 2 - 0.5);
    const visibleBottomFromCenter = displayH * (bounds.bottom - 0.5);
    const shadowY = 34 * scale;
    return {
      artX: -visibleCenterOffsetX,
      artY: shadowY - visibleBottomFromCenter - 2 * scale,
      hitBounds: { x: bounds.left * width, y: bounds.top * height,
        width: (bounds.right - bounds.left) * width, height: (bounds.bottom - bounds.top) * height },
      shadowY,
      shadowW: clamp(visibleW * 0.78, 76 * scale, 148 * scale),
      shadowH: clamp(visibleH * 0.12, 13 * scale, 26 * scale),
    };
  }

  private renderBattleForeground() {
    const livingEnemies = this.enemies.filter((enemy) => enemy.hp > 0);
    const enemies = livingEnemies.map((enemy) => {
      const { x, y, scale } = this.enemyView(enemy);
      const elite = enemy.runtime.type === 'elite';
      const boss = enemy.runtime.type === 'boss';
      const selected = enemy.id === this.selectedEnemyId;
      const move = currentMove(enemy);
      const artAsset = enemyArtAssets[enemy.runtime.id] ?? enemyArtAssets[enemy.id];
      const hasArt = Boolean(artAsset && this.textures.exists(artAsset.key));
      let artFit = 1;
      let artPlacement: ReturnType<BattleScene['combatEnemyArtPlacement']> | undefined;
      if (hasArt && artAsset) {
        const source = this.textures.get(artAsset.key).getSourceImage() as { width?: number; height?: number };
        artFit = Math.min(
          (236 * scale) / Math.max(1, Number(source.width ?? 1)),
          (214 * scale) / Math.max(1, Number(source.height ?? 1))
        );
        // Fit the visible silhouette, not transparent padding, below the HUD.
        const bounds = this.enemyTextureVisibleBounds(artAsset.key);
        const visibleHeight = Math.max(1, Number(source.height ?? 1) * (bounds.bottom - bounds.top));
        artFit = Math.min(artFit, Math.max(64, y + 32 * scale - 114) / visibleHeight);
        artPlacement = this.combatEnemyArtPlacement(artAsset.key, artFit, scale);
      }
      const incomingDamage = this.incomingAttackDamage(enemy);
      const objective = this.encounterObjectiveTextState();
      const objectiveTarget = objective?.type === 'priority' && objective.targetEnemyId === enemy.id
        ? {
            title: objective.title,
            detail: `${objective.description}. Complete the goal for +${objective.bonusScrap} Scrap.`,
            status: objective.status,
            remainingBeats: Math.max(0, (objective.deadlineTurn ?? 3) - this.turn + 1)
          }
        : undefined;
      if (artPlacement && artAsset) {
        // Reserve the complete label stack before fitting every silhouette.
        // Translate the complete placement so paws, shadow and input agree.
        const source = this.textures.get(artAsset.key).getSourceImage() as { height: number };
        const bounds = this.enemyTextureVisibleBounds(artAsset.key);
        const ranked = boss || elite;
        const labelTop = this.enemyHpBar(enemy).y - (ranked && objectiveTarget ? 124 : ranked || objectiveTarget ? 92 : 63);
        const floor = Math.min(y + 32 * scale, labelTop - 8);
        const visibleHeight = Math.max(1, source.height * (bounds.bottom - bounds.top));
        artFit = Math.min(artFit, Math.max(1, floor - 114) / visibleHeight);
        artPlacement = this.combatEnemyArtPlacement(artAsset.key, artFit, scale);
        const lift = y + artPlacement.shadowY - 2 * scale - floor;
        artPlacement.artY -= lift;
        artPlacement.shadowY -= lift;
      }
      return {
        id: enemy.id,
        name: enemy.name,
        initials: enemyInitials(enemy.name),
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        block: enemy.block,
        weak: enemy.weak,
        selected,
        guideTarget: this.firstCombatGuideTarget(this.firstCombatGuideCard())?.id === enemy.id,
        elite,
        boss,
        phase: enemy.phase,
        phaseName: enemy.runtime.phaseTwoName,
        x,
        y,
        scale,
        frameColor: selected ? 0x24d0d6 : elite ? 0xffcf4a : boss ? 0xff6f6f : 0xd8a840,
        hpBar: this.enemyHpBar(enemy),
        artKey: hasArt ? artAsset?.key : undefined,
        artFit,
        artPlacement,
        moveLabel: move.label,
        incomingDamage,
        intent: enemyIntentLabel(move.effects, incomingDamage),
        moveDescription: formatEffects(move.effects)
          .replace(/Enter Open Sky/g, 'Flock enters Open Sky')
          .replace(/Lose (\d+) Wingbeat\./g, 'Flock starts next turn with $1 fewer Wingbeat.'),
        status: enemyStatus(enemy),
        objective: objectiveTarget
      };
    });
    const leader = getLeader(this.runLeaderId);
    const leaderArt = this.currentFlockLeaderArtAsset();
    const fstate = this.flockState();
    const stateAccent = fstate === 'surging' ? 0x8df4ff : fstate === 'scattered' ? 0xff9d6b : 0xd8a840;
    if (!this.battleForegroundRendererModule) {
      this.renderBattleForegroundFallback(enemies, leader.name, stateAccent);
      return;
    }
    const leaderArtKey = leaderArt && this.textures.exists(leaderArt.key) ? leaderArt.key : undefined;
    let leaderArtFit = 1, leaderArtY = -18;
    if (leaderArtKey) {
      const source = this.textures.get(leaderArtKey).getSourceImage() as { width: number; height: number };
      const bounds = this.enemyTextureVisibleBounds(leaderArtKey);
      // Match enemy placement: prepare geometry in the view, then render it.
      // Leave room between objective and hand for bounded Call/recoil motion.
      leaderArtFit = Math.min(230 / source.width, 288 / source.height,
        240 / Math.max(1, source.height * (bounds.bottom - bounds.top)));
      const height = source.height * leaderArtFit;
      leaderArtY = Math.max(186 - FLOCK_ART_Y - height * (bounds.top - .5),
        Math.min(-18, 426 - FLOCK_ART_Y - height * (bounds.bottom - .5)));
    }
    const iconIds = {
      attack: 'release-card',
      brace: 'cover-shield',
      support: 'flock-heart',
      pressure: 'resonance-battery'
    } as const;
    this.battleForegroundRendererModule.renderBattleForeground({
      scene: this,
      target: this.root,
      width: GAME_WIDTH,
      reducedMotion: prefersReducedMotion(),
      fontFamily: UI_FONT,
      boldFontStyle: UI_BOLD,
      goldColor: UI_GOLD,
      textures: {
        targetReticle: COMBAT_TARGET_RETICLE_TEXTURE,
        targetLockPulse: COMBAT_TARGET_LOCK_PULSE_TEXTURE,
        eliteCrest: uiIconAssets['combat-elite-crest'].key,
        enemyVitalsFrame: uiIconAssets['combat-enemy-vitals-frame'].key,
        enemyStatusChipFrame: uiIconAssets['combat-enemy-status-chip-frame'].key,
        enemyIntentRing: uiIconAssets['enemy-intent-ring'].key
      },
      enemies,
      leader: {
        name: leader.name,
        bird: leader.bird,
        signatureLabel: this.leaderSignatureLabel(),
        artKey: leaderArtKey,
        artFit: leaderArtFit,
        artY: leaderArtY,
        stateAccent,
        x: FLOCK_ART_X,
        y: FLOCK_ART_Y
      },
      onEnemyClicked: (enemyId) => this.onEnemyClicked(enemyId),
      onLeaderClicked: () => this.openOverlay('flock'),
      attachTooltip: (target, title, body) => this.attachTooltip(target, title, body),
      addIntentIcon: (icon, x, y, size) => addUiIconImage(this, iconIds[icon], x, y, size),
      registerEnemyPose: (enemyId, group, scale) => {
        const enemy = this.enemies.find((candidate) => candidate.id === enemyId);
        if (enemy) this.enemyPoseGroups.set(enemyId, { group, enemy, scale });
      },
      textureTop: (key) => this.enemyTextureVisibleBounds(key).top,
    });
  }

  private renderBattleForegroundFallback(
    enemies: Array<{ id: string; name: string; hp: number; maxHp: number; x: number; y: number; selected: boolean; frameColor: number }>,
    leaderName: string,
    stateAccent: number
  ) {
    enemies.forEach((enemy) => {
      const body = this.add.circle(enemy.x, enemy.y, 62, 0x6f4b35, 0.96)
        .setStrokeStyle(enemy.selected ? 5 : 2, enemy.frameColor, 1)
        .setInteractive({ useHandCursor: true });
      body.on('pointerdown', () => this.onEnemyClicked(enemy.id));
      this.root.add(body);
      this.root.add(this.add.text(enemy.x, enemy.y + 82, `${enemy.name}  ${enemy.hp}/${enemy.maxHp}`, {
        fontFamily: UI_FONT,
        fontSize: '16px',
        fontStyle: UI_BOLD,
        color: '#ffffff'
      }).setOrigin(0.5));
    });
    const leader = this.add.circle(FLOCK_ART_X, FLOCK_ART_Y, 70, 0x6f4b35, 0.96)
      .setStrokeStyle(3, stateAccent, 1)
      .setInteractive({ useHandCursor: true });
    leader.on('pointerdown', () => this.openOverlay('flock'));
    this.root.add(leader);
    this.root.add(this.add.text(FLOCK_ART_X, FLOCK_ART_Y, leaderName, {
      fontFamily: UI_FONT,
      fontSize: '16px',
      fontStyle: UI_BOLD,
      color: UI_GOLD
    }).setOrigin(0.5));
  }

  private currentFlockLeaderArtAsset(): { key: string; url: string } | undefined {
    return flockLeaderArtAssets[this.runLeaderId ?? defaultLeaderId];
  }

  // Single compact top status bar: the flock's Cohesion + formation + suit
  // keystones, plus the run resources and map info - so the whole left-mid board
  // is free for the fight and the hand.

  private handleBattleBack() {
    if (!this.fxLayer?.active) return;
    if (this.settingsOverlayOpen) {
      this.settingsOverlayOpen = false;
      playUiSound('close');
      this.renderBattleSystemOverlay();
      return;
    }
    if (this.pauseOverlayOpen) { this.setBattlePaused(false); return; }
    if (this.waymarkDrawerOpen) { this.closeBattleWaymarks(); return; }
    if (this.rewardInspectionCardId) {
      this.closeRewardCardInspection();
      return;
    }
    if (this.combatCardDetail?.active) {
      this.closeCombatCardDetail();
      return;
    }
    if (this.rewardChoiceArmedId) {
      this.rewardChoiceArmedId = undefined;
      playUiSound('close');
      this.requestBattleRender();
      return;
    }
    if (this.rewardSkipArmed) {
      this.rewardSkipArmed = false;
      playUiSound('close');
      announceScreenReader('Skip cancelled; reward unchanged.');
      this.requestBattleRender();
      return;
    }
    if (this.outcomeDetailsOpen) {
      this.closeOutcomeFlightDetails();
      return;
    }
    if (isRunOutcome(this.mode)) {
      this.returnToMainMenu();
      return;
    }
    if (this.inspectOverlay) {
      this.closeOverlay();
      return;
    }
    if (this.returnChoice) {
      playUiSound('locked');
      announceScreenReader('Choose one card from discard to return before continuing.');
      return;
    }
    if (this.discardChoice) {
      if (this.discardChoice.optional) this.confirmDiscardChoice(true);
      else {
        playUiSound('locked');
        announceScreenReader(`Choose ${this.discardChoice.max} card${this.discardChoice.max === 1 ? '' : 's'} to discard before continuing.`);
      }
      return;
    }
    if (this.supplyDrawerArmedIndex !== undefined) {
      this.supplyDrawerArmedIndex = undefined;
      playUiSound('close');
      announceScreenReader('Supply use cancelled; the item remains packed.');
      this.requestBattleRender();
      return;
    }
    const hadDismissibleState = Boolean(
      this.selectedInstanceId
      || this.inspectOverlay
      || this.inspectedCardId
      || this.waymarkDrawerOpen
      || this.supplyDrawerOpen
    );
    if (!hadDismissibleState) {
      if (this.mode === 'battle') this.setBattlePaused(true);
      return;
    }
    if (this.selectedInstanceId) this.statCancelledActions += 1;
    this.hideCardPreview();
    this.selectedInstanceId = undefined;
    this.inspectOverlay = undefined;
    this.inspectedCardId = undefined;
    this.waymarkDrawerOpen = false;
    this.supplyDrawerOpen = false;
    this.supplyDrawerArmedIndex = undefined;
    this.supplyDrawerInputActive = false;
    playUiSound('close');
    this.requestBattleRender();
  }

  private togglePauseOverlay() {
    if (this.mode !== 'battle') return;
    this.setBattlePaused(!this.pauseOverlayOpen);
  }

  private setBattlePaused(paused: boolean) {
    if (this.pauseOverlayOpen === paused) return;
    // A committed Preen has no choice left to display. Resume must retry its
    // durable transition instead of dismissing the save warning into a dead end.
    if (!paused && this.pauseSaveFailed && this.battleRouteCheckpoint.pendingCombatReward?.stage === 'route') {
      if (!(persistActiveRun(this.battleRouteCheckpoint) && this.flushRewardClaims())) {
        playUiSound('locked');
        this.queueBattleSystemOverlayRender();
        return;
      }
      this.pauseSaveFailed = false;
      this.leaveBattleWhilePaused();
      this.returnToRouteMap();
      return;
    }
    this.pauseOverlayOpen = paused;
    birdAudio.play('overlay.set', { id: 'pause', open: paused });
    this.settingsOverlayOpen = false;
    if (paused) {
      playUiSound('confirm');
      this.renderBattleSystemOverlay();
      queueUiIconAssets(this, battleSystemUiIconIds, 'System UI', () => this.renderBattleSystemOverlay());
      this.time.paused = true;
      this.tweens.pauseAll();
      return;
    }

    this.systemOverlayLayer?.destroy(true);
    this.systemOverlayLayer = undefined;
    this.time.paused = false;
    this.tweens.resumeAll();
    playUiSound('close');
    this.combatCardDetail?.getData('updateBindings')?.(controlBindingLabel('previous'), controlBindingLabel('next'), controlBindingLabel('back'));
    (this.cardPreview?.getByName('combat-card-inspect-shortcut') as Phaser.GameObjects.Text | undefined)?.setText(`${controlBindingLabel('guide')} / R3`);
    this.requestBattleRender();
  }

  private leaveBattleWhilePaused() {
    this.pauseOverlayOpen = false;
    this.settingsOverlayOpen = false;
    this.systemOverlayLayer?.destroy(true);
    this.systemOverlayLayer = undefined;
    this.time.paused = false;
    this.tweens.resumeAll();
  }

  private renderBattleSystemOverlay() {
    if (!this.pauseOverlayOpen || !this.sys.settings.active) return;
    this.systemOverlayLayer?.destroy(true);
    const layer = this.add.container(0, 0).setDepth(1000);
    this.systemOverlayLayer = layer;
    const addTo = (obj: Phaser.GameObjects.GameObject) => layer.add(obj);

    if (this.settingsOverlayOpen) {
      renderSettingsMenuOverlay(this, addTo, {
        title: 'Settings',
        subtitle: `${currentMap().name} / Combat`,
        onClose: () => {
          this.settingsOverlayOpen = false;
          playUiSound('close');
          this.queueBattleSystemOverlayRender();
        },
        onToggleAudio: () => {},
        onSetMusicVolume: (value) => {
          birdAudio.setMusicVolume(value);
          this.queueBattleSystemOverlayRender();
        },
        onSetSfxVolume: (value) => {
          birdAudio.setSfxVolume(value);
          this.queueBattleSystemOverlayRender();
        },
        onSetVoiceVolume: (value) => {
          birdAudio.setVoiceVolume(value);
          this.queueBattleSystemOverlayRender();
        },
        onSetAmbienceVolume: (value) => {
          birdAudio.setAmbienceVolume(value);
          this.queueBattleSystemOverlayRender();
        },
        onSetMotionPreference: (value) => {
          setMotionPreference(value);
          this.queueBattleSystemOverlayRender();
        },
        onSetVisualContrastPreference: (value) => {
          setVisualContrastPreference(value);
          this.queueBattleSystemOverlayRender();
        },
        onSetColorCuePreference: (value) => {
          setColorCuePreference(value);
          this.handRenderKey = '';
          this.requestBattleRender();
          this.queueBattleSystemOverlayRender();
        },
        onSetScreenShakePreference: (value) => {
          setScreenShakePreference(value);
          this.queueBattleSystemOverlayRender();
        },
        onSetFlashEffectsPreference: (value) => {
          setFlashEffectsPreference(value);
          this.queueBattleSystemOverlayRender();
        },
        onSetGraphicsQualityPreference: (value) => {
          setGraphicsQualityPreference(value);
          this.queueBattleSystemOverlayRender();
        },
        onSetCombatPacePreference: (value) => {
          setCombatPacePreference(value);
          this.queueBattleSystemOverlayRender();
        },
        onSetAnimationPacePreference: (value) => {
          setAnimationPacePreference(this, value);
          this.queueBattleSystemOverlayRender();
        },
        onSetTextPacePreference: (value) => {
          setTextPacePreference(value);
          this.queueBattleSystemOverlayRender();
        },
        onSetScreenReaderPreference: (value) => {
          setScreenReaderPreference(value);
          this.queueBattleSystemOverlayRender();
        },
        onToggleFullscreen: () => {
          this.scale.toggleFullscreen();
          this.queueBattleSystemOverlayRender();
        }
      });
      this.children.bringToTop(layer);
      this.tweens.pauseAll();
      return;
    }

    renderPauseMenuOverlay(this, addTo, {
      title: 'Battle Paused',
      saveFailed: this.pauseSaveFailed,
      subtitle: this.battleRouteCheckpoint.pendingCombatReward
        ? 'Main Menu saves this reward step. Continue returns here.'
        : 'Main Menu returns to the route checkpoint before this fight.',
      details: [
        ['Cohesion', `${this.flock.hp}/${this.flock.maxHp}`],
        ['Wingbeats', `${this.energy}`],
        ['Deck', `${this.allDeckCards().length} cards`],
        ['Turn', `${this.turn}`],
      ],
      onResume: () => this.setBattlePaused(false),
      onMenu: () => {
        this.pauseSaveFailed = !(persistActiveRun(this.battleRouteCheckpoint) && this.flushRewardClaims());
        if (this.pauseSaveFailed) {
          announceScreenReader('Flight could not be saved. Your battle is still paused. Retry Main Menu, or Resume and keep this tab open.');
          playUiSound('locked');
          this.queueBattleSystemOverlayRender();
          return;
        }
        this.leaveBattleWhilePaused();
        playUiSound('close');
        this.scene.start('MenuScene');
      },
      onToggleAudio: () => {},
      onSettings: () => this.openSettingsOverlay()
    });
    this.children.bringToTop(layer);
    this.tweens.pauseAll();
  }

  private queueBattleSystemOverlayRender() {
    if (this.systemOverlayRefreshQueued) return;
    this.systemOverlayRefreshQueued = true;
    this.events.once('postupdate', () => {
      this.systemOverlayRefreshQueued = false;
      if (!this.sys.settings.active || !this.pauseOverlayOpen) return;
      this.renderBattleSystemOverlay();
    });
  }

  private openSettingsOverlay() {
    if (!this.pauseOverlayOpen) return;
    this.settingsOverlayOpen = true;
    playUiSound('confirm');
    queueUiIconAssets(this, battleSystemUiIconIds, 'Settings UI', () => this.queueBattleSystemOverlayRender());
    this.queueBattleSystemOverlayRender();
  }

  private renderTopBar() {
    const combatNode = currentCombatNodes()[this.currentRouteIndex];
    const fullDeckSize = this.allDeckCards().length;
    const hudObjects: Phaser.GameObjects.GameObject[] = [];
    renderUnifiedRunHud(this, (obj) => hudObjects.push(obj), {
      context: 'battle',
      title: currentMap().name,
      subtitle: `${combatNode.label} / Combat`,
      cohesion: `${this.flock.hp}/${this.flock.maxHp}`,
      scrap: this.scrap,
      deckSize: fullDeckSize,
      waymarks: this.routeMarks.length,
      supplies: `${this.runSupplies.length}/${this.runSupplyCapacity}`,
      statusLabel: this.flockState().toUpperCase(),
      statusColor: this.flockState() === 'surging' ? '#8df4ff' : this.flockState() === 'scattered' ? '#ff9d6b' : '#ffe1a3',
      flow: this.flock.flow,
      flowMax: this.flock.flowMax,
      flowPreview: this.getSelectedCard() && this.cardBuildsFlow(this.getSelectedCard()!) && this.flock.flow < this.flock.flowMax ? 1 : 0,
      cover: this.flock.block,
      // This is a Roost decision forecast, not a remaining-action ledger.
      // During resolution some enemies have already advanced their intent.
      incoming: this.combatAnimationPending ? undefined : this.incomingFlockDamagePreview(),
      suitCounts: this.flockSuitCounts(),
      wingbeats: `${this.energy}/${3 + this.nextTurnEnergyBonus}`,
      resonance: `${this.spark}/5`,
      railIcon: 'battle-hud-command-rail',
      onWaymarks: () => {
        this.toggleBattleWaymarks();
      },
      onSupplies: () => {
        if (this.combatAnimationPending) return;
        this.toggleBattleSupplyDrawer(false);
      },
      onDeck: () => {
        if (this.combatAnimationPending) return;
        this.openOverlay('deck');
      }
    });
    this.root.add(hudObjects);
    renderPauseToggleControl(this, (obj) => this.root.add(obj), GAME_WIDTH - 100, 45, () => this.togglePauseOverlay());
    renderAudioToggleControl(this, (obj) => this.root.add(obj), GAME_WIDTH - 34, 45);
  }

  // Shared tooltip: shown on hover, removed on pointer-out. Added to root so it
  // is cleared on the next full redraw (Phase 1 Tooltip System).
  private attachTooltip(target: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc | Phaser.GameObjects.Text, title: string, body: string) {
    target.setInteractive({ useHandCursor: target.input?.cursor === 'pointer' });
    let tip: Phaser.GameObjects.Container | undefined;
    target.on('pointerover', () => { tip = this.buildTooltip(title, body, target.x, target.y); });
    target.on('pointerout', () => { tip?.destroy(true); tip = undefined; });
  }

  private buildTooltip(title: string, body: string, x: number, y: number) {
    const width = 360;
    const clampedX = Math.max(width / 2 + 8, Math.min(GAME_WIDTH - width / 2 - 8, x));
    const container = this.add.container(0, 0);
    const titleText = this.add.text(clampedX - width / 2 + 16, 12, title, {
      fontFamily: UI_FONT, fontSize: '21px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: width - 32, useAdvancedWrap: true }
    }).setName('combat-tooltip-title');
    const bodyText = this.add.text(clampedX - width / 2 + 16, titleText.getBounds().bottom + 8, body, {
      fontFamily: UI_FONT, fontSize: '19px', color: UI_BODY, wordWrap: { width: width - 32, useAdvancedWrap: true }
    }).setName('combat-tooltip-body');
    const height = bodyText.getBounds().bottom + 12;
    const top = Phaser.Math.Clamp(y + 30, 8, Math.max(8, GAME_HEIGHT - height - 8));
    titleText.y += top; bodyText.y += top;
    const bg = this.add.rectangle(clampedX, top + height / 2, width, height, 0x05161f, 0.98)
      .setStrokeStyle(1, 0x7ab8d6, 0.95).setName('combat-tooltip-frame');
    container.add(bg);
    container.add(titleText);
    container.add(bodyText);
    this.root.add(container);
    return container;
  }

  // Compact combat controls live near the piles; permanent text stays out of
  // the playfield so the hand and enemy stage carry the player's attention.
  private battleHudGuidanceView() {
    if (this.combatAnimationPending || this.discardChoice || this.returnChoice || this.mode !== 'battle') return undefined;
    const moltCard = this.firstMoltGuideCard();
    if (moltCard) {
      markFirstMoltGuideSeen();
      return {
        text: `Play ${displayName(moltCard)} for less this beat. Roost to open the sky.`,
        accent: 0xff9d4d,
      };
    }
    if (!this.isGuidedFirstCombat()) {
      const intro = this.termIntroductionView();
      if (intro) return intro;
      const hints: Array<{ text: string; accent: number }> = [];
      this.events.emit('opening-coaching', hints);
      return hints[0];
    }
    const guideStep = firstFlightGuideStep();
    markFirstFlightGuideSeen(guideStep);
    // First sight of each themed term carries its plain-language gloss.
    const text = guideStep === 'card'
      ? (() => {
          const card = this.firstCombatGuideCard();
          const target = card ? this.firstCombatGuideTarget(card) : undefined;
          if (!card) return 'Select a card, inspect its target, then confirm to play.';
          const cost = this.effectiveCost(card);
          const action = target ? `target ${target.name}` : 'confirm to play';
          return `Select ${displayName(card)}; ${action}. ${cost} Wingbeat${cost === 1 ? '' : 's'} (energy).`;
        })()
      : guideStep === 'roost'
        ? 'Roost (end turn) when ready. Cover (block) absorbs hits; Wingbeats (energy) reset next beat.'
        : 'Read the enemy tell. Cover (block) prevents damage and protects Flow.';
    return { text, accent: this.cardsPlayedThisTurn === 0 ? UI_FIELD.gold : UI_FIELD.cyan };
  }

  private renderCombatInputHint() {
    if (this.returnChoice && !this.settingsOverlayOpen && !this.pauseOverlayOpen) {
      const cards = this.returnChoice.candidateIds.flatMap((instanceId) => {
        const card = this.discardPile.find((candidate) => candidate.instanceId === instanceId);
        if (!card) return [];
        const contract = this.activeCardContract(card);
        return [{
          instanceId: card.instanceId,
          id: card.id,
          name: displayName(card),
          cost: this.effectiveCost(card),
          role: contract.role,
          summary: formatEffects(contract.effects),
        }];
      });
      this.returnChoiceModule?.renderReturnChoiceOverlay({
        scene: this,
        target: this.root,
        gameWidth: GAME_WIDTH,
        gameHeight: GAME_HEIGHT,
        fontFamily: UI_FONT,
        boldFontStyle: UI_BOLD,
        gold: UI_FIELD.gold,
        cyan: UI_FIELD.cyan,
        choice: this.returnChoice,
        cards,
        onFocus: (instanceId) => this.focusReturnChoice(instanceId),
        onChoose: (instanceId) => this.chooseReturnCard(instanceId),
      });
      return;
    }
    if (this.discardChoice && !this.settingsOverlayOpen && !this.pauseOverlayOpen) {
      // The required decision temporarily owns the command lane. Roost and
      // history are locked here; do not leave their labels behind the picker.
      for (const child of this.root.list) {
        if (child.name.startsWith('combat-roost-') || child.name.startsWith('combat-log-')) {
          (child as Phaser.GameObjects.Text).setVisible(false).disableInteractive();
        }
      }
      this.discardChoiceModule?.renderDiscardChoiceRail({
        scene: this,
        target: this.root,
        gameWidth: GAME_WIDTH,
        fontFamily: UI_FONT,
        boldFontStyle: UI_BOLD,
        gold: UI_FIELD.gold,
        danger: UI_FIELD.danger,
        choice: this.discardChoice,
        onConfirm: () => this.confirmDiscardChoice(),
      });
      return;
    }
    const rewardMode = this.mode === 'cardReward' || this.mode === 'upgradeReward' || this.mode === 'waymarkReward';
    const retention = this.mode === 'battle' ? this.retentionPlan() : undefined;
    const retentionActive = Boolean(retention?.count);
    const skipCommitmentActive = this.mode === 'cardReward' && this.rewardSkipArmed;
    if ((!this.battleInputActive && !skipCommitmentActive) || this.settingsOverlayOpen || this.pauseOverlayOpen || this.inspectOverlay || this.waymarkDrawerOpen || this.supplyDrawerOpen) return;
    if (this.mode !== 'battle' && !rewardMode) return;
    if (!rewardMode && this.selectedInstanceId && !retentionActive) return;
    // The first-flight lesson already explains the current action.
    if (!rewardMode && !retentionActive && this.isGuidedFirstCombat()) return;
    if (!rewardMode && !retentionActive && !this.isGuidedFirstCombat() && (this.cardsPlayedThisTurn > 0 || Boolean(this.selectedInstanceId))) return;
    const armedReward = rewardMode && Boolean(this.rewardChoiceArmedId || this.rewardSkipArmed);
    const y = rewardMode ? 213 : 112;
    const format = (mode: 'pointer' | 'keyboard' | 'controller') => {
      if (!rewardMode) return retentionActive
        ? retainInputHint(retention?.count ?? 0, retention?.cards.map(card => displayName(card)) ?? [], controlBindingLabel('roost'))
        : mode === 'controller' ? 'D-pad: card / target · A: play · Y: Roost · B: back'
        : mode === 'pointer' ? 'Select a card, then a target · Roost ends your turn'
        : `${controlBindingLabel('previous')}/${controlBindingLabel('next')}: card · Up/Down: target · ${controlBindingLabel('confirm')}: play · ${controlBindingLabel('roost')}: Roost`;
      if (!this.rewardPresentationReady()) return 'Preparing choices · Input locked';
      if (mode === 'pointer') return this.rewardSkipArmed
        ? 'Click Skip again to confirm · Back cancels'
        : armedReward ? 'Click Confirm to claim · Read inspects without claiming' : 'Select a choice · Read inspects without claiming';
      const controller = mode === 'controller';
      const confirm = controller ? 'A' : controlBindingLabel('confirm');
      const back = controller ? 'B' : controlBindingLabel('back');
      const choose = controller ? 'D-pad' : `${controlBindingLabel('previous')}/${controlBindingLabel('next')}`;
      const read = controller ? 'Y' : controlBindingLabel('roost');
      const skip = controller ? 'X' : controlBindingLabel('skipReward');
      return this.rewardSkipArmed ? `${skip}: confirm Skip · ${back}: cancel · ${choose}: choose card`
        : `${choose}: choose · ${confirm}: ${armedReward ? 'confirm' : 'select'} · ${read}: read · ${back}: cancel${this.mode === 'cardReward' ? ` · ${skip}: Skip` : ''}`;
    };
    if (!rewardMode) for (const child of this.root.list) {
      if (['combat-log-hit', 'combat-log-latest', 'first-combat-guidance'].includes(child.name))
        (child as Phaser.GameObjects.Rectangle).setVisible(false);
    }
    const hint = this.add.text(GAME_WIDTH / 2, y, '', {
      fontFamily: UI_FONT, fontSize: UI_TYPE.secondary, resolution: 2, color: armedReward ? UI_GOLD : '#f4fdff',
      wordWrap: { width: 1040 }, align: 'center',
    }).setOrigin(0.5).setName('combat-input-hint');
    this.root.add(bindChoiceHint(this, hint, format));
  }

  private battleHudObjectiveView() {
    const objective = this.encounterObjectiveTextState();
    if (!objective || this.mode !== 'battle') return undefined;
    // A living priority target already carries the deadline and full tooltip.
    // Do not repeat that goal in a second plaque over another enemy's head.
    if (objective.type === 'priority' && this.battleForegroundRendererModule
      && this.enemies.some(enemy => enemy.id === objective.targetEnemyId && enemy.hp > 0)) return undefined;
    const accent = objective.status === 'complete' ? UI_FIELD.green : objective.status === 'failed' ? UI_FIELD.danger : UI_FIELD.gold;
    return {
      accent,
      text: `${objective.title}  /  ${objective.progress.label}  /  +${objective.bonusScrap}${objective.status === 'active' ? '' : `  /  ${objective.status.toUpperCase()}`}`,
      detail: `${objective.description}. Complete the goal for +${objective.bonusScrap} Scrap.`,
    };
  }

  private battleHudBeatView() {
    const acceleration = this.combatFxModule?.enemyTurnAccelerationState(this);
    return {
      active: this.combatAnimationPending && this.combatEnemyTurnBeat !== 'idle',
      turn: this.turn,
      phase: this.combatEnemyTurnBeat,
      move: compactSentenceText(this.combatEnemyTurnMove || 'Enemy phase', 24, 1),
      progress: this.enemyTurnBeatProgress(),
      acceleration: acceleration ? {
        available: acceleration.available,
        active: acceleration.active,
        multiplier: acceleration.multiplier,
      } : undefined,
    };
  }

  private battleHudRenderContext(includeSupplemental = false): Parameters<BattleHudRendererModule['renderBattleHud']>[0] {
    const latestEntries = this.log.slice(-4);
    const latest = this.log.at(-1) ?? 'The crossing is quiet.';
    const incoming = this.incomingFlockDamagePreview();
    return {
      roostLabel: `Roost · ${controlBindingLabel('roost')}`,
      roostPreview: `${incoming.uncertainty.length ? 'Est.' : 'End turn ·'} ${incoming.hpLoss} HP at risk`,
      roostDetail: `${incoming.total} incoming; ${incoming.blocked} blocked; ${incoming.afterHp} Cohesion left. ${incoming.scope}.${incoming.uncertainty.length ? ` Estimate: ${incoming.uncertainty.join('; ')}.` : ''}`,
      scene: this,
      root: this.root,
      gameWidth: GAME_WIDTH,
      fontFamily: UI_FONT,
      boldFontStyle: UI_BOLD,
      assets: {
        beatProgressFrame: uiIconAssets['combat-beat-progress-frame'].key,
        cardBack: COMBAT_CARD_BACK_TEXTURE,
        discardIcon: uiIconAssets['discard-basket'].key,
        drawIcon: uiIconAssets['draw-stack'].key,
        logEventBead: uiIconAssets['combat-log-event-bead'].key,
        logFrame: uiIconAssets['combat-log-frame'].key,
        pileDock: uiIconAssets['combat-pile-dock'].key,
        roostCommandFrame: uiIconAssets['combat-roost-command-frame'].key,
        roostIcon: uiIconAssets['roost-nest'].key,
      },
      piles: [
        { ...this.drawPilePos(), count: this.drawPile.length, label: 'DRAW', accent: 0x24d0d6, onInspect: () => this.openOverlay('draw') },
        { ...this.discardPilePos(), count: this.discardPile.length, label: 'DISCARD', accent: 0xd8a840, onInspect: () => this.openOverlay('discard') },
      ],
      log: {
        latest: compactSentenceText(latest, 58, 1),
        tooltip: latestEntries.join(' / ') || 'Recent combat events.',
        historyLabel: `History · Shift+${controlBindingLabel('guide')} / L3`,
        onHistory: () => this.openCombatHistory(),
      },
      beat: this.battleHudBeatView(),
      guidance: includeSupplemental ? this.battleHudGuidanceView() : undefined,
      objective: includeSupplemental ? this.battleHudObjectiveView() : undefined,
      onRoost: () => this.endTurnAnimated(),
      attachTooltip: (target, title, body) => this.attachTooltip(target, title, body),
    };
  }

  private renderBattleHudPiles() {
    if (this.battleHudRendererModule) {
      this.battleHudRendererModule.renderBattleHudPiles(this.battleHudRenderContext());
      return;
    }
    this.renderBattleHudPilesFallback();
  }

  private renderBattleHudOverlay() {
    if (this.battleHudRendererModule) {
      const result = this.battleHudRendererModule.renderBattleHudOverlay(this.battleHudRenderContext(true));
      this.enemyTurnBeatUi = result.beatUi;
      return;
    }
    this.enemyTurnBeatUi = this.renderBattleHudOverlayFallback();
  }

  private renderBattleHudPilesFallback() {
    const piles = [
      { ...this.drawPilePos(), count: this.drawPile.length, label: 'DRAW', accent: 0x24d0d6, onInspect: () => this.openOverlay('draw') },
      { ...this.discardPilePos(), count: this.discardPile.length, label: 'DISCARD', accent: 0xd8a840, onInspect: () => this.openOverlay('discard') },
    ];
    piles.forEach((pile) => {
      const hit = this.add.rectangle(pile.x, pile.y, 104, 132, 0x07101c, 0.88)
        .setStrokeStyle(2, pile.accent, 0.86)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', pile.onInspect);
      this.root.add(hit);
      this.root.add(this.add.text(pile.x, pile.y - 8, pile.label, { fontFamily: UI_FONT, fontSize: '12px', fontStyle: UI_BOLD, color: '#d9e4ee' }).setOrigin(0.5));
      this.root.add(this.add.text(pile.x, pile.y + 18, `${pile.count}`, { fontFamily: UI_FONT, fontSize: '20px', fontStyle: UI_BOLD, color: '#ffffff' }).setOrigin(0.5));
    });
  }

  private renderBattleHudOverlayFallback() {
    const beatUi = this.renderBattleBeatBadgeFallback();
    const log = compactSentenceText(this.log.at(-1) ?? 'The crossing is quiet.', 58, 1);
    this.root.add(this.add.text(650, 440, log, { fontFamily: UI_FONT, fontSize: '12px', color: '#d9e4ee', fixedWidth: 340, align: 'center' }).setOrigin(0.5).setName('combat-log-latest'));
    const roost = this.add.rectangle(1192, 470, 104, 104, 0x10202c, 0.94)
      .setStrokeStyle(2, UI_FIELD.gold, 0.9)
      .setInteractive({ useHandCursor: true });
    roost.on('pointerdown', () => this.endTurnAnimated());
    this.root.add(roost);
    this.root.add(this.add.text(1192, 470, 'ROOST', { fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: '#fff0b8' }).setOrigin(0.5));
    const guidance = this.battleHudGuidanceView();
    if (guidance) this.root.add(this.add.text(GAME_WIDTH / 2, 112, guidance.text, { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: '#f1f8ff' }).setOrigin(0.5));
    const objective = this.battleHudObjectiveView();
    if (objective) this.root.add(this.add.text(1068, 154, objective.text, { fontFamily: UI_FONT, fontSize: '10px', fontStyle: UI_BOLD, color: '#e8f1f7', fixedWidth: 330, align: 'center' }).setOrigin(0.5));
    return beatUi;
  }

  private renderBattleBeatBadgeFallback() {
    const beatUi = this.add.container(0, 0).setName('combat-beat-progress-ui');
    this.root.add(beatUi);
    const beat = this.battleHudBeatView();
    beatUi.add(this.add.text(1252, 104, beat.active ? beat.progress.label.toUpperCase() : `Beat ${beat.turn}`, {
      fontFamily: UI_FONT, fontSize: '15px', fontStyle: UI_BOLD, color: '#fff0b8', stroke: '#05070c', strokeThickness: 2,
    }).setOrigin(1, 0.5));
    return beatUi;
  }

  private isGuidedFirstCombat() {
    const step = firstFlightGuideStep();
    return activeMapIndex === 0 && ['card', 'roost', 'reward'].includes(step) && this.turn <= 3;
  }

  private renderSelectedCardOutcomePreview(preview = this.selectedCardOutcomePreview()) {
    if (this.discardChoice) return;
    if (!preview || this.combatAnimationPending || this.mode !== 'battle') return;
    const targetHp = preview.result.targetHp;
    const enemy = targetHp && targetHp.after < targetHp.before
      ? this.enemies.find((candidate) => candidate.id === targetHp.enemyId && candidate.hp > 0)
      : undefined;
    const hp = enemy ? this.enemyHpBar(enemy) : undefined;
    const maxHp = targetHp ? Math.max(1, targetHp.max) : 1;
    const view = {
      card: preview.card,
      target: preview.target,
      summary: preview.summary,
      fields: preview.fields,
      survival: preview.survival,
      targetHp: targetHp && hp ? {
        x: hp.x,
        y: hp.y,
        width: hp.w,
        height: hp.h,
        beforeFraction: Phaser.Math.Clamp(targetHp.before / maxHp, 0, 1),
        afterFraction: Phaser.Math.Clamp(targetHp.after / maxHp, 0, 1),
        after: targetHp.after,
        defeated: targetHp.defeated,
      } : undefined,
    };
    if (this.battleHudRendererModule) {
      this.selectionOutcomePreview = this.battleHudRendererModule.renderBattleSelectionPreview({
        scene: this,
        root: this.root,
        gameWidth: GAME_WIDTH,
        fontFamily: UI_FONT,
        boldFontStyle: UI_BOLD,
        cyan: UI_FIELD.cyan,
        gold: UI_FIELD.gold,
        onConfirm: () => this.selectedInstanceId && this.onCardClicked(this.selectedInstanceId),
      }, view);
      return;
    }
    const container = this.add.container(0, 0).setName('combat-selection-preview');
    container.add(this.add.rectangle(GAME_WIDTH / 2, 440, 510, 38, 0x07101a, 0.97)
      .setStrokeStyle(2, UI_FIELD.cyan, 0.88)
      .setName('combat-outcome-preview'));
    container.add(this.add.text(GAME_WIDTH / 2, 440, view.summary, {
      fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: '#dffbff', fixedWidth: 480, align: 'center', maxLines: 1,
    }).setOrigin(0.5));
    this.selectionOutcomePreview = container;
    this.root.add(container);
  }

  private refreshCombatSelectionPreview() {
    this.selectionOutcomePreview?.destroy(true);
    this.selectionOutcomePreview = undefined;
    this.root.list
      .filter((child) => child.name === 'combat-flow-preview-pip' || child.name === 'combat-enemy-outcome-preview')
      .forEach((child) => child.destroy());
    const card = this.getSelectedCard();
    const preview = this.selectedCardOutcomePreview();
    let previewFlow = this.flock.flow;
    if (card && preview) {
      previewFlow = Math.min(this.flock.flowMax, preview.result.flow.after);
      const flowX = (FLOCK_HP_BAR.x - FLOCK_HP_BAR.w / 2) + FLOCK_HP_BAR.w + FLOW_HUD_X_OFFSET;
      const flowY = FLOCK_HP_BAR.y + FLOW_HUD_Y_OFFSET + practiceHudOffset();
      const pipStart = flowX + FLOW_HUD_PIP_OFFSET;
      for (let i = this.flock.flow; i < previewFlow; i += 1) {
        this.root.add(this.add.circle(pipStart + i * FLOW_HUD_PIP_GAP, flowY, 5, UI_FIELD.gold, 0.94)
          .setStrokeStyle(1, 0xffe7a8, 0.8)
          .setName('combat-flow-preview-pip'));
      }
    }
    const [flowStatus, flowAccent, flowStatusColor, flowFill] = flowHudPresentation(
      this.flock.flow,
      this.flock.flowMax,
      previewFlow,
      this.flockState().toUpperCase(),
      this.incomingFlockDamagePreview(),
    );
    const status = this.root.list.find((child) => child.name === 'combat-flow-status') as Phaser.GameObjects.Text | undefined;
    status?.setText(flowStatus).setColor(flowStatusColor);
    const rail = this.root.list.find((child) => child.name === 'combat-flow-rail') as Phaser.GameObjects.Rectangle | undefined;
    rail?.setFillStyle(flowFill, 0.96).setStrokeStyle(1, flowAccent, 0.3);
    this.renderSelectedCardOutcomePreview(preview);
  }

  private createEncounterObjective(routeNode: RouteNode): EncounterObjective | undefined {
    if (routeNode.type === 'boss') return undefined;
    if (activeMapIndex === 0 && this.runCombatResults.length === 0) return undefined;
    if (activeMapIndex === 0 && this.runCombatResults.length === 1) {
      return {
        type: 'preserve_flow',
        title: 'Hold Formation',
        description: 'Win with at least 1 Flow',
        bonusScrap: 12
      };
    }
    if (activeMapIndex === 0 && this.runCombatResults.length === 2) {
      return {
        type: 'clean_roost',
        title: 'Measured Flight',
        description: 'Win without overextending',
        bonusScrap: 14
      };
    }
    const swiftClear: EncounterObjective = {
      type: 'swift_clear',
      title: 'Clear The Lane',
      description: 'Win by Beat 3',
      bonusScrap: 16,
      deadlineTurn: 3
    };
    const cleanRoost: EncounterObjective = {
      type: 'clean_roost',
      title: 'Measured Flight',
      description: 'Win without overextending',
      bonusScrap: 14
    };
    const finishGuarded: EncounterObjective = {
      type: 'finish_guarded',
      title: 'Shelter Intact',
      description: 'Win with Cover remaining',
      bonusScrap: 13
    };
    const noDamage: EncounterObjective = {
      type: 'no_damage',
      title: 'Untouched Crossing',
      description: 'Win without Cohesion loss',
      bonusScrap: 18
    };
    const triggerSurge: EncounterObjective = {
      type: 'trigger_surge',
      title: 'Bright Signal',
      description: 'Trigger Surge before victory',
      bonusScrap: 15
    };
    const preserveFlow: EncounterObjective = {
      type: 'preserve_flow',
      title: 'Hold Formation',
      description: 'Win with at least 1 Flow',
      bonusScrap: 12
    };
    const bankWingbeat: EncounterObjective = {
      type: 'bank_wingbeat',
      title: 'Keep A Reserve',
      description: 'Roost with at least 1 Wingbeat unspent, then win',
      bonusScrap: 14,
      targetAmount: 1
    };
    const blockTarget = activeMapIndex >= 3 ? 12 : activeMapIndex === 1 ? 8 : 6;
    const blockDamage: EncounterObjective = {
      type: 'block_damage',
      title: activeMapIndex >= 3 ? 'Weather The Heights' : 'Breakwater Guard',
      description: `Block at least ${blockTarget} damage before victory`,
      bonusScrap: activeMapIndex >= 3 ? 18 : 15,
      targetAmount: blockTarget
    };
    const districtObjectives: Record<number, EncounterObjective[]> = {
      0: [cleanRoost, finishGuarded, noDamage, preserveFlow, bankWingbeat],
      1: [bankWingbeat, blockDamage, noDamage, cleanRoost, finishGuarded],
      2: [triggerSurge, preserveFlow, bankWingbeat, swiftClear, cleanRoost],
      3: [blockDamage, bankWingbeat, finishGuarded, noDamage, swiftClear]
    };
    const objectives: EncounterObjective[] = [...(districtObjectives[activeMapIndex] ?? districtObjectives[0])];
    if (this.enemies.length > 1) {
      const target = [...this.enemies].sort((a, b) => (b.roles.includes('support') ? 1 : 0) - (a.roles.includes('support') ? 1 : 0))[0];
      objectives.push({
        type: 'priority',
        title: 'Break The Signal',
        description: `Defeat ${target.name} by Beat 3`,
        bonusScrap: 14,
        targetEnemyId: target.id,
        deadlineTurn: 3
      });
    }
    const index = hashSeed(`${activeSeed}:${activeMapIndex}:${routeNode.id}:objective`, this.enemies.length) % objectives.length;
    return objectives[index];
  }

  private encounterObjectiveStatus(terminalResult?: 'win' | 'loss'): (EncounterObjective & { status: 'active' | 'complete' | 'failed' }) | undefined {
    const objective = this.encounterObjective;
    if (!objective) return undefined;
    if (terminalResult === 'loss') return { ...objective, status: 'failed' };
    const combatWon = this.enemies.every((enemy) => enemy.hp <= 0) || !!this.signatureWin();
    if (objective.type === 'priority') {
      const defeatedTurn = objective.targetEnemyId ? this.enemyDefeatedTurns.get(objective.targetEnemyId) : undefined;
      if (defeatedTurn !== undefined) return { ...objective, status: defeatedTurn <= (objective.deadlineTurn ?? 3) ? 'complete' : 'failed' };
      return { ...objective, status: this.turn > (objective.deadlineTurn ?? 3) ? 'failed' : 'active' };
    }
    if (objective.type === 'swift_clear') {
      return { ...objective, status: combatWon ? (this.turn <= (objective.deadlineTurn ?? 3) ? 'complete' : 'failed') : this.turn > (objective.deadlineTurn ?? 3) ? 'failed' : 'active' };
    }
    if (objective.type === 'clean_roost') {
      return { ...objective, status: this.statOverextensions > 0 ? 'failed' : combatWon ? 'complete' : 'active' };
    }
    if (objective.type === 'finish_guarded') {
      return { ...objective, status: combatWon ? (this.flock.block > 0 ? 'complete' : 'failed') : 'active' };
    }
    if (objective.type === 'no_damage') {
      return { ...objective, status: this.statTaken > 0 ? 'failed' : combatWon ? 'complete' : 'active' };
    }
    if (objective.type === 'trigger_surge') {
      return { ...objective, status: this.statSurgesTriggered > 0 ? 'complete' : combatWon ? 'failed' : 'active' };
    }
    if (objective.type === 'bank_wingbeat') {
      return { ...objective, status: combatWon ? (this.statUnspentWingbeatAtRoost >= (objective.targetAmount ?? 1) ? 'complete' : 'failed') : 'active' };
    }
    if (objective.type === 'block_damage') {
      return { ...objective, status: combatWon ? (this.statBlocked >= (objective.targetAmount ?? 1) ? 'complete' : 'failed') : 'active' };
    }
    return { ...objective, status: combatWon ? (this.flock.flow > 0 ? 'complete' : 'failed') : 'active' };
  }

  private encounterObjectiveProgress(objective: EncounterObjective & { status: 'active' | 'complete' | 'failed' }): EncounterObjectiveProgress {
    if (objective.type === 'priority') {
      const target = this.enemies.find((enemy) => enemy.id === objective.targetEnemyId);
      const maximum = Math.max(1, target?.maxHp ?? 1);
      const currentHp = Math.max(0, target?.hp ?? 0);
      return {
        current: maximum - currentHp,
        target: maximum,
        label: `${target?.name ?? 'Priority target'} ${currentHp}/${maximum}  /  Beat ${this.turn}/${objective.deadlineTurn ?? 3}`
      };
    }
    if (objective.type === 'swift_clear') {
      return { current: Math.min(this.turn, objective.deadlineTurn ?? 3), target: objective.deadlineTurn ?? 3, label: `Beat ${this.turn}/${objective.deadlineTurn ?? 3}` };
    }
    if (objective.type === 'clean_roost') {
      return { current: this.statOverextensions === 0 ? 1 : 0, target: 1, label: `Overextensions ${this.statOverextensions}/0` };
    }
    if (objective.type === 'finish_guarded') {
      return { current: Math.min(1, this.flock.block), target: 1, label: `Cover ${this.flock.block}  /  finish guarded` };
    }
    if (objective.type === 'no_damage') {
      return { current: this.statTaken === 0 ? 1 : 0, target: 1, label: `Cohesion lost ${this.statTaken}/0` };
    }
    if (objective.type === 'trigger_surge') {
      return { current: Math.min(1, this.statSurgesTriggered), target: 1, label: `Surge ${Math.min(1, this.statSurgesTriggered)}/1` };
    }
    if (objective.type === 'bank_wingbeat') {
      const target = objective.targetAmount ?? 1;
      return { current: Math.min(target, this.statUnspentWingbeatAtRoost), target, label: `Wingbeat banked ${Math.min(target, this.statUnspentWingbeatAtRoost)}/${target}` };
    }
    if (objective.type === 'block_damage') {
      const target = objective.targetAmount ?? 1;
      return { current: Math.min(target, this.statBlocked), target, label: `Damage blocked ${Math.min(target, this.statBlocked)}/${target}` };
    }
    return { current: Math.min(1, this.flock.flow), target: 1, label: `Flow ${this.flock.flow}/1` };
  }

  private encounterObjectiveTextState() {
    const objective = this.encounterObjectiveStatus();
    return objective ? { ...objective, progress: this.encounterObjectiveProgress(objective) } : undefined;
  }

  private updateEncounterObjectiveFeedback() {
    const objective = this.encounterObjectiveStatus();
    if (!objective) {
      this.encounterObjectiveFeedbackStatus = undefined;
      return;
    }
    const previous = this.encounterObjectiveFeedbackStatus;
    this.encounterObjectiveFeedbackStatus = objective.status;
    if (objective.status === 'active' || previous !== 'active') return;

    const completed = objective.status === 'complete';
    this.encounterObjectiveFeedbackBursts += 1;
    birdAudio.play(completed ? 'objectiveComplete' : 'objectiveMissed', completed ? 1 : 0.86);
    floatingText(
      this,
      this.fxLayer,
      GAME_WIDTH / 2,
      214,
      completed ? `GOAL COMPLETE  +${objective.bonusScrap}` : 'GOAL MISSED',
      completed ? '#9af0bb' : '#ff9b90',
      { name: 'combat-objective-feedback', holdMs: 900 }
    );
    if (completed) {
      this.fxMoteBurst(GAME_WIDTH / 2, 218, UI_FIELD.green, {
        count: 12,
        speed: 82,
        lifespan: 420,
        scale: 0.54,
        gravityY: 0,
        spreadX: 170,
        spreadY: 18,
      });
    }
  }

  private refreshBeatProgressBadge() {
    if (!this.root?.active) return;
    if (this.enemyTurnBeatUi?.active) {
      killTweensForTree(this, this.enemyTurnBeatUi);
      this.enemyTurnBeatUi.destroy(true);
    }
    this.enemyTurnBeatUi = undefined;
    if (this.battleHudRendererModule) {
      this.enemyTurnBeatUi = this.battleHudRendererModule.renderBattleBeatBadge(this.battleHudRenderContext()).setDepth(1);
      return;
    }
    this.enemyTurnBeatUi = this.renderBattleBeatBadgeFallback();
  }

  private renderHand() {
    const focused = this.discardChoice ? this.controllerChoiceIndex
      : this.hand.findIndex(card => card.instanceId === this.selectedInstanceId);
    if (focused >= 0) this.handPage = Math.floor(focused / 5);
    this.handPage = clamp(this.handPage, 0, Math.max(0, Math.ceil(this.hand.length / 5) - 1));
    const renderKey = this.currentHandRenderKey();
    if (this.handRenderKey === renderKey && this.handLayer?.active) {
      this.battleHandReuses += 1;
      this.refreshHandCardSelection();
      return;
    }
    this.battleHandBuilds += 1;
    this.handRenderKey = renderKey;
    this.hideCardPreview(); // a redraw destroys the hovered rect; drop its stale preview
    hideKwTooltip();
    killTweensForTree(this, this.handLayer);
    // The lazy renderer retains card bodies and retires only what left the hand.
    const renderer = this.battleHandRendererModule;
    if (!renderer) this.handLayer.removeAll(true);
    this.handCardRects.clear();
    this.handCardArtLayers.clear();
    this.handCardFrames.clear();
    this.handCardSelectionPulses.clear();
    this.handCardFlowIndicators.clear();
    if (!renderer) {
      if (this.hand.length === 0) return;
      this.renderHandFallback();
      this.renderHandPages();
      return;
    }
    try {
      const result = renderer.renderBattleHand(this.battleHandRenderContext());
      this.handCardRects = result.rects;
      this.handCardArtLayers = result.artLayers;
      this.handCardFrames = result.frames;
      this.handCardSelectionPulses = result.selectionPulses;
      this.handCardFlowIndicators = result.flowIndicators;
    } catch (error) {
      console.warn('Battle hand renderer failed; using compact fallback.', error);
      this.handLayer.removeAll(true);
      this.renderHandFallback();
    }
    if (this.hand.length) this.renderHandPages();
  }

  private renderHandPages() {
    if (this.hand.length <= 5) return;
    this.handLayer.add(this.add.text(80, 393,
      `${this.handPage * 5 + 1}–${Math.min(this.hand.length, this.handPage * 5 + 5)} / ${this.hand.length}`, {
        fontFamily: UI_FONT, fontSize: '19px', color: UI_BODY, resolution: 2,
      }).setOrigin(0.5).setName('combat-hand-page-count'));
    for (const direction of [-1, 1] as const) {
      const enabled = direction < 0 ? this.handPage > 0 : (this.handPage + 1) * 5 < this.hand.length;
      const y = direction < 0 ? 437 : 507;
      const hit = quietButton(this, { x: 80, y, width: 120, label: direction < 0 ? 'Previous' : 'Next', enabled,
        name: direction < 0 ? 'combat-hand-previous' : 'combat-hand-next', onActivate: () => this.changeHandPage(direction) });
      this.handLayer.add([hit, hit.getData('labelObject')]);
    }
  }

  private changeHandPage(direction: -1 | 1) {
    if (this.mode !== 'battle' || (this.combatAnimationPending && !this.discardChoice) || this.combatIntroActive
      || this.combatCardDetail?.active || this.returnChoice || this.pauseOverlayOpen
      || this.settingsOverlayOpen || this.inspectOverlay || this.supplyDrawerOpen || this.waymarkDrawerOpen) return;
    const page = clamp(this.handPage + direction, 0, Math.max(0, Math.ceil(this.hand.length / 5) - 1));
    if (page === this.handPage) return;
    this.handPage = page;
    this.selectedInstanceId = undefined;
    this.controllerChoiceIndex = page * 5;
    this.battleInputActive = false;
    this.hideCardPreview();
    this.requestBattleRender();
    announceScreenReader(`Hand cards ${page * 5 + 1} to ${Math.min(this.hand.length, page * 5 + 5)} of ${this.hand.length}. Nothing played.`);
  }

  private battleHandCardView(card: Card): BattleHandCardView {
    const contract = this.activeCardContract(card);
    const selected = this.selectedInstanceId === card.instanceId;
    const cost = this.effectiveCost(card);
    const buildsFlow = this.cardBuildsFlow(card);
    const surgeNext = this.flock.flow === this.flock.flowMax - 1;
    const guideCard = this.firstCombatGuideCard()?.instanceId === card.instanceId;
    const retention = this.discardChoice ? { count: 0, cards: [] as Card[], selectedPriority: undefined } : this.retentionPlan();
    const retainIndex = retention.cards.findIndex((candidate) => candidate.instanceId === card.instanceId);
    const discardSelectable = this.discardChoice?.candidateIds.includes(card.instanceId);
    const discardOrder = this.discardChoice?.selectedIds.indexOf(card.instanceId) ?? -1;
    const statLabels: Record<string, string> = {
      cohesion: 'Cohesion', damage: 'Damage', cover: 'Cover', draw: 'Hand', resonance: 'Res/turn', regen: 'Regen', moltPower: 'Molt', openSkyGuard: 'Sky Guard',
    };
    return {
      instanceId: card.instanceId,
      name: displayName(card),
      label: cardLabel(card),
      cost,
      canPay: cost <= this.energy && this.mode === 'battle',
      selected,
      guideCard,
      guideMolt: this.firstMoltGuideCard()?.instanceId === card.instanceId,
      accent: card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card),
      usesMolt: Boolean(contract.usesMolt),
      summary: compactHandCardSummary(contract.effects),
      buildsFlow,
      flowVisible: buildsFlow
        && this.flock.flow < this.flock.flowMax
        && (selected || (surgeNext && (!this.isGuidedFirstCombat() || guideCard))),
      surgeNext,
      retainOrder: retainIndex >= 0 ? retainIndex + 1 : undefined,
      retainSelectable: retention.count > 0,
      discardSelectable: this.discardChoice ? discardSelectable : undefined,
      discardSelected: discardOrder >= 0,
      discardFocused: Boolean(this.discardChoice && this.controllerChoiceIndex === this.hand.indexOf(card)),
      discardOrder: discardOrder >= 0 ? discardOrder + 1 : undefined,
      artKey: compactCardArtKey(card),
      snag: isSnagCard(card),
      fallbackLabel: cardLabel(card),
      preview: {
        name: displayName(card),
        cost,
        upgraded: Boolean(card.upgraded),
        accent: card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card),
        artKey: loadedCardArtKey(this, card),
        snag: isSnagCard(card),
        fallbackLabel: cardLabel(card),
        usesMolt: contract.usesMolt,
        currentText: contract.text,
        alternateLabel: contract.usesMolt ? 'NORMAL' : card.moltText ? 'MOLT' : undefined,
        alternateText: contract.usesMolt ? displayText(card) : card.moltText,
        stats: Object.entries(card.runtime.flockStats).map(([key, value]) => `${statLabels[key] ?? key} +${value}`).join(' / ') || 'No Flock Stats',
      },
    };
  }

  private battleHandRenderContext() {
    return {
      scene: this,
      target: this.handLayer,
      width: GAME_WIDTH,
      handY: HAND_Y,
      cardWidth: CARD_W,
      cardHeight: CARD_H,
      fontFamily: UI_FONT,
      boldFontStyle: UI_BOLD,
      cyanColor: UI_CYAN,
      reducedMotion: prefersReducedMotion(),
      reinforcedColorCues: colorCueState().reinforced,
      assets: {
        handRail: uiIconAssets['combat-hand-rail'].key,
        cardFrame: uiIconAssets['combat-hand-card-frame'].key,
        selectedPulse: uiIconAssets['combat-hand-selected-pulse'].key,
        hoverDossierFrame: uiIconAssets['card-hover-dossier-frame'].key,
        hoverStatChipFrame: uiIconAssets['card-hover-stat-chip-frame'].key,
      },
      cards: this.hand.slice(this.handPage * 5, this.handPage * 5 + 5).map((card) => this.battleHandCardView(card)),
      cardLeft: (index: number) => this.handCardLeft(index + this.handPage * 5),
      renderRichText: (target: Phaser.GameObjects.Container, x: number, y: number, text: string, options: Parameters<typeof renderRichText>[5]) => renderRichText(this, target, x, y, text, options),
      renderSnagArt: (target: Phaser.GameObjects.Container, instanceId: string, x: number, y: number, width: number, height: number, alpha: number) => {
        const card = this.hand.find((candidate) => candidate.instanceId === instanceId);
        return card ? renderSnagCardBorder(this, (obj) => target.add(obj), card, x, y, width, height, alpha) : false;
      },
      onCardClick: (instanceId: string) => this.onCardClicked(instanceId),
      onCardHover: (instanceId: string) => {
        const card = this.hand.find((candidate) => candidate.instanceId === instanceId);
        if (card) this.showCardPreview(card);
      },
      onCardOut: () => {
        const selected = this.getSelectedCard();
        if (selected) this.showCardPreview(selected);
        // Keep the last hover's small details control reachable by pointer.
      },
      renderDiscardTag: (target: Phaser.GameObjects.Container, card: BattleHandCardView, x: number, y: number) => {
        this.discardChoiceModule?.renderDiscardChoiceTag({
          scene: this,
          target,
          x,
          y,
          selected: Boolean(card.discardSelected),
          order: card.discardOrder,
          fontFamily: UI_FONT,
          boldFontStyle: UI_BOLD,
        });
      },
    };
  }

  private renderHandFallback() {
    const count = this.hand.length;
    const label = (x: number, y: number, value: string, width = CARD_W - 16, size = UI_TYPE.primary as number, color = UI_BODY) =>
      this.add.text(x, y, value, { fontFamily: UI_FONT, fontSize: size, color, resolution: UI_TYPE.resolution,
        wordWrap: { width, useAdvancedWrap: true } });
    this.hand.forEach((card, index) => {
      if (index < this.handPage * 5 || index >= this.handPage * 5 + 5) return;
      const left = this.handCardLeft(index, count);
      const centerX = left + CARD_W / 2;
      const view = this.battleHandCardView(card);
      const { selected, guideMolt, canPay, discardSelectable, discardSelected, discardFocused, accent, retainOrder, cost } = view;
      const hit = this.add.rectangle(centerX, HAND_Y, CARD_W, CARD_H, 0x0b1420, 0.98)
        .setStrokeStyle(discardSelected ? 5 : discardFocused || selected || guideMolt ? 4 : 2, discardSelected ? UI_FIELD.danger : discardFocused ? UI_FIELD.gold : selected ? 0x24d0d6 : guideMolt ? 0xff9d4d : accent, 0.96)
        .setInteractive({ useHandCursor: discardSelectable ?? (canPay || view.retainSelectable) });
      hit.on('pointerdown', () => this.onCardClicked(card.instanceId));
      hit.on('pointerover', () => this.showCardPreview(card, centerX));
      this.handLayer.add(hit);
      this.handCardRects.set(card.instanceId, hit);
      const top = HAND_Y - CARD_H / 2;
      const art = this.add.container(0, 0).setName('combat-fallback-art-slot');
      this.handLayer.add(art);
      const asset = cardCompactArtAsset(card);
      const paint = (failed = art.getData('artState') === 'unavailable') => {
        if (!art.active) return;
        art.removeAll(true);
        const key = loadedCardArtKey(this, card);
        art.setData('artState', key ? 'ready' : failed || !asset ? 'unavailable' : 'loading');
        if (key) {
          const image = this.add.image(left + 32, top + 50, key).setName('combat-hand-illustration');
          image.setScale(Math.min(60 / image.width, 90 / image.height));
          art.add(image);
        } else {
          art.add(label(left + 32, top + 50, failed || !asset ? 'Art\nfailed' : 'Art\nloading', 60, UI_TYPE.secondary, UI_SOFT).setOrigin(0.5));
        }
      };
      art.setData('refresh', paint);
      this.handCardArtLayers.set(card.instanceId, art);
      paint();
      if (asset) queueRuntimeImageAssets(this, [asset], 'Hand artwork', result => paint(result.failedKeys.length > 0));
      this.handLayer.add(this.add.rectangle(left + 64 + (CARD_W - 68) / 2, top + 50, CARD_W - 68, 90, 0x081624, .98).setName('combat-card-title-panel'));
      const title = label(left + 64, top + 5, '', CARD_W - 68, UI_TYPE.primary, canPay ? UI_GOLD : UI_SOFT)
        .setFontStyle(UI_BOLD).setMaxLines(3).setName('combat-card-title');
      fitTextExcerpt(title, view.name, 3);
      this.handLayer.add(title.setY(top + 50 - title.height / 2));
      this.handLayer.add(this.add.circle(left + 16, top + 141, 14, cost === 0 ? 0x24d0d6 : 0xe8b830, 1));
      this.handLayer.add(label(left + 16, top + 141, `${cost}`, 28, UI_TYPE.primary, '#06101c').setFontStyle(UI_BOLD).setOrigin(0.5));
      this.handLayer.add(this.add.rectangle(centerX, top + 212, CARD_W - 6, 110, 0x081624, .98).setName('combat-card-rules-panel'));
      const rules = label(left + 8, top + 166, '', CARD_W - 16, UI_TYPE.primary, canPay ? UI_BODY : UI_SOFT)
        .setMaxLines(4).setName('combat-card-readable-summary');
      this.handLayer.add(fitTextExcerpt(rules, view.preview.currentText, 4));
      if (view.usesMolt || guideMolt) {
        this.handLayer.add(this.add.rectangle(left + 62, top + 111, 60, 28, 0x2a1208, .96));
        this.handLayer.add(label(left + 62, top + 111, view.usesMolt ? 'MOLT' : 'Molt?', 60, UI_TYPE.secondary, '#ffc78f')
          .setFontStyle(UI_BOLD).setOrigin(.5).setName(guideMolt ? 'combat-molt-guide-tag' : 'combat-card-molt-label'));
      }
      if (retainOrder) {
        const keepY = top + 111;
        this.handLayer.add(this.add.rectangle(left + CARD_W - 44, keepY, 84, 28, 0x08241f, 0.96)
          .setStrokeStyle(1, 0x8fd6a0, 0.96)
          .setName('combat-retain-priority-tag')
          .setData('order', retainOrder));
        this.handLayer.add(label(left + CARD_W - 44, keepY, `KEEP ${retainOrder}`, 84, UI_TYPE.secondary, '#dfffe8')
          .setFontStyle(UI_BOLD).setOrigin(0.5).setName('combat-retain-priority-tag').setData('order', retainOrder));
      }
      if (discardSelectable) {
        this.discardChoiceModule?.renderDiscardChoiceTag({
          scene: this,
          target: this.handLayer,
          x: left + CARD_W - 44,
          y: top + 111,
          selected: Boolean(discardSelected),
          order: view.discardOrder,
          fontFamily: UI_FONT,
          boldFontStyle: UI_BOLD,
        });
      }
      if (colorCueState().reinforced) {
        this.handLayer.add(this.add.rectangle(centerX + 16, top + 141, CARD_W - 44, 28, 0x081624, .98));
        this.handLayer.add(label(centerX + 16, top + 141, fallbackCardColorCue(card), CARD_W - 44, UI_TYPE.secondary, '#f4f8fb')
          .setOrigin(.5).setName('combat-color-cue-badge').setData('label', cardLabel(card)));
      }
    });
  }

  private firstCombatGuideCard() {
    if (firstFlightGuideStep() !== 'card' || !this.isGuidedFirstCombat() || this.mode !== 'battle') return undefined;
    const affordable = this.hand.filter((card) => this.effectiveCost(card) <= this.energy && !isSnagCard(card));
    return affordable.find((card) => this.activeCardContract(card).target === 'enemy' && this.cardBuildsFlow(card))
      ?? affordable[0];
  }

  private firstCombatGuideTarget(card = this.firstCombatGuideCard()) {
    if (!card || this.activeCardContract(card).target !== 'enemy') return undefined;
    return this.getLivingEnemy(this.selectedEnemyId);
  }

  // First-encounter term callouts (one at a time, once per profile) live in a
  // lazy module; until it arrives the lane simply shows coaching.
  private termIntroductionView() {
    if (this.termCalloutModule) return this.termCalloutModule.battleTermCallout(this);
    void loadTermCalloutModule().then((loaded) => { this.termCalloutModule = loaded; }).catch(() => undefined);
  }

  private firstMoltGuideCard() {
    const card = this.hand.find((candidate) => candidate.runtime.kind === 'molt');
    return firstMoltGuideState(Boolean(card)).active ? card : undefined;
  }

  private currentHandRenderKey() {
    const retention = this.retentionPlan();
    const cards = this.hand.map((card) => {
      const contract = this.activeCardContract(card);
      return [
        card.instanceId,
        card.id,
        card.type,
        card.runtime.suit ?? '',
        displayName(card),
        this.effectiveCost(card),
        contract.usesMolt ? 1 : 0,
        contract.effects.join(';'),
      ].join(':');
    }).join('|');
    const discardKey = this.discardChoice
      ? `${this.discardChoice.source}:${this.discardChoice.max}:${this.discardChoice.optional ? 1 : 0}:${this.discardChoice.candidateIds.join(',')}:${this.discardChoice.selectedIds.join(',')}:${this.controllerChoiceIndex}`
      : '';
    // The regular renderer updates selection/Flow in place. A late image redraw
    // must not replace the already-selected card's registered input target.
    const selectionKey = this.battleHandRendererModule ? '' : this.selectedInstanceId ?? '';
    return `${this.handPage}:${colorCueState().preference}:${this.mode}:${this.energy}:${this.flock.molt ? 1 : 0}:${selectionKey}:${this.firstCombatGuideCard()?.instanceId ?? ''}:${this.firstMoltGuideCard()?.instanceId ?? ''}:${retention.count}:${retention.cards.map((card) => card.instanceId).join(',')}:${discardKey}:${cards}`;
  }

  private clearPersistentHand() {
    this.handLayer.setVisible(false);
    if (this.handLayer.list.length === 0) return;
    this.hideCardPreview();
    killTweensForTree(this, this.handLayer);
    this.handLayer.removeAll(true);
    this.handRenderKey = '';
    this.handCardRects.clear();
    this.handCardArtLayers.clear();
    this.handCardFrames.clear();
    this.handCardSelectionPulses.clear();
    this.handCardFlowIndicators.clear();
  }

  private activeCardContract(card: Card): ActiveCardContract {
    return activeCardContract(card, this.flock.molt);
  }

  private cardBuildsFlow(card: Card) {
    return this.simulateCardOutcome(card, this.selectedEnemyId).flowGain > 0;
  }

  private simulateCardOutcome(card: Card, enemyId: string) {
    const contract = this.activeCardContract(card);
    if (!this.combatPreviewModule) {
      const flockBefore = {
        hp: this.flock.hp, maxHp: this.flock.maxHp, block: this.flock.block,
        flow: this.flock.flow, flowMax: this.flock.flowMax,
        energy: this.energy, resonance: this.spark
      };
      return {
        contract,
        target: this.enemies.find((enemy) => enemy.id === enemyId) ?? this.enemies[0],
        enemyStates: this.enemies.map((enemy) => ({
          id: enemy.id,
          name: enemy.name,
          maxHp: enemy.maxHp,
          hpBefore: enemy.hp,
          hpAfter: enemy.hp,
          blockBefore: enemy.block,
          blockAfter: enemy.block,
          defeated: enemy.hp <= 0
        })),
        flockBefore,
        flockAfter: { ...flockBefore },
        enemyDamage: 0,
        blockedDamage: 0,
        coverGain: 0,
        cohesionDelta: 0,
        flowGain: 0,
        energyDelta: 0,
        steps: [],
        requiresChoice: false,
        projectedFlock: { ...this.flock },
        projectedEnemies: this.enemies.map(enemy => ({ ...enemy })),
        firstAttackAfter: this.firstAttackThisTurn,
        drawCount: 0,
        resonanceDelta: 0,
        nextTurnDrawDelta: 0,
        nextTurnEnergyDelta: 0,
        moltPowerApplied: 0,
        bossPhaseBreak: undefined
      };
    }
    return this.combatPreviewModule.simulateCombatCardOutcome({
      card,
      enemyId,
      contract,
      flock: this.flock,
      enemies: this.enemies,
      energy: this.energy,
      resonance: this.spark,
      moltPower: this.activeMoltPower(),
      moltEntryEnergy: this.flyway.relic === 'storm-pin' ? 1 : 0,
      moltEntryEffects: capstoneMarks(this.flyway.capstone).filter(m => m.trigger === 'onEnterMolt' && !this.markFiredThisCombat.has(m.id)).flatMap(routeMarkEffects),
      afterCardEffects: capstoneMarks(this.flyway.capstone).filter(m => m.trigger === 'onNthCardThisTurn(3)' && this.cardsPlayedThisTurn === 2 && !this.markFiredThisCombat.has(m.id)).flatMap(routeMarkEffects),
      rawCoverGain: amount => flywayCoverGain(this.flyway, amount),
      cost: this.effectiveCost(card),
      pendingNestCoverBonus: this.pendingNestCoverBonus,
      nextTurnDraw: this.nextTurnDrawBonus,
      nextTurnEnergy: this.nextTurnEnergyBonus,
      firstAttack: this.firstAttackThisTurn,
      discardableHandCount: Math.max(0, this.hand.length - 1),
      playedCardIds: this.playedCardIdsThisCombat,
      playedSuits: this.playedSuitsThisTurn,
      cardName: displayName,
      incomingNextAttackDamage: (enemies, flock) => this.incomingNextAttackDamage(enemies, flock),
      currentMoveDealsDamage: (enemy) => moveDealsDamage(currentMove(enemy)),
      flockSuitCount: (suit) => this.flockSuitCounts()[suit] ?? 0,
      firstAttackKeystoneActive: () => this.keystoneActive('quills'),
      scaledDamageBonus: (area) => this.scaledFlockStatBonus('damage', area),
      scaledCoverBonus: () => this.scaledFlockStatBonus('cover'),
      damageOutcome: cardDamageOutcome,
      coverOutcome: (amount, flock, bonus, nest) => flywayCoverGain(this.flyway, cardCoverOutcome(amount, flock, bonus, nest)),
      afterCard: (context) => {
        if (this.runLeaderId === 'fledgling' && card.runtime.suit && !this.fledglingSuitRallies.has(card.runtime.suit)) context.flock.flow = Math.min(this.flock.flowMax, context.flock.flow + 1);
        const combo = playCombination(structuredClone(this.flightCombat), card.runtime.suit);
        if (combo?.effect === 'damage') context.damageEnemy(enemyId, 2, combo.name, card);
        if (combo?.effect === 'cover') context.gainBlock(3, combo.name, card);
        if (combo?.effect === 'resonance') context.gainResonance(1);
        for (const enemy of context.livingEnemies()) if (!enemy.flywayBreakUsed && bossDisruption(enemy, activeMapIndex)?.met && moveDealsDamage(currentMove(enemy))) enemy.flywayBroken = true;
      }
    });
  }

  private selectedCardOutcomePreview() {
    if (this.combatAnimationPending) return undefined;
    const card = this.getSelectedCard();
    if (!card) return undefined;
    const outcome = this.simulateCardOutcome(card, this.selectedEnemyId);
    const preview = this.battleHudRendererModule?.formatBattleSelectionOutcome(
      displayName(card),
      this.selectedEnemyId,
      compactCardEffectSummary(outcome.contract.effects),
      this.activeMoltPower(),
      outcome
    );
    if (!preview) return undefined;
    const survival = this.selectedCardSurvival(card, outcome);
    return { ...preview, survival, summary: `${preview.summary} / ${survival.detail}` };
  }

  private selectedCardSurvival(card: Card, outcome: ReturnType<BattleScene['simulateCardOutcome']>) {
    const before = this.incomingFlockDamagePreview();
    const uncertainty: string[] = [];
    if (outcome.drawCount) uncertainty.push('Draw-dependent hand and held-card effects are estimated');
    if (this.ownedMarkDefs().some(mark => /^(onSuitPlayed|onNthCard|onHealFlock|onEnemyCoverBroken|onResonanceSpent|onEnterMolt)/.test(mark.trigger))) uncertainty.push('Card-triggered Waymarks may change the result');
    if (this.runLeaderId && this.runLeaderId !== 'fledgling') uncertainty.push('Leader triggers may change the result');
    const after = outcome.requiresChoice || this.effectiveCost(card) > this.energy || !this.combatPreviewModule ? undefined
      : outcome.projectedEnemies.every(enemy => enemy.hp <= 0) || outcome.projectedFlock.hp <= 0
        || !!signatureVictory(currentCombatNodes()[this.currentRouteIndex]?.payloadId ?? '', outcome.projectedEnemies, outcome.projectedFlock.hp, this.enemyDefeatedTurns)
        ? { hpLoss: 0, afterHp: outcome.projectedFlock.hp, uncertainty: [], scope: 'Combat ends before Roost' }
      : this.enemyDamageProjection(outcome.projectedEnemies, outcome.projectedFlock, true, undefined, false, {
        hand: this.hand.filter(entry => entry.instanceId !== card.instanceId),
        drawn: Math.min(outcome.drawCount, this.drawPile.length + this.discardPile.length),
        energy: outcome.flockAfter.energy, played: this.cardsPlayedThisTurn + 1,
        zero: this.zeroCostThisTurn + (this.effectiveCost(card) === 0 ? 1 : 0),
        firstAttack: outcome.firstAttackAfter,
      });
    const unknown = [...new Set([...before.uncertainty, ...(after?.uncertainty ?? []), ...uncertainty])];
    const now = `Roost now: ${before.uncertainty.length ? 'estimated ' : ''}${before.hpLoss} HP loss.`;
    const detail = after
      ? `${now} After this card then Roost: ${unknown.length ? 'estimated ' : ''}${after.hpLoss} HP loss; ${after.afterHp} Cohesion left. ${after.scope}.${unknown.length ? ` ${unknown.join('; ')}.` : ''}`
      : `${now} After this card then Roost: unknown until the card is playable and its choices resolve.`;
    return { before: before.hpLoss, after: after?.hpLoss, remaining: after?.afterHp, uncertainty: unknown, detail };
  }

  private handCardLeft(index: number, handSize = this.hand.length) {
    const first = Math.min(this.handPage * 5, Math.max(0, Math.floor((handSize - 1) / 5) * 5));
    handSize = Math.min(5, handSize - first);
    index = clamp(index - first, 0, Math.max(0, handSize - 1));
    const minLeft = 166;
    const maxRight = 1106;
    const avail = maxRight - minLeft;
    const spacing = Math.min(CARD_W + 12, (avail - CARD_W) / 4);
    const startX = minLeft + Math.max(0, (avail - (4 * spacing + CARD_W)) / 2);
    return Math.round(startX + index * spacing);
  }

  private battleHandRenderResult() {
    return {
      rects: this.handCardRects,
      artLayers: this.handCardArtLayers,
      frames: this.handCardFrames,
      selectionPulses: this.handCardSelectionPulses,
      flowIndicators: this.handCardFlowIndicators,
    };
  }

  private refreshLoadedHandCardArt(cards: Card[]) {
    const context = this.battleHandRenderContext();
    let refreshed = 0;
    cards.forEach((card) => {
      const handIndex = this.hand.findIndex((candidate) => candidate.instanceId === card.instanceId);
      const layer = this.handCardArtLayers.get(card.instanceId);
      if (handIndex < 0 || !layer?.active) return;
      const centerX = this.handCardLeft(handIndex, this.hand.length) + CARD_W / 2;
      if (this.battleHandRendererModule) this.battleHandRendererModule.renderBattleHandCardArt(context, layer, this.battleHandCardView(card), centerX);
      else layer.getData('refresh')?.();
      refreshed += 1;
    });
    return refreshed;
  }

  private refreshHandCardSelection() {
    const selected = this.hand.findIndex(card => card.instanceId === this.selectedInstanceId);
    if (selected >= 0 && Math.floor(selected / 5) !== this.handPage) this.renderHand();
    if (this.battleHandRendererModule) {
      const guideCard = this.firstCombatGuideCard()?.instanceId;
      const guideMolt = this.firstMoltGuideCard()?.instanceId;
      const guided = this.isGuidedFirstCombat();
      const surgeNext = this.flock.flow === this.flock.flowMax - 1;
      this.battleHandRendererModule.refreshBattleHandSelection(
        {
          scene: this,
          cardWidth: CARD_W,
          cardHeight: CARD_H,
          reducedMotion: prefersReducedMotion(),
        },
        this.hand.filter(card => this.handCardRects.get(card.instanceId)?.active).map(card => ({
          instanceId: card.instanceId,
          selected: card.instanceId === this.selectedInstanceId,
          guideCard: card.instanceId === guideCard,
          guideMolt: card.instanceId === guideMolt,
          accent: card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card),
          canPay: this.effectiveCost(card) <= this.energy && this.mode === 'battle',
          surgeNext,
          // Selection never changes rules or art. Only simulate a Flow badge
          // that can be visible; don't rebuild every card's complete dossier.
          flowVisible: this.flock.flow < this.flock.flowMax
            && (card.instanceId === this.selectedInstanceId || (surgeNext && (!guided || card.instanceId === guideCard)))
            && this.cardBuildsFlow(card),
        })),
        this.battleHandRenderResult(),
      );
      return;
    }
    this.hand.forEach((card) => {
      const rect = this.handCardRects.get(card.instanceId);
      if (!rect?.scene) return;
      const selected = this.selectedInstanceId === card.instanceId;
      rect.setStrokeStyle(selected ? 4 : 2, selected ? 0x24d0d6 : suitAccentColor(card), 0.96);
    });
  }
  private hideCardPreview() {
    this.cardPreview?.destroy(true);
    this.cardPreview = undefined;
  }

  private openCombatCardDetail(card: Card, reader?: typeof import('../game/battle/card-detail').renderCombatCardDetail) {
    if (this.mode !== 'battle' || this.combatCardDetail?.active || (this.combatAnimationPending && !this.playerCardFxBaseline)
      || this.discardChoice || this.returnChoice || this.settingsOverlayOpen || this.pauseOverlayOpen
      || this.waymarkDrawerOpen || this.supplyDrawerOpen || this.inspectOverlay === 'flock') return;
    const pile = this.inspectOverlay ? this.battleInspectCards(this.inspectOverlay) : undefined;
    if (!(pile?.map((entry) => entry.card) ?? this.hand).includes(card)) return;
    if (!this.battleHandRendererModule && !reader) {
      // Card help has its own chunk and remains available if only the hand
      // renderer failed. Re-enter the guards after loading; never open late
      // over another decision, a restarted scene, or a different selected card.
      const preview = this.cardPreview;
      void withRuntimeLoadTimeout(import('../game/battle/card-detail'), 'Card details').then(({ renderCombatCardDetail }) => {
        if (this.sys.settings.active && this.cardPreview === preview) this.openCombatCardDetail(card, renderCombatCardDetail);
      }).catch(() => announceScreenReader('Card details could not load. Your selection is unchanged.'));
      return;
    }
    const preview = this.battleHandCardView(card).preview;
    if (!pile && !this.combatAnimationPending) {
      const outcome = this.simulateCardOutcome(card, this.selectedEnemyId);
      const labels = { resolves: 'RESOLVES', 'not-met': 'NOT MET', choose: 'CHOOSE CARDS', 'after-choice': 'AFTER CHOICE' };
      const cost = this.effectiveCost(card);
      preview.outcome = this.battleHudRendererModule?.formatBattleSelectionOutcome(
        displayName(card), this.selectedEnemyId, compactCardEffectSummary(outcome.contract.effects),
        this.activeMoltPower(), outcome,
      ).details + '\n\n' + this.selectedCardSurvival(card, outcome).detail
        + '\n\nCard-only forecast. Leader and Waymark triggers can change these results.';
      preview.sequence = `Target: ${outcome.contract.target === 'enemy' ? outcome.target?.name ?? 'Choose target' : outcome.contract.target === 'allEnemies' ? 'All enemies' : 'Flock'}. Cost: ${cost} Wingbeat${cost === 1 ? '' : 's'}.\n\n`
        + outcome.steps.map((step, i) => `${i + 1}. ${labels[step.status]} — ${formatEffects([step.effect])}`).join('\n\n')
        + '\n\nCard-only forecast in written order. Leader and Waymark triggers can change the result. Effects after a card choice are not predicted.';
    }
    if (!pile && this.combatAnimationPending) {
      preview.outcome = 'An action is resolving. Close and reopen this reader after it settles for a current forecast.';
      preview.sequence = undefined;
    }
    if (pile) {
      const entry = pile.find((entry) => entry.card.instanceId === card.instanceId)!;
      const inspected = this.battleInspectCardView(entry.card, entry.zone);
      preview.name = inspected.name;
      preview.usesMolt = inspected.usesMolt;
      preview.currentText = `${inspected.targetLabel} · ${inspected.roleLabel}\n\n${inspected.currentText}`;
      preview.alternateLabel = inspected.usesMolt ? 'BASE · WITHOUT MOLT' : 'PREEN · UPGRADE';
      preview.alternateText = inspected.alternateText;
    }
    const render = this.battleHandRendererModule?.renderCombatCardDetail ?? reader!;
    this.combatCardDetail = render(this.combatReaderContext(), preview);
  }

  private combatReaderContext() {
    return {
      scene: this, fontFamily: UI_FONT, boldFontStyle: UI_BOLD,
      createButton: quietButton,
      ui: DECISION_UI, typography: UI_TYPE,
      previousLabel: controlBindingLabel('previous'), nextLabel: controlBindingLabel('next'),
      backLabel: controlBindingLabel('back'), onClose: () => this.closeCombatCardDetail(),
      announce: announceScreenReader,
    };
  }

  private toggleCombatCardDetail() {
    if (this.settingsOverlayOpen || this.pauseOverlayOpen) return;
    if (this.combatCardDetail?.active) { this.closeCombatCardDetail(); return; }
    if (this.inspectOverlay) {
      if (this.inspectOverlay === 'flock') return;
      const entries = this.battleInspectCards(this.inspectOverlay);
      const card = entries.find((entry) => entry.card.instanceId === this.inspectedCardId)?.card ?? entries[0]?.card;
      if (card) this.openCombatCardDetail(card);
      return;
    }
    const id = this.cardPreview?.getData('instanceId') ?? this.selectedInstanceId;
    const card = this.hand.find((entry) => entry.instanceId === id) ?? this.hand[this.controllerChoiceIndex];
    if (card) this.openCombatCardDetail(card);
  }

  private openCombatHistory() {
    if (this.settingsOverlayOpen || this.pauseOverlayOpen || this.combatIntroActive) return;
    if (this.combatCardDetail?.active) {
      if (this.combatCardDetail.getData('kind') === 'history') this.closeCombatCardDetail();
      return;
    }
    if (this.mode !== 'battle' || this.combatInteractionLocked() || this.inspectOverlay
      || this.waymarkDrawerOpen || this.supplyDrawerOpen || !this.battleHandRendererModule) return;
    this.combatCardDetail = this.battleHandRendererModule.renderCombatHistory(this.combatReaderContext(), this.combatHistory);
  }

  private closeCombatCardDetail() {
    const kind = this.combatCardDetail?.getData('kind');
    const name = kind === 'history' ? 'Combat history' : kind === 'waymark' ? 'Waymark details' : 'Card details';
    this.combatCardDetail?.destroy(true);
    this.combatCardDetail = undefined;
    announceScreenReader(`${name} closed. Your selection is unchanged.`);
  }

  private changeReturnChoiceRulesPage(direction: number) {
    if (!this.returnChoice || this.settingsOverlayOpen || this.pauseOverlayOpen || this.combatCardDetail?.active) return false;
    const changePage = this.root.getByName('combat-return-choice-summary')?.getData('turnPage');
    if (!changePage) return false;
    changePage(direction);
    return true;
  }

  private changeCombatCardDetailPage(direction: number) {
    if (this.rewardInspectionCardId) {
      if (!this.settingsOverlayOpen && !this.pauseOverlayOpen) this.cardPreview?.getData('turnRulesPage')?.(direction);
      return true;
    }
    if (!this.combatCardDetail?.active) return false;
    if (!this.settingsOverlayOpen && !this.pauseOverlayOpen) this.combatCardDetail.getData('changePage')(direction);
    return true;
  }

  // Combat gets a compact, explicit inspect control. Rewards retain their
  // existing hover dossier. Neither changes the pending decision.
  private showCardPreview(card: Card, previewX = GAME_WIDTH / 2) {
    if (this.combatCardDetail?.active) return;
    // Crossing from the selected card to its reading control must not destroy
    // the pointer's hit target between pointerout and pointerdown.
    if (this.mode === 'battle' && this.cardPreview?.active
      && this.cardPreview.getData('instanceId') === card.instanceId) return;
    this.hideCardPreview();
    if (!this.battleHandRendererModule) {
      this.showCardPreviewFallback(card, previewX);
      return;
    }
    // The combat preview is only an Inspect control; its full dossier is built
    // on activation from current state, not on every selection.
    const preview = this.mode === 'battle' ? undefined : this.battleHandCardView(card).preview;
    try {
      this.cardPreview = this.battleHandRendererModule.renderBattleHandPreview({
        combat: this.mode === 'battle',
        inspectLabel: `${controlBindingLabel('guide')} / R3`,
        onInspect: this.mode === 'battle' ? () => this.openCombatCardDetail(card) : undefined,
        scene: this,
        target: this.mode === 'battle' ? this.root : this.fxLayer,
        width: GAME_WIDTH,
        handY: HAND_Y,
        cardHeight: CARD_H,
        fontFamily: UI_FONT,
        boldFontStyle: UI_BOLD,
        cyanColor: UI_CYAN,
        softColor: UI_SOFT,
        assets: {
          hoverDossierFrame: uiIconAssets['card-hover-dossier-frame'].key,
          hoverStatChipFrame: uiIconAssets['card-hover-stat-chip-frame'].key,
        },
        renderRichText: (target, x, y, text, options) => renderRichText(this, target, x, y, text, options),
        renderSnagArt: (target, _instanceId, x, y, width, height, alpha) =>
          renderSnagCardBorder(this, (obj) => target.add(obj), card, x, y, width, height, alpha),
      }, preview, card.instanceId, previewX).setData('instanceId', card.instanceId);
      if (this.mode === 'battle' && this.hand.length > 5) this.cardPreview.setY(654);
    } catch (error) {
      console.warn('Battle hand preview renderer failed; using compact fallback.', error);
      this.showCardPreviewFallback(card, previewX);
    }
  }

  private showCardPreviewFallback(card: Card, previewX = GAME_WIDTH / 2) {
    this.hideCardPreview();
    if (this.mode === 'battle') {
      const container = this.add.container(0, 0).setData('instanceId', card.instanceId);
      const control = quietButton(this, { x: 90, y: this.hand.length > 5 ? 687 : 505, width: 128,
        label: 'Full rules', name: 'combat-card-inspect-hit', onActivate: () => this.openCombatCardDetail(card) });
      container.add([control, control.getData('labelObject')]);
      this.root.add(container);
      this.cardPreview = container;
      return;
    }
    const x = clamp(previewX, 164, GAME_WIDTH - 164);
    const y = 250;
    const contract = this.activeCardContract(card);
    const container = this.add.container(0, 0);
    container.add(this.add.rectangle(x, y, 300, 360, 0x07101c, 0.99)
      .setStrokeStyle(3, suitAccentColor(card), 0.96));
    container.add(this.add.text(x, y - 142, displayName(card), {
      fontFamily: UI_FONT, fontSize: '22px', fontStyle: UI_BOLD, color: UI_GOLD,
      fixedWidth: 252, align: 'center', maxLines: 2,
    }).setOrigin(0.5));
    container.add(this.add.text(x, y - 98, `${this.effectiveCost(card)} Wingbeat  /  ${cardLabel(card)}`, {
      fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_CYAN,
    }).setOrigin(0.5));
    container.add(this.add.text(x, y + 12, contract.text, {
      fontFamily: UI_FONT, fontSize: '15px', color: UI_BODY, fixedWidth: 252,
      align: 'center', wordWrap: { width: 252 }, maxLines: 7,
    }).setOrigin(0.5));
    this.fxLayer.add(container);
    this.cardPreview = container;
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

  private renderSupplyFeedbackStrip() {
    const latest = this.supplyFeedback[0];
    if (!latest) return;
    if (latest.turn === this.turn && this.fxLayer?.active) return;
    const x = 194;
    const y = 184;
    this.root.add(this.add.rectangle(x, y, 286, 64, 0x07101c, 0.96)
      .setStrokeStyle(1, 0xffb86b, 0.5).setName('combat-supply-feedback-frame'));
    this.root.add(fitTextExcerpt(this.add.text(x - 129, y - 25, '', {
      fontFamily: UI_FONT, fontSize: '21px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: 258, useAdvancedWrap: true }, resolution: 2,
    }).setName('combat-supply-feedback-name'), latest.name, 1));
    this.root.add(this.add.text(x - 129, y + 3, 'Used · Read in Supplies', {
      fontFamily: UI_FONT, fontSize: '19px', color: UI_BODY, resolution: 2,
    }).setName('combat-supply-feedback-hint'));
  }


  private battleUsableSupplyIndices() {
    return this.runSupplies.flatMap((id, index) => {
      const supply = alphaSupplyLibrary.get(id);
      return supply && supply.timing !== 'route' ? [index] : [];
    });
  }

  private ensureBattleSupplyDrawer() {
    if (this.battleSupplyDrawerModule || this.battleSupplyDrawerLoading || this.battleSupplyDrawerFailed) return;
    this.battleSupplyDrawerLoading = true;
    void loadRouteSupplyDrawerModule()
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.battleSupplyDrawerModule = module;
        this.battleSupplyDrawerLoading = false;
        if (this.supplyDrawerOpen) this.requestBattleRender();
      })
      .catch((error) => {
        this.battleSupplyDrawerLoading = false;
        this.battleSupplyDrawerFailed = true;
        console.warn(LAZY_LOAD_FAILED, error);
        if (this.sys.settings.active && this.supplyDrawerOpen) this.requestBattleRender();
      });
  }

  private toggleBattleSupplyDrawer(inputActive = false) {
    if (this.supplyDrawerOpen) {
      this.supplyDrawerOpen = false;
      this.supplyDrawerArmedIndex = undefined;
      this.supplyDrawerInputActive = false;
      this.requestBattleRender();
      return;
    }
    if (this.mode !== 'battle' || this.combatInteractionLocked() || this.inspectOverlay || this.waymarkDrawerOpen) return;
    const usable = this.battleUsableSupplyIndices();
    this.supplyDrawerOpen = true;
    this.supplyDrawerFocusIndex = usable[0] ?? 0;
    this.supplyDrawerArmedIndex = undefined;
    this.supplyDrawerInputActive = inputActive;
    this.inspectOverlay = undefined;
    this.waymarkDrawerOpen = false;
    this.queueCurrentSupplyArtLoad();
    this.queueBattleDrawerUiLoad();
    this.ensureBattleSupplyDrawer();
    this.requestBattleRender();
  }

  private moveBattleSupplyFocus(direction: -1 | 1) {
    if (this.pauseOverlayOpen || this.settingsOverlayOpen) return;
    const usable = this.runSupplies.map((_id, index) => index);
    if (!usable.length) {
      playUiSound('locked');
      return;
    }
    const current = usable.indexOf(this.supplyDrawerFocusIndex);
    this.supplyDrawerFocusIndex = usable[(current < 0 ? 0 : current + direction + usable.length) % usable.length];
    this.supplyDrawerArmedIndex = undefined;
    this.supplyDrawerInputActive = true;
    playUiSound('confirm');
    this.requestBattleRender();
  }

  private requestBattleSupplyUse(index: number) {
    const id = this.runSupplies[index];
    const supply = id ? alphaSupplyLibrary.get(id) : undefined;
    if (!supply || supply.timing === 'route' || this.combatInteractionLocked()) {
      if (supply && !this.combatInteractionLocked()) {
        this.supplyDrawerFocusIndex = index;
        this.supplyDrawerArmedIndex = undefined;
        this.requestBattleRender();
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
      this.requestBattleRender();
      return;
    }
    this.supplyDrawerArmedIndex = undefined;
    this.useSupply(index);
  }

  private renderSupplyDrawer() {
    this.ensureBattleSupplyDrawer();
    if (!this.battleSupplyDrawerModule) {
      this.root.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.76)
        .setInteractive({ useHandCursor: false }));
      this.root.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.battleSupplyDrawerFailed ? 'Supply drawer unavailable' : 'Opening Supply drawer...', {
        fontFamily: UI_FONT,
        fontSize: '20px',
        fontStyle: UI_BOLD,
        color: this.battleSupplyDrawerFailed ? '#ffb09a' : '#ffe1a3',
      }).setOrigin(0.5));
      return;
    }
    const capacity = this.runSupplyCapacity;
    this.battleSupplyDrawerModule.renderRouteSupplyDrawer(this, {
      recent: this.supplyFeedback,
      entries: Array.from({ length: capacity }, (_entry, index) => {
        const supply = alphaSupplyLibrary.get(this.runSupplies[index] ?? '');
        if (!supply) return {};
        return {
          id: supply.id,
          glyph: this.supplyGlyph(supply),
          accent: supplyAccent(supply),
          name: supply.name,
          summary: formatEffects(supply.effects),
          timing: supply.timing,
          usable: !this.combatInteractionLocked() && supply.timing !== 'route',
        };
      }),
      filled: this.runSupplies.length,
      capacity,
      focusIndex: this.supplyDrawerFocusIndex,
      inputActive: this.supplyDrawerInputActive,
      armedIndex: this.supplyDrawerArmedIndex,
      confirmLabel: controlBindingLabel('confirm'),
      backLabel: controlBindingLabel('back'),
      addTo: (object) => this.root.add(object),
      onClose: () => this.handleBattleBack(),
      onActivate: (index) => this.requestBattleSupplyUse(index),
      onBrowse: (direction) => this.moveBattleSupplyFocus(direction),
    });
  }


  private waymarkAccent(mark: RuntimeRouteMark) {
    return routeMarkAccent(mark);
  }

  private waymarkFamilyLabel(mark: RuntimeRouteMark) {
    return mark.family === 'suit' ? 'Suit Engine' : routeMarkFamilyLabel(mark.family);
  }

  private renderWaymarkDrawer() {
    this.queueBattleDrawerUiLoad();
    const marks = this.ownedMarkDefs();
    this.queueCurrentWaymarkArtLoad();
    if (this.waymarkReviewModule) {
      this.waymarkReviewModule.renderBattleWaymarks(this, marks.map(mark => ownedWaymarkReviewEntry(mark, this.waymarkFamilyLabel(mark))), () => this.closeBattleWaymarks());
      return;
    }
    this.root.add(this.add.rectangle(640, 360, 1280, 720, 0x020409, 0.9).setInteractive());
    this.root.add(this.add.text(640, 330, this.waymarkReviewFailed ? 'Waymark reader unavailable. Close to keep playing; reload the game to retry.' : 'Opening Waymarks…', {
      fontFamily: UI_FONT, fontSize: '22px', color: UI_SOFT, wordWrap: { width: 700 }, align: 'center',
    }).setOrigin(0.5).setName('battle-waymark-loading'));
    renderCloseControl(this, obj => this.root.add(obj), 1040, 160, () => this.closeBattleWaymarks());
    if (!this.waymarkReviewLoading && !this.waymarkReviewFailed) {
      this.waymarkReviewLoading = true;
      void withRuntimeLoadTimeout(loadWaymarkReviewModule(), 'Waymark reader').then(module => {
        this.waymarkReviewModule = module;
      }).catch(error => {
        this.waymarkReviewFailed = true; console.warn(LAZY_LOAD_FAILED, error);
      }).finally(() => {
        this.waymarkReviewLoading = false;
        if (this.sys.settings.active && this.waymarkDrawerOpen) this.requestBattleRender();
      });
    }
  }

  private closeBattleWaymarks() {
    if (!this.waymarkDrawerOpen || this.pauseOverlayOpen || this.settingsOverlayOpen) return;
    this.waymarkDrawerOpen = false;
    playUiSound('close'); this.requestBattleRender();
  }

  private toggleBattleWaymarks() {
    if (!this.fxLayer?.active || this.combatInteractionLocked() || this.supplyDrawerOpen) return;
    if (this.waymarkDrawerOpen) { this.closeBattleWaymarks(); return; }
    this.waymarkDrawerOpen = true;
    this.waymarkReviewFailed = false;
    this.requestBattleRender();
  }

  private scrollWaymarkDrawer(deltaRows: number) {
    if (!this.waymarkDrawerOpen || this.pauseOverlayOpen || this.settingsOverlayOpen) return;
    const maxScrollRows = Math.max(0, Math.ceil(this.ownedMarkDefs().length / 3) - 2);
    const next = clamp(this.waymarkDrawerScroll + deltaRows, 0, maxScrollRows);
    if (next === this.waymarkDrawerScroll) return;
    this.waymarkDrawerScroll = next;
    this.requestBattleRender();
  }

  private useSupply(index: number) {
    if (this.combatInteractionLocked()) return;
    const id = this.runSupplies[index];
    const supply = id ? alphaSupplyLibrary.get(id) : undefined;
    if (!supply || supply.timing === 'route') return;
    const repeats = this.pendingSupplyRepeats > 0 ? 1 + this.pendingSupplyRepeats : 1;
    this.pendingSupplyRepeats = 0;
    const effects = Array.from({ length: repeats }, () => supply.effects).flat();
    // A consumed combat Supply commits back to the battlefield. Interactive
    // card-zone choices must never remain hidden behind the kit drawer.
    this.supplyDrawerOpen = false;
    this.supplyDrawerArmedIndex = undefined;
    this.supplyDrawerInputActive = false;
    this.resolveSupplyEffectsInteractive(effects, supply.name, () => {
      const liveIndex = this.runSupplies.indexOf(id);
      if (liveIndex >= 0) this.runSupplies.splice(liveIndex, 1);
      this.runSuppliesUsed.push(id);
      this.showSupplyFeedback(supply, repeats);
      birdAudio.play('supplyUse', Math.min(1.25, 0.86 + repeats * 0.08));
      this.combatSupplyUseBurst(344, 232, repeats > 1 ? 0.76 : 0.64);
      this.checkSupplyUsedMarks();
      this.updateFlywayBossBreaks();
      this.logEvent(`Used ${supply.name}.`);
      // Complete costs, choices, consumption and Supply-triggered effects
      // before handing the final state to rewards. A lethal Supply should
      // never need an extra card or Roost to clear an empty battlefield.
      this.checkOutcome();
      this.requestBattleRender();
    });
  }

  private resolveSupplyEffectsInteractive(effects: string[], source: string, onComplete: () => void) {
    if (!this.discardChoiceModule) {
      effects.forEach((effect) => this.applySupplyEffect(effect, source));
      onComplete();
      return;
    }
    this.discardChoiceModule.runInterruptibleSequence({
      items: effects,
      detect: (effect) => {
        let active = effect;
        const conditional = /^if (.+?) then (.+)$/.exec(active);
        if (conditional) {
          if (!this.checkSupplyCondition(conditional[1])) return undefined;
          active = conditional[2];
        }
        const parsed = parseEffect(active);
        if (parsed && (parsed.name === 'discard' || parsed.name === 'discardUpTo')) return {
          kind: 'discard' as const,
          amount: Math.max(0, Number(parsed.args[0]) || 0),
          optional: parsed.name === 'discardUpTo',
        };
        if (parsed?.name === 'returnDiscard') return {
          kind: 'return' as const,
          filter: parsed.args[0] || 'nonMolt',
          drawAfter: Math.max(0, parseEffectValue(parsed.args[1], 0)),
        };
        return undefined;
      },
      apply: (effect) => this.applySupplyEffect(effect, source),
      choose: (decision, resume) => {
        if (decision.kind === 'discard') this.beginDiscardChoice(source, decision.amount, decision.optional, resume);
        else this.beginReturnChoice(source, decision.filter, decision.drawAfter, resume);
      },
      onComplete,
    });
  }

  private checkSupplyCondition(condition: string) {
    const visitedType = /^visitedNodeType\(([a-zA-Z0-9_]+)\)$/.exec(condition);
    if (visitedType) {
      const wantedType = visitedType[1];
      return currentMap().nodes.some((node) =>
        node.type === wantedType && this.completedRouteNodeIds.includes(node.id)
      );
    }
    return false;
  }

  private applySupplyEffect(effect: string, source = 'Supply') {
    const conditional = /^if (.+?) then (.+)$/.exec(effect);
    if (conditional) {
      if (this.checkSupplyCondition(conditional[1])) this.applySupplyEffect(conditional[2], source);
      return;
    }
    const parsed = parseEffect(effect);
    if (!parsed) return;
    const n = Number(parsed.args[0]) || 0;
    const target = () => this.normalizeSelectedEnemy();
    switch (parsed.name) {
      case 'healCohesion': case 'heal': this.healFlock(n, source); break;
      case 'gainResonance': this.gainResonance(n); break;
      case 'draw': this.drawCards(n); break;
      case 'discard': case 'discardUpTo': this.discardCards(n); break;
      case 'gainCover': this.gainBlock(n, source); break;
      case 'gainWingbeat':
        this.energy += n;
        this.observeCardEffect('wingbeats', n);
        this.logEvent(`${source} gives ${n} Wingbeat.`);
        this.wingbeatGainFx(n);
        break;
      case 'loseCohesion':
        this.flock.hp = Math.max(1, this.flock.hp - n);
        this.logEvent(`${source} costs ${n} Cohesion.`);
        this.presentFlockResult(-n, ' Cohesion', '#ff7a6e', source);
        break;
      case 'gainOpenSkyGuard':
        this.gainOpenSkyGuard(n, source);
        break;
      case 'reduceNextOpenSky':
        this.flock.openSkyReduction += n;
        this.logEvent(`${source} softens the next Open Sky increase by ${n}.`);
        break;
      case 'damage': {
        const enemy = target();
        if (enemy) this.damageEnemy(enemy.id, n, source);
        break;
      }
      case 'damagePierce': {
        const enemy = target();
        if (enemy) this.damageEnemy(enemy.id, n, source, undefined, true);
        break;
      }
      case 'damageAll':
        this.enemies
          .filter((enemy) => enemy.hp > 0)
          .forEach((enemy) => this.damageEnemy(enemy.id, n, source));
        break;
      case 'removeCover': {
        const enemy = target();
        if (!enemy) break;
        const hadCover = enemy.block > 0;
        const removed = Math.min(enemy.block, n);
        enemy.block -= removed;
        this.logEvent(`${source} strips ${removed} Cover from ${enemy.name}.`);
        const view = this.enemyView(enemy);
        if (removed > 0) {
          const y = view.y + (enemy.runtime.type === 'boss' ? 56 : 48) * view.scale;
          birdAudio.play('coverBreak', Math.min(1.4, 0.82 + removed * 0.07));
          this.combatCoverShatter(view.x, y, Phaser.Math.Clamp(0.9 + removed * 0.04, 0.96, 1.18));
          this.fxGlowPulse(view.x, y, 0x8df4ff, 82, 340, 0.16);
          this.fxMoteBurst(view.x, y + 6, 0xffcf7a, {
            count: Phaser.Math.Clamp(9 + removed * 2, 10, 22),
            speed: 120,
            lifespan: 340,
            scale: 0.46,
            gravityY: 0,
            spreadX: 18,
            spreadY: 10,
          });
          this.presentEnemyStatus(enemy, `−${removed} Cover`, '#8df4ff');
        }
        if (hadCover && enemy.block <= 0) this.checkEnemyCoverBrokenMarks();
        break;
      }
      case 'applyWinded': {
        const enemy = target();
        if (!enemy) break;
        enemy.weak += n;
        this.logEvent(`${source} leaves ${enemy.name} Winded.`);
        const view = this.enemyView(enemy);
        this.presentEnemyStatus(enemy, 'Winded', '#c98bff');
        this.windedFx(view.x, view.y);
        this.triggerTalonPinnedOpening(enemy);
        break;
      }
      case 'returnDiscard':
        this.returnDiscardToHand(parsed.args[0], parseEffectValue(parsed.args[1], 0));
        break;
      case 'nextCoverBonus':
        this.pendingNestCoverBonus += n;
        this.logEvent(`${source} primes +${n} Cover for the next Nest brace.`);
        this.bankNextTurnFx(n, `+${n} next Cover`, '#c9a6ff', 0xc9a6ff);
        break;
      case 'gainEnergyNextTurn':
        this.nextTurnEnergyBonus += n;
        this.logEvent(`${source} banks +${n} Wingbeat for next turn.`);
        this.bankNextTurnFx(n, `+${n} next Wingbeat`, '#dffbff', 0x8df4ff);
        break;
      case 'gainScrap':
        this.scrap += n;
        this.runScrapEarned += Math.max(0, n);
        this.logEvent(`${source} recovers ${n} Scrap.`);
        break;
      case 'resonanceBurst': {
        const enemy = target();
        if (!enemy) break;
        const spent = this.spark;
        const burst = spent * n;
        if (burst > 0) {
          this.damageEnemy(enemy.id, burst, source);
          this.logEvent(`${source} releases ${spent} Resonance for ${burst} damage.`);
          const view = this.enemyView(enemy);
          this.presentEnemyStatus(enemy, 'Resonance!', '#8df4ff');
          this.sparkBurst(view.x, view.y - 22, 0x8df4ff, 30, 210);
        }
        this.spark = 0;
        this.observeCardEffect('spent', spent);
        if (spent > 0) this.checkResonanceSpentMarks();
        break;
      }
      case 'cleanseFlock': {
        this.cleanseFlock(n, source);
        break;
      }
      case 'enterMolt':
        this.enterMolt(source);
        break;
      case 'nextTurnDraw':
        this.nextTurnDrawBonus += n;
        this.logEvent(n >= 0
          ? `${source} adds +${n} draw next turn.`
          : `${source} cuts ${Math.abs(n)} draw next turn.`);
        this.bankNextTurnFx(n, n >= 0 ? `+${n} next draw` : `${n} next draw`, n >= 0 ? '#f7d889' : '#ff9d6b', n >= 0 ? 0xf7d889 : 0xff9d6b);
        break;
      case 'retainHand':
        this.retainCards(n, source);
        break;
      default: break;
    }
  }

  private cleanseFlock(amount: number, source = 'Cleanse') {
    const cleared = cleanseFlockDebuffs(this.flock, amount);
    if (cleared > 0) {
      this.logEvent(`${source} clears ${cleared} pressure.`);
      this.cleanseFx(cleared);
    }
  }

  // "Treat rewards as problem solving": classify what the current deck is short
  // on so the player can pick intentionally (next-level-implementation-spec Phase 4).
  private deckNeedSummary() {
    const cards = this.allDeckCards();
    const has = (card: Card, tag: string) => card.runtime.tags.includes(tag);
    const count = (predicate: (card: Card) => boolean) => cards.filter(predicate).length;
    const rate = (n: number): 'low' | 'steady' | 'strong' => (n <= 1 ? 'low' : n <= 3 ? 'steady' : 'strong');
    return {
      damage: rate(count((card) => card.role === 'attack' || has(card, 'attack'))),
      cover: rate(count((card) => has(card, 'cover'))),
      recovery: rate(count((card) => has(card, 'heal') || has(card, 'regen'))),
      draw: rate(count((card) => has(card, 'draw') || has(card, 'draw-next'))),
      moltSafety: rate(count((card) => card.type === 'molt' || has(card, 'molt') || has(card, 'open-sky')))
    };
  }

  private cardNeedTags(card: Card): string[] {
    const waymarks = this.routeMarks.flatMap((id) => {
      const mark = alphaRouteMarkLibrary.get(id);
      return mark ? [mark] : [];
    });
    return rewardBuildObservations(
      card,
      this.allDeckCards(),
      waymarks,
      (name) => compactSentenceText(name, 18, 1),
      KEYSTONE_AT,
    );
  }

  private districtBias() {
    return alphaMapProfileLibrary.get(currentMap().id)?.rewardBias ?? [];
  }

  private districtLeans() {
    return districtCardRewardLeans(this.districtBias());
  }

  private rewardObservations(card: Card): string[] {
    const observations = districtRewardObservations(card, this.districtBias(), this.cardNeedTags(card));
    if (activeMapIndex === 0 && rooftopPlanMatch(this.flyway.rooftopPlan, card.runtime)) {
      const plan = this.flyway.rooftopPlan === 'shelter' ? 'Hold & Answer · Cover / Retain setup'
        : this.flyway.rooftopPlan === 'tempo' ? 'Chorus Engine · Resonance / Wingbeat engine' : 'Storm Window · Molt / Open Sky safety';
      // The focused reward footer shows two rows. Keep its caution visible.
      return [plan, ...observations.filter(row => row.startsWith('!')), ...observations.filter(row => !row.startsWith('!'))];
    }
    return observations;
  }

  private rewardPresentationReady() {
    return Boolean(this.battleRewardRendererModule) || this.battleRewardRendererFailed;
  }

  private ensureBattleRewardRenderer() {
    if (this.battleRewardRendererModule || this.battleRewardRendererLoading || this.battleRewardRendererFailed) return;
    this.battleRewardRendererLoading = true;
    void loadBattleRewardRendererModule()
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.battleRewardRendererModule = module;
        this.battleRewardRendererLoading = false;
        this.requestBattleRender();
      })
      .catch((error) => {
        console.warn(LAZY_LOAD_FAILED, error);
        if (!this.sys.settings.active) return;
        this.battleRewardRendererLoading = false;
        this.battleRewardRendererFailed = true;
        this.requestBattleRender();
      });
  }

  private rewardDeckNeedView() {
    const guideStep = firstFlightGuideStep();
    if (guideStep === 'reward') markFirstFlightGuideSeen(guideStep);
    const summary = this.deckNeedSummary();
    const allEntries: Array<[string, 'low' | 'steady' | 'strong', UiIconId]> = [
      ['Damage', summary.damage, 'release-card'],
      ['Cover', summary.cover, 'cover-shield'],
      ['Recovery', summary.recovery, 'flock-heart'],
      ['Draw', summary.draw, 'draw-stack'],
      ['Molt safety', summary.moltSafety, 'preen-kit']
    ];
    const priority = { low: 0, steady: 1, strong: 2 } as const;
    return {
      guide: guideStep === 'reward'
        ? 'GUIDE: COMPARE THE DECK SIGNALS  /  SKIP IS AN INTENTIONAL CHOICE'
        : 'DECK READ  /  THREE MOST USEFUL SIGNALS',
      entries: [...allEntries]
        .sort((a, b) => priority[a[1]] - priority[b[1]])
        .slice(0, 3)
        .map(([label, rank, icon]) => ({ label, rank, icon }))
    };
  }

  private rewardCardView(card: Card, index: number, collection?: CardCollectionRecord, targeted = false) {
    const needTags = this.mode === 'cardReward' ? this.rewardObservations(card) : this.cardNeedTags(card);
    const stats = cardStatRows(card).slice(0, 2);
    return {
      quickRead: decisionBrief({ ...card, upgraded: this.mode === 'upgradeReward' || card.upgraded, name: displayName(card) }, this.allDeckCards().map(c => ({ ...c, name: displayName(c) }))),
      passiveDelta: (() => {
        const before = aggregateFlockStats(this.allDeckCards());
        const after = aggregateFlockStats(this.mode === 'upgradeReward'
          ? this.allDeckCards().map(c => c.id === card.id ? { ...c, upgraded: true } : c) : [...this.allDeckCards(), card]);
        return Object.keys(after).flatMap(key => {
          const delta = (after[key as FlockStatKey] ?? 0) - (before[key as FlockStatKey] ?? 0);
          const label = ({cohesion:'HP',damage:'ATK',cover:'Cover',regen:'Regen',draw:'Draw',resonance:'Res',moltPower:'Molt',openSkyGuard:'Guard'} as Record<string,string>)[key] ?? flockStatLabel(key as FlockStatKey);
          return delta ? [`${label} ${delta > 0 ? '+' : ''}${delta}`] : [];
        }).join(' · ') || 'No passive stat change';
      })(),
      id: card.id,
      name: displayName(card),
      bird: card.bird,
      cost: card.cost,
      label: cardLabel(card),
      summary: displayText(card),
      molt: Boolean(card.moltText),
      upgraded: Boolean(card.upgraded),
      accent: card.upgraded ? 0x24d0d6 : card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card),
      accentText: card.type === 'major' ? '#ffe1a3' : card.type === 'molt' ? '#e6c4ff' : '#8df4ff',
      footerRows: needTags.length ? needTags : stats,
      footerUsesObservations: needTags.length > 0,
      collectionStatus: this.mode === 'cardReward'
        ? { firstClaim: !collection, timesClaimed: collection?.timesClaimed ?? 0, targeted }
        : undefined,
      decisionPreview: {
        kind: (this.mode === 'upgradeReward' ? 'preen' : 'add') as 'add' | 'preen',
        deckBefore: this.allDeckCards().length,
        before: card.text,
        after: card.upgradedText,
        moltBefore: card.moltText,
        moltAfter: card.moltTextUpgraded,
        statChanges: cardStatRows({ ...card, upgraded: true }).filter((row) => !cardStatRows(card).includes(row)),
      },
      artKey: compactCardArtKey(card),
      snag: isSnagCard(card),
      focused: !this.rewardSkipArmed && this.battleInputActive && index === this.controllerChoiceIndex,
      armed: this.rewardChoiceArmedId === card.id,
    };
  }


  private rewardWaymarkView(mark: RuntimeRouteMark, index: number) {
    return {
      id: mark.id,
      name: mark.name,
      glyph: waymarkGlyph(mark),
      familyLabel: routeMarkFamilyLabel(mark.family),
      source: mark.source,
      rarity: mark.rarity,
      trigger: mark.trigger,
      familyCount: this.routeMarks.filter((id) => alphaRouteMarkLibrary.get(id)?.family === mark.family).length,
      description: mark.description,
      tags: waymarkSynergyTags(mark),
      accent: mark.family === 'bossPrep' ? 0xff6b57 : mark.family === 'molt' ? 0xc9a6ff : 0xd8a840,
      artKey: waymarkCompactArtAssets[mark.id]?.key,
      focused: this.battleInputActive && index === this.controllerChoiceIndex,
      armed: this.rewardChoiceArmedId === mark.id,
    };
  }

  private renderRewardCeremony() {
    this.queueBattleRewardUiLoad();
    if (this.mode === 'waymarkReward') this.queueWaymarkRewardArtLoad();
    else this.queueCardArtLoad(this.mode === 'cardReward' ? this.rewardChoices : this.upgradeChoices);
    if (!this.rewardPresentationReady()) {
      this.ensureBattleRewardRenderer();
      this.renderRewardRendererLoading();
      return;
    }
    if (!this.battleRewardRendererModule) {
      this.renderRewardRendererFallback();
      return;
    }
    this.normalizeCombatChoiceIndex();
    const mode = this.mode;
    const isCardReward = mode === 'cardReward';
    const cards = mode === 'cardReward' ? this.rewardChoices : mode === 'upgradeReward' ? this.upgradeChoices : [];
    const account = isCardReward ? loadAccount() : undefined;
    const cardCollection = account?.cardCollection ?? {};
    const collectionTargets = new Set(account?.hunt ?? []);
    const title = mode === 'cardReward' ? 'Add to the Flock' : mode === 'upgradeReward' ? 'Preen a Card' : 'Claim a Waymark';
    const districtLean = isCardReward ? this.districtLeans() : [];
    const subtitle = mode === 'cardReward'
      ? `Pick a card or take Scrap.${districtLean.length ? ` District lean: ${districtLean.join(' / ')}.` : ''}`
      : mode === 'upgradeReward' ? 'Pick one card.' : `Read effects, then choose one Waymark. ${controlBindingLabel('roost')} / Y: Read.`;
    const result = this.battleRewardRendererModule.renderRewardCeremony({
      scene: this,
      target: this.root,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      kind: mode === 'waymarkReward' ? 'waymark' : mode === 'upgradeReward' ? 'upgrade' : 'card',
      title,
      subtitle,
      reducedMotion: prefersReducedMotion(),
      leanEffects: prefersLeanEffects(),
      reinforcedColorCues: colorCueState().reinforced,
      fontFamily: UI_FONT,
      boldFontStyle: UI_BOLD,
      goldColor: UI_GOLD,
      cyanColor: UI_CYAN,
      softColor: UI_SOFT,
      textures: {
        ceremonyBackdrop: uiIconAssets['reward-ceremony-backdrop'].key,
        headerPlaque: uiIconAssets['reward-header-plaque'].key,
        choiceSpotlight: uiIconAssets['reward-choice-spotlight'].key,
        choiceGlowBurst: uiIconAssets['reward-choice-glow-burst'].key,
        choiceHoverRing: uiIconAssets['reward-choice-hover-ring'].key,
        choiceCardFrame: uiIconAssets['reward-choice-card-frame'].key,
        deckNeedChipFrame: uiIconAssets['reward-deck-need-chip-frame'].key,
        skipCommandFrame: uiIconAssets['reward-skip-command-frame'].key,
        snagBorder: snagCardBorderAsset.key
      },
      deckNeeds: isCardReward ? this.rewardDeckNeedView() : undefined,
      cards: cards.map((card, index) => this.rewardCardView(card, index, cardCollection[card.id], collectionTargets.has(card.id))),
      waymarks: this.waymarkChoices.map((mark, index) => this.rewardWaymarkView(mark, index)),
      waymarkBuildCards: this.allDeckCards(),
      waymarkSupplyCount: this.runSupplies.length,
      skip: isCardReward ? {
        scrap: this.currentSkipScrapReward(),
        deckSize: this.allDeckCards().length,
        scrapAfter: this.scrap + this.currentSkipScrapReward(),
        armed: this.rewardSkipArmed,
      } : undefined,
      addIcon: (icon, x, y, size) => addUiIconImage(this, icon as UiIconId, x, y, size),
      onCardSelect: (cardId) => this.requestRewardChoice(cardId),
      onCardInspect: (cardId) => this.openRewardCardInspection(cardId),
      failedArtKeys: this.rewardArtFailedKeys,
      onCardArtRetry: (cardId) => {
        const card = cards.find(candidate => candidate.id === cardId);
        if (card) this.queueCardArtLoad([card], true);
      },
      onCardOut: () => this.hideCardPreview(),
      onWaymarkSelect: (waymarkId) => this.requestRewardChoice(waymarkId),
      onWaymarkInspect: (waymarkId) => this.openWaymarkRewardDetail(waymarkId),
      onWaymarkBuildRead: (waymarkId, observations) => {
        this.waymarkRewardBuildObservations[waymarkId] = observations;
      },
      onSkip: () => this.requestSkipCardReward()
    });
    this.rewardChoiceGlowBurstBursts += result.glowBursts;
  }

  private renderRewardRendererLoading() {
    this.battleHandRendererModule?.renderCombatRewardLoading(this);
  }

  private renderRewardRendererFallback() {
    this.normalizeCombatChoiceIndex();
    this.battleHandRendererModule?.renderCombatRewardFallback(this);
    if (this.mode !== 'cardReward') return;
    this.battleHandRendererModule?.renderRewardSkipFallback(this);
  }

  private showChoiceCardDetail(card: Card, x: number, _y: number) {
    const previewX = x <= GAME_WIDTH / 2 ? GAME_WIDTH - 170 : 170;
    this.showCardPreview(card, previewX);
  }

  private focusedRewardCard() {
    return this.battleHandRendererModule?.focusedRewardCard(this);
  }

  private toggleFocusedRewardCardInspection() {
    if (this.rewardInspectionCardId) {
      this.closeRewardCardInspection();
      return;
    }
    const card = this.focusedRewardCard();
    if (card) this.openRewardCardInspection(card.id);
  }

  private openRewardCardInspection(cardId: string) {
    if (this.mode === 'cardReward' && this.rewardSkipArmed) return;
    this.rewardSkipArmed = false;
    const armedChoiceId = this.rewardChoiceArmedId;
    const choices = this.mode === 'cardReward' ? this.rewardChoices : this.upgradeChoices;
    const armedReturnIndex = armedChoiceId
      ? choices.findIndex((choice) => choice.id === armedChoiceId)
      : -1;
    const card = this.battleHandRendererModule?.openRewardCardInspection(this, cardId);
    if (card) {
      this.queueCardArtLoad([card], true);
      if (armedReturnIndex >= 0) {
        this.controllerChoiceIndex = armedReturnIndex;
        this.battleInputActive = true;
        this.requestBattleRender();
      }
      playUiSound('confirm');
      const returnMessage = armedReturnIndex >= 0
        ? `${displayName(choices[armedReturnIndex])} remains selected; Back restores its confirmation without claiming it.`
        : 'Back returns to the same reward choice without claiming it.';
      announceScreenReader(`Inspecting ${displayName(card)}. ${returnMessage}`);
    }
  }

  private closeRewardCardInspection() {
    if (this.battleHandRendererModule?.closeRewardCardInspection(this)) playUiSound('close');
  }

  private renderRewardCardInspection() {
    this.battleHandRendererModule?.syncRewardCardInspection(this, {
      target: this.fxLayer,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      fontFamily: UI_FONT,
      boldFontStyle: UI_BOLD,
      backLabel: controlBindingLabel('back'),
      returnLabel: this.rewardChoiceArmedId ? 'RETURN TO CONFIRM PICK' : 'RETURN TO THIS CHOICE',
      onClose: () => this.closeRewardCardInspection(),
    });
  }

  private openOverlay(overlay: InspectOverlay) {
    if (this.combatInteractionLocked()) return;
    this.queueBattleInspectUiLoad();
    if (overlay === 'deck') this.queueCardArtLoad(this.allDeckCards());
    if (overlay === 'draw') this.queueCardArtLoad(this.drawPile);
    if (overlay === 'discard') this.queueCardArtLoad(this.discardPile);
    if (overlay === 'cleared') this.queueCardArtLoad(this.clearedPile);
    this.inspectOverlay = overlay;
    this.hideCardPreview();
    this.inspectedCardId = overlay === 'flock'
      ? undefined
      : this.battleInspectCards(overlay)[0]?.card.instanceId;
    this.supplyDrawerOpen = false;
    this.waymarkDrawerOpen = false;
    this.cardReviewScroll = 0;
    if (overlay === 'flock') {
      this.flockStatsOverlayFailed = false;
      this.ensureFlockStatsOverlay();
    } else {
      this.battleInspectRendererFailed = false;
      this.ensureBattleInspectRenderer();
    }
    this.requestBattleRender();
  }

  private closeOverlay() {
    this.inspectOverlay = undefined;
    this.inspectedCardId = undefined;
    this.cardReviewScroll = 0;
    playUiSound('close');
    announceScreenReader('Inspection closed. Your selected card and target are unchanged.');
    this.requestBattleRender();
  }

  private switchBattleInspectMode(mode: BattleInspectMode) {
    if (this.combatCardDetail?.active || this.settingsOverlayOpen || this.pauseOverlayOpen) return;
    if (!this.inspectOverlay || this.inspectOverlay === 'flock' || this.inspectOverlay === mode) return;
    if (mode === 'deck') this.queueCardArtLoad(this.allDeckCards());
    if (mode === 'draw') this.queueCardArtLoad(this.drawPile);
    if (mode === 'discard') this.queueCardArtLoad(this.discardPile);
    if (mode === 'cleared') this.queueCardArtLoad(this.clearedPile);
    this.inspectOverlay = mode;
    this.cardReviewScroll = 0;
    this.inspectedCardId = this.battleInspectCards(mode)[0]?.card.instanceId;
    this.requestBattleRender();
  }

  private cycleBattleInspectMode(direction: -1 | 1) {
    if (!this.inspectOverlay || this.inspectOverlay === 'flock') return false;
    const modes: BattleInspectMode[] = ['deck', 'draw', 'discard', 'cleared'];
    const current = Math.max(0, modes.indexOf(this.inspectOverlay));
    const next = modes[(current + direction + modes.length) % modes.length];
    playUiSound('confirm');
    this.switchBattleInspectMode(next);
    return true;
  }

  private renderInspectOverlay(overlay: InspectOverlay) {
    this.queueBattleInspectUiLoad();
    if (overlay === 'flock') {
      if (this.flockStatsOverlayModule) {
        this.flockStatsOverlayModule.renderBattleFlockStats({
          scene: this,
          root: this.root,
          rows: this.flockStatRows(),
          battleRows: [
            ['Beat', `${this.turn}`],
            ['Damage dealt', `${this.statDealt}`],
            ['Damage taken', `${this.statTaken}`],
            ['Damage blocked', `${this.statBlocked}`],
            ['Cards played', `${this.statCardsPlayed}`],
            ['Enemies down', `${this.statDefeated}`],
          ],
          renderFieldPanel,
          renderCloseControl,
          onClose: () => this.closeOverlay(),
          reducedMotion: prefersReducedMotion(),
        });
        return;
      }
      const addTo = (object: Phaser.GameObjects.GameObject) => this.root.add(object);
      addTo(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.76)
        .setInteractive({ useHandCursor: false }));
      const frame = renderFieldPanel(this, addTo, HUD_MENU_PANEL.cx, HUD_MENU_PANEL.cy, HUD_MENU_PANEL.w, HUD_MENU_PANEL.h, {
        accent: this.flockStatsOverlayFailed ? UI_FIELD.danger : UI_FIELD.cyan,
      });
      renderCloseControl(this, addTo, frame.right - HUD_MENU_PANEL.closeX, frame.top + HUD_MENU_PANEL.closeY, () => this.closeOverlay());
      addTo(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, this.flockStatsOverlayFailed ? 'Flock Stats unavailable' : 'Opening Flock Stats…', {
        fontFamily: UI_FONT,
        fontSize: '24px',
        fontStyle: UI_BOLD,
        color: this.flockStatsOverlayFailed ? '#ffb09a' : UI_GOLD,
      }).setOrigin(0.5));
      addTo(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 28, this.flockStatsOverlayFailed
        ? 'Close and reopen the dossier to retry.'
        : 'Tallying passive bonuses.', {
        fontFamily: UI_FONT,
        fontSize: '14px',
        color: UI_SOFT,
      }).setOrigin(0.5));
      return;
    }

    this.ensureBattleInspectRenderer();
    if (this.battleInspectRendererModule) {
      this.battleInspectRendererModule.renderBattleInspect(this.battleInspectRenderContext(overlay));
      return;
    }

    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.76)
      .setInteractive({ useHandCursor: false });
    this.root.add(scrim);
    const frame = renderFieldPanel(this, (obj) => this.root.add(obj), HUD_MENU_PANEL.cx, HUD_MENU_PANEL.cy, HUD_MENU_PANEL.w, HUD_MENU_PANEL.h, {
      accent: this.battleInspectRendererFailed ? 0xff8c6b : UI_FIELD.gold
    });
    renderCloseControl(this, (obj) => this.root.add(obj), frame.right - HUD_MENU_PANEL.closeX, frame.top + HUD_MENU_PANEL.closeY, () => this.closeOverlay());
    this.root.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, this.battleInspectRendererFailed ? 'Card index unavailable' : 'Opening card index…', {
      fontFamily: UI_FONT,
      fontSize: '24px',
      fontStyle: UI_BOLD,
      color: this.battleInspectRendererFailed ? '#ffb09a' : UI_GOLD
    }).setOrigin(0.5));
    this.root.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 28, this.battleInspectRendererFailed ? 'Close and open the pile again to retry.' : 'Sorting the flock records.', {
      fontFamily: UI_FONT,
      fontSize: '14px',
      color: UI_SOFT
    }).setOrigin(0.5));
  }

  private ensureBattleInspectRenderer() {
    if (this.battleInspectRendererModule || this.battleInspectRendererLoading || this.battleInspectRendererFailed) return;
    this.battleInspectRendererLoading = true;
    void loadBattleInspectRendererModule()
      .then((module) => {
        if (!this.sys.settings.active) return;
        this.battleInspectRendererModule = module;
        this.battleInspectRendererLoading = false;
        this.battleInspectRendererFailed = false;
        if (this.inspectOverlay && this.inspectOverlay !== 'flock') this.requestBattleRender();
      })
      .catch((error) => {
        console.warn(LAZY_LOAD_FAILED, error);
        if (!this.sys.settings.active) return;
        this.battleInspectRendererLoading = false;
        this.battleInspectRendererFailed = true;
        if (this.inspectOverlay && this.inspectOverlay !== 'flock') this.requestBattleRender();
      });
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
        if (this.inspectOverlay === 'flock') this.requestBattleRender();
      })
      .catch((error) => {
        this.flockStatsOverlayLoading = false;
        this.flockStatsOverlayFailed = true;
        console.warn(LAZY_LOAD_FAILED, error);
        if (this.sys.settings.active && this.inspectOverlay === 'flock') this.requestBattleRender();
      });
  }

  private battleInspectCards(overlay: BattleInspectMode) {
    const entries = overlay === 'deck'
      ? this.deckReviewCards()
      : overlay === 'draw'
        ? this.drawPile.map((card) => ({ card, zone: 'Draw' }))
        : overlay === 'discard'
          ? this.discardPile.map((card) => ({ card, zone: 'Discard' }))
          : this.clearedPile.map((card) => ({ card, zone: 'Cleared' }));
    return entries.sort((a, b) => (
      zoneRank(a.zone) - zoneRank(b.zone)
      || displayName(a.card).localeCompare(displayName(b.card))
      || a.card.instanceId.localeCompare(b.card.instanceId)
    ));
  }

  private battleInspectCardView(card: Card, zone: string): BattleInspectCardView {
    const contract = this.activeCardContract(card);
    return {
      id: card.instanceId,
      name: displayName(card),
      bird: card.bird,
      label: cardLabel(card),
      zone,
      zoneIcon: zoneIconForLabel(zone),
      zoneRank: zoneRank(zone),
      cost: this.effectiveCost(card),
      upgraded: Boolean(card.upgraded),
      type: card.type,
      usesMolt: Boolean(contract.usesMolt),
      currentText: contract.text,
      alternateText: contract.usesMolt ? displayText(card) : card.upgraded ? 'Already preened.' : card.upgradedText,
      targetIcon: targetIconForTarget(contract.target),
      targetLabel: targetLabel(contract.target),
      roleIcon: roleIconForCard(contract),
      roleLabel: contract.role.toUpperCase(),
      stats: cardStatEntries(card).map((entry) => ({ icon: statIconForKey(entry.key), value: entry.value })),
      artKey: loadedCardArtKey(this, card),
      snag: isSnagCard(card)
    };
  }

  private battleInspectRenderContext(overlay: BattleInspectMode): import('../game/battle/render-inspect').BattleInspectRenderContext {
    const entries = this.battleInspectCards(overlay);
    const cardsById = new Map(entries.map(({ card }) => [card.instanceId, card]));
    const cards = entries.map(({ card, zone }) => this.battleInspectCardView(card, zone));
    return {
      scene: this,
      target: this.root,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      mode: overlay,
      title: overlay === 'deck'
        ? `Deck Review (${this.allDeckCards().length})`
        : overlay === 'draw'
          ? `Draw Pile (${cards.length})`
          : overlay === 'discard'
            ? `Discard (${cards.length})`
            : `Cleared (${cards.length})`,
      cards,
      selectedCardId: this.inspectedCardId,
      scroll: this.cardReviewScroll,
      visibleRows: CARD_REVIEW_VISIBLE_ROWS,
      rowHeight: CARD_REVIEW_ROW_H,
      drawCount: this.drawPile.length,
      deckCount: this.allDeckCards().length,
      discardCount: this.discardPile.length,
      clearedCount: this.clearedPile.length,
      fontFamily: UI_FONT,
      boldFontStyle: UI_BOLD,
      goldColor: UI_GOLD,
      softColor: UI_SOFT,
      cyanColor: UI_CYAN,
      onClose: () => { playUiSound('close'); this.closeOverlay(); },
      renderSnagArt: (cardId, x, y, width, height, alpha) => {
        const card = cardsById.get(cardId);
        return card ? renderSnagCardBorder(this, (obj) => this.root.add(obj), card, x, y, width, height, alpha) : false;
      },
      onInspect: (cardId) => this.inspectCard(cardId),
      onRead: () => this.toggleCombatCardDetail(),
      onScroll: (delta) => this.scrollCardReview(delta),
      onSwitchMode: (mode) => this.switchBattleInspectMode(mode),
      onConfirmSound: () => playUiSound('confirm')
    };
  }

  private inspectCard(cardId: string) {
    if (this.combatCardDetail?.active || this.settingsOverlayOpen || this.pauseOverlayOpen) return;
    this.inspectedCardId = cardId;
    this.requestBattleRender();
  }

  private moveCardReviewFocus(direction: -1 | 1, page = false) {
    if (this.combatCardDetail?.active || this.settingsOverlayOpen || this.pauseOverlayOpen) return true;
    if (!this.inspectOverlay || this.inspectOverlay === 'flock') return false;
    const cards = this.battleInspectCards(this.inspectOverlay);
    if (cards.length === 0) {
      playUiSound('locked');
      return true;
    }
    const current = Math.max(0, cards.findIndex(({ card }) => card.instanceId === this.inspectedCardId));
    const step = page ? CARD_REVIEW_VISIBLE_ROWS : 1;
    const next = clamp(current + direction * step, 0, cards.length - 1);
    if (next === current) {
      playUiSound('locked');
      return true;
    }
    this.inspectedCardId = cards[next].card.instanceId;
    if (next < this.cardReviewScroll) this.cardReviewScroll = next;
    else if (next >= this.cardReviewScroll + CARD_REVIEW_VISIBLE_ROWS) {
      this.cardReviewScroll = next - CARD_REVIEW_VISIBLE_ROWS + 1;
    }
    playUiSound('confirm');
    this.requestBattleRender();
    return true;
  }

  private scrollCardReview(delta: number) {
    if (this.combatCardDetail?.active || this.settingsOverlayOpen || this.pauseOverlayOpen) return;
    if (!this.inspectOverlay || this.inspectOverlay === 'flock') return;
    const cards = this.battleInspectCards(this.inspectOverlay);
    const nextScroll = clamp(this.cardReviewScroll + delta, 0, Math.max(0, cards.length - CARD_REVIEW_VISIBLE_ROWS));
    if (nextScroll === this.cardReviewScroll) return;
    this.cardReviewScroll = nextScroll;
    const selected = cards.findIndex(({ card }) => card.instanceId === this.inspectedCardId);
    if (selected < nextScroll || selected >= nextScroll + CARD_REVIEW_VISIBLE_ROWS) {
      const nextSelected = delta > 0
        ? Math.min(cards.length - 1, nextScroll + CARD_REVIEW_VISIBLE_ROWS - 1)
        : nextScroll;
      this.inspectedCardId = cards[nextSelected]?.card.instanceId;
    }
    this.requestBattleRender();
  }

  private deckReviewCards() {
    return [
      ...this.drawPile.map((card) => ({ card, zone: 'Deck' })),
      ...this.hand.map((card) => ({ card, zone: 'Hand' })),
      ...this.discardPile.map((card) => ({ card, zone: 'Discard' })),
      ...this.clearedPile.map((card) => ({ card, zone: 'Cleared' }))
    ];
  }

  private outcomeActions(): Array<{
    id: 'replay' | 'details' | 'rate' | 'menu' | 'practice';
    label: string;
    activate: () => void;
  }> {
    const actions: Array<{
      id: 'replay' | 'details' | 'rate' | 'menu' | 'practice';
      label: string;
      activate: () => void;
    }> = [{ id: 'replay', label: 'Replay Flight', activate: () => this.replayLastFlight() }];
    if (window.__birdSquadLastRun) {
      actions.push({ id: 'details', label: 'Flight Details', activate: () => this.openOutcomeFlightDetails() });
    }
    if (PLAYTEST_MODE && window.__birdSquadLastRun) {
      actions.push({ id: 'rate', label: 'Rate This Run', activate: () => this.openPlaytestRunRating() });
    }
    if (this.practiceRematch || this.mode === 'defeat' && window.__birdSquadLastRun?.result === 'loss') actions.push({ id: 'practice', label: 'Practice This Fight', activate: () => this.practiceLostFight() });
    actions.push({ id: 'menu', label: 'Main Menu', activate: () => this.returnToMainMenu() });
    return actions;
  }

  private outcomeFlightDetails(): import('../game/boss-dossier').OutcomeFlightDetails | undefined {
    const summary = window.__birdSquadLastRun;
    if (!summary || !this.bossDossierModule) return undefined;
    const details = buildOutcomeFlightDetailsFor(summary, this.bossDossierModule);
    details.results.push(...this.outcomeUnlockHighlights().map(item => `${item.name}: ${item.description}`));
    return details;
  }

  private outcomeInputActions() {
    return [...this.outcomeActions(), {
      id: 'copy' as const, label: 'Copy seeded flight', activate: () => {
        // Use the live control's ownership/disabled guard, including clipboard retry.
        this.root?.getByName('run-outcome-flight-link-hit')?.emit('pointerdown');
      },
    }];
  }

  private openOutcomeFlightDetails() {
    if (!isRunOutcome(this.mode) || !window.__birdSquadLastRun) {
      playUiSound('locked');
      return;
    }
    playUiSound('confirm');
    this.outcomeDetailsOpen = true;
    this.controllerChoiceIndex = 0;
    this.requestBattleRender();
  }

  private closeOutcomeFlightDetails() {
    if (!this.outcomeDetailsOpen) return;
    playUiSound('close');
    this.outcomeDetailsOpen = false;
    this.controllerChoiceIndex = Math.max(0, this.outcomeActions().findIndex((action) => action.id === 'details'));
    this.requestBattleRender();
  }

  private renderOutcome() {
    this.queueBattleRewardUiLoad();
    if (this.bossDossierModule) this.bossDossierModule.renderOutcomeScene(this);
    else pendingOverlay(this, object => this.root.add(object), loadBossDossierModule, module => {
      this.bossDossierModule = module;
      this.requestBattleRender();
    }, () => this.returnToMainMenu(), 'Main Menu');
  }

  private outcomeUnlockHighlights(): Array<{ id: string; name: string; kind: 'leader' | 'achievement' | 'contract' | 'dossier' | 'record'; description: string }> {
    const rewards = this.lastRunRewards ?? { newLeaders: [], newAchievements: [], newContractBadges: [], newEnemyMoves: [], newPersonalRecords: [], account: loadAccount() };
    return this.bossDossierModule?.outcomeProgressionHighlights(rewards, {
      leader: (id) => ({ name: getLeader(id).name, description: leaderUnlockHints[id] ?? 'New Flock Leader ready.' }),
      achievement: (id) => {
        const item = achievements.find((candidate) => candidate.id === id);
        return { name: item?.name ?? id, description: item?.desc ?? 'New achievement earned.' };
      },
      contract: (id) => ({
        name: DISTRICT_CONTRACT_DEFINITIONS.find((candidate) => candidate.id === id)?.name ?? 'District Contract',
        description: 'Permanent contract badge added to the Flock Record.'
      }),
      enemy: (id) => alphaEnemyLibrary.get(id)
    }) ?? [];
  }

  private outcomeBossDossierGoal() {
    return this.bossDossierModule?.nextBossDossierGoal(
      window.__birdSquadLastRun?.combatResults.flatMap((combat) => combat.enemyIds) ?? [],
      (this.lastRunRewards?.account ?? loadAccount()).observedEnemyMoves,
      (id) => alphaEnemyLibrary.get(id)
    );
  }

  private outcomeCardDiscoveryGoal() {
    return this.bossDossierModule?.nextCardDiscoveryGoal(
      alphaCardSet.cards,
      (this.lastRunRewards?.account ?? loadAccount()).discoveredCards
    );
  }

  private onCardClicked(instanceId: string) {
    if (this.discardChoice) {
      this.toggleDiscardChoice(instanceId);
      return;
    }
    if (this.combatInteractionLocked()) {
      // Selection is harmless during a player-card animation; execution is not.
      // Never queue a play, and never bypass an enemy turn, choice, or modal.
      if (this.playerCardFxBaseline && !this.combatCardDetail?.active && !this.discardChoice && !this.returnChoice
        && !this.pauseOverlayOpen && !this.settingsOverlayOpen && this.mode === 'battle') {
        const next = this.hand.find(card => card.instanceId === instanceId);
        if (next) {
          this.selectedInstanceId = instanceId;
          this.controllerChoiceIndex = this.hand.indexOf(next);
          this.refreshHandCardSelection();
          this.showCardPreview(next);
        }
      }
      return;
    }
    const cardIndex = this.hand.findIndex((candidate) => candidate.instanceId === instanceId);
    const card = this.hand[cardIndex];
    if (!card) {
      this.statInvalidActions += 1;
      return;
    }
    const canPay = this.effectiveCost(card) <= this.energy;
    const retentionActive = this.projectedRoostRetainCount() > 0;
    if (!canPay && !retentionActive) {
      this.statInvalidActions += 1;
      this.explainCardCost(card);
      return;
    }
    this.controllerChoiceIndex = Math.max(0, cardIndex);
    this.normalizeSelectedEnemy();
    if (this.selectedInstanceId === instanceId) {
      if (canPay) this.playCardAnimated(card);
      else this.explainCardCost(card);
      return;
    }
    this.selectedInstanceId = instanceId;
    playUiSound('confirm');
    this.hideCardPreview();
    hideKwTooltip();
    if (retentionActive) this.requestBattleRender();
    else this.refreshHandCardSelection();
    this.refreshCombatSelectionPreview();
    this.showCardPreview(card);
  }

  private openWaymarkRewardDetail(id = this.waymarkChoices[this.controllerChoiceIndex]?.id) {
    if (this.mode !== 'waymarkReward' || !this.rewardPresentationReady() || this.settingsOverlayOpen || this.pauseOverlayOpen || this.combatCardDetail?.active) return;
    const mark = this.waymarkChoices.find(choice => choice.id === id);
    if (!mark || !this.battleHandRendererModule) return;
    this.combatCardDetail = this.battleHandRendererModule.renderWaymarkRewardDetail(this.combatReaderContext(), mark.name, mark.description, `${mark.rarity} · ${this.waymarkFamilyLabel(mark)} · ${mark.source}`, this.waymarkRewardBuildObservations[mark.id] ?? []);
  }

  private onEnemyClicked(enemyId: string) {
    if (this.combatInteractionLocked()) return;
    if (!this.getLivingEnemy(enemyId)) {
      this.statInvalidActions += 1;
      this.normalizeSelectedEnemy();
      this.requestBattleRender();
      return;
    }
    this.selectedEnemyId = enemyId;
    const card = this.getSelectedCard();
    if (card && this.activeCardContract(card).target === 'enemy') {
      this.playCardAnimated(card, enemyId);
      return;
    }
    this.requestBattleRender();
  }

  private combatTimingDelay(ms: number, timingScale?: number) {
    if (ms <= 0) return 0;
    const pace = combatPacePreference();
    const paceScale = timingScale ?? (pace === 'snappy' ? COMBAT_SNAPPY_TIMING_SCALE : 1);
    const reducedScale = prefersReducedMotion() ? COMBAT_REDUCED_MOTION_TIMING_SCALE : 1;
    const minimum = prefersReducedMotion()
      ? COMBAT_REDUCED_MOTION_MIN_DELAY_MS
      : paceScale < 1 ? COMBAT_SNAPPY_MIN_DELAY_MS : 0;
    return Math.max(minimum, Math.round(ms * paceScale * reducedScale));
  }

  private enemyMovePacingKey(enemy: Enemy, move: EnemyMove) {
    return `${enemy.runtime.id}:${move.id}`;
  }

  enemyMoveTimingScale(enemy: Enemy, move: EnemyMove) {
    const pace = combatPacePreference();
    const firstUse = !this.runSeenEnemyMoves.has(this.enemyMovePacingKey(enemy, move));
    const bossFight = currentCombatNodes()[this.currentRouteIndex]?.type === 'boss';
    if (pace === 'cinematic') return 1;
    if (firstUse || bossFight) return pace === 'snappy' ? 0.28 : 0.38;
    return pace === 'snappy' ? 0.18 : COMBAT_STANDARD_REPEAT_TIMING_SCALE;
  }

  enemyTurnPreambleDelay() {
    return this.combatTimingDelay(combatPacePreference() === 'cinematic' ? 800 : ENEMY_TURN_PREAMBLE_MS);
  }

  prepareEnemyMoveContext() {
    setEnemyMoveContext(this.enemyContext());
  }

  private combatInteractionLocked() {
    return this.mode !== 'battle'
      || Boolean(this.inspectOverlay)
      || Boolean(this.combatCardDetail?.active)
      || this.combatAnimationPending
      || Boolean(this.discardChoice)
      || Boolean(this.returnChoice)
      || this.pauseOverlayOpen
      || this.settingsOverlayOpen;
  }

  private enemyTurnBeatLabel(beat = this.combatEnemyTurnBeat) {
    switch (beat) {
      case 'preamble': return 'Enemy Turn';
      case 'windup': return 'Wind-up';
      case 'release': return 'Commit';
      case 'impact': return 'Impact';
      case 'recovery': return 'Recovery';
      case 'interlude': return 'Next Threat';
      default: return `Beat ${this.turn}`;
    }
  }

  private replayLastFlight() {
    if (!this.ensureOutcomeSaved()) return;
    const summary = window.__birdSquadLastRun!;
    playUiSound('confirm');
    this.scene.start('RouteScene', {
      runState: createInitialRunState(
        summary.leaderId,
        summary.difficulty,
        summary.runMode,
        summary.seed,
        practiceStartingDeck()
      )
    });
  }

  private practiceLostFight() {
    if (!isRunOutcome(this.mode) || !this.ensureOutcomeSaved()) return;
    if (!memoryStorageSessionActive() && !beginPracticeSession()) return;
    this.scene.restart({ ...structuredClone(this.battleStartingData), practiceRematch: true });
  }

  private openPlaytestRunRating() {
    if (!this.ensureOutcomeSaved()) return;
    if (!PLAYTEST_MODE || !window.__birdSquadLastRun) {
      playUiSound('locked');
      return;
    }
    playUiSound('confirm');
    openProfileScene(this, { openSaveData: true });
  }

  private returnToMainMenu() {
    if (isRunOutcome(this.mode) && !this.ensureOutcomeSaved()) return;
    playUiSound('close');
    this.scene.start('MenuScene');
  }

  private saveFlywayEnding() {
    this.flywayArchiveSaved = persistFlywayEnding(this.flyway, saveCards(this.allDeckCards()));
    return this.flywayArchiveSaved;
  }

  private ensureOutcomeSaved() {
    if ((this.outcomeSaved && this.flywayArchiveSaved) || memoryStorageSessionActive()) return true;
    const retry = () => {
      // Keep the active checkpoint until the journal, seals, and result are durable.
      if (!this.flywayArchiveSaved && !this.saveFlywayEnding()) return false;
      if (!this.outcomeSaved) {
        const rewards = window.__birdSquadLastRun && persistFinishedRun(window.__birdSquadLastRun);
        if (!rewards) return false;
        this.lastRunRewards = rewards; this.outcomeSaved = true;
      }
      this.requestBattleRender(); return true;
    };
    if (retry()) return true;
    showSaveRecovery(retry);
    return false;
  }

  private setEnemyTurnBeat(beat: EnemyTurnBeat, move = '', durationMs = 0) {
    // Retire phase-owned art even when Hustle shortens its original tween.
    // A windup halo must never linger into another enemy's attack.
    if (beat !== this.combatEnemyTurnBeat && this.fxLayer) {
      const names = this.combatEnemyTurnBeat === 'windup'
        ? ['combat-threat-charge', 'combat-enemy-support-charge', 'combat-enemy-attack-tell', 'combat-enemy-support-tell', 'combat-enemy-windup-plaque']
        : beat === 'recovery' ? ['combat-enemy-commitment-seal']
        : beat === 'interlude' || beat === 'idle' ? ['combat-enemy-recovery-afterglow'] : [];
      for (const object of [...this.fxLayer.list]) {
        if (!names.includes(object.name)) continue;
        killTweensForTree(this, object);
        object.destroy();
      }
    }
    this.combatEnemyTurnBeat = beat;
    this.combatEnemyTurnMove = move;
    this.combatEnemyTurnBeatStartedAtMs = this.time?.now ?? 0;
    this.combatEnemyTurnBeatDurationMs = Math.max(0, durationMs);
  }

  private enemyTurnBeatProgress(): EnemyTurnProgress {
    const durationMs = Math.max(0, this.combatEnemyTurnBeatDurationMs);
    const timerElapsed = this.combatFxModule?.enemyTurnAccelerationElapsed(this);
    const elapsedMs = Math.max(0, Math.round(timerElapsed ?? ((this.time?.now ?? 0) - this.combatEnemyTurnBeatStartedAtMs)));
    return {
      label: this.enemyTurnBeatLabel(),
      progress: durationMs > 0 ? Phaser.Math.Clamp(elapsedMs / durationMs, 0, 1) : 0,
      elapsedMs,
      durationMs,
    };
  }

  private playCardAnimated(card: Card, enemyId = this.selectedEnemyId) {
    if (this.effectiveCost(card) > this.energy) { this.explainCardCost(card); return; }
    // Outcome art is never needed to understand the opening board. Warm it as
    // soon as the player commits so it is ready before a normal victory while
    // keeping route -> first interaction free of those decoded textures.
    this.queueOutcomeCombatFxAssetLoad();
    const contract = this.activeCardContract(card);
    const attack = contract.target === 'enemy' || contract.target === 'allEnemies';
    const delay = combatPacePreference() === 'cinematic'
      ? (attack ? 430 : 300)
      : (attack ? PLAYER_ATTACK_RESOLVE_DELAY_MS : PLAYER_CARD_RESOLVE_DELAY_MS);
    this.playCard(card, enemyId, { resolveDelayMs: this.combatTimingDelay(delay) });
  }

  private beginPlayerCardFxWindow() {
    this.playerCardFxBaseline = new Set(this.fxLayer?.list ?? []);
    this.playerCardFxLastRetired = 0;
  }

  private explainCardCost(card: Card, reason?: string) {
    const missing = this.effectiveCost(card) - this.energy;
    const summary = reason ?? `Needs ${missing} more Wingbeat${missing === 1 ? '' : 's'}.`;
    const notice = this.fxLayer?.getByName('combat-action-rejection');
    if (notice?.getData('source') === displayName(card) && notice.getData('summary') === summary) return;
    announceScreenReader(`${displayName(card)}. ${summary}`);
    playUiSound('locked');
    this.battleFxPresenterModule?.presentTriggerFeedback(this, this.fxLayer, {
      name: displayName(card), summary, accent: UI_FIELD.gold, turn: this.turn, action: true,
      fontFamily: UI_FONT, reducedMotion: prefersReducedMotion(), holdScale: textPaceScale(),
    });
  }

  private playerCardFxTransientCount() {
    const baseline = this.playerCardFxBaseline;
    if (!baseline || !this.fxLayer) return 0;
    return this.fxLayer.list.reduce(
      (count, object) => count + (baseline.has(object) || object.active === false ? 0 : 1),
      0,
    );
  }

  private retirePlayerCardFxWindow(destroyTransient: boolean) {
    const baseline = this.playerCardFxBaseline;
    if (!baseline || !this.fxLayer) {
      this.playerCardFxBaseline = undefined;
      return 0;
    }
    let retired = 0;
    if (destroyTransient) {
      for (const object of [...this.fxLayer.list]) {
        if (baseline.has(object) || object.active === false || object === this.cardPreview) continue;
        retired += 1;
        killTweensForTree(this, object);
        object.destroy();
      }
      // Generated effects release their own count. Baseline effects can still
      // be alive, so retiring only this card's window must not zero their count.
      this.activeFxParticleBursts = 0;
    }
    this.playerCardFxBaseline = undefined;
    this.playerCardFxLastRetired = retired;
    return retired;
  }

  activateFlywayCall() {
    if (this.combatInteractionLocked() || this.combatIntroActive || this.supplyDrawerOpen || this.waymarkDrawerOpen) return false;
    const leader = this.runLeaderId ?? 'fledgling';
    if (!takeCall(this.flightCombat, leader)) return false;
    const call = resolvedLeaderCall(leader, this.flyway), rules = call.rules;
    const targets = rules.all ? this.enemies.filter(e=>e.hp>0) : [this.resolvePlayableEnemyTarget(this.selectedEnemyId)].filter((e): e is Enemy=>!!e);
    for (const target of targets) {
      if (rules.damage) this.damageEnemy(target.id,rules.damage,call.name,undefined,rules.pierce);
      if (rules.winded && target.hp>0) { target.weak+=rules.winded; this.triggerTalonPinnedOpening(target); }
    }
    if (rules.energy) this.energy+=rules.energy;
    if (rules.draw) this.drawCards(rules.draw);
    if (rules.heal) this.healFlock(rules.heal,call.name);
    if (rules.cover) this.gainBlock(rules.cover,call.name);
    this.flyway.leaderCalls += 1;
    this.logEvent(`${call.name}: ${call.effect}`);
    this.events.emit('flyway-call', call.name);
    this.updateFlywayBossBreaks(); this.checkOutcome(); this.renderAll(); return true;
  }

  private updateFlywayBossBreaks() {
    for (const enemy of this.enemies) {
      const rule = bossDisruption(enemy, activeMapIndex);
      if (enemy.hp <= 0 || enemy.flywayBreakUsed || !rule?.met || !moveDealsDamage(currentMove(enemy))) continue;
      enemy.flywayBroken = true; enemy.flywayBreakUsed = true;
      this.flightCombat.bossBreaks.push(enemy.id);
      this.logEvent(`${enemy.name}'s attack is disrupted. ${rule.rule}`);
      this.events.emit('flyway-break', enemy.id);
    }
  }

  private playCard(card: Card, enemyId = this.selectedEnemyId, options: PlayCardOptions = {}) {
    if (this.combatInteractionLocked()) return;
    this.hideCardPreview();
    const contract = this.activeCardContract(card);
    const targetEnemy = this.resolvePlayableEnemyTarget(enemyId);
    if (contract.target === 'enemy' && !targetEnemy) { this.explainCardCost(card, 'No living enemy to target.'); return; }
    enemyId = targetEnemy?.id ?? enemyId;
    const cost = this.effectiveCost(card);
    if (cost > this.energy) { this.explainCardCost(card); return; }
    const handSizeBeforePlay = this.hand.length;
    const handIndexBeforePlay = Math.max(0, this.hand.findIndex((candidate) => candidate.instanceId === card.instanceId));
    const playedCard = this.removeCardFromHand(card.instanceId);
    if (!playedCard) return;
    this.resolvingCard = playedCard;
    this.cardContributionStart = this.cardContributions.find(row => row.cardId === playedCard.id);
    if (this.cardContributionStart) this.cardContributionStart = { ...this.cardContributionStart };
    recordFirstFlightGuideEvent('card');
    if (playedCard.runtime.kind === 'molt') completeFirstMoltGuide();
    birdAudio.play('card', 1, playedCard.runtime.suit, contract.usesMolt);
    this.energy -= cost;
    if (cost > 0) {
      const spendColor = suitFxMeta(playedCard.runtime.suit).color;
      birdAudio.play('spend', 0.82 + cost * 0.08);
      this.wingbeatSpendFx(FLOCK_FX_X + 18, FLOCK_FX_Y - 78, cost, spendColor);
    }
    this.statCardsPlayed += 1;
    this.cardsPlayedThisTurn += 1;
    if (cost === 0) this.zeroCostThisTurn += 1;
    this.statMaxCardsPlayedTurn = Math.max(this.statMaxCardsPlayedTurn, this.cardsPlayedThisTurn);
    const resolveDelayMs = options.resolveDelayMs ?? 0;
    if (resolveDelayMs > 0) this.beginPlayerCardFxWindow();
    this.playCardCastFx(playedCard, enemyId, handIndexBeforePlay, handSizeBeforePlay, contract, resolveDelayMs);

    if (resolveDelayMs > 0) {
      this.combatAnimationPending = true;
      this.selectedInstanceId = undefined;
      // Preserve the live board through the cast. Only retire the committed
      // card and update energy; rebuilding every text texture here stalls FX.
      const committed = this.handCardRects.get(playedCard.instanceId);
      const presentation = committed?.getData('presentation') as Phaser.GameObjects.GameObject[] | undefined;
      if (presentation) {
        for (const object of presentation) {
          (object as Phaser.GameObjects.Rectangle).setVisible(false);
          if (object.input) object.input.enabled = false;
        }
        this.handCardRects.delete(playedCard.instanceId);
        const energyValue = this.root.getByName('hud-value-Wingbeats') as Phaser.GameObjects.Text;
        energyValue?.setText(`${this.energy}/${3 + this.nextTurnEnergyBonus}`);
        this.selectionOutcomePreview?.destroy(true);
        this.selectionOutcomePreview = undefined;
        this.refreshHandCardSelection();
      } else this.renderAll();
      this.combatPlayerCommitSigil(playedCard, enemyId, contract, resolveDelayMs);
      const actor = this.fxLayer.getByName('combat-card-cast-ghost');
      if (actor) this.fxLayer.bringToTop(actor);
      this.time.delayedCall(resolveDelayMs, () => {
        this.finishPlayedCardResolution(playedCard, enemyId, contract, handIndexBeforePlay, handSizeBeforePlay);
        if (this.mode !== 'battle') {
          this.retirePlayerCardFxWindow(false);
          this.combatAnimationPending = false;
          return;
        }
        this.time.delayedCall(Math.min(PLAYER_CARD_FEEDBACK_SETTLE_MS, this.combatTimingDelay(PLAYER_CARD_FEEDBACK_SETTLE_MS)), () => {
          this.retirePlayerCardFxWindow(true);
          this.combatAnimationPending = false;
          if (this.mode === 'battle') this.renderAll();
        });
      });
      return;
    }

    this.finishPlayedCardResolution(playedCard, enemyId, contract, handIndexBeforePlay, handSizeBeforePlay);
  }

  private finishPlayedCardResolution(
    playedCard: Card,
    enemyId: string,
    contract: ActiveCardContract,
    handIndexBeforePlay: number,
    handSizeBeforePlay: number
  ) {
    // Impact is the hard lifetime boundary, even if a dropped frame or a pace
    // change leaves the decorative tween behind the combat clock.
    const cast = this.fxLayer.getByName('combat-card-cast-ghost');
    if (cast) { killTweensForTree(this, cast); cast.destroy(); }
    this.resolveCardEffectsInteractive(playedCard, enemyId, contract, (outcome) => {
      this.finalizePlayedCardResolution(playedCard, handIndexBeforePlay, handSizeBeforePlay, outcome, enemyId);
    });
  }

  private finalizePlayedCardResolution(
    playedCard: Card,
    handIndexBeforePlay: number,
    handSizeBeforePlay: number,
    outcome: EffectResolutionState,
    enemyId: string,
  ) {
    if (playedCard.runtime.suit) {
      this.playedSuitsThisTurn.add(playedCard.runtime.suit);
      this.triggerFledglingSuitRally(playedCard);
      this.checkSuitPlayedMarks(playedCard.runtime.suit);
    }
    chargeCall(this.flightCombat, this.runLeaderId ?? 'fledgling', 'suit', 1, playedCard.runtime.suit ?? undefined);
    const combo = playCombination(this.flightCombat, playedCard.runtime.suit);
    if (combo) {
      const target = this.enemies.find(enemy => enemy.id === enemyId && enemy.hp > 0);
      const hpBefore = target?.hp ?? 0, coverBefore = this.flock.block, resonanceBefore = this.spark;
      if (combo.effect === 'damage' && target) this.damageEnemy(target.id, 2, combo.name);
      if (combo.effect === 'resonance') this.gainResonance(1);
      if (combo.effect === 'cover') this.gainBlock(3, combo.name);
      const moment = { id: combo.id, turn: this.turn, damage: Math.max(0, hpBefore - (target?.hp ?? 0)), cover: Math.max(0, this.flock.block - coverBefore), resonance: Math.max(0, this.spark - resonanceBefore), defeated: hpBefore > 0 && target?.hp === 0 };
      const old = this.flyway.comboMoment;
      if (!old || moment.defeated || !old.defeated && moment.damage + moment.cover + moment.resonance > old.damage + old.cover + old.resonance) this.flyway.comboMoment = moment;
      this.flyway.combinations += 1;
      this.logEvent(`${combo.name}: ${combo.rule}`);
      this.events.emit('flyway-combination', combo);
    }
    this.events.emit('flyway-card', playedCard, enemyId);
    this.playedCardIdsThisCombat.add(playedCard.id);
    this.checkNthCardMarks(); // rooftop_shortcut-style Waymarks that trigger on the Nth card
    this.updateFlywayBossBreaks();

    // (Molt is now a whole-turn transform stance - it no longer breaks on the
    // next card. It ends in endTurn, leaving the flock briefly Open Sky.)

    // A snag like Bad Directions shuffles itself back into the draw pile instead
    // of discarding, so it keeps clogging the hand until removed at a deck node.
    if (outcome.exhaustSelf) {
      this.clearedPile.push(playedCard);
      this.logEvent(`${displayName(playedCard)} is cleared for this combat.`);
    }
    else if (outcome.returnSelfToDraw) this.addCardToDrawRandom(playedCard);
    else {
      this.discardPile.push(playedCard);
      this.animateDiscard(1, this.handCardLeft(handIndexBeforePlay, handSizeBeforePlay) + CARD_W / 2, HAND_Y, 0.82);
    }
    this.observeCardEffect('plays', 1);
    this.combatFxModule?.presentCardPayoff(this, playedCard, this.cardContributions.find(row => row.cardId === playedCard.id), this.cardContributionStart);
    this.cardContributionStart = undefined;
    this.resolvingCard = undefined;
    if (!this.hand.some(card => card.instanceId === this.selectedInstanceId)) this.selectedInstanceId = undefined;
    this.checkOutcome();
    // Animated cards publish the settled board once when input unlocks. An
    // intermediate full rebuild here adds a hitch between impact and readiness.
    if (!this.combatAnimationPending || this.mode !== 'battle') this.renderAll();
  }

  private playCardCastFx(card: Card, _enemyId: string, handIndex = 0, handSize = this.hand.length + 1, contract = this.activeCardContract(card), resolveDelayMs = 0) {
    const budget = resolveDelayMs || (contract.target === 'enemy' || contract.target === 'allEnemies' ? PLAYER_ATTACK_RESOLVE_DELAY_MS : PLAYER_CARD_RESOLVE_DELAY_MS);
    this.combatFxModule?.playFlockAction(this, card, _enemyId, contract, budget);

  }

  resolveCardEffects(card: Card, enemyId: string, contract = this.activeCardContract(card)): EffectResolutionState {
    // While Molting, a card resolves its unique Molt ability (do-different)
    // instead of its normal effect. Cards without one fall back to normal.
    const molting = contract.usesMolt;
    const effects = contract.effects;
    if (molting) {
      const moltLabel = contract.text;
      this.logEvent(`${displayName(card)} molts - ${moltLabel}`);
      this.presentFlockStatus('Molt!', '#ff9d4d', 'molt');
    }
    const state = createCardEffectResolutionState(molting ? this.activeMoltPower() : 0);
    for (const effect of effects) {
      this.resolveCardEffect(effect, card, enemyId, state);
    }
    return state;
  }

  private resolveCardEffectsInteractive(
    card: Card,
    enemyId: string,
    contract: ActiveCardContract,
    onComplete: (state: EffectResolutionState) => void,
  ) {
    const molting = contract.usesMolt;
    if (molting) {
      this.logEvent(`${displayName(card)} molts - ${contract.text}`);
      this.presentFlockStatus('Molt!', '#ff9d4d', 'molt');
    }
    const state = createCardEffectResolutionState(molting ? this.activeMoltPower() : 0);
    this.resolveCardEffectSequenceInteractive(contract.effects, card, enemyId, state, displayName(card), undefined, () => onComplete(state));
  }

  private interactiveCardChoiceEffect(effectText: string, card: Card, enemyId: string, state: EffectResolutionState): InterruptibleDecision | undefined {
    let active = effectText;
    const conditional = active.match(/^if ([a-zA-Z][a-zA-Z0-9]*(?:\([a-zA-Z0-9_,-]+\))?) then (.+)$/);
    if (conditional) {
      if (!this.checkCardCondition(conditional[1], card, enemyId, state)) return undefined;
      active = conditional[2];
    }
    const parsed = parseEffect(active);
    if (!parsed) return undefined;
    if (parsed.name === 'discard' || parsed.name === 'discardUpTo') return {
      kind: 'discard',
      amount: Math.max(0, parseEffectValue(parsed.args[1] ?? parsed.args[0], state.previousDiscarded, this.getLivingEnemy(enemyId)?.weak ?? 0, this.flock.block)),
      optional: parsed.name === 'discardUpTo',
    };
    if (parsed.name === 'returnDiscard') return {
      kind: 'return',
      filter: parsed.args[0] || 'nonMolt',
      drawAfter: Math.max(0, parseEffectValue(parsed.args[1], state.previousDiscarded, this.getLivingEnemy(enemyId)?.weak ?? 0, this.flock.block)),
    };
    return undefined;
  }

  private resolveCardEffectSequenceInteractive(
    effects: string[],
    card: Card,
    enemyId: string,
    state: EffectResolutionState,
    source: string,
    excludedInstanceId: string | undefined,
    onComplete: () => void,
  ) {
    if (!this.discardChoiceModule) {
      effects.forEach((effect) => this.resolveCardEffect(effect, card, enemyId, state));
      onComplete();
      return;
    }
    this.discardChoiceModule.runInterruptibleSequence({
      items: effects,
      detect: (effect) => this.interactiveCardChoiceEffect(effect, card, enemyId, state),
      apply: (effect) => this.resolveCardEffect(effect, card, enemyId, state),
      choose: (decision, resume) => {
        if (decision.kind === 'discard') this.beginDiscardChoice(source, decision.amount, decision.optional, resume, excludedInstanceId);
        else this.beginReturnChoice(source, decision.filter, decision.drawAfter, resume);
      },
      onResolved: (decision, count) => {
        if (decision.kind === 'discard') state.previousDiscarded = count;
      },
      onComplete,
    });
  }

  resolveHeldSnagEffects() {
    const heldSnags = this.hand.filter((card) => isSnagCard(card) && card.runtime.heldEffects?.length);
    for (const card of heldSnags) {
      const state = createCardEffectResolutionState();
      this.logEvent(`${displayName(card)} catches at Roost.`);
      this.presentFlockStatus('Snag!', '#ff6b57', 'snag');
      for (const effect of card.runtime.heldEffects ?? []) {
        this.resolveCardEffect(effect, card, '', state);
      }
      if (state.returnSelfToDraw) {
        this.hand = this.hand.filter((candidate) => candidate.instanceId !== card.instanceId);
        this.addCardToDrawRandom(card);
      }
    }
  }

  private cardEffectContext(): CardEffectContext<Card, Enemy> {
    return {
      flock: this.flock,
      cardName: (card) => displayName(card),
      checkCondition: (condition, card, enemyId, state) => this.checkCardCondition(condition, card, enemyId, state),
      logEvent: (message) => this.logEvent(message),
      logFizzle: (card, effectText) => this.logEvent(`${displayName(card)} fizzles: ${effectText}`),
      getTargetWinded: (enemyId) => this.getLivingEnemy(enemyId)?.weak ?? 0,
      getLivingEnemy: (enemyId) => this.getLivingEnemy(enemyId),
      getEnemy: (enemyId) => this.getEnemy(enemyId),
      livingEnemies: () => this.enemies.filter((enemy) => enemy.hp > 0),
      firstLivingEnemy: () => this.enemies.find((enemy) => enemy.hp > 0),
      damageEnemy: (enemyId, amount, source, card, pierceCover = false, flockDamageBonus = 0) =>
        this.damageEnemy(enemyId, amount, source, card, pierceCover, flockDamageBonus),
      gainBlock: (amount, source, card) => this.gainBlock(amount, source, card),
      buildFlow: (state) => this.buildFlow(state),
      spendFlockDamageBonus: (state, area = false) => this.spendFlockDamageBonus(state, area),
      applyOpenSky: (source, value) => {
        this.enterOpenSky(value, `${source} leaves the flock in Open Sky.`);
      },
      loseFlockCover: (source, value) => {
        const removed = Math.min(this.flock.block, value);
        this.flock.block = Math.max(0, this.flock.block - removed);
        this.logEvent(`${source} shakes loose ${removed} Cover.`);
        this.presentFlockResult(-removed, ' Cover', '#8df4ff', source);
        this.coverImpactFx(FLOCK_FX_X, FLOCK_FX_Y, 0x8df4ff);
      },
      damageFlock: (source, value) => {
        const damage = Math.max(0, value);
        const hpBefore = this.flock.hp;
        this.flock.hp = Math.max(0, this.flock.hp - damage);
        this.statTaken += hpBefore - this.flock.hp;
        if (damage > 0) this.flock.flow = 0;
        this.logEvent(`${source} hurts the flock for ${damage}.`);
        if (damage > 0) {
          this.queueFlockMotion('hit', damage);
          this.presentFlockResult(damage, ' damage', '#ff7a6e', source);
          this.combatImpactFlash(FLOCK_FX_X, FLOCK_FX_Y + 18, 0xff9d6b, -1, damage >= 8);
          this.sparkBurst(FLOCK_FX_X, FLOCK_FX_Y + 32, 0xff9d6b, 16, 155);
          if (currentScreenShakeState().enabled) shakeCamera(this, 0.004);
        }
      },
      healFlock: (value, source, overflowToCover = false) => this.healFlock(value, source, overflowToCover),
      loseCohesion: (source, value) => {
        this.flock.hp = Math.max(1, this.flock.hp - value);
        this.logEvent(`${source} spends ${value} Cohesion.`);
        this.presentFlockResult(-value, ' Cohesion', '#ff7a6e', source);
      },
      drawCards: (value) => this.drawCards(value),
      discardCards: (value) => this.discardCards(value),
      gainWingbeat: (source, value) => {
        this.energy += value;
        this.observeCardEffect('wingbeats', value);
        this.logEvent(`${source} gains ${value} Wingbeat.`);
        this.wingbeatGainFx(value);
      },
      loseWingbeat: (source, value) => {
        this.energy = Math.max(0, this.energy - value);
        this.logEvent(`${source} drains ${value} Wingbeat.`);
        this.wingbeatDrainFx(value);
      },
      gainResonance: (value) => this.gainResonance(value),
      spendResonance: (value) => this.spendResonance(value),
      getResonance: () => this.spark,
      setResonance: (value) => { this.observeCardEffect(value < this.spark ? 'spent' : 'resonance', Math.abs(value - this.spark)); this.spark = value; },
      checkResonanceSpentMarks: () => this.checkResonanceSpentMarks(),
      resonanceBurstFx: (enemyId) => {
        const rbView = this.enemyView(this.getEnemy(enemyId));
        this.presentEnemyStatus(this.getEnemy(enemyId), 'Resonance!', '#8df4ff');
        this.sparkBurst(rbView.x, rbView.y - 22, 0x8df4ff, 30, 210);
      },
      windedBurstFx: (enemy) => {
        const wbView = this.enemyView(enemy);
        this.presentEnemyStatus(enemy, 'Winded Burst', '#c98bff');
        this.sparkBurst(wbView.x, wbView.y - 22, 0xc98bff, 24, 190);
      },
      moltBonus: (state, effectValue, area) => spendMoltPower(state, effectValue, area, (amount) => {
          this.combatMoltPowerBursts += 1;
          birdAudio.play('moltPower', Math.min(1.3, 0.76 + amount * 0.08));
          this.logEvent(`Molt Power adds +${amount}.`);
          // Use the stable upper-center callout lane: Flock-centered card,
          // stance, and suit-rally effects can all overlap during this spend.
          floatingText(this, this.fxLayer, GAME_WIDTH / 2 - 30, 142, `MOLT POWER +${amount}`, '#ffb36b', {
            name: 'combat-molt-power',
            holdMs: 680,
          });
          this.sparkBurst(GAME_WIDTH / 2 - 30, 166, 0xff9d4d, 14, 128);
        }),
      applyFlockWinded: (source, value) => {
        this.flock.weak += value;
        this.logEvent(`${source} leaves the flock Winded.`);
        this.presentFlockStatus('Winded', '#c98bff', source);
        this.windedFx(FLOCK_FX_X, FLOCK_FX_Y);
      },
      applyEnemyWinded: (enemy) => {
        const awView = this.enemyView(enemy);
        this.presentEnemyStatus(enemy, 'Winded', '#c98bff');
        this.windedFx(awView.x, awView.y);
        this.triggerTalonPinnedOpening(enemy);
      },
      removeEnemyCover: (source, enemy, value) => {
        const hadCover = enemy.block > 0;
        const removed = Math.min(enemy.block, value);
        enemy.block -= removed;
        this.logEvent(`${source} strips ${removed} Cover from ${enemy.name}.`);
        const rcView = this.enemyView(enemy);
        if (removed > 0) {
          const y = rcView.y + (enemy.runtime.type === 'boss' ? 56 : 48) * rcView.scale;
          birdAudio.play('coverBreak', Math.min(1.4, 0.82 + removed * 0.07));
          this.combatCoverShatter(rcView.x, y, Phaser.Math.Clamp(0.9 + removed * 0.04, 0.96, 1.18));
          this.fxGlowPulse(rcView.x, y, 0x8df4ff, 82, 340, 0.16);
          this.fxMoteBurst(rcView.x, y + 6, 0xffcf7a, {
            count: Phaser.Math.Clamp(9 + removed * 2, 10, 22),
            speed: 120,
            lifespan: 340,
            scale: 0.46,
            gravityY: 0,
            spreadX: 18,
            spreadY: 10,
          });
          this.presentEnemyStatus(enemy, `-${removed} Cover`, '#8df4ff');
        }
        if (hadCover && enemy.block <= 0) this.checkEnemyCoverBrokenMarks();
      },
      enterMolt: (source) => this.enterMolt(source),
      gainOpenSkyGuard: (value) => {
        this.gainOpenSkyGuard(value);
      },
      returnDiscardToHand: (filter, drawAfter) => this.returnDiscardToHand(filter, drawAfter),
      addNextCoverBonus: (value) => {
        this.pendingNestCoverBonus += value;
        this.logEvent(`Next Nest Cover gains +${value}.`);
        this.bankNextTurnFx(value, `+${value} next Cover`, '#c9a6ff', 0xc9a6ff);
      },
      retainHand: (source, value) => {
        this.retainCards(value, source);
      },
      addNextTurnDraw: (value) => {
        this.nextTurnDrawBonus += value;
        this.logEvent(value >= 0
          ? `Next turn draw gains +${value}.`
          : `Next turn draw loses ${Math.abs(value)}.`);
        this.bankNextTurnFx(value, value >= 0 ? `+${value} next draw` : `${value} next draw`, value >= 0 ? '#f7d889' : '#ff9d6b', value >= 0 ? 0xf7d889 : 0xff9d6b);
      },
      addNextTurnEnergy: (source, value) => {
        this.nextTurnEnergyBonus += value;
        this.logEvent(`${source} banks +${value} Wingbeat for next turn.`);
        this.bankNextTurnFx(value, `+${value} next Wingbeat`, '#dffbff', 0x8df4ff);
      },
      addEnemyNextAttackBonus: (source, enemy, value) => {
        enemy.nextAttackBonus += value;
        this.logEvent(`${source} gives ${enemy.name} +${value} next damage.`);
        this.enemyThreatChargeFx(enemy, value);
      },
      giveEnemyCover: (enemy, value, source, verb) => this.giveEnemyCover(enemy, value, source, verb),
      shuffleSelfToDraw: (source) => this.logEvent(`${source} tangles back into the draw pile.`)
    };
  }

  private resolveCardEffect(
    effectText: string,
    card: Card,
    enemyId: string,
    state: EffectResolutionState
  ) {
    resolveCardEffectRule(effectText, card, enemyId, state, this.cardEffectContext());
    return;
  }


  private checkCardCondition(
    condition: string,
    card: Card,
    enemyId: string,
    state: EffectResolutionState
  ) {
    const enemy = this.getLivingEnemy(enemyId);
    if (condition === 'firstPlayedThisCombat') return !this.playedCardIdsThisCombat.has(card.id);
    if (!enemy && condition.startsWith('target')) return false;
    if (!enemy && condition.startsWith('windedAtLeast')) return false;
    if (condition === 'fullyBlocksNextAttack') return this.flock.block >= this.incomingNextAttackDamage();
    if (condition === 'noCover') return this.flock.block <= 0;
    if (condition === 'targetBelowHalf') return enemy ? enemy.hp <= enemy.maxHp / 2 : false;
    if (condition === 'targetIntendsAttack') return enemy ? moveDealsDamage(currentMove(enemy)) : false;
    if (condition === 'targetHasCover') return enemy ? enemy.block > 0 : false;
    if (condition === 'targetWinded') return enemy ? enemy.weak > 0 : false;
    const windedAtLeast = condition.match(/^windedAtLeast\((\d+)\)$/);
    if (windedAtLeast) return enemy ? enemy.weak >= Number(windedAtLeast[1]) : false; // rewards stacking Winded
    if (condition === 'hasResonance') return this.spark > 0;
    if (condition === 'noResonance') return this.spark <= 0 && !state.spentResonance;
    if (condition === 'spentResonance') return state.spentResonance;
    const resAtLeast = condition.match(/^resonanceAtLeast\((\d+)\)$/);
    if (resAtLeast) return this.spark >= Number(resAtLeast[1]); // hoard payoff (doesn't consume)
    if (condition === 'isMolting') return this.flock.molt;
    if (condition === 'openSky') return this.flock.exposed;
    if (condition === 'fullCohesion') return this.flock.hp >= this.flock.maxHp;
    if (condition === 'cohesionBelowHalf') return this.flock.hp < this.flock.maxHp / 2;
    if (condition === 'defeatsEnemy') return state.previousDamageDefeated;
    const suitMatch = condition.match(/^playedSuitThisTurn\(([^)]+)\)$/);
    if (suitMatch) return this.playedSuitsThisTurn.has(suitMatch[1]);
    // flockSuit(suit,count): the flock currently holds >= count cards of a suit.
    const flockSuit = condition.match(/^flockSuit\(([a-z]+),\s*(\d+)\)$/);
    if (flockSuit) return (this.flockSuitCounts()[flockSuit[1]] ?? 0) >= Number(flockSuit[2]);
    return false;
  }

  // --- Flock composition keystones ------------------------------------------
  // The flock's SUIT MAKEUP is a live combat input: count cards by suit across
  // the whole deck (stable within a fight), and when a suit crosses KEYSTONE_AT
  // its keystone aura switches on (drives draw/cover-carry/first-strike/regen).
  private flockSuitCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const card of this.allDeckCards()) {
      const suit = card.runtime.suit;
      if (suit) counts[suit] = (counts[suit] ?? 0) + 1;
    }
    return counts;
  }

  private keystoneActive(suit: string): boolean {
    return (this.flockSuitCounts()[suit] ?? 0) >= KEYSTONE_AT;
  }

  private leaderSignatureKey(suffix: string) {
    return `${this.runLeaderId ?? defaultLeaderId}:${suffix}`;
  }

  private leaderSignatureAvailable(leaderId: string, suffix: string) {
    return this.runLeaderId === leaderId && !this.leaderSignatureUsed.has(this.leaderSignatureKey(suffix));
  }

  private markLeaderSignature(suffix: string) {
    this.leaderSignatureUsed.add(this.leaderSignatureKey(suffix));
  }

  private leaderSignatureLabel() {
    const leader = getLeader(this.runLeaderId);
    return `${leader.signatureName}: ${leader.signatureText}`;
  }

  private triggerFledglingSuitRally(card: Card) {
    const suit = card.runtime.suit;
    if (this.runLeaderId !== 'fledgling' || !suit || this.fledglingSuitRallies.has(suit)) return;
    this.fledglingSuitRallies.add(suit);
    const before = this.flock.flow;
    if (this.flock.flow < this.flock.flowMax) this.flock.flow += 1;
    this.logEvent(`Four-Suit Rally: ${suit} adds +1 Flow.`);
    this.combatFourSuitRally(FLOCK_FX_X + 58, FLOCK_FX_Y - 78, 1);
    this.observeCardEffect('flow', this.flock.flow - before);
    this.flowGainFx(this.flock.flow - before, '#ffe1a3');
  }

  private resolveHeldSnagEffectsInteractive(onComplete: () => void) {
    const heldSnags = this.hand.filter((card) => isSnagCard(card) && card.runtime.heldEffects?.length);
    if (this.discardChoiceModule) this.discardChoiceModule.resolveHeldDiscardCards(this, heldSnags, onComplete);
    else {
      this.resolveHeldSnagEffects();
      onComplete();
    }
  }

  createDiscardEffectState() { return createCardEffectResolutionState(); }

  presentHeldDiscardCard(card: Card) {
    this.logEvent(`${displayName(card)} catches at Roost.`);
    this.presentFlockStatus('Snag!', '#ff6b57', 'snag');
  }

  private triggerTalonPinnedOpening(enemy: Enemy) {
    if (!this.leaderSignatureAvailable('talon', 'firstWinded')) return;
    this.markLeaderSignature('firstWinded');
    const damage = Math.min(2, enemy.hp);
    enemy.hp = Math.max(0, enemy.hp - damage);
    this.observeCardEffect('damage', damage);
    this.statDealt += damage;
    this.logEvent(`Pinned Opening hits ${enemy.name} for ${damage}.`);
    const view = this.enemyView(enemy);
    birdAudio.play('heavyAttack', 0.72);
    this.combatPinnedOpeningStrike(view.x, view.y - 26, Phaser.Math.Clamp(0.9 + damage * 0.06, 0.96, 1.12));
    this.combatImpactFlash(view.x, view.y - 24, 0x8df4ff, 1, false);
    this.presentNumberFeedback(view.x, view.y, '#ffce6b', {
      target: enemy.id, kind: 'damage', source: 'Pinned Opening', amount: damage,
      suffix: ' damage', reducedMotion: prefersReducedMotion(),
    });
    if (enemy.hp <= 0) {
      this.statDefeated += 1;
      this.normalizeSelectedEnemy();
    }
  }

  private triggerRoostkeeperPerfectBrace(blocked: number, damage: number) {
    if (!this.leaderSignatureAvailable('roostkeeper', 'perfectBrace') || blocked <= 0 || damage > 0) return;
    this.markLeaderSignature('perfectBrace');
    const flowBefore = this.flock.flow;
    if (this.flock.flow < this.flock.flowMax) this.flock.flow += 1;
    const counterDamage = 3;
    this.combatPerfectBraceRiposte(FLOCK_FX_X + 235, FLOCK_FX_Y - 22, 1);
    this.enemies
      .filter((enemy) => enemy.hp > 0)
      .forEach((enemy) => this.damageEnemy(enemy.id, counterDamage, 'Perfect Brace'));
    this.logEvent('Perfect Brace: +1 Flow and a counterstrike.');
    this.observeCardEffect('flow', this.flock.flow - flowBefore);
    this.flowGainFx(this.flock.flow - flowBefore, '#8fd6a0');
  }

  // --- Formation state (Scatter / Hold / Surge) ------------------------------
  private flockState(): FlockState {
    return flockStateOf(this.flock);
  }

  // Press the attack: build Flow toward Surge, capped, at most once per card.
  private buildFlow(state: EffectResolutionState) {
    if (state.builtFlow) return;
    state.builtFlow = true;
    const before = this.flock.flow;
    if (this.flock.flow < this.flock.flowMax) this.flock.flow += 1;
    this.observeCardEffect('flow', this.flock.flow - before);
    this.flowGainFx(this.flock.flow - before);
  }

  private scaledFlockStatBonus(kind: 'damage' | 'cover', area = false) {
    const raw = this.flockStats()[kind] ?? 0;
    const travel = kind === 'damage' && this.flyway.relic === 'light-travel' && this.flightCombat.lightTravelReady ? 2 : 0;
    const softened = Math.ceil(raw * (area ? 0.4 : 0.65));
    return (raw > 0 ? Math.max(1, softened) : 0) + travel;
  }

  private spendFlockDamageBonus(state: EffectResolutionState, area = false) {
    if (state.flockDamageBonusUsed) return 0;
    state.flockDamageBonusUsed = true;
    return this.scaledFlockStatBonus('damage', area);
  }

  // Fire a one-shot banner when the formation state changes, and run the
  // Regroup recovery beat when the flock climbs back out of Scatter.
  private updateFormationFx() {
    if (this.mode !== 'battle') return;
    const now = this.flockState();
    if (now === this.lastFlockState) return;
    const prev = this.lastFlockState;
    this.lastFlockState = now;
    birdAudio.play('flock.formation', { state: now });
    if (now === 'surging') {
      this.statSurgesTriggered += 1;
      birdAudio.play('formation', 1.08);
      this.combatFormationShift(now, FLOCK_FX_X + 112, FLOCK_FX_Y - 92, 1);
      banner(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 64, 'Surge!', '#8df4ff', { fontFamily: TOKEN_DISPLAY_FONT });
      burst(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y, 0x8df4ff, 12);
    } else if (now === 'scattered') {
      birdAudio.play('formation', 0.88);
      this.combatFormationShift(now, FLOCK_FX_X + 106, FLOCK_FX_Y - 70, 0.96);
      banner(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 64, 'Scattered!', '#ff7a6e', { fontFamily: TOKEN_DISPLAY_FONT });
    } else if (prev === 'scattered') {
      birdAudio.play('formation', 0.98);
      this.combatFormationShift(now, FLOCK_FX_X + 106, FLOCK_FX_Y - 82, 0.94);
      this.regroupRecovery(); // Scattered Ã¢â€ â€™ Holding/Surging: the flock pulls back together
    }
  }

  private regroupRecovery() {
    banner(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y - 64, 'Regroup!', '#8fd6a0', { fontFamily: TOKEN_DISPLAY_FONT });
    this.healFlock(4, 'Regroup');
  }

  private observeCardEffect(key: ContributionKey, amount: number) {
    if (this.resolvingCard) recordContribution(this.cardContributions, this.resolvingCard.id, key, amount);
  }

  private damageEnemy(enemyId: string, amount: number, source: string, card?: Card, pierceCover = false, flockDamageBonus = 0) {
    const enemy = this.getLivingEnemy(enemyId);
    if (!enemy) return false;
    const hpBefore = enemy.hp;
    if (card && enemy.weak > 0 && amount > 0) {
      chargeCall(this.flightCombat, this.runLeaderId ?? 'fledgling', 'winded');
      this.flyway.windedHits=(this.flyway.windedHits??0)+1;
    }
    const outcome = cardDamageOutcome(
      amount,
      this.flock,
      enemy.block,
      pierceCover,
      flockDamageBonus,
      this.firstAttackThisTurn && this.keystoneActive('quills')
    );
    this.firstAttackThisTurn = false;
    const hadCover = enemy.block > 0;
    const blocked = outcome.blocked;
    let damage = outcome.hpDamage;
    if (!pierceCover) {
      enemy.block -= blocked;
    }
    if (hadCover && enemy.block <= 0) this.checkEnemyCoverBrokenMarks();
    enemy.hp = Math.max(0, enemy.hp - damage);
    this.observeCardEffect('damage', hpBefore - enemy.hp);
    if (enemy.hp <= 0 && !this.enemyDefeatedTurns.has(enemy.id)) this.enemyDefeatedTurns.set(enemy.id, this.turn);
    enemy.hitThisTurn = true;
    this.statDealt += damage;
    if (enemy.hp <= 0) this.statDefeated += 1;
    this.logEvent(`${source} hits ${enemy.name} for ${damage}${pierceCover ? ' through Cover' : ''}.`);
    const view = this.enemyView(enemy);
    const bar = this.enemyHpBar(enemy);
    const meta = suitFxMeta(card?.runtime.suit);
    if (damage > 0) {
      birdAudio.play('hit.impact', { damage, maxHp: enemy.maxHp, lethal: enemy.hp <= 0, coverBroke: hadCover && enemy.block <= 0 });
      birdAudio.play(damage >= 8 ? 'heavyAttack' : 'attack', damage >= 8 ? 1.2 : 0.9);
      birdAudio.play('hitConfirm', damage >= 8 ? 1.1 : 0.9);
      this.queueEnemyMotion(enemy.id, 'hit', damage);
      strike(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y, view.x, view.y, meta.color);
      this.combatPlayerHitConfirm(view.x, view.y - 18, meta.color, damage >= 8);
      this.presentNumberFeedback(view.x, view.y - 40, meta.hex, {
        target: enemy.id, kind: 'damage', source, amount: damage, suffix: ' damage', reducedMotion: prefersReducedMotion(),
      });
      this.fxMoteBurst(view.x, view.y - 18, meta.color, {
        count: damage >= 8 ? 8 : 4, speed: damage >= 8 ? 95 : 65,
        lifespan: 240, scale: 0.3,
      });
      if (damage >= 8 && currentScreenShakeState().enabled) shakeCamera(this, 0.004);
      if (enemy.hp > 0) {
        // Drain the lost segment of the enemy HP bar.
        const left = bar.x - bar.w / 2;
        const xNew = left + bar.w * Math.max(0, enemy.hp / enemy.maxHp);
        const xOld = left + bar.w * Math.min(1, (enemy.hp + damage) / enemy.maxHp);
        fadeRect(this, this.fxLayer, (xNew + xOld) / 2, bar.y, xOld - xNew, bar.h - 6, 0xffd0c9);
      }
    } else {
      birdAudio.play(hadCover || blocked > 0 ? 'coverBlock' : 'block', 0.84);
      this.presentNumberFeedback(view.x, view.y - 40, '#9fb1c4', {
        target: enemy.id, kind: 'blocked', source, amount: 0, suffix: '', label: 'Blocked', reducedMotion: prefersReducedMotion(),
      });
      if (hadCover || blocked > 0) {
        const blockScale = Phaser.Math.Clamp(0.88 + blocked * 0.025, 0.92, 1.16);
        this.combatEnemyCoverBlock(view.x, view.y - 18, blockScale);
      }
      this.coverImpactFx(view.x, view.y, 0x9fb1c4);
    }
    this.triggerBossPhaseTwo(enemy, hpBefore, view);
    if (enemy.hp <= 0) {
      birdAudio.play('reward', 0.8);
      if (enemy.runtime.type === 'boss' || enemy.runtime.type === 'elite') {
        this.combatBossPhaseBreak(view.x, view.y - 24, enemy.runtime.type === 'boss' ? 1.08 : 0.92);
      }
      this.combatDefeatBurst(view.x, view.y - 12);
      this.normalizeSelectedEnemy();
    }
    return enemy.hp <= 0;
  }

  private triggerBossPhaseTwo(enemy: Enemy, hpBefore: number, view: { x: number; y: number }) {
    if (enemy.runtime.type !== 'boss'
      || enemy.phase !== 1
      || !enemy.runtime.phaseTwoMoveIds?.length
      || hpBefore <= enemy.maxHp / 2
      || enemy.hp <= 0
      || enemy.hp > enemy.maxHp / 2) return;
    const lostCover = enemy.block;
    const lostForce = enemy.nextAttackBonus;
    enemy.phase = 2;
    enemy.intentIndex = 0;
    enemy.block = 0;
    enemy.nextAttackBonus = 0;
    this.events.emit('flyway-phase', enemy.id);
    const phaseName = enemy.runtime.phaseTwoName ?? 'Final Pattern';
    const nextMove = currentMove(enemy);
    const reset = lostCover > 0 || lostForce > 0
      ? ` Its Cover (${lostCover}) and stored force (+${lostForce}) break.`
      : '';
    this.logEvent(`${enemy.name} enters Phase II: ${phaseName}.${reset} Next Tell: ${nextMove.label}.`);
    birdAudio.play('formation', 1.12);
    this.combatBossPhaseBreak(view.x, view.y - 24, 1.08);
    this.presentEnemyStatus(enemy, 'PHASE II', '#ffcf7a');
  }

  private gainBlock(amount: number, source: string, card?: Card) {
    const nestBonus = card?.runtime.suit === 'nests' ? this.pendingNestCoverBonus : 0;
    const block = flywayCoverGain(this.flyway, cardCoverOutcome(amount, this.flock, this.scaledFlockStatBonus('cover'), nestBonus));
    if (nestBonus > 0) {
      this.pendingNestCoverBonus = 0;
    }
    this.flock.block += block;
    this.observeCardEffect('cover', block);
    this.logEvent(`${source} gives ${block} Cover.`);
    if (block > 0) {
      birdAudio.play('cover', Math.min(1.35, 0.7 + block / 12));
      this.queueFlockMotion('brace');
      this.presentNumberFeedback(FLOCK_FX_X, FLOCK_FX_Y, '#7ab8d6', {
        target: 'flock', kind: 'cover', source, amount: block, suffix: ' Cover', reducedMotion: prefersReducedMotion(),
      });
      this.coverBuildFx(card?.runtime.suit);
    }
  }

  // Plain heal restores Cohesion and is WASTED past full (Cover and Heal are
  // distinct axes). `overflowToCover` is opt-in for the one card that converts
  // overheal into Cover - it isn't the default.
  private healFlock(amount: number, source: string, overflowToCover = false) {
    const healing = amount;
    const before = this.flock.hp;
    this.flock.hp = Math.min(this.flock.maxHp, this.flock.hp + healing);
    const healed = this.flock.hp - before;
    this.observeCardEffect('healing', healed);
    chargeCall(this.flightCombat, this.runLeaderId ?? 'fledgling', 'heal', healed);
    if (healed > 0) {
      birdAudio.play('heal', Math.min(1.35, 0.7 + healed / 12));
      this.logEvent(`${source} restores ${healed} Cohesion.`);
      this.queueFlockMotion('heal');
      this.presentNumberFeedback(FLOCK_FX_X, FLOCK_FX_Y, '#8fd6a0', {
        target: 'flock', kind: 'heal', source, amount: healed, suffix: ' healed', reducedMotion: prefersReducedMotion(),
      });
      this.healFx();
      this.checkHealFlockMarks();
    }
    const overheal = healing - healed;
    const signatureOverflow = !overflowToCover
      && overheal > 0
      && this.leaderSignatureAvailable('tidewarden', 'firstOverheal');
    if (signatureOverflow) this.markLeaderSignature('firstOverheal');
    if ((overflowToCover || signatureOverflow) && overheal > 0) {
      const cover = flywayCoverGain(this.flyway, overheal);
      birdAudio.play('cover', Math.min(1.2, 0.7 + overheal / 14));
      this.flock.block += cover;
      this.observeCardEffect('cover', cover);
      this.logEvent(signatureOverflow
        ? `Overflow Shelter turns ${overheal} wasted healing into ${cover} Cover.`
        : `${source} overflows into ${cover} Cover.`);
      this.queueFlockMotion('brace');
      if (signatureOverflow) this.combatOverflowShelter(FLOCK_FX_X + 46, FLOCK_FX_Y - 70, 1);
      this.presentNumberFeedback(FLOCK_FX_X, FLOCK_FX_Y, '#7ab8d6', {
        target: 'flock', kind: 'cover', source: signatureOverflow ? 'Leader: Overflow Shelter' : source,
        amount: cover, suffix: ' Cover', reducedMotion: prefersReducedMotion(),
      });
      this.coverBuildFx('nests');
    }
  }

  private gainResonance(amount: number) {
    const before = this.spark;
    this.spark = Math.min(BASE_RESONANCE_CAP, this.spark + amount);
    const gained = this.spark - before;
    this.observeCardEffect('resonance', gained);
    if (gained <= 0) {
      this.logEvent('Resonance is full.');
      this.presentFlockStatus('Resonance full', '#c8d4dc', 'resonance-full');
      return;
    }
    this.logEvent(`The flock gains ${gained} Resonance.`);
    this.combatResonanceSurge(FLOCK_FX_X + 18, FLOCK_FX_Y - 38, Phaser.Math.Clamp(0.86 + gained * 0.08, 0.92, 1.18));
    this.suitPulseAt(FLOCK_FX_X + 18, FLOCK_FX_Y - 38, 'plumes', `+${gained} Resonance`);
  }

  private spendResonance(amount: number) {
    if (this.spark < amount) {
      this.logEvent(`The flock needs ${amount} Resonance.`);
      return false;
    }
    this.spark -= amount;
    this.observeCardEffect('spent', amount);
    this.flyway.resonanceSpent=(this.flyway.resonanceSpent??0)+Math.max(0,amount);
    chargeCall(this.flightCombat, this.runLeaderId ?? 'fledgling', 'spend', amount);
    this.logEvent(`The flock spends ${amount} Resonance.`);
    this.combatResonanceSpend(FLOCK_FX_X + 18, FLOCK_FX_Y - 38, Phaser.Math.Clamp(0.88 + amount * 0.07, 0.92, 1.16));
    this.sparkBurst(FLOCK_FX_X + 18, FLOCK_FX_Y - 38, 0x8df4ff, Phaser.Math.Clamp(12 + amount * 4, 14, 24), 150);
    if (this.leaderSignatureAvailable('spark_caller', 'firstResonanceSpend')) {
      this.markLeaderSignature('firstResonanceSpend');
      this.drawCards(1);
      this.logEvent('Spark Echo draws 1 card.');
      this.combatSparkEcho(FLOCK_FX_X + 62, FLOCK_FX_Y - 88, 1);
      this.presentFlockStatus('Spark Echo', '#8df4ff', 'spark-echo');
    }
    this.checkResonanceSpentMarks();
    return true;
  }

  private enterMolt(source: string) {
    const wasMolting = this.flock.molt;
    this.flock.molt = true;
    this.flock.exposed = false;
    this.flock.exposedTurns = 0;
    this.logEvent(`${source} turns the flock through Molt.`);
    this.presentFlockStatus('Molt!', '#ff9d4d', 'molt');
    if (!wasMolting) {
      this.flightCombat.molted = true;
      this.flightCombat.moltSurvived = false;
      if (this.flyway.relic === 'storm-pin') { this.energy += 1; this.observeCardEffect('wingbeats', 1); }
      this.events.emit('flyway-molt', true);
      this.combatMoltShift(FLOCK_FX_X, FLOCK_FX_Y - 22, 1);
      this.sparkBurst(FLOCK_FX_X, FLOCK_FX_Y - 12, 0xff9d4d, 20, 160);
    }
    burst(this, this.fxLayer, FLOCK_FX_X, FLOCK_FX_Y, 0xff9d4d, 10);
    if (!wasMolting) this.checkEnterMoltMarks();
  }

  private endTurnAnimated() {
    this.queueOutcomeCombatFxAssetLoad();
    this.endTurn({ enemyPacing: true });
  }

  private endTurn(options: EndTurnOptions = {}) {
    if (this.combatInteractionLocked() || this.supplyDrawerOpen || this.waymarkDrawerOpen) return;
    recordFirstFlightGuideEvent('roost');
    birdAudio.play('turn');

    const cardsHeldAtRoost = this.hand.length;
    const wingbeatAtRoost = this.energy;
    const cardsPlayedAtRoost = this.cardsPlayedThisTurn;
    const zeroCostCardsPlayedAtRoost = this.zeroCostThisTurn;
    this.roostCards = cardsPlayedAtRoost;
    this.roostFree = zeroCostCardsPlayedAtRoost;
    this.roostHeld = cardsHeldAtRoost;
    this.statTurnEnds += 1;
    this.statCardsHeldAtRoost += cardsHeldAtRoost;
    this.statUnspentWingbeatAtRoost += wingbeatAtRoost;
    if (cardsPlayedAtRoost > 0 && cardsPlayedAtRoost <= 2) this.statLowCardTurns += 1;
    if (cardsPlayedAtRoost > 0 && cardsPlayedAtRoost < (this.flyway.condition === 'scaffold' ? 3 : OVEREXTENSION_CARD_THRESHOLD)) this.statNoOverextensionTurns += 1;

    this.roostRetainPriorityInstanceId = this.selectedInstanceId
      && this.hand.some((card) => card.instanceId === this.selectedInstanceId)
      ? this.selectedInstanceId
      : undefined;
    this.resolveHeldSnagEffectsInteractive(() => this.finishEndTurnAfterHeldSnags(cardsHeldAtRoost, wingbeatAtRoost, cardsPlayedAtRoost, options));
  }

  private finishEndTurnAfterHeldSnags(
    cardsHeldAtRoost: number,
    wingbeatAtRoost: number,
    cardsPlayedAtRoost: number,
    options: EndTurnOptions,
  ) {
    this.checkRoostRestraintMarks(cardsHeldAtRoost, wingbeatAtRoost, cardsPlayedAtRoost);

    const retained = retainedInOriginalOrder(
      this.hand,
      this.pendingRetainHand,
      this.roostRetainPriorityInstanceId,
    );
    const retainedIds = new Set(retained.map((card) => card.instanceId));
    this.hand = this.hand.filter((card) => !retainedIds.has(card.instanceId));
    this.pendingRetainHand = 0;
    const discardedThisRoost: Card[] = [];
    while (this.hand.length) {
      const card = this.hand.pop();
      if (card) {
        discardedThisRoost.push(card);
        this.discardPile.push(card);
      }
    }
    if (discardedThisRoost.length) this.animateDiscard(discardedThisRoost.length, GAME_WIDTH - 330, HAND_Y - 20, 1);
    this.roostRetainPool = [...discardedThisRoost].reverse();
    if (retained.length) {
      this.hand = retained;
      this.logEvent(`Retained ${retained.length} card${retained.length === 1 ? '' : 's'} for next turn.`);
    }
    this.selectedInstanceId = undefined;
    // Molting is a one-turn transform stance: it ends now, leaving the flock
    // briefly Open Sky (the cost of shedding into Molt) for the enemy's swing.
    if (this.flock.molt) {
      this.flock.molt = false;
      this.enterOpenSky(this.flyway.relic === 'storm-pin' ? 2 : 1, 'The flock sheds out of Molt - Open Sky.');
      this.events.emit('flyway-molt', false);
    }
    this.applyOverextensionPenalty();
    const hpBeforeEnemyTurn = this.flock.hp;

    if (options.enemyPacing && this.combatTimingDelay(ENEMY_ATTACK_WINDUP_MS) > 0) {
      this.combatAnimationPending = true;
      this.setEnemyTurnBeat('preamble', '', this.enemyTurnPreambleDelay());
      this.resolveEnemyTurnAnimated(() => {
        if (this.flock.hp >= hpBeforeEnemyTurn) this.checkNoDamageTurnMarks();
        this.checkOutcome();
        finishPracticeTurn(this);
        this.setEnemyTurnBeat('idle');
        if (this.mode !== 'battle') {
          this.combatAnimationPending = false;
          this.renderAll();
          return;
        }
        this.startPlayerTurn({
          announceDelayMs: combatPacePreference() === 'cinematic' ? 900 : PLAYER_TURN_HANDOFF_DELAY_MS,
          onReady: () => {
            if (!this.sys.settings.active || this.mode !== 'battle') return;
            this.combatAnimationPending = false;
            this.renderAll();
          }
        });
        // Hold the resolved enemy frame through the handoff. The onReady pass
        // reveals the replenished hand and unlocks input together, avoiding a
        // duplicate full-board build before the player can act.
      });
      return;
    }

    this.resolveEnemyTurn();
    if (this.flock.hp >= hpBeforeEnemyTurn) this.checkNoDamageTurnMarks();
    this.checkOutcome();
    finishPracticeTurn(this);
    if (this.mode === 'battle') this.startPlayerTurn();
    this.renderAll();
  }

  private startPlayerTurn(options: StartPlayerTurnOptions = {}) {
    // Enemy-turn presentation is intentionally generous, but none of it should
    // compete with the next hand. Retire the resolved phase as one unit before
    // the player-turn rally enters.
    killTweensForTree(this, this.fxLayer);
    this.fxLayer.removeAll(true);
    this.activeGeneratedFxSprites = 0;
    this.activeFxParticleBursts = 0;
    this.turn += 1;
    this.energy = Math.max(0, 3 + this.nextTurnEnergyBonus);
    this.nextTurnEnergyBonus = 0;
    // Nests keystone: Cover carries between turns (capped) instead of fully clearing.
    this.flock.block = Math.min(this.flock.block, this.flyway.relic === 'woven-roost' ? 8 : this.keystoneActive('nests') ? NESTS_COVER_CARRY_CAP : 0);
    this.flightCombat.previousSuit = undefined;
    this.flightCombat.combos = [];
    this.cardsPlayedThisTurn = 0;
    this.zeroCostThisTurn = 0;
    this.markFiredThisTurn = new Set();
    this.firstAttackThisTurn = true;
    this.playedSuitsThisTurn = new Set();
    if (this.flock.frail > 0) this.flock.frail -= 1;
    if (this.flock.weak > 0) this.flock.weak -= 1;
    this.tickFouled();
    if (this.mode !== 'battle') return;
    if ((this.flockStats().regen ?? 0) > 0) this.healFlock(this.flockStats().regen ?? 0, 'Regen');
    // Basins keystone: the flock mends a little each turn.
    if (this.keystoneActive('basins')) this.healFlock(2, 'Tidewatch');

    for (const enemy of this.enemies) {
      enemy.hitThisTurn = false;
      if (enemy.weak > 0) enemy.weak -= 1;
    }

    this.drawToHandSize();
    this.roostRetainPool = [];
    this.roostRetainPriorityInstanceId = undefined;
    if ((this.flockStats().resonance ?? 0) > 0) this.gainResonance(this.flockStats().resonance ?? 0);
    this.logEvent(`Turn ${this.turn} starts.`);
    captureTurn(this);
    const announceDelayMs = options.announceDelayMs ?? 0;
    if (announceDelayMs <= 0) {
      options.onReady?.();
      return;
    }
    // Use the resolved-enemy handoff for the ceremony, then retire it before
    // input unlocks so a fast first card cannot stack two major FX beats.
    this.combatPlayerTurnRally();
    this.combatTurnBanner('Your Turn', '#8fd6a0', 0x8fd6a0);
    this.time.delayedCall(announceDelayMs, () => {
      this.retirePlayerTurnTransitionFx();
      options.onReady?.();
    });
  }

  private retirePlayerTurnTransitionFx() {
    // startPlayerTurn begins with an empty FX layer, so everything added before
    // onReady belongs to the protected handoff: rally/banner, draw cards,
    // start-of-turn Resonance/Regen callouts, and their particles. Clear that
    // complete presentation beat before the first actionable frame.
    killTweensForTree(this, this.fxLayer);
    this.fxLayer.removeAll(true);
    this.activeGeneratedFxSprites = 0;
    this.activeFxParticleBursts = 0;
  }

  private retireCombatFxForOutcome() {
    // The outcome reveal intentionally renders above the dimmed battlefield.
    // Retire the resolved combat beat first so its Tell, trail, plaque, impact,
    // and looping tweens cannot sit above the report panel.
    killTweensForTree(this, this.fxLayer);
    this.fxLayer.removeAll(true);
    this.activeGeneratedFxSprites = 0;
    this.activeFxParticleBursts = 0;
    this.playerCardFxBaseline = undefined;
  }

  private applyOverextensionPenalty() {
    if (this.cardsPlayedThisTurn < (this.flyway.condition === 'scaffold' ? 3 : OVEREXTENSION_CARD_THRESHOLD) || this.flock.exposed) return;
    this.statOverextensions += 1;
    this.combatOverextensionWarning(FLOCK_FX_X, FLOCK_FX_Y - 52, 1);
    this.enterOpenSky(1, `${this.cardsPlayedThisTurn} cards overextend the formation - Open Sky.`, 'Overextended!');
  }

  private resolveEnemyTurn() {
    const attackers = this.enemies.filter((candidate) => candidate.hp > 0);
    if (attackers.length === 0) return;

    this.combatTurnBanner('Enemy Turn', '#ff9d6b', 0xff9d6b);
    this.enemies.forEach((enemy) => { enemy.block = 0; });

    // Each living enemy telegraphs and resolves its own move, in board order.
    for (const enemy of attackers) {
      if (enemy.hp <= 0 || this.flock.hp <= 0) continue;
      setEnemyMoveContext(this.enemyContext()); // branch on live state per attacker
      const move = currentMove(enemy);
      for (const effect of move.effects) {
        if (enemy.hp <= 0 || this.flock.hp <= 0) break;
        this.resolveEnemyEffect(enemy, effect, move.label);
      }
      this.runSeenEnemyMoves.add(this.enemyMovePacingKey(enemy, move));
      // Advance the move counter; currentMove() maps it through the attack pattern.
      this.advanceEnemyIntent(enemy);
      if (this.flock.hp <= 0) break;
    }

    // Open Sky ticks down once per enemy phase, after every attacker resolves.
    this.tickOpenSkyAfterEnemyPhase();
    this.queueOptionalCombatFxAssetLoad();
  }

  private resolveEnemyTurnAnimated(onComplete: () => void) {
    if (this.combatFxModule) {
      this.combatFxModule.resolveEnemyTurnAnimated(this, currentMove, moveDealsDamage, onComplete);
      return;
    }
    this.resolveEnemyTurn();
    this.setEnemyTurnBeat('idle');
    onComplete();
  }

  advanceEnemyIntent(enemy: Enemy) {
    enemy.flywayBroken = false;
    const currentNodeId = currentCombatNodes()[this.currentRouteIndex]?.id ?? 'encounter';
    if (advanceAscensionEnemyIntent(
      this.runDifficulty,
      enemy,
      activeSeed,
      activeMapIndex,
      currentNodeId,
      this.turn,
    )) {
      this.logEvent(`${enemy.name} reroutes: ${currentMove(enemy).label} is next.`);
    }
  }

  private tickOpenSkyAfterEnemyPhase() {
    if (this.flightCombat.molted && !this.flightCombat.moltSurvived && this.flock.hp > 0) { this.flyway.survivedMolt += 1; this.flightCombat.moltSurvived = true; }
    if (this.flock.exposed && this.flock.exposedTurns > 0) {
      this.flock.exposedTurns -= 1;
      if (this.flock.exposedTurns <= 0) this.flock.exposed = false;
    }
  }

  private resolveEnemyEffect(enemy: Enemy, effectText: string, moveLabel = currentMove(enemy).label) {
    // Capture the full condition expression (lazily, up to the first " then ")
    // so the `turn >= N` comparison form is honored, not just bare names.
    const conditional = effectText.match(/^if (.+?) then (.+)$/);
    if (conditional) {
      if (!this.checkEnemyCondition(conditional[1], enemy)) return;
      this.resolveEnemyEffect(enemy, conditional[2], moveLabel);
      return;
    }

    const parsed = parseEffect(effectText);
    if (!parsed) return;

    const value = parseEffectValue(parsed.args[1] ?? parsed.args[0], 0);
    switch (parsed.name) {
      case 'damage':
        this.damageFlock(enemy, value, moveLabel);
        break;
      case 'gainCover':
        this.giveEnemyCover(enemy, value, enemy.name, 'guards', enemy.id);
        break;
      case 'heal':
        this.healEnemy(enemy, value, enemy.name, 'scavenges', enemy.id);
        break;
      case 'healAlly':
        this.healEnemy(this.supportTargetEnemy(enemy, parsed.args[0]) ?? enemy, value, enemy.name, 'patches', enemy.id);
        break;
      case 'healAllEnemies':
        for (const target of this.enemies.filter((candidate) => candidate.hp > 0)) {
          this.healEnemy(target, value, enemy.name, 'rallies', enemy.id);
        }
        break;
      case 'gainCoverAlly':
        this.giveEnemyCover(this.supportTargetEnemy(enemy, parsed.args[0]) ?? enemy, value, enemy.name, 'screens', enemy.id);
        break;
      case 'gainCoverAllEnemies':
        for (const target of this.enemies.filter((candidate) => candidate.hp > 0)) {
          this.giveEnemyCover(target, value, enemy.name, 'screens', enemy.id);
        }
        break;
      case 'nextAttackBonusAlly':
        this.boostEnemyAttack(this.supportTargetEnemy(enemy, parsed.args[0]) ?? enemy, value, enemy.name);
        break;
      case 'applyWinded':
        this.flock.weak += value;
        this.logEvent(`${enemy.name} knocks the flock Winded.`);
        this.presentFlockStatus('Winded', '#c98bff', enemy.id);
        this.windedFx(FLOCK_FX_X, FLOCK_FX_Y);
        break;
      case 'loseWingbeat':
        // The enemy phase ends before startPlayerTurn refills Wingbeats, so the
        // tax lands on the NEXT player turn through the next-turn energy bank.
        this.nextTurnEnergyBonus -= value;
        this.logEvent(`${enemy.name} taxes ${value} Wingbeat from the next turn.`);
        this.wingbeatDrainFx(value, ' next Wingbeat');
        break;
      case 'applyFrail':
        this.flock.frail += value;
        this.logEvent(`${enemy.name} ruffles the flock - Cover weakened.`);
        this.presentFlockStatus('Ruffled', '#ff9d6b', enemy.id);
        this.ruffledBreakFx(value);
        break;
      case 'applyOpenSky':
        this.enterOpenSky(value, `${enemy.name} throws the flock into Open Sky.`);
        break;
      case 'applyPoison':
        this.flock.fouled += value;
        this.logEvent(`${enemy.name} fouls the flock for ${value}.`);
        this.presentFlockStatus(`Fouled ${value}`, '#8bd2a0', enemy.id);
        this.fouledPressureFx(value);
        break;
      case 'addSnagToDiscard': {
        const snagId = parsed.args[0];
        if (snagId && cardLibrary[snagId]) {
          if (this.hasCardInDeck(snagId)) {
            this.logEvent(`${enemy.name}'s Snag fails - ${cardLibrary[snagId].runtime.displayName} is already in the deck.`);
            birdAudio.play('block');
            this.presentFlockStatus('Snag blocked', '#7ab8d6', enemy.id);
            break;
          }
          const acquisition = recordRunCardAcquisitions(this.battleRouteCheckpoint, [snagId], 'snag');
          if (acquisition.completedTargets.includes(snagId)) {
            this.logEvent(`Hunt complete! ${cardLibrary[snagId].runtime.displayName} enters the permanent collection.`);
          }
          this.discardPile.push(cloneCard(snagId));
          this.logEvent(`${enemy.name} tangles the route - ${cardLibrary[snagId].runtime.displayName} drops into your discard.`);
          this.animateDiscard(1, this.enemyView(enemy).x, this.enemyView(enemy).y, 0.9);
        }
        break;
      }
      case 'addSnagToDraw': {
        const snagId = parsed.args[0];
        if (snagId && cardLibrary[snagId]) {
          if (this.hasCardInDeck(snagId)) {
            this.logEvent(`${enemy.name}'s Snag fails - ${cardLibrary[snagId].runtime.displayName} is already in the deck.`);
            birdAudio.play('block');
            this.presentFlockStatus('Snag blocked', '#7ab8d6', enemy.id);
            break;
          }
          const acquisition = recordRunCardAcquisitions(this.battleRouteCheckpoint, [snagId], 'snag');
          if (acquisition.completedTargets.includes(snagId)) {
            this.logEvent(`Hunt complete! ${cardLibrary[snagId].runtime.displayName} enters the permanent collection.`);
          }
          const at = Math.floor(this.combatRandom() * (this.drawPile.length + 1));
          this.drawPile.splice(at, 0, cloneCard(snagId));
          this.logEvent(`${enemy.name} fouls your draw with ${cardLibrary[snagId].runtime.displayName}.`);
        }
        break;
      }
      case 'nextAttackBonus':
        enemy.nextAttackBonus += value;
        this.logEvent(`${enemy.name} lines up +${value} damage.`);
        this.enemyThreatChargeFx(enemy, value);
        break;
    }
  }

  // The closed enemy/pattern condition set (next-level-data-contracts Â§1.3),
  // delegated to the shared evaluator so per-effect gates and attack-pattern
  // branching stay in lockstep.
  private supportTargetEnemy(source: Enemy, selector = 'lowest'): Enemy | undefined {
    const allies = this.enemies.filter((enemy) => enemy.hp > 0 && enemy.id !== source.id);
    if (allies.length === 0) return undefined;
    switch (selector) {
      case 'highest':
        return [...allies].sort((a, b) => (b.hp / b.maxHp) - (a.hp / a.maxHp))[0];
      case 'front':
        return allies[0];
      case 'random':
        return allies[Math.floor(this.combatRandom() * allies.length)];
      case 'lowest':
      default:
        return [...allies].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    }
  }

  private healEnemy(target: Enemy, amount: number, sourceName: string, verb: string, sourceId = sourceName) {
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    const healed = target.hp - before;
    this.logEvent(`${sourceName} ${verb} ${target.name} for ${healed} health.`);
    if (healed <= 0) return;
    const view = this.enemyView(target);
    const y = view.y + (target.runtime.type === 'boss' ? 48 : 42) * view.scale;
    birdAudio.play('enemyHeal', Math.min(1.25, 0.76 + healed * 0.08));
    this.combatEnemyMend(view.x, y, Phaser.Math.Clamp(0.88 + healed * 0.04, 0.94, 1.18));
    this.presentNumberFeedback(view.x, view.y - 40, '#8fd6a0', {
      target: target.id, kind: 'heal', source: sourceId, amount: healed, suffix: ' healed', reducedMotion: prefersReducedMotion(),
    });
  }

  private giveEnemyCover(target: Enemy, amount: number, sourceName: string, verb: string, sourceId = sourceName) {
    target.block += amount;
    this.logEvent(`${sourceName} ${verb} ${target.name} for ${amount} Cover.`);
    const view = this.enemyView(target);
    const y = view.y + (target.runtime.type === 'boss' ? 50 : 44) * view.scale;
    birdAudio.play('enemyCover', Math.min(1.35, 0.82 + amount * 0.06));
    this.combatEnemyCover(view.x, y, Phaser.Math.Clamp(0.86 + amount * 0.04, 0.92, 1.16));
    this.presentNumberFeedback(view.x, view.y - 40, '#7ab8d6', {
      target: target.id, kind: 'cover', source: sourceId, amount, suffix: ' Cover', reducedMotion: prefersReducedMotion(),
    });
  }

  private boostEnemyAttack(target: Enemy, amount: number, sourceName: string) {
    target.nextAttackBonus += amount;
    this.logEvent(`${sourceName} marks ${target.name} for +${amount} damage.`);
    this.enemyThreatChargeFx(target, amount);
  }

  private tickFouled() {
    if (this.flock.fouled <= 0) return;
    const damage = this.flock.fouled;
    const hpBefore = this.flock.hp;
    this.flock.hp = Math.max(0, this.flock.hp - damage);
    this.flock.fouled = Math.max(0, this.flock.fouled - 1);
    this.statTaken += hpBefore - this.flock.hp;
    if (damage > 0 && this.flock.hp <= 0) this.killedByMove = 'Fouled';
    this.flock.flow = 0;
    this.logEvent(`Fouled pressure costs ${damage} Cohesion.`);
    this.queueFlockMotion('hit', damage);
    this.presentFlockResult(-damage, ' Fouled', '#8bd2a0', 'fouled');
    this.fouledPressureFx(damage, true);
    this.checkOutcome();
  }

  private checkEnemyCondition(condition: string, enemy: Enemy) {
    return evaluateEnemyCondition(condition, enemy, this.enemyContext());
  }

  private enemyContext(): EnemyMoveContext {
    return { flock: this.flock, turn: this.turn, c: this.roostCards, z: this.roostFree, h: this.roostHeld };
  }

  private incomingAttackDamage(enemy: Enemy) {
    return this.enemyDamageProjection(this.enemies, this.flock, false, enemy.id).total;
  }

  private incomingFlockDamagePreview() {
    return this.enemyDamageProjection(this.enemies, this.flock, !this.combatAnimationPending);
  }

  private incomingNextAttackDamage(enemies = this.enemies, flock = this.flock) {
    return this.enemyDamageProjection(enemies, flock, false, undefined, true).total;
  }

  private enemyDamageProjection(enemies: Enemy[], flock: Flock, roost: boolean, onlyEnemyId?: string, stopAfterFirstAttack = false,
    afterCard?: { hand: Card[]; drawn: number; energy: number; played: number; zero: number; firstAttack: boolean }) {
    const hand = afterCard?.hand ?? this.hand;
    const held = hand.length + (afterCard?.drawn ?? 0);
    const played = afterCard?.played ?? this.cardsPlayedThisTurn;
    const context = roost
      ? { turn: this.turn, c: played, z: afterCard?.zero ?? this.zeroCostThisTurn, h: held }
      : this.enemyContext();
    const marks = this.ownedMarkDefs();
    const firstSkyEffects = marks.filter(mark => mark.trigger === 'firstOpenSkyIncrease').flatMap(routeMarkEffects);
    return projectEnemyPhase({
      flock, enemies, mods: difficultyMods(this.runDifficulty),
      coverGain: amount => flywayCoverGain(this.flyway, amount),
      move: (enemy, projectedFlock) => currentMove(enemy, { ...context, flock: projectedFlock }),
      condition: (condition, enemy, projectedFlock) => evaluateEnemyCondition(condition, enemy, { ...context, flock: projectedFlock }),
      firstSkyReduction: this.markFirstOpenSkyConsumed ? 0 : this.markValue('firstOpenSkyIncrease', 'reduceOpenSky'),
      firstSkyEffects, onlyEnemyId, stopAfterFirstAttack,
      counterstrike: {
        available: this.leaderSignatureAvailable('roostkeeper', 'perfectBrace'),
        firstAttackKeystone: (afterCard?.firstAttack ?? this.firstAttackThisTurn) && this.keystoneActive('quills'),
        damage: (amount, projected, enemy, first) => cardDamageOutcome(amount, projected, enemy.block, false, 0, first),
        coverBreakEffects: marks.filter(mark => mark.trigger === 'onEnemyCoverBroken' && !this.markFiredThisTurn.has(mark.id)).map(routeMarkEffects),
      },
      healing: {
        overflowAvailable: this.leaderSignatureAvailable('tidewarden', 'firstOverheal'),
        markEffects: marks.filter(mark => mark.trigger === 'onHealFlock' && !this.markFiredThisTurn.has(mark.id)).map(routeMarkEffects),
      },
      prepare: roost ? (projected, projectedEnemies, unknown, heal) => {
        const apply = (text: string, snag = false): void => {
          const conditional = /^if (.+?) then (.+)$/.exec(text);
          if (conditional) {
            if (conditional[1] === 'noCover') { if (projected.block <= 0) apply(conditional[2], snag); }
            else unknown.add('Snag condition not projected');
            return;
          }
          const effect = parseEffect(text);
          if (!effect) { unknown.add('Roost rule not projected'); return; }
          const value = parseEffectValue(effect.args[1] ?? effect.args[0], 0);
          switch (effect.name) {
            case 'damageFlock': projected.hp = Math.max(0, projected.hp - value); break;
            case 'applyOpenSky': projected.exposed = true; break;
            case 'applyWinded': projected.weak += value; break;
            case 'enemyNextAttackBonus': { const enemy = projectedEnemies.find(enemy => enemy.hp > 0); if (enemy) enemy.nextAttackBonus += value; break; }
            case 'gainCover': projected.block += flywayCoverGain(this.flyway, value); break;
            case 'gainCoverPerWaymark': projected.block += flywayCoverGain(this.flyway, value * this.routeMarks.length); break;
            case 'gainOpenSkyGuard': projected.openSkyGuard += value; break;
            case 'reduceNextOpenSky': projected.openSkyReduction += value; break;
            case 'heal': heal(value); break;
            case 'cleanseFlock':
              cleanseFlockDebuffs(projected, value);
              break;
            // Roost counters were captured before Snags; these do not change
            // enemy-phase damage. Enemy Cover is cleared at phase entry.
            case 'loseWingbeat': case 'shuffleSelfToDraw': case 'enemyGainCover':
            case 'gainWingbeat': case 'gainEnergyNextTurn': case 'nextTurnDraw':
            case 'gainResonance': case 'gainScrap': case 'retainHand': case 'nextCoverBonus': break;
            default: unknown.add(snag ? 'Snag choice not projected' : 'Roost trigger not projected');
          }
        };
        hand.filter(card => isSnagCard(card)).forEach(card => card.runtime.heldEffects?.forEach(effect => apply(effect, true)));
        marks.filter(mark => !this.markFiredThisCombat.has(mark.id)
          && this.roostRestraintMarkMatches(mark, held, afterCard?.energy ?? this.energy, played))
          .forEach(mark => routeMarkEffects(mark).forEach(effect => apply(effect)));
        if (projected.molt || played >= (this.flyway.condition === 'scaffold' ? 3 : OVEREXTENSION_CARD_THRESHOLD)) projected.exposed = true;
        projected.molt = false;
      } : undefined,
    });
  }

  private damageFlock(enemy: Enemy, amount: number, moveLabel = currentMove(enemy).label) {
    this.queueEnemyMotion(enemy.id, 'attack');
    const mods = difficultyMods(this.runDifficulty);
    const hit = incomingHit(amount, enemy, this.flock, mods,
      this.markFirstOpenSkyConsumed ? 0 : this.markValue('firstOpenSkyIncrease', 'reduceOpenSky'));
    let damage = hit.damage;
    enemy.nextAttackBonus = 0;
    if (this.flock.exposed) {
      const guarded = this.flock.openSkyGuard > 0;
      if (guarded) {
        this.flock.openSkyGuard -= 1;
        this.logEvent('Open Sky Guard cancels the Open Sky damage increase.');
        this.combatOpenSkyGuard(FLOCK_FX_X - 6, FLOCK_FX_Y - 34, 1.05, true);
        this.sparkBurst(FLOCK_FX_X - 6, FLOCK_FX_Y - 22, 0x8df4ff, 18, 150);
      } else {
        const openSky = hit.skyBonus;
        if (this.flock.openSkyReduction > 0) {
          const reduced = hit.reductionUsed;
          this.flock.openSkyReduction = Math.max(0, this.flock.openSkyReduction - reduced);
          if (reduced > 0) this.logEvent(`Scouting softens Open Sky by ${reduced}.`);
        }
        // quiet_landing Waymark: soften the first Open Sky increase each combat.
        if (!this.markFirstOpenSkyConsumed) {
          const reduce = this.markValue('firstOpenSkyIncrease', 'reduceOpenSky');
          if (reduce > 0) {
            this.markFirstOpenSkyConsumed = true;
            this.logEvent('Quiet Landing softens the open sky.');
            this.applyMarkTrigger('firstOpenSkyIncrease');
          }
        }
        if (openSky > 0) {
          this.combatOpenSkyBreak(FLOCK_FX_X + 6, FLOCK_FX_Y + 4, Phaser.Math.Clamp(0.72 + openSky * 0.04, 0.78, 0.98));
        }
      }
    }
    const blocked = Math.min(this.flock.block, damage);
    this.flock.block -= blocked;
    damage -= blocked;
    const hpBefore = this.flock.hp;
    this.flock.hp = Math.max(0, this.flock.hp - damage);
    const cohesionLost = hpBefore - this.flock.hp;
    if (damage > 0 && this.flock.hp <= 0) this.killedByMove = moveLabel;
    this.statBlocked += blocked;
    if (blocked > 0 && damage === 0) chargeCall(this.flightCombat, this.runLeaderId ?? 'fledgling', 'block');
    this.statTaken += cohesionLost;
    this.events.emit('opening-impact', { blocked, lost: cohesionLost, hp: this.flock.hp, move: moveLabel });
    if (blocked > 0 && damage === 0 && cohesionLost === 0 && blocked > (this.flyway.blockMoment?.blocked ?? 0)) {
      this.flyway.blockMoment = { enemy: enemy.name, move: moveLabel, turn: this.turn, blocked };
    }
    const move = currentMove(enemy);
    const pressureKey = `${enemy.runtime.id}:${move.id}:${moveLabel}`;
    const pressure = this.statDamageTakenByMove.get(pressureKey) ?? {
      enemyId: enemy.runtime.id,
      moveId: move.id,
      moveLabel,
      damageTaken: 0,
      blockedDamage: 0,
      hitCount: 0
    };
    pressure.damageTaken += cohesionLost;
    pressure.blockedDamage += blocked;
    pressure.hitCount += 1;
    this.statDamageTakenByMove.set(pressureKey, pressure);
    this.logEvent(damage > 0
      ? `${enemy.name} hits the flock for ${damage}. ${moveLabel}: Cover absorbed ${blocked}; ${cohesionLost} Cohesion lost.`
      : `${enemy.name}'s hit is blocked. ${moveLabel}: Cover absorbed ${blocked}; no Cohesion lost.`);
    this.triggerRoostkeeperPerfectBrace(blocked, damage);
    // An unblocked hit shatters formation Flow; damage fully absorbed by Cover
    // keeps the flock together (Cover earns a second job: holding formation).
    if (damage > 0) this.flock.flow = 0;
    if (damage > 0) {
      birdAudio.play('hit.impact', { damage, maxHp: this.flock.maxHp, target: 'flock', coverBroke: blocked > 0 });
      birdAudio.play(damage >= 8 ? 'heavyAttack' : 'attack', damage >= 8 ? 1.18 : 0.92);
      this.queueFlockMotion('hit', damage);
      const from = this.enemyView(enemy);
      strike(this, this.fxLayer, from.x, from.y, FLOCK_FX_X, FLOCK_FX_Y, 0xff7a6e);
      this.combatEnemySwipe(from.x, from.y - 18, FLOCK_FX_X, FLOCK_FX_Y + 18, damage >= 8);
      this.combatEnemyImpactContact(FLOCK_FX_X + 84, FLOCK_FX_Y + 18, from.x, damage >= 8);
      if (damage >= 8 || enemy.runtime.type === 'boss' || enemy.runtime.type === 'elite') {
        this.combatEnemyHeavyContact(FLOCK_FX_X + 78, FLOCK_FX_Y + 20, from.x, damage >= 10 ? 1.08 : 0.96);
      }
      this.presentNumberFeedback(FLOCK_FX_X, FLOCK_FX_Y, '#ff7a6e', {
        target: 'flock', kind: 'damage', source: `${enemy.id}:${moveLabel}`, amount: damage, suffix: ' damage', reducedMotion: prefersReducedMotion(),
      });
      this.fxMoteBurst(FLOCK_FX_X, FLOCK_FX_Y + 32, 0xff9d6b, {
        count: damage >= 8 ? 8 : 4, speed: 80, lifespan: 240, scale: 0.3,
      });
      if (currentScreenShakeState().enabled) shakeCamera(this, 0.005);
      // Drain the lost segment of the Cohesion bar.
      const left = FLOCK_HP_BAR.x - FLOCK_HP_BAR.w / 2;
      const xNew = left + FLOCK_HP_BAR.w * Math.max(0, this.flock.hp / this.flock.maxHp);
      const xOld = left + FLOCK_HP_BAR.w * Math.min(1, (this.flock.hp + damage) / this.flock.maxHp);
      fadeRect(this, this.fxLayer, (xNew + xOld) / 2, FLOCK_HP_BAR.y, xOld - xNew, FLOCK_HP_BAR.h - 6, 0xffd0c9);
    } else {
      birdAudio.play('block');
      this.queueFlockMotion('brace');
      this.combatCoverBlockBurst(FLOCK_FX_X, FLOCK_FX_Y + 18, 1.02);
      this.presentNumberFeedback(FLOCK_FX_X, FLOCK_FX_Y, '#7ab8d6', {
        target: 'flock', kind: 'blocked', source: `${enemy.id}:${moveLabel}`, amount: 0, suffix: '', label: 'Blocked',
        reducedMotion: prefersReducedMotion(),
      });
      this.coverImpactFx(FLOCK_FX_X, FLOCK_FX_Y, 0x7ab8d6);
    }
  }

  chooseRewardCard(cardId: string) {
    const reward = this.rewardChoices.find((card) => card.id === cardId);
    if (!reward) return;
    this.rewardSkipArmed = false;
    this.rewardChoiceArmedId = undefined;
    this.rewardInspectionCardId = undefined;
    if (this.hasCardInDeck(reward.id)) {
      this.logEvent(`${displayName(reward)} is already in the deck.`);
      this.rewardChoices = [];
      this.resolvePostCardReward();
      return;
    }
    this.rewardClaims.push({ id: reward.id, receipt: `${this.runStartedAtMs}:${activeSeed}:${activeMapIndex}:${this.currentRouteIndex}:${reward.id}` });
    this.discardPile.push(cloneCard(reward.id));
    birdAudio.play('reward');
    this.logEvent(memoryStorageSessionActive()
      ? `${displayName(reward)} joins this practice flight. Nothing saved.`
      : `${displayName(reward)} joins this flight.`);
    this.applyFlockStats(false);
    this.runRewardEvents.push({ offered: this.rewardChoices.map((card) => card.id), picked: reward.id, skipped: false, decisionMs: Math.max(0, Date.now() - this.rewardDecisionStartedAtMs) });
    recordFirstFlightGuideEvent('reward');
    this.rewardChoices = [];
    this.resolvePostCardReward();
  }

  // Decline the card reward intentionally; take a small Scrap fallback instead
  // (next-level-implementation-spec "rewards support skip or fallback decisions").
  private requestSkipCardReward() {
    this.rewardChoiceArmedId = undefined;
    if (this.rewardSkipArmed) return this.skipCardReward();
    this.rewardSkipArmed = true;
    this.hideCardPreview();
    playUiSound('confirm');
    this.requestBattleRender();
  }

  private handleBattleSkipOrRunKit() {
    if (this.combatCardDetail?.active) return;
    if (this.mode === 'cardReward') {
      if (this.rewardPresentationReady() && !this.settingsOverlayOpen && !this.pauseOverlayOpen) {
        this.requestSkipCardReward();
      }
      return;
    }
    if (this.mode !== 'battle' || this.settingsOverlayOpen || this.pauseOverlayOpen || this.inspectOverlay || this.waymarkDrawerOpen) return;
    this.toggleBattleSupplyDrawer(true);
  }

  private skipCardReward() {
    if (!this.rewardChoices.length) return;
    this.rewardSkipArmed = false;
    const skipScrap = this.currentSkipScrapReward();
    this.runRewardEvents.push({ offered: this.rewardChoices.map((card) => card.id), skipped: true, fallback: 'scrap', decisionMs: Math.max(0, Date.now() - this.rewardDecisionStartedAtMs) });
    recordFirstFlightGuideEvent('reward');
    this.scrap += skipScrap;
    this.runScrapEarned += Math.max(0, skipScrap);
    birdAudio.play('reward', 0.72);
    this.logEvent(`Skipped the card reward for +${skipScrap} Scrap.`);
    this.rewardChoices = [];
    this.resolvePostCardReward();
  }

  private currentSkipScrapReward() {
    return getMapBalanceProfile(currentMap().id, currentMap().index).economy.skipScrap ?? DEFAULT_REWARD_SKIP_SCRAP;
  }

  private beginPostCombatRewards() {
    birdAudio.setMood('victory');
    this.fxLayer.removeAll(true);
    this.activeGeneratedFxSprites = 0;
    this.activeFxParticleBursts = 0;
    this.queueBattleRewardUiLoad();
    this.applyCombatEconomyRewards();
    this.waymarkChoices = this.createWaymarkRewardChoices();
    this.waymarkRewardBuildObservations = {};
    this.rewardChoiceArmedId = undefined;
    if (this.waymarkChoices.length > 1) {
      this.mode = 'waymarkReward';
      this.controllerChoiceIndex = 0;
      this.battleInputActive = false;
      this.saveRewardCheckpoint('waymarkReward');
      this.renderAll();
      return;
    }
    if (this.waymarkChoices.length === 1) {
      this.claimWaymarkReward(this.waymarkChoices[0].id);
    } else {
      this.combatRouteMarkResolved = true;
    }
    this.beginCardReward();
  }

  private beginCardReward() {
    this.rewardSkipArmed = false;
    this.rewardChoiceArmedId = undefined;
    this.rewardChoices = this.createRewardChoices();
    this.rewardDecisionStartedAtMs = Date.now();
    if (this.rewardChoices.length) {
      this.mode = 'cardReward';
      this.controllerChoiceIndex = 0;
      this.battleInputActive = false;
      this.saveRewardCheckpoint('cardReward');
    } else {
      this.logEvent('No crew cards remain.');
      this.resolvePostCardReward();
      return;
    }
    this.renderAll();
  }

  chooseWaymarkReward(markId: string) {
    if (this.mode !== 'waymarkReward' || !this.waymarkChoices.some(mark => mark.id === markId)) return;
    this.rewardChoiceArmedId = undefined;
    this.claimWaymarkReward(markId);
    birdAudio.play('reward');
    this.waymarkChoices = [];
    this.beginCardReward();
  }

  private claimWaymarkReward(markId: string) {
    const mark = alphaRouteMarkLibrary.get(markId);
    if (!mark) return;
    const result = addWaymarkWithCapacity(this.routeMarks, mark.id);
    this.routeMarks = result.routeMarks;
    this.combatRouteMarkAwarded = mark;
    this.combatRouteMarkResolved = true;
    if (result.replaced) {
      const replaced = alphaRouteMarkLibrary.get(result.replaced);
      this.logEvent(`${mark.name} replaces ${replaced?.name ?? 'an older Waymark'}; active Waymarks are capped at ${WAYMARK_ACTIVE_CAP}.`);
    } else {
      this.logEvent(`${mark.name} Waymark claimed.`);
    }
  }

  private resolvePostCardReward() {
    this.rewardSkipArmed = false;
    this.rewardChoiceArmedId = undefined;
    this.upgradeChoices = this.shouldOfferUpgradeReward() ? this.createUpgradeChoices() : [];
    if (this.upgradeChoices.length) {
      this.mode = 'upgradeReward';
      this.controllerChoiceIndex = 0;
      this.battleInputActive = false;
      this.saveRewardCheckpoint('upgradeReward');
      this.renderAll();
      return;
    }
    this.logEvent('No Preen available.');
    this.returnToRouteMap();
  }

  chooseUpgradeCard(cardId: string, interactive = false) {
    const card = this.upgradeChoices.find((candidate) => candidate.id === cardId);
    if (!card) return;
    if (interactive && (this as any).flywayPreenRequest?.(card, (branch: PreenBranch) => {
      card.preenBranch = branch;
      card.runtime = { ...card.runtime, upgrade: branchUpgrade(card.runtime, branch) };
      card.upgradedText = formatEffects(card.runtime.upgrade.effects);
      card.moltTextUpgraded = formatEffects(card.runtime.upgrade.moltEffects ?? []);
      this.chooseUpgradeCard(cardId);
    }, () => this.mode === 'upgradeReward' && this.upgradeChoices.includes(card) && !card.upgraded)) return;
    this.rewardChoiceArmedId = undefined;
    card.upgraded = true;
    card.cost = card.runtime.upgrade.cost ?? card.runtime.cost;
    birdAudio.play('moltPower');
    this.logEvent(`${displayName(card)} preened.`);
    this.upgradeChoices = [];
    this.returnToRouteMap();
  }

  private returnToRouteMap() {
    // Persist the committed decision before either scene transition or collection
    // writes. A failed write leaves a retryable reward step, not a lost flight.
    const completedNodeId = currentCombatNodes()[this.currentRouteIndex]?.id;
    if (completedNodeId && !this.completedRouteNodeIds.includes(completedNodeId)) {
      this.completedRouteNodeIds.push(completedNodeId);
    }
    this.finalizeDistrictContract(completedNodeId);
    const settlementId = `${activeMapIndex}:${completedNodeId}`;
    if (!this.flyway.settledNodes.includes(settlementId)) {
      this.flyway.settledNodes.push(settlementId);
      this.flightCombat.completed = true;
      if (this.statTaken === 0) this.flyway.cleanFights += 1;
      const node = currentCombatNodes()[this.currentRouteIndex];
      if (node?.type === 'rival' && !this.flyway.rivalNodes.includes(node.id)) {
        this.flyway.rivalWins += 1; this.flyway.rivalNodes.push(node.id);
        journal(this.flyway, this.flyway.rivalWins<=3?rivalChapter(this.flyway.rivalWins-1).ending:`The flock clears another rival crossing in ${currentMap().name}.`);
      }
      const bonus = conditions[this.flyway.condition].reward;
      if (bonus) { this.scrap += bonus; this.runScrapEarned += bonus; journal(this.flyway, `${conditions[this.flyway.condition].name} cleared: +${bonus} Scrap.`); }
      this.flyway.condition = 'clear'; this.flyway.conditionNode = undefined;
    }
    if (completedNodeId === currentMap().bossNodeId) restoreDistrict(this.flyway, activeMapIndex);
    if (!this.saveRewardCheckpoint('route')) { this.renderAll(); return; }

    if (completedNodeId === currentMap().bossNodeId) {
      // Final district boss Ã¢â€ â€™ run complete; otherwise advance to the next district.
      const nextMapIndex = nextRunMapIndex(this.runMode, activeMapIndex);
      if (nextMapIndex === undefined) {
        this.mode = 'runComplete';
        birdAudio.setMood('victory');
        birdAudio.play('victory');
        this.emitRunSummary('win');
        this.renderAll();
        return;
      }
      const fromMap = currentMap();
      const toMap = alphaMaps[nextMapIndex];
      const advanceState = this.createRouteReturnState(completedNodeId);
      this.applyMapStartMarks(); // reopened_roofline-style Waymarks stock the next district
      advanceState.supplies = [...this.runSupplies];
      advanceState.freePreenNextDistrict = this.freePreenNextDistrict;
      advanceState.scrap = this.scrap;
      advanceState.mapIndex = nextMapIndex;
      advanceState.currentRouteNodeId = undefined;
      advanceState.districtAdvanceNotice = {
        fromMapName: fromMap.name,
        toMapName: toMap.name,
        toMapIndex: runDistrictOrdinal(this.runMode, nextMapIndex)
      };
      advanceState.routeLog = [
        ...advanceState.routeLog,
        `${fromMap.name} cleared -- onward to ${toMap.name}.`
      ].slice(-8);
      this.logEvent(`${currentMap().name} cleared - onward to ${toMap.name}.`);
      this.scene.start('RouteScene', { runState: advanceState });
      return;
    }

    const runState = this.createRouteReturnState(completedNodeId);
    this.scene.start('RouteScene', { runState });
  }

  private flushRewardClaims() {
    return this.rewardClaims.every(claim => {
      const acquisition = recordCardAcquisitions([claim.id], 'combat_reward', claim.receipt);
      if (acquisition.saved === false) return false;
      if (!acquisition.replayed && !memoryStorageSessionActive()) {
        const first = acquisition.firstCopies.includes(claim.id);
        const target = acquisition.completedTargets.includes(claim.id);
        birdAudio.play(first || target ? 'objectiveComplete' : 'reward');
        const name = displayName(cardLibrary[claim.id]);
        this.logEvent(target ? `Hunt complete! ${name} joins this flight. Permanent milestone recorded.`
          : first ? `First collection claim! ${name} joins this flight.`
          : `${name} joins this flight. Collection history updated.`);
      }
      return true;
    });
  }

  private saveRewardCheckpoint(stage: RewardCheckpoint['stage']) {
    const nodeId = currentCombatNodes()[this.currentRouteIndex]?.id;
    if (!nodeId) return false;
    const run = this.createRouteReturnState(nodeId, true);
    run.pendingCombatReward = {
      version: 1, nodeId, stage,
      choices: (stage === 'waymarkReward' ? this.waymarkChoices
        : stage === 'cardReward' ? this.rewardChoices : stage === 'upgradeReward' ? this.upgradeChoices : []).map(choice => choice.id),
      scrapAwarded: this.combatScrapAwarded,
      waymarkAwarded: this.combatRouteMarkAwarded?.id,
      claims: this.rewardClaims.map(claim => ({ ...claim })),
    };
    this.battleRouteCheckpoint = run;
    const saved = persistActiveRun(run) && this.flushRewardClaims();
    this.pauseSaveFailed = !saved;
    if (!saved) {
      this.setBattlePaused(true);
      announceScreenReader('Rewards could not be saved. Keep this tab open. Retry Main Menu to save this reward step.');
    }
    return saved;
  }

  private finalizeDistrictContract(completedNodeId: string | undefined) {
    const contract = this.runDistrictContracts.find((candidate) => candidate.mapIndex === activeMapIndex);
    if (!contract || contract.confirmed === false || contract.completed) return;
    const definition = DISTRICT_CONTRACT_DEFINITIONS.find((candidate) => candidate.id === contract.id);
    if (!definition) return;
    const progress = districtContractProgressValue(
      contract,
      currentMap(),
      this.allDeckCards(),
      this.combatResultsForRouteReturn(completedNodeId),
      this.runRewardEvents,
      completedNodeId,
      this.completedRouteNodeIds
    );
    if (progress < definition.target) return;
    contract.completed = true;
    if (!contract.rewardClaimed) {
      contract.rewardClaimed = true;
      this.scrap += definition.rewardScrap;
      this.runScrapEarned += definition.rewardScrap;
    }
    this.logEvent(`Contract complete: ${definition.name}. +${definition.rewardScrap} Scrap and record badge secured.`);
  }

  private createRouteReturnState(completedNodeId: string | undefined, rewardCheckpoint = false): RunState {
    const completedRouteNode = currentCombatNodes()[this.currentRouteIndex];
    this.flock.block = 0;
    this.flock.molt = false;
    this.flock.exposed = false;
    this.flock.exposedTurns = 0;
    this.flock.frail = 0;
    this.flock.weak = 0;
    this.flock.openSkyGuard = this.flockStats().openSkyGuard ?? 0;
    this.applyFlockStats(false);
    this.applyCombatEconomyRewards();
    if (!rewardCheckpoint && !this.combatRouteMarkResolved) {
      const choices = this.createWaymarkRewardChoices();
      if (choices[0]) this.claimWaymarkReward(choices[0].id);
      else this.combatRouteMarkResolved = true;
    }

    const routeLog = [
      `${currentMap().name}: ${completedRouteNode?.label ?? 'Encounter'} cleared. +${this.combatScrapAwarded} Scrap.`,
      ...(this.combatRouteMarkAwarded ? [`${this.combatRouteMarkAwarded.name} Waymark claimed.`] : []),
      ...this.log.slice(-3)
    ];

    return {
      deck: saveCards(this.allDeckCards()),
      flyway: normalizeFlyway(this.flyway),
      pendingCardClaims: this.battleRouteCheckpoint.pendingCardClaims?.map(claim => ({ ...claim })),
      cardClaimSequence: this.battleRouteCheckpoint.cardClaimSequence,
      leaderId: this.runLeaderId,
      difficulty: this.runDifficulty,
      runMode: this.runMode,
      seed: activeSeed,
      currentHp: Math.min(this.flock.maxHp, this.flock.hp + (rewardCheckpoint ? 0 : POST_COMBAT_RECOVERY)),
      scrap: this.scrap,
      scrapEarned: this.runScrapEarned,
      scrapSpent: this.runScrapSpent,
      startedAtMs: this.runStartedAtMs,
      seenEnemyMoves: [...this.runSeenEnemyMoves],
      districtContracts: this.runDistrictContracts.map((contract) => ({ ...contract })),
      routeMarks: [...this.routeMarks],
      supplies: [...this.runSupplies],
      supplySlots: this.runSupplyCapacity,
      mapIndex: activeMapIndex,
      completedRouteNodeIds: [...this.completedRouteNodeIds],
      currentRouteNodeId: completedNodeId,
      routeLog,
      nextCombat: this.afterCombatNextCombatMods(completedRouteNode),
      signalChoices: [...this.runSignalChoices],
      rewardEvents: [...this.runRewardEvents],
      routeDecisions: [...this.runRouteDecisions],
      suppliesUsed: [...this.runSuppliesUsed],
      combatResults: this.combatResultsForRouteReturn(completedNodeId),
      freePreenNextDistrict: this.freePreenNextDistrict
    };
  }

  private combatResultsForRouteReturn(completedNodeId: string | undefined) {
    if (!completedNodeId) return [...this.runCombatResults];
    if (this.runCombatResults.some((result) => result.nodeId === completedNodeId)) return [...this.runCombatResults];
    const routeNode = currentCombatNodes()[this.currentRouteIndex];
    return [...this.runCombatResults, this.currentCombatResult(routeNode, completedNodeId)];
  }

  private afterCombatNextCombatMods(routeNode: RouteNode | undefined): NextCombatMods | undefined {
    if (routeNode?.type !== 'street') return undefined;
    const mods: NextCombatMods = {};
    for (const id of this.routeMarks) {
      const mark = alphaRouteMarkLibrary.get(id);
      if (!mark || mark.trigger !== 'afterStreetEncounter') continue;
      for (const effect of routeMarkEffects(mark)) {
        const parsed = parseEffect(effect);
        if (!parsed) continue;
        const value = parseEffectValue(parsed.args[1] ?? parsed.args[0], 0);
        if (parsed.name === 'gainOpenSkyGuard') mods.openSkyGuard = (mods.openSkyGuard ?? 0) + value;
        if (parsed.name === 'reduceNextOpenSky') mods.reduceNextOpenSky = (mods.reduceNextOpenSky ?? 0) + value;
        if (parsed.name === 'bossDamageShield') mods.bossDamageShield = (mods.bossDamageShield ?? 0) + value;
        if (parsed.name === 'startNextCombatOpenSky') mods.startOpenSky = true;
      }
    }
    return Object.keys(mods).length ? mods : undefined;
  }

  private currentCombatResult(routeNode: RouteNode | undefined, nodeId: string): CombatResultSummary {
    const isBossEntry = routeNode?.type === 'boss';
    const terminalResult = this.flock.hp <= 0 ? 'loss' : this.enemies.every((enemy) => enemy.hp <= 0) ? 'win' : undefined;
    const objective = this.encounterObjectiveStatus(terminalResult);
    return {
      encounterId: routeNode?.payloadId ?? '',
      nodeId,
      nodeType: routeNode?.type ?? 'street',
      enemyIds: this.enemies.map((enemy) => enemy.runtime.id),
      turnsTaken: this.turn,
      damageDealt: this.statDealt,
      cardContributions: this.cardContributions.map(row => ({ ...row })),
      cohesionLost: this.statTaken,
      killedByMove: this.flock.hp <= 0 ? this.killedByMove : undefined,
      durationMs: Math.max(0, Date.now() - this.combatStartedAtMs),
      damageTakenByMove: [...this.statDamageTakenByMove.values()].map((entry) => ({ ...entry })),
      objective: objective
        ? {
            type: objective.type,
            title: objective.title,
            status: objective.status,
            bonusScrap: objective.status === 'complete' ? objective.bonusScrap : 0
          }
        : undefined,
      decisionStats: {
        cardsPlayed: this.statCardsPlayed,
        overextensions: this.statOverextensions,
        lowCardTurns: this.statLowCardTurns,
        noOverextensionTurns: this.statNoOverextensionTurns,
        turnEnds: this.statTurnEnds,
        cardsHeldAtRoost: this.statCardsHeldAtRoost,
        unspentWingbeatAtRoost: this.statUnspentWingbeatAtRoost,
        maxCardsPlayedTurn: this.statMaxCardsPlayedTurn,
        waymarksAtStart: this.statWaymarksAtStart,
        waymarksAtEnd: this.routeMarks.length,
        surgesTriggered: this.statSurgesTriggered,
        blockedDamage: this.statBlocked,
        invalidActions: this.statInvalidActions,
        cancelledActions: this.statCancelledActions,
        bossEntryCohesion: isBossEntry ? this.flock.hp : undefined,
        bossEntryScrap: isBossEntry ? this.scrap : undefined
      }
    };
  }

  private applyCombatEconomyRewards() {
    if (this.combatEconomyAwarded) return;
    const routeNode = currentCombatNodes()[this.currentRouteIndex];
    const scrapReward = combatScrapReward(routeNode);
    const streetBonus = routeNode?.type === 'street' ? this.markValue('afterStreetEncounter', 'gainScrap') : 0;
    const overextensionTax = routeNode?.type === 'boss'
      ? 0
      : Math.min(scrapReward + streetBonus, this.statOverextensions * 10);
    const objective = this.encounterObjectiveStatus();
    const objectiveBonus = objective?.status === 'complete' ? objective.bonusScrap : 0;
    const signatureBonus = this.signatureWin()?.bonus ?? 0;
    this.combatScrapAwarded = scrapReward + streetBonus + objectiveBonus + signatureBonus - overextensionTax;
    this.scrap += this.combatScrapAwarded;
    this.runScrapEarned += Math.max(0, this.combatScrapAwarded);
    this.combatEconomyAwarded = true;
    this.logEvent(`Recovered +${this.combatScrapAwarded} Scrap.`);
    if (signatureBonus) this.logEvent(`Both defenders defeated: +${signatureBonus} bonus Scrap.`);
    if (objective) this.logEvent(objectiveBonus > 0
      ? `${objective.title} complete: +${objectiveBonus} bonus Scrap.`
      : `${objective.title} missed: no bonus Scrap.`);
    if (overextensionTax > 0) this.logEvent(`Overextension repairs cost ${overextensionTax} Scrap.`);
  }

  private createWaymarkRewardChoices() {
    const routeNode = currentCombatNodes()[this.currentRouteIndex];
    if (!routeNode || this.combatRouteMarkResolved) return [];
    const profile = rewardProfileForRouteNode(routeNode);
    const guaranteed = routeNode.type === 'rival' || routeNode.type === 'boss' || profile?.routeMarkGuaranteed;
    const chance = profile?.routeMarkChance ?? 0;
    const rolled = chance > 0 && deterministicChance(`${activeSeed}:${routeNode.id}:route-mark`, chance);
    if (!guaranteed && !rolled) return [];

    const choiceCount = WAYMARK_REWARD_CHOICE_COUNT;
    const primaryPoolIds = routeNode.type === 'boss' ? HIGH_TIER_ROUTE_MARK_IDS : MARKET_ROUTE_MARK_IDS;
    const fallbackPoolIds = routeNode.type === 'boss' ? ALL_ROUTE_MARK_IDS : MARKET_ROUTE_MARK_IDS;
    return this.selectWaymarkRewardChoices(
      primaryPoolIds,
      fallbackPoolIds,
      choiceCount,
      `${activeSeed}:${routeNode.id}:waymark-reward`,
      routeNode.type === 'boss'
    );
  }

  private selectWaymarkRewardChoices(
    primaryPoolIds: string[],
    fallbackPoolIds: string[],
    count: number,
    seedKey: string,
    anchorBossSource: boolean
  ) {
    const owned = new Set(this.routeMarks);
    const picked: RuntimeRouteMark[] = [];
    const pickedIds = new Set<string>();
    const addRanked = (ids: string[], limit = count) => {
      for (const id of deterministicRankedIds(ids, seedKey)) {
        if (picked.length >= limit) break;
        if (owned.has(id) || pickedIds.has(id)) continue;
        const mark = alphaRouteMarkLibrary.get(id);
        if (!mark) continue;
        picked.push(mark);
        pickedIds.add(id);
      }
    };

    if (anchorBossSource) {
      addRanked(primaryPoolIds.filter((id) => alphaRouteMarkLibrary.get(id)?.source === 'boss'), Math.min(1, count));
    }
    addRanked(primaryPoolIds);
    if (picked.length < count) addRanked(fallbackPoolIds);
    return picked.slice(0, count);
  }

  private handTargetSize() {
    return Math.max(1, flockHandTarget(this.flockStats().draw ?? 0, this.keystoneActive('plumes'), this.runLeaderId, this.nextTurnDrawBonus) - (this.flyway.relic === 'light-travel' ? 1 : 0));
  }

  private drawToHandSize() {
    this.drawCards(Math.max(0, this.handTargetSize() - this.hand.length));
    this.flightCombat.lightTravelReady = this.hand.length <= 4;
    this.nextTurnDrawBonus = 0;
  }

  private drawCards(count: number) {
    let drawn = 0;
    const drawnCards: Card[] = [];
    let reshuffledDuringDraw = false;
    for (let i = 0; i < count; i += 1) {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break;
        this.reshuffleDiscardIntoDraw();
        reshuffledDuringDraw = true;
      }
      const card = this.drawPile.shift();
      if (card) { this.hand.push(card); drawnCards.push(card); drawn += 1; }
    }
    this.observeCardEffect('drawn', drawn);
    if (drawnCards.length && this.root?.active) this.queueCardArtLoad(drawnCards);
    if (drawn > 0) this.animateDraw(drawn, reshuffledDuringDraw);
  }

  private reshuffleDiscardIntoDraw() {
    this.drawPile = this.discardPile.splice(0);
    shuffle(this.drawPile, this.combatRandom);
    this.animateShuffle();
  }

  // Pile anchor positions (Draw = ribbon chip 1, Discard = chip 2).
  private drawPilePos() { return { x: 88, y: 600 }; }     // lower-left
  private discardPilePos() { return { x: 1192, y: 600 }; } // lower-right

  // Center-x of a hand slot on the fixed five-column grid.
  private handSlotCenterX(index: number) {
    return this.handCardLeft(index) + CARD_W / 2;
  }

  // Cards flick from the draw pile to their new hand slots.
  private createCombatCardBack(x: number, y: number, width: number, height: number, alpha = 1, angle = 0) {
    if (this.textures.exists(COMBAT_CARD_BACK_TEXTURE)) {
      setTextureFilter(this.textures.get(COMBAT_CARD_BACK_TEXTURE), Phaser.Textures.FilterMode.LINEAR);
      return this.add.image(x, y, COMBAT_CARD_BACK_TEXTURE)
        .setDisplaySize(width, height)
        .setAlpha(alpha)
        .setAngle(angle)
        .setName('combat-card-back');
    }
    return this.add.rectangle(x, y, width, height, 0x16243c, alpha)
      .setStrokeStyle(2, 0x7ab8d6, 1)
      .setAngle(angle)
      .setName('combat-card-back-fallback');
  }

  private animatePileCard(from: { x: number; y: number }, to: { x: number; y: number }, kind: string, delay = 0) {
    if (!this.fxLayer?.active || prefersReducedMotion()) return;
    const back = this.createCombatCardBack(from.x, from.y, 32, 48, 0.78, -4)
      .setName('combat-pile-transfer').setData('kind', kind).setData('from', from).setData('to', to);
    this.fxLayer.add(back);
    this.tweens.add({
      targets: back, x: to.x, y: to.y, alpha: 0, angle: 4,
      duration: this.combatTimingDelay(180), delay: this.combatTimingDelay(delay), ease: 'Cubic.easeOut',
      onComplete: () => back.destroy(),
    });
    back.once(Phaser.GameObjects.Events.DESTROY, () => this.tweens.killTweensOf(back));
  }

  private animateDraw(count: number, _afterShuffle = false) {
    if (!this.fxLayer?.active || count <= 0) return;
    birdAudio.play('draw', Math.min(1.25, 0.72 + count * 0.08));
    // Three representative transfers, not an unbounded stagger over a hand
    // that is already usable. Counts and actual card order remain authoritative.
    const shown = Math.min(3, count, this.hand.length);
    for (let i = 0; i < shown; i += 1) {
      this.animatePileCard(this.drawPilePos(), { x: this.handSlotCenterX(this.hand.length - shown + i), y: HAND_Y }, 'draw', i * 20);
    }
  }

  private animateDiscard(count: number, fromX = GAME_WIDTH - 330, fromY = HAND_Y - 20, _scale = 1) {
    if (!this.fxLayer?.active || count <= 0) return;
    birdAudio.play('discard', Math.min(1.25, 0.68 + count * 0.08));
    for (let i = 0; i < Math.min(3, count); i += 1) {
      this.animatePileCard({ x: fromX - i * 12, y: fromY }, this.discardPilePos(), 'discard', i * 20);
    }
  }

  private animateShuffle() {
    if (!this.fxLayer?.active) return;
    birdAudio.play('shuffle', 1);
    this.animatePileCard(this.discardPilePos(), this.drawPilePos(), 'shuffle');
  }

  private animateReturnCard(instanceId: string) {
    const index = this.hand.findIndex(card => card.instanceId === instanceId);
    if (index >= 0) this.animatePileCard(this.discardPilePos(), { x: this.handSlotCenterX(index), y: HAND_Y }, 'return');
  }


  private discardCards(count: number) {
    let discarded = 0;
    for (let i = 0; i < count; i += 1) {
      const card = this.hand.pop();
      if (!card) break;
      this.discardPile.push(card);
      discarded += 1;
      this.logEvent(`${displayName(card)} discarded.`);
    }
    if (discarded > 0) this.animateDiscard(discarded);
    return discarded;
  }

  private beginDiscardChoice(
    source: string,
    count: number,
    optional: boolean,
    onResolve: (discarded: number) => void,
    excludedInstanceId?: string,
  ) {
    if (this.discardChoiceModule) this.discardChoiceModule.beginDiscardChoice(this, source, count, optional, onResolve, excludedInstanceId);
    else onResolve(this.discardCards(count));
  }

  private toggleDiscardChoice(instanceId: string) {
    this.discardChoiceModule?.toggleDiscardChoice(this, instanceId);
  }

  private confirmDiscardChoice(skip = false) {
    this.discardChoiceModule?.confirmDiscardChoice(this, skip);
  }

  private beginReturnChoice(
    source: string,
    filter: string,
    drawAfter: number,
    onResolve: (returned: number) => void,
  ) {
    if (this.returnChoiceModule) this.returnChoiceModule.beginReturnChoice(this, source, filter, drawAfter, onResolve);
    else {
      const before = this.hand.length;
      this.returnDiscardToHand(filter, drawAfter);
      onResolve(this.hand.length > before ? 1 : 0);
    }
  }

  private focusReturnChoice(instanceId: string) {
    this.returnChoiceModule?.focusReturnChoice(this, instanceId);
  }

  private chooseReturnCard(instanceId?: string) {
    this.returnChoiceModule?.chooseReturnCard(this, instanceId);
  }

  hideDiscardChoiceTooltip() { hideKwTooltip(); }
  announceDiscardChoice(message: string) { announceScreenReader(message); }
  playDiscardChoiceSound(cue: 'confirm' | 'locked') { playUiSound(cue); }
  returnChoiceCardName(card: Card) { return displayName(card); }

  private returnDiscardToHand(filter = 'nonMolt', drawAfter = 0) {
    const normalizedFilter = (filter || 'nonMolt').trim();
    const allowMolt = normalizedFilter === 'any' || normalizedFilter === 'all';
    const index = this.discardPile.findIndex((card) => allowMolt || card.type !== 'molt');
    if (index < 0) {
      this.logEvent('No route memory is ready to return.');
      return;
    }
    const [card] = this.discardPile.splice(index, 1);
    this.hand.push(card);
    this.logEvent(`${displayName(card)} returns from discard.`);
    const drawCount = Math.max(0, Math.floor(drawAfter));
    if (drawCount > 0) {
      this.drawCards(drawCount);
      this.logEvent(`Route memory draws ${drawCount}.`);
    }
    this.animateReturnCard(card.instanceId);
  }



  private removeCardFromHand(instanceId: string) {
    const index = this.hand.findIndex((card) => card.instanceId === instanceId);
    if (index < 0) return undefined;
    const [card] = this.hand.splice(index, 1);
    return card;
  }

  private addCardToDrawRandom(card: Card) {
    const at = Math.floor(this.combatRandom() * (this.drawPile.length + 1));
    this.drawPile.splice(at, 0, card);
  }

  private effectiveCost(card: Card) {
    // Aviary is an artwork category; the runtime kind owns Molt cost rules.
    if (this.flock.molt && card.runtime.kind !== 'molt') {
      return Math.max(0, card.cost - 1);
    }
    return card.cost;
  }

  private signatureWin() {
    return signatureVictory(currentCombatNodes()[this.currentRouteIndex]?.payloadId ?? '', this.enemies, this.flock.hp, this.enemyDefeatedTurns);
  }

  private checkOutcome() {
    if (this.flock.hp > 0 && (this.enemies.every((enemy) => enemy.hp <= 0) || this.signatureWin())) {
      if (this.mode === 'battle') {
        finishPracticeTurn(this);
        if (this.practiceRematch) {
          this.mode = 'runComplete';
          this.emitRunSummary('win');
          this.retireCombatFxForOutcome();
          this.logEvent('Practice complete. No rewards or progression saved.');
          return;
        }
        this.beginPostCombatRewards();
        this.logEvent(this.signatureWin()?.reason ?? 'The rooftop is clear.');
        this.combatVictoryRally();
        return;
      }
    } else if (this.flock.hp <= 0) {
      finishPracticeTurn(this);
      this.mode = 'defeat';
      birdAudio.setMood('defeat');
      birdAudio.play('defeat');
      this.emitRunSummary('loss');
      this.retireCombatFxForOutcome();
      this.logEvent('The flock scatters.');
    }
  }

  // Emit a local run-summary artifact (localStorage + window) so playtests are
  // observable (next-level-implementation-spec Phase 5).
  private emitRunSummary(result: 'win' | 'loss') {
    finishStory(this.flyway, result === 'win', this.allDeckCards().length);
    this.flywayArchiveSaved = false;
    const currentNode = currentCombatNodes()[this.currentRouteIndex];
    const finalNodeId =
      currentNode?.id ??
      this.completedRouteNodeIds[this.completedRouteNodeIds.length - 1] ??
      '';
    const combatResults = finalNodeId && !this.runCombatResults.some((combat) => combat.nodeId === finalNodeId)
      ? [...this.runCombatResults, this.currentCombatResult(currentNode, finalNodeId)]
      : [...this.runCombatResults];
    const decisionStats = combatResults.reduce((totals, combat) => {
      const stats = combat.decisionStats;
      if (!stats) return totals;
      totals.cardsPlayed += stats.cardsPlayed;
      totals.overextensions += stats.overextensions;
      totals.lowCardTurns += stats.lowCardTurns;
      totals.noOverextensionTurns += stats.noOverextensionTurns;
      totals.cardsHeldAtRoost += stats.cardsHeldAtRoost;
      totals.unspentWingbeatAtRoost += stats.unspentWingbeatAtRoost;
      totals.maxCardsPlayedTurn = Math.max(totals.maxCardsPlayedTurn, stats.maxCardsPlayedTurn);
      totals.blockedDamage += stats.blockedDamage ?? 0;
      totals.invalidActions += stats.invalidActions ?? 0;
      totals.cancelledActions += stats.cancelledActions ?? 0;
      if (stats.bossEntryCohesion !== undefined) totals.bossEntryCohesion = stats.bossEntryCohesion;
      if (stats.bossEntryScrap !== undefined) totals.bossEntryScrap = stats.bossEntryScrap;
      return totals;
    }, {
      cardsPlayed: 0,
      overextensions: 0,
      lowCardTurns: 0,
      noOverextensionTurns: 0,
      cardsHeldAtRoost: 0,
      unspentWingbeatAtRoost: 0,
      maxCardsPlayedTurn: 0,
      finalWaymarks: this.routeMarks.length,
      blockedDamage: 0,
      invalidActions: 0,
      cancelledActions: 0,
      bossEntryCohesion: undefined as number | undefined,
      bossEntryScrap: undefined as number | undefined
    });
    const totalTurnsTaken = combatResults.reduce((sum, combat) => sum + Math.max(0, combat.turnsTaken), 0);
    const most = totalContributions(combatResults)[0];
    if (most) this.flyway.cardMoment = { cardId: most.cardId, plays: most.plays, damage: most.damage, cover: most.cover };
    const summary: RunSummary = {
      flyway: normalizeFlyway(this.flyway),
      pendingCardClaims: this.battleRouteCheckpoint.pendingCardClaims?.map(claim => ({ ...claim })),
      id: completedRunId(this.runStartedAtMs, activeSeed),
      seed: activeSeed,
      result,
      leaderId: this.runLeaderId,
      difficulty: this.runDifficulty,
      runMode: this.runMode,
      mapId: currentMap().id,
      finalNodeId,
      killedBy: result === 'loss' ? combatResults.at(-1)?.killedByMove ?? this.enemies.find((enemy) => enemy.hp > 0)?.name : undefined,
      turnsTaken: totalTurnsTaken,
      durationMs: Math.max(0, Date.now() - this.runStartedAtMs),
      currentCohesion: this.flock.hp,
      maxCohesion: this.flock.maxHp,
      scrapEarned: this.runScrapEarned,
      scrapSpent: this.runScrapSpent,
      finalScrap: this.scrap,
      path: [...this.completedRouteNodeIds],
      deck: saveCards(this.allDeckCards()),
      routeMarks: [...this.routeMarks],
      suppliesUsed: [...this.runSuppliesUsed],
      signals: [...this.runSignalChoices],
      cardRewards: [...this.runRewardEvents],
      routeDecisions: [...this.runRouteDecisions],
      combatResults,
      districtContracts: this.runDistrictContracts.map((contract) => ({ ...contract })),
      seenEnemyMoves: [...this.runSeenEnemyMoves],
      combatPace: combatPacePreference(),
      animationPace: animationPacePreference(),
      firstFlightGuide: firstFlightGuideState(),
      decisionStats
    };
    window.__birdSquadLastRun = summary;
    if (memoryStorageSessionActive()) { this.saveFlywayEnding(); clearActiveRun(); return; }
    this.outcomeSaved = false;
    this.ensureOutcomeSaved();
  }

  private createRewardChoices() {
    const owned = new Set(this.allDeckCards().map((card) => card.id));
    const remaining = arcanaRewardPool.filter((id) => !owned.has(id));
    const districtBias = this.districtBias();
    const chosen = draftStructuredRewardChoices(
      remaining,
      this.allDeckCards().map((card) => card.id),
      difficultyMods(this.runDifficulty).rewardChoices,
      this.combatRandom,
      (id) => (REWARD_RARITY_WEIGHTS[cardLibrary[id]?.runtime.rarity ?? 'common'] ?? 50)
        * (activeMapIndex === 0 && rooftopPlanMatch(this.flyway.rooftopPlan, cardLibrary[id].runtime) ? 2 : 1),
      (id) => this.cardNeedTags(cardLibrary[id]).some((tag) => tag.includes('First ') || tag.includes('Fills ') || tag.includes('KEYSTONE')),
      (id) => cardLibrary[id]?.role,
      (id) => cardLibrary[id]?.runtime.suit ?? undefined,
      (id) => districtRewardAffinity(cardLibrary[id], districtBias).length > 0,
    );
    discoverCards(chosen); // offered cards count as "found" in the Codex
    return chosen.map((id) => cloneCard(id));
  }

  private createUpgradeChoices() {
    const candidates = distinctMeaningfulUpgradeCards(this.allDeckCards());
    shuffle(candidates, this.combatRandom);
    return candidates.slice(0, 3);
  }

  private shouldOfferUpgradeReward() {
    const routeNode = currentCombatNodes()[this.currentRouteIndex];
    const profile = rewardProfileForRouteNode(routeNode);
    if (!profile || !distinctMeaningfulUpgradeCards(this.allDeckCards()).length) return false;
    if (routeNode?.type === 'rival' || routeNode?.type === 'boss') return true;
    if (profile.preenGuaranteed || (profile.preen ?? 0) > 0) return true;
    if (!profile.preenChance) return false;
    return deterministicChance(`${activeSeed}:${routeNode?.id ?? 'combat'}:preen`, profile.preenChance);
  }

  private allDeckCards() {
    const cards = [...this.drawPile, ...this.discardPile, ...this.hand, ...this.clearedPile];
    if (this.resolvingCard && !cards.some(card => card.instanceId === this.resolvingCard!.instanceId)) cards.push(this.resolvingCard);
    return cards;
  }

  private flockStats() {
    const stats = aggregateFlockStats(this.allDeckCards());
    stats.openSkyGuard = Math.max(stats.openSkyGuard ?? 0, this.flock.openSkyGuard);
    return stats;
  }

  private applyFlockStats(fullHeal: boolean) {
    const oldMax = this.flock.maxHp;
    const stats = aggregateFlockStats(this.allDeckCards());
    this.flock.maxHp = BASE_COHESION + (stats.cohesion ?? 0);
    if (fullHeal) {
      this.flock.hp = this.flock.maxHp;
    } else if (this.flock.maxHp !== oldMax) {
      this.flock.hp = Math.min(this.flock.maxHp, this.flock.hp + Math.max(0, this.flock.maxHp - oldMax));
    }
    this.flock.openSkyGuard = Math.max(this.flock.openSkyGuard, stats.openSkyGuard ?? 0);
  }

  private hasCardInDeck(cardId: string) {
    return this.allDeckCards().some((card) => card.id === cardId);
  }

  private getSelectedCard() {
    return this.hand.find((card) => card.instanceId === this.selectedInstanceId);
  }

  private getLivingEnemy(enemyId: string) {
    return this.enemies.find((enemy) => enemy.id === enemyId && enemy.hp > 0);
  }

  private firstLivingEnemy() {
    return this.enemies.find((enemy) => enemy.hp > 0);
  }

  private normalizeSelectedEnemy() {
    const target = this.getLivingEnemy(this.selectedEnemyId) ?? this.firstLivingEnemy();
    this.selectedEnemyId = target?.id ?? '';
    return target;
  }

  private resolvePlayableEnemyTarget(enemyId: string) {
    return this.getLivingEnemy(enemyId) ?? this.normalizeSelectedEnemy();
  }

  private getEnemy(enemyId: string) {
    return this.enemies.find((enemy) => enemy.id === enemyId) ?? this.firstLivingEnemy() ?? this.enemies[0];
  }

  private logEvent(message: string) {
    this.combatHistory.push(`Beat ${this.turn} · ${message}`);
    this.combatHistory = this.combatHistory.slice(-256);
    this.log.push(message);
    this.log = this.log.slice(-8);
  }

  private getTextState(): RenderPayload {
    if (this.battleDebugStateModule) return this.battleDebugStateModule.buildBattleStateSnapshot(this);
    return { scene: 'BattleScene', mode: this.mode, assetReadiness: this.battleAssetReadiness.snapshot(), combatAnimationPending: true } as RenderPayload;
  }

  private activeMoltPower() {
    return BASE_MOLT_POWER + (this.flockStats().moltPower ?? 0);
  }

  private getInspectedCardPayload() {
    if (!this.inspectOverlay || this.inspectOverlay === 'flock') return undefined;
    const entries = this.battleInspectCards(this.inspectOverlay);
    const entry = entries.find(({ card }) => card.instanceId === this.inspectedCardId) ?? entries[0];
    if (!entry) return undefined;
    const contract = this.activeCardContract(entry.card);
    return {
      id: entry.card.id,
      name: displayName(entry.card),
      bird: entry.card.bird,
      zone: entry.zone,
      cost: this.effectiveCost(entry.card),
      type: entry.card.type,
      role: entry.card.role,
      target: entry.card.target,
      activeTarget: contract.target,
      activeRole: contract.role,
      activeText: contract.text,
      usesMolt: contract.usesMolt,
      baseText: entry.card.text,
      upgradedText: entry.card.upgradedText,
      flockStats: Object.entries(entry.card.runtime.flockStats).map(([key, value]) => ({
        label: flockStatLabel(key),
        value: Number(value)
      }))
    };
  }

  private cardInspectFocusState(): RenderPayload['cardInspectFocus'] {
    if (!this.inspectOverlay || this.inspectOverlay === 'flock') return undefined;
    const entries = this.battleInspectCards(this.inspectOverlay);
    const zoneCounts = {
      deck: this.allDeckCards().length,
      draw: this.drawPile.length,
      discard: this.discardPile.length,
      cleared: this.clearedPile.length,
    };
    const bindings = {
      select: 'Up / Down',
      details: controlBindingLabel('guide'),
      previousZone: controlBindingLabel('previous'),
      nextZone: controlBindingLabel('next'),
      back: controlBindingLabel('back'),
    };
    const controller = {
      choose: 'D-pad Up / Down',
      zone: 'D-pad Left / Right',
      page: 'LB / RB',
      back: 'B',
    };
    if (entries.length === 0) {
      return {
        active: true,
        overlay: this.inspectOverlay,
        index: 0,
        count: 0,
        visibleStart: 0,
        visibleEnd: 0,
        label: 'No cards',
        zoneCounts,
        bindings,
        controller,
      };
    }
    const index = Math.max(0, entries.findIndex(({ card }) => card.instanceId === this.inspectedCardId));
    const selected = entries[index];
    const visibleStart = clamp(this.cardReviewScroll, 0, Math.max(0, entries.length - CARD_REVIEW_VISIBLE_ROWS));
    return {
      active: true,
      overlay: this.inspectOverlay,
      instanceId: selected.card.instanceId,
      index,
      count: entries.length,
      visibleStart: visibleStart + 1,
      visibleEnd: Math.min(entries.length, visibleStart + CARD_REVIEW_VISIBLE_ROWS),
      label: displayName(selected.card),
      zone: selected.zone,
      zoneCounts,
      bindings,
      controller,
    };
  }

  private flockStatRows() {
    return buildFlockStatRows(this.allDeckCards(), this.flock.maxHp, this.nextTurnEnergyBonus, this.flock.openSkyGuard);
  }
}
