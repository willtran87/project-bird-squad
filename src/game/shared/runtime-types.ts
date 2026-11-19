import type { CardContribution } from '../card-contributions';
import type { PreenBranch, FlywayState, newFlightCombat } from '../flyway-rules';
import type { PendingCardClaim } from '../card-claim-checkpoint';
import type { RewardCheckpoint } from '../reward-checkpoint';
import type { TurnCheckpoint } from '../turn-practice';
import type { OpeningDrawState } from '../deterministic-draw';
import type { RouteNode, EnemyRole, RuntimeEnemy, RuntimeCard, RuntimeSupply, RouteMarkRarity, RuntimeRouteMark } from '../types';
import type { DifficultyMods } from '../difficulty';
import type { firstFlightGuideState, firstMoltGuideState } from '../first-flight-guide';
import type { graphicsQualityState } from '../graphics-quality';
import type { visualContrastState, colorCueState } from '../visual-accessibility';
import type { screenReaderState } from '../screen-reader-accessibility';
import type { DistrictContractState, MARKET_BOSS_GUARD, MARKET_ROUTE_SCOUT } from './gameplay-constants';
import type { animationPacingState, controlsTextState, currentFlashEffectsState, currentScreenShakeState, textPacingState } from './preferences';
import type { SceneAssetReadinessState } from './scene-asset-readiness';
import type { AudioCue } from './bird-audio-director';

export type GameMode = 'menu' | 'routeSelection' | 'battle' | 'waymarkReward' | 'cardReward' | 'upgradeReward' | 'runComplete' | 'defeat';

export type CombatInputChoiceKind = 'card' | 'returnChoice' | 'cardReward' | 'upgradeReward' | 'waymarkReward' | 'outcome';

export type CodexDataModule = typeof import('../codex-data');

export type BossDossierModule = typeof import('../boss-dossier');

export type AdaptiveMusicModule = typeof import('../adaptive-music');

export type AudioSfxModule = typeof import('../audio-sfx');

export type InspectOverlay = 'deck' | 'draw' | 'discard' | 'cleared' | 'flock';

type CardType = 'major' | 'minor' | 'molt' | 'aviary';

export type CardRole = 'attack' | 'skill' | 'utility';

export type TargetType = 'enemy' | 'allEnemies' | 'self' | 'none' | 'choice';

export type NodeChoiceOption = { key: string; text: string; effects: string[]; locked: boolean; lockedText?: string };

export type CardPickerMode = 'preen' | 'release';

export type MarketCategory = 'cards' | 'waymarks' | 'supplies' | 'services' | 'catalog';

export type DeckReviewFilter = 'all' | 'plumes' | 'quills' | 'basins' | 'nests' | 'special' | 'preened';

export type DeckReviewSort = 'run' | 'cost' | 'name';

export type MarketDecisionPreview = string[];

export type RouteCardPickerPlan = { mode: CardPickerMode; count: number };

export type PendingRouteReward = {
  nodeId: string;
  nodeType: RouteNode['type'];
  choiceKey: string;
  choiceText: string;
  effects: string[];
  effectText: string;
  restoreState: RunState;
  accent: number;
  effectsAppliedOnOpen: boolean;
  previewItem?: PendingRouteRewardItem;
  previewCards?: Card[];
  projectedState?: RunState;
  decisionPreview?: MarketDecisionPreview;
  supplyChoices?: string[];
};

export type PendingRouteRewardItem = { kind: 'supply' | 'waymark'; id: string };

export type RetainSource = 'pending' | 'roostDiscard';

export type RunMode = 'full' | 'quick';

export type MenuFocus =
  | 'configure'
  | 'leader'
  | 'difficulty'
  | 'runMode'
  | 'primaryRun'
  | 'secondaryRun'
  | 'howToPlay'
  | 'settings'
  | 'codex'
  | 'profile';


export interface Flock {
  hp: number;
  maxHp: number;
  block: number;
  weak: number;
  frail: number;
  fouled: number;
  exposed: boolean;
  exposedTurns: number;
  molt: boolean;
  openSkyGuard: number;
  openSkyReduction: number;
  // Formation "Flow": rises as the flock presses the attack, shatters when an
  // unblocked hit lands. Drives the Scatter / Hold / Surge state (see flockState).
  flow: number;
  flowMax: number;
}


// The flock is always in one of three formation states, derived from Cohesion
// and Flow. SURGING (Flow full) hits and guards harder; SCATTERED (Cohesion
// low) fights weaker; HOLDING is the stable middle.
export type FlockState = 'scattered' | 'holding' | 'surging';


export interface Enemy {
  flywayBroken?: boolean;
  flywayBreakUsed?: boolean;
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  weak: number;
  intentIndex: number;
  phase: 1 | 2;
  hitThisTurn: boolean;
  nextAttackBonus: number;
  damageBonus: number;
  roles: EnemyRole[];
  solo: boolean;
  runtime: RuntimeEnemy;
}


export interface Card {
  preenBranch?: PreenBranch;
  instanceId: string;
  id: string;
  name: string;
  type: CardType;
  role: CardRole;
  target: TargetType;
  cost: number;
  text: string;
  upgradedText: string;
  heldText: string;
  moltText: string; // formatted Molt ability (empty if the card has none)
  moltTextUpgraded: string; // formatted PREENED Molt ability (empty if none)
  bird: string;
  runtime: RuntimeCard;
  upgraded?: boolean;
}


export interface ActiveCardContract {
  effects: string[];
  text: string;
  target: TargetType;
  baseTarget: TargetType;
  role: CardRole;
  usesMolt: boolean;
  label: 'Normal' | 'Molt';
}


export interface PlayCardOptions {
  resolveDelayMs?: number;
}


export interface EndTurnOptions {
  enemyPacing?: boolean;
}


export interface StartPlayerTurnOptions {
  announceDelayMs?: number;
  onReady?: () => void;
}


export interface TextureVisibleBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}


export interface SavedCard {
  preenBranch?: PreenBranch;
  id: string;
  upgraded?: boolean;
}


export interface NextCombatMods {
  wingbeatBonus?: number;
  openSkyGuard?: number;
  reduceNextOpenSky?: number;
  enemyCover?: number;
  startOpenSky?: boolean;
  bossDamageShield?: number;
}


export interface RunState {
  flyway?: FlywayState;
  pendingCardClaims?: PendingCardClaim[];
  cardClaimSequence?: number;
  pendingCombatReward?: RewardCheckpoint;
  deck: SavedCard[];
  leaderId?: string;
  difficulty?: number;
  seed?: string;
  runMode?: RunMode;
  currentHp: number;
  scrap: number;
  scrapEarned?: number;
  scrapSpent?: number;
  startedAtMs?: number;
  seenEnemyMoves?: string[];
  districtContracts?: DistrictContractState[];
  routeMarks: string[];
  supplies: string[];
  supplySlots?: number;
  mapIndex: number;
  completedRouteNodeIds: string[];
  currentRouteNodeId?: string;
  routeLog: string[];
  nextCombat?: NextCombatMods;
  signalChoices?: SignalChoiceEvent[];
  rewardEvents?: CardRewardEvent[];
  routeDecisions?: RouteDecisionEvent[];
  suppliesUsed?: string[];
  combatResults?: CombatResultSummary[];
  freePreenNextDistrict?: number;
  pendingDistrictPreens?: number;
  districtAdvanceNotice?: {
    fromMapName: string;
    toMapName: string;
    toMapIndex: number;
  };
}


export interface CombatDecisionStats {
  cardsPlayed: number;
  overextensions: number;
  lowCardTurns: number;
  noOverextensionTurns: number;
  turnEnds: number;
  cardsHeldAtRoost: number;
  unspentWingbeatAtRoost: number;
  maxCardsPlayedTurn: number;
  waymarksAtStart: number;
  waymarksAtEnd: number;
  surgesTriggered?: number;
  blockedDamage?: number;
  bossEntryCohesion?: number;
  bossEntryScrap?: number;
  invalidActions?: number;
  cancelledActions?: number;
}


export interface EnemyMoveDamageSummary {
  enemyId: string;
  moveId: string;
  moveLabel: string;
  damageTaken: number;
  blockedDamage: number;
  hitCount: number;
}


export interface SignalChoiceEvent {
  signalId: string;
  choiceKey: string;
}


export interface CardRewardEvent {
  offered: string[];
  picked?: string;
  skipped: boolean;
  fallback?: 'scrap' | 'preen';
  decisionMs?: number;
}


export interface RouteDecisionEvent {
  offered: string[];
  picked: string;
  decisionMs: number;
}


export interface WaymarkFeedback {
  id: string;
  name: string;
  summary: string;
  turn: number;
}


export interface SupplyFeedback {
  id: string;
  name: string;
  summary: string;
  timing: RuntimeSupply['timing'];
  turn?: number;
}


export interface CombatResultSummary {
  cardContributions?: CardContribution[];
  encounterId: string;
  nodeId: string;
  nodeType: RouteNode['type'];
  enemyIds: string[];
  turnsTaken: number;
  damageDealt: number;
  cohesionLost: number;
  killedByMove?: string;
  durationMs?: number;
  damageTakenByMove?: EnemyMoveDamageSummary[];
  objective?: {
    type: EncounterObjective['type'];
    title: string;
    status: 'complete' | 'failed' | 'active';
    bonusScrap: number;
  };
  decisionStats?: CombatDecisionStats;
}


export interface RouteMark {
  id: string;
  name: string;
  text: string;
  price: number;
}


export interface MarketCardListing {
  id: string;
  price: number;
  sold?: boolean;
}


export interface MarketWaymarkListing {
  id: string;
  price: number;
  sold?: boolean;
}


export interface MarketUtilityListing {
  id: 'preen' | 'release' | 'supply' | typeof MARKET_BOSS_GUARD | typeof MARKET_ROUTE_SCOUT;
  price: number;
  supplyId?: string;
  sold?: boolean;
}


export type EnemyMotionCue = 'windup' | 'attack' | 'hit';

export type EnemyTurnBeat = 'idle' | 'preamble' | 'windup' | 'release' | 'impact' | 'recovery' | 'interlude';

export type MotionPreference = 'system' | 'full' | 'reduced';

export type CombatPace = 'cinematic' | 'standard' | 'snappy';

export type AnimationPace = 'relaxed' | 'standard' | 'fast';

export type TextPace = 'relaxed' | 'standard' | 'fast';


export interface EnemyTurnProgress {
  label: string;
  progress: number;
  elapsedMs: number;
  durationMs: number;
}


interface EnemyTurnAcceleration {
  available: boolean;
  eligible: boolean;
  held: boolean;
  active: boolean;
  multiplier: number;
}


export interface EncounterObjective {
  type: 'priority' | 'preserve_flow' | 'swift_clear' | 'clean_roost' | 'finish_guarded' | 'no_damage' | 'trigger_surge' | 'bank_wingbeat' | 'block_damage';
  title: string;
  description: string;
  bonusScrap: number;
  targetEnemyId?: string;
  deadlineTurn?: number;
  targetAmount?: number;
}


export interface EncounterObjectiveProgress {
  current: number;
  target: number;
  label: string;
}


export interface RenderPayload {
  signatureFight?: unknown;
  cardContributions?: CardContribution[];
  cardAction?: { style: string; cardId: string; reducedMotion: boolean };
  cardPayoff?: { text: string; cardId: string; results: string[] };
  flyway?: FlywayState & { combat?: ReturnType<typeof newFlightCombat>; pacing?: unknown };
  practice?: boolean;
  mode: GameMode;
  scene: string;
  assetReadiness?: SceneAssetReadinessState;
  combatAnimationPending?: boolean;
  playerCardFeedback?: {
    active: boolean;
    baselineObjects: number;
    transientObjects: number;
    lastRetiredObjects: number;
  };
  combatIntro?: {
    active: boolean;
    dismissQueued: boolean;
    dismissed: boolean;
    minimumReadableMs: number;
    elapsedMs: number;
    binding: string;
  };
  combatEnemyTurnBeat?: EnemyTurnBeat;
  combatEnemyTurnMove?: string;
  combatEnemyTurnProgress?: EnemyTurnProgress;
  combatEnemyTurnAcceleration?: EnemyTurnAcceleration;
  difficulty?: DifficultyMods & { label: string };
  audio?: {
    muted: boolean;
    mood: AudioMood;
    unlocked: boolean;
    musicVolume: number;
    sfxVolume: number;
    voiceVolume: number;
    ambienceVolume: number;
    cueRequests: Partial<Record<AudioCue, number>>;
  };
  motion?: {
    preference: MotionPreference;
    reduced: boolean;
    systemReduced: boolean;
  };
  visualContrast?: ReturnType<typeof visualContrastState>;
  colorCues?: ReturnType<typeof colorCueState>;
  screenShake?: ReturnType<typeof currentScreenShakeState>;
  flashEffects?: ReturnType<typeof currentFlashEffectsState>;
  graphics?: ReturnType<typeof graphicsQualityState>;
  screenReader?: ReturnType<typeof screenReaderState>;
  graphicsRuntime?: {
    atmosphereStrips?: number;
    activeParticleBursts?: number;
    particleBurstCap?: number;
    ambientAnimations?: boolean;
  };
  battleFxPresenter?: {
    ready: boolean;
    loaded: boolean;
  };
  battleDebugState?: {
    ready: boolean;
    loaded: boolean;
  };
  battleBackdropRenderer?: {
    ready: boolean;
    loaded: boolean;
  };
  battleForegroundRenderer?: {
    ready: boolean;
    loaded: boolean;
  };
  battleHudRenderer?: {
    ready: boolean;
    loaded: boolean;
  };
  battleHandRenderer?: {
    ready: boolean;
    loaded: boolean;
  };
  battleRewardRenderer?: {
    requested: boolean;
    ready: boolean;
    loaded: boolean;
    failed: boolean;
  };
  battleInspectRenderer?: {
    requested: boolean;
    loaded: boolean;
    failed: boolean;
  };
  combatPacing?: {
    preference: CombatPace;
  };
  animationPacing?: ReturnType<typeof animationPacingState>;
  textPacing?: ReturnType<typeof textPacingState>;
  openingDraw?: OpeningDrawState;
  combatRender?: {
    requests: number;
    passes: number;
    coalesced: number;
    queued: boolean;
    lastMs: number;
    maxMs: number;
    totalMs: number;
    backdropBuilds: number;
    backdropReuses: number;
    handBuilds: number;
    handReuses: number;
    backdropObjects: number;
    uiObjects: number;
  };
  audioTogglePulseRing?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  audioToggleWaveBurst?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    visible: number;
  };
  systemSettingsRowFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  systemSettingsToggleFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  systemSettingsVolumeSliderFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  systemSettingsMotionSwitchFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  systemFieldCommandFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  systemOverlayTitlePlaque?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  systemPauseDetailRowFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  howToPlayTipRowFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  paused?: boolean;
  pauseSaveFailed?: boolean;
  settingsOverlayOpen?: boolean;
  settingsFocus?: { index: number; label: string };
  controls?: ReturnType<typeof controlsTextState>;
  unlockHighlights?: {
    iconLoaded: boolean;
    flourishLoaded: boolean;
    items: Array<{ id: string; name: string; kind: 'leader' | 'achievement' | 'contract' | 'dossier' | 'record'; description: string }>;
  };
  runOutcomeStatRowFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  runOutcomeCommandFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  runOutcomeReportFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  runOutcomeTitlePlaque?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  defeatReview?: import('../boss-dossier').DefeatReview;
  outcomeFlightDetails?: {
    open: boolean;
    details?: import('../boss-dossier').OutcomeFlightDetails;
  };
  battleHudRail?: {
    loaded: boolean;
    rendered: boolean;
  };
  combatFloatingCallout?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatCohesionGaugeFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatPileDock?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatRoostCommandFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatRoostHandoff?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatPlayerTurnRally?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatLogFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatLogEventBead?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatTooltipFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  keywordTooltip?: { keyword: string; definition: string };
  routeCommitTooltipFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  routeCommitStreak?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  routeCommitPending?: boolean;
  titleRunLaunchFlourish?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
    pending: boolean;
  };
  routeRiskMeterFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  codexBackCommandFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  codexTabFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  codexCloseCommandFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  codexScrollCueFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  codexGridScrollCueFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatIncomingForecastFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatBeatProgressFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatHudMetricChipFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatSuitKeystoneChipFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatStatsTallyFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatStatsTallyRowFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatStatsTallyTitlePlaque?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatHandRail?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatEnemyVitalsFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatEnemyStatusChipFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatEncounterPlaque?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatSupplyFeedbackFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatSupplyUseBurst?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatWaymarkFeedbackFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  enemyIntentRing?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatEliteCrest?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatImpactFlash?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatPlayerHitConfirm?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatPlayerCommitSigil?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatActionTrail?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatCastFocusBurst?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatWingbeatSpend?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatEnemySwipe?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatEnemyCommitmentSeal?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatEnemyAttackTell?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatEnemyWindupPlaque?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
    labels: string[];
  };
  combatEnemySupportCharge?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatEnemySupportTell?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatFlockImpactBurst?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatEnemyImpactContact?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatOverextensionWarning?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatBossPhaseBreak?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatStatusCleanseSpecific?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatOpenSkyBreak?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatCacheChoiceReveal?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatMoltTriggerChoice?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatEnemyHeavyContact?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatEnemyHealBeam?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatResourceOvercap?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatCoverGuard?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatCoverBlockBurst?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatEnemyCoverBlock?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatPerfectBraceRiposte?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatPinnedOpeningStrike?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatFourSuitRally?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatSparkEcho?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatOverflowShelter?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatFormationShift?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatHealBloom?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatEnemyMend?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatEnemyCover?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatCoverShatter?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatCardDraw?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatDiscardSweep?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatShuffleVortex?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatFouledPressure?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatRuffledBreak?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatResonanceSurge?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatResonanceSpend?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatWingbeatSurge?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatWingbeatDrain?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatWindedGust?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatFlowSurge?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatCleanseBurst?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatBankCache?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatThreatCharge?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatEnemyRecoveryAfterglow?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatMoltShift?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatOpenSkyGuard?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatOpenSkyExposure?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatDefeatBurst?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatEncounterIntro?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatVictoryRally?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatMoltPower?: {
    total: number;
    bursts: number;
    rendered: boolean;
  };
  combatVictoryFanfareSigil?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatTurnBanner?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  combatAtmosphereStrip?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatCardBack?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatTargetReticle?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatTargetLockPulse?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatHandSelectedPulse?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatHandCardFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  encounter: number;
  encounterObjective?: EncounterObjective & { status: string; progress: EncounterObjectiveProgress };
  encounterObjectiveFeedback?: {
    status?: 'active' | 'complete' | 'failed';
    bursts: number;
    rendered: boolean;
  };
  turn: number;
  energy: number;
  resonance: number;
  flow: number;
  flowMax: number;
  flowPreview?: number;
  flowRail?: {
    rendered: boolean;
    previewPips: number;
    status: string;
    breakPreview: boolean;
    holdPreview: boolean;
  };
  firstCombatGuidance?: {
    active: boolean;
    rendered: boolean;
    cardName?: string;
    cost?: number;
    target?: string;
  };
  firstFlightGuide?: ReturnType<typeof firstFlightGuideState>;
  practiceLesson?: { id: string; title: string; step?: number; instruction: string; complete: boolean; finished?: boolean };
  firstMoltGuide?: ReturnType<typeof firstMoltGuideState> & {
    cardId?: string;
    cardName?: string;
    rendered: boolean;
  };
  overextension: {
    cardsPlayedThisTurn: number;
    threshold: number;
    safeCardsRemaining: number;
    currentlyExposed: boolean;
  };
  selectedCard?: string;
  selectedCardOutcome?: { card: string; target: string; summary: string };
  discardChoice?: {
    source: string;
    optional: boolean;
    max: number;
    required: number;
    selectedCount: number;
    canConfirm: boolean;
    candidates: Array<{ instanceId: string; id: string; name: string; selected: boolean; order?: number }>;
    input: { choose: string; toggle: string; confirm: string; cancel: string };
  };
  returnChoice?: {
    source: string;
    filter: string;
    drawAfter: number;
    required: number;
    canCancel: boolean;
    focusIndex: number;
    focusedId?: string;
    candidates: Array<{
      instanceId: string;
      id: string;
      name: string;
      cost: number;
      role: string;
      summary: string;
      focused: boolean;
      discardOrder: number;
    }>;
    input: { choose: string; confirm: string; cancel: string };
  };
  combatInputFocus?: {
    active: boolean;
    kind?: CombatInputChoiceKind;
    index?: number;
    count: number;
    handPage?: { page: number; pages: number; first: number; last: number };
    label?: string;
    target?: string;
    visibleFocus: boolean;
    bindings: { previous: string; next: string; confirm: string; roost: string; pause: string; history: string };
    controller: { choose: string; target: string; play: string; back: string; pause: string; roost: string };
  };
  rewardInspection?: {
    open: boolean;
    cardId?: string;
    cardName?: string;
    cost?: number;
    rules?: string;
    deckImpact?: { deckBefore: number; deckAfter: number; handBefore: number; handAfter: number; stats: string[]; scope: string; drawScope: string };
    source?: 'combatReward' | 'preenReward';
    returnIndex: number;
    selectActionPreserved: boolean;
  };
  rewardSkip?: {
    available: boolean;
    armed: boolean;
    scrap: number;
    deckSize: number;
    scrapAfter: number;
    commitBlockedUntilConfirmed: boolean;
    input: {
      keyboard: string;
      controller: string;
      pointer: string;
      cancel: string;
    };
  };
  inspectedCard?: {
    id: string;
    name: string;
    bird: string;
    zone: string;
    cost: number;
    type: CardType;
    role: CardRole;
    target: TargetType;
    activeTarget?: TargetType;
    activeRole?: CardRole;
    activeText?: string;
    usesMolt?: boolean;
    baseText: string;
    upgradedText: string;
    flockStats: Array<{ label: string; value: number }>;
  };
  cardInspectFocus?: {
    active: boolean;
    overlay: 'deck' | 'draw' | 'discard' | 'cleared';
    instanceId?: string;
    index: number;
    count: number;
    visibleStart: number;
    visibleEnd: number;
    label?: string;
    zone?: string;
    zoneCounts: { deck: number; draw: number; discard: number; cleared: number };
    bindings: { select: string; previousZone: string; nextZone: string; back: string; details: string };
    controller: { choose: string; zone: string; page: string; back: string };
  };
  selectedEnemy?: string;
  deckIds: string[];
  drawPile: number;
  discardPile: number;
  clearedPile: number;
  deckSize: number;
  flock: {
    hp: number;
    maxHp: number;
    block: number;
    fouled: number;
    incoming: {
      total: number;
      blocked: number;
      hpLoss: number;
      afterHp: number;
      attackers: number;
    };
    statuses: string[];
  };
  hand: Array<{ instanceId: string; id: string; name: string; bird: string; cost: number; type: CardType; role: CardRole; target: TargetType; activeTarget?: TargetType; activeRole?: CardRole; activeText?: string; usesMolt?: boolean; retainOrder?: number; discardSelectable?: boolean; discardSelected?: boolean; discardOrder?: number }>;
  retentionPlan?: {
    count: number;
    cards: Array<{ instanceId: string; id: string; name: string; order: number }>;
    selectedPriority?: string;
    rule: string;
  };
  waymarkChoices?: Array<{ id: string; name: string; family: string; rarity: RouteMarkRarity; source: string; description: string }>;
  rewardChoices?: Array<{
    id: string;
    name: string;
    bird: string;
    cost: number;
    type: CardType;
    target: TargetType;
    observations: string[];
    collection: { firstClaim: boolean; timesClaimed: number; targeted: boolean; runCopyTemporary: true };
  }>;
  rewardDistrictLean?: string[];
  upgradeChoices?: Array<{ id: string; name: string; bird: string; cost: number; type: CardType; target: TargetType }>;
  rewardDecisionDeltas?: string[];
  enemies: Array<{
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    block: number;
    weak: number;
    roles: EnemyRole[];
    solo: boolean;
    damageBonus: number;
    intent: string;
    intentIndex: number;
    phase: 1 | 2;
    phaseName?: string;
    phaseThreshold?: number;
    phaseTwoMoveIds?: string[];
  }>;
  route: {
    mapId: string;
    mapName: string;
    currentNodeId: string;
    currentPayloadId: string;
    completedNodeIds: string[];
    scrap?: number;
    routeMarks?: string[];
    supplies?: string[];
    supplySlots?: number;
    battlefieldAssetKey?: string;
    battlefieldVariant?: boolean;
    battlefieldMood?: 'street' | 'rival' | 'boss';
  };
  inspectOverlay?: InspectOverlay;
  combatCardDetail?: { kind?: 'card' | 'history'; card: string; page: number; pageCount: number; heading: string; body: string; controls: string };
  flockStatsFlourish?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  flockStatsTitlePlaque?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  flockStatsCaptionFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  flockStatsFooterFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  flockStatsHeaderFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  flockStatsRowFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  deckReviewScrollButtonFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  deckReviewRowFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  deckReviewPageIndicatorFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  deckReviewTitlePlaque?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  deckReviewDetailFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  deckReviewCostBadge?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  deckReviewMetaChipFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  deckReviewSectionTabFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  cardPickerScrollButtonFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  cardPickerCostBadge?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  cardPickerPageIndicatorFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  cardPickerNameplateFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  cardPickerContextPlaque?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  cardPickerDecisionDeltas?: string[];
  marketEnamelCommandFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  marketServiceButtonFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  marketItemLabelFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  marketCardPriceTagFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  marketSoldSlatFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  marketVendorTitlePlaque?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  routeEventTitlePlaque?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  routeEventCancelCommandFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  routeChoiceOptionFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  routeChoiceDetailFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  routeChoicePreviewRowFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  cardHoverDossierFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  cardHoverStatChipFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  rewardCeremonyBackdrop?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  rewardChoiceCardFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  rewardChoiceGlowBurst?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    bursts: number;
  };
  rewardChoiceHoverRing?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
    visible: number;
  };
  rewardHeaderPlaque?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  rewardDeckNeedChipFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  rewardSkipCommandFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatPileReviewFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatPileRowFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatPileScrollButtonFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatPileCountBadge?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatPileDetailChipFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatPileStatChipFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatPileTitlePlaque?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  combatPilePageIndicatorFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  overlayCloseCommandFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  waymarkDrawerOpen?: boolean;
  waymarkReaderNotice?: string;
  waymarkReview?: {
    open: boolean;
    count: number;
    selectedIndex: number;
    scrollRow: number;
    comparing: boolean;
    selected?: {
      id: string;
      name: string;
      family: string;
      rarity: string;
      source: string;
      trigger: string;
      description: string;
      effects: Array<{ order: number; text: string; grammar: string }>;
      tags: string[];
    };
    pinned?: {
      id: string;
      name: string;
      trigger: string;
      effects: Array<{ order: number; text: string; grammar: string }>;
      tags: string[];
    };
    renderer: {
      requested: boolean;
      loaded: boolean;
      failed: boolean;
    };
    controls: {
      select: string;
      pin: string;
      pinController: string;
      close: string;
    };
  };
  supplyDrawerOpen?: boolean;
  supplyDrawer?: {
    open: boolean;
    focusIndex: number;
    inputActive: boolean;
    armedIndex?: number;
    entries: Array<{
      id?: string;
      name?: string;
      description?: string;
      summary?: string;
      rules?: string;
      timing?: RuntimeSupply['timing'];
      usable: boolean;
      empty?: boolean;
    }>;
    renderer: {
      requested: boolean;
      loaded: boolean;
      failed: boolean;
    };
    controls: {
      open: string;
      select: string;
      confirm: string;
      close: string;
    };
  };
  confirmExitOpen?: boolean;
  waymarkFeedback?: WaymarkFeedback[];
  supplyFeedback?: SupplyFeedback[];
  routeSupplyFeedbackFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  routeBossBeaconRing?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  runKitItemTileFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  runKitEmptySlotFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  routeWaymarkScrollRailFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  bossPrepReadinessChipFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  bossPrepPressurePlaque?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  bossPrepSignalModule?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  bossPrepRouteForPlate?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  confirmExitFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  confirmExitCommandFrame?: {
    loaded: boolean;
    rendered: boolean;
    count: number;
  };
  piles: {
    deck: number;
    draw: number;
    hand: number;
    discard: number;
    cleared: number;
  };
  flockStats: Array<{
    label: string;
    base: number;
    flock: number;
    current: number;
  }>;
  log: string[];
}


export interface RouteSceneData {
  runState?: RunState;
  card?: string;
}


export interface BattleSceneData {
  practiceEncounterId?: string;
  turnCheckpoint?: TurnCheckpoint;
  practiceRematch?: boolean;
  routeNodeId?: string;
  runState?: RunState;
}


// Run summary emitted on win/loss for local playtest stats
// (next-level-implementation-spec Phase 5 / next-level-data-contracts Â§10).
export interface RunSummary {
  flyway?: FlywayState;
  pendingCardClaims?: PendingCardClaim[];
  id: string;
  seed: string;
  result: 'win' | 'loss';
  leaderId?: string;
  difficulty?: number;
  runMode: RunMode;
  mapId: string;
  finalNodeId: string;
  killedBy?: string;
  turnsTaken: number;
  durationMs: number;
  currentCohesion: number;
  maxCohesion: number;
  scrapEarned: number;
  scrapSpent: number;
  finalScrap: number;
  path: string[];
  deck: SavedCard[];
  routeMarks: string[];
  suppliesUsed: string[];
  signals: SignalChoiceEvent[];
  cardRewards: CardRewardEvent[];
  routeDecisions: RouteDecisionEvent[];
  combatResults: CombatResultSummary[];
  districtContracts: DistrictContractState[];
  seenEnemyMoves: string[];
  combatPace: CombatPace;
  animationPace: AnimationPace;
  firstFlightGuide: ReturnType<typeof firstFlightGuideState>;
  experienceFeedback?: import('../profile-scene').PlaytestExperienceFeedback;
  decisionStats?: {
    cardsPlayed: number;
    overextensions: number;
    lowCardTurns: number;
    noOverextensionTurns: number;
    cardsHeldAtRoost: number;
    unspentWingbeatAtRoost: number;
    maxCardsPlayedTurn: number;
    finalWaymarks: number;
    blockedDamage: number;
    invalidActions: number;
    cancelledActions: number;
    bossEntryCohesion?: number;
    bossEntryScrap?: number;
  };
}


export type AudioMood = 'menu' | 'route' | 'battle' | 'boss' | 'victory' | 'defeat';

export type CodexSection = 'cards' | 'items' | 'glossary' | 'leaders' | 'enemies';

export type CodexEnemySource = 'encounter' | 'reserve';

export type CodexItemEntry =
  | { kind: 'waymark'; id: string; mark: RuntimeRouteMark }
  | { kind: 'supply'; id: string; supply: RuntimeSupply };

export type CodexItemTab = { label: string; match: (item: CodexItemEntry) => boolean };

export type CodexGlossaryTerm = CodexDataModule['codexGlossaryTerms'][number];


export interface CodexEnemyEntry {
  id: string;
  name: string;
  species: string;
  district: string;
  role: string;
  typeHint: string;
  varietyContribution: string;
  description: string;
  visualBrief: string;
  silhouette: string;
  artPose: string;
  moveKit: Array<{ id?: string; text: string }>;
  source: CodexEnemySource;
  health?: number;
}
